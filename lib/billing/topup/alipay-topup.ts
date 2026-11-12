import "server-only";
import { createPrivateKey, createPublicKey, createSign, createVerify } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { buildAlipaySignContent, normalizePem } from "@/lib/billing/alipay";
import { db } from "@/lib/db";
import { isDeploymentCapabilityEnabled } from "@/lib/runtime/deployment-capabilities";
import { FundsRefusal } from "../funds/funds-journal";
import type { MerchantRefLookup } from "./provider-observation";
import { defineTopupProviderAdapter, TopupRefusal, verifyTopupCallback } from "./topup-orders";

/**
 * Billing V1 S2-d1 Alipay (computer website payment) wallet top-up adapter and its own notify entry
 * (docs/operations/BILLING_TOPUP_ORDERS.md). Separate from the legacy subscription notify route, which is unchanged.
 * Secrets come from the environment only and never reach logs, errors or responses.
 */
const GATEWAY_DEFAULT = "https://openapi.alipay.com/gateway.do";
const MAX_BODY_BYTES = 16_384;
const MAX_QUERY_RESPONSE_CHARS = 65_536;
const QUERY_TIMEOUT_MS = 10_000;
const IDENTIFIER = /^[0-9A-Za-z]{1,32}$/;

export type AlipayTopupConfig = { appId: string; sellerId: string; privateKey: string; alipayPublicKey: string; gatewayUrl: string };

export type AlipayTopupConfigProblem = "app_id_invalid" | "seller_id_invalid" | "private_key_invalid" | "public_key_invalid" |
  "gateway_invalid" | "app_url_invalid";
const parses = (parse: () => unknown) => { try { parse(); return true; } catch { return false; } };

/** Fixed problem codes only (never values). Keys must parse as PEM, so a malformed key closes the entry instead of failing later. */
export function getAlipayTopupConfigProblems(env: Readonly<Record<string, string | undefined>> = process.env) {
  const privateKey = normalizePem(env.ALIPAY_PRIVATE_KEY?.trim(), "PRIVATE KEY");
  const alipayPublicKey = normalizePem(env.ALIPAY_PUBLIC_KEY?.trim(), "PUBLIC KEY");
  const gatewayUrl = env.ALIPAY_GATEWAY_URL?.trim() || GATEWAY_DEFAULT;
  const problems: AlipayTopupConfigProblem[] = [];
  if (!IDENTIFIER.test(env.ALIPAY_APP_ID?.trim() ?? "")) problems.push("app_id_invalid");
  if (!IDENTIFIER.test(env.HELM_BILLING_TOPUP_ALIPAY_SELLER_ID?.trim() ?? "")) problems.push("seller_id_invalid");
  if (!privateKey || !parses(() => createPrivateKey(privateKey))) problems.push("private_key_invalid");
  if (!alipayPublicKey || !parses(() => createPublicKey(alipayPublicKey))) problems.push("public_key_invalid");
  if (!URL.canParse(gatewayUrl) || new URL(gatewayUrl).protocol !== "https:") problems.push("gateway_invalid");
  return { problems, config: { appId: env.ALIPAY_APP_ID?.trim() ?? "", sellerId: env.HELM_BILLING_TOPUP_ALIPAY_SELLER_ID?.trim() ?? "",
    privateKey: privateKey ?? "", alipayPublicKey: alipayPublicKey ?? "", gatewayUrl } };
}

/** Reuses the existing ALIPAY_* keys plus the receiving merchant id; null (unavailable) when anything is missing or malformed. */
export function getAlipayTopupConfig(env: Readonly<Record<string, string | undefined>> = process.env): AlipayTopupConfig | null {
  const { problems, config } = getAlipayTopupConfigProblems(env);
  return problems.length === 0 ? config : null;
}

/**
 * Origin for every URL we hand to Alipay or the browser (notify_url, return_url, top-up page): APP_URL only, https on the default
 * port, no credentials or path. Anything else is null, which closes order creation (contract S2D §6, §10.3).
 */
export function topupAppOrigin(env: Readonly<Record<string, string | undefined>> = process.env) {
  const raw = env.APP_URL?.trim() ?? "";
  if (!URL.canParse(raw)) return null;
  const url = new URL(raw);
  return url.protocol === "https:" && url.port === "" && !url.username && !url.password && url.pathname === "/" && !url.search &&
    !url.hash ? url.origin : null;
}

