import "server-only";
import { createSign, createVerify } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { buildAlipaySignContent, normalizePem } from "@/lib/billing/alipay";
import { db } from "@/lib/db";
import { isDeploymentCapabilityEnabled } from "@/lib/runtime/deployment-capabilities";
import type { MerchantRefLookup } from "./provider-observation";
import { readNotifyBody, settleTopupNotify } from "./notify-entry";
import { defineTopupProviderAdapter } from "./topup-orders";

/**
 * Billing V1 S2-d1 Alipay (computer website payment) wallet top-up adapter and its own notify entry
 * (docs/operations/BILLING_TOPUP_ORDERS.md). Separate from the legacy subscription notify route, which is unchanged.
 * Secrets come from the environment only and never reach logs, errors or responses.
 */
const GATEWAY_DEFAULT = "https://openapi.alipay.com/gateway.do";
const MAX_QUERY_RESPONSE_CHARS = 65_536;
const QUERY_TIMEOUT_MS = 10_000;
const IDENTIFIER = /^[0-9A-Za-z]{1,32}$/;

export type AlipayTopupConfig = { appId: string; sellerId: string; privateKey: string; alipayPublicKey: string; gatewayUrl: string };

/** Reuses the existing ALIPAY_* keys plus the receiving merchant id; null (unavailable) when anything is missing or malformed. */
export function getAlipayTopupConfig(env: Readonly<Record<string, string | undefined>> = process.env): AlipayTopupConfig | null {
  const appId = env.ALIPAY_APP_ID?.trim() ?? "", sellerId = env.HELM_BILLING_TOPUP_ALIPAY_SELLER_ID?.trim() ?? "";
  const privateKey = normalizePem(env.ALIPAY_PRIVATE_KEY?.trim(), "PRIVATE KEY");
  const alipayPublicKey = normalizePem(env.ALIPAY_PUBLIC_KEY?.trim(), "PUBLIC KEY");
  const gatewayUrl = env.ALIPAY_GATEWAY_URL?.trim() || GATEWAY_DEFAULT;
  if (!IDENTIFIER.test(appId) || !IDENTIFIER.test(sellerId) || !privateKey || !alipayPublicKey ||
      !URL.canParse(gatewayUrl) || new URL(gatewayUrl).protocol !== "https:") return null;
  return { appId, sellerId, privateKey, alipayPublicKey, gatewayUrl };
}

/** Single merchant + app: only the configured pair maps to refs (written on the order at creation, compared per order). */
export function alipayTopupRefs(config: AlipayTopupConfig): MerchantRefLookup {
  return (sellerId, appId) => sellerId === config.sellerId && appId === config.appId
    ? { merchantRef: `alipay-seller:${sellerId}`, appRef: `alipay-app:${appId}` } : null;
}

const rsaVerify = (content: string, signature: string, publicKey: string) =>
  createVerify("RSA-SHA256").update(content, "utf8").verify(publicKey, signature, "base64");
const str = (value: unknown) => (typeof value === "string" ? value : undefined);
/** Partial-refund notifies may still say TRADE_SUCCESS; they are news for reconciliation, never a (first) credit. */
const REFUND_NEWS = "REFUND_NEWS";
const isRefundNews = (e: Record<string, string>) =>
  Boolean(e.gmt_refund || e.out_biz_no || (e.refund_fee && !/^0(\.0{1,2})?$/.test(e.refund_fee)));

/** Strict form: no duplicate names, RSA2 signature over every param but sign/sign_type (ASCII key order), utf-8 only. */
function verifyNotifyForm(config: AlipayTopupConfig, rawBody: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    if (Object.hasOwn(entries, key)) throw new Error("duplicate_param");
    Object.defineProperty(entries, key, { value, enumerable: true, writable: true, configurable: true });
  }
  const { sign, sign_type: signType, ...unsigned } = entries;
  if (!sign || signType !== "RSA2") throw new Error("signature_missing");
  if (unsigned.charset !== undefined && unsigned.charset.toLowerCase() !== "utf-8") throw new Error("charset_invalid");
  if (!rsaVerify(buildAlipaySignContent(unsigned), sign, config.alipayPublicKey)) throw new Error("signature_invalid");
  // Empty values are outside the signature (anyone may append them), so they are dropped; signed return-page params carry
  // no trade_status and are refused here rather than parked as unknown.
  const signed = Object.fromEntries(Object.entries(unsigned).filter(([, value]) => value !== ""));
  if (!signed.trade_status) throw new Error("trade_status_missing");
  return isRefundNews(signed) ? { ...signed, trade_status: REFUND_NEWS } : signed;
}

