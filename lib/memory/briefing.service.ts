import { ActorType, ObjectType } from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { generateBriefingWithLLM } from "@/lib/llm-workflows/generate-briefing.workflow";
import { getBlockers } from "@/lib/memory/blocker.service";
import { getCommitments } from "@/lib/memory/commitment.service";
import { getRelevantMemoryFacts } from "@/lib/memory/memory-fact.service";
import {
  buildMemoryFactRetrievalPack,
  type MemoryRetrievalPackSurfaceTrace,
} from "@/lib/memory/retrieval-pack-adapter";
import { deserializeIds, serializeIds, type MemoryActorContext, writeMemoryAuditAndEvent } from "@/lib/memory/shared";
import { jsonStringify, safeParseJson } from "@/lib/utils";

export type BriefingPayload = {
  summary: string;
  recentFacts: Array<Record<string, unknown>>;
  openCommitments: Array<Record<string, unknown>>;
  activeBlockers: Array<Record<string, unknown>>;
  recommendedQuestions: string[];
  recommendedNextSteps: string[];
  recentMeetings: Array<Record<string, unknown>>;
  recentThreads: Array<Record<string, unknown>>;
  retrievalPackTrace?: MemoryRetrievalPackSurfaceTrace | null;
  generationMode?: string;
  llmMeta?: Record<string, unknown>;
};

type GenericBriefingInput = MemoryActorContext & {
  objectType: ObjectType;
  objectId: string;
  snapshotType: string;
  force?: boolean;
};

export type BriefingResource = {
  objectType: ObjectType;
  objectId: string;
  objectLabel: string;
  fallbackGoal?: string | null;
  manualQuestions?: string | null;
  currentStage?: string | null;
  objectRefs: Array<{ objectType: ObjectType; objectId: string }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    startsAt: Date;
    summary?: string | null;
  }>;
  recentThreads: Array<{
    id: string;
    subject: string;
    snippet?: string | null;
    status: string;
  }>;
};

export async function generateMeetingBriefingSnapshot(input: MemoryActorContext & { meetingId: string; force?: boolean }) {
  return generateObjectBriefingSnapshot({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    objectType: ObjectType.MEETING,
    objectId: input.meetingId,
    snapshotType: "pre_meeting_brief",
    force: input.force,
  });
}

export async function generateContactBriefingSnapshot(input: MemoryActorContext & { contactId: string; force?: boolean }) {
  return generateObjectBriefingSnapshot({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    objectType: ObjectType.CONTACT,
    objectId: input.contactId,
    snapshotType: "object_brief",
    force: input.force,
  });
}

export async function generateCompanyBriefingSnapshot(input: MemoryActorContext & { companyId: string; force?: boolean }) {
  return generateObjectBriefingSnapshot({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    objectType: ObjectType.COMPANY,
    objectId: input.companyId,
    snapshotType: "object_brief",
    force: input.force,
  });
}

export async function generateOpportunityBriefingSnapshot(input: MemoryActorContext & { opportunityId: string; force?: boolean }) {
  return generateObjectBriefingSnapshot({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    objectType: ObjectType.OPPORTUNITY,
    objectId: input.opportunityId,
    snapshotType: "object_brief",
    force: input.force,
  });
}

