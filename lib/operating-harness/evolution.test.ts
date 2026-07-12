import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  ASet,
  BSet,
  PreRegistration,
  RunInput,
} from "../expert-capability/contracts";
import {
  computeASetHash,
  computeBSetHash,
  computeGoldLabelsHash,
  computePreRegistrationContentHash,
  computeReplaySnapshotHashes,
  computeReplaySnapshotRootHash,
  sha256,
} from "../expert-capability/hashing";
import {
  createHarnessEvolutionReviewPacket,
  createHarnessImprovementProposal,
  materializeHarnessCandidate,
  mineHarnessWeaknesses,
  type HarnessRevisionContext,
} from "./evolution";
import {
  computeHarnessEvolutionReviewPacketContentHash,
  computeHarnessImprovementProposalContentHash,
  computeHarnessWeaknessContentHash,
} from "./evolution-contracts";
import {
  syntheticFleetHarnessSource,
  syntheticHarnessPair,
  syntheticHarnessSource,
} from "./harness-fixtures";
import {
  computeHarnessRevisionContentHash,
  computeHarnessShadowReceiptContentHash,
} from "./harness-contracts";
import type { HarnessShadowEvaluationInput } from "./harness-shadow";
import {
  validateHarnessEvolutionReviewPacketBinding,
  validateHarnessImprovementProposalBinding,
  validateHarnessWeaknessSignal,
} from "./evolution-validators";

const packsDir = path.resolve(
  __dirname,
  "..",
  "..",
  "templates",
  "expert-capability",
  "packs",
);

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(packsDir, name), "utf8")) as T;
}

function baseExpertEvaluation(): HarnessShadowEvaluationInput["expertEvaluation"] {
  return {
    preRegistration: readJson<PreRegistration>("pre-registration.json"),
    runInput: readJson<RunInput>("run-input.json"),
    aSet: readJson<ASet>("a-correction-set.json"),
    bSet: readJson<BSet>("b-heldout-eval-set.json"),
  };
}

function restampExpertEvaluation(
  input: HarnessShadowEvaluationInput["expertEvaluation"],
): HarnessShadowEvaluationInput["expertEvaluation"] {
  input.aSet.setHash = computeASetHash(input.aSet);
  input.bSet.goldLabelsHash = computeGoldLabelsHash(input.bSet);
  input.bSet.setHash = computeBSetHash(input.bSet);
  input.preRegistration.aCorrectionSetHash = input.aSet.setHash;
  input.preRegistration.bHeldoutSetHash = input.bSet.setHash;
  input.preRegistration.goldLabelsHash = input.bSet.goldLabelsHash;
  input.preRegistration.replaySnapshotHashes = computeReplaySnapshotHashes(input.bSet);
  input.preRegistration.replaySnapshotRootHash = computeReplaySnapshotRootHash(
    input.preRegistration.replaySnapshotHashes,
  );
  input.preRegistration.contentHash = computePreRegistrationContentHash(
    input.preRegistration,
  );
  return input;
}

function weaknessShadowInput(): HarnessShadowEvaluationInput {
  const pair = syntheticHarnessPair();
  const expertEvaluation = baseExpertEvaluation();
  const nonSelf = expertEvaluation.bSet.cases.find(
    (item) => item.kind === "synthetic_non_self_org",
  )!;
  nonSelf.outputs.candidate.disposition = "missed_evidence_gap";
  nonSelf.outputs.previous.disposition = "missed_evidence_gap";
  restampExpertEvaluation(expertEvaluation);

  return {
    ...pair,
    expertEvaluation,
    sourceBindings: [{ source: syntheticHarnessSource(), promotion: null }],
  };
}

function revisionContext(): HarnessRevisionContext {
  const pair = syntheticHarnessPair();
  return {
    revision: pair.candidateRevision,
    manifest: pair.candidateManifest,
    parentRevision: pair.baselineRevision,
    parentManifest: pair.baselineManifest,
    fallbackRevision: pair.baselineRevision,
    fallbackManifest: pair.baselineManifest,
  };
}

