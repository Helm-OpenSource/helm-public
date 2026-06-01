/**
 * Helm Business Advancement — internal dogfood run report.
 *
 * Pure run-report evaluator for one disabled internal dogfood iteration. It
 * consumes a founder decision gate and observation notes, then emits a
 * founder-review-ready run summary.
 *
 * It is NOT production query adoption, NOT a runtime adapter, NOT a DB reader,
 * NOT an API, NOT a page integration, NOT a schema change, NOT an official
 * write path, and NOT automated execution authority.
 */

import {
  INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION,
  INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
  evaluateInternalDogfoodFounderDecision,
  type InternalDogfoodFounderDecisionPacket,
} from "./internal-dogfood-founder-decision";
import type {
  InternalDogfoodFamilyId,
  InternalDogfoodFounderRecommendation,
} from "./internal-dogfood-review-notes";

export const INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION =
  "business-advancement-internal-dogfood-run-report/v1" as const;

export const INTERNAL_DOGFOOD_RUN_REPORT_POSTURE =
  "Disabled-Internal-Dogfood-Run-Report" as const;

export const INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION = "No-Go" as const;

export type InternalDogfoodRunReportDecision = "Run-Report-Ready" | "Blocked";

export interface InternalDogfoodRunContext {
  readonly runId: string;
  readonly conductedBy: string;
  readonly startedAtIso: string;
  readonly endedAtIso: string;
}

export interface InternalDogfoodRunObservation {
  readonly familyId: InternalDogfoodFamilyId;
  readonly observerId: string;
  readonly reviewedCount: number;
  readonly acceptedCount: number;
  readonly falsePositiveCount: number;
  readonly missingEvidenceCount: number;
  readonly thresholdConcernCount: number;
  readonly stopRequested: boolean;
  readonly evidenceRefs: readonly string[];
  readonly notes: string;
}

export interface InternalDogfoodRunReportInput {
  readonly runContext: InternalDogfoodRunContext;
  readonly founderDecision: InternalDogfoodFounderDecisionPacket;
  readonly observations: readonly InternalDogfoodRunObservation[];
}

export interface InternalDogfoodRunReportCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface InternalDogfoodRunFamilyCoverage {
  readonly familyId: InternalDogfoodFamilyId;
  readonly covered: boolean;
  readonly observationCount: number;
  readonly reviewedCount: number;
}

export interface InternalDogfoodRunMetrics {
  readonly reviewedCount: number;
  readonly acceptedCount: number;
  readonly falsePositiveCount: number;
  readonly missingEvidenceCount: number;
  readonly thresholdConcernCount: number;
  readonly stopRequestCount: number;
}

export interface InternalDogfoodRunReport {
  readonly ruleVersion: typeof INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION;
  readonly posture: typeof INTERNAL_DOGFOOD_RUN_REPORT_POSTURE;
  readonly runtimeAdoption: typeof INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION;
  readonly sourceFounderDecisionRuleVersion: typeof INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION;
  readonly sourceFounderDecisionRuntimeAdoption: typeof INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION;
  readonly decision: InternalDogfoodRunReportDecision;
  readonly recommendation: InternalDogfoodFounderRecommendation;
  readonly productionQueryAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly publicTrialAllowed: false;
  readonly runContext: InternalDogfoodRunContext;
  readonly sourceFounderDecision: InternalDogfoodFounderDecisionPacket;
  readonly familyCoverage: readonly InternalDogfoodRunFamilyCoverage[];
  readonly metrics: InternalDogfoodRunMetrics;
  readonly checks: readonly InternalDogfoodRunReportCheck[];
  readonly blockers: readonly string[];
  readonly founderReviewSummary: string;
  readonly boundaryNotes: readonly string[];
}

export const REQUIRED_INTERNAL_DOGFOOD_RUN_FAMILIES = [
  "TPQR-001",
  "TPQR-003",
  "TPQR-004",
] as const satisfies readonly InternalDogfoodFamilyId[];

