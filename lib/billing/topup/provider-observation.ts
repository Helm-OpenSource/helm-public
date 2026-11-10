/**
 * Billing V1 S2-b provider observations: the single shape that both provider callbacks and active order queries hand to
 * `verifyTopupPaymentInTransaction`. Provider IO (signature check, decryption, order query) happens only in an injected
 * adapter; nothing here calls a provider, reads configuration or holds a secret.
 */
export type TopupProvider = "wechat_pay" | "alipay";
export type ObservedStatus = "paid" | "not_paid" | "closed" | "unknown";
export type ObservedPayment = {
  source: "callback" | "query";
  /** Set by the adapter only after the callback signature (or the authenticated query response) verified. */
  signatureValid: boolean;
  /** Opaque server-config refs the adapter mapped from the provider's merchant/app ids; null when not configured. */
  merchantRef: string | null; appRef: string | null;
  providerOrderNo: string; providerTxnId: string | null;
  status: ObservedStatus; amountFen: bigint | null; currency: string | null;
};
/**
 * Injectable provider boundary. A production adapter wraps verifyWeChatPayNotifySignature + decryptWeChatPayNotifyPayload
 * and verifyAlipayNotifyPayload (lib/billing/wechat-pay.ts, alipay.ts) plus an amount-returning order query; tests use a
 * synthetic adapter. A thrown error means "no observation": nothing is written.
 */
export type TopupProviderAdapter = {
  provider: TopupProvider;
  observeCallback(request: { headers: Record<string, string | null>; rawBody: string }): Promise<ObservedPayment>;
  queryOrder(providerOrderNo: string): Promise<ObservedPayment>;
};
export type MerchantRefLookup = (providerMerchantId: string, providerAppId: string) =>
  { merchantRef: string; appRef: string } | null;
type Context = { source: ObservedPayment["source"]; signatureValid: boolean; refs: MerchantRefLookup };

// Anything not listed (REFUND, ACCEPT, unexpected values) is "unknown": it never credits and never closes an order.
const WECHAT_STATUS: Record<string, ObservedStatus> = { SUCCESS: "paid", NOTPAY: "not_paid", USERPAYING: "not_paid",
  PAYERROR: "not_paid", CLOSED: "closed", REVOKED: "closed" };
const ALIPAY_STATUS: Record<string, ObservedStatus> = { TRADE_SUCCESS: "paid", TRADE_FINISHED: "paid",
  WAIT_BUYER_PAY: "not_paid", TRADE_CLOSED: "closed" };
const text = (value: unknown) => (typeof value === "string" ? value : "");

export type WeChatPayTransaction = { mchid?: string; appid?: string; out_trade_no?: string; transaction_id?: string;
  trade_state?: string; amount?: { total?: number; currency?: string } };

/** WeChat Pay v3 transaction (decrypted notify resource or query response); `amount.total` is integer fen. */
export function observeWeChatPayTransaction(trade: WeChatPayTransaction, context: Context): ObservedPayment {
  const refs = context.refs(text(trade.mchid), text(trade.appid));
  const total = trade.amount?.total;
  return { source: context.source, signatureValid: context.signatureValid, merchantRef: refs?.merchantRef ?? null,
    appRef: refs?.appRef ?? null, providerOrderNo: text(trade.out_trade_no), providerTxnId: text(trade.transaction_id) || null,
    status: Object.hasOwn(WECHAT_STATUS, text(trade.trade_state)) ? WECHAT_STATUS[text(trade.trade_state)] : "unknown",
    amountFen: typeof total === "number" && Number.isSafeInteger(total) && total > 0 ? BigInt(total) : null,
    currency: text(trade.amount?.currency) || null };
}

/** Parses a yuan decimal with at most two places into fen exactly; anything else is null (no float, no rounding). */
export function yuanToFenExact(value: unknown): bigint | null {
  const match = /^(0|[1-9][0-9]{0,12})(?:\.([0-9]{1,2}))?$/.exec(text(value));
  if (!match) return null;
  const fen = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  return fen > BigInt(0) ? fen : null;
}

/**
 * Alipay verified notify entries or trade.query result; `total_amount` is yuan. Domestic Alipay trades carry no currency
 * field and settle in CNY, so an absent `trans_currency` means CNY; a present non-CNY value is refused downstream.
 */
export function observeAlipayTrade(trade: Record<string, string | undefined>, context: Context): ObservedPayment {
  const refs = context.refs(text(trade.seller_id), text(trade.app_id));
  return { source: context.source, signatureValid: context.signatureValid, merchantRef: refs?.merchantRef ?? null,
    appRef: refs?.appRef ?? null, providerOrderNo: text(trade.out_trade_no), providerTxnId: text(trade.trade_no) || null,
    status: Object.hasOwn(ALIPAY_STATUS, text(trade.trade_status)) ? ALIPAY_STATUS[text(trade.trade_status)] : "unknown",
    amountFen: yuanToFenExact(trade.total_amount), currency: text(trade.trans_currency) || "CNY" };
}
