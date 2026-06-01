import { SettlementBatchStatus, SettlementLineStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildSettlementBatchActionFeedback,
  buildSettlementLineActionFeedback,
} from "@/lib/billing/manual-settlement-feedback";

describe("manual settlement feedback helper", () => {
  it("builds batch feedback with audit reason-chain fields", () => {
    const feedback = buildSettlementBatchActionFeedback({
      kind: "exported",
      batchId: "batch-1",
      batchKey: "settlement_2026_04",
      periodLabel: "2026-04",
      status: SettlementBatchStatus.EXPORTED,
      lineCount: 3,
      actorName: "Billing owner",
      english: true,
      sourcePage: "/settings",
    });

    expect(feedback.operatorMessage).toBe("Settlement batch exported");
    expect(feedback.result).toBe(SettlementBatchStatus.EXPORTED);
    expect(feedback.payload).toMatchObject({
      sourcePage: "/settings",
      actorName: "Billing owner",
      result: SettlementBatchStatus.EXPORTED,
      settlementTarget: "batch",
      settlementAction: "exported",
      batchKey: "settlement_2026_04",
      lineCount: 3,
    });
  });

  it("builds line feedback with reason payload for reversals", () => {
    const feedback = buildSettlementLineActionFeedback({
      kind: "reversed",
      lineId: "line-1",
      lineStatus: SettlementLineStatus.REVERSED,
      actorName: "Billing owner",
      english: false,
      sourcePage: "/settings",
      reason: "manual correction",
    });

    expect(feedback.operatorMessage).toBe("结算条目已冲回");
    expect(feedback.result).toBe(SettlementLineStatus.REVERSED);
    expect(feedback.payload).toMatchObject({
      sourcePage: "/settings",
      actorName: "Billing owner",
      result: SettlementLineStatus.REVERSED,
      settlementTarget: "line",
      settlementAction: "reversed",
      lineId: "line-1",
      reason: "manual correction",
    });
  });
});
