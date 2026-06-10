import { describe, expect, it } from "vitest";
import { formatDateLabel } from "@/lib/utils";
import { formatExpansionReviewDateLabel } from "@/features/expansion-review/expansion-review-date-labels";

describe("formatExpansionReviewDateLabel", () => {
  it("keeps the existing Chinese expansion-review date format", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    expect(formatExpansionReviewDateLabel(date, false, formatDateLabel)).toBe(
      "08月14日 11:45",
    );
  });

  it("formats English expansion-review dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatExpansionReviewDateLabel(
      date,
      true,
      formatDateLabel,
    );

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("uses an English fallback for missing dates", () => {
    expect(formatExpansionReviewDateLabel(null, true, formatDateLabel)).toBe(
      "Not set",
    );
  });
});
