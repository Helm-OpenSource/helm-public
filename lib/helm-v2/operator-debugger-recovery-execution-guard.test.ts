import { describe, expect, it } from "vitest";
import type {
  HelmV21HumanInputCheckpointRequest,
  HelmV21OperatorDebuggerReadModel,
  HelmV21OperatorDebuggerRecoveryExecutionContract,
  HelmV21OperatorDebuggerTakeoverActivation,
  HelmV21OperatorDebuggerTakeoverFollowThrough,
  HelmV21OperatorDebuggerTakeoverRequest,
} from "@/lib/helm-v2/contracts";
import { buildOperatorDebuggerRecoveryExecutionGuardContract } from "@/lib/helm-v2/operator-debugger-recovery-execution-guard";

function buildRecoveryExecutionContract(
  overrides: Partial<HelmV21OperatorDebuggerRecoveryExecutionContract> = {},
): HelmV21OperatorDebuggerRecoveryExecutionContract {
  return {
    state: "observe",
    phase: "observe",
    driver: "observe",
    anchor: "checkpoint",
    action: "SAVE_RECOVERY_CHECKPOINT",
    currentTransition: "observe",
    transitionState: "observe",
    canExecute: false,
    requiresReview: false,
    currentOwner: null,
    checkpointId: "checkpoint_1",
    checkpointKey: "checkpoint::1",
    resumeToken: "checkpoint::1",
    traceContractState: "checkpoint_ready",
    writeContractState: "checkpoint_active",
    recoveryActionState: "observe",
    recoveryLifecycleState: "observe",
    recoveryTransitionState: "observe",
    latestRemediationExecutionStatus: null,
    prerequisites: [],
    completionCriteria: [],
    summary: "Observe the current checkpoint anchor.",
    nextAction: "Observe until a bounded recovery transition reopens.",
    boundaryNote: "Review-first runtime only.",
    ...overrides,
  };
}

function buildTakeoverRequest(
  overrides: Partial<HelmV21OperatorDebuggerTakeoverRequest> = {},
): HelmV21OperatorDebuggerTakeoverRequest {
  return {
    state: "not_requestable",
    requestEventId: null,
    acknowledgementEventId: null,
    action: "SAVE_RECOVERY_CHECKPOINT",
    checkpointId: "checkpoint_1",
    checkpointKey: "checkpoint::1",
    resumeToken: "checkpoint::1",
    requestedAt: null,
    requestedBy: null,
    sourcePage: "/meetings/meeting_1",
    acknowledgedAt: null,
    acknowledgedBy: null,
    summary: "No bounded operator takeover request is currently open.",
    boundaryNote: "Review-first runtime only.",
    ...overrides,
  };
}

function buildHumanInputRequest(
  overrides: Partial<HelmV21HumanInputCheckpointRequest> = {},
): HelmV21HumanInputCheckpointRequest {
  return {
    state: "not_requestable",
    requestEventId: null,
    acknowledgementEventId: null,
    checkpointId: "checkpoint_1",
    checkpointKey: "checkpoint::1",
    resumeToken: "checkpoint::1",
    prompt: "Capture one bounded answer before resume continues.",
    requestedAt: null,
    requestedBy: null,
    sourcePage: "/meetings/meeting_1",
    acknowledgedAt: null,
    acknowledgedBy: null,
    summary: "No bounded human input checkpoint request is currently open.",
    boundaryNote: "Review-first runtime only.",
    ...overrides,
  };
}

function buildTakeoverActivation(
  overrides: Partial<HelmV21OperatorDebuggerTakeoverActivation> = {},
): HelmV21OperatorDebuggerTakeoverActivation {
  return {
    state: "inactive",
    startEventId: null,
    releaseEventId: null,
    requestEventId: null,
    acknowledgementEventId: null,
    action: "SAVE_RECOVERY_CHECKPOINT",
    checkpointId: "checkpoint_1",
    checkpointKey: "checkpoint::1",
    resumeToken: "checkpoint::1",
    currentOwner: null,
    latestEventKind: "none",
    startedAt: null,
    startedBy: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    sourcePage: "/meetings/meeting_1",
    summary: "Operator takeover has not been started on this run thread yet.",
    boundaryNote: "Review-first runtime only.",
    ...overrides,
  };
}

