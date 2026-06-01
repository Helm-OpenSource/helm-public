import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBlockers } from "@/lib/memory/blocker.service";
import { getCommitments } from "@/lib/memory/commitment.service";
import { getRelevantMemoryFacts } from "@/lib/memory/memory-fact.service";
import type { LLMObjectContext } from "@/lib/context/shared";

export async function buildOpportunityContext(workspaceId: string, opportunityId: string): Promise<LLMObjectContext> {
  const opportunity = await db.opportunity.findFirst({
    where: { workspaceId, id: opportunityId },
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

  const [facts, commitments, blockers] = await Promise.all([
    getRelevantMemoryFacts({
      workspaceId,
      objectRefs: [
        { objectType: ObjectType.OPPORTUNITY, objectId: opportunity.id },
        ...(opportunity.companyId ? [{ objectType: ObjectType.COMPANY, objectId: opportunity.companyId }] : []),
        ...opportunity.contacts.map((item) => ({ objectType: ObjectType.CONTACT, objectId: item.id })),
      ],
      limit: 12,
    }),
    getCommitments({
      workspaceId,
      relatedOpportunityId: opportunity.id,
      onlyOpen: true,
    }),
    getBlockers({
      workspaceId,
      relatedOpportunityId: opportunity.id,
      onlyActive: true,
    }),
  ]);

  return {
    objectType: ObjectType.OPPORTUNITY,
    objectId: opportunity.id,
    objectLabel: opportunity.title,
    currentStage: opportunity.stage,
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
    recentMeetings: opportunity.meetings.map((item) => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      summary: item.note?.summary,
    })),
    recentThreads: opportunity.emailThreads.map((item) => ({
      id: item.id,
      subject: item.subject,
      status: item.status,
      snippet: item.summary,
    })),
  };
}
