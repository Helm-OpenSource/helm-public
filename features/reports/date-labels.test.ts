import { describe, expect, it } from "vitest";
import {
  formatReportDateLabel,
  formatReportDateRange,
  formatReportShortDate,
} from "@/features/reports/date-labels";

const start = new Date(2026, 5, 1, 9, 15);
const end = new Date(2026, 5, 7, 18, 45);

describe("report date labels", () => {
  it("renders report dates in English without Chinese fragments", () => {
    expect(formatReportShortDate(start, true)).toBe("Jun 1");
    expect(formatReportDateLabel(start, true)).toBe("Jun 1 09:15");
    expect(formatReportDateRange(start, end, true)).toBe("Jun 1 - Jun 7");
    expect(formatReportDateRange(start, end, true)).not.toMatch(/[月日]|未设置/);
  });

  it("keeps report dates in Chinese format for zh-CN", () => {
    expect(formatReportShortDate(start, false)).toBe("06月01日");
    expect(formatReportDateLabel(start, false)).toBe("06月01日 09:15");
    expect(formatReportDateRange(start, end, false)).toBe("06月01日 - 06月07日");
  });

  it("uses localized empty labels", () => {
    expect(formatReportShortDate(null, true)).toBe("Not set");
    expect(formatReportDateLabel(null, false)).toBe("未设置");
  });
});
