import "server-only";

import type { SignalCollectionJob } from "@/lib/signal-collection/types";

import type { CaioInferenceTaskClass } from "./contracts";
import { buildCaioInferenceInput, type CaioInferenceSupplementPort } from "./input-builder";
import {
  enqueueCaioInferenceJob,
  reclaimCaioInferenceJobs,
  type CaioInferenceDispatchPort,
} from "./job-store.service";

/**
 * Scheduler jobs for the pull review loop, contributed by a tenant pack through signalCollectionJobs.
 *
 * Each task class is off unless its own switch is exactly "true". Enqueuing only freezes a window into a job
 * row: no model is called here, and nothing leaves the deployment until a worker claims the job through the
 * governed deferred dispatch.
 */
export const CAIO_HOURLY_REVIEW_ENABLED_ENV = "HELM_CAIO_HOURLY_REVIEW_ENABLED";
export const CAIO_DAILY_REVIEW_ENABLED_ENV = "HELM_CAIO_DAILY_REVIEW_ENABLED";

const HOUR_MS = 3_600_000;

export const CAIO_REVIEW_SCHEDULES: Readonly<
  Record<CaioInferenceTaskClass, { enabledEnv: string; timeEnvKey: string; defaultCron: string; windowMs: number }>
> = Object.freeze({
  // Working hours only (owner decision): a review that fires overnight would report a quiet system as an
  // outage and would ask a device that is not staffed to answer.
  hourly_diagnosis: {
    enabledEnv: CAIO_HOURLY_REVIEW_ENABLED_ENV,
    timeEnvKey: "HELM_CAIO_HOURLY_REVIEW_CRON",
    defaultCron: "5 8-20 * * *",
    windowMs: HOUR_MS,
  },
  daily_review: {
    enabledEnv: CAIO_DAILY_REVIEW_ENABLED_ENV,
    timeEnvKey: "HELM_CAIO_DAILY_REVIEW_CRON",
    defaultCron: "40 20 * * *",
    windowMs: 24 * HOUR_MS,
  },
});

export function isCaioReviewEnabled(taskClass: CaioInferenceTaskClass, env = process.env): boolean {
  return env[CAIO_REVIEW_SCHEDULES[taskClass].enabledEnv] === "true";
}

/** The closed window a run freezes: the whole periods before the run, never a partial current one. */
export function caioReviewWindow(taskClass: CaioInferenceTaskClass, now: Date): { windowStart: Date; windowEnd: Date } {
  const { windowMs } = CAIO_REVIEW_SCHEDULES[taskClass];
  const windowEnd = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  return { windowStart: new Date(windowEnd.getTime() - windowMs), windowEnd };
}

export function createCaioInferenceEnqueueJob(input: {
  key: string;
  tenantKey: string;
  extensionKey: string;
  taskClass: CaioInferenceTaskClass;
  resolveWorkspaceIds: () => Promise<readonly string[]>;
  supplements?: CaioInferenceSupplementPort;
}): SignalCollectionJob {
  const schedule = CAIO_REVIEW_SCHEDULES[input.taskClass];
  return {
    key: input.key,
    tenantKey: input.tenantKey,
    extensionKey: input.extensionKey,
    label: `CAIO ${input.taskClass === "hourly_diagnosis" ? "hourly diagnosis" : "daily review"} enqueue`,
    kind: "signal_collection",
    enabled: () => isCaioReviewEnabled(input.taskClass),
    schedule: {
      timeEnvKey: schedule.timeEnvKey,
      defaultCron: schedule.defaultCron,
      defaultTimezone: "Asia/Shanghai",
    },
    allowedEffects: ["internal_signal_write"],
    resolveTargets: async () =>
      (await input.resolveWorkspaceIds()).map((workspaceId) => ({ key: `workspace:${workspaceId}`, workspaceId })),
    runTarget: async (target, context) => {
      if (!target.workspaceId) return { status: "skipped", message: "workspace_required" };
      const { windowStart, windowEnd } = caioReviewWindow(input.taskClass, context.requestedAt);
      const inferenceInput = await buildCaioInferenceInput({
        workspaceId: target.workspaceId,
        taskClass: input.taskClass,
        windowStart,
        windowEnd,
        ...(input.supplements ? { supplements: input.supplements } : {}),
      });
      if (!inferenceInput) return { status: "skipped", message: "no_projected_snapshot" };
      const enqueued = await enqueueCaioInferenceJob({
        workspaceId: target.workspaceId,
        taskClass: input.taskClass,
        windowStart,
        windowEnd,
        input: inferenceInput,
        now: context.requestedAt,
      });
      return {
        status: enqueued.status === "enqueued" ? "success" : "skipped",
        signalCount: enqueued.status === "enqueued" ? 1 : 0,
        message: enqueued.status,
        details: {
          snapshots: inferenceInput.snapshotRefs.length,
          evidenceRefs: inferenceInput.evidenceRefs.length,
          supplements: inferenceInput.supplements.length,
        },
      };
    },
  };
}

export function createCaioInferenceReclaimJob(input: {
  key: string;
  tenantKey: string;
  extensionKey: string;
  dispatch: CaioInferenceDispatchPort;
  resolveWorkspaceIds: () => Promise<readonly string[]>;
  maxAttempts?: number;
}): SignalCollectionJob {
  return {
    key: input.key,
    tenantKey: input.tenantKey,
    extensionKey: input.extensionKey,
    label: "CAIO inference lease reclaim",
    kind: "signal_collection",
    // One switch on is enough: a lease left behind by either task class still has to be reconciled.
    enabled: () => isCaioReviewEnabled("hourly_diagnosis") || isCaioReviewEnabled("daily_review"),
    schedule: {
      timeEnvKey: "HELM_CAIO_REVIEW_RECLAIM_CRON",
      defaultCron: "*/15 * * * *",
      defaultTimezone: "Asia/Shanghai",
    },
    allowedEffects: ["internal_signal_write"],
    resolveTargets: async () =>
      (await input.resolveWorkspaceIds()).map((workspaceId) => ({ key: `workspace:${workspaceId}`, workspaceId })),
    runTarget: async (target, context) => {
      if (!target.workspaceId) return { status: "skipped", message: "workspace_required" };
      const outcome = await reclaimCaioInferenceJobs({
        workspaceId: target.workspaceId,
        dispatch: input.dispatch,
        now: context.requestedAt,
        ...(input.maxAttempts === undefined ? {} : { maxAttempts: input.maxAttempts }),
      });
      const touched = outcome.requeued + outcome.deadLettered + outcome.expired;
      return {
        status: "success",
        signalCount: touched,
        details: outcome,
      };
    },
  };
}
