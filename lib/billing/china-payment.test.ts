import { afterEach, describe, expect, it } from "vitest";
import { PaymentProvider } from "@prisma/client";
import {
  buildChinaPaymentOrderId,
  getChinaBillingPeriodUnix,
  getChinaPaymentNotifyUrl,
  getChinaPaymentReturnUrl,
  getWorkspaceOrderAmountCents,
} from "@/lib/billing/china-payment";

describe("china payment helpers", () => {
  const appUrlSnapshot = process.env.APP_URL;

  afterEach(() => {
    if (appUrlSnapshot) {
      process.env.APP_URL = appUrlSnapshot;
    } else {
      delete process.env.APP_URL;
    }
  });

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

  it("localizes missing APP_URL errors for Chinese payment return URLs", () => {
    delete process.env.APP_URL;

    expect(() =>
      getChinaPaymentReturnUrl({
        provider: PaymentProvider.ALIPAY,
        status: "checkout-returned",
        locale: "zh-CN",
      }),
    ).toThrow("中国区支付通道需要先配置 APP_URL。");
  });

  it("preserves missing APP_URL English copy for English payment notify URLs", () => {
    delete process.env.APP_URL;

    expect(() => getChinaPaymentNotifyUrl(PaymentProvider.WECHAT_PAY, "en-US")).toThrow(
      "APP_URL is required for China payment rail",
    );
  });
});
