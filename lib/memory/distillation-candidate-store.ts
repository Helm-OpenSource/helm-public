import {
  MemoryDistillationCandidateStatus,
  MemoryStatus,
  type MemoryDistillationCandidate,
  type ObjectType,
} from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  detectDistillationCandidates,
  type DistillationFactInput,
} from "@/lib/memory/distillation-candidate";
import { type MemoryActorContext, writeMemoryAuditAndEvent } from "@/lib/memory/shared";
import { jsonStringify } from "@/lib/utils";

const FACT_SYNC_LIMIT = 80;

const SYNC_BOUNDARY_NOTE =
  "Memory distillation sync only persists review-required candidate records. " +
  "It does not write MemoryFact, does not auto-promote memory, and does not change recommendation ranking.";

const REVIEW_BOUNDARY_NOTE =
  "Memory distillation review decision does not promote memory or execute actions.";

type PriorReviewDecision = NonNullable<DistillationFactInput["priorReviewDecisions"]>[number];

type ExistingCandidateForSync = Pick<
  MemoryDistillationCandidate,
  | "id"
  | "groupKey"
  | "status"
  | "decidedAt"
  | "updatedAt"
>;

export type SyncMemoryDistillationCandidatesSummary = {
  candidateCount: number;
  createdCount: number;
  updatedCount: number;
  omittedCount: number;
  skippedReviewedCount: number;
  boundaryNote: string;
};

export type ReviewMemoryDistillationCandidateDecision = "approve" | "reject" | "defer";

function isReviewedStatus(status: MemoryDistillationCandidateStatus) {
  return status !== MemoryDistillationCandidateStatus.PENDING_REVIEW;
}

function priorDecisionForCandidate(candidate: ExistingCandidateForSync): PriorReviewDecision | null {
  if (candidate.status === MemoryDistillationCandidateStatus.APPROVED) {
    return {
      decision: "approve",
      groupKey: candidate.groupKey,
      decidedAt: candidate.decidedAt ?? candidate.updatedAt,
    };
  }
  if (candidate.status === MemoryDistillationCandidateStatus.REJECTED) {
    return {
      decision: "reject",
      groupKey: candidate.groupKey,
      decidedAt: candidate.decidedAt ?? candidate.updatedAt,
    };
  }
  if (candidate.status === MemoryDistillationCandidateStatus.DEFERRED) {
    return {
      decision: "defer",
      groupKey: candidate.groupKey,
      decidedAt: candidate.decidedAt ?? candidate.updatedAt,
    };
  }
  return null;
}

function statusForReviewDecision(decision: ReviewMemoryDistillationCandidateDecision) {
  if (decision === "approve") return MemoryDistillationCandidateStatus.APPROVED;
  if (decision === "reject") return MemoryDistillationCandidateStatus.REJECTED;
  return MemoryDistillationCandidateStatus.DEFERRED;
}

