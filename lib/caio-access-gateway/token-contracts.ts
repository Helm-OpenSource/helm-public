/**
 * CAIO access token pure contracts.
 *
 * Token format: `<audience prefix><32 random bytes, base64url>` where the
 * prefix is audience-distinct ("hcaio_mcp_" / "hcaio_mdl_"). Only the
 * sha256 hash and a short visible prefix are ever stored or displayed;
 * the raw token is returned exactly once at issuance/rotation time.
 */

import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const CAIO_TOKEN_AUDIENCES = ["mcp", "model"] as const;
export type CaioTokenAudience = (typeof CAIO_TOKEN_AUDIENCES)[number];

export const CAIO_CLIENT_TYPES = ["codex", "workbuddy"] as const;
export type CaioClientType = (typeof CAIO_CLIENT_TYPES)[number];

export const CAIO_TOKEN_STATUSES = [
  "active",
  "rotated",
  "revoked",
  "expired",
] as const;
export type CaioTokenStatus = (typeof CAIO_TOKEN_STATUSES)[number];

export const CAIO_TOKEN_PREFIX_BY_AUDIENCE: Readonly<
  Record<CaioTokenAudience, string>
> = Object.freeze({
  mcp: "hcaio_mcp_",
  model: "hcaio_mdl_",
});

export const CAIO_TOKEN_RANDOM_BYTES = 32;
/** 32 random bytes render to exactly 43 base64url characters. */
const CAIO_TOKEN_BODY_LENGTH = 43;
const CAIO_TOKEN_BODY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** TTL is exactly 90 days. */
export const CAIO_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const CAIO_TOKEN_VISIBLE_PREFIX_LENGTH = 12;

export function hashCaioAccessToken(rawToken: string): string {
  return `sha256:${createHash("sha256").update(rawToken, "utf8").digest("hex")}`;
}

export const caioTokenHashSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/);

export type CaioAccessTokenMaterial = Readonly<{
  audience: CaioTokenAudience;
  /** Returned once at issuance; never stored, logged, or echoed. */
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
}>;

export function createCaioAccessTokenMaterial(
  audience: CaioTokenAudience,
  randomSource: (bytes: number) => Buffer = randomBytes,
): CaioAccessTokenMaterial {
  const body = randomSource(CAIO_TOKEN_RANDOM_BYTES).toString("base64url");
  if (body.length !== CAIO_TOKEN_BODY_LENGTH) {
    throw new Error("CAIO token random source produced a malformed body.");
  }
  const rawToken = `${CAIO_TOKEN_PREFIX_BY_AUDIENCE[audience]}${body}`;
  return Object.freeze({
    audience,
    rawToken,
    tokenHash: hashCaioAccessToken(rawToken),
    tokenPrefix: rawToken.slice(0, CAIO_TOKEN_VISIBLE_PREFIX_LENGTH),
  });
}

export function computeCaioTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + CAIO_TOKEN_TTL_MS);
}

/** Returns the audience encoded in the raw token prefix, or null. */
export function parseCaioTokenAudience(
  rawToken: string,
): CaioTokenAudience | null {
  for (const audience of CAIO_TOKEN_AUDIENCES) {
    if (rawToken.startsWith(CAIO_TOKEN_PREFIX_BY_AUDIENCE[audience])) {
      return audience;
    }
  }
  return null;
}

export function isWellFormedCaioToken(
  rawToken: string,
  audience?: CaioTokenAudience,
): boolean {
  const parsedAudience = parseCaioTokenAudience(rawToken);
  if (parsedAudience === null) return false;
  if (audience !== undefined && parsedAudience !== audience) return false;
  const body = rawToken.slice(
    CAIO_TOKEN_PREFIX_BY_AUDIENCE[parsedAudience].length,
  );
  return CAIO_TOKEN_BODY_PATTERN.test(body);
}

export const caioTokenAudienceSchema = z.enum(CAIO_TOKEN_AUDIENCES);
export const caioClientTypeSchema = z.enum(CAIO_CLIENT_TYPES);
export const caioTokenStatusSchema = z.enum(CAIO_TOKEN_STATUSES);

export const caioSafeRefSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/);

export const caioSourceIpSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => isIP(value) !== 0, {
    message: "approvedSourceIp must be a literal IPv4 or IPv6 address.",
  });

export const caioTokenIssuanceInputSchema = z
  .object({
    workspaceId: caioSafeRefSchema,
    userRef: caioSafeRefSchema,
    clientType: caioClientTypeSchema,
    deviceRef: caioSafeRefSchema,
    approvedSourceIp: caioSourceIpSchema,
  })
  .strict();
export type CaioTokenIssuanceInput = z.infer<
  typeof caioTokenIssuanceInputSchema
>;

export const caioTokenRotationInputSchema = z
  .object({
    workspaceId: caioSafeRefSchema,
    tokenId: caioSafeRefSchema,
  })
  .strict();
export type CaioTokenRotationInput = z.infer<
  typeof caioTokenRotationInputSchema
>;

export const caioTokenRevocationInputSchema = z
  .object({
    workspaceId: caioSafeRefSchema,
    tokenId: caioSafeRefSchema,
  })
  .strict();
export type CaioTokenRevocationInput = z.infer<
  typeof caioTokenRevocationInputSchema
>;
