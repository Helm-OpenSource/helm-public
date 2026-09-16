import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CAIO_DAILY_REVIEW_ENABLED_ENV,
  CAIO_HOURLY_REVIEW_ENABLED_ENV,
  CAIO_REVIEW_SCHEDULES,
  caioReviewWindow,
  isCaioReviewEnabled,
} from "./review-jobs";

describe("CAIO review schedules", () => {
  const originalHourly = process.env[CAIO_HOURLY_REVIEW_ENABLED_ENV];
  const originalDaily = process.env[CAIO_DAILY_REVIEW_ENABLED_ENV];

  beforeEach(() => {
    delete process.env[CAIO_HOURLY_REVIEW_ENABLED_ENV];
    delete process.env[CAIO_DAILY_REVIEW_ENABLED_ENV];
  });

  afterEach(() => {
    if (originalHourly === undefined) delete process.env[CAIO_HOURLY_REVIEW_ENABLED_ENV];
    else process.env[CAIO_HOURLY_REVIEW_ENABLED_ENV] = originalHourly;
    if (originalDaily === undefined) delete process.env[CAIO_DAILY_REVIEW_ENABLED_ENV];
    else process.env[CAIO_DAILY_REVIEW_ENABLED_ENV] = originalDaily;
    vi.unstubAllEnvs();
  });

  it("enables each task class only for the exact string true", () => {
    expect(isCaioReviewEnabled("hourly_diagnosis")).toBe(false);
    for (const value of ["TRUE", "1", "yes", " true"]) {
      expect(isCaioReviewEnabled("hourly_diagnosis", { [CAIO_HOURLY_REVIEW_ENABLED_ENV]: value })).toBe(false);
    }
    expect(isCaioReviewEnabled("hourly_diagnosis", { [CAIO_HOURLY_REVIEW_ENABLED_ENV]: "true" })).toBe(true);
    // The two classes are independent: one switch never turns the other on.
    expect(isCaioReviewEnabled("daily_review", { [CAIO_HOURLY_REVIEW_ENABLED_ENV]: "true" })).toBe(false);
  });

  it("keeps the hourly review inside working hours by default", () => {
    expect(CAIO_REVIEW_SCHEDULES.hourly_diagnosis.defaultCron).toBe("5 8-20 * * *");
    expect(CAIO_REVIEW_SCHEDULES.daily_review.defaultCron).toBe("40 20 * * *");
    for (const schedule of Object.values(CAIO_REVIEW_SCHEDULES)) {
      expect(schedule.defaultCron.split(" ")).toHaveLength(5);
    }
  });

  it("freezes only whole windows that already ended", () => {
    const now = new Date("2026-09-16T10:37:41.000Z");
    expect(caioReviewWindow("hourly_diagnosis", now)).toEqual({
      windowStart: new Date("2026-09-16T09:00:00.000Z"),
      windowEnd: new Date("2026-09-16T10:00:00.000Z"),
    });
    expect(caioReviewWindow("daily_review", now)).toEqual({
      windowStart: new Date("2026-09-15T00:00:00.000Z"),
      windowEnd: new Date("2026-09-16T00:00:00.000Z"),
    });
    // The window never extends into the current, still-open period.
    expect(caioReviewWindow("hourly_diagnosis", now).windowEnd.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
