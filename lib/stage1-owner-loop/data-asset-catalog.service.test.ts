import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonStringify } from "@/lib/utils";

const { dbMock, auditMock, serviceGovernanceMock } = vi.hoisted(() => {
  const client = {
    dataAssetCatalogEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    dataAssetStageReceipt: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    observationSource: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    observationSourceRun: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return {
    dbMock: client,
    auditMock: { writeAuditLog: vi.fn() },
    serviceGovernanceMock: { assertWorkspacePolicyServiceAccess: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: auditMock.writeAuditLog }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspacePolicyServiceAccess:
    serviceGovernanceMock.assertWorkspacePolicyServiceAccess,
}));

import {
  DataAssetCatalogConflictError,
  DataAssetCatalogTransitionError,
  createDataAssetCatalogEntry,
  recordDataAssetAuthorizationReceipt,
  recordDataAssetClassificationReceipt,
  recordDataAssetConnectionReceipt,
  recordDataAssetInitializationReceipt,
} from "./data-asset-catalog.service";

const recordedAt = new Date("2026-07-23T01:00:00.000Z");

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    workspaceId: "workspace-1",
    assetKey: "crm-primary",
    sourceSystemRef: "system:crm-primary",
    displayName: "Primary CRM",
    sourceKind: "crm",
    businessDomain: "sales",
    businessOwnerRef: "role:sales-operations",
    dataShape: "STRUCTURED",
    sensitivity: "RESTRICTED",
    processingDisposition: "LOCAL_ONLY",
    technicalFeasibility: "UNASSESSED",
    inventoryStatus: "INVENTORIED",
    classificationStatus: "PENDING",
    authorizationStatus: "NOT_REQUESTED",
    connectionStatus: "NOT_STARTED",
    initializationStatus: "NOT_STARTED",
    purpose: "Build a read-only operating baseline",
    scopeRefs: JSON.stringify(["scope:sales"]),
    authorizationRef: null,
    authorizationValidFrom: null,
    authorizationValidUntil: null,
    consentRefs: JSON.stringify([]),
    recommendedAccessMode: "READ_ONLY_API",
    connectorRef: null,
    retentionDays: 30,
    freshnessSlaMinutes: 60,
    residencyRequirements: JSON.stringify(["region:cn"]),
    blindSpots: JSON.stringify([]),
    blockerCodes: JSON.stringify([]),
    riskOwnerRef: "role:security",
    nextReviewAt: new Date("2026-08-23T00:00:00.000Z"),
    observationSourceRefs: JSON.stringify([]),
    observationRunRefs: JSON.stringify([]),
    evidenceRefs: JSON.stringify(["evidence:inventory:crm"]),
    classificationReceiptRef: null,
    authorizationReceiptRef: null,
    connectionReceiptRef: null,
    initializationReceiptRef: null,
    version: 1,
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
    updatedAt: new Date("2026-07-23T00:00:00.000Z"),
    ...overrides,
  };
}

function stageReceipt(overrides: Record<string, unknown> = {}) {
  return {
    id: "receipt-1",
    workspaceId: "workspace-1",
    assetId: "asset-1",
    receiptType: "CLASSIFICATION",
    idempotencyKey: "classification:crm:v1",
    expectedVersion: 1,
    resultingVersion: 2,
    status: "CLASSIFIED",
    actorRef: "owner-1",
    evidenceRefs: JSON.stringify(["evidence:classification:crm"]),
    payloadJson: JSON.stringify({ synthetic: true }),
    recordedAt,
    createdAt: recordedAt,
    ...overrides,
  };
}

function authorizationReceiptPayload() {
  return {
    receiptType: "authorization",
    receiptId: "receipt-auth-1",
    workspaceRef: "workspace:workspace-1",
    assetRef: "asset-1",
    idempotencyKey: "authorization:crm:v1",
    expectedVersion: 1,
    resultingVersion: 2,
    recordedAt: recordedAt.toISOString(),
    actorRef: "owner-1",
    evidenceRefs: ["evidence:authorization:crm"],
    authorizationStatus: "authorized",
    authorizationRef: "authorization:crm:readonly",
    scopeRefs: ["scope:sales"],
    consentRefs: [],
    validFrom: recordedAt.toISOString(),
    validUntil: "2026-08-23T01:00:00.000Z",
    reasonCodes: [],
  };
}

