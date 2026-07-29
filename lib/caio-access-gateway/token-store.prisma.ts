/**
 * Thin Prisma adapter for CaioAccessTokenPersistence.
 *
 * All atomicity guarantees live here: serializable transactions for
 * pair issuance and rotation, conditional updateMany for the
 * rotation/revocation races, and conditional-update loops for the fixed
 * rate window. Covered by the env-gated token-store.mysql.test.ts.
 */

import { Prisma, type CaioAccessToken as StoredToken } from "@prisma/client";

import { db } from "@/lib/db";
import {
  isWriteConflictError,
  runWithWriteConflictRetry,
} from "@/lib/db/conflict-aware-write";
import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  caioClientTypeSchema,
  caioTokenAudienceSchema,
  caioTokenStatusSchema,
} from "@/lib/caio-access-gateway/token-contracts";
import type {
  CaioAccessTokenPersistence,
  CaioAccessTokenRecord,
  CaioRateSlotResult,
  CaioTokenInsertResult,
  CaioTokenRevokeResult,
} from "@/lib/caio-access-gateway/token-store.service";

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

const RATE_SLOT_MAX_ATTEMPTS = 4;

/**
 * Runs one conditional rate-window update, returning null when the engine
 * refuses it as a write conflict so the caller can retry within its bounded
 * attempt budget. Any other failure still propagates.
 */
async function claimUpdate(
  run: () => Promise<{ count: number }>,
): Promise<{ count: number } | null> {
  try {
    return await run();
  } catch (error) {
    if (isWriteConflictError(error)) return null;
    throw error;
  }
}

function toRecord(row: StoredToken): CaioAccessTokenRecord {
  return Object.freeze({
    id: row.id,
    workspaceId: row.workspaceId,
    userRef: row.userRef,
    clientType: caioClientTypeSchema.parse(row.clientType),
    deviceRef: row.deviceRef,
    audience: caioTokenAudienceSchema.parse(row.audience),
    tokenHash: row.tokenHash,
    tokenPrefix: row.tokenPrefix,
    approvedSourceIp: row.approvedSourceIp,
    status: caioTokenStatusSchema.parse(row.status),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    rotatedAt: row.rotatedAt,
    revokedAt: row.revokedAt,
    rotatedFromTokenId: row.rotatedFromTokenId,
    rateWindowStartedAt: row.rateWindowStartedAt,
    rateWindowRequestCount: row.rateWindowRequestCount,
  });
}

function toRow(
  record: CaioAccessTokenRecord,
): Prisma.CaioAccessTokenCreateManyInput {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    userRef: record.userRef,
    clientType: record.clientType,
    deviceRef: record.deviceRef,
    audience: record.audience,
    tokenHash: record.tokenHash,
    tokenPrefix: record.tokenPrefix,
    approvedSourceIp: record.approvedSourceIp,
    status: record.status,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    rotatedAt: record.rotatedAt,
    revokedAt: record.revokedAt,
    rotatedFromTokenId: record.rotatedFromTokenId,
    rateWindowStartedAt: record.rateWindowStartedAt,
    rateWindowRequestCount: record.rateWindowRequestCount,
  };
}

