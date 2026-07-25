import {
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    membership: {
      findUnique: vi.fn(),
    },
    tenantModelRoutePolicy: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    providerAdapterReadinessReceipt: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    modelRouteDecision: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    modelEgressReceipt: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { getWorkspaceModelEgressOwnerReadout } from "@/features/dashboard/model-egress-query";

describe("getWorkspaceModelEgressOwnerReadout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.membership.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    dbMock.tenantModelRoutePolicy.count.mockResolvedValue(0);
    dbMock.tenantModelRoutePolicy.findMany.mockResolvedValue([]);
    dbMock.providerAdapterReadinessReceipt.count.mockResolvedValue(0);
    dbMock.providerAdapterReadinessReceipt.findMany.mockResolvedValue([]);
    dbMock.modelRouteDecision.count.mockResolvedValue(0);
    dbMock.modelRouteDecision.findMany.mockResolvedValue([]);
    dbMock.modelEgressReceipt.groupBy.mockResolvedValue([]);
  });

  it.each([
    {
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
      label: "active non-owner",
    },
    {
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.INVITED,
      label: "invited owner",
    },
    {
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.INACTIVE,
      label: "inactive owner",
    },
  ])(
    "returns null for $label before reading governance tables",
    async ({ role, status }) => {
      dbMock.membership.findUnique.mockResolvedValue({ role, status });

      await expect(
        getWorkspaceModelEgressOwnerReadout({
          workspaceId: "workspace-1",
          actorUserId: "user-1",
        }),
      ).resolves.toBeNull();

      expect(dbMock.membership.findUnique).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: "workspace-1",
            userId: "user-1",
          },
        },
        select: {
          role: true,
          status: true,
        },
      });
      expect(dbMock.tenantModelRoutePolicy.count).not.toHaveBeenCalled();
      expect(dbMock.modelRouteDecision.findMany).not.toHaveBeenCalled();
    },
  );

  it("returns null when the actor is not a workspace member", async () => {
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(
      getWorkspaceModelEgressOwnerReadout({
        workspaceId: "workspace-1",
        actorUserId: "unknown-user",
      }),
    ).resolves.toBeNull();

    expect(dbMock.tenantModelRoutePolicy.count).not.toHaveBeenCalled();
    expect(dbMock.modelRouteDecision.findMany).not.toHaveBeenCalled();
  });

  it("returns an owner-only readout without selecting sensitive fields", async () => {
    const readout = await getWorkspaceModelEgressOwnerReadout({
      workspaceId: "workspace-1",
      actorUserId: "owner-1",
      now: new Date("2026-07-23T16:00:00.000Z"),
    });

    expect(readout?.posture).toBe("not_configured");
    const readinessQuery =
      dbMock.providerAdapterReadinessReceipt.findMany.mock.calls[0]?.[0];
    expect(readinessQuery.select).not.toHaveProperty("credentialRef");
    expect(readinessQuery.select).not.toHaveProperty("receiptJson");
    const decisionQuery =
      dbMock.modelRouteDecision.findMany.mock.calls[0]?.[0];
    expect(decisionQuery.select).not.toHaveProperty("projectedPayloadHash");
    expect(decisionQuery.select).not.toHaveProperty("decisionJson");
    expect(
      dbMock.providerAdapterReadinessReceipt.count.mock.calls,
    ).toContainEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          modelProbeStatus: "READY",
        }),
      }),
    ]);
    expect(dbMock.modelRouteDecision.count.mock.calls).toContainEqual([
      expect.objectContaining({
        where: expect.objectContaining({ decision: "ALLOWED" }),
      }),
    ]);
  });

  it("degrades to null only when the additive schema is unavailable", async () => {
    dbMock.tenantModelRoutePolicy.count.mockRejectedValue({
      code: "P2021",
      message: "missing table details must not escape",
    });

    await expect(
      getWorkspaceModelEgressOwnerReadout({
        workspaceId: "workspace-1",
        actorUserId: "owner-1",
      }),
    ).resolves.toBeNull();
  });

  it("does not hide unrelated database failures", async () => {
    const failure = new Error("connection unavailable");
    dbMock.tenantModelRoutePolicy.count.mockRejectedValue(failure);

    await expect(
      getWorkspaceModelEgressOwnerReadout({
        workspaceId: "workspace-1",
        actorUserId: "owner-1",
      }),
    ).rejects.toBe(failure);
  });
});
