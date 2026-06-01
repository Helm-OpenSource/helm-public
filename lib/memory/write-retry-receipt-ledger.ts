import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type {
  MemoryWriteRetryContractItem,
  MemoryWriteRetryContractOverview,
} from "@/lib/memory/write-failure-retry-contract";

export const MEMORY_WRITE_RETRY_RECEIPT_AUDIT_ACTION = "MEMORY_WRITE_RETRY_RECEIPT_RECORDED";

export type MemoryWriteRetryOwnerAssignment = {
  targetType: string;
  targetId: string;
  objectTitle: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type MemoryWriteRetryReceiptAudit = {
  id: string;
  targetType: string;
  targetId: string;
  summary: string;
  payload: string | null;
  userId?: string | null;
  actor?: string | null;
  createdAt: Date;
};

export type MemoryWriteRetryReceiptStatus =
  | "pending_manual_confirmation"
  | "confirmed_ready_for_executor"
  | "blocked"
  | "dismissed";

export type MemoryWriteRetryReceiptPayload = {
  receiptVersion: "memory_write_retry_receipt_v1";
  receiptStatus: MemoryWriteRetryReceiptStatus;
  retryContractItemId: string;
  sourceAuditId: string;
  queueItemId: string;
  targetType: string;
  targetId: string;
  title: string | null;
  objectType: string | null;
  objectId: string | null;
  factType: string | null;
  sourceType: string | null;
  sourceId: string | null;
  idempotencyLockKey: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  retryMode: "manual_confirmed_rebuild_only";
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  attemptLimit: number;
  plannedAttemptCount: 0;
  backoffPolicy: {
    strategy: "bounded_exponential";
    delaysMinutes: number[];
  };
  missingInputs: MemoryWriteRetryContractItem["missingInputs"];
  requiredManualChecks: MemoryWriteRetryContractItem["requiredManualChecks"];
  confirmationNote: string | null;
  boundaryNote: string;
};

export type MemoryWriteRetryReceiptLedgerItem = {
  id: string;
  retryContractItemId: string;
  queueItemId: string;
  auditId: string;
  targetType: string;
  targetId: string;
  title: string | null;
  objectType: string | null;
  objectId: string | null;
  factType: string | null;
  sourceType: string | null;
  sourceId: string | null;
  contractStatus: MemoryWriteRetryContractItem["contractStatus"];
  retryMode: "manual_confirmed_rebuild_only";
  idempotencyLockKey: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLabel: string;
  ownerReviewStatus: "owner_assigned" | "owner_missing";
  receiptAuditId: string | null;
  receiptCreatedAt: string | null;
  receiptStatus: MemoryWriteRetryReceiptStatus | "missing_receipt" | "invalid_receipt_payload";
  receiptPayloadStatus: "valid" | "missing" | "malformed";
  attemptLimit: number;
  backoffDelaysMinutes: number[];
  plannedAttemptCount: number | null;
  missingInputs: MemoryWriteRetryContractItem["missingInputs"];
  requiredManualChecks: MemoryWriteRetryContractItem["requiredManualChecks"];
  nextOperatorAction:
    | "assign_owner_before_review"
    | "record_retry_receipt"
    | "confirm_or_dismiss_receipt"
    | "ready_for_later_executor_after_manual_confirmation"
    | "resolve_blocking_contract"
    | "inspect_receipt_payload"
    | "no_action_dismissed";
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  boundaryNote: string;
};

export type MemoryWriteRetryReceiptLedgerOverview = {
  ledgerItemCount: number;
  receiptAuditCount: number;
  persistedReceiptCount: number;
  missingReceiptCount: number;
  pendingManualConfirmationCount: number;
  confirmedReadyForExecutorCount: number;
  blockedReceiptCount: number;
  dismissedReceiptCount: number;
  invalidReceiptPayloadCount: number;
  ownerAssignedCount: number;
  ownerMissingCount: number;
  executableAutomaticallyCount: 0;
  items: MemoryWriteRetryReceiptLedgerItem[];
  boundaryNote: string;
};

type ParsedReceiptAudit = {
  audit: MemoryWriteRetryReceiptAudit;
  payload: Partial<MemoryWriteRetryReceiptPayload>;
  payloadStatus: "valid" | "malformed";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberArrayValue(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : [];
}

function parseReceiptAudit(audit: MemoryWriteRetryReceiptAudit): ParsedReceiptAudit {
  if (!audit.payload?.trim()) {
    return { audit, payload: {}, payloadStatus: "malformed" };
  }

  try {
    const parsed = JSON.parse(audit.payload) as unknown;
    if (!isRecord(parsed)) {
      return { audit, payload: {}, payloadStatus: "malformed" };
    }

    return {
      audit,
      payload: parsed as Partial<MemoryWriteRetryReceiptPayload>,
      payloadStatus: "valid",
    };
  } catch {
    return { audit, payload: {}, payloadStatus: "malformed" };
  }
}

function normalizeReceiptStatus(value: unknown): MemoryWriteRetryReceiptStatus | null {
  if (value === "plan_only_pending_manual_confirmation") return "pending_manual_confirmation";
  if (
    value === "pending_manual_confirmation" ||
    value === "confirmed_ready_for_executor" ||
    value === "blocked" ||
    value === "dismissed"
  ) {
    return value;
  }

  return null;
}

function targetKey(targetType: string, targetId: string) {
  return `${targetType}:${targetId}`;
}

function matchKeysForContractItem(item: MemoryWriteRetryContractItem) {
  return [
    item.idempotencyLockKey ? `lock:${item.idempotencyLockKey}` : null,
    `queue:${item.queueItemId}`,
    `contract:${item.id}`,
  ].filter((value): value is string => Boolean(value));
}

function matchKeysForReceiptPayload(payload: Partial<MemoryWriteRetryReceiptPayload>) {
  return [
    payload.idempotencyLockKey ? `lock:${payload.idempotencyLockKey}` : null,
    payload.queueItemId ? `queue:${payload.queueItemId}` : null,
    payload.retryContractItemId ? `contract:${payload.retryContractItemId}` : null,
  ].filter((value): value is string => Boolean(value));
}

function defaultReceiptStatus(item: MemoryWriteRetryContractItem): MemoryWriteRetryReceiptStatus {
  return item.contractStatus === "manual_confirmation_required" ? "pending_manual_confirmation" : "blocked";
}

function resolveRequestedReceiptStatus(
  item: MemoryWriteRetryContractItem,
  requestedStatus?: MemoryWriteRetryReceiptStatus,
) {
  const receiptStatus = requestedStatus ?? defaultReceiptStatus(item);

  if (receiptStatus === "confirmed_ready_for_executor" && item.contractStatus !== "manual_confirmation_required") {
    throw new Error("Cannot confirm a memory write retry receipt while the retry contract is blocked.");
  }

  return receiptStatus;
}

function nextOperatorAction(args: {
  item: MemoryWriteRetryContractItem;
  receiptStatus: MemoryWriteRetryReceiptLedgerItem["receiptStatus"];
  ownerReviewStatus: MemoryWriteRetryReceiptLedgerItem["ownerReviewStatus"];
}): MemoryWriteRetryReceiptLedgerItem["nextOperatorAction"] {
  if (args.receiptStatus === "invalid_receipt_payload") return "inspect_receipt_payload";
  if (args.item.contractStatus !== "manual_confirmation_required") return "resolve_blocking_contract";
  if (args.ownerReviewStatus === "owner_missing") return "assign_owner_before_review";
  if (args.receiptStatus === "missing_receipt") return "record_retry_receipt";
  if (args.receiptStatus === "pending_manual_confirmation") return "confirm_or_dismiss_receipt";
  if (args.receiptStatus === "confirmed_ready_for_executor") {
    return "ready_for_later_executor_after_manual_confirmation";
  }
  if (args.receiptStatus === "dismissed") return "no_action_dismissed";

  return "resolve_blocking_contract";
}

function buildReceiptIndex(receiptAudits: MemoryWriteRetryReceiptAudit[]) {
  const parsedAudits = receiptAudits.map(parseReceiptAudit);
  const index = new Map<string, ParsedReceiptAudit>();

  for (const parsed of parsedAudits) {
    if (parsed.payloadStatus !== "valid") continue;

    for (const key of matchKeysForReceiptPayload(parsed.payload)) {
      if (!index.has(key)) {
        index.set(key, parsed);
      }
    }
  }

  return {
    index,
    invalidReceiptPayloadCount: parsedAudits.filter((item) => item.payloadStatus !== "valid").length,
  };
}

export function buildMemoryWriteRetryReceiptPayload(args: {
  contractItem: MemoryWriteRetryContractItem;
  ownerAssignment?: MemoryWriteRetryOwnerAssignment | null;
  receiptStatus?: MemoryWriteRetryReceiptStatus;
  confirmationNote?: string | null;
}): MemoryWriteRetryReceiptPayload {
  const receiptStatus = resolveRequestedReceiptStatus(args.contractItem, args.receiptStatus);

  return {
    receiptVersion: "memory_write_retry_receipt_v1",
    receiptStatus,
    retryContractItemId: args.contractItem.id,
    sourceAuditId: args.contractItem.auditId,
    queueItemId: args.contractItem.queueItemId,
    targetType: args.contractItem.targetType,
    targetId: args.contractItem.targetId,
    title: args.contractItem.title,
    objectType: args.contractItem.objectType,
    objectId: args.contractItem.objectId,
    factType: args.contractItem.factType,
    sourceType: args.contractItem.sourceType,
    sourceId: args.contractItem.sourceId,
    idempotencyLockKey: args.contractItem.idempotencyLockKey,
    ownerUserId: args.ownerAssignment?.ownerUserId ?? null,
    ownerName: args.ownerAssignment?.ownerName ?? null,
    ownerEmail: args.ownerAssignment?.ownerEmail ?? null,
    retryMode: "manual_confirmed_rebuild_only",
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    attemptLimit: args.contractItem.receiptDraft.attemptLimit,
    plannedAttemptCount: 0,
    backoffPolicy: args.contractItem.receiptDraft.backoffPolicy,
    missingInputs: args.contractItem.missingInputs,
    requiredManualChecks: args.contractItem.requiredManualChecks,
    confirmationNote: args.confirmationNote ?? null,
    boundaryNote:
      "Retry receipt persistence records manual review state only; it does not execute retries, rewrite canonical facts, create commitments, or send external messages.",
  };
}

export async function recordMemoryWriteRetryReceipt(input: {
  workspaceId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorType?: ActorType;
  contractItem: MemoryWriteRetryContractItem;
  ownerAssignment?: MemoryWriteRetryOwnerAssignment | null;
  receiptStatus?: MemoryWriteRetryReceiptStatus;
  confirmationNote?: string | null;
  sourcePage?: string | null;
}) {
  const payload = buildMemoryWriteRetryReceiptPayload({
    contractItem: input.contractItem,
    ownerAssignment: input.ownerAssignment,
    receiptStatus: input.receiptStatus,
    confirmationNote: input.confirmationNote,
  });

  return writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    actor: input.actorName ?? (input.actorUserId ? "Memory retry operator" : "Helm Memory Retry Receipt"),
    actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
    actionType: MEMORY_WRITE_RETRY_RECEIPT_AUDIT_ACTION,
    targetType: input.contractItem.targetType,
    targetId: input.contractItem.targetId,
    summary: `Memory write retry receipt recorded: ${payload.receiptStatus}`,
    payload,
    sourcePage: input.sourcePage ?? null,
    relatedObjectType: input.contractItem.objectType ?? null,
    relatedObjectId: input.contractItem.objectId ?? null,
  });
}

