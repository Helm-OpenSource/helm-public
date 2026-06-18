// Operating Judgement Fusion v0.1 — held-out evaluation harness.
//
// Proves "fusion makes the judgement more accurate", not "the pipeline runs". For each
// held-out case it produces the fused judgement (candidate) AND the single-signal
// pressure-pick (ruleBaseline), scores both against locked gold, and reports the lift.
//
// Pre-registration is CONTENT-BOUND: the fusion cases are mapped into an expert-capability
// B/A set and run through the real validatePreRegistration — declared A/B/gold/replay/
// content hashes must equal hashes recomputed from the actual cases, the metric weights
// must sum to 1 with a positive margin, and B must contain a synthetic + boundary-trap
// case. A run cannot pass with placeholder hashes, illegal weights, or gold reshaped after
// the candidate ruleset existed. validateEvaluationRun adds the run-level anti-cheat (a
// hard-gate failure cannot be masked by a passing score; an expert-vs-rules tie is not a
// pass). Calibration (ECE/Brier) and evidence-completeness correlation come from
// ./calibration.
//
// Pure functions. No IO, no model.

import type {
  ASet,
  BSet,
  ExpertOutput,
  MetricDefinition,
  PreRegistration,
  RunInput,
} from "../expert-capability/contracts";
import {
  computeASetHash,
  computeBSetHash,
  computeGoldLabelsHash,
  computePreRegistrationContentHash,
  computeReplaySnapshotHashes,
  computeReplaySnapshotRootHash,
} from "../expert-capability/hashing";
import { validateEvaluationRun, validatePreRegistration } from "../expert-capability/validators";
import type { ValidationResult } from "../expert-capability/validators";
import {
  computeCalibration,
  pearsonCorrelation,
  type CalibrationReport,
} from "./calibration";
import { toExpertOutput, type JudgementFusionInput } from "./contract";
import { fuseOperatingSignals, singleSignalBaseline } from "./fuse";

export type FusionHeldoutCase = {
  caseId: string;
  // Case kind, mapped onto the expert-capability B-set; the set must include
  // "synthetic_non_self_org" and "boundary_trap" kinds to be a meaningful held-out proof.
  kind: string;
  input: JudgementFusionInput;
  // Ground truth: a locked expert gold disposition or the recorded operating outcome.
  goldDisposition: string;
};

export type FusionPerCaseResult = {
  caseId: string;
  gateOk: boolean;
  fusionDisposition: string | null;
  baselineDisposition: string | null;
  gold: string;
  fusionCorrect: boolean;
  baselineCorrect: boolean;
  confidenceScore: number;
  evidenceCompleteness: number;
};

export type FusionHeldoutDecision =
  | "fusion_beats_baseline"
  | "inconclusive"
  | "fusion_not_better";

export type FusionHeldoutReport = {
  caseCount: number;
  scoredCaseCount: number;
  fusionAccuracy: number;
  baselineAccuracy: number;
  lift: number;
  calibration: CalibrationReport;
  evidenceCompletenessCorrelation: number;
  hardGateFailures: string[];
  preRegistrationValidation: ValidationResult;
  runValidation: ValidationResult;
  decision: FusionHeldoutDecision;
  perCase: FusionPerCaseResult[];
};

const BLOCKED_ADVICE_OUTPUT: ExpertOutput = {
  expertRevisionId: "blocked",
  disposition: "no_action_watch",
  evidenceRefs: [],
  commitmentClass: "advice",
  boundaryNote: "Blocked by the source-class gate; no judgement produced.",
  humanReviewerRequired: true,
  forbiddenActionRefs: [],
};

function aggregateCompleteness(input: JudgementFusionInput): number {
  let provided = 0;
  let required = 0;
  for (const signal of input.signals) {
    provided += Math.max(0, signal.event.evidenceCoverage.provided);
    required += Math.max(0, signal.event.evidenceCoverage.required);
  }
  if (required <= 0) return provided > 0 ? 1 : 0;
  return Math.min(1, provided / required);
}

