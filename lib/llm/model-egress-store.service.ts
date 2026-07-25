import "server-only";

import { ActorType, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  computeModelEgressReceiptHash,
  computeGovernedModelProjectionReceiptHash,
  computeModelRouteDecisionHash,
  computeModelRouteRequestHash,
  computeModelProviderIdempotencyKey,
  validateGovernedModelProjectionReceipt,
  validateGovernedProjectionRouteBinding,
  validateModelEgressReceipt,
  validateModelEgressReceiptChain,
  validateModelRouteDecision,
  type ModelEgressCostBand,
  type ModelEgressOutcome,
  type ModelEgressReceipt,
  type ModelEgressResolutionSource,
  type ModelRouteDecision,
  type ModelSourceAssetBinding,
  type GovernedModelProjectionReceipt,
} from "@/lib/llm/model-egress-contracts";
import {
  compareFallbackRouteSafety,
  deriveEffectiveModelDataClassification,
  isSafeModelGovernanceIdentifier,
  isSafeModelGovernanceRef,
  MODEL_GOVERNANCE_PERSISTED_INT_MAX,
  readinessReceiptMatchesRoute,
  routeAllowsClassification,
  type ModelRouteTaskClass,
  type TenantModelRoute,
  type TenantModelRoutePolicy,
} from "@/lib/llm/model-route-contracts";
import {
  lockModelEgressWorkspace,
  parseStoredProviderReadiness,
  parseStoredTenantModelRoutePolicy,
  requireModelRoutePolicyOwnerApproval,
  ModelRoutePolicyStoreError,
} from "@/lib/llm/model-route-policy-store.service";
import type {
  DataAssetProcessingDisposition,
} from "@/lib/stage1-owner-loop/data-asset-catalog.types";
import type {
  ObservationSensitivity,
} from "@/lib/stage1-owner-loop/types";
import { jsonStringify, safeParseJson } from "@/lib/utils";

type Tx = Prisma.TransactionClient;
type DecisionRow = Prisma.ModelRouteDecisionGetPayload<object>;
type EgressReceiptRow = Prisma.ModelEgressReceiptGetPayload<object>;
type ProjectionReceiptRow =
  Prisma.GovernedModelProjectionReceiptGetPayload<object>;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

const DEFAULT_DECISION_TTL_MS = 5 * 60 * 1_000;
const MAX_RUNTIME_DESCRIPTOR_AGE_MS = 5 * 60 * 1_000;
const MIN_DISPATCH_LEASE_MS = 60 * 1_000;
const MAX_DISPATCH_LEASE_MS = 30 * 60 * 1_000;
const GOVERNED_GATEWAY_AUTHORITY: unique symbol = Symbol(
  "helm-governed-model-egress/v1",
);
const GOVERNED_GATEWAY_AUDIT_ACTOR =
  "helm-governed-model-egress/v1";
const DEFAULT_PROJECTION_TTL_MS = 5 * 60 * 1_000;
export const GOVERNED_MODEL_PROJECTION_AUTHORITY: unique symbol =
  Symbol("helm-governed-model-projection/v1");
export type GovernedModelProjectionAuthority =
  typeof GOVERNED_MODEL_PROJECTION_AUTHORITY;

const VALID_SENSITIVITIES = new Set<ObservationSensitivity>([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
const VALID_DISPOSITIONS =
  new Set<DataAssetProcessingDisposition>([
    "prohibited",
    "local_only",
    "remote_projected",
  ]);

export type GovernedModelEgressAuthority =
  typeof GOVERNED_GATEWAY_AUTHORITY;

export type GovernedProviderRuntimeDescriptor = {
  provider: string;
  modelId: string;
  modelVersion: string;
  adapterKey: string;
  adapterVersion: string;
  adapterRegistrationRef: string;
  adapterRegistrationHash: string;
  deploymentForm: TenantModelRoute["deploymentForm"];
  jurisdiction: TenantModelRoute["jurisdiction"];
  region: string;
  endpointFingerprint: string;
  credentialRef: string;
  adapterRegistered: boolean;
  credentialConfigured: boolean;
  observedAt: string;
};

export type PrepareModelRouteDecisionInput = {
  authority: GovernedModelEgressAuthority;
  workspaceId: string;
  policyKey: string;
  requestKey: string;
  taskClass: ModelRouteTaskClass;
  taskRef: string;
  requestedMaxOutputTokens: number;
  allowFallback: boolean;
  sourceAssetRefs: readonly string[];
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectionReceiptRef: string | null;
  projectedPayloadHash: string;
  promptInjectionScanStatus: ModelRouteDecision["promptInjectionScanStatus"];
  parentDecisionRef?: string | null;
  requestedFallbackRouteRef?: string | null;
  fallbackReason?: string | null;
  decisionTtlMs?: number;
  now?: Date;
};

export type RecordGovernedModelProjectionReceiptInput = {
  authority: GovernedModelProjectionAuthority;
  workspaceId: string;
  idempotencyKey: string;
  sourceAssetRefs: readonly string[];
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectedPayloadHash: string;
  projectedPayloadBytes: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  remoteSafe: boolean;
  redactionStatus:
    | "synthetic"
    | "redacted"
    | "alias_only";
  promptInjectionScanStatus:
    | "passed"
    | "failed"
    | "not_run";
  projectorRegistrationRef: string;
  projectorRegistrationHash: string;
  projectorVersion: string;
  scannerRegistrationRef: string;
  scannerRegistrationHash: string;
  scannerVersion: string;
  receiptTtlMs?: number;
  now?: Date;
};

export class ModelEgressStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "ModelEgressStoreError";
    this.reasons = reasons;
  }
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ModelEgressStoreError(reason);
  return normalized;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function parseStringArray(value: string): string[] | null {
  const parsed = safeParseJson<unknown>(value, null);
  return Array.isArray(parsed) &&
    parsed.every((item) => typeof item === "string")
    ? parsed
    : null;
}

function parseSourceAssetBindings(
  value: string,
): ModelSourceAssetBinding[] | null {
  const parsed = safeParseJson<unknown>(value, null);
  if (!Array.isArray(parsed)) return null;
  if (
    parsed.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        typeof (item as ModelSourceAssetBinding).assetRef !== "string" ||
        typeof (item as ModelSourceAssetBinding).assetVersion !== "number",
    )
  ) {
    return null;
  }
  return parsed as ModelSourceAssetBinding[];
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    canonicalJson(uniqueSorted(left)) ===
    canonicalJson(uniqueSorted(right))
  );
}

function stableId(prefix: string, value: unknown): string {
  return `${prefix}:${sha256(canonicalJson(value)).slice("sha256:".length)}`;
}

function requireHash(value: string, reason: string): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new ModelEgressStoreError(reason);
  }
  return value;
}

function minDate(...values: Date[]): Date {
  return new Date(Math.min(...values.map((value) => value.getTime())));
}

function sameNullableInstant(
  contractValue: string | null,
  storedValue: Date | null,
): boolean {
  return contractValue === (storedValue ? storedValue.toISOString() : null);
}

function normalizeProjectionReceipt(
  receipt: GovernedModelProjectionReceipt | null,
): {
  receipt: GovernedModelProjectionReceipt | null;
  receiptRef: string | null;
  receiptHash: string | null;
} {
  if (!receipt) {
    return { receipt: null, receiptRef: null, receiptHash: null };
  }
  return {
    receipt,
    receiptRef: receipt.receiptId,
    receiptHash: receipt.contentHash,
  };
}

function assertAuthority(authority: GovernedModelEgressAuthority): void {
  if (authority !== GOVERNED_GATEWAY_AUTHORITY) {
    throw new ModelEgressStoreError("governed_gateway_authority_required");
  }
}

function assertProjectionAuthority(
  authority: GovernedModelProjectionAuthority,
): void {
  if (authority !== GOVERNED_MODEL_PROJECTION_AUTHORITY) {
    throw new ModelEgressStoreError(
      "governed_model_projection_authority_required",
    );
  }
}

function noActivePolicyHash(input: {
  workspaceRef: string;
  policyKey: string;
}): string {
  return sha256(
    canonicalJson({
      schemaVersion: "helm.no-active-model-policy/v1",
      workspaceRef: input.workspaceRef,
      policyKey: input.policyKey,
    }),
  );
}

export function computeGovernedProviderRuntimeHash(
  descriptor: GovernedProviderRuntimeDescriptor,
): string {
  return sha256(canonicalJson(descriptor));
}

function dispatchLeaseDurationMs(maxLatencyMs: number): number {
  return Math.min(
    MAX_DISPATCH_LEASE_MS,
    Math.max(MIN_DISPATCH_LEASE_MS, maxLatencyMs * 2),
  );
}

function parseStoredDispatchRuntime(
  runtimeJson: string | null,
  runtimeHash: string | null,
): GovernedProviderRuntimeDescriptor | null {
  if (runtimeJson === null && runtimeHash === null) return null;
  if (runtimeJson === null || runtimeHash === null) {
    throw new ModelEgressStoreError(
      "stored_dispatch_runtime_shape_invalid",
    );
  }
  const runtime =
    safeParseJson<GovernedProviderRuntimeDescriptor | null>(
      runtimeJson,
      null,
    );
  if (
    !runtime ||
    typeof runtime.provider !== "string" ||
    typeof runtime.modelId !== "string" ||
    typeof runtime.modelVersion !== "string" ||
    typeof runtime.adapterKey !== "string" ||
    typeof runtime.adapterVersion !== "string" ||
    typeof runtime.adapterRegistrationRef !== "string" ||
    typeof runtime.adapterRegistrationHash !== "string" ||
    typeof runtime.deploymentForm !== "string" ||
    typeof runtime.jurisdiction !== "string" ||
    typeof runtime.region !== "string" ||
    typeof runtime.endpointFingerprint !== "string" ||
    typeof runtime.credentialRef !== "string" ||
    typeof runtime.adapterRegistered !== "boolean" ||
    typeof runtime.credentialConfigured !== "boolean" ||
    typeof runtime.observedAt !== "string" ||
    computeGovernedProviderRuntimeHash(runtime) !== runtimeHash
  ) {
    throw new ModelEgressStoreError(
      "stored_dispatch_runtime_binding_invalid",
    );
  }
  return runtime;
}

function parseRouteSnapshot(
  value: string | null,
): TenantModelRoute | null {
  return safeParseJson<TenantModelRoute | null>(value, null);
}

export function parseStoredModelRouteDecision(
  row: DecisionRow,
): ModelRouteDecision {
  const decision = safeParseJson<ModelRouteDecision | null>(
    row.decisionJson,
    null,
  );
  const sourceAssetRefs = parseStringArray(row.sourceAssetRefs);
  const sourceAssetBindings = parseSourceAssetBindings(
    row.sourceAssetBindingsJson,
  );
  const candidateEvidenceRefs = parseStringArray(row.candidateEvidenceRefs);
  const selectedEvidenceRefs = parseStringArray(row.selectedEvidenceRefs);
  const droppedEvidenceRefs = parseStringArray(row.droppedEvidenceRefs);
  const reasonCodes = parseStringArray(row.reasonCodes);
  const routeSnapshot = parseRouteSnapshot(row.routeSnapshotJson);
  if (
    !decision ||
    !sourceAssetRefs ||
    !sourceAssetBindings ||
    !candidateEvidenceRefs ||
    !selectedEvidenceRefs ||
    !droppedEvidenceRefs ||
    !reasonCodes
  ) {
    throw new ModelEgressStoreError(
      "stored_model_route_decision_json_invalid",
    );
  }
  const validation = validateModelRouteDecision(decision);
  if (!validation.valid) {
    throw new ModelEgressStoreError(
      "stored_model_route_decision_invalid",
      validation.errors,
    );
  }
  if (
    decision.decisionId !== row.id ||
    decision.workspaceRef !== `workspace:${row.workspaceId}` ||
    (row.policyId !== null && decision.policyRef !== row.policyId) ||
    (row.policyId === null &&
      !decision.policyRef.startsWith("policy:none:")) ||
    (row.readinessReceiptId !== null &&
      decision.readinessReceiptRef !== row.readinessReceiptId) ||
    decision.parentDecisionRef !== row.parentDecisionId ||
    decision.requestKey !== row.requestKey ||
    decision.requestHash !== row.requestHash ||
    decision.attemptOrdinal !== row.attemptOrdinal ||
    decision.policyKey !== row.policyKey ||
    decision.policyHeadVersion !== row.policyHeadVersion ||
    decision.policyRevocationEpoch !== row.policyRevocationEpoch ||
    decision.taskClass.toUpperCase() !== row.taskClass ||
    decision.taskRef !== row.taskRef ||
    decision.requestedMaxOutputTokens !==
      row.requestedMaxOutputTokens ||
    decision.allowFallback !== row.allowFallback ||
    decision.sensitivity.toUpperCase() !== row.sensitivity ||
    decision.processingDisposition.toUpperCase() !==
      row.processingDisposition ||
    !sameStrings(decision.sourceAssetRefs, sourceAssetRefs) ||
    canonicalJson(decision.sourceAssetBindings) !==
      canonicalJson(sourceAssetBindings) ||
    !sameStrings(decision.candidateEvidenceRefs, candidateEvidenceRefs) ||
    !sameStrings(decision.selectedEvidenceRefs, selectedEvidenceRefs) ||
    !sameStrings(decision.droppedEvidenceRefs, droppedEvidenceRefs) ||
    decision.projectionReceiptRef !== row.projectionReceiptRef ||
    decision.projectionReceiptHash !== row.projectionReceiptHash ||
    decision.projectedPayloadHash !== row.projectedPayloadHash ||
    decision.promptInjectionScanStatus.toUpperCase() !==
      row.promptInjectionScanStatus ||
    decision.routeRef !== row.routeRef ||
    canonicalJson(decision.routeSnapshot) !== canonicalJson(routeSnapshot) ||
    decision.adapterReadinessState.toUpperCase() !==
      row.adapterReadinessState ||
    decision.catalogVisibilityState.toUpperCase() !==
      row.catalogVisibilityState ||
    decision.decision.toUpperCase() !== row.decision ||
    !sameStrings(decision.reasonCodes, reasonCodes) ||
    decision.requestedFallbackRouteRef !==
      row.requestedFallbackRouteRef ||
    decision.fallbackFromRouteRef !== row.fallbackFromRouteRef ||
    decision.fallbackReason !== row.fallbackReason ||
    decision.validUntil !== row.validUntil.toISOString() ||
    decision.createdAt !== row.createdAt.toISOString() ||
    decision.contentHash !== row.contentHash
  ) {
    throw new ModelEgressStoreError(
      "stored_model_route_decision_binding_invalid",
    );
  }
  return decision;
}

