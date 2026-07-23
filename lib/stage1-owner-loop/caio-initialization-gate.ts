import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type {
  DataAssetAuthorizationStatus,
  DataAssetClassificationStatus,
  DataAssetConnectionStatus,
  DataAssetInitializationStatus,
  DataAssetInventoryStatus,
  DataAssetProcessingDisposition,
  DataAssetTechnicalFeasibility,
} from "./data-asset-catalog.types";
import type {
  ObservationAccessMode,
  EvidenceFreshnessState,
  ObservationOutcome,
  ObservationSensitivity,
  ObservationSourceStatus,
} from "./types";

export const CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION =
  "helm.caio.initialization-assessment.v1" as const;
export const CAIO_INITIALIZATION_EVALUATOR_REVISION =
  "caio-g0-evaluator.v1" as const;

export const CAIO_INITIALIZATION_EVIDENCE_OUTPUT_TYPES = [
  "owner_answer",
  "operating_brief",
  "supervision_signal",
] as const;

export type CaioInitializationEvidenceOutputType =
  (typeof CAIO_INITIALIZATION_EVIDENCE_OUTPUT_TYPES)[number];

export const CAIO_INITIALIZATION_FAILURES = [
  "input_invalid",
  "asset_catalog_empty",
  "asset_state_incomplete",
  "asset_exception_incomplete",
  "authorized_feasible_asset_not_initialized",
  "initialized_asset_missing_receipt",
  "initialized_asset_missing_observation_run",
  "initialized_asset_missing_schema_mapping",
  "initialized_asset_missing_company_memory",
  "initialized_asset_missing_temporal_context",
  "connected_source_missing",
  "compatibility_source_present",
  "connected_source_health_below_threshold",
  "source_exception_incomplete",
  "evidence_trace_sample_empty",
  "evidence_traceability_failed",
  "evidence_source_coverage_incomplete",
  "evidence_sensitivity_coverage_incomplete",
  "evidence_output_type_coverage_incomplete",
  "company_memory_not_rebuildable",
  "temporal_context_not_rebuildable",
  "registered_write_path_present",
] as const;

export type CaioInitializationFailure =
  (typeof CAIO_INITIALIZATION_FAILURES)[number];

export type CaioInitializationException = {
  exceptionRef: string;
  reasonCodes: string[];
  riskOwnerRef: string;
  nextReviewAt: string;
  evidenceRefs: string[];
};

export type CaioInitializationMemoryBinding = {
  ref: string;
  contentHash: string;
};

export type CaioInitializationAssetSnapshot = {
  assetRef: string;
  inventoryStatus: DataAssetInventoryStatus;
  classificationStatus: DataAssetClassificationStatus;
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  authorizationStatus: DataAssetAuthorizationStatus;
  authorizationReceiptRef: string | null;
  technicalFeasibility: DataAssetTechnicalFeasibility;
  connectionStatus: DataAssetConnectionStatus;
  initializationStatus: DataAssetInitializationStatus;
  initializationReceiptRef: string | null;
  observationRunRefs: string[];
  schemaMappingRefs: string[];
  companyMemoryBindings: CaioInitializationMemoryBinding[];
  temporalContextSnapshotRef: string | null;
  exception: CaioInitializationException | null;
};

export type CaioInitializationSourceSnapshot = {
  sourceRef: string;
  assetRef: string;
  compatibilityMode: boolean;
  sourceStatus: ObservationSourceStatus;
  accessMode: ObservationAccessMode;
  latestRunRef: string | null;
  latestRunStatus:
    | "running"
    | "succeeded"
    | "partial"
    | "failed"
    | "cancelled"
    | "unknown";
  latestRunOutcome: ObservationOutcome;
  freshness: EvidenceFreshnessState;
  exception: CaioInitializationException | null;
};

