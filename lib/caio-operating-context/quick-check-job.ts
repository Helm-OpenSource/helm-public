import "server-only";

import type { SignalCollectionJob } from "@/lib/signal-collection/types";

import { runCaioQuickCheck } from "./quick-check.service";

/**
 * Scheduler job for the CAIO quick check, contributed by a tenant pack through signalCollectionJobs.
 * Off unless HELM_CAIO_QUICK_CHECK_ENABLED is exactly "true". Run details carry counts only.
 */

export const CAIO_QUICK_CHECK_ENABLED_ENV = "HELM_CAIO_QUICK_CHECK_ENABLED";

export function createCaioQuickCheckJob(input: {
  key: string; tenantKey: string; extensionKey: string;
  resolveWorkspaceIds: () => Promise<readonly string[]>;
}): SignalCollectionJob {
  return {
    key: input.key,
    tenantKey: input.tenantKey,
    extensionKey: input.extensionKey,
    label: "CAIO quick check",
    kind: "signal_collection",
    // Exact "true" only; any other value, including "1" or "TRUE", keeps the job off.
    enabled: () => process.env[CAIO_QUICK_CHECK_ENABLED_ENV] === "true",
    schedule: { timeEnvKey: "HELM_CAIO_QUICK_CHECK_CRON", defaultCron: "*/10 * * * *", defaultTimezone: "Asia/Shanghai" },
    allowedEffects: ["external_read", "internal_signal_write"],
    resolveTargets: async () => (await input.resolveWorkspaceIds()).map((workspaceId) => ({ key: `workspace:${workspaceId}`, workspaceId })),
    runTarget: async (target) => {
      if (!target.workspaceId) return { status: "skipped", message: "workspace_required" };
      const result = await runCaioQuickCheck({ workspaceId: target.workspaceId });
      if (result.status === "claimed_elsewhere") return { status: "skipped", message: "claimed_elsewhere" };
      return {
        status: result.status === "completed" ? "success" : "failed",
        signalCount: result.opened + result.refreshed,
        failureCount: result.failedDetectors,
        details: { known: result.known, unknown: result.unknown, cleared: result.cleared, skippedDetectors: result.skippedDetectors },
      };
    },
  };
}