// Map fusion cases onto expert-capability A/B sets so the existing content-binding +
// metric validators apply verbatim. Deterministic: recomputing from the same cases yields
// the same hashes, so a declared hash binds the actual gold + inputs.
export function buildFusionHeldoutSets(
  cases: readonly FusionHeldoutCase[],
  goldLockedAt: string,
): { aSet: ASet; bSet: BSet } {
  const bCases = cases.map((heldout) => {
    const fusion = fuseOperatingSignals(heldout.input);
    const baseline = singleSignalBaseline(heldout.input);
    const candidate = fusion.judgement ? toExpertOutput(fusion.judgement) : BLOCKED_ADVICE_OUTPUT;
    const ruleBaseline = baseline.judgement
      ? toExpertOutput(baseline.judgement)
      : BLOCKED_ADVICE_OUTPUT;
    return {
      caseId: heldout.caseId,
      kind: heldout.kind,
      inputSnapshotRef: `snapshot:${heldout.caseId}`,
      gold: {
        disposition: heldout.goldDisposition,
        relevantEvidence: [],
        availableEvidence: [],
        boundaryExpectation: "advice_only_human_review",
      },
      outputs: { candidate, previous: ruleBaseline, ruleBaseline },
    };
  });

  const bSet: BSet = {
    setId: "fusion-bset",
    setHash: "",
    goldLabelsHash: "",
    goldLockedAt,
    cases: bCases,
  };
  bSet.setHash = computeBSetHash(bSet);
  bSet.goldLabelsHash = computeGoldLabelsHash(bSet);

  const aSet: ASet = { setId: "fusion-aset-empty", setHash: computeASetHash({ setId: "", setHash: "", cases: [] }), cases: [] };
  return { aSet, bSet };
}

// Build a content-bound pre-registration from the actual cases. Hashes are derived from
// the cases, so a later edit to any gold/input breaks the binding. The metric defaults to
// a falsifiable definition (weights sum to 1, positive margin).
export function buildFusionPreRegistration(options: {
  cases: readonly FusionHeldoutCase[];
  preRegistrationId: string;
  goldLockedAt: string;
  goldLockedBy: string;
  previousExpertRevisionId: string;
  deterministicRuleBaselineRef: string;
  trustedTimestamp: string;
  maxAttemptsPerHeldoutSet: number;
  metricDefinition?: MetricDefinition;
}): PreRegistration {
  const { aSet, bSet } = buildFusionHeldoutSets(options.cases, options.goldLockedAt);
  const replaySnapshotHashes = computeReplaySnapshotHashes(bSet);
  const base: PreRegistration = {
    preRegistrationId: options.preRegistrationId,
    aCorrectionSetHash: computeASetHash(aSet),
    bHeldoutSetHash: computeBSetHash(bSet),
    goldLabelsHash: computeGoldLabelsHash(bSet),
    goldLockedAt: options.goldLockedAt,
    goldLockedBy: options.goldLockedBy,
    metricDefinition: options.metricDefinition ?? { w1: 0.5, w2: 0.5, minMargin: 0.1 },
    previousExpertRevisionId: options.previousExpertRevisionId,
    deterministicRuleBaselineRef: options.deterministicRuleBaselineRef,
    replaySnapshotRootHash: computeReplaySnapshotRootHash(replaySnapshotHashes),
    replaySnapshotHashes,
    maxAttemptsPerHeldoutSet: options.maxAttemptsPerHeldoutSet,
    trustedTimestamp: options.trustedTimestamp,
    contentHash: "",
  };
  return { ...base, contentHash: computePreRegistrationContentHash(base) };
}

