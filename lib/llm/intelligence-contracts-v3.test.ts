import { describe, expect, it } from "vitest";

import {
  DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE,
  parseJudgementProposalBundle,
  parseSourceToSignalProposalBundle,
  projectRichLocalContextBundle,
  resolveModelCapabilityProfile,
  richLocalContextBundleSchema,
} from "@/lib/llm/intelligence-contracts-v3";

describe("LLM intelligence v3 contracts", () => {
  it("fails unknown model profiles closed to deterministic disabled posture", () => {
    const profile = resolveModelCapabilityProfile("frontier-model-that-is-not-registered", {});

    expect(profile).toEqual({
      ...DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE,
      profileKey: "unknown:frontier-model-that-is-not-registered",
    });
  });

  it("allows only explicit registered profiles to use rich local context", () => {
    const profile = resolveModelCapabilityProfile("local-frontier-reviewer", {
      "local-frontier-reviewer": {
        profileKey: "local-frontier-reviewer",
        contextMode: "local_rich_private",
        providerMode: "local",
        reasoningDepth: "deep",
        toolCoordination: "programmatic",
        multiPassAllowed: true,
        remoteEgressPolicy: "blocked",
        budgetClass: "premium",
        allowedWorkflowClasses: ["judgement_proposal", "trajectory_review"],
      },
    });

    expect(profile.contextMode).toBe("local_rich_private");
    expect(profile.multiPassAllowed).toBe(true);
  });

  it("fails profiles closed when the registry key and declared profile key disagree", () => {
    const profile = resolveModelCapabilityProfile("local-frontier-reviewer", {
      "local-frontier-reviewer": {
        profileKey: "different-profile",
        contextMode: "local_rich_private",
        providerMode: "local",
        reasoningDepth: "deep",
        toolCoordination: "programmatic",
        multiPassAllowed: true,
        remoteEgressPolicy: "blocked",
        budgetClass: "premium",
        allowedWorkflowClasses: ["multi_pass_review"],
      },
    });

    expect(profile).toEqual({
      ...DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE,
      profileKey: "unknown:local-frontier-reviewer",
    });
  });

  it("rejects contradictory local-rich and remote provider profiles", () => {
    const profile = resolveModelCapabilityProfile("contradictory-profile", {
      "contradictory-profile": {
        profileKey: "contradictory-profile",
        contextMode: "local_rich_private",
        providerMode: "remote",
        reasoningDepth: "deep",
        toolCoordination: "programmatic",
        multiPassAllowed: true,
        remoteEgressPolicy: "projection_requires_consent",
        budgetClass: "premium",
        allowedWorkflowClasses: ["multi_pass_review"],
      },
    });

    expect(profile).toEqual({
      ...DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE,
      profileKey: "unknown:contradictory-profile",
    });
  });

  it("projects a rich local bundle into a remote-safe selected context stub", () => {
    const receipt = projectRichLocalContextBundle({
      bundle: {
        bundleId: "bundle-1",
        createdAt: "2026-07-12T00:00:00.000Z",
        origin: "local_private",
        policySnapshotHash: "policy-hash",
        objectRef: { objectType: "opportunity", objectId: "opp-1" },
        localContextRefs: [
          {
            refId: "evidence-1",
            kind: "timeline",
            sourceHash: "hash-1",
            derivedSummary: "Customer replied but procurement evidence is missing.",
            privacyClass: "redacted_review",
          },
        ],
        missingEvidence: [
          {
            gapId: "gap-1",
            missingSignalNote: "Need signed procurement signal.",
          },
        ],
        redactionStatus: "redacted",
        rawContentIncluded: false,
      },
      selectedEvidenceRefs: ["evidence-1"],
      tokenBudget: { maxInputTokens: 1200, maxOutputTokens: 400 },
      receiptId: "projection-1",
    });

    expect(receipt.remoteSafe).toBe(true);
    expect(receipt.selectedContextStub.selectedEvidenceRefs).toEqual(["evidence-1"]);
    expect(receipt.selectedContextStub.privacyClass).toBe("redacted_review");
    expect(receipt.sourceBundleId).toBe("bundle-1");
  });

  it("rejects raw prompt-shaped fields in rich local bundle payloads", () => {
    expect(() =>
      richLocalContextBundleSchema.parse({
        bundleId: "bundle-1",
        createdAt: "2026-07-12T00:00:00.000Z",
        origin: "local_private",
        policySnapshotHash: "policy-hash",
        objectRef: { objectType: "company", objectId: "company-1" },
        localContextRefs: [],
        missingEvidence: [],
        redactionStatus: "redacted",
        rawContentIncluded: false,
        rawPrompt: "do not persist this",
      }),
    ).toThrow();
  });

  it("keeps judgement proposal states candidate-only and strict", () => {
    expect(() =>
      parseJudgementProposalBundle({
        proposalId: "proposal-1",
        objectRef: { objectType: "company", objectId: "company-1" },
        reviewState: "approved",
        confidence: 93,
        evidenceRefs: ["e-1"],
        missingEvidence: [],
        counterEvidenceNeeded: [],
        nextSafeActions: [],
        forbiddenCapabilityRefs: [],
      }),
    ).toThrow();

    expect(() =>
      parseJudgementProposalBundle({
        proposalId: "proposal-2",
        objectRef: { objectType: "company", objectId: "company-1" },
        reviewState: "candidate",
        confidence: 81,
        evidenceRefs: ["e-1"],
        missingEvidence: [],
        counterEvidenceNeeded: [],
        nextSafeActions: [],
        forbiddenCapabilityRefs: [],
        memoryPromotion: true,
      }),
    ).toThrow();
  });

  it("keeps source-to-signal proposals review-first", () => {
    const parsed = parseSourceToSignalProposalBundle({
      proposalId: "source-proposal-1",
      sourceSummaryRefs: ["schema-summary-1"],
      targetSignalFamily: "advancement",
      targetEntity: "Opportunity",
      reviewState: "needs_review",
      confidence: 72,
      evidenceRefs: ["field-ref-1"],
      mappingRationale: ["Deal amount and stage fields suggest opportunity progression."],
      missingEvidence: [],
      forbiddenCapabilityRefs: ["connector_activation"],
    });

    expect(parsed.reviewState).toBe("needs_review");
    expect(parsed.forbiddenCapabilityRefs).toEqual(["connector_activation"]);
  });
});
