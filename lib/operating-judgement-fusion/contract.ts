// Operating Judgement Fusion v0.1 — public-safe contracts.
// Spec: docs/product/HELM_OPERATING_JUDGEMENT_FUSION.md (proposal)
//
// What this is: deterministic fusion of multiple governed, evidence-bound, already
// LINKED weak operating signals on the SAME business object into ONE advice-only
// operating judgement, carrying a calibratable confidence.
//
// Hard boundary (encoded in types + assertAdviceOnlyJudgement):
//   - advice-only: commitmentClass is always "advice", humanReviewerRequired always true.
//   - deterministic-only: confidence.method is fixed; LLM/neural ranking is never used.
//   - never self-promotes: promotionTriggered is the literal `false`.
//   - no execution / writeback / external send / memory promotion (no such refs).
// This is NOT an enterprise "world model"; it is single-object multi-signal fusion.
//
// Everything here is pure types + pure helpers. No DB, no network, no provider SDK,
// no prisma — so it stays inside Core SDK and the reverse-dependency boundary holds.

import { ACTION_DISPOSITION_PREFIXES, FORBIDDEN_REF_PATTERNS } from "../expert-capability/contracts";
import type { ExpertOutput } from "../expert-capability/contracts";
import type { ValidationResult } from "../expert-capability/validators";
import type {
  OperatingSignalFamily,
  OperatingSignalFlowEvent,
} from "../operating-signal-flow/contract";
import type {
  OperatingSignalSourceEnvelope,
  OperatingSignalUse,
} from "../operating-signal-governance/source-governance";

export const OPERATING_JUDGEMENT_SCHEMA_VERSION = "helm.operating-judgement-fusion.v1" as const;

// Reuse the 6 business-object kinds the signal flow already defines. A judgement is
// always about ONE concrete object, so (unlike the event contract) null is not allowed.
export const OPERATING_JUDGEMENT_OBJECT_KINDS = [
  "Deal",
  "Account",
  "Contact",
  "Meeting",
  "Commitment",
  "Workspace",
] as const;

export type OperatingJudgementObjectKind = (typeof OPERATING_JUDGEMENT_OBJECT_KINDS)[number];

const OBJECT_KIND_SET: ReadonlySet<string> = new Set(OPERATING_JUDGEMENT_OBJECT_KINDS);

// Confidence band reused verbatim from the signal-flow event contract.
export type OperatingJudgementConfidenceBand = OperatingSignalFlowEvent["confidenceBand"];

export const OPERATING_JUDGEMENT_CONFIDENCE_BANDS = [
  "high",
  "medium",
  "low",
  "mixed",
  "unknown",
] as const satisfies readonly OperatingJudgementConfidenceBand[];

const CONFIDENCE_BAND_SET: ReadonlySet<string> = new Set(OPERATING_JUDGEMENT_CONFIDENCE_BANDS);

// Deterministic-only confidence. `score` is a 0..1 number so calibration (ECE / Brier /
// reliability) can be computed downstream; `method` is fixed and excludes llm_ranking.
export type OperatingJudgementConfidence = {
  band: OperatingJudgementConfidenceBand;
  score: number;
  method: "deterministic_evidence_family_fusion";
};

export type OperatingJudgementRuleTraceEntry = {
  ruleId: string;
  effect: string;
};

// One fused operating judgement over multiple weak signals on the same object.
// Field layout is a superset of ExpertOutput (see toExpertOutput) so the existing
// expert-capability held-out harness can evaluate a judgement as a `candidate`.
export type OperatingJudgement = {
  schemaVersion: typeof OPERATING_JUDGEMENT_SCHEMA_VERSION;
  judgementId: string;
  objectRef: string;
  objectKind: OperatingJudgementObjectKind;
  disposition: string;
  headline: string;
  commitmentClass: "advice";
  fusedSignalKeys: string[];
  contributingFamilies: OperatingSignalFamily[];
  evidenceRefs: string[];
  evidenceCoverage: { provided: number; required: number };
  confidence: OperatingJudgementConfidence;
  conflictFlags: string[];
  ruleTrace: OperatingJudgementRuleTraceEntry[];
  humanReviewerRequired: true;
  forbiddenActionRefs: string[];
  boundaryNote: string;
  promotionTriggered: false;
};

