import {
  buildRuntimeContinuityBandAdjustmentRationale,
  buildRuntimeContinuityConfidenceSummary,
  buildRuntimeContinuityIntervalWordingSummary,
  getRuntimeContinuityPilotRiskBand,
} from "@/lib/helm-v2/runtime-upgrade-continuity-analytics";

type RuntimeContinuityConfidenceBand = "HIGH" | "MEDIUM" | "LOW";
type RuntimeContinuityRiskBand = "LOW" | "WATCH" | "HIGH";
type RuntimeContinuitySampleCoverageBand = "NARROW" | "QUALIFIED" | "BROAD";
type RuntimeContinuityStabilityBand = "UNSTABLE" | "WATCH" | "STABLE";
type RuntimeContinuityConfidenceInterval = "WIDE" | "GUARDED" | "SETTLED";
type RuntimeContinuityThresholdScopeType =
  | "failure_class"
  | "meeting_shape"
  | "cohort_family"
  | "remediation_posture"
  | "session_density"
  | "meeting_frequency"
  | "failure_history"
  | "participant_role";

type RuntimeContinuityThresholdSourceBase = {
  rawConfidenceBand: RuntimeContinuityConfidenceBand;
  confidenceBand: RuntimeContinuityConfidenceBand;
  recommendedIneffectiveThreshold: number;
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  sampleCoverageSummary: string;
  stabilityBand: RuntimeContinuityStabilityBand;
  stabilityConfidenceBand: RuntimeContinuityConfidenceBand;
  confidenceInterval: RuntimeContinuityConfidenceInterval;
  sessionCount: number;
};

type RuntimeContinuityThresholdRevisionCandidate = {
  scope: string;
  scopeType: RuntimeContinuityThresholdScopeType;
  recommendedIneffectiveThreshold: number;
  confidenceBand: RuntimeContinuityConfidenceBand;
  riskBand: RuntimeContinuityRiskBand;
  confidenceSummary: string;
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  sampleCoverageSummary: string;
  stabilityBand: RuntimeContinuityStabilityBand;
  stabilityConfidenceBand: RuntimeContinuityConfidenceBand;
  confidenceInterval: RuntimeContinuityConfidenceInterval;
  bandAdjustmentRationale: string;
  intervalWordingSummary: string;
  summary: string;
  sessionCount: number;
};

export type RuntimeContinuityThresholdRevision = Omit<
  RuntimeContinuityThresholdRevisionCandidate,
  "sessionCount"
>;

type RuntimeContinuityFailureClassRevisionSource = RuntimeContinuityThresholdSourceBase & {
  failureTaxonomy: string;
  adjustmentSummary: string;
  driftRate: number;
};

type RuntimeContinuityMeetingShapeRevisionSource = RuntimeContinuityThresholdSourceBase & {
  meetingShape: string;
  thresholdSummary: string;
  driftRate: number;
};

type RuntimeContinuityCohortFamilyRevisionSource = RuntimeContinuityThresholdSourceBase & {
  cohortKey: string;
  recalibrationSummary: string;
  riskBand: RuntimeContinuityRiskBand;
  driftRate: number;
  trendMetrics: {
    longHorizonDriftRate: number;
  };
};

type RuntimeContinuitySessionDensityRevisionSource = RuntimeContinuityThresholdSourceBase & {
  sessionDensityBand: string;
  calibrationSummary: string;
  riskBand: RuntimeContinuityRiskBand;
  driftRate: number;
};

type RuntimeContinuityMeetingFrequencyRevisionSource = RuntimeContinuityThresholdSourceBase & {
  meetingFrequencyBand: string;
  calibrationSummary: string;
  riskBand: RuntimeContinuityRiskBand;
  driftRate: number;
};

type RuntimeContinuityFailureHistoryRevisionSource = RuntimeContinuityThresholdSourceBase & {
  failureHistoryBand: string;
  varianceSummary: string;
  riskBand: RuntimeContinuityRiskBand;
  reviewRequiredRate: number;
  ineffectiveAfterGuidanceRate: number;
};

type RuntimeContinuityParticipantRoleRevisionSource = RuntimeContinuityThresholdSourceBase & {
  participantRolePosture: string;
  calibrationSummary: string;
  riskBand: RuntimeContinuityRiskBand;
  driftRate: number;
};

type RuntimeContinuityRemediationPostureRevisionSource = RuntimeContinuityThresholdSourceBase & {
  recoveryState: string;
  latestEffectiveness: string;
  varianceSummary: string;
  riskBand: RuntimeContinuityRiskBand;
  driftRate: number;
};

