import { describe, expect, it } from "vitest";
import { formatPermissionDateLabel } from "@/features/settings/components/permissions-date-labels";

const sampleDate = new Date(2026, 3, 15, 10, 30);

describe("permissions date labels", () => {
  it("renders permission dates in English without Chinese fragments", () => {
    expect(formatPermissionDateLabel(sampleDate, true)).toBe("Apr 15 10:30");
    expect(formatPermissionDateLabel(sampleDate, true)).not.toMatch(/[月日]|未设置/);
  });

  it("keeps permission dates in Chinese format", () => {
    expect(formatPermissionDateLabel(sampleDate, false)).toBe("04月15日 10:30");
  });

  it("uses localized empty labels", () => {
    expect(formatPermissionDateLabel(null, true)).toBe("Not set");
    expect(formatPermissionDateLabel(null, false)).toBe("未设置");
  });
});
