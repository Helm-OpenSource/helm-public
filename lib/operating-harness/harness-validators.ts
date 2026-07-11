import { z } from "zod";

import type { ValidationResult } from "../expert-capability/validators";
import { collectUnsafeInputErrors } from "../operating-signal-governance/source-governance";
import {
  HARNESS_CHANGE_RATIONALE_CODES,
  HARNESS_COMPONENT_KINDS,
  HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES,
  HARNESS_MANIFEST_ALLOWED_USES,
  HARNESS_MANIFEST_SCHEMA_VERSION,
  HARNESS_REVISION_SCHEMA_VERSION,
  HARNESS_SHADOW_RECEIPT_SCHEMA_VERSION,
  MUTABLE_HARNESS_COMPONENT_KINDS,
  PROTECTED_HARNESS_COMPONENT_KINDS,
  computeHarnessManifestContentHash,
  computeHarnessRevisionContentHash,
  computeHarnessShadowReceiptContentHash,
  type HarnessComponentBinding,
  type HarnessManifest,
} from "./harness-contracts";
import { validateJsonInputGraph } from "./validators";

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const sha256Schema = z.string().regex(SHA256_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });

const componentBindingSchema = z
  .object({
    componentKind: z.enum(HARNESS_COMPONENT_KINDS),
    componentRef: safeRefSchema,
    revisionRef: safeRefSchema,
    contentHash: sha256Schema,
  })
  .strict();

export const harnessManifestSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_MANIFEST_SCHEMA_VERSION),
    manifestId: safeRefSchema,
    scope: z.literal("public_offline_shadow"),
    canonicalChainRef: safeRefSchema,
    components: z.array(componentBindingSchema).min(1),
    allowedSourceClasses: z.array(z.enum(HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES)).min(1),
    intendedUses: z.array(z.enum(HARNESS_MANIFEST_ALLOWED_USES)).min(1),
    commitmentClass: z.literal("advice"),
    actionAuthority: z.literal("none"),
    humanReviewRequired: z.literal(true),
    automaticPromotionAllowed: z.literal(false),
    externalSendAllowed: z.literal(false),
    writebackAllowed: z.literal(false),
    memoryPromotionAllowed: z.literal(false),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

const componentChangeSchema = z
  .object({
    componentKind: z.enum(MUTABLE_HARNESS_COMPONENT_KINDS),
    fromRevisionRef: safeRefSchema,
    toRevisionRef: safeRefSchema,
    rationaleCode: z.enum(HARNESS_CHANGE_RATIONALE_CODES),
    evidenceRefs: z.array(safeRefSchema).min(1),
  })
  .strict();

export const harnessRevisionSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_REVISION_SCHEMA_VERSION),
    revisionId: safeRefSchema,
    manifestId: safeRefSchema,
    manifestHash: sha256Schema,
    parentRevisionId: safeRefSchema.nullable(),
    parentManifestHash: sha256Schema.nullable(),
    status: z.enum(["seed", "shadow_candidate", "killed"]),
    changes: z.array(componentChangeSchema),
    derivedFromFeedbackIds: z.array(safeRefSchema),
    derivedFromWeaknessIds: z.array(safeRefSchema).optional(),
    createdBy: z.enum(["human", "agent_proposal"]),
    fallbackRevisionId: safeRefSchema.nullable(),
    rollbackManifestHash: sha256Schema.nullable(),
    ownerReviewRequired: z.literal(true),
    promotionTriggered: z.literal(false),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

