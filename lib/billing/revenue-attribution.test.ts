import { describe, expect, it } from "vitest";
import { RevenueRuleValueType } from "@prisma/client";
import {
  REVENUE_PERCENT_BASE,
  resolveAttributedAmountCents,
  validateRevenueRuleMath,
} from "@/lib/billing/revenue-attribution";

describe("revenue attribution helpers", () => {
  it("resolves fixed-percent attribution in basis points", () => {
    expect(
      resolveAttributedAmountCents({
        grossAmountCents: 19_900,
        rule: {
          valueType: RevenueRuleValueType.FIXED_PERCENT,
          percentBps: REVENUE_PERCENT_BASE,
          fixedAmountCents: null,
        },
      }),
    ).toBe(19_900);

    expect(
      resolveAttributedAmountCents({
        grossAmountCents: 19_900,
        rule: {
          valueType: RevenueRuleValueType.FIXED_PERCENT,
          percentBps: 2_500,
          fixedAmountCents: null,
        },
      }),
    ).toBe(4_975);
  });

  it("caps fixed-amount attribution at the gross line amount", () => {
    expect(
      resolveAttributedAmountCents({
        grossAmountCents: 9_900,
        rule: {
          valueType: RevenueRuleValueType.FIXED_AMOUNT,
          percentBps: null,
          fixedAmountCents: 12_000,
        },
      }),
    ).toBe(9_900);
  });

  it("rejects invalid rule math", () => {
    expect(() =>
      validateRevenueRuleMath({
        valueType: RevenueRuleValueType.FIXED_PERCENT,
        percentBps: 12_000,
        fixedAmountCents: null,
      }),
    ).toThrow("between 0 and 10000 bps");

    expect(() =>
      validateRevenueRuleMath({
        valueType: RevenueRuleValueType.FIXED_AMOUNT,
        percentBps: null,
        fixedAmountCents: -1,
      }),
    ).toThrow("non-negative");
  });
});
