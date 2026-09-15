import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { quickCheckMock } = vi.hoisted(() => ({ quickCheckMock: { runCaioQuickCheck: vi.fn() } }));
vi.mock("./quick-check.service", () => quickCheckMock);

import { parseMinuteHourCronSchedule } from "@/lib/signal-collection/scheduler";

import { CAIO_QUICK_CHECK_ENABLED_ENV, createCaioQuickCheckJob } from "./quick-check-job";

const context = { jobKey: "caio-quick-check", targetKey: "workspace:ws", traceId: "t", requestedAt: new Date(), windowDate: "2026-09-16", source: "test" as const };
const job = () => createCaioQuickCheckJob({
  key: "caio-quick-check", tenantKey: "tenant", extensionKey: "extension", resolveWorkspaceIds: async () => ["ws"],
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  delete process.env[CAIO_QUICK_CHECK_ENABLED_ENV];
});

describe("createCaioQuickCheckJob", () => {
  it.each([[undefined, false], ["true", true], ["TRUE", false], ["1", false], [" true", false], ["false", false]] as const)(
    "is enabled only by the exact string true (%s)", (value, enabled) => {
      if (value !== undefined) process.env[CAIO_QUICK_CHECK_ENABLED_ENV] = value;
      expect(job().enabled()).toBe(enabled);
    });

  it("runs every 10 minutes with declared read and internal-signal effects only", () => {
    const created = job();
    expect(parseMinuteHourCronSchedule(created.schedule.defaultCron)?.minutes).toEqual([0, 10, 20, 30, 40, 50]);
    expect(created.allowedEffects).toEqual(["external_read", "internal_signal_write"]);
  });

  it("targets each resolved workspace", async () => {
    await expect(job().resolveTargets()).resolves.toEqual([{ key: "workspace:ws", workspaceId: "ws" }]);
  });

  it("skips a target without a workspace and a bucket claimed elsewhere", async () => {
    await expect(job().runTarget({ key: "x" }, context)).resolves.toEqual({ status: "skipped", message: "workspace_required" });
    expect(quickCheckMock.runCaioQuickCheck).not.toHaveBeenCalled();
    quickCheckMock.runCaioQuickCheck.mockResolvedValue({ status: "claimed_elsewhere" });
    await expect(job().runTarget({ key: "workspace:ws", workspaceId: "ws" }, context)).resolves.toEqual({ status: "skipped", message: "claimed_elsewhere" });
  });

  it("reports counts only", async () => {
    quickCheckMock.runCaioQuickCheck.mockResolvedValue({
      status: "completed", tickId: "tick", known: 3, unknown: 1, opened: 1, refreshed: 2, cleared: 1, skippedDetectors: 1, failedDetectors: 0,
    });
    const result = await job().runTarget({ key: "workspace:ws", workspaceId: "ws" }, context);
    expect(result).toEqual({
      status: "success", signalCount: 3, failureCount: 0,
      details: { known: 3, unknown: 1, cleared: 1, skippedDetectors: 1 },
    });
    expect(quickCheckMock.runCaioQuickCheck).toHaveBeenCalledWith({ workspaceId: "ws" });
  });
});
