// Operating Judgement Fusion v0.1 — public-safe owner-review readout.
//
// Turns a fused judgement (+ optional held-out verdict) into an owner-review readout that
// is safe to render outside the raw runtime: only aggregates cross over. It NEVER echoes
// the raw objectRef or raw evidenceRefs (those are "object ids" in the forbidden-field
// families); the caller supplies an already-redacted object alias. Adoption guards are all
// the literal `false`, promotionTriggered is the literal `false`, and review is always
// required — this surface PRODUCES owner-review evidence, it does not promote anything.
//
// Pure functions. No IO, no model, no time source.

import { FORBIDDEN_REF_PATTERNS } from "../expert-capability/contracts";
import type { ValidationResult } from "../expert-capability/validators";
import {
  assertAdviceOnlyJudgement,
  type OperatingJudgement,
  type OperatingJudgementConfidenceBand,
  type OperatingJudgementObjectKind,
} from "./contract";
import type { FusionHeldoutDecision } from "./eval";

// Field families that must never appear in the public-safe readout (superset of the
// operating-signal-flow shadow-readout list, plus fusion-specific raw refs).
export const JUDGEMENT_READOUT_FORBIDDEN_FIELD_FAMILIES = [
  "raw object refs",
  "raw evidence refs",
  "raw trace ids",
  "actor names or emails",
  "source pages",
  "object ids",
  "rich action descriptions",
  "official-system payloads",
  "external-send targets",
] as const;

export type OperatingJudgementReadoutAdoptionGuards = {
  readonly routePageAdoptionAllowed: false;
  readonly productionQueryDefaultAllowed: false;
  readonly schemaOrApiChangeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecuteAllowed: false;
  readonly externalSendAllowed: false;
  readonly fixtureBannerRemovalAllowed: false;
  readonly llmFinalRankingAllowed: false;
};

export type OperatingJudgementReadoutEvalSummary = {
  readonly decision: FusionHeldoutDecision;
  readonly lift: number;
  readonly fusionAccuracy: number;
  readonly baselineAccuracy: number;
  readonly brierScore: number;
  readonly expectedCalibrationError: number;
  readonly overconfident: boolean;
};

export type OperatingJudgementReadout = {
  readonly schemaVersion: "helm.operating-judgement-fusion.readout.v1";
  readonly objectKind: OperatingJudgementObjectKind;
  readonly objectAlias: string;
  readonly headline: string;
  readonly disposition: string;
  readonly confidence: {
    readonly band: OperatingJudgementConfidenceBand;
    readonly score: number;
    readonly method: "deterministic_evidence_family_fusion";
  };
  readonly contributingFamilies: readonly string[];
  readonly conflictFlags: readonly string[];
  readonly evidence: {
    readonly coverageProvided: number;
    readonly coverageRequired: number;
    readonly refCount: number;
    readonly complete: boolean;
  };
  readonly fusedSignalCount: number;
  readonly ruleTraceSummary: readonly string[];
  readonly evalSummary: OperatingJudgementReadoutEvalSummary | null;
  readonly boundaryNote: string;
  readonly allowedFieldFamilies: readonly string[];
  readonly forbiddenFieldFamilies: readonly string[];
  readonly adoptionGuards: OperatingJudgementReadoutAdoptionGuards;
  readonly humanReviewerRequired: true;
  readonly nextReviewRequired: true;
  readonly producesOwnerReviewEvidenceOnly: true;
  readonly promotionTriggered: false;
};

const ALLOWED_FIELD_FAMILIES = [
  "objectKind",
  "disposition",
  "confidence",
  "families",
  "conflict",
  "evidenceAggregate",
  "ruleTrace",
  "eval",
] as const;

const ADOPTION_GUARDS: OperatingJudgementReadoutAdoptionGuards = {
  routePageAdoptionAllowed: false,
  productionQueryDefaultAllowed: false,
  schemaOrApiChangeAllowed: false,
  officialWriteAllowed: false,
  autoExecuteAllowed: false,
  externalSendAllowed: false,
  fixtureBannerRemovalAllowed: false,
  llmFinalRankingAllowed: false,
};

