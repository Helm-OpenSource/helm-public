import { describe, expect, it } from "vitest";
import { formatMeetingHumanExecutionDateLabel } from "@/features/meetings/meeting-v2-human-execution-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatMeetingHumanExecutionDateLabel", () => {
  const sampleDate = new Date(2026, 10, 6, 13, 35);

  it("formats human execution dates with English month labels", () => {
    expect(formatMeetingHumanExecutionDateLabel(sampleDate, true, formatDateLabel)).toBe("Nov 6 13:35");
  });

  it("delegates Chinese human execution dates to the existing formatter", () => {
    expect(formatMeetingHumanExecutionDateLabel(sampleDate, false, formatDateLabel)).toBe("11月06日 13:35");
  });

  it("keeps empty human execution dates localized", () => {
    expect(formatMeetingHumanExecutionDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatMeetingHumanExecutionDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