export function parseStoredModelEgressReceipt(
  row: EgressReceiptRow,
): ModelEgressReceipt {
  const receipt = safeParseJson<ModelEgressReceipt | null>(
    row.receiptJson,
    null,
  );
  const selectedEvidenceRefs = parseStringArray(row.selectedEvidenceRefs);
  const droppedEvidenceRefs = parseStringArray(row.droppedEvidenceRefs);
  if (!receipt || !selectedEvidenceRefs || !droppedEvidenceRefs) {
    throw new ModelEgressStoreError(
      "stored_model_egress_receipt_json_invalid",
    );
  }
  const validation = validateModelEgressReceipt(receipt);
  if (!validation.valid) {
    throw new ModelEgressStoreError(
      "stored_model_egress_receipt_invalid",
      validation.errors,
    );
  }
  if (
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.decisionRef !== row.decisionId ||
    receipt.previousReceiptRef !== row.previousReceiptId ||
    receipt.previousReceiptHash !== row.previousReceiptHash ||
    receipt.sequence !== row.sequence ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    receipt.phase.toUpperCase() !== row.phase ||
    receipt.outcome.toUpperCase() !== row.outcome ||
    receipt.resolutionSource.toUpperCase() !==
      row.resolutionSource ||
    receipt.provider !== row.provider ||
    receipt.modelId !== row.modelId ||
    receipt.modelVersion !== row.modelVersion ||
    receipt.deploymentForm.toUpperCase() !== row.deploymentForm ||
    receipt.jurisdiction.toUpperCase() !== row.jurisdiction ||
    receipt.region !== row.region ||
    receipt.policyHash !== row.policyHash ||
    receipt.readinessReceiptHash !== row.readinessReceiptHash ||
    receipt.projectedPayloadHash !== row.projectedPayloadHash ||
    !sameStrings(receipt.selectedEvidenceRefs, selectedEvidenceRefs) ||
    !sameStrings(receipt.droppedEvidenceRefs, droppedEvidenceRefs) ||
    receipt.projectionReceiptRef !== row.projectionReceiptRef ||
    receipt.projectionReceiptHash !== row.projectionReceiptHash ||
    receipt.rawContentIncluded !== row.rawContentIncluded ||
    receipt.dispatchGatewayRef !== row.dispatchGatewayRef ||
    receipt.dispatchRuntimeHash !== row.dispatchRuntimeHash ||
    receipt.dispatchClaimHash !== row.dispatchClaimHash ||
    receipt.requestDisposition.toUpperCase() !==
      row.requestDisposition ||
    receipt.providerRequestRefHash !== row.providerRequestRefHash ||
    receipt.startedAt !== row.startedAt.toISOString() ||
    !sameNullableInstant(receipt.finishedAt, row.finishedAt) ||
    receipt.latencyMs !== row.latencyMs ||
    receipt.promptTokens !== row.promptTokens ||
    receipt.completionTokens !== row.completionTokens ||
    receipt.actualCostUsdMicros !== row.actualCostUsdMicros ||
    receipt.costCurrency !== row.costCurrency ||
    receipt.pricingVersion !== row.pricingVersion ||
    receipt.costBand.toUpperCase() !== row.costBand ||
    receipt.errorCode !== row.errorCode ||
    receipt.fallbackTargetRouteRef !== row.fallbackTargetRouteRef ||
    receipt.fallbackReason !== row.fallbackReason ||
    receipt.auditRef !== row.auditRef ||
    receipt.recordedAt !== row.recordedAt.toISOString() ||
    receipt.contentHash !== row.contentHash
  ) {
    throw new ModelEgressStoreError(
      "stored_model_egress_receipt_binding_invalid",
    );
  }
  return receipt;
}

export function parseStoredGovernedModelProjectionReceipt(
  row: ProjectionReceiptRow,
): GovernedModelProjectionReceipt {
  const receipt =
    safeParseJson<GovernedModelProjectionReceipt | null>(
      row.receiptJson,
      null,
    );
  const sourceAssetRefs = parseStringArray(row.sourceAssetRefs);
  const sourceAssetBindings = parseSourceAssetBindings(
    row.sourceAssetBindingsJson,
  );
  const candidateEvidenceRefs = parseStringArray(
    row.candidateEvidenceRefs,
  );
  const selectedEvidenceRefs = parseStringArray(
    row.selectedEvidenceRefs,
  );
  const droppedEvidenceRefs = parseStringArray(
    row.droppedEvidenceRefs,
  );
  if (
    !receipt ||
    !sourceAssetRefs ||
    !sourceAssetBindings ||
    !candidateEvidenceRefs ||
    !selectedEvidenceRefs ||
    !droppedEvidenceRefs
  ) {
    throw new ModelEgressStoreError(
      "stored_model_projection_receipt_json_invalid",
    );
  }
  const validation =
    validateGovernedModelProjectionReceipt(receipt);
  if (!validation.valid) {
    throw new ModelEgressStoreError(
      "stored_model_projection_receipt_invalid",
      validation.errors,
    );
  }
  if (
    receipt.receiptId !== row.id ||
    receipt.workspaceRef !== `workspace:${row.workspaceId}` ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    !sameStrings(receipt.sourceAssetRefs, sourceAssetRefs) ||
    canonicalJson(receipt.sourceAssetBindings) !==
      canonicalJson(sourceAssetBindings) ||
    !sameStrings(
      receipt.candidateEvidenceRefs,
      candidateEvidenceRefs,
    ) ||
    !sameStrings(
      receipt.selectedEvidenceRefs,
      selectedEvidenceRefs,
    ) ||
    !sameStrings(
      receipt.droppedEvidenceRefs,
      droppedEvidenceRefs,
    ) ||
    receipt.projectedPayloadHash !== row.projectedPayloadHash ||
    receipt.projectedPayloadBytes !== row.projectedPayloadBytes ||
    receipt.maxInputTokens !== row.maxInputTokens ||
    receipt.maxOutputTokens !== row.maxOutputTokens ||
    receipt.remoteSafe !== row.remoteSafe ||
    receipt.redactionStatus.toUpperCase() !== row.redactionStatus ||
    receipt.promptInjectionScanStatus.toUpperCase() !==
      row.promptInjectionScanStatus ||
    receipt.projectorRegistrationRef !==
      row.projectorRegistrationRef ||
    receipt.projectorRegistrationHash !==
      row.projectorRegistrationHash ||
    receipt.projectorVersion !== row.projectorVersion ||
    receipt.scannerRegistrationRef !==
      row.scannerRegistrationRef ||
    receipt.scannerRegistrationHash !==
      row.scannerRegistrationHash ||
    receipt.scannerVersion !== row.scannerVersion ||
    receipt.validUntil !== row.validUntil.toISOString() ||
    receipt.createdAt !== row.createdAt.toISOString() ||
    receipt.contentHash !== row.contentHash
  ) {
    throw new ModelEgressStoreError(
      "stored_model_projection_receipt_binding_invalid",
    );
  }
  return receipt;
}

function assertProjectionBinding(input: {
  projection: ReturnType<typeof normalizeProjectionReceipt>;
  sourceAssetRefs: readonly string[];
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  projectedPayloadHash: string;
  promptInjectionScanStatus:
    ModelRouteDecision["promptInjectionScanStatus"];
  now: Date;
}): string[] {
  const reasons: string[] = [];
  if (!input.projection.receipt) {
    return ["projection_receipt_missing"];
  }
  if (
    Date.parse(input.projection.receipt.validUntil) <=
    input.now.getTime()
  ) {
    reasons.push("projection_receipt_expired");
  }
  if (
    !sameStrings(
      input.projection.receipt.sourceAssetRefs,
      input.sourceAssetRefs,
    )
  ) {
    reasons.push("projection_source_asset_mismatch");
  }
  if (
    input.projection.receipt.projectedPayloadHash !==
    input.projectedPayloadHash
  ) {
    reasons.push("projection_payload_hash_mismatch");
  }
  if (
    input.projection.receipt.promptInjectionScanStatus !==
    input.promptInjectionScanStatus
  ) {
    reasons.push("projection_injection_scan_mismatch");
  }
  if (input.projection.receipt.rawContentIncluded !== false) {
    reasons.push("projection_contains_raw_content");
  }
  if (
    !sameStrings(
      input.projection.receipt.candidateEvidenceRefs,
      input.candidateEvidenceRefs,
    )
  ) {
    reasons.push("projection_candidate_evidence_mismatch");
  }
  if (
    !sameStrings(
      input.projection.receipt.selectedEvidenceRefs,
      input.selectedEvidenceRefs,
    )
  ) {
    reasons.push("projection_selected_evidence_mismatch");
  }
  if (
    !sameStrings(
      input.projection.receipt.droppedEvidenceRefs,
      input.droppedEvidenceRefs,
    )
  ) {
    reasons.push("projection_dropped_evidence_mismatch");
  }
  return uniqueSorted(reasons);
}

function projectionReceiptMatchesRequest(input: {
  receipt: GovernedModelProjectionReceipt;
  request: RecordGovernedModelProjectionReceiptInput;
  sourceAssetBindings: readonly ModelSourceAssetBinding[];
  expectedValidUntil: Date;
}): boolean {
  return (
    input.receipt.workspaceRef ===
      `workspace:${input.request.workspaceId}` &&
    input.receipt.idempotencyKey ===
      input.request.idempotencyKey.trim() &&
    sameStrings(
      input.receipt.sourceAssetRefs,
      input.request.sourceAssetRefs,
    ) &&
    canonicalJson(input.receipt.sourceAssetBindings) ===
      canonicalJson(input.sourceAssetBindings) &&
    sameStrings(
      input.receipt.candidateEvidenceRefs,
      input.request.candidateEvidenceRefs,
    ) &&
    sameStrings(
      input.receipt.selectedEvidenceRefs,
      input.request.selectedEvidenceRefs,
    ) &&
    sameStrings(
      input.receipt.droppedEvidenceRefs,
      input.request.droppedEvidenceRefs,
    ) &&
    input.receipt.projectedPayloadHash ===
      input.request.projectedPayloadHash &&
    input.receipt.projectedPayloadBytes ===
      input.request.projectedPayloadBytes &&
    input.receipt.maxInputTokens ===
      input.request.maxInputTokens &&
    input.receipt.maxOutputTokens ===
      input.request.maxOutputTokens &&
    input.receipt.remoteSafe === input.request.remoteSafe &&
    input.receipt.redactionStatus ===
      input.request.redactionStatus &&
    input.receipt.promptInjectionScanStatus ===
      input.request.promptInjectionScanStatus &&
    input.receipt.projectorRegistrationRef ===
      input.request.projectorRegistrationRef.trim() &&
    input.receipt.projectorRegistrationHash ===
      input.request.projectorRegistrationHash &&
    input.receipt.projectorVersion ===
      input.request.projectorVersion.trim() &&
    input.receipt.scannerRegistrationRef ===
      input.request.scannerRegistrationRef.trim() &&
    input.receipt.scannerRegistrationHash ===
      input.request.scannerRegistrationHash &&
    input.receipt.scannerVersion ===
      input.request.scannerVersion.trim() &&
    input.receipt.validUntil ===
      input.expectedValidUntil.toISOString() &&
    input.receipt.rawContentIncluded === false
  );
}

