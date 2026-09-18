import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMeetingOpportunityJudgeDateLabel } from "@/features/meetings/meeting-v2-opportunity-judge-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatMeetingOpportunityJudgeDateLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleDate = new Date(2026, 9, 22, 16, 10);

  it("formats opportunity judge dates with English month labels", () => {
    expect(formatMeetingOpportunityJudgeDateLabel(sampleDate, true, formatDateLabel)).toBe("Oct 22 16:10");
  });

  it("delegates Chinese opportunity judge dates to the existing formatter", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 10-21/22/23 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    expect(formatMeetingOpportunityJudgeDateLabel(sampleDate, false, formatDateLabel)).toBe("10月22日 16:10");
  });

  it("keeps empty opportunity judge dates localized", () => {
    expect(formatMeetingOpportunityJudgeDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatMeetingOpportunityJudgeDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
