import { ConnectorProvider, RecordSource, type Prisma } from "@prisma/client";
import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from "date-fns";
import { opportunityTypeLabels, stageLabels } from "@/data/constants";
import { db } from "@/lib/db";

export type DashboardExternalAssignmentActionItem = {
  id: string;
  title: string;
  description: string | null;
  draftContent: string | null;
  metadata: string | null;
  status: string;
  sourceId: string | null;
  suggestedAt: Date;
  updatedAt: Date;
};

async function loadPipelineDashboardBatch(workspaceId: string) {
  const activeOpportunityWhere: Prisma.OpportunityWhereInput = {
    workspaceId,
    stage: {
      notIn: ["DONE", "LOST"],
    },
  };

  const [
    topOpportunities,
    highRiskOpportunities,
    followUpContacts,
    overdueOpportunities,
    activeOpportunitySnapshot,
  ] = await Promise.all([
    db.opportunity.findMany({
      where: activeOpportunityWhere,
      include: {
        company: true,
        contacts: true,
        owner: true,
        blockers: {
          orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
      take: 5,
    }),
    db.opportunity.findMany({
      where: {
        ...activeOpportunityWhere,
        riskLevel: {
          in: ["HIGH", "CRITICAL"],
        },
      },
      include: {
        company: true,
        contacts: true,
        owner: true,
        blockers: {
          orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 4,
    }),
    db.contact.findMany({
      where: {
        workspaceId,
        archivedAt: null,
      },
      include: {
        company: true,
        opportunities: true,
        meetings: true,
      },
      orderBy: [{ lastInteractionAt: "asc" }],
      take: 5,
    }),
    db.opportunity.findMany({
      where: {
        ...activeOpportunityWhere,
        dueDate: {
          lt: new Date(),
        },
      },
      include: {
        company: true,
        contacts: true,
        owner: true,
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    db.opportunity.findMany({
      where: activeOpportunityWhere,
      select: {
        stage: true,
        type: true,
        riskLevel: true,
      },
    }),
  ]);

  return {
    topOpportunities,
    highRiskOpportunities,
    followUpContacts,
    overdueOpportunities,
    activeOpportunitySnapshot,
  };
}

async function loadMeetingDashboardBatch(
  workspaceId: string,
  currentUserId: string,
  dayStart: Date,
  dayEnd: Date,
  trendStart: Date,
) {
  const [
    todayMeetings,
    upcomingMeetings,
    recentMeetings,
    postMeetingItems,
    externalAssignmentActionItems,
    recentExecutedActions,
    executedTodayCount,
    recentExecutedActivity,
    recentMeetingActivity,
    recentApprovalActivity,
  ] = await Promise.all([
    db.meeting.findMany({
      where: {
        workspaceId,
        startsAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        company: true,
        opportunity: true,
        contacts: true,
        note: true,
        owner: true,
      },
      orderBy: { startsAt: "asc" },
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        startsAt: {
          gt: dayEnd,
        },
      },
      include: {
        company: true,
        opportunity: true,
        contacts: true,
        note: true,
        owner: true,
      },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        startsAt: {
          lt: dayStart,
        },
      },
      include: {
        company: true,
        opportunity: true,
        contacts: true,
        note: true,
        owner: true,
      },
      orderBy: { startsAt: "desc" },
      take: 4,
    }),
    db.actionItem.findMany({
      where: {
        workspaceId,
        meetingId: {
          not: null,
        },
        status: {
          in: ["PENDING_APPROVAL", "MANUAL"],
        },
      },
      include: {
        meeting: true,
        opportunity: true,
        contact: true,
      },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
    }),
    db.actionItem.findMany({
      where: {
        workspaceId,
        ownerId: currentUserId,
        sourceType: "SYSTEM_INFERENCE",
        requiresApproval: false,
        status: {
          in: ["MANUAL", "SUGGESTED"],
        },
        OR: [
          {
            metadata: {
              contains: "\"sourceScope\":\"external_assignment_employee_action\"",
            },
          },
          {
            metadata: {
              contains: "\"sourceScope\":\"external_signal_employee_action\"",
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        draftContent: true,
        metadata: true,
        status: true,
        sourceId: true,
        suggestedAt: true,
        updatedAt: true,
      },
      orderBy: [{ suggestedAt: "desc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    db.actionItem.findMany({
      where: {
        workspaceId,
        status: "EXECUTED",
      },
      include: {
        opportunity: true,
        contact: true,
        meeting: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.actionItem.count({
      where: {
        workspaceId,
        status: "EXECUTED",
        updatedAt: { gte: dayStart, lte: dayEnd },
      },
    }),
    db.actionItem.findMany({
      where: {
        workspaceId,
        updatedAt: {
          gte: trendStart,
          lte: dayEnd,
        },
        status: "EXECUTED",
      },
      select: { updatedAt: true },
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        startsAt: {
          gte: trendStart,
          lte: dayEnd,
        },
      },
      select: { startsAt: true },
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: trendStart,
          lte: dayEnd,
        },
      },
      select: { createdAt: true },
    }),
  ]);

  return {
    todayMeetings,
    upcomingMeetings,
    recentMeetings,
    postMeetingItems,
    externalAssignmentActionItems,
    recentExecutedActions,
    executedTodayCount,
    recentActivity: [recentExecutedActivity, recentMeetingActivity, recentApprovalActivity] as const,
  };
}

async function loadGovernanceDashboardBatch(workspaceId: string) {
  const emailThreadWhere: Prisma.EmailThreadWhereInput = {
    workspaceId,
    source: {
      in: [RecordSource.GMAIL, RecordSource.IMPORT],
    },
  };

  const [
    pendingApprovals,
    pendingApprovalCount,
    connectedGmail,
    realThreadCount,
    gmailThreadCount,
    importThreadCount,
    unboundThreadCount,
    waitingOnUsThreadCount,
    importedSignalCount,
    recentMemoryFacts,
    recentAuditLogs,
  ] = await Promise.all([
    db.approvalTask.findMany({
      where: {
        workspaceId,
        status: "PENDING",
      },
      include: {
        actionItem: {
          include: {
            opportunity: true,
            contact: true,
            meeting: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.approvalTask.count({
      where: {
        workspaceId,
        status: "PENDING",
      },
    }),
    db.connector.findFirst({
      where: {
        workspaceId,
        provider: ConnectorProvider.GMAIL,
        status: "CONNECTED",
      },
      select: {
        id: true,
        externalAccountEmail: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
      },
      orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    }),
    db.emailThread.count({
      where: emailThreadWhere,
    }),
    db.emailThread.count({
      where: {
        workspaceId,
        source: RecordSource.GMAIL,
      },
    }),
    db.emailThread.count({
      where: {
        workspaceId,
        source: RecordSource.IMPORT,
      },
    }),
    db.emailThread.count({
      where: {
        ...emailThreadWhere,
        opportunityId: null,
      },
    }),
    db.emailThread.count({
      where: {
        ...emailThreadWhere,
        status: "WAITING_US",
      },
    }),
    db.memoryEntry.count({
      where: {
        workspaceId,
        source: "CSV 导入",
      },
    }),
    db.memoryFact.findMany({
      where: {
        workspaceId,
        status: { in: ["ACTIVE", "OBSERVED"] },
      },
      select: {
        id: true,
        objectType: true,
        objectId: true,
        title: true,
        content: true,
        updatedAt: true,
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
    db.auditLog.findMany({
      where: { workspaceId },
      select: {
        id: true,
        actionType: true,
        summary: true,
        targetType: true,
        targetId: true,
        relatedObjectType: true,
        relatedObjectId: true,
        sourcePage: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return {
    pendingApprovals,
    pendingApprovalCount,
    dataIngressSummary: {
      connectedGmail,
      connectedSourceCount: Number(Boolean(connectedGmail)) + Number(importThreadCount > 0),
      realThreadCount,
      gmailThreadCount,
      importThreadCount,
      unboundThreadCount,
      waitingOnUsThreadCount,
      importedSignalCount,
    },
    recentMemoryFacts,
    recentAuditLogs,
  };
}

export async function getDashboardData(workspaceId: string, currentUserId: string) {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());
  const trendStart = startOfDay(subDays(new Date(), 6));

  const [pipelineBatch, meetingBatch, governanceBatch] = await Promise.all([
    loadPipelineDashboardBatch(workspaceId),
    loadMeetingDashboardBatch(workspaceId, currentUserId, dayStart, dayEnd, trendStart),
    loadGovernanceDashboardBatch(workspaceId),
  ]);

  const {
    topOpportunities,
    highRiskOpportunities,
    followUpContacts,
    overdueOpportunities,
    activeOpportunitySnapshot,
  } = pipelineBatch;
  const {
    todayMeetings,
    upcomingMeetings,
    recentMeetings,
    postMeetingItems,
    externalAssignmentActionItems,
    recentExecutedActions,
    executedTodayCount,
    recentActivity,
  } = meetingBatch;
  const {
    pendingApprovals,
    pendingApprovalCount,
    dataIngressSummary,
    recentMemoryFacts,
    recentAuditLogs,
  } = governanceBatch;

  const trendDays = eachDayOfInterval({ start: trendStart, end: dayStart });
  const executedActionDays = recentActivity[0].map((item) => format(item.updatedAt, "yyyy-MM-dd"));
  const meetingDays = recentActivity[1].map((item) => format(item.startsAt, "yyyy-MM-dd"));
  const approvalDays = recentActivity[2].map((item) => format(item.createdAt, "yyyy-MM-dd"));

  const trendSeries = trendDays.map((date) => {
    const key = format(date, "yyyy-MM-dd");

    return {
      label: format(date, "MM/dd"),
      executed: executedActionDays.filter((item) => item === key).length,
      meetings: meetingDays.filter((item) => item === key).length,
      approvals: approvalDays.filter((item) => item === key).length,
    };
  });

  const stageDistribution = Object.entries(stageLabels)
    .filter(([stage]) => !["DONE", "LOST"].includes(stage))
    .map(([stage, label]) => ({
      label,
      value: activeOpportunitySnapshot.filter((item) => item.stage === stage).length,
    }));

  const pipelineMix = Object.entries(opportunityTypeLabels).map(([type, label]) => {
    const scoped = activeOpportunitySnapshot.filter((item) => item.type === type);

    return {
      label,
      total: scoped.length,
      low: scoped.filter((item) => item.riskLevel === "LOW").length,
      medium: scoped.filter((item) => item.riskLevel === "MEDIUM").length,
      high: scoped.filter((item) => item.riskLevel === "HIGH").length,
      critical: scoped.filter((item) => item.riskLevel === "CRITICAL").length,
    };
  });

  const meetingSurfaceMode = todayMeetings.length
    ? "today"
    : upcomingMeetings.length
      ? "upcoming"
      : recentMeetings.length
        ? "recent"
        : "empty";
  const meetingSurfaceItems =
    meetingSurfaceMode === "today" ? todayMeetings : upcomingMeetings;
  const resolvedMeetingSurfaceItems =
    meetingSurfaceMode === "recent" ? recentMeetings : meetingSurfaceItems;

  return {
    topOpportunities,
    highRiskOpportunities,
    todayMeetings,
    upcomingMeetings,
    recentMeetings,
    meetingSurfaceMode,
    meetingSurfaceItems: resolvedMeetingSurfaceItems,
    pendingApprovals,
    followUpContacts,
    postMeetingItems,
    externalAssignmentActionItems,
    recentExecutedActions,
    recentMemoryFacts,
    recentAuditLogs,
    overdueOpportunities,
    trendSeries,
    stageDistribution,
    pipelineMix,
    dataIngressSummary,
    completionSummary: {
      executedToday: executedTodayCount,
      meetingsToday: todayMeetings.length,
      activeOpportunities: activeOpportunitySnapshot.length,
      pendingApprovals: pendingApprovalCount,
      highRiskCount: highRiskOpportunities.length,
      followUpDueCount: overdueOpportunities.length,
      completedRateBase:
        executedTodayCount +
        pendingApprovalCount +
        overdueOpportunities.length +
        postMeetingItems.length +
        externalAssignmentActionItems.length,
    },
  };
}