async function deriveClassificationAndAuthorization(input: {
  tx: Tx;
  workspaceId: string;
  sourceAssetRefs: readonly string[];
  now: Date;
}): Promise<{
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  reasonCodes: string[];
  sourceAssetBindings: ModelSourceAssetBinding[];
  authorizationExpiries: Date[];
}> {
  const sourceAssetRefs = uniqueSorted(input.sourceAssetRefs);
  const reasonCodes: string[] =
    sourceAssetRefs.length === 0
      ? ["source_asset_ref_required"]
      : [];
  const rows = await input.tx.dataAssetCatalogEntry.findMany({
    where: {
      workspaceId: input.workspaceId,
      id: { in: sourceAssetRefs },
    },
    select: {
      id: true,
      sensitivity: true,
      processingDisposition: true,
      classificationStatus: true,
      inventoryStatus: true,
      authorizationStatus: true,
      authorizationValidFrom: true,
      authorizationValidUntil: true,
      classificationReceiptRef: true,
      authorizationReceiptRef: true,
      version: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const stageReceiptRefs = uniqueSorted(
    rows.flatMap((row) =>
      [
        row.classificationReceiptRef,
        row.authorizationReceiptRef,
      ].filter((value): value is string => value !== null),
    ),
  );
  const stageReceiptRows =
    stageReceiptRefs.length > 0
      ? await input.tx.dataAssetStageReceipt.findMany({
          where: {
            workspaceId: input.workspaceId,
            id: { in: stageReceiptRefs },
          },
          select: {
            id: true,
            workspaceId: true,
            assetId: true,
            receiptType: true,
            idempotencyKey: true,
            expectedVersion: true,
            resultingVersion: true,
            status: true,
            actorRef: true,
            evidenceRefs: true,
            payloadJson: true,
            recordedAt: true,
          },
        })
      : [];
  const stageReceiptsById = new Map(
    stageReceiptRows.map((row) => [row.id, row]),
  );
  const hashStageReceipt = (
    row: (typeof stageReceiptRows)[number],
  ): string =>
    sha256(
      canonicalJson({
        schemaVersion: "helm.data-asset-stage-receipt-binding/v1",
        receiptId: row.id,
        workspaceId: row.workspaceId,
        assetId: row.assetId,
        receiptType: row.receiptType,
        idempotencyKey: row.idempotencyKey,
        expectedVersion: row.expectedVersion,
        resultingVersion: row.resultingVersion,
        status: row.status,
        actorRef: row.actorRef,
        evidenceRefs: row.evidenceRefs,
        payloadJson: row.payloadJson,
        recordedAt: row.recordedAt.toISOString(),
      }),
    );
  const sourceAssetBindings: ModelSourceAssetBinding[] = [];
  const authorizationExpiries: Date[] = [];
  const classifications = sourceAssetRefs.map((assetRef) => {
    const row = byId.get(assetRef);
    if (!row) {
      reasonCodes.push("source_asset_missing");
      return {
        sensitivity: "restricted" as const,
        processingDisposition: "local_only" as const,
        classificationStatus: "pending" as const,
      };
    }
    const sensitivity = row.sensitivity.toLowerCase();
    const disposition = row.processingDisposition.toLowerCase();
    const classificationStatus =
      row.classificationStatus.toLowerCase();
    if (
      !VALID_SENSITIVITIES.has(
        sensitivity as ObservationSensitivity,
      ) ||
      !VALID_DISPOSITIONS.has(
        disposition as DataAssetProcessingDisposition,
      ) ||
      (classificationStatus !== "pending" &&
        classificationStatus !== "classified")
    ) {
      reasonCodes.push("source_asset_classification_invalid");
      return {
        sensitivity: "restricted" as const,
        processingDisposition: "local_only" as const,
        classificationStatus: "pending" as const,
      };
    }
    if (row.inventoryStatus !== "CONFIRMED") {
      reasonCodes.push("source_asset_not_confirmed");
    }
    if (row.authorizationStatus !== "AUTHORIZED") {
      reasonCodes.push("source_asset_not_authorized");
    }
    if (
      row.authorizationValidFrom &&
      row.authorizationValidFrom.getTime() > input.now.getTime()
    ) {
      reasonCodes.push("source_asset_authorization_not_started");
    }
    if (
      row.authorizationValidUntil &&
      row.authorizationValidUntil.getTime() <= input.now.getTime()
    ) {
      reasonCodes.push("source_asset_authorization_expired");
    }
    const classificationReceipt = row.classificationReceiptRef
      ? stageReceiptsById.get(row.classificationReceiptRef)
      : null;
    if (
      !classificationReceipt ||
      classificationReceipt.assetId !== assetRef ||
      classificationReceipt.receiptType !== "CLASSIFICATION"
    ) {
      reasonCodes.push("source_asset_classification_receipt_missing");
    }
    const authorizationReceipt = row.authorizationReceiptRef
      ? stageReceiptsById.get(row.authorizationReceiptRef)
      : null;
    if (
      !authorizationReceipt ||
      authorizationReceipt.assetId !== assetRef ||
      authorizationReceipt.receiptType !== "AUTHORIZATION"
    ) {
      reasonCodes.push("source_asset_authorization_receipt_missing");
    }
    const authorityIsValid =
      row.inventoryStatus === "CONFIRMED" &&
      classificationStatus === "classified" &&
      row.authorizationStatus === "AUTHORIZED" &&
      (!row.authorizationValidFrom ||
        row.authorizationValidFrom.getTime() <= input.now.getTime()) &&
      (!row.authorizationValidUntil ||
        row.authorizationValidUntil.getTime() > input.now.getTime()) &&
      classificationReceipt !== null &&
      classificationReceipt !== undefined &&
      authorizationReceipt !== null &&
      authorizationReceipt !== undefined;
    if (authorityIsValid) {
      sourceAssetBindings.push({
        assetRef,
        assetVersion: row.version,
        inventoryStatus: "confirmed",
        classificationStatus: "classified",
        sensitivity: sensitivity as ObservationSensitivity,
        processingDisposition:
          disposition as DataAssetProcessingDisposition,
        classificationReceiptRef: classificationReceipt.id,
        classificationReceiptHash: hashStageReceipt(
          classificationReceipt,
        ),
        authorizationStatus: "authorized",
        authorizationReceiptRef: authorizationReceipt.id,
        authorizationReceiptHash: hashStageReceipt(
          authorizationReceipt,
        ),
        authorizationValidFrom:
          row.authorizationValidFrom?.toISOString() ?? null,
        authorizationValidUntil:
          row.authorizationValidUntil?.toISOString() ?? null,
      });
      if (row.authorizationValidUntil) {
        authorizationExpiries.push(row.authorizationValidUntil);
      }
    }
    return {
      sensitivity: sensitivity as ObservationSensitivity,
      processingDisposition:
        disposition as DataAssetProcessingDisposition,
      classificationStatus:
        classificationStatus as "pending" | "classified",
    };
  });
  const classification =
    deriveEffectiveModelDataClassification(classifications);
  return {
    sensitivity: classification.sensitivity,
    processingDisposition: classification.processingDisposition,
    reasonCodes: uniqueSorted([
      ...classification.reasonCodes,
      ...reasonCodes,
    ]),
    sourceAssetBindings: sourceAssetBindings.sort((left, right) =>
      left.assetRef.localeCompare(right.assetRef),
    ),
    authorizationExpiries,
  };
}

export async function recordGovernedModelProjectionReceipt(
  input: RecordGovernedModelProjectionReceiptInput,
) {
  assertProjectionAuthority(input.authority);
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "projection_idempotency_key_required",
  );
  requireHash(
    input.projectedPayloadHash,
    "projected_payload_hash_invalid",
  );
  requireHash(
    input.projectorRegistrationHash,
    "projector_registration_hash_invalid",
  );
  requireHash(
    input.scannerRegistrationHash,
    "scanner_registration_hash_invalid",
  );
  const ttlMs = input.receiptTtlMs ?? DEFAULT_PROJECTION_TTL_MS;
  if (
    !Number.isSafeInteger(ttlMs) ||
    ttlMs <= 0 ||
    !Number.isSafeInteger(input.projectedPayloadBytes) ||
    input.projectedPayloadBytes <= 0 ||
    !Number.isSafeInteger(input.maxInputTokens) ||
    input.maxInputTokens <= 0 ||
    !Number.isSafeInteger(input.maxOutputTokens) ||
    input.maxOutputTokens <= 0
  ) {
    throw new ModelEgressStoreError(
      "projection_size_budget_or_ttl_invalid",
    );
  }
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        const sourceAuthority =
          await deriveClassificationAndAuthorization({
            tx,
            workspaceId: input.workspaceId,
            sourceAssetRefs: input.sourceAssetRefs,
            now,
          });
        if (sourceAuthority.reasonCodes.length > 0) {
          throw new ModelEgressStoreError(
            "projection_source_authority_invalid",
            sourceAuthority.reasonCodes,
          );
        }
        const validUntil = minDate(
          new Date(now.getTime() + ttlMs),
          ...sourceAuthority.authorizationExpiries,
        );
        const candidate: GovernedModelProjectionReceipt = {
          schemaVersion:
            "helm.governed-model-projection-receipt/v1",
          receiptId: stableId("model-projection-receipt", {
            workspaceId: input.workspaceId,
            idempotencyKey,
          }),
          workspaceRef: `workspace:${input.workspaceId}`,
          idempotencyKey,
          sourceAssetRefs: uniqueSorted(input.sourceAssetRefs),
          sourceAssetBindings:
            sourceAuthority.sourceAssetBindings,
          candidateEvidenceRefs: uniqueSorted(
            input.candidateEvidenceRefs,
          ),
          selectedEvidenceRefs: uniqueSorted(
            input.selectedEvidenceRefs,
          ),
          droppedEvidenceRefs: uniqueSorted(
            input.droppedEvidenceRefs,
          ),
          projectedPayloadHash: input.projectedPayloadHash,
          projectedPayloadBytes: input.projectedPayloadBytes,
          maxInputTokens: input.maxInputTokens,
          maxOutputTokens: input.maxOutputTokens,
          remoteSafe: input.remoteSafe,
          redactionStatus: input.redactionStatus,
          promptInjectionScanStatus:
            input.promptInjectionScanStatus,
          projectorRegistrationRef: nonEmpty(
            input.projectorRegistrationRef,
            "projector_registration_ref_required",
          ),
          projectorRegistrationHash:
            input.projectorRegistrationHash,
          projectorVersion: nonEmpty(
            input.projectorVersion,
            "projector_version_required",
          ),
          scannerRegistrationRef: nonEmpty(
            input.scannerRegistrationRef,
            "scanner_registration_ref_required",
          ),
          scannerRegistrationHash:
            input.scannerRegistrationHash,
          scannerVersion: nonEmpty(
            input.scannerVersion,
            "scanner_version_required",
          ),
          validUntil: validUntil.toISOString(),
          createdAt: now.toISOString(),
          rawContentIncluded: false,
          authorityEffect: "evidence_only",
          contentHash: "sha256:pending",
        };
        const receipt: GovernedModelProjectionReceipt = {
          ...candidate,
          contentHash:
            computeGovernedModelProjectionReceiptHash(candidate),
        };
        const validation =
          validateGovernedModelProjectionReceipt(receipt);
        if (!validation.valid) {
          throw new ModelEgressStoreError(
            "computed_model_projection_receipt_invalid",
            validation.errors,
          );
        }
        const existing =
          await tx.governedModelProjectionReceipt.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId: input.workspaceId,
                idempotencyKey,
              },
            },
          });
        if (existing) {
          const replay =
            parseStoredGovernedModelProjectionReceipt(existing);
          const replayValidUntil = minDate(
            new Date(
              new Date(replay.createdAt).getTime() + ttlMs,
            ),
            ...sourceAuthority.authorizationExpiries,
          );
          if (
            !projectionReceiptMatchesRequest({
              receipt: replay,
              request: input,
              sourceAssetBindings:
                sourceAuthority.sourceAssetBindings,
              expectedValidUntil: replayValidUntil,
            })
          ) {
            throw new ModelEgressStoreError(
              "projection_idempotency_key_payload_conflict",
            );
          }
          return { receipt: replay, replayed: true };
        }
        await tx.governedModelProjectionReceipt.create({
          data: {
            id: receipt.receiptId,
            workspaceId: input.workspaceId,
            idempotencyKey: receipt.idempotencyKey,
            sourceAssetRefs: jsonStringify(
              receipt.sourceAssetRefs,
            ),
            sourceAssetBindingsJson: jsonStringify(
              receipt.sourceAssetBindings,
            ),
            candidateEvidenceRefs: jsonStringify(
              receipt.candidateEvidenceRefs,
            ),
            selectedEvidenceRefs: jsonStringify(
              receipt.selectedEvidenceRefs,
            ),
            droppedEvidenceRefs: jsonStringify(
              receipt.droppedEvidenceRefs,
            ),
            projectedPayloadHash: receipt.projectedPayloadHash,
            projectedPayloadBytes: receipt.projectedPayloadBytes,
            maxInputTokens: receipt.maxInputTokens,
            maxOutputTokens: receipt.maxOutputTokens,
            remoteSafe: receipt.remoteSafe,
            redactionStatus: receipt.redactionStatus.toUpperCase(),
            promptInjectionScanStatus:
              receipt.promptInjectionScanStatus.toUpperCase(),
            projectorRegistrationRef:
              receipt.projectorRegistrationRef,
            projectorRegistrationHash:
              receipt.projectorRegistrationHash,
            projectorVersion: receipt.projectorVersion,
            scannerRegistrationRef:
              receipt.scannerRegistrationRef,
            scannerRegistrationHash:
              receipt.scannerRegistrationHash,
            scannerVersion: receipt.scannerVersion,
            validUntil: new Date(receipt.validUntil),
            receiptJson: jsonStringify(receipt),
            contentHash: receipt.contentHash,
            createdAt: new Date(receipt.createdAt),
          },
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: null,
            actor: "helm-governed-model-projection",
            actorType: ActorType.SYSTEM,
            actionType:
              "GOVERNED_MODEL_PROJECTION_RECEIPT_RECORDED",
            targetType: "GovernedModelProjectionReceipt",
            targetId: receipt.receiptId,
            summary:
              "Recorded payload-bound model projection evidence without raw content",
            payload: {
              projectedPayloadHash: receipt.projectedPayloadHash,
              projectedPayloadBytes:
                receipt.projectedPayloadBytes,
              sourceAssetCount: receipt.sourceAssetRefs.length,
              selectedEvidenceCount:
                receipt.selectedEvidenceRefs.length,
              remoteSafe: receipt.remoteSafe,
              promptInjectionScanStatus:
                receipt.promptInjectionScanStatus,
              rawContentIncluded: false,
            },
          },
          { client: tx },
        );
        return { receipt, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function readGovernedModelProjectionReceipt(input: {
  workspaceId: string;
  receiptId: string;
}): Promise<GovernedModelProjectionReceipt | null> {
  const row = await db.governedModelProjectionReceipt.findFirst({
    where: {
      id: input.receiptId,
      workspaceId: input.workspaceId,
    },
  });
  return row
    ? parseStoredGovernedModelProjectionReceipt(row)
    : null;
}

async function resolveRoute(input: {
  tx: Tx;
  workspaceId: string;
  policy: TenantModelRoutePolicy;
  taskClass: ModelRouteTaskClass;
  parentDecisionRef: string | null;
  requestedFallbackRouteRef: string | null;
  fallbackReason: string | null;
}): Promise<{
  route: TenantModelRoute | null;
  parent: ModelRouteDecision | null;
  attemptOrdinal: number;
  fallbackFromRouteRef: string | null;
  reasonCodes: string[];
}> {
  if (!input.parentDecisionRef) {
    if (input.requestedFallbackRouteRef || input.fallbackReason) {
      return {
        route: null,
        parent: null,
        attemptOrdinal: 0,
        fallbackFromRouteRef: null,
        reasonCodes: ["primary_request_contains_fallback_fields"],
      };
    }
    const primary = input.policy.primaryRoutes.find(
      (item) => item.taskClass === input.taskClass,
    );
    return {
      route:
        input.policy.routes.find(
          (item) => item.routeId === primary?.routeRef,
        ) ?? null,
      parent: null,
      attemptOrdinal: 0,
      fallbackFromRouteRef: null,
      reasonCodes: primary ? [] : ["primary_route_not_configured"],
    };
  }

  const parentRow = await input.tx.modelRouteDecision.findFirst({
    where: {
      id: input.parentDecisionRef,
      workspaceId: input.workspaceId,
    },
  });
  if (!parentRow) {
    return {
      route: null,
      parent: null,
      attemptOrdinal: 1,
      fallbackFromRouteRef: null,
      reasonCodes: ["fallback_parent_decision_missing"],
    };
  }
  const parent = parseStoredModelRouteDecision(parentRow);
  const reasonCodes: string[] = [];
  if (parent.attemptOrdinal !== 0) {
    reasonCodes.push("fallback_attempt_limit_exceeded");
  }
  if (!input.requestedFallbackRouteRef || !input.fallbackReason) {
    reasonCodes.push("fallback_request_lineage_incomplete");
  }
  if (
    parent.policyRef !== input.policy.policyId ||
    parent.policyHash !== input.policy.policyHash
  ) {
    reasonCodes.push("fallback_parent_policy_mismatch");
  }
  if (!parent.routeSnapshot || !parent.routeRef) {
    reasonCodes.push("fallback_parent_route_missing");
  }
  const terminalRow = await input.tx.modelEgressReceipt.findUnique({
    where: {
      decisionId_sequence: {
        decisionId: parent.decisionId,
        sequence: 2,
      },
    },
  });
  if (!terminalRow) {
    reasonCodes.push("fallback_parent_terminal_receipt_missing");
  } else {
    const terminal = parseStoredModelEgressReceipt(terminalRow);
    if (terminal.outcome !== "failure") {
      reasonCodes.push("fallback_requires_explicit_parent_failure");
    } else {
      if (
        terminal.fallbackTargetRouteRef !==
        input.requestedFallbackRouteRef
      ) {
        reasonCodes.push(
          "fallback_parent_terminal_target_mismatch",
        );
      }
      if (terminal.fallbackReason !== input.fallbackReason) {
        reasonCodes.push(
          "fallback_parent_terminal_reason_mismatch",
        );
      }
    }
  }
  const route = input.policy.routes.find(
    (item) => item.routeId === input.requestedFallbackRouteRef,
  );
  if (!route) {
    reasonCodes.push("requested_fallback_route_missing");
  }
  if (
    parent.routeSnapshot &&
    input.requestedFallbackRouteRef &&
    !parent.routeSnapshot.fallbackRouteIds.includes(
      input.requestedFallbackRouteRef,
    )
  ) {
    reasonCodes.push("fallback_route_not_declared_by_parent");
  }
  if (parent.routeSnapshot && route) {
    const comparison = compareFallbackRouteSafety(
      parent.routeSnapshot,
      route,
    );
    comparison.weakerDimensions.forEach((dimension) =>
      reasonCodes.push(`fallback_weaker:${dimension}`),
    );
    comparison.incomparableDimensions.forEach((dimension) =>
      reasonCodes.push(`fallback_incomparable:${dimension}`),
    );
  }
  return {
    route: route ?? null,
    parent,
    attemptOrdinal: parent.attemptOrdinal + 1,
    fallbackFromRouteRef: parent.routeRef,
    reasonCodes,
  };
}

function createDecisionContract(input: {
  workspaceId: string;
  requestHash: string;
  request: Omit<PrepareModelRouteDecisionInput, "now">;
  policy: TenantModelRoutePolicy | null;
  policyHeadVersion: number;
  policyRevocationEpoch: number;
  classification: {
    sensitivity: ObservationSensitivity;
    processingDisposition: DataAssetProcessingDisposition;
    reasonCodes: string[];
    sourceAssetBindings: ModelSourceAssetBinding[];
    authorizationExpiries: Date[];
  };
  route: TenantModelRoute | null;
  readinessReceiptId: string | null;
  readinessState: ModelRouteDecision["adapterReadinessState"];
  catalogVisibilityState: ModelRouteDecision["catalogVisibilityState"];
  routeResolution: Awaited<ReturnType<typeof resolveRoute>>;
  projection: ReturnType<typeof normalizeProjectionReceipt>;
  reasonCodes: readonly string[];
  createdAt: Date;
  validUntil: Date;
}): ModelRouteDecision {
  const workspaceRef = `workspace:${input.workspaceId}`;
  const policyRef =
    input.policy?.policyId ??
    `policy:none:${input.request.policyKey}`;
  const policyHash =
    input.policy?.policyHash ??
    noActivePolicyHash({
      workspaceRef,
      policyKey: input.request.policyKey,
    });
  const candidate: ModelRouteDecision = {
    schemaVersion: "helm.model-route-decision/v1",
    decisionId: stableId("model-route-decision", {
      workspaceRef,
      requestKey: input.request.requestKey,
    }),
    workspaceRef,
    requestKey: input.request.requestKey,
    requestHash: input.requestHash,
    attemptOrdinal: input.routeResolution.attemptOrdinal,
    parentDecisionRef:
      input.request.parentDecisionRef ?? null,
    policyKey: input.request.policyKey,
    policyRef,
    policyHash,
    policyHeadVersion: input.policyHeadVersion,
    policyRevocationEpoch: input.policyRevocationEpoch,
    readinessReceiptRef:
      input.route?.readinessReceiptRef ?? null,
    readinessReceiptHash:
      input.route?.readinessReceiptHash ?? null,
    taskClass: input.request.taskClass,
    taskRef: input.request.taskRef,
    requestedMaxOutputTokens:
      input.request.requestedMaxOutputTokens,
    allowFallback: input.request.allowFallback,
    sensitivity: input.classification.sensitivity,
    processingDisposition:
      input.classification.processingDisposition,
    classificationReasonCodes: input.classification.reasonCodes,
    sourceAssetRefs: uniqueSorted(input.request.sourceAssetRefs),
    sourceAssetBindings: input.classification.sourceAssetBindings,
    candidateEvidenceRefs: uniqueSorted(
      input.request.candidateEvidenceRefs,
    ),
    selectedEvidenceRefs: uniqueSorted(
      input.request.selectedEvidenceRefs,
    ),
    droppedEvidenceRefs: uniqueSorted(
      input.request.droppedEvidenceRefs,
    ),
    projectionReceiptRef: input.projection.receiptRef,
    projectionReceiptHash: input.projection.receiptHash,
    projectedPayloadHash: input.request.projectedPayloadHash,
    promptInjectionScanStatus:
      input.request.promptInjectionScanStatus,
    routeRef: input.route?.routeId ?? null,
    routeSnapshot: input.route,
    adapterReadinessState: input.readinessState,
    catalogVisibilityState: input.catalogVisibilityState,
    decision: input.reasonCodes.length === 0 ? "allowed" : "blocked",
    reasonCodes: uniqueSorted(input.reasonCodes),
    requestedFallbackRouteRef:
      input.request.requestedFallbackRouteRef ?? null,
    fallbackFromRouteRef:
      input.routeResolution.fallbackFromRouteRef,
    fallbackReason: input.request.fallbackReason ?? null,
    validUntil: input.validUntil.toISOString(),
    createdAt: input.createdAt.toISOString(),
    rawContentIncluded: false,
    authorityEffect: "model_egress_only",
    contentHash: "sha256:pending",
  };
  return {
    ...candidate,
    contentHash: computeModelRouteDecisionHash(candidate),
  };
}

async function persistDecision(
  tx: Tx,
  input: {
    workspaceId: string;
    decision: ModelRouteDecision;
    policyId: string | null;
    readinessReceiptId: string | null;
  },
): Promise<void> {
  await tx.modelRouteDecision.create({
    data: {
      id: input.decision.decisionId,
      workspaceId: input.workspaceId,
      policyId: input.policyId,
      readinessReceiptId: input.readinessReceiptId,
      parentDecisionId: input.decision.parentDecisionRef,
      requestKey: input.decision.requestKey,
      requestHash: input.decision.requestHash,
      attemptOrdinal: input.decision.attemptOrdinal,
      policyKey: input.decision.policyKey,
      policyHeadVersion: input.decision.policyHeadVersion,
      policyRevocationEpoch:
        input.decision.policyRevocationEpoch,
      taskClass: input.decision.taskClass.toUpperCase(),
      taskRef: input.decision.taskRef,
      requestedMaxOutputTokens:
        input.decision.requestedMaxOutputTokens,
      allowFallback: input.decision.allowFallback,
      sensitivity: input.decision.sensitivity.toUpperCase(),
      processingDisposition:
        input.decision.processingDisposition.toUpperCase(),
      sourceAssetRefs: jsonStringify(input.decision.sourceAssetRefs),
      sourceAssetBindingsJson: jsonStringify(
        input.decision.sourceAssetBindings,
      ),
      candidateEvidenceRefs: jsonStringify(
        input.decision.candidateEvidenceRefs,
      ),
      selectedEvidenceRefs: jsonStringify(
        input.decision.selectedEvidenceRefs,
      ),
      droppedEvidenceRefs: jsonStringify(
        input.decision.droppedEvidenceRefs,
      ),
      projectionReceiptRef: input.decision.projectionReceiptRef,
      projectionReceiptHash: input.decision.projectionReceiptHash,
      projectedPayloadHash: input.decision.projectedPayloadHash,
      promptInjectionScanStatus:
        input.decision.promptInjectionScanStatus.toUpperCase(),
      routeRef: input.decision.routeRef,
      routeSnapshotJson: input.decision.routeSnapshot
        ? jsonStringify(input.decision.routeSnapshot)
        : null,
      adapterReadinessState:
        input.decision.adapterReadinessState.toUpperCase(),
      catalogVisibilityState:
        input.decision.catalogVisibilityState.toUpperCase(),
      decision: input.decision.decision.toUpperCase(),
      reasonCodes: jsonStringify(input.decision.reasonCodes),
      requestedFallbackRouteRef:
        input.decision.requestedFallbackRouteRef,
      fallbackFromRouteRef: input.decision.fallbackFromRouteRef,
      fallbackReason: input.decision.fallbackReason,
      validUntil: new Date(input.decision.validUntil),
      decisionJson: jsonStringify(input.decision),
      contentHash: input.decision.contentHash,
      createdAt: new Date(input.decision.createdAt),
    },
  });
}

async function persistEgressReceipt(
  tx: Tx,
  input: {
    workspaceId: string;
    receipt: ModelEgressReceipt;
  },
): Promise<void> {
  await tx.modelEgressReceipt.create({
    data: {
      id: input.receipt.receiptId,
      workspaceId: input.workspaceId,
      decisionId: input.receipt.decisionRef,
      previousReceiptId: input.receipt.previousReceiptRef,
      previousReceiptHash: input.receipt.previousReceiptHash,
      sequence: input.receipt.sequence,
      idempotencyKey: input.receipt.idempotencyKey,
      phase: input.receipt.phase.toUpperCase(),
      outcome: input.receipt.outcome.toUpperCase(),
      resolutionSource:
        input.receipt.resolutionSource.toUpperCase(),
      provider: input.receipt.provider,
      modelId: input.receipt.modelId,
      modelVersion: input.receipt.modelVersion,
      deploymentForm: input.receipt.deploymentForm.toUpperCase(),
      jurisdiction: input.receipt.jurisdiction.toUpperCase(),
      region: input.receipt.region,
      policyHash: input.receipt.policyHash,
      readinessReceiptHash: input.receipt.readinessReceiptHash,
      projectedPayloadHash: input.receipt.projectedPayloadHash,
      selectedEvidenceRefs: jsonStringify(
        input.receipt.selectedEvidenceRefs,
      ),
      droppedEvidenceRefs: jsonStringify(
        input.receipt.droppedEvidenceRefs,
      ),
      projectionReceiptRef: input.receipt.projectionReceiptRef,
      projectionReceiptHash: input.receipt.projectionReceiptHash,
      rawContentIncluded: false,
      dispatchGatewayRef: input.receipt.dispatchGatewayRef,
      dispatchRuntimeHash: input.receipt.dispatchRuntimeHash,
      dispatchClaimHash: input.receipt.dispatchClaimHash,
      requestDisposition:
        input.receipt.requestDisposition.toUpperCase(),
      providerRequestRefHash:
        input.receipt.providerRequestRefHash,
      startedAt: new Date(input.receipt.startedAt),
      finishedAt: input.receipt.finishedAt
        ? new Date(input.receipt.finishedAt)
        : null,
      latencyMs: input.receipt.latencyMs,
      promptTokens: input.receipt.promptTokens,
      completionTokens: input.receipt.completionTokens,
      actualCostUsdMicros: input.receipt.actualCostUsdMicros,
      costCurrency: input.receipt.costCurrency,
      pricingVersion: input.receipt.pricingVersion,
      costBand: input.receipt.costBand.toUpperCase(),
      errorCode: input.receipt.errorCode,
      fallbackTargetRouteRef:
        input.receipt.fallbackTargetRouteRef,
      fallbackReason: input.receipt.fallbackReason,
      auditRef: input.receipt.auditRef,
      receiptJson: jsonStringify(input.receipt),
      contentHash: input.receipt.contentHash,
      recordedAt: new Date(input.receipt.recordedAt),
    },
  });
}

function buildStartedReceipt(input: {
  decision: ModelRouteDecision;
  auditRef: string;
  startedAt: Date;
}): ModelEgressReceipt {
  if (
    !input.decision.routeSnapshot ||
    !input.decision.readinessReceiptHash
  ) {
    throw new ModelEgressStoreError(
      "allowed_decision_route_binding_missing",
    );
  }
  const route = input.decision.routeSnapshot;
  const candidate: ModelEgressReceipt = {
    schemaVersion: "helm.model-egress-receipt/v1",
    receiptId: stableId("model-egress-receipt", {
      decisionRef: input.decision.decisionId,
      sequence: 1,
    }),
    workspaceRef: input.decision.workspaceRef,
    decisionRef: input.decision.decisionId,
    previousReceiptRef: null,
    previousReceiptHash: null,
    sequence: 1,
    idempotencyKey: stableId("model-egress-started", {
      decisionRef: input.decision.decisionId,
    }),
    phase: "dispatch_started",
    outcome: "unknown",
    resolutionSource: "none",
    provider: route.provider,
    modelId: route.modelId,
    modelVersion: route.modelVersion,
    deploymentForm: route.deploymentForm,
    jurisdiction: route.jurisdiction,
    region: route.region,
    policyHash: input.decision.policyHash,
    readinessReceiptHash: input.decision.readinessReceiptHash,
    projectedPayloadHash: input.decision.projectedPayloadHash,
    selectedEvidenceRefs: input.decision.selectedEvidenceRefs,
    droppedEvidenceRefs: input.decision.droppedEvidenceRefs,
    projectionReceiptRef: input.decision.projectionReceiptRef,
    projectionReceiptHash: input.decision.projectionReceiptHash,
    rawContentIncluded: false,
    dispatchGatewayRef: null,
    dispatchRuntimeHash: null,
    dispatchClaimHash: null,
    requestDisposition: "unknown",
    providerRequestRefHash: null,
    startedAt: input.startedAt.toISOString(),
    finishedAt: null,
    latencyMs: null,
    promptTokens: null,
    completionTokens: null,
    actualCostUsdMicros: null,
    costCurrency: null,
    pricingVersion: null,
    costBand: "unknown",
    errorCode: null,
    fallbackTargetRouteRef: null,
    fallbackReason: null,
    auditRef: input.auditRef,
    recordedAt: input.startedAt.toISOString(),
    authorityEffect: "evidence_only",
    contentHash: "sha256:pending",
  };
  return {
    ...candidate,
    contentHash: computeModelEgressReceiptHash(candidate),
  };
}

export async function prepareModelRouteDecision(
  input: PrepareModelRouteDecisionInput,
) {
  assertAuthority(input.authority);
  const policyKey = nonEmpty(input.policyKey, "policy_key_required");
  const requestKey = nonEmpty(input.requestKey, "request_key_required");
  nonEmpty(input.taskRef, "task_ref_required");
  if (
    !Number.isSafeInteger(input.requestedMaxOutputTokens) ||
    input.requestedMaxOutputTokens <= 0
  ) {
    throw new ModelEgressStoreError(
      "requested_max_output_tokens_invalid",
    );
  }
  if (typeof input.allowFallback !== "boolean") {
    throw new ModelEgressStoreError("allow_fallback_invalid");
  }
  requireHash(input.projectedPayloadHash, "projected_payload_hash_invalid");
  const parentDecisionRef = input.parentDecisionRef ?? null;
  const requestedFallbackRouteRef =
    input.requestedFallbackRouteRef ?? null;
  const fallbackReason = input.fallbackReason ?? null;
  const ttlMs = input.decisionTtlMs ?? DEFAULT_DECISION_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new ModelEgressStoreError("decision_ttl_invalid");
  }
  const now = input.now ?? new Date();

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        const projectionRow = input.projectionReceiptRef
          ? await tx.governedModelProjectionReceipt.findFirst({
              where: {
                id: input.projectionReceiptRef,
                workspaceId: input.workspaceId,
              },
            })
          : null;
        const projection = normalizeProjectionReceipt(
          projectionRow
            ? parseStoredGovernedModelProjectionReceipt(
                projectionRow,
              )
            : null,
        );
        const requestHash = computeModelRouteRequestHash({
          workspaceRef: `workspace:${input.workspaceId}`,
          requestKey,
          policyKey,
          taskClass: input.taskClass,
          taskRef: input.taskRef,
          requestedMaxOutputTokens:
            input.requestedMaxOutputTokens,
          allowFallback: input.allowFallback,
          sourceAssetRefs: input.sourceAssetRefs,
          candidateEvidenceRefs: input.candidateEvidenceRefs,
          selectedEvidenceRefs: input.selectedEvidenceRefs,
          droppedEvidenceRefs: input.droppedEvidenceRefs,
          projectionReceiptRef: projection.receiptRef,
          projectionReceiptHash: projection.receiptHash,
          projectedPayloadHash: input.projectedPayloadHash,
          promptInjectionScanStatus:
            input.promptInjectionScanStatus,
          parentDecisionRef,
          requestedFallbackRouteRef,
          fallbackReason,
        });
        const replay = await tx.modelRouteDecision.findUnique({
          where: {
            workspaceId_requestKey: {
              workspaceId: input.workspaceId,
              requestKey,
            },
          },
        });
        if (replay) {
          const decision = parseStoredModelRouteDecision(replay);
          if (decision.requestHash !== requestHash) {
            throw new ModelEgressStoreError(
              "idempotency_key_payload_conflict",
            );
          }
          const startedRow =
            await tx.modelEgressReceipt.findUnique({
              where: {
                decisionId_sequence: {
                  decisionId: decision.decisionId,
                  sequence: 1,
                },
              },
            });
          if (decision.decision === "allowed" && !startedRow) {
            throw new ModelEgressStoreError(
              "allowed_decision_started_receipt_missing",
            );
          }
          return {
            decision,
            startedReceipt: startedRow
              ? parseStoredModelEgressReceipt(startedRow)
              : null,
            replayed: true,
          };
        }

        const classification =
          await deriveClassificationAndAuthorization({
            tx,
            workspaceId: input.workspaceId,
            sourceAssetRefs: input.sourceAssetRefs,
            now,
          });
        const head =
          await tx.tenantModelRoutePolicyHead.findUnique({
            where: {
              workspaceId_policyKey: {
                workspaceId: input.workspaceId,
                policyKey,
              },
            },
          });
        const policyRow = head
          ? await tx.tenantModelRoutePolicy.findFirst({
              where: {
                id: head.activePolicyId,
                workspaceId: input.workspaceId,
              },
            })
          : null;
        const policy = policyRow
          ? parseStoredTenantModelRoutePolicy(policyRow)
          : null;
        const routeResolution = policy
          ? await resolveRoute({
              tx,
              workspaceId: input.workspaceId,
              policy,
              taskClass: input.taskClass,
              parentDecisionRef,
              requestedFallbackRouteRef,
              fallbackReason,
            })
          : {
              route: null,
              parent: null,
              attemptOrdinal: parentDecisionRef ? 1 : 0,
              fallbackFromRouteRef: null,
              reasonCodes: ["no_active_model_route_policy"],
            };
        const reasonCodes = [
          ...classification.reasonCodes,
          ...routeResolution.reasonCodes,
          ...assertProjectionBinding({
            projection,
            sourceAssetRefs: input.sourceAssetRefs,
            candidateEvidenceRefs: input.candidateEvidenceRefs,
            selectedEvidenceRefs: input.selectedEvidenceRefs,
            droppedEvidenceRefs: input.droppedEvidenceRefs,
            projectedPayloadHash: input.projectedPayloadHash,
            promptInjectionScanStatus:
              input.promptInjectionScanStatus,
            now,
          }),
        ];
        if (
          !policy ||
          !policyRow ||
          policyRow.status !== "ACTIVE"
        ) {
          reasonCodes.push("no_active_model_route_policy");
        } else if (
          policyRow.validFrom.getTime() > now.getTime() ||
          policyRow.validUntil.getTime() <= now.getTime()
        ) {
          reasonCodes.push("active_model_route_policy_expired");
        }
        if (
          policy &&
          policyRow?.status === "ACTIVE"
        ) {
          try {
            await requireModelRoutePolicyOwnerApproval(tx, {
              workspaceId: input.workspaceId,
              policy,
            });
          } catch (error) {
            if (error instanceof ModelRoutePolicyStoreError) {
              reasonCodes.push(
                "model_route_policy_owner_approval_missing_or_invalid",
              );
            } else {
              throw error;
            }
          }
        }
        if (input.promptInjectionScanStatus !== "passed") {
          reasonCodes.push("prompt_injection_scan_not_passed");
        }
        if (
          projection.receipt &&
          input.requestedMaxOutputTokens >
            projection.receipt.maxOutputTokens
        ) {
          reasonCodes.push(
            "requested_output_token_budget_exceeds_projection",
          );
        }

        const route = routeResolution.route;
        let readinessReceiptId: string | null = null;
        let readinessState:
          ModelRouteDecision["adapterReadinessState"] = "unknown";
        let catalogVisibilityState:
          ModelRouteDecision["catalogVisibilityState"] = "unknown";
        let readinessExpiry: Date | null = null;
        if (!route) {
          reasonCodes.push("model_route_not_resolved");
        } else {
          const routeCheck = routeAllowsClassification({
            route,
            taskClass: input.taskClass,
            classification,
          });
          reasonCodes.push(...routeCheck.errors);
          if (projection.receipt) {
            reasonCodes.push(
              ...validateGovernedProjectionRouteBinding({
                receipt: projection.receipt,
                route,
              }).errors,
            );
          }
          if (
            route.deploymentForm !== "local" &&
            (!projection.receipt ||
              !projection.receipt.remoteSafe ||
              classification.processingDisposition !==
                "remote_projected")
          ) {
            reasonCodes.push(
              "remote_route_requires_remote_safe_projection",
            );
          }
          if (
            projection.receipt &&
            projection.receipt.maxInputTokens >
              route.maxInputTokens
          ) {
            reasonCodes.push(
              "projection_input_token_budget_exceeds_route",
            );
          }
          const projectedMaxOutputTokens =
            projection.receipt?.maxOutputTokens;
          if (
            projectedMaxOutputTokens !== undefined &&
            projectedMaxOutputTokens > route.maxOutputTokens
          ) {
            reasonCodes.push(
              "projection_output_token_budget_exceeds_route",
            );
          }
          if (
            input.requestedMaxOutputTokens >
            route.maxOutputTokens
          ) {
            reasonCodes.push(
              "requested_output_token_budget_exceeds_route",
            );
          }
          const readinessRow =
            await tx.providerAdapterReadinessReceipt.findFirst({
              where: {
                id: route.readinessReceiptRef,
                workspaceId: input.workspaceId,
              },
            });
          if (!readinessRow) {
            readinessState = "not_ready";
            reasonCodes.push("adapter_readiness_receipt_missing");
          } else {
            readinessReceiptId = readinessRow.id;
            const readiness =
              parseStoredProviderReadiness(readinessRow);
            catalogVisibilityState = "unknown";
            const match = readinessReceiptMatchesRoute({
              receipt: readiness,
              route,
              now,
            });
            readinessState = match.valid ? "ready" : "not_ready";
            reasonCodes.push(...match.errors);
            readinessExpiry = new Date(readiness.expiresAt);
          }
        }
        const futureAuthorityExpiries = [
          policyRow?.validUntil ?? null,
          readinessExpiry,
          projection.receipt
            ? new Date(projection.receipt.validUntil)
            : null,
          ...classification.authorizationExpiries,
        ].filter(
          (value): value is Date =>
            value !== null && value.getTime() > now.getTime(),
        );
        const validUntil = minDate(
          new Date(now.getTime() + ttlMs),
          ...futureAuthorityExpiries,
        );
        const normalizedInput = {
          ...input,
          policyKey,
          requestKey,
          parentDecisionRef,
          requestedFallbackRouteRef,
          fallbackReason,
        };
        const decision = createDecisionContract({
          workspaceId: input.workspaceId,
          requestHash,
          request: normalizedInput,
          policy,
          policyHeadVersion: head?.version ?? 0,
          policyRevocationEpoch: head?.revocationEpoch ?? 0,
          classification,
          route,
          readinessReceiptId,
          readinessState,
          catalogVisibilityState,
          routeResolution,
          projection,
          reasonCodes: uniqueSorted(reasonCodes),
          createdAt: now,
          validUntil,
        });
        const validation = validateModelRouteDecision(decision);
        if (!validation.valid) {
          throw new ModelEgressStoreError(
            "computed_model_route_decision_invalid",
            validation.errors,
          );
        }
        await persistDecision(tx, {
          workspaceId: input.workspaceId,
          decision,
          policyId: policyRow?.id ?? null,
          readinessReceiptId,
        });
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: null,
            actor: GOVERNED_GATEWAY_AUDIT_ACTOR,
            actorType: ActorType.SYSTEM,
            actionType: "MODEL_ROUTE_DECISION_RECORDED",
            targetType: "ModelRouteDecision",
            targetId: decision.decisionId,
            summary:
              "Recorded pre-dispatch model route decision",
            payload: {
              policyKey,
              policyHash: decision.policyHash,
              routeRef: decision.routeRef,
              decision: decision.decision,
              reasonCodes: decision.reasonCodes,
              projectedPayloadHash:
                decision.projectedPayloadHash,
              rawContentIncluded: false,
            },
          },
          { client: tx },
        );

        let startedReceipt: ModelEgressReceipt | null = null;
        if (decision.decision === "allowed") {
          const startedAudit = await writeAuditLog(
            {
              workspaceId: input.workspaceId,
              userId: null,
              actor: GOVERNED_GATEWAY_AUDIT_ACTOR,
              actorType: ActorType.SYSTEM,
              actionType: "MODEL_EGRESS_DISPATCH_STARTED",
              targetType: "ModelRouteDecision",
              targetId: decision.decisionId,
              summary:
                "Recorded UNKNOWN pre-dispatch receipt before adapter claim",
              payload: {
                policyHash: decision.policyHash,
                readinessReceiptHash:
                  decision.readinessReceiptHash,
                projectedPayloadHash:
                  decision.projectedPayloadHash,
                rawContentIncluded: false,
              },
            },
            { client: tx },
          );
          startedReceipt = buildStartedReceipt({
            decision,
            auditRef: startedAudit.id,
            startedAt: now,
          });
          const receiptValidation =
            validateModelEgressReceipt(startedReceipt);
          if (!receiptValidation.valid) {
            throw new ModelEgressStoreError(
              "computed_started_receipt_invalid",
              receiptValidation.errors,
            );
          }
          await persistEgressReceipt(tx, {
            workspaceId: input.workspaceId,
            receipt: startedReceipt,
          });
        }
        return {
          decision,
          startedReceipt,
          replayed: false,
        };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