/** Both deployment gates only (no configuration check): read-only status views use this alone. */
export function alipayTopupGateOpen(env: Readonly<Record<string, string | undefined>> = process.env) {
  return isDeploymentCapabilityEnabled("billing_topup_alipay", env) && isDeploymentCapabilityEnabled("financial_action", env);
}

/**
 * The one availability decision for every Alipay top-up entry (notify now; order creation and query in S2-d2). The gate is on
 * by default (owner 2026-11-12), so incomplete merchant configuration is what keeps the entry closed: "unavailable" never
 * credits or creates anything, and each refusal logs one alert event with fixed problem codes.
 */
export function resolveAlipayTopup(entry: "notify" | "create" | "query",
  env: Readonly<Record<string, string | undefined>> = process.env): AlipayTopupConfig | "off" | "unavailable" {
  if (!alipayTopupGateOpen(env)) return "off";
  const { problems, config } = getAlipayTopupConfigProblems(env);
  if (entry === "create" && !topupAppOrigin(env)) problems.push("app_url_invalid");
  if (problems.length === 0) return config;
  console.error("[billing-topup-alipay]", JSON.stringify({ event: "topup_unavailable", reason: "config_unavailable", entry, problems }));
  return "unavailable";
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


const beijingTime = (at: Date) => new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");

/**
 * One signed gateway call (`alipay.trade.query` / `alipay.trade.close`) with a verified response node: the raw text of
 * `<method>_response` is RSA2-verified against the Alipay public key before it is parsed. Errors carry fixed codes only.
 */
async function gatewayCall(config: AlipayTopupConfig, fetchImpl: typeof fetch, method: "alipay.trade.query" | "alipay.trade.close",
  providerOrderNo: string) {
  const params: Record<string, string> = { app_id: config.appId, method, charset: "utf-8", sign_type: "RSA2",
    timestamp: beijingTime(new Date()), version: "1.0", biz_content: JSON.stringify({ out_trade_no: providerOrderNo }) };
  params.sign = createSign("RSA-SHA256").update(buildAlipaySignContent(params), "utf8").sign(config.privateKey, "base64");
  const response = await fetchImpl(config.gatewayUrl, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams(params).toString() });
  const raw = await response.text();
  if (!response.ok || raw.length > MAX_QUERY_RESPONSE_CHARS) throw new Error("query_unavailable");
  const node = rawNode(raw, `${method.replaceAll(".", "_")}_response`);
  const sign = str((JSON.parse(raw) as Record<string, unknown>).sign);
  if (!sign || !rsaVerify(node, sign, config.alipayPublicKey)) throw new Error("query_signature_invalid");
  return JSON.parse(node) as Record<string, unknown>;
}

/** alipay.trade.query signed by the configured app; the response node is signature-verified and keeps the amount. */
async function queryTrade(config: AlipayTopupConfig, fetchImpl: typeof fetch, providerOrderNo: string) {
  const trade = await gatewayCall(config, fetchImpl, "alipay.trade.query", providerOrderNo);
  // The response names no app; the query was signed by the configured app, so the identity is that app (and its merchant
  // unless the response states another seller, which then fails the merchant check).
  const identity = { app_id: config.appId, seller_id: str(trade.seller_id) ?? config.sellerId };
  if (trade.code === "40004" && trade.sub_code === "ACQ.TRADE_NOT_EXIST") {
    return { ...identity, out_trade_no: providerOrderNo, trade_status: "WAIT_BUYER_PAY" }; // cashier not opened yet
  }
  if (trade.code !== "10000") throw new Error("query_failed");
  return { ...identity, out_trade_no: str(trade.out_trade_no), trade_no: str(trade.trade_no), trade_status: str(trade.trade_status),
    total_amount: str(trade.total_amount), receipt_amount: str(trade.receipt_amount), trans_currency: str(trade.trans_currency) };
}

/**
 * alipay.trade.close for a waiting order (built, signed and sent by an explicit user action only). "closed": Alipay closed the
 * trade, which can then no longer be paid; "not_created": no trade exists yet (the cashier was never submitted; whether an old
 * cashier link still works afterwards is not documented). The order state itself only changes from a follow-up query.
 */
