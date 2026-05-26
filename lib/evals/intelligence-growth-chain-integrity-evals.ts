import {
  runIntelligenceGrowthDecisionOutcomeEval,
  type IntelligenceGrowthDecisionOutcomeEvalSummary,
} from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import {
  runIntelligenceGrowthLearningRequeueEval,
  type IntelligenceGrowthLearningRequeueEvalSummary,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import {
  runIntelligenceGrowthReviewPacketEval,
  type IntelligenceGrowthReviewPacketEvalSummary,
} from "@/lib/evals/intelligence-growth-review-packet-evals";
import {
  runIntelligenceGrowthTenantSignalEval,
  type IntelligenceGrowthTenantSignalEvalSummary,
} from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import {
  runIntelligenceGrowthWeeklyScorecardEval,
  type IntelligenceGrowthWeeklyScorecardSummary,
} from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";

const EXPECTED_TENANT_KEY = "helm-business-development";
const EXPECTED_WORKSPACE_ID = "workspace_helm_business_development";
const EXPECTED_SOURCE_WINDOW_KEY = "2026-W18";
const EXPECTED_NEXT_WINDOW_KEY = "2026-W19";
const EXPECTED_CHAIN_COUNT = 10;

export type IntelligenceGrowthChainStageSummaries = {
  readonly tenantSignal: IntelligenceGrowthTenantSignalEvalSummary;
  readonly reviewPacket: IntelligenceGrowthReviewPacketEvalSummary;
  readonly weeklyScorecard: IntelligenceGrowthWeeklyScorecardSummary;
  readonly decisionOutcome: IntelligenceGrowthDecisionOutcomeEvalSummary;
  readonly learningRequeue: IntelligenceGrowthLearningRequeueEvalSummary;
};

export type IntelligenceGrowthChainIntegrityEvalOptions = {
  readonly summaries?: IntelligenceGrowthChainStageSummaries;
  readonly allowInjectedSummariesForTesting?: boolean;
};

export type IntelligenceGrowthChainIntegrityFailure = {
  readonly stage: keyof IntelligenceGrowthChainStageSummaries | "chain";
  readonly reason: string;
};

export type IntelligenceGrowthChainIntegrityEvalSummary = {
  readonly passed: boolean;
  readonly version: "intelligence-growth-chain-integrity-phase0";
  readonly tenantKey: typeof EXPECTED_TENANT_KEY;
  readonly workspaceId: typeof EXPECTED_WORKSPACE_ID;
  readonly sourceWindowKey: typeof EXPECTED_SOURCE_WINDOW_KEY;
  readonly nextWindowKey: typeof EXPECTED_NEXT_WINDOW_KEY;
  readonly expectedChainCount: typeof EXPECTED_CHAIN_COUNT;
  readonly executionMode: "native" | "injected_for_test";
  readonly stageCounts: {
    readonly tenantSignals: number;
    readonly reviewPackets: number;
    readonly weeklyPackets: number;
    readonly decisionOutcomes: number;
    readonly expectedLearningCandidates: number;
    readonly learningRequeueCandidates: number;
  };
  readonly continuityPass: boolean;
  readonly totalBoundaryIncidentCount: number;
  readonly totalUnauthorizedIncidentCount: number;
  readonly totalRawDataIncidentCount: number;
  readonly totalScopeMismatchCount: number;
  readonly minimumCoveragePercent: number;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly IntelligenceGrowthChainIntegrityFailure[];
};

export function runIntelligenceGrowthChainIntegrityEval(
  options: IntelligenceGrowthChainIntegrityEvalOptions = {},
): IntelligenceGrowthChainIntegrityEvalSummary {
  const stageSummaries = options.summaries ?? runDefaultStageSummaries();
  const failures: IntelligenceGrowthChainIntegrityFailure[] = [];
  const executionMode = options.summaries ? "injected_for_test" : "native";

  if (options.summaries && !options.allowInjectedSummariesForTesting) {
    failures.push({ stage: "chain", reason: "injected_summaries_not_allowed_without_test_flag" });
  }

  assertStagePassed(failures, "tenantSignal", stageSummaries.tenantSignal.passed);
  assertStagePassed(failures, "reviewPacket", stageSummaries.reviewPacket.passed);
  assertStagePassed(failures, "weeklyScorecard", stageSummaries.weeklyScorecard.passed);
  assertStagePassed(failures, "decisionOutcome", stageSummaries.decisionOutcome.passed);
  assertStagePassed(failures, "learningRequeue", stageSummaries.learningRequeue.passed);

  const stageCounts = {
    tenantSignals: stageSummaries.tenantSignal.totalCases,
    reviewPackets: stageSummaries.reviewPacket.totalPackets,
    weeklyPackets: stageSummaries.weeklyScorecard.totalPackets,
    decisionOutcomes: stageSummaries.decisionOutcome.totalDecisionRecords,
    expectedLearningCandidates: stageSummaries.learningRequeue.expectedCandidateCount,
    learningRequeueCandidates: stageSummaries.learningRequeue.totalCandidates,
  };

  assertEqual(failures, "chain", "tenant_signal_count", stageCounts.tenantSignals, EXPECTED_CHAIN_COUNT);
  assertEqual(failures, "chain", "review_packet_count", stageCounts.reviewPackets, EXPECTED_CHAIN_COUNT);
  assertEqual(failures, "chain", "weekly_packet_count", stageCounts.weeklyPackets, EXPECTED_CHAIN_COUNT);
  assertEqual(failures, "chain", "decision_outcome_count", stageCounts.decisionOutcomes, EXPECTED_CHAIN_COUNT);
  assertEqual(
    failures,
    "chain",
    "learning_requeue_candidate_count",
    stageCounts.learningRequeueCandidates,
    EXPECTED_CHAIN_COUNT,
  );
  assertEqual(
    failures,
    "chain",
    "review_packets_match_tenant_signals",
    stageCounts.reviewPackets,
    stageCounts.tenantSignals,
  );
  assertEqual(
    failures,
    "chain",
    "weekly_packets_match_review_packets",
    stageCounts.weeklyPackets,
    stageCounts.reviewPackets,
  );
  assertEqual(
    failures,
    "chain",
    "decision_outcomes_match_weekly_founder_queue",
    stageCounts.decisionOutcomes,
    stageSummaries.weeklyScorecard.founderDecisionQueue.length,
  );
  assertEqual(
    failures,
    "chain",
    "decision_founder_queue_match_weekly_founder_queue",
    stageSummaries.decisionOutcome.founderDecisionQueueCount,
    stageSummaries.weeklyScorecard.founderDecisionQueue.length,
  );
  assertEqual(
    failures,
    "chain",
    "expected_learning_candidates_match_decision_outputs",
    stageCounts.expectedLearningCandidates,
    stageSummaries.decisionOutcome.nextLearningCandidateCount,
  );
  assertEqual(
    failures,
    "chain",
    "learning_requeue_matches_expected_candidates",
    stageCounts.learningRequeueCandidates,
    stageCounts.expectedLearningCandidates,
  );

  assertScope(failures, stageSummaries);
  assertNoAuthorityLeaks(failures, stageSummaries);
  assertCoverage(failures, stageSummaries);

  const totalBoundaryIncidentCount = stageSummaries.weeklyScorecard.boundaryIncidentCount;
  const totalUnauthorizedIncidentCount =
    stageSummaries.tenantSignal.autoExecutionAttemptCount +
    stageSummaries.tenantSignal.officialWriteAttemptCount +
    stageSummaries.tenantSignal.canonicalMemoryWriteCount +
    stageSummaries.reviewPacket.promotionAuthorityLeakCount +
    stageSummaries.reviewPacket.runtimeAuthorityLeakCount +
    stageSummaries.weeklyScorecard.promotionAuthorityLeakCount +
    stageSummaries.weeklyScorecard.runtimeAuthorityLeakCount +
    stageSummaries.decisionOutcome.unauthorizedProductionChangeCount +
    stageSummaries.learningRequeue.unauthorizedFlagCount;
  const totalRawDataIncidentCount =
    stageSummaries.tenantSignal.rawPayloadEchoCount +
    stageSummaries.decisionOutcome.rawCustomerDataIncidentCount +
    stageSummaries.learningRequeue.rawCustomerDataIncidentCount;
  const totalScopeMismatchCount = countScopeMismatches(stageSummaries);
  const minimumCoveragePercent = Math.min(
    stageSummaries.tenantSignal.averageReviewerEvidenceCoveragePercent,
    stageSummaries.reviewPacket.founderApprovalCoveragePercent,
    stageSummaries.reviewPacket.requiredReviewerCoveragePercent,
    stageSummaries.reviewPacket.evidenceCoveragePercent,
    stageSummaries.reviewPacket.packetCompletenessPercent,
    stageSummaries.weeklyScorecard.requiredReviewerCoveragePercent,
    stageSummaries.weeklyScorecard.evidenceCoveragePercent,
    stageSummaries.decisionOutcome.decisionCoveragePercent,
    stageSummaries.decisionOutcome.evidenceCoveragePercent,
    stageSummaries.decisionOutcome.reviewerCoveragePercent,
    stageSummaries.decisionOutcome.ownerCoveragePercent,
    stageSummaries.decisionOutcome.boundaryNoteCoveragePercent,
    stageSummaries.learningRequeue.candidateCoveragePercent,
    stageSummaries.learningRequeue.evidenceCoveragePercent,
    stageSummaries.learningRequeue.ownerCoveragePercent,
    stageSummaries.learningRequeue.boundaryNoteCoveragePercent,
  );

  assertZero(failures, "chain", "total_boundary_incident_count", totalBoundaryIncidentCount);
  assertZero(failures, "chain", "total_unauthorized_incident_count", totalUnauthorizedIncidentCount);
  assertZero(failures, "chain", "total_raw_data_incident_count", totalRawDataIncidentCount);
  assertZero(failures, "chain", "total_scope_mismatch_count", totalScopeMismatchCount);

  const continuityPass = hasCountContinuity(stageCounts, stageSummaries);
  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    version: "intelligence-growth-chain-integrity-phase0",
    tenantKey: EXPECTED_TENANT_KEY,
    workspaceId: EXPECTED_WORKSPACE_ID,
    sourceWindowKey: EXPECTED_SOURCE_WINDOW_KEY,
    nextWindowKey: EXPECTED_NEXT_WINDOW_KEY,
    expectedChainCount: EXPECTED_CHAIN_COUNT,
    executionMode,
    stageCounts,
    continuityPass,
    totalBoundaryIncidentCount,
    totalUnauthorizedIncidentCount,
    totalRawDataIncidentCount,
    totalScopeMismatchCount,
    minimumCoveragePercent,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failures: uniqueFailures,
  };
}

