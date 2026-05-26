import { MemoryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildMemoryRetrievalBaseline,
  buildMemoryRetrievalSurfaceTraceOverview,
  buildMemoryWriteFailureReviewOverview,
  type MemoryRetrievalBaselineFact,
  type MemoryRetrievalSurfaceTraceInput,
  type MemoryWriteFailureReviewAudit,
} from "@/lib/observability/memory-metrics.service";

function fact(overrides: Partial<MemoryRetrievalBaselineFact>): MemoryRetrievalBaselineFact {
  return {
    id: "fact-1",
    objectType: "OPPORTUNITY",
    objectId: "opp-1",
    factType: "NEXT_STEP",
    title: "Send the proposal draft",
    content: "Send the proposal draft by Wednesday",
    normalizedValue: null,
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    confidence: 70,
    importance: 70,
    freshnessScore: 70,
    status: MemoryStatus.ACTIVE,
    confirmedByUser: false,
    updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    ...overrides,
  };
}

function trace(
  overrides: Partial<MemoryRetrievalSurfaceTraceInput["trace"]> & {
    surface: MemoryRetrievalSurfaceTraceInput["trace"]["surface"];
    objectId: string;
    selectedCount: number;
    omittedCount: number;
    candidateCount?: number;
    fallbackUsed?: boolean;
    staleSuppressionCount?: number;
  },
): MemoryRetrievalSurfaceTraceInput["trace"] {
  const candidateCount = overrides.candidateCount ?? overrides.selectedCount + overrides.omittedCount;

  return {
    surface: overrides.surface,
    objectType: overrides.objectType ?? "OPPORTUNITY",
    objectId: overrides.objectId,
    budget: overrides.budget ?? {
      maxItems: 8,
      maxEstimatedTokens: 720,
    },
    fallback: overrides.fallback ?? {
      used: overrides.fallbackUsed ?? false,
      reason: overrides.fallbackUsed ? "test fallback" : null,
    },
    selected: overrides.selected ?? [],
    omitted: overrides.omitted ?? [],
    trace: overrides.trace ?? {
      candidateCount,
      selectedCount: overrides.selectedCount,
      omittedCount: overrides.omittedCount,
      estimatedTokensUsed: 180,
      estimatedTokensRemaining: 540,
      selectedReasons: [{ reason: "high_importance", count: overrides.selectedCount }],
      omittedReasons: [
        { reason: "budget_item_limit" as const, count: Math.max(0, overrides.omittedCount - (overrides.staleSuppressionCount ?? 0)) },
        ...(overrides.staleSuppressionCount
          ? [{ reason: "stale_suppressed" as const, count: overrides.staleSuppressionCount }]
          : []),
      ].filter((item) => item.count > 0),
      staleSuppressionRefs: Array.from({ length: overrides.staleSuppressionCount ?? 0 }, (_, index) => `stale-${index + 1}`),
      evidenceRefs: ["memoryFact:fact-1"],
      boundaryNote: "Retrieval pack is evidence packaging only; it does not change recommendation ranking.",
    },
  };
}

function writeFailureAudit(overrides: Partial<MemoryWriteFailureReviewAudit>): MemoryWriteFailureReviewAudit {
  return {
    id: "audit-1",
    targetType: "Meeting",
    targetId: "meeting-1",
    summary: "会议记忆事实写入失败：预算复盘",
    payload: JSON.stringify({
      meetingId: "meeting-1",
      memoryWriteGuard: {
        duplicateSuppressedCount: 1,
        conflictCandidateCount: 2,
      },
      memoryWriteBatch: {
        attemptedFactCount: 1,
        createdFactCount: 0,
        failedFactCount: 1,
        retryableFailureCount: 1,
        nonRetryableFailureCount: 0,
        operatorReviewRequiredCount: 0,
        failurePolicy: "fail_fast",
        status: "blocked",
      },
      factWriteFailures: [
        {
          failureClass: "retryable",
          reason: "database_unavailable",
          message: "Can't reach database server",
          title: "客户预算需要下周确认",
          objectType: "OPPORTUNITY",
          objectId: "opp-1",
          factType: "DECISION",
          sourceType: "MEETING_NOTE",
          sourceId: "meeting-1",
          retryable: true,
          operatorReviewRequired: false,
        },
      ],
    }),
    createdAt: new Date("2026-04-20T04:00:00.000Z"),
    ...overrides,
  };
}

