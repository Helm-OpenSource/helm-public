import { ActorType } from "@prisma/client";
import { db } from "@/lib/db";
import { generateCompanyBriefingSnapshot } from "@/lib/memory/briefing.service";

export async function getCompanyDetailData(workspaceId: string, companyId: string) {
  const company = await db.company.findFirst({
    where: {
      workspaceId,
      id: companyId,
    },
    include: {
      contacts: {
        include: {
          opportunities: true,
        },
      },
      opportunities: {
        include: {
          contacts: true,
          owner: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      meetings: {
        include: {
          note: true,
          opportunity: true,
        },
        orderBy: { startsAt: "desc" },
      },
      memoryEntries: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!company) return null;

  const [memoryFacts, commitments, blockers, briefingSnapshot] = await Promise.all([
    db.memoryFact.findMany({
      where: {
        workspaceId,
        objectType: "COMPANY",
        objectId: companyId,
        status: { in: ["ACTIVE", "OBSERVED"] },
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    db.commitment.findMany({
      where: {
        workspaceId,
        relatedCompanyId: companyId,
      },
      include: {
        relatedContact: true,
        relatedOpportunity: true,
        relatedMeeting: true,
        ownerUser: true,
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    db.blocker.findMany({
      where: {
        workspaceId,
        relatedCompanyId: companyId,
      },
      include: {
        relatedContact: true,
        relatedOpportunity: true,
        relatedMeeting: true,
      },
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    }),
    generateCompanyBriefingSnapshot({
      workspaceId,
      actorName: "系统",
      actorType: ActorType.SYSTEM,
      sourcePage: `/companies/${companyId}`,
      companyId,
    }).catch(() => null),
  ]);

  return {
    ...company,
    memoryFacts,
    commitments,
    blockers,
    briefingSnapshot: briefingSnapshot
      ? {
          ...briefingSnapshot.snapshot,
          payload: briefingSnapshot.payload,
        }
      : null,
  };
}
