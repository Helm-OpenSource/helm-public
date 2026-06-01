import { describe, expect, it } from "vitest";
import { AccessState, PaymentProvider } from "@prisma/client";
import { mapPaymentLifecycle } from "@/lib/billing/payment-lifecycle-mapping";

describe("payment lifecycle mapping", () => {
  it("maps Alipay success states into active lifecycle truth", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.ALIPAY,
      providerStatus: "TRADE_SUCCESS",
      currentAccessState: AccessState.GRACE,
      now: new Date("2026-03-31T00:00:00.000Z"),
      fromCheckout: true,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.ACTIVE);
    expect(resolution.nextBillingStatus).toBe(AccessState.ACTIVE);
    expect(resolution.shouldRecordCheckoutCompletion).toBe(true);
  });

  it("preserves trial lifecycle when a WeChat order is still unpaid", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.WECHAT_PAY,
      providerStatus: "NOTPAY",
      currentAccessState: AccessState.TRIALING,
      now: new Date("2026-03-31T00:00:00.000Z"),
      graceDays: 7,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.TRIALING);
    expect(resolution.graceEndsAt?.toISOString()).toBe("2026-04-07T00:00:00.000Z");
  });

  it("keeps read-only access unchanged when a WeChat restore attempt closes", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.WECHAT_PAY,
      providerStatus: "CLOSED",
      currentAccessState: AccessState.READ_ONLY,
      now: new Date("2026-03-31T00:00:00.000Z"),
      graceDays: 7,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.READ_ONLY);
    expect(resolution.nextBillingStatus).toBe(AccessState.READ_ONLY);
  });

  it("keeps grace unchanged when an Alipay renew attempt closes", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.ALIPAY,
      providerStatus: "TRADE_CLOSED",
      currentAccessState: AccessState.GRACE,
      now: new Date("2026-03-31T00:00:00.000Z"),
      graceDays: 7,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.GRACE);
    expect(resolution.nextBillingStatus).toBe(AccessState.GRACE);
  });

  it("restores read-only access to active after China payment success", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.WECHAT_PAY,
      providerStatus: "SUCCESS",
      currentAccessState: AccessState.READ_ONLY,
      now: new Date("2026-03-31T00:00:00.000Z"),
      fromCheckout: true,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.ACTIVE);
    expect(resolution.nextBillingStatus).toBe(AccessState.ACTIVE);
    expect(resolution.shouldRecordCheckoutCompletion).toBe(true);
  });

  it("gives active payment windows a grace tail instead of ending immediately at period end", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.STRIPE,
      providerStatus: "active",
      currentAccessState: AccessState.ACTIVE,
      currentPeriodStart: 1_774_713_600,
      currentPeriodEnd: 1_777_392_000,
      now: new Date("2026-03-31T00:00:00.000Z"),
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.ACTIVE);
    expect(resolution.graceEndsAt?.toISOString()).toBe("2026-05-05T16:00:00.000Z");
  });
});
