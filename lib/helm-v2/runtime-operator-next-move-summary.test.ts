import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorNextMoveSummary } from "@/lib/helm-v2/runtime-operator-next-move-summary";

describe("buildRuntimeOperatorNextMoveSummary", () => {
  const operatorWorkSummary = {
    state: "review_gated" as const,
    driver: "steady_state" as const,
    actionState: "keep_review_gated" as const,
    controlState: "review_gated" as const,
    reviewState: "clear" as const,
    reviewActionState: "hold_review_gated" as const,
    focusTitle: null,
    focusHref: null,
    summary: "Workspace stays review-gated.",
    nextAction: "Keep the workspace review-gated.",
    latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
    boundaryNote: "Operator work summary stays bounded.",
    counts: {
      continuityAttention: 0,
      reviewQueue: 0,
      promotionQueue: 0,
      reflectionCandidates: 0,
      reflectionJobs: 0,
      consolidationJobs: 0,
      criticalOperatingGaps: 0,
    },
  };

  const operatorActionSummary = {
    state: "observe" as const,
    driver: "steady_state" as const,
    progressState: "steady_state" as const,
    requestTakeoverState: "not_requested" as const,
    requestHumanInputState: "not_requested" as const,
    takeoverActivationState: "inactive" as const,
    operatorControlState: "review_gated" as const,
    closePostureState: "closed" as const,
    focusTitle: null,
    focusHref: null,
    checkpointKey: null,
    currentOwner: null,
    summary: "No immediate operator action is open.",
    nextAction: "Keep bounded observation.",
    latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
    boundaryNote: "Operator action summary stays bounded.",
  };

  const operatorReviewActionSummary = {
    state: "hold_review_gated" as const,
    driver: "steady_state" as const,
    reviewState: "clear" as const,
    focusTitle: null,
    focusHref: null,
    summary: "No review queue needs immediate action.",
    nextAction: "Keep review-gated posture explicit.",
    latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
    boundaryNote: "Operator review action summary stays bounded.",
    counts: {
      verificationQueue: 0,
      promotionQueue: 0,
      reflectionCandidates: 0,
      reflectionJobs: 0,
      consolidationJobs: 0,
    },
  };

  it("uses cue/work summary when operating gaps lead the workspace", () => {
    const summary = buildRuntimeOperatorNextMoveSummary({
      operatorCueSummary: {
        state: "operating_gap_attention",
        driver: "operator_work",
        workState: "operating_gap_attention",
        actionState: "keep_review_gated",
        controlState: "review_gated",
        reviewState: "clear",
        reviewActionState: "hold_review_gated",
        focusTitle: "Critical operating gap",
        focusHref: "/operating",
        summary: "Critical operating gaps still outrank narrower runtime work.",
        nextAction: "Review the critical operating gaps first.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
        boundaryNote: "Operator cue summary stays bounded.",
        counts: {
          continuityAttention: 0,
          reviewQueue: 0,
          criticalOperatingGaps: 2,
          pendingExecutionWrites: 0,
          benchmarkPendingRequests: 0,
        },
      },
      operatorWorkSummary: {
        ...operatorWorkSummary,
        state: "operating_gap_attention",
        driver: "operating_gap",
        focusTitle: "Critical operating gap",
        focusHref: "/operating",
      },
      operatorActionSummary,
      operatorReviewActionSummary,
    });

    expect(summary.state).toBe("resolve_operating_gap");
    expect(summary.driver).toBe("operator_work");
    expect(summary.focusTitle).toBe("Critical operating gap");
  });

  it("inherits operator action when control attention leads the workspace", () => {
    const summary = buildRuntimeOperatorNextMoveSummary({
      operatorCueSummary: {
        state: "control_attention",
        driver: "operator_control",
        workState: "execution_attention",
        actionState: "acknowledge_execution",
        controlState: "execution_pending",
        reviewState: "clear",
        reviewActionState: "hold_review_gated",
        focusTitle: "Execution review",
        focusHref: "/operating",
        summary: "Control posture leads the workspace.",
        nextAction: "Review the visible execution result.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
        boundaryNote: "Operator cue summary stays bounded.",
        counts: {
          continuityAttention: 0,
          reviewQueue: 0,
          criticalOperatingGaps: 0,
          pendingExecutionWrites: 1,
          benchmarkPendingRequests: 0,
        },
      },
      operatorWorkSummary: {
        ...operatorWorkSummary,
        state: "execution_attention",
        driver: "operator_control",
      },
      operatorActionSummary: {
        ...operatorActionSummary,
        state: "acknowledge_execution",
        driver: "operator_control",
        operatorControlState: "execution_pending",
        summary: "Acknowledge the visible guarded write result.",
        nextAction: "Acknowledge the guarded write result first.",
        focusTitle: "Execution review",
        focusHref: "/operating",
      },
      operatorReviewActionSummary,
    });

    expect(summary.state).toBe("acknowledge_execution");
    expect(summary.driver).toBe("operator_action");
    expect(summary.focusHref).toBe("/operating");
  });

  it("inherits review action when review attention leads the workspace", () => {
    const summary = buildRuntimeOperatorNextMoveSummary({
      operatorCueSummary: {
        state: "review_attention",
        driver: "operator_review",
        workState: "review_attention",
        actionState: "resolve_verification",
        controlState: "review_gated",
        reviewState: "verification_attention",
        reviewActionState: "resolve_verification",
        focusTitle: "Verification queue",
        focusHref: "/operating/verification",
        summary: "Review queue leads the workspace.",
        nextAction: "Resolve the next verification item.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
        boundaryNote: "Operator cue summary stays bounded.",
        counts: {
          continuityAttention: 0,
          reviewQueue: 2,
          criticalOperatingGaps: 0,
          pendingExecutionWrites: 0,
          benchmarkPendingRequests: 0,
        },
      },
      operatorWorkSummary: {
        ...operatorWorkSummary,
        state: "review_attention",
        driver: "review_queue",
      },
      operatorActionSummary,
      operatorReviewActionSummary: {
        ...operatorReviewActionSummary,
        state: "resolve_verification",
        driver: "verification_queue",
        reviewState: "verification_attention",
        focusTitle: "Verification queue",
        focusHref: "/operating/verification",
        summary: "Verification review is the next bounded workspace action.",
        nextAction: "Resolve the next verification item first.",
      },
    });

    expect(summary.state).toBe("resolve_verification");
    expect(summary.driver).toBe("operator_review");
    expect(summary.focusHref).toBe("/operating/verification");
  });
});
