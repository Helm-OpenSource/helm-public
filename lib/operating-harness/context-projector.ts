import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { ValidationResult } from "../expert-capability/validators";
import {
  collectUnsafeInputErrors,
  validateOperatingSignalImprovementGate,
} from "../operating-signal-governance/source-governance";
import {
  OPERATING_CONTEXT_PROJECTOR_REVISION,
  OPERATING_CONTEXT_STALENESS_DAYS,
  OPERATING_RELATION_EDGE_SCHEMA_VERSION,
  TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION,
  TEMPORAL_OPERATING_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
  computeOperatingContextSourceBindingHash,
  computeOperatingRelationEdgeContentHash,
  computeTemporalOperatingContextSnapshotContentHash,
  contextSnapshotIdFromReplayRootHash,
  operatingRelationIdFromContentHash,
  type OperatingContextObjectSummary,
  type OperatingContextPolicyBindings,
  type OperatingContextRecordBinding,
  type OperatingContextSourceReceipt,
  type OperatingRelationEdge,
  type OperatingRelationEdgeContent,
  type TemporalOperatingContextProjectionInput,
  type TemporalOperatingContextSnapshot,
} from "./context-contracts";
import {
  computeEvidenceBindingRootHash,
  type BusinessObjectAlias,
  type EvidenceRef,
  type SignalEvent,
} from "./contracts";
import { validateTemporalOperatingContextSnapshot } from "./context-validators";
import {
  computeHarnessRevisionContentHash,
  type HarnessComponentBinding,
  type HarnessRevisionContent,
} from "./harness-contracts";
import {
  harnessManifestSchema,
  harnessRevisionSchema,
  validateHarnessManifest,
} from "./harness-validators";
import {
  businessObjectAliasSchema,
  evidenceRefSchema,
  judgementPacketSchema,
  signalEventSchema,
  validateBusinessObjectAlias,
  validateEvidenceRef,
  validateJsonInputGraph,
  validateOperatingHarnessJudgementPacket,
  validateSignalEvent,
} from "./validators";

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });
const MAX_CONTEXT_SIGNALS = 1_000;
const MAX_CONTEXT_EVIDENCE_REFS = 1_000;
const MAX_CONTEXT_BUSINESS_OBJECTS = 100;
const MAX_CONTEXT_JUDGEMENT_PACKETS = 1_000;

const sourceEnvelopeShapeSchema = z
  .object({
    signalId: safeRefSchema,
    sourceClass: z.string().min(1),
    allowedUses: z.array(z.string()),
  })
  .passthrough();

