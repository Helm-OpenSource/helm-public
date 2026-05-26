import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBlockers } from "@/lib/memory/blocker.service";
import { getCommitments } from "@/lib/memory/commitment.service";
import { getRelevantMemoryFacts } from "@/lib/memory/memory-fact.service";
import type { LLMObjectContext } from "@/lib/context/shared";

export async function buildContactContext(workspaceId: string, contactId: string): Promise<LLMObjectContext> {
  const contact = await db.contact.findFirst({
    where: { workspaceId, id: contactId },
    include: {
      company: true,
      opportunities: {
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
        take: 3,
      },
    },
  });

  if (!contact) {
    throw new Error("联系人不存在");
  }

  const [facts, commitments, blockers] = await Promise.all([
    getRelevantMemoryFacts({
      workspaceId,
      objectRefs: [
        { objectType: ObjectType.CONTACT, objectId: contact.id },
        ...(contact.companyId ? [{ objectType: ObjectType.COMPANY, objectId: contact.companyId }] : []),
        ...contact.opportunities.map((item) => ({ objectType: ObjectType.OPPORTUNITY, objectId: item.id })),
      ],
      limit: 10,
    }),
    getCommitments({
      workspaceId,
      relatedContactId: contact.id,
      onlyOpen: true,
    }),
    getBlockers({
      workspaceId,
      relatedContactId: contact.id,
      onlyActive: true,
    }),
  ]);

  return {
    objectType: ObjectType.CONTACT,
    objectId: contact.id,
    objectLabel: contact.name,
    currentStage: contact.relationshipStage,
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
    recentMeetings: contact.meetings.map((item) => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      summary: item.note?.summary,
    })),
    recentThreads: contact.emailThreads.map((item) => ({
      id: item.id,
      subject: item.subject,
      status: item.status,
      snippet: item.summary,
    })),
  };
}
