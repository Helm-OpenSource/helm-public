import { createHmac, randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import type { WeChatPayTransaction } from "./provider-observation";
import { createTopupOrder, defineTopupProviderAdapter, verifyTopupByQuery, verifyTopupCallback } from "./topup-orders";

// Runs only against a fully migrated, explicitly isolated database; never DATABASE_URL or the app's connection.
const url = process.env.BILLING_MYSQL_DATABASE_URL;
if (process.env.BILLING_MYSQL_REQUIRED === "1" && !url) throw new Error("isolated_billing_database_required");

function assertIsolatedTarget(raw: string) {
  const parsed = new URL(raw);
  const socket = parsed.searchParams.get("socket");
  if (socket) {
    if (!/^\/private\/tmp\/helm-billing-mysql\.[A-Za-z0-9]+\/db\.sock$/.test(socket)) throw new Error("synthetic_socket_path_invalid");
    const file = lstatSync(socket), directory = statSync(dirname(socket));
    if (!file.isSocket() || file.uid !== process.getuid?.() || directory.uid !== process.getuid?.() ||
        (directory.mode & 0o077) !== 0 || realpathSync(socket) !== socket) throw new Error("synthetic_socket_identity_invalid");
    return join(dirname(socket), "data");
  }
  if (process.env.GITHUB_ACTIONS !== "true" || !/^[a-f0-9]{12,64}$/.test(process.env.BILLING_MYSQL_CI_CONTAINER ?? "") ||
      parsed.protocol !== "mysql:" || parsed.hostname !== "127.0.0.1" || parsed.port !== "3306" ||
      parsed.pathname !== "/helm_caio_p1d_ci") throw new Error("ephemeral_ci_target_invalid");
  return null;
}

// Synthetic provider IO: an HMAC over the body with a per-run key stands in for the provider signature. No network, no merchant.
const syntheticKey = randomUUID();
const sign = (body: string) => createHmac("sha256", syntheticKey).update(body).digest("hex");
const refs = (mch: string, app: string) => (mch !== "mch-syn" ? null
  : { merchantRef: "merchant:synthetic", appRef: app === "app-syn" ? "app:synthetic" : "app:other" });
const adapter = (provider: "wechat_pay" | "alipay", query: () => WeChatPayTransaction) => defineTopupProviderAdapter(provider, { refs,
  verifyCallback: async ({ headers, rawBody }) => {
    if (headers["x-signature"] !== sign(rawBody)) throw new Error("synthetic_signature_invalid");
    return JSON.parse(rawBody) as WeChatPayTransaction;
  },
  queryOrder: async () => query() });

describe.skipIf(!url)("wallet top-up orders against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const owner = `topup-owner-${run}`, admin = `topup-admin-${run}`, member = `topup-member-${run}`;
  let a: PrismaClient, b: PrismaClient, seq = 0;
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    for (const user of [owner, admin, member]) await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${user},'Synthetic',${`${user}@example.invalid`},NOW(3))`;
  });
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function workspace(mode: "off" | "shadow" | "enforce" = "enforce", bound = true) {
    const ws = `topup-ws-${run}-${(seq += 1)}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic topup',${ws},NOW(3))`;
    for (const [user, role] of [[owner, "OWNER"], [admin, "BILLING_ADMIN"], [member, "MEMBER"]]) await a.$executeRaw`INSERT INTO Membership
      (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}-${role}`},${ws},${user},${role},'ACTIVE',NOW(3))`;
    const payer = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-topup" });
    if (bound) await bindScope(a, { actorUserId: owner, payerAccountId: payer.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "contract:synthetic" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${payer.id}`; // no mode API yet
    return { ws, payerId: payer.id };
  }
  const order = async (amount = 1000, mode: "shadow" | "enforce" = "enforce") => {
    const { ws, payerId } = await workspace(mode);
    return { ...await createTopupOrder(a, { actorUserId: admin, workspaceId: ws, provider: "wechat_pay", amountFen: BigInt(amount),
      merchantRef: "merchant:synthetic", appRef: "app:synthetic" }), payerId };
  };
  type Order = { id: string; providerOrderNo: string; amountFen: bigint };
  const fact = (o: Order, patch: Partial<WeChatPayTransaction> = {}): WeChatPayTransaction => ({ mchid: "mch-syn", appid: "app-syn",
    out_trade_no: o.providerOrderNo, transaction_id: `wx-${o.providerOrderNo.slice(4, 20)}`, trade_state: "SUCCESS",
    amount: { total: Number(o.amountFen), currency: "CNY" }, ...patch });
  const callback = (body: WeChatPayTransaction, client = a, forged = false, rawBody = JSON.stringify(body)) =>
    verifyTopupCallback(client, adapter("wechat_pay", () => body), { headers: { "x-signature": sign(forged ? "other" : rawBody) }, rawBody });
  const query = (o: Order, body: WeChatPayTransaction, client = a, provider: "wechat_pay" | "alipay" = "wechat_pay") =>
    verifyTopupByQuery(client, adapter(provider, () => body), o.id);
  const exceptions = async (key: string) => a.billingOutbox.count({ where: { aggregateType: "PaymentException", aggregateId: key, eventType: "payment_exception" } });
  const wallet = async (payerAccountId: string) => (await a.fundsAccountProjection.findUnique({
    where: { payerAccountId_account: { payerAccountId, account: "customer_wallet_available" } } }))?.balanceFen ?? BigInt(0);
  const effects = async (o: { id: string; payerId: string }) => ({
    state: (await a.paymentOrder.findUniqueOrThrow({ where: { id: o.id } })).state,
    payments: await a.verifiedPayment.count({ where: { paymentOrderId: o.id } }),
    funds: await a.fundsTransaction.count({ where: { payerAccountId: o.payerId } }),
    audits: await a.auditLog.count({ where: { targetId: o.id, actionType: "BILLING_TOPUP_VERIFIED" } }),
    outbox: await a.billingOutbox.count({ where: { aggregateId: o.id } }), wallet: await wallet(o.payerId) });

  it("creates orders only for OWNER/BILLING_ADMIN of a bound shadow/enforce payer", async () => {
    const { ws } = await workspace("shadow");
    const input = { workspaceId: ws, provider: "alipay" as const, amountFen: BigInt(500), merchantRef: "merchant:synthetic", appRef: "app:synthetic" };
    const created = await createTopupOrder(a, { ...input, actorUserId: owner });
    expect(created).toMatchObject({ orderType: "wallet_topup", state: "created", currency: "CNY", createdBy: `USER:${owner}` });
    expect(created.providerOrderNo).toMatch(/^tpa_[0-9a-f]{28}$/);
    await expect(createTopupOrder(a, { ...input, actorUserId: member })).rejects.toThrow("topup_forbidden");
    await expect(createTopupOrder(a, { ...input, workspaceId: (await workspace("off")).ws, actorUserId: admin })).rejects.toThrow("topup_billing_off");
    await expect(createTopupOrder(a, { ...input, workspaceId: (await workspace("enforce", false)).ws, actorUserId: admin })).rejects.toThrow("payer_unresolved");
    expect(await a.paymentOrder.count({ where: { workspaceId: ws } })).toBe(1);
  });
  it("credits a verified callback once; duplicate callbacks and a later query replay", async () => {
    const o = await order(1234);
    expect(await callback(fact(o))).toMatchObject({ outcome: "credited", state: "paid_verified", lateAfterClose: false });
    expect((await callback(fact(o), b)).outcome).toBe("replayed");
    expect((await query(o, fact(o))).outcome).toBe("replayed");
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(1234) });
    const funds = await a.fundsTransaction.findFirstOrThrow({ where: { payerAccountId: o.payerId } });
    expect(funds).toMatchObject({ kind: "topup", operationKey: `topup:wechat_pay:${fact(o).transaction_id}`, evidenceRef: `payment-order:${o.id}` });
  });
  it("rejects forged signatures and wrong merchant, app, amount, currency or provider without crediting", async () => {
    const o = await order(800);
    await expect(callback(fact(o), a, true)).rejects.toThrow("topup_signature_invalid");
    await expect(callback(fact(o, { trade_state: "CLOSED" }), a, true)).rejects.toThrow("topup_signature_invalid");
    await expect(callback(fact(o, { mchid: "mch-other" }))).rejects.toThrow("topup_merchant_mismatch");
    await expect(callback(fact(o, { appid: "app-other" }))).rejects.toThrow("topup_merchant_mismatch");
    await expect(callback(fact(o, { amount: { total: 799, currency: "CNY" } }))).rejects.toThrow("topup_amount_mismatch");
    await expect(callback(fact(o, { amount: { total: 799, currency: "CNY" } }))).rejects.toThrow("topup_amount_mismatch");
    await expect(callback(fact(o, { amount: { total: 800, currency: "USD" } }))).rejects.toThrow("topup_currency_mismatch");
    await expect(query(o, fact(o), a, "alipay")).rejects.toThrow("topup_provider_mismatch");
    expect(await effects(o)).toEqual({ state: "created", payments: 0, funds: 0, audits: 0, outbox: 0, wallet: BigInt(0) });
    // A signed paid report with the wrong amount/currency is kept once for reconciliation; forged ones leave nothing.
    expect(await exceptions(`amount_mismatch:wechat_pay:${fact(o).transaction_id}`)).toBe(1);
    expect(await exceptions(`currency_mismatch:wechat_pay:${fact(o).transaction_id}`)).toBe(1);
  });
  it("lets exactly one of a concurrent callback and query credit", async () => {
    for (let i = 0; i < 4; i += 1) {
      const o = await order(300 + i);
      const results = await Promise.all([callback(fact(o), a), query(o, fact(o), b), callback(fact(o), b)]);
      expect(results.map(r => r.outcome).sort()).toEqual(["credited", "replayed", "replayed"]);
      expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(300 + i) });
    }
  });
  it("credits one of two concurrent provider transactions for one order and records the other once", async () => {
    const o = await order(260);
    const pair = await Promise.allSettled([callback(fact(o, { transaction_id: "wx-race-a" }), a), callback(fact(o, { transaction_id: "wx-race-b" }), b)]);
    expect(pair.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(String((pair.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/topup_order_paid_by_other_txn/);
    const loser = (await a.verifiedPayment.findFirstOrThrow({ where: { paymentOrderId: o.id } })).providerTxnId === "wx-race-a" ? "wx-race-b" : "wx-race-a";
    await expect(callback(fact(o, { transaction_id: loser }))).rejects.toThrow("topup_order_paid_by_other_txn");
    expect(await exceptions(`order_paid_by_other_txn:wechat_pay:${loser}`)).toBe(1);
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(260) });
  });
  it("records unknown and unpaid states without credit and credits a later verified success", async () => {
    const o = await order(450, "shadow");
    expect(await query(o, fact(o, { trade_state: "NOTPAY", transaction_id: undefined }))).toMatchObject({ outcome: "state_recorded", state: "pending" });
    expect(await query(o, fact(o, { trade_state: "ACCEPT" }))).toMatchObject({ outcome: "state_recorded", state: "unknown" });
    expect((await query(o, fact(o, { trade_state: "ACCEPT" }))).outcome).toBe("unchanged");
    expect(await effects(o)).toMatchObject({ state: "unknown", payments: 0, funds: 0, wallet: BigInt(0) });
    expect(await callback(fact(o))).toMatchObject({ outcome: "credited", lateAfterClose: false });
  });
  it("records refund or close news for a credited order once, without touching state or balance", async () => {
    const o = await order(330);
    await callback(fact(o));
    expect((await query(o, fact(o, { trade_state: "REFUND" }))).outcome).toBe("exception_recorded");
    expect((await callback(fact(o, { trade_state: "REFUND" }))).outcome).toBe("unchanged");
    expect((await query(o, fact(o, { trade_state: "CLOSED" }))).outcome).toBe("exception_recorded");
    expect(await exceptions(`paid_then_unknown:wechat_pay:${o.providerOrderNo}`)).toBe(1);
    expect(await exceptions(`paid_then_closed:wechat_pay:${o.providerOrderNo}`)).toBe(1);
    expect(await a.auditLog.count({ where: { targetId: o.id, actionType: "BILLING_TOPUP_PAYMENT_EXCEPTION" } })).toBe(2);
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(330) });
  });
  it("credits a verified success after close exactly once, flagged lateAfterClose", async () => {
    const o = await order(900);
    expect((await query(o, fact(o, { trade_state: "CLOSED" }))).state).toBe("closed_unpaid");
    expect(await callback(fact(o))).toMatchObject({ outcome: "credited", state: "paid_verified", lateAfterClose: true });
    expect(await query(o, fact(o))).toMatchObject({ outcome: "replayed", lateAfterClose: true });
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(900) });
  });
  it("never credits legacy subscription orders and refuses a provider transaction reused across orders", async () => {
    const legacy = { id: "legacy", providerOrderNo: "helm_wx_synthetic_20261110", amountFen: BigInt(100) };
    await expect(callback(fact(legacy))).rejects.toThrow("topup_order_unknown");
    await expect(a.$executeRaw`INSERT INTO PaymentOrder (id,payerAccountId,payerBindingId,workspaceId,orderType,provider,providerOrderNo,
      amountFen,merchantRef,appRef,expiresAt,createdBy,updatedAt) VALUES (${`po-${run}`},'p','b','w','subscription','wechat_pay',
      ${`tpw_${run}${"0".repeat(12)}`},100,'m','a',NOW(3),'x',NOW(3))`).rejects.toThrow(/orderType/);
    const first = await order(200), second = await order(200);
    await callback(fact(first));
    await expect(callback(fact(second, { transaction_id: fact(first).transaction_id }))).rejects.toThrow("topup_txn_conflict");
    expect(await effects(second)).toMatchObject({ state: "created", payments: 0, funds: 0, wallet: BigInt(0) });
    // The database itself keeps verified payments immutable and provider txns unique.
    await expect(a.$executeRaw`UPDATE VerifiedPayment SET amountFen = 1 WHERE paymentOrderId = ${first.id}`).rejects.toThrow(/verified_payment_immutable/);
    await expect(a.$executeRaw`DELETE FROM VerifiedPayment WHERE paymentOrderId = ${first.id}`).rejects.toThrow(/verified_payment_immutable/);
    await expect(a.verifiedPayment.create({ data: { provider: "wechat_pay", providerTxnId: fact(first).transaction_id as string, paymentOrderId: `x-${run}`,
      amountFen: BigInt(1), source: "query", fundsTransactionId: `f-${run}` } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("rolls back order, payment, funds and audit together and keeps a billing-off payment as one exception", async () => {
    const o = await order(650);
    // A pre-existing outbox row makes the final insert fail after every other write of the credit.
    await a.billingOutbox.create({ data: { aggregateType: "PaymentOrder", aggregateId: o.id, eventType: "topup.verified", payload: "{}", payloadHash: "0".repeat(64) } });
    await expect(callback(fact(o))).rejects.toMatchObject({ code: "P2002" });
    expect(await effects(o)).toEqual({ state: "created", payments: 0, funds: 0, audits: 0, outbox: 1, wallet: BigInt(0) });
    const off = await order(720);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${off.payerId}`;
    for (let i = 0; i < 2; i += 1) await expect(callback(fact(off))).rejects.toThrow("payer_billing_off");
    expect(await exceptions(`payer_billing_off:wechat_pay:${fact(off).transaction_id}`)).toBe(1);
    expect(await effects(off)).toMatchObject({ state: "created", payments: 0, funds: 0 });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${off.payerId}`;
    expect((await query(off, fact(off))).outcome).toBe("credited"); // retry/query recovers once the payer is re-enabled
  });
});
