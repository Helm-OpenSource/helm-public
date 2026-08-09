/**
 * Framework-free CAIO gateway protocol core.
 *
 * No network listening happens here: the handler is a pure async
 * function over a normalized request descriptor, suitable for a node
 * https server adapter. All collaborators are injected ports.
 *
 * Request pipeline order (tested):
 *   parse route -> PRE-AUTH per-source-ip rate slot -> bearer extract
 *   -> authenticate(audience) -> source ip check (inside the
 *      authenticator, from the injected client ip)
 *   -> server-side request id -> body size cap (1 MiB default)
 *   -> JSON parse -> feature-flag admission (POST /mcp)
 *   -> project-scope resolution + live membership gate
 *      (POST /mcp) -> audit claim (POST /mcp only) -> dispatch.
 *
 * Cost control: the per-source-ip slot is claimed BEFORE any token lookup,
 * so requests that never present a valid credential (no bearer, unknown /
 * revoked / expired token, wrong audience, wrong source ip) still consume
 * budget. The per-token window inside the authenticator additionally charges
 * failed authentications once the token resolves.
 *
 * Request identity: the audit `requestId` is ALWAYS generated server-side and
 * workspace-scoped. A client-supplied `x-request-id` is kept only as a
 * non-authoritative correlation hint (echoed back as `x-correlation-id`); it
 * never participates in receipt identity or idempotency, so a client cannot
 * collide with, poison, or probe another caller's audit slot.
 *
 * Feature flags, ONE authoritative source: the wired `featureFlags` state (the
 * fail-closed default is DEFAULT_WORKBUDDY_FEATURE_FLAGS — everything off) is
 * read by BOTH MCP paths through the same predicate in mcp-allowlist.ts.
 *   tools/call  assertCaioMcpSurfaceEnabled + assertCaioToolCallEnabled, on the
 *               request path, before the membership gate, the audit claim and
 *               the dispatcher. With every flag off the dispatcher is never
 *               invoked at all.
 *   tools/list  the same predicate, composed by caioGatewayListableToolNames
 *               and applied to the answer (projectCaioToolsListPayload).
 * The two therefore cannot drift: a name the flags refuse to enumerate is a
 * name the flags refuse to call. Previously only the enumeration consulted the
 * flags while a call consulted the allowlist alone, so an every-flag-off
 * deployment still dispatched (and audited) an allowlisted read.
 *
 * Tool enumeration: a POST /mcp `tools/list` response is never forwarded
 * verbatim. It is projected through the server-side allowlist AND the
 * feature-flag state (projectCaioToolsListPayload), so the enumerated set can
 * never exceed what assertToolAllowed plus the flags would let this token call,
 * and presence / delivery / mutation definitions can never appear.
 *
 * Project scope: POST /mcp payloads are resolved through
 * mcp-request-scope.ts, which knows the JSON-RPC shape and refuses any
 * request whose project scope cannot be determined. Membership is asserted
 * for EVERY resolved ref and the authorized ref set is handed to the
 * dispatcher, so the value that was authorized is the value the executor is
 * contractually bound to use.
 *
 * The /v1 model routes carry provider-shaped completion payloads, not Helm
 * tool calls: they have no project dimension and are scoped by the token's
 * workspace plus the alias grant enforced inside the model proxy. They are
 * deliberately NOT scanned for project field names, because a completion body
 * may legitimately contain arbitrary text.
 *
 * Where the audit claim is issued:
 *   POST /mcp            here. A tool call resolves no model alias, so the
 *                        surface itself is the receipt's alias
 *                        (CAIO_GATEWAY_MCP_AUDIT_ALIAS) and the inputHash is
 *                        the canonical digest of the JSON-RPC payload.
 *   /v1/responses,
 *   /v1/chat/completions NOT here. The receipt requires modelAlias, inputHash
 *                        and policyVersion, and the policy version comes from
 *                        the resolved alias BINDING — knowledge this layer does
 *                        not have. The claim therefore belongs to the model
 *                        proxy engine (createCaioModelProxy), which claims
 *                        before any upstream egress. This layer instead
 *                        REFUSES any model dispatch outcome that is not backed
 *                        by an audit receipt, so delegating cannot become a
 *                        silent hole: see CaioModelDispatchOutcome.
 *   GET /v1/models       no claim: listing the aliases granted to a token is a
 *                        configuration read with no model dispatch and no
 *                        egress, and a receipt has no shape that can describe
 *                        it (no alias, no input).
 *
 * Liveness vs readiness: GET /livez only proves the process is alive and
 * never touches the database or any business port; GET /readyz reflects the
 * audit gate's own async readiness (four states, collapsed onto three by
 * caioGatewayReadinessFromAuditGate, `recovering` -> `degraded`), and fails
 * closed to 503 when the probe itself cannot answer. HTTP liveness is
 * deliberately not conflated with db/business health.
 */

import { randomUUID } from "node:crypto";

