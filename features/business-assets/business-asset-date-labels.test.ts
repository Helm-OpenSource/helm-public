import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateLabel, formatRelative } from "@/lib/utils";
import {
  formatBusinessAssetDateLabel,
  formatBusinessAssetRelativeLabel,
} from "@/features/business-assets/business-asset-date-labels";

describe("business asset date labels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the existing Chinese business asset date format", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    expect(formatBusinessAssetDateLabel(date, false, formatDateLabel)).toBe(
      "08月14日 11:45",
    );
  });

  it("formats English business asset dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatBusinessAssetDateLabel(date, true, formatDateLabel);

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("formats English business asset relative labels without Chinese relative tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12, 0));

    const label = formatBusinessAssetRelativeLabel(
      new Date(2026, 7, 17, 12, 0),
      true,
      formatRelative,
    );

    expect(label).toBe("3 days ago");
    expect(label).not.toMatch(/前|后|天|小时|分钟/);
  });

  it("uses English fallbacks for missing business asset dates", () => {
    expect(formatBusinessAssetDateLabel(null, true, formatDateLabel)).toBe(
      "Not set",
    );
    expect(formatBusinessAssetRelativeLabel(null, true, formatRelative)).toBe(
      "no recent update",
    );
  });
});
