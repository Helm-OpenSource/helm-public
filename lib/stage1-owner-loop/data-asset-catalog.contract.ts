import {
  OBSERVATION_ACCESS_MODES,
  OBSERVATION_SENSITIVITY_LEVELS,
} from "./types";
import {
  DATA_ASSET_AUTHORIZATION_STATUSES,
  DATA_ASSET_CLASSIFICATION_STATUSES,
  DATA_ASSET_CONNECTION_STATUSES,
  DATA_ASSET_INITIALIZATION_STATUSES,
  DATA_ASSET_INVENTORY_STATUSES,
  DATA_ASSET_PROCESSING_DISPOSITIONS,
  DATA_ASSET_SHAPES,
  OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS,
  type DataAssetAuthorizationReceipt,
  type DataAssetCatalogEntry,
  type DataAssetClassificationReceipt,
  type DataAssetConnectionReceipt,
  type DataAssetInitializationReceipt,
  type DataAssetStageReceipt,
  type DataAssetStageReceiptBase,
  type ObservationSourceCompatibilityReceipt,
} from "./data-asset-catalog.types";

export type DataAssetContractValidation = {
  valid: boolean;
  errors: string[];
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function nonEmptyValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isNonEmpty).map((value) => value.trim());
}

export function isManagedSecretReference(value: string | null): boolean {
  return Boolean(
    value &&
      /^(?:secret-ref|secret-manager):[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(
        value,
      ),
  );
}

function validateReceiptBase(receipt: DataAssetStageReceiptBase): string[] {
  const errors: string[] = [];
  if (!isNonEmpty(receipt.receiptId)) errors.push("receipt_id_required");
  if (!isNonEmpty(receipt.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(receipt.assetRef)) errors.push("asset_ref_required");
  if (!isNonEmpty(receipt.idempotencyKey)) errors.push("idempotency_key_required");
  if (!isNonEmpty(receipt.actorRef)) errors.push("actor_ref_required");
  if (!isFiniteDate(receipt.recordedAt)) errors.push("recorded_at_invalid");
  if (
    !Number.isInteger(receipt.expectedVersion) ||
    receipt.expectedVersion < 1 ||
    receipt.resultingVersion !== receipt.expectedVersion + 1
  ) {
    errors.push("receipt_version_transition_invalid");
  }
  return errors;
}

function result(errors: string[]): DataAssetContractValidation {
  const uniqueErrors = [...new Set(errors)];
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors };
}

export function validateDataAssetCatalogEntry(
  entry: DataAssetCatalogEntry,
): DataAssetContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(entry.assetId)) errors.push("asset_id_required");
  if (!isNonEmpty(entry.assetKey)) errors.push("asset_key_required");
  if (!isNonEmpty(entry.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(entry.sourceSystemRef)) errors.push("source_system_ref_required");
  if (!isNonEmpty(entry.displayName)) errors.push("display_name_required");
  if (!isNonEmpty(entry.sourceKind)) errors.push("source_kind_required");
  if (!isNonEmpty(entry.businessDomain)) errors.push("business_domain_required");
  if (!isNonEmpty(entry.businessOwnerRef)) {
    errors.push("business_owner_ref_required");
  }
  if (!isNonEmpty(entry.purpose)) errors.push("purpose_required");
  if (nonEmptyValues(entry.scopeRefs).length === 0) errors.push("scope_required");
  if (!isOneOf(entry.dataShape, DATA_ASSET_SHAPES)) {
    errors.push("data_shape_invalid");
  }
  if (!isOneOf(entry.sensitivity, OBSERVATION_SENSITIVITY_LEVELS)) {
    errors.push("sensitivity_invalid");
  }
  if (
    !isOneOf(
      entry.processingDisposition,
      DATA_ASSET_PROCESSING_DISPOSITIONS,
    )
  ) {
    errors.push("processing_disposition_invalid");
  }
  if (!isOneOf(entry.inventoryStatus, DATA_ASSET_INVENTORY_STATUSES)) {
    errors.push("inventory_status_invalid");
  }
  if (
    !isOneOf(
      entry.classificationStatus,
      DATA_ASSET_CLASSIFICATION_STATUSES,
    )
  ) {
    errors.push("classification_status_invalid");
  }
  if (
    !isOneOf(entry.authorizationStatus, DATA_ASSET_AUTHORIZATION_STATUSES)
  ) {
    errors.push("authorization_status_invalid");
  }
  if (!isOneOf(entry.connectionStatus, DATA_ASSET_CONNECTION_STATUSES)) {
    errors.push("connection_status_invalid");
  }
  if (
    !isOneOf(
      entry.initializationStatus,
      DATA_ASSET_INITIALIZATION_STATUSES,
    )
  ) {
    errors.push("initialization_status_invalid");
  }
  if (
    !isOneOf(entry.recommendedAccessMode, OBSERVATION_ACCESS_MODES)
  ) {
    errors.push("recommended_access_mode_invalid");
  }
  if (!Number.isInteger(entry.retentionDays) || entry.retentionDays <= 0) {
    errors.push("retention_days_invalid");
  }
  if (
    !Number.isInteger(entry.freshnessSlaMinutes) ||
    entry.freshnessSlaMinutes <= 0
  ) {
    errors.push("freshness_sla_invalid");
  }
  if (!Number.isInteger(entry.version) || entry.version < 1) {
    errors.push("asset_version_invalid");
  }
  if (!isFiniteDate(entry.createdAt) || !isFiniteDate(entry.updatedAt)) {
    errors.push("asset_timestamp_invalid");
  }
  if (entry.nextReviewAt !== null && !isFiniteDate(entry.nextReviewAt)) {
    errors.push("next_review_at_invalid");
  }
  if (entry.classificationStatus === "pending") {
    if (entry.sensitivity !== "restricted") {
      errors.push("pending_classification_requires_restricted_sensitivity");
    }
    if (entry.processingDisposition !== "local_only") {
      errors.push("pending_classification_requires_local_only_processing");
    }
  }
  if (
    entry.authorizationStatus !== "not_requested" &&
    entry.classificationStatus !== "classified"
  ) {
    errors.push("authorization_requires_classified_asset");
  }
  if (
    entry.authorizationStatus === "authorized" &&
    !isNonEmpty(entry.authorizationRef)
  ) {
    errors.push("authorized_asset_requires_authorization_ref");
  }
  if (
    entry.connectionStatus === "connecting" ||
    entry.connectionStatus === "connected"
  ) {
    if (entry.classificationStatus !== "classified") {
      errors.push("connection_requires_classified_asset");
    }
    if (entry.authorizationStatus !== "authorized") {
      errors.push(
        entry.connectionStatus === "connected"
          ? "connected_asset_requires_authorization"
          : "connection_requires_authorized_asset",
      );
    }
  }
  if (entry.connectionStatus === "connected") {
    if (!isNonEmpty(entry.connectorRef)) {
      errors.push("connected_asset_requires_connector_ref");
    }
    if (nonEmptyValues(entry.observationSourceRefs).length === 0) {
      errors.push("connected_asset_requires_observation_source");
    }
  }
  if (
    entry.initializationStatus === "running" ||
    entry.initializationStatus === "partial" ||
    entry.initializationStatus === "initialized"
  ) {
    if (entry.connectionStatus !== "connected") {
      errors.push(
        entry.initializationStatus === "initialized"
          ? "initialized_asset_requires_connected_source"
          : "initialization_requires_connected_source",
      );
    }
  }
  if (entry.initializationStatus === "initialized") {
    if (nonEmptyValues(entry.observationRunRefs).length === 0) {
      errors.push("initialized_asset_requires_observation_run");
    }
  }
  if (entry.processingDisposition === "prohibited") {
    if (entry.authorizationStatus === "authorized") {
      errors.push("prohibited_asset_cannot_be_authorized");
    }
    if (
      entry.connectionStatus === "connecting" ||
      entry.connectionStatus === "connected"
    ) {
      errors.push("prohibited_asset_cannot_be_connected");
    }
    if (
      entry.initializationStatus === "running" ||
      entry.initializationStatus === "partial" ||
      entry.initializationStatus === "initialized"
    ) {
      errors.push("prohibited_asset_cannot_be_initialized");
    }
  }
  if (
    entry.inventoryStatus === "excluded" &&
    (entry.authorizationStatus === "authorized" ||
      entry.connectionStatus === "connected" ||
      entry.initializationStatus === "initialized")
  ) {
    errors.push("excluded_asset_cannot_advance");
  }
  return result(errors);
}

