import { describe, expect, it } from "vitest";

import founderCasesFixture from "@/evals/founder-operating-loop/founder-operating-loop-cases.json";
import {
  runFounderOperatingLoopEval,
  type FounderFixturePack,
} from "./founder-operating-loop-evals";

function cloneFixture(): FounderFixturePack {
  return JSON.parse(JSON.stringify(founderCasesFixture)) as FounderFixturePack;
}

describe("Founder Operating Loop eval", () => {
  it("passes on the checked-in alias-only fixture", () => {
    const summary = runFounderOperatingLoopEval();
    expect(summary.passed).toBe(true);
    expect(summary.failures).toEqual([]);
    expect(summary.incidents).toEqual({
      boundaryBreachCount: 0,
      emptyEvidenceBundleCount: 0,
      duplicateSourceIdCount: 0,
      crossWorkspaceJoinCount: 0,
      autoOutboundCount: 0,
      nonCeoViewerCount: 0,
      sensitiveIdentityRankingCount: 0,
      briefingCapBreachCount: 0,
      judgmentCardinalityBreachCount: 0,
      qaSideEffectCount: 0,
    });
  });

  it("counts coverage for §9.1 case-management layers and §9.2 helm-self faces", () => {
    const summary = runFounderOperatingLoopEval();
    expect(summary.coverage.helmSelfFacesMissing).toEqual([]);
    expect(summary.coverage.caseManagementLayersMissing).toEqual([]);
    expect(summary.coverage.boundaryGatesUnderMinimum).toEqual([]);
    expect(summary.coverage.routingReasonsMissing).toEqual([]);
    expect(summary.coverage.connectorsMissing).toEqual([]);
  });

  it("rejects empty Evidence Bundle (B3)", () => {
    const pack = cloneFixture();
    // Force the first helm-self signal to have an empty bundle.
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      evidenceBundle: unknown[];
    };
    firstSignal.evidenceBundle = [];
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.emptyEvidenceBundleCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((f) => f.reason.includes("evidence_bundle_empty")),
    ).toBe(true);
  });

  it("rejects cross-workspace signal join (B5)", () => {
    const pack = cloneFixture();
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      sourceId: string;
    };
    firstSignal.sourceId = "workspace:other-tenant-alias:git_commit:abc123";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.crossWorkspaceJoinCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((f) => f.reason.includes("cross_workspace_join")),
    ).toBe(true);
  });

  it("rejects non-CEO reviewer on a route (B1 single-viewer projection)", () => {
    const pack = cloneFixture();
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      route: { reviewer: string };
    };
    firstSignal.route.reviewer = "workspace_admin";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.nonCeoViewerCount).toBeGreaterThan(0);
  });

  it("rejects auto-advance (B4): ceo_approved + awaiting_ceo_review", () => {
    const pack = cloneFixture();
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      action: { status: string; executionMode: string };
    };
    firstSignal.action.status = "ceo_approved";
    firstSignal.action.executionMode = "awaiting_ceo_review";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.autoOutboundCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("phase_1_action_status_must_be_awaiting_ceo_review"),
      ),
    ).toBe(true);
  });

  it("rejects Phase 1 fixture carrying a runtime post-advance state (status=ceo_approved + executionMode=ceo_advanced_outbound_drafted)", () => {
    const pack = cloneFixture();
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      action: { status: string; executionMode: string };
    };
    firstSignal.action.status = "ceo_approved";
    firstSignal.action.executionMode = "ceo_advanced_outbound_drafted";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.autoOutboundCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("phase_1_action_execution_mode_must_be_awaiting_ceo_review"),
      ),
    ).toBe(true);
  });

  it("rejects an unknown signal.family (no silent §5.2 8-step mapping drift)", () => {
    const pack = cloneFixture();
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      family: string;
    };
    firstSignal.family = "not_a_family";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) => f.reason.includes("unknown_signal_family")),
    ).toBe(true);
  });

  it("rejects fixture trying to disable OQ-D connector minimum gate", () => {
    const pack = cloneFixture();
    (pack.policy as unknown as { requireConnectorMinimumSet: boolean })
      .requireConnectorMinimumSet = false;
    for (const r of pack.runs) {
      (r as unknown as { connectorsUsed: unknown[] }).connectorsUsed = [];
    }
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("oq_d_requireConnectorMinimumSet_must_be_true"),
      ),
    ).toBe(true);
  });

  it("rejects fixture whose minimumConnectorMatrix drifts from FOUNDER_CONNECTOR_MINIMUM_SET", () => {
    const pack = cloneFixture();
    (pack.policy as unknown as { minimumConnectorMatrix: string[] })
      .minimumConnectorMatrix = ["git", "email_imap_smtp"];
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("oq_d_minimumConnectorMatrix_mismatch"),
      ),
    ).toBe(true);
  });

  it("rejects judgment cardinality breach (§6.2 four-question contract)", () => {
    const pack = cloneFixture();
    const firstSignal = pack.runs[0].signals[0] as unknown as {
      judgments: unknown[];
    };
    firstSignal.judgments = firstSignal.judgments.slice(0, 3);
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.judgmentCardinalityBreachCount).toBeGreaterThan(0);
  });

  it("rejects duplicate sourceId within a run (§6.4)", () => {
    const pack = cloneFixture();
    const signals = pack.runs[0].signals as unknown as Array<{
      sourceId: string;
    }>;
    signals[1].sourceId = signals[0].sourceId;
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.duplicateSourceIdCount).toBeGreaterThan(0);
  });

  it("rejects briefing cap breach (OQ-G: 10 thread cap)", () => {
    const pack = cloneFixture();
    const readout = pack.runs[0].readout as unknown as {
      nextSafeActions: unknown[];
    };
    const fillerAction = readout.nextSafeActions[0];
    while (readout.nextSafeActions.length <= pack.policy.briefingDailyCap) {
      readout.nextSafeActions.push(fillerAction);
    }
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.briefingCapBreachCount).toBeGreaterThan(0);
  });

  it("rejects a boundary case whose expectedOutcome is 'allowed' (B-gate breach)", () => {
    const pack = cloneFixture();
    const firstBoundary = pack.boundaryCases[0] as unknown as {
      expectedOutcome: string;
    };
    firstBoundary.expectedOutcome = "allowed";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.boundaryBreachCount).toBeGreaterThan(0);
  });

  it("rejects boundary count below minimum per gate (B-gate ≥3)", () => {
    const pack = cloneFixture();
    // Drop all but one B7 case; should fail the minimum.
    const cases = pack.boundaryCases as unknown as Array<{
      gate: string;
    }>;
    const compacted = cases.filter(
      (c, idx, all) =>
        c.gate !== "B7_thirty_day_reoriginate_cooldown" ||
        all.findIndex((x) => x.gate === c.gate) === idx,
    );
    (pack as unknown as { boundaryCases: unknown[] }).boundaryCases =
      compacted;
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("boundary_gates_under_minimum"),
      ),
    ).toBe(true);
  });

  it("rejects originate-mix out of tolerance (OQ-B 60/40 ±20pp)", () => {
    const pack = cloneFixture();
    // Force all helm-self signals to investigative — mix becomes 100/0.
    const signals = pack.runs[0].signals as unknown as Array<{
      originateKind: string;
    }>;
    for (const s of signals) s.originateKind = "investigative";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) => f.reason.includes("originate_mix_out_of_tolerance")),
    ).toBe(true);
  });

  it("rejects missing helm-self face coverage (§9.2 5 faces)", () => {
    const pack = cloneFixture();
    // Drop the production_stability signal entirely.
    const signals = pack.runs[0].signals as unknown as Array<{
      helmSelfFace?: string;
    }>;
    const filtered = signals.filter(
      (s) => s.helmSelfFace !== "production_stability",
    );
    (pack.runs[0] as unknown as { signals: unknown[] }).signals = filtered;
    // Audit + readout will inconsistency too, but face-missing should fire.
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) => f.reason.includes("helm_self_faces_missing")),
    ).toBe(true);
  });

  it("requires DecisionEscalation when route reason is R3 no_owner_escalate", () => {
    const pack = cloneFixture();
    // helm-self first signal currently has R3 + escalation; remove escalation.
    const signal = pack.runs[0].signals[0] as unknown as {
      escalation?: unknown;
    };
    delete signal.escalation;
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("R3_no_owner_must_produce_decision_escalation"),
      ),
    ).toBe(true);
  });

  it("rejects Q&A positive case that records a forbidden side effect (B8)", () => {
    const pack = cloneFixture();
    const qaCase = pack.qaPositiveCases[0] as unknown as {
      observedSideEffects: string[];
    };
    qaCase.observedSideEffects = ["originate"];
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(summary.incidents.qaSideEffectCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("qa_observed_forbidden_side_effects"),
      ),
    ).toBe(true);
  });

  it("rejects Q&A positive case whose expectedAnswerKind disagrees with expectedOutcome", () => {
    const pack = cloneFixture();
    const qaCase = pack.qaPositiveCases[0] as unknown as {
      expectedAnswerKind: string;
      expectedOutcome: string;
    };
    qaCase.expectedAnswerKind = "data_extract";
    qaCase.expectedOutcome = "refused";
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("qa_data_extract_must_be_answered_read_only"),
      ),
    ).toBe(true);
  });

  it("rejects empty qaPositiveCases (Phase 1.5 surface must be exercised)", () => {
    const pack = cloneFixture();
    (pack as unknown as { qaPositiveCases: unknown[] }).qaPositiveCases = [];
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("qa_positive_cases_missing_must_have_at_least_one"),
      ),
    ).toBe(true);
  });

  it("requires B8 to meet the per-gate minimum (≥3 cases)", () => {
    const pack = cloneFixture();
    const cases = pack.boundaryCases as unknown as Array<{ gate: string }>;
    // Drop all but one B8 case.
    const filtered = cases.filter(
      (c, idx, all) =>
        c.gate !== "B8_qa_no_side_effects" ||
        all.findIndex((x) => x.gate === c.gate) === idx,
    );
    (pack as unknown as { boundaryCases: unknown[] }).boundaryCases = filtered;
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("boundary_gates_under_minimum"),
      ),
    ).toBe(true);
  });

  it("requires ProductImprovementCandidate when Q4 answer is gap_present", () => {
    const pack = cloneFixture();
    const signal = pack.runs[0].signals[0] as unknown as {
      productImprovement?: unknown;
    };
    delete signal.productImprovement;
    const summary = runFounderOperatingLoopEval(pack);
    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((f) =>
        f.reason.includes("Q4_gap_present_must_produce_product_improvement"),
      ),
    ).toBe(true);
  });
});
