import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import type {
  DataAssetProcessingDisposition,
} from "@/lib/stage1-owner-loop/data-asset-catalog.types";
import type {
  ObservationSensitivity,
} from "@/lib/stage1-owner-loop/types";

export const MODEL_GOVERNANCE_PERSISTED_INT_MAX =
  2_147_483_647;

export const MODEL_ROUTE_TASK_CLASSES = [
  "embedding_index",
  "extraction_classification",
  "redaction_projection",
  "retrieval_rerank",
  "summary_briefing",
  "reasoning_counterfactual",
  "multi_pass_review",
  "voice_input_understanding",
] as const;

export type ModelRouteTaskClass = (typeof MODEL_ROUTE_TASK_CLASSES)[number];

export const MODEL_DEPLOYMENT_FORMS = [
  "local",
  "private_deployment",
  "domestic_cloud",
  "foreign_cloud",
] as const;

export type ModelDeploymentForm = (typeof MODEL_DEPLOYMENT_FORMS)[number];

export const MODEL_JURISDICTIONS = [
  "customer_premises",
  "domestic",
  "foreign",
] as const;

export type ModelJurisdiction = (typeof MODEL_JURISDICTIONS)[number];

export const MODEL_TRAINING_USE_POLICIES = [
  "prohibited",
  "provider_opt_out",
  "permitted",
] as const;

export type ModelTrainingUsePolicy =
  (typeof MODEL_TRAINING_USE_POLICIES)[number];

export const MODEL_TERMS_ASSURANCE_LEVELS = [
  "dedicated_no_retention",
  "contractual_no_retention",
  "standard",
] as const;

export type ModelTermsAssuranceLevel =
  (typeof MODEL_TERMS_ASSURANCE_LEVELS)[number];

export const MODEL_ROUTE_POLICY_STATUSES = [
  "draft",
  "active",
  "superseded",
  "revoked",
  "expired",
] as const;

export type ModelRoutePolicyStatus =
  (typeof MODEL_ROUTE_POLICY_STATUSES)[number];

export type GovernedModelAdapterRegistration = {
  schemaVersion:
    "helm.governed-model-adapter-registration/v1";
  registrationRef: string;
  adapterKey: string;
  adapterVersion: string;
  provider: string;
  implementationHash: string;
  supportedDeploymentForms: readonly ModelDeploymentForm[];
  authorityEffect: "adapter_registry_only";
  contentHash: string;
};

export type TenantModelRoute = {
  routeId: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  adapterKey: string;
  readinessReceiptRef: string;
  readinessReceiptHash: string;
  credentialRef: string;
  governanceProfileRef: string;
  governanceProfileHash: string;
  projectorRegistrationRef: string;
  projectorRegistrationHash: string;
  projectorVersion: string;
  scannerRegistrationRef: string;
  scannerRegistrationHash: string;
  scannerVersion: string;
  deploymentForm: ModelDeploymentForm;
  jurisdiction: ModelJurisdiction;
  region: string;
  allowedTaskClasses: readonly ModelRouteTaskClass[];
  maximumSensitivity: ObservationSensitivity;
  allowedProcessingDispositions: readonly DataAssetProcessingDisposition[];
  retentionDays: number;
  trainingUse: ModelTrainingUsePolicy;
  termsAssurance: ModelTermsAssuranceLevel;
  providerTermsRef: string;
  providerTermsHash: string;
  deletionTermsRef: string;
  deletionTermsHash: string;
  pricingTermsRef: string;
  pricingTermsHash: string;
  pricingVersion: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsdMicros: number;
  maxLatencyMs: number;
  maxConcurrency: number;
  fallbackRouteIds: readonly string[];
};

export type TenantModelRoutePolicy = {
  schemaVersion: "helm.tenant-model-route-policy/v1";
  policyId: string;
  workspaceRef: string;
  policyKey: string;
  revision: number;
  routes: readonly TenantModelRoute[];
  primaryRoutes: readonly {
    taskClass: ModelRouteTaskClass;
    routeRef: string;
  }[];
  validFrom: string;
  validUntil: string;
  approvalRef: string;
  approvedByRef: string;
  createdAt: string;
  policyHash: string;
  status: ModelRoutePolicyStatus;
  authorityEffect: "model_egress_only";
};

export type ProviderAdapterReadinessReceipt = {
  schemaVersion: "helm.provider-adapter-readiness-receipt/v1";
  receiptId: string;
  workspaceRef: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  adapterKey: string;
  adapterVersion: string;
  adapterRegistrationRef: string;
  adapterRegistrationHash: string;
  deploymentForm: ModelDeploymentForm;
  jurisdiction: ModelJurisdiction;
  region: string;
  endpointFingerprint: string;
  credentialRef: string;
  adapterRegistered: boolean;
  credentialConfigured: boolean;
  modelProbeStatus: "ready" | "not_ready";
  capabilityRefs: readonly string[];
  checkedAt: string;
  expiresAt: string;
  evidenceRefs: readonly string[];
  rawCredentialIncluded: false;
  contentHash: string;
};

export type ModelRoutePolicyApprovalReceipt = {
  schemaVersion:
    "helm.model-route-policy-approval-receipt/v1";
  receiptId: string;
  workspaceRef: string;
  policyRef: string;
  policyHash: string;
  policyKey: string;
  policyRevision: number;
  approvedByUserRef: string;
  expectedHeadVersion: number | null;
  approvedAt: string;
  authorityEffect: "model_route_policy_activation_only";
  contentHash: string;
};

