import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatInboxFollowupDateLabel } from "./date-labels";

describe("formatInboxFollowupDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps Chinese date labels on the existing formatter path", () => {
    const label = formatInboxFollowupDateLabel(
      "2026-07-06T03:30:00.000Z",
      false,
    );

    expect(label).toMatch(/^07月06日 \d{2}:30$/u);
    expect(label).toMatch(/[\u3400-\u9fff]/u);
  });

  it("formats English dates without Chinese tokens", () => {
    const label = formatInboxFollowupDateLabel(
      "2026-07-06T03:30:00.000Z",
      true,
    );

    expect(label).toMatch(/^Jul 6 \d{2}:30$/u);
    expect(label).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it("uses an English missing-value fallback", () => {
    expect(formatInboxFollowupDateLabel(null, true)).toBe("Not set");
  });
});
