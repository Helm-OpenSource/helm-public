import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ActorType, Prisma, type PaymentOrder, type PaymentOrderState, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";
import { FundsRefusal, postFundsTransactionInTransaction, runFundsTransactionWithRetry } from "../funds/funds-journal";
import { lockBillingAuthority, resolvePayerForWorkspaceInTransaction } from "../payer/payer-accounts";
import { observeAlipayTrade, observeWeChatPayTransaction, type MerchantRefLookup, type ObservedPayment, type ObservedStatus,
  type TopupProvider } from "./provider-observation";

/**
 * Billing V1 S2-b wallet top-up orders. Callbacks and active queries converge on ONE private verification entry: only an
 * adapter-authenticated, merchant/app-matched, amount/currency-exact paid observation of a `wallet_topup` order credits, once per
 * provider txn, in one Core transaction with the order transition, VerifiedPayment, funds journal, audit and outbox.
 * Lock order: PayerAccount -> PaymentOrder -> VerifiedPayment -> funds journal (S2-a). Nothing here calls a provider.
 */
/** Owner 2026-11-12 11:24 「100 的整倍数，上不封顶」: whole multiples of 100 yuan, at least 100 yuan, for every provider. */
export const TOPUP_UNIT_FEN = BigInt(10_000);
export const TOPUP_MIN_FEN = TOPUP_UNIT_FEN;
/** No business cap. Technical bound only: Alipay's documented total_amount maximum (100 000 000 yuan). */
export const TOPUP_MAX_FEN = BigInt(10_000_000_000);

/** The one amount rule shared by every top-up provider (closed codes). */
export function checkTopupAmountFen(amountFen: unknown): asserts amountFen is bigint {
  if (typeof amountFen !== "bigint" || amountFen < TOPUP_MIN_FEN || amountFen > TOPUP_MAX_FEN) refuse("topup_amount_out_of_range");
  if (amountFen % TOPUP_UNIT_FEN !== BigInt(0)) refuse("topup_amount_not_multiple");
}
export const TOPUP_ORDER_TTL_MS = 2 * 60 * 60 * 1000;
const VERIFIER = { type: "SYSTEM" as const, ref: "billing-topup-verifier" };
const SOURCE_PAGE = "/billing/topup";
const ORDER_NO = /^tp[wa]_[0-9a-f]{28}$/;
const TXN_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type TopupRefusalCode = "topup_input_invalid" | "topup_amount_out_of_range" | "topup_amount_not_multiple" |
  "topup_forbidden" | "topup_billing_off" |
  "topup_rate_limited" | "topup_idempotency_conflict" | "topup_order_not_closable" |
  "topup_observation_invalid" | "topup_signature_invalid" | "topup_order_unknown" | "topup_order_type_invalid" |
  "topup_provider_mismatch" | "topup_merchant_mismatch" | "topup_amount_mismatch" | "topup_currency_mismatch" |
  "topup_txn_conflict" | "topup_order_paid_by_other_txn" | "topup_invariant_breach" | "topup_observation_untrusted" |
  "payer_billing_off";
/** A pending-reconciliation record for money a provider reports that cannot be credited (never a balance change). */
export type PaymentException = { key: string; reason: string; paymentOrderId: string; workspaceId: string; payerAccountId: string;
  provider: TopupProvider; providerTxnId: string | null; amountFen: string | null; source: string; observed: ObservedStatus };
export class TopupRefusal extends Error {
  constructor(readonly code: TopupRefusalCode, readonly exception?: PaymentException) { super(code); this.name = "TopupRefusal"; }
}
function refuse(code: TopupRefusalCode, exception?: PaymentException): never { throw new TopupRefusal(code, exception); }
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
function reference(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/.test(value)) refuse("topup_input_invalid");
}

/** Top-up order numbers never collide with legacy subscription order ids (`helm_wx_` / `helm_ali_`). */
export function isTopupProviderOrderNo(value: unknown) { return typeof value === "string" && ORDER_NO.test(value); }
function newProviderOrderNo(provider: TopupProvider) {
  return `tp${provider === "alipay" ? "a" : "w"}_${randomBytes(14).toString("hex")}`; // 32 chars: WeChat out_trade_no limit
}

