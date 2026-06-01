import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type {
  MemoryWriteRetryReceiptLedgerItem,
  MemoryWriteRetryReceiptLedgerOverview,
} from "@/lib/memory/write-retry-receipt-ledger";

export const MEMORY_WRITE_RETRY_ATTEMPT_AUDIT_ACTION = "MEMORY_WRITE_RETRY_ATTEMPT_RECORDED";

export type MemoryWriteRetryAttemptAudit = {
  id: string;
  targetType: string;
  targetId: string;
  summary: string;
  payload: string | null;
  userId?: string | null;
  actor?: string | null;
  createdAt: Date;
};

export type MemoryWriteRetryAttemptStatus =
  | "lock_reserved"
  | "blocked_missing_receipt"
  | "blocked_receipt_not_confirmed"
  | "blocked_missing_idempotency_lock"
  | "blocked_idempotency_conflict"
  | "blocked_source_rebuild_required"
  | "blocked_attempt_limit_reached"
  | "blocked_attempt_payload_inspection"
  | "dismissed";

export type MemoryWriteRetrySourceRebuildGateStatus =
  | "blocked_missing_receipt"
  | "blocked_receipt_not_confirmed"
  | "blocked_missing_idempotency_lock"
  | "blocked_missing_source"
  | "manual_rebuild_required"
  | "ready_for_manual_rebuild_review"
  | "blocked_attempt_limit_reached"
  | "dismissed";

export type MemoryWriteRetrySourceRebuildGate = {
  gateVersion: "memory_write_retry_source_rebuild_gate_v1";
  gateStatus: MemoryWriteRetrySourceRebuildGateStatus;
  receiptStatus: MemoryWriteRetryReceiptLedgerItem["receiptStatus"];
  sourceType: string | null;
  sourceId: string | null;
  missingInputs: string[];
  requiredManualChecks: string[];
  nextOperatorAction:
    | "record_retry_receipt"
    | "confirm_retry_receipt_before_attempt"
    | "repair_retry_contract"
    | "rebuild_source_payload_before_attempt"
    | "record_attempt_lock_after_manual_review"
    | "review_attempt_limit"
    | "review_idempotency_conflict"
    | "inspect_attempt_payload"
    | "no_action_dismissed";
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  boundaryNote: string;
};

export type MemoryWriteRetryAttemptPayload = {
  attemptLedgerVersion: "memory_write_retry_attempt_ledger_v1";
  attemptStatus: MemoryWriteRetryAttemptStatus;
  retryContractItemId: string;
  queueItemId: string;
  sourceAuditId: string;
  receiptAuditId: string | null;
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
  attemptNumber: number;
  attemptLimit: number;
  backoffPolicy: {
    strategy: "bounded_exponential";
    delaysMinutes: number[];
    nextDelayMinutes: number | null;
  };
  sourceRebuildGate: MemoryWriteRetrySourceRebuildGate;
  retryMode: "manual_confirmed_rebuild_only";
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  operatorNote: string | null;
  boundaryNote: string;
};

export type MemoryWriteRetryAttemptLedgerItem = {
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
  receiptAuditId: string | null;
  receiptStatus: MemoryWriteRetryReceiptLedgerItem["receiptStatus"];
  receiptPayloadStatus: MemoryWriteRetryReceiptLedgerItem["receiptPayloadStatus"];
  idempotencyLockKey: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLabel: string;
  attemptCount: number;
  attemptLimit: number;
  remainingAttemptCount: number;
  latestAttemptAuditId: string | null;
  latestAttemptCreatedAt: string | null;
  latestAttemptStatus: MemoryWriteRetryAttemptStatus | "missing_attempt" | "invalid_attempt_payload";
  attemptPayloadStatus: "valid" | "missing" | "malformed";
  backoffDelaysMinutes: number[];
  nextBackoffDelayMinutes: number | null;
  idempotencyLockStatus:
    | "blocked_missing_receipt"
    | "blocked_receipt_not_confirmed"
    | "blocked_missing_idempotency_lock"
    | "blocked_idempotency_conflict"
    | "blocked_source_rebuild_required"
    | "lock_available_for_manual_attempt"
    | "lock_reserved"
    | "blocked_attempt_limit_reached"
    | "inspect_attempt_payload"
    | "dismissed";
  sourceRebuildGate: MemoryWriteRetrySourceRebuildGate;
  nextOperatorAction: MemoryWriteRetrySourceRebuildGate["nextOperatorAction"];
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  boundaryNote: string;
};

