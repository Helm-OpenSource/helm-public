import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { readMemberBalanceSummaryInTransaction } from "./member-balance";

const url = process.env.BILLING_MYSQL_DATABASE_URL;
if (process.env.BILLING_MYSQL_REQUIRED === "1" && !url) throw new Error("isolated_billing_database_required");

// Same isolated-target rule as balance-status.mysql.test.ts: a private local socket owned by this user, or the CI service container.
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

describe.skipIf(!url)("member balance view (B-1) against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 12);
  const [owner, billing, seat, left, scoped] = ["owner", "billing", "seat", "left", "scoped"].map(n => `mb-${n}-${run}`);
  const settler = { type: "SYSTEM" as const, ref: "synthetic-settler" };
  const ENV = { APP_URL: "https://app.example.invalid" }; // top-up gates on by default (owner 2026-11-12)
  let a: PrismaClient, seq = 0;

  async function workspace(status = "ACTIVE") {
    const ws = `mb-ws-${run}-${++seq}`;
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,status,updatedAt) VALUES (${ws},'Synthetic member balance',${ws},${status},NOW(3))`;
    for (const [userId, role, state, scope] of [[owner, "OWNER", "ACTIVE", null], [billing, "BILLING_ADMIN", "ACTIVE", null], [seat, "MEMBER", "ACTIVE", null],
      [left, "MEMBER", "INACTIVE", null], [scoped, "MEMBER", "ACTIVE", "scope:synthetic"]] as const) {
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,accessScope,updatedAt) VALUES (${`m-${ws}-${userId}`},${ws},${userId},${role},${state},${scope},NOW(3))`;
    }
    return ws;
  }
  async function bound(mode: "off" | "shadow" | "enforce", walletFen: number) {
    const ws = await workspace();
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-mb" });
    // The top-up is posted in shadow (the journal refuses an off payer), then the mode is set as E1a's command would.
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'shadow' WHERE id = ${account.id}`;
    if (walletFen > 0) await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: account.id, kind: "topup",
      operationKey: `topup:${account.id}`, actor: settler, evidenceRef: "verified-payment:synthetic",
      entries: [{ account: "topup_clearing", direction: "debit", amountFen: BigInt(walletFen) },
        { account: "customer_wallet_available", direction: "credit", amountFen: BigInt(walletFen) }] }));
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`;
    await bindScope(a, { actorUserId: owner, payerAccountId: account.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "consent:bind" });
    return { ws, payerAccountId: account.id };
  }
  const view = (ws: string, userId: string, env: Record<string, string | undefined> = ENV) =>
    a.$transaction(tx => readMemberBalanceSummaryInTransaction(tx, { workspaceId: ws, userId }, env), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    for (const userId of [owner, billing, seat, left, scoped]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${userId},'Synthetic',${`${userId}@example.invalid`},NOW(3))`;
    }
  });
  afterAll(async () => { await a?.$disconnect(); });

  it("gives every active member the payer's balance and only billing managers the top-up page", async () => {
    const p = await bound("enforce", 50_000);
    const forOwner = await view(p.ws, owner);
    expect(Object.keys(forOwner).sort()).toEqual(["canTopUp", "payer", "topUpUrl"]);
    expect(Object.keys(forOwner.payer!).sort()).toEqual(["arrears", "arrearsReason", "asOf", "balanceFen", "billingMode", "payerStatus"]);
    expect(forOwner).toMatchObject({ canTopUp: true, topUpUrl: "https://app.example.invalid/billing/topup",
      payer: { billingMode: "enforce", payerStatus: "active", balanceFen: BigInt(50_000), arrears: false, arrearsReason: null } });
    expect(forOwner.payer!.asOf).toBeInstanceOf(Date);
    expect(await view(p.ws, billing)).toMatchObject({ canTopUp: true, topUpUrl: "https://app.example.invalid/billing/topup" });
    expect(await view(p.ws, seat)).toEqual({ ...forOwner, canTopUp: false, topUpUrl: null, payer: { ...forOwner.payer, asOf: expect.any(Date) } });
  });

  it("reports arrears for an enforce payer without funds and keeps the numbers for off and shadow payers", async () => {
    expect((await view((await bound("enforce", 0)).ws, seat)).payer).toMatchObject({ balanceFen: BigInt(0), arrears: true, arrearsReason: "funds" });
    const shadow = await bound("shadow", 10_000);
    expect(await view(shadow.ws, owner)).toMatchObject({ canTopUp: true, payer: { billingMode: "shadow", balanceFen: BigInt(10_000) } });
    const off = await bound("off", 10_000);
    expect(await view(off.ws, owner)).toMatchObject({ canTopUp: false, topUpUrl: null, payer: { billingMode: "off", balanceFen: BigInt(10_000) } });
  });

  it("never offers top-up for a suspended or closed payer, but still shows its numbers and arrears", async () => {
    for (const status of ["suspended", "closed"] as const) {
      const p = await bound("enforce", 10_000);
      await a.$executeRaw`UPDATE PayerAccount SET status = ${status} WHERE id = ${p.payerAccountId}`;
      expect(await view(p.ws, owner)).toMatchObject({ canTopUp: false, topUpUrl: null,
        payer: { payerStatus: status, balanceFen: BigInt(10_000), arrears: true, arrearsReason: "payer_inactive" } });
    }
  });

  it("answers no payer for an unbound workspace and never offers top-up there", async () => {
    expect(await view(await workspace(), owner)).toEqual({ canTopUp: false, topUpUrl: null, payer: null });
  });

  it("closes top-up when the page gate is off or APP_URL is unusable", async () => {
    const p = await bound("enforce", 10_000);
    for (const env of [{ ...ENV, HELM_BILLING_TOPUP_ALIPAY_ENABLED: "false" }, { ...ENV, HELM_FINANCIAL_ACTIONS_ENABLED: "false" },
      { APP_URL: "http://app.example.invalid" }, { APP_URL: "https://app.example.invalid/sub" }, {}]) {
      expect(await view(p.ws, owner, env)).toMatchObject({ canTopUp: false, topUpUrl: null, payer: { balanceFen: BigInt(10_000) } });
    }
  });

  it("refuses inactive, scoped, foreign and suspended-workspace readers before any billing read", async () => {
    const p = await bound("enforce", 10_000);
    for (const userId of [left, scoped, `mb-nobody-${run}`]) await expect(view(p.ws, userId)).rejects.toThrow("balance_forbidden");
    const other = await bound("enforce", 10_000);
    await a.$executeRaw`DELETE FROM Membership WHERE workspaceId = ${other.ws} AND userId = ${seat}`;
    await expect(view(other.ws, seat)).rejects.toThrow("balance_forbidden");
    // Byte-exact identity while the workspace is still ACTIVE: another case of the same id is not this workspace (or member).
    await expect(view(p.ws.toUpperCase(), owner)).rejects.toThrow("balance_forbidden");
    await expect(view(p.ws, owner.toUpperCase())).rejects.toThrow("balance_forbidden");
    expect((await view(p.ws, owner)).payer).toMatchObject({ balanceFen: BigInt(10_000) });
    await a.$executeRaw`UPDATE Workspace SET status = 'SUSPENDED' WHERE id = ${p.ws}`;
    await expect(view(p.ws, owner)).rejects.toThrow("balance_forbidden");
    for (const bad of ["", " ", "x".repeat(200)]) await expect(view(bad, owner)).rejects.toThrow("balance_forbidden");
  });

  it("does not wait on a settle holding the payer's projection row (lock-free under READ COMMITTED)", async () => {
    const p = await bound("enforce", 10_000);
    let releaseLock!: () => void, locked!: () => void;
    const held = new Promise<void>(resolve => { releaseLock = resolve; }), ready = new Promise<void>(resolve => { locked = resolve; });
    const writer = a.$transaction(async tx => {
      await tx.$queryRaw`SELECT balanceFen FROM FundsAccountProjection WHERE payerAccountId = ${p.payerAccountId} FOR UPDATE`;
      locked();
      await held;
    }, { timeout: 20_000 });
    await ready;
    try {
      const started = Date.now();
      const read = await a.$transaction(async tx => {
        await tx.$executeRaw`SET SESSION innodb_lock_wait_timeout = 1`;
        return readMemberBalanceSummaryInTransaction(tx, { workspaceId: p.ws, userId: seat }, ENV);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      expect(read.payer).toMatchObject({ balanceFen: BigInt(10_000) });
      expect(Date.now() - started).toBeLessThan(1_000);
    } finally { releaseLock(); await writer; }
  });
});
