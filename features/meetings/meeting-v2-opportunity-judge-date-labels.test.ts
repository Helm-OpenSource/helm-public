import { describe, expect, it } from "vitest";
import { formatMeetingOpportunityJudgeDateLabel } from "@/features/meetings/meeting-v2-opportunity-judge-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatMeetingOpportunityJudgeDateLabel", () => {
  const sampleDate = new Date(2026, 9, 22, 16, 10);

  it("formats opportunity judge dates with English month labels", () => {
    expect(formatMeetingOpportunityJudgeDateLabel(sampleDate, true, formatDateLabel)).toBe("Oct 22 16:10");
  });

  it("delegates Chinese opportunity judge dates to the existing formatter", () => {
    expect(formatMeetingOpportunityJudgeDateLabel(sampleDate, false, formatDateLabel)).toBe("10月22日 16:10");
  });

  it("keeps empty opportunity judge dates localized", () => {
    expect(formatMeetingOpportunityJudgeDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatMeetingOpportunityJudgeDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