export async function syncMemoryDistillationCandidatesForObject(
  input: MemoryActorContext & { objectType: ObjectType; objectId: string },
): Promise<SyncMemoryDistillationCandidatesSummary> {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const [facts, existingCandidatesResult] = await Promise.all([
    db.memoryFact.findMany({
      where: {
        workspaceId: input.workspaceId,
        objectType: input.objectType,
        objectId: input.objectId,
        status: { in: [MemoryStatus.ACTIVE, MemoryStatus.OBSERVED] },
      },
      orderBy: [
        { updatedAt: "desc" },
        { id: "asc" },
      ],
      take: FACT_SYNC_LIMIT,
    }),
    db.memoryDistillationCandidate
      .findMany({
        where: {
          workspaceId: input.workspaceId,
          objectType: input.objectType,
          objectId: input.objectId,
        },
        orderBy: [
          { updatedAt: "desc" },
          { id: "asc" },
        ],
      })
      .then((rows) => ({ rows, tableMissing: false as const }))
      .catch((error) => {
        if (isMissingMemoryDistillationCandidateTableError(error)) {
          return { rows: [] as ExistingCandidateForSync[], tableMissing: true as const };
        }
        throw error;
      }),
  ]);
  const existingCandidates = existingCandidatesResult.rows;

  if (existingCandidatesResult.tableMissing) {
    const summary = {
      candidateCount: 0,
      createdCount: 0,
      updatedCount: 0,
      omittedCount: 0,
      skippedReviewedCount: 0,
      boundaryNote: `${SYNC_BOUNDARY_NOTE} MemoryDistillationCandidate table is unavailable, so candidate persistence was skipped.`,
    };

    await writeMemoryAuditAndEvent({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      sourcePage: input.sourcePage,
      actionType: "MEMORY_DISTILLATION_CANDIDATES_SYNCED",
      targetType: "MemoryDistillationCandidate",
      targetId: `${input.objectType}:${input.objectId}`,
      summary:
        "Skipped memory distillation candidate persistence because MemoryDistillationCandidate table is unavailable.",
      eventName: "memory_distillation_candidates_synced",
      eventCategory: "memory",
      metadata: {
        ...summary,
        objectType: input.objectType,
        objectId: input.objectId,
        tableMissing: true,
      },
    });

    return summary;
  }

  const existingByGroupKey = new Map(existingCandidates.map((candidate) => [candidate.groupKey, candidate]));
  const priorReviewDecisions = existingCandidates
    .map(priorDecisionForCandidate)
    .filter((decision): decision is PriorReviewDecision => decision !== null);

  const factsForDetection: DistillationFactInput[] = facts.map((fact) => ({
    id: fact.id,
    objectType: fact.objectType,
    objectId: fact.objectId,
    factType: fact.factType,
    title: fact.title,
    content: fact.content,
    normalizedValue: fact.normalizedValue,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
    status: fact.status,
    confidence: fact.confidence,
    importance: fact.importance,
    confirmedByUser: fact.confirmedByUser,
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt,
    evidenceRefs: [],
    priorReviewDecisions,
  }));

  const detected = detectDistillationCandidates(factsForDetection);
  let createdCount = 0;
  let updatedCount = 0;
  const skippedReviewedGroupKeys = new Set<string>();

  for (const candidate of detected.candidates) {
    const existing = existingByGroupKey.get(candidate.groupKey);
    if (!existing) {
      await db.memoryDistillationCandidate.create({
        data: {
          workspaceId: input.workspaceId,
          groupKey: candidate.groupKey,
          objectType: candidate.objectType,
          objectId: candidate.objectId,
          factType: candidate.factType,
          title: candidate.title,
          summary: candidate.summary,
          sourceFactIds: jsonStringify(candidate.sourceFactIds),
          evidenceRefs: jsonStringify(candidate.evidenceRefs),
          sourceRefs: jsonStringify(candidate.sourceRefs),
          repeatCount: candidate.repeatCount,
          confidence: candidate.confidence,
          reviewPosture: candidate.reviewPosture,
          status: MemoryDistillationCandidateStatus.PENDING_REVIEW,
          boundaryNote: candidate.boundaryNote,
          createdFrom: candidate.createdFrom,
          latestSourceAt: candidate.latestSourceAt,
          auditPayload: jsonStringify({
            boundaryNote: SYNC_BOUNDARY_NOTE,
            detectorCandidateId: candidate.candidateId,
          }),
        },
      });
      createdCount += 1;
      continue;
    }

    if (existing.status !== MemoryDistillationCandidateStatus.PENDING_REVIEW) {
      skippedReviewedGroupKeys.add(candidate.groupKey);
      continue;
    }

    await db.memoryDistillationCandidate.update({
      where: { id: existing.id },
      data: {
        title: candidate.title,
        summary: candidate.summary,
        sourceFactIds: jsonStringify(candidate.sourceFactIds),
        evidenceRefs: jsonStringify(candidate.evidenceRefs),
        sourceRefs: jsonStringify(candidate.sourceRefs),
        repeatCount: candidate.repeatCount,
        confidence: candidate.confidence,
        boundaryNote: candidate.boundaryNote,
        latestSourceAt: candidate.latestSourceAt,
        auditPayload: jsonStringify({
          boundaryNote: SYNC_BOUNDARY_NOTE,
          detectorCandidateId: candidate.candidateId,
        }),
      },
    });
    updatedCount += 1;
  }

  for (const omitted of detected.omitted) {
    const existing = existingByGroupKey.get(omitted.groupKey);
    if (existing && isReviewedStatus(existing.status)) {
      skippedReviewedGroupKeys.add(omitted.groupKey);
    }
  }

  const summary = {
    candidateCount: detected.candidates.length,
    createdCount,
    updatedCount,
    omittedCount: detected.omitted.length,
    skippedReviewedCount: skippedReviewedGroupKeys.size,
    boundaryNote: SYNC_BOUNDARY_NOTE,
  };

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_DISTILLATION_CANDIDATES_SYNCED",
    targetType: "MemoryDistillationCandidate",
    targetId: `${input.objectType}:${input.objectId}`,
    summary: `Synced ${summary.candidateCount} memory distillation candidates for review.`,
    eventName: "memory_distillation_candidates_synced",
    eventCategory: "memory",
    metadata: {
      ...summary,
      objectType: input.objectType,
      objectId: input.objectId,
      boundaryNote: SYNC_BOUNDARY_NOTE,
    },
  });

  return summary;
}

