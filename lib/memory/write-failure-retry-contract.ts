import { createHash } from "node:crypto";
import type { MemoryWriteFailureOperatorQueueItem } from "@/lib/memory/write-failure-operator-queue";

export type MemoryWriteRetryContractItem = {
  id: string;
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
  failureClass: string;
  reason: string;
  reviewPosture: MemoryWriteFailureOperatorQueueItem["reviewPosture"];
  contractStatus:
    | "manual_confirmation_required"
    | "blocked_missing_retry_payload"
    | "blocked_conflict_review_required"
    | "blocked_non_retryable"
    | "blocked_payload_inspection_required";
  retryMode: "manual_confirmed_rebuild_only";
  canExecuteAutomatically: false;
  manualConfirmationRequired: true;
  idempotencyLockKey: string | null;
  missingInputs: Array<"content" | "actor_context" | "normalized_value" | "valid_failure_payload" | "title">;
  requiredManualChecks: Array<
    | "rebuild_fact_content_from_source"
    | "confirm_same_workspace_object_and_source"
    | "check_existing_duplicate_or_conflict"
    | "record_retry_receipt_before_write"
    | "inspect_failure_audit_payload"
    | "resolve_conflict_before_retry"
    | "repair_source_or_object_before_retry"
  >;
  receiptDraft: {
    receiptVersion: "memory_write_retry_receipt_v1";
    receiptStatus: "plan_only_pending_manual_confirmation" | "blocked";
    sourceAuditId: string;
    queueItemId: string;
    idempotencyLockKey: string | null;
    attemptLimit: number;
    plannedAttemptCount: 0;
    backoffPolicy: {
      strategy: "bounded_exponential";
      delaysMinutes: number[];
    };
    boundaryNote: string;
  };
  boundaryNote: string;
};

export type MemoryWriteRetryContractOverview = {
  contractItemCount: number;
  manualConfirmationRequiredCount: number;
  blockedMissingPayloadCount: number;
  blockedConflictReviewCount: number;
  blockedNonRetryableCount: number;
  blockedPayloadInspectionCount: number;
  executableAutomaticallyCount: 0;
  attemptLimit: number;
  backoffDelaysMinutes: number[];
  items: MemoryWriteRetryContractItem[];
  boundaryNote: string;
};

const DEFAULT_ATTEMPT_LIMIT = 3;
const DEFAULT_BACKOFF_DELAYS_MINUTES = [0, 5, 15];

function normalizeKeyPart(value: string | null | undefined) {
  const rawValue = (value ?? "missing").trim() || "missing";
  const readablePart = rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "value";
  const hashPart = createHash("sha256").update(rawValue).digest("hex").slice(0, 12);

  return `${readablePart}-${hashPart}`;
}

function buildIdempotencyLockKey(item: MemoryWriteFailureOperatorQueueItem) {
  if (!item.objectType || !item.objectId || !item.factType || !item.sourceType || !item.sourceId || !item.title) {
    return null;
  }

  return [
    "memory-write-retry",
    normalizeKeyPart(item.objectType),
    normalizeKeyPart(item.objectId),
    normalizeKeyPart(item.factType),
    normalizeKeyPart(item.sourceType),
    normalizeKeyPart(item.sourceId),
    normalizeKeyPart(item.title),
  ].join(":");
}

function missingInputs(item: MemoryWriteFailureOperatorQueueItem): MemoryWriteRetryContractItem["missingInputs"] {
  const missing: MemoryWriteRetryContractItem["missingInputs"] = ["content", "actor_context"];

  if (item.payloadStatus !== "valid") {
    missing.push("valid_failure_payload");
  }

  if (!item.title) {
    missing.push("title");
  }

  // The failure audit stores identifying fields, not the full normalized CreateFactInput.
  missing.push("normalized_value");

  return Array.from(new Set(missing));
}

function resolveContractStatus(
  item: MemoryWriteFailureOperatorQueueItem,
  idempotencyLockKey: string | null,
): MemoryWriteRetryContractItem["contractStatus"] {
  if (item.reviewPosture === "merge_conflict_review") return "blocked_conflict_review_required";
  if (item.reviewPosture === "source_data_repair") return "blocked_non_retryable";
  if (item.reviewPosture === "inspect_audit_payload") return "blocked_payload_inspection_required";
  if (!idempotencyLockKey || item.payloadStatus !== "valid") return "blocked_missing_retry_payload";
  return "manual_confirmation_required";
}

