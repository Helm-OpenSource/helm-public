import {
  ActorType,
  CaptureProcessingStatus,
  CaptureSessionStatus,
  ConversationInsightType,
  MeetingStatus,
  ObjectType,
  OpportunityStage,
  OpportunityType,
  RiskLevel,
} from "@prisma/client";
import { addMinutes } from "date-fns";
import { generatePostMeetingActionSuggestions } from "@/lib/ai";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { createConversationActions } from "@/lib/conversation-capture/conversation-action-bridge.service";
import {
  buildNoReplyConsequence,
  extractConversationRiskDrafts,
} from "@/lib/conversation-capture/conversation-risk.service";
import { generateConversationTranscript } from "@/lib/conversation-capture/transcription.service";
import { extractMeetingBlockerDrafts } from "@/lib/memory/blocker-extraction.service";
import { extractMeetingCommitmentDrafts } from "@/lib/memory/commitment-extraction.service";
import { extractMeetingFactDrafts } from "@/lib/memory/fact-extraction.service";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { type MemoryActorContext } from "@/lib/memory/shared";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import { jsonStringify } from "@/lib/utils";

type CaptureContext = {
  objectType?: ObjectType | null;
  objectId?: string | null;
  objectLabel?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  opportunityId?: string | null;
  opportunityTitle?: string | null;
  opportunityType?: OpportunityType | null;
  opportunityRiskLevel?: RiskLevel | null;
  ownerId?: string | null;
  meetingId?: string | null;
  meetingTitle?: string | null;
  contacts: Array<{ id: string; name: string; title?: string | null }>;
};

type ProcessCaptureInput = MemoryActorContext & {
  captureSessionId: string;
  transcriptText?: string | null;
  audioFile?: File | null;
  transcriptSegments?: Array<{
    speaker: string;
    startedAt: number;
    endedAt: number;
    text: string;
  }> | null;
  transcriptLanguage?: string | null;
  transcriptConfidence?: number | null;
  transcriptProvider?: string | null;
  transcriptModel?: string | null;
};

