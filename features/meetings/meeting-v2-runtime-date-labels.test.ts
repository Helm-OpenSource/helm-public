import { describe, expect, it } from "vitest";
import { formatMeetingRuntimeDateLabel } from "./meeting-v2-runtime-date-labels";

describe("formatMeetingRuntimeDateLabel", () => {
  it("keeps Chinese date labels on the existing formatter path", () => {
    expect(formatMeetingRuntimeDateLabel(new Date(2026, 6, 6, 11, 30), false)).toBe(
      "07月06日 11:30",
    );
  });

  it("formats English dates without Chinese date tokens", () => {
    expect(formatMeetingRuntimeDateLabel(new Date(2026, 6, 6, 11, 30), true)).toBe(
      "Jul 6 11:30",
    );
  });

  it("uses an English missing-value fallback", () => {
    expect(formatMeetingRuntimeDateLabel(null, true)).toBe("Not set");
  });
});
