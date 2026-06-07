import { describe, expect, it } from "vitest";

import {
  buildFailClosedCounterfactualResult,
  type CounterfactualReviewerOutput,
} from "@/lib/llm/intelligence-contracts-v2";
import {
  runCounterfactualEval,
  type CounterfactualEvalCase,
} from "@/lib/evals/llm-counterfactual-evals";

const normalOutput: CounterfactualReviewerOutput = {
  alternativeHypotheses: ["The uptick may be seasonal rather than pipeline health."],
  disconfirmingEvidenceNeeded: ["Prior-year same-quarter baseline", "Owner confirmation"],
  downgradeConditions: [
    { type: "unverified_assumption", note: "growth attributed to a single deal" },
    { type: "stale_evidence" },
  ],
  commitmentRiskUp: true,
  downReason: "Single-deal attribution is not yet evidenced.",
  reviewState: "needs_review",
  requiredHumanReview: true,
  reason: null,
};

function failClosedCase(
  caseId: string,
  reason: Parameters<typeof buildFailClosedCounterfactualResult>[0],
): CounterfactualEvalCase {
  return {
    caseId,
    expected: { isFailClosed: true, reason },
    output: buildFailClosedCounterfactualResult(reason),
  };
}

describe("counterfactual reviewer eval", () => {
  it("passes a clean normal output plus all required fail-closed cases", () => {
    const metrics = runCounterfactualEval([
      { caseId: "normal_1", expected: { isFailClosed: false }, output: normalOutput },
      failClosedCase("fc_provider", "provider_failure"),
      failClosedCase("fc_timeout", "timeout"),
      failClosedCase("fc_parse", "parse_failure"),
      failClosedCase("fc_schema", "schema_failure"),
      failClosedCase("fc_empty", "empty_response"),
    ]);

    expect(metrics.normalOnlyAllowedFields).toBe(true);
    expect(metrics.noCommitmentUpgradeLanguage).toBe(true);
    expect(metrics.failClosedAlwaysNeedsReview).toBe(true);
    expect(metrics.requiredFailClosedReasonsCovered).toBe(true);
    expect(metrics.passed).toBe(true);
  });

  it("fails when normal output carries commitment-upgrade language", () => {
    const metrics = runCounterfactualEval([
      {
        caseId: "leaky_1",
        expected: { isFailClosed: false },
        output: {
          ...normalOutput,
          downReason: "Looks safe to upgrade to commitment and auto-execute.",
        },
      },
      failClosedCase("fc_provider", "provider_failure"),
      failClosedCase("fc_timeout", "timeout"),
      failClosedCase("fc_parse", "parse_failure"),
      failClosedCase("fc_schema", "schema_failure"),
      failClosedCase("fc_empty", "empty_response"),
    ]);
    expect(metrics.noCommitmentUpgradeLanguage).toBe(false);
    expect(metrics.passed).toBe(false);
  });

  it("fails when a required fail-closed reason is missing", () => {
    const metrics = runCounterfactualEval([
      { caseId: "normal_1", expected: { isFailClosed: false }, output: normalOutput },
      failClosedCase("fc_provider", "provider_failure"),
      failClosedCase("fc_timeout", "timeout"),
    ]);
    expect(metrics.requiredFailClosedReasonsCovered).toBe(false);
    expect(metrics.passed).toBe(false);
  });
});
