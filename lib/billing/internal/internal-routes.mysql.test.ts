import { generateKeyPairSync, type KeyObject, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { changeSpendGrant, createSpendGrant, publishPriceVersion } from "../grants/price-grants";
import { bindScope, createPayerAccount } from "../payer/payer-accounts";
import { markUnknown, release, resolveUnknown, settle } from "../reservations/reservations";
import { billingServiceGrantHash, billingServiceKeyFingerprint, signBillingInternalRequest } from "./service-auth";
import { POST as markUnknownRoute } from "@/app/api/internal/billing/v1/mark-unknown/route";
import { POST as quoteRoute } from "@/app/api/internal/billing/v1/quote/route";
import { POST as releaseRoute } from "@/app/api/internal/billing/v1/release/route";
import { POST as reserveRoute } from "@/app/api/internal/billing/v1/reserve/route";
import { POST as resolveUnknownRoute } from "@/app/api/internal/billing/v1/resolve-unknown/route";
import { POST as settleRoute } from "@/app/api/internal/billing/v1/settle/route";

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
  const ws = `bir-ws-${run}`, qws = `bir-qws-${run}`, owner = `bir-owner-${run}`;
  const event = "service-billing-event-v1:synthetic";
  let a: PrismaClient, priceId = "";
  // Ephemeral Ed25519 pairs per grant (no private key is ever written down); Core sees only the public half.
  const pins: Record<string, string> = {};
  const keys = new Map<string, KeyObject>();
  const otherKey = generateKeyPairSync("ed25519").privateKey;

  type GrantOptions = { pin?: boolean; validFrom?: Date; validUntil?: Date; foreignFingerprint?: boolean; scopesJson?: string;
    staleHash?: boolean; privatePem?: boolean; issuerRef?: string };
  async function grant(name: string, scopes: string[], options: GrantOptions = {}) {
    const row = { id: `${name}-${run}`, issuerRef: options.issuerRef ?? "synthetic-consumer", scopesJson: options.scopesJson ?? JSON.stringify([...scopes].sort()),
      publicKeyPem: "", keyFingerprint: "", approvalRef: "approval:synthetic", createdBy: "SYSTEM:synthetic-provisioning",
      validFrom: options.validFrom ?? new Date(Date.now() - 3_600_000), validUntil: options.validUntil ?? new Date(Date.now() + 86_400_000) };
    const pair = generateKeyPairSync("ed25519");
    row.publicKeyPem = (options.privatePem ? pair.privateKey.export({ type: "pkcs8", format: "pem" })
      : pair.publicKey.export({ type: "spki", format: "pem" })).toString();
    row.keyFingerprint = billingServiceKeyFingerprint(options.foreignFingerprint ? generateKeyPairSync("ed25519").publicKey : pair.publicKey);
    // staleHash: stored and pinned, but not the hash of this row's content
    const contentHash = billingServiceGrantHash(options.staleHash ? { ...row, approvalRef: "approval:other" } : row);
    await a.$executeRaw`INSERT INTO BillingServiceGrant (id, issuerRef, scopesJson, publicKeyPem, keyFingerprint, approvalRef,
      createdBy, contentHash, validFrom, validUntil) VALUES (${row.id}, ${row.issuerRef}, ${row.scopesJson}, ${row.publicKeyPem},
      ${row.keyFingerprint}, ${row.approvalRef}, ${row.createdBy}, ${contentHash}, ${row.validFrom}, ${row.validUntil})`;
    keys.set(row.id, pair.privateKey);
    if (options.pin !== false) pins[row.id] = contentHash;
    process.env.HELM_BILLING_SERVICE_GRANT_PINS = JSON.stringify(pins);
    return row.id;
  }
  type Call = { grantId: string; key?: KeyObject; timestamp?: number; nonce?: string; signedBody?: string; path?: string;
    stream?: boolean; contentLength?: string; signature?: (value: string) => string };
  const routes = { quote: quoteRoute, reserve: reserveRoute, settle: settleRoute, release: releaseRoute,
    "mark-unknown": markUnknownRoute, "resolve-unknown": resolveUnknownRoute };
  async function call(operation: keyof typeof routes, payload: unknown, auth: Call) {
    const POST = routes[operation];
    const body = payload instanceof Uint8Array ? payload : Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload));
    const path = `/api/internal/billing/v1/${operation}`, timestamp = String(auth.timestamp ?? Date.now());
    const nonce = auth.nonce ?? randomBytes(16).toString("base64url");
    const signature = signBillingInternalRequest(auth.key ?? keys.get(auth.grantId)!, { method: "POST",
      path: auth.path ?? path, grantId: auth.grantId, timestamp, nonce, body: auth.signedBody ?? body });
    // stream: a chunked body with no Content-Length, as a client may send it
    const sent = auth.stream ? { body: new ReadableStream<Uint8Array>({ start(controller) {
      for (let at = 0; at < body.length; at += 4096) controller.enqueue(body.subarray(at, at + 4096));
      controller.close(); } }), duplex: "half" as const } : { body };
    const response: Response = await POST(new Request(`http://core.invalid${path}`, { method: "POST", ...sent, headers: {
      "content-type": "application/json", "x-helm-billing-grant": auth.grantId, "x-helm-billing-timestamp": timestamp,
      "x-helm-billing-nonce": nonce, "x-helm-billing-signature": auth.signature ? auth.signature(signature) : signature,
      ...(auth.contentLength ? { "content-length": auth.contentLength } : {}) } }));
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
    await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${qws},'Synthetic quote',${qws},NOW(3))`;
    await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`mq-${owner}`},${qws},${owner},'OWNER','ACTIVE',NOW(3))`;
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
      .toMatchObject({ createdBy: `SYSTEM:billing-service:synthetic-consumer/${service}` });
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

  it("runs every operation through its own route with exact protocol shapes; resolve-unknown is a separate grant", async () => {
    const business = await grant("biz", ["quote", "reserve", "settle", "release", "mark-unknown"]);
    const recon = await grant("recon", ["resolve-unknown"]);
    const ids = await payer("enforce", 1000);
    await bindScope(a, { actorUserId: owner, payerAccountId: ids.payerRef, expectedPayerVersion: 1, scopeKind: "workspace",
      scopeRef: qws, evidenceRef: "consent:bind" });
    const quoteBody = { subjectScope: { kind: "workspace", workspaceId: qws }, billingEventRef: event, meterUnit: "document", quantity: "2" };
    expect(await call("quote", quoteBody, { grantId: business })).toEqual({ status: 200, body: { ok: true, payerRef: ids.payerRef,
      grantId: ids.grantId, priceVersionId: priceId, mode: "enforce" } });
    expect(await call("quote", { ...quoteBody, subjectScope: { kind: "vault", vaultId: "v-1" } }, { grantId: business })).toEqual(refused(400, "request_invalid"));
    const held = async (key: string) => (await call("reserve", reserveBody(ids, key), { grantId: business })).body.reservationId as string;
    const step = (reservationId: string, key: string, extra: object = {}) => ({ idempotencyKey: `idem:${key}:${run}`, reservationId,
      operationRef: `op:${key}:${run}`, evidenceRef: `evidence:${key}`, ...extra });

    const r1 = await held("e1");
    // v3.9: another issuer sees r1 as absent
    const other = await grant("biz2", ["settle", "release", "mark-unknown"], { issuerRef: "other-issuer" });
    for (const [op, extra] of [["settle", { quantityUsed: "1" }], ["release", { reasonCode: "failed" }], ["mark-unknown", {}]] as const) {
      expect(await call(op, step(r1, `x-${op}`, { operationRef: `op:e1:${run}`, ...extra }), { grantId: other }))
        .toEqual(refused(409, "reservation_state_conflict"));
    }
    const settled = await call("settle", step(r1, "e1", { quantityUsed: "1" }), { grantId: business });
    expect(settled).toMatchObject({ status: 200, body: { ok: true, state: "settled", chargeFen: "100" } });
    expect(Object.keys(settled.body).sort()).toEqual(["chargeFen", "chargeId", "ok", "state"]);
    expect(await call("settle", step(r1, "e1", { quantityUsed: "1" }), { grantId: business })).toEqual(settled);
    expect(await call("release", step(r1, "e1b", { operationRef: `op:e1:${run}`, reasonCode: "failed" }), { grantId: business }))
      .toEqual(refused(409, "reservation_state_conflict"));
    const r2 = await held("e2");
    expect(await call("settle", step(r2, "e2", { quantityUsed: "3" }), { grantId: business })).toEqual(refused(422, "quantity_exceeds_reservation"));
    expect(await call("settle", step(r2, "e2", { operationRef: "op:other", quantityUsed: "1" }), { grantId: business })).toEqual(refused(409, "idempotency_conflict"));
    expect(await call("release", step(r2, "e2", { reasonCode: "lost" }), { grantId: business })).toEqual(refused(400, "request_invalid"));
    expect(await call("release", step(r2, "e2", { reasonCode: "not_executed" }), { grantId: business })).toEqual({ status: 200, body: { ok: true, state: "released" } });
    expect(await call("settle", step(`missing-${run}`, "e9", { quantityUsed: "1" }), { grantId: business })).toEqual(refused(409, "reservation_state_conflict"));

    const r3 = await held("e3"), r4 = await held("e4"), r5 = await held("e5");
    for (const [id, key] of [[r3, "e3"], [r4, "e4"]]) {
      expect(await call("mark-unknown", step(id, key), { grantId: business })).toEqual({ status: 200, body: { ok: true, state: "unknown" } });
    }
    expect(await call("settle", step(r3, "e3s", { operationRef: `op:e3:${run}`, quantityUsed: "1" }), { grantId: business }))
      .toEqual(refused(409, "reservation_state_conflict")); // v3.5: only resolveUnknown leaves unknown
    const resolve = (id: string, key: string, extra: object) => call("resolve-unknown", step(id, key, extra), { grantId: recon });
    expect(await call("resolve-unknown", step(r3, "e3", { outcome: "released" }), { grantId: business })).toEqual(refused(403, "service_unauthorized"));
    expect(await call("reserve", reserveBody(ids, "e6"), { grantId: recon })).toEqual(refused(403, "service_unauthorized"));
    expect(await resolve(r3, "e3", { outcome: "settled", quantityUsed: "2" })).toMatchObject({ status: 200, body: { ok: true, state: "settled", chargeFen: "200" } });
    expect(await resolve(r4, "e4", { outcome: "released", quantityUsed: "1" })).toEqual(refused(400, "request_invalid"));
    expect(await resolve(r4, "e4", { outcome: "released" })).toEqual({ status: 200, body: { ok: true, state: "released" } });
    expect(await resolve(r5, "e5", { outcome: "released" })).toEqual(refused(409, "unknown_resolution_conflict"));
    expect(await a.billingCharge.count({ where: { payerAccountId: ids.payerRef } })).toBe(2);
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: r3 } })).toMatchObject({ resolvedBy: `SYSTEM:billing-service:synthetic-consumer/${recon}` });

    // A counter that disagrees with its holds is an invariant breach: 500 internal_error, PII-free alert, nothing committed.
    await a.$executeRaw`UPDATE BudgetBucket SET reservedFen = 0, version = version + 1 WHERE grantId = ${ids.grantId} AND billingMode = 'enforce'`;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await call("release", step(r5, "e5", { reasonCode: "failed" }), { grantId: business })).toEqual(refused(500, "internal_error"));
    expect(logged.mock.calls.map(args => args.join(" "))).toEqual(['[billing-internal] {"event":"billing_internal_invariant_breach","operation":"release","reason":"reservation_invariant_breach"}']);
    logged.mockRestore();
    expect(await a.billingReservation.findUniqueOrThrow({ where: { id: r5 } })).toMatchObject({ state: "held" });
  });

  it("bounds the raw body while streaming (413 before authentication) and hashes and parses exactly the signed bytes", async () => {
    const service = await grant("body", ["reserve"]);
    const ids = await payer("enforce", 1000);
    const big = Buffer.from(JSON.stringify({ ...reserveBody(ids, "big"), pad: "x".repeat(17_000) }));
    const tooLarge = refused(413, "request_invalid");
    expect(await call("reserve", big, { grantId: service, contentLength: String(big.length) })).toEqual(tooLarge);
    expect(await call("reserve", big, { grantId: service, stream: true })).toEqual(tooLarge); // no Content-Length
    expect(await a.billingServiceNonce.count({ where: { grantId: service } })).toBe(0);
    const json = Buffer.from(JSON.stringify(reserveBody(ids, "bytes")));
    expect((await call("reserve", json, { grantId: service, stream: true })).status).toBe(200); // a small chunked body is fine
    const invalid = refused(400, "request_invalid"); // signed over these exact bytes, so authentication passes
    expect(await call("reserve", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), json]), { grantId: service })).toEqual(invalid);
    expect(await call("reserve", Buffer.concat([json.subarray(0, 20), Buffer.from([0xff]), json.subarray(20)]), { grantId: service })).toEqual(invalid);
    expect(await reservations(ids.payerRef)).toBe(1);
  });

  it("trusts a grant only inside its validity, with its own content hash, canonical scopes and a public key", async () => {
    const ids = await payer("enforce", 1000);
    const unauthorized = refused(401, "service_unauthorized"), denied = refused(403, "service_unauthorized");
    const hour = 3_600_000, body = (key: string) => reserveBody(ids, key);
    const future = await grant("future", ["reserve"], { validFrom: new Date(Date.now() + hour), validUntil: new Date(Date.now() + 2 * hour) });
    const expired = await grant("expired", ["reserve"], { validFrom: new Date(Date.now() - 2 * hour), validUntil: new Date(Date.now() - hour) });
    const stale = await grant("stale", ["reserve"], { staleHash: true });
    expect(await call("reserve", body("v1"), { grantId: future })).toEqual(unauthorized);
    expect(await call("reserve", body("v2"), { grantId: expired })).toEqual(unauthorized);
    expect(await call("reserve", body("v3"), { grantId: stale })).toEqual(unauthorized);
    for (const [name, scopesJson] of [["unsorted", '["reserve","quote"]'], ["dup", '["reserve","reserve"]'], ["unknown", '["admin","reserve"]']]) {
      expect(await call("reserve", body(`s-${name}`), { grantId: await grant(name, [], { scopesJson }) })).toEqual(denied);
    }
    const ok = await grant("canon", ["reserve"]);
    // same signature bytes, non-canonical base64 (unused low bits set): refused before verification
    const loose = (value: string) => { const at = value.length - 3, alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      return value.slice(0, at) + alphabet[alphabet.indexOf(value[at]) | 1] + value.slice(at + 1); };
    expect(await call("reserve", body("v4"), { grantId: ok, signature: loose })).toEqual(unauthorized);
    expect(await reservations(ids.payerRef)).toBe(0);
    await expect(grant("private", ["reserve"], { privatePem: true })).rejects.toThrow(/BillingServiceGrant_public_key/);
  });

  it("binds a reservation to its issuer (v3.9): a rotated grant keeps working, another issuer sees it as absent", async () => {
    const old = await grant("rot1", ["reserve"], { issuerRef: "issuer-a" }), next = await grant("rot2", ["reserve"], { issuerRef: "issuer-a" });
    const foreign = await grant("rot3", ["reserve"], { issuerRef: "issuer-b" });
    const ids = await payer("enforce", 1000);
    const made = await call("reserve", reserveBody(ids, "rot"), { grantId: old });
    expect(made.status).toBe(200);
    expect(await call("reserve", reserveBody(ids, "rot"), { grantId: next })).toEqual(made); // same issuer replays
    expect(await call("reserve", reserveBody(ids, "rot"), { grantId: foreign })).toEqual(refused(409, "idempotency_conflict"));
    await a.$executeRaw`UPDATE BillingServiceGrant SET revokedAt = UTC_TIMESTAMP(3), revokedBy = 'SYSTEM:synthetic' WHERE id = ${old}`;
    const as = (issuer: string, grantId: string) => ({ type: "SYSTEM" as const, ref: `billing-service:${issuer}/${grantId}` });
    const step = (key: string, reservationId: string) => ({ idempotencyKey: `idem:${key}:${run}`, reservationId,
      operationRef: `op:${key}:${run}`, evidenceRef: `evidence:${key}` });
    const absent = { ok: false, code: "reservation_state_conflict" };
    const id = made.body.reservationId as string;
    expect(await settle(a, as("issuer-b", foreign), { ...step("rot", id), quantityUsed: "1" })).toEqual(absent);
    expect(await release(a, as("issuer-b", foreign), { ...step("rot", id), reasonCode: "failed" })).toEqual(absent);
    expect(await markUnknown(a, as("issuer-b", foreign), { ...step("rot", id), operationRef: "op:wrong" })).toEqual(absent); // no leak
    expect(await settle(a, as("issuer-a", next), { ...step("rot", id), quantityUsed: "1" }))
      .toMatchObject({ ok: true, state: "settled", chargeFen: "100" }); // the old grant is revoked; its issuer finishes the work
    const second = (await call("reserve", reserveBody(ids, "rot2"), { grantId: next })).body.reservationId as string;
    expect(await markUnknown(a, as("issuer-a", next), step("rot2", second))).toEqual({ ok: true, state: "unknown" });
    expect(await resolveUnknown(a, as("recon", `recon-${run}`), { ...step("rot2", second), outcome: "released" }))
      .toEqual({ ok: true, state: "released" }); // reconciliation resolves across issuers
    await expect(grant("badissuer", ["reserve"], { issuerRef: "Issuer/A" })).rejects.toThrow(/BillingServiceGrant_issuer/);
  });

  it("answers a lost connection or transaction timeout with core_unavailable and other driver failures with internal_error", async () => {
    const service = await grant("conn", ["reserve"]);
    const ids = await payer("enforce", 1000);
    const failing = (code: string) => new Proxy(a, { get(target, key) {
      if (key === "$transaction") return () => Promise.reject(new Prisma.PrismaClientKnownRequestError("synthetic", { code, clientVersion: "test" }));
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value; } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const [code, expected] of [["P2024", refused(503, "core_unavailable")], ["P2028", refused(503, "core_unavailable")],
        ["P2010", refused(500, "internal_error")]] as const) {
        holder.client = failing(code);
        expect(await call("reserve", reserveBody(ids, `c-${code}`), { grantId: service })).toEqual(expected);
      }
    } finally { holder.client = a; logged.mockRestore(); }
    expect(await reservations(ids.payerRef)).toBe(0);
  });

  it("refuses an issuerRef with a trailing line terminator (ICU `$` matches before it) and orders the rollbacks", async () => {
    for (const [name, terminator] of [["nl", "\n"], ["cr", "\r"], ["crlf", "\r\n"], ["ls", "\u2028"], ["nel", "\u0085"]]) {
      await expect(grant(`term-${name}`, ["reserve"], { issuerRef: `issuer-t${terminator}` })).rejects.toThrow(/BillingServiceGrant_issuer/);
    }
    expect(await a.billingServiceGrant.count({ where: { id: { startsWith: "term-", endsWith: `-${run}` } } })).toBe(0);
    await grant("term-ok", ["reserve"], { issuerRef: "issuer-t.1_x-y" }); // the allowed set is unchanged
    // CREATE PROCEDURE cannot run over the prepared-statement protocol: evaluate the grant-table rollback's first guard as written.
    const sql = readFileSync(join(process.cwd(), "prisma/rollback/20261110_rollback_billing_service_grants.sql"), "utf8");
    const body = sql.slice(sql.indexOf("BEGIN")), condition = body.slice(body.indexOf("IF ") + 3, body.indexOf(" THEN"));
    expect(body.slice(body.indexOf(" THEN"), body.indexOf("END IF"))).toContain("later billing migration is applied");
    const [row] = await a.$queryRawUnsafe<Array<{ refused: bigint }>>(`SELECT (${condition}) AS refused`);
    expect(Number(row.refused)).toBe(1); // 20261111100000_billing_service_grant_issuer_check is applied
  });
});
