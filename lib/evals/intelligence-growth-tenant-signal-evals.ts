import fixturePack from "@/evals/intelligence-growth-tenant-signals/tenant-signal-cases.json";
import {
  evaluateBusinessAdvancementPipelineCase,
  type BusinessAdvancementPipelineCase,
  type BusinessAdvancementPipelineCaseResult,
  type BusinessAdvancementPipelineExpectedOutputs,
} from "@/lib/evals/business-advancement-signal-pipeline-evals";
import type { AudienceSignalDecision } from "@/lib/evals/audience-signal-evals";
import type {
  ObjectSignalDisposition,
  ObjectSignalSeverity,
} from "@/lib/evals/object-signal-validity-evals";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

export type IntelligenceGrowthTenantSignalCase = {
  readonly id: string;
  readonly dimension: IntelligenceDimension;
  readonly findingType: string;
  readonly description: string;
  readonly severity: ObjectSignalSeverity;
  readonly evidenceRefs: readonly string[];
  readonly evidenceFreshnessHours: number;
  readonly sourceCount: number;
  readonly ownerAlias: string | null;
  readonly nextAction: string | null;
  readonly boundaryNote: string | null;
  readonly reviewPosture: string | null;
  readonly outcomeMetric: string | null;
  readonly contradictoryEvidenceRefs?: readonly string[];
  readonly duplicateSignal?: boolean;
  readonly safeActionRequests: readonly string[];
  readonly unsafeActionRequests: readonly string[];
  readonly expectedValidityDisposition: ObjectSignalDisposition;
  readonly expectedFinalDisposition: ObjectSignalDisposition;
  readonly expectedAudienceDecision: AudienceSignalDecision;
  readonly expectedOutputs: BusinessAdvancementPipelineExpectedOutputs;
};

export type IntelligenceGrowthTenantSignalFixturePack = {
  readonly version: string;
  readonly status: string;
  readonly redactionPosture: string;
  readonly boundary: string;
  readonly targets: {
    readonly minimumTotalCases: number;
    readonly minimumMustPushItemCount: number;
    readonly maximumMustPushItemCount: number;
    readonly minimumReviewRequiredActionCount: number;
    readonly minimumLearningCandidateCount: number;
    readonly maximumInvalidMustPushItemCount: number;
    readonly maximumRawPayloadEchoCount: number;
    readonly maximumWorkerForbiddenActionLeakCount: number;
    readonly maximumAutoExecutionAttemptCount: number;
    readonly maximumOfficialWriteAttemptCount: number;
    readonly maximumCanonicalMemoryWriteCount: number;
    readonly maximumScopeViolationCount: number;
    readonly minimumReviewerEvidenceCoveragePercent: number;
  };
  readonly cases: readonly IntelligenceGrowthTenantSignalCase[];
};

export type IntelligenceGrowthTenantSignalCaseResult = {
  readonly caseId: string;
  readonly dimension: IntelligenceDimension;
  readonly findingType: string;
  readonly pipelineCase: BusinessAdvancementPipelineCase;
  readonly pipelineResult: BusinessAdvancementPipelineCaseResult;
};

export type IntelligenceGrowthTenantSignalEvalSummary = {
  readonly passed: boolean;
  readonly version: string;
  readonly totalCases: number;
  readonly dimensionCount: number;
  readonly mustPushItemCount: number;
  readonly reviewRequiredActionCount: number;
  readonly workerInstructionCount: number;
  readonly learningCandidateCount: number;
  readonly invalidMustPushItemCount: number;
  readonly rawPayloadEchoCount: number;
  readonly workerForbiddenActionLeakCount: number;
  readonly autoExecutionAttemptCount: number;
  readonly officialWriteAttemptCount: number;
  readonly canonicalMemoryWriteCount: number;
  readonly scopeViolationCount: number;
  readonly averageReviewerEvidenceCoveragePercent: number;
  readonly caseResults: readonly IntelligenceGrowthTenantSignalCaseResult[];
  readonly failures: readonly { readonly caseId: string; readonly reason: string }[];
};

const HELM_BUSINESS_DEVELOPMENT_TENANT_KEY = "helm-business-development";
const HELM_BUSINESS_DEVELOPMENT_WORKSPACE_ID = "workspace_helm_business_development";
const HELM_BUSINESS_DEVELOPMENT_SOURCE_PROVIDER = "helm_builtin_business_development";
const SOURCE_WINDOW_KEY = "2026-W18";

