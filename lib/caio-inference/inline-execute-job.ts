import "server-only";

import type { SignalCollectionJob, SignalCollectionTargetResult } from "@/lib/signal-collection/types";

import type { CaioInferenceRejectionCode, CaioInferenceTaskClass } from "./contracts";
import type { CaioInferenceInlineDispatchHandle } from "./inline-dispatch";
import {
  finalizeCaioInferenceInlineJudgement,
  markCaioInferenceInlineInDoubt,
  rejectCaioInferenceInlineJob,
  reserveCaioInferenceJobForInline,
} from "./job-store.service";
import { CAIO_REVIEW_SCHEDULES, isCaioReviewEnabled } from "./review-jobs";

/**
 * Scheduler job that executes queued inference jobs in-process through the governed gateway, replacing the
 * device worker's claim/submit for deployments whose model route is reachable from the server.
 *
 * Order per job: reserve (short DB transaction, preparation lease) -> projection + ONE gateway call (no
 * database transaction is open while the network is in flight) -> one compare-and-swap terminal write on
 * the reservation tuple. A thread whose reservation was superseded writes nothing; a reservation whose
 * thread died is marked `in_doubt` by reconciliation and is never requeued.
 *
 * Before every reservation the job re-checks the task-class switch (exactly "true"), the review working
 * window in the review schedule's own timezone, and the injected stop guard. Any miss skips the tick and
 * leaves the queue untouched: a backlog is not consumed outside the window or under a stop.
 */
export const CAIO_INLINE_EXECUTE_CRON_ENV = "HELM_CAIO_INLINE_EXECUTE_CRON";
export const CAIO_INLINE_EXECUTE_DEFAULT_CRON = "*/5 * * * *";
export const CAIO_REVIEW_TIMEZONE = "Asia/Shanghai";

export type CaioInferenceInlineGuards = {
  /** True when a guardian stop or a non-active mandate forbids new dispatches for the workspace. */
  isStopped: (workspaceId: string) => Promise<boolean>;
};

/** Hours (inclusive, local to the review timezone) in which the review cron fires, read from the cron itself. */
export function caioReviewWorkingHours(taskClass: CaioInferenceTaskClass): { fromHour: number; toHour: number } {
  const hourField = CAIO_REVIEW_SCHEDULES[taskClass].defaultCron.split(" ")[1] ?? "*";
  if (hourField === "*") return { fromHour: 0, toHour: 23 };
  const range = /^(\d{1,2})(?:-(\d{1,2}))?$/u.exec(hourField);
  if (!range) throw new Error(`unsupported review cron hour field: ${hourField}`);
  const fromHour = Number(range[1]);
  return { fromHour, toHour: range[2] === undefined ? fromHour : Number(range[2]) };
}

const hourFormatter = new Intl.DateTimeFormat("en-US", { timeZone: CAIO_REVIEW_TIMEZONE, hour: "numeric", hourCycle: "h23" });

export function isWithinCaioReviewWorkingWindow(now: Date, taskClass: CaioInferenceTaskClass = "hourly_diagnosis"): boolean {
  const { fromHour, toHour } = caioReviewWorkingHours(taskClass);
  const hour = Number(hourFormatter.formatToParts(now).find((part) => part.type === "hour")?.value);
  return Number.isFinite(hour) && hour >= fromHour && hour <= toHour;
}

type InlineTickCounts = {
  completed: number;
  replayed: number;
  rejected: number;
  inDoubt: number;
  outputLost: number;
  stale: number;
};

