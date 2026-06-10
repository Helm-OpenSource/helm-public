import { ActorType, MemoryFactType, ObjectType, SourceType } from "@prisma/client";
import { buildMeetingMemoryExtractionPrompt, llmPromptVersions, meetingMemoryExtractionSchema } from "@/lib/llm/prompt-registry";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import { parseDueDateHint } from "@/lib/memory/shared";
import type { MeetingCommitmentExtractionInput } from "@/lib/memory/commitment-extraction.service";
import type { MeetingFactExtractionInput } from "@/lib/memory/fact-extraction.service";
import { parseLlmJsonOrThrow } from "@/lib/llm/output-parse-error";

type MeetingFactDraftShape = Array<{
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string;
  objectType: ObjectType;
  objectId: string;
  factType: MemoryFactType;
  title: string;
  content: string;
  sourceType: SourceType;
  sourceId: string;
  confidence?: number;
  importance?: number;
  freshnessScore?: number;
  normalizedValue?: unknown;
}>;

type MeetingCommitmentDraftShape = Array<{
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string;
  title: string;
  commitmentText: string;
  sourceType: SourceType;
  sourceId: string;
  relatedContactId?: string | null;
  relatedCompanyId?: string | null;
  relatedOpportunityId?: string | null;
  relatedMeetingId?: string | null;
  ownerUserId?: string | null;
  dueDate?: Date | null;
  priority?: number;
  confidence?: number;
}>;

type MeetingBlockerDraftShape = Array<{
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string;
  title: string;
  blockerType: string;
  blockerText: string;
  severity?: number;
  sourceType: SourceType;
  sourceId: string;
  relatedContactId?: string | null;
  relatedCompanyId?: string | null;
  relatedOpportunityId?: string | null;
  relatedMeetingId?: string | null;
}>;

type MeetingMemoryWorkflowInput = {
  workspaceId: string;
  userId?: string | null;
  meeting: MeetingFactExtractionInput["meeting"] &
    Pick<MeetingCommitmentExtractionInput["meeting"], "ownerId"> & {
      companyName?: string | null;
      opportunityTitle?: string | null;
    };
  fallback: {
    summary: string;
    facts: MeetingFactDraftShape;
    commitments: MeetingCommitmentDraftShape;
    blockers: MeetingBlockerDraftShape;
    candidateActions: string[];
  };
};

type MeetingMemoryExtractionOutput = {
  summary: string;
  facts: MeetingFactDraftShape;
  commitments: MeetingCommitmentDraftShape;
  blockers: MeetingBlockerDraftShape;
  candidateActions: string[];
};

