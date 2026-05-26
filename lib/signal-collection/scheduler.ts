import type {
  SignalCollectionJob,
  SignalCollectionJobRunSummary,
  SignalCollectionRunContext,
  SignalCollectionRunSummary,
  SignalCollectionTarget,
  SignalCollectionTargetRunSummary,
} from "@/lib/signal-collection/types";

export type DailySchedule = {
  hour: number;
  minute: number;
};

export type MinuteHourCronSchedule = {
  hours: readonly number[];
  minutes: readonly number[];
};

type RunnableSchedule = DailySchedule | MinuteHourCronSchedule;

type SchedulerState = {
  started: boolean;
  timers: NodeJS.Timeout[];
};

declare global {
  var __helmSignalCollectionSchedulerStates:
    | Record<string, SchedulerState>
    | undefined;
}

export function parseBooleanFlag(
  value: string | undefined,
  options: { defaultValue: boolean },
) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return options.defaultValue;
  }
  if (["1", "true", "on", "yes"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "off", "no"].includes(normalized)) {
    return false;
  }
  return options.defaultValue;
}

export function parseCommaSeparatedList(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function parseDailySchedule(value: string): DailySchedule | null {
  const schedule = parseMinuteHourCronSchedule(value);
  if (!schedule || schedule.hours.length !== 1 || schedule.minutes.length !== 1) {
    return null;
  }

  return { hour: schedule.hours[0]!, minute: schedule.minutes[0]! };
}

export function parseMinuteHourCronSchedule(value: string): MinuteHourCronSchedule | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minutePart, hourPart, dayOfMonth, month, dayOfWeek] = parts;
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    return null;
  }

  const minutes = parseCronField(minutePart, { min: 0, max: 59 });
  const hours = parseCronField(hourPart, { min: 0, max: 23 });
  if (!minutes || !hours) {
    return null;
  }

  return { hours, minutes };
}

function parseCronField(
  value: string,
  range: { min: number; max: number },
): readonly number[] | null {
  const values = new Set<number>();
  const parts = value.split(",");
  if (parts.length === 0) {
    return null;
  }

  for (const part of parts) {
    const parsed = parseCronFieldPart(part.trim(), range);
    if (!parsed) {
      return null;
    }
    for (const item of parsed) {
      values.add(item);
    }
  }

  return [...values].sort((a, b) => a - b);
}

function parseCronFieldPart(
  part: string,
  range: { min: number; max: number },
): readonly number[] | null {
  if (!part) {
    return null;
  }

  const [base, stepRaw] = part.split("/");
  if (part.includes("/") && !stepRaw) {
    return null;
  }
  const step = stepRaw ? Number(stepRaw) : 1;
  if (!Number.isInteger(step) || step < 1) {
    return null;
  }

  let from: number;
  let to: number;
  if (base === "*") {
    from = range.min;
    to = range.max;
  } else if (base?.includes("-")) {
    const [fromRaw, toRaw] = base.split("-");
    from = Number(fromRaw);
    to = Number(toRaw);
  } else {
    from = Number(base);
    to = Number(base);
  }

  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < range.min ||
    to > range.max ||
    from > to
  ) {
    return null;
  }

  const out: number[] = [];
  for (let value = from; value <= to; value += step) {
    out.push(value);
  }
  return out;
}

