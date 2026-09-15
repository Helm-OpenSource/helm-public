import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Run ledger on an isolated MySQL database.
 *
 *   SIGNAL_RUN_LEDGER_DATABASE_URL=<disposable helm_signal_run_ledger_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/signal-collection/run-ledger.service.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";

import type { SignalCollectionJobRunEntry } from "./run-ledger";
import {
  pruneSignalCollectionJobRuns,
  readSignalCollectionJobRunSummary,
  recordSignalCollectionJobRun,
  SignalCollectionRunLedgerError,
} from "./run-ledger.service";

const integrationDatabaseUrl = process.env.SIGNAL_RUN_LEDGER_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const ENABLED = { HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED: "true" };
const DAY_MS = 86_400_000;
const tenantKey = `t${process.pid}${Date.now()}`.slice(0, 32);

function entry(overrides: Partial<SignalCollectionJobRunEntry> = {}): SignalCollectionJobRunEntry {
  const startedAt = overrides.startedAt ?? new Date("2026-09-16T01:00:00.000Z");
  return {
    jobKey: "tenant.caio.quick-check",
    tenantKey,
    extensionKey: "tenant-caio",
    source: "scheduler",
    outcome: "succeeded",
    errorCode: null,
    startedAt,
    finishedAt: new Date(startedAt.getTime() + 1_500),
    targetCount: 1,
    successCount: 1,
    failureCount: 0,
    skippedCount: 0,
    ...overrides,
  };
}

describeMysql("signal collection run ledger with an isolated MySQL database", () => {
  beforeAll(() => {
    const databaseName = new URL(integrationDatabaseUrl!).pathname.replace(/^\//u, "");
    if (process.env.DATABASE_URL !== integrationDatabaseUrl || !databaseName.startsWith("helm_signal_run_ledger_")) {
      throw new Error("Refusing run ledger integration test: use a disposable helm_signal_run_ledger_* database as DATABASE_URL.");
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("writes nothing while the ledger switch is off", async () => {
    await recordSignalCollectionJobRun(entry(), { env: {} });
    await recordSignalCollectionJobRun(entry(), { env: { HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED: "TRUE" } });
    expect(await db.signalCollectionJobRun.count({ where: { tenantKey } })).toBe(0);
  });

  it("writes closed-set rows with the measured duration", async () => {
    await recordSignalCollectionJobRun(entry(), { env: ENABLED });
    const rows = await db.signalCollectionJobRun.findMany({ where: { tenantKey } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "succeeded", errorCode: null, durationMs: 1_500, targetCount: 1 });
  });

  it("rejects entries outside the closed sets before touching the database", async () => {
    for (const bad of [
      entry({ outcome: "exploded" as never }),
      entry({ errorCode: "raw message" as never }),
      entry({ failureCount: -1 }),
      entry({ finishedAt: new Date("2026-09-16T00:00:00.000Z") }),
      entry({ tenantKey: "x".repeat(65) }),
    ]) {
      await expect(recordSignalCollectionJobRun(bad, { env: ENABLED })).rejects.toBeInstanceOf(SignalCollectionRunLedgerError);
    }
    expect(await db.signalCollectionJobRun.count({ where: { tenantKey } })).toBe(1);
  });

  it("summarizes runs per job with the latest outcome", async () => {
    const base = new Date("2026-09-16T02:00:00.000Z").getTime();
    await recordSignalCollectionJobRun(entry({ startedAt: new Date(base), outcome: "failed", errorCode: "target_failed", successCount: 0, failureCount: 1 }), { env: ENABLED });
    await recordSignalCollectionJobRun(entry({ startedAt: new Date(base + 600_000), outcome: "crashed", errorCode: "scheduler_job_crashed", targetCount: 0, successCount: 0 }), { env: ENABLED });
    await recordSignalCollectionJobRun(entry({ jobKey: "tenant.review.hourly", startedAt: new Date(base), outcome: "skipped", errorCode: "no_targets", targetCount: 0, successCount: 0, skippedCount: 1 }), { env: ENABLED });

    const summary = await readSignalCollectionJobRunSummary({ tenantKey, since: new Date("2026-09-16T00:00:00.000Z") });
    expect(summary).toEqual([
      { jobKey: "tenant.caio.quick-check", runs: 3, succeeded: 1, failed: 1, crashed: 1, skipped: 0, lastOutcome: "crashed", lastFinishedAt: new Date(base + 601_500) },
      { jobKey: "tenant.review.hourly", runs: 1, succeeded: 0, failed: 0, crashed: 0, skipped: 1, lastOutcome: "skipped", lastFinishedAt: new Date(base + 1_500) },
    ]);
    expect(await readSignalCollectionJobRunSummary({ tenantKey, since: new Date(base + 700_000) })).toEqual([]);
  });

  it("prunes only rows older than the retention window", async () => {
    const now = new Date("2026-10-20T00:00:00.000Z");
    await recordSignalCollectionJobRun(entry({ startedAt: new Date(now.getTime() - 31 * DAY_MS) }), { env: ENABLED, now: new Date(0) });
    await recordSignalCollectionJobRun(entry({ startedAt: new Date(now.getTime() - 29 * DAY_MS) }), { env: ENABLED, now: new Date(0) });
    const before = await db.signalCollectionJobRun.count({ where: { tenantKey } });

    const removed = await pruneSignalCollectionJobRuns({ now });
    expect(removed).toBeGreaterThanOrEqual(5);
    const remaining = await db.signalCollectionJobRun.findMany({ where: { tenantKey } });
    expect(remaining).toHaveLength(before - 5);
    expect(remaining.every((row) => row.finishedAt.getTime() >= now.getTime() - 30 * DAY_MS)).toBe(true);
  });
});