export type MemoryWriteRetryAttemptLedgerOverview = {
  ledgerItemCount: number;
  attemptAuditCount: number;
  persistedAttemptCount: number;
  invalidAttemptPayloadCount: number;
  unmatchedAttemptAuditCount: number;
  missingReceiptLockCount: number;
  receiptNotConfirmedCount: number;
  missingIdempotencyLockCount: number;
  idempotencyConflictCount: number;
  sourceRebuildRequiredCount: number;
  lockAvailableForManualAttemptCount: number;
  reservedLockCount: number;
  attemptLimitReachedCount: number;
  dismissedCount: number;
  executableAutomaticallyCount: 0;
  items: MemoryWriteRetryAttemptLedgerItem[];
  boundaryNote: string;
};

type ParsedAttemptAudit = {
  audit: MemoryWriteRetryAttemptAudit;
  payload: Partial<MemoryWriteRetryAttemptPayload>;
  payloadStatus: "valid" | "malformed";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAttemptAudit(audit: MemoryWriteRetryAttemptAudit): ParsedAttemptAudit {
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
      payload: parsed as Partial<MemoryWriteRetryAttemptPayload>,
      payloadStatus: "valid",
    };
  } catch {
    return { audit, payload: {}, payloadStatus: "malformed" };
  }
}

function normalizeAttemptStatus(value: unknown): MemoryWriteRetryAttemptStatus | null {
  if (
    value === "lock_reserved" ||
    value === "blocked_missing_receipt" ||
    value === "blocked_receipt_not_confirmed" ||
    value === "blocked_missing_idempotency_lock" ||
    value === "blocked_idempotency_conflict" ||
    value === "blocked_source_rebuild_required" ||
    value === "blocked_attempt_limit_reached" ||
    value === "blocked_attempt_payload_inspection" ||
    value === "dismissed"
  ) {
    return value;
  }

  return null;
}

function matchKeysForReceiptItem(item: MemoryWriteRetryReceiptLedgerItem) {
  return [
    item.idempotencyLockKey ? `lock:${item.idempotencyLockKey}` : null,
    item.receiptAuditId ? `receipt:${item.receiptAuditId}` : null,
    `queue:${item.queueItemId}`,
    `contract:${item.retryContractItemId}`,
  ].filter((value): value is string => Boolean(value));
}

function matchKeysForAttemptPayload(payload: Partial<MemoryWriteRetryAttemptPayload>) {
  return [
    payload.idempotencyLockKey ? `lock:${payload.idempotencyLockKey}` : null,
    payload.receiptAuditId ? `receipt:${payload.receiptAuditId}` : null,
    payload.queueItemId ? `queue:${payload.queueItemId}` : null,
    payload.retryContractItemId ? `contract:${payload.retryContractItemId}` : null,
  ].filter((value): value is string => Boolean(value));
}

function buildAttemptIndex(attemptAudits: MemoryWriteRetryAttemptAudit[]) {
  const parsedAudits = attemptAudits.map(parseAttemptAudit);
  const index = new Map<string, ParsedAttemptAudit[]>();

  for (const parsed of parsedAudits) {
    if (parsed.payloadStatus !== "valid") continue;

    for (const key of matchKeysForAttemptPayload(parsed.payload)) {
      const items = index.get(key) ?? [];
      items.push(parsed);
      index.set(key, items);
    }
  }

  for (const [key, items] of index) {
    index.set(
      key,
      items.sort((left, right) => right.audit.createdAt.getTime() - left.audit.createdAt.getTime()),
    );
  }

  return {
    index,
    invalidAttemptPayloadCount: parsedAudits.filter((item) => item.payloadStatus !== "valid").length,
  };
}

function uniqueParsedAttempts(items: ParsedAttemptAudit[]) {
  return Array.from(new Map(items.map((item) => [item.audit.id, item] as const)).values()).sort(
    (left, right) => right.audit.createdAt.getTime() - left.audit.createdAt.getTime(),
  );
}

