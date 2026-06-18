// Operating Judgement Fusion v0.1 — deterministic fusion engine.
//
// Pure function. No LLM/neural, no IO. Source-class governance runs BEFORE fusion:
// an improvement-use fusion (public/held-out eval, training) hard-rejects
// fleet_customer_health / oss_governance via the existing improvement gate; an
// advice-use fusion admits only source classes whose governance allows that use.
// Signals that are boundary-blocked, cross-tenant, llm-ranked, off-object, or not yet
// LINKED are excluded. The remaining weak signals are fused by deterministic rules into
// one advice-only judgement with a calibratable (0..1) confidence and a full rule trace.

import { FORBIDDEN_REF_PATTERNS } from "../expert-capability/contracts";
import { OPERATING_SIGNAL_BLOCKED_STATES } from "../operating-signal-flow/contract";
import type { OperatingSignalFamily } from "../operating-signal-flow/contract";
import {
  collectUnsafeInputErrors,
  validateOperatingSignalImprovementGate,
  validateOperatingSignalSourceEnvelope,
} from "../operating-signal-governance/source-governance";
import type { OperatingSignalUse } from "../operating-signal-governance/source-governance";
import {
  assertAdviceOnlyJudgement,
  OPERATING_JUDGEMENT_SCHEMA_VERSION,
  type JudgementFusionExcludedSignal,
  type JudgementFusionInput,
  type JudgementFusionResult,
  type JudgementFusionSignal,
  type OperatingJudgement,
  type OperatingJudgementConfidence,
  type OperatingJudgementConfidenceBand,
  type OperatingJudgementRuleTraceEntry,
} from "./contract";

const IMPROVEMENT_USES: ReadonlySet<OperatingSignalUse> = new Set([
  "public_eval",
  "heldout_eval",
  "model_improvement",
  "training",
]);

// Pressure-ordered base weights (higher = stronger claim on the fused disposition).
const FAMILY_BASE_WEIGHT: Record<OperatingSignalFamily, number> = {
  risk: 5,
  boundary_attempt: 5,
  commitment: 4,
  evidence_gap: 3,
  pacing: 2,
  advancement: 2,
  receipt: 1,
};

const CONFIDENCE_WEIGHT: Record<OperatingJudgementConfidenceBand, number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
  mixed: 0.4,
  unknown: 0.2,
};

const STRONG_BANDS: ReadonlySet<OperatingJudgementConfidenceBand> = new Set(["high", "medium"]);

const ADVICE_BOUNDARY_NOTE =
  "Advice-only fused judgement over governed weak signals; human review required; " +
  "no execution, writeback, external send, or memory promotion.";

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function signalCompleteness(signal: JudgementFusionSignal): number {
  const { provided, required } = signal.event.evidenceCoverage;
  if (required <= 0) return provided > 0 ? 1 : 0;
  return clamp01(provided / required);
}

function bandFromScore(score: number): OperatingJudgementConfidenceBand {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.25) return "low";
  return "unknown";
}

const RAW_PRIVATE_MARKER = /raw[_-]?private|raw[_-]?blocked/i;

// Fail-closed public-safety scan of an event's dynamic, data-derived fields. Reuses the
// source-governance forbidden-key / private-contact scanner (emails, phones, internal
// hosts, private domains) and adds raw/private markers. Returns a reason or null.
function eventSafetyExclusionReason(event: JudgementFusionSignal["event"]): string | null {
  if (event.redactionStatus === "raw_blocked") return "raw_blocked";
  if (event.evidenceRefs.some((ref) => FORBIDDEN_REF_PATTERNS.some((re) => re.test(ref)))) {
    return "unsafe_evidence_ref";
  }
  const dynamicFields = {
    sourceKind: event.sourceKind,
    sourceRef: event.sourceRef,
    actorRef: event.actorRef,
    ruleId: event.ruleId,
    objectRef: event.objectRef,
    boundaryNote: event.boundaryNote,
    evidenceRefs: event.evidenceRefs,
  };
  if (collectUnsafeInputErrors(dynamicFields).length > 0) return "raw_or_private_content";
  const strings = [
    event.sourceRef,
    event.actorRef ?? "",
    event.ruleId ?? "",
    ...event.evidenceRefs,
  ];
  if (strings.some((value) => RAW_PRIVATE_MARKER.test(value))) return "raw_or_private_content";
  return null;
}