function freshExpertEvaluation(
  candidateRevisionId: string,
  candidateCreatedAt: string,
  previousRevisionId: string,
): HarnessShadowEvaluationInput["expertEvaluation"] {
  const expertEvaluation = baseExpertEvaluation();
  expertEvaluation.aSet = structuredClone(expertEvaluation.aSet);
  expertEvaluation.aSet.setId = "a-from-b-set-001";
  expertEvaluation.aSet.cases = expertEvaluation.aSet.cases.map((item, index) => ({
    ...item,
    caseId: `a2-case-${index + 1}`,
    inputSnapshotRef: `snapshot:a2-case-${index + 1}@1`,
    feedback: {
      ...item.feedback,
      feedbackId: `feedback:weakness-b1-${index + 1}`,
    },
    candidate: {
      ...item.candidate,
      expertRevisionId: candidateRevisionId,
    },
  }));

  expertEvaluation.bSet = structuredClone(expertEvaluation.bSet);
  expertEvaluation.bSet.setId = "b-set-002";
  expertEvaluation.bSet.goldLockedAt = "2026-06-04T04:30:00.000Z";
  expertEvaluation.bSet.cases = expertEvaluation.bSet.cases.map((item, index) => {
    const candidate = {
      ...item.outputs.candidate,
      expertRevisionId: candidateRevisionId,
      disposition: item.gold.disposition,
    };
    const previous = {
      ...item.outputs.previous,
      expertRevisionId: previousRevisionId,
      disposition:
        item.kind === "synthetic_non_self_org"
          ? "missed_evidence_gap"
          : item.outputs.previous.disposition,
    };
    return {
      ...item,
      caseId: index === 0 ? "b2-case-syn-001" : "b2-case-trap-001",
      inputSnapshotRef:
        index === 0 ? "snapshot:b2-case-syn-001@1" : "snapshot:b2-case-trap-001@1",
      outputs: { ...item.outputs, candidate, previous },
    };
  });

  expertEvaluation.preRegistration = {
    ...expertEvaluation.preRegistration,
    preRegistrationId: "prereg-0002",
    previousExpertRevisionId: previousRevisionId,
    goldLockedAt: expertEvaluation.bSet.goldLockedAt,
    trustedTimestamp: "2026-06-04T05:30:00.000Z",
  };
  expertEvaluation.runInput = {
    ...expertEvaluation.runInput,
    evaluationRunId: "run-0002",
    candidateRevisionId,
    candidateRevisionCreatedAt: candidateCreatedAt,
    ranAt: "2026-06-04T06:00:00.000Z",
    attemptNumber: 1,
    bSetConsumedByRevisionIds: [],
  };
  return restampExpertEvaluation(expertEvaluation);
}

function proposalAndCandidate() {
  const mined = mineHarnessWeaknesses(weaknessShadowInput());
  const context = revisionContext();
  const proposalResult = createHarnessImprovementProposal({
    proposalId: "proposal:oh-expert-v2",
    parentContext: context,
    weaknesses: mined.weaknesses,
    weaknessEvidence: [mined.evidence],
    componentChanges: [
      {
        componentKind: "judgement_fusion",
        fromRevisionRef: "judgement_fusion:v2",
        toRevisionRef: "judgement_fusion:v3",
        toContentHash: sha256("judgement_fusion:v3"),
        rationaleCode: "heldout_failure",
        evidenceRefs: mined.weaknesses.map((item) => item.weaknessId),
      },
    ],
    createdAt: "2026-06-04T04:15:00.000Z",
  });
  if (!proposalResult.proposal) throw new Error(proposalResult.errors.join(","));
  const materialized = materializeHarnessCandidate({
    proposal: proposalResult.proposal,
    weaknesses: mined.weaknesses,
    weaknessEvidence: [mined.evidence],
    parentContext: context,
    candidateRevisionId: "oh-expert-v2",
    createdAt: "2026-06-04T05:00:00.000Z",
  });
  if (!materialized.candidateManifest || !materialized.candidateRevision) {
    throw new Error(materialized.errors.join(","));
  }
  return {
    mined,
    context,
    proposal: proposalResult.proposal,
    candidateManifest: materialized.candidateManifest,
    candidateRevision: materialized.candidateRevision,
  };
}

