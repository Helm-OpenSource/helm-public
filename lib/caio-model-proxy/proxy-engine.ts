// CAIO model proxy — orchestration engine used by the LAN gateway.
//
// Pipeline (fail-closed at every step): resolve alias binding → ALIAS GRANT
// check → protocol check → local rate limit → hash input → claim audit dispatch
// (BEFORE any upstream traffic; audit down means no egress) → load credential →
// invoke the protocol-matching upstream client → optional single fallback
// attempt (only to a fail-closed-equivalent binding, and only to a candidate
// inside the caller's grant).
//
// NOT STREAMING. Every dispatch is one request and one buffered JSON body:
// the engine has no chunk callback, no SSE path and no incomplete-stream
// status, because no surface above it can stream. A `stream: true` request is
// refused at the gateway with 400 rather than silently answered as buffered
// JSON.
//
// ALIAS GRANT: a valid model token is not authority over every configured
// binding. The caller's granted alias set is resolved from the audience context
// (explicit per-token grant, else the client type's default grant from the
// stable alias surface) and enforced on the primary route AND on the fallback
// candidate, before the audit claim, the credential load and any upstream
// contact. A non-granted alias is a 403-class `alias_not_granted` refusal, not
// a 503 availability answer.
//
// The audit claim carries ONLY {requestId, workspaceId, clientType,
// modelAlias, inputHash, policyVersion} — never the request body, never
// credential material. Receipts are hash-based by construction.
//
// AUDIT PORT: this engine consumes the ONE canonical audit-gate port published
// by caio-audit-state (CaioCanonicalAuditGatePort, CaioCanonicalAuditGateOutcome)
// and declares nothing parallel. It previously declared a THIRD port whose
// `{allowed, state}` decision was not output-compatible with that outcome, so
// the delegation chain gateway → proxy → audit gate was not type-connected and
// only the gateway's receipt-evidence requirement kept a silently lost claim
// from being served. All three refusal statuses (audit_unavailable /
// receipt_conflict / replay_limit_exceeded) now leave execute() distinctly, so a
// transport can map 503 / 409 / 429 instead of collapsing them into one
// retryable status.

import {
  CAIO_AUDIT_CONFLICT_ERROR_CODE,
  CAIO_AUDIT_CONFLICT_HTTP_STATUS,
  CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  CAIO_AUDIT_REPLAY_LIMIT_HTTP_STATUS,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
} from "@/lib/caio-audit-state/audit-state-contracts";
import type {
  CaioCanonicalAuditClaim,
  CaioCanonicalAuditGateOutcome,
  CaioCanonicalAuditGatePort,
} from "@/lib/caio-audit-state/gateway-audit-gate-adapter";
import {
  parseCaioDeploymentPosture,
  type CaioDeploymentPosture,
} from "@/lib/caio-audit-state/deployment-posture";
import { caioFallbackMarkerRequestId } from "@/lib/caio-audit-state/receipt-linkage";
import {
  CaioGovernedAdmissionError,
  type CaioFrozenGovernedAdmissionPort,
  type CaioGovernedRouteVerdict,
  type CaioLiveGovernedAdmissionPort,
} from "@/lib/caio-model-proxy/governed-admission-contracts";
import {
  admitFromSnapshot,
  admitLiveRoute,
  assertBindingAdmitted,
  type CaioGovernedAdmissionSubject,
} from "@/lib/caio-model-proxy/governed-admission-gate";
import { assessCaioOutboundContent } from "@/lib/caio-model-proxy/outbound-content-gate";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import {
  caioModelAliasBindingSchema,
  isFallbackAllowed,
  resolveCaioGrantedAliases,
  type CaioModelAliasBinding,
  type CaioModelAliasFallbackCandidate,
  type CaioModelProtocol,
} from "./alias-contracts";
import type {
  CaioProxyUpstreamClientPort,
  CaioUpstreamErrorInfo,
  CaioUpstreamInvokeResult,
} from "./upstream/upstream-contracts";

export const CAIO_PROXY_CLIENT_TYPES = ["codex", "workbuddy"] as const;
export type CaioProxyClientType = (typeof CAIO_PROXY_CLIENT_TYPES)[number];

