import { describe, expect, it } from "vitest";
import { formatDateLabel } from "@/lib/utils";
import { formatMemoryDateLabel } from "@/features/memory/memory-date-labels";

describe("formatMemoryDateLabel", () => {
  it("keeps the existing Chinese memory date format", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    expect(formatMemoryDateLabel(date, false, formatDateLabel)).toBe(
      "08月14日 11:45",
    );
  });

  it("formats English memory dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatMemoryDateLabel(date, true, formatDateLabel);

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("uses an English fallback for empty dates", () => {
    expect(formatMemoryDateLabel(null, true, formatDateLabel)).toBe("Not set");
  });
});
