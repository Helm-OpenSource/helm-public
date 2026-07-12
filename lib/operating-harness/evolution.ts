import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  HARNESS_MANIFEST_SCHEMA_VERSION,
  HARNESS_REVISION_SCHEMA_VERSION,
  computeHarnessManifestContentHash,
  computeHarnessRevisionContentHash,
  type HarnessManifest,
  type HarnessRevision,
} from "./harness-contracts";
import {
  HARNESS_EVOLUTION_REVIEW_PACKET_SCHEMA_VERSION,
  HARNESS_IMPROVEMENT_PROPOSAL_SCHEMA_VERSION,
  HARNESS_WEAKNESS_POLICY,
  HARNESS_WEAKNESS_SCHEMA_VERSION,
  computeHarnessEvolutionReviewPacketContentHash,
  computeHarnessImprovementProposalContentHash,
  computeHarnessWeaknessContentHash,
  type HarnessEvolutionReviewPacket,
  type HarnessImprovementProposal,
  type HarnessProposedComponentChange,
  type HarnessRevisionContext,
  type HarnessWeaknessCode,
  type HarnessWeaknessEvidence,
  type HarnessWeaknessSignal,
} from "./evolution-contracts";
import {
  validateHarnessEvolutionReviewPacketBinding,
  validateHarnessImprovementProposalBinding,
  validateHarnessWeaknessSignal,
} from "./evolution-validators";
import { evaluateHarnessShadow, type HarnessShadowEvaluationInput } from "./harness-shadow";
import { validateHarnessRevisionBinding } from "./harness-validators";

export type { HarnessRevisionContext } from "./evolution-contracts";

const QUALITY_TO_WEAKNESS = [
  ["signalRecall", "signal_recall_gap"],
  ["precision", "precision_gap"],
  ["evidenceCoverage", "evidence_coverage_gap"],
  ["reviewerCompleteness", "reviewer_completeness_gap"],
  ["boundaryIncidentCount", "boundary_incident"],
  ["heldoutLift", "heldout_lift_gap"],
  ["feedbackToEvalConversionRate", "feedback_to_eval_conversion_gap"],
] as const satisfies readonly [
  keyof ReturnType<typeof evaluateHarnessShadow>["candidateQuality"],
  HarnessWeaknessCode,
][];

const LEARNABLE_HARD_GATE_PREFIXES = [
  "candidate_signal_recall_regressed",
  "candidate_precision_regressed",
  "candidate_evidence_coverage_regressed",
  "candidate_reviewer_completeness_regressed",
  "candidate_feedback_to_eval_conversion_rate_regressed",
  "candidate_boundary_incident_present",
  "candidate_reviewer_completeness_below_one",
  "candidate_heldout_lift_not_positive",
  "expert_hard_gate:",
  "expert_a_regression:",
] as const;

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function fallbackFromContext(context: HarnessRevisionContext): {
  revision: HarnessRevision | null;
  manifest: HarnessManifest | null;
} {
  if (context.fallbackRevision && context.fallbackManifest) {
    return { revision: context.fallbackRevision, manifest: context.fallbackManifest };
  }
  if (context.revision.status === "seed") {
    return { revision: context.revision, manifest: context.manifest };
  }
  return {
    revision: context.parentRevision ?? null,
    manifest: context.parentManifest ?? null,
  };
}

function structuralReceiptFailures(failures: readonly string[]): string[] {
  return failures.filter(
    (failure) =>
      !LEARNABLE_HARD_GATE_PREFIXES.some((prefix) => failure.startsWith(prefix)),
  );
}