export type CaioAudienceContext = {
  workspaceId: string;
  userRef: string;
  clientType: CaioProxyClientType;
  /**
   * The alias grant this caller holds, when the caller's token carries an
   * explicit one. OMITTED means "use the client type's default grant"; an
   * EMPTY array means "nothing is granted" and refuses every alias. It is
   * operator configuration resolved from the authenticated principal — never a
   * value a client can supply on the request.
   */
  grantedAliases?: readonly string[];
};

/**
 * The refused arm of the canonical audit-gate outcome, REUSED verbatim — the
 * engine does not restate the refusal taxonomy. `status` is the discriminant a
 * transport maps to 503 / 409 / 429.
 */
export type CaioProxyAuditRefusal = Extract<
  CaioCanonicalAuditGateOutcome,
  { errorCode: string }
>;

/** The three refusal statuses that must stay distinguishable end to end. */
export type CaioProxyAuditRefusalStatus = CaioProxyAuditRefusal["status"];

/**
 * HTTP status per refusal DISCRIMINANT, never the port's own `httpStatus`
 * number: the audit gate is an injectable extension point, so a JS
 * implementation reporting `httpStatus: 200` on a refusal must not be able to
 * turn a refusal into a success. Declared as a total record so a new refusal
 * status cannot be added upstream without failing this file's typecheck.
 */
const REFUSAL_HTTP_STATUS: Readonly<
  Record<CaioProxyAuditRefusalStatus, number>
> = Object.freeze({
  audit_unavailable: CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
  receipt_conflict: CAIO_AUDIT_CONFLICT_HTTP_STATUS,
  replay_limit_exceeded: CAIO_AUDIT_REPLAY_LIMIT_HTTP_STATUS,
});

/**
 * Reason code per refusal discriminant, from the canonical audit constants.
 * Also not taken from the port: a dependency may not choose the identifier a
 * caller keys behaviour on.
 */
const REFUSAL_REASON_CODE: Readonly<
  Record<CaioProxyAuditRefusalStatus, string>
> = Object.freeze({
  audit_unavailable: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
  receipt_conflict: CAIO_AUDIT_CONFLICT_ERROR_CODE,
  replay_limit_exceeded: CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
});

export type CaioRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export type CaioRateLimiterPort = {
  check(input: {
    workspaceId: string;
    userRef: string;
    clientType: CaioProxyClientType;
    alias: string;
  }): CaioRateLimitDecision;
};

export type CaioCredentialLoaderPort = {
  load(input: { credentialRef: string; signal?: AbortSignal }): Promise<string>;
};

type CaioModelProxyCommonDependencies = {
  bindings: readonly CaioModelAliasBinding[];
  credentialLoader: CaioCredentialLoaderPort;
  clients: {
    responses: CaioProxyUpstreamClientPort;
    chatCompletions: CaioProxyUpstreamClientPort;
  };
  /**
   * The ONE canonical audit-gate port published by caio-audit-state. The engine
   * declares no port of its own, so gateway -> proxy -> audit gate is a single
   * type-connected chain: the real gate wires in through
   * createCaioCanonicalAuditGatePort() with no shim.
   */
  auditGate: CaioCanonicalAuditGatePort;
  rateLimiter?: CaioRateLimiterPort;
  now?: () => Date;
};

/**
 * Proxy dependencies, discriminated by the DECLARED deployment posture.
 *
 * `posture` is required and is never inferred: not from the environment, not
 * from a request field, and never defaulted (an unparseable value fails
 * construction). It also has to AGREE with the audit gate's own posture —
 * checked at construction — so a process cannot admit under one posture while
 * writing receipts under the other.
 *
 * The two arms demand different admission PORTS, which is what makes the
 * self-service snapshot and the governed live check impossible to confuse:
 *   self_service → a frozen snapshot resolved once at construction
 *   governed_fde → a live, per-request verification against the policy head
 */