export type CaioInitializationEvidenceTrace = {
  evidenceRef: string;
  sourceRef: string;
  assetRef: string;
  observationRunRef: string;
  authorizationReceiptRef: string;
  initializationReceiptRef: string;
  sensitivity: ObservationSensitivity;
  outputType: CaioInitializationEvidenceOutputType;
  capturedAt: string;
  resolved: boolean;
  traceHash: string;
};

export type CaioInitializationKnowledgeSnapshot = {
  memoryRebuildReceiptRef: string | null;
  memoryRootHash: string | null;
  temporalContextArtifactRef: string | null;
  temporalContextInputHash: string | null;
  temporalContextSnapshotHash: string | null;
  temporalContextReplayRootHash: string | null;
  temporalContextReplayValid: boolean;
};

export type CaioInitializationAssessmentInput = {
  schemaVersion: typeof CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION;
  workspaceRef: string;
  mandateRef: string;
  evaluatedAt: string;
  assets: CaioInitializationAssetSnapshot[];
  sources: CaioInitializationSourceSnapshot[];
  evidenceTraces: CaioInitializationEvidenceTrace[];
  knowledge: CaioInitializationKnowledgeSnapshot;
  registeredWritePathCount: number;
};

const initializationPolicyContent = {
  policyRef: "policy:caio-initialization-g0-v1" as const,
  minimumSourceHealthRate: 0.95,
  requiredInitializationRate: 1,
  requiredEvidenceTraceabilityRate: 1,
  evidenceFullReviewLimit: 50,
  evidenceMinimumSampleSize: 50,
  allowCompatibilitySources: false,
  allowedAccessModes: [
    "read_only_api",
    "read_only_replica",
    "scheduled_snapshot",
    "file_snapshot",
  ] as const,
  authorityEffect: "none" as const,
};

export const CAIO_INITIALIZATION_POLICY = {
  ...initializationPolicyContent,
  policyHash: sha256(canonicalJson(initializationPolicyContent)),
};

export type CaioInitializationMetrics = {
  catalogAssetCount: number;
  completeAssetStateCount: number;
  authorizedFeasibleAssetCount: number;
  initializedAuthorizedFeasibleAssetCount: number;
  initializationRate: number | null;
  connectedSourceCount: number;
  healthySourceCount: number;
  sourceHealthRate: number | null;
  completeExceptionCount: number;
  evidenceCandidateCount: number;
  evidenceSampleCount: number;
  traceableEvidenceSampleCount: number;
  evidenceTraceabilityRate: number | null;
  registeredWritePathCount: number;
};

export type CaioInitializationCheck = {
  checkCode: string;
  passed: boolean;
  severity: "error" | "warning";
  description: string;
  evidenceRefs: string[];
};

export type CaioInitializationAssessment = {
  schemaVersion: typeof CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION;
  assessmentId: string;
  workspaceRef: string;
  mandateRef: string;
  evaluatorRevision: typeof CAIO_INITIALIZATION_EVALUATOR_REVISION;
  policyRef: typeof CAIO_INITIALIZATION_POLICY.policyRef;
  policyHash: string;
  basisHash: string;
  decision: "not_ready" | "ready_for_owner_acceptance";
  metrics: CaioInitializationMetrics;
  checks: CaioInitializationCheck[];
  failures: CaioInitializationFailure[];
  exceptionRefs: string[];
  evidenceSample: CaioInitializationEvidenceTrace[];
  evidenceSampleHash: string;
  knowledge: CaioInitializationKnowledgeSnapshot;
  ownerAcceptanceRequired: true;
  ownerApprovalRecorded: false;
  authorityEffect: "none";
  evaluatedAt: string;
  contentHash: string;
};

export type CaioInitializationValidation = {
  valid: boolean;
  errors: string[];
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(isNonEmpty).map((value) => value.trim()))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function byRef<T>(values: readonly T[], ref: (value: T) => string): T[] {
  return [...values].sort((left, right) =>
    ref(left).localeCompare(ref(right)),
  );
}

