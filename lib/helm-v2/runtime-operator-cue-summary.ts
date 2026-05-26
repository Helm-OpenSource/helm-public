import type {
  HelmV21RuntimeOperatorActionSummary,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorReviewSummary,
  HelmV21RuntimeOperatorWorkSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_CUE_SUMMARY_BOUNDARY_NOTE =
  "Operator cue summary stays read-only, review-first, and boundary-first. It compresses the workspace-level top cue from operator work, review, and control summaries without widening authority or creating a workflow engine.";

export function buildRuntimeOperatorCueSummary(input: {
  operatorWorkSummary: HelmV21RuntimeOperatorWorkSummary;
  operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  operatorReviewSummary: HelmV21RuntimeOperatorReviewSummary;
  operatorReviewActionSummary: HelmV21RuntimeOperatorReviewActionSummary;
}): HelmV21RuntimeOperatorCueSummary {
  const base = {
    workState: input.operatorWorkSummary.state,
    actionState: input.operatorActionSummary.state,
    controlState: input.operatorControlSummary.state,
    reviewState: input.operatorReviewSummary.state,
    reviewActionState: input.operatorReviewActionSummary.state,
    counts: {
      continuityAttention: input.operatorWorkSummary.counts.continuityAttention,
      reviewQueue: input.operatorWorkSummary.counts.reviewQueue,
      criticalOperatingGaps: input.operatorWorkSummary.counts.criticalOperatingGaps,
      pendingExecutionWrites: input.operatorControlSummary.counts.pendingExecutionWrites,
      benchmarkPendingRequests: input.operatorControlSummary.counts.benchmarkPendingRequests,
    },
    boundaryNote: RUNTIME_OPERATOR_CUE_SUMMARY_BOUNDARY_NOTE,
  };

  switch (input.operatorWorkSummary.state) {
    case "operating_gap_attention":
      return {
        state: "operating_gap_attention",
        driver: "operator_work",
        focusTitle: input.operatorWorkSummary.focusTitle,
        focusHref: input.operatorWorkSummary.focusHref,
        summary: input.operatorWorkSummary.summary,
        nextAction: input.operatorWorkSummary.nextAction,
        latestUpdatedAt: input.operatorWorkSummary.latestUpdatedAt,
        ...base,
      };
    case "continuity_attention":
      return {
        state: "continuity_attention",
        driver: "operator_work",
        focusTitle: input.operatorWorkSummary.focusTitle,
        focusHref: input.operatorWorkSummary.focusHref,
        summary: input.operatorWorkSummary.summary,
        nextAction: input.operatorWorkSummary.nextAction,
        latestUpdatedAt: input.operatorWorkSummary.latestUpdatedAt,
        ...base,
      };
    case "execution_attention":
    case "benchmark_attention":
      return {
        state: "control_attention",
        driver: "operator_control",
        focusTitle:
          input.operatorControlSummary.focusTitle ??
          input.operatorWorkSummary.focusTitle ??
          input.operatorActionSummary.focusTitle,
        focusHref:
          input.operatorControlSummary.focusHref ??
          input.operatorWorkSummary.focusHref ??
          input.operatorActionSummary.focusHref,
        summary: input.operatorControlSummary.summary,
        nextAction: input.operatorControlSummary.nextAction ?? input.operatorWorkSummary.nextAction,
        latestUpdatedAt:
          input.operatorControlSummary.latestUpdatedAt ?? input.operatorWorkSummary.latestUpdatedAt,
        ...base,
      };
    case "review_attention":
      return {
        state: "review_attention",
        driver: "operator_review",
        focusTitle:
          input.operatorReviewActionSummary.focusTitle ??
          input.operatorReviewSummary.focusTitle ??
          input.operatorWorkSummary.focusTitle,
        focusHref:
          input.operatorReviewActionSummary.focusHref ??
          input.operatorReviewSummary.focusHref ??
          input.operatorWorkSummary.focusHref,
        summary: input.operatorReviewActionSummary.summary,
        nextAction: input.operatorReviewActionSummary.nextAction ?? input.operatorWorkSummary.nextAction,
        latestUpdatedAt:
          input.operatorReviewActionSummary.latestUpdatedAt ??
          input.operatorReviewSummary.latestUpdatedAt ??
          input.operatorWorkSummary.latestUpdatedAt,
        ...base,
      };
    case "review_gated":
      return {
        state: "review_gated",
        driver: "steady_state",
        focusTitle:
          input.operatorWorkSummary.focusTitle ??
          input.operatorReviewActionSummary.focusTitle ??
          input.operatorControlSummary.focusTitle,
        focusHref:
          input.operatorWorkSummary.focusHref ??
          input.operatorReviewActionSummary.focusHref ??
          input.operatorControlSummary.focusHref,
        summary: input.operatorWorkSummary.summary,
        nextAction: input.operatorWorkSummary.nextAction,
        latestUpdatedAt:
          input.operatorWorkSummary.latestUpdatedAt ??
          input.operatorReviewActionSummary.latestUpdatedAt ??
          input.operatorControlSummary.latestUpdatedAt,
        ...base,
      };
    default:
      return {
        state: "steady_state",
        driver: "steady_state",
        focusTitle:
          input.operatorActionSummary.focusTitle ??
          input.operatorWorkSummary.focusTitle ??
          input.operatorControlSummary.focusTitle,
        focusHref:
          input.operatorActionSummary.focusHref ??
          input.operatorWorkSummary.focusHref ??
          input.operatorControlSummary.focusHref,
        summary:
          input.operatorActionSummary.state === "observe"
            ? input.operatorActionSummary.summary
            : input.operatorWorkSummary.summary,
        nextAction: input.operatorActionSummary.nextAction ?? input.operatorWorkSummary.nextAction,
        latestUpdatedAt:
          input.operatorActionSummary.latestUpdatedAt ??
          input.operatorWorkSummary.latestUpdatedAt ??
          input.operatorControlSummary.latestUpdatedAt,
        ...base,
      };
  }
}
