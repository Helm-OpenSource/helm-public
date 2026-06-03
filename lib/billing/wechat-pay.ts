import {
  createDecipheriv,
  createSign,
  createVerify,
  randomUUID,
} from "node:crypto";
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

const WECHAT_API_BASE = "https://api.mch.weixin.qq.com";

type WeChatPayConfig = {
  appId: string | null;
  merchantId: string | null;
  merchantSerialNumber: string | null;
  merchantPrivateKey: string | null;
  platformPublicKey: string | null;
  apiV3Key: string | null;
  appUrl: string | null;
};

type WeChatPayNotifyResource = {
  ciphertext: string;
  nonce: string;
  associated_data?: string;
};

type WeChatPayNotifyPayload = {
  id: string;
  event_type: string;
  resource_type: string;
  summary: string;
  resource: WeChatPayNotifyResource;
};

type WeChatCreateNativeResponse = {
  code_url?: string;
};

type WeChatCreateH5Response = {
  h5_url?: string;
};

type WeChatOrderResponse = {
  out_trade_no?: string;
  trade_state?: string;
  transaction_id?: string;
  success_time?: string;
  payer?: {
    openid?: string;
  };
};

function normalizePem(key: string | null | undefined, type: "PRIVATE KEY" | "PUBLIC KEY") {
  if (!key) {
    return null;
  }

  return key.includes("BEGIN")
    ? key.replace(/\\n/g, "\n")
    : `-----BEGIN ${type}-----\n${key.replace(/\\n/g, "\n")}\n-----END ${type}-----`;
}

function getUnixTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function buildWeChatSignatureMessage(input: {
  method: string;
  urlPathWithQuery: string;
  timestamp: string;
  nonce: string;
  body: string;
}) {
  return `${input.method}\n${input.urlPathWithQuery}\n${input.timestamp}\n${input.nonce}\n${input.body}\n`;
}

