import "server-only";
import { createDecipheriv, createPrivateKey, createPublicKey, createSign, createVerify, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { normalizePem } from "@/lib/billing/alipay";
import { db } from "@/lib/db";
import { isDeploymentCapabilityEnabled } from "@/lib/runtime/deployment-capabilities";
import { readNotifyBody, settleTopupNotify } from "./notify-entry";
import type { MerchantRefLookup } from "./provider-observation";
import { defineTopupProviderAdapter } from "./topup-orders";

/**
 * Billing V1 S2-w1 WeChat Pay (APIv3) wallet top-up adapter and its own notify entry (docs/operations/BILLING_TOPUP_ORDERS.md).
 * Separate from the legacy subscription notify route, which is unchanged. Only the "WeChat Pay public key" verification mode is
 * supported: a notify or answer whose Wechatpay-Serial is not the configured public key id fails verification and never credits.
 * Keys come from the environment only and never reach logs, errors or responses.
 */
const API_BASE = "https://api.mch.weixin.qq.com";
const MAX_QUERY_RESPONSE_CHARS = 65_536;
const QUERY_TIMEOUT_MS = 10_000;
const MAX_CLOCK_SKEW_SECONDS = 300;
const IDENTIFIER = /^[0-9A-Za-z_]{1,32}$/;

export type WeChatPayTopupConfig = { appId: string; merchantId: string; merchantSerialNo: string; privateKey: string;
  publicKey: string; publicKeyId: string; apiV3Key: Buffer };

/** A malformed key must make the entry unavailable (fail closed), not surface later as a signature or query failure. */
function isRsaKey(pem: string | null, kind: "private" | "public"): pem is string {
  try { return Boolean(pem) && (kind === "private" ? createPrivateKey(pem!) : createPublicKey(pem!)).asymmetricKeyType === "rsa"; }
  catch { return false; }
}
/** createPublicKey also accepts a private key (deriving its public half); the public slot must never hold one. */
function isPrivateKey(pem: string) { try { createPrivateKey(pem); return true; } catch { return false; } }

/** Reuses the existing WECHAT_PAY_* keys plus the public key id; null (unavailable) when anything is missing or malformed. */
export function getWeChatPayTopupConfig(env: Readonly<Record<string, string | undefined>> = process.env): WeChatPayTopupConfig | null {
  const appId = env.WECHAT_PAY_APP_ID?.trim() ?? "", merchantId = env.WECHAT_PAY_MERCHANT_ID?.trim() ?? "";
  const merchantSerialNo = env.WECHAT_PAY_MERCHANT_SERIAL_NO?.trim() ?? "";
  const publicKeyId = env.HELM_BILLING_TOPUP_WECHATPAY_PUBLIC_KEY_ID?.trim() ?? "";
  const privateKey = normalizePem(env.WECHAT_PAY_PRIVATE_KEY?.trim(), "PRIVATE KEY");
  const publicKey = normalizePem(env.WECHAT_PAY_PLATFORM_PUBLIC_KEY?.trim(), "PUBLIC KEY");
  const apiV3Key = Buffer.from(env.WECHAT_PAY_API_V3_KEY?.trim() ?? "", "utf8");
  if (!IDENTIFIER.test(appId) || !IDENTIFIER.test(merchantId) || !/^[0-9A-Fa-f]{1,64}$/.test(merchantSerialNo) ||
      !/^PUB_KEY_ID_[0-9]{1,64}$/.test(publicKeyId) || !isRsaKey(privateKey, "private") || !isRsaKey(publicKey, "public") || isPrivateKey(publicKey) ||
      apiV3Key.length !== 32) return null;
  return { appId, merchantId, merchantSerialNo, privateKey, publicKey, publicKeyId, apiV3Key };
}

/** Single merchant + app: only the configured pair maps to refs (written on the order at creation, compared per order). */
export function weChatPayTopupRefs(config: WeChatPayTopupConfig): MerchantRefLookup {
  return (mchid, appid) => mchid === config.merchantId && appid === config.appId
    ? { merchantRef: `wechatpay-mch:${mchid}`, appRef: `wechatpay-app:${appid}` } : null;
}

type Signed = { timestamp: string | null; nonce: string | null; signature: string | null; serial: string | null; body: string };
/** APIv3 answer/notify signature: freshness first (both directions), then the configured key id, then SHA256-RSA over the raw body. */
function verifySigned(config: WeChatPayTopupConfig, signed: Signed, nowMs: number) {
  const { timestamp, nonce, signature, serial, body } = signed;
  if (!timestamp || !/^[0-9]{1,12}$/.test(timestamp) || Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    throw new Error("timestamp_invalid");
  }
  if (!nonce || !signature || serial !== config.publicKeyId) throw new Error("signature_missing");
  // Signature probes (WECHATPAY/SIGNTEST/...) are not special-cased: they fail here like any bad signature.
  if (!createVerify("RSA-SHA256").update(`${timestamp}\n${nonce}\n${body}\n`, "utf8").verify(config.publicKey, signature, "base64")) {
    throw new Error("signature_invalid");
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** AEAD_AES_256_GCM with the APIv3 key: ciphertext is base64 with the 16-byte tag appended; nonce and AAD are used as UTF-8.
 * associated_data is an optional string that "may be empty"; absent, "" and null all mean empty AAD (the GCM tag still decides). */
function decryptResource(config: WeChatPayTopupConfig, resource: Record<string, unknown>): unknown {
  const { algorithm, ciphertext, nonce, associated_data: aad } = resource;
  if (algorithm !== "AEAD_AES_256_GCM" || typeof ciphertext !== "string" || typeof nonce !== "string" ||
      (aad !== undefined && aad !== null && typeof aad !== "string")) throw new Error("resource_invalid");
  const sealed = Buffer.from(ciphertext, "base64");
  if (sealed.length <= 16) throw new Error("resource_invalid");
  const decipher = createDecipheriv("aes-256-gcm", config.apiV3Key, Buffer.from(nonce, "utf8"));
  decipher.setAAD(Buffer.from(aad ?? "", "utf8"));
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain));
}

/** Notify: verified headers over the raw JSON body, an encrypted `transaction` resource; only TRANSACTION.SUCCESS may say paid. */
function verifyNotify(config: WeChatPayTopupConfig, headers: Record<string, string | null>, rawBody: string, nowMs: number) {
  verifySigned(config, { timestamp: headers["wechatpay-timestamp"], nonce: headers["wechatpay-nonce"],
    signature: headers["wechatpay-signature"], serial: headers["wechatpay-serial"], body: rawBody }, nowMs);
  const notify: unknown = JSON.parse(rawBody);
  if (!isObject(notify) || notify.resource_type !== "encrypt-resource" || !isObject(notify.resource) ||
      notify.resource.original_type !== "transaction") throw new Error("notify_invalid");
  const trade = decryptResource(config, notify.resource);
  if (!isObject(trade)) throw new Error("resource_invalid");
  // Any other event about a transaction is news for reconciliation (unknown), never a credit.
  return notify.event_type === "TRANSACTION.SUCCESS" ? trade : { ...trade, trade_state: "UNEXPECTED_EVENT" };
}

/** APIv3 request signature with the merchant API key; serial_no is the merchant certificate serial (not the public key id). */
function authorization(config: WeChatPayTopupConfig, method: string, pathWithQuery: string, body: string, nowMs: number) {
  const timestamp = Math.floor(nowMs / 1000).toString(), nonce = randomBytes(16).toString("hex");
  const signature = createSign("RSA-SHA256").update(`${method}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`, "utf8")
    .sign(config.privateKey, "base64");
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.merchantId}",nonce_str="${nonce}",signature="${signature}",` +
    `timestamp="${timestamp}",serial_no="${config.merchantSerialNo}"`;
}

