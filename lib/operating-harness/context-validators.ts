import { z } from "zod";

import type { ValidationResult } from "../expert-capability/validators";
import { collectUnsafeInputErrors } from "../operating-signal-governance/source-governance";
import {
  OPERATING_CONTEXT_JUDGEMENT_STATES,
  OPERATING_CONTEXT_PROJECTOR_REVISION,
  OPERATING_CONTEXT_STALENESS_DAYS,
  OPERATING_RELATION_EDGE_SCHEMA_VERSION,
  OPERATING_RELATION_KINDS,
  TEMPORAL_OPERATING_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
  computeOperatingRelationEdgeContentHash,
  computeTemporalOperatingContextSnapshotContentHash,
  contextSnapshotIdFromReplayRootHash,
  operatingRelationIdFromContentHash,
  type OperatingRelationEdgeContent,
  type TemporalOperatingContextSnapshotContent,
} from "./context-contracts";
import { HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES } from "./harness-contracts";
import { validateJsonInputGraph } from "./validators";

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const safeTokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9._-]{0,127}$/i);
const sha256Schema = z.string().regex(SHA256_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });

const recordBindingSchema = z
  .object({ ref: safeRefSchema, contentHash: sha256Schema })
  .strict();

const policyBindingSchema = (componentKind: string) =>
  z
    .object({
      componentKind: z.literal(componentKind),
      componentRef: safeRefSchema,
      revisionRef: safeRefSchema,
      contentHash: sha256Schema,
    })
    .strict();

const objectSummarySchema = z
  .object({
    businessObjectAliasRef: safeRefSchema,
    objectKind: safeTokenSchema,
    signalEventRefs: z.array(safeRefSchema).min(1),
    evidenceRefs: z.array(safeRefSchema).min(1),
    judgementPacketRefs: z.array(safeRefSchema),
    signalFamilies: z.array(safeTokenSchema).min(1),
    dispositions: z.array(safeTokenSchema),
    firstObservedAt: timestampSchema,
    latestObservedAt: timestampSchema,
    staleness: z.enum(["current", "stale"]),
    expiredEvidenceCount: z.number().int().min(0),
    judgementState: z.enum(OPERATING_CONTEXT_JUDGEMENT_STATES),
  })
  .strict();

export const operatingRelationEdgeSchema = z
  .object({
    schemaVersion: z.literal(OPERATING_RELATION_EDGE_SCHEMA_VERSION),
    relationId: safeRefSchema,
    relationKind: z.enum(OPERATING_RELATION_KINDS),
    fromBusinessObjectAliasRef: safeRefSchema,
    toBusinessObjectAliasRef: safeRefSchema,
    supportingSignalEventRefs: z.array(safeRefSchema).min(1),
    supportingEvidenceRefs: z.array(safeRefSchema).min(1),
    contradictingEvidenceRefs: z.array(safeRefSchema),
    validFrom: timestampSchema,
    validTo: timestampSchema,
    provenance: z
      .object({
        method: z.literal("deterministic_rule"),
        ruleRef: safeRefSchema,
        confidenceScore: z.null(),
        calibrationRef: z.null(),
      })
      .strict(),
    contentHash: sha256Schema,
  })
  .strict();

