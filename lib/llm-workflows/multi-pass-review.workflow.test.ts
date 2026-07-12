import { describe, expect, it } from "vitest";

import {
  arbitrateMultiPassReview,
  type MultiPassRoleOutput,
} from "@/lib/llm-workflows/multi-pass-review.workflow";
import type { ModelCapabilityProfile } from "@/lib/llm/intelligence-contracts-v3";

const profile: ModelCapabilityProfile = {
  profileKey: "local-frontier-reviewer",
  contextMode: "local_rich_private",
  providerMode: "local",
  reasoningDepth: "deep",
  toolCoordination: "programmatic",
  multiPassAllowed: true,
  remoteEgressPolicy: "blocked",
  budgetClass: "premium",
  allowedWorkflowClasses: ["multi_pass_review"],
};

function role(
  role: MultiPassRoleOutput["role"],
  reviewState: MultiPassRoleOutput["reviewState"] = "candidate",
): MultiPassRoleOutput {
  return {
    role,
    reviewState,
    evidenceRefs: [`${role}-evidence`],
    notes: [`${role} note`],
  };
}

describe("multi-pass review arbiter", () => {
  it("allows only candidate routing when all roles agree and profile permits multi-pass", () => {
    const result = arbitrateMultiPassReview({
      profile,
      roleOutputs: [role("generator"), role("critic"), role("adversary")],
    });

    expect(result.boundaryDecision).toBe("allow_candidate");
    expect(result.requiredHumanReview).toBe(false);
  });

  it.each(["provider_failure", "parse_failure", "schema_failure"] as const)(
    "fails closed to review_required on %s",
    (reason) => {
      const result = arbitrateMultiPassReview({
        profile,
        roleOutputs: [role("generator")],
        failure: { reason },
      });

      expect(result.boundaryDecision).toBe("review_required");
      expect(result.requiredHumanReview).toBe(true);
      expect(result.reason).toBe(reason);
    },
  );

  it("quarantines egress failure", () => {
    const result = arbitrateMultiPassReview({
      profile,
      roleOutputs: [role("generator")],
      failure: { reason: "egress_failure" },
    });

    expect(result.boundaryDecision).toBe("quarantine");
    expect(result.requiredHumanReview).toBe(true);
  });

  it("requires review on profile mismatch", () => {
    const result = arbitrateMultiPassReview({
      profile: { ...profile, allowedWorkflowClasses: [], multiPassAllowed: false },
      roleOutputs: [role("generator"), role("critic"), role("adversary")],
    });

    expect(result.boundaryDecision).toBe("review_required");
    expect(result.reason).toBe("profile_mismatch");
  });

  it("requires review when roles disagree", () => {
    const result = arbitrateMultiPassReview({
      profile,
      roleOutputs: [role("generator"), role("critic", "needs_review"), role("adversary")],
    });

    expect(result.boundaryDecision).toBe("review_required");
    expect(result.reason).toBe("role_conflict");
  });

  it("rejects guard-rejected role output", () => {
    const result = arbitrateMultiPassReview({
      profile,
      roleOutputs: [role("generator"), role("critic", "rejected_by_guard"), role("adversary")],
    });

    expect(result.boundaryDecision).toBe("reject");
    expect(result.requiredHumanReview).toBe(true);
  });
});