describe("operating harness P2 weakness mining", () => {
  it("mines closed, content-bound weaknesses only from a governed replayed shadow receipt", () => {
    const mined = mineHarnessWeaknesses(weaknessShadowInput());

    expect(mined.ok).toBe(true);
    expect(mined.receipt.verdict).toBe("shadow_pass");
    expect(mined.weaknesses.map((item) => item.weaknessCode)).toEqual(
      expect.arrayContaining(["signal_recall_gap", "precision_gap"]),
    );
    expect(mined.weaknesses.every((item) => validateHarnessWeaknessSignal(item).ok)).toBe(
      true,
    );
    expect(mined.weaknesses.every((item) => item.developmentSetRef === "b-set-001")).toBe(
      true,
    );
  });

  it("blocks customer fleet sources before any weakness enters evolution", () => {
    const input = weaknessShadowInput();
    input.sourceBindings = [{ source: syntheticFleetHarnessSource(), promotion: null }];

    const mined = mineHarnessWeaknesses(input);

    expect(mined.ok).toBe(false);
    expect(mined.weaknesses).toEqual([]);
    expect(mined.errors).toContain(
      "source_gate:source_class_forbidden_from_improvement_loop:fleet_customer_health",
    );
  });

  it("does not turn structural or incomplete evaluation failures into learnable weaknesses", () => {
    const input = weaknessShadowInput();
    input.expertEvaluation.bSet.cases = [];
    restampExpertEvaluation(input.expertEvaluation);

    const mined = mineHarnessWeaknesses(input);

    expect(mined.ok).toBe(false);
    expect(mined.weaknesses).toEqual([]);
    expect(mined.errors).toEqual(
      expect.arrayContaining([
        "candidate_quality_report_incomplete",
        "expert_invariant:b_set_empty",
      ]),
    );
  });
});