function normalizedException(
  exception: CaioInitializationException | null,
): CaioInitializationException | null {
  if (!exception) return null;
  return {
    exceptionRef: exception.exceptionRef.trim(),
    reasonCodes: uniqueSorted(exception.reasonCodes),
    riskOwnerRef: exception.riskOwnerRef.trim(),
    nextReviewAt: exception.nextReviewAt,
    evidenceRefs: uniqueSorted(exception.evidenceRefs),
  };
}

function normalizedInput(
  input: CaioInitializationAssessmentInput,
): Omit<CaioInitializationAssessmentInput, "evaluatedAt"> {
  return {
    schemaVersion: input.schemaVersion,
    workspaceRef: input.workspaceRef.trim(),
    mandateRef: input.mandateRef.trim(),
    assets: byRef(input.assets, (asset) => asset.assetRef).map((asset) => ({
      ...asset,
      assetRef: asset.assetRef.trim(),
      authorizationReceiptRef:
        asset.authorizationReceiptRef?.trim() || null,
      initializationReceiptRef:
        asset.initializationReceiptRef?.trim() || null,
      observationRunRefs: uniqueSorted(asset.observationRunRefs),
      schemaMappingRefs: uniqueSorted(asset.schemaMappingRefs),
      companyMemoryBindings: byRef(
        asset.companyMemoryBindings,
        (binding) => binding.ref,
      ).map((binding) => ({
        ref: binding.ref.trim(),
        contentHash: binding.contentHash,
      })),
      temporalContextSnapshotRef:
        asset.temporalContextSnapshotRef?.trim() || null,
      exception: normalizedException(asset.exception),
    })),
    sources: byRef(input.sources, (source) => source.sourceRef).map(
      (source) => ({
        ...source,
        sourceRef: source.sourceRef.trim(),
        assetRef: source.assetRef.trim(),
        latestRunRef: source.latestRunRef?.trim() || null,
        exception: normalizedException(source.exception),
      }),
    ),
    evidenceTraces: byRef(
      input.evidenceTraces,
      (trace) => trace.evidenceRef,
    ).map((trace) => ({
      ...trace,
      evidenceRef: trace.evidenceRef.trim(),
      sourceRef: trace.sourceRef.trim(),
      assetRef: trace.assetRef.trim(),
      observationRunRef: trace.observationRunRef.trim(),
      authorizationReceiptRef: trace.authorizationReceiptRef.trim(),
      initializationReceiptRef: trace.initializationReceiptRef.trim(),
    })),
    knowledge: {
      ...input.knowledge,
      memoryRebuildReceiptRef:
        input.knowledge.memoryRebuildReceiptRef?.trim() || null,
      temporalContextArtifactRef:
        input.knowledge.temporalContextArtifactRef?.trim() || null,
    },
    registeredWritePathCount: input.registeredWritePathCount,
  };
}

function completeException(
  exception: CaioInitializationException | null,
  evaluatedAt: string,
): boolean {
  return Boolean(
    exception &&
      isNonEmpty(exception.exceptionRef) &&
      uniqueSorted(exception.reasonCodes).length > 0 &&
      isNonEmpty(exception.riskOwnerRef) &&
      Number.isFinite(Date.parse(exception.nextReviewAt)) &&
      Date.parse(exception.nextReviewAt) > Date.parse(evaluatedAt) &&
      uniqueSorted(exception.evidenceRefs).length > 0,
  );
}

function completeAssetState(
  asset: CaioInitializationAssetSnapshot,
  evaluatedAt: string,
): boolean {
  if (
    asset.inventoryStatus !== "inventoried" &&
    asset.inventoryStatus !== "excluded"
  ) {
    return false;
  }
  if (asset.classificationStatus !== "classified") return false;
  if (asset.technicalFeasibility === "unassessed") return false;
  if (
    asset.authorizationStatus === "not_requested" ||
    asset.authorizationStatus === "pending"
  ) {
    return false;
  }
  if (
    asset.inventoryStatus === "excluded" ||
    asset.technicalFeasibility === "not_feasible" ||
    asset.authorizationStatus !== "authorized"
  ) {
    return completeException(asset.exception, evaluatedAt);
  }
  return (
    isNonEmpty(asset.authorizationReceiptRef) &&
    asset.connectionStatus === "connected"
  );
}

