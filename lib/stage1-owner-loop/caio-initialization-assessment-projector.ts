import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type {
  TemporalOperatingContextProjectionInput,
  TemporalOperatingContextSnapshot,
} from "../operating-harness/context-contracts";
import {
  CAIO_INITIALIZATION_ARTIFACT_TYPES,
  computeCaioMemoryRootHash,
  validateCaioEvidenceTraceArtifact,
  validateCaioMemoryRebuildReceiptArtifact,
  validateCaioSchemaMappingArtifact,
  validateCaioTemporalContextArtifact,
  type CaioEvidenceTraceArtifact,
  type CaioMemoryRebuildReceiptArtifact,
  type CaioSchemaMappingArtifact,
  type CaioTemporalContextArtifact,
} from "./caio-initialization-artifacts";
import {
  validateDataAssetAuthorizationReceipt,
  validateDataAssetInitializationReceipt,
} from "./data-asset-catalog.contract";
import {
  CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
  CAIO_INITIALIZATION_POLICY,
  type CaioInitializationAssessmentInput,
  type CaioInitializationException,
  type CaioInitializationMemoryBinding,
} from "./caio-initialization-gate";
import type {
  DataAssetAuthorizationReceipt,
  DataAssetInitializationReceipt,
  DataAssetTechnicalFeasibility,
} from "./data-asset-catalog.types";
import type {
  EvidenceFreshnessState,
  ObservationAccessMode,
  ObservationOutcome,
  ObservationSensitivity,
  ObservationSourceStatus,
} from "./types";

export type CaioInitializationProjectionAsset = {
  id: string;
  inventoryStatus: string;
  classificationStatus: string;
  sensitivity: string;
  processingDisposition: string;
  technicalFeasibility: string;
  authorizationStatus: string;
  authorizationReceiptRef: string | null;
  connectionStatus: string;
  initializationStatus: string;
  initializationReceiptRef: string | null;
  riskOwnerRef: string | null;
  nextReviewAt: string | null;
  blockerCodes: string[];
  evidenceRefs: string[];
  version: number;
  authorizationReceipt: DataAssetAuthorizationReceipt | null;
  initializationReceipt: DataAssetInitializationReceipt | null;
};

export type CaioInitializationProjectionRun = {
  id: string;
  status: string;
  outcome: string;
  freshness: string;
  evidenceRefs: string[];
  errorCodes: string[];
};

export type CaioInitializationProjectionSource = {
  id: string;
  catalogEntryId: string | null;
  status: string;
  accessMode: string;
  sensitivity: string;
  compatibilityMode: boolean;
  runRefs: string[];
  latestRun: CaioInitializationProjectionRun | null;
};

