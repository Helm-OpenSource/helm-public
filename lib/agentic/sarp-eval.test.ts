import { describe, expect, it } from "vitest";
import { agentRunCapsuleSchema, type AgentRunCapsule } from "./run-capsule";
import { attachSarpReviewReceipt, runSarpReview } from "./sarp-eval";
import type { SarpCheckId } from "./sarp-contracts";

const REVIEWED_AT = new Date("2026-06-08T00:00:00.000Z");

function capsule(overrides: Partial<AgentRunCapsule> = {}): AgentRunCapsule {
  return agentRunCapsuleSchema.parse({
    runId: "sarp-run-1",
    createdAt: "2026-06-08T00:00:00.000Z",
    actor: "agent",
    mode: "implement",
    worktreeProfile: "repo_write_reviewed",
    repo: { alias: "helm-public", branchRef: "codex/sarp", dirtyState: "clean" },
    intent: "implement scoped public-safe change",
    scope: ["lib/agentic/"],
    inputRefs: [],
    redactionStatus: "redacted",
    commandResults: [],
    fileChangeSummary: [],
    outputArtifacts: [],
    boundaryDecisions: [
      {
        subject: "counterfactual-review",
        decision: "review_required",
        reason: "Counterfactual check completed before handoff.",
      },
    ],
    blockedActions: [],
    validationReceipts: [{ name: "targeted-test", ok: true, summary: "ok" }],
    humanReceipts: [],
    nextSafeActions: ["Human review required; no automated action was taken."],
    quarantined: false,
    ...overrides,
  });
}

function review(capsuleInput: AgentRunCapsule) {
  return runSarpReview(capsuleInput, { now: () => REVIEWED_AT });
}

function check(receipt: ReturnType<typeof review>, checkId: SarpCheckId) {
  const result = receipt.checks.find((item) => item.checkId === checkId);
  expect(result).toBeDefined();
  return result!;
}

describe("runSarpReview", () => {
  it("blocks self-certifying green-check overclaim", () => {
    const receipt = review(capsule({ nextSafeActions: ["this branch is release-ready"] }));
    expect(receipt.verdict).toBe("block");
    expect(receipt.humanReviewRequired).toBe(true);
    expect(check(receipt, "self_cert_check")).toMatchObject({
      passed: false,
      finding: "green_check_overclaim",
    });
  });

  it("blocks candidate auto-promotion claims", () => {
    const receipt = review(capsule({ intent: "promoted to official memory" }));
    expect(receipt.verdict).toBe("block");
    expect(check(receipt, "self_cert_check")).toMatchObject({
      passed: false,
      finding: "candidate_autopromotion",
    });
  });

  it("marks implement-mode missing counterfactual check as advisory", () => {
    const receipt = review(capsule({ boundaryDecisions: [] }));
    expect(receipt.verdict).toBe("advisory");
    expect(receipt.humanReviewRequired).toBe(false);
    expect(check(receipt, "counterfactual_presence")).toMatchObject({
      passed: false,
      finding: "counterfactual_missing",
    });
  });

  it("escalates handoff-mode missing counterfactual check", () => {
    const receipt = review(capsule({ mode: "handoff", boundaryDecisions: [] }));
    expect(receipt.verdict).toBe("escalate");
    expect(receipt.humanReviewRequired).toBe(true);
    expect(check(receipt, "counterfactual_presence")).toMatchObject({
      passed: false,
      finding: "counterfactual_missing",
    });
  });

  it("blocks quarantined capsules through scope sealing", () => {
    const receipt = review(capsule({ mode: "explore", boundaryDecisions: [], quarantined: true }));
    expect(receipt.verdict).toBe("block");
    expect(check(receipt, "scope_seal_check")).toMatchObject({
      passed: false,
      finding: "scope_not_sealed",
    });
  });

  it("marks implement-mode missing validation receipt as advisory", () => {
    const receipt = review(capsule({ validationReceipts: [] }));
    expect(receipt.verdict).toBe("advisory");
    expect(check(receipt, "validation_chain_check")).toMatchObject({
      passed: false,
      finding: "validation_chain_missing",
    });
  });

  it("blocks permission boundary leaks", () => {
    const receipt = review(capsule({ intent: "will auto-approve the recommendation" }));
    expect(receipt.verdict).toBe("block");
    expect(check(receipt, "permission_boundary_check")).toMatchObject({
      passed: false,
      finding: "boundary_authority_leak",
    });
  });

  it("passes a clean capsule with counterfactual and validation receipts", () => {
    const receipt = review(capsule());
    expect(receipt).toMatchObject({
      sarpVersion: "0.1",
      capsuleRunId: "sarp-run-1",
      reviewedAt: "2026-06-08T00:00:00.000Z",
      verdict: "pass",
      humanReviewRequired: false,
    });
    expect(receipt.checks).toHaveLength(5);
    expect(receipt.checks.every((item) => item.passed)).toBe(true);
  });

  it("does not punish correctly recorded blocked actions", () => {
    const receipt = review(
      capsule({
        blockedActions: ["auto_send: not performed", "activate_connector: not performed"],
      }),
    );
    expect(receipt.verdict).toBe("pass");
    expect(check(receipt, "permission_boundary_check")).toMatchObject({ passed: true });
  });

  it("can attach a matching SARP receipt to an existing capsule", () => {
    const reviewed = attachSarpReviewReceipt(capsule(), { now: () => REVIEWED_AT });
    expect(reviewed.sarpReceipt).toMatchObject({
      sarpVersion: "0.1",
      capsuleRunId: "sarp-run-1",
      verdict: "pass",
    });
    expect(agentRunCapsuleSchema.parse(reviewed)).toEqual(reviewed);
  });
});
