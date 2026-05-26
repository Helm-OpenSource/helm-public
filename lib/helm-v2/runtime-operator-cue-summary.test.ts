import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorCueSummary } from "@/lib/helm-v2/runtime-operator-cue-summary";

describe("buildRuntimeOperatorCueSummary", () => {
  const operatorActionSummary = {
    state: "keep_review_gated" as const,
    driver: "steady_state" as const,
    progressState: "review_gated" as const,
    requestTakeoverState: "not_requested" as const,
    requestHumanInputState: "not_requested" as const,
    takeoverActivationState: "inactive" as const,
    operatorControlState: "review_gated" as const,
    closePostureState: "closed" as const,
    focusTitle: null,
    focusHref: null,
    checkpointKey: null,
    currentOwner: null,
    summary: "No bounded operator action is open.",
    nextAction: "Keep the thread review-gated.",
    latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
    boundaryNote: "Operator action summary stays bounded.",
  };

  const operatorControlSummary = {
    state: "review_gated" as const,
    driver: "steady_state" as const,
    authorityPosture: "review_gated" as const,
    executionSeamPosture: "review_gated" as const,
    benchmarkWorkflowState: "idle" as const,
    benchmarkFollowThroughState: "not_requested" as const,
    focusTitle: null,
    focusHref: null,
    summary: "Workspace stays review-gated.",
    nextAction: "Keep the workspace review-gated.",
    latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
    boundaryNote: "Operator control summary stays bounded.",
    counts: {
      pendingExecutionWrites: 0,
      openExecutionFollowThrough: 0,
      benchmarkPendingRequests: 0,
      benchmarkRecordedGates: 0,
      benchmarkWarningGates: 0,
      benchmarkFailingGates: 0,
      benchmarkAcknowledgedRuns: 0,
    },
  };

  const operatorReviewSummary = {
    state: "clear" as const,
    driver: "steady_state" as const,
    focusTitle: null,
    focusHref: null,
    summary: "No review queue is leading the workspace.",
    nextAction: "Keep review posture explicit.",
    latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
    boundaryNote: "Operator review summary stays bounded.",
    counts: {
      verificationQueue: 0,
      promotionQueue: 0,
      reflectionCandidates: 0,
      reflectionJobs: 0,
      consolidationJobs: 0,
    },
  };

  const operatorReviewActionSummary = {
    state: "hold_review_gated" as const,
    driver: "steady_state" as const,
    reviewState: "clear" as const,
    focusTitle: null,
    focusHref: null,
    summary: "No review-first queue needs immediate operator action.",
    nextAction: "Keep the workspace review-gated until a review queue opens.",
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

  it("inherits operator control focus when control attention leads workspace cue", () => {
    const summary = buildRuntimeOperatorCueSummary({
      operatorWorkSummary: {
        state: "execution_attention" as const,
        driver: "operator_control" as const,
        actionState: "review_execution" as const,
        controlState: "execution_review" as const,
        reviewState: "clear" as const,
        reviewActionState: "hold_review_gated" as const,
        focusTitle: "Workspace execution review",
        focusHref: "/operating",
        summary: "Execution posture leads workspace next work.",
        nextAction: "Review the visible execution result.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
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
      },
      operatorActionSummary,
      operatorControlSummary: {
        ...operatorControlSummary,
        state: "execution_review",
        driver: "environment_execution",
        focusTitle: "Receipt confirmation still pending.",
        focusHref: "/operating",
        summary: "Execution result still needs review.",
        nextAction: "Review the visible execution result first.",
        latestUpdatedAt: new Date("2026-04-13T12:07:00.000Z"),
        counts: {
          ...operatorControlSummary.counts,
          pendingExecutionWrites: 1,
        },
      },
      operatorReviewSummary,
      operatorReviewActionSummary,
    });

    expect(summary.state).toBe("control_attention");
    expect(summary.driver).toBe("operator_control");
    expect(summary.focusTitle).toBe("Receipt confirmation still pending.");
    expect(summary.focusHref).toBe("/operating");
    expect(summary.counts.pendingExecutionWrites).toBe(1);
  });

  it("inherits review action focus when review attention leads workspace cue", () => {
    const summary = buildRuntimeOperatorCueSummary({
      operatorWorkSummary: {
        state: "review_attention" as const,
        driver: "review_queue" as const,
        actionState: "resolve_verification" as const,
        controlState: "review_gated" as const,
        reviewState: "verification_attention" as const,
        reviewActionState: "resolve_verification" as const,
        focusTitle: "Verification queue",
        focusHref: "/operating/verification",
        summary: "Review queue leads workspace next work.",
        nextAction: "Resolve the next verification item.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
        boundaryNote: "Operator work summary stays bounded.",
        counts: {
          continuityAttention: 0,
          reviewQueue: 2,
          promotionQueue: 0,
          reflectionCandidates: 0,
          reflectionJobs: 0,
          consolidationJobs: 0,
          criticalOperatingGaps: 0,
        },
      },
      operatorActionSummary,
      operatorControlSummary,
      operatorReviewSummary: {
        ...operatorReviewSummary,
        state: "verification_attention",
        driver: "verification_queue",
        focusTitle: "Verification queue",
        focusHref: "/operating/verification",
      },
      operatorReviewActionSummary: {
        ...operatorReviewActionSummary,
        state: "resolve_verification",
        driver: "verification_queue",
        reviewState: "verification_attention",
        focusTitle: "Verification queue",
        focusHref: "/operating/verification",
        summary: "Verification review is the next bounded workspace action.",
        nextAction: "Resolve the next verification item first.",
        counts: {
          ...operatorReviewActionSummary.counts,
          verificationQueue: 2,
        },
      },
    });

    expect(summary.state).toBe("review_attention");
    expect(summary.driver).toBe("operator_review");
    expect(summary.focusHref).toBe("/operating/verification");
    expect(summary.counts.reviewQueue).toBe(2);
  });

  it("falls back to steady-state cue when no operator blocker leads the workspace", () => {
    const summary = buildRuntimeOperatorCueSummary({
      operatorWorkSummary: {
        state: "steady_state" as const,
        driver: "steady_state" as const,
        actionState: "observe" as const,
        controlState: "boundary_only" as const,
        reviewState: "clear" as const,
        reviewActionState: "hold_review_gated" as const,
        focusTitle: null,
        focusHref: null,
        summary: "Workspace remains on bounded observation.",
        nextAction: "Keep the workspace on bounded observation.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
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
      },
      operatorActionSummary: {
        ...operatorActionSummary,
        state: "observe",
        summary: "No immediate operator action is open.",
        nextAction: "Keep the thread on bounded observation.",
      },
      operatorControlSummary: {
        ...operatorControlSummary,
        state: "boundary_only",
        driver: "environment_authority",
      },
      operatorReviewSummary,
      operatorReviewActionSummary,
    });

    expect(summary.state).toBe("steady_state");
    expect(summary.driver).toBe("steady_state");
    expect(summary.summary).toContain("No immediate operator action is open");
  });
});
