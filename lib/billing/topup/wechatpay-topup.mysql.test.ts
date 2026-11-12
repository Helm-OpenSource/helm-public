import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { weChatPayDouble } from "./wechatpay-gateway-fixture";
import { createWeChatPayTopupAdapter, getWeChatPayTopupConfig } from "./wechatpay-topup";
import { createTopupOrder, verifyTopupByQuery } from "./topup-orders";
import { POST as notifyRoute } from "@/app/api/billing/v1/topup-notify/wechatpay/route";

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

// Per-run RSA keys, APIv3 key and an in-process API double: no merchant, no real key, no network.
const double = weChatPayDouble();
const config = getWeChatPayTopupConfig(double.env)!;
const refs = { merchantRef: `wechatpay-mch:${config.merchantId}`, appRef: `wechatpay-app:${config.appId}` };

describe.skipIf(!url)("WeChat Pay wallet top-up notify against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const admin = `wxtop-admin-${run}`;
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
    for (const [key, value] of Object.entries({ ...double.env, HELM_BILLING_TOPUP_WECHATPAY_ENABLED: "true", HELM_FINANCIAL_ACTIONS_ENABLED: "true" })) vi.stubEnv(key, value);
    vi.stubGlobal("fetch", () => { throw new Error("network_forbidden"); }); // the notify path never calls the provider
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function order(amountFen = 1000) {
    const ws = `wxtop-ws-${run}-${(seq += 1)}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic topup',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}`},${ws},${admin},'OWNER','ACTIVE',NOW(3))`;
    const payer = await createPayerAccount(a, { actorUserId: admin, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-wxtop" });
    await bindScope(a, { actorUserId: admin, payerAccountId: payer.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "contract:synthetic" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${payer.id}`;
    const created = await createTopupOrder(a, { actorUserId: admin, workspaceId: ws, provider: "wechat_pay", amountFen: BigInt(amountFen), ...refs });
    return { ...created, payerId: payer.id };
  }
  type Order = Awaited<ReturnType<typeof order>>;
  const trade = (o: Order, patch: Record<string, unknown> = {}) => ({ out_trade_no: o.providerOrderNo,
    transaction_id: `42000000002026${o.providerOrderNo.slice(4, 18)}`, trade_type: "NATIVE", trade_state: "SUCCESS",
    amount: { total: Number(o.amountFen), payer_total: Number(o.amountFen), currency: "CNY", payer_currency: "CNY" }, ...patch });
  const notify = async ({ body, headers }: { body: string; headers: Record<string, string> }) => {
    const response = await notifyRoute(new Request("https://helm.invalid/api/billing/v1/topup-notify/wechatpay", { method: "POST", body, headers }));
    return [response.status, await response.text()] as const;
  };
  const ok = [200, ""] as const, refused = [400, JSON.stringify({ code: "FAIL", message: "失败" })] as const;
  const query = (o: Order, client = a) => verifyTopupByQuery(client, createWeChatPayTopupAdapter(config, double.fetch), o.id);
  const exceptions = (key: string) => a.billingOutbox.count({ where: { aggregateType: "PaymentException", aggregateId: key } });
  const effects = async (o: Order) => ({
    state: (await a.paymentOrder.findUniqueOrThrow({ where: { id: o.id } })).state,
    payments: await a.verifiedPayment.count({ where: { paymentOrderId: o.id } }),
    funds: await a.fundsTransaction.count({ where: { payerAccountId: o.payerId } }),
    wallet: (await a.fundsAccountProjection.findUnique({ where: { payerAccountId_account: { payerAccountId: o.payerId,
      account: "customer_wallet_available" } } }))?.balanceFen ?? BigInt(0) });
  const untouched = { state: "created", payments: 0, funds: 0, wallet: BigInt(0) };

  it("credits a verified notify once; duplicate notifies and a later query replay", async () => {
    const o = await order(1234);
    expect(o.providerOrderNo).toMatch(/^tpw_[0-9a-f]{28}$/);
    expect(await notify(double.notify(trade(o)))).toEqual(ok);
    expect(await notify(double.notify(trade(o)))).toEqual(ok); // WeChat Pay re-sends with fresh headers
    double.trades.set(o.providerOrderNo, { appid: config.appId, mchid: config.merchantId, ...trade(o) });
    expect((await query(o)).outcome).toBe("replayed");
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(1234) });
    expect(await a.verifiedPayment.findFirstOrThrow({ where: { paymentOrderId: o.id } }))
      .toMatchObject({ provider: "wechat_pay", providerTxnId: trade(o).transaction_id, amountFen: BigInt(1234), source: "callback" });
  });

  it("refuses forged, stale or undecryptable notifies, another merchant or app, and subscription order numbers", async () => {
    const o = await order(800);
    for (const input of [double.notify(trade(o), { forge: true }), double.notify(trade(o), { skewSeconds: -301 }),
      double.notify(trade(o), { apiV3Key: "e".repeat(32) }), double.notify(trade(o, { mchid: "1230000110" })),
      double.notify(trade(o, { appid: "wx0000000000000002" })), double.notify(trade(o, { out_trade_no: "helm_wx_synthetic_20261112" })),
      double.notify(trade(o, { out_trade_no: "tpw_ffffffffffffffffffffffffffff" }))]) {
      expect(await notify(input)).toEqual(refused);
    }
    expect(await effects(o)).toEqual(untouched);
    expect(await a.billingOutbox.count({ where: { payload: { contains: o.id } } })).toBe(0);
  });

  it("keeps a verified amount or currency mismatch once for reconciliation and acknowledges it", async () => {
    const o = await order(800);
    const short = trade(o, { amount: { total: 799, payer_total: 799, currency: "CNY" } });
    for (let i = 0; i < 2; i += 1) expect(await notify(double.notify(short))).toEqual(ok);
    expect(await exceptions(`amount_mismatch:wechat_pay:${trade(o).transaction_id}`)).toBe(1);
    expect(await notify(double.notify(trade(o, { amount: { total: 800, currency: "USD" } })))).toEqual(ok);
    expect(await exceptions(`currency_mismatch:wechat_pay:${trade(o).transaction_id}`)).toBe(1);
    expect(await effects(o)).toEqual(untouched);
  });

  it("lets exactly one of concurrent notifies and queries credit", async () => {
    for (let i = 0; i < 3; i += 1) {
      const o = await order(300 + i);
      double.trades.set(o.providerOrderNo, { appid: config.appId, mchid: config.merchantId, ...trade(o) });
      const results = await Promise.all([notify(double.notify(trade(o))), query(o, b), notify(double.notify(trade(o))), query(o, a)]);
      expect([results[0], results[2]]).toEqual([ok, ok]);
      expect([results[1], results[3]].map(r => (r as { outcome: string }).outcome).every(x => x === "credited" || x === "replayed")).toBe(true);
      expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(300 + i) });
    }
  });

  it("never credits a first REFUND state but keeps it before a later query credit; an unknown order queries as pending", async () => {
    const o = await order(500);
    for (let i = 0; i < 2; i += 1) expect(await notify(double.notify(trade(o, { trade_state: "REFUND" })))).toEqual(ok);
    expect(await effects(o)).toEqual({ ...untouched, state: "unknown" });
    double.trades.set(o.providerOrderNo, { appid: config.appId, mchid: config.merchantId, ...trade(o) });
    expect((await query(o)).outcome).toBe("credited");
    expect(await exceptions(`unknown_before_credit:wechat_pay:${o.providerOrderNo}`)).toBe(1);
    const fresh = await order(500);
    expect(await query(fresh)).toMatchObject({ outcome: "state_recorded", state: "pending" }); // ORDER_NOT_EXIST
  });

  it("answers failure for a billing-off payer so WeChat Pay retries, and credits once re-enabled", async () => {
    const o = await order(720);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${o.payerId}`;
    expect((await notify(double.notify(trade(o))))[0]).toBe(503);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${o.payerId}`;
    expect(await notify(double.notify(trade(o)))).toEqual(ok);
    expect(await effects(o)).toEqual({ state: "paid_verified", payments: 1, funds: 1, wallet: BigInt(720) });
  });

  it("is a plain 404 with the gate off and reads nothing", async () => {
    const o = await order(650);
    vi.stubEnv("HELM_BILLING_TOPUP_WECHATPAY_ENABLED", "false");
    try { expect(await notify(double.notify(trade(o)))).toEqual([404, "Not Found"]); }
    finally { vi.stubEnv("HELM_BILLING_TOPUP_WECHATPAY_ENABLED", "true"); }
    expect(await effects(o)).toEqual(untouched);
  });
});