export async function generateObjectBriefingSnapshot(input: GenericBriefingInput) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const resource = await loadBriefingResource(input.workspaceId, input.objectType, input.objectId);
  const latestSnapshot = await getLatestBriefingSnapshot({
    workspaceId: input.workspaceId,
    objectType: input.objectType,
    objectId: input.objectId,
    snapshotType: input.snapshotType,
  });

  if (latestSnapshot?.expiresAt === null && !input.force) {
    return {
      snapshot: latestSnapshot,
      payload: parseBriefingPayload(latestSnapshot.content),
    };
  }

  const [candidateFacts, commitments, blockers] = await Promise.all([
    getRelevantMemoryFacts({
      workspaceId: input.workspaceId,
      objectRefs: resource.objectRefs,
      limit: 24,
    }),
    getOpenCommitmentsForResource(input.workspaceId, input.objectType, input.objectId),
    getActiveBlockersForResource(input.workspaceId, input.objectType, input.objectId),
  ]);
  const retrievalPack = buildMemoryFactRetrievalPack({
    surface: "briefing",
    objectType: input.objectType,
    objectId: input.objectId,
    facts: candidateFacts,
  });
  const facts = retrievalPack.selectedFacts;

  const fallbackPayload = buildBriefingPayload({
    resource,
    facts,
    commitments,
    blockers,
    retrievalPackTrace: retrievalPack.trace,
  });
  const llmBriefing = await generateBriefingWithLLM({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    objectType: input.objectType,
    objectLabel: resource.objectLabel,
    currentStage: resource.currentStage,
    fallbackPayload,
  });
  const payload = llmBriefing.output;

  if (latestSnapshot?.expiresAt === null) {
    await db.briefingSnapshot.update({
      where: { id: latestSnapshot.id },
      data: { expiresAt: new Date() },
    });
  }

  const snapshot = await db.briefingSnapshot.create({
    data: {
      workspaceId: input.workspaceId,
      objectType: input.objectType,
      objectId: input.objectId,
      snapshotType: input.snapshotType,
      content: jsonStringify(payload),
      sourceFactIds: serializeIds(facts),
      sourceCommitmentIds: serializeIds(commitments),
      sourceBlockerIds: serializeIds(blockers),
      version: (latestSnapshot?.version ?? 0) + 1,
    },
  });

  if (input.objectType === ObjectType.MEETING) {
    await db.meeting.update({
      where: { id: input.objectId },
      data: {
        briefingSnapshotId: snapshot.id,
      },
    }).catch(() => null);
  }

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    actionType: "BRIEFING_SNAPSHOT_GENERATED",
    targetType: "BriefingSnapshot",
    targetId: snapshot.id,
    summary: `生成${objectTypeLabel(input.objectType)}简报：${resource.objectLabel}`,
    eventName: "briefing_generated",
    eventCategory: "memory",
    metadata: {
      objectType: input.objectType,
      objectId: input.objectId,
      sourceFactIds: deserializeIds(snapshot.sourceFactIds),
      sourceCommitmentIds: deserializeIds(snapshot.sourceCommitmentIds),
      sourceBlockerIds: deserializeIds(snapshot.sourceBlockerIds),
      retrievalPack: {
        selectedCount: retrievalPack.trace.trace.selectedCount,
        omittedCount: retrievalPack.trace.trace.omittedCount,
        fallbackUsed: retrievalPack.trace.fallback.used,
        fallbackReason: retrievalPack.trace.fallback.reason,
      },
      snapshotType: input.snapshotType,
      llmProvider: llmBriefing.provider,
      llmModel: llmBriefing.model,
      llmFallbackUsed: llmBriefing.fallbackUsed,
      llmSuccess: llmBriefing.success,
    },
  });

  return {
    snapshot,
    payload,
  };
}

export async function getOrGenerateBriefingSnapshot(
  input: MemoryActorContext & { objectType: ObjectType; objectId: string; snapshotType: string; force?: boolean },
) {
  return generateObjectBriefingSnapshot(input);
}

export async function getLatestBriefingSnapshot(args: {
  workspaceId: string;
  objectType: ObjectType;
  objectId: string;
  snapshotType: string;
}) {
  return db.briefingSnapshot.findFirst({
    where: {
      workspaceId: args.workspaceId,
      objectType: args.objectType,
      objectId: args.objectId,
      snapshotType: args.snapshotType,
    },
    orderBy: { generatedAt: "desc" },
  });
}

