import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registry: {
    listRegisteredSignalCollectionJobs: vi.fn(),
    runRegisteredSignalCollectionJobs: vi.fn(),
  },
}));

vi.mock("@/lib/extensions/registry", () => ({
  listRegisteredSignalCollectionJobs: mocks.registry.listRegisteredSignalCollectionJobs,
  runRegisteredSignalCollectionJobs: mocks.registry.runRegisteredSignalCollectionJobs,
}));

import {
  GET as getSignalCollectionRoute,
  POST as postSignalCollectionRoute,
} from "@/app/api/runtime/signals/collect/route";

describe("signal collection cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SIGNAL_COLLECTION_CRON_TOKEN = "cron-token";
    mocks.registry.listRegisteredSignalCollectionJobs.mockReturnValue([
      { key: "tenant-alpha.signal.daily" },
      { key: "tenant-alpha.operation.daily" },
    ]);
    mocks.registry.runRegisteredSignalCollectionJobs.mockResolvedValue({
      ok: true,
      requestedAt: "2026-05-09T00:00:00.000Z",
      windowDate: "2026-05-09",
      jobCount: 1,
      targetCount: 1,
      successCount: 1,
      failureCount: 0,
      skippedCount: 0,
      jobs: [],
    });
  });

  it("runs selected registered jobs behind cron token auth", async () => {
    const response = await postSignalCollectionRoute(
      new Request(
        "http://localhost:3000/api/runtime/signals/collect?jobKey=tenant-alpha.signal.daily,tenant-alpha.operation.daily",
        {
          headers: {
            "x-helm-cron-token": "cron-token",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect((await response.clone().json()).entrypoint).toMatchObject({
      class: "registered_signal_collection",
      method: "POST",
      path: "/api/runtime/signals/collect",
      jobKeySelection: "query.jobKey",
    });
    expect(mocks.registry.runRegisteredSignalCollectionJobs).toHaveBeenCalledWith({
      jobKeys: ["tenant-alpha.signal.daily", "tenant-alpha.operation.daily"],
      source: "api",
    });
  });

  it("runs all jobs when no jobKey is provided", async () => {
    await postSignalCollectionRoute(
      new Request("http://localhost:3000/api/runtime/signals/collect", {
        headers: {
          "x-helm-cron-token": "cron-token",
        },
      }),
    );

    expect(mocks.registry.runRegisteredSignalCollectionJobs).toHaveBeenCalledWith({
      jobKeys: undefined,
      source: "api",
    });
  });

  it("rejects unknown job keys before dispatch", async () => {
    const response = await postSignalCollectionRoute(
      new Request(
        "http://localhost:3000/api/runtime/signals/collect?jobKey=tenant-alpha.unknown.daily",
        {
          headers: {
            "x-helm-cron-token": "cron-token",
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.unknownJobKeys).toEqual(["tenant-alpha.unknown.daily"]);
    expect(mocks.registry.runRegisteredSignalCollectionJobs).not.toHaveBeenCalled();
  });

  it("localizes unknown job errors from Accept-Language", async () => {
    const response = await postSignalCollectionRoute(
      new Request(
        "http://localhost:3000/api/runtime/signals/collect?jobKey=tenant-alpha.unknown.daily",
        {
          headers: {
            "accept-language": "zh-CN",
            "x-helm-cron-token": "cron-token",
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("未知的信号采集任务。");
    expect(payload.unknownJobKeys).toEqual(["tenant-alpha.unknown.daily"]);
    expect(mocks.registry.runRegisteredSignalCollectionJobs).not.toHaveBeenCalled();
  });

  it("rejects invalid cron tokens", async () => {
    const response = await postSignalCollectionRoute(
      new Request("http://localhost:3000/api/runtime/signals/collect", {
        headers: {
          "x-helm-cron-token": "wrong-token",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("fails closed when the cron token is not configured", async () => {
    delete process.env.SIGNAL_COLLECTION_CRON_TOKEN;

    const response = await postSignalCollectionRoute(
      new Request("http://localhost:3000/api/runtime/signals/collect", {
        headers: {
          "x-helm-cron-token": "cron-token",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.registry.runRegisteredSignalCollectionJobs).not.toHaveBeenCalled();
  });

  it("localizes missing cron token configuration errors from Accept-Language", async () => {
    delete process.env.SIGNAL_COLLECTION_CRON_TOKEN;

    const response = await postSignalCollectionRoute(
      new Request("http://localhost:3000/api/runtime/signals/collect", {
        headers: {
          "accept-language": "zh-CN",
          "x-helm-cron-token": "cron-token",
        },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "SIGNAL_COLLECTION_CRON_TOKEN 尚未配置。",
    });
    expect(mocks.registry.runRegisteredSignalCollectionJobs).not.toHaveBeenCalled();
  });

  it("rejects GET dispatch to avoid accidental replay", async () => {
    const response = await getSignalCollectionRoute(
      new Request("http://localhost:3000/api/runtime/signals/collect", {
        headers: { "accept-language": "en-US" },
      }),
    );
    expect((await response.json()).entrypoint).toMatchObject({
      class: "registered_signal_collection",
      method: "POST",
    });
    expect(response.status).toBe(405);
  });

  it("localizes GET dispatch guidance from Accept-Language", async () => {
    const response = await getSignalCollectionRoute(
      new Request("http://localhost:3000/api/runtime/signals/collect", {
        headers: { "accept-language": "zh-CN" },
      }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: "请使用 POST 触发信号采集 cron dispatch。",
      entrypoint: {
        class: "registered_signal_collection",
        method: "POST",
      },
    });
  });
});
