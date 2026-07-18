import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock, serviceGovernanceMock } = vi.hoisted(() => {
  const client = {
    enterpriseObservationProgram: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
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
    serviceGovernanceMock.assertWorkspacePolicyServiceAccess.mockResolvedValue(
      undefined,
    );
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
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
      include: { program: true },
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
    dbMock.enterpriseObservationProgram.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      registerObservationSource({
        workspaceId: "workspace-1",
        programId: "program-1",
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
