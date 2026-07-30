// CAIO audit state — admission WITHOUT the primary store, as a strategy.
//
// WHY THIS FILE EXISTS
// The owner ruling of 2026-07-30 ships two deployment postures. Only one of
// them may admit a dispatch when the primary audit store cannot take the
// receipt:
//
//   self_service  → the encrypted emergency queue takes the receipt and the
//                   request proceeds (availability first).
//   governed_fde  → nothing takes the receipt and the request is refused
//                   (safety first).
//
// The ruling requires the degraded path to be UNREACHABLE IN CODE under
// governed_fde, not merely disabled by configuration — "配置能被改，代码路径不
// 存在才是保证". So the choice is made ONCE, at construction, by picking one of
// two strategy objects, and never re-decided at admission time:
//
//   * createCaioEmergencyQueueAdmission(queue) holds the queue.
//   * createCaioNoDegradedAdmission() takes NO arguments, has no field that
//     could hold a queue, and its admitWithoutPrimary() is typed to return the
//     REFUSAL arm only — `admitted: true` is not in its return type, so no
//     amount of configuration (or of a JS caller lying about types) can make a
//     governed_fde install serve from a queue it never received.
//
// createCaioAuditGate() additionally types its governed_fde dependency arm with
// `emergencyQueue?: never`, so a queue cannot even be passed to that posture.

import {
  CaioAuditQueueAppendInProgressError,
  CaioAuditQueueContentConflictError,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import type { CaioDeploymentPosture } from "@/lib/caio-audit-state/deployment-posture";
import type { CaioEmergencyQueuePort } from "@/lib/caio-audit-state/emergency-queue";

/** A receipt became durable somewhere other than the primary store. */
export type CaioDegradedAdmissionAdmitted = Readonly<{
  admitted: true;
  entryId: string;
  /** True when an identical receipt was already durable under this identity. */
  deduplicated: boolean;
}>;

/**
 * Nothing durable was written.
 *
 *  conflict          — something durable exists under this identity with
 *                      DIFFERENT content (409-class; retrying cannot help).
 *  in_progress       — an exclusive reservation holds this identity and has
 *                      not sealed a receipt. The degraded store is healthy, so
 *                      the gate stays PRIMARY_DEGRADED; a retry may succeed.
 *  unavailable       — the degraded store itself could not write (full, key
 *                      unavailable, integrity violation). The gate escalates
 *                      to AUDIT_UNAVAILABLE.
 *  no_degraded_path  — this posture has no admission without the primary
 *                      store. Not an outage report about a queue: there is no
 *                      queue in the object graph at all.
 */
export type CaioDegradedAdmissionRefusal = Readonly<{
  admitted: false;
  reason: "conflict" | "in_progress" | "unavailable" | "no_degraded_path";
}>;

export type CaioDegradedAdmissionOutcome =
  | CaioDegradedAdmissionAdmitted
  | CaioDegradedAdmissionRefusal;

/**
 * self_service: a queue-backed degraded path. `backlog` is the same queue,
 * exposed for replay (recover()) and readiness.
 */
export type CaioSelfServiceDegradedAdmission = Readonly<{
  posture: Extract<CaioDeploymentPosture, "self_service">;
  admitWithoutPrimary(
    receipt: CaioMinimalAuditReceipt,
    entryId: string,
  ): Promise<CaioDegradedAdmissionOutcome>;
  backlog: CaioEmergencyQueuePort;
}>;

/**
 * governed_fde: NO degraded path. The return type of admitWithoutPrimary is
 * the refusal arm only, and `backlog` is the literal type `null`, so a caller
 * cannot list, drain, or write anything here.
 */
export type CaioGovernedFdeDegradedAdmission = Readonly<{
  posture: Extract<CaioDeploymentPosture, "governed_fde">;
  admitWithoutPrimary(
    receipt: CaioMinimalAuditReceipt,
    entryId: string,
  ): Promise<CaioDegradedAdmissionRefusal>;
  backlog: null;
}>;

export type CaioDegradedAdmission =
  | CaioSelfServiceDegradedAdmission
  | CaioGovernedFdeDegradedAdmission;

/**
 * self_service strategy. Failure taxonomy is preserved exactly as the audit
 * gate read it before this refactor:
 *   content conflict          → conflict (the queue is healthy, THIS receipt
 *                               diverges from the durable one)
 *   append in progress        → unavailable (an exclusive reservation holds the
 *                               id and nothing durable exists yet; retry may
 *                               succeed)
 *   full / key / integrity    → unavailable, and the caller escalates the gate
 *                               state to AUDIT_UNAVAILABLE
 */
export function createCaioEmergencyQueueAdmission(
  queue: CaioEmergencyQueuePort,
): CaioSelfServiceDegradedAdmission {
  return Object.freeze({
    posture: "self_service" as const,
    async admitWithoutPrimary(receipt, entryId) {
      try {
        const appended = await queue.append({ entryId, receipt });
        return Object.freeze({
          admitted: true as const,
          entryId: appended.entryId,
          deduplicated: appended.deduplicated,
        });
      } catch (error) {
        if (error instanceof CaioAuditQueueContentConflictError) {
          return Object.freeze({ admitted: false as const, reason: "conflict" as const });
        }
        if (error instanceof CaioAuditQueueAppendInProgressError) {
          return Object.freeze({
            admitted: false as const,
            reason: "in_progress" as const,
          });
        }
        return Object.freeze({
          admitted: false as const,
          reason: "unavailable" as const,
        });
      }
    },
    backlog: queue,
  });
}

/**
 * governed_fde strategy. Takes no dependency, holds no queue, and can only
 * refuse. This is the whole of the posture's degraded behaviour: when
 * governance (including the durable audit write that proves the dispatch was
 * recorded) cannot be verified, the request does not happen.
 */
export function createCaioNoDegradedAdmission(): CaioGovernedFdeDegradedAdmission {
  const refusal: CaioDegradedAdmissionRefusal = Object.freeze({
    admitted: false as const,
    reason: "no_degraded_path" as const,
  });
  return Object.freeze({
    posture: "governed_fde" as const,
    async admitWithoutPrimary() {
      return refusal;
    },
    backlog: null,
  });
}
