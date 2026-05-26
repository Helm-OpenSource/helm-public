import type { PaymentProvider } from "@prisma/client";
import { addMonths } from "date-fns";
import { CheckoutMode } from "@/lib/billing/payment-providers";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

export const CHINA_PAYMENT_PERIOD_MONTHS = 1;

export type ChinaPaymentCheckoutInput = {
  provider: PaymentProvider;
  workspaceId: string;
  userId: string;
  organizationName: string;
  currentPlan: string;
  locale: string;
  accessState: string;
  activeSeatCount: number;
  includedAdminSeats: number;
  additionalBillableSeats: number;
  baseFeeCents: number;
  activeSeatPriceCents: number;
  clientIp?: string | null;
  userAgent?: string | null;
};

export type ChinaPaymentCheckoutResult = {
  provider: PaymentProvider;
  checkoutMode: CheckoutMode;
  checkoutSessionId: string;
  url: string;
};

export type ChinaPaymentStatusSnapshot = {
  provider: PaymentProvider;
  checkoutSessionId: string;
  providerStatus: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
};

function sanitizeWorkspaceToken(workspaceId: string) {
  return workspaceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18) || "helm";
}

export function buildChinaPaymentOrderId(
  provider: PaymentProvider,
  workspaceId: string,
  now = new Date(),
) {
  const prefix = provider === PAYMENT_PROVIDER.ALIPAY ? "ali" : "wx";
  const timestamp = now
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const workspaceToken = sanitizeWorkspaceToken(workspaceId);

  return `helm_${prefix}_${workspaceToken}_${timestamp}`;
}

export function getChinaBillingPeriodWindow(now = new Date()) {
  const start = now;
  const end = addMonths(now, CHINA_PAYMENT_PERIOD_MONTHS);
  return { start, end };
}

export function getChinaBillingPeriodUnix(now = new Date()) {
  const { start, end } = getChinaBillingPeriodWindow(now);
  return {
    currentPeriodStart: Math.floor(start.getTime() / 1000),
    currentPeriodEnd: Math.floor(end.getTime() / 1000),
  };
}

export function getWorkspaceOrderAmountCents(input: {
  baseFeeCents: number;
  activeSeatPriceCents: number;
  additionalBillableSeats: number;
}) {
  return input.baseFeeCents + input.activeSeatPriceCents * input.additionalBillableSeats;
}

export function getWorkspaceOrderDescription(input: {
  organizationName: string;
  additionalBillableSeats: number;
  locale: string;
}) {
  const english = input.locale === "en-US";
  return english
    ? `${input.organizationName} is purchasing Helm Team. Current seat posture is 1 included admin + ${input.additionalBillableSeats} additional active seats.`
    : `${input.organizationName} 正在购买 Helm Team。当前 seat 结构为 1 个 included admin + ${input.additionalBillableSeats} 个额外 active seat。`;
}

export function getChinaPaymentReturnUrl(input: {
  provider: PaymentProvider;
  status: "checkout-returned" | "checkout-canceled";
}) {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error("APP_URL is required for China payment rail");
  }

  const url = new URL("/settings", appUrl);
  url.searchParams.set("tab", "billing");
  url.searchParams.set(
    "billingStatus",
    input.status === "checkout-canceled"
      ? input.provider === PAYMENT_PROVIDER.ALIPAY
        ? "alipay-checkout-canceled"
        : "wechat-pay-checkout-canceled"
      : input.provider === PAYMENT_PROVIDER.ALIPAY
        ? "alipay-checkout-returned"
        : "wechat-pay-checkout-returned",
  );
  return url.toString();
}

export function getChinaPaymentNotifyUrl(provider: PaymentProvider) {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error("APP_URL is required for China payment rail");
  }

  const pathname =
    provider === PAYMENT_PROVIDER.ALIPAY
      ? "/api/billing/alipay/notify"
      : "/api/billing/wechat-pay/notify";

  return new URL(pathname, appUrl).toString();
}

export function resolveWeChatCheckoutMode(input: {
  clientIp?: string | null;
  userAgent?: string | null;
}): CheckoutMode {
  const userAgent = String(input.userAgent ?? "").toLowerCase();
  const hasClientIp = Boolean(String(input.clientIp ?? "").trim());
  const looksLikeMobile =
    /iphone|ipad|android|mobile|micromessenger/.test(userAgent);

  if (hasClientIp && looksLikeMobile) {
    return "WECHAT_NATIVE_OR_H5";
  }

  return "WECHAT_NATIVE_OR_H5";
}
