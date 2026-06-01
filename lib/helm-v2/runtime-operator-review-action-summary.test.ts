import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorReviewActionSummary } from "@/lib/helm-v2/runtime-operator-review-action-summary";

describe("buildRuntimeOperatorReviewActionSummary", () => {
  it("turns verification attention into resolve_verification", () => {
    const summary = buildRuntimeOperatorReviewActionSummary({
      operatorReviewSummary: {
        state: "verification_attention",
        driver: "verification_queue",
        focusTitle: "Session verification",
        focusHref: "/meetings/meeting_1",
        summary: "Verification is open.",
        nextAction: "Resolve verification first.",
        latestUpdatedAt: new Date("2026-04-13T12:00:00.000Z"),
        boundaryNote: "Review summary stays bounded.",
        counts: {
          verificationQueue: 2,
          promotionQueue: 0,
          reflectionCandidates: 0,
          reflectionJobs: 0,
          consolidationJobs: 0,
        },
      },
    });

    expect(summary.state).toBe("resolve_verification");
    expect(summary.driver).toBe("verification_queue");
    expect(summary.reviewState).toBe("verification_attention");
  });

  it("turns promotion attention into review_promotion", () => {
    const summary = buildRuntimeOperatorReviewActionSummary({
      operatorReviewSummary: {
        state: "promotion_attention",
        driver: "promotion_queue",
        focusTitle: "Promotion review",
        focusHref: "/meetings/meeting_2",
        summary: "Promotion is open.",
        nextAction: "Review promotion first.",
        latestUpdatedAt: new Date("2026-04-13T12:05:00.000Z"),
        boundaryNote: "Review summary stays bounded.",
        counts: {
          verificationQueue: 0,
          promotionQueue: 1,
          reflectionCandidates: 0,
          reflectionJobs: 0,
          consolidationJobs: 0,
        },
      },
    });

    expect(summary.state).toBe("review_promotion");
    expect(summary.driver).toBe("promotion_queue");
  });

  it("holds review-gated posture when no review queue is open", () => {
    const summary = buildRuntimeOperatorReviewActionSummary({
      operatorReviewSummary: {
        state: "clear",
        driver: "steady_state",
        focusTitle: null,
        focusHref: null,
        summary: "Queues are clear.",
        nextAction: "Stay review-gated.",
        latestUpdatedAt: null,
        boundaryNote: "Review summary stays bounded.",
        counts: {
          verificationQueue: 0,
          promotionQueue: 0,
          reflectionCandidates: 0,
          reflectionJobs: 0,
          consolidationJobs: 0,
        },
      },
    });

    expect(summary.state).toBe("hold_review_gated");
    expect(summary.driver).toBe("steady_state");
  });
});
