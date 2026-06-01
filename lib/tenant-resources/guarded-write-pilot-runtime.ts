import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { jsonStringify, safeParseJson } from "@/lib/utils";

const TENANT_RESOURCE_GUARDED_WRITE_PILOT_KIND =
  "tenant_resource_guarded_write_pilot";

export type TenantResourceGuardedWritePilotStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ACKNOWLEDGED";

export type TenantResourceGuardedWritePilotRecord = {
  pilotId: string;
  resourceKey: string;
  resourceName: string;
  actionRef: string;
  provider: string;
  proofId: string;
  status: TenantResourceGuardedWritePilotStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  evidenceRefs: string[];
  note: string | null;
};

type TenantResourceGuardedWritePilotMetadata = {
  kind: typeof TENANT_RESOURCE_GUARDED_WRITE_PILOT_KIND;
  version: 1;
  resourceKey: string;
  resourceName: string;
  actionRef: string;
  provider: string;
  proofId: string;
  status: TenantResourceGuardedWritePilotStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  evidenceRefs: string[];
  note: string | null;
};

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeOptionalText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function parsePilotMetadata(
  value?: string | null,
): TenantResourceGuardedWritePilotMetadata | null {
  const parsed = safeParseJson<TenantResourceGuardedWritePilotMetadata | null>(
    value,
    null,
  );
  if (!parsed || parsed.kind !== TENANT_RESOURCE_GUARDED_WRITE_PILOT_KIND) {
    return null;
  }
  return parsed;
}

function buildPilotMetadata(input: {
  resourceKey: string;
  resourceName: string;
  actionRef: string;
  provider: string;
  proofId: string;
  status: TenantResourceGuardedWritePilotStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  evidenceRefs: string[];
  note?: string | null;
}): TenantResourceGuardedWritePilotMetadata {
  return {
    kind: TENANT_RESOURCE_GUARDED_WRITE_PILOT_KIND,
    version: 1,
    resourceKey: input.resourceKey,
    resourceName: input.resourceName,
    actionRef: input.actionRef,
    provider: input.provider,
    proofId: input.proofId,
    status: input.status,
    requestedBy: input.requestedBy,
    requestedAt: input.requestedAt,
    reviewedBy: input.reviewedBy ?? null,
    reviewedAt: input.reviewedAt ?? null,
    acknowledgedBy: input.acknowledgedBy ?? null,
    acknowledgedAt: input.acknowledgedAt ?? null,
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    note: normalizeOptionalText(input.note),
  };
}

async function getPilotActionOrThrow(input: {
  workspaceId: string;
  pilotId: string;
}) {
  const action = await db.actionItem.findFirst({
    where: {
      id: input.pilotId,
      workspaceId: input.workspaceId,
      metadata: {
        contains: `"kind": "${TENANT_RESOURCE_GUARDED_WRITE_PILOT_KIND}"`,
      },
    },
    include: {
      approvalTask: true,
    },
  });
  if (!action) {
    throw new Error("tenant_resource_guarded_write_pilot_not_found");
  }
  const metadata = parsePilotMetadata(action.metadata);
  if (!metadata || !action.approvalTask) {
    throw new Error("tenant_resource_guarded_write_pilot_invalid");
  }
  return {
    action,
    metadata,
  };
}

