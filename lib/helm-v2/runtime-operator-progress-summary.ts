import type {
  HelmV21OperatorDebuggerTakeoverActivation,
  HelmV21RunThreadClosePostureForwardSummary,
  HelmV21RunThreadRequestPosture,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorProgressSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE =
  "Operator progress summary stays read-only, review-first, and boundary-first. It compresses request posture, active takeover posture, operator control posture, and close posture into one operator-facing progress seam without widening authority or creating a workflow engine.";

function pickLatestDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, current) => {
    if (!current) return latest;
    if (!latest || current.getTime() > latest.getTime()) return current;
    return latest;
  }, null);
}

function buildCounts(input: {
  requestPosture: HelmV21RunThreadRequestPosture;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  closePostureForwardSummary: HelmV21RunThreadClosePostureForwardSummary;
}) {
  return {
    activeRequests: input.requestPosture.activeRequestCount,
    pendingExecutionWrites: input.operatorControlSummary.counts.pendingExecutionWrites,
    openExecutionFollowThrough: input.operatorControlSummary.counts.openExecutionFollowThrough,
    benchmarkPendingRequests: input.operatorControlSummary.counts.benchmarkPendingRequests,
    benchmarkFailingGates: input.operatorControlSummary.counts.benchmarkFailingGates,
    benchmarkWarningGates: input.operatorControlSummary.counts.benchmarkWarningGates,
    forwardAttention: input.closePostureForwardSummary.forwardAttentionCount,
    openCloseout: input.closePostureForwardSummary.openCloseoutCount,
  };
}