const projectionInputShapeSchema = z
  .object({
    schemaVersion: z.literal(TEMPORAL_OPERATING_CONTEXT_INPUT_SCHEMA_VERSION),
    workspaceAlias: safeRefSchema,
    tenantScopeRef: safeRefSchema,
    windowStart: timestampSchema,
    windowEnd: timestampSchema,
    asOf: timestampSchema,
    manifest: harnessManifestSchema,
    revision: harnessRevisionSchema,
    signalEvents: z.array(signalEventSchema).min(1).max(MAX_CONTEXT_SIGNALS),
    evidenceRefs: z
      .array(evidenceRefSchema)
      .min(1)
      .max(MAX_CONTEXT_EVIDENCE_REFS),
    businessObjectAliases: z
      .array(businessObjectAliasSchema)
      .min(1)
      .max(MAX_CONTEXT_BUSINESS_OBJECTS),
    judgementPackets: z
      .array(judgementPacketSchema)
      .max(MAX_CONTEXT_JUDGEMENT_PACKETS),
    sourceBindings: z
      .array(
        z
          .object({
            source: sourceEnvelopeShapeSchema,
            promotion: z.unknown().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_CONTEXT_SIGNALS),
  })
  .strict();

export type TemporalOperatingContextProjectionResult = {
  ok: boolean;
  errors: string[];
  snapshot: TemporalOperatingContextSnapshot | null;
};

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

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function byRef<T>(values: readonly T[], getRef: (value: T) => string): T[] {
  return [...values].sort((left, right) =>
    getRef(left).localeCompare(getRef(right)),
  );
}

function binding(
  ref: string,
  contentHash: string,
): OperatingContextRecordBinding {
  return { ref, contentHash };
}

function component(
  manifestComponents: readonly HarnessComponentBinding[],
  componentKind: HarnessComponentBinding["componentKind"],
): HarnessComponentBinding {
  const found = manifestComponents.find(
    (item) => item.componentKind === componentKind,
  );
  if (!found)
    throw new Error(`missing validated harness component: ${componentKind}`);
  return { ...found };
}

function signalEvidenceRefs(
  signals: readonly SignalEvent[],
  signalIds: ReadonlySet<string>,
): string[] {
  return sortedUnique(
    signals
      .filter((signal) => signalIds.has(signal.signalId))
      .flatMap((signal) => signal.evidenceRefs),
  );
}

export function validateTemporalOperatingContextProjectionInput(
  input: unknown,
): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input))
    return result([...errors, "invalid_context_projection_input"]);

  const parsedShape = projectionInputShapeSchema.safeParse(input);
  errors.push(...parseErrors(parsedShape, "invalid_context_projection_input"));
  if (!parsedShape.success) return result(errors);
  const typed = input as unknown as TemporalOperatingContextProjectionInput;

  if (Date.parse(typed.windowStart) > Date.parse(typed.windowEnd)) {
    errors.push("invalid_context_window");
  }
  if (Date.parse(typed.asOf) < Date.parse(typed.windowEnd)) {
    errors.push("context_as_of_before_window_end");
  }

  errors.push(...validateHarnessManifest(typed.manifest).errors);
  const revisionParsed = harnessRevisionSchema.safeParse(typed.revision);
  errors.push(
    ...parseErrors(revisionParsed, "invalid_context_harness_revision"),
  );
  if (revisionParsed.success) {
    const { contentHash, ...revisionContent } = revisionParsed.data;
    if (
      contentHash !==
      computeHarnessRevisionContentHash(
        revisionContent as HarnessRevisionContent,
      )
    ) {
      errors.push("context_harness_revision_content_hash_mismatch");
    }
    if (revisionParsed.data.manifestId !== typed.manifest.manifestId) {
      errors.push("context_harness_revision_manifest_id_mismatch");
    }
    if (revisionParsed.data.manifestHash !== typed.manifest.contentHash) {
      errors.push("context_harness_revision_manifest_hash_mismatch");
    }
    if (revisionParsed.data.status === "killed") {
      errors.push("killed_harness_revision_cannot_project_context");
    }
  }

  const signalIds = typed.signalEvents.map((signal) => signal.signalId);
  const evidenceIds = typed.evidenceRefs.map(
    (evidence) => evidence.evidenceRef,
  );
  const aliasIds = typed.businessObjectAliases.map((alias) => alias.aliasRef);
  const packetIds = typed.judgementPackets.map((packet) => packet.packetId);
  for (const duplicate of duplicates(signalIds))
    errors.push(`duplicate_context_signal:${duplicate}`);
  for (const duplicate of duplicates(evidenceIds)) {
    errors.push(`duplicate_context_evidence:${duplicate}`);
  }
  for (const duplicate of duplicates(aliasIds))
    errors.push(`duplicate_context_alias:${duplicate}`);
  for (const duplicate of duplicates(packetIds))
    errors.push(`duplicate_context_packet:${duplicate}`);

  const evidenceById = new Map(
    typed.evidenceRefs.map((item) => [item.evidenceRef, item]),
  );
  const aliasById = new Map(
    typed.businessObjectAliases.map((item) => [item.aliasRef, item]),
  );
  const signalById = new Map(
    typed.signalEvents.map((item) => [item.signalId, item]),
  );

  for (const evidence of typed.evidenceRefs) {
    errors.push(...validateEvidenceRef(evidence).errors);
    if (evidence.tenantScopeRef !== typed.tenantScopeRef) {
      errors.push(`evidence_tenant_scope_mismatch:${evidence.evidenceRef}`);
    }
    if (Date.parse(evidence.capturedAt) > Date.parse(typed.asOf)) {
      errors.push(
        `evidence_captured_after_context_as_of:${evidence.evidenceRef}`,
      );
    }
    if (
      evidence.expiresAt &&
      Date.parse(evidence.expiresAt) < Date.parse(evidence.capturedAt)
    ) {
      errors.push(`evidence_expires_before_capture:${evidence.evidenceRef}`);
    }
  }
  for (const alias of typed.businessObjectAliases) {
    errors.push(...validateBusinessObjectAlias(alias).errors);
    if (alias.tenantScopeRef !== typed.tenantScopeRef) {
      errors.push(`business_object_tenant_scope_mismatch:${alias.aliasRef}`);
    }
    if (Date.parse(alias.createdAt) > Date.parse(typed.asOf)) {
      errors.push(
        `business_object_created_after_context_as_of:${alias.aliasRef}`,
      );
    }
  }
  for (const signal of typed.signalEvents) {
    errors.push(...validateSignalEvent(signal).errors);
    if (signal.tenantScopeRef !== typed.tenantScopeRef) {
      errors.push(`signal_tenant_scope_mismatch:${signal.signalId}`);
    }
    const observedAt = Date.parse(signal.observedAt);
    if (
      observedAt < Date.parse(typed.windowStart) ||
      observedAt > Date.parse(typed.windowEnd)
    ) {
      errors.push(`signal_outside_context_window:${signal.signalId}`);
    }
    if (Date.parse(signal.capturedAt) < observedAt) {
      errors.push(`signal_captured_before_observed:${signal.signalId}`);
    }
    if (Date.parse(signal.capturedAt) > Date.parse(typed.asOf)) {
      errors.push(`signal_captured_after_context_as_of:${signal.signalId}`);
    }
    if (!signal.businessObjectAliasRef) {
      errors.push(`signal_missing_business_object_alias:${signal.signalId}`);
    } else if (!aliasById.has(signal.businessObjectAliasRef)) {
      errors.push(
        `signal_business_object_alias_not_bound:${signal.signalId}:${signal.businessObjectAliasRef}`,
      );
    }
    const boundEvidence = signal.evidenceRefs
      .map((ref) => evidenceById.get(ref))
      .filter((value): value is EvidenceRef => Boolean(value));
    for (const ref of signal.evidenceRefs) {
      if (!evidenceById.has(ref)) {
        errors.push(`signal_evidence_not_bound:${signal.signalId}:${ref}`);
      }
    }
    if (
      boundEvidence.length !== signal.evidenceRefs.length ||
      computeEvidenceBindingRootHash(boundEvidence) !== signal.evidenceRootHash
    ) {
      errors.push(`signal_evidence_root_hash_mismatch:${signal.signalId}`);
    }
  }

  const attachedEvidence = new Set(
    typed.signalEvents.flatMap((signal) => signal.evidenceRefs),
  );
  for (const evidence of typed.evidenceRefs) {
    if (!attachedEvidence.has(evidence.evidenceRef)) {
      errors.push(`orphan_context_evidence:${evidence.evidenceRef}`);
    }
  }
  const attachedAliases = new Set(
    typed.signalEvents
      .map((signal) => signal.businessObjectAliasRef)
      .filter((value): value is string => Boolean(value)),
  );
  for (const alias of typed.businessObjectAliases) {
    if (!attachedAliases.has(alias.aliasRef)) {
      errors.push(`orphan_context_business_object_alias:${alias.aliasRef}`);
    }
  }

  for (const packet of typed.judgementPackets) {
    errors.push(...validateOperatingHarnessJudgementPacket(packet).errors);
    if (!aliasById.has(packet.businessObjectAliasRef)) {
      errors.push(
        `judgement_business_object_alias_not_bound:${packet.packetId}:${packet.businessObjectAliasRef}`,
      );
    }
    const packetSignalIds = new Set(packet.signalEventRefs);
    for (const signalRef of packet.signalEventRefs) {
      const signal = signalById.get(signalRef);
      if (!signal) {
        errors.push(
          `judgement_signal_not_bound:${packet.packetId}:${signalRef}`,
        );
      } else if (
        signal.businessObjectAliasRef !== packet.businessObjectAliasRef
      ) {
        errors.push(
          `judgement_signal_object_mismatch:${packet.packetId}:${signalRef}`,
        );
      } else if (Date.parse(packet.createdAt) < Date.parse(signal.observedAt)) {
        errors.push(
          `judgement_created_before_signal:${packet.packetId}:${signalRef}`,
        );
      }
    }
    const allowedEvidence = new Set(
      signalEvidenceRefs(typed.signalEvents, packetSignalIds),
    );
    for (const evidenceRef of packet.evidenceRefs) {
      if (!evidenceById.has(evidenceRef) || !allowedEvidence.has(evidenceRef)) {
        errors.push(
          `judgement_evidence_not_bound:${packet.packetId}:${evidenceRef}`,
        );
      }
    }
    if (Date.parse(packet.createdAt) > Date.parse(typed.asOf)) {
      errors.push(`judgement_created_after_context_as_of:${packet.packetId}`);
    }
  }

  const sourceSignalIds = typed.sourceBindings.map(
    (item) => item.source.signalId,
  );
  for (const duplicate of duplicates(sourceSignalIds)) {
    errors.push(`duplicate_context_source_binding:${duplicate}`);
  }
  const sourceSignalIdSet = new Set(sourceSignalIds);
  for (const signalId of signalIds) {
    if (!sourceSignalIdSet.has(signalId)) {
      errors.push(`missing_context_source_binding:${signalId}`);
    }
  }
  for (const sourceBinding of typed.sourceBindings) {
    if (!signalById.has(sourceBinding.source.signalId)) {
      errors.push(
        `orphan_context_source_binding:${sourceBinding.source.signalId}`,
      );
    }
    for (const gateError of validateOperatingSignalImprovementGate(
      sourceBinding,
    ).errors) {
      errors.push(`source_gate:${gateError}`);
    }
    if (
      sourceBinding.source.sourceClass === "synthetic_public" &&
      sourceBinding.promotion !== null &&
      sourceBinding.promotion !== undefined
    ) {
      errors.push(
        `unexpected_eval_case_promotion:synthetic_public:${sourceBinding.source.signalId}`,
      );
    }
    if (
      !typed.manifest.allowedSourceClasses.includes(
        sourceBinding.source.sourceClass as never,
      )
    ) {
      errors.push(
        `source_class_not_allowed_by_manifest:${sourceBinding.source.sourceClass}`,
      );
    }
    const allowedByUse = sourceBinding.source.allowedUses.some((use) =>
      typed.manifest.intendedUses.includes(use as never),
    );
    if (!allowedByUse) {
      errors.push(
        `source_use_not_allowed_by_manifest:${sourceBinding.source.signalId}`,
      );
    }
  }

  return result(errors);
}

