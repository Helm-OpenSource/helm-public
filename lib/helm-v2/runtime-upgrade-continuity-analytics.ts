type RuntimeContinuityConfidenceBand = "LOW" | "MEDIUM" | "HIGH";
type RuntimeContinuityMeetingShape = "LEAN_MEETING" | "LONG_CONTEXT_MEETING" | "RESUMED_MEETING";
type RuntimeContinuitySessionDensityBand = "LIGHT" | "STEADY" | "HEAVY";
type RuntimeContinuityMeetingFrequencyBand = "SPORADIC" | "RECURRING" | "HIGH_CADENCE";
type RuntimeContinuityFailureHistoryBand = "FIRST_SIGNAL" | "REPEATED_FAILURE" | "CHRONIC_REPEAT";
type RuntimeContinuityParticipantRolePosture =
  | "UNKNOWN"
  | "EXEC_SPONSORED"
  | "OPERATOR_LED"
  | "MIXED_STAKEHOLDERS";
type RuntimeContinuityWorkspaceSizeBand = "SMALL" | "GROWING" | "LARGE";
type RuntimeContinuityPilotRiskBand = "LOW" | "WATCH" | "HIGH";
type RuntimeContinuitySampleCoverageBand = "NARROW" | "QUALIFIED" | "BROAD";
type RuntimeContinuityStabilityBand = "STABLE" | "WATCH" | "UNSTABLE";
type RuntimeContinuityConfidenceInterval = "WIDE" | "GUARDED" | "SETTLED";
type RuntimeContinuityOutcomeCorrelationBand = "AT_RISK" | "WATCH" | "STABLE";
type RuntimeContinuityFailureTaxonomy =
  | "NO_RECOVERY_ANCHOR"
  | "BUDGET_PRESSURE"
  | "PAYLOAD_STATE_DRIFT"
  | "REPLAY_DRIFT"
  | "PROTECTED_STATE_GAP"
  | "NONE";
type RuntimeContinuityGuidanceStatus =
  | "MATCHED_GUIDANCE"
  | "SKIPPED_GUIDANCE"
  | "INEFFECTIVE_AFTER_GUIDANCE"
  | "NEEDS_MORE_EVIDENCE";
type RuntimeContinuitySopStepId =
  | "ANCHOR_CHECK"
  | "PRUNE_TRACE_REVIEW"
  | "HANDLE_LINEAGE_REVIEW"
  | "REPLAY_GAP_REVIEW"
  | "PROTECTED_FIELD_REVIEW";
type RuntimeContinuityDriftState = "IMPROVING" | "DRIFTING" | "STABLE";

export type RuntimeContinuityPilotEffectivenessReviewProfile = {
  pilotBasis: string;
  lowBandDriftRate: number;
  lowBandLongHorizonDriftRate: number;
  lowBandIneffectiveRate: number;
  lowBandRepeatPatternRate: number;
  lowBandConfidenceRate: number;
  lowBandSkippedGuidanceRate: number;
  lowBandIneffectiveAfterGuidanceRate: number;
  mediumBandDriftRate: number;
  mediumBandLongHorizonDriftRate: number;
  mediumBandIneffectiveRate: number;
  mediumBandRepeatPatternRate: number;
  mediumBandConfidenceRate: number;
  mediumBandSkippedGuidanceRate: number;
  mediumBandIneffectiveAfterGuidanceRate: number;
  defaultIneffectiveThreshold: number;
  earlyIneffectiveThreshold: number;
  topFailureClassCount: number;
};

type RuntimeContinuityMeetingShapeInput = {
  posture: string;
  replayStatus: string;
  payloadStateSource: string;
};

type RuntimeContinuitySessionDensityInput = {
  posture: string;
  budgetTokenLimit: number;
  budgetTokenUsed: number;
  prunedTokenCount: number;
};

type RuntimeContinuityFailureHistoryInput = {
  remediationAttempts: number;
  repeatPatternStatus: string;
};

type RuntimeContinuityParticipantRolePostureInput = {
  attendeesSummary: string | null;
  contactTitles: string[];
};

type RuntimeContinuityMeetingFrequencySession = {
  id: string;
  companyId: string | null | undefined;
  opportunityId: string | null | undefined;
  updatedAt: Date;
  meetingStartsAt: Date | null;
};

type RuntimeContinuityTrendItem = {
  updatedAt: Date;
  latestEffectiveness: string;
  repeatPatternStatus: string;
  calibrationConfidence: string;
  recoveryState: string;
};

type RuntimeContinuityGuidanceItem = {
  failureTaxonomy: RuntimeContinuityFailureTaxonomy;
  recoveryState: string;
  latestEffectiveness: string;
  repeatPatternStatus: string;
};

type RuntimeContinuityPilotCase = RuntimeContinuityTrendItem & RuntimeContinuityGuidanceItem;

type RuntimeContinuitySopStepReview = {
  stepId: RuntimeContinuitySopStepId;
  label: string;
  applicableCases: number;
  matchedGuidanceRate: number;
  skippedGuidanceRate: number;
  ineffectiveAfterHitRate: number;
  effectiveOutcomeRate: number;
  reviewRequiredOutcomeRate: number;
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  stabilityBand: RuntimeContinuityStabilityBand;
  stabilityConfidenceBand: RuntimeContinuityConfidenceBand;
  confidenceInterval: RuntimeContinuityConfidenceInterval;
  bandAdjustmentRationale: string;
  intervalWordingSummary: string;
  recentEffectiveOutcomeRate: number;
  olderEffectiveOutcomeRate: number;
  longHorizonEffectiveOutcomeRate: number;
  outcomeDelta: number;
  correlationBand: RuntimeContinuityOutcomeCorrelationBand;
  correlationSummary: string;
  longTermImpactSummary: string;
  materialImpactBand: RuntimeContinuityPilotRiskBand;
  materialImpactSummary: string;
  summary: string;
  improvementHint: string;
};

type RuntimeContinuitySopTemplate = {
  title: string;
  summary: string;
  evidenceChecklist: string[];
  escalationRule: string;
  commonPitfalls: string[];
};

const CONTINUITY_PILOT_WORKSPACE_SIZE_PROFILE = {
  smallMaxSessions: 3,
  growingMaxSessions: 7,
} as const;

function toRuntimePercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function getRuntimeContinuityWorkspaceSizeBand(
  totalSessions: number,
): RuntimeContinuityWorkspaceSizeBand {
  if (totalSessions <= CONTINUITY_PILOT_WORKSPACE_SIZE_PROFILE.smallMaxSessions) return "SMALL";
  if (totalSessions <= CONTINUITY_PILOT_WORKSPACE_SIZE_PROFILE.growingMaxSessions) return "GROWING";
  return "LARGE";
}

export function getRuntimeContinuityMeetingShape(
  item: RuntimeContinuityMeetingShapeInput,
): RuntimeContinuityMeetingShape {
  if (
    item.posture === "COMPACT" ||
    item.payloadStateSource === "checkpoint_plus_edits" ||
    (item.payloadStateSource === "checkpoint_snapshot" && item.replayStatus !== "NONE")
  ) {
    return "RESUMED_MEETING";
  }
  if (
    item.posture === "PRUNE" ||
    item.payloadStateSource === "latest_prune_edit" ||
    item.replayStatus === "WATCH" ||
    item.replayStatus === "WEAK"
  ) {
    return "LONG_CONTEXT_MEETING";
  }
  return "LEAN_MEETING";
}

export function getRuntimeContinuitySessionDensityBand(
  input: RuntimeContinuitySessionDensityInput,
): RuntimeContinuitySessionDensityBand {
  const budgetRatio = input.budgetTokenLimit > 0 ? input.budgetTokenUsed / input.budgetTokenLimit : 0;
  if (input.posture === "COMPACT" || budgetRatio >= 0.85 || input.prunedTokenCount >= 1600) {
    return "HEAVY";
  }
  if (
    input.posture === "PRUNE" ||
    input.posture === "WATCH" ||
    budgetRatio >= 0.55 ||
    input.prunedTokenCount >= 400
  ) {
    return "STEADY";
  }
  return "LIGHT";
}

export function getRuntimeContinuityFailureHistoryBand(
  input: RuntimeContinuityFailureHistoryInput,
): RuntimeContinuityFailureHistoryBand {
  if (input.repeatPatternStatus !== "NONE" || input.remediationAttempts >= 3) {
    return "CHRONIC_REPEAT";
  }
  if (input.remediationAttempts >= 1) {
    return "REPEATED_FAILURE";
  }
  return "FIRST_SIGNAL";
}

export function getRuntimeContinuityParticipantRolePosture(
  input: RuntimeContinuityParticipantRolePostureInput,
): RuntimeContinuityParticipantRolePosture {
  const joined = [input.attendeesSummary ?? "", ...input.contactTitles].join(" ").toLowerCase();
  if (!joined.trim()) return "UNKNOWN";

  const execLike =
    /\b(chief|ceo|cfo|coo|cto|founder|president|vice president|vp|svp|evp|general manager|gm|head)\b/i.test(
      joined,
    );
  const operatorLike =
    /\b(manager|lead|operations|ops|program|project|analyst|specialist|coordinator|engineer|implementation|delivery|customer success|support|consultant)\b/i.test(
      joined,
    );

  if (execLike && operatorLike) return "MIXED_STAKEHOLDERS";
  if (execLike) return "EXEC_SPONSORED";
  if (operatorLike) return "OPERATOR_LED";
  return "UNKNOWN";
}

export function buildRuntimeContinuityMeetingFrequencyBandMap(
  sessions: RuntimeContinuityMeetingFrequencySession[],
): Map<string, RuntimeContinuityMeetingFrequencyBand> {
  const referenceTime = (item: RuntimeContinuityMeetingFrequencySession) => item.meetingStartsAt ?? item.updatedAt;
  const map = new Map<string, RuntimeContinuityMeetingFrequencyBand>();

  for (const session of sessions) {
    const anchor = referenceTime(session);
    const relatedCount = sessions.filter((candidate) => {
      if (candidate.id === session.id) return false;
      if (session.opportunityId && candidate.opportunityId) {
        return session.opportunityId === candidate.opportunityId;
      }
      if (session.companyId && candidate.companyId) {
        return session.companyId === candidate.companyId;
      }
      return false;
    });
    const countWithinDays = (days: number) =>
      relatedCount.filter((candidate) => {
        const deltaMs = Math.abs(referenceTime(candidate).getTime() - anchor.getTime());
        return deltaMs <= days * 24 * 60 * 60 * 1000;
      }).length + 1;

    const cadence14 = countWithinDays(14);
    const cadence30 = countWithinDays(30);

    map.set(
      session.id,
      cadence14 >= 3 || cadence30 >= 4 ? "HIGH_CADENCE" : cadence30 >= 2 ? "RECURRING" : "SPORADIC",
    );
  }

  return map;
}

export function getRuntimeContinuityPilotConfidenceBand(
  input: {
    driftRate: number;
    longHorizonDriftRate: number;
    ineffectiveRate: number;
    repeatPatternRate: number;
    lowConfidenceRate: number;
    skippedGuidanceRate: number;
    ineffectiveAfterGuidanceRate: number;
  },
  profile: RuntimeContinuityPilotEffectivenessReviewProfile,
): RuntimeContinuityConfidenceBand {
  if (
    input.driftRate >= profile.lowBandDriftRate ||
    input.longHorizonDriftRate >= profile.lowBandLongHorizonDriftRate ||
    input.ineffectiveRate >= profile.lowBandIneffectiveRate ||
    input.repeatPatternRate >= profile.lowBandRepeatPatternRate ||
    input.lowConfidenceRate >= profile.lowBandConfidenceRate ||
    input.skippedGuidanceRate >= profile.lowBandSkippedGuidanceRate ||
    input.ineffectiveAfterGuidanceRate >= profile.lowBandIneffectiveAfterGuidanceRate
  ) {
    return "LOW";
  }
  if (
    input.driftRate >= profile.mediumBandDriftRate ||
    input.longHorizonDriftRate >= profile.mediumBandLongHorizonDriftRate ||
    input.ineffectiveRate >= profile.mediumBandIneffectiveRate ||
    input.repeatPatternRate >= profile.mediumBandRepeatPatternRate ||
    input.lowConfidenceRate >= profile.mediumBandConfidenceRate ||
    input.skippedGuidanceRate >= profile.mediumBandSkippedGuidanceRate ||
    input.ineffectiveAfterGuidanceRate >= profile.mediumBandIneffectiveAfterGuidanceRate
  ) {
    return "MEDIUM";
  }
  return "HIGH";
}