export function adaptIntelligenceGrowthTenantSignalToPipelineCase(
  item: IntelligenceGrowthTenantSignalCase,
): BusinessAdvancementPipelineCase {
  return {
    id: item.id,
    source: {
      kind: "report",
      ref: `igs:${item.dimension}:${item.id}`,
      redactionStatus: "synthetic",
      rawPayloadIncluded: false,
      provider: HELM_BUSINESS_DEVELOPMENT_SOURCE_PROVIDER,
    },
    object: {
      workspaceId: HELM_BUSINESS_DEVELOPMENT_WORKSPACE_ID,
      tenantKey: HELM_BUSINESS_DEVELOPMENT_TENANT_KEY,
      sourceWindowKey: SOURCE_WINDOW_KEY,
      objectType: "helm_business_development_intelligence_growth_item",
      objectId: `igs:${item.dimension}:${item.findingType}:${item.id}`,
      canonicalObjectRef: `helm-business-development:intelligence-growth:${item.dimension}:${item.findingType}`,
      identityStable: true,
      tenantMismatch: false,
      crossWorkspaceConflict: false,
    },
    signal: {
      signalKey: `helm_business_development_igs_${item.dimension}:${item.findingType}:${item.id}`,
      signalType: `helm_business_development_igs_${item.dimension}_${item.findingType}`,
      severity: item.severity,
      evidenceRefs: [...item.evidenceRefs],
      evidenceFreshnessHours: item.evidenceFreshnessHours,
      sourceCount: item.sourceCount,
      hasOwner: Boolean(item.ownerAlias),
      hasNextAction: Boolean(item.nextAction),
      hasBoundaryNote: Boolean(item.boundaryNote),
      hasReviewPosture: Boolean(item.reviewPosture),
      hasOutcomeMetric: Boolean(item.outcomeMetric),
      contradictoryEvidenceRefs: [...(item.contradictoryEvidenceRefs ?? [])],
      duplicateSignal: item.duplicateSignal ?? false,
      unsafeBoundary: false,
      llmFinalRanking: false,
      autoPromotion: false,
      officialWriteIntent: false,
    },
    safeActionRequests: [...item.safeActionRequests],
    unsafeActionRequests: [...item.unsafeActionRequests],
    expectedValidityDisposition: item.expectedValidityDisposition,
    expectedFinalDisposition: item.expectedFinalDisposition,
    expectedAudienceDecision: item.expectedAudienceDecision,
    expectedOutputs: item.expectedOutputs,
  };
}

export function evaluateIntelligenceGrowthTenantSignalCase(
  item: IntelligenceGrowthTenantSignalCase,
): IntelligenceGrowthTenantSignalCaseResult {
  const pipelineCase = adaptIntelligenceGrowthTenantSignalToPipelineCase(item);
  return {
    caseId: item.id,
    dimension: item.dimension,
    findingType: item.findingType,
    pipelineCase,
    pipelineResult: evaluateBusinessAdvancementPipelineCase(pipelineCase),
  };
}

export function isHelmBusinessDevelopmentTenantSignal(
  pipelineCase: BusinessAdvancementPipelineCase,
): boolean {
  return (
    pipelineCase.source.kind === "report" &&
    pipelineCase.source.provider === HELM_BUSINESS_DEVELOPMENT_SOURCE_PROVIDER &&
    pipelineCase.source.redactionStatus === "synthetic" &&
    !pipelineCase.source.rawPayloadIncluded &&
    pipelineCase.object.tenantKey === HELM_BUSINESS_DEVELOPMENT_TENANT_KEY &&
    pipelineCase.object.workspaceId === HELM_BUSINESS_DEVELOPMENT_WORKSPACE_ID &&
    pipelineCase.object.objectType === "helm_business_development_intelligence_growth_item" &&
    pipelineCase.object.canonicalObjectRef.startsWith("helm-business-development:intelligence-growth:") &&
    pipelineCase.signal.signalKey.startsWith("helm_business_development_igs_") &&
    pipelineCase.signal.signalType.startsWith("helm_business_development_igs_")
  );
}

