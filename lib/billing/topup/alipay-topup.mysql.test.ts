import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { alipayDouble } from "./alipay-gateway-fixture";
import { createAlipayTopupAdapter, getAlipayTopupConfig } from "./alipay-topup";
import { createOrReplayTopupOrder, createTopupOrder, verifyTopupByQuery } from "./topup-orders";
import { POST as createRoute } from "@/app/api/billing/v1/topup-orders/route";
import { POST as notifyRoute } from "@/app/api/billing/v1/topup-notify/alipay/route";

// The real notify route runs against the isolated database: only the app's client handle is swapped (never DATABASE_URL).
const holder = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/db", () => ({ get db() { return holder.client; } }));
const sessionHolder = vi.hoisted(() => ({ session: null as null | { user: { id: string }; workspace: { id: string } } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentWorkspaceSessionOrNull: async () => sessionHolder.session }));
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

  async function payerWorkspace(mode = "enforce") {
    const ws = `alitop-ws-${run}-${(seq += 1)}`, member = `alitop-member-${run}-${seq}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic topup',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${member},'Synthetic',${`${member}@example.invalid`},NOW(3))`;
    for (const [user, role] of [[admin, "OWNER"], [member, "MEMBER"]]) await a.$executeRaw`INSERT INTO Membership
      (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}-${role}`},${ws},${user},${role},'ACTIVE',NOW(3))`;
    const payer = await createPayerAccount(a, { actorUserId: admin, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-alitop" });
    await bindScope(a, { actorUserId: admin, payerAccountId: payer.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "contract:synthetic" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${payer.id}`;
    return { ws, member };
  }
  type CreateBody = { error?: string; replayed?: boolean; payUrl: string; order: { id: string; state: string; amountFen: string } };
  const create = async (ws: string, body: object, key: string | null = `key-${randomUUID()}`, user = admin) => {
    sessionHolder.session = { user: { id: user }, workspace: { id: ws } };
    const response = await createRoute(new Request("https://helm.invalid/api/billing/v1/topup-orders", { method: "POST",
      body: JSON.stringify(body), headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) } }));
    const text = await response.text();
    return { status: response.status, body: (response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text) as CreateBody };
  };
  const orders = (ws: string) => a.paymentOrder.count({ where: { workspaceId: ws } });

  it("creates an order from the session workspace and replays the same Idempotency-Key without a second order", async () => {
    const { ws } = await payerWorkspace();
    const first = await create(ws, { provider: "alipay", amountFen: "12345" }, "replay-key-0001");
    expect(first).toMatchObject({ status: 201, body: { replayed: false, order: { provider: "alipay", state: "created", amountFen: "12345" } } });
    const row = await a.paymentOrder.findUniqueOrThrow({ where: { id: first.body.order.id } });
    expect(row).toMatchObject({ workspaceId: ws, createdBy: `USER:${admin}`, idempotencyKey: "replay-key-0001", ...refs });
    const pay = new URL(first.body.payUrl);
    expect(JSON.parse(pay.searchParams.get("biz_content")!)).toMatchObject({ out_trade_no: row.providerOrderNo, total_amount: "123.45" });
    expect(pay.searchParams.get("notify_url")).toBe("https://helm.example.invalid/api/billing/v1/topup-notify/alipay");
    expect(pay.searchParams.get("biz_content")).not.toContain("passback_params");
    const again = await create(ws, { provider: "alipay", amountFen: "12345" }, "replay-key-0001");
    expect(again).toMatchObject({ status: 200, body: { replayed: true, order: { id: row.id } } });
    expect(await create(ws, { provider: "alipay", amountFen: "12346" }, "replay-key-0001"))
      .toEqual({ status: 409, body: { error: "topup_idempotency_conflict" } });
    expect(await orders(ws)).toBe(1);
    // The same key from another workspace is a different request.
    const other = await payerWorkspace();
    expect((await create(other.ws, { provider: "alipay", amountFen: "12345" }, "replay-key-0001")).status).toBe(201);
  });

  it("serializes concurrent requests with one key into one order", async () => {
    const { ws } = await payerWorkspace();
    sessionHolder.session = { user: { id: admin }, workspace: { id: ws } };
    const request = () => createRoute(new Request("https://helm.invalid/x", { method: "POST", body: JSON.stringify({ provider: "alipay",
      amountFen: "500" }), headers: { "content-type": "application/json", "idempotency-key": "concurrent-key-1" } }));
    const responses = await Promise.all([request(), request(), request(), request()]);
    const bodies = await Promise.all(responses.map(r => r.json() as Promise<{ order: { id: string } }>));
    expect(responses.map(r => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(new Set(bodies.map(b => b.order.id)).size).toBe(1);
    expect(await orders(ws)).toBe(1);
  });

  it("holds the creation limit under concurrent requests with different keys", async () => {
    const { ws } = await payerWorkspace();
    sessionHolder.session = { user: { id: admin }, workspace: { id: ws } };
    const responses = await Promise.all(Array.from({ length: 7 }, (_, i) => createRoute(new Request("https://helm.invalid/x", {
      method: "POST", body: JSON.stringify({ provider: "alipay", amountFen: "100" }),
      headers: { "content-type": "application/json", "idempotency-key": `parallel-key-${i}-000` } }))));
    expect(responses.map(r => r.status).sort()).toEqual([201, 201, 201, 201, 201, 429, 429]);
    expect(await orders(ws)).toBe(5);
  });

  it("refuses without a key, a session or the billing role, for another provider, a bad amount or a billing-off payer", async () => {
    const { ws, member } = await payerWorkspace();
    expect(await create(ws, { provider: "alipay", amountFen: "500" }, null)).toEqual({ status: 400, body: { error: "idempotency_key_required" } });
    expect(await create(ws, { provider: "alipay", amountFen: "500" }, undefined, member)).toEqual({ status: 403, body: { error: "topup_forbidden" } });
    expect(await create(ws, { provider: "wechat_pay", amountFen: "500" })).toEqual({ status: 400, body: { error: "topup_provider_unavailable" } });
    for (const amountFen of ["99", "5000001", "1.5", 500, "-1"]) expect((await create(ws, { provider: "alipay", amountFen })).status).toBe(400);
    expect((await create(ws, { provider: "alipay", amountFen: "500", payerAccountId: "x", merchantRef: "x" })).status).toBe(201); // ignored
    sessionHolder.session = null;
    expect((await createRoute(new Request("https://helm.invalid/x", { method: "POST", body: "{}", headers: { "idempotency-key": "k-000001" } }))).status).toBe(401);
    const off = await payerWorkspace("off");
    expect(await create(off.ws, { provider: "alipay", amountFen: "500" })).toEqual({ status: 409, body: { error: "topup_billing_off" } });
    expect(await orders(off.ws)).toBe(0);
  });

  it("limits a creator to 5 creations a minute and 5 open unpaid orders", async () => {
    const { ws } = await payerWorkspace();
    for (let i = 0; i < 5; i += 1) expect((await create(ws, { provider: "alipay", amountFen: "100" })).status).toBe(201);
    await a.$executeRaw`UPDATE PaymentOrder SET state = 'closed_unpaid' WHERE workspaceId = ${ws}`; // none open: the minute limit alone
    expect(await create(ws, { provider: "alipay", amountFen: "100" })).toEqual({ status: 429, body: { error: "topup_rate_limited" } });
    const later = await payerWorkspace();
    const input = { actorUserId: admin, workspaceId: later.ws, provider: "alipay" as const, amountFen: BigInt(100), ...refs };
    for (let i = 0; i < 5; i += 1) await createOrReplayTopupOrder(a, { ...input, idempotencyKey: `open-key-${i}-0000` });
    // Two minutes on, the minute window is empty but five orders are still open.
    await expect(createOrReplayTopupOrder(a, { ...input, now: new Date(Date.now() + 120_000) })).rejects.toThrow("topup_rate_limited");
    await a.$executeRaw`UPDATE PaymentOrder SET state = 'paid_verified' WHERE workspaceId = ${later.ws} LIMIT 1`;
    expect((await createOrReplayTopupOrder(a, { ...input, now: new Date(Date.now() + 120_000) })).replayed).toBe(false);
  });

  it("answers top-up unavailable and creates nothing while merchant configuration is incomplete", async () => {
    const { ws } = await payerWorkspace();
    const alerts = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_SELLER_ID", "");
    try { expect(await create(ws, { provider: "alipay", amountFen: "500" })).toEqual({ status: 503, body: { error: "topup_unavailable" } }); }
    finally { vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_SELLER_ID", double.env.HELM_BILLING_TOPUP_ALIPAY_SELLER_ID); alerts.mockRestore(); }
    vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", "false");
    try { expect(await create(ws, { provider: "alipay", amountFen: "500" })).toEqual({ status: 404, body: "Not Found" }); }
    finally { vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", "true"); }
    expect(await orders(ws)).toBe(0);
  });

  it("is a plain 404 with the gate off and reads nothing", async () => {
    const o = await order(650);
    vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", "false");
    try { expect(await notify(double.notify(trade(o)))).toEqual([404, "Not Found"]); }
    finally { vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", "true"); }
    expect(await effects(o)).toEqual(untouched);
  });
});
