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
  /**
   * Terminal FAILURE for a dispatch whose lease is still active: the worker answered, the judgement was
   * refused. `expire` only reconciles a lease that has already run out, so it cannot close this case.
   */
  fail: (input: {
    workspaceId: string;
    decisionRef: string;
    gatewayRef: string;
    claimHash: string;
    errorCode: CaioInferenceRejectionCode;
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
    if (!job.claimToken || job.claimToken !== input.claimToken) {
      return { status: "rejected", code: "claim_token_mismatch" };
    }
    if (job.inputHash !== input.inputHash) {
      return { status: "rejected", code: "input_hash_mismatch" };
    }
    const frozenInput = safeParseJson<CaioInferenceInput | null>(job.inputJson, null);
    let frozenHash: string | null = null;
    try {
      if (frozenInput) frozenHash = computeCaioInferenceInputHash(frozenInput);
    } catch {
      // A damaged persisted input cannot authorize a completed replay.
    }
    if (!frozenInput || frozenHash !== job.inputHash || !Array.isArray(frozenInput.evidenceRefs)) {
      return { status: "rejected", code: "input_hash_mismatch" };
    }
    const validation = validateCaioLayeredJudgement(input.output, new Set(frozenInput.evidenceRefs));
    if (!validation.ok) return { status: "rejected", code: validation.code };
    if (!/^sha256:[a-f0-9]{64}$/u.test(job.layeredJudgementHash ?? "") ||
        validation.contentHash !== job.layeredJudgementHash) {
      return { status: "rejected", code: "output_hash_mismatch" };
    }
    return { status: "replayed", judgementHash: validation.contentHash };
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
    await closeDispatchAsFailure(input.dispatch, job, validation.code, now);
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
    await closeDispatchAsFailure(input.dispatch, job, packet.code, now);
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
}): Promise<{ requeued: number; deadLettered: number; expired: number; inDoubt: number }> {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const outcome = { requeued: 0, deadLettered: 0, expired: 0, inDoubt: 0 };

  const expiredClaims = await db.caioInferenceJob.findMany({
    where: {
      status: "claimed",
      leaseExpiresAt: { lt: now },
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    select: {
      id: true, workspaceId: true, attempt: true, claimToken: true, decisionRef: true, gatewayRef: true,
      dispatchClaimHash: true, rejectionCode: true,
    },
  });
  for (const claim of expiredClaims) {
    // A doubtful row is counted and left alone: its dispatch may have been charged, and only the governed
    // gateway (reconciliation on the identical request) or an operator may settle it. Requeuing it would
    // start a new attempt, that is a new request key, that is a blind resend.
    if (claim.rejectionCode === "in_doubt") {
      outcome.inDoubt += 1;
      continue;
    }
    if (isInlineReservation(claim)) {
      // In-process execution reserved this row and never reached a terminal write: the process died between
      // the gateway call and finalize, or it is still running. Either way nothing is released or requeued;
      // the row is marked doubtful by the same compare-and-swap tuple its own thread uses, so a thread that
      // is still alive can still finalize (finalize clears the mark), and a dead one leaves evidence.
      const marked = await runWithWriteConflictRetry(() =>
        db.$transaction(
          (tx) =>
            tx.caioInferenceJob.updateMany({
              where: { id: claim.id, claimToken: claim.claimToken, attempt: claim.attempt, status: "claimed" },
              data: { rejectionCode: "in_doubt", updatedAt: now },
            }),
          TRANSACTION_OPTIONS,
        ),
      );
      if (marked.count === 1) outcome.inDoubt += 1;
      continue;
    }
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

/**
 * A claimed dispatch must always reach a terminal receipt. Rejecting the judgement without closing the dispatch
 * left it counted as active by the egress gate, which holds the route's concurrency slot forever.
 */
async function closeDispatchAsFailure(
  dispatch: CaioInferenceDispatchPort,
  job: { workspaceId: string; decisionRef: string | null; gatewayRef: string | null; dispatchClaimHash: string | null },
  errorCode: CaioInferenceRejectionCode,
  now: Date,
): Promise<void> {
  if (!job.decisionRef || !job.gatewayRef || !job.dispatchClaimHash) return;
  await dispatch.fail({
    workspaceId: job.workspaceId,
    decisionRef: job.decisionRef,
    gatewayRef: job.gatewayRef,
    claimHash: job.dispatchClaimHash,
    errorCode,
    now,
  });
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

/*
 * In-process governed execution (S1b).
 *
 * The device worker path above claims through the deferred dispatch and submits a body later. The in-process
 * path instead runs the synchronous governed gateway, which claims, invokes and writes the terminal receipt
 * (spend included) inside ONE call and only then returns the body. The queue therefore never calls
 * `dispatch.complete` / `fail` / `expire` for these rows; it only records what the gateway already settled.
 *
 * Every write after the reservation is a compare-and-swap on `(id, workspaceId, claimToken, attempt,
 * status = claimed)`: a thread whose reservation was superseded cannot overwrite a newer attempt, and a row
 * that reconciliation marked doubtful while its thread was still running can still be finalized by that
 * thread (finalize clears the mark), which is what keeps "charged, no judgement" from being manufactured.
 *
 * An inline row is recognisable by `gatewayRef` set with `decisionRef` null: the worker path only ever writes
 * `gatewayRef` together with `decisionRef` and `dispatchClaimHash`, and releases all three together.
 */
export const CAIO_INFERENCE_INLINE_PREPARATION_LEASE_MS = 2 * 60_000;

export type CaioInferenceInlineClaimKey = {
  workspaceId: string;
  jobId: string;
  claimToken: string;
  attempt: number;
};

export type CaioInferenceInlineReservation = CaioInferenceInlineClaimKey & {
  status: "reserved";
  taskClass: CaioInferenceTaskClass;
  inputHash: string;
  input: CaioInferenceInput;
  leaseExpiresAt: Date;
};

type CaioInferenceInlineBinding = {
  decisionRef?: string | null;
  gatewayRef?: string | null;
  claimHash?: string | null;
};

function isInlineReservation(row: { gatewayRef: string | null; decisionRef: string | null }): boolean {
  return row.gatewayRef !== null && row.decisionRef === null;
}

function bindingData(binding: CaioInferenceInlineBinding) {
  return {
    ...(binding.decisionRef ? { decisionRef: binding.decisionRef } : {}),
    ...(binding.gatewayRef ? { gatewayRef: binding.gatewayRef } : {}),
    ...(binding.claimHash ? { dispatchClaimHash: binding.claimHash } : {}),
  };
}

/** Compare-and-swap on the reservation tuple; `true` only when exactly this reservation was still live. */
async function updateInlineReservation(
  key: CaioInferenceInlineClaimKey,
  data: Prisma.CaioInferenceJobUpdateManyMutationInput,
): Promise<boolean> {
  const updated = await runWithWriteConflictRetry(() =>
    db.$transaction(
      (tx) =>
        tx.caioInferenceJob.updateMany({
          where: {
            id: key.jobId,
            workspaceId: key.workspaceId,
            claimToken: key.claimToken,
            attempt: key.attempt,
            status: "claimed",
          },
          data,
        }),
      TRANSACTION_OPTIONS,
    ),
  );
  return updated.count === 1;
}

/**
 * Reserves one queued job for in-process execution under a short preparation lease. The lease only bounds
 * the time until a terminal write; the model call itself is authorised and leased by the governed gateway.
 */
export async function reserveCaioInferenceJobForInline(input: {
  workspaceId: string;
  gatewayRef: string;
  taskClass?: CaioInferenceTaskClass;
  now?: Date;
  preparationLeaseMs?: number;
}): Promise<
  | CaioInferenceInlineReservation
  | { status: "none" }
  | { status: "rejected"; jobId: string; code: Extract<CaioInferenceRejectionCode, "input_hash_mismatch"> }
> {
  const now = input.now ?? new Date();
  const claimToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + (input.preparationLeaseMs ?? CAIO_INFERENCE_INLINE_PREPARATION_LEASE_MS));
  const reserved = await runWithWriteConflictRetry(() =>
    db.$transaction(async (tx) => {
      const candidate = await tx.caioInferenceJob.findFirst({
        where: {
          workspaceId: input.workspaceId,
          status: "queued",
          ...(input.taskClass ? { taskClass: input.taskClass } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, taskClass: true, inputJson: true, inputHash: true, attempt: true },
      });
      if (!candidate) return null;
      const reservation = await tx.caioInferenceJob.updateMany({
        where: { id: candidate.id, workspaceId: input.workspaceId, status: "queued" },
        data: {
          status: "claimed",
          claimToken,
          claimedAt: now,
          leaseExpiresAt,
          attempt: { increment: 1 },
          gatewayRef: input.gatewayRef,
          decisionRef: null,
          dispatchClaimHash: null,
          rejectionCode: null,
          updatedAt: now,
        },
      });
      return reservation.count === 1 ? candidate : null;
    }, TRANSACTION_OPTIONS),
  );
  if (!reserved) return { status: "none" };
  const key = { workspaceId: input.workspaceId, jobId: reserved.id, claimToken, attempt: reserved.attempt + 1 };

  const parsedInput = safeParseJson<CaioInferenceInput | null>(reserved.inputJson, null);
  if (!parsedInput || computeCaioInferenceInputHash(parsedInput) !== reserved.inputHash) {
    await rejectCaioInferenceInlineJob({ ...key, code: "input_hash_mismatch", now });
    return { status: "rejected", jobId: reserved.id, code: "input_hash_mismatch" };
  }
  return {
    status: "reserved",
    ...key,
    taskClass: reserved.taskClass as CaioInferenceTaskClass,
    inputHash: reserved.inputHash,
    input: parsedInput,
    leaseExpiresAt,
  };
}

/**
 * Stores a judgement the governed gateway already settled. The terminal receipt and the spend are the
 * gateway's; this only validates the body against the frozen input, binds the row to the decision and
 * marks it completed. A body that fails validation leaves the row `rejected` with the closed code and the
 * gateway's terminal untouched. `terminalOutputHash`, when the terminal receipt carries one, must equal the
 * body's content hash: a body that is not the one the receipt digested is refused.
 */
export async function finalizeCaioInferenceInlineJudgement(input: CaioInferenceInlineClaimKey & {
  inputHash: string;
  output: unknown;
  decisionRef: string;
  gatewayRef: string;
  claimHash: string;
  terminalOutputHash?: string | null;
  now?: Date;
}): Promise<
  | { status: "completed"; judgementHash: string }
  | { status: "replayed"; judgementHash: string }
  | { status: "rejected"; code: CaioInferenceRejectionCode }
  | { status: "stale" }
> {
  const now = input.now ?? new Date();
  const job = await db.caioInferenceJob.findFirst({ where: { id: input.jobId, workspaceId: input.workspaceId } });
  if (!job || job.claimToken !== input.claimToken || job.attempt !== input.attempt) return { status: "stale" };
  if (job.status === "completed") {
    const frozenInput = safeParseJson<CaioInferenceInput | null>(job.inputJson, null);
    if (!frozenInput || job.inputHash !== input.inputHash) return { status: "rejected", code: "input_hash_mismatch" };
    const validation = validateCaioLayeredJudgement(input.output, new Set(frozenInput.evidenceRefs));
    if (!validation.ok) return { status: "rejected", code: validation.code };
    if (validation.contentHash !== job.layeredJudgementHash) return { status: "rejected", code: "output_hash_mismatch" };
    return { status: "replayed", judgementHash: validation.contentHash };
  }
  if (job.status !== "claimed") return { status: "stale" };

  const binding = { decisionRef: input.decisionRef, gatewayRef: input.gatewayRef, claimHash: input.claimHash };
  const refuse = async (code: CaioInferenceRejectionCode) =>
    (await rejectCaioInferenceInlineJob({ ...input, ...binding, code, now })) === "rejected"
      ? ({ status: "rejected", code } as const)
      : ({ status: "stale" } as const);

  if (job.inputHash !== input.inputHash) return refuse("input_hash_mismatch");
  const frozenInput = safeParseJson<CaioInferenceInput | null>(job.inputJson, null);
  if (!frozenInput) return refuse("malformed_output");
  const validation = validateCaioLayeredJudgement(input.output, new Set(frozenInput.evidenceRefs));
  if (!validation.ok) return refuse(validation.code);
  if (input.terminalOutputHash && input.terminalOutputHash !== validation.contentHash) {
    return refuse("output_hash_mismatch");
  }
  const packet = buildCaioInferenceJudgementPacket({
    workspaceId: input.workspaceId,
    jobId: job.id,
    inferenceInput: frozenInput,
    layered: validation.value,
    now,
  });
  if (!packet.ok) return refuse(packet.code);

  const completed = await updateInlineReservation(input, {
    status: "completed",
    ...bindingData(binding),
    judgementPacketJson: jsonStringify(packet.packet),
    layeredJudgementJson: jsonStringify(validation.value),
    layeredJudgementHash: validation.contentHash,
    completedAt: now,
    rejectionCode: null,
    updatedAt: now,
  });
  return completed ? { status: "completed", judgementHash: validation.contentHash } : { status: "stale" };
}

/**
 * The gateway could not prove whether the request was charged or answered (adapter outcome unknown, terminal
 * persistence failed with the output withheld, or an unclassified failure after the authorization cutoff).
 * The row stays `claimed` with the `in_doubt` code; reconciliation counts it and never requeues it.
 */
export async function markCaioInferenceInlineInDoubt(
  input: CaioInferenceInlineClaimKey & CaioInferenceInlineBinding & { now?: Date },
): Promise<"marked" | "stale"> {
  const now = input.now ?? new Date();
  const marked = await updateInlineReservation(input, {
    ...bindingData(input),
    rejectionCode: "in_doubt",
    updatedAt: now,
  });
  return marked ? "marked" : "stale";
}

/**
 * Terminal refusal for an inline reservation: the gateway blocked or failed the request, the body was lost
 * after a terminal receipt (`output_lost`), or the body failed validation. Nothing is resent.
 */
export async function rejectCaioInferenceInlineJob(
  input: CaioInferenceInlineClaimKey & CaioInferenceInlineBinding & { code: CaioInferenceRejectionCode; now?: Date },
): Promise<"rejected" | "stale"> {
  const now = input.now ?? new Date();
  const rejected = await updateInlineReservation(input, {
    status: "rejected",
    ...bindingData(input),
    rejectionCode: input.code,
    claimToken: null,
    leaseExpiresAt: null,
    updatedAt: now,
  });
  return rejected ? "rejected" : "stale";
}