export function createPrismaCaioAccessTokenPersistence(
  client: typeof db = db,
): CaioAccessTokenPersistence {
  return Object.freeze({
    async insertIfNoActiveBinding(
      rows: readonly CaioAccessTokenRecord[],
    ): Promise<CaioTokenInsertResult> {
      return runWithWriteConflictRetry(
        () =>
          client.$transaction(async (tx) => {
            for (const row of rows) {
              const existing = await tx.caioAccessToken.findFirst({
                where: {
                  workspaceId: row.workspaceId,
                  userRef: row.userRef,
                  clientType: row.clientType,
                  deviceRef: row.deviceRef,
                  audience: row.audience,
                  status: "active",
                },
                select: { id: true },
              });
              if (existing) {
                return {
                  ok: false as const,
                  conflictAudience: row.audience,
                };
              }
            }
            await tx.caioAccessToken.createMany({
              data: rows.map(toRow),
            });
            return { ok: true as const };
          }, TRANSACTION_OPTIONS),
        WRITE_RETRY_OPTIONS,
      );
    },

    async findByTokenHash(
      tokenHash: string,
    ): Promise<CaioAccessTokenRecord | null> {
      const row = await client.caioAccessToken.findUnique({
        where: { tokenHash },
      });
      return row ? toRecord(row) : null;
    },

    async findById(input: {
      workspaceId: string;
      tokenId: string;
    }): Promise<CaioAccessTokenRecord | null> {
      const row = await client.caioAccessToken.findFirst({
        where: { id: input.tokenId, workspaceId: input.workspaceId },
      });
      return row ? toRecord(row) : null;
    },

    async claimRateSlot(input: {
      tokenId: string;
      now: Date;
      windowMs: number;
      limit: number;
    }): Promise<CaioRateSlotResult> {
      const cutoff = new Date(input.now.getTime() - input.windowMs);
      for (let attempt = 0; attempt < RATE_SLOT_MAX_ATTEMPTS; attempt += 1) {
        // Concurrent authentications target the same row, so the engine can
        // reject a conditional update with a write conflict (MySQL 1020 /
        // Prisma P2034). Treat that as "someone else moved the window" and
        // take another bounded attempt instead of surfacing a raw database
        // error to the caller.
        const reset = await claimUpdate(() =>
          client.caioAccessToken.updateMany({
            where: {
              id: input.tokenId,
              rateWindowStartedAt: { lte: cutoff },
            },
            data: {
              rateWindowStartedAt: input.now,
              rateWindowRequestCount: 1,
            },
          }),
        );
        if (reset === null) continue;
        if (reset.count === 1) return { allowed: true };
        const counted = await claimUpdate(() =>
          client.caioAccessToken.updateMany({
            where: {
              id: input.tokenId,
              rateWindowStartedAt: { gt: cutoff },
              rateWindowRequestCount: { lt: input.limit },
            },
            data: { rateWindowRequestCount: { increment: 1 } },
          }),
        );
        if (counted === null) continue;
        if (counted.count === 1) return { allowed: true };
        const row = await client.caioAccessToken.findUnique({
          where: { id: input.tokenId },
          select: {
            rateWindowStartedAt: true,
            rateWindowRequestCount: true,
          },
        });
        if (!row) throw new CaioAccessGatewayError("token_unknown");
        const windowStartMs = row.rateWindowStartedAt.getTime();
        if (
          windowStartMs > cutoff.getTime() &&
          row.rateWindowRequestCount >= input.limit
        ) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(
                (windowStartMs + input.windowMs - input.now.getTime()) /
                  1000,
              ),
            ),
          };
        }
        // A concurrent writer moved the window between our conditional
        // updates; take another bounded attempt.
      }
      // Fail closed after bounded retries rather than admitting a request
      // that could not be counted.
      return { allowed: false, retryAfterSeconds: 1 };
    },

    async rotateActive(input: {
      workspaceId: string;
      tokenId: string;
      rotatedAt: Date;
      replacement: CaioAccessTokenRecord;
    }): Promise<boolean> {
      return runWithWriteConflictRetry(
        () =>
          client.$transaction(async (tx) => {
            const rotated = await tx.caioAccessToken.updateMany({
              where: {
                id: input.tokenId,
                workspaceId: input.workspaceId,
                status: "active",
              },
              data: { status: "rotated", rotatedAt: input.rotatedAt },
            });
            if (rotated.count !== 1) return false;
            await tx.caioAccessToken.create({
              data: toRow(input.replacement),
            });
            return true;
          }, TRANSACTION_OPTIONS),
        WRITE_RETRY_OPTIONS,
      );
    },

    async revoke(input: {
      workspaceId: string;
      tokenId: string;
      revokedAt: Date;
    }): Promise<CaioTokenRevokeResult> {
      return runWithWriteConflictRetry(
        () =>
          client.$transaction(async (tx) => {
            const revoked = await tx.caioAccessToken.updateMany({
              where: {
                id: input.tokenId,
                workspaceId: input.workspaceId,
                revokedAt: null,
              },
              data: { status: "revoked", revokedAt: input.revokedAt },
            });
            if (revoked.count === 1) return "revoked" as const;
            const existing = await tx.caioAccessToken.findFirst({
              where: {
                id: input.tokenId,
                workspaceId: input.workspaceId,
              },
              select: { id: true },
            });
            return existing
              ? ("already_revoked" as const)
              : ("not_found" as const);
          }, TRANSACTION_OPTIONS),
        WRITE_RETRY_OPTIONS,
      );
    },

    async markExpired(input: { now: Date }): Promise<number> {
      const swept = await client.caioAccessToken.updateMany({
        where: { status: "active", expiresAt: { lte: input.now } },
        data: { status: "expired" },
      });
      return swept.count;
    },
  });
}