function policyBindings(
  input: TemporalOperatingContextProjectionInput,
): OperatingContextPolicyBindings {
  return {
    contextPolicy: component(input.manifest.components, "context_policy"),
    sourceGovernancePolicy: component(
      input.manifest.components,
      "source_governance_policy",
    ),
    permissionPolicy: component(input.manifest.components, "permission_policy"),
  };
}

function canonicalBindings(input: TemporalOperatingContextProjectionInput) {
  return {
    signalEvents: byRef(input.signalEvents, (item) => item.signalId).map(
      (item) => binding(item.signalId, item.contentHash),
    ),
    evidenceRefs: byRef(input.evidenceRefs, (item) => item.evidenceRef).map(
      (item) => binding(item.evidenceRef, item.contentHash),
    ),
    businessObjectAliases: byRef(
      input.businessObjectAliases,
      (item) => item.aliasRef,
    ).map((item) => binding(item.aliasRef, item.contentHash)),
    judgementPackets: byRef(
      input.judgementPackets,
      (item) => item.packetId,
    ).map((item) => binding(item.packetId, item.contentHash)),
  };
}

function sourceReceipts(
  input: TemporalOperatingContextProjectionInput,
): OperatingContextSourceReceipt[] {
  return byRef(input.sourceBindings, (item) => item.source.signalId).map(
    (item) => ({
      signalId: item.source.signalId,
      sourceClass: item.source.sourceClass,
      sourceBindingHash: computeOperatingContextSourceBindingHash(item),
      promotionId: item.promotion?.promotionId ?? null,
    }),
  );
}

