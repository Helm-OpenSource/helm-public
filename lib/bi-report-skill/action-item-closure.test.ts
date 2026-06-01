import { RiskLevel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildBiReportDirectSignalActionItemMetadata,
  buildBiReportHandoffActionItemMetadata,
  computeBiReportActionItemSla,
  mergeBiReportActionItemMetadata,
  resolveBiReportSlaPolicyHours,
} from "@/lib/bi-report-skill/action-item-closure";
import type {
  BiReportBusinessHandoffDecisionRecord,
  BiReportBusinessSignalRecord,
} from "@/lib/bi-report-skill/types";

function buildSignal(overrides?: Partial<BiReportBusinessSignalRecord>): BiReportBusinessSignalRecord {
  return {
    id: "signal-1",
    workspaceId: "workspace-1",
    sourceRunId: "run-1",
    skillKey: "bi_repay_daily",
    signalType: "bi_repay_daily.anomaly",
    signalKey: "bi_repay_daily:window-1",
    title: "回款日报预警",
    summary: "回款金额较前一日明显下降。",
    severity: "ALERT",
    continuityStatus: "recurring",
    dimensions: null,
    metrics: null,
    evidence: null,
    recommendedActions: ["复核口径"],
    status: "open",
    ownerUserId: "owner-1",
    ownerUserName: "负责人",
    ownerUserEmail: "owner@example.com",
    createdAt: "2026-04-23T01:00:00.000Z",
    updatedAt: "2026-04-23T01:00:00.000Z",
    ...overrides,
  };
}

function buildDecision(): BiReportBusinessHandoffDecisionRecord {
  return {
    id: "decision-1",
    workspaceId: "workspace-1",
    signalId: "signal-1",
    targetType: "approval",
    status: "accepted",
    reviewedByUserId: "user-1",
    reviewComment: "进入审批",
    reviewedAt: "2026-04-23T01:05:00.000Z",
    createdAt: "2026-04-23T01:05:00.000Z",
    updatedAt: "2026-04-23T01:05:00.000Z",
  };
}

describe("bi report action item closure metadata", () => {
  it("maps severity and risk to SLA policy hours", () => {
    expect(resolveBiReportSlaPolicyHours({ severity: "CRITICAL" })).toBe(24);
    expect(resolveBiReportSlaPolicyHours({ severity: "ALERT" })).toBe(48);
    expect(resolveBiReportSlaPolicyHours({ severity: "WARN" })).toBe(72);
    expect(resolveBiReportSlaPolicyHours({ riskLevel: RiskLevel.LOW })).toBe(168);
  });

  it("builds handoff metadata with normalized source and SLA fields", () => {
    const anchorAt = new Date("2026-05-21T08:00:00.000Z");
    const { dueDate, metadata } = buildBiReportHandoffActionItemMetadata({
      signal: buildSignal({ severity: "CRITICAL" }),
      decision: buildDecision(),
      sourceId: "bi-report-handoff:decision-1",
      handoffTargetType: "approval",
      riskLevel: RiskLevel.CRITICAL,
      anchorAt,
    });

    expect(dueDate.toISOString()).toBe("2026-05-22T08:00:00.000Z");
    expect(metadata.operating_closure.source).toMatchObject({
      sourceProvider: "bi_report",
      sourceKind: "bi_handoff",
      sourceId: "bi-report-handoff:decision-1",
      biReportSignalId: "signal-1",
      handoffDecisionId: "decision-1",
    });
    expect(metadata.slaPolicy).toBe("bi_report_risk_sla_24h");
    expect(metadata.slaDueAt).toBe("2026-05-22T08:00:00.000Z");
    expect(metadata.urgencyScore).toBe(90);
  });

  it("builds direct signal metadata for closure kernel path", () => {
    const { metadata } = buildBiReportDirectSignalActionItemMetadata({
      signal: buildSignal({ severity: "WARN" }),
      sourceId: "signal-1",
      anchorAt: new Date("2026-05-21T08:00:00.000Z"),
    });

    expect(metadata.operating_closure.source.sourceKind).toBe("bi_signal_direct");
    expect(metadata.operating_closure.sla.policyHours).toBe(72);
    expect(metadata.biReportSignalKey).toBe("bi_repay_daily:window-1");
  });

  it("merges outcome receipt without dropping prior source and SLA", () => {
    const { metadata: created } = buildBiReportHandoffActionItemMetadata({
      signal: buildSignal(),
      decision: buildDecision(),
      sourceId: "bi-report-handoff:decision-1",
      handoffTargetType: "approval",
      riskLevel: RiskLevel.HIGH,
    });

    const merged = mergeBiReportActionItemMetadata(JSON.stringify(created), {
      operating_closure: {
        outcome: {
          receiptStage: "plan",
          outcome: "approved_pending_execution",
          approvalTaskId: "approval-1",
          updatedAt: "2026-05-21T10:00:00.000Z",
        },
      },
      outcome: "approved_pending_execution",
    });

    const parsed = JSON.parse(merged) as {
      operating_closure: {
        source: { biReportSignalId: string };
        sla: { slaPolicy: string };
        outcome: { receiptStage: string };
      };
      biReportSignalId: string;
      slaPolicy: string;
    };

    expect(parsed.operating_closure.source.biReportSignalId).toBe("signal-1");
    expect(parsed.operating_closure.sla.slaPolicy).toBe("bi_report_risk_sla_48h");
    expect(parsed.operating_closure.outcome.receiptStage).toBe("plan");
    expect(parsed.biReportSignalId).toBe("signal-1");
    expect(parsed.slaPolicy).toBe("bi_report_risk_sla_48h");
  });

  it("computes SLA due date from anchor", () => {
    const anchorAt = new Date("2026-05-21T00:00:00.000Z");
    const { dueDate, sla } = computeBiReportActionItemSla({
      severity: "ALERT",
      anchorAt,
    });

    expect(dueDate.toISOString()).toBe("2026-05-23T00:00:00.000Z");
    expect(sla.slaReason).toContain("48");
  });
});
