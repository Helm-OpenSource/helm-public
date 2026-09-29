import { ActorType } from "@prisma/client";

import type { JudgementPacket } from "@/lib/operating-harness/contracts";
import { validateOperatingHarnessJudgementPacket } from "@/lib/operating-harness/validators";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import {
  CaioFdeScopeResolutionError,
  resolveCaioFdePortfolioScope,
} from "@/lib/stage1-owner-loop/caio-fde-scope-resolver.service";
import { createStage1DecisionRecordInTransaction } from "@/lib/stage1-owner-loop/decision-follow-through.service";

import type { CaioInferenceInput } from "./contracts";
import {
  CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS,
  isCaioJudgementStale,
  projectCaioJudgementToDecisionCandidate,
} from "./judgement-decision-candidate";
import { validateCaioLayeredJudgement } from "./layered-judgement";

/**
 * Persists the judgement -> decision-candidate bridge. Writes exactly one DecisionRecord per completed job
 * (keyed `caio-inference-decision:<jobId>`) through the canonical Stage 1 seam, as the AI actor, with no
 * confirmation, dispatch or assignment. Everything the owner does next uses the existing Stage 1 services.
 */

export const CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED_ENV =
  "HELM_CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED";

/** Scheduled projection is off unless the flag is exactly "true", like every other CAIO review switch. */
export function isCaioJudgementDecisionCandidatesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env[CAIO_JUDGEMENT_DECISION_CANDIDATES_ENABLED_ENV] === "true";
}

const ACTOR_NAME = "CAIO inference review";

export type CaioJudgementDecisionCandidateOutcome =
  | { kind: "created" | "replayed"; jobId: string; decisionRecordId: string; status: string }
  | { kind: "no_candidate"; jobId: string; reason: string }
  | { kind: "failed"; jobId: string; code: string };

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export class CaioJudgementDecisionCandidateError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "CaioJudgementDecisionCandidateError";
    this.code = code;
  }
}

