import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorProgressSummary } from "@/lib/helm-v2/runtime-operator-progress-summary";

describe("buildRuntimeOperatorProgressSummary", () => {
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
      checkpointKey: null,
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
    operatorControlSummary: {
      state: "review_gated" as const,
      driver: "steady_state" as const,
      authorityPosture: "review_gated" as const,
      executionSeamPosture: "review_gated" as const,
      benchmarkWorkflowState: "idle" as const,
      benchmarkFollowThroughState: "resolved" as const,
      focusTitle: null,
      focusHref: null,
      summary: "Operator control remains review-gated.",
      nextAction: "Keep the thread review-gated.",
      latestUpdatedAt: new Date("2026-04-13T09:00:00.000Z"),
      boundaryNote: "Operator control stays bounded.",
      counts: {
        pendingExecutionWrites: 0,
        openExecutionFollowThrough: 0,
        benchmarkPendingRequests: 0,
        benchmarkRecordedGates: 0,
        benchmarkWarningGates: 0,
        benchmarkFailingGates: 0,
        benchmarkAcknowledgedRuns: 0,
      },
    },
    closePostureForwardSummary: {
      state: "closed" as const,
      driver: "close_posture_summary" as const,
      decision: "close_thread" as const,
      summary: "Thread is closed.",
      boundaryNote: "Close posture stays review-first.",
      checkpointKey: "checkpoint::1",
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
  };

  it("surfaces active takeover before any other operator blocker", () => {
    const summary = buildRuntimeOperatorProgressSummary({
      ...baseInput,
      takeoverActivation: {
        ...baseInput.takeoverActivation,
        state: "active",
        latestEventKind: "started",
        currentOwner: "operator@demo.com",
        startedAt: new Date("2026-04-13T10:00:00.000Z"),
      },
      operatorControlSummary: {
        ...baseInput.operatorControlSummary,
        state: "execution_follow_through",
        driver: "environment_execution",
        counts: {
          ...baseInput.operatorControlSummary.counts,
          openExecutionFollowThrough: 1,
        },
      },
    });

    expect(summary.state).toBe("takeover_active");
    expect(summary.driver).toBe("takeover_activation");
    expect(summary.currentOwner).toBe("operator@demo.com");
  });

  it("surfaces operator control attention before close posture attention", () => {
    const summary = buildRuntimeOperatorProgressSummary({
      ...baseInput,
      operatorControlSummary: {
        ...baseInput.operatorControlSummary,
        state: "benchmark_requested",
        driver: "benchmark_workflow",
        counts: {
          ...baseInput.operatorControlSummary.counts,
          benchmarkPendingRequests: 1,
        },
      },
      closePostureForwardSummary: {
        ...baseInput.closePostureForwardSummary,
        state: "close_ready",
        summary: "Thread is ready to request close.",
        nextAction: "Request close explicitly.",
      },
    });

    expect(summary.state).toBe("operator_control_attention");
    expect(summary.driver).toBe("operator_control");
    expect(summary.operatorControlState).toBe("benchmark_requested");
  });

  it("falls back to close attention when control is settled but close posture is still open", () => {
    const summary = buildRuntimeOperatorProgressSummary({
      ...baseInput,
      closePostureForwardSummary: {
        ...baseInput.closePostureForwardSummary,
        state: "forward_open",
        summary: "Forward work still keeps close posture open.",
        nextAction: "Resolve forward attention before requesting close.",
        forwardAttentionCount: 2,
        openCloseoutCount: 1,
      },
    });

    expect(summary.state).toBe("close_attention");
    expect(summary.driver).toBe("close_posture");
    expect(summary.counts.forwardAttention).toBe(2);
    expect(summary.counts.openCloseout).toBe(1);
  });
});
