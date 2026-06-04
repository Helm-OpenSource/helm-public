import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateLabel, formatRelative } from "@/lib/utils";
import {
  formatContactDateLabel,
  formatContactRelativeLabel,
} from "@/features/contacts/contact-date-labels";

describe("contact date labels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the existing Chinese contact date format", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    expect(formatContactDateLabel(date, false, formatDateLabel)).toBe(
      "08月14日 11:45",
    );
  });

  it("formats English contact dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatContactDateLabel(date, true, formatDateLabel);

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("formats English relative contact labels without Chinese relative tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12, 0));

    const label = formatContactRelativeLabel(
      new Date(2026, 7, 17, 12, 0),
      true,
      formatRelative,
    );

    expect(label).toBe("3 days ago");
    expect(label).not.toMatch(/前|后|天|小时|分钟/);
  });

  it("uses English fallbacks for missing contact activity", () => {
    expect(formatContactDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatContactRelativeLabel(null, true, formatRelative)).toBe(
      "no recent interaction",
    );
  });
});