export function computeTemporalOperatingContextReplayRootHash(
  input: TemporalOperatingContextProjectionInput,
): string {
  return sha256(
    canonicalJson({
      schemaVersion: input.schemaVersion,
      workspaceAlias: input.workspaceAlias,
      tenantScopeRef: input.tenantScopeRef,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      asOf: input.asOf,
      projector: {
        revisionRef: OPERATING_CONTEXT_PROJECTOR_REVISION,
        stalenessDays: OPERATING_CONTEXT_STALENESS_DAYS,
      },
      harnessBinding: {
        manifestId: input.manifest.manifestId,
        manifestHash: input.manifest.contentHash,
        revisionId: input.revision.revisionId,
        revisionHash: input.revision.contentHash,
      },
      policyBindings: policyBindings(input),
      canonicalBindings: canonicalBindings(input),
      sourceReceipts: sourceReceipts(input),
    }),
  );
}

function objectSummaries(
  input: TemporalOperatingContextProjectionInput,
): OperatingContextObjectSummary[] {
  const evidenceById = new Map(
    input.evidenceRefs.map((item) => [item.evidenceRef, item]),
  );
  return byRef(input.businessObjectAliases, (alias) => alias.aliasRef).map(
    (alias) => {
      const signals = byRef(
        input.signalEvents.filter(
          (signal) => signal.businessObjectAliasRef === alias.aliasRef,
        ),
        (signal) => signal.signalId,
      );
      const packets = byRef(
        input.judgementPackets.filter(
          (packet) => packet.businessObjectAliasRef === alias.aliasRef,
        ),
        (packet) => packet.packetId,
      );
      const evidenceRefs = sortedUnique(
        signals.flatMap((signal) => signal.evidenceRefs),
      );
      const observedTimes = [...signals]
        .sort(
          (left, right) =>
            Date.parse(left.observedAt) - Date.parse(right.observedAt) ||
            left.signalId.localeCompare(right.signalId),
        )
        .map((signal) => signal.observedAt);
      const dispositions = sortedUnique(
        packets.map((packet) => packet.disposition),
      );
      const latestObservedAt = observedTimes.at(-1) as string;
      const staleAfter =
        Date.parse(latestObservedAt) +
        OPERATING_CONTEXT_STALENESS_DAYS * 24 * 60 * 60 * 1000;
      return {
        businessObjectAliasRef: alias.aliasRef,
        objectKind: alias.objectKind,
        signalEventRefs: signals.map((signal) => signal.signalId),
        evidenceRefs,
        judgementPacketRefs: packets.map((packet) => packet.packetId),
        signalFamilies: sortedUnique(
          signals.map((signal) => signal.signalFamily),
        ),
        dispositions,
        firstObservedAt: observedTimes[0],
        latestObservedAt,
        staleness: Date.parse(input.asOf) > staleAfter ? "stale" : "current",
        expiredEvidenceCount: evidenceRefs.filter((ref) => {
          const expiresAt = evidenceById.get(ref)?.expiresAt;
          return Boolean(
            expiresAt && Date.parse(expiresAt) <= Date.parse(input.asOf),
          );
        }).length,
        judgementState:
          dispositions.length === 0
            ? "unreviewed"
            : dispositions.length === 1
              ? "single_disposition"
              : "conflicting_dispositions",
      };
    },
  );
}

