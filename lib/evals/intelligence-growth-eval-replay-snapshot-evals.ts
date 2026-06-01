import snapshotFixtureData from "@/evals/intelligence-growth-eval-replay-snapshots/eval-replay-snapshot-cases.json";
import { runIntelligenceGrowthApprovalReadinessEval } from "@/lib/evals/intelligence-growth-approval-readiness-evals";
import { runIntelligenceGrowthBudgetGateEval } from "@/lib/evals/intelligence-growth-budget-gate-evals";
import { runIntelligenceGrowthBoundaryStaticEval } from "@/lib/evals/intelligence-growth-boundary-static-evals";
import { runIntelligenceGrowthChainIntegrityEval } from "@/lib/evals/intelligence-growth-chain-integrity-evals";
import { runIntelligenceGrowthCycleAdvanceEval } from "@/lib/evals/intelligence-growth-cycle-advance-evals";
import { runIntelligenceGrowthDataProtectionManifestEval } from "@/lib/evals/intelligence-growth-data-protection-manifest-evals";
import { runIntelligenceGrowthDecisionOutcomeEval } from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import { runIntelligenceGrowthDimensionSaturationEval } from "@/lib/evals/intelligence-growth-dimension-saturation-evals";
import { runIntelligenceGrowthFailureTaxonomyCoverageEval } from "@/lib/evals/intelligence-growth-failure-taxonomy-coverage-evals";
import { runIntelligenceGrowthFixtureLintEval } from "@/lib/evals/intelligence-growth-fixture-lint-evals";
import { runIntelligenceGrowthLearningRequeueEval } from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import { runIntelligenceGrowthLiveCalibrationPreflightEval } from "@/lib/evals/intelligence-growth-live-calibration-preflight-evals";
import { runIntelligenceGrowthRemediationRoundtripEval } from "@/lib/evals/intelligence-growth-remediation-roundtrip-evals";
import { runIntelligenceGrowthReviewPacketEval } from "@/lib/evals/intelligence-growth-review-packet-evals";
import { runIntelligenceGrowthSchemaDriftEval } from "@/lib/evals/intelligence-growth-schema-drift-evals";
import { runIntelligenceGrowthTenantSignalEval } from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import { runIntelligenceGrowthWeeklyScorecardEval } from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";
import { runEval } from "@/lib/intelligence-growth/evaluator";

type SnapshotValue = string | number | boolean | null | SnapshotObject | readonly SnapshotValue[];
type SnapshotObject = { readonly [key: string]: SnapshotValue };

export type IntelligenceGrowthEvalReplaySnapshotCase = {
  readonly producerId: string;
  readonly expected: SnapshotObject;
};

export type IntelligenceGrowthEvalReplaySnapshotFixture = {
  readonly version: string;
  readonly expectedSnapshotCount: number;
  readonly snapshots: readonly IntelligenceGrowthEvalReplaySnapshotCase[];
};

export type IntelligenceGrowthEvalReplaySnapshotProducer = {
  readonly producerId: string;
  readonly buildSnapshot: () => SnapshotObject;
};

export type IntelligenceGrowthEvalReplaySnapshotOptions = {
  readonly fixture?: IntelligenceGrowthEvalReplaySnapshotFixture;
  readonly producers?: readonly IntelligenceGrowthEvalReplaySnapshotProducer[];
};

export type IntelligenceGrowthEvalReplaySnapshotSummary = {
  readonly passed: boolean;
  readonly version: string;
  readonly expectedSnapshotCount: number;
  readonly actualSnapshotCount: number;
  readonly snapshotCoveragePercent: number;
  readonly missingSnapshotCount: number;
  readonly unexpectedSnapshotCount: number;
  readonly duplicateExpectedSnapshotCount: number;
  readonly snapshotMismatchCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly {
    readonly producerId: string;
    readonly reason: string;
  }[];
};

const DEFAULT_FIXTURE = snapshotFixtureData as unknown as IntelligenceGrowthEvalReplaySnapshotFixture;

