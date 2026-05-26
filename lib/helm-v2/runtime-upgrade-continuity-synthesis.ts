import { buildRuntimeContinuityMaterialImpactReview } from "@/lib/helm-v2/runtime-upgrade-continuity-impact";

type RuntimeContinuityStepReview = {
  stepId:
    | "ANCHOR_CHECK"
    | "PRUNE_TRACE_REVIEW"
    | "HANDLE_LINEAGE_REVIEW"
    | "REPLAY_GAP_REVIEW"
    | "PROTECTED_FIELD_REVIEW";
  label: string;
  applicableCases: number;
  matchedGuidanceRate: number;
  skippedGuidanceRate: number;
  ineffectiveAfterHitRate: number;
  effectiveOutcomeRate: number;
  sampleCoverageBand: "NARROW" | "QUALIFIED" | "BROAD";
  stabilityBand: "UNSTABLE" | "WATCH" | "STABLE";
  stabilityConfidenceBand: "HIGH" | "MEDIUM" | "LOW";
  confidenceInterval: "WIDE" | "GUARDED" | "SETTLED";
  bandAdjustmentRationale: string;
  correlationBand: "AT_RISK" | "WATCH" | "STABLE";
  correlationSummary: string;
  longHorizonEffectiveOutcomeRate: number;
  outcomeDelta: number;
  materialImpactBand: "HIGH" | "WATCH" | "LOW";
  materialImpactSummary: string;
  longTermImpactSummary: string;
  improvementHint: string;
};

export type RuntimeContinuitySynthesis = ReturnType<typeof buildRuntimeContinuityMaterialImpactReview> & {
  longTermOutcomeCorrelation: {
    summary: string;
    aggregateSummary: string;
    panels: string[];
  };
  sopEffectivenessSynthesis: {
    summary: string;
    aggregateSummary: string;
    highlights: string[];
  };
  longTermSopImpact: {
    summary: string;
    aggregateSummary: string;
    highlights: string[];
  };
  longTermOutcomeReview: {
    summary: string;
    aggregateSummary: string;
    highlights: string[];
  };
  guidanceRefinement: {
    summary: string;
    highlights: string[];
  };
};

function buildMostStableStep(stepReviews: RuntimeContinuityStepReview[]) {
  return (
    [...stepReviews].sort((left, right) => {
      if (right.effectiveOutcomeRate !== left.effectiveOutcomeRate) {
        return right.effectiveOutcomeRate - left.effectiveOutcomeRate;
      }
      return right.matchedGuidanceRate - left.matchedGuidanceRate;
    })[0] ?? null
  );
}

function buildMaterialImpactRanking(stepReviews: RuntimeContinuityStepReview[]) {
  const materialImpactSteps = [...stepReviews].sort((left, right) => {
    const bandPriority = { HIGH: 3, WATCH: 2, LOW: 1 } as const;
    if (bandPriority[right.materialImpactBand] !== bandPriority[left.materialImpactBand]) {
      return bandPriority[right.materialImpactBand] - bandPriority[left.materialImpactBand];
    }
    if (right.applicableCases !== left.applicableCases) {
      return right.applicableCases - left.applicableCases;
    }
    return Math.abs(right.outcomeDelta) - Math.abs(left.outcomeDelta);
  });
  const highestMaterialImpactStep = materialImpactSteps[0] ?? null;
  const secondaryMaterialImpactStep =
    materialImpactSteps.find((item) => item.stepId !== highestMaterialImpactStep?.stepId) ?? null;

  return {
    highestMaterialImpactStep,
    secondaryMaterialImpactStep,
  };
}

function buildAtRiskRanking(stepReviews: RuntimeContinuityStepReview[]) {
  const atRiskCandidateSteps = stepReviews.filter(
    (item) =>
      item.correlationBand !== "STABLE" ||
      item.stabilityBand !== "STABLE" ||
      item.confidenceInterval !== "SETTLED" ||
      item.ineffectiveAfterHitRate > 0 ||
      item.skippedGuidanceRate > 0,
  );
  const mostAtRiskStep =
    [...(atRiskCandidateSteps.length ? atRiskCandidateSteps : stepReviews)].sort((left, right) => {
      if (right.ineffectiveAfterHitRate !== left.ineffectiveAfterHitRate) {
        return right.ineffectiveAfterHitRate - left.ineffectiveAfterHitRate;
      }
      return right.skippedGuidanceRate - left.skippedGuidanceRate;
    })[0] ?? null;
  const materiallyAtRiskSteps = atRiskCandidateSteps.filter(
    (item) =>
      item.sampleCoverageBand !== "NARROW" ||
      item.applicableCases >= 2 ||
      item.ineffectiveAfterHitRate >= 25 ||
      item.skippedGuidanceRate >= 25,
  );
  const dominantAtRiskStep =
    [...materiallyAtRiskSteps].sort((left, right) => {
      if (right.ineffectiveAfterHitRate !== left.ineffectiveAfterHitRate) {
        return right.ineffectiveAfterHitRate - left.ineffectiveAfterHitRate;
      }
      if (right.skippedGuidanceRate !== left.skippedGuidanceRate) {
        return right.skippedGuidanceRate - left.skippedGuidanceRate;
      }
      return right.applicableCases - left.applicableCases;
    })[0] ?? null;

  return {
    mostAtRiskStep,
    dominantAtRiskStep,
  };
}

