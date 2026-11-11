import "server-only";
import { createHash, createPublicKey, type KeyObject, sign, verify } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { ServiceActor } from "../reservations/reservations";

/**
 * Billing V1 S3-b3 service identity for `/api/internal/billing/v1/*` (docs/operations/BILLING_INTERNAL_ROUTES.md), on the
 * LLMSpendIssuerGrant pattern (protocol v3.7): an immutable, one-way-revocable grant row holding only the caller's Ed25519
 * public key, trusted only while separately governed config pins its `contentHash` (`HELM_BILLING_SERVICE_GRANT_PINS`, the
 * counterpart of LLM `trustedIssuerGrants`). Core holds no shared secret. Requests are signed over version, method, path, grant,
 * timestamp, nonce and body hash; database time bounds the window and a committed nonce row refuses replays. Every refusal is
 * the same `service_unauthorized` outside; signatures and bodies are never logged.
 */
export const BILLING_SERVICE_SCOPES = ["quote", "reserve", "settle", "release", "mark-unknown", "resolve-unknown"] as const;
export type BillingServiceScope = (typeof BILLING_SERVICE_SCOPES)[number];
/** Scopes a grant row may declare. `balance-status` is declared ahead of its operation (C-BAL) so a grant need not be rotated
 * when it lands; until that operation joins BILLING_SERVICE_SCOPES no route accepts it and it authorizes nothing. */
export const BILLING_SERVICE_GRANT_SCOPES: readonly string[] = [...BILLING_SERVICE_SCOPES, "balance-status"];
export const BILLING_SIGNATURE_WINDOW_MS = 300_000;
/** Grant ids the request header accepts; a row with any other id can never authenticate. */
export const BILLING_SERVICE_GRANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const NONCE_PURGE_MARGIN_SECONDS = 60; // purge strictly after a nonce's timestamp can no longer pass the window
const HEADERS = { grant: "x-helm-billing-grant", timestamp: "x-helm-billing-timestamp", nonce: "x-helm-billing-nonce",
  signature: "x-helm-billing-signature" } as const;

export class ServiceAuthRefused extends Error {
  constructor(readonly reason: string) { super(`billing_service_${reason}`); this.name = "ServiceAuthRefused"; }
}
function refuse(reason: string): never { throw new ServiceAuthRefused(reason); }

export type BillingServiceGrantRow = { id: string; issuerRef: string; scopesJson: string; publicKeyPem: string;
  keyFingerprint: string; approvalRef: string; createdBy: string; contentHash: string; validFrom: Date; validUntil: Date;
  revokedAt: Date | null };