function healthySource(source: CaioInitializationSourceSnapshot): boolean {
  return (
    !source.compatibilityMode &&
    source.sourceStatus === "active" &&
    source.latestRunStatus === "succeeded" &&
    source.latestRunOutcome === "success" &&
    source.freshness === "fresh" &&
    CAIO_INITIALIZATION_POLICY.allowedAccessModes.includes(source.accessMode)
  );
}

function traceableEvidence(
  trace: CaioInitializationEvidenceTrace,
  assetsByRef: ReadonlyMap<string, CaioInitializationAssetSnapshot>,
  sourcesByRef: ReadonlyMap<string, CaioInitializationSourceSnapshot>,
): boolean {
  const asset = assetsByRef.get(trace.assetRef);
  const source = sourcesByRef.get(trace.sourceRef);
  return Boolean(
    trace.resolved &&
      isNonEmpty(trace.evidenceRef) &&
      isNonEmpty(trace.observationRunRef) &&
      isNonEmpty(trace.authorizationReceiptRef) &&
      isNonEmpty(trace.initializationReceiptRef) &&
      isSha256(trace.traceHash) &&
      Number.isFinite(Date.parse(trace.capturedAt)) &&
      asset &&
      source &&
      source.assetRef === asset.assetRef &&
      asset.observationRunRefs.includes(trace.observationRunRef) &&
      asset.authorizationReceiptRef === trace.authorizationReceiptRef &&
      asset.initializationReceiptRef === trace.initializationReceiptRef,
  );
}

function deterministicTraceOrder(
  traces: readonly CaioInitializationEvidenceTrace[],
  policyHash: string,
): CaioInitializationEvidenceTrace[] {
  return [...traces].sort((left, right) => {
    const leftRank = sha256(
      canonicalJson({
        policyHash,
        evidenceRef: left.evidenceRef,
        traceHash: left.traceHash,
      }),
    );
    const rightRank = sha256(
      canonicalJson({
        policyHash,
        evidenceRef: right.evidenceRef,
        traceHash: right.traceHash,
      }),
    );
    return (
      leftRank.localeCompare(rightRank) ||
      left.evidenceRef.localeCompare(right.evidenceRef)
    );
  });
}

export function selectCaioInitializationEvidenceSample(
  traces: readonly CaioInitializationEvidenceTrace[],
  policyHash: string,
): CaioInitializationEvidenceTrace[] {
  const unique = [
    ...new Map(
      byRef(traces, (trace) => trace.evidenceRef).map((trace) => [
        trace.evidenceRef,
        trace,
      ]),
    ).values(),
  ];
  if (
    unique.length <= CAIO_INITIALIZATION_POLICY.evidenceFullReviewLimit
  ) {
    return unique;
  }

  const ranked = deterministicTraceOrder(unique, policyHash);
  const selected = new Map<string, CaioInitializationEvidenceTrace>();

  const selectFirstPer = (
    key: (trace: CaioInitializationEvidenceTrace) => string,
  ) => {
    for (const trace of ranked) {
      const category = key(trace);
      if (
        ![...selected.values()].some(
          (selectedTrace) => key(selectedTrace) === category,
        )
      ) {
        selected.set(trace.evidenceRef, trace);
      }
    }
  };

  selectFirstPer((trace) => trace.sourceRef);
  selectFirstPer((trace) => trace.sensitivity);
  selectFirstPer((trace) => trace.outputType);

  for (const trace of ranked) {
    if (
      selected.size >=
      CAIO_INITIALIZATION_POLICY.evidenceMinimumSampleSize
    ) {
      break;
    }
    selected.set(trace.evidenceRef, trace);
  }

  return byRef([...selected.values()], (trace) => trace.evidenceRef);
}

