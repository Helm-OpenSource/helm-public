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
