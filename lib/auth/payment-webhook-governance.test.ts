import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    billingAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  buildBillingWebhookGovernanceSummary,
  extractAlipayNotifyWorkspaceHint,
  extractStripeWebhookWorkspaceHint,
  resolveAlipayNotifyTenancy,
  resolveStripeWebhookTenancy,
  resolveWeChatPayNotifyTenancy,
} from "@/lib/auth/payment-webhook-governance";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

describe("payment webhook governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.billingAccount.findMany.mockReset();
    dbMock.billingAccount.findUnique.mockReset();
    dbMock.workspace.findUnique.mockReset();
    dbMock.billingAccount.findMany.mockResolvedValue([]);
    dbMock.billingAccount.findUnique.mockResolvedValue(null);
    dbMock.workspace.findUnique.mockResolvedValue(null);
  });

  it("keeps Stripe on authoritative subscription mapping and marks hint mismatch", async () => {
    dbMock.billingAccount.findUnique
      .mockResolvedValueOnce({ workspaceId: "workspace-authoritative" })
      .mockResolvedValueOnce(null);
    dbMock.workspace.findUnique.mockResolvedValueOnce({ id: "workspace-hint" });

    const result = await resolveStripeWebhookTenancy({
      subscription: "sub_123",
      metadata: {
        workspaceId: "workspace-hint",
      },
    });

    expect(result).toMatchObject({
      resolved: true,
      workspaceId: "workspace-authoritative",
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_MISMATCH",
      authoritativeSource: "stripe.subscription_id",
      hintSource: "stripe.metadata.workspace_id",
      hintWorkspaceId: "workspace-hint",
    });
  });

  it("lets Stripe fall back to client reference when no authoritative billing mapping exists", async () => {
    dbMock.billingAccount.findUnique.mockResolvedValue(null);
    dbMock.workspace.findUnique.mockResolvedValueOnce({ id: "workspace-fallback" });

    const result = await resolveStripeWebhookTenancy({
      client_reference_id: "workspace-fallback",
    });

    expect(result).toMatchObject({
      resolved: true,
      workspaceId: "workspace-fallback",
      actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
      resolutionSource: "stripe.client_reference_id",
      authoritativeSource: null,
      hintSource: "stripe.client_reference_id",
    });
  });

  it("treats Alipay checkout/trade conflicts as unresolved instead of picking one workspace", async () => {
    dbMock.billingAccount.findMany.mockResolvedValueOnce([
      { workspaceId: "workspace-order" },
      { workspaceId: "workspace-other" },
    ]);
    dbMock.billingAccount.findUnique.mockResolvedValueOnce({ workspaceId: "workspace-trade" });

    const result = await resolveAlipayNotifyTenancy({
      outTradeNo: "order-1",
      tradeNo: "trade-1",
    });

    expect(result).toEqual({
      resolved: false,
      reason: "workspace-authoritative-conflict",
    });
  });

  it("keeps WeChat unresolved when neither checkout session nor transaction can map to a workspace", async () => {
    dbMock.billingAccount.findMany.mockResolvedValueOnce([]);
    dbMock.billingAccount.findUnique.mockResolvedValueOnce(null);

    const result = await resolveWeChatPayNotifyTenancy({
      outTradeNo: "order-1",
      transactionId: "tx-1",
    });

    expect(result).toEqual({
      resolved: false,
      reason: "workspace-unresolved",
    });
  });

  it("builds narrow governance summaries without overclaiming platform breadth", () => {
    expect(
      buildBillingWebhookGovernanceSummary({
        provider: PAYMENT_PROVIDER.STRIPE,
        actionType: "BILLING_WEBHOOK_TENANCY_RESOLVED",
        resolutionSource: "stripe.subscription_id",
      }),
    ).toContain("stripe.subscription_id");

    expect(
      buildBillingWebhookGovernanceSummary({
        provider: PAYMENT_PROVIDER.ALIPAY,
        actionType: "BILLING_WEBHOOK_TENANCY_HINT_FALLBACK",
        resolutionSource: "alipay.passback_params",
      }),
    ).toContain("fallback hint");
  });

  it("extracts untrusted workspace hints for pre-verification anomaly tracking", () => {
    expect(
      extractStripeWebhookWorkspaceHint(
        JSON.stringify({
          data: {
            object: {
              metadata: { workspaceId: "workspace-meta" },
              client_reference_id: "workspace-client",
            },
          },
        }),
      ),
    ).toEqual({
      workspaceId: "workspace-meta",
      hintSource: "stripe.metadata.workspace_id",
    });

    expect(
      extractAlipayNotifyWorkspaceHint("out_trade_no=order-1&passback_params=workspace-passback"),
    ).toEqual({
      workspaceId: "workspace-passback",
      hintSource: "alipay.passback_params",
    });
  });
});
