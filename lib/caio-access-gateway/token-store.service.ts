/**
 * CAIO access token store service.
 *
 * The service is written against a narrow injected persistence port
 * (mirroring the GovernedModelGatewayDependencies pattern) so unit tests
 * run against an in-memory fake while production wires the thin Prisma
 * adapter in token-store.prisma.ts.
 *
 * Security invariants:
 * - Raw tokens exist only in the issuance/rotation return value; the port
 *   receives hash + visible prefix only.
 * - Error messages carry bare taxonomy codes, never token material.
 */

import { randomUUID, randomBytes } from "node:crypto";

import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  CAIO_TOKEN_AUDIENCES,
  caioTokenIssuanceInputSchema,
  caioTokenRevocationInputSchema,
  caioTokenRotationInputSchema,
  computeCaioTokenExpiry,
  createCaioAccessTokenMaterial,
  hashCaioAccessToken,
  isWellFormedCaioToken,
  type CaioClientType,
  type CaioTokenAudience,
  type CaioTokenStatus,
} from "@/lib/caio-access-gateway/token-contracts";

/** Fixed rate window (spec: fixed 60-second window). */
export const CAIO_RATE_WINDOW_MS = 60_000;
export const CAIO_DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

export type CaioAccessTokenRecord = Readonly<{
  id: string;
  workspaceId: string;
  userRef: string;
  clientType: CaioClientType;
  deviceRef: string;
  audience: CaioTokenAudience;
  tokenHash: string;
  tokenPrefix: string;
  approvedSourceIp: string;
  status: CaioTokenStatus;
  createdAt: Date;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  rotatedFromTokenId: string | null;
  rateWindowStartedAt: Date;
  rateWindowRequestCount: number;
}>;

export type CaioRateSlotResult =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; retryAfterSeconds: number }>;

export type CaioTokenInsertResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; conflictAudience: CaioTokenAudience }>;

export type CaioTokenRevokeResult =
  | "revoked"
  | "already_revoked"
  | "not_found";

/**
 * Narrow persistence delegate surface. Every method must be atomic on its
 * own; the adapter owns transaction/conditional-update mechanics.
 */
export type CaioAccessTokenPersistence = Readonly<{
  /**
   * Atomically insert all rows only if no active token exists for any
   * row's (workspace, user, clientType, deviceRef, audience) binding.
   */
  insertIfNoActiveBinding(
    rows: readonly CaioAccessTokenRecord[],
  ): Promise<CaioTokenInsertResult>;
  findByTokenHash(tokenHash: string): Promise<CaioAccessTokenRecord | null>;
  findById(input: {
    workspaceId: string;
    tokenId: string;
  }): Promise<CaioAccessTokenRecord | null>;
  /**
   * Atomically count one request into the fixed rate window
   * (rateWindowStartedAt/rateWindowRequestCount) or report the limit.
   */
  claimRateSlot(input: {
    tokenId: string;
    now: Date;
    windowMs: number;
    limit: number;
  }): Promise<CaioRateSlotResult>;
  /**
   * Single transaction: conditionally flip the old row from
   * status="active" to "rotated" (+rotatedAt) and insert the replacement.
   * Returns false when the conditional update matched no row (lost race).
   */
  rotateActive(input: {
    workspaceId: string;
    tokenId: string;
    rotatedAt: Date;
    replacement: CaioAccessTokenRecord;
  }): Promise<boolean>;
  revoke(input: {
    workspaceId: string;
    tokenId: string;
    revokedAt: Date;
  }): Promise<CaioTokenRevokeResult>;
  markExpired(input: { now: Date }): Promise<number>;
}>;

export type CaioAccessPrincipal = Readonly<{
  tokenId: string;
  workspaceId: string;
  userRef: string;
  clientType: CaioClientType;
  deviceRef: string;
  audience: CaioTokenAudience;
}>;

export type CaioIssuedToken = Readonly<{
  /** Returned once; never persisted or logged. */
  rawToken: string;
  record: CaioAccessTokenRecord;
}>;

export type CaioIssuedTokenPair = Readonly<{
  mcp: CaioIssuedToken;
  model: CaioIssuedToken;
}>;

export type CaioAccessTokenServiceDependencies = Readonly<{
  persistence: CaioAccessTokenPersistence;
  idFactory?: () => string;
  randomSource?: (bytes: number) => Buffer;
}>;