const qualityMetricsSchema = z
  .object({
    signalRecall: z.number().min(0).max(1).nullable(),
    precision: z.number().min(0).max(1).nullable(),
    evidenceCoverage: z.number().min(0).max(1).nullable(),
    reviewerCompleteness: z.number().min(0).max(1).nullable(),
    boundaryIncidentCount: z.number().int().min(0).nullable(),
    heldoutLift: z.number().min(-1).max(1).nullable(),
    feedbackToEvalConversionRate: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const harnessShadowReceiptSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_SHADOW_RECEIPT_SCHEMA_VERSION),
    shadowRunId: safeRefSchema,
    candidateRevisionId: safeRefSchema,
    candidateRevisionHash: sha256Schema,
    baselineRevisionId: safeRefSchema,
    baselineRevisionHash: sha256Schema,
    preRegistrationId: safeRefSchema,
    preRegistrationContentHash: sha256Schema,
    developmentSetRef: safeRefSchema,
    developmentSetHash: sha256Schema,
    heldoutSetRef: safeRefSchema,
    heldoutSetHash: sha256Schema,
    replaySnapshotRootHash: sha256Schema,
    qualityDerivation: z.literal("expert_pre_registered_a_b"),
    qualityScope: z.literal("heldout_corpus_projection"),
    expertEvaluation: z
      .object({
        loopCompoundingDecision: z.enum(["success", "inconclusive", "fail"]),
        expertJustifiedDecision: z.enum([
          "pass",
          "inconclusive(expert_vs_rules)",
          "fail",
        ]),
        candidateWeighted: z.number().min(0).max(1),
        previousWeighted: z.number().min(0).max(1),
        ruleBaselineWeighted: z.number().min(0).max(1),
        candidateBoundaryCorrectness: z.number().min(0).max(100),
      })
      .strict(),
    candidateQuality: qualityMetricsSchema,
    baselineQuality: qualityMetricsSchema,
    sourceGateCount: z.number().int().min(0),
    verdict: z.enum(["shadow_pass", "inconclusive", "fail"]),
    hardGateFailures: z.array(z.string().min(1)),
    eligibleForOwnerReview: z.boolean(),
    ownerReviewRequired: z.literal(true),
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

function validateRawContentHash(
  input: Record<string, unknown>,
  compute: (content: never) => string,
  error: string,
): string[] {
  const { contentHash, ...content } = input;
  return typeof contentHash === "string" && contentHash === compute(content as never)
    ? []
    : [error];
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    right.every((value) => left.includes(value))
  );
}

export function validateHarnessManifest(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_harness_manifest"]);

  errors.push(
    ...validateRawContentHash(
      input,
      computeHarnessManifestContentHash as (content: never) => string,
      "harness_manifest_content_hash_mismatch",
    ),
  );
  if (Array.isArray(input.allowedSourceClasses)) {
    for (const sourceClass of input.allowedSourceClasses) {
      if (
        typeof sourceClass === "string" &&
        !HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES.includes(sourceClass as never)
      ) {
        errors.push(`forbidden_manifest_source_class:${sourceClass}`);
      }
    }
  }

  const parsed = harnessManifestSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_harness_manifest"));
  if (!parsed.success) return result(errors);

  const kinds = parsed.data.components.map((component) => component.componentKind);
  for (const duplicate of duplicateValues(kinds)) {
    errors.push(`duplicate_harness_component:${duplicate}`);
  }
  for (const required of HARNESS_COMPONENT_KINDS) {
    if (!kinds.includes(required)) errors.push(`required_harness_component_missing:${required}`);
  }
  for (const duplicate of duplicateValues(parsed.data.allowedSourceClasses)) {
    errors.push(`duplicate_manifest_source_class:${duplicate}`);
  }
  for (const duplicate of duplicateValues(parsed.data.intendedUses)) {
    errors.push(`duplicate_manifest_intended_use:${duplicate}`);
  }

  return result(errors);
}

function componentMap(manifest: HarnessManifest): Map<string, HarnessComponentBinding> {
  return new Map(manifest.components.map((component) => [component.componentKind, component]));
}

