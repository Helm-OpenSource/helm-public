import { ActorType, CommitmentStatus, ObjectType, SourceType } from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import {
  assertWorkspaceCommitmentOwnership,
  assertWorkspaceRelatedObjectOwnership,
} from "@/lib/auth/tenant-ownership";
import { db } from "@/lib/db";
import { recordCommitmentDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import { extractMeetingCommitmentDrafts, type MeetingCommitmentExtractionInput } from "@/lib/memory/commitment-extraction.service";
import {
  type MemoryActorContext,
  deriveCommitmentStatus,
  deriveOverdueFlag,
  writeMemoryAuditAndEvent,
} from "@/lib/memory/shared";

export type CreateCommitmentInput = MemoryActorContext & {
  title: string;
  commitmentText: string;
  sourceType: SourceType;
  sourceId: string;
  relatedContactId?: string | null;
  relatedCompanyId?: string | null;
  relatedOpportunityId?: string | null;
  relatedMeetingId?: string | null;
  ownerUserId?: string | null;
  dueDate?: Date | null;
  status?: CommitmentStatus;
  priority?: number;
  confidence?: number;
  statusNote?: string | null;
};

export async function getCommitments(input: {
  workspaceId: string;
  relatedContactId?: string;
  relatedCompanyId?: string;
  relatedOpportunityId?: string;
  relatedMeetingId?: string;
  query?: string;
  status?: CommitmentStatus;
  onlyOpen?: boolean;
}) {
  const rows = await db.commitment.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.relatedContactId ? { relatedContactId: input.relatedContactId } : {}),
      ...(input.relatedCompanyId ? { relatedCompanyId: input.relatedCompanyId } : {}),
      ...(input.relatedOpportunityId ? { relatedOpportunityId: input.relatedOpportunityId } : {}),
      ...(input.relatedMeetingId ? { relatedMeetingId: input.relatedMeetingId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.onlyOpen
        ? {
            status: {
              in: [CommitmentStatus.OPEN, CommitmentStatus.IN_PROGRESS, CommitmentStatus.OVERDUE],
            },
          }
        : {}),
      ...(input.query
        ? {
            OR: [{ title: { contains: input.query } }, { commitmentText: { contains: input.query } }],
          }
        : {}),
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  return rows.map((row) => ({
    ...row,
    status: deriveCommitmentStatus(row),
    overdueFlag: deriveOverdueFlag(row),
  }));
}

export async function createCommitment(input: CreateCommitmentInput) {
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

  const nextStatus = deriveCommitmentStatus({
    dueDate: input.dueDate,
    status: input.status,
  });

  const created = await db.commitment.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      commitmentText: input.commitmentText,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      relatedContactId: input.relatedContactId ?? undefined,
      relatedCompanyId: input.relatedCompanyId ?? undefined,
      relatedOpportunityId: input.relatedOpportunityId ?? undefined,
      relatedMeetingId: input.relatedMeetingId ?? undefined,
      ownerUserId: input.ownerUserId ?? undefined,
      dueDate: input.dueDate ?? undefined,
      status: nextStatus,
      priority: input.priority ?? 60,
      overdueFlag: deriveOverdueFlag({ dueDate: input.dueDate, status: nextStatus }),
      confidence: input.confidence ?? 72,
      statusNote: input.statusNote ?? undefined,
    },
  });

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    actionType: "COMMITMENT_CREATED",
    targetType: "Commitment",
    targetId: created.id,
    summary: `新增承诺：${created.title}`,
    eventName: "commitment_created",
    eventCategory: "memory",
    metadata: {
      relatedOpportunityId: created.relatedOpportunityId,
      relatedContactId: created.relatedContactId,
      dueDate: created.dueDate,
      status: created.status,
    },
  });

  try {
    await recordCommitmentDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.SYSTEM,
      sourcePage: input.sourcePage,
      commitmentId: created.id,
      relatedOpportunityId: created.relatedOpportunityId,
      eventType: created.status === CommitmentStatus.OVERDUE ? "commitment_overdue" : "commitment_status_updated",
      previousStatus: null,
      nextStatus: created.status,
      title: created.title,
    });

    if (!input.suppressEvolutionRefresh) {
      await refreshEvolutionState({
        workspaceId: input.workspaceId,
        actorId: input.actorUserId,
        actorType: input.actorType ?? ActorType.SYSTEM,
        sourcePage: input.sourcePage,
        trigger: "commitment_created",
      });
    }
  } catch (error) {
    console.error("commitment evolution refresh failed", error);
  }

  return created;
}

