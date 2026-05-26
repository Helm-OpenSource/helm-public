import { describe, expect, it } from "vitest";
import {
  runSelfImprovementEval,
  type SelfImprovementFixturePack,
} from "@/lib/evals/self-improvement-evals";

describe("self-improvement eval", () => {
  it("passes the checked-in review-first learning loop fixture pack", () => {
    const summary = runSelfImprovementEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(5);
    expect(summary.readyCases).toBe(summary.expectedReadyCases);
    expect(summary.totalBoundaryIncidentCount).toBe(1);
    expect(summary.totalAutoPromotionCount).toBe(1);

    const broken = summary.caseResults.find((item) => item.caseId === "SELF-IMPROVE-BROKEN-AUTO-001");
    expect(broken?.ready).toBe(false);
    expect(broken?.failures).toContain("auto_promotion_count:1");
  });

  it("fails when an expected-ready loop lacks measurement", () => {
    const fixture = {
      version: "broken",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: {
        minimumLoopScore: 80,
        minimumEvidenceCoveragePercent: 80,
        minimumReviewCoveragePercent: 100,
        maximumBoundaryIncidentCount: 0,
        minimumMeasuredImprovementPercent: 10,
        maximumAutoPromotionCount: 0,
      },
      cases: [
        {
          id: "BROKEN-NO-MEASUREMENT",
          surface: "recommendation",
          learningLoop: "feedback_without_measurement",
          expectedReady: true,
          events: [
            {
              stage: "signal",
              eventType: "recommendation_shown",
              evidenceRefs: ["rec:1"],
              reviewRequired: false,
              reviewCompleted: false,
              boundaryIncidentCount: 0,
            },
            {
              stage: "candidate",
              eventType: "preference_signal_updated",
              evidenceRefs: ["pref:1"],
              reviewRequired: true,
              reviewCompleted: true,
              boundaryIncidentCount: 0,
            },
            {
              stage: "review",
              eventType: "candidate_reviewed",
              evidenceRefs: ["review:1"],
              reviewRequired: true,
              reviewCompleted: true,
              boundaryIncidentCount: 0,
            },
          ],
          expectedOutputs: ["preference_signal"],
          blockedOutputs: ["auto_promotion"],
        },
      ],
    } satisfies SelfImprovementFixturePack;

    const summary = runSelfImprovementEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-NO-MEASUREMENT",
      reason: "readiness_expectation_mismatch",
    });
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-NO-MEASUREMENT",
      reason: "missing_stage:measurement",
    });
  });
});