function parseBriefingPayload(content: string) {
  return safeParseJson<BriefingPayload>(content, {
    summary: content,
    recentFacts: [],
    openCommitments: [],
    activeBlockers: [],
    recommendedQuestions: [],
    recommendedNextSteps: [],
    recentMeetings: [],
    recentThreads: [],
    retrievalPackTrace: null,
  });
}

export async function loadBriefingResource(workspaceId: string, objectType: ObjectType, objectId: string): Promise<BriefingResource> {
  switch (objectType) {
    case ObjectType.CONTACT: {
      const contact = await db.contact.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          company: true,
          opportunities: { orderBy: { updatedAt: "desc" }, take: 3 },
          meetings: {
            include: { note: true },
            orderBy: { startsAt: "desc" },
            take: 4,
          },
          emailThreads: {
            orderBy: { updatedAt: "desc" },
            take: 3,
          },
        },
      });

      if (!contact) {
        throw new Error("联系人不存在");
      }

      return {
        objectType,
        objectId,
        objectLabel: contact.name,
        currentStage: contact.relationshipStage,
        objectRefs: [
          { objectType: ObjectType.CONTACT, objectId: contact.id },
          ...(contact.companyId ? [{ objectType: ObjectType.COMPANY, objectId: contact.companyId }] : []),
          ...contact.opportunities.map((item) => ({ objectType: ObjectType.OPPORTUNITY, objectId: item.id })),
        ],
        recentMeetings: contact.meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          startsAt: meeting.startsAt,
          summary: meeting.note?.summary,
        })),
        recentThreads: contact.emailThreads.map((thread) => ({
          id: thread.id,
          subject: thread.subject,
          snippet: thread.summary,
          status: thread.status,
        })),
      };
    }
    case ObjectType.COMPANY: {
      const company = await db.company.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          contacts: { orderBy: { lastInteractionAt: "desc" }, take: 4 },
          opportunities: {
            where: { stage: { notIn: ["DONE", "LOST"] } },
            orderBy: { updatedAt: "desc" },
            take: 4,
          },
          meetings: {
            include: { note: true },
            orderBy: { startsAt: "desc" },
            take: 4,
          },
          emailThreads: {
            orderBy: { updatedAt: "desc" },
            take: 4,
          },
        },
      });

      if (!company) {
        throw new Error("公司不存在");
      }

      return {
        objectType,
        objectId,
        objectLabel: company.name,
        currentStage: company.cooperationMaturity,
        objectRefs: [
          { objectType: ObjectType.COMPANY, objectId: company.id },
          ...company.opportunities.map((item) => ({ objectType: ObjectType.OPPORTUNITY, objectId: item.id })),
          ...company.contacts.map((item) => ({ objectType: ObjectType.CONTACT, objectId: item.id })),
        ],
        recentMeetings: company.meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          startsAt: meeting.startsAt,
          summary: meeting.note?.summary,
        })),
        recentThreads: company.emailThreads.map((thread) => ({
          id: thread.id,
          subject: thread.subject,
          snippet: thread.summary,
          status: thread.status,
        })),
      };
    }
    case ObjectType.OPPORTUNITY: {
      const opportunity = await db.opportunity.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          company: true,
          contacts: true,
          meetings: {
            include: { note: true },
            orderBy: { startsAt: "desc" },
            take: 4,
          },
          emailThreads: {
            orderBy: { updatedAt: "desc" },
            take: 4,
          },
        },
      });

      if (!opportunity) {
        throw new Error("机会不存在");
      }

      return {
        objectType,
        objectId,
        objectLabel: opportunity.title,
        currentStage: opportunity.stage,
        fallbackGoal: opportunity.nextAction,
        objectRefs: [
          { objectType: ObjectType.OPPORTUNITY, objectId: opportunity.id },
          ...(opportunity.companyId ? [{ objectType: ObjectType.COMPANY, objectId: opportunity.companyId }] : []),
          ...opportunity.contacts.map((item) => ({ objectType: ObjectType.CONTACT, objectId: item.id })),
        ],
        recentMeetings: opportunity.meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          startsAt: meeting.startsAt,
          summary: meeting.note?.summary,
        })),
        recentThreads: opportunity.emailThreads.map((thread) => ({
          id: thread.id,
          subject: thread.subject,
          snippet: thread.summary,
          status: thread.status,
        })),
      };
    }
    case ObjectType.MEETING: {
      const meeting = await db.meeting.findFirst({
        where: { workspaceId, id: objectId },
        include: {
          company: true,
          opportunity: true,
          contacts: true,
          note: true,
        },
      });

      if (!meeting) {
        throw new Error("会议不存在");
      }

      return {
        objectType,
        objectId,
        objectLabel: meeting.title,
        fallbackGoal: meeting.note?.meetingGoal,
        manualQuestions: meeting.note?.recommendedQuestions,
        currentStage: meeting.opportunity?.stage ?? meeting.status,
        objectRefs: [
          { objectType: ObjectType.MEETING, objectId: meeting.id },
          ...(meeting.opportunityId ? [{ objectType: ObjectType.OPPORTUNITY, objectId: meeting.opportunityId }] : []),
          ...(meeting.companyId ? [{ objectType: ObjectType.COMPANY, objectId: meeting.companyId }] : []),
          ...meeting.contacts.map((contact) => ({ objectType: ObjectType.CONTACT, objectId: contact.id })),
        ],
        recentMeetings: [
          {
            id: meeting.id,
            title: meeting.title,
            startsAt: meeting.startsAt,
            summary: meeting.note?.summary,
          },
        ],
        recentThreads: [],
      };
    }
    default:
      throw new Error("当前对象暂不支持简报");
  }
}

