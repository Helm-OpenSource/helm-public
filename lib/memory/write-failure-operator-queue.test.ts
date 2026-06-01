import { describe, expect, it } from "vitest";
import {
  buildMemoryWriteFailureOperatorQueue,
  type MemoryWriteFailureOperatorQueueAudit,
} from "@/lib/memory/write-failure-operator-queue";

function audit(overrides: Partial<MemoryWriteFailureOperatorQueueAudit>): MemoryWriteFailureOperatorQueueAudit {
  return {
    id: "audit-1",
    targetType: "Meeting",
    targetId: "meeting-1",
    summary: "会议记忆事实写入失败：预算复盘",
    payload: JSON.stringify({
      meetingId: "meeting-1",
      memoryWriteBatch: {
        status: "blocked",
      },
      factWriteFailures: [
        {
          failureClass: "retryable",
          reason: "database_unavailable",
          title: "客户预算需要下周确认",
          objectType: "OPPORTUNITY",
          objectId: "opp-1",
          factType: "DECISION",
          sourceType: "MEETING_NOTE",
          sourceId: "meeting-1",
        },
      ],
    }),
    createdAt: new Date("2026-04-21T04:00:00.000Z"),
    ...overrides,
  };
}

describe("memory write failure operator queue", () => {
  it("turns retryable failures into manual-confirm retry candidates without auto retry authority", () => {
    const queue = buildMemoryWriteFailureOperatorQueue([audit({})]);

    expect(queue.queueItemCount).toBe(1);
    expect(queue.retryCandidateCount).toBe(1);
    expect(queue.items[0]).toMatchObject({
      auditId: "audit-1",
      meetingId: "meeting-1",
      title: "客户预算需要下周确认",
      objectType: "OPPORTUNITY",
      objectId: "opp-1",
      factType: "DECISION",
      reviewPosture: "retry_manual_confirm",
      nextAction: "rebuild_from_source_then_retry",
      retryReadiness: "candidate_requires_operator_confirmation",
      payloadStatus: "valid",
      canAutoRetry: false,
    });
    expect(queue.boundaryNote).toContain("read-only triage queue");
    expect(queue.boundaryNote).toContain("commitment authority");
  });

  it("separates conflict review, source repair, malformed payload, and empty payload inspection posture", () => {
    const queue = buildMemoryWriteFailureOperatorQueue([
      audit({
        id: "review",
        payload: JSON.stringify({
          memoryWriteBatch: { status: "partial_failed" },
          factWriteFailures: [
            {
              failureClass: "operator_review_required",
              reason: "db_unique_conflict",
              title: "采购偏好需要人工合并",
            },
          ],
        }),
      }),
      audit({
        id: "repair",
        payload: JSON.stringify({
          memoryWriteBatch: { status: "blocked" },
          factWriteFailures: [
            {
              failureClass: "non_retryable",
              reason: "object_not_found",
              title: "不存在的对象",
            },
          ],
        }),
      }),
      audit({
        id: "missing-failures",
        payload: JSON.stringify({
          memoryWriteBatch: { status: "blocked" },
        }),
      }),
      audit({
        id: "malformed",
        payload: "{",
      }),
      audit({
        id: "empty",
        payload: null,
      }),
    ]);

    expect(queue.queueItemCount).toBe(5);
    expect(queue.conflictReviewCount).toBe(1);
    expect(queue.sourceRepairCount).toBe(1);
    expect(queue.payloadReviewCount).toBe(3);
    expect(queue.items.map((item) => item.reviewPosture)).toEqual([
      "merge_conflict_review",
      "source_data_repair",
      "inspect_audit_payload",
      "inspect_audit_payload",
      "inspect_audit_payload",
    ]);
    expect(
      queue.items.slice(2).map((item) => ({
        auditId: item.auditId,
        payloadStatus: item.payloadStatus,
        reason: item.reason,
      })),
    ).toEqual([
      {
        auditId: "missing-failures",
        payloadStatus: "valid",
        reason: "missing_fact_write_failures",
      },
      {
        auditId: "malformed",
        payloadStatus: "malformed",
        reason: "malformed_audit_payload",
      },
      {
        auditId: "empty",
        payloadStatus: "empty",
        reason: "empty_audit_payload",
      },
    ]);
    expect(queue.items.every((item) => item.canAutoRetry === false)).toBe(true);
  });

  it("keeps the queue bounded to the requested item limit", () => {
    const queue = buildMemoryWriteFailureOperatorQueue(
      Array.from({ length: 4 }, (_, index) => audit({ id: `audit-${index + 1}` })),
      { itemLimit: 2 },
    );

    expect(queue.queueItemCount).toBe(4);
    expect(queue.visibleQueueItemCount).toBe(2);
    expect(queue.itemLimit).toBe(2);
    expect(queue.omittedQueueItemCount).toBe(2);
    expect(queue.hasMoreItems).toBe(true);
    expect(queue.items.map((item) => item.auditId)).toEqual(["audit-1", "audit-2"]);
  });
});
