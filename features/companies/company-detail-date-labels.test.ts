import { describe, expect, it } from "vitest";
import { formatCompanyDetailDateLabel } from "@/features/companies/company-detail-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatCompanyDetailDateLabel", () => {
  const sampleDate = new Date(2026, 6, 9, 9, 15);

  it("formats company detail dates with English month labels", () => {
    expect(formatCompanyDetailDateLabel(sampleDate, true, formatDateLabel)).toBe("Jul 9 09:15");
  });

  it("delegates Chinese company detail dates to the existing formatter", () => {
    expect(formatCompanyDetailDateLabel(sampleDate, false, formatDateLabel)).toBe("07月09日 09:15");
  });

  it("keeps empty company detail dates localized", () => {
    expect(formatCompanyDetailDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatCompanyDetailDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
