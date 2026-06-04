import { describe, expect, it } from "vitest";
import {
  formatCaptureResultDateLabel,
  formatCaptureResultRelativeLabel,
} from "@/features/conversation-capture/capture-result-date-labels";
import { formatDateLabel, formatRelative } from "@/lib/utils";

describe("capture result date labels", () => {
  const sampleDate = new Date(2026, 7, 12, 14, 5);

  it("formats capture dates with English month labels", () => {
    expect(formatCaptureResultDateLabel(sampleDate, true, formatDateLabel)).toBe("Aug 12 14:05");
  });

  it("delegates Chinese capture dates to the existing formatter", () => {
    expect(formatCaptureResultDateLabel(sampleDate, false, formatDateLabel)).toBe("08月12日 14:05");
  });

  it("keeps empty capture dates localized", () => {
    expect(formatCaptureResultDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatCaptureResultDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });

  it("formats English relative capture times without Chinese labels", () => {
    const baseDate = new Date(2026, 7, 12, 15, 5);
    expect(formatCaptureResultRelativeLabel(sampleDate, true, formatRelative, baseDate)).toBe("1 hour ago");
  });

  it("delegates Chinese relative capture times to the existing formatter", () => {
    const pastDate = new Date(2026, 0, 1, 10, 0);
    expect(formatCaptureResultRelativeLabel(pastDate, false, formatRelative)).toContain("前");
  });
});
