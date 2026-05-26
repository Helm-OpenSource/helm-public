import { describe, expect, it } from "vitest";
import { buildRuntimeOperatorReviewControlCueSummary } from "@/lib/helm-v2/runtime-operator-review-control-cue-summary";
import type {
  HelmV21RuntimeOperatorActionCueSummary,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorReviewSummary,
} from "@/lib/helm-v2/contracts";

function buildActionCueSummary(
  overrides: Partial<HelmV21RuntimeOperatorActionCueSummary> = {},
): HelmV21RuntimeOperatorActionCueSummary {
  return {
    state: "observe",
    driver: "steady_state",
    cueState: "steady_state",
    nextMoveState: "observe",
    actionState: "observe",
    controlState: "review_gated",
    reviewActionState: "hold_review_gated",
    focusTitle: "Observe runtime",
    focusHref: "/operating",
    summary: "Observe runtime",
    nextAction: "Keep bounded observation",
    latestUpdatedAt: new Date("2026-04-13T10:00:00.000Z"),
    boundaryNote: "boundary",
    ...overrides,
  };
}

function buildCueSummary(
  overrides: Partial<HelmV21RuntimeOperatorCueSummary> = {},
): HelmV21RuntimeOperatorCueSummary {
  return {
    state: "steady_state",
    driver: "steady_state",
    workState: "steady_state",
    actionState: "observe",
    controlState: "review_gated",
    reviewState: "clear",
    reviewActionState: "hold_review_gated",
    focusTitle: null,
    focusHref: "/operating",
    summary: "cue summary",
    nextAction: "observe",
    latestUpdatedAt: null,
    boundaryNote: "boundary",
    counts: {
      continuityAttention: 0,
      reviewQueue: 0,
      criticalOperatingGaps: 0,
      pendingExecutionWrites: 0,
      benchmarkPendingRequests: 0,
    },
    ...overrides,
  };
}

function buildControlSummary(
  overrides: Partial<HelmV21RuntimeOperatorControlSummary> = {},
): HelmV21RuntimeOperatorControlSummary {
  return {
    state: "review_gated",
    driver: "steady_state",
    authorityPosture: "review_gated",
    executionSeamPosture: "boundary_only",
    benchmarkWorkflowState: "idle",
    benchmarkFollowThroughState: "not_requested",
    focusTitle: "Operator control",
    focusHref: "/operating",
    summary: "control summary",
    nextAction: "hold control",
    latestUpdatedAt: new Date("2026-04-13T09:00:00.000Z"),
    boundaryNote: "boundary",
    counts: {
      pendingExecutionWrites: 0,
      openExecutionFollowThrough: 0,
      benchmarkPendingRequests: 0,
      benchmarkRecordedGates: 0,
      benchmarkWarningGates: 0,
      benchmarkFailingGates: 0,
      benchmarkAcknowledgedRuns: 0,
    },
    ...overrides,
  };
}

function buildReviewSummary(
  overrides: Partial<HelmV21RuntimeOperatorReviewSummary> = {},
): HelmV21RuntimeOperatorReviewSummary {
  return {
    state: "clear",
    driver: "steady_state",
    focusTitle: null,
    focusHref: null,
    summary: "review clear",
    nextAction: "keep review-first",
    latestUpdatedAt: null,
    boundaryNote: "boundary",
    counts: {
      verificationQueue: 0,
      promotionQueue: 0,
      reflectionCandidates: 0,
      reflectionJobs: 0,
      consolidationJobs: 0,
    },
    ...overrides,
  };
}

function buildReviewActionSummary(
  overrides: Partial<HelmV21RuntimeOperatorReviewActionSummary> = {},
): HelmV21RuntimeOperatorReviewActionSummary {
  return {
    state: "hold_review_gated",
    driver: "steady_state",
    reviewState: "clear",
    focusTitle: null,
    focusHref: null,
    summary: "review gated",
    nextAction: "hold review",
    latestUpdatedAt: null,
    boundaryNote: "boundary",
    counts: {
      verificationQueue: 0,
      promotionQueue: 0,
      reflectionCandidates: 0,
      reflectionJobs: 0,
      consolidationJobs: 0,
    },
    ...overrides,
  };
}

describe("buildRuntimeOperatorReviewControlCueSummary", () => {
  it("prioritizes control when cue already points to control", () => {
    const summary = buildRuntimeOperatorReviewControlCueSummary({
      operatorCueSummary: buildCueSummary({ state: "control_attention", driver: "operator_control" }),
      operatorActionCueSummary: buildActionCueSummary({
        state: "resolve_operator_control",
        driver: "operator_control",
      }),
      operatorControlSummary: buildControlSummary({
        state: "execution_follow_through",
        driver: "environment_execution",
      }),
      operatorReviewSummary: buildReviewSummary(),
      operatorReviewActionSummary: buildReviewActionSummary(),
    });

    expect(summary.state).toBe("control_priority");
    expect(summary.driver).toBe("operator_control");
  });

  it("prioritizes review when cue already points to review", () => {
    const summary = buildRuntimeOperatorReviewControlCueSummary({
      operatorCueSummary: buildCueSummary({ state: "review_attention", driver: "operator_review" }),
      operatorActionCueSummary: buildActionCueSummary({
        state: "resolve_workspace_review",
        driver: "operator_review",
      }),
      operatorControlSummary: buildControlSummary(),
      operatorReviewSummary: buildReviewSummary({
        state: "reflection_job_attention",
        driver: "reflection_job_queue",
      }),
      operatorReviewActionSummary: buildReviewActionSummary({
        state: "watch_reflection_job",
        driver: "reflection_job_queue",
        focusHref: "/meetings/meeting_reflection_review_1",
      }),
    });

    expect(summary.state).toBe("review_priority");
    expect(summary.driver).toBe("operator_review");
    expect(summary.focusHref).toBe("/meetings/meeting_reflection_review_1");
  });

  it("falls back to review-gated when neither control nor review is open", () => {
    const summary = buildRuntimeOperatorReviewControlCueSummary({
      operatorCueSummary: buildCueSummary({ state: "review_gated", driver: "steady_state" }),
      operatorActionCueSummary: buildActionCueSummary({
        state: "keep_review_gated",
        driver: "steady_state",
      }),
      operatorControlSummary: buildControlSummary(),
      operatorReviewSummary: buildReviewSummary(),
      operatorReviewActionSummary: buildReviewActionSummary(),
    });

    expect(summary.state).toBe("review_gated");
    expect(summary.driver).toBe("steady_state");
  });
});