function trimTitle(value: string, max = 24) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function findSourceSegmentIndexes(lines: string[], text: string) {
  const keywords = text
    .replace(/[，。！？、,.!?:：]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 2)
    .slice(0, 6);

  return lines
    .map((line, index) => ({
      index,
      score: keywords.reduce(
        (sum, keyword) => sum + (line.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.index);
}

function dedupeLines(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function buildRecommendationRefreshRefs(input: {
  context: CaptureContext;
  meetingId: string;
}) {
  const refs = [
    { objectType: ObjectType.MEETING, objectId: input.meetingId },
    ...(input.context.contactId
      ? [{ objectType: ObjectType.CONTACT, objectId: input.context.contactId }]
      : []),
    ...(input.context.companyId
      ? [{ objectType: ObjectType.COMPANY, objectId: input.context.companyId }]
      : []),
    ...(input.context.opportunityId
      ? [
          {
            objectType: ObjectType.OPPORTUNITY,
            objectId: input.context.opportunityId,
          },
        ]
      : []),
  ];

  return refs.filter(
    (item, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.objectType === item.objectType &&
          candidate.objectId === item.objectId,
      ) === index,
  );
}

async function refreshRecommendationsForCapture(
  input: MemoryActorContext & { context: CaptureContext; meetingId: string },
) {
  const refs = buildRecommendationRefreshRefs({
    context: input.context,
    meetingId: input.meetingId,
  });

  const labelMap = new Map<string, string>();
  labelMap.set(
    `${ObjectType.MEETING}:${input.meetingId}`,
    input.context.meetingTitle ?? input.context.objectLabel ?? "现场记录会议",
  );
  if (input.context.contactId) {
    labelMap.set(
      `${ObjectType.CONTACT}:${input.context.contactId}`,
      input.context.contactName ?? "联系人",
    );
  }
  if (input.context.companyId) {
    labelMap.set(
      `${ObjectType.COMPANY}:${input.context.companyId}`,
      input.context.companyName ?? "公司",
    );
  }
  if (input.context.opportunityId) {
    labelMap.set(
      `${ObjectType.OPPORTUNITY}:${input.context.opportunityId}`,
      input.context.opportunityTitle ?? "机会",
    );
  }

  const settled = await Promise.allSettled(
    refs.map(async (ref) => {
      const recommendations = await generateRecommendationsForObject({
        workspaceId: input.workspaceId,
        actorName: input.actorName,
        actorUserId: input.actorUserId,
        actorType: input.actorType ?? ActorType.SYSTEM,
        sourcePage: input.sourcePage,
        objectType: ref.objectType,
        objectId: ref.objectId,
        limit: ref.objectType === ObjectType.MEETING ? 2 : 3,
        persist: true,
        captureTelemetry: true,
      });

      return {
        objectType: ref.objectType,
        objectId: ref.objectId,
        objectLabel:
          labelMap.get(`${ref.objectType}:${ref.objectId}`) ??
          `${ref.objectType}:${ref.objectId}`,
        recommendations: recommendations.slice(0, 2),
      };
    }),
  );

  return settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

async function resolveCaptureContext(
  workspaceId: string,
  objectType?: ObjectType | null,
  objectId?: string | null,
): Promise<CaptureContext> {
  if (!objectType || !objectId) {
    return { objectType, objectId, objectLabel: null, contacts: [] };
  }

  if (objectType === ObjectType.CONTACT) {
    const contact = await db.contact.findFirst({
      where: { workspaceId, id: objectId },
      include: {
        company: true,
        opportunities: {
          where: {
            stage: {
              notIn: ["DONE", "LOST"],
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
        },
      },
    });

    return {
      objectType,
      objectId,
      objectLabel: contact?.name ?? "联系人现场记录",
      companyId: contact?.companyId ?? null,
      companyName: contact?.company?.name ?? null,
      contactId: contact?.id ?? null,
      contactName: contact?.name ?? null,
      opportunityId: contact?.opportunities[0]?.id ?? null,
      opportunityTitle: contact?.opportunities[0]?.title ?? null,
      opportunityType: contact?.opportunities[0]?.type ?? null,
      opportunityRiskLevel: contact?.opportunities[0]?.riskLevel ?? null,
      ownerId: contact?.ownerId ?? contact?.opportunities[0]?.ownerId ?? null,
      contacts: contact
        ? [{ id: contact.id, name: contact.name, title: contact.title }]
        : [],
    };
  }

  if (objectType === ObjectType.COMPANY) {
    const company = await db.company.findFirst({
      where: { workspaceId, id: objectId },
      include: {
        contacts: {
          orderBy: [{ lastInteractionAt: "desc" }, { createdAt: "asc" }],
          take: 3,
        },
        opportunities: {
          where: {
            stage: {
              notIn: ["DONE", "LOST"],
            },
          },
          orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
          take: 1,
        },
      },
    });

    return {
      objectType,
      objectId,
      objectLabel: company?.name ?? "公司现场记录",
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      contactId: company?.contacts[0]?.id ?? null,
      contactName: company?.contacts[0]?.name ?? null,
      opportunityId: company?.opportunities[0]?.id ?? null,
      opportunityTitle: company?.opportunities[0]?.title ?? null,
      opportunityType: company?.opportunities[0]?.type ?? null,
      opportunityRiskLevel: company?.opportunities[0]?.riskLevel ?? null,
      ownerId:
        company?.opportunities[0]?.ownerId ??
        company?.contacts[0]?.ownerId ??
        null,
      contacts:
        company?.contacts.map((item) => ({
          id: item.id,
          name: item.name,
          title: item.title,
        })) ?? [],
    };
  }

  if (objectType === ObjectType.OPPORTUNITY) {
    const opportunity = await db.opportunity.findFirst({
      where: { workspaceId, id: objectId },
      include: {
        company: true,
        contacts: true,
      },
    });

    return {
      objectType,
      objectId,
      objectLabel: opportunity?.title ?? "机会现场记录",
      companyId: opportunity?.companyId ?? null,
      companyName: opportunity?.company?.name ?? null,
      contactId: opportunity?.contacts[0]?.id ?? null,
      contactName: opportunity?.contacts[0]?.name ?? null,
      opportunityId: opportunity?.id ?? null,
      opportunityTitle: opportunity?.title ?? null,
      opportunityType: opportunity?.type ?? null,
      opportunityRiskLevel: opportunity?.riskLevel ?? null,
      ownerId: opportunity?.ownerId ?? null,
      contacts:
        opportunity?.contacts.map((item) => ({
          id: item.id,
          name: item.name,
          title: item.title,
        })) ?? [],
    };
  }

  if (objectType === ObjectType.MEETING) {
    const meeting = await db.meeting.findFirst({
      where: { workspaceId, id: objectId },
      include: {
        company: true,
        opportunity: true,
        contacts: true,
      },
    });

    return {
      objectType,
      objectId,
      objectLabel: meeting?.title ?? "会议现场记录",
      companyId: meeting?.companyId ?? null,
      companyName: meeting?.company?.name ?? null,
      contactId: meeting?.contacts[0]?.id ?? null,
      contactName: meeting?.contacts[0]?.name ?? null,
      opportunityId: meeting?.opportunityId ?? null,
      opportunityTitle: meeting?.opportunity?.title ?? null,
      opportunityType: meeting?.opportunity?.type ?? null,
      opportunityRiskLevel: meeting?.opportunity?.riskLevel ?? null,
      ownerId: meeting?.ownerId ?? meeting?.opportunity?.ownerId ?? null,
      meetingId: meeting?.id ?? null,
      meetingTitle: meeting?.title ?? null,
      contacts:
        meeting?.contacts.map((item) => ({
          id: item.id,
          name: item.name,
          title: item.title,
        })) ?? [],
    };
  }

  return { objectType, objectId, objectLabel: null, contacts: [] };
}

async function ensureMeetingForCapture(input: {
  workspaceId: string;
  sessionId: string;
  title?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  context: CaptureContext;
}) {
  if (input.context.meetingId) {
    const meeting = await db.meeting.update({
      where: { id: input.context.meetingId },
      data: {
        status: MeetingStatus.COMPLETED,
        endsAt: input.endedAt ?? addMinutes(input.startedAt, 30),
        companyId: input.context.companyId ?? undefined,
        opportunityId: input.context.opportunityId ?? undefined,
      },
      include: {
        contacts: true,
        company: true,
        opportunity: true,
        note: true,
      },
    });

    if (
      input.context.contactId &&
      !meeting.contacts.some(
        (contact) => contact.id === input.context.contactId,
      )
    ) {
      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          contacts: {
            connect: {
              id: input.context.contactId,
            },
          },
        },
      });
    }

    return meeting.id;
  }

  const created = await db.meeting.create({
    data: {
      workspaceId: input.workspaceId,
      companyId: input.context.companyId ?? undefined,
      opportunityId: input.context.opportunityId ?? undefined,
      ownerId: input.context.ownerId ?? undefined,
      title: input.title ?? input.context.objectLabel ?? "现场记录",
      agenda: "由现场记录自动生成的会话理解与后续推进。",
      location: "会话捕获",
      status: MeetingStatus.COMPLETED,
      startsAt: input.startedAt,
      endsAt: input.endedAt ?? addMinutes(input.startedAt, 30),
      contacts: input.context.contacts.length
        ? {
            connect: input.context.contacts.map((contact) => ({
              id: contact.id,
            })),
          }
        : undefined,
    },
  });

  return created.id;
}

function buildMeetingNoteDraft(input: {
  sessionTitle?: string | null;
  context: CaptureContext;
  lines: string[];
}) {
  const decisionLines = input.lines.filter((line) =>
    /支持|认可|倾向|更关心|希望|优先|拍板|决定|确认方案|愿意继续/.test(line),
  );
  const commitmentLines = input.lines.filter((line) =>
    /发送|安排|同步|确认|回复|跟进|完成|发出|推进|提供|提交|下周|本周|48小时|24小时/.test(
      line,
    ),
  );
  const blockerLines = input.lines.filter((line) =>
    /预算|财务|付款|薪资|顾虑|犹豫|冲突|资源|排期|法务|等待|卡住|稳定性|没拍板/.test(
      line,
    ),
  );
  const riskDrafts = extractConversationRiskDrafts(input.lines);

  const summary = dedupeLines([
    decisionLines[0] ? `关键结论：${decisionLines[0]}` : null,
    blockerLines[0] ? `当前卡点：${blockerLines[0]}` : null,
    commitmentLines[0] ? `下一步：${commitmentLines[0]}` : null,
  ]).join(" ");

  const recommendedQuestions = dedupeLines([
    blockerLines[0]
      ? `如果今天只能解决一个卡点，${blockerLines[0]} 何时能收口？`
      : null,
    commitmentLines[0]
      ? `这项承诺“${commitmentLines[0]}”的责任人和时间点是否已确认？`
      : null,
    "如果本周必须推进一步，最值得先做的动作是什么？",
  ]).join("\n");

  const riskAlerts = dedupeLines([
    ...riskDrafts.map((item) => item.title),
    blockerLines[0] ? `当前需要优先处理：${blockerLines[0]}` : null,
  ]).join("\n");

  const relationshipSummary =
    decisionLines[0] ??
    `${input.context.contactName ?? input.context.companyName ?? "对方"} 已表达出继续推进意愿，但仍需要把关键约束收口。`;

  const meetingGoal =
    input.sessionTitle ??
    input.context.opportunityTitle ??
    input.context.objectLabel ??
    "收口本次交流中的关键判断、阻塞和后续动作。";

  return {
    attendeesSummary: input.context.contacts.length
      ? input.context.contacts
          .map(
            (contact) =>
              `${contact.name}${contact.title ? ` · ${contact.title}` : ""}`,
          )
          .join("、")
      : (input.context.companyName ?? "稍后归类"),
    relationshipSummary,
    previousConclusion: decisionLines[0] ?? null,
    meetingGoal,
    recommendedQuestions,
    riskAlerts,
    liveTranscript: input.lines.join("\n"),
    summary: summary || input.lines.slice(0, 2).join(" "),
    keyDecisions: decisionLines.slice(0, 3).join("\n") || null,
    confirmations: commitmentLines.slice(0, 4).join("\n") || null,
    candidateActions: dedupeLines([
      ...generatePostMeetingActionSuggestions({
        opportunity: input.context.opportunityType
          ? {
              type: input.context.opportunityType,
              stage: OpportunityStage.ADVANCING,
              riskLevel: input.context.opportunityRiskLevel ?? RiskLevel.MEDIUM,
              nextAction: null,
            }
          : null,
        note: {
          confirmations: commitmentLines.slice(0, 4).join("\n"),
          relationshipSummary,
          riskAlerts,
        },
      }),
      blockerLines[0] ? `优先处理阻塞：${blockerLines[0]}` : null,
    ]).slice(0, 5),
    riskDrafts,
  };
}

async function upsertConversationInsights(input: {
  workspaceId: string;
  captureSessionId: string;
  lines: string[];
  meetingId: string;
  context: CaptureContext;
  noteDraft: ReturnType<typeof buildMeetingNoteDraft>;
}) {
  const factDrafts = extractMeetingFactDrafts({
    workspaceId: input.workspaceId,
    actorName: "Helm AI",
    meeting: {
      id: input.meetingId,
      title: input.noteDraft.meetingGoal,
      startsAt: new Date(),
      companyId: input.context.companyId ?? null,
      opportunityId: input.context.opportunityId ?? null,
      contacts: input.context.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
      })),
      note: {
        relationshipSummary: input.noteDraft.relationshipSummary,
        previousConclusion: input.noteDraft.previousConclusion,
        meetingGoal: input.noteDraft.meetingGoal,
        recommendedQuestions: input.noteDraft.recommendedQuestions,
        riskAlerts: input.noteDraft.riskAlerts,
        summary: input.noteDraft.summary,
        keyDecisions: input.noteDraft.keyDecisions,
        confirmations: input.noteDraft.confirmations,
        liveTranscript: input.noteDraft.liveTranscript,
      },
    },
  });
  const commitmentDrafts = extractMeetingCommitmentDrafts({
    workspaceId: input.workspaceId,
    actorName: "Helm AI",
    meeting: {
      id: input.meetingId,
      startsAt: new Date(),
      companyId: input.context.companyId ?? null,
      opportunityId: input.context.opportunityId ?? null,
      ownerId: input.context.ownerId ?? null,
      contacts: input.context.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
      })),
      note: {
        confirmations: input.noteDraft.confirmations,
        summary: input.noteDraft.summary,
        keyDecisions: input.noteDraft.keyDecisions,
        liveTranscript: input.noteDraft.liveTranscript,
      },
    },
  });
  const blockerDrafts = extractMeetingBlockerDrafts({
    workspaceId: input.workspaceId,
    actorName: "Helm AI",
    meeting: {
      id: input.meetingId,
      opportunityId: input.context.opportunityId ?? null,
      companyId: input.context.companyId ?? null,
      contacts: input.context.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
      })),
      note: {
        riskAlerts: input.noteDraft.riskAlerts,
        summary: input.noteDraft.summary,
        keyDecisions: input.noteDraft.keyDecisions,
        relationshipSummary: input.noteDraft.relationshipSummary,
        liveTranscript: input.noteDraft.liveTranscript,
      },
    },
  });

  await db.conversationInsight.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
    },
  });

  const insightRows = [
    ...factDrafts.slice(0, 6).map((draft) => ({
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
      insightType: ConversationInsightType.FACT,
      title: draft.title,
      content: draft.content,
      confidence: draft.confidence ?? 70,
      relatedContactId: input.context.contactId ?? undefined,
      relatedCompanyId: input.context.companyId ?? undefined,
      relatedOpportunityId: input.context.opportunityId ?? undefined,
      relatedMeetingId: input.meetingId,
      sourceSegmentRefs: jsonStringify(
        findSourceSegmentIndexes(input.lines, draft.content),
      ),
    })),
    ...commitmentDrafts.slice(0, 5).map((draft) => ({
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
      insightType: ConversationInsightType.COMMITMENT,
      title: draft.title,
      content: draft.commitmentText,
      confidence: draft.confidence ?? 72,
      relatedContactId: input.context.contactId ?? undefined,
      relatedCompanyId: input.context.companyId ?? undefined,
      relatedOpportunityId: input.context.opportunityId ?? undefined,
      relatedMeetingId: input.meetingId,
      sourceSegmentRefs: jsonStringify(
        findSourceSegmentIndexes(input.lines, draft.commitmentText),
      ),
    })),
    ...blockerDrafts.slice(0, 5).map((draft) => ({
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
      insightType: ConversationInsightType.BLOCKER,
      title: draft.title,
      content: draft.blockerText,
      confidence: Math.max(68, Math.min(95, draft.severity)),
      relatedContactId: input.context.contactId ?? undefined,
      relatedCompanyId: input.context.companyId ?? undefined,
      relatedOpportunityId: input.context.opportunityId ?? undefined,
      relatedMeetingId: input.meetingId,
      sourceSegmentRefs: jsonStringify(
        findSourceSegmentIndexes(input.lines, draft.blockerText),
      ),
    })),
    ...input.noteDraft.riskDrafts.slice(0, 4).map((draft) => ({
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
      insightType: ConversationInsightType.RISK,
      title: draft.title,
      content: draft.content,
      confidence: draft.severity,
      relatedContactId: input.context.contactId ?? undefined,
      relatedCompanyId: input.context.companyId ?? undefined,
      relatedOpportunityId: input.context.opportunityId ?? undefined,
      relatedMeetingId: input.meetingId,
      sourceSegmentRefs: jsonStringify(draft.sourceSegmentIndexes),
    })),
    ...input.noteDraft.candidateActions.slice(0, 5).map((actionTitle) => ({
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
      insightType: ConversationInsightType.NEXT_ACTION,
      title: trimTitle(actionTitle),
      content: actionTitle,
      confidence: 74,
      relatedContactId: input.context.contactId ?? undefined,
      relatedCompanyId: input.context.companyId ?? undefined,
      relatedOpportunityId: input.context.opportunityId ?? undefined,
      relatedMeetingId: input.meetingId,
      sourceSegmentRefs: jsonStringify(
        findSourceSegmentIndexes(input.lines, actionTitle),
      ),
    })),
  ];

  if (!insightRows.length) {
    return [];
  }

  await db.conversationInsight.createMany({
    data: insightRows,
  });

  return db.conversationInsight.findMany({
    where: {
      workspaceId: input.workspaceId,
      captureSessionId: input.captureSessionId,
    },
    orderBy: [{ insightType: "asc" }, { createdAt: "asc" }],
  });
}

