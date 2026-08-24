import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  createStripeCustomer,
  listStripeSubscriptionsByCustomer,
  retrieveStripeSubscription,
} from "@/lib/billing/stripe";
import {
  createAlipayCheckoutSession,
  queryAlipayTradeStatus,
} from "@/lib/billing/alipay";
import {
  createWeChatPayCheckoutSession,
  queryWeChatPayOrderStatus,
} from "@/lib/billing/wechat-pay";

describe("payment provider deployment capability", () => {
  const originalFinancialActionsEnabled =
    process.env.HELM_FINANCIAL_ACTIONS_ENABLED;

  beforeEach(() => {
    process.env.HELM_FINANCIAL_ACTIONS_ENABLED = "false";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalFinancialActionsEnabled === undefined) {
      delete process.env.HELM_FINANCIAL_ACTIONS_ENABLED;
    } else {
      process.env.HELM_FINANCIAL_ACTIONS_ENABLED =
        originalFinancialActionsEnabled;
    }
  });

  it("blocks every payment adapter before configuration or provider access", async () => {
    const checkout = {
      workspaceId: "workspace-1",
      userId: "user-1",
      organizationName: "Example organization",
      email: "owner@example.test",
      locale: "en-US",
      accessState: "TRIALING",
      activeSeatCount: 1,
      includedAdminSeats: 1,
    };
    const providerCalls = [
      () =>
        createStripeCustomer({
          workspaceId: "workspace-1",
          organizationName: "Example organization",
          email: "owner@example.test",
          locale: "en-US",
        }),
      () => createStripeCheckoutSession(checkout),
      () => createStripeBillingPortalSession({ customerId: "customer-1" }),
      () => retrieveStripeSubscription("subscription-1"),
      () => listStripeSubscriptionsByCustomer("customer-1"),
      () =>
        createAlipayCheckoutSession(
          {} as Parameters<typeof createAlipayCheckoutSession>[0],
        ),
      () => queryAlipayTradeStatus("order-1"),
      () =>
        createWeChatPayCheckoutSession(
          {} as Parameters<typeof createWeChatPayCheckoutSession>[0],
        ),
      () => queryWeChatPayOrderStatus("order-1"),
    ];

    for (const callProvider of providerCalls) {
      await expect(callProvider()).rejects.toThrow(
        "deployment_capability_disabled:financial_action",
      );
    }

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
