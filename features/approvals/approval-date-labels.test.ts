import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatApprovalDateLabel } from "./approval-date-labels";

describe("formatApprovalDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps Chinese approval dates on the existing formatter path", () => {
    expect(formatApprovalDateLabel(new Date(2026, 6, 6, 11, 30), false)).toBe(
      "07月06日 11:30",
    );
  });

  it("formats English approval dates without Chinese date tokens", () => {
    expect(formatApprovalDateLabel(new Date(2026, 6, 6, 11, 30), true)).toBe(
      "Jul 6 11:30",
    );
  });

  it("uses an English missing-value fallback", () => {
    expect(formatApprovalDateLabel(null, true)).toBe("Not set");
  });
});
