import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindScope, createPayerAccount, resolvePayerForWorkspaceInTransaction, revokeBinding } from "./payer-accounts";

// Runs only against a fully migrated, explicitly isolated database; never DATABASE_URL or the app's connection.
const url = process.env.BILLING_MYSQL_DATABASE_URL;
const required = process.env.BILLING_MYSQL_REQUIRED === "1";
if (required && !url) throw new Error("isolated_billing_database_required");

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

describe.skipIf(!url)("payer accounts against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const ws = { a: `pay-a-${run}`, b: `pay-b-${run}`, g1: `pay-g1-${run}`, g2: `pay-g2-${run}` };
  const user = { u1: `payer-u1-${run}`, u2: `payer-u2-${run}`, member: `payer-m-${run}` };
  let a: PrismaClient, b: PrismaClient;
  const evidenceRef = "contract:synthetic/annex-1";
  async function membership(workspaceId: string, userId: string, role: string) {
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt)
      VALUES (${`m-${workspaceId}-${userId}`},${workspaceId},${userId},${role},'ACTIVE',NOW(3))`;
  }
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    for (const id of Object.values(ws)) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${id},'Synthetic payer',${id},NOW(3))`;
    for (const id of Object.values(user)) await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${id},'Synthetic',${`${id}@example.invalid`},NOW(3))`;
    for (const id of [ws.a, ws.b, ws.g1]) await membership(id, user.u1, "OWNER");
    for (const id of [ws.a, ws.g2]) await membership(id, user.u2, "BILLING_ADMIN");
    for (const id of [ws.a, ws.g1]) await membership(id, user.member, "ADMIN");
  });
  afterAll(async () => {
    if (a) {
      const payers = (await a.payerAccount.findMany({ where: { governingWorkspaceId: { in: Object.values(ws) } }, select: { id: true } })).map(p => p.id);
      await a.payerScopeBinding.deleteMany({ where: { payerAccountId: { in: payers } } });
      await a.payerAccount.deleteMany({ where: { id: { in: payers } } });
      await a.auditLog.deleteMany({ where: { workspaceId: { in: Object.values(ws) } } });
      await a.$executeRaw`DELETE FROM Membership WHERE userId IN (${user.u1},${user.u2},${user.member})`;
      await a.$executeRaw`DELETE FROM Workspace WHERE id IN (${ws.a},${ws.b},${ws.g1},${ws.g2})`;
      await a.$executeRaw`DELETE FROM User WHERE id IN (${user.u1},${user.u2},${user.member})`;
    }
    await Promise.all([a?.$disconnect(), b?.$disconnect()]);
  });
  const payer = (actorUserId: string, workspaceId: string, client = a) =>
    createPayerAccount(client, { actorUserId, workspaceId, kind: "enterprise_contract", contractSubjectRef: `subject-${workspaceId}` });
  const resolve = (workspaceId: string, client = a) => client.$transaction(tx => resolvePayerForWorkspaceInTransaction(tx, workspaceId));

  it("defaults every new payer to billingMode off, CNY, version 1, with its audit row", async () => {
    const account = await payer(user.u1, ws.g1);
    expect(account).toMatchObject({ billingMode: "off", currency: "CNY", version: 1, status: "active", governingWorkspaceId: ws.g1 });
    expect(await a.auditLog.count({ where: { workspaceId: ws.g1, targetId: account.id, actionType: "BILLING_PAYER_ACCOUNT_CREATED" } })).toBe(1);
    await expect(a.payerAccount.create({ data: { kind: "enterprise_contract", governingWorkspaceId: ws.g1, contractSubjectRef: "x", currency: "USD" } })).rejects.toThrow();
    await expect(a.payerAccount.create({ data: { kind: "enterprise_contract", contractSubjectRef: "x" } })).rejects.toThrow();
  });
  it("rejects a second active binding for one scope in the database itself", async () => {
    const [p1, p2] = [await payer(user.u1, ws.g1), await payer(user.u1, ws.g1)];
    const row = (payerAccountId: string) => ({ payerAccountId, scopeKind: "workspace" as const, scopeRef: ws.b,
      activeScopeRef: ws.b, authorizedByUserId: user.u1, evidenceRef });
    await a.payerScopeBinding.create({ data: row(p1.id) });
    await expect(a.payerScopeBinding.create({ data: row(p2.id) })).rejects.toMatchObject({ code: "P2002" });
    // The CHECK keeps the active key honest: no active row without it, no revoked row holding it.
    await expect(a.payerScopeBinding.create({ data: { ...row(p2.id), scopeRef: `${ws.b}-x`, activeScopeRef: null } })).rejects.toThrow();
    await expect(a.payerScopeBinding.create({ data: { ...row(p2.id), scopeRef: `${ws.b}-y`, activeScopeRef: `${ws.b}-z` } })).rejects.toThrow();
    await expect(a.payerScopeBinding.create({ data: { ...row(p2.id), state: "revoked", revokedAt: new Date(), revokedByUserId: user.u1 } })).rejects.toThrow();
    await a.payerScopeBinding.deleteMany({ where: { scopeRef: ws.b } });
  });
  it("revokes then rebinds, keeping the old binding as immutable history", async () => {
    const [p1, p2] = [await payer(user.u1, ws.g1), await payer(user.u1, ws.g1)];
    const first = await bindScope(a, { actorUserId: user.u1, payerAccountId: p1.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws.b, evidenceRef });
    const frozen = await resolve(ws.b);
    expect(frozen).toEqual({ payerAccountId: p1.id, bindingId: first.id, bindingVersion: 1, scopeKind: "workspace", scopeRef: ws.b, billingMode: "off", currency: "CNY" });
    await expect(bindScope(b, { actorUserId: user.u1, payerAccountId: p2.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws.b, evidenceRef }))
      .rejects.toThrow("payer_scope_already_bound");
    await expect(revokeBinding(a, { actorUserId: user.u1, bindingId: first.id, expectedVersion: 2, evidenceRef })).rejects.toThrow("payer_version_conflict");
    const revoked = await revokeBinding(a, { actorUserId: user.u1, bindingId: first.id, expectedVersion: 1, evidenceRef });
    expect(revoked).toMatchObject({ state: "revoked", activeScopeRef: null, version: 2, payerAccountId: p1.id, revokedByUserId: user.u1 });
    await expect(resolve(ws.b)).rejects.toThrow("payer_unresolved");
    const second = await bindScope(b, { actorUserId: user.u1, payerAccountId: p2.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws.b, evidenceRef });
    expect((await resolve(ws.b, b)).payerAccountId).toBe(p2.id);
    // The snapshot taken before the change still names a row that exists unchanged with that payer.
    expect(await a.payerScopeBinding.findUnique({ where: { id: frozen.bindingId } })).toMatchObject({ payerAccountId: p1.id, scopeRef: ws.b });
    expect(second.id).not.toBe(first.id);
    expect(await a.auditLog.count({ where: { workspaceId: ws.b, targetId: { in: [first.id, second.id] } } })).toBe(3);
    await revokeBinding(a, { actorUserId: user.u1, bindingId: second.id, expectedVersion: 1, evidenceRef });
  });
  it("refuses binders without billing authority on both sides", async () => {
    const p1 = await payer(user.u1, ws.g1);
    const attempt = (actorUserId: string, scopeRef: string) => bindScope(a, { actorUserId, payerAccountId: p1.id,
      expectedPayerVersion: 1, scopeKind: "workspace", scopeRef, evidenceRef });
    await expect(attempt(user.member, ws.a)).rejects.toThrow("payer_binding_forbidden"); // ADMIN in both: not billing
    await expect(attempt(user.u2, ws.a)).rejects.toThrow("payer_binding_forbidden"); // billing admin of target only
    await a.$executeRaw`UPDATE Membership SET status='INACTIVE' WHERE workspaceId=${ws.g1} AND userId=${user.u1}`;
    await expect(attempt(user.u1, ws.a)).rejects.toThrow("payer_binding_forbidden");
    await a.$executeRaw`UPDATE Membership SET status='ACTIVE' WHERE workspaceId=${ws.g1} AND userId=${user.u1}`;
    expect(await a.payerScopeBinding.count({ where: { payerAccountId: p1.id } })).toBe(0);
    await expect(createPayerAccount(a, { actorUserId: user.member, workspaceId: ws.g1, kind: "enterprise_contract", contractSubjectRef: "s" }))
      .rejects.toThrow("payer_binding_forbidden");
  });
  it("never resolves a binding for a different or case-variant workspace", async () => {
    const p1 = await payer(user.u1, ws.g1);
    const binding = await bindScope(a, { actorUserId: user.u1, payerAccountId: p1.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws.a, evidenceRef });
    await expect(resolve(ws.b)).rejects.toThrow("payer_unresolved");
    await expect(resolve(ws.a.toUpperCase())).rejects.toThrow("payer_unresolved");
    expect((await resolve(ws.a)).bindingId).toBe(binding.id);
    await revokeBinding(a, { actorUserId: user.u1, bindingId: binding.id, expectedVersion: 1, evidenceRef });
  });
  it("lets exactly one of concurrent double-binds win across independent sessions", async () => {
    const [sa] = await a.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`;
    const [sb] = await b.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`;
    expect(sa.id).not.toBe(sb.id);
    // Different admins hold disjoint membership locks, so only the unique key arbitrates.
    const [p1, p2] = [await payer(user.u1, ws.g1), await payer(user.u2, ws.g2)];
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => bindScope(i % 2 ? a : b, {
      actorUserId: i % 2 ? user.u1 : user.u2, payerAccountId: i % 2 ? p1.id : p2.id, expectedPayerVersion: 1,
      scopeKind: "workspace", scopeRef: ws.a, evidenceRef })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r): r is PromiseRejectedResult => r.status === "rejected")) {
      expect(String(r.reason)).toMatch(/payer_scope_already_bound|payer_version_conflict/);
    }
    expect(await a.payerScopeBinding.count({ where: { scopeKind: "workspace", activeScopeRef: ws.a } })).toBe(1);
    // Concurrent revokes of one version: the atomic UPDATE admits exactly one and increments once.
    const active = await a.payerScopeBinding.findFirstOrThrow({ where: { scopeKind: "workspace", activeScopeRef: ws.a } });
    const revokes = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => revokeBinding(i % 2 ? a : b,
      { actorUserId: i % 2 ? user.u1 : user.u2, bindingId: active.id, expectedVersion: 1, evidenceRef })));
    expect(revokes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await a.payerScopeBinding.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({ state: "revoked", version: 2 });
  });
  it("rolls back binding and audit together when the transaction fails", async () => {
    const p1 = await payer(user.u1, ws.g1);
    const broken = { $transaction: (fn: Parameters<PrismaClient["$transaction"]>[0]) => a.$transaction(async tx => {
      await (fn as (t: typeof tx) => Promise<unknown>)(tx); throw new Error("synthetic_after_write_failure");
    }) } as unknown as PrismaClient;
    await expect(bindScope(broken, { actorUserId: user.u1, payerAccountId: p1.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws.b, evidenceRef }))
      .rejects.toThrow("synthetic_after_write_failure");
    expect(await a.payerScopeBinding.count({ where: { payerAccountId: p1.id } })).toBe(0);
    expect(await a.auditLog.count({ where: { relatedObjectId: p1.id } })).toBe(0);
    expect((await a.payerAccount.findUniqueOrThrow({ where: { id: p1.id } })).version).toBe(1);
  });
});
