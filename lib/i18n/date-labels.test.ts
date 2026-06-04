import { describe, expect, it } from "vitest";
import { formatLocalizedDateLabel } from "./date-labels";

describe("formatLocalizedDateLabel", () => {
  it("keeps English list labels free of Chinese date fragments", () => {
    const label = formatLocalizedDateLabel(new Date(2026, 0, 15, 9, 30), true);

    expect(label).toContain("Jan");
    expect(label).not.toMatch(/[年月日今天明天昨天未设置]/);
  });

  it("keeps the existing Chinese date label behavior for Chinese UI", () => {
    const label = formatLocalizedDateLabel(new Date(2026, 0, 15, 9, 30), false);

    expect(label).toMatch(/[年月日]/);
  });

  it("localizes missing date labels", () => {
    expect(formatLocalizedDateLabel(null, true)).toBe("Not set");
    expect(formatLocalizedDateLabel(null, false)).toBe("未设置");
  });
});
