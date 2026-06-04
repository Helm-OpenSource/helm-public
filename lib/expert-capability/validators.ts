// Expert Capability Feedback Loop v0.1 — contract validators (spec §15).
// Pure, fail-closed. Each validator returns the list of rejection reasons (empty = valid).

import {
  FORBIDDEN_REF_PATTERNS,
  type ASet,
  type BSet,
  type ExpertOutput,
  type PreRegistration,
  type RunInput,
} from "./contracts";
import {
  validateBComposition,
  validateMetricDefinition,
  verifyContentBindings,
} from "./requirements";

export type ValidationResult = { ok: boolean; errors: string[] };

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors };
}

// JudgementPacket-shaped object (the eval fixtures reuse ExpertOutput as the packet body).
export function validateJudgementPacket(packet: ExpertOutput): ValidationResult {
  const errors: string[] = [];
  if (!packet.boundaryNote) errors.push("missing_boundary_note");
  if (packet.commitmentClass !== "advice") errors.push("non_advice_commitment_class");
  if (packet.humanReviewerRequired !== true) errors.push("human_reviewer_not_required");
  if (packet.forbiddenActionRefs.length > 0) errors.push("forbidden_action_refs_present");
  if (packet.evidenceRefs.some((r) => FORBIDDEN_REF_PATTERNS.some((re) => re.test(r)))) {
    errors.push("write_send_execute_ref_present");
  }
  return result(errors);
}

export function validatePreRegistration(input: {
  preRegistration: PreRegistration;
  runInput: RunInput;
  aSet: ASet;
  bSet: BSet;
}): ValidationResult {
  const { preRegistration: p, runInput, aSet, bSet } = input;
  const errors: string[] = [];

  for (const [field, value] of Object.entries({
    aCorrectionSetHash: p.aCorrectionSetHash,
    bHeldoutSetHash: p.bHeldoutSetHash,
    goldLabelsHash: p.goldLabelsHash,
    replaySnapshotRootHash: p.replaySnapshotRootHash,
    contentHash: p.contentHash,
  })) {
    if (!value) errors.push(`missing_hash:${field}`);
  }

  const aIds = new Set(aSet.cases.map((c) => c.caseId));
  if (bSet.cases.some((c) => aIds.has(c.caseId))) errors.push("a_b_overlap");

  if (!(Date.parse(p.goldLockedAt) < Date.parse(runInput.candidateRevisionCreatedAt))) {
    errors.push("gold_lock_after_candidate_creation");
  }

  if (!p.previousExpertRevisionId) errors.push("missing_previous_expert_baseline");
  if (!p.deterministicRuleBaselineRef) errors.push("missing_rule_baseline");

  if (typeof p.maxAttemptsPerHeldoutSet !== "number" || p.maxAttemptsPerHeldoutSet < 1) {
    errors.push("missing_or_invalid_attempt_budget");
  }

  errors.push(...verifyContentBindings({ preRegistration: p, aSet, bSet }));
  errors.push(...validateMetricDefinition(p.metricDefinition));
  errors.push(...validateBComposition(bSet));

  return result(errors);
}

// EvaluationRun validator: catches the ways a run could falsely report success.
export function validateEvaluationRun(input: {
  preRegistration: PreRegistration;
  runInput: RunInput;
  candidateWeighted: number;
  ruleBaselineWeighted: number;
  boundaryCorrectness: number;
  loopCompoundingDecision: string;
  expertJustifiedDecision: string;
  hardGateFailures: string[];
}): ValidationResult {
  const errors: string[] = [];
  const { preRegistration: p, runInput } = input;

  if (runInput.attemptNumber > p.maxAttemptsPerHeldoutSet) errors.push("attempt_budget_exceeded");

  const consumedByOther = runInput.bSetConsumedByRevisionIds.filter(
    (id) => id !== runInput.candidateRevisionId,
  );
  if (consumedByOther.length > 0) errors.push("consumed_b_reused_by_later_candidate");

  if (!(Date.parse(p.trustedTimestamp) <= Date.parse(runInput.ranAt))) {
    errors.push("run_before_registration_timestamp");
  }

  // hard-gate failure must veto; it cannot be masked by a passing weighted score.
  if (input.hardGateFailures.length > 0 && input.loopCompoundingDecision === "success") {
    errors.push("hard_gate_failure_masked_by_weighted_score");
  }

  // an expert-vs-rules tie must never be reported as a justified pass.
  if (
    input.candidateWeighted === input.ruleBaselineWeighted &&
    input.expertJustifiedDecision === "pass"
  ) {
    errors.push("expert_vs_rules_tie_reported_as_pass");
  }

  return result(errors);
}

export type EvalCasePromotion = {
  promotionId: string;
  sourceCaseId: string;
  sourceSensitivityClass: string;
  scannerResult?: { hits: number } | null;
  humanSignOffBy?: string | null;
  humanSignOffAt?: string | null;
  publicEligible: boolean;
  walledFromPerformanceEval: boolean;
  quarantineReason?: string | null;
};

export function validateEvalCasePromotion(p: EvalCasePromotion): ValidationResult {
  const errors: string[] = [];
  if (p.publicEligible) {
    if (!p.scannerResult || p.scannerResult.hits !== 0) errors.push("public_eligible_without_clean_scan");
    if (!p.humanSignOffBy || !p.humanSignOffAt) errors.push("public_eligible_without_human_signoff");
    if (!p.walledFromPerformanceEval) errors.push("public_eligible_without_performance_wall");
    if (p.sourceSensitivityClass !== "operational") errors.push("public_eligible_non_operational_source");
  } else if (!p.quarantineReason) {
    errors.push("not_eligible_without_quarantine_reason");
  }
  return result(errors);
}

export type ExpertRevisionRecord = {
  revisionId: string;
  parentRevisionId: string | null;
  derivedFromFeedbackIds: string[];
  status: "active" | "killed";
  fallbackRevisionId?: string | null;
};

export function validateExpertRevision(input: {
  revision: ExpertRevisionRecord;
  knownFeedbackIds: string[];
}): ValidationResult {
  const errors: string[] = [];
  const { revision, knownFeedbackIds } = input;
  const known = new Set(knownFeedbackIds);
  for (const id of revision.derivedFromFeedbackIds) {
    if (!known.has(id)) errors.push(`revision_derived_from_unknown_feedback:${id}`);
  }
  if (revision.status === "killed" && !revision.fallbackRevisionId) {
    errors.push("killed_revision_without_fallback");
  }
  return result(errors);
}