const DEFAULT_PRODUCERS: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
  {
    producerId: "core_eval",
    buildSnapshot: () => {
      const report = runEval();
      return {
        passed: report.summary.totalFailed === 0,
        dimensionCount: report.dimensions.length,
        total: report.summary.total,
        totalPassed: report.summary.totalPassed,
        totalFailed: report.summary.totalFailed,
        boundaryViolationCount: report.dimensions.reduce((sum, item) => sum + item.boundaryViolations, 0),
        autoPromoteCount: report.summary.autoPromoteCount,
        productionWriteCount: report.summary.productionWriteCount,
        runtimeAdoptionAllowed: report.summary.runtimeAdoptionAllowed,
        reviewFirstStatus: report.summary.reviewFirstStatus,
        failureCount: report.failures.length,
      };
    },
  },
  {
    producerId: "tenant_signal",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthTenantSignalEval(), [
      "passed",
      "totalCases",
      "dimensionCount",
      "mustPushItemCount",
      "reviewRequiredActionCount",
      "workerInstructionCount",
      "learningCandidateCount",
      "invalidMustPushItemCount",
      "rawPayloadEchoCount",
      "workerForbiddenActionLeakCount",
      "autoExecutionAttemptCount",
      "officialWriteAttemptCount",
      "canonicalMemoryWriteCount",
      "scopeViolationCount",
      "averageReviewerEvidenceCoveragePercent",
      "failureCount",
    ]),
  },
  {
    producerId: "review_packet",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthReviewPacketEval(), [
      "passed",
      "totalPackets",
      "dimensionCount",
      "readyForFounderReviewCount",
      "needsRequiredReviewCount",
      "blockedCount",
      "founderApprovalCoveragePercent",
      "requiredReviewerCoveragePercent",
      "evidenceCoveragePercent",
      "scopeViolationCount",
      "promotionAuthorityLeakCount",
      "runtimeAuthorityLeakCount",
      "packetCompletenessPercent",
      "failureCount",
    ]),
  },
  {
    producerId: "weekly_scorecard",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthWeeklyScorecardEval(), [
      "passed",
      "totalPackets",
      "readyForFounderReviewCount",
      "needsRequiredReviewCount",
      "blockedCount",
      "requiredReviewerCoveragePercent",
      "evidenceCoveragePercent",
      "boundaryIncidentCount",
      "promotionAuthorityLeakCount",
      "runtimeAuthorityLeakCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "decision_outcome",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthDecisionOutcomeEval(), [
      "passed",
      "totalDecisionRecords",
      "founderDecisionQueueCount",
      "decisionCoveragePercent",
      "missingDecisionCount",
      "duplicateDecisionCount",
      "blockedDecisionCount",
      "unauthorizedProductionChangeCount",
      "rawCustomerDataIncidentCount",
      "evidenceCoveragePercent",
      "reviewerCoveragePercent",
      "nextLearningCandidateCount",
      "invalidDecisionCount",
      "ownerCoveragePercent",
      "boundaryNoteCoveragePercent",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "learning_requeue",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthLearningRequeueEval(), [
      "passed",
      "totalCandidates",
      "expectedCandidateCount",
      "candidateCoveragePercent",
      "missingCandidateCount",
      "duplicateCandidateCount",
      "blockedDecisionCandidateCount",
      "statusMismatchCount",
      "scopeMismatchCount",
      "unauthorizedFlagCount",
      "rawCustomerDataIncidentCount",
      "evidenceCoveragePercent",
      "ownerCoveragePercent",
      "boundaryNoteCoveragePercent",
      "unexpectedCandidateCount",
      "sourcePacketMismatchCount",
      "invalidStatusCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "chain_integrity",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthChainIntegrityEval(), [
      "passed",
      "expectedChainCount",
      "executionMode",
      "stageCounts",
      "continuityPass",
      "totalBoundaryIncidentCount",
      "totalUnauthorizedIncidentCount",
      "totalRawDataIncidentCount",
      "totalScopeMismatchCount",
      "minimumCoveragePercent",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "cycle_advance",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthCycleAdvanceEval(), [
      "passed",
      "totalIntakeCandidates",
      "expectedIntakeCandidateCount",
      "intakeCoveragePercent",
      "duplicateIntakeIdCount",
      "missingIntakeCandidateCount",
      "unexpectedIntakeCandidateCount",
      "sourceCandidateMismatchCount",
      "sourcePacketMismatchCount",
      "statusMismatchCount",
      "scopeMismatchCount",
      "windowMismatchCount",
      "unauthorizedFlagCount",
      "rawCustomerDataIncidentCount",
      "evidenceCoveragePercent",
      "ownerCoveragePercent",
      "boundaryNoteCoveragePercent",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "fixture_lint",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthFixtureLintEval(), [
      "passed",
      "coreFixtureCaseCount",
      "expectedCoreFixtureCaseCount",
      "coreDimensionCount",
      "tenantSignalCaseCount",
      "decisionOutcomeRecordCount",
      "learningRequeueCandidateCount",
      "duplicateIdCount",
      "missingIdCount",
      "invalidDimensionCount",
      "invalidDecisionCount",
      "invalidBoundaryViolationCount",
      "missingEvidenceCount",
      "missingOwnerCount",
      "missingBoundaryNoteCount",
      "scopeMismatchCount",
      "windowMismatchCount",
      "orphanReviewPacketReferenceCount",
      "orphanDecisionReferenceCount",
      "orphanRequeueReferenceCount",
      "missingRequeueCandidateCount",
      "unauthorizedFlagCount",
      "rawCustomerDataIncidentCount",
      "failureCount",
    ]),
  },
  {
    producerId: "dimension_saturation",
    buildSnapshot: () => {
      const summary = runIntelligenceGrowthDimensionSaturationEval();
      return {
        ...pickSnapshot(summary, [
          "passed",
          "totalIntakeCandidates",
          "expectedDimensionCount",
          "coveredDimensionCount",
          "dimensionCoveragePercent",
          "duplicateDimensionCount",
          "maxDimensionCandidateCount",
          "unauthorizedFlagCount",
          "rawCustomerDataIncidentCount",
          "candidateOnly",
          "runtimeAllowed",
          "officialWriteAllowed",
          "autoExecutionAllowed",
          "canonicalMemoryWriteAllowed",
          "promptOrPolicyUpdateAllowed",
          "skillAutoPromotionAllowed",
          "failureCount",
        ]),
        missingDimensionCount: summary.missingDimensions.length,
      };
    },
  },
  {
    producerId: "remediation_roundtrip",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthRemediationRoundtripEval(), [
      "passed",
      "totalDecisionRecords",
      "continueDecisionCount",
      "reviseDecisionCount",
      "blockedDecisionCount",
      "stopDecisionCount",
      "readyForFounderReviewCount",
      "needsRequiredReviewCount",
      "reviewRequiredCount",
      "archivedCount",
      "statusRoundtripMismatchCount",
      "blockedResurrectionCount",
      "stoppedResurrectionCount",
      "missingCandidateCount",
      "missingIntakeCandidateCount",
      "sourcePacketMismatchCount",
      "evidenceContinuityMismatchCount",
      "ownerContinuityMismatchCount",
      "missingBoundaryNoteCount",
      "scopeMismatchCount",
      "windowMismatchCount",
      "unauthorizedFlagCount",
      "rawCustomerDataIncidentCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "budget_gate",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthBudgetGateEval(), [
      "passed",
      "totalBudgetRecords",
      "expectedCandidateCount",
      "budgetCoveragePercent",
      "missingBudgetEnvelopeCount",
      "unexpectedBudgetEnvelopeCount",
      "duplicateBudgetRecordCount",
      "malformedBudgetEnvelopeCount",
      "dimensionMismatchCount",
      "sourcePacketMismatchCount",
      "overBudgetCandidateCount",
      "modelTierEscalationCount",
      "toolOutsideAllowlistCount",
      "placeholderJustificationCount",
      "scopeMismatchCount",
      "windowMismatchCount",
      "unauthorizedFlagCount",
      "rawCustomerDataIncidentCount",
      "aggregateModelCallMax",
      "aggregateModelCallsObserved",
      "aggregateInputTokenMax",
      "aggregateInputTokensObserved",
      "aggregateOutputTokenMax",
      "aggregateOutputTokensObserved",
      "aggregateToolCallMax",
      "aggregateToolCallsObserved",
      "aggregateWallclockMsMax",
      "aggregateWallclockMsObserved",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "boundary_static",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthBoundaryStaticEval(), [
      "passed",
      "scannedFileCount",
      "forbiddenImportCount",
      "forbiddenEnvCount",
      "forbiddenNetworkCount",
      "forbiddenAppApiReferenceCount",
      "forbiddenDatabaseReferenceCount",
      "forbiddenProductionQueryReferenceCount",
      "forbiddenRuntimeReferenceCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "schema_drift",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthSchemaDriftEval(), [
      "passed",
      "baselineVersion",
      "dimensionParityOk",
      "decisionParityOk",
      "boundaryParityOk",
      "trackedSummaryCount",
      "summaryKeySetMismatchCount",
      "authorityFlagWrongValueCount",
      "fixtureKeySetMismatchCount",
      "fixtureExpectedKeySetMismatchCount",
      "snapshotVersionPinned",
      "snapshotVersionMismatchCount",
      "unionLiteralParseFailureCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "failure_taxonomy_coverage",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthFailureTaxonomyCoverageEval(), [
      "passed",
      "dimensionCount",
      "expectedDimensionCount",
      "taxonomyRowCount",
      "expectedTaxonomyRowCount",
      "negativeFixtureCount",
      "mappedNegativeFixtureCount",
      "negativeFixtureCoveragePercent",
      "unmappedNegativeFixtureCount",
      "orphanMappingCount",
      "unknownFailureTypeCount",
      "positiveFixtureMappingCount",
      "malformedTaxonomyRowCount",
      "duplicateFailureTypeCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "data_protection_manifest",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthDataProtectionManifestEval(), [
      "passed",
      "manifestVersion",
      "dimensionCount",
      "expectedDimensionCount",
      "scannedFixtureFileCount",
      "expectedScannedFixtureFileCount",
      "scannedFieldCount",
      "manifestCoveragePercent",
      "unmanifestedFieldCount",
      "unauthorizedFieldCount",
      "rawPIIIncidentCount",
      "rawCredentialIncidentCount",
      "rdsHostnameLeakCount",
      "aliasConsistencyMismatchCount",
      "retentionWindowMissingCount",
      "lawfulBasisMissingCount",
      "redactionMethodMissingCount",
      "dpReviewStatusApprovedWithoutReceiptCount",
      "signoffReceiptForgeryCount",
      "crossTenantLeakCount",
      "runtimeAuthorityFlagCount",
      "canonicalMemoryWriteFlagCount",
      "skillPromotionFlagCount",
      "unauthorizedFlagCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "failureCount",
    ]),
  },
  {
    producerId: "approval_readiness",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthApprovalReadinessEval(), [
      "passed",
      "version",
      "tenantKey",
      "workspaceId",
      "cycleWindowKey",
      "totalPackets",
      "expectedPacketCount",
      "dimensionCount",
      "expectedDimensionCount",
      "p1OrAbovePacketCount",
      "pendingPacketCount",
      "approvedPacketCount",
      "blockedPacketCount",
      "missingFounderApprovalCount",
      "missingReviewerRoleCount",
      "missingDataProtectionLinkCount",
      "approvedWithoutReceiptCount",
      "receiptForgeryCount",
      "staleEvidenceCount",
      "missingEvidenceCount",
      "crossTenantScopeCount",
      "customerTenantUpgradeAttemptCount",
      "liveCalibrationFlagCount",
      "runtimeAuthorityFlagCount",
      "officialWriteFlagCount",
      "autoExecutionFlagCount",
      "canonicalMemoryWriteFlagCount",
      "promptOrPolicyUpdateFlagCount",
      "skillAutoPromotionFlagCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "liveCalibrationAllowed",
      "founderOrReviewerApprovalImplied",
      "failureCount",
    ]),
  },
  {
    producerId: "live_calibration_preflight",
    buildSnapshot: () => pickSnapshot(runIntelligenceGrowthLiveCalibrationPreflightEval(), [
      "passed",
      "version",
      "tenantKey",
      "workspaceId",
      "cycleWindowKey",
      "totalPackages",
      "expectedPackageCount",
      "dimensionCount",
      "expectedDimensionCount",
      "duplicatePackageCount",
      "duplicateDimensionCount",
      "unknownDimensionCount",
      "missingRedactionProofCount",
      "rawDataIndicatorCount",
      "rawPIIIncidentCount",
      "rawCredentialIncidentCount",
      "rdsHostnameLeakCount",
      "missingSourceRefCount",
      "missingEvidenceRefCount",
      "staleEvidenceCount",
      "missingDataProtectionRefCount",
      "invalidCalibrationWindowCount",
      "missingOwnerLinkCount",
      "missingReviewerLinkCount",
      "crossTenantScopeCount",
      "customerTenantUpgradeAttemptCount",
      "liveCalibrationAuthorityFlagCount",
      "runtimeAuthorityFlagCount",
      "officialWriteFlagCount",
      "autoExecutionFlagCount",
      "canonicalMemoryWriteFlagCount",
      "promptOrPolicyUpdateFlagCount",
      "skillAutoPromotionFlagCount",
      "candidateOnly",
      "runtimeAllowed",
      "officialWriteAllowed",
      "autoExecutionAllowed",
      "canonicalMemoryWriteAllowed",
      "promptOrPolicyUpdateAllowed",
      "skillAutoPromotionAllowed",
      "liveCalibrationAuthorityAllowed",
      "liveCalibrationApprovalImplied",
      "runtimeAdoptionImplied",
      "failureCount",
    ]),
  },
];