export const INTERNAL_DOGFOOD_RUN_REPORT_BOUNDARIES = [
  "Run report observations do not approve production query adoption.",
  "Run report observations do not approve runtime integration, API, page behavior, schema, or mobile read-model changes.",
  "Run report observations do not create official write, customer-facing send, approval, payment, or automated execution authority.",
  "Any request for production data must return to redacted real-data calibration and required reviewer approval.",
] as const;

export const DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT: InternalDogfoodRunReportInput =
  {
    runContext: {
      runId: "ba-internal-dogfood-run-default",
      conductedBy: "",
      startedAtIso: "",
      endedAtIso: "",
    },
    founderDecision: evaluateInternalDogfoodFounderDecision(),
    observations: [],
  };

export const POSITIVE_INTERNAL_DOGFOOD_RUN_REPORT_INPUT: InternalDogfoodRunReportInput =
  {
    runContext: {
      runId: "ba-internal-dogfood-run-2026-04-30",
      conductedBy: "codex",
      startedAtIso: "2026-04-30T00:00:00.000Z",
      endedAtIso: "2026-04-30T01:00:00.000Z",
    },
    founderDecision: evaluateInternalDogfoodFounderDecision(
      POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
    ),
    observations: [
      buildPositiveObservation("TPQR-001", 1),
      buildPositiveObservation("TPQR-003", 1),
      buildPositiveObservation("TPQR-004", 2),
    ],
  };

export function buildInternalDogfoodRunReport(
  input: InternalDogfoodRunReportInput = DEFAULT_INTERNAL_DOGFOOD_RUN_REPORT_INPUT,
): InternalDogfoodRunReport {
  const familyCoverage = buildFamilyCoverage(input.observations);
  const metrics = buildMetrics(input.observations);
  const checks = buildChecks(input, familyCoverage, metrics);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const recommendation = buildRecommendation(blockers, metrics);
  const decision: InternalDogfoodRunReportDecision =
    blockers.length === 0 ? "Run-Report-Ready" : "Blocked";

  return {
    ruleVersion: INTERNAL_DOGFOOD_RUN_REPORT_RULE_VERSION,
    posture: INTERNAL_DOGFOOD_RUN_REPORT_POSTURE,
    runtimeAdoption: INTERNAL_DOGFOOD_RUN_REPORT_RUNTIME_ADOPTION,
    sourceFounderDecisionRuleVersion: INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION,
    sourceFounderDecisionRuntimeAdoption: INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION,
    decision,
    recommendation,
    productionQueryAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    publicTrialAllowed: false,
    runContext: input.runContext,
    sourceFounderDecision: input.founderDecision,
    familyCoverage,
    metrics,
    checks,
    blockers,
    founderReviewSummary: buildFounderReviewSummary(decision, recommendation, metrics),
    boundaryNotes: [...INTERNAL_DOGFOOD_RUN_REPORT_BOUNDARIES],
  };
}

function buildPositiveObservation(
  familyId: InternalDogfoodFamilyId,
  reviewedCount: number,
): InternalDogfoodRunObservation {
  return {
    familyId,
    observerId: `${familyId.toLowerCase()}-observer`,
    reviewedCount,
    acceptedCount: reviewedCount,
    falsePositiveCount: 0,
    missingEvidenceCount: 0,
    thresholdConcernCount: 0,
    stopRequested: false,
    evidenceRefs: [`internal-dogfood-founder-decision:${familyId}`],
    notes:
      "Observed during disabled internal dogfood only; no production adoption is approved.",
  };
}

function buildFamilyCoverage(
  observations: readonly InternalDogfoodRunObservation[],
): InternalDogfoodRunFamilyCoverage[] {
  return REQUIRED_INTERNAL_DOGFOOD_RUN_FAMILIES.map((familyId) => {
    const familyObservations = observations.filter(
      (observation) => observation.familyId === familyId,
    );
    const reviewedCount = familyObservations.reduce(
      (sum, observation) => sum + observation.reviewedCount,
      0,
    );
    return {
      familyId,
      covered: familyObservations.length > 0 && reviewedCount > 0,
      observationCount: familyObservations.length,
      reviewedCount,
    };
  });
}