export function getRuntimeContinuityPilotRiskBand(
  confidenceBand: RuntimeContinuityConfidenceBand,
): RuntimeContinuityPilotRiskBand {
  if (confidenceBand === "LOW") return "HIGH";
  if (confidenceBand === "MEDIUM") return "WATCH";
  return "LOW";
}

export function getRuntimeContinuitySampleCoverageBand(
  sessionCount: number,
  totalPilotCases: number,
): RuntimeContinuitySampleCoverageBand {
  const sessionRate = toRuntimePercent(sessionCount, Math.max(totalPilotCases, 1));
  if (sessionCount >= 5 || (totalPilotCases >= 8 && sessionRate >= 40)) {
    return "BROAD";
  }
  if (sessionCount >= 3 || (totalPilotCases >= 6 && sessionRate >= 30)) {
    return "QUALIFIED";
  }
  return "NARROW";
}

export function getRuntimeContinuityStabilityThreshold(
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand,
) {
  if (sampleCoverageBand === "NARROW") return 80;
  if (sampleCoverageBand === "QUALIFIED") return 70;
  return 65;
}

export function getRuntimeContinuityStabilityScore(input: {
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  driftRate: number;
  longHorizonDriftRate: number;
  repeatPatternRate?: number;
  reviewRequiredRate?: number;
  skippedGuidanceRate?: number;
  ineffectiveAfterGuidanceRate?: number;
  effectivenessChange?: number;
  outcomeDelta?: number;
}) {
  let score = 100;

  if (input.sampleCoverageBand === "NARROW") score -= 25;
  else if (input.sampleCoverageBand === "QUALIFIED") score -= 10;

  if (input.longHorizonDriftRate >= 60) score -= 30;
  else if (input.longHorizonDriftRate >= 45) score -= 20;
  else if (input.longHorizonDriftRate >= 30) score -= 10;

  if (input.driftRate >= 60) score -= 15;
  else if (input.driftRate >= 40) score -= 10;
  else if (input.driftRate >= 25) score -= 5;

  const repeatPressure = Math.max(
    input.repeatPatternRate ?? 0,
    input.skippedGuidanceRate ?? 0,
    input.ineffectiveAfterGuidanceRate ?? 0,
  );
  if (repeatPressure >= 30) score -= 20;
  else if (repeatPressure >= 15) score -= 10;
  else if (repeatPressure >= 5) score -= 5;

  if ((input.reviewRequiredRate ?? 0) >= 50) score -= 10;
  else if ((input.reviewRequiredRate ?? 0) >= 30) score -= 5;

  const volatility = Math.max(Math.abs(input.effectivenessChange ?? 0), Math.abs(input.outcomeDelta ?? 0));
  if (volatility >= 20) score -= 15;
  else if (volatility >= 10) score -= 8;

  if ((input.effectivenessChange ?? 0) >= 10 && input.longHorizonDriftRate < 30) score += 5;
  if ((input.outcomeDelta ?? 0) >= 10 && repeatPressure < 15) score += 5;

  return Math.max(0, Math.min(100, score));
}

export function getRuntimeContinuityStabilityBand(
  stabilityScore: number,
  stabilityThreshold: number,
): RuntimeContinuityStabilityBand {
  if (stabilityScore >= stabilityThreshold) return "STABLE";
  if (stabilityScore >= stabilityThreshold - 15) return "WATCH";
  return "UNSTABLE";
}

export function getRuntimeContinuityStabilityVariance(input: {
  driftRateDelta: number;
  effectivenessChange: number;
  repeatPatternRate?: number;
  ineffectiveAfterGuidanceRate?: number;
}) {
  return Math.max(
    Math.abs(input.driftRateDelta),
    Math.abs(input.effectivenessChange),
    input.repeatPatternRate ?? 0,
    input.ineffectiveAfterGuidanceRate ?? 0,
  );
}

export function getRuntimeContinuityStabilityConfidenceBand(input: {
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  stabilityBand: RuntimeContinuityStabilityBand;
  stabilityVariance: number;
}): RuntimeContinuityConfidenceBand {
  if (
    input.sampleCoverageBand === "NARROW" ||
    input.stabilityBand === "UNSTABLE" ||
    input.stabilityVariance >= 25
  ) {
    return "LOW";
  }
  if (
    input.sampleCoverageBand === "QUALIFIED" ||
    input.stabilityBand === "WATCH" ||
    input.stabilityVariance >= 12
  ) {
    return "MEDIUM";
  }
  return "HIGH";
}

export function buildRuntimeContinuityStabilitySummary(
  scope: string,
  input: {
    stabilityBand: RuntimeContinuityStabilityBand;
    stabilityScore: number;
    stabilityThreshold: number;
    sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
    longHorizonDriftRate: number;
    repeatPatternRate?: number;
    reviewRequiredRate?: number;
    effectivenessChange?: number;
    outcomeDelta?: number;
  },
) {
  const scoreSummary = `${input.stabilityScore}/${input.stabilityThreshold}`;
  if (input.stabilityBand === "UNSTABLE") {
    return `${scope} stays unstable on the current pilot readout (${scoreSummary}) because the sample is ${input.sampleCoverageBand.toLowerCase()}, long-horizon drift is ${input.longHorizonDriftRate}%, and repeat or variance pressure is still too high.`;
  }
  if (input.stabilityBand === "STABLE") {
    return `${scope} clears the current pilot stability threshold (${scoreSummary}) and now looks comparatively steady, with ${input.sampleCoverageBand.toLowerCase()} sample support and no major long-horizon instability signal.`;
  }
  return `${scope} remains watch-level on subgroup stability (${scoreSummary}); keep review-first handling because long-horizon drift or variance still needs monitoring.`;
}

export function buildRuntimeContinuityStabilityVarianceSummary(
  scope: string,
  input: {
    stabilityVariance: number;
    stabilityConfidenceBand: RuntimeContinuityConfidenceBand;
    sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
    stabilityBand: RuntimeContinuityStabilityBand;
  },
) {
  if (input.stabilityConfidenceBand === "LOW") {
    return `${scope} still shows high subgroup stability variance (${input.stabilityVariance}%) with ${input.sampleCoverageBand.toLowerCase()} support, so the recheck stays ${input.stabilityBand.toLowerCase()} and operator confidence should remain conservative.`;
  }
  if (input.stabilityConfidenceBand === "HIGH") {
    return `${scope} now shows comparatively low subgroup stability variance (${input.stabilityVariance}%) with ${input.sampleCoverageBand.toLowerCase()} support, so the recheck is stable enough for a stronger operator-visible readout.`;
  }
  return `${scope} still has mixed subgroup stability variance (${input.stabilityVariance}%), so keep this recheck operator-visible but review-first until more pilot evidence lands.`;
}