function createWeChatAuthorizationHeader(input: {
  config: WeChatPayConfig;
  method: string;
  urlPathWithQuery: string;
  body: string;
}) {
  const privateKey = normalizePem(input.config.merchantPrivateKey, "PRIVATE KEY");
  if (!input.config.merchantId || !input.config.merchantSerialNumber || !privateKey) {
    throw new Error("WeChat Pay is not configured");
  }

  const timestamp = getUnixTimestamp();
  const nonce = randomUUID().replace(/-/g, "");
  const message = buildWeChatSignatureMessage({
    method: input.method,
    urlPathWithQuery: input.urlPathWithQuery,
    timestamp,
    nonce,
    body: input.body,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(message, "utf8");
  const signature = signer.sign(privateKey, "base64");

  return `WECHATPAY2-SHA256-RSA2048 mchid="${input.config.merchantId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${input.config.merchantSerialNumber}"`;
}

async function wechatRequest<T>(input: {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
}) {
  const config = getWeChatPayConfig();
  const body = input.body ? JSON.stringify(input.body) : "";
  const authorization = createWeChatAuthorizationHeader({
    config,
    method: input.method,
    urlPathWithQuery: input.path,
    body,
  });

  const response = await fetch(`${WECHAT_API_BASE}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: input.method === "POST" ? body : undefined,
    cache: "no-store",
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json.message ?? json.code ?? "WeChat Pay request failed"));
  }

  return json as T;
}

function appendWeChatRedirectUrl(url: string, locale?: string | null) {
  const redirect = encodeURIComponent(
    getChinaPaymentReturnUrl({
      provider: PAYMENT_PROVIDER.WECHAT_PAY,
      status: "checkout-returned",
      locale,
    }),
  );
  return `${url}${url.includes("?") ? "&" : "?"}redirect_url=${redirect}`;
}

export function getWeChatPayConfig(): WeChatPayConfig {
  return {
    appId: process.env.WECHAT_PAY_APP_ID?.trim() || null,
    merchantId: process.env.WECHAT_PAY_MERCHANT_ID?.trim() || null,
    merchantSerialNumber: process.env.WECHAT_PAY_MERCHANT_SERIAL_NO?.trim() || null,
    merchantPrivateKey: process.env.WECHAT_PAY_PRIVATE_KEY?.trim() || null,
    platformPublicKey: process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY?.trim() || null,
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY?.trim() || null,
    appUrl: process.env.APP_URL?.trim() || null,
  };
}

export function isWeChatPayCheckoutConfigured() {
  const config = getWeChatPayConfig();
  return Boolean(
    config.appId &&
      config.merchantId &&
      config.merchantSerialNumber &&
      config.merchantPrivateKey &&
      config.appUrl,
  );
}

export function isWeChatPayLifecycleConfigured() {
  const config = getWeChatPayConfig();
  return Boolean(
    config.appId &&
      config.merchantId &&
      config.merchantSerialNumber &&
      config.merchantPrivateKey &&
      config.platformPublicKey &&
      config.apiV3Key &&
      config.appUrl,
  );
}

export async function createWeChatPayCheckoutSession(
  input: ChinaPaymentCheckoutInput & { provider: PaymentProvider },
): Promise<ChinaPaymentCheckoutResult> {
  const config = getWeChatPayConfig();
  if (!config.appId || !config.merchantId) {
    throw new Error("WeChat Pay checkout is not configured yet");
  }

  const outTradeNo = buildChinaPaymentOrderId(PAYMENT_PROVIDER.WECHAT_PAY, input.workspaceId);
  const description = getWorkspaceOrderDescription(input);
  const amount = getWorkspaceOrderAmountCents(input);
  const notifyUrl = getChinaPaymentNotifyUrl(PAYMENT_PROVIDER.WECHAT_PAY, input.locale);
  const clientIp = String(input.clientIp ?? "").split(",")[0].trim();
  const userAgent = String(input.userAgent ?? "").toLowerCase();
  const prefersH5 = Boolean(clientIp && /iphone|ipad|android|mobile|micromessenger/.test(userAgent));

  if (prefersH5) {
    const payload = await wechatRequest<WeChatCreateH5Response>({
      method: "POST",
      path: "/v3/pay/transactions/h5",
      body: {
        appid: config.appId,
        mchid: config.merchantId,
        description,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: {
          total: amount,
          currency: "CNY",
        },
        scene_info: {
          payer_client_ip: clientIp,
          h5_info: {
            type: "Wap",
          },
        },
      },
    });

    if (!payload.h5_url) {
      throw new Error("WeChat Pay H5 checkout did not return a redirect URL");
    }

    return {
      provider: PAYMENT_PROVIDER.WECHAT_PAY,
      checkoutMode: "WECHAT_NATIVE_OR_H5",
      checkoutSessionId: outTradeNo,
      url: appendWeChatRedirectUrl(payload.h5_url, input.locale),
    };
  }

  const payload = await wechatRequest<WeChatCreateNativeResponse>({
    method: "POST",
    path: "/v3/pay/transactions/native",
    body: {
      appid: config.appId,
      mchid: config.merchantId,
      description,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: {
        total: amount,
        currency: "CNY",
      },
    },
  });

  if (!payload.code_url) {
    throw new Error("WeChat Pay Native checkout did not return a pay URL");
  }

  return {
    provider: PAYMENT_PROVIDER.WECHAT_PAY,
    checkoutMode: "WECHAT_NATIVE_OR_H5",
    checkoutSessionId: outTradeNo,
    url: payload.code_url,
  };
}

export async function queryWeChatPayOrderStatus(outTradeNo: string): Promise<ChinaPaymentStatusSnapshot> {
  const config = getWeChatPayConfig();
  if (!config.merchantId) {
    throw new Error("WeChat Pay merchant id is not configured");
  }

  const payload = await wechatRequest<WeChatOrderResponse>({
    method: "GET",
    path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.merchantId)}`,
  });

  const paidAt = payload.success_time ? new Date(payload.success_time) : new Date();
  const { currentPeriodStart, currentPeriodEnd } = getChinaBillingPeriodUnix(paidAt);

  return {
    provider: PAYMENT_PROVIDER.WECHAT_PAY,
    checkoutSessionId: payload.out_trade_no ?? outTradeNo,
    providerStatus: payload.trade_state ?? null,
    subscriptionId: payload.transaction_id ?? null,
    customerId: payload.payer?.openid ?? null,
    currentPeriodStart,
    currentPeriodEnd,
  };
}

export function verifyWeChatPayNotifySignature(input: {
  body: string;
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
}) {
  const config = getWeChatPayConfig();
  const publicKey = normalizePem(config.platformPublicKey, "PUBLIC KEY");

  if (!publicKey) {
    throw new Error("WeChat Pay platform public key is not configured");
  }

  if (!input.timestamp || !input.nonce || !input.signature) {
    throw new Error("Missing WeChat Pay notify signature headers");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${input.timestamp}\n${input.nonce}\n${input.body}\n`, "utf8");
  const ok = verifier.verify(publicKey, input.signature, "base64");
  if (!ok) {
    throw new Error("WeChat Pay notify signature verification failed");
  }
}

export function decryptWeChatPayNotifyPayload(payload: WeChatPayNotifyPayload) {
  const config = getWeChatPayConfig();
  if (!config.apiV3Key) {
    throw new Error("WeChat Pay API v3 key is not configured");
  }

  const resource = payload.resource;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(config.apiV3Key, "utf8"),
    Buffer.from(resource.nonce, "utf8"),
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }

  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as WeChatOrderResponse;
}

export function parseWeChatPayNotifyPayload(rawBody: string) {
  return JSON.parse(rawBody) as WeChatPayNotifyPayload;
}