export async function reviewMemoryDistillationCandidate(
  input: MemoryActorContext & {
    candidateId: string;
    decision: ReviewMemoryDistillationCandidateDecision;
    reason?: string | null;
  },
) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  let existing: MemoryDistillationCandidate | null;
  try {
    existing = await db.memoryDistillationCandidate.findFirst({
      where: {
        id: input.candidateId,
        workspaceId: input.workspaceId,
      },
    });
  } catch (error) {
    if (isMissingMemoryDistillationCandidateTableError(error)) {
      throw new Error("MemoryDistillationCandidate table is unavailable in the current database.");
    }
    throw error;
  }

  if (!existing) {
    throw new Error("Memory distillation candidate not found in workspace.");
  }

  const decidedAt = new Date();
  const nextStatus = statusForReviewDecision(input.decision);
  const auditPayload = {
    boundaryNote: REVIEW_BOUNDARY_NOTE,
    decision: input.decision,
    previousStatus: existing.status,
    nextStatus,
    reason: input.reason ?? null,
  };

  let updated: MemoryDistillationCandidate;
  try {
    updated = await db.memoryDistillationCandidate.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        decisionReason: input.reason ?? null,
        decidedAt,
        decidedByUserId: input.actorUserId ?? null,
        auditPayload: jsonStringify(auditPayload),
      },
    });
  } catch (error) {
    if (isMissingMemoryDistillationCandidateTableError(error)) {
      throw new Error("MemoryDistillationCandidate table is unavailable in the current database.");
    }
    throw error;
  }

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    actionType: "MEMORY_DISTILLATION_CANDIDATE_REVIEWED",
    targetType: "MemoryDistillationCandidate",
    targetId: existing.id,
    summary: `Reviewed memory distillation candidate with decision: ${input.decision}.`,
    eventName: "memory_distillation_candidate_reviewed",
    eventCategory: "memory",
    metadata: auditPayload,
  });

  return updated;
}

function isMissingMemoryDistillationCandidateTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('The table `memorydistillationcandidate` does not exist') ||
    message.includes(`relation \"MemoryDistillationCandidate\" does not exist`) ||
    message.includes("no such table: MemoryDistillationCandidate") ||
    (message.includes("Table '") && message.includes("memorydistillationcandidate' doesn't exist"))
  );
}
