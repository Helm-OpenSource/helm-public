import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    enterpriseObservationProgram: { findMany: vi.fn() },
    observationSource: { findMany: vi.fn() },
    decisionRecord: { findMany: vi.fn(), groupBy: vi.fn() },
    supervisionSignalRecord: { findMany: vi.fn(), groupBy: vi.fn() },
    decisionWorkPacketClaim: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { getWorkspaceStage1OwnerLoopReadout } from "@/features/dashboard/stage1-owner-loop-query";

describe("getWorkspaceStage1OwnerLoopReadout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.enterpriseObservationProgram.findMany.mockResolvedValue([]);
    dbMock.observationSource.findMany.mockResolvedValue([]);
    dbMock.decisionRecord.findMany.mockResolvedValue([]);
    dbMock.decisionRecord.groupBy.mockResolvedValue([]);
    dbMock.supervisionSignalRecord.findMany.mockResolvedValue([]);
    dbMock.supervisionSignalRecord.groupBy.mockResolvedValue([]);
    dbMock.decisionWorkPacketClaim.findMany.mockResolvedValue([]);
  });

  it("returns null for non-owners without reading owner-loop tables", async () => {
    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.MEMBER,
      }),
    ).resolves.toBeNull();

    expect(dbMock.enterpriseObservationProgram.findMany).not.toHaveBeenCalled();
  });

  it("degrades to null when the additive owner-loop schema is not deployed", async () => {
    dbMock.enterpriseObservationProgram.findMany.mockRejectedValue({
      code: "P2021",
      message: "missing table details must not escape",
    });

    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.OWNER,
      }),
    ).resolves.toBeNull();
  });

  it("does not hide unrelated database failures", async () => {
    const failure = new Error("connection unavailable");
    dbMock.enterpriseObservationProgram.findMany.mockRejectedValue(failure);

    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.OWNER,
      }),
    ).rejects.toBe(failure);
  });
});
