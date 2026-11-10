import { generateKeyPairSync, type KeyObject, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { createPayerAccount } from "../payer/payer-accounts";
import { billingServiceGrantHash, billingServiceKeyFingerprint, signBillingInternalRequest } from "./service-auth";
import { POST as reserveRoute } from "@/app/api/internal/billing/v1/reserve/route";

// The real routes run against the isolated database: only the app's client handle is swapped for it (never DATABASE_URL).
const holder = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/db", () => ({ get db() { return holder.client; } }));
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

describe.skipIf(!url)("internal billing routes with service grants against MySQL", () => {
  if (!url) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "").slice(0, 12);
  const ws = `bir-ws-${run}`, owner = `bir-owner-${run}`;
  const event = "service-billing-event-v1:synthetic";
  let a: PrismaClient, priceId = "";
  // Ephemeral Ed25519 pairs per grant (no private key is ever written down); Core sees only the public half.
  const pins: Record<string, string> = {};
  const keys = new Map<string, KeyObject>();
  const otherKey = generateKeyPairSync("ed25519").privateKey;

  async function grant(name: string, scopes: string[], options: { pin?: boolean; validUntil?: Date; foreignFingerprint?: boolean } = {}) {
    const row = { id: `${name}-${run}`, issuerRef: "synthetic-consumer", scopesJson: JSON.stringify([...scopes].sort()),
      publicKeyPem: "", keyFingerprint: "", approvalRef: "approval:synthetic", createdBy: "SYSTEM:synthetic-provisioning",
      validFrom: new Date(Date.now() - 3_600_000), validUntil: options.validUntil ?? new Date(Date.now() + 86_400_000) };
    const pair = generateKeyPairSync("ed25519");
    row.publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    row.keyFingerprint = billingServiceKeyFingerprint(options.foreignFingerprint ? generateKeyPairSync("ed25519").publicKey : pair.publicKey);
    const contentHash = billingServiceGrantHash(row);
    await a.$executeRaw`INSERT INTO BillingServiceGrant (id, issuerRef, scopesJson, publicKeyPem, keyFingerprint, approvalRef,
      createdBy, contentHash, validFrom, validUntil) VALUES (${row.id}, ${row.issuerRef}, ${row.scopesJson}, ${row.publicKeyPem},
      ${row.keyFingerprint}, ${row.approvalRef}, ${row.createdBy}, ${contentHash}, ${row.validFrom}, ${row.validUntil})`;
    keys.set(row.id, pair.privateKey);
    if (options.pin !== false) pins[row.id] = contentHash;
    process.env.HELM_BILLING_SERVICE_GRANT_PINS = JSON.stringify(pins);
    return row.id;
  }
  type Call = { grantId: string; key?: KeyObject; timestamp?: number; nonce?: string; signedBody?: string; path?: string };
  async function call(operation: "reserve", payload: unknown, auth: Call) {
    const POST = { reserve: reserveRoute }[operation];
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    const path = `/api/internal/billing/v1/${operation}`, timestamp = String(auth.timestamp ?? Date.now());
    const nonce = auth.nonce ?? randomBytes(16).toString("base64url");
    const signature = signBillingInternalRequest(auth.key ?? keys.get(auth.grantId)!, { method: "POST",
      path: auth.path ?? path, grantId: auth.grantId, timestamp, nonce, body: auth.signedBody ?? body });
    const response: Response = await POST(new Request(`http://core.invalid${path}`, { method: "POST", body, headers: {
      "content-type": "application/json", "x-helm-billing-grant": auth.grantId, "x-helm-billing-timestamp": timestamp,
      "x-helm-billing-nonce": nonce, "x-helm-billing-signature": signature } }));
    return { status: response.status, body: await response.json() };
  }
  async function payer(mode: "shadow" | "enforce", walletFen: number) {
    const account = await createPayerAccount(a, { actorUserId: owner, workspaceId: ws, kind: "enterprise_contract", contractSubjectRef: "subject-bir" });
    await a.$executeRaw`UPDATE PayerAccount SET billingMode = ${mode} WHERE id = ${account.id}`; // no mode API yet
    if (walletFen > 0) await a.$transaction(tx => postFundsTransactionInTransaction(tx, { payerAccountId: account.id, kind: "topup",
      operationKey: `topup:${account.id}`, actor: { type: "SYSTEM", ref: "synthetic" }, evidenceRef: "verified-payment:synthetic",
      entries: [{ account: "topup_clearing", direction: "debit", amountFen: BigInt(walletFen) },
        { account: "customer_wallet_available", direction: "credit", amountFen: BigInt(walletFen) }] }));
    const { grant: spend } = await createSpendGrant(a, { actorUserId: owner, payerAccountId: account.id, priceVersionId: priceId,
      operationKey: "grant:bir", evidenceRef: "consent:synthetic", validFrom: new Date("2026-11-01T00:00:00Z"),
      validUntil: new Date("2027-02-01T00:00:00Z"), limits: { perChargeLimitFen: BigInt(500), dailyLimitFen: BigInt(1000), monthlyLimitFen: BigInt(3000) } });
    await changeSpendGrant(a, { actorUserId: owner, grantId: spend.id, expectedVersion: 1, action: "activate", evidenceRef: "consent:on" });
    return { payerRef: account.id, grantId: spend.id };
  }
  const reserveBody = (ids: { payerRef: string; grantId: string }, key: string, quantity = 2, extra: object = {}) => ({
    idempotencyKey: `idem:${key}:${run}`, operationRef: `op:${key}:${run}`, ...ids, priceVersionId: priceId, billingEventRef: event,
    meterUnit: "document", quantity: String(quantity), ...extra });
  const refused = (status: number, code: string) => ({ status, body: { ok: false, code } });
  const reservations = (payerAccountId: string) => a.billingReservation.count({ where: { payerAccountId } });

  beforeAll(async () => {
    const datadir = assertIsolatedTarget(url);
    a = new PrismaClient({ datasources: { db: { url } } });
    holder.client = a;
    if (datadir) {
      const [server] = await a.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(datadir)) throw new Error("synthetic_server_identity_invalid");
    }
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${ws},'Synthetic internal routes',${ws},NOW(3))`;
    await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${owner},'Synthetic',${`${owner}@example.invalid`},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`m-${owner}`},${ws},${owner},'OWNER','ACTIVE',NOW(3))`;
    priceId = (await publishPriceVersion(a, { actor: { type: "SYSTEM", ref: "synthetic-catalog" }, productCode: `synthetic.bir${run}`,
      version: 1, meterUnit: "document", billingEventRef: event, acceptanceRef: "acceptance:synthetic", scopeKind: "workspace",
      unitPriceFenNumerator: BigInt(100), unitPriceDenominator: BigInt(1), effectiveFrom: new Date("2026-11-01T00:00:00Z"),
      effectiveUntil: null, approvalRef: "approval:synthetic" })).priceVersion.id;
    process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED = "true";
  });
  afterAll(async () => {
    delete process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED; delete process.env.HELM_BILLING_SERVICE_GRANT_PINS;
    await a?.$disconnect();
  });

  it("is a plain 404 while the deployment gate is off, before any grant or nonce is read", async () => {
    const service = await grant("gate", ["reserve"]);
    const ids = await payer("enforce", 1000);
    for (const value of [undefined, "false", "yes"]) {
      if (value === undefined) delete process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED;
      else process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED = value;
      expect(await call("reserve", reserveBody(ids, "gate"), { grantId: service })).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    }
    process.env.HELM_BILLING_INTERNAL_ROUTES_ENABLED = "true";
    expect(await a.billingServiceNonce.count({ where: { grantId: service } })).toBe(0);
    expect(await reservations(ids.payerRef)).toBe(0);
  });

  it("reserves for a signed, scoped grant as that service identity and replays by idempotencyKey with a fresh nonce", async () => {
    const service = await grant("ok", ["quote", "reserve"]);
    const ids = await payer("enforce", 300);
    const first = await call("reserve", reserveBody(ids, "ok"), { grantId: service });
    expect(first.status).toBe(200);
    expect(Object.keys(first.body).sort()).toEqual(["capFen", "mode", "ok", "periodKeys", "priceContentHash", "reservationId", "state"]);
    expect(first.body).toMatchObject({ ok: true, mode: "enforce", state: "held", capFen: "200" });
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: first.body.reservationId } }))
      .toMatchObject({ createdBy: `SYSTEM:billing-service-grant:${service}` });
    expect(await call("reserve", reserveBody(ids, "ok"), { grantId: service })).toEqual(first);
    expect(await call("reserve", reserveBody(ids, "ok", 3), { grantId: service })).toEqual(refused(409, "idempotency_conflict"));
    expect(await call("reserve", reserveBody(ids, "big", 2), { grantId: service })).toEqual(refused(422, "insufficient_funds"));
    expect(await reservations(ids.payerRef)).toBe(1);
  });

  it("refuses bad, expired, replayed, unpinned, wrong-scope and revoked signatures with service_unauthorized, writing nothing", async () => {
    const service = await grant("auth", ["reserve"]);
    const ids = await payer("enforce", 1000);
    const body = reserveBody(ids, "auth");
    const unauthorized = refused(401, "service_unauthorized");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await call("reserve", body, { grantId: service, key: otherKey })).toEqual(unauthorized);
    expect(await call("reserve", body, { grantId: service, signedBody: JSON.stringify({ ...body, quantity: "1" }) })).toEqual(unauthorized);
    expect(await call("reserve", body, { grantId: service, path: "/api/internal/billing/v1/release" })).toEqual(unauthorized);
    expect(await call("reserve", body, { grantId: service, timestamp: Date.now() - 301_000 })).toEqual(unauthorized);
    expect(await call("reserve", body, { grantId: service, timestamp: Date.now() + 301_000 })).toEqual(unauthorized);
    expect(await call("reserve", body, { grantId: `missing-${run}`, key: keys.get(service) })).toEqual(unauthorized);
    const unpinned = await grant("unpinned", ["reserve"], { pin: false });
    expect(await call("reserve", body, { grantId: unpinned })).toEqual(unauthorized);
    const foreign = await grant("foreign", ["reserve"], { foreignFingerprint: true }); // pinned row, key/fingerprint disagree
    expect(await call("reserve", body, { grantId: foreign })).toEqual(unauthorized);
    const quoteOnly = await grant("scope", ["quote"]);
    expect(await call("reserve", body, { grantId: quoteOnly })).toEqual(refused(403, "service_unauthorized"));
    expect(await reservations(ids.payerRef)).toBe(0);

    const nonce = randomBytes(16).toString("base64url"), timestamp = Date.now();
    expect((await call("reserve", body, { grantId: service, nonce, timestamp })).status).toBe(200);
    expect(await call("reserve", body, { grantId: service, nonce, timestamp })).toEqual(unauthorized); // same signed request again
    const saved = process.env.HELM_BILLING_SERVICE_GRANT_PINS;
    process.env.HELM_BILLING_SERVICE_GRANT_PINS = "{not json";
    expect(await call("reserve", reserveBody(ids, "auth2"), { grantId: service })).toEqual(unauthorized);
    process.env.HELM_BILLING_SERVICE_GRANT_PINS = saved;
    const lines = logged.mock.calls.map(args => args.join(" "));
    logged.mockRestore();
    expect(lines.some(line => line.includes('"reason":"nonce_replayed"'))).toBe(true);
    for (const line of lines) {
      expect(line).toMatch(/^\[billing-internal\] \{"event":"billing_internal_auth_refused","operation":"reserve","reason":"[a-z_]+"\}$/);
    }

    await a.$executeRaw`UPDATE BillingServiceGrant SET revokedAt = UTC_TIMESTAMP(3), revokedBy = 'SYSTEM:synthetic' WHERE id = ${service}`;
    expect(await call("reserve", reserveBody(ids, "auth3"), { grantId: service })).toEqual(unauthorized);
    expect(await reservations(ids.payerRef)).toBe(1);
    await expect(a.$executeRaw`UPDATE BillingServiceGrant SET revokedAt = NULL, revokedBy = NULL WHERE id = ${service}`).rejects.toThrow(/billing_service_grant_immutable/);
    await expect(a.$executeRaw`UPDATE BillingServiceGrant SET scopesJson = '["quote","reserve"]' WHERE id = ${quoteOnly}`).rejects.toThrow(/billing_service_grant_immutable/);
    await expect(a.$executeRaw`DELETE FROM BillingServiceGrant WHERE id = ${quoteOnly}`).rejects.toThrow(/billing_service_grant_retained/);
    await expect(grant("mixed", ["resolve-unknown", "settle"])).rejects.toThrow(/BillingServiceGrant_scopes/);
  });

  it("validates the request shape at the boundary and maps library refusals", async () => {
    const service = await grant("shape", ["reserve"]);
    const ids = await payer("enforce", 1000);
    const invalid = refused(400, "request_invalid");
    expect(await call("reserve", { ...reserveBody(ids, "s1"), amountFen: "1" }, { grantId: service })).toEqual(invalid);
    expect(await call("reserve", { ...reserveBody(ids, "s2"), quantity: 2 }, { grantId: service })).toEqual(invalid);
    expect(await call("reserve", "{", { grantId: service })).toEqual(invalid);
    expect(await call("reserve", reserveBody(ids, "s3", 0), { grantId: service })).toEqual(invalid);
    expect(await call("reserve", { ...reserveBody(ids, "s4"), idempotencyKey: "short" }, { grantId: service })).toEqual(invalid);
    expect(await call("reserve", reserveBody(ids, "s5", 6), { grantId: service })).toEqual(refused(422, "limit_exceeded"));
    expect(await call("reserve", { ...reserveBody(ids, "s6"), grantId: `nope-${run}` }, { grantId: service })).toEqual(refused(422, "grant_not_active"));
    expect(await reservations(ids.payerRef)).toBe(0);
  });

  it("refuses an expectedMode that differs from the payer's mode with mode_mismatch and holds nothing (v3.4)", async () => {
    const service = await grant("mode", ["reserve"]);
    const enforce = await payer("enforce", 1000), shadow = await payer("shadow", 0);
    expect(await call("reserve", reserveBody(enforce, "m1", 2, { expectedMode: "shadow" }), { grantId: service }))
      .toEqual(refused(409, "mode_mismatch"));
    expect(await call("reserve", reserveBody(shadow, "m2", 2, { expectedMode: "enforce" }), { grantId: service }))
      .toEqual(refused(409, "mode_mismatch"));
    expect(await reservations(enforce.payerRef) + await reservations(shadow.payerRef)).toBe(0);
    expect(await a.budgetBucket.count({ where: { grantId: { in: [enforce.grantId, shadow.grantId] } } })).toBe(0);
    expect(await call("reserve", reserveBody(shadow, "m3", 2, { expectedMode: "invalid" }), { grantId: service })).toEqual(refused(400, "request_invalid"));
    const observed = await call("reserve", reserveBody(shadow, "m4", 2, { expectedMode: "shadow" }), { grantId: service });
    expect(observed).toMatchObject({ status: 200, body: { ok: true, mode: "shadow", state: "held", capFen: "200", wouldChargeFen: "200" } });
    // the key's replay also answers to expectedMode (it is not part of the content hash)
    expect(await call("reserve", reserveBody(shadow, "m4", 2, { expectedMode: "enforce" }), { grantId: service })).toEqual(refused(409, "mode_mismatch"));
    expect(await call("reserve", reserveBody(shadow, "m4", 2), { grantId: service })).toEqual(observed);
  });
});
