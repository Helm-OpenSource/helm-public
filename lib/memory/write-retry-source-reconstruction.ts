import { createHash } from "node:crypto";
import { ActorType, MemoryFactType, ObjectType, SourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { extractMeetingFactDrafts } from "@/lib/memory/fact-extraction.service";
import type { CreateFactInput } from "@/lib/memory/memory-fact.service";
import {
  buildMemoryFactConflictKey,
  buildMemoryFactWriteKey,
  buildMemoryFactWritePlan,
  normalizeMemoryFactWriteText,
  type ExistingMemoryFactForWriteGuard,
  type MemoryFactWritePlan,
} from "@/lib/memory/write-dedupe";
import type { MemoryWriteRetryAttemptLedgerItem } from "@/lib/memory/write-retry-attempt-ledger";
import { jsonStringify } from "@/lib/utils";

export type MemoryWriteRetrySourceReconstructionStatus =
  | "ready_for_executor"
  | "blocked_invalid_receipt_contract"
  | "blocked_unsupported_source"
  | "blocked_missing_source"
  | "blocked_source_changed_since_failure"
  | "blocked_unreliable_source_content"
  | "blocked_missing_actor_context"
  | "blocked_no_matching_candidate"
  | "blocked_ambiguous_candidate"
  | "blocked_duplicate_suppressed"
  | "blocked_conflict_review_required";

type ReconstructionMeetingNote = {
  id?: string | null;
  relationshipSummary: string | null;
  previousConclusion: string | null;
  meetingGoal: string | null;
  recommendedQuestions: string | null;
  riskAlerts: string | null;
  summary: string | null;
  keyDecisions: string | null;
  confirmations: string | null;
  liveTranscript: string | null;
  updatedAt?: Date | null;
};

export type MemoryWriteRetrySourceReconstructionMeeting = {
  id: string;
  title: string;
  startsAt: Date;
  companyId: string | null;
  opportunityId: string | null;
  contacts: Array<{ id: string; name: string }>;
  note: ReconstructionMeetingNote | null;
};

export type MemoryWriteRetrySourceReconstructionProof = {
  proofVersion: "memory_write_retry_source_reconstruction_proof_v1";
  proofStatus: MemoryWriteRetrySourceReconstructionStatus;
  retryContractItemId: string;
  queueItemId: string;
  sourceAuditId: string;
  receiptAuditId: string | null;
  idempotencyLockKey: string | null;
  targetType: string;
  targetId: string;
  sourceType: string | null;
  sourceId: string | null;
  sourceUpdatedAt: string | null;
  failureAuditCreatedAt: string | null;
  proofGeneratedAt: string;
  contentBasis: Array<
    | "summary"
    | "keyDecisions"
    | "confirmations"
    | "liveTranscript"
    | "relationshipSummary"
    | "previousConclusion"
    | "meetingGoal"
    | "riskAlerts"
  >;
  candidateCount: number;
  reconstructedFact: CreateFactInput | null;
  writeKeyHash: string | null;
  conflictKeyHash: string | null;
  titleHash: string | null;
  contentHash: string | null;
  normalizedValueHash: string | null;
  writePlanSummary: MemoryFactWritePlan["summary"] | null;
  duplicateSuppressions: MemoryFactWritePlan["duplicateSuppressions"];
  conflictCandidates: MemoryFactWritePlan["conflictCandidates"];
  missingInputs: string[];
  requiredManualChecks: string[];
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  boundaryNote: string;
};

function enumValue<T extends Record<string, string>>(enumObject: T, value: string | null): T[keyof T] | null {
  if (!value) return null;
  return Object.values(enumObject).includes(value) ? (value as T[keyof T]) : null;
}

function hashValue(value: unknown) {
  const rawValue = typeof value === "string" ? value : jsonStringify(value ?? "");
  return createHash("sha256").update(rawValue).digest("hex");
}

export function hashMemoryWriteRetryProofValue(value: unknown) {
  return hashValue(value);
}

function noteContentBasis(note: ReconstructionMeetingNote | null): MemoryWriteRetrySourceReconstructionProof["contentBasis"] {
  if (!note) return [];

  return ([
    ["summary", note.summary],
    ["keyDecisions", note.keyDecisions],
    ["confirmations", note.confirmations],
    ["liveTranscript", note.liveTranscript],
    ["relationshipSummary", note.relationshipSummary],
    ["previousConclusion", note.previousConclusion],
    ["meetingGoal", note.meetingGoal],
    ["riskAlerts", note.riskAlerts],
  ] as const)
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([key]) => key);
}