function assertRuntimeDescriptorMatches(input: {
  descriptor: GovernedProviderRuntimeDescriptor;
  route: TenantModelRoute;
  readiness: ReturnType<typeof parseStoredProviderReadiness>;
  now: Date;
}): void {
  const reasons: string[] = [];
  const { descriptor, route, readiness } = input;
  for (const [field, value] of [
    ["provider", descriptor.provider],
    ["model_id", descriptor.modelId],
    ["model_version", descriptor.modelVersion],
    ["adapter_key", descriptor.adapterKey],
    ["adapter_version", descriptor.adapterVersion],
    ["region", descriptor.region],
  ] as const) {
    if (!isSafeModelGovernanceIdentifier(value)) {
      reasons.push(`runtime_${field}_invalid`);
    }
  }
  if (!isSafeModelGovernanceRef(descriptor.credentialRef)) {
    reasons.push("runtime_credential_ref_invalid");
  }
  if (
    !isSafeModelGovernanceRef(
      descriptor.adapterRegistrationRef,
    )
  ) {
    reasons.push("runtime_adapter_registration_ref_invalid");
  }
  if (
    !/^sha256:[a-f0-9]{64}$/.test(
      descriptor.adapterRegistrationHash,
    )
  ) {
    reasons.push("runtime_adapter_registration_hash_invalid");
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(descriptor.endpointFingerprint)) {
    reasons.push("runtime_endpoint_fingerprint_invalid");
  }
  for (const [field, observed, expected] of [
    ["provider", descriptor.provider, route.provider],
    ["model_id", descriptor.modelId, route.modelId],
    ["model_version", descriptor.modelVersion, route.modelVersion],
    ["adapter_key", descriptor.adapterKey, route.adapterKey],
    [
      "adapter_version",
      descriptor.adapterVersion,
      readiness.adapterVersion,
    ],
    [
      "adapter_registration_ref",
      descriptor.adapterRegistrationRef,
      readiness.adapterRegistrationRef,
    ],
    [
      "adapter_registration_hash",
      descriptor.adapterRegistrationHash,
      readiness.adapterRegistrationHash,
    ],
    [
      "deployment_form",
      descriptor.deploymentForm,
      route.deploymentForm,
    ],
    ["jurisdiction", descriptor.jurisdiction, route.jurisdiction],
    ["region", descriptor.region, route.region],
    [
      "endpoint_fingerprint",
      descriptor.endpointFingerprint,
      readiness.endpointFingerprint,
    ],
    ["credential_ref", descriptor.credentialRef, route.credentialRef],
  ] as const) {
    if (observed !== expected) {
      reasons.push(`runtime_${field}_mismatch`);
    }
  }
  if (!descriptor.adapterRegistered) {
    reasons.push("runtime_adapter_not_registered");
  }
  if (!descriptor.credentialConfigured) {
    reasons.push("provider_specific_credential_not_configured");
  }
  if (
    !descriptor.credentialRef.startsWith("secret:") ||
    !isSafeModelGovernanceRef(descriptor.credentialRef)
  ) {
    reasons.push("runtime_credential_ref_invalid");
  }
  const observedAt = Date.parse(descriptor.observedAt);
  if (
    !Number.isFinite(observedAt) ||
    observedAt > input.now.getTime() ||
    input.now.getTime() - observedAt >
      MAX_RUNTIME_DESCRIPTOR_AGE_MS
  ) {
    reasons.push("runtime_descriptor_stale_or_invalid");
  }
  if (reasons.length > 0) {
    throw new ModelEgressStoreError(
      "provider_runtime_not_ready",
      reasons,
    );
  }
}

