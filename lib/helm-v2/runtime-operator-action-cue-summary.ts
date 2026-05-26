import type {
  HelmV21RuntimeOperatorActionCueSummary,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorNextMoveSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_ACTION_CUE_SUMMARY_BOUNDARY_NOTE =
  "Operator action cue summary stays read-only, review-first, and boundary-first. It compresses workspace cue, bounded next move, operator control, and review-action posture into one coarse action lane without widening authority or creating a workflow engine.";

export function buildRuntimeOperatorActionCueSummary(input: {
  operatorCueSummary: HelmV21RuntimeOperatorCueSummary;
  operatorNextMoveSummary: HelmV21RuntimeOperatorNextMoveSummary;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  operatorReviewActionSummary: HelmV21RuntimeOperatorReviewActionSummary;
}): HelmV21RuntimeOperatorActionCueSummary {
  const base = {
    cueState: input.operatorCueSummary.state,
    nextMoveState: input.operatorNextMoveSummary.state,
    actionState: input.operatorNextMoveSummary.actionState,
    controlState: input.operatorControlSummary.state,
    reviewActionState: input.operatorReviewActionSummary.state,
    focusTitle: input.operatorNextMoveSummary.focusTitle,
    focusHref: input.operatorNextMoveSummary.focusHref,
    summary: input.operatorNextMoveSummary.summary,
    nextAction: input.operatorNextMoveSummary.nextAction,
    latestUpdatedAt: input.operatorNextMoveSummary.latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_ACTION_CUE_SUMMARY_BOUNDARY_NOTE,
  };

  switch (input.operatorCueSummary.state) {
    case "operating_gap_attention":
      return {
        state: "resolve_operating_gap",
        driver: "operator_work",
        ...base,
      };
    case "continuity_attention":
      return {
        state: "advance_continuity",
        driver: "operator_work",
        ...base,
      };
    case "control_attention":
      return {
        state: "resolve_operator_control",
        driver: "operator_control",
        ...base,
      };
    case "review_attention":
      return {
        state: "resolve_workspace_review",
        driver: "operator_review",
        ...base,
      };
    case "review_gated":
      return {
        state: "keep_review_gated",
        driver: "steady_state",
        ...base,
      };
    default:
      return {
        state: "observe",
        driver: "steady_state",
        ...base,
      };
  }
}
