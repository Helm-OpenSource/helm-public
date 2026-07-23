import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock, serviceGovernanceMock } = vi.hoisted(() => {
  const client = {
    enterpriseObservationProgram: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    dataAssetCatalogEntry: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    dataAssetStageReceipt: {
      findFirst: vi.fn(),
    },
    observationSource: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    observationSourceRun: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
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
  beginObservationSourceRun,
  completeObservationSourceRun,
  createEnterpriseObservationProgram,
  registerObservationSource,
  revokeEnterpriseObservationProgram,
} from "./observation.service";

const startsAt = new Date("2026-07-01T00:00:00.000Z");
const expiresAt = new Date("2026-08-01T00:00:00.000Z");
const now = new Date("2026-07-18T00:00:00.000Z");

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: "program-1",
    workspaceId: "workspace-1",
    purpose: "Observe operating facts for owner decisions",
    scopeRefs: JSON.stringify(["scope:company"]),
    dataCategories: JSON.stringify(["operations"]),
    startsAt,
    expiresAt,
    retentionDays: 30,
    authorizationRef: "authorization:owner-1",
    status: "ACTIVE",
    authorizationVersion: 1,
    runSequence: 0,
    revokedAt: null,
    revokedByRef: null,
    revocationReason: null,
    auditRefs: null,
    createdAt: startsAt,
    updatedAt: startsAt,
    ...overrides,
  };
}

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    workspaceId: "workspace-1",
    programId: "program-1",
    catalogEntryId: "asset-1",
    sourceKey: "crm-readonly",
    sourceKind: "crm",
    accessMode: "READ_ONLY_API",
    ownerRef: "owner-1",
    freshnessSlaMinutes: 60,
    sensitivity: "CONFIDENTIAL",
    authorizationRef: "authorization:owner-1",
    secretRef: "secret-manager:crm-readonly",
    retentionDays: 30,
    status: "ACTIVE",
    lastObservedAt: null,
    createdAt: startsAt,
    updatedAt: startsAt,
    catalogEntry: catalogAsset(),
    compatibilityReceipt: null,
    ...overrides,
  };
}