export const temporalOperatingContextSnapshotSchema = z
  .object({
    schemaVersion: z.literal(
      TEMPORAL_OPERATING_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
    ),
    snapshotId: safeRefSchema,
    workspaceAlias: safeRefSchema,
    tenantScopeRef: safeRefSchema,
    windowStart: timestampSchema,
    windowEnd: timestampSchema,
    asOf: timestampSchema,
    projector: z
      .object({
        revisionRef: z.literal(OPERATING_CONTEXT_PROJECTOR_REVISION),
        stalenessDays: z.literal(OPERATING_CONTEXT_STALENESS_DAYS),
      })
      .strict(),
    harnessBinding: z
      .object({
        manifestId: safeRefSchema,
        manifestHash: sha256Schema,
        revisionId: safeRefSchema,
        revisionHash: sha256Schema,
      })
      .strict(),
    policyBindings: z
      .object({
        contextPolicy: policyBindingSchema("context_policy"),
        sourceGovernancePolicy: policyBindingSchema("source_governance_policy"),
        permissionPolicy: policyBindingSchema("permission_policy"),
      })
      .strict(),
    canonicalBindings: z
      .object({
        signalEvents: z.array(recordBindingSchema).min(1),
        evidenceRefs: z.array(recordBindingSchema).min(1),
        businessObjectAliases: z.array(recordBindingSchema).min(1),
        judgementPackets: z.array(recordBindingSchema),
      })
      .strict(),
    sourceReceipts: z
      .array(
        z
          .object({
            signalId: safeRefSchema,
            sourceClass: z.enum(HARNESS_MANIFEST_ALLOWED_SOURCE_CLASSES),
            sourceBindingHash: sha256Schema,
            promotionId: safeRefSchema.nullable(),
          })
          .strict(),
      )
      .min(1),
    objectSummaries: z.array(objectSummarySchema).min(1),
    relations: z.array(operatingRelationEdgeSchema),
    derivedOnly: z.literal(true),
    canonicalStateAuthority: z.literal(false),
    writebackAllowed: z.literal(false),
    actionAuthority: z.literal("none"),
    modelCallsUsed: z.literal(false),
    replayRootHash: sha256Schema,
    contentHash: sha256Schema,
  })
  .strict();

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseErrors(
  parse: z.ZodSafeParseResult<unknown>,
  prefix: string,
): string[] {
  if (parse.success) return [];
  return parse.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${prefix}:${path}:${issue.code}`;
  });
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

function isSorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      index === 0 || values[index - 1].localeCompare(value) <= 0,
  );
}

export function validateTemporalOperatingContextSnapshot(
  input: unknown,
): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_context_snapshot"]);

  const { contentHash, ...content } = input;
  try {
    if (
      typeof contentHash !== "string" ||
      contentHash !==
        computeTemporalOperatingContextSnapshotContentHash(
          content as TemporalOperatingContextSnapshotContent,
        )
    ) {
      errors.push("context_snapshot_content_hash_mismatch");
    }
  } catch {
    errors.push("context_snapshot_content_not_hashable");
  }

  const parsed = temporalOperatingContextSnapshotSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_context_snapshot"));
  if (!parsed.success) return result(errors);

  const snapshot = parsed.data;
  if (
    snapshot.snapshotId !==
    contextSnapshotIdFromReplayRootHash(snapshot.replayRootHash)
  ) {
    errors.push("context_snapshot_id_replay_root_mismatch");
  }
  if (Date.parse(snapshot.windowStart) > Date.parse(snapshot.windowEnd)) {
    errors.push("context_snapshot_invalid_window");
  }
  if (Date.parse(snapshot.asOf) < Date.parse(snapshot.windowEnd)) {
    errors.push("context_snapshot_as_of_before_window_end");
  }

  const bindingGroups = Object.entries(snapshot.canonicalBindings) as Array<
    [string, Array<{ ref: string; contentHash: string }>]
  >;
  for (const [name, bindings] of bindingGroups) {
    for (const duplicate of duplicates(
      bindings.map((binding) => binding.ref),
    )) {
      errors.push(`duplicate_context_binding:${name}:${duplicate}`);
    }
    if (!isSorted(bindings.map((binding) => binding.ref))) {
      errors.push(`unsorted_context_binding:${name}`);
    }
  }

  const signalRefs = new Set(
    snapshot.canonicalBindings.signalEvents.map(({ ref }) => ref),
  );
  const evidenceRefs = new Set(
    snapshot.canonicalBindings.evidenceRefs.map(({ ref }) => ref),
  );
  const objectRefs = new Set(
    snapshot.canonicalBindings.businessObjectAliases.map(({ ref }) => ref),
  );
  const judgementRefs = new Set(
    snapshot.canonicalBindings.judgementPackets.map(({ ref }) => ref),
  );

  for (const duplicate of duplicates(
    snapshot.sourceReceipts.map(({ signalId }) => signalId),
  )) {
    errors.push(`duplicate_context_source_receipt:${duplicate}`);
  }
  for (const receipt of snapshot.sourceReceipts) {
    if (!signalRefs.has(receipt.signalId)) {
      errors.push(
        `context_source_receipt_signal_not_bound:${receipt.signalId}`,
      );
    }
  }
  const sourceReceiptSignalRefs = new Set(
    snapshot.sourceReceipts.map(({ signalId }) => signalId),
  );
  for (const signalRef of signalRefs) {
    if (!sourceReceiptSignalRefs.has(signalRef)) {
      errors.push(`context_source_receipt_missing:${signalRef}`);
    }
  }
  if (!isSorted(snapshot.sourceReceipts.map(({ signalId }) => signalId))) {
    errors.push("unsorted_context_source_receipts");
  }

  for (const duplicate of duplicates(
    snapshot.objectSummaries.map(
      ({ businessObjectAliasRef }) => businessObjectAliasRef,
    ),
  )) {
    errors.push(`duplicate_context_object_summary:${duplicate}`);
  }
  if (
    !isSorted(
      snapshot.objectSummaries.map(
        ({ businessObjectAliasRef }) => businessObjectAliasRef,
      ),
    )
  ) {
    errors.push("unsorted_context_object_summaries");
  }
  const summaryByObjectRef = new Map(
    snapshot.objectSummaries.map((summary) => [
      summary.businessObjectAliasRef,
      summary,
    ]),
  );
  for (const objectRef of objectRefs) {
    if (!summaryByObjectRef.has(objectRef)) {
      errors.push(`context_object_summary_missing:${objectRef}`);
    }
  }
  const summarySignalCounts = new Map<string, number>();
  const summaryJudgementCounts = new Map<string, number>();
  for (const summary of snapshot.objectSummaries) {
    if (!objectRefs.has(summary.businessObjectAliasRef)) {
      errors.push(
        `context_summary_object_not_bound:${summary.businessObjectAliasRef}`,
      );
    }
    for (const ref of summary.signalEventRefs) {
      if (!signalRefs.has(ref))
        errors.push(`context_summary_signal_not_bound:${ref}`);
      summarySignalCounts.set(ref, (summarySignalCounts.get(ref) ?? 0) + 1);
    }
    for (const ref of summary.evidenceRefs) {
      if (!evidenceRefs.has(ref))
        errors.push(`context_summary_evidence_not_bound:${ref}`);
    }
    for (const ref of summary.judgementPacketRefs) {
      if (!judgementRefs.has(ref))
        errors.push(`context_summary_judgement_not_bound:${ref}`);
      summaryJudgementCounts.set(
        ref,
        (summaryJudgementCounts.get(ref) ?? 0) + 1,
      );
    }
    if (
      Date.parse(summary.firstObservedAt) > Date.parse(summary.latestObservedAt)
    ) {
      errors.push(
        `context_summary_observation_order_invalid:${summary.businessObjectAliasRef}`,
      );
    }
    const expectedJudgementState =
      summary.dispositions.length === 0
        ? "unreviewed"
        : summary.dispositions.length === 1
          ? "single_disposition"
          : "conflicting_dispositions";
    if (summary.judgementState !== expectedJudgementState) {
      errors.push(
        `context_summary_judgement_state_mismatch:${summary.businessObjectAliasRef}`,
      );
    }
    const staleAfter =
      Date.parse(summary.latestObservedAt) +
      OPERATING_CONTEXT_STALENESS_DAYS * 24 * 60 * 60 * 1000;
    const expectedStaleness =
      Date.parse(snapshot.asOf) > staleAfter ? "stale" : "current";
    if (summary.staleness !== expectedStaleness) {
      errors.push(
        `context_summary_staleness_mismatch:${summary.businessObjectAliasRef}`,
      );
    }
  }
  for (const signalRef of signalRefs) {
    if ((summarySignalCounts.get(signalRef) ?? 0) !== 1) {
      errors.push(`context_summary_signal_cardinality_invalid:${signalRef}`);
    }
  }
  for (const judgementRef of judgementRefs) {
    if ((summaryJudgementCounts.get(judgementRef) ?? 0) !== 1) {
      errors.push(
        `context_summary_judgement_cardinality_invalid:${judgementRef}`,
      );
    }
  }

  for (const duplicate of duplicates(
    snapshot.relations.map(({ relationId }) => relationId),
  )) {
    errors.push(`duplicate_context_relation:${duplicate}`);
  }
  if (!isSorted(snapshot.relations.map(({ relationId }) => relationId))) {
    errors.push("unsorted_context_relations");
  }
  for (const edge of snapshot.relations) {
    const { relationId, contentHash: edgeHash, ...edgeContent } = edge;
    const expectedHash = computeOperatingRelationEdgeContentHash(
      edgeContent as OperatingRelationEdgeContent,
    );
    if (edgeHash !== expectedHash) {
      errors.push(`context_relation_content_hash_mismatch:${relationId}`);
    }
    if (relationId !== operatingRelationIdFromContentHash(expectedHash)) {
      errors.push(`context_relation_id_content_hash_mismatch:${relationId}`);
    }
    if (
      !objectRefs.has(edge.fromBusinessObjectAliasRef) ||
      !objectRefs.has(edge.toBusinessObjectAliasRef)
    ) {
      errors.push(`context_relation_object_not_bound:${relationId}`);
    }
    if (edge.fromBusinessObjectAliasRef === edge.toBusinessObjectAliasRef) {
      errors.push(`context_relation_self_edge_forbidden:${relationId}`);
    }
    for (const ref of edge.supportingSignalEventRefs) {
      if (!signalRefs.has(ref))
        errors.push(`context_relation_signal_not_bound:${relationId}:${ref}`);
    }
    for (const ref of [
      ...edge.supportingEvidenceRefs,
      ...edge.contradictingEvidenceRefs,
    ]) {
      if (!evidenceRefs.has(ref)) {
        errors.push(`context_relation_evidence_not_bound:${relationId}:${ref}`);
      }
    }
    if (Date.parse(edge.validFrom) > Date.parse(edge.validTo)) {
      errors.push(`context_relation_temporal_order_invalid:${relationId}`);
    }
    const fromSummary = summaryByObjectRef.get(edge.fromBusinessObjectAliasRef);
    const toSummary = summaryByObjectRef.get(edge.toBusinessObjectAliasRef);
    if (fromSummary && toSummary) {
      const endpointSignalRefs = new Set([
        ...fromSummary.signalEventRefs,
        ...toSummary.signalEventRefs,
      ]);
      for (const ref of edge.supportingSignalEventRefs) {
        if (!endpointSignalRefs.has(ref)) {
          errors.push(
            `context_relation_signal_not_on_endpoint:${relationId}:${ref}`,
          );
        }
      }
      if (
        !edge.supportingSignalEventRefs.some((ref) =>
          fromSummary.signalEventRefs.includes(ref),
        ) ||
        !edge.supportingSignalEventRefs.some((ref) =>
          toSummary.signalEventRefs.includes(ref),
        )
      ) {
        errors.push(`context_relation_missing_endpoint_signal:${relationId}`);
      }
      const endpointEvidenceRefs = new Set([
        ...fromSummary.evidenceRefs,
        ...toSummary.evidenceRefs,
      ]);
      for (const ref of [
        ...edge.supportingEvidenceRefs,
        ...edge.contradictingEvidenceRefs,
      ]) {
        if (!endpointEvidenceRefs.has(ref)) {
          errors.push(
            `context_relation_evidence_not_on_endpoint:${relationId}:${ref}`,
          );
        }
      }
      if (edge.relationKind === "shared_evidence") {
        const sharedEvidenceRefs = new Set(
          fromSummary.evidenceRefs.filter((ref) =>
            toSummary.evidenceRefs.includes(ref),
          ),
        );
        if (
          edge.supportingEvidenceRefs.some(
            (ref) => !sharedEvidenceRefs.has(ref),
          )
        ) {
          errors.push(
            `context_shared_evidence_not_supported_by_endpoint_intersection:${relationId}`,
          );
        }
      }
    }
  }

  return result(errors);
}
