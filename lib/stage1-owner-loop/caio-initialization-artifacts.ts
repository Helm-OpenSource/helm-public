import { canonicalJson, sha256 } from "../expert-capability/hashing";
import {
  validateTemporalOperatingContextSnapshotBinding,
} from "../operating-harness/context-projector";
import type {
  TemporalOperatingContextProjectionInput,
  TemporalOperatingContextSnapshot,
} from "../operating-harness/context-contracts";
import {
  CAIO_INITIALIZATION_EVIDENCE_OUTPUT_TYPES,
  type CaioInitializationEvidenceOutputType,
  type CaioInitializationEvidenceTrace,
  type CaioInitializationMemoryBinding,
} from "./caio-initialization-gate";
import {
  OBSERVATION_SENSITIVITY_LEVELS,
  type ObservationSensitivity,
} from "./types";

export const CAIO_INITIALIZATION_ARTIFACT_TYPES = {
  schemaMapping: "caio_initialization_schema_mapping",
  memoryRebuildReceipt: "caio_initialization_memory_rebuild_receipt",
  temporalContext: "caio_initialization_temporal_context",
  evidenceTrace: "caio_initialization_evidence_trace",
} as const;

export const CAIO_SCHEMA_MAPPING_SCHEMA_VERSION =
  "helm.caio.initialization-schema-mapping.v1" as const;
export const CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION =
  "helm.caio.memory-rebuild-receipt.v1" as const;
export const CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION =
  "helm.caio.temporal-context-artifact.v1" as const;
export const CAIO_EVIDENCE_TRACE_SCHEMA_VERSION =
  "helm.caio.initialization-evidence-trace.v1" as const;

export type CaioSchemaMappingArtifact = {
  schemaVersion: typeof CAIO_SCHEMA_MAPPING_SCHEMA_VERSION;
  artifactRef: string;
  assetRef: string;
  sourceSchemaHash: string;
  targetSchemaHash: string;
  mappingHash: string;
  generatedAt: string;
  contentHash: string;
};

export type CaioMemoryRebuildReceiptArtifact = {
  schemaVersion: typeof CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION;
  artifactRef: string;
  receiptRef: string;
  workspaceRef: string;
  memoryFactBindings: CaioInitializationMemoryBinding[];
  memoryRootHash: string;
  rebuiltAt: string;
  contentHash: string;
};

export type CaioTemporalContextArtifact = {
  schemaVersion: typeof CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION;
  artifactRef: string;
  workspaceRef: string;
  projectionInput: TemporalOperatingContextProjectionInput;
  snapshot: TemporalOperatingContextSnapshot;
  projectionInputHash: string;
  snapshotHash: string;
  replayRootHash: string;
  contentHash: string;
};

export type CaioEvidenceTraceArtifact = Omit<
  CaioInitializationEvidenceTrace,
  "traceHash"
> & {
  schemaVersion: typeof CAIO_EVIDENCE_TRACE_SCHEMA_VERSION;
  traceHash: string;
};

export type CaioInitializationArtifactValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function uniqueSortedBindings(
  bindings: readonly CaioInitializationMemoryBinding[],
): CaioInitializationMemoryBinding[] {
  return [
    ...new Map(
      bindings
        .filter(
          (binding) =>
            isNonEmpty(binding.ref) && isSha256(binding.contentHash),
        )
        .map((binding) => [
          binding.ref.trim(),
          {
            ref: binding.ref.trim(),
            contentHash: binding.contentHash,
          },
        ]),
    ).values(),
  ].sort((left, right) => left.ref.localeCompare(right.ref));
}

function contentHashMatches(value: Record<string, unknown>): boolean {
  const { contentHash, ...content } = value;
  return isSha256(contentHash) && contentHash === sha256(canonicalJson(content));
}

export function computeCaioMemoryRootHash(
  bindings: readonly CaioInitializationMemoryBinding[],
): string {
  return sha256(canonicalJson(uniqueSortedBindings(bindings)));
}

export function computeCaioEvidenceTraceHash(
  trace: Omit<CaioEvidenceTraceArtifact, "traceHash">,
): string {
  return sha256(canonicalJson(trace));
}

