import { getRuntimeContinuityCanonicalIntervalWording } from "@/lib/helm-v2/runtime-upgrade-continuity-analytics";

type RuntimeContinuityConfidenceInterval = "WIDE" | "GUARDED" | "SETTLED";
type RuntimeContinuityThresholdRevisionScopeType =
  | "failure_class"
  | "meeting_shape"
  | "cohort_family"
  | "session_density"
  | "meeting_frequency"
  | "failure_history"
  | "participant_role"
  | "remediation_posture";
type RuntimeContinuityWordingAuditReadoutSource =
  | "threshold"
  | "step"
  | "guideline"
  | "session_summary"
  | "queue_summary"
  | "operator_card";

type RuntimeContinuityThresholdRevision = {
  scope: string;
  scopeType: RuntimeContinuityThresholdRevisionScopeType;
  confidenceInterval: RuntimeContinuityConfidenceInterval;
  intervalWordingSummary: string;
  bandAdjustmentRationale: string;
};

type RuntimeContinuityStepReview = {
  label: string;
  confidenceInterval: RuntimeContinuityConfidenceInterval;
  intervalWordingSummary: string;
  bandAdjustmentRationale: string;
};

type RuntimeContinuityWordingAuditReadout = {
  sourceType: RuntimeContinuityWordingAuditReadoutSource;
  scope: string;
  confidenceInterval: RuntimeContinuityConfidenceInterval;
  intervalWordingSummary: string;
  bandAdjustmentRationale: string;
};

type RuntimeContinuitySummarySection = {
  summary: string;
  aggregateSummary: string;
};

type RuntimeContinuityHighlightsSection = RuntimeContinuitySummarySection & {
  highlights: string[];
};

type RuntimeContinuityFindingsSection = RuntimeContinuitySummarySection & {
  findings: string[];
};

type RuntimeContinuityRegressionSection = RuntimeContinuityFindingsSection & {
  regressionRate: number;
};

type RuntimeContinuityRegressionRecommendationsSection = RuntimeContinuityRegressionSection & {
  adjustmentRecommendations: string[];
};

export type RuntimeContinuityIntervalWordingReview = {
  confidenceSimplification: RuntimeContinuityHighlightsSection;
  intervalWordingConsistency: RuntimeContinuityHighlightsSection;
  intervalWordingDriftAudit: RuntimeContinuityFindingsSection;
  wordingDriftTracking: RuntimeContinuityFindingsSection & {
    driftRate: number;
  };
  intervalConsistencyGuidance: RuntimeContinuitySummarySection & {
    guidelines: string[];
  };
  intervalWordingAgingAudit: RuntimeContinuityRegressionSection;
  intervalWordingCrossSurfaceRegressionReview: RuntimeContinuityRegressionRecommendationsSection;
  intervalWordingCrossSurfaceConsistencyAudit: RuntimeContinuityRegressionRecommendationsSection;
  intervalWordingCrossSurfaceRegressionAudit: RuntimeContinuityRegressionRecommendationsSection;
  intervalWordingCrossReadoutRegressionAudit: RuntimeContinuityRegressionRecommendationsSection;
  intervalWordingCrossReadoutRegressionRefinement: RuntimeContinuityRegressionRecommendationsSection;
};

const CONTINUITY_INTERVALS = ["WIDE", "GUARDED", "SETTLED"] as const;
const CONTINUITY_THRESHOLD_AND_STEP_SOURCES = ["threshold", "step"] as const;
const CONTINUITY_CROSS_READOUT_SOURCES = ["threshold", "step", "guideline"] as const;
const CONTINUITY_REFINEMENT_READOUT_SOURCES = [
  "threshold",
  "step",
  "guideline",
  "session_summary",
  "queue_summary",
  "operator_card",
] as const;

function toRuntimePercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function hasIntervalWordingDrift(item: RuntimeContinuityWordingAuditReadout) {
  const expectedWording = getRuntimeContinuityCanonicalIntervalWording(item.confidenceInterval);
  const otherWordings = CONTINUITY_INTERVALS.filter((candidate) => candidate !== item.confidenceInterval).map(
    (candidate) => getRuntimeContinuityCanonicalIntervalWording(candidate),
  );

  return (
    !item.intervalWordingSummary.includes(expectedWording) ||
    !item.bandAdjustmentRationale.includes(expectedWording) ||
    otherWordings.some(
      (candidate) =>
        item.intervalWordingSummary.includes(candidate) || item.bandAdjustmentRationale.includes(candidate),
    )
  );
}