export function validateDataAssetClassificationReceipt(
  receipt: DataAssetClassificationReceipt,
): DataAssetContractValidation {
  const errors = validateReceiptBase(receipt);
  if (receipt.receiptType !== "classification") {
    errors.push("receipt_type_invalid");
  }
  if (!isOneOf(receipt.dataShape, DATA_ASSET_SHAPES)) {
    errors.push("data_shape_invalid");
  }
  if (!isOneOf(receipt.sensitivity, OBSERVATION_SENSITIVITY_LEVELS)) {
    errors.push("sensitivity_invalid");
  }
  if (
    !isOneOf(
      receipt.processingDisposition,
      DATA_ASSET_PROCESSING_DISPOSITIONS,
    )
  ) {
    errors.push("processing_disposition_invalid");
  }
  if (receipt.classificationStatus !== "classified") {
    errors.push("classification_status_invalid");
  }
  if (nonEmptyValues(receipt.evidenceRefs).length === 0) {
    errors.push("classification_evidence_required");
  }
  return result(errors);
}

export function validateDataAssetAuthorizationReceipt(
  receipt: DataAssetAuthorizationReceipt,
): DataAssetContractValidation {
  const errors = validateReceiptBase(receipt);
  if (receipt.receiptType !== "authorization") {
    errors.push("receipt_type_invalid");
  }
  if (
    !isOneOf(
      receipt.authorizationStatus,
      DATA_ASSET_AUTHORIZATION_STATUSES.filter(
        (status) => status !== "not_requested",
      ),
    )
  ) {
    errors.push("authorization_status_invalid");
  }
  if (receipt.authorizationStatus === "authorized") {
    if (!isNonEmpty(receipt.authorizationRef)) {
      errors.push("authorization_ref_required");
    }
    if (nonEmptyValues(receipt.scopeRefs).length === 0) {
      errors.push("authorization_scope_required");
    }
    if (nonEmptyValues(receipt.evidenceRefs).length === 0) {
      errors.push("authorization_evidence_required");
    }
    if (
      !isFiniteDate(receipt.validFrom) ||
      !isFiniteDate(receipt.validUntil)
    ) {
      errors.push("authorization_window_required");
    } else if (Date.parse(receipt.validFrom) >= Date.parse(receipt.validUntil)) {
      errors.push("authorization_window_empty");
    }
  }
  if (
    (receipt.authorizationStatus === "denied" ||
      receipt.authorizationStatus === "revoked" ||
      receipt.authorizationStatus === "expired") &&
    nonEmptyValues(receipt.reasonCodes).length === 0
  ) {
    errors.push("authorization_reason_required");
  }
  return result(errors);
}