import {
  CaioAccessGatewayError,
  caioAuditRefusalWireError,
  caioGatewayWireErrorFromError,
  isCaioAccessGatewayError,
  toGatewayError,
  type CaioGatewayWireError,
} from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  assertCaioMcpSurfaceEnabled,
  assertCaioToolCallEnabled,
  CAIO_GATEWAY_ALLOWED_TOOL_NAMES,
  filterToolDefinitions,
  isCaioToolFlagEnabled,
} from "@/lib/caio-access-gateway/mcp-allowlist";
import {
  assertPayloadRefsAuthorized,
  CAIO_TOOL_PROJECT_SCOPES,
  resolveRequestProjectRefs,
} from "@/lib/caio-access-gateway/mcp-request-scope";
import {
  assertProjectAccess,
  type ProjectMembershipResolver,
} from "@/lib/caio-access-gateway/project-access";
import type { CaioPreAuthRateLimiterPort } from "@/lib/caio-access-gateway/source-ip-rate-limiter";
import type { CaioTokenAudience } from "@/lib/caio-access-gateway/token-contracts";
import type {
  CaioAccessPrincipal,
} from "@/lib/caio-access-gateway/token-store.service";
import type { CaioAuditGateReadiness } from "@/lib/caio-audit-state/audit-state-contracts";
import {
  caioGatewayReadinessFromAuditGate,
  type CaioCanonicalAuditClaim,
  type CaioCanonicalAuditGatePort,
} from "@/lib/caio-audit-state/gateway-audit-gate-adapter";
import {
  DEFAULT_WORKBUDDY_FEATURE_FLAGS,
  type WorkBuddyFeatureFlags,
} from "@/lib/caio-collaboration/feature-flags";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  parseCaioProPrivateExecutionResultProjection,
  type CaioProPrivateExecutionResultProjection,
} from "@/lib/stage1-owner-loop/caio-pro-fde-cross-repo-contract";

export const CAIO_GATEWAY_DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/**
 * Receipt alias for the MCP tool-dispatch surface.
 *
 * The minimal audit receipt is a closed six-field set built for model dispatch,
 * so an MCP tool call — which resolves no model alias — is recorded under the
 * surface's own stable identifier. It is deliberately not a real alias: no
 * alias grant, rate limit, or credential is ever looked up from this value.
 */
export const CAIO_GATEWAY_MCP_AUDIT_ALIAS = "caio-mcp-tool-dispatch";

/**
 * Policy version recorded for MCP tool dispatch. Model routes take their policy
 * version from the resolved alias binding inside the proxy; the MCP surface has
 * no binding, so its receipts are pinned to this gateway contract version.
 */
export const CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION = "caio-gateway-mcp-v1";

export const CAIO_GATEWAY_PRIVATE_EXECUTION_RESULT_AUDIT_ALIAS =
  "caio-private-execution-result-ingress";
export const CAIO_GATEWAY_PRIVATE_EXECUTION_RESULT_AUDIT_POLICY_VERSION =
  "caio-private-execution-result-ingress-v1";

/** Retry advice used when the gateway itself decides audit is unusable. */
const AUDIT_UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

export type CaioGatewayRequest = Readonly<{
  method: string;
  /** Path only; a query string, if present, is ignored for routing. */
  path: string;
  /** Header names must be lower-cased by the transport adapter. */
  headers: Readonly<Record<string, string | undefined>>;
  /** Client ip as observed by the transport adapter (not any header). */
  clientIp: string;
  body?: string | Uint8Array | null;
  /** Host shutdown/deadline cancellation, never supplied by the client. */
  signal?: AbortSignal;
}>;

export type CaioGatewayResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  /** JSON-serializable payload; the adapter stringifies it. */
  body: unknown;
}>;

export type CaioTokenAuthenticatorPort = Readonly<{
  authenticate(input: {
    rawToken: string;
    expectedAudience: CaioTokenAudience;
    sourceIp: string;
    now: Date;
    rateLimitPerMinute?: number;
    signal?: AbortSignal;
  }): Promise<CaioAccessPrincipal>;
}>;

export type CaioMcpDispatchPort = (input: {
  principal: CaioAccessPrincipal;
  /** Server-generated, workspace-scoped. Never client-controlled. */
  requestId: string;
  /**
   * Client-supplied correlation hint, or null. Non-authoritative: it must
   * never be used as a receipt id, idempotency key, or dedupe key.
   */
  clientCorrelationId: string | null;
  payload: unknown;
  /**
   * The allowlisted tool name the gateway resolved, or null for a JSON-RPC
   * method that carries no tool (handshake surface).
   */
  toolName: string | null;
  /**
   * CONTRACT: every project ref this request is authorized for, already
   * checked against live membership. The executor MUST operate only on these
   * refs — the gateway has already refused the request if the payload named
   * any ref outside this set, so consuming a different ref would be a
   * deliberate breach rather than a gap.
   */
  authorizedProjectRefs: readonly string[];
  signal?: AbortSignal;
  /** Live per-request project gate bound to the injected resolver. */
  assertProjectAccess(projectRef: string): Promise<void>;
}) => Promise<unknown>;

export type CaioPrivateExecutionResultIngressPort = (input: {
  principal: CaioAccessPrincipal;
  requestId: string;
  projection: CaioProPrivateExecutionResultProjection;
  signal?: AbortSignal;
}) => Promise<unknown>;

