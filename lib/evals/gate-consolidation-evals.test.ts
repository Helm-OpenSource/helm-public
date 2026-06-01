import { describe, expect, it } from "vitest";
import {
  runGateConsolidationEval,
  type GateRegistryFixturePack,
} from "./gate-consolidation-evals";

describe("gate consolidation eval (P0-REQ-06)", () => {
  it("passes the default registry with all required keep gates present", () => {
    const summary = runGateConsolidationEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalGates).toBeGreaterThanOrEqual(20);
    expect(summary.activeCount).toBeGreaterThanOrEqual(5);
    expect(summary.nonBlockingCount).toBeGreaterThanOrEqual(2);
    expect(summary.failures).toEqual([]);

    for (const result of summary.caseResults) {
      if (result.active) {
        expect(result.hasCustomerVisibleRisk).toBe(true);
        expect(result.metaOnly).toBe(false);
        expect(result.feedsPilotDecision).toBe(true);
      }
    }
  });

  it("fails when an active gate lacks a customer-visible risk", () => {
    const pack: GateRegistryFixturePack = {
      version: "test",
      status: "offline_evaluation_fixture",
      boundary: "planning_only",
      policy: {
        activeStatuses: ["keep"],
        nonBlockingStatuses: ["freeze", "research", "archive"],
        requiredCustomerVisibleRiskForKeep: true,
      },
      gates: [
        {
          id: "boundary",
          displayName: "Boundary",
          klass: "boundary_static_gate",
          status: "keep",
          customerVisibleRisk: "covers commitment leakage",
          evidence: ["x.ts"],
          metaOnly: false,
          feedsPilotDecision: true,
          rationale: "ok",
        },
        {
          id: "object-signal",
          displayName: "Object Signal",
          klass: "object_signal_validity_eval",
          status: "keep",
          customerVisibleRisk: "covers bad object admission",
          evidence: ["y.ts"],
          metaOnly: false,
          feedsPilotDecision: true,
          rationale: "ok",
        },
        {
          id: "context-audit",
          displayName: "Context Audit",
          klass: "context_packet_audit",
          status: "keep",
          customerVisibleRisk: "covers context omission",
          evidence: ["z.ts"],
          metaOnly: false,
          feedsPilotDecision: true,
          rationale: "ok",
        },
        {
          id: "memory-quality",
          displayName: "Memory Quality",
          klass: "memory_quality_impact_eval",
          status: "keep",
          customerVisibleRisk: "covers memory contamination",
          evidence: ["m.ts"],
          metaOnly: false,
          feedsPilotDecision: true,
          rationale: "ok",
        },
        {
          id: "trace-roi",
          displayName: "Trace ROI",
          klass: "trace_roi_pilot_proof_gate",
          status: "keep",
          customerVisibleRisk: "covers audit gap",
          evidence: ["t.ts"],
          metaOnly: false,
          feedsPilotDecision: true,
          rationale: "ok",
        },
        {
          id: "naked-meta-gate",
          displayName: "Naked meta gate",
          klass: "meta_gate",
          status: "keep",
          customerVisibleRisk: null,
          evidence: ["w.ts"],
          metaOnly: true,
          feedsPilotDecision: true,
          rationale: "should not be in active list",
        },
      ],
    };

    const summary = runGateConsolidationEval(pack);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some(
        (f) =>
          f.caseId === "naked-meta-gate" &&
          f.reason === "active_gate_missing_customer_visible_risk",
      ),
    ).toBe(true);
    expect(
      summary.failures.some(
        (f) =>
          f.caseId === "naked-meta-gate" &&
          f.reason === "meta_only_gate_in_active_list",
      ),
    ).toBe(true);
  });

  it("fails when a required keep klass is missing from the active list", () => {
    const pack: GateRegistryFixturePack = {
      version: "test",
      status: "offline_evaluation_fixture",
      boundary: "planning_only",
      policy: {
        activeStatuses: ["keep"],
        nonBlockingStatuses: ["freeze", "research", "archive"],
        requiredCustomerVisibleRiskForKeep: true,
      },
      gates: [
        {
          id: "boundary",
          displayName: "Boundary",
          klass: "boundary_static_gate",
          status: "keep",
          customerVisibleRisk: "covers commitment leakage",
          evidence: ["x.ts"],
          metaOnly: false,
          feedsPilotDecision: true,
          rationale: "ok",
        },
      ],
    };

    const summary = runGateConsolidationEval(pack);

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.startsWith("missing_required_keep_klass:object_signal_validity_eval"),
      ),
    ).toBe(true);
  });
});
