import { SourceType, type ActorType } from "@prisma/client";
import { parseDueDateHint, splitIntoSentences } from "@/lib/memory/shared";

export type MeetingCommitmentExtractionInput = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string;
  meeting: {
    id: string;
    startsAt: Date;
    companyId: string | null;
    opportunityId: string | null;
    ownerId: string | null;
    contacts: Array<{ id: string; name: string }>;
    note: {
      confirmations: string | null;
      summary: string | null;
      keyDecisions: string | null;
      liveTranscript?: string | null;
    } | null;
  };
};

export function extractMeetingCommitmentDrafts(input: MeetingCommitmentExtractionInput) {
  const note = input.meeting.note;
  if (!note) return [];

  const lines = splitIntoSentences(note.confirmations, note.summary, note.keyDecisions, note.liveTranscript).filter((line) =>
    /发送|安排|同步|确认|回复|评估|推进|跟进|完成|拍板|决策|对齐|提交|交付/.test(line),
  );

  const drafts = lines.slice(0, 6).map((line) => ({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    sourcePage: input.sourcePage,
    title: line.length > 18 ? `${line.slice(0, 18)}...` : line,
    commitmentText: line,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: input.meeting.id,
    relatedContactId: input.meeting.contacts[0]?.id ?? null,
    relatedCompanyId: input.meeting.companyId,
    relatedOpportunityId: input.meeting.opportunityId,
    relatedMeetingId: input.meeting.id,
    ownerUserId: input.meeting.ownerId,
    dueDate: parseDueDateHint(input.meeting.startsAt, line),
    priority: /今天|本周|48小时|尽快/.test(line) ? 85 : 68,
    confidence: 76,
  }));

  return Array.from(new Map(drafts.map((draft) => [draft.commitmentText, draft])).values());
}