export function getRuntimeContinuityCanonicalIntervalWording(
  confidenceInterval: RuntimeContinuityConfidenceInterval,
) {
  switch (confidenceInterval) {
    case "WIDE":
      return "Wide confidence interval: advisory-only readout; keep review-first and cross-check local evidence before reuse.";
    case "GUARDED":
      return "Guarded confidence interval: operator-visible readout; confirm against evidence and rollback anchor before reuse.";
    case "SETTLED":
      return "Settled confidence interval: comparatively stable review readout; it still does not expand execution authority.";
  }
}

export function buildRuntimeContinuityIntervalWordingSummary(
  scope: string,
  confidenceInterval: RuntimeContinuityConfidenceInterval,
) {
  return `${scope}: ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)}`;
}

export function getRuntimeContinuityStabilityAwareConfidenceBand(
  confidenceBand: RuntimeContinuityConfidenceBand,
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand,
  stabilityBand: RuntimeContinuityStabilityBand,
): RuntimeContinuityConfidenceBand {
  let adjusted = confidenceBand;
  if (sampleCoverageBand === "NARROW" && adjusted === "HIGH") {
    adjusted = "MEDIUM";
  }
  if (stabilityBand === "WATCH" && adjusted === "HIGH" && sampleCoverageBand !== "BROAD") {
    adjusted = "MEDIUM";
  }
  if (stabilityBand === "UNSTABLE") {
    adjusted = adjusted === "HIGH" ? "MEDIUM" : "LOW";
  }
  return adjusted;
}

export function getRuntimeContinuityConfidenceInterval(input: {
  confidenceBand: RuntimeContinuityConfidenceBand;
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  stabilityBand: RuntimeContinuityStabilityBand;
}): RuntimeContinuityConfidenceInterval {
  if (
    input.sampleCoverageBand === "NARROW" ||
    input.stabilityBand === "UNSTABLE" ||
    input.confidenceBand === "LOW"
  ) {
    return "WIDE";
  }
  if (
    input.sampleCoverageBand === "QUALIFIED" ||
    input.stabilityBand === "WATCH" ||
    input.confidenceBand === "MEDIUM"
  ) {
    return "GUARDED";
  }
  return "SETTLED";
}

export function buildRuntimeContinuityBandAdjustmentRationale(
  scope: string,
  input: {
    rawConfidenceBand: RuntimeContinuityConfidenceBand;
    confidenceBand: RuntimeContinuityConfidenceBand;
    confidenceInterval: RuntimeContinuityConfidenceInterval;
    sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
    stabilityBand: RuntimeContinuityStabilityBand;
  },
) {
  const bandChange =
    input.rawConfidenceBand === input.confidenceBand
      ? `${input.confidenceBand} band is preserved`
      : `${input.rawConfidenceBand} band is downgraded to ${input.confidenceBand}`;
  if (input.confidenceInterval === "WIDE") {
    return `${scope} keeps a wide confidence interval because ${bandChange}, the sample is ${input.sampleCoverageBand.toLowerCase()}, and subgroup stability is ${input.stabilityBand.toLowerCase()}. ${getRuntimeContinuityCanonicalIntervalWording("WIDE")}`;
  }
  if (input.confidenceInterval === "SETTLED") {
    return `${scope} is one of the few subgroups where ${bandChange} and the settled confidence interval readout can stay visible because sample coverage is broad and stability is currently strong. ${getRuntimeContinuityCanonicalIntervalWording("SETTLED")}`;
  }
  return `${scope} keeps a guarded confidence interval because ${bandChange}, but sample coverage or subgroup stability is not strong enough to present a settled readout. ${getRuntimeContinuityCanonicalIntervalWording("GUARDED")}`;
}

function getRuntimeContinuityMaterialImpactBand(input: {
  applicableCases: number;
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  correlationBand: RuntimeContinuityOutcomeCorrelationBand;
  outcomeDelta: number;
  reviewRequiredOutcomeRate: number;
  ineffectiveAfterHitRate: number;
}): RuntimeContinuityPilotRiskBand {
  if (
    input.applicableCases >= 3 &&
    (input.correlationBand !== "WATCH" ||
      Math.abs(input.outcomeDelta) >= 15 ||
      input.reviewRequiredOutcomeRate >= 40 ||
      input.ineffectiveAfterHitRate >= 20)
  ) {
    return "HIGH";
  }
  if (
    input.applicableCases >= 2 ||
    input.sampleCoverageBand !== "NARROW" ||
    Math.abs(input.outcomeDelta) >= 8 ||
    input.reviewRequiredOutcomeRate >= 20 ||
    input.ineffectiveAfterHitRate >= 10
  ) {
    return "WATCH";
  }
  return "LOW";
}

function buildRuntimeContinuityMaterialImpactSummary(
  scope: string,
  input: {
    materialImpactBand: RuntimeContinuityPilotRiskBand;
    correlationBand: RuntimeContinuityOutcomeCorrelationBand;
    longHorizonEffectiveOutcomeRate: number;
    reviewRequiredOutcomeRate: number;
    outcomeDelta: number;
  },
) {
  if (input.materialImpactBand === "HIGH") {
    return input.correlationBand === "AT_RISK"
      ? `${scope} now shows high material impact on long-term outcomes in the negative direction: review-required outcomes remain ${input.reviewRequiredOutcomeRate}% and the longer-horizon signal still stays at-risk.`
      : `${scope} now shows high material impact on long-term outcomes in the positive direction: effective outcomes stay ${input.longHorizonEffectiveOutcomeRate}% and the longer-horizon signal remains comparatively stable.`;
  }
  if (input.materialImpactBand === "WATCH") {
    return `${scope} currently shows watch-level material impact on long-term outcomes; outcome delta is ${input.outcomeDelta} and operators should keep this step visible but not overclaim its effect.`;
  }
  return `${scope} currently shows low material impact on long-term outcomes because the pilot sample is still too thin to narrow the guidance further.`;
}

