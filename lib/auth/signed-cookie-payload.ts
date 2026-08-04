import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed cookie payloads.
 *
 * WHY THIS EXISTS. A cookie is not a server-side store. `httpOnly` stops page
 * JavaScript from READING a cookie; it does nothing whatsoever about a client
 * that sends whatever `Cookie:` header it likes. Any cookie whose contents
 * reach an authorization decision is therefore attacker-authored input unless
 * its integrity is proven, and "we wrote it, so we can parse it back" is not
 * proof. The OAuth signup prefill cookie was written as bare
 * `JSON.stringify(...)` and validated only against fields inside its own
 * payload, which let an unauthenticated caller skip email and phone
 * verification entirely and name the workspace it joined.
 *
 * WHAT IS SIGNED. The exact bytes that will be parsed — the base64url of the
 * JSON, not the JSON's meaning. Signing a re-serialisation would let a payload
 * that round-trips differently pass a check performed on different bytes.
 *
 * KEY MATERIAL follows the repository's existing server-secret contract
 * (`CONNECTOR_TOKEN_SECRET`, with `_PREVIOUS` honoured for rotation) rather
 * than introducing a new environment variable that every deployment would have
 * to be told about. The secret is never used directly: each purpose derives its
 * own key through an HMAC with a context label, so a signature minted for one
 * purpose cannot be replayed as another.
 */

const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Non-production fallback. A per-PROCESS random key, never a fixed string and
 * never "skip the signature": an unsigned path that exists only in development
 * is still an unsigned path, and development databases hold real invitations.
 * The cost is that a restart invalidates outstanding prefill cookies, which
 * degrades a convenience feature rather than an authorization boundary.
 */
const EPHEMERAL_DEVELOPMENT_SECRET = randomBytes(32).toString("hex");

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** The only secret allowed to mint a new cookie. */
function configuredSigningSecret(): string | null {
  const primary = process.env.CONNECTOR_TOKEN_SECRET?.trim();
  if (primary) return primary;
  if (isProduction()) return null;
  return EPHEMERAL_DEVELOPMENT_SECRET;
}

/**
 * Every secret a signature may be verified against: the current one first, then
 * the previous one during a rotation window. A previous secret is never
 * promoted to signing authority when the current secret is absent.
 */
function configuredVerificationSecrets(): string[] {
  const primary = process.env.CONNECTOR_TOKEN_SECRET?.trim();
  const previous = process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS?.trim();
  const secrets = [primary, previous].filter(
    (value): value is string => Boolean(value),
  );
  if (secrets.length > 0) return secrets;
  if (isProduction()) return [];
  return [EPHEMERAL_DEVELOPMENT_SECRET];
}

export class SignedCookieSecretMissingError extends Error {
  readonly code = "signed_cookie_secret_missing";

  constructor() {
    super(
      "CONNECTOR_TOKEN_SECRET is required to sign authentication cookies in production",
    );
    this.name = "SignedCookieSecretMissingError";
  }
}

function deriveKey(secret: string, purpose: string): Buffer {
  return createHmac("sha256", secret).update(`helm:signed-cookie:${purpose}`).digest();
}

function sign(encodedPayload: string, secret: string, purpose: string): string {
  return createHmac("sha256", deriveKey(secret, purpose))
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the lengths are compared first and the result is combined.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Serialise and sign. Throws in production when no secret is configured: a
 * deployment that cannot sign must not fall back to writing something a client
 * could have written itself.
 */
export function serializeSignedCookiePayload(
  purpose: string,
  payload: unknown,
): string {
  const secret = configuredSigningSecret();
  if (!secret) throw new SignedCookieSecretMissingError();
  if (isProduction() && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      "CONNECTOR_TOKEN_SECRET must be at least 32 characters in production",
    );
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret, purpose)}`;
}

/**
 * Verify, then parse. Returns null for ANY failure — no secret, wrong shape,
 * missing or invalid signature, unparseable JSON — because every one of them
 * means the same thing to a caller: this value is not evidence of anything.
 *
 * The signature is checked BEFORE the payload is parsed, let alone read, so no
 * attacker-chosen field ever reaches a decision.
 */
export function parseSignedCookiePayload<T>(
  purpose: string,
  rawValue: string | null | undefined,
): T | null {
  if (!rawValue) return null;
  const separator = rawValue.lastIndexOf(".");
  if (separator <= 0 || separator === rawValue.length - 1) return null;
  const encoded = rawValue.slice(0, separator);
  const signature = rawValue.slice(separator + 1);

  const accepted = configuredVerificationSecrets().some((secret) =>
    signaturesMatch(signature, sign(encoded, secret, purpose)),
  );
  if (!accepted) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