function hasReliableNoteContent(note: ReconstructionMeetingNote | null) {
  if (!note) return false;
  return Boolean(
    note.summary?.trim() ||
      note.keyDecisions?.trim() ||
      note.confirmations?.trim() ||
      note.liveTranscript?.trim(),
  );
}

function genericFallbackContent(meeting: MemoryWriteRetrySourceReconstructionMeeting) {
  return `${meeting.title} 已形成新的会议结论。`;
}

function baseProof(args: {
  status: MemoryWriteRetrySourceReconstructionStatus;
  item: MemoryWriteRetryAttemptLedgerItem;
  meeting: MemoryWriteRetrySourceReconstructionMeeting | null;
  failureAuditCreatedAt?: Date | null;
  generatedAt: Date;
  missingInputs?: string[];
  requiredManualChecks?: string[];
}): MemoryWriteRetrySourceReconstructionProof {
  const contentBasis = noteContentBasis(args.meeting?.note ?? null);

  return {
    proofVersion: "memory_write_retry_source_reconstruction_proof_v1",
    proofStatus: args.status,
    retryContractItemId: args.item.retryContractItemId,
    queueItemId: args.item.queueItemId,
    sourceAuditId: args.item.auditId,
    receiptAuditId: args.item.receiptAuditId,
    idempotencyLockKey: args.item.idempotencyLockKey,
    targetType: args.item.targetType,
    targetId: args.item.targetId,
    sourceType: args.item.sourceType,
    sourceId: args.item.sourceId,
    sourceUpdatedAt: args.meeting?.note?.updatedAt?.toISOString() ?? null,
    failureAuditCreatedAt: args.failureAuditCreatedAt?.toISOString() ?? null,
    proofGeneratedAt: args.generatedAt.toISOString(),
    contentBasis,
    candidateCount: 0,
    reconstructedFact: null,
    writeKeyHash: null,
    conflictKeyHash: null,
    titleHash: null,
    contentHash: null,
    normalizedValueHash: null,
    writePlanSummary: null,
    duplicateSuppressions: [],
    conflictCandidates: [],
    missingInputs: args.missingInputs ?? args.item.sourceRebuildGate.missingInputs,
    requiredManualChecks: args.requiredManualChecks ?? args.item.sourceRebuildGate.requiredManualChecks,
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote:
      "Source reconstruction proof is review-first evidence for a single MemoryFact retry; it does not execute writes, rewrite canonical facts, create commitments, or send external messages.",
  };
}

function matchingDrafts(args: {
  item: MemoryWriteRetryAttemptLedgerItem;
  drafts: CreateFactInput[];
}) {
  const targetTitle = normalizeMemoryFactWriteText(args.item.title);
  const scoped = args.drafts.filter((draft) =>
    draft.objectType === args.item.objectType &&
    draft.objectId === args.item.objectId &&
    draft.factType === args.item.factType &&
    draft.sourceType === args.item.sourceType &&
    draft.sourceId === args.item.sourceId,
  );

  if (!targetTitle) return { scoped, exactTitle: [] };

  return {
    scoped,
    exactTitle: scoped.filter((draft) => normalizeMemoryFactWriteText(draft.title) === targetTitle),
  };
}

