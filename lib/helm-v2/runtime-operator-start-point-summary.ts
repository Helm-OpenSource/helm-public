import type {
  HelmV21RuntimeOperatorActionCueSummary,
  HelmV21RuntimeOperatorReviewControlCueSummary,
  HelmV21RuntimeOperatorStartPointSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_START_POINT_SUMMARY_BOUNDARY_NOTE =
  "Operator start-point summary stays read-only, review-first, and boundary-first. It compresses the primary bounded move and the secondary review/control cue into one operator-facing start point without widening authority or creating a workflow engine.";

export function buildRuntimeOperatorStartPointSummary(input: {
  operatorActionCueSummary: HelmV21RuntimeOperatorActionCueSummary;
  operatorReviewControlCueSummary: HelmV21RuntimeOperatorReviewControlCueSummary;
}): HelmV21RuntimeOperatorStartPointSummary {
  return {
    state: input.operatorActionCueSummary.state,
    driver: input.operatorActionCueSummary.driver,
    primaryState: input.operatorActionCueSummary.state,
    primaryDriver: input.operatorActionCueSummary.driver,
    secondaryState: input.operatorReviewControlCueSummary.state,
    secondaryDriver: input.operatorReviewControlCueSummary.driver,
    focusTitle: input.operatorActionCueSummary.focusTitle,
    focusHref: input.operatorActionCueSummary.focusHref,
    secondaryFocusTitle: input.operatorReviewControlCueSummary.focusTitle,
    secondaryFocusHref: input.operatorReviewControlCueSummary.focusHref,
    summary: `Primary bounded move is ${input.operatorActionCueSummary.state}. Secondary cue is ${input.operatorReviewControlCueSummary.state}.`,
    nextAction: input.operatorActionCueSummary.nextAction,
    followupAction: input.operatorReviewControlCueSummary.nextAction,
    latestUpdatedAt:
      input.operatorActionCueSummary.latestUpdatedAt ??
      input.operatorReviewControlCueSummary.latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_START_POINT_SUMMARY_BOUNDARY_NOTE,
  };
}
