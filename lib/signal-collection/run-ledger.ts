import type {
  SignalCollectionJob,
  SignalCollectionJobRunSummary,
  SignalCollectionRunContext,
  SignalCollectionRunErrorCode,
} from "@/lib/signal-collection/types";

/**
 * Operational run ledger entries for signal-collection jobs. An entry carries closed-set outcomes and
 * counts only: job and target messages may contain tenant data, so they are never copied here.
 */
export const SIGNAL_COLLECTION_RUN_OUTCOMES = ["succeeded", "failed", "crashed", "skipped"] as const;
export type SignalCollectionRunOutcome = (typeof SIGNAL_COLLECTION_RUN_OUTCOMES)[number];

export const SIGNAL_COLLECTION_RUN_ERROR_CODES = [
  "job_disabled",
  "no_targets",
  "start_check_failed",
  "resolve_targets_failed",
  "target_failed",
  "scheduler_job_crashed",
] as const satisfies readonly SignalCollectionRunErrorCode[];

export const SIGNAL_COLLECTION_RUN_LEDGER_ENV = "HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED";

export type SignalCollectionJobRunEntry = {
  jobKey: string;
  tenantKey: string;
  extensionKey: string;
  source: SignalCollectionRunContext["source"];
  outcome: SignalCollectionRunOutcome;
  errorCode: SignalCollectionRunErrorCode | null;
  startedAt: Date;
  finishedAt: Date;
  targetCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
};

export type SignalCollectionRunRecorder = (entry: SignalCollectionJobRunEntry) => Promise<void>;

const OUTCOME_BY_STATUS: Record<SignalCollectionJobRunSummary["status"], SignalCollectionRunOutcome> = {
  success: "succeeded",
  failed: "failed",
  skipped: "skipped",
};

export function isSignalCollectionRunLedgerEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[SIGNAL_COLLECTION_RUN_LEDGER_ENV] === "true";
}

export function isSignalCollectionRunErrorCode(value: unknown): value is SignalCollectionRunErrorCode {
  return (SIGNAL_COLLECTION_RUN_ERROR_CODES as readonly unknown[]).includes(value);
}

export function buildSignalCollectionJobRunEntry(input: {
  job: SignalCollectionJob;
  source: SignalCollectionRunContext["source"];
  startedAt: Date;
  finishedAt: Date;
  summary: SignalCollectionJobRunSummary;
}): SignalCollectionJobRunEntry {
  const { job, summary } = input;
  return {
    jobKey: job.key,
    tenantKey: job.tenantKey,
    extensionKey: job.extensionKey,
    source: input.source,
    outcome: OUTCOME_BY_STATUS[summary.status],
    errorCode: isSignalCollectionRunErrorCode(summary.errorCode) ? summary.errorCode : null,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    targetCount: summary.targetCount,
    successCount: summary.successCount,
    failureCount: summary.failureCount,
    skippedCount: summary.skippedCount,
  };
}

export function buildCrashedSignalCollectionJobRunEntry(input: {
  job: SignalCollectionJob;
  source: SignalCollectionRunContext["source"];
  startedAt: Date;
  finishedAt: Date;
}): SignalCollectionJobRunEntry {
  return {
    jobKey: input.job.key,
    tenantKey: input.job.tenantKey,
    extensionKey: input.job.extensionKey,
    source: input.source,
    outcome: "crashed",
    errorCode: "scheduler_job_crashed",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    targetCount: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
  };
}
