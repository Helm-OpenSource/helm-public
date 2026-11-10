import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postFundsTransactionInTransaction, recomputeFundsProjection, reverseFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { asBillingResult, markUnknownInTransaction, quoteInTransaction, releaseInTransaction, type ReleaseReasonCode,
  reserveInTransaction, resolveUnknownInTransaction, settleInTransaction } from "./reservations";

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
  const fen = (value: number) => BigInt(value);
  const service = { type: "SYSTEM" as const, ref: "synthetic-metering" };
  // 2026-11-30 23:59:59.900 in Asia/Shanghai; the next instants below fall on 12-01.
  const lateNov = new Date("2026-11-30T15:59:59.900Z"), earlyDec = new Date("2026-11-30T16:00:00.100Z"), midNov = new Date("2026-11-20T04:00:00Z");
  let a: PrismaClient, b: PrismaClient, priceId = "", cheapId = "";
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic reservations',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${owner},'Synthetic',${`${owner}@example.invalid`},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${owner}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${qws},'Synthetic quote',${qws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`mq-${owner}`},${qws},${owner},'OWNER','ACTIVE',NOW(3))`;
    const publish = (code: string, numerator: number, denominator: number) => publishPriceVersion(a, {
      actor: { type: "SYSTEM", ref: "synthetic-catalog" }, productCode: `synthetic.${code}${run}`, version: 1, meterUnit: "document",
      billingEventRef: "service-billing-event-v1:synthetic", acceptanceRef: "acceptance:synthetic", scopeKind: "workspace",
      unitPriceFenNumerator: fen(numerator), unitPriceDenominator: fen(denominator), effectiveFrom: new Date("2026-11-01T00:00:00Z"),
      effectiveUntil: null, approvalRef: "approval:synthetic" });
    priceId = (await publish("r", 100, 1)).priceVersion.id; // 100 fen per document
    cheapId = (await publish("c", 1, 3)).priceVersion.id; // 1/3 fen per document
  });
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  /** Pins the session clock (UTC_TIMESTAMP) for one transaction; the service never accepts a caller time. */
  const atClock = <T>(client: PrismaClient, at: Date, body: (tx: Prisma.TransactionClient) => Promise<T>) =>
    client.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET timestamp = ${(at.getTime() / 1000).toFixed(3)}`); // fixed synthetic dates only
      try { return await body(tx); } finally { await tx.$executeRaw`SET timestamp = DEFAULT`; }
    }, { timeout: 15000 });
  async function setup(mode: "shadow" | "enforce", walletFen: number, limits = [500, 1000, 3000], price = () => priceId) {
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-resv" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // no mode API yet
    if (walletFen > 0) {
      await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: account.id, kind: "topup", operationKey: `topup:${account.id}`,
        actor: service, evidenceRef: "verified-payment:synthetic", entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(walletFen) },
          { account: "customer_wallet_available", direction: "credit", amountFen: fen(walletFen) }] }));
    }
    const [per, day, month] = limits.map(fen);
    const { grant } = await createSpendGrant(a, { actorUserId: owner, payerAccountId: account.id, priceVersionId: price(),
      operationKey: "grant:resv", evidenceRef: "consent:synthetic", validFrom: new Date("2026-11-01T00:00:00Z"),
      validUntil: new Date("2027-02-01T00:00:00Z"), limits: { perChargeLimitFen: per, dailyLimitFen: day, monthlyLimitFen: month } });
    await changeSpendGrant(a, { actorUserId: owner, grantId: grant.id, expectedVersion: 1, action: "activate", evidenceRef: "consent:on" });
    return { payerAccountId: account.id, grantId: grant.id };
  }
  type Ids = Awaited<ReturnType<typeof setup>>;
  const reserve = (ids: Ids, key: string, quantity: number, client = a, at = lateNov, priceVersionId = priceId) =>
    asBillingResult(atClock(client, at, tx => reserveInTransaction(tx, service, { idempotencyKey: `idem:${key}`, operationRef: `ref:${key}`,
      payerRef: ids.payerAccountId, grantId: ids.grantId, priceVersionId, billingEventRef: "service-billing-event-v1:synthetic",
      meterUnit: "document", quantity: String(quantity) })));
  const held = async (ids: Ids, key: string, quantity: number, client = a, at = lateNov) => {
    const result = await reserve(ids, key, quantity, client, at);
    if (!result.ok) throw new Error(`reserve_failed:${JSON.stringify(result)}`);
    return result;
  };
  const release = (reservationId: string, key: string, reasonCode: ReleaseReasonCode = "failed", evidenceRef = "claim:failed", client = a, operationRef?: string) =>
    asBillingResult(atClock(client, earlyDec, async tx => releaseInTransaction(tx, service, { idempotencyKey: `idem:${key}`, reservationId,
      operationRef: operationRef ?? (await tx.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).operationRef, reasonCode, evidenceRef })));
  const unknown = (reservationId: string, key: string, evidenceRef = "claim:timeout") => asBillingResult(a.$transaction(async tx =>
    markUnknownInTransaction(tx, service, { idempotencyKey: `idem:${key}`, reservationId, evidenceRef,
      operationRef: (await tx.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).operationRef })));
  const rejected = (code: string) => ({ ok: false, code });
  const buckets = (ids: Ids, billingMode: "shadow" | "enforce" = "enforce") => a.budgetBucket.findMany({ where: { grantId: ids.grantId, billingMode }, orderBy: [{ periodKind: "asc" }, { periodKey: "asc" }],
    select: { periodKind: true, periodKey: true, reservedFen: true, settledFen: true } });
  const counted = (reserved: number, day = "2026-11-30", month = "2026-11") => [
    { periodKind: "day", periodKey: day, reservedFen: fen(reserved), settledFen: fen(0) },
    { periodKind: "month", periodKey: month, reservedFen: fen(reserved), settledFen: fen(0) }];

  it("freezes database time, period keys, price and cap; replays the key and refuses other content", async () => {
    const ids = await setup("enforce", 1000);
    const price = await a.billingPriceVersion.findUniqueOrThrow({ where: { id: priceId } });
    const first = await held(ids, "op:1", 3);
    expect(first).toMatchObject({ ok: true, mode: "enforce", state: "held", capFen: "300", priceContentHash: price.contentHash,
      periodKeys: { day: "2026-11-30", month: "2026-11" } });
    const id = first.reservationId;
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id } })).toMatchObject({ reservedAt: lateNov, quantity: fen(3),
      chargeFen: fen(300), grantVersion: 2, createdBy: "SYSTEM:synthetic-metering" });
    expect(await reserve(ids, "op:1", 3, b, earlyDec)).toEqual(first); // replay on another day keeps the frozen keys
    expect(await reserve(ids, "op:1", 4)).toEqual(rejected("idempotency_conflict"));
    const sameRef = await asBillingResult(atClock(a, lateNov, tx => reserveInTransaction(tx, service, { idempotencyKey: "idem:other",
      operationRef: "ref:op:1", payerRef: ids.payerAccountId, grantId: ids.grantId, priceVersionId: priceId,
      billingEventRef: "service-billing-event-v1:synthetic", meterUnit: "document", quantity: "3" })));
    expect(sameRef).toEqual(rejected("idempotency_conflict")); // one reservation per operationRef, whatever the key
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
    expect(await reserve(ids, "op:d", 3, a, midNov)).toEqual(rejected("limit_exceeded")); // other day, same month: 800 + 300 > 1000
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
    expect(await reserve(await setup("shadow", 0, undefined, () => cheapId), "op:z", 1, a, lateNov, cheapId)).toEqual(rejected("grant_charge_zero"));
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
    expect(await release(reservationId, "rel:3", "failed", "e", a, "ref:wrong")).toEqual(rejected("idempotency_conflict"));
    expect(await release("missing-reservation", "rel:4", "failed", "e", a, "ref:x")).toEqual(rejected("reservation_state_conflict"));
    await expect(a.$executeRaw`UPDATE BillingReservation SET state = 'held', releaseReason = NULL, resolutionKey = NULL, resolutionEvidenceRef = NULL, resolvedBy = NULL, resolvedAt = NULL, version = version + 1 WHERE id = ${reservationId}`).rejects.toThrow(/billing_reservation_snapshot_immutable/);
    await held(ids, "op:2", 10); // the released 300 no longer counts: 1000 wallet covers 1000
  });
  it("keeps an unknown outcome reserved and counted until evidence releases it", async () => {
    const ids = await setup("enforce", 600);
    const { reservationId } = await held(ids, "op:1", 5);
    expect(await unknown(reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
    expect(await unknown(reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
    expect(await unknown(reservationId, "unk:1", "claim:other")).toEqual(rejected("idempotency_conflict"));
    expect(await unknown(reservationId, "unk:2")).toEqual(rejected("reservation_state_conflict"));
    expect(await buckets(ids)).toEqual(counted(500));
    expect(await reserve(ids, "op:2", 2)).toEqual(rejected("insufficient_funds")); // the unknown hold still blocks funds
    expect(await release(reservationId, "rel:1", "not_executed", "claim:void-proof")).toEqual({ ok: true, state: "released" });
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).toMatchObject({ unknownEvidenceRef: "claim:timeout" });
    expect(await buckets(ids)).toEqual(counted(0));
  });
  it("admits exactly the in-limit share of concurrent reserves on two connections", async () => {
    const ids = await setup("enforce", 100000, [100, 700, 3000]);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserve(ids, `op:c${i}`, 1, i % 2 ? b : a)));
    expect(results.filter(result => result.ok)).toHaveLength(7);
    expect(results.filter(result => !result.ok)).toEqual(Array.from({ length: 5 }, () => rejected("limit_exceeded")));
    expect(await buckets(ids)).toEqual(counted(700));
  });
  it("lets one of two concurrent releases win and creates one row for a racing key", async () => {
    const ids = await setup("enforce", 1000);
    const twin = await Promise.all([held(ids, "op:twin", 2, a), held(ids, "op:twin", 2, b)]);
    expect(twin[0]).toEqual(twin[1]);
    expect(await a.billingReservation.count({ where: { payerAccountId: ids.payerAccountId } })).toBe(1);
    const id = twin[0].reservationId;
    const pair = await Promise.all([release(id, "rel:a", "not_executed", "e1", a, "ref:op:twin"), release(id, "rel:b", "failed", "e2", b, "ref:op:twin")]);
    expect(pair).toEqual(expect.arrayContaining([{ ok: true, state: "released" }, rejected("reservation_state_conflict")]));
    expect(await buckets(ids)).toEqual(counted(0));
  });

  const settle = (reservationId: string, key: string, quantityUsed: string, evidenceRef = "acceptance:usable", client = a, operationRef?: string) =>
    asBillingResult(atClock(client, earlyDec, async tx => settleInTransaction(tx, service, { idempotencyKey: `idem:${key}`, reservationId,
      operationRef: operationRef ?? (await tx.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).operationRef,
      quantityUsed, evidenceRef })));
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
  });
  it("refuses over-quantity, zero and malformed settles without writes, and settles an unknown outcome on evidence", async () => {
    const ids = await setup("enforce", 1000);
    const { reservationId } = await held(ids, "op:1", 3);
    expect(await settle(reservationId, "set:x", "4")).toEqual(rejected("quantity_exceeds_reservation"));
    expect(await settle(reservationId, "set:x", "0")).toEqual(rejected("request_invalid"));
    expect(await settle(reservationId, "set:x", "3", "e", a, "ref:wrong")).toEqual(rejected("idempotency_conflict"));
    expect(await unknown(reservationId, "unk:1")).toEqual({ ok: true, state: "unknown" });
    expect(await settle(reservationId, "set:1", "3", "acceptance:late-proof")).toMatchObject({ ok: true, chargeFen: "300" });
    expect(await buckets(ids)).toEqual(settledBuckets(0, 300));
    const cheap = await setup("enforce", 1000, undefined, () => cheapId);
    const big = await reserve(cheap, "op:c", 3, a, lateNov, cheapId); // 3 x 1/3 fen = 1 fen cap
    const cheapReservation = big.ok && big.mode === "enforce" ? big.reservationId : "";
    expect(await settle(cheapReservation, "set:c", "1")).toEqual(rejected("grant_charge_zero")); // 1/3 fen rounds to 0: release instead
    expect(await a.billingCharge.count({ where: { payerAccountId: cheap.payerAccountId } })).toBe(0);
  });
  it("keeps a settle that can no longer be paid held: billing off or wallet corrected below the hold", async () => {
    const ids = await setup("enforce", 300);
    const { reservationId } = await held(ids, "op:1", 3);
    await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: ids.payerAccountId, kind: "correction", operationKey: "corr:1",
      actor: service, evidenceRef: "correction:synthetic", entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(100) },
        { account: "correction_suspense", direction: "credit", amountFen: fen(100) }] }));
    expect(await settle(reservationId, "set:1", "3")).toEqual(rejected("insufficient_funds"));
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${ids.payerAccountId}`;
    expect(await settle(reservationId, "set:1", "2")).toEqual(rejected("billing_mode_off"));
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).toMatchObject({ state: "held", resolutionKey: null });
    expect(await buckets(ids)).toEqual(counted(300));
  });
  it("charges once under a concurrent double settle and lets settle or release win, never both", async () => {
    const ids = await setup("enforce", 1000);
    const { reservationId } = await held(ids, "op:d", 3);
    const pair = await Promise.all([settle(reservationId, "set:a", "3", "e", a, "ref:op:d"), settle(reservationId, "set:b", "3", "e", b, "ref:op:d")]);
    expect(pair.filter(result => result.ok)).toHaveLength(1);
    expect(pair).toContainEqual(rejected("reservation_state_conflict"));
    expect(await a.fundsTransaction.count({ where: { payerAccountId: ids.payerAccountId, kind: "charge" } })).toBe(1);
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(700), charge_revenue: fen(300) });
    const race = await held(ids, "op:r", 2);
    const outcome = await Promise.all([settle(race.reservationId, "set:r", "2", "e", a, "ref:op:r"), release(race.reservationId, "rel:r", "failed", "e", b, "ref:op:r")]);
    expect(outcome.filter(result => result.ok)).toHaveLength(1);
    const settledWon = outcome[0].ok;
    expect(await a.billingCharge.count({ where: { reservationId: race.reservationId } })).toBe(settledWon ? 1 : 0);
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(settledWon ? 500 : 700) });
    expect(await buckets(ids)).toEqual(settledBuckets(0, settledWon ? 500 : 300));
  });
  const resolve = (reservationId: string, key: string, outcome: "settled" | "released", quantityUsed?: string) =>
    asBillingResult(atClock(a, earlyDec, async tx => resolveUnknownInTransaction(tx, service, { idempotencyKey: `idem:${key}`, reservationId,
      operationRef: (await tx.billingReservation.findUniqueOrThrow({ where: { id: reservationId } })).operationRef, outcome, quantityUsed,
      evidenceRef: "reconciliation:synthetic" })));
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
    expect(await resolve(two.reservationId, "res:2", "settled", "2")).toMatchObject({ ok: true, state: "settled", chargeFen: "200" });
    expect(await balances(ids.payerAccountId)).toMatchObject({ customer_wallet_available: fen(800) });
    expect(await buckets(ids)).toEqual(settledBuckets(0, 200));
  });
  it("quotes payer, grant and price version from the workspace binding and fails closed otherwise", async () => {
    const ids = await setup("enforce", 1000);
    const q = (meterUnit = "document") => asBillingResult(atClock(a, midNov, tx => quoteInTransaction(tx, service, {
      subjectScope: { kind: "workspace", workspaceId: qws }, billingEventRef: "service-billing-event-v1:synthetic", meterUnit, quantity: "1" })));
    expect(await q()).toEqual(rejected("billing_mode_off")); // unbound workspace: not billed (status quo)
    await bindScope(a, { actorUserId: owner, payerAccountId: ids.payerAccountId, expectedPayerVersion: 1, scopeKind: "workspace",
      scopeRef: qws, evidenceRef: "consent:bind" });
    expect(await q()).toEqual({ ok: true, payerRef: ids.payerAccountId, grantId: ids.grantId, priceVersionId: priceId, mode: "enforce" });
    expect(await q("page")).toEqual(rejected("grant_not_active"));
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${ids.payerAccountId}`;
    expect(await q()).toEqual(rejected("grant_not_active"));
    expect(await reserve(ids, "op:susp", 1)).toEqual(rejected("grant_not_active")); // suspended never runs unbilled
  });
});
