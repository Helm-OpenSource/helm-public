import { ActorType, BlockerStatus, MemoryFactType, ObjectType, SourceType } from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import {
  assertWorkspaceBlockerOwnership,
  assertWorkspaceRelatedObjectOwnership,
} from "@/lib/auth/tenant-ownership";
import { db } from "@/lib/db";
import { recordBlockerDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import { createMemoryFact } from "@/lib/memory/memory-fact.service";
import { extractMeetingBlockerDrafts, type MeetingBlockerExtractionInput } from "@/lib/memory/blocker-extraction.service";
import {
  type MemoryActorContext,
  blockerSeverityTone,
  writeMemoryAuditAndEvent,
} from "@/lib/memory/shared";

export type CreateBlockerInput = MemoryActorContext & {
  title: string;
  blockerType: string;
  blockerText: string;
  severity?: number;
  sourceType: SourceType;
  sourceId: string;
  relatedContactId?: string | null;
  relatedCompanyId?: string | null;
  relatedOpportunityId?: string | null;
  relatedMeetingId?: string | null;
};

export async function getBlockers(input: {
  workspaceId: string;
  relatedContactId?: string;
  relatedCompanyId?: string;
  relatedOpportunityId?: string;
  relatedMeetingId?: string;
  query?: string;
  status?: BlockerStatus;
  onlyActive?: boolean;
}) {
  return db.blocker.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.relatedContactId ? { relatedContactId: input.relatedContactId } : {}),
      ...(input.relatedCompanyId ? { relatedCompanyId: input.relatedCompanyId } : {}),
      ...(input.relatedOpportunityId ? { relatedOpportunityId: input.relatedOpportunityId } : {}),
      ...(input.relatedMeetingId ? { relatedMeetingId: input.relatedMeetingId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.onlyActive
        ? {
            status: {
              in: [BlockerStatus.OPEN, BlockerStatus.MONITORING],
            },
          }
        : {}),
      ...(input.query
        ? {
            OR: [{ title: { contains: input.query } }, { blockerText: { contains: input.query } }, { blockerType: { contains: input.query } }],
          }
        : {}),
    },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createBlocker(input: CreateBlockerInput) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  await assertWorkspaceRelatedObjectOwnership({
    workspaceId: input.workspaceId,
    contactId: input.relatedContactId,
    companyId: input.relatedCompanyId,
    opportunityId: input.relatedOpportunityId,
    meetingId: input.relatedMeetingId,
  });

  const created = await db.blocker.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      blockerType: input.blockerType,
      blockerText: input.blockerText,
      severity: input.severity ?? 70,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      relatedContactId: input.relatedContactId ?? undefined,
      relatedCompanyId: input.relatedCompanyId ?? undefined,
      relatedOpportunityId: input.relatedOpportunityId ?? undefined,
      relatedMeetingId: input.relatedMeetingId ?? undefined,
    },
  });

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    actionType: "BLOCKER_CREATED",
    targetType: "Blocker",
    targetId: created.id,
    summary: `新增阻塞：${created.title}`,
    eventName: "blocker_created",
    eventCategory: "memory",
    metadata: {
      blockerType: created.blockerType,
      severity: created.severity,
      relatedOpportunityId: created.relatedOpportunityId,
      relatedContactId: created.relatedContactId,
    },
  });

  if (created.relatedOpportunityId) {
    await createMemoryFact({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? ActorType.SYSTEM,
      sourcePage: input.sourcePage,
      objectType: ObjectType.OPPORTUNITY,
      objectId: created.relatedOpportunityId,
      factType: MemoryFactType.BLOCKER,
      title: created.title,
      content: created.blockerText,
      sourceType: created.sourceType,
      sourceId: created.id,
      confidence: 78,
      importance: Math.max(created.severity, 70),
      freshnessScore: Math.max(created.severity, 70),
    }).catch(() => null);
  }

  try {
    await recordBlockerDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.SYSTEM,
      sourcePage: input.sourcePage,
      blockerId: created.id,
      relatedOpportunityId: created.relatedOpportunityId,
      eventType: "blocker_created",
      blockerType: created.blockerType,
      title: created.title,
      severity: created.severity,
    });

    if (!input.suppressEvolutionRefresh) {
      await refreshEvolutionState({
        workspaceId: input.workspaceId,
        actorId: input.actorUserId,
        actorType: input.actorType ?? ActorType.SYSTEM,
        sourcePage: input.sourcePage,
        trigger: "blocker_created",
      });
    }
  } catch (error) {
    console.error("blocker evolution refresh failed", error);
  }

  return created;
}

