import { ImportSourceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    identityMatch: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    importItem: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    company: { create: vi.fn().mockResolvedValue({ id: "co-new" }) },
    contact: { create: vi.fn().mockResolvedValue({ id: "ct-new" }) },
    opportunity: { create: vi.fn().mockResolvedValue({ id: "op-new" }) },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceImportServiceAccess: vi.fn(),
  assertWorkspaceImportConflictServiceAccess: vi.fn(),
}));
vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceImportConflictOwnership: vi.fn(),
  assertWorkspaceImportItemOwnership: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));

import { resolveImportConflict } from "@/lib/imports/crm-orchestrator.service";

describe("resolveImportConflict CREATE_NEW external identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.company.create.mockResolvedValue({ id: "co-new" });
    dbMock.identityMatch.findFirst.mockResolvedValue({
      id: "match-1",
      workspaceId: "ws-1",
      importItemId: "item-1",
      internalObjectType: "Company",
      internalObjectId: "co-existing",
    });
    dbMock.importItem.findFirst.mockResolvedValue({
      id: "item-1",
      workspaceId: "ws-1",
      externalType: "COMPANY",
      externalId: "hub-company-acme",
      normalizedPayload: JSON.stringify({ name: "Acme", website: "acme.io" }),
      importJob: { source: { sourceType: ImportSourceType.HUBSPOT } },
    });
  });

  it("persists externalSource/type/id so the next sync resolves instead of duplicating", async () => {
    const result = await resolveImportConflict({
      workspaceId: "ws-1",
      identityMatchId: "match-1",
      resolution: "CREATE_NEW",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    const createData = dbMock.company.create.mock.calls[0]?.[0]?.data;
    expect(createData.externalSource).toBe(ImportSourceType.HUBSPOT);
    expect(createData.externalObjectType).toBe("COMPANY");
    expect(createData.externalObjectId).toBe("hub-company-acme");
  });
});