export function createCaioInferenceInlineExecuteJob(input: {
  key: string;
  tenantKey: string;
  extensionKey: string;
  resolveWorkspaceIds: () => Promise<readonly string[]>;
  dispatchHandle: CaioInferenceInlineDispatchHandle;
  guards: CaioInferenceInlineGuards;
  /** First version only executes the hourly diagnosis; the daily review stays on the worker path. */
  taskClass?: Extract<CaioInferenceTaskClass, "hourly_diagnosis">;
  maxJobsPerTick?: number;
  preparationLeaseMs?: number;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}): SignalCollectionJob {
  const taskClass: CaioInferenceTaskClass = input.taskClass ?? "hourly_diagnosis";
  const maxJobsPerTick = Math.max(1, Math.floor(input.maxJobsPerTick ?? 1));
  const env = input.env ?? process.env;
  return {
    key: input.key,
    tenantKey: input.tenantKey,
    extensionKey: input.extensionKey,
    label: "CAIO hourly diagnosis inline execute",
    kind: "signal_collection",
    enabled: () => isCaioReviewEnabled(taskClass, env),
    schedule: {
      timeEnvKey: CAIO_INLINE_EXECUTE_CRON_ENV,
      defaultCron: CAIO_INLINE_EXECUTE_DEFAULT_CRON,
      defaultTimezone: CAIO_REVIEW_TIMEZONE,
    },
    // The gateway call leaves the deployment (a governed outbound model request); the judgement lands in
    // the queue's own table. Declared honestly even though the scheduler does not enforce the set.
    allowedEffects: ["external_read", "internal_signal_write"],
    resolveTargets: async () =>
      (await input.resolveWorkspaceIds()).map((workspaceId) => ({ key: `workspace:${workspaceId}`, workspaceId })),
    runTarget: async (target, context): Promise<SignalCollectionTargetResult> => {
      const workspaceId = target.workspaceId;
      if (!workspaceId) return { status: "skipped", message: "workspace_required" };
      const now = input.now ? input.now() : context.requestedAt;
      if (!isCaioReviewEnabled(taskClass, env)) return { status: "skipped", message: "task_class_disabled" };
      if (!isWithinCaioReviewWorkingWindow(now, taskClass)) return { status: "skipped", message: "outside_working_window" };

      const counts: InlineTickCounts = { completed: 0, replayed: 0, rejected: 0, inDoubt: 0, outputLost: 0, stale: 0 };
      let reservations = 0;
      let stopped = false;
      for (let index = 0; index < maxJobsPerTick; index += 1) {
        // Re-read the stop guard before every dispatch: a stop recorded mid-tick halts the next job.
        if (await input.guards.isStopped(workspaceId)) {
          stopped = true;
          break;
        }
        const reserved = await reserveCaioInferenceJobForInline({
          workspaceId,
          gatewayRef: input.dispatchHandle.gatewayRef,
          taskClass,
          now,
          ...(input.preparationLeaseMs === undefined ? {} : { preparationLeaseMs: input.preparationLeaseMs }),
        });
        if (reserved.status === "none") break;
        reservations += 1;
        if (reserved.status === "rejected") {
          counts.rejected += 1;
          continue;
        }

        const execution = await input.dispatchHandle.execute({
          workspaceId,
          jobId: reserved.jobId,
          attempt: reserved.attempt,
          taskClass: reserved.taskClass,
          inferenceInput: reserved.input,
        });
        const key = { workspaceId, jobId: reserved.jobId, claimToken: reserved.claimToken, attempt: reserved.attempt };
        const binding = { decisionRef: execution.decisionRef, claimHash: execution.claimHash, gatewayRef: input.dispatchHandle.gatewayRef };
        const settledAt = input.now ? input.now() : new Date();
        const reject = async (code: CaioInferenceRejectionCode) => {
          const outcome = await rejectCaioInferenceInlineJob({ ...key, ...binding, code, now: settledAt });
          if (outcome === "stale") counts.stale += 1;
          else if (code === "output_lost") counts.outputLost += 1;
          else counts.rejected += 1;
        };
        switch (execution.status) {
          case "completed": {
            const finalized = await finalizeCaioInferenceInlineJudgement({
              ...key,
              inputHash: reserved.inputHash,
              output: execution.output,
              decisionRef: execution.decisionRef,
              gatewayRef: execution.gatewayRef,
              claimHash: execution.claimHash,
              terminalOutputHash: execution.terminalOutputHash,
              now: settledAt,
            });
            if (finalized.status === "completed") counts.completed += 1;
            else if (finalized.status === "replayed") counts.replayed += 1;
            else if (finalized.status === "rejected") counts.rejected += 1;
            else counts.stale += 1;
            break;
          }
          case "in_doubt": {
            const marked = await markCaioInferenceInlineInDoubt({ ...key, ...binding, now: settledAt });
            if (marked === "marked") counts.inDoubt += 1;
            else counts.stale += 1;
            break;
          }
          case "output_lost":
            await reject("output_lost");
            break;
          case "failed":
            await reject("provider_failure");
            break;
          case "blocked":
          default:
            await reject("dispatch_claim_denied");
            break;
        }
      }

      const failureCount = counts.inDoubt + counts.outputLost + counts.rejected + counts.stale;
      if (reservations === 0) {
        return { status: "skipped", message: stopped ? "guardian_stop" : "no_queued_job", details: counts };
      }
      return {
        status: counts.inDoubt > 0 ? "failed" : "success",
        message: stopped ? "guardian_stop" : counts.inDoubt > 0 ? "in_doubt" : "executed",
        signalCount: counts.completed + counts.replayed,
        failureCount,
        details: { ...counts, reservations, maxJobsPerTick },
      };
    },
  };
}
