import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  MODEL_DEPLOYMENT_FORMS,
  MODEL_GOVERNANCE_PERSISTED_INT_MAX,
  MODEL_JURISDICTIONS,
  MODEL_ROUTE_TASK_CLASSES,
  isSafeModelGovernanceIdentifier,
  isSafeModelGovernanceRef,
  routeAllowsClassification,
  validateTenantModelRoute,
  type ContractValidationResult,
  type EffectiveModelDataClassification,
  type ModelRouteTaskClass,
  type TenantModelRoute,
} from "@/lib/llm/model-route-contracts";
import type {
  DataAssetProcessingDisposition,
} from "@/lib/stage1-owner-loop/data-asset-catalog.types";
import type {
  ObservationSensitivity,
} from "@/lib/stage1-owner-loop/types";

export const MODEL_ROUTE_DECISIONS = ["allowed", "blocked"] as const;
export type ModelRouteDecisionOutcome =
  (typeof MODEL_ROUTE_DECISIONS)[number];

export const MODEL_EGRESS_RECEIPT_PHASES = [
  "dispatch_started",
  "terminal",
] as const;
export type ModelEgressReceiptPhase =
  (typeof MODEL_EGRESS_RECEIPT_PHASES)[number];

export const MODEL_EGRESS_OUTCOMES = [
  "unknown",
  "success",
  "failure",
  "partial",
] as const;
export type ModelEgressOutcome = (typeof MODEL_EGRESS_OUTCOMES)[number];

export const MODEL_EGRESS_COST_BANDS = [
  "unknown",
  "zero",
  "low",
  "medium",
  "high",
] as const;
export type ModelEgressCostBand =
  (typeof MODEL_EGRESS_COST_BANDS)[number];

export const MODEL_EGRESS_RESOLUTION_SOURCES = [
  "none",
  "invoke",
  "reconcile",
] as const;
export type ModelEgressResolutionSource =
  (typeof MODEL_EGRESS_RESOLUTION_SOURCES)[number];

export type ModelSourceAssetBinding = {
  assetRef: string;
  assetVersion: number;
  inventoryStatus: "confirmed";
  classificationStatus: "classified";
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  classificationReceiptRef: string;
  classificationReceiptHash: string;
  authorizationStatus: "authorized";
  authorizationReceiptRef: string;
  authorizationReceiptHash: string;
  authorizationValidFrom: string | null;
  authorizationValidUntil: string | null;
};

export type GovernedModelProjectionReceipt = {
  schemaVersion: "helm.governed-model-projection-receipt/v1";
  receiptId: string;
  workspaceRef: string;
  idempotencyKey: string;
  sourceAssetRefs: readonly string[];
  sourceAssetBindings: readonly ModelSourceAssetBinding[];
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectedPayloadHash: string;
  projectedPayloadBytes: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  remoteSafe: boolean;
  redactionStatus: "synthetic" | "redacted" | "alias_only";
  promptInjectionScanStatus: "passed" | "failed" | "not_run";
  projectorRegistrationRef: string;
  projectorRegistrationHash: string;
  projectorVersion: string;
  scannerRegistrationRef: string;
  scannerRegistrationHash: string;
  scannerVersion: string;
  validUntil: string;
  createdAt: string;
  rawContentIncluded: false;
  authorityEffect: "evidence_only";
  contentHash: string;
};

export type ModelRouteDecision = {
  schemaVersion: "helm.model-route-decision/v1";
  decisionId: string;
  workspaceRef: string;
  requestKey: string;
  requestHash: string;
  attemptOrdinal: number;
  parentDecisionRef: string | null;
  policyKey: string;
  policyRef: string;
  policyHash: string;
  policyHeadVersion: number;
  policyRevocationEpoch: number;
  readinessReceiptRef: string | null;
  readinessReceiptHash: string | null;
  taskClass: ModelRouteTaskClass;
  taskRef: string;
  requestedMaxOutputTokens: number;
  allowFallback: boolean;
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  classificationReasonCodes: readonly string[];
  sourceAssetRefs: readonly string[];
  sourceAssetBindings: readonly ModelSourceAssetBinding[];
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectionReceiptRef: string | null;
  projectionReceiptHash: string | null;
  projectedPayloadHash: string;
  promptInjectionScanStatus: "passed" | "failed" | "not_run";
  routeRef: string | null;
  routeSnapshot: TenantModelRoute | null;
  adapterReadinessState: "ready" | "not_ready" | "unknown";
  catalogVisibilityState: "visible" | "hidden" | "unknown";
  decision: ModelRouteDecisionOutcome;
  reasonCodes: readonly string[];
  requestedFallbackRouteRef: string | null;
  fallbackFromRouteRef: string | null;
  fallbackReason: string | null;
  validUntil: string;
  createdAt: string;
  rawContentIncluded: false;
  authorityEffect: "model_egress_only";
  contentHash: string;
};

export type ModelEgressReceipt = {
  schemaVersion: "helm.model-egress-receipt/v1";
  receiptId: string;
  workspaceRef: string;
  decisionRef: string;
  previousReceiptRef: string | null;
  previousReceiptHash: string | null;
  sequence: 1 | 2;
  idempotencyKey: string;
  phase: ModelEgressReceiptPhase;
  outcome: ModelEgressOutcome;
  resolutionSource: ModelEgressResolutionSource;
  provider: string;
  modelId: string;
  modelVersion: string;
  deploymentForm: TenantModelRoute["deploymentForm"];
  jurisdiction: TenantModelRoute["jurisdiction"];
  region: string;
  policyHash: string;
  readinessReceiptHash: string;
  projectedPayloadHash: string;
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectionReceiptRef: string | null;
  projectionReceiptHash: string | null;
  rawContentIncluded: false;
  dispatchGatewayRef: string | null;
  dispatchRuntimeHash: string | null;
  dispatchClaimHash: string | null;
  requestDisposition: "not_accepted" | "accepted" | "unknown";
  providerRequestRefHash: string | null;
  startedAt: string;
  finishedAt: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  actualCostUsdMicros: number | null;
  costCurrency: "USD" | null;
  pricingVersion: string | null;
  costBand: ModelEgressCostBand;
  errorCode: string | null;
  fallbackTargetRouteRef: string | null;
  fallbackReason: string | null;
  auditRef: string;
  recordedAt: string;
  authorityEffect: "evidence_only";
  contentHash: string;
};

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SAFE_REF_PATTERN =
  /^[a-z][a-z0-9_.-]*:[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,190}$/;
const SAFE_REASON_CODE_PATTERN =
  /^[a-z0-9][a-z0-9_.:-]{0,190}$/;
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const SAFE_ERROR_CODE_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

