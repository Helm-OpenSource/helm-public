import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  RiskLevel,
  SourceType,
} from "@prisma/client";
import { addDays } from "date-fns";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import type {
  TenantResourceManualProofRecordInput,
  TenantResourceManualProofRecordStatus,
} from "@/lib/tenant-resources/manual-proof-lifecycle";
import { jsonStringify, safeParseJson } from "@/lib/utils";

const TENANT_RESOURCE_MANUAL_PROOF_KIND = "tenant_resource_manual_proof";
const DEFAULT_EXPIRY_DAYS = 7;

type TenantResourceManualProofMetadata = {
  kind: typeof TENANT_RESOURCE_MANUAL_PROOF_KIND;
  version: 1;
  resourceKey: string;
  resourceName: string;
  actionRef: string;
  provider: string;
  proofStatus: TenantResourceManualProofRecordStatus;
  evidenceRefs: string[];
  submittedBy: string;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewStartedBy: string | null;
  reviewStartedAt: string | null;
  expiresAt: string | null;
  failureReason: string | null;
  note: string | null;
};

type ManualProofActionRow = Awaited<
  ReturnType<typeof db.actionItem.findFirstOrThrow>
>;

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

function normalizeIsoString(value: string | Date | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function parseManualProofMetadata(
  value?: string | null,
): TenantResourceManualProofMetadata | null {
  const parsed = safeParseJson<TenantResourceManualProofMetadata | null>(
    value,
    null,
  );
  if (!parsed || parsed.kind !== TENANT_RESOURCE_MANUAL_PROOF_KIND) {
    return null;
  }
  return parsed;
}

function buildManualProofMetadata(input: {
  resourceKey: string;
  resourceName: string;
  actionRef: string;
  provider: string;
  proofStatus: TenantResourceManualProofRecordStatus;
  evidenceRefs: string[];
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewStartedBy?: string | null;
  reviewStartedAt?: string | null;
  expiresAt?: string | null;
  failureReason?: string | null;
  note?: string | null;
}): TenantResourceManualProofMetadata {
  return {
    kind: TENANT_RESOURCE_MANUAL_PROOF_KIND,
    version: 1,
    resourceKey: input.resourceKey,
    resourceName: input.resourceName,
    actionRef: input.actionRef,
    provider: input.provider,
    proofStatus: input.proofStatus,
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    submittedBy: input.submittedBy,
    submittedAt: input.submittedAt,
    reviewedBy: input.reviewedBy ?? null,
    reviewedAt: input.reviewedAt ?? null,
    reviewStartedBy: input.reviewStartedBy ?? null,
    reviewStartedAt: input.reviewStartedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    failureReason: input.failureReason ?? null,
    note: normalizeOptionalText(input.note),
  };
}

function effectiveProofStatus(
  metadata: TenantResourceManualProofMetadata,
  now: Date,
): TenantResourceManualProofRecordStatus {
  if (
    (metadata.proofStatus === "SUBMITTED" ||
      metadata.proofStatus === "UNDER_REVIEW") &&
    metadata.expiresAt &&
    new Date(metadata.expiresAt).getTime() < now.getTime()
  ) {
    return "EXPIRED";
  }

  return metadata.proofStatus;
}

function toManualProofRecord(
  row: ManualProofActionRow,
  now: Date,
): TenantResourceManualProofRecordInput | null {
  const metadata = parseManualProofMetadata(row.metadata);
  if (!metadata) return null;

  return {
    proofId: row.id,
    resourceKey: metadata.resourceKey,
    actionRef: metadata.actionRef,
    status: effectiveProofStatus(metadata, now),
    submittedBy: metadata.submittedBy,
    submittedAt: metadata.submittedAt,
    reviewedBy: metadata.reviewedBy,
    reviewedAt: metadata.reviewedAt,
    expiresAt: metadata.expiresAt,
    evidenceRefs: metadata.evidenceRefs,
    failureReason: metadata.failureReason,
  };
}

async function getManualProofActionOrThrow(input: {
  workspaceId: string;
  proofId: string;
}) {
  const action = await db.actionItem.findFirst({
    where: {
      id: input.proofId,
      workspaceId: input.workspaceId,
      metadata: {
        contains: `"kind": "${TENANT_RESOURCE_MANUAL_PROOF_KIND}"`,
      },
    },
    include: {
      approvalTask: true,
    },
  });

  if (!action) {
    throw new Error("tenant_resource_manual_proof_not_found");
  }

  const metadata = parseManualProofMetadata(action.metadata);
  if (!metadata || !action.approvalTask) {
    throw new Error("tenant_resource_manual_proof_invalid");
  }

  return {
    action,
    metadata,
  };
}

export async function listTenantResourceManualProofRecords(
  workspaceId: string,
  now = new Date(),
): Promise<TenantResourceManualProofRecordInput[]> {
  const rows = await db.actionItem.findMany({
    where: {
      workspaceId,
      metadata: {
        contains: `"kind": "${TENANT_RESOURCE_MANUAL_PROOF_KIND}"`,
      },
    },
    include: {
      approvalTask: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return rows
    .map((row) => toManualProofRecord(row, now))
    .filter((row): row is TenantResourceManualProofRecordInput => Boolean(row));
}

export async function submitTenantResourceManualProof(input: {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  resourceKey: string;
  resourceName: string;
  provider: string;
  actionRef: string;
  evidenceRefs: string[];
  note: string;
  sourcePage?: string | null;
  expiresAt?: string | Date | null;
}) {
  const now = new Date();
  const submittedAt = now.toISOString();
  const expiresAt = normalizeIsoString(
    input.expiresAt ?? addDays(now, DEFAULT_EXPIRY_DAYS),
  );
  const existingRecords = await listTenantResourceManualProofRecords(
    input.workspaceId,
    now,
  );
  const duplicate = existingRecords.find(
    (record) =>
      record.resourceKey === input.resourceKey &&
      record.actionRef === input.actionRef &&
      ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED"].includes(record.status),
  );
  if (duplicate) {
    throw new Error("tenant_resource_manual_proof_already_open");
  }

  const note = normalizeOptionalText(input.note);
  if (!note) {
    throw new Error("tenant_resource_manual_proof_note_required");
  }

  const metadata = buildManualProofMetadata({
    resourceKey: input.resourceKey,
    resourceName: input.resourceName,
    actionRef: input.actionRef,
    provider: input.provider,
    proofStatus: "SUBMITTED",
    evidenceRefs: input.evidenceRefs,
    submittedBy: input.actorName,
    submittedAt,
    expiresAt,
    note,
  });

  const created = await db.$transaction(async (tx) => {
    const actionItem = await tx.actionItem.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.actorUserId,
        actionType: ActionType.DRAFT_INTERNAL_NOTE,
        title: `Tenant resource proof · ${input.resourceName}`,
        description:
          "Manual proof for a tenant-resource governed loop. This review path is local-only and does not create external write authority.",
        aiReason:
          "Persisted proof keeps follow-through, review and later guarded-write pilot posture inspectable without creating external execution authority.",
        draftContent: note,
        metadata: jsonStringify(metadata),
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId: `tenant-resource-manual-proof:${input.resourceKey}:${input.actionRef}:${submittedAt}`,
        riskLevel: RiskLevel.MEDIUM,
        dueDate: expiresAt ? new Date(expiresAt) : null,
        executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
        requiresApproval: true,
        status: ActionStatus.PENDING_APPROVAL,
        executionStatus: "tenant_resource_manual_proof_submitted",
        statusReason: "Manual proof requires explicit review before it may close follow-through.",
      },
    });
    const approvalTask = await tx.approvalTask.create({
      data: {
        workspaceId: input.workspaceId,
        actionItemId: actionItem.id,
        status: ApprovalStatus.PENDING,
        autoExecute: false,
        contextSnapshot: note,
        reasoning:
          "Review whether the submitted manual proof is sufficient to support follow-through learning. This is not official write success.",
        editableContent: note,
        resultPreview:
          "Accepted proof will only close the local proof seam. It will not external-write, send, or claim official success.",
        decisionReason:
          "Manual proof needs explicit review before it may support later guarded-write pilot posture.",
        channel: "Tenant resource proof",
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
    actionType: "TENANT_RESOURCE_MANUAL_PROOF_SUBMITTED",
    targetType: "ActionItem",
    targetId: created.actionItem.id,
    summary: `Submitted tenant resource manual proof for ${input.resourceName}`,
    payload: {
      resourceKey: input.resourceKey,
      actionRef: input.actionRef,
      evidenceRefs: metadata.evidenceRefs,
      expiresAt,
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: input.resourceKey,
  });

  return {
    proofId: created.actionItem.id,
    approvalTaskId: created.approvalTask.id,
  };
}

export async function startTenantResourceManualProofReview(input: {
  workspaceId: string;
  reviewerId: string;
  reviewerName: string;
  proofId: string;
  sourcePage?: string | null;
}) {
  const now = new Date().toISOString();
  const { action, metadata } = await getManualProofActionOrThrow({
    workspaceId: input.workspaceId,
    proofId: input.proofId,
  });
  const status = effectiveProofStatus(metadata, new Date(now));
  if (status !== "SUBMITTED") {
    throw new Error("tenant_resource_manual_proof_not_reviewable");
  }

  const nextMetadata = buildManualProofMetadata({
    ...metadata,
    proofStatus: "UNDER_REVIEW",
    reviewStartedBy: input.reviewerName,
    reviewStartedAt: now,
  });

  await db.$transaction([
    db.actionItem.update({
      where: { id: action.id },
      data: {
        metadata: jsonStringify(nextMetadata),
        statusReason: `Manual proof review started by ${input.reviewerName}.`,
        executionStatus: "tenant_resource_manual_proof_under_review",
      },
    }),
    db.approvalTask.update({
      where: { id: action.approvalTask!.id },
      data: {
        approverId: input.reviewerId,
      },
    }),
  ]);

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "TENANT_RESOURCE_MANUAL_PROOF_REVIEW_STARTED",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `Started tenant resource manual proof review for ${metadata.resourceName}`,
    payload: {
      resourceKey: metadata.resourceKey,
      actionRef: metadata.actionRef,
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: metadata.resourceKey,
  });
}

export async function reviewTenantResourceManualProof(input: {
  workspaceId: string;
  reviewerId: string;
  reviewerName: string;
  proofId: string;
  mode: "accept" | "reject";
  note?: string | null;
  sourcePage?: string | null;
}) {
  const reviewedAt = new Date().toISOString();
  const { action, metadata } = await getManualProofActionOrThrow({
    workspaceId: input.workspaceId,
    proofId: input.proofId,
  });
  const status = effectiveProofStatus(metadata, new Date(reviewedAt));
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(status)) {
    throw new Error("tenant_resource_manual_proof_not_reviewable");
  }

  const accepted = input.mode === "accept";
  const note = normalizeOptionalText(input.note);
  const nextMetadata = buildManualProofMetadata({
    ...metadata,
    proofStatus: accepted ? "ACCEPTED" : "REJECTED",
    reviewedBy: input.reviewerName,
    reviewedAt,
    failureReason: accepted ? null : note ?? "manual_proof_rejected",
    note: note ?? metadata.note,
  });

  await db.$transaction([
    db.actionItem.update({
      where: { id: action.id },
      data: {
        metadata: jsonStringify(nextMetadata),
        status: accepted ? ActionStatus.EXECUTED : ActionStatus.REJECTED,
        executedAt: accepted ? new Date(reviewedAt) : null,
        executionStatus: accepted
          ? "tenant_resource_manual_proof_accepted"
          : "tenant_resource_manual_proof_rejected",
        statusReason: accepted
          ? `Manual proof accepted by ${input.reviewerName}.`
          : `Manual proof rejected by ${input.reviewerName}.`,
      },
    }),
    db.approvalTask.update({
      where: { id: action.approvalTask!.id },
      data: {
        approverId: action.approvalTask!.approverId ?? input.reviewerId,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(reviewedAt),
        status: accepted ? ApprovalStatus.EXECUTED : ApprovalStatus.REJECTED,
      },
    }),
  ]);

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: accepted
      ? "TENANT_RESOURCE_MANUAL_PROOF_ACCEPTED"
      : "TENANT_RESOURCE_MANUAL_PROOF_REJECTED",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `${accepted ? "Accepted" : "Rejected"} tenant resource manual proof for ${metadata.resourceName}`,
    payload: {
      resourceKey: metadata.resourceKey,
      actionRef: metadata.actionRef,
      note,
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: metadata.resourceKey,
  });
}

export async function withdrawTenantResourceManualProof(input: {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  proofId: string;
  note?: string | null;
  sourcePage?: string | null;
}) {
  const { action, metadata } = await getManualProofActionOrThrow({
    workspaceId: input.workspaceId,
    proofId: input.proofId,
  });
  const status = effectiveProofStatus(metadata, new Date());
  if (!["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(status)) {
    throw new Error("tenant_resource_manual_proof_not_withdrawable");
  }

  const nextMetadata = buildManualProofMetadata({
    ...metadata,
    proofStatus: "WITHDRAWN",
    failureReason: normalizeOptionalText(input.note) ?? metadata.failureReason,
    note: normalizeOptionalText(input.note) ?? metadata.note,
  });

  await db.$transaction([
    db.actionItem.update({
      where: { id: action.id },
      data: {
        metadata: jsonStringify(nextMetadata),
        status: ActionStatus.WITHDRAWN,
        executionStatus: "tenant_resource_manual_proof_withdrawn",
        statusReason: `Manual proof withdrawn by ${input.actorName}.`,
      },
    }),
    db.approvalTask.update({
      where: { id: action.approvalTask!.id },
      data: {
        status: ApprovalStatus.WITHDRAWN,
      },
    }),
  ]);

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "TENANT_RESOURCE_MANUAL_PROOF_WITHDRAWN",
    targetType: "ActionItem",
    targetId: action.id,
    summary: `Withdrew tenant resource manual proof for ${metadata.resourceName}`,
    payload: {
      resourceKey: metadata.resourceKey,
      actionRef: metadata.actionRef,
      note: normalizeOptionalText(input.note),
    },
    sourcePage: input.sourcePage ?? "/settings",
    relatedObjectType: "TenantResource",
    relatedObjectId: metadata.resourceKey,
  });
}