function runDefaultStageSummaries(): IntelligenceGrowthChainStageSummaries {
  return {
    tenantSignal: runIntelligenceGrowthTenantSignalEval(),
    reviewPacket: runIntelligenceGrowthReviewPacketEval(),
    weeklyScorecard: runIntelligenceGrowthWeeklyScorecardEval(),
    decisionOutcome: runIntelligenceGrowthDecisionOutcomeEval(),
    learningRequeue: runIntelligenceGrowthLearningRequeueEval(),
  };
}

function assertStagePassed(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  stage: keyof IntelligenceGrowthChainStageSummaries,
  passed: boolean,
): void {
  if (!passed) {
    failures.push({ stage, reason: "stage_failed" });
  }
}

function assertEqual(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  stage: IntelligenceGrowthChainIntegrityFailure["stage"],
  label: string,
  actual: number,
  expected: number,
): void {
  if (actual !== expected) {
    failures.push({ stage, reason: `${label}_mismatch:expected_${expected}_got_${actual}` });
  }
}

function hasCountContinuity(
  stageCounts: IntelligenceGrowthChainIntegrityEvalSummary["stageCounts"],
  summaries: IntelligenceGrowthChainStageSummaries,
): boolean {
  return (
    stageCounts.tenantSignals === EXPECTED_CHAIN_COUNT &&
    stageCounts.reviewPackets === EXPECTED_CHAIN_COUNT &&
    stageCounts.weeklyPackets === EXPECTED_CHAIN_COUNT &&
    stageCounts.decisionOutcomes === EXPECTED_CHAIN_COUNT &&
    stageCounts.learningRequeueCandidates === EXPECTED_CHAIN_COUNT &&
    stageCounts.reviewPackets === stageCounts.tenantSignals &&
    stageCounts.weeklyPackets === stageCounts.reviewPackets &&
    stageCounts.decisionOutcomes === summaries.weeklyScorecard.founderDecisionQueue.length &&
    summaries.decisionOutcome.founderDecisionQueueCount === summaries.weeklyScorecard.founderDecisionQueue.length &&
    stageCounts.expectedLearningCandidates === summaries.decisionOutcome.nextLearningCandidateCount &&
    stageCounts.learningRequeueCandidates === stageCounts.expectedLearningCandidates
  );
}

