import { createHmac, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPayerBalanceSummaries } from "../balance/balance-status";
import { draftBankReceipt, grantPlatformFinanceRole, reviewBankReceipt } from "../bank-receipts/bank-receipts";
import { heldEnforceFenInTransaction, postFundsTransactionInTransaction, recomputeFundsProjection,
  reverseFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { releaseInTransaction, reserve as reserveSpend, settle as settleSpend } from "../reservations/reservations";
import { settleTopupNotify } from "../topup/notify-entry";
import type { WeChatPayTransaction } from "../topup/provider-observation";
import { createTopupOrder, defineTopupProviderAdapter, verifyTopupCallback } from "../topup/topup-orders";
import { changeCreditFacility, drawCreditShortfallInTransaction, proposeCreditFacility } from "./credit-facilities";
import { repayArrearsFromInflowInTransaction } from "./inflow-repay";

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

const fen = (value: number) => BigInt(value);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const VERIFIER = { type: "SYSTEM" as const, ref: "payment-verifier" };
const SETTLE = { type: "SYSTEM" as const, ref: "billing-settle" };

describe.skipIf(!url)("inflow repayment against MySQL (C-REPAY)", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `rp-${name}-${run}`;
  const [admin, maker, checker, owner] = ["admin", "maker", "checker", "owner"].map(id);
  const ws = id("ws");
  const service = { type: "SYSTEM" as const, ref: "synthetic-metering" };
  let a: PrismaClient, b: PrismaClient, priceId = "";
  let seq = 0;
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    const existing = await a.workspace.findUnique({ where: { systemKey: "helm_reserved_primary" }, select: { id: true } });
    const reserved = existing?.id ?? id("reserved");
    if (!existing) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,workspaceClass,systemKey,updatedAt)
      VALUES (${reserved},'Synthetic reserved',${reserved},'HELM_RESERVED','helm_reserved_primary',NOW(3))`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic customer',${ws},NOW(3))`;
    for (const u of [admin, maker, checker, owner]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${u},'Synthetic',${`${u}@example.invalid`},NOW(3))`;
    }
    const membership = (workspaceId: string, userId: string, role: string) => a.$executeRaw`
      INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${workspaceId}-${userId}`},${workspaceId},${userId},${role},'ACTIVE',NOW(3))`;
    await membership(reserved, admin, "OWNER");
    for (const u of [maker, checker]) await membership(reserved, u, "MEMBER");
    await membership(ws, owner, "OWNER");
    for (const [userId, role] of [[maker, "maker"], [checker, "checker"]] as const) {
      await grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    }
    priceId = (await publishPriceVersion(a, { actor: { type: "SYSTEM", ref: "synthetic-catalog" }, productCode: `synthetic.rp${run}`,
      version: 1, meterUnit: "document", billingEventRef: "service-billing-event-v1:synthetic", acceptanceRef: "acceptance:synthetic",
      scopeKind: "workspace", unitPriceFenNumerator: fen(100), unitPriceDenominator: fen(1), effectiveFrom: new Date("2026-11-01T00:00:00Z"),
      effectiveUntil: null, approvalRef: "approval:synthetic" })).priceVersion.id; // 100 fen per document
  });
  // Facilities and journal rows are retained by trigger, so this synthetic database keeps them; it is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  /** An enforce payer bound to a fresh workspace with an active grant, so post_delivery work can overdraw at settle. */
  async function payer() {
    const workspaceId = id(`sw${(seq += 1)}`);
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${workspaceId},'Synthetic subject',${workspaceId},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${workspaceId}`},${workspaceId},${owner},'OWNER','ACTIVE',NOW(3))`;
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-repay" });
    await bindScope(a, { actorUserId: owner, payerAccountId: account.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: workspaceId,
      evidenceRef: "consent:bind" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${account.id}`; // no mode API yet
    const { grant } = await createSpendGrant(a, { actorUserId: owner, payerAccountId: account.id, priceVersionId: priceId, operationKey: "grant:rp",
      evidenceRef: "consent:synthetic", validFrom: new Date("2026-11-01T00:00:00Z"), validUntil: new Date("2027-02-01T00:00:00Z"),
      limits: { perChargeLimitFen: fen(100_000), dailyLimitFen: fen(1_000_000), monthlyLimitFen: fen(1_000_000) } });
    await changeSpendGrant(a, { actorUserId: owner, grantId: grant.id, expectedVersion: 1, action: "activate", evidenceRef: "consent:on" });
    return { payerAccountId: account.id, grantId: grant.id, workspaceId };
  }
  type Ids = Awaited<ReturnType<typeof payer>>;
  async function facility(payerAccountId: string, limit: number, validUntil: Date | null = null) {
    const { facility: draft } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId, limitFen: fen(limit), validUntil,
      operationKey: `credit:${(seq += 1)}`, evidenceRef: "owner-ruling:synthetic" });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: draft.id, action: "approve", expectedVersion: 1, evidenceRef: "review:approve" });
    return changeCreditFacility(a, { actorUserId: maker, facilityId: draft.id, action: "activate", expectedVersion: 2, evidenceRef: "review:activate" });
  }
  const close = (facilityId: string, action: "revoke" | "expire", expectedVersion = 3) =>
    changeCreditFacility(a, { actorUserId: maker, facilityId, action, expectedVersion, evidenceRef: `review:${action}` });
  /** Settle stand-in on an empty wallet: borrow the whole amount, then a correction stands in for the charge (as in the credit tests). */
  const borrow = (payerAccountId: string, amount: number) => a.$transaction(async tx => {
    const sourceRef = `use:${(seq += 1)}`;
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
    await drawCreditShortfallInTransaction(tx, { payerAccountId, chargeFen: fen(amount), sourceRef, actor: SETTLE, reservedAt: now });
    await postFundsTransactionInTransaction(tx, { payerAccountId, kind: "correction", operationKey: `fee:${sourceRef}`, actor: SETTLE,
      evidenceRef: "charge:synthetic", entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(amount) },
        { account: "correction_suspense", direction: "credit", amountFen: fen(amount) }] });
  });
  /** A real held reservation (100 fen per document) and its settle; standard holds need funds, post_delivery ones do not. */
  async function hold(ids: Ids, documents: number, admission: "standard" | "post_delivery" = "standard") {
    const key = `h:${(seq += 1)}`;
    const held = await reserveSpend(a, service, { idempotencyKey: `idem:${key}`, operationRef: `ref:${key}`,
      subjectScope: { kind: "workspace", workspaceId: ids.workspaceId }, payerRef: ids.payerAccountId, grantId: ids.grantId, priceVersionId: priceId,
      billingEventRef: "service-billing-event-v1:synthetic", meterUnit: "document", quantity: String(documents),
      ...(admission === "post_delivery" ? { admission } : {}) });
    if (!held.ok) throw new Error(held.code);
    return { reservationId: held.reservationId, key, settle: (client: PrismaClient = a) => settleSpend(client, service, { idempotencyKey: `idem:set:${key}`,
      reservationId: held.reservationId, operationRef: `ref:${key}`, quantityUsed: String(documents), evidenceRef: "acceptance:usable" }) };
  }
  /** Real post_delivery reserve + settle: what wallet and credit cannot cover is recorded as overdraft (C-OD). */
  const deliver = async (ids: Ids, documents: number) => (await hold(ids, documents, "post_delivery")).settle();
  /** An inflow as part 2 will post it: the topup / bank_topup and its repayment in one transaction. */
  const inflowTx = async (tx: Prisma.TransactionClient, payerAccountId: string, amount: number, kind: "topup" | "bank_topup" = "topup") => {
    const key = `${(seq += 1)}`;
    const posted = await postFundsTransactionInTransaction(tx, { payerAccountId, kind, actor: VERIFIER,
      operationKey: kind === "topup" ? `topup:synthetic:${key}` : `bank-receipt:${key}`, evidenceRef: `inflow:${key}`,
      entries: [{ account: kind === "topup" ? "topup_clearing" : "bank_clearing", direction: "debit", amountFen: fen(amount) },
        { account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) }] });
    const repayment = await repayArrearsFromInflowInTransaction(tx, { payerAccountId, inflowTransactionId: posted.transaction.id, actor: VERIFIER });
    return { inflowId: posted.transaction.id, repayment };
  };
  const inflow = (payerAccountId: string, amount: number, kind: "topup" | "bank_topup" = "topup", client: PrismaClient = a) =>
    client.$transaction(tx => inflowTx(tx, payerAccountId, amount, kind), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  /** Pre-C-REPAY inflow (no repayment): how a spendable wallet beside debts can exist today. */
  const legacyTopup = (payerAccountId: string, amount: number) => a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId,
    kind: "topup", operationKey: `topup:legacy:${(seq += 1)}`, actor: VERIFIER, evidenceRef: "inflow:legacy",
    entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(amount) }, { account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) }] }));
  const balances = async (payerAccountId: string) => {
    const rows = await a.fundsAccountProjection.findMany({ where: { payerAccountId } });
    const of = (account: string) => rows.find(row => row.account === account)?.balanceFen ?? fen(0);
    return { wallet: of("customer_wallet_available"), credit: of("credit_receivable"), overdraft: of("overdraft_receivable") };
  };
  const used = async (facilityId: string) => (await a.creditFacility.findUniqueOrThrow({ where: { id: facilityId } })).usedFen;
  /** Reconciliation: the journal rebuilds every projection, credit_receivable = Σ usedFen (S5), and wallet - held > 0 implies no debt. */
  async function books(payerAccountId: string) {
    const report = await a.$transaction(tx => recomputeFundsProjection(tx, payerAccountId));
    expect(report.consistent).toBe(true);
    const facilities = await a.creditFacility.findMany({ where: { payerAccountId } });
    const now = await balances(payerAccountId);
    expect(facilities.reduce((sum, row) => sum + row.usedFen, fen(0))).toBe(now.credit);
    const held = await a.$transaction(tx => heldEnforceFenInTransaction(tx, payerAccountId));
    if (now.wallet - held > fen(0)) expect([now.credit, now.overdraft]).toEqual([fen(0), fen(0)]); // spendable > 0: no debt
    return now;
  }
  const repayRows = (payerAccountId: string) => a.fundsTransaction.findMany({ where: { payerAccountId, kind: { in: ["overdraft_repay", "credit_repay"] } },
    orderBy: { createdAt: "asc" }, include: { entries: true } });

  it("repays the overdraft first, then credit, and leaves the rest in the wallet", async () => {
    // Overdraft only: 200 delivered on an empty wallet; inflows of 150 and 100.
    const solo = await payer();
    expect(await deliver(solo, 2)).toMatchObject({ ok: true, chargeFen: "200" });
    expect(await balances(solo.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(0), overdraft: fen(200) });
    const first = await inflow(solo.payerAccountId, 150);
    expect(first.repayment).toMatchObject({ overdraftRepaidFen: fen(150), creditRepaid: [], walletLeftFen: fen(0) });
    expect(await books(solo.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(0), overdraft: fen(50) });
    expect((await inflow(solo.payerAccountId, 100, "bank_topup")).repayment).toMatchObject({ overdraftRepaidFen: fen(50), walletLeftFen: fen(50) });
    expect(await books(solo.payerAccountId)).toEqual({ wallet: fen(50), credit: fen(0), overdraft: fen(0) });
    const [row] = await repayRows(solo.payerAccountId);
    expect(row).toMatchObject({ kind: "overdraft_repay", operationKey: `overdraft-repay:${first.inflowId}`, evidenceRef: `funds-transaction:${first.inflowId}`,
      createdBy: "SYSTEM:payment-verifier" });
    expect(row.entries.map(entry => [entry.account, entry.direction, entry.amountFen])).toEqual(expect.arrayContaining([
      ["customer_wallet_available", "debit", fen(150)], ["overdraft_receivable", "credit", fen(150)]]));
    // Both debts: credit 300 exhausted, then 200 delivered overdraws; one inflow of 1000 clears both and leaves 500.
    for (const [amount, expected] of [[1000, { od: 200, credit: 300, left: 500 }], [250, { od: 200, credit: 50, left: 0 }]] as const) {
      const both = await payer();
      const line = await facility(both.payerAccountId, 300);
      await borrow(both.payerAccountId, 300);
      expect(await deliver(both, 2)).toMatchObject({ ok: true });
      expect(await balances(both.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(300), overdraft: fen(200) });
      const paid = await inflow(both.payerAccountId, amount);
      expect(paid.repayment).toMatchObject({ overdraftRepaidFen: fen(expected.od), walletLeftFen: fen(expected.left),
        creditRepaid: [{ facilityId: line.id, amountFen: fen(expected.credit) }] });
      expect(await used(line.id)).toBe(fen(300 - expected.credit));
      expect(await a.creditFacility.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ version: 3, state: "active", limitFen: fen(300) });
      const credit = (await repayRows(both.payerAccountId)).find(r => r.kind === "credit_repay")!;
      expect(credit).toMatchObject({ operationKey: `credit-repay:${paid.inflowId}:${line.id}`, evidenceRef: `credit-facility:${line.id}` });
      await books(both.payerAccountId);
      // balance-status reads the projections as they are: no formula change.
      expect((await readPayerBalanceSummaries(a, [both.workspaceId])).get(both.workspaceId)).toMatchObject({
        balanceFen: fen(amount - 500), overdraftUsedFen: fen(200 - expected.od), arrears: false });
    }
  });

  it("repays from the spendable wallet (no holds: the whole wallet), writes nothing when nothing is owed, and repays expired and revoked facilities closed-first", async () => {
    // Pool: a wallet left > 0 beside a debt by a pre-C-REPAY inflow is swept with the next inflow.
    const legacy = await payer();
    const line = await facility(legacy.payerAccountId, 1000);
    await borrow(legacy.payerAccountId, 100);
    await legacyTopup(legacy.payerAccountId, 80);
    expect(await balances(legacy.payerAccountId)).toEqual({ wallet: fen(80), credit: fen(100), overdraft: fen(0) });
    expect((await inflow(legacy.payerAccountId, 50)).repayment).toMatchObject({ creditRepaid: [{ facilityId: line.id, amountFen: fen(100) }],
      walletLeftFen: fen(30) });
    expect(await books(legacy.payerAccountId)).toEqual({ wallet: fen(30), credit: fen(0), overdraft: fen(0) });
    // Owing nothing: no repayment row at all.
    expect((await inflow(legacy.payerAccountId, 10)).repayment).toEqual({ overdraftRepaidFen: fen(0), overdraftTransactionId: null,
      creditRepaid: [], walletLeftFen: fen(40) });
    expect(await repayRows(legacy.payerAccountId)).toHaveLength(1);
    // Order (one ORDER BY, REPAY_ORDER): closed facilities by activation, then the drawable one. A revoked 100, an expired 50, an
    // active 70 (activated in that order).
    const p = await payer();
    const revoked = await facility(p.payerAccountId, 100);
    await borrow(p.payerAccountId, 100);
    await close(revoked.id, "revoke");
    const termed = await facility(p.payerAccountId, 50, new Date(Date.now() + 2500));
    await borrow(p.payerAccountId, 50);
    await sleep(3000);
    await close(termed.id, "expire");
    const active = await facility(p.payerAccountId, 500);
    await borrow(p.payerAccountId, 70);
    const first = await inflow(p.payerAccountId, 120);
    expect(first.repayment.creditRepaid.map(r => [r.facilityId, r.amountFen])).toEqual([[revoked.id, fen(100)], [termed.id, fen(20)]]);
    expect([await used(revoked.id), await used(termed.id), await used(active.id)]).toEqual([fen(0), fen(30), fen(70)]);
    // Closed facilities keep state, terms, closedAt and version; only usedFen moved (the trigger's repayment shape).
    expect(await a.creditFacility.findUniqueOrThrow({ where: { id: revoked.id } })).toMatchObject({ state: "revoked", version: 4, limitFen: fen(100) });
    expect(await a.creditFacility.findUniqueOrThrow({ where: { id: termed.id } })).toMatchObject({ state: "expired", version: 4 });
    expect((await inflow(p.payerAccountId, 200)).repayment.creditRepaid.map(r => [r.facilityId, r.amountFen]))
      .toEqual([[termed.id, fen(30)], [active.id, fen(70)]]);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(100), credit: fen(0), overdraft: fen(0) });
  });

  it("refuses foreign, reversed or repeated inflows, a broken S5 invariant, public posting and reversal of a repayment", async () => {
    const p = await payer(), other = await payer();
    const line = await facility(p.payerAccountId, 1000);
    await borrow(p.payerAccountId, 100);
    const repay = (inflowTransactionId: string, payerAccountId = p.payerAccountId) =>
      a.$transaction(tx => repayArrearsFromInflowInTransaction(tx, { payerAccountId, inflowTransactionId, actor: VERIFIER }));
    const paid = await inflow(p.payerAccountId, 60);
    await expect(repay(paid.inflowId)).rejects.toThrow("funds_repay_invariant_breach"); // never a second repayment for one inflow
    await expect(repay(paid.inflowId, other.payerAccountId)).rejects.toThrow("funds_input_invalid");
    const [fee] = await a.fundsTransaction.findMany({ where: { payerAccountId: p.payerAccountId, kind: "correction" } });
    await expect(repay(fee.id)).rejects.toThrow("funds_input_invalid"); // not an inflow
    const plain = await legacyTopup(other.payerAccountId, 10);
    await a.$transaction(tx => reverseFundsTransactionInTransaction(tx, { payerAccountId: other.payerAccountId,
      originalTransactionId: plain.transaction.id, operationKey: "reverse:plain", actor: VERIFIER, evidenceRef: "review:reverse" }));
    await expect(repay(plain.transaction.id, other.payerAccountId)).rejects.toThrow("funds_input_invalid"); // reversed inflow
    // Only the private channel posts a repayment.
    await expect(a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: p.payerAccountId, kind: "credit_repay",
      operationKey: `credit-repay:${paid.inflowId}:x`, actor: VERIFIER, evidenceRef: "credit-facility:x",
      entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(1) }, { account: "credit_receivable", direction: "credit", amountFen: fen(1) }] })))
      .rejects.toThrow("funds_accounts_not_allowed");
    // A repayment is never reversed; reversing an inflow already spent on repayment stays refused by the wallet (C-ADJ territory).
    const [repayment] = await repayRows(p.payerAccountId);
    await expect(a.$transaction(tx => reverseFundsTransactionInTransaction(tx, { payerAccountId: p.payerAccountId,
      originalTransactionId: repayment.id, operationKey: "reverse:repay", actor: VERIFIER, evidenceRef: "review:reverse" })))
      .rejects.toThrow("funds_reversal_invalid");
    await expect(a.$transaction(tx => reverseFundsTransactionInTransaction(tx, { payerAccountId: p.payerAccountId,
      originalTransactionId: paid.inflowId, operationKey: "reverse:inflow", actor: VERIFIER, evidenceRef: "review:reverse" })))
      .rejects.toThrow("funds_insufficient");
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(40), overdraft: fen(0) });
    // Known limit: a database writer can lower usedFen alone (repayment shape) and leave no journal line. The repayment refuses
    // on that S5 break and the whole inflow rolls back with it (fail-closed).
    await a.$executeRaw`UPDATE CreditFacility SET usedFen = usedFen - 1 WHERE id = ${line.id}`;
    const before = await a.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId } });
    await expect(inflow(p.payerAccountId, 500)).rejects.toThrow("funds_repay_invariant_breach");
    expect(await a.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId } })).toBe(before);
  });

  it("keeps the repayment shape narrow in the database and the credit receivable projection non-negative", async () => {
    const p = await payer();
    const line = await facility(p.payerAccountId, 1000);
    await borrow(p.payerAccountId, 100);
    for (const statement of [
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, version = version + 1 WHERE id = ${line.id}`,
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, limitFen = 900 WHERE id = ${line.id}`,
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, state = 'reduced' WHERE id = ${line.id}`,
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, closedAt = NOW(3) WHERE id = ${line.id}`,
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, lastReducedAt = NOW(3) WHERE id = ${line.id}`,
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, activePayerAccountId = NULL WHERE id = ${line.id}`]) {
      await expect(statement).rejects.toThrow(/credit_facility_guard|check constraint/i);
    }
    await expect(a.$executeRaw`UPDATE CreditFacility SET usedFen = -1 WHERE id = ${line.id}`).rejects.toThrow(/credit_facility_guard|check constraint/i);
    expect(await used(line.id)).toBe(fen(100));
    // On a closed facility only the trigger guards closedAt (the table CHECK holds for any non-NULL value).
    const closed = await payer();
    const old = await facility(closed.payerAccountId, 100);
    await borrow(closed.payerAccountId, 100);
    await close(old.id, "revoke");
    await expect(a.$executeRaw`UPDATE CreditFacility SET usedFen = 90, closedAt = closedAt + INTERVAL 1 SECOND WHERE id = ${old.id}`)
      .rejects.toThrow(/credit_facility_guard/);
    expect(await used(old.id)).toBe(fen(100));
    await expect(a.$executeRaw`UPDATE FundsAccountProjection SET balanceFen = -1 WHERE payerAccountId = ${p.payerAccountId}
      AND account = 'credit_receivable'`).rejects.toThrow(/funds_credit_projection_invalid/);
    const fresh = await payer();
    await expect(a.$executeRaw`INSERT INTO FundsAccountProjection (payerAccountId, account, balanceFen, version, updatedAt)
      VALUES (${fresh.payerAccountId}, 'credit_receivable', -1, 0, NOW(3))`).rejects.toThrow(/funds_credit_projection_invalid/);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(100), overdraft: fen(0) });
  });

  /** Holds the payer row on a third connection until `start`'s transactions are distinct waiters on that very row lock (bounded). */
  async function contended<T>(payerAccountId: string, start: () => Array<Promise<T>>,
    whileHeld?: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    let pending: Array<Promise<T>> = [];
    await a.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${payerAccountId} FOR UPDATE`;
      pending = start();
      for (const deadline = Date.now() + 10_000; ;) {
        const [row] = await a.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS n
          FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
          WHERE l.OBJECT_NAME = 'PayerAccount' AND l.LOCK_DATA = QUOTE(${payerAccountId})`;
        if (Number(row.n) >= pending.length) break;
        if (Date.now() > deadline) throw new Error("rendezvous_timeout");
        await sleep(20);
      }
      await whileHeld?.(tx); // committed before the waiters get the lock
    }, { timeout: 15_000 });
    return Promise.all(pending);
  }

  it("serializes concurrent inflows and an inflow racing a settle on the payer lock", async () => {
    const p = await payer();
    await facility(p.payerAccountId, 1000);
    await borrow(p.payerAccountId, 100);
    const both = await contended(p.payerAccountId, () => [inflow(p.payerAccountId, 80, "topup", a), inflow(p.payerAccountId, 80, "bank_topup", b)]);
    expect(both.map(r => r.repayment.creditRepaid[0]?.amountFen ?? fen(0)).sort()).toEqual([fen(20), fen(80)]);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(60), credit: fen(0), overdraft: fen(0) });
    // A delivered 200 (reserved beforehand) settling while 150 arrives: either order ends with an empty wallet and 50 owed.
    const q = await payer(), call = await hold(q, 2, "post_delivery");
    const [settled] = await contended(q.payerAccountId, () => [call.settle(b), inflow(q.payerAccountId, 150, "topup", a)]);
    expect(settled).toMatchObject({ ok: true, chargeFen: "200" });
    const after = await books(q.payerAccountId);
    expect([after.wallet, after.credit + after.overdraft]).toEqual([fen(0), fen(50)]);
  });

  it("repays only the spendable wallet (wallet - held): a funded hold still settles, the rest stays owed (ruling M-1)", async () => {
    const p = await payer();
    const line = await facility(p.payerAccountId, 100);
    await borrow(p.payerAccountId, 100);
    await close(line.id, "revoke");
    await legacyTopup(p.payerAccountId, 100);
    const funded = await hold(p, 1); // admitted against the wallet (100) with no drawable credit
    expect((await inflow(p.payerAccountId, 1)).repayment).toMatchObject({ creditRepaid: [{ facilityId: line.id, amountFen: fen(1) }],
      walletLeftFen: fen(100) }); // spendable 101 - 100 held = 1
    expect(await funded.settle()).toMatchObject({ ok: true, state: "settled", chargeFen: "100" });
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(99), overdraft: fen(0) }); // still owed, next inflow
    // Holds above the wallet (funded by remaining credit): nothing is spendable, so nothing is repaid or written.
    const q = await payer();
    await facility(q.payerAccountId, 1000);
    await borrow(q.payerAccountId, 100);
    await hold(q, 3); // 300 held on remaining credit, wallet 0
    expect((await inflow(q.payerAccountId, 50)).repayment).toEqual({ overdraftRepaidFen: fen(0), overdraftTransactionId: null,
      creditRepaid: [], walletLeftFen: fen(50) });
    expect(await repayRows(q.payerAccountId)).toHaveLength(0);
    expect(await books(q.payerAccountId)).toEqual({ wallet: fen(50), credit: fen(100), overdraft: fen(0) });
  });

  it("orders the rollbacks: C-OD refuses while this migration is applied; this one refuses once a repayment exists", async () => {
    // CREATE PROCEDURE cannot run over the prepared-statement protocol, so evaluate each file's guards as written (as the
    // reservation tests do); the whole files were also run against a scratch MySQL by hand (PR body).
    const guards = (file: string) => {
      const sql = readFileSync(join(process.cwd(), "prisma/rollback", file), "utf8");
      return [...sql.slice(sql.indexOf("BEGIN")).matchAll(/IF (EXISTS[\s\S]*?) THEN\s+SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '([^']*)'/g)]
        .map(match => ({ condition: match[1], message: match[2] }));
    };
    const fires = async (condition: string) =>
      Number((await a.$queryRawUnsafe<Array<{ refused: bigint }>>(`SELECT (${condition}) AS refused`))[0].refused);
    const [overdraftLater] = guards("20261115_rollback_billing_overdraft.sql");
    expect(overdraftLater.message).toContain("later billing migration is applied");
    expect(await fires(overdraftLater.condition)).toBe(1); // this migration is later: roll it back first
    const [later, rows] = guards("20261115_rollback_billing_inflow_repay.sql");
    expect([later.message, rows.message]).toEqual(["rollback refused: a later billing migration is applied; roll it back first",
      "rollback refused: repayment rows exist; fix forward"]);
    expect(await fires(later.condition)).toBe(0);
    expect(await fires(rows.condition)).toBe(1); // the cases above recorded repayments
  });

  it("reads held current under the payer lock even in a REPEATABLE READ transaction with an older snapshot (part 2)", async () => {
    // Over-repay counterexample (review r2 F): wallet 10000, closed facility owing 10000; a hold of 10000 commits after the inflow's
    // snapshot. A stale held of 0 would repay 10000; the locking read sees the hold and repays only the spendable 1.
    const p = await payer(), line = await facility(p.payerAccountId, 10_000);
    await borrow(p.payerAccountId, 10_000); await close(line.id, "revoke"); await legacyTopup(p.payerAccountId, 10_000);
    const paid = await a.$transaction(async tx => {
      await tx.$queryRaw`SELECT COUNT(*) AS n FROM BillingReservation WHERE payerAccountId = ${p.payerAccountId}`; // snapshot now
      await hold(p, 100); // another transaction holds 10000 and commits
      const staleHeld = await heldEnforceFenInTransaction(tx, p.payerAccountId); // a plain read still sees the old snapshot
      const result = await inflowTx(tx, p.payerAccountId, 1);
      return { ...result, staleHeld, staleHeldAfter: await heldEnforceFenInTransaction(tx, p.payerAccountId) };
    }, { timeout: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    expect([paid.staleHeld, paid.staleHeldAfter]).toEqual([fen(0), fen(0)]); // the snapshot predates the hold throughout
    expect(paid.repayment).toMatchObject({ creditRepaid: [{ facilityId: line.id, amountFen: fen(1) }] });
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(10_000), credit: fen(9_999), overdraft: fen(0) });
  });

  // Synthetic provider IO for the real top-up entry: an HMAC with a per-run key stands in for the provider signature. No network.
  const syntheticKey = randomUUID(), sign = (body: string) => createHmac("sha256", syntheticKey).update(body).digest("hex");
  const wechat = (body: WeChatPayTransaction) => defineTopupProviderAdapter("wechat_pay", {
    refs: mch => (mch === "mch-syn" ? { merchantRef: "merchant:synthetic", appRef: "app:synthetic" } : null),
    verifyCallback: async ({ headers, rawBody }) => {
      if (headers["x-signature"] !== sign(rawBody)) throw new Error("synthetic_signature_invalid");
      return JSON.parse(rawBody) as WeChatPayTransaction;
    }, queryOrder: async () => body });
  async function paidCallback(ids: Ids, yuan: number) {
    const order = await createTopupOrder(a, { actorUserId: owner, workspaceId: ids.workspaceId, provider: "wechat_pay", amountFen: fen(yuan * 100),
      merchantRef: "merchant:synthetic", appRef: "app:synthetic" });
    const body: WeChatPayTransaction = { mchid: "mch-syn", appid: "app-syn", out_trade_no: order.providerOrderNo, trade_state: "SUCCESS",
      transaction_id: `wx-${order.providerOrderNo.slice(4, 24)}`, amount: { total: yuan * 100, currency: "CNY" } };
    const rawBody = JSON.stringify(body), request = { headers: { "x-signature": sign(rawBody) }, rawBody };
    return { order, body, send: (client: PrismaClient = a) => verifyTopupCallback(client, wechat(body), request),
      notify: (alerts: string[]) => settleTopupNotify(a, wechat(body), request, reason => alerts.push(reason)) };
  }
  const exceptionRows = (key: string) => a.billingOutbox.count({ where: { aggregateType: "PaymentException", eventType: "payment_exception", aggregateId: key } });

  it("repays through the real top-up entry once; concurrent and repeated callbacks replay; a broken invariant is kept and retried", async () => {
    const p = await payer(), line = await facility(p.payerAccountId, 30_000);
    await borrow(p.payerAccountId, 25_000);
    const first = await paidCallback(p, 100);
    // The same inflow twice at once, both seen waiting on the payer lock together: one credit, one replay.
    const pair = await contended(p.payerAccountId, () => [first.send(a), first.send(b)]);
    expect(pair.map(r => r.outcome).sort()).toEqual(["credited", "replayed"]);
    expect((await first.send()).outcome).toBe("replayed");
    const rows = await repayRows(p.payerAccountId);
    expect(rows.map(row => [row.kind, row.operationKey, row.createdBy])).toEqual([["credit_repay",
      `credit-repay:${pair.find(r => r.outcome === "credited")!.fundsTransactionId}:${line.id}`, "SYSTEM:billing-topup-verifier"]]);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(15_000), overdraft: fen(0) });
    // S5 broken by a direct write: the credit is refused with a fixed code, a `repay_invariant_breach` exception is kept once per
    // provider transaction, and the notify is not acknowledged (503) so the provider retries; after the repair a retry credits.
    await a.$executeRaw`UPDATE CreditFacility SET usedFen = usedFen - 1 WHERE id = ${line.id}`;
    const second = await paidCallback(p, 100), alerts: string[] = [];
    expect(await second.notify(alerts)).toEqual({ acknowledged: false, status: 503 });
    expect(await second.notify(alerts)).toEqual({ acknowledged: false, status: 503 });
    expect(alerts).toEqual(["topup_repay_invariant_breach", "topup_repay_invariant_breach"]);
    expect(await exceptionRows(`repay_invariant_breach:wechat_pay:${second.body.transaction_id}`)).toBe(1);
    expect((await a.paymentOrder.findUniqueOrThrow({ where: { id: second.order.id } })).state).not.toBe("paid_verified");
    await a.$executeRaw`UPDATE CreditFacility SET usedFen = usedFen + 1 WHERE id = ${line.id}`; // repair (draw shape)
    expect(await second.notify(alerts)).toEqual({ acknowledged: true, status: 200 });
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(5_000), overdraft: fen(0) });
  });

  it("uses the held value committed while the real entry waited on the payer lock (under-repay counterexample)", async () => {
    // Wallet 10000, a closed facility owing 20000, a hold of 10000. The hold is released while the callback, past its pre-lock reads,
    // waits on the payer lock: the repayment must see held 0 and repay 20000 (a stale held of 10000 would repay only 10000).
    const p = await payer(), line = await facility(p.payerAccountId, 20_000);
    await borrow(p.payerAccountId, 20_000); await close(line.id, "revoke"); await legacyTopup(p.payerAccountId, 10_000);
    const funded = await hold(p, 100), topup = await paidCallback(p, 100);
    const [result] = await contended(p.payerAccountId, () => [topup.send(b)], tx => releaseInTransaction(tx, service, {
      idempotencyKey: `idem:rel:${funded.key}`, reservationId: funded.reservationId, operationRef: `ref:${funded.key}`, reasonCode: "failed",
      evidenceRef: "claim:failed" }));
    expect(result.outcome).toBe("credited");
    expect((await repayRows(p.payerAccountId)).map(row => row.entries.find(e => e.account === "credit_receivable")!.amountFen)).toEqual([fen(20_000)]);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(0), overdraft: fen(0) });
  });

  it("repays through the real bank-receipt approval, and names the refusal when the invariant is broken", async () => {
    const p = await payer(), line = await facility(p.payerAccountId, 1000);
    await borrow(p.payerAccountId, 300);
    const env = { HELM_BILLING_BANK_RECEIVING_ACCOUNTS: JSON.stringify(["recv:synthetic-1"]) };
    const receipt = (amount: number) => draftBankReceipt(a, { actorUserId: maker, payerAccountId: p.payerAccountId, receivingAccountRef: "recv:synthetic-1",
      bankTxnRef: `bank-${run}-${(seq += 1)}`, amountFen: fen(amount), valueDate: "2026-11-15", evidenceRef: "bank-statement:synthetic" }, env);
    const approve = (receiptId: string) => reviewBankReceipt(a, { actorUserId: checker, receiptId, decision: "approve", expectedVersion: 1,
      evidenceRef: "review:approve" });
    await approve((await receipt(200)).id);
    expect((await repayRows(p.payerAccountId)).map(row => [row.kind, row.createdBy])).toEqual([["credit_repay", `USER:${checker}`]]);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(100), overdraft: fen(0) });
    await a.$executeRaw`UPDATE CreditFacility SET usedFen = usedFen - 1 WHERE id = ${line.id}`;
    const refused = await receipt(500);
    await expect(approve(refused.id)).rejects.toThrow("bank_receipt_repay_invariant_breach");
    expect(await a.bankReceipt.findUniqueOrThrow({ where: { id: refused.id } })).toMatchObject({ state: "drafted", fundsTransactionId: null });
  });

  it("rolls the whole inflow back when the caller fails after its repayments, and a retry repays once", async () => {
    const p = await payer();
    await facility(p.payerAccountId, 300);
    await borrow(p.payerAccountId, 300);
    expect(await deliver(p, 2)).toMatchObject({ ok: true }); // credit exhausted: overdraft 200 beside credit 300
    const before = { rows: await a.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId } }), books: await balances(p.payerAccountId) };
    await expect(a.$transaction(async tx => {
      const { repayment } = await inflowTx(tx, p.payerAccountId, 400);
      expect(repayment).toMatchObject({ overdraftRepaidFen: fen(200), creditRepaid: [{ amountFen: fen(200) }] }); // both written
      throw new Error("caller_failed_after_repayment");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })).rejects.toThrow("caller_failed_after_repayment");
    expect({ rows: await a.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId } }), books: await balances(p.payerAccountId) }).toEqual(before);
    expect((await inflow(p.payerAccountId, 400)).repayment).toMatchObject({ overdraftRepaidFen: fen(200), creditRepaid: [{ amountFen: fen(200) }] });
    expect(await repayRows(p.payerAccountId)).toHaveLength(2);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(100), overdraft: fen(0) });
  });

  /** Waits (bounded) until `n` distinct transactions wait on a row lock of `table`; tests run one at a time, so they are ours. */
  async function waitersOn(table: string, n = 1) {
    for (const deadline = Date.now() + 10_000; ;) {
      const [row] = await a.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS n
        FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
        WHERE l.OBJECT_NAME = ${table}`;
      if (Number(row.n) >= n) return;
      if (Date.now() > deadline) throw new Error(`no_waiter_on_${table}`);
      await sleep(20);
    }
  }
  const settledOf = <T>(work: Promise<T>) => work.then(value => ({ value, error: null }), (error: unknown) => ({ value: null, error }));
  const within = <T>(work: Promise<T>, ms: number) =>
    Promise.race([work, sleep(ms).then((): never => { throw new Error("cross_payer_wait"); })]);

  it("rolls everything back when the second repayment fails after the first is written (direct fault injection)", async () => {
    // Overdraft 200 beside credit 300 and an unrepaid inflow of 400: its repayment writes overdraft_repay 200, then credit_repay 200.
    const p = await payer(), line = await facility(p.payerAccountId, 300);
    await borrow(p.payerAccountId, 300);
    expect(await deliver(p, 2)).toMatchObject({ ok: true });
    const inflowId = (await legacyTopup(p.payerAccountId, 400)).transaction.id;
    const snapshot = async () => ({ rows: await a.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId } }),
      books: await balances(p.payerAccountId), used: await used(line.id) });
    const before = await snapshot();
    // A REPEATABLE READ locking read of the absent credit_repay key gap-locks it, so only that insert waits (the overdraft key sorts
    // into another gap). A short lock wait timeout on a dedicated connection then fails the second repayment's write.
    const victim = new PrismaClient({ datasources: { db: { url: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` } } });
    try {
      await victim.$executeRawUnsafe("SET SESSION innodb_lock_wait_timeout = 2");
      const outcome = await a.$transaction(async gate => {
        await gate.$queryRaw`SELECT id FROM FundsTransaction WHERE payerAccountId = ${p.payerAccountId}
          AND operationKey = ${`credit-repay:${inflowId}:${line.id}`} FOR UPDATE`;
        const repaid = settledOf(victim.$transaction(tx => repayArrearsFromInflowInTransaction(tx, { payerAccountId: p.payerAccountId,
          inflowTransactionId: inflowId, actor: VERIFIER }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 }));
        await waitersOn("FundsTransaction");
        // The first repayment is already written by the waiting transaction (a dirty read, for this proof only).
        const firstWritten = await a.$transaction(tx => tx.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId,
          operationKey: `overdraft-repay:${inflowId}` } }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadUncommitted });
        return { firstWritten, repaid: await repaid };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 });
      expect(outcome.firstWritten).toBe(1);
      expect(String(outcome.repaid.error)).toMatch(/Lock wait timeout/i);
    } finally { await victim.$disconnect(); }
    expect(await snapshot()).toEqual(before); // no repayment row, projections and usedFen unchanged
    expect(await repayRows(p.payerAccountId)).toHaveLength(0);
    expect((await a.$transaction(tx => recomputeFundsProjection(tx, p.payerAccountId))).consistent).toBe(true);
  });

  it("re-runs a deadlocked top-up in the real entry under the same provider transaction: one credit, one repayment", async () => {
    const p = await payer(), line = await facility(p.payerAccountId, 30_000);
    await borrow(p.payerAccountId, 20_000);
    const topup = await paidCallback(p, 100);
    const weight = id(`wt${(seq += 1)}`);
    let entry: Promise<{ value: Awaited<ReturnType<typeof topup.send>> | null; error: unknown }> | undefined;
    await expect(a.$transaction(async gate => {
      // Heavier than the entry (InnoDB rolls back the lighter transaction of a deadlock), so the entry is the victim.
      await gate.$executeRaw`INSERT INTO Workspace (id, name, slug, updatedAt) WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL
        SELECT i + 1 FROM n WHERE i < 200) SELECT CONCAT(${weight}, '-', i), 'Synthetic weight', CONCAT(${weight}, '-', i), NOW(3) FROM n`;
      await gate.$queryRaw`SELECT id FROM CreditFacility WHERE id = ${line.id} FOR UPDATE`;
      entry = settledOf(topup.send(b));
      await waitersOn("CreditFacility"); // the entry holds the payer lock, has posted the top-up and waits in its repayment
      // Closing the cycle; this must be granted, i.e. the entry was rolled back. Then this gate rolls back too.
      await gate.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${p.payerAccountId} FOR UPDATE`;
      throw new Error("gate_released");
    }, { timeout: 20_000 })).rejects.toThrow("gate_released");
    const { value, error } = await entry!;
    expect(error).toBeNull();
    expect(value).toMatchObject({ outcome: "credited" });
    expect(await a.fundsTransaction.count({ where: { payerAccountId: p.payerAccountId,
      operationKey: `topup:wechat_pay:${topup.body.transaction_id}` } })).toBe(1);
    expect((await repayRows(p.payerAccountId)).map(row => [row.kind, row.operationKey])).toEqual([["credit_repay",
      `credit-repay:${value!.fundsTransactionId}:${line.id}`]]);
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(10_000), overdraft: fen(0) });
  });

  it("does not wait on another payer's reservation or open inflow (READ COMMITTED, as the entries run)", async () => {
    const p = await payer(), q = await payer();
    await facility(p.payerAccountId, 1000);
    await borrow(p.payerAccountId, 300);
    const delivered = await hold(q, 2, "post_delivery");
    // q's reservation locked as its settle locks it: p's inflow sums p's holds and repays without waiting on that row.
    await a.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM BillingReservation WHERE id = ${delivered.reservationId} FOR UPDATE`;
      const paid = await within(inflow(p.payerAccountId, 150, "topup", b), 5_000);
      expect(paid.repayment.creditRepaid.map(r => r.amountFen)).toEqual([fen(150)]);
    }, { timeout: 15_000 });
    // p's inflow and repayment left open (uncommitted): q settles, overdraws and repays from its own inflow meanwhile.
    await a.$transaction(async tx => {
      expect((await inflowTx(tx, p.payerAccountId, 50)).repayment.creditRepaid.map(r => r.amountFen)).toEqual([fen(50)]);
      expect(await within(delivered.settle(b), 5_000)).toMatchObject({ ok: true, chargeFen: "200" });
      expect((await within(inflow(q.payerAccountId, 120, "topup", b), 5_000)).repayment).toMatchObject({ overdraftRepaidFen: fen(120) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 });
    expect(await books(p.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(100), overdraft: fen(0) });
    expect(await books(q.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(0), overdraft: fen(80) });
  });

  it("keeps keys apart for inflow ids 1 and 10, accepts a facility id with separators and orders equal activation times by id", async () => {
    // Inflow ids are CUIDs in practice; raw rows with chosen ids pin the range query: `credit-repay:<x>1:` never covers `<x>10:`.
    const p = await payer(), x = `in${run}`;
    for (const suffix of ["1", "10"]) await a.$executeRaw`INSERT INTO FundsTransaction (id,payerAccountId,kind,operationKey,contentHash,currency,evidenceRef,createdBy)
      VALUES (${x + suffix},${p.payerAccountId},'topup',${`topup:synthetic:${x}${suffix}`},${"0".repeat(64)},'CNY','inflow:raw','SYSTEM:test')`;
    await a.$executeRaw`INSERT INTO FundsTransaction (id,payerAccountId,kind,operationKey,contentHash,currency,evidenceRef,createdBy)
      VALUES (${`${x}r`},${p.payerAccountId},'credit_repay',${`credit-repay:${x}10:cf`},${"0".repeat(64)},'CNY','credit-facility:cf','SYSTEM:test')`;
    const repayRaw = (inflowTransactionId: string) => a.$transaction(tx => repayArrearsFromInflowInTransaction(tx, { payerAccountId: p.payerAccountId,
      inflowTransactionId, actor: VERIFIER }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    await expect(repayRaw(`${x}1`)).resolves.toMatchObject({ creditRepaid: [] });
    await expect(repayRaw(`${x}10`)).rejects.toThrow("funds_repay_invariant_breach");
    // Two closed facilities with ids containing ':' activated at one pinned database time: repaid in id order.
    const q = await payer(), pinned = new PrismaClient({ datasources: { db: { url: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` } } });
    try {
      await pinned.$executeRawUnsafe(`SET timestamp = ${Math.floor(Date.now() / 1000) - 3600}`);
      const ids = [`cf:${run}:b`, `cf:${run}:a`];
      for (const facilityId of ids) {
        await a.$executeRaw`INSERT INTO CreditFacility (id,payerAccountId,limitFen,operationKey,contentHash,proposedByUserId,evidenceRef,updatedAt)
          VALUES (${facilityId},${q.payerAccountId},100,${`credit:${facilityId}`},${"0".repeat(64)},${maker},'owner-ruling:synthetic',NOW(3))`;
        await changeCreditFacility(pinned, { actorUserId: checker, facilityId, action: "approve", expectedVersion: 1, evidenceRef: "review:approve" });
        await changeCreditFacility(pinned, { actorUserId: maker, facilityId, action: "activate", expectedVersion: 2, evidenceRef: "review:activate" });
        await borrow(q.payerAccountId, 100);
        await changeCreditFacility(pinned, { actorUserId: maker, facilityId, action: "revoke", expectedVersion: 3, evidenceRef: "review:revoke" });
      }
      const [b1, b2] = await a.creditFacility.findMany({ where: { id: { in: ids } } });
      expect(b1.activatedAt).toEqual(b2.activatedAt);
      const paid = await inflow(q.payerAccountId, 150);
      expect(paid.repayment.creditRepaid.map(r => [r.facilityId, r.amountFen])).toEqual([[ids[1], fen(100)], [ids[0], fen(50)]]);
      expect((await repayRows(q.payerAccountId)).map(row => row.operationKey)).toContain(`credit-repay:${paid.inflowId}:${ids[1]}`);
      expect(await books(q.payerAccountId)).toEqual({ wallet: fen(0), credit: fen(50), overdraft: fen(0) });
    } finally { await pinned.$disconnect(); }
    // The reversal entry cannot occupy a reserved repayment prefix either.
    const plain = await legacyTopup(q.payerAccountId, 10);
    for (const operationKey of [`credit-repay:${plain.transaction.id}:x`, `overdraft-repay:${plain.transaction.id}`]) {
      await expect(a.$transaction(tx => reverseFundsTransactionInTransaction(tx, { payerAccountId: q.payerAccountId,
        originalTransactionId: plain.transaction.id, operationKey, actor: VERIFIER, evidenceRef: "review:reverse" }))).rejects.toThrow("funds_input_invalid");
    }
  });
});
