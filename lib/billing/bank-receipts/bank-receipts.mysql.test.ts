import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { getWalletInTransaction } from "../wallet/wallet";
import { draftBankReceipt, grantPlatformFinanceRole, revokePlatformFinanceRole, reviewBankReceipt,
  reviewBankReceiptInTransaction, type BankReceiptDraftInput } from "./bank-receipts";

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

describe.skipIf(!url)("bank receipts and wallet against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `br-${name}-${run}`;
  const [admin, maker, checker, checker2, dual, former, owner, member, otherOwner] =
    ["admin", "maker", "checker", "checker2", "dual", "former", "owner", "member", "other"].map(id);
  const ws = id("ws"), otherWs = id("ws2");
  let a: PrismaClient, b: PrismaClient, reserved = "";
  let txnSeq = 0;
  const user = (userId: string) => a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${userId},'Synthetic',${`${userId}@example.invalid`},NOW(3))`;
  const membership = (workspaceId: string, userId: string, role: string) => a.$executeRaw`
    INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${workspaceId}-${userId}`},${workspaceId},${userId},${role},'ACTIVE',NOW(3))`;
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    const existing = await a.workspace.findUnique({ where: { systemKey: "helm_reserved_primary" }, select: { id: true, status: true } });
    reserved = existing?.id ?? id("reserved");
    if (!existing) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,workspaceClass,systemKey,updatedAt)
      VALUES (${reserved},'Synthetic reserved',${reserved},'HELM_RESERVED','helm_reserved_primary',NOW(3))`;
    else expect(existing.status).toBe("ACTIVE");
    for (const w of [ws, otherWs]) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${w},'Synthetic customer',${w},NOW(3))`;
    for (const u of [admin, maker, checker, checker2, dual, former, owner, member, otherOwner]) await user(u);
    await membership(reserved, admin, "OWNER");
    for (const u of [maker, checker, checker2, dual, former]) await membership(reserved, u, "MEMBER");
    await membership(ws, owner, "OWNER"); await membership(ws, member, "MEMBER"); await membership(otherWs, otherOwner, "OWNER");
    const grant = (userId: string, role: "maker" | "checker") => grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    await grant(maker, "maker"); await grant(checker, "checker"); await grant(checker2, "checker"); await grant(dual, "maker"); await grant(dual, "checker");
  });
  // Receipts and journal rows are append-only by trigger, so this synthetic database keeps them; it is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  async function payer(workspaceId = ws, actor = owner, mode = "enforce") {
    const account = await createPayerAccount(a, { actorUserId: actor, workspaceId, kind: "enterprise_contract", contractSubjectRef: "subject-bank" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // no mode API yet
    return account.id;
  }
  const draft = (payerAccountId: string, extra: Partial<BankReceiptDraftInput> = {}) => draftBankReceipt(a, { actorUserId: maker,
    payerAccountId, receivingAccountRef: "recv:synthetic-1", bankTxnRef: `bank-${run}-${(txnSeq += 1)}`, amountFen: BigInt(25000),
    valueDate: "2026-11-09", evidenceRef: "bank-statement:synthetic", ...extra });
  const review = (receiptId: string, actorUserId: string, decision: "approve" | "reject", client = a, expectedVersion = 1) =>
    reviewBankReceipt(client, { actorUserId, receiptId, decision, expectedVersion, evidenceRef: "review:synthetic" });
  const wallet = async (payerAccountId: string) => (await a.fundsAccountProjection.findUnique({
    where: { payerAccountId_account: { payerAccountId, account: "customer_wallet_available" } } }))?.balanceFen ?? BigInt(0);
  const effects = async (payerAccountId: string) => ({ funds: await a.fundsTransaction.count({ where: { payerAccountId } }),
    outbox: await a.billingOutbox.count({ where: { payload: { contains: payerAccountId } } }),
    audits: await a.auditLog.count({ where: { relatedObjectId: payerAccountId } }) });

  it("lets only the reserved-workspace OWNER grant finance roles, never to themselves or outsiders", async () => {
    await expect(grantPlatformFinanceRole(a, { actorUserId: owner, userId: member, role: "maker", evidenceRef: "e" })).rejects.toThrow("finance_grant_forbidden");
    await expect(grantPlatformFinanceRole(a, { actorUserId: admin, userId: admin, role: "maker", evidenceRef: "e" })).rejects.toThrow("finance_grant_forbidden");
    await expect(grantPlatformFinanceRole(a, { actorUserId: admin, userId: owner, role: "checker", evidenceRef: "e" })).rejects.toThrow("finance_grant_forbidden");
    await expect(grantPlatformFinanceRole(a, { actorUserId: admin, userId: maker, role: "maker", evidenceRef: "e" })).rejects.toThrow("finance_grant_exists");
    await expect(a.$executeRaw`INSERT INTO PlatformFinanceGrant (id,userId,role,activeUserId,grantedByUserId,evidenceRef,updatedAt)
      VALUES (${id("self")},${admin},'maker',${admin},${admin},'e',NOW(3))`).rejects.toThrow(/PlatformFinanceGrant_no_self_grant_check/);
  });
  it("refuses workspace OWNERs, members without the role, revoked grants and service identities", async () => {
    const p = await payer();
    for (const actorUserId of [owner, checker, "SYSTEM:payment-verifier"]) {
      await expect(draft(p, { actorUserId })).rejects.toThrow("bank_receipt_forbidden");
    }
    const receipt = await draft(p);
    for (const actor of [owner, maker, otherOwner, "SYSTEM:payment-verifier"]) {
      await expect(review(receipt.id, actor, "approve")).rejects.toThrow("bank_receipt_forbidden");
    }
    const extra = await grantPlatformFinanceRole(a, { actorUserId: admin, userId: former, role: "checker", evidenceRef: "e" });
    await expect(revokePlatformFinanceRole(a, { actorUserId: owner, grantId: extra.id, expectedVersion: 1, evidenceRef: "e" })).rejects.toThrow("finance_grant_forbidden");
    await revokePlatformFinanceRole(a, { actorUserId: admin, grantId: extra.id, expectedVersion: 1, evidenceRef: "e" });
    await expect(review(receipt.id, former, "approve")).rejects.toThrow("bank_receipt_forbidden"); // revoked grant
    // A grant stops working once its holder leaves the reserved workspace, without a separate revoke.
    await a.$executeRaw`UPDATE Membership SET status = 'INACTIVE' WHERE workspaceId = ${reserved} AND userId = ${checker2}`;
    await expect(review(receipt.id, checker2, "approve")).rejects.toThrow("bank_receipt_forbidden");
    await a.$executeRaw`UPDATE Membership SET status = 'ACTIVE' WHERE workspaceId = ${reserved} AND userId = ${checker2}`;
    expect((await a.bankReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).state).toBe("drafted");
    expect(await effects(p)).toMatchObject({ funds: 0 });
  });
  it("refuses self-review in the service and in the database CHECK", async () => {
    const p = await payer();
    const own = await draft(p, { actorUserId: dual });
    await expect(review(own.id, dual, "approve")).rejects.toThrow("bank_receipt_self_review_forbidden");
    await expect(review(own.id, dual, "reject")).rejects.toThrow("bank_receipt_self_review_forbidden");
    await expect(a.$executeRaw`UPDATE BankReceipt SET state = 'rejected', activeBankTxnRef = NULL, reviewedByUserId = draftedByUserId,
      reviewedAt = NOW(3), version = version + 1 WHERE id = ${own.id}`).rejects.toThrow(/BankReceipt_maker_checker_check/);
    expect(await a.bankReceipt.findUniqueOrThrow({ where: { id: own.id } })).toMatchObject({ state: "drafted", version: 1 });
    await expect(review(own.id, checker, "approve")).resolves.toMatchObject({ receipt: { state: "posted" } });
  });
  it("posts exactly once when two checkers approve concurrently; the same checker replays", async () => {
    const p = await payer();
    const receipt = await draft(p, { amountFen: BigInt(88800) });
    const pair = await Promise.allSettled([review(receipt.id, checker, "approve", a), review(receipt.id, checker2, "approve", b)]);
    expect(pair.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(String((pair.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/bank_receipt_not_pending/);
    const row = await a.bankReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(row).toMatchObject({ state: "posted", version: 3 });
    const funds = await a.fundsTransaction.findMany({ where: { payerAccountId: p }, include: { entries: true } });
    expect(funds).toHaveLength(1);
    expect(funds[0]).toMatchObject({ id: row.fundsTransactionId, kind: "bank_topup", operationKey: `bank-receipt:${receipt.id}` });
    expect(funds[0].entries.map(e => [e.account, e.direction, e.amountFen]).sort()).toEqual([
      ["bank_clearing", "debit", BigInt(88800)], ["customer_wallet_available", "credit", BigInt(88800)]]);
    expect(await wallet(p)).toBe(BigInt(88800));
    const winner = row.reviewedByUserId as string;
    await expect(review(receipt.id, winner, "approve")).resolves.toMatchObject({ replayed: true });
    await expect(review(receipt.id, winner, "reject")).rejects.toThrow("bank_receipt_not_pending");
    expect(await effects(p)).toMatchObject({ funds: 1, outbox: 1 });
    const again = await draft(p); // same checker racing itself: one posts, the other replays the current (not snapshot) row
    const same = await Promise.all([review(again.id, checker, "approve", a), review(again.id, checker, "approve", b)]);
    expect(same.map(r => [r.replayed, r.receipt.state]).sort()).toEqual([[false, "posted"], [true, "posted"]]);
  });
  it("never posts on reject, frees the bank transaction key, and refuses duplicates while a receipt is live", async () => {
    const p = await payer();
    const ref = `bank-dup-${run}`;
    const first = await draft(p, { bankTxnRef: ref });
    await expect(draft(p, { bankTxnRef: ref })).rejects.toThrow("bank_receipt_duplicate");
    await expect(draft(p, { bankTxnRef: ref, receivingAccountRef: "recv:synthetic-2" })).resolves.toMatchObject({ state: "drafted" });
    await expect(review(first.id, checker, "reject")).resolves.toMatchObject({ receipt: { state: "rejected", activeBankTxnRef: null } });
    await expect(review(first.id, checker2, "approve", a, 2)).rejects.toThrow("bank_receipt_not_pending");
    expect(await effects(p)).toMatchObject({ funds: 0, outbox: 0 });
    const redraft = await draft(p, { bankTxnRef: ref });
    await review(redraft.id, checker, "approve");
    await expect(draft(p, { bankTxnRef: ref })).rejects.toThrow("bank_receipt_duplicate");
    expect(await wallet(p)).toBe(BigInt(25000));
  });
  it("rolls back receipt state, funds, audit and outbox when posting fails or the transaction aborts", async () => {
    const p = await payer();
    const receipt = await draft(p);
    const before = await effects(p);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'off' WHERE id = ${p}`;
    await expect(review(receipt.id, checker, "approve")).rejects.toThrow("payer_billing_off");
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${p}`;
    await expect(a.$transaction(async tx => {
      await reviewBankReceiptInTransaction(tx, { actorUserId: checker, receiptId: receipt.id, decision: "approve", expectedVersion: 1, evidenceRef: "e" });
      throw new Error("synthetic_after_post_failure");
    })).rejects.toThrow("synthetic_after_post_failure");
    expect(await a.bankReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ state: "drafted", version: 1, reviewedByUserId: null });
    expect(await effects(p)).toEqual(before);
    expect(await wallet(p)).toBe(BigInt(0));
    await expect(review(receipt.id, checker, "approve", a, 2)).rejects.toThrow("bank_receipt_version_conflict");
    await expect(review(receipt.id, checker, "approve")).resolves.toMatchObject({ replayed: false });
  });
  it("keeps decided receipts immutable and undeletable in the database", async () => {
    const p = await payer();
    const receipt = await draft(p);
    await review(receipt.id, checker, "approve");
    await expect(a.$executeRaw`UPDATE BankReceipt SET amountFen = 1, version = version + 1 WHERE id = ${receipt.id}`).rejects.toThrow(/bank_receipt_immutable/);
    await expect(a.$executeRaw`DELETE FROM BankReceipt WHERE id = ${receipt.id}`).rejects.toThrow(/bank_receipt_no_delete/);
    const pending = await draft(p);
    await expect(a.$executeRaw`UPDATE BankReceipt SET state = 'posted', reviewedByUserId = ${checker}, reviewedAt = NOW(3),
      fundsTransactionId = 'x', version = version + 1 WHERE id = ${pending.id}`).rejects.toThrow(/bank_receipt_immutable/);
  });
  it("returns the server-resolved wallet with keyset pagination and never another workspace's payer", async () => {
    const p = await payer();
    const other = await payer(otherWs, otherOwner);
    for (const [payerAccountId, scopeRef, actorUserId] of [[p, ws, owner], [other, otherWs, otherOwner]]) {
      await bindScope(a, { actorUserId, payerAccountId, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef, evidenceRef: "contract:synthetic" });
    }
    for (let i = 0; i < 3; i += 1) await review((await draft(p, { amountFen: BigInt(100 + i) })).id, checker, "approve");
    for (let i = 0; i < 2; i += 1) await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: p, kind: "correction",
      operationKey: `fix:w${i}`, actor: { type: "SYSTEM", ref: "synthetic" }, evidenceRef: "correction:synthetic",
      entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: BigInt(10) }, { account: "correction_suspense", direction: "credit", amountFen: BigInt(10) }] }));
    const otherFunds = await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: other, kind: "topup", operationKey: "pay:o",
      actor: { type: "SYSTEM", ref: "synthetic" }, evidenceRef: "verified-payment:o",
      entries: [{ account: "topup_clearing", direction: "debit", amountFen: BigInt(7) }, { account: "customer_wallet_available", direction: "credit", amountFen: BigInt(7) }] }));
    const read = (query: Partial<Parameters<typeof getWalletInTransaction>[1]> = {}) =>
      a.$transaction(tx => getWalletInTransaction(tx, { workspaceId: ws, actorUserId: owner, ...query }));
    const page1 = await read({ limit: 2 });
    expect(page1).toMatchObject({ currency: "CNY", billingMode: "enforce", availableFen: "283" });
    expect(page1.transactions.map(t => t.walletDeltaFen)).toEqual(["-10", "-10"]);
    const page2 = await read({ limit: 2, cursor: page1.nextCursor });
    const page3 = await read({ limit: 2, cursor: page2.nextCursor });
    expect([...page2.transactions, ...page3.transactions].map(t => [t.kind, t.walletDeltaFen])).toEqual([
      ["bank_topup", "102"], ["bank_topup", "101"], ["bank_topup", "100"]]);
    expect(page3.nextCursor).toBeNull();
    expect(new Set([...page1.transactions, ...page2.transactions, ...page3.transactions].map(t => t.id)).size).toBe(5);
    expect(JSON.stringify(page1)).not.toMatch(/evidence|operationKey|bank-statement/);
    await expect(read({ cursor: otherFunds.transaction.id })).rejects.toThrow("wallet_query_invalid");
    await expect(read({ limit: 101 })).rejects.toThrow("wallet_query_invalid");
    await expect(read({ actorUserId: member })).rejects.toThrow("wallet_forbidden");
    await expect(read({ actorUserId: otherOwner })).rejects.toThrow("wallet_forbidden");
    await expect(read({ actorUserId: checker })).rejects.toThrow("wallet_forbidden");
    expect((await read({ workspaceId: otherWs, actorUserId: otherOwner })).availableFen).toBe("7");
  });
});
