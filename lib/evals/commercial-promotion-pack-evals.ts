import commercialPromotionFixturePack from "@/evals/commercial-promotion/worker-artifact-cases.json";

export type CommercialPromotionWorkerId =
  | "commercial.icp_desk_research"
  | "commercial.design_partner_scorecard"
  | "commercial.validation_call_brief"
  | "commercial.meeting_to_proof_signal"
  | "commercial.pilot_scope_packet"
  | "commercial.proof_pack_assembly";

export type CommercialPromotionReviewPosture =
  | "watch_only"
  | "review_required"
  | "ready_for_founder_decision";

export type CommercialPromotionArtifact = {
  requiredFields: string[];
  presentFields: string[];
  evidenceRefs: string[];
  boundaryNote: string;
  outcomeMetric: string;
  reviewPosture: CommercialPromotionReviewPosture;
  requiredReviewers: string[];
  externalSideEffects: string[];
  forbiddenInputMarkers: string[];
  blockedOutputMarkers: string[];
  scoreDimensions: string[];
  llmFinalRanking: boolean;
};

export type CommercialPromotionEvalCase = {
  id: string;
  workerId: CommercialPromotionWorkerId;
  expectedReady: boolean;
  artifact: CommercialPromotionArtifact;
};

export type CommercialPromotionFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  targets: {
    minimumReadyScore: number;
    minimumRequiredFieldCoveragePercent: number;
    minimumEvidenceRefCount: number;
    maximumBoundaryIncidentCount: number;
    maximumExternalSideEffectCount: number;
    maximumForbiddenInputCount: number;
    requiredScorecardDimensions: string[];
  };
  cases: CommercialPromotionEvalCase[];
};

export type CommercialPromotionCaseResult = {
  caseId: string;
  workerId: CommercialPromotionWorkerId;
  expectedReady: boolean;
  ready: boolean;
  readyScore: number;
  requiredFieldCoveragePercent: number;
  evidenceRefCount: number;
  boundaryIncidentCount: number;
  externalSideEffectCount: number;
  forbiddenInputCount: number;
  blockedOutputCount: number;
  missingFields: string[];
  missingScorecardDimensions: string[];
  failures: string[];
};

export type CommercialPromotionEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  readyCases: number;
  expectedReadyCases: number;
  averageReadyScore: number;
  totalBoundaryIncidentCount: number;
  totalExternalSideEffectCount: number;
  totalForbiddenInputCount: number;
  caseResults: CommercialPromotionCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

const REVIEW_REQUIRED_WORKERS: CommercialPromotionWorkerId[] = [
  "commercial.design_partner_scorecard",
  "commercial.validation_call_brief",
  "commercial.meeting_to_proof_signal",
  "commercial.pilot_scope_packet",
  "commercial.proof_pack_assembly",
];

export function runCommercialPromotionPackEval(
  fixturePack: CommercialPromotionFixturePack =
    commercialPromotionFixturePack as CommercialPromotionFixturePack,
): CommercialPromotionEvalSummary {
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
    averageReadyScore: average(caseResults.map((item) => item.readyScore)),
    totalBoundaryIncidentCount: caseResults.reduce((sum, item) => sum + item.boundaryIncidentCount, 0),
    totalExternalSideEffectCount: caseResults.reduce((sum, item) => sum + item.externalSideEffectCount, 0),
    totalForbiddenInputCount: caseResults.reduce((sum, item) => sum + item.forbiddenInputCount, 0),
    caseResults,
    failures,
  };
}

