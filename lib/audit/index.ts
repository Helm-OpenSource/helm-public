import type { ActorType, Prisma } from "@prisma/client";
import { jsonStringify } from "@/lib/utils";
import {
  getCurrentAuditTraceContext,
  type AuditTraceContext,
} from "@/lib/audit/trace-context";

type AuditInput = {
  workspaceId: string;
  userId?: string | null;
  actor: string;
  actorType: ActorType;
  actionType: string;
  targetType: string;
  targetId: string;
  summary: string;
  payload?: unknown;
  sourcePage?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  /**
   * Optional explicit trace context. When omitted the helper falls back to
   * the request-scoped context populated by the middleware. Either form is
   * accepted; this keeps the README #5 promise ("complete audit chain with
   * trace ID") enforceable without forcing every existing caller to thread
   * trace state by hand.
   */
  trace?: Partial<AuditTraceContext> | null;
};

export async function writeAuditLog(
  input: AuditInput,
  options?: { client?: Prisma.TransactionClient },
) {
  const client = options?.client ?? (await import("@/lib/db")).db;
  const ambient = getCurrentAuditTraceContext();
  const trace = {
    traceId: input.trace?.traceId ?? ambient?.traceId ?? null,
    requestId: input.trace?.requestId ?? ambient?.requestId ?? null,
    parentEventId: input.trace?.parentEventId ?? ambient?.parentEventId ?? null,
  };
  return client.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? undefined,
      actor: input.actor,
      actorType: input.actorType,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      payload: input.payload ? jsonStringify(input.payload) : undefined,
      sourcePage: input.sourcePage ?? undefined,
      relatedObjectType: input.relatedObjectType ?? undefined,
      relatedObjectId: input.relatedObjectId ?? undefined,
      traceId: trace.traceId ?? undefined,
      requestId: trace.requestId ?? undefined,
      parentEventId: trace.parentEventId ?? undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Audit-write failure observability
// ---------------------------------------------------------------------------
//
// The README promises a complete audit chain with trace IDs. Historically
// many call sites wrapped writeAuditLog in `try { ... } catch { console.error
// (...) }`, which silently dropped audit rows on db failure (e.g. MySQL 1020
// write conflicts) and left no machine-readable signal that a row was lost.
//
// `recordAuditWriteFailure` is the single place where audit drops become
// observable: it emits a structured stderr line tagged with
// `helm.audit_write_failure`, increments a module-level counter that
// `getAuditWriteFailureSummary` can expose to /health and self-check, and
// returns. Business actions still complete - but the loss is no longer
// invisible.
//
// `safeWriteAuditLog` is the recommended replacement for the old
// try/catch+console.error pattern at call sites.

export type AuditWriteFailureRecord = {
  workspaceId: string;
  userId: string | null;
  actionType: string;
  targetType: string;
  targetId: string;
  failedAt: string;
  errorName: string;
  errorMessage: string;
  errorCode: string | null;
};

const AUDIT_WRITE_FAILURE_RING_LIMIT = 64;
const AUDIT_WRITE_FAILURE_MESSAGE_LIMIT = 240;
let auditWriteFailureCount = 0;
const auditWriteFailureRing: AuditWriteFailureRecord[] = [];

const AUDIT_FAILURE_SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(client_secret|clientSecret)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(access_token|accessToken)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(refresh_token|refreshToken)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(api[_-]?key|apiKey)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(authorization)["'=:\s]+Bearer\s+[A-Za-z0-9._-]{12,}/gi, replacement: "$1=Bearer [redacted]" },
  { pattern: /(password|passwd|credential)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /Bearer\s+[A-Za-z0-9._-]{12,}/gi, replacement: "Bearer [redacted]" },
  { pattern: /mysql:\/\/[^@\s]+@/gi, replacement: "mysql://[redacted]@" },
];

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return null;
}

export function redactAuditWriteFailureMessage(message: string) {
  let redacted = message;
  for (const { pattern, replacement } of AUDIT_FAILURE_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  if (redacted.length > AUDIT_WRITE_FAILURE_MESSAGE_LIMIT) {
    return `${redacted.slice(0, AUDIT_WRITE_FAILURE_MESSAGE_LIMIT - 3).trimEnd()}...`;
  }
  return redacted;
}

export function recordAuditWriteFailure(input: {
  attempted: AuditInput;
  error: unknown;
}) {
  auditWriteFailureCount += 1;

  const errorObj = input.error instanceof Error ? input.error : null;
  const record: AuditWriteFailureRecord = {
    workspaceId: input.attempted.workspaceId,
    userId: input.attempted.userId ?? null,
    actionType: input.attempted.actionType,
    targetType: input.attempted.targetType,
    targetId: input.attempted.targetId,
    failedAt: new Date().toISOString(),
    errorName: errorObj?.name ?? typeof input.error,
    errorMessage: redactAuditWriteFailureMessage(
      errorObj?.message ?? (typeof input.error === "string" ? input.error : String(input.error)),
    ),
    errorCode: extractErrorCode(input.error),
  };

  auditWriteFailureRing.push(record);
  if (auditWriteFailureRing.length > AUDIT_WRITE_FAILURE_RING_LIMIT) {
    auditWriteFailureRing.shift();
  }

  // Structured stderr line for log shippers / self-check parsing. Tag is
  // intentionally distinctive so a grep / log query can count drops.
  process.stderr.write(
    `${jsonStringify({ event: "helm.audit_write_failure", ...record })}\n`,
  );
}

export function getAuditWriteFailureSummary() {
  return {
    totalCount: auditWriteFailureCount,
    recent: [...auditWriteFailureRing],
  };
}

// Exposed for tests only — do not call from production code.
export function resetAuditWriteFailureSummaryForTesting() {
  auditWriteFailureCount = 0;
  auditWriteFailureRing.length = 0;
}

export async function safeWriteAuditLog(input: AuditInput) {
  try {
    return await writeAuditLog(input);
  } catch (error) {
    recordAuditWriteFailure({ attempted: input, error });
    return null;
  }
}