async function getOpenCommitmentsForResource(workspaceId: string, objectType: ObjectType, objectId: string) {
  return getCommitments({
    workspaceId,
    ...(objectType === ObjectType.CONTACT ? { relatedContactId: objectId } : {}),
    ...(objectType === ObjectType.COMPANY ? { relatedCompanyId: objectId } : {}),
    ...(objectType === ObjectType.OPPORTUNITY ? { relatedOpportunityId: objectId } : {}),
    ...(objectType === ObjectType.MEETING ? { relatedMeetingId: objectId } : {}),
    onlyOpen: true,
  });
}

async function getActiveBlockersForResource(workspaceId: string, objectType: ObjectType, objectId: string) {
  return getBlockers({
    workspaceId,
    ...(objectType === ObjectType.CONTACT ? { relatedContactId: objectId } : {}),
    ...(objectType === ObjectType.COMPANY ? { relatedCompanyId: objectId } : {}),
    ...(objectType === ObjectType.OPPORTUNITY ? { relatedOpportunityId: objectId } : {}),
    ...(objectType === ObjectType.MEETING ? { relatedMeetingId: objectId } : {}),
    onlyActive: true,
  });
}

export function buildBriefingPayload(args: {
  resource: BriefingResource;
  facts: Array<{ id: string; title: string; content: string; confidence: number }>;
  commitments: Array<{ id: string; title: string; dueDate: Date | null; status: string }>;
  blockers: Array<{ id: string; title: string; severity: number; status: string }>;
  retrievalPackTrace?: MemoryRetrievalPackSurfaceTrace | null;
}): BriefingPayload {
  const { resource, facts, commitments, blockers, retrievalPackTrace } = args;
  const summary = buildBriefingSummary({
    objectLabel: resource.objectLabel,
    stage: resource.currentStage,
    meetingGoal: resource.fallbackGoal,
    facts,
    commitments,
    blockers,
    recentThreadSubject: resource.recentThreads[0]?.subject ?? null,
  });

  return {
    summary,
    recentFacts: facts.slice(0, 4).map((fact) => ({
      id: fact.id,
      title: fact.title,
      content: fact.content,
      confidence: fact.confidence,
    })),
    openCommitments: commitments.slice(0, 4).map((commitment) => ({
      id: commitment.id,
      title: commitment.title,
      dueDate: commitment.dueDate,
      status: commitment.status,
    })),
    activeBlockers: blockers.slice(0, 4).map((blocker) => ({
      id: blocker.id,
      title: blocker.title,
      severity: blocker.severity,
      status: blocker.status,
    })),
    recommendedQuestions: buildRecommendedQuestions(facts, blockers, resource.manualQuestions),
    recommendedNextSteps: buildRecommendedNextSteps(commitments, blockers, resource.fallbackGoal),
    recentMeetings: resource.recentMeetings.slice(0, 3).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      summary: meeting.summary,
    })),
    recentThreads: resource.recentThreads.slice(0, 3).map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      snippet: thread.snippet,
    })),
    retrievalPackTrace: retrievalPackTrace ?? null,
  };
}