export function runIntelligenceGrowthTenantSignalEval(
  pack: IntelligenceGrowthTenantSignalFixturePack =
    fixturePack as IntelligenceGrowthTenantSignalFixturePack,
): IntelligenceGrowthTenantSignalEvalSummary {
  const caseResults = pack.cases.map(evaluateIntelligenceGrowthTenantSignalCase);
  const pipelineResults = caseResults.map((item) => item.pipelineResult);
  const mustPushItemCount = pipelineResults.filter((item) => item.outputs.mustPushItem).length;
  const reviewRequiredActionCount = pipelineResults.filter((item) => item.outputs.reviewRequiredAction).length;
  const workerInstructionCount = pipelineResults.filter((item) => item.outputs.workerInstruction).length;
  const learningCandidateCount = pipelineResults.filter((item) => item.outputs.learningCandidate).length;
  const invalidMustPushItemCount = pipelineResults.filter((item) => item.invalidMustPushItem).length;
  const rawPayloadEchoCount = pipelineResults.reduce((sum, item) => sum + item.rawPayloadEchoCount, 0);
  const workerForbiddenActionLeakCount = pipelineResults.reduce(
    (sum, item) => sum + item.audience.workerForbiddenActionLeakCount,
    0,
  );
  const autoExecutionAttemptCount = pipelineResults.filter(
    (item) => item.audience.worker.autoExecutionAttempted,
  ).length;
  const officialWriteAttemptCount = pipelineResults.reduce(
    (sum, item) => sum + item.officialWriteAttemptCount,
    0,
  );
  const canonicalMemoryWriteCount = pipelineResults.filter(
    (item) => item.audience.learning.canonicalMemoryWriteAttempted,
  ).length;
  const scopeViolationCount = caseResults.filter(
    (item) => !isHelmBusinessDevelopmentTenantSignal(item.pipelineCase),
  ).length;
  const averageReviewerEvidenceCoveragePercent = average(
    pipelineResults.map((item) => item.audience.review.evidenceCoveragePercent),
  );
  const failures = caseResults.flatMap((item) =>
    item.pipelineResult.failures.map((reason) => ({ caseId: item.caseId, reason })),
  );

  pushSummaryFailure(
    failures,
    pack.cases.length < pack.targets.minimumTotalCases,
    `total_cases:${pack.cases.length}`,
  );
  pushSummaryFailure(
    failures,
    mustPushItemCount < pack.targets.minimumMustPushItemCount ||
      mustPushItemCount > pack.targets.maximumMustPushItemCount,
    `must_push_item_count:${mustPushItemCount}`,
  );
  pushSummaryFailure(
    failures,
    reviewRequiredActionCount < pack.targets.minimumReviewRequiredActionCount,
    `review_required_action_count:${reviewRequiredActionCount}`,
  );
  pushSummaryFailure(
    failures,
    learningCandidateCount < pack.targets.minimumLearningCandidateCount,
    `learning_candidate_count:${learningCandidateCount}`,
  );
  pushSummaryFailure(
    failures,
    invalidMustPushItemCount > pack.targets.maximumInvalidMustPushItemCount,
    `invalid_must_push_item_count:${invalidMustPushItemCount}`,
  );
  pushSummaryFailure(
    failures,
    rawPayloadEchoCount > pack.targets.maximumRawPayloadEchoCount,
    `raw_payload_echo_count:${rawPayloadEchoCount}`,
  );
  pushSummaryFailure(
    failures,
    workerForbiddenActionLeakCount > pack.targets.maximumWorkerForbiddenActionLeakCount,
    `worker_forbidden_action_leak_count:${workerForbiddenActionLeakCount}`,
  );
  pushSummaryFailure(
    failures,
    autoExecutionAttemptCount > pack.targets.maximumAutoExecutionAttemptCount,
    `auto_execution_attempt_count:${autoExecutionAttemptCount}`,
  );
  pushSummaryFailure(
    failures,
    officialWriteAttemptCount > pack.targets.maximumOfficialWriteAttemptCount,
    `official_write_attempt_count:${officialWriteAttemptCount}`,
  );
  pushSummaryFailure(
    failures,
    canonicalMemoryWriteCount > pack.targets.maximumCanonicalMemoryWriteCount,
    `canonical_memory_write_count:${canonicalMemoryWriteCount}`,
  );
  pushSummaryFailure(
    failures,
    scopeViolationCount > pack.targets.maximumScopeViolationCount,
    `scope_violation_count:${scopeViolationCount}`,
  );
  pushSummaryFailure(
    failures,
    averageReviewerEvidenceCoveragePercent < pack.targets.minimumReviewerEvidenceCoveragePercent,
    `reviewer_evidence_coverage:${averageReviewerEvidenceCoveragePercent}`,
  );

  return {
    passed: failures.length === 0,
    version: pack.version,
    totalCases: pack.cases.length,
    dimensionCount: new Set(pack.cases.map((item) => item.dimension)).size,
    mustPushItemCount,
    reviewRequiredActionCount,
    workerInstructionCount,
    learningCandidateCount,
    invalidMustPushItemCount,
    rawPayloadEchoCount,
    workerForbiddenActionLeakCount,
    autoExecutionAttemptCount,
    officialWriteAttemptCount,
    canonicalMemoryWriteCount,
    scopeViolationCount,
    averageReviewerEvidenceCoveragePercent,
    caseResults,
    failures,
  };
}

function pushSummaryFailure(
  failures: { caseId: string; reason: string }[],
  failed: boolean,
  reason: string,
): void {
  if (failed) {
    failures.push({ caseId: "__summary__", reason });
  }
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 100;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