export type EffectiveModelDataClassification = {
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  reasonCodes: readonly string[];
};

export type ModelDataClassificationInput = {
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  classificationStatus?: "pending" | "classified";
};

export type FallbackSafetyComparison = {
  safe: boolean;
  weakerDimensions: readonly string[];
  incomparableDimensions: readonly string[];
};

export type ContractValidationResult = {
  valid: boolean;
  errors: readonly string[];
};

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,190}$/;
const SAFE_REF_PATTERN =
  /^[a-z][a-z0-9_.-]*:[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,190}$/;
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const FORBIDDEN_VERSION_PATTERN = /(?:^|[-_.])(latest|unknown|\*)(?:$|[-_.])/i;

const SENSITIVITY_RANK: Record<ObservationSensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

const DISPOSITION_RANK: Record<DataAssetProcessingDisposition, number> = {
  remote_projected: 0,
  local_only: 1,
  prohibited: 2,
};

const DEPLOYMENT_RANK: Record<ModelDeploymentForm, number> = {
  local: 0,
  private_deployment: 1,
  domestic_cloud: 2,
  foreign_cloud: 3,
};

const JURISDICTION_RANK: Record<ModelJurisdiction, number> = {
  customer_premises: 0,
  domestic: 1,
  foreign: 2,
};

const TRAINING_USE_RANK: Record<ModelTrainingUsePolicy, number> = {
  prohibited: 0,
  provider_opt_out: 1,
  permitted: 2,
};

const TERMS_ASSURANCE_RANK: Record<ModelTermsAssuranceLevel, number> = {
  dedicated_no_retention: 0,
  contractual_no_retention: 1,
  standard: 2,
};

const TASK_CLASSES = new Set<ModelRouteTaskClass>(
  MODEL_ROUTE_TASK_CLASSES,
);
const DEPLOYMENT_FORMS = new Set<ModelDeploymentForm>(
  MODEL_DEPLOYMENT_FORMS,
);
const JURISDICTIONS = new Set<ModelJurisdiction>(
  MODEL_JURISDICTIONS,
);
const TRAINING_POLICIES = new Set<ModelTrainingUsePolicy>(
  MODEL_TRAINING_USE_POLICIES,
);
const TERMS_ASSURANCE_LEVELS = new Set<ModelTermsAssuranceLevel>(
  MODEL_TERMS_ASSURANCE_LEVELS,
);
const POLICY_STATUSES = new Set<ModelRoutePolicyStatus>(
  MODEL_ROUTE_POLICY_STATUSES,
);
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

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function validInstant(value: string): boolean {
  return INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function validPositiveInt(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MODEL_GOVERNANCE_PERSISTED_INT_MAX
  );
}

function validNonNegativeInt(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MODEL_GOVERNANCE_PERSISTED_INT_MAX
  );
}

function isSubset<T extends string>(
  candidate: readonly T[],
  baseline: readonly T[],
): boolean {
  const baselineSet = new Set(baseline);
  return candidate.every((value) => baselineSet.has(value));
}

function policyHashContent(policy: TenantModelRoutePolicy) {
  return {
    schemaVersion: policy.schemaVersion,
    policyId: policy.policyId,
    workspaceRef: policy.workspaceRef,
    policyKey: policy.policyKey,
    revision: policy.revision,
    routes: [...policy.routes]
      .map((route) => ({
        ...route,
        allowedTaskClasses: uniqueSorted(route.allowedTaskClasses),
        allowedProcessingDispositions: uniqueSorted(
          route.allowedProcessingDispositions,
        ),
        fallbackRouteIds: [...route.fallbackRouteIds],
      }))
      .sort((left, right) => left.routeId.localeCompare(right.routeId)),
    primaryRoutes: [...policy.primaryRoutes].sort((left, right) =>
      left.taskClass.localeCompare(right.taskClass),
    ),
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
    approvalRef: policy.approvalRef,
    approvedByRef: policy.approvedByRef,
    createdAt: policy.createdAt,
    authorityEffect: policy.authorityEffect,
  };
}

function adapterRegistrationHashContent(
  registration: GovernedModelAdapterRegistration,
) {
  return {
    schemaVersion: registration.schemaVersion,
    registrationRef: registration.registrationRef,
    adapterKey: registration.adapterKey,
    adapterVersion: registration.adapterVersion,
    provider: registration.provider,
    implementationHash: registration.implementationHash,
    supportedDeploymentForms: uniqueSorted(
      registration.supportedDeploymentForms,
    ),
    authorityEffect: registration.authorityEffect,
  };
}

function readinessHashContent(receipt: ProviderAdapterReadinessReceipt) {
  return {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    workspaceRef: receipt.workspaceRef,
    provider: receipt.provider,
    modelId: receipt.modelId,
    modelVersion: receipt.modelVersion,
    adapterKey: receipt.adapterKey,
    adapterVersion: receipt.adapterVersion,
    adapterRegistrationRef:
      receipt.adapterRegistrationRef,
    adapterRegistrationHash:
      receipt.adapterRegistrationHash,
    deploymentForm: receipt.deploymentForm,
    jurisdiction: receipt.jurisdiction,
    region: receipt.region,
    endpointFingerprint: receipt.endpointFingerprint,
    credentialRef: receipt.credentialRef,
    adapterRegistered: receipt.adapterRegistered,
    credentialConfigured: receipt.credentialConfigured,
    modelProbeStatus: receipt.modelProbeStatus,
    capabilityRefs: uniqueSorted(receipt.capabilityRefs),
    checkedAt: receipt.checkedAt,
    expiresAt: receipt.expiresAt,
    evidenceRefs: uniqueSorted(receipt.evidenceRefs),
    rawCredentialIncluded: receipt.rawCredentialIncluded,
  };
}

