import { describe, expect, it } from "vitest";
import { formatParticipantPortalDateLabel } from "@/features/settings/components/billing-participant-portal-date-labels";

const sampleDate = new Date(2026, 3, 15, 10, 30);

describe("billing participant portal date labels", () => {
  it("renders participant portal dates in English without Chinese fragments", () => {
    const rendered = formatParticipantPortalDateLabel(sampleDate, true, () => "04月15日 10:30");

    expect(rendered).toBe("Apr 15 10:30");
    expect(rendered).not.toMatch(/[月日]|未设置/);
  });

  it("delegates Chinese formatting to the existing date formatter", () => {
    expect(formatParticipantPortalDateLabel(sampleDate, false, () => "04月15日 10:30")).toBe(
      "04月15日 10:30",
    );
  });

  it("uses localized empty labels", () => {
    expect(formatParticipantPortalDateLabel(null, true, () => "未设置")).toBe("Not set");
    expect(formatParticipantPortalDateLabel(null, false, () => "未设置")).toBe("未设置");
  });
});
