type RuntimeContinuityPilotRiskBand = "LOW" | "WATCH" | "HIGH";
type RuntimeContinuitySampleCoverageBand = "NARROW" | "QUALIFIED" | "BROAD";
type RuntimeContinuityStabilityBand = "STABLE" | "WATCH" | "UNSTABLE";
type RuntimeContinuityConfidenceBand = "LOW" | "MEDIUM" | "HIGH";
type RuntimeContinuityOutcomeCorrelationBand = "AT_RISK" | "WATCH" | "STABLE";

type RuntimeContinuityImpactStepReview = {
  stepId: string;
  label: string;
  materialImpactBand: RuntimeContinuityPilotRiskBand;
  sampleCoverageBand: RuntimeContinuitySampleCoverageBand;
  stabilityBand: RuntimeContinuityStabilityBand;
  stabilityConfidenceBand: RuntimeContinuityConfidenceBand;
  correlationBand: RuntimeContinuityOutcomeCorrelationBand;
  longHorizonEffectiveOutcomeRate: number;
  outcomeDelta: number;
  ineffectiveAfterHitRate: number;
  materialImpactSummary: string;
  longTermImpactSummary: string;
  improvementHint: string;
};

type RuntimeContinuityImpactSummarySection = {
  summary: string;
  aggregateSummary: string;
};

type RuntimeContinuityImpactFindingsSection = RuntimeContinuityImpactSummarySection & {
  findings: string[];
};

type RuntimeContinuityImpactPatternsSection = RuntimeContinuityImpactSummarySection & {
  impactPatterns: string[];
  optimizationHints: string[];
};

type RuntimeContinuityImpactPatternReviewSection = RuntimeContinuityImpactSummarySection & {
  patterns: string[];
  optimizationHints: string[];
};

type RuntimeContinuityImpactSamplingSection = RuntimeContinuityImpactSummarySection & {
  findings: string[];
  optimizationHints: string[];
};

type RuntimeContinuityImpactSamplingAuditSection = RuntimeContinuityImpactSummarySection & {
  findings: string[];
  optimizationSuggestions: string[];
};

export type RuntimeContinuityMaterialImpactReview = {
  longTermMaterialImpactReview: RuntimeContinuityImpactFindingsSection;
  longTermMaterialImpactAudit: RuntimeContinuityImpactPatternsSection;
  materialImpactPatternAgingReview: RuntimeContinuityImpactPatternReviewSection;
  materialImpactSamplingReview: RuntimeContinuityImpactSamplingSection;
  materialImpactSamplingAgingReview: RuntimeContinuityImpactSamplingSection;
  materialImpactSamplingAgingRefinement: RuntimeContinuityImpactSamplingSection;
  materialImpactSamplingAgingAudit: RuntimeContinuityImpactSamplingAuditSection;
  materialImpactSamplingAgingRefinementAudit: RuntimeContinuityImpactSamplingAuditSection;
};

function uniqueTop(items: Array<string | null>, limit = 4) {
  return items
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, limit) as string[];
}

