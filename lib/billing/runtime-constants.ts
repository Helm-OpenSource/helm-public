import type { AccessState, PaymentProvider } from "@prisma/client";

export const ACCESS_STATE = {
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  GRACE: "GRACE",
  READ_ONLY: "READ_ONLY",
  CANCELED: "CANCELED",
} as const satisfies Record<string, AccessState>;

export const PAYMENT_PROVIDER = {
  STRIPE: "STRIPE",
  ALIPAY: "ALIPAY",
  WECHAT_PAY: "WECHAT_PAY",
} as const satisfies Record<string, PaymentProvider>;
