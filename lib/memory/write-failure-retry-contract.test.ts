import { describe, expect, it } from "vitest";
import { buildMemoryWriteRetryContract } from "@/lib/memory/write-failure-retry-contract";
import type { MemoryWriteFailureOperatorQueueItem } from "@/lib/memory/write-failure-operator-queue";

function queueItem(overrides: Partial<MemoryWriteFailureOperatorQueueItem>): MemoryWriteFailureOperatorQueueItem {
  return {
    id: "audit-1:0",
    auditId: "audit-1",
    targetType: "Meeting",
    targetId: "meeting-1",
    meetingId: "meeting-1",
    createdAt: "2026-04-21T04:00:00.000Z",
    title: "客户预算需要下周确认",
    objectType: "OPPORTUNITY",
    objectId: "opp-1",
    factType: "DECISION",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    payloadStatus: "valid",
    failureClass: "retryable",
    reason: "database_unavailable",
    batchStatus: "blocked",
    reviewPosture: "retry_manual_confirm",
    nextAction: "rebuild_from_source_then_retry",
    retryReadiness: "candidate_requires_operator_confirmation",
    canAutoRetry: false,
    boundaryNote: "read-only",
    ...overrides,
  };
}

describe("memory write retry contract", () => {
  it("builds a bounded manual-confirm retry receipt draft without automatic execution authority", () => {
    const contract = buildMemoryWriteRetryContract([queueItem({})]);

    expect(contract).toMatchObject({
      contractItemCount: 1,
      manualConfirmationRequiredCount: 1,
      executableAutomaticallyCount: 0,
      attemptLimit: 3,
      backoffDelaysMinutes: [0, 5, 15],
    });
    expect(contract.items[0]).toMatchObject({
      contractStatus: "manual_confirmation_required",
      retryMode: "manual_confirmed_rebuild_only",
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
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
        attemptLimit: 3,
        plannedAttemptCount: 0,
      },
    });
    expect(contract.items[0].idempotencyLockKey).toMatch(/^memory-write-retry:opportunity-/);
    expect(contract.items[0].idempotencyLockKey).toContain(":meeting_note-");
    expect(contract.items[0].idempotencyLockKey).not.toContain("audit-1");
    expect(contract.boundaryNote).toContain("does not execute retries automatically");
  });

  it("blocks conflict, non-retryable, and payload-inspection items from retry execution", () => {
    const contract = buildMemoryWriteRetryContract([
      queueItem({
        id: "conflict:0",
        auditId: "conflict",
        failureClass: "operator_review_required",
        reason: "db_unique_conflict",
        reviewPosture: "merge_conflict_review",
      }),
      queueItem({
        id: "repair:0",
        auditId: "repair",
        failureClass: "non_retryable",
        reason: "object_not_found",
        reviewPosture: "source_data_repair",
      }),
      queueItem({
        id: "payload:0",
        auditId: "payload",
        objectType: null,
        objectId: null,
        factType: null,
        sourceType: null,
        sourceId: null,
        payloadStatus: "malformed",
        failureClass: "unknown",
        reason: "malformed_audit_payload",
        reviewPosture: "inspect_audit_payload",
      }),
    ]);

    expect(contract).toMatchObject({
      contractItemCount: 3,
      manualConfirmationRequiredCount: 0,
      blockedConflictReviewCount: 1,
      blockedNonRetryableCount: 1,
      blockedPayloadInspectionCount: 1,
      executableAutomaticallyCount: 0,
    });
    expect(contract.items.map((item) => item.contractStatus)).toEqual([
      "blocked_conflict_review_required",
      "blocked_non_retryable",
      "blocked_payload_inspection_required",
    ]);
    expect(contract.items.every((item) => item.receiptDraft.receiptStatus === "blocked")).toBe(true);
    expect(contract.items.every((item) => item.canExecuteAutomatically === false)).toBe(true);
  });

  it("blocks retryable items missing an idempotency scope until payload can be rebuilt", () => {
    const contract = buildMemoryWriteRetryContract([
      queueItem({
        objectId: null,
      }),
    ]);

    expect(contract).toMatchObject({
      manualConfirmationRequiredCount: 0,
      blockedMissingPayloadCount: 1,
    });
    expect(contract.items[0]).toMatchObject({
      contractStatus: "blocked_missing_retry_payload",
      idempotencyLockKey: null,
      receiptDraft: {
        receiptStatus: "blocked",
        idempotencyLockKey: null,
      },
    });
  });

  it("keeps candidate identity stable across audits but distinct for different failed facts", () => {
    const contract = buildMemoryWriteRetryContract([
      queueItem({
        id: "audit-1:0",
        auditId: "audit-1",
        title: "客户预算需要下周确认",
      }),
      queueItem({
        id: "audit-1:1",
        auditId: "audit-1",
        title: "采购负责人要求补一版安全说明",
      }),
      queueItem({
        id: "audit-2:0",
        auditId: "audit-2",
        title: "客户预算需要下周确认",
      }),
    ]);

    const keys = contract.items.map((item) => item.idempotencyLockKey);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toBe(keys[2]);
  });
});