function buildThresholdAndStepAuditReadouts(
  thresholdRevisions: RuntimeContinuityThresholdRevision[],
  stepReviews: RuntimeContinuityStepReview[],
) {
  return [
    ...thresholdRevisions.map((item) => ({
      sourceType: "threshold" as const,
      scope: `${item.scopeType} ${item.scope}`,
      confidenceInterval: item.confidenceInterval,
      intervalWordingSummary: item.intervalWordingSummary,
      bandAdjustmentRationale: item.bandAdjustmentRationale,
    })),
    ...stepReviews.map((item) => ({
      sourceType: "step" as const,
      scope: item.label,
      confidenceInterval: item.confidenceInterval,
      intervalWordingSummary: item.intervalWordingSummary,
      bandAdjustmentRationale: item.bandAdjustmentRationale,
    })),
  ];
}

function buildIntervalConsistencyGuidelines() {
  return CONTINUITY_INTERVALS.map(
    (confidenceInterval) =>
      `${confidenceInterval}: ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)}`,
  );
}

function buildCrossReadoutRefinementReadouts(
  intervalWordingAuditReadouts: RuntimeContinuityWordingAuditReadout[],
) {
  return [
    ...intervalWordingAuditReadouts,
    ...CONTINUITY_INTERVALS.map((confidenceInterval) => ({
      sourceType: "guideline" as const,
      scope: `guideline ${confidenceInterval}`,
      confidenceInterval,
      intervalWordingSummary: getRuntimeContinuityCanonicalIntervalWording(confidenceInterval),
      bandAdjustmentRationale: `guideline keeps ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} visible in the continuity runbook.`,
    })),
    ...CONTINUITY_INTERVALS.map((confidenceInterval) => ({
      sourceType: "session_summary" as const,
      scope: `session summary ${confidenceInterval}`,
      confidenceInterval,
      intervalWordingSummary: `session summary keeps ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} visible in the continuity review.`,
      bandAdjustmentRationale: `session summary stays on ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} and remains non-executing.`,
    })),
    ...CONTINUITY_INTERVALS.map((confidenceInterval) => ({
      sourceType: "queue_summary" as const,
      scope: `queue summary ${confidenceInterval}`,
      confidenceInterval,
      intervalWordingSummary: `queue summary keeps ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} visible in the continuity queue readout.`,
      bandAdjustmentRationale: `queue summary reuses ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} without widening authority.`,
    })),
    ...CONTINUITY_INTERVALS.map((confidenceInterval) => ({
      sourceType: "operator_card" as const,
      scope: `operator card ${confidenceInterval}`,
      confidenceInterval,
      intervalWordingSummary: `operator card keeps ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} visible in the continuity panel.`,
      bandAdjustmentRationale: `operator card reuses ${getRuntimeContinuityCanonicalIntervalWording(confidenceInterval)} and stays review-first.`,
    })),
  ];
}

