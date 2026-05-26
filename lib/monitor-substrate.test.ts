import { describe, expect, it } from "vitest";
import {
  buildMonitorSubstrateReadout,
  buildMonitorSubstrateSummary,
} from "@/lib/monitor-substrate";

const now = new Date("2026-04-24T00:00:00.000Z");

describe("monitor substrate", () => {
  it("keeps connector lag within threshold as report-only readout", () => {
    const readout = buildMonitorSubstrateReadout({
      monitorKey: "acme-crm-sync",
      signalKind: "connector_lag",
      sourceRef: "connector:acme-crm",
      staleMinutes: 8,
      threshold: 15,
      observedAt: now,
    });

    expect(readout).toMatchObject({
      readoutKey: "monitor_readout_acme_crm_sync_connector_lag",
      severity: "ok",
      outputPosture: "report_only",
      primaryReasonCode: "within_threshold",
    });
    expect(readout.evaluation.sourceChain.map((step) => [step.step, step.outcome])).toEqual([
      ["signal_truth", "pass"],
      ["threshold_check", "pass"],
      ["review_posture", "pass"],
      ["authority_boundary", "pass"],
    ]);
  });

  it("routes connector lag over threshold to review without creating execution authority", () => {
    const readout = buildMonitorSubstrateReadout({
      monitorKey: "acme-crm-sync",
      signalKind: "connector_lag",
      sourceRef: "connector:acme-crm",
      staleMinutes: 42,
      threshold: 15,
      observedAt: now,
    });

    expect(readout.severity).toBe("escalate");
    expect(readout.outputPosture).toBe("route_to_review");
    expect(readout.primaryReasonCode).toBe("connector_lag_detected");
    expect(readout.boundaries).toEqual([
      "read_only",
      "review_first",
      "no_auto_execution",
      "no_customer_visible_send",
    ]);
    expect(readout.boundaryNotes.join("\n")).toContain("does not execute actions");
  });

  it("treats webhook failures as review routing instead of automatic replay", () => {
    const readout = buildMonitorSubstrateReadout({
      monitorKey: "payment-webhook-receipt",
      signalKind: "webhook_failure",
      sourceRef: "webhook:payment",
      failedCount: 1,
      observedAt: now,
    });

    expect(readout.primaryReasonCode).toBe("webhook_receipt_stale");
    expect(readout.severity).toBe("watch");
    expect(readout.outputPosture).toBe("route_to_review");
    expect(readout.operatorNextMove).toContain("do not replay automatically");
  });

  it("blocks settlement exceptions and preserves payout boundary notes", () => {
    const readout = buildMonitorSubstrateReadout({
      monitorKey: "manual-settlement-export",
      signalKind: "settlement_exception",
      sourceRef: "settlement:batch-1",
      exceptionCount: 1,
      observedAt: now,
    });

    expect(readout.severity).toBe("blocked");
    expect(readout.outputPosture).toBe("blocked");
    expect(readout.primaryReasonCode).toBe("settlement_exception_open");
    expect(readout.evaluation.sourceChain.find((step) => step.step === "threshold_check")).toMatchObject({
      outcome: "block",
    });
    expect(readout.boundaryNotes.join("\n")).toContain("does not create payout rail");
  });

  it("aggregates severity and chooses the highest-priority operator next move", () => {
    const ok = buildMonitorSubstrateReadout({
      monitorKey: "meeting-ingest",
      signalKind: "meeting_ingest_backlog",
      sourceRef: "meetings:queue",
      backlogCount: 0,
      observedAt: now,
    });
    const blocked = buildMonitorSubstrateReadout({
      monitorKey: "manual-settlement-export",
      signalKind: "settlement_exception",
      sourceRef: "settlement:batch-1",
      exceptionCount: 1,
      observedAt: now,
    });
    const summary = buildMonitorSubstrateSummary([ok, blocked], { generatedAt: now });

    expect(summary).toMatchObject({
      generatedAt: "2026-04-24T00:00:00.000Z",
      totalReadouts: 2,
      severityCounts: {
        ok: 1,
        watch: 0,
        escalate: 0,
        blocked: 1,
      },
      blockedKeys: ["monitor_readout_manual_settlement_export_settlement_exception"],
      primaryNextMove: "Hold the settlement path and require manual commercial review.",
    });
    expect(summary.boundaryNotes.join("\n")).toContain("does not create scheduler");
  });
});
