import { SourceType, type ActorType } from "@prisma/client";
import { splitIntoSentences } from "@/lib/memory/shared";

export type MeetingBlockerExtractionInput = {
  workspaceId: string;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  sourcePage?: string;
  meeting: {
    id: string;
    opportunityId: string | null;
    companyId: string | null;
    contacts: Array<{ id: string; name: string }>;
    note: {
      riskAlerts: string | null;
      summary: string | null;
      keyDecisions: string | null;
      relationshipSummary: string | null;
      liveTranscript?: string | null;
    } | null;
  };
};

export function extractMeetingBlockerDrafts(input: MeetingBlockerExtractionInput) {
  const note = input.meeting.note;
  if (!note) return [];

  const lines = splitIntoSentences(
    note.riskAlerts,
    note.summary,
    note.keyDecisions,
    note.relationshipSummary,
    note.liveTranscript,
  ).filter((line) => /预算|审批|顾虑|风险|冲突|资源|回复变慢|未确认|等待|卡住|稳定性|薪资|法务|排期/.test(line));

  const drafts = lines.slice(0, 5).map((line) => {
    const blockerType = /预算|付款/.test(line)
      ? "budget"
      : /薪资/.test(line)
        ? "salary_gap"
        : /稳定性/.test(line)
          ? "stability_concern"
          : /法务/.test(line)
            ? "legal_review"
            : /资源|排期|冲突/.test(line)
              ? "resource_conflict"
              : /回复变慢|等待/.test(line)
                ? "response_delay"
                : "general";

    const severity =
      blockerType === "resource_conflict" || blockerType === "salary_gap"
        ? 84
        : blockerType === "budget" || blockerType === "legal_review"
          ? 80
          : blockerType === "response_delay"
            ? 72
            : 68;

    return {
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      sourcePage: input.sourcePage,
      title: line.length > 18 ? `${line.slice(0, 18)}...` : line,
      blockerType,
      blockerText: line,
      severity,
      sourceType: SourceType.MEETING_NOTE,
      sourceId: input.meeting.id,
      relatedContactId: input.meeting.contacts[0]?.id ?? null,
      relatedCompanyId: input.meeting.companyId,
      relatedOpportunityId: input.meeting.opportunityId,
      relatedMeetingId: input.meeting.id,
    };
  });

  return Array.from(new Map(drafts.map((draft) => [draft.blockerText, draft])).values());
}
