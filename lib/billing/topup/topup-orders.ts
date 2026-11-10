import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ActorType, Prisma, type PaymentOrderState, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { FundsRefusal, postFundsTransactionInTransaction, runFundsTransactionWithRetry } from "../funds/funds-journal";
import { lockBillingAuthority, resolvePayerForWorkspaceInTransaction } from "../payer/payer-accounts";
import type { ObservedPayment, ObservedStatus, TopupProvider, TopupProviderAdapter } from "./provider-observation";

/**
 * Billing V1 S2-b wallet top-up orders. The server creates the order; provider callbacks and active queries converge on
 * ONE verification entry. Only a signature-valid, merchant/app-matched, amount- and currency-exact observation of a paid
 * `wallet_topup` order credits the wallet, exactly once per provider transaction, in the same Core transaction as the
 * order transition, VerifiedPayment, funds journal, audit and outbox. Lock order: PayerAccount FOR UPDATE -> PaymentOrder
 * FOR UPDATE -> VerifiedPayment -> FundsTransaction/projection (S2-a). Nothing here calls a provider.
 */
export const TOPUP_MIN_FEN = BigInt(100); // 1 yuan
export const TOPUP_MAX_FEN = BigInt(5_000_000); // 50 000 yuan per order; provisional until finance approves limits
const ORDER_TTL_MS = 2 * 60 * 60 * 1000;
const VERIFIER = { type: "SYSTEM" as const, ref: "billing-topup-verifier" };
const SOURCE_PAGE = "/billing/topup";
const ORDER_NO = /^tp[wa]_[0-9a-f]{28}$/;
const TXN_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type TopupRefusalCode = "topup_input_invalid" | "topup_amount_out_of_range" | "topup_forbidden" | "topup_billing_off" |
  "topup_observation_invalid" | "topup_signature_invalid" | "topup_order_unknown" | "topup_order_type_invalid" |
  "topup_provider_mismatch" | "topup_merchant_mismatch" | "topup_amount_mismatch" | "topup_currency_mismatch" |
  "topup_txn_conflict" | "topup_order_paid_by_other_txn" | "topup_invariant_breach";
export class TopupRefusal extends Error {
  constructor(readonly code: TopupRefusalCode) { super(code); this.name = "TopupRefusal"; }
}
function refuse(code: TopupRefusalCode): never { throw new TopupRefusal(code); }
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
  merchantRef: string; appRef: string; now?: Date };

/** OWNER or BILLING_ADMIN of the workspace; the payer is resolved server-side and must be in shadow or enforce mode. */
export async function createTopupOrder(client: PrismaClient, input: CreateTopupOrderInput) {
  reference(input.actorUserId); reference(input.workspaceId); reference(input.merchantRef); reference(input.appRef);
  if (input.provider !== "wechat_pay" && input.provider !== "alipay") refuse("topup_input_invalid");
  if (typeof input.amountFen !== "bigint" || input.amountFen < TOPUP_MIN_FEN || input.amountFen > TOPUP_MAX_FEN) {
    refuse("topup_amount_out_of_range");
  }
  const now = input.now ?? new Date();
  return client.$transaction(async tx => {
    try { await lockBillingAuthority(tx, input.actorUserId, [input.workspaceId]); } catch (error) {
      if (error instanceof Error && error.message === "payer_binding_forbidden") refuse("topup_forbidden");
      throw error;
    }
    const payer = await resolvePayerForWorkspaceInTransaction(tx, input.workspaceId);
    if (payer.billingMode !== "shadow" && payer.billingMode !== "enforce") refuse("topup_billing_off");
    const order = await tx.paymentOrder.create({ data: { payerAccountId: payer.payerAccountId, payerBindingId: payer.bindingId,
      workspaceId: input.workspaceId, orderType: "wallet_topup", provider: input.provider,
      providerOrderNo: newProviderOrderNo(input.provider), amountFen: input.amountFen, currency: "CNY",
      merchantRef: input.merchantRef, appRef: input.appRef, expiresAt: new Date(now.getTime() + ORDER_TTL_MS),
      createdBy: `USER:${input.actorUserId}` } });
    await writeAuditLog({ workspaceId: input.workspaceId, userId: input.actorUserId, actor: input.actorUserId,
      actorType: ActorType.USER, actionType: "BILLING_TOPUP_ORDER_CREATED", targetType: "PaymentOrder", targetId: order.id,
      summary: "Created wallet top-up order", sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
      relatedObjectId: payer.payerAccountId, payload: { provider: order.provider, providerOrderNo: order.providerOrderNo,
        amountFen: order.amountFen.toString(), billingMode: payer.billingMode } }, { client: tx });
    return order;
  }, { maxWait: 5000, timeout: 10000 });
}

