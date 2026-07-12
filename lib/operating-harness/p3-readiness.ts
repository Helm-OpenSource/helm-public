import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  collectUnsafeInputErrors,
  OPERATING_SIGNAL_SOURCE_CLASSES,
  type OperatingSignalSourceClass,
} from "../operating-signal-governance/source-governance";
import { validateJsonInputGraph } from "./validators";

export const HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION =
  "helm.operating-harness.p3-readiness-evidence.v1" as const;
export const HARNESS_P3_READINESS_REPORT_SCHEMA_VERSION =
  "helm.operating-harness.p3-readiness-report.v1" as const;

export const HARNESS_P3_READINESS_FAILURES = [
  "input_invalid",
  "operational_attestation_missing",
  "prerequisites_not_merged",
  "evidence_window_incomplete",
  "insufficient_qualifying_runs",
  "insufficient_independent_heldout_sets",
  "insufficient_candidate_revisions",
  "insufficient_business_object_kinds",
  "insufficient_source_families",
  "insufficient_operational_deidentified_runs",
  "heldout_lift_not_stable",
  "calibration_sample_insufficient",
  "calibration_error_above_limit",
  "evidence_coverage_below_floor",
  "reviewer_completeness_below_one",
  "boundary_incident_present",
  "insufficient_feedback_volume",
  "feedback_receipt_evidence_missing",
  "insufficient_promoted_eval_cases",
  "feedback_to_eval_conversion_below_floor",
  "customer_or_oss_source_in_improvement",
  "insufficient_deidentified_promotions",
  "deidentified_promotion_gate_failed",
  "insufficient_rollback_drills",
  "rollback_drill_failed",
  "recent_candidate_not_pass",
  "protected_component_mutation_present",
  "production_authority_present",
] as const;

export type HarnessP3ReadinessFailure =
  (typeof HARNESS_P3_READINESS_FAILURES)[number];

export type HarnessP3Prerequisite = {
  phase: "P0" | "P1" | "P2";
  mergedToMain: boolean;
  gateRef: string;
  gateHash: string;
};

export type HarnessP3HeldoutRunEvidence = {
  runId: string;
  candidateRevisionId: string;
  heldoutSetRef: string;
  heldoutSetHash: string;
  completedAt: string;
  sourceClasses: OperatingSignalSourceClass[];
  businessObjectKinds: string[];
  evidenceMode: "synthetic_fixture" | "deidentified_operational_receipt";
  heldoutLift: number;
  expectedCalibrationError: number;
  calibrationSampleCount: number;
  evidenceCoverage: number;
  reviewerCompleteness: number;
  boundaryIncidentCount: number;
  decision: "owner_review_candidate" | "inconclusive" | "rejected";
  freshHeldoutConfirmed: boolean;
  weaknessEvidenceReproduced: boolean;
  ownerReviewReceiptRef: string | null;
};

export type HarnessP3DeidentifiedPromotion = {
  promotionId: string;
  sourceClass: "self_dogfood_health" | "deidentified_promoted_case";
  publicEligible: boolean;
  personAttributionRemoved: boolean;
  scannerResultHits: number;
  humanSignoffRef: string;
  walledFromPerformanceEval: boolean;
  receiptHash: string;
};

export type HarnessP3RollbackDrill = {
  drillId: string;
  candidateRevisionId: string;
  fallbackRevisionId: string;
  expectedManifestHash: string;
  restoredManifestHash: string;
  killSwitchActivated: boolean;
  ownerReviewed: boolean;
  ownerReviewReceiptRef: string;
  completedAt: string;
};

export type HarnessP3ReadinessEvidence = {
  schemaVersion: typeof HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION;
  evidenceId: string;
  attestationMode: "synthetic_contract_test" | "owner_attested_operational";
  operationalAttestation: {
    ownerReviewReceiptRef: string | null;
    registrySnapshotHash: string | null;
    signedAt: string | null;
  };
  asOf: string;
  prerequisites: HarnessP3Prerequisite[];
  evaluationWindow: {
    windowStart: string;
    windowEnd: string;
    complete: boolean;
    windowReceiptRef: string;
    totalCandidateRunCount: number;
    runs: HarnessP3HeldoutRunEvidence[];
  };
  feedbackSummary: {
    eligibleEditRejectCount: number;
    promotedEvalCaseCount: number;
    receiptRefs: string[];
  };
  deidentifiedPromotions: HarnessP3DeidentifiedPromotion[];
  rollbackDrills: HarnessP3RollbackDrill[];
  protectedComponentMutationCount: number;
  productionAuthorityGrantCount: number;
  contentHash: string;
};

