import { generateKeyPairSync, type KeyObject, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { grantPlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { changeCreditFacility, proposeCreditFacility } from "../credit/credit-facilities";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { billingServiceGrantHash, billingServiceKeyFingerprint, signBillingInternalRequest } from "../internal/service-auth";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { markUnknown, release, reserve, settle } from "../reservations/reservations";
import { getWalletInTransaction } from "../wallet/wallet";
import { readPayerBalanceSummaries } from "./balance-status";
import { POST as balanceStatusRoute } from "@/app/api/internal/billing/v1/balance-status/route";

// The real route runs against the isolated database: only the app's client handle is swapped for it (never DATABASE_URL).
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

describe.skipIf(!url)("balance-status and the balance summary against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 12);
  const owner = `bal-owner-${run}`, [admin, maker, checker] = ["admin", "maker", "checker"].map(role => `bal-${role}-${run}`);
  const event = "service-billing-event-v1:robot_call_minute";
  const settler = { type: "SYSTEM" as const, ref: "synthetic-settler" };
  const MILLION_YUAN = 100_000_000; // fen
  let a: PrismaClient, priceId = "", seq = 0;
  const pins: Record<string, string> = {};
  const keys = new Map<string, KeyObject>();

  async function grant(name: string, scopes: string[]) {
    const pair = generateKeyPairSync("ed25519");
    const row = { id: `${name}-${run}`, issuerRef: "synthetic-astra", scopesJson: JSON.stringify([...scopes].sort()),
      publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(), keyFingerprint: billingServiceKeyFingerprint(pair.publicKey),
      approvalRef: "approval:synthetic", createdBy: "SYSTEM:synthetic-provisioning", validFrom: new Date(Date.now() - 3_600_000),
      validUntil: new Date(Date.now() + 86_400_000) };
    const contentHash = billingServiceGrantHash(row);
    await a.$executeRaw`INSERT INTO BillingServiceGrant (id, issuerRef, scopesJson, publicKeyPem, keyFingerprint, approvalRef,
      createdBy, contentHash, validFrom, validUntil) VALUES (${row.id}, ${row.issuerRef}, ${row.scopesJson}, ${row.publicKeyPem},
      ${row.keyFingerprint}, ${row.approvalRef}, ${row.createdBy}, ${contentHash}, ${row.validFrom}, ${row.validUntil})`;
    keys.set(row.id, pair.privateKey);
    pins[row.id] = contentHash;
    process.env.HELM_BILLING_SERVICE_GRANT_PINS = JSON.stringify(pins);
    return row.id;
  }
  async function call(payload: unknown, grantId: string, options: { key?: KeyObject; path?: string } = {}) {
    const body = Buffer.from(JSON.stringify(payload)), path = "/api/internal/billing/v1/balance-status";
    const timestamp = String(Date.now()), nonce = randomBytes(16).toString("base64url");
    const signature = signBillingInternalRequest(options.key ?? keys.get(grantId)!, { method: "POST", path: options.path ?? path,
      grantId, timestamp, nonce, body });
    const response = await balanceStatusRoute(new Request(`http://core.invalid${path}`, { method: "POST", body, headers: {
      "content-type": "application/json", "x-helm-billing-grant": grantId, "x-helm-billing-timestamp": timestamp,
      "x-helm-billing-nonce": nonce, "x-helm-billing-signature": signature } }));
    return { status: response.status, body: await response.json() };
  }

  /** A workspace bound to its own payer in `mode`, with an optional wallet top-up and an active credit facility. */
  async function payer(mode: "off" | "shadow" | "enforce", walletFen: number, creditFen = 0, creditValidUntil: Date | null = null) {
    const ws = `bal-ws-${run}-${++seq}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic balance',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-bal" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // E1a owns the mode command
    if (walletFen > 0) await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: account.id, kind: "topup",
      operationKey: `topup:${account.id}`, actor: settler, evidenceRef: "verified-payment:synthetic",
      entries: [{ account: "topup_clearing", direction: "debit", amountFen: BigInt(walletFen) },
        { account: "customer_wallet_available", direction: "credit", amountFen: BigInt(walletFen) }] }));
    let facilityId: string | null = null;
    if (creditFen > 0) {
      const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId: account.id, limitFen: BigInt(creditFen),
        validUntil: creditValidUntil, operationKey: `credit:${account.id}`, evidenceRef: "owner-ruling:synthetic" });
      await changeCreditFacility(a, { actorUserId: checker, facilityId: facility.id, action: "approve", expectedVersion: 1, evidenceRef: "review:approve" });
      await changeCreditFacility(a, { actorUserId: maker, facilityId: facility.id, action: "activate", expectedVersion: 2, evidenceRef: "review:activate" });
      facilityId = facility.id;
    }
    const { grant: spend } = await createSpendGrant(a, { actorUserId: owner, payerAccountId: account.id, priceVersionId: priceId,
      operationKey: "grant:bal", evidenceRef: "consent:synthetic", validFrom: new Date("2026-11-01T00:00:00Z"),
      validUntil: new Date("2027-02-01T00:00:00Z"), limits: { perChargeLimitFen: BigInt(10_000), dailyLimitFen: BigInt(1_000_000),
        monthlyLimitFen: BigInt(10_000_000) } });
    await changeSpendGrant(a, { actorUserId: owner, grantId: spend.id, expectedVersion: 1, action: "activate", evidenceRef: "consent:on" });
    await bindScope(a, { actorUserId: owner, payerAccountId: account.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws,
      evidenceRef: "consent:bind" });
    return { ws, payerRef: account.id, grantId: spend.id, facilityId };
  }
  type Payer = Awaited<ReturnType<typeof payer>>;
  const hold = async (p: Payer, key: string, minutes: number, client = a) => {
    const result = await reserve(client, settler, { idempotencyKey: `idem:${key}:${run}`, operationRef: `op:${key}:${run}`,
      payerRef: p.payerRef, grantId: p.grantId, priceVersionId: priceId, billingEventRef: event, meterUnit: "minute", quantity: String(minutes) });
    if (!result.ok) throw new Error(result.code);
    return result.reservationId;
  };
  const resolution = (reservationId: string, key: string) => ({ idempotencyKey: `res:${key}:${run}`, reservationId,
    operationRef: `op:${key}:${run}`, evidenceRef: "cdr:synthetic" });
  const settleUsed = (reservationId: string, key: string, minutes: number, client = a) =>
    settle(client, settler, { ...resolution(reservationId, key), quantityUsed: String(minutes) });
  const summary = async (p: Payer) => {
    const found = (await readPayerBalanceSummaries(a, [p.ws])).get(p.ws)!;
    return { balance: Number(found.balanceFen), headroom: Number(found.headroomFen), arrears: found.arrears, mode: found.billingMode,
      ...(found.payerStatus === "active" ? {} : { status: found.payerStatus }) };
  };
  const moneyRows = async () => [await a.fundsTransaction.count(), await a.billingReservation.count(), await a.creditFacility.count()];

  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    holder.client = a;
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${owner},'Synthetic',${`${owner}@example.invalid`},NOW(3))`;
    const existing = await a.workspace.findUnique({ where: { systemKey: "helm_reserved_primary" }, select: { id: true } });
    const reserved = existing?.id ?? `bal-reserved-${run}`;
    if (!existing) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,workspaceClass,systemKey,updatedAt)
      VALUES (${reserved},'Synthetic reserved',${reserved},'HELM_RESERVED','helm_reserved_primary',NOW(3))`;
    for (const [userId, role] of [[admin, "OWNER"], [maker, "MEMBER"], [checker, "MEMBER"]]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${userId},'Synthetic',${`${userId}@example.invalid`},NOW(3))`;
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${userId}`},${reserved},${userId},${role},'ACTIVE',NOW(3))`;
    }
    for (const [userId, role] of [[maker, "maker"], [checker, "checker"]] as const) {
      await grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    }
    priceId = (await publishPriceVersion(a, { actor: { type: "SYSTEM", ref: "synthetic-catalog" }, productCode: `synthetic.bal${run}`,
      version: 1, meterUnit: "minute", billingEventRef: event, acceptanceRef: "acceptance:synthetic", scopeKind: "workspace",
      unitPriceFenNumerator: BigInt(35), unitPriceDenominator: BigInt(1), effectiveFrom: new Date("2026-11-01T00:00:00Z"),
      effectiveUntil: null, approvalRef: "approval:synthetic" })).priceVersion.id; // 0.35 yuan per minute
    process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED = "true";
  });
  afterAll(async () => {
    delete process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED; delete process.env.HELM_BILLING_SERVICE_GRANT_PINS;
    await a?.$disconnect();
  });

  it("tracks wallet 0 + 1M yuan credit through holds, unknown, full and partial settles and releases", async () => {
    const p = await payer("enforce", 0, MILLION_YUAN);
    expect(await summary(p)).toEqual({ balance: 0, headroom: MILLION_YUAN, arrears: false, mode: "enforce" });
    const r1 = await hold(p, "a1", 10); // cap 350
    const r2 = await hold(p, "a2", 5); // cap 175
    const r3 = await hold(p, "a3", 10);
    expect(await summary(p)).toMatchObject({ balance: 0, headroom: MILLION_YUAN - 875 });
    expect(await markUnknown(a, settler, resolution(r2, "a2"))).toMatchObject({ ok: true, state: "unknown" }); // still held money
    expect(await summary(p)).toMatchObject({ balance: 0, headroom: MILLION_YUAN - 875 });
    expect(await settleUsed(r1, "a1", 10)).toMatchObject({ ok: true, chargeFen: "350" }); // borrows 350: balance down, headroom unchanged
    expect(await summary(p)).toMatchObject({ balance: -350, headroom: MILLION_YUAN - 875 });
    expect(await settleUsed(r3, "a3", 4)).toMatchObject({ ok: true, chargeFen: "140" }); // 210 of the hold comes back
    expect(await summary(p)).toEqual({ balance: -490, headroom: MILLION_YUAN - 490 - 175, arrears: false, mode: "enforce" });
    const r4 = await hold(p, "a4", 3);
    expect(await release(a, settler, { ...resolution(r4, "a4"), reasonCode: "not_executed" })).toMatchObject({ ok: true });
    expect(await summary(p)).toMatchObject({ balance: -490, headroom: MILLION_YUAN - 490 - 175 });

    const service = await grant("astra", ["balance-status", "mark-unknown", "quote", "release", "reserve", "settle"]);
    const before = await moneyRows();
    const answer = await call({ workspaceIds: [p.ws] }, service);
    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ ok: true, results: [{ workspaceId: p.ws, ok: true, billingMode: "enforce", payerStatus: "active", balanceFen: "-490",
      headroomFen: String(MILLION_YUAN - 665), overdraftUsedFen: "0", arrears: false, asOf: expect.stringMatching(/^2\d{3}-.*Z$/) }] });
    expect(Math.abs(Date.parse(answer.body.results[0].asOf) - Date.now())).toBeLessThan(60_000);
    expect(await moneyRows()).toEqual(before); // read-only: no funds, reservation or credit row
    const wallet = await a.$transaction(tx => getWalletInTransaction(tx, { workspaceId: p.ws, actorUserId: owner }));
    expect(wallet).toMatchObject({ availableFen: "0", balanceFen: "-490", headroomFen: String(MILLION_YUAN - 665), arrears: false });
  });

  it("is the reserve admission boundary: headroom 0 is arrears and the next fen is insufficient_funds", async () => {
    const p = await payer("enforce", 100, 250); // 100 wallet + 250 credit
    await hold(p, "b1", 2); // 70 held
    expect(await summary(p)).toEqual({ balance: 100, headroom: 280, arrears: false, mode: "enforce" });
    await hold(p, "b2", 8); // exactly 280: admitted
    expect(await summary(p)).toEqual({ balance: 100, headroom: 0, arrears: true, mode: "enforce" }); // holds do not move the balance
    await expect(hold(p, "b3", 1)).rejects.toThrow("insufficient_funds");
  });

  it("counts a closed or lapsed facility's draws in the balance but never its remaining credit; a non-active payer has none", async () => {
    const revoked = await payer("enforce", 0, 1000);
    expect(await settleUsed(await hold(revoked, "c1", 10), "c1", 10)).toMatchObject({ ok: true });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: revoked.facilityId!, action: "revoke", expectedVersion: 3, evidenceRef: "review:revoke" });
    expect(await summary(revoked)).toEqual({ balance: -350, headroom: 0, arrears: true, mode: "enforce" });

    const reduced = await payer("enforce", 0, 1000); // v3.6: a hold settles past a later reduce, so used may exceed the limit
    const held = await hold(reduced, "c2", 10);
    await changeCreditFacility(a, { actorUserId: checker, facilityId: reduced.facilityId!, action: "reduce", expectedVersion: 3,
      limitFen: BigInt(0), evidenceRef: "review:reduce" });
    expect(await settleUsed(held, "c2", 10)).toMatchObject({ ok: true, chargeFen: "350" });
    expect(await summary(reduced)).toEqual({ balance: -350, headroom: 0, arrears: true, mode: "enforce" }); // never negative credit

    const lapsing = await payer("enforce", 50, 1000, new Date(Date.now() + 4_000));
    expect(await summary(lapsing)).toMatchObject({ headroom: 1050, arrears: false });
    await new Promise(resolve => setTimeout(resolve, 4_500)); // still the active row, now outside its term
    expect(await summary(lapsing)).toEqual({ balance: 50, headroom: 50, arrears: false, mode: "enforce" });

    // Non-active payers keep their numbers (credit remaining 0) and report payerStatus; Overlay stops them like arrears.
    const service = await grant("status", ["balance-status"]);
    const suspended = await payer("enforce", 30, 1000), closed = await payer("enforce", 0, 1000);
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${suspended.payerRef}`;
    await a.$executeRaw`UPDATE PayerAccount SET status = 'closed' WHERE id = ${closed.payerRef}`;
    expect(await summary(suspended)).toEqual({ balance: 30, headroom: 30, arrears: false, mode: "enforce", status: "suspended" });
    expect((await call({ workspaceIds: [suspended.ws, closed.ws] }, service)).body.results).toEqual([
      { workspaceId: suspended.ws, ok: true, billingMode: "enforce", payerStatus: "suspended", balanceFen: "30", headroomFen: "30",
        overdraftUsedFen: "0", arrears: false, asOf: expect.any(String) },
      { workspaceId: closed.ws, ok: true, billingMode: "enforce", payerStatus: "closed", balanceFen: "0", headroomFen: "0",
        overdraftUsedFen: "0", arrears: true, asOf: expect.any(String) }]);
  }, 20_000);

  it("answers every bound payer whatever its mode, unbound workspaces as billing_mode_off, in request order, per payer", async () => {
    const service = await grant("modes", ["balance-status"]);
    const off = await payer("off", 0, MILLION_YUAN), shadow = await payer("shadow", 500), enforce = await payer("enforce", 0, 1000);
    await hold(shadow, "d1", 10); // shadow holds are not money
    await hold(enforce, "d2", 2);
    const unbound = `bal-unbound-${run}`;
    const answer = await call({ workspaceIds: [shadow.ws, unbound, off.ws, enforce.ws] }, service);
    expect(answer).toEqual({ status: 200, body: { ok: true, results: [
      { workspaceId: shadow.ws, ok: true, billingMode: "shadow", payerStatus: "active", balanceFen: "500", headroomFen: "500", overdraftUsedFen: "0", arrears: false, asOf: expect.any(String) },
      { workspaceId: unbound, ok: false, code: "billing_mode_off" },
      { workspaceId: off.ws, ok: true, billingMode: "off", payerStatus: "active", balanceFen: "0", headroomFen: String(MILLION_YUAN), overdraftUsedFen: "0", arrears: false, asOf: expect.any(String) },
      { workspaceId: enforce.ws, ok: true, billingMode: "enforce", payerStatus: "active", balanceFen: "0", headroomFen: "930", overdraftUsedFen: "0", arrears: false, asOf: expect.any(String) },
    ] } });
    const fresh = await payer("off", 0); // bound, no wallet, no credit: arrears is reported; the caller gates only enforce payers
    expect((await call({ workspaceIds: [fresh.ws] }, service)).body.results[0]).toMatchObject({ billingMode: "off", balanceFen: "0", headroomFen: "0", arrears: true });
  });

  it("refuses malformed batches as request_invalid and accepts exactly 50", async () => {
    const service = await grant("shape", ["balance-status"]);
    const invalid = { status: 400, body: { ok: false, code: "request_invalid" } };
    const fifty = Array.from({ length: 50 }, (_, i) => `bal-none-${run}-${i}`);
    for (const body of [{ workspaceIds: [] }, { workspaceIds: [...fifty, `bal-none-${run}-x`] }, { workspaceIds: ["dup-1", "dup-1"] },
      { workspaceIds: ["bad id"] }, { workspaceIds: [7] }, { workspaceIds: ["ok-1"], extra: true }, { workspaceId: "ok-1" }, ["ok-1"]]) {
      expect(await call(body, service)).toEqual(invalid);
    }
    const answer = await call({ workspaceIds: fifty }, service);
    expect(answer.status).toBe(200);
    expect(answer.body.results).toHaveLength(50);
  });

  it("is a plain 404 while the gate is off; refuses a missing scope, the reconciliation grant and a bad signature", async () => {
    const p = await payer("enforce", 10);
    const service = await grant("auth", ["balance-status"]);
    const business = await grant("business", ["mark-unknown", "quote", "release", "reserve", "settle"]);
    const recon = await grant("recon", ["resolve-unknown"]);
    const body = { workspaceIds: [p.ws] };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const value of [undefined, "false", "1"]) {
      if (value === undefined) delete process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED;
      else process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED = value;
      expect(await call(body, service)).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    }
    process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED = "true";
    expect(await a.billingServiceNonce.count({ where: { grantId: service } })).toBe(0);
    const denied = { status: 403, body: { ok: false, code: "service_unauthorized" } };
    const unauthorized = { status: 401, body: { ok: false, code: "service_unauthorized" } };
    expect(await call(body, business)).toEqual(denied);
    expect(await call(body, recon)).toEqual(denied);
    expect(await call(body, service, { key: generateKeyPairSync("ed25519").privateKey })).toEqual(unauthorized);
    expect(await call(body, service, { path: "/api/internal/billing/v1/quote" })).toEqual(unauthorized);
    logged.mockRestore();
    expect((await call(body, service)).status).toBe(200);
    // The scope needs no migration: the DB CHECK takes it beside business scopes, and keeps resolve-unknown alone.
    await expect(grant("mixed", ["balance-status", "resolve-unknown"])).rejects.toThrow(/BillingServiceGrant_scopes|3819/);
  });

  it("reads one consistent snapshot without locks while full settles run concurrently", async () => {
    const p = await payer("enforce", 0, MILLION_YUAN);
    const ids = await Promise.all(Array.from({ length: 12 }, (_, i) => hold(p, `e${i}`, 10)));
    const start = await summary(p);
    expect(start).toMatchObject({ balance: 0, headroom: MILLION_YUAN - 12 * 350 });
    const lanes = await Promise.all(Array.from({ length: 4 }, async () => {
      const client = new PrismaClient({ datasources: { db: { url: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` } } });
      await client.$connect(); return client;
    }));
    try {
      let done = false;
      const reads: Array<{ balance: number; headroom: number }> = [];
      const reader = (async () => { while (!done) reads.push(await summary(p)); })();
      const settled = await Promise.all(ids.map((id, i) => settleUsed(id, `e${i}`, 10, lanes[i % lanes.length])));
      done = true; await reader;
      expect(settled.every(result => result.ok)).toBe(true);
      reads.push(await summary(p));
      expect(reads.length).toBeGreaterThan(2);
      for (const [i, read] of reads.entries()) {
        expect(read.headroom).toBe(start.headroom); // a torn read (hold gone, credit not yet drawn) would move it by 350
        expect(read.balance % 350 === 0).toBe(true);
        if (i > 0) expect(read.balance).toBeLessThanOrEqual(reads[i - 1].balance);
      }
      expect(reads.at(-1)).toMatchObject({ balance: -12 * 350 });

      // A writer holding the payer's row lock does not block the read.
      await lanes[0].$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${p.payerRef} FOR UPDATE`;
        const read = await Promise.race([summary(p), new Promise(resolve => setTimeout(() => resolve("blocked"), 3_000))]);
        expect(read).toMatchObject({ balance: -12 * 350 });
      }, { timeout: 10_000 });
    } finally {
      await Promise.all(lanes.map(client => client.$disconnect()));
    }
  }, 30_000);
});
