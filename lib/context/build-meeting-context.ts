import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBlockers } from "@/lib/memory/blocker.service";
import { getCommitments } from "@/lib/memory/commitment.service";
import { getRelevantMemoryFacts } from "@/lib/memory/memory-fact.service";
import type { LLMObjectContext } from "@/lib/context/shared";

export async function buildMeetingContext(workspaceId: string, meetingId: string): Promise<LLMObjectContext> {
  const meeting = await db.meeting.findFirst({
    where: { workspaceId, id: meetingId },
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

  const [facts, commitments, blockers] = await Promise.all([
    getRelevantMemoryFacts({
      workspaceId,
      objectRefs: [
        { objectType: ObjectType.MEETING, objectId: meeting.id },
        ...(meeting.opportunityId ? [{ objectType: ObjectType.OPPORTUNITY, objectId: meeting.opportunityId }] : []),
        ...(meeting.companyId ? [{ objectType: ObjectType.COMPANY, objectId: meeting.companyId }] : []),
        ...meeting.contacts.map((item) => ({ objectType: ObjectType.CONTACT, objectId: item.id })),
      ],
      limit: 12,
    }),
    getCommitments({
      workspaceId,
      relatedMeetingId: meeting.id,
      onlyOpen: true,
    }),
    getBlockers({
      workspaceId,
      relatedMeetingId: meeting.id,
      onlyActive: true,
    }),
  ]);

  return {
    objectType: ObjectType.MEETING,
    objectId: meeting.id,
    objectLabel: meeting.title,
    currentStage: meeting.opportunity?.stage ?? meeting.status,
    facts: facts.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      confidence: item.confidence,
    })),
    commitments: commitments.map((item) => ({
      id: item.id,
      title: item.title,
      commitmentText: item.commitmentText,
      dueDate: item.dueDate,
      status: item.status,
      overdueFlag: item.overdueFlag,
    })),
    blockers: blockers.map((item) => ({
      id: item.id,
      title: item.title,
      blockerText: item.blockerText,
      severity: item.severity,
      status: item.status,
    })),
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