function backoffDelayForAttempt(backoffDelaysMinutes: number[], attemptNumber: number) {
  if (!backoffDelaysMinutes.length) return null;
  const index = Math.min(Math.max(attemptNumber - 1, 0), backoffDelaysMinutes.length - 1);
  return backoffDelaysMinutes[index] ?? null;
}

function missingSourceRebuildInputs(item: MemoryWriteRetryReceiptLedgerItem) {
  const missing = new Set<string>(item.missingInputs);

  if (!item.receiptAuditId || item.receiptStatus === "missing_receipt") {
    missing.add("confirmed_receipt");
  }
  if (!item.idempotencyLockKey) {
    missing.add("idempotency_lock");
  }
  if (!item.sourceType || !item.sourceId) {
    missing.add("source");
  }

  return Array.from(missing);
}

function sourceRebuildGateStatus(args: {
  item: MemoryWriteRetryReceiptLedgerItem;
  attemptCount: number;
}): MemoryWriteRetrySourceRebuildGateStatus {
  const { item, attemptCount } = args;

  if (item.receiptStatus === "dismissed") return "dismissed";
  if (!item.receiptAuditId || item.receiptStatus === "missing_receipt") return "blocked_missing_receipt";
  if (item.receiptStatus !== "confirmed_ready_for_executor") return "blocked_receipt_not_confirmed";
  if (!item.idempotencyLockKey) return "blocked_missing_idempotency_lock";
  if (!item.sourceType || !item.sourceId) return "blocked_missing_source";
  if (attemptCount >= item.attemptLimit) return "blocked_attempt_limit_reached";

  const sourceInputMissing = item.missingInputs.some((input) =>
    input === "content" || input === "actor_context" || input === "normalized_value",
  );
  if (sourceInputMissing) return "manual_rebuild_required";

  return "ready_for_manual_rebuild_review";
}

function sourceGateNextOperatorAction(
  status: MemoryWriteRetrySourceRebuildGateStatus,
): MemoryWriteRetrySourceRebuildGate["nextOperatorAction"] {
  if (status === "blocked_missing_receipt") return "record_retry_receipt";
  if (status === "blocked_receipt_not_confirmed") return "confirm_retry_receipt_before_attempt";
  if (status === "blocked_missing_idempotency_lock" || status === "blocked_missing_source") {
    return "repair_retry_contract";
  }
  if (status === "manual_rebuild_required") return "rebuild_source_payload_before_attempt";
  if (status === "blocked_attempt_limit_reached") return "review_attempt_limit";
  if (status === "dismissed") return "no_action_dismissed";

  return "record_attempt_lock_after_manual_review";
}

export function buildMemoryWriteRetrySourceRebuildGate(
  item: MemoryWriteRetryReceiptLedgerItem,
  options?: {
    attemptCount?: number;
  },
): MemoryWriteRetrySourceRebuildGate {
  const gateStatus = sourceRebuildGateStatus({
    item,
    attemptCount: options?.attemptCount ?? 0,
  });

  return {
    gateVersion: "memory_write_retry_source_rebuild_gate_v1",
    gateStatus,
    receiptStatus: item.receiptStatus,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    missingInputs: missingSourceRebuildInputs(item),
    requiredManualChecks: item.requiredManualChecks,
    nextOperatorAction: sourceGateNextOperatorAction(gateStatus),
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote:
      "Source rebuild gate is a manual review gate only; it exposes missing CreateFactInput material but does not reconstruct content or execute MemoryFact writes.",
  };
}

function defaultAttemptStatus(args: {
  item: MemoryWriteRetryReceiptLedgerItem;
  sourceRebuildGate: MemoryWriteRetrySourceRebuildGate;
  previousAttemptCount: number;
}): MemoryWriteRetryAttemptStatus {
  const { item, sourceRebuildGate, previousAttemptCount } = args;

  if (item.receiptStatus === "dismissed") return "dismissed";
  if (!item.receiptAuditId || item.receiptStatus === "missing_receipt") return "blocked_missing_receipt";
  if (item.receiptStatus !== "confirmed_ready_for_executor") return "blocked_receipt_not_confirmed";
  if (!item.idempotencyLockKey) return "blocked_missing_idempotency_lock";
  if (previousAttemptCount >= item.attemptLimit) return "blocked_attempt_limit_reached";
  if (sourceRebuildGate.gateStatus === "manual_rebuild_required") return "blocked_source_rebuild_required";
  if (sourceRebuildGate.gateStatus !== "ready_for_manual_rebuild_review") return "blocked_source_rebuild_required";

  return "lock_reserved";
}