/**
 * Non-paid observations move state only forward and never toward failure by time: `closed` (provider confirms the order is
 * closed unpaid) closes it, `unknown` parks it, `not_paid` marks a created order pending. A paid order never moves back.
 */
export function nextUnpaidState(state: PaymentOrderState, status: Exclude<ObservedStatus, "paid">): PaymentOrderState {
  if (state === "paid_verified" || state === "closed_unpaid") return state;
  if (status === "closed") return "closed_unpaid";
  if (status === "unknown") return state === "unknown" ? state : "unknown";
  return state === "created" ? "pending" : state;
}

type OrderRow = { id: string; payerAccountId: string; workspaceId: string; orderType: string; provider: TopupProvider;
  amountFen: bigint; currency: string; merchantRef: string; appRef: string; state: PaymentOrderState; version: number };
export type TopupVerification = { outcome: "credited" | "replayed" | "state_recorded" | "unchanged"; paymentOrderId: string;
  state: PaymentOrderState; lateAfterClose: boolean; verifiedPaymentId: string | null; fundsTransactionId: string | null };

function checkObservation(provider: TopupProvider, observed: ObservedPayment) {
  if (provider !== "wechat_pay" && provider !== "alipay") refuse("topup_observation_invalid");
  if (!observed || typeof observed !== "object" || (observed.source !== "callback" && observed.source !== "query")) {
    refuse("topup_observation_invalid");
  }
  // Signature first: an unauthenticated observation reads nothing and writes nothing.
  if (observed.signatureValid !== true) refuse("topup_signature_invalid");
  if (!["paid", "not_paid", "closed", "unknown"].includes(observed.status)) refuse("topup_observation_invalid");
  if (!isTopupProviderOrderNo(observed.providerOrderNo)) refuse("topup_order_unknown");
  if (observed.status === "paid" && (typeof observed.providerTxnId !== "string" || !TXN_ID.test(observed.providerTxnId) ||
      typeof observed.amountFen !== "bigint" || typeof observed.currency !== "string")) refuse("topup_observation_invalid");
}

async function recordState(tx: Prisma.TransactionClient, order: OrderRow, to: PaymentOrderState, payload: object) {
  const changed = await tx.$executeRaw`UPDATE PaymentOrder SET state = ${to}, version = version + 1,
    updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${order.id} AND version = ${Number(order.version)} AND state = ${order.state}`;
  if (changed !== 1) refuse("topup_invariant_breach"); // impossible under the row lock; fail closed if it ever happens
  await writeAuditLog({ workspaceId: order.workspaceId, userId: null, actor: `SYSTEM:${VERIFIER.ref}`, actorType: ActorType.SYSTEM,
    actionType: to === "paid_verified" ? "BILLING_TOPUP_VERIFIED" : "BILLING_TOPUP_ORDER_STATE", targetType: "PaymentOrder",
    targetId: order.id, summary: `Top-up order ${order.state} -> ${to}`, sourcePage: SOURCE_PAGE,
    relatedObjectType: "PayerAccount", relatedObjectId: order.payerAccountId, payload: { from: order.state, to, ...payload } },
  { client: tx });
}

/** The single verification entry for callbacks and active queries. Throws TopupRefusal/FundsRefusal; the caller's
 * transaction then rolls back with nothing written. */