export async function resolveBlocker(input: MemoryActorContext & {
  blockerId: string;
  resolutionNote?: string | null;
}) {
  return updateBlockerStatus({
    ...input,
    status: BlockerStatus.RESOLVED,
  });
}

export async function updateBlockerStatus(input: MemoryActorContext & {
  blockerId: string;
  status: BlockerStatus;
  resolutionNote?: string | null;
}) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  await assertWorkspaceBlockerOwnership(input.workspaceId, input.blockerId);

  const existing = await db.blocker.findFirst({
    where: { id: input.blockerId },
  });

  if (!existing) {
    throw new Error("未找到对应阻塞");
  }

  const updated = await db.blocker.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      resolutionNote: input.resolutionNote ?? existing.resolutionNote,
      resolvedAt: input.status === BlockerStatus.RESOLVED ? new Date() : null,
    },
  });

  const eventName =
    input.status === BlockerStatus.RESOLVED
      ? "blocker_resolved"
      : existing.status === BlockerStatus.RESOLVED && input.status === BlockerStatus.OPEN
        ? "blocker_reopened"
        : "blocker_status_updated";

  const summary =
    input.status === BlockerStatus.RESOLVED
      ? `解决阻塞：${updated.title}`
      : existing.status === BlockerStatus.RESOLVED && input.status === BlockerStatus.OPEN
        ? `重新打开阻塞：${updated.title}`
        : `更新阻塞状态：${updated.title} → ${updated.status}`;

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.USER,
    sourcePage: input.sourcePage,
    actionType: input.status === BlockerStatus.RESOLVED ? "BLOCKER_RESOLVED" : "BLOCKER_STATUS_UPDATED",
    targetType: "Blocker",
    targetId: updated.id,
    summary,
    eventName,
    eventCategory: "memory",
    metadata: {
      previousStatus: existing.status,
      nextStatus: updated.status,
      resolutionNote: input.resolutionNote ?? null,
      relatedOpportunityId: updated.relatedOpportunityId,
    },
  });

  try {
    await recordBlockerDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      blockerId: updated.id,
      relatedOpportunityId: updated.relatedOpportunityId,
      eventType:
        input.status === BlockerStatus.RESOLVED
          ? "blocker_resolved"
          : "blocker_status_updated",
      blockerType: updated.blockerType,
      title: updated.title,
      severity: updated.severity,
      resolutionNote: input.resolutionNote ?? updated.resolutionNote ?? null,
    });

    if (!input.suppressEvolutionRefresh) {
      await refreshEvolutionState({
        workspaceId: input.workspaceId,
        actorId: input.actorUserId,
        actorType: input.actorType ?? ActorType.USER,
        sourcePage: input.sourcePage,
        trigger: input.status === BlockerStatus.RESOLVED ? "blocker_resolved" : "blocker_status_updated",
      });
    }
  } catch (error) {
    console.error("blocker status evolution refresh failed", error);
  }

  return updated;
}

export function buildMeetingBlockerDrafts(input: MemoryActorContext & MeetingBlockerExtractionInput) {
  return extractMeetingBlockerDrafts(input);
}

export async function getBlockersForObject(args: {
  workspaceId: string;
  objectType: ObjectType;
  objectId: string;
  onlyActive?: boolean;
}) {
  const onlyActive = args.onlyActive ?? false;
  if (args.objectType === ObjectType.CONTACT) {
    return getBlockers({ workspaceId: args.workspaceId, relatedContactId: args.objectId, onlyActive });
  }
  if (args.objectType === ObjectType.COMPANY) {
    return getBlockers({ workspaceId: args.workspaceId, relatedCompanyId: args.objectId, onlyActive });
  }
  if (args.objectType === ObjectType.OPPORTUNITY) {
    return getBlockers({ workspaceId: args.workspaceId, relatedOpportunityId: args.objectId, onlyActive });
  }
  if (args.objectType === ObjectType.MEETING) {
    return getBlockers({ workspaceId: args.workspaceId, relatedMeetingId: args.objectId, onlyActive });
  }
  return [];
}

export function summarizeBlocker(blocker: { title: string; severity: number; blockerText: string }) {
  return `${blockerSeverityTone(blocker.severity)}：${blocker.title || blocker.blockerText}`;
}