function resolveRequestedAttemptStatus(args: {
  item: MemoryWriteRetryReceiptLedgerItem;
  sourceRebuildGate: MemoryWriteRetrySourceRebuildGate;
  previousAttemptCount: number;
  requestedStatus?: MemoryWriteRetryAttemptStatus;
}) {
  const defaultStatus = defaultAttemptStatus(args);
  const requestedStatus = args.requestedStatus ?? defaultStatus;

  if (requestedStatus === "lock_reserved" && defaultStatus !== "lock_reserved") {
    throw new Error("Cannot reserve a memory write retry attempt lock while the retry gate is blocked.");
  }

  return requestedStatus;
}

export function buildMemoryWriteRetryAttemptPayload(args: {
  receiptItem: MemoryWriteRetryReceiptLedgerItem;
  previousAttemptCount?: number;
  attemptStatus?: MemoryWriteRetryAttemptStatus;
  operatorNote?: string | null;
}): MemoryWriteRetryAttemptPayload {
  const previousAttemptCount = args.previousAttemptCount ?? 0;
  const attemptNumber = previousAttemptCount + 1;
  const sourceRebuildGate = buildMemoryWriteRetrySourceRebuildGate(args.receiptItem, {
    attemptCount: previousAttemptCount,
  });
  const attemptStatus = resolveRequestedAttemptStatus({
    item: args.receiptItem,
    sourceRebuildGate,
    previousAttemptCount,
    requestedStatus: args.attemptStatus,
  });

  return {
    attemptLedgerVersion: "memory_write_retry_attempt_ledger_v1",
    attemptStatus,
    retryContractItemId: args.receiptItem.retryContractItemId,
    queueItemId: args.receiptItem.queueItemId,
    sourceAuditId: args.receiptItem.auditId,
    receiptAuditId: args.receiptItem.receiptAuditId,
    targetType: args.receiptItem.targetType,
    targetId: args.receiptItem.targetId,
    title: args.receiptItem.title,
    objectType: args.receiptItem.objectType,
    objectId: args.receiptItem.objectId,
    factType: args.receiptItem.factType,
    sourceType: args.receiptItem.sourceType,
    sourceId: args.receiptItem.sourceId,
    idempotencyLockKey: args.receiptItem.idempotencyLockKey,
    ownerUserId: args.receiptItem.ownerUserId,
    ownerName: args.receiptItem.ownerName,
    ownerEmail: args.receiptItem.ownerEmail,
    attemptNumber,
    attemptLimit: args.receiptItem.attemptLimit,
    backoffPolicy: {
      strategy: "bounded_exponential",
      delaysMinutes: args.receiptItem.backoffDelaysMinutes,
      nextDelayMinutes: backoffDelayForAttempt(args.receiptItem.backoffDelaysMinutes, attemptNumber),
    },
    sourceRebuildGate,
    retryMode: "manual_confirmed_rebuild_only",
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    operatorNote: args.operatorNote ?? null,
    boundaryNote:
      "Retry attempt ledger records idempotency lock and manual gate state only; it does not execute retries, reconstruct facts, rewrite canonical memory, create commitments, or send external messages.",
  };
}

export async function recordMemoryWriteRetryAttempt(input: {
  workspaceId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorType?: ActorType;
  receiptItem: MemoryWriteRetryReceiptLedgerItem;
  previousAttemptCount?: number;
  attemptStatus?: MemoryWriteRetryAttemptStatus;
  operatorNote?: string | null;
  sourcePage?: string | null;
}) {
  const payload = buildMemoryWriteRetryAttemptPayload({
    receiptItem: input.receiptItem,
    previousAttemptCount: input.previousAttemptCount,
    attemptStatus: input.attemptStatus,
    operatorNote: input.operatorNote,
  });

  return writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    actor: input.actorName ?? (input.actorUserId ? "Memory retry operator" : "Helm Memory Retry Attempt"),
    actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
    actionType: MEMORY_WRITE_RETRY_ATTEMPT_AUDIT_ACTION,
    targetType: input.receiptItem.targetType,
    targetId: input.receiptItem.targetId,
    summary: `Memory write retry attempt recorded: ${payload.attemptStatus}`,
    payload,
    sourcePage: input.sourcePage ?? null,
    relatedObjectType: input.receiptItem.objectType ?? null,
    relatedObjectId: input.receiptItem.objectId ?? null,
  });
}

