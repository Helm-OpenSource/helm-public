import { describe, expect, it } from "vitest";
import {
  runCommercialPromotionPackEval,
  type CommercialPromotionFixturePack,
} from "@/lib/evals/commercial-promotion-pack-evals";

describe("commercial promotion pack eval", () => {
  it("passes the checked-in review-first P0 worker artifact fixture pack", () => {
    const summary = runCommercialPromotionPackEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(7);
    expect(summary.readyCases).toBe(6);
    expect(summary.expectedReadyCases).toBe(6);
    expect(summary.totalExternalSideEffectCount).toBe(1);
    expect(summary.totalForbiddenInputCount).toBe(1);

    const broken = summary.caseResults.find((item) => item.caseId === "COMM-PROMO-BROKEN-AUTO-SEND-001");
    expect(broken?.ready).toBe(false);
    expect(broken?.failures).toContain("external_side_effect_count:1");
    expect(broken?.failures).toContain("forbidden_input_count:1");
    expect(broken?.failures).toContain("blocked_output:auto_send");
  });

  it("fails when scorecard uses LLM final ranking or misses a required dimension", () => {
    const fixture = {
      version: "broken-scorecard",
      status: "offline_evaluation_fixture",
      redactionPosture: "synthetic",
      boundary: "test-only",
      targets: {
        minimumReadyScore: 85,
        minimumRequiredFieldCoveragePercent: 90,
        minimumEvidenceRefCount: 2,
        maximumBoundaryIncidentCount: 0,
        maximumExternalSideEffectCount: 0,
        maximumForbiddenInputCount: 0,
        requiredScorecardDimensions: [
          "pain",
          "business_owner",
          "data_availability",
          "proof_value",
          "paid_pilot_willingness",
          "boundary_fit",
        ],
      },
      cases: [
        {
          id: "BROKEN-SCORECARD",
          workerId: "commercial.design_partner_scorecard",
          expectedReady: true,
          artifact: {
            requiredFields: ["painScore", "totalScore", "recommendationTier"],
            presentFields: ["painScore", "totalScore", "recommendationTier"],
            evidenceRefs: ["candidate:alias-z", "scorecard-rule"],
            boundaryNote: "Score is advisory.",
            outcomeMetric: "top_candidate_to_scope_call_conversion",
            reviewPosture: "ready_for_founder_decision",
            requiredReviewers: ["founder"],
            externalSideEffects: [],
            forbiddenInputMarkers: [],
            blockedOutputMarkers: [],
            scoreDimensions: ["pain", "business_owner"],
            llmFinalRanking: true,
          },
        },
      ],
    } satisfies CommercialPromotionFixturePack;

    const summary = runCommercialPromotionPackEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-SCORECARD",
      reason: "readiness_expectation_mismatch",
    });
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-SCORECARD",
      reason: "llm_final_ranking_forbidden",
    });
    expect(summary.failures).toContainEqual({
      caseId: "BROKEN-SCORECARD",
      reason: "missing_scorecard_dimension:data_availability",
    });
  });
});