export async function listTenantResourceGuardedWritePilotRecords(
  workspaceId: string,
): Promise<TenantResourceGuardedWritePilotRecord[]> {
  const rows = await db.actionItem.findMany({
    where: {
      workspaceId,
      metadata: {
        contains: `"kind": "${TENANT_RESOURCE_GUARDED_WRITE_PILOT_KIND}"`,
      },
    },
    include: {
      approvalTask: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return rows
    .map((row) => {
      const metadata = parsePilotMetadata(row.metadata);
      if (!metadata) return null;
      return {
        pilotId: row.id,
        resourceKey: metadata.resourceKey,
        resourceName: metadata.resourceName,
        actionRef: metadata.actionRef,
        provider: metadata.provider,
        proofId: metadata.proofId,
        status: metadata.status,
        requestedBy: metadata.requestedBy,
        requestedAt: metadata.requestedAt,
        reviewedBy: metadata.reviewedBy,
        reviewedAt: metadata.reviewedAt,
        acknowledgedBy: metadata.acknowledgedBy,
        acknowledgedAt: metadata.acknowledgedAt,
        evidenceRefs: metadata.evidenceRefs,
        note: metadata.note,
      };
    })
    .filter((row): row is TenantResourceGuardedWritePilotRecord => Boolean(row));
}

export async function requestTenantResourceGuardedWritePilot(input: {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  resourceKey: string;
  resourceName: string;
  provider: string;
  actionRef: string;
  proofId: string;
  evidenceRefs: string[];
  note?: string | null;
  sourcePage?: string | null;
}) {
  const existing = await listTenantResourceGuardedWritePilotRecords(
    input.workspaceId,
  );
  const duplicate = existing.find(
    (record) =>
      record.resourceKey === input.resourceKey &&
      record.actionRef === input.actionRef &&
      ["PENDING_REVIEW", "APPROVED", "ACKNOWLEDGED"].includes(record.status),
  );
  if (duplicate) {
    throw new Error("tenant_resource_guarded_write_pilot_already_open");
  }

  const requestedAt = new Date().toISOString();
  const metadata = buildPilotMetadata({
    resourceKey: input.resourceKey,
    resourceName: input.resourceName,
    actionRef: input.actionRef,
    provider: input.provider,
    proofId: input.proofId,
    status: "PENDING_REVIEW",
    requestedBy: input.actorName,
    requestedAt,
    evidenceRefs: input.evidenceRefs,
    note: input.note,
  });

  const created = await db.$transaction(async (tx) => {
    const actionItem = await tx.actionItem.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.actorUserId,
        actionType: ActionType.DRAFT_INTERNAL_NOTE,
        title: `Guarded write pilot · ${input.resourceName}`,
        description:
          "Local-only guarded write pilot request. This creates a reviewable candidate without external write execution.",
        aiReason:
          "Accepted proof plus eligible evaluation may enter a narrow guarded-write pilot, but the pilot still stays local-only until a later real write implementation exists.",
        draftContent: normalizeOptionalText(input.note),
        metadata: jsonStringify(metadata),
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId: `tenant-resource-guarded-write-pilot:${input.resourceKey}:${input.actionRef}:${requestedAt}`,
        riskLevel: RiskLevel.HIGH,
        executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
        requiresApproval: true,
        status: ActionStatus.PENDING_APPROVAL,
        executionStatus: "tenant_resource_guarded_write_pilot_pending_review",
        statusReason:
          "Guarded write pilot requires explicit review and still does not external-write.",
      },
    });
    const approvalTask = await tx.approvalTask.create({
      data: {
        workspaceId: input.workspaceId,
        actionItemId: actionItem.id,
        status: ApprovalStatus.PENDING,
        autoExecute: false,
        contextSnapshot: normalizeOptionalText(input.note),
        reasoning:
          "Review whether this resource-backed loop should enter the local guarded-write pilot. This does not create real CRM write authority.",
        editableContent: normalizeOptionalText(input.note),
        resultPreview:
          "Approved pilot still remains local-only and requires a separate acknowledgement before closeout.",
        decisionReason:
          "Only accepted proof plus eligible evaluation may request the narrow guarded-write pilot.",
        channel: "Tenant resource guarded write pilot",
      },
    });

    return {
      actionItem,
      approvalTask,
    };
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "TENANT_RESOURCE_GUARDED_WRITE_PILOT_REQUESTED",
    targetType: "ActionItem",
    targetId: created.actionItem.id,
    summary: `Requested tenant resource guarded write pilot for ${input.resourceName}`,
    payload: {
      resourceKey: input.resourceKey,
      actionRef: input.actionRef,
      proofId: input.proofId,
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: input.resourceKey,
  });

  return {
    pilotId: created.actionItem.id,
    approvalTaskId: created.approvalTask.id,
  };
}

export async function reviewTenantResourceGuardedWritePilot(input: {
  workspaceId: string;
  reviewerId: string;
  reviewerName: string;
  pilotId: string;
  mode: "approve" | "reject";
  note?: string | null;
  sourcePage?: string | null;
}) {
  const { action, metadata } = await getPilotActionOrThrow({
    workspaceId: input.workspaceId,
    pilotId: input.pilotId,
  });
  if (metadata.status !== "PENDING_REVIEW") {
    throw new Error("tenant_resource_guarded_write_pilot_not_reviewable");
  }

  const reviewedAt = new Date().toISOString();
  const approved = input.mode === "approve";
  const nextMetadata = buildPilotMetadata({
    ...metadata,
    status: approved ? "APPROVED" : "REJECTED",
    reviewedBy: input.reviewerName,
    reviewedAt,
    note: input.note ?? metadata.note,
  });

  await db.$transaction([
    db.actionItem.update({
      where: { id: action.id },
      data: {
        metadata: jsonStringify(nextMetadata),
        status: approved ? ActionStatus.APPROVED : ActionStatus.REJECTED,
        executionStatus: approved
          ? "tenant_resource_guarded_write_pilot_approved"
          : "tenant_resource_guarded_write_pilot_rejected",
        statusReason: approved
          ? `Guarded write pilot approved by ${input.reviewerName}.`
          : `Guarded write pilot rejected by ${input.reviewerName}.`,
      },
    }),
    db.approvalTask.update({
      where: { id: action.approvalTask!.id },
      data: {
        approverId: input.reviewerId,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(reviewedAt),
        status: approved ? ApprovalStatus.EXECUTED : ApprovalStatus.REJECTED,
      },
    }),
  ]);

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: approved
      ? "TENANT_RESOURCE_GUARDED_WRITE_PILOT_APPROVED"
      : "TENANT_RESOURCE_GUARDED_WRITE_PILOT_REJECTED",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `${approved ? "Approved" : "Rejected"} tenant resource guarded write pilot for ${metadata.resourceName}`,
    payload: {
      resourceKey: metadata.resourceKey,
      actionRef: metadata.actionRef,
      proofId: metadata.proofId,
      note: normalizeOptionalText(input.note),
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: metadata.resourceKey,
  });
}

