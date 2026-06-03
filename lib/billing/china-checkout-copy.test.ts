import { PaymentProvider } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { createAlipayCheckoutSession } from "@/lib/billing/alipay";
import { createWeChatPayCheckoutSession } from "@/lib/billing/wechat-pay";

const checkoutInput = {
  workspaceId: "workspace_1",
  userId: "user_1",
  organizationName: "Helm Demo Workspace",
  currentPlan: "HELM_TEAM",
  accessState: "TRIAL_ACTIVE",
  activeSeatCount: 3,
  includedAdminSeats: 1,
  additionalBillableSeats: 2,
  baseFeeCents: 19_900,
  activeSeatPriceCents: 9_900,
};

describe("China checkout copy", () => {
  const envSnapshot = {
    ALIPAY_APP_ID: process.env.ALIPAY_APP_ID,
    ALIPAY_PRIVATE_KEY: process.env.ALIPAY_PRIVATE_KEY,
    WECHAT_PAY_APP_ID: process.env.WECHAT_PAY_APP_ID,
    WECHAT_PAY_MERCHANT_ID: process.env.WECHAT_PAY_MERCHANT_ID,
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

  it("localizes Alipay checkout configuration errors for Chinese callers", async () => {
    delete process.env.ALIPAY_APP_ID;
    delete process.env.ALIPAY_PRIVATE_KEY;

    await expect(
      createAlipayCheckoutSession({
        ...checkoutInput,
        provider: PaymentProvider.ALIPAY,
        locale: "zh-CN",
      }),
    ).rejects.toThrow("支付宝购买入口还没有配置完成。");
  });

  it("preserves Alipay checkout configuration English copy for English callers", async () => {
    delete process.env.ALIPAY_APP_ID;
    delete process.env.ALIPAY_PRIVATE_KEY;

    await expect(
      createAlipayCheckoutSession({
        ...checkoutInput,
        provider: PaymentProvider.ALIPAY,
        locale: "en-US",
      }),
    ).rejects.toThrow("Alipay checkout is not configured yet");
  });

  it("localizes WeChat Pay checkout configuration errors for Chinese callers", async () => {
    delete process.env.WECHAT_PAY_APP_ID;
    delete process.env.WECHAT_PAY_MERCHANT_ID;

    await expect(
      createWeChatPayCheckoutSession({
        ...checkoutInput,
        provider: PaymentProvider.WECHAT_PAY,
        locale: "zh-CN",
      }),
    ).rejects.toThrow("微信支付购买入口还没有配置完成。");
  });

  it("preserves WeChat Pay checkout configuration English copy for English callers", async () => {
    delete process.env.WECHAT_PAY_APP_ID;
    delete process.env.WECHAT_PAY_MERCHANT_ID;

    await expect(
      createWeChatPayCheckoutSession({
        ...checkoutInput,
        provider: PaymentProvider.WECHAT_PAY,
        locale: "en-US",
      }),
    ).rejects.toThrow("WeChat Pay checkout is not configured yet");
  });
});
