import { describe, expect, it } from "vitest";
import { buildRuntimeOperatorStartPointSummary } from "@/lib/helm-v2/runtime-operator-start-point-summary";
import type {
  HelmV21RuntimeOperatorActionCueSummary,
  HelmV21RuntimeOperatorReviewControlCueSummary,
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
    latestUpdatedAt: new Date("2026-04-13T11:00:00.000Z"),
    boundaryNote: "boundary",
    ...overrides,
  };
}

function buildReviewControlCueSummary(
  overrides: Partial<HelmV21RuntimeOperatorReviewControlCueSummary> = {},
): HelmV21RuntimeOperatorReviewControlCueSummary {
  return {
    state: "observe",
    driver: "steady_state",
    cueState: "steady_state",
    actionCueState: "observe",
    controlState: "review_gated",
    reviewState: "clear",
    reviewActionState: "hold_review_gated",
    focusTitle: "Observe workspace",
    focusHref: "/operating",
    summary: "Observe workspace",
    nextAction: "Keep bounded observation",
    latestUpdatedAt: new Date("2026-04-13T10:30:00.000Z"),
    boundaryNote: "boundary",
    ...overrides,
  };
}

describe("buildRuntimeOperatorStartPointSummary", () => {
  it("keeps primary action lane as start state and review/control cue as follow-up", () => {
    const summary = buildRuntimeOperatorStartPointSummary({
      operatorActionCueSummary: buildActionCueSummary({
        state: "resolve_operating_gap",
        driver: "operator_work",
        nextAction: "Resolve the critical operating gap first.",
      }),
      operatorReviewControlCueSummary: buildReviewControlCueSummary({
        state: "control_priority",
        driver: "operator_control",
        nextAction: "Then resolve execution follow-through.",
      }),
    });

    expect(summary.state).toBe("resolve_operating_gap");
    expect(summary.primaryState).toBe("resolve_operating_gap");
    expect(summary.secondaryState).toBe("control_priority");
    expect(summary.followupAction).toBe("Then resolve execution follow-through.");
  });

  it("keeps review action as primary and review cue as secondary when review leads", () => {
    const summary = buildRuntimeOperatorStartPointSummary({
      operatorActionCueSummary: buildActionCueSummary({
        state: "resolve_workspace_review",
        driver: "operator_review",
        focusHref: "/meetings/meeting_reflection_review_1",
      }),
      operatorReviewControlCueSummary: buildReviewControlCueSummary({
        state: "review_priority",
        driver: "operator_review",
        focusHref: "/meetings/meeting_reflection_review_1",
      }),
    });

    expect(summary.driver).toBe("operator_review");
    expect(summary.secondaryDriver).toBe("operator_review");
    expect(summary.focusHref).toBe("/meetings/meeting_reflection_review_1");
  });
});
