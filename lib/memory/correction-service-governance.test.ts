import { ActorType, MemoryCorrectionType, MemoryStatus } from "@prisma/client";
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

  it("demotes a fact to INVALID for an INVALIDATE correction even without afterValue.status", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(undefined);
    dbMock.memoryFact.findFirst.mockResolvedValueOnce({
      id: "fact-1",
      workspaceId: "workspace-1",
      title: "客户本周确认采购",
      content: "客户本周确认采购",
      status: MemoryStatus.ACTIVE,
      confidence: 80,
      normalizedValue: null,
      objectType: "OPPORTUNITY",
      objectId: "opp-1",
    });
    dbMock.memoryFact.update.mockImplementation(async ({ data }) => ({ id: "fact-1", ...data }));
    dbMock.memoryCorrection.create.mockResolvedValue({ id: "corr-1" });

    await correctMemoryFact({
      workspaceId: "workspace-1",
      actorName: "Reviewer",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      memoryFactId: "fact-1",
      correctionType: MemoryCorrectionType.INVALIDATE,
      reason: "信息已不成立",
      english: false,
    });

    // The human INVALIDATE must actually demote the fact, not just log a label.
    expect(dbMock.memoryFact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fact-1" },
        data: expect.objectContaining({ status: MemoryStatus.INVALID }),
      }),
    );
  });

  it("leaves status untouched for a CONTENT_UPDATE correction", async () => {
    serviceGovernanceMock.assertWorkspaceMemoryServiceAccess.mockResolvedValue(undefined);
    dbMock.memoryFact.findFirst.mockResolvedValueOnce({
      id: "fact-2",
      workspaceId: "workspace-1",
      title: "old",
      content: "old",
      status: MemoryStatus.ACTIVE,
      confidence: 70,
      normalizedValue: null,
      objectType: "CONTACT",
      objectId: "c-1",
    });
    dbMock.memoryFact.update.mockImplementation(async ({ data }) => ({ id: "fact-2", ...data }));
    dbMock.memoryCorrection.create.mockResolvedValue({ id: "corr-2" });

    await correctMemoryFact({
      workspaceId: "workspace-1",
      actorName: "Reviewer",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      memoryFactId: "fact-2",
      correctionType: MemoryCorrectionType.CONTENT_UPDATE,
      afterValue: { content: "new" },
      english: false,
    });

    expect(dbMock.memoryFact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MemoryStatus.ACTIVE, content: "new" }),
      }),
    );
  });
});
