import { describe, expect, it } from "vitest";

import fixture from "@/lib/evals/fixtures/llm-v3-review.synthetic.json";
import {
  LLM_V3_REVIEW_FORBIDDEN_CAPABILITIES,
  buildV3ReviewReadout,
} from "@/lib/llm/v3-review-readout";

function cloneFixture(): typeof fixture {
  return JSON.parse(JSON.stringify(fixture)) as typeof fixture;
}

describe("buildV3ReviewReadout", () => {
  it("builds all four public synthetic evidence lanes and derives the trajectory verdict", () => {
    const result = buildV3ReviewReadout(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.fixtureKind).toBe("llm_v3_review");
    expect(result.evidenceKinds).toEqual([
      "judgement_proposal",
      "source_to_signal_proposal",
      "task_trajectory",
      "multi_pass_boundary",
    ]);
    expect(result.trajectoryEvaluation).toEqual({
      receiptId: "trajectory-receipt-synthetic-001",
      verdict: "pass",
      failures: [],
    });
    expect(result.sourceToSignalProposal).toMatchObject({
      candidateOrigin: "ai",
      sourceCandidateRef: "candidate-source-synthetic-001",
      modelProfileKey: "synthetic-local-v3",
      redactionProvenance: "public_safe_synthetic",
    });
    expect(result.sourceToSignalProposal.forbiddenCapabilityRefs).toEqual(
      LLM_V3_REVIEW_FORBIDDEN_CAPABILITIES,
    );
  });

  it("makes allow_candidate review-first and never treats it as approval", () => {
    const result = buildV3ReviewReadout(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.multiPassBoundaryReceipt.boundaryDecision).toBe("allow_candidate");
    expect(result.candidateBoundary).toEqual({
      posture: "candidate_for_human_review",
      candidateMayEnterReview: true,
      approvalGranted: false,
      sideEffectsAuthorized: false,
      humanDecisionRequired: true,
    });
  });

  it("fails closed without partial evidence when the top-level fixture has an unknown field", () => {
    const malformed = {
      ...cloneFixture(),
      approvalAuthority: "synthetic-agent",
    };

    const result = buildV3ReviewReadout(malformed);

    expect(result).toMatchObject({
      ok: false,
      errorCode: "LLM_V3_REVIEW_FIXTURE_INVALID",
    });
    expect(result).not.toHaveProperty("judgementProposal");
    if (!result.ok) {
      expect(result.issuePaths).toContain("approvalAuthority");
    }
  });

  it("fails closed when a privacy literal is unsafe", () => {
    const malformed = cloneFixture();
    malformed.trajectoryReceipt.rawCustomerDataIncluded = true;

    const result = buildV3ReviewReadout(malformed);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issuePaths).toContain("trajectoryReceipt.rawCustomerDataIncluded");
    }
  });

  it("fails closed when the source proposal omits a canonical forbidden capability", () => {
    const malformed = cloneFixture();
    malformed.sourceToSignalProposal.forbiddenCapabilityRefs =
      malformed.sourceToSignalProposal.forbiddenCapabilityRefs.filter(
        (capability: string) => capability !== "memory_promotion",
      );

    const result = buildV3ReviewReadout(malformed);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issuePaths).toContain(
        "sourceToSignalProposal.forbiddenCapabilityRefs",
      );
    }
  });

  it("blocks the candidate while preserving deterministic failures for a valid unsafe trajectory", () => {
    const unsafe = cloneFixture();
    unsafe.trajectoryReceipt.finalClaim.claimedApprovalGranted = true;

    const result = buildV3ReviewReadout(unsafe);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.trajectoryEvaluation.verdict).toBe("fail");
    expect(result.trajectoryEvaluation.failures).toContain("boundary_authority_leak");
    expect(result.candidateBoundary).toEqual({
      posture: "blocked_by_guard",
      candidateMayEnterReview: false,
      approvalGranted: false,
      sideEffectsAuthorized: false,
      humanDecisionRequired: true,
    });
  });
});
