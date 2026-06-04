import { describe, expect, it } from "vitest";
import { formatAccountDateLabel } from "./account-date-labels";

const chineseDateFragments = /[年月日今天明天昨天未设置]/;

describe("account settings date labels", () => {
  it("formats English account dates without Chinese fragments", () => {
    const label = formatAccountDateLabel(new Date(2026, 0, 15, 9, 30), true);

    expect(label).toContain("Jan");
    expect(label).not.toMatch(chineseDateFragments);
  });

  it("preserves Chinese account date labels", () => {
    expect(formatAccountDateLabel(new Date(2026, 0, 15, 9, 30), false)).toMatch(
      chineseDateFragments,
    );
  });

  it("uses locale-specific empty date labels", () => {
    expect(formatAccountDateLabel(null, true)).toBe("Not set");
    expect(formatAccountDateLabel(null, false)).toBe("未设置");
  });
});
