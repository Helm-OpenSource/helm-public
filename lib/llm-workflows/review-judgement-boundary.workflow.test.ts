import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LLMTaskExecutionResult, LLMTaskInput } from "@/lib/llm/types";
import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
import { reviewJudgementBoundaryWithLLM } from "@/lib/llm-workflows/review-judgement-boundary.workflow";

vi.mock("@/lib/llm/provider-registry", () => ({
  executeLLMTask: vi.fn(),
}));

const { executeLLMTask } = await import("@/lib/llm/provider-registry");

const contextPacket = {
  packetId: "packet_synthetic_critic_1",
  workspaceId: "workspace_public_safe",
  objectRef: {
    objectType: "recommendation",
    objectId: "rec_1",
  },
  timeline: [],
  evidenceRefs: [],
  signals: [],
  commitments: [],
  blockers: [],
  policySnapshot: {},
  permissions: {
    allowedUses: ["human_review"],
    forbiddenUses: ["external_send", "writeback"],
    requiredHumanReview: true,
  },
  privacyClass: "public_safe_synthetic",
  tokenBudget: {
    maxInputTokens: 1000,
  },
  missingEvidence: [],
  boundaryNotes: ["Synthetic boundary note."],
} as const;

const privateContextPacket = {
  ...contextPacket,
  packetId: "packet_private_critic_1",
  privacyClass: "private_runtime",
  evidenceRefs: [
    {
      refId: "evidence_private_1",
      sourceType: "synthetic_fixture",
      label: "owner@private.example",
      summary: "Synthetic private evidence.",
    },
  ],
} as const;

const candidate = {
  candidateId: "candidate_synthetic_critic_1",
  packetId: "packet_synthetic_critic_1",
  workspaceId: "workspace_public_safe",
  targetObjectRef: {
    objectType: "recommendation",
    objectId: "rec_1",
  },
  judgementType: "recommendation_critic",
  reviewState: "candidate",
  confidence: 72,
  summary: "Synthetic critic candidate.",
  rationale: ["Synthetic rationale."],
  evidenceRefIds: [],
  missingEvidenceIds: [],
  boundaryNotes: ["Synthetic candidate boundary note."],
} as const;

const privateCandidate = {
  ...candidate,
  summary: "Review private owner owner@private.example before next step.",
  rationale: ["Synthetic rationale from owner@private.example."],
} as const;

describe("reviewJudgementBoundaryWithLLM", () => {
  beforeEach(() => {
    vi.mocked(executeLLMTask).mockReset();
  });

  it("uses the registered prompt and task type", async () => {
    vi.mocked(executeLLMTask).mockImplementation(
      async (options: LLMTaskInput<LLMCriticResult>) =>
        buildExecutionResult(options.fallbackOutput),
    );

    await reviewJudgementBoundaryWithLLM({
      workspaceId: "workspace_public_safe",
      contextPacket,
      candidate,
    });

    expect(vi.mocked(executeLLMTask).mock.calls[0]?.[0].taskType).toBe(
      "JUDGEMENT_BOUNDARY_REVIEW",
    );
    expect(vi.mocked(executeLLMTask).mock.calls[0]?.[0].promptKey).toBe(
      "judgement-boundary-review",
    );
  });

  it("fails closed when provider returns fallback", async () => {
    vi.mocked(executeLLMTask).mockImplementation(
      async (options: LLMTaskInput<LLMCriticResult>) =>
        buildExecutionResult(options.fallbackOutput),
    );

    const result = await reviewJudgementBoundaryWithLLM({
      workspaceId: "workspace_public_safe",
      contextPacket,
      candidate,
    });

    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.approvedForReview).toBe(false);
    expect(result.boundaryDecision).toBe("fail_closed");
  });

  it("blocks private packet egress without consent and preview", async () => {
    const result = await reviewJudgementBoundaryWithLLM({
      workspaceId: "workspace_public_safe",
      contextPacket: privateContextPacket,
      candidate,
    });

    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.approvedForReview).toBe(false);
    expect(result.fallbackReason).toBe(
      "remote_llm_packet_requires_consent_and_prompt_preview",
    );
    expect(vi.mocked(executeLLMTask)).not.toHaveBeenCalled();
  });

  it("redacts private packet before provider dispatch when remote consent is present", async () => {
    vi.mocked(executeLLMTask).mockImplementation(
      async (options: LLMTaskInput<LLMCriticResult>) =>
        buildExecutionResult(options.fallbackOutput),
    );

    await reviewJudgementBoundaryWithLLM({
      workspaceId: "workspace_public_safe",
      contextPacket: privateContextPacket,
      candidate: privateCandidate,
      egressPolicy: {
        providerMode: "remote",
        consentGranted: true,
        promptPreviewAccepted: true,
        auditRef: "audit_synthetic_1",
      },
    });

    const userPrompt = vi.mocked(executeLLMTask).mock.calls[0]?.[0].userPrompt ?? "";
    expect(userPrompt).toContain("[redacted-email]");
    expect(userPrompt).not.toContain("owner@private.example");
  });

  it("coerces candidate review output back to human review", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) => {
      const output = options.parseOutput(
        JSON.stringify({
          resultId: "critic_result_1",
          candidateId: "candidate_synthetic_critic_1",
          packetId: "packet_synthetic_critic_1",
          reviewState: "candidate",
          requiredHumanReview: false,
          approvedForReview: true,
          issueCodes: [],
          issueNotes: [],
          missingEvidenceIds: [],
          counterarguments: [],
          boundaryDecision: "advisory_only",
        }),
      );
      return buildExecutionResult(output);
    });

    const result = await reviewJudgementBoundaryWithLLM({
      workspaceId: "workspace_public_safe",
      contextPacket,
      candidate,
    });

    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.approvedForReview).toBe(false);
  });

  it("forces rejected-by-guard output to remain unclean for human review", async () => {
    vi.mocked(executeLLMTask).mockImplementation(async (options) => {
      const output = options.parseOutput(
        JSON.stringify({
          resultId: "critic_result_2",
          candidateId: "candidate_synthetic_critic_1",
          packetId: "packet_synthetic_critic_1",
          reviewState: "rejected_by_guard",
          requiredHumanReview: false,
          approvedForReview: true,
          issueCodes: ["BOUNDARY_VIOLATION"],
          issueNotes: [],
          missingEvidenceIds: [],
          counterarguments: [],
          boundaryDecision: "guard_rejected",
        }),
      );
      return buildExecutionResult(output);
    });

    const result = await reviewJudgementBoundaryWithLLM({
      workspaceId: "workspace_public_safe",
      contextPacket,
      candidate,
    });

    expect(result.reviewState).toBe("rejected_by_guard");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.approvedForReview).toBe(false);
  });
});

function buildExecutionResult(
  output: LLMCriticResult,
): LLMTaskExecutionResult<LLMCriticResult> {
  return {
    output,
    provider: "openai",
    model: "synthetic-model",
    modelRole: "REASONING",
    promptKey: "judgement-boundary-review",
    promptVersion: "judgement-boundary-review-v1",
    success: false,
    fallbackUsed: true,
    fallbackReason: "synthetic_test",
    latencyMs: 0,
    rawOutput: null,
    budgetTier: "pilot",
  };
}