function policyApprovalReceiptHashContent(
  receipt: ModelRoutePolicyApprovalReceipt,
) {
  return {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    workspaceRef: receipt.workspaceRef,
    policyRef: receipt.policyRef,
    policyHash: receipt.policyHash,
    policyKey: receipt.policyKey,
    policyRevision: receipt.policyRevision,
    approvedByUserRef: receipt.approvedByUserRef,
    expectedHeadVersion: receipt.expectedHeadVersion,
    approvedAt: receipt.approvedAt,
    authorityEffect: receipt.authorityEffect,
  };
}

export function computeGovernedModelAdapterRegistrationHash(
  registration: GovernedModelAdapterRegistration,
): string {
  return sha256(
    canonicalJson(
      adapterRegistrationHashContent(registration),
    ),
  );
}

export function computeTenantModelRoutePolicyHash(
  policy: TenantModelRoutePolicy,
): string {
  return sha256(canonicalJson(policyHashContent(policy)));
}

export function computeProviderAdapterReadinessHash(
  receipt: ProviderAdapterReadinessReceipt,
): string {
  return sha256(canonicalJson(readinessHashContent(receipt)));
}

export function computeModelRoutePolicyApprovalReceiptRef(input: {
  workspaceRef: string;
  policyId: string;
  policyKey: string;
  revision: number;
  approvedByRef: string;
}): string {
  const digest = sha256(canonicalJson(input)).slice(
    "sha256:".length,
  );
  return `approval:model-route-policy:${digest}`;
}

export function computeModelRoutePolicyApprovalReceiptHash(
  receipt: ModelRoutePolicyApprovalReceipt,
): string {
  return sha256(
    canonicalJson(policyApprovalReceiptHashContent(receipt)),
  );
}

export function compareFallbackRouteSafety(
  baseline: TenantModelRoute,
  candidate: TenantModelRoute,
): FallbackSafetyComparison {
  const weakerDimensions: string[] = [];
  const incomparableDimensions: string[] = [];

  if (
    !isSubset(candidate.allowedTaskClasses, baseline.allowedTaskClasses)
  ) {
    weakerDimensions.push("workflow");
  }
  if (
    SENSITIVITY_RANK[candidate.maximumSensitivity] >
    SENSITIVITY_RANK[baseline.maximumSensitivity]
  ) {
    weakerDimensions.push("sensitivity");
  }
  if (
    !isSubset(
      candidate.allowedProcessingDispositions,
      baseline.allowedProcessingDispositions,
    )
  ) {
    weakerDimensions.push("processing_disposition");
  }
  if (
    DEPLOYMENT_RANK[candidate.deploymentForm] >
    DEPLOYMENT_RANK[baseline.deploymentForm]
  ) {
    weakerDimensions.push("deployment_form");
  }

  const baselineJurisdiction = JURISDICTION_RANK[baseline.jurisdiction];
  const candidateJurisdiction = JURISDICTION_RANK[candidate.jurisdiction];
  if (candidateJurisdiction > baselineJurisdiction) {
    weakerDimensions.push("jurisdiction");
  } else if (
    candidateJurisdiction === baselineJurisdiction &&
    candidate.region !== baseline.region
  ) {
    incomparableDimensions.push("region");
  }

  if (candidate.retentionDays > baseline.retentionDays) {
    weakerDimensions.push("retention");
  }
  if (
    TRAINING_USE_RANK[candidate.trainingUse] >
    TRAINING_USE_RANK[baseline.trainingUse]
  ) {
    weakerDimensions.push("training_use");
  }
  if (
    TERMS_ASSURANCE_RANK[candidate.termsAssurance] >
    TERMS_ASSURANCE_RANK[baseline.termsAssurance]
  ) {
    weakerDimensions.push("provider_terms");
  }
  if (
    candidate.providerTermsRef !== baseline.providerTermsRef ||
    candidate.providerTermsHash !== baseline.providerTermsHash ||
    candidate.deletionTermsRef !== baseline.deletionTermsRef ||
    candidate.deletionTermsHash !== baseline.deletionTermsHash
  ) {
    incomparableDimensions.push("provider_terms_contract");
  }
  if (
    candidate.pricingTermsRef !== baseline.pricingTermsRef ||
    candidate.pricingTermsHash !== baseline.pricingTermsHash ||
    candidate.pricingVersion !== baseline.pricingVersion
  ) {
    incomparableDimensions.push("pricing_terms_contract");
  }
  if (
    candidate.governanceProfileRef !== baseline.governanceProfileRef ||
    candidate.governanceProfileHash !== baseline.governanceProfileHash
  ) {
    incomparableDimensions.push("governance_profile");
  }
  if (
    candidate.projectorRegistrationRef !==
      baseline.projectorRegistrationRef ||
    candidate.projectorRegistrationHash !==
      baseline.projectorRegistrationHash ||
    candidate.projectorVersion !== baseline.projectorVersion ||
    candidate.scannerRegistrationRef !==
      baseline.scannerRegistrationRef ||
    candidate.scannerRegistrationHash !==
      baseline.scannerRegistrationHash ||
    candidate.scannerVersion !== baseline.scannerVersion
  ) {
    incomparableDimensions.push("projection_trust_root");
  }
  if (candidate.maxInputTokens > baseline.maxInputTokens) {
    weakerDimensions.push("input_tokens");
  }
  if (candidate.maxOutputTokens > baseline.maxOutputTokens) {
    weakerDimensions.push("output_tokens");
  }
  if (candidate.maxCostUsdMicros > baseline.maxCostUsdMicros) {
    weakerDimensions.push("cost");
  }
  if (candidate.maxLatencyMs > baseline.maxLatencyMs) {
    weakerDimensions.push("latency");
  }
  if (candidate.maxConcurrency > baseline.maxConcurrency) {
    weakerDimensions.push("concurrency");
  }

  return {
    safe:
      weakerDimensions.length === 0 && incomparableDimensions.length === 0,
    weakerDimensions,
    incomparableDimensions,
  };
}

