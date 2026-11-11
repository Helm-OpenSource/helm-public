import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { grantPlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { changeCreditFacility, drawCreditShortfallInTransaction, proposeCreditFacility } from "./credit-facilities";
import { runCreditOperator } from "./credit-operator";

// Same isolation contract as credit-facilities.mysql.test.ts: never DATABASE_URL or the app's connection.
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
const MILLION_YUAN = 100_000_000;
type Output = Record<string, unknown> & { rows?: Array<Record<string, unknown>> };

describe.skipIf(!url)("credit operator CLI against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `co-${name}-${run}`;
  const [admin, maker, checker, dual, owner] = ["admin", "maker", "checker", "dual", "owner"].map(id);
  let a: PrismaClient;
  let seq = 0;
  const files = new Map<string, string>();
  const cli = async (...argv: string[]) => {
    const result = await runCreditOperator(a, argv, path => Buffer.from(files.get(path) ?? ""));
    return { exitCode: result.exitCode, out: JSON.parse(JSON.stringify(result.output, (_k, v) => typeof v === "bigint" ? v.toString() : v)) as Output };
  };
  const list = (entries: Array<{ workspaceId: string; limitFen: string }>, batchRef = `batch-${(seq += 1)}-${run}`) => {
    const path = `list-${(seq += 1)}.json`;
    files.set(path, JSON.stringify({ v: 1, batchRef, evidenceRef: "owner-ruling:synthetic-credit", validUntil: null, entries }));
    return path;
  };
  const row = (out: Output, workspaceId: string) => out.rows!.find(item => item.workspaceId === workspaceId)!;

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
    for (const u of [admin, maker, checker, dual, owner]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${u},'Synthetic',${`${u}@example.invalid`},NOW(3))`;
    }
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${admin}`},${reserved},${admin},'OWNER','ACTIVE',NOW(3))`;
    for (const u of [maker, checker, dual]) {
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${u}`},${reserved},${u},'MEMBER','ACTIVE',NOW(3))`;
    }
    const grant = (userId: string, role: "maker" | "checker") => grantPlatformFinanceRole(a, { actorUserId: admin, userId, role, evidenceRef: "approval:finance-roster" });
    await grant(maker, "maker"); await grant(checker, "checker"); await grant(dual, "maker"); await grant(dual, "checker");
  });
  afterAll(async () => { await a?.$disconnect(); });

  /** A customer workspace; with a payer bound to it unless `bare` (payer creation is another command's job). */
  async function workspace(bare = false) {
    const ws = id(`ws${(seq += 1)}`);
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic customer',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    if (bare) return { ws, payer: "" };
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-ops" });
    await bindScope(a, { actorUserId: owner, payerAccountId: account.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "approval:bind" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${account.id}`; // no mode API yet
    return { ws, payer: account.id };
  }
  async function activeLine(payerAccountId: string, limit: number) {
    const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId, limitFen: fen(limit), validUntil: null,
      operationKey: `legacy:${(seq += 1)}`, evidenceRef: "owner-ruling:legacy" });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: facility.id, action: "approve", expectedVersion: 1, evidenceRef: "review:a" });
    return changeCreditFacility(a, { actorUserId: maker, facilityId: facility.id, action: "activate", expectedVersion: 2, evidenceRef: "review:b" });
  }
  const drawable = (payerAccountId: string) => a.creditFacility.findUnique({ where: { activePayerAccountId: payerAccountId } });

  it("issues a batch in maker / checker / activate steps: new line, 10万 -> 100万 swap, blockers, sha binding, readback", async () => {
    const fresh = await workspace(), legacy = await workspace(), missing = await workspace(true), over = await workspace();
    const old = await activeLine(legacy.payer, 10_000_000); // 100,000 CNY
    const path = list([fresh, legacy, missing, over].map(({ ws }, i) => ({ workspaceId: ws, limitFen: String(i === 3 ? MILLION_YUAN + 1 : MILLION_YUAN) })));
    const dry = await cli("batch", `--list-file=${path}`, `--maker-user-id=${maker}`, `--checker-user-id=${checker}`);
    expect(dry.exitCode).toBe(0);
    expect(dry.out).toMatchObject({ applied: false, preflight: { maker: true, checker: true, distinct: true },
      actions: { propose: 2, blocked: 2 }, maxLimitFen: String(MILLION_YUAN) });
    expect(row(dry.out, legacy.ws)).toMatchObject({ action: "propose", current: { id: old.id, limitFen: "10000000", usedFen: "0" } });
    expect(row(dry.out, missing.ws)).toMatchObject({ action: "blocked", blocker: "payer_missing", payerAccountId: null });
    expect(row(dry.out, over.ws)).toMatchObject({ action: "blocked", blocker: "limit_over_cap" });
    const listSha = dry.out.listSha as string;
    expect(listSha).toMatch(/^[a-f0-9]{64}$/);

    // A sha the owner did not confirm writes nothing.
    expect((await cli("batch", `--list-file=${path}`, "--step=propose", `--actor-user-id=${maker}`, `--expect-list-sha=${"0".repeat(64)}`, "--apply")).out)
      .toEqual({ ok: false, code: "list_sha_mismatch" });
    expect(await a.creditFacility.count({ where: { payerAccountId: { in: [fresh.payer, legacy.payer] } } })).toBe(1);

    const step = (name: string, actor: string) => cli("batch", `--list-file=${path}`, `--step=${name}`, `--actor-user-id=${actor}`, `--expect-list-sha=${listSha}`, "--apply");
    const proposed = await step("propose", maker);
    expect(proposed.exitCode).toBe(1); // blocked entries are reported, the rest proceed
    expect(proposed.out.results).toEqual({ applied: 2, planned: 2 });
    // The checker step skips nothing it cannot do: a maker-only actor fails every approval, nothing changes.
    expect((await step("approve", maker)).out.rows!.filter(item => item.status === "failed").map(item => item.code)).toEqual(["credit_forbidden", "credit_forbidden"]);
    // Re-running a finished step is a no-op (resume): rows moved on to the next step.
    expect((await step("propose", maker)).out.results).toEqual({ skipped: 2, planned: 2 });
    expect((await step("approve", checker)).out.results).toEqual({ applied: 2, planned: 2 });
    expect(await drawable(fresh.payer)).toBeNull(); // approved is not drawable
    const activated = await step("activate", maker);
    expect(row(activated.out, legacy.ws)).toMatchObject({ status: "applied", detail: { activated: { state: "active", limitFen: String(MILLION_YUAN) },
      superseded: { id: old.id, state: "revoked", usedFen: "0" } } });
    for (const { payer } of [fresh, legacy]) expect(await drawable(payer)).toMatchObject({ limitFen: fen(MILLION_YUAN), state: "active" });

    const readback = await cli("batch", `--list-file=${path}`);
    expect(readback.out.actions).toEqual({ done: 2, blocked: 2 });
    // Each lifecycle step wrote its audit row in the same transaction, in the actor's reserved workspace.
    const facilityIds = (await a.creditFacility.findMany({ where: { payerAccountId: legacy.payer }, select: { id: true } })).map(item => item.id);
    const audits = await a.auditLog.findMany({ where: { targetId: { in: facilityIds } }, select: { actionType: true } });
    expect(audits.map(item => item.actionType).sort()).toEqual(["ACTIVATE", "ACTIVATE", "APPROVE", "APPROVE", "PROPOSED", "PROPOSED",
      "REVOKE"].map(action => `BILLING_CREDIT_FACILITY_${action}`));
  });

  it("keeps one entry's refusal (self-approval) from stopping the others and reduces a higher line at the activate step", async () => {
    const self = await workspace(), other = await workspace(), high = await workspace();
    await activeLine(high.payer, MILLION_YUAN);
    await changeCreditFacility(a, { actorUserId: maker, facilityId: (await drawable(high.payer))!.id, action: "reduce",
      expectedVersion: 3, evidenceRef: "review:c", limitFen: fen(MILLION_YUAN - 1) });
    const path = list([self, other, high].map(({ ws }) => ({ workspaceId: ws, limitFen: "5000" })));
    const listSha = (await cli("batch", `--list-file=${path}`)).out.listSha as string;
    const step = (name: string, actor: string) => cli("batch", `--list-file=${path}`, `--step=${name}`, `--actor-user-id=${actor}`, `--expect-list-sha=${listSha}`, "--apply");
    expect((await step("propose", dual)).out.results).toEqual({ applied: 2, skipped: 1 });
    const approved = await step("approve", dual); // dual proposed both: maker = checker is refused per entry
    expect(approved.exitCode).toBe(1);
    expect(approved.out.rows!.filter(item => item.status === "failed").map(item => item.code)).toEqual(["credit_self_approval_forbidden", "credit_self_approval_forbidden"]);
    const activated = await step("activate", checker);
    expect(row(activated.out, high.ws)).toMatchObject({ action: "reduce", status: "applied", detail: { facility: { state: "reduced", limitFen: "5000" } } });
    expect(await drawable(self.payer)).toBeNull();
  });

  it("refuses a second drawable facility per payer, and a swap while the old line carries usage (rolled back whole)", async () => {
    const { ws, payer } = await workspace();
    const old = await activeLine(payer, 10_000_000);
    const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId: payer, limitFen: fen(MILLION_YUAN),
      validUntil: null, operationKey: `next:${run}`, evidenceRef: "owner-ruling:next" });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: facility.id, action: "approve", expectedVersion: 1, evidenceRef: "review:d" });
    const activate = (...extra: string[]) => cli("activate", `--actor-user-id=${maker}`, `--facility-id=${facility.id}`,
      "--expected-version=2", "--evidence-ref=owner-ruling:next", ...extra, "--apply");
    expect((await activate()).out).toEqual({ ok: false, code: "credit_active_exists" });
    const elsewhere = await activeLine((await workspace()).payer, 1000); // another payer's line is never superseded
    expect((await activate(`--supersedes-facility-id=${elsewhere.id}`, `--supersedes-version=${elsewhere.version}`)).out)
      .toEqual({ ok: false, code: "credit_supersede_invalid" });
    expect(await a.creditFacility.findUnique({ where: { id: elsewhere.id } })).toMatchObject({ state: "active", version: elsewhere.version });
    await a.$transaction(async tx => {
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
      await drawCreditShortfallInTransaction(tx, { payerAccountId: payer, chargeFen: fen(300), sourceRef: `usage:${run}`,
        actor: { type: "SYSTEM", ref: "billing-settle" }, reservedAt: now });
    });
    const path = list([{ workspaceId: ws, limitFen: String(MILLION_YUAN) }]);
    expect(row((await cli("batch", `--list-file=${path}`)).out, ws)).toMatchObject({ action: "blocked", blocker: "current_in_use" });
    expect((await activate(`--supersedes-facility-id=${old.id}`, `--supersedes-version=${old.version}`)).out).toEqual({ ok: false, code: "credit_supersede_in_use" });
    expect(await drawable(payer)).toMatchObject({ id: old.id, state: "active", usedFen: fen(300) }); // revoke rolled back too
    expect(await a.creditFacility.findUnique({ where: { id: facility.id } })).toMatchObject({ state: "approved", version: 2 });
  });

  it("caps single proposals at 1,000,000 CNY by default, configurable, and dry-runs without writing", async () => {
    const { payer } = await workspace();
    const propose = (limit: number, ...extra: string[]) => cli("propose", `--actor-user-id=${maker}`, `--payer-account-id=${payer}`,
      `--limit-fen=${limit}`, `--operation-key=single:${run}`, "--evidence-ref=owner-ruling:single", ...extra);
    expect((await propose(MILLION_YUAN + 1, "--apply")).out).toEqual({ ok: false, code: "limit_over_cap" });
    expect((await propose(MILLION_YUAN)).out).toMatchObject({ ok: true, applied: false });
    expect(await a.creditFacility.count({ where: { payerAccountId: payer } })).toBe(0);
    expect((await propose(MILLION_YUAN, "--max-limit-fen=50000000", "--apply")).out).toEqual({ ok: false, code: "limit_over_cap" });
    expect((await propose(MILLION_YUAN, "--apply")).out).toMatchObject({ ok: true, applied: true, result: { replayed: false, facility: { state: "draft" } } });
    expect((await cli("show", `--payer-account-id=${payer}`)).out.facilities).toHaveLength(1);
  });
});
