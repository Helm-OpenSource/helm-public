import { endOfDay, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { getRecommendationQualityOverview } from "@/lib/evals/recommendation-evals";
import { getMemoryExtractionQualityOverview } from "@/lib/evals/memory-evals";
import { getLLMOverview } from "@/lib/observability/llm-metrics.service";
import { getCaptureObservabilityOverview } from "@/lib/observability/capture-metrics.service";
import { getMemoryObservabilityOverview } from "@/lib/observability/memory-metrics.service";
import {
  FIRST_LOOP_DIAGNOSTICS_ACTION_TYPES,
  FIRST_LOOP_ANCHOR_RESUMED_ACTION,
  FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
  FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
  FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION,
} from "@/lib/operating-system";
import { buildFirstLoopAdoptionUserSummaries } from "@/features/diagnostics/first-loop-adoption";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";

export async function getFirstLoopAdoptionData(
  workspaceId: string,
  options?: {
    currentUserId?: string | null;
    since?: Date;
    until?: Date;
  },
) {
  const since = options?.since ?? startOfDay(subDays(new Date(), 13));
  const until = options?.until ?? endOfDay(new Date());

  const [
    handoffEnteredCount,
    primaryActionOpenedCount,
    anchorSavedCount,
    anchorResumedCount,
    reviewCompletedCount,
    writeBackConfirmedCount,
    events,
  ] = await Promise.all([
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: FIRST_LOOP_RETURN_ANCHOR_ACTION,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: FIRST_LOOP_ANCHOR_RESUMED_ACTION,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        actionType: FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    db.auditLog.findMany({
      where: {
        workspaceId,
        actorType: "USER",
        userId: {
          not: null,
        },
        actionType: {
          in: [...FIRST_LOOP_DIAGNOSTICS_ACTION_TYPES],
        },
        createdAt: {
          gte: since,
          lte: until,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        userId: true,
        actor: true,
        actionType: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    handoffEnteredCount,
    primaryActionOpenedCount,
    anchorSavedCount,
    anchorResumedCount,
    reviewCompletedCount,
    writeBackConfirmedCount,
    byUser: buildFirstLoopAdoptionUserSummaries({
      events,
      currentUserId: options?.currentUserId,
    }),
  };
}

export async function getDiagnosticsData(
  workspaceId: string,
  options?: { currentUserId?: string | null },
) {
  const since = startOfDay(subDays(new Date(), 13));
  const until = endOfDay(new Date());

  const [
    workspace,
    recommendationQuality,
    memoryQuality,
    llmOverview,
    captureOverview,
    memoryObservability,
    crmSources,
    importJobs,
    identityReviewCount,
    pendingApprovals,
    recentAuditCount,
    firstLoopAdoption,
  ] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        defaultLocale: true,
        pilotMode: true,
        featureFlagsJson: true,
        dataRetentionDays: true,
        captureConsentRequired: true,
      },
    }),
    getRecommendationQualityOverview(workspaceId, since),
    getMemoryExtractionQualityOverview(workspaceId, since),
    getLLMOverview(workspaceId, since),
    getCaptureObservabilityOverview(workspaceId, since),
    getMemoryObservabilityOverview(workspaceId, since),
    db.importSource.findMany({
      where: {
        workspaceId,
        sourceType: {
          in: ["HUBSPOT", "SALESFORCE"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        sourceType: true,
        status: true,
        externalAccountLabel: true,
        lastSyncedAt: true,
      },
    }),
    db.importJob.findMany({
      where: {
        workspaceId,
        startedAt: {
          gte: since,
          lte: until,
        },
      },
      include: {
        source: {
          select: {
            sourceType: true,
            externalAccountLabel: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 8,
    }),
    db.identityMatch.count({
      where: {
        workspaceId,
        status: "NEEDS_REVIEW",
      },
    }),
    db.approvalTask.count({
      where: {
        workspaceId,
        status: "PENDING",
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId,
        createdAt: {
          gte: since,
          lte: until,
        },
      },
    }),
    getFirstLoopAdoptionData(workspaceId, {
      currentUserId: options?.currentUserId,
      since,
      until,
    }),
  ]);

  if (!workspace) {
    throw new Error("工作区不存在");
  }

  const uiConfig = normalizeWorkspaceUiConfig(workspace);

  return {
    workspace: {
      ...workspace,
      ...uiConfig,
    },
    recommendationQuality,
    memoryQuality,
    llmOverview,
    captureOverview,
    memoryObservability,
    crmSources,
    importJobs,
    identityReviewCount,
    pendingApprovals,
    recentAuditCount,
    firstLoopAdoption,
  };
}
