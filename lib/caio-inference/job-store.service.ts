import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { jsonStringify, safeParseJson } from "@/lib/utils";

import {
  CAIO_INFERENCE_ROUTE_TASK_CLASS,
  computeCaioInferenceInputHash,
  type CaioInferenceInput,
  type CaioInferenceRejectionCode,
  type CaioInferenceTaskClass,
} from "./contracts";
import { buildCaioInferenceJudgementPacket } from "./judgement-packet";
import { validateCaioLayeredJudgement } from "./layered-judgement";

/**
 * Pull inference job queue. The queue owns task state and the judgement body; every egress step goes through
 * the governed deferred dispatch port, so the queue never touches the egress authority itself. A claim is
 * lease-bound: a submission after the lease, for another claim, or against another frozen input is refused,
 * and only the reconciliation pass may release a claim.
 */
export type CaioInferenceDispatchPort = {
  claim: (input: {
    workspaceId: string;
    jobId: string;
    taskClass: CaioInferenceTaskClass;
    routeTaskClass: (typeof CAIO_INFERENCE_ROUTE_TASK_CLASS)[CaioInferenceTaskClass];
    inferenceInput: CaioInferenceInput;
    attempt: number;
    now: Date;
  }) => Promise<
    | {
        status: "claimed";
        decisionRef: string;
        gatewayRef: string;
        claimHash: string;
        leaseExpiresAt: string;
      }
    | {
        status: "blocked" | "not_dispatched" | "in_doubt" | "success" | "failure" | "partial" | "unknown";
        reasonCode?: string | null;
      }
  >;
  complete: (input: {
    workspaceId: string;
    decisionRef: string;
    gatewayRef: string;
    claimHash: string;
    layeredJudgementHash: string;
    now: Date;
  }) => Promise<{ status: string }>;
  expire: (input: {
    workspaceId: string;
    decisionRef: string;
    gatewayRef: string;
    claimHash: string;
    now: Date;
  }) => Promise<{ status: string }>;
};

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;
const DEFAULT_MAX_ATTEMPTS = 3;
const QUEUE_WINDOW_DEADLINE_MS: Readonly<Record<CaioInferenceTaskClass, number>> = {
  hourly_diagnosis: 2 * 3_600_000,
  daily_review: 24 * 3_600_000,
};

export type CaioInferenceClaim = {
  status: "claimed";
  jobId: string;
  claimToken: string;
  inputHash: string;
  input: CaioInferenceInput;
  leaseExpiresAt: Date;
};