export function validateDataAssetConnectionReceipt(
  receipt: DataAssetConnectionReceipt,
): DataAssetContractValidation {
  const errors = validateReceiptBase(receipt);
  if (receipt.receiptType !== "connection") {
    errors.push("receipt_type_invalid");
  }
  if (
    !isOneOf(
      receipt.connectionStatus,
      DATA_ASSET_CONNECTION_STATUSES.filter(
        (status) => status !== "not_started",
      ),
    )
  ) {
    errors.push("connection_status_invalid");
  }
  if (!isOneOf(receipt.accessMode, OBSERVATION_ACCESS_MODES)) {
    errors.push("access_mode_invalid");
  }
  if (
    receipt.secretRef !== null &&
    !isManagedSecretReference(receipt.secretRef)
  ) {
    errors.push("secret_ref_must_be_managed_reference");
  }
  if (
    receipt.secretRef !== null &&
    /token=|password=|secret=|api[_-]?key=|bearer\s/i.test(receipt.secretRef)
  ) {
    errors.push("secret_ref_looks_like_inline_credential");
  }
  if (receipt.connectionStatus === "connected") {
    if (!isNonEmpty(receipt.connectorRef)) {
      errors.push("connector_ref_required");
    }
    if (!isNonEmpty(receipt.secretRef)) errors.push("secret_ref_required");
    if (!isNonEmpty(receipt.authorizationReceiptRef)) {
      errors.push("authorization_receipt_ref_required");
    }
    if (!isNonEmpty(receipt.observationSourceRef)) {
      errors.push("observation_source_ref_required");
    }
    if (nonEmptyValues(receipt.evidenceRefs).length === 0) {
      errors.push("connection_evidence_required");
    }
  }
  if (
    (receipt.connectionStatus === "blocked" ||
      receipt.connectionStatus === "failed" ||
      receipt.connectionStatus === "revoked") &&
    nonEmptyValues(receipt.reasonCodes).length === 0
  ) {
    errors.push("connection_reason_required");
  }
  return result(errors);
}