function edge(content: OperatingRelationEdgeContent): OperatingRelationEdge {
  const contentHash = computeOperatingRelationEdgeContentHash(content);
  return {
    ...content,
    relationId: operatingRelationIdFromContentHash(contentHash),
    contentHash,
  };
}

function buildPairEdge(input: {
  relationKind: "shared_evidence" | "shared_source_object";
  left: BusinessObjectAlias;
  right: BusinessObjectAlias;
  supportingSignals: readonly SignalEvent[];
  supportingEvidenceRefs: string[];
}): OperatingRelationEdge {
  const [from, to] = [input.left.aliasRef, input.right.aliasRef].sort();
  const supportingSignals = byRef(
    input.supportingSignals,
    (signal) => signal.signalId,
  );
  const times = [...supportingSignals]
    .sort(
      (left, right) =>
        Date.parse(left.observedAt) - Date.parse(right.observedAt) ||
        left.signalId.localeCompare(right.signalId),
    )
    .map((signal) => signal.observedAt);
  return edge({
    schemaVersion: OPERATING_RELATION_EDGE_SCHEMA_VERSION,
    relationKind: input.relationKind,
    fromBusinessObjectAliasRef: from,
    toBusinessObjectAliasRef: to,
    supportingSignalEventRefs: supportingSignals.map(
      (signal) => signal.signalId,
    ),
    supportingEvidenceRefs: sortedUnique(input.supportingEvidenceRefs),
    contradictingEvidenceRefs: [],
    validFrom: times[0],
    validTo: times.at(-1) as string,
    provenance: {
      method: "deterministic_rule",
      ruleRef: `rule:${input.relationKind}:v1`,
      confidenceScore: null,
      calibrationRef: null,
    },
  });
}

