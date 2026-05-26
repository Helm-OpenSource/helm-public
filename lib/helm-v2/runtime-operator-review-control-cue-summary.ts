import type {
  HelmV21RuntimeOperatorActionCueSummary,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorReviewControlCueSummary,
  HelmV21RuntimeOperatorReviewSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_REVIEW_CONTROL_CUE_SUMMARY_BOUNDARY_NOTE =
  "Operator review/control cue summary stays read-only, review-first, and boundary-first. It compresses workspace cue, action cue, operator control, and review posture into one secondary priority cue without widening authority or creating a workflow engine.";

export function buildRuntimeOperatorReviewControlCueSummary(input: {
  operatorCueSummary: HelmV21RuntimeOperatorCueSummary;
  operatorActionCueSummary: HelmV21RuntimeOperatorActionCueSummary;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  operatorReviewSummary: HelmV21RuntimeOperatorReviewSummary;
  operatorReviewActionSummary: HelmV21RuntimeOperatorReviewActionSummary;
}): HelmV21RuntimeOperatorReviewControlCueSummary {
  const base = {
    cueState: input.operatorCueSummary.state,
    actionCueState: input.operatorActionCueSummary.state,
    controlState: input.operatorControlSummary.state,
    reviewState: input.operatorReviewSummary.state,
    reviewActionState: input.operatorReviewActionSummary.state,
    boundaryNote: RUNTIME_OPERATOR_REVIEW_CONTROL_CUE_SUMMARY_BOUNDARY_NOTE,
  };

  if (input.operatorCueSummary.state === "control_attention") {
    return {
      state: "control_priority",
      driver: "operator_control",
      focusTitle: input.operatorControlSummary.focusTitle,
      focusHref: input.operatorControlSummary.focusHref,
      summary:
        "Workspace control posture is the current bounded secondary priority, so operator scanning should enter execution or benchmark control before widening review scope.",
      nextAction:
        input.operatorControlSummary.nextAction ??
        "Resolve the visible execution or benchmark control blocker before widening workspace review scope.",
      latestUpdatedAt: input.operatorControlSummary.latestUpdatedAt,
      ...base,
    };
  }

  if (input.operatorCueSummary.state === "review_attention") {
    return {
      state: "review_priority",
      driver: "operator_review",
      focusTitle:
        input.operatorReviewActionSummary.focusTitle ?? input.operatorReviewSummary.focusTitle,
      focusHref:
        input.operatorReviewActionSummary.focusHref ?? input.operatorReviewSummary.focusHref,
      summary:
        "Workspace review posture is the current bounded secondary priority, so operator scanning should enter verification, promotion, reflection, or consolidation review before widening control scope.",
      nextAction:
        input.operatorReviewActionSummary.nextAction ??
        input.operatorReviewSummary.nextAction ??
        "Resolve the visible workspace review queue before widening control scope.",
      latestUpdatedAt:
        input.operatorReviewActionSummary.latestUpdatedAt ??
        input.operatorReviewSummary.latestUpdatedAt,
      ...base,
    };
  }

  const controlOpen =
    input.operatorControlSummary.state !== "boundary_only" &&
    input.operatorControlSummary.state !== "review_gated";
  if (controlOpen) {
    return {
      state: "control_priority",
      driver: "operator_control",
      focusTitle: input.operatorControlSummary.focusTitle,
      focusHref: input.operatorControlSummary.focusHref,
      summary:
        "Outside the current top action lane, workspace control posture is still the next bounded secondary priority.",
      nextAction:
        input.operatorControlSummary.nextAction ??
        "Resolve the visible execution or benchmark control blocker before widening review scope.",
      latestUpdatedAt: input.operatorControlSummary.latestUpdatedAt,
      ...base,
    };
  }

  if (input.operatorReviewSummary.state !== "clear") {
    return {
      state: "review_priority",
      driver: "operator_review",
      focusTitle:
        input.operatorReviewActionSummary.focusTitle ?? input.operatorReviewSummary.focusTitle,
      focusHref:
        input.operatorReviewActionSummary.focusHref ?? input.operatorReviewSummary.focusHref,
      summary:
        "Outside the current top action lane, workspace review posture is still the next bounded secondary priority.",
      nextAction:
        input.operatorReviewActionSummary.nextAction ??
        input.operatorReviewSummary.nextAction ??
        "Resolve the visible workspace review queue before widening control scope.",
      latestUpdatedAt:
        input.operatorReviewActionSummary.latestUpdatedAt ??
        input.operatorReviewSummary.latestUpdatedAt,
      ...base,
    };
  }

  if (
    input.operatorCueSummary.state === "review_gated" ||
    input.operatorActionCueSummary.state === "keep_review_gated"
  ) {
    return {
      state: "review_gated",
      driver: "steady_state",
      focusTitle: input.operatorActionCueSummary.focusTitle,
      focusHref: input.operatorActionCueSummary.focusHref,
      summary:
        "Neither workspace review nor control is leading beyond the current bounded action lane, so the correct secondary posture is to keep the workspace explicitly review-gated.",
      nextAction:
        input.operatorActionCueSummary.nextAction ??
        "Keep the workspace review-gated until a new control or review cue becomes visible.",
      latestUpdatedAt: input.operatorActionCueSummary.latestUpdatedAt,
      ...base,
    };
  }

  return {
    state: "observe",
    driver: "steady_state",
    focusTitle: input.operatorActionCueSummary.focusTitle,
    focusHref: input.operatorActionCueSummary.focusHref,
    summary:
      "No secondary workspace review/control cue is currently leading beyond the top bounded action lane, so bounded observation remains sufficient.",
    nextAction:
      input.operatorActionCueSummary.nextAction ??
      "Keep the workspace on bounded, review-first observation.",
    latestUpdatedAt: input.operatorActionCueSummary.latestUpdatedAt,
    ...base,
  };
}