export type HarnessP3ReadinessEvidenceContent = Omit<
  HarnessP3ReadinessEvidence,
  "contentHash"
>;

export type HarnessP3ReadinessMetrics = {
  evaluatedRunCount: number;
  qualifyingRunCount: number;
  distinctHeldoutSetCount: number;
  distinctCandidateRevisionCount: number;
  distinctBusinessObjectKindCount: number;
  distinctSourceFamilyCount: number;
  operationalDeidentifiedRunCount: number;
  stableRecentRunCount: number;
  minimumRecentHeldoutLift: number | null;
  calibrationSampleCount: number;
  weightedExpectedCalibrationError: number | null;
  minimumEvidenceCoverage: number | null;
  minimumReviewerCompleteness: number | null;
  boundaryIncidentCount: number;
  eligibleFeedbackCount: number;
  promotedEvalCaseCount: number;
  feedbackToEvalConversionRate: number | null;
  deidentifiedPromotionCount: number;
  successfulRollbackDrillCount: number;
  recentNonPassCount: number;
  customerOrOssSourceRunCount: number;
  protectedComponentMutationCount: number;
  productionAuthorityGrantCount: number;
};

export type HarnessP3ReadinessReport = {
  schemaVersion: typeof HARNESS_P3_READINESS_REPORT_SCHEMA_VERSION;
  reportId: string;
  evidenceId: string;
  evidenceHash: string;
  policyRef: typeof HARNESS_P3_READINESS_POLICY.policyRef;
  policyHash: string;
  decision: "ready_for_p3_design_review" | "not_ready";
  metrics: HarnessP3ReadinessMetrics;
  failures: HarnessP3ReadinessFailure[];
  validationErrors: string[];
  ownerReviewRequired: true;
  ownerApprovalRecorded: false;
  implementationTriggered: false;
  productionAuthorityGranted: false;
  createdAt: string;
  contentHash: string;
};

export type HarnessP3ReadinessReportContent = Omit<
  HarnessP3ReadinessReport,
  "contentHash"
>;

const p3ReadinessPolicyContent = {
  policyRef: "policy:operating-harness-p3-readiness-v1" as const,
  minQualifyingRuns: 5,
  minIndependentHeldoutSets: 5,
  minCandidateRevisions: 3,
  minBusinessObjectKinds: 3,
  minObjectKindRunOccurrences: 2,
  minSourceFamilies: 2,
  minOperationalDeidentifiedRuns: 3,
  recentRunWindow: 3,
  minRecentHeldoutLift: 0.05,
  minCalibrationSamples: 100,
  minCalibrationSamplesPerQualifyingRun: 10,
  maxExpectedCalibrationError: 0.1,
  minEvidenceCoverage: 0.9,
  minReviewerCompleteness: 1,
  maxBoundaryIncidents: 0,
  minEligibleFeedback: 30,
  minFeedbackReceiptRefs: 2,
  minPromotedEvalCases: 10,
  minFeedbackToEvalConversionRate: 0.3,
  minDeidentifiedPromotions: 3,
  minSuccessfulRollbackDrills: 2,
};

export const HARNESS_P3_READINESS_POLICY = {
  ...p3ReadinessPolicyContent,
  contentHash: sha256(canonicalJson(p3ReadinessPolicyContent)),
};

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const sha256Schema = z.string().regex(SHA256_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });

const prerequisiteSchema = z
  .object({
    phase: z.enum(["P0", "P1", "P2"]),
    mergedToMain: z.boolean(),
    gateRef: safeRefSchema,
    gateHash: sha256Schema,
  })
  .strict();

const heldoutRunSchema = z
  .object({
    runId: safeRefSchema,
    candidateRevisionId: safeRefSchema,
    heldoutSetRef: safeRefSchema,
    heldoutSetHash: sha256Schema,
    completedAt: timestampSchema,
    sourceClasses: z.array(z.enum(OPERATING_SIGNAL_SOURCE_CLASSES)).min(1),
    businessObjectKinds: z.array(safeRefSchema).min(1),
    evidenceMode: z.enum([
      "synthetic_fixture",
      "deidentified_operational_receipt",
    ]),
    heldoutLift: z.number().min(-1).max(1),
    expectedCalibrationError: z.number().min(0).max(1),
    calibrationSampleCount: z.number().int().min(0),
    evidenceCoverage: z.number().min(0).max(1),
    reviewerCompleteness: z.number().min(0).max(1),
    boundaryIncidentCount: z.number().int().min(0),
    decision: z.enum(["owner_review_candidate", "inconclusive", "rejected"]),
    freshHeldoutConfirmed: z.boolean(),
    weaknessEvidenceReproduced: z.boolean(),
    ownerReviewReceiptRef: safeRefSchema.nullable(),
  })
  .strict();