/** The exact raw text of a top-level response node: Alipay signs these bytes, so they are verified before being parsed. */
function rawNode(raw: string, key: string) {
  let i = raw.indexOf(`"${key}"`) + key.length + 2;
  const skip = () => { while (/\s/.test(raw[i] ?? "")) i += 1; };
  if (i < key.length + 2) throw new Error("query_response_invalid");
  skip();
  if (raw[i] !== ":") throw new Error("query_response_invalid");
  i += 1; skip();
  if (raw[i] !== "{") throw new Error("query_response_invalid");
  for (let j = i, depth = 0, quoted = false; j < raw.length; j += 1) {
    const c = raw[j];
    if (quoted) { if (c === "\\") j += 1; else if (c === "\"") quoted = false; }
    else if (c === "\"") quoted = true;
    else if (c === "{") depth += 1;
    else if (c === "}" && (depth -= 1) === 0) return raw.slice(i, j + 1);
  }
  throw new Error("query_response_invalid");
}

const beijingTimestamp = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");

/** alipay.trade.query signed by the configured app; the response node is signature-verified and keeps the amount. */
async function queryTrade(config: AlipayTopupConfig, fetchImpl: typeof fetch, providerOrderNo: string) {
  const params: Record<string, string> = { app_id: config.appId, method: "alipay.trade.query", charset: "utf-8", sign_type: "RSA2",
    timestamp: beijingTimestamp(), version: "1.0", biz_content: JSON.stringify({ out_trade_no: providerOrderNo }) };
  params.sign = createSign("RSA-SHA256").update(buildAlipaySignContent(params), "utf8").sign(config.privateKey, "base64");
  const response = await fetchImpl(config.gatewayUrl, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams(params).toString() });
  const raw = await response.text();
  if (!response.ok || raw.length > MAX_QUERY_RESPONSE_CHARS) throw new Error("query_unavailable");
  const node = rawNode(raw, "alipay_trade_query_response");
  const sign = str((JSON.parse(raw) as Record<string, unknown>).sign);
  if (!sign || !rsaVerify(node, sign, config.alipayPublicKey)) throw new Error("query_signature_invalid");
  const trade = JSON.parse(node) as Record<string, unknown>;
  // The response names no app; the query was signed by the configured app, so the identity is that app (and its merchant
  // unless the response states another seller, which then fails the merchant check).
  const identity = { app_id: config.appId, seller_id: str(trade.seller_id) ?? config.sellerId };
  if (trade.code === "40004" && trade.sub_code === "ACQ.TRADE_NOT_EXIST") {
    return { ...identity, out_trade_no: providerOrderNo, trade_status: "WAIT_BUYER_PAY" }; // cashier not opened yet
  }
  if (trade.code !== "10000") throw new Error("query_failed");
  return { ...identity, out_trade_no: str(trade.out_trade_no), trade_no: str(trade.trade_no), trade_status: str(trade.trade_status),
    total_amount: str(trade.total_amount), trans_currency: str(trade.trans_currency) };
}

export function createAlipayTopupAdapter(config: AlipayTopupConfig, fetchImpl: typeof fetch = fetch) {
  return defineTopupProviderAdapter("alipay", { refs: alipayTopupRefs(config),
    verifyCallback: async ({ rawBody }) => verifyNotifyForm(config, rawBody),
    queryOrder: providerOrderNo => queryTrade(config, fetchImpl, providerOrderNo) });
}

/** Fixed reason codes only: never ids, amounts, keys or provider text. */
function alert(reason: string) { console.error("[billing-topup-alipay]", JSON.stringify({ event: "notify_refused", reason })); }
const reply = (status: number, body: "success" | "fail") =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Alipay retries anything but the body `success` (answer policy shared in notify-entry.ts). */
export async function handleAlipayTopupNotify(request: Request, client: PrismaClient = db) {
  if (!isDeploymentCapabilityEnabled("billing_topup_alipay") || !isDeploymentCapabilityEnabled("financial_action")) {
    return new Response("Not Found", { status: 404 });
  }
  const config = getAlipayTopupConfig();
  if (!config) { alert("config_unavailable"); return reply(503, "fail"); }
  if (!/^application\/x-www-form-urlencoded(\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return reply(415, "fail");
  const rawBody = await readNotifyBody(request);
  if (typeof rawBody === "number") return reply(rawBody, "fail");
  const { acknowledged, status } = await settleTopupNotify(client, createAlipayTopupAdapter(config), { headers: {}, rawBody }, alert);
  return reply(status, acknowledged ? "success" : "fail");
}
