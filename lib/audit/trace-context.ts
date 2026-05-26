import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type AuditTraceContext = {
  /** Long-lived correlation ID that spans an entire user-facing request chain. */
  traceId: string;
  /** Per-request ID (one per inbound HTTP request / server action). */
  requestId: string;
  /** Optional parent event ID for nested operations. */
  parentEventId?: string | null;
};

const auditTraceStorage = new AsyncLocalStorage<AuditTraceContext>();

/**
 * Returns the AsyncLocalStorage handle. Exported only for the request
 * middleware so it can call `.run()` directly; production callers should
 * prefer {@link runWithAuditTraceContext} or read via {@link getCurrentAuditTraceContext}.
 */
export function getAuditTraceStorage(): AsyncLocalStorage<AuditTraceContext> {
  return auditTraceStorage;
}

/**
 * Returns the trace context for the currently executing request, or
 * `undefined` when called outside any request scope (e.g. background
 * jobs that have not been wrapped). `writeAuditLog` falls back gracefully
 * to `undefined` for each field, so callers without a context still
 * succeed — they just write a row without correlation IDs.
 */
export function getCurrentAuditTraceContext(): AuditTraceContext | undefined {
  return auditTraceStorage.getStore();
}

/**
 * Runs `fn` within a fresh trace scope. Use this for background workers,
 * scheduled jobs, and tests that want every nested `writeAuditLog` to
 * inherit the same correlation IDs without threading them by hand.
 */
export function runWithAuditTraceContext<T>(
  context: Partial<AuditTraceContext> & { traceId?: string; requestId?: string },
  fn: () => T,
): T {
  const resolved: AuditTraceContext = {
    traceId: context.traceId ?? randomUUID(),
    requestId: context.requestId ?? randomUUID(),
    parentEventId: context.parentEventId ?? null,
  };
  return auditTraceStorage.run(resolved, fn);
}

/**
 * Generates a fresh trace context for a top-level entry point (HTTP
 * middleware, cron driver, CLI script). The `traceId` is reused across
 * downstream calls when the caller threads the value back in via
 * {@link runWithAuditTraceContext}.
 */
export function createAuditTraceContext(
  overrides: Partial<AuditTraceContext> = {},
): AuditTraceContext {
  return {
    traceId: overrides.traceId ?? randomUUID(),
    requestId: overrides.requestId ?? randomUUID(),
    parentEventId: overrides.parentEventId ?? null,
  };
}
