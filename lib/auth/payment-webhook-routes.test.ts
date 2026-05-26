import { beforeEach, describe, expect, it, vi } from "vitest";

const { stripeMock, alipayMock, wechatMock, governanceMock, callbackStoreMock, integrationMock, auditMock } =
  vi.hoisted(() => ({
    stripeMock: {
      verifyStripeWebhookSignature: vi.fn(),
    },
    alipayMock: {
      verifyAlipayNotifyPayload: vi.fn(),
    },
    wechatMock: {
      verifyWeChatPayNotifySignature: vi.fn(),
      parseWeChatPayNotifyPayload: vi.fn(),
      decryptWeChatPayNotifyPayload: vi.fn(),
    },
    governanceMock: {
      resolveStripeWebhookTenancy: vi.fn(),
      resolveAlipayNotifyTenancy: vi.fn(),
      resolveWeChatPayNotifyTenancy: vi.fn(),
      extractStripeWebhookWorkspaceHint: vi.fn(),
      extractAlipayNotifyWorkspaceHint: vi.fn(),
      buildBillingWebhookGovernanceSummary: vi.fn(),
      buildBillingWebhookUnresolvedSummary: vi.fn(),
      buildBillingWebhookVerificationFailureSummary: vi.fn(),
      buildBillingWebhookDuplicateSummary: vi.fn(),
      buildBillingWebhookExceptionSummary: vi.fn(),
      buildBillingWebhookUnsupportedSummary: vi.fn(),
      buildPaymentWebhookCallbackFingerprint: vi.fn(),
    },
    callbackStoreMock: {
      beginPaymentWebhookCallbackEvent: vi.fn(),
      finalizePaymentWebhookCallbackEvent: vi.fn(),
      recordPaymentWebhookVerificationFailure: vi.fn(),
    },
    integrationMock: {
      syncWorkspacePaymentStatusFromCallbackEvent: vi.fn(),
    },
    auditMock: {
      writeAuditLog: vi.fn(),
    },
  }));

vi.mock("@/lib/billing/stripe", () => ({
  verifyStripeWebhookSignature: stripeMock.verifyStripeWebhookSignature,
}));

vi.mock("@/lib/billing/alipay", () => ({
  verifyAlipayNotifyPayload: alipayMock.verifyAlipayNotifyPayload,
}));

vi.mock("@/lib/billing/wechat-pay", () => ({
  verifyWeChatPayNotifySignature: wechatMock.verifyWeChatPayNotifySignature,
  parseWeChatPayNotifyPayload: wechatMock.parseWeChatPayNotifyPayload,
  decryptWeChatPayNotifyPayload: wechatMock.decryptWeChatPayNotifyPayload,
}));

vi.mock("@/lib/auth/payment-webhook-governance", () => ({
  resolveStripeWebhookTenancy: governanceMock.resolveStripeWebhookTenancy,
  resolveAlipayNotifyTenancy: governanceMock.resolveAlipayNotifyTenancy,
  resolveWeChatPayNotifyTenancy: governanceMock.resolveWeChatPayNotifyTenancy,
  extractStripeWebhookWorkspaceHint: governanceMock.extractStripeWebhookWorkspaceHint,
  extractAlipayNotifyWorkspaceHint: governanceMock.extractAlipayNotifyWorkspaceHint,
  buildBillingWebhookGovernanceSummary: governanceMock.buildBillingWebhookGovernanceSummary,
  buildBillingWebhookUnresolvedSummary: governanceMock.buildBillingWebhookUnresolvedSummary,
  buildBillingWebhookVerificationFailureSummary: governanceMock.buildBillingWebhookVerificationFailureSummary,
  buildBillingWebhookDuplicateSummary: governanceMock.buildBillingWebhookDuplicateSummary,
  buildBillingWebhookExceptionSummary: governanceMock.buildBillingWebhookExceptionSummary,
  buildBillingWebhookUnsupportedSummary: governanceMock.buildBillingWebhookUnsupportedSummary,
  buildPaymentWebhookCallbackFingerprint: governanceMock.buildPaymentWebhookCallbackFingerprint,
}));

vi.mock("@/lib/auth/payment-webhook-callback-store", () => ({
  beginPaymentWebhookCallbackEvent: callbackStoreMock.beginPaymentWebhookCallbackEvent,
  finalizePaymentWebhookCallbackEvent: callbackStoreMock.finalizePaymentWebhookCallbackEvent,
  recordPaymentWebhookVerificationFailure: callbackStoreMock.recordPaymentWebhookVerificationFailure,
}));

