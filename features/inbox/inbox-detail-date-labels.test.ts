import { describe, expect, it } from "vitest";
import { formatInboxDetailDateLabel } from "./inbox-detail-date-labels";

describe("formatInboxDetailDateLabel", () => {
  it("keeps Chinese date labels on the existing formatter path", () => {
    expect(formatInboxDetailDateLabel("2026-07-06T03:30:00.000Z", false)).toBe(
      "07月06日 11:30",
    );
  });

  it("formats English dates without Chinese date tokens", () => {
    expect(formatInboxDetailDateLabel("2026-07-06T03:30:00.000Z", true)).toBe(
      "Jul 6 11:30",
    );
  });

  it("uses an English missing-value fallback", () => {
    expect(formatInboxDetailDateLabel(null, true)).toBe("Not set");
  });
});
