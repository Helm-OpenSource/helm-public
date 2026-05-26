import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  findNextRun,
  parseBooleanFlag,
  parseCommaSeparatedList,
  parseDailySchedule,
  parseMinuteHourCronSchedule,
  runSignalCollectionJobs,
  startSignalCollectionScheduler,
} from "@/lib/signal-collection/scheduler";
import type { SignalCollectionJob } from "@/lib/signal-collection/types";

function buildJob(overrides: Partial<SignalCollectionJob> = {}): SignalCollectionJob {
  return {
    key: "tenant-alpha.signal.daily",
    tenantKey: "tenant-alpha",
    extensionKey: "tenant-alpha-signal",
    label: "Tenant Alpha signal",
    kind: "signal_collection",
    enabled: () => true,
    schedule: {
      timeEnvKey: "TENANT_ALPHA_SIGNAL_TIME",
      defaultCron: "0 8 * * *",
      timezoneEnvKey: "TENANT_ALPHA_SIGNAL_TZ",
      defaultTimezone: "UTC",
    },
    allowedEffects: ["external_read", "internal_signal_write"],
    resolveTargets: async () => [{ key: "workspace-a", workspaceId: "workspace-a" }],
    runTarget: async () => ({ status: "success", signalCount: 1 }),
    ...overrides,
  };
}

describe("signal collection scheduler", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  function setNodeEnv(value: string | undefined) {
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T07:59:00.000Z"));
    global.__helmSignalCollectionSchedulerStates = undefined;
    delete process.env.TENANT_ALPHA_SIGNAL_TIME;
    delete process.env.TENANT_ALPHA_SIGNAL_TZ;
    setNodeEnv("development");
  });

  afterEach(() => {
    vi.useRealTimers();
    global.__helmSignalCollectionSchedulerStates = undefined;
    setNodeEnv(originalNodeEnv);
  });

  it("parses only daily minute/hour cron expressions", () => {
    expect(parseDailySchedule("0 9 * * *")).toEqual({ hour: 9, minute: 0 });
    expect(parseMinuteHourCronSchedule("*/30 8-22 * * *")).toEqual({
      hours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
      minutes: [0, 30],
    });
    expect(parseDailySchedule("0 9 * * 1")).toBeNull();
    expect(parseDailySchedule("60 9 * * *")).toBeNull();
    expect(parseMinuteHourCronSchedule("*/30 8-22 * * 1")).toBeNull();
  });

  it("finds the next scheduled minute in the requested timezone", () => {
    const nextRun = findNextRun(
      new Date("2026-05-06T00:30:15.000Z"),
      { hour: 9, minute: 0 },
      "Asia/Shanghai",
    );
    expect(nextRun.toISOString()).toBe("2026-05-06T01:00:00.000Z");

    const intervalRun = findNextRun(
      new Date("2026-05-06T01:05:15.000Z"),
      parseMinuteHourCronSchedule("*/30 8-22 * * *")!,
      "Asia/Shanghai",
    );
    expect(intervalRun.toISOString()).toBe("2026-05-06T01:30:00.000Z");
  });

  it("normalizes feature flags and comma-separated target lists", () => {
    expect(parseBooleanFlag(undefined, { defaultValue: true })).toBe(true);
    expect(parseBooleanFlag("off", { defaultValue: true })).toBe(false);
    expect(parseBooleanFlag("yes", { defaultValue: false })).toBe(true);
    expect(parseCommaSeparatedList(" a, b, a ,, ")).toEqual(["a", "b"]);
  });

  it("runs enabled jobs across all resolved targets", async () => {
    const runTarget = vi
      .fn<SignalCollectionJob["runTarget"]>()
      .mockResolvedValue({ status: "success", signalCount: 2 });
    const summary = await runSignalCollectionJobs({
      jobs: [
        buildJob({
          resolveTargets: async () => [
            { key: "target-a" },
            { key: "target-b" },
          ],
          runTarget,
        }),
      ],
      now: new Date("2026-05-09T00:00:00.000Z"),
      source: "test",
    });

    expect(summary).toMatchObject({
      ok: true,
      jobCount: 1,
      targetCount: 2,
      successCount: 2,
      failureCount: 0,
    });
    expect(runTarget).toHaveBeenCalledTimes(2);
    expect(summary.jobs[0]?.runs[0]?.traceId).toContain("tenant-alpha_signal_daily");
  });

  it("records target failures without aborting the whole job", async () => {
    const summary = await runSignalCollectionJobs({
      jobs: [
        buildJob({
          resolveTargets: async () => [
            { key: "target-a" },
            { key: "target-b" },
          ],
          runTarget: async (target) => {
            if (target.key === "target-b") {
              throw new Error("target failed");
            }
            return { status: "success", signalCount: 1 };
          },
        }),
      ],
      now: new Date("2026-05-09T00:00:00.000Z"),
      source: "test",
    });

    expect(summary.ok).toBe(false);
    expect(summary.failureCount).toBe(1);
    expect(summary.jobs[0]?.runs[1]).toMatchObject({
      targetKey: "target-b",
      status: "failed",
      message: "target failed",
    });
  });

  it("fails closed before resolving targets when job start check fails", async () => {
    const resolveTargets = vi.fn<SignalCollectionJob["resolveTargets"]>();
    const summary = await runSignalCollectionJobs({
      jobs: [
        buildJob({
          canStart: () => ({ ok: false, reason: "missing_env" }),
          resolveTargets,
        }),
      ],
      now: new Date("2026-05-09T00:00:00.000Z"),
      source: "test",
    });

    expect(summary.ok).toBe(false);
    expect(summary.jobs[0]).toMatchObject({
      status: "failed",
      message: "missing_env",
      targetCount: 0,
    });
    expect(resolveTargets).not.toHaveBeenCalled();
  });

  it("starts one timer per enabled job and runs through the shared runner", async () => {
    process.env.TENANT_ALPHA_SIGNAL_TIME = "0 8 * * *";
    const runTarget = vi
      .fn<SignalCollectionJob["runTarget"]>()
      .mockResolvedValue({ status: "success", signalCount: 1 });

    startSignalCollectionScheduler({
      jobs: [buildJob({ runTarget })],
      stateKey: "test-scheduler",
      source: "test",
    });

    await vi.advanceTimersByTimeAsync(61_000);

    expect(runTarget).toHaveBeenCalledTimes(1);
  });

  it("keeps core signal collection free of tenant extension imports", () => {
    const files = listTsFiles(join(process.cwd(), "lib/signal-collection"));
    const forbiddenImport = "@/" + "extensions/";
    const offenders = files.filter((file) =>
      readFileSync(file, "utf8").includes(forbiddenImport),
    );
    expect(offenders).toEqual([]);
  });
});

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return listTsFiles(path);
    }
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}