function safeRef(value: string): boolean {
  return SAFE_REF_PATTERN.test(value);
}

function safeToken(value: string): boolean {
  return SAFE_TOKEN_PATTERN.test(value);
}

export function isSafeModelGovernanceRef(value: string): boolean {
  return safeRef(value);
}

export function isSafeModelGovernanceIdentifier(value: string): boolean {
  return safeToken(value) || safeRef(value);
}

function validateSafeRefs(
  values: readonly string[],
  errorPrefix: string,
): string[] {
  return values
    .filter((value) => !safeRef(value))
    .map(() => `${errorPrefix}_invalid`);
}

export function validateTenantModelRoute(
  route: TenantModelRoute,
): ContractValidationResult {
  const errors: string[] = [];
  if (!safeToken(route.routeId)) errors.push("route_id_invalid");
  if (!safeToken(route.provider)) errors.push("provider_invalid");
  if (!safeToken(route.modelId)) errors.push("model_id_invalid");
  if (
    !nonEmpty(route.modelVersion) ||
    !safeToken(route.modelVersion) ||
    FORBIDDEN_VERSION_PATTERN.test(route.modelVersion)
  ) {
    errors.push(`route:${route.routeId}:exact_model_version_required`);
  }
  if (!safeToken(route.adapterKey)) errors.push("adapter_key_invalid");
  if (!safeRef(route.readinessReceiptRef)) {
    errors.push(`route:${route.routeId}:readiness_receipt_ref_required`);
  }
  if (!HASH_PATTERN.test(route.readinessReceiptHash)) {
    errors.push(`route:${route.routeId}:readiness_receipt_hash_invalid`);
  }
  if (
    !route.credentialRef.startsWith("secret:") ||
    !safeRef(route.credentialRef)
  ) {
    errors.push(`route:${route.routeId}:credential_ref_must_be_secret_ref`);
  }
  if (!safeRef(route.governanceProfileRef)) {
    errors.push(`route:${route.routeId}:governance_profile_ref_invalid`);
  }
  if (!HASH_PATTERN.test(route.governanceProfileHash)) {
    errors.push(`route:${route.routeId}:governance_profile_hash_invalid`);
  }
  if (!safeRef(route.projectorRegistrationRef)) {
    errors.push(
      `route:${route.routeId}:projector_registration_ref_invalid`,
    );
  }
  if (!HASH_PATTERN.test(route.projectorRegistrationHash)) {
    errors.push(
      `route:${route.routeId}:projector_registration_hash_invalid`,
    );
  }
  if (
    !safeToken(route.projectorVersion) ||
    FORBIDDEN_VERSION_PATTERN.test(route.projectorVersion)
  ) {
    errors.push(
      `route:${route.routeId}:exact_projector_version_required`,
    );
  }
  if (!safeRef(route.scannerRegistrationRef)) {
    errors.push(
      `route:${route.routeId}:scanner_registration_ref_invalid`,
    );
  }
  if (!HASH_PATTERN.test(route.scannerRegistrationHash)) {
    errors.push(
      `route:${route.routeId}:scanner_registration_hash_invalid`,
    );
  }
  if (
    !safeToken(route.scannerVersion) ||
    FORBIDDEN_VERSION_PATTERN.test(route.scannerVersion)
  ) {
    errors.push(
      `route:${route.routeId}:exact_scanner_version_required`,
    );
  }
  if (!DEPLOYMENT_FORMS.has(route.deploymentForm)) {
    errors.push(`route:${route.routeId}:deployment_form_invalid`);
  }
  if (!JURISDICTIONS.has(route.jurisdiction)) {
    errors.push(`route:${route.routeId}:jurisdiction_invalid`);
  }
  if (!safeToken(route.region) || route.region === "unknown") {
    errors.push(`route:${route.routeId}:known_region_required`);
  }
  if (
    route.allowedTaskClasses.length === 0 ||
    route.allowedTaskClasses.some((item) => !TASK_CLASSES.has(item))
  ) {
    errors.push(`route:${route.routeId}:task_class_required`);
  }
  if (
    route.allowedProcessingDispositions.length === 0 ||
    route.allowedProcessingDispositions.includes("prohibited") ||
    route.allowedProcessingDispositions.some(
      (item) => !PROCESSING_DISPOSITIONS.has(item),
    )
  ) {
    errors.push(`route:${route.routeId}:invalid_processing_disposition`);
  }
  if (!SENSITIVITIES.has(route.maximumSensitivity)) {
    errors.push(`route:${route.routeId}:maximum_sensitivity_invalid`);
  }
  if (
    route.deploymentForm !== "local" &&
    route.allowedProcessingDispositions.includes("local_only")
  ) {
    errors.push(`route:${route.routeId}:local_only_requires_local_deployment`);
  }
  if (
    route.deploymentForm === "foreign_cloud" &&
    route.jurisdiction !== "foreign"
  ) {
    errors.push(`route:${route.routeId}:foreign_cloud_jurisdiction_mismatch`);
  }
  if (
    (route.deploymentForm === "local" ||
      route.deploymentForm === "private_deployment") &&
    route.jurisdiction !== "customer_premises"
  ) {
    errors.push(`route:${route.routeId}:customer_deployment_jurisdiction_mismatch`);
  }
  if (!validNonNegativeInt(route.retentionDays)) {
    errors.push(`route:${route.routeId}:retention_days_invalid`);
  }
  if (!TRAINING_POLICIES.has(route.trainingUse)) {
    errors.push(`route:${route.routeId}:training_use_invalid`);
  }
  if (!TERMS_ASSURANCE_LEVELS.has(route.termsAssurance)) {
    errors.push(`route:${route.routeId}:terms_assurance_invalid`);
  }
  if (!safeRef(route.providerTermsRef)) {
    errors.push(`route:${route.routeId}:provider_terms_ref_required`);
  }
  if (!HASH_PATTERN.test(route.providerTermsHash)) {
    errors.push(`route:${route.routeId}:provider_terms_hash_invalid`);
  }
  if (!safeRef(route.deletionTermsRef)) {
    errors.push(`route:${route.routeId}:deletion_terms_ref_required`);
  }
  if (!HASH_PATTERN.test(route.deletionTermsHash)) {
    errors.push(
      `route:${route.routeId}:deletion_terms_hash_invalid`,
    );
  }
  if (!safeRef(route.pricingTermsRef)) {
    errors.push(`route:${route.routeId}:pricing_terms_ref_required`);
  }
  if (!HASH_PATTERN.test(route.pricingTermsHash)) {
    errors.push(
      `route:${route.routeId}:pricing_terms_hash_invalid`,
    );
  }
  if (
    !safeToken(route.pricingVersion) ||
    FORBIDDEN_VERSION_PATTERN.test(route.pricingVersion)
  ) {
    errors.push(
      `route:${route.routeId}:exact_pricing_version_required`,
    );
  }
  if (!validPositiveInt(route.maxInputTokens)) {
    errors.push(`route:${route.routeId}:max_input_tokens_invalid`);
  }
  if (!validPositiveInt(route.maxOutputTokens)) {
    errors.push(`route:${route.routeId}:max_output_tokens_invalid`);
  }
  if (!validNonNegativeInt(route.maxCostUsdMicros)) {
    errors.push(`route:${route.routeId}:max_cost_invalid`);
  }
  if (!validPositiveInt(route.maxLatencyMs)) {
    errors.push(`route:${route.routeId}:max_latency_invalid`);
  }
  if (!validPositiveInt(route.maxConcurrency)) {
    errors.push(`route:${route.routeId}:max_concurrency_invalid`);
  }
  if (
    new Set(route.allowedTaskClasses).size !==
    route.allowedTaskClasses.length
  ) {
    errors.push(`route:${route.routeId}:duplicate_task_class`);
  }
  if (
    new Set(route.allowedProcessingDispositions).size !==
    route.allowedProcessingDispositions.length
  ) {
    errors.push(`route:${route.routeId}:duplicate_processing_disposition`);
  }
  if (new Set(route.fallbackRouteIds).size !== route.fallbackRouteIds.length) {
    errors.push(`route:${route.routeId}:duplicate_fallback_route`);
  }
  if (route.fallbackRouteIds.some((value) => !safeToken(value))) {
    errors.push(`route:${route.routeId}:fallback_route_ref_invalid`);
  }
  return { valid: errors.length === 0, errors };
}

