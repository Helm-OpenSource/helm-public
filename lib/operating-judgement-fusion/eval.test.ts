import { describe, expect, it } from "vitest";

import type { MetricDefinition, RunInput } from "../expert-capability/contracts";
import { buildFusionPreRegistration, runFusionHeldoutEval, type FusionHeldoutCase } from "./eval";
import {
  POISONED_HELDOUT_CASE,
  SYNTHETIC_FUSION_HELDOUT_CASES,
} from "./fixtures";

function standardPreReg(
  cases: readonly FusionHeldoutCase[],
  overrides: { goldLockedAt?: string; metricDefinition?: MetricDefinition } = {},
) {
  return buildFusionPreRegistration({
    cases,
    preRegistrationId: "prereg-1",
    goldLockedAt: overrides.goldLockedAt ?? "2026-06-01T00:00:00.000Z",
    goldLockedBy: "owner",
    previousExpertRevisionId: "rev-0",
    deterministicRuleBaselineRef: "baseline:single-signal-pressure-pick",
    trustedTimestamp: "2026-06-10T00:00:00.000Z",
    maxAttemptsPerHeldoutSet: 1,
    metricDefinition: overrides.metricDefinition,
  });
}

function standardRun(overrides: Partial<RunInput> = {}): RunInput {
  return {
    evaluationRunId: "run-1",
    candidateRevisionId: "rev-1",
    candidateRevisionCreatedAt: "2026-06-05T00:00:00.000Z",
    ranAt: "2026-06-11T00:00:00.000Z",
    attemptNumber: 1,
    bSetConsumedByRevisionIds: ["rev-1"],
    ...overrides,
  };
}

describe("runFusionHeldoutEval", () => {
  it("proves fusion beats the single-signal baseline under a content-bound pre-registration", () => {
    const report = runFusionHeldoutEval({
      cases: SYNTHETIC_FUSION_HELDOUT_CASES,
      preRegistration: standardPreReg(SYNTHETIC_FUSION_HELDOUT_CASES),
      runInput: standardRun(),
    });

    expect(report.preRegistrationValidation).toEqual({ ok: true, errors: [] });
    expect(report.runValidation.ok).toBe(true);
    expect(report.scoredCaseCount).toBe(6);
    expect(report.fusionAccuracy).toBe(1);
    expect(report.baselineAccuracy).toBeCloseTo(0.6667, 3);
    expect(report.lift).toBeGreaterThanOrEqual(report.preRegistrationValidation.ok ? 0.1 : 0);
    expect(report.hardGateFailures).toEqual([]);
    expect(report.calibration.overconfident).toBe(false);
    expect(report.decision).toBe("fusion_beats_baseline");
  });

  it("fails closed when declared gold no longer matches the actual cases (post-hoc reshaping)", () => {
    const tamperedCases = SYNTHETIC_FUSION_HELDOUT_CASES.map((c, i) =>
      i === 0 ? { ...c, goldDisposition: "draft_next_action" } : c,
    );
    const report = runFusionHeldoutEval({
      cases: tamperedCases,
      // pre-registration was locked against the ORIGINAL cases.
      preRegistration: standardPreReg(SYNTHETIC_FUSION_HELDOUT_CASES),
      runInput: standardRun(),
    });

    expect(report.preRegistrationValidation.ok).toBe(false);
    expect(report.preRegistrationValidation.errors).toContain("gold_labels_hash_mismatch");
    expect(report.decision).not.toBe("fusion_beats_baseline");
  });

  it("rejects an unfalsifiable metric definition (weights must sum to 1)", () => {
    const report = runFusionHeldoutEval({
      cases: SYNTHETIC_FUSION_HELDOUT_CASES,
      preRegistration: standardPreReg(SYNTHETIC_FUSION_HELDOUT_CASES, {
        metricDefinition: { w1: 1, w2: 1, minMargin: 0.1 },
      }),
      runInput: standardRun(),
    });

    expect(report.preRegistrationValidation.ok).toBe(false);
    expect(report.preRegistrationValidation.errors).toContain("weights_do_not_sum_to_one");
    expect(report.decision).not.toBe("fusion_beats_baseline");
  });

  it("requires a boundary-trap case in the held-out set", () => {
    const noBoundary = SYNTHETIC_FUSION_HELDOUT_CASES.filter((c) => c.kind !== "boundary_trap");
    const report = runFusionHeldoutEval({
      cases: noBoundary,
      preRegistration: standardPreReg(noBoundary),
      runInput: standardRun(),
    });

    expect(report.preRegistrationValidation.ok).toBe(false);
    expect(report.preRegistrationValidation.errors).toContain("b_set_missing_boundary_trap");
    expect(report.decision).not.toBe("fusion_beats_baseline");
  });

  it("vetoes the run when the held-out set is poisoned with a forbidden source class", () => {
    const cases = [...SYNTHETIC_FUSION_HELDOUT_CASES, POISONED_HELDOUT_CASE];
    const report = runFusionHeldoutEval({
      cases,
      preRegistration: standardPreReg(cases),
      runInput: standardRun(),
    });

    expect(report.hardGateFailures).toContain("source_class_gate_failed:poisoned-fleet");
    expect(report.runValidation.ok).toBe(false);
    expect(report.decision).not.toBe("fusion_beats_baseline");
  });

  it("fails closed when gold was locked after the candidate ruleset (leakage)", () => {
    const report = runFusionHeldoutEval({
      cases: SYNTHETIC_FUSION_HELDOUT_CASES,
      preRegistration: standardPreReg(SYNTHETIC_FUSION_HELDOUT_CASES, {
        goldLockedAt: "2026-06-09T00:00:00.000Z",
      }),
      runInput: standardRun({ candidateRevisionCreatedAt: "2026-06-05T00:00:00.000Z" }),
    });

    expect(report.hardGateFailures).toContain("gold_locked_after_candidate");
    expect(report.decision).not.toBe("fusion_beats_baseline");
  });

  it("fails closed when the attempt budget is exceeded", () => {
    const report = runFusionHeldoutEval({
      cases: SYNTHETIC_FUSION_HELDOUT_CASES,
      preRegistration: standardPreReg(SYNTHETIC_FUSION_HELDOUT_CASES),
      runInput: standardRun({ attemptNumber: 2 }),
    });

    expect(report.runValidation.ok).toBe(false);
    expect(report.runValidation.errors).toContain("attempt_budget_exceeded");
    expect(report.decision).not.toBe("fusion_beats_baseline");
  });
});
