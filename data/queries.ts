import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getApprovalTasksData as getApprovalTasksDataQuery } from "@/features/approvals/queries";
import { getCompanyDetailData as getCompanyDetailDataQuery } from "@/features/companies/queries";
import { safeParseJson } from "@/lib/utils";

// This module is a thin aggregation layer kept ONLY for the queries that
// workspace pages still import from `@/data/queries`:
//   getOpportunityCommercialDetailData, getCompanyDetailData,
//   getApprovalTasksData, getCustomerSuccessQueueData.
// The previous per-domain re-export wrappers (getDashboardData, getInboxData,
// getMemoryData, …) were dead — every caller imports the `features/<domain>/
// queries` modules directly — so they were removed.

export async function getOpportunityCommercialDetailData(
  workspaceId: string,
  opportunityId: string,
) {
  const opportunity = await db.opportunity.findFirst({
    where: {
      workspaceId,
      id: opportunityId,
    },
    include: {
      company: true,
      contacts: true,
      owner: true,
      actionItems: {
        include: {
          approvalTask: true,
          owner: true,
          contact: true,
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      },
      memoryEntries: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      meetings: {
        include: {
          note: true,
        },
        orderBy: { startsAt: "desc" },
      },
      emailThreads: {
        include: {
          messages: {
            orderBy: { sentAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!opportunity) return null;

  const [memoryFacts, commitments, blockers, briefingSnapshot, auditLogs] =
    await Promise.all([
      db.memoryFact.findMany({
        where: {
          workspaceId,
          objectType: "OPPORTUNITY",
          objectId: opportunityId,
          status: { in: ["ACTIVE", "OBSERVED"] },
        },
        orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
        take: 8,
      }),
      db.commitment.findMany({
        where: {
          workspaceId,
          relatedOpportunityId: opportunityId,
        },
        include: {
          relatedContact: true,
          relatedCompany: true,
          relatedOpportunity: true,
          relatedMeeting: true,
          ownerUser: true,
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      }),
      db.blocker.findMany({
        where: {
          workspaceId,
          relatedOpportunityId: opportunityId,
        },
        include: {
          relatedContact: true,
          relatedCompany: true,
          relatedOpportunity: true,
          relatedMeeting: true,
        },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
      }),
      db.briefingSnapshot.findFirst({
        where: {
          workspaceId,
          objectType: ObjectType.OPPORTUNITY,
          objectId: opportunityId,
          snapshotType: "object_brief",
          expiresAt: null,
        },
        orderBy: { generatedAt: "desc" },
      }),
      db.auditLog.findMany({
        where: {
          workspaceId,
          OR: [
            { targetId: opportunityId },
            { relatedObjectId: opportunityId },
            ...opportunity.actionItems.map((item) => ({ targetId: item.id })),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  return {
    ...opportunity,
    memoryFacts,
    commitments,
    blockers,
    briefingSnapshot: briefingSnapshot
      ? {
          ...briefingSnapshot,
          payload: safeParseJson<Record<string, unknown>>(
            briefingSnapshot.content,
            {},
          ),
        }
      : null,
    auditLogs,
  };
}

export async function getCompanyDetailData(workspaceId: string, companyId: string) {
  return getCompanyDetailDataQuery(workspaceId, companyId);
}

export async function getApprovalTasksData(workspaceId: string) {
  return getApprovalTasksDataQuery(workspaceId);
}

export async function getCustomerSuccessQueueData(workspaceId: string) {
  const [approvalTasks, opportunities] = await Promise.all([
    getApprovalTasksDataQuery(workspaceId),
    db.opportunity.findMany({
      where: {
        workspaceId,
        stage: {
          notIn: ["DONE", "LOST"],
        },
      },
      include: {
        company: true,
        contacts: true,
        owner: true,
        actionItems: {
          include: {
            approvalTask: true,
            owner: true,
            contact: true,
          },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        },
        memoryEntries: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        meetings: {
          include: {
            note: true,
          },
          orderBy: { startsAt: "desc" },
        },
        emailThreads: {
          include: {
            // The queue only renders the latest message + total count per
            // thread (see successInboxThreads below), so fetch just the most
            // recent message and a count instead of every full message body.
            messages: {
              orderBy: { sentAt: "desc" },
              take: 1,
            },
            _count: { select: { messages: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
    }),
  ]);

  if (!opportunities.length) {
    return {
      queueDetails: [],
      successInboxThreads: [],
    };
  }

  const opportunityIds = opportunities.map((item) => item.id);
  const actionItemIds = opportunities.flatMap((item) =>
    item.actionItems.map((actionItem) => actionItem.id),
  );

  const [memoryFacts, commitments, blockers, briefingSnapshots, auditLogs] =
    await Promise.all([
      db.memoryFact.findMany({
        where: {
          workspaceId,
          objectType: ObjectType.OPPORTUNITY,
          objectId: { in: opportunityIds },
          status: { in: ["ACTIVE", "OBSERVED"] },
        },
        orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      }),
      db.commitment.findMany({
        where: {
          workspaceId,
          relatedOpportunityId: { in: opportunityIds },
        },
        include: {
          relatedContact: true,
          relatedCompany: true,
          relatedOpportunity: true,
          relatedMeeting: true,
          ownerUser: true,
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      }),
      db.blocker.findMany({
        where: {
          workspaceId,
          relatedOpportunityId: { in: opportunityIds },
        },
        include: {
          relatedContact: true,
          relatedCompany: true,
          relatedOpportunity: true,
          relatedMeeting: true,
        },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
      }),
      db.briefingSnapshot.findMany({
        where: {
          workspaceId,
          objectType: ObjectType.OPPORTUNITY,
          objectId: { in: opportunityIds },
          snapshotType: "object_brief",
          expiresAt: null,
        },
        orderBy: [{ generatedAt: "desc" }],
      }),
      db.auditLog.findMany({
        where: {
          workspaceId,
          OR: [
            { targetId: { in: opportunityIds } },
            { relatedObjectId: { in: opportunityIds } },
            ...(actionItemIds.length ? [{ targetId: { in: actionItemIds } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
    ]);

  const snapshotByOpportunityId = new Map<
    string,
    (typeof briefingSnapshots)[number]
  >();
  for (const snapshot of briefingSnapshots) {
    if (!snapshotByOpportunityId.has(snapshot.objectId)) {
      snapshotByOpportunityId.set(snapshot.objectId, snapshot);
    }
  }

  const normalizedDetails = opportunities.map((opportunity) => {
    const opportunityAuditLogs = auditLogs.filter(
      (log) =>
        log.targetId === opportunity.id ||
        log.relatedObjectId === opportunity.id ||
        opportunity.actionItems.some((item) => item.id === log.targetId),
    );
    const briefingSnapshot = snapshotByOpportunityId.get(opportunity.id);

    return {
      ...opportunity,
      memoryFacts: memoryFacts.filter((fact) => fact.objectId === opportunity.id),
      commitments: commitments.filter(
        (commitment) => commitment.relatedOpportunityId === opportunity.id,
      ),
      blockers: blockers.filter(
        (blocker) => blocker.relatedOpportunityId === opportunity.id,
      ),
      briefingSnapshot: briefingSnapshot
        ? {
            ...briefingSnapshot,
            payload: safeParseJson<Record<string, unknown>>(
              briefingSnapshot.content,
              {},
            ),
          }
        : null,
      auditLogs: opportunityAuditLogs,
    };
  });

  const rankedDetails = normalizedDetails
    .map((detail) => {
      const pendingReviewCount = approvalTasks.filter(
        (task) =>
          task.status === "PENDING" &&
          task.actionItem.opportunity?.id === detail.id,
      ).length;
      const topBlockerSeverity = detail.blockers[0]?.severity ?? 0;
      const hasEscalationPressure =
        topBlockerSeverity >= 7 ||
        detail.riskLevel === "HIGH" ||
        detail.riskLevel === "CRITICAL";
      const hasIssuePressure = detail.commitments.some(
        (commitment) => commitment.overdueFlag,
      );

      const score =
        pendingReviewCount * 40 +
        (hasEscalationPressure ? 30 : 0) +
        (hasIssuePressure ? 20 : 0) +
        (detail.stage === "INTERNAL_SYNC" ? 10 : 0) +
        detail.updatedAt.getTime() / 10000000000000;

      return { detail, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const companyIds = Array.from(
    new Set(
      rankedDetails
        .map((item) => item.detail.company?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const companyEntries = await Promise.all(
    companyIds.map(async (companyId) => [
      companyId,
      await getCompanyDetailData(workspaceId, companyId),
    ] as const),
  );
  const companyMap = new Map(companyEntries);

  const queueDetails = rankedDetails.map(({ detail }) => ({
    detail,
    company: detail.company ? (companyMap.get(detail.company.id) ?? null) : null,
    reviewTasks: approvalTasks.filter(
      (task) => task.actionItem.opportunity?.id === detail.id,
    ),
  }));

  const successInboxThreads = rankedDetails
    .flatMap(({ detail }) =>
      detail.emailThreads.map((thread) => ({
        id: thread.id,
        subject: thread.subject,
        counterpart: thread.counterpart,
        status: thread.status,
        shouldReply: thread.shouldReply,
        updatedAt: thread.updatedAt,
        company: detail.company,
        opportunity: {
          id: detail.id,
          title: detail.title,
          riskLevel: detail.riskLevel,
          stage: detail.stage,
          nextAction: detail.nextAction,
        },
        latestMessage: thread.messages[0] ?? null,
        messageCount: thread._count.messages,
      })),
    )
    .filter(
      (thread, index, threads) =>
        (thread.shouldReply ||
          thread.status === "WAITING_US" ||
          thread.status === "OPEN") &&
        threads.findIndex((item) => item.id === thread.id) === index,
    )
    .sort((left, right) => {
      const replyDelta = Number(right.shouldReply) - Number(left.shouldReply);
      if (replyDelta !== 0) return replyDelta;
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .slice(0, 6);

  return {
    queueDetails,
    successInboxThreads,
  };
}

