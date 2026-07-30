// CAIO model proxy — orchestration engine used by the LAN gateway.
//
// Pipeline (fail-closed at every step): resolve alias binding → ALIAS GRANT
// check → protocol check → local rate limit → hash input → claim audit dispatch
// (BEFORE any upstream traffic; audit down means no egress) → load credential →
// invoke the protocol-matching upstream client → optional single fallback
// attempt (only before any streamed byte, only to a fail-closed-equivalent
// binding, and only to a candidate inside the caller's grant).
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
import { caioFallbackMarkerRequestId } from "@/lib/caio-audit-state/receipt-linkage";
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
  CaioUpstreamStreamResult,
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
  load(input: { credentialRef: string }): Promise<string>;
};

export type CaioModelProxyDependencies = {
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

export type CaioProxyExecuteInput = {
  audienceContext: CaioAudienceContext;
  alias: string;
  protocol: CaioModelProtocol;
  body: Record<string, unknown>;
  requestId: string;
  signal?: AbortSignal;
  streaming?: boolean;
  onChunk?: (chunk: string) => void;
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
  | "rate_limited"
  | CaioProxyAuditRefusalStatus
  | "credential_unavailable"
  | "upstream_error"
  | "incomplete_stream"
  | "cancelled";

export type CaioProxyExecuteResult = {
  status: CaioProxyExecuteStatus;
  httpStatus: number;
  reasonCode: string | null;
  receiptId: string | null;
  retryAfterSeconds: number | null;
  // Upstream JSON body for non-streaming success; null otherwise (streamed
  // content flows through onChunk and is never buffered here).
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

class CaioModelProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaioModelProxyConfigError";
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

/**
 * Forwarded-chunk count read DEFENSIVELY from any upstream outcome.
 *
 * The streaming contract types `upstream_error` with `chunksForwarded: 0`, but
 * that literal erases at runtime and `deps.clients` is an injected port: a mock,
 * a third protocol adapter, or a downstream-writer failure can report an
 * upstream_error with bytes already handed downstream. Retry/fallback decisions
 * consult this, so the guarantee is enforced at runtime rather than asserted by
 * a type.
 */
function forwardedChunkCount(outcome: unknown): number {
  if (typeof outcome !== "object" || outcome === null) return 0;
  const value = (outcome as { chunksForwarded?: unknown }).chunksForwarded;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

export function createCaioModelProxy(
  deps: CaioModelProxyDependencies,
): CaioModelProxy {
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
  ): Promise<CaioUpstreamInvokeResult | CaioUpstreamStreamResult> {
    const client = clientForProtocol(target.protocol);
    // Passthrough body with ONLY the model field replaced by the upstream
    // model name; tool/function-call fields flow through untouched.
    const upstreamBody: Record<string, unknown> = {
      ...input.body,
      model: target.upstreamModel,
    };
    if (input.streaming) {
      const onChunk = input.onChunk ?? (() => {});
      return client.invokeStreaming({
        endpointBaseUrl: target.endpointBaseUrl,
        apiKey,
        body: upstreamBody,
        onChunk,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    }
    return client.invoke({
      endpointBaseUrl: target.endpointBaseUrl,
      apiKey,
      body: upstreamBody,
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  function toResult(
    outcome: CaioUpstreamInvokeResult | CaioUpstreamStreamResult,
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
          body: "body" in outcome ? outcome.body : null,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: fallback.succeeded,
          fallbackReceiptId,
          auditRefusal: null,
        };
      case "incomplete_stream":
        // Headers were already sent when streaming began; the synthetic
        // terminal marker chunk has been emitted by the client.
        return {
          status: "incomplete_stream",
          httpStatus: 200,
          reasonCode: outcome.reason,
          receiptId,
          retryAfterSeconds: null,
          body: null,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: false,
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

  async function execute(
    input: CaioProxyExecuteInput,
  ): Promise<CaioProxyExecuteResult> {
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
      await deps.auditGate.claimDispatch(claim),
    );
    if (!claimed.claimed) {
      return refusedClaimResult(claimed.refusal);
    }
    const receiptId = claimed.receiptId;

    let apiKey: string;
    try {
      apiKey = await deps.credentialLoader.load({
        credentialRef: binding.credentialRef,
      });
    } catch {
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

    const primaryOutcome = await invokeBinding(binding, input, apiKey);
    const primaryUpstream = describeUpstream(binding);

    if (primaryOutcome.status !== "upstream_error") {
      return toResult(primaryOutcome, receiptId, primaryUpstream, {
        attempted: false,
        succeeded: false,
      });
    }

    // Fallback is only legal before any streamed byte has been HANDED
    // downstream. The streaming contract types upstream_error with
    // chunksForwarded: 0, but that erases at runtime and the client is an
    // injected port, so the count is checked here before any retry decision.
    if (forwardedChunkCount(primaryOutcome) > 0) {
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        false,
      );
    }

    // A fallback is egress on a DIFFERENT route (its own endpoint, upstream
    // model and credential), so it must be inside the caller's grant too — the
    // grant gate cannot be bypassed by an upstream failure on the primary
    // route. An ungranted candidate is not a candidate at all: it is skipped
    // before its receipt is claimed, before its credential is loaded and before
    // any call to it.
    const candidate = binding.fallbackCandidates.find(
      (c) => isFallbackAllowed(binding, c) && grantedAliases.has(c.alias),
    );
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
      await deps.auditGate.claimDispatch(fallbackClaim),
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
      fallbackKey = await deps.credentialLoader.load({
        credentialRef: candidate.credentialRef,
      });
    } catch {
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        true,
        fallbackReceiptId,
      );
    }

    const fallbackOutcome = await invokeBinding(candidate, input, fallbackKey);
    return toResult(fallbackOutcome, receiptId, describeUpstream(candidate), {
      attempted: true,
      succeeded: fallbackOutcome.status === "ok",
      receiptId: fallbackReceiptId,
    });
  }

  return { execute };
}