function buildMetrics(
  observations: readonly InternalDogfoodRunObservation[],
): InternalDogfoodRunMetrics {
  return observations.reduce(
    (metrics, observation) => ({
      reviewedCount: metrics.reviewedCount + observation.reviewedCount,
      acceptedCount: metrics.acceptedCount + observation.acceptedCount,
      falsePositiveCount:
        metrics.falsePositiveCount + observation.falsePositiveCount,
      missingEvidenceCount:
        metrics.missingEvidenceCount + observation.missingEvidenceCount,
      thresholdConcernCount:
        metrics.thresholdConcernCount + observation.thresholdConcernCount,
      stopRequestCount:
        metrics.stopRequestCount + (observation.stopRequested ? 1 : 0),
    }),
    {
      reviewedCount: 0,
      acceptedCount: 0,
      falsePositiveCount: 0,
      missingEvidenceCount: 0,
      thresholdConcernCount: 0,
      stopRequestCount: 0,
    },
  );
}

function buildChecks(
  input: InternalDogfoodRunReportInput,
  familyCoverage: readonly InternalDogfoodRunFamilyCoverage[],
  metrics: InternalDogfoodRunMetrics,
): InternalDogfoodRunReportCheck[] {
  return [
    checkRunContext(input.runContext),
    checkFounderDecision(input.founderDecision),
    checkFamilyCoverage(familyCoverage),
    checkObservationStructure(input.observations),
    checkNoStopRequest(metrics),
  ];
}

function checkRunContext(context: InternalDogfoodRunContext): InternalDogfoodRunReportCheck {
  const startedStrict = isStrictUtcIso(context.startedAtIso);
  const endedStrict = isStrictUtcIso(context.endedAtIso);
  const chronological =
    startedStrict &&
    endedStrict &&
    new Date(context.endedAtIso).getTime() > new Date(context.startedAtIso).getTime();
  const pass =
    context.runId.trim().length > 0 &&
    context.conductedBy.trim().length > 0 &&
    startedStrict &&
    endedStrict &&
    chronological;

  return {
    name: "run_context_present",
    pass,
    detail: pass
      ? `Run ${context.runId} conducted by ${context.conductedBy} from ${context.startedAtIso} to ${context.endedAtIso}.`
      : `Run context incomplete: runId=${context.runId || "<missing>"} conductedBy=${context.conductedBy || "<missing>"} startedAtIso=${String(startedStrict)} endedAtIso=${String(endedStrict)} chronological=${String(chronological)}.`,
    blocker: pass
      ? undefined
      : "Run report requires runId, conductor, strict UTC startedAtIso / endedAtIso, and endedAtIso after startedAtIso.",
  };
}

function checkFounderDecision(
  decision: InternalDogfoodFounderDecisionPacket,
): InternalDogfoodRunReportCheck {
  const pass =
    decision.decision === "Approve-Next-Disabled-Internal-Dogfood-Iteration" &&
    decision.productionQueryAdoptionAllowed === false &&
    decision.runtimeIntegrationAllowed === false &&
    decision.publicTrialAllowed === false;

  return {
    name: "founder_decision_approved_disabled_iteration",
    pass,
    detail: pass
      ? "Founder decision approves only the next disabled internal dogfood iteration while production/runtime/public trial stay blocked."
      : `Founder decision not usable for run report: decision=${decision.decision}, production=${String(decision.productionQueryAdoptionAllowed)}, runtime=${String(decision.runtimeIntegrationAllowed)}, publicTrial=${String(decision.publicTrialAllowed)}.`,
    blocker: pass
      ? undefined
      : "Run report requires a founder decision of Approve-Next-Disabled-Internal-Dogfood-Iteration with production/runtime/public trial blocked.",
  };
}