export function mineHarnessWeaknesses(input: HarnessShadowEvaluationInput): {
  ok: boolean;
  errors: string[];
  receipt: ReturnType<typeof evaluateHarnessShadow>;
  evidence: HarnessWeaknessEvidence;
  weaknesses: HarnessWeaknessSignal[];
} {
  const receipt = evaluateHarnessShadow(input);
  const evidence = { receipt, evaluationInput: input };
  const errors = structuralReceiptFailures(receipt.hardGateFailures);
  const sourceBindingHashes = input.sourceBindings.map((binding) =>
    sha256(canonicalJson(binding)),
  );
  const sourceBindingRootHash = sha256(canonicalJson(sourceBindingHashes));
  const sourceClasses = unique(input.sourceBindings.map((binding) => binding.source.sourceClass));
  if (errors.length > 0 || sourceBindingHashes.length === 0) {
    return { ok: false, errors: unique(errors), receipt, evidence, weaknesses: [] };
  }

  const weaknesses: HarnessWeaknessSignal[] = [];
  for (const [metric, weaknessCode] of QUALITY_TO_WEAKNESS) {
    const observedValue = receipt.candidateQuality[metric];
    if (typeof observedValue !== "number" || !Number.isFinite(observedValue)) {
      errors.push(`candidate_quality_metric_missing:${metric}`);
      continue;
    }
    const threshold = HARNESS_WEAKNESS_POLICY.thresholds[weaknessCode];
    const crossed =
      threshold.operator === "min"
        ? observedValue < threshold.value
        : observedValue > threshold.value;
    if (!crossed) continue;
    const weaknessId = `weakness:${receipt.candidateRevisionId}:${weaknessCode}:${receipt.contentHash.slice(7, 19)}`;
    const content = {
      schemaVersion: HARNESS_WEAKNESS_SCHEMA_VERSION,
      weaknessId,
      weaknessCode,
      remediationClass: threshold.remediationClass,
      targetRevisionId: receipt.candidateRevisionId,
      targetRevisionHash: receipt.candidateRevisionHash,
      sourceReceiptId: receipt.shadowRunId,
      sourceReceiptHash: receipt.contentHash,
      sourceBindingHashes,
      sourceBindingRootHash,
      sourceClasses,
      developmentSetRef: receipt.heldoutSetRef,
      developmentSetHash: receipt.heldoutSetHash,
      observedValue,
      thresholdOperator: threshold.operator,
      thresholdValue: threshold.value,
      policyRef: HARNESS_WEAKNESS_POLICY.policyRef,
      policyHash: HARNESS_WEAKNESS_POLICY.contentHash,
      evidenceRefs: [receipt.shadowRunId, ...input.sourceBindings.map((item) => item.source.signalId)],
      detectedAt: receipt.createdAt,
    };
    weaknesses.push({
      ...content,
      contentHash: computeHarnessWeaknessContentHash(content),
    });
  }
  for (const weakness of weaknesses) {
    errors.push(
      ...validateHarnessWeaknessSignal(weakness).errors.map(
        (error) => `generated_weakness:${weakness.weaknessId}:${error}`,
      ),
    );
  }
  return {
    ok: errors.length === 0,
    errors: unique(errors),
    receipt,
    evidence,
    weaknesses: errors.length === 0 ? weaknesses : [],
  };
}

export function createHarnessImprovementProposal(input: {
  proposalId: string;
  parentContext: HarnessRevisionContext;
  weaknesses: readonly HarnessWeaknessSignal[];
  weaknessEvidence: readonly HarnessWeaknessEvidence[];
  componentChanges: readonly HarnessProposedComponentChange[];
  createdAt: string;
}): {
  ok: boolean;
  errors: string[];
  proposal: HarnessImprovementProposal | null;
} {
  const fallback = fallbackFromContext(input.parentContext);
  if (!fallback.revision || !fallback.manifest) {
    return {
      ok: false,
      errors: ["proposal_missing_last_safe_fallback_binding"],
      proposal: null,
    };
  }
  const developmentSets = [...new Map(
    input.weaknesses.map((weakness) => [
      `${weakness.developmentSetRef}|${weakness.developmentSetHash}`,
      { setRef: weakness.developmentSetRef, setHash: weakness.developmentSetHash },
    ]),
  ).values()];
  const content = {
    schemaVersion: HARNESS_IMPROVEMENT_PROPOSAL_SCHEMA_VERSION,
    proposalId: input.proposalId,
    parentRevisionId: input.parentContext.revision.revisionId,
    parentRevisionHash: input.parentContext.revision.contentHash,
    parentManifestHash: input.parentContext.manifest.contentHash,
    lastSafeFallbackRevisionId: fallback.revision.revisionId,
    lastSafeFallbackRevisionHash: fallback.revision.contentHash,
    rollbackManifestHash: fallback.manifest.contentHash,
    weaknessBindings: input.weaknesses.map((weakness) => ({
      weaknessId: weakness.weaknessId,
      weaknessHash: weakness.contentHash,
    })),
    developmentSets,
    componentChanges: input.componentChanges.map((change) => ({ ...change })),
    createdBy: "agent_proposal" as const,
    requiredControlGates: [
      "shadow_gate",
      "rollback_gate",
      "owner_gate",
    ] as ["shadow_gate", "rollback_gate", "owner_gate"],
    ownerReviewRequired: true as const,
    ownerApprovalRecorded: false as const,
    automaticAdoptionAllowed: false as const,
    promotionTriggered: false as const,
    productionAuthorityGranted: false as const,
    createdAt: input.createdAt,
  };
  const proposal: HarnessImprovementProposal = {
    ...content,
    contentHash: computeHarnessImprovementProposalContentHash(content),
  };
  const validation = validateHarnessImprovementProposalBinding({
    proposal,
    weaknesses: input.weaknesses,
    weaknessEvidence: input.weaknessEvidence,
    parentContext: input.parentContext,
  });
  return {
    ok: validation.ok,
    errors: validation.errors,
    proposal: validation.ok ? proposal : null,
  };
}