describe("operating harness P2 proposal and materialization", () => {
  it("creates an additive owner-gated proposal and materializes only its mutable change", () => {
    const { mined, context, proposal, candidateManifest, candidateRevision } =
      proposalAndCandidate();

    expect(proposal.automaticAdoptionAllowed).toBe(false);
    expect(proposal.ownerApprovalRecorded).toBe(false);
    expect(proposal.promotionTriggered).toBe(false);
    expect(proposal.requiredControlGates).toEqual([
      "shadow_gate",
      "rollback_gate",
      "owner_gate",
    ]);
    expect(
      validateHarnessImprovementProposalBinding({
        proposal,
        weaknesses: mined.weaknesses,
        weaknessEvidence: [mined.evidence],
        parentContext: context,
      }),
    ).toEqual({ ok: true, errors: [] });
    expect(
      candidateManifest.components.find(
        (item) => item.componentKind === "judgement_fusion",
      )?.revisionRef,
    ).toBe("judgement_fusion:v3");
    expect(candidateRevision.parentRevisionId).toBe("oh-expert-v1");
    expect(candidateRevision.fallbackRevisionId).toBe("oh-expert-v0");
    expect(candidateRevision.derivedFromWeaknessIds).toEqual(
      mined.weaknesses.map((item) => item.weaknessId),
    );
  });

  it("rejects protected-component proposals and human-process weaknesses", () => {
    const mined = mineHarnessWeaknesses(weaknessShadowInput());
    const context = revisionContext();
    const operationalWeakness = {
      ...mined.weaknesses[0],
      weaknessId: "weakness:reviewer-process",
      weaknessCode: "reviewer_completeness_gap" as const,
      remediationClass: "human_operating_process" as const,
      observedValue: 0.5,
      thresholdValue: 1,
    };
    const { contentHash: _oldHash, ...operationalContent } = operationalWeakness;
    operationalWeakness.contentHash = computeHarnessWeaknessContentHash(
      operationalContent,
    );

    const protectedResult = createHarnessImprovementProposal({
      proposalId: "proposal:protected-change",
      parentContext: context,
      weaknesses: mined.weaknesses,
      weaknessEvidence: [mined.evidence],
      componentChanges: [
        {
          componentKind: "evaluator" as never,
          fromRevisionRef: "evaluator:v1",
          toRevisionRef: "evaluator:v2",
          toContentHash: sha256("evaluator:v2"),
          rationaleCode: "heldout_failure",
          evidenceRefs: [mined.weaknesses[0].weaknessId],
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });
    const processResult = createHarnessImprovementProposal({
      proposalId: "proposal:human-process",
      parentContext: context,
      weaknesses: [operationalWeakness],
      weaknessEvidence: [mined.evidence],
      componentChanges: [
        {
          componentKind: "judgement_fusion",
          fromRevisionRef: "judgement_fusion:v2",
          toRevisionRef: "judgement_fusion:v3",
          toContentHash: sha256("judgement_fusion:v3"),
          rationaleCode: "heldout_failure",
          evidenceRefs: [operationalWeakness.weaknessId],
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });

    expect(protectedResult.proposal).toBeNull();
    expect(protectedResult.errors).toContain("proposal_contains_protected_component:evaluator");
    expect(processResult.proposal).toBeNull();
    expect(processResult.errors).toContain(
      "weakness_requires_human_operating_process:weakness:reviewer-process",
    );
  });

  it("rejects stale weakness bindings and component from-revision mismatches", () => {
    const mined = mineHarnessWeaknesses(weaknessShadowInput());
    const context = revisionContext();
    const stale = structuredClone(mined.weaknesses);
    stale[0].targetRevisionHash = sha256("another-revision");

    const result = createHarnessImprovementProposal({
      proposalId: "proposal:stale-weakness",
      parentContext: context,
      weaknesses: stale,
      weaknessEvidence: [mined.evidence],
      componentChanges: [
        {
          componentKind: "judgement_fusion",
          fromRevisionRef: "judgement_fusion:wrong-parent",
          toRevisionRef: "judgement_fusion:v3",
          toContentHash: sha256("judgement_fusion:v3"),
          rationaleCode: "heldout_failure",
          evidenceRefs: stale.map((item) => item.weaknessId),
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });

    expect(result.proposal).toBeNull();
    expect(result.errors).toEqual(
      expect.arrayContaining([
        `invalid_weakness:${stale[0].weaknessId}:harness_weakness_content_hash_mismatch`,
        `weakness_target_revision_hash_mismatch:${stale[0].weaknessId}`,
        "proposal_component_from_revision_mismatch:judgement_fusion",
      ]),
    );
  });

  it("requires weakness source receipts and binds their source-root evidence", () => {
    const mined = mineHarnessWeaknesses(weaknessShadowInput());
    const context = revisionContext();
    const forged = structuredClone(mined.weaknesses);
    forged[0].sourceBindingHashes = [sha256("forged-source-binding")];
    forged[0].sourceBindingRootHash = sha256(
      JSON.stringify(forged[0].sourceBindingHashes),
    );
    const { contentHash: _weaknessHash, ...weaknessContent } = forged[0];
    forged[0].contentHash = computeHarnessWeaknessContentHash(weaknessContent);

    const missingReceipt = createHarnessImprovementProposal({
      proposalId: "proposal:missing-source-receipt",
      parentContext: context,
      weaknesses: mined.weaknesses,
      weaknessEvidence: [],
      componentChanges: [
        {
          componentKind: "judgement_fusion",
          fromRevisionRef: "judgement_fusion:v2",
          toRevisionRef: "judgement_fusion:v3",
          toContentHash: sha256("judgement_fusion:v3"),
          rationaleCode: "heldout_failure",
          evidenceRefs: mined.weaknesses.map((item) => item.weaknessId),
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });
    const forgedRoot = createHarnessImprovementProposal({
      proposalId: "proposal:forged-source-root",
      parentContext: context,
      weaknesses: forged,
      weaknessEvidence: [mined.evidence],
      componentChanges: [
        {
          componentKind: "judgement_fusion",
          fromRevisionRef: "judgement_fusion:v2",
          toRevisionRef: "judgement_fusion:v3",
          toContentHash: sha256("judgement_fusion:v3"),
          rationaleCode: "heldout_failure",
          evidenceRefs: forged.map((item) => item.weaknessId),
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });

    expect(missingReceipt.proposal).toBeNull();
    expect(missingReceipt.errors).toContain(
      `weakness_source_receipt_missing:${mined.weaknesses[0].weaknessId}`,
    );
    expect(forgedRoot.proposal).toBeNull();
    expect(forgedRoot.errors).toContain(
      `weakness_source_binding_receipt_mismatch:${forged[0].weaknessId}`,
    );
  });

  it("requires the proposal to be authored after its detected weaknesses", () => {
    const mined = mineHarnessWeaknesses(weaknessShadowInput());
    const result = createHarnessImprovementProposal({
      proposalId: "proposal:before-weakness",
      parentContext: revisionContext(),
      weaknesses: mined.weaknesses,
      weaknessEvidence: [mined.evidence],
      componentChanges: [
        {
          componentKind: "judgement_fusion",
          fromRevisionRef: "judgement_fusion:v2",
          toRevisionRef: "judgement_fusion:v3",
          toContentHash: sha256("judgement_fusion:v3"),
          rationaleCode: "heldout_failure",
          evidenceRefs: mined.weaknesses.map((item) => item.weaknessId),
        },
      ],
      createdAt: "2026-06-04T03:30:00.000Z",
    });

    expect(result.proposal).toBeNull();
    expect(result.errors).toContain(
      `proposal_not_created_after_weakness:${mined.weaknesses[0].weaknessId}`,
    );
  });

  it("does not let a generic heldout-lift gap justify arbitrary tool changes", () => {
    const mined = mineHarnessWeaknesses(weaknessShadowInput());
    const base = mined.weaknesses[0];
    const { contentHash: _hash, ...baseContent } = base;
    const heldoutContent = {
      ...baseContent,
      weaknessId: "weakness:heldout-lift-tool-bypass",
      weaknessCode: "heldout_lift_gap" as const,
      observedValue: 0,
      thresholdOperator: "min" as const,
      thresholdValue: 0.05,
    };
    const heldoutWeakness = {
      ...heldoutContent,
      contentHash: computeHarnessWeaknessContentHash(heldoutContent),
    };
    const result = createHarnessImprovementProposal({
      proposalId: "proposal:heldout-tool-bypass",
      parentContext: revisionContext(),
      weaknesses: [heldoutWeakness],
      weaknessEvidence: [mined.evidence],
      componentChanges: [
        {
          componentKind: "tool_binding",
          fromRevisionRef: "tool_binding:v1",
          toRevisionRef: "tool_binding:v2",
          toContentHash: sha256("tool_binding:v2"),
          rationaleCode: "heldout_failure",
          evidenceRefs: [heldoutWeakness.weaknessId],
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });

    expect(result.proposal).toBeNull();
    expect(result.errors).toContain(
      "proposal_component_not_allowed_for_weakness:tool_binding",
    );
  });

  it("replays weakness evidence instead of trusting a restamped source receipt", () => {
    const evaluationInput = weaknessShadowInput();
    const mined = mineHarnessWeaknesses(evaluationInput);
    const signalRecall = mined.weaknesses.find(
      (item) => item.weaknessCode === "signal_recall_gap",
    )!;
    const { contentHash: _receiptHash, ...receiptContent } = mined.receipt;
    const forgedReceiptContent = {
      ...receiptContent,
      candidateQuality: {
        ...receiptContent.candidateQuality,
        signalRecall: 0.1,
      },
    };
    const forgedReceipt = {
      ...forgedReceiptContent,
      contentHash: computeHarnessShadowReceiptContentHash(forgedReceiptContent),
    };
    const { contentHash: _weaknessHash, ...weaknessContent } = signalRecall;
    const forgedWeaknessContent = {
      ...weaknessContent,
      sourceReceiptHash: forgedReceipt.contentHash,
      observedValue: 0.1,
    };
    const forgedWeakness = {
      ...forgedWeaknessContent,
      contentHash: computeHarnessWeaknessContentHash(forgedWeaknessContent),
    };

    const result = createHarnessImprovementProposal({
      proposalId: "proposal:forged-mining-receipt",
      parentContext: revisionContext(),
      weaknesses: [forgedWeakness],
      weaknessEvidence: [{ receipt: forgedReceipt, evaluationInput }],
      componentChanges: [
        {
          componentKind: "judgement_fusion",
          fromRevisionRef: "judgement_fusion:v2",
          toRevisionRef: "judgement_fusion:v3",
          toContentHash: sha256("judgement_fusion:v3"),
          rationaleCode: "heldout_failure",
          evidenceRefs: [forgedWeakness.weaknessId],
        },
      ],
      createdAt: "2026-06-04T04:15:00.000Z",
    });

    expect(result.proposal).toBeNull();
    expect(result.errors).toContain(
      `weakness_source_receipt_not_reproducible:${forgedReceipt.shadowRunId}`,
    );
  });
});

describe("operating harness P2 fresh-heldout owner packet", () => {
  it("uses a fresh held-out set and stops at an owner-review candidate", () => {
    const pipeline = proposalAndCandidate();
    const expertEvaluation = freshExpertEvaluation(
      pipeline.candidateRevision.revisionId,
      pipeline.candidateRevision.createdAt,
      pipeline.context.revision.revisionId,
    );
    const sourceBindings = [{ source: syntheticHarnessSource(), promotion: null }];
    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:oh-expert-v2",
      proposal: pipeline.proposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation,
      sourceBindings,
      createdAt: "2026-06-04T06:05:00.000Z",
    });

    expect(review.ok).toBe(true);
    expect(review.shadowReceipt.verdict).toBe("shadow_pass");
    expect(review.packet.decision).toBe("owner_review_candidate");
    expect(review.packet.freshHeldoutConfirmed).toBe(true);
    expect(review.packet.ownerApprovalRecorded).toBe(false);
    expect(review.packet.promotionTriggered).toBe(false);
    expect(review.packet.automaticAdoptionAllowed).toBe(false);
    expect(review.packet.productionAuthorityGranted).toBe(false);
    expect(review.packet.controlGateResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gateType: "shadow_gate", passed: true }),
        expect.objectContaining({ gateType: "rollback_gate", passed: true }),
        expect.objectContaining({ gateType: "owner_gate", passed: false }),
      ]),
    );
    expect(
      validateHarnessEvolutionReviewPacketBinding({
        packet: review.packet,
        proposal: pipeline.proposal,
        weaknesses: pipeline.mined.weaknesses,
        weaknessEvidence: [pipeline.mined.evidence],
        parentContext: pipeline.context,
        candidateManifest: pipeline.candidateManifest,
        candidateRevision: pipeline.candidateRevision,
        fallbackManifest: pipeline.context.fallbackManifest!,
        fallbackRevision: pipeline.context.fallbackRevision!,
        shadowReceipt: review.shadowReceipt,
        expertEvaluation,
        sourceBindings,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("keeps the rollback gate consistent when proposal binding fails", () => {
    const pipeline = proposalAndCandidate();
    const { contentHash: _proposalHash, ...proposalContent } = pipeline.proposal;
    const invalidProposalContent = {
      ...proposalContent,
      createdAt: "2026-06-04T03:30:00.000Z",
    };
    const invalidProposal = {
      ...invalidProposalContent,
      contentHash: computeHarnessImprovementProposalContentHash(
        invalidProposalContent,
      ),
    };
    const expertEvaluation = freshExpertEvaluation(
      pipeline.candidateRevision.revisionId,
      pipeline.candidateRevision.createdAt,
      pipeline.context.revision.revisionId,
    );
    const sourceBindings = [{ source: syntheticHarnessSource(), promotion: null }];
    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:invalid-proposal-order",
      proposal: invalidProposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation,
      sourceBindings,
      createdAt: "2026-06-04T06:05:00.000Z",
    });
    const binding = validateHarnessEvolutionReviewPacketBinding({
      packet: review.packet,
      proposal: invalidProposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      fallbackManifest: pipeline.context.fallbackManifest!,
      fallbackRevision: pipeline.context.fallbackRevision!,
      shadowReceipt: review.shadowReceipt,
      expertEvaluation,
      sourceBindings,
    });

    expect(review.packet.decision).toBe("rejected");
    expect(
      review.packet.controlGateResults.find(
        (gate) => gate.gateType === "rollback_gate",
      )?.passed,
    ).toBe(false);
    expect(binding.errors).not.toContain(
      "review_packet_rollback_gate_result_mismatch",
    );
  });

  it("rejects reuse of the weakness-development held-out set", () => {
    const pipeline = proposalAndCandidate();
    const reused = baseExpertEvaluation();
    reused.preRegistration = {
      ...reused.preRegistration,
      previousExpertRevisionId: pipeline.context.revision.revisionId,
    };
    reused.runInput = {
      ...reused.runInput,
      candidateRevisionId: pipeline.candidateRevision.revisionId,
      candidateRevisionCreatedAt: pipeline.candidateRevision.createdAt,
      ranAt: "2026-06-04T06:00:00.000Z",
    };
    for (const item of reused.aSet.cases) {
      item.candidate.expertRevisionId = pipeline.candidateRevision.revisionId;
    }
    for (const item of reused.bSet.cases) {
      item.outputs.candidate.expertRevisionId = pipeline.candidateRevision.revisionId;
      item.outputs.previous.expertRevisionId = pipeline.context.revision.revisionId;
    }
    restampExpertEvaluation(reused);

    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:reused-b",
      proposal: pipeline.proposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation: reused,
      sourceBindings: [{ source: syntheticHarnessSource(), promotion: null }],
      createdAt: "2026-06-04T06:05:00.000Z",
    });

    expect(review.ok).toBe(false);
    expect(review.packet.decision).toBe("rejected");
    expect(review.packet.freshHeldoutConfirmed).toBe(false);
    expect(review.packet.hardGateFailures).toContain(
      "heldout_set_reused_from_weakness_development",
    );
  });

  it("fails closed when held-out gold is locked after candidate creation", () => {
    const pipeline = proposalAndCandidate();
    const evaluation = freshExpertEvaluation(
      pipeline.candidateRevision.revisionId,
      pipeline.candidateRevision.createdAt,
      pipeline.context.revision.revisionId,
    );
    evaluation.bSet.goldLockedAt = "2026-06-04T05:30:00.000Z";
    evaluation.preRegistration.goldLockedAt = evaluation.bSet.goldLockedAt;
    restampExpertEvaluation(evaluation);

    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:late-gold",
      proposal: pipeline.proposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation: evaluation,
      sourceBindings: [{ source: syntheticHarnessSource(), promotion: null }],
      createdAt: "2026-06-04T06:05:00.000Z",
    });

    expect(review.packet.decision).toBe("rejected");
    expect(review.packet.hardGateFailures).toContain(
      "expert_invariant:gold_locked_not_before_candidate_creation",
    );
  });

  it("detects tampering with proposal and owner-review packet content", () => {
    const pipeline = proposalAndCandidate();
    const expertEvaluation = freshExpertEvaluation(
      pipeline.candidateRevision.revisionId,
      pipeline.candidateRevision.createdAt,
      pipeline.context.revision.revisionId,
    );
    const sourceBindings = [{ source: syntheticHarnessSource(), promotion: null }];
    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:tamper-check",
      proposal: pipeline.proposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation,
      sourceBindings,
      createdAt: "2026-06-04T06:05:00.000Z",
    });
    const proposalTampered = {
      ...pipeline.proposal,
      automaticAdoptionAllowed: true,
    };
    const { contentHash: _proposalHash, ...proposalContent } = proposalTampered;
    proposalTampered.contentHash = computeHarnessImprovementProposalContentHash(
      proposalContent as never,
    );
    const packetTampered = {
      ...review.packet,
      ownerApprovalRecorded: true,
      promotionTriggered: true,
    };
    const { contentHash: _packetHash, ...packetContent } = packetTampered;
    packetTampered.contentHash = computeHarnessEvolutionReviewPacketContentHash(
      packetContent as never,
    );

    expect(
      validateHarnessImprovementProposalBinding({
        proposal: proposalTampered,
        weaknesses: pipeline.mined.weaknesses,
        weaknessEvidence: [pipeline.mined.evidence],
        parentContext: pipeline.context,
      }).ok,
    ).toBe(false);
    expect(
      validateHarnessEvolutionReviewPacketBinding({
        packet: packetTampered,
        proposal: pipeline.proposal,
        weaknesses: pipeline.mined.weaknesses,
        weaknessEvidence: [pipeline.mined.evidence],
        parentContext: pipeline.context,
        candidateManifest: pipeline.candidateManifest,
        candidateRevision: pipeline.candidateRevision,
        fallbackManifest: pipeline.context.fallbackManifest!,
        fallbackRevision: pipeline.context.fallbackRevision!,
        shadowReceipt: review.shadowReceipt,
        expertEvaluation,
        sourceBindings,
      }).ok,
    ).toBe(false);
  });

  it("rejects a restamped shadow receipt that cannot be replayed from bound input", () => {
    const pipeline = proposalAndCandidate();
    const expertEvaluation = freshExpertEvaluation(
      pipeline.candidateRevision.revisionId,
      pipeline.candidateRevision.createdAt,
      pipeline.context.revision.revisionId,
    );
    const sourceBindings = [{ source: syntheticHarnessSource(), promotion: null }];
    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:receipt-replay",
      proposal: pipeline.proposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation,
      sourceBindings,
      createdAt: "2026-06-04T06:05:00.000Z",
    });
    const { contentHash: _receiptHash, ...receiptContent } = review.shadowReceipt;
    const forgedReceiptContent = {
      ...receiptContent,
      candidateQuality: {
        ...receiptContent.candidateQuality,
        signalRecall: 0.95,
      },
    };
    const forgedReceipt = {
      ...forgedReceiptContent,
      contentHash: computeHarnessShadowReceiptContentHash(forgedReceiptContent),
    };
    const { contentHash: _packetHash, ...packetContent } = review.packet;
    const forgedPacketContent = {
      ...packetContent,
      shadowReceiptHash: forgedReceipt.contentHash,
    };
    const forgedPacket = {
      ...forgedPacketContent,
      contentHash: computeHarnessEvolutionReviewPacketContentHash(forgedPacketContent),
    };

    expect(
      validateHarnessEvolutionReviewPacketBinding({
        packet: forgedPacket,
        proposal: pipeline.proposal,
        weaknesses: pipeline.mined.weaknesses,
        weaknessEvidence: [pipeline.mined.evidence],
        parentContext: pipeline.context,
        candidateManifest: pipeline.candidateManifest,
        candidateRevision: pipeline.candidateRevision,
        fallbackManifest: pipeline.context.fallbackManifest!,
        fallbackRevision: pipeline.context.fallbackRevision!,
        shadowReceipt: forgedReceipt,
        expertEvaluation,
        sourceBindings,
      }).errors,
    ).toContain("shadow_receipt_not_reproducible_from_bound_input");
  });

  it("rejects candidate revision evidence that diverges from the proposal", () => {
    const pipeline = proposalAndCandidate();
    const { contentHash: _candidateHash, ...candidateContent } =
      pipeline.candidateRevision;
    candidateContent.changes = candidateContent.changes.map((change) => ({
      ...change,
      evidenceRefs: ["weakness:substituted"],
    }));
    const candidateRevision = {
      ...candidateContent,
      contentHash: computeHarnessRevisionContentHash(candidateContent),
    };
    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:evidence-divergence",
      proposal: pipeline.proposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision,
      expertEvaluation: freshExpertEvaluation(
        candidateRevision.revisionId,
        candidateRevision.createdAt,
        pipeline.context.revision.revisionId,
      ),
      sourceBindings: [{ source: syntheticHarnessSource(), promotion: null }],
      createdAt: "2026-06-04T06:05:00.000Z",
    });

    expect(review.packet.decision).toBe("rejected");
    expect(review.packet.hardGateFailures).toContain(
      "candidate_revision_change_not_bound_to_proposal:judgement_fusion",
    );
  });

  it("rechecks that the proposal predates the candidate at review time", () => {
    const pipeline = proposalAndCandidate();
    const { contentHash: _proposalHash, ...proposalContent } = pipeline.proposal;
    const lateProposalContent = {
      ...proposalContent,
      createdAt: "2026-06-04T05:30:00.000Z",
    };
    const lateProposal = {
      ...lateProposalContent,
      contentHash: computeHarnessImprovementProposalContentHash(lateProposalContent),
    };
    const review = createHarnessEvolutionReviewPacket({
      packetId: "evolution-review:late-proposal",
      proposal: lateProposal,
      weaknesses: pipeline.mined.weaknesses,
      weaknessEvidence: [pipeline.mined.evidence],
      parentContext: pipeline.context,
      candidateManifest: pipeline.candidateManifest,
      candidateRevision: pipeline.candidateRevision,
      expertEvaluation: freshExpertEvaluation(
        pipeline.candidateRevision.revisionId,
        pipeline.candidateRevision.createdAt,
        pipeline.context.revision.revisionId,
      ),
      sourceBindings: [{ source: syntheticHarnessSource(), promotion: null }],
      createdAt: "2026-06-04T06:05:00.000Z",
    });

    expect(review.packet.decision).toBe("rejected");
    expect(review.packet.hardGateFailures).toContain(
      "candidate_not_created_after_proposal",
    );
  });
});