export async function claimModelRouteDispatch(input: {
  authority: GovernedModelEgressAuthority;
  workspaceId: string;
  decisionId: string;
  gatewayRef: string;
  runtime: GovernedProviderRuntimeDescriptor;
  now?: Date;
}) {
  assertAuthority(input.authority);
  const gatewayRef = nonEmpty(input.gatewayRef, "gateway_ref_required");
  if (!isSafeModelGovernanceRef(gatewayRef)) {
    throw new ModelEgressStoreError("gateway_ref_invalid");
  }
  const now = input.now ?? new Date();
  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        const row = await tx.modelRouteDecision.findFirst({
          where: {
            id: input.decisionId,
            workspaceId: input.workspaceId,
          },
        });
        if (!row) {
          throw new ModelEgressStoreError("model_route_decision_not_found");
        }
        const decision = parseStoredModelRouteDecision(row);
        if (decision.decision !== "allowed" || !decision.routeSnapshot) {
          throw new ModelEgressStoreError(
            "blocked_model_route_decision_not_dispatchable",
          );
        }
        if (row.validUntil.getTime() <= now.getTime()) {
          throw new ModelEgressStoreError(
            "model_route_decision_expired",
          );
        }
        const head =
          await tx.tenantModelRoutePolicyHead.findUnique({
            where: {
              workspaceId_policyKey: {
                workspaceId: input.workspaceId,
                policyKey: decision.policyKey,
              },
            },
          });
        if (
          !head ||
          head.activePolicyId !== decision.policyRef ||
          head.version !== decision.policyHeadVersion ||
          head.revocationEpoch !==
            decision.policyRevocationEpoch
        ) {
          throw new ModelEgressStoreError(
            "model_route_policy_head_changed",
          );
        }
        const policyRow =
          await tx.tenantModelRoutePolicy.findFirst({
            where: {
              id: decision.policyRef,
              workspaceId: input.workspaceId,
            },
          });
        if (
          !policyRow ||
          policyRow.status !== "ACTIVE" ||
          policyRow.validFrom.getTime() > now.getTime() ||
          policyRow.validUntil.getTime() <= now.getTime()
        ) {
          throw new ModelEgressStoreError(
            "model_route_policy_not_active",
          );
        }
        const policy = parseStoredTenantModelRoutePolicy(policyRow);
        if (policy.policyHash !== decision.policyHash) {
          throw new ModelEgressStoreError(
            "model_route_policy_hash_changed",
          );
        }
        try {
          await requireModelRoutePolicyOwnerApproval(tx, {
            workspaceId: input.workspaceId,
            policy,
          });
        } catch (error) {
          if (error instanceof ModelRoutePolicyStoreError) {
            throw new ModelEgressStoreError(
              "model_route_policy_owner_approval_missing_or_invalid",
              error.reasons.length > 0
                ? error.reasons
                : [error.message],
            );
          }
          throw error;
        }
        const currentSourceAuthority =
          await deriveClassificationAndAuthorization({
            tx,
            workspaceId: input.workspaceId,
            sourceAssetRefs: decision.sourceAssetRefs,
            now,
          });
        const sourceAuthorityReasons = [
          ...currentSourceAuthority.reasonCodes,
        ];
        if (
          currentSourceAuthority.sensitivity !== decision.sensitivity ||
          currentSourceAuthority.processingDisposition !==
            decision.processingDisposition
        ) {
          sourceAuthorityReasons.push(
            "source_asset_classification_changed",
          );
        }
        if (
          canonicalJson(currentSourceAuthority.sourceAssetBindings) !==
          canonicalJson(decision.sourceAssetBindings)
        ) {
          sourceAuthorityReasons.push(
            "source_asset_authority_binding_changed",
          );
        }
        if (sourceAuthorityReasons.length > 0) {
          throw new ModelEgressStoreError(
            "source_asset_authority_changed",
            uniqueSorted(sourceAuthorityReasons),
          );
        }
        if (
          !row.projectionReceiptRef ||
          !row.projectionReceiptHash ||
          decision.projectionReceiptRef !==
            row.projectionReceiptRef ||
          decision.projectionReceiptHash !==
            row.projectionReceiptHash
        ) {
          throw new ModelEgressStoreError(
            "model_route_projection_relation_missing_or_changed",
          );
        }
        const projectionRow =
          await tx.governedModelProjectionReceipt.findFirst({
            where: {
              id: row.projectionReceiptRef,
              workspaceId: input.workspaceId,
            },
          });
        if (!projectionRow) {
          throw new ModelEgressStoreError(
            "model_route_projection_receipt_missing",
          );
        }
        const projection =
          parseStoredGovernedModelProjectionReceipt(
            projectionRow,
          );
        const projectionTrust =
          validateGovernedProjectionRouteBinding({
            receipt: projection,
            route: decision.routeSnapshot,
          });
        if (
          projection.contentHash !==
            decision.projectionReceiptHash ||
          !projectionTrust.valid
        ) {
          throw new ModelEgressStoreError(
            "model_route_projection_trust_changed",
            projectionTrust.errors,
          );
        }
        if (!row.readinessReceiptId) {
          throw new ModelEgressStoreError(
            "model_route_readiness_relation_missing",
          );
        }
        const readinessRow =
          await tx.providerAdapterReadinessReceipt.findFirst({
            where: {
              id: row.readinessReceiptId,
              workspaceId: input.workspaceId,
            },
          });
        if (!readinessRow) {
          throw new ModelEgressStoreError(
            "model_route_readiness_receipt_missing",
          );
        }
        const readiness =
          parseStoredProviderReadiness(readinessRow);
        const readinessMatch = readinessReceiptMatchesRoute({
          receipt: readiness,
          route: decision.routeSnapshot,
          now,
        });
        if (!readinessMatch.valid) {
          throw new ModelEgressStoreError(
            "model_route_readiness_expired_or_changed",
            readinessMatch.errors,
          );
        }
        assertRuntimeDescriptorMatches({
          descriptor: input.runtime,
          route: decision.routeSnapshot,
          readiness,
          now,
        });
        const startedRow =
          await tx.modelEgressReceipt.findUnique({
            where: {
              decisionId_sequence: {
                decisionId: decision.decisionId,
                sequence: 1,
              },
            },
          });
        if (!startedRow) {
          throw new ModelEgressStoreError(
            "model_route_started_receipt_missing",
          );
        }
        const startedReceipt =
          parseStoredModelEgressReceipt(startedRow);
        const runtimeHash =
          computeGovernedProviderRuntimeHash(input.runtime);
        const runtimeJson = jsonStringify(input.runtime);
        const claimFields = [
          row.dispatchClaimedAt,
          row.dispatchGatewayRef,
          row.dispatchRuntimeJson,
          row.dispatchRuntimeHash,
          row.dispatchClaimHash,
          row.dispatchProviderIdempotencyKey,
          row.dispatchLeaseExpiresAt,
        ];
        const populatedClaimFields = claimFields.filter(
          (value) => value !== null,
        ).length;
        if (
          populatedClaimFields !== 0 &&
          populatedClaimFields !== claimFields.length
        ) {
          throw new ModelEgressStoreError(
            "stored_model_route_dispatch_claim_shape_invalid",
          );
        }
        if (populatedClaimFields === claimFields.length) {
          if (
            row.dispatchGatewayRef !== gatewayRef ||
            row.dispatchRuntimeJson !== runtimeJson ||
            row.dispatchRuntimeHash !== runtimeHash ||
            !row.dispatchClaimedAt ||
            !row.dispatchClaimHash ||
            !row.dispatchProviderIdempotencyKey ||
            !row.dispatchLeaseExpiresAt
          ) {
            throw new ModelEgressStoreError(
              "model_route_dispatch_already_claimed",
            );
          }
          return {
            decision,
            startedReceipt,
            runtimeHash,
            claimHash: row.dispatchClaimHash,
            providerIdempotencyKey:
              row.dispatchProviderIdempotencyKey,
            claimedAt: row.dispatchClaimedAt.toISOString(),
            leaseExpiresAt:
              row.dispatchLeaseExpiresAt.toISOString(),
            replayed: true,
          };
        }
        const activeRouteDispatches =
          await tx.modelRouteDecision.count({
            where: {
              workspaceId: input.workspaceId,
              routeRef: decision.routeSnapshot.routeId,
              dispatchClaimedAt: { not: null },
              egressReceipts: {
                none: {
                  sequence: 2,
                },
              },
            },
          });
        if (
          activeRouteDispatches >=
          decision.routeSnapshot.maxConcurrency
        ) {
          throw new ModelEgressStoreError(
            "model_route_concurrency_limit_reached",
          );
        }
        const leaseExpiresAt = new Date(
          now.getTime() +
            dispatchLeaseDurationMs(
              decision.routeSnapshot.maxLatencyMs,
            ),
        );
        const claimHash = sha256(
          canonicalJson({
            schemaVersion: "helm.model-egress-dispatch-claim/v1",
            decisionHash: decision.contentHash,
            gatewayRef,
            runtimeHash,
            policyHeadVersion: head.version,
            policyRevocationEpoch: head.revocationEpoch,
            claimedAt: now.toISOString(),
            leaseExpiresAt: leaseExpiresAt.toISOString(),
          }),
        );
        const providerIdempotencyKey =
          computeModelProviderIdempotencyKey({
            decisionRef: decision.decisionId,
            dispatchClaimHash: claimHash,
          });
        const claimed = await tx.modelRouteDecision.updateMany({
          where: {
            id: row.id,
            workspaceId: input.workspaceId,
            decision: "ALLOWED",
            dispatchClaimedAt: null,
            dispatchGatewayRef: null,
            dispatchRuntimeJson: null,
            dispatchRuntimeHash: null,
            dispatchClaimHash: null,
            dispatchProviderIdempotencyKey: null,
            dispatchLeaseExpiresAt: null,
            validUntil: { gt: now },
          },
          data: {
            dispatchClaimedAt: now,
            dispatchGatewayRef: gatewayRef,
            dispatchRuntimeJson: runtimeJson,
            dispatchRuntimeHash: runtimeHash,
            dispatchClaimHash: claimHash,
            dispatchProviderIdempotencyKey:
              providerIdempotencyKey,
            dispatchLeaseExpiresAt: leaseExpiresAt,
          },
        });
        if (claimed.count !== 1) {
          throw new ModelEgressStoreError(
            "model_route_dispatch_claim_lost",
          );
        }
        await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: null,
            actor: GOVERNED_GATEWAY_AUDIT_ACTOR,
            actorType: ActorType.SYSTEM,
            actionType: "MODEL_EGRESS_DISPATCH_CLAIMED",
            targetType: "ModelRouteDecision",
            targetId: decision.decisionId,
            summary:
              "Claimed one governed model dispatch after policy and runtime revalidation",
            payload: {
              gatewayRef,
              runtimeHash,
              claimHash,
              providerIdempotencyKey,
              leaseExpiresAt: leaseExpiresAt.toISOString(),
              policyHash: decision.policyHash,
              readinessReceiptHash:
                decision.readinessReceiptHash,
              projectedPayloadHash:
                decision.projectedPayloadHash,
              rawContentIncluded: false,
            },
          },
          { client: tx },
        );
        return {
          decision,
          startedReceipt,
          runtimeHash,
          claimHash,
          providerIdempotencyKey,
          claimedAt: now.toISOString(),
          leaseExpiresAt: leaseExpiresAt.toISOString(),
          replayed: false,
        };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

