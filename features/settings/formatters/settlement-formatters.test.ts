import { describe, expect, it } from "vitest";
import { formatSettlementBatchReference } from "@/features/settings/formatters/settlement-formatters";

describe("settlement formatters", () => {
  it("renders settlement batch keys as readable period labels", () => {
    expect(formatSettlementBatchReference("settlement_2026_04", null, false)).toBe(
      "结算批次 · 2026-04",
    );
    expect(formatSettlementBatchReference("settlement_2026_04", "2026-04", true)).toBe(
      "Settlement batch · 2026-04",
    );
    expect(formatSettlementBatchReference("custom_key", null, false)).toBe("结算批次");
  });
});
