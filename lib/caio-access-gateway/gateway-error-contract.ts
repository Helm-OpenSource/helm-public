/**
 * CAIO access gateway wire error contract.
 *
 * Every failure the gateway returns over the wire is built here so the
 * surface stays closed: fixed error identifiers, machine-readable reason
 * codes, and nothing else. JSON bodies never include secrets, raw tokens,
 * token hashes, prompts, or upstream raw bodies — reasons are constrained
 * to a snake_case identifier alphabet and replaced with "unspecified"
 * otherwise.
 *
 * A refused audit claim has THREE wire shapes, not one:
 *   audit_unavailable      503 + Retry-After   the store may recover
 *   receipt_conflict       409                 retrying can never help
 *   replay_limit_exceeded  429                 the receipt's replay cap is spent
 * Collapsing the last two into 503 told a client to retry a request that can
 * never succeed. Retry-After is emitted ONLY when the refusal carries a numeric
 * retryAfterSeconds, so `Retry-After: undefined` can never be serialized.
 */

import type { CaioCanonicalAuditGateOutcome } from "@/lib/caio-audit-state/gateway-audit-gate-adapter";

export type CaioAccessGatewayErrorCode =
  // 400-class
  | "bad_request"
  // 401-class
  | "bearer_token_required"
  | "token_unknown"
  | "token_expired"
  | "token_revoked"
  | "token_rotated"
  | "audience_mismatch"
  // 403-class
  | "source_ip_mismatch"
  | "project_access_revoked"
  | "scope_violation"
  /**
   * The request's project scope could not be determined, so it cannot be
   * authorized. Deliberately fail-closed: an undeterminable scope is a
   * refusal, never a silent allow.
   */
  | "project_scope_unresolved"
  /**
   * No ACTIVE, human-OWNER-approved governed model-route policy admits the
   * route behind the requested alias (or the binding disagrees with it). An
   * authorization refusal, not an outage: retrying cannot help, and which
   * governance condition failed is deliberately not disclosed.
   */
  | "route_not_governed"
  // 404 / 405 routing
  | "not_found"
  | "method_not_allowed"
  // 409-class
  | "active_token_exists"
  | "rotation_conflict"
  /**
   * The same [workspace, requestId] already carries a DIFFERENT durable audit
   * receipt. Not an outage: retrying cannot fix it, so it is never a 503.
   */
  | "audit_receipt_conflict"
  // 413-class
  | "payload_too_large"
  // 422-class
  | "external_release_denied"
  // 429-class
  | "rate_limited"
  /** The per-receipt repeat-dispatch cap is spent for this request identity. */
  | "audit_replay_limit_exceeded"
  // 502-class
  | "upstream_failed"
  // 503-class
  | "audit_unavailable"
  | "request_cancelled"
  | "no_route";

export type CaioGatewayWireStatus =
  | 400
  | 401
  | 403
  | 404
  | 405
  | 409
  | 413
  | 422
  | 429
  | 502
  | 503;

const WIRE_STATUS_BY_CODE: Readonly<
  Record<CaioAccessGatewayErrorCode, CaioGatewayWireStatus>
> = Object.freeze({
  bad_request: 400,
  bearer_token_required: 401,
  token_unknown: 401,
  token_expired: 401,
  token_revoked: 401,
  token_rotated: 401,
  audience_mismatch: 401,
  source_ip_mismatch: 403,
  project_access_revoked: 403,
  scope_violation: 403,
  project_scope_unresolved: 403,
  route_not_governed: 403,
  not_found: 404,
  method_not_allowed: 405,
  active_token_exists: 409,
  rotation_conflict: 409,
  audit_receipt_conflict: 409,
  payload_too_large: 413,
  external_release_denied: 422,
  rate_limited: 429,
  audit_replay_limit_exceeded: 429,
  upstream_failed: 502,
  audit_unavailable: 503,
  request_cancelled: 503,
  no_route: 503,
});

/**
 * Typed gateway failure. The message is always the bare code so that a
 * stack trace or log line can never leak a raw token, key, connection
 * string, prompt, or upstream body by accident.
 */
export class CaioAccessGatewayError extends Error {
  readonly code: CaioAccessGatewayErrorCode;
  readonly wireStatus: CaioGatewayWireStatus;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: CaioAccessGatewayErrorCode,
    options: Readonly<{ retryAfterSeconds?: number }> = {},
  ) {
    super(code);
    this.name = "CaioAccessGatewayError";
    this.code = code;
    this.wireStatus = WIRE_STATUS_BY_CODE[code];
    this.retryAfterSeconds =
      options.retryAfterSeconds === undefined
        ? null
        : Math.max(1, Math.ceil(options.retryAfterSeconds));
  }
}

