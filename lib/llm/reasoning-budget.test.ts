import { describe, expect, it } from "vitest";

import { resolveReasoningBudgetDecision } from "@/lib/llm/reasoning-budget";
import type { ModelCapabilityProfile } from "@/lib/llm/intelligence-contracts-v3";

const deepProfile: ModelCapabilityProfile = {
  profileKey: "local-frontier-reviewer",
  contextMode: "local_rich_private",
  providerMode: "local",
  reasoningDepth: "deep",
  toolCoordination: "programmatic",
  multiPassAllowed: true,
  remoteEgressPolicy: "blocked",
  budgetClass: "premium",
  allowedWorkflowClasses: ["multi_pass_review", "judgement_proposal"],
};

describe("reasoning budget resolver", () => {
  it("uses economy reasoning for low-value low-uncertainty read-only work", () => {
    const decision = resolveReasoningBudgetDecision({
      profile: deepProfile,
      businessValue: "low",
      uncertainty: "low",
      riskClass: "read",
      evidenceCompleteness: "complete",
    });

    expect(decision.reasoningDepth).toBe("economy");
    expect(decision.budgetClass).toBe("economy");
    expect(decision.multiPassRecommended).toBe(false);
    expect(decision.boundaryDecision).toBe("allow_candidate");
  });

  it("allows deep multi-pass reasoning for high-value uncertain safe work", () => {
    const decision = resolveReasoningBudgetDecision({
      profile: deepProfile,
      businessValue: "high",
      uncertainty: "high",
      riskClass: "read",
      evidenceCompleteness: "partial",
    });

    expect(decision.reasoningDepth).toBe("deep");
    expect(decision.budgetClass).toBe("premium");
    expect(decision.multiPassRecommended).toBe(true);
    expect(decision.boundaryDecision).toBe("allow_candidate");
  });

  it("keeps side-effect risk in human review even when deeper reasoning is useful", () => {
    const decision = resolveReasoningBudgetDecision({
      profile: deepProfile,
      businessValue: "high",
      uncertainty: "high",
      riskClass: "external_write",
      evidenceCompleteness: "partial",
    });

    expect(decision.reasoningDepth).toBe("deep");
    expect(decision.multiPassRecommended).toBe(true);
    expect(decision.boundaryDecision).toBe("review_required");
  });

  it("fails unknown or disabled profiles closed", () => {
    const decision = resolveReasoningBudgetDecision({
      profile: {
        profileKey: "unknown:model",
        contextMode: "disabled_deterministic",
        providerMode: "disabled",
        reasoningDepth: "deterministic",
        toolCoordination: "none",
        multiPassAllowed: false,
        remoteEgressPolicy: "blocked",
        budgetClass: "blocked",
        allowedWorkflowClasses: [],
      },
      businessValue: "high",
      uncertainty: "high",
      riskClass: "read",
      evidenceCompleteness: "missing",
    });

    expect(decision.reasoningDepth).toBe("deterministic");
    expect(decision.budgetClass).toBe("blocked");
    expect(decision.multiPassRecommended).toBe(false);
    expect(decision.boundaryDecision).toBe("review_required");
    expect(decision.reason).toBe("profile_disabled");
  });
});
