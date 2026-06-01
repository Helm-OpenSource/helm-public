import { ActorType } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import {
  getMeetingConnectorIngestionRetrievalSummary,
  syncMeetingConnectorIngestionRetrievalRuntime,
} from "@/lib/helm-v2/connector-ingestion-retrieval-runtime";
import { getMeetingDraftCommsRuntimeSummary, runDraftCommsHandoffRuntime } from "@/lib/helm-v2/draft-comms-handoff-runtime";
import { getMeetingHumanActionExecutionSummary, syncMeetingHumanActionExecutionRuntime } from "@/lib/helm-v2/human-action-execution-runtime";
import { getMeetingRuntimeSummary, ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import {
  getMeetingOfficialWriteRuntimeSummary,
  syncMeetingOfficialFollowThroughRuntime,
  syncMeetingLimitedAutoIntents,
  syncMeetingOfficialWriteIntents,
} from "@/lib/helm-v2/official-system-integration-runtime";
import { getMeetingOpportunityJudgeRuntimeSummary, runOpportunityJudgeRuntime } from "@/lib/helm-v2/opportunity-judge-runtime";
import { generateMeetingBriefingSnapshot } from "@/lib/memory/briefing.service";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { buildMemoryFactRetrievalPack } from "@/lib/memory/retrieval-pack-adapter";
import { safeParseJson } from "@/lib/utils";
import { buildDingTalkWorkProgressList } from "@/lib/connectors/dingtalk-work-progress";

export async function getMeetingDetailData(workspaceId: string, meetingId: string) {
  const meeting = await db.meeting.findFirst({
    where: {
      workspaceId,
      id: meetingId,
    },
    include: {
      company: true,
      owner: true,
      opportunity: {
        include: {
          contacts: true,
          company: true,
        },
      },
      contacts: true,
      note: true,
      actionItems: {
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        include: {
          approvalTask: true,
          contact: true,
          owner: true,
        },
      },
      memoryEntries: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!meeting) return null;

  const meetingScopedFacts = await db.memoryFact.count({
    where: {
      workspaceId,
      sourceType: "MEETING_NOTE",
      sourceId: meetingId,
    },
  });

  if (meeting.note && meetingScopedFacts === 0) {
    await processMeetingMemory({
      workspaceId,
      actorName: "系统",
      actorType: ActorType.SYSTEM,
      sourcePage: `/meetings/${meetingId}`,
      meetingId,
    }).catch(() => null);
  }

  const meetingScopedRuntimeEvents = await db.runtimeEvent.count({
    where: {
      workspaceId,
      meetingId,
      eventType: "meeting.ended",
    },
  });

  if (meeting.note && meetingScopedRuntimeEvents === 0) {
    await ingestMeetingEndedRuntime({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);
  }

  const [candidateMemoryFacts, commitments, blockers, briefingSnapshot, meetingRuntime, dingtalkSignals, workspaceWorkSignals] = await Promise.all([
    db.memoryFact.findMany({
      where: {
        workspaceId,
        OR: [
          { objectType: "MEETING" as const, objectId: meetingId },
          ...(meeting.opportunityId ? [{ objectType: "OPPORTUNITY" as const, objectId: meeting.opportunityId }] : []),
          ...(meeting.companyId ? [{ objectType: "COMPANY" as const, objectId: meeting.companyId }] : []),
          ...meeting.contacts.map((contact) => ({ objectType: "CONTACT" as const, objectId: contact.id })),
        ],
        status: { in: ["ACTIVE", "OBSERVED"] },
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 32,
    }),
    db.commitment.findMany({
      where: {
        workspaceId,
        relatedMeetingId: meetingId,
      },
      include: {
        relatedContact: true,
        relatedCompany: true,
        relatedOpportunity: true,
        ownerUser: true,
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    db.blocker.findMany({
      where: {
        workspaceId,
        relatedMeetingId: meetingId,
      },
      include: {
        relatedContact: true,
        relatedCompany: true,
        relatedOpportunity: true,
      },
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    }),
    generateMeetingBriefingSnapshot({
      workspaceId,
      actorName: "系统",
      actorType: ActorType.SYSTEM,
      sourcePage: `/meetings/${meetingId}`,
      meetingId,
    }).catch(() => null),
    getMeetingRuntimeSummary(workspaceId, meetingId),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        meetingId,
        sourceScope: { startsWith: "OBJECT:" },
      },
      select: {
        id: true,
        sourceScope: true,
        sourceType: true,
        sourceId: true,
        sourceSummary: true,
        draftPayload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        sourceScope: { in: ["WORKSPACE:WORK", "OBJECT:WORK"] },
        sourceType: { contains: "report" },
      },
      select: {
        id: true,
        sourceScope: true,
        sourceType: true,
        sourceId: true,
        sourceSummary: true,
        draftPayload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const memoryRetrievalPack = buildMemoryFactRetrievalPack({
    surface: "meeting_detail",
    objectType: "MEETING",
    objectId: meetingId,
    facts: candidateMemoryFacts,
  });
  const memoryFacts = memoryRetrievalPack.selectedFacts;

  let meetingOpportunityJudgeRuntime = await getMeetingOpportunityJudgeRuntimeSummary(workspaceId, meetingId).catch(() => null);

  if (meetingRuntime?.artifactReview?.status === "CONFIRMED" && meeting.opportunityId && !meetingOpportunityJudgeRuntime) {
    await runOpportunityJudgeRuntime({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);

    meetingOpportunityJudgeRuntime = await getMeetingOpportunityJudgeRuntimeSummary(workspaceId, meetingId).catch(() => null);
  }

  let meetingDraftCommsRuntime = await getMeetingDraftCommsRuntimeSummary(workspaceId, meetingId);

  if (meetingRuntime?.artifactReview?.status === "CONFIRMED" && !meetingDraftCommsRuntime) {
    await runDraftCommsHandoffRuntime({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);

    meetingDraftCommsRuntime = await getMeetingDraftCommsRuntimeSummary(workspaceId, meetingId).catch(() => null);
  }

  let meetingHumanActionExecutionRuntime = await getMeetingHumanActionExecutionSummary(workspaceId, meetingId).catch(() => null);

  const hasApprovedDraftSource =
    meetingDraftCommsRuntime?.artifactReview?.status === "CONFIRMED" &&
    (meetingDraftCommsRuntime.bundle?.reviewStatus === "approved_for_manual_handoff" ||
      meetingDraftCommsRuntime.bundle?.reviewStatus === "fallback_non_commitment");
  const hasApprovedShadowSource =
    meetingOpportunityJudgeRuntime?.artifactReview?.status === "CONFIRMED" &&
    meetingOpportunityJudgeRuntime.bundle?.reviewStatus === "approved_for_shadow_consume";

  if (!meetingHumanActionExecutionRuntime && (hasApprovedDraftSource || hasApprovedShadowSource)) {
    await syncMeetingHumanActionExecutionRuntime({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);

    meetingHumanActionExecutionRuntime = await getMeetingHumanActionExecutionSummary(workspaceId, meetingId).catch(() => null);
  }

  let meetingOfficialWriteRuntime = await getMeetingOfficialWriteRuntimeSummary(workspaceId, meetingId).catch(() => null);

  const hasAcknowledgedExecutionProof =
    meetingHumanActionExecutionRuntime?.actions.some(
      (item) => item.status === "EXECUTED" && item.executionAcknowledgementStatus === "ACKNOWLEDGED",
    ) ?? false;

  if (hasApprovedShadowSource || hasAcknowledgedExecutionProof) {
    await syncMeetingOfficialWriteIntents({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);

    meetingOfficialWriteRuntime = await getMeetingOfficialWriteRuntimeSummary(workspaceId, meetingId).catch(() => null);
  }

  const hasApprovedGuardedWriteIntent =
    meetingOfficialWriteRuntime?.intents.some((item) => item.writeApprovalStatus === "APPROVED") ?? false;

  if (hasApprovedGuardedWriteIntent) {
    await syncMeetingLimitedAutoIntents({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);

    meetingOfficialWriteRuntime = await getMeetingOfficialWriteRuntimeSummary(workspaceId, meetingId).catch(() => null);
  }

  const hasOfficialFollowThroughSource =
    (meetingOfficialWriteRuntime?.intents.some((item) => item.writeAcknowledgementStatus !== "PENDING") ?? false) ||
    (meetingOfficialWriteRuntime?.limitedAuto?.intents.some((item) => item.limitedAutoApprovalStatus === "MANUAL_OVERRIDE") ?? false);

  if (hasOfficialFollowThroughSource && !meetingOfficialWriteRuntime?.followThrough) {
    await syncMeetingOfficialFollowThroughRuntime({
      workspaceId,
      meetingId,
      actorName: "系统",
      sourcePage: `/meetings/${meetingId}`,
      force: false,
    }).catch(() => null);

    meetingOfficialWriteRuntime = await getMeetingOfficialWriteRuntimeSummary(workspaceId, meetingId).catch(() => null);
  }

  await syncMeetingConnectorIngestionRetrievalRuntime({
    workspaceId,
    meetingId,
  }).catch(() => null);

  const meetingIngestionRetrievalRuntime = await getMeetingConnectorIngestionRetrievalSummary(workspaceId, meetingId).catch(() => null);

  return {
    ...meeting,
    memoryFacts,
    memoryRetrievalPack: memoryRetrievalPack.trace,
    commitments,
    blockers,
    meetingRuntime,
    meetingOpportunityJudgeRuntime,
    meetingDraftCommsRuntime,
    meetingHumanActionExecutionRuntime,
    meetingOfficialWriteRuntime,
    meetingIngestionRetrievalRuntime,
    briefingSnapshot: briefingSnapshot?.snapshot
      ? {
          ...briefingSnapshot.snapshot,
          payload: briefingSnapshot.payload,
        }
      : null,
    dingtalkSignalSummary: {
      total: dingtalkSignals.length,
      byScope: dingtalkSignals.reduce<Record<string, number>>((acc, item) => {
        const scope = item.sourceScope.split(":")[1] ?? "UNKNOWN";
        acc[scope] = (acc[scope] ?? 0) + 1;
        return acc;
      }, {}),
      items: dingtalkSignals.slice(0, 6).map((item) => {
        const parsedDraft = safeParseJson<Record<string, unknown> | null>(
          item.draftPayload,
          null,
        );
        const classification =
          parsedDraft && typeof parsedDraft.classification === "object"
            ? (parsedDraft.classification as Record<string, unknown>)
            : null;
        return {
          id: item.id,
          scope: item.sourceScope.split(":")[1] ?? "UNKNOWN",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          summary: item.sourceSummary,
          flowModule:
            classification && typeof classification.flowModule === "string"
              ? classification.flowModule
              : "unknown",
          businessDomain:
            classification && typeof classification.businessDomain === "string"
              ? classification.businessDomain
              : "unknown",
          createdAt: item.createdAt,
        };
      }),
    },
    dingtalkWorkProgress: (() => {
      const linkedReports = buildDingTalkWorkProgressList(
        dingtalkSignals.map((item) => ({
          id: item.id,
          sourceId: item.sourceId,
          sourceSummary: item.sourceSummary,
          sourceScope: item.sourceScope,
          sourceType: item.sourceType,
          draftPayload: item.draftPayload,
          createdAt: item.createdAt,
        })),
      );
      if (linkedReports.length > 0) {
        return linkedReports.slice(0, 6);
      }
      return buildDingTalkWorkProgressList(
        workspaceWorkSignals.map((item) => ({
          id: item.id,
          sourceId: item.sourceId,
          sourceSummary: item.sourceSummary,
          sourceScope: item.sourceScope,
          sourceType: item.sourceType,
          draftPayload: item.draftPayload,
          createdAt: item.createdAt,
        })),
      ).slice(0, 6);
    })(),
  };
}

export async function getMeetingsOverviewData(workspaceId: string) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const signalWindowStart = new Date();
  signalWindowStart.setDate(signalWindowStart.getDate() - 7);

  const [meetings, dingtalkSignalCounts, dingtalkWorkRecords, workspaceWorkRecords] = await Promise.all([
    db.meeting.findMany({
      where: { workspaceId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
            stage: true,
            riskLevel: true,
          },
        },
        contacts: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
          take: 4,
        },
        note: {
          select: {
            id: true,
            summary: true,
            keyDecisions: true,
            confirmations: true,
          },
        },
        actionItems: {
          where: {
            status: {
              in: ["SUGGESTED", "PENDING_APPROVAL", "APPROVED", "MANUAL", "BLOCKED"],
            },
          },
          select: {
            id: true,
            status: true,
            executionMode: true,
          },
        },
        commitments: {
          where: {
            status: {
              in: ["OPEN", "IN_PROGRESS"],
            },
          },
          select: {
            id: true,
            overdueFlag: true,
          },
        },
        blockers: {
          where: {
            status: {
              in: ["OPEN", "MONITORING"],
            },
          },
          select: {
            id: true,
            severity: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }],
    }),
    db.connectorIngestionRecord.groupBy({
      by: ["meetingId"],
      where: {
        workspaceId,
        meetingId: { not: null },
        sourceScope: { startsWith: "OBJECT:" },
        boundaryNote: { contains: "DingTalk" },
        createdAt: { gte: signalWindowStart },
      },
      _count: { _all: true },
    }),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        meetingId: { not: null },
        sourceScope: "OBJECT:WORK",
        sourceType: { contains: "report" },
        createdAt: { gte: signalWindowStart },
      },
      select: {
        id: true,
        meetingId: true,
        sourceId: true,
        sourceScope: true,
        sourceType: true,
        sourceSummary: true,
        draftPayload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        sourceScope: { in: ["WORKSPACE:WORK", "OBJECT:WORK"] },
        sourceType: { contains: "report" },
      },
      select: {
        id: true,
        sourceId: true,
        sourceScope: true,
        sourceType: true,
        sourceSummary: true,
        draftPayload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);
  const dingtalkSignalCountByMeetingId = new Map(
    dingtalkSignalCounts
      .filter((item): item is { meetingId: string; _count: { _all: number } } => Boolean(item.meetingId))
      .map((item) => [item.meetingId, item._count._all] as const),
  );
  const latestWorkProgressByMeetingId = new Map<
    string,
    ReturnType<typeof buildDingTalkWorkProgressList>[number]
  >();
  for (const row of dingtalkWorkRecords) {
    if (!row.meetingId || latestWorkProgressByMeetingId.has(row.meetingId)) {
      continue;
    }
    const parsed = buildDingTalkWorkProgressList([
      {
        id: row.id,
        sourceId: row.sourceId,
        sourceSummary: row.sourceSummary,
        sourceScope: row.sourceScope,
        sourceType: row.sourceType,
        draftPayload: row.draftPayload,
        createdAt: row.createdAt,
      },
    ])[0];
    if (parsed) {
      latestWorkProgressByMeetingId.set(row.meetingId, parsed);
    }
  }

  const meetingsWithSignals = meetings.map((meeting) => ({
    ...meeting,
    dingtalkSignalCount: dingtalkSignalCountByMeetingId.get(meeting.id) ?? 0,
    dingtalkLatestWorkProgress: latestWorkProgressByMeetingId.get(meeting.id) ?? null,
  }));

  const todayMeetings = meetingsWithSignals.filter((meeting) => meeting.startsAt >= dayStart && meeting.startsAt <= dayEnd);
  const upcomingMeetings = meetingsWithSignals.filter((meeting) => meeting.startsAt > now);
  const pastMeetings = meetingsWithSignals
    .filter((meeting) => meeting.startsAt < now)
    .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());

  return {
    summary: {
      total: meetings.length,
      today: todayMeetings.length,
      upcoming: upcomingMeetings.length,
      withNote: meetings.filter((meeting) => meeting.note).length,
      withOpenFollowUp: meetings.filter((meeting) => meeting.actionItems.length > 0 || meeting.commitments.length > 0 || meeting.blockers.length > 0).length,
    },
    todayMeetings: todayMeetings.slice(0, 8),
    upcomingMeetings: upcomingMeetings.slice(0, 12),
    pastMeetings: pastMeetings.slice(0, 12),
    workspaceDingTalkWorkProgress: buildDingTalkWorkProgressList(
      workspaceWorkRecords.map((item) => ({
        id: item.id,
        sourceId: item.sourceId,
        sourceSummary: item.sourceSummary,
        sourceScope: item.sourceScope,
        sourceType: item.sourceType,
        draftPayload: item.draftPayload,
        createdAt: item.createdAt,
      })),
    ).slice(0, 6),
  };
}
