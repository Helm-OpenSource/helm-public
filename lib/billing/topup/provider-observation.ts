/**
 * Billing V1 S2-b provider observations: pure mappers from a provider trade (already signature-verified or fetched over the
 * authenticated query API by an adapter) to the one shape verification reads. A mapped object is NOT trusted by itself:
 * only `defineTopupProviderAdapter` (topup-orders.ts) registers and freezes observations. Nothing here calls a provider.
 */
export type TopupProvider = "wechat_pay" | "alipay";
export type ObservedStatus = "paid" | "not_paid" | "closed" | "unknown";
export type ObservedPayment = {
  source: "callback" | "query";
  /** Opaque server-config refs mapped from the provider's merchant/app ids; null when not configured. */
  merchantRef: string | null; appRef: string | null;
  providerOrderNo: string; providerTxnId: string | null;
  status: ObservedStatus; amountFen: bigint | null; currency: string | null;
};
export type MerchantRefLookup = (providerMerchantId: string, providerAppId: string) =>
  { merchantRef: string; appRef: string } | null;
type Context = { source: ObservedPayment["source"]; refs: MerchantRefLookup };

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
  return { source: context.source, merchantRef: refs?.merchantRef ?? null, appRef: refs?.appRef ?? null,
    providerOrderNo: text(trade.out_trade_no), providerTxnId: text(trade.transaction_id) || null,
    status: Object.hasOwn(WECHAT_STATUS, text(trade.trade_state)) ? WECHAT_STATUS[text(trade.trade_state)] : "unknown",
    amountFen: typeof total === "number" && Number.isSafeInteger(total) && total > 0 ? BigInt(total) : null,
    currency: text(trade.amount?.currency) || null };
}

/** Parses a yuan decimal with at most two places into fen exactly; anything else is null (no float, no rounding). */
export function yuanToFenExact(value: unknown): bigint | null {
  const match = /^(0|[1-9][0-9]{0,12})(?:\.([0-9]{1,2}))?$/.exec(text(value));
  const fen = match ? BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0")) : BigInt(0);
  return fen > BigInt(0) ? fen : null;
}

/** Alipay notify entries or trade.query result; `total_amount` is yuan. Domestic trades carry no currency and settle in CNY,
 * so an absent `trans_currency` means CNY; a present non-CNY value is refused downstream. */
export function observeAlipayTrade(trade: Record<string, string | undefined>, context: Context): ObservedPayment {
  const refs = context.refs(text(trade.seller_id), text(trade.app_id));
  return { source: context.source, merchantRef: refs?.merchantRef ?? null,
    appRef: refs?.appRef ?? null, providerOrderNo: text(trade.out_trade_no), providerTxnId: text(trade.trade_no) || null,
    status: Object.hasOwn(ALIPAY_STATUS, text(trade.trade_status)) ? ALIPAY_STATUS[text(trade.trade_status)] : "unknown",
    amountFen: yuanToFenExact(trade.total_amount), currency: text(trade.trans_currency) || "CNY" };
}
