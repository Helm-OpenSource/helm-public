import { PaymentProvider } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PAYMENT_WEBHOOK_CALLBACK_STATUS,
  type PaymentWebhookCallbackMode,
  type PaymentWebhookCallbackStatus,
} from "@/lib/auth/payment-webhook-callback-types";

type PaymentWebhookCallbackPayload = Record<string, unknown> | undefined;

function serializePayload(payload: PaymentWebhookCallbackPayload) {
  return payload ? JSON.stringify(payload) : undefined;
}

type BeginPaymentWebhookCallbackEventInput = {
  provider: PaymentProvider;
  callbackMode: PaymentWebhookCallbackMode;
  callbackFingerprint: string;
  externalEventId?: string | null;
  sourcePage: string;
  summary: string;
  payload?: PaymentWebhookCallbackPayload;
};

type FinalizePaymentWebhookCallbackEventInput = {
  eventId: string;
  governanceStatus: Exclude<PaymentWebhookCallbackStatus, "RECEIVED">;
  workspaceId?: string | null;
  actionType?: string | null;
  resolutionSource?: string | null;
  failureReason?: string | null;
  authoritativeSource?: string | null;
  hintSource?: string | null;
  hintWorkspaceId?: string | null;
  summary: string;
  payload?: PaymentWebhookCallbackPayload;
};

export async function beginPaymentWebhookCallbackEvent(input: BeginPaymentWebhookCallbackEventInput) {
  const existing = await db.paymentWebhookCallbackEvent.findUnique({
    where: {
      callbackFingerprint: input.callbackFingerprint,
    },
  });

  if (existing) {
    if (existing.governanceStatus === PAYMENT_WEBHOOK_CALLBACK_STATUS.EXCEPTION) {
      const retried = await db.paymentWebhookCallbackEvent.update({
        where: { id: existing.id },
        data: {
          governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RECEIVED,
          summary: input.summary,
          payloadJson: serializePayload(input.payload),
          lastReceivedAt: new Date(),
          processedAt: null,
          failureReason: null,
          resolutionSource: null,
          actionType: null,
          authoritativeSource: null,
          hintSource: null,
          hintWorkspaceId: null,
        },
      });

      return {
        status: "retry",
        event: retried,
      } as const;
    }

    const duplicated = await db.paymentWebhookCallbackEvent.update({
      where: { id: existing.id },
      data: {
        duplicateReceptionCount: {
          increment: 1,
        },
        lastDuplicateAt: new Date(),
        lastReceivedAt: new Date(),
      },
    });

    return {
      status: "duplicate",
      event: duplicated,
    } as const;
  }

  const created = await db.paymentWebhookCallbackEvent.create({
    data: {
      provider: input.provider,
      callbackMode: input.callbackMode,
      callbackFingerprint: input.callbackFingerprint,
      externalEventId: input.externalEventId ?? undefined,
      governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.RECEIVED,
      summary: input.summary,
      payloadJson: serializePayload(input.payload),
      firstReceivedAt: new Date(),
      lastReceivedAt: new Date(),
    },
  });

  return {
    status: "created",
    event: created,
  } as const;
}

export async function recordPaymentWebhookVerificationFailure(input: {
  provider: PaymentProvider;
  callbackMode: PaymentWebhookCallbackMode;
  callbackFingerprint: string;
  sourcePage: string;
  summary: string;
  failureReason: string;
  hintSource?: string | null;
  hintWorkspaceId?: string | null;
  payload?: PaymentWebhookCallbackPayload;
}) {
  const existing = await db.paymentWebhookCallbackEvent.findUnique({
    where: {
      callbackFingerprint: input.callbackFingerprint,
    },
  });

  if (existing) {
    return db.paymentWebhookCallbackEvent.update({
      where: { id: existing.id },
      data: {
        governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.VERIFICATION_FAILED,
        summary: input.summary,
        failureReason: input.failureReason,
        hintSource: input.hintSource ?? undefined,
        hintWorkspaceId: input.hintWorkspaceId ?? undefined,
        payloadJson: serializePayload(input.payload),
        lastReceivedAt: new Date(),
        lastDuplicateAt: new Date(),
        processedAt: new Date(),
        duplicateReceptionCount: {
          increment: 1,
        },
      },
    });
  }

  return db.paymentWebhookCallbackEvent.create({
    data: {
      provider: input.provider,
      callbackMode: input.callbackMode,
      callbackFingerprint: input.callbackFingerprint,
      governanceStatus: PAYMENT_WEBHOOK_CALLBACK_STATUS.VERIFICATION_FAILED,
      summary: input.summary,
      failureReason: input.failureReason,
      hintSource: input.hintSource ?? undefined,
      hintWorkspaceId: input.hintWorkspaceId ?? undefined,
      payloadJson: serializePayload(input.payload),
      firstReceivedAt: new Date(),
      lastReceivedAt: new Date(),
      processedAt: new Date(),
    },
  });
}

export async function finalizePaymentWebhookCallbackEvent(
  input: FinalizePaymentWebhookCallbackEventInput,
) {
  return db.paymentWebhookCallbackEvent.update({
    where: { id: input.eventId },
    data: {
      workspaceId: input.workspaceId ?? undefined,
      governanceStatus: input.governanceStatus,
      actionType: input.actionType ?? undefined,
      resolutionSource: input.resolutionSource ?? undefined,
      failureReason: input.failureReason ?? undefined,
      authoritativeSource: input.authoritativeSource ?? undefined,
      hintSource: input.hintSource ?? undefined,
      hintWorkspaceId: input.hintWorkspaceId ?? undefined,
      summary: input.summary,
      payloadJson: serializePayload(input.payload),
      processedAt: new Date(),
      lastReceivedAt: new Date(),
    },
  });
}
