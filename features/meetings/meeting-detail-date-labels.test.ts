import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatMeetingDetailDateLabel,
  formatMeetingDetailTimeRange,
} from "./meeting-detail-date-labels";

describe("formatMeetingDetailDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps Chinese date labels on the existing formatter path", () => {
    const label = formatMeetingDetailDateLabel("2026-07-06T03:30:00.000Z", false);

    expect(label).toMatch(/^07月06日 \d{2}:30$/u);
    expect(label).toMatch(/[\u3400-\u9fff]/u);
  });

  it("formats English dates without Chinese tokens", () => {
    const label = formatMeetingDetailDateLabel("2026-07-06T03:30:00.000Z", true);

    expect(label).toMatch(/^Jul 6 \d{2}:30$/u);
    expect(label).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("uses an English missing-value fallback", () => {
    expect(formatMeetingDetailDateLabel(null, true)).toBe("Not set");
  });
});

describe("formatMeetingDetailTimeRange", () => {
  it("shows only the end time when the meeting ends the same day", () => {
    const start = new Date(2026, 6, 6, 10, 0);
    const end = new Date(2026, 6, 6, 11, 30);

    expect(formatMeetingDetailTimeRange(start, end, true)).toBe("Jul 6 10:00 – 11:30");
  });

  it("shows the full end label when the meeting crosses days", () => {
    const start = new Date(2026, 6, 6, 23, 0);
    const end = new Date(2026, 6, 7, 1, 0);

    expect(formatMeetingDetailTimeRange(start, end, true)).toBe(
      "Jul 6 23:00 – Jul 7 01:00",
    );
  });

  it("falls back to the start label when the end is missing or not after the start", () => {
    const start = new Date(2026, 6, 6, 10, 0);

    expect(formatMeetingDetailTimeRange(start, null, true)).toBe("Jul 6 10:00");
    expect(formatMeetingDetailTimeRange(start, start, true)).toBe("Jul 6 10:00");
  });
});
