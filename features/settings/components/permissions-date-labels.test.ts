import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPermissionDateLabel } from "@/features/settings/components/permissions-date-labels";

const sampleDate = new Date(2026, 3, 15, 10, 30);

describe("permissions date labels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders permission dates in English without Chinese fragments", () => {
    expect(formatPermissionDateLabel(sampleDate, true)).toBe("Apr 15 10:30");
    expect(formatPermissionDateLabel(sampleDate, true)).not.toMatch(/[月日]|未设置/);
  });

  it("keeps permission dates in Chinese format", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 04-14/15/16 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    expect(formatPermissionDateLabel(sampleDate, false)).toBe("04月15日 10:30");
  });

  it("uses localized empty labels", () => {
    expect(formatPermissionDateLabel(null, true)).toBe("Not set");
    expect(formatPermissionDateLabel(null, false)).toBe("未设置");
  });
});
