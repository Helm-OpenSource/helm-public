import type { AccessState } from "@prisma/client";
import { BillingPortalMode, getPaymentProviderLabel, getPaymentSubscriptionLabel } from "@/lib/billing/payment-providers";
import { isActiveLikeProviderStatus } from "@/lib/billing/payment-lifecycle-mapping";
import { ACCESS_STATE } from "@/lib/billing/runtime-constants";

export function getAdditionalBillableSeatCount(activeSeatCount: number, includedAdminSeats: number) {
  return Math.max(activeSeatCount - includedAdminSeats, 0);
}

export function canStartCheckout(input: {
  accessState: AccessState;
  paymentSubscriptionStatus: string | null;
}) {
  if (
    input.accessState === ACCESS_STATE.ACTIVE &&
    isActiveLikeProviderStatus(input.paymentSubscriptionStatus)
  ) {
    return false;
  }

  return true;
}

export function canOpenBillingPortal(input: {
  paymentCustomerId: string | null | undefined;
  paymentProviderConfigured: boolean;
  billingPortalMode?: BillingPortalMode | null;
}) {
  return Boolean(
    input.paymentProviderConfigured &&
      input.paymentCustomerId &&
      (!input.billingPortalMode || input.billingPortalMode === "STRIPE_PORTAL"),
  );
}

export { getPaymentProviderLabel, getPaymentSubscriptionLabel };