const promotionSchema = z
  .object({
    promotionId: safeRefSchema,
    sourceClass: z.enum(["self_dogfood_health", "deidentified_promoted_case"]),
    publicEligible: z.boolean(),
    personAttributionRemoved: z.boolean(),
    scannerResultHits: z.number().int().min(0),
    humanSignoffRef: safeRefSchema,
    walledFromPerformanceEval: z.boolean(),
    receiptHash: sha256Schema,
  })
  .strict();

const rollbackDrillSchema = z
  .object({
    drillId: safeRefSchema,
    candidateRevisionId: safeRefSchema,
    fallbackRevisionId: safeRefSchema,
    expectedManifestHash: sha256Schema,
    restoredManifestHash: sha256Schema,
    killSwitchActivated: z.boolean(),
    ownerReviewed: z.boolean(),
    ownerReviewReceiptRef: safeRefSchema,
    completedAt: timestampSchema,
  })
  .strict();

const p3ReadinessEvidenceSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_P3_READINESS_EVIDENCE_SCHEMA_VERSION),
    evidenceId: safeRefSchema,
    attestationMode: z.enum(["synthetic_contract_test", "owner_attested_operational"]),
    operationalAttestation: z
      .object({
        ownerReviewReceiptRef: safeRefSchema.nullable(),
        registrySnapshotHash: sha256Schema.nullable(),
        signedAt: timestampSchema.nullable(),
      })
      .strict(),
    asOf: timestampSchema,
    prerequisites: z.array(prerequisiteSchema),
    evaluationWindow: z
      .object({
        windowStart: timestampSchema,
        windowEnd: timestampSchema,
        complete: z.boolean(),
        windowReceiptRef: safeRefSchema,
        totalCandidateRunCount: z.number().int().min(0),
        runs: z.array(heldoutRunSchema),
      })
      .strict(),
    feedbackSummary: z
      .object({
        eligibleEditRejectCount: z.number().int().min(0),
        promotedEvalCaseCount: z.number().int().min(0),
        receiptRefs: z.array(safeRefSchema),
      })
      .strict(),
    deidentifiedPromotions: z.array(promotionSchema),
    rollbackDrills: z.array(rollbackDrillSchema),
    protectedComponentMutationCount: z.number().int().min(0),
    productionAuthorityGrantCount: z.number().int().min(0),
    contentHash: sha256Schema,
  })
  .strict();

const readinessMetricsSchema = z
  .object({
    evaluatedRunCount: z.number().int().min(0),
    qualifyingRunCount: z.number().int().min(0),
    distinctHeldoutSetCount: z.number().int().min(0),
    distinctCandidateRevisionCount: z.number().int().min(0),
    distinctBusinessObjectKindCount: z.number().int().min(0),
    distinctSourceFamilyCount: z.number().int().min(0),
    operationalDeidentifiedRunCount: z.number().int().min(0),
    stableRecentRunCount: z.number().int().min(0),
    minimumRecentHeldoutLift: z.number().min(-1).max(1).nullable(),
    calibrationSampleCount: z.number().int().min(0),
    weightedExpectedCalibrationError: z.number().min(0).max(1).nullable(),
    minimumEvidenceCoverage: z.number().min(0).max(1).nullable(),
    minimumReviewerCompleteness: z.number().min(0).max(1).nullable(),
    boundaryIncidentCount: z.number().int().min(0),
    eligibleFeedbackCount: z.number().int().min(0),
    promotedEvalCaseCount: z.number().int().min(0),
    feedbackToEvalConversionRate: z.number().min(0).max(1).nullable(),
    deidentifiedPromotionCount: z.number().int().min(0),
    successfulRollbackDrillCount: z.number().int().min(0),
    recentNonPassCount: z.number().int().min(0),
    customerOrOssSourceRunCount: z.number().int().min(0),
    protectedComponentMutationCount: z.number().int().min(0),
    productionAuthorityGrantCount: z.number().int().min(0),
  })
  .strict();

const p3ReadinessReportSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_P3_READINESS_REPORT_SCHEMA_VERSION),
    reportId: safeRefSchema,
    evidenceId: safeRefSchema,
    evidenceHash: sha256Schema,
    policyRef: z.literal(HARNESS_P3_READINESS_POLICY.policyRef),
    policyHash: sha256Schema,
    decision: z.enum(["ready_for_p3_design_review", "not_ready"]),
    metrics: readinessMetricsSchema,
    failures: z.array(z.enum(HARNESS_P3_READINESS_FAILURES)),
    validationErrors: z.array(z.string().min(1)),
    ownerReviewRequired: z.literal(true),
    ownerApprovalRecorded: z.literal(false),
    implementationTriggered: z.literal(false),
    productionAuthorityGranted: z.literal(false),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