function proofWithCandidate(args: {
  item: MemoryWriteRetryAttemptLedgerItem;
  meeting: MemoryWriteRetrySourceReconstructionMeeting;
  failureAuditCreatedAt?: Date | null;
  generatedAt: Date;
  candidate: CreateFactInput;
  candidateCount: number;
  writePlan: MemoryFactWritePlan;
  status: MemoryWriteRetrySourceReconstructionStatus;
}) {
  const conflictKey = buildMemoryFactConflictKey(args.candidate);
  const proof = baseProof({
    status: args.status,
    item: args.item,
    meeting: args.meeting,
    failureAuditCreatedAt: args.failureAuditCreatedAt,
    generatedAt: args.generatedAt,
    missingInputs: [],
  });

  return {
    ...proof,
    candidateCount: args.candidateCount,
    reconstructedFact: args.status === "ready_for_executor" ? args.candidate : null,
    writeKeyHash: hashValue(buildMemoryFactWriteKey(args.candidate)),
    conflictKeyHash: conflictKey ? hashValue(conflictKey) : null,
    titleHash: hashValue(args.candidate.title),
    contentHash: hashValue(args.candidate.content),
    normalizedValueHash: args.candidate.normalizedValue ? hashValue(args.candidate.normalizedValue) : null,
    writePlanSummary: args.writePlan.summary,
    duplicateSuppressions: args.writePlan.duplicateSuppressions,
    conflictCandidates: args.writePlan.conflictCandidates,
  };
}

export function buildMemoryWriteRetrySourceReconstructionProof(args: {
  item: MemoryWriteRetryAttemptLedgerItem;
  workspaceId: string;
  actorName?: string | null;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string | null;
  meeting: MemoryWriteRetrySourceReconstructionMeeting | null;
  existingFacts: ExistingMemoryFactForWriteGuard[];
  failureAuditCreatedAt?: Date | null;
  generatedAt?: Date;
}): MemoryWriteRetrySourceReconstructionProof {
  const generatedAt = args.generatedAt ?? new Date();

  if (
    args.item.receiptStatus !== "confirmed_ready_for_executor" ||
    !args.item.receiptAuditId ||
    !args.item.idempotencyLockKey
  ) {
    return baseProof({
      status: "blocked_invalid_receipt_contract",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
    });
  }

  if (args.item.sourceType !== SourceType.MEETING_NOTE) {
    return baseProof({
      status: "blocked_unsupported_source",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      missingInputs: ["supported_source"],
    });
  }

  if (!args.actorName?.trim()) {
    return baseProof({
      status: "blocked_missing_actor_context",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      missingInputs: ["actor_context"],
    });
  }

  if (!args.meeting?.note || args.item.sourceId !== args.meeting.id) {
    return baseProof({
      status: "blocked_missing_source",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      missingInputs: ["source"],
    });
  }

  if (
    args.failureAuditCreatedAt &&
    args.meeting.note.updatedAt &&
    args.meeting.note.updatedAt.getTime() > args.failureAuditCreatedAt.getTime()
  ) {
    return baseProof({
      status: "blocked_source_changed_since_failure",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      requiredManualChecks: [...args.item.sourceRebuildGate.requiredManualChecks, "review_source_version_after_failure"],
    });
  }

  if (!hasReliableNoteContent(args.meeting.note)) {
    return baseProof({
      status: "blocked_unreliable_source_content",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      missingInputs: ["reliable_source_content"],
    });
  }

  const objectType = enumValue(ObjectType, args.item.objectType);
  const factType = enumValue(MemoryFactType, args.item.factType);
  const sourceType = enumValue(SourceType, args.item.sourceType);
  if (!objectType || !factType || !sourceType || !args.item.objectId || !args.item.sourceId || !args.item.title) {
    return baseProof({
      status: "blocked_invalid_receipt_contract",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
    });
  }

  const drafts = extractMeetingFactDrafts({
    workspaceId: args.workspaceId,
    actorName: args.actorName,
    actorUserId: args.actorUserId,
    actorType: args.actorType ?? ActorType.SYSTEM,
    sourcePage: args.sourcePage ?? undefined,
    meeting: args.meeting,
  });
  const { scoped, exactTitle } = matchingDrafts({ item: args.item, drafts });

  if (!exactTitle.length) {
    return {
      ...baseProof({
        status: scoped.length > 1 ? "blocked_ambiguous_candidate" : "blocked_no_matching_candidate",
        item: args.item,
        meeting: args.meeting,
        failureAuditCreatedAt: args.failureAuditCreatedAt,
        generatedAt,
        missingInputs: ["matching_reconstructed_candidate"],
      }),
      candidateCount: scoped.length,
    };
  }

  if (exactTitle.length > 1) {
    return {
      ...baseProof({
        status: "blocked_ambiguous_candidate",
        item: args.item,
        meeting: args.meeting,
        failureAuditCreatedAt: args.failureAuditCreatedAt,
        generatedAt,
      }),
      candidateCount: exactTitle.length,
    };
  }

  const candidate = exactTitle[0];
  if (candidate.content === genericFallbackContent(args.meeting)) {
    return baseProof({
      status: "blocked_unreliable_source_content",
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      missingInputs: ["reliable_source_content"],
    });
  }

  const writePlan = buildMemoryFactWritePlan({
    drafts: [candidate],
    existingFacts: args.existingFacts,
  });

  if (writePlan.duplicateSuppressions.length > 0) {
    return proofWithCandidate({
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      candidate,
      candidateCount: exactTitle.length,
      writePlan,
      status: "blocked_duplicate_suppressed",
    });
  }

  if (writePlan.conflictCandidates.length > 0 || writePlan.createDrafts.length !== 1) {
    return proofWithCandidate({
      item: args.item,
      meeting: args.meeting,
      failureAuditCreatedAt: args.failureAuditCreatedAt,
      generatedAt,
      candidate,
      candidateCount: exactTitle.length,
      writePlan,
      status: "blocked_conflict_review_required",
    });
  }

  return proofWithCandidate({
    item: args.item,
    meeting: args.meeting,
    failureAuditCreatedAt: args.failureAuditCreatedAt,
    generatedAt,
    candidate,
    candidateCount: exactTitle.length,
    writePlan,
    status: "ready_for_executor",
  });
}

