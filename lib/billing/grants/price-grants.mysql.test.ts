import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPayerAccount } from "../payer/payer-accounts";
import { changeSpendGrant, createSpendGrant, lockSpendGrantForUseInTransaction, publishPriceVersion,
  type PublishPriceVersionInput, type SpendGrantAction, type SpendGrantLimits } from "./price-grants";

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

describe.skipIf(!url)("price versions and spend grants against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const ws = `grant-ws-${run}`, owner = `grant-owner-${run}`, admin = `grant-admin-${run}`, member = `grant-member-${run}`;
  const fen = (value: number) => BigInt(value);
  const limits = (per: number, day: number, month: number): SpendGrantLimits =>
    ({ perChargeLimitFen: fen(per), dailyLimitFen: fen(day), monthlyLimitFen: fen(month) });
  const validFrom = new Date("2026-11-01T00:00:00Z"), validUntil = new Date("2027-01-01T00:00:00Z"), at = new Date("2026-11-10T04:00:00Z");
  let a: PrismaClient, b: PrismaClient;
  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic grants',${ws},NOW(3))`;
    for (const [user, role] of [[owner, "OWNER"], [admin, "BILLING_ADMIN"], [member, "MEMBER"]]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${user},'Synthetic',${`${user}@example.invalid`},NOW(3))`;
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${user}`},${ws},${user},${role},'ACTIVE',NOW(3))`;
    }
  });
  // Catalog rows are immutable by trigger, so this synthetic database keeps them; it is discarded after the run.
  afterAll(async () => { await Promise.all([a?.$disconnect(), b?.$disconnect()]); });

  const price = (version: number, numerator: number, extra: Partial<PublishPriceVersionInput> = {}) => publishPriceVersion(a, {
    actor: { type: "SYSTEM", ref: "synthetic-catalog" }, productCode: `synthetic.p${run}`, version, meterUnit: "document",
    billingEventRef: "service-billing-event-v1:synthetic", acceptanceRef: "acceptance:synthetic", scopeKind: "workspace",
    unitPriceFenNumerator: fen(numerator), unitPriceDenominator: fen(1), effectiveFrom: validFrom, effectiveUntil: null,
    approvalRef: "approval:synthetic", ...extra });
  let v1Id = "";
  async function payer(mode: "off" | "shadow" | "enforce" = "enforce") {
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-grant" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // no mode API yet
    return account.id;
  }
  const grant = (payerAccountId: string, operationKey: string, actorUserId = owner, extra: Record<string, unknown> = {}) =>
    createSpendGrant(a, { actorUserId, payerAccountId, priceVersionId: v1Id, operationKey, evidenceRef: "consent:synthetic",
      validFrom, validUntil, ...extra });
  const change = (grantId: string, expectedVersion: number, action: SpendGrantAction, extra: Record<string, unknown> = {}, client = a) =>
    changeSpendGrant(client, { actorUserId: owner, grantId, expectedVersion, action, evidenceRef: "consent:change", now: at, ...extra });
  const use = (payerAccountId: string, grantId: string, chargeFen: number, extra: Record<string, unknown> = {}, client = a) =>
    client.$transaction(tx => lockSpendGrantForUseInTransaction(tx, { payerAccountId, grantId, priceVersionId: v1Id,
      chargeFen: fen(chargeFen), at, usedFen: { day: fen(0), month: fen(0) }, ...extra }));
  async function activeGrant(key: string) {
    const id = await payer();
    const { grant: row } = await grant(id, key, owner, { limits: limits(500, 1000, 3000) });
    await change(row.id, 1, "activate");
    return { payerAccountId: id, grantId: row.id };
  }

  it("publishes immutable, sequential price versions with replay and conflict", async () => {
    const v1 = await price(1, 100);
    v1Id = v1.priceVersion.id;
    expect(v1).toMatchObject({ replayed: false, priceVersion: { version: 1, rounding: "half_up", unitPriceFenNumerator: fen(100) } });
    expect((await price(1, 100)).priceVersion.id).toBe(v1Id);
    await expect(price(1, 101)).rejects.toThrow("price_version_conflict");
    await expect(price(3, 150)).rejects.toThrow("price_version_sequence_invalid");
    await expect(price(2, 150, { productCode: `synthetic.new${run}` })).rejects.toThrow("price_version_sequence_invalid");
    expect((await price(2, 150)).priceVersion.version).toBe(2);
    await expect(a.$executeRaw`UPDATE BillingPriceVersion SET unitPriceFenNumerator = 1 WHERE id = ${v1Id}`).rejects.toThrow(/billing_price_version_immutable/);
    await expect(a.$executeRaw`UPDATE BillingProduct SET code = 'x' WHERE id = ${v1.priceVersion.productId}`).rejects.toThrow(/billing_product_immutable/);
  });
  it("creates grants disabled with zero limits; replays the same key and refuses other content", async () => {
    const id = await payer();
    const first = await grant(id, "grant:default");
    expect(first.grant).toMatchObject({ state: "disabled", version: 1, perChargeLimitFen: fen(0), monthlyLimitFen: fen(0) });
    await expect(use(id, first.grant.id, 1)).rejects.toThrow("grant_not_active");
    await expect(change(first.grant.id, 1, "activate")).rejects.toThrow("grant_limits_zero");
    expect((await grant(id, "grant:default")).replayed).toBe(true);
    await expect(grant(id, "grant:default", owner, { limits: limits(1, 1, 1) })).rejects.toThrow("grant_operation_conflict");
    await expect(grant(id, "grant:x", member)).rejects.toThrow("grant_forbidden");
    await expect(grant(id, "grant:admin", admin)).resolves.toMatchObject({ replayed: false });
    expect(await a.auditLog.count({ where: { relatedObjectId: id, actionType: "BILLING_SPEND_GRANT_CREATED" } })).toBe(2);
  });
  it("enforces per-charge, daily and monthly limits on an active grant", async () => {
    const { payerAccountId, grantId } = await activeGrant("grant:limits");
    await expect(use(payerAccountId, grantId, 500)).resolves.toMatchObject({ grantId, grantVersion: 2, periodKeys: { day: "2026-11-10", month: "2026-11" } });
    await expect(use(payerAccountId, grantId, 501)).rejects.toThrow("grant_per_charge_exceeded");
    await expect(use(payerAccountId, grantId, 400, { usedFen: { day: fen(601), month: fen(601) } })).rejects.toThrow("grant_daily_limit_exceeded");
    await expect(use(payerAccountId, grantId, 400, { usedFen: { day: fen(0), month: fen(2601) } })).rejects.toThrow("grant_monthly_limit_exceeded");
    await change(grantId, 2, "set_limits", { limits: limits(100, 100, 100) }); // tightening applies to the next use
    await expect(use(payerAccountId, grantId, 101)).rejects.toThrow("grant_per_charge_exceeded");
  });
  it("never widens a grant to a newer price version", async () => {
    const { payerAccountId, grantId } = await activeGrant("grant:price");
    const v2 = await a.billingPriceVersion.findFirstOrThrow({ where: { version: 2, productId: (await a.billingPriceVersion.findUniqueOrThrow({ where: { id: v1Id } })).productId } });
    await expect(use(payerAccountId, grantId, 150, { priceVersionId: v2.id })).rejects.toThrow("grant_price_version_mismatch");
    await expect(a.$executeRaw`UPDATE SpendGrant SET priceVersionId = ${v2.id}, version = version + 1 WHERE id = ${grantId}`).rejects.toThrow(/spend_grant_binding_immutable/);
    await expect(a.$executeRaw`UPDATE SpendGrant SET dailyLimitFen = 999 WHERE id = ${grantId}`).rejects.toThrow(/spend_grant_binding_immutable/); // no version bump
    await expect(a.$executeRaw`DELETE FROM SpendGrant WHERE id = ${grantId}`).rejects.toThrow(/spend_grant_retained/);
  });
  it("serializes revocation behind an in-flight use and refuses every later use", async () => {
    const { payerAccountId, grantId } = await activeGrant("grant:race");
    let release!: () => void, locked!: () => void, revoked = false;
    const held = new Promise<void>(resolve => { release = resolve; }), isLocked = new Promise<void>(resolve => { locked = resolve; });
    const inFlight = a.$transaction(async tx => {
      const snapshot = await lockSpendGrantForUseInTransaction(tx, { payerAccountId, grantId, priceVersionId: v1Id, chargeFen: fen(10), at,
        usedFen: { day: fen(0), month: fen(0) } });
      locked(); await held; return snapshot;
    }, { timeout: 15000 });
    await isLocked;
    const revoke = change(grantId, 2, "revoke", {}, b).then(row => { revoked = true; return row; });
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(revoked).toBe(false); // waits on the PayerAccount lock held by the use
    release();
    await expect(inFlight).resolves.toMatchObject({ grantVersion: 2 });
    await expect(revoke).resolves.toMatchObject({ state: "revoked", version: 3, revokedByUserId: owner });
    await expect(use(payerAccountId, grantId, 10, {}, b)).rejects.toThrow("grant_not_active");
    await expect(change(grantId, 3, "resume")).rejects.toThrow("grant_transition_invalid");
    await expect(a.$executeRaw`UPDATE SpendGrant SET state = 'active', revokedAt = NULL, revokedByUserId = NULL, version = version + 1 WHERE id = ${grantId}`).rejects.toThrow(/spend_grant_binding_immutable/);
  });
  it("lets exactly one of two concurrent changes on the same version win", async () => {
    const { grantId } = await activeGrant("grant:cas");
    const pair = await Promise.allSettled([change(grantId, 2, "pause", {}, a), change(grantId, 2, "revoke", {}, b)]);
    expect(pair.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(String((pair.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/grant_version_conflict|grant_transition_invalid/);
    expect((await a.spendGrant.findUniqueOrThrow({ where: { id: grantId } })).version).toBe(3);
  });
  it("refuses use on an off or suspended payer; a suspended payer can still be paused or revoked, not activated", async () => {
    const off = await payer("off");
    const { grant: row } = await grant(off, "grant:off", owner, { limits: limits(10, 10, 10) });
    await change(row.id, 1, "activate");
    await expect(use(off, row.id, 1)).rejects.toThrow("payer_billing_off");
    const { payerAccountId, grantId } = await activeGrant("grant:suspend");
    await change(grantId, 2, "pause");
    await a.$executeRaw`UPDATE PayerAccount SET status = 'suspended' WHERE id = ${payerAccountId}`;
    await expect(change(grantId, 3, "resume")).rejects.toThrow("payer_account_unavailable");
    await expect(change(grantId, 3, "revoke")).resolves.toMatchObject({ state: "revoked" });
    await expect(use(payerAccountId, grantId, 1)).rejects.toThrow("payer_account_unavailable");
    expect(await a.auditLog.count({ where: { targetId: grantId, actionType: { startsWith: "BILLING_SPEND_GRANT_" } } })).toBe(4);
  });
});
