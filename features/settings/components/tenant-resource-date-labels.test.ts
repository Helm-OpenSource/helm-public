import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTenantResourceDateLabel } from "@/features/settings/components/tenant-resource-date-labels";

const sampleDate = new Date(2026, 3, 15, 10, 30);

describe("tenant resource date labels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders tenant resource dates in English without Chinese fragments", () => {
    expect(formatTenantResourceDateLabel(sampleDate, true)).toBe("Apr 15 10:30");
    expect(formatTenantResourceDateLabel(sampleDate, true)).not.toMatch(/[月日]|未记录/);
  });

  it("keeps tenant resource dates in Chinese format", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 04-14/15/16 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    expect(formatTenantResourceDateLabel(sampleDate, false)).toBe("04月15日 10:30");
  });

  it("uses localized or explicit empty labels", () => {
    expect(formatTenantResourceDateLabel(null, true)).toBe("Not recorded");
    expect(formatTenantResourceDateLabel(null, false)).toBe("未记录");
    expect(formatTenantResourceDateLabel(null, true, "No timestamp")).toBe("No timestamp");
  });
});