function coverageComplete(
  all: readonly CaioInitializationEvidenceTrace[],
  sample: readonly CaioInitializationEvidenceTrace[],
  key: (trace: CaioInitializationEvidenceTrace) => string,
): boolean {
  const expected = new Set(all.map(key));
  const present = new Set(sample.map(key));
  return [...expected].every((value) => present.has(value));
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function addFailure(
  failures: CaioInitializationFailure[],
  condition: boolean,
  failure: CaioInitializationFailure,
): void {
  if (condition) failures.push(failure);
}

function check(
  checkCode: string,
  passed: boolean,
  description: string,
  evidenceRefs: string[] = [],
  severity: "error" | "warning" = "error",
): CaioInitializationCheck {
  return {
    checkCode,
    passed,
    severity,
    description,
    evidenceRefs: uniqueSorted(evidenceRefs),
  };
}

export function computeCaioInitializationAssessment(
  input: CaioInitializationAssessmentInput,
): CaioInitializationAssessment {
  const normalized = normalizedInput(input);
  const basisHash = sha256(canonicalJson(normalized));
  const assets = normalized.assets;
  const sources = normalized.sources;
  const assetsByRef = new Map(
    assets.map((asset) => [asset.assetRef, asset]),
  );
  const sourcesByRef = new Map(
    sources.map((source) => [source.sourceRef, source]),
  );
  const authorizedFeasible = assets.filter(
    (asset) =>
      asset.inventoryStatus === "inventoried" &&
      asset.authorizationStatus === "authorized" &&
      asset.technicalFeasibility === "feasible" &&
      asset.processingDisposition !== "prohibited",
  );
  const initializedAuthorizedFeasible = authorizedFeasible.filter(
    (asset) => asset.initializationStatus === "initialized",
  );
  const completeStates = assets.filter((asset) =>
    completeAssetState(asset, input.evaluatedAt),
  );
  const incompleteAssetExceptions = assets.filter(
    (asset) =>
      (asset.inventoryStatus === "excluded" ||
        asset.technicalFeasibility === "not_feasible" ||
        asset.authorizationStatus !== "authorized") &&
      !completeException(asset.exception, input.evaluatedAt),
  );
  const healthySources = sources.filter(healthySource);
  const unhealthySources = sources.filter(
    (source) => !healthySource(source),
  );
  const incompleteSourceExceptions = unhealthySources.filter(
    (source) => !completeException(source.exception, input.evaluatedAt),
  );
  const exceptionRefs = uniqueSorted([
    ...assets.flatMap((asset) =>
      asset.exception ? [asset.exception.exceptionRef] : [],
    ),
    ...sources.flatMap((source) =>
      source.exception ? [source.exception.exceptionRef] : [],
    ),
  ]);
  const completeExceptionCount = [
    ...assets.map((asset) => asset.exception),
    ...sources.map((source) => source.exception),
  ].filter((exception) => completeException(exception, input.evaluatedAt)).length;
  const evidenceSample = selectCaioInitializationEvidenceSample(
    normalized.evidenceTraces,
    CAIO_INITIALIZATION_POLICY.policyHash,
  );
  const traceableSample = evidenceSample.filter((trace) =>
    traceableEvidence(trace, assetsByRef, sourcesByRef),
  );
  const initializationRate = rate(
    initializedAuthorizedFeasible.length,
    authorizedFeasible.length,
  );
  const sourceHealthRate = rate(healthySources.length, sources.length);
  const evidenceTraceabilityRate = rate(
    traceableSample.length,
    evidenceSample.length,
  );
  const memoryRebuildable =
    isNonEmpty(normalized.knowledge.memoryRebuildReceiptRef) &&
    isSha256(normalized.knowledge.memoryRootHash) &&
    assets.every(
      (asset) =>
        asset.initializationStatus !== "initialized" ||
        (asset.companyMemoryBindings.length > 0 &&
          asset.companyMemoryBindings.every(
            (binding) =>
              isNonEmpty(binding.ref) && isSha256(binding.contentHash),
          )),
    );
  const temporalContextRebuildable =
    isNonEmpty(normalized.knowledge.temporalContextArtifactRef) &&
    isSha256(normalized.knowledge.temporalContextInputHash) &&
    isSha256(normalized.knowledge.temporalContextSnapshotHash) &&
    isSha256(normalized.knowledge.temporalContextReplayRootHash) &&
    normalized.knowledge.temporalContextReplayValid &&
    assets.every(
      (asset) =>
        asset.initializationStatus !== "initialized" ||
        asset.temporalContextSnapshotRef ===
          normalized.knowledge.temporalContextArtifactRef,
    );

  const failures: CaioInitializationFailure[] = [];
  const duplicateAssetRefs =
    new Set(assets.map((asset) => asset.assetRef)).size !== assets.length;
  const duplicateSourceRefs =
    new Set(sources.map((source) => source.sourceRef)).size !==
    sources.length;
  const duplicateEvidenceRefs =
    new Set(
      normalized.evidenceTraces.map((trace) => trace.evidenceRef),
    ).size !== normalized.evidenceTraces.length;
  addFailure(
    failures,
    !isNonEmpty(normalized.workspaceRef) ||
      !isNonEmpty(normalized.mandateRef) ||
      !Number.isFinite(Date.parse(input.evaluatedAt)) ||
      !Number.isInteger(normalized.registeredWritePathCount) ||
      normalized.registeredWritePathCount < 0 ||
      duplicateAssetRefs ||
      duplicateSourceRefs ||
      duplicateEvidenceRefs,
    "input_invalid",
  );
  addFailure(failures, assets.length === 0, "asset_catalog_empty");
  addFailure(
    failures,
    completeStates.length !== assets.length,
    "asset_state_incomplete",
  );
  addFailure(
    failures,
    incompleteAssetExceptions.length > 0,
    "asset_exception_incomplete",
  );
  addFailure(
    failures,
    initializationRate !== null &&
      initializationRate <
        CAIO_INITIALIZATION_POLICY.requiredInitializationRate,
    "authorized_feasible_asset_not_initialized",
  );
  addFailure(
    failures,
    authorizedFeasible.some(
      (asset) =>
        asset.initializationStatus === "initialized" &&
        !isNonEmpty(asset.initializationReceiptRef),
    ),
    "initialized_asset_missing_receipt",
  );
  addFailure(
    failures,
    authorizedFeasible.some(
      (asset) =>
        asset.initializationStatus === "initialized" &&
        asset.observationRunRefs.length === 0,
    ),
    "initialized_asset_missing_observation_run",
  );
  addFailure(
    failures,
    authorizedFeasible.some(
      (asset) =>
        asset.initializationStatus === "initialized" &&
        asset.schemaMappingRefs.length === 0,
    ),
    "initialized_asset_missing_schema_mapping",
  );
  addFailure(
    failures,
    authorizedFeasible.some(
      (asset) =>
        asset.initializationStatus === "initialized" &&
        asset.companyMemoryBindings.length === 0,
    ),
    "initialized_asset_missing_company_memory",
  );
  addFailure(
    failures,
    authorizedFeasible.some(
      (asset) =>
        asset.initializationStatus === "initialized" &&
        !isNonEmpty(asset.temporalContextSnapshotRef),
    ),
    "initialized_asset_missing_temporal_context",
  );
  addFailure(failures, sources.length === 0, "connected_source_missing");
  addFailure(
    failures,
    sources.some((source) => source.compatibilityMode),
    "compatibility_source_present",
  );
  addFailure(
    failures,
    sourceHealthRate !== null &&
      sourceHealthRate <
        CAIO_INITIALIZATION_POLICY.minimumSourceHealthRate &&
      incompleteSourceExceptions.length > 0,
    "connected_source_health_below_threshold",
  );
  addFailure(
    failures,
    sourceHealthRate !== null &&
      sourceHealthRate <
        CAIO_INITIALIZATION_POLICY.minimumSourceHealthRate &&
      incompleteSourceExceptions.length > 0,
    "source_exception_incomplete",
  );
  addFailure(
    failures,
    evidenceSample.length === 0,
    "evidence_trace_sample_empty",
  );
  addFailure(
    failures,
    evidenceTraceabilityRate !== null &&
      evidenceTraceabilityRate <
        CAIO_INITIALIZATION_POLICY.requiredEvidenceTraceabilityRate,
    "evidence_traceability_failed",
  );
  addFailure(
    failures,
    !coverageComplete(
      normalized.evidenceTraces,
      evidenceSample,
      (trace) => trace.sourceRef,
    ),
    "evidence_source_coverage_incomplete",
  );
  addFailure(
    failures,
    !coverageComplete(
      normalized.evidenceTraces,
      evidenceSample,
      (trace) => trace.sensitivity,
    ),
    "evidence_sensitivity_coverage_incomplete",
  );
  addFailure(
    failures,
    !coverageComplete(
      normalized.evidenceTraces,
      evidenceSample,
      (trace) => trace.outputType,
    ),
    "evidence_output_type_coverage_incomplete",
  );
  addFailure(
    failures,
    !memoryRebuildable,
    "company_memory_not_rebuildable",
  );
  addFailure(
    failures,
    !temporalContextRebuildable,
    "temporal_context_not_rebuildable",
  );
  addFailure(
    failures,
    normalized.registeredWritePathCount !== 0,
    "registered_write_path_present",
  );

  const uniqueFailures = [...new Set(failures)].sort((left, right) =>
    left.localeCompare(right),
  );
  const metrics: CaioInitializationMetrics = {
    catalogAssetCount: assets.length,
    completeAssetStateCount: completeStates.length,
    authorizedFeasibleAssetCount: authorizedFeasible.length,
    initializedAuthorizedFeasibleAssetCount:
      initializedAuthorizedFeasible.length,
    initializationRate,
    connectedSourceCount: sources.length,
    healthySourceCount: healthySources.length,
    sourceHealthRate,
    completeExceptionCount,
    evidenceCandidateCount: normalized.evidenceTraces.length,
    evidenceSampleCount: evidenceSample.length,
    traceableEvidenceSampleCount: traceableSample.length,
    evidenceTraceabilityRate,
    registeredWritePathCount: normalized.registeredWritePathCount,
  };
  const checks: CaioInitializationCheck[] = [
    check(
      "asset_catalog_present",
      assets.length > 0,
      "At least one in-scope data asset is registered.",
      assets.map((asset) => asset.assetRef),
    ),
    check(
      "authorized_feasible_assets_initialized",
      initializationRate === 1,
      "Every authorized and technically feasible asset is initialized.",
      authorizedFeasible
        .map((asset) => asset.initializationReceiptRef)
        .filter(isNonEmpty),
    ),
    check(
      "source_health_or_exceptions",
      Boolean(
        sourceHealthRate !== null &&
          (sourceHealthRate >=
            CAIO_INITIALIZATION_POLICY.minimumSourceHealthRate ||
            incompleteSourceExceptions.length === 0),
      ),
      "Connected sources meet the health floor or have complete transparent exceptions.",
      exceptionRefs,
    ),
    check(
      "evidence_traceability",
      evidenceTraceabilityRate === 1 && evidenceSample.length > 0,
      "The deterministic evidence sample resolves to asset, authorization and observation receipts.",
      evidenceSample.map((trace) => trace.evidenceRef),
    ),
    check(
      "company_memory_rebuildable",
      memoryRebuildable,
      "Company Memory bindings are present and content-hashed.",
      normalized.knowledge.memoryRebuildReceiptRef
        ? [normalized.knowledge.memoryRebuildReceiptRef]
        : [],
    ),
    check(
      "temporal_context_rebuildable",
      temporalContextRebuildable,
      "The temporal operating context is replay-valid and content-hashed.",
      normalized.knowledge.temporalContextArtifactRef
        ? [normalized.knowledge.temporalContextArtifactRef]
        : [],
    ),
    check(
      "no_registered_write_path",
      normalized.registeredWritePathCount === 0,
      "No source-system write path is registered in the assessed catalog.",
    ),
  ];
  const decision: CaioInitializationAssessment["decision"] =
    uniqueFailures.length === 0
      ? "ready_for_owner_acceptance"
      : "not_ready";
  const evidenceSampleHash = sha256(canonicalJson(evidenceSample));
  const assessmentSeed = {
    schemaVersion: CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION,
    workspaceRef: normalized.workspaceRef,
    mandateRef: normalized.mandateRef,
    evaluatorRevision: CAIO_INITIALIZATION_EVALUATOR_REVISION,
    policyRef: CAIO_INITIALIZATION_POLICY.policyRef,
    policyHash: CAIO_INITIALIZATION_POLICY.policyHash,
    basisHash,
    decision,
    metrics,
    checks,
    failures: uniqueFailures,
    exceptionRefs,
    evidenceSample,
    evidenceSampleHash,
    knowledge: normalized.knowledge,
    ownerAcceptanceRequired: true as const,
    ownerApprovalRecorded: false as const,
    authorityEffect: "none" as const,
    evaluatedAt: input.evaluatedAt,
  };
  const assessmentIdSeed = sha256(canonicalJson(assessmentSeed));
  const assessmentWithoutHash = {
    ...assessmentSeed,
    assessmentId: `caio-g0-assessment:${assessmentIdSeed.slice(7, 31)}`,
  };
  return {
    ...assessmentWithoutHash,
    contentHash: sha256(canonicalJson(assessmentWithoutHash)),
  };
}

export function validateCaioInitializationAssessment(
  assessment: CaioInitializationAssessment,
): CaioInitializationValidation {
  const errors: string[] = [];
  if (
    assessment.schemaVersion !==
    CAIO_INITIALIZATION_ASSESSMENT_SCHEMA_VERSION
  ) {
    errors.push("assessment_schema_version_invalid");
  }
  if (!isNonEmpty(assessment.assessmentId)) {
    errors.push("assessment_id_required");
  }
  if (!isNonEmpty(assessment.workspaceRef)) {
    errors.push("assessment_workspace_ref_required");
  }
  if (!isNonEmpty(assessment.mandateRef)) {
    errors.push("assessment_mandate_ref_required");
  }
  if (assessment.policyHash !== CAIO_INITIALIZATION_POLICY.policyHash) {
    errors.push("assessment_policy_hash_mismatch");
  }
  if (!isSha256(assessment.basisHash)) {
    errors.push("assessment_basis_hash_invalid");
  }
  if (
    !Number.isFinite(Date.parse(assessment.evaluatedAt)) ||
    assessment.ownerAcceptanceRequired !== true ||
    assessment.ownerApprovalRecorded !== false ||
    assessment.authorityEffect !== "none"
  ) {
    errors.push("assessment_governance_boundary_invalid");
  }
  if (
    (assessment.failures.length === 0) !==
    (assessment.decision === "ready_for_owner_acceptance")
  ) {
    errors.push("assessment_decision_failure_mismatch");
  }
  if (
    assessment.evidenceSampleHash !==
    sha256(canonicalJson(assessment.evidenceSample))
  ) {
    errors.push("assessment_evidence_sample_hash_mismatch");
  }
  const { contentHash: _contentHash, ...content } = assessment;
  if (assessment.contentHash !== sha256(canonicalJson(content))) {
    errors.push("assessment_content_hash_mismatch");
  }
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
  };
}
