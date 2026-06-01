import { ImportJobType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceImportServiceAccess: vi.fn(),
    assertWorkspaceImportConflictServiceAccess: vi.fn(),
  },
}));

const { ownershipMock, dbMock } = vi.hoisted(() => ({
  ownershipMock: {
    assertWorkspaceImportConflictOwnership: vi.fn(),
    assertWorkspaceImportItemOwnership: vi.fn(),
  },
  dbMock: {
    identityMatch: {
      findFirst: vi.fn(),
    },
    importItem: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceImportServiceAccess: serviceGovernanceMock.assertWorkspaceImportServiceAccess,
  assertWorkspaceImportConflictServiceAccess:
    serviceGovernanceMock.assertWorkspaceImportConflictServiceAccess,
}));

vi.mock("@/lib/auth/tenant-ownership", () => ({
  assertWorkspaceImportConflictOwnership: ownershipMock.assertWorkspaceImportConflictOwnership,
  assertWorkspaceImportItemOwnership: ownershipMock.assertWorkspaceImportItemOwnership,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { resolveImportConflict, runCrmImport } from "@/lib/imports/crm-orchestrator.service";

describe("crm orchestrator service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownershipMock.assertWorkspaceImportConflictOwnership.mockResolvedValue(undefined);
    ownershipMock.assertWorkspaceImportItemOwnership.mockResolvedValue(undefined);
  });

  it("re-checks workspace import capability before running crm import orchestration", async () => {
    serviceGovernanceMock.assertWorkspaceImportServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can run workspace imports."),
    );

    await expect(
      runCrmImport({
        workspaceId: "workspace-1",
        userId: "user-1",
        source: {
          id: "source-1",
          sourceType: "HUBSPOT",
          accountLabel: "HubSpot",
          workspaceId: "workspace-1",
        } as never,
        dataset: {
          sourceType: "HUBSPOT",
          accountLabel: "HubSpot",
          owners: [],
          contacts: [],
          companies: [],
          opportunities: [],
          meetings: [],
          notes: [],
          tasks: [],
          associations: [],
          usedMock: false,
        },
        jobType: ImportJobType.INITIAL_IMPORT,
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, or operator can run workspace imports.");

    expect(serviceGovernanceMock.assertWorkspaceImportServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
  });

  it("re-checks import conflict capability before resolving a conflict", async () => {
    serviceGovernanceMock.assertWorkspaceImportConflictServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, operator, or reviewer can resolve import conflicts."),
    );

    await expect(
      resolveImportConflict({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Reviewer",
        identityMatchId: "match-1",
        resolution: "LINK",
        english: true,
      }),
    ).rejects.toThrow(
      "Only owner, admin, operator, or reviewer can resolve import conflicts.",
    );

    expect(serviceGovernanceMock.assertWorkspaceImportConflictServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: "USER",
      english: true,
    });
  });

  it("re-checks import conflict ownership inside the service before follow-up writes", async () => {
    ownershipMock.assertWorkspaceImportConflictOwnership.mockRejectedValueOnce(
      new Error("Import conflict does not belong to this workspace."),
    );

    await expect(
      resolveImportConflict({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Reviewer",
        identityMatchId: "match-1",
        resolution: "LINK",
        english: true,
      }),
    ).rejects.toThrow("Import conflict does not belong to this workspace.");

    expect(ownershipMock.assertWorkspaceImportConflictOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "match-1",
    );
    expect(dbMock.identityMatch.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks import item ownership before conflict follow-up uses normalized payload", async () => {
    dbMock.identityMatch.findFirst.mockResolvedValueOnce({
      id: "match-1",
      workspaceId: "workspace-1",
      importItemId: "item-1",
      internalObjectId: "contact-1",
      internalObjectType: "Contact",
    });
    ownershipMock.assertWorkspaceImportItemOwnership.mockRejectedValueOnce(
      new Error("Import item does not belong to this workspace."),
    );

    await expect(
      resolveImportConflict({
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Reviewer",
        identityMatchId: "match-1",
        resolution: "LINK",
        english: true,
      }),
    ).rejects.toThrow("Import item does not belong to this workspace.");

    expect(ownershipMock.assertWorkspaceImportConflictOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "match-1",
    );
    expect(dbMock.identityMatch.findFirst).toHaveBeenCalledWith({
      where: {
        id: "match-1",
        workspaceId: "workspace-1",
      },
    });
    expect(ownershipMock.assertWorkspaceImportItemOwnership).toHaveBeenCalledWith(
      "workspace-1",
      "item-1",
    );
    expect(dbMock.importItem.findFirst).not.toHaveBeenCalled();
  });
});
