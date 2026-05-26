import { describe, expect, it } from "vitest";
import { getWeekRange } from "@/lib/reports";

describe("reports", () => {
  it("returns a monday-start week range", () => {
    const { weekStart, weekEnd } = getWeekRange(0);

    expect(weekStart.getDay()).toBe(1);
    expect(weekEnd.getTime()).toBeGreaterThan(weekStart.getTime());
  });
});
