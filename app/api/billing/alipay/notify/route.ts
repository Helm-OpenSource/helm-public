import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { PAYMENT_WEBHOOK_CALLBACK_MODE } from "@/lib/auth/payment-webhook-callback-types";
import {
  buildBillingWebhookDuplicateSummary,
  buildBillingWebhookExceptionSummary,
  extractAlipayNotifyWorkspaceHint,
  buildBillingWebhookGovernanceSummary,
  buildBillingWebhookUnresolvedSummary,
  buildBillingWebhookVerificationFailureSummary,
  buildPaymentWebhookCallbackFingerprint,
  resolveAlipayNotifyTenancy,
} from "@/lib/auth/payment-webhook-governance";
import {
  beginPaymentWebhookCallbackEvent,
  finalizePaymentWebhookCallbackEvent,
  recordPaymentWebhookVerificationFailure,
} from "@/lib/auth/payment-webhook-callback-store";
import { getChinaBillingPeriodUnix } from "@/lib/billing/china-payment";
import { syncWorkspacePaymentStatusFromCallbackEvent } from "@/lib/billing/integration";
import { verifyAlipayNotifyPayload } from "@/lib/billing/alipay";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sourcePage = "/api/billing/alipay/notify";

  let payload: Record<string, string>;

  try {
    payload = verifyAlipayNotifyPayload({ rawBody });
  } catch (error) {
    const hintedWorkspace = extractAlipayNotifyWorkspaceHint(rawBody);

    await recordPaymentWebhookVerificationFailure({
      provider: PAYMENT_PROVIDER.ALIPAY,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.ALIPAY_NOTIFY,
      callbackFingerprint: buildPaymentWebhookCallbackFingerprint({
        provider: PAYMENT_PROVIDER.ALIPAY,
        rawBody,
      }),
      sourcePage,
      summary: buildBillingWebhookVerificationFailureSummary({
        provider: PAYMENT_PROVIDER.ALIPAY,
      }),
      failureReason: "alipay-notify-verification-failed",
      hintSource: hintedWorkspace.hintSource,
      hintWorkspaceId: hintedWorkspace.workspaceId,
      payload: {
        error: error instanceof Error ? error.message : "Alipay notify verification failed",
      },
    });

    return new Response(
      error instanceof Error ? error.message : "Alipay notify verification failed",
      { status: 400 },
    );
  }

  const outTradeNo = payload.out_trade_no ?? null;
  const tradeNo = payload.trade_no ?? null;
  const tradeStatus = payload.trade_status ?? null;
  const callbackEvent = await beginPaymentWebhookCallbackEvent({
    provider: PAYMENT_PROVIDER.ALIPAY,
    callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.ALIPAY_NOTIFY,
    callbackFingerprint: buildPaymentWebhookCallbackFingerprint({
      provider: PAYMENT_PROVIDER.ALIPAY,
      fingerprintParts: [outTradeNo, tradeNo, tradeStatus],
      rawBody,
    }),
    externalEventId: tradeNo,
    sourcePage,
    summary: `Received Alipay notify ${tradeStatus ?? "unknown-status"}`,
    payload: {
      outTradeNo,
      tradeNo,
      tradeStatus,
    },
  });

  if (callbackEvent.status === "duplicate") {
    return new Response("success");
  }

  const tenancy = await resolveAlipayNotifyTenancy({
    workspaceIdHint: payload.passback_params ?? null,
    outTradeNo,
    tradeNo,
  });

  if (!tenancy.resolved || !tradeStatus) {
    await finalizePaymentWebhookCallbackEvent({
      eventId: callbackEvent.event.id,
      governanceStatus: "UNRESOLVED",
      summary: buildBillingWebhookUnresolvedSummary({
        provider: PAYMENT_PROVIDER.ALIPAY,
        reason: !tenancy.resolved ? tenancy.reason : "workspace-unresolved",
      }),
      failureReason: !tenancy.resolved ? tenancy.reason : "provider-status-missing",
      payload: {
        outTradeNo,
        tradeNo,
        tradeStatus,
      },
    });

    return new Response("success");
  }

  const paidAt = payload.send_pay_date ? new Date(payload.send_pay_date) : new Date();
  const period = getChinaBillingPeriodUnix(paidAt);

  try {
    await syncWorkspacePaymentStatusFromCallbackEvent({
      workspaceId: tenancy.workspaceId,
      event: {
        provider: PAYMENT_PROVIDER.ALIPAY,
        eventType:
          tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED"
            ? "PAYMENT_SUCCEEDED"
            : tradeStatus === "TRADE_CLOSED"
              ? "PAYMENT_CLOSED"
              : "PAYMENT_EXPIRED",
        checkoutSessionId: outTradeNo,
        subscriptionId: tradeNo,
        customerId: payload.buyer_user_id ?? null,
        providerStatus: tradeStatus,
        currentPeriodStart:
          tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED"
            ? period.currentPeriodStart
            : null,
        currentPeriodEnd:
          tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED"
            ? period.currentPeriodEnd
            : null,
        fromCheckout: tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED",
      },
    });
  } catch (error) {
    await finalizePaymentWebhookCallbackEvent({
      eventId: callbackEvent.event.id,
      governanceStatus: "EXCEPTION",
      workspaceId: tenancy.workspaceId,
      summary: buildBillingWebhookExceptionSummary({
        provider: PAYMENT_PROVIDER.ALIPAY,
      }),
      failureReason: error instanceof Error ? error.message : "alipay-callback-processing-failed",
      payload: {
        outTradeNo,
        tradeNo,
        tradeStatus,
        resolutionSource: tenancy.resolutionSource,
      },
    });

    return new Response(
      error instanceof Error ? error.message : "Alipay notify processing failed",
      { status: 500 },
    );
  }

  await writeAuditLog({
    workspaceId: tenancy.workspaceId,
    actor: "Alipay notify",
    actorType: ActorType.SYSTEM,
    actionType: tenancy.actionType,
    targetType: "Workspace",
    targetId: tenancy.workspaceId,
    summary: buildBillingWebhookGovernanceSummary({
      provider: PAYMENT_PROVIDER.ALIPAY,
      actionType: tenancy.actionType,
      resolutionSource: tenancy.resolutionSource,
    }),
    payload: {
      provider: PAYMENT_PROVIDER.ALIPAY,
      tradeStatus,
      outTradeNo,
      tradeNo,
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
            provider: PAYMENT_PROVIDER.ALIPAY,
          })
        : buildBillingWebhookGovernanceSummary({
            provider: PAYMENT_PROVIDER.ALIPAY,
            actionType: tenancy.actionType,
            resolutionSource: tenancy.resolutionSource,
          }),
    payload: {
      outTradeNo,
      tradeNo,
      tradeStatus,
      resolutionSource: tenancy.resolutionSource,
    },
  });

  return new Response("success");
}
