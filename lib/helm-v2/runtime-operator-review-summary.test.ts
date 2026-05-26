import { describe, expect, it } from "vitest";

import { buildRuntimeOperatorReviewSummary } from "@/lib/helm-v2/runtime-operator-review-summary";

describe("buildRuntimeOperatorReviewSummary", () => {
  it("prioritizes verification queue items first", () => {
    const summary = buildRuntimeOperatorReviewSummary({
      verificationQueue: [
        {
          title: "Session verification",
          href: "/meetings/meeting_1",
          createdAt: new Date("2026-04-13T12:00:00.000Z"),
        },
      ],
      promotionQueue: [],
      reflectionCandidates: [],
      reflectionJobs: [],
      consolidationJobs: [],
    });

    expect(summary.state).toBe("verification_attention");
    expect(summary.driver).toBe("verification_queue");
    expect(summary.focusTitle).toBe("Session verification");
  });

  it("falls back to promotion attention when verification queue is clear", () => {
    const summary = buildRuntimeOperatorReviewSummary({
      verificationQueue: [],
      promotionQueue: [
        {
          title: "Carry-forward review",
          href: "/meetings/meeting_2",
          createdAt: new Date("2026-04-13T12:05:00.000Z"),
        },
      ],
      reflectionCandidates: [],
      reflectionJobs: [],
      consolidationJobs: [],
    });

    expect(summary.state).toBe("promotion_attention");
    expect(summary.driver).toBe("promotion_queue");
  });

  it("reports clear when no review queue stays open", () => {
    const summary = buildRuntimeOperatorReviewSummary({
      verificationQueue: [],
      promotionQueue: [],
      reflectionCandidates: [],
      reflectionJobs: [],
      consolidationJobs: [],
    });

    expect(summary.state).toBe("clear");
    expect(summary.driver).toBe("steady_state");
  });
});
