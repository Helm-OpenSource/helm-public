import { ActorType } from "@prisma/client";
import { db } from "@/lib/db";
import { generateContactBriefingSnapshot } from "@/lib/memory/briefing.service";

export async function getContactDetailData(workspaceId: string, contactId: string) {
  const contact = await db.contact.findFirst({
    where: {
      workspaceId,
      id: contactId,
    },
    include: {
      company: true,
      owner: true,
      opportunities: {
        include: {
          company: true,
          owner: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      meetings: {
        include: {
          opportunity: true,
          note: true,
        },
        orderBy: { startsAt: "desc" },
      },
      actionItems: {
        orderBy: { updatedAt: "desc" },
      },
      memoryEntries: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      emailThreads: {
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            orderBy: { sentAt: "asc" },
          },
        },
      },
    },
  });

  if (!contact) return null;

  const [memoryFacts, commitments, blockers, briefingSnapshot] = await Promise.all([
    db.memoryFact.findMany({
      where: {
        workspaceId,
        objectType: "CONTACT",
        objectId: contactId,
        status: { in: ["ACTIVE", "OBSERVED"] },
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    db.commitment.findMany({
      where: {
        workspaceId,
        relatedContactId: contactId,
      },
      include: {
        relatedCompany: true,
        relatedOpportunity: true,
        relatedMeeting: true,
        ownerUser: true,
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    db.blocker.findMany({
      where: {
        workspaceId,
        relatedContactId: contactId,
      },
      include: {
        relatedCompany: true,
        relatedOpportunity: true,
        relatedMeeting: true,
      },
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    }),
    generateContactBriefingSnapshot({
      workspaceId,
      actorName: "系统",
      actorType: ActorType.SYSTEM,
      sourcePage: `/contacts/${contactId}`,
      contactId,
    }).catch(() => null),
  ]);

  return {
    ...contact,
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
