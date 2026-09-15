import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gateMock, ownerLoopMock } = vi.hoisted(() => ({
  gateMock: { getCaioInitializationGateStatus: vi.fn() },
  ownerLoopMock: { getWorkspaceStage1OwnerLoopReadout: vi.fn() },
}));

vi.mock("@/lib/stage1-owner-loop/caio-initialization-gate-store.service", () => gateMock);
vi.mock("@/features/dashboard/stage1-owner-loop-query", () => ownerLoopMock);

import { getCaioOperatorReadout } from "./queries";

const base = { workspaceId: "workspace_1", actorUserId: "user_owner", english: false };

beforeEach(() => {
  vi.clearAllMocks();
  gateMock.getCaioInitializationGateStatus.mockResolvedValue({ status: "not_accepted", receipt: null, staleReasons: [] });
  ownerLoopMock.getWorkspaceStage1OwnerLoopReadout.mockResolvedValue({ summary: "ok" });
});

describe("getCaioOperatorReadout", () => {
  it("returns null for a non-owner without reading anything", async () => {
    await expect(getCaioOperatorReadout({ ...base, membershipRole: WorkspaceRole.ADMIN })).resolves.toBeNull();
    expect(gateMock.getCaioInitializationGateStatus).not.toHaveBeenCalled();
    expect(ownerLoopMock.getWorkspaceStage1OwnerLoopReadout).not.toHaveBeenCalled();
  });

  it("combines the gate status and the owner-loop readout for the owner", async () => {
    await expect(getCaioOperatorReadout({ ...base, membershipRole: WorkspaceRole.OWNER })).resolves.toEqual({
      gate: { available: true, status: { status: "not_accepted", receipt: null, staleReasons: [] } },
      ownerLoop: { available: true, readout: { summary: "ok" } },
    });
    expect(gateMock.getCaioInitializationGateStatus).toHaveBeenCalledWith(base);
    expect(ownerLoopMock.getWorkspaceStage1OwnerLoopReadout).toHaveBeenCalledWith({
      workspaceId: "workspace_1", membershipRole: WorkspaceRole.OWNER,
    });
  });

  it("reports each part as unavailable instead of failing or showing empty state as real", async () => {
    gateMock.getCaioInitializationGateStatus.mockRejectedValue(new Error("private db failure"));
    ownerLoopMock.getWorkspaceStage1OwnerLoopReadout.mockResolvedValue(null);
    const readout = await getCaioOperatorReadout({ ...base, membershipRole: WorkspaceRole.OWNER });
    expect(readout).toEqual({ gate: { available: false }, ownerLoop: { available: false } });
    expect(JSON.stringify(readout)).not.toContain("private");
  });
});