export async function processMeetingMemoryWithLLM(input: MeetingMemoryWorkflowInput) {
  const noteText = [
    input.meeting.note?.relationshipSummary,
    input.meeting.note?.previousConclusion,
    input.meeting.note?.meetingGoal,
    input.meeting.note?.riskAlerts,
    input.meeting.note?.summary,
    input.meeting.note?.keyDecisions,
    input.meeting.note?.confirmations,
    input.meeting.note?.liveTranscript,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = buildMeetingMemoryExtractionPrompt({
    title: input.meeting.title,
    companyName: input.meeting.companyName,
    opportunityTitle: input.meeting.opportunityTitle,
    attendees: input.meeting.contacts.map((item) => item.name),
    noteText,
  });

  const result = await executeLLMTask<MeetingMemoryExtractionOutput>({
    workspaceId: input.workspaceId,
    userId: input.userId,
    taskType: "MEETING_MEMORY_EXTRACTION",
    promptKey: prompt.promptKey,
    promptVersion: llmPromptVersions.meetingMemoryExtraction,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    inputSummary: `会议 ${input.meeting.title} 的结构化提取`,
    outputMode: "json",
    jsonSchema: meetingMemoryExtractionSchema,
    fallbackOutput: input.fallback,
    parseOutput: (rawText) => parseMeetingMemoryOutput(rawText, input.workspaceId, input.meeting, input.fallback),
  });

  return {
    ...result,
    output: mergeMeetingMemoryOutput(result.output, input.fallback),
  };
}

function parseMeetingMemoryOutput(
  rawText: string,
  workspaceId: string,
  meeting: MeetingMemoryWorkflowInput["meeting"],
  fallback: MeetingMemoryWorkflowInput["fallback"],
): MeetingMemoryExtractionOutput {
  // Throw on malformed JSON so the executor records fallbackUsed=true rather
  // than silently normalizing `{}` into a fallback-shaped "success".
  const parsed = parseLlmJsonOrThrow<{
    summary?: string;
    facts?: Array<{
      title?: string;
      content?: string;
      objectType?: string;
      objectId?: string;
      factType?: string;
      confidence?: number;
      importance?: number;
    }>;
    commitments?: Array<{
      title?: string;
      commitmentText?: string;
      dueHint?: string | null;
      priority?: number;
      confidence?: number;
    }>;
    blockers?: Array<{
      title?: string;
      blockerText?: string;
      blockerType?: string;
      severity?: number;
    }>;
    candidateActions?: string[];
  }>(rawText);

  const validObjectIds = new Set([
    meeting.id,
    meeting.companyId ?? "",
    meeting.opportunityId ?? "",
    ...meeting.contacts.map((item) => item.id),
  ]);
  const fallbackFact = fallback.facts[0];
  const fallbackCommitment = fallback.commitments[0];
  const fallbackBlocker = fallback.blockers[0];
  const defaultActorContext = {
    workspaceId,
    actorName: fallbackFact?.actorName ?? fallbackCommitment?.actorName ?? fallbackBlocker?.actorName ?? "系统",
    actorUserId: fallbackFact?.actorUserId ?? fallbackCommitment?.actorUserId ?? fallbackBlocker?.actorUserId ?? null,
    actorType: fallbackFact?.actorType ?? fallbackCommitment?.actorType ?? fallbackBlocker?.actorType ?? ActorType.SYSTEM,
    sourcePage: fallbackFact?.sourcePage ?? fallbackCommitment?.sourcePage ?? fallbackBlocker?.sourcePage,
  };

  const facts = (parsed.facts ?? [])
    .map((item) => {
      const objectType = normalizeObjectType(item.objectType, Boolean(meeting.opportunityId), Boolean(meeting.companyId), Boolean(meeting.contacts[0]));
      const objectId = validObjectIds.has(item.objectId ?? "")
        ? item.objectId ?? meeting.id
        : objectType === ObjectType.OPPORTUNITY
          ? meeting.opportunityId ?? meeting.id
          : objectType === ObjectType.COMPANY
            ? meeting.companyId ?? meeting.id
            : objectType === ObjectType.CONTACT
              ? meeting.contacts[0]?.id ?? meeting.id
              : meeting.id;

      return {
        ...defaultActorContext,
        objectType,
        objectId,
        factType: normalizeFactType(item.factType),
        title: item.title?.trim() || item.content?.trim() || "会议事实",
        content: item.content?.trim() || item.title?.trim() || "会议中识别到一条新的结构化事实。",
        sourceType: SourceType.MEETING_NOTE,
        sourceId: meeting.id,
        confidence: clampNumber(item.confidence, 55, 95, 74),
        importance: clampNumber(item.importance, 40, 95, 70),
        freshnessScore: 78,
        normalizedValue: {
          meetingId: meeting.id,
          extractedBy: "llm",
        },
      };
    })
    .filter((item) => item.content);

  const commitments = (parsed.commitments ?? [])
    .map((item) => ({
      ...defaultActorContext,
      title: item.title?.trim() || item.commitmentText?.trim() || "待确认承诺",
      commitmentText: item.commitmentText?.trim() || item.title?.trim() || "待确认承诺",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meeting.id,
      relatedContactId: fallbackCommitment?.relatedContactId ?? meeting.contacts[0]?.id ?? null,
      relatedCompanyId: fallbackCommitment?.relatedCompanyId ?? meeting.companyId,
      relatedOpportunityId: fallbackCommitment?.relatedOpportunityId ?? meeting.opportunityId,
      relatedMeetingId: fallbackCommitment?.relatedMeetingId ?? meeting.id,
      ownerUserId: fallbackCommitment?.ownerUserId ?? meeting.ownerId ?? null,
      dueDate: parseDueDateHint(meeting.startsAt, item.dueHint || item.commitmentText || item.title || ""),
      priority: clampNumber(item.priority, 45, 95, 70),
      confidence: clampNumber(item.confidence, 55, 95, 76),
    }))
    .filter((item) => item.commitmentText);

  const blockers = (parsed.blockers ?? [])
    .map((item) => ({
      ...defaultActorContext,
      title: item.title?.trim() || item.blockerText?.trim() || "待确认阻塞",
      blockerText: item.blockerText?.trim() || item.title?.trim() || "待确认阻塞",
      blockerType: item.blockerType?.trim() || "general",
      severity: clampNumber(item.severity, 40, 95, 72),
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meeting.id,
      relatedContactId: fallbackBlocker?.relatedContactId ?? meeting.contacts[0]?.id ?? null,
      relatedCompanyId: fallbackBlocker?.relatedCompanyId ?? meeting.companyId,
      relatedOpportunityId: fallbackBlocker?.relatedOpportunityId ?? meeting.opportunityId,
      relatedMeetingId: fallbackBlocker?.relatedMeetingId ?? meeting.id,
    }))
    .filter((item) => item.blockerText);

  return {
    summary: parsed.summary?.trim() || fallback.summary,
    facts,
    commitments,
    blockers,
    candidateActions: (parsed.candidateActions ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 4),
  };
}

function mergeMeetingMemoryOutput(primary: MeetingMemoryExtractionOutput, fallback: MeetingMemoryWorkflowInput["fallback"]) {
  return {
    summary: primary.summary || fallback.summary,
    facts: dedupeByContent([...primary.facts, ...fallback.facts], (item) => `${item.objectType}:${item.objectId}:${item.content}`),
    commitments: dedupeByContent([...primary.commitments, ...fallback.commitments], (item) => item.commitmentText),
    blockers: dedupeByContent([...primary.blockers, ...fallback.blockers], (item) => item.blockerText),
    candidateActions: dedupeByContent([...primary.candidateActions, ...fallback.candidateActions], (item) => item).slice(0, 4),
  };
}

function normalizeObjectType(value: string | undefined, hasOpportunity: boolean, hasCompany: boolean, hasContact: boolean) {
  if (value === ObjectType.OPPORTUNITY && hasOpportunity) return ObjectType.OPPORTUNITY;
  if (value === ObjectType.COMPANY && hasCompany) return ObjectType.COMPANY;
  if (value === ObjectType.CONTACT && hasContact) return ObjectType.CONTACT;
  return ObjectType.MEETING;
}

function normalizeFactType(value?: string) {
  const candidate = (value || "").toUpperCase();
  if (candidate in MemoryFactType) {
    return MemoryFactType[candidate as keyof typeof MemoryFactType];
  }
  return MemoryFactType.SUMMARY;
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function dedupeByContent<T>(items: T[], keyFn: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [keyFn(item), item])).values());
}