function checkFamilyCoverage(
  coverage: readonly InternalDogfoodRunFamilyCoverage[],
): InternalDogfoodRunReportCheck {
  const missing = coverage.filter((item) => !item.covered).map((item) => item.familyId);
  const pass = missing.length === 0;

  return {
    name: "required_run_families_observed",
    pass,
    detail: pass
      ? `All required families observed: ${coverage.map((item) => `${item.familyId}:${item.reviewedCount}`).join(", ")}.`
      : `Missing dogfood observations: ${missing.join(", ")}.`,
    blocker: pass
      ? undefined
      : "Run report must include observations for TPQR-001, TPQR-003, and TPQR-004.",
  };
}

function checkObservationStructure(
  observations: readonly InternalDogfoodRunObservation[],
): InternalDogfoodRunReportCheck {
  const invalidCount = observations.filter((observation) => !isValidObservation(observation))
    .length;
  const pass = observations.length > 0 && invalidCount === 0;

  return {
    name: "run_observations_structured",
    pass,
    detail: pass
      ? `Structured run observations present: total=${observations.length}.`
      : `Run observation issue: total=${observations.length}, invalid=${invalidCount}.`,
    blocker: pass
      ? undefined
      : "Run observations must include observer, evidence, notes, non-negative count totals, and reviewed count covering accepted / false-positive / missing-evidence / threshold concerns.",
  };
}

function checkNoStopRequest(metrics: InternalDogfoodRunMetrics): InternalDogfoodRunReportCheck {
  const pass = metrics.stopRequestCount === 0;

  return {
    name: "no_stop_request",
    pass,
    detail: pass
      ? "No dogfood observation requested stop."
      : `Dogfood stop requests present: ${metrics.stopRequestCount}.`,
    blocker: pass
      ? undefined
      : "A dogfood stop request blocks run-report readiness and returns the line to calibration or packet revision.",
  };
}

function isValidObservation(observation: InternalDogfoodRunObservation): boolean {
  const counts = [
    observation.reviewedCount,
    observation.acceptedCount,
    observation.falsePositiveCount,
    observation.missingEvidenceCount,
    observation.thresholdConcernCount,
  ];
  const nonNegativeIntegers = counts.every(
    (count) => Number.isInteger(count) && count >= 0,
  );
  const countTotal =
    observation.acceptedCount +
    observation.falsePositiveCount +
    observation.missingEvidenceCount +
    observation.thresholdConcernCount;

  return (
    nonNegativeIntegers &&
    observation.reviewedCount > 0 &&
    countTotal <= observation.reviewedCount &&
    observation.observerId.trim().length > 0 &&
    observation.evidenceRefs.length > 0 &&
    observation.evidenceRefs.every((ref) => ref.trim().length > 0) &&
    observation.notes.trim().length > 0
  );
}

function buildRecommendation(
  blockers: readonly string[],
  metrics: InternalDogfoodRunMetrics,
): InternalDogfoodFounderRecommendation {
  if (metrics.stopRequestCount > 0) {
    return "Stop-And-Return-To-Calibration";
  }
  if (blockers.length > 0) {
    return "Blocked";
  }
  const hasIssues =
    metrics.falsePositiveCount > 0 ||
    metrics.missingEvidenceCount > 0 ||
    metrics.thresholdConcernCount > 0;
  return hasIssues
    ? "Revise-Before-Next-Internal-Dogfood"
    : "Continue-Disabled-Internal-Dogfooding";
}

function buildFounderReviewSummary(
  decision: InternalDogfoodRunReportDecision,
  recommendation: InternalDogfoodFounderRecommendation,
  metrics: InternalDogfoodRunMetrics,
): string {
  if (decision === "Blocked") {
    return `Internal dogfood run report is blocked with recommendation=${recommendation}; no next iteration should proceed.`;
  }
  return `Internal dogfood run report is ready for founder review with recommendation=${recommendation}; reviewed=${metrics.reviewedCount}, accepted=${metrics.acceptedCount}, falsePositive=${metrics.falsePositiveCount}, missingEvidence=${metrics.missingEvidenceCount}, thresholdConcern=${metrics.thresholdConcernCount}.`;
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
