import { createHash } from "node:crypto";

import {
  CAIO_AUDIT_DEFAULT_RETRY_AFTER_SECONDS,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
  caioMinimalAuditReceiptSchema,
  type CaioAuditGateReadiness,
  type CaioAuditGateState,
  type CaioAuditPersistedVia,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import type { CaioEmergencyQueuePort } from "@/lib/caio-audit-state/emergency-queue";

/**
 * Injectable primary audit store port. The Prisma-backed implementation lives
 * in prisma-audit-receipt-store.ts; unit tests inject an in-memory port.
 *
 * persist() MUST be durable before it resolves. Duplicate [workspace,
 * requestId] with identical content resolves as "replayed"; different content
 * resolves as "conflict". Any thrown error means the write did not durably
 * happen.
 */
export interface CaioAuditPrimaryStorePort {
  persist(input: {
    receipt: CaioMinimalAuditReceipt;
    persistedVia: CaioAuditPersistedVia;
    now: Date;
  }): Promise<
    | { outcome: "persisted"; receiptId: string }
    | { outcome: "replayed"; receiptId: string }
    | { outcome: "conflict" }
  >;
}

export type CaioAuditClaimResult =
  | {
      allowed: true;
      receiptId: string;
      persistedVia: "primary" | "emergency_queue";
    }
  | {
      allowed: false;
      reason:
        | "audit_unavailable"
        | "recovery_rate_limited"
        | "receipt_conflict";
      errorCode: typeof CAIO_AUDIT_UNAVAILABLE_ERROR_CODE | "caio_audit_receipt_conflict";
      httpStatus: number;
      retryAfterSeconds?: number;
    };

export interface CaioAuditGate {
  claimDispatch(receipt: CaioMinimalAuditReceipt): Promise<CaioAuditClaimResult>;
  recover(): Promise<{
    replayed: number;
    remaining: number;
    conflicts: number;
  }>;
  getState(): CaioAuditGateState;
  getReadiness(): Promise<CaioAuditGateReadiness>;
}

/** Deterministic queue entry id derived from the receipt identity. */
export function computeEmergencyEntryId(
  receipt: Pick<CaioMinimalAuditReceipt, "workspace" | "requestId">,
): string {
  return createHash("sha256")
    .update(`${receipt.workspace}\u0000${receipt.requestId}`)
    .digest("hex")
    .slice(0, 48);
}

/**
 * Audit-gated dispatch state machine.
 *
 * Contract: `allowed: true` is only ever returned AFTER a durable audit write
 * (primary store fsync-equivalent commit, or fsync'd emergency-queue entry).
 * When neither store can persist, the claim is refused and the caller MUST
 * map the refusal to HTTP 503 `caio_audit_unavailable` with a Retry-After
 * header and MUST NOT dispatch upstream. Requests already received but not
 * yet persisted are refused by the same rule — there is no code path that
 * allows dispatch before persistence succeeds.
 */
export function createCaioAuditGate(deps: {
  primaryStore: CaioAuditPrimaryStorePort;
  emergencyQueue: CaioEmergencyQueuePort;
  now?: () => Date;
  retryAfterSeconds?: number;
  recoveryConcurrentClaimCap?: number;
}): CaioAuditGate {
  const now = deps.now ?? (() => new Date());
  const retryAfterSeconds =
    deps.retryAfterSeconds ?? CAIO_AUDIT_DEFAULT_RETRY_AFTER_SECONDS;
  const recoveryConcurrentClaimCap = deps.recoveryConcurrentClaimCap ?? 1;

  let state: CaioAuditGateState = "NORMAL";
  let recoveryClaimsInFlight = 0;

  function refuseUnavailable(): CaioAuditClaimResult {
    return {
      allowed: false,
      reason: "audit_unavailable",
      errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
      httpStatus: CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
      retryAfterSeconds,
    };
  }

  async function persistToPrimary(
    receipt: CaioMinimalAuditReceipt,
  ): Promise<CaioAuditClaimResult> {
    const result = await deps.primaryStore.persist({
      receipt,
      persistedVia: "primary",
      now: now(),
    });
    if (result.outcome === "conflict") {
      return {
        allowed: false,
        reason: "receipt_conflict",
        errorCode: "caio_audit_receipt_conflict",
        httpStatus: 409,
      };
    }
    return {
      allowed: true,
      receiptId: result.receiptId,
      persistedVia: "primary",
    };
  }

  async function fallBackToQueue(
    receipt: CaioMinimalAuditReceipt,
  ): Promise<CaioAuditClaimResult> {
    try {
      const appended = await deps.emergencyQueue.append({
        entryId: computeEmergencyEntryId(receipt),
        receipt,
      });
      state = "PRIMARY_DEGRADED";
      return {
        allowed: true,
        receiptId: appended.entryId,
        persistedVia: "emergency_queue",
      };
    } catch {
      // Queue full, key unavailable, or integrity violation: fail closed.
      state = "AUDIT_UNAVAILABLE";
      return refuseUnavailable();
    }
  }

  return {
    async claimDispatch(candidate) {
      const receipt = caioMinimalAuditReceiptSchema.parse(candidate);

      if (state === "RECOVERING") {
        if (recoveryClaimsInFlight >= recoveryConcurrentClaimCap) {
          return {
            allowed: false,
            reason: "recovery_rate_limited",
            errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
            httpStatus: CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
            retryAfterSeconds,
          };
        }
        recoveryClaimsInFlight += 1;
        try {
          try {
            return await persistToPrimary(receipt);
          } catch {
            return await fallBackToQueue(receipt);
          }
        } finally {
          recoveryClaimsInFlight -= 1;
        }
      }

      try {
        const result = await persistToPrimary(receipt);
        if (result.allowed && state === "PRIMARY_DEGRADED") {
          // Primary is back, but queued entries still await replay.
          const backlog = await deps.emergencyQueue.size().catch(() => 1);
          if (backlog === 0) {
            state = "NORMAL";
          }
        } else if (result.allowed && state === "AUDIT_UNAVAILABLE") {
          state = "NORMAL";
        }
        return result;
      } catch {
        return await fallBackToQueue(receipt);
      }
    },

    async recover() {
      state = "RECOVERING";
      let replayed = 0;
      let conflicts = 0;
      let entries;
      try {
        entries = await deps.emergencyQueue.list();
      } catch {
        state = "AUDIT_UNAVAILABLE";
        return { replayed: 0, remaining: -1, conflicts: 0 };
      }
      for (const entry of entries) {
        let result;
        try {
          result = await deps.primaryStore.persist({
            receipt: entry.receipt,
            persistedVia: "emergency_replay",
            now: now(),
          });
        } catch {
          // Primary failed midway: keep this and all later entries intact.
          state = "PRIMARY_DEGRADED";
          const remaining = await deps.emergencyQueue.size().catch(() => -1);
          return { replayed, remaining, conflicts };
        }
        if (result.outcome === "conflict") {
          // Divergent primary content for this requestId: keep the entry as
          // evidence, surface via the conflicts counter, do not delete.
          conflicts += 1;
          continue;
        }
        // Delete ONLY after the primary store confirmed the write. A crash
        // between persist and remove is safe: replay is idempotent by the
        // unique [workspace, requestId] key ("replayed" outcome).
        await deps.emergencyQueue.remove(entry.entryId);
        replayed += 1;
      }
      const remaining = await deps.emergencyQueue.size().catch(() => -1);
      state = remaining === 0 ? "NORMAL" : "PRIMARY_DEGRADED";
      return { replayed, remaining, conflicts };
    },

    getState() {
      return state;
    },

    async getReadiness() {
      switch (state) {
        case "NORMAL":
          return "ready";
        case "PRIMARY_DEGRADED":
          return "degraded";
        case "AUDIT_UNAVAILABLE":
          return "unavailable";
        case "RECOVERING":
          return "recovering";
      }
    },
  };
}