export type CaioModelProxyDependencies =
  | (CaioModelProxyCommonDependencies & {
      posture: Extract<CaioDeploymentPosture, "self_service">;
      governedAdmission: CaioFrozenGovernedAdmissionPort;
    })
  | (CaioModelProxyCommonDependencies & {
      posture: Extract<CaioDeploymentPosture, "governed_fde">;
      governedAdmission: CaioLiveGovernedAdmissionPort;
    });

export type CaioProxyExecuteInput = {
  audienceContext: CaioAudienceContext;
  alias: string;
  protocol: CaioModelProtocol;
  body: Record<string, unknown>;
  requestId: string;
  signal?: AbortSignal;
};

export type CaioProxyUpstreamDescriptor = {
  providerKey: string;
  upstreamModel: string;
  policyVersion: string;
};

/**
 * Result status. The audit arm IS the canonical refusal taxonomy — the three
 * statuses stay distinct all the way out of execute() so a caller can map
 * 503 / 409 / 429 instead of retrying a request that can never succeed.
 */
export type CaioProxyExecuteStatus =
  | "ok"
  | "no_route"
  /**
   * The caller's alias grant does not cover the requested alias. An
   * authorization refusal (403), never an availability problem (503): retrying
   * cannot help and the route may not be disclosed as merely unavailable.
   */
  | "alias_not_granted"
  /**
   * No ACTIVE, owner-approved governed policy admits this binding's route (or
   * the binding disagrees with it). A 403-class governance refusal raised
   * BEFORE the audit claim, the credential load and any upstream contact, in
   * BOTH postures. The coarse code is deliberate: which governance condition
   * failed is not disclosed to a LAN client.
   */
  | "route_not_admitted"
  /**
   * The outbound body crossed the Context Broker's hard content boundary.
   * 422-class, also raised before the audit claim, the credential load and any
   * upstream contact — the body never leaves.
   */
  | "content_boundary_denied"
  | "rate_limited"
  | CaioProxyAuditRefusalStatus
  | "credential_unavailable"
  | "upstream_error"
  | "cancelled";

export type CaioProxyExecuteResult = {
  status: CaioProxyExecuteStatus;
  httpStatus: number;
  reasonCode: string | null;
  receiptId: string | null;
  retryAfterSeconds: number | null;
  // Upstream JSON body on success; null on every other status.
  body: unknown;
  upstream: CaioProxyUpstreamDescriptor | null;
  fallbackAttempted: boolean;
  fallbackSucceeded: boolean;
  /**
   * Receipt of the SECOND, linked audit claim that records the fallback route
   * actually executed; null when no fallback was dispatched.
   */
  fallbackReceiptId: string | null;
  /**
   * The refused canonical audit outcome, verbatim, when the dispatch claim was
   * refused; null on every other path. Carrying the canonical object (rather
   * than a re-encoded copy) is what lets a transport map the refusal without
   * re-deriving the taxonomy.
   */
  auditRefusal: CaioProxyAuditRefusal | null;
};

export type CaioModelProxy = {
  execute(input: CaioProxyExecuteInput): Promise<CaioProxyExecuteResult>;
};

export class CaioModelProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaioModelProxyConfigError";
  }
}

/** Resolve one route's admission for a target binding at a point in time. */
type CaioRouteAdmitter = (
  target: CaioGovernedAdmissionSubject,
  at: Date,
) => Promise<CaioGovernedRouteVerdict>;

const UNVERIFIABLE: CaioGovernedRouteVerdict = Object.freeze({
  admitted: false as const,
  reason: "admission_unverifiable" as const,
});

/**
 * Build the posture's admission strategy ONCE.
 *
 * self_service returns a reader over the frozen snapshot — no IO, no await on
 * a live policy, which is exactly what lets this posture keep serving from the
 * encrypted emergency queue while the primary store is down. Its documented
 * cost: an owner revocation is observed only when the process reloads the
 * snapshot, so product material must NOT claim instant revocation here. The
 * snapshot still hard-expires at the policy's validUntil.
 *
 * governed_fde returns a verifier that re-reads the live policy head
 * (including its version and revocation epoch) for every request. A read that
 * fails for any reason answers "not admitted"; there is no cached answer to
 * fall back to.
 */