export type CaioAccessTokenService = Readonly<{
  issueCaioTokenPair(input: {
    workspaceId: string;
    userRef: string;
    clientType: CaioClientType;
    deviceRef: string;
    approvedSourceIp: string;
    now: Date;
  }): Promise<CaioIssuedTokenPair>;
  authenticateCaioToken(input: {
    rawToken: string;
    expectedAudience: CaioTokenAudience;
    sourceIp: string;
    now: Date;
    rateLimitPerMinute?: number;
  }): Promise<CaioAccessPrincipal>;
  rotateCaioToken(input: {
    workspaceId: string;
    tokenId: string;
    now: Date;
  }): Promise<CaioIssuedToken>;
  revokeCaioToken(input: {
    workspaceId: string;
    tokenId: string;
    now: Date;
  }): Promise<
    Readonly<{ tokenId: string; status: "revoked"; alreadyRevoked: boolean }>
  >;
  expireSweep(input: {
    now: Date;
  }): Promise<Readonly<{ expiredCount: number }>>;
}>;

function unauthorized(
  code:
    | "token_unknown"
    | "token_expired"
    | "token_revoked"
    | "token_rotated"
    | "audience_mismatch",
): CaioAccessGatewayError {
  return new CaioAccessGatewayError(code);
}

export function createCaioAccessTokenService(
  dependencies: CaioAccessTokenServiceDependencies,
): CaioAccessTokenService {
  const persistence = dependencies.persistence;
  const idFactory = dependencies.idFactory ?? (() => randomUUID());
  const randomSource = dependencies.randomSource ?? randomBytes;

  function buildRecord(input: {
    binding: {
      workspaceId: string;
      userRef: string;
      clientType: CaioClientType;
      deviceRef: string;
      approvedSourceIp: string;
    };
    audience: CaioTokenAudience;
    now: Date;
    rotatedFromTokenId?: string | null;
  }): CaioIssuedToken {
    const material = createCaioAccessTokenMaterial(
      input.audience,
      randomSource,
    );
    const record: CaioAccessTokenRecord = Object.freeze({
      id: idFactory(),
      workspaceId: input.binding.workspaceId,
      userRef: input.binding.userRef,
      clientType: input.binding.clientType,
      deviceRef: input.binding.deviceRef,
      audience: input.audience,
      tokenHash: material.tokenHash,
      tokenPrefix: material.tokenPrefix,
      approvedSourceIp: input.binding.approvedSourceIp,
      status: "active",
      createdAt: input.now,
      expiresAt: computeCaioTokenExpiry(input.now),
      rotatedAt: null,
      revokedAt: null,
      rotatedFromTokenId: input.rotatedFromTokenId ?? null,
      rateWindowStartedAt: input.now,
      rateWindowRequestCount: 0,
    });
    return Object.freeze({ rawToken: material.rawToken, record });
  }

  return Object.freeze({
    async issueCaioTokenPair(input): Promise<CaioIssuedTokenPair> {
      const parsed = caioTokenIssuanceInputSchema.safeParse({
        workspaceId: input.workspaceId,
        userRef: input.userRef,
        clientType: input.clientType,
        deviceRef: input.deviceRef,
        approvedSourceIp: input.approvedSourceIp,
      });
      if (!parsed.success) {
        throw new CaioAccessGatewayError("bad_request");
      }
      const issued = {} as Record<CaioTokenAudience, CaioIssuedToken>;
      for (const audience of CAIO_TOKEN_AUDIENCES) {
        issued[audience] = buildRecord({
          binding: parsed.data,
          audience,
          now: input.now,
        });
      }
      const result = await persistence.insertIfNoActiveBinding([
        issued.mcp.record,
        issued.model.record,
      ]);
      if (!result.ok) {
        // Revoke-replace is intentionally NOT allowed here: an existing
        // active binding must be revoked through the explicit revocation
        // path before a new pair can be issued.
        throw new CaioAccessGatewayError("active_token_exists");
      }
      return Object.freeze({ mcp: issued.mcp, model: issued.model });
    },

    async authenticateCaioToken(input): Promise<CaioAccessPrincipal> {
      // Malformed tokens are indistinguishable from unknown tokens so the
      // failure reveals nothing about the token space.
      if (!isWellFormedCaioToken(input.rawToken)) {
        throw unauthorized("token_unknown");
      }
      const record = await persistence.findByTokenHash(
        hashCaioAccessToken(input.rawToken),
      );
      if (!record) throw unauthorized("token_unknown");

      // The rate slot is claimed as soon as the token RESOLVES, before the
      // revoked/rotated/expired/audience/source-ip branches, so a holder of
      // an invalid-but-existing credential consumes budget instead of
      // polling the gateway for free.
      //
      // The claim RESULT is deliberately not allowed to change the failure
      // taxonomy below: converting a 401/403 into a 429 once the window is
      // exhausted would turn the limiter into an oracle for "this token
      // exists and is live". A refusal is therefore only raised on the path
      // that would otherwise have succeeded.
      const limit = Math.max(
        1,
        Math.floor(
          input.rateLimitPerMinute ?? CAIO_DEFAULT_RATE_LIMIT_PER_MINUTE,
        ),
      );
      const slot = await persistence.claimRateSlot({
        tokenId: record.id,
        now: input.now,
        windowMs: CAIO_RATE_WINDOW_MS,
        limit,
      });

      if (record.status === "revoked") throw unauthorized("token_revoked");
      if (record.status === "rotated") throw unauthorized("token_rotated");
      if (
        record.status === "expired" ||
        record.expiresAt.getTime() <= input.now.getTime()
      ) {
        throw unauthorized("token_expired");
      }
      // Audience swap (an mcp token presented to a model route or vice
      // versa) MUST fail as a 401-class error.
      if (record.audience !== input.expectedAudience) {
        throw unauthorized("audience_mismatch");
      }
      if (record.approvedSourceIp !== input.sourceIp) {
        throw new CaioAccessGatewayError("source_ip_mismatch");
      }
      if (!slot.allowed) {
        throw new CaioAccessGatewayError("rate_limited", {
          retryAfterSeconds: slot.retryAfterSeconds,
        });
      }
      return Object.freeze({
        tokenId: record.id,
        workspaceId: record.workspaceId,
        userRef: record.userRef,
        clientType: record.clientType,
        deviceRef: record.deviceRef,
        audience: record.audience,
      });
    },

    async rotateCaioToken(input): Promise<CaioIssuedToken> {
      const parsed = caioTokenRotationInputSchema.safeParse({
        workspaceId: input.workspaceId,
        tokenId: input.tokenId,
      });
      if (!parsed.success) {
        throw new CaioAccessGatewayError("bad_request");
      }
      const existing = await persistence.findById(parsed.data);
      if (!existing) throw unauthorized("token_unknown");
      if (existing.status !== "active") {
        throw new CaioAccessGatewayError("rotation_conflict");
      }
      const replacement = buildRecord({
        binding: {
          workspaceId: existing.workspaceId,
          userRef: existing.userRef,
          clientType: existing.clientType,
          deviceRef: existing.deviceRef,
          approvedSourceIp: existing.approvedSourceIp,
        },
        audience: existing.audience,
        now: input.now,
        rotatedFromTokenId: existing.id,
      });
      const rotated = await persistence.rotateActive({
        workspaceId: existing.workspaceId,
        tokenId: existing.id,
        rotatedAt: input.now,
        replacement: replacement.record,
      });
      if (!rotated) {
        // Concurrency-safe: the conditional update on status="active"
        // matched nothing, so another rotation/revocation won the race.
        throw new CaioAccessGatewayError("rotation_conflict");
      }
      return replacement;
    },

    async revokeCaioToken(input) {
      const parsed = caioTokenRevocationInputSchema.safeParse({
        workspaceId: input.workspaceId,
        tokenId: input.tokenId,
      });
      if (!parsed.success) {
        throw new CaioAccessGatewayError("bad_request");
      }
      const result = await persistence.revoke({
        workspaceId: parsed.data.workspaceId,
        tokenId: parsed.data.tokenId,
        revokedAt: input.now,
      });
      if (result === "not_found") throw unauthorized("token_unknown");
      return Object.freeze({
        tokenId: parsed.data.tokenId,
        status: "revoked" as const,
        alreadyRevoked: result === "already_revoked",
      });
    },

    async expireSweep(input) {
      const expiredCount = await persistence.markExpired({ now: input.now });
      return Object.freeze({ expiredCount });
    },
  });
}
