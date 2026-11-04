import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRegisteredCaioAttentionScanConfig,
  isCaioAttentionRemindersEnabled,
  registerCaioAttentionScanConfig,
  runCaioAttentionScanTick,
  startCaioAttentionReminderCron,
} from "./reminder-cron";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY } from "./schedule";

const mocks = vi.hoisted(() => ({
  scan: vi.fn(),
  watchdogs: { W1: vi.fn(), W2: vi.fn(), W3: vi.fn(), W4: vi.fn(), W5: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { marker: "mock-db" } }));
vi.mock("./reminder-scanner.service", () => ({ runCaioAttentionReminderScan: mocks.scan }));
vi.mock("./watchdog.service", () => ({
  runCaioAttentionGenerationWatchdog: mocks.watchdogs.W1, runCaioAttentionQuickCheckWatchdog: mocks.watchdogs.W2,
  runCaioAttentionEvaluationWatchdog: mocks.watchdogs.W3, runCaioAttentionNodeWatchdog: mocks.watchdogs.W4,
  runCaioAttentionPeopleWatchdog: mocks.watchdogs.W5,
}));

describe("CAIO attention reminder cron", () => {
  afterEach(() => {
    globalThis.__caioAttentionReminderCronState = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mocks.scan.mockReset();
    for (const fn of Object.values(mocks.watchdogs)) fn.mockReset();
  });

  it("is off by default and accepts only an explicit true or 1", () => {
    expect(isCaioAttentionRemindersEnabled(undefined)).toBe(false);
    for (const raw of ["", "false", "0", "TRUE", "yes", " true"]) expect(isCaioAttentionRemindersEnabled(raw)).toBe(false);
    expect(isCaioAttentionRemindersEnabled("true")).toBe(true);
    expect(isCaioAttentionRemindersEnabled("1")).toBe(true);
  });

  it("never starts a timer under test or while the switch is off", () => {
    const timers = vi.spyOn(globalThis, "setTimeout");
    startCaioAttentionReminderCron();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HELM_CAIO_ATTENTION_REMINDERS_ENABLED", "false");
    startCaioAttentionReminderCron();
    expect(timers).not.toHaveBeenCalled();
    expect(globalThis.__caioAttentionReminderCronState?.started ?? false).toBe(false);
  });

  it("skips a tick without a registered tenant policy instead of falling back to a Core default", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(getRegisteredCaioAttentionScanConfig()).toBeNull();
    await expect(runCaioAttentionScanTick(new Date("2026-11-04T02:00:00Z"))).resolves.toBe("skipped_unconfigured");
  });

  it("with a registered policy runs the scan and every watchdog, isolates failures, and skips last tick's failed cases", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const now = new Date("2026-11-04T02:00:00Z");
    registerCaioAttentionScanConfig({ policy: CAIO_ATTENTION_TEST_DEFAULT_POLICY, routeRules: [], watchdogRoleKey: "tech" });
    const result = (failedCaseIds: string[]) => ({ casesScanned: 1, sends: {}, notificationsCreated: 0, notificationsDeduplicated: 0,
      failedCaseIds, skippedNoRecipient: {} });
    mocks.scan.mockResolvedValueOnce(result(["c-bad"])).mockResolvedValueOnce(result([]));
    for (const fn of Object.values(mocks.watchdogs)) fn.mockResolvedValue([]);
    mocks.watchdogs.W2.mockRejectedValueOnce(new Error("boom"));

    await expect(runCaioAttentionScanTick(now)).resolves.toBe("done");
    expect(mocks.scan).toHaveBeenLastCalledWith(expect.objectContaining({ client: { marker: "mock-db" }, now, skipCaseIds: [] }));
    for (const fn of Object.values(mocks.watchdogs)) expect(fn).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("[caio-attention-watchdog] W2 failed", "boom");
    expect(mocks.watchdogs.W3).toHaveBeenCalledWith(expect.objectContaining({ routeRules: [], watchdogRoleKey: "tech" }));

    await expect(runCaioAttentionScanTick(now)).resolves.toBe("done");
    expect(mocks.scan).toHaveBeenLastCalledWith(expect.objectContaining({ skipCaseIds: ["c-bad"] }));

    // A tick still running blocks the next one instead of overlapping it.
    let finish!: (value: unknown) => void;
    mocks.scan.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const slow = runCaioAttentionScanTick(now);
    await vi.waitFor(() => expect(mocks.scan).toHaveBeenCalledTimes(3));
    await expect(runCaioAttentionScanTick(now)).resolves.toBe("skipped_overlap");
    finish(result([]));
    await expect(slow).resolves.toBe("done");
  });

  it("stays separate from the light task chain: neither side reads the other", () => {
    const sources = (dir: string) => readdirSync(dir).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => readFileSync(path.join(dir, name), "utf8"));
    const root = path.resolve(__dirname, "..");
    for (const text of sources(path.join(root, "task-follow-through"))) expect(text).not.toMatch(/caio-?attention/iu);
    for (const text of sources(path.join(root, "caio-attention"))) {
      expect(text).not.toMatch(/task-follow-through|actionItem|ApprovalTask|ExecutionReceipt/u);
      // Attention dedupe keys never share the light chain's `follow-through:` namespace.
      expect(text).not.toMatch(/["`]follow-through:/u);
    }
  });
});
