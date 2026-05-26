import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorWorkSummary } from "@/lib/helm-v2/runtime-operator-work-summary";

describe("buildRuntimeOperatorWorkSummary", () => {
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
    summary: "Keep the thread review-gated.",
    nextAction: "Keep the thread review-gated until the operator explicitly advances it.",
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

  const operatorReviewActionSummary = {
    state: "hold_review_gated" as const,
    driver: "steady_state" as const,
    reviewState: "clear" as const,
    focusTitle: null,
    focusHref: null,
    summary: "No review-first queue needs immediate operator action.",
    nextAction: "Keep the workspace review-gated until a visible review queue opens.",
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

  it("prioritizes critical operating gaps", () => {
    const summary = buildRuntimeOperatorWorkSummary({
      operatorActionSummary,
      operatorControlSummary,
      operatorReviewActionSummary,
      continuityQueue: [],
      criticalOperatingGapCount: 2,
    });

    expect(summary.state).toBe("operating_gap_attention");
    expect(summary.driver).toBe("operating_gap");
  });

  it("prioritizes continuity attention over control review", () => {
    const summary = buildRuntimeOperatorWorkSummary({
      operatorActionSummary,
      operatorControlSummary,
      operatorReviewActionSummary,
      continuityQueue: [
        {
          title: "Recovery gap",
          href: "/operating",
          updatedAt: new Date("2026-04-13T12:05:00.000Z"),
          operatorActionSummary: {
            ...operatorActionSummary,
            state: "resolve_execution_followthrough",
            driver: "operator_control",
            operatorControlState: "execution_follow_through",
            summary: "Resolve execution follow-through before settling this thread.",
            nextAction: "Resolve execution follow-through first.",
          },
        },
      ],
      criticalOperatingGapCount: 0,
    });

    expect(summary.state).toBe("continuity_attention");
    expect(summary.driver).toBe("operator_action");
    expect(summary.focusTitle).toBe("Recovery gap");
  });

  it("falls back to review attention when only queues remain", () => {
    const summary = buildRuntimeOperatorWorkSummary({
      operatorActionSummary,
      operatorControlSummary,
      operatorReviewActionSummary: {
        ...operatorReviewActionSummary,
        state: "resolve_verification",
        driver: "verification_queue",
        reviewState: "verification_attention",
        focusTitle: "Verification review",
        focusHref: "/operating/verification",
        summary: "Verification review is still the next workspace-level review-first action.",
        nextAction: "Clear the visible verification review queue first.",
        counts: {
          ...operatorReviewActionSummary.counts,
          verificationQueue: 2,
        },
      },
      continuityQueue: [],
      criticalOperatingGapCount: 0,
    });

    expect(summary.state).toBe("review_attention");
    expect(summary.driver).toBe("review_queue");
    expect(summary.focusTitle).toBe("Verification review");
    expect(summary.reviewActionState).toBe("resolve_verification");
    expect(summary.counts.reviewQueue).toBe(2);
  });

  it("treats reflection and consolidation review queues as workspace review attention", () => {
    const summary = buildRuntimeOperatorWorkSummary({
      operatorActionSummary,
      operatorControlSummary,
      operatorReviewActionSummary: {
        ...operatorReviewActionSummary,
        state: "watch_reflection_job",
        driver: "reflection_job_queue",
        reviewState: "reflection_job_attention",
        focusTitle: "Reflection review",
        focusHref: "/operating/reflection",
        summary: "Reflection job review is still the next workspace-level review-first action.",
        nextAction: "Inspect the open reflection job before claiming a steady workspace.",
        counts: {
          ...operatorReviewActionSummary.counts,
          reflectionJobs: 1,
          consolidationJobs: 1,
        },
      },
      continuityQueue: [],
      criticalOperatingGapCount: 0,
    });

    expect(summary.state).toBe("review_attention");
    expect(summary.driver).toBe("review_queue");
    expect(summary.focusHref).toBe("/operating/reflection");
    expect(summary.reviewState).toBe("reflection_job_attention");
    expect(summary.reviewActionState).toBe("watch_reflection_job");
    expect(summary.counts.reflectionJobs).toBe(1);
    expect(summary.counts.consolidationJobs).toBe(1);
  });

  it("inherits control focus when execution posture drives workspace attention", () => {
    const summary = buildRuntimeOperatorWorkSummary({
      operatorActionSummary,
      operatorControlSummary: {
        ...operatorControlSummary,
        state: "execution_follow_through",
        driver: "environment_execution",
        focusTitle: "Receipt confirmation still pending.",
        focusHref: "/operating",
        nextAction: "Resolve the visible official follow-through first.",
      },
      operatorReviewActionSummary,
      continuityQueue: [],
      criticalOperatingGapCount: 0,
    });

    expect(summary.state).toBe("execution_attention");
    expect(summary.driver).toBe("operator_control");
    expect(summary.focusTitle).toBe("Receipt confirmation still pending.");
    expect(summary.focusHref).toBe("/operating");
  });

  it("inherits control focus when benchmark posture drives workspace attention", () => {
    const summary = buildRuntimeOperatorWorkSummary({
      operatorActionSummary,
      operatorControlSummary: {
        ...operatorControlSummary,
        state: "benchmark_requested",
        driver: "benchmark_workflow",
        focusTitle: "Re-run operator usability gates after the latest surface change.",
        focusHref: "/operating",
        nextAction: "Run the requested benchmark gates first.",
      },
      operatorReviewActionSummary,
      continuityQueue: [],
      criticalOperatingGapCount: 0,
    });

    expect(summary.state).toBe("benchmark_attention");
    expect(summary.driver).toBe("operator_control");
    expect(summary.focusTitle).toBe("Re-run operator usability gates after the latest surface change.");
    expect(summary.focusHref).toBe("/operating");
  });
});