export function runIntelligenceGrowthEvalReplaySnapshotEval(
  options: IntelligenceGrowthEvalReplaySnapshotOptions = {},
): IntelligenceGrowthEvalReplaySnapshotSummary {
  const fixture = options.fixture ?? DEFAULT_FIXTURE;
  const producers = options.producers ?? DEFAULT_PRODUCERS;
  const expectedByProducerId = new Map<string, SnapshotObject>();
  const expectedProducerIds = new Set<string>();
  const actualProducerIds = new Set(producers.map((producer) => producer.producerId));
  const failures: { producerId: string; reason: string }[] = [];

  for (const snapshot of fixture.snapshots) {
    if (expectedByProducerId.has(snapshot.producerId)) {
      failures.push({ producerId: snapshot.producerId, reason: "duplicate_expected_snapshot" });
      continue;
    }
    expectedByProducerId.set(snapshot.producerId, snapshot.expected);
    expectedProducerIds.add(snapshot.producerId);
  }

  const actualSnapshots = producers.map((producer) => ({
    producerId: producer.producerId,
    actual: producer.buildSnapshot(),
  }));

  for (const producer of actualSnapshots) {
    const expected = expectedByProducerId.get(producer.producerId);
    if (!expected) {
      failures.push({ producerId: producer.producerId, reason: "missing_expected_snapshot" });
      continue;
    }
    if (stringifyCanonical(expected) !== stringifyCanonical(producer.actual)) {
      failures.push({ producerId: producer.producerId, reason: "snapshot_mismatch" });
    }
    if (hasUnauthorizedFlag(producer.actual)) {
      failures.push({ producerId: producer.producerId, reason: "unauthorized_flag" });
    }
    if (hasRawDataIncident(producer.actual)) {
      failures.push({ producerId: producer.producerId, reason: "raw_customer_data_incident" });
    }
  }

  for (const producerId of expectedProducerIds) {
    if (!actualProducerIds.has(producerId)) {
      failures.push({ producerId, reason: "unexpected_expected_snapshot" });
    }
  }

  if (fixture.expectedSnapshotCount !== fixture.snapshots.length) {
    failures.push({ producerId: "__fixture__", reason: "expected_snapshot_count_mismatch" });
  }
  if (fixture.expectedSnapshotCount !== producers.length) {
    failures.push({ producerId: "__producer__", reason: "producer_count_mismatch" });
  }

  const uniqueFailures = deduplicateFailures(failures);
  const matchingSnapshotCount = actualSnapshots.filter((snapshot) => {
    const expected = expectedByProducerId.get(snapshot.producerId);
    return expected && stringifyCanonical(expected) === stringifyCanonical(snapshot.actual);
  }).length;

  return {
    passed: uniqueFailures.length === 0,
    version: fixture.version,
    expectedSnapshotCount: fixture.expectedSnapshotCount,
    actualSnapshotCount: producers.length,
    snapshotCoveragePercent: percent(matchingSnapshotCount, fixture.expectedSnapshotCount),
    missingSnapshotCount: uniqueFailures.filter((failure) => failure.reason === "missing_expected_snapshot").length,
    unexpectedSnapshotCount: uniqueFailures.filter((failure) =>
      failure.reason === "unexpected_expected_snapshot",
    ).length,
    duplicateExpectedSnapshotCount: uniqueFailures.filter((failure) =>
      failure.reason === "duplicate_expected_snapshot",
    ).length,
    snapshotMismatchCount: uniqueFailures.filter((failure) => failure.reason === "snapshot_mismatch").length,
    unauthorizedFlagCount: uniqueFailures.filter((failure) => failure.reason === "unauthorized_flag").length,
    rawCustomerDataIncidentCount: uniqueFailures.filter((failure) =>
      failure.reason === "raw_customer_data_incident",
    ).length,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failures: uniqueFailures,
  };
}