describe("memory retrieval baseline", () => {
  it("keeps one duplicate candidate and records duplicate / stale / omitted reasons", () => {
    const baseline = buildMemoryRetrievalBaseline([
      fact({
        id: "confirmed",
        confirmedByUser: true,
        normalizedValue: "proposal-draft",
      }),
      fact({
        id: "duplicate",
        confidence: 50,
        importance: 50,
        freshnessScore: 50,
        normalizedValue: "proposal-draft",
      }),
      fact({
        id: "stale",
        objectId: "opp-2",
        freshnessScore: 20,
        normalizedValue: "old-risk",
      }),
      fact({
        id: "low-confidence",
        objectId: "opp-3",
        confidence: 30,
        importance: 20,
        freshnessScore: 50,
        normalizedValue: "weak-signal",
      }),
      fact({
        id: "inactive",
        objectId: "opp-4",
        freshnessScore: 90,
        status: MemoryStatus.ARCHIVED,
        normalizedValue: "archived-context",
      }),
    ]);

    expect(baseline.totalCandidateCount).toBe(5);
    expect(baseline.selectedCandidateCount).toBe(1);
    expect(baseline.omittedCandidateCount).toBe(4);
    expect(baseline.duplicateCandidateCount).toBe(1);
    expect(baseline.staleSuppressionCandidateCount).toBe(1);
    expect(baseline.sourceEventCount).toBe(1);
    expect(baseline.averageFactsPerSourceEvent).toBe(5);
    expect(baseline.selectedReasons).toContainEqual({
      reason: "confirmed_by_user",
      count: 1,
    });
    expect(baseline.omittedReasons).toEqual([
      { reason: "duplicate_candidate", count: 1 },
      { reason: "inactive_or_removed", count: 1 },
      { reason: "low_confidence", count: 1 },
      { reason: "stale_candidate", count: 1 },
    ]);
  });

  it("uses source event count to expose write amplification pressure", () => {
    const baseline = buildMemoryRetrievalBaseline([
      fact({ id: "fact-1", sourceId: "meeting-1", normalizedValue: "one" }),
      fact({ id: "fact-2", sourceId: "meeting-1", normalizedValue: "two" }),
      fact({ id: "fact-3", sourceId: "meeting-2", normalizedValue: "three" }),
    ]);

    expect(baseline.sourceEventCount).toBe(2);
    expect(baseline.averageFactsPerSourceEvent).toBe(1.5);
  });

  it("summarizes real surface retrieval traces separately from proxy baseline", () => {
    const overview = buildMemoryRetrievalSurfaceTraceOverview([
      {
        source: "briefing_snapshot",
        trace: trace({
          surface: "briefing",
          objectId: "meeting-1",
          selectedCount: 2,
          omittedCount: 1,
        }),
        createdAt: new Date("2026-04-20T01:00:00.000Z"),
      },
      {
        source: "recommendation_payload",
        trace: trace({
          surface: "recommendation",
          objectId: "opp-1",
          selectedCount: 1,
          omittedCount: 2,
          fallbackUsed: true,
          staleSuppressionCount: 1,
        }),
        createdAt: new Date("2026-04-20T02:00:00.000Z"),
      },
    ]);

    expect(overview.traceCount).toBe(2);
    expect(overview.totals.selectedCount).toBe(3);
    expect(overview.totals.omittedCount).toBe(3);
    expect(overview.totals.fallbackCount).toBe(1);
    expect(overview.totals.staleSuppressionCount).toBe(1);
    expect(overview.sourceBreakdown).toEqual([
      { source: "briefing_snapshot", count: 1 },
      { source: "recommendation_payload", count: 1 },
    ]);
    expect(overview.surfaceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "briefing",
          traceCount: 1,
          selectedCount: 2,
          omittedCount: 1,
        }),
        expect.objectContaining({
          surface: "recommendation",
          fallbackCount: 1,
          staleSuppressionCount: 1,
        }),
      ]),
    );
    expect(overview.recentTraceRefs[0]).toEqual(
      expect.objectContaining({
        source: "recommendation_payload",
        surface: "recommendation",
        fallbackUsed: true,
      }),
    );
    expect(overview.boundaryNote).toContain("recommendation ranking");
    expect(overview.boundaryNote).toContain("commitment authority");
  });

  it("summarizes memory write failure audits without implying automatic retry authority", () => {
    const overview = buildMemoryWriteFailureReviewOverview(
      [
        writeFailureAudit({ id: "retryable-audit" }),
        writeFailureAudit({
          id: "review-audit",
          targetId: "meeting-2",
          payload: JSON.stringify({
            meetingId: "meeting-2",
            duplicateSuppressions: [{ title: "重复 next step" }],
            conflictCandidates: [],
            memoryWriteBatch: {
              attemptedFactCount: 2,
              createdFactCount: 1,
              failedFactCount: 1,
              retryableFailureCount: 0,
              nonRetryableFailureCount: 0,
              operatorReviewRequiredCount: 1,
              failurePolicy: "collect_all",
              status: "partial_failed",
            },
            factWriteFailures: [
              {
                failureClass: "operator_review_required",
                reason: "db_unique_conflict",
                message: "Unique constraint failed",
                title: "采购偏好需要人工合并",
                retryable: false,
                operatorReviewRequired: true,
              },
            ],
          }),
          createdAt: new Date("2026-04-20T05:00:00.000Z"),
        }),
      ],
      {
        failureEventCount: 3,
        sampleLimit: 2,
        retryReceiptAudits: [
          {
            id: "retry-receipt-audit",
            targetType: "Meeting",
            targetId: "meeting-1",
            summary: "retry receipt recorded",
            payload: JSON.stringify({
              receiptVersion: "memory_write_retry_receipt_v1",
              receiptStatus: "pending_manual_confirmation",
              retryContractItemId: "retryable-audit:0:retry-contract",
              sourceAuditId: "retryable-audit",
              queueItemId: "retryable-audit:0",
              idempotencyLockKey: "semantic-lock",
              ownerUserId: "user-1",
              ownerName: "Ada Chen",
              ownerEmail: "ada@example.com",
              attemptLimit: 3,
              plannedAttemptCount: 0,
              backoffPolicy: {
                strategy: "bounded_exponential",
                delaysMinutes: [0, 5, 15],
              },
              missingInputs: ["content", "actor_context", "normalized_value"],
              requiredManualChecks: ["record_retry_receipt_before_write"],
              canExecuteAutomatically: false,
              manualConfirmationRequired: true,
            }),
            userId: "user-1",
            actor: "Ada Chen",
            createdAt: new Date("2026-04-20T06:00:00.000Z"),
          },
        ],
        retryAttemptAudits: [
          {
            id: "retry-attempt-audit",
            targetType: "Meeting",
            targetId: "meeting-1",
            summary: "retry attempt recorded",
            payload: JSON.stringify({
              attemptLedgerVersion: "memory_write_retry_attempt_ledger_v1",
              attemptStatus: "blocked_receipt_not_confirmed",
              retryContractItemId: "retryable-audit:0:retry-contract",
              queueItemId: "retryable-audit:0",
              sourceAuditId: "retryable-audit",
              receiptAuditId: "retry-receipt-audit",
              idempotencyLockKey: "semantic-lock",
              attemptNumber: 1,
              attemptLimit: 3,
              canExecuteAutomatically: false,
              manualConfirmationRequired: true,
            }),
            userId: "user-1",
            actor: "Ada Chen",
            createdAt: new Date("2026-04-20T06:30:00.000Z"),
          },
        ],
        ownerAssignments: [
          {
            targetType: "Meeting",
            targetId: "meeting-1",
            objectTitle: "预算复盘",
            ownerUserId: "user-1",
            ownerName: "Ada Chen",
            ownerEmail: "ada@example.com",
          },
        ],
      },
    );

    expect(overview.failureEventCount).toBe(3);
    expect(overview.sampledFailureEventCount).toBe(2);
    expect(overview.sampleLimit).toBe(2);
    expect(overview.isSampled).toBe(true);
    expect(overview.blockedBatchCount).toBe(1);
    expect(overview.partialFailedBatchCount).toBe(1);
    expect(overview.retryableFailureCount).toBe(1);
    expect(overview.operatorReviewRequiredCount).toBe(1);
    expect(overview.duplicateSuppressionCount).toBe(2);
    expect(overview.conflictCandidateCount).toBe(2);
    expect(overview.failureClassBreakdown).toEqual(
      expect.arrayContaining([
        { failureClass: "retryable", count: 1 },
        { failureClass: "operator_review_required", count: 1 },
      ]),
    );
    expect(overview.failureReasonBreakdown).toEqual(
      expect.arrayContaining([
        { reason: "database_unavailable", count: 1 },
        { reason: "db_unique_conflict", count: 1 },
      ]),
    );
    expect(overview.recentFailures[0]).toEqual(
      expect.objectContaining({
        id: "retryable-audit",
        batchStatus: "blocked",
        firstFailureReason: "database_unavailable",
        reviewPosture: "manual_retry_candidate",
      }),
    );
    expect(overview.recentFailures[1]).toEqual(
      expect.objectContaining({
        id: "review-audit",
        reviewPosture: "operator_review_required",
      }),
    );
    expect(overview.operatorQueue).toMatchObject({
      queueItemCount: 2,
      visibleQueueItemCount: 2,
      omittedQueueItemCount: 0,
      hasMoreItems: false,
      retryCandidateCount: 1,
      conflictReviewCount: 1,
      sourceRepairCount: 0,
      payloadReviewCount: 0,
    });
    expect(overview.operatorQueue.items.map((item) => item.reviewPosture)).toEqual([
      "retry_manual_confirm",
      "merge_conflict_review",
    ]);
    expect(overview.operatorQueue.items.every((item) => item.canAutoRetry === false)).toBe(true);
    expect(overview.retryContract).toMatchObject({
      contractItemCount: 2,
      manualConfirmationRequiredCount: 1,
      blockedConflictReviewCount: 1,
      executableAutomaticallyCount: 0,
      attemptLimit: 3,
      backoffDelaysMinutes: [0, 5, 15],
    });
    expect(overview.retryContract.items.map((item) => item.contractStatus)).toEqual([
      "manual_confirmation_required",
      "blocked_conflict_review_required",
    ]);
    expect(overview.retryContract.items.every((item) => item.canExecuteAutomatically === false)).toBe(true);
    expect(overview.retryReceiptLedger).toMatchObject({
      ledgerItemCount: 2,
      receiptAuditCount: 1,
      persistedReceiptCount: 1,
      missingReceiptCount: 1,
      pendingManualConfirmationCount: 1,
      ownerAssignedCount: 1,
      ownerMissingCount: 1,
      executableAutomaticallyCount: 0,
    });
    expect(overview.retryReceiptLedger.items[0]).toMatchObject({
      receiptStatus: "pending_manual_confirmation",
      ownerLabel: "Ada Chen",
      nextOperatorAction: "confirm_or_dismiss_receipt",
      canExecuteAutomatically: false,
    });
    expect(overview.retryReceiptLedger.items[1]).toMatchObject({
      ownerReviewStatus: "owner_missing",
      nextOperatorAction: "resolve_blocking_contract",
    });
    expect(overview.retryAttemptLedger).toMatchObject({
      ledgerItemCount: 2,
      attemptAuditCount: 1,
      persistedAttemptCount: 1,
      missingReceiptLockCount: 1,
      receiptNotConfirmedCount: 1,
      sourceRebuildRequiredCount: 0,
      executableAutomaticallyCount: 0,
    });
    expect(overview.retryAttemptLedger.items[0]).toMatchObject({
      latestAttemptAuditId: "retry-attempt-audit",
      latestAttemptStatus: "blocked_receipt_not_confirmed",
      idempotencyLockStatus: "blocked_receipt_not_confirmed",
      canExecuteAutomatically: false,
    });
    expect(overview.retryAttemptLedger.items[1]).toMatchObject({
      latestAttemptStatus: "missing_attempt",
      idempotencyLockStatus: "blocked_missing_receipt",
      nextOperatorAction: "record_retry_receipt",
    });
    expect(overview.boundaryNote).toContain("read-only diagnostics");
    expect(overview.boundaryNote).toContain("does not retry automatically");
  });
});