export async function buildMemoryWriteRetrySourceReconstructionProofFromDb(input: {
  workspaceId: string;
  actorName?: string | null;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string | null;
  item: MemoryWriteRetryAttemptLedgerItem;
  generatedAt?: Date;
}) {
  const [meeting, failureAudit, existingFacts] = await Promise.all([
    input.item.sourceType === SourceType.MEETING_NOTE && input.item.sourceId
      ? db.meeting.findFirst({
          where: {
            workspaceId: input.workspaceId,
            id: input.item.sourceId,
          },
          include: {
            contacts: {
              select: {
                id: true,
                name: true,
              },
            },
            note: true,
          },
        })
      : Promise.resolve(null),
    db.auditLog.findFirst({
      where: {
        workspaceId: input.workspaceId,
        id: input.item.auditId,
      },
      select: {
        createdAt: true,
      },
    }),
    input.item.sourceType && input.item.sourceId
      ? db.memoryFact.findMany({
          where: {
            workspaceId: input.workspaceId,
            sourceType: enumValue(SourceType, input.item.sourceType) ?? undefined,
            sourceId: input.item.sourceId,
            ...(input.item.objectType && input.item.objectId
              ? {
                  objectType: enumValue(ObjectType, input.item.objectType) ?? undefined,
                  objectId: input.item.objectId,
                }
              : {}),
          },
        })
      : Promise.resolve([]),
  ]);

  return buildMemoryWriteRetrySourceReconstructionProof({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    item: input.item,
    meeting: meeting
      ? {
          id: meeting.id,
          title: meeting.title,
          startsAt: meeting.startsAt,
          companyId: meeting.companyId,
          opportunityId: meeting.opportunityId,
          contacts: meeting.contacts.map((contact) => ({ id: contact.id, name: contact.name })),
          note: meeting.note,
        }
      : null,
    existingFacts,
    failureAuditCreatedAt: failureAudit?.createdAt ?? null,
    generatedAt: input.generatedAt,
  });
}
