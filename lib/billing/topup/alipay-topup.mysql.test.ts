import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { alipayDouble } from "./alipay-gateway-fixture";
import { createAlipayTopupAdapter, getAlipayTopupConfig } from "./alipay-topup";
import { createTopupOrder, verifyTopupByQuery } from "./topup-orders";
import { POST as notifyRoute } from "@/app/api/billing/v1/topup-notify/alipay/route";

// The real notify route runs against the isolated database: only the app's client handle is swapped (never DATABASE_URL).
const holder = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/db", () => ({ get db() { return holder.client; } }));
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

// Per-run RSA keys and an in-process gateway double: no merchant, no credential, no network.
const double = alipayDouble();
const config = getAlipayTopupConfig(double.env)!;
const refs = { merchantRef: `alipay-seller:${config.sellerId}`, appRef: `alipay-app:${config.appId}` };

describe.skipIf(!url)("Alipay wallet top-up notify against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const admin = `alitop-admin-${run}`;
  let a: PrismaClient, b: PrismaClient, seq = 0;
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    holder.client = a;
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${admin},'Synthetic',${`${admin}@example.invalid`},NOW(3))`;
    for (const [key, value] of Object.entries({ ...double.env, HELM_BILLING_TOPUP_ALIPAY_ENABLED: "true", HELM_FINANCIAL_ACTIONS_ENABLED: "true" })) vi.stubEnv(key, value);
    vi.stubGlobal("fetch", () => { throw new Error("network_forbidden"); }); // the notify path never calls the provider
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function order(amountFen = 1000) {
    const ws = `alitop-ws-${run}-${(seq += 1)}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic topup',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}`},${ws},${admin},'OWNER','ACTIVE',NOW(3))`;
    const payer = await createPayerAccount(a, { actorUserId: admin, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-alitop" });
    await bindScope(a, { actorUserId: admin, payerAccountId: payer.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "contract:synthetic" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${payer.id}`;
    const created = await createTopupOrder(a, { actorUserId: admin, workspaceId: ws, provider: "alipay", amountFen: BigInt(amountFen), ...refs });
    return { ...created, payerId: payer.id };
  }
  type Order = Awaited<ReturnType<typeof order>>;
  const yuan = (fen: bigint) => `${fen / BigInt(100)}.${(fen % BigInt(100)).toString().padStart(2, "0")}`;
  const trade = (o: Order, patch: Record<string, string> = {}) => ({ out_trade_no: o.providerOrderNo,
    trade_no: `2026111122${o.providerOrderNo.slice(4, 22)}`, trade_status: "TRADE_SUCCESS", total_amount: yuan(o.amountFen), ...patch });
  const notify = async (body: string) => {
    const response = await notifyRoute(new Request("https://helm.invalid/api/billing/v1/topup-notify/alipay", { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" } }));
    return [response.status, await response.text()] as const;
  };
  const query = (o: Order, client = a) => verifyTopupByQuery(client, createAlipayTopupAdapter(config, double.fetch), o.id);
  const exceptions = (key: string) => a.billingOutbox.count({ where: { aggregateType: "PaymentException", aggregateId: key } });
  const effects = async (o: Order) => ({
    state: (await a.paymentOrder.findUniqueOrThrow({ where: { id: o.id } })).state,
    payments: await a.verifiedPayment.count({ where: { paymentOrderId: o.id } }),
    funds: await a.fundsTransaction.count({ where: { payerAccountId: o.payerId } }),
    wallet: (await a.fundsAccountProjection.findUnique({ where: { payerAccountId_account: { payerAccountId: o.payerId,
      account: "customer_wallet_available" } } }))?.balanceFen ?? BigInt(0) });
  const untouched = { state: "created", payments: 0, funds: 0, wallet: BigInt(0) };

  it("credits a signed notify once; duplicates and a later query replay", async () => {
    const o = await order(1234);
    expect(await notify(double.notify(trade(o)))).toEqual([200, "success"]);
    expect(await notify(double.notify(trade(o)))).toEqual([200, "success"]);
    double.trades.set(o.providerOrderNo, { code: "10000", msg: "Success", ...trade(o) });
    expect((await query(o)).outcome).toBe("replayed");
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(1234) });
    expect(await a.verifiedPayment.findFirstOrThrow({ where: { paymentOrderId: o.id } }))
      .toMatchObject({ provider: "alipay", providerTxnId: trade(o).trade_no, amountFen: BigInt(1234), source: "callback" });
  });

  it("refuses forged signatures, another app or seller, and subscription order numbers without crediting", async () => {
    const o = await order(800);
    expect(await notify(double.notify(trade(o), true))).toEqual([400, "fail"]);
    expect(await notify(double.notify({ ...trade(o), app_id: "2021000000000002" }))).toEqual([400, "fail"]);
    expect(await notify(double.notify({ ...trade(o), seller_id: "2088000000000002" }))).toEqual([400, "fail"]);
    expect(await notify(double.notify({ ...trade(o), out_trade_no: "helm_ali_synthetic_20261111" }))).toEqual([400, "fail"]);
    expect(await notify(double.notify({ ...trade(o), out_trade_no: "tpa_ffffffffffffffffffffffffffff" }))).toEqual([400, "fail"]);
    expect(await effects(o)).toEqual(untouched);
    expect(await a.billingOutbox.count({ where: { payload: { contains: o.id } } })).toBe(0);
  });

  it("keeps a signed, identity-matched paid notify it cannot parse once, locatable to the order", async () => {
    const o = await order(1500);
    const { trade_no: _txn, ...noTxn } = trade(o);
    for (const body of [noTxn, trade(o, { total_amount: "15.000" }), trade(o, { trade_no: "has space" })]) {
      expect(await notify(double.notify(body))).toEqual([200, "success"]);
    }
    expect(await exceptions(`observation_invalid:alipay:${o.providerOrderNo}`)).toBe(1);
    expect(await notify(double.notify({ ...noTxn, app_id: "2021000000000002" }))).toEqual([400, "fail"]); // other app: nothing kept
    expect(await effects(o)).toEqual(untouched);
  });

  it("keeps a signed amount mismatch once for reconciliation and acknowledges it", async () => {
    const o = await order(800);
    for (let i = 0; i < 2; i += 1) expect(await notify(double.notify(trade(o, { total_amount: "7.99" })))).toEqual([200, "success"]);
    expect(await exceptions(`amount_mismatch:alipay:${trade(o).trade_no}`)).toBe(1);
    expect(await effects(o)).toEqual(untouched);
  });

  it("lets exactly one of concurrent notifies and queries credit", async () => {
    for (let i = 0; i < 3; i += 1) {
      const o = await order(300 + i);
      double.trades.set(o.providerOrderNo, { code: "10000", msg: "Success", ...trade(o) });
      const results = await Promise.all([notify(double.notify(trade(o))), query(o, b), notify(double.notify(trade(o))), query(o, a)]);
      expect(results.slice(0, 1).concat(results.slice(2, 3))).toEqual([[200, "success"], [200, "success"]]);
      expect([results[1], results[3]].map(r => (r as { outcome: string }).outcome).every(x => x === "credited" || x === "replayed")).toBe(true);
      expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(300 + i) });
    }
  });

  it("credits a success after close once (lateAfterClose) and records later refund news without touching the balance", async () => {
    const o = await order(900);
    expect(await notify(double.notify(trade(o, { trade_status: "TRADE_CLOSED" })))).toEqual([200, "success"]);
    expect((await effects(o)).state).toBe("closed_unpaid");
    expect(await notify(double.notify(trade(o)))).toEqual([200, "success"]);
    expect(await a.verifiedPayment.findFirstOrThrow({ where: { paymentOrderId: o.id } })).toMatchObject({ lateAfterClose: true });
    expect(await notify(double.notify(trade(o, { refund_fee: "1.00", gmt_refund: "2026-11-11 12:00:00" })))).toEqual([200, "success"]);
    expect(await exceptions(`paid_then_unknown:alipay:${o.providerOrderNo}`)).toBe(1);
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(900) });
  });

  it("never credits a first refund notify but keeps it before a later query credit; a missing trade queries as pending", async () => {
    const o = await order(500);
    for (let i = 0; i < 2; i += 1) expect(await notify(double.notify(trade(o, { refund_fee: "5.00" })))).toEqual([200, "success"]);
    expect(await effects(o)).toEqual({ ...untouched, state: "unknown" });
    double.trades.set(o.providerOrderNo, { code: "10000", msg: "Success", ...trade(o) });
    expect((await query(o)).outcome).toBe("credited");
    expect(await exceptions(`unknown_before_credit:alipay:${o.providerOrderNo}`)).toBe(1); // the refund clue survives the credit
    const fresh = await order(500);
    expect(await query(fresh)).toMatchObject({ outcome: "state_recorded", state: "pending" });
  });

  it("answers non-success for a billing-off payer so Alipay retries, and credits once re-enabled", async () => {
    const o = await order(720);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${o.payerId}`;
    expect(await notify(double.notify(trade(o)))).toEqual([503, "fail"]);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${o.payerId}`;
    expect(await notify(double.notify(trade(o)))).toEqual([200, "success"]);
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(720) });
  });

  it("is a plain 404 with the gate off and reads nothing", async () => {
    const o = await order(650);
    vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", "false");
    try { expect(await notify(double.notify(trade(o)))).toEqual([404, "Not Found"]); }
    finally { vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", "true"); }
    expect(await effects(o)).toEqual(untouched);
  });
});
