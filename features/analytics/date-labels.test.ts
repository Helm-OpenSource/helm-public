import { describe, expect, it } from "vitest";
import { formatAnalyticsDateLabel } from "@/features/analytics/date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatAnalyticsDateLabel", () => {
  const sampleDate = new Date(2026, 5, 4, 15, 22);

  it("formats analytics dates with English month labels", () => {
    expect(formatAnalyticsDateLabel(sampleDate, true, formatDateLabel)).toBe("Jun 4 15:22");
  });

  it("delegates Chinese analytics dates to the existing formatter", () => {
    expect(formatAnalyticsDateLabel(sampleDate, false, formatDateLabel)).toBe("06月04日 15:22");
  });

  it("keeps empty analytics dates localized", () => {
    expect(formatAnalyticsDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatAnalyticsDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
