import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBlockers } from "@/lib/memory/blocker.service";
import { getCommitments } from "@/lib/memory/commitment.service";
import { getRelevantMemoryFacts } from "@/lib/memory/memory-fact.service";
import type { LLMObjectContext } from "@/lib/context/shared";

export async function buildCompanyContext(workspaceId: string, companyId: string): Promise<LLMObjectContext> {
  const company = await db.company.findFirst({
    where: { workspaceId, id: companyId },
    include: {
      contacts: {
        where: { archivedAt: null },
        orderBy: { lastInteractionAt: "desc" },
        take: 6,
      },
      opportunities: {
        where: { stage: { notIn: ["DONE", "LOST"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
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

  const [facts, commitments, blockers] = await Promise.all([
    getRelevantMemoryFacts({
      workspaceId,
      objectRefs: [
        { objectType: ObjectType.COMPANY, objectId: company.id },
        ...company.contacts.map((item) => ({ objectType: ObjectType.CONTACT, objectId: item.id })),
        ...company.opportunities.map((item) => ({ objectType: ObjectType.OPPORTUNITY, objectId: item.id })),
      ],
      limit: 12,
    }),
    getCommitments({
      workspaceId,
      relatedCompanyId: company.id,
      onlyOpen: true,
    }),
    getBlockers({
      workspaceId,
      relatedCompanyId: company.id,
      onlyActive: true,
    }),
  ]);

  return {
    objectType: ObjectType.COMPANY,
    objectId: company.id,
    objectLabel: company.name,
    currentStage: company.cooperationMaturity,
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
    recentMeetings: company.meetings.map((item) => ({
      id: item.id,
      title: item.title,
      startsAt: item.startsAt,
      summary: item.note?.summary,
    })),
    recentThreads: company.emailThreads.map((item) => ({
      id: item.id,
      subject: item.subject,
      status: item.status,
      snippet: item.summary,
    })),
  };
}