/**
 * Result of a model-route dispatch, as this layer consumes it.
 *
 * CONTRACT: a model route's audit claim is issued INSIDE the proxy, where the
 * alias binding (and therefore modelAlias / inputHash / policyVersion) is
 * resolved. The proxy must therefore report what its claim did, and this layer
 * refuses anything that is not receipt-backed:
 *
 *   - `claim: "allowed"` with a non-empty `auditReceiptId` is the ONLY shape
 *     whose body is served; the receipt id is the evidence that a durable audit
 *     write happened before any egress.
 *   - `claim: "refused"` is mapped to 503 / 409 / 429 exactly like a claim
 *     refused at this layer.
 *   - anything else — including an "allowed" outcome with no receipt id — is
 *     treated as "no claim was recorded" and refused as 503, because the port is
 *     injectable and a JS implementation can return any shape at all.
 */
export type CaioModelDispatchOutcome =
  | Readonly<{
      claim: "allowed";
      /** Receipt id of the claim the proxy made before any upstream egress. */
      auditReceiptId: string;
      /** JSON-serializable upstream payload to return to the caller. */
      body: unknown;
    }>
  | Readonly<{
      claim: "refused";
      refusal:
        | "audit_unavailable"
        | "receipt_conflict"
        | "replay_limit_exceeded";
      /** Never undefined; null means retrying cannot help. */
      retryAfterSeconds: number | null;
    }>;

export type CaioModelProxyPort = Readonly<{
  responses(input: {
    principal: CaioAccessPrincipal;
    requestId: string;
    clientCorrelationId: string | null;
    payload: unknown;
    signal?: AbortSignal;
  }): Promise<CaioModelDispatchOutcome>;
  chatCompletions(input: {
    principal: CaioAccessPrincipal;
    requestId: string;
    clientCorrelationId: string | null;
    payload: unknown;
    signal?: AbortSignal;
  }): Promise<CaioModelDispatchOutcome>;
  /**
   * Must respond only with the aliases granted to the presented token. This is
   * a configuration read with no dispatch and no egress, so it carries no audit
   * receipt (see the module header).
   *
   * The grant is part of the input because the sentence above is otherwise
   * unsatisfiable: an implementation that is handed only workspace/user/client
   * type has nothing to narrow by and can do no better than the client type's
   * default, which would list aliases to a token that was granted none.
   *
   * Present-vs-absent is load-bearing, exactly as on the dispatch path:
   *   absent → no grant stored; the client type's default applies
   *   []     → an explicit grant of nothing; every alias is refused
   * The two may never be collapsed.
   */
  listModels(input: {
    workspaceId: string;
    userRef: string;
    clientType: string;
    grantedAliases?: readonly string[];
    signal?: AbortSignal;
  }): Promise<unknown>;
}>;

/**
 * Gateway-facing readiness vocabulary. The audit gate has FOUR states; this
 * probe has three. `recovering` (serving under a recovery admission cap) is
 * reported as `degraded` — never as ready.
 */
export type CaioReadinessState = "ready" | "degraded" | "unavailable";

/**
 * Readiness source. Shaped so the audit gate itself satisfies it with no
 * adapter: `getReadiness()` is async and answers in the gate's own four-state
 * vocabulary. A probe that throws fails the readiness check closed.
 */
export type CaioReadinessProbePort = Readonly<{
  getReadiness(options?: Readonly<{ signal?: AbortSignal }>): Promise<CaioAuditGateReadiness>;
}>;

export type CaioGatewayHandlerDependencies = Readonly<{
  /**
   * Pre-authentication cost control. Required (not optional) so a wiring
   * omission cannot silently remove the only limiter that can charge invalid
   * credentials.
   */
  preAuthRateLimiter: CaioPreAuthRateLimiterPort;
  tokenAuthenticator: CaioTokenAuthenticatorPort;
  projectResolver: ProjectMembershipResolver;
  privateExecutionResultIngress: CaioPrivateExecutionResultIngressPort;
  mcpDispatch: CaioMcpDispatchPort;
  modelProxy: CaioModelProxyPort;
  /**
   * The canonical audit-gate port published by caio-audit-state. The gateway
   * declares no port of its own: one vocabulary, one refusal taxonomy, and the
   * real gate wires in through createCaioCanonicalAuditGatePort() with no shim.
   */
  auditGate: CaioCanonicalAuditGatePort;
  readinessProbe: CaioReadinessProbePort;
  /**
   * Feature-flag state governing which tools may be USED — and therefore which
   * may be ENUMERATED — through this gateway. The ONE flag vocabulary
   * (WorkBuddyFeatureFlags) is reused, so the gateway's enumeration gate and the
   * dispatcher's enablement gate cannot drift. Omitted means
   * DEFAULT_WORKBUDDY_FEATURE_FLAGS: everything off, nothing enumerable.
   */
  featureFlags?: WorkBuddyFeatureFlags;
  maxBodyBytes?: number;
  rateLimitPerMinute?: number;
  now?: () => Date;
  requestIdFactory?: () => string;
  /** Overrides CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION on MCP receipts. */
  mcpAuditPolicyVersion?: string;
}>;

export type CaioGatewayHandler = (
  request: CaioGatewayRequest,
) => Promise<CaioGatewayResponse>;

type AuthedRoute = Readonly<{
  kind:
    | "mcp"
    | "private_execution_result"
    | "model_responses"
    | "model_chat_completions"
    | "model_list";
  audience: CaioTokenAudience;
  expectsJsonBody: boolean;
}>;

const AUTHED_ROUTES: Readonly<
  Record<string, Readonly<Partial<Record<string, AuthedRoute>>>>