export function validateCaioSchemaMappingArtifact(
  input: unknown,
): CaioInitializationArtifactValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["schema_mapping_invalid"] };
  if (
    input.schemaVersion !== CAIO_SCHEMA_MAPPING_SCHEMA_VERSION ||
    !isNonEmpty(input.artifactRef) ||
    !isNonEmpty(input.assetRef) ||
    !isSha256(input.sourceSchemaHash) ||
    !isSha256(input.targetSchemaHash) ||
    !isSha256(input.mappingHash) ||
    !Number.isFinite(Date.parse(String(input.generatedAt)))
  ) {
    errors.push("schema_mapping_required_field_invalid");
  }
  if (!contentHashMatches(input)) {
    errors.push("schema_mapping_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function validateCaioMemoryRebuildReceiptArtifact(
  input: unknown,
): CaioInitializationArtifactValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["memory_rebuild_receipt_invalid"] };
  const bindings = Array.isArray(input.memoryFactBindings)
    ? (input.memoryFactBindings as CaioInitializationMemoryBinding[])
    : [];
  if (
    input.schemaVersion !== CAIO_MEMORY_REBUILD_RECEIPT_SCHEMA_VERSION ||
    !isNonEmpty(input.artifactRef) ||
    !isNonEmpty(input.receiptRef) ||
    !isNonEmpty(input.workspaceRef) ||
    bindings.length === 0 ||
    !Number.isFinite(Date.parse(String(input.rebuiltAt)))
  ) {
    errors.push("memory_rebuild_receipt_required_field_invalid");
  }
  if (
    !isSha256(input.memoryRootHash) ||
    input.memoryRootHash !== computeCaioMemoryRootHash(bindings)
  ) {
    errors.push("memory_rebuild_root_hash_mismatch");
  }
  if (
    uniqueSortedBindings(bindings).length !== bindings.length ||
    !contentHashMatches(input)
  ) {
    errors.push("memory_rebuild_receipt_content_invalid");
  }
  return { valid: errors.length === 0, errors };
}

export function validateCaioTemporalContextArtifact(
  input: unknown,
): CaioInitializationArtifactValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["temporal_context_artifact_invalid"] };
  if (
    input.schemaVersion !== CAIO_TEMPORAL_CONTEXT_ARTIFACT_SCHEMA_VERSION ||
    !isNonEmpty(input.artifactRef) ||
    !isNonEmpty(input.workspaceRef) ||
    !isRecord(input.projectionInput) ||
    !isRecord(input.snapshot)
  ) {
    errors.push("temporal_context_artifact_required_field_invalid");
    return { valid: false, errors };
  }
  const projectionInputHash = sha256(canonicalJson(input.projectionInput));
  const snapshotHash = input.snapshot.contentHash;
  const replayRootHash = input.snapshot.replayRootHash;
  if (
    input.projectionInputHash !== projectionInputHash ||
    !isSha256(snapshotHash) ||
    input.snapshotHash !== snapshotHash ||
    !isSha256(replayRootHash) ||
    input.replayRootHash !== replayRootHash
  ) {
    errors.push("temporal_context_artifact_hash_binding_invalid");
  }
  const replay = validateTemporalOperatingContextSnapshotBinding({
    input:
      input.projectionInput as unknown as TemporalOperatingContextProjectionInput,
    snapshot: input.snapshot,
  });
  if (!replay.ok) {
    errors.push("temporal_context_artifact_not_replayable");
  }
  if (!contentHashMatches(input)) {
    errors.push("temporal_context_artifact_content_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function validateCaioEvidenceTraceArtifact(
  input: unknown,
): CaioInitializationArtifactValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["evidence_trace_invalid"] };
  if (
    input.schemaVersion !== CAIO_EVIDENCE_TRACE_SCHEMA_VERSION ||
    !isNonEmpty(input.evidenceRef) ||
    !isNonEmpty(input.sourceRef) ||
    !isNonEmpty(input.assetRef) ||
    !isNonEmpty(input.observationRunRef) ||
    !isNonEmpty(input.authorizationReceiptRef) ||
    !isNonEmpty(input.connectionReceiptRef) ||
    !isNonEmpty(input.initializationReceiptRef) ||
    !OBSERVATION_SENSITIVITY_LEVELS.includes(
      input.sensitivity as ObservationSensitivity,
    ) ||
    !CAIO_INITIALIZATION_EVIDENCE_OUTPUT_TYPES.includes(
      input.outputType as CaioInitializationEvidenceOutputType,
    ) ||
    !Number.isFinite(Date.parse(String(input.capturedAt))) ||
    input.resolved !== true
  ) {
    errors.push("evidence_trace_required_field_invalid");
  }
  const { traceHash: _traceHash, ...content } =
    input as unknown as CaioEvidenceTraceArtifact;
  if (
    !isSha256(input.traceHash) ||
    input.traceHash !== computeCaioEvidenceTraceHash(content)
  ) {
    errors.push("evidence_trace_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}
