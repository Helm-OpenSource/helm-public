import type {
  HelmV21OperatorDebuggerTakeoverActivation,
  HelmV21RunThreadClosePostureForwardSummary,
  HelmV21RunThreadRequestPosture,
  HelmV21RuntimeOperatorActionSummary,
  HelmV21RuntimeOperatorProgressSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_ACTION_SUMMARY_BOUNDARY_NOTE =
  "Operator action summary stays read-only, review-first, and boundary-first. It compresses the next bounded operator action from request posture, takeover activation, operator control, and close posture without widening authority or creating a workflow engine.";

function checkpointKey(input: {
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  closePostureForwardSummary: HelmV21RunThreadClosePostureForwardSummary;
}) {
  return input.takeoverActivation.checkpointKey ?? input.closePostureForwardSummary.checkpointKey;
}

function currentOwner(input: {
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  closePostureForwardSummary: HelmV21RunThreadClosePostureForwardSummary;
}) {
  return input.takeoverActivation.currentOwner ?? input.closePostureForwardSummary.currentOwner;
}

export function buildRuntimeOperatorActionSummary(input: {
  operatorProgressSummary: HelmV21RuntimeOperatorProgressSummary;
  requestPosture: HelmV21RunThreadRequestPosture;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  closePostureForwardSummary: HelmV21RunThreadClosePostureForwardSummary;
}): HelmV21RuntimeOperatorActionSummary {
  const base = {
    progressState: input.operatorProgressSummary.state,
    requestTakeoverState: input.requestPosture.takeoverState,
    requestHumanInputState: input.requestPosture.humanInputState,
    takeoverActivationState: input.takeoverActivation.state,
    operatorControlState: input.operatorProgressSummary.operatorControlState,
    closePostureState: input.operatorProgressSummary.closePostureState,
    focusTitle: null,
    focusHref: null,
    checkpointKey: checkpointKey(input),
    currentOwner: currentOwner(input),
    latestUpdatedAt: input.operatorProgressSummary.latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_ACTION_SUMMARY_BOUNDARY_NOTE,
  };

  if (input.operatorProgressSummary.state === "takeover_active") {
    return {
      state: "complete_takeover",
      driver: "takeover_activation",
      summary:
        "Bounded operator takeover is active, so the current action is to finish or explicitly release that control loop.",
      nextAction:
        input.operatorProgressSummary.nextAction ??
        "Finish the bounded takeover task or release control explicitly before treating this thread as settled.",
      ...base,
    };
  }

  if (input.operatorProgressSummary.state === "takeover_requested") {
    return {
      state: "acknowledge_takeover_request",
      driver: "request_posture",
      summary:
        "A takeover request is open, so the current action is to explicitly acknowledge or decline it before any further operator move.",
      nextAction:
        input.operatorProgressSummary.nextAction ??
        "Acknowledge or decline the takeover request before moving the thread forward.",
      ...base,
    };
  }

  if (input.operatorProgressSummary.state === "human_input_requested") {
    return {
      state: "capture_human_input",
      driver: "request_posture",
      summary:
        "A human-input checkpoint is requested, so the current action is to capture that input before forward progress resumes.",
      nextAction:
        input.operatorProgressSummary.nextAction ??
        "Capture the requested human input checkpoint before moving the thread forward.",
      ...base,
    };
  }

  if (input.operatorProgressSummary.state === "operator_control_attention") {
    switch (input.operatorProgressSummary.operatorControlState) {
      case "execution_pending":
        return {
          state: "acknowledge_execution",
          driver: "operator_control",
          summary:
            "Execution posture is waiting on acknowledgement, so the current action is to acknowledge the visible guarded write or limited-auto result.",
          nextAction:
            input.operatorProgressSummary.nextAction ??
            "Acknowledge the visible guarded write or limited-auto result before moving the control flow forward.",
          ...base,
        };
      case "execution_review":
        return {
          state: "review_execution",
          driver: "operator_control",
          summary:
            "Execution posture still needs review, so the current action is to review the bounded execution result before forward progress continues.",
          nextAction:
            input.operatorProgressSummary.nextAction ??
            "Review the visible execution result before moving the thread forward.",
          ...base,
        };
      case "execution_follow_through":
        return {
          state: "resolve_execution_followthrough",
          driver: "operator_control",
          summary:
            "Execution follow-through is still open, so the current action is to close that bounded follow-through before treating the thread as settled.",
          nextAction:
            input.operatorProgressSummary.nextAction ??
            "Resolve the visible official follow-through before treating operator control as settled.",
          ...base,
        };
      case "benchmark_requested":
        return {
          state: "run_benchmark",
          driver: "operator_control",
          summary:
            "A benchmark rerun has been requested, so the current action is to run the requested benchmark gates and record the evidence.",
          nextAction:
            input.operatorProgressSummary.nextAction ??
            "Run the requested benchmark gates and record the evidence before continuing operator review.",
          ...base,
        };
      case "benchmark_review":
        return {
          state: "acknowledge_benchmark",
          driver: "operator_control",
          summary:
            "Benchmark evidence is recorded but not yet acknowledged, so the current action is to review and acknowledge it explicitly.",
          nextAction:
            input.operatorProgressSummary.nextAction ??
            "Review and acknowledge the latest benchmark evidence before treating this substrate slice as settled.",
          ...base,
        };
      case "benchmark_follow_through":
        return {
          state: "resolve_benchmark_followthrough",
          driver: "operator_control",
          summary:
            "Benchmark follow-through is still open, so the current action is to resolve that follow-through before treating the substrate slice as settled.",
          nextAction:
            input.operatorProgressSummary.nextAction ??
            "Resolve benchmark follow-through before treating this substrate slice as settled.",
          ...base,
        };
      default:
        break;
    }
  }

  if (input.operatorProgressSummary.state === "close_attention") {
    return {
      state: "advance_close",
      driver: "close_posture",
      summary:
        "Close posture still has open review, closeout, or forward work, so the current action is to advance that bounded close path explicitly.",
      nextAction:
        input.operatorProgressSummary.nextAction ??
        input.closePostureForwardSummary.nextAction ??
        "Resolve the visible close posture blocker before treating this thread as settled.",
      ...base,
    };
  }

  if (input.operatorProgressSummary.state === "review_gated") {
    return {
      state: "keep_review_gated",
      driver: "steady_state",
      summary:
        "No urgent operator blocker is open, so the current action is to keep the thread review-gated until the operator explicitly advances it.",
      nextAction:
        input.operatorProgressSummary.nextAction ??
        "Keep the thread review-gated until the operator explicitly advances it.",
      ...base,
    };
  }

  return {
    state: "observe",
    driver: "steady_state",
    summary:
      "No immediate operator action is open, so the thread can remain under bounded observation until a new request, control blocker, or close blocker appears.",
    nextAction:
      input.operatorProgressSummary.nextAction ??
      "Keep the thread on bounded, review-first observation.",
    ...base,
  };
}