export async function closeAlipayTopupTrade(config: AlipayTopupConfig, providerOrderNo: string, fetchImpl: typeof fetch = fetch) {
  const result = await gatewayCall(config, fetchImpl, "alipay.trade.close", providerOrderNo);
  if (result.code === "10000") {
    if (result.out_trade_no !== providerOrderNo) throw new Error("query_response_invalid");
    return "closed" as const;
  }
  if (result.code === "40004" && result.sub_code === "ACQ.TRADE_NOT_EXIST") return "not_created" as const;
  throw new Error("close_failed"); // e.g. ACQ.TRADE_STATUS_ERROR: no longer waiting for payment; the follow-up query tells
}

export const ALIPAY_TOPUP_NOTIFY_PATH = "/api/billing/v1/topup-notify/alipay";
export const TOPUP_PAGE_PATH = "/billing/topup";
/** Fixed text: nothing we write into a signed Alipay field comes from a user (contract S2D §6). */
export const ALIPAY_TOPUP_SUBJECT = "Helm 钱包充值";
const fenToYuan = (fen: bigint) => `${fen / BigInt(100)}.${(fen % BigInt(100)).toString().padStart(2, "0")}`;

/**
 * Signed `alipay.trade.page.pay` cashier URL for one top-up order; built only, never sent from here (the browser opens it).
 * notify_url is always the top-up entry and there is no passback_params, so a misrouted notify never resolves a workspace on the
 * legacy subscription route. The cashier closes when the order expires.
 */
export function buildAlipayTopupPayUrl(config: AlipayTopupConfig, appOrigin: string,
  order: { id: string; providerOrderNo: string; amountFen: bigint; expiresAt: Date }, now = new Date()) {
  const params: Record<string, string> = { app_id: config.appId, method: "alipay.trade.page.pay", charset: "utf-8", sign_type: "RSA2",
    timestamp: beijingTime(now), version: "1.0", notify_url: `${appOrigin}${ALIPAY_TOPUP_NOTIFY_PATH}`,
    return_url: `${appOrigin}${TOPUP_PAGE_PATH}?order=${encodeURIComponent(order.id)}`,
    biz_content: JSON.stringify({ out_trade_no: order.providerOrderNo, product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: fenToYuan(order.amountFen), subject: ALIPAY_TOPUP_SUBJECT, time_expire: beijingTime(order.expiresAt) }) };
  params.sign = createSign("RSA-SHA256").update(buildAlipaySignContent(params), "utf8").sign(config.privateKey, "base64");
  const url = new URL(config.gatewayUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
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

async function readBoundedText(request: Request): Promise<string | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

/**
 * Alipay retries anything but the body `success`. `success` = the observation is durably handled (credited, replayed, state
 * recorded, or a payment exception persisted where a retry cannot help); retryable conditions answer non-success.
 */
export async function handleAlipayTopupNotify(request: Request, client: PrismaClient = db) {
  const config = resolveAlipayTopup("notify");
  if (config === "off") return new Response("Not Found", { status: 404 });
  if (config === "unavailable") return reply(503, "fail"); // never credits; Alipay retries once configuration is complete
  if (!/^application\/x-www-form-urlencoded(\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return reply(415, "fail");
  if (!(Number(request.headers.get("content-length") ?? "0") <= MAX_BODY_BYTES)) return reply(413, "fail");
  let rawBody: string | null;
  try { rawBody = await readBoundedText(request); } catch { return reply(400, "fail"); }
  if (rawBody === null) return reply(413, "fail");
  try {
    await verifyTopupCallback(client, createAlipayTopupAdapter(config), { headers: {}, rawBody });
    return reply(200, "success");
  } catch (error) {
    if (error instanceof TopupRefusal) {
      alert(error.code);
      if (error.code === "payer_billing_off") return reply(503, "fail"); // recorded once; a later retry credits once re-enabled
      return error.exception ? reply(200, "success") : reply(400, "fail");
    }
    const retryable = (error instanceof FundsRefusal && error.code === "funds_write_conflict") ||
      error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientKnownRequestError;
    alert(error instanceof FundsRefusal ? error.code : retryable ? "database_unavailable" : "unexpected_error");
    return reply(retryable ? 503 : 500, "fail");
  }
}