export async function acknowledgeTenantResourceGuardedWritePilot(input: {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  pilotId: string;
  note?: string | null;
  sourcePage?: string | null;
}) {
  const { action, metadata } = await getPilotActionOrThrow({
    workspaceId: input.workspaceId,
    pilotId: input.pilotId,
  });
  if (metadata.status !== "APPROVED") {
    throw new Error("tenant_resource_guarded_write_pilot_not_acknowledgeable");
  }

  const acknowledgedAt = new Date().toISOString();
  const nextMetadata = buildPilotMetadata({
    ...metadata,
    status: "ACKNOWLEDGED",
    acknowledgedBy: input.actorName,
    acknowledgedAt,
    note: input.note ?? metadata.note,
  });

  await db.actionItem.update({
    where: { id: action.id },
    data: {
      metadata: jsonStringify(nextMetadata),
      status: ActionStatus.EXECUTED,
      executedAt: new Date(acknowledgedAt),
      executionStatus: "tenant_resource_guarded_write_pilot_acknowledged",
      statusReason: `Guarded write pilot acknowledged by ${input.actorName}.`,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "TENANT_RESOURCE_GUARDED_WRITE_PILOT_ACKNOWLEDGED",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `Acknowledged tenant resource guarded write pilot for ${metadata.resourceName}`,
    payload: {
      resourceKey: metadata.resourceKey,
      actionRef: metadata.actionRef,
      proofId: metadata.proofId,
      note: normalizeOptionalText(input.note),
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: metadata.resourceKey,
  });
}
