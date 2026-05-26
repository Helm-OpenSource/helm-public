import { ActorType, MemoryCorrectionType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, dbMock, evolutionDeltaMock, evolutionPatternMock, sharedMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceMemoryServiceAccess: vi.fn(),
  },
  dbMock: {
    memoryFact: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memoryCorrection: {
      create: vi.fn(),
    },
    briefingSnapshot: {
      updateMany: vi.fn(),
    },
  },
  evolutionDeltaMock: {
    recordMemoryCorrectionDelta: vi.fn(),
  },
  evolutionPatternMock: {
    refreshEvolutionState: vi.fn(),
  },
  sharedMock: {
    writeMemoryAuditAndEvent: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceMemoryServiceAccess: serviceGovernanceMock.assertWorkspaceMemoryServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/evolution/delta-event.service", () => ({
  recordMemoryCorrectionDelta: evolutionDeltaMock.recordMemoryCorrectionDelta,
}));

vi.mock("@/lib/evolution/pattern-detection.service", () => ({
  refreshEvolutionState: evolutionPatternMock.refreshEvolutionState,
}));

vi.mock("@/lib/memory/shared", async () => {
  const actual = await vi.importActual<typeof import("@/lib/memory/shared")>("@/lib/memory/shared");
  return {
    ...actual,
    writeMemoryAuditAndEvent: sharedMock.writeMemoryAuditAndEvent,
  };
});

import {
  confirmMemoryFact,
  correctMemoryFact,
  deleteMemoryFact,
  invalidateMemoryFact,
} from "@/lib/memory/correction.service";

describe("memory correction service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks memory governance before confirming a fact", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, reviewer or operator can manage workspace memory facts."),
    );

    await expect(
      confirmMemoryFact({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        memoryFactId: "fact-1",
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, reviewer or operator can manage workspace memory facts.");

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.memoryFact.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks memory governance before correcting a fact", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("只有组织负责人、管理员、运营角色或复核人可以管理工作区记忆记录。"),
    );

    await expect(
      correctMemoryFact({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        memoryFactId: "fact-1",
        correctionType: MemoryCorrectionType.CONTENT_UPDATE,
        afterValue: { title: "updated" },
        english: false,
      }),
    ).rejects.toThrow("只有组织负责人、管理员、运营角色或复核人可以管理工作区记忆记录。");

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: false,
    });
    expect(dbMock.memoryFact.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks memory governance before invalidating a fact", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, reviewer or operator can manage workspace memory facts."),
    );

    await expect(
      invalidateMemoryFact({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        memoryFactId: "fact-1",
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, reviewer or operator can manage workspace memory facts.");

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.memoryFact.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks memory governance before deleting a fact", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, reviewer or operator can manage workspace memory facts."),
    );

    await expect(
      deleteMemoryFact({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        memoryFactId: "fact-1",
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, reviewer or operator can manage workspace memory facts.");

    expect(serviceGovernanceMock.assertWorkspaceMemoryServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.memoryFact.findFirst).not.toHaveBeenCalled();
  });
});
