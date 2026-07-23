import { describe, expect, it } from "vitest";
import {
  validateDataAssetAuthorizationReceipt,
  validateDataAssetCatalogEntry,
  validateDataAssetClassificationReceipt,
  validateDataAssetConnectionReceipt,
  validateDataAssetInitializationReceipt,
  validateDataAssetReceiptForEntry,
  validateObservationSourceCompatibilityReceipt,
} from "./data-asset-catalog.contract";
import type {
  DataAssetAuthorizationReceipt,
  DataAssetCatalogEntry,
  DataAssetClassificationReceipt,
  DataAssetConnectionReceipt,
  DataAssetInitializationReceipt,
  ObservationSourceCompatibilityReceipt,
} from "./data-asset-catalog.types";

const entry: DataAssetCatalogEntry = {
  assetId: "asset:crm",
  assetKey: "crm-primary",
  workspaceRef: "workspace:synthetic-enterprise",
  sourceSystemRef: "system:crm-primary",
  displayName: "Primary CRM",
  sourceKind: "crm",
  businessDomain: "sales",
  businessOwnerRef: "role:sales-operations",
  dataShape: "structured",
  sensitivity: "restricted",
  processingDisposition: "local_only",
  inventoryStatus: "inventoried",
  classificationStatus: "pending",
  authorizationStatus: "not_requested",
  connectionStatus: "not_started",
  initializationStatus: "not_started",
  purpose: "Build a read-only operating baseline",
  scopeRefs: ["scope:sales"],
  authorizationRef: null,
  consentRefs: [],
  recommendedAccessMode: "read_only_api",
  connectorRef: null,
  retentionDays: 30,
  freshnessSlaMinutes: 60,
  residencyRequirements: ["region:cn"],
  blindSpots: ["Historical activity before 2025 is unavailable"],
  blockerCodes: [],
  riskOwnerRef: "role:security",
  nextReviewAt: "2026-08-01T00:00:00.000Z",
  observationSourceRefs: [],
  observationRunRefs: [],
  evidenceRefs: ["evidence:asset-inventory:crm"],
  version: 1,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

const classificationReceipt: DataAssetClassificationReceipt = {
  receiptType: "classification",
  receiptId: "receipt:classification:crm:1",
  workspaceRef: entry.workspaceRef,
  assetRef: entry.assetId,
  idempotencyKey: "classification:crm:v1",
  expectedVersion: 1,
  resultingVersion: 2,
  recordedAt: "2026-07-23T01:00:00.000Z",
  actorRef: "user:data-owner",
  evidenceRefs: ["evidence:classification:crm"],
  dataShape: "structured",
  sensitivity: "confidential",
  processingDisposition: "local_only",
  classificationStatus: "classified",
};

const authorizationReceipt: DataAssetAuthorizationReceipt = {
  receiptType: "authorization",
  receiptId: "receipt:authorization:crm:1",
  workspaceRef: entry.workspaceRef,
  assetRef: entry.assetId,
  idempotencyKey: "authorization:crm:v1",
  expectedVersion: 2,
  resultingVersion: 3,
  recordedAt: "2026-07-23T02:00:00.000Z",
  actorRef: "user:data-owner",
  evidenceRefs: ["evidence:authorization:crm"],
  authorizationStatus: "authorized",
  authorizationRef: "authorization:crm:readonly",
  scopeRefs: ["scope:sales"],
  consentRefs: [],
  validFrom: "2026-07-23T02:00:00.000Z",
  validUntil: "2026-08-23T02:00:00.000Z",
  reasonCodes: [],
};

const connectionReceipt: DataAssetConnectionReceipt = {
  receiptType: "connection",
  receiptId: "receipt:connection:crm:1",
  workspaceRef: entry.workspaceRef,
  assetRef: entry.assetId,
  idempotencyKey: "connection:crm:v1",
  expectedVersion: 3,
  resultingVersion: 4,
  recordedAt: "2026-07-23T03:00:00.000Z",
  actorRef: "user:fde",
  evidenceRefs: ["evidence:connection-smoke:crm"],
  connectionStatus: "connected",
  accessMode: "read_only_api",
  connectorRef: "connector:crm",
  secretRef: "secret-ref:vault/customer/crm-reader",
  authorizationReceiptRef: authorizationReceipt.receiptId,
  observationSourceRef: "source:crm",
  reasonCodes: [],
};

const initializationReceipt: DataAssetInitializationReceipt = {
  receiptType: "initialization",
  receiptId: "receipt:initialization:crm:1",
  workspaceRef: entry.workspaceRef,
  assetRef: entry.assetId,
  idempotencyKey: "initialization:crm:v1",
  expectedVersion: 4,
  resultingVersion: 5,
  recordedAt: "2026-07-23T04:00:00.000Z",
  actorRef: "agent:caio-initializer",
  evidenceRefs: ["evidence:initialization:crm"],
  initializationStatus: "initialized",
  connectionReceiptRef: connectionReceipt.receiptId,
  observationRunRefs: ["observation-run:crm:baseline"],
  schemaMappingRefs: ["schema-map:crm:v1"],
  companyMemoryRefs: ["memory-bundle:crm:v1"],
  temporalContextSnapshotRef: "operating-context:baseline:v1",
  reasonCodes: [],
};

describe("CAIO Pro data asset catalog contract", () => {
  it("accepts an inventoried but not-yet-authorized asset with fail-closed defaults", () => {
    expect(validateDataAssetCatalogEntry(entry)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("keeps an unclassified asset restricted and local-only", () => {
    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        sensitivity: "internal",
        processingDisposition: "remote_projected",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "pending_classification_requires_restricted_sensitivity",
        "pending_classification_requires_local_only_processing",
      ]),
    );
  });

  it("does not let connected or initialized projections outrun authorization evidence", () => {
    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        connectionStatus: "connected",
        initializationStatus: "initialized",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "connected_asset_requires_authorization",
        "connected_asset_requires_connector_ref",
        "connected_asset_requires_observation_source",
        "initialized_asset_requires_observation_run",
      ]),
    );
  });

  it("does not let authorization or connection outrun classification", () => {
    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        authorizationStatus: "authorized",
        authorizationRef: "authorization:crm:readonly",
        connectionStatus: "connected",
        connectorRef: "connector:crm",
        observationSourceRefs: ["source:crm"],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "authorization_requires_classified_asset",
        "connection_requires_classified_asset",
      ]),
    );
  });

  it("requires intermediate connection and initialization states to respect prerequisites", () => {
    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        classificationStatus: "classified",
        connectionStatus: "connecting",
        initializationStatus: "running",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "connection_requires_authorized_asset",
        "initialization_requires_connected_source",
      ]),
    );
  });

  it("tests excluded, prohibited and stale projections explicitly", () => {
    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        inventoryStatus: "excluded",
        classificationStatus: "classified",
        authorizationStatus: "authorized",
        authorizationRef: "authorization:crm:readonly",
      }).errors,
    ).toContain("excluded_asset_cannot_advance");

    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        classificationStatus: "classified",
        processingDisposition: "prohibited",
        authorizationStatus: "authorized",
        authorizationRef: "authorization:crm:readonly",
        connectionStatus: "connecting",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "prohibited_asset_cannot_be_authorized",
        "prohibited_asset_cannot_be_connected",
      ]),
    );

    expect(
      validateDataAssetCatalogEntry({
        ...entry,
        classificationStatus: "classified",
        authorizationStatus: "revoked",
        connectionStatus: "revoked",
        initializationStatus: "stale",
      }),
    ).toEqual({ valid: true, errors: [] });
  });
});

