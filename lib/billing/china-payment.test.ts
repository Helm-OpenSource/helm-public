import { describe, expect, it } from "vitest";
import { PaymentProvider } from "@prisma/client";
import {
  buildChinaPaymentOrderId,
  getChinaBillingPeriodUnix,
  getWorkspaceOrderAmountCents,
} from "@/lib/billing/china-payment";

describe("china payment helpers", () => {
  it("builds deterministic provider-specific order ids", () => {
    const orderId = buildChinaPaymentOrderId(
      PaymentProvider.ALIPAY,
      "workspace_demo_123",
      new Date("2026-03-31T08:09:10.000Z"),
    );

    expect(orderId).toBe("helm_ali_workspacedemo123_20260331080910");
  });

  it("builds a one-month billing period window for China rails", () => {
    const period = getChinaBillingPeriodUnix(new Date("2026-03-31T00:00:00.000Z"));

    expect(period.currentPeriodStart).toBe(1_774_915_200);
    expect(period.currentPeriodEnd).toBe(1_777_507_200);
  });

  it("computes organization base fee plus billable seats", () => {
    expect(
      getWorkspaceOrderAmountCents({
        baseFeeCents: 19_900,
        activeSeatPriceCents: 9_900,
        additionalBillableSeats: 2,
      }),
    ).toBe(39_700);
  });
});
