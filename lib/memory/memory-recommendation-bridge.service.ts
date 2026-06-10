import { ObjectType } from "@prisma/client";
import { db } from "@/lib/db";
import { getBlockersForObject } from "@/lib/memory/blocker.service";
import { getLatestBriefingSnapshot } from "@/lib/memory/briefing.service";
import { getCommitmentsForObject } from "@/lib/memory/commitment.service";
import { getRelevantMemoryFacts } from "@/lib/memory/memory-fact.service";
import { buildMemoryFactRetrievalPack } from "@/lib/memory/retrieval-pack-adapter";
import type { ObjectReference } from "@/lib/memory/shared";
import { safeParseJson } from "@/lib/utils";

export async function buildMemoryRecommendationEvidence(args: {
  workspaceId: string;
  objectRefs: ObjectReference[];
  primaryRef: ObjectReference;
}) {
  const [candidateFacts, commitments, blockers, latestBriefing, recentMeetings, recentThreads] = await Promise.all([
    getRelevantMemoryFacts({
      workspaceId: args.workspaceId,
      objectRefs: args.objectRefs,
      limit: 24,
    }),
    // Only OPEN commitments / ACTIVE blockers are valid recommendation
    // evidence: the ranking layer treats blockers[0] as the top *active*
    // blocker (urgency/impact/risk boosts) and the candidate layer escalates
    // off it, so a long-resolved high-severity blocker would otherwise keep
    // inflating recommendations forever. (The briefing service already filters
    // this way; previously only the display layer compensated, not the math.)
    getCommitmentsForObject({
      workspaceId: args.workspaceId,
      objectType: args.primaryRef.objectType,
      objectId: args.primaryRef.objectId,
      onlyOpen: true,
    }),
    getBlockersForObject({
      workspaceId: args.workspaceId,
      objectType: args.primaryRef.objectType,
      objectId: args.primaryRef.objectId,
      onlyActive: true,
    }),
    getLatestBriefingSnapshot({
      workspaceId: args.workspaceId,
      objectType: args.primaryRef.objectType,
      objectId: args.primaryRef.objectId,
      snapshotType: args.primaryRef.objectType === ObjectType.MEETING ? "pre_meeting_brief" : "object_brief",
    }),
    loadRecentMeetings(args.workspaceId, args.primaryRef),
    loadRecentThreads(args.workspaceId, args.primaryRef),
  ]);

  const briefingPayload = latestBriefing
    ? safeParseJson<Record<string, unknown>>(latestBriefing.content, {})
    : null;
  const retrievalPack = buildMemoryFactRetrievalPack({
    surface: "recommendation",
    objectType: args.primaryRef.objectType,
    objectId: args.primaryRef.objectId,
    facts: candidateFacts,
  });
  const supportingFacts = retrievalPack.selectedFacts;

  return {
    supportingFactIds: supportingFacts.map((fact) => fact.id),
    blockerIds: blockers.map((blocker) => blocker.id),
    commitmentIds: commitments.map((commitment) => commitment.id),
    supportingFacts,
    memoryRetrievalPack: retrievalPack.trace,
    blockers,
    commitments,
    briefingSnapshotId: latestBriefing?.id ?? null,
    briefingSummary: typeof briefingPayload?.summary === "string" ? briefingPayload.summary : null,
    recentMeetings: recentMeetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      summary: meeting.note?.summary ?? null,
    })),
    recentThreads: recentThreads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      snippet: thread.summary,
    })),
  };
}

async function loadRecentMeetings(workspaceId: string, primaryRef: ObjectReference) {
  if (primaryRef.objectType === ObjectType.MEETING) {
    return db.meeting.findMany({
      where: { workspaceId, id: primaryRef.objectId },
      include: { note: true },
      take: 1,
    });
  }

  if (primaryRef.objectType === ObjectType.CONTACT) {
    return db.meeting.findMany({
      where: { workspaceId, contacts: { some: { id: primaryRef.objectId } } },
      include: { note: true },
      orderBy: { startsAt: "desc" },
      take: 3,
    });
  }

  if (primaryRef.objectType === ObjectType.COMPANY) {
    return db.meeting.findMany({
      where: { workspaceId, companyId: primaryRef.objectId },
      include: { note: true },
      orderBy: { startsAt: "desc" },
      take: 3,
    });
  }

  if (primaryRef.objectType === ObjectType.OPPORTUNITY) {
    return db.meeting.findMany({
      where: { workspaceId, opportunityId: primaryRef.objectId },
      include: { note: true },
      orderBy: { startsAt: "desc" },
      take: 3,
    });
  }

  return [];
}

async function loadRecentThreads(workspaceId: string, primaryRef: ObjectReference) {
  if (primaryRef.objectType === ObjectType.CONTACT) {
    return db.emailThread.findMany({
      where: { workspaceId, contactId: primaryRef.objectId },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
  }

  if (primaryRef.objectType === ObjectType.COMPANY) {
    return db.emailThread.findMany({
      where: { workspaceId, companyId: primaryRef.objectId },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
  }

  if (primaryRef.objectType === ObjectType.OPPORTUNITY) {
    return db.emailThread.findMany({
      where: { workspaceId, opportunityId: primaryRef.objectId },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
  }

  return [];
}
