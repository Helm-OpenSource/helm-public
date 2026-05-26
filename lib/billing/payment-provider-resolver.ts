import type { PaymentProvider } from "@prisma/client";
import {
  BillingPortalMode,
  CheckoutMode,
  PaymentCallbackMode,
  getPaymentProviderModel,
  PaymentIntegrationStage,
  PaymentLifecycleMappingMode,
  PaymentLifecycleSource,
  PaymentRegion,
} from "@/lib/billing/payment-providers";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";
import {
  isAlipayCheckoutConfigured,
  isAlipayLifecycleConfigured,
} from "@/lib/billing/alipay";
import {
  getStripeConfig,
  isStripeBillingPortalConfigured,
  isStripeCheckoutConfigured,
} from "@/lib/billing/stripe";
import {
  isWeChatPayCheckoutConfigured,
  isWeChatPayLifecycleConfigured,
} from "@/lib/billing/wechat-pay";

export type PaymentRailResolution = {
  provider: PaymentProvider;
  region: PaymentRegion;
  checkoutMode: CheckoutMode;
  billingPortalMode: BillingPortalMode;
  callbackMode: PaymentCallbackMode;
  lifecycleMappingMode: PaymentLifecycleMappingMode;
  lifecycleSource: PaymentLifecycleSource;
  integrationStage: PaymentIntegrationStage;
  checkoutConfigured: boolean;
  portalConfigured: boolean;
  lifecycleSourceConnected: boolean;
  availableProviders: PaymentProvider[];
};

function isEnglishLocale(locale: string | null | undefined) {
  return String(locale ?? "").toLowerCase().startsWith("en");
}

export function resolvePaymentRegion(defaultLocale: string | null | undefined): PaymentRegion {
  return isEnglishLocale(defaultLocale) ? "GLOBAL" : "CN";
}

export function getDefaultPaymentProvider(defaultLocale: string | null | undefined) {
  return resolvePaymentRegion(defaultLocale) === "GLOBAL"
    ? PAYMENT_PROVIDER.STRIPE
    : PAYMENT_PROVIDER.ALIPAY;
}

export function getAvailablePaymentProviders(region: PaymentRegion) {
  return region === "GLOBAL"
    ? [PAYMENT_PROVIDER.STRIPE]
    : [PAYMENT_PROVIDER.ALIPAY, PAYMENT_PROVIDER.WECHAT_PAY];
}

export function resolveWorkspacePaymentRail(input: {
  defaultLocale?: string | null;
  paymentProvider?: PaymentProvider | null;
  paymentCustomerId?: string | null;
  paymentSubscriptionId?: string | null;
  paymentSubscriptionStatus?: string | null;
}) : PaymentRailResolution {
  const region = resolvePaymentRegion(input.defaultLocale);
  const hasLiveProviderLink = Boolean(
    input.paymentCustomerId || input.paymentSubscriptionId || input.paymentSubscriptionStatus,
  );

  let provider = input.paymentProvider ?? getDefaultPaymentProvider(input.defaultLocale);

  if (
    region === "CN" &&
    provider === PAYMENT_PROVIDER.STRIPE &&
    !hasLiveProviderLink
  ) {
    provider = getDefaultPaymentProvider(input.defaultLocale);
  }

  const model = getPaymentProviderModel(provider);
  const stripeConfig = getStripeConfig();

  let checkoutMode: CheckoutMode = model.defaultCheckoutMode;
  let billingPortalMode: BillingPortalMode = model.billingPortalMode;
  let callbackMode: PaymentCallbackMode = model.callbackMode;
  let lifecycleMappingMode: PaymentLifecycleMappingMode = model.lifecycleMappingMode;
  let integrationStage: PaymentIntegrationStage = "FOUNDATION_ONLY";
  let checkoutConfigured = false;
  let portalConfigured = false;
  let lifecycleSourceConnected = false;

  switch (provider) {
    case PAYMENT_PROVIDER.STRIPE:
      checkoutMode = "STRIPE_HOSTED_CHECKOUT";
      billingPortalMode = "STRIPE_PORTAL";
      checkoutConfigured = isStripeCheckoutConfigured();
      portalConfigured = isStripeBillingPortalConfigured();
      lifecycleSourceConnected = Boolean(stripeConfig.webhookSecret && stripeConfig.secretKey);
      integrationStage = checkoutConfigured && lifecycleSourceConnected ? "LIVE" : "FOUNDATION_ONLY";
      break;
    case PAYMENT_PROVIDER.ALIPAY:
      checkoutMode = "ALIPAY_REDIRECT_OR_HOSTED";
      billingPortalMode = "NONE_YET";
      callbackMode = "ALIPAY_NOTIFY";
      lifecycleMappingMode = "CHINA_PAYMENT_PERIOD_LIFECYCLE";
      checkoutConfigured = isAlipayCheckoutConfigured();
      portalConfigured = false;
      lifecycleSourceConnected = isAlipayLifecycleConfigured();
      integrationStage = checkoutConfigured && lifecycleSourceConnected ? "LIVE" : "FOUNDATION_ONLY";
      break;
    case PAYMENT_PROVIDER.WECHAT_PAY:
      checkoutMode = "WECHAT_NATIVE_OR_H5";
      billingPortalMode = "NONE_YET";
      callbackMode = "WECHAT_PAY_NOTIFY";
      lifecycleMappingMode = "CHINA_PAYMENT_PERIOD_LIFECYCLE";
      checkoutConfigured = isWeChatPayCheckoutConfigured();
      portalConfigured = false;
      lifecycleSourceConnected = isWeChatPayLifecycleConfigured();
      integrationStage = checkoutConfigured && lifecycleSourceConnected ? "LIVE" : "FOUNDATION_ONLY";
      break;
  }

  return {
    provider,
    region,
    checkoutMode,
    billingPortalMode,
    callbackMode,
    lifecycleMappingMode,
    lifecycleSource: model.lifecycleSource,
    integrationStage,
    checkoutConfigured,
    portalConfigured,
    lifecycleSourceConnected,
    availableProviders: getAvailablePaymentProviders(region),
  };
}
