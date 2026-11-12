import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { grantPlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { confirmEmergencyRollback, executeEmergencyRollback, runEmergencyCommand } from "./platform-emergency";
import { draftPlatformOperation, reviewPlatformOperation, type PlatformOperationRequest } from "./platform-operations";

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

describe.skipIf(!url)("platform emergency rollback against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `per-${name}-${run}`;
  const [admin, maker, checker, dual, owner] = ["admin", "maker", "checker", "dual", "owner"].map(id);
  const ruling = `owner-ruling:emergency-${run}`;
  let a: PrismaClient, b: PrismaClient, reserved: string;
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
    reserved = existing?.id ?? id("reserved");
    if (!existing) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,workspaceClass,systemKey,updatedAt)
      VALUES (${reserved},'Synthetic reserved',${reserved},'HELM_RESERVED','helm_reserved_primary',NOW(3))`;
    for (const u of [admin, maker, checker, dual, owner]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${u},'Synthetic',${`${u}@example.invalid`},NOW(3))`;
    }
    for (const [u, role] of [[admin, "OWNER"], [maker, "MEMBER"], [checker, "MEMBER"], [dual, "MEMBER"]]) {
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${reserved}-${u}`},${reserved},${u},${role},'ACTIVE',NOW(3))`;
    }
    const grant = (userId: string, role: "maker" | "checker") => grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    await grant(maker, "maker"); await grant(checker, "checker"); await grant(dual, "maker"); await grant(dual, "checker");
  });
  // Records refuse DELETE by trigger; this synthetic database is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  /** A platform-onboarded workspace whose payer is put straight into `mode` (test shortcut for the maker/checker switch). */
  async function payerIn(mode: "off" | "shadow" | "enforce") {
    const ws = id(`ws${(seq += 1)}`);
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic customer',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    const request: PlatformOperationRequest = { kind: "payer_onboard", workspaceId: ws, contractSubjectRef: "subject-emergency" };
    await draftPlatformOperation(a, { actorUserId: maker, evidenceRef: ruling, request });
    const { operation } = await reviewPlatformOperation(a, { actorUserId: checker, evidenceRef: ruling, request, decision: "approve",
      reviewEvidenceRef: "review:synthetic" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${operation.resultRef}`;
    return { ws, payerAccountId: operation.resultRef! };
  }
  const modeOf = async (payerAccountId: string) => (await a.payerAccount.findUniqueOrThrow({ where: { id: payerAccountId } })).billingMode;
  const execute = (workspaceId: string, actorUserId = maker, evidenceRef = ruling, client = a) =>
    executeEmergencyRollback(client, { actorUserId, workspaceId, evidenceRef });

  it("lets one platform person switch enforce -> shadow at once, leaving a pending review due in 24 hours", async () => {
    const { ws, payerAccountId } = await payerIn("enforce");
    expect(await runEmergencyCommand(a, { command: "emergency-rollback", actorUserId: maker, workspaceId: ws, evidenceRef: ruling, apply: false }))
      .toMatchObject({ applied: false, currentMode: "enforce", wouldSwitch: true });
    expect(await modeOf(payerAccountId)).toBe("enforce"); // dry run wrote nothing
    const { rollback, replayed } = await execute(ws);
    expect(replayed).toBe(false);
    expect(await modeOf(payerAccountId)).toBe("shadow");
    expect(rollback).toMatchObject({ state: "pending_review", executedByUserId: maker, payerAccountId, fromMode: "enforce", toMode: "shadow" });
    expect(rollback.reviewDueAt.getTime() - rollback.executedAt.getTime()).toBe(24 * 3600 * 1000);
    const audits = await a.auditLog.findMany({ where: { targetId: rollback.id }, select: { workspaceId: true, actionType: true } });
    expect(audits.map(row => `${row.workspaceId === ws ? "ws" : "reserved"}:${row.actionType}`).sort()).toEqual(["reserved:BILLING_PLATFORM_EMERGENCY_ROLLBACK_EXECUTED",
      "ws:BILLING_PAYER_MODE_CHANGED", "ws:BILLING_PLATFORM_EMERGENCY_ROLLBACK_EXECUTED"]);
    expect((await execute(ws)).replayed).toBe(true);
    await expect(execute(ws, checker)).rejects.toThrow("emergency_conflict");
    await expect(execute(ws, maker, `${ruling}-2`)).rejects.toThrow("billing_mode_conflict"); // already shadow
  });

  it("refuses non-platform identities, other directions and unbound workspaces", async () => {
    const enforced = await payerIn("enforce");
    await expect(execute(enforced.ws, owner)).rejects.toThrow("emergency_forbidden");
    for (const mode of ["off", "shadow"] as const) {
      const other = await payerIn(mode);
      await expect(execute(other.ws)).rejects.toThrow("billing_mode_conflict");
      expect(await modeOf(other.payerAccountId)).toBe(mode);
    }
    await expect(execute(id("unbound"))).rejects.toThrow("payer_unresolved");
    expect(await modeOf(enforced.payerAccountId)).toBe("enforce");
    expect(await a.platformEmergencyRollback.count({ where: { workspaceId: enforced.ws } })).toBe(0);
  });

  it("is confirmed only by a different platform checker; DB keeps the second-person and immutability rules", async () => {
    const { ws } = await payerIn("enforce");
    const { rollback } = await execute(ws, dual);
    const confirm = (actorUserId: string) => confirmEmergencyRollback(a, { actorUserId, rollbackId: rollback.id, evidenceRef: "review:emergency" });
    await expect(confirm(dual)).rejects.toThrow("emergency_self_confirm_forbidden");
    await expect(confirm(maker)).rejects.toThrow("emergency_forbidden"); // second person must hold the checker role
    await expect(a.$executeRaw`UPDATE PlatformEmergencyRollback SET state='confirmed', confirmedByUserId=executedByUserId,
      confirmEvidenceRef='x', confirmedAt=NOW(3), version=version+1 WHERE id=${rollback.id}`).rejects.toThrow(/second_person_check/);
    const confirmed = await confirm(checker);
    expect(confirmed.rollback).toMatchObject({ state: "confirmed", confirmedByUserId: checker, version: 2 });
    expect((await confirm(checker)).replayed).toBe(true);
    await expect(confirm(maker)).rejects.toThrow("emergency_forbidden");
    await a.$executeRaw`INSERT INTO PlatformFinanceGrant (id,userId,role,state,activeUserId,grantedByUserId,evidenceRef,updatedAt)
      VALUES (${id("g-maker-checker")},${maker},'checker','active',${maker},${admin},'approval:finance-roster',NOW(3))`;
    await expect(confirm(maker)).rejects.toThrow("emergency_not_pending"); // another checker cannot re-confirm a confirmed record
    await expect(a.$executeRaw`UPDATE PlatformEmergencyRollback SET reviewDueAt = NOW(3), version = version + 1 WHERE id = ${rollback.id}`)
      .rejects.toThrow(/immutable/);
    await expect(a.$executeRaw`DELETE FROM PlatformEmergencyRollback WHERE id = ${rollback.id}`).rejects.toThrow(/no_delete/);
    expect(await a.auditLog.count({ where: { targetId: rollback.id, actionType: "BILLING_PLATFORM_EMERGENCY_ROLLBACK_CONFIRMED" } })).toBe(2);
  });

  it("lists pending reviews and raises the alert once one is overdue, without reverting the rollback", async () => {
    const { ws, payerAccountId } = await payerIn("shadow");
    const executedAt = new Date(Date.now() - 25 * 3600 * 1000);
    const late = await a.platformEmergencyRollback.create({ data: { workspaceId: ws, payerAccountId, fromMode: "enforce", toMode: "shadow",
      executedByUserId: maker, evidenceRef: `${ruling}-late`, executedAt, reviewDueAt: new Date(executedAt.getTime() + 24 * 3600 * 1000) } });
    const listed = await runEmergencyCommand(a, { command: "pending-rollbacks" });
    expect(listed).toMatchObject({ ok: true, alert: "emergency_rollback_review_overdue" });
    expect("pending" in listed && listed.pending.find(row => row.id === late.id)).toMatchObject({ overdue: true });
    expect(await modeOf(payerAccountId)).toBe("shadow");
    await confirmEmergencyRollback(a, { actorUserId: checker, rollbackId: late.id, evidenceRef: "review:late" }); // late confirm allowed
    const after = await runEmergencyCommand(a, { command: "pending-rollbacks" });
    expect("pending" in after && after.pending.some(row => row.id === late.id)).toBe(false);
  });

  it("lets exactly one of concurrent single-person rollbacks of one payer win", async () => {
    const { ws, payerAccountId } = await payerIn("enforce");
    const results = await Promise.allSettled([maker, checker, dual].flatMap((user, i) => [a, b].map((client, j) =>
      execute(ws, user, `${ruling}-race-${i}-${j}`, client))));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r): r is PromiseRejectedResult => r.status === "rejected")) {
      expect(String(r.reason)).toMatch(/billing_mode_conflict|emergency_write_conflict/);
    }
    expect(await modeOf(payerAccountId)).toBe("shadow");
    expect(await a.platformEmergencyRollback.count({ where: { workspaceId: ws } })).toBe(1);
  });
});