export function buildRuntimeContinuitySampleCoverageSummary(
  scope: string,
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand,
  sessionCount: number,
  sessionRate: number,
) {
  if (sampleCoverageBand === "BROAD") {
    return `${scope} now sits on a broader pilot sample (${sessionCount} case(s), ${sessionRate}%), so threshold and confidence guidance is better supported by observed continuity outcomes.`;
  }
  if (sampleCoverageBand === "QUALIFIED") {
    return `${scope} has a qualified pilot sample (${sessionCount} case(s), ${sessionRate}%), so guidance can be shown operator-visible but should still stay review-first.`;
  }
  return `${scope} still sits on a narrow pilot sample (${sessionCount} case(s), ${sessionRate}%), so threshold and confidence guidance stays advisory only.`;
}

export function buildRuntimeContinuityConfidenceSummary(input: {
  confidenceBand: RuntimeContinuityConfidenceBand;
  riskBand: RuntimeContinuityPilotRiskBand;
  driftRate: number;
  longHorizonDriftRate: number;
  skippedGuidanceRate: number;
  ineffectiveAfterGuidanceRate: number;
}) {
  if (input.riskBand === "HIGH") {
    return `Risk stays HIGH because drift is ${input.driftRate}% now, ${input.longHorizonDriftRate}% across the longer pilot horizon, skipped guidance is ${input.skippedGuidanceRate}%, and ineffective-after-guidance is ${input.ineffectiveAfterGuidanceRate}%.`;
  }
  if (input.riskBand === "WATCH") {
    return `Risk stays WATCH because drift is ${input.driftRate}% now, ${input.longHorizonDriftRate}% across the longer pilot horizon, and guidance slippage is still visible.`;
  }
  return `Risk stays LOW because drift is ${input.driftRate}% now, ${input.longHorizonDriftRate}% across the longer pilot horizon, and no major guidance slippage is visible.`;
}

function getRuntimeContinuityOutcomeCorrelationBand(input: {
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  longHorizonEffectiveOutcomeRate: number;
  reviewRequiredOutcomeRate: number;
  ineffectiveAfterHitRate: number;
  skippedGuidanceRate: number;
  outcomeDelta: number;
}): RuntimeContinuityOutcomeCorrelationBand {
  if (
    input.reviewRequiredOutcomeRate >= 50 ||
    input.ineffectiveAfterHitRate >= 25 ||
    input.outcomeDelta <= -15
  ) {
    return "AT_RISK";
  }
  if (
    input.sampleCoverageBand === "NARROW" ||
    input.skippedGuidanceRate >= 25 ||
    input.longHorizonEffectiveOutcomeRate < 50
  ) {
    return "WATCH";
  }
  return "STABLE";
}

function buildRuntimeContinuityOutcomeCorrelationSummary(
  scope: string,
  outcomeCorrelationBand: RuntimeContinuityOutcomeCorrelationBand,
  input: {
    longHorizonEffectiveOutcomeRate: number;
    recentEffectiveOutcomeRate: number;
    olderEffectiveOutcomeRate: number;
    reviewRequiredOutcomeRate: number;
    ineffectiveAfterHitRate: number;
    sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  },
) {
  if (outcomeCorrelationBand === "AT_RISK") {
    return `${scope} stays at-risk across the longer pilot horizon: effective outcomes are ${input.longHorizonEffectiveOutcomeRate}%, review-required outcomes are ${input.reviewRequiredOutcomeRate}%, and ineffective-after-hit remains ${input.ineffectiveAfterHitRate}%.`;
  }
  if (outcomeCorrelationBand === "STABLE") {
    return `${scope} stays comparatively stable across the longer pilot horizon: effective outcomes hold at ${input.longHorizonEffectiveOutcomeRate}% with recent ${input.recentEffectiveOutcomeRate}% vs older ${input.olderEffectiveOutcomeRate}%.`;
  }
  return `${scope} stays watch-level across the longer pilot horizon: effective outcomes are ${input.longHorizonEffectiveOutcomeRate}% with recent ${input.recentEffectiveOutcomeRate}% vs older ${input.olderEffectiveOutcomeRate}%, and the current sample is ${input.sampleCoverageBand.toLowerCase()}.`;
}

export function getRuntimeContinuityPilotThreshold(
  confidenceBand: RuntimeContinuityConfidenceBand,
  profile: RuntimeContinuityPilotEffectivenessReviewProfile,
) {
  return confidenceBand === "LOW"
    ? profile.earlyIneffectiveThreshold
    : profile.defaultIneffectiveThreshold;
}

export function getRuntimeContinuityTopFailureClass(
  items: Array<Pick<RuntimeContinuityPilotCase, "failureTaxonomy">>,
): Exclude<RuntimeContinuityFailureTaxonomy, "NONE"> | null {
  const counts = new Map<Exclude<RuntimeContinuityFailureTaxonomy, "NONE">, number>();
  for (const item of items) {
    if (item.failureTaxonomy === "NONE") continue;
    counts.set(item.failureTaxonomy, (counts.get(item.failureTaxonomy) ?? 0) + 1);
  }

  let top: Exclude<RuntimeContinuityFailureTaxonomy, "NONE"> | null = null;
  let topCount = 0;
  for (const [failureTaxonomy, count] of counts.entries()) {
    if (count > topCount) {
      top = failureTaxonomy;
      topCount = count;
    }
  }
  return top;
}

export function getRuntimeContinuitySopStepReviewTarget(
  failureTaxonomy: RuntimeContinuityFailureTaxonomy,
): Pick<RuntimeContinuitySopStepReview, "stepId" | "label"> | null {
  switch (failureTaxonomy) {
    case "NO_RECOVERY_ANCHOR":
      return { stepId: "ANCHOR_CHECK", label: "Anchor check" };
    case "BUDGET_PRESSURE":
      return { stepId: "PRUNE_TRACE_REVIEW", label: "Prune trace review" };
    case "PAYLOAD_STATE_DRIFT":
      return { stepId: "HANDLE_LINEAGE_REVIEW", label: "Handle lineage review" };
    case "REPLAY_DRIFT":
      return { stepId: "REPLAY_GAP_REVIEW", label: "Replay gap review" };
    case "PROTECTED_STATE_GAP":
      return { stepId: "PROTECTED_FIELD_REVIEW", label: "Protected field review" };
    case "NONE":
    default:
      return null;
  }
}