export function buildRuntimeContinuityMaterialImpactReview(input: {
  stepReviews: RuntimeContinuityImpactStepReview[];
  highestMaterialImpactStep?: RuntimeContinuityImpactStepReview | null;
  mostStableStep?: RuntimeContinuityImpactStepReview | null;
  dominantAtRiskStep?: RuntimeContinuityImpactStepReview | null;
}): RuntimeContinuityMaterialImpactReview {
  const {
    stepReviews,
    highestMaterialImpactStep = null,
    mostStableStep = null,
    dominantAtRiskStep = null,
  } = input;

  const broadMaterialImpactCount = stepReviews.filter(
    (item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "BROAD",
  ).length;
  const qualifiedMaterialImpactCount = stepReviews.filter(
    (item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "QUALIFIED",
  ).length;
  const narrowMaterialImpactCount = stepReviews.filter(
    (item) => item.materialImpactBand === "HIGH" && item.sampleCoverageBand === "NARROW",
  ).length;
  const unstableMaterialImpactStep =
    stepReviews.find((item) => item.materialImpactBand === "HIGH" && item.stabilityBand !== "STABLE") ?? null;
  const broadMaterialImpactStep =
    stepReviews.find((item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand !== "NARROW") ?? null;
  const narrowHighImpactStep =
    stepReviews.find((item) => item.materialImpactBand === "HIGH" && item.sampleCoverageBand === "NARROW") ?? null;

  const longTermMaterialImpactReviewFindings = uniqueTop([
    broadMaterialImpactStep
      ? `${broadMaterialImpactStep.label}: ${broadMaterialImpactStep.materialImpactSummary}`
      : null,
    unstableMaterialImpactStep
      ? `${unstableMaterialImpactStep.label}: ${unstableMaterialImpactStep.materialImpactSummary}`
      : null,
    narrowHighImpactStep
      ? `${narrowHighImpactStep.label}: material impact stays advisory because the current signal is still narrow-sample.`
      : null,
    highestMaterialImpactStep
      ? `${highestMaterialImpactStep.label}: ${highestMaterialImpactStep.longTermImpactSummary}`
      : null,
  ]);
  const longTermMaterialImpactReviewSummary =
    broadMaterialImpactStep && !unstableMaterialImpactStep
      ? "Long-term material impact review now separates broader-sample SOP impact from narrow hints, so operators can prioritize material steps without overclaiming certainty."
      : unstableMaterialImpactStep
        ? "Long-term material impact review still contains materially important but unstable steps, so the runbook must stay tied to local evidence and subgroup stability."
        : highestMaterialImpactStep
          ? "Long-term material impact review is available, but the current ranking is still sample-limited and should remain advisory."
          : "No long-term material impact signal is currently strong enough to refine the operator runbook further.";
  const longTermMaterialImpactReviewAggregateSummary = `${broadMaterialImpactCount} broad / ${qualifiedMaterialImpactCount} qualified / ${narrowMaterialImpactCount} narrow high-impact step readout(s) are currently visible in long-term material impact review.`;

  const longTermMaterialImpactPatterns = uniqueTop([
    highestMaterialImpactStep
      ? `${highestMaterialImpactStep.label}: ${highestMaterialImpactStep.materialImpactSummary}`
      : null,
    dominantAtRiskStep
      ? `${dominantAtRiskStep.label}: ${dominantAtRiskStep.longTermImpactSummary}`
      : null,
    broadMaterialImpactStep
      ? `${broadMaterialImpactStep.label}: broader-sample material signal remains visible in the current audit.`
      : null,
    narrowHighImpactStep
      ? `${narrowHighImpactStep.label}: material impact still reads as a narrow-sample hint and should stay advisory.`
      : null,
  ]);
  const longTermMaterialImpactOptimizationHints = uniqueTop([
    dominantAtRiskStep ? `${dominantAtRiskStep.label}: ${dominantAtRiskStep.improvementHint}` : null,
    mostStableStep
      ? `${mostStableStep.label}: keep this step early in the runbook only when local evidence still matches the subgroup guidance.`
      : null,
    unstableMaterialImpactStep
      ? `${unstableMaterialImpactStep.label}: keep subgroup stability and local evidence visible before treating this step as a durable material driver.`
      : null,
  ]);
  const longTermMaterialImpactAuditSummary =
    broadMaterialImpactStep && !unstableMaterialImpactStep
      ? "Long-term material impact audit keeps broader-sample material steps visible and converts them into bounded operator guidance without overclaiming causality."
      : unstableMaterialImpactStep
        ? "Long-term material impact audit still finds materially important but unstable steps, so optimization guidance must remain evidence-first."
        : highestMaterialImpactStep
          ? "Long-term material impact audit is available, but the current pattern still needs more sample support before it can narrow operator guidance."
          : "No material impact audit pattern is currently strong enough to refine the runbook further.";
  const longTermMaterialImpactAuditAggregateSummary = `${longTermMaterialImpactPatterns.length} impact pattern(s) / ${longTermMaterialImpactOptimizationHints.length} optimization hint(s) are currently visible in the long-term material impact audit.`;

  const persistentMaterialImpactAgingSteps = stepReviews.filter(
    (item) =>
      item.materialImpactBand !== "LOW" &&
      item.sampleCoverageBand !== "NARROW" &&
      item.longHorizonEffectiveOutcomeRate >= 50 &&
      item.outcomeDelta >= -15,
  );
  const fadingMaterialImpactAgingSteps = stepReviews.filter(
    (item) => item.materialImpactBand !== "LOW" && item.outcomeDelta <= -15,
  );
  const unstableMaterialImpactAgingSteps = stepReviews.filter(
    (item) =>
      item.materialImpactBand === "HIGH" &&
      (item.stabilityBand !== "STABLE" ||
        item.stabilityConfidenceBand === "LOW" ||
        item.sampleCoverageBand === "NARROW"),
  );

  const materialImpactPatternAgingPatterns = uniqueTop([
    persistentMaterialImpactAgingSteps[0]
      ? `${persistentMaterialImpactAgingSteps[0].label}: material impact aging review keeps this pattern persistent across the longer pilot horizon. ${persistentMaterialImpactAgingSteps[0].longTermImpactSummary}`
      : null,
    fadingMaterialImpactAgingSteps[0]
      ? `${fadingMaterialImpactAgingSteps[0].label}: material impact aging review sees this pattern fading across the longer pilot horizon, so it should stay advisory. ${fadingMaterialImpactAgingSteps[0].longTermImpactSummary}`
      : null,
    unstableMaterialImpactAgingSteps[0]
      ? `${unstableMaterialImpactAgingSteps[0].label}: material impact aging review still sees an unstable pattern, so optimization must remain evidence-first. ${unstableMaterialImpactAgingSteps[0].materialImpactSummary}`
      : null,
    highestMaterialImpactStep && !persistentMaterialImpactAgingSteps[0]
      ? `${highestMaterialImpactStep.label}: material impact is still visible, but the aging review remains sample-limited and should not be treated as a durable rule.`
      : null,
  ]);
  const materialImpactPatternAgingOptimizationHints = uniqueTop([
    fadingMaterialImpactAgingSteps[0]
      ? `${fadingMaterialImpactAgingSteps[0].label}: do not harden this step into default guidance while long-horizon effective outcome is softening.`
      : null,
    dominantAtRiskStep ? `${dominantAtRiskStep.label}: ${dominantAtRiskStep.improvementHint}` : null,
    persistentMaterialImpactAgingSteps[0]
      ? `${persistentMaterialImpactAgingSteps[0].label}: keep this pattern only while subgroup drift and local evidence still match the current cohort guidance.`
      : null,
    unstableMaterialImpactAgingSteps[0]
      ? `${unstableMaterialImpactAgingSteps[0].label}: keep the runbook tied to subgroup stability and checkpoint evidence before treating this as a durable material driver.`
      : null,
  ]);
  const materialImpactPatternAgingSummary =
    persistentMaterialImpactAgingSteps.length > 0 && unstableMaterialImpactAgingSteps.length === 0
      ? "Material impact pattern aging review keeps broader-sample patterns visible across the longer pilot horizon, so operators can refine the runbook without overclaiming causality."
      : fadingMaterialImpactAgingSteps.length > 0 || unstableMaterialImpactAgingSteps.length > 0
        ? "Material impact pattern aging review still shows fading or unstable patterns, so long-horizon optimization must remain advisory and evidence-first."
        : highestMaterialImpactStep
          ? "Material impact pattern aging review is available, but the current pattern still needs more pilot support before it can narrow operator guidance."
          : "No material impact aging pattern is currently strong enough to refine the runbook further.";
  const materialImpactPatternAgingAggregateSummary = `${persistentMaterialImpactAgingSteps.length} persistent / ${fadingMaterialImpactAgingSteps.length} fading / ${unstableMaterialImpactAgingSteps.length} unstable aging pattern(s) are currently visible in the long-horizon material impact review.`;

  const broaderSampleMaterialImpactCount = stepReviews.filter(
    (item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand !== "NARROW",
  ).length;
  const narrowMaterialImpactHintCount = stepReviews.filter(
    (item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "NARROW",
  ).length;
  const materialImpactSamplingFindings = uniqueTop([
    persistentMaterialImpactAgingSteps[0]
      ? `${persistentMaterialImpactAgingSteps[0].label}: broader-sample material impact remains visible across the longer cohort aging window. ${persistentMaterialImpactAgingSteps[0].longTermImpactSummary}`
      : null,
    fadingMaterialImpactAgingSteps[0]
      ? `${fadingMaterialImpactAgingSteps[0].label}: material impact sampling shows this step softening over time, so it should remain advisory. ${fadingMaterialImpactAgingSteps[0].longTermImpactSummary}`
      : null,
    unstableMaterialImpactAgingSteps[0]
      ? `${unstableMaterialImpactAgingSteps[0].label}: material impact sampling still sees unstable evidence, so keep this step tied to local subgroup evidence. ${unstableMaterialImpactAgingSteps[0].materialImpactSummary}`
      : null,
    stepReviews.find((item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "NARROW")
      ? `${stepReviews.find((item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "NARROW")?.label}: material impact remains a narrow-sample hint and should not be hardened into default guidance.`
      : null,
  ]);
  const materialImpactSamplingOptimizationHints = uniqueTop([
    persistentMaterialImpactAgingSteps[0]
      ? `${persistentMaterialImpactAgingSteps[0].label}: keep this step prominent only while subgroup drift, checkpoint evidence, and current cohort guidance still line up.`
      : null,
    fadingMaterialImpactAgingSteps[0]
      ? `${fadingMaterialImpactAgingSteps[0].label}: treat this as a monitored hint until longer-horizon outcomes stop softening.`
      : null,
    unstableMaterialImpactAgingSteps[0]
      ? `${unstableMaterialImpactAgingSteps[0].label}: do not convert this into a hard operator rule while stability remains mixed.`
      : null,
    dominantAtRiskStep ? `${dominantAtRiskStep.label}: ${dominantAtRiskStep.improvementHint}` : null,
  ]);
  const materialImpactSamplingSummary =
    broaderSampleMaterialImpactCount > 0 && unstableMaterialImpactAgingSteps.length === 0
      ? "Material impact sampling review now distinguishes broader-sample impact from narrow hints, so operators can keep longer-horizon impact guidance visible without overclaiming durable truth."
      : fadingMaterialImpactAgingSteps.length > 0 || unstableMaterialImpactAgingSteps.length > 0
        ? "Material impact sampling review still sees fading or unstable patterns, so longer-horizon impact guidance must remain evidence-first and advisory."
        : highestMaterialImpactStep
          ? "Material impact sampling review is available, but current impact patterns still need more sample support before they can narrow the runbook."
          : "No material impact sampling signal is currently strong enough to refine the runbook further.";
  const materialImpactSamplingAggregateSummary = `${broaderSampleMaterialImpactCount} broader-sample / ${narrowMaterialImpactHintCount} narrow-hint / ${fadingMaterialImpactAgingSteps.length} fading impact pattern(s) are currently visible in the long-term sampling review.`;

  const materialImpactSamplingAgingRiskStepIds = new Set(
    [...fadingMaterialImpactAgingSteps, ...unstableMaterialImpactAgingSteps].map((item) => item.stepId),
  );
  const persistentMaterialImpactSamplingAgingCount = persistentMaterialImpactAgingSteps.length;
  const materialImpactSamplingAgingRiskCount = materialImpactSamplingAgingRiskStepIds.size;
  const materialImpactSamplingAgingWatchCount = Math.max(
    stepReviews.filter((item) => item.materialImpactBand !== "LOW").length -
      persistentMaterialImpactSamplingAgingCount -
      materialImpactSamplingAgingRiskCount,
    0,
  );
  const materialImpactSamplingAgingFindings = uniqueTop([
    persistentMaterialImpactAgingSteps[0]
      ? `${persistentMaterialImpactAgingSteps[0].label}: material impact sampling aging review keeps this broader-sample pattern persistent across the larger cohort window. ${persistentMaterialImpactAgingSteps[0].longTermImpactSummary}`
      : null,
    fadingMaterialImpactAgingSteps[0]
      ? `${fadingMaterialImpactAgingSteps[0].label}: material impact sampling aging review sees this pattern fading across the longer cohort window, so it should stay advisory. ${fadingMaterialImpactAgingSteps[0].longTermImpactSummary}`
      : null,
    unstableMaterialImpactAgingSteps[0]
      ? `${unstableMaterialImpactAgingSteps[0].label}: material impact sampling aging review still sees unstable evidence, so optimization must remain evidence-first. ${unstableMaterialImpactAgingSteps[0].materialImpactSummary}`
      : null,
    stepReviews.find((item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "NARROW")
      ? `${stepReviews.find((item) => item.materialImpactBand !== "LOW" && item.sampleCoverageBand === "NARROW")?.label}: material impact still reads as a narrow-sample hint and should not be hardened into default guidance.`
      : null,
  ]);
  const materialImpactSamplingAgingOptimizationHints = uniqueTop([
    persistentMaterialImpactAgingSteps[0]
      ? `${persistentMaterialImpactAgingSteps[0].label}: keep this pattern explicit only while subgroup drift, checkpoint evidence, and current cohort guidance still line up.`
      : null,
    fadingMaterialImpactAgingSteps[0]
      ? `${fadingMaterialImpactAgingSteps[0].label}: keep this step as a monitored hint until longer-horizon outcomes stop softening.`
      : null,
    unstableMaterialImpactAgingSteps[0]
      ? `${unstableMaterialImpactAgingSteps[0].label}: do not turn this into a hard operator rule while stability remains mixed.`
      : null,
    dominantAtRiskStep ? `${dominantAtRiskStep.label}: ${dominantAtRiskStep.improvementHint}` : null,
  ]);
  const materialImpactSamplingAgingSummary =
    persistentMaterialImpactSamplingAgingCount > 0 && materialImpactSamplingAgingRiskCount === 0
      ? "Material impact sampling aging review keeps broader-sample impact patterns visible across the larger cohort window without hardening them into default SOP truth."
      : materialImpactSamplingAgingRiskCount > 0
        ? "Material impact sampling aging review still shows fading or unstable impact patterns across the larger cohort window, so optimization guidance must remain evidence-first."
        : highestMaterialImpactStep
          ? "Material impact sampling aging review is available, but the current impact pattern still needs more sample support before it can narrow operator guidance."
          : "No material impact sampling aging signal is currently strong enough to refine the runbook further.";
  const materialImpactSamplingAgingAggregateSummary = `${persistentMaterialImpactSamplingAgingCount} persistent / ${materialImpactSamplingAgingWatchCount} watch / ${materialImpactSamplingAgingRiskCount} aging-risk impact pattern(s) are currently visible in the sampling aging review.`;

  const materialImpactSamplingAgingRefinementHoldingCount = stepReviews.filter(
    (item) =>
      item.materialImpactBand === "HIGH" &&
      item.sampleCoverageBand !== "NARROW" &&
      item.longHorizonEffectiveOutcomeRate >= 50 &&
      item.outcomeDelta >= 0,
  ).length;
  const materialImpactSamplingAgingRefinementRiskCount = stepReviews.filter(
    (item) =>
      item.materialImpactBand === "LOW" ||
      item.sampleCoverageBand === "NARROW" ||
      item.outcomeDelta < 0,
  ).length;
  const materialImpactSamplingAgingRefinementWatchCount = Math.max(
    stepReviews.length -
      materialImpactSamplingAgingRefinementHoldingCount -
      materialImpactSamplingAgingRefinementRiskCount,
    0,
  );
  const materialImpactSamplingAgingRefinementFindings = uniqueTop([
    stepReviews.find(
      (item) =>
        item.materialImpactBand === "HIGH" &&
        item.sampleCoverageBand !== "NARROW" &&
        item.longHorizonEffectiveOutcomeRate >= 50 &&
        item.outcomeDelta >= 0,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.materialImpactBand === "HIGH" &&
                item.sampleCoverageBand !== "NARROW" &&
                item.longHorizonEffectiveOutcomeRate >= 50 &&
                item.outcomeDelta >= 0,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging refinement keeps this step in persistent signal posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find(
      (item) =>
        item.materialImpactBand === "WATCH" &&
        item.sampleCoverageBand !== "NARROW" &&
        item.outcomeDelta >= -10,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.materialImpactBand === "WATCH" &&
                item.sampleCoverageBand !== "NARROW" &&
                item.outcomeDelta >= -10,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging refinement keeps this step in watch signal posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find(
      (item) =>
        item.materialImpactBand === "LOW" ||
        item.sampleCoverageBand === "NARROW" ||
        item.outcomeDelta < 0,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.materialImpactBand === "LOW" ||
                item.sampleCoverageBand === "NARROW" ||
                item.outcomeDelta < 0,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging refinement keeps this step in unstable hint posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
  ]);
  const materialImpactSamplingAgingRefinementSummary =
    materialImpactSamplingAgingRefinementHoldingCount > 0 &&
    materialImpactSamplingAgingRefinementRiskCount <= materialImpactSamplingAgingRefinementHoldingCount
      ? "Material impact sampling aging refinement now separates persistent signals from watch signals and unstable hints across the longer horizon, so operator guidance can stay specific without overclaiming durability."
      : materialImpactSamplingAgingRefinementRiskCount > 0
        ? "Material impact sampling aging refinement still sees unstable hints or weakening longer-horizon outcomes, so guidance must stay conservative and evidence-first."
        : "Material impact sampling aging refinement is active, but the current pilot sample still does not support a sharper longer-horizon impact readout.";
  const materialImpactSamplingAgingRefinementAggregateSummary = `${materialImpactSamplingAgingRefinementHoldingCount} persistent / ${materialImpactSamplingAgingRefinementWatchCount} watch / ${materialImpactSamplingAgingRefinementRiskCount} unstable impact pattern(s) are currently visible in the sampling aging refinement review.`;
  const materialImpactSamplingAgingRefinementOptimizationHints = [
    materialImpactSamplingAgingRefinementHoldingCount > 0
      ? "Keep persistent longer-horizon impact signals visible, but continue to pair them with local evidence before reusing the same SOP step."
      : "No persistent longer-horizon impact signal is currently broad enough to narrow operator guidance.",
    materialImpactSamplingAgingRefinementRiskCount > 0
      ? "Route unstable-hint or negative-delta steps back through rollback anchor and subgroup drift review before repeating them."
      : "Current longer-horizon impact refinement does not show a live unstable-hint pocket beyond the watch band.",
    "Do not treat sampling aging refinement as causal proof; it remains operator-facing continuity guidance only.",
  ].slice(0, 3);

  const materialImpactSamplingAgingAuditDurableCount = stepReviews.filter(
    (item) =>
      item.materialImpactBand === "HIGH" &&
      item.sampleCoverageBand === "BROAD" &&
      item.longHorizonEffectiveOutcomeRate >= 60 &&
      item.outcomeDelta >= 5,
  ).length;
  const materialImpactSamplingAgingAuditRiskCount = stepReviews.filter(
    (item) =>
      item.materialImpactBand === "LOW" ||
      item.sampleCoverageBand === "NARROW" ||
      item.longHorizonEffectiveOutcomeRate < 40 ||
      item.outcomeDelta < 0,
  ).length;
  const materialImpactSamplingAgingAuditWatchCount = Math.max(
    stepReviews.length - materialImpactSamplingAgingAuditDurableCount - materialImpactSamplingAgingAuditRiskCount,
    0,
  );
  const materialImpactSamplingAgingAuditFindings = uniqueTop([
    stepReviews.find(
      (item) =>
        item.materialImpactBand === "HIGH" &&
        item.sampleCoverageBand === "BROAD" &&
        item.longHorizonEffectiveOutcomeRate >= 60 &&
        item.outcomeDelta >= 5,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.materialImpactBand === "HIGH" &&
                item.sampleCoverageBand === "BROAD" &&
                item.longHorizonEffectiveOutcomeRate >= 60 &&
                item.outcomeDelta >= 5,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging audit keeps this step in durable signal posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find(
      (item) =>
        item.materialImpactBand === "WATCH" &&
        item.sampleCoverageBand !== "NARROW" &&
        item.longHorizonEffectiveOutcomeRate >= 40 &&
        item.outcomeDelta >= 0,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.materialImpactBand === "WATCH" &&
                item.sampleCoverageBand !== "NARROW" &&
                item.longHorizonEffectiveOutcomeRate >= 40 &&
                item.outcomeDelta >= 0,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging audit keeps this step in watch signal posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find(
      (item) =>
        item.materialImpactBand === "LOW" ||
        item.sampleCoverageBand === "NARROW" ||
        item.longHorizonEffectiveOutcomeRate < 40 ||
        item.outcomeDelta < 0,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.materialImpactBand === "LOW" ||
                item.sampleCoverageBand === "NARROW" ||
                item.longHorizonEffectiveOutcomeRate < 40 ||
                item.outcomeDelta < 0,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging audit keeps this step in unstable signal posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find((item) => item.materialImpactBand === "HIGH" && item.sampleCoverageBand === "NARROW")
      ? (() => {
          const step =
            stepReviews.find(
              (item) => item.materialImpactBand === "HIGH" && item.sampleCoverageBand === "NARROW",
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging audit keeps this step in unstable signal posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
  ]);
  const materialImpactSamplingAgingAuditSummary =
    materialImpactSamplingAgingAuditDurableCount > 0 && materialImpactSamplingAgingAuditRiskCount === 0
      ? "Material impact sampling aging audit keeps durable patterns visible across the longer horizon while preserving review-first operator posture."
      : materialImpactSamplingAgingAuditRiskCount > 0
        ? "Material impact sampling aging audit still sees unstable or fading patterns, so long-horizon optimization must remain evidence-first and review-bound."
        : highestMaterialImpactStep
          ? "Material impact sampling aging audit is available, but current impact patterns still need more durable sample support before they can narrow operator guidance."
          : "No material impact sampling aging audit signal is currently durable enough to refine the runbook further.";
  const materialImpactSamplingAgingAuditAggregateSummary = `${materialImpactSamplingAgingAuditDurableCount} durable / ${materialImpactSamplingAgingAuditWatchCount} watch / ${materialImpactSamplingAgingAuditRiskCount} unstable impact pattern(s) are currently visible in the sampling aging audit.`;
  const materialImpactSamplingAgingAuditOptimizationSuggestions = [
    materialImpactSamplingAgingAuditDurableCount > 0
      ? "Keep durable signals paired with local evidence and subgroup drift before reusing the same SOP step."
      : "No durable longer-horizon impact signal is currently broad enough to narrow operator guidance.",
    materialImpactSamplingAgingAuditRiskCount > 0
      ? "Route unstable or fading patterns through rollback anchor, evidence collection, and subgroup drift review before repeating them."
      : "Current longer-horizon impact audit does not show a live unstable pocket beyond the watch band.",
    "Treat sampling aging audit as operator-facing continuity guidance only, not causal proof.",
  ].slice(0, 3);

  const materialImpactSamplingAgingRefinementAuditDurableCount = stepReviews.filter(
    (item) =>
      item.sampleCoverageBand !== "NARROW" &&
      item.materialImpactBand !== "LOW" &&
      item.correlationBand !== "AT_RISK" &&
      item.longHorizonEffectiveOutcomeRate >= 55 &&
      item.outcomeDelta >= 0,
  ).length;
  const materialImpactSamplingAgingRefinementAuditRiskCount = stepReviews.filter(
    (item) =>
      item.sampleCoverageBand === "NARROW" ||
      item.materialImpactBand === "LOW" ||
      item.correlationBand === "AT_RISK" ||
      item.longHorizonEffectiveOutcomeRate < 40 ||
      item.outcomeDelta < -5 ||
      item.ineffectiveAfterHitRate >= 25,
  ).length;
  const materialImpactSamplingAgingRefinementAuditWatchCount = Math.max(
    stepReviews.length -
      materialImpactSamplingAgingRefinementAuditDurableCount -
      materialImpactSamplingAgingRefinementAuditRiskCount,
    0,
  );
  const materialImpactSamplingAgingRefinementAuditFindings = uniqueTop([
    stepReviews.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.materialImpactBand !== "LOW" &&
        item.correlationBand !== "AT_RISK" &&
        item.longHorizonEffectiveOutcomeRate >= 55 &&
        item.outcomeDelta >= 0,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.sampleCoverageBand !== "NARROW" &&
                item.materialImpactBand !== "LOW" &&
                item.correlationBand !== "AT_RISK" &&
                item.longHorizonEffectiveOutcomeRate >= 55 &&
                item.outcomeDelta >= 0,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging refinement keeps this step in durable-comparison posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find(
      (item) =>
        item.sampleCoverageBand !== "NARROW" &&
        item.materialImpactBand !== "LOW" &&
        item.longHorizonEffectiveOutcomeRate >= 40 &&
        item.outcomeDelta >= -5,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.sampleCoverageBand !== "NARROW" &&
                item.materialImpactBand !== "LOW" &&
                item.longHorizonEffectiveOutcomeRate >= 40 &&
                item.outcomeDelta >= -5,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging refinement keeps this step in mixed-comparison posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
    stepReviews.find(
      (item) =>
        item.sampleCoverageBand === "NARROW" ||
        item.materialImpactBand === "LOW" ||
        item.correlationBand === "AT_RISK" ||
        item.longHorizonEffectiveOutcomeRate < 40 ||
        item.outcomeDelta < -5 ||
        item.ineffectiveAfterHitRate >= 25,
    )
      ? (() => {
          const step =
            stepReviews.find(
              (item) =>
                item.sampleCoverageBand === "NARROW" ||
                item.materialImpactBand === "LOW" ||
                item.correlationBand === "AT_RISK" ||
                item.longHorizonEffectiveOutcomeRate < 40 ||
                item.outcomeDelta < -5 ||
                item.ineffectiveAfterHitRate >= 25,
            ) ?? null;
          if (!step) return null;
          return `${step.label}: material impact sampling aging refinement keeps this step in regressing-comparison posture across the longer horizon. ${step.longTermImpactSummary}`;
        })()
      : null,
  ]);
  const materialImpactSamplingAgingRefinementAuditSummary =
    materialImpactSamplingAgingRefinementAuditDurableCount > 0 &&
    materialImpactSamplingAgingRefinementAuditRiskCount === 0
      ? "Material impact sampling aging refinement audit keeps durable-comparison patterns visible across the longer horizon while preserving review-first operator posture."
      : materialImpactSamplingAgingRefinementAuditRiskCount > 0
        ? "Material impact sampling aging refinement audit still sees regressing-comparison or narrow-support patterns, so optimization guidance must remain evidence-first and review-bound."
        : highestMaterialImpactStep
          ? "Material impact sampling aging refinement audit is available, but current comparison patterns still need more durable sample support before they can narrow operator guidance."
          : "No material impact sampling aging refinement signal is currently durable enough to refine the runbook further.";
  const materialImpactSamplingAgingRefinementAuditAggregateSummary = `${materialImpactSamplingAgingRefinementAuditDurableCount} durable-comparison / ${materialImpactSamplingAgingRefinementAuditWatchCount} mixed-comparison / ${materialImpactSamplingAgingRefinementAuditRiskCount} regressing-comparison impact pattern(s) are currently visible in the sampling aging refinement audit.`;
  const materialImpactSamplingAgingRefinementAuditOptimizationSuggestions = [
    materialImpactSamplingAgingRefinementAuditDurableCount > 0
      ? "Keep durable-comparison patterns paired with subgroup drift and wording regression evidence before reusing the same SOP step."
      : "No durable-comparison longer-horizon impact signal is currently broad enough to narrow operator guidance.",
    materialImpactSamplingAgingRefinementAuditRiskCount > 0
      ? "Route regressing-comparison or narrow-support patterns through rollback anchor, evidence collection, and subgroup drift review before repeating them."
      : "Current sampling aging refinement audit does not show a live regressing-comparison pocket beyond the mixed band.",
    "Treat sampling aging refinement audit as operator-facing continuity guidance only, not causal proof.",
  ].slice(0, 3);

  return {
    longTermMaterialImpactReview: {
      summary: longTermMaterialImpactReviewSummary,
      aggregateSummary: longTermMaterialImpactReviewAggregateSummary,
      findings: longTermMaterialImpactReviewFindings,
    },
    longTermMaterialImpactAudit: {
      summary: longTermMaterialImpactAuditSummary,
      aggregateSummary: longTermMaterialImpactAuditAggregateSummary,
      impactPatterns: longTermMaterialImpactPatterns,
      optimizationHints: longTermMaterialImpactOptimizationHints,
    },
    materialImpactPatternAgingReview: {
      summary: materialImpactPatternAgingSummary,
      aggregateSummary: materialImpactPatternAgingAggregateSummary,
      patterns: materialImpactPatternAgingPatterns,
      optimizationHints: materialImpactPatternAgingOptimizationHints,
    },
    materialImpactSamplingReview: {
      summary: materialImpactSamplingSummary,
      aggregateSummary: materialImpactSamplingAggregateSummary,
      findings: materialImpactSamplingFindings,
      optimizationHints: materialImpactSamplingOptimizationHints,
    },
    materialImpactSamplingAgingReview: {
      summary: materialImpactSamplingAgingSummary,
      aggregateSummary: materialImpactSamplingAgingAggregateSummary,
      findings: materialImpactSamplingAgingFindings,
      optimizationHints: materialImpactSamplingAgingOptimizationHints,
    },
    materialImpactSamplingAgingRefinement: {
      summary: materialImpactSamplingAgingRefinementSummary,
      aggregateSummary: materialImpactSamplingAgingRefinementAggregateSummary,
      findings: materialImpactSamplingAgingRefinementFindings,
      optimizationHints: materialImpactSamplingAgingRefinementOptimizationHints,
    },
    materialImpactSamplingAgingAudit: {
      summary: materialImpactSamplingAgingAuditSummary,
      aggregateSummary: materialImpactSamplingAgingAuditAggregateSummary,
      findings: materialImpactSamplingAgingAuditFindings,
      optimizationSuggestions: materialImpactSamplingAgingAuditOptimizationSuggestions,
    },
    materialImpactSamplingAgingRefinementAudit: {
      summary: materialImpactSamplingAgingRefinementAuditSummary,
      aggregateSummary: materialImpactSamplingAgingRefinementAuditAggregateSummary,
      findings: materialImpactSamplingAgingRefinementAuditFindings,
      optimizationSuggestions: materialImpactSamplingAgingRefinementAuditOptimizationSuggestions,
    },
  };
}
