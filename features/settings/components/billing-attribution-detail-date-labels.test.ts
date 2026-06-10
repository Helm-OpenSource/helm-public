import { describe, expect, it } from "vitest";
import { formatAttributionDetailDateLabel } from "./billing-attribution-detail-date-labels";

describe("formatAttributionDetailDateLabel", () => {
  const chineseFormatter = (value: Date | string | null | undefined) => {
    if (!value) {
      return "未设置";
    }

    return "04月15日 10:30";
  };

  it("formats English attribution detail dates without Chinese date labels", () => {
    expect(formatAttributionDetailDateLabel(new Date(2026, 3, 15, 10, 30), true, chineseFormatter)).toBe(
      "Apr 15 10:30",
    );
  });

  it("delegates Chinese attribution detail dates to the existing formatter", () => {
    expect(formatAttributionDetailDateLabel(new Date(2026, 3, 15, 10, 30), false, chineseFormatter)).toBe(
      "04月15日 10:30",
    );
  });

  it("uses locale-specific empty labels", () => {
    expect(formatAttributionDetailDateLabel(null, true, chineseFormatter)).toBe("Not set");
    expect(formatAttributionDetailDateLabel(undefined, false, chineseFormatter)).toBe("未设置");
  });
});
