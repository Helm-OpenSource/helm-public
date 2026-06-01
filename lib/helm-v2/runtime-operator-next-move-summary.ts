import type {
  HelmV21RuntimeOperatorActionSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorNextMoveSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorWorkSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_NEXT_MOVE_SUMMARY_BOUNDARY_NOTE =
  "Operator next-move summary stays read-only, review-first, and boundary-first. It compresses the single bounded next move from workspace cue, work, action, and review-action summaries without widening authority or creating a workflow engine.";

export function buildRuntimeOperatorNextMoveSummary(input: {
  operatorCueSummary: HelmV21RuntimeOperatorCueSummary;
  operatorWorkSummary: HelmV21RuntimeOperatorWorkSummary;
  operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
  operatorReviewActionSummary: HelmV21RuntimeOperatorReviewActionSummary;
}): HelmV21RuntimeOperatorNextMoveSummary {
  const base = {
    cueState: input.operatorCueSummary.state,
    workState: input.operatorWorkSummary.state,
    actionState: input.operatorActionSummary.state,
    reviewActionState: input.operatorReviewActionSummary.state,
    boundaryNote: RUNTIME_OPERATOR_NEXT_MOVE_SUMMARY_BOUNDARY_NOTE,
  };

  switch (input.operatorCueSummary.state) {
    case "operating_gap_attention":
      return {
        state: "resolve_operating_gap",
        driver: "operator_work",
        focusTitle: input.operatorCueSummary.focusTitle,
        focusHref: input.operatorCueSummary.focusHref,
        summary: input.operatorCueSummary.summary,
        nextAction: input.operatorCueSummary.nextAction,
        latestUpdatedAt: input.operatorCueSummary.latestUpdatedAt,
        ...base,
      };
    case "continuity_attention":
      return {
        state: "advance_continuity",
        driver: "operator_work",
        focusTitle: input.operatorWorkSummary.focusTitle,
        focusHref: input.operatorWorkSummary.focusHref,
        summary: input.operatorWorkSummary.summary,
        nextAction: input.operatorWorkSummary.nextAction,
        latestUpdatedAt: input.operatorWorkSummary.latestUpdatedAt,
        ...base,
      };
    case "control_attention":
      return {
        state: input.operatorActionSummary.state,
        driver: "operator_action",
        focusTitle:
          input.operatorActionSummary.focusTitle ?? input.operatorCueSummary.focusTitle,
        focusHref:
          input.operatorActionSummary.focusHref ?? input.operatorCueSummary.focusHref,
        summary: input.operatorActionSummary.summary,
        nextAction: input.operatorActionSummary.nextAction,
        latestUpdatedAt:
          input.operatorActionSummary.latestUpdatedAt ?? input.operatorCueSummary.latestUpdatedAt,
        ...base,
      };
    case "review_attention":
      return {
        state:
          input.operatorReviewActionSummary.state === "hold_review_gated"
            ? "keep_review_gated"
            : input.operatorReviewActionSummary.state,
        driver: "operator_review",
        focusTitle:
          input.operatorReviewActionSummary.focusTitle ?? input.operatorCueSummary.focusTitle,
        focusHref:
          input.operatorReviewActionSummary.focusHref ?? input.operatorCueSummary.focusHref,
        summary: input.operatorReviewActionSummary.summary,
        nextAction: input.operatorReviewActionSummary.nextAction,
        latestUpdatedAt:
          input.operatorReviewActionSummary.latestUpdatedAt ?? input.operatorCueSummary.latestUpdatedAt,
        ...base,
      };
    case "review_gated":
      return {
        state: "keep_review_gated",
        driver: "steady_state",
        focusTitle:
          input.operatorCueSummary.focusTitle ?? input.operatorActionSummary.focusTitle,
        focusHref:
          input.operatorCueSummary.focusHref ?? input.operatorActionSummary.focusHref,
        summary: input.operatorCueSummary.summary,
        nextAction: input.operatorCueSummary.nextAction ?? input.operatorActionSummary.nextAction,
        latestUpdatedAt:
          input.operatorCueSummary.latestUpdatedAt ?? input.operatorActionSummary.latestUpdatedAt,
        ...base,
      };
    default:
      return {
        state: "observe",
        driver: "steady_state",
        focusTitle:
          input.operatorActionSummary.focusTitle ?? input.operatorCueSummary.focusTitle,
        focusHref:
          input.operatorActionSummary.focusHref ?? input.operatorCueSummary.focusHref,
        summary: input.operatorActionSummary.summary,
        nextAction: input.operatorActionSummary.nextAction,
        latestUpdatedAt:
          input.operatorActionSummary.latestUpdatedAt ?? input.operatorCueSummary.latestUpdatedAt,
        ...base,
      };
  }
}