export type CreateTopupOrderInput = { actorUserId: string; workspaceId: string; provider: TopupProvider; amountFen: bigint;
  /** Resolved by the server from merchant configuration, never from the client. */
  merchantRef: string; appRef: string; now?: Date;
  /** S2-d2 route: the caller's Idempotency-Key; the same key with the same request replays the order, with another conflicts. */
  idempotencyKey?: string };

/** Contract S2D §2: per creator and workspace at most 5 open unpaid orders and 5 creations a minute. */
export const TOPUP_OPEN_ORDER_LIMIT = 5;
export const TOPUP_CREATIONS_PER_MINUTE = 5;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

/** OWNER or BILLING_ADMIN of the workspace; the payer is resolved server-side and must be in shadow or enforce mode. */
export async function createTopupOrder(client: PrismaClient, input: CreateTopupOrderInput) {
  return (await createOrReplayTopupOrder(client, input)).order as PaymentOrder; // without a key nothing is replayed
}

export type ReplayedTopupOrder = Pick<PaymentOrder, "id" | "provider" | "providerOrderNo" | "amountFen" | "state" | "expiresAt">;

/** As createTopupOrder, with Idempotency-Key replay and the creation limits; `replayed` marks an earlier order returned again. */
export async function createOrReplayTopupOrder(client: PrismaClient, input: CreateTopupOrderInput):
  Promise<{ order: PaymentOrder | ReplayedTopupOrder; replayed: boolean }> {
  reference(input.actorUserId); reference(input.workspaceId); reference(input.merchantRef); reference(input.appRef);
  if (input.provider !== "wechat_pay" && input.provider !== "alipay") refuse("topup_input_invalid");
  checkTopupAmountFen(input.amountFen);
  if (input.idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(input.idempotencyKey)) refuse("topup_input_invalid");
  const now = input.now ?? new Date();
  const createdBy = `USER:${input.actorUserId}`;
  const requestHash = sha256(JSON.stringify([input.provider, input.amountFen.toString(), input.merchantRef, input.appRef]));
  // READ COMMITTED (#546 review P2-1): under REPEATABLE READ a creator's first order makes the locking reads below hit an empty
  // (workspace, creator) range and take a shared gap lock; two different creators then insert into that gap and deadlock. RC takes
  // no gap locks. Replay and the limits keep their meaning: the creator's membership row lock still serializes one creator, the
  // reads after it see the latest commit, and UNIQUE (workspace, creator, key) backs the replay. Needs ROW binlog, as reservations.
  return client.$transaction(async tx => {
    // The creator's membership row lock serializes this creator's concurrent creations; the reads below then see what a previous
    // lock holder committed (they stay locking reads, which also keeps them correct should the isolation level ever change).
    try { await lockBillingAuthority(tx, input.actorUserId, [input.workspaceId], canManageWorkspaceBilling); } catch (error) {
      if (error instanceof Error && error.message === "payer_binding_forbidden") refuse("topup_forbidden");
      throw error;
    }
    if (input.idempotencyKey !== undefined) {
      const [earlier] = await tx.$queryRaw<Array<ReplayedTopupOrder & { requestHash: string | null }>>`
        SELECT id, provider, providerOrderNo, amountFen, state, expiresAt, requestHash FROM PaymentOrder
        WHERE workspaceId = ${input.workspaceId} AND createdBy = ${createdBy} AND idempotencyKey = ${input.idempotencyKey} FOR SHARE`;
      if (earlier) {
        if (earlier.requestHash !== requestHash) refuse("topup_idempotency_conflict");
        const { requestHash: _hash, ...order } = earlier;
        return { order: { ...order, amountFen: BigInt(order.amountFen) }, replayed: true };
      }
    }
    const [{ open, recent }] = await tx.$queryRaw<Array<{ open: bigint | null; recent: bigint | null }>>`
      SELECT SUM(state IN ('created', 'pending', 'unknown') AND expiresAt > ${now}) AS open,
        SUM(createdAt > ${new Date(now.getTime() - 60_000)}) AS recent
      FROM PaymentOrder WHERE workspaceId = ${input.workspaceId} AND createdBy = ${createdBy} FOR SHARE`;
    if (Number(open ?? 0) >= TOPUP_OPEN_ORDER_LIMIT || Number(recent ?? 0) >= TOPUP_CREATIONS_PER_MINUTE) refuse("topup_rate_limited");
    const payer = await resolvePayerForWorkspaceInTransaction(tx, input.workspaceId);
    if (payer.billingMode !== "shadow" && payer.billingMode !== "enforce") refuse("topup_billing_off");
    const order = await tx.paymentOrder.create({ data: { payerAccountId: payer.payerAccountId, payerBindingId: payer.bindingId,
      workspaceId: input.workspaceId, orderType: "wallet_topup", provider: input.provider,
      providerOrderNo: newProviderOrderNo(input.provider), amountFen: input.amountFen, currency: "CNY",
      merchantRef: input.merchantRef, appRef: input.appRef, expiresAt: new Date(now.getTime() + TOPUP_ORDER_TTL_MS), createdBy,
      idempotencyKey: input.idempotencyKey ?? null, requestHash: input.idempotencyKey === undefined ? null : requestHash } });
    await writeAuditLog({ workspaceId: input.workspaceId, userId: input.actorUserId, actor: input.actorUserId,
      actorType: ActorType.USER, actionType: "BILLING_TOPUP_ORDER_CREATED", targetType: "PaymentOrder", targetId: order.id,
      summary: "Created wallet top-up order", sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
      relatedObjectId: payer.payerAccountId, payload: { provider: order.provider, providerOrderNo: order.providerOrderNo,
        amountFen: order.amountFen.toString(), billingMode: payer.billingMode } }, { client: tx });
    return { order, replayed: false };
  }, { maxWait: 5000, timeout: 10000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/** Contract S2D §1.6: the session-triggered query runs at most every 10 s and 30 times an hour, for unpaid orders up to 72 h old. */
export const TOPUP_QUERY_MIN_INTERVAL_MS = 10_000;
export const TOPUP_QUERIES_PER_HOUR = 30;
export const TOPUP_QUERY_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const QUERYABLE: PaymentOrderState[] = ["created", "pending", "unknown", "closed_unpaid"];
export type TopupOrderView = { id: string; provider: TopupProvider; state: PaymentOrderState; amountFen: string; expiresAt: string;
  createdAt: string };
type SessionOrderInput = { actorUserId: string; workspaceId: string; paymentOrderId: string };
type SessionOrder = Pick<PaymentOrder, "id" | "provider" | "providerOrderNo" | "state" | "amountFen" | "expiresAt" | "createdAt" |
  "lastQueriedAt" | "queryWindowStartedAt" | "queryCount">;
const view = (order: SessionOrder): TopupOrderView => ({ id: order.id, provider: order.provider, state: order.state,
  amountFen: order.amountFen.toString(), expiresAt: order.expiresAt.toISOString(), createdAt: order.createdAt.toISOString() });

/** The order of the session's workspace, for its OWNER/BILLING_ADMIN; any other order is unknown (never another workspace's). */
async function lockSessionOrder(tx: Prisma.TransactionClient, input: SessionOrderInput) {
  reference(input.actorUserId); reference(input.workspaceId); reference(input.paymentOrderId);
  try { await lockBillingAuthority(tx, input.actorUserId, [input.workspaceId], canManageWorkspaceBilling); } catch (error) {
    if (error instanceof Error && error.message === "payer_binding_forbidden") refuse("topup_forbidden");
    throw error;
  }
  // A locking read of every column used: a plain read would see the snapshot from before the membership lock was granted.
  const [row] = await tx.$queryRaw<SessionOrder[]>`SELECT id, provider, providerOrderNo, state, amountFen, expiresAt, createdAt,
    lastQueriedAt, queryWindowStartedAt, queryCount FROM PaymentOrder WHERE id = ${input.paymentOrderId}
    AND workspaceId = ${input.workspaceId} AND orderType = 'wallet_topup' FOR UPDATE`;
  if (!row) refuse("topup_order_unknown");
  return { ...row, amountFen: BigInt(row.amountFen), queryCount: Number(row.queryCount) };
}

export async function readTopupOrderForSession(client: PrismaClient, input: SessionOrderInput) {
  return client.$transaction(async tx => view(await lockSessionOrder(tx, input)), { maxWait: 5000, timeout: 10000 });
}

/**
 * Admits one session-triggered provider call for the order (query, or close then query) under the per-order throttle. A credited
 * order, or one too old or not queryable, is returned as is without a provider call (`query: false`); close needs a waiting order.
 */
export async function claimTopupOrderQuery(client: PrismaClient,
  input: SessionOrderInput & { purpose: "query" | "close"; provider: TopupProvider; now?: Date }) {
  const now = input.now ?? new Date();
  return client.$transaction(async tx => {
    const order = await lockSessionOrder(tx, input);
    // Refused before any throttle write or provider call: an order is only ever sent to its own provider.
    if (order.provider !== input.provider) refuse("topup_provider_mismatch");
    if (input.purpose === "close" && order.state !== "created" && order.state !== "pending") refuse("topup_order_not_closable");
    if (!QUERYABLE.includes(order.state) || now.getTime() - order.createdAt.getTime() > TOPUP_QUERY_MAX_AGE_MS) {
      return { order, query: false };
    }
    if (order.lastQueriedAt && now.getTime() - order.lastQueriedAt.getTime() < TOPUP_QUERY_MIN_INTERVAL_MS) refuse("topup_rate_limited");
    const fresh = !order.queryWindowStartedAt || now.getTime() - order.queryWindowStartedAt.getTime() >= 3_600_000;
    if (!fresh && order.queryCount >= TOPUP_QUERIES_PER_HOUR) refuse("topup_rate_limited");
    await tx.$executeRaw`UPDATE PaymentOrder SET lastQueriedAt = ${now}, queryWindowStartedAt = ${fresh ? now : order.queryWindowStartedAt},
      queryCount = ${fresh ? 1 : order.queryCount + 1} WHERE id = ${order.id}`; // throttle only: neither state nor version changes
    return { order, query: true };
  }, { maxWait: 5000, timeout: 10000 });
}
export { view as topupOrderView };

/** Non-paid observations: `closed` (provider-confirmed) closes, `unknown` parks, `not_paid` marks pending; nothing by time. */
export function nextUnpaidState(state: PaymentOrderState, status: Exclude<ObservedStatus, "paid">): PaymentOrderState {
  if (state === "paid_verified" || state === "closed_unpaid") return state;
  if (status === "closed") return "closed_unpaid";
  if (status === "unknown") return state === "unknown" ? state : "unknown";
  return state === "created" ? "pending" : state;
}

type CallbackRequest = { headers: Record<string, string | null>; rawBody: string };
/** Provider IO: `verifyCallback` authenticates the raw notify (e.g. verifyWeChatPayNotifySignature + decrypt, verifyAlipayNotifyPayload)
 * and throws on failure; `queryOrder` uses the authenticated API. Both return the raw trade only, never a trust flag. */
export type TopupProviderIo = { refs: MerchantRefLookup; verifyCallback(request: CallbackRequest): Promise<unknown>;
  queryOrder(providerOrderNo: string): Promise<unknown> };
export type TopupProviderAdapter = { readonly provider: TopupProvider;
  observeCallback(request: CallbackRequest): Promise<ObservedPayment>; queryOrder(providerOrderNo: string): Promise<ObservedPayment> };
// Only observations minted (and frozen) by an adapter from this factory are accepted; a hand-built object is refused.
const TRUSTED = new WeakSet<object>();

export function defineTopupProviderAdapter(provider: TopupProvider, io: TopupProviderIo): TopupProviderAdapter {
  if (provider !== "wechat_pay" && provider !== "alipay") refuse("topup_input_invalid");
  const mint = (trade: unknown, source: ObservedPayment["source"]) => {
    if (!trade || typeof trade !== "object") refuse("topup_observation_invalid");
    const observed = Object.freeze(provider === "alipay"
      ? observeAlipayTrade(trade as Record<string, string | undefined>, { source, refs: io.refs })
      : observeWeChatPayTransaction(trade, { source, refs: io.refs }));
    TRUSTED.add(observed);
    return observed;
  };
  return Object.freeze({ provider,
    async observeCallback(request: CallbackRequest) {
      return mint(await io.verifyCallback(request).catch(() => refuse("topup_signature_invalid")), "callback");
    },
    async queryOrder(providerOrderNo: string) { return mint(await io.queryOrder(providerOrderNo), "query"); } });
}

type OrderRow = { id: string; payerAccountId: string; workspaceId: string; orderType: string; provider: TopupProvider;
  amountFen: bigint; currency: string; merchantRef: string; appRef: string; state: PaymentOrderState; version: number };
export type TopupVerification = { outcome: "credited" | "replayed" | "state_recorded" | "exception_recorded" | "unchanged";
  paymentOrderId: string; state: PaymentOrderState; lateAfterClose: boolean; verifiedPaymentId: string | null; fundsTransactionId: string | null };

function checkObservation(provider: TopupProvider, observed: ObservedPayment) {
  if (!observed || typeof observed !== "object" || !TRUSTED.has(observed)) refuse("topup_observation_untrusted");
  if (!["paid", "not_paid", "closed", "unknown"].includes(observed.status)) refuse("topup_observation_invalid");
  if (!isTopupProviderOrderNo(observed.providerOrderNo)) refuse("topup_order_unknown");
  if (observed.status === "paid" && (typeof observed.providerTxnId !== "string" || !TXN_ID.test(observed.providerTxnId) ||
      typeof observed.amountFen !== "bigint" || typeof observed.currency !== "string")) refuse("topup_observation_invalid");
}

/** Idempotent per key: the first record writes outbox `payment_exception` + audit; repeats write nothing. */
async function recordPaymentException(tx: Prisma.TransactionClient, exception: PaymentException) {
  const [existing] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM BillingOutbox
    WHERE aggregateType = 'PaymentException' AND aggregateId = ${exception.key} AND eventType = 'payment_exception' FOR UPDATE`;
  if (existing) return false;
  const payload = JSON.stringify(exception);
  const created = await tx.billingOutbox.create({ data: { aggregateType: "PaymentException", aggregateId: exception.key,
    eventType: "payment_exception", payload, payloadHash: sha256(payload) } }).then(() => true, (error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false; throw error; });
  if (!created) return false;
  await writeAuditLog({ workspaceId: exception.workspaceId, userId: null, actor: `SYSTEM:${VERIFIER.ref}`,
    actorType: ActorType.SYSTEM, actionType: "BILLING_TOPUP_PAYMENT_EXCEPTION", targetType: "PaymentOrder",
    targetId: exception.paymentOrderId, summary: `Top-up payment exception: ${exception.reason}`, sourcePage: SOURCE_PAGE,
    relatedObjectType: "PayerAccount", relatedObjectId: exception.payerAccountId, payload: exception }, { client: tx });
  return true;
}

async function recordState(tx: Prisma.TransactionClient, order: OrderRow, to: PaymentOrderState, payload: object) {
  const changed = await tx.$executeRaw`UPDATE PaymentOrder SET state = ${to}, version = version + 1,
    updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${order.id} AND version = ${Number(order.version)} AND state = ${order.state}`;
  if (changed !== 1) refuse("topup_invariant_breach"); // impossible under the row lock; fail closed if it ever happens
  await writeAuditLog({ workspaceId: order.workspaceId, userId: null, actor: `SYSTEM:${VERIFIER.ref}`, actorType: ActorType.SYSTEM,
    actionType: to === "paid_verified" ? "BILLING_TOPUP_VERIFIED" : "BILLING_TOPUP_ORDER_STATE", targetType: "PaymentOrder",
    targetId: order.id, summary: `Top-up order ${order.state} -> ${to}`, sourcePage: SOURCE_PAGE,
    relatedObjectType: "PayerAccount", relatedObjectId: order.payerAccountId, payload: { from: order.state, to, ...payload } }, { client: tx });
}

/** The single, module-private verification entry. Throws TopupRefusal/FundsRefusal; the transaction then rolls back. */
async function verifyInTransaction(tx: Prisma.TransactionClient, provider: TopupProvider,
  observed: ObservedPayment): Promise<TopupVerification> {
  const [found] = await tx.$queryRaw<Array<{ id: string; payerAccountId: string }>>`
    SELECT id, payerAccountId FROM PaymentOrder WHERE providerOrderNo = ${observed.providerOrderNo}`;
  if (!found) refuse("topup_order_unknown");
  await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${found.payerAccountId} FOR UPDATE`;
  const [order] = await tx.$queryRaw<OrderRow[]>`
    SELECT id, payerAccountId, workspaceId, orderType, provider, amountFen, currency, merchantRef, appRef, state, version
    FROM PaymentOrder WHERE id = ${found.id} FOR UPDATE`;
  if (!order || order.payerAccountId !== found.payerAccountId) refuse("topup_order_unknown");
  if (order.orderType !== "wallet_topup") refuse("topup_order_type_invalid");
  if (order.provider !== provider) refuse("topup_provider_mismatch");
  if (observed.merchantRef !== order.merchantRef || observed.appRef !== order.appRef) refuse("topup_merchant_mismatch");
  const result = (outcome: TopupVerification["outcome"], state: PaymentOrderState, extra: Partial<TopupVerification> = {}) =>
    ({ outcome, paymentOrderId: order.id, state, lateAfterClose: false, verifiedPaymentId: null, fundsTransactionId: null, ...extra });
  const exception = (reason: string, ref = observed.providerTxnId ?? observed.providerOrderNo): PaymentException => ({
    key: `${reason}:${provider}:${ref}`, reason, paymentOrderId: order.id, workspaceId: order.workspaceId,
    payerAccountId: order.payerAccountId, provider, providerTxnId: observed.providerTxnId,
    amountFen: observed.amountFen?.toString() ?? null, source: observed.source, observed: observed.status });

  if (observed.status !== "paid") {
    // Closed or refund/unknown news about a credited order: record for reconciliation, never touch the balance or state.
    if (order.state === "paid_verified" && observed.status !== "not_paid") {
      const recorded = await recordPaymentException(tx, exception(`paid_then_${observed.status}`, observed.providerOrderNo));
      return result(recorded ? "exception_recorded" : "unchanged", order.state);
    }
    // Unknown news (e.g. a refund) before any credit is kept too: a later query may still credit the full amount.
    const recorded = observed.status === "unknown" &&
      await recordPaymentException(tx, exception("unknown_before_credit", observed.providerOrderNo));
    const next = nextUnpaidState(order.state, observed.status);
    if (next === order.state) return result(recorded ? "exception_recorded" : "unchanged", order.state);
    await recordState(tx, order, next, { source: observed.source, observed: observed.status });
    return result("state_recorded", next);
  }
  const txnId = observed.providerTxnId as string;
  // A signed paid report that cannot be credited means money may have arrived: refuse, and the caller records an exception.
  if (observed.currency !== order.currency) refuse("topup_currency_mismatch", exception("currency_mismatch"));
  if (observed.amountFen !== BigInt(order.amountFen)) refuse("topup_amount_mismatch", exception("amount_mismatch"));
  type PaymentRow = { id: string; paymentOrderId: string; fundsTransactionId: string; lateAfterClose: number | boolean };
  const [byTxn] = await tx.$queryRaw<PaymentRow[]>`SELECT id, paymentOrderId, fundsTransactionId, lateAfterClose
    FROM VerifiedPayment WHERE provider = ${provider} AND providerTxnId = ${txnId} FOR SHARE`;
  if (byTxn) { // duplicate callback or callback/query race loser: replay, never a second credit
    if (byTxn.paymentOrderId !== order.id) refuse("topup_txn_conflict");
    return result("replayed", order.state, { lateAfterClose: Boolean(byTxn.lateAfterClose), verifiedPaymentId: byTxn.id,
      fundsTransactionId: byTxn.fundsTransactionId });
  }
  const [byOrder] = await tx.$queryRaw<PaymentRow[]>`SELECT id FROM VerifiedPayment WHERE paymentOrderId = ${order.id} FOR SHARE`;
  if (byOrder) refuse("topup_order_paid_by_other_txn", exception("order_paid_by_other_txn"));
  if (order.state === "paid_verified") refuse("topup_invariant_breach");
  // S2-b decision: a verified success after we closed the order still credits exactly once (money arrived), flagged for reconciliation.
  const lateAfterClose = order.state === "closed_unpaid";
  const amountFen = observed.amountFen as bigint;
  const funds = await postFundsTransactionInTransaction(tx, { payerAccountId: order.payerAccountId, kind: "topup",
    operationKey: `topup:${provider}:${txnId}`, actor: VERIFIER, evidenceRef: `payment-order:${order.id}`,
    entries: [{ account: "topup_clearing", direction: "debit", amountFen }, { account: "customer_wallet_available", direction: "credit", amountFen }] })
    .catch((error: unknown) => { throw error instanceof FundsRefusal && error.code === "payer_billing_off"
      ? new TopupRefusal("payer_billing_off", exception("payer_billing_off")) : error; });
  if (funds.replayed) refuse("topup_invariant_breach"); // journal and VerifiedPayment always commit together
  const payment = await tx.verifiedPayment.create({ data: { provider, providerTxnId: txnId, paymentOrderId: order.id, amountFen,
    currency: "CNY", source: observed.source, lateAfterClose, fundsTransactionId: funds.transaction.id } }).catch((error: unknown) => {
    throw error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? new FundsRefusal("funds_write_conflict") : error; });
  const summary = { paymentOrderId: order.id, provider, providerTxnId: txnId, amountFen: amountFen.toString(), currency: "CNY",
    source: observed.source, lateAfterClose, verifiedPaymentId: payment.id, fundsTransactionId: funds.transaction.id };
  await recordState(tx, order, "paid_verified", summary);
  const payload = JSON.stringify(summary);
  await tx.billingOutbox.create({ data: { aggregateType: "PaymentOrder", aggregateId: order.id, eventType: "topup.verified",
    payload, payloadHash: sha256(payload) } });
  return result("credited", "paid_verified", { lateAfterClose, verifiedPaymentId: payment.id, fundsTransactionId: funds.transaction.id });
}

/** A trusted, identity-matched "paid" report that cannot be parsed (txn id, amount): money may have arrived, so keep it. */
async function recordUnparseablePaid(client: PrismaClient, provider: TopupProvider, observed: ObservedPayment) {
  return runFundsTransactionWithRetry(client, async tx => {
    const order = await tx.paymentOrder.findUnique({ where: { providerOrderNo: observed.providerOrderNo } });
    if (!order || order.orderType !== "wallet_topup" || order.provider !== provider || order.merchantRef !== observed.merchantRef ||
        order.appRef !== observed.appRef) return undefined;
    const pending: PaymentException = { key: `observation_invalid:${provider}:${order.providerOrderNo}`, reason: "observation_invalid",
      paymentOrderId: order.id, workspaceId: order.workspaceId, payerAccountId: order.payerAccountId, provider,
      providerTxnId: typeof observed.providerTxnId === "string" ? observed.providerTxnId.slice(0, 64) : null,
      amountFen: typeof observed.amountFen === "bigint" ? observed.amountFen.toString() : null, source: observed.source, observed: "paid" };
    await recordPaymentException(tx, pending);
    return pending;
  });
}

async function verifyObserved(client: PrismaClient, provider: TopupProvider, observed: ObservedPayment) {
  try { checkObservation(provider, observed); } catch (error) { // untrusted or malformed observations open no credit transaction
    if (error instanceof TopupRefusal && error.code === "topup_observation_invalid" && observed.status === "paid" &&
        isTopupProviderOrderNo(observed.providerOrderNo)) {
      const pending = await recordUnparseablePaid(client, provider, observed);
      if (pending) refuse("topup_observation_invalid", pending);
    }
    throw error;
  }
  try {
    return await runFundsTransactionWithRetry(client, tx => verifyInTransaction(tx, provider, observed));
  } catch (error) {
    // The credit rolled back; persist the pending-reconciliation record in its own (idempotent) transaction.
    const pending = error instanceof TopupRefusal ? error.exception : undefined;
    if (pending) await runFundsTransactionWithRetry(client, tx => recordPaymentException(tx, pending));
    throw error;
  }
}
/** Callback path: the adapter authenticates the raw notify outside any DB transaction, then the private entry runs. */
export async function verifyTopupCallback(client: PrismaClient, adapter: TopupProviderAdapter, request: CallbackRequest) {
  const observed = await adapter.observeCallback(request);
  if (observed?.source !== "callback") refuse("topup_observation_invalid");
  return verifyObserved(client, adapter.provider, observed);
}
/** Active query path (lost callback): re-query the order's ORIGINAL provider order number, never a new order. */
export async function verifyTopupByQuery(client: PrismaClient, adapter: TopupProviderAdapter, paymentOrderId: string) {
  reference(paymentOrderId);
  const order = await client.paymentOrder.findUnique({ where: { id: paymentOrderId }, select: { provider: true, providerOrderNo: true } });
  if (!order) refuse("topup_order_unknown");
  if (order.provider !== adapter.provider) refuse("topup_provider_mismatch");
  const observed = await adapter.queryOrder(order.providerOrderNo);
  if (observed?.source !== "query" || observed.providerOrderNo !== order.providerOrderNo) refuse("topup_observation_invalid");
  return verifyObserved(client, adapter.provider, observed);
}
