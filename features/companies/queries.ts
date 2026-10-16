import { ActorType } from "@prisma/client";
import { db } from "@/lib/db";
import { safeUserSelect } from "@/lib/auth/safe-user-select";
import { generateCompanyBriefingSnapshot } from "@/lib/memory/briefing.service";
import { buildInboxThreadWhere } from "@/features/inbox/queries";

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
          owner: { select: safeUserSelect },
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
        ownerUser: { select: safeUserSelect },
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

/**
 * Mail threads linked to the company, newest first, with every message in
 * send order. Uses the inbox visibility rule so a member only sees mailbox
 * threads from a mailbox they connected.
 */
export async function getCompanyEmailThreads(
  workspaceId: string,
  companyId: string,
  viewerEmail: string | null,
) {
  return db.emailThread.findMany({
    where: {
      AND: [buildInboxThreadWhere(workspaceId, viewerEmail), { companyId }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      subject: true,
      counterpart: true,
      status: true,
      updatedAt: true,
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          sender: true,
          senderEmail: true,
          body: true,
          isInbound: true,
          sentAt: true,
        },
      },
    },
  });
}

/**
 * The newest pending review request on any of the company's opportunities,
 * read directly instead of loading every approval task in the workspace.
 */
export async function getCompanyPendingReviewRequestId(
  workspaceId: string,
  companyId: string,
) {
  const task = await db.approvalTask.findFirst({
    where: {
      workspaceId,
      status: "PENDING",
      actionItem: { opportunity: { companyId } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return task?.id ?? null;
}
