import { describe, expect, it, vi } from "vitest";

import { executeMultiPassReview } from "@/lib/llm-workflows/multi-pass-review.workflow";

describe("LLM v3 disabled deterministic snapshot", () => {
  it("keeps an unknown profile on a stable fail-closed path with zero provider calls", async () => {
    const testOnlyRemoteExecutor = vi.fn();

    const result = await executeMultiPassReview({
      workspaceId: "workspace-synthetic",
      profileKey: "unregistered-model",
      profileRegistry: {},
      contextStub: {
        objectRef: { objectType: "opportunity", objectId: "synthetic-opp" },
        selectedEvidenceRefs: ["evidence-1"],
        missingEvidence: [],
        policySnapshotHash: "policy-hash",
        privacyClass: "public_safe_synthetic",
        tokenBudget: { maxInputTokens: 1200, maxOutputTokens: 400 },
      },
      proposalSummary: "Synthetic proposal.",
      businessValue: "high",
      uncertainty: "high",
      riskClass: "read",
      evidenceCompleteness: "missing",
      testOnlyRemoteExecutor,
      traceId: "trace-disabled",
      now: () => new Date("2026-07-12T00:00:00.000Z"),
    });

    expect(testOnlyRemoteExecutor).not.toHaveBeenCalled();
    expect(result).toEqual({
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "profile_mismatch",
      roleStates: { generator: "missing", critic: "missing", adversary: "missing" },
      profileKey: "unknown:unregistered-model",
      budgetDecision: {
        reasoningDepth: "deterministic",
        budgetClass: "blocked",
        multiPassRecommended: false,
        boundaryDecision: "review_required",
        reason: "profile_disabled",
      },
      roleOutputs: [],
      boundaryReceipt: {
        receiptId: "trace-disabled",
        traceId: "trace-disabled",
        createdAt: "2026-07-12T00:00:00.000Z",
        profileKey: "unknown:unregistered-model",
        providerMode: "disabled",
        promptKey: "multi-pass-review",
        promptVersion: "multi-pass-review-v1",
        budgetDecision: {
          reasoningDepth: "deterministic",
          budgetClass: "blocked",
          multiPassRecommended: false,
          boundaryDecision: "review_required",
          reason: "profile_disabled",
        },
        egress: {
          redacted: false,
          consentGranted: false,
          promptPreviewAccepted: false,
          auditRef: null,
          blockedReason: null,
        },
        roleCalls: [],
        boundaryDecision: "review_required",
        requiredHumanReview: true,
        reason: "profile_mismatch",
        rawPromptIncluded: false,
        rawCustomerDataIncluded: false,
        tenantUrlIncluded: false,
        productionReceiptIncluded: false,
      },
    });
  });
});