function buildRouteAdmitter(
  deps: CaioModelProxyDependencies,
): CaioRouteAdmitter {
  if (deps.posture === "self_service") {
    const port: CaioFrozenGovernedAdmissionPort = deps.governedAdmission;
    return async (target, at) => {
      try {
        return admitFromSnapshot({
          snapshot: port.snapshot(),
          binding: target,
          now: at,
        });
      } catch {
        return UNVERIFIABLE;
      }
    };
  }
  const port: CaioLiveGovernedAdmissionPort = deps.governedAdmission;
  return async (target, at) => {
    try {
      const verdict = await port.verify({
        routeRef: target.governedRouteRef,
        now: at,
      });
      return admitLiveRoute({ binding: target, verdict });
    } catch {
      return UNVERIFIABLE;
    }
  };
}

/**
 * Construction-time subordination check. self_service can compare the whole
 * binding against the frozen snapshot; governed_fde has no policy in hand yet,
 * so it verifies the one thing it can — that the binding names the policy this
 * gateway will verify against — and defers the route check to the request path.
 */
function assertBindingSubordinate(
  deps: CaioModelProxyDependencies,
  binding: CaioGovernedAdmissionSubject,
  now: Date,
  role: string,
): void {
  if (deps.posture === "self_service") {
    assertBindingAdmitted({
      snapshot: deps.governedAdmission.snapshot(),
      binding,
      now,
      role,
    });
    return;
  }
  if (binding.governedPolicyKey !== deps.governedAdmission.policyKey) {
    throw new CaioGovernedAdmissionError(
      "route_not_in_policy",
      `${role} ${binding.alias} names governed policy ${binding.governedPolicyKey}, but this gateway verifies ${deps.governedAdmission.policyKey}`,
    );
  }
}

function describeUpstream(
  binding: Pick<
    CaioModelAliasFallbackCandidate,
    "providerKey" | "upstreamModel" | "policyVersion"
  >,
): CaioProxyUpstreamDescriptor {
  return {
    providerKey: binding.providerKey,
    upstreamModel: binding.upstreamModel,
    policyVersion: binding.policyVersion,
  };
}

function noRoute(reasonCode: string): CaioProxyExecuteResult {
  return {
    status: "no_route",
    httpStatus: 503,
    reasonCode,
    receiptId: null,
    retryAfterSeconds: null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
  };
}

function cancelledResult(): CaioProxyExecuteResult {
  return {
    status: "cancelled",
    httpStatus: 499,
    reasonCode: "client_cancelled",
    receiptId: null,
    retryAfterSeconds: null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
  };
}

class CaioProxyCancellation extends Error {
  constructor() {
    super("caio_proxy_cancelled");
    this.name = "CaioProxyCancellation";
  }
}

/**
 * Stop awaiting a non-cooperative port when the host withdraws the request.
 * The operation is lazy so a pre-aborted request cannot touch the port.
 */
async function runWithCaioProxyCancellation<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new CaioProxyCancellation();
  if (!signal) return operation();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(new CaioProxyCancellation()));
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
 * The caller is not granted the alias. A 403-class refusal with no receipt, no
 * upstream descriptor and no retry advice: nothing about the binding (its
 * status, provider, or even whether it exists in a usable state) is disclosed.
 */
function aliasNotGranted(): CaioProxyExecuteResult {
  return {
    status: "alias_not_granted",
    httpStatus: 403,
    reasonCode: "alias_not_granted",
    receiptId: null,
    retryAfterSeconds: null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
  };
}

/**
 * The governed policy does not admit this route. Like alias_not_granted: no
 * receipt, no credential, no upstream, no retry advice, and nothing disclosed
 * about the binding or about which governance condition failed.
 */
function routeNotAdmitted(): CaioProxyExecuteResult {
  return {
    status: "route_not_admitted",
    httpStatus: 403,
    reasonCode: "route_not_admitted",
    receiptId: null,
    retryAfterSeconds: null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
  };
}

