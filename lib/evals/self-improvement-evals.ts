import selfImprovementFixturePack from "@/evals/self-improvement/learning-loop-cases.json";

export type SelfImprovementSurface =
  | "recommendation"
  | "memory"
  | "skill_suggestion"
  | "llm_context";

export type SelfImprovementStage =
  | "signal"
  | "feedback"
  | "candidate"
  | "review"
  | "adoption"
  | "measurement";

export type SelfImprovementEvent = {
  stage: SelfImprovementStage;
  eventType: string;
  evidenceRefs: string[];
  reviewRequired: boolean;
  reviewCompleted: boolean;
  boundaryIncidentCount: number;
  beforeScore?: number;
  afterScore?: number;
  autoPromotion?: boolean;
};

export type SelfImprovementEvalCase = {
  id: string;
  surface: SelfImprovementSurface;
  learningLoop: string;
  expectedReady: boolean;
  events: SelfImprovementEvent[];
  expectedOutputs: string[];
  blockedOutputs: string[];
};

export type SelfImprovementFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    minimumLoopScore: number;
    minimumEvidenceCoveragePercent: number;
    minimumReviewCoveragePercent: number;
    maximumBoundaryIncidentCount: number;
    minimumMeasuredImprovementPercent: number;
    maximumAutoPromotionCount: number;
  };
  cases: SelfImprovementEvalCase[];
};

export type SelfImprovementCaseResult = {
  caseId: string;
  surface: SelfImprovementSurface;
  learningLoop: string;
  expectedReady: boolean;
  ready: boolean;
  loopScore: number;
  evidenceCoveragePercent: number;
  reviewCoveragePercent: number;
  measuredImprovementPercent: number;
  boundaryIncidentCount: number;
  autoPromotionCount: number;
  presentStages: SelfImprovementStage[];
  missingStages: SelfImprovementStage[];
  failures: string[];
};

export type SelfImprovementEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  readyCases: number;
  expectedReadyCases: number;
  averageLoopScore: number;
  totalBoundaryIncidentCount: number;
  totalAutoPromotionCount: number;
  caseResults: SelfImprovementCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

const REQUIRED_STAGES: SelfImprovementStage[] = [
  "signal",
  "candidate",
  "review",
  "measurement",
];

const AUTO_PROMOTION_OUTPUT_MARKERS = [
  "auto_promotion",
  "formal_skill_auto_promotion",
  "auto_execution_authority",
  "canonical_fact_auto_write",
  "ranking_takeover",
  "raw_prompt_persistence",
];

export function runSelfImprovementEval(
  fixturePack: SelfImprovementFixturePack = selfImprovementFixturePack as SelfImprovementFixturePack,
): SelfImprovementEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateCase(item, fixturePack));
  const failures = caseResults.flatMap((item) => [
    ...(item.expectedReady === item.ready
      ? []
      : [{ caseId: item.caseId, reason: "readiness_expectation_mismatch" }]),
    ...(item.expectedReady ? item.failures.map((reason) => ({ caseId: item.caseId, reason })) : []),
  ]);

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: caseResults.length,
    readyCases: caseResults.filter((item) => item.ready).length,
    expectedReadyCases: caseResults.filter((item) => item.expectedReady).length,
    averageLoopScore: average(caseResults.map((item) => item.loopScore)),
    totalBoundaryIncidentCount: caseResults.reduce((sum, item) => sum + item.boundaryIncidentCount, 0),
    totalAutoPromotionCount: caseResults.reduce((sum, item) => sum + item.autoPromotionCount, 0),
    caseResults,
    failures,
  };
}

