import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    biReportSignalNotification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  claimBiReportSignalNotificationForDispatch,
  createBiReportSignalNotification,
  listPendingBiReportSignalNotificationDispatchCandidates,
  listPendingBiReportSignalNotifications,
  listRecentBiReportSignalNotifications,
  markBiReportSignalNotificationFailed,
  markBiReportSignalNotificationSent,
  mapBiReportSignalNotificationRow,
} from "@/lib/bi-report-skill/signal-notification";

describe("bi report signal notification storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending notification record", async () => {
    dbMock.biReportSignalNotification.create.mockResolvedValue({
      id: "notification-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetUserId: "user-1",
      channel: "DINGTALK_APP_MESSAGE",
      targetKey: "unionId:abc",
      status: "pending",
      providerMessageId: null,
      errorMessage: null,
      sentAt: null,
      createdAt: new Date("2026-04-22T10:00:00Z"),
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    const notification = await createBiReportSignalNotification({
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetUserId: "user-1",
      channel: "DINGTALK_APP_MESSAGE",
      targetKey: "unionId:abc",
    });

    expect(dbMock.biReportSignalNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalId: "signal-1",
          status: "pending",
        }),
      }),
    );
    expect(notification?.status).toBe("pending");
  });

  it("lists recent notification records", async () => {
    dbMock.biReportSignalNotification.findMany.mockResolvedValue([
      {
        id: "notification-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        targetUserId: null,
        channel: "DINGTALK_GROUP_WEBHOOK",
        targetKey: "webhook-1",
        status: "sent",
        providerMessageId: "provider-1",
        errorMessage: null,
        sentAt: new Date("2026-04-22T10:01:00Z"),
        createdAt: new Date("2026-04-22T10:00:00Z"),
        updatedAt: new Date("2026-04-22T10:01:00Z"),
      },
    ]);

    const notifications = await listRecentBiReportSignalNotifications({
      workspaceId: "workspace-1",
      signalId: "signal-1",
      take: 5,
    });

    expect(dbMock.biReportSignalNotification.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        signalId: "signal-1",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });
    expect(notifications[0]?.status).toBe("sent");
  });

  it("lists pending dispatch candidates with their signal context", async () => {
    dbMock.biReportSignalNotification.findMany.mockResolvedValue([
      {
        id: "notification-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        targetUserId: "user-1",
        channel: "DINGTALK_APP_MESSAGE",
        targetKey: "env:BI_REPORT_DINGTALK_MANAGER_USER_ID",
        status: "pending",
        providerMessageId: null,
        errorMessage: null,
        sentAt: null,
        createdAt: new Date("2026-04-22T10:00:00Z"),
        updatedAt: new Date("2026-04-22T10:00:00Z"),
        signal: {
          id: "signal-1",
          workspaceId: "workspace-1",
          skillKey: "bi_collection_operating_signal_daily",
          signalType: "manager_daily_intervention_required",
          signalKey: "signal-key-1",
          title: "张三 需要主管介入",
          summary: "同一坐席昨日出现多项过程信号。",
          severity: "ALERT",
          ownerUserId: "user-1",
          ownerUserName: "王丽珍",
          ownerUserEmail: "wanglizhen@360amc.cn",
          recommendedActionsJson: "[\"主管当日接手\"]",
        },
      },
    ]);

    const candidates = await listPendingBiReportSignalNotificationDispatchCandidates({
      workspaceId: "workspace-1",
      channel: "DINGTALK_APP_MESSAGE",
      skillKey: "bi_collection_operating_signal_daily",
      take: 3,
    });

    expect(dbMock.biReportSignalNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-1",
          status: "pending",
          channel: "DINGTALK_APP_MESSAGE",
          signal: {
            skillKey: "bi_collection_operating_signal_daily",
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 3,
      }),
    );
    expect(candidates[0]?.signal.recommendedActions).toEqual(["主管当日接手"]);
  });

  it("claims a pending notification before real dispatch", async () => {
    dbMock.biReportSignalNotification.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimBiReportSignalNotificationForDispatch({
      id: "notification-1",
    });

    expect(claimed).toBe(true);
    expect(dbMock.biReportSignalNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "notification-1",
        status: "pending",
      },
      data: {
        status: "processing",
        errorMessage: null,
      },
    });
  });

  it("lists pending notifications in FIFO order", async () => {
    dbMock.biReportSignalNotification.findMany.mockResolvedValue([
      {
        id: "notification-pending-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        targetUserId: null,
        channel: "DINGTALK_APP_MESSAGE",
        targetKey: "unionId:u1",
        status: "pending",
        providerMessageId: null,
        errorMessage: null,
        sentAt: null,
        createdAt: new Date("2026-04-22T10:00:00Z"),
        updatedAt: new Date("2026-04-22T10:00:00Z"),
      },
    ]);

    const rows = await listPendingBiReportSignalNotifications({
      workspaceId: "workspace-1",
      take: 20,
    });

    expect(dbMock.biReportSignalNotification.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        status: "pending",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 20,
    });
    expect(rows[0]?.id).toBe("notification-pending-1");
  });

  it("marks sent and failed notification outcomes", async () => {
    dbMock.biReportSignalNotification.update
      .mockResolvedValueOnce({
        id: "notification-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        targetUserId: "user-1",
        channel: "DINGTALK_APP_MESSAGE",
        targetKey: "env:BI_REPORT_DINGTALK_MANAGER_USER_ID",
        status: "sent",
        providerMessageId: "task-1",
        errorMessage: null,
        sentAt: new Date("2026-04-22T10:01:00Z"),
        createdAt: new Date("2026-04-22T10:00:00Z"),
        updatedAt: new Date("2026-04-22T10:01:00Z"),
      })
      .mockResolvedValueOnce({
        id: "notification-2",
        workspaceId: "workspace-1",
        signalId: "signal-2",
        targetUserId: "user-1",
        channel: "DINGTALK_APP_MESSAGE",
        targetKey: "env:BI_REPORT_DINGTALK_MANAGER_USER_ID",
        status: "failed",
        providerMessageId: null,
        errorMessage: "provider failed",
        sentAt: null,
        createdAt: new Date("2026-04-22T10:00:00Z"),
        updatedAt: new Date("2026-04-22T10:01:00Z"),
      });

    const sent = await markBiReportSignalNotificationSent({
      id: "notification-1",
      providerMessageId: "task-1",
      sentAt: new Date("2026-04-22T10:01:00Z"),
    });
    const failed = await markBiReportSignalNotificationFailed({
      id: "notification-2",
      errorMessage: "provider failed",
    });

    expect(sent?.status).toBe("sent");
    expect(failed?.status).toBe("failed");
    expect(dbMock.biReportSignalNotification.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "sent",
          providerMessageId: "task-1",
          errorMessage: null,
        }),
      }),
    );
    expect(dbMock.biReportSignalNotification.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "provider failed",
          providerMessageId: null,
          sentAt: null,
        }),
      }),
    );
  });

  it("maps unknown status safely", () => {
    const notification = mapBiReportSignalNotificationRow({
      id: "notification-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetUserId: null,
      channel: "DINGTALK_GROUP_WEBHOOK",
      targetKey: "webhook-1",
      status: "unknown",
      providerMessageId: null,
      errorMessage: null,
      sentAt: null,
      createdAt: new Date("2026-04-22T10:00:00Z"),
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    expect(notification.status).toBe("pending");
  });
});
