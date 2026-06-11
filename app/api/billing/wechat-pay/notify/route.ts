import { NextResponse } from "next/server";
import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { PAYMENT_WEBHOOK_CALLBACK_MODE } from "@/lib/auth/payment-webhook-callback-types";
import {
  buildBillingWebhookDuplicateSummary,
  buildBillingWebhookExceptionSummary,
  buildBillingWebhookGovernanceSummary,
  buildBillingWebhookUnresolvedSummary,
  buildBillingWebhookVerificationFailureSummary,
  buildPaymentWebhookCallbackFingerprint,
  resolveWeChatPayNotifyTenancy,
} from "@/lib/auth/payment-webhook-governance";
import {
  beginPaymentWebhookCallbackEvent,
  finalizePaymentWebhookCallbackEvent,
  recordPaymentWebhookVerificationFailure,
} from "@/lib/auth/payment-webhook-callback-store";
import { getChinaBillingPeriodUnix } from "@/lib/billing/china-payment";
import { syncWorkspacePaymentStatusFromCallbackEvent } from "@/lib/billing/integration";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";
import {
  decryptWeChatPayNotifyPayload,
  parseWeChatPayNotifyPayload,
  verifyWeChatPayNotifySignature,
} from "@/lib/billing/wechat-pay";
import { serverErrorMessage } from "@/lib/http/server-error";

export const runtime = "nodejs";

function successResponse() {
  return NextResponse.json({
    code: "SUCCESS",
    message: "成功",
  });
}

function failureResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      code: "FAIL",
      message,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sourcePage = "/api/billing/wechat-pay/notify";

  try {
    verifyWeChatPayNotifySignature({
      body: rawBody,
      timestamp: request.headers.get("wechatpay-timestamp"),
      nonce: request.headers.get("wechatpay-nonce"),
      signature: request.headers.get("wechatpay-signature"),
    });
  } catch (error) {
    await recordPaymentWebhookVerificationFailure({
      provider: PAYMENT_PROVIDER.WECHAT_PAY,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.WECHAT_PAY_NOTIFY,
      callbackFingerprint: buildPaymentWebhookCallbackFingerprint({
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
        rawBody,
      }),
      sourcePage,
      summary: buildBillingWebhookVerificationFailureSummary({
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
      }),
      failureReason: "wechat-notify-verification-failed",
      payload: {
        error: serverErrorMessage(error, "WeChat Pay notify verification failed"),
      },
    });

    return failureResponse(
      serverErrorMessage(error, "WeChat Pay notify verification failed"),
    );
  }

  const payload = parseWeChatPayNotifyPayload(rawBody);
  const decrypted = decryptWeChatPayNotifyPayload(payload);
  const callbackEvent = await beginPaymentWebhookCallbackEvent({
    provider: PAYMENT_PROVIDER.WECHAT_PAY,
    callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.WECHAT_PAY_NOTIFY,
    callbackFingerprint: buildPaymentWebhookCallbackFingerprint({
      provider: PAYMENT_PROVIDER.WECHAT_PAY,
      externalEventId: payload.id ?? null,
      fingerprintParts: [decrypted.out_trade_no ?? null, decrypted.transaction_id ?? null, decrypted.trade_state ?? null],
      rawBody,
    }),
    externalEventId: payload.id ?? null,
    sourcePage,
    summary: `Received WeChat Pay notify ${decrypted.trade_state ?? "unknown-state"}`,
    payload: {
      outTradeNo: decrypted.out_trade_no ?? null,
      transactionId: decrypted.transaction_id ?? null,
      tradeState: decrypted.trade_state ?? null,
    },
  });

  if (callbackEvent.status === "duplicate") {
    return successResponse();
  }

  const tenancy = await resolveWeChatPayNotifyTenancy({
    outTradeNo: decrypted.out_trade_no ?? null,
    transactionId: decrypted.transaction_id ?? null,
  });

  if (!tenancy.resolved || !decrypted.trade_state) {
    await finalizePaymentWebhookCallbackEvent({
      eventId: callbackEvent.event.id,
      governanceStatus: "UNRESOLVED",
      summary: buildBillingWebhookUnresolvedSummary({
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
        reason: !tenancy.resolved ? tenancy.reason : "workspace-unresolved",
      }),
      failureReason: !tenancy.resolved ? tenancy.reason : "provider-status-missing",
      payload: {
        outTradeNo: decrypted.out_trade_no ?? null,
        transactionId: decrypted.transaction_id ?? null,
        tradeState: decrypted.trade_state ?? null,
      },
    });

    return successResponse();
  }

  const paidAt = decrypted.success_time ? new Date(decrypted.success_time) : new Date();
  const period = getChinaBillingPeriodUnix(paidAt);

  try {
    await syncWorkspacePaymentStatusFromCallbackEvent({
      workspaceId: tenancy.workspaceId,
      event: {
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
        eventType:
          decrypted.trade_state === "SUCCESS"
            ? "PAYMENT_SUCCEEDED"
            : decrypted.trade_state === "CLOSED" ||
                decrypted.trade_state === "REVOKED" ||
                decrypted.trade_state === "PAYERROR"
              ? "PAYMENT_CLOSED"
              : "PAYMENT_EXPIRED",
        checkoutSessionId: decrypted.out_trade_no ?? null,
        subscriptionId: decrypted.transaction_id ?? null,
        customerId: decrypted.payer?.openid ?? null,
        providerStatus: decrypted.trade_state,
        currentPeriodStart: decrypted.trade_state === "SUCCESS" ? period.currentPeriodStart : null,
        currentPeriodEnd: decrypted.trade_state === "SUCCESS" ? period.currentPeriodEnd : null,
        fromCheckout: decrypted.trade_state === "SUCCESS",
      },
    });
  } catch (error) {
    await finalizePaymentWebhookCallbackEvent({
      eventId: callbackEvent.event.id,
      governanceStatus: "EXCEPTION",
      workspaceId: tenancy.workspaceId,
      summary: buildBillingWebhookExceptionSummary({
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
      }),
      failureReason: serverErrorMessage(error, "wechat-callback-processing-failed"),
      payload: {
        outTradeNo: decrypted.out_trade_no ?? null,
        transactionId: decrypted.transaction_id ?? null,
        tradeState: decrypted.trade_state,
        resolutionSource: tenancy.resolutionSource,
      },
    });

    return failureResponse(
      serverErrorMessage(error, "WeChat Pay notify processing failed"),
      500,
    );
  }

  await writeAuditLog({
    workspaceId: tenancy.workspaceId,
    actor: "WeChat Pay notify",
    actorType: ActorType.SYSTEM,
    actionType: tenancy.actionType,
    targetType: "Workspace",
    targetId: tenancy.workspaceId,
    summary: buildBillingWebhookGovernanceSummary({
      provider: PAYMENT_PROVIDER.WECHAT_PAY,
      actionType: tenancy.actionType,
      resolutionSource: tenancy.resolutionSource,
    }),
    payload: {
      provider: PAYMENT_PROVIDER.WECHAT_PAY,
      tradeState: decrypted.trade_state,
      outTradeNo: decrypted.out_trade_no ?? null,
      transactionId: decrypted.transaction_id ?? null,
      authoritativeSource: tenancy.authoritativeSource,
      hintSource: tenancy.hintSource,
      hintWorkspaceId: tenancy.hintWorkspaceId,
      resolutionSource: tenancy.resolutionSource,
    },
    sourcePage,
  });

  await finalizePaymentWebhookCallbackEvent({
    eventId: callbackEvent.event.id,
    governanceStatus: "RESOLVED",
    workspaceId: tenancy.workspaceId,
    actionType: tenancy.actionType,
    resolutionSource: tenancy.resolutionSource,
    authoritativeSource: tenancy.authoritativeSource,
    hintSource: tenancy.hintSource,
    hintWorkspaceId: tenancy.hintWorkspaceId,
    summary:
      callbackEvent.status === "retry"
        ? buildBillingWebhookDuplicateSummary({
            provider: PAYMENT_PROVIDER.WECHAT_PAY,
          })
        : buildBillingWebhookGovernanceSummary({
            provider: PAYMENT_PROVIDER.WECHAT_PAY,
            actionType: tenancy.actionType,
            resolutionSource: tenancy.resolutionSource,
          }),
    payload: {
      outTradeNo: decrypted.out_trade_no ?? null,
      transactionId: decrypted.transaction_id ?? null,
      tradeState: decrypted.trade_state,
      resolutionSource: tenancy.resolutionSource,
    },
  });

  return successResponse();
}