> = Object.freeze({
  "/mcp": Object.freeze({
    POST: Object.freeze({
      kind: "mcp" as const,
      audience: "mcp" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/execution-results": Object.freeze({
    POST: Object.freeze({
      kind: "private_execution_result" as const,
      audience: "mcp" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/responses": Object.freeze({
    POST: Object.freeze({
      kind: "model_responses" as const,
      audience: "model" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/chat/completions": Object.freeze({
    POST: Object.freeze({
      kind: "model_chat_completions" as const,
      audience: "model" as const,
      expectsJsonBody: true,
    }),
  }),
  "/v1/models": Object.freeze({
    GET: Object.freeze({
      kind: "model_list" as const,
      audience: "model" as const,
      expectsJsonBody: false,
    }),
  }),
});

const PROBE_METHODS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "/livez": Object.freeze(["GET"]),
    "/readyz": Object.freeze(["GET"]),
  });

const JSON_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "content-type": "application/json; charset=utf-8",
});

function wireResponse(error: CaioGatewayWireError): CaioGatewayResponse {
  return Object.freeze({
    status: error.status,
    headers: Object.freeze({ ...JSON_HEADERS, ...error.headers }),
    body: error.body,
  });
}

function jsonResponse(status: number, body: unknown): CaioGatewayResponse {
  return Object.freeze({ status, headers: JSON_HEADERS, body });
}

function requestCancelledError(): CaioAccessGatewayError {
  return new CaioAccessGatewayError("request_cancelled", {
    retryAfterSeconds: 1,
  });
}

function throwIfRequestCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw requestCancelledError();
}

/**
 * Stop waiting as soon as the host withdraws the request. The operation is
 * supplied lazily so an already-aborted signal cannot touch the port at all.
 */
async function runWithRequestCancellation<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  throwIfRequestCancelled(signal);
  if (!signal) return operation();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(requestCancelledError()));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }

    let pending: Promise<T>;
    try {
      pending = Promise.resolve(operation());
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    pending.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

/**
 * 200 response, echoing the caller's correlation hint (if it was safe) under
 * a name that cannot be confused with the authoritative request id.
 */
function okResponse(
  body: unknown,
  clientCorrelationId: string | null,
): CaioGatewayResponse {
  if (clientCorrelationId === null) return jsonResponse(200, body);
  return Object.freeze({
    status: 200,
    headers: Object.freeze({
      ...JSON_HEADERS,
      "x-correlation-id": clientCorrelationId,
    }),
    body,
  });
}

function extractBearerToken(
  headers: Readonly<Record<string, string | undefined>>,
): string | null {
  const header = headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function bodyByteLength(body: string | Uint8Array | null | undefined): number {
  if (body === null || body === undefined) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  return body.byteLength;
}

function bodyText(body: string | Uint8Array | null | undefined): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  return Buffer.from(body).toString("utf8");
}

/**
 * A client correlation hint is accepted only in this shape, and only as an
 * opaque echo value. It is never authoritative.
 */
const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

/** Retry-after used when the pre-auth limiter cannot be consulted. */
const LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

function readClientCorrelationId(
  headers: Readonly<Record<string, string | undefined>>,
): string | null {
  const header = headers["x-request-id"];
  if (typeof header !== "string") return null;
  return SAFE_CORRELATION_ID_PATTERN.test(header) ? header : null;
}

/** The refusal every "nothing proves a durable audit write happened" path uses. */
function auditUnavailableWireError(): CaioGatewayWireError {
  return toGatewayError({
    status: 503,
    error: "caio_audit_unavailable",
    retryAfterSeconds: AUDIT_UNAVAILABLE_RETRY_AFTER_SECONDS,
  });
}

/**
 * Outcome of demanding audit evidence from a port: served, or refused.
 * `body` is present only where the port also carries a response payload
 * (a model dispatch); a bare claim carries none.
 */
type AuditBackedOutcome =
  | Readonly<{ claimed: true; receiptId: string; body?: unknown }>
  | Readonly<{ claimed: false; wire: CaioGatewayWireError }>;

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Readonly<Record<string, unknown>>;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function retryAdvice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const AUDIT_REFUSAL_STATUSES = Object.freeze([
  "audit_unavailable",
  "receipt_conflict",
  "replay_limit_exceeded",
] as const);

function isAuditRefusalStatus(
  value: unknown,
): value is (typeof AUDIT_REFUSAL_STATUSES)[number] {
  return AUDIT_REFUSAL_STATUSES.some((status) => status === value);
}

/**
 * Read an audit-gate outcome DEFENSIVELY. The port is an injectable extension
 * point, so neither the allow arm nor the refusal taxonomy may be trusted from
 * types alone: an "allowed" outcome without a receipt id is not evidence of a
 * durable write and is refused like an outage.
 */
function readAuditClaimOutcome(outcome: unknown): AuditBackedOutcome {
  const record = asRecord(outcome);
  const status = record?.status;
  if (status === "allowed") {
    const receiptId = nonEmptyString(record?.receiptId);
    if (receiptId === null) {
      return { claimed: false, wire: auditUnavailableWireError() };
    }
    return { claimed: true, receiptId };
  }
  if (isAuditRefusalStatus(status)) {
    return {
      claimed: false,
      wire: caioAuditRefusalWireError({
        status,
        retryAfterSeconds: retryAdvice(record?.retryAfterSeconds),
      }),
    };
  }
  return { claimed: false, wire: auditUnavailableWireError() };
}

/**
 * Read a model-route dispatch outcome DEFENSIVELY. Same reasoning as above: the
 * claim now happens inside the proxy, so this is the only place that can prove
 * the gateway never serves a model dispatch that no receipt covers.
 */
function readModelDispatchOutcome(outcome: unknown): AuditBackedOutcome {
  const record = asRecord(outcome);
  if (record?.claim === "allowed") {
    const receiptId = nonEmptyString(record.auditReceiptId);
    if (receiptId === null) {
      return { claimed: false, wire: auditUnavailableWireError() };
    }
    return { claimed: true, receiptId, body: record.body ?? null };
  }
  if (record?.claim === "refused" && isAuditRefusalStatus(record.refusal)) {
    return {
      claimed: false,
      wire: caioAuditRefusalWireError({
        status: record.refusal,
        retryAfterSeconds: retryAdvice(record.retryAfterSeconds),
      }),
    };
  }
  return { claimed: false, wire: auditUnavailableWireError() };
}

/**
 * The JSON-RPC method whose response ENUMERATES tools. Only this response is
 * projected: a tools/call result carries business data whose objects may
 * legitimately have `name` fields, and rewriting those would corrupt a read.
 */
const MCP_TOOLS_LIST_METHOD = "tools/list";

/**
 * The tools a token may see enumerated, for a given feature-flag state.
 *
 * Strictly narrower than `assertToolAllowed`, by construction:
 *   1. only explicitly allowlisted names are considered at all;
 *   2. the feature-flag state must permit the tool's risk class, so nothing is
 *      listed while the gateway flag is off and no mutation is ever listed;
 *   3. the tool must have a RESOLVABLE declared project scope — a tool whose
 *      argument schema is not in-tree is refused at call time
 *      (project_scope_unresolved), so advertising it would enumerate a
 *      capability the gateway always denies.
 *
 * With the default flags (everything off) this is the empty list.
 */
export function caioGatewayListableToolNames(
  flags: WorkBuddyFeatureFlags,
): readonly string[] {
  return Object.freeze(
    CAIO_GATEWAY_ALLOWED_TOOL_NAMES.filter((name) => {
      if (!isCaioToolFlagEnabled(name, flags)) return false;
      const scope = CAIO_TOOL_PROJECT_SCOPES[name];
      return scope !== undefined && scope.kind !== "unresolvable";
    }).sort(),
  );
}

/** Bounds for the tools/list projection walk. */
const MAX_TOOLS_LIST_DEPTH = 12;
const MAX_TOOLS_LIST_NODES = 5_000;

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * A tool-definition-shaped entry: a plain record carrying a string `name`.
 *
 * Any array holding at least ONE of these is treated as a tool catalog — not
 * only an array where EVERY entry qualifies, which a single nameless element
 * would have been enough to defeat.
 */
function isNamedRecord(
  value: unknown,
): value is Readonly<{ name: string }> {
  return isPlainObject(value) && typeof value.name === "string";
}

/**
 * Project a dispatcher's tools/list answer so the enumerated set can never
 * exceed what this token may actually use.
 *
 * The dispatcher is an injected port answering `unknown`, so the tool catalog is
 * located structurally rather than assumed at one path: in EVERY array anywhere
 * in the response, every `{name: ...}` entry must survive both the server-side
 * allowlist (filterToolDefinitions) and the feature-flag state. A presence,
 * delivery, mutation or non-allowlisted definition therefore cannot survive at
 * `result.tools`, at a bare `tools`, or at any other position a dispatcher might
 * use — and cannot be smuggled through by padding the array with an entry that
 * carries no name. Entries that name nothing are left alone: they advertise no
 * callable tool.
 *
 * A response too deep or too large to walk exhaustively is REFUSED rather than
 * partially filtered.
 */
export function projectCaioToolsListPayload(
  response: unknown,
  flags: WorkBuddyFeatureFlags,
): unknown {
  const listable = new Set(caioGatewayListableToolNames(flags));
  let nodes = 0;
  const walk = (value: unknown, depth: number): unknown => {
    nodes += 1;
    if (depth > MAX_TOOLS_LIST_DEPTH || nodes > MAX_TOOLS_LIST_NODES) {
      throw new CaioAccessGatewayError("upstream_failed");
    }
    if (Array.isArray(value)) {
      const entries: readonly unknown[] = value;
      const named = entries.filter(isNamedRecord);
      if (named.length > 0) {
        // Allowlist first (the ceiling), then the flag state (what this
        // deployment actually permits). A name must clear BOTH to stay.
        const allowlisted = new Set(
          filterToolDefinitions(named).map((tool) => tool.name),
        );
        return Object.freeze(
          entries
            .filter(
              (entry) =>
                !isNamedRecord(entry) ||
                (allowlisted.has(entry.name) && listable.has(entry.name)),
            )
            .map((entry) => walk(entry, depth + 1)),
        );
      }
      return entries.map((entry) => walk(entry, depth + 1));
    }
    if (!isPlainObject(value)) return value;
    const projected: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      projected[key] = walk(entry, depth + 1);
    }
    return projected;
  };
  return walk(response, 0);
}

