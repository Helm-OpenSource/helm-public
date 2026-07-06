import { ActionStatus, CommitmentStatus, NotificationType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock } = vi.hoisted(() => ({
  dbMock: {
    actionItem: {
      findMany: vi.fn(),
    },
    commitment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      findMany: vi.fn(),
    },
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

import { runLightChainFollowThroughSweepForWorkspace } from "@/lib/task-follow-through/light-chain-follow-through-sweep.service";

const NOW = new Date("2026-07-06T09:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("light chain follow-through sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.notification.findFirst.mockResolvedValue(null);
    dbMock.notification.create.mockResolvedValue({ id: "n-1" });
  });

  it("creates internal reminder notifications and one audit entry per sweep", async () => {
    dbMock.actionItem.findMany.mockResolvedValue([
      {
        id: "a-1",
        title: "跟进门店培训",
        status: ActionStatus.PENDING_APPROVAL,
        dueDate: daysAgo(8),
        updatedAt: daysAgo(8),
        ownerId: "user-1",
      },
    ]);
    dbMock.commitment.findMany.mockResolvedValue([
      {
        id: "c-1",
        title: "交付培训材料",
        status: CommitmentStatus.OPEN,
        dueDate: daysAgo(2),
        ownerUserId: null,
      },
    ]);

    const result = await runLightChainFollowThroughSweepForWorkspace({
      workspaceId: "workspace-1",
      now: NOW,
    });

    expect(result.findings).toHaveLength(2);
    expect(result.notificationsCreated).toBe(2);
    expect(dbMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.REMINDER,
          title: expect.stringContaining("需管理关注"),
          userId: "user-1",
          url: "/approvals?followThrough=action-item:a-1",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "LIGHT_CHAIN_FOLLOW_THROUGH_SWEEP",
        payload: expect.objectContaining({
          managerAttentionCount: 1,
          notificationsCreated: 2,
        }),
      }),
    );
    // The read-only invariant on Commitment.overdueFlag: the sweep never
    // mutates commitments at all.
    expect(dbMock.commitment.update).not.toHaveBeenCalled();
  });

  it("deduplicates reminders already sent within the window", async () => {
    dbMock.actionItem.findMany.mockResolvedValue([
      {
        id: "a-1",
        title: "跟进门店培训",
        status: ActionStatus.PENDING_APPROVAL,
        dueDate: daysAgo(2),
        updatedAt: daysAgo(2),
        ownerId: null,
      },
    ]);
    dbMock.commitment.findMany.mockResolvedValue([]);
    dbMock.notification.findFirst.mockResolvedValue({ id: "existing" });

    const result = await runLightChainFollowThroughSweepForWorkspace({
      workspaceId: "workspace-1",
      now: NOW,
    });

    expect(result.notificationsCreated).toBe(0);
    expect(result.notificationsDeduplicated).toBe(1);
    expect(dbMock.notification.create).not.toHaveBeenCalled();
  });

  it("writes no audit entry when there is nothing to follow through", async () => {
    dbMock.actionItem.findMany.mockResolvedValue([]);
    dbMock.commitment.findMany.mockResolvedValue([]);

    const result = await runLightChainFollowThroughSweepForWorkspace({
      workspaceId: "workspace-1",
      now: NOW,
    });

    expect(result.findings).toHaveLength(0);
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });
});