export async function enqueueCaioInferenceJob(input: {
  workspaceId: string;
  taskClass: CaioInferenceTaskClass;
  windowStart: Date;
  windowEnd: Date;
  input: CaioInferenceInput;
  now?: Date;
}): Promise<{ status: "enqueued" | "already_enqueued"; jobId: string }> {
  const existing = await db.caioInferenceJob.findUnique({
    where: {
      workspaceId_taskClass_windowStart: {
        workspaceId: input.workspaceId,
        taskClass: input.taskClass,
        windowStart: input.windowStart,
      },
    },
    select: { id: true },
  });
  if (existing) return { status: "already_enqueued", jobId: existing.id };
  try {
    const created = await db.caioInferenceJob.create({
      data: {
        workspaceId: input.workspaceId,
        taskClass: input.taskClass,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        status: "queued",
        inputJson: jsonStringify(input.input),
        inputHash: computeCaioInferenceInputHash(input.input),
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: { id: true },
    });
    return { status: "enqueued", jobId: created.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await db.caioInferenceJob.findUniqueOrThrow({
        where: {
          workspaceId_taskClass_windowStart: {
            workspaceId: input.workspaceId,
            taskClass: input.taskClass,
            windowStart: input.windowStart,
          },
        },
        select: { id: true },
      });
      return { status: "already_enqueued", jobId: raced.id };
    }
    throw error;
  }
}

export async function claimCaioInferenceJob(input: {
  workspaceId: string;
  dispatch: CaioInferenceDispatchPort;
  now?: Date;
}): Promise<CaioInferenceClaim | { status: "none" } | { status: "rejected"; jobId: string; code: CaioInferenceRejectionCode }> {
  const now = input.now ?? new Date();
  const claimToken = randomUUID();
  const reserved = await runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      const candidate = await tx.caioInferenceJob.findFirst({
        where: { workspaceId: input.workspaceId, status: "queued" },
        orderBy: { createdAt: "asc" },
        select: { id: true, taskClass: true, inputJson: true, inputHash: true, attempt: true },
      });
      if (!candidate) return null;
      // Read count CAS inside the Serializable transaction: two workers never reserve the same row.
      const reservation = await tx.caioInferenceJob.updateMany({
        where: { id: candidate.id, workspaceId: input.workspaceId, status: "queued" },
        data: {
          status: "claimed",
          claimToken,
          claimedAt: now,
          leaseExpiresAt: now,
          attempt: { increment: 1 },
          rejectionCode: null,
          updatedAt: now,
        },
      });
      return reservation.count === 1 ? candidate : null;
    }, TRANSACTION_OPTIONS),
  );
  if (!reserved) return { status: "none" };

  const parsedInput = safeParseJson<CaioInferenceInput | null>(reserved.inputJson, null);
  if (!parsedInput || computeCaioInferenceInputHash(parsedInput) !== reserved.inputHash) {
    await rejectJob({ jobId: reserved.id, code: "input_hash_mismatch", now });
    return { status: "rejected", jobId: reserved.id, code: "input_hash_mismatch" };
  }

  const taskClass = reserved.taskClass as CaioInferenceTaskClass;
  const dispatched = await input.dispatch.claim({
    workspaceId: input.workspaceId,
    jobId: reserved.id,
    taskClass,
    routeTaskClass: CAIO_INFERENCE_ROUTE_TASK_CLASS[taskClass],
    inferenceInput: parsedInput,
    attempt: reserved.attempt + 1,
    now,
  });
  if (dispatched.status !== "claimed") {
    await rejectJob({ jobId: reserved.id, code: "dispatch_claim_denied", now });
    return { status: "rejected", jobId: reserved.id, code: "dispatch_claim_denied" };
  }

  const leaseExpiresAt = new Date(dispatched.leaseExpiresAt);
  await db.caioInferenceJob.update({
    where: { id: reserved.id },
    data: {
      decisionRef: dispatched.decisionRef,
      gatewayRef: dispatched.gatewayRef,
      dispatchClaimHash: dispatched.claimHash,
      leaseExpiresAt,
      updatedAt: now,
    },
  });
  return {
    status: "claimed",
    jobId: reserved.id,
    claimToken,
    inputHash: reserved.inputHash,
    input: parsedInput,
    leaseExpiresAt,
  };
}

export async function submitCaioInferenceJudgement(input: {
  workspaceId: string;
  jobId: string;
  claimToken: string;
  inputHash: string;
  output: unknown;
  dispatch: CaioInferenceDispatchPort;
  now?: Date;
}): Promise<
  | { status: "completed"; judgementHash: string }
  | { status: "replayed"; judgementHash: string }
  | { status: "rejected"; code: CaioInferenceRejectionCode }
> {
  const now = input.now ?? new Date();
  const job = await db.caioInferenceJob.findFirst({
    where: { id: input.jobId, workspaceId: input.workspaceId },
  });
  if (!job) return { status: "rejected", code: "claim_token_mismatch" };
  if (job.status === "completed") {
    return { status: "replayed", judgementHash: job.layeredJudgementHash ?? "" };
  }
  if (
    job.status !== "claimed" ||
    !job.claimToken ||
    job.claimToken !== input.claimToken ||
    !job.decisionRef ||
    !job.gatewayRef ||
    !job.dispatchClaimHash
  ) {
    return { status: "rejected", code: "claim_token_mismatch" };
  }
  if (job.inputHash !== input.inputHash) {
    return { status: "rejected", code: "input_hash_mismatch" };
  }
  if (!job.leaseExpiresAt || now.getTime() >= job.leaseExpiresAt.getTime()) {
    return { status: "rejected", code: "lease_expired" };
  }

  const frozenInput = safeParseJson<CaioInferenceInput | null>(job.inputJson, null);
  if (!frozenInput) return { status: "rejected", code: "malformed_output" };
  const validation = validateCaioLayeredJudgement(input.output, new Set(frozenInput.evidenceRefs));
  if (!validation.ok) {
    await rejectJob({ jobId: job.id, code: validation.code, now });
    return { status: "rejected", code: validation.code };
  }
  const packet = buildCaioInferenceJudgementPacket({
    workspaceId: input.workspaceId,
    jobId: job.id,
    inferenceInput: frozenInput,
    layered: validation.value,
    now,
  });
  if (!packet.ok) {
    await rejectJob({ jobId: job.id, code: packet.code, now });
    return { status: "rejected", code: packet.code };
  }

  // The terminal receipt is written by the governed dispatch before the judgement is stored.
  const completed = await input.dispatch.complete({
    workspaceId: input.workspaceId,
    decisionRef: job.decisionRef,
    gatewayRef: job.gatewayRef,
    claimHash: job.dispatchClaimHash,
    layeredJudgementHash: validation.contentHash,
    now,
  });
  if (completed.status !== "success" && completed.status !== "partial") {
    return { status: "rejected", code: "dispatch_claim_denied" };
  }

  await db.caioInferenceJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      judgementPacketJson: jsonStringify(packet.packet),
      layeredJudgementJson: jsonStringify(validation.value),
      layeredJudgementHash: validation.contentHash,
      completedAt: now,
      rejectionCode: null,
      updatedAt: now,
    },
  });
  return { status: "completed", judgementHash: validation.contentHash };
}

