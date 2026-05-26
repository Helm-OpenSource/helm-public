import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMemoryWriteRetryAttemptLedger,
  buildMemoryWriteRetryAttemptPayload,
  buildMemoryWriteRetrySourceRebuildGate,
  MEMORY_WRITE_RETRY_ATTEMPT_AUDIT_ACTION,
  recordMemoryWriteRetryAttempt,
  type MemoryWriteRetryAttemptAudit,
} from "@/lib/memory/write-retry-attempt-ledger";
import type {
  MemoryWriteRetryReceiptLedgerItem,
  MemoryWriteRetryReceiptLedgerOverview,
} from "@/lib/memory/write-retry-receipt-ledger";

const writeAuditLogMock = vi.hoisted(() => vi.fn(async (input: unknown) => ({ id: "attempt-audit", input })));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

function receiptItem(overrides: Partial<MemoryWriteRetryReceiptLedgerItem> = {}): MemoryWriteRetryReceiptLedgerItem {
  return {
    id: "retryable-audit:0:retry-contract:retry-receipt",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    auditId: "retryable-audit",
    targetType: "Meeting",
    targetId: "meeting-1",
    title: "Confirm renewal budget",
    objectType: "OPPORTUNITY",
    objectId: "opp-1",
    factType: "DECISION",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    contractStatus: "manual_confirmation_required",
    retryMode: "manual_confirmed_rebuild_only",
    idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
    ownerUserId: "user-1",
    ownerName: "Ada Chen",
    ownerEmail: "ada@example.com",
    ownerLabel: "Ada Chen",
    ownerReviewStatus: "owner_assigned",
    receiptAuditId: "receipt-audit-1",
    receiptCreatedAt: "2026-04-21T03:00:00.000Z",
    receiptStatus: "confirmed_ready_for_executor",
    receiptPayloadStatus: "valid",
    attemptLimit: 3,
    backoffDelaysMinutes: [0, 5, 15],
    plannedAttemptCount: 0,
    missingInputs: ["content", "actor_context", "normalized_value"],
    requiredManualChecks: [
      "rebuild_fact_content_from_source",
      "confirm_same_workspace_object_and_source",
      "check_existing_duplicate_or_conflict",
      "record_retry_receipt_before_write",
    ],
    nextOperatorAction: "ready_for_later_executor_after_manual_confirmation",
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote: "Receipt ledger is review only.",
    ...overrides,
  };
}

function receiptLedger(items: MemoryWriteRetryReceiptLedgerItem[]): MemoryWriteRetryReceiptLedgerOverview {
  return {
    ledgerItemCount: items.length,
    receiptAuditCount: items.filter((item) => item.receiptAuditId).length,
    persistedReceiptCount: items.filter((item) => item.receiptAuditId).length,
    missingReceiptCount: items.filter((item) => item.receiptStatus === "missing_receipt").length,
    pendingManualConfirmationCount: items.filter((item) => item.receiptStatus === "pending_manual_confirmation")
      .length,
    confirmedReadyForExecutorCount: items.filter((item) => item.receiptStatus === "confirmed_ready_for_executor")
      .length,
    blockedReceiptCount: items.filter((item) => item.receiptStatus === "blocked").length,
    dismissedReceiptCount: items.filter((item) => item.receiptStatus === "dismissed").length,
    invalidReceiptPayloadCount: 0,
    ownerAssignedCount: items.filter((item) => item.ownerReviewStatus === "owner_assigned").length,
    ownerMissingCount: items.filter((item) => item.ownerReviewStatus === "owner_missing").length,
    executableAutomaticallyCount: 0,
    items,
    boundaryNote: "Receipt ledger is review only.",
  };
}

function attemptAudit(overrides: Partial<MemoryWriteRetryAttemptAudit> = {}): MemoryWriteRetryAttemptAudit {
  return {
    id: "attempt-audit-1",
    targetType: "Meeting",
    targetId: "meeting-1",
    summary: "attempt recorded",
    payload: JSON.stringify({
      attemptLedgerVersion: "memory_write_retry_attempt_ledger_v1",
      attemptStatus: "lock_reserved",
      retryContractItemId: "retryable-audit:0:retry-contract",
      queueItemId: "retryable-audit:0",
      sourceAuditId: "retryable-audit",
      receiptAuditId: "receipt-audit-1",
      idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
      attemptNumber: 1,
      attemptLimit: 3,
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
    }),
    userId: "user-1",
    actor: "Ada Chen",
    createdAt: new Date("2026-04-21T04:00:00.000Z"),
    ...overrides,
  };
}

