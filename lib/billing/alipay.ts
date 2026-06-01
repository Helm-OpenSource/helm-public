import { createSign, createVerify } from "node:crypto";
import type { PaymentProvider } from "@prisma/client";
import {
  ChinaPaymentCheckoutInput,
  ChinaPaymentCheckoutResult,
  ChinaPaymentStatusSnapshot,
  buildChinaPaymentOrderId,
  getChinaBillingPeriodUnix,
  getChinaPaymentNotifyUrl,
  getChinaPaymentReturnUrl,
  getWorkspaceOrderAmountCents,
  getWorkspaceOrderDescription,
} from "@/lib/billing/china-payment";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

const ALIPAY_GATEWAY_DEFAULT = "https://openapi.alipay.com/gateway.do";

export type AlipayConfig = {
  appId: string | null;
  gatewayUrl: string;
  merchantPrivateKey: string | null;
  alipayPublicKey: string | null;
  appUrl: string | null;
};

type AlipayTradeQueryResponse = {
  alipay_trade_query_response?: {
    code?: string;
    msg?: string;
    out_trade_no?: string;
    trade_no?: string;
    buyer_user_id?: string;
    trade_status?: string;
    send_pay_date?: string;
  };
};

function normalizePem(value: string | null | undefined, type: "PRIVATE KEY" | "PUBLIC KEY") {
  if (!value) {
    return null;
  }

  return value.includes("BEGIN")
    ? value.replace(/\\n/g, "\n")
    : `-----BEGIN ${type}-----\n${value.replace(/\\n/g, "\n")}\n-----END ${type}-----`;
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function buildSignContent(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function signAlipayParams(params: Record<string, string>, merchantPrivateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(buildSignContent(params), "utf8");
  return signer.sign(merchantPrivateKey, "base64");
}

function verifyAlipaySignature(params: Record<string, string>, signature: string, alipayPublicKey: string) {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(buildSignContent(params), "utf8");
  return verifier.verify(alipayPublicKey, signature, "base64");
}

function alipayRequestUrl(params: Record<string, string>) {
  const url = new URL(getAlipayConfig().gatewayUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function alipayRequest(input: {
  method: "alipay.trade.query";
  bizContent: Record<string, string>;
}) {
  const config = getAlipayConfig();
  const privateKey = normalizePem(config.merchantPrivateKey, "PRIVATE KEY");

  if (!config.appId || !privateKey) {
    throw new Error("Alipay is not configured");
  }

  const params: Record<string, string> = {
    app_id: config.appId,
    method: input.method,
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(),
    version: "1.0",
    biz_content: JSON.stringify(input.bizContent),
  };

  params.sign = signAlipayParams(params, privateKey);

  const response = await fetch(config.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as AlipayTradeQueryResponse;
  const payload = json.alipay_trade_query_response;
  if (!payload || payload.code !== "10000") {
    throw new Error(payload?.msg || "Alipay request failed");
  }

  return payload;
}

export function getAlipayConfig(): AlipayConfig {
  return {
    appId: process.env.ALIPAY_APP_ID?.trim() || null,
    gatewayUrl: process.env.ALIPAY_GATEWAY_URL?.trim() || ALIPAY_GATEWAY_DEFAULT,
    merchantPrivateKey: process.env.ALIPAY_PRIVATE_KEY?.trim() || null,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY?.trim() || null,
    appUrl: process.env.APP_URL?.trim() || null,
  };
}

export function isAlipayCheckoutConfigured() {
  const config = getAlipayConfig();
  return Boolean(config.appId && config.merchantPrivateKey && config.appUrl);
}

export function isAlipayLifecycleConfigured() {
  const config = getAlipayConfig();
  return Boolean(config.appId && config.merchantPrivateKey && config.alipayPublicKey && config.appUrl);
}

export async function createAlipayCheckoutSession(
  input: ChinaPaymentCheckoutInput & { provider: PaymentProvider },
): Promise<ChinaPaymentCheckoutResult> {
  const config = getAlipayConfig();
  const privateKey = normalizePem(config.merchantPrivateKey, "PRIVATE KEY");

  if (!config.appId || !privateKey) {
    throw new Error("Alipay checkout is not configured yet");
  }

  const outTradeNo = buildChinaPaymentOrderId(PAYMENT_PROVIDER.ALIPAY, input.workspaceId);
  const totalAmount = (getWorkspaceOrderAmountCents(input) / 100).toFixed(2);
  const bizContent = JSON.stringify({
    out_trade_no: outTradeNo,
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: totalAmount,
    subject: `Helm Team · ${input.organizationName}`,
    body: getWorkspaceOrderDescription(input),
    timeout_express: "30m",
    passback_params: input.workspaceId,
  });

  const params: Record<string, string> = {
    app_id: config.appId,
    method: "alipay.trade.page.pay",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(),
    version: "1.0",
    notify_url: getChinaPaymentNotifyUrl(PAYMENT_PROVIDER.ALIPAY),
    return_url: getChinaPaymentReturnUrl({
      provider: PAYMENT_PROVIDER.ALIPAY,
      status: "checkout-returned",
    }),
    biz_content: bizContent,
  };

  params.sign = signAlipayParams(params, privateKey);

  return {
    provider: PAYMENT_PROVIDER.ALIPAY,
    checkoutMode: "ALIPAY_REDIRECT_OR_HOSTED",
    checkoutSessionId: outTradeNo,
    url: alipayRequestUrl(params),
  };
}

export async function queryAlipayTradeStatus(outTradeNo: string): Promise<ChinaPaymentStatusSnapshot> {
  const payload = await alipayRequest({
    method: "alipay.trade.query",
    bizContent: {
      out_trade_no: outTradeNo,
    },
  });

  const paidAt = payload.send_pay_date ? new Date(payload.send_pay_date) : new Date();
  const { currentPeriodStart, currentPeriodEnd } = getChinaBillingPeriodUnix(paidAt);

  return {
    provider: PAYMENT_PROVIDER.ALIPAY,
    checkoutSessionId: payload.out_trade_no ?? outTradeNo,
    providerStatus: payload.trade_status ?? null,
    subscriptionId: payload.trade_no ?? null,
    customerId: payload.buyer_user_id ?? null,
    currentPeriodStart,
    currentPeriodEnd,
  };
}

export function parseAlipayNotifyPayload(rawBody: string) {
  const params = new URLSearchParams(rawBody);
  const entries = Array.from(params.entries()).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

  return {
    entries,
    signature: entries.sign ?? "",
  };
}

export function verifyAlipayNotifyPayload(input: {
  rawBody: string;
}) {
  const config = getAlipayConfig();
  const publicKey = normalizePem(config.alipayPublicKey, "PUBLIC KEY");
  if (!publicKey) {
    throw new Error("Alipay public key is not configured");
  }

  const { entries, signature } = parseAlipayNotifyPayload(input.rawBody);
  const unsigned = Object.fromEntries(
    Object.entries(entries).filter(([key]) => key !== "sign" && key !== "sign_type"),
  );

  if (!signature) {
    throw new Error("Missing Alipay notify signature");
  }

  if (!verifyAlipaySignature(unsigned, signature, publicKey)) {
    throw new Error("Alipay notify signature verification failed");
  }

  return entries;
}