export function materializeHarnessCandidate(input: {
  proposal: HarnessImprovementProposal;
  weaknesses: readonly HarnessWeaknessSignal[];
  weaknessEvidence: readonly HarnessWeaknessEvidence[];
  parentContext: HarnessRevisionContext;
  candidateRevisionId: string;
  createdAt: string;
}): {
  ok: boolean;
  errors: string[];
  candidateManifest: HarnessManifest | null;
  candidateRevision: HarnessRevision | null;
} {
  const errors = validateHarnessImprovementProposalBinding({
    proposal: input.proposal,
    weaknesses: input.weaknesses,
    weaknessEvidence: input.weaknessEvidence,
    parentContext: input.parentContext,
  }).errors;
  const fallback = fallbackFromContext(input.parentContext);
  if (!fallback.revision || !fallback.manifest) {
    errors.push("candidate_missing_last_safe_fallback_binding");
  }
  if (!(Date.parse(input.proposal.createdAt) < Date.parse(input.createdAt))) {
    errors.push("candidate_not_created_after_proposal");
  }
  if (
    input.candidateRevisionId === input.parentContext.revision.revisionId ||
    input.candidateRevisionId === fallback.revision?.revisionId
  ) {
    errors.push("candidate_revision_id_not_new");
  }
  if (errors.length > 0 || !fallback.revision || !fallback.manifest) {
    return {
      ok: false,
      errors: unique(errors),
      candidateManifest: null,
      candidateRevision: null,
    };
  }

  const changeByKind = new Map(
    input.proposal.componentChanges.map((change) => [change.componentKind, change]),
  );
  const manifestContent = {
    ...input.parentContext.manifest,
    schemaVersion: HARNESS_MANIFEST_SCHEMA_VERSION,
    components: input.parentContext.manifest.components.map((component) => {
      const change = changeByKind.get(component.componentKind as never);
      return change
        ? {
            ...component,
            revisionRef: change.toRevisionRef,
            contentHash: change.toContentHash,
          }
        : { ...component };
    }),
    createdAt: input.createdAt,
  };
  delete (manifestContent as Partial<HarnessManifest>).contentHash;
  const candidateManifest: HarnessManifest = {
    ...manifestContent,
    contentHash: computeHarnessManifestContentHash(manifestContent),
  };
  const revisionContent = {
    schemaVersion: HARNESS_REVISION_SCHEMA_VERSION,
    revisionId: input.candidateRevisionId,
    manifestId: candidateManifest.manifestId,
    manifestHash: candidateManifest.contentHash,
    parentRevisionId: input.parentContext.revision.revisionId,
    parentManifestHash: input.parentContext.manifest.contentHash,
    status: "shadow_candidate" as const,
    changes: input.proposal.componentChanges.map((change) => ({
      componentKind: change.componentKind,
      fromRevisionRef: change.fromRevisionRef,
      toRevisionRef: change.toRevisionRef,
      rationaleCode: change.rationaleCode,
      evidenceRefs: [...change.evidenceRefs],
    })),
    derivedFromFeedbackIds: [],
    derivedFromWeaknessIds: input.proposal.weaknessBindings.map(
      (binding) => binding.weaknessId,
    ),
    createdBy: "agent_proposal" as const,
    fallbackRevisionId: fallback.revision.revisionId,
    rollbackManifestHash: fallback.manifest.contentHash,
    ownerReviewRequired: true as const,
    promotionTriggered: false as const,
    createdAt: input.createdAt,
  };
  const candidateRevision: HarnessRevision = {
    ...revisionContent,
    contentHash: computeHarnessRevisionContentHash(revisionContent),
  };
  errors.push(
    ...validateHarnessRevisionBinding({
      revision: candidateRevision,
      manifest: candidateManifest,
      parentRevision: input.parentContext.revision,
      parentManifest: input.parentContext.manifest,
      fallbackRevision: fallback.revision,
      fallbackManifest: fallback.manifest,
    }).errors,
  );
  return {
    ok: errors.length === 0,
    errors: unique(errors),
    candidateManifest: errors.length === 0 ? candidateManifest : null,
    candidateRevision: errors.length === 0 ? candidateRevision : null,
  };
}