describe("memory write retry attempt ledger", () => {
  beforeEach(() => {
    writeAuditLogMock.mockClear();
  });

  it("keeps confirmed receipts blocked at the source rebuild gate when CreateFactInput is incomplete", () => {
    const item = receiptItem();
    const gate = buildMemoryWriteRetrySourceRebuildGate(item);
    const ledger = buildMemoryWriteRetryAttemptLedger(receiptLedger([item]));

    expect(gate).toMatchObject({
      gateStatus: "manual_rebuild_required",
      missingInputs: ["content", "actor_context", "normalized_value"],
      nextOperatorAction: "rebuild_source_payload_before_attempt",
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
    });
    expect(ledger).toMatchObject({
      ledgerItemCount: 1,
      attemptAuditCount: 0,
      sourceRebuildRequiredCount: 1,
      executableAutomaticallyCount: 0,
    });
    expect(ledger.items[0]).toMatchObject({
      idempotencyLockStatus: "blocked_source_rebuild_required",
      latestAttemptStatus: "missing_attempt",
      nextOperatorAction: "rebuild_source_payload_before_attempt",
      canExecuteAutomatically: false,
    });
  });

  it("blocks lock reservation when the receipt is missing or not confirmed", () => {
    const missingReceipt = receiptItem({
      receiptAuditId: null,
      receiptCreatedAt: null,
      receiptStatus: "missing_receipt",
      receiptPayloadStatus: "missing",
      nextOperatorAction: "record_retry_receipt",
    });
    const pendingReceipt = receiptItem({
      receiptStatus: "pending_manual_confirmation",
      nextOperatorAction: "confirm_or_dismiss_receipt",
    });
    const ledger = buildMemoryWriteRetryAttemptLedger(receiptLedger([missingReceipt, pendingReceipt]));

    expect(ledger).toMatchObject({
      missingReceiptLockCount: 1,
      receiptNotConfirmedCount: 1,
      lockAvailableForManualAttemptCount: 0,
      executableAutomaticallyCount: 0,
    });
    expect(ledger.items.map((item) => item.idempotencyLockStatus)).toEqual([
      "blocked_missing_receipt",
      "blocked_receipt_not_confirmed",
    ]);
    expect(() =>
      buildMemoryWriteRetryAttemptPayload({
        receiptItem: pendingReceipt,
        attemptStatus: "lock_reserved",
      }),
    ).toThrow("Cannot reserve");
  });

  it("records attempt locks as AuditLog-only state without executing memory writes", async () => {
    const item = receiptItem({
      missingInputs: [],
      requiredManualChecks: ["confirm_same_workspace_object_and_source", "check_existing_duplicate_or_conflict"],
    });
    const payload = buildMemoryWriteRetryAttemptPayload({
      receiptItem: item,
      operatorNote: "Operator rebuilt source payload and checked duplicate guard.",
    });

    expect(payload).toMatchObject({
      attemptStatus: "lock_reserved",
      attemptNumber: 1,
      retryMode: "manual_confirmed_rebuild_only",
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
      sourceRebuildGate: {
        gateStatus: "ready_for_manual_rebuild_review",
        canExecuteAutomatically: false,
      },
    });

    await recordMemoryWriteRetryAttempt({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "Ada Chen",
      actorType: ActorType.USER,
      receiptItem: item,
      operatorNote: "Operator rebuilt source payload.",
      sourcePage: "diagnostics",
    });

    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        actor: "Ada Chen",
        actorType: ActorType.USER,
        actionType: MEMORY_WRITE_RETRY_ATTEMPT_AUDIT_ACTION,
        targetType: "Meeting",
        targetId: "meeting-1",
        sourcePage: "diagnostics",
        relatedObjectType: "OPPORTUNITY",
        relatedObjectId: "opp-1",
      }),
    );
    expect(writeAuditLogMock.mock.calls[0][0]).toMatchObject({
      payload: {
        attemptLedgerVersion: "memory_write_retry_attempt_ledger_v1",
        attemptStatus: "lock_reserved",
        canExecuteAutomatically: false,
        manualConfirmationRequired: true,
      },
    });
  });

  it("surfaces duplicate logical locks as idempotency conflicts instead of executable work", () => {
    const item = receiptItem({
      missingInputs: [],
      requiredManualChecks: ["confirm_same_workspace_object_and_source", "check_existing_duplicate_or_conflict"],
    });
    const ledger = buildMemoryWriteRetryAttemptLedger(receiptLedger([item]), [
      attemptAudit({ id: "attempt-audit-1", createdAt: new Date("2026-04-21T04:00:00.000Z") }),
      attemptAudit({
        id: "attempt-audit-2",
        createdAt: new Date("2026-04-21T04:05:00.000Z"),
        payload: JSON.stringify({
          ...buildMemoryWriteRetryAttemptPayload({ receiptItem: item, previousAttemptCount: 1 }),
          attemptNumber: 2,
        }),
      }),
    ]);

    expect(ledger).toMatchObject({
      attemptAuditCount: 2,
      persistedAttemptCount: 1,
      idempotencyConflictCount: 1,
      reservedLockCount: 0,
      executableAutomaticallyCount: 0,
    });
    expect(ledger.items[0]).toMatchObject({
      attemptCount: 2,
      latestAttemptAuditId: "attempt-audit-2",
      latestAttemptStatus: "lock_reserved",
      idempotencyLockStatus: "blocked_idempotency_conflict",
      nextOperatorAction: "review_idempotency_conflict",
    });
  });

  it("blocks additional attempt records after the configured attempt limit", () => {
    const item = receiptItem({
      missingInputs: [],
      requiredManualChecks: ["confirm_same_workspace_object_and_source", "check_existing_duplicate_or_conflict"],
    });
    const attempts = [1, 2, 3].map((attemptNumber) =>
      attemptAudit({
        id: `attempt-audit-${attemptNumber}`,
        createdAt: new Date(`2026-04-21T04:0${attemptNumber}:00.000Z`),
        payload: JSON.stringify({
          ...buildMemoryWriteRetryAttemptPayload({
            receiptItem: item,
            previousAttemptCount: attemptNumber - 1,
            attemptStatus: "blocked_source_rebuild_required",
          }),
          attemptNumber,
        }),
      }),
    );
    const ledger = buildMemoryWriteRetryAttemptLedger(receiptLedger([item]), attempts);

    expect(ledger).toMatchObject({
      attemptAuditCount: 3,
      attemptLimitReachedCount: 1,
      executableAutomaticallyCount: 0,
    });
    expect(ledger.items[0]).toMatchObject({
      attemptCount: 3,
      remainingAttemptCount: 0,
      nextBackoffDelayMinutes: 15,
      idempotencyLockStatus: "blocked_attempt_limit_reached",
      nextOperatorAction: "review_attempt_limit",
    });
  });

  it("counts malformed and unmatched attempt audits without attaching them to a retry item", () => {
    const ledger = buildMemoryWriteRetryAttemptLedger(receiptLedger([receiptItem()]), [
      attemptAudit({
        id: "malformed-attempt",
        payload: "{not-json",
      }),
      attemptAudit({
        id: "unmatched-attempt",
        payload: JSON.stringify({
          attemptLedgerVersion: "memory_write_retry_attempt_ledger_v1",
          attemptStatus: "lock_reserved",
          retryContractItemId: "other-contract",
          queueItemId: "other-queue",
          receiptAuditId: "other-receipt",
          idempotencyLockKey: "other-lock",
          canExecuteAutomatically: false,
          manualConfirmationRequired: true,
        }),
      }),
    ]);

    expect(ledger).toMatchObject({
      attemptAuditCount: 2,
      invalidAttemptPayloadCount: 1,
      unmatchedAttemptAuditCount: 2,
      persistedAttemptCount: 0,
      executableAutomaticallyCount: 0,
    });
  });
});
