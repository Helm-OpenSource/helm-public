import { describe, expect, it } from "vitest";
import { formatDateLabel } from "@/lib/utils";
import { formatCustomerSuccessQueueDateLabel } from "@/features/customer-success-handoff/queue-date-labels";

describe("formatCustomerSuccessQueueDateLabel", () => {
  it("keeps the existing Chinese queue date format", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    expect(
      formatCustomerSuccessQueueDateLabel(date, false, formatDateLabel),
    ).toBe("08月14日 11:45");
  });

  it("formats English queue dates without Chinese date tokens", () => {
    const date = new Date(2026, 7, 14, 11, 45);

    const label = formatCustomerSuccessQueueDateLabel(
      date,
      true,
      formatDateLabel,
    );

    expect(label).toBe("Aug 14 11:45");
    expect(label).not.toMatch(/[年月日]|今天|明天|昨天/);
  });

  it("uses an English fallback for empty values", () => {
    expect(
      formatCustomerSuccessQueueDateLabel(null, true, formatDateLabel),
    ).toBe("Not set");
  });
});