type AdmissionOutcome = {
  admitted: JudgementFusionSignal[];
  excluded: JudgementFusionExcludedSignal[];
};

// Drop signals that must never enter fusion. These are exclusions, not gate failures:
// fusion continues on whatever governed signal remains.
function admitSignals(input: JudgementFusionInput): AdmissionOutcome {
  const admitted: JudgementFusionSignal[] = [];
  const excluded: JudgementFusionExcludedSignal[] = [];

  for (const signal of input.signals) {
    const { event, source } = signal;
    const key = event.signalKey;

    if (event.objectRef !== input.objectRef) {
      excluded.push({ signalKey: key, reason: "different_object" });
      continue;
    }
    if (event.crossTenantProjection) {
      excluded.push({ signalKey: key, reason: "cross_tenant_projection_forbidden" });
      continue;
    }
    if (event.confidenceSource === "llm_ranking") {
      excluded.push({ signalKey: key, reason: "llm_ranking_forbidden" });
      continue;
    }
    // Fail closed on raw / private / unsafe input — exclude as a blocker, never silently strip.
    const unsafeReason = eventSafetyExclusionReason(event);
    if (unsafeReason) {
      excluded.push({ signalKey: key, reason: unsafeReason });
      continue;
    }
    if (event.boundaryCheckResult === "blocked") {
      excluded.push({ signalKey: key, reason: "boundary_blocked" });
      continue;
    }
    if (OPERATING_SIGNAL_BLOCKED_STATES.has(event.transitionTo)) {
      excluded.push({ signalKey: key, reason: "signal_blocked_state" });
      continue;
    }
    // Only governed (LINKED or later) signals fuse. DETECTED/NORMALIZED are pre-link.
    if (event.transitionTo === "DETECTED" || event.transitionTo === "NORMALIZED") {
      excluded.push({ signalKey: key, reason: "not_yet_linked" });
      continue;
    }
    // The source must actually allow the intended use of the fused judgement.
    if (!source.allowedUses.includes(input.intendedUse)) {
      excluded.push({ signalKey: key, reason: "use_not_allowed_for_source_class" });
      continue;
    }
    admitted.push(signal);
  }

  return { admitted, excluded };
}