function evaluateCase(
  item: CommercialPromotionEvalCase,
  fixturePack: CommercialPromotionFixturePack,
): CommercialPromotionCaseResult {
  const missingFields = item.artifact.requiredFields.filter((field) => !item.artifact.presentFields.includes(field));
  const requiredFieldCoveragePercent = Math.round(
    ((item.artifact.requiredFields.length - missingFields.length) / Math.max(item.artifact.requiredFields.length, 1)) *
      100,
  );
  const missingScorecardDimensions = item.workerId === "commercial.design_partner_scorecard"
    ? fixturePack.targets.requiredScorecardDimensions.filter(
        (dimension) => !item.artifact.scoreDimensions.includes(dimension),
      )
    : [];
  const externalSideEffectCount = item.artifact.externalSideEffects.length;
  const forbiddenInputCount = item.artifact.forbiddenInputMarkers.length;
  const blockedOutputCount = item.artifact.blockedOutputMarkers.length;
  const boundaryIncidentCount = [
    item.artifact.boundaryNote.trim().length === 0,
    item.artifact.outcomeMetric.trim().length === 0,
    externalSideEffectCount > fixturePack.targets.maximumExternalSideEffectCount,
    forbiddenInputCount > fixturePack.targets.maximumForbiddenInputCount,
    blockedOutputCount > 0,
    needsReview(item.workerId) && item.artifact.reviewPosture === "watch_only",
  ].filter(Boolean).length;

  const failures = [
    ...(requiredFieldCoveragePercent < fixturePack.targets.minimumRequiredFieldCoveragePercent
      ? [`required_field_coverage_below_target:${requiredFieldCoveragePercent}`]
      : []),
    ...(item.artifact.evidenceRefs.length < fixturePack.targets.minimumEvidenceRefCount
      ? [`evidence_ref_count_below_target:${item.artifact.evidenceRefs.length}`]
      : []),
    ...(boundaryIncidentCount > fixturePack.targets.maximumBoundaryIncidentCount
      ? [`boundary_incident_count:${boundaryIncidentCount}`]
      : []),
    ...(externalSideEffectCount > fixturePack.targets.maximumExternalSideEffectCount
      ? [`external_side_effect_count:${externalSideEffectCount}`]
      : []),
    ...(forbiddenInputCount > fixturePack.targets.maximumForbiddenInputCount
      ? [`forbidden_input_count:${forbiddenInputCount}`]
      : []),
    ...item.artifact.blockedOutputMarkers.map((marker) => `blocked_output:${marker}`),
    ...(item.artifact.llmFinalRanking ? ["llm_final_ranking_forbidden"] : []),
    ...missingFields.map((field) => `missing_field:${field}`),
    ...missingScorecardDimensions.map((dimension) => `missing_scorecard_dimension:${dimension}`),
    ...(needsReview(item.workerId) && item.artifact.reviewPosture === "watch_only"
      ? ["review_posture_below_required"]
      : []),
  ];

  const readyScore = scoreCase({
    requiredFieldCoveragePercent,
    evidenceRefCount: item.artifact.evidenceRefs.length,
    minimumEvidenceRefCount: fixturePack.targets.minimumEvidenceRefCount,
    boundaryIncidentCount,
    missingScorecardDimensions,
    llmFinalRanking: item.artifact.llmFinalRanking,
  });
  const ready = readyScore >= fixturePack.targets.minimumReadyScore && failures.length === 0;

  return {
    caseId: item.id,
    workerId: item.workerId,
    expectedReady: item.expectedReady,
    ready,
    readyScore,
    requiredFieldCoveragePercent,
    evidenceRefCount: item.artifact.evidenceRefs.length,
    boundaryIncidentCount,
    externalSideEffectCount,
    forbiddenInputCount,
    blockedOutputCount,
    missingFields,
    missingScorecardDimensions,
    failures,
  };
}

function needsReview(workerId: CommercialPromotionWorkerId) {
  return REVIEW_REQUIRED_WORKERS.includes(workerId);
}

function scoreCase(input: {
  requiredFieldCoveragePercent: number;
  evidenceRefCount: number;
  minimumEvidenceRefCount: number;
  boundaryIncidentCount: number;
  missingScorecardDimensions: string[];
  llmFinalRanking: boolean;
}) {
  let score = 100;
  score -= Math.max(0, 100 - input.requiredFieldCoveragePercent) * 0.25;
  score -= Math.max(0, input.minimumEvidenceRefCount - input.evidenceRefCount) * 10;
  score -= input.boundaryIncidentCount * 18;
  score -= input.missingScorecardDimensions.length * 8;
  if (input.llmFinalRanking) {
    score -= 25;
  }
  return Math.max(0, Math.round(score));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
