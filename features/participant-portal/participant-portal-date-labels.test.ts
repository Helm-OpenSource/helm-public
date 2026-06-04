import { describe, expect, it } from "vitest";
import { formatParticipantPortalDateLabel } from "./participant-portal-date-labels";

describe("formatParticipantPortalDateLabel", () => {
  const chineseFormatter = (value: Date | string | null | undefined) => {
    if (!value) {
      return "未设置";
    }

    return "04月15日 10:30";
  };

  it("formats English participant portal dates without Chinese date labels", () => {
    expect(formatParticipantPortalDateLabel(new Date(2026, 3, 15, 10, 30), true, chineseFormatter)).toBe(
      "Apr 15 10:30",
    );
  });

  it("delegates Chinese participant portal dates to the existing formatter", () => {
    expect(formatParticipantPortalDateLabel(new Date(2026, 3, 15, 10, 30), false, chineseFormatter)).toBe(
      "04月15日 10:30",
    );
  });

  it("uses locale-specific empty labels", () => {
    expect(formatParticipantPortalDateLabel(null, true, chineseFormatter)).toBe("Not set");
    expect(formatParticipantPortalDateLabel(undefined, false, chineseFormatter)).toBe("未设置");
  });
});