function pickSnapshot(source: Record<string, unknown>, keys: readonly string[]): SnapshotObject {
  const result: Record<string, SnapshotValue> = {};
  for (const key of keys) {
    if (key === "failureCount") {
      const failures = source.failures;
      result.failureCount = Array.isArray(failures) ? failures.length : 0;
      continue;
    }
    const value = source[key];
    if (value !== undefined) {
      result[key] = normalizeSnapshotValue(value);
    }
  }
  return result;
}

function normalizeSnapshotValue(value: unknown): SnapshotValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeSnapshotValue);
  }
  if (typeof value === "object") {
    const output: Record<string, SnapshotValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      output[key] = normalizeSnapshotValue((value as Record<string, unknown>)[key]);
    }
    return output;
  }
  return null;
}

function hasUnauthorizedFlag(snapshot: SnapshotObject): boolean {
  for (const [key, value] of Object.entries(snapshot)) {
    const normalizedKey = key.toLowerCase();
    if (isExplicitAuthorityFlag(normalizedKey) && value === true) {
      return true;
    }
    if (isAuthorityIncidentMetric(normalizedKey) && isNonZeroMetric(value)) {
      return true;
    }
    if (value && typeof value === "object" && !Array.isArray(value) && hasUnauthorizedFlag(value as SnapshotObject)) {
      return true;
    }
  }
  return false;
}

