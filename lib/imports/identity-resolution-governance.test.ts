import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceImportServiceAccess: vi.fn(),
  },
  dbMock: {
    company: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    identityMatch: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceImportServiceAccess: serviceGovernanceMock.assertWorkspaceImportServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  recordIdentityMatch,
  resolveCompanyIdentity,
} from "@/lib/imports/identity-resolution.service";

describe("identity resolution service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.company.findFirst.mockResolvedValue(null);
    dbMock.company.findMany.mockResolvedValue([]);
    dbMock.identityMatch.create.mockResolvedValue({ id: "match-1" });
  });

  it("re-checks workspace import capability before identity-resolution reads", async () => {
    serviceGovernanceMock.assertWorkspaceImportServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can run workspace imports."),
    );

    await expect(
      resolveCompanyIdentity({
        workspaceId: "workspace-1",
        sourceType: "HUBSPOT",
        company: {
          sourceType: "HUBSPOT",
          externalId: "external-company-1",
          name: "Acme",
          raw: {},
        },
        governance: {
          userId: "user-1",
          actorType: ActorType.USER,
          english: true,
        },
      }),
    ).rejects.toThrow("Only owner, admin, or operator can run workspace imports.");

    expect(serviceGovernanceMock.assertWorkspaceImportServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.company.findFirst).not.toHaveBeenCalled();
  });

  it("continues identity resolution after a successful import governance re-check", async () => {
    dbMock.company.findFirst.mockResolvedValueOnce({ id: "company-1" });

    await expect(
      resolveCompanyIdentity({
        workspaceId: "workspace-1",
        sourceType: "HUBSPOT",
        company: {
          sourceType: "HUBSPOT",
          externalId: "external-company-1",
          name: "Acme",
          raw: {},
        },
        governance: {
          userId: "user-1",
          actorType: ActorType.USER,
          english: false,
        },
      }),
    ).resolves.toMatchObject({
      status: "EXACT",
      internalObjectId: "company-1",
    });

    expect(serviceGovernanceMock.assertWorkspaceImportServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: false,
    });
    expect(dbMock.company.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        externalSource: "HUBSPOT",
        externalObjectId: "external-company-1",
      },
      select: { id: true },
    });
  });

  it("re-checks workspace import capability before identity-match writes", async () => {
    serviceGovernanceMock.assertWorkspaceImportServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can run workspace imports."),
    );

    await expect(
      recordIdentityMatch({
        workspaceId: "workspace-1",
        sourceId: "source-1",
        importItemId: "item-1",
        externalType: "CONTACT",
        externalId: "external-1",
        internalObjectType: "Contact",
        internalObjectId: "contact-1",
        reason: "matched by email",
        score: 96,
        status: "AUTO_LINKED",
        governance: {
          userId: "user-1",
          actorType: ActorType.USER,
          english: true,
        },
      }),
    ).rejects.toThrow("Only owner, admin, or operator can run workspace imports.");

    expect(serviceGovernanceMock.assertWorkspaceImportServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.identityMatch.create).not.toHaveBeenCalled();
  });

  it("bypasses import governance re-check for system-initiated identity-match writes", async () => {
    await recordIdentityMatch({
      workspaceId: "workspace-1",
      sourceId: "source-1",
      importItemId: "item-1",
      externalType: "CONTACT",
      externalId: "external-1",
      internalObjectType: "Contact",
      internalObjectId: "contact-1",
      reason: "matched by email",
      score: 96,
      status: "AUTO_LINKED",
      governance: {
        actorType: ActorType.SYSTEM,
        english: false,
      },
    });

    expect(serviceGovernanceMock.assertWorkspaceImportServiceAccess).not.toHaveBeenCalled();
    expect(dbMock.identityMatch.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        sourceId: "source-1",
        importItemId: "item-1",
        externalType: "CONTACT",
        externalId: "external-1",
        internalObjectType: "Contact",
        internalObjectId: "contact-1",
        matchScore: 96,
        matchReason: "matched by email",
        status: "AUTO_LINKED",
      },
    });
  });
});