/** Query by our order number; the answer is signature-verified before it is parsed, errors included. */
async function queryTransaction(config: WeChatPayTopupConfig, fetchImpl: typeof fetch, now: () => number, providerOrderNo: string) {
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(providerOrderNo)}?mchid=${encodeURIComponent(config.merchantId)}`;
  const response = await fetchImpl(`${API_BASE}${path}`, { method: "GET", cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS), headers: { Authorization: authorization(config, "GET", path, "", now()),
      Accept: "application/json", "Wechatpay-Serial": config.publicKeyId } });
  const raw = await response.text();
  if (raw.length > MAX_QUERY_RESPONSE_CHARS) throw new Error("query_unavailable");
  try {
    verifySigned(config, { timestamp: response.headers.get("wechatpay-timestamp"), nonce: response.headers.get("wechatpay-nonce"),
      signature: response.headers.get("wechatpay-signature"), serial: response.headers.get("wechatpay-serial"), body: raw }, now());
  } catch { throw new Error("query_signature_invalid"); }
  const answer: unknown = JSON.parse(raw);
  if (response.status === 404 && isObject(answer) && answer.code === "ORDER_NOT_EXIST") { // QR code never scanned and paid
    return { appid: config.appId, mchid: config.merchantId, out_trade_no: providerOrderNo, trade_state: "NOTPAY" };
  }
  if (response.status !== 200 || !isObject(answer)) throw new Error("query_failed");
  return answer; // carries appid and mchid itself: a foreign merchant or app maps to no refs
}

export function createWeChatPayTopupAdapter(config: WeChatPayTopupConfig, fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  return defineTopupProviderAdapter("wechat_pay", { refs: weChatPayTopupRefs(config),
    verifyCallback: async ({ headers, rawBody }) => verifyNotify(config, headers, rawBody, now()),
    queryOrder: providerOrderNo => queryTransaction(config, fetchImpl, now, providerOrderNo) });
}

/** Fixed reason codes only: never ids, amounts, keys or provider text. */
function alert(reason: string, extra: Record<string, number> = {}) {
  console.error("[billing-topup-wechatpay]", JSON.stringify({ event: "notify_refused", reason, ...extra }));
}
/** Default-on deployments without WeChat Pay see unauthenticated POSTs: at most one config alert per minute, with a count. */
const CONFIG_ALERT_INTERVAL_MS = 60_000;
const configAlert = { lastAt: Number.NEGATIVE_INFINITY, suppressed: 0 };
function alertConfigUnavailable(nowMs: number) {
  if (nowMs - configAlert.lastAt < CONFIG_ALERT_INTERVAL_MS) { configAlert.suppressed += 1; return; }
  alert("config_unavailable", { suppressed: configAlert.suppressed });
  configAlert.lastAt = nowMs; configAlert.suppressed = 0;
}
/** WeChat Pay: success is 200 with no body; failure is 4XX/5XX with {"code":"FAIL",...} and is retried. */
const fail = (status: number) => Response.json({ code: "FAIL", message: "失败" }, { status, headers: { "Cache-Control": "no-store" } });
const SIGNED_HEADERS = ["wechatpay-timestamp", "wechatpay-nonce", "wechatpay-signature", "wechatpay-serial"] as const;

export async function handleWeChatPayTopupNotify(request: Request, client: PrismaClient = db) {
  if (!isDeploymentCapabilityEnabled("billing_topup_wechatpay") || !isDeploymentCapabilityEnabled("financial_action")) {
    return new Response("Not Found", { status: 404 });
  }
  const config = getWeChatPayTopupConfig();
  if (!config) { alertConfigUnavailable(Date.now()); return fail(503); }
  if (!/^application\/json(\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return fail(415);
  const rawBody = await readNotifyBody(request);
  if (typeof rawBody === "number") return fail(rawBody);
  const headers = Object.fromEntries(SIGNED_HEADERS.map(name => [name, request.headers.get(name)]));
  const { acknowledged, status } = await settleTopupNotify(client, createWeChatPayTopupAdapter(config), { headers, rawBody }, alert);
  return acknowledged ? new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }) : fail(status);
}
