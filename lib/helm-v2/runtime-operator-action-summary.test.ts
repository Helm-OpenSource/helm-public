import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorActionSummary } from "@/lib/helm-v2/runtime-operator-action-summary";

describe("buildRuntimeOperatorActionSummary", () => {
  const baseInput = {
    requestPosture: {
      takeoverState: "not_requested" as const,
      humanInputState: "not_requested" as const,
      latestLifecycleKind: null,
      activeRequestCount: 0,
      acknowledgedRequestCount: 0,
      latestRequestedAt: null,
      latestAcknowledgedAt: null,
      summary: "No open request.",
      nextAction: null,
      boundaryNote: "Request posture stays review-first.",
    },
    takeoverActivation: {
      state: "inactive" as const,
      startEventId: null,
      releaseEventId: null,
      requestEventId: null,
      acknowledgementEventId: null,
      action: null,
      checkpointId: null,
      checkpointKey: "checkpoint::operator",
      resumeToken: null,
      currentOwner: null,
      latestEventKind: "none" as const,
      startedAt: null,
      startedBy: null,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      sourcePage: null,
      summary: "No active takeover.",
      boundaryNote: "Takeover stays bounded.",
    },
    closePostureForwardSummary: {
      state: "closed" as const,
      driver: "close_posture_summary" as const,
      decision: "close_thread" as const,
      summary: "Thread is closed.",
      boundaryNote: "Close posture stays review-first.",
      checkpointKey: "checkpoint::operator",
      currentOwner: null,
      latestUpdatedAt: new Date("2026-04-13T08:00:00.000Z"),
      nextAction: null,
      postureState: "closed" as const,
      resolutionForwardState: "closed" as const,
      settlementState: "closed" as const,
      forwardState: "closed" as const,
      closeRequestState: "resolved" as const,
      forwardAttentionCount: 0,
      openCloseoutCount: 0,
    },
    operatorProgressSummary: {
      state: "review_gated" as const,
      driver: "steady_state" as const,
      requestTakeoverState: "not_requested" as const,
      requestHumanInputState: "not_requested" as const,
      takeoverActivationState: "inactive" as const,
      operatorControlState: "review_gated" as const,
      closePostureState: "closed" as const,
      currentOwner: null,
      summary: "Thread stays review-gated.",
      nextAction: "Keep the thread review-gated until the operator explicitly advances it.",
      latestUpdatedAt: new Date("2026-04-13T09:00:00.000Z"),
      boundaryNote: "Operator progress stays bounded.",
      counts: {
        activeRequests: 0,
        pendingExecutionWrites: 0,
        openExecutionFollowThrough: 0,
        benchmarkPendingRequests: 0,
        benchmarkFailingGates: 0,
        benchmarkWarningGates: 0,
        forwardAttention: 0,
        openCloseout: 0,
      },
    },
  };

  it("maps active takeover to complete_takeover", () => {
    const summary = buildRuntimeOperatorActionSummary({
      ...baseInput,
      takeoverActivation: {
        ...baseInput.takeoverActivation,
        state: "active",
        currentOwner: "operator@demo.com",
      },
      operatorProgressSummary: {
        ...baseInput.operatorProgressSummary,
        state: "takeover_active",
        driver: "takeover_activation",
        takeoverActivationState: "active",
        currentOwner: "operator@demo.com",
      },
    });

    expect(summary.state).toBe("complete_takeover");
    expect(summary.driver).toBe("takeover_activation");
    expect(summary.currentOwner).toBe("operator@demo.com");
  });

  it("maps benchmark requests to run_benchmark", () => {
    const summary = buildRuntimeOperatorActionSummary({
      ...baseInput,
      operatorProgressSummary: {
        ...baseInput.operatorProgressSummary,
        state: "operator_control_attention",
        driver: "operator_control",
        operatorControlState: "benchmark_requested",
        nextAction: "Run the requested benchmark gates.",
      },
    });

    expect(summary.state).toBe("run_benchmark");
    expect(summary.driver).toBe("operator_control");
    expect(summary.nextAction).toBe("Run the requested benchmark gates.");
  });

  it("maps close attention to advance_close", () => {
    const summary = buildRuntimeOperatorActionSummary({
      ...baseInput,
      closePostureForwardSummary: {
        ...baseInput.closePostureForwardSummary,
        state: "forward_open",
        nextAction: "Resolve forward attention before requesting close.",
      },
      operatorProgressSummary: {
        ...baseInput.operatorProgressSummary,
        state: "close_attention",
        driver: "close_posture",
        closePostureState: "forward_open",
        nextAction: "Resolve forward attention before requesting close.",
      },
    });

    expect(summary.state).toBe("advance_close");
    expect(summary.driver).toBe("close_posture");
    expect(summary.nextAction).toBe("Resolve forward attention before requesting close.");
  });

  it("keeps review-gated threads on bounded observation", () => {
    const summary = buildRuntimeOperatorActionSummary(baseInput);

    expect(summary.state).toBe("keep_review_gated");
    expect(summary.driver).toBe("steady_state");
  });
});
