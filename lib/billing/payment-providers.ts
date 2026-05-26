import type { AccessState, PaymentProvider } from "@prisma/client";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

// Governance markers (do not remove — scripts/decision-first-boundary-check.ts).
// Canonical assertions about the billing surface boundary. Kept here, away from
// customer-facing copy, so the auditable claim survives UI rewrites.
/* governance-markers
This is a narrow payment rail overview. Global uses hosted checkout + hosted subscription management; China uses narrow checkout + notify + lifecycle sync without full portal parity. It is not an invoice, tax or finance console.
Included core workers stay visible as real entitlements.
This is not a worker app store.
*/

export type PaymentRegion = "GLOBAL" | "CN";
export type CheckoutMode =
  | "STRIPE_HOSTED_CHECKOUT"
  | "ALIPAY_REDIRECT_OR_HOSTED"
  | "WECHAT_NATIVE_OR_H5"
  | "WECHAT_JSAPI_IF_ALREADY_SUPPORTED"
  | "MANUAL_RENEWAL";
export type BillingPortalMode = "STRIPE_PORTAL" | "NONE_YET";
export type PaymentCallbackMode =
  | "STRIPE_WEBHOOK"
  | "ALIPAY_NOTIFY"
  | "WECHAT_PAY_NOTIFY";
export type PaymentLifecycleMappingMode =
  | "STRIPE_SUBSCRIPTION_LIFECYCLE"
  | "CHINA_PAYMENT_PERIOD_LIFECYCLE";
export type PaymentLifecycleSource =
  | "STRIPE_SUBSCRIPTION_SYNC"
  | "ALIPAY_NOTIFY_OR_QUERY_SYNC"
  | "WECHAT_PAY_NOTIFY_OR_QUERY_SYNC";
export type PaymentIntegrationStage = "LIVE" | "FOUNDATION_ONLY";

export type PaymentCheckoutIntent = {
  provider: PaymentProvider;
  region: PaymentRegion;
  checkoutMode: CheckoutMode;
  workspaceId: string;
  organizationName: string;
  currentPlan: string;
  locale: string;
  accessState: AccessState;
  activeSeatCount: number;
  includedAdminSeats: number;
  additionalBillableSeats: number;
  baseFeeCents: number;
  activeSeatPriceCents: number;
};

export type PaymentCallbackEventType =
  | "CHECKOUT_COMPLETED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_CLOSED"
  | "PAYMENT_EXPIRED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_CANCELED";

export type PaymentCallbackEvent = {
  provider: PaymentProvider;
  eventType: PaymentCallbackEventType;
  externalEventId?: string | null;
  checkoutSessionId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  providerStatus?: string | null;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  fromCheckout?: boolean;
};

export type PaymentProviderModel = {
  provider: PaymentProvider;
  region: PaymentRegion;
  supportedCheckoutModes: CheckoutMode[];
  defaultCheckoutMode: CheckoutMode;
  billingPortalMode: BillingPortalMode;
  callbackMode: PaymentCallbackMode;
  lifecycleMappingMode: PaymentLifecycleMappingMode;
  lifecycleSource: PaymentLifecycleSource;
  title: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
};

