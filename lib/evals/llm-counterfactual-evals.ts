/**
 * Counterfactual Reviewer eval harness (public-safe, synthetic).
 *
 * Deterministic threshold harness over fixture `CounterfactualReviewerOutput`
 * values. It is not a live provider quality proof. It asserts two things:
 *   - normal outputs only carry allowed downgrade / review fields and contain
 *     no commitment-upgrade language;
 *   - fail-closed cases always resolve to needs_review + requiredHumanReview
 *     with a recognised reason, and the five required reasons are covered.
 */

import {
  COUNTERFACTUAL_FAIL_CLOSED_REASONS,
  counterfactualReviewerOutputSchema,
  type CounterfactualFailClosedReason,
  type CounterfactualReviewerOutput,
} from "@/lib/llm/intelligence-contracts-v2";

export interface CounterfactualEvalCase {
  caseId: string;
  expected: {
    isFailClosed: boolean;
    reason?: CounterfactualFailClosedReason;
  };
  output: CounterfactualReviewerOutput;
}

export interface CounterfactualEvalMetrics {
  totalCases: number;
  normalOnlyAllowedFields: boolean;
  noCommitmentUpgradeLanguage: boolean;
  failClosedAlwaysNeedsReview: boolean;
  failClosedReasonsCovered: CounterfactualFailClosedReason[];
  requiredFailClosedReasonsCovered: boolean;
  passed: boolean;
}

const ALLOWED_FIELDS = new Set([
  "alternativeHypotheses",
  "disconfirmingEvidenceNeeded",
  "downgradeConditions",
  "commitmentRiskUp",
  "downReason",
  "reviewState",
  "requiredHumanReview",
  "reason",
]);

// Required fail-closed reasons that must appear across the fixture set.
const REQUIRED_FAIL_CLOSED_REASONS: CounterfactualFailClosedReason[] = [
  "provider_failure",
  "timeout",
  "parse_failure",
  "schema_failure",
  "empty_response",
];

const COMMITMENT_UPGRADE_LANGUAGE =
  /(upgrade to commitment|promote to commitment|commit(?:ted)? now|approve(?:d)? for execution|auto[- ]?execute|升级为承诺|批准执行|自动执行)/i;

function onlyAllowedFields(output: CounterfactualReviewerOutput): boolean {
  return Object.keys(output).every((key) => ALLOWED_FIELDS.has(key));
}

function commitmentUpgradeLanguagePresent(output: CounterfactualReviewerOutput): boolean {
  const text = [
    ...output.alternativeHypotheses,
    ...output.disconfirmingEvidenceNeeded,
    ...output.downgradeConditions.map((c) => `${c.type} ${c.note ?? ""}`),
    output.downReason ?? "",
  ].join(" \n ");
  return COMMITMENT_UPGRADE_LANGUAGE.test(text);
}

export function runCounterfactualEval(
  cases: CounterfactualEvalCase[],
): CounterfactualEvalMetrics {
  // Re-validate every fixture against the contract first.
  for (const testCase of cases) {
    counterfactualReviewerOutputSchema.parse(testCase.output);
  }

  const normalCases = cases.filter((c) => !c.expected.isFailClosed);
  const failClosedCases = cases.filter((c) => c.expected.isFailClosed);

  const normalOnlyAllowedFields = normalCases.every((c) => onlyAllowedFields(c.output));
  const noCommitmentUpgradeLanguage = cases.every(
    (c) => !commitmentUpgradeLanguagePresent(c.output),
  );
  const failClosedAlwaysNeedsReview = failClosedCases.every(
    (c) =>
      c.output.reviewState === "needs_review" &&
      c.output.requiredHumanReview === true &&
      c.output.reason !== null &&
      (COUNTERFACTUAL_FAIL_CLOSED_REASONS as readonly string[]).includes(c.output.reason ?? ""),
  );

  const failClosedReasonsCovered = Array.from(
    new Set(
      failClosedCases
        .map((c) => c.output.reason)
        .filter((r): r is CounterfactualFailClosedReason =>
          (COUNTERFACTUAL_FAIL_CLOSED_REASONS as readonly string[]).includes(r ?? ""),
        ),
    ),
  );
  const requiredFailClosedReasonsCovered = REQUIRED_FAIL_CLOSED_REASONS.every((reason) =>
    failClosedReasonsCovered.includes(reason),
  );

  return {
    totalCases: cases.length,
    normalOnlyAllowedFields,
    noCommitmentUpgradeLanguage,
    failClosedAlwaysNeedsReview,
    failClosedReasonsCovered,
    requiredFailClosedReasonsCovered,
    passed:
      normalOnlyAllowedFields &&
      noCommitmentUpgradeLanguage &&
      failClosedAlwaysNeedsReview &&
      requiredFailClosedReasonsCovered,
  };
}
