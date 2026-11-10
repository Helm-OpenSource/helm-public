import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { ServiceActor } from "../reservations/reservations";

/**
 * Billing V1 S3-b3 service identity for `/api/internal/billing/v1/*` (docs/operations/BILLING_INTERNAL_ROUTES.md), on the
 * LLMSpendIssuerGrant pattern: an immutable, one-way-revocable grant row with no key material, trusted only when the separately
 * provisioned keyring (`HELM_BILLING_SERVICE_KEYRING`) both holds its `keyRef` secret and pins its `contentHash`. Requests are
 * HMAC-SHA256 signed over method, path, grant, timestamp, nonce and body hash; database time bounds the window and a committed
 * nonce row refuses replays. Every refusal is the same `service_unauthorized` outside; secrets and signatures are never logged.
 */
export const BILLING_SERVICE_SCOPES = ["quote", "reserve", "settle", "release", "mark-unknown", "resolve-unknown"] as const;
export type BillingServiceScope = (typeof BILLING_SERVICE_SCOPES)[number];
export const BILLING_SIGNATURE_WINDOW_MS = 300_000;
const NONCE_PURGE_MARGIN_SECONDS = 60; // purge strictly after a nonce's timestamp can no longer pass the window
const HEADERS = { grant: "x-helm-billing-grant", timestamp: "x-helm-billing-timestamp", nonce: "x-helm-billing-nonce",
  signature: "x-helm-billing-signature" } as const;

export class ServiceAuthRefused extends Error {
  constructor(readonly reason: string) { super(`billing_service_${reason}`); this.name = "ServiceAuthRefused"; }
}
function refuse(reason: string): never { throw new ServiceAuthRefused(reason); }

export type BillingServiceGrantRow = { id: string; issuerRef: string; scopesJson: string; keyRef: string; approvalRef: string;
  createdBy: string; contentHash: string; validFrom: Date; validUntil: Date; revokedAt: Date | null };
export function billingServiceGrantHash(row: Omit<BillingServiceGrantRow, "contentHash" | "revokedAt">): string {
  const content = { schema: "helm.billing-service-grant/v1", id: row.id, issuerRef: row.issuerRef, scopesJson: row.scopesJson,
    keyRef: row.keyRef, approvalRef: row.approvalRef, createdBy: row.createdBy, validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil.toISOString() };
  return `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

const keyringSchema = z.record(z.string().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/), z.object({
  grantId: z.string(), grantHash: z.string().regex(/^sha256:[a-f0-9]{64}$/), secret: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
}).strict());
/** An absent keyring trusts nothing; a malformed one also trusts nothing (fail closed, never partially parsed). */
function readKeyring(raw: string | undefined) {
  if (!raw?.trim()) return refuse("keyring_empty");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return refuse("keyring_invalid"); }
  const result = keyringSchema.safeParse(parsed);
  return result.success ? result.data : refuse("keyring_invalid");
}

export type SignedRequestParts = { method: string; path: string; grantId: string; timestamp: string; nonce: string; body: string };
/** HMAC-SHA256 over the canonical request; the secret is the keyring entry's base64url-decoded bytes (>= 32). */
export function signBillingInternalRequest(secret: string, parts: SignedRequestParts): string {
  const canonical = ["helm-billing-internal/v1", parts.method.toUpperCase(), parts.path, parts.grantId, parts.timestamp,
    parts.nonce, createHash("sha256").update(parts.body).digest("hex")].join("\n");
  return `v1=${createHmac("sha256", Buffer.from(secret, "base64url")).update(canonical).digest("hex")}`;
}

/**
 * Authenticates one signed request for `scope` and records its nonce (committed on its own, before the operation runs, so a
 * replay is refused even when the operation later fails; a retry signs a fresh nonce and replays by idempotencyKey).
 */
export async function authenticateBillingService(client: PrismaClient, request: { method: string; path: string;
  headers: Headers; body: string }, scope: BillingServiceScope, env: Readonly<Record<string, string | undefined>> = process.env) {
  const grantId = request.headers.get(HEADERS.grant) ?? "", timestamp = request.headers.get(HEADERS.timestamp) ?? "";
  const nonce = request.headers.get(HEADERS.nonce) ?? "", signature = request.headers.get(HEADERS.signature) ?? "";
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(grantId) || !/^[1-9][0-9]{12}$/.test(timestamp) ||
      !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^v1=[a-f0-9]{64}$/.test(signature)) refuse("headers_invalid");
  const keyring = readKeyring(env.HELM_BILLING_SERVICE_KEYRING);
  const [grant] = await client.$queryRaw<Array<BillingServiceGrantRow & { now: Date }>>`SELECT id, issuerRef, scopesJson, keyRef,
    approvalRef, createdBy, contentHash, validFrom, validUntil, revokedAt, UTC_TIMESTAMP(3) AS now
    FROM BillingServiceGrant WHERE id = ${grantId}`;
  if (!grant || grant.id !== grantId) refuse("grant_unknown");
  const key = Object.hasOwn(keyring, grant.keyRef) ? keyring[grant.keyRef] : undefined;
  if (!key || key.grantId !== grant.id || key.grantHash !== grant.contentHash ||
      billingServiceGrantHash(grant) !== grant.contentHash) refuse("grant_untrusted");
  const expected = signBillingInternalRequest(key.secret, { method: request.method, path: request.path, grantId, timestamp,
    nonce, body: request.body });
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) refuse("signature_invalid"); // equal length by format
  if (grant.revokedAt !== null || grant.validFrom > grant.now || grant.validUntil <= grant.now) refuse("grant_inactive");
  if (!grantScopes(grant.scopesJson).includes(scope)) refuse("scope_denied");
  const signedAt = Number(timestamp);
  if (Math.abs(grant.now.getTime() - signedAt) > BILLING_SIGNATURE_WINDOW_MS) refuse("timestamp_outside_window");
  await client.$executeRaw`DELETE FROM BillingServiceNonce
    WHERE expiresAt < UTC_TIMESTAMP(3) - INTERVAL ${NONCE_PURGE_MARGIN_SECONDS} SECOND ORDER BY expiresAt LIMIT 100`;
  try {
    await client.$executeRaw`INSERT INTO BillingServiceNonce (grantId, nonce, expiresAt)
      VALUES (${grantId}, ${nonce}, ${new Date(signedAt + BILLING_SIGNATURE_WINDOW_MS)})`;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010" &&
        String((error.meta as { code?: unknown } | undefined)?.code) === "1062") refuse("nonce_replayed");
    throw error;
  }
  return { grantId, actor: { type: "SYSTEM", ref: `billing-service-grant:${grantId}` } satisfies ServiceActor };
}

/** Canonical (sorted, unique, known) scope list; anything else trusts no scope. */
function grantScopes(scopesJson: string): readonly string[] {
  let scopes: unknown;
  try { scopes = JSON.parse(scopesJson); } catch { return []; }
  if (!Array.isArray(scopes) || scopes.some(s => !BILLING_SERVICE_SCOPES.includes(s)) ||
      JSON.stringify([...new Set(scopes)].sort()) !== scopesJson) return [];
  return scopes;
}