export async function verifyTopupPaymentInTransaction(tx: Prisma.TransactionClient,
  input: { provider: TopupProvider; observed: ObservedPayment }): Promise<TopupVerification> {
  const { provider, observed } = input;
  checkObservation(provider, observed);
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

  if (observed.status !== "paid") {
    const next = nextUnpaidState(order.state, observed.status);
    if (next === order.state) return result("unchanged", order.state);
    await recordState(tx, order, next, { source: observed.source, observed: observed.status });
    return result("state_recorded", next);
  }
  const txnId = observed.providerTxnId as string;
  if (observed.currency !== order.currency) refuse("topup_currency_mismatch");
  if (observed.amountFen !== BigInt(order.amountFen)) refuse("topup_amount_mismatch");
  type PaymentRow = { id: string; paymentOrderId: string; fundsTransactionId: string; lateAfterClose: number | boolean };
  const [byTxn] = await tx.$queryRaw<PaymentRow[]>`SELECT id, paymentOrderId, fundsTransactionId, lateAfterClose
    FROM VerifiedPayment WHERE provider = ${provider} AND providerTxnId = ${txnId} FOR SHARE`;
  if (byTxn) {
    // Duplicate callback, or the loser of a callback/query race: replay, never a second credit.
    if (byTxn.paymentOrderId !== order.id) refuse("topup_txn_conflict");
    return result("replayed", order.state, { lateAfterClose: Boolean(byTxn.lateAfterClose), verifiedPaymentId: byTxn.id,
      fundsTransactionId: byTxn.fundsTransactionId });
  }
  const [byOrder] = await tx.$queryRaw<PaymentRow[]>`SELECT id FROM VerifiedPayment WHERE paymentOrderId = ${order.id} FOR SHARE`;
  if (byOrder) refuse("topup_order_paid_by_other_txn"); // a second payment for one order goes to reconciliation, not the wallet
  if (order.state === "paid_verified") refuse("topup_invariant_breach");
  // S2-b decision: a verified success after we closed the order still credits exactly once (the money arrived), flagged
  // lateAfterClose for reconciliation; it is never dropped and never credited twice.
  const lateAfterClose = order.state === "closed_unpaid";
  const amountFen = observed.amountFen as bigint;
  const funds = await postFundsTransactionInTransaction(tx, { payerAccountId: order.payerAccountId, kind: "topup",
    operationKey: `topup:${provider}:${txnId}`, actor: VERIFIER, evidenceRef: `payment-order:${order.id}`,
    entries: [{ account: "topup_clearing", direction: "debit", amountFen },
      { account: "customer_wallet_available", direction: "credit", amountFen }] });
  if (funds.replayed) refuse("topup_invariant_breach"); // journal and VerifiedPayment always commit together
  let payment: { id: string };
  try {
    payment = await tx.verifiedPayment.create({ data: { provider, providerTxnId: txnId, paymentOrderId: order.id, amountFen,
      currency: "CNY", source: observed.source, lateAfterClose, fundsTransactionId: funds.transaction.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FundsRefusal("funds_write_conflict");
    throw error;
  }
  const summary = { paymentOrderId: order.id, provider, providerTxnId: txnId, amountFen: amountFen.toString(), currency: "CNY",
    source: observed.source, lateAfterClose, verifiedPaymentId: payment.id, fundsTransactionId: funds.transaction.id };
  await recordState(tx, order, "paid_verified", summary);
  const payload = JSON.stringify(summary);
  await tx.billingOutbox.create({ data: { aggregateType: "PaymentOrder", aggregateId: order.id, eventType: "topup.verified",
    payload, payloadHash: createHash("sha256").update(payload).digest("hex") } });
  return result("credited", "paid_verified", { lateAfterClose, verifiedPaymentId: payment.id,
    fundsTransactionId: funds.transaction.id });
}

async function verifyObserved(client: PrismaClient, provider: TopupProvider, observed: ObservedPayment) {
  return runFundsTransactionWithRetry(client, tx => verifyTopupPaymentInTransaction(tx, { provider, observed }));
}
/** Callback path: the adapter verifies the signature/decrypts outside any DB transaction, then the shared entry runs. */
export async function verifyTopupCallback(client: PrismaClient, adapter: TopupProviderAdapter,
  request: { headers: Record<string, string | null>; rawBody: string }) {
  const observed = await adapter.observeCallback(request);
  if (observed?.source !== "callback") refuse("topup_observation_invalid");
  return verifyObserved(client, adapter.provider, observed);
}
/** Active query path (lost callback): re-query the ORIGINAL order number, never a new order. */
export async function verifyTopupByQuery(client: PrismaClient, adapter: TopupProviderAdapter, providerOrderNo: string) {
  if (!isTopupProviderOrderNo(providerOrderNo)) refuse("topup_order_unknown");
  const observed = await adapter.queryOrder(providerOrderNo);
  if (observed?.source !== "query" || observed.providerOrderNo !== providerOrderNo) refuse("topup_observation_invalid");
  return verifyObserved(client, adapter.provider, observed);
}