export function buildMemoryWriteRetryReceiptLedger(
  retryContract: MemoryWriteRetryContractOverview,
  receiptAudits: MemoryWriteRetryReceiptAudit[] = [],
  ownerAssignments: MemoryWriteRetryOwnerAssignment[] = [],
): MemoryWriteRetryReceiptLedgerOverview {
  const ownerByTarget = new Map(
    ownerAssignments.map((owner) => [targetKey(owner.targetType, owner.targetId), owner] as const),
  );
  const { index, invalidReceiptPayloadCount } = buildReceiptIndex(receiptAudits);

  const items = retryContract.items.map((item): MemoryWriteRetryReceiptLedgerItem => {
    const owner = ownerByTarget.get(targetKey(item.targetType, item.targetId)) ?? null;
    const matchedReceipt = matchKeysForContractItem(item)
      .map((key) => index.get(key))
      .find((value): value is ParsedReceiptAudit => Boolean(value));
    const receiptPayload = matchedReceipt?.payload;
    const resolvedOwnerUserId = owner?.ownerUserId ?? stringValue(receiptPayload?.ownerUserId);
    const resolvedOwnerName = owner?.ownerName ?? stringValue(receiptPayload?.ownerName);
    const resolvedOwnerEmail = owner?.ownerEmail ?? stringValue(receiptPayload?.ownerEmail);
    const resolvedOwnerLabel = resolvedOwnerName ?? resolvedOwnerEmail ?? resolvedOwnerUserId ?? "unassigned";
    const ownerReviewStatus = resolvedOwnerUserId ? "owner_assigned" : "owner_missing";
    const normalizedReceiptStatus = matchedReceipt
      ? normalizeReceiptStatus(receiptPayload?.receiptStatus) ?? "invalid_receipt_payload"
      : "missing_receipt";
    const receiptPayloadStatus = !matchedReceipt
      ? "missing"
      : normalizedReceiptStatus === "invalid_receipt_payload"
        ? "malformed"
        : matchedReceipt.payloadStatus;
    const plannedAttemptCount = receiptPayload
      ? numberValue(receiptPayload.plannedAttemptCount)
      : null;
    const backoffPolicy: Record<string, unknown> = isRecord(receiptPayload?.backoffPolicy)
      ? receiptPayload.backoffPolicy
      : {};
    const backoffDelaysValue = backoffPolicy["delaysMinutes"];
    const parsedBackoffDelays = numberArrayValue(backoffDelaysValue);
    const delaysMinutes = parsedBackoffDelays.length
      ? parsedBackoffDelays
      : item.receiptDraft.backoffPolicy.delaysMinutes;
    const receiptMissingInputs = stringArrayValue(receiptPayload?.missingInputs);
    const receiptRequiredManualChecks = stringArrayValue(receiptPayload?.requiredManualChecks);

    return {
      id: `${item.id}:retry-receipt`,
      retryContractItemId: item.id,
      queueItemId: item.queueItemId,
      auditId: item.auditId,
      targetType: item.targetType,
      targetId: item.targetId,
      title: item.title ?? owner?.objectTitle ?? null,
      objectType: item.objectType,
      objectId: item.objectId,
      factType: item.factType,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      contractStatus: item.contractStatus,
      retryMode: "manual_confirmed_rebuild_only",
      idempotencyLockKey: item.idempotencyLockKey,
      ownerUserId: resolvedOwnerUserId,
      ownerName: resolvedOwnerName,
      ownerEmail: resolvedOwnerEmail,
      ownerLabel: resolvedOwnerLabel,
      ownerReviewStatus,
      receiptAuditId: matchedReceipt?.audit.id ?? null,
      receiptCreatedAt: matchedReceipt?.audit.createdAt.toISOString() ?? null,
      receiptStatus: normalizedReceiptStatus,
      receiptPayloadStatus,
      attemptLimit: numberValue(receiptPayload?.attemptLimit) ?? item.receiptDraft.attemptLimit,
      backoffDelaysMinutes: delaysMinutes,
      plannedAttemptCount,
      missingInputs: (receiptMissingInputs.length
        ? receiptMissingInputs
        : item.missingInputs) as MemoryWriteRetryContractItem["missingInputs"],
      requiredManualChecks: (receiptRequiredManualChecks.length
        ? receiptRequiredManualChecks
        : item.requiredManualChecks) as MemoryWriteRetryContractItem["requiredManualChecks"],
      nextOperatorAction: nextOperatorAction({
        item,
        receiptStatus: normalizedReceiptStatus,
        ownerReviewStatus,
      }),
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
      boundaryNote:
        "Retry receipt ledger items are owner-aware manual review records only; Helm must not execute retry writes from this surface.",
    };
  });

  return {
    ledgerItemCount: items.length,
    receiptAuditCount: receiptAudits.length,
    persistedReceiptCount: items.filter((item) => item.receiptAuditId).length,
    missingReceiptCount: items.filter((item) => item.receiptStatus === "missing_receipt").length,
    pendingManualConfirmationCount: items.filter((item) => item.receiptStatus === "pending_manual_confirmation")
      .length,
    confirmedReadyForExecutorCount: items.filter((item) => item.receiptStatus === "confirmed_ready_for_executor")
      .length,
    blockedReceiptCount: items.filter((item) => item.receiptStatus === "blocked").length,
    dismissedReceiptCount: items.filter((item) => item.receiptStatus === "dismissed").length,
    invalidReceiptPayloadCount,
    ownerAssignedCount: items.filter((item) => item.ownerReviewStatus === "owner_assigned").length,
    ownerMissingCount: items.filter((item) => item.ownerReviewStatus === "owner_missing").length,
    executableAutomaticallyCount: 0,
    items,
    boundaryNote:
      "Memory write retry receipt ledger is receipt/review only, not executor; it persists manual review state, owner routing, idempotency lock, attempt limit, and backoff contract without retrying automatically.",
  };
}