function assertZero(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  stage: IntelligenceGrowthChainIntegrityFailure["stage"],
  label: string,
  value: number,
): void {
  if (value !== 0) {
    failures.push({ stage, reason: `${label}:${value}` });
  }
}

function assertScope(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  summaries: IntelligenceGrowthChainStageSummaries,
): void {
  assertZero(failures, "tenantSignal", "scope_violation_count", summaries.tenantSignal.scopeViolationCount);
  assertZero(
    failures,
    "tenantSignal",
    "case_scope_mismatch_count",
    countTenantSignalCaseScopeMismatches(summaries),
  );
  assertZero(failures, "reviewPacket", "scope_violation_count", summaries.reviewPacket.scopeViolationCount);
  assertZero(
    failures,
    "reviewPacket",
    "packet_scope_mismatch_count",
    countReviewPacketScopeMismatches(summaries),
  );
  assertEqualScope(failures, "weeklyScorecard", "tenant_key", summaries.weeklyScorecard.tenantKey, EXPECTED_TENANT_KEY);
  assertEqualScope(failures, "weeklyScorecard", "workspace_id", summaries.weeklyScorecard.workspaceId, EXPECTED_WORKSPACE_ID);
  assertEqualScope(failures, "weeklyScorecard", "source_window_key", summaries.weeklyScorecard.sourceWindowKey, EXPECTED_SOURCE_WINDOW_KEY);
  assertEqualScope(failures, "decisionOutcome", "tenant_key", summaries.decisionOutcome.tenantKey, EXPECTED_TENANT_KEY);
  assertEqualScope(failures, "decisionOutcome", "workspace_id", summaries.decisionOutcome.workspaceId, EXPECTED_WORKSPACE_ID);
  assertEqualScope(failures, "decisionOutcome", "source_window_key", summaries.decisionOutcome.sourceWindowKey, EXPECTED_SOURCE_WINDOW_KEY);
  assertEqualScope(failures, "learningRequeue", "tenant_key", summaries.learningRequeue.tenantKey, EXPECTED_TENANT_KEY);
  assertEqualScope(failures, "learningRequeue", "workspace_id", summaries.learningRequeue.workspaceId, EXPECTED_WORKSPACE_ID);
  assertEqualScope(failures, "learningRequeue", "source_window_key", summaries.learningRequeue.sourceWindowKey, EXPECTED_SOURCE_WINDOW_KEY);
  assertEqualScope(failures, "learningRequeue", "next_window_key", summaries.learningRequeue.nextWindowKey, EXPECTED_NEXT_WINDOW_KEY);
  assertZero(failures, "learningRequeue", "scope_mismatch_count", summaries.learningRequeue.scopeMismatchCount);
}