function idempotencyLockStatus(args: {
  item: MemoryWriteRetryReceiptLedgerItem;
  sourceRebuildGate: MemoryWriteRetrySourceRebuildGate;
  latestAttemptStatus: MemoryWriteRetryAttemptLedgerItem["latestAttemptStatus"];
  attemptCount: number;
  lockReservedAttemptCount: number;
}): MemoryWriteRetryAttemptLedgerItem["idempotencyLockStatus"] {
  const { item, sourceRebuildGate, latestAttemptStatus, attemptCount, lockReservedAttemptCount } = args;

  if (latestAttemptStatus === "invalid_attempt_payload") return "inspect_attempt_payload";
  if (item.receiptStatus === "dismissed") return "dismissed";
  if (!item.receiptAuditId || item.receiptStatus === "missing_receipt") return "blocked_missing_receipt";
  if (item.receiptStatus !== "confirmed_ready_for_executor") return "blocked_receipt_not_confirmed";
  if (!item.idempotencyLockKey) return "blocked_missing_idempotency_lock";
  if (lockReservedAttemptCount > 1) return "blocked_idempotency_conflict";
  if (attemptCount >= item.attemptLimit) return "blocked_attempt_limit_reached";
  if (latestAttemptStatus === "lock_reserved") return "lock_reserved";
  if (sourceRebuildGate.gateStatus === "manual_rebuild_required") return "blocked_source_rebuild_required";

  return "lock_available_for_manual_attempt";
}

function latestAttemptStatus(parsed: ParsedAttemptAudit | null): MemoryWriteRetryAttemptLedgerItem["latestAttemptStatus"] {
  if (!parsed) return "missing_attempt";
  return normalizeAttemptStatus(parsed.payload.attemptStatus) ?? "invalid_attempt_payload";
}

function attemptPayloadStatus(
  latestAttempt: ParsedAttemptAudit | null,
  latestStatus: MemoryWriteRetryAttemptLedgerItem["latestAttemptStatus"],
): MemoryWriteRetryAttemptLedgerItem["attemptPayloadStatus"] {
  if (!latestAttempt) return "missing";
  if (latestStatus === "invalid_attempt_payload") return "malformed";
  return latestAttempt.payloadStatus;
}

function nextOperatorAction(args: {
  lockStatus: MemoryWriteRetryAttemptLedgerItem["idempotencyLockStatus"];
  sourceRebuildGate: MemoryWriteRetrySourceRebuildGate;
}): MemoryWriteRetryAttemptLedgerItem["nextOperatorAction"] {
  if (args.lockStatus === "inspect_attempt_payload") return "inspect_attempt_payload";
  if (args.lockStatus === "lock_reserved") return "record_attempt_lock_after_manual_review";
  if (args.lockStatus === "blocked_attempt_limit_reached") return "review_attempt_limit";
  if (args.lockStatus === "blocked_idempotency_conflict") return "review_idempotency_conflict";
  return args.sourceRebuildGate.nextOperatorAction;
}

