import { afterEach, describe, expect, it } from "vitest";
import { PaymentProvider } from "@prisma/client";
import { resolveWorkspacePaymentRail } from "@/lib/billing/payment-provider-resolver";

describe("payment rail resolver", () => {
  const envSnapshot = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_HELM_TEAM_PRICE_ID: process.env.STRIPE_HELM_TEAM_PRICE_ID,
    STRIPE_HELM_ACTIVE_SEAT_PRICE_ID: process.env.STRIPE_HELM_ACTIVE_SEAT_PRICE_ID,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    ALIPAY_APP_ID: process.env.ALIPAY_APP_ID,
    ALIPAY_PRIVATE_KEY: process.env.ALIPAY_PRIVATE_KEY,
    ALIPAY_PUBLIC_KEY: process.env.ALIPAY_PUBLIC_KEY,
    WECHAT_PAY_APP_ID: process.env.WECHAT_PAY_APP_ID,
    WECHAT_PAY_MERCHANT_ID: process.env.WECHAT_PAY_MERCHANT_ID,
    WECHAT_PAY_MERCHANT_SERIAL_NO: process.env.WECHAT_PAY_MERCHANT_SERIAL_NO,
    WECHAT_PAY_PRIVATE_KEY: process.env.WECHAT_PAY_PRIVATE_KEY,
    WECHAT_PAY_PLATFORM_PUBLIC_KEY: process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY,
    WECHAT_PAY_API_V3_KEY: process.env.WECHAT_PAY_API_V3_KEY,
    APP_URL: process.env.APP_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  it("resolves English workspaces to the live Stripe rail when Stripe is configured", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_HELM_TEAM_PRICE_ID = "price_team";
    process.env.STRIPE_HELM_ACTIVE_SEAT_PRICE_ID = "price_seat";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.APP_URL = "https://helm.example.com";

    const rail = resolveWorkspacePaymentRail({
      defaultLocale: "en-US",
      paymentProvider: PaymentProvider.STRIPE,
    });

    expect(rail.provider).toBe(PaymentProvider.STRIPE);
    expect(rail.region).toBe("GLOBAL");
    expect(rail.checkoutConfigured).toBe(true);
    expect(rail.portalConfigured).toBe(true);
    expect(rail.lifecycleSourceConnected).toBe(true);
  });

  it("rewrites legacy zh workspaces with no live payment link back onto the CN rail", () => {
    const rail = resolveWorkspacePaymentRail({
      defaultLocale: "zh-CN",
      paymentProvider: PaymentProvider.STRIPE,
      paymentCustomerId: null,
      paymentSubscriptionId: null,
      paymentSubscriptionStatus: null,
    });

    expect(rail.provider).toBe(PaymentProvider.ALIPAY);
    expect(rail.region).toBe("CN");
    expect(rail.integrationStage).toBe("FOUNDATION_ONLY");
    expect(rail.checkoutConfigured).toBe(false);
    expect(rail.billingPortalMode).toBe("NONE_YET");
  });

  it("keeps an explicit WeChat Pay rail when the organization already chose it", () => {
    const rail = resolveWorkspacePaymentRail({
      defaultLocale: "zh-CN",
      paymentProvider: PaymentProvider.WECHAT_PAY,
    });

    expect(rail.provider).toBe(PaymentProvider.WECHAT_PAY);
    expect(rail.checkoutMode).toBe("WECHAT_NATIVE_OR_H5");
    expect(rail.availableProviders).toEqual([
      PaymentProvider.ALIPAY,
      PaymentProvider.WECHAT_PAY,
    ]);
  });

  it("marks Alipay as live when the narrow checkout and notify env is configured", () => {
    process.env.APP_URL = "https://helm.example.cn";
    process.env.ALIPAY_APP_ID = "ali_app";
    process.env.ALIPAY_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----";
    process.env.ALIPAY_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\\nxyz\\n-----END PUBLIC KEY-----";

    const rail = resolveWorkspacePaymentRail({
      defaultLocale: "zh-CN",
      paymentProvider: PaymentProvider.ALIPAY,
    });

    expect(rail.provider).toBe(PaymentProvider.ALIPAY);
    expect(rail.integrationStage).toBe("LIVE");
    expect(rail.checkoutConfigured).toBe(true);
    expect(rail.lifecycleSourceConnected).toBe(true);
    expect(rail.callbackMode).toBe("ALIPAY_NOTIFY");
  });

  it("marks WeChat Pay as live when the narrow checkout and notify env is configured", () => {
    process.env.APP_URL = "https://helm.example.cn";
    process.env.WECHAT_PAY_APP_ID = "wx_app";
    process.env.WECHAT_PAY_MERCHANT_ID = "mch_123";
    process.env.WECHAT_PAY_MERCHANT_SERIAL_NO = "serial_123";
    process.env.WECHAT_PAY_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----";
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\\nxyz\\n-----END PUBLIC KEY-----";
    process.env.WECHAT_PAY_API_V3_KEY = "0123456789abcdef0123456789abcdef";

    const rail = resolveWorkspacePaymentRail({
      defaultLocale: "zh-CN",
      paymentProvider: PaymentProvider.WECHAT_PAY,
    });

    expect(rail.provider).toBe(PaymentProvider.WECHAT_PAY);
    expect(rail.integrationStage).toBe("LIVE");
    expect(rail.checkoutConfigured).toBe(true);
    expect(rail.lifecycleSourceConnected).toBe(true);
    expect(rail.callbackMode).toBe("WECHAT_PAY_NOTIFY");
  });
});