function requiredManualChecks(
  item: MemoryWriteFailureOperatorQueueItem,
): MemoryWriteRetryContractItem["requiredManualChecks"] {
  if (item.reviewPosture === "inspect_audit_payload") {
    return ["inspect_failure_audit_payload"];
  }

  if (item.reviewPosture === "merge_conflict_review") {
    return ["resolve_conflict_before_retry", "check_existing_duplicate_or_conflict"];
  }

  if (item.reviewPosture === "source_data_repair") {
    return ["repair_source_or_object_before_retry"];
  }

  return [
    "rebuild_fact_content_from_source",
    "confirm_same_workspace_object_and_source",
    "check_existing_duplicate_or_conflict",
    "record_retry_receipt_before_write",
  ];
}

function buildRetryContractItem(args: {
  item: MemoryWriteFailureOperatorQueueItem;
  attemptLimit: number;
  backoffDelaysMinutes: number[];
}): MemoryWriteRetryContractItem {
  const idempotencyLockKey = buildIdempotencyLockKey(args.item);
  const contractStatus = resolveContractStatus(args.item, idempotencyLockKey);
  const receiptStatus =
    contractStatus === "manual_confirmation_required" ? "plan_only_pending_manual_confirmation" : "blocked";

  return {
    id: `${args.item.id}:retry-contract`,
    queueItemId: args.item.id,
    auditId: args.item.auditId,
    targetType: args.item.targetType,
    targetId: args.item.targetId,
    title: args.item.title,
    objectType: args.item.objectType,
    objectId: args.item.objectId,
    factType: args.item.factType,
    sourceType: args.item.sourceType,
    sourceId: args.item.sourceId,
    failureClass: args.item.failureClass,
    reason: args.item.reason,
    reviewPosture: args.item.reviewPosture,
    contractStatus,
    retryMode: "manual_confirmed_rebuild_only",
    canExecuteAutomatically: false,
    manualConfirmationRequired: true,
    idempotencyLockKey,
    missingInputs: missingInputs(args.item),
    requiredManualChecks: requiredManualChecks(args.item),
    receiptDraft: {
      receiptVersion: "memory_write_retry_receipt_v1",
      receiptStatus,
      sourceAuditId: args.item.auditId,
      queueItemId: args.item.id,
      idempotencyLockKey,
      attemptLimit: args.attemptLimit,
      plannedAttemptCount: 0,
      backoffPolicy: {
        strategy: "bounded_exponential",
        delaysMinutes: args.backoffDelaysMinutes,
      },
      boundaryNote:
        "This is a receipt draft for a future manually confirmed retry; it is not a persisted retry receipt and does not execute a write.",
    },
    boundaryNote:
      "Memory write retry contract is plan-only and manual-confirmed; Helm must not auto retry, rewrite canonical facts, change recommendations, create commitments, or send external messages from this contract.",
  };
}

export function buildMemoryWriteRetryContract(
  queueItems: MemoryWriteFailureOperatorQueueItem[],
  options?: {
    attemptLimit?: number;
    backoffDelaysMinutes?: number[];
  },
): MemoryWriteRetryContractOverview {
  const attemptLimit = options?.attemptLimit ?? DEFAULT_ATTEMPT_LIMIT;
  const backoffDelaysMinutes = options?.backoffDelaysMinutes ?? DEFAULT_BACKOFF_DELAYS_MINUTES;
  const items = queueItems.map((item) =>
    buildRetryContractItem({
      item,
      attemptLimit,
      backoffDelaysMinutes,
    }),
  );

  return {
    contractItemCount: items.length,
    manualConfirmationRequiredCount: items.filter((item) => item.contractStatus === "manual_confirmation_required")
      .length,
    blockedMissingPayloadCount: items.filter((item) => item.contractStatus === "blocked_missing_retry_payload").length,
    blockedConflictReviewCount: items.filter((item) => item.contractStatus === "blocked_conflict_review_required")
      .length,
    blockedNonRetryableCount: items.filter((item) => item.contractStatus === "blocked_non_retryable").length,
    blockedPayloadInspectionCount: items.filter((item) => item.contractStatus === "blocked_payload_inspection_required")
      .length,
    executableAutomaticallyCount: 0,
    attemptLimit,
    backoffDelaysMinutes,
    items,
    boundaryNote:
      "Memory write retry contract is bounded, receipt-oriented, idempotency-keyed, and manual-confirmed; it does not execute retries automatically or expand recommendation / commitment authority.",
  };
}