export function buildMemoryWriteRetryAttemptLedger(
  retryReceiptLedger: MemoryWriteRetryReceiptLedgerOverview,
  attemptAudits: MemoryWriteRetryAttemptAudit[] = [],
): MemoryWriteRetryAttemptLedgerOverview {
  const { index, invalidAttemptPayloadCount } = buildAttemptIndex(attemptAudits);
  const matchedAttemptAuditIds = new Set<string>();

  const items = retryReceiptLedger.items.map((item): MemoryWriteRetryAttemptLedgerItem => {
    const matchedAttempts = uniqueParsedAttempts(
      matchKeysForReceiptItem(item).flatMap((key) => index.get(key) ?? []),
    );
    for (const attempt of matchedAttempts) {
      matchedAttemptAuditIds.add(attempt.audit.id);
    }

    const validAttempts = matchedAttempts.filter((attempt) => attempt.payloadStatus === "valid");
    const attemptCount = validAttempts.length;
    const lockReservedAttemptCount = validAttempts.filter(
      (attempt) => normalizeAttemptStatus(attempt.payload.attemptStatus) === "lock_reserved",
    ).length;
    const latestAttempt = matchedAttempts[0] ?? null;
    const latestStatus = latestAttemptStatus(latestAttempt);
    const sourceRebuildGate = buildMemoryWriteRetrySourceRebuildGate(item, { attemptCount });
    const lockStatus = idempotencyLockStatus({
      item,
      sourceRebuildGate,
      latestAttemptStatus: latestStatus,
      attemptCount,
      lockReservedAttemptCount,
    });

    return {
      id: `${item.id}:retry-attempt`,
      retryContractItemId: item.retryContractItemId,
      queueItemId: item.queueItemId,
      auditId: item.auditId,
      targetType: item.targetType,
      targetId: item.targetId,
      title: item.title,
      objectType: item.objectType,
      objectId: item.objectId,
      factType: item.factType,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      receiptAuditId: item.receiptAuditId,
      receiptStatus: item.receiptStatus,
      receiptPayloadStatus: item.receiptPayloadStatus,
      idempotencyLockKey: item.idempotencyLockKey,
      ownerUserId: item.ownerUserId,
      ownerName: item.ownerName,
      ownerEmail: item.ownerEmail,
      ownerLabel: item.ownerLabel,
      attemptCount,
      attemptLimit: item.attemptLimit,
      remainingAttemptCount: Math.max(item.attemptLimit - attemptCount, 0),
      latestAttemptAuditId: latestAttempt?.audit.id ?? null,
      latestAttemptCreatedAt: latestAttempt?.audit.createdAt.toISOString() ?? null,
      latestAttemptStatus: latestStatus,
      attemptPayloadStatus: attemptPayloadStatus(latestAttempt, latestStatus),
      backoffDelaysMinutes: item.backoffDelaysMinutes,
      nextBackoffDelayMinutes: backoffDelayForAttempt(item.backoffDelaysMinutes, attemptCount + 1),
      idempotencyLockStatus: lockStatus,
      sourceRebuildGate,
      nextOperatorAction: nextOperatorAction({
        lockStatus,
        sourceRebuildGate,
      }),
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
      boundaryNote:
        "Retry attempt ledger is an idempotency-lock read model only; it must not execute MemoryFact writes or bypass manual source rebuild review.",
    };
  });

  return {
    ledgerItemCount: items.length,
    attemptAuditCount: attemptAudits.length,
    persistedAttemptCount: items.filter((item) => item.latestAttemptAuditId).length,
    invalidAttemptPayloadCount,
    unmatchedAttemptAuditCount: attemptAudits.filter((attempt) => !matchedAttemptAuditIds.has(attempt.id)).length,
    missingReceiptLockCount: items.filter((item) => item.idempotencyLockStatus === "blocked_missing_receipt")
      .length,
    receiptNotConfirmedCount: items.filter((item) => item.idempotencyLockStatus === "blocked_receipt_not_confirmed")
      .length,
    missingIdempotencyLockCount: items.filter(
      (item) => item.idempotencyLockStatus === "blocked_missing_idempotency_lock",
    ).length,
    idempotencyConflictCount: items.filter(
      (item) => item.idempotencyLockStatus === "blocked_idempotency_conflict",
    ).length,
    sourceRebuildRequiredCount: items.filter(
      (item) => item.idempotencyLockStatus === "blocked_source_rebuild_required",
    ).length,
    lockAvailableForManualAttemptCount: items.filter(
      (item) => item.idempotencyLockStatus === "lock_available_for_manual_attempt",
    ).length,
    reservedLockCount: items.filter((item) => item.idempotencyLockStatus === "lock_reserved").length,
    attemptLimitReachedCount: items.filter(
      (item) => item.idempotencyLockStatus === "blocked_attempt_limit_reached",
    ).length,
    dismissedCount: items.filter((item) => item.idempotencyLockStatus === "dismissed").length,
    executableAutomaticallyCount: 0,
    items,
    boundaryNote:
      "Memory write retry attempt ledger is AuditLog-backed and review-first; it records lock/backoff/source-rebuild gate state without retrying automatically or expanding recommendation / commitment authority.",
  };
}
