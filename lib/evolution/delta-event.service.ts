import { ActorType, RecommendationFeedbackType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { jsonStringify } from "@/lib/utils";

type DeltaActorContext = {
  workspaceId: string;
  actorId?: string | null;
  actorType?: ActorType | string | null;
  sourcePage?: string | null;
};

type CreateDeltaEventInput = DeltaActorContext & {
  eventType: string;
  objectType: string;
  objectId: string;
  sourceType?: string | null;
  sourceId?: string | null;
  payload?: unknown;
  importance?: number;
};

const feedbackEventMap: Record<RecommendationFeedbackType, string> = {
  APPROVED: "recommendation_approved",
  REJECTED: "recommendation_rejected",
  EDITED_AND_APPROVED: "recommendation_edited_and_approved",
  IGNORED: "recommendation_ignored",
  AUTO_EXECUTED: "action_auto_executed",
  FAILED: "recommendation_failed",
};

function asActorType(value?: ActorType | string | null) {
  if (!value) return "SYSTEM";
  return String(value);
}

export async function createDeltaEvent(input: CreateDeltaEventInput) {
  const created = await db.deltaEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorType: asActorType(input.actorType),
      actorId: input.actorId ?? undefined,
      eventType: input.eventType,
      objectType: input.objectType,
      objectId: input.objectId,
      sourceType: input.sourceType ?? undefined,
      sourceId: input.sourceId ?? undefined,
      payload: input.payload ? jsonStringify(input.payload) : undefined,
      importance: input.importance ?? 50,
    },
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorId ?? undefined,
    eventName: "delta_event_created",
    eventCategory: "evolution",
    targetType: "DeltaEvent",
    targetId: created.id,
    metadata: {
      eventType: created.eventType,
      objectType: created.objectType,
      objectId: created.objectId,
      sourceType: created.sourceType,
      sourceId: created.sourceId,
      importance: created.importance,
    },
    sourcePage: input.sourcePage ?? undefined,
  });

  return created;
}

export async function recordRecommendationFeedbackDelta(input: DeltaActorContext & {
  recommendationId: string;
  recommendationObjectType: string;
  recommendationObjectId: string;
  actionType: string;
  feedbackType: RecommendationFeedbackType;
  edited?: boolean;
  resultNote?: string | null;
  sourceId?: string | null;
  policyResult?: string | null;
}) {
  return createDeltaEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    eventType: feedbackEventMap[input.feedbackType],
    objectType: input.recommendationObjectType,
    objectId: input.recommendationObjectId,
    sourceType: "RecommendationFeedback",
    sourceId: input.sourceId ?? input.recommendationId,
    importance: input.feedbackType === RecommendationFeedbackType.REJECTED ? 78 : input.feedbackType === RecommendationFeedbackType.EDITED_AND_APPROVED ? 72 : 64,
    payload: {
      recommendationId: input.recommendationId,
      actionType: input.actionType,
      feedbackType: input.feedbackType,
      edited: Boolean(input.edited),
      resultNote: input.resultNote ?? null,
      policyResult: input.policyResult ?? null,
    },
  });
}

export async function recordOpportunityStageChangedDelta(input: DeltaActorContext & {
  opportunityId: string;
  fromStage?: string | null;
  toStage: string;
  lossReason?: string | null;
}) {
  return createDeltaEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    eventType: "opportunity_stage_changed",
    objectType: "Opportunity",
    objectId: input.opportunityId,
    sourceType: "Opportunity",
    sourceId: input.opportunityId,
    importance: 66,
    payload: {
      fromStage: input.fromStage ?? null,
      toStage: input.toStage,
      lossReason: input.lossReason ?? null,
    },
  });
}

export async function recordCommitmentDelta(input: DeltaActorContext & {
  commitmentId: string;
  relatedOpportunityId?: string | null;
  eventType: "commitment_overdue" | "commitment_fulfilled" | "commitment_status_updated";
  previousStatus?: string | null;
  nextStatus: string;
  title: string;
}) {
  return createDeltaEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    eventType: input.eventType,
    objectType: "Commitment",
    objectId: input.commitmentId,
    sourceType: "Commitment",
    sourceId: input.commitmentId,
    importance: input.eventType === "commitment_overdue" ? 74 : 58,
    payload: {
      title: input.title,
      previousStatus: input.previousStatus ?? null,
      nextStatus: input.nextStatus,
      relatedOpportunityId: input.relatedOpportunityId ?? null,
    },
  });
}

export async function recordBlockerDelta(input: DeltaActorContext & {
  blockerId: string;
  relatedOpportunityId?: string | null;
  eventType: "blocker_created" | "blocker_resolved" | "blocker_status_updated";
  blockerType: string;
  title: string;
  severity?: number;
  resolutionNote?: string | null;
}) {
  return createDeltaEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    eventType: input.eventType,
    objectType: "Blocker",
    objectId: input.blockerId,
    sourceType: "Blocker",
    sourceId: input.blockerId,
    importance:
      input.eventType === "blocker_created"
        ? Math.max(60, input.severity ?? 60)
        : input.eventType === "blocker_resolved"
          ? 48
          : 44,
    payload: {
      title: input.title,
      blockerType: input.blockerType,
      severity: input.severity ?? null,
      resolutionNote: input.resolutionNote ?? null,
      relatedOpportunityId: input.relatedOpportunityId ?? null,
    },
  });
}

export async function recordMemoryCorrectionDelta(input: DeltaActorContext & {
  memoryFactId: string;
  correctionType: string;
  objectType: string;
  objectId: string;
  reason?: string | null;
}) {
  return createDeltaEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    eventType: "memory_corrected",
    objectType: input.objectType,
    objectId: input.objectId,
    sourceType: "MemoryFact",
    sourceId: input.memoryFactId,
    importance: 54,
    payload: {
      memoryFactId: input.memoryFactId,
      correctionType: input.correctionType,
      reason: input.reason ?? null,
    },
  });
}

export async function recordPolicyChangedDelta(input: DeltaActorContext & {
  policyRuleId: string;
  actionType: string;
  before?: unknown;
  after?: unknown;
  policyName: string;
}) {
  return createDeltaEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    eventType: "policy_changed",
    objectType: "PolicyRule",
    objectId: input.policyRuleId,
    sourceType: "PolicyRule",
    sourceId: input.policyRuleId,
    importance: 62,
    payload: {
      policyName: input.policyName,
      actionType: input.actionType,
      before: input.before ?? null,
      after: input.after ?? null,
    },
  });
}