export function buildRuntimeOperatorProgressSummary(input: {
  requestPosture: HelmV21RunThreadRequestPosture;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  closePostureForwardSummary: HelmV21RunThreadClosePostureForwardSummary;
}): HelmV21RuntimeOperatorProgressSummary {
  const counts = buildCounts(input);
  const latestUpdatedAt = pickLatestDate(
    input.requestPosture.latestAcknowledgedAt,
    input.requestPosture.latestRequestedAt,
    input.takeoverActivation.startedAt,
    input.takeoverActivation.releasedAt,
    input.operatorControlSummary.latestUpdatedAt,
    input.closePostureForwardSummary.latestUpdatedAt,
  );

  if (input.takeoverActivation.state === "active") {
    return {
      state: "takeover_active",
      driver: "takeover_activation",
      requestTakeoverState: input.requestPosture.takeoverState,
      requestHumanInputState: input.requestPosture.humanInputState,
      takeoverActivationState: input.takeoverActivation.state,
      operatorControlState: input.operatorControlSummary.state,
      closePostureState: input.closePostureForwardSummary.state,
      currentOwner: input.takeoverActivation.currentOwner,
      summary: `Bounded operator takeover is active. Operator control is ${input.operatorControlSummary.state}, and close posture is ${input.closePostureForwardSummary.state}.`,
      nextAction:
        "Finish the bounded takeover task or release control explicitly before treating this thread as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (input.requestPosture.takeoverState === "requested") {
    return {
      state: "takeover_requested",
      driver: "request_posture",
      requestTakeoverState: input.requestPosture.takeoverState,
      requestHumanInputState: input.requestPosture.humanInputState,
      takeoverActivationState: input.takeoverActivation.state,
      operatorControlState: input.operatorControlSummary.state,
      closePostureState: input.closePostureForwardSummary.state,
      currentOwner: null,
      summary: `A takeover request is open. Operator control is ${input.operatorControlSummary.state}, and close posture is ${input.closePostureForwardSummary.state}.`,
      nextAction: "Acknowledge or decline the takeover request before moving the thread forward.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (input.requestPosture.humanInputState === "requested") {
    return {
      state: "human_input_requested",
      driver: "request_posture",
      requestTakeoverState: input.requestPosture.takeoverState,
      requestHumanInputState: input.requestPosture.humanInputState,
      takeoverActivationState: input.takeoverActivation.state,
      operatorControlState: input.operatorControlSummary.state,
      closePostureState: input.closePostureForwardSummary.state,
      currentOwner: null,
      summary: `A human-input checkpoint request is open. Operator control is ${input.operatorControlSummary.state}, and close posture is ${input.closePostureForwardSummary.state}.`,
      nextAction: "Capture the requested human input checkpoint before moving the thread forward.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (
    input.operatorControlSummary.state === "execution_pending" ||
    input.operatorControlSummary.state === "execution_review" ||
    input.operatorControlSummary.state === "execution_follow_through" ||
    input.operatorControlSummary.state === "benchmark_requested" ||
    input.operatorControlSummary.state === "benchmark_review" ||
    input.operatorControlSummary.state === "benchmark_follow_through"
  ) {
    return {
      state: "operator_control_attention",
      driver: "operator_control",
      requestTakeoverState: input.requestPosture.takeoverState,
      requestHumanInputState: input.requestPosture.humanInputState,
      takeoverActivationState: input.takeoverActivation.state,
      operatorControlState: input.operatorControlSummary.state,
      closePostureState: input.closePostureForwardSummary.state,
      currentOwner: input.takeoverActivation.currentOwner,
      summary: `Operator control still needs attention via ${input.operatorControlSummary.state}. Close posture is ${input.closePostureForwardSummary.state}.`,
      nextAction:
        input.operatorControlSummary.nextAction ??
        "Resolve the visible execution or benchmark control blocker before treating this thread as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (
    input.closePostureForwardSummary.state !== "kept_open" &&
    input.closePostureForwardSummary.state !== "closed"
  ) {
    return {
      state: "close_attention",
      driver: "close_posture",
      requestTakeoverState: input.requestPosture.takeoverState,
      requestHumanInputState: input.requestPosture.humanInputState,
      takeoverActivationState: input.takeoverActivation.state,
      operatorControlState: input.operatorControlSummary.state,
      closePostureState: input.closePostureForwardSummary.state,
      currentOwner:
        input.closePostureForwardSummary.currentOwner ?? input.takeoverActivation.currentOwner,
      summary: `Thread close posture still needs attention via ${input.closePostureForwardSummary.state}. Operator control is ${input.operatorControlSummary.state}.`,
      nextAction:
        input.closePostureForwardSummary.nextAction ??
        "Resolve the visible close posture blocker before treating this thread as settled.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  if (
    input.operatorControlSummary.state === "boundary_only" ||
    input.operatorControlSummary.state === "review_gated"
  ) {
    return {
      state: "review_gated",
      driver: "steady_state",
      requestTakeoverState: input.requestPosture.takeoverState,
      requestHumanInputState: input.requestPosture.humanInputState,
      takeoverActivationState: input.takeoverActivation.state,
      operatorControlState: input.operatorControlSummary.state,
      closePostureState: input.closePostureForwardSummary.state,
      currentOwner: null,
      summary: `Thread stays review-gated. Operator control is ${input.operatorControlSummary.state}, and close posture is ${input.closePostureForwardSummary.state}.`,
      nextAction:
        input.operatorControlSummary.nextAction ??
        "Keep the thread review-gated until the operator explicitly advances it.",
      latestUpdatedAt,
      boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  return {
    state: "steady_state",
    driver: "steady_state",
    requestTakeoverState: input.requestPosture.takeoverState,
    requestHumanInputState: input.requestPosture.humanInputState,
    takeoverActivationState: input.takeoverActivation.state,
    operatorControlState: input.operatorControlSummary.state,
    closePostureState: input.closePostureForwardSummary.state,
    currentOwner: null,
    summary: "No open operator request, control blocker, or close-progress blocker is currently visible.",
    nextAction: "Keep the thread on bounded, review-first observation.",
    latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_PROGRESS_SUMMARY_BOUNDARY_NOTE,
    counts,
  };
}