export function validateDataAssetInitializationReceipt(
  receipt: DataAssetInitializationReceipt,
): DataAssetContractValidation {
  const errors = validateReceiptBase(receipt);
  if (receipt.receiptType !== "initialization") {
    errors.push("receipt_type_invalid");
  }
  if (
    !isOneOf(
      receipt.initializationStatus,
      DATA_ASSET_INITIALIZATION_STATUSES.filter(
        (status) => status !== "not_started",
      ),
    )
  ) {
    errors.push("initialization_status_invalid");
  }
  if (receipt.initializationStatus === "initialized") {
    if (!isNonEmpty(receipt.connectionReceiptRef)) {
      errors.push("connection_receipt_ref_required");
    }
    if (nonEmptyValues(receipt.observationRunRefs).length === 0) {
      errors.push("initialization_observation_run_required");
    }
    if (nonEmptyValues(receipt.evidenceRefs).length === 0) {
      errors.push("initialization_evidence_required");
    }
  }
  if (
    (receipt.initializationStatus === "partial" ||
      receipt.initializationStatus === "failed" ||
      receipt.initializationStatus === "stale") &&
    nonEmptyValues(receipt.reasonCodes).length === 0
  ) {
    errors.push("initialization_reason_required");
  }
  return result(errors);
}

export function validateDataAssetReceiptForEntry(
  entry: DataAssetCatalogEntry,
  receipt: DataAssetStageReceipt,
): DataAssetContractValidation {
  const errors: string[] = [];
  if (receipt.workspaceRef !== entry.workspaceRef) {
    errors.push("receipt_workspace_mismatch");
  }
  if (receipt.assetRef !== entry.assetId) {
    errors.push("receipt_asset_mismatch");
  }
  if (receipt.expectedVersion !== entry.version) {
    errors.push("receipt_expected_version_mismatch");
  }
  return result(errors);
}

export function validateObservationSourceCompatibilityReceipt(
  receipt: ObservationSourceCompatibilityReceipt,
): DataAssetContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(receipt.receiptId)) errors.push("receipt_id_required");
  if (!isNonEmpty(receipt.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(receipt.observationSourceRef)) {
    errors.push("observation_source_ref_required");
  }
  if (!isNonEmpty(receipt.migrationRef)) errors.push("migration_ref_required");
  if (!isFiniteDate(receipt.capturedAt)) errors.push("captured_at_invalid");
  if (!isNonEmpty(receipt.actorRef)) errors.push("actor_ref_required");
  if (nonEmptyValues(receipt.evidenceRefs).length === 0) {
    errors.push("compatibility_evidence_required");
  }
  if (!isFiniteDate(receipt.nextReviewAt)) {
    errors.push("compatibility_next_review_at_invalid");
  } else if (
    isFiniteDate(receipt.capturedAt) &&
    Date.parse(receipt.nextReviewAt) <= Date.parse(receipt.capturedAt)
  ) {
    errors.push("compatibility_review_window_empty");
  }
  if (!isNonEmpty(receipt.sourceFingerprint)) {
    errors.push("source_fingerprint_required");
  }
  const restrictions = new Set(nonEmptyValues(receipt.restrictions));
  if (!restrictions.has("read_only_only")) {
    errors.push("compatibility_read_only_required");
  }
  if (!restrictions.has("no_capability_expansion")) {
    errors.push("compatibility_no_expansion_required");
  }
  if (!restrictions.has("catalog_backfill_required")) {
    errors.push("compatibility_backfill_required");
  }
  for (const restriction of restrictions) {
    if (
      !isOneOf(restriction, OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS)
    ) {
      errors.push("compatibility_restriction_invalid");
    }
  }
  return result(errors);
}