function terminalInputMatches(input: {
  receipt: ModelEgressReceipt;
  gatewayRef: string;
  dispatchRuntimeHash: string;
  dispatchClaimHash: string;
  outcome: Exclude<ModelEgressOutcome, "unknown">;
  resolutionSource: ModelEgressResolutionSource;
  requestDisposition:
    | "not_accepted"
    | "accepted";
  providerRequestRefHash: string | null;
  finishedAt: Date;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  actualCostUsdMicros: number;
  costCurrency: "USD";
  pricingVersion: string;
  costBand: ModelEgressCostBand;
  errorCode: string | null;
  fallbackTargetRouteRef: string | null;
  fallbackReason: string | null;
}): boolean {
  return (
    input.receipt.dispatchGatewayRef === input.gatewayRef &&
    input.receipt.dispatchRuntimeHash === input.dispatchRuntimeHash &&
    input.receipt.dispatchClaimHash === input.dispatchClaimHash &&
    input.receipt.outcome === input.outcome &&
    input.receipt.resolutionSource === input.resolutionSource &&
    input.receipt.requestDisposition ===
      input.requestDisposition &&
    input.receipt.providerRequestRefHash ===
      input.providerRequestRefHash &&
    input.receipt.finishedAt === input.finishedAt.toISOString() &&
    input.receipt.latencyMs === input.latencyMs &&
    input.receipt.promptTokens === input.promptTokens &&
    input.receipt.completionTokens === input.completionTokens &&
    input.receipt.actualCostUsdMicros ===
      input.actualCostUsdMicros &&
    input.receipt.costCurrency === input.costCurrency &&
    input.receipt.pricingVersion === input.pricingVersion &&
    input.receipt.costBand === input.costBand &&
    input.receipt.errorCode === input.errorCode &&
    input.receipt.fallbackTargetRouteRef ===
      input.fallbackTargetRouteRef &&
    input.receipt.fallbackReason === input.fallbackReason
  );
}

