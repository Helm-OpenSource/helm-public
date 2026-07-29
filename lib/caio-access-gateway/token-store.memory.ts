/**
 * In-memory CaioAccessTokenPersistence fake.
 *
 * Implements the same delegate surface as the Prisma adapter with the
 * same semantics (active-binding uniqueness, conditional rotation,
 * idempotent revocation, fixed rate window). Intended for unit tests and
 * local composition only — it holds no durable state.
 */

import type {
  CaioAccessTokenPersistence,
  CaioAccessTokenRecord,
  CaioRateSlotResult,
  CaioTokenInsertResult,
  CaioTokenRevokeResult,
} from "@/lib/caio-access-gateway/token-store.service";

type MutableRecord = {
  -readonly [K in keyof CaioAccessTokenRecord]: CaioAccessTokenRecord[K];
};

function snapshot(row: MutableRecord): CaioAccessTokenRecord {
  return Object.freeze({ ...row });
}

export type InMemoryCaioAccessTokenPersistence =
  CaioAccessTokenPersistence &
    Readonly<{
      /** Test hook: read a stored row snapshot by id. */
      peek(tokenId: string): CaioAccessTokenRecord | null;
      /** Test hook: all stored row snapshots. */
      rows(): readonly CaioAccessTokenRecord[];
    }>;

export function createInMemoryCaioAccessTokenPersistence(): InMemoryCaioAccessTokenPersistence {
  const byId = new Map<string, MutableRecord>();

  function findActiveBinding(row: CaioAccessTokenRecord): boolean {
    for (const stored of byId.values()) {
      if (
        stored.status === "active" &&
        stored.workspaceId === row.workspaceId &&
        stored.userRef === row.userRef &&
        stored.clientType === row.clientType &&
        stored.deviceRef === row.deviceRef &&
        stored.audience === row.audience
      ) {
        return true;
      }
    }
    return false;
  }

  return Object.freeze({
    async insertIfNoActiveBinding(
      rows: readonly CaioAccessTokenRecord[],
    ): Promise<CaioTokenInsertResult> {
      for (const row of rows) {
        if (findActiveBinding(row)) {
          return { ok: false, conflictAudience: row.audience };
        }
      }
      for (const row of rows) {
        if (byId.has(row.id)) {
          throw new Error("Duplicate CAIO access token id.");
        }
        for (const stored of byId.values()) {
          if (stored.tokenHash === row.tokenHash) {
            throw new Error("Duplicate CAIO access token hash.");
          }
        }
      }
      for (const row of rows) {
        byId.set(row.id, { ...row });
      }
      return { ok: true };
    },

    async findByTokenHash(
      tokenHash: string,
    ): Promise<CaioAccessTokenRecord | null> {
      for (const stored of byId.values()) {
        if (stored.tokenHash === tokenHash) return snapshot(stored);
      }
      return null;
    },

    async findById(input: {
      workspaceId: string;
      tokenId: string;
    }): Promise<CaioAccessTokenRecord | null> {
      const stored = byId.get(input.tokenId);
      if (!stored || stored.workspaceId !== input.workspaceId) return null;
      return snapshot(stored);
    },

    async claimRateSlot(input: {
      tokenId: string;
      now: Date;
      windowMs: number;
      limit: number;
    }): Promise<CaioRateSlotResult> {
      const stored = byId.get(input.tokenId);
      if (!stored) return { allowed: false, retryAfterSeconds: 1 };
      const windowAgeMs =
        input.now.getTime() - stored.rateWindowStartedAt.getTime();
      if (windowAgeMs >= input.windowMs) {
        stored.rateWindowStartedAt = input.now;
        stored.rateWindowRequestCount = 1;
        return { allowed: true };
      }
      if (stored.rateWindowRequestCount < input.limit) {
        stored.rateWindowRequestCount += 1;
        return { allowed: true };
      }
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (stored.rateWindowStartedAt.getTime() +
            input.windowMs -
            input.now.getTime()) /
            1000,
        ),
      );
      return { allowed: false, retryAfterSeconds };
    },

    async rotateActive(input: {
      workspaceId: string;
      tokenId: string;
      rotatedAt: Date;
      replacement: CaioAccessTokenRecord;
    }): Promise<boolean> {
      const stored = byId.get(input.tokenId);
      if (
        !stored ||
        stored.workspaceId !== input.workspaceId ||
        stored.status !== "active"
      ) {
        return false;
      }
      stored.status = "rotated";
      stored.rotatedAt = input.rotatedAt;
      byId.set(input.replacement.id, { ...input.replacement });
      return true;
    },

    async revoke(input: {
      workspaceId: string;
      tokenId: string;
      revokedAt: Date;
    }): Promise<CaioTokenRevokeResult> {
      const stored = byId.get(input.tokenId);
      if (!stored || stored.workspaceId !== input.workspaceId) {
        return "not_found";
      }
      if (stored.revokedAt !== null) return "already_revoked";
      stored.status = "revoked";
      stored.revokedAt = input.revokedAt;
      return "revoked";
    },

    async markExpired(input: { now: Date }): Promise<number> {
      let count = 0;
      for (const stored of byId.values()) {
        if (
          stored.status === "active" &&
          stored.expiresAt.getTime() <= input.now.getTime()
        ) {
          stored.status = "expired";
          count += 1;
        }
      }
      return count;
    },

    peek(tokenId: string): CaioAccessTokenRecord | null {
      const stored = byId.get(tokenId);
      return stored ? snapshot(stored) : null;
    },

    rows(): readonly CaioAccessTokenRecord[] {
      return Object.freeze([...byId.values()].map(snapshot));
    },
  });
}
