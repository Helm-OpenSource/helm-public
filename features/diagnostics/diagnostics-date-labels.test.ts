import { describe, expect, it } from "vitest";
import { formatDateLabel } from "@/lib/utils";
import { formatDiagnosticsDateLabel } from "@/features/diagnostics/diagnostics-date-labels";

describe("formatDiagnosticsDateLabel", () => {
  it("keeps the existing Chinese diagnostics date format", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    expect(formatDiagnosticsDateLabel(date, false, formatDateLabel)).toBe(
      "08月14日 11:45",
    );
  });

  it("formats English diagnostics dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatDiagnosticsDateLabel(date, true, formatDateLabel);

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("uses an English fallback for empty dates", () => {
    expect(formatDiagnosticsDateLabel(null, true, formatDateLabel)).toBe(
      "Not set",
    );
  });
});
