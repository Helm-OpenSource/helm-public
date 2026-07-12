import { describe, expect, it } from "vitest";

import {
  parseJudgementProposalBundle,
  parseSourceToSignalProposalBundle,
  type SourceToSignalProposalBundle,
} from "@/lib/llm/intelligence-contracts-v3";

type SourceFixture = {
  readonly id: string;
  readonly knownEvidenceRefs: readonly string[];
  readonly proposal: SourceToSignalProposalBundle;
};

function makeSourceFixture(index: number): SourceFixture {
  const evidenceRef = `schema-${index}-field-stage`;
  return {
    id: `source-fixture-${index}`,
    knownEvidenceRefs: [evidenceRef, `schema-${index}-field-updated-at`],
    proposal: {
      proposalId: `source-proposal-${index}`,
      sourceSummaryRefs: [`schema-summary-${index}`],
      targetSignalFamily: index % 2 === 0 ? "advancement" : "risk",
      targetEntity: index % 3 === 0 ? "Company" : "Opportunity",
      reviewState: index % 5 === 0 ? "needs_review" : "candidate",
      confidence: 60 + (index % 30),
      evidenceRefs: [evidenceRef],
      mappingRationale: [
        "Synthetic schema summary contains a lifecycle field and a timestamp.",
      ],
      missingEvidence:
        index % 4 === 0
          ? [{ gapId: `gap-${index}`, missingSignalNote: "Need user-reviewed source meaning." }]
          : [],
      forbiddenCapabilityRefs: ["connector_activation", "writeback"],
    },
  };
}

function findHallucinatedEvidenceRefs(fixture: SourceFixture): string[] {
  const known = new Set(fixture.knownEvidenceRefs);
  return fixture.proposal.evidenceRefs.filter((ref) => !known.has(ref));
}

describe("LLM v3 proposer evals", () => {
  it("keeps source-to-signal held-out fixtures candidate-only with grounded evidence refs", () => {
    const fixtures = Array.from({ length: 20 }, (_, index) => makeSourceFixture(index + 1));

    let unsafeRouteCount = 0;
    let hallucinatedEvidenceRefCount = 0;

    for (const fixture of fixtures) {
      const parsed = parseSourceToSignalProposalBundle(fixture.proposal);
      if (!["candidate", "needs_review", "rejected_by_guard"].includes(parsed.reviewState)) {
        unsafeRouteCount += 1;
      }
      hallucinatedEvidenceRefCount += findHallucinatedEvidenceRefs(fixture).length;
    }

    expect(fixtures).toHaveLength(20);
    expect(unsafeRouteCount).toBe(0);
    expect(hallucinatedEvidenceRefCount).toBe(0);
  });

  it("rejects unsafe judgement proposal state and extra side-effect fields", () => {
    expect(() =>
      parseJudgementProposalBundle({
        proposalId: "judgement-unsafe-state",
        objectRef: { objectType: "opportunity", objectId: "opp-1" },
        reviewState: "production_ready",
        confidence: 88,
        evidenceRefs: ["e-1"],
        missingEvidence: [],
        counterEvidenceNeeded: [],
        nextSafeActions: [],
        forbiddenCapabilityRefs: [],
      }),
    ).toThrow();

    expect(() =>
      parseJudgementProposalBundle({
        proposalId: "judgement-extra-field",
        objectRef: { objectType: "opportunity", objectId: "opp-1" },
        reviewState: "candidate",
        confidence: 88,
        evidenceRefs: ["e-1"],
        missingEvidence: [],
        counterEvidenceNeeded: [],
        nextSafeActions: [],
        forbiddenCapabilityRefs: [],
        runCrmImport: true,
      }),
    ).toThrow();
  });
});
