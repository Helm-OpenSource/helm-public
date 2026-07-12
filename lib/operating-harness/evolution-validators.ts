import { z } from "zod";

import type { ValidationResult } from "../expert-capability/validators";
import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  collectUnsafeInputErrors,
  OPERATING_SIGNAL_SOURCE_CLASSES,
} from "../operating-signal-governance/source-governance";
import {
  HARNESS_CHANGE_RATIONALE_CODES,
  MUTABLE_HARNESS_COMPONENT_KINDS,
  PROTECTED_HARNESS_COMPONENT_KINDS,
  type HarnessManifest,
  type HarnessRevision,
} from "./harness-contracts";
import { validateHarnessRevisionBinding, validateHarnessShadowReceipt } from "./harness-validators";
import {
  HARNESS_EVOLUTION_REVIEW_PACKET_SCHEMA_VERSION,
  HARNESS_IMPROVEMENT_PROPOSAL_SCHEMA_VERSION,
  HARNESS_WEAKNESS_ALLOWED_COMPONENTS,
  HARNESS_WEAKNESS_CODES,
  HARNESS_WEAKNESS_POLICY,
  HARNESS_WEAKNESS_SCHEMA_VERSION,
  computeHarnessEvolutionReviewPacketContentHash,
  computeHarnessImprovementProposalContentHash,
  computeHarnessWeaknessContentHash,
  type HarnessDevelopmentSetBinding,
  type HarnessImprovementProposal,
  type HarnessRevisionContext,
  type HarnessWeaknessBinding,
  type HarnessWeaknessEvidence,
  type HarnessWeaknessSignal,
} from "./evolution-contracts";
import { evaluateHarnessShadow, type HarnessShadowEvaluationInput } from "./harness-shadow";
import { validateJsonInputGraph } from "./validators";

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const sha256Schema = z.string().regex(SHA256_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });

const WEAKNESS_TO_METRIC = {
  signal_recall_gap: "signalRecall",
  precision_gap: "precision",
  evidence_coverage_gap: "evidenceCoverage",
  reviewer_completeness_gap: "reviewerCompleteness",
  boundary_incident: "boundaryIncidentCount",
  heldout_lift_gap: "heldoutLift",
  feedback_to_eval_conversion_gap: "feedbackToEvalConversionRate",
} as const;

const weaknessBindingSchema = z
  .object({ weaknessId: safeRefSchema, weaknessHash: sha256Schema })
  .strict();
const developmentSetSchema = z
  .object({ setRef: safeRefSchema, setHash: sha256Schema })
  .strict();

export const harnessWeaknessSignalSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_WEAKNESS_SCHEMA_VERSION),
    weaknessId: safeRefSchema,
    weaknessCode: z.enum(HARNESS_WEAKNESS_CODES),
    remediationClass: z.enum([
      "mutable_harness_component",
      "human_operating_process",
    ]),
    targetRevisionId: safeRefSchema,
    targetRevisionHash: sha256Schema,
    sourceReceiptId: safeRefSchema,
    sourceReceiptHash: sha256Schema,
    sourceBindingHashes: z.array(sha256Schema).min(1),
    sourceBindingRootHash: sha256Schema,
    sourceClasses: z.array(z.enum(OPERATING_SIGNAL_SOURCE_CLASSES)).min(1),
    developmentSetRef: safeRefSchema,
    developmentSetHash: sha256Schema,
    observedValue: z.number().finite(),
    thresholdOperator: z.enum(["min", "max"]),
    thresholdValue: z.number().finite(),
    policyRef: z.literal(HARNESS_WEAKNESS_POLICY.policyRef),
    policyHash: sha256Schema,
    evidenceRefs: z.array(safeRefSchema).min(1),
    detectedAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

const proposedComponentChangeSchema = z
  .object({
    componentKind: z.enum(MUTABLE_HARNESS_COMPONENT_KINDS),
    fromRevisionRef: safeRefSchema,
    toRevisionRef: safeRefSchema,
    toContentHash: sha256Schema,
    rationaleCode: z.enum(HARNESS_CHANGE_RATIONALE_CODES),
    evidenceRefs: z.array(safeRefSchema).min(1),
  })
  .strict();