const SENSITIVITIES = new Set<ObservationSensitivity>([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
const PROCESSING_DISPOSITIONS =
  new Set<DataAssetProcessingDisposition>([
    "prohibited",
    "local_only",
    "remote_projected",
  ]);
const TASK_CLASSES = new Set<ModelRouteTaskClass>(
  MODEL_ROUTE_TASK_CLASSES,
);
const DEPLOYMENT_FORMS = new Set(MODEL_DEPLOYMENT_FORMS);
const JURISDICTIONS = new Set(MODEL_JURISDICTIONS);
const DECISIONS = new Set<ModelRouteDecisionOutcome>(
  MODEL_ROUTE_DECISIONS,
);
const RECEIPT_PHASES = new Set<ModelEgressReceiptPhase>(
  MODEL_EGRESS_RECEIPT_PHASES,
);
const EGRESS_OUTCOMES = new Set<ModelEgressOutcome>(
  MODEL_EGRESS_OUTCOMES,
);
const COST_BANDS = new Set<ModelEgressCostBand>(
  MODEL_EGRESS_COST_BANDS,
);
const REQUEST_DISPOSITIONS = new Set([
  "not_accepted",
  "accepted",
  "unknown",
]);
const RESOLUTION_SOURCES =
  new Set<ModelEgressResolutionSource>(
    MODEL_EGRESS_RESOLUTION_SOURCES,
  );
const PROMPT_INJECTION_SCAN_STATES = new Set([
  "passed",
  "failed",
  "not_run",
]);
const ADAPTER_READINESS_STATES = new Set([
  "ready",
  "not_ready",
  "unknown",
]);
const CATALOG_VISIBILITY_STATES = new Set([
  "visible",
  "hidden",
  "unknown",
]);

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function safeRef(value: string): boolean {
  return SAFE_REF_PATTERN.test(value);
}

function safeReasonCode(value: string): boolean {
  return SAFE_REASON_CODE_PATTERN.test(value);
}

function validateSafeRefs(
  values: readonly string[],
  error: string,
): string[] {
  return values.some((value) => !safeRef(value)) ? [error] : [];
}

function validInstant(value: string): boolean {
  return INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function validNonNegativeInt(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MODEL_GOVERNANCE_PERSISTED_INT_MAX
  );
}

function validPositiveInt(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MODEL_GOVERNANCE_PERSISTED_INT_MAX
  );
}

function refsArePartition(input: {
  sourceRefs: readonly string[];
  selectedRefs: readonly string[];
  droppedRefs: readonly string[];
}): boolean {
  const sourceRefs = uniqueSorted(input.sourceRefs);
  const selectedRefs = uniqueSorted(input.selectedRefs);
  const droppedRefs = uniqueSorted(input.droppedRefs);
  if (
    sourceRefs.length !== input.sourceRefs.length ||
    selectedRefs.length !== input.selectedRefs.length ||
    droppedRefs.length !== input.droppedRefs.length
  ) {
    return false;
  }
  const selected = new Set(selectedRefs);
  if (droppedRefs.some((ref) => selected.has(ref))) return false;
  return (
    canonicalJson(uniqueSorted([...selectedRefs, ...droppedRefs])) ===
    canonicalJson(sourceRefs)
  );
}

function normalizedRoute(route: TenantModelRoute | null) {
  if (!route) return null;
  return {
    ...route,
    allowedTaskClasses: uniqueSorted(route.allowedTaskClasses),
    allowedProcessingDispositions: uniqueSorted(
      route.allowedProcessingDispositions,
    ),
    fallbackRouteIds: [...route.fallbackRouteIds],
  };
}

function routeDecisionHashContent(decision: ModelRouteDecision) {
  return {
    schemaVersion: decision.schemaVersion,
    decisionId: decision.decisionId,
    workspaceRef: decision.workspaceRef,
    requestKey: decision.requestKey,
    requestHash: decision.requestHash,
    attemptOrdinal: decision.attemptOrdinal,
    parentDecisionRef: decision.parentDecisionRef,
    policyKey: decision.policyKey,
    policyRef: decision.policyRef,
    policyHash: decision.policyHash,
    policyHeadVersion: decision.policyHeadVersion,
    policyRevocationEpoch: decision.policyRevocationEpoch,
    readinessReceiptRef: decision.readinessReceiptRef,
    readinessReceiptHash: decision.readinessReceiptHash,
    taskClass: decision.taskClass,
    taskRef: decision.taskRef,
    requestedMaxOutputTokens:
      decision.requestedMaxOutputTokens,
    allowFallback: decision.allowFallback,
    sensitivity: decision.sensitivity,
    processingDisposition: decision.processingDisposition,
    classificationReasonCodes: uniqueSorted(
      decision.classificationReasonCodes,
    ),
    sourceAssetRefs: uniqueSorted(decision.sourceAssetRefs),
    sourceAssetBindings: [...decision.sourceAssetBindings].sort((left, right) =>
      left.assetRef.localeCompare(right.assetRef),
    ),
    candidateEvidenceRefs: uniqueSorted(decision.candidateEvidenceRefs),
    selectedEvidenceRefs: uniqueSorted(decision.selectedEvidenceRefs),
    droppedEvidenceRefs: uniqueSorted(decision.droppedEvidenceRefs),
    projectionReceiptRef: decision.projectionReceiptRef,
    projectionReceiptHash: decision.projectionReceiptHash,
    projectedPayloadHash: decision.projectedPayloadHash,
    promptInjectionScanStatus: decision.promptInjectionScanStatus,
    routeRef: decision.routeRef,
    routeSnapshot: normalizedRoute(decision.routeSnapshot),
    adapterReadinessState: decision.adapterReadinessState,
    catalogVisibilityState: decision.catalogVisibilityState,
    decision: decision.decision,
    reasonCodes: uniqueSorted(decision.reasonCodes),
    requestedFallbackRouteRef: decision.requestedFallbackRouteRef,
    fallbackFromRouteRef: decision.fallbackFromRouteRef,
    fallbackReason: decision.fallbackReason,
    validUntil: decision.validUntil,
    createdAt: decision.createdAt,
    rawContentIncluded: decision.rawContentIncluded,
    authorityEffect: decision.authorityEffect,
  };
}

function modelEgressReceiptHashContent(receipt: ModelEgressReceipt) {
  return {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    workspaceRef: receipt.workspaceRef,
    decisionRef: receipt.decisionRef,
    previousReceiptRef: receipt.previousReceiptRef,
    previousReceiptHash: receipt.previousReceiptHash,
    sequence: receipt.sequence,
    idempotencyKey: receipt.idempotencyKey,
    phase: receipt.phase,
    outcome: receipt.outcome,
    resolutionSource: receipt.resolutionSource,
    provider: receipt.provider,
    modelId: receipt.modelId,
    modelVersion: receipt.modelVersion,
    deploymentForm: receipt.deploymentForm,
    jurisdiction: receipt.jurisdiction,
    region: receipt.region,
    policyHash: receipt.policyHash,
    readinessReceiptHash: receipt.readinessReceiptHash,
    projectedPayloadHash: receipt.projectedPayloadHash,
    selectedEvidenceRefs: uniqueSorted(receipt.selectedEvidenceRefs),
    droppedEvidenceRefs: uniqueSorted(receipt.droppedEvidenceRefs),
    projectionReceiptRef: receipt.projectionReceiptRef,
    projectionReceiptHash: receipt.projectionReceiptHash,
    rawContentIncluded: receipt.rawContentIncluded,
    dispatchGatewayRef: receipt.dispatchGatewayRef,
    dispatchRuntimeHash: receipt.dispatchRuntimeHash,
    dispatchClaimHash: receipt.dispatchClaimHash,
    requestDisposition: receipt.requestDisposition,
    providerRequestRefHash: receipt.providerRequestRefHash,
    startedAt: receipt.startedAt,
    finishedAt: receipt.finishedAt,
    latencyMs: receipt.latencyMs,
    promptTokens: receipt.promptTokens,
    completionTokens: receipt.completionTokens,
    actualCostUsdMicros: receipt.actualCostUsdMicros,
    costCurrency: receipt.costCurrency,
    pricingVersion: receipt.pricingVersion,
    costBand: receipt.costBand,
    errorCode: receipt.errorCode,
    fallbackTargetRouteRef: receipt.fallbackTargetRouteRef,
    fallbackReason: receipt.fallbackReason,
    auditRef: receipt.auditRef,
    recordedAt: receipt.recordedAt,
    authorityEffect: receipt.authorityEffect,
  };
}

function modelProjectionReceiptHashContent(
  receipt: GovernedModelProjectionReceipt,
) {
  return {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    workspaceRef: receipt.workspaceRef,
    idempotencyKey: receipt.idempotencyKey,
    sourceAssetRefs: uniqueSorted(receipt.sourceAssetRefs),
    sourceAssetBindings: [...receipt.sourceAssetBindings].sort(
      (left, right) => left.assetRef.localeCompare(right.assetRef),
    ),
    candidateEvidenceRefs: uniqueSorted(
      receipt.candidateEvidenceRefs,
    ),
    selectedEvidenceRefs: uniqueSorted(
      receipt.selectedEvidenceRefs,
    ),
    droppedEvidenceRefs: uniqueSorted(
      receipt.droppedEvidenceRefs,
    ),
    projectedPayloadHash: receipt.projectedPayloadHash,
    projectedPayloadBytes: receipt.projectedPayloadBytes,
    maxInputTokens: receipt.maxInputTokens,
    maxOutputTokens: receipt.maxOutputTokens,
    remoteSafe: receipt.remoteSafe,
    redactionStatus: receipt.redactionStatus,
    promptInjectionScanStatus:
      receipt.promptInjectionScanStatus,
    projectorRegistrationRef: receipt.projectorRegistrationRef,
    projectorRegistrationHash:
      receipt.projectorRegistrationHash,
    projectorVersion: receipt.projectorVersion,
    scannerRegistrationRef: receipt.scannerRegistrationRef,
    scannerRegistrationHash: receipt.scannerRegistrationHash,
    scannerVersion: receipt.scannerVersion,
    validUntil: receipt.validUntil,
    createdAt: receipt.createdAt,
    rawContentIncluded: receipt.rawContentIncluded,
    authorityEffect: receipt.authorityEffect,
  };
}

export function computeGovernedModelProjectionReceiptHash(
  receipt: GovernedModelProjectionReceipt,
): string {
  return sha256(
    canonicalJson(modelProjectionReceiptHashContent(receipt)),
  );
}

export function computeModelRouteDecisionHash(
  decision: ModelRouteDecision,
): string {
  return sha256(canonicalJson(routeDecisionHashContent(decision)));
}

export function computeModelRouteRequestHash(input: {
  workspaceRef: string;
  requestKey: string;
  policyKey: string;
  taskClass: ModelRouteTaskClass;
  taskRef: string;
  requestedMaxOutputTokens: number;
  allowFallback: boolean;
  sourceAssetRefs: readonly string[];
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectionReceiptRef: string | null;
  projectionReceiptHash: string | null;
  projectedPayloadHash: string;
  promptInjectionScanStatus: ModelRouteDecision["promptInjectionScanStatus"];
  parentDecisionRef: string | null;
  requestedFallbackRouteRef: string | null;
  fallbackReason: string | null;
}): string {
  return sha256(
    canonicalJson({
      workspaceRef: input.workspaceRef,
      requestKey: input.requestKey,
      policyKey: input.policyKey,
      taskClass: input.taskClass,
      taskRef: input.taskRef,
      requestedMaxOutputTokens:
        input.requestedMaxOutputTokens,
      allowFallback: input.allowFallback,
      sourceAssetRefs: uniqueSorted(input.sourceAssetRefs),
      candidateEvidenceRefs: uniqueSorted(input.candidateEvidenceRefs),
      selectedEvidenceRefs: uniqueSorted(input.selectedEvidenceRefs),
      droppedEvidenceRefs: uniqueSorted(input.droppedEvidenceRefs),
      projectionReceiptRef: input.projectionReceiptRef,
      projectionReceiptHash: input.projectionReceiptHash,
      projectedPayloadHash: input.projectedPayloadHash,
      promptInjectionScanStatus: input.promptInjectionScanStatus,
      parentDecisionRef: input.parentDecisionRef,
      requestedFallbackRouteRef: input.requestedFallbackRouteRef,
      fallbackReason: input.fallbackReason,
    }),
  );
}

export function computeModelProviderIdempotencyKey(input: {
  decisionRef: string;
  dispatchClaimHash: string;
}): string {
  return `model-dispatch-${sha256(canonicalJson(input)).slice(
    "sha256:".length,
  )}`;
}

export function computeModelEgressReceiptHash(
  receipt: ModelEgressReceipt,
): string {
  return sha256(canonicalJson(modelEgressReceiptHashContent(receipt)));
}

export function validateGovernedModelProjectionReceipt(
  receipt: GovernedModelProjectionReceipt,
): ContractValidationResult {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
    "helm.governed-model-projection-receipt/v1"
  ) {
    errors.push("unsupported_projection_receipt_schema_version");
  }
  if (!isSafeModelGovernanceIdentifier(receipt.receiptId)) {
    errors.push("projection_receipt_id_invalid");
  }
  if (!receipt.workspaceRef.startsWith("workspace:")) {
    errors.push("workspace_ref_invalid");
  }
  if (!isSafeModelGovernanceIdentifier(receipt.idempotencyKey)) {
    errors.push("projection_idempotency_key_invalid");
  }
  if (
    receipt.sourceAssetRefs.length === 0 ||
    receipt.sourceAssetRefs.some(
      (ref) => !isSafeModelGovernanceIdentifier(ref),
    ) ||
    new Set(receipt.sourceAssetRefs).size !==
      receipt.sourceAssetRefs.length
  ) {
    errors.push("projection_source_asset_refs_invalid");
  }
  const bindingRefs = receipt.sourceAssetBindings.map(
    (binding) => binding.assetRef,
  );
  if (
    canonicalJson(uniqueSorted(bindingRefs)) !==
    canonicalJson(uniqueSorted(receipt.sourceAssetRefs))
  ) {
    errors.push("projection_source_asset_bindings_required");
  }
  for (const binding of receipt.sourceAssetBindings) {
    if (
      !isSafeModelGovernanceIdentifier(binding.assetRef) ||
      !validPositiveInt(binding.assetVersion) ||
      binding.inventoryStatus !== "confirmed" ||
      binding.classificationStatus !== "classified" ||
      binding.authorizationStatus !== "authorized" ||
      !SENSITIVITIES.has(binding.sensitivity) ||
      !PROCESSING_DISPOSITIONS.has(binding.processingDisposition) ||
      !isSafeModelGovernanceIdentifier(
        binding.classificationReceiptRef,
      ) ||
      !isSafeModelGovernanceIdentifier(
        binding.authorizationReceiptRef,
      ) ||
      !HASH_PATTERN.test(binding.classificationReceiptHash) ||
      !HASH_PATTERN.test(binding.authorizationReceiptHash)
    ) {
      errors.push("projection_source_asset_binding_invalid");
    }
    if (
      (binding.authorizationValidFrom !== null &&
        !validInstant(binding.authorizationValidFrom)) ||
      (binding.authorizationValidUntil !== null &&
        !validInstant(binding.authorizationValidUntil)) ||
      (binding.authorizationValidFrom !== null &&
        binding.authorizationValidUntil !== null &&
        Date.parse(binding.authorizationValidUntil) <=
          Date.parse(binding.authorizationValidFrom))
    ) {
      errors.push("projection_source_asset_binding_window_invalid");
    }
  }
  if (
    !refsArePartition({
      sourceRefs: receipt.candidateEvidenceRefs,
      selectedRefs: receipt.selectedEvidenceRefs,
      droppedRefs: receipt.droppedEvidenceRefs,
    })
  ) {
    errors.push("projection_evidence_partition_invalid");
  }
  errors.push(
    ...validateSafeRefs(
      receipt.candidateEvidenceRefs,
      "candidate_evidence_ref_invalid",
    ),
    ...validateSafeRefs(
      receipt.selectedEvidenceRefs,
      "selected_evidence_ref_invalid",
    ),
    ...validateSafeRefs(
      receipt.droppedEvidenceRefs,
      "dropped_evidence_ref_invalid",
    ),
  );
  if (!HASH_PATTERN.test(receipt.projectedPayloadHash)) {
    errors.push("projected_payload_hash_invalid");
  }
  if (
    !validPositiveInt(receipt.projectedPayloadBytes) ||
    !validPositiveInt(receipt.maxInputTokens) ||
    !validPositiveInt(receipt.maxOutputTokens)
  ) {
    errors.push("projection_budget_or_size_invalid");
  }
  if (
    !["synthetic", "redacted", "alias_only"].includes(
      receipt.redactionStatus,
    )
  ) {
    errors.push("projection_redaction_status_invalid");
  }
  if (
    !PROMPT_INJECTION_SCAN_STATES.has(
      receipt.promptInjectionScanStatus,
    )
  ) {
    errors.push("projection_scan_status_invalid");
  }
  for (const [field, value] of [
    ["projector_registration_ref", receipt.projectorRegistrationRef],
    ["scanner_registration_ref", receipt.scannerRegistrationRef],
  ] as const) {
    if (!isSafeModelGovernanceRef(value)) {
      errors.push(`${field}_invalid`);
    }
  }
  for (const [field, value] of [
    [
      "projector_registration_hash",
      receipt.projectorRegistrationHash,
    ],
    ["scanner_registration_hash", receipt.scannerRegistrationHash],
  ] as const) {
    if (!HASH_PATTERN.test(value)) errors.push(`${field}_invalid`);
  }
  for (const [field, value] of [
    ["projector_version", receipt.projectorVersion],
    ["scanner_version", receipt.scannerVersion],
  ] as const) {
    if (!isSafeModelGovernanceIdentifier(value)) {
      errors.push(`${field}_invalid`);
    }
  }
  if (
    !validInstant(receipt.createdAt) ||
    !validInstant(receipt.validUntil) ||
    Date.parse(receipt.validUntil) <= Date.parse(receipt.createdAt)
  ) {
    errors.push("projection_validity_window_invalid");
  }
  if (receipt.rawContentIncluded !== false) {
    errors.push("projection_raw_content_must_be_excluded");
  }
  if (receipt.authorityEffect !== "evidence_only") {
    errors.push("projection_authority_effect_invalid");
  }
  if (!HASH_PATTERN.test(receipt.contentHash)) {
    errors.push("projection_receipt_hash_invalid");
  } else if (
    computeGovernedModelProjectionReceiptHash(receipt) !==
    receipt.contentHash
  ) {
    errors.push("projection_receipt_hash_mismatch");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateGovernedProjectionRouteBinding(input: {
  receipt: GovernedModelProjectionReceipt;
  route: TenantModelRoute;
}): ContractValidationResult {
  const errors: string[] = [];
  for (const [field, observed, expected] of [
    [
      "projector_registration_ref",
      input.receipt.projectorRegistrationRef,
      input.route.projectorRegistrationRef,
    ],
    [
      "projector_registration_hash",
      input.receipt.projectorRegistrationHash,
      input.route.projectorRegistrationHash,
    ],
    [
      "projector_version",
      input.receipt.projectorVersion,
      input.route.projectorVersion,
    ],
    [
      "scanner_registration_ref",
      input.receipt.scannerRegistrationRef,
      input.route.scannerRegistrationRef,
    ],
    [
      "scanner_registration_hash",
      input.receipt.scannerRegistrationHash,
      input.route.scannerRegistrationHash,
    ],
    [
      "scanner_version",
      input.receipt.scannerVersion,
      input.route.scannerVersion,
    ],
  ] as const) {
    if (observed !== expected) {
      errors.push(`projection_${field}_mismatch`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateCommonReferenceFields(
  input: ModelRouteDecision,
): string[] {
  const errors: string[] = [];
  for (const [field, value] of [
    ["decision_id", input.decisionId],
    ["policy_ref", input.policyRef],
    ["task_ref", input.taskRef],
  ] as const) {
    if (!safeRef(value)) errors.push(`${field}_invalid`);
  }
  if (!isSafeModelGovernanceIdentifier(input.requestKey)) {
    errors.push("request_key_invalid");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/.test(input.policyKey)) {
    errors.push("policy_key_invalid");
  }
  if (!input.workspaceRef.startsWith("workspace:")) {
    errors.push("workspace_ref_invalid");
  }
  if (!HASH_PATTERN.test(input.policyHash)) {
    errors.push("policy_hash_invalid");
  }
  if (!HASH_PATTERN.test(input.requestHash)) {
    errors.push("request_hash_invalid");
  } else if (
    computeModelRouteRequestHash({
      workspaceRef: input.workspaceRef,
      requestKey: input.requestKey,
      policyKey: input.policyKey,
      taskClass: input.taskClass,
      taskRef: input.taskRef,
      requestedMaxOutputTokens:
        input.requestedMaxOutputTokens,
      allowFallback: input.allowFallback,
      sourceAssetRefs: input.sourceAssetRefs,
      candidateEvidenceRefs: input.candidateEvidenceRefs,
      selectedEvidenceRefs: input.selectedEvidenceRefs,
      droppedEvidenceRefs: input.droppedEvidenceRefs,
      projectionReceiptRef: input.projectionReceiptRef,
      projectionReceiptHash: input.projectionReceiptHash,
      projectedPayloadHash: input.projectedPayloadHash,
      promptInjectionScanStatus: input.promptInjectionScanStatus,
      parentDecisionRef: input.parentDecisionRef,
      requestedFallbackRouteRef: input.requestedFallbackRouteRef,
      fallbackReason: input.fallbackReason,
    }) !== input.requestHash
  ) {
    errors.push("request_hash_mismatch");
  }
  if (!HASH_PATTERN.test(input.projectedPayloadHash)) {
    errors.push("projected_payload_hash_invalid");
  }
  if (input.rawContentIncluded !== false) {
    errors.push("raw_content_must_be_excluded");
  }
  if (input.authorityEffect !== "model_egress_only") {
    errors.push("authority_effect_must_be_model_egress_only");
  }
  errors.push(
    ...(input.sourceAssetRefs.some(
      (value) => !isSafeModelGovernanceIdentifier(value),
    )
      ? ["source_asset_ref_invalid"]
      : []),
    ...validateSafeRefs(
      input.candidateEvidenceRefs,
      "candidate_evidence_ref_invalid",
    ),
    ...validateSafeRefs(
      input.selectedEvidenceRefs,
      "selected_evidence_ref_invalid",
    ),
    ...validateSafeRefs(
      input.droppedEvidenceRefs,
      "dropped_evidence_ref_invalid",
    ),
  );
  if (
    input.classificationReasonCodes.some(
      (code) => !safeReasonCode(code),
    ) ||
    input.reasonCodes.some((code) => !safeReasonCode(code))
  ) {
    errors.push("reason_code_invalid");
  }
  if (
    input.fallbackReason !== null &&
    !safeReasonCode(input.fallbackReason)
  ) {
    errors.push("fallback_reason_code_invalid");
  }
  return errors;
}

export function validateModelRouteDecision(
  decision: ModelRouteDecision,
): ContractValidationResult {
  const errors = validateCommonReferenceFields(decision);
  if (decision.schemaVersion !== "helm.model-route-decision/v1") {
    errors.push("unsupported_route_decision_schema_version");
  }
  if (!validNonNegativeInt(decision.attemptOrdinal)) {
    errors.push("attempt_ordinal_invalid");
  }
  if (!validNonNegativeInt(decision.policyHeadVersion)) {
    errors.push("policy_head_version_invalid");
  }
  if (!validNonNegativeInt(decision.policyRevocationEpoch)) {
    errors.push("policy_revocation_epoch_invalid");
  }
  if (!TASK_CLASSES.has(decision.taskClass)) {
    errors.push("task_class_invalid");
  }
  if (!validPositiveInt(decision.requestedMaxOutputTokens)) {
    errors.push("requested_max_output_tokens_invalid");
  }
  if (typeof decision.allowFallback !== "boolean") {
    errors.push("allow_fallback_invalid");
  }
  if (
    decision.routeSnapshot &&
    decision.requestedMaxOutputTokens >
      decision.routeSnapshot.maxOutputTokens
  ) {
    errors.push("requested_output_exceeds_route");
  }
  if (!SENSITIVITIES.has(decision.sensitivity)) {
    errors.push("sensitivity_invalid");
  }
  if (!PROCESSING_DISPOSITIONS.has(decision.processingDisposition)) {
    errors.push("processing_disposition_invalid");
  }
  if (!DECISIONS.has(decision.decision)) {
    errors.push("decision_invalid");
  }
  if (
    !PROMPT_INJECTION_SCAN_STATES.has(
      decision.promptInjectionScanStatus,
    )
  ) {
    errors.push("prompt_injection_scan_status_invalid");
  }
  if (!ADAPTER_READINESS_STATES.has(decision.adapterReadinessState)) {
    errors.push("adapter_readiness_state_invalid");
  }
  if (!CATALOG_VISIBILITY_STATES.has(decision.catalogVisibilityState)) {
    errors.push("catalog_visibility_state_invalid");
  }
  if (
    !validInstant(decision.createdAt) ||
    !validInstant(decision.validUntil)
  ) {
    errors.push("decision_validity_window_invalid");
  } else if (
    Date.parse(decision.validUntil) <= Date.parse(decision.createdAt)
  ) {
    errors.push("decision_expiry_must_follow_creation");
  }
  if (
    !refsArePartition({
      sourceRefs: decision.candidateEvidenceRefs,
      selectedRefs: decision.selectedEvidenceRefs,
      droppedRefs: decision.droppedEvidenceRefs,
    })
  ) {
    errors.push("evidence_partition_invalid");
  }
  if (
    new Set(decision.sourceAssetRefs).size !==
    decision.sourceAssetRefs.length
  ) {
    errors.push("source_asset_refs_invalid");
  }
  const bindingRefs = decision.sourceAssetBindings.map(
    (binding) => binding.assetRef,
  );
  if (new Set(bindingRefs).size !== bindingRefs.length) {
    errors.push("source_asset_bindings_duplicate");
  }
  if (
    bindingRefs.some(
      (assetRef) => !decision.sourceAssetRefs.includes(assetRef),
    )
  ) {
    errors.push("source_asset_binding_unknown");
  }
  for (const binding of decision.sourceAssetBindings) {
    if (!isSafeModelGovernanceIdentifier(binding.assetRef)) {
      errors.push("source_asset_binding_ref_invalid");
    }
    if (!validPositiveInt(binding.assetVersion)) {
      errors.push("source_asset_binding_version_invalid");
    }
    if (
      binding.inventoryStatus !== "confirmed" ||
      binding.classificationStatus !== "classified" ||
      binding.authorizationStatus !== "authorized"
    ) {
      errors.push("source_asset_binding_authority_invalid");
    }
    if (
      !SENSITIVITIES.has(binding.sensitivity) ||
      !PROCESSING_DISPOSITIONS.has(binding.processingDisposition)
    ) {
      errors.push("source_asset_binding_classification_invalid");
    }
    if (
      !isSafeModelGovernanceIdentifier(
        binding.classificationReceiptRef,
      ) ||
      !isSafeModelGovernanceIdentifier(
        binding.authorizationReceiptRef,
      )
    ) {
      errors.push("source_asset_binding_receipt_ref_invalid");
    }
    if (
      !HASH_PATTERN.test(binding.classificationReceiptHash) ||
      !HASH_PATTERN.test(binding.authorizationReceiptHash)
    ) {
      errors.push("source_asset_binding_receipt_hash_invalid");
    }
    if (
      binding.authorizationValidFrom !== null &&
      !validInstant(binding.authorizationValidFrom)
    ) {
      errors.push("source_asset_binding_valid_from_invalid");
    }
    if (
      binding.authorizationValidUntil !== null &&
      !validInstant(binding.authorizationValidUntil)
    ) {
      errors.push("source_asset_binding_valid_until_invalid");
    }
    if (
      binding.authorizationValidFrom !== null &&
      binding.authorizationValidUntil !== null &&
      Date.parse(binding.authorizationValidUntil) <=
        Date.parse(binding.authorizationValidFrom)
    ) {
      errors.push("source_asset_binding_validity_window_invalid");
    }
  }
  if (
    decision.attemptOrdinal === 0 &&
    (decision.parentDecisionRef !== null ||
      decision.requestedFallbackRouteRef !== null ||
      decision.fallbackFromRouteRef !== null ||
      decision.fallbackReason !== null)
  ) {
    errors.push("primary_decision_must_not_reference_fallback");
  }
  if (
    decision.attemptOrdinal > 0 &&
    (!decision.parentDecisionRef ||
      !decision.requestedFallbackRouteRef ||
      !decision.fallbackFromRouteRef ||
      !decision.fallbackReason)
  ) {
    errors.push("fallback_decision_lineage_required");
  }
  for (const [field, value] of [
    ["parent_decision_ref", decision.parentDecisionRef],
    ["readiness_receipt_ref", decision.readinessReceiptRef],
    ["projection_receipt_ref", decision.projectionReceiptRef],
  ] as const) {
    if (value !== null && !isSafeModelGovernanceRef(value)) {
      errors.push(`${field}_invalid`);
    }
  }
  for (const [field, value] of [
    ["route_ref", decision.routeRef],
    ["requested_fallback_route_ref", decision.requestedFallbackRouteRef],
    ["fallback_from_route_ref", decision.fallbackFromRouteRef],
  ] as const) {
    if (
      value !== null &&
      !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/.test(value)
    ) {
      errors.push(`${field}_invalid`);
    }
  }

  if (decision.decision === "allowed") {
    if (
      canonicalJson(uniqueSorted(bindingRefs)) !==
      canonicalJson(uniqueSorted(decision.sourceAssetRefs))
    ) {
      errors.push("allowed_decision_source_asset_bindings_required");
    }
    if (
      !decision.routeRef ||
      !decision.routeSnapshot ||
      !decision.readinessReceiptRef ||
      !decision.readinessReceiptHash
    ) {
      errors.push("allowed_decision_route_and_readiness_required");
    }
    if (decision.adapterReadinessState !== "ready") {
      errors.push("allowed_decision_requires_ready_adapter");
    }
    if (decision.promptInjectionScanStatus !== "passed") {
      errors.push("allowed_decision_requires_passed_injection_scan");
    }
    if (decision.reasonCodes.length > 0) {
      errors.push("allowed_decision_must_not_have_block_reasons");
    }
    if (!validPositiveInt(decision.policyHeadVersion)) {
      errors.push("allowed_decision_requires_active_policy_head");
    }
  } else if (decision.reasonCodes.length === 0) {
    errors.push("blocked_decision_reason_required");
  }

  if (decision.routeSnapshot) {
    errors.push(
      ...validateTenantModelRoute(decision.routeSnapshot).errors,
    );
    if (decision.routeSnapshot.routeId !== decision.routeRef) {
      errors.push("route_snapshot_ref_mismatch");
    }
    if (
      decision.readinessReceiptRef !==
      decision.routeSnapshot.readinessReceiptRef
    ) {
      errors.push("route_readiness_ref_mismatch");
    }
    if (
      decision.readinessReceiptHash !==
      decision.routeSnapshot.readinessReceiptHash
    ) {
      errors.push("route_readiness_hash_mismatch");
    }
    const classification: EffectiveModelDataClassification = {
      sensitivity: decision.sensitivity,
      processingDisposition: decision.processingDisposition,
      reasonCodes: decision.classificationReasonCodes,
    };
    const routeClassificationErrors = routeAllowsClassification({
      route: decision.routeSnapshot,
      taskClass: decision.taskClass,
      classification,
    }).errors;
    if (decision.decision === "allowed") {
      errors.push(...routeClassificationErrors);
    } else if (
      routeClassificationErrors.some(
        (reason) => !decision.reasonCodes.includes(reason),
      )
    ) {
      errors.push("blocked_decision_missing_route_reason");
    }

    const remoteRoute =
      decision.routeSnapshot.deploymentForm !== "local";
    if (
      decision.decision === "allowed" &&
      remoteRoute &&
      (decision.processingDisposition !== "remote_projected" ||
        !decision.projectionReceiptRef ||
        !decision.projectionReceiptHash)
    ) {
      errors.push("remote_route_requires_projection_receipt");
    }
  }
  if (
    decision.attemptOrdinal > 0 &&
    decision.decision === "allowed" &&
    decision.requestedFallbackRouteRef !== decision.routeRef
  ) {
    errors.push("fallback_target_route_mismatch");
  }
  if (
    (decision.projectionReceiptRef === null) !==
    (decision.projectionReceiptHash === null)
  ) {
    errors.push("projection_receipt_ref_hash_pair_required");
  }
  if (
    decision.projectionReceiptHash !== null &&
    !HASH_PATTERN.test(decision.projectionReceiptHash)
  ) {
    errors.push("projection_receipt_hash_invalid");
  }
  if (
    decision.readinessReceiptHash !== null &&
    !HASH_PATTERN.test(decision.readinessReceiptHash)
  ) {
    errors.push("readiness_receipt_hash_invalid");
  }
  if (!HASH_PATTERN.test(decision.contentHash)) {
    errors.push("route_decision_hash_invalid");
  } else if (
    computeModelRouteDecisionHash(decision) !== decision.contentHash
  ) {
    errors.push("route_decision_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function validateModelEgressReceipt(
  receipt: ModelEgressReceipt,
): ContractValidationResult {
  const errors: string[] = [];
  if (receipt.schemaVersion !== "helm.model-egress-receipt/v1") {
    errors.push("unsupported_egress_receipt_schema_version");
  }
  for (const [field, value] of [
    ["receipt_id", receipt.receiptId],
    ["decision_ref", receipt.decisionRef],
    ["idempotency_key", receipt.idempotencyKey],
    ["provider", receipt.provider],
    ["model_id", receipt.modelId],
    ["model_version", receipt.modelVersion],
    ["region", receipt.region],
  ] as const) {
    if (!nonEmpty(value)) errors.push(`${field}_required`);
  }
  for (const [field, value] of [
    ["receipt_id", receipt.receiptId],
    ["decision_ref", receipt.decisionRef],
  ] as const) {
    if (!safeRef(value)) errors.push(`${field}_invalid`);
  }
  if (!isSafeModelGovernanceIdentifier(receipt.idempotencyKey)) {
    errors.push("idempotency_key_invalid");
  }
  if (!isSafeModelGovernanceIdentifier(receipt.auditRef)) {
    errors.push("audit_ref_invalid");
  }
  for (const [field, value] of [
    ["provider", receipt.provider],
    ["model_id", receipt.modelId],
    ["model_version", receipt.modelVersion],
    ["region", receipt.region],
  ] as const) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/.test(value)) {
      errors.push(`${field}_invalid`);
    }
  }
  errors.push(
    ...validateSafeRefs(
      receipt.selectedEvidenceRefs,
      "selected_evidence_ref_invalid",
    ),
    ...validateSafeRefs(
      receipt.droppedEvidenceRefs,
      "dropped_evidence_ref_invalid",
    ),
  );
  if (!receipt.workspaceRef.startsWith("workspace:")) {
    errors.push("workspace_ref_invalid");
  }
  for (const [field, value] of [
    ["policy_hash", receipt.policyHash],
    ["readiness_receipt_hash", receipt.readinessReceiptHash],
    ["projected_payload_hash", receipt.projectedPayloadHash],
  ] as const) {
    if (!HASH_PATTERN.test(value)) errors.push(`${field}_invalid`);
  }
  if (!RECEIPT_PHASES.has(receipt.phase)) {
    errors.push("receipt_phase_invalid");
  }
  if (!EGRESS_OUTCOMES.has(receipt.outcome)) {
    errors.push("receipt_outcome_invalid");
  }
  if (!REQUEST_DISPOSITIONS.has(receipt.requestDisposition)) {
    errors.push("request_disposition_invalid");
  }
  if (!RESOLUTION_SOURCES.has(receipt.resolutionSource)) {
    errors.push("resolution_source_invalid");
  }
  if (!COST_BANDS.has(receipt.costBand)) {
    errors.push("cost_band_invalid");
  }
  if (!DEPLOYMENT_FORMS.has(receipt.deploymentForm)) {
    errors.push("deployment_form_invalid");
  }
  if (!JURISDICTIONS.has(receipt.jurisdiction)) {
    errors.push("jurisdiction_invalid");
  }
  if (
    !validInstant(receipt.startedAt) ||
    !validInstant(receipt.recordedAt)
  ) {
    errors.push("receipt_time_invalid");
  }
  if (receipt.rawContentIncluded !== false) {
    errors.push("raw_content_must_be_excluded");
  }
  if (receipt.authorityEffect !== "evidence_only") {
    errors.push("authority_effect_must_be_evidence_only");
  }
  if (
    receipt.providerRequestRefHash !== null &&
    !HASH_PATTERN.test(receipt.providerRequestRefHash)
  ) {
    errors.push("provider_request_ref_hash_invalid");
  }
  if (
    receipt.dispatchRuntimeHash !== null &&
    !HASH_PATTERN.test(receipt.dispatchRuntimeHash)
  ) {
    errors.push("dispatch_runtime_hash_invalid");
  }
  if (
    receipt.dispatchClaimHash !== null &&
    !HASH_PATTERN.test(receipt.dispatchClaimHash)
  ) {
    errors.push("dispatch_claim_hash_invalid");
  }
  if (
    receipt.dispatchGatewayRef !== null &&
    !isSafeModelGovernanceRef(receipt.dispatchGatewayRef)
  ) {
    errors.push("dispatch_gateway_ref_invalid");
  }
  if (
    receipt.previousReceiptHash !== null &&
    !HASH_PATTERN.test(receipt.previousReceiptHash)
  ) {
    errors.push("previous_receipt_hash_invalid");
  }
  if (
    receipt.projectionReceiptRef !== null &&
    !safeRef(receipt.projectionReceiptRef)
  ) {
    errors.push("projection_receipt_ref_invalid");
  }
  if (
    receipt.fallbackReason !== null &&
    !safeReasonCode(receipt.fallbackReason)
  ) {
    errors.push("fallback_reason_code_invalid");
  }
  for (const [field, value] of [
    ["latency_ms", receipt.latencyMs],
    ["prompt_tokens", receipt.promptTokens],
    ["completion_tokens", receipt.completionTokens],
    ["actual_cost_usd_micros", receipt.actualCostUsdMicros],
  ] as const) {
    if (value !== null && !validNonNegativeInt(value)) {
      errors.push(`${field}_invalid`);
    }
  }
  if (
    receipt.errorCode !== null &&
    !SAFE_ERROR_CODE_PATTERN.test(receipt.errorCode)
  ) {
    errors.push("safe_error_code_required");
  }
  if (
    (receipt.projectionReceiptRef === null) !==
    (receipt.projectionReceiptHash === null)
  ) {
    errors.push("projection_receipt_ref_hash_pair_required");
  }
  if (
    receipt.projectionReceiptHash !== null &&
    !HASH_PATTERN.test(receipt.projectionReceiptHash)
  ) {
    errors.push("projection_receipt_hash_invalid");
  }
  if (
    new Set(receipt.selectedEvidenceRefs).size !==
      receipt.selectedEvidenceRefs.length ||
    new Set(receipt.droppedEvidenceRefs).size !==
      receipt.droppedEvidenceRefs.length ||
    receipt.droppedEvidenceRefs.some((ref) =>
      receipt.selectedEvidenceRefs.includes(ref),
    )
  ) {
    errors.push("evidence_refs_invalid");
  }

  if (receipt.sequence === 1) {
    if (
      receipt.phase !== "dispatch_started" ||
      receipt.outcome !== "unknown"
    ) {
      errors.push("started_receipt_must_be_unknown");
    }
    if (
      receipt.previousReceiptRef !== null ||
      receipt.previousReceiptHash !== null
    ) {
      errors.push("started_receipt_must_not_have_predecessor");
    }
    if (
      receipt.finishedAt !== null ||
      receipt.latencyMs !== null ||
      receipt.promptTokens !== null ||
      receipt.completionTokens !== null ||
      receipt.actualCostUsdMicros !== null ||
      receipt.costCurrency !== null ||
      receipt.pricingVersion !== null ||
      receipt.errorCode !== null ||
      receipt.dispatchGatewayRef !== null ||
      receipt.dispatchRuntimeHash !== null ||
      receipt.dispatchClaimHash !== null ||
      receipt.resolutionSource !== "none" ||
      receipt.requestDisposition !== "unknown" ||
      receipt.providerRequestRefHash !== null ||
      receipt.fallbackTargetRouteRef !== null ||
      receipt.fallbackReason !== null ||
      receipt.costBand !== "unknown"
    ) {
      errors.push("started_receipt_must_not_claim_terminal_result");
    }
  } else if (receipt.sequence === 2) {
    if (receipt.phase !== "terminal") {
      errors.push("terminal_receipt_phase_required");
    }
    if (receipt.outcome === "unknown") {
      errors.push("terminal_receipt_outcome_must_be_known");
    }
    if (
      receipt.requestDisposition !== "accepted" &&
      receipt.requestDisposition !== "not_accepted"
    ) {
      errors.push(
        "terminal_receipt_request_disposition_must_be_known",
      );
    }
    if (!receipt.previousReceiptRef || !receipt.previousReceiptHash) {
      errors.push("terminal_receipt_predecessor_required");
    }
    if (
      !receipt.dispatchGatewayRef ||
      !receipt.dispatchRuntimeHash ||
      !receipt.dispatchClaimHash
    ) {
      errors.push("terminal_receipt_dispatch_claim_required");
    }
    if (!receipt.finishedAt || !validInstant(receipt.finishedAt)) {
      errors.push("terminal_receipt_finished_at_required");
    } else if (
      validInstant(receipt.startedAt) &&
      Date.parse(receipt.finishedAt) < Date.parse(receipt.startedAt)
    ) {
      errors.push("terminal_receipt_finished_before_start");
    }
    if (
      receipt.resolutionSource !== "invoke" &&
      receipt.resolutionSource !== "reconcile"
    ) {
      errors.push("terminal_receipt_resolution_source_required");
    }
    if (
      receipt.actualCostUsdMicros === null ||
      receipt.costCurrency !== "USD" ||
      !receipt.pricingVersion ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/.test(
        receipt.pricingVersion,
      )
    ) {
      errors.push("terminal_receipt_pricing_evidence_required");
    }
    if (
      receipt.requestDisposition === "not_accepted" &&
      receipt.actualCostUsdMicros !== 0
    ) {
      errors.push("not_accepted_receipt_cost_must_be_zero");
    }
    if (
      receipt.requestDisposition === "accepted" &&
      receipt.providerRequestRefHash === null
    ) {
      errors.push(
        "accepted_receipt_provider_request_ref_required",
      );
    }
    if (
      receipt.requestDisposition === "not_accepted" &&
      receipt.providerRequestRefHash !== null
    ) {
      errors.push(
        "not_accepted_receipt_must_not_have_provider_request_ref",
      );
    }
    if (
      receipt.outcome === "failure" &&
      receipt.errorCode === null
    ) {
      errors.push("failed_receipt_error_code_required");
    }
    if (
      (receipt.outcome === "success" ||
        receipt.outcome === "partial") &&
      receipt.providerRequestRefHash === null
    ) {
      errors.push("successful_receipt_provider_request_ref_required");
    }
    if (receipt.outcome === "success" && receipt.errorCode !== null) {
      errors.push("successful_receipt_must_not_have_error");
    }
    if (
      (receipt.outcome === "success" ||
        receipt.outcome === "partial") &&
      receipt.requestDisposition !== "accepted"
    ) {
      errors.push("successful_receipt_must_be_accepted");
    }
  } else {
    errors.push("receipt_sequence_invalid");
  }
  if (
    (receipt.fallbackTargetRouteRef === null) !==
    (receipt.fallbackReason === null)
  ) {
    errors.push("fallback_target_reason_pair_required");
  }
  if (
    receipt.fallbackTargetRouteRef !== null &&
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/.test(
      receipt.fallbackTargetRouteRef,
    )
  ) {
    errors.push("fallback_target_route_ref_invalid");
  }
  if (
    receipt.fallbackTargetRouteRef !== null &&
    (receipt.outcome !== "failure" ||
      receipt.requestDisposition !== "not_accepted")
  ) {
    errors.push(
      "fallback_requires_failed_not_accepted_outcome",
    );
  }
  if (
    receipt.fallbackTargetRouteRef !== null &&
    receipt.fallbackReason !== receipt.errorCode
  ) {
    errors.push("fallback_reason_must_match_error_code");
  }

  if (!HASH_PATTERN.test(receipt.contentHash)) {
    errors.push("egress_receipt_hash_invalid");
  } else if (
    computeModelEgressReceiptHash(receipt) !== receipt.contentHash
  ) {
    errors.push("egress_receipt_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function validateModelEgressReceiptChain(input: {
  started: ModelEgressReceipt;
  terminal: ModelEgressReceipt;
  decision: ModelRouteDecision;
}): ContractValidationResult {
  const errors = [
    ...validateModelRouteDecision(input.decision).errors,
    ...validateModelEgressReceipt(input.started).errors,
    ...validateModelEgressReceipt(input.terminal).errors,
  ];
  const { started, terminal, decision } = input;
  for (const [field, startedValue, terminalValue] of [
    ["workspace", started.workspaceRef, terminal.workspaceRef],
    ["decision", started.decisionRef, terminal.decisionRef],
    ["provider", started.provider, terminal.provider],
    ["model_id", started.modelId, terminal.modelId],
    ["model_version", started.modelVersion, terminal.modelVersion],
    ["deployment_form", started.deploymentForm, terminal.deploymentForm],
    ["jurisdiction", started.jurisdiction, terminal.jurisdiction],
    ["region", started.region, terminal.region],
    ["policy_hash", started.policyHash, terminal.policyHash],
    [
      "readiness_hash",
      started.readinessReceiptHash,
      terminal.readinessReceiptHash,
    ],
    [
      "payload_hash",
      started.projectedPayloadHash,
      terminal.projectedPayloadHash,
    ],
    ["started_at", started.startedAt, terminal.startedAt],
  ] as const) {
    if (startedValue !== terminalValue) {
      errors.push(`receipt_chain_${field}_mismatch`);
    }
  }
  if (
    terminal.previousReceiptRef !== started.receiptId ||
    terminal.previousReceiptHash !== started.contentHash
  ) {
    errors.push("receipt_chain_predecessor_mismatch");
  }
  if (
    decision.decisionId !== started.decisionRef ||
    decision.workspaceRef !== started.workspaceRef ||
    decision.policyHash !== started.policyHash ||
    decision.readinessReceiptHash !== started.readinessReceiptHash ||
    decision.projectedPayloadHash !== started.projectedPayloadHash
  ) {
    errors.push("receipt_chain_decision_binding_mismatch");
  }
  if (!decision.routeSnapshot) {
    errors.push("receipt_chain_decision_route_missing");
  } else {
    for (const [field, decisionValue, receiptValue] of [
      ["provider", decision.routeSnapshot.provider, started.provider],
      ["model_id", decision.routeSnapshot.modelId, started.modelId],
      [
        "model_version",
        decision.routeSnapshot.modelVersion,
        started.modelVersion,
      ],
      [
        "deployment_form",
        decision.routeSnapshot.deploymentForm,
        started.deploymentForm,
      ],
      [
        "jurisdiction",
        decision.routeSnapshot.jurisdiction,
        started.jurisdiction,
      ],
      ["region", decision.routeSnapshot.region, started.region],
    ] as const) {
      if (decisionValue !== receiptValue) {
        errors.push(`receipt_chain_decision_${field}_mismatch`);
      }
    }
  }
  if (
    decision.projectionReceiptRef !== started.projectionReceiptRef ||
    decision.projectionReceiptHash !== started.projectionReceiptHash
  ) {
    errors.push("receipt_chain_decision_projection_mismatch");
  }
  if (
    terminal.dispatchGatewayRef === null ||
    terminal.dispatchRuntimeHash === null ||
    terminal.dispatchClaimHash === null
  ) {
    errors.push("receipt_chain_dispatch_claim_missing");
  }
  if (
    terminal.completionTokens !== null &&
    terminal.completionTokens > decision.requestedMaxOutputTokens
  ) {
    errors.push("receipt_chain_requested_output_budget_exceeded");
  }
  if (
    decision.routeSnapshot &&
    terminal.promptTokens !== null &&
    terminal.promptTokens > decision.routeSnapshot.maxInputTokens
  ) {
    errors.push("receipt_chain_route_input_budget_exceeded");
  }
  if (
    decision.routeSnapshot &&
    terminal.pricingVersion !==
      decision.routeSnapshot.pricingVersion
  ) {
    errors.push("receipt_chain_pricing_version_mismatch");
  }
  if (
    decision.routeSnapshot &&
    terminal.actualCostUsdMicros !== null &&
    terminal.actualCostUsdMicros >
      decision.routeSnapshot.maxCostUsdMicros
  ) {
    errors.push("receipt_chain_route_cost_budget_exceeded");
  }
  if (
    canonicalJson(uniqueSorted(decision.selectedEvidenceRefs)) !==
      canonicalJson(uniqueSorted(started.selectedEvidenceRefs)) ||
    canonicalJson(uniqueSorted(decision.droppedEvidenceRefs)) !==
      canonicalJson(uniqueSorted(started.droppedEvidenceRefs))
  ) {
    errors.push("receipt_chain_decision_evidence_mismatch");
  }
  if (
    canonicalJson(uniqueSorted(started.selectedEvidenceRefs)) !==
      canonicalJson(uniqueSorted(terminal.selectedEvidenceRefs)) ||
    canonicalJson(uniqueSorted(started.droppedEvidenceRefs)) !==
      canonicalJson(uniqueSorted(terminal.droppedEvidenceRefs))
  ) {
    errors.push("receipt_chain_evidence_binding_mismatch");
  }
  return { valid: errors.length === 0, errors };
}