function buildTakeoverFollowThrough(
  overrides: Partial<HelmV21OperatorDebuggerTakeoverFollowThrough> = {},
): HelmV21OperatorDebuggerTakeoverFollowThrough {
  return {
    state: "not_requestable",
    requestEventId: null,
    resolutionEventId: null,
    takeoverRequestEventId: null,
    acknowledgementEventId: null,
    startEventId: null,
    releaseEventId: null,
    action: "SAVE_RECOVERY_CHECKPOINT",
    checkpointId: "checkpoint_1",
    checkpointKey: "checkpoint::1",
    resumeToken: "checkpoint::1",
    currentOwner: null,
    summary: "No operator takeover follow-through is currently open.",
    nextAction: null,
    requestedAt: null,
    requestedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    sourcePage: "/meetings/meeting_1",
    boundaryNote: "Review-first runtime only.",
    ...overrides,
  };
}

function buildGuardInput(
  overrides: Partial<
    Pick<
      HelmV21OperatorDebuggerReadModel,
      | "recoveryExecutionContract"
      | "humanInputRequest"
      | "takeoverRequest"
      | "takeoverActivation"
      | "takeoverFollowThrough"
    >
  > = {},
) {
  return {
    recoveryExecutionContract: buildRecoveryExecutionContract(),
    humanInputRequest: buildHumanInputRequest(),
    takeoverRequest: buildTakeoverRequest(),
    takeoverActivation: buildTakeoverActivation(),
    takeoverFollowThrough: buildTakeoverFollowThrough(),
    ...overrides,
  };
}

