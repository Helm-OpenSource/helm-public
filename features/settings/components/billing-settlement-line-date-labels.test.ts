import { describe, expect, it } from "vitest";
import { formatSettlementLineDateLabel } from "./billing-settlement-line-date-labels";

describe("formatSettlementLineDateLabel", () => {
  const chineseFormatter = (value: Date | string | null | undefined) => {
    if (!value) {
      return "未设置";
    }

    return "04月15日 10:30";
  };

  it("formats English settlement dates without Chinese date labels", () => {
    expect(formatSettlementLineDateLabel(new Date(2026, 3, 15, 10, 30), true, chineseFormatter)).toBe(
      "Apr 15 10:30",
    );
  });

  it("delegates Chinese settlement dates to the existing formatter", () => {
    expect(formatSettlementLineDateLabel(new Date(2026, 3, 15, 10, 30), false, chineseFormatter)).toBe(
      "04月15日 10:30",
    );
  });

  it("uses locale-specific empty labels", () => {
    expect(formatSettlementLineDateLabel(null, true, chineseFormatter)).toBe("Not set");
    expect(formatSettlementLineDateLabel(undefined, false, chineseFormatter)).toBe("未设置");
  });
});
