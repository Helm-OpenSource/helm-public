import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateLabel, formatRelative } from "@/lib/utils";
import {
  formatDashboardRiskSignalDateLabel,
  formatDashboardRiskSignalRelativeLabel,
} from "@/features/dashboard/risk-signal-date-labels";

describe("dashboard risk signal date labels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the existing Chinese absolute date format", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 08-13/14/15 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    const date = new Date(2026, 7, 14, 11, 45);

    expect(
      formatDashboardRiskSignalDateLabel(date, false, formatDateLabel),
    ).toBe("08月14日 11:45");
  });

  it("formats English absolute dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatDashboardRiskSignalDateLabel(
      date,
      true,
      formatDateLabel,
    );

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("formats English relative dates without Chinese relative tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12, 0));

    const label = formatDashboardRiskSignalRelativeLabel(
      new Date(2026, 7, 17, 12, 0),
      true,
      formatRelative,
    );

    expect(label).toBe("3 days ago");
    expect(label).not.toMatch(/前|后|天|小时|分钟/);
  });

  it("uses an English fallback for missing relative activity", () => {
    expect(
      formatDashboardRiskSignalRelativeLabel(null, true, formatRelative),
    ).toBe("No recent activity");
  });
});
