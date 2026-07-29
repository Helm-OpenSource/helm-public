import { z } from "zod";

/**
 * Audit-gated dispatch state machine states.
 *
 * NORMAL           — primary audit store is durable; every dispatch is
 *                    persisted to the primary store before it is allowed.
 * PRIMARY_DEGRADED — primary store writes are failing; receipts are being
 *                    persisted to the encrypted emergency queue instead.
 * AUDIT_UNAVAILABLE— neither the primary store nor the emergency queue can
 *                    durably persist a receipt; all dispatch is refused
 *                    (503 caio_audit_unavailable). No upstream dispatch may
 *                    happen while in this state.
 * RECOVERING       — emergency queue entries are being replayed into the
 *                    primary store; new claims are rate limited.
 */
export const CAIO_AUDIT_GATE_STATES = [
  "NORMAL",
  "PRIMARY_DEGRADED",
  "AUDIT_UNAVAILABLE",
  "RECOVERING",
] as const;

export const caioAuditGateStateSchema = z.enum(CAIO_AUDIT_GATE_STATES);
export type CaioAuditGateState = z.infer<typeof caioAuditGateStateSchema>;

export const CAIO_AUDIT_GATE_READINESS = [
  "ready",
  "degraded",
  "unavailable",
  "recovering",
] as const;
export type CaioAuditGateReadiness =
  (typeof CAIO_AUDIT_GATE_READINESS)[number];

/**
 * Minimal audit dispatch receipt.
 *
 * This is the ONLY payload the audit state machine is allowed to persist —
 * to the primary store or to the encrypted emergency queue. It carries
 * request identity and policy binding, never prompt/response bodies.
 * `.strict()`: any extra key (e.g. "prompt", "body", "messages") is rejected
 * so raw model traffic can never leak into audit persistence.
 */
export const caioMinimalAuditReceiptSchema = z
  .object({
    requestId: z.string().min(1).max(200),
    client: z.string().min(1).max(200),
    workspace: z.string().min(1).max(200),
    modelAlias: z.string().min(1).max(200),
    inputHash: z.string().regex(/^(?:sha256:)?[a-f0-9]{64}$/),
    policyVersion: z.string().min(1).max(200),
  })
  .strict();

export type CaioMinimalAuditReceipt = z.infer<
  typeof caioMinimalAuditReceiptSchema
>;

/** How a receipt reached the primary store. Mirrors CaioAuditDispatchReceipt.persistedVia. */
export const CAIO_AUDIT_PERSISTED_VIA = ["primary", "emergency_replay"] as const;
export type CaioAuditPersistedVia = (typeof CAIO_AUDIT_PERSISTED_VIA)[number];

/**
 * Error contract for refused dispatch: callers must map a refused claim to
 * HTTP 503 with this machine-readable error code and a Retry-After header.
 * While the gate reports this error, NO upstream model dispatch may happen —
 * allowed:true is only ever returned after a durable audit write.
 */
export const CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS = 503;
export const CAIO_AUDIT_UNAVAILABLE_ERROR_CODE = "caio_audit_unavailable";
export const CAIO_AUDIT_RETRY_AFTER_HEADER = "Retry-After";
export const CAIO_AUDIT_DEFAULT_RETRY_AFTER_SECONDS = 30;

/** Typed error raised when the emergency-queue encryption key cannot be obtained. */
export class CaioAuditQueueKeyUnavailableError extends Error {
  readonly code = "caio_audit_queue_key_unavailable";

  constructor(detail: string) {
    super(`caio_audit_queue_key_unavailable: ${detail}`);
    this.name = "CaioAuditQueueKeyUnavailableError";
  }
}

/** Typed error raised when the queue root or an entry violates the directory contract. */
export class CaioAuditQueueIntegrityError extends Error {
  readonly code = "caio_audit_queue_integrity_violation";

  constructor(detail: string) {
    super(`caio_audit_queue_integrity_violation: ${detail}`);
    this.name = "CaioAuditQueueIntegrityError";
  }
}

/** Typed error raised when the emergency queue is at its maxEntries cap. */
export class CaioAuditQueueFullError extends Error {
  readonly code = "caio_audit_queue_full";

  constructor(detail: string) {
    super(`caio_audit_queue_full: ${detail}`);
    this.name = "CaioAuditQueueFullError";
  }
}

/** Entry ids must be flat, lowercase, and unable to traverse paths. */
export const CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN = /^[a-z0-9-]{8,64}$/;
