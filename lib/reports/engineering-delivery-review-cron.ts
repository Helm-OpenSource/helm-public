import {
  ENGINEERING_REVIEW_CRON_TZ_FALLBACK,
  ENGINEERING_REVIEW_GIT_REVISION_FALLBACK,
  runEngineeringDeliveryDailyRefresh,
} from "@/lib/reports/engineering-delivery-review-refresh";

const DEFAULT_CRON_TIME = "0 6 * * *";

type DailySchedule = {
  hour: number;
  minute: number;
};

type CronRuntimeState = {
  started: boolean;
  timer: NodeJS.Timeout | null;
};

declare global {
  var __engineeringDeliveryReviewCronState: CronRuntimeState | undefined;
}

export function startEngineeringDeliveryReviewCron() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (!isCronEnabled(process.env.ENGINEERING_REVIEW_CRON_ENABLED)) {
    return;
  }

  const state = (global.__engineeringDeliveryReviewCronState ??= {
    started: false,
    timer: null,
  });

  if (state.started) {
    return;
  }

  state.started = true;

  const cronExpression = (process.env.ENGINEERING_REVIEW_CRON_TIME?.trim() || DEFAULT_CRON_TIME);
  const schedule = parseDailySchedule(cronExpression) ?? parseDailySchedule(DEFAULT_CRON_TIME)!;
  const timezone = process.env.ENGINEERING_REVIEW_CRON_TZ?.trim() || ENGINEERING_REVIEW_CRON_TZ_FALLBACK;
  const revision = process.env.ENGINEERING_REVIEW_GIT_REVISION?.trim() || ENGINEERING_REVIEW_GIT_REVISION_FALLBACK;

  const scheduleNext = () => {
    const now = new Date();
    const nextRun = findNextRun(now, schedule, timezone);
    const delayMs = Math.max(1_000, nextRun.getTime() - now.getTime());

    state.timer = setTimeout(async () => {
      try {
        const result = await runEngineeringDeliveryDailyRefresh({
          trigger: "cron",
          revision,
          timezone,
        });

        if (!result.ok && result.status === "FAILED") {
          console.error("[engineering-review-cron] refresh failed", result.error);
        }
      } catch (error) {
        console.error("[engineering-review-cron] unhandled refresh error", error);
      } finally {
        scheduleNext();
      }
    }, delayMs);
  };

  scheduleNext();
}

function isCronEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return !["0", "false", "off", "no"].includes(normalized);
}

function parseDailySchedule(value: string): DailySchedule | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minutePart, hourPart, dayOfMonth, month, dayOfWeek] = parts;
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    return null;
  }

  const minute = Number(minutePart);
  const hour = Number(hourPart);
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) {
    return null;
  }
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return null;
  }

  return {
    hour,
    minute,
  };
}

function findNextRun(from: Date, schedule: DailySchedule, timezone: string) {
  let cursor = alignToNextMinute(from);

  for (let index = 0; index < 60 * 24 * 8; index += 1) {
    const parts = getTimeZoneParts(cursor, timezone);
    if (parts.hour === schedule.hour && parts.minute === schedule.minute) {
      return cursor;
    }

    cursor = new Date(cursor.getTime() + 60_000);
  }

  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
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

  return {
    hour,
    minute,
  };
}