describe("buildOperatorDebuggerRecoveryExecutionGuardContract", () => {
  it("allows request_human_input when review-gated human input is requestable on the current anchor", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "request_human_input",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "review_required",
          phase: "review",
          driver: "recovery",
          anchor: "human_input",
          action: "RESUME_CHECKPOINT",
          currentTransition: "review_recovery",
          transitionState: "required",
          canExecute: false,
          requiresReview: true,
        }),
        humanInputRequest: buildHumanInputRequest({
          state: "requestable",
          checkpointKey: "checkpoint::human-input",
          resumeToken: "checkpoint::human-input",
          prompt: "Capture human input against checkpoint::human-input before resume continues.",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.currentTransition).toBe("review_recovery");
    expect(guard.humanInputRequestState).toBe("requestable");
  });

  it("allows acknowledge_human_input when a bounded request is already pending", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "acknowledge_human_input",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "review_required",
          phase: "review",
          driver: "recovery",
          anchor: "human_input",
          action: "RESUME_CHECKPOINT",
          currentTransition: "review_recovery",
          transitionState: "required",
          canExecute: false,
          requiresReview: true,
        }),
        humanInputRequest: buildHumanInputRequest({
          state: "requested",
          requestEventId: "human_input_request_1",
          checkpointKey: "checkpoint::human-input",
          resumeToken: "checkpoint::human-input",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.humanInputRequestState).toBe("requested");
    expect(guard.currentTransition).toBe("review_recovery");
  });

  it("blocks acknowledge_human_input when the bounded request event id is missing", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "acknowledge_human_input",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "review_required",
          phase: "review",
          driver: "recovery",
          anchor: "human_input",
          action: "RESUME_CHECKPOINT",
          currentTransition: "review_recovery",
          transitionState: "required",
          canExecute: false,
          requiresReview: true,
        }),
        humanInputRequest: buildHumanInputRequest({
          state: "requested",
          requestEventId: null,
        }),
      }),
    });

    expect(guard.state).toBe("blocked");
    expect(guard.summary).toBe(
      "No bounded human input checkpoint request is currently waiting for acknowledgement.",
    );
    expect(guard.missingRequirements).toContain("human input request event id is missing");
  });

  it("allows request_takeover when execution truth is explicitly ready", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "request_takeover",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "executable",
          phase: "takeover_request",
          driver: "takeover_request",
          currentTransition: "request_takeover",
          transitionState: "ready",
          canExecute: true,
        }),
        takeoverRequest: buildTakeoverRequest({
          state: "requestable",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.currentTransition).toBe("request_takeover");
    expect(guard.summary).toContain("allows request_takeover");
  });

  it("blocks acknowledge_takeover when the bounded request event id is missing", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "acknowledge_takeover",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "pending",
          phase: "takeover_request",
          driver: "takeover_request",
          currentTransition: "acknowledge_takeover",
          transitionState: "pending",
          canExecute: true,
        }),
        takeoverRequest: buildTakeoverRequest({
          state: "requested",
          requestEventId: null,
        }),
      }),
    });

    expect(guard.state).toBe("blocked");
    expect(guard.summary).toBe(
      "No bounded operator takeover request is currently waiting for acknowledgement.",
    );
    expect(guard.missingRequirements).toContain("takeover request event id is missing");
  });

  it("allows start_takeover when acknowledgement truth is aligned", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "start_takeover",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "executable",
          phase: "takeover_activation",
          driver: "takeover_activation",
          currentTransition: "start_takeover",
          transitionState: "ready",
          canExecute: true,
        }),
        takeoverRequest: buildTakeoverRequest({
          state: "acknowledged",
          requestEventId: "request_event_1",
          acknowledgementEventId: "ack_event_1",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.currentTransition).toBe("start_takeover");
  });

  it("allows release_takeover while active control is the current transition", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "release_takeover",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "active",
          phase: "takeover_activation",
          driver: "takeover_activation",
          currentTransition: "release_takeover",
          transitionState: "active",
          canExecute: false,
          currentOwner: "founder@demo.com",
        }),
        takeoverActivation: buildTakeoverActivation({
          state: "active",
          requestEventId: "request_event_1",
          acknowledgementEventId: "ack_event_1",
          startEventId: "start_event_1",
          currentOwner: "founder@demo.com",
          latestEventKind: "started",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.executionState).toBe("active");
    expect(guard.currentTransition).toBe("release_takeover");
  });

  it("allows request_followthrough when release has completed and follow-through is requestable", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "request_followthrough",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "executable",
          phase: "takeover_followthrough",
          driver: "takeover_followthrough",
          currentTransition: "request_followthrough",
          transitionState: "ready",
          canExecute: true,
        }),
        takeoverFollowThrough: buildTakeoverFollowThrough({
          state: "requestable",
          releaseEventId: "release_event_1",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.currentTransition).toBe("request_followthrough");
  });

  it("allows resolve_followthrough when the open request is pending resolution", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "resolve_followthrough",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "pending",
          phase: "takeover_followthrough",
          driver: "takeover_followthrough",
          currentTransition: "resolve_followthrough",
          transitionState: "pending",
          canExecute: true,
        }),
        takeoverFollowThrough: buildTakeoverFollowThrough({
          state: "open",
          requestEventId: "followthrough_request_1",
          releaseEventId: "release_event_1",
        }),
      }),
    });

    expect(guard.state).toBe("allowed");
    expect(guard.currentTransition).toBe("resolve_followthrough");
  });

  it("reuses an already-resolved follow-through instead of reopening a second request", () => {
    const guard = buildOperatorDebuggerRecoveryExecutionGuardContract({
      move: "request_followthrough",
      ...buildGuardInput({
        recoveryExecutionContract: buildRecoveryExecutionContract({
          state: "applied",
          phase: "takeover_followthrough",
          driver: "takeover_followthrough",
          currentTransition: "request_followthrough",
          transitionState: "resolved",
          canExecute: false,
        }),
        takeoverFollowThrough: buildTakeoverFollowThrough({
          state: "resolved",
          requestEventId: "followthrough_request_1",
          resolutionEventId: "followthrough_resolution_1",
          releaseEventId: "release_event_1",
        }),
      }),
    });

    expect(guard.state).toBe("reused");
    expect(guard.summary).toContain("reuses request_followthrough");
  });
});
