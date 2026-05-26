import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, permissionsMock, ownershipMock, dbMock, billingMock, auditMock } = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
  },
  permissionsMock: {
    canExportMemory: vi.fn(),
    getMemoryExportDeniedMessage: vi.fn(),
  },
  ownershipMock: {
    assertWorkspaceObjectOwnership: vi.fn(),
    assertWorkspaceOwnership: vi.fn(),
    isWorkspaceOwnershipError: vi.fn(),
  },
  dbMock: {
    memoryEntry: {
      findMany: vi.fn(),
    },
  },
  billingMock: {
    recordUsageLedgerEntry: vi.fn(),
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/memory/permissions", () => ({
  canExportMemory: permissionsMock.canExportMemory,
  getMemoryExportDeniedMessage: permissionsMock.getMemoryExportDeniedMessage,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceObjectOwnership: ownershipMock.assertWorkspaceObjectOwnership,
  assertWorkspaceOwnership: ownershipMock.assertWorkspaceOwnership,
  isWorkspaceOwnershipError: ownershipMock.isWorkspaceOwnershipError,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/billing/foundation", () => ({
  recordUsageLedgerEntry: billingMock.recordUsageLedgerEntry,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

import { GET as exportMemoryRoute } from "@/app/api/memory/export/route";

describe("memory export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    permissionsMock.getMemoryExportDeniedMessage.mockReturnValue("denied");
    ownershipMock.assertWorkspaceObjectOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceOwnership.mockResolvedValue(undefined);
    ownershipMock.isWorkspaceOwnershipError.mockImplementation(
      (error: unknown) => error instanceof Error && error.message === "workspace not found in active workspace",
    );
  });

  it("rejects export without memory export capability", async () => {
    permissionsMock.canExportMemory.mockReturnValue(false);

    const response = await exportMemoryRoute(new Request("http://localhost/api/memory/export"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "denied",
    });
    expect(dbMock.memoryEntry.findMany).not.toHaveBeenCalled();
    expect(billingMock.recordUsageLedgerEntry).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects workspace-scoped export when the filter points outside the active workspace", async () => {
    permissionsMock.canExportMemory.mockReturnValue(true);
    ownershipMock.assertWorkspaceOwnership.mockRejectedValue(new Error("workspace not found in active workspace"));

    const response = await exportMemoryRoute(
      new Request(
        "http://localhost/api/memory/export?objectType=WORKSPACE&objectId=workspace-2",
      ),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "workspace not found in active workspace",
    });
    expect(ownershipMock.assertWorkspaceOwnership).toHaveBeenCalledWith("workspace-1", "workspace-2");
    expect(dbMock.memoryEntry.findMany).not.toHaveBeenCalled();
  });

  it("exports tenant-scoped memory with private no-store headers", async () => {
    permissionsMock.canExportMemory.mockReturnValue(true);
    dbMock.memoryEntry.findMany.mockResolvedValue([
      {
        entityType: "MEETING",
        title: "Kickoff summary",
        content: "Owner aligned next steps",
      },
    ]);

    const response = await exportMemoryRoute(
      new Request(
        "http://localhost/api/memory/export?query=kickoff&dimension=MEETING&objectType=MEETING&objectId=meeting-1",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-disposition")).toContain("helm-memory-summary.txt");
    await expect(response.text()).resolves.toContain("Kickoff summary");
    expect(ownershipMock.assertWorkspaceObjectOwnership).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      objectType: "MEETING",
      objectId: "meeting-1",
    });
    expect(billingMock.recordUsageLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        metadata: expect.objectContaining({
          query: "kickoff",
          dimension: "MEETING",
          objectType: "MEETING",
          objectId: "meeting-1",
          exportedCount: 1,
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        actionType: "MEMORY_SUMMARY_EXPORTED",
      }),
    );
  });

  it("excludes legacy OpenClaw entries from default ALL exports", async () => {
    permissionsMock.canExportMemory.mockReturnValue(true);
    dbMock.memoryEntry.findMany.mockResolvedValue([]);

    const response = await exportMemoryRoute(new Request("http://localhost/api/memory/export"));

    expect(response.status).toBe(200);
    expect(dbMock.memoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          deletedAt: null,
          NOT: { source: { startsWith: "OPENCLAW:" } },
        }),
      }),
    );
  });

  it("exports OpenClaw entries only when source is explicit", async () => {
    permissionsMock.canExportMemory.mockReturnValue(true);
    dbMock.memoryEntry.findMany.mockResolvedValue([]);

    const response = await exportMemoryRoute(
      new Request("http://localhost/api/memory/export?source=OPENCLAW"),
    );

    expect(response.status).toBe(200);
    expect(dbMock.memoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          deletedAt: null,
          source: { startsWith: "OPENCLAW:" },
        }),
      }),
    );
  });
});