export async function recordModelEgressTerminalReceipt(input: {
  authority: GovernedModelEgressAuthority;
  workspaceId: string;
  decisionId: string;
  gatewayRef: string;
  dispatchClaimHash: string;
  idempotencyKey: string;
  outcome: Exclude<ModelEgressOutcome, "unknown">;
  resolutionSource: Exclude<
    ModelEgressResolutionSource,
    "none"
  >;
  requestDisposition:
    | "not_accepted"
    | "accepted";
  providerRequestRefHash: string | null;
  finishedAt: Date;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  actualCostUsdMicros: number;
  costCurrency: "USD";
  pricingVersion: string;
  costBand: ModelEgressCostBand;
  errorCode: string | null;
  fallbackTargetRouteRef?: string | null;
  fallbackReason?: string | null;
  recordedAt?: Date;
}) {
  assertAuthority(input.authority);
  if (input.outcome === ("unknown" as ModelEgressOutcome)) {
    throw new ModelEgressStoreError(
      "terminal_receipt_outcome_must_be_known",
    );
  }
  if (
    input.requestDisposition !== "not_accepted" &&
    input.requestDisposition !== "accepted"
  ) {
    throw new ModelEgressStoreError(
      "terminal_receipt_request_disposition_must_be_known",
    );
  }
  if (
    input.resolutionSource !== "invoke" &&
    input.resolutionSource !== "reconcile"
  ) {
    throw new ModelEgressStoreError(
      "resolution_source_invalid",
    );
  }
  if (
    !Number.isSafeInteger(input.actualCostUsdMicros) ||
    input.actualCostUsdMicros < 0 ||
    input.actualCostUsdMicros >
      MODEL_GOVERNANCE_PERSISTED_INT_MAX
  ) {
    throw new ModelEgressStoreError(
      "actual_cost_usd_micros_invalid",
    );
  }
  if (input.costCurrency !== "USD") {
    throw new ModelEgressStoreError("cost_currency_must_be_usd");
  }
  if (
    !isSafeModelGovernanceIdentifier(input.pricingVersion)
  ) {
    throw new ModelEgressStoreError("pricing_version_invalid");
  }
  if (
    input.requestDisposition === "not_accepted" &&
    input.actualCostUsdMicros !== 0
  ) {
    throw new ModelEgressStoreError(
      "not_accepted_receipt_cost_must_be_zero",
    );
  }
  const gatewayRef = nonEmpty(input.gatewayRef, "gateway_ref_required");
  if (!isSafeModelGovernanceRef(gatewayRef)) {
    throw new ModelEgressStoreError("gateway_ref_invalid");
  }
  const idempotencyKey = nonEmpty(
    input.idempotencyKey,
    "idempotency_key_required",
  );
  if (!isSafeModelGovernanceIdentifier(idempotencyKey)) {
    throw new ModelEgressStoreError("idempotency_key_invalid");
  }
  requireHash(input.dispatchClaimHash, "dispatch_claim_hash_invalid");
  if (input.providerRequestRefHash) {
    requireHash(
      input.providerRequestRefHash,
      "provider_request_ref_hash_invalid",
    );
  }
  if (
    input.requestDisposition === "accepted" &&
    input.providerRequestRefHash === null
  ) {
    throw new ModelEgressStoreError(
      "accepted_receipt_provider_request_ref_required",
    );
  }
  if (
    input.requestDisposition === "not_accepted" &&
    input.providerRequestRefHash !== null
  ) {
    throw new ModelEgressStoreError(
      "not_accepted_receipt_must_not_have_provider_request_ref",
    );
  }
  const recordedAt = input.recordedAt ?? new Date();
  if (
    !Number.isFinite(input.finishedAt.getTime()) ||
    !Number.isFinite(recordedAt.getTime()) ||
    recordedAt.getTime() < input.finishedAt.getTime()
  ) {
    throw new ModelEgressStoreError("terminal_receipt_time_invalid");
  }
  const fallbackTargetRouteRef =
    input.fallbackTargetRouteRef ?? null;
  const fallbackReason = input.fallbackReason ?? null;

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockModelEgressWorkspace(tx, input.workspaceId);
        const row = await tx.modelRouteDecision.findFirst({
          where: {
            id: input.decisionId,
            workspaceId: input.workspaceId,
          },
        });
        if (!row) {
          throw new ModelEgressStoreError("model_route_decision_not_found");
        }
        const decision = parseStoredModelRouteDecision(row);
        if (
          !decision.routeSnapshot ||
          input.pricingVersion !==
            decision.routeSnapshot.pricingVersion
        ) {
          throw new ModelEgressStoreError(
            "pricing_version_not_owner_approved",
          );
        }
        if (
          input.actualCostUsdMicros >
          decision.routeSnapshot.maxCostUsdMicros
        ) {
          throw new ModelEgressStoreError(
            "route_cost_budget_exceeded",
          );
        }
        if (
          input.promptTokens !== null &&
          decision.routeSnapshot &&
          input.promptTokens >
            decision.routeSnapshot.maxInputTokens
        ) {
          throw new ModelEgressStoreError(
            "route_input_token_budget_exceeded",
          );
        }
        if (
          input.completionTokens !== null &&
          input.completionTokens >
            decision.requestedMaxOutputTokens
        ) {
          throw new ModelEgressStoreError(
            "requested_output_token_budget_exceeded",
          );
        }
        if (
          !row.dispatchClaimedAt ||
          row.dispatchGatewayRef !== gatewayRef ||
          row.dispatchClaimHash !== input.dispatchClaimHash ||
          !row.dispatchRuntimeJson ||
          !row.dispatchRuntimeHash ||
          !row.dispatchProviderIdempotencyKey ||
          !row.dispatchLeaseExpiresAt
        ) {
          throw new ModelEgressStoreError(
            "model_route_dispatch_claim_mismatch",
          );
        }
        if (
          input.resolutionSource === "reconcile" &&
          recordedAt.getTime() <
            row.dispatchLeaseExpiresAt.getTime()
        ) {
          throw new ModelEgressStoreError(
            "dispatch_reconciliation_before_lease_expiry",
          );
        }
        const existing =
          await tx.modelEgressReceipt.findUnique({
            where: {
              decisionId_sequence: {
                decisionId: decision.decisionId,
                sequence: 2,
              },
            },
          });
        if (existing) {
          const receipt = parseStoredModelEgressReceipt(existing);
          if (
            receipt.idempotencyKey !== idempotencyKey ||
            !terminalInputMatches({
              receipt,
              gatewayRef,
              dispatchRuntimeHash: row.dispatchRuntimeHash,
              dispatchClaimHash: input.dispatchClaimHash,
              outcome: input.outcome,
              resolutionSource: input.resolutionSource,
              requestDisposition:
                input.requestDisposition,
              providerRequestRefHash:
                input.providerRequestRefHash,
              finishedAt: input.finishedAt,
              latencyMs: input.latencyMs,
              promptTokens: input.promptTokens,
              completionTokens: input.completionTokens,
              actualCostUsdMicros:
                input.actualCostUsdMicros,
              costCurrency: input.costCurrency,
              pricingVersion: input.pricingVersion,
              costBand: input.costBand,
              errorCode: input.errorCode,
              fallbackTargetRouteRef,
              fallbackReason,
            })
          ) {
            throw new ModelEgressStoreError(
              "terminal_receipt_idempotency_conflict",
            );
          }
          return { receipt, replayed: true };
        }
        const startedRow =
          await tx.modelEgressReceipt.findUnique({
            where: {
              decisionId_sequence: {
                decisionId: decision.decisionId,
                sequence: 1,
              },
            },
          });
        if (!startedRow || !decision.routeSnapshot) {
          throw new ModelEgressStoreError(
            "started_receipt_or_route_missing",
          );
        }
        const started =
          parseStoredModelEgressReceipt(startedRow);
        if (fallbackTargetRouteRef) {
          if (
            input.outcome !== "failure" ||
            input.requestDisposition !== "not_accepted" ||
            fallbackReason !== input.errorCode ||
            !decision.allowFallback ||
            !decision.routeSnapshot.fallbackRouteIds.includes(
              fallbackTargetRouteRef,
            )
          ) {
            throw new ModelEgressStoreError(
              "terminal_fallback_target_not_declared",
            );
          }
          const policyRow =
            await tx.tenantModelRoutePolicy.findFirst({
              where: {
                id: decision.policyRef,
                workspaceId: input.workspaceId,
              },
            });
          const fallbackRoute = policyRow
            ? parseStoredTenantModelRoutePolicy(policyRow).routes.find(
                (route) => route.routeId === fallbackTargetRouteRef,
              )
            : null;
          if (!fallbackRoute) {
            throw new ModelEgressStoreError(
              "terminal_fallback_route_missing",
            );
          }
          const fallbackSafety = compareFallbackRouteSafety(
            decision.routeSnapshot,
            fallbackRoute,
          );
          if (!fallbackSafety.safe) {
            throw new ModelEgressStoreError(
              "terminal_fallback_route_not_equivalent",
              [
                ...fallbackSafety.weakerDimensions.map(
                  (dimension) => `fallback_weaker:${dimension}`,
                ),
                ...fallbackSafety.incomparableDimensions.map(
                  (dimension) => `fallback_incomparable:${dimension}`,
                ),
              ],
            );
          }
        }
        const terminalAudit = await writeAuditLog(
          {
            workspaceId: input.workspaceId,
            userId: null,
            actor: GOVERNED_GATEWAY_AUDIT_ACTOR,
            actorType: ActorType.SYSTEM,
            actionType: "MODEL_EGRESS_TERMINAL_RECORDED",
            targetType: "ModelRouteDecision",
            targetId: decision.decisionId,
            summary:
              "Recorded terminal model egress outcome before exposing model output",
            payload: {
              outcome: input.outcome,
              resolutionSource: input.resolutionSource,
              requestDisposition:
                input.requestDisposition,
              providerRequestRefHash:
                input.providerRequestRefHash,
              latencyMs: input.latencyMs,
              promptTokens: input.promptTokens,
              completionTokens: input.completionTokens,
              actualCostUsdMicros:
                input.actualCostUsdMicros,
              costCurrency: input.costCurrency,
              pricingVersion: input.pricingVersion,
              costBand: input.costBand,
              errorCode: input.errorCode,
              fallbackTargetRouteRef,
              fallbackReason,
              rawContentIncluded: false,
            },
          },
          { client: tx },
        );
        const candidate: ModelEgressReceipt = {
          ...started,
          receiptId: stableId("model-egress-receipt", {
            decisionRef: decision.decisionId,
            sequence: 2,
          }),
          previousReceiptRef: started.receiptId,
          previousReceiptHash: started.contentHash,
          sequence: 2,
          idempotencyKey,
          phase: "terminal",
          outcome: input.outcome,
          resolutionSource: input.resolutionSource,
          requestDisposition: input.requestDisposition,
          dispatchGatewayRef: gatewayRef,
          dispatchRuntimeHash: row.dispatchRuntimeHash,
          dispatchClaimHash: input.dispatchClaimHash,
          providerRequestRefHash:
            input.providerRequestRefHash,
          finishedAt: input.finishedAt.toISOString(),
          latencyMs: input.latencyMs,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          actualCostUsdMicros: input.actualCostUsdMicros,
          costCurrency: input.costCurrency,
          pricingVersion: input.pricingVersion,
          costBand: input.costBand,
          errorCode: input.errorCode,
          fallbackTargetRouteRef,
          fallbackReason,
          auditRef: terminalAudit.id,
          recordedAt: recordedAt.toISOString(),
          contentHash: "sha256:pending",
        };
        const terminal: ModelEgressReceipt = {
          ...candidate,
          contentHash: computeModelEgressReceiptHash(candidate),
        };
        const validation = validateModelEgressReceiptChain({
          decision,
          started,
          terminal,
        });
        if (!validation.valid) {
          throw new ModelEgressStoreError(
            "computed_terminal_receipt_invalid",
            validation.errors,
          );
        }
        await persistEgressReceipt(tx, {
          workspaceId: input.workspaceId,
          receipt: terminal,
        });
        return { receipt: terminal, replayed: false };
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export async function readModelRouteDecision(input: {
  workspaceId: string;
  decisionId: string;
}) {
  const row = await db.modelRouteDecision.findFirst({
    where: {
      id: input.decisionId,
      workspaceId: input.workspaceId,
    },
  });
  if (!row) return null;
  const decision = parseStoredModelRouteDecision(row);
  const receipts = await db.modelEgressReceipt.findMany({
    where: {
      workspaceId: input.workspaceId,
      decisionId: input.decisionId,
    },
    orderBy: { sequence: "asc" },
  });
  const dispatchRuntime = parseStoredDispatchRuntime(
    row.dispatchRuntimeJson,
    row.dispatchRuntimeHash,
  );
  if (
    row.dispatchClaimedAt &&
    (!row.dispatchGatewayRef ||
      !dispatchRuntime ||
      !row.dispatchRuntimeHash ||
      !row.dispatchClaimHash ||
      !row.dispatchProviderIdempotencyKey ||
      !row.dispatchLeaseExpiresAt)
  ) {
    throw new ModelEgressStoreError(
      "stored_model_route_dispatch_claim_shape_invalid",
    );
  }
  return {
    decision,
    dispatch: row.dispatchClaimedAt
      ? {
          claimedAt: row.dispatchClaimedAt.toISOString(),
          gatewayRef: row.dispatchGatewayRef!,
          runtime: dispatchRuntime!,
          runtimeHash: row.dispatchRuntimeHash!,
          claimHash: row.dispatchClaimHash!,
          providerIdempotencyKey:
            row.dispatchProviderIdempotencyKey!,
          leaseExpiresAt:
            row.dispatchLeaseExpiresAt!.toISOString(),
        }
      : null,
    receipts: receipts.map(parseStoredModelEgressReceipt),
  };
}

export {
  GOVERNED_GATEWAY_AUTHORITY,
  ModelRoutePolicyStoreError,
};
