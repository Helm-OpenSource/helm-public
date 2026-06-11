import { NextResponse } from "next/server";
import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { PAYMENT_WEBHOOK_CALLBACK_MODE } from "@/lib/auth/payment-webhook-callback-types";
import {
  buildBillingWebhookDuplicateSummary,
  buildBillingWebhookExceptionSummary,
  buildBillingWebhookGovernanceSummary,
  buildBillingWebhookUnresolvedSummary,
  buildBillingWebhookUnsupportedSummary,
  buildBillingWebhookVerificationFailureSummary,
  buildPaymentWebhookCallbackFingerprint,
  extractStripeWebhookWorkspaceHint,
  resolveStripeWebhookTenancy,
} from "@/lib/auth/payment-webhook-governance";
import {
  beginPaymentWebhookCallbackEvent,
  finalizePaymentWebhookCallbackEvent,
  recordPaymentWebhookVerificationFailure,
} from "@/lib/auth/payment-webhook-callback-store";
import { syncWorkspacePaymentStatusFromCallbackEvent } from "@/lib/billing/integration";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe";
import { serverErrorMessage } from "@/lib/http/server-error";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const sourcePage = "/api/billing/stripe/webhook";

  try {
    verifyStripeWebhookSignature({
      payload,
      signatureHeader: signature,
    });
  } catch (error) {
    const hintedWorkspace = extractStripeWebhookWorkspaceHint(payload);

    await recordPaymentWebhookVerificationFailure({
      provider: PAYMENT_PROVIDER.STRIPE,
      callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.STRIPE_WEBHOOK,
      callbackFingerprint: buildPaymentWebhookCallbackFingerprint({
        provider: PAYMENT_PROVIDER.STRIPE,
        rawBody: payload,
      }),
      sourcePage,
      summary: buildBillingWebhookVerificationFailureSummary({
        provider: PAYMENT_PROVIDER.STRIPE,
      }),
      failureReason: "stripe-signature-verification-failed",
      hintSource: hintedWorkspace.hintSource,
      hintWorkspaceId: hintedWorkspace.workspaceId,
      payload: {
        error: serverErrorMessage(error, "Webhook verification failed"),
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: serverErrorMessage(error, "Webhook verification failed"),
      },
      { status: 400 },
    );
  }

  const event = JSON.parse(payload) as StripeEvent;
  const object = event.data.object ?? {};
  const callbackEvent = await beginPaymentWebhookCallbackEvent({
    provider: PAYMENT_PROVIDER.STRIPE,
    callbackMode: PAYMENT_WEBHOOK_CALLBACK_MODE.STRIPE_WEBHOOK,
    callbackFingerprint: buildPaymentWebhookCallbackFingerprint({
      provider: PAYMENT_PROVIDER.STRIPE,
      externalEventId: event.id,
      rawBody: payload,
    }),
    externalEventId: event.id,
    sourcePage,
    summary: `Received Stripe callback ${event.type}`,
    payload: {
      eventType: event.type,
    },
  });

  if (callbackEvent.status === "duplicate") {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "duplicate-callback",
      type: event.type,
    });
  }

  const tenancy = await resolveStripeWebhookTenancy(object);

  if (!tenancy.resolved) {
    await finalizePaymentWebhookCallbackEvent({
      eventId: callbackEvent.event.id,
      governanceStatus: "UNRESOLVED",
      summary: buildBillingWebhookUnresolvedSummary({
        provider: PAYMENT_PROVIDER.STRIPE,
        reason: tenancy.reason,
      }),
      failureReason: tenancy.reason,
      payload: {
        eventType: event.type,
      },
    });

    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: tenancy.reason,
      type: event.type,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncWorkspacePaymentStatusFromCallbackEvent({
          workspaceId: tenancy.workspaceId,
          event: {
            provider: PAYMENT_PROVIDER.STRIPE,
            eventType: "CHECKOUT_COMPLETED",
            externalEventId: event.id,
            checkoutSessionId: getStringValue(object.id) ?? "",
            customerId: getStringValue(object.customer),
            subscriptionId: getStringValue(object.subscription),
            providerStatus: getStringValue(object.payment_status) ?? getStringValue(object.status),
            fromCheckout: true,
          },
        });
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncWorkspacePaymentStatusFromCallbackEvent({
          workspaceId: tenancy.workspaceId,
          event: {
            provider: PAYMENT_PROVIDER.STRIPE,
            eventType:
              event.type === "customer.subscription.deleted"
                ? "SUBSCRIPTION_CANCELED"
                : "SUBSCRIPTION_UPDATED",
            externalEventId: event.id,
            customerId: getStringValue(object.customer),
            subscriptionId: getStringValue(object.id),
            providerStatus: getStringValue(object.status),
            currentPeriodStart:
              typeof object.current_period_start === "number" ? object.current_period_start : null,
            currentPeriodEnd:
              typeof object.current_period_end === "number" ? object.current_period_end : null,
          },
        });
        break;
      default:
        await finalizePaymentWebhookCallbackEvent({
          eventId: callbackEvent.event.id,
          governanceStatus: "UNSUPPORTED",
          workspaceId: tenancy.workspaceId,
          summary: buildBillingWebhookUnsupportedSummary({
            provider: PAYMENT_PROVIDER.STRIPE,
          }),
          payload: {
            eventType: event.type,
            resolutionSource: tenancy.resolutionSource,
          },
        });

        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "event-not-supported",
          type: event.type,
        });
    }
  } catch (error) {
    await finalizePaymentWebhookCallbackEvent({
      eventId: callbackEvent.event.id,
      governanceStatus: "EXCEPTION",
      workspaceId: tenancy.workspaceId,
      summary: buildBillingWebhookExceptionSummary({
        provider: PAYMENT_PROVIDER.STRIPE,
      }),
      failureReason: serverErrorMessage(error, "stripe-callback-processing-failed"),
      payload: {
        eventType: event.type,
        resolutionSource: tenancy.resolutionSource,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: serverErrorMessage(error, "Stripe callback processing failed"),
      },
      { status: 500 },
    );
  }

  await writeAuditLog({
    workspaceId: tenancy.workspaceId,
    actor: "Stripe webhook",
    actorType: ActorType.SYSTEM,
    actionType: tenancy.actionType,
    targetType: "Workspace",
    targetId: tenancy.workspaceId,
    summary: buildBillingWebhookGovernanceSummary({
      provider: PAYMENT_PROVIDER.STRIPE,
      actionType: tenancy.actionType,
      resolutionSource: tenancy.resolutionSource,
    }),
    payload: {
      provider: PAYMENT_PROVIDER.STRIPE,
      externalEventId: event.id,
      eventType: event.type,
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
            provider: PAYMENT_PROVIDER.STRIPE,
          })
        : buildBillingWebhookGovernanceSummary({
            provider: PAYMENT_PROVIDER.STRIPE,
            actionType: tenancy.actionType,
            resolutionSource: tenancy.resolutionSource,
          }),
    payload: {
      eventType: event.type,
      resolutionSource: tenancy.resolutionSource,
    },
  });

  return NextResponse.json({
    ok: true,
    received: true,
    type: event.type,
  });
}
