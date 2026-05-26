import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    notificationStore: {
      listPendingBiReportSignalNotifications: vi.fn(),
      markBiReportSignalNotificationSent: vi.fn(),
      markBiReportSignalNotificationFailed: vi.fn(),
    },
    businessSignal: {
      getBiReportBusinessSignalById: vi.fn(),
    },
    delivery: {
      sendBiReportToDingTalkDeliveryTarget: vi.fn(),
    },
  },
}));

vi.mock("@/lib/bi-report-skill/signal-notification", () => ({
  listPendingBiReportSignalNotifications:
    mocks.notificationStore.listPendingBiReportSignalNotifications,
  markBiReportSignalNotificationSent:
    mocks.notificationStore.markBiReportSignalNotificationSent,
  markBiReportSignalNotificationFailed:
    mocks.notificationStore.markBiReportSignalNotificationFailed,
}));

vi.mock("@/lib/bi-report-skill/business-signal", () => ({
  getBiReportBusinessSignalById: mocks.businessSignal.getBiReportBusinessSignalById,
}));

vi.mock("@/lib/bi-report-skill/delivery/dingtalk-delivery", () => ({
  sendBiReportToDingTalkDeliveryTarget: mocks.delivery.sendBiReportToDingTalkDeliveryTarget,
}));

import { dispatchPendingBiReportSignalNotifications } from "@/lib/bi-report-skill/signal-notification-dispatcher";

describe("signal notification dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches pending app-message notifications and marks success", async () => {
    mocks.notificationStore.listPendingBiReportSignalNotifications.mockResolvedValue([
      {
        id: "notification-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        targetUserId: "user-1",
        channel: "DINGTALK_APP_MESSAGE",
        targetKey: "unionId:u-1",
        status: "pending",
        providerMessageId: null,
        errorMessage: null,
        sentAt: null,
        createdAt: "2026-05-12T00:00:00.000Z",
        updatedAt: "2026-05-12T00:00:00.000Z",
      },
    ]);
    mocks.businessSignal.getBiReportBusinessSignalById.mockResolvedValue({
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_collection_operating_signal_daily",
      signalType: "x",
      signalKey: "y",
      title: "回款异常",
      summary: "今日回款低于基线",
      severity: "CRITICAL",
      continuityStatus: "first_seen",
      dimensions: null,
      metrics: null,
      evidence: null,
      recommendedActions: ["主管当日复核并给出动作"],
      status: "open",
      ownerUserId: "user-1",
      ownerUserName: "张三",
      ownerUserEmail: "a@b.c",
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:00.000Z",
    });
    mocks.delivery.sendBiReportToDingTalkDeliveryTarget.mockResolvedValue({
      channel: "DINGTALK_APP_MESSAGE",
      targetType: "unionId",
      targetKey: "u-1",
      status: "SENT",
      responseBody: "{\"task_id\":\"task-1\"}",
    });

    const summary = await dispatchPendingBiReportSignalNotifications({
      workspaceId: "workspace-1",
    });

    expect(summary).toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
    });
    expect(mocks.notificationStore.markBiReportSignalNotificationSent).toHaveBeenCalledWith({
      id: "notification-1",
      providerMessageId: "task-1",
    });
  });

  it("marks notification failed when signal row is missing", async () => {
    mocks.notificationStore.listPendingBiReportSignalNotifications.mockResolvedValue([
      {
        id: "notification-1",
        workspaceId: "workspace-1",
        signalId: "signal-404",
        targetUserId: null,
        channel: "DINGTALK_GROUP_WEBHOOK",
        targetKey: "https://example.com/webhook",
        status: "pending",
        providerMessageId: null,
        errorMessage: null,
        sentAt: null,
        createdAt: "2026-05-12T00:00:00.000Z",
        updatedAt: "2026-05-12T00:00:00.000Z",
      },
    ]);
    mocks.businessSignal.getBiReportBusinessSignalById.mockResolvedValue(null);

    const summary = await dispatchPendingBiReportSignalNotifications({
      workspaceId: "workspace-1",
    });

    expect(summary).toEqual({
      attempted: 1,
      sent: 0,
      failed: 1,
    });
    expect(mocks.notificationStore.markBiReportSignalNotificationFailed).toHaveBeenCalledWith({
      id: "notification-1",
      errorMessage: "signal_not_found",
    });
  });
});
