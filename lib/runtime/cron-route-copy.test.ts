import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analytics: {
    logEvent: vi.fn(),
  },
  audit: {
    writeAuditLog: vi.fn(),
  },
  cache: {
    revalidatePath: vi.fn(),
  },
  db: {
    connector: {
      findMany: vi.fn(),
    },
  },
  dingtalkIngestion: {
    syncDingTalkReadonlyConnector: vi.fn(),
  },
  signalNotifications: {
    dispatchPendingBiReportSignalNotifications: vi.fn(),
  },
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: mocks.analytics.logEvent,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.audit.writeAuditLog,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.cache.revalidatePath,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

vi.mock("@/lib/connectors/dingtalk-ingestion", () => ({
  syncDingTalkReadonlyConnector: mocks.dingtalkIngestion.syncDingTalkReadonlyConnector,
}));

vi.mock("@/lib/bi-report-skill/signal-notification-dispatcher", () => ({
  dispatchPendingBiReportSignalNotifications:
    mocks.signalNotifications.dispatchPendingBiReportSignalNotifications,
}));

import { GET as getDingTalkHourlySyncRoute } from "@/app/api/runtime/dingtalk/hourly-sync/route";
import { POST as postSignalNotificationDispatchRoute } from "@/app/api/runtime/signals/dispatch-notifications/route";

describe("runtime cron route copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DINGTALK_SYNC_CRON_TOKEN = "dingtalk-cron-token";
    process.env.SIGNAL_COLLECTION_CRON_TOKEN = "signal-cron-token";
    mocks.db.connector.findMany.mockResolvedValue([]);
    mocks.signalNotifications.dispatchPendingBiReportSignalNotifications.mockResolvedValue({
      attemptedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      skippedCount: 0,
    });
  });

  it("localizes DingTalk hourly-sync missing-token errors from Accept-Language", async () => {
    delete process.env.DINGTALK_SYNC_CRON_TOKEN;

    const response = await getDingTalkHourlySyncRoute(
      new Request("http://localhost/api/runtime/dingtalk/hourly-sync", {
        headers: {
          "accept-language": "zh-CN",
          "x-helm-cron-token": "dingtalk-cron-token",
        },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "DINGTALK_SYNC_CRON_TOKEN 尚未配置。",
    });
    expect(mocks.db.connector.findMany).not.toHaveBeenCalled();
  });

  it("preserves DingTalk hourly-sync English token errors for English callers", async () => {
    const response = await getDingTalkHourlySyncRoute(
      new Request("http://localhost/api/runtime/dingtalk/hourly-sync", {
        headers: {
          "accept-language": "en-US",
          "x-helm-cron-token": "wrong-token",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized cron token.",
    });
    expect(mocks.db.connector.findMany).not.toHaveBeenCalled();
  });

  it("keeps DingTalk hourly-sync dispatch semantics unchanged after auth", async () => {
    const response = await getDingTalkHourlySyncRoute(
      new Request("http://localhost/api/runtime/dingtalk/hourly-sync", {
        headers: {
          "x-helm-cron-token": "dingtalk-cron-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 0,
      successCount: 0,
      partialCount: 0,
      unresolvedCount: 0,
      failedCount: 0,
      details: [],
    });
    expect(mocks.db.connector.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.dingtalkIngestion.syncDingTalkReadonlyConnector).not.toHaveBeenCalled();
    expect(mocks.cache.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("localizes signal-notification dispatch missing-token errors from Accept-Language", async () => {
    delete process.env.SIGNAL_COLLECTION_CRON_TOKEN;

    const response = await postSignalNotificationDispatchRoute(
      new Request("http://localhost/api/runtime/signals/dispatch-notifications", {
        method: "POST",
        headers: {
          "accept-language": "zh-CN",
          "x-helm-cron-token": "signal-cron-token",
        },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "SIGNAL_COLLECTION_CRON_TOKEN 尚未配置。",
    });
    expect(
      mocks.signalNotifications.dispatchPendingBiReportSignalNotifications,
    ).not.toHaveBeenCalled();
  });

  it("localizes signal-notification dispatch workspace validation from Accept-Language", async () => {
    const response = await postSignalNotificationDispatchRoute(
      new Request("http://localhost/api/runtime/signals/dispatch-notifications", {
        method: "POST",
        headers: {
          "accept-language": "zh-CN",
          "x-helm-cron-token": "signal-cron-token",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "缺少 workspaceId。",
    });
    expect(
      mocks.signalNotifications.dispatchPendingBiReportSignalNotifications,
    ).not.toHaveBeenCalled();
  });

  it("preserves signal-notification dispatch English workspace validation", async () => {
    const response = await postSignalNotificationDispatchRoute(
      new Request("http://localhost/api/runtime/signals/dispatch-notifications", {
        method: "POST",
        headers: {
          "accept-language": "en-US",
          "x-helm-cron-token": "signal-cron-token",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Missing workspaceId.",
    });
    expect(
      mocks.signalNotifications.dispatchPendingBiReportSignalNotifications,
    ).not.toHaveBeenCalled();
  });

  it("keeps signal-notification dispatch semantics unchanged after auth", async () => {
    const response = await postSignalNotificationDispatchRoute(
      new Request(
        "http://localhost/api/runtime/signals/dispatch-notifications?workspaceId=workspace_1",
        {
          method: "POST",
          headers: {
            "x-helm-cron-token": "signal-cron-token",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      workspaceId: "workspace_1",
      result: {
        attemptedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
      },
    });
    expect(
      mocks.signalNotifications.dispatchPendingBiReportSignalNotifications,
    ).toHaveBeenCalledWith({ workspaceId: "workspace_1", take: 200 });
  });
});