function candidateMatchesProposal(input: {
  proposal: HarnessImprovementProposal;
  candidateManifest: HarnessManifest;
  candidateRevision: HarnessRevision;
}): string[] {
  const errors: string[] = [];
  const manifestComponents = new Map(
    input.candidateManifest.components.map((component) => [component.componentKind, component]),
  );
  const revisionChanges = new Map(
    input.candidateRevision.changes.map((change) => [change.componentKind, change]),
  );
  for (const change of input.proposal.componentChanges) {
    const component = manifestComponents.get(change.componentKind);
    const revisionChange = revisionChanges.get(change.componentKind);
    if (
      component?.revisionRef !== change.toRevisionRef ||
      component.contentHash !== change.toContentHash
    ) {
      errors.push(`candidate_component_not_bound_to_proposal:${change.componentKind}`);
    }
    if (
      revisionChange?.fromRevisionRef !== change.fromRevisionRef ||
      revisionChange?.toRevisionRef !== change.toRevisionRef ||
      revisionChange?.rationaleCode !== change.rationaleCode ||
      revisionChange.evidenceRefs.length !== change.evidenceRefs.length ||
      !revisionChange.evidenceRefs.every((ref) => change.evidenceRefs.includes(ref))
    ) {
      errors.push(`candidate_revision_change_not_bound_to_proposal:${change.componentKind}`);
    }
  }
  if (input.candidateRevision.changes.length !== input.proposal.componentChanges.length) {
    errors.push("candidate_revision_change_count_mismatch");
  }
  return errors;
}

