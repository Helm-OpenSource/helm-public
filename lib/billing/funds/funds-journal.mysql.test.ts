import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPayerAccount } from "../payer/payer-accounts";
import { postFundsTransactionInTransaction, recomputeFundsProjection, reverseFundsTransactionInTransaction,
  type FundsActor } from "./funds-journal";

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

describe.skipIf(!url)("funds journal against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const ws = `funds-ws-${run}`, owner = `funds-owner-${run}`;
  const actor: FundsActor = { type: "SYSTEM", ref: "synthetic-payment-verifier" };
  const fen = (value: number) => BigInt(value);
  let a: PrismaClient, b: PrismaClient;
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic funds',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${owner},'Synthetic',${`${owner}@example.invalid`},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${run}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
  });
  // Journal rows are append-only by trigger, so this synthetic database keeps them; it is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function payer(mode: "off" | "shadow" | "enforce" = "enforce") {
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-funds" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // no mode API in S2-a
    return account.id;
  }
  const topup = (payerAccountId: string, operationKey: string, amount: number, client = a, evidenceRef = "verified-payment:synthetic") =>
    client.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId, kind: "topup", operationKey, actor, evidenceRef,
      entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(amount) },
        { account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) }] }));
  const debitWallet = (payerAccountId: string, operationKey: string, amount: number, client = a) =>
    client.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId, kind: "correction", operationKey, actor,
      evidenceRef: "correction:approved-synthetic", entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: fen(amount) },
        { account: "correction_suspense", direction: "credit", amountFen: fen(amount) }] }));
  const wallet = async (payerAccountId: string) => (await a.fundsAccountProjection.findUnique({
    where: { payerAccountId_account: { payerAccountId, account: "customer_wallet_available" } } }))?.balanceFen ?? fen(0);
  const counts = async (payerAccountId: string) => {
    const ids = (await a.fundsTransaction.findMany({ where: { payerAccountId }, select: { id: true } })).map(t => t.id);
    return { transactions: ids.length, entries: await a.fundsJournalEntry.count({ where: { payerAccountId } }),
      audits: await a.auditLog.count({ where: { relatedObjectId: payerAccountId, targetType: "FundsTransaction" } }),
      outbox: await a.billingOutbox.count({ where: { aggregateId: { in: ids } } }) };
  };
  const recompute = (payerAccountId: string) => a.$transaction(tx => recomputeFundsProjection(tx, payerAccountId));

  it("posts a balanced topup: entries, projection, audit and outbox commit together", async () => {
    const id = await payer();
    const posted = await topup(id, "pay:wx/t1", 12345);
    expect(posted.replayed).toBe(false);
    expect(posted.entries.map(e => [e.lineNo, e.account, e.direction, e.amountFen])).toEqual([
      [1, "customer_wallet_available", "credit", fen(12345)], [2, "topup_clearing", "debit", fen(12345)]]);
    expect(await wallet(id)).toBe(fen(12345));
    expect(await counts(id)).toEqual({ transactions: 1, entries: 2, audits: 1, outbox: 1 });
    const outbox = await a.billingOutbox.findFirstOrThrow({ where: { aggregateId: posted.transaction.id } });
    expect(outbox).toMatchObject({ aggregateType: "FundsTransaction", eventType: "funds.posted", deliveredAt: null });
    expect(JSON.parse(outbox.payload)).toMatchObject({ transactionId: posted.transaction.id, contentHash: posted.transaction.contentHash });
    expect((await recompute(id)).consistent).toBe(true);
  });
  it("rejects unbalanced input and refuses payers that are off, suspended or unknown", async () => {
    const id = await payer();
    await expect(a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: id, kind: "topup", operationKey: "pay:u",
      actor, evidenceRef: "e", entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(10) },
        { account: "customer_wallet_available", direction: "credit", amountFen: fen(9) }] }))).rejects.toThrow("funds_unbalanced");
    const off = await payer("off");
    await expect(topup(off, "pay:off", 10)).rejects.toThrow("payer_billing_off");
    const shadow = await payer("shadow");
    await expect(topup(shadow, "pay:shadow", 10)).resolves.toMatchObject({ replayed: false });
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${shadow}`;
    await expect(topup(shadow, "pay:shadow-2", 10)).rejects.toThrow("payer_account_unavailable");
    await expect(topup(`missing-${run}`, "pay:x", 10)).rejects.toThrow("payer_account_unavailable");
    for (const p of [id, off]) expect(await counts(p)).toEqual({ transactions: 0, entries: 0, audits: 0, outbox: 0 });
  });
  it("replays the same key and content without a second effect; same key with other content is refused", async () => {
    const id = await payer();
    const first = await topup(id, "pay:wx/dup", 500);
    const again = await topup(id, "pay:wx/dup", 500, b);
    expect(again.replayed).toBe(true);
    expect(again.transaction.id).toBe(first.transaction.id);
    expect(again.entries.map(e => e.id)).toEqual(first.entries.map(e => e.id));
    await expect(topup(id, "pay:wx/dup", 501)).rejects.toThrow("funds_operation_conflict");
    await expect(topup(id, "pay:wx/dup", 500, a, "verified-payment:other")).rejects.toThrow("funds_operation_conflict");
    await expect(topup(id, "PAY:WX/DUP", 500)).resolves.toMatchObject({ replayed: false }); // keys are byte-exact
    expect(await wallet(id)).toBe(fen(1000));
    expect(await counts(id)).toEqual({ transactions: 2, entries: 4, audits: 2, outbox: 2 });
  });
  it("lets exactly one of two connections debit the wallet when both would overdraw it", async () => {
    const id = await payer();
    await topup(id, "pay:seed", 100);
    const session = async (client: PrismaClient) => (await client.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`)[0].id;
    expect(await session(a)).not.toBe(await session(b));
    const pair = await Promise.allSettled([debitWallet(id, "fix:a", 70, a), debitWallet(id, "fix:b", 70, b)]);
    expect(pair.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(String((pair.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/funds_insufficient/);
    expect(await wallet(id)).toBe(fen(30));
    const many = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => debitWallet(id, `fix:m${i}`, 10, i % 2 ? a : b)));
    expect(many.filter(r => r.status === "fulfilled")).toHaveLength(3);
    expect(await wallet(id)).toBe(fen(0));
    expect((await recompute(id)).consistent).toBe(true);
  });
  it("rolls back entries, projection, audit and outbox together when the transaction fails", async () => {
    const id = await payer();
    await topup(id, "pay:base", 50);
    const before = await counts(id);
    await expect(a.$transaction(async tx => {
      await postFundsTransactionInTransaction(tx, { payerAccountId: id, kind: "topup", operationKey: "pay:rolled", actor, evidenceRef: "e",
        entries: [{ account: "topup_clearing", direction: "debit", amountFen: fen(7) }, { account: "customer_wallet_available", direction: "credit", amountFen: fen(7) }] });
      throw new Error("synthetic_after_write_failure");
    })).rejects.toThrow("synthetic_after_write_failure");
    expect(await counts(id)).toEqual(before);
    expect(await wallet(id)).toBe(fen(50));
    expect(await a.fundsTransaction.count({ where: { payerAccountId: id, operationKey: "pay:rolled" } })).toBe(0);
  });
  it("recompute equals the projection after many random postings and detects injected drift", async () => {
    const id = await payer();
    let expected = 0, seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let i = 0; i < 40; i += 1) {
      const amount = 1 + (next() % 5000);
      if (next() % 3 === 0) {
        const ok = await debitWallet(id, `fix:r${i}`, amount, i % 2 ? a : b).then(() => true, (e: unknown) => {
          expect(String(e)).toMatch(/funds_insufficient/); return false; });
        if (ok) expected -= amount;
      } else { await topup(id, `pay:r${i}`, amount, i % 2 ? a : b); expected += amount; }
    }
    const report = await recompute(id);
    expect(report).toMatchObject({ consistent: true, unbalancedTransactionIds: [] });
    expect(report.accounts.find(x => x.account === "customer_wallet_available")?.journalFen).toBe(fen(expected));
    expect(await wallet(id)).toBe(fen(expected));
    await a.$executeRaw`UPDATE FundsAccountProjection SET balanceFen = balanceFen + 1 WHERE payerAccountId = ${id} AND account = 'topup_clearing'`;
    const drifted = await recompute(id);
    expect(drifted.consistent).toBe(false);
    expect(drifted.accounts.find(x => x.account === "topup_clearing")?.driftFen).toBe(fen(1));
  });
  it("reverses by appending a mirror transaction; the original rows stay unchanged", async () => {
    const id = await payer();
    const original = await topup(id, "pay:rev", 800);
    const snapshot = await a.fundsJournalEntry.findMany({ where: { transactionId: original.transaction.id }, orderBy: { lineNo: "asc" } });
    const reverse = (operationKey: string, originalTransactionId = original.transaction.id) => a.$transaction(tx =>
      reverseFundsTransactionInTransaction(tx, { payerAccountId: id, originalTransactionId, operationKey, actor, evidenceRef: "correction:reverse" }));
    const reversal = await reverse("rev:1");
    expect(reversal.transaction).toMatchObject({ kind: "correction", reversalOfId: original.transaction.id });
    expect(reversal.entries.map(e => [e.account, e.direction])).toEqual([["customer_wallet_available", "debit"], ["topup_clearing", "credit"]]);
    expect(await wallet(id)).toBe(fen(0));
    expect(await a.fundsJournalEntry.findMany({ where: { transactionId: original.transaction.id }, orderBy: { lineNo: "asc" } })).toEqual(snapshot);
    expect((await reverse("rev:1")).replayed).toBe(true);
    await expect(reverse("rev:2")).rejects.toThrow("funds_already_reversed");
    await expect(reverse("rev:3", reversal.transaction.id)).rejects.toThrow("funds_reversal_invalid");
    const spent = await topup(id, "pay:spent", 300);
    await debitWallet(id, "fix:spend", 200);
    await expect(reverse("rev:4", spent.transaction.id)).rejects.toThrow("funds_insufficient");
    expect((await recompute(id)).consistent).toBe(true);
  });
  it("enforces append-only rows, key uniqueness and the non-negative wallet in the database itself", async () => {
    const id = await payer();
    const posted = await topup(id, "pay:db", 40);
    await expect(a.$executeRaw`UPDATE FundsJournalEntry SET amountFen = 1 WHERE transactionId = ${posted.transaction.id}`).rejects.toThrow(/funds_entry_immutable/);
    await expect(a.$executeRaw`DELETE FROM FundsJournalEntry WHERE transactionId = ${posted.transaction.id}`).rejects.toThrow(/funds_entry_immutable/);
    await expect(a.$executeRaw`UPDATE FundsTransaction SET evidenceRef = 'x' WHERE id = ${posted.transaction.id}`).rejects.toThrow(/funds_transaction_immutable/);
    await expect(a.$executeRaw`DELETE FROM FundsTransaction WHERE id = ${posted.transaction.id}`).rejects.toThrow(/funds_transaction_immutable/);
    await expect(a.fundsTransaction.create({ data: { payerAccountId: id, kind: "topup", operationKey: "pay:db", contentHash: "0".repeat(64),
      evidenceRef: "e", createdBy: "SYSTEM:x" } })).rejects.toMatchObject({ code: "P2002" });
    await expect(a.fundsJournalEntry.create({ data: { transactionId: posted.transaction.id, lineNo: 9, payerAccountId: id,
      account: "correction_suspense", direction: "debit", amountFen: fen(0) } })).rejects.toThrow(/FundsJournalEntry_amount_check/);
    await expect(a.$executeRaw`UPDATE FundsAccountProjection SET balanceFen = -1 WHERE payerAccountId = ${id} AND account = 'customer_wallet_available'`)
      .rejects.toThrow(/FundsAccountProjection_wallet_nonnegative_check/);
    expect(await wallet(id)).toBe(fen(40));
  });
});
