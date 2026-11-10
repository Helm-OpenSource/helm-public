import { createHmac, randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import type { ObservedPayment, TopupProviderAdapter } from "./provider-observation";
import { createTopupOrder, verifyTopupByQuery, verifyTopupCallback, verifyTopupPaymentInTransaction } from "./topup-orders";

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

// Synthetic provider: an HMAC over the body with a per-run key stands in for the provider signature. No network, no merchant.
const syntheticKey = randomUUID();
const sign = (body: string) => createHmac("sha256", syntheticKey).update(body).digest("hex");
type Fact = Omit<ObservedPayment, "source" | "signatureValid" | "amountFen"> & { amountFen: string | null };
function syntheticAdapter(query: (orderNo: string) => Fact): TopupProviderAdapter {
  const toObserved = (fact: Fact, source: "callback" | "query", signatureValid: boolean): ObservedPayment =>
    ({ ...fact, source, signatureValid, amountFen: fact.amountFen === null ? null : BigInt(fact.amountFen) });
  return { provider: "wechat_pay",
    observeCallback: async ({ headers, rawBody }) => toObserved(JSON.parse(rawBody) as Fact, "callback", headers["x-signature"] === sign(rawBody)),
    queryOrder: async orderNo => toObserved(query(orderNo), "query", true) };
}

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
    for (const user of [owner, admin, member]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${user},'Synthetic',${`${user}@example.invalid`},NOW(3))`;
    }
  });
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function workspace(mode: "off" | "shadow" | "enforce" = "enforce", bound = true) {
    const ws = `topup-ws-${run}-${(seq += 1)}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic topup',${ws},NOW(3))`;
    for (const [user, role] of [[owner, "OWNER"], [admin, "BILLING_ADMIN"], [member, "MEMBER"]]) {
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}-${role}`},${ws},${user},${role},'ACTIVE',NOW(3))`;
    }
    const payer = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-topup" });
    if (bound) await bindScope(a, { actorUserId: owner, payerAccountId: payer.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "contract:synthetic" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${payer.id}`; // no mode API yet
    return { ws, payerId: payer.id };
  }
  const order = async (amount = 1000, mode: "shadow" | "enforce" = "enforce") => {
    const { ws, payerId } = await workspace(mode);
    const row = await createTopupOrder(a, { actorUserId: admin, workspaceId: ws, provider: "wechat_pay", amountFen: BigInt(amount),
      merchantRef: "merchant:synthetic", appRef: "app:synthetic" });
    return { ...row, payerId };
  };
  const fact = (o: { providerOrderNo: string; amountFen: bigint }, patch: Partial<Fact> = {}): Fact => ({ merchantRef: "merchant:synthetic",
    appRef: "app:synthetic", providerOrderNo: o.providerOrderNo, providerTxnId: `wx-${o.providerOrderNo.slice(4, 20)}`,
    status: "paid", amountFen: o.amountFen.toString(), currency: "CNY", ...patch });
  const callback = (body: Fact, client = a, forged = false) => {
    const rawBody = JSON.stringify(body);
    return verifyTopupCallback(client, syntheticAdapter(() => body), { headers: { "x-signature": forged ? sign("other") : sign(rawBody) }, rawBody });
  };
  const query = (body: Fact, client = a) => verifyTopupByQuery(client, syntheticAdapter(() => body), body.providerOrderNo);
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
    expect((await query(fact(o))).outcome).toBe("replayed");
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(1234) });
    const funds = await a.fundsTransaction.findFirstOrThrow({ where: { payerAccountId: o.payerId } });
    expect(funds).toMatchObject({ kind: "topup", operationKey: `topup:wechat_pay:${fact(o).providerTxnId}`, evidenceRef: `payment-order:${o.id}` });
  });
  it("rejects forged signatures and wrong merchant, app, amount, currency or provider with nothing written", async () => {
    const o = await order(800);
    await expect(callback(fact(o), a, true)).rejects.toThrow("topup_signature_invalid");
    await expect(callback(fact(o, { merchantRef: "merchant:other" }))).rejects.toThrow("topup_merchant_mismatch");
    await expect(callback(fact(o, { appRef: null }))).rejects.toThrow("topup_merchant_mismatch");
    await expect(callback(fact(o, { amountFen: "799" }))).rejects.toThrow("topup_amount_mismatch");
    await expect(callback(fact(o, { currency: "USD" }))).rejects.toThrow("topup_currency_mismatch");
    await expect(callback(fact(o, { status: "closed" }), a, true)).rejects.toThrow("topup_signature_invalid");
    await expect(a.$transaction(tx => verifyTopupPaymentInTransaction(tx, { provider: "alipay",
      observed: { ...fact(o), amountFen: o.amountFen, source: "query", signatureValid: true } }))).rejects.toThrow("topup_provider_mismatch");
    expect(await effects(o)).toEqual({ state: "created", payments: 0, funds: 0, audits: 0, outbox: 0, wallet: BigInt(0) });
  });
  it("lets exactly one of a concurrent callback and query credit", async () => {
    for (let i = 0; i < 4; i += 1) {
      const o = await order(300 + i);
      const results = await Promise.all([callback(fact(o), a), query(fact(o), b), callback(fact(o), b)]);
      expect(results.map(r => r.outcome).sort()).toEqual(["credited", "replayed", "replayed"]);
      expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(300 + i) });
    }
  });
  it("records unknown and unpaid states without credit and credits a later verified success", async () => {
    const o = await order(450, "shadow");
    expect(await query(fact(o, { status: "not_paid", providerTxnId: null, amountFen: null }))).toMatchObject({ outcome: "state_recorded", state: "pending" });
    expect(await query(fact(o, { status: "unknown" }))).toMatchObject({ outcome: "state_recorded", state: "unknown" });
    expect((await query(fact(o, { status: "unknown" }))).outcome).toBe("unchanged");
    expect(await effects(o)).toMatchObject({ state: "unknown", payments: 0, funds: 0, wallet: BigInt(0) });
    expect(await callback(fact(o))).toMatchObject({ outcome: "credited", lateAfterClose: false });
    expect((await query(fact(o, { status: "closed" }))).outcome).toBe("unchanged"); // a paid order never closes
    expect(await effects(o)).toMatchObject({ state: "paid_verified", payments: 1, wallet: BigInt(450) });
  });
  it("credits a verified success after close exactly once, flagged lateAfterClose", async () => {
    const o = await order(900);
    expect((await query(fact(o, { status: "closed" }))).state).toBe("closed_unpaid");
    expect(await callback(fact(o))).toMatchObject({ outcome: "credited", state: "paid_verified", lateAfterClose: true });
    expect(await query(fact(o))).toMatchObject({ outcome: "replayed", lateAfterClose: true });
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, audits: 1, outbox: 1, wallet: BigInt(900) });
  });
  it("never credits legacy subscription orders and refuses reused or second provider transactions", async () => {
    const legacy = { providerOrderNo: "helm_wx_synthetic_20261110", amountFen: BigInt(100) };
    await expect(callback(fact(legacy))).rejects.toThrow("topup_order_unknown");
    await expect(a.$executeRaw`INSERT INTO PaymentOrder (id,payerAccountId,payerBindingId,workspaceId,orderType,provider,providerOrderNo,
      amountFen,merchantRef,appRef,expiresAt,createdBy,updatedAt) VALUES (${`po-${run}`},'p','b','w','subscription','wechat_pay',
      ${`tpw_${run}${"0".repeat(12)}`},100,'m','a',NOW(3),'x',NOW(3))`).rejects.toThrow(/orderType/);
    const first = await order(200), second = await order(200);
    await callback(fact(first));
    await expect(callback(fact(second, { providerTxnId: fact(first).providerTxnId }))).rejects.toThrow("topup_txn_conflict");
    await expect(callback(fact(first, { providerTxnId: "wx-second-payment" }))).rejects.toThrow("topup_order_paid_by_other_txn");
    expect(await effects(second)).toMatchObject({ state: "created", payments: 0, funds: 0, wallet: BigInt(0) });
    expect(await effects(first)).toMatchObject({ payments: 1, funds: 1, wallet: BigInt(200) });
  });
  it("rolls back order, payment, funds, audit and outbox together when the transaction fails", async () => {
    const o = await order(650);
    await expect(a.$transaction(async tx => {
      await verifyTopupPaymentInTransaction(tx, { provider: "wechat_pay", observed: { ...fact(o), amountFen: o.amountFen, source: "callback", signatureValid: true } });
      throw new Error("synthetic_after_write_failure");
    })).rejects.toThrow("synthetic_after_write_failure");
    expect(await effects(o)).toEqual({ state: "created", payments: 0, funds: 0, audits: 0, outbox: 0, wallet: BigInt(0) });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${o.payerId}`;
    await expect(callback(fact(o))).rejects.toThrow("payer_billing_off"); // stays unverified; provider retries / query later
    expect(await effects(o)).toMatchObject({ state: "created", payments: 0, funds: 0 });
  });
  it("keeps verified payments immutable and provider transactions unique in the database", async () => {
    const o = await order(100);
    await callback(fact(o));
    await expect(a.$executeRaw`UPDATE VerifiedPayment SET amountFen = 1 WHERE paymentOrderId = ${o.id}`).rejects.toThrow(/verified_payment_immutable/);
    await expect(a.$executeRaw`DELETE FROM VerifiedPayment WHERE paymentOrderId = ${o.id}`).rejects.toThrow(/verified_payment_immutable/);
    await expect(a.verifiedPayment.create({ data: { provider: "wechat_pay", providerTxnId: fact(o).providerTxnId as string, paymentOrderId: `x-${run}`,
      amountFen: BigInt(1), source: "query", fundsTransactionId: `f-${run}` } })).rejects.toMatchObject({ code: "P2002" });
  });
});