function evaluateCase(
  item: SelfImprovementEvalCase,
  fixturePack: SelfImprovementFixturePack,
): SelfImprovementCaseResult {
  const presentStages = Array.from(new Set(item.events.map((event) => event.stage))).sort() as SelfImprovementStage[];
  const missingStages = REQUIRED_STAGES.filter((stage) => !presentStages.includes(stage));
  const evidenceCoveragePercent = Math.round(
    (item.events.filter((event) => event.evidenceRefs.length > 0).length / Math.max(item.events.length, 1)) * 100,
  );
  const reviewRequiredEvents = item.events.filter((event) => event.reviewRequired);
  const reviewCoveragePercent = reviewRequiredEvents.length === 0
    ? 100
    : Math.round(
        (reviewRequiredEvents.filter((event) => event.reviewCompleted).length / reviewRequiredEvents.length) * 100,
      );
  const boundaryIncidentCount = item.events.reduce((sum, event) => sum + event.boundaryIncidentCount, 0);
  const autoPromotionCount =
    item.events.filter((event) => event.autoPromotion).length +
    item.expectedOutputs.filter((output) =>
      AUTO_PROMOTION_OUTPUT_MARKERS.some((marker) => output.includes(marker)),
    ).length;
  const measuredImprovementPercent = getMeasuredImprovementPercent(item.events);
  const loopScore = scoreLoop({
    missingStages,
    evidenceCoveragePercent,
    reviewCoveragePercent,
    boundaryIncidentCount,
    autoPromotionCount,
    measuredImprovementPercent,
  });

  const failures = [
    ...(loopScore < fixturePack.targets.minimumLoopScore ? [`loop_score_below_target:${loopScore}`] : []),
    ...(evidenceCoveragePercent < fixturePack.targets.minimumEvidenceCoveragePercent
      ? [`evidence_coverage_below_target:${evidenceCoveragePercent}`]
      : []),
    ...(reviewCoveragePercent < fixturePack.targets.minimumReviewCoveragePercent
      ? [`review_coverage_below_target:${reviewCoveragePercent}`]
      : []),
    ...(boundaryIncidentCount > fixturePack.targets.maximumBoundaryIncidentCount
      ? [`boundary_incident_count:${boundaryIncidentCount}`]
      : []),
    ...(autoPromotionCount > fixturePack.targets.maximumAutoPromotionCount
      ? [`auto_promotion_count:${autoPromotionCount}`]
      : []),
    ...(measuredImprovementPercent < fixturePack.targets.minimumMeasuredImprovementPercent
      ? [`measured_improvement_below_target:${measuredImprovementPercent}`]
      : []),
    ...missingStages.map((stage) => `missing_stage:${stage}`),
  ];

  const ready = failures.length === 0;

  return {
    caseId: item.id,
    surface: item.surface,
    learningLoop: item.learningLoop,
    expectedReady: item.expectedReady,
    ready,
    loopScore,
    evidenceCoveragePercent,
    reviewCoveragePercent,
    measuredImprovementPercent,
    boundaryIncidentCount,
    autoPromotionCount,
    presentStages,
    missingStages,
    failures,
  };
}

function scoreLoop(input: {
  missingStages: SelfImprovementStage[];
  evidenceCoveragePercent: number;
  reviewCoveragePercent: number;
  boundaryIncidentCount: number;
  autoPromotionCount: number;
  measuredImprovementPercent: number;
}) {
  let score = 100;
  score -= input.missingStages.length * 18;
  score -= Math.max(0, 100 - input.evidenceCoveragePercent) * 0.2;
  score -= Math.max(0, 100 - input.reviewCoveragePercent) * 0.35;
  score -= input.boundaryIncidentCount * 40;
  score -= input.autoPromotionCount * 35;
  if (input.measuredImprovementPercent < 10) {
    score -= 15;
  }
  return Math.max(0, Math.round(score));
}

function getMeasuredImprovementPercent(events: SelfImprovementEvent[]) {
  const improvements = events
    .map((event) => {
      if (typeof event.beforeScore !== "number" || typeof event.afterScore !== "number") {
        return null;
      }
      return event.afterScore - event.beforeScore;
    })
    .filter((value): value is number => value !== null);

  if (improvements.length === 0) {
    return 0;
  }

  return Math.round(improvements.reduce((sum, value) => sum + value, 0) / improvements.length);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
