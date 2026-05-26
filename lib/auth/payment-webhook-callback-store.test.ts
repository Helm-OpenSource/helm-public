import { PaymentProvider } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAYMENT_WEBHOOK_CALLBACK_MODE,
  PAYMENT_WEBHOOK_CALLBACK_STATUS,
} from "@/lib/auth/payment-webhook-callback-types";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    paymentWebhookCallbackEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  beginPaymentWebhookCallbackEvent,
  finalizePaymentWebhookCallbackEvent,
  recordPaymentWebhookVerificationFailure,
} from "@/lib/auth/payment-webhook-callback-store";

describe("payment webhook callback store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.paymentWebhookCallbackEvent.findUnique.mockResolvedValue(null);
    dbMock.paymentWebhookCallbackEvent.create.mockImplementation(async ({ data }) => ({
      id: "callback-1",
      duplicateReceptionCount: 0,
      ...data,
    }));
    dbMock.paymentWebhookCallbackEvent.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      duplicateReceptionCount: data.duplicateReceptionCount?.increment ?? 0,
      ...data,
    }));
  });

  it("creates a new governance event for a first callback reception", async () => {
    const result = await beginPaymentWebhookCallbackEvent({
      provider: PaymentProvider.STRIPE,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.STRIPE_WEBHOOK,
      callbackFingerprint: "fingerprint-1",
      externalEventId: "event-1",
      sourcePage: "/api/billing/stripe/webhook",
      summary: "received",
      payload: { eventType: "checkout.session.completed" },
    });

    expect(result.status).toBe("created");
    expect(dbMock.paymentWebhookCallbackEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: PaymentProvider.STRIPE,
          governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RECEIVED,
          callbackFingerprint: "fingerprint-1",
        }),
      }),
    );
  });

  it("marks duplicate receptions on an existing final callback event", async () => {
    dbMock.paymentWebhookCallbackEvent.findUnique.mockResolvedValueOnce({
      id: "callback-1",
      governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RESOLVED,
    });

    const result = await beginPaymentWebhookCallbackEvent({
      provider: PaymentProvider.STRIPE,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.STRIPE_WEBHOOK,
      callbackFingerprint: "fingerprint-1",
      externalEventId: "event-1",
      sourcePage: "/api/billing/stripe/webhook",
      summary: "received",
    });

    expect(result.status).toBe("duplicate");
    expect(dbMock.paymentWebhookCallbackEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "callback-1" },
        data: expect.objectContaining({
          duplicateReceptionCount: { increment: 1 },
        }),
      }),
    );
  });

  it("reopens exception events for retry instead of treating them as duplicates", async () => {
    dbMock.paymentWebhookCallbackEvent.findUnique.mockResolvedValueOnce({
      id: "callback-1",
      governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.EXCEPTION,
    });

    const result = await beginPaymentWebhookCallbackEvent({
      provider: PaymentProvider.ALIPAY,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.ALIPAY_NOTIFY,
      callbackFingerprint: "fingerprint-2",
      externalEventId: "trade-1",
      sourcePage: "/api/billing/alipay/notify",
      summary: "retry",
    });

    expect(result.status).toBe("retry");
    expect(dbMock.paymentWebhookCallbackEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "callback-1" },
        data: expect.objectContaining({
          governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RECEIVED,
        }),
      }),
    );
  });

  it("records verification failures without creating workspace-scoped audit truth", async () => {
    await recordPaymentWebhookVerificationFailure({
      provider: PaymentProvider.WECHAT_PAY,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.WECHAT_PAY_NOTIFY,
      callbackFingerprint: "fingerprint-3",
      sourcePage: "/api/billing/wechat-pay/notify",
      summary: "verification failed",
      failureReason: "wechat-notify-verification-failed",
      hintSource: "stripe.metadata.workspace_id",
      hintWorkspaceId: "workspace-1",
      payload: { error: "bad signature" },
    });

    expect(dbMock.paymentWebhookCallbackEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.VERIFICATION_FAILED,
          hintSource: "stripe.metadata.workspace_id",
          hintWorkspaceId: "workspace-1",
        }),
      }),
    );
    expect(dbMock.paymentWebhookCallbackEvent.create.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "workspaceId",
    );
  });

  it("finalizes a callback event with tenant-mapped governance truth", async () => {
    await finalizePaymentWebhookCallbackEvent({
      eventId: "callback-1",
      governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RESOLVED,
      workspaceId: "workspace-1",
      actionType: "BILLING_WEBHOOK_TENANCY_RESOLVED",
      resolutionSource: "stripe.subscription_id",
      summary: "resolved callback",
      payload: { eventType: "checkout.session.completed" },
    });

    expect(dbMock.paymentWebhookCallbackEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "callback-1" },
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RESOLVED,
        }),
      }),
    );
  });
});
