import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import type { TemporalOperatingContextProjectionInput } from "@/lib/operating-harness/context-contracts";
import { projectTemporalOperatingContext } from "@/lib/operating-harness/context-projector";
import {
  CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
  CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
  CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
  CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
  computeCaioEvidenceTraceHash,
  computeCaioMemoryRootHash,
  type CaioEvidenceTraceArtifact,
  type CaioMemoryRebuildReceiptArtifact,
  type CaioSchemaMappingArtifact,
  type CaioTemporalContextArtifact,
} from "@/lib/stage1-owner-loop/caio-initialization-artifacts";
import type { CaioInitializationMemoryBinding } from "@/lib/stage1-owner-loop/caio-initialization-gate";
import type { ObservationSensitivity } from "@/lib/stage1-owner-loop/types";

/**
 * Pure builders for the four G0 initialization artifacts produced from live quick-check observation.
 * Every artifact passes its validator in lib/stage1-owner-loop/caio-initialization-artifacts.ts; the
 * artifactRef is always `artifact-bundle:<ArtifactBundle.id>` so initialization receipts can bind it.
 */

function withContentHash<T extends Record<string, unknown>>(content: T): T & { contentHash: string } {
  return { ...content, contentHash: sha256(canonicalJson(content)) };
}

export function buildCaioG0TemporalContextArtifact(input: {
  artifactId: string;
  workspaceId: string;
  projectionInput: TemporalOperatingContextProjectionInput;
}): { ok: true; artifact: CaioTemporalContextArtifact } | { ok: false; errors: string[] } {
  const projection = projectTemporalOperatingContext(input.projectionInput);
  if (!projection.ok || !projection.snapshot) return { ok: false, errors: projection.errors };
  const artifact = withContentHash({
    schemaVersion: CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION,
    artifactRef: `artifact-bundle:${input.artifactId}`,
    workspaceRef: `workspace:${input.workspaceId}`,
    projectionInput: input.projectionInput,
    snapshot: projection.snapshot,
    projectionInputHash: sha256(canonicalJson(input.projectionInput)),
    snapshotHash: projection.snapshot.contentHash,
    replayRootHash: projection.snapshot.replayRootHash,
  });
  return { ok: true, artifact };
}

export function buildCaioG0SchemaMappingArtifact(input: {
  artifactId: string;
  assetId: string;
  templates: readonly { templateId: string; valueKeys: readonly string[] }[];
  generatedAt: Date;
}): CaioSchemaMappingArtifact {
  const mapping = Object.fromEntries(
    [...input.templates]
      .sort((a, b) => a.templateId.localeCompare(b.templateId))
      .map((template) => [template.templateId, [...new Set(template.valueKeys)].sort()]),
  );
  return withContentHash({
    schemaVersion: CAIO_SCHEMA_MAPPING_SCHEMA_VERSION,
    artifactRef: `artifact-bundle:${input.artifactId}`,
    assetRef: input.assetId,
    sourceSchemaHash: sha256(canonicalJson(Object.keys(mapping))),
    targetSchemaHash: sha256(canonicalJson(Object.values(mapping))),
    mappingHash: sha256(canonicalJson(mapping)),
    generatedAt: input.generatedAt.toISOString(),
  });
}

export function buildCaioG0EvidenceTraceArtifacts(input: {
  assetId: string;
  sourceId: string;
  runId: string;
  authorizationReceiptRef: string;
  connectionReceiptRef: string;
  initializationReceiptRef: string;
  sensitivity: ObservationSensitivity;
  observations: readonly { evidenceRef: string; observedAt: Date }[];
  limit: number;
}): CaioEvidenceTraceArtifact[] {
  if (input.limit <= 0) return [];
  return [...input.observations]
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef))
    .slice(0, input.limit)
    .map((observation) => {
      const content = {
        schemaVersion: CAIO_EVIDENCE_TRACE_SCHEMA_VERSION,
        evidenceRef: observation.evidenceRef,
        evidenceKind: "metric_observation",
        sourceRef: input.sourceId,
        assetRef: input.assetId,
        observationRunRef: input.runId,
        authorizationReceiptRef: input.authorizationReceiptRef,
        connectionReceiptRef: input.connectionReceiptRef,
        initializationReceiptRef: input.initializationReceiptRef,
        sensitivity: input.sensitivity,
        outputType: "supervision_signal" as const,
        capturedAt: observation.observedAt.toISOString(),
        resolved: true as const,
      };
      return { ...content, traceHash: computeCaioEvidenceTraceHash(content) };
    });
}

export function buildCaioG0MemoryRebuildReceiptArtifact(input: {
  artifactId: string;
  workspaceId: string;
  bindings: readonly CaioInitializationMemoryBinding[];
  rebuiltAt: Date;
}): CaioMemoryRebuildReceiptArtifact {
  const memoryFactBindings = [...new Map(input.bindings.map((binding) => [binding.ref, binding])).values()]
    .map((binding) => ({ ref: binding.ref, contentHash: binding.contentHash }))
    .sort((a, b) => a.ref.localeCompare(b.ref));
  return withContentHash({
    schemaVersion: CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION,
    artifactRef: `artifact-bundle:${input.artifactId}`,
    receiptRef: `receipt:memory-rebuild:${input.artifactId}`,
    workspaceRef: `workspace:${input.workspaceId}`,
    memoryFactBindings,
    memoryRootHash: computeCaioMemoryRootHash(memoryFactBindings),
    rebuiltAt: input.rebuiltAt.toISOString(),
  });
}
