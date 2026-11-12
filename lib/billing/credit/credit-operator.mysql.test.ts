import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindScope, createPayerAccount, revokeBinding } from "../payer/payer-accounts";
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
  type Ws = { ws: string; payer: string };
  const list = (entries: Array<Ws & { limitFen: number }>, batchRef = `batch-${(seq += 1)}-${run}`) => {
    const path = `list-${(seq += 1)}.json`;
    files.set(path, JSON.stringify({ v: 1, batchRef, evidenceRef: "owner-ruling:synthetic-credit", validUntil: null,
      entries: entries.map(({ ws, payer, limitFen }) => ({ workspaceId: ws, payerAccountId: payer || "payer-none", limitFen: String(limitFen) })) }));
    return path;
  };
  const dryRun = (path: string) => cli("batch", `--list-file=${path}`);
  /** Runbook step: a fresh dry run right before, then --apply bound to the list sha and that plan sha. */
  const applyStep = async (path: string, listSha: string, name: string, actor: string) => cli("batch", `--list-file=${path}`,
    `--step=${name}`, `--actor-user-id=${actor}`, `--expect-list-sha=${listSha}`, `--expect-plan-sha=${(await dryRun(path)).out.planSha}`, "--apply");
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
    if (bare) return { ws, payer: "", bindingId: "" };
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-ops" });
    const binding = await bindScope(a, { actorUserId: owner, payerAccountId: account.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: ws, evidenceRef: "approval:bind" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${account.id}`; // no mode API yet
    return { ws, payer: account.id, bindingId: binding.id };
  }
  async function activeLine(payerAccountId: string, limit: number, validUntil: Date | null = null) {
    const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId, limitFen: fen(limit), validUntil,
      operationKey: `legacy:${(seq += 1)}`, evidenceRef: "owner-ruling:legacy" });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: facility.id, action: "approve", expectedVersion: 1, evidenceRef: "review:a" });
    return changeCreditFacility(a, { actorUserId: maker, facilityId: facility.id, action: "activate", expectedVersion: 2, evidenceRef: "review:b" });
  }
  const drawable = (payerAccountId: string) => a.creditFacility.findUnique({ where: { activePayerAccountId: payerAccountId } });

  it("issues a batch in maker / checker / activate steps: new line, 10万 -> 100万 swap, blockers, sha binding, readback", async () => {
    const fresh = await workspace(), legacy = await workspace(), missing = await workspace(true), over = await workspace();
    const old = await activeLine(legacy.payer, 10_000_000); // 100,000 CNY
    const path = list([fresh, legacy, missing, over].map((w, i) => ({ ...w, limitFen: i === 3 ? MILLION_YUAN + 1 : MILLION_YUAN })));
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
    const planSha = dry.out.planSha as string;
    expect((await cli("batch", `--list-file=${path}`, "--step=propose", `--actor-user-id=${maker}`, `--expect-list-sha=${"0".repeat(64)}`,
      `--expect-plan-sha=${planSha}`, "--apply")).out).toEqual({ ok: false, code: "list_sha_mismatch" });
    expect(await a.creditFacility.count({ where: { payerAccountId: { in: [fresh.payer, legacy.payer] } } })).toBe(1);

    const step = (name: string, actor: string) => applyStep(path, listSha, name, actor);
    const proposed = await step("propose", maker);
    expect(proposed.exitCode).toBe(1); // blocked entries are reported, the rest proceed
    expect(proposed.out.results).toEqual({ applied: 2, planned: 2 });
    // The checker step skips nothing it cannot do: a maker-only actor fails every approval, nothing changes.
    expect((await step("approve", maker)).out.rows!.filter(item => item.status === "failed").map(item => item.code)).toEqual(["credit_forbidden", "credit_forbidden"]);
    // Re-running a finished step writes nothing (resume), but an --apply that ran nothing is reported as out of order.
    const rerun = await step("propose", maker);
    expect(rerun).toMatchObject({ exitCode: 1, out: { ok: false, code: "step_nothing_to_do", results: { skipped: 2, planned: 2 } } });
    expect((await step("approve", checker)).out.results).toEqual({ applied: 2, planned: 2 });
    expect(await drawable(fresh.payer)).toBeNull(); // approved is not drawable
    const activated = await step("activate", maker);
    expect(row(activated.out, legacy.ws)).toMatchObject({ status: "applied", detail: { activated: { state: "active", limitFen: String(MILLION_YUAN) },
      superseded: { id: old.id, state: "revoked", usedFen: "0" } } });
    for (const { payer } of [fresh, legacy]) expect(await drawable(payer)).toMatchObject({ limitFen: fen(MILLION_YUAN), state: "active" });

    const readback = await dryRun(path);
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
    const path = list([self, other, high].map(w => ({ ...w, limitFen: 5000 })));
    const listSha = (await dryRun(path)).out.listSha as string;
    const step = (name: string, actor: string) => applyStep(path, listSha, name, actor);
    expect((await step("propose", dual)).out.results).toEqual({ applied: 2, skipped: 1 });
    const approved = await step("approve", dual); // dual proposed both: maker = checker is refused per entry
    expect(approved.exitCode).toBe(1);
    expect(approved.out.rows!.filter(item => item.status === "failed").map(item => item.code)).toEqual(["credit_self_approval_forbidden", "credit_self_approval_forbidden"]);
    const activated = await step("activate", checker);
    expect(row(activated.out, high.ws)).toMatchObject({ action: "reduce", status: "applied", detail: { facility: { state: "reduced", limitFen: "5000" } } });
    expect(await drawable(self.payer)).toBeNull();
    // Out of order (nothing at the propose step, entries waiting for approval): no write, and not reported as success.
    expect(await step("propose", maker)).toMatchObject({ exitCode: 1, out: { ok: false, code: "step_nothing_to_do", results: { skipped: 2, planned: 1 } } });
  });

  it("refuses a second drawable facility per payer, and a swap while the old line carries usage (rolled back whole)", async () => {
    const self = await workspace();
    const { ws, payer } = self;
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
    // Only the payer's drawable line can be superseded, never a draft or approved one.
    const { facility: draft } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId: payer, limitFen: fen(10),
      validUntil: null, operationKey: `draft:${run}`, evidenceRef: "owner-ruling:draft" });
    expect((await activate(`--supersedes-facility-id=${draft.id}`, "--supersedes-version=1")).out).toEqual({ ok: false, code: "credit_supersede_invalid" });
    expect(await a.creditFacility.findUnique({ where: { id: draft.id } })).toMatchObject({ state: "draft", version: 1 });
    await a.$transaction(async tx => {
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
      await drawCreditShortfallInTransaction(tx, { payerAccountId: payer, chargeFen: fen(300), sourceRef: `usage:${run}`,
        actor: { type: "SYSTEM", ref: "billing-settle" }, reservedAt: now });
    });
    expect(row((await dryRun(list([{ ...self, limitFen: MILLION_YUAN }]))).out, ws)).toMatchObject({ action: "blocked", blocker: "current_in_use" });
    expect(row((await dryRun(list([{ ...self, limitFen: 200 }]))).out, ws)).toMatchObject({ action: "blocked", blocker: "target_below_used" });
    expect((await activate(`--supersedes-facility-id=${old.id}`, `--supersedes-version=${old.version}`)).out).toEqual({ ok: false, code: "credit_supersede_in_use" });
    expect(await drawable(payer)).toMatchObject({ id: old.id, state: "active", usedFen: fen(300) }); // revoke rolled back too
    expect(await a.auditLog.count({ where: { targetId: old.id, actionType: "BILLING_CREDIT_FACILITY_REVOKE" } })).toBe(0); // and its audit row
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
    // The cap binds the checker: a line proposed under a raised cap is not approvable under the default one.
    const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId: payer, limitFen: fen(MILLION_YUAN + 1),
      validUntil: null, operationKey: `raised:${run}`, evidenceRef: "owner-ruling:raised" });
    const approve = (...extra: string[]) => cli("approve", `--actor-user-id=${checker}`, `--facility-id=${facility.id}`, "--expected-version=1",
      "--evidence-ref=review:raised", ...extra, "--apply");
    expect((await approve()).out).toEqual({ ok: false, code: "limit_over_cap" });
    expect((await approve(`--max-limit-fen=${MILLION_YUAN + 1}`)).out).toMatchObject({ ok: true, result: { state: "approved" } });
    // A line past its term lends nothing: never reported done, the operator expires it first.
    const lapsed = await workspace();
    await activeLine(lapsed.payer, MILLION_YUAN, new Date(Date.now() + 1500));
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(row((await dryRun(list([{ ...lapsed, limitFen: MILLION_YUAN }]))).out, lapsed.ws))
      .toMatchObject({ action: "blocked", blocker: "current_past_term" });
  });
  it("binds --apply to the confirmed payer and plan: a rebind after the dry run writes nothing; same payer twice refuses the list", async () => {
    const moved = await workspace(), stays = await workspace();
    const path = list([moved, stays].map(w => ({ ...w, limitFen: 5000 })));
    const dry = await dryRun(path);
    // The workspace is rebound to another payer after the owner confirmed the plan.
    await revokeBinding(a, { actorUserId: owner, bindingId: moved.bindingId, expectedVersion: 1, evidenceRef: "approval:unbind" });
    const other = await createPayerAccount(a, { actorUserId: owner, workspaceId: moved.ws, kind: "enterprise_contract", contractSubjectRef: "subject-other" });
    await bindScope(a, { actorUserId: owner, payerAccountId: other.id, expectedPayerVersion: 1, scopeKind: "workspace", scopeRef: moved.ws, evidenceRef: "approval:rebind" });
    const stale = await cli("batch", `--list-file=${path}`, "--step=propose", `--actor-user-id=${maker}`, `--expect-list-sha=${dry.out.listSha}`,
      `--expect-plan-sha=${dry.out.planSha}`, "--apply");
    expect(stale).toEqual({ exitCode: 1, out: { ok: false, code: "plan_sha_mismatch" } });
    expect(await a.creditFacility.count({ where: { payerAccountId: { in: [moved.payer, stays.payer, other.id] } } })).toBe(0);
    // A fresh plan blocks that entry (the list names the old payer); the other entry proceeds.
    expect(row((await dryRun(path)).out, moved.ws)).toMatchObject({ action: "blocked", blocker: "payer_mismatch", payerAccountId: other.id });
    expect(row((await applyStep(path, dry.out.listSha as string, "propose", maker)).out, stays.ws)).toMatchObject({ status: "applied" });
    expect(await a.creditFacility.count({ where: { payerAccountId: other.id } })).toBe(0);
    // Two workspaces of one payer in one list: the whole list is refused before any read or write.
    const twin = id(`ws${(seq += 1)}`);
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${twin},'Synthetic customer',${twin},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${twin}`},${twin},${owner},'OWNER','ACTIVE',NOW(3))`;
    await bindScope(a, { actorUserId: owner, payerAccountId: stays.payer, expectedPayerVersion: 2, scopeKind: "workspace", scopeRef: twin, evidenceRef: "approval:twin" });
    expect(await dryRun(list([stays, { ws: twin, payer: stays.payer }].map(w => ({ ...w, limitFen: 5000 })))))
      .toEqual({ exitCode: 2, out: { ok: false, code: "usage:list_duplicate_payer" } });
  });

  it("never acts on a batchRef reused with another amount (before or after activation), and maps a racing propose to a conflict", async () => {
    const w = await workspace();
    const batchRef = `reuse-${run}`;
    const first = list([{ ...w, limitFen: 5000 }], batchRef);
    await applyStep(first, (await dryRun(first)).out.listSha as string, "propose", maker);
    const changed = list([{ ...w, limitFen: 6000 }], batchRef); // only the amount differs
    expect(row((await dryRun(changed)).out, w.ws)).toMatchObject({ action: "blocked", blocker: "batch_key_conflict" });
    const listSha = (await dryRun(first)).out.listSha as string;
    await applyStep(first, listSha, "approve", checker);
    await applyStep(first, listSha, "activate", maker);
    // After activation a lower amount under the same batchRef is a conflict, not a silent reduce.
    expect(row((await dryRun(list([{ ...w, limitFen: 4000 }], batchRef))).out, w.ws)).toMatchObject({ action: "blocked", blocker: "batch_key_conflict" });
    expect(await drawable(w.payer)).toMatchObject({ limitFen: fen(5000), state: "active" });

    const racers = [await workspace(), await workspace()];
    const race = list(racers.map(item => ({ ...item, limitFen: 5000 })));
    const dry = await dryRun(race);
    const [b, c] = [0, 1].map(() => new PrismaClient({ datasources: { db: { url } } }));
    try {
      const argv = ["batch", `--list-file=${race}`, "--step=propose", `--actor-user-id=${maker}`, `--expect-list-sha=${dry.out.listSha}`,
        `--expect-plan-sha=${dry.out.planSha}`, "--apply"];
      // Barrier: hold the first payer's lock until both runs wait on it, so both proposes are open before either commits.
      let release = () => {};
      let held = () => {};
      const isHeld = new Promise<void>(resolve => { held = resolve; });
      const barrier = c.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${racers[0].payer} FOR UPDATE`;
        held();
        await new Promise<void>(resolve => { release = resolve; });
      }, { timeout: 10000 });
      await isHeld;
      const runs = [a, b].map(client => runCreditOperator(client, argv, path => Buffer.from(files.get(path) ?? "")));
      await new Promise(resolve => setTimeout(resolve, 1000));
      release();
      await barrier;
      const results = await Promise.all(runs);
      const codes = results.flatMap(result => (result.output as { rows: Array<{ status: string; code?: string }> }).rows)
        .filter(item => item.status === "failed").map(item => item.code);
      expect(codes.length).toBeGreaterThan(0); // the race was really exercised
      expect(codes.every(code => code === "credit_write_conflict")).toBe(true);
    } finally { await Promise.all([b.$disconnect(), c.$disconnect()]); }
    for (const { payer } of racers) expect(await a.creditFacility.count({ where: { payerAccountId: payer } })).toBe(1);
  });
});