export const harnessImprovementProposalSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_IMPROVEMENT_PROPOSAL_SCHEMA_VERSION),
    proposalId: safeRefSchema,
    parentRevisionId: safeRefSchema,
    parentRevisionHash: sha256Schema,
    parentManifestHash: sha256Schema,
    lastSafeFallbackRevisionId: safeRefSchema,
    lastSafeFallbackRevisionHash: sha256Schema,
    rollbackManifestHash: sha256Schema,
    weaknessBindings: z.array(weaknessBindingSchema).min(1),
    developmentSets: z.array(developmentSetSchema).min(1),
    componentChanges: z.array(proposedComponentChangeSchema).min(1),
    createdBy: z.literal("agent_proposal"),
    requiredControlGates: z.tuple([
      z.literal("shadow_gate"),
      z.literal("rollback_gate"),
      z.literal("owner_gate"),
    ]),
    ownerReviewRequired: z.literal(true),
    ownerApprovalRecorded: z.literal(false),
    automaticAdoptionAllowed: z.literal(false),
    promotionTriggered: z.literal(false),
    productionAuthorityGranted: z.literal(false),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

const controlGateResultSchema = z
  .object({
    gateType: z.enum(["shadow_gate", "rollback_gate", "owner_gate"]),
    passed: z.boolean(),
    evidenceRefs: z.array(safeRefSchema),
    approverRefs: z.array(safeRefSchema),
  })
  .strict();

export const harnessEvolutionReviewPacketSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_EVOLUTION_REVIEW_PACKET_SCHEMA_VERSION),
    packetId: safeRefSchema,
    proposalId: safeRefSchema,
    proposalHash: sha256Schema,
    weaknessBindings: z.array(weaknessBindingSchema).min(1),
    candidateRevisionId: safeRefSchema,
    candidateRevisionHash: sha256Schema,
    candidateManifestHash: sha256Schema,
    lastSafeFallbackRevisionId: safeRefSchema,
    lastSafeFallbackRevisionHash: sha256Schema,
    rollbackManifestHash: sha256Schema,
    shadowReceiptId: safeRefSchema,
    shadowReceiptHash: sha256Schema,
    shadowVerdict: z.enum(["shadow_pass", "inconclusive", "fail"]),
    developmentSets: z.array(developmentSetSchema).min(1),
    heldoutSetRef: safeRefSchema,
    heldoutSetHash: sha256Schema,
    freshHeldoutConfirmed: z.boolean(),
    decision: z.enum(["owner_review_candidate", "inconclusive", "rejected"]),
    hardGateFailures: z.array(z.string().min(1)),
    controlGateResults: z.array(controlGateResultSchema).length(3),
    ownerReviewRequired: z.literal(true),
    ownerApprovalRecorded: z.literal(false),
    automaticAdoptionAllowed: z.literal(false),
    promotionTriggered: z.literal(false),
    productionAuthorityGranted: z.literal(false),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseErrors(parse: z.ZodSafeParseResult<unknown>, prefix: string): string[] {
  if (parse.success) return [];
  return parse.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${prefix}:${path}:${issue.code}`;
  });
}

function rawHashErrors(
  input: unknown,
  compute: (content: never) => string,
  error: string,
): string[] {
  if (!isRecord(input)) return [error];
  const { contentHash, ...content } = input;
  return typeof contentHash === "string" && contentHash === compute(content as never)
    ? []
    : [error];
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) found.add(value);
    seen.add(value);
  }
  return [...found];
}

function sameBindings(
  left: readonly HarnessWeaknessBinding[],
  right: readonly HarnessWeaknessBinding[],
): boolean {
  const normalized = (items: readonly HarnessWeaknessBinding[]) =>
    [...items]
      .map((item) => `${item.weaknessId}|${item.weaknessHash}`)
      .sort()
      .join("\n");
  return normalized(left) === normalized(right);
}

function sameDevelopmentSets(
  left: readonly HarnessDevelopmentSetBinding[],
  right: readonly HarnessDevelopmentSetBinding[],
): boolean {
  const normalized = (items: readonly HarnessDevelopmentSetBinding[]) =>
    [...items]
      .map((item) => `${item.setRef}|${item.setHash}`)
      .sort()
      .join("\n");
  return normalized(left) === normalized(right);
}

function validateRevisionContext(context: HarnessRevisionContext): string[] {
  return validateHarnessRevisionBinding({
    revision: context.revision,
    manifest: context.manifest,
    parentRevision: context.parentRevision ?? null,
    parentManifest: context.parentManifest ?? null,
    fallbackRevision: context.fallbackRevision,
    fallbackManifest: context.fallbackManifest,
  }).errors.map((error) => `parent_context:${error}`);
}

export function validateHarnessWeaknessSignal(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  errors.push(
    ...rawHashErrors(
      input,
      computeHarnessWeaknessContentHash as (content: never) => string,
      "harness_weakness_content_hash_mismatch",
    ),
  );
  const parsed = harnessWeaknessSignalSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_harness_weakness"));
  if (!parsed.success) return result(errors);

  const weakness = parsed.data;
  const threshold = HARNESS_WEAKNESS_POLICY.thresholds[weakness.weaknessCode];
  if (weakness.policyHash !== HARNESS_WEAKNESS_POLICY.contentHash) {
    errors.push("weakness_policy_hash_mismatch");
  }
  if (
    weakness.sourceBindingRootHash !==
    sha256(canonicalJson(weakness.sourceBindingHashes))
  ) {
    errors.push("weakness_source_binding_root_hash_mismatch");
  }
  if (weakness.thresholdOperator !== threshold.operator) {
    errors.push("weakness_threshold_operator_mismatch");
  }
  if (weakness.thresholdValue !== threshold.value) {
    errors.push("weakness_threshold_value_mismatch");
  }
  if (weakness.remediationClass !== threshold.remediationClass) {
    errors.push("weakness_remediation_class_mismatch");
  }
  const crossed =
    threshold.operator === "min"
      ? weakness.observedValue < threshold.value
      : weakness.observedValue > threshold.value;
  if (!crossed) errors.push("weakness_threshold_not_crossed");
  for (const sourceClass of weakness.sourceClasses) {
    if (sourceClass === "fleet_customer_health" || sourceClass === "oss_governance") {
      errors.push(`forbidden_weakness_source_class:${sourceClass}`);
    }
  }
  for (const duplicate of duplicates(weakness.sourceBindingHashes)) {
    errors.push(`duplicate_weakness_source_binding:${duplicate}`);
  }
  for (const duplicate of duplicates(weakness.sourceClasses)) {
    errors.push(`duplicate_weakness_source_class:${duplicate}`);
  }
  for (const duplicate of duplicates(weakness.evidenceRefs)) {
    errors.push(`duplicate_weakness_evidence_ref:${duplicate}`);
  }
  return result(errors);
}

export function validateHarnessImprovementProposal(
  input: unknown,
): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (isRecord(input) && Array.isArray(input.componentChanges)) {
    for (const change of input.componentChanges) {
      if (!isRecord(change) || typeof change.componentKind !== "string") continue;
      if (PROTECTED_HARNESS_COMPONENT_KINDS.includes(change.componentKind as never)) {
        errors.push(`proposal_contains_protected_component:${change.componentKind}`);
      }
    }
  }
  errors.push(
    ...rawHashErrors(
      input,
      computeHarnessImprovementProposalContentHash as (content: never) => string,
      "harness_improvement_proposal_content_hash_mismatch",
    ),
  );
  const parsed = harnessImprovementProposalSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_harness_improvement_proposal"));
  if (!parsed.success) return result(errors);
  const proposal = parsed.data;
  for (const duplicate of duplicates(proposal.weaknessBindings.map((item) => item.weaknessId))) {
    errors.push(`duplicate_proposal_weakness:${duplicate}`);
  }
  for (const duplicate of duplicates(proposal.developmentSets.map((item) => item.setRef))) {
    errors.push(`duplicate_proposal_development_set:${duplicate}`);
  }
  for (const duplicate of duplicates(proposal.componentChanges.map((item) => item.componentKind))) {
    errors.push(`duplicate_proposal_component_change:${duplicate}`);
  }
  return result(errors);
}

export function validateHarnessImprovementProposalBinding(input: {
  proposal: unknown;
  weaknesses: readonly HarnessWeaknessSignal[];
  weaknessEvidence: readonly HarnessWeaknessEvidence[];
  parentContext: HarnessRevisionContext;
}): ValidationResult {
  const errors = [
    ...validateHarnessImprovementProposal(input.proposal).errors,
    ...validateRevisionContext(input.parentContext),
  ];
  const parsed = harnessImprovementProposalSchema.safeParse(input.proposal);
  if (!parsed.success) return result(errors);
  const proposal = parsed.data;
  const parentRevision = input.parentContext.revision;
  const parentManifest = input.parentContext.manifest;
  const fallbackRevision = input.parentContext.fallbackRevision ??
    (parentRevision.status === "seed" ? parentRevision : input.parentContext.parentRevision);
  const fallbackManifest = input.parentContext.fallbackManifest ??
    (parentRevision.status === "seed" ? parentManifest : input.parentContext.parentManifest);

  if (proposal.parentRevisionId !== parentRevision.revisionId) {
    errors.push("proposal_parent_revision_id_mismatch");
  }
  if (proposal.parentRevisionHash !== parentRevision.contentHash) {
    errors.push("proposal_parent_revision_hash_mismatch");
  }
  if (proposal.parentManifestHash !== parentManifest.contentHash) {
    errors.push("proposal_parent_manifest_hash_mismatch");
  }
  if (!(Date.parse(parentRevision.createdAt) < Date.parse(proposal.createdAt))) {
    errors.push("proposal_not_created_after_parent_revision");
  }
  if (!fallbackRevision || !fallbackManifest) {
    errors.push("proposal_missing_last_safe_fallback_binding");
  } else {
    if (proposal.lastSafeFallbackRevisionId !== fallbackRevision.revisionId) {
      errors.push("proposal_fallback_revision_id_mismatch");
    }
    if (proposal.lastSafeFallbackRevisionHash !== fallbackRevision.contentHash) {
      errors.push("proposal_fallback_revision_hash_mismatch");
    }
    if (proposal.rollbackManifestHash !== fallbackManifest.contentHash) {
      errors.push("proposal_rollback_manifest_hash_mismatch");
    }
  }

  const weaknessBindings = input.weaknesses.map((weakness) => ({
    weaknessId: weakness.weaknessId,
    weaknessHash: weakness.contentHash,
  }));
  if (!sameBindings(proposal.weaknessBindings, weaknessBindings)) {
    errors.push("proposal_weakness_bindings_mismatch");
  }
  const developmentSets = [...new Map(
    input.weaknesses.map((weakness) => [
      `${weakness.developmentSetRef}|${weakness.developmentSetHash}`,
      { setRef: weakness.developmentSetRef, setHash: weakness.developmentSetHash },
    ]),
  ).values()];
  if (!sameDevelopmentSets(proposal.developmentSets, developmentSets)) {
    errors.push("proposal_development_sets_mismatch");
  }

  const receiptById = new Map(
    input.weaknessEvidence.map((evidence) => [evidence.receipt.shadowRunId, evidence.receipt]),
  );
  for (const duplicate of duplicates(
    input.weaknessEvidence.map((item) => item.receipt.shadowRunId),
  )) {
    errors.push(`duplicate_weakness_source_receipt:${duplicate}`);
  }
  for (const evidence of input.weaknessEvidence) {
    const receipt = evidence.receipt;
    for (const error of validateHarnessShadowReceipt(receipt).errors) {
      errors.push(`invalid_weakness_source_receipt:${receipt.shadowRunId}:${error}`);
    }
    const reproduced = evaluateHarnessShadow(evidence.evaluationInput);
    if (reproduced.contentHash !== receipt.contentHash) {
      errors.push(`weakness_source_receipt_not_reproducible:${receipt.shadowRunId}`);
    }
  }
  const referencedReceiptIds = new Set(input.weaknesses.map((item) => item.sourceReceiptId));
  for (const { receipt } of input.weaknessEvidence) {
    if (!referencedReceiptIds.has(receipt.shadowRunId)) {
      errors.push(`unused_weakness_source_receipt:${receipt.shadowRunId}`);
    }
  }

  for (const weakness of input.weaknesses) {
    for (const error of validateHarnessWeaknessSignal(weakness).errors) {
      errors.push(`invalid_weakness:${weakness.weaknessId}:${error}`);
    }
    if (weakness.targetRevisionId !== parentRevision.revisionId) {
      errors.push(`weakness_target_revision_id_mismatch:${weakness.weaknessId}`);
    }
    if (weakness.targetRevisionHash !== parentRevision.contentHash) {
      errors.push(`weakness_target_revision_hash_mismatch:${weakness.weaknessId}`);
    }
    if (weakness.remediationClass === "human_operating_process") {
      errors.push(`weakness_requires_human_operating_process:${weakness.weaknessId}`);
    }
    if (!(Date.parse(weakness.detectedAt) < Date.parse(proposal.createdAt))) {
      errors.push(`proposal_not_created_after_weakness:${weakness.weaknessId}`);
    }
    const sourceReceipt = receiptById.get(weakness.sourceReceiptId);
    if (!sourceReceipt) {
      errors.push(`weakness_source_receipt_missing:${weakness.weaknessId}`);
    } else {
      if (weakness.sourceReceiptHash !== sourceReceipt.contentHash) {
        errors.push(`weakness_source_receipt_hash_mismatch:${weakness.weaknessId}`);
      }
      if (weakness.targetRevisionId !== sourceReceipt.candidateRevisionId) {
        errors.push(`weakness_source_receipt_revision_id_mismatch:${weakness.weaknessId}`);
      }
      if (weakness.targetRevisionHash !== sourceReceipt.candidateRevisionHash) {
        errors.push(`weakness_source_receipt_revision_hash_mismatch:${weakness.weaknessId}`);
      }
      if (
        weakness.developmentSetRef !== sourceReceipt.heldoutSetRef ||
        weakness.developmentSetHash !== sourceReceipt.heldoutSetHash
      ) {
        errors.push(`weakness_source_receipt_development_set_mismatch:${weakness.weaknessId}`);
      }
      if (weakness.sourceBindingRootHash !== sourceReceipt.sourceBindingRootHash) {
        errors.push(`weakness_source_binding_receipt_mismatch:${weakness.weaknessId}`);
      }
      const metric = WEAKNESS_TO_METRIC[weakness.weaknessCode];
      if (weakness.observedValue !== sourceReceipt.candidateQuality[metric]) {
        errors.push(`weakness_source_receipt_metric_mismatch:${weakness.weaknessId}`);
      }
    }
  }

  const parentComponents = new Map(
    parentManifest.components.map((component) => [component.componentKind, component]),
  );
  const weaknessById = new Map(
    input.weaknesses.map((weakness) => [weakness.weaknessId, weakness]),
  );
  for (const change of proposal.componentChanges) {
    const parentComponent = parentComponents.get(change.componentKind);
    if (change.fromRevisionRef !== parentComponent?.revisionRef) {
      errors.push(`proposal_component_from_revision_mismatch:${change.componentKind}`);
    }
    if (change.fromRevisionRef === change.toRevisionRef) {
      errors.push(`proposal_component_revision_not_changed:${change.componentKind}`);
    }
    const citedWeaknesses = change.evidenceRefs
      .map((ref) => weaknessById.get(ref))
      .filter((weakness): weakness is HarnessWeaknessSignal => Boolean(weakness));
    if (citedWeaknesses.length === 0) {
      errors.push(`proposal_component_missing_weakness_evidence:${change.componentKind}`);
    } else if (
      !citedWeaknesses.some((weakness) =>
        HARNESS_WEAKNESS_ALLOWED_COMPONENTS[weakness.weaknessCode].includes(
          change.componentKind,
        ),
      )
    ) {
      errors.push(`proposal_component_not_allowed_for_weakness:${change.componentKind}`);
    }
  }
  return result(errors);
}

export function validateHarnessEvolutionReviewPacket(
  input: unknown,
): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  errors.push(
    ...rawHashErrors(
      input,
      computeHarnessEvolutionReviewPacketContentHash as (content: never) => string,
      "harness_evolution_review_packet_content_hash_mismatch",
    ),
  );
  const parsed = harnessEvolutionReviewPacketSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_harness_evolution_review_packet"));
  if (!parsed.success) return result(errors);
  const packet = parsed.data;
  for (const duplicate of duplicates(packet.weaknessBindings.map((item) => item.weaknessId))) {
    errors.push(`duplicate_review_packet_weakness:${duplicate}`);
  }
  for (const duplicate of duplicates(packet.developmentSets.map((item) => item.setRef))) {
    errors.push(`duplicate_review_packet_development_set:${duplicate}`);
  }
  for (const duplicate of duplicates(packet.controlGateResults.map((item) => item.gateType))) {
    errors.push(`duplicate_review_packet_control_gate:${duplicate}`);
  }
  const gate = new Map(packet.controlGateResults.map((item) => [item.gateType, item]));
  for (const required of ["shadow_gate", "rollback_gate", "owner_gate"] as const) {
    if (!gate.has(required)) errors.push(`review_packet_control_gate_missing:${required}`);
  }
  const ownerGate = gate.get("owner_gate");
  if (ownerGate?.passed || (ownerGate?.approverRefs.length ?? 0) > 0) {
    errors.push("owner_gate_must_remain_unapproved");
  }
  if (packet.decision === "owner_review_candidate") {
    if (!packet.freshHeldoutConfirmed) errors.push("owner_candidate_without_fresh_heldout");
    if (packet.shadowVerdict !== "shadow_pass") errors.push("owner_candidate_without_shadow_pass");
    if (packet.hardGateFailures.length > 0) errors.push("owner_candidate_has_hard_gate_failure");
    if (gate.get("shadow_gate")?.passed !== true) errors.push("owner_candidate_shadow_gate_failed");
    if (gate.get("rollback_gate")?.passed !== true) {
      errors.push("owner_candidate_rollback_gate_failed");
    }
  }
  return result(errors);
}

export function validateHarnessEvolutionReviewPacketBinding(input: {
  packet: unknown;
  proposal: HarnessImprovementProposal;
  weaknesses: readonly HarnessWeaknessSignal[];
  weaknessEvidence: readonly HarnessWeaknessEvidence[];
  parentContext: HarnessRevisionContext;
  candidateManifest: HarnessManifest;
  candidateRevision: HarnessRevision;
  fallbackManifest: HarnessManifest;
  fallbackRevision: HarnessRevision;
  shadowReceipt: unknown;
  expertEvaluation: HarnessShadowEvaluationInput["expertEvaluation"];
  sourceBindings: HarnessShadowEvaluationInput["sourceBindings"];
}): ValidationResult {
  const proposalBindingErrors = validateHarnessImprovementProposalBinding({
    proposal: input.proposal,
    weaknesses: input.weaknesses,
    weaknessEvidence: input.weaknessEvidence,
    parentContext: input.parentContext,
  }).errors;
  const candidateBindingErrors = validateHarnessRevisionBinding({
    revision: input.candidateRevision,
    manifest: input.candidateManifest,
    parentRevision: input.parentContext.revision,
    parentManifest: input.parentContext.manifest,
    fallbackRevision: input.fallbackRevision,
    fallbackManifest: input.fallbackManifest,
  }).errors;
  const recomputedShadowReceipt = evaluateHarnessShadow({
    baselineManifest: input.parentContext.manifest,
    baselineRevision: input.parentContext.revision,
    baselineParentManifest: input.parentContext.parentManifest,
    baselineParentRevision: input.parentContext.parentRevision,
    baselineFallbackManifest: input.parentContext.fallbackManifest,
    baselineFallbackRevision: input.parentContext.fallbackRevision,
    candidateManifest: input.candidateManifest,
    candidateRevision: input.candidateRevision,
    fallbackManifest: input.fallbackManifest,
    fallbackRevision: input.fallbackRevision,
    expertEvaluation: input.expertEvaluation,
    sourceBindings: input.sourceBindings,
  });
  const errors = [
    ...validateHarnessEvolutionReviewPacket(input.packet).errors,
    ...proposalBindingErrors.map((error) => `proposal:${error}`),
    ...candidateBindingErrors.map((error) => `candidate:${error}`),
    ...validateHarnessShadowReceipt(input.shadowReceipt).errors.map(
      (error) => `shadow_receipt:${error}`,
    ),
  ];
  const packetParsed = harnessEvolutionReviewPacketSchema.safeParse(input.packet);
  if (!packetParsed.success || !isRecord(input.shadowReceipt)) return result(errors);
  const packet = packetParsed.data;
  const shadowReceipt = input.shadowReceipt;
  if (!(Date.parse(input.proposal.createdAt) < Date.parse(input.candidateRevision.createdAt))) {
    errors.push("candidate_not_created_after_proposal");
  }
  if (shadowReceipt.contentHash !== recomputedShadowReceipt.contentHash) {
    errors.push("shadow_receipt_not_reproducible_from_bound_input");
  }
  const weaknessBindings = input.weaknesses.map((weakness) => ({
    weaknessId: weakness.weaknessId,
    weaknessHash: weakness.contentHash,
  }));
  if (!sameBindings(packet.weaknessBindings, weaknessBindings)) {
    errors.push("review_packet_weakness_bindings_mismatch");
  }
  if (!sameBindings(packet.weaknessBindings, input.proposal.weaknessBindings)) {
    errors.push("review_packet_proposal_weakness_bindings_mismatch");
  }
  if (!sameDevelopmentSets(packet.developmentSets, input.proposal.developmentSets)) {
    errors.push("review_packet_development_sets_mismatch");
  }
  if (packet.proposalId !== input.proposal.proposalId) {
    errors.push("review_packet_proposal_id_mismatch");
  }
  if (packet.proposalHash !== input.proposal.contentHash) {
    errors.push("review_packet_proposal_hash_mismatch");
  }
  if (packet.candidateRevisionId !== input.candidateRevision.revisionId) {
    errors.push("review_packet_candidate_revision_id_mismatch");
  }
  if (packet.candidateRevisionHash !== input.candidateRevision.contentHash) {
    errors.push("review_packet_candidate_revision_hash_mismatch");
  }
  if (packet.candidateManifestHash !== input.candidateManifest.contentHash) {
    errors.push("review_packet_candidate_manifest_hash_mismatch");
  }
  if (packet.lastSafeFallbackRevisionId !== input.fallbackRevision.revisionId) {
    errors.push("review_packet_fallback_revision_id_mismatch");
  }
  if (packet.lastSafeFallbackRevisionHash !== input.fallbackRevision.contentHash) {
    errors.push("review_packet_fallback_revision_hash_mismatch");
  }
  if (packet.rollbackManifestHash !== input.fallbackManifest.contentHash) {
    errors.push("review_packet_rollback_manifest_hash_mismatch");
  }
  if (packet.shadowReceiptId !== shadowReceipt.shadowRunId) {
    errors.push("review_packet_shadow_receipt_id_mismatch");
  }
  if (packet.shadowReceiptHash !== shadowReceipt.contentHash) {
    errors.push("review_packet_shadow_receipt_hash_mismatch");
  }
  if (packet.shadowVerdict !== shadowReceipt.verdict) {
    errors.push("review_packet_shadow_verdict_mismatch");
  }
  if (packet.heldoutSetRef !== shadowReceipt.heldoutSetRef) {
    errors.push("review_packet_heldout_set_ref_mismatch");
  }
  if (packet.heldoutSetHash !== shadowReceipt.heldoutSetHash) {
    errors.push("review_packet_heldout_set_hash_mismatch");
  }
  if (shadowReceipt.candidateRevisionId !== input.candidateRevision.revisionId) {
    errors.push("shadow_receipt_candidate_revision_id_mismatch");
  }
  if (shadowReceipt.candidateRevisionHash !== input.candidateRevision.contentHash) {
    errors.push("shadow_receipt_candidate_revision_hash_mismatch");
  }
  if (shadowReceipt.baselineRevisionId !== input.proposal.parentRevisionId) {
    errors.push("shadow_receipt_baseline_revision_id_mismatch");
  }
  if (shadowReceipt.baselineRevisionHash !== input.proposal.parentRevisionHash) {
    errors.push("shadow_receipt_baseline_revision_hash_mismatch");
  }
  const candidateComponents = new Map(
    input.candidateManifest.components.map((component) => [component.componentKind, component]),
  );
  const candidateChanges = new Map(
    input.candidateRevision.changes.map((change) => [change.componentKind, change]),
  );
  for (const proposalChange of input.proposal.componentChanges) {
    const component = candidateComponents.get(proposalChange.componentKind);
    const revisionChange = candidateChanges.get(proposalChange.componentKind);
    if (
      component?.revisionRef !== proposalChange.toRevisionRef ||
      component.contentHash !== proposalChange.toContentHash
    ) {
      errors.push(`candidate_component_not_bound_to_proposal:${proposalChange.componentKind}`);
    }
    if (
      revisionChange?.fromRevisionRef !== proposalChange.fromRevisionRef ||
      revisionChange?.toRevisionRef !== proposalChange.toRevisionRef ||
      revisionChange?.rationaleCode !== proposalChange.rationaleCode ||
      revisionChange.evidenceRefs.length !== proposalChange.evidenceRefs.length ||
      !revisionChange.evidenceRefs.every((ref) => proposalChange.evidenceRefs.includes(ref))
    ) {
      errors.push(
        `candidate_revision_change_not_bound_to_proposal:${proposalChange.componentKind}`,
      );
    }
  }
  if (input.candidateRevision.changes.length !== input.proposal.componentChanges.length) {
    errors.push("candidate_revision_change_count_mismatch");
  }
  const derivedWeaknessIds = input.candidateRevision.derivedFromWeaknessIds ?? [];
  const expectedWeaknessIds = input.proposal.weaknessBindings.map((item) => item.weaknessId);
  if (
    derivedWeaknessIds.length !== expectedWeaknessIds.length ||
    !derivedWeaknessIds.every((id) => expectedWeaknessIds.includes(id))
  ) {
    errors.push("candidate_revision_weakness_derivation_mismatch");
  }
  const heldoutReused = input.proposal.developmentSets.some(
    (developmentSet) =>
      developmentSet.setRef === recomputedShadowReceipt.heldoutSetRef ||
      developmentSet.setHash === recomputedShadowReceipt.heldoutSetHash,
  );
  if (packet.freshHeldoutConfirmed === heldoutReused) {
    errors.push("review_packet_fresh_heldout_mismatch");
  }
  if (
    heldoutReused &&
    !packet.hardGateFailures.includes("heldout_set_reused_from_weakness_development")
  ) {
    errors.push("review_packet_omits_heldout_reuse_failure");
  }
  for (const failure of recomputedShadowReceipt.hardGateFailures) {
    if (!packet.hardGateFailures.includes(failure)) {
      errors.push(`review_packet_omits_shadow_failure:${failure}`);
    }
  }
  const expectedDecision =
    packet.hardGateFailures.length > 0 ||
    recomputedShadowReceipt.verdict === "fail" ||
    heldoutReused
      ? "rejected"
      : recomputedShadowReceipt.verdict === "inconclusive"
        ? "inconclusive"
        : "owner_review_candidate";
  if (packet.decision !== expectedDecision) {
    errors.push("review_packet_decision_mismatch");
  }
  const gateByType = new Map(
    packet.controlGateResults.map((gate) => [gate.gateType, gate]),
  );
  const expectedShadowGate =
    recomputedShadowReceipt.verdict === "shadow_pass" &&
    recomputedShadowReceipt.hardGateFailures.length === 0 &&
    !heldoutReused &&
    packet.hardGateFailures.length === 0;
  if (gateByType.get("shadow_gate")?.passed !== expectedShadowGate) {
    errors.push("review_packet_shadow_gate_result_mismatch");
  }
  const expectedRollbackGate =
    proposalBindingErrors.length === 0 && candidateBindingErrors.length === 0;
  if (gateByType.get("rollback_gate")?.passed !== expectedRollbackGate) {
    errors.push("review_packet_rollback_gate_result_mismatch");
  }
  return result(errors);
}
