import { describe, expect, it } from "vitest";
import { formatTenantResourceDateLabel } from "@/features/settings/components/tenant-resource-date-labels";

const sampleDate = new Date(2026, 3, 15, 10, 30);

describe("tenant resource date labels", () => {
  it("renders tenant resource dates in English without Chinese fragments", () => {
    expect(formatTenantResourceDateLabel(sampleDate, true)).toBe("Apr 15 10:30");
    expect(formatTenantResourceDateLabel(sampleDate, true)).not.toMatch(/[月日]|未记录/);
  });

  it("keeps tenant resource dates in Chinese format", () => {
    expect(formatTenantResourceDateLabel(sampleDate, false)).toBe("04月15日 10:30");
  });

  it("uses localized or explicit empty labels", () => {
    expect(formatTenantResourceDateLabel(null, true)).toBe("Not recorded");
    expect(formatTenantResourceDateLabel(null, false)).toBe("未记录");
    expect(formatTenantResourceDateLabel(null, true, "No timestamp")).toBe("No timestamp");
  });
});
