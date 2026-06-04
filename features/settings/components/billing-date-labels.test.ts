import { describe, expect, it } from "vitest";
import { formatBillingDateLabel } from "./billing-date-labels";

const chineseDateFragments = /[年月日今天明天昨天未设置]/;

describe("billing overview date labels", () => {
  it("formats English billing dates without Chinese fragments", () => {
    const label = formatBillingDateLabel(new Date(2026, 0, 15, 9, 30), true);

    expect(label).toContain("Jan");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("preserves Chinese billing date labels", () => {
    expect(formatBillingDateLabel(new Date(2026, 0, 15, 9, 30), false)).toMatch(
      chineseDateFragments,
    );
  });

  it("uses locale-specific empty date labels", () => {
    expect(formatBillingDateLabel(null, true)).toBe("Not set");
    expect(formatBillingDateLabel(null, false)).toBe("未设置");
  });
});
