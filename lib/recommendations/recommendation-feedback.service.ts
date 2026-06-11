import {
  ActorType,
  PreferenceSignalType,
  RecommendationFeedbackType,
  RecommendationStatus,
} from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceInsightServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { recordRecommendationFeedbackDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import type { RecommendationFeedbackInput } from "@/lib/recommendations/types";

const feedbackStatusMap: Record<
  RecommendationFeedbackType,
  RecommendationStatus
> = {
  APPROVED: RecommendationStatus.ACCEPTED,
  REJECTED: RecommendationStatus.REJECTED,
  EDITED_AND_APPROVED: RecommendationStatus.ACCEPTED,
  IGNORED: RecommendationStatus.IGNORED,
  AUTO_EXECUTED: RecommendationStatus.EXECUTED,
  FAILED: RecommendationStatus.EXPIRED,
};

function getPreferenceSignalValue(feedbackType: RecommendationFeedbackType) {
  switch (feedbackType) {
    case RecommendationFeedbackType.APPROVED:
      return "approved";
    case RecommendationFeedbackType.EDITED_AND_APPROVED:
      return "approved_after_edit";
    case RecommendationFeedbackType.AUTO_EXECUTED:
      return "auto_executed";
    case RecommendationFeedbackType.REJECTED:
      return "rejected";
    case RecommendationFeedbackType.IGNORED:
      return "ignored";
    case RecommendationFeedbackType.FAILED:
      return "failed";
  }
}

function getFeedbackSummary(
  feedbackType: RecommendationFeedbackType,
  title: string,
  english: boolean,
) {
  switch (feedbackType) {
    case RecommendationFeedbackType.APPROVED:
      return english
        ? `User accepted the recommendation: ${title}`
        : `用户采纳了判断建议：${title}`;
    case RecommendationFeedbackType.EDITED_AND_APPROVED:
      return english
        ? `User edited and accepted the recommendation: ${title}`
        : `用户编辑后采纳了判断建议：${title}`;
    case RecommendationFeedbackType.AUTO_EXECUTED:
      return english
        ? `System executed the recommendation under policy: ${title}`
        : `系统按策略自动执行了判断建议：${title}`;
    case RecommendationFeedbackType.REJECTED:
      return english
        ? `User rejected the recommendation: ${title}`
        : `用户拒绝了判断建议：${title}`;
    case RecommendationFeedbackType.IGNORED:
      return english
        ? `Recommendation was ignored: ${title}`
        : `判断建议被忽略：${title}`;
    case RecommendationFeedbackType.FAILED:
      return english
        ? `Recommendation execution failed: ${title}`
        : `判断建议执行失败：${title}`;
  }
}

export async function submitRecommendationFeedback(
  input: RecommendationFeedbackInput,
) {
  const actorType =
    input.actorType ?? (input.userId ? ActorType.USER : ActorType.SYSTEM);

  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType,
    english: input.english ?? false,
  });

  // Defense in depth: scope the lookup to the caller's workspace so this
  // reusable service never mutates a recommendation belonging to another
  // workspace, even if a future caller forgets the ownership guard.
  const recommendation = await db.recommendationLog.findFirst({
    where: { id: input.recommendationId, workspaceId: input.workspaceId },
  });

  if (!recommendation) {
    throw new Error("Recommendation not found");
  }

  const status = feedbackStatusMap[input.feedbackType];

  const feedback = await db.$transaction(async (tx) => {
    const created = await tx.recommendationFeedback.create({
      data: {
        workspaceId: input.workspaceId,
        recommendationLogId: input.recommendationId,
        userId: input.userId ?? undefined,
        feedbackType: input.feedbackType,
        edited: Boolean(input.edited),
        resultNote: input.resultNote ?? undefined,
        actionItemId: input.actionItemId ?? undefined,
        approvalTaskId: input.approvalTaskId ?? undefined,
      },
    });

    await tx.recommendationLog.update({
      where: { id: input.recommendationId },
      data: { status },
    });

    if (input.userId) {
      const signalValue = getPreferenceSignalValue(input.feedbackType);
      const actionSignalKey = recommendation.actionType;
      const weightDelta =
        input.feedbackType === RecommendationFeedbackType.REJECTED
          ? -12
          : input.feedbackType ===
              RecommendationFeedbackType.EDITED_AND_APPROVED
            ? 4
            : 10;

      const existing = await tx.preferenceSignal.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          signalType: PreferenceSignalType.APPROVAL_PREFERENCE,
          signalKey: actionSignalKey,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        await tx.preferenceSignal.update({
          where: { id: existing.id },
          data: {
            signalValue,
            weight: Math.max(5, Math.min(100, existing.weight + weightDelta)),
            sourceActionId: input.actionItemId ?? existing.sourceActionId,
            sourceRecommendationId: recommendation.id,
          },
        });
      } else {
        await tx.preferenceSignal.create({
          data: {
            workspaceId: input.workspaceId,
            userId: input.userId,
            signalType: PreferenceSignalType.APPROVAL_PREFERENCE,
            signalKey: actionSignalKey,
            signalValue,
            sourceActionId: input.actionItemId ?? undefined,
            sourceRecommendationId: recommendation.id,
            weight:
              input.feedbackType === RecommendationFeedbackType.REJECTED
                ? 28
                : 62,
          },
        });
      }
    }

    return created;
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType,
    actionType: "RECOMMENDATION_FEEDBACK_SUBMITTED",
    targetType: "RecommendationLog",
    targetId: recommendation.id,
    relatedObjectType: recommendation.objectType,
    relatedObjectId: recommendation.objectId,
    sourcePage: input.sourcePage ?? undefined,
    summary: getFeedbackSummary(
      input.feedbackType,
      recommendation.title,
      input.english ?? false,
    ),
    payload: {
      feedbackType: input.feedbackType,
      edited: input.edited ?? false,
      resultNote: input.resultNote ?? null,
      actionItemId: input.actionItemId ?? null,
      approvalTaskId: input.approvalTaskId ?? null,
    },
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "recommendation_feedback_submitted",
    eventCategory: "recommendation",
    targetType: "RecommendationLog",
    targetId: recommendation.id,
    metadata: {
      feedbackType: input.feedbackType,
      edited: input.edited ?? false,
      actionType: recommendation.actionType,
      objectType: recommendation.objectType,
      objectId: recommendation.objectId,
    },
    sourcePage: input.sourcePage ?? undefined,
  });

  if (
    input.feedbackType === RecommendationFeedbackType.APPROVED ||
    input.feedbackType === RecommendationFeedbackType.AUTO_EXECUTED
  ) {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      eventName: "recommendation_accepted",
      eventCategory: "recommendation",
      targetType: "RecommendationLog",
      targetId: recommendation.id,
      metadata: {
        feedbackType: input.feedbackType,
        actionType: recommendation.actionType,
      },
      sourcePage: input.sourcePage ?? undefined,
    });
  }

  if (input.feedbackType === RecommendationFeedbackType.REJECTED) {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      eventName: "recommendation_rejected",
      eventCategory: "recommendation",
      targetType: "RecommendationLog",
      targetId: recommendation.id,
      metadata: {
        actionType: recommendation.actionType,
      },
      sourcePage: input.sourcePage ?? undefined,
    });
  }

  try {
    await recordRecommendationFeedbackDelta({
      workspaceId: input.workspaceId,
      actorId: input.userId,
      actorType: input.userId ? ActorType.USER : ActorType.SYSTEM,
      sourcePage: input.sourcePage ?? undefined,
      recommendationId: recommendation.id,
      recommendationObjectType: recommendation.objectType,
      recommendationObjectId: recommendation.objectId,
      actionType: recommendation.actionType,
      feedbackType: input.feedbackType,
      edited: input.edited,
      resultNote: input.resultNote,
      sourceId: feedback.id,
      policyResult: recommendation.policyResult,
    });

    if (!input.suppressEvolutionRefresh) {
      await refreshEvolutionState({
        workspaceId: input.workspaceId,
        actorId: input.userId,
        actorType: input.userId ? ActorType.USER : ActorType.SYSTEM,
        sourcePage: input.sourcePage ?? undefined,
        trigger: "recommendation_feedback",
      });
    }
  } catch (error) {
    console.error("recommendation feedback evolution refresh failed", error);
  }

  return feedback;
}
