import type { AccessState, PaymentProvider } from "@prisma/client";
import { addDays, addMonths, fromUnixTime } from "date-fns";
import { ACCESS_STATE, PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

export type StripeProviderStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | null;

export type AlipayProviderStatus =
  | "WAIT_BUYER_PAY"
  | "TRADE_SUCCESS"
  | "TRADE_FINISHED"
  | "TRADE_CLOSED"
  | null;

export type WeChatPayProviderStatus =
  | "NOTPAY"
  | "USERPAYING"
  | "SUCCESS"
  | "CLOSED"
  | "REVOKED"
  | "PAYERROR"
  | null;

export type PaymentLifecycleResolution = {
  nextTrialStateStatus: AccessState;
  nextBillingStatus: AccessState;
  graceEndsAt: Date | null;
  billingPeriodStartsAt: Date | null;
  billingPeriodEndsAt: Date | null;
  shouldRecordCheckoutCompletion: boolean;
};

function buildResolution(input: {
  nextState: AccessState;
  billingPeriodStartsAt: Date | null;
  billingPeriodEndsAt: Date | null;
  graceEndsAt: Date | null;
  fromCheckout?: boolean;
}) : PaymentLifecycleResolution {
  return {
    nextTrialStateStatus: input.nextState,
    nextBillingStatus: input.nextState,
    graceEndsAt: input.graceEndsAt,
    billingPeriodStartsAt: input.billingPeriodStartsAt,
    billingPeriodEndsAt: input.billingPeriodEndsAt,
    shouldRecordCheckoutCompletion: Boolean(
      input.fromCheckout && input.nextState === ACCESS_STATE.ACTIVE,
    ),
  };
}

export function isActiveLikeProviderStatus(status: string | null | undefined) {
  return new Set([
    "active",
    "trialing",
    "TRADE_SUCCESS",
    "TRADE_FINISHED",
    "SUCCESS",
  ]).has(String(status ?? ""));
}

export function mapPaymentLifecycle(input: {
  provider: PaymentProvider;
  providerStatus: string | null | undefined;
  currentAccessState?: AccessState;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  now?: Date;
  graceDays?: number;
  fromCheckout?: boolean;
}) : PaymentLifecycleResolution {
  const now = input.now ?? new Date();
  const graceDays = input.graceDays ?? 7;
  const fallbackPeriodStart = now;
  const fallbackPeriodEnd = addMonths(now, 1);
  const billingPeriodStartsAt =
    typeof input.currentPeriodStart === "number" ? fromUnixTime(input.currentPeriodStart) : null;
  const billingPeriodEndsAt =
    typeof input.currentPeriodEnd === "number" ? fromUnixTime(input.currentPeriodEnd) : null;
  const computedGraceEndsAt =
    billingPeriodEndsAt && billingPeriodEndsAt > now ? billingPeriodEndsAt : addDays(now, graceDays);
  const activeGraceEndsAt =
    billingPeriodEndsAt && billingPeriodEndsAt > now
      ? addDays(billingPeriodEndsAt, graceDays)
      : addDays(fallbackPeriodEnd, graceDays);
  const preservedCurrentState =
    input.currentAccessState ?? ACCESS_STATE.GRACE;

  switch (input.provider) {
    case PAYMENT_PROVIDER.ALIPAY: {
      const status = input.providerStatus as AlipayProviderStatus;
      switch (status) {
        case "TRADE_SUCCESS":
        case "TRADE_FINISHED":
          return buildResolution({
            nextState: ACCESS_STATE.ACTIVE,
            billingPeriodStartsAt: billingPeriodStartsAt ?? fallbackPeriodStart,
            billingPeriodEndsAt: billingPeriodEndsAt ?? fallbackPeriodEnd,
            graceEndsAt: activeGraceEndsAt,
            fromCheckout: input.fromCheckout,
          });
        case "TRADE_CLOSED":
          return buildResolution({
            nextState: preservedCurrentState,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: computedGraceEndsAt,
          });
        case "WAIT_BUYER_PAY":
        default:
          return buildResolution({
            nextState: preservedCurrentState,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: computedGraceEndsAt,
          });
      }
    }
    case PAYMENT_PROVIDER.WECHAT_PAY: {
      const status = input.providerStatus as WeChatPayProviderStatus;
      switch (status) {
        case "SUCCESS":
          return buildResolution({
            nextState: ACCESS_STATE.ACTIVE,
            billingPeriodStartsAt: billingPeriodStartsAt ?? fallbackPeriodStart,
            billingPeriodEndsAt: billingPeriodEndsAt ?? fallbackPeriodEnd,
            graceEndsAt: activeGraceEndsAt,
            fromCheckout: input.fromCheckout,
          });
        case "CLOSED":
        case "REVOKED":
        case "PAYERROR":
          return buildResolution({
            nextState: preservedCurrentState,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: computedGraceEndsAt,
          });
        case "NOTPAY":
        case "USERPAYING":
        default:
          return buildResolution({
            nextState: preservedCurrentState,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: computedGraceEndsAt,
          });
      }
    }
    case PAYMENT_PROVIDER.STRIPE:
    default: {
      const status = input.providerStatus as StripeProviderStatus;
      switch (status) {
        case "active":
        case "trialing":
          return buildResolution({
            nextState: ACCESS_STATE.ACTIVE,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: activeGraceEndsAt,
            fromCheckout: input.fromCheckout,
          });
        case "canceled":
          return buildResolution({
            nextState: ACCESS_STATE.CANCELED,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: computedGraceEndsAt,
          });
        case "past_due":
        case "unpaid":
        case "incomplete":
        case "incomplete_expired":
        case "paused":
        default:
          return buildResolution({
            nextState: ACCESS_STATE.GRACE,
            billingPeriodStartsAt,
            billingPeriodEndsAt,
            graceEndsAt: computedGraceEndsAt,
          });
      }
    }
  }
}
