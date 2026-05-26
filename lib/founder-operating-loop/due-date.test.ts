import { describe, expect, it } from "vitest";

import {
  computeFounderLoopDueDate,
  computeFounderLoopDueDateIso,
  defaultIsBusinessDay,
  type HolidayCalendarFn,
} from "./due-date";

// A fixed reference Wednesday: 2026-05-20T12:00:00.000Z
const WEDNESDAY = new Date("2026-05-20T12:00:00.000Z");

// A fixed reference Friday: 2026-05-22T12:00:00.000Z
const FRIDAY = new Date("2026-05-22T12:00:00.000Z");

describe("computeFounderLoopDueDate — hour-based tiers", () => {
  it("critical → now + 24h", () => {
    const due = computeFounderLoopDueDate({
      riskLevel: "critical",
      now: WEDNESDAY,
    });
    expect(due?.toISOString()).toBe("2026-05-21T12:00:00.000Z");
  });

  it("high → now + 48h", () => {
    const due = computeFounderLoopDueDate({
      riskLevel: "high",
      now: WEDNESDAY,
    });
    expect(due?.toISOString()).toBe("2026-05-22T12:00:00.000Z");
  });

  it("hour-based tiers do not skip weekends — that's by spec", () => {
    const due = computeFounderLoopDueDate({
      riskLevel: "high",
      now: FRIDAY, // +48h lands on Sunday
    });
    expect(due?.getUTCDay()).toBe(0);
  });
});

describe("computeFounderLoopDueDate — business-day tiers", () => {
  it("medium → now + 5 business days (Mon–Fri default)", () => {
    // Wednesday + 5 business days = next Wednesday
    const due = computeFounderLoopDueDate({
      riskLevel: "medium",
      now: WEDNESDAY,
    });
    expect(due?.toISOString()).toBe("2026-05-27T12:00:00.000Z");
  });

  it("medium starting on Friday → next Friday (5 business days)", () => {
    const due = computeFounderLoopDueDate({
      riskLevel: "medium",
      now: FRIDAY,
    });
    expect(due?.toISOString()).toBe("2026-05-29T12:00:00.000Z");
  });

  it("low → now + 10 business days", () => {
    // Wednesday + 10 business days = Wednesday two weeks later
    const due = computeFounderLoopDueDate({
      riskLevel: "low",
      now: WEDNESDAY,
    });
    expect(due?.toISOString()).toBe("2026-06-03T12:00:00.000Z");
  });

  it("custom holiday calendar (e.g. national-day week) shifts dueDate", () => {
    // Calendar that marks 2026-05-25 → 2026-05-29 as holidays
    const holidayWeekStart = new Date("2026-05-25").getTime();
    const holidayWeekEnd = new Date("2026-05-29").getTime();
    const isBusinessDay: HolidayCalendarFn = (date) => {
      if (!defaultIsBusinessDay(date)) return false;
      const t = date.getTime();
      if (t >= holidayWeekStart && t <= holidayWeekEnd + 24 * 3600 * 1000)
        return false;
      return true;
    };
    const due = computeFounderLoopDueDate({
      riskLevel: "medium",
      now: WEDNESDAY,
      isBusinessDay,
    });
    // Wed 5-20 + 5 business days, skipping Mon–Fri 5-25→5-29:
    // 5-21 (Thu) = 1
    // 5-22 (Fri) = 2
    // weekend
    // 5-25 → 5-29 holiday week (skipped)
    // 5-30, 5-31 weekend
    // 6-1 (Mon) = 3, 6-2 (Tue) = 4, 6-3 (Wed) = 5
    expect(due?.toISOString()).toBe("2026-06-03T12:00:00.000Z");
  });
});

describe("computeFounderLoopDueDate — watch tier", () => {
  it("watch → null", () => {
    expect(
      computeFounderLoopDueDate({ riskLevel: "watch", now: WEDNESDAY }),
    ).toBeNull();
  });
});

describe("computeFounderLoopDueDate — pathological calendar", () => {
  it("throws if the predicate returns false for too many days in a row", () => {
    const alwaysHoliday: HolidayCalendarFn = () => false;
    expect(() =>
      computeFounderLoopDueDate({
        riskLevel: "medium",
        now: WEDNESDAY,
        isBusinessDay: alwaysHoliday,
      }),
    ).toThrowError(/too many consecutive/);
  });
});

describe("computeFounderLoopDueDateIso", () => {
  it("returns ISO 8601 for non-watch tiers", () => {
    expect(
      computeFounderLoopDueDateIso({
        riskLevel: "critical",
        now: WEDNESDAY,
      }),
    ).toBe("2026-05-21T12:00:00.000Z");
  });

  it("returns null for watch", () => {
    expect(
      computeFounderLoopDueDateIso({ riskLevel: "watch", now: WEDNESDAY }),
    ).toBeNull();
  });
});
