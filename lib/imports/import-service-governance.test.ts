import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceImportServiceAccess: vi.fn(),
  },
  dbMock: {
    company: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    membership: {
      findMany: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    opportunity: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    meeting: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    memoryEntry: {
      create: vi.fn(),
    },
    meetingNote: {
      create: vi.fn(),
    },
    actionItem: {
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

import { runCsvImport } from "@/lib/imports";

describe("csv import service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks workspace import capability before any csv import write runs", async () => {
    serviceGovernanceMock.assertWorkspaceImportServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can run workspace imports."),
    );

    await expect(
      runCsvImport({
        type: "contacts",
        csvText: "姓名,邮箱\n张三,test@example.com",
        mapping: {
          name: "姓名",
          email: "邮箱",
        },
        workspaceId: "workspace-1",
        userId: "user-1",
        actorName: "Owner",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, or operator can run workspace imports.");

    expect(serviceGovernanceMock.assertWorkspaceImportServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.company.findFirst).not.toHaveBeenCalled();
    expect(dbMock.contact.create).not.toHaveBeenCalled();
  });
});