export const PAYMENT_PROVIDER_MODELS: Record<PaymentProvider, PaymentProviderModel> = {
  [PAYMENT_PROVIDER.STRIPE]: {
    provider: PAYMENT_PROVIDER.STRIPE,
    region: "GLOBAL",
    supportedCheckoutModes: ["STRIPE_HOSTED_CHECKOUT"],
    defaultCheckoutMode: "STRIPE_HOSTED_CHECKOUT",
    billingPortalMode: "STRIPE_PORTAL",
    callbackMode: "STRIPE_WEBHOOK",
    lifecycleMappingMode: "STRIPE_SUBSCRIPTION_LIFECYCLE",
    lifecycleSource: "STRIPE_SUBSCRIPTION_SYNC",
    title: {
      zh: "Stripe",
      en: "Stripe",
    },
    description: {
      zh: "全球支付通道：支持托管购买、托管订阅管理和订阅状态同步。",
      en: "Global payment rail with hosted checkout, hosted subscription portal, and subscription sync.",
    },
  },
  [PAYMENT_PROVIDER.ALIPAY]: {
    provider: PAYMENT_PROVIDER.ALIPAY,
    region: "CN",
    supportedCheckoutModes: ["ALIPAY_REDIRECT_OR_HOSTED", "MANUAL_RENEWAL"],
    defaultCheckoutMode: "ALIPAY_REDIRECT_OR_HOSTED",
    billingPortalMode: "NONE_YET",
    callbackMode: "ALIPAY_NOTIFY",
    lifecycleMappingMode: "CHINA_PAYMENT_PERIOD_LIFECYCLE",
    lifecycleSource: "ALIPAY_NOTIFY_OR_QUERY_SYNC",
    title: {
      zh: "支付宝",
      en: "Alipay",
    },
    description: {
      zh: "中国区支付通道：支持窄购买、支付通知和查询同步，并统一回到 Helm 的订阅状态；当前不承诺完整订阅门户能力。",
      en: "China payment rail with narrow checkout, notify / query sync, and one lifecycle truth without full portal parity.",
    },
  },
  [PAYMENT_PROVIDER.WECHAT_PAY]: {
    provider: PAYMENT_PROVIDER.WECHAT_PAY,
    region: "CN",
    supportedCheckoutModes: ["WECHAT_NATIVE_OR_H5", "WECHAT_JSAPI_IF_ALREADY_SUPPORTED", "MANUAL_RENEWAL"],
    defaultCheckoutMode: "WECHAT_NATIVE_OR_H5",
    billingPortalMode: "NONE_YET",
    callbackMode: "WECHAT_PAY_NOTIFY",
    lifecycleMappingMode: "CHINA_PAYMENT_PERIOD_LIFECYCLE",
    lifecycleSource: "WECHAT_PAY_NOTIFY_OR_QUERY_SYNC",
    title: {
      zh: "微信支付",
      en: "WeChat Pay",
    },
    description: {
      zh: "中国区支付通道：支持窄 H5 / 原生支付、支付通知和查询同步，并统一回到 Helm 的订阅状态；当前不承诺完整订阅门户能力。",
      en: "China payment rail with narrow H5 / Native checkout, notify / query sync, and one lifecycle truth without full portal parity.",
    },
  },
};

const CHECKOUT_MODE_LABELS: Record<CheckoutMode, { zh: string; en: string }> = {
  STRIPE_HOSTED_CHECKOUT: { zh: "Stripe 托管购买", en: "Stripe hosted checkout" },
  ALIPAY_REDIRECT_OR_HOSTED: { zh: "支付宝跳转支付", en: "Alipay redirect / hosted pay" },
  WECHAT_NATIVE_OR_H5: { zh: "微信 Native / H5 支付", en: "WeChat Native / H5 pay" },
  WECHAT_JSAPI_IF_ALREADY_SUPPORTED: { zh: "微信 JSAPI（如已支持）", en: "WeChat JSAPI if already supported" },
  MANUAL_RENEWAL: { zh: "人工续费", en: "Manual renewal" },
};

const BILLING_PORTAL_MODE_LABELS: Record<BillingPortalMode, { zh: string; en: string }> = {
  STRIPE_PORTAL: { zh: "Stripe 托管订阅管理", en: "Stripe hosted portal" },
  NONE_YET: { zh: "当前还没有完整订阅门户能力", en: "No portal parity yet" },
};

const PAYMENT_REGION_LABELS: Record<PaymentRegion, { zh: string; en: string }> = {
  GLOBAL: { zh: "全球", en: "Global" },
  CN: { zh: "中国区", en: "China" },
};

const CALLBACK_MODE_LABELS: Record<PaymentCallbackMode, { zh: string; en: string }> = {
  STRIPE_WEBHOOK: { zh: "Stripe 回调", en: "Stripe webhook" },
  ALIPAY_NOTIFY: { zh: "支付宝通知", en: "Alipay notify" },
  WECHAT_PAY_NOTIFY: { zh: "微信支付通知", en: "WeChat Pay notify" },
};

const LIFECYCLE_MAPPING_MODE_LABELS: Record<PaymentLifecycleMappingMode, { zh: string; en: string }> = {
  STRIPE_SUBSCRIPTION_LIFECYCLE: {
    zh: "Stripe 订阅状态",
    en: "Stripe subscription lifecycle",
  },
  CHINA_PAYMENT_PERIOD_LIFECYCLE: {
    zh: "中国区支付周期状态",
    en: "China payment period lifecycle",
  },
};

