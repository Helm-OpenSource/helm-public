import { describe, expect, it } from "vitest";
import { AccessState, PaymentProvider } from "@prisma/client";
import {
  canOpenBillingPortal,
  canStartCheckout,
  getAdditionalBillableSeatCount,
} from "@/lib/billing/payment";
import { mapPaymentLifecycle } from "@/lib/billing/payment-lifecycle-mapping";

describe("billing payment helpers", () => {
  it("keeps active subscriptions out of duplicate checkout", () => {
    expect(
      canStartCheckout({
        accessState: AccessState.ACTIVE,
        paymentSubscriptionStatus: "active",
      }),
    ).toBe(false);

    expect(
      canStartCheckout({
        accessState: AccessState.TRIALING,
        paymentSubscriptionStatus: null,
      }),
    ).toBe(true);

    expect(
      canStartCheckout({
        accessState: AccessState.ACTIVE,
        paymentSubscriptionStatus: "TRADE_SUCCESS",
      }),
    ).toBe(false);

    expect(
      canStartCheckout({
        accessState: AccessState.ACTIVE,
        paymentSubscriptionStatus: "SUCCESS",
      }),
    ).toBe(false);

    expect(
      canStartCheckout({
        accessState: AccessState.ACTIVE,
        paymentSubscriptionStatus: "TRADE_FINISHED",
      }),
    ).toBe(false);
  });

  it("opens portal only when payment is configured and a customer exists", () => {
    expect(
      canOpenBillingPortal({
        paymentCustomerId: "cus_123",
        paymentProviderConfigured: true,
        billingPortalMode: "STRIPE_PORTAL",
      }),
    ).toBe(true);

    expect(
      canOpenBillingPortal({
        paymentCustomerId: null,
        paymentProviderConfigured: true,
        billingPortalMode: "STRIPE_PORTAL",
      }),
    ).toBe(false);

    expect(
      canOpenBillingPortal({
        paymentCustomerId: "wx_order",
        paymentProviderConfigured: true,
        billingPortalMode: "NONE_YET",
      }),
    ).toBe(false);
  });

  it("maps active stripe subscriptions to active workspace access", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.STRIPE,
      providerStatus: "active",
      currentPeriodStart: 1_700_000_000,
      currentPeriodEnd: 1_700_086_400,
      fromCheckout: true,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.ACTIVE);
    expect(resolution.nextBillingStatus).toBe(AccessState.ACTIVE);
    expect(resolution.shouldRecordCheckoutCompletion).toBe(true);
    expect(resolution.billingPeriodEndsAt).toBeTruthy();
  });

  it("maps past due and unpaid subscriptions into grace", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.STRIPE,
      providerStatus: "past_due",
      currentPeriodEnd: null,
      now: new Date("2026-03-31T00:00:00.000Z"),
      graceDays: 7,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.GRACE);
    expect(resolution.nextBillingStatus).toBe(AccessState.GRACE);
    expect(resolution.graceEndsAt?.toISOString()).toBe("2026-04-07T00:00:00.000Z");
  });

  it("maps canceled subscriptions to canceled commercial state with read-only path", () => {
    const resolution = mapPaymentLifecycle({
      provider: PaymentProvider.STRIPE,
      providerStatus: "canceled",
      currentPeriodEnd: null,
      now: new Date("2026-03-31T00:00:00.000Z"),
      graceDays: 7,
    });

    expect(resolution.nextTrialStateStatus).toBe(AccessState.CANCELED);
    expect(resolution.nextBillingStatus).toBe(AccessState.CANCELED);
    expect(resolution.graceEndsAt?.toISOString()).toBe("2026-04-07T00:00:00.000Z");
  });

  it("computes additional billable seats conservatively", () => {
    expect(getAdditionalBillableSeatCount(1, 1)).toBe(0);
    expect(getAdditionalBillableSeatCount(3, 1)).toBe(2);
    expect(getAdditionalBillableSeatCount(0, 1)).toBe(0);
  });
});
