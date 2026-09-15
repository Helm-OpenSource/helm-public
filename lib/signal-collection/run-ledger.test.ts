import { describe, expect, it } from "vitest";

import {
  buildCrashedSignalCollectionJobRunEntry,
  buildSignalCollectionJobRunEntry,
  isSignalCollectionRunLedgerEnabled,
} from "@/lib/signal-collection/run-ledger";
import type {
  SignalCollectionJob,
  SignalCollectionJobRunSummary,
} from "@/lib/signal-collection/types";

const job: SignalCollectionJob = {
  key: "tenant-alpha.signal.daily",
  tenantKey: "tenant-alpha",
  extensionKey: "tenant-alpha-signal",
  label: "Tenant Alpha signal",
  kind: "signal_collection",
  enabled: () => true,
  schedule: { timeEnvKey: "TENANT_ALPHA_SIGNAL_TIME", defaultCron: "0 8 * * *", defaultTimezone: "UTC" },
  allowedEffects: ["internal_signal_write"],
  resolveTargets: async () => [],
  runTarget: async () => ({ status: "success" }),
};

const startedAt = new Date("2026-09-16T01:00:00.000Z");
const finishedAt = new Date("2026-09-16T01:00:02.500Z");

function summary(overrides: Partial<SignalCollectionJobRunSummary>): SignalCollectionJobRunSummary {
  return {
    jobKey: job.key,
    status: "success",
    targetCount: 2,
    successCount: 2,
    failureCount: 0,
    skippedCount: 0,
    runs: [],
    ...overrides,
  };
}

describe("signal collection run ledger mapping", () => {
  it("maps a successful job run without an error code", () => {
    expect(buildSignalCollectionJobRunEntry({ job, source: "scheduler", startedAt, finishedAt, summary: summary({}) })).toEqual({
      jobKey: job.key,
      tenantKey: "tenant-alpha",
      extensionKey: "tenant-alpha-signal",
      source: "scheduler",
      outcome: "succeeded",
      errorCode: null,
      startedAt,
      finishedAt,
      targetCount: 2,
      successCount: 2,
      failureCount: 0,
      skippedCount: 0,
    });
  });

  it("keeps the closed-set error code of failed and skipped runs and never copies the message", () => {
    const failed = buildSignalCollectionJobRunEntry({
      job, source: "api", startedAt, finishedAt,
      summary: summary({ status: "failed", successCount: 1, failureCount: 1, errorCode: "target_failed", message: "row 7 contained a name" }),
    });
    expect(failed).toMatchObject({ outcome: "failed", errorCode: "target_failed", failureCount: 1 });
    expect(JSON.stringify(failed)).not.toContain("row 7");

    for (const errorCode of ["job_disabled", "no_targets"] as const) {
      expect(buildSignalCollectionJobRunEntry({
        job, source: "scheduler", startedAt, finishedAt,
        summary: summary({ status: "skipped", targetCount: 0, successCount: 0, skippedCount: 1, errorCode }),
      })).toMatchObject({ outcome: "skipped", errorCode });
    }
  });

  it("drops an error code that is outside the closed set", () => {
    const entry = buildSignalCollectionJobRunEntry({
      job, source: "scheduler", startedAt, finishedAt,
      summary: summary({ status: "failed", failureCount: 1, errorCode: "free text" as never }),
    });
    expect(entry.errorCode).toBeNull();
  });

  it("records a crash with zero counts", () => {
    expect(buildCrashedSignalCollectionJobRunEntry({ job, source: "scheduler", startedAt, finishedAt })).toMatchObject({
      outcome: "crashed",
      errorCode: "scheduler_job_crashed",
      targetCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
    });
  });

  it("enables the ledger only for the exact string true", () => {
    expect(isSignalCollectionRunLedgerEnabled({ HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED: "true" })).toBe(true);
    for (const value of ["TRUE", "1", "yes", " true", undefined]) {
      expect(isSignalCollectionRunLedgerEnabled({ HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED: value })).toBe(false);
    }
  });
});