export function findNextRun(
  from: Date,
  schedule: RunnableSchedule,
  timezone: string,
) {
  let cursor = alignToNextMinute(from);
  for (let index = 0; index < 60 * 24 * 8; index += 1) {
    const parts = getTimeZoneParts(cursor, timezone);
    if (scheduleMatches(parts, schedule)) {
      return cursor;
    }
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

export async function runSignalCollectionJobs(input: {
  jobs: readonly SignalCollectionJob[];
  jobKeys?: readonly string[];
  now?: Date;
  source?: SignalCollectionRunContext["source"];
}): Promise<SignalCollectionRunSummary> {
  const requestedAt = input.now ?? new Date();
  const windowDate = requestedAt.toISOString().slice(0, 10);
  const selectedKeys = input.jobKeys ? new Set(input.jobKeys) : null;
  const jobs = selectedKeys
    ? input.jobs.filter((job) => selectedKeys.has(job.key))
    : [...input.jobs];

  const jobSummaries: SignalCollectionJobRunSummary[] = [];
  for (const job of jobs) {
    jobSummaries.push(
      await runSingleJob({
        job,
        requestedAt,
        windowDate,
        source: input.source ?? "api",
      }),
    );
  }

  const successCount = jobSummaries.reduce((sum, job) => sum + job.successCount, 0);
  const failureCount = jobSummaries.reduce((sum, job) => sum + job.failureCount, 0);
  const skippedCount = jobSummaries.reduce((sum, job) => sum + job.skippedCount, 0);
  const targetCount = jobSummaries.reduce((sum, job) => sum + job.targetCount, 0);

  return {
    ok: failureCount === 0,
    requestedAt: requestedAt.toISOString(),
    windowDate,
    jobCount: jobSummaries.length,
    targetCount,
    successCount,
    failureCount,
    skippedCount,
    jobs: jobSummaries,
  };
}

export function startSignalCollectionScheduler(input: {
  jobs: readonly SignalCollectionJob[];
  stateKey: string;
  source?: SignalCollectionRunContext["source"];
}) {
  if (process.env.NODE_ENV === "test") {
    logSchedulerInfo("skipped in test env", {
      stateKey: input.stateKey,
    });
    return;
  }

  logSchedulerInfo("start requested", {
    stateKey: input.stateKey,
    source: input.source ?? "scheduler",
    jobCount: input.jobs.length,
  });

  const states = (global.__helmSignalCollectionSchedulerStates ??= {});
  const state = (states[input.stateKey] ??= { started: false, timers: [] });
  if (state.started) {
    logSchedulerInfo("already started", {
      stateKey: input.stateKey,
      timerCount: state.timers.length,
    });
    return;
  }
  state.started = true;

  for (const job of input.jobs) {
    if (!job.enabled()) {
      logSchedulerInfo("job disabled", {
        stateKey: input.stateKey,
        jobKey: job.key,
      });
      continue;
    }

    const startCheck = job.canStart?.();
    if (startCheck && !startCheck.ok) {
      logSchedulerWarn("job cannot start", {
        stateKey: input.stateKey,
        jobKey: job.key,
        reason: startCheck.reason,
      });
      continue;
    }

    scheduleJob({
      job,
      state,
      source: input.source ?? "scheduler",
    });
  }
}

async function runSingleJob(input: {
  job: SignalCollectionJob;
  requestedAt: Date;
  windowDate: string;
  source: SignalCollectionRunContext["source"];
}): Promise<SignalCollectionJobRunSummary> {
  const { job, requestedAt, windowDate, source } = input;
  if (!job.enabled()) {
    return {
      jobKey: job.key,
      status: "skipped",
      targetCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 1,
      runs: [],
      message: "job_disabled",
    };
  }

  const startCheck = job.canStart?.();
  if (startCheck && !startCheck.ok) {
    return {
      jobKey: job.key,
      status: "failed",
      targetCount: 0,
      successCount: 0,
      failureCount: 1,
      skippedCount: 0,
      runs: [],
      message: startCheck.reason,
    };
  }

  let targets: SignalCollectionTarget[];
  try {
    targets = await job.resolveTargets();
  } catch (error) {
    return {
      jobKey: job.key,
      status: "failed",
      targetCount: 0,
      successCount: 0,
      failureCount: 1,
      skippedCount: 0,
      runs: [],
      message: errorMessage(error),
    };
  }

  if (targets.length === 0) {
    return {
      jobKey: job.key,
      status: "skipped",
      targetCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 1,
      runs: [],
      message: "no_targets",
    };
  }

  const runs: SignalCollectionTargetRunSummary[] = [];
  for (const target of targets) {
    const traceId = buildTraceId(job.key, target.key, requestedAt);
    try {
      const result = await job.runTarget(target, {
        jobKey: job.key,
        targetKey: target.key,
        traceId,
        requestedAt,
        windowDate,
        source,
      });
      runs.push({
        jobKey: job.key,
        targetKey: target.key,
        status: result.status,
        traceId,
        message: result.message,
        signalCount: result.signalCount ?? 0,
        failureCount: result.failureCount ?? (result.status === "failed" ? 1 : 0),
        details: result.details,
      });
    } catch (error) {
      runs.push({
        jobKey: job.key,
        targetKey: target.key,
        status: "failed",
        traceId,
        message: errorMessage(error),
        signalCount: 0,
        failureCount: 1,
      });
    }
  }

  const successCount = runs.filter((run) => run.status === "success").length;
  const failureCount = runs.reduce((sum, run) => sum + run.failureCount, 0);
  const skippedCount = runs.filter((run) => run.status === "skipped").length;

  return {
    jobKey: job.key,
    status: failureCount > 0 ? "failed" : skippedCount === runs.length ? "skipped" : "success",
    targetCount: targets.length,
    successCount,
    failureCount,
    skippedCount,
    runs,
  };
}

function scheduleJob(input: {
  job: SignalCollectionJob;
  state: SchedulerState;
  source: SignalCollectionRunContext["source"];
}) {
  const { job, state, source } = input;
  const configuredCron =
    process.env[job.schedule.timeEnvKey]?.trim() || job.schedule.defaultCron;
  const schedule =
    parseMinuteHourCronSchedule(configuredCron) ??
    parseMinuteHourCronSchedule(job.schedule.defaultCron);
  if (!schedule) {
    logSchedulerError("invalid schedule config", {
      jobKey: job.key,
      configuredCron,
      defaultCron: job.schedule.defaultCron,
    });
    return;
  }

  const timezone =
    (job.schedule.timezoneEnvKey
      ? process.env[job.schedule.timezoneEnvKey]?.trim()
      : "") || job.schedule.defaultTimezone;

  const scheduleNext = () => {
    const now = new Date();
    const nextRun = findNextRun(now, schedule, timezone);
    const delayMs = Math.max(1_000, nextRun.getTime() - now.getTime());
    logSchedulerInfo("job scheduled", {
      jobKey: job.key,
      configuredCron,
      timezone,
      nextRun: nextRun.toISOString(),
      delayMs,
    });
    const timer = setTimeout(async () => {
      try {
        logSchedulerInfo("job triggered", {
          jobKey: job.key,
          triggeredAt: new Date().toISOString(),
        });
        const summary = await runSignalCollectionJobs({
          jobs: [job],
          source,
        });
        logSchedulerInfo("job completed", {
          jobKey: job.key,
          ok: summary.ok,
          targetCount: summary.targetCount,
          successCount: summary.successCount,
          failureCount: summary.failureCount,
          skippedCount: summary.skippedCount,
          jobs: summary.jobs,
        });
        if (!summary.ok) {
          logSchedulerError("job run failed", {
            jobKey: job.key,
            failureCount: summary.failureCount,
            jobs: summary.jobs,
          });
        }
      } catch (error) {
        logSchedulerError("job crashed", {
          jobKey: job.key,
          error: errorMessage(error),
        });
      } finally {
        scheduleNext();
      }
    }, delayMs);
    state.timers.push(timer);
  };

  scheduleNext();
}

function scheduleMatches(
  parts: { hour: number; minute: number },
  schedule: RunnableSchedule,
) {
  if ("hour" in schedule) {
    return parts.hour === schedule.hour && parts.minute === schedule.minute;
  }

  return schedule.hours.includes(parts.hour) && schedule.minutes.includes(parts.minute);
}

function alignToNextMinute(value: Date) {
  const aligned = new Date(value);
  aligned.setSeconds(0, 0);
  aligned.setMinutes(aligned.getMinutes() + 1);
  return aligned;
}

function getTimeZoneParts(value: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour, minute };
}

function buildTraceId(jobKey: string, targetKey: string, requestedAt: Date) {
  const normalizedJob = jobKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const normalizedTarget = targetKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${normalizedJob}:${normalizedTarget}:${requestedAt.getTime()}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logSchedulerInfo(message: string, details?: Record<string, unknown>) {
  console.info(formatSchedulerLog(message, details));
}

function logSchedulerWarn(message: string, details?: Record<string, unknown>) {
  console.warn(formatSchedulerLog(message, details));
}

function logSchedulerError(message: string, details?: Record<string, unknown>) {
  console.error(formatSchedulerLog(message, details));
}

function formatSchedulerLog(message: string, details?: Record<string, unknown>) {
  if (!details) {
    return `[signal-collection-scheduler] ${message}`;
  }
  return `[signal-collection-scheduler] ${message} ${JSON.stringify(details)}`;
}