export function runFusionHeldoutEval(input: {
  cases: readonly FusionHeldoutCase[];
  preRegistration: PreRegistration;
  runInput: RunInput;
}): FusionHeldoutReport {
  const { cases, preRegistration, runInput } = input;
  const perCase: FusionPerCaseResult[] = [];
  const hardGateFailures: string[] = [];

  // Content-bound pre-registration: rebuild the sets from the actual cases and run the
  // real validator (hash/metric/composition/ordering). A placeholder hash, an illegal
  // weight, a missing boundary-trap kind, or gold reshaped after the candidate all fail.
  const { aSet, bSet } = buildFusionHeldoutSets(cases, preRegistration.goldLockedAt);
  const preRegistrationValidation = validatePreRegistration({
    preRegistration,
    runInput,
    aSet,
    bSet,
  });
  if (Date.parse(preRegistration.goldLockedAt) >= Date.parse(runInput.candidateRevisionCreatedAt)) {
    hardGateFailures.push("gold_locked_after_candidate");
  }

  let fusionCorrectCount = 0;
  let baselineCorrectCount = 0;
  let scoredCaseCount = 0;

  for (const heldout of cases) {
    const fusion = fuseOperatingSignals(heldout.input);
    const baseline = singleSignalBaseline(heldout.input);
    const gateOk = fusion.gate.ok;
    if (!gateOk) {
      hardGateFailures.push(`source_class_gate_failed:${heldout.caseId}`);
    }

    const fusionDisposition = fusion.judgement?.disposition ?? null;
    const baselineDisposition = baseline.judgement?.disposition ?? null;
    const fusionCorrect = fusionDisposition === heldout.goldDisposition;
    const baselineCorrect = baselineDisposition === heldout.goldDisposition;
    const confidenceScore = fusion.judgement?.confidence.score ?? 0;
    const evidenceCompleteness = aggregateCompleteness(heldout.input);

    if (fusion.judgement) {
      scoredCaseCount += 1;
      if (fusionCorrect) fusionCorrectCount += 1;
      if (baselineCorrect) baselineCorrectCount += 1;
    }

    perCase.push({
      caseId: heldout.caseId,
      gateOk,
      fusionDisposition,
      baselineDisposition,
      gold: heldout.goldDisposition,
      fusionCorrect,
      baselineCorrect,
      confidenceScore,
      evidenceCompleteness,
    });
  }

  const fusionAccuracy = scoredCaseCount > 0 ? fusionCorrectCount / scoredCaseCount : 0;
  const baselineAccuracy = scoredCaseCount > 0 ? baselineCorrectCount / scoredCaseCount : 0;
  const lift = fusionAccuracy - baselineAccuracy;

  const scored = perCase.filter((entry) => entry.fusionDisposition !== null);
  const calibration = computeCalibration(
    scored.map((entry) => ({ predicted: entry.confidenceScore, correct: entry.fusionCorrect })),
  );
  const evidenceCompletenessCorrelation = pearsonCorrelation(
    scored.map((entry) => entry.evidenceCompleteness),
    scored.map((entry) => (entry.fusionCorrect ? 1 : 0)),
  );

  const meetsMargin =
    lift >= preRegistration.metricDefinition.minMargin && fusionAccuracy > baselineAccuracy;
  const provisionalDecision: FusionHeldoutDecision = meetsMargin
    ? "fusion_beats_baseline"
    : lift <= 0
      ? "fusion_not_better"
      : "inconclusive";

  const runValidation = validateEvaluationRun({
    preRegistration,
    runInput,
    candidateWeighted: fusionAccuracy,
    ruleBaselineWeighted: baselineAccuracy,
    boundaryCorrectness:
      perCase.length > 0 ? perCase.filter((entry) => entry.gateOk).length / perCase.length : 0,
    loopCompoundingDecision:
      provisionalDecision === "fusion_beats_baseline"
        ? "success"
        : provisionalDecision === "fusion_not_better"
          ? "fail"
          : "inconclusive",
    expertJustifiedDecision:
      fusionAccuracy > baselineAccuracy
        ? "pass"
        : fusionAccuracy === baselineAccuracy
          ? "inconclusive(expert_vs_rules)"
          : "fail",
    hardGateFailures,
  });

  // Fail closed: a poisoned set, an overconfident model, an unbound/tampered
  // pre-registration, or a failing run gate downgrades the verdict even if raw lift looked
  // positive.
  const decision: FusionHeldoutDecision =
    provisionalDecision === "fusion_beats_baseline" &&
    hardGateFailures.length === 0 &&
    !calibration.overconfident &&
    preRegistrationValidation.ok &&
    runValidation.ok
      ? "fusion_beats_baseline"
      : provisionalDecision === "fusion_not_better"
        ? "fusion_not_better"
        : "inconclusive";

  return {
    caseCount: cases.length,
    scoredCaseCount,
    fusionAccuracy,
    baselineAccuracy,
    lift,
    calibration,
    evidenceCompletenessCorrelation,
    hardGateFailures,
    preRegistrationValidation,
    runValidation,
    decision,
    perCase,
  };
}