function buildBriefingSummary(args: {
  objectLabel: string;
  meetingGoal?: string | null;
  stage?: string | null;
  facts: Array<{ content: string }>;
  commitments: Array<{ title: string }>;
  blockers: Array<{ title: string }>;
  recentThreadSubject?: string | null;
}) {
  const keyFact = args.facts[0]?.content ?? "当前上下文尚无明确偏好或风险结论";
  const blocker = args.blockers[0]?.title ?? "暂无明显阻塞";
  const commitment = args.commitments[0]?.title ?? "先确认唯一负责人与截止时间";
  const threadSignal = args.recentThreadSubject ? `最近的外部线程集中在“${args.recentThreadSubject}”。` : "";
  const stageLine = args.stage
    ? `当前阶段是 ${formatBriefingStageLabel(args.stage)}。`
    : "";
  return `${stageLine}${threadSignal}当前关于 ${args.objectLabel} 最值得先确认的是：${keyFact}。仍需关注的阻塞是：${blocker}。下一步建议优先推进：${commitment}${args.meetingGoal ? `，并围绕“${args.meetingGoal}”收口。` : "。"}`
    .replace(/\s+/g, " ")
    .trim();
}

function formatBriefingStageLabel(stage: string) {
  const labels: Record<string, string> = {
    ADVANCING: "推进中",
    INTERNAL_SYNC: "需内部协同",
    AT_RISK: "存在风险",
    CLOSED_WON: "已赢单",
    CLOSED_LOST: "已流失",
  };

  return labels[stage] ?? stage;
}

function buildRecommendedQuestions(
  facts: Array<{ content: string }>,
  blockers: Array<{ title: string }>,
  fallbackText?: string | null,
) {
  const manual = fallbackText
    ?.split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (manual?.length) {
    return manual;
  }

  const blockerQuestion = blockers[0] ? `关于“${blockers[0].title}”，现在最现实的解除路径是什么？` : null;
  const factQuestion = facts[0] ? `刚才提到“${facts[0].content}”，这会直接影响你们本周的决策节奏吗？` : null;

  return [blockerQuestion, factQuestion, "如果这周只推进一步，最值得先锁定哪一步？"].filter(Boolean) as string[];
}

function buildRecommendedNextSteps(
  commitments: Array<{ title: string }>,
  blockers: Array<{ title: string }>,
  fallbackGoal?: string | null,
) {
  const next = [
    commitments[0]?.title ? `先把承诺落地：${commitments[0].title}` : null,
    blockers[0]?.title ? `优先解除阻塞：${blockers[0].title}` : null,
    fallbackGoal ? `继续围绕当前目标推进：${fallbackGoal}` : null,
  ].filter(Boolean) as string[];

  return next.length ? next : ["先确认唯一负责人、截止时间和会后同步节奏。"];
}

function objectTypeLabel(objectType: ObjectType) {
  switch (objectType) {
    case ObjectType.CONTACT:
      return "联系人";
    case ObjectType.COMPANY:
      return "公司";
    case ObjectType.OPPORTUNITY:
      return "机会";
    case ObjectType.MEETING:
      return "会议";
    default:
      return "对象";
  }
}