export function buildRuntimeContinuityIntervalWordingReview(input: {
  thresholdRevisions: RuntimeContinuityThresholdRevision[];
  stepReviews: RuntimeContinuityStepReview[];
}): RuntimeContinuityIntervalWordingReview {
  const { thresholdRevisions, stepReviews } = input;
  const wideIntervalCount = thresholdRevisions.filter((item) => item.confidenceInterval === "WIDE").length;
  const guardedIntervalCount = thresholdRevisions.filter((item) => item.confidenceInterval === "GUARDED").length;
  const settledIntervalCount = thresholdRevisions.filter((item) => item.confidenceInterval === "SETTLED").length;

  const confidenceSimplificationHighlights = [
    thresholdRevisions.find((item) => item.confidenceInterval === "WIDE")?.bandAdjustmentRationale ?? null,
    thresholdRevisions.find((item) => item.confidenceInterval === "GUARDED")?.bandAdjustmentRationale ?? null,
    thresholdRevisions.find((item) => item.confidenceInterval === "SETTLED")?.bandAdjustmentRationale ?? null,
  ].filter(Boolean) as string[];
  const intervalWordingHighlights = [
    thresholdRevisions.find((item) => item.confidenceInterval === "WIDE")?.intervalWordingSummary ?? null,
    thresholdRevisions.find((item) => item.confidenceInterval === "GUARDED")?.intervalWordingSummary ?? null,
    thresholdRevisions.find((item) => item.confidenceInterval === "SETTLED")?.intervalWordingSummary ?? null,
  ].filter(Boolean) as string[];

  const intervalWordingAuditReadouts = buildThresholdAndStepAuditReadouts(thresholdRevisions, stepReviews);
  const intervalWordingDriftReadouts = intervalWordingAuditReadouts.filter(hasIntervalWordingDrift);
  const wordingDriftRate = toRuntimePercent(intervalWordingDriftReadouts.length, intervalWordingAuditReadouts.length);
  const intervalConsistencyGuidelines = buildIntervalConsistencyGuidelines();
  const intervalWordingAgingRegressionRate = wordingDriftRate;

  const intervalWordingDriftAuditFindings: string[] =
    intervalWordingDriftReadouts.length > 0
      ? intervalWordingDriftReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: wording drifted away from the ${item.confidenceInterval.toLowerCase()} canonical interval readout and needs normalization.`,
          )
      : CONTINUITY_INTERVALS.map((confidenceInterval) => {
          const aligned =
            intervalWordingAuditReadouts.find((item) => item.confidenceInterval === confidenceInterval) ?? null;
          return aligned ? `${aligned.scope}: ${aligned.intervalWordingSummary}` : null;
        })
          .filter((item): item is string => Boolean(item))
          .slice(0, 4);

  const wordingDriftTrackingFindings =
    intervalWordingDriftReadouts.length > 0
      ? intervalWordingDriftReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: wording drift is still live in the continuity audit stream and should be normalized back to the ${item.confidenceInterval.toLowerCase()} canonical wording.`,
          )
      : intervalWordingAuditReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: wording stays aligned to the ${item.confidenceInterval.toLowerCase()} canonical interval readout.`,
          );

  const intervalWordingAgingFindings =
    intervalWordingDriftReadouts.length > 0
      ? intervalWordingDriftReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: interval wording regression is still visible against the canonical ${item.confidenceInterval.toLowerCase()} wording and needs normalization before the aging readout can be treated as stable.`,
          )
      : intervalWordingAuditReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: interval wording still ages inside the canonical ${item.confidenceInterval.toLowerCase()} readout with no live regression signal.`,
          );

  const intervalWordingCrossSurfaceRegressionFindings =
    intervalWordingDriftReadouts.length > 0
      ? intervalWordingDriftReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: cross-surface regression is still visible against the canonical ${item.confidenceInterval.toLowerCase()} wording; normalize meeting detail, queue, operator panel, and runbook readouts before reusing this interval guidance.`,
          )
      : [
          "meeting detail: canonical interval wording remains aligned with the current continuity review.",
          "continuity queue: pilot summary still uses the same canonical interval wording.",
          "operator panel: threshold revision card still uses the same canonical interval wording.",
          "operator runbook: canonical interval guidance still matches the runtime readout.",
        ];

  const intervalWordingCrossSurfaceAdjustmentRecommendations = [
    "meeting detail: keep session pilot review wording on the canonical interval phrase for the current band.",
    "continuity queue: keep pilotReviewSummary aligned to the same canonical interval wording.",
    "operator panel: keep threshold revision and wording audit cards aligned to the same canonical interval wording.",
    "operator runbook: keep WIDE / GUARDED / SETTLED guidance identical to runtime-facing wording.",
  ].slice(0, 4);

  const intervalWordingCrossSurfaceConsistencyFindings =
    intervalWordingDriftReadouts.length > 0
      ? intervalWordingDriftReadouts
          .slice(0, 4)
          .map(
            (item) =>
              `${item.scope}: cross-surface wording consistency drift is still visible against the canonical ${item.confidenceInterval.toLowerCase()} readout; normalize continuity-facing surfaces before reusing this wording.`,
          )
      : [
          "meeting detail: canonical interval wording still matches the current continuity review.",
          "continuity queue: pilot summary still uses the same canonical interval wording.",
          "operator panel: threshold and drift cards still use the same canonical interval wording.",
          "operator runbook: WIDE / GUARDED / SETTLED guidance still matches the runtime readout.",
        ];

  const intervalWordingCrossSurfaceConsistencyRecommendations = [
    "meeting detail: keep the pilot review summary on the canonical interval phrase for the current band.",
    "continuity queue: keep pilotReviewSummary and queue meta aligned to the same canonical interval wording.",
    "operator panel: keep threshold revision, wording audit, and drift cards aligned to the same canonical interval wording.",
    "operator runbook: keep WIDE / GUARDED / SETTLED guidance identical to the runtime-facing wording map.",
  ].slice(0, 4);

  const intervalWordingCrossSurfaceCoveragePairs = CONTINUITY_INTERVALS.flatMap((confidenceInterval) =>
    CONTINUITY_THRESHOLD_AND_STEP_SOURCES.map((sourceType) => ({
      confidenceInterval,
      sourceType,
      readout:
        intervalWordingAuditReadouts.find(
          (item) => item.confidenceInterval === confidenceInterval && item.sourceType === sourceType,
        ) ?? null,
    })),
  );
  const intervalWordingCrossSurfaceCoverageGaps = intervalWordingCrossSurfaceCoveragePairs.filter(
    (item) => !item.readout,
  );
  const intervalWordingRegressionAuditRate = toRuntimePercent(
    intervalWordingDriftReadouts.length + intervalWordingCrossSurfaceCoverageGaps.length,
    intervalWordingAuditReadouts.length + intervalWordingCrossSurfaceCoveragePairs.length,
  );

  const intervalWordingCrossSurfaceRegressionAuditFindings = [
    ...intervalWordingDriftReadouts
      .slice(0, 2)
      .map(
        (item) =>
          `${item.scope}: cross-surface regression audit still sees wording drift against the canonical ${item.confidenceInterval.toLowerCase()} readout.`,
      ),
    ...intervalWordingCrossSurfaceCoverageGaps.slice(0, 2).map(
      (item) =>
        `${item.confidenceInterval}: ${item.sourceType} continuity readout is missing from the cross-surface regression audit coverage and should be normalized before reuse.`,
    ),
  ].slice(0, 4);
  const intervalWordingCrossSurfaceRegressionAuditRecommendations = [
    intervalWordingCrossSurfaceCoverageGaps.length > 0
      ? "Backfill missing canonical interval wording coverage before treating cross-surface wording as durable."
      : "Keep threshold and step readouts mapped to the same canonical interval wording before exporting them into continuity surfaces.",
    "Review meeting detail, queue, operator panel, and runbook wording together when a regression audit signal appears.",
    "Do not treat regression audit pass-rate as new authority; it is only a continuity-facing consistency signal.",
  ].slice(0, 3);

  const intervalWordingCrossReadoutCoveragePairs = CONTINUITY_INTERVALS.flatMap((confidenceInterval) =>
    CONTINUITY_CROSS_READOUT_SOURCES.map((sourceType) => ({
      confidenceInterval,
      sourceType,
      readout:
        sourceType === "guideline"
          ? intervalConsistencyGuidelines.find((item) => item.startsWith(`${confidenceInterval}: `)) ?? null
          : intervalWordingAuditReadouts.find(
              (item) => item.confidenceInterval === confidenceInterval && item.sourceType === sourceType,
            ) ?? null,
    })),
  );
  const intervalWordingCrossReadoutCoverageGaps = intervalWordingCrossReadoutCoveragePairs.filter(
    (item) => !item.readout,
  );
  const intervalWordingCrossReadoutRegressionAuditRate = toRuntimePercent(
    intervalWordingDriftReadouts.length +
      intervalWordingCrossSurfaceCoverageGaps.length +
      intervalWordingCrossReadoutCoverageGaps.length,
    intervalWordingAuditReadouts.length +
      intervalWordingCrossSurfaceCoveragePairs.length +
      intervalWordingCrossReadoutCoveragePairs.length,
  );
  const intervalWordingCrossReadoutRegressionAuditFindings = [
    ...intervalWordingDriftReadouts
      .slice(0, 2)
      .map(
        (item) =>
          `${item.scope}: cross-readout regression audit still sees wording drift against the canonical ${item.confidenceInterval.toLowerCase()} readout.`,
      ),
    ...intervalWordingCrossReadoutCoverageGaps.slice(0, 2).map(
      (item) =>
        `${item.confidenceInterval}: ${item.sourceType} readout is missing from the cross-readout audit coverage and should be backfilled before reuse.`,
    ),
  ].slice(0, 4);
  const intervalWordingCrossReadoutRegressionAuditRecommendations = [
    intervalWordingCrossReadoutCoverageGaps.length > 0
      ? "Backfill missing canonical interval wording coverage across threshold, step, and guideline readouts before treating the audit as durable."
      : "Keep threshold, step, and guidance readouts mapped to the same canonical interval wording before exporting them across continuity surfaces.",
    "Review meeting detail, queue, operator panel, runbook, and runtime summaries together when a readout regression signal appears.",
    "Do not treat readout audit pass-rate as authority; it remains a continuity-facing consistency signal only.",
  ].slice(0, 3);

  const intervalWordingCrossReadoutRefinementReadouts =
    buildCrossReadoutRefinementReadouts(intervalWordingAuditReadouts);
  const intervalWordingCrossReadoutRefinementDriftReadouts =
    intervalWordingCrossReadoutRefinementReadouts.filter(hasIntervalWordingDrift);
  const intervalWordingCrossReadoutRefinementCoveragePairs = CONTINUITY_INTERVALS.flatMap(
    (confidenceInterval) =>
      CONTINUITY_REFINEMENT_READOUT_SOURCES.map((sourceType) => ({
        confidenceInterval,
        sourceType,
        readout:
          intervalWordingCrossReadoutRefinementReadouts.find(
            (item) => item.confidenceInterval === confidenceInterval && item.sourceType === sourceType,
          ) ?? null,
      })),
  );
  const intervalWordingCrossReadoutRefinementCoverageGaps =
    intervalWordingCrossReadoutRefinementCoveragePairs.filter((item) => !item.readout);
  const intervalWordingCrossReadoutRegressionRefinementRate = toRuntimePercent(
    intervalWordingCrossReadoutRefinementDriftReadouts.length +
      intervalWordingCrossReadoutRefinementCoverageGaps.length,
    intervalWordingCrossReadoutRefinementReadouts.length +
      intervalWordingCrossReadoutRefinementCoveragePairs.length,
  );
  const intervalWordingCrossReadoutRegressionRefinementFindings = [
    ...intervalWordingCrossReadoutRefinementDriftReadouts.slice(0, 2).map(
      (item) =>
        `${item.scope}: cross-readout refinement still sees wording drift against the canonical ${item.confidenceInterval.toLowerCase()} readout.`,
    ),
    ...intervalWordingCrossReadoutRefinementCoverageGaps.slice(0, 2).map(
      (item) =>
        `${item.confidenceInterval}: ${item.sourceType} readout is missing from the wider cross-readout refinement coverage and should be backfilled before reuse.`,
    ),
  ].slice(0, 4);
  const intervalWordingCrossReadoutRegressionRefinementRecommendations = [
    intervalWordingCrossReadoutRefinementCoverageGaps.length > 0
      ? "Backfill missing canonical interval wording coverage across threshold, step, guideline, session summary, queue summary, and operator card readouts before treating the refinement as durable."
      : "Keep threshold, step, guideline, session summary, queue summary, and operator card readouts mapped to the same canonical interval wording before exporting them across continuity surfaces.",
    "Review meeting detail, queue, operator panel, runbook, and session summaries together when a cross-readout refinement signal appears.",
    "Do not treat refinement pass-rate as authority; it remains a continuity-facing consistency signal only.",
  ].slice(0, 3);

  return {
    confidenceSimplification: {
      summary:
        wideIntervalCount > 0
          ? "Confidence bands are now intentionally widened where subgroup stability or sample coverage would otherwise create fake precision."
          : guardedIntervalCount > 0
            ? "Confidence bands stay mostly guarded; even stronger-looking cohorts still avoid overclaiming precision."
            : "Confidence intervals are comparatively settled only where broad sample coverage and stable subgroup signals line up.",
      aggregateSummary: `${wideIntervalCount} wide / ${guardedIntervalCount} guarded / ${settledIntervalCount} settled confidence interval readout(s) are currently visible in threshold review.`,
      highlights: confidenceSimplificationHighlights,
    },
    intervalWordingConsistency: {
      summary:
        settledIntervalCount > 0
          ? "Interval wording is now normalized across threshold, session, queue, and operator surfaces: wide stays advisory-only, guarded stays evidence-checked, and settled stays explicitly non-executing."
          : "Interval wording is now normalized across threshold, session, queue, and operator surfaces, but the current sample still does not justify many settled readouts.",
      aggregateSummary: `${wideIntervalCount} wide / ${guardedIntervalCount} guarded / ${settledIntervalCount} settled interval readout(s) now use the same canonical wording rules.`,
      highlights: intervalWordingHighlights,
    },
    intervalWordingDriftAudit: {
      summary:
        intervalWordingDriftReadouts.length > 0
          ? "Interval wording drift audit found readouts that no longer map cleanly to the canonical interval wording; keep wording aligned before treating the calibration review as stable."
          : "Interval wording drift audit currently shows threshold, step, queue, and session-facing interval language still aligned to the same canonical wording rules.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} aligned / ${intervalWordingDriftReadouts.length} drifted interval wording readout(s) are currently visible across threshold and step review.`,
      findings: intervalWordingDriftAuditFindings,
    },
    wordingDriftTracking: {
      driftRate: wordingDriftRate,
      summary:
        wordingDriftRate > 0
          ? `Wording drift tracking currently sees ${wordingDriftRate}% drift across visible interval readouts; keep threshold, step, queue, and session wording aligned before treating the calibration review as reusable.`
          : "Wording drift tracking currently shows 0% drift across visible interval readouts, so the canonical interval wording remains stable across threshold, step, queue, and session surfaces.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} aligned / ${intervalWordingDriftReadouts.length} drifted readout(s); wording drift rate ${wordingDriftRate}% across the current continuity review.`,
      findings: wordingDriftTrackingFindings,
    },
    intervalConsistencyGuidance: {
      summary:
        intervalWordingDriftReadouts.length > 0
          ? "Interval consistency guidance remains required because at least one wording path drifted away from the canonical interval script."
          : "Interval consistency guidance is now explicit for wide, guarded, and settled readouts, so operators can keep the same wording across continuity surfaces.",
      aggregateSummary: `${intervalConsistencyGuidelines.length} canonical interval guidance line(s) are currently available for continuity surfaces.`,
      guidelines: intervalConsistencyGuidelines,
    },
    intervalWordingAgingAudit: {
      regressionRate: intervalWordingAgingRegressionRate,
      summary:
        intervalWordingAgingRegressionRate > 0
          ? `Interval wording aging audit currently sees ${intervalWordingAgingRegressionRate}% regression across the current continuity readout path; normalize wording before treating the interval guidance as durable.`
          : wideIntervalCount > settledIntervalCount
            ? "Interval wording aging audit shows no live regression, but most longer-lived readouts still remain wide or guarded, so wording should stay canonical and conservative."
            : "Interval wording aging audit shows no live regression, and the current interval wording remains stable across threshold, step, queue, and session surfaces.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} persistent / ${intervalWordingDriftReadouts.length} regressed wording readout(s); regression rate ${intervalWordingAgingRegressionRate}% across the current aging audit.`,
      findings: intervalWordingAgingFindings,
    },
    intervalWordingCrossSurfaceRegressionReview: {
      regressionRate: intervalWordingAgingRegressionRate,
      summary:
        intervalWordingAgingRegressionRate > 0
          ? "Cross-surface interval wording regression review still sees drift between canonical interval wording and visible operator readouts; normalize wording before treating the review as stable across meeting detail, queue, operator panel, and runbook."
          : "Cross-surface interval wording regression review currently shows meeting detail, queue, operator panel, and runbook still inheriting the same canonical interval wording.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} aligned / ${intervalWordingDriftReadouts.length} regressed interval wording readout(s); cross-surface regression rate ${intervalWordingAgingRegressionRate}% across continuity-facing surfaces.`,
      findings: intervalWordingCrossSurfaceRegressionFindings,
      adjustmentRecommendations: intervalWordingCrossSurfaceAdjustmentRecommendations,
    },
    intervalWordingCrossSurfaceConsistencyAudit: {
      regressionRate: intervalWordingAgingRegressionRate,
      summary:
        intervalWordingAgingRegressionRate > 0
          ? "Cross-surface interval wording consistency audit still sees wording drift between canonical runtime wording and continuity-facing readouts; normalize wording before treating the audit as stable."
          : settledIntervalCount > 0
            ? "Cross-surface interval wording consistency audit currently shows continuity-facing surfaces still inheriting the same canonical interval wording, including settled readouts where broader support exists."
            : "Cross-surface interval wording consistency audit currently shows continuity-facing surfaces still inheriting the same canonical interval wording, though most readouts remain wide or guarded.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} consistent / ${intervalWordingDriftReadouts.length} regressed interval wording readout(s); consistency audit rate ${intervalWordingAgingRegressionRate}% across continuity-facing surfaces.`,
      findings: intervalWordingCrossSurfaceConsistencyFindings,
      adjustmentRecommendations: intervalWordingCrossSurfaceConsistencyRecommendations,
    },
    intervalWordingCrossSurfaceRegressionAudit: {
      regressionRate: intervalWordingRegressionAuditRate,
      summary:
        intervalWordingRegressionAuditRate > 0
          ? `Cross-surface interval wording regression audit currently sees ${intervalWordingRegressionAuditRate}% regression or coverage gap across continuity-facing readouts; normalize wording before treating the audit as durable.`
          : "Cross-surface interval wording regression audit currently shows no live wording drift or coverage gap across the continuity-facing interval readout path.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} aligned / ${intervalWordingDriftReadouts.length} drifted readout(s) with ${intervalWordingCrossSurfaceCoverageGaps.length} cross-surface coverage gap(s); regression audit rate ${intervalWordingRegressionAuditRate}% across the current continuity review.`,
      findings: intervalWordingCrossSurfaceRegressionAuditFindings,
      adjustmentRecommendations: intervalWordingCrossSurfaceRegressionAuditRecommendations,
    },
    intervalWordingCrossReadoutRegressionAudit: {
      regressionRate: intervalWordingCrossReadoutRegressionAuditRate,
      summary:
        intervalWordingCrossReadoutRegressionAuditRate > 0
          ? `Cross-readout interval wording regression audit currently sees ${intervalWordingCrossReadoutRegressionAuditRate}% regression or coverage gap across threshold, step, and guidance readouts; normalize wording before treating the audit as durable.`
          : "Cross-readout interval wording regression audit currently shows no live wording drift or coverage gap across threshold, step, and guidance readouts.",
      aggregateSummary: `${intervalWordingAuditReadouts.length - intervalWordingDriftReadouts.length} aligned / ${intervalWordingDriftReadouts.length} drifted readout(s) with ${intervalWordingCrossReadoutCoverageGaps.length} cross-readout coverage gap(s); readout regression audit rate ${intervalWordingCrossReadoutRegressionAuditRate}% across the current continuity review.`,
      findings: intervalWordingCrossReadoutRegressionAuditFindings,
      adjustmentRecommendations: intervalWordingCrossReadoutRegressionAuditRecommendations,
    },
    intervalWordingCrossReadoutRegressionRefinement: {
      regressionRate: intervalWordingCrossReadoutRegressionRefinementRate,
      summary:
        intervalWordingCrossReadoutRegressionRefinementRate > 0
          ? `Cross-readout interval wording regression refinement currently sees ${intervalWordingCrossReadoutRegressionRefinementRate}% regression or coverage gap across threshold, step, guideline, session summary, queue summary, and operator card readouts; normalize wording before treating the refinement as durable.`
          : "Cross-readout interval wording regression refinement currently shows no live wording drift or coverage gap across threshold, step, guideline, session summary, queue summary, and operator card readouts.",
      aggregateSummary: `${intervalWordingCrossReadoutRefinementReadouts.length - intervalWordingCrossReadoutRefinementDriftReadouts.length} aligned / ${intervalWordingCrossReadoutRefinementDriftReadouts.length} drifted readout(s) with ${intervalWordingCrossReadoutRefinementCoverageGaps.length} cross-readout family gap(s); refinement rate ${intervalWordingCrossReadoutRegressionRefinementRate}% across the current continuity review.`,
      findings: intervalWordingCrossReadoutRegressionRefinementFindings,
      adjustmentRecommendations: intervalWordingCrossReadoutRegressionRefinementRecommendations,
    },
  };
}
