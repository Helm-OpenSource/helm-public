import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { grantPlatformFinanceRole, revokePlatformFinanceRole } from "../bank-receipts/bank-receipts";
import { changeCreditFacility, proposeCreditFacility } from "../credit/credit-facilities";
import { changeSpendGrant, createSpendGrant, createSpendGrantInTransaction, publishPriceVersion } from "../grants/price-grants";
import { revokeBinding } from "../payer/payer-accounts";
import { parseOperationList, runPlatformBatch, type PlatformBatchArgs } from "./platform-batch";
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

describe.skipIf(!url)("platform billing operations against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (name: string) => `pbo-${name}-${run}`;
  const [admin, maker, checker, dual, owner] = ["admin", "maker", "checker", "dual", "owner"].map(id);
  const ruling = `owner-ruling:synthetic-${run}`;
  let a: PrismaClient, b: PrismaClient, reserved: string;
  let seq = 0;
  const workspace = async () => {
    const ws = id(`ws${(seq += 1)}`);
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic customer',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${ws}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    return ws;
  };
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
  // Operation rows refuse DELETE by trigger; this synthetic database is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  const onboard = (workspaceId: string): PlatformOperationRequest => ({ kind: "payer_onboard", workspaceId, contractSubjectRef: "subject-e1a" });
  const mode = (workspaceId: string, fromMode: "off" | "shadow" | "enforce", toMode: "off" | "shadow" | "enforce"): PlatformOperationRequest =>
    ({ kind: "billing_mode", workspaceId, fromMode, toMode });
  const draft = (request: PlatformOperationRequest, actorUserId = maker, extra: { confirmEnforce?: boolean; client?: PrismaClient } = {}) =>
    draftPlatformOperation(extra.client ?? a, { actorUserId, evidenceRef: ruling, request, confirmEnforce: extra.confirmEnforce });
  const review = (request: PlatformOperationRequest, actorUserId = checker,
    extra: { decision?: "approve" | "reject"; confirmEnforce?: boolean; client?: PrismaClient } = {}) =>
    reviewPlatformOperation(extra.client ?? a, { actorUserId, evidenceRef: ruling, request, decision: extra.decision ?? "approve",
      reviewEvidenceRef: "review:synthetic", confirmEnforce: extra.confirmEnforce });
  const payerOf = async (ws: string) => {
    const binding = await a.payerScopeBinding.findFirstOrThrow({ where: { scopeKind: "workspace", activeScopeRef: ws } });
    return a.payerAccount.findUniqueOrThrow({ where: { id: binding.payerAccountId } });
  };
  const modeOfPayer = async (id: string) => (await a.payerAccount.findUniqueOrThrow({ where: { id } })).billingMode;
  const onboarded = async () => { const ws = await workspace(); await draft(onboard(ws)); await review(onboard(ws)); return ws; };

  it("onboards a workspace payer without the customer OWNER, maker and checker distinct, replaying both steps", async () => {
    const ws = await workspace();
    const drafted = await draft(onboard(ws));
    expect(drafted).toMatchObject({ replayed: false, operation: { state: "drafted", draftedByUserId: maker } });
    expect(await a.payerScopeBinding.count({ where: { scopeRef: ws } })).toBe(0); // nothing applied before review
    expect((await draft(onboard(ws))).replayed).toBe(true);
    await expect(draft({ ...onboard(ws), contractSubjectRef: "other-subject" } as PlatformOperationRequest)).rejects.toThrow("platform_operation_conflict");
    // The checker's list must restate the drafted content exactly.
    await expect(review({ ...onboard(ws), contractSubjectRef: "other-subject" } as PlatformOperationRequest)).rejects.toThrow("platform_operation_conflict");
    const applied = await review(onboard(ws));
    expect(applied.operation).toMatchObject({ state: "applied", reviewedByUserId: checker, version: 2 });
    const payer = await payerOf(ws);
    expect(payer).toMatchObject({ id: applied.operation.resultRef, kind: "enterprise_contract", governingWorkspaceId: ws, billingMode: "off", version: 2 });
    expect(await a.payerScopeBinding.findFirstOrThrow({ where: { activeScopeRef: ws } })).toMatchObject({ authorizedByUserId: checker, evidenceRef: ruling });
    expect((await review(onboard(ws))).replayed).toBe(true);
    await expect(review(onboard(ws), checker, { decision: "reject" })).rejects.toThrow("platform_operation_not_pending");
    // Audit commits with the change, in the reserved workspace and the target workspace.
    const actions = await a.auditLog.findMany({ where: { targetId: { in: [applied.operation.id] } }, select: { workspaceId: true, actionType: true } });
    expect(actions).toHaveLength(4);
    expect(new Set(actions.map(row => row.workspaceId))).toEqual(new Set([reserved, ws]));
    expect(await a.auditLog.count({ where: { workspaceId: ws, actionType: "BILLING_PAYER_SCOPE_BOUND" } })).toBe(1);
    await expect(draft(onboard(ws), maker)).resolves.toMatchObject({ replayed: true }); // same ruling: replay, not a second payer
  });

  it("refuses the drafter as reviewer, non-platform identities and revoked grants (service and DB CHECK)", async () => {
    const ws = await workspace();
    await expect(draft(onboard(ws), owner)).rejects.toThrow("platform_operation_forbidden"); // customer OWNER
    await expect(draft(onboard(ws), checker)).rejects.toThrow("platform_operation_forbidden"); // checker cannot draft
    await draft(onboard(ws), dual);
    await expect(review(onboard(ws), dual)).rejects.toThrow("platform_operation_self_review_forbidden");
    await expect(review(onboard(ws), maker)).rejects.toThrow("platform_operation_forbidden"); // maker cannot review
    await expect(review(onboard(ws), owner)).rejects.toThrow("platform_operation_forbidden");
    const revoked = await a.platformFinanceGrant.findFirstOrThrow({ where: { userId: dual, role: "checker", state: "active" } });
    await revokePlatformFinanceRole(a, { actorUserId: admin, grantId: revoked.id, expectedVersion: revoked.version, evidenceRef: "approval:finance-roster" });
    await expect(review(onboard(ws), dual)).rejects.toThrow("platform_operation_forbidden"); // revoked checker grant
    await grantPlatformFinanceRole(a, { actorUserId: admin, userId: dual, role: "checker", evidenceRef: "approval:finance-roster" });
    await expect(a.$executeRaw`UPDATE PlatformBillingOperation SET state='rejected', reviewedByUserId=draftedByUserId,
      reviewEvidenceRef='x', reviewedAt=NOW(3), version=version+1 WHERE workspaceId=${ws}`).rejects.toThrow(/maker_checker_check/);
    await expect(a.$executeRaw`DELETE FROM PlatformBillingOperation WHERE workspaceId=${ws}`).rejects.toThrow(/no_delete/);
    expect(await a.payerScopeBinding.count({ where: { scopeRef: ws } })).toBe(0);
    await expect(draft(onboard(reserved))).rejects.toThrow("workspace_unavailable");
  });

  const day = 86_400_000;
  /** Publishes a price (one product per call, shared event) and opens an active grant valid from `from` via the customer path. */
  async function grant(payerAccountId: string, product: string, from = Date.now() - day) {
    const { priceVersion } = await publishPriceVersion(a, { actor: { type: "SYSTEM", ref: "synthetic" }, productCode: `${product}-${run}`,
      version: 1, billingEventRef: `event:${run}`, meterUnit: "minute", acceptanceRef: "acceptance:synthetic", scopeKind: "workspace",
      unitPriceFenNumerator: BigInt(35), unitPriceDenominator: BigInt(1), effectiveFrom: new Date(Date.now() - day), effectiveUntil: null, approvalRef: ruling });
    const { grant: row } = await createSpendGrant(a, { actorUserId: owner, payerAccountId, priceVersionId: priceVersion.id, operationKey: product,
      evidenceRef: ruling, validFrom: new Date(from), validUntil: new Date(Date.now() + 2 * day),
      limits: { perChargeLimitFen: BigInt(100), dailyLimitFen: BigInt(100), monthlyLimitFen: BigInt(100) } });
    return changeSpendGrant(a, { actorUserId: owner, grantId: row.id, expectedVersion: 1, action: "activate", evidenceRef: ruling });
  }
  async function credit(payerAccountId: string, limitFen: number) {
    const { facility } = await proposeCreditFacility(a, { actorUserId: maker, payerAccountId, limitFen: BigInt(limitFen), validUntil: null,
      operationKey: `credit-${payerAccountId}`, evidenceRef: ruling });
    await changeCreditFacility(a, { actorUserId: checker, facilityId: facility.id, expectedVersion: 1, action: "approve", evidenceRef: ruling });
    await changeCreditFacility(a, { actorUserId: maker, facilityId: facility.id, expectedVersion: 2, action: "activate", evidenceRef: ruling });
  }

  it("switches off -> enforce only when confirmed twice, with exactly one usable grant and positive headroom; rolls back to shadow", async () => {
    const ws = await onboarded();
    await expect(draft(mode(ws, "off", "enforce"))).rejects.toThrow("platform_enforce_not_confirmed");
    await draft(mode(ws, "off", "enforce"), maker, { confirmEnforce: true });
    await expect(review(mode(ws, "off", "enforce"))).rejects.toThrow("platform_enforce_not_confirmed");
    const enforce = () => review(mode(ws, "off", "enforce"), checker, { confirmEnforce: true });
    await expect(enforce()).rejects.toThrow("enforce_grant_not_ready");
    const payerAccountId = (await payerOf(ws)).id;
    await grant(payerAccountId, "future", Date.now() + day); // active but not yet valid: quote would not find it
    await expect(enforce()).rejects.toThrow("enforce_grant_not_ready");
    await grant(payerAccountId, "usable");
    const second = await grant(payerAccountId, "second"); // two usable grants for one event and unit: quote finds none
    await expect(enforce()).rejects.toThrow("enforce_grant_not_ready");
    await changeSpendGrant(a, { actorUserId: owner, grantId: second.id, expectedVersion: second.version, action: "revoke", evidenceRef: ruling });
    await expect(enforce()).rejects.toThrow("enforce_headroom_insufficient"); // no wallet, no credit: enforce would stop it at once
    await credit(payerAccountId, 1000);
    expect((await payerOf(ws)).billingMode).toBe("off");
    await enforce();
    expect(await payerOf(ws)).toMatchObject({ billingMode: "enforce", version: 3 });
    await draft(mode(ws, "enforce", "shadow")); // recommended rollback; needs no confirmation, still maker + checker
    await review(mode(ws, "enforce", "shadow"));
    expect((await payerOf(ws)).billingMode).toBe("shadow");
    expect(await a.auditLog.count({ where: { workspaceId: ws, actionType: "BILLING_PAYER_MODE_CHANGED" } })).toBe(2);
    // Under the same ruling: back to enforce, then a second identical rollback must not replay as success.
    await draft(mode(ws, "shadow", "enforce"), maker, { confirmEnforce: true });
    await review(mode(ws, "shadow", "enforce"), checker, { confirmEnforce: true });
    await expect(draft(mode(ws, "enforce", "shadow"))).rejects.toThrow("platform_operation_stale_replay");
    await expect(review(mode(ws, "enforce", "shadow"))).rejects.toThrow("platform_operation_stale_replay"); // checker re-running the old list
    expect((await payerOf(ws)).billingMode).toBe("enforce");
  });

  it("nets held enforce reservations out of the headroom", async () => {
    const ws = await onboarded();
    const payerAccountId = (await payerOf(ws)).id;
    const usable = await grant(payerAccountId, "held");
    await credit(payerAccountId, 1000);
    await a.billingReservation.create({ data: { payerAccountId, idempotencyKey: "held-1", operationRef: "held-1", contentHash: "0".repeat(64),
      grantId: usable.id, grantVersion: usable.version, productId: usable.productId, priceVersionId: usable.priceVersionId,
      priceContentHash: "0".repeat(64), billingEventRef: `event:${run}`, meterUnit: "minute", quantity: BigInt(1), chargeFen: BigInt(1000),
      billingMode: "enforce", reservedAt: new Date(), dayKey: "2026-11-12", monthKey: "2026-11", createdBy: "synthetic",
      subjectWorkspaceId: ws, payerBindingId: "synthetic", payerBindingVersion: 1 } });
    await draft(mode(ws, "off", "enforce"), maker, { confirmEnforce: true });
    await expect(review(mode(ws, "off", "enforce"), checker, { confirmEnforce: true })).rejects.toThrow("enforce_headroom_insufficient");
  });

  it("refuses an approval once the workspace was rebound to another payer after the draft", async () => {
    const ws = await onboarded();
    const before = await payerOf(ws);
    await draft(mode(ws, "off", "shadow"));
    const bound = await a.payerScopeBinding.findFirstOrThrow({ where: { activeScopeRef: ws } });
    await revokeBinding(a, { actorUserId: owner, bindingId: bound.id, expectedVersion: bound.version, evidenceRef: ruling });
    const rebind = { actorUserId: maker, evidenceRef: `${ruling}-rebind`, request: onboard(ws) };
    await draftPlatformOperation(a, rebind);
    await reviewPlatformOperation(a, { ...rebind, actorUserId: checker, decision: "approve", reviewEvidenceRef: "review:synthetic" });
    const after = await payerOf(ws);
    await expect(review(mode(ws, "off", "shadow"))).rejects.toThrow("payer_unresolved");
    expect([await modeOfPayer(before.id), after.billingMode, (await payerOf(ws)).billingMode]).toEqual(["off", "off", "off"]);
  });

  it("applies the mode change as a CAS on the expected old mode at approval time", async () => {
    const ws = await onboarded();
    await expect(draft(mode(ws, "shadow", "off"))).rejects.toThrow("billing_mode_conflict"); // wrong old mode at draft
    await draft(mode(ws, "off", "shadow"));
    const payer = await payerOf(ws);
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = 'enforce' WHERE id = ${payer.id}`; // concurrent change after draft
    await expect(review(mode(ws, "off", "shadow"))).rejects.toThrow("billing_mode_conflict");
    expect(await payerOf(ws)).toMatchObject({ billingMode: "enforce", version: payer.version });
    const pending = await a.platformBillingOperation.findFirstOrThrow({ where: { workspaceId: ws, kind: "billing_mode" } });
    expect(pending).toMatchObject({ state: "drafted", version: 1 }); // rolled back with the refused change, no audit
    expect(await a.auditLog.count({ where: { targetId: pending.id, actionType: { not: "BILLING_PLATFORM_OPERATION_DRAFTED" } } })).toBe(0);
    await expect(review(mode(ws, "off", "shadow"), checker, { decision: "reject" })).resolves.toMatchObject({ operation: { state: "rejected" } });
    // Two checkers' sessions approving one draft: exactly one applies.
    const step = mode(ws, "enforce", "shadow");
    await draft(step, maker);
    const results = await Promise.allSettled([checker, dual].flatMap(user => [a, b].map(client => review(step, user, { client }))));
    expect(results.filter(r => r.status === "fulfilled" && !r.value.replayed)).toHaveLength(1);
    expect((await payerOf(ws)).billingMode).toBe("shadow");
  });

  it("rolls the change and its audit back together when the transaction fails", async () => {
    const ws = await workspace();
    await draft(onboard(ws));
    const broken = { $transaction: (fn: Parameters<PrismaClient["$transaction"]>[0]) => a.$transaction(async tx => {
      await (fn as (t: typeof tx) => Promise<unknown>)(tx); throw new Error("synthetic_after_write_failure");
    }) } as unknown as PrismaClient;
    await expect(reviewPlatformOperation(broken, { actorUserId: checker, evidenceRef: ruling, request: onboard(ws), decision: "approve",
      reviewEvidenceRef: "review:synthetic" })).rejects.toThrow("synthetic_after_write_failure");
    expect(await a.payerAccount.count({ where: { governingWorkspaceId: ws } })).toBe(0);
    expect(await a.auditLog.count({ where: { workspaceId: ws, actionType: { not: "BILLING_PLATFORM_OPERATION_DRAFTED" } } })).toBe(0);
    expect((await a.platformBillingOperation.findFirstOrThrow({ where: { workspaceId: ws } })).state).toBe("drafted");
  });

  it("runs a list: dry run writes nothing, apply needs the list and plan sha, stops at a refusal and resumes idempotently", async () => {
    const [w1, w2, w3] = [await workspace(), await workspace(), await workspace()];
    const bytes = (entries: PlatformOperationRequest[]) => Buffer.from(JSON.stringify({ evidenceRef: ruling, entries }));
    const list = parseOperationList(bytes([onboard(w1), onboard(w2), onboard(w3)]));
    const args = (extra: Partial<PlatformBatchArgs>): PlatformBatchArgs => ({ command: "draft", listFile: "-", actorUserId: maker,
      apply: true, listSha: list.sha256, planSha: null, decision: null, reviewEvidenceRef: null, confirmEnforce: false, ...extra });
    const dryRun = (extra: Partial<PlatformBatchArgs> = {}) => runPlatformBatch(a, args({ ...extra, apply: false, listSha: null }), list);
    /** Dry run, then apply with the plan sha it printed (the operator's two steps). */
    const apply = async (extra: Partial<PlatformBatchArgs> = {}) => runPlatformBatch(a, args({ ...extra, planSha: (await dryRun(extra)).planSha }), list);
    const dry = await dryRun();
    expect(dry).toMatchObject({ ok: true, applied: false, listSha: list.sha256, planSha: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(await a.platformBillingOperation.count({ where: { workspaceId: { in: [w1, w2, w3] } } })).toBe(0);
    expect(await runPlatformBatch(a, args({ listSha: "0".repeat(64), planSha: dry.planSha }), list)).toMatchObject({ ok: false, code: "list_sha_mismatch" });
    expect(await runPlatformBatch(a, args({ planSha: "0".repeat(64) }), list)).toMatchObject({ ok: false, code: "plan_sha_mismatch" });
    await a.$executeRaw`UPDATE Workspace SET status = 'SUSPENDED' WHERE id = ${w2}`;
    const stopped = await apply();
    expect(stopped).toMatchObject({ ok: false, stoppedAt: { index: 1, code: "workspace_unavailable" } });
    expect(stopped.results).toHaveLength(1);
    await a.$executeRaw`UPDATE Workspace SET status = 'ACTIVE' WHERE id = ${w2}`;
    expect(await runPlatformBatch(a, args({ planSha: dry.planSha }), list)).toMatchObject({ code: "plan_sha_mismatch" }); // state moved on
    const resumed = await apply();
    expect(resumed.ok && resumed.results?.map(row => row.replayed)).toEqual([true, false, false]);
    const reviewArgs = { command: "review" as const, actorUserId: checker, decision: "approve" as const, reviewEvidenceRef: "review:synthetic" };
    expect((await apply(reviewArgs)).ok).toBe(true);
    expect((await apply(reviewArgs)).results?.every(row => row.replayed && row.state === "applied")).toBe(true);
    const after = await dryRun();
    expect(after.plan?.map(row => [row.operationState, row.currentMode])).toEqual([["applied", "off"], ["applied", "off"], ["applied", "off"]]);
    expect(after.plan?.[0]).toMatchObject({ payerAccountId: (await payerOf(w1)).id, bindingId: expect.any(String) });
  });

  it("stops an apply whose workspace was rebound to another payer after the dry run", async () => {
    const ws = await onboarded();
    const list = parseOperationList(Buffer.from(JSON.stringify({ evidenceRef: `${ruling}-drift`, entries: [mode(ws, "off", "shadow")] })));
    const args: PlatformBatchArgs = { command: "draft", listFile: "-", actorUserId: maker, apply: false, listSha: null, planSha: null,
      decision: null, reviewEvidenceRef: null, confirmEnforce: false };
    const dry = await runPlatformBatch(a, args, list);
    const bound = await a.payerScopeBinding.findFirstOrThrow({ where: { activeScopeRef: ws } });
    await revokeBinding(a, { actorUserId: owner, bindingId: bound.id, expectedVersion: bound.version, evidenceRef: ruling });
    const rebind = { actorUserId: maker, evidenceRef: `${ruling}-drift-rebind`, request: onboard(ws) };
    await draftPlatformOperation(a, rebind);
    await reviewPlatformOperation(a, { ...rebind, actorUserId: checker, decision: "approve", reviewEvidenceRef: "review:synthetic" });
    expect(await runPlatformBatch(a, { ...args, apply: true, listSha: list.sha256, planSha: dry.planSha }, list))
      .toMatchObject({ ok: false, code: "plan_sha_mismatch" });
    expect(await a.platformBillingOperation.count({ where: { workspaceId: ws, kind: "billing_mode" } })).toBe(0);
  });

  // E1b: platform price publishing and spend grants. Placeholder price 35/1 fen per minute = 财模规划价 0.35 元/分钟 (规划试算价).
  const price = (version: number, extra: Partial<Record<string, unknown>> = {}) => ({ kind: "price_publish", productCode: `robot-call-${run}`,
    version, billingEventRef: "service-billing-event-v1:robot_call_minute", meterUnit: "minute", acceptanceRef: "acceptance:connected-call",
    unitPriceFenNumerator: "35", unitPriceDenominator: "1", effectiveFrom: "2026-11-01T00:00:00.000Z", effectiveUntil: null,
    approvalRef: "owner-ruling:planning-estimate-not-a-quote", priceLabel: "planning_estimate_not_a_quote", ...extra }) as PlatformOperationRequest;
  const grantFor = (workspaceId: string, priceVersion = 1, perChargeLimitFen = "3500") => ({ kind: "spend_grant", workspaceId,
    productCode: `robot-call-${run}`, priceVersion, validFrom: "2026-11-01T00:00:00.000Z", validUntil: "2027-11-01T00:00:00.000Z",
    perChargeLimitFen, dailyLimitFen: "5000000", monthlyLimitFen: "100000000" }) as PlatformOperationRequest;

  it("publishes a non-zero price version only through maker and a different checker, replaying", async () => {
    await expect(draft(price(1, { unitPriceFenNumerator: "0" }))).rejects.toThrow("price_zero_refused");
    await expect(draft(price(1), owner)).rejects.toThrow("platform_operation_forbidden");
    const drafted = await draft(price(1), dual);
    expect(drafted.operation).toMatchObject({ workspaceId: reserved, payerAccountId: null, state: "drafted" });
    await expect(review(price(1), dual)).rejects.toThrow("platform_operation_self_review_forbidden");
    expect(await a.billingProduct.count({ where: { code: `robot-call-${run}` } })).toBe(0);
    const applied = await review(price(1));
    const row = await a.billingPriceVersion.findUniqueOrThrow({ where: { id: applied.operation.resultRef! } });
    expect(row).toMatchObject({ version: 1, meterUnit: "minute", billingEventRef: "service-billing-event-v1:robot_call_minute",
      unitPriceFenNumerator: BigInt(35), unitPriceDenominator: BigInt(1), createdBy: `SYSTEM:platform-op:${applied.operation.id}` });
    expect((await review(price(1))).replayed).toBe(true);
    expect(await a.auditLog.count({ where: { targetId: applied.operation.id, workspaceId: reserved } })).toBe(2);
  });

  it("opens a spend grant (create, set_limits, activate) for a platform-onboarded payer, one open grant per product", async () => {
    const ws = await onboarded();
    await expect(draft(grantFor(ws, 9))).resolves.toMatchObject({ replayed: false });
    await expect(review(grantFor(ws, 9))).rejects.toThrow("price_version_unavailable");
    await draft(grantFor(ws, 1, "0"));
    await expect(review(grantFor(ws, 1, "0"))).rejects.toThrow("grant_limits_zero");
    expect(await a.spendGrant.count({ where: { payerAccountId: (await payerOf(ws)).id } })).toBe(0); // rolled back with the refusal
    const other = await onboarded();
    await draft(grantFor(other));
    await expect(review(grantFor(other), owner)).rejects.toThrow("platform_operation_forbidden");
    const applied = await review(grantFor(other));
    const grant = await a.spendGrant.findUniqueOrThrow({ where: { id: applied.operation.resultRef! } });
    expect(grant).toMatchObject({ state: "active", version: 3, perChargeLimitFen: BigInt(3500), createdByUserId: checker, evidenceRef: ruling,
      payerAccountId: (await payerOf(other)).id });
    const steps = await a.auditLog.findMany({ where: { workspaceId: other, targetId: grant.id }, select: { actionType: true } });
    expect(steps.map(step => step.actionType).sort()).toEqual(["BILLING_SPEND_GRANT_ACTIVATE", "BILLING_SPEND_GRANT_CREATED",
      "BILLING_SPEND_GRANT_SET_LIMITS"]);
    // The platform authority inside price-grants re-checks the checker grant itself; a maker or customer OWNER is refused there.
    for (const actorUserId of [maker, owner]) {
      await expect(a.$transaction(tx => createSpendGrantInTransaction(tx, { actorUserId, payerAccountId: grant.payerAccountId,
        priceVersionId: grant.priceVersionId, operationKey: `direct-${actorUserId}`, evidenceRef: ruling, validFrom: new Date("2026-11-01T00:00:00Z"),
        validUntil: new Date("2027-11-01T00:00:00Z") }, "platform_checker"))).rejects.toThrow("grant_forbidden");
    }
    await draft(price(2, { unitPriceFenNumerator: "40" }));
    await review(price(2, { unitPriceFenNumerator: "40" }));
    await draft(grantFor(other, 2));
    await expect(review(grantFor(other, 2))).rejects.toThrow("grant_active_exists");
  });

  it("runs a price-and-grant list with the label and price shown, resuming idempotently", async () => {
    const [w1, w2] = [await onboarded(), await onboarded()];
    const bytes = Buffer.from(JSON.stringify({ evidenceRef: `${ruling}-list`, entries: [price(3, { unitPriceFenNumerator: "45" }), grantFor(w1, 3), grantFor(w2, 3)] }));
    const list = parseOperationList(bytes);
    const args = (extra: Partial<PlatformBatchArgs>): PlatformBatchArgs => ({ command: "draft", listFile: "-", actorUserId: maker,
      apply: true, listSha: list.sha256, planSha: null, decision: null, reviewEvidenceRef: null, confirmEnforce: false, ...extra });
    const dryRun = (extra: Partial<PlatformBatchArgs> = {}) => runPlatformBatch(a, args({ ...extra, apply: false, listSha: null }), list);
    const apply = async (extra: Partial<PlatformBatchArgs> = {}) => runPlatformBatch(a, args({ ...extra, planSha: (await dryRun(extra)).planSha }), list);
    const dry = await dryRun();
    expect(dry.plan?.[0]).toMatchObject({ priceNotice: "规划试算价，不作为报价", operationState: null, payerAccountId: null });
    expect(dry.plan?.[1]).toMatchObject({ limitUnits: null, priceContentHash: null, payerAccountId: (await payerOf(w1)).id }); // price 3 not yet published
    expect((await apply()).ok).toBe(true);
    const reviewArgs = { command: "review" as const, actorUserId: checker, decision: "approve" as const, reviewEvidenceRef: "review:synthetic" };
    expect((await apply(reviewArgs)).results?.map(row => row.state)).toEqual(["applied", "applied", "applied"]);
    expect((await apply(reviewArgs)).results?.every(row => row.replayed)).toBe(true);
    const after = await dryRun();
    expect(after.plan?.[1]).toMatchObject({ limitUnits: { meterUnit: "minute", perCharge: "77", daily: "111111", monthly: "2222222" },
      priceContentHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    for (const ws of [w1, w2]) expect(await a.spendGrant.count({ where: { payerAccountId: (await payerOf(ws)).id, state: "active" } })).toBe(1);
  });
});