function assertEqualScope(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  stage: keyof IntelligenceGrowthChainStageSummaries,
  label: string,
  actual: string,
  expected: string,
): void {
  if (actual !== expected) {
    failures.push({ stage, reason: `${label}_scope_mismatch:expected_${expected}_got_${actual}` });
  }
}

function assertNoAuthorityLeaks(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  summaries: IntelligenceGrowthChainStageSummaries,
): void {
  assertZero(failures, "tenantSignal", "raw_payload_echo_count", summaries.tenantSignal.rawPayloadEchoCount);
  assertZero(
    failures,
    "tenantSignal",
    "worker_forbidden_action_leak_count",
    summaries.tenantSignal.workerForbiddenActionLeakCount,
  );
  assertZero(failures, "tenantSignal", "auto_execution_attempt_count", summaries.tenantSignal.autoExecutionAttemptCount);
  assertZero(failures, "tenantSignal", "official_write_attempt_count", summaries.tenantSignal.officialWriteAttemptCount);
  assertZero(failures, "tenantSignal", "canonical_memory_write_count", summaries.tenantSignal.canonicalMemoryWriteCount);
  assertZero(failures, "reviewPacket", "promotion_authority_leak_count", summaries.reviewPacket.promotionAuthorityLeakCount);
  assertZero(failures, "reviewPacket", "runtime_authority_leak_count", summaries.reviewPacket.runtimeAuthorityLeakCount);
  assertZero(
    failures,
    "reviewPacket",
    "packet_authority_flag_leak_count",
    countReviewPacketAuthorityFlagLeaks(summaries),
  );
  assertZero(failures, "weeklyScorecard", "boundary_incident_count", summaries.weeklyScorecard.boundaryIncidentCount);
  assertZero(failures, "weeklyScorecard", "promotion_authority_leak_count", summaries.weeklyScorecard.promotionAuthorityLeakCount);
  assertZero(failures, "weeklyScorecard", "runtime_authority_leak_count", summaries.weeklyScorecard.runtimeAuthorityLeakCount);
  assertZero(
    failures,
    "decisionOutcome",
    "unauthorized_production_change_count",
    summaries.decisionOutcome.unauthorizedProductionChangeCount,
  );
  assertZero(
    failures,
    "decisionOutcome",
    "raw_customer_data_incident_count",
    summaries.decisionOutcome.rawCustomerDataIncidentCount,
  );
  assertZero(failures, "learningRequeue", "unauthorized_flag_count", summaries.learningRequeue.unauthorizedFlagCount);
  assertZero(
    failures,
    "learningRequeue",
    "raw_customer_data_incident_count",
    summaries.learningRequeue.rawCustomerDataIncidentCount,
  );
  assertDisabledAuthorityFlags(failures, "weeklyScorecard", summaries.weeklyScorecard);
  assertDisabledAuthorityFlags(failures, "decisionOutcome", summaries.decisionOutcome);
  assertDisabledAuthorityFlags(failures, "learningRequeue", summaries.learningRequeue);
}