function detectFallbackCycles(
  routeMap: ReadonlyMap<string, TenantModelRoute>,
): string[] {
  const errors: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(routeId: string): void {
    if (visiting.has(routeId)) {
      errors.push(`fallback_cycle:${routeId}`);
      return;
    }
    if (visited.has(routeId)) return;
    visiting.add(routeId);
    const route = routeMap.get(routeId);
    route?.fallbackRouteIds.forEach(visit);
    visiting.delete(routeId);
    visited.add(routeId);
  }

  routeMap.forEach((_, routeId) => visit(routeId));
  return errors;
}

export function validateTenantModelRoutePolicy(
  policy: TenantModelRoutePolicy,
): ContractValidationResult {
  const errors: string[] = [];
  if (policy.schemaVersion !== "helm.tenant-model-route-policy/v1") {
    errors.push("unsupported_policy_schema_version");
  }
  if (!nonEmpty(policy.policyId)) errors.push("policy_id_required");
  if (!policy.workspaceRef.startsWith("workspace:")) {
    errors.push("workspace_ref_invalid");
  }
  if (!safeToken(policy.policyKey)) errors.push("policy_key_invalid");
  if (!validPositiveInt(policy.revision)) errors.push("revision_invalid");
  if (policy.routes.length === 0) errors.push("routes_required");
  if (!validInstant(policy.validFrom) || !validInstant(policy.validUntil)) {
    errors.push("policy_validity_window_invalid");
  } else if (Date.parse(policy.validUntil) <= Date.parse(policy.validFrom)) {
    errors.push("policy_valid_until_must_follow_valid_from");
  }
  if (!nonEmpty(policy.approvalRef)) errors.push("approval_ref_required");
  if (!nonEmpty(policy.approvedByRef)) errors.push("approved_by_ref_required");
  if (!policy.approvedByRef.startsWith("user:")) {
    errors.push("approved_by_ref_must_be_user_ref");
  }
  if (!validInstant(policy.createdAt)) errors.push("created_at_invalid");
  if (policy.authorityEffect !== "model_egress_only") {
    errors.push("authority_effect_must_be_model_egress_only");
  }
  if (!POLICY_STATUSES.has(policy.status)) {
    errors.push("policy_status_invalid");
  }
  for (const [field, value] of [
    ["policy_id", policy.policyId],
    ["approval_ref", policy.approvalRef],
    ["approved_by_ref", policy.approvedByRef],
  ] as const) {
    if (!safeRef(value)) errors.push(`${field}_invalid`);
  }
  if (
    safeRef(policy.approvalRef) &&
    safeRef(policy.approvedByRef) &&
    policy.approvalRef !==
      computeModelRoutePolicyApprovalReceiptRef({
        workspaceRef: policy.workspaceRef,
        policyId: policy.policyId,
        policyKey: policy.policyKey,
        revision: policy.revision,
        approvedByRef: policy.approvedByRef,
      })
  ) {
    errors.push("approval_ref_not_policy_bound");
  }

  const routeIds = policy.routes.map((route) => route.routeId);
  if (new Set(routeIds).size !== routeIds.length) {
    errors.push("duplicate_route_id");
  }
  policy.routes.forEach((route) =>
    errors.push(...validateTenantModelRoute(route).errors),
  );
  const routeMap = new Map(
    policy.routes.map((route) => [route.routeId, route] as const),
  );

  const primaryTaskClasses = policy.primaryRoutes.map(
    (primary) => primary.taskClass,
  );
  if (new Set(primaryTaskClasses).size !== primaryTaskClasses.length) {
    errors.push("duplicate_primary_task_class");
  }
  for (const primary of policy.primaryRoutes) {
    const route = routeMap.get(primary.routeRef);
    if (!route) {
      errors.push(`primary_route_missing:${primary.routeRef}`);
    } else if (!route.allowedTaskClasses.includes(primary.taskClass)) {
      errors.push(
        `primary_route_task_mismatch:${primary.taskClass}:${primary.routeRef}`,
      );
    }
  }

  for (const route of policy.routes) {
    for (const fallbackRef of route.fallbackRouteIds) {
      const fallback = routeMap.get(fallbackRef);
      if (!fallback) {
        errors.push(`fallback_route_missing:${route.routeId}:${fallbackRef}`);
        continue;
      }
      if (fallbackRef === route.routeId) {
        errors.push(`fallback_route_self_reference:${route.routeId}`);
        continue;
      }
      const comparison = compareFallbackRouteSafety(route, fallback);
      comparison.weakerDimensions.forEach((dimension) =>
        errors.push(
          `fallback_weaker:${route.routeId}:${fallbackRef}:${dimension}`,
        ),
      );
      comparison.incomparableDimensions.forEach((dimension) =>
        errors.push(
          `fallback_incomparable:${route.routeId}:${fallbackRef}:${dimension}`,
        ),
      );
    }
  }
  errors.push(...detectFallbackCycles(routeMap));

  if (!HASH_PATTERN.test(policy.policyHash)) {
    errors.push("policy_hash_invalid");
  } else if (computeTenantModelRoutePolicyHash(policy) !== policy.policyHash) {
    errors.push("policy_hash_mismatch");
  }

  return { valid: errors.length === 0, errors };
}