/** The body may not leave. No receipt, no credential, no upstream contact. */
function contentBoundaryDenied(): CaioProxyExecuteResult {
  return {
    status: "content_boundary_denied",
    httpStatus: 422,
    reasonCode: "content_boundary_denied",
    receiptId: null,
    retryAfterSeconds: null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
  };
}

function upstreamErrorResult(
  error: CaioUpstreamErrorInfo,
  receiptId: string,
  upstream: CaioProxyUpstreamDescriptor,
  fallbackAttempted: boolean,
  fallbackReceiptId: string | null = null,
): CaioProxyExecuteResult {
  return {
    status: "upstream_error",
    httpStatus: error.gatewayStatus,
    reasonCode: error.code,
    receiptId,
    retryAfterSeconds: error.retryAfterSeconds,
    body: null,
    upstream,
    fallbackAttempted,
    fallbackSucceeded: false,
    fallbackReceiptId,
    auditRefusal: null,
  };
}

/**
 * Maps a refused canonical audit claim to a proxy result. The refusal object is
 * carried through unchanged so no information is lost, while status / httpStatus
 * / reasonCode are derived from the DISCRIMINANT only, and retryAfterSeconds is
 * always a number or null — never undefined.
 */
function refusedClaimResult(
  refusal: CaioProxyAuditRefusal,
): CaioProxyExecuteResult {
  return {
    status: refusal.status,
    httpStatus: REFUSAL_HTTP_STATUS[refusal.status],
    reasonCode: REFUSAL_REASON_CODE[refusal.status],
    receiptId: null,
    retryAfterSeconds: refusal.retryAfterSeconds ?? null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: refusal,
  };
}

/** Normalized reading of ONE canonical claim outcome. */
type ClaimReading =
  | { claimed: true; receiptId: string }
  | { claimed: false; refusal: CaioProxyAuditRefusal };

/** The refusal used whenever nothing proves a durable audit write happened. */
function unprovenClaimRefusal(
  retryAfterSeconds: number | null,
): CaioProxyAuditRefusal {
  return Object.freeze({
    status: "audit_unavailable" as const,
    errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
    httpStatus: CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
    retryAfterSeconds,
  });
}