describe("CAIO Pro data asset stage receipts", () => {
  it("requires classification receipts to advance exactly one optimistic version", () => {
    expect(validateDataAssetClassificationReceipt(classificationReceipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateDataAssetClassificationReceipt({
        ...classificationReceipt,
        resultingVersion: 3,
      }).errors,
    ).toContain("receipt_version_transition_invalid");
    expect(
      validateDataAssetClassificationReceipt({
        ...classificationReceipt,
        receiptType: "connection" as never,
      }).errors,
    ).toContain("receipt_type_invalid");
  });

  it("requires an authorized receipt to carry scoped, time-bounded evidence", () => {
    expect(validateDataAssetAuthorizationReceipt(authorizationReceipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateDataAssetAuthorizationReceipt({
        ...authorizationReceipt,
        authorizationRef: null,
        scopeRefs: [],
        evidenceRefs: [],
        validUntil: null,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "authorization_ref_required",
        "authorization_scope_required",
        "authorization_evidence_required",
        "authorization_window_required",
      ]),
    );
    expect(
      validateDataAssetAuthorizationReceipt({
        ...authorizationReceipt,
        validUntil: authorizationReceipt.validFrom,
      }).errors,
    ).toContain("authorization_window_empty");
    expect(
      validateDataAssetAuthorizationReceipt({
        ...authorizationReceipt,
        authorizationStatus: "revoked",
        authorizationRef: null,
        validFrom: null,
        validUntil: null,
        reasonCodes: [],
      }).errors,
    ).toContain("authorization_reason_required");
  });

  it("requires a connected receipt to bind authorization, credential reference and source evidence", () => {
    expect(validateDataAssetConnectionReceipt(connectionReceipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateDataAssetConnectionReceipt({
        ...connectionReceipt,
        secretRef: "password=raw-secret",
        authorizationReceiptRef: null,
        observationSourceRef: null,
        evidenceRefs: [],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "secret_ref_looks_like_inline_credential",
        "authorization_receipt_ref_required",
        "observation_source_ref_required",
        "connection_evidence_required",
      ]),
    );
    for (const rawCredential of [
      ["mysql:", "//reader", ":synthetic-password", "@db.example.invalid/company"].join(
        "",
      ),
      "Bearer synthetic-token",
      "eyJhbGciOiJIUzI1NiJ9.synthetic.signature",
    ]) {
      expect(
        validateDataAssetConnectionReceipt({
          ...connectionReceipt,
          secretRef: rawCredential,
        }).errors,
      ).toContain("secret_ref_must_be_managed_reference");
    }
    expect(
      validateDataAssetConnectionReceipt({
        ...connectionReceipt,
        secretRef: null,
      }).errors,
    ).toContain("secret_ref_required");
    expect(
      validateDataAssetConnectionReceipt({
        ...connectionReceipt,
        connectionStatus: "failed",
        reasonCodes: [],
      }).errors,
    ).toContain("connection_reason_required");
  });

  it("requires initialized assets to point to a baseline run and evidence", () => {
    expect(validateDataAssetInitializationReceipt(initializationReceipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateDataAssetInitializationReceipt({
        ...initializationReceipt,
        observationRunRefs: [],
        evidenceRefs: [],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "initialization_observation_run_required",
        "initialization_evidence_required",
      ]),
    );
    expect(
      validateDataAssetInitializationReceipt({
        ...initializationReceipt,
        initializationStatus: "failed",
        reasonCodes: [],
      }).errors,
    ).toContain("initialization_reason_required");
  });

  it("binds every receipt to the same workspace, asset and expected projection version", () => {
    expect(
      validateDataAssetReceiptForEntry(entry, classificationReceipt),
    ).toEqual({ valid: true, errors: [] });
    expect(
      validateDataAssetReceiptForEntry(entry, {
        ...classificationReceipt,
        workspaceRef: "workspace:other",
        assetRef: "asset:other",
        expectedVersion: 9,
        resultingVersion: 10,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "receipt_workspace_mismatch",
        "receipt_asset_mismatch",
        "receipt_expected_version_mismatch",
      ]),
    );
  });
});

describe("pre-catalog ObservationSource compatibility receipt", () => {
  const receipt: ObservationSourceCompatibilityReceipt = {
    receiptId: "receipt:legacy-source:crm",
    workspaceRef: entry.workspaceRef,
    observationSourceRef: "source:legacy-crm",
    migrationRef: "migration:20260723090000_caio_data_asset_catalog",
    capturedAt: "2026-07-23T00:00:00.000Z",
    actorRef: "migration:caio-data-asset-catalog",
    evidenceRefs: ["evidence:legacy-source-snapshot:crm"],
    nextReviewAt: "2026-08-23T00:00:00.000Z",
    sourceFingerprint: "sha256:synthetic-source-fingerprint",
    restrictions: [
      "read_only_only",
      "no_capability_expansion",
      "catalog_backfill_required",
    ],
  };

  it("accepts only an explicit, bounded compatibility receipt", () => {
    expect(validateObservationSourceCompatibilityReceipt(receipt)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateObservationSourceCompatibilityReceipt({
        ...receipt,
        restrictions: ["read_only_only"],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "compatibility_no_expansion_required",
        "compatibility_backfill_required",
      ]),
    );
    expect(
      validateObservationSourceCompatibilityReceipt({
        ...receipt,
        restrictions: [
          ...receipt.restrictions,
          "permit_write_access" as never,
        ],
      }).errors,
    ).toContain("compatibility_restriction_invalid");
  });
});