export function billingServiceKeyFingerprint(key: KeyObject): string {
  return `sha256:${createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex")}`;
}
export function billingServiceGrantHash(row: Omit<BillingServiceGrantRow, "contentHash" | "revokedAt">): string {
  const content = { schema: "helm.billing-service-grant/v2", id: row.id, issuerRef: row.issuerRef, scopesJson: row.scopesJson,
    publicKeyPem: row.publicKeyPem, keyFingerprint: row.keyFingerprint, approvalRef: row.approvalRef, createdBy: row.createdBy,
    validFrom: row.validFrom.toISOString(), validUntil: row.validUntil.toISOString() };
  return `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

const pinsSchema = z.record(z.string(), z.string().regex(/^sha256:[a-f0-9]{64}$/));
/** Absent or malformed pins trust nothing (fail closed, never partially parsed). Pins are not secret. */
function readPins(raw: string | undefined) {
  if (!raw?.trim()) return refuse("pins_empty");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return refuse("pins_invalid"); }
  const result = pinsSchema.safeParse(parsed);
  return result.success ? result.data : refuse("pins_invalid");
}

/** `body` is the raw request bytes as sent (hashed as-is: no decoding, BOM or UTF-8 repair). The query string is not signed. */
export type SignedRequestParts = { method: string; path: string; grantId: string; timestamp: string; nonce: string;
  body: Uint8Array | string };
function canonicalRequest(parts: SignedRequestParts) {
  return Buffer.from(["helm-billing-internal/v1", parts.method.toUpperCase(), parts.path, parts.grantId, parts.timestamp,
    parts.nonce, createHash("sha256").update(parts.body).digest("hex")].join("\n"));
}
/** Caller-side Ed25519 signature header value (`v1=<base64>`); Core only verifies. */
export function signBillingInternalRequest(privateKey: KeyObject, parts: SignedRequestParts): string {
  return `v1=${sign(null, canonicalRequest(parts), privateKey).toString("base64")}`;
}

/**
 * Authenticates one signed request for `scope` and records its nonce (committed on its own, before the operation runs, so a
 * replay is refused even when the operation later fails; a retry signs a fresh nonce and replays by idempotencyKey).
 */
export async function authenticateBillingService(client: PrismaClient, request: { method: string; path: string;
  headers: Headers; body: Uint8Array }, scope: BillingServiceScope, env: Readonly<Record<string, string | undefined>> = process.env) {
  const grantId = request.headers.get(HEADERS.grant) ?? "", timestamp = request.headers.get(HEADERS.timestamp) ?? "";
  const nonce = request.headers.get(HEADERS.nonce) ?? "", signature = request.headers.get(HEADERS.signature) ?? "";
  if (!BILLING_SERVICE_GRANT_ID_PATTERN.test(grantId) || !/^[1-9][0-9]{12}$/.test(timestamp) ||
      !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^v1=[A-Za-z0-9+/]{86}==$/.test(signature)) refuse("headers_invalid");
  const pins = readPins(env.HELM_BILLING_SERVICE_GRANT_PINS);
  if (!Object.hasOwn(pins, grantId)) refuse("grant_untrusted"); // unpinned ids never reach the database
  const signatureBytes = Buffer.from(signature.slice(3), "base64");
  if (signatureBytes.length !== 64 || signatureBytes.toString("base64") !== signature.slice(3)) refuse("headers_invalid");
  const [grant] = await client.$queryRaw<Array<BillingServiceGrantRow & { now: Date }>>`SELECT id, issuerRef, scopesJson,
    publicKeyPem, keyFingerprint, approvalRef, createdBy, contentHash, validFrom, validUntil, revokedAt, UTC_TIMESTAMP(3) AS now
    FROM BillingServiceGrant WHERE id = ${grantId}`;
  if (!grant || grant.id !== grantId) refuse("grant_unknown");
  if (pins[grant.id] !== grant.contentHash ||
      billingServiceGrantHash(grant) !== grant.contentHash) refuse("grant_untrusted");
  const key = billingServiceGrantPublicKey(grant);
  const parts = { method: request.method, path: request.path, grantId, timestamp, nonce, body: request.body };
  if (!verify(null, canonicalRequest(parts), key, signatureBytes)) refuse("signature_invalid");
  if (grant.revokedAt !== null || grant.validFrom > grant.now || grant.validUntil <= grant.now) refuse("grant_inactive");
  if (!billingServiceGrantScopes(grant.scopesJson).includes(scope)) refuse("scope_denied");
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
  // v3.9: reservations belong to the issuer (stable across rotation, covered by contentHash and the pin), not the grant.
  return { grantId, actor: { type: "SYSTEM", ref: `billing-service:${grant.issuerRef}/${grantId}` } satisfies ServiceActor };
}

/** The pinned row's key must be an Ed25519 SPKI public key (never a private PEM) matching its stored fingerprint. */
export function billingServiceGrantPublicKey(grant: Pick<BillingServiceGrantRow, "publicKeyPem" | "keyFingerprint">): KeyObject {
  if (!grant.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----\n")) refuse("grant_key_invalid");
  let key: KeyObject;
  try { key = createPublicKey(grant.publicKeyPem); } catch { return refuse("grant_key_invalid"); }
  if (key.asymmetricKeyType !== "ed25519" || billingServiceKeyFingerprint(key) !== grant.keyFingerprint) refuse("grant_key_invalid");
  return key;
}

/** Canonical (sorted, unique, known) scope list; anything else trusts no scope. */
export function billingServiceGrantScopes(scopesJson: string): readonly string[] {
  let scopes: unknown;
  try { scopes = JSON.parse(scopesJson); } catch { return []; }
  if (!Array.isArray(scopes) || scopes.some(s => !BILLING_SERVICE_GRANT_SCOPES.includes(s)) ||
      JSON.stringify([...new Set(scopes)].sort()) !== scopesJson) return [];
  return scopes;
}
