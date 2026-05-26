type RuntimeContinuityThresholdRevision = {
  scope: string;
  scopeType:
    | "failure_class"
    | "meeting_shape"
    | "cohort_family"
    | "remediation_posture"
    | "session_density"
    | "meeting_frequency"
    | "failure_history"
    | "participant_role";
  recommendedIneffectiveThreshold: number;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
  riskBand: "LOW" | "WATCH" | "HIGH";
  sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
  sampleCoverageSummary: string;
  stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
  stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
  confidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
  bandAdjustmentRationale: string;
  intervalWordingSummary: string;
  confidenceSummary: string;
  summary: string;
};

type RuntimeContinuityTopFailureClass = {
  failureTaxonomy: string;
  adjustmentSummary: string;
};

type RuntimeContinuityStabilitySignal = {
  stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
  stabilitySummary: string;
  stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
  stabilityVarianceSummary: string;
};

export function buildRuntimeContinuityCalibrationReadouts(input: {
  defaultIneffectiveThreshold: number;
  earlyIneffectiveThreshold: number;
  lowBandClasses: number;
  mediumBandClasses: number;
  highBandClasses: number;
  highRiskClasses: number;
  watchRiskClasses: number;
  lowRiskClasses: number;
  topFailureClasses: RuntimeContinuityTopFailureClass[];
  thresholdRevisions: RuntimeContinuityThresholdRevision[];
  sessionDensityCalibrationHeadline?: string | null;
  meetingFrequencyCalibrationHeadline?: string | null;
  failureHistoryCalibrationHeadline?: string | null;
  participantRoleCalibrationHeadline?: string | null;
  stabilityThreshold: number;
  stabilitySignals: RuntimeContinuityStabilitySignal[];
  sessionDensityDriftHeadline?: string | null;
  meetingFrequencyDriftHeadline?: string | null;
  participantRoleDriftHeadline?: string | null;
  materiallyDriftingCohorts: string[];
  longHorizonDriftRate: number;
}) {
  const {
    defaultIneffectiveThreshold,
    earlyIneffectiveThreshold,
    lowBandClasses,
    mediumBandClasses,
    highBandClasses,
    highRiskClasses,
    watchRiskClasses,
    lowRiskClasses,
    topFailureClasses,
    thresholdRevisions,
    sessionDensityCalibrationHeadline = null,
    meetingFrequencyCalibrationHeadline = null,
    failureHistoryCalibrationHeadline = null,
    participantRoleCalibrationHeadline = null,
    stabilityThreshold,
    stabilitySignals,
    sessionDensityDriftHeadline = null,
    meetingFrequencyDriftHeadline = null,
    participantRoleDriftHeadline = null,
    materiallyDriftingCohorts,
    longHorizonDriftRate,
  } = input;

  const subgroupCalibrationHighlights = [
    sessionDensityCalibrationHeadline,
    meetingFrequencyCalibrationHeadline,
    failureHistoryCalibrationHeadline,
    participantRoleCalibrationHeadline,
  ].filter(Boolean) as string[];
  const subgroupCalibrationSummary =
    thresholdRevisions.some((item) =>
      ["session_density", "meeting_frequency", "failure_history", "participant_role"].includes(item.scopeType),
    )
      ? "Deeper subgroup review now adds operator-visible calibration guidance for session density, meeting cadence, failure history, and participant posture where current pilot evidence is strong enough."
      : "Current pilot evidence does not yet justify subgroup-specific threshold changes beyond the existing cohort family review.";

  const broadCoverageCount = thresholdRevisions.filter((item) => item.sampleCoverageBand === "BROAD").length;
  const qualifiedCoverageCount = thresholdRevisions.filter(
    (item) => item.sampleCoverageBand === "QUALIFIED",
  ).length;
  const narrowCoverageCount = thresholdRevisions.filter((item) => item.sampleCoverageBand === "NARROW").length;
  const sampleReviewHighlights = [
    thresholdRevisions.find((item) => item.sampleCoverageBand === "BROAD")?.sampleCoverageSummary ?? null,
    thresholdRevisions.find((item) => item.sampleCoverageBand === "QUALIFIED")?.sampleCoverageSummary ?? null,
    thresholdRevisions.find((item) => item.sampleCoverageBand === "NARROW")?.sampleCoverageSummary ?? null,
  ].filter(Boolean) as string[];

  const stableSubgroups = stabilitySignals.filter((item) => item.stabilityBand === "STABLE").length;
  const watchSubgroups = stabilitySignals.filter((item) => item.stabilityBand === "WATCH").length;
  const unstableSubgroups = stabilitySignals.filter((item) => item.stabilityBand === "UNSTABLE").length;
  const stabilityReviewHighlights = [
    stabilitySignals.find((item) => item.stabilityBand === "UNSTABLE")?.stabilitySummary ?? null,
    stabilitySignals.find((item) => item.stabilityBand === "WATCH")?.stabilitySummary ?? null,
    stabilitySignals.find((item) => item.stabilityBand === "STABLE")?.stabilitySummary ?? null,
  ].filter(Boolean) as string[];

  const driftSynthesisPanels = [
    sessionDensityDriftHeadline,
    meetingFrequencyDriftHeadline,
    participantRoleDriftHeadline,
    ...materiallyDriftingCohorts,
  ]
    .filter(Boolean)
    .slice(0, 4) as string[];
  const driftSynthesisSummary =
    driftSynthesisPanels.length && longHorizonDriftRate >= 50
      ? "Long-horizon drift remains concentrated enough that operators should read subgroup drift panels before repeating the same remediation posture."
      : driftSynthesisPanels.length
        ? "Drift synthesis is now available across subgroup views; operators should compare cadence, density, and participant posture before assuming a local improvement will hold."
        : "No subgroup drift synthesis is available yet; rely on the existing long-horizon drift posture only.";

  return {
    thresholdRevisionHeadline: thresholdRevisions[0]
      ? `${thresholdRevisions[0].scopeType} ${thresholdRevisions[0].scope}: ${thresholdRevisions[0].bandAdjustmentRationale}`
      : null,
    stabilityReviewHeadline: stabilityReviewHighlights[0] ? `stability: ${stabilityReviewHighlights[0]}` : null,
    calibrationProfile: {
      defaultIneffectiveThreshold,
      confidenceBandSummary: `${lowBandClasses} low-band / ${mediumBandClasses} medium-band / ${highBandClasses} high-band failure classes in the current pilot review.`,
      riskBandSummary: `${highRiskClasses} high-risk / ${watchRiskClasses} watch-risk / ${lowRiskClasses} low-risk failure classes in the current calibrated review.`,
      summary:
        defaultIneffectiveThreshold === earlyIneffectiveThreshold
          ? "Current pilot review suggests earlier escalation for low-band failure classes after the first repeated ineffective outcome."
          : "Current pilot review keeps the existing ineffective threshold for most failure classes.",
      classAdjustments: topFailureClasses.map((item) => `${item.failureTaxonomy}: ${item.adjustmentSummary}`),
      revisedHighlights: thresholdRevisions
        .slice(0, 8)
        .map((item) => `${item.scopeType} ${item.scope}: ${item.confidenceSummary} ${item.bandAdjustmentRationale}`),
    },
    subgroupCalibration: {
      summary: subgroupCalibrationSummary,
      cohortHighlights: subgroupCalibrationHighlights,
    },
    sampleReview: {
      summary:
        broadCoverageCount > 0
          ? "Expanded pilot review now includes at least one broad-sample subgroup, but most subgroup guidance still needs sample-aware interpretation."
          : "Expanded pilot review is still dominated by narrow or qualified samples; keep cohort guidance conservative.",
      aggregateSummary: `${broadCoverageCount} broad / ${qualifiedCoverageCount} qualified / ${narrowCoverageCount} narrow sample-backed revision(s) are currently visible in the operator review.`,
      cohortHighlights: sampleReviewHighlights,
    },
    stabilityReview: {
      stabilityThreshold,
      stableSubgroups,
      watchSubgroups,
      unstableSubgroups,
      summary:
        unstableSubgroups > 0
          ? "Subgroup stability still has visible unstable pockets, so pilot calibration must keep review-first wording instead of over-trusting the current readout."
          : watchSubgroups > 0
            ? "Most subgroup stability readouts are watch-level rather than unstable, but the operator should still avoid treating the current cohort splits as settled truth."
            : "Current subgroup stability readouts are comparatively steady across the visible pilot sample, though they remain continuity review guidance only.",
      aggregateSummary: `${stableSubgroups} stable / ${watchSubgroups} watch / ${unstableSubgroups} unstable subgroup readout(s) against the current baseline stability threshold ${stabilityThreshold}.`,
      subgroupHighlights: stabilityReviewHighlights,
    },
    driftSynthesis: {
      summary: driftSynthesisSummary,
      panels: driftSynthesisPanels,
    },
  };
}