function catalogAsset(overrides: Record<string, unknown> = {}) {
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
    sensitivity: "CONFIDENTIAL",
    processingDisposition: "LOCAL_ONLY",
    inventoryStatus: "INVENTORIED",
    classificationStatus: "CLASSIFIED",
    authorizationStatus: "AUTHORIZED",
    connectionStatus: "CONNECTED",
    initializationStatus: "NOT_STARTED",
    purpose: "Observe operating facts for owner decisions",
    scopeRefs: JSON.stringify(["scope:company"]),
    authorizationRef: "authorization:owner-1",
    authorizationValidFrom: startsAt,
    authorizationValidUntil: expiresAt,
    consentRefs: JSON.stringify([]),
    recommendedAccessMode: "READ_ONLY_API",
    connectorRef: "connector:crm",
    retentionDays: 30,
    freshnessSlaMinutes: 60,
    residencyRequirements: JSON.stringify(["region:cn"]),
    blindSpots: JSON.stringify([]),
    blockerCodes: JSON.stringify([]),
    riskOwnerRef: "role:security",
    nextReviewAt: expiresAt,
    observationSourceRefs: JSON.stringify(["source-1"]),
    observationRunRefs: JSON.stringify([]),
    evidenceRefs: JSON.stringify(["evidence:asset"]),
    classificationReceiptRef: "receipt-classification-1",
    authorizationReceiptRef: "receipt-authorization-1",
    connectionReceiptRef: "receipt-connection-1",
    initializationReceiptRef: null,
    version: 4,
    createdAt: startsAt,
    updatedAt: startsAt,
    ...overrides,
  };
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    programId: "program-1",
    sourceId: "source-1",
    executionKey: "execution-1",
    authorizationVersion: 1,
    windowStart: new Date("2026-07-17T00:00:00.000Z"),
    windowEnd: new Date("2026-07-18T00:00:00.000Z"),
    status: "RUNNING",
    observedAt: null,
    summaryHash: null,
    completenessPercent: null,
    freshness: "UNKNOWN",
    outcome: "UNKNOWN",
    evidenceRefs: null,
    errorCodes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Stage 1 observation runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      (callback: (tx: typeof dbMock) => unknown) => callback(dbMock),
    );
    dbMock.$queryRaw.mockResolvedValue([{ id: "locked-row" }]);
    serviceGovernanceMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
      undefined,
    );
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue({
      id: "receipt-current",
    });
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 1 });
  });

  it("commits owner authorization and its audit through the same transaction client", async () => {
    dbMock.enterpriseObservationProgram.create.mockResolvedValue(program());

    await createEnterpriseObservationProgram({
      workspaceId: "workspace-1",
      purpose: "Observe operating facts for owner decisions",
      scopeRefs: ["scope:company"],
      dataCategories: ["operations"],
      startsAt,
      expiresAt,
      retentionDays: 30,
      authorizationRef: "authorization:owner-1",
      actorName: "Owner",
      actorUserId: "owner-1",
    });

    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: ActorType.USER,
        actionType: "ENTERPRISE_OBSERVATION_AUTHORIZED",
        targetId: "program-1",
      }),
      { client: dbMock },
    );
  });

  it("propagates an authorization audit failure instead of accepting an unaudited grant", async () => {
    dbMock.enterpriseObservationProgram.create.mockResolvedValue(program());
    auditMock.writeAuditLog.mockRejectedValueOnce(
      new Error("audit unavailable"),
    );

    await expect(
      createEnterpriseObservationProgram({
        workspaceId: "workspace-1",
        purpose: "Observe operating facts for owner decisions",
        scopeRefs: ["scope:company"],
        dataCategories: ["operations"],
        startsAt,
        expiresAt,
        retentionDays: 30,
        authorizationRef: "authorization:owner-1",
        actorName: "Owner",
        actorUserId: "owner-1",
      }),
    ).rejects.toThrow("audit unavailable");

    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(expect.any(Object), {
      client: dbMock,
    });
  });

  it("returns an existing execution without re-claiming authorization", async () => {
    const existing = run({ status: "SUCCEEDED", outcome: "SUCCESS" });
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source(),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(existing);

    const result = await beginObservationSourceRun({
      workspaceId: "workspace-1",
      sourceKey: "crm-readonly",
      executionKey: "execution-1",
      windowStart: existing.windowStart,
      windowEnd: existing.windowEnd,
      now,
    });

    expect(result).toBe(existing);
    expect(
      dbMock.enterpriseObservationProgram.updateMany,
    ).not.toHaveBeenCalled();
    expect(dbMock.observationSourceRun.create).not.toHaveBeenCalled();
  });

  it("normalizes the source and execution keys before the idempotency lookup", async () => {
    const existing = run({ status: "SUCCEEDED", outcome: "SUCCESS" });
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source(),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(existing);

    const result = await beginObservationSourceRun({
      workspaceId: "workspace-1",
      sourceKey: "  crm-readonly  ",
      executionKey: "  execution-1  ",
      windowStart: existing.windowStart,
      windowEnd: existing.windowEnd,
      now,
    });

    expect(result).toBe(existing);
    expect(dbMock.observationSource.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_sourceKey: {
          workspaceId: "workspace-1",
          sourceKey: "crm-readonly",
        },
      },
      include: {
        program: true,
        catalogEntry: true,
        compatibilityReceipt: true,
      },
    });
    expect(dbMock.observationSourceRun.findUnique).toHaveBeenCalledWith({
      where: {
        sourceId_executionKey: {
          sourceId: "source-1",
          executionKey: "execution-1",
        },
      },
    });
  });

  it("fails source registration when revocation wins the transactional active-program claim", async () => {
    dbMock.enterpriseObservationProgram.findFirst.mockResolvedValue(program());
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      catalogAsset({ connectionStatus: "NOT_STARTED", connectorRef: null }),
    );
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      registerObservationSource({
        workspaceId: "workspace-1",
        programId: "program-1",
        catalogEntryId: "asset-1",
        sourceKey: "crm-readonly",
        sourceKind: "crm",
        accessMode: "read_only_api",
        ownerRef: "owner-1",
        freshnessSlaMinutes: 60,
        sensitivity: "confidential",
        authorizationRef: "authorization:owner-1",
        secretRef: "secret-manager:crm-readonly",
        retentionDays: 30,
        actorName: "Owner",
        actorUserId: "owner-1",
      }),
    ).rejects.toMatchObject({ reasons: ["program_not_active"] });

    expect(dbMock.observationSource.create).not.toHaveBeenCalled();
  });

  it("fails source registration when the current authorization receipt row is missing", async () => {
    dbMock.enterpriseObservationProgram.findFirst.mockResolvedValue(program());
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      catalogAsset({ connectionStatus: "NOT_STARTED", connectorRef: null }),
    );
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValue(null);
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 1,
    });
    dbMock.observationSource.create.mockResolvedValue(source());

    await expect(
      registerObservationSource({
        workspaceId: "workspace-1",
        programId: "program-1",
        catalogEntryId: "asset-1",
        sourceKey: "crm-readonly",
        sourceKind: "crm",
        accessMode: "read_only_api",
        ownerRef: "owner-1",
        freshnessSlaMinutes: 60,
        sensitivity: "confidential",
        authorizationRef: "authorization:owner-1",
        secretRef: "secret-manager:crm-readonly",
        retentionDays: 30,
        actorName: "Owner",
        actorUserId: "owner-1",
        now,
      }),
    ).rejects.toMatchObject({
      reasons: ["catalog_asset_authorization_receipt_missing"],
    });
    expect(dbMock.observationSource.create).not.toHaveBeenCalled();
  });

  it("fails source registration when an asset transition wins the atomic claim", async () => {
    dbMock.enterpriseObservationProgram.findFirst.mockResolvedValue(program());
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      catalogAsset({ connectionStatus: "NOT_STARTED", connectorRef: null }),
    );
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      registerObservationSource({
        workspaceId: "workspace-1",
        programId: "program-1",
        catalogEntryId: "asset-1",
        sourceKey: "crm-readonly",
        sourceKind: "crm",
        accessMode: "read_only_api",
        ownerRef: "owner-1",
        freshnessSlaMinutes: 60,
        sensitivity: "confidential",
        authorizationRef: "authorization:owner-1",
        secretRef: "secret-manager:crm-readonly",
        retentionDays: 30,
        actorName: "Owner",
        actorUserId: "owner-1",
        now,
      }),
    ).rejects.toMatchObject({ reasons: ["catalog_asset_claim_lost"] });

    expect(
      dbMock.enterpriseObservationProgram.updateMany,
    ).not.toHaveBeenCalled();
    expect(dbMock.observationSource.create).not.toHaveBeenCalled();
  });

  it("registers a catalog-bound source without copying its managed secret reference into the audit payload", async () => {
    dbMock.enterpriseObservationProgram.findFirst.mockResolvedValue(program());
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      catalogAsset({ connectionStatus: "NOT_STARTED", connectorRef: null }),
    );
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 1,
    });
    dbMock.observationSource.create.mockResolvedValue(source());

    await registerObservationSource({
      workspaceId: "workspace-1",
      programId: "program-1",
      catalogEntryId: "asset-1",
      sourceKey: "crm-readonly",
      sourceKind: "crm",
      accessMode: "read_only_api",
      ownerRef: "owner-1",
      freshnessSlaMinutes: 60,
      sensitivity: "confidential",
      authorizationRef: "authorization:owner-1",
      secretRef: "secret-manager:crm-readonly",
      retentionDays: 30,
      actorName: "Owner",
      actorUserId: "owner-1",
      now,
    });

    const [auditInput] = auditMock.writeAuditLog.mock.calls.at(-1) ?? [];
    expect(auditInput.payload).toEqual(
      expect.objectContaining({
        sourceKey: "crm-readonly",
        catalogEntryId: "asset-1",
        secretRefPresent: true,
      }),
    );
    expect(auditInput.payload).not.toHaveProperty("secretRef");
    expect(dbMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(
      dbMock.$queryRaw.mock.invocationCallOrder[1],
    ).toBeLessThan(
      dbMock.enterpriseObservationProgram.findFirst.mock
        .invocationCallOrder[0],
    );
    expect(
      dbMock.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dbMock.dataAssetCatalogEntry.findFirst.mock.invocationCallOrder[0],
    );
  });

  it("fails source registration when the catalog authorization has expired", async () => {
    dbMock.enterpriseObservationProgram.findFirst.mockResolvedValue(program());
    dbMock.dataAssetCatalogEntry.findFirst.mockResolvedValue(
      catalogAsset({
        connectionStatus: "NOT_STARTED",
        connectorRef: null,
        authorizationValidUntil: new Date("2026-07-17T00:00:00.000Z"),
      }),
    );

    await expect(
      registerObservationSource({
        workspaceId: "workspace-1",
        programId: "program-1",
        catalogEntryId: "asset-1",
        sourceKey: "crm-readonly",
        sourceKind: "crm",
        accessMode: "read_only_api",
        ownerRef: "owner-1",
        freshnessSlaMinutes: 60,
        sensitivity: "confidential",
        authorizationRef: "authorization:owner-1",
        secretRef: "secret-manager:crm-readonly",
        retentionDays: 30,
        actorName: "Owner",
        actorUserId: "owner-1",
        now,
      }),
    ).rejects.toMatchObject({
      reasons: ["asset_authorization_window_inactive"],
    });

    expect(dbMock.observationSource.create).not.toHaveBeenCalled();
  });

  it("fails closed when revocation wins the atomic authorization claim", async () => {
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source(),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(null);
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      beginObservationSourceRun({
        workspaceId: "workspace-1",
        sourceKey: "crm-readonly",
        executionKey: "execution-1",
        windowStart: new Date("2026-07-17T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({ reasons: ["authorization_claim_lost"] });

    expect(dbMock.observationSourceRun.create).not.toHaveBeenCalled();
    expect(dbMock.$queryRaw).toHaveBeenCalledTimes(3);
    expect(
      dbMock.$queryRaw.mock.invocationCallOrder[2],
    ).toBeLessThan(
      dbMock.observationSource.findUnique.mock.invocationCallOrder[1],
    );
  });

  it("fails closed when an asset transition wins the atomic observation claim", async () => {
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source(),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(null);
    dbMock.dataAssetCatalogEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      beginObservationSourceRun({
        workspaceId: "workspace-1",
        sourceKey: "crm-readonly",
        executionKey: "asset-transition-won",
        windowStart: new Date("2026-07-17T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({ reasons: ["catalog_asset_claim_lost"] });

    expect(
      dbMock.enterpriseObservationProgram.updateMany,
    ).not.toHaveBeenCalled();
    expect(dbMock.observationSourceRun.create).not.toHaveBeenCalled();
  });

  it("fails closed when a catalog-bound source is no longer connected", async () => {
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source({
        catalogEntry: catalogAsset({
          connectionStatus: "REVOKED",
          connectorRef: null,
        }),
      }),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(null);

    await expect(
      beginObservationSourceRun({
        workspaceId: "workspace-1",
        sourceKey: "crm-readonly",
        executionKey: "execution-2",
        windowStart: new Date("2026-07-17T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({
      reasons: ["catalog_asset_not_connected"],
    });

    expect(
      dbMock.enterpriseObservationProgram.updateMany,
    ).not.toHaveBeenCalled();
    expect(dbMock.observationSourceRun.create).not.toHaveBeenCalled();
  });

  it("fails closed when the catalog connection receipt row is missing", async () => {
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source(),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(null);
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValueOnce({
      id: "receipt-authorization-1",
    });
    dbMock.dataAssetStageReceipt.findFirst.mockResolvedValueOnce(null);
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 1,
    });
    dbMock.observationSourceRun.create.mockResolvedValue(
      run({ executionKey: "missing-connection-receipt" }),
    );

    await expect(
      beginObservationSourceRun({
        workspaceId: "workspace-1",
        sourceKey: "crm-readonly",
        executionKey: "missing-connection-receipt",
        windowStart: new Date("2026-07-17T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({
      reasons: ["catalog_asset_connection_receipt_missing"],
    });
    expect(
      dbMock.enterpriseObservationProgram.updateMany,
    ).not.toHaveBeenCalled();
    expect(dbMock.observationSourceRun.create).not.toHaveBeenCalled();
  });

  it("allows a pre-catalog source only through an unexpired compatibility receipt", async () => {
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source({
        catalogEntryId: null,
        catalogEntry: null,
        compatibilityReceipt: {
          id: "compat-1",
          workspaceId: "workspace-1",
          observationSourceId: "source-1",
          migrationRef: "migration:20260723120000_caio_data_asset_catalog",
          capturedAt: startsAt,
          actorRef: "migration:caio-data-asset-catalog",
          evidenceRefs: JSON.stringify([
            "evidence:migration:pre-catalog-source-snapshot",
          ]),
          nextReviewAt: expiresAt,
          sourceFingerprint:
            "sha256:a9da46f8bf0b83f0382806bac6504aa17a73310e3f8ef7e6e27fe1a2049337c9",
          restrictions: JSON.stringify([
            "read_only_only",
            "no_capability_expansion",
            "catalog_backfill_required",
          ]),
          createdAt: startsAt,
        },
      }),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(null);
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 1,
    });
    dbMock.observationSourceRun.create.mockResolvedValue(
      run({ executionKey: "legacy-window" }),
    );

    const result = await beginObservationSourceRun({
      workspaceId: "workspace-1",
      sourceKey: "crm-readonly",
      executionKey: "legacy-window",
      windowStart: new Date("2026-07-17T00:00:00.000Z"),
      windowEnd: new Date("2026-07-18T00:00:00.000Z"),
      now,
    });

    expect(result.executionKey).toBe("legacy-window");
  });

  it("blocks a pre-catalog source after its compatibility review deadline", async () => {
    dbMock.observationSource.findUnique.mockResolvedValue({
      ...source({
        catalogEntryId: null,
        catalogEntry: null,
        compatibilityReceipt: {
          id: "compat-1",
          workspaceId: "workspace-1",
          observationSourceId: "source-1",
          migrationRef: "migration:20260723120000_caio_data_asset_catalog",
          capturedAt: startsAt,
          actorRef: "migration:caio-data-asset-catalog",
          evidenceRefs: JSON.stringify([
            "evidence:migration:pre-catalog-source-snapshot",
          ]),
          nextReviewAt: new Date("2026-07-17T00:00:00.000Z"),
          sourceFingerprint:
            "sha256:a9da46f8bf0b83f0382806bac6504aa17a73310e3f8ef7e6e27fe1a2049337c9",
          restrictions: JSON.stringify([
            "read_only_only",
            "no_capability_expansion",
            "catalog_backfill_required",
          ]),
          createdAt: startsAt,
        },
      }),
      program: program(),
    });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(null);

    await expect(
      beginObservationSourceRun({
        workspaceId: "workspace-1",
        sourceKey: "crm-readonly",
        executionKey: "legacy-window",
        windowStart: new Date("2026-07-17T00:00:00.000Z"),
        windowEnd: new Date("2026-07-18T00:00:00.000Z"),
        now,
      }),
    ).rejects.toMatchObject({
      reasons: ["legacy_source_compatibility_review_overdue"],
    });
  });

  it("revokes active sources and runs once without duplicating the audit", async () => {
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    dbMock.enterpriseObservationProgram.findFirst.mockResolvedValue(
      program({
        status: "REVOKED",
        revokedAt: now,
        revokedByRef: "owner-1",
        revocationReason: "Scope withdrawn",
      }),
    );
    dbMock.observationSource.updateMany.mockResolvedValue({ count: 1 });
    dbMock.observationSourceRun.updateMany.mockResolvedValue({ count: 1 });

    const input = {
      workspaceId: "workspace-1",
      programId: "program-1",
      reason: "Scope withdrawn",
      actorName: "Owner",
      actorUserId: "owner-1",
    };
    await revokeEnterpriseObservationProgram(input);

    expect(
      dbMock.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dbMock.enterpriseObservationProgram.updateMany.mock
        .invocationCallOrder[0],
    );
    expect(dbMock.observationSource.updateMany).toHaveBeenCalledTimes(1);
    expect(dbMock.observationSourceRun.updateMany).toHaveBeenCalledTimes(1);
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);

    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    await revokeEnterpriseObservationProgram(input);

    expect(dbMock.observationSource.updateMany).toHaveBeenCalledTimes(1);
    expect(dbMock.observationSourceRun.updateMany).toHaveBeenCalledTimes(1);
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("keeps a terminal source receipt immutable and does not emit a second audit", async () => {
    const running = run();
    const completed = run({
      status: "SUCCEEDED",
      observedAt: now,
      summaryHash: "sha256:summary",
      completenessPercent: 100,
      freshness: "FRESH",
      outcome: "SUCCESS",
      evidenceRefs: JSON.stringify(["evidence:crm-snapshot"]),
    });
    dbMock.observationSourceRun.findFirst.mockResolvedValue(running);
    dbMock.observationSourceRun.updateMany.mockResolvedValueOnce({ count: 1 });
    dbMock.observationSource.updateMany.mockResolvedValue({ count: 1 });
    dbMock.observationSourceRun.findUniqueOrThrow.mockResolvedValue(completed);

    const input = {
      workspaceId: "workspace-1",
      runId: "run-1",
      observedAt: now,
      summaryHash: "sha256:summary",
      completenessPercent: 100,
      freshness: "fresh" as const,
      outcome: "success" as const,
      evidenceRefs: ["evidence:crm-snapshot"],
      errorCodes: [],
    };
    const first = await completeObservationSourceRun(input);
    expect(first).toBe(completed);
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);

    dbMock.observationSourceRun.updateMany.mockResolvedValueOnce({ count: 0 });
    dbMock.observationSourceRun.findUnique.mockResolvedValue(completed);
    const second = await completeObservationSourceRun(input);

    expect(second).toBe(completed);
    expect(dbMock.observationSource.updateMany).toHaveBeenCalledTimes(1);
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);
  });
});
