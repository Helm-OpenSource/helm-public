import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import { buildDingTalkWorkProgressList } from "@/lib/connectors/dingtalk-work-progress";
import {
  OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE,
  parseOpportunityAttachmentMemoryEntry,
} from "@/lib/opportunities/attachment-memory";

export async function getOpportunitiesData(workspaceId: string) {
  const opportunities = await db.opportunity.findMany({
    where: { workspaceId },
    include: {
      company: true,
      contacts: true,
      owner: true,
      actionItems: {
        orderBy: { updatedAt: "desc" },
        take: 2,
      },
    },
    orderBy: [{ stage: "asc" }, { priorityScore: "desc" }],
  });

  const opportunityIds = opportunities.map((item) => item.id);
  const signalSince = new Date();
  signalSince.setDate(signalSince.getDate() - 7);
  const [facts, commitments, blockers, briefingSnapshots, auditLogs, attachmentEntries] = opportunityIds.length
    ? await Promise.all([
        db.memoryFact.findMany({
          where: {
            workspaceId,
            objectType: "OPPORTUNITY",
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
            ],
          },
          select: {
            id: true,
            actionType: true,
            summary: true,
            targetId: true,
            relatedObjectId: true,
            sourcePage: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        db.memoryEntry.findMany({
          where: {
            workspaceId,
            opportunityId: { in: opportunityIds },
            source: OPPORTUNITY_ATTACHMENT_MEMORY_SOURCE,
            deletedAt: null,
          },
          select: {
            id: true,
            opportunityId: true,
            title: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], [], [], [], [], []];
  const [dingtalkSignals, dingtalkActionItems, dingtalkMeetingLinkedWorkSignals] = opportunityIds.length
    ? await Promise.all([
        db.connectorIngestionRecord.findMany({
          where: {
            workspaceId,
            opportunityId: { in: opportunityIds },
            createdAt: { gte: signalSince },
            sourceScope: { startsWith: "OBJECT:" },
          },
          select: {
            id: true,
            opportunityId: true,
            sourceScope: true,
            sourceType: true,
            sourceId: true,
            sourceSummary: true,
            draftPayload: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 600,
        }),
        db.actionItem.findMany({
          where: {
            workspaceId,
            opportunityId: { in: opportunityIds },
            metadata: { contains: "\"sourceProvider\":\"DINGTALK_MCP\"" },
          },
          select: {
            id: true,
            opportunityId: true,
            status: true,
            requiresApproval: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 600,
        }),
        db.connectorIngestionRecord.findMany({
          where: {
            workspaceId,
            meetingId: { not: null },
            sourceScope: "OBJECT:WORK",
            sourceType: { contains: "report" },
            createdAt: { gte: signalSince },
            meeting: {
              opportunityId: { in: opportunityIds },
            },
          },
          select: {
            id: true,
            meetingId: true,
            sourceScope: true,
            sourceType: true,
            sourceId: true,
            sourceSummary: true,
            draftPayload: true,
            createdAt: true,
            meeting: {
              select: {
                opportunityId: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 600,
        }),
      ])
    : [[], [], []];

  return opportunities.map((opportunity) => ({
    ...opportunity,
    memoryFacts: facts.filter((fact) => fact.objectId === opportunity.id).slice(0, 4),
    commitments: commitments.filter((commitment) => commitment.relatedOpportunityId === opportunity.id).slice(0, 4),
    blockers: blockers.filter((blocker) => blocker.relatedOpportunityId === opportunity.id).slice(0, 4),
    auditLogs: auditLogs
      .filter(
        (log) =>
          log.targetId === opportunity.id || log.relatedObjectId === opportunity.id,
      )
      .slice(0, 4),
    briefingSnapshot: briefingSnapshots.find((snapshot) => snapshot.objectId === opportunity.id)
      ? {
          id: briefingSnapshots.find((snapshot) => snapshot.objectId === opportunity.id)!.id,
          payload: safeParseJson<Record<string, unknown>>(
            briefingSnapshots.find((snapshot) => snapshot.objectId === opportunity.id)!.content,
            {},
          ),
        }
      : null,
    dingtalkSignalSummary: (() => {
      const signals = dingtalkSignals.filter(
        (signal) => signal.opportunityId === opportunity.id,
      );
      const actions = dingtalkActionItems.filter(
        (action) => action.opportunityId === opportunity.id,
      );
      const byScope = signals.reduce<Record<string, number>>((acc, signal) => {
        const scope = signal.sourceScope.split(":")[1] ?? "UNKNOWN";
        acc[scope] = (acc[scope] ?? 0) + 1;
        return acc;
      }, {});
      const meetingLinkedWorkSignals = dingtalkMeetingLinkedWorkSignals
        .filter((signal) => signal.meeting?.opportunityId === opportunity.id)
        .map((signal) => ({
          id: signal.id,
          sourceId: signal.sourceId,
          sourceSummary: signal.sourceSummary,
          sourceScope: signal.sourceScope,
          sourceType: signal.sourceType,
          draftPayload: signal.draftPayload,
          createdAt: signal.createdAt,
        }));
      const directSignals = signals.map((signal) => ({
        id: signal.id,
        sourceId: signal.sourceId,
        sourceSummary: signal.sourceSummary,
        sourceScope: signal.sourceScope,
        sourceType: signal.sourceType,
        draftPayload: signal.draftPayload,
        createdAt: signal.createdAt,
      }));
      return {
        totalSignals: signals.length,
        byScope,
        convertedActionCount: actions.length,
        pendingApprovalCount: actions.filter((action) => action.requiresApproval && action.status === "PENDING_APPROVAL").length,
        recentSourceIds: signals.slice(0, 4).map((signal) => signal.sourceId),
        workProgress: buildDingTalkWorkProgressList(
          [...directSignals, ...meetingLinkedWorkSignals],
        ).slice(0, 4),
      };
    })(),
    attachments: attachmentEntries
      .filter((entry) => entry.opportunityId === opportunity.id)
      .map((entry) =>
        parseOpportunityAttachmentMemoryEntry({
          id: entry.id,
          title: entry.title,
          content: entry.content,
          createdAt: entry.createdAt,
        }),
      )
      .filter(
        (
          item,
        ): item is NonNullable<
          ReturnType<typeof parseOpportunityAttachmentMemoryEntry>
        > => Boolean(item),
      ),
  }));
}

export async function getWorkspaceDingTalkWorkProgress(workspaceId: string) {
  const records = await db.connectorIngestionRecord.findMany({
    where: {
      workspaceId,
      sourceScope: { in: ["WORKSPACE:WORK", "OBJECT:WORK"] },
      sourceType: { contains: "report" },
    },
    select: {
      id: true,
      sourceId: true,
      sourceSummary: true,
      sourceScope: true,
      sourceType: true,
      draftPayload: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return buildDingTalkWorkProgressList(
    records.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      sourceSummary: item.sourceSummary,
      sourceScope: item.sourceScope,
      sourceType: item.sourceType,
      draftPayload: item.draftPayload,
      createdAt: item.createdAt,
    })),
  ).slice(0, 8);
}
