import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { grantPlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { changeCreditFacility, drawCreditShortfallInTransaction, proposeCreditFacility } from "../credit/credit-facilities";
import { postFundsTransactionInTransaction, recomputeFundsProjection, reverseFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { markUnknown as markUnknownSpend, quote as quoteSpend, release as releaseSpend, type ReleaseReasonCode, reserve as reserveSpend,
  resolveUnknown as resolveSpend, settle as settleSpend } from "./reservations";

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
  const ws = `resv-ws-${run}`, qws = `resv-qws-${run}`, owner = `resv-owner-${run}`;
  const [admin, maker, checker] = ["admin", "maker", "checker"].map(role => `resv-${role}-${run}`);
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
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${qws},'Synthetic quote',${qws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`mq-${owner}`},${qws},${owner},'OWNER','ACTIVE',NOW(3))`;
    // Platform finance maker and checker (S2-c / S3-e) for credit facilities, in the reserved workspace.
    const existing = await a.workspace.findUnique({ where: { systemKey: "helm_reserved_primary" }, select: { id: true } });
    const reserved = existing?.id ?? `resv-reserved-${run}`;
    if (!existing) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,workspaceClass,systemKey,updatedAt)
      VALUES (${reserved},'Synthetic reserved',${reserved},'HELM_RESERVED','helm_reserved_primary',NOW(3))`;
    for (const [userId, role] of [[admin, "OWNER"], [maker, "MEMBER"], [checker, "MEMBER"]]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${userId},'Synthetic',${`${userId}@example.invalid`},NOW(3))`;
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${userId}`},${reserved},${userId},${role},'ACTIVE',NOW(3))`;
    }
    for (const [userId, role] of [[maker, "maker"], [checker, "checker"]] as const) {
      await grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    }
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

  const settle = async (reservationId: string, key: string, quantityUsed: string, evidenceRef = "acceptance:usable", lane = 0, operationRef?: string) =>
    settleSpend(await clocked(earlyDec, lane), service, { idempotencyKey: `idem:${key}`, reservationId,
      operationRef: operationRef ?? await refOf(reservationId), quantityUsed, evidenceRef });
  const balances = async (payerAccountId: string) => Object.fromEntries((await a.fundsAccountProjection.findMany({ where: { payerAccountId } }))
    .map(row => [row.account, row.balanceFen]));
  const settledBuckets = (reserved: number, settled: number) => counted(reserved).map(bucket => ({ ...bucket, settledFen: fen(settled) }));

  it("settles exactly once into the journal, repriced for the used quantity, in the frozen periods", async () => {
    const ids = await setup("enforce", 1000);
    const { reservationId } = await held(ids, "op:1", 3); // 2026-11-30 Shanghai, cap 300
    const first = await settle(reservationId, "set:1", "2"); // settled on 2026-12-01 Shanghai
    expect(first).toMatchObject({ ok: true, state: "settled", chargeFen: "200" });
    const chargeId = first.ok ? first.chargeId : "";
    expect(await settle(reservationId, "set:1", "2")).toEqual(first);
    expect(await settle(reservationId, "set:1", "3")).toEqual(rejected("idempotency_conflict"));
    expect(await settle(reservationId, "set:2", "2")).toEqual(rejected("reservation_state_conflict"));
    expect(await release(reservationId, "rel:1")).toEqual(rejected("reservation_state_conflict"));
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(800), charge_revenue: fen(200), topup_clearing: fen(1000) });
    expect(await buckets(ids)).toEqual(settledBuckets(0, 200)); // no 12-01 / 2026-12 bucket
    const charge = await a.billingCharge.findUniqueOrThrow({ where: { id: chargeId } });
    expect(charge).toMatchObject({ reservationId, quantity: fen(2), chargeFen: fen(200), capFen: fen(300), dayKey: "2026-11-30", monthKey: "2026-11" });
    expect(await a.fundsTransaction.findUniqueOrThrow({ where: { id: charge.fundsTransactionId } })).toMatchObject({ kind: "charge", operationKey: `charge:${reservationId}` });
    expect(await a.billingOutbox.count({ where: { OR: [{ aggregateId: chargeId, eventType: "billing.charge.settled" },
      { aggregateId: charge.fundsTransactionId, eventType: "funds.posted" }] } })).toBe(2);
    expect((await a.$transaction(tx => recomputeFundsProjection(tx, ids.payerAccountId))).consistent).toBe(true);
    await expect(a.$transaction(tx => reverseFundsTransactionInTransaction(tx, { payerAccountId: ids.payerAccountId, originalTransactionId: charge.fundsTransactionId,
      operationKey: "rev:charge", actor: service, evidenceRef: "e" }))).rejects.toThrow("funds_reversal_invalid");
    await expect(a.$executeRaw`UPDATE BillingCharge SET chargeFen = 1 WHERE id = ${chargeId}`).rejects.toThrow(/billing_charge_immutable/);
    await expect(a.$executeRaw`DELETE FROM BillingCharge WHERE id = ${chargeId}`).rejects.toThrow(/billing_charge_immutable/);
    expect(await settle((await held(ids, "op:2", 1)).reservationId, "set:1", "1")).toEqual(rejected("idempotency_conflict")); // key reuse
  });
  it("refuses over-quantity and malformed settles, never settles unknown on the business path, and settles 0 fen without funds", async () => {
    const ids = await setup("enforce", 1000);
    const { reservationId } = await held(ids, "op:1", 3);
    expect(await settle(reservationId, "set:x", "4")).toEqual(rejected("quantity_exceeds_reservation"));
    expect(await settle(reservationId, "set:x", "0")).toEqual(rejected("request_invalid"));
    expect(await settle(reservationId, "set:x", "3", "e", a, "ref:wrong")).toEqual(rejected("idempotency_conflict"));
    expect(await unknown(reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
    expect(await settle(reservationId, "set:1", "3", "acceptance:late-proof")).toEqual(rejected("reservation_state_conflict"));
    expect(await resolve(reservationId, "res:1", "settled", "3")).toMatchObject({ ok: true, chargeFen: "300" }); // reconciliation only
    expect(await buckets(ids)).toEqual(settledBuckets(0, 300));
    const cheap = await setup("enforce", 1000, undefined, () => cheapId);
    const big = await reserve(cheap, "op:c", 3, a, lateNov, cheapId); // 3 x 1/3 fen = 1 fen cap
    const cheapReservation = big.ok && big.mode === "enforce" ? big.reservationId : "";
    const zero = await settle(cheapReservation, "set:c", "1"); // 1/3 fen rounds to 0: settled at 0 (v3.5), nothing posted
    expect(zero).toMatchObject({ ok: true, state: "settled", chargeFen: "0" });
    expect(await a.billingCharge.findUniqueOrThrow({ where: { reservationId: cheapReservation } })).toMatchObject({ chargeFen: fen(0), fundsTransactionId: null });
    expect(await a.fundsTransaction.count({ where: { payerAccountId: cheap.payerAccountId, kind: "charge" } })).toBe(0);
    expect(await buckets(cheap)).toEqual(settledBuckets(0, 0)); // the 1-fen hold left; nothing settled
    expect(await a.billingOutbox.count({ where: { aggregateId: zero.ok ? zero.chargeId : "", eventType: "billing.charge.settled" } })).toBe(1);
  });
  it("refuses an unpayable settle as retryable and still settles held work after suspension or off", async () => {
    const ids = await setup("enforce", 300);
    const { reservationId } = await held(ids, "op:1", 3);
    await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: ids.payerAccountId, kind: "correction", operationKey: "corr:1",
      actor: service, evidenceRef: "correction:synthetic", entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(100) },
        { account: "correction_suspense", direction: "credit", amountFen: fen(100) }] }));
    expect(await settle(reservationId, "set:1", "3")).toEqual(rejected("insufficient_funds"));
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).toMatchObject({ state: "held", resolutionKey: null });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off', status = 'suspended' WHERE id = ${ids.payerAccountId}`;
    expect(await reserve(ids, "op:new", 1)).toEqual(rejected("grant_not_active")); // new work is blocked ...
    expect(await settle(reservationId, "set:1", "2")).toMatchObject({ ok: true, chargeFen: "200" }); // ... delivered work settles (R05)
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(0), charge_revenue: fen(200) });
    const other = await setup("enforce", 500); // a charge posting not backed by a held reservation is not exempt
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${other.payerAccountId}`;
    await expect(a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: other.payerAccountId, kind: "charge",
      operationKey: `charge:${reservationId}`, actor: service, evidenceRef: "e", entries: [{ account: "customer_wallet_available",
        direction: "debit", amountFen: fen(1) }, { account: "charge_revenue", direction: "credit", amountFen: fen(1) }] }))).rejects.toThrow("payer_account_unavailable");
    expect(await buckets(ids)).toEqual(settledBuckets(0, 200));
  });
  it("charges once under a concurrent double settle and lets settle or release win, never both", async () => {
    const ids = await setup("enforce", 1000);
    const { reservationId } = await held(ids, "op:d", 3);
    const pair = await Promise.all([settle(reservationId, "set:a", "3", "e", 0, "ref:op:d"), settle(reservationId, "set:b", "3", "e", 1, "ref:op:d")]);
    expect(pair.filter(result => result.ok)).toHaveLength(1);
    expect(pair).toContainEqual(rejected("reservation_state_conflict"));
    expect(await a.fundsTransaction.count({ where: { payerAccountId: ids.payerAccountId, kind: "charge" } })).toBe(1);
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(700), charge_revenue: fen(300) });
    const race = await held(ids, "op:r", 2);
    const outcome = await Promise.all([settle(race.reservationId, "set:r", "2", "e", 0, "ref:op:r"), release(race.reservationId, "rel:r", "failed", "e", 1, "ref:op:r")]);
    expect(outcome.filter(result => result.ok)).toHaveLength(1);
    const settledWon = outcome[0].ok;
    expect(await a.billingCharge.count({ where: { reservationId: race.reservationId } })).toBe(settledWon ? 1 : 0);
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(settledWon ? 500 : 700) });
    expect(await buckets(ids)).toEqual(settledBuckets(0, settledWon ? 500 : 300));
  });
  const resolve = async (reservationId: string, key: string, outcome: "settled" | "released", quantityUsed?: string) =>
    resolveSpend(await clocked(earlyDec, 0), service, { idempotencyKey: `idem:${key}`, reservationId, operationRef: await refOf(reservationId),
      outcome, quantityUsed, evidenceRef: "reconciliation:synthetic" });
  it("settles shadow reservations as shadow charges only, never touching funds", async () => {
    const ids = await setup("shadow", 0);
    const { reservationId } = await held(ids, "op:s", 3);
    const result = await settle(reservationId, "set:s", "3");
    expect(result).toMatchObject({ ok: true, state: "settled", chargeFen: "300" });
    expect(await a.billingCharge.findUniqueOrThrow({ where: { reservationId } })).toMatchObject({ billingMode: "shadow", fundsTransactionId: null });
    expect(await a.fundsTransaction.count({ where: { payerAccountId: ids.payerAccountId } })).toBe(0);
    expect(await a.fundsAccountProjection.count({ where: { payerAccountId: ids.payerAccountId } })).toBe(0);
    expect(await buckets(ids, "shadow")).toEqual(settledBuckets(0, 300));
    expect(await a.billingOutbox.count({ where: { aggregateId: result.ok ? result.chargeId : "", eventType: "billing.charge.shadow_settled" } })).toBe(1);
  });
  it("resolves only unknown reservations through the reconciliation channel, on evidence", async () => {
    const ids = await setup("enforce", 1000);
    const one = await held(ids, "op:u1", 3), two = await held(ids, "op:u2", 3);
    expect(await resolve(one.reservationId, "res:1", "released")).toEqual(rejected("unknown_resolution_conflict")); // still held
    await unknown(one.reservationId, "unk:1"); await unknown(two.reservationId, "unk:2");
    expect(await resolve(one.reservationId, "res:1", "settled")).toEqual(rejected("request_invalid")); // quantityUsed required
    expect(await resolve(one.reservationId, "res:1", "released", "1")).toEqual(rejected("request_invalid"));
    expect(await resolve(one.reservationId, "res:1", "released")).toEqual({ ok: true, state: "released" });
    expect(await resolve(one.reservationId, "res:1", "released")).toEqual({ ok: true, state: "released" }); // replay
    expect(await resolve(one.reservationId, "res:9", "settled", "1")).toEqual(rejected("unknown_resolution_conflict"));
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: one.reservationId } })).toMatchObject({ releaseReason: "unknown_released" });
    expect(await unknown(one.reservationId, "unk:1")).toEqual({ ok: true, state: "released" }); // markUnknown replay: current state
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${ids.payerAccountId}`; // reconciliation still settles
    expect(await resolve(two.reservationId, "res:2", "settled", "2")).toMatchObject({ ok: true, state: "settled", chargeFen: "200" });
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(800) });
    expect(await buckets(ids)).toEqual(settledBuckets(0, 200));
  });
  it("quotes payer, grant and price version from the workspace binding and fails closed otherwise", async () => {
    const ids = await setup("enforce", 1000);
    const q = async (meterUnit = "document") => quoteSpend(await clocked(midNov, 0), service, {
      subjectScope: { kind: "workspace", workspaceId: qws }, billingEventRef: "service-billing-event-v1:synthetic", meterUnit, quantity: "1" });
    expect(await q()).toEqual(rejected("billing_mode_off")); // unbound workspace: not billed (status quo)
    await bindScope(a, { actorUserId: owner, payerAccountId: ids.payerAccountId, expectedPayerVersion: 1, scopeKind: "workspace",
      scopeRef: qws, evidenceRef: "consent:bind" });
    expect(await q()).toEqual({ ok: true, payerRef: ids.payerAccountId, grantId: ids.grantId, priceVersionId: priceId, mode: "enforce" });
    expect(await q("page")).toEqual(rejected("grant_not_active"));
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${ids.payerAccountId}`;
    expect(await q()).toEqual(rejected("grant_not_active"));
    expect(await reserve(ids, "op:susp", 1)).toEqual(rejected("grant_not_active")); // suspended never runs unbilled
  });
  // S3-w: an active facility; reserve counts its remaining line, settle borrows only the wallet shortfall.
  async function credit(payerAccountId: string, limit: number) {
    const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId, limitFen: fen(limit), validUntil: null,
      operationKey: `credit:${payerAccountId}`, evidenceRef: "owner-ruling:synthetic" });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: facility.id, action: "approve", expectedVersion: 1, evidenceRef: "review:approve" });
    return changeCreditFacility(a, { actorUserId: maker, facilityId: facility.id, action: "activate", expectedVersion: 2, evidenceRef: "review:activate" });
  }
  const draws = (payerAccountId: string) => a.fundsTransaction.count({ where: { payerAccountId, kind: "credit_draw" } });
  const usedFen = async (payerAccountId: string) => (await a.creditFacility.findFirstOrThrow({ where: { payerAccountId } })).usedFen;
  const topup = (payerAccountId: string, amount: number, key: string) => a.$transaction(tx => postFundsTransactionInTransaction(tx, {
    payerAccountId, kind: "topup", operationKey: key, actor: service, evidenceRef: "verified-payment:synthetic",
    entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(amount) }, { account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) }] }));

  it("reserves against wallet plus remaining credit net of holds and borrows only the settle shortfall, once", async () => {
    const ids = await setup("enforce", 100);
    await credit(ids.payerAccountId, 300);
    const big = await held(ids, "op:1", 3); // 100 wallet + 300 credit covers 300
    expect(await reserve(ids, "op:2", 2)).toEqual(rejected("insufficient_funds")); // 400 - 300 held < 200
    const small = await held(ids, "op:3", 1);
    const first = await settle(big.reservationId, "set:1", "3");
    expect(first).toMatchObject({ ok: true, state: "settled", chargeFen: "300" });
    expect(await draws(ids.payerAccountId)).toBe(1); // exactly the 200 shortfall; the wallet nets to 0
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(0), credit_receivable: fen(200), charge_revenue: fen(300) });
    expect(await usedFen(ids.payerAccountId)).toBe(fen(200));
    const drawn = await a.fundsTransaction.findFirstOrThrow({ where: { payerAccountId: ids.payerAccountId, kind: "credit_draw" } });
    expect(drawn).toMatchObject({ operationKey: `credit-draw:reservation:${big.reservationId}`, createdBy: "SYSTEM:synthetic-metering" });
    await topup(ids.payerAccountId, 500, "topup:later"); // the wallet changes before a replay
    expect(await settle(big.reservationId, "set:1", "3")).toEqual(first);
    expect(await draws(ids.payerAccountId)).toBe(1);
    expect(await settle(small.reservationId, "set:3", "1")).toMatchObject({ ok: true, chargeFen: "100" }); // wallet covers: no draw
    expect(await draws(ids.payerAccountId)).toBe(1);
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(400), credit_receivable: fen(200), charge_revenue: fen(400) });
    expect((await a.$transaction(tx => recomputeFundsProjection(tx, ids.payerAccountId))).consistent).toBe(true);
  });
  it("settles holds taken before a reduce or revoke within the approved limit; new reserves see the tightened line", async () => {
    const ids = await setup("enforce", 0);
    const facility = await credit(ids.payerAccountId, 500);
    const one = await held(ids, "op:1", 3), two = await held(ids, "op:2", 2);
    const later = await clocked(earlyDec, 5); // finance acts after reservedAt
    await changeCreditFacility(later, { actorUserId: checker, facilityId: facility.id, action: "reduce", expectedVersion: 3, limitFen: fen(0), evidenceRef: "review:reduce" });
    expect(await settle(one.reservationId, "set:1", "3")).toMatchObject({ ok: true, chargeFen: "300" });
    await changeCreditFacility(later, { actorUserId: checker, facilityId: facility.id, action: "revoke", expectedVersion: 4, evidenceRef: "review:revoke" });
    expect(await settle(two.reservationId, "set:2", "2")).toMatchObject({ ok: true, chargeFen: "200" });
    expect(await a.creditFacility.findUniqueOrThrow({ where: { id: facility.id } })).toMatchObject({ state: "revoked", limitFen: fen(0),
      approvedLimitFen: fen(500), usedFen: fen(500) });
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(0), credit_receivable: fen(500) });
    expect(await reserve(ids, "op:3", 1, 0, earlyDec)).toEqual(rejected("insufficient_funds"));
  });
  it("never draws for a 0-fen or a shadow settle", async () => {
    const cheap = await setup("enforce", 0, undefined, () => cheapId);
    await credit(cheap.payerAccountId, 100);
    const tiny = await reserve(cheap, "op:c", 3, 0, lateNov, cheapId); // 1 fen cap, covered by credit
    expect(await settle(tiny.ok ? tiny.reservationId : "", "set:c", "1")).toMatchObject({ ok: true, chargeFen: "0" });
    const shadow = await setup("shadow", 0);
    await credit(shadow.payerAccountId, 1000);
    expect(await settle((await held(shadow, "op:s", 3)).reservationId, "set:s", "3")).toMatchObject({ ok: true, chargeFen: "300" });
    for (const ids of [cheap, shadow]) {
      expect(await a.fundsTransaction.count({ where: { payerAccountId: ids.payerAccountId } })).toBe(0);
      expect(await usedFen(ids.payerAccountId)).toBe(fen(0));
    }
  });
  it("settles held and unknown work of a suspended, off payer with its shortfall; other draws stay refused", async () => {
    const ids = await setup("enforce", 0);
    await credit(ids.payerAccountId, 1000);
    const one = await held(ids, "op:1", 3), two = await held(ids, "op:2", 2), kept = await held(ids, "op:3", 1);
    await unknown(two.reservationId, "unk:2");
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off', status = 'suspended' WHERE id = ${ids.payerAccountId}`;
    expect(await reserve(ids, "op:new", 1)).toEqual(rejected("grant_not_active"));
    expect(await settle(one.reservationId, "set:1", "3")).toMatchObject({ ok: true, chargeFen: "300" });
    expect(await resolve(two.reservationId, "res:2", "settled", "2")).toMatchObject({ ok: true, chargeFen: "200" });
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(0), credit_receivable: fen(500), charge_revenue: fen(500) });
    const foreign = await held(await setup("enforce", 1000), "op:f", 1); // another payer's open reservation
    const draw = async (sourceRef: string, reservedAt = lateNov, chargeFen = fen(1)) => (await clocked(earlyDec, 0)).$transaction(tx =>
      drawCreditShortfallInTransaction(tx, { payerAccountId: ids.payerAccountId, chargeFen, sourceRef, actor: service, reservedAt }));
    await expect(draw("manual:topup-gap")).rejects.toThrow("payer_account_unavailable"); // free-standing
    await expect(draw(`reservation:${one.reservationId}`)).rejects.toThrow("credit_input_invalid"); // no longer open
    await expect(draw(`reservation:${kept.reservationId}`, earlyDec)).rejects.toThrow("credit_input_invalid"); // not its reservedAt
    await expect(draw(`reservation:${kept.reservationId}`, lateNov, fen(101))).rejects.toThrow("credit_input_invalid"); // above its cap
    await expect(draw(`reservation:${foreign.reservationId}`)).rejects.toThrow("credit_input_invalid");
    expect(await draws(ids.payerAccountId)).toBe(2);
    expect(await settle(kept.reservationId, "set:3", "1")).toMatchObject({ ok: true, chargeFen: "100" });
    expect(await usedFen(ids.payerAccountId)).toBe(fen(600));
  });
  it("lets only the in-line share of two concurrent settles borrow", async () => {
    const ids = await setup("enforce", 100);
    await credit(ids.payerAccountId, 100);
    const one = await held(ids, "op:1", 1), two = await held(ids, "op:2", 1); // 100 wallet + 100 credit covers both
    await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: ids.payerAccountId, kind: "correction", operationKey: "corr:all",
      actor: service, evidenceRef: "correction:synthetic", entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(100) },
        { account: "correction_suspense", direction: "credit", amountFen: fen(100) }] }));
    const pair = await Promise.all([settle(one.reservationId, "set:1", "1", "e", 0), settle(two.reservationId, "set:2", "1", "e", 1)]);
    expect(pair.filter(result => result.ok)).toHaveLength(1);
    expect(pair).toContainEqual(rejected("insufficient_funds"));
    expect(await draws(ids.payerAccountId)).toBe(1);
    expect(await usedFen(ids.payerAccountId)).toBe(fen(100));
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(0), credit_receivable: fen(100), charge_revenue: fen(100) });
    expect(await a.billingReservation.count({ where: { payerAccountId: ids.payerAccountId, state: "held" } })).toBe(1); // retryable
  });
  it("never deadlocks settles across 16 payers on 8 connections, half of them borrowing every charge", async () => {
    const payers = [];
    for (let i = 0; i < 16; i++) {
      const ids = await setup("enforce", i % 2 ? 0 : 100000, [1000, 100000, 100000]);
      if (i % 2) await credit(ids.payerAccountId, 100000);
      payers.push(ids);
    }
    let open: string[] = [];
    for (let round = 0; round < 8; round++) { // each payer reserves a new hold while its previous one settles
      const reserving = Promise.all(payers.map((ids, i) => reserve(ids, `op:x${i}-${round}`, 1, (i + round) % 8)));
      const settling = Promise.all(open.map((reservationId, i) => settle(reservationId, `set:x${i}-${round}`, "1", "e", (i + round + 3) % 8)));
      const [reserved, settled] = await Promise.all([reserving, settling]);
      expect([...reserved, ...settled].filter(result => !result.ok)).toEqual([]);
      open = reserved.map(result => (result.ok ? result.reservationId : ""));
    }
    for (const [i, ids] of payers.entries()) { // 7 settles of 100 fen each: borrowed in full, or paid from the wallet
      expect(await draws(ids.payerAccountId)).toBe(i % 2 ? 7 : 0);
      expect(await balances(ids.payerAccountId)).toMatchObject(i % 2 ? { charge_revenue: fen(700), credit_receivable: fen(700) }
        : { charge_revenue: fen(700), customer_wallet_available: fen(100000 - 700) });
    }
  });
  it("refuses the S2-c and S2-a rollbacks while the charges migration is applied", async () => {
    // CREATE PROCEDURE cannot run over the prepared-statement protocol, so evaluate each file's first guard (the one that must
    // fire before any DDL) as written; the shell runner also executes the whole files against MySQL.
    const guard = async (file: string) => {
      const sql = readFileSync(join(process.cwd(), "prisma/rollback", file), "utf8");
      const body = sql.slice(sql.indexOf("BEGIN")), condition = body.slice(body.indexOf("IF ") + 3, body.indexOf(" THEN"));
      expect(body.slice(body.indexOf(" THEN"), body.indexOf("END IF"))).toContain("later billing migration is applied");
      const [row] = await a.$queryRawUnsafe<Array<{ refused: bigint }>>(`SELECT (${condition}) AS refused`);
      return Number(row.refused);
    };
    expect(await guard("20261110_rollback_billing_bank_receipts.sql")).toBe(1);
    expect(await guard("20261110_rollback_billing_funds_journal.sql")).toBe(1);
    const [kind] = await a.$queryRaw<Array<{ type: string }>>`SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FundsTransaction' AND COLUMN_NAME = 'kind'`;
    expect(kind.type).toBe("enum('topup','correction','bank_topup','charge','credit_draw')");
  });
});