function isRefusalStatus(
  value: unknown,
): value is CaioProxyAuditRefusalStatus {
  return (
    typeof value === "string" && Object.hasOwn(REFUSAL_HTTP_STATUS, value)
  );
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Read a canonical audit-gate outcome DEFENSIVELY.
 *
 * The port is an injectable extension point, so neither arm may be trusted from
 * types alone. An "allowed" outcome without a non-empty receipt id is NOT
 * evidence of a durable write and is refused exactly like an outage, and an
 * answer outside the union is refused rather than treated as allowed — so no
 * shape reaches a credential load or an upstream call without a receipt.
 */
function readClaimOutcome(outcome: unknown): ClaimReading {
  if (typeof outcome !== "object" || outcome === null) {
    return { claimed: false, refusal: unprovenClaimRefusal(null) };
  }
  const record = outcome as Readonly<Record<string, unknown>>;
  if (record.status === "allowed") {
    const receiptId = record.receiptId;
    if (typeof receiptId !== "string" || receiptId.length === 0) {
      return { claimed: false, refusal: unprovenClaimRefusal(null) };
    }
    return { claimed: true, receiptId };
  }
  if (isRefusalStatus(record.status)) {
    return {
      claimed: false,
      refusal: Object.freeze({
        status: record.status,
        errorCode: REFUSAL_REASON_CODE[record.status],
        httpStatus: REFUSAL_HTTP_STATUS[record.status],
        retryAfterSeconds: numberOrNull(record.retryAfterSeconds),
      }),
    };
  }
  return { claimed: false, refusal: unprovenClaimRefusal(null) };
}

export function createCaioModelProxy(
  deps: CaioModelProxyDependencies,
): CaioModelProxy {
  // The declared posture, parsed fail-closed: absent or unparseable is a
  // construction error, never an implicit choice of the permissive posture.
  const posture = parseCaioDeploymentPosture(
    (deps as { posture?: unknown }).posture,
  );
  // No impersonation: the audit gate this proxy claims through must be the
  // same posture. A self-service proxy wired to a governed gate (or the
  // reverse) would produce receipts describing a deployment shape that never
  // ran, so it cannot be constructed at all.
  if (deps.auditGate.posture !== posture) {
    throw new CaioModelProxyConfigError(
      `posture mismatch: proxy is ${posture}, audit gate is ${String(
        deps.auditGate.posture,
      )}`,
    );
  }
  if (deps.governedAdmission.posture !== posture) {
    throw new CaioModelProxyConfigError(
      `posture mismatch: proxy is ${posture}, governed admission is ${String(
        deps.governedAdmission.posture,
      )}`,
    );
  }
  const clock = deps.now ?? (() => new Date());

  // ONE admission strategy, selected at construction. The self-service arm can
  // only ever read the frozen snapshot; the governed arm has no snapshot to
  // read and must complete a live verification for every request.
  const admitRoute = buildRouteAdmitter(deps);

  // Fail fast on malformed gateway configuration: every binding must satisfy
  // the alias contract and aliases must be unique.
  const bindingsByAlias = new Map<string, CaioModelAliasBinding>();
  for (const raw of deps.bindings) {
    const binding = caioModelAliasBindingSchema.parse(raw);
    if (bindingsByAlias.has(binding.alias)) {
      throw new CaioModelProxyConfigError(
        `duplicate alias binding: ${binding.alias}`,
      );
    }
    // Governed subordination, checked as early as the posture allows:
    //   self_service — the snapshot exists now, so the binding AND every
    //     fallback candidate are matched against the approved policy here; a
    //     binding the policy does not admit refuses to start.
    //   governed_fde — the policy is read per request, so only the declared
    //     policy key can be checked now; the route itself is verified live,
    //     before the audit claim, on every request.
    assertBindingSubordinate(deps, binding, clock(), "alias binding");
    for (const candidate of binding.fallbackCandidates) {
      assertBindingSubordinate(
        deps,
        candidate,
        clock(),
        `fallback candidate of ${binding.alias}`,
      );
    }
    bindingsByAlias.set(binding.alias, binding);
  }

  function clientForProtocol(
    protocol: CaioModelProtocol,
  ): CaioProxyUpstreamClientPort {
    return protocol === "responses"
      ? deps.clients.responses
      : deps.clients.chatCompletions;
  }

  async function invokeBinding(
    target: CaioModelAliasFallbackCandidate | CaioModelAliasBinding,
    input: CaioProxyExecuteInput,
    apiKey: string,
  ): Promise<CaioUpstreamInvokeResult> {
    const client = clientForProtocol(target.protocol);
    // Passthrough body with ONLY the model field replaced by the upstream
    // model name; tool/function-call fields flow through untouched.
    const upstreamBody: Record<string, unknown> = {
      ...input.body,
      model: target.upstreamModel,
    };
    return client.invoke({
      endpointBaseUrl: target.endpointBaseUrl,
      apiKey,
      body: upstreamBody,
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  function toResult(
    outcome: CaioUpstreamInvokeResult,
    receiptId: string,
    upstream: CaioProxyUpstreamDescriptor,
    fallback: {
      attempted: boolean;
      succeeded: boolean;
      receiptId?: string | null;
    },
  ): CaioProxyExecuteResult {
    const fallbackReceiptId = fallback.receiptId ?? null;
    switch (outcome.status) {
      case "ok":
        return {
          status: "ok",
          httpStatus: 200,
          reasonCode: null,
          receiptId,
          retryAfterSeconds: null,
          body: outcome.body,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: fallback.succeeded,
          fallbackReceiptId,
          auditRefusal: null,
        };
      case "cancelled":
        return {
          status: "cancelled",
          httpStatus: 499,
          reasonCode: "client_cancelled",
          receiptId,
          retryAfterSeconds: null,
          body: null,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: false,
          fallbackReceiptId,
          auditRefusal: null,
        };
      case "upstream_error":
        return upstreamErrorResult(
          outcome,
          receiptId,
          upstream,
          fallback.attempted,
          fallbackReceiptId,
        );
    }
  }

  async function executeUncancelled(
    input: CaioProxyExecuteInput,
  ): Promise<CaioProxyExecuteResult> {
    if (input.signal?.aborted) throw new CaioProxyCancellation();
    const binding = bindingsByAlias.get(input.alias);
    if (!binding) return noRoute("alias_unknown");

    // The caller's OWN grant, resolved before anything else the binding could
    // reveal. A valid model token is not authority over every protocol-matching
    // active binding: without this, a WorkBuddy token could drive a Codex-only
    // alias. Placed ahead of the status/protocol checks so an ungranted alias
    // discloses nothing about the binding behind it, and ahead of the audit
    // claim, the credential load and every upstream call so the refusal costs
    // no receipt and produces no egress.
    const grantedAliases = resolveCaioGrantedAliases(input.audienceContext);
    if (!grantedAliases.has(binding.alias)) return aliasNotGranted();

    // GOVERNED ADMISSION. Both postures: the route this binding names must be
    // admitted by an ACTIVE, human-OWNER-approved policy right now. Placed
    // ahead of the status/protocol checks so an unadmitted alias discloses
    // nothing about the binding behind it, and ahead of the audit claim, the
    // credential load and every upstream call so the refusal costs no receipt
    // and produces no egress.
    const at = clock();
    const admission = await runWithCaioProxyCancellation(
      () => admitRoute(binding, at),
      input.signal,
    );
    if (!admission.admitted) return routeNotAdmitted();

    if (binding.status !== "active") return noRoute("alias_disabled");
    if (binding.protocol !== input.protocol) {
      return noRoute("protocol_mismatch");
    }

    if (deps.rateLimiter) {
      const decision = deps.rateLimiter.check({
        workspaceId: input.audienceContext.workspaceId,
        userRef: input.audienceContext.userRef,
        clientType: input.audienceContext.clientType,
        alias: input.alias,
      });
      if (!decision.allowed) {
        return {
          status: "rate_limited",
          httpStatus: 429,
          reasonCode: "gateway_rate_limited",
          receiptId: null,
          retryAfterSeconds: decision.retryAfterSeconds ?? null,
          body: null,
          upstream: null,
          fallbackAttempted: false,
          fallbackSucceeded: false,
          fallbackReceiptId: null,
          auditRefusal: null,
        };
      }
    }

    // OUTBOUND CONTENT BOUNDARY, in both postures. The body is forwarded
    // verbatim (only `model` is replaced), so this is the last point at which
    // a secret can be stopped from leaving the enterprise network. Before the
    // audit claim, the credential load and any upstream contact: a refused
    // body costs no receipt and produces no egress.
    if (assessCaioOutboundContent(input.body).denied) {
      return contentBoundaryDenied();
    }

    const inputHash = sha256(canonicalJson(input.body));

    // Audit gate BEFORE any credential load and BEFORE any upstream traffic. If
    // the audit store cannot take the claim, the request never reaches an
    // upstream provider and no credential is ever read.
    //
    // The claim carries EXACTLY the six canonical fields; the strict canonical
    // claim schema refuses an extra key outright, so the closed set is enforced
    // at this boundary and not only at the storage boundary.
    const claim: CaioCanonicalAuditClaim = {
      requestId: input.requestId,
      workspaceId: input.audienceContext.workspaceId,
      clientType: input.audienceContext.clientType,
      modelAlias: input.alias,
      inputHash,
      policyVersion: binding.policyVersion,
    };
    const claimed = readClaimOutcome(
      await runWithCaioProxyCancellation(
        () => deps.auditGate.claimDispatch(claim),
        input.signal,
      ),
    );
    if (!claimed.claimed) {
      return refusedClaimResult(claimed.refusal);
    }
    const receiptId = claimed.receiptId;

    let apiKey: string;
    try {
      apiKey = await runWithCaioProxyCancellation(
        () => deps.credentialLoader.load({
          credentialRef: binding.credentialRef,
          ...(input.signal ? { signal: input.signal } : {}),
        }),
        input.signal,
      );
    } catch (error) {
      if (error instanceof CaioProxyCancellation) throw error;
      // Never propagate loader error details (they can describe key files).
      return {
        status: "credential_unavailable",
        httpStatus: 503,
        reasonCode: "credential_unavailable",
        receiptId,
        retryAfterSeconds: null,
        body: null,
        upstream: null,
        fallbackAttempted: false,
        fallbackSucceeded: false,
        fallbackReceiptId: null,
        auditRefusal: null,
      };
    }

    const primaryOutcome = await runWithCaioProxyCancellation(
      () => invokeBinding(binding, input, apiKey),
      input.signal,
    );
    const primaryUpstream = describeUpstream(binding);

    if (primaryOutcome.status !== "upstream_error") {
      return toResult(primaryOutcome, receiptId, primaryUpstream, {
        attempted: false,
        succeeded: false,
      });
    }

    // A fallback is egress on a DIFFERENT route (its own endpoint, upstream
    // model and credential), so it must be inside the caller's grant too — the
    // grant gate cannot be bypassed by an upstream failure on the primary
    // route. An ungranted candidate is not a candidate at all: it is skipped
    // before its receipt is claimed, before its credential is loaded and before
    // any call to it.
    // A fallback also runs on its own GOVERNED route, so it needs its own
    // admission: a candidate whose route is no longer admitted is not a
    // candidate at all. Checked here, before its receipt is claimed, before its
    // credential is loaded and before any call to it.
    let candidate: CaioModelAliasFallbackCandidate | undefined;
    for (const option of binding.fallbackCandidates) {
      if (!isFallbackAllowed(binding, option)) continue;
      if (!grantedAliases.has(option.alias)) continue;
      const optionAdmission = await runWithCaioProxyCancellation(
        () => admitRoute(option, clock()),
        input.signal,
      );
      if (!optionAdmission.admitted) continue;
      candidate = option;
      break;
    }
    if (!candidate) {
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        false,
      );
    }

    // The single receipt claimed above describes the PRIMARY route. A fallback
    // executes on a different endpoint/model, so it gets its own linked receipt
    // naming the route actually used — claimed BEFORE the fallback credential is
    // loaded and before any fallback egress, exactly like the primary claim. If
    // audit cannot record the fallback, the fallback does not happen.
    const fallbackClaim: CaioCanonicalAuditClaim = {
      ...claim,
      requestId: caioFallbackMarkerRequestId({
        requestId: input.requestId,
        route: {
          providerKey: candidate.providerKey,
          endpointBaseUrl: candidate.endpointBaseUrl,
          upstreamModel: candidate.upstreamModel,
        },
      }),
      policyVersion: candidate.policyVersion,
    };
    const fallbackClaimed = readClaimOutcome(
      await runWithCaioProxyCancellation(
        () => deps.auditGate.claimDispatch(fallbackClaim),
        input.signal,
      ),
    );
    if (!fallbackClaimed.claimed) {
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        false,
      );
    }
    const fallbackReceiptId = fallbackClaimed.receiptId;

    // Max ONE fallback attempt, to the first equivalence-passing candidate.
    let fallbackKey: string;
    try {
      fallbackKey = await runWithCaioProxyCancellation(
        () => deps.credentialLoader.load({
          credentialRef: candidate.credentialRef,
          ...(input.signal ? { signal: input.signal } : {}),
        }),
        input.signal,
      );
    } catch (error) {
      if (error instanceof CaioProxyCancellation) throw error;
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        true,
        fallbackReceiptId,
      );
    }

    const fallbackOutcome = await runWithCaioProxyCancellation(
      () => invokeBinding(candidate, input, fallbackKey),
      input.signal,
    );
    return toResult(fallbackOutcome, receiptId, describeUpstream(candidate), {
      attempted: true,
      succeeded: fallbackOutcome.status === "ok",
      receiptId: fallbackReceiptId,
    });
  }

  async function execute(
    input: CaioProxyExecuteInput,
  ): Promise<CaioProxyExecuteResult> {
    try {
      return await executeUncancelled(input);
    } catch (error) {
      if (error instanceof CaioProxyCancellation) return cancelledResult();
      throw error;
    }
  }

  return { execute };
}