export function buildRuntimeContinuityTrendMetrics(items: RuntimeContinuityTrendItem[]) {
  const sorted = [...items].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const splitIndex = Math.max(1, Math.ceil(sorted.length / 2));
  const recent = sorted.slice(0, splitIndex);
  const older = sorted.slice(splitIndex);
  const thirdWindowSize = Math.max(1, Math.ceil(sorted.length / 3));
  const middleStart = Math.min(sorted.length, thirdWindowSize);
  const middleEnd = Math.min(sorted.length, thirdWindowSize * 2);
  const middle = sorted.slice(middleStart, middleEnd);
  const oldest = sorted.slice(middleEnd);
  const successRate = (list: RuntimeContinuityTrendItem[]) =>
    toRuntimePercent(
      list.filter((item) => item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL").length,
      Math.max(list.length, 1),
    );
  const driftRate = (list: RuntimeContinuityTrendItem[]) =>
    toRuntimePercent(
      list.filter((item) => getRuntimeContinuityDriftState(item) === "DRIFTING").length,
      Math.max(list.length, 1),
    );
  const repeatIneffectiveRate = (list: RuntimeContinuityTrendItem[]) =>
    toRuntimePercent(
      list.filter((item) => item.repeatPatternStatus === "REPEATED_INEFFECTIVE_ACTION").length,
      Math.max(list.length, 1),
    );

  const recentDriftRate = driftRate(recent);
  const olderDriftRate = older.length ? driftRate(older) : recentDriftRate;
  const middleDriftRate = middle.length ? driftRate(middle) : olderDriftRate;
  const oldestDriftRate = oldest.length ? driftRate(oldest) : olderDriftRate;
  const longHorizonDriftRate = driftRate(sorted);
  const longHorizonRepeatIneffectiveRate = repeatIneffectiveRate(sorted);
  const longHorizonEffectivenessRate = successRate(sorted);

  return {
    recentDriftRate,
    middleDriftRate,
    olderDriftRate,
    oldestDriftRate,
    longHorizonDriftRate,
    driftRateDelta: recentDriftRate - olderDriftRate,
    recentRepeatIneffectiveRate: repeatIneffectiveRate(recent),
    longHorizonRepeatIneffectiveRate,
    longHorizonEffectivenessRate,
    effectivenessChange: successRate(recent) - (older.length ? successRate(older) : successRate(recent)),
  };
}

export function getRuntimeContinuityGuidanceStatus(
  item: RuntimeContinuityGuidanceItem,
): {
  status: RuntimeContinuityGuidanceStatus;
  summary: string;
} {
  const repeated = item.repeatPatternStatus !== "NONE";

  if (item.failureTaxonomy === "NO_RECOVERY_ANCHOR" || item.failureTaxonomy === "PROTECTED_STATE_GAP") {
    if (repeated) {
      return {
        status: "SKIPPED_GUIDANCE",
        summary:
          item.failureTaxonomy === "NO_RECOVERY_ANCHOR"
            ? "Anchor-first escalation guidance was skipped because the same blocked action kept repeating."
            : "Protected-field review guidance was skipped because bounded remediation kept repeating instead of stopping at review.",
      };
    }
    if (item.recoveryState === "REVIEW_REQUIRED" || item.recoveryState === "BLOCKED") {
      return {
        status: "MATCHED_GUIDANCE",
        summary:
          item.failureTaxonomy === "NO_RECOVERY_ANCHOR"
            ? "Current handling matches anchor-first guidance by keeping the session out of blind retries."
            : "Current handling matches protected-field guidance by holding remediation behind explicit review.",
      };
    }
    return {
      status: "NEEDS_MORE_EVIDENCE",
      summary: "Current pilot evidence is too thin to prove this operator path followed the expected escalation rule.",
    };
  }

  if (item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL") {
    return {
      status: "MATCHED_GUIDANCE",
      summary: "Current handling matches bounded-remediation guidance and is improving continuity posture.",
    };
  }
  if (item.latestEffectiveness === "INEFFECTIVE") {
    return {
      status:
        repeated || item.recoveryState === "REVIEW_REQUIRED" || item.recoveryState === "BLOCKED"
          ? "INEFFECTIVE_AFTER_GUIDANCE"
          : "SKIPPED_GUIDANCE",
      summary:
        repeated || item.recoveryState === "REVIEW_REQUIRED" || item.recoveryState === "BLOCKED"
          ? "The operator followed bounded remediation, but the latest attempt still remained ineffective and now needs review."
          : "Bounded remediation stayed ineffective without moving to a stronger review posture, so guidance likely needs to be re-read before retrying.",
    };
  }
  if (repeated && item.recoveryState === "RECOVERABLE") {
    return {
      status: "SKIPPED_GUIDANCE",
      summary: "Repeat patterns are visible while the session still stays recoverable, so escalation guidance is probably being skipped.",
    };
  }
  return {
    status: "NEEDS_MORE_EVIDENCE",
    summary: "No strong pilot signal yet shows whether the current operator handling matched the intended SOP.",
  };
}

export function buildRuntimeContinuitySopStepReviews(
  pilotCases: RuntimeContinuityPilotCase[],
): RuntimeContinuitySopStepReview[] {
  const grouped = new Map<RuntimeContinuitySopStepReview["stepId"], RuntimeContinuityPilotCase[]>();
  const labels = new Map<RuntimeContinuitySopStepReview["stepId"], string>();

  for (const item of pilotCases) {
    const target = getRuntimeContinuitySopStepReviewTarget(item.failureTaxonomy);
    if (!target) continue;
    const list = grouped.get(target.stepId) ?? [];
    list.push(item);
    grouped.set(target.stepId, list);
    labels.set(target.stepId, target.label);
  }

  return Array.from(grouped.entries())
    .map(([stepId, items]) => {
      const guidanceStatuses = items.map((item) => getRuntimeContinuityGuidanceStatus(item).status);
      const sorted = [...items].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      const splitIndex = Math.max(1, Math.ceil(sorted.length / 2));
      const recent = sorted.slice(0, splitIndex);
      const older = sorted.slice(splitIndex);
      const effectiveRate = (list: RuntimeContinuityPilotCase[]) =>
        toRuntimePercent(
          list.filter((item) => item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL").length,
          Math.max(list.length, 1),
        );
      const matchedGuidanceRate = toRuntimePercent(
        guidanceStatuses.filter((status) => status === "MATCHED_GUIDANCE").length,
        Math.max(items.length, 1),
      );
      const skippedGuidanceRate = toRuntimePercent(
        guidanceStatuses.filter((status) => status === "SKIPPED_GUIDANCE").length,
        Math.max(items.length, 1),
      );
      const ineffectiveAfterHitRate = toRuntimePercent(
        guidanceStatuses.filter((status) => status === "INEFFECTIVE_AFTER_GUIDANCE").length,
        Math.max(items.length, 1),
      );
      const effectiveOutcomeRate = toRuntimePercent(
        items.filter((item) => item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL").length,
        Math.max(items.length, 1),
      );
      const reviewRequiredOutcomeRate = toRuntimePercent(
        items.filter((item) => item.recoveryState === "REVIEW_REQUIRED" || item.recoveryState === "BLOCKED").length,
        Math.max(items.length, 1),
      );
      const sampleCoverageBand = getRuntimeContinuitySampleCoverageBand(items.length, Math.max(pilotCases.length, 1));
      const recentEffectiveOutcomeRate = effectiveRate(recent);
      const olderEffectiveOutcomeRate = older.length ? effectiveRate(older) : recentEffectiveOutcomeRate;
      const longHorizonEffectiveOutcomeRate = effectiveRate(sorted);
      const outcomeDelta = recentEffectiveOutcomeRate - olderEffectiveOutcomeRate;
      const stabilityThreshold = getRuntimeContinuityStabilityThreshold(sampleCoverageBand);
      const stabilityScore = getRuntimeContinuityStabilityScore({
        sampleCoverageBand,
        driftRate: reviewRequiredOutcomeRate,
        longHorizonDriftRate: Math.max(0, 100 - longHorizonEffectiveOutcomeRate),
        skippedGuidanceRate,
        ineffectiveAfterGuidanceRate: ineffectiveAfterHitRate,
        reviewRequiredRate: reviewRequiredOutcomeRate,
        outcomeDelta,
      });
      const stabilityBand = getRuntimeContinuityStabilityBand(stabilityScore, stabilityThreshold);
      const rawConfidenceBand: RuntimeContinuityConfidenceBand =
        reviewRequiredOutcomeRate >= 50 || ineffectiveAfterHitRate >= 25
          ? "LOW"
          : skippedGuidanceRate >= 25 || longHorizonEffectiveOutcomeRate < 60
            ? "MEDIUM"
            : "HIGH";
      const confidenceBand = getRuntimeContinuityStabilityAwareConfidenceBand(
        rawConfidenceBand,
        sampleCoverageBand,
        stabilityBand,
      );
      const confidenceInterval = getRuntimeContinuityConfidenceInterval({
        confidenceBand,
        sampleCoverageBand,
        stabilityBand,
      });
      const stabilityVariance = getRuntimeContinuityStabilityVariance({
        driftRateDelta: outcomeDelta,
        effectivenessChange: outcomeDelta,
        ineffectiveAfterGuidanceRate: ineffectiveAfterHitRate,
        repeatPatternRate: skippedGuidanceRate,
      });
      const stabilityConfidenceBand = getRuntimeContinuityStabilityConfidenceBand({
        sampleCoverageBand,
        stabilityBand,
        stabilityVariance,
      });
      const label = labels.get(stepId) ?? stepId;
      const bandAdjustmentRationale = buildRuntimeContinuityBandAdjustmentRationale(label, {
        rawConfidenceBand,
        confidenceBand,
        confidenceInterval,
        sampleCoverageBand,
        stabilityBand,
      });
      const intervalWordingSummary = buildRuntimeContinuityIntervalWordingSummary(label, confidenceInterval);
      const correlationBand = getRuntimeContinuityOutcomeCorrelationBand({
        sampleCoverageBand,
        longHorizonEffectiveOutcomeRate,
        reviewRequiredOutcomeRate,
        ineffectiveAfterHitRate,
        skippedGuidanceRate,
        outcomeDelta,
      });
      const correlationSummary = buildRuntimeContinuityOutcomeCorrelationSummary(label, correlationBand, {
        longHorizonEffectiveOutcomeRate,
        recentEffectiveOutcomeRate,
        olderEffectiveOutcomeRate,
        reviewRequiredOutcomeRate,
        ineffectiveAfterHitRate,
        sampleCoverageBand,
      });
      const longTermImpactSummary =
        correlationBand === "AT_RISK"
          ? `${label} remains an at-risk long-term SOP signal because subgroup stability is ${stabilityBand.toLowerCase()} and the current interval stays ${confidenceInterval.toLowerCase()}.`
          : correlationBand === "STABLE"
            ? `${label} now shows steadier long-term SOP impact with ${stabilityBand.toLowerCase()} subgroup stability and a ${confidenceInterval.toLowerCase()} confidence interval.`
            : `${label} still shows mixed long-term SOP impact; subgroup stability is ${stabilityBand.toLowerCase()} and the interval remains ${confidenceInterval.toLowerCase()}.`;
      const materialImpactBand = getRuntimeContinuityMaterialImpactBand({
        applicableCases: items.length,
        sampleCoverageBand,
        correlationBand,
        outcomeDelta,
        reviewRequiredOutcomeRate,
        ineffectiveAfterHitRate,
      });
      const materialImpactSummary = buildRuntimeContinuityMaterialImpactSummary(label, {
        materialImpactBand,
        correlationBand,
        longHorizonEffectiveOutcomeRate,
        reviewRequiredOutcomeRate,
        outcomeDelta,
      });

      const summary =
        ineffectiveAfterHitRate >= 25
          ? `${label} is being followed in part, but ineffective outcomes remain too common in the current pilot sample.`
          : skippedGuidanceRate >= 25
            ? `${label} is still skipped often enough to explain part of the operator outcome variance.`
            : effectiveOutcomeRate >= 50 && matchedGuidanceRate >= 50
              ? `${label} currently correlates with more effective continuity recovery outcomes across the longer pilot horizon.`
              : `${label} still needs more pilot evidence before its long-term outcome effect is stable.`;

      const improvementHint =
        correlationBand === "AT_RISK"
          ? `Tighten ${label.toLowerCase()} evidence collection before repeating the same remediation path.`
          : correlationBand === "WATCH"
            ? `Keep ${label.toLowerCase()} explicit in the operator runbook, but treat the current readout as advisory until more pilot evidence lands.`
            : `Keep ${label.toLowerCase()} prominent because it currently aligns with steadier long-term outcomes.`;

      return {
        stepId,
        label,
        applicableCases: items.length,
        matchedGuidanceRate,
        skippedGuidanceRate,
        ineffectiveAfterHitRate,
        effectiveOutcomeRate,
        reviewRequiredOutcomeRate,
        sampleCoverageBand,
        stabilityBand,
        stabilityConfidenceBand,
        confidenceInterval,
        bandAdjustmentRationale,
        intervalWordingSummary,
        recentEffectiveOutcomeRate,
        olderEffectiveOutcomeRate,
        longHorizonEffectiveOutcomeRate,
        outcomeDelta,
        correlationBand,
        correlationSummary,
        longTermImpactSummary,
        materialImpactBand,
        materialImpactSummary,
        summary,
        improvementHint,
      };
    })
    .sort((left, right) => {
      if (right.applicableCases !== left.applicableCases) return right.applicableCases - left.applicableCases;
      if (right.skippedGuidanceRate !== left.skippedGuidanceRate) {
        return right.skippedGuidanceRate - left.skippedGuidanceRate;
      }
      return right.ineffectiveAfterHitRate - left.ineffectiveAfterHitRate;
    });
}

export function getRuntimeContinuityDriftState(
  item: Pick<
    RuntimeContinuityTrendItem,
    "latestEffectiveness" | "repeatPatternStatus" | "calibrationConfidence" | "recoveryState"
  >,
): RuntimeContinuityDriftState {
  if (item.latestEffectiveness === "EFFECTIVE" || item.latestEffectiveness === "PARTIAL") {
    return "IMPROVING";
  }
  if (
    item.latestEffectiveness === "INEFFECTIVE" ||
    item.repeatPatternStatus !== "NONE" ||
    (item.latestEffectiveness === "NO_SIGNAL" && item.recoveryState !== "STABLE") ||
    item.calibrationConfidence === "LOW"
  ) {
    return "DRIFTING";
  }
  return "STABLE";
}

export function buildRuntimeContinuityFailureClassSopTemplate(
  failureTaxonomy: RuntimeContinuityFailureTaxonomy,
): RuntimeContinuitySopTemplate {
  switch (failureTaxonomy) {
    case "NO_RECOVERY_ANCHOR":
      return {
        title: "Anchor-first recovery SOP",
        summary:
          "Do not retry bounded remediation until a trustworthy checkpoint anchor exists and the operator agrees it is the right rollback point.",
        evidenceChecklist: [
          "Verify that a rollback anchor exists and is still READY.",
          "Confirm the anchor snapshot is newer than the current noisy remediation loop.",
          "Record why this anchor is the safe continuity baseline before any restore or checkpoint save.",
        ],
        escalationRule:
          "Escalate to review-required as soon as the surface has no recovery anchor or the same blocked action repeats.",
        commonPitfalls: [
          "Saving a new checkpoint from an already noisy continuity state.",
          "Trying reprune or resume before proving which anchor is canonical.",
        ],
      };
    case "BUDGET_PRESSURE":
      return {
        title: "Budget-pressure recovery SOP",
        summary:
          "Treat budget pressure as a preservation problem first: confirm blockers, decisions, owners, due dates, and boundary notes before any further pruning.",
        evidenceChecklist: [
          "Check the latest prune trace before/after summary and tokens saved.",
          "Confirm blockers, next actions, owners, and due dates still appear in the notebook or checkpoint.",
          "Verify active/pruned payload handles still match the current continuity state.",
        ],
        escalationRule:
          "Escalate after repeated reprune or ineffective recovery when budget pressure stays unresolved across the same failure class.",
        commonPitfalls: [
          "Using reprune as a default retry instead of checking what was already removed.",
          "Letting budget pressure hide protected field loss behind shorter context.",
        ],
      };
    case "PAYLOAD_STATE_DRIFT":
      return {
        title: "Payload-state review SOP",
        summary:
          "When payload state drifts, first reconcile active handles, pruned handles, and checkpoint derivation before trusting downstream continuity posture.",
        evidenceChecklist: [
          "Compare active handles against checkpoint snapshot plus later edits.",
          "Confirm externalized payload handle, preview, and summary still point to the same source object.",
          "Verify pruned handle lineage still explains why each removed payload is safe to defer.",
        ],
        escalationRule:
          "Escalate once payload lineage cannot be reconciled locally or the same drift appears after a fresh checkpoint save.",
        commonPitfalls: [
          "Treating latest persisted payloads as equivalent to currently active handles.",
          "Assuming checkpoint snapshots already include later prune edits without checking derivation.",
        ],
      };
    case "REPLAY_DRIFT":
      return {
        title: "Replay-fidelity recovery SOP",
        summary:
          "Replay drift means continuity facts may no longer line up with the checkpoint; confirm the missing fields before trusting recovery.",
        evidenceChecklist: [
          "Inspect replay missing fields and fidelity status first.",
          "Check whether the payload state source came from checkpoint snapshot, later edits, or all persisted handles.",
          "Verify the rollback anchor and latest checkpoint still describe the same continuity boundary.",
        ],
        escalationRule:
          "Escalate to review-required when replay stays WATCH or WEAK after remediation, or when repeated ineffective recovery keeps the same replay gap open.",
        commonPitfalls: [
          "Treating a restored checkpoint as sufficient without checking the missing fields list.",
          "Treating weak replay fidelity as good enough for operator-visible certainty.",
        ],
      };
    case "PROTECTED_STATE_GAP":
      return {
        title: "Protected-field review SOP",
        summary:
          "Protected-state gaps mean the compacted context may have lost blockers, decisions, owners, due dates, or boundary notes that should never be silently dropped.",
        evidenceChecklist: [
          "Check whether blockers, decisions, next actions, owners, due dates, and boundary notes still survive in notebook state.",
          "Compare protected field presence between the saved checkpoint and the live notebook.",
          "Review whether a recent prune or checkpoint save happened just before the protected-state gap appeared.",
        ],
        escalationRule:
          "Escalate immediately to review-required; do not use remediation as a shortcut around protected-field review.",
        commonPitfalls: [
          "Treating partial notebook summaries as sufficient proof that protected fields survived.",
          "Allowing repeated bounded remediation after protected-state loss is already visible.",
        ],
      };
    case "NONE":
    default:
      return {
        title: "Continuity review SOP",
        summary:
          "No dominant continuity failure class is visible yet, so keep the operator workflow review-first and evidence-first.",
        evidenceChecklist: [
          "Check the latest checkpoint, notebook, and payload state before retrying bounded remediation.",
          "Verify whether the current remediation path is actually improving continuity posture.",
          "Keep boundary notes visible while the pilot sample is still thin.",
        ],
        escalationRule:
          "Escalate whenever repeated retries appear without clearer evidence or a stronger rollback anchor.",
        commonPitfalls: [
          "Assuming no named failure class means the continuity state is safe.",
          "Using missing taxonomy as a reason to skip evidence review.",
        ],
      };
  }
}