function actorInput() {
  return {
    workspaceId: "workspace-1",
    assetId: "asset-1",
    actorName: "Owner",
    actorUserId: "owner-1",
    now: recordedAt,
  };
}

describe("CAIO Pro data asset catalog persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      (callback: (tx: typeof dbMock) => unknown) => callback(dbMock),
    );
    dbMock.$queryRaw.mockResolvedValue([{ id: "asset-1" }]);
    serviceGovernanceMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
      undefined,
    );
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(null);
    dbMock.dataAssetStageReceipt.findUnique.mockResolvedValue(null);
  });

  it("locks the catalog entry before reading stage state", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        technicalFeasibility: "FEASIBLE",
        version: 2,
      }),
    );
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-1",
        receiptType: "AUTHORIZATION",
        idempotencyKey: "authorization:crm:v1",
        expectedVersion: 2,
        resultingVersion: 3,
        status: "AUTHORIZED",
      }),
    );
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        technicalFeasibility: "FEASIBLE",
        authorizationStatus: "AUTHORIZED",
        version: 3,
      }),
    );

    await recordDataAssetAuthorizationReceipt({
      ...actorInput(),
      receiptId: "receipt-auth-1",
      idempotencyKey: "authorization:crm:v1",
      expectedVersion: 2,
      authorizationStatus: "authorized",
      authorizationRef: "authorization:crm:readonly",
      scopeRefs: ["scope:sales"],
      consentRefs: [],
      validFrom: recordedAt,
      validUntil: new Date("2026-08-23T01:00:00.000Z"),
      reasonCodes: [],
      evidenceRefs: ["evidence:authorization:crm"],
    });

    expect(dbMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(
      dbMock.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dbMock.dataAssetStageReceipt.findUnique.mock.invocationCallOrder[0],
    );
    expect(
      dbMock.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dbMock.dataAssetCatalogEntry.findFirst.mock.invocationCallOrder[0],
    );
  });

  it("creates an inventoried asset with fail-closed classification defaults", async () => {
    dbMock.dataAssetCatalogEntry.create.mockResolvedValue(asset());

    await createDataAssetCatalogEntry({
      workspaceId: "workspace-1",
      assetKey: "crm-primary",
      sourceSystemRef: "system:crm-primary",
      displayName: "Primary CRM",
      sourceKind: "crm",
      businessDomain: "sales",
      businessOwnerRef: "role:sales-operations",
      purpose: "Build a read-only operating baseline",
      scopeRefs: ["scope:sales"],
      recommendedAccessMode: "read_only_api",
      retentionDays: 30,
      freshnessSlaMinutes: 60,
      residencyRequirements: ["region:cn"],
      blindSpots: [],
      blockerCodes: [],
      riskOwnerRef: "role:security",
      nextReviewAt: new Date("2026-08-23T00:00:00.000Z"),
      evidenceRefs: ["evidence:inventory:crm"],
      actorName: "Owner",
      actorUserId: "owner-1",
      now: recordedAt,
    });

    expect(dbMock.dataAssetCatalogEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sensitivity: "RESTRICTED",
        processingDisposition: "LOCAL_ONLY",
        technicalFeasibility: "UNASSESSED",
        classificationStatus: "PENDING",
        authorizationStatus: "NOT_REQUESTED",
        connectionStatus: "NOT_STARTED",
        initializationStatus: "NOT_STARTED",
        version: 1,
      }),
    });
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: ActorType.USER,
        actionType: "DATA_ASSET_INVENTORIED",
        targetId: "asset-1",
      }),
      { client: dbMock },
    );
  });

  it("records classification and advances the current projection atomically", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(asset());
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(stageReceipt());
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        sensitivity: "CONFIDENTIAL",
        classificationReceiptRef: "receipt-1",
        version: 2,
      }),
    );

    const result = await recordDataAssetClassificationReceipt({
      ...actorInput(),
      receiptId: "receipt-1",
      idempotencyKey: "classification:crm:v1",
      expectedVersion: 1,
      dataShape: "structured",
      sensitivity: "confidential",
      processingDisposition: "local_only",
      technicalFeasibility: "feasible",
      evidenceRefs: ["evidence:classification:crm"],
    });

    expect(result.replayed).toBe(false);
    expect(dbMock.dataAssetCatalogEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "asset-1", workspaceId: "workspace-1", version: 1 },
      data: expect.objectContaining({
        classificationStatus: "CLASSIFIED",
        classificationReceiptRef: "receipt-1",
        version: { increment: 1 },
      }),
    });
    expect(dbMock.dataAssetStageReceipt.create).toHaveBeenCalledTimes(1);
  });

  it("requires reauthorization before changing an authorized asset classification", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        technicalFeasibility: "FEASIBLE",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        version: 4,
      }),
    );

    await expect(
      recordDataAssetClassificationReceipt({
        ...actorInput(),
        receiptId: "receipt-reclassification-1",
        idempotencyKey: "classification:crm:v2",
        expectedVersion: 4,
        dataShape: "structured",
        sensitivity: "public",
        processingDisposition: "remote_projected",
        technicalFeasibility: "feasible",
        evidenceRefs: ["evidence:classification:crm:v2"],
      }),
    ).rejects.toMatchObject({
      reasons: ["classification_change_requires_reauthorization"],
    });

    expect(dbMock.dataAssetCatalogEntry.updateMany).not.toHaveBeenCalled();
    expect(dbMock.dataAssetStageReceipt.create).not.toHaveBeenCalled();
  });

  it("allows an authorized asset to append evidence without changing its classification", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        technicalFeasibility: "FEASIBLE",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        version: 4,
      }),
    );
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(
      stageReceipt({
        id: "receipt-classification-evidence-2",
        idempotencyKey: "classification:crm:evidence:v2",
        expectedVersion: 4,
        resultingVersion: 5,
      }),
    );
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        technicalFeasibility: "FEASIBLE",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationReceiptRef: "receipt-auth-1",
        classificationReceiptRef: "receipt-classification-evidence-2",
        version: 5,
      }),
    );

    const result = await recordDataAssetClassificationReceipt({
      ...actorInput(),
      receiptId: "receipt-classification-evidence-2",
      idempotencyKey: "classification:crm:evidence:v2",
      expectedVersion: 4,
      dataShape: "structured",
      sensitivity: "restricted",
      processingDisposition: "local_only",
      technicalFeasibility: "feasible",
      evidenceRefs: ["evidence:classification:crm:v2"],
    });

    expect(result.replayed).toBe(false);
    expect(dbMock.dataAssetCatalogEntry.updateMany).toHaveBeenCalledTimes(1);
    expect(dbMock.dataAssetStageReceipt.create).toHaveBeenCalledTimes(1);
  });

  it("replays an idempotent receipt without a second projection write", async () => {
    dbMock.dataAssetStageReceipt.findUnique.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-1",
        receiptType: "AUTHORIZATION",
        idempotencyKey: "authorization:crm:v1",
        payloadJson: JSON.stringify(authorizationReceiptPayload()),
      }),
    );
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({ version: 2 }),
    );

    const result = await recordDataAssetAuthorizationReceipt({
      ...actorInput(),
      receiptId: "receipt-auth-1",
      idempotencyKey: "authorization:crm:v1",
      expectedVersion: 1,
      authorizationStatus: "authorized",
      authorizationRef: "authorization:crm:readonly",
      scopeRefs: ["scope:sales"],
      consentRefs: [],
      validFrom: recordedAt,
      validUntil: new Date("2026-08-23T01:00:00.000Z"),
      reasonCodes: [],
      evidenceRefs: ["evidence:authorization:crm"],
    });

    expect(result.replayed).toBe(true);
    expect(dbMock.dataAssetCatalogEntry.updateMany).not.toHaveBeenCalled();
    expect(dbMock.dataAssetStageReceipt.create).not.toHaveBeenCalled();
  });

  it("rejects authorization before classification", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(asset());

    await expect(
      recordDataAssetAuthorizationReceipt({
        ...actorInput(),
        receiptId: "receipt-auth-1",
        idempotencyKey: "authorization:crm:v1",
        expectedVersion: 1,
        authorizationStatus: "authorized",
        authorizationRef: "authorization:crm:readonly",
        scopeRefs: ["scope:sales"],
        consentRefs: [],
        validFrom: recordedAt,
        validUntil: new Date("2026-08-23T01:00:00.000Z"),
        reasonCodes: [],
        evidenceRefs: ["evidence:authorization:crm"],
      }),
    ).rejects.toMatchObject({
      reasons: ["authorization_requires_classified_asset"],
    });
    expect(dbMock.dataAssetCatalogEntry.updateMany).not.toHaveBeenCalled();
  });

  it("fails one of two competing stage transitions through the version claim", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({ classificationStatus: "CLASSIFIED" }),
    );
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      recordDataAssetAuthorizationReceipt({
        ...actorInput(),
        receiptId: "receipt-auth-1",
        idempotencyKey: "authorization:crm:v1",
        expectedVersion: 1,
        authorizationStatus: "authorized",
        authorizationRef: "authorization:crm:readonly",
        scopeRefs: ["scope:sales"],
        consentRefs: [],
        validFrom: recordedAt,
        validUntil: new Date("2026-08-23T01:00:00.000Z"),
        reasonCodes: [],
        evidenceRefs: ["evidence:authorization:crm"],
      }),
    ).rejects.toBeInstanceOf(DataAssetCatalogConflictError);
    expect(dbMock.dataAssetStageReceipt.create).not.toHaveBeenCalled();
  });

  it("requires a connected source to belong to the same catalog asset", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        version: 3,
      }),
    );
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-1",
        receiptType: "AUTHORIZATION",
        status: "AUTHORIZED",
      }),
    );
    dbMock.observationSource.findFirst.mockResolvedValue(null);

    await expect(
      recordDataAssetConnectionReceipt({
        ...actorInput(),
        receiptId: "receipt-connection-1",
        idempotencyKey: "connection:crm:v1",
        expectedVersion: 3,
        connectionStatus: "connected",
        accessMode: "read_only_api",
        connectorRef: "connector:crm",
        secretRef: "secret-manager:crm-readonly",
        authorizationReceiptRef: "receipt-auth-1",
        observationSourceRef: "source-other-asset",
        reasonCodes: [],
        evidenceRefs: ["evidence:connection:crm"],
      }),
    ).rejects.toBeInstanceOf(DataAssetCatalogTransitionError);
    expect(dbMock.dataAssetCatalogEntry.updateMany).not.toHaveBeenCalled();
  });

  it("connects an authorized source only through the current authorization receipt", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        version: 3,
      }),
    );
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-1",
        receiptType: "AUTHORIZATION",
        status: "AUTHORIZED",
      }),
    );
    dbMock.observationSource.findFirst.mockResolvedValue({
      id: "source-1",
      workspaceId: "workspace-1",
      catalogEntryId: "asset-1",
      accessMode: "READ_ONLY_API",
      secretRef: "secret-manager:crm-readonly",
      authorizationRef: "authorization:crm:readonly",
      status: "ACTIVE",
    });
    dbMock.observationSource.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(
      stageReceipt({
        id: "receipt-connection-1",
        receiptType: "CONNECTION",
        status: "CONNECTED",
        expectedVersion: 3,
        resultingVersion: 4,
      }),
    );
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        connectionStatus: "CONNECTED",
        connectorRef: "connector:crm",
        connectionReceiptRef: "receipt-connection-1",
        observationSourceRefs: JSON.stringify(["source-1"]),
        version: 4,
      }),
    );

    const result = await recordDataAssetConnectionReceipt({
      ...actorInput(),
      receiptId: "receipt-connection-1",
      idempotencyKey: "connection:crm:v1",
      expectedVersion: 3,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: "connector:crm",
      secretRef: "secret-manager:crm-readonly",
      authorizationReceiptRef: "receipt-auth-1",
      observationSourceRef: "source-1",
      reasonCodes: [],
      evidenceRefs: ["evidence:connection:crm"],
    });

    expect(result.replayed).toBe(false);
    expect(dbMock.dataAssetStageReceipt.findFirst).toHaveBeenCalledWith({
      where: {
        id: "receipt-auth-1",
        workspaceId: "workspace-1",
        assetId: "asset-1",
        receiptType: "AUTHORIZATION",
        status: "AUTHORIZED",
      },
      select: { id: true },
    });
    expect(dbMock.observationSource.updateMany).toHaveBeenCalledWith({
      where: {
        id: "source-1",
        workspaceId: "workspace-1",
        catalogEntryId: "asset-1",
        status: { in: ["ACTIVE", "ERROR", "PAUSED", "REVOKED"] },
        program: {
          status: "ACTIVE",
          revokedAt: null,
          startsAt: { lte: recordedAt },
          expiresAt: { gt: recordedAt },
        },
      },
      data: { status: "ACTIVE" },
    });
  });

  it("reactivates the same governed source after a transient connection failure", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        connectionStatus: "FAILED",
        connectorRef: "connector:crm",
        connectionReceiptRef: "receipt-connection-failed-1",
        initializationStatus: "STALE",
        observationSourceRefs: JSON.stringify(["source-1"]),
        version: 5,
      }),
    );
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-1",
        receiptType: "AUTHORIZATION",
        status: "AUTHORIZED",
      }),
    );
    dbMock.observationSource.findFirst.mockResolvedValue({
      id: "source-1",
      workspaceId: "workspace-1",
      catalogEntryId: "asset-1",
      accessMode: "READ_ONLY_API",
      secretRef: "secret-manager:crm-readonly",
      authorizationRef: "authorization:crm:readonly",
      status: "ERROR",
    });
    dbMock.observationSource.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(
      stageReceipt({
        id: "receipt-connection-recovered-1",
        receiptType: "CONNECTION",
        status: "CONNECTED",
        expectedVersion: 5,
        resultingVersion: 6,
      }),
    );
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        connectionStatus: "CONNECTED",
        connectorRef: "connector:crm",
        connectionReceiptRef: "receipt-connection-recovered-1",
        initializationStatus: "STALE",
        observationSourceRefs: JSON.stringify(["source-1"]),
        version: 6,
      }),
    );

    await recordDataAssetConnectionReceipt({
      ...actorInput(),
      receiptId: "receipt-connection-recovered-1",
      idempotencyKey: "connection:crm:recovered:v1",
      expectedVersion: 5,
      connectionStatus: "connected",
      accessMode: "read_only_api",
      connectorRef: "connector:crm",
      secretRef: "secret-manager:crm-readonly",
      authorizationReceiptRef: "receipt-auth-1",
      observationSourceRef: "source-1",
      reasonCodes: [],
      evidenceRefs: ["evidence:connection-recovered:crm"],
    });

    expect(dbMock.observationSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "source-1",
          status: { in: ["ACTIVE", "ERROR", "PAUSED", "REVOKED"] },
          program: expect.objectContaining({
            status: "ACTIVE",
            revokedAt: null,
          }),
        }),
        data: { status: "ACTIVE" },
      }),
    );
  });

  it("rolls back a connected receipt when observation-program revocation wins the source activation claim", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        version: 3,
      }),
    );
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-1",
        receiptType: "AUTHORIZATION",
        status: "AUTHORIZED",
      }),
    );
    dbMock.observationSource.findFirst.mockResolvedValue({
      id: "source-1",
      workspaceId: "workspace-1",
      catalogEntryId: "asset-1",
      accessMode: "READ_ONLY_API",
      secretRef: "secret-manager:crm-readonly",
      authorizationRef: "authorization:crm:readonly",
      status: "ACTIVE",
    });
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.observationSource.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      recordDataAssetConnectionReceipt({
        ...actorInput(),
        receiptId: "receipt-connection-1",
        idempotencyKey: "connection:crm:v1",
        expectedVersion: 3,
        connectionStatus: "connected",
        accessMode: "read_only_api",
        connectorRef: "connector:crm",
        secretRef: "secret-manager:crm-readonly",
        authorizationReceiptRef: "receipt-auth-1",
        observationSourceRef: "source-1",
        reasonCodes: [],
        evidenceRefs: ["evidence:connection:crm"],
      }),
    ).rejects.toMatchObject({
      reasons: ["observation_source_activation_claim_lost"],
    });
    expect(dbMock.dataAssetStageReceipt.create).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("stops bound sources and running observations when asset authorization is revoked", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        authorizationValidFrom: recordedAt,
        authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
        authorizationReceiptRef: "receipt-auth-1",
        connectionStatus: "CONNECTED",
        connectorRef: "connector:crm",
        connectionReceiptRef: "receipt-connection-1",
        initializationStatus: "INITIALIZED",
        initializationReceiptRef: "receipt-init-1",
        observationSourceRefs: JSON.stringify(["source-1"]),
        observationRunRefs: JSON.stringify(["run-1"]),
        version: 5,
      }),
    );
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.observationSource.updateMany.mockResolvedValue({ count: 1 });
    dbMock.observationSourceRun.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(
      stageReceipt({
        id: "receipt-auth-revoked-1",
        receiptType: "AUTHORIZATION",
        status: "REVOKED",
        expectedVersion: 5,
        resultingVersion: 6,
      }),
    );
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "REVOKED",
        connectionStatus: "REVOKED",
        connectorRef: "connector:crm",
        initializationStatus: "STALE",
        observationSourceRefs: JSON.stringify(["source-1"]),
        observationRunRefs: JSON.stringify(["run-1"]),
        authorizationReceiptRef: "receipt-auth-revoked-1",
        version: 6,
      }),
    );

    await recordDataAssetAuthorizationReceipt({
      ...actorInput(),
      receiptId: "receipt-auth-revoked-1",
      idempotencyKey: "authorization:crm:revoke:v1",
      expectedVersion: 5,
      authorizationStatus: "revoked",
      authorizationRef: null,
      scopeRefs: [],
      consentRefs: [],
      validFrom: null,
      validUntil: null,
      reasonCodes: ["owner_revoked"],
      evidenceRefs: ["evidence:authorization-revoked:crm"],
    });

    expect(dbMock.observationSource.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        catalogEntryId: "asset-1",
        status: "ACTIVE",
      },
      data: { status: "REVOKED" },
    });
    expect(dbMock.observationSourceRun.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        status: "RUNNING",
        source: { catalogEntryId: "asset-1" },
      },
      data: expect.objectContaining({
        status: "CANCELLED",
        outcome: "FAILURE",
        errorCodes: jsonStringify(["asset_authorization_revoked"]),
      }),
    });
  });

  it.each([
    ["blocked", "ERROR"],
    ["failed", "ERROR"],
    ["revoked", "REVOKED"],
  ] as const)(
    "stops bound sources and running observations when the connection is %s",
    async (connectionStatus, expectedSourceStatus) => {
      dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
        asset({
          classificationStatus: "CLASSIFIED",
          authorizationStatus: "AUTHORIZED",
          authorizationRef: "authorization:crm:readonly",
          authorizationValidFrom: recordedAt,
          authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
          authorizationReceiptRef: "receipt-auth-1",
          connectionStatus: "CONNECTED",
          connectorRef: "connector:crm",
          connectionReceiptRef: "receipt-connection-1",
          initializationStatus: "INITIALIZED",
          initializationReceiptRef: "receipt-init-1",
          observationSourceRefs: JSON.stringify(["source-1"]),
          observationRunRefs: JSON.stringify(["run-1"]),
          version: 5,
        }),
      );
      dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
      dbMock.observationSource.updateMany.mockResolvedValue({ count: 1 });
      dbMock.observationSourceRun.updateMany.mockResolvedValue({ count: 1 });
      dbMock.dataAssetStageReceipt.create.mockResolvedValue(
        stageReceipt({
          id: `receipt-connection-${connectionStatus}-1`,
          receiptType: "CONNECTION",
          status: connectionStatus.toUpperCase(),
          expectedVersion: 5,
          resultingVersion: 6,
        }),
      );
      dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
        asset({
          classificationStatus: "CLASSIFIED",
          authorizationStatus: "AUTHORIZED",
          authorizationRef: "authorization:crm:readonly",
          authorizationValidFrom: recordedAt,
          authorizationValidUntil: new Date("2026-08-23T01:00:00.000Z"),
          authorizationReceiptRef: "receipt-auth-1",
          connectionStatus: connectionStatus.toUpperCase(),
          connectorRef: "connector:crm",
          connectionReceiptRef: `receipt-connection-${connectionStatus}-1`,
          initializationStatus: "STALE",
          initializationReceiptRef: "receipt-init-1",
          observationSourceRefs: JSON.stringify(["source-1"]),
          observationRunRefs: JSON.stringify(["run-1"]),
          version: 6,
        }),
      );

      await recordDataAssetConnectionReceipt({
        ...actorInput(),
        receiptId: `receipt-connection-${connectionStatus}-1`,
        idempotencyKey: `connection:crm:${connectionStatus}:v1`,
        expectedVersion: 5,
        connectionStatus,
        accessMode: "read_only_api",
        connectorRef: "connector:crm",
        secretRef: "secret-manager:crm-readonly",
        authorizationReceiptRef: "receipt-auth-1",
        observationSourceRef: "source-1",
        reasonCodes: [`connection_${connectionStatus}`],
        evidenceRefs: [`evidence:connection-${connectionStatus}:crm`],
      });

      expect(dbMock.observationSource.updateMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "workspace-1",
          catalogEntryId: "asset-1",
          status: "ACTIVE",
        },
        data: { status: expectedSourceStatus },
      });
      expect(dbMock.observationSourceRun.updateMany).toHaveBeenCalledWith({
        where: {
          workspaceId: "workspace-1",
          status: "RUNNING",
          source: { catalogEntryId: "asset-1" },
        },
        data: expect.objectContaining({
          status: "CANCELLED",
          outcome: "FAILURE",
          errorCodes: jsonStringify([
            `asset_connection_${connectionStatus}`,
          ]),
        }),
      });
    },
  );

  it("accepts initialization only when every baseline run belongs to the asset", async () => {
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        authorizationRef: "authorization:crm:readonly",
        connectionStatus: "CONNECTED",
        connectorRef: "connector:crm",
        connectionReceiptRef: "receipt-connection-1",
        observationSourceRefs: JSON.stringify(["source-1"]),
        version: 4,
      }),
    );
    dbMock.observationSourceRun.findMany.mockResolvedValue([
      { id: "run-1" },
    ]);
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
    dbMock.dataAssetStageReceipt.create.mockResolvedValue(
      stageReceipt({
        receiptType: "INITIALIZATION",
        status: "INITIALIZED",
      }),
    );
    dbMock.dataAssetCatalogEntry.findUniqueOrThrow.mockResolvedValue(
      asset({
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        connectionStatus: "CONNECTED",
        connectorRef: "connector:crm",
        initializationStatus: "INITIALIZED",
        connectionReceiptRef: "receipt-connection-1",
        initializationReceiptRef: "receipt-init-1",
        observationSourceRefs: JSON.stringify(["source-1"]),
        observationRunRefs: JSON.stringify(["run-1"]),
        version: 5,
      }),
    );

    const result = await recordDataAssetInitializationReceipt({
      ...actorInput(),
      receiptId: "receipt-init-1",
      idempotencyKey: "initialization:crm:v1",
      expectedVersion: 4,
      initializationStatus: "initialized",
      connectionReceiptRef: "receipt-connection-1",
      observationRunRefs: ["run-1"],
      schemaMappingRefs: ["schema-map:crm:v1"],
      companyMemoryRefs: ["memory-bundle:crm:v1"],
      temporalContextSnapshotRef: "context:baseline:v1",
      reasonCodes: [],
      evidenceRefs: ["evidence:initialization:crm"],
    });

    expect(result.replayed).toBe(false);
    expect(dbMock.dataAssetCatalogEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          initializationStatus: "INITIALIZED",
          observationRunRefs: jsonStringify(["run-1"]),
        }),
      }),
    );
  });
});
