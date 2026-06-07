import { describe, expect, it } from "vitest";

import {
  buildFailClosedLLMCriticResult,
  parseJudgementCandidate,
  parseLLMContextPacket,
  prepareLLMContextPacketForRemoteProvider,
} from "@/lib/llm/intelligence-contracts";

const basePacket = {
  packetId: "packet_synthetic_1",
  workspaceId: "workspace_public_safe",
  objectRef: {
    objectType: "recommendation",
    objectId: "rec_1",
    label: "Synthetic opportunity",
  },
  timeline: [
    {
      occurredAt: "2026-06-01T00:00:00.000Z",
      eventType: "meeting",
      summary: "Synthetic meeting summary.",
      evidenceRefIds: ["evidence_1"],
    },
  ],
  evidenceRefs: [
    {
      refId: "evidence_1",
      sourceType: "synthetic_fixture",
      label: "owner@example.com",
      summary: "Synthetic evidence only.",
    },
  ],
  signals: [],
  commitments: [],
  blockers: [],
  policySnapshot: {
    recommendationOnly: true,
  },
  permissions: {
    allowedUses: ["candidate_generation", "human_review"],
    forbiddenUses: ["external_send", "writeback"],
    requiredHumanReview: true,
  },
  privacyClass: "redacted_review",
  tokenBudget: {
    maxInputTokens: 1200,
    maxOutputTokens: 500,
  },
  missingEvidence: [],
  boundaryNotes: ["Recommendation is not a commitment."],
};

describe("LLM intelligence contracts", () => {
  it("parses a context packet with permissions and token budget", () => {
    const packet = parseLLMContextPacket(basePacket);

    expect(packet.permissions.requiredHumanReview).toBe(true);
    expect(packet.tokenBudget.maxInputTokens).toBe(1200);
  });

  it("rejects unsafe judgement candidate review states", () => {
    expect(() =>
      parseJudgementCandidate({
        candidateId: "candidate_1",
        packetId: "packet_synthetic_1",
        workspaceId: "workspace_public_safe",
        targetObjectRef: {
          objectType: "recommendation",
          objectId: "rec_1",
        },
        judgementType: "recommendation_critic",
        reviewState: "approved",
        confidence: 80,
        summary: "Unsafe state should be rejected.",
      }),
    ).toThrow();
  });

  it("redacts packet strings before remote provider use", () => {
    const packet = parseLLMContextPacket(basePacket);
    const result = prepareLLMContextPacketForRemoteProvider(packet, {
      providerMode: "remote",
      consentGranted: true,
      promptPreviewAccepted: true,
      auditRef: "audit_synthetic_1",
    });

    expect(result.ok).toBe(true);
    expect(result.audit.redacted).toBe(true);
    expect(result.safePacket?.privacyClass).toBe("redacted_review");
    expect(result.safePacket?.evidenceRefs[0]?.label).toBe("[redacted-email]");
  });

  it("blocks remote provider packets without consent and preview", () => {
    const packet = parseLLMContextPacket(basePacket);
    const result = prepareLLMContextPacketForRemoteProvider(packet, {
      providerMode: "remote",
    });

    expect(result.ok).toBe(false);
    expect(result.safePacket).toBeNull();
    expect(result.audit.blockedReason).toBe(
      "remote_llm_packet_requires_consent_and_prompt_preview",
    );
  });

  it("builds fail-closed critic fallback", () => {
    const result = buildFailClosedLLMCriticResult({
      resultId: "critic_1",
      candidateId: "candidate_1",
      packetId: "packet_synthetic_1",
      fallbackReason: "provider_failure",
    });

    expect(result.reviewState).toBe("needs_review");
    expect(result.requiredHumanReview).toBe(true);
    expect(result.approvedForReview).toBe(false);
    expect(result.issueCodes).toContain("BOUNDARY_VIOLATION");
  });
});