export function createCaioGatewayHandler(
  dependencies: CaioGatewayHandlerDependencies,
): CaioGatewayHandler {
  const maxBodyBytes =
    dependencies.maxBodyBytes ?? CAIO_GATEWAY_DEFAULT_MAX_BODY_BYTES;
  const now = dependencies.now ?? (() => new Date());
  const requestIdFactory =
    dependencies.requestIdFactory ?? (() => randomUUID());
  const mcpAuditPolicyVersion =
    dependencies.mcpAuditPolicyVersion ??
    CAIO_GATEWAY_MCP_AUDIT_POLICY_VERSION;
  // Fail-closed default: an unwired flag set enumerates nothing.
  const featureFlags =
    dependencies.featureFlags ?? DEFAULT_WORKBUDDY_FEATURE_FLAGS;

  /**
   * The deployment posture actually in force, read off the wired audit-gate
   * port rather than declared separately here. A gateway therefore cannot
   * report one posture on its status surface while admitting under the other's
   * rules — there is only one declaration, made where the gate is constructed.
   */
  const activePosture = dependencies.auditGate.posture;

  /**
   * Readiness, mapped from the audit gate's four states onto the probe's three.
   * A probe that throws is reported as unavailable: an unanswerable readiness
   * question is never an implicit "ready".
   *
   * The active posture is reported alongside the state: `degraded` means
   * "serving through the encrypted emergency queue" only under `self_service`,
   * and an operator must be able to see which contract the answer belongs to.
   */
  async function readinessResponse(
    signal?: AbortSignal,
  ): Promise<CaioGatewayResponse> {
    let state: CaioReadinessState;
    try {
      state = caioGatewayReadinessFromAuditGate(
        await runWithRequestCancellation(
          () => dependencies.readinessProbe.getReadiness(
            signal ? { signal } : undefined,
          ),
          signal,
        ),
      );
    } catch (error) {
      if (isCaioAccessGatewayError(error)) {
        return wireResponse(caioGatewayWireErrorFromError(error));
      }
      state = "unavailable";
    }
    if (state === "unavailable") {
      return wireResponse(auditUnavailableWireError());
    }
    return jsonResponse(
      200,
      Object.freeze({ status: state, posture: activePosture }),
    );
  }

  /**
   * Claim the pre-authentication per-source-ip slot. Fails CLOSED: a limiter
   * that throws refuses the request, and the refusal is deliberately shaped
   * exactly like a genuine limit hit so it discloses nothing about the
   * limiter's state or about whether any token exists.
   */
  async function claimSourceIpBudget(
    sourceIp: string,
    signal?: AbortSignal,
  ): Promise<void> {
    let allowed: boolean;
    let retryAfterSeconds = LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS;
    try {
      const slot = await runWithRequestCancellation(
        () => dependencies.preAuthRateLimiter.claimSourceIpSlot({
          sourceIp,
          now: now(),
          ...(signal ? { signal } : {}),
        }),
        signal,
      );
      allowed = slot.allowed;
      if (!slot.allowed) retryAfterSeconds = slot.retryAfterSeconds;
    } catch (error) {
      if (isCaioAccessGatewayError(error)) throw error;
      allowed = false;
    }
    if (!allowed) {
      throw new CaioAccessGatewayError("rate_limited", { retryAfterSeconds });
    }
  }

  /**
   * Claim the audit slot through the canonical port. Fails CLOSED in both
   * directions: a refusal returns its own wire error, and a THROW (malformed
   * claim, receipt id inside the gate's reserved replay-marker namespace, store
   * fault) is never swallowed — it becomes a 503 with no dispatch.
   */
  async function claimAuditSlot(
    claim: CaioCanonicalAuditClaim,
    signal?: AbortSignal,
  ): Promise<AuditBackedOutcome> {
    let outcome: unknown;
    try {
      outcome = await runWithRequestCancellation(
        () => dependencies.auditGate.claimDispatch(claim),
        signal,
      );
    } catch (error) {
      if (isCaioAccessGatewayError(error)) throw error;
      throw new CaioAuditUnavailableSignal();
    }
    return readAuditClaimOutcome(outcome);
  }

  async function dispatchAuthedRoute(input: {
    route: AuthedRoute;
    request: CaioGatewayRequest;
  }): Promise<CaioGatewayResponse> {
    const { route, request } = input;

    // 2. Pre-authentication cost control, before any token lookup, so
    //    invalid credentials cannot be replayed for free.
    await claimSourceIpBudget(request.clientIp, request.signal);

    // The client's own id is a correlation hint only; the authoritative
    // request id is generated below, after authentication, from the server's
    // own randomness.
    const clientCorrelationId = readClientCorrelationId(request.headers);

    // 3. Bearer extract.
    const rawToken = extractBearerToken(request.headers);
    if (rawToken === null) {
      return wireResponse(
        toGatewayError({ status: 401, reason: "bearer_token_required" }),
      );
    }

    // 4. Authenticate (audience + source ip + rate limit taxonomy).
    const principal = await runWithRequestCancellation(
      () => dependencies.tokenAuthenticator.authenticate({
        rawToken,
        expectedAudience: route.audience,
        sourceIp: request.clientIp,
        now: now(),
        rateLimitPerMinute: dependencies.rateLimitPerMinute,
        ...(request.signal ? { signal: request.signal } : {}),
      }),
      request.signal,
    );

    // 5. Server-side request identity: workspace-scoped random id. A client
    //    can neither choose it nor collide with another workspace's ids.
    const requestId = `${principal.workspaceId}:${requestIdFactory()}`;

    // 6. Body size cap (after authentication, before any parsing).
    if (bodyByteLength(request.body) > maxBodyBytes) {
      return wireResponse(toGatewayError({ status: 413 }));
    }

    // 7. Parse the JSON body where the route requires one.
    let payload: unknown = null;
    if (route.expectsJsonBody) {
      const text = bodyText(request.body);
      if (text.trim().length === 0) {
        return wireResponse(
          toGatewayError({ status: 400, reason: "json_body_required" }),
        );
      }
      try {
        payload = JSON.parse(text);
      } catch {
        return wireResponse(
          toGatewayError({ status: 400, reason: "json_body_invalid" }),
        );
      }
    }

    const boundAssertProjectAccess = (projectRef: string) =>
      runWithRequestCancellation(
        () => assertProjectAccess(
          dependencies.projectResolver,
          principal.workspaceId,
          principal.userRef,
          projectRef,
          request.signal,
        ),
        request.signal,
      );

    // 8. Project-scope resolution + live membership gate for /mcp.
    //
    //    Fail-closed by construction: resolveRequestProjectRefs refuses any
    //    payload whose scope it cannot determine (non-JSON-RPC body, unknown
    //    method, non-allowlisted tool, tool with no in-tree argument schema,
    //    missing declared scoping field), so there is no shape that reaches
    //    an executor without having been scope-checked.
    let toolName: string | null = null;
    /** The resolved JSON-RPC method, used to gate the tools/list projection. */
    let mcpMethod: string | null = null;
    let authorizedProjectRefs: readonly string[] = Object.freeze([]);
    let privateExecutionResult:
      | CaioProPrivateExecutionResultProjection
      | null = null;
    if (route.kind === "mcp") {
      // FEATURE-FLAG ADMISSION, before the payload is even scope-resolved: the
      // MCP surface is off unless this deployment enabled it. With the default
      // flag set the dispatcher is never invoked and no audit slot is spent.
      assertCaioMcpSurfaceEnabled(featureFlags);
      const scope = resolveRequestProjectRefs(payload);
      mcpMethod = scope.method;
      if (scope.kind === "tool_call") {
        // The tool's own workspace argument must be the authenticated
        // workspace: a token may never drive another workspace's tools.
        if (scope.workspaceId !== principal.workspaceId) {
          throw new CaioAccessGatewayError("scope_violation");
        }
        // The SAME source the enumeration gate reads: a tool the flags refuse
        // to list is a tool the flags refuse to call. Checked before the
        // membership gate, the audit claim and the dispatch.
        assertCaioToolCallEnabled(scope.toolName, featureFlags);
        toolName = scope.toolName;
        // EVERY resolved ref is asserted, not just the first.
        for (const projectRef of scope.projectRefs) {
          await boundAssertProjectAccess(projectRef);
        }
        authorizedProjectRefs = scope.projectRefs;
      }
      // Deputy guard: the exact payload forwarded below may not carry any
      // project ref outside the set just authorized.
      assertPayloadRefsAuthorized(payload, authorizedProjectRefs);
    }
    if (route.kind === "private_execution_result") {
      assertCaioMcpSurfaceEnabled(featureFlags);
      if (
        featureFlags.mutationsEnabled !== true ||
        principal.audience !== "mcp" ||
        principal.clientType !== "workbuddy"
      ) {
        throw new CaioAccessGatewayError("scope_violation");
      }
      try {
        privateExecutionResult =
          parseCaioProPrivateExecutionResultProjection(payload);
      } catch {
        throw new CaioAccessGatewayError("bad_request");
      }
      if (
        privateExecutionResult.workspaceRef !==
        `workspace:${principal.workspaceId}`
      ) {
        throw new CaioAccessGatewayError("scope_violation");
      }
      await boundAssertProjectAccess(privateExecutionResult.portfolioRef);
    }

    // 9. Audit claim for MCP and private-result ingress before any dispatch
    //    work. Model routes deliberately do NOT claim here — this layer has no
    //    alias binding, so the proxy claims and step 10 refuses any outcome no
    //    receipt covers.
    if (route.kind === "mcp" || route.kind === "private_execution_result") {
      const privateIngress = route.kind === "private_execution_result";
      const claim: CaioCanonicalAuditClaim = {
        requestId,
        workspaceId: principal.workspaceId,
        clientType: principal.clientType,
        modelAlias: privateIngress
          ? CAIO_GATEWAY_PRIVATE_EXECUTION_RESULT_AUDIT_ALIAS
          : CAIO_GATEWAY_MCP_AUDIT_ALIAS,
        // A digest, never request text, enters the audit store. The private
        // projection already carries its canonical digest and was verified
        // above; MCP hashes its JSON-RPC payload here.
        inputHash: privateIngress
          ? privateExecutionResult!.contentHash
          : sha256(canonicalJson(payload)),
        policyVersion: privateIngress
          ? CAIO_GATEWAY_PRIVATE_EXECUTION_RESULT_AUDIT_POLICY_VERSION
          : mcpAuditPolicyVersion,
      };
      const claimed = await claimAuditSlot(claim, request.signal);
      if (!claimed.claimed) return wireResponse(claimed.wire);
    }

    // 10. Dispatch.
    switch (route.kind) {
      case "mcp": {
        const result = await runWithRequestCancellation(
          () => dependencies.mcpDispatch({
            principal,
            requestId,
            clientCorrelationId,
            payload,
            toolName,
            authorizedProjectRefs,
            ...(request.signal ? { signal: request.signal } : {}),
            assertProjectAccess: boundAssertProjectAccess,
          }),
          request.signal,
        );
        // ENUMERATION CONTRACT: a tools/list answer is projected through the
        // allowlist and the feature-flag state before it leaves the gateway, so
        // the listing can never exceed what assertToolAllowed + the flags would
        // let this token actually call. Every other method's payload is
        // forwarded unchanged.
        return okResponse(
          mcpMethod === MCP_TOOLS_LIST_METHOD
            ? projectCaioToolsListPayload(result, featureFlags)
            : result,
          clientCorrelationId,
        );
      }
      case "private_execution_result": {
        const result = await runWithRequestCancellation(
          () =>
            dependencies.privateExecutionResultIngress({
              principal,
              requestId,
              projection: privateExecutionResult!,
              ...(request.signal ? { signal: request.signal } : {}),
            }),
          request.signal,
        );
        return okResponse(result, clientCorrelationId);
      }
      case "model_responses": {
        const dispatched = readModelDispatchOutcome(
          await runWithRequestCancellation(
            () => dependencies.modelProxy.responses({
              principal,
              requestId,
              clientCorrelationId,
              payload,
              ...(request.signal ? { signal: request.signal } : {}),
            }),
            request.signal,
          ),
        );
        if (!dispatched.claimed) return wireResponse(dispatched.wire);
        return okResponse(dispatched.body, clientCorrelationId);
      }
      case "model_chat_completions": {
        const dispatched = readModelDispatchOutcome(
          await runWithRequestCancellation(
            () => dependencies.modelProxy.chatCompletions({
              principal,
              requestId,
              clientCorrelationId,
              payload,
              ...(request.signal ? { signal: request.signal } : {}),
            }),
            request.signal,
          ),
        );
        if (!dispatched.claimed) return wireResponse(dispatched.wire);
        return okResponse(dispatched.body, clientCorrelationId);
      }
      case "model_list": {
        const result = await runWithRequestCancellation(
          () => dependencies.modelProxy.listModels({
            workspaceId: principal.workspaceId,
            userRef: principal.userRef,
            clientType: principal.clientType,
            // Spread rather than assign: an absent key and an explicitly empty
            // grant mean different things, and writing `grantedAliases:
            // principal.grantedAliases` would turn "no grant stored" into a
            // present-but-undefined key that an implementation could read as
            // either one.
            ...(principal.grantedAliases === undefined
              ? {}
              : { grantedAliases: principal.grantedAliases }),
            ...(request.signal ? { signal: request.signal } : {}),
          }),
          request.signal,
        );
        return okResponse(result, clientCorrelationId);
      }
    }
  }

  return async function handleCaioGatewayRequest(
    request: CaioGatewayRequest,
  ): Promise<CaioGatewayResponse> {
    if (request.signal?.aborted) {
      return wireResponse(caioGatewayWireErrorFromError(requestCancelledError()));
    }
    // 1. Parse route (before anything else; unknown -> 404, method -> 405).
    const path = request.path.split("?")[0] ?? "";
    const method = request.method.toUpperCase();

    const probeMethods = PROBE_METHODS[path];
    if (probeMethods) {
      if (!probeMethods.includes(method)) {
        return wireResponse(
          toGatewayError({ status: 405, allow: probeMethods }),
        );
      }
      // /livez: process-alive only. It must never touch the database or
      // any business port, so it answers before any dependency is used.
      if (path === "/livez") {
        // The posture is a constant read from the already-wired audit-gate
        // port, not a dependency call, so liveness stays dependency-free while
        // still naming the deployment shape this process runs under.
        return jsonResponse(
          200,
          Object.freeze({ status: "alive", posture: activePosture }),
        );
      }
      return await readinessResponse(request.signal);
    }

    const routeMethods = AUTHED_ROUTES[path];
    if (!routeMethods) {
      return wireResponse(toGatewayError({ status: 404 }));
    }
    const route = routeMethods[method];
    if (!route) {
      return wireResponse(
        toGatewayError({
          status: 405,
          allow: Object.keys(routeMethods),
        }),
      );
    }

    try {
      return await dispatchAuthedRoute({ route, request });
    } catch (error) {
      if (error instanceof CaioAuditUnavailableSignal) {
        return wireResponse(auditUnavailableWireError());
      }
      if (isCaioAccessGatewayError(error)) {
        return wireResponse(caioGatewayWireErrorFromError(error));
      }
      // Unknown upstream/internal failures collapse to an opaque 502;
      // upstream raw bodies and messages never reach the wire.
      return wireResponse(toGatewayError({ status: 502 }));
    }
  };
}

/** Internal marker: the audit gate failed without a typed gateway error. */
class CaioAuditUnavailableSignal extends Error {
  constructor() {
    super("audit_unavailable");
    this.name = "CaioAuditUnavailableSignal";
  }
}