export function isCaioAccessGatewayError(
  error: unknown,
): error is CaioAccessGatewayError {
  return error instanceof CaioAccessGatewayError;
}

export type CaioGatewayWireError = Readonly<{
  status: CaioGatewayWireStatus;
  headers: Readonly<Record<string, string>>;
  body: Readonly<{ error: string; reason?: string }>;
}>;

export type CaioGatewayErrorInput =
  | Readonly<{ status: 400; reason: string }>
  | Readonly<{ status: 401; reason: string }>
  | Readonly<{ status: 403; reason: string }>
  | Readonly<{ status: 404 }>
  | Readonly<{ status: 405; allow: readonly string[] }>
  | Readonly<{ status: 409; reason: string }>
  | Readonly<{ status: 409; error: "caio_audit_receipt_conflict" }>
  | Readonly<{ status: 413 }>
  | Readonly<{ status: 422 }>
  | Readonly<{ status: 429; retryAfterSeconds: number }>
  | Readonly<{
      status: 429;
      error: "caio_audit_replay_limit_exceeded";
      /** null when retrying cannot help; no Retry-After is then emitted. */
      retryAfterSeconds: number | null;
    }>
  | Readonly<{ status: 502 }>
  | Readonly<{
      status: 503;
      error:
        | "caio_audit_unavailable"
        | "caio_no_route"
        /**
         * The HOST withdrew this request — it is shutting down, or the request
         * deadline elapsed. Distinct from the two above on purpose: those name
         * a dependency that failed, and a client that reads "audit unavailable"
         * when the gateway is merely draining is being told something false
         * about which part of the system is unwell. Retrying helps, so this
         * arm carries retry advice like the others.
         */
        | "caio_request_cancelled";
      /** null when the dependency gave no retry advice at all. */
      retryAfterSeconds: number | null;
    }>;

const NO_HEADERS: Readonly<Record<string, string>> = Object.freeze({});

const SAFE_REASON_PATTERN = /^[a-z][a-z0-9_]{0,79}$/;

function safeReason(reason: string): string {
  return SAFE_REASON_PATTERN.test(reason) ? reason : "unspecified";
}

/**
 * Retry-After headers, or NO header at all when there is no numeric advice.
 * A null/undefined/non-finite value must never become the string "undefined"
 * (or "NaN") on the wire: the absence of the header is the correct signal.
 */
function retryAfterHeader(
  seconds: number | null | undefined,
): Readonly<Record<string, string>> {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return NO_HEADERS;
  }
  return Object.freeze({
    "retry-after": String(Math.max(1, Math.ceil(seconds))),
  });
}

/**
 * Build the wire representation for a gateway failure class. This is the
 * only place response error bodies are assembled.
 */
export function toGatewayError(
  input: CaioGatewayErrorInput,
): CaioGatewayWireError {
  switch (input.status) {
    case 400:
      return Object.freeze({
        status: 400,
        headers: NO_HEADERS,
        body: Object.freeze({
          error: "caio_bad_request",
          reason: safeReason(input.reason),
        }),
      });
    case 401:
      return Object.freeze({
        status: 401,
        headers: NO_HEADERS,
        body: Object.freeze({
          error: "caio_unauthorized",
          reason: safeReason(input.reason),
        }),
      });
    case 403:
      return Object.freeze({
        status: 403,
        headers: NO_HEADERS,
        body: Object.freeze({
          error: "caio_forbidden",
          reason: safeReason(input.reason),
        }),
      });
    case 404:
      return Object.freeze({
        status: 404,
        headers: NO_HEADERS,
        body: Object.freeze({ error: "caio_not_found" }),
      });
    case 405:
      return Object.freeze({
        status: 405,
        headers: Object.freeze({
          allow: [...input.allow].sort().join(", "),
        }),
        body: Object.freeze({ error: "caio_method_not_allowed" }),
      });
    case 409:
      if ("error" in input) {
        // A receipt conflict is permanent: no reason string (nothing about the
        // other receipt may be disclosed) and never a Retry-After.
        return Object.freeze({
          status: 409,
          headers: NO_HEADERS,
          body: Object.freeze({ error: input.error }),
        });
      }
      return Object.freeze({
        status: 409,
        headers: NO_HEADERS,
        body: Object.freeze({
          error: "caio_conflict",
          reason: safeReason(input.reason),
        }),
      });
    case 413:
      return Object.freeze({
        status: 413,
        headers: NO_HEADERS,
        body: Object.freeze({ error: "caio_payload_too_large" }),
      });
    case 422:
      return Object.freeze({
        status: 422,
        headers: NO_HEADERS,
        body: Object.freeze({ error: "caio_external_release_denied" }),
      });
    case 429:
      return Object.freeze({
        status: 429,
        headers: retryAfterHeader(input.retryAfterSeconds),
        body: Object.freeze({
          error: "error" in input ? input.error : "caio_rate_limited",
        }),
      });
    case 502:
      return Object.freeze({
        status: 502,
        headers: NO_HEADERS,
        body: Object.freeze({ error: "caio_upstream_failed" }),
      });
    case 503:
      return Object.freeze({
        status: 503,
        headers: retryAfterHeader(input.retryAfterSeconds),
        body: Object.freeze({ error: input.error }),
      });
  }
}