function validationResult(errors: string[]): { ok: boolean; errors: string[] } {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseErrors(parse: z.ZodSafeParseResult<unknown>, prefix: string): string[] {
  if (parse.success) return [];
  return parse.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${prefix}:${path}:${issue.code}`;
  });
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) found.add(value);
    seen.add(value);
  }
  return [...found];
}

function rawContentHashErrors(
  input: unknown,
  compute: (content: never) => string,
  error: string,
): string[] {
  if (!isRecord(input)) return [error];
  const { contentHash, ...content } = input;
  return typeof contentHash === "string" && contentHash === compute(content as never)
    ? []
    : [error];
}

export function computeHarnessP3ReadinessEvidenceContentHash(
  content: HarnessP3ReadinessEvidenceContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeHarnessP3ReadinessReportContentHash(
  content: HarnessP3ReadinessReportContent,
): string {
  return sha256(canonicalJson(content));
}

export function validateHarnessP3ReadinessEvidence(input: unknown): {
  ok: boolean;
  errors: string[];
} {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return validationResult(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  errors.push(
    ...rawContentHashErrors(
      input,
      computeHarnessP3ReadinessEvidenceContentHash as (content: never) => string,
      "p3_readiness_evidence_content_hash_mismatch",
    ),
  );
  const parsed = p3ReadinessEvidenceSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_p3_readiness_evidence"));
  if (!parsed.success) return validationResult(errors);
  const evidence = parsed.data;
  for (const duplicate of duplicates(evidence.prerequisites.map((item) => item.phase))) {
    errors.push(`duplicate_p3_prerequisite:${duplicate}`);
  }
  for (const duplicate of duplicates(evidence.evaluationWindow.runs.map((item) => item.runId))) {
    errors.push(`duplicate_p3_run:${duplicate}`);
  }
  for (const duplicate of duplicates(
    evidence.deidentifiedPromotions.map((item) => item.promotionId),
  )) {
    errors.push(`duplicate_p3_promotion:${duplicate}`);
  }
  for (const duplicate of duplicates(
    evidence.deidentifiedPromotions.map((item) => item.receiptHash),
  )) {
    errors.push(`duplicate_p3_promotion_receipt:${duplicate}`);
  }
  for (const duplicate of duplicates(
    evidence.deidentifiedPromotions.map((item) => item.humanSignoffRef),
  )) {
    errors.push(`duplicate_p3_promotion_signoff:${duplicate}`);
  }
  for (const duplicate of duplicates(evidence.rollbackDrills.map((item) => item.drillId))) {
    errors.push(`duplicate_p3_rollback_drill:${duplicate}`);
  }
  for (const duplicate of duplicates(
    evidence.rollbackDrills.map((item) => item.ownerReviewReceiptRef),
  )) {
    errors.push(`duplicate_p3_rollback_owner_review_receipt:${duplicate}`);
  }
  for (const duplicate of duplicates(evidence.feedbackSummary.receiptRefs)) {
    errors.push(`duplicate_p3_feedback_receipt:${duplicate}`);
  }
  for (const duplicate of duplicates(
    evidence.evaluationWindow.runs
      .map((item) => item.ownerReviewReceiptRef)
      .filter((item): item is string => item !== null),
  )) {
    errors.push(`duplicate_p3_owner_review_receipt:${duplicate}`);
  }
  const crossCategoryOwnerReviewRefs = [
    evidence.operationalAttestation.ownerReviewReceiptRef,
    ...evidence.evaluationWindow.runs.map((item) => item.ownerReviewReceiptRef),
    ...evidence.rollbackDrills.map((item) => item.ownerReviewReceiptRef),
    ...evidence.feedbackSummary.receiptRefs,
    ...evidence.deidentifiedPromotions.map((item) => item.humanSignoffRef),
  ].filter((item): item is string => item !== null);
  for (const duplicate of duplicates(crossCategoryOwnerReviewRefs)) {
    errors.push(`cross_category_owner_review_receipt_reused:${duplicate}`);
  }
  const hashesByHeldoutRef = new Map<string, Set<string>>();
  const refsByHeldoutHash = new Map<string, Set<string>>();
  for (const run of evidence.evaluationWindow.runs) {
    const hashes = hashesByHeldoutRef.get(run.heldoutSetRef) ?? new Set<string>();
    hashes.add(run.heldoutSetHash);
    hashesByHeldoutRef.set(run.heldoutSetRef, hashes);
    const refs = refsByHeldoutHash.get(run.heldoutSetHash) ?? new Set<string>();
    refs.add(run.heldoutSetRef);
    refsByHeldoutHash.set(run.heldoutSetHash, refs);
  }
  for (const [ref, hashes] of hashesByHeldoutRef) {
    if (hashes.size > 1) errors.push(`p3_heldout_ref_hash_conflict:${ref}`);
  }
  for (const [hash, refs] of refsByHeldoutHash) {
    if (refs.size > 1) errors.push(`p3_heldout_hash_ref_conflict:${hash}`);
  }
  if (evidence.feedbackSummary.promotedEvalCaseCount > evidence.feedbackSummary.eligibleEditRejectCount) {
    errors.push("promoted_eval_count_exceeds_eligible_feedback");
  }
  return validationResult(errors);
}

function emptyMetrics(): HarnessP3ReadinessMetrics {
  return {
    evaluatedRunCount: 0,
    qualifyingRunCount: 0,
    distinctHeldoutSetCount: 0,
    distinctCandidateRevisionCount: 0,
    distinctBusinessObjectKindCount: 0,
    distinctSourceFamilyCount: 0,
    operationalDeidentifiedRunCount: 0,
    stableRecentRunCount: 0,
    minimumRecentHeldoutLift: null,
    calibrationSampleCount: 0,
    weightedExpectedCalibrationError: null,
    minimumEvidenceCoverage: null,
    minimumReviewerCompleteness: null,
    boundaryIncidentCount: 0,
    eligibleFeedbackCount: 0,
    promotedEvalCaseCount: 0,
    feedbackToEvalConversionRate: null,
    deidentifiedPromotionCount: 0,
    successfulRollbackDrillCount: 0,
    recentNonPassCount: 0,
    customerOrOssSourceRunCount: 0,
    protectedComponentMutationCount: 0,
    productionAuthorityGrantCount: 0,
  };
}

function buildReport(input: {
  evidenceId: string;
  evidenceHash: string;
  createdAt: string;
  metrics: HarnessP3ReadinessMetrics;
  failures: HarnessP3ReadinessFailure[];
  validationErrors: string[];
}): HarnessP3ReadinessReport {
  const content = {
    schemaVersion: HARNESS_P3_READINESS_REPORT_SCHEMA_VERSION,
    reportId: `report:${input.evidenceId}`,
    evidenceId: input.evidenceId,
    evidenceHash: input.evidenceHash,
    policyRef: HARNESS_P3_READINESS_POLICY.policyRef,
    policyHash: HARNESS_P3_READINESS_POLICY.contentHash,
    decision:
      input.failures.length === 0 && input.validationErrors.length === 0
        ? ("ready_for_p3_design_review" as const)
        : ("not_ready" as const),
    metrics: input.metrics,
    failures: [...new Set(input.failures)],
    validationErrors: [...new Set(input.validationErrors)],
    ownerReviewRequired: true as const,
    ownerApprovalRecorded: false as const,
    implementationTriggered: false as const,
    productionAuthorityGranted: false as const,
    createdAt: input.createdAt,
  };
  return {
    ...content,
    contentHash: computeHarnessP3ReadinessReportContentHash(content),
  };
}

function isQualifyingRun(run: HarnessP3HeldoutRunEvidence): boolean {
  return (
    run.decision === "owner_review_candidate" &&
    run.freshHeldoutConfirmed &&
    run.weaknessEvidenceReproduced &&
    Boolean(run.ownerReviewReceiptRef)
  );
}

function validPromotion(promotion: HarnessP3DeidentifiedPromotion): boolean {
  return (
    promotion.publicEligible &&
    promotion.personAttributionRemoved &&
    promotion.scannerResultHits === 0 &&
    promotion.walledFromPerformanceEval &&
    promotion.humanSignoffRef.length > 0
  );
}

export function evaluateHarnessP3Readiness(input: unknown): HarnessP3ReadinessReport {
  const validation = validateHarnessP3ReadinessEvidence(input);
  const parsed = p3ReadinessEvidenceSchema.safeParse(input);
  if (!validation.ok || !parsed.success) {
    const record = isRecord(input) ? input : {};
    const evidenceId =
      typeof record.evidenceId === "string" && SAFE_REF_PATTERN.test(record.evidenceId)
        ? record.evidenceId
        : "invalid:p3-readiness-evidence";
    const evidenceHash =
      typeof record.contentHash === "string" && SHA256_PATTERN.test(record.contentHash)
        ? record.contentHash
        : sha256("invalid:p3-readiness-evidence");
    const createdAt =
      typeof record.asOf === "string" && timestampSchema.safeParse(record.asOf).success
        ? record.asOf
        : "1970-01-01T00:00:00.000Z";
    return buildReport({
      evidenceId,
      evidenceHash,
      createdAt,
      metrics: emptyMetrics(),
      failures: ["input_invalid"],
      validationErrors: validation.errors,
    });
  }

  const evidence = parsed.data;
  const runs = [...evidence.evaluationWindow.runs].sort(
    (left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt),
  );
  const qualifyingRuns = runs.filter(isQualifyingRun);
  const recentRuns = runs.slice(-HARNESS_P3_READINESS_POLICY.recentRunWindow);
  const stableRecentRuns = recentRuns.filter(
    (run) =>
      isQualifyingRun(run) &&
      run.heldoutLift >= HARNESS_P3_READINESS_POLICY.minRecentHeldoutLift,
  );
  const heldoutRefs = new Set(qualifyingRuns.map((run) => run.heldoutSetRef));
  const heldoutHashes = new Set(qualifyingRuns.map((run) => run.heldoutSetHash));
  const calibrationSampleCount = qualifyingRuns.reduce(
    (sum, run) => sum + run.calibrationSampleCount,
    0,
  );
  const weightedExpectedCalibrationError =
    calibrationSampleCount === 0
      ? null
      : qualifyingRuns.reduce(
          (sum, run) =>
            sum + run.expectedCalibrationError * run.calibrationSampleCount,
          0,
        ) / calibrationSampleCount;
  const feedbackToEvalConversionRate =
    evidence.feedbackSummary.eligibleEditRejectCount === 0
      ? null
      : evidence.feedbackSummary.promotedEvalCaseCount /
        evidence.feedbackSummary.eligibleEditRejectCount;
  const validPromotions = evidence.deidentifiedPromotions.filter(validPromotion);
  const qualifyingCandidateIds = new Set(
    qualifyingRuns.map((run) => run.candidateRevisionId),
  );
  const successfulRollbackDrillEvidence = evidence.rollbackDrills.filter(
    (drill) =>
      drill.killSwitchActivated &&
      drill.ownerReviewed &&
      drill.ownerReviewReceiptRef.length > 0 &&
      drill.expectedManifestHash === drill.restoredManifestHash &&
      drill.fallbackRevisionId !== drill.candidateRevisionId &&
      qualifyingCandidateIds.has(drill.candidateRevisionId) &&
      Date.parse(drill.completedAt) >= Date.parse(evidence.evaluationWindow.windowStart) &&
      Date.parse(drill.completedAt) <= Date.parse(evidence.evaluationWindow.windowEnd) &&
      Date.parse(drill.completedAt) <= Date.parse(evidence.asOf),
  );
  const successfulRollbackDrills = Math.min(
    successfulRollbackDrillEvidence.length,
    new Set(successfulRollbackDrillEvidence.map((item) => item.candidateRevisionId)).size,
  );
  const customerOrOssSourceRunCount = runs.filter((run) =>
    run.sourceClasses.some(
      (sourceClass) =>
        sourceClass === "fleet_customer_health" || sourceClass === "oss_governance",
    ),
  ).length;
  const objectKindRunOccurrences = new Map<string, number>();
  for (const run of qualifyingRuns) {
    for (const kind of new Set(run.businessObjectKinds)) {
      objectKindRunOccurrences.set(kind, (objectKindRunOccurrences.get(kind) ?? 0) + 1);
    }
  }
  const metrics: HarnessP3ReadinessMetrics = {
    evaluatedRunCount: runs.length,
    qualifyingRunCount: qualifyingRuns.length,
    distinctHeldoutSetCount: Math.min(heldoutRefs.size, heldoutHashes.size),
    distinctCandidateRevisionCount: new Set(
      qualifyingRuns.map((run) => run.candidateRevisionId),
    ).size,
    distinctBusinessObjectKindCount: [...objectKindRunOccurrences.values()].filter(
      (count) => count >= HARNESS_P3_READINESS_POLICY.minObjectKindRunOccurrences,
    ).length,
    distinctSourceFamilyCount: new Set(
      qualifyingRuns.flatMap((run) => run.sourceClasses),
    ).size,
    operationalDeidentifiedRunCount: qualifyingRuns.filter(
      (run) =>
        run.evidenceMode === "deidentified_operational_receipt" &&
        run.sourceClasses.some(
          (sourceClass) =>
            sourceClass === "self_dogfood_health" ||
            sourceClass === "deidentified_promoted_case",
        ),
    ).length,
    stableRecentRunCount: stableRecentRuns.length,
    minimumRecentHeldoutLift:
      recentRuns.length === 0
        ? null
        : Math.min(...recentRuns.map((run) => run.heldoutLift)),
    calibrationSampleCount,
    weightedExpectedCalibrationError,
    minimumEvidenceCoverage:
      runs.length === 0
        ? null
        : Math.min(...runs.map((run) => run.evidenceCoverage)),
    minimumReviewerCompleteness:
      runs.length === 0
        ? null
        : Math.min(...runs.map((run) => run.reviewerCompleteness)),
    boundaryIncidentCount: runs.reduce(
      (sum, run) => sum + run.boundaryIncidentCount,
      0,
    ),
    eligibleFeedbackCount: evidence.feedbackSummary.eligibleEditRejectCount,
    promotedEvalCaseCount: evidence.feedbackSummary.promotedEvalCaseCount,
    feedbackToEvalConversionRate,
    deidentifiedPromotionCount: validPromotions.length,
    successfulRollbackDrillCount: successfulRollbackDrills,
    recentNonPassCount: recentRuns.filter((run) => !isQualifyingRun(run)).length,
    customerOrOssSourceRunCount,
    protectedComponentMutationCount: evidence.protectedComponentMutationCount,
    productionAuthorityGrantCount: evidence.productionAuthorityGrantCount,
  };
  const failures: HarnessP3ReadinessFailure[] = [];
  const policy = HARNESS_P3_READINESS_POLICY;
  if (
    evidence.attestationMode !== "owner_attested_operational" ||
    !evidence.operationalAttestation.ownerReviewReceiptRef ||
    !evidence.operationalAttestation.registrySnapshotHash ||
    !evidence.operationalAttestation.signedAt ||
    Date.parse(evidence.operationalAttestation.signedAt) <
      Date.parse(evidence.evaluationWindow.windowEnd) ||
    Date.parse(evidence.operationalAttestation.signedAt) > Date.parse(evidence.asOf)
  ) {
    failures.push("operational_attestation_missing");
  }
  const prerequisitesByPhase = new Map(
    evidence.prerequisites.map((item) => [item.phase, item]),
  );
  if (
    (["P0", "P1", "P2"] as const).some(
      (phase) => prerequisitesByPhase.get(phase)?.mergedToMain !== true,
    )
  ) {
    failures.push("prerequisites_not_merged");
  }
  if (
    !evidence.evaluationWindow.complete ||
    evidence.evaluationWindow.totalCandidateRunCount !== runs.length ||
    Date.parse(evidence.evaluationWindow.windowStart) >=
      Date.parse(evidence.evaluationWindow.windowEnd) ||
    Date.parse(evidence.evaluationWindow.windowEnd) > Date.parse(evidence.asOf) ||
    runs.some(
      (run) =>
        Date.parse(run.completedAt) < Date.parse(evidence.evaluationWindow.windowStart) ||
        Date.parse(run.completedAt) > Date.parse(evidence.evaluationWindow.windowEnd),
    )
  ) {
    failures.push("evidence_window_incomplete");
  }
  if (metrics.qualifyingRunCount < policy.minQualifyingRuns) {
    failures.push("insufficient_qualifying_runs");
  }
  if (metrics.distinctHeldoutSetCount < policy.minIndependentHeldoutSets) {
    failures.push("insufficient_independent_heldout_sets");
  }
  if (metrics.distinctCandidateRevisionCount < policy.minCandidateRevisions) {
    failures.push("insufficient_candidate_revisions");
  }
  if (metrics.distinctBusinessObjectKindCount < policy.minBusinessObjectKinds) {
    failures.push("insufficient_business_object_kinds");
  }
  if (metrics.distinctSourceFamilyCount < policy.minSourceFamilies) {
    failures.push("insufficient_source_families");
  }
  if (
    metrics.operationalDeidentifiedRunCount < policy.minOperationalDeidentifiedRuns
  ) {
    failures.push("insufficient_operational_deidentified_runs");
  }
  if (
    metrics.stableRecentRunCount < policy.recentRunWindow ||
    metrics.minimumRecentHeldoutLift === null ||
    metrics.minimumRecentHeldoutLift < policy.minRecentHeldoutLift
  ) {
    failures.push("heldout_lift_not_stable");
  }
  if (
    metrics.calibrationSampleCount < policy.minCalibrationSamples ||
    qualifyingRuns.some(
      (run) =>
        run.calibrationSampleCount < policy.minCalibrationSamplesPerQualifyingRun,
    )
  ) {
    failures.push("calibration_sample_insufficient");
  }
  if (
    metrics.weightedExpectedCalibrationError === null ||
    metrics.weightedExpectedCalibrationError > policy.maxExpectedCalibrationError ||
    qualifyingRuns.some(
      (run) => run.expectedCalibrationError > policy.maxExpectedCalibrationError,
    )
  ) {
    failures.push("calibration_error_above_limit");
  }
  if (
    metrics.minimumEvidenceCoverage === null ||
    metrics.minimumEvidenceCoverage < policy.minEvidenceCoverage
  ) {
    failures.push("evidence_coverage_below_floor");
  }
  if (
    metrics.minimumReviewerCompleteness === null ||
    metrics.minimumReviewerCompleteness < policy.minReviewerCompleteness
  ) {
    failures.push("reviewer_completeness_below_one");
  }
  if (metrics.boundaryIncidentCount > policy.maxBoundaryIncidents) {
    failures.push("boundary_incident_present");
  }
  if (metrics.eligibleFeedbackCount < policy.minEligibleFeedback) {
    failures.push("insufficient_feedback_volume");
  }
  if (new Set(evidence.feedbackSummary.receiptRefs).size < policy.minFeedbackReceiptRefs) {
    failures.push("feedback_receipt_evidence_missing");
  }
  if (metrics.promotedEvalCaseCount < policy.minPromotedEvalCases) {
    failures.push("insufficient_promoted_eval_cases");
  }
  if (
    metrics.feedbackToEvalConversionRate === null ||
    metrics.feedbackToEvalConversionRate < policy.minFeedbackToEvalConversionRate
  ) {
    failures.push("feedback_to_eval_conversion_below_floor");
  }
  if (metrics.customerOrOssSourceRunCount > 0) {
    failures.push("customer_or_oss_source_in_improvement");
  }
  if (metrics.deidentifiedPromotionCount < policy.minDeidentifiedPromotions) {
    failures.push("insufficient_deidentified_promotions");
  }
  if (validPromotions.length !== evidence.deidentifiedPromotions.length) {
    failures.push("deidentified_promotion_gate_failed");
  }
  if (metrics.successfulRollbackDrillCount < policy.minSuccessfulRollbackDrills) {
    failures.push("insufficient_rollback_drills");
  }
  if (
    successfulRollbackDrillEvidence.length !== evidence.rollbackDrills.length ||
    successfulRollbackDrills !== successfulRollbackDrillEvidence.length
  ) {
    failures.push("rollback_drill_failed");
  }
  if (metrics.recentNonPassCount > 0) failures.push("recent_candidate_not_pass");
  if (metrics.protectedComponentMutationCount > 0) {
    failures.push("protected_component_mutation_present");
  }
  if (metrics.productionAuthorityGrantCount > 0) {
    failures.push("production_authority_present");
  }
  return buildReport({
    evidenceId: evidence.evidenceId,
    evidenceHash: evidence.contentHash,
    createdAt: evidence.asOf,
    metrics,
    failures,
    validationErrors: [],
  });
}

export function validateHarnessP3ReadinessReport(input: unknown): {
  ok: boolean;
  errors: string[];
} {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return validationResult(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  errors.push(
    ...rawContentHashErrors(
      input,
      computeHarnessP3ReadinessReportContentHash as (content: never) => string,
      "p3_readiness_report_content_hash_mismatch",
    ),
  );
  const parsed = p3ReadinessReportSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_p3_readiness_report"));
  if (!parsed.success) return validationResult(errors);
  const report = parsed.data;
  if (report.policyHash !== HARNESS_P3_READINESS_POLICY.contentHash) {
    errors.push("p3_readiness_policy_hash_mismatch");
  }
  if (
    report.decision === "ready_for_p3_design_review" &&
    (report.failures.length > 0 || report.validationErrors.length > 0)
  ) {
    errors.push("p3_ready_report_has_failures");
  }
  if (
    report.decision === "not_ready" &&
    report.failures.length === 0 &&
    report.validationErrors.length === 0
  ) {
    errors.push("p3_not_ready_report_has_no_failure");
  }
  return validationResult(errors);
}

export function validateHarnessP3ReadinessReportBinding(input: {
  report: unknown;
  evidence: unknown;
}): { ok: boolean; errors: string[] } {
  const errors = validateHarnessP3ReadinessReport(input.report).errors;
  const recomputed = evaluateHarnessP3Readiness(input.evidence);
  if (!isRecord(input.report) || input.report.contentHash !== recomputed.contentHash) {
    errors.push("p3_readiness_report_not_reproducible_from_evidence");
  }
  return validationResult(errors);
}