// Hard source-class gate: structural envelope validity + improvement-use rejection of
// fleet/oss. A failure here zeroes the whole fusion (judgement = null).
function runSourceClassGate(input: JudgementFusionInput): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const isImprovement = IMPROVEMENT_USES.has(input.intendedUse);

  for (const { event, source } of input.signals) {
    // The governance envelope must be bound to THIS signal, or a clean envelope could be
    // pasted onto a dirty event to slip past the fleet/self/oss source-class gate.
    if (source.signalId !== event.signalKey) {
      errors.push(`${event.signalKey}:source_envelope_signal_mismatch`);
    }
    const envelope = validateOperatingSignalSourceEnvelope(source);
    if (!envelope.ok) {
      errors.push(...envelope.errors.map((error) => `${event.signalKey}:${error}`));
    }
    if (isImprovement) {
      const gate = validateOperatingSignalImprovementGate({ source });
      if (!gate.ok) {
        errors.push(...gate.errors.map((error) => `${event.signalKey}:${error}`));
      }
      // For eval / training uses the held-out set must be pristine: a raw / private /
      // unsafe signal anywhere in the case hard-fails the run, it cannot just be excluded
      // while a clean co-signal carries the score.
      const unsafe = eventSafetyExclusionReason(event);
      if (unsafe) {
        errors.push(`${event.signalKey}:unsafe_signal_forbidden_in_improvement_use:${unsafe}`);
      }
    }
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function familyWeights(
  admitted: JudgementFusionSignal[],
): Map<OperatingSignalFamily, number> {
  const weights = new Map<OperatingSignalFamily, number>();
  for (const signal of admitted) {
    const family = signal.event.signalFamily;
    const weight =
      FAMILY_BASE_WEIGHT[family] *
      CONFIDENCE_WEIGHT[signal.event.confidenceBand] *
      (0.4 + 0.6 * signalCompleteness(signal));
    weights.set(family, (weights.get(family) ?? 0) + weight);
  }
  return weights;
}

function hasStrongFamily(
  admitted: JudgementFusionSignal[],
  family: OperatingSignalFamily,
): boolean {
  return admitted.some(
    (signal) =>
      signal.event.signalFamily === family && STRONG_BANDS.has(signal.event.confidenceBand),
  );
}

function dispositionFor(
  dominantFamily: OperatingSignalFamily,
  aggregateCompleteness: number,
  hasConflict: boolean,
): string {
  if (aggregateCompleteness < 0.34) return "request_evidence";
  if (hasConflict) return "prepare_review_packet";
  switch (dominantFamily) {
    case "risk":
      return "escalate_blocker";
    case "boundary_attempt":
      return "prepare_review_packet";
    case "commitment":
      return "draft_next_action";
    case "evidence_gap":
      return "request_evidence";
    case "pacing":
    case "advancement":
      return "schedule_recheck";
    default:
      return "no_action_watch";
  }
}

export function fuseOperatingSignals(input: JudgementFusionInput): JudgementFusionResult {
  const ruleTrace: OperatingJudgementRuleTraceEntry[] = [];

  // 1) Source-class gate BEFORE fusion.
  const gate = runSourceClassGate(input);
  ruleTrace.push({
    ruleId: "gate.source-class",
    effect: gate.ok ? "all source envelopes admitted" : `gate blocked: ${gate.errors.join(",")}`,
  });
  if (!gate.ok) {
    return {
      ok: false,
      judgement: null,
      gate: { ok: false, errors: gate.errors },
      blockers: ["source_class_gate_failed"],
      admittedSignalKeys: [],
      excludedSignalKeys: input.signals.map((signal) => ({
        signalKey: signal.event.signalKey,
        reason: "source_class_gate_failed",
      })),
    };
  }

  // 2) Admit / exclude.
  const { admitted, excluded } = admitSignals(input);
  ruleTrace.push({
    ruleId: "admit.filter",
    effect: `admitted ${admitted.length}, excluded ${excluded.length}`,
  });
  if (admitted.length === 0) {
    return {
      ok: false,
      judgement: null,
      gate: { ok: true, errors: [] },
      blockers: ["no_admissible_signal"],
      admittedSignalKeys: [],
      excludedSignalKeys: excluded,
    };
  }

  // 3) Deterministic fusion.
  const weights = familyWeights(admitted);
  let dominantFamily: OperatingSignalFamily = admitted[0].event.signalFamily;
  let dominantWeight = -1;
  let totalWeight = 0;
  for (const [family, weight] of weights) {
    totalWeight += weight;
    if (weight > dominantWeight) {
      dominantWeight = weight;
      dominantFamily = family;
    }
  }

  const conflictFlags: string[] = [];
  if (hasStrongFamily(admitted, "commitment") && hasStrongFamily(admitted, "risk")) {
    conflictFlags.push("commitment_advance_vs_risk_contradiction");
  }
  if (admitted.some((signal) => signal.event.transitionTo === "CONTRADICTION_REVIEW")) {
    conflictFlags.push("contradiction_review_state");
  }
  if (admitted.some((signal) => signal.event.signalFamily === "boundary_attempt")) {
    conflictFlags.push("boundary_attempt_present");
  }
  const hasConflict = conflictFlags.length > 0;

  const providedTotal = admitted.reduce(
    (sum, signal) => sum + Math.max(0, signal.event.evidenceCoverage.provided),
    0,
  );
  const requiredTotal = admitted.reduce(
    (sum, signal) => sum + Math.max(0, signal.event.evidenceCoverage.required),
    0,
  );
  const aggregateCompleteness =
    requiredTotal > 0 ? clamp01(providedTotal / requiredTotal) : providedTotal > 0 ? 1 : 0;

  const familyAgreement = totalWeight > 0 ? clamp01(dominantWeight / totalWeight) : 0;
  const conflictPenalty = hasConflict ? 0.5 : 1;
  const score = clamp01(aggregateCompleteness * familyAgreement * conflictPenalty);

  const distinctStrongFamilies = new Set(
    admitted
      .filter((signal) => STRONG_BANDS.has(signal.event.confidenceBand))
      .map((signal) => signal.event.signalFamily),
  );
  const band: OperatingJudgementConfidenceBand =
    aggregateCompleteness === 0
      ? "unknown"
      : hasConflict || distinctStrongFamilies.size >= 2
        ? "mixed"
        : bandFromScore(score);

  const confidence: OperatingJudgementConfidence = {
    band,
    score,
    method: "deterministic_evidence_family_fusion",
  };

  const disposition = dispositionFor(dominantFamily, aggregateCompleteness, hasConflict);

  // Union evidence refs across admitted signals, dropping any unsafe (write/send/execute) ref.
  const evidenceRefs = [
    ...new Set(
      admitted
        .flatMap((signal) => signal.event.evidenceRefs)
        .filter((ref) => !FORBIDDEN_REF_PATTERNS.some((re) => re.test(ref))),
    ),
  ];

  const contributingFamilies = [...new Set(admitted.map((signal) => signal.event.signalFamily))];
  const fusedSignalKeys = admitted.map((signal) => signal.event.signalKey);

  ruleTrace.push({
    ruleId: "fuse.family-weight",
    effect: `dominant=${dominantFamily} agreement=${familyAgreement.toFixed(2)}`,
  });
  if (hasConflict) {
    ruleTrace.push({ ruleId: "fuse.conflict", effect: conflictFlags.join(",") });
  }
  ruleTrace.push({
    ruleId: "fuse.evidence",
    effect: `completeness=${aggregateCompleteness.toFixed(2)}`,
  });
  ruleTrace.push({ ruleId: "fuse.disposition", effect: disposition });
  ruleTrace.push({ ruleId: "fuse.confidence", effect: `band=${band} score=${score.toFixed(2)}` });

  const judgement: OperatingJudgement = {
    schemaVersion: OPERATING_JUDGEMENT_SCHEMA_VERSION,
    judgementId: `judgement:${input.objectKind}:${input.objectRef}`,
    objectRef: input.objectRef,
    objectKind: input.objectKind,
    disposition,
    headline: buildHeadline(input.objectKind, dominantFamily, disposition, hasConflict),
    commitmentClass: "advice",
    fusedSignalKeys,
    contributingFamilies,
    evidenceRefs,
    evidenceCoverage: { provided: providedTotal, required: requiredTotal },
    confidence,
    conflictFlags,
    ruleTrace,
    humanReviewerRequired: true,
    forbiddenActionRefs: [],
    boundaryNote: ADVICE_BOUNDARY_NOTE,
    promotionTriggered: false,
  };

  // Self-check: fail closed if the engine ever produced a non-advice / unsafe judgement.
  const selfCheck = assertAdviceOnlyJudgement(judgement);
  if (!selfCheck.ok) {
    return {
      ok: false,
      judgement: null,
      gate: { ok: true, errors: [] },
      blockers: selfCheck.errors.map((error) => `self_check:${error}`),
      admittedSignalKeys: fusedSignalKeys,
      excludedSignalKeys: excluded,
    };
  }

  return {
    ok: true,
    judgement,
    gate: { ok: true, errors: [] },
    blockers: [],
    admittedSignalKeys: fusedSignalKeys,
    excludedSignalKeys: excluded,
  };
}

function buildHeadline(
  objectKind: string,
  dominantFamily: OperatingSignalFamily,
  disposition: string,
  hasConflict: boolean,
): string {
  if (hasConflict) {
    return `${objectKind}: conflicting weak signals — review before the next step (${disposition}).`;
  }
  return `${objectKind}: ${dominantFamily} signal dominates — suggested next step is ${disposition}.`;
}

// Single-signal baseline for held-out comparison: the existing "pick the highest-pressure
// signal" posture, expressed as a one-signal fusion. Used by the eval as the ruleBaseline
// that fusion must beat. Selection mirrors lib/operating-signal-flow pressure ordering.
export function singleSignalBaseline(input: JudgementFusionInput): JudgementFusionResult {
  const { admitted } = admitSignals(input);
  const gate = runSourceClassGate(input);
  if (!gate.ok || admitted.length === 0) {
    return fuseOperatingSignals(input);
  }
  const ranked = [...admitted].sort(
    (a, b) =>
      FAMILY_BASE_WEIGHT[b.event.signalFamily] * CONFIDENCE_WEIGHT[b.event.confidenceBand] -
      FAMILY_BASE_WEIGHT[a.event.signalFamily] * CONFIDENCE_WEIGHT[a.event.confidenceBand],
  );
  return fuseOperatingSignals({ ...input, signals: [ranked[0]] });
}