/** The host withdrew the request; this is not a dependency outage. */
export function caioRequestCancelledWireError(): CaioGatewayWireError {
  return toGatewayError({
    status: 503,
    error: "caio_request_cancelled",
    retryAfterSeconds: 1,
  });
}

const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Map a typed CaioAccessGatewayError onto the wire contract. Unknown or
 * non-gateway errors must NOT be passed here — callers translate them to
 * `{ status: 502 }` explicitly so upstream messages never leak.
 */
export function caioGatewayWireErrorFromError(
  error: CaioAccessGatewayError,
): CaioGatewayWireError {
  switch (error.wireStatus) {
    case 400:
      return toGatewayError({ status: 400, reason: error.code });
    case 401:
      return toGatewayError({ status: 401, reason: error.code });
    case 403:
      return toGatewayError({ status: 403, reason: error.code });
    case 404:
      return toGatewayError({ status: 404 });
    case 405:
      return toGatewayError({ status: 405, allow: [] });
    case 409:
      if (error.code === "audit_receipt_conflict") {
        return toGatewayError({
          status: 409,
          error: "caio_audit_receipt_conflict",
        });
      }
      return toGatewayError({ status: 409, reason: error.code });
    case 413:
      return toGatewayError({ status: 413 });
    case 422:
      return toGatewayError({ status: 422 });
    case 429:
      if (error.code === "audit_replay_limit_exceeded") {
        // The replay cap is spent for this receipt identity; a bare retry after
        // N seconds cannot clear it, so no retry advice is invented here.
        return toGatewayError({
          status: 429,
          error: "caio_audit_replay_limit_exceeded",
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      return toGatewayError({
        status: 429,
        retryAfterSeconds:
          error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
      });
    case 502:
      return toGatewayError({ status: 502 });
    case 503:
      if (error.code === "request_cancelled") {
        return caioRequestCancelledWireError();
      }
      return toGatewayError({
        status: 503,
        error:
          error.code === "no_route"
            ? "caio_no_route"
            : "caio_audit_unavailable",
        retryAfterSeconds:
          error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
      });
  }
}

/** A refused canonical audit-gate outcome (the non-allowed arm). */
export type CaioAuditRefusalOutcome = Extract<
  CaioCanonicalAuditGateOutcome,
  { errorCode: string }
>;

/** The three refusal statuses a transport must be able to distinguish. */
export type CaioAuditRefusalStatus = CaioAuditRefusalOutcome["status"];

/**
 * Map a refused audit claim onto the wire.
 *
 * The refusal's `status` discriminant decides the HTTP status — NOT its
 * `httpStatus` number. The audit-gate port is an injectable extension point, so
 * a JS implementation can report `httpStatus: 200` on a refusal; trusting the
 * number would turn a refusal into a success shape. An unmodelled status is
 * reported as a retryable 503, never as allowed.
 *
 * `errorCode`/`httpStatus` are accepted (a whole canonical outcome can be
 * passed straight in) but deliberately unused: the wire identifier is fixed
 * here so a dependency can never choose the error string a client sees.
 */
export function caioAuditRefusalWireError(
  refusal: Readonly<{
    status: CaioAuditRefusalStatus;
    retryAfterSeconds: number | null;
    errorCode?: string;
    httpStatus?: number;
  }>,
): CaioGatewayWireError {
  switch (refusal.status) {
    case "receipt_conflict":
      return toGatewayError({
        status: 409,
        error: "caio_audit_receipt_conflict",
      });
    case "replay_limit_exceeded":
      return toGatewayError({
        status: 429,
        error: "caio_audit_replay_limit_exceeded",
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      });
    case "audit_unavailable":
      return toGatewayError({
        status: 503,
        error: "caio_audit_unavailable",
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      });
    default: {
      const unexpected: never = refusal.status;
      void unexpected;
      return toGatewayError({
        status: 503,
        error: "caio_audit_unavailable",
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      });
    }
  }
}
