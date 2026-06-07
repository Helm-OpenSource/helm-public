import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LLMTaskExecutionResult, LLMTaskInput } from "@/lib/llm/types";
import type { CounterfactualReviewerOutput } from "@/lib/llm/intelligence-contracts-v2";
import {
  COUNTERFACTUAL_MAX_LATENCY_CEILING_MS,
  reviewCounterfactualWithLLM,
} from "@/lib/llm-workflows/review-counterfactual.workflow";

vi.mock("@/lib/llm/provider-registry", () => ({
  executeLLMTask: vi.fn(),
}));

const { executeLLMTask } = await import("@/lib/llm/provider-registry");

const contextStub = {
  objectRef: { objectType: "recommendation", objectId: "rec_1" },
  selectedEvidenceRefs: ["evidence:fact_1"],
  missingEvidence: [{ gapId: "gap_1", missingSignalNote: "No owner confirmation yet." }],
  policySnapshotHash: "sha256:policy",
  privacyClass: "public_safe_synthetic" as const,
  tokenBudget: { maxInputTokens: 1500, maxOutputTokens: 600 },
};

const baseInput = {
  workspaceId: "workspace_public_safe",
  contextStub,
  judgementSummary: "Pipeline health improving for ACME.",
  capabilityRequested: { capabilityRef: "boundary_review" },
};

function buildExecutionResult(
  output: CounterfactualReviewerOutput,
): LLMTaskExecutionResult<CounterfactualReviewerOutput> {
  return {
    output,
    provider: "openai",
    model: "synthetic-model",
    modelRole: "REASONING",
    promptKey: "counterfactual-review",
    promptVersion: "counterfactual-review-v1",
    success: false,
    fallbackUsed: true,
    fallbackReason: "synthetic_test",
    latencyMs: 0,
    rawOutput: null,
    budgetTier: "pilot",
  };
}

describe("reviewCounterfactualWithLLM", () => {
  beforeEach(() => {
    vi.mocked(executeLLMTask).mockReset();
  });

  it("fails closed with missing_permission when no capability requested", async () => {
    const result = await reviewCounterfactualWithLLM({
      ...baseInput,
      capabilityRequested: undefined,
    });
    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.reason).toBe("missing_permission");
    expect(vi.mocked(executeLLMTask)).not.toHaveBeenCalled();
  });

  it("fails closed with unsafe_capability_request for side-effect capability", async () => {
    const result = await reviewCounterfactualWithLLM({
      ...baseInput,
      capabilityRequested: { capabilityRef: "connector_activation" },
    });
    expect(result.reason).toBe("unsafe_capability_request");
    expect(vi.mocked(executeLLMTask)).not.toHaveBeenCalled();
  });

  it("fails closed with missing_policy when stub has no policy snapshot hash", async () => {
    const { policySnapshotHash, ...noPolicy } = contextStub;
    void policySnapshotHash;
    const result = await reviewCounterfactualWithLLM({ ...baseInput, contextStub: noPolicy });
    expect(result.reason).toBe("missing_policy");
    expect(vi.mocked(executeLLMTask)).not.toHaveBeenCalled();
  });

  it("fails closed with schema_failure on malformed stub", async () => {
    const result = await reviewCounterfactualWithLLM({
      ...baseInput,
      contextStub: { policySnapshotHash: "sha256:policy", objectRef: { objectType: "x" } },
    });
    expect(result.reason).toBe("schema_failure");
  });

  it("passes the provider-failure fallback through as needs_review", async () => {
    vi.mocked(executeLLMTask).mockImplementation(
      async (options: LLMTaskInput<CounterfactualReviewerOutput>) =>
        buildExecutionResult(options.fallbackOutput),
    );
    const result = await reviewCounterfactualWithLLM(baseInput);
    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.reason).toBe("provider_failure");
  });

  it("fails closed on empty response", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) =>
      buildExecutionResult(options.parseOutput("")),
    );
    const result = await reviewCounterfactualWithLLM(baseInput);
    expect(result.reason).toBe("empty_response");
  });

  it("fails closed on parse failure (non-JSON)", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) =>
      buildExecutionResult(options.parseOutput("not json {")),
    );
    const result = await reviewCounterfactualWithLLM(baseInput);
    expect(result.reason).toBe("parse_failure");
  });

  it("fails closed on schema failure (valid JSON, wrong shape)", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) =>
      buildExecutionResult(options.parseOutput(JSON.stringify({ foo: "bar" }))),
    );
    const result = await reviewCounterfactualWithLLM(baseInput);
    expect(result.reason).toBe("schema_failure");
  });

  it("fails closed (schema_failure) when the provider adds an unsafe extra field", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) =>
      buildExecutionResult(
        options.parseOutput(
          JSON.stringify({
            alternativeHypotheses: ["Could be seasonal."],
            disconfirmingEvidenceNeeded: [],
            downgradeConditions: [],
            commitmentRiskUp: true,
            downReason: null,
            reviewState: "needs_review",
            requiredHumanReview: true,
            reason: null,
            connectorHandle: "danger",
            upgradeToCommitment: true,
          }),
        ),
      ),
    );
    const result = await reviewCounterfactualWithLLM(baseInput);
    expect(result.reason).toBe("schema_failure");
    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    // The unsafe keys must not survive onto the returned object.
    expect(result).not.toHaveProperty("connectorHandle");
    expect(result).not.toHaveProperty("upgradeToCommitment");
  });

  it("coerces a clean candidate output up to needs_review", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) =>
      buildExecutionResult(
        options.parseOutput(
          JSON.stringify({
            alternativeHypotheses: ["Could be seasonal."],
            disconfirmingEvidenceNeeded: ["Prior-year baseline"],
            downgradeConditions: [{ type: "unverified_assumption" }],
            commitmentRiskUp: true,
            downReason: "Single-deal attribution.",
            reviewState: "candidate",
            requiredHumanReview: false,
            reason: null,
          }),
        ),
      ),
    );
    const result = await reviewCounterfactualWithLLM(baseInput);
    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.alternativeHypotheses).toEqual(["Could be seasonal."]);
  });

  it("fails closed with reason=timeout when the provider exceeds the latency budget", async () => {
    vi.mocked(executeLLMTask).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    const result = await reviewCounterfactualWithLLM({ ...baseInput, maxLatencyMs: 20 });
    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.reason).toBe("timeout");
  });

  it("clamps an over-ceiling latency budget", () => {
    expect(COUNTERFACTUAL_MAX_LATENCY_CEILING_MS).toBe(15000);
  });

  it("emits an authoritative timeout boundary receipt noting the call was not cancelled", async () => {
    vi.mocked(executeLLMTask).mockImplementation(() => new Promise(() => {}));
    const receipts: Array<Record<string, unknown>> = [];
    const result = await reviewCounterfactualWithLLM({
      ...baseInput,
      maxLatencyMs: 20,
      recordBoundaryDecision: (receipt) => receipts.push(receipt),
    });
    expect(result.reason).toBe("timeout");
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      reviewState: "needs_review",
      requiredHumanReview: true,
      reason: "timeout",
      timedOut: true,
      providerCallCancelled: false,
    });
  });

  it("emits a boundary receipt on the early unsafe-capability fail-closed path", async () => {
    const receipts: Array<Record<string, unknown>> = [];
    await reviewCounterfactualWithLLM({
      ...baseInput,
      capabilityRequested: { capabilityRef: "connector_activation" },
      recordBoundaryDecision: (receipt) => receipts.push(receipt),
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ reason: "unsafe_capability_request", timedOut: false });
  });
});
