import { afterEach, describe, expect, it, vi } from "vitest";
import { formatImportDateLabel } from "@/features/imports/import-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatImportDateLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleDate = new Date(2026, 3, 15, 10, 30);

  it("formats import dates with English month labels", () => {
    expect(formatImportDateLabel(sampleDate, true, formatDateLabel)).toBe("Apr 15 10:30");
  });

  it("delegates Chinese import dates to the existing formatter", () => {
    // formatDateLabel 对今天/明天/昨天返回相对文案，夹具是写死的绝对日期，
    // 所以时钟也要一起冻住：否则真实日期落到 04-14/15/16 这三天，断言必红。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0));

    expect(formatImportDateLabel(sampleDate, false, formatDateLabel)).toBe("04月15日 10:30");
  });

  it("keeps empty import dates localized", () => {
    expect(formatImportDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatImportDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
