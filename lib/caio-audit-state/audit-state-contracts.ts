import { createHash } from "node:crypto";

import { z } from "zod";

/**
 * Audit-gated dispatch state machine states.
 *
 * NORMAL           — primary audit store is durable and confirmed healthy;
 *                    every dispatch is persisted to the primary store before
 *                    it is allowed. A repeat dispatch of an already-recorded
 *                    [workspace, requestId] does not duplicate the receipt: it
 *                    is recorded as a linked replay marker (see
 *                    receipt-linkage.ts) so no dispatch is ever invisible.
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

/**
 * Canonical, order-independent serialization of a minimal receipt.
 *
 * Positional encoding (not object key order) so two receipts with the same
 * values always produce the same bytes regardless of how they were built. This
 * is the digest input used to decide whether a duplicate audit record carries
 * identical content or is a divergent receipt that must be refused.
 */
export function canonicalCaioReceiptPayload(
  receipt: CaioMinimalAuditReceipt,
): string {
  return JSON.stringify([
    receipt.requestId,
    receipt.client,
    receipt.workspace,
    receipt.modelAlias,
    receipt.inputHash,
    receipt.policyVersion,
  ]);
}

/** Content digest of a minimal receipt; binds content to a stored entry. */
export function caioReceiptDigest(receipt: CaioMinimalAuditReceipt): string {
  return createHash("sha256")
    .update(canonicalCaioReceiptPayload(receipt), "utf8")
    .digest("hex");
}

/** How a receipt reached the primary store. Mirrors CaioAuditDispatchReceipt.persistedVia. */
export const CAIO_AUDIT_PERSISTED_VIA = ["primary", "emergency_replay"] as const;
export type CaioAuditPersistedVia = (typeof CAIO_AUDIT_PERSISTED_VIA)[number];

/**
 * Primary-store persist outcome, as a closed discriminated union.
 *
 * The schema exists because CaioAuditPrimaryStorePort is a public, injectable
 * extension point: TypeScript alone cannot stop an implementation (or a JS
 * caller) from returning `{outcome: "skipped"}` or a success without a receipt
 * id. Anything that does not parse here is treated as "the write did not
 * happen" and fails the claim closed — never as an allowed dispatch.
 */
export const caioAuditPersistOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("persisted"),
    receiptId: z.string().min(1),
  }),
  z.object({
    outcome: z.literal("replayed"),
    receiptId: z.string().min(1),
  }),
  z.object({ outcome: z.literal("conflict") }),
]);

export type CaioAuditPersistOutcome = z.infer<
  typeof caioAuditPersistOutcomeSchema
>;

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

/**
 * Receipt conflict contract: the same [workspace, requestId] already carries a
 * DIFFERENT durable receipt. This is not an outage and retrying cannot help, so
 * it maps to 409 and carries an explicitly null Retry-After (never undefined).
 */
export const CAIO_AUDIT_CONFLICT_HTTP_STATUS = 409;
export const CAIO_AUDIT_CONFLICT_ERROR_CODE = "caio_audit_receipt_conflict";

/**
 * Replay bound contract: a single receipt may cover at most
 * `replayDispatchCap` repeat dispatches (each one durably recorded as a linked
 * marker). Beyond that the claim is refused so a client cannot dispatch
 * unbounded traffic under one audit identity.
 */
export const CAIO_AUDIT_REPLAY_LIMIT_HTTP_STATUS = 429;
export const CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE =
  "caio_audit_replay_limit_exceeded";
export const CAIO_AUDIT_DEFAULT_REPLAY_DISPATCH_CAP = 8;

/** Typed error raised when the emergency-queue encryption key cannot be obtained. */
export class CaioAuditQueueKeyUnavailableError extends Error {
  readonly code = "caio_audit_queue_key_unavailable";

  constructor(detail: string) {
    super(`caio_audit_queue_key_unavailable: ${detail}`);
    this.name = "CaioAuditQueueKeyUnavailableError";
  }
}

/**
 * Typed error raised when the queue root or an entry violates the directory
 * contract. `code` is declared as `string` (not a literal) because the two
 * subclasses below narrow the failure while staying instanceof-compatible with
 * every existing fail-closed handler.
 */
export class CaioAuditQueueIntegrityError extends Error {
  readonly code: string = "caio_audit_queue_integrity_violation";

  constructor(detail: string) {
    super(`caio_audit_queue_integrity_violation: ${detail}`);
    this.name = "CaioAuditQueueIntegrityError";
  }
}

/**
 * Typed error raised when an entry id already holds a receipt with DIFFERENT
 * content. Extends the integrity error so existing generic handlers keep
 * failing closed, while the gate can map it to the non-retryable 409 conflict
 * refusal instead of claiming the audit subsystem is unavailable.
 */
export class CaioAuditQueueContentConflictError extends CaioAuditQueueIntegrityError {
  override readonly code = "caio_audit_queue_content_conflict";

  constructor(detail: string) {
    super(detail);
    this.message = `caio_audit_queue_content_conflict: ${detail}`;
    this.name = "CaioAuditQueueContentConflictError";
  }
}

/**
 * Typed error raised when an entry id is held by an append that has not sealed
 * its entry yet (exclusive reservation). Nothing durable exists for that id, so
 * the claim must be refused; unlike a content conflict, a retry can succeed.
 */
export class CaioAuditQueueAppendInProgressError extends CaioAuditQueueIntegrityError {
  override readonly code = "caio_audit_queue_append_in_progress";

  constructor(detail: string) {
    super(detail);
    this.message = `caio_audit_queue_append_in_progress: ${detail}`;
    this.name = "CaioAuditQueueAppendInProgressError";
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

/**
 * Typed error raised when an injected primary store violates its port contract
 * (an outcome outside the closed union, or a success without a receipt id).
 * The write cannot be assumed to have happened, and the fault is a
 * configuration/implementation bug rather than a transient outage, so the claim
 * is refused outright instead of being masked by the emergency queue.
 */
export class CaioAuditStoreContractError extends Error {
  readonly code = "caio_audit_store_contract_violation";

  constructor(detail: string) {
    super(`caio_audit_store_contract_violation: ${detail}`);
    this.name = "CaioAuditStoreContractError";
  }
}

/** Entry ids must be flat, lowercase, and unable to traverse paths. */
export const CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN = /^[a-z0-9-]{8,64}$/;
