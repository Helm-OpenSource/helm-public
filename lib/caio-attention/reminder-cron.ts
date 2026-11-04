import type { CaioAttentionRouteRule } from "./contracts";
import type { CaioAttentionPolicy } from "./schedule";

/**
 * Five-minute attention reminder + watchdog scan on the web nodes. Default OFF: it starts only when
 * HELM_CAIO_ATTENTION_REMINDERS_ENABLED is "true" or "1" AND the overlay has registered the tenant policy.
 * Core ships no tenant cadence; without a registration every tick is skipped and logged (fail closed).
 */

export const CAIO_ATTENTION_SCAN_INTERVAL_MS = 5 * 60_000;
const INITIAL_DELAY_MS = 60_000;

export type CaioAttentionScanConfig = Readonly<{
  policy: CaioAttentionPolicy;
  /** Route rules of the enabled detectors; W3 watches those routed in each workspace's active config. */
  routeRules: readonly CaioAttentionRouteRule[];
  /** Role key in the route config whose holders receive watchdog alerts; OWNERs when absent or unbound. */
  watchdogRoleKey?: string;
}>;

type CronState = {
  started: boolean; running: boolean; timer: NodeJS.Timeout | null; config: CaioAttentionScanConfig | null;
  /** Cases that failed last tick; skipped for one tick. */
  lastFailedCaseIds: string[];
};

declare global {
  var __caioAttentionReminderCronState: CronState | undefined;
}

function state(): CronState {
  globalThis.__caioAttentionReminderCronState ??= { started: false, running: false, timer: null, config: null, lastFailedCaseIds: [] };
  return globalThis.__caioAttentionReminderCronState;
}

export function isCaioAttentionRemindersEnabled(raw: string | undefined = process.env.HELM_CAIO_ATTENTION_REMINDERS_ENABLED): boolean {
  return raw === "true" || raw === "1";
}

/**
 * Scan inputs, set only by registerCaioAttentionPack (registry.ts) from the same pack the generator and the page
 * service use; overlays never call this directly.
 */
export function registerCaioAttentionScanConfig(config: CaioAttentionScanConfig): void {
  state().config = config;
}

export function resetCaioAttentionScanConfigForTests(): void {
  state().config = null;
}

export function getRegisteredCaioAttentionScanConfig(): CaioAttentionScanConfig | null {
  return state().config;
}

export async function runCaioAttentionScanTick(now: Date = new Date()): Promise<"skipped_unconfigured" | "skipped_overlap" | "done"> {
  const current = state();
  const config = current.config;
  if (!config) {
    console.warn("[caio-attention-reminders] no policy registered; tick skipped");
    return "skipped_unconfigured";
  }
  if (current.running) return "skipped_overlap";
  current.running = true;
  try {
    const [{ db }, { runCaioAttentionReminderScan }, watchdogs] = await Promise.all([
      import("@/lib/db"), import("./reminder-scanner.service"), import("./watchdog.service"),
    ]);
    try {
      const result = await runCaioAttentionReminderScan({ client: db, now, policy: config.policy, skipCaseIds: current.lastFailedCaseIds });
      current.lastFailedCaseIds = result.failedCaseIds;
      console.info(`[caio-attention-reminders] ${result.casesScanned} cases, ${result.notificationsCreated} notices, `
        + `${result.notificationsDeduplicated} deduplicated, ${result.failedCaseIds.length} failed, `
        + `${Object.values(result.skippedNoRecipient).reduce((sum, n) => sum + (n ?? 0), 0)} without recipient`);
    } catch (error) {
      console.error("[caio-attention-reminders] scan failed", error instanceof Error ? error.message : String(error));
    }
    // Each watchdog is isolated: one failing must not silence the others.
    const runs: Array<[string, () => Promise<unknown>]> = [
      ["W1", () => watchdogs.runCaioAttentionGenerationWatchdog({ client: db, now, watchdogRoleKey: config.watchdogRoleKey })],
      ["W2", () => watchdogs.runCaioAttentionQuickCheckWatchdog({ client: db, now, watchdogRoleKey: config.watchdogRoleKey })],
      ["W3", () => watchdogs.runCaioAttentionEvaluationWatchdog({
        client: db, now, routeRules: config.routeRules, watchdogRoleKey: config.watchdogRoleKey })],
      ["W4", () => watchdogs.runCaioAttentionNodeWatchdog({ client: db, now, watchdogRoleKey: config.watchdogRoleKey })],
      ["W5", () => watchdogs.runCaioAttentionPeopleWatchdog({ client: db })],
    ];
    for (const [name, run] of runs) {
      try {
        await run();
      } catch (error) {
        console.error(`[caio-attention-watchdog] ${name} failed`, error instanceof Error ? error.message : String(error));
      }
    }
    return "done";
  } finally {
    current.running = false;
  }
}

export function startCaioAttentionReminderCron(): void {
  if (process.env.NODE_ENV === "test" || !isCaioAttentionRemindersEnabled()) return;
  const current = state();
  if (current.started) return;
  current.started = true;
  current.timer = setTimeout(() => {
    void runCaioAttentionScanTick();
    current.timer = setInterval(() => void runCaioAttentionScanTick(), CAIO_ATTENTION_SCAN_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
