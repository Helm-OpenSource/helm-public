import { describe, expect, it } from "vitest";

import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
import { runLLMCriticHeldOutEval } from "@/lib/evals/llm-critic-evals";

function criticResult(
  id: string,
  issueCodes: LLMCriticResult["issueCodes"],
): LLMCriticResult {
  return {
    resultId: `result_${id}`,
    candidateId: `candidate_${id}`,
    packetId: `packet_${id}`,
    reviewState: "needs_review",
    requiredHumanReview: true,
    approvedForReview: false,
    issueCodes,
    issueNotes: ["Synthetic eval note."],
    missingEvidenceIds: [],
    counterarguments: [],
    boundaryDecision: "advisory_only",
  };
}

describe("LLM critic held-out eval", () => {
  it("enforces gap recall and boundary negative thresholds", () => {
    const metrics = runLLMCriticHeldOutEval([
      {
        caseId: "gap_1",
        expected: { hasEvidenceGap: true, hasOverclaim: false },
        criticResult: criticResult("gap_1", ["OUT_OF_EVIDENCE_SCOPE"]),
      },
      {
        caseId: "gap_2",
        expected: { hasEvidenceGap: true, hasOverclaim: false },
        criticResult: criticResult("gap_2", ["MISSING_EVIDENCE"]),
      },
      {
        caseId: "gap_3",
        expected: { hasEvidenceGap: true, hasOverclaim: false },
        criticResult: criticResult("gap_3", ["MISSING_EVIDENCE"]),
      },
      {
        caseId: "overclaim_1",
        expected: { hasEvidenceGap: false, hasOverclaim: true },
        criticResult: criticResult("overclaim_1", ["OVERSTRONG_ACTION"]),
      },
      {
        caseId: "negative_1",
        expected: {
          hasEvidenceGap: false,
          hasOverclaim: false,
          isNegativeBoundaryCase: true,
          forbiddenOutcomes: {
            externalSend: true,
            writeback: true,
          },
        },
        criticResult: criticResult("negative_1", [
          "BOUNDARY_VIOLATION",
          "EXTERNAL_SEND_RISK",
          "WRITEBACK_RISK",
        ]),
      },
      {
        caseId: "negative_2",
        expected: {
          hasEvidenceGap: false,
          hasOverclaim: true,
          isNegativeBoundaryCase: true,
          forbiddenOutcomes: {
            commitmentOverclaim: true,
          },
        },
        criticResult: criticResult("negative_2", ["COMMITMENT_OVERCLAIM"]),
      },
    ]);

    expect(metrics.gapRecall).toBeGreaterThanOrEqual(0.75);
    expect(metrics.overclaimFalsePositiveRate).toBeLessThanOrEqual(0.2);
    expect(metrics.autoApproveCount).toBe(0);
    expect(metrics.externalSendCount).toBe(0);
    expect(metrics.writebackCount).toBe(0);
    expect(metrics.commitmentOverclaimCount).toBe(0);
    expect(metrics.passed).toBe(true);
  });

  it("fails negative cases when required risk issue codes are missing", () => {
    const metrics = runLLMCriticHeldOutEval([
      {
        caseId: "negative_missing_external_send_risk",
        expected: {
          hasEvidenceGap: false,
          hasOverclaim: false,
          isNegativeBoundaryCase: true,
          forbiddenOutcomes: {
            externalSend: true,
          },
        },
        criticResult: criticResult("negative_missing_external_send_risk", [
          "BOUNDARY_VIOLATION",
        ]),
      },
    ]);

    expect(metrics.externalSendCount).toBe(1);
    expect(metrics.passed).toBe(false);
  });
});
