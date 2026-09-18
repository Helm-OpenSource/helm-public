import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMeetingHumanExecutionDateLabel } from "@/features/meetings/meeting-v2-human-execution-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatMeetingHumanExecutionDateLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleDate = new Date(2026, 10, 6, 13, 35);

  it("formats human execution dates with English month labels", () => {
    expect(formatMeetingHumanExecutionDateLabel(sampleDate, true, formatDateLabel)).toBe("Nov 6 13:35");
  });

  it("delegates Chinese human execution dates to the existing formatter", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 11-05/06/07 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    expect(formatMeetingHumanExecutionDateLabel(sampleDate, false, formatDateLabel)).toBe("11月06日 13:35");
  });

  it("keeps empty human execution dates localized", () => {
    expect(formatMeetingHumanExecutionDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatMeetingHumanExecutionDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
