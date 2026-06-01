import { MemoryFactType, ObjectType, SourceType, type ActorType, type MemoryStatus } from "@prisma/client";
import {
  deriveOverdueFlag,
  inferFactType,
  inferObjectTypeFromContext,
  parseDueDateHint,
  splitIntoSentences,
} from "@/lib/memory/shared";

export type MeetingFactExtractionInput = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string;
  meeting: {
    id: string;
    title: string;
    startsAt: Date;
    companyId: string | null;
    opportunityId: string | null;
    contacts: Array<{ id: string; name: string }>;
    note: {
      relationshipSummary: string | null;
      previousConclusion: string | null;
      meetingGoal: string | null;
      recommendedQuestions: string | null;
      riskAlerts: string | null;
      summary: string | null;
      keyDecisions: string | null;
      confirmations: string | null;
      liveTranscript: string | null;
    } | null;
  };
};

export type MeetingFactDraft = {
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
  normalizedValue?: unknown;
  confidence?: number;
  importance?: number;
  freshnessScore?: number;
  status?: MemoryStatus;
  confirmedByUser?: boolean;
  createdBySystem?: boolean;
};

export function extractMeetingFactDrafts(input: MeetingFactExtractionInput) {
  const { meeting } = input;
  const note = meeting.note;
  if (!note) return [];

  const sentences = splitIntoSentences(
    note.relationshipSummary,
    note.previousConclusion,
    note.meetingGoal,
    note.riskAlerts,
    note.summary,
    note.keyDecisions,
    note.confirmations,
    note.liveTranscript,
  );

  const drafts: MeetingFactDraft[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences.slice(0, 10)) {
    const objectType = inferObjectTypeFromContext({
      text: sentence,
      hasOpportunity: Boolean(meeting.opportunityId),
      hasContact: Boolean(meeting.contacts[0]),
      hasCompany: Boolean(meeting.companyId),
    });

    const objectId =
      objectType === ObjectType.OPPORTUNITY
        ? meeting.opportunityId
        : objectType === ObjectType.CONTACT
          ? meeting.contacts[0]?.id
          : objectType === ObjectType.COMPANY
            ? meeting.companyId
            : meeting.id;

    if (!objectId) continue;

    const factType = inferFactType(sentence);
    const key = `${objectType}:${objectId}:${factType}:${sentence}`;
    if (seen.has(key)) continue;
    seen.add(key);

    drafts.push({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      sourcePage: input.sourcePage,
      objectType,
      objectId,
      factType,
      title: sentence.length > 18 ? `${sentence.slice(0, 18)}...` : sentence,
      content: sentence,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: meeting.id,
      confidence: factType === MemoryFactType.PREFERENCE ? 80 : 70,
      importance: factType === MemoryFactType.RISK_SIGNAL || factType === MemoryFactType.NEXT_STEP ? 82 : 68,
      freshnessScore: deriveOverdueFlag({ dueDate: parseDueDateHint(meeting.startsAt, sentence) }) ? 85 : 70,
      normalizedValue: {
        meetingId: meeting.id,
        meetingTitle: meeting.title,
      },
    });
  }

  drafts.unshift({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    objectType: ObjectType.MEETING,
    objectId: meeting.id,
    factType: MemoryFactType.SUMMARY,
    title: `${meeting.title} 会议摘要`,
    content: note.summary ?? note.keyDecisions ?? `${meeting.title} 已形成新的会议结论。`,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: meeting.id,
    confidence: 88,
    importance: 86,
    freshnessScore: 90,
    normalizedValue: {
      meetingId: meeting.id,
      contactIds: meeting.contacts.map((contact) => contact.id),
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
    },
  });

  return drafts;
}
