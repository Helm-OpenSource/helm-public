import type {
  ObservationAccessMode,
  ObservationSensitivity,
} from "./types";

export const DATA_ASSET_SHAPES = [
  "structured",
  "semi_structured",
  "document",
  "code",
  "message",
  "audio",
  "other",
] as const;

export type DataAssetShape = (typeof DATA_ASSET_SHAPES)[number];

export const DATA_ASSET_PROCESSING_DISPOSITIONS = [
  "prohibited",
  "local_only",
  "remote_projected",
] as const;

export type DataAssetProcessingDisposition =
  (typeof DATA_ASSET_PROCESSING_DISPOSITIONS)[number];

export const DATA_ASSET_INVENTORY_STATUSES = [
  "inventoried",
  "confirmed",
  "excluded",
] as const;

export type DataAssetInventoryStatus =
  (typeof DATA_ASSET_INVENTORY_STATUSES)[number];

export const DATA_ASSET_CLASSIFICATION_STATUSES = [
  "pending",
  "classified",
] as const;

export type DataAssetClassificationStatus =
  (typeof DATA_ASSET_CLASSIFICATION_STATUSES)[number];

export const DATA_ASSET_AUTHORIZATION_STATUSES = [
  "not_requested",
  "pending",
  "authorized",
  "denied",
  "revoked",
  "expired",
] as const;

export type DataAssetAuthorizationStatus =
  (typeof DATA_ASSET_AUTHORIZATION_STATUSES)[number];

export const DATA_ASSET_CONNECTION_STATUSES = [
  "not_started",
  "connecting",
  "connected",
  "blocked",
  "paused",
  "revoked",
  "failed",
] as const;

export type DataAssetConnectionStatus =
  (typeof DATA_ASSET_CONNECTION_STATUSES)[number];

export const DATA_ASSET_INITIALIZATION_STATUSES = [
  "not_started",
  "running",
  "initialized",
  "partial",
  "failed",
  "stale",
] as const;

export type DataAssetInitializationStatus =
  (typeof DATA_ASSET_INITIALIZATION_STATUSES)[number];

export type DataAssetCatalogEntry = {
  assetId: string;
  assetKey: string;
  workspaceRef: string;
  sourceSystemRef: string;
  displayName: string;
  sourceKind: string;
  businessDomain: string;
  businessOwnerRef: string;
  dataShape: DataAssetShape;
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  inventoryStatus: DataAssetInventoryStatus;
  classificationStatus: DataAssetClassificationStatus;
  authorizationStatus: DataAssetAuthorizationStatus;
  connectionStatus: DataAssetConnectionStatus;
  initializationStatus: DataAssetInitializationStatus;
  purpose: string;
  scopeRefs: readonly string[];
  authorizationRef: string | null;
  consentRefs: readonly string[];
  recommendedAccessMode: ObservationAccessMode;
  connectorRef: string | null;
  retentionDays: number;
  freshnessSlaMinutes: number;
  residencyRequirements: readonly string[];
  blindSpots: readonly string[];
  blockerCodes: readonly string[];
  riskOwnerRef: string | null;
  nextReviewAt: string | null;
  observationSourceRefs: readonly string[];
  observationRunRefs: readonly string[];
  evidenceRefs: readonly string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DataAssetStageReceiptBase = {
  receiptType:
    | "classification"
    | "authorization"
    | "connection"
    | "initialization";
  receiptId: string;
  workspaceRef: string;
  assetRef: string;
  idempotencyKey: string;
  expectedVersion: number;
  resultingVersion: number;
  recordedAt: string;
  actorRef: string;
  evidenceRefs: readonly string[];
};

export type DataAssetClassificationReceipt = DataAssetStageReceiptBase & {
  receiptType: "classification";
  dataShape: DataAssetShape;
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  classificationStatus: "classified";
};

export type DataAssetAuthorizationReceipt = DataAssetStageReceiptBase & {
  receiptType: "authorization";
  authorizationStatus: Exclude<
    DataAssetAuthorizationStatus,
    "not_requested"
  >;
  authorizationRef: string | null;
  scopeRefs: readonly string[];
  consentRefs: readonly string[];
  validFrom: string | null;
  validUntil: string | null;
  reasonCodes: readonly string[];
};

export type DataAssetConnectionReceipt = DataAssetStageReceiptBase & {
  receiptType: "connection";
  connectionStatus: Exclude<DataAssetConnectionStatus, "not_started">;
  accessMode: ObservationAccessMode;
  connectorRef: string | null;
  secretRef: string | null;
  authorizationReceiptRef: string | null;
  observationSourceRef: string | null;
  reasonCodes: readonly string[];
};

export type DataAssetInitializationReceipt = DataAssetStageReceiptBase & {
  receiptType: "initialization";
  initializationStatus: Exclude<
    DataAssetInitializationStatus,
    "not_started"
  >;
  connectionReceiptRef: string | null;
  observationRunRefs: readonly string[];
  schemaMappingRefs: readonly string[];
  companyMemoryRefs: readonly string[];
  temporalContextSnapshotRef: string | null;
  reasonCodes: readonly string[];
};

export type DataAssetStageReceipt =
  | DataAssetClassificationReceipt
  | DataAssetAuthorizationReceipt
  | DataAssetConnectionReceipt
  | DataAssetInitializationReceipt;

export const OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS = [
  "read_only_only",
  "no_capability_expansion",
  "catalog_backfill_required",
] as const;

export type ObservationSourceCompatibilityRestriction =
  (typeof OBSERVATION_SOURCE_COMPATIBILITY_RESTRICTIONS)[number];

export type ObservationSourceCompatibilityReceipt = {
  receiptId: string;
  workspaceRef: string;
  observationSourceRef: string;
  migrationRef: string;
  capturedAt: string;
  actorRef: string;
  evidenceRefs: readonly string[];
  nextReviewAt: string;
  sourceFingerprint: string;
  restrictions: readonly ObservationSourceCompatibilityRestriction[];
};
