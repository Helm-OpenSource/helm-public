import { describe, expect, it } from "vitest";
import { buildBiReportBusinessHandoffDrafts } from "@/lib/bi-report-skill/business-handoff";
import type { BiReportBusinessSignalRecord } from "@/lib/bi-report-skill/types";

function buildSignal(overrides?: Partial<BiReportBusinessSignalRecord>): BiReportBusinessSignalRecord {
  return {
    id: "signal-1",
    workspaceId: "workspace-1",
    sourceRunId: "run-1",
    skillKey: "bi_repay_daily",
    signalType: "bi_repay_daily.anomaly",
    signalKey: "bi_repay_daily:2026-04-21 vs 2026-04-20",
    title: "回款日报预警",
    summary: "回款金额较前一日明显下降。",
    severity: "WARN",
    continuityStatus: "recurring",
    dimensions: null,
    metrics: null,
    evidence: null,
    recommendedActions: ["复核回款口径"],
    status: "open",
    ownerUserId: "user-1",
    ownerUserName: "负责人",
    ownerUserEmail: "owner@example.com",
    createdAt: "2026-04-22T10:00:00.000Z",
    updatedAt: "2026-04-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("bi report business handoff", () => {
  it("builds recommendation draft for warn signals", () => {
    const drafts = buildBiReportBusinessHandoffDrafts(buildSignal());

    expect(drafts).toEqual([
      expect.objectContaining({
        targetType: "recommendation",
        priority: "medium",
        ownerUserId: "user-1",
      }),
    ]);
  });

  it("builds action item draft for alert signals", () => {
    const drafts = buildBiReportBusinessHandoffDrafts(buildSignal({ severity: "ALERT" }));

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual(
      expect.objectContaining({
        targetType: "action_item",
        priority: "high",
      }),
    );
  });

  it("builds approval plus action item drafts for critical signals", () => {
    const drafts = buildBiReportBusinessHandoffDrafts(
      buildSignal({
        severity: "CRITICAL",
        signalType: "complaint_risk_rising",
        metrics: {
          complaintCount: 5,
          complaintBaseline: 2.5,
          complaintResolutionRatePct: 40,
          complaintResolutionBaselinePct: 100,
        },
        evidence: {
          changePct: {
            complaintRisePct: 100,
            resolutionDropPct: 60,
          },
        },
        recommendedActions: ["当天核查投诉处理进度", "复核处理率口径"],
      }),
    );

    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.targetType).toBe("approval");
    expect(drafts[1]?.targetType).toBe("action_item");
    expect(drafts[0]?.summary).toContain("未达标指标：");
    expect(drafts[0]?.summary).toContain("投诉量：当前 5，基线 2.50，变化 100%");
    expect(drafts[0]?.summary).toContain("建议动作：");
  });
});
