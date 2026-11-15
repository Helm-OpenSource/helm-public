import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPayerBalanceSummaries } from "../balance/balance-status";
import { grantPlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { postFundsTransactionInTransaction, recomputeFundsProjection, reverseFundsTransactionInTransaction,
  runFundsTransactionWithRetry } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { reserve as reserveSpend, settle as settleSpend } from "../reservations/reservations";
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
  /** Real post_delivery reserve + settle: what wallet and credit cannot cover is recorded as overdraft (C-OD). */
  async function deliver(ids: Ids, documents: number, client: PrismaClient = a) {
    const key = `pd:${(seq += 1)}`;
    const held = await reserveSpend(a, service, { idempotencyKey: `idem:${key}`, operationRef: `ref:${key}`,
      subjectScope: { kind: "workspace", workspaceId: ids.workspaceId }, payerRef: ids.payerAccountId, grantId: ids.grantId, priceVersionId: priceId,
      billingEventRef: "service-billing-event-v1:synthetic", meterUnit: "document", quantity: String(documents), admission: "post_delivery" });
    if (!held.ok) throw new Error(held.code);
    return settleSpend(client, service, { idempotencyKey: `idem:set:${key}`, reservationId: held.reservationId, operationRef: `ref:${key}`,
      quantityUsed: String(documents), evidenceRef: "acceptance:usable" });
  }
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
    runFundsTransactionWithRetry(client, tx => inflowTx(tx, payerAccountId, amount, kind));
  /** Pre-C-REPAY inflow (no repayment): how a wallet > 0 with debts can exist today. */
  const legacyTopup = (payerAccountId: string, amount: number) => a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId,
    kind: "topup", operationKey: `topup:legacy:${(seq += 1)}`, actor: VERIFIER, evidenceRef: "inflow:legacy",
    entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(amount) }, { account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) }] }));
  const balances = async (payerAccountId: string) => {
    const rows = await a.fundsAccountProjection.findMany({ where: { payerAccountId } });
    const of = (account: string) => rows.find(row => row.account === account)?.balanceFen ?? fen(0);
    return { wallet: of("customer_wallet_available"), credit: of("credit_receivable"), overdraft: of("overdraft_receivable") };
  };
  const used = async (facilityId: string) => (await a.creditFacility.findUniqueOrThrow({ where: { id: facilityId } })).usedFen;
  /** Reconciliation: the journal rebuilds every projection, credit_receivable = Σ usedFen (S5), and wallet > 0 implies no debt. */
  async function books(payerAccountId: string) {
    const report = await a.$transaction(tx => recomputeFundsProjection(tx, payerAccountId));
    expect(report.consistent).toBe(true);
    const facilities = await a.creditFacility.findMany({ where: { payerAccountId } });
    const now = await balances(payerAccountId);
    expect(facilities.reduce((sum, row) => sum + row.usedFen, fen(0))).toBe(now.credit);
    if (now.wallet > fen(0)) expect([now.credit, now.overdraft]).toEqual([fen(0), fen(0)]);
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

  it("repays from the whole wallet, writes nothing when nothing is owed, and repays expired and revoked facilities closed-first", async () => {
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

  /** Holds the payer row on a third connection until every transaction in `start` waits on it, so they really contend (bounded). */
  async function contended<T>(payerAccountId: string, start: () => Array<Promise<T>>) {
    let pending: Array<Promise<T>> = [];
    await a.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${payerAccountId} FOR UPDATE`;
      pending = start();
      for (const deadline = Date.now() + 10_000; ;) {
        const [row] = await a.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits`;
        if (Number(row.n) >= pending.length) break;
        if (Date.now() > deadline) throw new Error("rendezvous_timeout");
        await sleep(20);
      }
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
    // A delivered 200 settling while 150 arrives: either order ends with an empty wallet and 50 owed.
    const q = await payer();
    const [settled] = await contended(q.payerAccountId, () => [deliver(q, 2, b), inflow(q.payerAccountId, 150, "topup", a)]);
    expect(settled).toMatchObject({ ok: true, chargeFen: "200" });
    const after = await books(q.payerAccountId);
    expect([after.wallet, after.credit + after.overdraft]).toEqual([fen(0), fen(50)]);
  });

  it("pins the known edge: a wallet-funded standard hold beside a closed facility's debt is refused at settle and stays held", async () => {
    const p = await payer();
    const line = await facility(p.payerAccountId, 100);
    await borrow(p.payerAccountId, 100);
    await close(line.id, "revoke");
    await legacyTopup(p.payerAccountId, 100);
    const key = `std:${(seq += 1)}`;
    const held = await reserveSpend(a, service, { idempotencyKey: `idem:${key}`, operationRef: `ref:${key}`,
      subjectScope: { kind: "workspace", workspaceId: p.workspaceId }, payerRef: p.payerAccountId, grantId: p.grantId, priceVersionId: priceId,
      billingEventRef: "service-billing-event-v1:synthetic", meterUnit: "document", quantity: "1" });
    if (!held.ok) throw new Error(held.code); // admitted against the wallet (100) with no drawable credit
    expect((await inflow(p.payerAccountId, 1)).repayment).toMatchObject({ creditRepaid: [{ facilityId: line.id, amountFen: fen(100) }],
      walletLeftFen: fen(1) });
    expect(await settleSpend(a, service, { idempotencyKey: `idem:set:${key}`, reservationId: held.reservationId, operationRef: `ref:${key}`,
      quantityUsed: "1", evidenceRef: "acceptance:usable" })).toMatchObject({ ok: false, code: "insufficient_funds" });
    expect((await a.billingReservation.findUniqueOrThrow({ where: { id: held.reservationId } })).state).toBe("held");
    await books(p.payerAccountId);
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
});