// Per-signal fusion input: the governed signal event + its source-governance envelope.
// The envelope is mandatory so the engine can run the source-class gate BEFORE fusion.
export type JudgementFusionSignal = {
  event: OperatingSignalFlowEvent;
  source: OperatingSignalSourceEnvelope;
};

export type JudgementFusionInput = {
  schemaVersion: typeof OPERATING_JUDGEMENT_SCHEMA_VERSION;
  objectRef: string;
  objectKind: OperatingJudgementObjectKind;
  signals: JudgementFusionSignal[];
  // Why the fused judgement is being produced. Gates differ: an advice use admits more
  // source classes than an eval/improvement use (which rejects fleet/oss outright).
  intendedUse: OperatingSignalUse;
};

export type JudgementFusionExcludedSignal = {
  signalKey: string;
  reason: string;
};

export type JudgementFusionResult = {
  ok: boolean;
  // null whenever the source-class gate rejects an input or no admissible signal remains.
  judgement: OperatingJudgement | null;
  gate: ValidationResult;
  blockers: string[];
  admittedSignalKeys: string[];
  excludedSignalKeys: JudgementFusionExcludedSignal[];
};

export function isOperatingJudgementObjectKind(
  value: unknown,
): value is OperatingJudgementObjectKind {
  return typeof value === "string" && OBJECT_KIND_SET.has(value);
}

// Fail-closed boundary check for a fused judgement. Reuses the expert-capability
// forbidden-ref patterns and action-disposition prefixes so the advice-only / no-execute
// boundary is enforced identically across the two loops.
export function assertAdviceOnlyJudgement(judgement: OperatingJudgement): ValidationResult {
  const errors: string[] = [];

  if (judgement.schemaVersion !== OPERATING_JUDGEMENT_SCHEMA_VERSION) {
    errors.push("invalid_schema_version");
  }
  if (!judgement.judgementId.trim()) errors.push("missing_judgement_id");
  if (!judgement.objectRef.trim()) errors.push("missing_object_ref");
  if (!isOperatingJudgementObjectKind(judgement.objectKind)) errors.push("invalid_object_kind");
  if (judgement.commitmentClass !== "advice") errors.push("non_advice_commitment_class");
  if (judgement.humanReviewerRequired !== true) errors.push("human_reviewer_not_required");
  // `as` guards against a caller that widened the literal type before runtime.
  if ((judgement.promotionTriggered as boolean) !== false) errors.push("promotion_triggered_present");
  if (judgement.forbiddenActionRefs.length > 0) errors.push("forbidden_action_refs_present");
  if (!judgement.boundaryNote.trim()) errors.push("missing_boundary_note");

  if (judgement.evidenceRefs.some((ref) => FORBIDDEN_REF_PATTERNS.some((re) => re.test(ref)))) {
    errors.push("write_send_execute_ref_present");
  }
  if (ACTION_DISPOSITION_PREFIXES.some((prefix) => judgement.disposition.startsWith(prefix))) {
    errors.push("action_disposition_present");
  }

  const { band, score, method } = judgement.confidence;
  if (method !== "deterministic_evidence_family_fusion") errors.push("non_deterministic_confidence_method");
  if (!CONFIDENCE_BAND_SET.has(band)) errors.push("invalid_confidence_band");
  if (typeof score !== "number" || Number.isNaN(score) || score < 0 || score > 1) {
    errors.push("confidence_score_out_of_range");
  }

  const coverage = judgement.evidenceCoverage;
  if (
    !coverage ||
    typeof coverage.provided !== "number" ||
    typeof coverage.required !== "number" ||
    coverage.provided < 0 ||
    coverage.required < 0
  ) {
    errors.push("invalid_evidence_coverage");
  }

  return { ok: errors.length === 0, errors };
}

// Map a fused judgement onto the expert-capability ExpertOutput packet shape so the
// existing held-out evaluator can treat fusion output as a `candidate` against the
// single-signal `ruleBaseline`. Lossy by design: only the advice-packet fields cross over.
export function toExpertOutput(judgement: OperatingJudgement): ExpertOutput {
  return {
    expertRevisionId: judgement.judgementId,
    disposition: judgement.disposition,
    evidenceRefs: [...judgement.evidenceRefs],
    commitmentClass: judgement.commitmentClass,
    boundaryNote: judgement.boundaryNote,
    humanReviewerRequired: judgement.humanReviewerRequired,
    forbiddenActionRefs: [...judgement.forbiddenActionRefs],
  };
}