export async function updateCommitmentStatus(input: MemoryActorContext & {
  commitmentId: string;
  status: CommitmentStatus;
  statusNote?: string | null;
}) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  await assertWorkspaceCommitmentOwnership(input.workspaceId, input.commitmentId);

  const existing = await db.commitment.findFirst({
    where: { id: input.commitmentId },
  });

  if (!existing) {
    throw new Error("未找到对应承诺");
  }

  const updated = await db.commitment.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      overdueFlag: input.status === CommitmentStatus.OVERDUE,
      fulfilledAt: input.status === CommitmentStatus.FULFILLED ? new Date() : null,
      statusNote: input.statusNote ?? existing.statusNote,
    },
  });

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.USER,
    sourcePage: input.sourcePage,
    actionType: "COMMITMENT_STATUS_UPDATED",
    targetType: "Commitment",
    targetId: updated.id,
    summary: `更新承诺状态：${updated.title} → ${updated.status}`,
    eventName: updated.status === CommitmentStatus.FULFILLED ? "commitment_fulfilled" : "commitment_status_updated",
    eventCategory: "memory",
    metadata: {
      previousStatus: existing.status,
      nextStatus: updated.status,
      relatedOpportunityId: updated.relatedOpportunityId,
      relatedContactId: updated.relatedContactId,
      note: input.statusNote ?? null,
    },
  });

  try {
    await recordCommitmentDelta({
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      actorType: input.actorType ?? ActorType.USER,
      sourcePage: input.sourcePage,
      commitmentId: updated.id,
      relatedOpportunityId: updated.relatedOpportunityId,
      eventType:
        updated.status === CommitmentStatus.OVERDUE
          ? "commitment_overdue"
          : updated.status === CommitmentStatus.FULFILLED
            ? "commitment_fulfilled"
            : "commitment_status_updated",
      previousStatus: existing.status,
      nextStatus: updated.status,
      title: updated.title,
    });

    if (!input.suppressEvolutionRefresh) {
      await refreshEvolutionState({
        workspaceId: input.workspaceId,
        actorId: input.actorUserId,
        actorType: input.actorType ?? ActorType.USER,
        sourcePage: input.sourcePage,
        trigger: "commitment_status_updated",
      });
    }
  } catch (error) {
    console.error("commitment status evolution refresh failed", error);
  }

  return updated;
}

export function buildMeetingCommitmentDrafts(input: MemoryActorContext & MeetingCommitmentExtractionInput) {
  return extractMeetingCommitmentDrafts(input);
}

export async function getCommitmentsForObject(args: {
  workspaceId: string;
  objectType: ObjectType;
  objectId: string;
}) {
  if (args.objectType === ObjectType.CONTACT) {
    return getCommitments({ workspaceId: args.workspaceId, relatedContactId: args.objectId });
  }
  if (args.objectType === ObjectType.COMPANY) {
    return getCommitments({ workspaceId: args.workspaceId, relatedCompanyId: args.objectId });
  }
  if (args.objectType === ObjectType.OPPORTUNITY) {
    return getCommitments({ workspaceId: args.workspaceId, relatedOpportunityId: args.objectId });
  }
  if (args.objectType === ObjectType.MEETING) {
    return getCommitments({ workspaceId: args.workspaceId, relatedMeetingId: args.objectId });
  }
  return [];
}
