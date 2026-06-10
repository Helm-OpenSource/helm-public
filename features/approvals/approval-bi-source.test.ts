import { describe, expect, it } from "vitest";
import {
  getBiSkillLabel,
  normalizeActionItemMetadata,
} from "@/features/approvals/queries";

describe("normalizeActionItemMetadata", () => {
  it("parses string metadata", () => {
    expect(
      normalizeActionItemMetadata(
        JSON.stringify({ biReportSignalId: "signal-1" }),
      ),
    ).toEqual({ biReportSignalId: "signal-1" });
  });

  it("passes through object metadata", () => {
    expect(
      normalizeActionItemMetadata({
        biReportSignalId: "signal-2",
        biReportSkillKey: "bi_repay_daily",
      }),
    ).toEqual({
      biReportSignalId: "signal-2",
      biReportSkillKey: "bi_repay_daily",
    });
  });

  it("returns null for empty input", () => {
    expect(normalizeActionItemMetadata(null)).toBeNull();
    expect(normalizeActionItemMetadata(undefined)).toBeNull();
  });
});

describe("getBiSkillLabel", () => {
  it("keeps BI source labels bilingual for approval source chips", () => {
    expect(getBiSkillLabel("bi_business_income_expense_monthly", false)).toBe(
      "业务收支月报",
    );
    expect(getBiSkillLabel("bi_business_income_expense_monthly", true)).toBe(
      "Business income and expense monthly report",
    );
    expect(getBiSkillLabel("bi_repay_daily", true)).toBe("Repayment daily report");
    expect(getBiSkillLabel("bi_mtype_repay_monthly", true)).toBe(
      "Aging repayment monthly report",
    );
    expect(getBiSkillLabel("bi_revenue_daily", true)).toBe(
      "Revenue daily report (compatibility)",
    );
    expect(getBiSkillLabel(null, true)).toBe("BI operating signal");
  });
});
