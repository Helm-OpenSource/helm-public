import { describe, expect, it } from "vitest";
import { formatSettingsDateLabel } from "./settings-date-labels";

describe("formatSettingsDateLabel", () => {
  it("keeps Chinese settings dates on the existing formatter path", () => {
    expect(formatSettingsDateLabel(new Date(2026, 6, 6, 11, 30), false)).toBe(
      "07月06日 11:30",
    );
  });

  it("formats English settings dates without Chinese date tokens", () => {
    expect(formatSettingsDateLabel(new Date(2026, 6, 6, 11, 30), true)).toBe(
      "Jul 6 11:30",
    );
  });

  it("uses an English missing-value fallback", () => {
    expect(formatSettingsDateLabel(null, true)).toBe("Not set");
  });
});