export function validateProviderAdapterReadinessReceipt(
  receipt: ProviderAdapterReadinessReceipt,
): ContractValidationResult {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
    "helm.provider-adapter-readiness-receipt/v1"
  ) {
    errors.push("unsupported_readiness_schema_version");
  }
  if (!nonEmpty(receipt.receiptId)) errors.push("receipt_id_required");
  if (!receipt.workspaceRef.startsWith("workspace:")) {
    errors.push("workspace_ref_invalid");
  }
  for (const [field, value] of [
    ["provider", receipt.provider],
    ["model_id", receipt.modelId],
    ["adapter_key", receipt.adapterKey],
    ["adapter_version", receipt.adapterVersion],
    ["region", receipt.region],
  ] as const) {
    if (!safeToken(value)) errors.push(`${field}_invalid`);
  }
  if (
    !nonEmpty(receipt.modelVersion) ||
    !safeToken(receipt.modelVersion) ||
    FORBIDDEN_VERSION_PATTERN.test(receipt.modelVersion)
  ) {
    errors.push("exact_model_version_required");
  }
  if (!HASH_PATTERN.test(receipt.endpointFingerprint)) {
    errors.push("endpoint_fingerprint_invalid");
  }
  if (
    !receipt.credentialRef.startsWith("secret:") ||
    !safeRef(receipt.credentialRef)
  ) {
    errors.push("credential_ref_must_be_secret_ref");
  }
  if (!safeRef(receipt.receiptId)) errors.push("receipt_id_invalid");
  if (!safeRef(receipt.adapterRegistrationRef)) {
    errors.push("adapter_registration_ref_invalid");
  }
  if (!HASH_PATTERN.test(receipt.adapterRegistrationHash)) {
    errors.push("adapter_registration_hash_invalid");
  }
  if (!DEPLOYMENT_FORMS.has(receipt.deploymentForm)) {
    errors.push("deployment_form_invalid");
  }
  if (!JURISDICTIONS.has(receipt.jurisdiction)) {
    errors.push("jurisdiction_invalid");
  }
  if (
    receipt.modelProbeStatus !== "ready" &&
    receipt.modelProbeStatus !== "not_ready"
  ) {
    errors.push("model_probe_status_invalid");
  }
  if (
    receipt.deploymentForm === "foreign_cloud" &&
    receipt.jurisdiction !== "foreign"
  ) {
    errors.push("foreign_cloud_jurisdiction_mismatch");
  }
  if (
    (receipt.deploymentForm === "local" ||
      receipt.deploymentForm === "private_deployment") &&
    receipt.jurisdiction !== "customer_premises"
  ) {
    errors.push("customer_deployment_jurisdiction_mismatch");
  }
  if (!validInstant(receipt.checkedAt) || !validInstant(receipt.expiresAt)) {
    errors.push("readiness_validity_window_invalid");
  } else if (Date.parse(receipt.expiresAt) <= Date.parse(receipt.checkedAt)) {
    errors.push("readiness_expiry_must_follow_check");
  }
  if (receipt.evidenceRefs.length === 0) {
    errors.push("readiness_evidence_required");
  }
  errors.push(
    ...validateSafeRefs(
      receipt.capabilityRefs,
      "readiness_capability_ref",
    ),
    ...validateSafeRefs(
      receipt.evidenceRefs,
      "readiness_evidence_ref",
    ),
  );
  if (receipt.rawCredentialIncluded !== false) {
    errors.push("raw_credential_must_be_excluded");
  }
  if (!HASH_PATTERN.test(receipt.contentHash)) {
    errors.push("readiness_hash_invalid");
  } else if (
    computeProviderAdapterReadinessHash(receipt) !== receipt.contentHash
  ) {
    errors.push("readiness_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function validateGovernedModelAdapterRegistration(
  registration: GovernedModelAdapterRegistration,
): ContractValidationResult {
  const errors: string[] = [];
  if (
    registration.schemaVersion !==
    "helm.governed-model-adapter-registration/v1"
  ) {
    errors.push(
      "unsupported_adapter_registration_schema_version",
    );
  }
  if (!safeRef(registration.registrationRef)) {
    errors.push("adapter_registration_ref_invalid");
  }
  for (const [field, value] of [
    ["adapter_key", registration.adapterKey],
    ["adapter_version", registration.adapterVersion],
    ["provider", registration.provider],
  ] as const) {
    if (!safeToken(value)) errors.push(`${field}_invalid`);
  }
  if (
    !HASH_PATTERN.test(registration.implementationHash)
  ) {
    errors.push("adapter_implementation_hash_invalid");
  }
  if (
    registration.supportedDeploymentForms.length === 0 ||
    registration.supportedDeploymentForms.some(
      (value) => !DEPLOYMENT_FORMS.has(value),
    )
  ) {
    errors.push("adapter_deployment_form_invalid");
  }
  if (
    new Set(registration.supportedDeploymentForms).size !==
    registration.supportedDeploymentForms.length
  ) {
    errors.push("duplicate_adapter_deployment_form");
  }
  if (registration.authorityEffect !== "adapter_registry_only") {
    errors.push(
      "adapter_registration_authority_effect_invalid",
    );
  }
  if (!HASH_PATTERN.test(registration.contentHash)) {
    errors.push("adapter_registration_hash_invalid");
  } else if (
    computeGovernedModelAdapterRegistrationHash(registration) !==
    registration.contentHash
  ) {
    errors.push("adapter_registration_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function validateModelRoutePolicyApprovalReceipt(
  receipt: ModelRoutePolicyApprovalReceipt,
): ContractValidationResult {
  const errors: string[] = [];
  if (
    receipt.schemaVersion !==
    "helm.model-route-policy-approval-receipt/v1"
  ) {
    errors.push(
      "unsupported_policy_approval_receipt_schema_version",
    );
  }
  if (!safeRef(receipt.receiptId)) {
    errors.push("policy_approval_receipt_id_invalid");
  }
  if (!safeRef(receipt.workspaceRef)) {
    errors.push("policy_approval_workspace_ref_invalid");
  }
  if (!safeRef(receipt.policyRef)) {
    errors.push("policy_approval_policy_ref_invalid");
  }
  if (!HASH_PATTERN.test(receipt.policyHash)) {
    errors.push("policy_approval_policy_hash_invalid");
  }
  if (!safeToken(receipt.policyKey)) {
    errors.push("policy_approval_policy_key_invalid");
  }
  if (!validPositiveInt(receipt.policyRevision)) {
    errors.push("policy_approval_revision_invalid");
  }
  if (
    !receipt.approvedByUserRef.startsWith("user:") ||
    !safeRef(receipt.approvedByUserRef)
  ) {
    errors.push("policy_approval_owner_ref_invalid");
  }
  if (
    receipt.expectedHeadVersion !== null &&
    !validNonNegativeInt(receipt.expectedHeadVersion)
  ) {
    errors.push("policy_approval_head_version_invalid");
  }
  if (!validInstant(receipt.approvedAt)) {
    errors.push("policy_approval_time_invalid");
  }
  if (
    receipt.authorityEffect !==
    "model_route_policy_activation_only"
  ) {
    errors.push("policy_approval_authority_effect_invalid");
  }
  const expectedRef =
    computeModelRoutePolicyApprovalReceiptRef({
      workspaceRef: receipt.workspaceRef,
      policyId: receipt.policyRef,
      policyKey: receipt.policyKey,
      revision: receipt.policyRevision,
      approvedByRef: receipt.approvedByUserRef,
    });
  if (receipt.receiptId !== expectedRef) {
    errors.push("policy_approval_receipt_ref_mismatch");
  }
  if (!HASH_PATTERN.test(receipt.contentHash)) {
    errors.push("policy_approval_receipt_hash_invalid");
  } else if (
    computeModelRoutePolicyApprovalReceiptHash(receipt) !==
    receipt.contentHash
  ) {
    errors.push("policy_approval_receipt_hash_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

export function readinessReceiptMatchesRoute(input: {
  receipt: ProviderAdapterReadinessReceipt;
  route: TenantModelRoute;
  now: Date;
}): ContractValidationResult {
  const errors = [
    ...validateProviderAdapterReadinessReceipt(input.receipt).errors,
  ];
  const { receipt, route } = input;
  if (receipt.receiptId !== route.readinessReceiptRef) {
    errors.push("readiness_receipt_ref_mismatch");
  }
  if (receipt.contentHash !== route.readinessReceiptHash) {
    errors.push("readiness_receipt_hash_mismatch");
  }
  for (const [field, readinessValue, routeValue] of [
    ["provider", receipt.provider, route.provider],
    ["model_id", receipt.modelId, route.modelId],
    ["model_version", receipt.modelVersion, route.modelVersion],
    ["adapter_key", receipt.adapterKey, route.adapterKey],
    ["credential_ref", receipt.credentialRef, route.credentialRef],
    ["deployment_form", receipt.deploymentForm, route.deploymentForm],
    ["jurisdiction", receipt.jurisdiction, route.jurisdiction],
    ["region", receipt.region, route.region],
  ] as const) {
    if (readinessValue !== routeValue) {
      errors.push(`readiness_${field}_mismatch`);
    }
  }
  if (!receipt.adapterRegistered) errors.push("adapter_not_registered");
  if (!receipt.credentialConfigured) {
    errors.push("provider_credential_not_configured");
  }
  if (receipt.modelProbeStatus !== "ready") errors.push("model_not_ready");
  if (Date.parse(receipt.expiresAt) <= input.now.getTime()) {
    errors.push("readiness_expired");
  }
  if (Date.parse(receipt.checkedAt) > input.now.getTime()) {
    errors.push("readiness_not_yet_checked");
  }
  return { valid: errors.length === 0, errors };
}

export function deriveEffectiveModelDataClassification(
  inputs: readonly ModelDataClassificationInput[],
): EffectiveModelDataClassification {
  if (inputs.length === 0) {
    return {
      sensitivity: "restricted",
      processingDisposition: "local_only",
      reasonCodes: ["classification_missing_defaulted_restricted_local_only"],
    };
  }

  if (inputs.some((item) => item.classificationStatus !== "classified")) {
    return {
      sensitivity: "restricted",
      processingDisposition: "local_only",
      reasonCodes: ["classification_pending_defaulted_restricted_local_only"],
    };
  }

  const sensitivity = inputs.reduce<ObservationSensitivity>(
    (strictest, item) =>
      SENSITIVITY_RANK[item.sensitivity] > SENSITIVITY_RANK[strictest]
        ? item.sensitivity
        : strictest,
    "public",
  );
  const processingDisposition =
    inputs.reduce<DataAssetProcessingDisposition>(
      (strictest, item) =>
        DISPOSITION_RANK[item.processingDisposition] >
        DISPOSITION_RANK[strictest]
          ? item.processingDisposition
          : strictest,
      "remote_projected",
    );

  return {
    sensitivity,
    processingDisposition,
    reasonCodes: [],
  };
}

export function routeAllowsClassification(input: {
  route: TenantModelRoute;
  taskClass: ModelRouteTaskClass;
  classification: EffectiveModelDataClassification;
}): ContractValidationResult {
  const errors: string[] = [];
  if (!input.route.allowedTaskClasses.includes(input.taskClass)) {
    errors.push("task_class_not_allowed");
  }
  if (
    SENSITIVITY_RANK[input.classification.sensitivity] >
    SENSITIVITY_RANK[input.route.maximumSensitivity]
  ) {
    errors.push("sensitivity_not_allowed");
  }
  if (
    !input.route.allowedProcessingDispositions.includes(
      input.classification.processingDisposition,
    )
  ) {
    errors.push("processing_disposition_not_allowed");
  }
  if (input.classification.processingDisposition === "prohibited") {
    errors.push("processing_prohibited");
  }
  if (
    input.classification.processingDisposition === "local_only" &&
    input.route.deploymentForm !== "local"
  ) {
    errors.push("local_only_remote_egress_forbidden");
  }
  return { valid: errors.length === 0, errors };
}

export function computeProjectedPromptHash(input: {
  systemPrompt: string;
  userPrompt: string;
}): string {
  return sha256(
    canonicalJson({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    }),
  );
}