export async function processConversationCapture(input: ProcessCaptureInput) {
  const session = await db.captureSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.captureSessionId,
    },
  });

  if (!session) {
    throw new Error("未找到对应现场记录");
  }

  const context = await resolveCaptureContext(
    input.workspaceId,
    session.objectType,
    session.objectId,
  );

  await db.captureSession.update({
    where: { id: session.id },
    data: {
      status: CaptureSessionStatus.PROCESSING,
      transcriptStatus: CaptureProcessingStatus.RUNNING,
      processingStatus: CaptureProcessingStatus.RUNNING,
      errorMessage: null,
    },
  });

  try {
    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "capture_processing_started",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: {
        hasAudioFile: Boolean(input.audioFile),
        hasTranscriptDraft: Boolean(input.transcriptText?.trim()),
        objectType: session.objectType,
        objectId: session.objectId,
      },
      sourcePage: input.sourcePage,
    });

    const meetingId = await ensureMeetingForCapture({
      workspaceId: input.workspaceId,
      sessionId: session.id,
      title: session.title,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      context,
    });

    const { transcript, lines } = await generateConversationTranscript({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      sourcePage: input.sourcePage,
      session,
      transcriptText: input.transcriptText,
      audioFile: input.audioFile,
      transcriptSegments: input.transcriptSegments,
      transcriptLanguage: input.transcriptLanguage,
      transcriptConfidence: input.transcriptConfidence,
      transcriptProvider: input.transcriptProvider,
      transcriptModel: input.transcriptModel,
      context,
    });

    const noteDraft = buildMeetingNoteDraft({
      sessionTitle: session.title,
      context,
      lines,
    });

    await db.meetingNote.upsert({
      where: {
        meetingId,
      },
      create: {
        workspaceId: input.workspaceId,
        meetingId,
        attendeesSummary: noteDraft.attendeesSummary,
        relationshipSummary: noteDraft.relationshipSummary,
        previousConclusion: noteDraft.previousConclusion,
        meetingGoal: noteDraft.meetingGoal,
        recommendedQuestions: noteDraft.recommendedQuestions,
        riskAlerts: noteDraft.riskAlerts,
        liveTranscript: noteDraft.liveTranscript,
        summary: noteDraft.summary,
        keyDecisions: noteDraft.keyDecisions,
        confirmations: noteDraft.confirmations,
      },
      update: {
        attendeesSummary: noteDraft.attendeesSummary,
        relationshipSummary: noteDraft.relationshipSummary,
        previousConclusion: noteDraft.previousConclusion,
        meetingGoal: noteDraft.meetingGoal,
        recommendedQuestions: noteDraft.recommendedQuestions,
        riskAlerts: noteDraft.riskAlerts,
        liveTranscript: noteDraft.liveTranscript,
        summary: noteDraft.summary,
        keyDecisions: noteDraft.keyDecisions,
        confirmations: noteDraft.confirmations,
      },
    });

    const createdActions = await createConversationActions({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      sourcePage: input.sourcePage,
      captureSessionId: session.id,
      meetingId,
      opportunityId: context.opportunityId,
      contactId: context.contactId,
      ownerId: context.ownerId,
      opportunityType: context.opportunityType,
      baseRiskLevel: context.opportunityRiskLevel ?? RiskLevel.MEDIUM,
      candidateActions: noteDraft.candidateActions,
      blockerTitle: noteDraft.riskDrafts[0]?.title ?? null,
      commitmentTitle: noteDraft.confirmations?.split("\n")[0] ?? null,
    });

    const memoryResult = await processMeetingMemory({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      meetingId,
      force: true,
    });

    const insights = await upsertConversationInsights({
      workspaceId: input.workspaceId,
      captureSessionId: session.id,
      lines,
      meetingId,
      context: {
        ...context,
        meetingId,
      },
      noteDraft,
    });

    const refreshedRecommendations = await refreshRecommendationsForCapture({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      context: {
        ...context,
        meetingId,
        meetingTitle: session.title ?? context.meetingTitle ?? "现场记录会议",
      },
      meetingId,
    });

    const approvalCount = createdActions.filter(
      (item) => item.approvalTaskId,
    ).length;

    await db.captureSession.update({
      where: { id: session.id },
      data: {
        linkedMeetingId: meetingId,
        status: CaptureSessionStatus.COMPLETED,
        transcriptStatus: CaptureProcessingStatus.COMPLETED,
        processingStatus: CaptureProcessingStatus.COMPLETED,
      },
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actor: input.actorName,
      actorType: input.actorType ?? ActorType.SYSTEM,
      actionType: "CONVERSATION_CAPTURE_PROCESSED",
      targetType: "CaptureSession",
      targetId: session.id,
      summary: `完成现场记录处理：${session.title ?? context.objectLabel ?? "会话捕获"}`,
      payload: {
        meetingId,
        transcriptId: transcript.id,
        insightCount: insights.length,
        createdActionCount: createdActions.length,
        refreshedRecommendationObjectCount: refreshedRecommendations.length,
        refreshedRecommendationCount: refreshedRecommendations.reduce(
          (sum, item) => sum + item.recommendations.length,
          0,
        ),
        approvalCount,
        consequence: buildNoReplyConsequence({
          objectType: context.opportunityType ?? context.objectType,
          hasHighSeverityRisk: noteDraft.riskDrafts.some(
            (item) => item.severity >= 80,
          ),
          hasOverdueSignal: /24小时|48小时|下周三前|本周内/.test(
            noteDraft.liveTranscript,
          ),
        }),
      },
      sourcePage: input.sourcePage,
      relatedObjectType: context.objectType ?? ObjectType.MEETING,
      relatedObjectId: context.objectId ?? meetingId,
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "conversation_insights_generated",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: {
        meetingId,
        insightCount: insights.length,
        createdActionCount: createdActions.length,
        createdFactCount: memoryResult.facts.length,
        createdCommitmentCount: memoryResult.commitments.length,
        createdBlockerCount: memoryResult.blockers.length,
        refreshedRecommendationObjectCount: refreshedRecommendations.length,
        refreshedRecommendationCount: refreshedRecommendations.reduce(
          (sum, item) => sum + item.recommendations.length,
          0,
        ),
        approvalCount,
      },
      sourcePage: input.sourcePage,
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "capture_actions_created",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: {
        createdActionCount: createdActions.length,
        approvalCount,
      },
      sourcePage: input.sourcePage,
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "capture_memory_written",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: {
        meetingId,
        createdFactCount: memoryResult.facts.length,
        createdCommitmentCount: memoryResult.commitments.length,
        createdBlockerCount: memoryResult.blockers.length,
      },
      sourcePage: input.sourcePage,
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "capture_recommendations_refreshed",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: {
        refreshedRecommendationObjectCount: refreshedRecommendations.length,
        refreshedRecommendationCount: refreshedRecommendations.reduce(
          (sum, item) => sum + item.recommendations.length,
          0,
        ),
        approvalCount,
      },
      sourcePage: input.sourcePage,
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "capture_processing_completed",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: {
        transcriptId: transcript.id,
        meetingId,
        insightCount: insights.length,
        createdActionCount: createdActions.length,
        refreshedRecommendationObjectCount: refreshedRecommendations.length,
      },
      sourcePage: input.sourcePage,
    });

    return {
      sessionId: session.id,
      meetingId,
      transcript,
      insights,
      createdActions,
      memoryResult,
      refreshedRecommendations,
      approvalCount,
      consequence: buildNoReplyConsequence({
        objectType: context.opportunityType ?? context.objectType,
        hasHighSeverityRisk: noteDraft.riskDrafts.some(
          (item) => item.severity >= 80,
        ),
        hasOverdueSignal: /24小时|48小时|下周三前|本周内/.test(
          noteDraft.liveTranscript,
        ),
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "现场记录处理失败";

    await db.captureSession.update({
      where: { id: session.id },
      data: {
        status: CaptureSessionStatus.FAILED,
        transcriptStatus: CaptureProcessingStatus.FAILED,
        processingStatus: CaptureProcessingStatus.FAILED,
        errorMessage: message,
      },
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actor: input.actorName,
      actorType: input.actorType ?? ActorType.SYSTEM,
      actionType: "CONVERSATION_CAPTURE_FAILED",
      targetType: "CaptureSession",
      targetId: session.id,
      summary: `现场记录处理失败：${session.title ?? "会话捕获"}`,
      payload: { error: message },
      sourcePage: input.sourcePage,
      relatedObjectType: session.objectType ?? undefined,
      relatedObjectId: session.objectId ?? undefined,
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      eventName: "conversation_capture_failed",
      eventCategory: "conversation_capture",
      targetType: "CaptureSession",
      targetId: session.id,
      metadata: { error: message },
      sourcePage: input.sourcePage,
    });

    throw error;
  }
}
