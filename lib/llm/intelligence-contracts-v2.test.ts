import { describe, expect, it } from "vitest";

import {
  COUNTERFACTUAL_REVIEW_STATES,
  buildFailClosedCounterfactualResult,
  counterfactualReviewerOutputSchema,
  llmContextSelectionReceiptSchema,
  parseSelectedContextStub,
  prepareCounterfactualEgress,
  projectSelectedContextStub,
  selectedContextStubSchema,
} from "@/lib/llm/intelligence-contracts-v2";

const stubInput = {
  objectRef: { objectType: "recommendation", objectId: "rec_1" },
  selectedEvidenceRefs: ["evidence:fact_1"],
  missingEvidence: [{ gapId: "gap_1", missingSignalNote: "No owner confirmation yet." }],
  policySnapshotHash: "sha256:policy",
  privacyClass: "redacted_review" as const,
  tokenBudget: { maxInputTokens: 1800, maxOutputTokens: 700 },
};

describe("SelectedContextStub", () => {
  it("keeps only the minimal fields", () => {
    const stub = parseSelectedContextStub(stubInput);
    expect(Object.keys(stub).sort()).toEqual(
      [
        "missingEvidence",
        "objectRef",
        "policySnapshotHash",
        "privacyClass",
        "selectedEvidenceRefs",
        "tokenBudget",
      ].sort(),
    );
  });

  it("rejects unknown privacy class", () => {
    expect(() =>
      selectedContextStubSchema.parse({ ...stubInput, privacyClass: "open" }),
    ).toThrow();
  });
});

describe("LLMContextSelectionReceipt (audit-only)", () => {
  it("is marked audit-only and projects down to the minimal stub", () => {
    const receipt = llmContextSelectionReceiptSchema.parse({
      receiptId: "receipt_1",
      objectRef: { objectType: "recommendation", objectId: "rec_1" },
      selectedEvidenceRefs: ["evidence:fact_1"],
      rejectedEvidenceRefs: ["evidence:fact_2"],
      selectionRationale: ["fact_1 is owner-confirmed; fact_2 is stale"],
      missingEvidence: [{ gapId: "gap_1", missingSignalNote: "No owner confirmation yet." }],
      policySnapshotHash: "sha256:policy",
      sourceReceiptRefs: ["source:1"],
      privacyClass: "private_runtime",
    });
    expect(receipt.auditOnly).toBe(true);

    const stub = projectSelectedContextStub(receipt, { maxInputTokens: 1800, maxOutputTokens: 700 });
    expect(stub.selectedEvidenceRefs).toEqual(["evidence:fact_1"]);
    // The projection must NOT carry rationale or rejected refs into the stub.
    expect(stub).not.toHaveProperty("selectionRationale");
    expect(stub).not.toHaveProperty("rejectedEvidenceRefs");
  });
});

describe("CounterfactualReviewerOutput", () => {
  it("only exposes downgrade / review fields, no commitment-upgrade field", () => {
    const output = counterfactualReviewerOutputSchema.parse({
      alternativeHypotheses: ["The uptick may be seasonal, not pipeline health."],
      disconfirmingEvidenceNeeded: ["Prior-year same-quarter baseline"],
      downgradeConditions: [{ type: "unverified_assumption", note: "growth attributed to one deal" }],
      commitmentRiskUp: true,
      downReason: "Single-deal attribution is not yet evidenced.",
      reviewState: "needs_review",
      requiredHumanReview: true,
      reason: null,
    });
    const keys = Object.keys(output);
    expect(keys).not.toContain("upgradeToCommitment");
    expect(keys).not.toContain("approval");
    expect(keys).not.toContain("connectorHandle");
    expect(keys).not.toContain("memoryWrite");
    expect(COUNTERFACTUAL_REVIEW_STATES).not.toContain("approved");
  });

  it("builds a fail-closed needs_review result that carries the reason", () => {
    const out = buildFailClosedCounterfactualResult("timeout");
    expect(out.reviewState).toBe("needs_review");
    expect(out.requiredHumanReview).toBe(true);
    expect(out.reason).toBe("timeout");
    expect(out.commitmentRiskUp).toBe(true);
  });

  it("rejects (does not strip) an unsafe extra field via strict parsing", () => {
    const withUnsafeField = {
      alternativeHypotheses: [],
      disconfirmingEvidenceNeeded: [],
      downgradeConditions: [],
      commitmentRiskUp: true,
      downReason: null,
      reviewState: "needs_review",
      requiredHumanReview: true,
      reason: null,
      connectorHandle: "danger",
      upgradeToCommitment: true,
    };
    expect(counterfactualReviewerOutputSchema.safeParse(withUnsafeField).success).toBe(false);
  });

  it("rejects an unsafe extra key inside a downgrade condition", () => {
    const withUnsafeNested = {
      alternativeHypotheses: [],
      disconfirmingEvidenceNeeded: [],
      downgradeConditions: [{ type: "evidence_gap", memoryWrite: true }],
      commitmentRiskUp: true,
      downReason: null,
      reviewState: "needs_review",
      requiredHumanReview: true,
      reason: null,
    };
    expect(counterfactualReviewerOutputSchema.safeParse(withUnsafeNested).success).toBe(false);
  });

  it("rejects a stub carrying a leaked extra (e.g. selector receipt) field", () => {
    expect(
      selectedContextStubSchema.safeParse({ ...stubInput, selectionRationale: ["leaked"] }).success,
    ).toBe(false);
  });
});

describe("counterfactual egress gate", () => {
  const judgementSummary = "Email owner@acme.example about the renewal risk.";

  it("blocks a remote private_runtime stub without consent + preview", () => {
    const result = prepareCounterfactualEgress({
      contextStub: { ...stubInput, privacyClass: "private_runtime" },
      judgementSummary,
    });
    expect(result.ok).toBe(false);
    expect(result.safeStub).toBeNull();
    expect(result.audit.blockedReason).toMatch(/consent_and_prompt_preview/);
  });

  it("allows a public_safe_synthetic stub on the local path without consent", () => {
    const result = prepareCounterfactualEgress({
      contextStub: { ...stubInput, privacyClass: "public_safe_synthetic" },
      judgementSummary: "Pipeline summary, no PII.",
    });
    expect(result.ok).toBe(true);
    expect(result.providerMode).toBe("local");
  });

  it("redacts stub + summary when remote consent and preview are present", () => {
    const result = prepareCounterfactualEgress({
      contextStub: { ...stubInput, privacyClass: "private_runtime" },
      judgementSummary,
      policy: { providerMode: "remote", consentGranted: true, promptPreviewAccepted: true },
    });
    expect(result.ok).toBe(true);
    expect(result.safeJudgementSummary).toContain("[redacted-email]");
    expect(result.safeJudgementSummary).not.toContain("owner@acme.example");
    expect(result.audit.redacted).toBe(true);
  });
});
