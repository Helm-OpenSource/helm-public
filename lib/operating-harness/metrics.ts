export const OPERATING_HARNESS_QUALITY_REPORT_SCHEMA_VERSION =
  "helm.operating-harness.quality-report.v1" as const;

export const OPERATING_HARNESS_QUALITY_METRIC_NAMES = [
  "signalRecall",
  "precision",
  "evidenceCoverage",
  "reviewerCompleteness",
  "boundaryIncidentCount",
  "heldoutLift",
  "feedbackToEvalConversionRate",
] as const;

export type OperatingHarnessQualityMetricName =
  (typeof OPERATING_HARNESS_QUALITY_METRIC_NAMES)[number];

export type BoundaryOutcome = "none" | "blocked_attempt" | "escaped_incident";

const BOUNDARY_OUTCOME_SET: ReadonlySet<string> = new Set([
  "none",
  "blocked_attempt",
  "escaped_incident",
]);

export type BoundaryCounts = {
  boundaryAttemptCount: number;
  boundaryIncidentCount: number;
};

export function computeBoundaryCounts(outcomes: readonly BoundaryOutcome[]): BoundaryCounts {
  for (const outcome of outcomes) {
    if (!BOUNDARY_OUTCOME_SET.has(outcome)) {
      throw new Error(`invalid_boundary_outcome:${String(outcome)}`);
    }
  }
  return outcomes.reduce<BoundaryCounts>(
    (counts, outcome) => {
      if (outcome === "blocked_attempt" || outcome === "escaped_incident") {
        counts.boundaryAttemptCount += 1;
      }
      if (outcome === "escaped_incident") counts.boundaryIncidentCount += 1;
      return counts;
    },
    { boundaryAttemptCount: 0, boundaryIncidentCount: 0 },
  );
}

export type OperatingHarnessQualityMetricInput = {
  expectedRelevantSignalCount: number;
  matchedRelevantSignalCount: number;
  acceptedSignalCount: number;
  requiredEvidenceCount: number;
  independentlySupportedEvidenceCount: number;
  requiredReviewCount: number;
  completedReviewCount: number;
  boundaryOutcomes: readonly BoundaryOutcome[];
  candidateHeldoutScore: number | null;
  baselineHeldoutScore: number | null;
  eligibleEditRejectFeedbackCount: number;
  promotedEvalCaseCount: number;
};

export type OperatingHarnessQualityMetrics = {
  signalRecall: number | null;
  precision: number | null;
  evidenceCoverage: number | null;
  reviewerCompleteness: number | null;
  boundaryIncidentCount: number | null;
  heldoutLift: number | null;
  feedbackToEvalConversionRate: number | null;
};

export type OperatingHarnessQualityReport = {
  schemaVersion: typeof OPERATING_HARNESS_QUALITY_REPORT_SCHEMA_VERSION;
  complete: boolean;
  metrics: OperatingHarnessQualityMetrics;
  missingMetrics: OperatingHarnessQualityMetricName[];
  auxiliary: {
    boundaryAttemptCount: number | null;
  };
};

function assertCount(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`invalid_non_negative_integer:${field}`);
  }
}

function assertScore(value: number | null, field: string): void {
  if (value === null) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`invalid_unit_score:${field}`);
  }
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function computeOperatingHarnessQualityMetrics(
  input: OperatingHarnessQualityMetricInput,
): OperatingHarnessQualityReport {
  for (const field of [
    "expectedRelevantSignalCount",
    "matchedRelevantSignalCount",
    "acceptedSignalCount",
    "requiredEvidenceCount",
    "independentlySupportedEvidenceCount",
    "requiredReviewCount",
    "completedReviewCount",
    "eligibleEditRejectFeedbackCount",
    "promotedEvalCaseCount",
  ] as const) {
    assertCount(input[field], field);
  }
  assertScore(input.candidateHeldoutScore, "candidateHeldoutScore");
  assertScore(input.baselineHeldoutScore, "baselineHeldoutScore");

  if (input.matchedRelevantSignalCount > input.expectedRelevantSignalCount) {
    throw new Error("matched_relevant_signal_count_exceeds_expected");
  }
  if (input.matchedRelevantSignalCount > input.acceptedSignalCount) {
    throw new Error("matched_relevant_signal_count_exceeds_accepted");
  }
  if (input.independentlySupportedEvidenceCount > input.requiredEvidenceCount) {
    throw new Error("independently_supported_evidence_count_exceeds_required");
  }
  if (input.completedReviewCount > input.requiredReviewCount) {
    throw new Error("completed_review_count_exceeds_required");
  }
  if (input.promotedEvalCaseCount > input.eligibleEditRejectFeedbackCount) {
    throw new Error("promoted_eval_case_count_exceeds_eligible_edit_reject_feedback");
  }

  const boundary = computeBoundaryCounts(input.boundaryOutcomes);
  const boundaryMeasured = input.boundaryOutcomes.length > 0;
  const metrics: OperatingHarnessQualityMetrics = {
    signalRecall: ratio(
      input.matchedRelevantSignalCount,
      input.expectedRelevantSignalCount,
    ),
    precision: ratio(input.matchedRelevantSignalCount, input.acceptedSignalCount),
    evidenceCoverage: ratio(
      input.independentlySupportedEvidenceCount,
      input.requiredEvidenceCount,
    ),
    reviewerCompleteness: ratio(input.completedReviewCount, input.requiredReviewCount),
    boundaryIncidentCount: boundaryMeasured ? boundary.boundaryIncidentCount : null,
    heldoutLift:
      input.candidateHeldoutScore === null || input.baselineHeldoutScore === null
        ? null
        : input.candidateHeldoutScore - input.baselineHeldoutScore,
    feedbackToEvalConversionRate: ratio(
      input.promotedEvalCaseCount,
      input.eligibleEditRejectFeedbackCount,
    ),
  };

  const missingMetrics = OPERATING_HARNESS_QUALITY_METRIC_NAMES.filter(
    (name) => metrics[name] === null,
  );

  return {
    schemaVersion: OPERATING_HARNESS_QUALITY_REPORT_SCHEMA_VERSION,
    complete: missingMetrics.length === 0,
    metrics,
    missingMetrics,
    auxiliary: {
      boundaryAttemptCount: boundaryMeasured ? boundary.boundaryAttemptCount : null,
    },
  };
}
