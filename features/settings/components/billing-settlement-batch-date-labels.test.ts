import { describe, expect, it } from "vitest";
import {
  formatSettlementBatchDateLabel,
  formatSettlementBatchDateRangeLabel,
} from "./billing-settlement-batch-date-labels";

describe("settlement batch date labels", () => {
  const chineseFormatter = (value: Date | string | null | undefined) => {
    if (!value) {
      return "未设置";
    }

    return "04月15日 10:30";
  };

  it("formats English settlement batch dates without Chinese date labels", () => {
    expect(formatSettlementBatchDateLabel(new Date(2026, 3, 15, 10, 30), true, chineseFormatter)).toBe(
      "Apr 15 10:30",
    );
  });

  it("delegates Chinese settlement batch dates to the existing formatter", () => {
    expect(formatSettlementBatchDateLabel(new Date(2026, 3, 15, 10, 30), false, chineseFormatter)).toBe(
      "04月15日 10:30",
    );
  });

  it("formats English and Chinese settlement batch ranges consistently", () => {
    const start = new Date(2026, 3, 15, 10, 30);
    const end = new Date(2026, 3, 16, 10, 30);

    expect(formatSettlementBatchDateRangeLabel(start, end, true, chineseFormatter)).toBe(
      "Apr 15 10:30 - Apr 16 10:30",
    );
    expect(formatSettlementBatchDateRangeLabel(start, end, false, chineseFormatter)).toBe(
      "04月15日 10:30 - 04月15日 10:30",
    );
  });

  it("uses locale-specific empty labels", () => {
    expect(formatSettlementBatchDateLabel(null, true, chineseFormatter)).toBe("Not set");
    expect(formatSettlementBatchDateLabel(undefined, false, chineseFormatter)).toBe("未设置");
  });
});