vi.mock("@/lib/billing/integration", () => ({
  syncWorkspacePaymentStatusFromCallbackEvent:
    integrationMock.syncWorkspacePaymentStatusFromCallbackEvent,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

import { POST as stripeWebhookRoute } from "@/app/api/billing/stripe/webhook/route";
import { POST as alipayNotifyRoute } from "@/app/api/billing/alipay/notify/route";
import { POST as wechatNotifyRoute } from "@/app/api/billing/wechat-pay/notify/route";

describe("payment webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMock.verifyStripeWebhookSignature.mockImplementation(() => undefined);
    alipayMock.verifyAlipayNotifyPayload.mockReturnValue({
      out_trade_no: "order-1",
      trade_no: "trade-1",
      trade_status: "TRADE_SUCCESS",
      passback_params: "workspace-1",
      buyer_user_id: "buyer-1",
    });
    wechatMock.verifyWeChatPayNotifySignature.mockImplementation(() => undefined);
    wechatMock.parseWeChatPayNotifyPayload.mockReturnValue({ id: "event-1" });
    wechatMock.decryptWeChatPayNotifyPayload.mockReturnValue({
      out_trade_no: "order-1",
      transaction_id: "tx-1",
      trade_state: "SUCCESS",
      payer: { openid: "openid-1" },
    });
    governanceMock.buildBillingWebhookGovernanceSummary.mockReturnValue("resolved callback");
    governanceMock.buildBillingWebhookUnresolvedSummary.mockReturnValue("unresolved callback");
    governanceMock.buildBillingWebhookVerificationFailureSummary.mockReturnValue("verification failed");
    governanceMock.buildBillingWebhookDuplicateSummary.mockReturnValue("duplicate callback");
    governanceMock.buildBillingWebhookExceptionSummary.mockReturnValue("exception callback");
    governanceMock.buildBillingWebhookUnsupportedSummary.mockReturnValue("unsupported callback");
    governanceMock.buildPaymentWebhookCallbackFingerprint.mockReturnValue("fingerprint-1");
    governanceMock.extractStripeWebhookWorkspaceHint.mockReturnValue({
      workspaceId: null,
      hintSource: null,
    });
    governanceMock.extractAlipayNotifyWorkspaceHint.mockReturnValue({
      workspaceId: null,
      hintSource: null,
    });
    callbackStoreMock.beginPaymentWebhookCallbackEvent.mockResolvedValue({
      status: "created",
      event: { id: "callback-1" },
    });
    callbackStoreMock.finalizePaymentWebhookCallbackEvent.mockResolvedValue(undefined);
    callbackStoreMock.recordPaymentWebhookVerificationFailure.mockResolvedValue(undefined);
    integrationMock.syncWorkspacePaymentStatusFromCallbackEvent.mockResolvedValue(undefined);
    auditMock.writeAuditLog.mockResolvedValue(undefined);
  });

  it("keeps Stripe unresolved callbacks outside workspace audit when tenant mapping fails", async () => {
    governanceMock.resolveStripeWebhookTenancy.mockResolvedValue({
      resolved: false,
      reason: "workspace-unresolved",
    });

    const response = await stripeWebhookRoute(
      new Request("http://localhost/api/billing/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: JSON.stringify({
          id: "event-1",
          type: "checkout.session.completed",
          data: { object: { id: "cs_123" } },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ignored: true,
      reason: "workspace-unresolved",
      type: "checkout.session.completed",
    });
    expect(integrationMock.syncWorkspacePaymentStatusFromCallbackEvent).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
    expect(callbackStoreMock.finalizePaymentWebhookCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "callback-1",
        governanceStatus: "UNRESOLVED",
      }),
    );
  });

  it("writes Stripe mismatch governance audit before returning success", async () => {
    governanceMock.resolveStripeWebhookTenancy.mockResolvedValue({
      resolved: true,
      workspaceId: "workspace-1",
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
      authoritativeSource: "stripe.subscription_id",
      hintSource: "stripe.metadata.workspace_id",
      resolutionSource: "stripe.subscription_id",
      hintWorkspaceId: "workspace-2",
    });

    const response = await stripeWebhookRoute(
      new Request("http://localhost/api/billing/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: JSON.stringify({
          id: "event-1",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_123",
              subscription: "sub_123",
              customer: "cus_123",
              metadata: { workspaceId: "workspace-2" },
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      received: true,
      type: "checkout.session.completed",
    });
    expect(integrationMock.syncWorkspacePaymentStatusFromCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
      }),
    );
    expect(callbackStoreMock.finalizePaymentWebhookCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "callback-1",
        governanceStatus: "RESOLVED",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("keeps Alipay notify on narrow hint-fallback governance without broadening authority", async () => {
    alipayMock.verifyAlipayNotifyPayload.mockReturnValue({
      out_trade_no: "order-1",
      trade_no: "trade-1",
      trade_status: "TRADE_SUCCESS",
      passback_params: "workspace-1",
      buyer_user_id: "buyer-1",
    });
    governanceMock.resolveAlipayNotifyTenancy.mockResolvedValue({
      resolved: true,
      workspaceId: "workspace-1",
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
      authoritativeSource: null,
      hintSource: "alipay.passback_params",
      resolutionSource: "alipay.passback_params",
      hintWorkspaceId: "workspace-1",
    });

    const response = await alipayNotifyRoute(
      new Request("http://localhost/api/billing/alipay/notify", {
        method: "POST",
        body: "out_trade_no=order-1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("success");
    expect(integrationMock.syncWorkspacePaymentStatusFromCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
      }),
    );
    expect(callbackStoreMock.finalizePaymentWebhookCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "callback-1",
        governanceStatus: "RESOLVED",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("keeps WeChat notify on authoritative tenant mapping when callback resolves cleanly", async () => {
    wechatMock.parseWeChatPayNotifyPayload.mockReturnValue({ id: "event-1" });
    wechatMock.decryptWeChatPayNotifyPayload.mockReturnValue({
      out_trade_no: "order-1",
      transaction_id: "tx-1",
      trade_state: "SUCCESS",
      payer: { openid: "openid-1" },
    });
    governanceMock.resolveWeChatPayNotifyTenancy.mockResolvedValue({
      resolved: true,
      workspaceId: "workspace-1",
      actionType: "BILLING_WEBHOOK_TENANCY_RESOLVED",
      authoritativeSource: "wechat.out_trade_no",
      hintSource: null,
      resolutionSource: "wechat.out_trade_no",
      hintWorkspaceId: null,
    });

    const response = await wechatNotifyRoute(
      new Request("http://localhost/api/billing/wechat-pay/notify", {
        method: "POST",
        headers: {
          "wechatpay-timestamp": "1",
          "wechatpay-nonce": "nonce",
          "wechatpay-signature": "sig",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "成功",
    });
    expect(integrationMock.syncWorkspacePaymentStatusFromCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actionType: "BILLING_WEBHOOK_TENANCY_RESOLVED",
      }),
    );
    expect(callbackStoreMock.finalizePaymentWebhookCallbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "callback-1",
        governanceStatus: "RESOLVED",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("records verification failure before returning Stripe webhook 400", async () => {
    stripeMock.verifyStripeWebhookSignature.mockImplementation(() => {
      throw new Error("bad signature");
    });
    governanceMock.extractStripeWebhookWorkspaceHint.mockReturnValueOnce({
      workspaceId: "workspace-1",
      hintSource: "stripe.metadata.workspace_id",
    });

    const response = await stripeWebhookRoute(
      new Request("http://localhost/api/billing/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: JSON.stringify({
          id: "event-1",
          type: "checkout.session.completed",
          data: { object: { id: "cs_123" } },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(callbackStoreMock.recordPaymentWebhookVerificationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        hintWorkspaceId: "workspace-1",
        hintSource: "stripe.metadata.workspace_id",
      }),
    );
    expect(callbackStoreMock.beginPaymentWebhookCallbackEvent).not.toHaveBeenCalled();
  });

  it("records hinted verification failure before returning Alipay notify 400", async () => {
    alipayMock.verifyAlipayNotifyPayload.mockImplementation(() => {
      throw new Error("bad notify");
    });
    governanceMock.extractAlipayNotifyWorkspaceHint.mockReturnValueOnce({
      workspaceId: "workspace-1",
      hintSource: "alipay.passback_params",
    });

    const response = await alipayNotifyRoute(
      new Request("http://localhost/api/billing/alipay/notify", {
        method: "POST",
        body: "out_trade_no=order-1&passback_params=workspace-1",
      }),
    );

    expect(response.status).toBe(400);
    expect(callbackStoreMock.recordPaymentWebhookVerificationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        hintWorkspaceId: "workspace-1",
        hintSource: "alipay.passback_params",
      }),
    );
    expect(callbackStoreMock.beginPaymentWebhookCallbackEvent).not.toHaveBeenCalled();
  });

  it("short-circuits duplicate Stripe callbacks before sync or workspace audit", async () => {
    callbackStoreMock.beginPaymentWebhookCallbackEvent.mockResolvedValueOnce({
      status: "duplicate",
      event: { id: "callback-1" },
    });

    const response = await stripeWebhookRoute(
      new Request("http://localhost/api/billing/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: JSON.stringify({
          id: "event-1",
          type: "checkout.session.completed",
          data: { object: { id: "cs_123" } },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ignored: true,
      reason: "duplicate-callback",
    });
    expect(integrationMock.syncWorkspacePaymentStatusFromCallbackEvent).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });
});