export function validateHarnessRevisionBinding(input: {
  revision: unknown;
  manifest: unknown;
  parentRevision: unknown | null;
  parentManifest: unknown | null;
  fallbackRevision?: unknown | null;
  fallbackManifest?: unknown | null;
}): ValidationResult {
  const errors = [
    ...validateHarnessManifest(input.manifest).errors,
    ...(input.parentManifest ? validateHarnessManifest(input.parentManifest).errors : []),
  ];
  const graphErrors = validateJsonInputGraph(input.revision);
  if (graphErrors.length > 0) return result([...errors, ...graphErrors]);
  errors.push(...collectUnsafeInputErrors(input.revision));
  if (!isRecord(input.revision)) return result([...errors, "invalid_harness_revision"]);
  if (input.parentRevision !== null) {
    const parentGraphErrors = validateJsonInputGraph(input.parentRevision);
    if (parentGraphErrors.length > 0) {
      return result([
        ...errors,
        ...parentGraphErrors.map((error) => `parent_revision:${error}`),
      ]);
    }
    errors.push(
      ...collectUnsafeInputErrors(input.parentRevision).map(
        (error) => `parent_revision:${error}`,
      ),
    );
  }

  errors.push(
    ...validateRawContentHash(
      input.revision,
      computeHarnessRevisionContentHash as (content: never) => string,
      "harness_revision_content_hash_mismatch",
    ),
  );
  if (input.revision.status === "shadow_candidate") {
    if (!input.revision.fallbackRevisionId) {
      errors.push("shadow_candidate_missing_fallback_revision");
    }
    if (!input.revision.rollbackManifestHash) {
      errors.push("shadow_candidate_missing_rollback_manifest");
    }
  }

  const revisionParsed = harnessRevisionSchema.safeParse(input.revision);
  errors.push(...parseErrors(revisionParsed, "invalid_harness_revision"));
  const manifestParsed = harnessManifestSchema.safeParse(input.manifest);
  const parentRevisionParsed = input.parentRevision
    ? harnessRevisionSchema.safeParse(input.parentRevision)
    : null;
  const parentManifestParsed = input.parentManifest
    ? harnessManifestSchema.safeParse(input.parentManifest)
    : null;
  if (!revisionParsed.success || !manifestParsed.success) return result(errors);

  if (isRecord(input.parentRevision)) {
    errors.push(
      ...validateRawContentHash(
        input.parentRevision,
        computeHarnessRevisionContentHash as (content: never) => string,
        "parent_revision_content_hash_mismatch",
      ),
    );
  }

  const revision = revisionParsed.data;
  const manifest = manifestParsed.data;
  if (revision.manifestId !== manifest.manifestId) errors.push("revision_manifest_id_mismatch");
  if (revision.manifestHash !== manifest.contentHash) errors.push("revision_manifest_hash_mismatch");
  for (const duplicate of duplicateValues(revision.derivedFromFeedbackIds)) {
    errors.push(`duplicate_revision_feedback_ref:${duplicate}`);
  }
  for (const duplicate of duplicateValues(revision.derivedFromWeaknessIds ?? [])) {
    errors.push(`duplicate_revision_weakness_ref:${duplicate}`);
  }
  for (const duplicate of duplicateValues(
    revision.changes.map((change) => change.componentKind),
  )) {
    errors.push(`duplicate_revision_component_change:${duplicate}`);
  }

  if (revision.status === "seed") {
    if (revision.createdBy !== "human") {
      errors.push("seed_revision_not_human_authored");
    }
    if (revision.parentRevisionId || revision.parentManifestHash) {
      errors.push("seed_revision_has_parent");
    }
    if (revision.changes.length > 0) errors.push("seed_revision_has_changes");
    if (input.parentRevision || input.parentManifest) errors.push("seed_revision_received_parent");
    if (revision.fallbackRevisionId !== null) {
      errors.push("seed_revision_has_fallback_revision");
    }
    if (revision.rollbackManifestHash !== null) {
      errors.push("seed_revision_has_rollback_manifest");
    }
    if (input.fallbackRevision !== undefined || input.fallbackManifest !== undefined) {
      errors.push("seed_revision_received_fallback");
    }
  } else {
    if (!parentRevisionParsed?.success || !parentManifestParsed?.success) {
      errors.push("non_seed_revision_missing_valid_parent");
      return result(errors);
    }
    const parentRevision = parentRevisionParsed.data;
    const parentManifest = parentManifestParsed.data;
    if (parentRevision.status === "killed") errors.push("parent_revision_killed");
    if (parentRevision.manifestId !== parentManifest.manifestId) {
      errors.push("parent_revision_manifest_id_mismatch");
    }
    if (parentRevision.manifestHash !== parentManifest.contentHash) {
      errors.push("parent_revision_manifest_hash_mismatch");
    }
    if (manifest.manifestId !== parentManifest.manifestId) {
      errors.push("manifest_lineage_id_mismatch");
    }
    if (manifest.canonicalChainRef !== parentManifest.canonicalChainRef) {
      errors.push("canonical_chain_changed");
    }
    if (
      !sameStringSet(manifest.allowedSourceClasses, parentManifest.allowedSourceClasses)
    ) {
      errors.push("protected_manifest_source_classes_changed");
    }
    if (!sameStringSet(manifest.intendedUses, parentManifest.intendedUses)) {
      errors.push("protected_manifest_intended_uses_changed");
    }
    if (revision.parentRevisionId !== parentRevision.revisionId) {
      errors.push("parent_revision_id_mismatch");
    }
    if (revision.parentManifestHash !== parentManifest.contentHash) {
      errors.push("parent_manifest_hash_mismatch");
    }
    const inheritedFallbackRevisionId =
      parentRevision.status === "seed"
        ? parentRevision.revisionId
        : parentRevision.fallbackRevisionId;
    const inheritedFallbackManifestHash =
      parentRevision.status === "seed"
        ? parentManifest.contentHash
        : parentRevision.rollbackManifestHash;
    if (revision.fallbackRevisionId !== inheritedFallbackRevisionId) {
      errors.push("fallback_revision_not_inherited_from_parent");
    }
    if (revision.rollbackManifestHash !== inheritedFallbackManifestHash) {
      errors.push("fallback_manifest_not_inherited_from_parent");
    }
    const fallbackRevisionProvided = input.fallbackRevision !== undefined;
    const fallbackManifestProvided = input.fallbackManifest !== undefined;
    if (fallbackRevisionProvided !== fallbackManifestProvided) {
      errors.push("fallback_pair_incomplete");
    }
    const fallbackRevisionInput = fallbackRevisionProvided
      ? input.fallbackRevision
      : fallbackManifestProvided
        ? null
        : input.parentRevision;
    const fallbackManifestInput = fallbackManifestProvided
      ? input.fallbackManifest
      : fallbackRevisionProvided
        ? null
        : input.parentManifest;
    const fallbackGraphErrors = [
      ...validateJsonInputGraph(fallbackRevisionInput).map(
        (error) => `fallback_revision:${error}`,
      ),
      ...validateJsonInputGraph(fallbackManifestInput).map(
        (error) => `fallback_manifest:${error}`,
      ),
    ];
    if (fallbackGraphErrors.length > 0) {
      return result([...errors, ...fallbackGraphErrors]);
    }
    errors.push(
      ...collectUnsafeInputErrors(fallbackRevisionInput).map(
        (error) => `fallback_revision:${error}`,
      ),
      ...collectUnsafeInputErrors(fallbackManifestInput).map(
        (error) => `fallback_manifest:${error}`,
      ),
      ...validateHarnessManifest(fallbackManifestInput).errors.map(
        (error) => `fallback_manifest:${error}`,
      ),
    );
    if (isRecord(fallbackRevisionInput)) {
      errors.push(
        ...validateRawContentHash(
          fallbackRevisionInput,
          computeHarnessRevisionContentHash as (content: never) => string,
          "fallback_revision_content_hash_mismatch",
        ),
      );
    }
    const fallbackRevisionParsed = harnessRevisionSchema.safeParse(fallbackRevisionInput);
    const fallbackManifestParsed = harnessManifestSchema.safeParse(fallbackManifestInput);
    if (!fallbackRevisionParsed.success || !fallbackManifestParsed.success) {
      errors.push("fallback_revision_or_manifest_invalid");
    } else {
      const fallbackRevision = fallbackRevisionParsed.data;
      const fallbackManifest = fallbackManifestParsed.data;
      if (fallbackRevision.status !== "seed") errors.push("fallback_revision_not_seed");
      if (fallbackRevision.manifestId !== fallbackManifest.manifestId) {
        errors.push("fallback_revision_manifest_id_mismatch");
      }
      if (fallbackRevision.manifestHash !== fallbackManifest.contentHash) {
        errors.push("fallback_revision_manifest_hash_mismatch");
      }
      if (fallbackManifest.manifestId !== manifest.manifestId) {
        errors.push("fallback_manifest_lineage_id_mismatch");
      }
      if (fallbackManifest.canonicalChainRef !== manifest.canonicalChainRef) {
        errors.push("fallback_canonical_chain_changed");
      }
      if (
        !sameStringSet(fallbackManifest.allowedSourceClasses, manifest.allowedSourceClasses)
      ) {
        errors.push("fallback_protected_source_classes_changed");
      }
      if (!sameStringSet(fallbackManifest.intendedUses, manifest.intendedUses)) {
        errors.push("fallback_protected_intended_uses_changed");
      }
      const fallbackComponents = componentMap(fallbackManifest);
      const currentComponents = componentMap(manifest);
      for (const kind of PROTECTED_HARNESS_COMPONENT_KINDS) {
        const fallbackComponent = fallbackComponents.get(kind);
        const currentComponent = currentComponents.get(kind);
        if (
          !fallbackComponent ||
          !currentComponent ||
          fallbackComponent.componentRef !== currentComponent.componentRef ||
          fallbackComponent.revisionRef !== currentComponent.revisionRef ||
          fallbackComponent.contentHash !== currentComponent.contentHash
        ) {
          errors.push(`fallback_protected_component_mismatch:${kind}`);
        }
      }
      if (revision.fallbackRevisionId !== fallbackRevision.revisionId) {
        errors.push("fallback_revision_id_mismatch");
      }
      if (revision.rollbackManifestHash !== fallbackManifest.contentHash) {
        errors.push("rollback_manifest_hash_mismatch");
      }
    }

    const current = componentMap(manifest);
    const parent = componentMap(parentManifest);
    const actualMutableChanges = new Set<string>();
    for (const kind of HARNESS_COMPONENT_KINDS) {
      const before = parent.get(kind);
      const after = current.get(kind);
      if (!before || !after) continue;
      if (before.componentRef !== after.componentRef) {
        errors.push(`component_identity_changed:${kind}`);
      }
      if (
        before.revisionRef === after.revisionRef &&
        before.contentHash !== after.contentHash
      ) {
        errors.push(`component_content_changed_without_revision:${kind}`);
      }
      const changed =
        before.revisionRef !== after.revisionRef || before.contentHash !== after.contentHash;
      if (!changed) continue;
      if (PROTECTED_HARNESS_COMPONENT_KINDS.includes(kind as never)) {
        errors.push(`protected_component_changed:${kind}`);
      } else {
        actualMutableChanges.add(kind);
      }
    }

    const declared = new Map(revision.changes.map((change) => [change.componentKind, change]));
    for (const kind of actualMutableChanges) {
      const change = declared.get(kind as never);
      if (!change) {
        errors.push(`mutable_component_change_not_declared:${kind}`);
        continue;
      }
      const before = parent.get(kind)!;
      const after = current.get(kind)!;
      if (change.fromRevisionRef !== before.revisionRef) {
        errors.push(`component_change_from_revision_mismatch:${kind}`);
      }
      if (change.toRevisionRef !== after.revisionRef) {
        errors.push(`component_change_to_revision_mismatch:${kind}`);
      }
    }
    for (const kind of declared.keys()) {
      if (!actualMutableChanges.has(kind)) {
        errors.push(`declared_component_change_not_present:${kind}`);
      }
    }
    if (revision.status === "shadow_candidate" && actualMutableChanges.size === 0) {
      errors.push("shadow_candidate_has_no_mutable_change");
    }
  }

  if (revision.status === "killed" && !revision.fallbackRevisionId) {
    errors.push("killed_revision_missing_fallback");
  }
  return result(errors);
}

export function validateHarnessShadowReceipt(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_harness_shadow_receipt"]);
  errors.push(
    ...validateRawContentHash(
      input,
      computeHarnessShadowReceiptContentHash as (content: never) => string,
      "harness_shadow_receipt_content_hash_mismatch",
    ),
  );
  const parsed = harnessShadowReceiptSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_harness_shadow_receipt"));
  if (parsed.success) {
    if (parsed.data.verdict !== "fail" && parsed.data.sourceGateCount === 0) {
      errors.push("non_fail_shadow_receipt_has_no_source_gate");
    }
    if (
      parsed.data.verdict === "shadow_pass" &&
      (parsed.data.hardGateFailures.length > 0 || !parsed.data.eligibleForOwnerReview)
    ) {
      errors.push("shadow_pass_has_failed_gate_or_missing_owner_review_eligibility");
    }
    if (parsed.data.verdict !== "shadow_pass" && parsed.data.eligibleForOwnerReview) {
      errors.push("non_passing_shadow_marked_owner_review_eligible");
    }
  }
  return result(errors);
}
