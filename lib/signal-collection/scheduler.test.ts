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
  const originalRuntimeWritesEnabled =
    process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED;

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
    delete process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED;
    setNodeEnv("development");
  });

  afterEach(() => {
    vi.useRealTimers();
    global.__helmSignalCollectionSchedulerStates = undefined;
    if (originalRuntimeWritesEnabled === undefined) {
      delete process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED;
    } else {
      process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = originalRuntimeWritesEnabled;
    }
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

  describe.each([
    ["UTC", "+00:00"],
    ["Asia/Shanghai", "+08:00"],
    ["America/New_York", "-04:00"],
  ])("midnight scheduling in %s", (timezone, offset) => {
    it.each([
      ["2026-05-09T23:59:00", "2026-05-10T00:00:00"],
      ["2026-05-10T00:05:15", "2026-05-10T00:10:00"],
      ["2026-05-10T00:59:00", "2026-05-10T01:00:00"],
    ])("finds the next cron run from %s at %s", (from, expected) => {
      expect(findNextRun(
        new Date(`${from}${offset}`),
        parseMinuteHourCronSchedule("*/10 * * * *")!,
        timezone,
      )).toEqual(new Date(`${expected}${offset}`));
    });

    it("finds a daily midnight run on the next local date", () => {
      expect(findNextRun(
        new Date(`2026-05-09T23:59:00${offset}`),
        { hour: 0, minute: 0 },
        timezone,
      )).toEqual(new Date(`2026-05-10T00:00:00${offset}`));
    });

    it("triggers at midnight and schedules the next midnight-hour run once", async () => {
      vi.setSystemTime(new Date(`2026-05-09T23:59:00${offset}`));
      process.env.TENANT_ALPHA_SIGNAL_TIME = "*/10 * * * *";
      process.env.TENANT_ALPHA_SIGNAL_TZ = timezone;
      const runTarget = vi.fn<SignalCollectionJob["runTarget"]>()
        .mockResolvedValue({ status: "success", signalCount: 1 });
      const input = {
        jobs: [buildJob({ runTarget })],
        stateKey: "midnight-scheduler",
      };

      startSignalCollectionScheduler(input);
      startSignalCollectionScheduler(input);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(59_999);
      expect(runTarget).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(runTarget).toHaveBeenCalledTimes(1);
      expect(runTarget.mock.calls[0]?.[1]).toMatchObject({
        requestedAt: new Date(`2026-05-10T00:00:00${offset}`),
        source: "scheduler",
      });
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(599_999);
      expect(runTarget).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(runTarget).toHaveBeenCalledTimes(2);
      expect(runTarget.mock.calls[1]?.[1].requestedAt)
        .toEqual(new Date(`2026-05-10T00:10:00${offset}`));
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  it.each([
    ["2026-03-08T01:59:00-05:00", "0 * * * *", "2026-03-08T03:00:00-04:00"],
    ["2026-03-08T01:59:00-05:00", "30 2 * * *", "2026-03-09T02:30:00-04:00"],
    ["2026-11-01T00:59:00-04:00", "30 1 * * *", "2026-11-01T01:30:00-04:00"],
    ["2026-11-01T01:30:00-04:00", "30 1 * * *", "2026-11-01T01:30:00-05:00"],
  ])("preserves DST cron behavior from %s for %s", (from, cron, expected) => {
    expect(findNextRun(
      new Date(from),
      parseMinuteHourCronSchedule(cron)!,
      "America/New_York",
    )).toEqual(new Date(expected));
  });

  describe("midnight execution boundaries", () => {
    beforeEach(() => {
      vi.setSystemTime(new Date("2026-05-09T23:59:00+08:00"));
      process.env.TENANT_ALPHA_SIGNAL_TIME = "*/10 * * * *";
      process.env.TENANT_ALPHA_SIGNAL_TZ = "Asia/Shanghai";
    });

    it.each(["disabled", "cannot start", "capability closed", "test environment"])(
      "does not register a midnight timer when %s",
      (gate) => {
        const resolveTargets = vi.fn<SignalCollectionJob["resolveTargets"]>();
        const job = buildJob({
          enabled: () => gate !== "disabled",
          canStart: () => ({ ok: gate !== "cannot start", reason: "not_ready" }),
          resolveTargets,
        });
        if (gate === "capability closed") {
          process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = "false";
        }
        if (gate === "test environment") setNodeEnv("test");
        const start = () => startSignalCollectionScheduler({
          jobs: [job], stateKey: "midnight-registration-gate",
        });

        if (gate === "capability closed") {
          expect(start).toThrow("deployment_capability_disabled:signal_runtime_write");
        } else {
          start();
        }
        expect(vi.getTimerCount()).toBe(0);
        expect(resolveTargets).not.toHaveBeenCalled();
      },
    );

    it.each(["disabled", "cannot start", "capability closed"])(
      "rechecks %s at midnight before resolving targets and resumes when reopened",
      async (gate) => {
        let open = true;
        const resolveTargets = vi.fn<SignalCollectionJob["resolveTargets"]>()
          .mockResolvedValue([{ key: "target-a" }]);
        const runTarget = vi.fn<SignalCollectionJob["runTarget"]>()
          .mockResolvedValue({ status: "success", signalCount: 1 });
        startSignalCollectionScheduler({
          jobs: [buildJob({
            enabled: () => gate !== "disabled" || open,
            canStart: () => ({ ok: gate !== "cannot start" || open, reason: "not_ready" }),
            resolveTargets,
            runTarget,
          })],
          stateKey: "midnight-execution-gate",
        });
        expect(vi.getTimerCount()).toBe(1);

        open = false;
        if (gate === "capability closed") {
          process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = "false";
        }
        await vi.advanceTimersByTimeAsync(60_000);
        expect(resolveTargets).not.toHaveBeenCalled();
        expect(runTarget).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);

        open = true;
        process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = "true";
        await vi.advanceTimersByTimeAsync(600_000);
        expect(resolveTargets).toHaveBeenCalledTimes(1);
        expect(runTarget).toHaveBeenCalledTimes(1);
      },
    );

    it("does not overlap a pending midnight run and resumes at the next future slot", async () => {
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => { finish = resolve; });
      const runTarget = vi.fn<SignalCollectionJob["runTarget"]>()
        .mockImplementationOnce(async () => {
          await pending;
          return { status: "success", signalCount: 1 };
        })
        .mockResolvedValue({ status: "success", signalCount: 1 });
      startSignalCollectionScheduler({
        jobs: [buildJob({ runTarget })], stateKey: "midnight-no-overlap",
      });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(runTarget).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(600_000);
      expect(runTarget).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(599_999);
      expect(runTarget).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(runTarget).toHaveBeenCalledTimes(2);
      expect(runTarget.mock.calls[1]?.[1].requestedAt)
        .toEqual(new Date("2026-05-10T00:20:00+08:00"));
    });
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

  it("blocks the direct runner before resolving targets when runtime writes are closed", async () => {
    process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = "false";
    const resolveTargets = vi.fn<SignalCollectionJob["resolveTargets"]>();

    await expect(
      runSignalCollectionJobs({
        jobs: [buildJob({ resolveTargets })],
        source: "test",
      }),
    ).rejects.toThrow(
      "deployment_capability_disabled:signal_runtime_write",
    );

    expect(resolveTargets).not.toHaveBeenCalled();
  });

  it("blocks direct scheduler registration when runtime writes are closed", () => {
    process.env.HELM_SIGNAL_RUNTIME_WRITES_ENABLED = "false";

    expect(() =>
      startSignalCollectionScheduler({
        jobs: [buildJob()],
        stateKey: "closed-scheduler",
      }),
    ).toThrow("deployment_capability_disabled:signal_runtime_write");

    expect(vi.getTimerCount()).toBe(0);
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

  it("keeps scheduler logs free of target details and raw failure text", async () => {
    process.env.TENANT_ALPHA_SIGNAL_TIME = "0 8 * * *";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    startSignalCollectionScheduler({
      jobs: [
        buildJob({
          resolveTargets: async () => [
            { key: "customer-reference", workspaceId: "workspace-sensitive" },
          ],
          runTarget: async () => ({
            status: "failed",
            failureCount: 1,
            details: {
              error: "raw SQL and customer detail",
            },
          }),
        }),
      ],
      stateKey: "test-scheduler-safe-logs",
      source: "test",
    });

    await vi.advanceTimersByTimeAsync(61_000);

    const logs = JSON.stringify([
      ...infoSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(logs).toContain("job completed");
    expect(logs).toContain("job run failed");
    expect(logs).not.toContain("customer-reference");
    expect(logs).not.toContain("workspace-sensitive");
    expect(logs).not.toContain("raw SQL and customer detail");
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