export async function reclaimCaioInferenceJobs(input: {
  dispatch: CaioInferenceDispatchPort;
  workspaceId?: string;
  now?: Date;
  maxAttempts?: number;
}): Promise<{ requeued: number; deadLettered: number; expired: number }> {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const outcome = { requeued: 0, deadLettered: 0, expired: 0 };

  const expiredClaims = await db.caioInferenceJob.findMany({
    where: {
      status: "claimed",
      leaseExpiresAt: { lt: now },
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    select: {
      id: true, workspaceId: true, attempt: true, decisionRef: true, gatewayRef: true, dispatchClaimHash: true,
    },
  });
  for (const claim of expiredClaims) {
    if (claim.decisionRef && claim.gatewayRef && claim.dispatchClaimHash) {
      // Reconciliation only: a lease that ran out is never resent blindly on the same decision.
      await input.dispatch.expire({
        workspaceId: claim.workspaceId,
        decisionRef: claim.decisionRef,
        gatewayRef: claim.gatewayRef,
        claimHash: claim.dispatchClaimHash,
        now,
      });
    }
    const deadLetter = claim.attempt >= maxAttempts;
    const released = await runWithWriteConflictRetry(() =>
      db.$transaction(
        (tx) =>
          tx.caioInferenceJob.updateMany({
            where: { id: claim.id, status: "claimed" },
            data: {
              status: deadLetter ? "dead_letter" : "queued",
              claimToken: null,
              claimedAt: null,
              leaseExpiresAt: null,
              decisionRef: null,
              gatewayRef: null,
              dispatchClaimHash: null,
              rejectionCode: deadLetter ? "lease_expired" : null,
              updatedAt: now,
            },
          }),
        TRANSACTION_OPTIONS,
      ),
    );
    if (released.count === 1) {
      if (deadLetter) outcome.deadLettered += 1;
      else outcome.requeued += 1;
    }
  }

  const queued = await db.caioInferenceJob.findMany({
    where: { status: "queued", ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}) },
    select: { id: true, taskClass: true, windowEnd: true },
  });
  for (const job of queued) {
    const deadline = QUEUE_WINDOW_DEADLINE_MS[job.taskClass as CaioInferenceTaskClass];
    if (deadline === undefined || now.getTime() - job.windowEnd.getTime() <= deadline) continue;
    const expired = await runWithWriteConflictRetry(() =>
      db.$transaction(
        (tx) =>
          tx.caioInferenceJob.updateMany({
            where: { id: job.id, status: "queued" },
            data: { status: "expired", updatedAt: now },
          }),
        TRANSACTION_OPTIONS,
      ),
    );
    outcome.expired += expired.count;
  }
  return outcome;
}

async function rejectJob(input: { jobId: string; code: CaioInferenceRejectionCode; now: Date }): Promise<void> {
  await db.caioInferenceJob.updateMany({
    where: { id: input.jobId },
    data: {
      status: "rejected",
      rejectionCode: input.code,
      claimToken: null,
      leaseExpiresAt: null,
      updatedAt: input.now,
    },
  });
}

export function computeCaioInferenceJudgementHash(value: unknown): string {
  return sha256(canonicalJson(value));
}
