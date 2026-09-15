import "server-only";

import { db } from "@/lib/db";
import {
  isSignalCollectionRunErrorCode,
  isSignalCollectionRunLedgerEnabled,
  SIGNAL_COLLECTION_RUN_OUTCOMES,
  type SignalCollectionJobRunEntry,
  type SignalCollectionRunOutcome,
} from "@/lib/signal-collection/run-ledger";

const DAY_MS = 86_400_000;
const PRUNE_INTERVAL_MS = 3_600_000;
const DEFAULT_RETENTION_DAYS = 30;

export class SignalCollectionRunLedgerError extends Error {
  readonly code = "invalid_run_ledger_entry" as const;

  constructor() {
    super("invalid_run_ledger_entry");
    this.name = "SignalCollectionRunLedgerError";
  }
}

export type SignalCollectionJobRunSummaryRow = {
  jobKey: string;
  runs: number;
  succeeded: number;
  failed: number;
  crashed: number;
  skipped: number;
  lastOutcome: SignalCollectionRunOutcome | null;
  lastFinishedAt: Date | null;
};

let lastPruneAtMs = Number.NEGATIVE_INFINITY;

/** Records one job run when the ledger switch is on; a no-op otherwise. Invalid entries are refused. */
export async function recordSignalCollectionJobRun(
  entry: SignalCollectionJobRunEntry,
  options: { env?: Record<string, string | undefined>; now?: Date } = {},
): Promise<void> {
  if (!isSignalCollectionRunLedgerEnabled(options.env)) {
    return;
  }
  assertValidEntry(entry);
  await db.signalCollectionJobRun.create({
    data: {
      jobKey: entry.jobKey,
      tenantKey: entry.tenantKey,
      extensionKey: entry.extensionKey,
      source: entry.source,
      outcome: entry.outcome,
      errorCode: entry.errorCode,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      durationMs: entry.finishedAt.getTime() - entry.startedAt.getTime(),
      targetCount: entry.targetCount,
      successCount: entry.successCount,
      failureCount: entry.failureCount,
      skippedCount: entry.skippedCount,
    },
  });

  const nowMs = (options.now ?? new Date()).getTime();
  if (nowMs - lastPruneAtMs >= PRUNE_INTERVAL_MS) {
    lastPruneAtMs = nowMs;
    await pruneSignalCollectionJobRuns({ now: new Date(nowMs) });
  }
}

export async function pruneSignalCollectionJobRuns(input: {
  now: Date;
  retentionDays?: number;
}): Promise<number> {
  const cutoff = new Date(input.now.getTime() - (input.retentionDays ?? DEFAULT_RETENTION_DAYS) * DAY_MS);
  const result = await db.signalCollectionJobRun.deleteMany({ where: { finishedAt: { lt: cutoff } } });
  return result.count;
}

export async function readSignalCollectionJobRunSummary(input: {
  tenantKey: string;
  since: Date;
}): Promise<SignalCollectionJobRunSummaryRow[]> {
  const groups = await db.signalCollectionJobRun.groupBy({
    by: ["jobKey", "outcome"],
    where: { tenantKey: input.tenantKey, finishedAt: { gte: input.since } },
    _count: { _all: true },
    _max: { finishedAt: true },
  });

  const rows = new Map<string, SignalCollectionJobRunSummaryRow>();
  for (const group of groups) {
    const row = rows.get(group.jobKey) ?? {
      jobKey: group.jobKey,
      runs: 0,
      succeeded: 0,
      failed: 0,
      crashed: 0,
      skipped: 0,
      lastOutcome: null,
      lastFinishedAt: null,
    };
    if (!isOutcome(group.outcome)) {
      continue;
    }
    row.runs += group._count._all;
    row[group.outcome] += group._count._all;
    const finishedAt = group._max.finishedAt;
    if (finishedAt && (!row.lastFinishedAt || finishedAt > row.lastFinishedAt)) {
      row.lastFinishedAt = finishedAt;
      row.lastOutcome = group.outcome;
    }
    rows.set(group.jobKey, row);
  }
  return [...rows.values()].sort((a, b) => a.jobKey.localeCompare(b.jobKey));
}

function isOutcome(value: string): value is SignalCollectionRunOutcome {
  return (SIGNAL_COLLECTION_RUN_OUTCOMES as readonly string[]).includes(value);
}

function assertValidEntry(entry: SignalCollectionJobRunEntry) {
  const counts = [entry.targetCount, entry.successCount, entry.failureCount, entry.skippedCount];
  const valid =
    isOutcome(entry.outcome) &&
    (entry.errorCode === null || isSignalCollectionRunErrorCode(entry.errorCode)) &&
    boundedText(entry.jobKey, 191) &&
    boundedText(entry.tenantKey, 64) &&
    boundedText(entry.extensionKey, 191) &&
    boundedText(entry.source, 32) &&
    counts.every((count) => Number.isSafeInteger(count) && count >= 0) &&
    entry.startedAt instanceof Date &&
    entry.finishedAt instanceof Date &&
    entry.finishedAt.getTime() >= entry.startedAt.getTime();
  if (!valid) {
    throw new SignalCollectionRunLedgerError();
  }
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}
