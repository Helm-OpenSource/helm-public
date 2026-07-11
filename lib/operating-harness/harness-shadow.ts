import type {
  ASet,
  BSet,
  ExpertOutput,
  PreRegistration,
  RunInput,
} from "../expert-capability/contracts";
import {
  checkBoundary,
  evidenceCompleteness,
  evaluate,
  type EvalReport,
  type RoleAggregate,
} from "../expert-capability/evaluator";
import { sha256 } from "../expert-capability/hashing";
import type { EvalCasePromotion } from "../expert-capability/validators";
import {
  validateOperatingSignalImprovementGate,
  type OperatingSignalSourceEnvelope,
} from "../operating-signal-governance/source-governance";
import {
  HARNESS_SHADOW_RECEIPT_SCHEMA_VERSION,
  computeHarnessShadowReceiptContentHash,
  type HarnessManifest,
  type HarnessRevision,
  type HarnessShadowReceipt,
  type HarnessShadowVerdict,
} from "./harness-contracts";
import {
  validateHarnessManifest,
  validateHarnessRevisionBinding,
} from "./harness-validators";
import {
  computeOperatingHarnessQualityMetrics,
  type BoundaryOutcome,
  type OperatingHarnessQualityMetrics,
  type OperatingHarnessQualityReport,
} from "./metrics";

export type HarnessShadowEvaluationInput = {
  baselineManifest: HarnessManifest;
  candidateManifest: HarnessManifest;
  baselineRevision: HarnessRevision;
  candidateRevision: HarnessRevision;
  expertEvaluation: {
    preRegistration: PreRegistration;
    runInput: RunInput;
    aSet: ASet;
    bSet: BSet;
  };
  sourceBindings: Array<{
    source: OperatingSignalSourceEnvelope;
    promotion: EvalCasePromotion | null;
  }>;
};

const REGRESSION_METRICS = [
  "signalRecall",
  "precision",
  "evidenceCoverage",
  "reviewerCompleteness",
  "feedbackToEvalConversionRate",
] as const satisfies readonly (keyof OperatingHarnessQualityMetrics)[];

const EMPTY_QUALITY_METRICS: OperatingHarnessQualityMetrics = {
  signalRecall: null,
  precision: null,
  evidenceCoverage: null,
  reviewerCompleteness: null,
  boundaryIncidentCount: null,
  heldoutLift: null,
  feedbackToEvalConversionRate: null,
};

function emptyQualityReport(): OperatingHarnessQualityReport {
  return {
    schemaVersion: "helm.operating-harness.quality-report.v1",
    complete: false,
    metrics: { ...EMPTY_QUALITY_METRICS },
    missingMetrics: [
      "signalRecall",
      "precision",
      "evidenceCoverage",
      "reviewerCompleteness",
      "boundaryIncidentCount",
      "heldoutLift",
      "feedbackToEvalConversionRate",
    ],
    auxiliary: { boundaryAttemptCount: null },
  };
}

function emptyRoleAggregate(): RoleAggregate {
  return { weighted: 0, boundaryCorrectness: 0, perCase: [] };
}