function buildThresholdRevisionCandidate<T extends RuntimeContinuityThresholdSourceBase>(
  item: T,
  input: {
    scope: string;
    scopeType: RuntimeContinuityThresholdScopeType;
    riskBand: RuntimeContinuityRiskBand;
    summary: string;
    driftRate: number;
    longHorizonDriftRate: number;
    skippedGuidanceRate: number;
    ineffectiveAfterGuidanceRate: number;
  },
): RuntimeContinuityThresholdRevisionCandidate {
  const { scope, scopeType, riskBand, summary, driftRate, longHorizonDriftRate } = input;
  return {
    scope,
    scopeType,
    recommendedIneffectiveThreshold: item.recommendedIneffectiveThreshold,
    confidenceBand: item.confidenceBand,
    riskBand,
    confidenceSummary: buildRuntimeContinuityConfidenceSummary({
      confidenceBand: item.confidenceBand,
      riskBand,
      driftRate,
      longHorizonDriftRate,
      skippedGuidanceRate: input.skippedGuidanceRate,
      ineffectiveAfterGuidanceRate: input.ineffectiveAfterGuidanceRate,
    }),
    sampleCoverageBand: item.sampleCoverageBand,
    sampleCoverageSummary: item.sampleCoverageSummary,
    stabilityBand: item.stabilityBand,
    stabilityConfidenceBand: item.stabilityConfidenceBand,
    confidenceInterval: item.confidenceInterval,
    bandAdjustmentRationale: buildRuntimeContinuityBandAdjustmentRationale(scope, {
      rawConfidenceBand: item.rawConfidenceBand,
      confidenceBand: item.confidenceBand,
      confidenceInterval: item.confidenceInterval,
      sampleCoverageBand: item.sampleCoverageBand,
      stabilityBand: item.stabilityBand,
    }),
    intervalWordingSummary: buildRuntimeContinuityIntervalWordingSummary(scope, item.confidenceInterval),
    summary,
    sessionCount: item.sessionCount,
  };
}

function buildDerivedRiskThresholdRevisions<T extends RuntimeContinuityThresholdSourceBase>(
  items: T[],
  input: {
    limit: number;
    scopeType: RuntimeContinuityThresholdScopeType;
    getScope: (item: T) => string;
    getSummary: (item: T) => string;
    getDriftRate: (item: T) => number;
    getLongHorizonDriftRate: (item: T) => number;
    skippedGuidanceRate: number;
    ineffectiveAfterGuidanceRate: number;
  },
) {
  return items
    .filter((item) => item.confidenceBand !== "HIGH")
    .slice(0, input.limit)
    .map((item) => {
      const riskBand = getRuntimeContinuityPilotRiskBand(item.confidenceBand);
      return buildThresholdRevisionCandidate(item, {
        scope: input.getScope(item),
        scopeType: input.scopeType,
        riskBand,
        summary: input.getSummary(item),
        driftRate: input.getDriftRate(item),
        longHorizonDriftRate: input.getLongHorizonDriftRate(item),
        skippedGuidanceRate: input.skippedGuidanceRate,
        ineffectiveAfterGuidanceRate: input.ineffectiveAfterGuidanceRate,
      });
    });
}

function buildExplicitRiskThresholdRevisions<
  T extends RuntimeContinuityThresholdSourceBase & { riskBand: RuntimeContinuityRiskBand },
>(
  items: T[],
  input: {
    limit: number;
    scopeType: RuntimeContinuityThresholdScopeType;
    getScope: (item: T) => string;
    getSummary: (item: T) => string;
    getDriftRate: (item: T) => number;
    getLongHorizonDriftRate: (item: T) => number;
    skippedGuidanceRate: number;
    ineffectiveAfterGuidanceRate: number;
  },
) {
  return items
    .filter((item) => item.riskBand !== "LOW")
    .slice(0, input.limit)
    .map((item) =>
      buildThresholdRevisionCandidate(item, {
        scope: input.getScope(item),
        scopeType: input.scopeType,
        riskBand: item.riskBand,
        summary: input.getSummary(item),
        driftRate: input.getDriftRate(item),
        longHorizonDriftRate: input.getLongHorizonDriftRate(item),
        skippedGuidanceRate: input.skippedGuidanceRate,
        ineffectiveAfterGuidanceRate: input.ineffectiveAfterGuidanceRate,
      }),
    );
}

