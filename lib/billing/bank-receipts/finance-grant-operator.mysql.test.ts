import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runFinanceGrantOperator } from "./finance-grant-operator";

// Same isolation contract as bank-receipts.mysql.test.ts: never DATABASE_URL or the app's connection.
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

type Output = Record<string, unknown> & { grants?: Array<Record<string, unknown>> };

describe.skipIf(!url)("finance grant operator CLI against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `fg-${name}-${run}`;
  const [owner, member, member2, scoped, outsider, customerOwner] = ["owner", "member", "member2", "scoped", "outsider", "cowner"].map(id);
  let a: PrismaClient;
  const cli = async (...argv: string[]) => {
    const result = await runFinanceGrantOperator(a, argv);
    return { exitCode: result.exitCode, out: JSON.parse(JSON.stringify(result.output)) as Output };
  };
  const grant = (actor: string, userId: string, role = "maker", ...extra: string[]) => cli("grant", `--actor-user-id=${actor}`,
    `--user-id=${userId}`, `--role=${role}`, "--evidence-ref=owner-ruling:finance-roster", ...extra);
  const grants = (userId: string) => a.platformFinanceGrant.findMany({ where: { userId } });
  const audits = (actionType: string) => a.auditLog.count({ where: { actionType, userId: owner } });

  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    const existing = await a.workspace.findUnique({ where: { systemKey: "helm_reserved_primary" }, select: { id: true } });
    const reserved = existing?.id ?? id("reserved");
    if (!existing) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,workspaceClass,systemKey,updatedAt)
      VALUES (${reserved},'Synthetic reserved',${reserved},'HELM_RESERVED','helm_reserved_primary',NOW(3))`;
    const customer = id("customer");
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${customer},'Synthetic customer',${customer},NOW(3))`;
    for (const u of [owner, member, member2, scoped, outsider, customerOwner]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${u},'Synthetic',${`${u}@example.invalid`},NOW(3))`;
    }
    const membership = (workspaceId: string, userId: string, role: string, accessScope: string | null = null) => a.$executeRaw`
      INSERT INTO Membership (id,workspaceId,userId,role,status,accessScope,updatedAt)
      VALUES (${`m-${workspaceId}-${userId}`},${workspaceId},${userId},${role},'ACTIVE',${accessScope},NOW(3))`;
    await membership(reserved, owner, "OWNER");
    await membership(reserved, member, "MEMBER");
    await membership(reserved, member2, "MEMBER");
    await membership(reserved, scoped, "MEMBER", "limited");
    await membership(customer, customerOwner, "OWNER");
  });
  afterAll(async () => { await a?.$disconnect(); });

  it("dry-runs by default, then grants once with its audit row in the same transaction; evidence is required", async () => {
    const dry = await grant(owner, member);
    expect(dry).toMatchObject({ exitCode: 0, out: { ok: true, applied: false,
      preflight: { actorIsReservedOwner: true, userIsReservedMember: true, selfGrant: false, activeGrant: null } } });
    expect(await grants(member)).toHaveLength(0);
    expect(await cli("grant", `--actor-user-id=${owner}`, `--user-id=${member}`, "--role=maker", "--apply"))
      .toEqual({ exitCode: 2, out: { ok: false, code: "usage:missing:evidence-ref" } });
    expect((await grant(owner, member, "auditor", "--apply")).out).toEqual({ ok: false, code: "usage:role" });
    const before = await audits("BILLING_FINANCE_GRANTED");
    const applied = await grant(owner, member, "maker", "--apply");
    expect(applied.out).toMatchObject({ ok: true, applied: true, grant: { userId: member, role: "maker", state: "active", grantedByUserId: owner } });
    const grantId = (applied.out.grant as { id: string }).id;
    expect(await a.auditLog.findFirst({ where: { targetId: grantId, actionType: "BILLING_FINANCE_GRANTED" } }))
      .toMatchObject({ userId: owner, targetType: "PlatformFinanceGrant" });
    // A refused repeat rolls back whole: no second row, no audit row.
    expect((await grant(owner, member, "maker", "--apply")).out).toEqual({ ok: false, code: "finance_grant_exists" });
    expect(await grants(member)).toHaveLength(1);
    expect(await audits("BILLING_FINANCE_GRANTED")).toBe(before + 1);
    expect((await grant(owner, member)).out).toMatchObject({ preflight: { activeGrant: { id: grantId } } });
    expect((await cli("list", `--user-id=${member}`)).out.grants).toMatchObject([{ id: grantId, role: "maker", state: "active" }]);
  });

  it("refuses a grant by anyone but the reserved workspace OWNER, to themselves, or to a non-member or scoped member", async () => {
    const before = await audits("BILLING_FINANCE_GRANTED");
    for (const actor of [member, customerOwner, outsider]) {
      expect(await grant(actor, member2, "checker", "--apply")).toEqual({ exitCode: 1, out: { ok: false, code: "finance_grant_forbidden" } });
    }
    for (const actor of [member, customerOwner]) expect((await grant(actor, member2)).out).toMatchObject({ preflight: { actorIsReservedOwner: false } });
    expect(await grant(owner, owner, "checker", "--apply")).toEqual({ exitCode: 1, out: { ok: false, code: "finance_grant_forbidden" } });
    expect((await grant(owner, owner)).out).toMatchObject({ preflight: { selfGrant: true } });
    for (const userId of [outsider, customerOwner, scoped]) {
      expect((await grant(owner, userId, "checker", "--apply")).out).toEqual({ ok: false, code: "finance_grant_forbidden" });
      expect((await grant(owner, userId)).out).toMatchObject({ preflight: { userIsReservedMember: false } });
    }
    for (const userId of [member2, owner, outsider, customerOwner, scoped]) expect(await grants(userId)).toHaveLength(0);
    expect(await audits("BILLING_FINANCE_GRANTED")).toBe(before);
  });

  it("revokes only as the reserved OWNER at the expected version, keeps the row and audits it", async () => {
    const granted = (await grant(owner, member2, "checker", "--apply")).out.grant as { id: string; version: number };
    const revoke = (actor: string, version: number, ...extra: string[]) => cli("revoke", `--actor-user-id=${actor}`,
      `--grant-id=${granted.id}`, `--expected-version=${version}`, "--evidence-ref=owner-ruling:finance-offboard", ...extra);
    expect((await revoke(owner, 1)).out).toMatchObject({ ok: true, applied: false, preflight: { actorIsReservedOwner: true, grant: { state: "active" } } });
    expect((await revoke(member, 1, "--apply")).out).toEqual({ ok: false, code: "finance_grant_forbidden" });
    expect((await revoke(owner, 2, "--apply")).out).toEqual({ ok: false, code: "finance_grant_unavailable" });
    expect(await a.platformFinanceGrant.findUnique({ where: { id: granted.id } })).toMatchObject({ state: "active", version: 1 });
    expect((await revoke(owner, 1, "--apply")).out).toMatchObject({ ok: true, applied: true,
      grant: { state: "revoked", version: 2, revokedByUserId: owner } });
    expect(await a.auditLog.count({ where: { targetId: granted.id, actionType: "BILLING_FINANCE_REVOKED" } })).toBe(1);
    expect((await revoke(owner, 2, "--apply")).out).toEqual({ ok: false, code: "finance_grant_unavailable" });
    expect((await cli("list", `--user-id=${member2}`)).out.grants).toEqual([]);
    expect((await cli("list", `--user-id=${member2}`, "--include-revoked=true")).out.grants).toMatchObject([{ id: granted.id, state: "revoked" }]);
    // The role can be granted again after a revoke (one active grant per role and user).
    expect((await grant(owner, member2, "checker", "--apply")).out).toMatchObject({ ok: true, grant: { state: "active" } });
  });

  it("rejects unknown commands and flags", async () => {
    expect((await cli("delete")).exitCode).toBe(2);
    expect((await cli("list", "--apply")).out).toEqual({ ok: false, code: "usage:flag:--apply" });
    expect((await cli("grant", `--actor-user-id=${owner}`, `--user-id=${member}`, "--role=maker", "--evidence-ref=x", "--grant-id=y")).out)
      .toEqual({ ok: false, code: "usage:flag:--grant-id" });
  });
});