function countScopeMismatches(summaries: IntelligenceGrowthChainStageSummaries): number {
  return (
    summaries.tenantSignal.scopeViolationCount +
    countTenantSignalCaseScopeMismatches(summaries) +
    summaries.reviewPacket.scopeViolationCount +
    countReviewPacketScopeMismatches(summaries) +
    summaries.learningRequeue.scopeMismatchCount
  );
}

function countTenantSignalCaseScopeMismatches(
  summaries: IntelligenceGrowthChainStageSummaries,
): number {
  return summaries.tenantSignal.caseResults.filter((result) => {
    const pipelineCase = result.pipelineCase;
    return (
      pipelineCase.object.tenantKey !== EXPECTED_TENANT_KEY ||
      pipelineCase.object.workspaceId !== EXPECTED_WORKSPACE_ID ||
      pipelineCase.object.sourceWindowKey !== EXPECTED_SOURCE_WINDOW_KEY
    );
  }).length;
}

function countReviewPacketScopeMismatches(
  summaries: IntelligenceGrowthChainStageSummaries,
): number {
  return summaries.reviewPacket.packets.filter(
    (packet) =>
      packet.tenantKey !== EXPECTED_TENANT_KEY ||
      packet.workspaceId !== EXPECTED_WORKSPACE_ID ||
      !packet.scopeValid,
  ).length;
}

function countReviewPacketAuthorityFlagLeaks(
  summaries: IntelligenceGrowthChainStageSummaries,
): number {
  return summaries.reviewPacket.packets.filter(
    (packet) =>
      !packet.candidateOnly ||
      packet.runtimeAllowed ||
      packet.productionPromptChangeAllowed ||
      packet.ruleAutoUpdateAllowed ||
      packet.canonicalMemoryWriteAllowed ||
      packet.skillAutoPromotionAllowed ||
      packet.officialWriteAllowed ||
      packet.autoExecutionAllowed,
  ).length;
}