export async function projectCaioInferenceJobDecisionCandidate(input: {
  workspaceId: string;
  jobId: string;
  portfolioRef: string;
  now?: Date;
}): Promise<CaioJudgementDecisionCandidateOutcome> {
  const now = input.now ?? new Date();
  const job = await db.caioInferenceJob.findFirst({
    where: { id: input.jobId, workspaceId: input.workspaceId },
  });
  if (!job) throw new CaioJudgementDecisionCandidateError("job_not_found");
  if (
    job.status !== "completed" ||
    !job.completedAt ||
    !job.layeredJudgementJson ||
    !job.layeredJudgementHash ||
    !job.judgementPacketJson
  ) {
    throw new CaioJudgementDecisionCandidateError("job_not_completed");
  }
  // A candidate past its review window would be born expired: it would sit in the owner's queue as pending,
  // fail decision_expired on confirm, and burn the job's decision key. Old judgements yield no candidate.
  if (isCaioJudgementStale(job.completedAt, now)) {
    return { kind: "no_candidate", jobId: job.id, reason: "judgement_stale" };
  }

  // Re-validate what is stored instead of trusting the row: the layered body must still be a valid judgement
  // over the frozen input and still hash to the stored layeredJudgementHash. Both were written by the same
  // completion step, so this guards storage corruption and partial writes; it does not prove the row was not
  // rewritten wholesale by someone with database write access.
  const frozenInput = safeParseJson<CaioInferenceInput | null>(job.inputJson, null);
  if (!frozenInput) throw new CaioJudgementDecisionCandidateError("job_input_invalid");
  const layered = validateCaioLayeredJudgement(
    safeParseJson<unknown>(job.layeredJudgementJson, null),
    new Set(frozenInput.evidenceRefs),
  );
  if (!layered.ok || layered.contentHash !== job.layeredJudgementHash) {
    throw new CaioJudgementDecisionCandidateError("judgement_integrity_failed");
  }
  const packet = safeParseJson<JudgementPacket | null>(job.judgementPacketJson, null);
  if (!packet || !validateOperatingHarnessJudgementPacket(packet).ok) {
    throw new CaioJudgementDecisionCandidateError("judgement_packet_invalid");
  }

  let projected;
  try {
    projected = projectCaioJudgementToDecisionCandidate({
      workspaceId: input.workspaceId,
      jobId: job.id,
      taskClass: frozenInput.taskClass,
      windowStart: frozenInput.windowStart,
      windowEnd: frozenInput.windowEnd,
      layered: layered.value,
      layeredJudgementHash: job.layeredJudgementHash,
      judgementPacket: packet,
      portfolioRef: input.portfolioRef,
      completedAt: job.completedAt,
    });
  } catch (error) {
    throw new CaioJudgementDecisionCandidateError(
      error instanceof Error ? error.message : "projection_failed",
    );
  }
  if (projected.kind === "no_candidate") {
    return { kind: "no_candidate", jobId: job.id, reason: projected.reason };
  }

  const projection = projected.projection;
  const jobId = job.id;
  // Same trim as prepareStage1DecisionRecord, so the lookup matches the unique key that was hit.
  const decisionKey = projection.decision.decisionId.trim();
  const writeCandidate = () =>
    db.$transaction(async (tx): Promise<CaioJudgementDecisionCandidateOutcome> => {
      try {
        await resolveCaioFdePortfolioScope({
          client: tx,
          workspaceId: input.workspaceId,
          workspaceRef: `workspace:${input.workspaceId}`,
          portfolioRef: input.portfolioRef,
        });
      } catch (error) {
        if (error instanceof CaioFdeScopeResolutionError) {
          throw new CaioJudgementDecisionCandidateError("portfolio_scope_invalid");
        }
        throw error;
      }
      const { record, replayed } = await createStage1DecisionRecordInTransaction(tx, {
        workspaceId: input.workspaceId,
        decision: projection.decision,
        facts: projection.facts,
        inferences: projection.inferences,
        unknowns: projection.unknowns,
        risks: projection.risks,
        actorName: ACTOR_NAME,
        actorUserId: null,
        actorType: ActorType.AI,
      });
      return {
        kind: replayed ? "replayed" : "created",
        jobId,
        decisionRecordId: record.id,
        status: record.status,
      };
    });
  try {
    return await writeCandidate();
  } catch (error) {
    // Two concurrent runs on the same job: the loser hits the unique decision key. Converge on the winner's row.
    if (!isUniqueConstraintViolation(error)) throw error;
    const existing = await db.decisionRecord.findUnique({
      where: { workspaceId_decisionKey: { workspaceId: input.workspaceId, decisionKey } },
      select: { id: true, status: true },
    });
    if (!existing) throw error;
    return { kind: "replayed", jobId, decisionRecordId: existing.id, status: existing.status };
  }
}

/**
 * Projects the most recent completed jobs of one workspace that have no decision candidate yet. Bounded and
 * idempotent: a job that already has its record is skipped by key, and a replay converges on the same row.
 */
export async function projectPendingCaioInferenceDecisionCandidates(input: {
  workspaceId: string;
  portfolioRef: string;
  limit?: number;
  now?: Date;
}): Promise<CaioJudgementDecisionCandidateOutcome[]> {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const jobs = await db.caioInferenceJob.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "completed",
      completedAt: { gt: new Date(now.getTime() - CAIO_JUDGEMENT_DECISION_CANDIDATE_TTL_MS) },
    },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: { id: true },
  });
  const existing = new Set(
    (
      await db.decisionRecord.findMany({
        where: {
          workspaceId: input.workspaceId,
          decisionKey: { in: jobs.map((job) => `caio-inference-decision:${job.id}`) },
        },
        select: { decisionKey: true },
      })
    ).map((record) => record.decisionKey),
  );
  const outcomes: CaioJudgementDecisionCandidateOutcome[] = [];
  for (const job of jobs) {
    if (existing.has(`caio-inference-decision:${job.id}`)) continue;
    // One bad job must not stop the batch or hide what was already written: record it and move on.
    try {
      outcomes.push(
        await projectCaioInferenceJobDecisionCandidate({
          workspaceId: input.workspaceId,
          jobId: job.id,
          portfolioRef: input.portfolioRef,
          now,
        }),
      );
    } catch (error) {
      outcomes.push({
        kind: "failed",
        jobId: job.id,
        code: error instanceof CaioJudgementDecisionCandidateError ? error.code : "unexpected_error",
      });
    }
  }
  return outcomes;
}
