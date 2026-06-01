import { describe, expect, it } from "vitest";

import fixturePack from "@/evals/internal-ai-service-providers/ai-service-provider-pack-cases.json";
import {
  runInternalAIServiceProviderPackEval,
  type InternalAIServiceProviderFixturePack,
} from "@/lib/evals/internal-ai-service-provider-pack-evals";

const pack = fixturePack as InternalAIServiceProviderFixturePack;

describe("internal AI service provider pack offline eval", () => {
  it("passes the checked-in Daily Top 3 fixture gate", () => {
    const summary = runInternalAIServiceProviderPackEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCandidates).toBe(8);
    expect(summary.dailyTop3Count).toBe(3);
    expect(summary.notSelectedRationaleCount).toBe(5);
    expect(summary.positiveFixtureCount).toBeGreaterThanOrEqual(3);
    expect(summary.negativeOrDowngradedFixtureCount).toBeGreaterThanOrEqual(4);
    expect(summary.outcomeLedgerCount).toBe(5);
    expect(summary.selectedSafeSampleCount).toBe(3);
    expect(summary.reviewFirstAcceptedSelectedCount).toBe(3);
    expect(summary.boundaryAskSelectedCount).toBe(0);
    expect(summary.externalSideEffectAllowedCount).toBe(0);
    expect(summary.officialCommitmentAllowedCount).toBe(0);
    expect(summary.connectorRuntimeApiUiSchemaCapabilityCount).toBe(0);
    expect(summary.rawPiiFieldCount).toBe(0);
    expect(summary.customerIdentifiableTextFieldCount).toBe(0);
    expect(summary.failures).toEqual([]);
  });

  it("keeps the top 3 deterministic and review-first", () => {
    const summary = runInternalAIServiceProviderPackEval();
    const selected = summary.candidateResults.filter((item) => item.decisionBranch === "selected_top3");

    expect(selected.map((item) => item.fixtureId)).toEqual(["ai_eco_001", "ai_eco_002", "ai_eco_003"]);
    expect(selected.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(pack.pack.rankingModel).toMatchObject({
      finalRanker: "deterministic_weighted_score",
      llmFinalRankingAllowed: false,
    });
  });

  it("rejects weakened action templates", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      pack: {
        ...pack.pack,
        actionTemplates: pack.pack.actionTemplates.filter((item) => item !== "downgrade_or_pause"),
      },
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "manifest_contract",
          reason: expect.stringContaining("downgrade_or_pause"),
        }),
      ]),
    );
  });

  it("rejects outbound-looking action templates even when they are review-required concepts", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      pack: {
        ...pack.pack,
        actionTemplates: [...pack.pack.actionTemplates, "request_redacted_data"],
      },
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "manifest_contract",
          reason: expect.stringContaining("request_redacted_data"),
        }),
      ]),
    );
  });

  it("keeps L1 channel intent out of channel candidate display", () => {
    const l1Candidate = pack.candidates.find((item) => item.fixtureId === "ai_eco_002");

    expect(l1Candidate).toMatchObject({
      expectedChannelLevel: "L1",
      expectedChannelCandidateVisible: false,
    });
  });

  it("rejects channel candidate display below L2", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_002"
          ? {
              ...candidate,
              expectedChannelCandidateVisible: true,
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "channel_gate",
          fixtureId: "ai_eco_002",
        }),
      ]),
    );
  });

  it("rejects missing not-selected rationales", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      dailyReadoutExpectation: {
        ...pack.dailyReadoutExpectation,
        notSelectedRationales: [],
      },
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "not_selected_rationale_count",
        }),
      ]),
    );
  });

  it("requires why-not rationale for every non-selected candidate", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      dailyReadoutExpectation: {
        ...pack.dailyReadoutExpectation,
        notSelectedRationales: pack.dailyReadoutExpectation.notSelectedRationales.filter(
          (item) => item.fixtureId !== "ai_eco_006",
        ),
      },
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "not_selected_rationale",
          fixtureId: "ai_eco_006",
        }),
      ]),
    );
  });

  it("rejects drift in fixed fixture contract targets even if JSON targets drift too", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      targets: {
        ...pack.targets,
        candidateFixtureCount: 9,
        dailyTop3Count: 4,
        expectedOutcomeLedgerCount: 6,
      },
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "fixed_contract_targets",
          reason: expect.stringContaining("candidateFixtureCount"),
        }),
        expect.objectContaining({
          checkName: "fixed_contract_targets",
          reason: expect.stringContaining("dailyTop3Count"),
        }),
        expect.objectContaining({
          checkName: "fixed_contract_targets",
          reason: expect.stringContaining("expectedOutcomeLedgerCount"),
        }),
      ]),
    );
  });

  it("requires selected Top 3 candidates to have safe sample and review-first acceptance", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_001"
          ? {
              ...candidate,
              safeSampleAvailable: false,
              safeSampleRecordCount: 0,
              acceptedReviewFirst: false,
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "safe_sample",
          fixtureId: "ai_eco_001",
        }),
        expect.objectContaining({
          checkName: "review_first",
          fixtureId: "ai_eco_001",
        }),
      ]),
    );
  });

  it("rejects selected Top 3 candidates with direct boundary asks", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_001"
          ? {
              ...candidate,
              askedForCrmWrite: true,
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "decision_branch",
          fixtureId: "ai_eco_001",
        }),
        expect.objectContaining({
          checkName: "daily_top3_selection",
        }),
      ]),
    );
  });

  it("rejects high-score candidates that do not accept review-first handling", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_002"
          ? {
              ...candidate,
              acceptedReviewFirst: false,
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "decision_branch",
          fixtureId: "ai_eco_002",
        }),
        expect.objectContaining({
          checkName: "daily_top3_selection",
        }),
      ]),
    );
  });

  it("keeps direct CRM write asks out even without risk tags", () => {
    const summary = runInternalAIServiceProviderPackEval();
    const crmWriteRequester = summary.candidateResults.find((item) => item.fixtureId === "ai_eco_007");

    expect(crmWriteRequester).toMatchObject({
      decisionBranch: "no_go",
      riskPenalty: 0,
    });
  });

  it("keeps no-go provider types out even when risk tags are missing", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_001"
          ? {
              ...candidate,
              providerType: "platform_builder_requester",
              boundaryRiskTags: [],
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);
    const result = summary.candidateResults.find((item) => item.fixtureId === "ai_eco_001");

    expect(result).toMatchObject({
      decisionBranch: "no_go",
      riskPenalty: 0,
    });
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "decision_branch",
          fixtureId: "ai_eco_001",
        }),
      ]),
    );
  });

  it("scans not-selected rationale and outcome ledger text for raw PII", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      dailyReadoutExpectation: {
        ...pack.dailyReadoutExpectation,
        notSelectedRationales: pack.dailyReadoutExpectation.notSelectedRationales.map((rationale) =>
          rationale.fixtureId === "ai_eco_004"
            ? {
                ...rationale,
                summary: "Rejected after raw customer email buyer@example.com appeared in readout text.",
              }
            : rationale,
        ),
      },
      outcomeLedger: pack.outcomeLedger.map((row) =>
        row.fixtureId === "ai_eco_001"
          ? {
              ...row,
              expectedResult: "Call +1 415 555 0199 after review packet is ready.",
            }
          : row,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.rawPiiFieldCount).toBeGreaterThanOrEqual(2);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "no_raw_pii_fields",
        }),
      ]),
    );
  });

  it("requires a 72h outcome ledger row for every selected Top 3 candidate", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      outcomeLedger: pack.outcomeLedger.filter((item) => item.fixtureId !== "ai_eco_003"),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "outcome_ledger",
          fixtureId: "ai_eco_003",
        }),
      ]),
    );
  });

  it("requires downgrade or rejection ledger rows to carry downgradeReason", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      outcomeLedger: pack.outcomeLedger.map((row) =>
        row.fixtureId === "ai_eco_005"
          ? {
              ...row,
              downgradeReason: "",
            }
          : row,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "outcome_ledger",
          fixtureId: "ai_eco_005",
        }),
      ]),
    );
  });

  it("requires positive ledger rows to keep downgradeReason empty", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      outcomeLedger: pack.outcomeLedger.map((row) =>
        row.fixtureId === "ai_eco_001"
          ? {
              ...row,
              downgradeReason: "should_not_be_here",
            }
          : row,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "outcome_ledger",
          fixtureId: "ai_eco_001",
        }),
      ]),
    );
  });

  it("rejects any external side-effect or official commitment authority", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_002"
          ? {
              ...candidate,
              externalSideEffectAllowed: true,
              officialCommitmentAllowed: true,
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "authority",
          fixtureId: "ai_eco_002",
        }),
        expect.objectContaining({
          checkName: "no_external_side_effect_authority",
        }),
        expect.objectContaining({
          checkName: "no_official_commitment_authority",
        }),
      ]),
    );
  });

  it("keeps content-only and platform-builder candidates out of Top 3", () => {
    const summary = runInternalAIServiceProviderPackEval();
    const resultById = new Map(summary.candidateResults.map((item) => [item.fixtureId, item]));

    expect(resultById.get("ai_eco_004")).toMatchObject({ decisionBranch: "no_go" });
    expect(resultById.get("ai_eco_005")).toMatchObject({ decisionBranch: "no_go" });
  });

  it("rejects customer-identifiable profile keys", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_001"
          ? {
              ...candidate,
              profile: {
                ...candidate.profile,
                customerName: "customer_alpha",
              },
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "no_customer_identifiable_text_fields",
        }),
      ]),
    );
  });

  it("rejects raw email-like evidence refs", () => {
    const brokenPack: InternalAIServiceProviderFixturePack = {
      ...pack,
      candidates: pack.candidates.map((candidate) =>
        candidate.fixtureId === "ai_eco_001"
          ? {
              ...candidate,
              evidenceRefs: [...candidate.evidenceRefs, "person@example.com"],
            }
          : candidate,
      ),
    };

    const summary = runInternalAIServiceProviderPackEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkName: "no_raw_pii_fields",
        }),
      ]),
    );
  });
});