export type CaioInitializationProjectionMemoryFact = {
  id: string;
  objectType: string;
  objectId: string;
  factType: string;
  title: string;
  content: string;
  normalizedValue: string | null;
  sourceType: string;
  sourceId: string;
  confidence: number;
  importance: number;
  freshnessScore: number;
  status: string;
  confirmedByUser: boolean;
  createdBySystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CaioInitializationProjectionArtifact = {
  id: string;
  artifactType: string;
  status: string;
  artifactsJson: string;
  createdAt: string;
};

export type CaioInitializationProjectionSnapshot = {
  workspaceId: string;
  mandateRecordId: string;
  evaluatedAt: string;
  assets: CaioInitializationProjectionAsset[];
  sources: CaioInitializationProjectionSource[];
  memoryFacts: CaioInitializationProjectionMemoryFact[];
  artifacts: CaioInitializationProjectionArtifact[];
};

export type CaioInitializationProjectionResult = {
  input: CaioInitializationAssessmentInput;
  diagnostics: string[];
};

const SAFE_ARTIFACT_STATUSES = new Set(["CONFIRMED", "CONSUMED"]);

function uniqueSorted(values: readonly string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function memoryFactRef(id: string): string {
  return `memory-fact:${id}`;
}

function artifactBundleRef(id: string): string {
  return `artifact-bundle:${id}`;
}

function memoryFactHash(
  fact: CaioInitializationProjectionMemoryFact,
): string {
  return sha256(canonicalJson(fact));
}

function exceptionRef(
  kind: "asset" | "source",
  ref: string,
  reasonCodes: readonly string[],
  evidenceRefs: readonly string[],
): string {
  return `${kind}-exception:${sha256(
    canonicalJson({
      ref,
      reasonCodes: uniqueSorted(reasonCodes),
      evidenceRefs: uniqueSorted(evidenceRefs),
    }),
  ).slice(7, 31)}`;
}

function buildException(input: {
  kind: "asset" | "source";
  ref: string;
  reasonCodes: readonly string[];
  riskOwnerRef: string | null;
  nextReviewAt: string | null;
  evidenceRefs: readonly string[];
}): CaioInitializationException | null {
  const reasonCodes = uniqueSorted(input.reasonCodes);
  const evidenceRefs = uniqueSorted(input.evidenceRefs);
  if (
    reasonCodes.length === 0 ||
    !input.riskOwnerRef?.trim() ||
    !input.nextReviewAt ||
    !Number.isFinite(Date.parse(input.nextReviewAt)) ||
    evidenceRefs.length === 0
  ) {
    return null;
  }
  return {
    exceptionRef: exceptionRef(
      input.kind,
      input.ref,
      reasonCodes,
      evidenceRefs,
    ),
    reasonCodes,
    riskOwnerRef: input.riskOwnerRef.trim(),
    nextReviewAt: input.nextReviewAt,
    evidenceRefs,
  };
}

function isInitialized(value: string): boolean {
  return value.toLowerCase() === "initialized";
}

function asTechnicalFeasibility(
  value: string,
): DataAssetTechnicalFeasibility {
  const normalized = value.toLowerCase();
  return normalized === "feasible" || normalized === "not_feasible"
    ? normalized
    : "unassessed";
}

function artifactMap(
  artifacts: readonly CaioInitializationProjectionArtifact[],
): Map<string, CaioInitializationProjectionArtifact> {
  return new Map(
    artifacts
      .filter((artifact) => SAFE_ARTIFACT_STATUSES.has(artifact.status))
      .map((artifact) => [artifactBundleRef(artifact.id), artifact]),
  );
}

function resolvedSchemaMappingRefs(input: {
  assetId: string;
  refs: readonly string[];
  artifacts: ReadonlyMap<string, CaioInitializationProjectionArtifact>;
  diagnostics: string[];
}): string[] {
  return uniqueSorted(input.refs).filter((ref) => {
    const artifact = input.artifacts.get(ref);
    const payload = artifact ? parseJson(artifact.artifactsJson) : null;
    const validation = validateCaioSchemaMappingArtifact(payload);
    const valid =
      artifact?.artifactType ===
        CAIO_INITIALIZATION_ARTIFACT_TYPES.schemaMapping &&
      validation.valid &&
      (payload as CaioSchemaMappingArtifact).artifactRef === ref &&
      (payload as CaioSchemaMappingArtifact).assetRef === input.assetId;
    if (!valid) input.diagnostics.push(`schema_mapping_unresolved:${input.assetId}:${ref}`);
    return valid;
  });
}

function resolvedMemoryBindings(input: {
  refs: readonly string[];
  facts: ReadonlyMap<string, CaioInitializationProjectionMemoryFact>;
  diagnostics: string[];
}): CaioInitializationMemoryBinding[] {
  return uniqueSorted(input.refs)
    .map((ref) => {
      const fact = input.facts.get(ref);
      if (!fact) {
        input.diagnostics.push(`memory_fact_unresolved:${ref}`);
        return null;
      }
      return { ref, contentHash: memoryFactHash(fact) };
    })
    .filter(
      (binding): binding is CaioInitializationMemoryBinding =>
        binding !== null,
    );
}

function selectMemoryReceipt(input: {
  artifacts: readonly CaioInitializationProjectionArtifact[];
  workspaceRef: string;
  bindings: readonly CaioInitializationMemoryBinding[];
  diagnostics: string[];
}): CaioMemoryRebuildReceiptArtifact | null {
  const expectedRoot = computeCaioMemoryRootHash(input.bindings);
  for (const artifact of [...input.artifacts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id),
  )) {
    if (
      artifact.artifactType !==
        CAIO_INITIALIZATION_ARTIFACT_TYPES.memoryRebuildReceipt ||
      !SAFE_ARTIFACT_STATUSES.has(artifact.status)
    ) {
      continue;
    }
    const payload = parseJson(artifact.artifactsJson);
    const validation = validateCaioMemoryRebuildReceiptArtifact(payload);
    if (
      validation.valid &&
      (payload as CaioMemoryRebuildReceiptArtifact).artifactRef ===
        artifactBundleRef(artifact.id) &&
      (payload as CaioMemoryRebuildReceiptArtifact).workspaceRef ===
        input.workspaceRef &&
      (payload as CaioMemoryRebuildReceiptArtifact).memoryRootHash ===
        expectedRoot &&
      canonicalJson(
        (payload as CaioMemoryRebuildReceiptArtifact).memoryFactBindings,
      ) === canonicalJson(input.bindings)
    ) {
      return payload as CaioMemoryRebuildReceiptArtifact;
    }
    input.diagnostics.push(`memory_rebuild_receipt_invalid:${artifact.id}`);
  }
  return null;
}

function selectTemporalContext(input: {
  artifacts: ReadonlyMap<string, CaioInitializationProjectionArtifact>;
  refs: readonly string[];
  workspaceRef: string;
  diagnostics: string[];
}): CaioTemporalContextArtifact | null {
  const refs = uniqueSorted(input.refs);
  if (refs.length !== 1) {
    input.diagnostics.push("temporal_context_ref_not_singleton");
    return null;
  }
  const artifact = input.artifacts.get(refs[0]);
  const payload = artifact ? parseJson(artifact.artifactsJson) : null;
  const validation = validateCaioTemporalContextArtifact(payload);
  if (
    artifact?.artifactType !==
      CAIO_INITIALIZATION_ARTIFACT_TYPES.temporalContext ||
    !validation.valid ||
    (payload as CaioTemporalContextArtifact).artifactRef !== refs[0] ||
    (payload as CaioTemporalContextArtifact).workspaceRef !==
      input.workspaceRef
  ) {
    input.diagnostics.push(`temporal_context_unresolved:${refs[0]}`);
    return null;
  }
  return payload as CaioTemporalContextArtifact;
}

function evidenceTraces(
  artifacts: readonly CaioInitializationProjectionArtifact[],
  diagnostics: string[],
): CaioEvidenceTraceArtifact[] {
  const traces: CaioEvidenceTraceArtifact[] = [];
  for (const artifact of artifacts) {
    if (
      artifact.artifactType !==
        CAIO_INITIALIZATION_ARTIFACT_TYPES.evidenceTrace ||
      !SAFE_ARTIFACT_STATUSES.has(artifact.status)
    ) {
      continue;
    }
    const payload = parseJson(artifact.artifactsJson);
    const validation = validateCaioEvidenceTraceArtifact(payload);
    if (!validation.valid) {
      diagnostics.push(`evidence_trace_invalid:${artifact.id}`);
      continue;
    }
    traces.push(payload as CaioEvidenceTraceArtifact);
  }
  return traces.sort((left, right) =>
    left.evidenceRef.localeCompare(right.evidenceRef),
  );
}

export function projectCaioInitializationAssessmentInput(
  snapshot: CaioInitializationProjectionSnapshot,
): CaioInitializationProjectionResult {
  const diagnostics: string[] = [];
  const workspaceRef = `workspace:${snapshot.workspaceId}`;
  const artifacts = artifactMap(snapshot.artifacts);
  const facts = new Map(
    snapshot.memoryFacts.map((fact) => [memoryFactRef(fact.id), fact]),
  );
  const assetRows = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  const runRefsByAsset = new Map<string, Set<string>>();
  for (const source of snapshot.sources) {
    if (!source.catalogEntryId) continue;
    const refs = runRefsByAsset.get(source.catalogEntryId) ?? new Set<string>();
    for (const ref of source.runRefs) refs.add(ref);
    if (source.latestRun) refs.add(source.latestRun.id);
    runRefsByAsset.set(source.catalogEntryId, refs);
  }
  const assets = snapshot.assets
    .map((asset) => {
      const authorizationValidation = asset.authorizationReceipt
        ? validateDataAssetAuthorizationReceipt(asset.authorizationReceipt)
        : { valid: false };
      const initializationValidation = asset.initializationReceipt
        ? validateDataAssetInitializationReceipt(asset.initializationReceipt)
        : { valid: false };
      const evaluatedAt = Date.parse(snapshot.evaluatedAt);
      const initializationReceipt =
        initializationValidation.valid &&
        asset.initializationReceipt?.receiptType === "initialization" &&
        asset.initializationReceipt.receiptId ===
          asset.initializationReceiptRef &&
        asset.initializationReceipt.assetRef === asset.id &&
        asset.initializationReceipt.workspaceRef === workspaceRef &&
        asset.initializationReceipt.initializationStatus ===
          asset.initializationStatus.toLowerCase()
          ? asset.initializationReceipt
          : null;
      const authorizationReceipt =
        authorizationValidation.valid &&
        asset.authorizationReceipt?.receiptType === "authorization" &&
        asset.authorizationReceipt.receiptId ===
          asset.authorizationReceiptRef &&
        asset.authorizationReceipt.assetRef === asset.id &&
        asset.authorizationReceipt.workspaceRef === workspaceRef &&
        asset.authorizationReceipt.authorizationStatus ===
          asset.authorizationStatus.toLowerCase() &&
        (asset.authorizationReceipt.authorizationStatus !== "authorized" ||
          (Number.isFinite(evaluatedAt) &&
            Date.parse(asset.authorizationReceipt.validFrom ?? "") <=
              evaluatedAt &&
            Date.parse(asset.authorizationReceipt.validUntil ?? "") >
              evaluatedAt))
          ? asset.authorizationReceipt
          : null;
      if (asset.initializationReceiptRef && !initializationReceipt) {
        diagnostics.push(`initialization_receipt_unresolved:${asset.id}`);
      }
      if (asset.authorizationReceiptRef && !authorizationReceipt) {
        diagnostics.push(`authorization_receipt_unresolved:${asset.id}`);
      }
      const schemaMappingRefs = initializationReceipt
        ? resolvedSchemaMappingRefs({
            assetId: asset.id,
            refs: initializationReceipt.schemaMappingRefs,
            artifacts,
            diagnostics,
          })
        : [];
      const knownRunRefs = runRefsByAsset.get(asset.id) ?? new Set<string>();
      const observationRunRefs = initializationReceipt
        ? uniqueSorted(initializationReceipt.observationRunRefs).filter(
            (ref) => {
              const resolved = knownRunRefs.has(ref);
              if (!resolved) {
                diagnostics.push(
                  `observation_run_unresolved:${asset.id}:${ref}`,
                );
              }
              return resolved;
            },
          )
        : [];
      const companyMemoryBindings = initializationReceipt
        ? resolvedMemoryBindings({
            refs: initializationReceipt.companyMemoryRefs,
            facts,
            diagnostics,
          })
        : [];
      const exceptionNeeded =
        asset.inventoryStatus.toLowerCase() === "excluded" ||
        asTechnicalFeasibility(asset.technicalFeasibility) ===
          "not_feasible" ||
        asset.authorizationStatus.toLowerCase() !== "authorized";
      return {
        assetRef: asset.id,
        inventoryStatus:
          asset.inventoryStatus.toLowerCase() as CaioInitializationAssessmentInput["assets"][number]["inventoryStatus"],
        classificationStatus:
          asset.classificationStatus.toLowerCase() as CaioInitializationAssessmentInput["assets"][number]["classificationStatus"],
        sensitivity:
          asset.sensitivity.toLowerCase() as ObservationSensitivity,
        processingDisposition:
          asset.processingDisposition.toLowerCase() as CaioInitializationAssessmentInput["assets"][number]["processingDisposition"],
        authorizationStatus:
          asset.authorizationStatus.toLowerCase() as CaioInitializationAssessmentInput["assets"][number]["authorizationStatus"],
        authorizationReceiptRef: authorizationReceipt?.receiptId ?? null,
        technicalFeasibility: asTechnicalFeasibility(
          asset.technicalFeasibility,
        ),
        connectionStatus:
          asset.connectionStatus.toLowerCase() as CaioInitializationAssessmentInput["assets"][number]["connectionStatus"],
        initializationStatus:
          asset.initializationStatus.toLowerCase() as CaioInitializationAssessmentInput["assets"][number]["initializationStatus"],
        initializationReceiptRef:
          initializationReceipt?.receiptId ?? null,
        observationRunRefs,
        schemaMappingRefs,
        companyMemoryBindings,
        temporalContextSnapshotRef:
          initializationReceipt?.temporalContextSnapshotRef ?? null,
        exception: exceptionNeeded
          ? buildException({
              kind: "asset",
              ref: asset.id,
              reasonCodes: asset.blockerCodes,
              riskOwnerRef: asset.riskOwnerRef,
              nextReviewAt: asset.nextReviewAt,
              evidenceRefs: asset.evidenceRefs,
            })
          : null,
      };
    })
    .sort((left, right) => left.assetRef.localeCompare(right.assetRef));

  const sources = snapshot.sources
    .map((source) => {
      const asset = source.catalogEntryId
        ? assetRows.get(source.catalogEntryId)
        : null;
      const latestRun = source.latestRun;
      const sourceException = buildException({
        kind: "source",
        ref: source.id,
        reasonCodes: [
          ...(asset?.blockerCodes ?? []),
          ...(latestRun?.errorCodes ?? []),
        ],
        riskOwnerRef: asset?.riskOwnerRef ?? null,
        nextReviewAt: asset?.nextReviewAt ?? null,
        evidenceRefs: [
          ...(asset?.evidenceRefs ?? []),
          ...(latestRun?.evidenceRefs ?? []),
        ],
      });
      return {
        sourceRef: source.id,
        assetRef: source.catalogEntryId ?? `unbound:${source.id}`,
        compatibilityMode: source.compatibilityMode,
        sourceStatus:
          source.status.toLowerCase() as ObservationSourceStatus,
        accessMode: source.accessMode.toLowerCase() as ObservationAccessMode,
        latestRunRef: latestRun?.id ?? null,
        latestRunStatus:
          (latestRun?.status.toLowerCase() ??
            "unknown") as CaioInitializationAssessmentInput["sources"][number]["latestRunStatus"],
        latestRunOutcome:
          (latestRun?.outcome.toLowerCase() ??
            "unknown") as ObservationOutcome,
        freshness:
          (latestRun?.freshness.toLowerCase() ??
            "unknown") as EvidenceFreshnessState,
        exception: sourceException,
      };
    })
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef));

  const allMemoryBindings = [
    ...new Map(
      assets
        .flatMap((asset) => asset.companyMemoryBindings)
        .map((binding) => [binding.ref, binding]),
    ).values(),
  ].sort((left, right) => left.ref.localeCompare(right.ref));
  const memoryReceipt = selectMemoryReceipt({
    artifacts: snapshot.artifacts,
    workspaceRef: `workspace:${snapshot.workspaceId}`,
    bindings: allMemoryBindings,
    diagnostics,
  });
  const temporalRefs = assets
    .filter((asset) => isInitialized(asset.initializationStatus))
    .map((asset) => asset.temporalContextSnapshotRef)
    .filter((ref): ref is string => Boolean(ref));
  const temporalContext = selectTemporalContext({
    artifacts,
    refs: temporalRefs,
    workspaceRef,
    diagnostics,
  });
  const traces = evidenceTraces(snapshot.artifacts, diagnostics);
  const registeredWritePathCount = snapshot.sources.filter(
    (source) =>
      !CAIO_INITIALIZATION_POLICY.allowedAccessModes.includes(
        source.accessMode.toLowerCase() as ObservationAccessMode,
      ),
  ).length;

  return {
    input: {
      schemaVersion: CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
      workspaceRef,
      mandateRef: snapshot.mandateRecordId,
      evaluatedAt: snapshot.evaluatedAt,
      assets,
      sources,
      evidenceTraces: traces,
      knowledge: {
        memoryRebuildReceiptRef: memoryReceipt?.receiptRef ?? null,
        memoryRootHash: memoryReceipt?.memoryRootHash ?? null,
        temporalContextArtifactRef: temporalContext?.artifactRef ?? null,
        temporalContextInputHash:
          temporalContext?.projectionInputHash ?? null,
        temporalContextSnapshotHash:
          temporalContext?.snapshotHash ?? null,
        temporalContextReplayRootHash:
          temporalContext?.replayRootHash ?? null,
        temporalContextReplayValid: Boolean(temporalContext),
      },
      registeredWritePathCount,
    },
    diagnostics: uniqueSorted(diagnostics),
  };
}

export type {
  TemporalOperatingContextProjectionInput,
  TemporalOperatingContextSnapshot,
};
