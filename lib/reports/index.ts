import { endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { ActorType } from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMemoryExtractionQualityOverview } from "@/lib/evals/memory-evals";
import { getRecommendationQualityOverview } from "@/lib/evals/recommendation-evals";
import { getEvolutionInsights } from "@/lib/evolution/evolution-insights.service";
import { assertWorkspaceInsightServiceAccess } from "@/lib/auth/service-governance";

export function getWeekRange(offset = 0) {
  const base = subWeeks(new Date(), offset);
  const weekStart = startOfWeek(base, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(base, { weekStartsOn: 1 });

  return { weekStart, weekEnd };
}

export function buildWeeklyReportSummaryText(input: {
  opportunitiesAdvancedCount: number;
  overdueFollowupsCount: number;
  aiSuggestionsCount: number;
  approvalsApprovedCount: number;
  openHighRiskCount: number;
  english?: boolean;
}) {
  if (input.english) {
    return `Over the past week, Helm identified ${input.opportunitiesAdvancedCount} opportunity movement action(s), while ${input.overdueFollowupsCount} follow-up item(s) are still overdue. Helm generated ${input.aiSuggestionsCount} suggested action(s) this week, and ${input.approvalsApprovedCount} of them were approved for execution. ${input.openHighRiskCount} high-risk item(s) still need review.`;
  }

  return `过去一周识别出 ${input.opportunitiesAdvancedCount} 次机会推进动作，当前仍有 ${input.overdueFollowupsCount} 个跟进已逾期。本周生成 ${input.aiSuggestionsCount} 条建议动作，其中 ${input.approvalsApprovedCount} 条已被批准执行。目前还有 ${input.openHighRiskCount} 个高风险事项待处理。`;
}

export function buildWeeklyReportAuditSummary(input: {
  weekStart: Date;
  weekEnd: Date;
  english?: boolean;
}) {
  if (input.english) {
    return `Generated manager weekly report: ${format(input.weekStart, "MMM dd", { locale: enUS })} - ${format(input.weekEnd, "MMM dd", { locale: enUS })}`;
  }

  return `生成管理者周报：${format(input.weekStart, "MM月dd日", { locale: zhCN })} - ${format(input.weekEnd, "MM月dd日", { locale: zhCN })}`;
}

export async function generateWeeklyReport(input: {
  workspaceId: string;
  userId: string;
  actorName: string;
  offset?: number;
  english?: boolean;
}) {
  await assertWorkspaceInsightServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });

  const { weekStart, weekEnd } = getWeekRange(input.offset ?? 0);

  const [
    eventLogs,
    overdueOpportunities,
    highRiskOpportunities,
    meetingsCount,
    newOpportunitiesCount,
    snapshots,
    evolution,
    blockers,
    rejectedApprovals,
    reviewedApprovals,
    connectors,
    unboundThreads,
    recentAuditCount,
    llmFallbackCount,
    recommendationQuality,
    memoryQuality,
    dingtalkLinkedSignalsCount,
    dingtalkConvertedActionCount,
    dingtalkPendingApprovalCount,
  ] = await Promise.all([
    db.eventLog.findMany({
      where: {
        workspaceId: input.workspaceId,
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        user: true,
      },
    }),
    db.opportunity.findMany({
      where: {
        workspaceId: input.workspaceId,
        dueDate: {
          lt: new Date(),
        },
        stage: {
          notIn: ["DONE", "LOST"],
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 6,
    }),
    db.opportunity.findMany({
      where: {
        workspaceId: input.workspaceId,
        riskLevel: {
          in: ["HIGH", "CRITICAL"],
        },
        stage: {
          notIn: ["DONE", "LOST"],
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 6,
    }),
    db.meeting.count({
      where: {
        workspaceId: input.workspaceId,
        startsAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    }),
    db.opportunity.count({
      where: {
        workspaceId: input.workspaceId,
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    }),
    db.dailyUsageSnapshot.findMany({
      where: {
        workspaceId: input.workspaceId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        user: true,
      },
    }),
    getEvolutionInsights({
      workspaceId: input.workspaceId,
      limit: 3,
    }),
    db.blocker.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          {
            createdAt: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
          {
            updatedAt: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        ],
      },
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: "REJECTED",
        reviewedAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        actionItem: true,
      },
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId: input.workspaceId,
        reviewedAt: {
          gte: weekStart,
          lte: weekEnd,
        },
        status: {
          in: ["EXECUTED", "REJECTED"],
        },
      },
      select: {
        createdAt: true,
        reviewedAt: true,
      },
    }),
    db.connector.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      select: {
        provider: true,
        status: true,
        lastSyncStatus: true,
      },
    }),
    db.emailThread.count({
      where: {
        workspaceId: input.workspaceId,
        source: {
          in: ["GMAIL", "IMPORT"],
        },
        contactId: null,
        companyId: null,
        opportunityId: null,
      },
    }),
    db.auditLog.count({
      where: {
        workspaceId: input.workspaceId,
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    }),
    db.lLMCallLog.count({
      where: {
        workspaceId: input.workspaceId,
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
        fallbackReason: {
          not: null,
        },
      },
    }),
    getRecommendationQualityOverview(input.workspaceId, weekStart),
    getMemoryExtractionQualityOverview(input.workspaceId, weekStart),
    db.connectorIngestionRecord.count({
      where: {
        workspaceId: input.workspaceId,
        sourceScope: { startsWith: "OBJECT:" },
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    }),
    db.actionItem.count({
      where: {
        workspaceId: input.workspaceId,
        metadata: { contains: '"sourceProvider":"DINGTALK_MCP"' },
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    }),
    db.approvalTask.count({
      where: {
        workspaceId: input.workspaceId,
        status: "PENDING",
        actionItem: {
          metadata: { contains: '"sourceProvider":"DINGTALK_MCP"' },
        },
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    }),
  ]);

  const opportunitiesAdvancedCount = eventLogs.filter(
    (event) => event.eventName === "opportunity_stage_changed",
  ).length;
  const overdueFollowupsCount = overdueOpportunities.length;
  const aiSuggestionsCount = eventLogs.filter((event) =>
    ["followup_draft_generated", "action_items_generated"].includes(
      event.eventName,
    ),
  ).length;
  const approvalsApprovedCount = eventLogs.filter(
    (event) => event.eventName === "approval_approved",
  ).length;
  const openHighRiskCount = highRiskOpportunities.length;
  const rejectedActionsCount = eventLogs.filter(
    (event) => event.eventName === "approval_rejected",
  ).length;
  const recommendationGeneratedCount = eventLogs.filter(
    (event) => event.eventName === "recommendation_generated",
  ).length;
  const recommendationExplanationViews = eventLogs.filter(
    (event) => event.eventName === "recommendation_explanation_viewed",
  ).length;
  const recommendationActionCreatedCount = eventLogs.filter(
    (event) => event.eventName === "recommendation_action_created",
  ).length;
  const recommendationAcceptedCount = eventLogs.filter(
    (event) => event.eventName === "recommendation_accepted",
  ).length;
  const recommendationRejectedCount = eventLogs.filter(
    (event) => event.eventName === "recommendation_rejected",
  ).length;
  const recommendationEditedApprovedCount = eventLogs.filter((event) => {
    if (event.eventName !== "recommendation_feedback_submitted") return false;
    try {
      return (
        JSON.parse(event.metadata ?? "{}")?.feedbackType ===
        "EDITED_AND_APPROVED"
      );
    } catch {
      return false;
    }
  }).length;
  const mostActiveUser =
    Array.from(
      snapshots
        .reduce((acc, snapshot) => {
          const current = acc.get(snapshot.userId) ?? {
            name: snapshot.user.name,
            score: 0,
          };
          current.score +=
            snapshot.dashboardViewCount +
            snapshot.meetingViewCount +
            snapshot.actionItemsGenerated +
            snapshot.approvalsApproved +
            snapshot.opportunityStageChanges +
            snapshot.followupDraftsGenerated +
            snapshot.policyChanges;
          acc.set(snapshot.userId, current);
          return acc;
        }, new Map<string, { name: string; score: number }>())
        .values(),
    ).sort((left, right) => right.score - left.score)[0] ?? null;
  const highFrequencyBlockers = Array.from(
    blockers
      .reduce((acc, blocker) => {
        const current = acc.get(blocker.blockerType) ?? {
          blockerType: blocker.blockerType,
          count: 0,
          title: blocker.title,
        };
        current.count += 1;
        acc.set(blocker.blockerType, current);
        return acc;
      }, new Map<string, { blockerType: string; count: number; title: string }>())
      .values(),
  )
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);
  const rejectedRecommendationTypes = Array.from(
    rejectedApprovals
      .reduce((acc, task) => {
        const actionType = task.actionItem.actionType;
        const current = acc.get(actionType) ?? { actionType, count: 0 };
        current.count += 1;
        acc.set(actionType, current);
        return acc;
      }, new Map<string, { actionType: string; count: number }>())
      .values(),
  )
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);
  const averageApprovalTurnaroundHours =
    reviewedApprovals.length > 0
      ? Math.round(
          (reviewedApprovals.reduce((sum, approval) => {
            if (!approval.reviewedAt) return sum;
            return (
              sum +
              (approval.reviewedAt.getTime() - approval.createdAt.getTime()) /
                (1000 * 60 * 60)
            );
          }, 0) /
            reviewedApprovals.length) *
            10,
        ) / 10
      : 0;
  const connectorHealth = {
    connectedCount: connectors.filter((item) => item.status === "CONNECTED")
      .length,
    errorCount: connectors.filter(
      (item) =>
        item.status === "ERROR" || /失败|异常/.test(item.lastSyncStatus ?? ""),
    ).length,
  };

  const payload = {
    meetingsCount,
    newOpportunitiesCount,
    rejectedActionsCount,
    mostActiveUser,
    overdueItems: overdueOpportunities.map((item) => ({
      id: item.id,
      title: item.title,
      companyName: item.company?.name ?? null,
      dueDate: item.dueDate,
    })),
    highRiskItems: highRiskOpportunities.map((item) => ({
      id: item.id,
      title: item.title,
      companyName: item.company?.name ?? null,
      riskLevel: item.riskLevel,
      nextAction: item.nextAction,
    })),
    evolutionInsights: evolution.insights.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      confidence: item.confidence,
    })),
    evolutionRecentAdoptions: evolution.recentAdoptions.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.appliedEffectSummary ?? item.reason,
      appliedAt: item.appliedAt,
      targetPolicyKey: item.targetPolicyKey,
      suggestedValue: item.suggestedValue,
    })),
    highFrequencyBlockers,
    rejectedRecommendationTypes,
    recommendationMetrics: {
      generated: recommendationGeneratedCount,
      explanationViews: recommendationExplanationViews,
      actionCreated: recommendationActionCreatedCount,
      accepted: recommendationAcceptedCount,
      rejected: recommendationRejectedCount,
      editedApproved: recommendationEditedApprovedCount,
    },
    qualityMetrics: {
      recommendation: {
        goldenPassRate: recommendationQuality.goldenSummary.passRate,
        acceptanceRate: recommendationQuality.acceptanceRate,
        actionCreationRate: recommendationQuality.actionCreationRate,
        editedApprovalRate: recommendationQuality.editedApprovalRate,
        weakestActionTypes: recommendationQuality.weakestActionTypes,
      },
      memory: {
        goldenPassRate: memoryQuality.goldenSummary.passRate,
        factHitRate: memoryQuality.goldenSummary.factHitRate,
        commitmentHitRate: memoryQuality.goldenSummary.commitmentHitRate,
        blockerHitRate: memoryQuality.goldenSummary.blockerHitRate,
        correctionRate: memoryQuality.correctionRate,
        topErrorModes: memoryQuality.errorModes.slice(0, 3),
      },
    },
    governanceMetrics: {
      auditEventsCount: recentAuditCount,
      llmFallbackCount,
      averageApprovalTurnaroundHours,
      acceptedStrategyCount: evolution.recentAdoptions.length,
    },
    integrationMetrics: {
      connectorHealth,
      unboundThreads,
      dingtalkWorkflow: {
        linkedSignals: dingtalkLinkedSignalsCount,
        convertedActions: dingtalkConvertedActionCount,
        pendingApprovals: dingtalkPendingApprovalCount,
      },
    },
  };

  const report = await db.weeklyReport.upsert({
    where: {
      workspaceId_weekStart: {
        workspaceId: input.workspaceId,
        weekStart,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      weekStart,
      weekEnd,
      summaryText: buildWeeklyReportSummaryText({
        opportunitiesAdvancedCount,
        overdueFollowupsCount,
        aiSuggestionsCount,
        approvalsApprovedCount,
        openHighRiskCount,
        english: input.english,
      }),
      opportunitiesAdvancedCount,
      overdueFollowupsCount,
      aiSuggestionsCount,
      approvalsApprovedCount,
      openHighRiskCount,
      payload: JSON.stringify(payload),
    },
    update: {
      weekEnd,
      summaryText: buildWeeklyReportSummaryText({
        opportunitiesAdvancedCount,
        overdueFollowupsCount,
        aiSuggestionsCount,
        approvalsApprovedCount,
        openHighRiskCount,
        english: input.english,
      }),
      opportunitiesAdvancedCount,
      overdueFollowupsCount,
      aiSuggestionsCount,
      approvalsApprovedCount,
      openHighRiskCount,
      payload: JSON.stringify(payload),
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "WEEKLY_REPORT_GENERATED",
    targetType: "WeeklyReport",
    targetId: report.id,
    summary: buildWeeklyReportAuditSummary({
      weekStart,
      weekEnd,
      english: input.english,
    }),
    payload,
  });

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventName: "weekly_report_generated",
    eventCategory: "report",
    targetType: "WeeklyReport",
    targetId: report.id,
    metadata: {
      weekStart,
      weekEnd,
      opportunitiesAdvancedCount,
      overdueFollowupsCount,
      approvalsApprovedCount,
    },
    sourcePage: "/reports",
  });

  return report;
}

export async function getWeeklyReports(workspaceId: string) {
  return db.weeklyReport.findMany({
    where: { workspaceId },
    orderBy: { weekStart: "desc" },
    take: 6,
  });
}
