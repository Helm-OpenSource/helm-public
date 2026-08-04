import { createHash } from "node:crypto";

import {
  CAIO_AUDIT_CONFLICT_ERROR_CODE,
  CAIO_AUDIT_CONFLICT_HTTP_STATUS,
  CAIO_AUDIT_DEFAULT_REPLAY_DISPATCH_CAP,
  CAIO_AUDIT_DEFAULT_RETRY_AFTER_SECONDS,
  CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  CAIO_AUDIT_REPLAY_LIMIT_HTTP_STATUS,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
  CaioAuditStoreContractError,
  caioAuditPersistOutcomeSchema,
  caioMinimalAuditReceiptSchema,
  type CaioAuditGateReadiness,
  type CaioAuditGateState,
  type CaioAuditPersistOutcome,
  type CaioAuditPersistedVia,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import {
  createCaioEmergencyQueueAdmission,
  createCaioNoDegradedAdmission,
  type CaioDegradedAdmission,
} from "@/lib/caio-audit-state/degraded-admission";
import {
  CaioDeploymentPostureError,
  parseCaioDeploymentPosture,
  type CaioDeploymentPosture,
} from "@/lib/caio-audit-state/deployment-posture";
import type { CaioEmergencyQueuePort } from "@/lib/caio-audit-state/emergency-queue";
import {
  caioReplayMarkerRequestId,
  isCaioReplayMarkerRequestId,
} from "@/lib/caio-audit-state/receipt-linkage";

/**
 * Injectable primary audit store port. The Prisma-backed implementation lives
 * in prisma-audit-receipt-store.ts; unit tests inject an in-memory port.
 *
 * persist() MUST be durable before it resolves, and MUST resolve to one of the
 * three outcomes of CaioAuditPersistOutcome — the discriminated union is
 * validated at runtime (caioAuditPersistOutcomeSchema) because this port is a
 * public extension point that JS callers can implement without type checking.
 * Duplicate [workspace, requestId] with identical content resolves as
 * "replayed"; different content resolves as "conflict". Any thrown error, and
 * any result outside the union (including a success without a non-empty
 * receiptId), means the write did NOT durably happen.
 */
export interface CaioAuditPrimaryStorePort {
  persist(input: {
    receipt: CaioMinimalAuditReceipt;
    persistedVia: CaioAuditPersistedVia;
    now: Date;
  }): Promise<CaioAuditPersistOutcome>;
}

export type CaioAuditClaimRefusalReason =
  | "audit_unavailable"
  | "recovery_rate_limited"
  | "receipt_conflict"
  | "replay_limit_exceeded";

export type CaioAuditClaimResult =
  | {
      allowed: true;
      receiptId: string;
      persistedVia: "primary" | "emergency_queue";
      /**
       * 1 for the dispatch that created the receipt; N > 1 for the N-th repeat
       * dispatch of the same [workspace, requestId], each of which is durably
       * recorded as a linked replay marker.
       */
      dispatchAttempt: number;
      /** Receipt id of the linked replay marker, when dispatchAttempt > 1. */
      replayMarkerReceiptId?: string;
    }
  | {
      allowed: false;
      reason: CaioAuditClaimRefusalReason;
      errorCode:
        | typeof CAIO_AUDIT_UNAVAILABLE_ERROR_CODE
        | typeof CAIO_AUDIT_CONFLICT_ERROR_CODE
        | typeof CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE;
      httpStatus: number;
      /**
       * Always present. `null` means "retrying cannot help" (conflict, replay
       * cap) so a caller never emits a `Retry-After: undefined` header.
       */
      retryAfterSeconds: number | null;
    };

export interface CaioAuditGate {
  /**
   * The declared deployment posture of THIS gate. Callers (the model proxy,
   * the canonical port, the readiness surface) read it rather than declaring
   * one of their own, so a process cannot report one posture while admitting
   * under the rules of the other.
   */
  readonly posture: CaioDeploymentPosture;
  /**
   * The receipt is stamped with this gate's posture before it is persisted;
   * a candidate that already carries a DIFFERENT posture is refused (thrown),
   * never rewritten. A receipt therefore always names the installation that
   * produced it.
   */
  claimDispatch(
    receipt: CaioAuditClaimCandidate,
  ): Promise<CaioAuditClaimResult>;
  recover(): Promise<{
    replayed: number;
    remaining: number;
    conflicts: number;
  }>;
  getState(): CaioAuditGateState;
  getReadiness(): Promise<CaioAuditGateReadiness>;
}

/**
 * What a caller may hand to claimDispatch: the receipt WITHOUT its posture
 * (the gate stamps its own), or a full receipt whose posture must already
 * equal the gate's. There is no way for a caller to choose a posture the gate
 * was not constructed with.
 */
export type CaioAuditClaimCandidate =
  | Omit<CaioMinimalAuditReceipt, "posture">
  | CaioMinimalAuditReceipt;

/**
 * Raised when a claim carries a posture other than the gate's own. Fail
 * closed: the dispatch is not recorded and not allowed, because a receipt
 * written under the wrong posture would let one deployment shape impersonate
 * the other.
 */
export class CaioAuditPostureMismatchError extends Error {
  readonly code = "caio_audit_posture_mismatch";

  constructor(detail: string) {
    super(`caio_audit_posture_mismatch: ${detail}`);
    this.name = "CaioAuditPostureMismatchError";
  }
}

/**
 * Deterministic queue entry id derived from the receipt identity.
 *
 * Components are length-prefixed, so no value of workspace/requestId (control
 * characters included) can shift a byte across the boundary and collide with a
 * different identity.
 */
export function computeEmergencyEntryId(
  receipt: Pick<CaioMinimalAuditReceipt, "workspace" | "requestId">,
): string {
  const encoded = [receipt.workspace, receipt.requestId]
    .map((part) => `${Buffer.byteLength(part, "utf8")}:${part}`)
    .join("");
  return createHash("sha256").update(encoded, "utf8").digest("hex").slice(0, 48);
}

/**
 * A self-service gate without a queue would silently behave like a governed
 * one (refuse instead of degrade), which is exactly the impersonation the
 * ruling forbids — so the omission fails construction instead.
 */
function requireEmergencyQueue(
  deps: CaioAuditGateDependencies,
): CaioEmergencyQueuePort {
  const queue = (deps as { emergencyQueue?: CaioEmergencyQueuePort })
    .emergencyQueue;
  if (queue === undefined || queue === null) {
    throw new CaioDeploymentPostureError(
      "self_service posture requires an emergency queue",
    );
  }
  return queue;
}

/** Normalized result of one durable-write attempt for one receipt. */
type ReceiptWrite =
  | { kind: "fresh"; receiptId: string; via: "primary" | "emergency_queue" }
  | { kind: "duplicate"; receiptId: string; via: "primary" | "emergency_queue" }
  | { kind: "conflict" }
  | { kind: "refused"; result: CaioAuditClaimResult };

type CaioAuditGateCommonDependencies = {
  primaryStore: CaioAuditPrimaryStorePort;
  now?: () => Date;
  retryAfterSeconds?: number;
  recoveryConcurrentClaimCap?: number;
  /**
   * Maximum repeat dispatches recorded against one receipt before claims for it
   * are refused. Each permitted replay writes its own durable marker.
   */
  replayDispatchCap?: number;
  /**
   * Observed health of the primary store. NORMAL/"ready" requires a healthy
   * primary, never merely an empty queue: without a probe the gate falls back
   * to the last observed store answer (a store that threw is not healthy).
   */
  primaryHealthProbe?: () => Promise<boolean>;
};

/**
 * Gate dependencies, discriminated by the DECLARED deployment posture.
 *
 * `posture` is required: there is no default, and it is never read from the
 * environment or from a request. The two arms differ in one structural way —
 * the governed_fde arm types `emergencyQueue` as `never`, so a queue cannot be
 * handed to it at all. That, plus the queue-free admission strategy the
 * constructor selects, is why the degraded-admission path is unreachable in
 * that posture rather than merely switched off.
 */
export type CaioAuditGateDependencies =
  | (CaioAuditGateCommonDependencies & {
      posture: Extract<CaioDeploymentPosture, "self_service">;
      emergencyQueue: CaioEmergencyQueuePort;
    })
  | (CaioAuditGateCommonDependencies & {
      posture: Extract<CaioDeploymentPosture, "governed_fde">;
      /** No degraded store exists in this posture; passing one is a type error. */
      emergencyQueue?: never;
    });

/**
 * Audit-gated dispatch state machine.
 *
 * Contract: `allowed: true` is only ever returned AFTER a durable audit write
 * (primary store fsync-equivalent commit, or fsync'd emergency-queue entry)
 * whose content matches the claim, and always with a non-empty receipt id.
 * When neither store can persist, the claim is refused and the caller MUST
 * map the refusal to its declared httpStatus (503 caio_audit_unavailable with
 * Retry-After, 409 caio_audit_receipt_conflict, 429 replay cap) and MUST NOT
 * dispatch upstream. There is no code path that allows dispatch before
 * persistence succeeds, including the emergency-queue and replay paths.
 *
 * POSTURE: `self_service` keeps the emergency-queue arm described above;
 * `governed_fde` is built with a queue-free admission strategy, so a failed
 * primary write can only end in a refusal — the degraded arm is absent from
 * this gate's object graph rather than switched off inside it.
 */
export function createCaioAuditGate(
  deps: CaioAuditGateDependencies,
): CaioAuditGate {
  // Construction-time, fail-closed: an undeclared or unparseable posture is a
  // configuration error, never an implicit choice of the permissive posture.
  const posture = parseCaioDeploymentPosture(
    (deps as { posture?: unknown }).posture,
  );
  // ONE decision, made here and never re-made at admission time. After this
  // line the governed_fde gate holds no reference to any queue.
  const admission: CaioDegradedAdmission =
    posture === "self_service"
      ? createCaioEmergencyQueueAdmission(requireEmergencyQueue(deps))
      : createCaioNoDegradedAdmission();
  const now = deps.now ?? (() => new Date());
  const retryAfterSeconds =
    deps.retryAfterSeconds ?? CAIO_AUDIT_DEFAULT_RETRY_AFTER_SECONDS;
  const recoveryConcurrentClaimCap = deps.recoveryConcurrentClaimCap ?? 1;
  const replayDispatchCap =
    deps.replayDispatchCap ?? CAIO_AUDIT_DEFAULT_REPLAY_DISPATCH_CAP;

  let state: CaioAuditGateState = "NORMAL";
  let recoveryClaimsInFlight = 0;
  /** True while recover() is walking the queue. */
  let replayInProgress = false;
  /**
   * True from the start of a recovery until one completes with an empty queue
   * AND a healthy primary. The admission cap is gated on this, not on the state
   * enum, so a claim that degrades to the queue mid-replay can no longer
   * dissolve the cap by moving the state to PRIMARY_DEGRADED.
   */
  let recoveryCapActive = false;
  /** Last observed answer from the primary store; a throw clears it. */
  let primaryConfirmedHealthy = true;

  function refuseUnavailable(): CaioAuditClaimResult {
    return {
      allowed: false,
      reason: "audit_unavailable",
      errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
      httpStatus: CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
      retryAfterSeconds,
    };
  }

  function refuseRecoveryRateLimited(): CaioAuditClaimResult {
    return {
      allowed: false,
      reason: "recovery_rate_limited",
      errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
      httpStatus: CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
      retryAfterSeconds,
    };
  }

  function refuseConflict(): CaioAuditClaimResult {
    return {
      allowed: false,
      reason: "receipt_conflict",
      errorCode: CAIO_AUDIT_CONFLICT_ERROR_CODE,
      httpStatus: CAIO_AUDIT_CONFLICT_HTTP_STATUS,
      retryAfterSeconds: null,
    };
  }

  function refuseReplayLimit(): CaioAuditClaimResult {
    return {
      allowed: false,
      reason: "replay_limit_exceeded",
      errorCode: CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
      httpStatus: CAIO_AUDIT_REPLAY_LIMIT_HTTP_STATUS,
      retryAfterSeconds: null,
    };
  }

  /**
   * State transitions requested by a claim. Suppressed while a replay is in
   * flight: recover() owns the state machine for the duration of the walk.
   */
  function transitionFromClaim(next: CaioAuditGateState): void {
    if (replayInProgress) return;
    state = next;
  }

  async function isPrimaryHealthy(): Promise<boolean> {
    if (deps.primaryHealthProbe) {
      try {
        return (await deps.primaryHealthProbe()) === true;
      } catch {
        return false;
      }
    }
    return primaryConfirmedHealthy;
  }

  /**
   * One primary-store write. Throws CaioAuditStoreContractError when the port
   * answers outside its declared union — the write cannot be assumed durable.
   */
  async function writePrimary(
    receipt: CaioMinimalAuditReceipt,
    persistedVia: CaioAuditPersistedVia,
  ): Promise<CaioAuditPersistOutcome> {
    const raw = await deps.primaryStore.persist({
      receipt,
      persistedVia,
      now: now(),
    });
    const parsed = caioAuditPersistOutcomeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new CaioAuditStoreContractError(
        `primary store returned an unusable outcome for ${receipt.requestId}`,
      );
    }
    // The store answered within its contract: it is reachable and healthy.
    primaryConfirmedHealthy = true;
    return parsed.data;
  }

  /**
   * The primary store could not take this receipt. What happens next is the
   * POSTURE's answer, delegated to the admission strategy chosen at
   * construction:
   *   self_service → the encrypted queue takes it and the dispatch proceeds
   *   governed_fde → `no_degraded_path`; nothing is written and the claim is
   *                  refused. That strategy holds no queue, so this function
   *                  cannot reach one.
   */
  async function admitWithoutPrimary(
    receipt: CaioMinimalAuditReceipt,
  ): Promise<ReceiptWrite> {
    const outcome = await admission.admitWithoutPrimary(
      receipt,
      computeEmergencyEntryId(receipt),
    );
    if (outcome.admitted) {
      transitionFromClaim("PRIMARY_DEGRADED");
      return {
        kind: outcome.deduplicated ? "duplicate" : "fresh",
        receiptId: outcome.entryId,
        via: "emergency_queue",
      };
    }
    switch (outcome.reason) {
      case "conflict":
        // The degraded store is healthy; THIS receipt diverges from the
        // durable one.
        transitionFromClaim("PRIMARY_DEGRADED");
        return { kind: "conflict" };
      case "in_progress":
        // An exclusive reservation holds the id and has not sealed a receipt:
        // nothing durable exists for this claim, so refuse. A retry may succeed.
        transitionFromClaim("PRIMARY_DEGRADED");
        return { kind: "refused", result: refuseUnavailable() };
      case "unavailable":
      case "no_degraded_path":
        // Either the degraded store failed (full, key, integrity), or this
        // posture has none. Both mean: nothing durable, no dispatch.
        transitionFromClaim("AUDIT_UNAVAILABLE");
        return { kind: "refused", result: refuseUnavailable() };
      default: {
        const unexpected: never = outcome.reason;
        void unexpected;
        transitionFromClaim("AUDIT_UNAVAILABLE");
        return { kind: "refused", result: refuseUnavailable() };
      }
    }
  }

  /**
   * Entries awaiting replay into the primary store. A posture with no degraded
   * store has no backlog by construction (`backlog: null`), so it answers 0/[]
   * rather than probing a queue it does not have.
   */
  async function backlogSize(unknownAs: number): Promise<number> {
    const backlog = admission.backlog;
    if (backlog === null) return 0;
    return await backlog.size().catch(() => unknownAs);
  }

  /** Durably record exactly one receipt: primary first, degraded path second. */
  async function persistReceipt(
    receipt: CaioMinimalAuditReceipt,
  ): Promise<ReceiptWrite> {
    let outcome: CaioAuditPersistOutcome;
    try {
      outcome = await writePrimary(receipt, "primary");
    } catch (error) {
      if (error instanceof CaioAuditStoreContractError) {
        // A store that misreports its own writes is a fault we must not mask
        // behind the emergency queue: refuse and surface it.
        primaryConfirmedHealthy = false;
        transitionFromClaim("AUDIT_UNAVAILABLE");
        return { kind: "refused", result: refuseUnavailable() };
      }
      primaryConfirmedHealthy = false;
      return await admitWithoutPrimary(receipt);
    }

    switch (outcome.outcome) {
      case "conflict":
        return { kind: "conflict" };
      case "persisted":
      case "replayed": {
        if (state === "PRIMARY_DEGRADED") {
          // Primary is back; queued entries may still await replay.
          const backlog = await backlogSize(1);
          if (backlog === 0) {
            transitionFromClaim("NORMAL");
            if (!replayInProgress) recoveryCapActive = false;
          }
        } else if (state === "AUDIT_UNAVAILABLE") {
          transitionFromClaim("NORMAL");
          if (!replayInProgress) recoveryCapActive = false;
        }
        return {
          kind: outcome.outcome === "persisted" ? "fresh" : "duplicate",
          receiptId: outcome.receiptId,
          via: "primary",
        };
      }
      default: {
        // Exhaustiveness: the union above is closed, so this is unreachable.
        const unexpected: never = outcome;
        throw new CaioAuditStoreContractError(
          `unhandled primary store outcome ${JSON.stringify(unexpected)}`,
        );
      }
    }
  }

  async function claimCore(
    receipt: CaioMinimalAuditReceipt,
  ): Promise<CaioAuditClaimResult> {
    const first = await persistReceipt(receipt);
    if (first.kind === "refused") return first.result;
    if (first.kind === "conflict") return refuseConflict();
    if (first.kind === "fresh") {
      return {
        allowed: true,
        receiptId: first.receiptId,
        persistedVia: first.via,
        dispatchAttempt: 1,
      };
    }

    // Duplicate: this is a REPEAT dispatch of an already-recorded receipt.
    // Idempotency is preserved (the receipt is not duplicated) but the extra
    // dispatch must not be invisible, so it gets its own durable linked marker,
    // and the number of markers per receipt is capped.
    const originalReceiptId = first.receiptId;
    for (let attempt = 2; attempt <= replayDispatchCap + 1; attempt += 1) {
      const marker: CaioMinimalAuditReceipt = {
        ...receipt,
        requestId: caioReplayMarkerRequestId(receipt.requestId, attempt),
      };
      const write = await persistReceipt(marker);
      if (write.kind === "refused") return write.result;
      if (write.kind === "conflict") return refuseConflict();
      if (write.kind === "fresh") {
        return {
          allowed: true,
          receiptId: originalReceiptId,
          persistedVia: write.via,
          dispatchAttempt: attempt,
          replayMarkerReceiptId: write.receiptId,
        };
      }
      // This attempt ordinal is already recorded: try the next one.
    }
    return refuseReplayLimit();
  }

  return {
    posture,

    async claimDispatch(candidate) {
      // The gate STAMPS its own posture. A candidate that already names one
      // must name THIS one: a receipt written under the other posture would
      // let a self-service install pass its receipts off as governed ones (or
      // the reverse), which is precisely what the ruling forbids.
      const declared = (candidate as { posture?: unknown }).posture;
      if (declared !== undefined && declared !== posture) {
        throw new CaioAuditPostureMismatchError(
          `gate posture is ${posture}; the claim named a different one`,
        );
      }
      const receipt = caioMinimalAuditReceiptSchema.parse({
        ...candidate,
        posture,
      });
      if (isCaioReplayMarkerRequestId(receipt.requestId)) {
        // The replay-marker namespace is minted by this gate only; a caller
        // supplying one would corrupt replay accounting.
        throw new Error(
          "caio_audit_reserved_request_id: requestId must not use the replay marker namespace",
        );
      }

      // Admission control during (and after an incomplete) recovery.
      if (replayInProgress || recoveryCapActive) {
        if (recoveryClaimsInFlight >= recoveryConcurrentClaimCap) {
          return refuseRecoveryRateLimited();
        }
        recoveryClaimsInFlight += 1;
        try {
          return await claimCore(receipt);
        } finally {
          recoveryClaimsInFlight -= 1;
        }
      }
      return await claimCore(receipt);
    },

    async recover() {
      // Nothing can ever be pending in a posture with no degraded store, so
      // recovery is a no-op there rather than a walk over a queue that does
      // not exist.
      const pending = admission.backlog;
      if (pending === null) {
        return { replayed: 0, remaining: 0, conflicts: 0 };
      }
      const stateBeforeRecovery = state;
      replayInProgress = true;
      recoveryCapActive = true;
      state = "RECOVERING";
      let replayed = 0;
      let conflicts = 0;
      try {
        let entries;
        try {
          entries = await pending.list();
        } catch {
          state = "AUDIT_UNAVAILABLE";
          return { replayed: 0, remaining: -1, conflicts: 0 };
        }
        for (const entry of entries) {
          let outcome: CaioAuditPersistOutcome;
          try {
            outcome = await writePrimary(entry.receipt, "emergency_replay");
          } catch {
            // Primary failed midway: keep this and all later entries intact,
            // and leave the admission cap armed — the replay is not complete.
            primaryConfirmedHealthy = false;
            state = "PRIMARY_DEGRADED";
            const remaining = await pending.size().catch(() => -1);
            return { replayed, remaining, conflicts };
          }
          if (outcome.outcome === "conflict") {
            // Divergent primary content for this requestId: keep the entry as
            // evidence, surface via the conflicts counter, do not delete.
            conflicts += 1;
            continue;
          }
          // Delete ONLY after the primary store confirmed the write. A crash
          // between persist and remove is safe: replay is idempotent by the
          // unique [workspace, requestId] key ("replayed" outcome).
          await pending.remove(entry.entryId);
          replayed += 1;
        }
        const remaining = await pending.size().catch(() => -1);
        const healthy = await isPrimaryHealthy();
        if (remaining === 0 && conflicts === 0 && healthy) {
          // Only a drained queue AND a confirmed-healthy primary end recovery.
          state = "NORMAL";
          recoveryCapActive = false;
        } else if (
          !healthy &&
          remaining !== 0 &&
          stateBeforeRecovery === "AUDIT_UNAVAILABLE"
        ) {
          // Nothing can be persisted and the backlog stands: stay unavailable
          // instead of advertising a write path that does not exist.
          state = "AUDIT_UNAVAILABLE";
        } else {
          state = "PRIMARY_DEGRADED";
        }
        return { replayed, remaining, conflicts };
      } finally {
        replayInProgress = false;
      }
    },

    getState() {
      return state;
    },

    async getReadiness() {
      if (state === "AUDIT_UNAVAILABLE") return "unavailable";
      if (state === "RECOVERING" || replayInProgress) return "recovering";
      if (state === "PRIMARY_DEGRADED") return "degraded";
      // NORMAL is only "ready" while the primary is observed healthy and the
      // emergency queue is drained; a stale transition can never claim ready.
      if (!(await isPrimaryHealthy())) return "degraded";
      const backlog = await backlogSize(1);
      return backlog === 0 ? "ready" : "degraded";
    },
  };
}
