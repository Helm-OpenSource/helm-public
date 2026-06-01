import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type StripeConfig = {
  secretKey: string | null;
  webhookSecret: string | null;
  helmTeamPriceId: string | null;
  activeSeatPriceId: string | null;
  billingPortalConfigurationId: string | null;
  appUrl: string | null;
};

export type StripeCheckoutSessionResponse = {
  id: string;
  url: string | null;
  customer: string | null;
  subscription: string | null;
  status?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string>;
};

export type StripePortalSessionResponse = {
  id: string;
  url: string;
};

export type StripeSubscriptionResponse = {
  id: string;
  customer: string;
  status: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

type StripeListResponse<T> = {
  data: T[];
};

function getRequiredEnv(name: keyof StripeConfig, config: StripeConfig) {
  return config[name];
}

export function getStripeConfig(): StripeConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    helmTeamPriceId: process.env.STRIPE_HELM_TEAM_PRICE_ID?.trim() || null,
    activeSeatPriceId: process.env.STRIPE_HELM_ACTIVE_SEAT_PRICE_ID?.trim() || null,
    billingPortalConfigurationId: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim() || null,
    appUrl: process.env.APP_URL?.trim() || null,
  };
}

export function isStripeBillingConfigured() {
  return isStripeCheckoutConfigured();
}

export function isStripeCheckoutConfigured() {
  const config = getStripeConfig();
  return Boolean(config.secretKey && config.helmTeamPriceId && config.activeSeatPriceId && config.appUrl);
}

export function isStripeBillingPortalConfigured() {
  const config = getStripeConfig();
  return Boolean(config.secretKey && config.appUrl);
}

function buildStripeHeaders(secretKey: string) {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function stripeRequest<T>(path: string, init: {
  method?: "GET" | "POST";
  params?: URLSearchParams;
}) {
  const config = getStripeConfig();
  const secretKey = getRequiredEnv("secretKey", config);

  if (!secretKey) {
    throw new Error("Stripe payment is not configured");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method ?? "POST",
    headers: buildStripeHeaders(secretKey),
    body: init.params,
    cache: "no-store",
  });

  const json = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof json.error === "object" &&
      json.error &&
      "message" in json.error &&
      typeof json.error.message === "string"
        ? json.error.message
        : "Stripe request failed";
    throw new Error(message);
  }

  return json as T;
}

export function getStripeReturnUrl(pathname: string, query?: Record<string, string>) {
  const config = getStripeConfig();

  if (!config.appUrl) {
    throw new Error("APP_URL is required for Stripe billing");
  }

  const url = new URL(pathname, config.appUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export async function createStripeCustomer(input: {
  workspaceId: string;
  organizationName: string;
  email: string;
  locale: string;
}) {
  const params = new URLSearchParams();
  params.set("name", input.organizationName);
  params.set("email", input.email);
  params.set("metadata[workspaceId]", input.workspaceId);
  params.set("metadata[source]", "helm_settings");
  params.set("preferred_locales[0]", input.locale === "en-US" ? "en" : "zh");

  const customer = await stripeRequest<{ id: string }>("/customers", { params });
  return customer.id;
}

export async function createStripeCheckoutSession(input: {
  workspaceId: string;
  userId: string;
  organizationName: string;
  email: string;
  locale: string;
  accessState: string;
  customerId?: string | null;
  activeSeatCount: number;
  includedAdminSeats: number;
}) {
  const config = getStripeConfig();

  if (!config.helmTeamPriceId || !config.activeSeatPriceId) {
    throw new Error("Stripe price ids are not fully configured");
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", getStripeReturnUrl("/settings", { tab: "billing", billingStatus: "checkout-completed" }));
  params.set("cancel_url", getStripeReturnUrl("/settings", { tab: "billing", billingStatus: "checkout-canceled" }));
  if (input.customerId) {
    params.set("customer", input.customerId);
  } else {
    params.set("customer_email", input.email);
  }
  params.set("client_reference_id", input.workspaceId);
  params.set("metadata[workspaceId]", input.workspaceId);
  params.set("metadata[userId]", input.userId);
  params.set("metadata[source]", "helm_settings");
  params.set("metadata[organizationName]", input.organizationName);
  params.set("subscription_data[metadata][workspaceId]", input.workspaceId);
  params.set("subscription_data[metadata][userId]", input.userId);
  params.set("subscription_data[metadata][accessStateAtCheckout]", input.accessState);
  params.set("line_items[0][price]", config.helmTeamPriceId);
  params.set("line_items[0][quantity]", "1");

  const billableSeats = Math.max(input.activeSeatCount - input.includedAdminSeats, 0);
  if (billableSeats > 0) {
    params.set("line_items[1][price]", config.activeSeatPriceId);
    params.set("line_items[1][quantity]", String(billableSeats));
  }

  params.set(
    "custom_text[submit][message]",
    input.locale === "en-US"
      ? `${input.organizationName} is purchasing Helm Team. Seat posture follows 1 included admin + ${billableSeats} additional active seats.`
      : `${input.organizationName} 正在购买 Helm Team。当前 seat 结构按 1 个 included admin + ${billableSeats} 个额外 active seat 结算。`,
  );

  return stripeRequest<StripeCheckoutSessionResponse>("/checkout/sessions", { params });
}

export async function createStripeBillingPortalSession(input: {
  customerId: string;
}) {
  const config = getStripeConfig();
  const params = new URLSearchParams();
  params.set("customer", input.customerId);
  params.set("return_url", getStripeReturnUrl("/settings", { tab: "billing", billingStatus: "portal-returned" }));

  if (config.billingPortalConfigurationId) {
    params.set("configuration", config.billingPortalConfigurationId);
  }

  return stripeRequest<StripePortalSessionResponse>("/billing_portal/sessions", { params });
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscriptionResponse>(`/subscriptions/${subscriptionId}`, {
    method: "GET",
  });
}

export async function listStripeSubscriptionsByCustomer(customerId: string) {
  return stripeRequest<StripeListResponse<StripeSubscriptionResponse>>(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=5`,
    { method: "GET" },
  );
}

function parseStripeSignature(signature: string) {
  const segments = signature.split(",");
  const timestamps = segments.filter((segment) => segment.startsWith("t=")).map((segment) => segment.slice(2));
  const v1Values = segments.filter((segment) => segment.startsWith("v1=")).map((segment) => segment.slice(3));

  return {
    timestamp: timestamps[0] ?? null,
    signatures: v1Values,
  };
}

export function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string | null;
  toleranceSeconds?: number;
}) {
  const config = getStripeConfig();
  const secret = config.webhookSecret;

  if (!secret) {
    throw new Error("Stripe webhook secret is not configured");
  }

  if (!input.signatureHeader) {
    throw new Error("Missing Stripe signature header");
  }

  const parsed = parseStripeSignature(input.signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error("Invalid Stripe signature header");
  }

  const signedPayload = `${parsed.timestamp}.${input.payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const timestamp = Number(parsed.timestamp);

  if (!Number.isFinite(timestamp)) {
    throw new Error("Invalid Stripe signature timestamp");
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new Error("Stripe webhook timestamp is outside the accepted tolerance");
  }

  const matches = parsed.signatures.some((value) => {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(value);
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  });

  if (!matches) {
    throw new Error("Stripe webhook signature verification failed");
  }
}
