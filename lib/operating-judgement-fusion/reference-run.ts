// Operating Judgement Fusion v0.1 — reference held-out run.
//
// Composes the synthetic held-out corpus with a content-bound pre-registration and a valid
// run context, so `npm run eval:operating-judgement-fusion` can prove, end to end, that
// fusion beats the single-signal baseline under the real pre-registration + anti-cheat
// gates. Timestamps are fixed synthetic values (no time source) so the run is deterministic.

import {
  buildFusionPreRegistration,
  runFusionHeldoutEval,
  type FusionHeldoutReport,
} from "./eval";
import { SYNTHETIC_FUSION_HELDOUT_CASES } from "./fixtures";

export function runReferenceFusionHeldoutEval(): FusionHeldoutReport {
  const cases = SYNTHETIC_FUSION_HELDOUT_CASES;
  const preRegistration = buildFusionPreRegistration({
    cases,
    preRegistrationId: "ojf-v0.1-reference",
    goldLockedAt: "2026-06-01T00:00:00.000Z",
    goldLockedBy: "owner",
    previousExpertRevisionId: "ojf-baseline-0",
    deterministicRuleBaselineRef: "baseline:single-signal-pressure-pick",
    trustedTimestamp: "2026-06-10T00:00:00.000Z",
    maxAttemptsPerHeldoutSet: 1,
  });
  return runFusionHeldoutEval({
    cases,
    preRegistration,
    runInput: {
      evaluationRunId: "ojf-v0.1-run",
      candidateRevisionId: "ojf-v0.1",
      candidateRevisionCreatedAt: "2026-06-05T00:00:00.000Z",
      ranAt: "2026-06-11T00:00:00.000Z",
      attemptNumber: 1,
      bSetConsumedByRevisionIds: ["ojf-v0.1"],
    },
  });
}

export function referenceFusionEvalPassed(report: FusionHeldoutReport): boolean {
  return (
    report.decision === "fusion_beats_baseline" &&
    report.hardGateFailures.length === 0 &&
    report.preRegistrationValidation.ok &&
    report.runValidation.ok &&
    !report.calibration.overconfident
  );
}
