import { describe, expect, it } from "vitest";
import { buildRuntimeOperatorActionCueSummary } from "@/lib/helm-v2/runtime-operator-action-cue-summary";
import type {
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorCueSummary,
  HelmV21RuntimeOperatorNextMoveSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
} from "@/lib/helm-v2/contracts";

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
    focusTitle: null,
    focusHref: null,
    summary: "control gated",
    nextAction: "keep review gated",
    latestUpdatedAt: null,
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

function buildNextMoveSummary(
  overrides: Partial<HelmV21RuntimeOperatorNextMoveSummary> = {},
): HelmV21RuntimeOperatorNextMoveSummary {
  return {
    state: "observe",
    driver: "steady_state",
    cueState: "steady_state",
    workState: "steady_state",
    actionState: "observe",
    reviewActionState: "hold_review_gated",
    focusTitle: "Observe runtime",
    focusHref: "/operating",
    summary: "Observe runtime",
    nextAction: "Keep bounded observation",
    latestUpdatedAt: new Date("2026-04-13T09:00:00.000Z"),
    boundaryNote: "boundary",
    ...overrides,
  };
}

describe("buildRuntimeOperatorActionCueSummary", () => {
  it("maps operating gap cue to operator work lane", () => {
    const summary = buildRuntimeOperatorActionCueSummary({
      operatorCueSummary: buildCueSummary({ state: "operating_gap_attention", driver: "operator_work" }),
      operatorNextMoveSummary: buildNextMoveSummary({ state: "resolve_operating_gap", driver: "operator_work" }),
      operatorControlSummary: buildControlSummary(),
      operatorReviewActionSummary: buildReviewActionSummary(),
    });

    expect(summary.state).toBe("resolve_operating_gap");
    expect(summary.driver).toBe("operator_work");
  });

  it("maps control cue to operator control lane", () => {
    const summary = buildRuntimeOperatorActionCueSummary({
      operatorCueSummary: buildCueSummary({ state: "control_attention", driver: "operator_control" }),
      operatorNextMoveSummary: buildNextMoveSummary({
        state: "acknowledge_execution",
        driver: "operator_action",
        actionState: "acknowledge_execution",
      }),
      operatorControlSummary: buildControlSummary({
        state: "execution_pending",
        driver: "environment_execution",
      }),
      operatorReviewActionSummary: buildReviewActionSummary(),
    });

    expect(summary.state).toBe("resolve_operator_control");
    expect(summary.driver).toBe("operator_control");
  });

  it("maps review cue to workspace review lane", () => {
    const summary = buildRuntimeOperatorActionCueSummary({
      operatorCueSummary: buildCueSummary({ state: "review_attention", driver: "operator_review" }),
      operatorNextMoveSummary: buildNextMoveSummary({
        state: "watch_reflection_job",
        driver: "operator_review",
        reviewActionState: "watch_reflection_job",
        focusHref: "/meetings/meeting_reflection_review_1",
      }),
      operatorControlSummary: buildControlSummary(),
      operatorReviewActionSummary: buildReviewActionSummary({
        state: "watch_reflection_job",
        driver: "reflection_job_queue",
      }),
    });

    expect(summary.state).toBe("resolve_workspace_review");
    expect(summary.driver).toBe("operator_review");
    expect(summary.focusHref).toBe("/meetings/meeting_reflection_review_1");
  });

  it("keeps review-gated workspace in steady lane", () => {
    const summary = buildRuntimeOperatorActionCueSummary({
      operatorCueSummary: buildCueSummary({ state: "review_gated", driver: "steady_state" }),
      operatorNextMoveSummary: buildNextMoveSummary({ state: "keep_review_gated", driver: "steady_state" }),
      operatorControlSummary: buildControlSummary(),
      operatorReviewActionSummary: buildReviewActionSummary(),
    });

    expect(summary.state).toBe("keep_review_gated");
    expect(summary.driver).toBe("steady_state");
  });
});
