import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRegisteredCaioAttentionScanConfig,
  isCaioAttentionRemindersEnabled,
  runCaioAttentionScanTick,
  startCaioAttentionReminderCron,
} from "./reminder-cron";

describe("CAIO attention reminder cron", () => {
  afterEach(() => {
    globalThis.__caioAttentionReminderCronState = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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