function assertDisabledAuthorityFlags(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  stage: "weeklyScorecard" | "decisionOutcome" | "learningRequeue",
  summary:
    | IntelligenceGrowthWeeklyScorecardSummary
    | IntelligenceGrowthDecisionOutcomeEvalSummary
    | IntelligenceGrowthLearningRequeueEvalSummary,
): void {
  if (!summary.candidateOnly) failures.push({ stage, reason: "candidate_only_flag_disabled" });
  if (summary.runtimeAllowed) failures.push({ stage, reason: "runtime_allowed" });
  if (summary.officialWriteAllowed) failures.push({ stage, reason: "official_write_allowed" });
  if (summary.autoExecutionAllowed) failures.push({ stage, reason: "auto_execution_allowed" });
  if ("canonicalMemoryWriteAllowed" in summary && summary.canonicalMemoryWriteAllowed) {
    failures.push({ stage, reason: "canonical_memory_write_allowed" });
  }
  if ("promptOrPolicyUpdateAllowed" in summary && summary.promptOrPolicyUpdateAllowed) {
    failures.push({ stage, reason: "prompt_or_policy_update_allowed" });
  }
  if ("skillAutoPromotionAllowed" in summary && summary.skillAutoPromotionAllowed) {
    failures.push({ stage, reason: "skill_auto_promotion_allowed" });
  }
}

function assertCoverage(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  summaries: IntelligenceGrowthChainStageSummaries,
): void {
  assertMinimumCoverage(
    failures,
    "tenantSignal",
    "reviewer_evidence_coverage",
    summaries.tenantSignal.averageReviewerEvidenceCoveragePercent,
  );
  assertMinimumCoverage(
    failures,
    "reviewPacket",
    "founder_approval_coverage",
    summaries.reviewPacket.founderApprovalCoveragePercent,
  );
  assertMinimumCoverage(
    failures,
    "reviewPacket",
    "required_reviewer_coverage",
    summaries.reviewPacket.requiredReviewerCoveragePercent,
  );
  assertMinimumCoverage(failures, "reviewPacket", "evidence_coverage", summaries.reviewPacket.evidenceCoveragePercent);
  assertMinimumCoverage(
    failures,
    "reviewPacket",
    "packet_completeness",
    summaries.reviewPacket.packetCompletenessPercent,
  );
  assertMinimumCoverage(
    failures,
    "weeklyScorecard",
    "required_reviewer_coverage",
    summaries.weeklyScorecard.requiredReviewerCoveragePercent,
  );
  assertMinimumCoverage(failures, "weeklyScorecard", "evidence_coverage", summaries.weeklyScorecard.evidenceCoveragePercent);
  assertMinimumCoverage(failures, "decisionOutcome", "decision_coverage", summaries.decisionOutcome.decisionCoveragePercent);
  assertMinimumCoverage(failures, "decisionOutcome", "evidence_coverage", summaries.decisionOutcome.evidenceCoveragePercent);
  assertMinimumCoverage(failures, "decisionOutcome", "reviewer_coverage", summaries.decisionOutcome.reviewerCoveragePercent);
  assertMinimumCoverage(failures, "decisionOutcome", "owner_coverage", summaries.decisionOutcome.ownerCoveragePercent);
  assertMinimumCoverage(
    failures,
    "decisionOutcome",
    "boundary_note_coverage",
    summaries.decisionOutcome.boundaryNoteCoveragePercent,
  );
  assertMinimumCoverage(
    failures,
    "learningRequeue",
    "candidate_coverage",
    summaries.learningRequeue.candidateCoveragePercent,
  );
  assertMinimumCoverage(failures, "learningRequeue", "evidence_coverage", summaries.learningRequeue.evidenceCoveragePercent);
  assertMinimumCoverage(failures, "learningRequeue", "owner_coverage", summaries.learningRequeue.ownerCoveragePercent);
  assertMinimumCoverage(
    failures,
    "learningRequeue",
    "boundary_note_coverage",
    summaries.learningRequeue.boundaryNoteCoveragePercent,
  );
}

function assertMinimumCoverage(
  failures: IntelligenceGrowthChainIntegrityFailure[],
  stage: keyof IntelligenceGrowthChainStageSummaries,
  label: string,
  value: number,
): void {
  if (value < 100) {
    failures.push({ stage, reason: `${label}:${value}` });
  }
}

function deduplicateFailures(
  failures: readonly IntelligenceGrowthChainIntegrityFailure[],
): readonly IntelligenceGrowthChainIntegrityFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.stage}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