export function buildRuntimeContinuitySynthesis(input: {
  stepReviews: RuntimeContinuityStepReview[];
  failureHistoryHeadline?: string | null;
  thresholdRevisionHeadline?: string | null;
  stabilityReviewHeadline?: string | null;
}): RuntimeContinuitySynthesis {
  const {
    stepReviews,
    failureHistoryHeadline = null,
    thresholdRevisionHeadline = null,
    stabilityReviewHeadline = null,
  } = input;
  const mostStableStep = buildMostStableStep(stepReviews);
  const { highestMaterialImpactStep, secondaryMaterialImpactStep } =
    buildMaterialImpactRanking(stepReviews);
  const { mostAtRiskStep, dominantAtRiskStep } = buildAtRiskRanking(stepReviews);

  const sopEffectivenessHighlights = [
    mostStableStep
      ? `${mostStableStep.label}: hit ${mostStableStep.matchedGuidanceRate}% / effective ${mostStableStep.effectiveOutcomeRate}%`
      : null,
    mostAtRiskStep
      ? `${mostAtRiskStep.label}: skip ${mostAtRiskStep.skippedGuidanceRate}% / ineffective-after-hit ${mostAtRiskStep.ineffectiveAfterHitRate}%`
      : null,
    failureHistoryHeadline,
  ].filter(Boolean) as string[];
  const sopEffectivenessSummary =
    mostAtRiskStep && mostAtRiskStep.ineffectiveAfterHitRate >= 25
      ? "SOP effectiveness synthesis still shows a visible at-risk step; operators should treat the current runbook as guidance plus evidence review, not as a deterministic fix."
      : mostStableStep
        ? "SOP effectiveness synthesis now distinguishes which steps correlate with steadier operator outcomes versus which still create variance."
        : "No subgroup-level SOP effectiveness synthesis is available yet; rely on the existing step review only.";
  const sopAggregateSummary =
    mostStableStep && mostAtRiskStep
      ? `${mostStableStep.label} is the steadiest current step, while ${mostAtRiskStep.label} still contributes the most outcome variance.`
      : mostStableStep
        ? `${mostStableStep.label} is currently the steadiest visible SOP step in the pilot sample.`
        : "No step-level stability signal is strong enough yet to synthesize a sharper SOP effectiveness readout.";

  const longTermOutcomePanels = [
    mostStableStep ? `${mostStableStep.label}: ${mostStableStep.correlationSummary}` : null,
    mostAtRiskStep ? `${mostAtRiskStep.label}: ${mostAtRiskStep.correlationSummary}` : null,
    failureHistoryHeadline,
  ].filter(Boolean) as string[];
  const longTermOutcomeSummary =
    mostAtRiskStep?.correlationBand === "AT_RISK"
      ? "Long-term outcome correlation still shows at least one step with unstable operator outcomes; keep repeat remediation under explicit review."
      : mostStableStep
        ? "Long-term outcome correlation now highlights which SOP steps align with steadier recovery across the larger pilot horizon."
        : "Long-term outcome correlation is still sample-limited and remains advisory.";
  const longTermOutcomeAggregateSummary =
    mostStableStep && mostAtRiskStep
      ? `${mostStableStep.label} remains the most stable long-horizon signal, while ${mostAtRiskStep.label} still needs tighter evidence review.`
      : mostStableStep
        ? `${mostStableStep.label} currently carries the steadiest long-horizon correlation signal.`
        : "No long-horizon step correlation is strong enough yet to narrow the runbook.";

  const longTermSopImpactHighlights = [
    mostStableStep ? `${mostStableStep.label}: ${mostStableStep.longTermImpactSummary}` : null,
    mostAtRiskStep ? `${mostAtRiskStep.label}: ${mostAtRiskStep.longTermImpactSummary}` : null,
    stepReviews.find((item) => item.stabilityBand === "UNSTABLE")?.bandAdjustmentRationale ?? null,
  ].filter(Boolean) as string[];
  const longTermSopImpactSummary =
    dominantAtRiskStep?.stabilityBand === "UNSTABLE"
      ? "Long-term SOP impact is still unstable for at least one high-variance step, so operators should treat hit-rate wins as provisional until subgroup stability improves."
      : mostStableStep?.stabilityBand === "STABLE"
        ? "Long-term SOP impact is now stronger where step correlation and subgroup stability line up, but it still remains review guidance rather than execution logic."
        : "Long-term SOP impact remains mixed; keep step-level readouts tied to subgroup stability before reusing the same runbook path.";
  const longTermSopImpactAggregateSummary =
    mostStableStep && dominantAtRiskStep
      ? `${mostStableStep.label} has the steadiest visible long-term SOP impact, while ${dominantAtRiskStep.label} still needs a wider interval and tighter evidence review.`
      : mostStableStep
        ? `${mostStableStep.label} currently has the steadiest visible long-term SOP impact in the pilot sample.`
        : "No step currently clears both stability and long-term impact requirements strongly enough to narrow the runbook further.";

  const longTermOutcomeReviewHighlights = [
    highestMaterialImpactStep
      ? `${highestMaterialImpactStep.label}: ${highestMaterialImpactStep.materialImpactSummary}`
      : null,
    secondaryMaterialImpactStep
      ? `${secondaryMaterialImpactStep.label}: ${secondaryMaterialImpactStep.materialImpactSummary}`
      : null,
    mostStableStep ? `${mostStableStep.label}: ${mostStableStep.correlationSummary}` : null,
  ].filter(Boolean) as string[];
  const longTermOutcomeReviewSummary =
    highestMaterialImpactStep?.materialImpactBand === "HIGH"
      ? "Long-term outcome review now shows which SOP steps carry the biggest material impact, so operators can separate genuinely important guidance from thinner pilot hints."
      : highestMaterialImpactStep
        ? "Long-term outcome review remains available, but current material impact is still limited by pilot sample size and should stay advisory."
        : "No step currently has enough pilot support to make a sharper long-term outcome impact readout.";
  const longTermOutcomeReviewAggregateSummary =
    highestMaterialImpactStep && secondaryMaterialImpactStep
      ? `${highestMaterialImpactStep.label} currently carries the largest material impact signal, while ${secondaryMaterialImpactStep.label} is the next most material step in the longer-horizon review.`
      : highestMaterialImpactStep
        ? `${highestMaterialImpactStep.label} currently carries the clearest material impact signal in the longer-horizon review.`
        : "No long-term material impact ranking is currently strong enough to tighten the runbook further.";

  const guidanceRefinementHighlights = [
    mostAtRiskStep ? `${mostAtRiskStep.label}: ${mostAtRiskStep.improvementHint}` : null,
    mostStableStep ? `${mostStableStep.label}: ${mostStableStep.improvementHint}` : null,
    thresholdRevisionHeadline,
    stabilityReviewHeadline,
  ].filter(Boolean) as string[];
  const guidanceRefinementSummary =
    dominantAtRiskStep?.correlationBand === "AT_RISK" || dominantAtRiskStep?.stabilityBand === "UNSTABLE"
      ? "Refine the operator runbook by tightening evidence collection around the current at-risk or unstable SOP step before another bounded retry."
      : guidanceRefinementHighlights.length
        ? "Operator guidance can now be refined with subgroup-aware stability, confidence-interval, and long-horizon outcome hints."
        : "No additional guidance refinement signal is strong enough yet beyond the existing runbook.";

  const materialImpactReview = buildRuntimeContinuityMaterialImpactReview({
    stepReviews,
    highestMaterialImpactStep,
    mostStableStep,
    dominantAtRiskStep,
  });

  return {
    longTermOutcomeCorrelation: {
      summary: longTermOutcomeSummary,
      aggregateSummary: longTermOutcomeAggregateSummary,
      panels: longTermOutcomePanels,
    },
    sopEffectivenessSynthesis: {
      summary: sopEffectivenessSummary,
      aggregateSummary: sopAggregateSummary,
      highlights: sopEffectivenessHighlights,
    },
    longTermSopImpact: {
      summary: longTermSopImpactSummary,
      aggregateSummary: longTermSopImpactAggregateSummary,
      highlights: longTermSopImpactHighlights,
    },
    longTermOutcomeReview: {
      summary: longTermOutcomeReviewSummary,
      aggregateSummary: longTermOutcomeReviewAggregateSummary,
      highlights: longTermOutcomeReviewHighlights,
    },
    guidanceRefinement: {
      summary: guidanceRefinementSummary,
      highlights: guidanceRefinementHighlights,
    },
    ...materialImpactReview,
  };
}