export function createHarnessEvolutionReviewPacket(input: {
  packetId: string;
  proposal: HarnessImprovementProposal;
  weaknesses: readonly HarnessWeaknessSignal[];
  weaknessEvidence: readonly HarnessWeaknessEvidence[];
  parentContext: HarnessRevisionContext;
  candidateManifest: HarnessManifest;
  candidateRevision: HarnessRevision;
  expertEvaluation: HarnessShadowEvaluationInput["expertEvaluation"];
  sourceBindings: HarnessShadowEvaluationInput["sourceBindings"];
  createdAt: string;
}): {
  ok: boolean;
  errors: string[];
  shadowReceipt: ReturnType<typeof evaluateHarnessShadow>;
  packet: HarnessEvolutionReviewPacket;
} {
  const fallback = fallbackFromContext(input.parentContext);
  const proposalBindingErrors = validateHarnessImprovementProposalBinding({
    proposal: input.proposal,
    weaknesses: input.weaknesses,
    weaknessEvidence: input.weaknessEvidence,
    parentContext: input.parentContext,
  }).errors;
  const errors = [...proposalBindingErrors];
  if (!(Date.parse(input.proposal.createdAt) < Date.parse(input.candidateRevision.createdAt))) {
    errors.push("candidate_not_created_after_proposal");
  }
  errors.push(...candidateMatchesProposal(input));
  let candidateBindingErrors: string[] = [];
  if (!fallback.revision || !fallback.manifest) {
    candidateBindingErrors = ["review_missing_last_safe_fallback_binding"];
    errors.push("review_missing_last_safe_fallback_binding");
  } else {
    candidateBindingErrors = validateHarnessRevisionBinding({
      revision: input.candidateRevision,
      manifest: input.candidateManifest,
      parentRevision: input.parentContext.revision,
      parentManifest: input.parentContext.manifest,
      fallbackRevision: fallback.revision,
      fallbackManifest: fallback.manifest,
    }).errors;
    errors.push(...candidateBindingErrors.map((error) => `candidate:${error}`));
  }
  const shadowReceipt = evaluateHarnessShadow({
    baselineManifest: input.parentContext.manifest,
    baselineRevision: input.parentContext.revision,
    baselineParentManifest: input.parentContext.parentManifest,
    baselineParentRevision: input.parentContext.parentRevision,
    baselineFallbackManifest: input.parentContext.fallbackManifest,
    baselineFallbackRevision: input.parentContext.fallbackRevision,
    candidateManifest: input.candidateManifest,
    candidateRevision: input.candidateRevision,
    fallbackManifest: fallback.manifest ?? undefined,
    fallbackRevision: fallback.revision ?? undefined,
    expertEvaluation: input.expertEvaluation,
    sourceBindings: input.sourceBindings,
  });
  errors.push(...shadowReceipt.hardGateFailures);
  const heldoutReused = input.proposal.developmentSets.some(
    (developmentSet) =>
      developmentSet.setRef === shadowReceipt.heldoutSetRef ||
      developmentSet.setHash === shadowReceipt.heldoutSetHash,
  );
  if (heldoutReused) errors.push("heldout_set_reused_from_weakness_development");
  const hardGateFailures = unique(errors);
  const freshHeldoutConfirmed = !heldoutReused;
  const rollbackPassed =
    proposalBindingErrors.length === 0 && candidateBindingErrors.length === 0;
  const shadowPassed =
    shadowReceipt.verdict === "shadow_pass" && hardGateFailures.length === 0;
  const decision =
    hardGateFailures.length > 0 || shadowReceipt.verdict === "fail"
      ? ("rejected" as const)
      : shadowReceipt.verdict === "inconclusive"
        ? ("inconclusive" as const)
        : ("owner_review_candidate" as const);
  const fallbackRevision = fallback.revision ?? input.parentContext.revision;
  const fallbackManifest = fallback.manifest ?? input.parentContext.manifest;

  const buildPacket = (packetFailures: string[], packetDecision = decision) => {
    const content = {
      schemaVersion: HARNESS_EVOLUTION_REVIEW_PACKET_SCHEMA_VERSION,
      packetId: input.packetId,
      proposalId: input.proposal.proposalId,
      proposalHash: input.proposal.contentHash,
      weaknessBindings: input.proposal.weaknessBindings.map((binding) => ({ ...binding })),
      candidateRevisionId: input.candidateRevision.revisionId,
      candidateRevisionHash: input.candidateRevision.contentHash,
      candidateManifestHash: input.candidateManifest.contentHash,
      lastSafeFallbackRevisionId: fallbackRevision.revisionId,
      lastSafeFallbackRevisionHash: fallbackRevision.contentHash,
      rollbackManifestHash: fallbackManifest.contentHash,
      shadowReceiptId: shadowReceipt.shadowRunId,
      shadowReceiptHash: shadowReceipt.contentHash,
      shadowVerdict: shadowReceipt.verdict,
      developmentSets: input.proposal.developmentSets.map((set) => ({ ...set })),
      heldoutSetRef: shadowReceipt.heldoutSetRef,
      heldoutSetHash: shadowReceipt.heldoutSetHash,
      freshHeldoutConfirmed,
      decision: packetDecision,
      hardGateFailures: packetFailures,
      controlGateResults: [
        {
          gateType: "shadow_gate" as const,
          passed: shadowPassed,
          evidenceRefs: [shadowReceipt.shadowRunId],
          approverRefs: [],
        },
        {
          gateType: "rollback_gate" as const,
          passed: rollbackPassed,
          evidenceRefs: [fallbackRevision.revisionId],
          approverRefs: [],
        },
        {
          gateType: "owner_gate" as const,
          passed: false,
          evidenceRefs: [],
          approverRefs: [],
        },
      ],
      ownerReviewRequired: true as const,
      ownerApprovalRecorded: false as const,
      automaticAdoptionAllowed: false as const,
      promotionTriggered: false as const,
      productionAuthorityGranted: false as const,
      createdAt: input.createdAt,
    };
    return {
      ...content,
      contentHash: computeHarnessEvolutionReviewPacketContentHash(content),
    } satisfies HarnessEvolutionReviewPacket;
  };

  let packet = buildPacket(hardGateFailures);
  const bindingErrors = validateHarnessEvolutionReviewPacketBinding({
    packet,
    proposal: input.proposal,
    weaknesses: input.weaknesses,
    weaknessEvidence: input.weaknessEvidence,
    parentContext: input.parentContext,
    candidateManifest: input.candidateManifest,
    candidateRevision: input.candidateRevision,
    fallbackManifest,
    fallbackRevision,
    shadowReceipt,
    expertEvaluation: input.expertEvaluation,
    sourceBindings: input.sourceBindings,
  }).errors;
  if (bindingErrors.length > 0) {
    packet = buildPacket(
      unique([...hardGateFailures, ...bindingErrors.map((error) => `packet_binding:${error}`)]),
      "rejected",
    );
  }
  return {
    ok: packet.decision === "owner_review_candidate",
    errors: packet.hardGateFailures,
    shadowReceipt,
    packet,
  };
}
