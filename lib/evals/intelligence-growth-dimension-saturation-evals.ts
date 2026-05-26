import fixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import {
  buildCycleAdvanceIntakeCandidate,
  runIntelligenceGrowthCycleAdvanceEval,
  type IntelligenceGrowthCycleAdvanceIntake,
} from "@/lib/evals/intelligence-growth-cycle-advance-evals";
import type {
  IntelligenceGrowthLearningRequeueCandidate,
  IntelligenceGrowthLearningRequeueFixture,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

const INTELLIGENCE_DIMENSIONS: readonly IntelligenceDimension[] = [
  "context",
  "object_signal",
  "memory",
  "routing",
  "action_outcome",
  "worker_skill",
  "prompt_policy",
  "eval_replay",
  "tenant_personalization",
  "cost_model_tool",
];

const MAX_FIXTURE_INTAKES_PER_DIMENSION = 1;

export type IntelligenceGrowthDimensionSaturationSummary = {
  readonly passed: boolean;
  readonly totalIntakeCandidates: number;
  readonly expectedDimensionCount: number;
  readonly coveredDimensionCount: number;
  readonly dimensionCoveragePercent: number;
  readonly missingDimensions: readonly IntelligenceDimension[];
  readonly duplicateDimensionCount: number;
  readonly maxDimensionCandidateCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly { readonly dimension: string; readonly reason: string }[];
};

export function runIntelligenceGrowthDimensionSaturationEval(
  fixture?: IntelligenceGrowthLearningRequeueFixture,
): IntelligenceGrowthDimensionSaturationSummary {
  const cycleSummary = runIntelligenceGrowthCycleAdvanceEval(fixture);
  const candidates: readonly IntelligenceGrowthLearningRequeueCandidate[] = fixture
    ? fixture.candidates
    : (fixtureData.candidates as IntelligenceGrowthLearningRequeueCandidate[]);
  const intakeCandidates = candidates.map(buildCycleAdvanceIntakeCandidate);
  const dimensionsByIntake = intakeCandidates.map(resolveDimensionFromIntake);
  const countsByDimension = new Map<IntelligenceDimension, number>();

  for (const dimension of dimensionsByIntake) {
    if (!dimension) continue;
    countsByDimension.set(dimension, (countsByDimension.get(dimension) ?? 0) + 1);
  }

  const missingDimensions = INTELLIGENCE_DIMENSIONS.filter(
    (dimension) => !countsByDimension.has(dimension),
  );
  const duplicateDimensions = [...countsByDimension.entries()]
    .filter(([, count]) => count > MAX_FIXTURE_INTAKES_PER_DIMENSION)
    .map(([dimension]) => dimension);
  const maxDimensionCandidateCount = Math.max(0, ...countsByDimension.values());
  const dimensionCoveragePercent = percent(countsByDimension.size, INTELLIGENCE_DIMENSIONS.length);

  const failures: { dimension: string; reason: string }[] = [
    ...cycleSummary.failures.map((failure) => ({
      dimension: "__cycle__",
      reason: `upstream:${failure.reason}`,
    })),
  ];

  for (const dimension of missingDimensions) {
    failures.push({ dimension, reason: "missing_dimension" });
  }
  for (const dimension of duplicateDimensions) {
    failures.push({ dimension, reason: "duplicate_dimension" });
  }
  for (const candidate of intakeCandidates) {
    if (!resolveDimensionFromIntake(candidate)) {
      failures.push({ dimension: "__unknown__", reason: `invalid_dimension_ref:${candidate.intakeId}` });
    }
  }

  pushFailure(
    failures,
    cycleSummary.unauthorizedFlagCount > 0,
    "__dimension__",
    `unauthorized_flag_count:${cycleSummary.unauthorizedFlagCount}`,
  );
  pushFailure(
    failures,
    cycleSummary.rawCustomerDataIncidentCount > 0,
    "__dimension__",
    `raw_customer_data_incident_count:${cycleSummary.rawCustomerDataIncidentCount}`,
  );

  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    totalIntakeCandidates: intakeCandidates.length,
    expectedDimensionCount: INTELLIGENCE_DIMENSIONS.length,
    coveredDimensionCount: countsByDimension.size,
    dimensionCoveragePercent,
    missingDimensions,
    duplicateDimensionCount: duplicateDimensions.length,
    maxDimensionCandidateCount,
    unauthorizedFlagCount: cycleSummary.unauthorizedFlagCount,
    rawCustomerDataIncidentCount: cycleSummary.rawCustomerDataIncidentCount,
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

function resolveDimensionFromIntake(
  intake: IntelligenceGrowthCycleAdvanceIntake,
): IntelligenceDimension | null {
  const [, dimension] = intake.sourceDecisionPacketId.split(":");
  return INTELLIGENCE_DIMENSIONS.includes(dimension as IntelligenceDimension)
    ? (dimension as IntelligenceDimension)
    : null;
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

function pushFailure(
  failures: { dimension: string; reason: string }[],
  failed: boolean,
  dimension: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ dimension, reason });
  }
}

function deduplicateFailures(
  failures: readonly { readonly dimension: string; readonly reason: string }[],
): readonly { readonly dimension: string; readonly reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.dimension}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
