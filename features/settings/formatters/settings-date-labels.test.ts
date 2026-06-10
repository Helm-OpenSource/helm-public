import { describe, expect, it } from "vitest";
import { formatSettingsDateLabel } from "./settings-date-labels";

describe("formatSettingsDateLabel", () => {
  it("keeps Chinese date labels on the existing formatter path", () => {
    const label = formatSettingsDateLabel(
      "2026-07-06T03:30:00.000Z",
      false,
    );

    expect(label).toMatch(/^07月06日 \d{2}:30$/u);
    expect(label).toMatch(/[\u3400-\u9fff]/u);
  });

  it("formats English dates without Chinese tokens", () => {
    const label = formatSettingsDateLabel(
      "2026-07-06T03:30:00.000Z",
      true,
    );

    expect(label).toMatch(/^Jul 6 \d{2}:30$/u);
    expect(label).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("uses an English missing-value fallback", () => {
    expect(formatSettingsDateLabel(null, true)).toBe("Not set");
  });
});