export function buildRuntimeContinuityThresholdRevisions(input: {
  distributionWithTier: RuntimeContinuityFailureClassRevisionSource[];
  meetingShapeCohorts: RuntimeContinuityMeetingShapeRevisionSource[];
  cohortFamilies: RuntimeContinuityCohortFamilyRevisionSource[];
  sessionDensityCohorts: RuntimeContinuitySessionDensityRevisionSource[];
  meetingFrequencyCohorts: RuntimeContinuityMeetingFrequencyRevisionSource[];
  failureHistoryCohorts: RuntimeContinuityFailureHistoryRevisionSource[];
  participantRoleCohorts: RuntimeContinuityParticipantRoleRevisionSource[];
  remediationPostureCohorts: RuntimeContinuityRemediationPostureRevisionSource[];
  skippedGuidanceRate: number;
  ineffectiveAfterGuidanceRate: number;
}): RuntimeContinuityThresholdRevision[] {
  const {
    distributionWithTier,
    meetingShapeCohorts,
    cohortFamilies,
    sessionDensityCohorts,
    meetingFrequencyCohorts,
    failureHistoryCohorts,
    participantRoleCohorts,
    remediationPostureCohorts,
    skippedGuidanceRate,
    ineffectiveAfterGuidanceRate,
  } = input;

  const thresholdRevisionCandidates = [
    ...buildDerivedRiskThresholdRevisions(distributionWithTier, {
      limit: 3,
      scopeType: "failure_class",
      getScope: (item) => item.failureTaxonomy,
      getSummary: (item) => item.adjustmentSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.driftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildDerivedRiskThresholdRevisions(meetingShapeCohorts, {
      limit: 2,
      scopeType: "meeting_shape",
      getScope: (item) => item.meetingShape,
      getSummary: (item) => item.thresholdSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.driftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildExplicitRiskThresholdRevisions(cohortFamilies, {
      limit: 2,
      scopeType: "cohort_family",
      getScope: (item) => item.cohortKey,
      getSummary: (item) => item.recalibrationSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.trendMetrics.longHorizonDriftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildExplicitRiskThresholdRevisions(sessionDensityCohorts, {
      limit: 1,
      scopeType: "session_density",
      getScope: (item) => item.sessionDensityBand,
      getSummary: (item) => item.calibrationSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.driftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildExplicitRiskThresholdRevisions(meetingFrequencyCohorts, {
      limit: 1,
      scopeType: "meeting_frequency",
      getScope: (item) => item.meetingFrequencyBand,
      getSummary: (item) => item.calibrationSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.driftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildExplicitRiskThresholdRevisions(failureHistoryCohorts, {
      limit: 1,
      scopeType: "failure_history",
      getScope: (item) => item.failureHistoryBand,
      getSummary: (item) => item.varianceSummary,
      getDriftRate: (item) => item.reviewRequiredRate,
      getLongHorizonDriftRate: (item) => item.ineffectiveAfterGuidanceRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildExplicitRiskThresholdRevisions(participantRoleCohorts, {
      limit: 1,
      scopeType: "participant_role",
      getScope: (item) => item.participantRolePosture,
      getSummary: (item) => item.calibrationSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.driftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
    ...buildExplicitRiskThresholdRevisions(remediationPostureCohorts, {
      limit: 2,
      scopeType: "remediation_posture",
      getScope: (item) => `${item.recoveryState} · ${item.latestEffectiveness}`,
      getSummary: (item) => item.varianceSummary,
      getDriftRate: (item) => item.driftRate,
      getLongHorizonDriftRate: (item) => item.driftRate,
      skippedGuidanceRate,
      ineffectiveAfterGuidanceRate,
    }),
  ];

  return thresholdRevisionCandidates
    .sort((left, right) => {
      const riskPriority = { HIGH: 3, WATCH: 2, LOW: 1 } as const;
      if (riskPriority[right.riskBand] !== riskPriority[left.riskBand]) {
        return riskPriority[right.riskBand] - riskPriority[left.riskBand];
      }
      return right.sessionCount - left.sessionCount;
    })
    .filter((item, index, list) => list.findIndex((candidate) => candidate.scope === item.scope) === index)
    .slice(0, 10)
    .map((item) => ({
      scope: item.scope,
      scopeType: item.scopeType,
      recommendedIneffectiveThreshold: item.recommendedIneffectiveThreshold,
      confidenceBand: item.confidenceBand,
      riskBand: item.riskBand,
      confidenceSummary: item.confidenceSummary,
      sampleCoverageBand: item.sampleCoverageBand,
      sampleCoverageSummary: item.sampleCoverageSummary,
      stabilityBand: item.stabilityBand,
      stabilityConfidenceBand: item.stabilityConfidenceBand,
      confidenceInterval: item.confidenceInterval,
      bandAdjustmentRationale: item.bandAdjustmentRationale,
      intervalWordingSummary: item.intervalWordingSummary,
      summary: item.summary,
    }));
}