// Build a public-safe readout. Returns null (fail closed) if the judgement is not a valid
// advice-only judgement — a readout must never be produced from an unsafe judgement.
export function buildOperatingJudgementReadout(
  judgement: OperatingJudgement,
  options: {
    objectAlias: string;
    evalSummary?: OperatingJudgementReadoutEvalSummary | null;
  },
): OperatingJudgementReadout | null {
  if (!assertAdviceOnlyJudgement(judgement).ok) return null;

  return {
    schemaVersion: "helm.operating-judgement-fusion.readout.v1",
    objectKind: judgement.objectKind,
    objectAlias: options.objectAlias,
    headline: judgement.headline,
    disposition: judgement.disposition,
    confidence: {
      band: judgement.confidence.band,
      score: judgement.confidence.score,
      method: judgement.confidence.method,
    },
    contributingFamilies: [...judgement.contributingFamilies],
    conflictFlags: [...judgement.conflictFlags],
    evidence: {
      coverageProvided: judgement.evidenceCoverage.provided,
      coverageRequired: judgement.evidenceCoverage.required,
      refCount: judgement.evidenceRefs.length,
      complete: judgement.evidenceCoverage.provided >= judgement.evidenceCoverage.required,
    },
    fusedSignalCount: judgement.fusedSignalKeys.length,
    ruleTraceSummary: judgement.ruleTrace.map((entry) => `${entry.ruleId}: ${entry.effect}`),
    evalSummary: options.evalSummary ?? null,
    boundaryNote: judgement.boundaryNote,
    allowedFieldFamilies: [...ALLOWED_FIELD_FAMILIES],
    forbiddenFieldFamilies: [...JUDGEMENT_READOUT_FORBIDDEN_FIELD_FAMILIES],
    adoptionGuards: ADOPTION_GUARDS,
    humanReviewerRequired: true,
    nextReviewRequired: true,
    producesOwnerReviewEvidenceOnly: true,
    promotionTriggered: false,
  };
}

const RAW_OBJECT_REF_PATTERN = /^(Deal|Account|Contact|Meeting|Commitment|Workspace):/;

// Fail-closed public-safety check. Verifies the boundary flags and scans every string the
// readout exposes for raw refs / write-send-execute leakage. Returns rejection reasons.
export function assertReadoutPublicSafe(readout: OperatingJudgementReadout): ValidationResult {
  const errors: string[] = [];

  for (const [flag, value] of Object.entries(readout.adoptionGuards)) {
    if (value !== false) errors.push(`adoption_guard_not_false:${flag}`);
  }
  if ((readout.promotionTriggered as boolean) !== false) errors.push("promotion_triggered_present");
  if (readout.humanReviewerRequired !== true) errors.push("human_reviewer_not_required");
  if (readout.nextReviewRequired !== true) errors.push("next_review_not_required");
  if (readout.producesOwnerReviewEvidenceOnly !== true) errors.push("not_owner_review_evidence_only");
  if (!readout.boundaryNote.trim()) errors.push("missing_boundary_note");

  // The object alias must be a redacted handle, not a raw "Kind:id" object ref.
  if (RAW_OBJECT_REF_PATTERN.test(readout.objectAlias)) errors.push("object_alias_is_raw_object_ref");

  // Scan dynamic / data-derived fields only. boundaryNote is a fixed declaration that
  // intentionally names forbidden actions (no execution / send / memory promotion), so it
  // must not be scanned for those very words.
  const scanned = [
    readout.objectAlias,
    readout.headline,
    readout.disposition,
    ...readout.contributingFamilies,
    ...readout.conflictFlags,
    ...readout.ruleTraceSummary,
  ];
  for (const value of scanned) {
    if (FORBIDDEN_REF_PATTERNS.some((pattern) => pattern.test(value))) {
      errors.push("write_send_execute_ref_present");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}
