import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { createPayerAccount } from "../payer/payer-accounts";
import { markUnknown as markUnknownSpend, release as releaseSpend, type ReleaseReasonCode, reserve as reserveSpend } from "./reservations";

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

describe.skipIf(!url)("budget buckets and reservations against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const ws = `resv-ws-${run}`, owner = `resv-owner-${run}`;
  const fen = (value: number) => BigInt(value);
  const service = { type: "SYSTEM" as const, ref: "synthetic-metering" };
  // 2026-11-30 23:59:59.900 in Asia/Shanghai; the next instants below fall on 12-01.
  const lateNov = new Date("2026-11-30T15:59:59.900Z"), earlyDec = new Date("2026-11-30T16:00:00.100Z"), midNov = new Date("2026-11-20T04:00:00Z");
  let a: PrismaClient, priceId = "", cheapId = "";
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic reservations',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${owner},'Synthetic',${`${owner}@example.invalid`},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${owner}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    const publish = (code: string, numerator: number, denominator: number) => publishPriceVersion(a, {
      actor: { type: "SYSTEM", ref: "synthetic-catalog" }, productCode: `synthetic.${code}${run}`, version: 1, meterUnit: "document",
      billingEventRef: "service-billing-event-v1:synthetic", acceptanceRef: "acceptance:synthetic", scopeKind: "workspace",
      unitPriceFenNumerator: fen(numerator), unitPriceDenominator: fen(denominator), effectiveFrom: new Date("2026-11-01T00:00:00Z"),
      effectiveUntil: null, approvalRef: "approval:synthetic" });
    priceId = (await publish("r", 100, 1)).priceVersion.id; // 100 fen per document
    cheapId = (await publish("c", 1, 3)).priceVersion.id; // 1/3 fen per document
  });
  // Entry points run their own transactions; one-connection clients with a pinned session clock stand in for database time.
  const clocks = new Map<string, Promise<PrismaClient>>();
  const clocked = (at: Date, lane: number) => clocks.get(`${+at}:${lane}`) ?? clocks.set(`${+at}:${lane}`, (async () => {
    const client = new PrismaClient({ datasources: { db: { url: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` } } });
    await client.$executeRawUnsafe(`SET timestamp = ${(+at / 1000).toFixed(3)}`); return client; })()).get(`${+at}:${lane}`)!; // fixed dates
  afterAll(async () => { await Promise.all([a?.$disconnect(), ...[...clocks.values()].map(async c => (await c).$disconnect())]); });

  async function setup(mode: "shadow" | "enforce", walletFen: number, limits = [500, 1000, 3000], price = () => priceId) {
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-resv" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // no mode API yet
    if (walletFen > 0) await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: account.id, kind: "topup", operationKey: `topup:${account.id}`,
      actor: service, evidenceRef: "verified-payment:synthetic", entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(walletFen) },
        { account: "customer_wallet_available", direction: "credit", amountFen: fen(walletFen) }] }));
    const [per, day, month] = limits.map(fen);
    const { grant } = await createSpendGrant(a, { actorUserId: owner, payerAccountId: account.id, priceVersionId: price(),
      operationKey: "grant:resv", evidenceRef: "consent:synthetic", validFrom: new Date("2026-11-01T00:00:00Z"),
      validUntil: new Date("2027-02-01T00:00:00Z"), limits: { perChargeLimitFen: per, dailyLimitFen: day, monthlyLimitFen: month } });
    await changeSpendGrant(a, { actorUserId: owner, grantId: grant.id, expectedVersion: 1, action: "activate", evidenceRef: "consent:on" });
    return { payerAccountId: account.id, grantId: grant.id };
  }
  type Ids = Awaited<ReturnType<typeof setup>>;
  const reserve = async (ids: Ids, key: string, quantity: number, lane = 0, at = lateNov, priceVersionId = priceId, operationRef = `ref:${key}`) =>
    reserveSpend(await clocked(at, lane), service, { idempotencyKey: `idem:${key}`, operationRef, payerRef: ids.payerAccountId,
      grantId: ids.grantId, priceVersionId, billingEventRef: "service-billing-event-v1:synthetic", meterUnit: "document", quantity: String(quantity) });
  const held = async (ids: Ids, key: string, quantity: number, lane = 0, at = lateNov) => {
    const result = await reserve(ids, key, quantity, lane, at); if (!result.ok) throw new Error(JSON.stringify(result)); return result; };
  const refOf = async (id: string) => (await a.billingReservation.findUniqueOrThrow({ where: { id } })).operationRef;
  const release = async (reservationId: string, key: string, reasonCode: ReleaseReasonCode = "failed", evidenceRef = "claim:failed", lane = 0, operationRef?: string) =>
    releaseSpend(await clocked(earlyDec, lane), service, { idempotencyKey: `idem:${key}`, reservationId, operationRef: operationRef ?? await refOf(reservationId), reasonCode, evidenceRef });
  const unknown = async (reservationId: string, key: string, evidenceRef = "claim:timeout") =>
    markUnknownSpend(a, service, { idempotencyKey: `idem:${key}`, reservationId, evidenceRef, operationRef: await refOf(reservationId) });
  const rejected = (code: string) => ({ ok: false, code });
  const buckets = (ids: Ids, billingMode: "shadow" | "enforce" = "enforce") => a.budgetBucket.findMany({ where: { grantId: ids.grantId, billingMode }, orderBy: [{ periodKind: "asc" }, { periodKey: "asc" }],
    select: { periodKind: true, periodKey: true, reservedFen: true, settledFen: true } });
  const counted = (reserved: number) => [{ periodKind: "day", periodKey: "2026-11-30", reservedFen: fen(reserved), settledFen: fen(0) },
    { periodKind: "month", periodKey: "2026-11", reservedFen: fen(reserved), settledFen: fen(0) }];

  it("freezes database time, period keys, price and cap; replays the key and refuses other content", async () => {
    const ids = await setup("enforce", 1000);
    const price = await a.billingPriceVersion.findUniqueOrThrow({ where: { id: priceId } });
    const first = await held(ids, "op:1", 3);
    expect(first).toMatchObject({ ok: true, mode: "enforce", state: "held", capFen: "300", priceContentHash: price.contentHash,
      periodKeys: { day: "2026-11-30", month: "2026-11" } });
    const id = first.reservationId;
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id } })).toMatchObject({ reservedAt: lateNov, quantity: fen(3),
      chargeFen: fen(300), grantVersion: 2, createdBy: "SYSTEM:synthetic-metering" });
    expect(await reserve(ids, "op:1", 3, 1, earlyDec)).toEqual(first); // replay on another day keeps the frozen keys
    expect(await reserve(ids, "op:1", 4)).toEqual(rejected("idempotency_conflict"));
    expect(await reserve(ids, "op:other", 3, 0, lateNov, priceId, "ref:op:1")).toEqual(rejected("idempotency_conflict")); // one per operationRef
    expect(await buckets(ids)).toEqual(counted(300));
    await expect(a.$executeRaw`UPDATE BillingReservation SET chargeFen = 1, state = 'released', releaseReason = 'failed', resolutionKey = 'x', resolutionEvidenceRef = 'x', resolvedBy = 'x', resolvedAt = NOW(3), version = version + 1 WHERE id = ${id}`).rejects.toThrow(/billing_reservation_snapshot_immutable/);
    await expect(a.$executeRaw`UPDATE BillingReservation SET dayKey = '2026-12-01', state = 'unknown', unknownKey = 'x', unknownEvidenceRef = 'x', unknownAt = NOW(3), version = version + 1 WHERE id = ${id}`).rejects.toThrow(/billing_reservation_snapshot_immutable/);
    await expect(a.$executeRaw`DELETE FROM BillingReservation WHERE id = ${id}`).rejects.toThrow(/billing_reservation_retained/);
    await expect(a.$executeRaw`UPDATE BudgetBucket SET reservedFen = 0 WHERE grantId = ${ids.grantId}`).rejects.toThrow(/budget_bucket_identity_immutable/);
    await expect(a.$executeRaw`DELETE FROM BudgetBucket WHERE grantId = ${ids.grantId}`).rejects.toThrow(/budget_bucket_retained/);
  });
  it("counts held fen against daily and monthly limits and fails closed with no partial write", async () => {
    const ids = await setup("enforce", 100000, [500, 800, 1000]);
    await held(ids, "op:a", 5);
    expect(await reserve(ids, "op:b", 4)).toEqual(rejected("limit_exceeded")); // 500 held + 400 > 800 daily
    await held(ids, "op:c", 3);
    expect(await reserve(ids, "op:d", 3, 0, midNov)).toEqual(rejected("limit_exceeded")); // other day, same month: 800 + 300 > 1000
    expect(await reserve(ids, "op:e", 6)).toEqual(rejected("limit_exceeded")); // per charge
    expect(await buckets(ids)).toEqual(counted(800));
    expect(await a.billingReservation.count({ where: { grantId: ids.grantId } })).toBe(2);
  });
  it("needs enforce wallet balance net of open holds; shadow runs the lifecycle without money; zero-fen and off refuse", async () => {
    const ids = await setup("enforce", 500);
    await held(ids, "op:1", 3);
    expect(await reserve(ids, "op:2", 3)).toEqual(rejected("insufficient_funds")); // 500 - 300 held < 300
    await held(ids, "op:2", 2); // a rejected request never consumes its idempotencyKey
    expect(await buckets(ids)).toEqual(counted(500));
    expect(await reserve(await setup("enforce", 0), "op:x", 1)).toEqual(rejected("insufficient_funds"));
    const shadow = await setup("shadow", 0);
    const price = await a.billingPriceVersion.findUniqueOrThrow({ where: { id: priceId } });
    const quoted = await held(shadow, "op:s", 4); // no wallet needed
    expect(quoted).toMatchObject({ ok: true, mode: "shadow", state: "held", capFen: "400", wouldChargeFen: "400", priceContentHash: price.contentHash });
    expect(await reserve(shadow, "op:s2", 6)).toEqual(rejected("limit_exceeded")); // shadow still evaluates the grant limits
    expect(await buckets(shadow, "shadow")).toEqual(counted(400));
    expect(await buckets(shadow)).toEqual([]); // shadow counters never consume enforce limits
    expect(await release(quoted.reservationId, "rel:s", "partial_unusable")).toEqual({ ok: true, state: "released" });
    expect(await buckets(shadow, "shadow")).toEqual(counted(0));
    expect(await a.fundsTransaction.count({ where: { payerAccountId: shadow.payerAccountId } })).toBe(0);
    expect(await reserve(await setup("shadow", 0, undefined, () => cheapId), "op:z", 1, 0, lateNov, cheapId)).toEqual(rejected("grant_charge_zero"));
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${shadow.payerAccountId}`;
    expect(await reserve(shadow, "op:off", 1)).toEqual(rejected("billing_mode_off"));
    expect(await reserve(ids, "op:bad", 0)).toEqual(rejected("request_invalid"));
  });
  it("releases into the frozen periods only, replays, and keeps released terminal", async () => {
    const ids = await setup("enforce", 1000, [1000, 1000, 3000]);
    const { reservationId } = await held(ids, "op:1", 3);
    expect(await release(reservationId, "rel:1")).toEqual({ ok: true, state: "released" }); // runs on 12-01 Shanghai time
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).toMatchObject({ state: "released",
      releaseReason: "failed", resolvedAt: earlyDec, resolvedBy: "SYSTEM:synthetic-metering" });
    expect(await buckets(ids)).toEqual(counted(0)); // no 12-01 bucket was touched or created
    expect(await release(reservationId, "rel:1")).toEqual({ ok: true, state: "released" });
    expect(await release(reservationId, "rel:1", "not_executed")).toEqual(rejected("idempotency_conflict"));
    expect(await release(reservationId, "rel:2", "not_executed")).toEqual(rejected("reservation_state_conflict"));
    expect(await unknown(reservationId, "unk:1")).toEqual(rejected("reservation_state_conflict"));
    expect(await release(reservationId, "rel:3", "failed", "e", 0, "ref:wrong")).toEqual(rejected("idempotency_conflict"));
    expect(await release("missing-reservation", "rel:4", "failed", "e", 0, "ref:x")).toEqual(rejected("reservation_state_conflict"));
    await expect(a.$executeRaw`UPDATE BillingReservation SET state = 'held', releaseReason = NULL, resolutionKey = NULL, resolutionEvidenceRef = NULL, resolvedBy = NULL, resolvedAt = NULL, version = version + 1 WHERE id = ${reservationId}`).rejects.toThrow(/billing_reservation_snapshot_immutable/);
    const second = await held(ids, "op:2", 10); // the released 300 no longer counts: 1000 wallet covers 1000
    expect(await release(second.reservationId, "rel:1")).toEqual(rejected("idempotency_conflict")); // key used by another reservation
  });
  it("keeps an unknown outcome reserved and counted; business release cannot free it", async () => {
    const ids = await setup("enforce", 600);
    const { reservationId } = await held(ids, "op:1", 5);
    expect(await unknown(reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
    expect(await unknown(reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
    expect(await unknown(reservationId, "unk:1", "claim:other")).toEqual(rejected("idempotency_conflict"));
    expect(await unknown(reservationId, "unk:2")).toEqual(rejected("reservation_state_conflict"));
    expect(await buckets(ids)).toEqual(counted(500));
    expect(await reserve(ids, "op:2", 2)).toEqual(rejected("insufficient_funds")); // the unknown hold still blocks funds
    expect(await release(reservationId, "rel:1", "not_executed", "claim:void-proof")).toEqual(rejected("reservation_state_conflict"));
    await expect(a.$executeRaw`UPDATE BillingReservation SET state = 'released', releaseReason = 'failed', resolutionKey = 'k', resolutionEvidenceRef = 'e', resolvedBy = 'x', resolvedAt = NOW(3), version = version + 1 WHERE id = ${reservationId}`).rejects.toThrow(/billing_reservation_snapshot_immutable/);
    expect(await buckets(ids)).toEqual(counted(500)); // only resolveUnknown (S3-b2, reason unknown_released) frees it
    expect(await unknown((await held(ids, "op:3", 1)).reservationId, "unk:1")).toEqual(rejected("idempotency_conflict")); // same payer
    expect(await unknown((await held(await setup("enforce", 600), "op:1", 1)).reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
  });
  it("never deadlocks first reserves across 16 payers on 8 connections", async () => {
    const payers = [];
    for (let i = 0; i < 16; i++) payers.push(await setup("enforce", 100000, [1000, 100000, 100000]));
    for (let round = 0; round < 4; round++) { // 8 one-connection lanes
      const results = await Promise.all(payers.map((ids, i) => reserve(ids, `op:m${i}-${round}`, 1, (i + round) % 8)));
      expect(results.filter(result => !result.ok)).toEqual([]);
    }
  });
  it("admits exactly the in-limit share of concurrent reserves on two connections", async () => {
    const ids = await setup("enforce", 100000, [100, 700, 3000]);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserve(ids, `op:c${i}`, 1, i % 2)));
    expect(results.filter(result => result.ok)).toHaveLength(7);
    expect(results.filter(result => !result.ok)).toEqual(Array.from({ length: 5 }, () => rejected("limit_exceeded")));
    expect(await buckets(ids)).toEqual(counted(700));
  });
  it("lets one of two concurrent releases win and creates one row for a racing key", async () => {
    const ids = await setup("enforce", 1000);
    const twin = await Promise.all([held(ids, "op:twin", 2, 0), held(ids, "op:twin", 2, 1)]);
    expect(twin[0]).toEqual(twin[1]);
    expect(await a.billingReservation.count({ where: { payerAccountId: ids.payerAccountId } })).toBe(1);
    const id = twin[0].reservationId;
    await expect(a.$executeRaw`UPDATE BillingReservation SET state = 'released', releaseReason = 'unknown_released', resolutionKey = 'k', resolutionEvidenceRef = 'e', resolvedBy = 'x', resolvedAt = NOW(3), version = version + 1 WHERE id = ${id}`).rejects.toThrow(/billing_reservation_snapshot_immutable/);
    const pair = await Promise.all([release(id, "rel:a", "not_executed", "e1", 0, "ref:op:twin"), release(id, "rel:b", "failed", "e2", 1, "ref:op:twin")]);
    expect(pair).toEqual(expect.arrayContaining([{ ok: true, state: "released" }, rejected("reservation_state_conflict")]));
    expect(await buckets(ids)).toEqual(counted(0));
  });
});
