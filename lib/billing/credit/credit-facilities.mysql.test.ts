import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPayerAccount } from "../payer/payer-accounts";
import { grantPlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { postFundsTransactionInTransaction, recomputeFundsProjection } from "../funds/funds-journal";
import { availableCreditFen, changeCreditFacility, drawCreditShortfallInTransaction, proposeCreditFacility,
  type CreditFacilityAction } from "./credit-facilities";

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
const SETTLE = { type: "SYSTEM" as const, ref: "billing-settle" };

describe.skipIf(!url)("credit facilities against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `cf-${name}-${run}`;
  const [admin, maker, checker, dual, owner] = ["admin", "maker", "checker", "dual", "owner"].map(id);
  const ws = id("ws");
  let a: PrismaClient, b: PrismaClient;
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
    for (const u of [admin, maker, checker, dual, owner]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${u},'Synthetic',${`${u}@example.invalid`},NOW(3))`;
    }
    const membership = (workspaceId: string, userId: string, role: string) => a.$executeRaw`
      INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${workspaceId}-${userId}`},${workspaceId},${userId},${role},'ACTIVE',NOW(3))`;
    await membership(reserved, admin, "OWNER");
    for (const u of [maker, checker, dual]) await membership(reserved, u, "MEMBER");
    await membership(ws, owner, "OWNER");
    const grant = (userId: string, role: "maker" | "checker") => grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    await grant(maker, "maker"); await grant(checker, "checker"); await grant(dual, "maker"); await grant(dual, "checker");
  });
  // Facilities and journal rows are retained by trigger, so this synthetic database keeps them; it is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function payer() {
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-credit" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${account.id}`; // no mode API yet
    return account.id;
  }
  const propose = (payerAccountId: string, limit = 1000, extra: { actorUserId?: string; validUntil?: Date | null } = {}) =>
    proposeCreditFacility(a, { actorUserId: extra.actorUserId ?? maker, payerAccountId, limitFen: fen(limit),
      validUntil: extra.validUntil ?? null, operationKey: `credit:${(seq += 1)}`, evidenceRef: "owner-ruling:synthetic" });
  const change = (facilityId: string, action: CreditFacilityAction, actorUserId: string, expectedVersion: number,
    extra: { limitFen?: bigint; client?: PrismaClient } = {}) => changeCreditFacility(extra.client ?? a,
    { actorUserId, facilityId, action, expectedVersion, evidenceRef: `review:${action}`, limitFen: extra.limitFen });
  async function activeFacility(payerAccountId: string, limit = 1000, validUntil: Date | null = null) {
    const { facility } = await propose(payerAccountId, limit, { validUntil });
    await change(facility.id, "approve", checker, 1);
    return change(facility.id, "activate", maker, 2);
  }
  const draw = (payerAccountId: string, amount: number, sourceRef: string, client = a) =>
    settleIn(client, payerAccountId, amount, sourceRef);
  const dbNow = async (tx: Prisma.TransactionClient | PrismaClient = a) =>
    (await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`)[0].now;
  /** S3-b settle stand-in: borrow the shortfall, then charge the wallet in full (a correction stands in for S3-b2's charge). */
  const settleTx = async (tx: Prisma.TransactionClient, payerAccountId: string, amount: number, sourceRef: string, reservedAt?: Date) => {
    const drawn = await drawCreditShortfallInTransaction(tx, { payerAccountId, chargeFen: fen(amount), sourceRef, actor: SETTLE,
      reservedAt: reservedAt ?? await dbNow(tx) });
    await postFundsTransactionInTransaction(tx, { payerAccountId, kind: "correction", operationKey: `fee:${sourceRef}`, actor: SETTLE,
      evidenceRef: "charge:synthetic", entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(amount) },
        { account: "correction_suspense", direction: "credit", amountFen: fen(amount) }] });
    return drawn;
  };
  const settleIn = (client: PrismaClient, payerAccountId: string, amount: number, sourceRef: string, reservedAt?: Date) =>
    client.$transaction(tx => settleTx(tx, payerAccountId, amount, sourceRef, reservedAt));
  const available = (payerAccountId: string) => a.$transaction(tx => availableCreditFen(tx, payerAccountId));
  const projection = async (payerAccountId: string, account: "credit_receivable" | "customer_wallet_available") =>
    (await a.fundsAccountProjection.findUnique({ where: { payerAccountId_account: { payerAccountId, account } } }))?.balanceFen ?? fen(0);

  it("defaults to 0 and needs maker -> different checker -> activation; no workspace OWNER or service path", async () => {
    const p = await payer();
    expect(await available(p)).toBe(fen(0));
    for (const actorUserId of [owner, checker, "SYSTEM:billing-settle"]) {
      await expect(propose(p, 1000, { actorUserId })).rejects.toThrow("credit_forbidden");
    }
    const { facility } = await propose(p, 10_000_000);
    expect(facility).toMatchObject({ state: "draft", limitFen: fen(10_000_000), usedFen: fen(0), version: 1 });
    await expect(change(facility.id, "approve", maker, 1)).rejects.toThrow("credit_forbidden"); // maker role cannot approve
    await expect(change(facility.id, "approve", owner, 1)).rejects.toThrow("credit_forbidden");
    await expect(change(facility.id, "activate", checker, 1)).rejects.toThrow("credit_transition_invalid");
    const approved = await change(facility.id, "approve", checker, 1);
    expect(approved).toMatchObject({ state: "approved", approvedByUserId: checker, version: 2 });
    expect(await available(p)).toBe(fen(0));
    await expect(change(facility.id, "activate", "SYSTEM:billing-settle", 2)).rejects.toThrow("credit_forbidden");
    expect(await change(facility.id, "activate", maker, 2)).toMatchObject({ state: "active", activePayerAccountId: p, version: 3 });
    expect(await available(p)).toBe(fen(10_000_000));
    expect(await a.auditLog.count({ where: { targetId: facility.id } })).toBe(3);
  });
  it("refuses maker = checker in the service and in the database CHECK", async () => {
    const p = await payer();
    const { facility } = await propose(p, 1000, { actorUserId: dual });
    await expect(change(facility.id, "approve", dual, 1)).rejects.toThrow("credit_self_approval_forbidden");
    await expect(a.$executeRaw`UPDATE CreditFacility SET state = 'approved', approvedByUserId = proposedByUserId, approvalRef = 'x', approvedLimitFen = limitFen,
      approvedAt = NOW(3), version = version + 1 WHERE id = ${facility.id}`).rejects.toThrow(/CreditFacility_maker_checker_check/);
    expect(await a.creditFacility.findUniqueOrThrow({ where: { id: facility.id } })).toMatchObject({ state: "draft", version: 1 });
    await expect(change(facility.id, "approve", checker, 1)).resolves.toMatchObject({ state: "approved" });
  });
  it("replays a proposal with the same key and content, conflicts otherwise", async () => {
    const p = await payer();
    const input = { actorUserId: maker, payerAccountId: p, limitFen: fen(500), validUntil: null, operationKey: `cutoff:${run}`, evidenceRef: "owner-ruling:x" };
    const first = await proposeCreditFacility(a, input);
    await expect(proposeCreditFacility(a, input)).resolves.toMatchObject({ replayed: true, facility: { id: first.facility.id } });
    await expect(proposeCreditFacility(a, { ...input, limitFen: fen(501) })).rejects.toThrow("credit_operation_conflict");
  });
  it("replays a concurrent identical proposal from a current read: one creates, the other replays, no P2025", async () => {
    const p = await payer();
    const input = { actorUserId: maker, payerAccountId: p, limitFen: fen(700), validUntil: null, operationKey: `race:${run}`, evidenceRef: "owner-ruling:x" };
    const c = new PrismaClient({ datasources: { db: { url } } });
    try {
      // Barrier: hold the payer lock until both proposals wait on it, so both transactions are open before either commits.
      let release = () => {}, held = () => {};
      const isHeld = new Promise<void>(resolve => { held = resolve; });
      const barrier = c.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${p} FOR UPDATE`;
        held();
        await new Promise<void>(resolve => { release = resolve; });
      }, { timeout: 10000 });
      await isHeld;
      const racing = [a, b].map(client => proposeCreditFacility(client, input));
      await sleep(1000);
      release();
      await barrier;
      const results = await Promise.all(racing);
      expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
      expect(results[0].facility).toMatchObject({ id: results[1].facility.id, state: "draft", limitFen: fen(700), usedFen: fen(0), version: 1 });
      expect(await a.creditFacility.count({ where: { payerAccountId: p } })).toBe(1);
    } finally { await c.$disconnect(); }
  });
  it("draws as one balanced entry into the wallet, replays by sourceRef and fails closed beyond the line", async () => {
    const p = await payer();
    const facility = await activeFacility(p, 1000);
    const first = await draw(p, 300, "settle-1");
    expect(first).toMatchObject({ facilityId: facility.id, borrowedFen: fen(300), walletCovered: false, replayed: false });
    const txn = await a.fundsTransaction.findUniqueOrThrow({ where: { id: first.fundsTransactionId }, include: { entries: true } });
    expect(txn).toMatchObject({ kind: "credit_draw", operationKey: "credit-draw:settle-1", evidenceRef: `credit-facility:${facility.id}` });
    expect(txn.entries.map(e => [e.account, e.direction, e.amountFen]).sort()).toEqual([
      ["credit_receivable", "debit", fen(300)], ["customer_wallet_available", "credit", fen(300)]]);
    await expect(draw(p, 300, "settle-1")).resolves.toMatchObject({ fundsTransactionId: first.fundsTransactionId, replayed: true });
    await expect(draw(p, 301, "settle-1")).rejects.toThrow("funds_operation_conflict"); // the stand-in charge conflicts
    await expect(draw(p, 299, "settle-1")).rejects.toThrow("credit_operation_conflict"); // recorded draw exceeds the charge
    await expect(draw(p, 701, "settle-2")).rejects.toThrow("credit_insufficient");
    await draw(p, 700, "settle-2");
    await expect(draw(p, 1, "settle-3")).rejects.toThrow("credit_insufficient");
    expect(await available(p)).toBe(fen(0));
    expect(await a.creditFacility.findUniqueOrThrow({ where: { id: facility.id } })).toMatchObject({ usedFen: fen(1000), limitFen: fen(1000) });
    expect([await projection(p, "credit_receivable"), await projection(p, "customer_wallet_available")]).toEqual([fen(1000), fen(0)]);
    expect((await a.$transaction(tx => recomputeFundsProjection(tx, p))).consistent).toBe(true);
    // Only the credit module may post a draw; a credit draw is never reversed through the generic correction path.
    await expect(a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: p, kind: "credit_draw", operationKey: "x:1",
      actor: SETTLE, evidenceRef: "e", entries: [{ account: "credit_receivable", direction: "debit", amountFen: fen(1) },
        { account: "customer_wallet_available", direction: "credit", amountFen: fen(1) }] }))).rejects.toThrow("funds_accounts_not_allowed");
    await expect(draw(id("missing"), 1, "settle-9")).rejects.toThrow("payer_account_unavailable");
    await expect(draw((await payer()), 1, "settle-9")).rejects.toThrow("credit_not_active");
    const suspended = await payer();
    await activeFacility(suspended, 1000);
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended', version = version + 1 WHERE id = ${suspended}`;
    await expect(draw(suspended, 1, "settle-s")).rejects.toThrow("payer_account_unavailable");
    expect(await available(suspended)).toBe(fen(0));
  });
  it("lets only one of two concurrent draws through when both together exceed the remaining line", async () => {
    const p = await payer();
    await activeFacility(p, 1000);
    const pair = await Promise.allSettled([draw(p, 600, "race-a", a), draw(p, 600, "race-b", b)]);
    expect(pair.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(String((pair.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/credit_insufficient/);
    expect(await available(p)).toBe(fen(400));
    expect(await a.fundsTransaction.count({ where: { payerAccountId: p, kind: "credit_draw" } })).toBe(1);
    expect(await projection(p, "credit_receivable")).toBe(fen(600));
  });
  it("serializes revoke behind an in-flight draw: usage is kept, later draws refuse, replays still replay", async () => {
    const p = await payer();
    const facility = await activeFacility(p, 1000);
    let revoke: Promise<unknown> = Promise.resolve();
    await a.$transaction(async (tx: Prisma.TransactionClient) => {
      await settleTx(tx, p, 250, "inflight-1");
      revoke = change(facility.id, "revoke", checker, 3, { client: b }); // blocks on the PayerAccount lock held here
      await sleep(300);
    }, { timeout: 10000 });
    const revoked = await revoke;
    expect(revoked).toMatchObject({ state: "revoked", usedFen: fen(250), limitFen: fen(1000), activePayerAccountId: null });
    await expect(draw(p, 1, "after-revoke")).rejects.toThrow("credit_not_active");
    expect(await available(p)).toBe(fen(0));
    await expect(draw(p, 250, "inflight-1")).resolves.toMatchObject({ replayed: true, facilityId: facility.id });
  });
  it("borrows only the wallet shortfall and writes nothing when the wallet covers the charge", async () => {
    const p = await payer();
    await activeFacility(p, 1000);
    const topup = (amount: number, key: string) => a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: p,
      kind: "topup", operationKey: key, actor: SETTLE, evidenceRef: "verified-payment:sf", entries: [{ account: "topup_clearing",
        direction: "debit", amountFen: fen(amount) }, { account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) }] }));
    await topup(200, "pay:sf");
    await expect(draw(p, 500, "sf-1")).resolves.toMatchObject({ borrowedFen: fen(300), walletCovered: false });
    await topup(100, "pay:sf2");
    await expect(draw(p, 100, "sf-2")).resolves.toEqual({ borrowedFen: fen(0), facilityId: null, fundsTransactionId: null,
      walletCovered: true, replayed: false });
    expect(await a.fundsTransaction.count({ where: { payerAccountId: p, kind: "credit_draw" } })).toBe(1);
    expect(await available(p)).toBe(fen(700));
  });
  it("lets a reservation held before a revoke or reduce settle up to the approved limit, never beyond", async () => {
    const p = await payer();
    const facility = await activeFacility(p, 1000);
    const reservedAt = await dbNow();
    await sleep(20);
    await change(facility.id, "reduce", checker, 3, { limitFen: fen(100) });
    await expect(settleIn(a, p, 600, "held-1", reservedAt)).resolves.toMatchObject({ borrowedFen: fen(600), facilityId: facility.id });
    expect(await available(p)).toBe(fen(0)); // used 600 > reduced limit 100: clamped, never negative
    await expect(draw(p, 1, "after-reduce")).rejects.toThrow("credit_insufficient"); // a new reservation sees the reduced line
    await expect(settleIn(a, p, 1, "future", new Date(Date.now() + 3600_000))).rejects.toThrow("credit_input_invalid");
    await change(facility.id, "revoke", checker, 4);
    await expect(settleIn(a, p, 401, "held-2", reservedAt)).rejects.toThrow("credit_insufficient"); // 600 + 401 > approved 1000
    await expect(settleIn(a, p, 400, "held-2", reservedAt)).resolves.toMatchObject({ borrowedFen: fen(400) });
    expect(await a.creditFacility.findUniqueOrThrow({ where: { id: facility.id } })).toMatchObject({ state: "revoked",
      limitFen: fen(100), approvedLimitFen: fen(1000), usedFen: fen(1000) });
    await expect(draw(p, 1, "after-revoke")).rejects.toThrow("credit_not_active");
    await expect(a.$executeRaw`UPDATE CreditFacility SET usedFen = 1001 WHERE id = ${facility.id}`).rejects.toThrow(/credit_facility_guard/);
    await expect(a.$executeRaw`INSERT INTO CreditFacility (id,payerAccountId,state,limitFen,activePayerAccountId,activatedAt,
      operationKey,contentHash,proposedByUserId,evidenceRef,updatedAt) VALUES (${id("raw")},${p},'active',5,${p},NOW(3),'raw',
      ${"a".repeat(64)},${maker},'e',NOW(3))`).rejects.toThrow(/credit_facility_guard/);
  });
  it("reduces only downward and never below used; one drawable facility per payer; expiry by term only", async () => {
    const p = await payer();
    const facility = await activeFacility(p, 1000);
    await draw(p, 400, "used-1");
    await expect(change(facility.id, "reduce", checker, 3, { limitFen: fen(399) })).rejects.toThrow("credit_reduce_below_used");
    await expect(change(facility.id, "reduce", checker, 3, { limitFen: fen(1000) })).rejects.toThrow("credit_reduce_invalid");
    await expect(change(facility.id, "reduce", checker, 3)).rejects.toThrow("credit_input_invalid");
    await expect(change(facility.id, "revoke", checker, 2)).rejects.toThrow("credit_version_conflict");
    expect(await change(facility.id, "reduce", maker, 3, { limitFen: fen(400) })).toMatchObject({ state: "reduced", limitFen: fen(400) });
    expect(await available(p)).toBe(fen(0));
    await expect(change(facility.id, "expire", checker, 4)).rejects.toThrow("credit_not_expired");
    const second = await propose(p, 500);
    await change(second.facility.id, "approve", checker, 1);
    await expect(change(second.facility.id, "activate", maker, 2)).rejects.toThrow("credit_active_exists");
    await change(facility.id, "revoke", checker, 4);
    await change(second.facility.id, "activate", maker, 2);
    expect(await available(p)).toBe(fen(500)); // the revoked line's 400 used stays outstanding on the old facility
    expect(await projection(p, "credit_receivable")).toBe(fen(400));
    // A term-limited line stops drawing at validUntil (DB UTC time) and may then be marked expired.
    const q = await payer();
    const [{ soon }] = await a.$queryRaw<Array<{ soon: Date }>>`SELECT DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1500000 MICROSECOND) AS soon`;
    const termed = await activeFacility(q, 300, soon);
    await expect(change(termed.id, "expire", checker, 3)).rejects.toThrow("credit_not_expired");
    await sleep(1700);
    expect(await available(q)).toBe(fen(0));
    await expect(draw(q, 1, "late")).rejects.toThrow("credit_not_active");
    expect(await change(termed.id, "expire", checker, 3)).toMatchObject({ state: "expired", activePayerAccountId: null });
  });
  it("keeps terms immutable, history undeletable and terminal states final in the database", async () => {
    const p = await payer();
    const facility = await activeFacility(p, 1000);
    await draw(p, 10, "imm-1");
    for (const statement of [
      a.$executeRaw`UPDATE CreditFacility SET limitFen = 2000, version = version + 1 WHERE id = ${facility.id}`,
      a.$executeRaw`UPDATE CreditFacility SET usedFen = 0, version = version + 1 WHERE id = ${facility.id}`,
      a.$executeRaw`UPDATE CreditFacility SET state = 'approved', activePayerAccountId = NULL, version = version + 1 WHERE id = ${facility.id}`,
      a.$executeRaw`DELETE FROM CreditFacility WHERE id = ${facility.id}`]) {
      await expect(statement).rejects.toThrow(/credit_facility_guard|credit_facility_no_delete/);
    }
    await expect(a.$executeRaw`UPDATE CreditFacility SET limitFen = 1000, approvedLimitFen = 999, version = version + 1
      WHERE id = ${facility.id}`).rejects.toThrow(/credit_facility_guard/);
    await change(facility.id, "revoke", checker, 3);
    await expect(a.$executeRaw`UPDATE CreditFacility SET state = 'active', activePayerAccountId = payerAccountId, closedAt = NULL,
      version = version + 1 WHERE id = ${facility.id}`).rejects.toThrow(/credit_facility_guard/);
    await expect(change(facility.id, "revoke", checker, 4)).rejects.toThrow("credit_transition_invalid");
  });
});