function emptyExpertReport(): EvalReport {
  return {
    preRegistrationId: "invalid:pre-registration",
    evaluationRunId: "invalid:shadow-run",
    candidateRevisionId: "invalid:candidate-revision",
    invariantViolations: ["expert_evaluator_exception"],
    hardGateFailures: [],
    aRegression: [],
    candidate: emptyRoleAggregate(),
    previous: emptyRoleAggregate(),
    ruleBaseline: emptyRoleAggregate(),
    minMargin: 0,
    loopCompoundingDecision: "fail",
    expertJustifiedDecision: "fail",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function shaField(value: unknown, fallbackSeed: string): string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
    ? value
    : sha256(fallbackSeed);
}

function timestampField(value: unknown): string {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return "1970-01-01T00:00:00.000Z";
}

function safeValidation(prefix: string, validate: () => { errors: string[] }): string[] {
  try {
    return validate().errors.map((error) => `${prefix}:${error}`);
  } catch {
    return [`${prefix}:validator_exception`];
  }
}

function supportedEvidenceCount(output: ExpertOutput, relevantEvidence: string[]): number {
  const relevant = new Set(relevantEvidence);
  return new Set(output.evidenceRefs.filter((ref) => relevant.has(ref))).size;
}

function deriveQualityReport(input: {
  role: "candidate" | "previous";
  comparator: "previous" | "ruleBaseline";
  aSet: ASet;
  bSet: BSet;
  expertReport: EvalReport;
}): OperatingHarnessQualityReport {
  const { role, comparator, aSet, bSet, expertReport } = input;
  const expectedRelevantSignalCount = bSet.cases.length;
  const acceptedCases = bSet.cases.filter((item) => {
    const output = item.outputs[role];
    return (
      checkBoundary(output, item.gold).ok &&
      evidenceCompleteness(item.gold, output.evidenceRefs).hallucinatedRefs.length === 0
    );
  });
  const matchedRelevantSignalCount = acceptedCases.filter(
    (item) => item.outputs[role].disposition === item.gold.disposition,
  ).length;
  const requiredEvidenceCount = bSet.cases.reduce(
    (sum, item) => sum + new Set(item.gold.relevantEvidence).size,
    0,
  );
  const independentlySupportedEvidenceCount = bSet.cases.reduce(
    (sum, item) =>
      sum + supportedEvidenceCount(item.outputs[role], item.gold.relevantEvidence),
    0,
  );
  const boundaryOutcomes = bSet.cases.map<BoundaryOutcome>((item) => {
    const boundary = checkBoundary(item.outputs[role], item.gold);
    if (!boundary.ok) return "escaped_incident";
    return item.gold.boundaryExpectation.includes("must_not_recommend_action")
      ? "blocked_attempt"
      : "none";
  });
  const eligibleEditRejectFeedbackCount = aSet.cases.filter(
    (item) => item.feedback.correctionType === "edit" || item.feedback.correctionType === "reject",
  ).length;
  const roleAggregate = expertReport[role];
  const comparatorAggregate = expertReport[comparator];

  return computeOperatingHarnessQualityMetrics({
    expectedRelevantSignalCount,
    matchedRelevantSignalCount,
    acceptedSignalCount: acceptedCases.length,
    requiredEvidenceCount,
    independentlySupportedEvidenceCount,
    requiredReviewCount: bSet.cases.length,
    completedReviewCount: bSet.cases.length,
    boundaryOutcomes,
    candidateHeldoutScore: roleAggregate.weighted,
    baselineHeldoutScore: comparatorAggregate.weighted,
    eligibleEditRejectFeedbackCount,
    promotedEvalCaseCount: eligibleEditRejectFeedbackCount,
  });
}

function collectQualityGateFailures(
  candidate: OperatingHarnessQualityReport,
  baseline: OperatingHarnessQualityReport,
): string[] {
  const failures: string[] = [];
  if (!candidate.complete) failures.push("candidate_quality_report_incomplete");
  if (!baseline.complete) failures.push("baseline_quality_report_incomplete");
  if (candidate.metrics.boundaryIncidentCount !== 0) {
    failures.push("candidate_boundary_incident_present");
  }
  if (candidate.metrics.reviewerCompleteness !== 1) {
    failures.push("candidate_reviewer_completeness_below_one");
  }
  if (candidate.metrics.heldoutLift === null || candidate.metrics.heldoutLift <= 0) {
    failures.push("candidate_heldout_lift_not_positive");
  }

  for (const metric of REGRESSION_METRICS) {
    const candidateValue = candidate.metrics[metric];
    const baselineValue = baseline.metrics[metric];
    if (
      typeof candidateValue === "number" &&
      typeof baselineValue === "number" &&
      candidateValue < baselineValue
    ) {
      const metricName = metric.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`);
      failures.push(`candidate_${metricName}_regressed`);
    }
  }
  return failures;
}

export function evaluateHarnessShadow(
  input: HarnessShadowEvaluationInput,
): HarnessShadowReceipt {
  const hardGateFailures: string[] = [];
  hardGateFailures.push(
    ...safeValidation("baseline_manifest", () =>
      validateHarnessManifest(input.baselineManifest),
    ),
    ...safeValidation("candidate_manifest", () =>
      validateHarnessManifest(input.candidateManifest),
    ),
    ...safeValidation("baseline_revision", () =>
      validateHarnessRevisionBinding({
        revision: input.baselineRevision,
        manifest: input.baselineManifest,
        parentRevision: null,
        parentManifest: null,
      }),
    ),
    ...safeValidation("candidate_revision", () =>
      validateHarnessRevisionBinding({
        revision: input.candidateRevision,
        manifest: input.candidateManifest,
        parentRevision: input.baselineRevision,
        parentManifest: input.baselineManifest,
      }),
    ),
  );

  const baselineRevision = asRecord(input.baselineRevision);
  const candidateRevision = asRecord(input.candidateRevision);
  const candidateManifest = asRecord(input.candidateManifest);
  if (baselineRevision.status !== "seed") hardGateFailures.push("baseline_revision_not_seed");
  if (candidateRevision.status !== "shadow_candidate") {
    hardGateFailures.push("candidate_revision_not_shadow_candidate");
  }
  const manifestUses = Array.isArray(candidateManifest.intendedUses)
    ? candidateManifest.intendedUses.filter((value): value is string => typeof value === "string")
    : [];
  if (!manifestUses.includes("heldout_eval")) {
    hardGateFailures.push("manifest_not_enabled_for_heldout_eval");
  }
  const manifestSourceClasses = Array.isArray(candidateManifest.allowedSourceClasses)
    ? candidateManifest.allowedSourceClasses.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  const sourceBindings = Array.isArray(input.sourceBindings) ? input.sourceBindings : [];
  if (sourceBindings.length === 0) hardGateFailures.push("source_binding_missing");
  const seenSourceIds = new Set<string>();
  sourceBindings.forEach((binding, index) => {
    hardGateFailures.push(
      ...safeValidation("source_gate", () =>
        validateOperatingSignalImprovementGate(binding),
      ),
    );
    const source = asRecord(binding?.source);
    const sourceClass = typeof source.sourceClass === "string" ? source.sourceClass : "";
    const sourceId = typeof source.signalId === "string" ? source.signalId : "";
    const allowedUses = Array.isArray(source.allowedUses)
      ? source.allowedUses.filter((value): value is string => typeof value === "string")
      : [];
    if (!manifestSourceClasses.includes(sourceClass)) {
      hardGateFailures.push(`source_class_not_allowed_by_manifest:${index}`);
    }
    if (!allowedUses.includes("heldout_eval")) {
      hardGateFailures.push(`source_not_allowed_for_heldout_eval:${index}`);
    }
    if (sourceId && seenSourceIds.has(sourceId)) {
      hardGateFailures.push("duplicate_source_binding");
    }
    if (sourceId) seenSourceIds.add(sourceId);
  });

  const expertEvaluation = asRecord(input.expertEvaluation);
  const preRegistration = asRecord(expertEvaluation.preRegistration);
  const runInput = asRecord(expertEvaluation.runInput);
  const aSet = asRecord(expertEvaluation.aSet);
  const bSet = asRecord(expertEvaluation.bSet);
  if (runInput.candidateRevisionId !== candidateRevision.revisionId) {
    hardGateFailures.push("candidate_revision_not_bound_to_run_input");
  }
  if (preRegistration.previousExpertRevisionId !== baselineRevision.revisionId) {
    hardGateFailures.push("baseline_revision_not_bound_to_pre_registration");
  }
  if (
    Date.parse(String(runInput.candidateRevisionCreatedAt ?? "")) !==
    Date.parse(String(candidateRevision.createdAt ?? ""))
  ) {
    hardGateFailures.push("candidate_creation_time_not_bound_to_run_input");
  }

  let expertReport = emptyExpertReport();
  let candidateQuality = emptyQualityReport();
  let baselineQuality = emptyQualityReport();
  try {
    const evaluated = evaluate({
      preRegistration: expertEvaluation.preRegistration as PreRegistration,
      runInput: expertEvaluation.runInput as RunInput,
      aSet: expertEvaluation.aSet as ASet,
      bSet: expertEvaluation.bSet as BSet,
    });
    hardGateFailures.push(
      ...evaluated.invariantViolations.map((error) => `expert_invariant:${error}`),
      ...evaluated.hardGateFailures.map((error) => `expert_hard_gate:${error}`),
      ...evaluated.aRegression.map((error) => `expert_a_regression:${error}`),
    );
    const derivedCandidateQuality = deriveQualityReport({
      role: "candidate",
      comparator: "previous",
      aSet: expertEvaluation.aSet as ASet,
      bSet: expertEvaluation.bSet as BSet,
      expertReport: evaluated,
    });
    const derivedBaselineQuality = deriveQualityReport({
      role: "previous",
      comparator: "ruleBaseline",
      aSet: expertEvaluation.aSet as ASet,
      bSet: expertEvaluation.bSet as BSet,
      expertReport: evaluated,
    });
    expertReport = evaluated;
    candidateQuality = derivedCandidateQuality;
    baselineQuality = derivedBaselineQuality;
  } catch {
    expertReport = emptyExpertReport();
    candidateQuality = emptyQualityReport();
    baselineQuality = emptyQualityReport();
    hardGateFailures.push("expert_evaluator_exception");
  }
  hardGateFailures.push(...collectQualityGateFailures(candidateQuality, baselineQuality));

  const uniqueFailures = [...new Set(hardGateFailures)];
  let verdict: HarnessShadowVerdict;
  if (uniqueFailures.length > 0) {
    verdict = "fail";
  } else if (
    expertReport.loopCompoundingDecision === "success" &&
    expertReport.expertJustifiedDecision === "pass"
  ) {
    verdict = "shadow_pass";
  } else {
    verdict = "inconclusive";
  }

  const content = {
    schemaVersion: HARNESS_SHADOW_RECEIPT_SCHEMA_VERSION,
    shadowRunId: stringField(runInput.evaluationRunId, "invalid:shadow-run"),
    candidateRevisionId: stringField(
      candidateRevision.revisionId,
      "invalid:candidate-revision",
    ),
    candidateRevisionHash: shaField(
      candidateRevision.contentHash,
      "invalid candidate revision",
    ),
    baselineRevisionId: stringField(
      baselineRevision.revisionId,
      "invalid:baseline-revision",
    ),
    baselineRevisionHash: shaField(
      baselineRevision.contentHash,
      "invalid baseline revision",
    ),
    preRegistrationId: stringField(
      preRegistration.preRegistrationId,
      "invalid:pre-registration",
    ),
    preRegistrationContentHash: shaField(
      preRegistration.contentHash,
      "invalid pre-registration",
    ),
    developmentSetRef: stringField(aSet.setId, "invalid:development-set"),
    developmentSetHash: shaField(aSet.setHash, "invalid development set"),
    heldoutSetRef: stringField(bSet.setId, "invalid:heldout-set"),
    heldoutSetHash: shaField(bSet.setHash, "invalid heldout set"),
    replaySnapshotRootHash: shaField(
      preRegistration.replaySnapshotRootHash,
      "invalid replay snapshot root",
    ),
    qualityDerivation: "expert_pre_registered_a_b" as const,
    qualityScope: "heldout_corpus_projection" as const,
    expertEvaluation: {
      loopCompoundingDecision: expertReport.loopCompoundingDecision,
      expertJustifiedDecision: expertReport.expertJustifiedDecision,
      candidateWeighted: expertReport.candidate.weighted,
      previousWeighted: expertReport.previous.weighted,
      ruleBaselineWeighted: expertReport.ruleBaseline.weighted,
      candidateBoundaryCorrectness: expertReport.candidate.boundaryCorrectness,
    },
    candidateQuality: candidateQuality.metrics,
    baselineQuality: baselineQuality.metrics,
    sourceGateCount: sourceBindings.length,
    verdict,
    hardGateFailures: uniqueFailures,
    eligibleForOwnerReview: verdict === "shadow_pass",
    ownerReviewRequired: true as const,
    promotionTriggered: false as const,
    productionAuthorityGranted: false as const,
    createdAt: timestampField(runInput.ranAt),
  };
  return {
    ...content,
    contentHash: computeHarnessShadowReceiptContentHash(content),
  };
}