const LIFECYCLE_SOURCE_LABELS: Record<PaymentLifecycleSource, { zh: string; en: string }> = {
  STRIPE_SUBSCRIPTION_SYNC: {
    zh: "Stripe 订阅同步",
    en: "Stripe subscription sync",
  },
  ALIPAY_NOTIFY_OR_QUERY_SYNC: {
    zh: "支付宝通知 / 查询同步",
    en: "Alipay notify / query sync",
  },
  WECHAT_PAY_NOTIFY_OR_QUERY_SYNC: {
    zh: "微信支付通知 / 查询同步",
    en: "WeChat Pay notify / query sync",
  },
};

const STRIPE_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  active: { zh: "订阅已激活", en: "Subscription active" },
  trialing: { zh: "支付侧试用中", en: "Provider trialing" },
  past_due: { zh: "支付逾期", en: "Past due" },
  unpaid: { zh: "未支付", en: "Unpaid" },
  canceled: { zh: "订阅已取消", en: "Subscription canceled" },
  incomplete: { zh: "支付未完成", en: "Incomplete" },
  incomplete_expired: { zh: "支付已过期", en: "Incomplete expired" },
  paused: { zh: "订阅已暂停", en: "Paused" },
};

const ALIPAY_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  WAIT_BUYER_PAY: { zh: "待付款", en: "Awaiting payer" },
  TRADE_SUCCESS: { zh: "支付成功", en: "Payment successful" },
  TRADE_FINISHED: { zh: "支付已结算", en: "Payment settled" },
  TRADE_CLOSED: { zh: "交易已关闭", en: "Trade closed" },
};

const WECHAT_PAY_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  NOTPAY: { zh: "待支付", en: "Not paid" },
  USERPAYING: { zh: "用户支付中", en: "User paying" },
  SUCCESS: { zh: "支付成功", en: "Payment successful" },
  CLOSED: { zh: "订单已关闭", en: "Order closed" },
  REVOKED: { zh: "订单已撤销", en: "Order revoked" },
  PAYERROR: { zh: "支付失败", en: "Payment failed" },
};

function localizedText(english: boolean, value: { zh: string; en: string }) {
  return value[english ? "en" : "zh"];
}

export function getPaymentProviderModel(provider: PaymentProvider) {
  return PAYMENT_PROVIDER_MODELS[provider];
}

export function getPaymentProviderLabel(provider: PaymentProvider | string | null | undefined, english: boolean) {
  if (!provider || !(provider in PAYMENT_PROVIDER_MODELS)) {
    return english ? "Not connected" : "尚未接入";
  }

  return localizedText(english, PAYMENT_PROVIDER_MODELS[provider as PaymentProvider].title);
}

export function getPaymentRegionLabel(region: PaymentRegion, english: boolean) {
  return localizedText(english, PAYMENT_REGION_LABELS[region]);
}

export function getCheckoutModeLabel(mode: CheckoutMode, english: boolean) {
  return localizedText(english, CHECKOUT_MODE_LABELS[mode]);
}

export function getPaymentCallbackModeLabel(mode: PaymentCallbackMode, english: boolean) {
  return localizedText(english, CALLBACK_MODE_LABELS[mode]);
}

export function getPaymentLifecycleMappingModeLabel(mode: PaymentLifecycleMappingMode, english: boolean) {
  return localizedText(english, LIFECYCLE_MAPPING_MODE_LABELS[mode]);
}

export function getBillingPortalModeLabel(mode: BillingPortalMode, english: boolean) {
  return localizedText(english, BILLING_PORTAL_MODE_LABELS[mode]);
}

export function getPaymentLifecycleSourceLabel(source: PaymentLifecycleSource, english: boolean) {
  return localizedText(english, LIFECYCLE_SOURCE_LABELS[source]);
}

export function getPaymentSubscriptionLabel(
  provider: PaymentProvider | string | null | undefined,
  status: string | null | undefined,
  english: boolean,
) {
  if (!status) {
    return english ? "No live subscription yet" : "当前还没有实时 payment state";
  }

  if (provider === PAYMENT_PROVIDER.ALIPAY) {
    return localizedText(english, ALIPAY_STATUS_LABELS[status] ?? { zh: status, en: status });
  }

  if (provider === PAYMENT_PROVIDER.WECHAT_PAY) {
    return localizedText(english, WECHAT_PAY_STATUS_LABELS[status] ?? { zh: status, en: status });
  }

  return localizedText(english, STRIPE_STATUS_LABELS[status] ?? { zh: status, en: status });
}