function relationEdges(
  input: TemporalOperatingContextProjectionInput,
): OperatingRelationEdge[] {
  const edges: OperatingRelationEdge[] = [];
  const aliases = byRef(input.businessObjectAliases, (alias) => alias.aliasRef);
  const signalsByAlias = new Map<string, SignalEvent[]>();
  for (const signal of input.signalEvents) {
    if (!signal.businessObjectAliasRef) continue;
    const signals = signalsByAlias.get(signal.businessObjectAliasRef) ?? [];
    signals.push(signal);
    signalsByAlias.set(signal.businessObjectAliasRef, signals);
  }
  const evidenceByAlias = new Map<string, string[]>();
  for (const alias of aliases) {
    evidenceByAlias.set(
      alias.aliasRef,
      sortedUnique(
        (signalsByAlias.get(alias.aliasRef) ?? []).flatMap(
          (signal) => signal.evidenceRefs,
        ),
      ),
    );
  }
  for (let leftIndex = 0; leftIndex < aliases.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < aliases.length;
      rightIndex += 1
    ) {
      const left = aliases[leftIndex];
      const right = aliases[rightIndex];
      const leftSignals = signalsByAlias.get(left.aliasRef) ?? [];
      const rightSignals = signalsByAlias.get(right.aliasRef) ?? [];
      const pairSignals = [...leftSignals, ...rightSignals];
      const leftEvidence = evidenceByAlias.get(left.aliasRef) ?? [];
      const rightEvidence = evidenceByAlias.get(right.aliasRef) ?? [];
      const sharedEvidence = leftEvidence.filter((ref) =>
        rightEvidence.includes(ref),
      );
      if (sharedEvidence.length > 0) {
        const supportingSignals = pairSignals.filter((signal) =>
          signal.evidenceRefs.some((ref) => sharedEvidence.includes(ref)),
        );
        edges.push(
          buildPairEdge({
            relationKind: "shared_evidence",
            left,
            right,
            supportingSignals,
            supportingEvidenceRefs: sharedEvidence,
          }),
        );
      }
      const sharedSourceObjects = left.sourceObjectAliasRefs.filter((ref) =>
        right.sourceObjectAliasRefs.includes(ref),
      );
      if (sharedSourceObjects.length > 0) {
        edges.push(
          buildPairEdge({
            relationKind: "shared_source_object",
            left,
            right,
            supportingSignals: pairSignals,
            supportingEvidenceRefs:
              sharedEvidence.length > 0
                ? sharedEvidence
                : sortedUnique([...leftEvidence, ...rightEvidence]),
          }),
        );
      }
    }
  }

  const signalsBySource = new Map<string, SignalEvent[]>();
  for (const signal of input.signalEvents) {
    const group = signalsBySource.get(signal.sourceRef) ?? [];
    group.push(signal);
    signalsBySource.set(signal.sourceRef, group);
  }
  for (const signals of signalsBySource.values()) {
    const ordered = [...signals].sort(
      (left, right) =>
        Date.parse(left.observedAt) - Date.parse(right.observedAt) ||
        left.signalId.localeCompare(right.signalId),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (
        !previous.businessObjectAliasRef ||
        !current.businessObjectAliasRef ||
        previous.businessObjectAliasRef === current.businessObjectAliasRef
      ) {
        continue;
      }
      edges.push(
        edge({
          schemaVersion: OPERATING_RELATION_EDGE_SCHEMA_VERSION,
          relationKind: "source_temporal_sequence",
          fromBusinessObjectAliasRef: previous.businessObjectAliasRef,
          toBusinessObjectAliasRef: current.businessObjectAliasRef,
          supportingSignalEventRefs: [
            previous.signalId,
            current.signalId,
          ].sort(),
          supportingEvidenceRefs: sortedUnique([
            ...previous.evidenceRefs,
            ...current.evidenceRefs,
          ]),
          contradictingEvidenceRefs: [],
          validFrom: previous.observedAt,
          validTo: current.observedAt,
          provenance: {
            method: "deterministic_rule",
            ruleRef: "rule:source_temporal_sequence:v1",
            confidenceScore: null,
            calibrationRef: null,
          },
        }),
      );
    }
  }

  return byRef(
    [...new Map(edges.map((item) => [item.relationId, item])).values()],
    (item) => item.relationId,
  );
}