function hasRawDataIncident(snapshot: SnapshotObject): boolean {
  for (const [key, value] of Object.entries(snapshot)) {
    const normalizedKey = key.toLowerCase();
    if (isRawDataIncidentMetric(normalizedKey) && isNonZeroMetric(value)) {
      return true;
    }
    if (value && typeof value === "object" && !Array.isArray(value) && hasRawDataIncident(value as SnapshotObject)) {
      return true;
    }
  }
  return false;
}

function isExplicitAuthorityFlag(key: string): boolean {
  return [
    "runtimeallowed",
    "officialwriteallowed",
    "autoexecutionallowed",
    "canonicalmemorywriteallowed",
    "promptorpolicyupdateallowed",
    "skillautopromotionallowed",
    "runtimeadoptionallowed",
  ].includes(key);
}

function isAuthorityIncidentMetric(key: string): boolean {
  return key.includes("unauthorized") ||
    key.includes("authorityleak") ||
    key === "productionwritecount" ||
    key === "autopromotecount";
}

function isRawDataIncidentMetric(key: string): boolean {
  return key.includes("raw") && (key.includes("incident") || key.includes("payloadecho"));
}

function isNonZeroMetric(value: SnapshotValue): boolean {
  return value !== undefined && value !== null && value !== false && value !== 0;
}

function stringifyCanonical(value: unknown): string {
  return JSON.stringify(normalizeSnapshotValue(value));
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

function deduplicateFailures(
  failures: readonly { readonly producerId: string; readonly reason: string }[],
): readonly { readonly producerId: string; readonly reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.producerId}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
