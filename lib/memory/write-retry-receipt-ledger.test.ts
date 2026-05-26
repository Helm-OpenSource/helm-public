import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MemoryWriteRetryContractItem,
  MemoryWriteRetryContractOverview,
} from "@/lib/memory/write-failure-retry-contract";
import {
  buildMemoryWriteRetryReceiptLedger,
  buildMemoryWriteRetryReceiptPayload,
  MEMORY_WRITE_RETRY_RECEIPT_AUDIT_ACTION,
  recordMemoryWriteRetryReceipt,
  type MemoryWriteRetryOwnerAssignment,
} from "@/lib/memory/write-retry-receipt-ledger";

const writeAuditLogMock = vi.hoisted(() => vi.fn(async (input: unknown) => ({ id: "receipt-audit", input })));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

function retryContractItem(overrides: Partial<MemoryWriteRetryContractItem> = {}): MemoryWriteRetryContractItem {
  return {
    id: "retryable-audit:0:retry-contract",
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
    failureClass: "retryable",
    reason: "database_unavailable",
    reviewPosture: "retry_manual_confirm",
    contractStatus: "manual_confirmation_required",
    retryMode: "manual_confirmed_rebuild_only",
    canExecuteAutomatically: false,
    manualConfirmationRequired: true,
    idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
    missingInputs: ["content", "actor_context", "normalized_value"],
    requiredManualChecks: [
      "rebuild_fact_content_from_source",
      "confirm_same_workspace_object_and_source",
      "check_existing_duplicate_or_conflict",
      "record_retry_receipt_before_write",
    ],
    receiptDraft: {
      receiptVersion: "memory_write_retry_receipt_v1",
      receiptStatus: "plan_only_pending_manual_confirmation",
      sourceAuditId: "retryable-audit",
      queueItemId: "retryable-audit:0",
      idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
      attemptLimit: 3,
      plannedAttemptCount: 0,
      backoffPolicy: {
        strategy: "bounded_exponential",
        delaysMinutes: [0, 5, 15],
      },
      boundaryNote: "Receipt draft only.",
    },
    boundaryNote: "Contract is manual confirmed only.",
    ...overrides,
  };
}

function retryContract(items: MemoryWriteRetryContractItem[]): MemoryWriteRetryContractOverview {
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
    attemptLimit: 3,
    backoffDelaysMinutes: [0, 5, 15],
    items,
    boundaryNote: "Retry contract is manual confirmed only.",
  };
}

function ownerAssignment(overrides: Partial<MemoryWriteRetryOwnerAssignment> = {}): MemoryWriteRetryOwnerAssignment {
  return {
    targetType: "Meeting",
    targetId: "meeting-1",
    objectTitle: "Renewal call",
    ownerUserId: "user-1",
    ownerName: "Ada Chen",
    ownerEmail: "ada@example.com",
    ...overrides,
  };
}

describe("memory write retry receipt ledger", () => {
  beforeEach(() => {
    writeAuditLogMock.mockClear();
  });

  it("surfaces missing receipts as owner-aware manual review work without execution authority", () => {
    const item = retryContractItem();
    const ledger = buildMemoryWriteRetryReceiptLedger(retryContract([item]), [], [ownerAssignment()]);

    expect(ledger).toMatchObject({
      ledgerItemCount: 1,
      receiptAuditCount: 0,
      persistedReceiptCount: 0,
      missingReceiptCount: 1,
      ownerAssignedCount: 1,
      ownerMissingCount: 0,
      executableAutomaticallyCount: 0,
    });
    expect(ledger.items[0]).toMatchObject({
      ownerLabel: "Ada Chen",
      receiptStatus: "missing_receipt",
      receiptPayloadStatus: "missing",
      nextOperatorAction: "record_retry_receipt",
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
    });
    expect(ledger.boundaryNote).toContain("not executor");
  });

  it("matches persisted receipts by idempotency lock and carries receipt owner fallback", () => {
    const item = retryContractItem();
    const receiptPayload = buildMemoryWriteRetryReceiptPayload({
      contractItem: item,
      ownerAssignment: ownerAssignment(),
      receiptStatus: "confirmed_ready_for_executor",
      confirmationNote: "Operator checked source meeting and duplicate guard.",
    });
    const ledger = buildMemoryWriteRetryReceiptLedger(
      retryContract([item]),
      [
        {
          id: "receipt-audit-1",
          targetType: "Meeting",
          targetId: "meeting-1",
          summary: "receipt recorded",
          payload: JSON.stringify(receiptPayload),
          userId: "user-1",
          actor: "Ada Chen",
          createdAt: new Date("2026-04-21T03:00:00.000Z"),
        },
      ],
      [],
    );

    expect(ledger).toMatchObject({
      persistedReceiptCount: 1,
      missingReceiptCount: 0,
      confirmedReadyForExecutorCount: 1,
      ownerAssignedCount: 1,
      executableAutomaticallyCount: 0,
    });
    expect(ledger.items[0]).toMatchObject({
      receiptAuditId: "receipt-audit-1",
      receiptStatus: "confirmed_ready_for_executor",
      ownerLabel: "Ada Chen",
      nextOperatorAction: "ready_for_later_executor_after_manual_confirmation",
      canExecuteAutomatically: false,
    });
  });

  it("keeps blocked contracts blocked and rejects confirmed receipts for blocked items", () => {
    const blockedItem = retryContractItem({
      contractStatus: "blocked_conflict_review_required",
      reviewPosture: "merge_conflict_review",
      idempotencyLockKey: null,
      receiptDraft: {
        ...retryContractItem().receiptDraft,
        receiptStatus: "blocked",
        idempotencyLockKey: null,
      },
    });
    const ledger = buildMemoryWriteRetryReceiptLedger(retryContract([blockedItem]), [], [ownerAssignment()]);

    expect(ledger.items[0]).toMatchObject({
      contractStatus: "blocked_conflict_review_required",
      nextOperatorAction: "resolve_blocking_contract",
      receiptStatus: "missing_receipt",
      canExecuteAutomatically: false,
    });
    expect(() =>
      buildMemoryWriteRetryReceiptPayload({
        contractItem: blockedItem,
        receiptStatus: "confirmed_ready_for_executor",
      }),
    ).toThrow("Cannot confirm");
  });

  it("persists a receipt audit without creating a retry execution path", async () => {
    const item = retryContractItem();

    await recordMemoryWriteRetryReceipt({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "Ada Chen",
      actorType: ActorType.USER,
      contractItem: item,
      ownerAssignment: ownerAssignment(),
      receiptStatus: "pending_manual_confirmation",
      sourcePage: "diagnostics",
    });

    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        actor: "Ada Chen",
        actorType: ActorType.USER,
        actionType: MEMORY_WRITE_RETRY_RECEIPT_AUDIT_ACTION,
        targetType: "Meeting",
        targetId: "meeting-1",
        sourcePage: "diagnostics",
        relatedObjectType: "OPPORTUNITY",
        relatedObjectId: "opp-1",
      }),
    );
    expect(writeAuditLogMock.mock.calls[0][0]).toMatchObject({
      payload: {
        receiptVersion: "memory_write_retry_receipt_v1",
        receiptStatus: "pending_manual_confirmation",
        canExecuteAutomatically: false,
        manualConfirmationRequired: true,
        plannedAttemptCount: 0,
      },
    });
  });
});