export function projectTemporalOperatingContext(
  input: TemporalOperatingContextProjectionInput,
): TemporalOperatingContextProjectionResult {
  const validation = validateTemporalOperatingContextProjectionInput(input);
  if (!validation.ok)
    return { ok: false, errors: validation.errors, snapshot: null };

  const replayRootHash = computeTemporalOperatingContextReplayRootHash(input);
  const content = {
    schemaVersion: TEMPORAL_OPERATING_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: contextSnapshotIdFromReplayRootHash(replayRootHash),
    workspaceAlias: input.workspaceAlias,
    tenantScopeRef: input.tenantScopeRef,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    asOf: input.asOf,
    projector: {
      revisionRef: OPERATING_CONTEXT_PROJECTOR_REVISION,
      stalenessDays: OPERATING_CONTEXT_STALENESS_DAYS,
    },
    harnessBinding: {
      manifestId: input.manifest.manifestId,
      manifestHash: input.manifest.contentHash,
      revisionId: input.revision.revisionId,
      revisionHash: input.revision.contentHash,
    },
    policyBindings: policyBindings(input),
    canonicalBindings: canonicalBindings(input),
    sourceReceipts: sourceReceipts(input),
    objectSummaries: objectSummaries(input),
    relations: relationEdges(input),
    derivedOnly: true as const,
    canonicalStateAuthority: false as const,
    writebackAllowed: false as const,
    actionAuthority: "none" as const,
    modelCallsUsed: false as const,
    replayRootHash,
  };
  const snapshot: TemporalOperatingContextSnapshot = {
    ...content,
    contentHash: computeTemporalOperatingContextSnapshotContentHash(content),
  };
  const snapshotValidation = validateTemporalOperatingContextSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    return { ok: false, errors: snapshotValidation.errors, snapshot: null };
  }
  return { ok: true, errors: [], snapshot };
}

export function validateTemporalOperatingContextSnapshotBinding(input: {
  input: TemporalOperatingContextProjectionInput;
  snapshot: unknown;
}): ValidationResult {
  const inputValidation = validateTemporalOperatingContextProjectionInput(
    input.input,
  );
  const snapshotValidation = validateTemporalOperatingContextSnapshot(
    input.snapshot,
  );
  const errors = [...inputValidation.errors, ...snapshotValidation.errors];
  if (errors.length > 0) return result(errors);
  const replay = projectTemporalOperatingContext(input.input);
  try {
    if (
      !replay.snapshot ||
      canonicalJson(replay.snapshot) !== canonicalJson(input.snapshot)
    ) {
      errors.push("context_snapshot_not_reproducible_from_input");
    }
  } catch {
    errors.push("context_snapshot_not_reproducible_from_input");
  }
  return result(errors);
}
