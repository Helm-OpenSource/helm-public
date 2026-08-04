// CAIO access gateway — the model-dispatch bridge.
//
// WHY THIS FILE EXISTS
// The gateway HTTP core consumes CaioModelDispatchOutcome
// ({claim:"allowed", auditReceiptId, body} | {claim:"refused", refusal,
// retryAfterSeconds}) and refuses anything that is not receipt-backed, while the
// model proxy answers in its own richer CaioProxyExecuteResult vocabulary. This
// is the ONE place the two meet, so the delegation chain
//
//     gateway HTTP core → model proxy → canonical audit gate
//
// is connected end to end with no shim inside either side, and the audit
// receipt the proxy claimed BEFORE any egress is what the gateway serves on.
//
// Two boundary rules are absolute here:
//   1. A receipt id is never invented. If the proxy reports a dispatch with no
//      non-empty receipt id, that is "no claim was recorded" and it is refused
//      as an audit outage — the same reading the gateway applies defensively.
//   2. A failed dispatch is never mapped onto the allowed arm.
//      CaioModelDispatchOutcome has no arm for a non-audit failure (no route,
//      credential outage, upstream 502/429, cancelled or truncated stream), so
//      mapping one there would answer HTTP 200 with a null body for a request
//      that failed. Those statuses are raised as the typed
//      CaioAccessGatewayError the handler already maps onto the wire contract,
//      which keeps the status honest (503 / 502 / 429 with Retry-After).

import {
  CaioAccessGatewayError,
  type CaioAuditRefusalStatus,
} from "@/lib/caio-access-gateway/gateway-error-contract";
import type {
  CaioModelDispatchOutcome,
  CaioModelProxyPort,
} from "@/lib/caio-access-gateway/gateway-http-core";
import {
  caioModelAliasBindingSchema,
  listModelsForGrant,
  resolveCaioGrantedAliases,
  type CaioModelAliasBinding,
} from "@/lib/caio-model-proxy/alias-contracts";
import {
  CAIO_PROXY_CLIENT_TYPES,
  type CaioModelProxy,
  type CaioProxyClientType,
  type CaioProxyExecuteResult,
} from "@/lib/caio-model-proxy/proxy-engine";

/**
 * Total record over the refusal taxonomy: a status added upstream fails this
 * file's typecheck instead of silently falling through to a default.
 */
const REFUSAL_STATUSES: Readonly<Record<CaioAuditRefusalStatus, true>> =
  Object.freeze({
    audit_unavailable: true,
    receipt_conflict: true,
    replay_limit_exceeded: true,
  });

/** Any unrecognized value reads as an outage — never as an allowed claim. */
function asRefusalStatus(value: unknown): CaioAuditRefusalStatus {
  return typeof value === "string" && Object.hasOwn(REFUSAL_STATUSES, value)
    ? (value as CaioAuditRefusalStatus)
    : "audit_unavailable";
}

function refusedOutcome(
  status: CaioAuditRefusalStatus,
  retryAfterSeconds: unknown,
): CaioModelDispatchOutcome {
  return Object.freeze({
    claim: "refused" as const,
    refusal: status,
    // Never undefined: the transport emits Retry-After only for a number.
    retryAfterSeconds:
      typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : null,
  });
}

function retryOption(
  seconds: number | null,
): Readonly<{ retryAfterSeconds?: number }> {
  return seconds === null ? {} : { retryAfterSeconds: seconds };
}

/**
 * Map one proxy execution onto the gateway's model-dispatch outcome.
 *
 * Returns the outcome for the two shapes that union can express — a
 * receipt-backed success and a refused audit claim. Every other proxy status is
 * RAISED as a typed CaioAccessGatewayError (see the module header): there is no
 * arm that can carry a non-audit failure, and the allowed arm would turn it into
 * a 200.
 */
export function caioModelDispatchOutcomeFromProxyResult(
  result: CaioProxyExecuteResult,
): CaioModelDispatchOutcome {
  // The canonical refusal object, when present, is authoritative: it is the
  // audit gate's own outcome carried through the proxy unchanged.
  if (result.auditRefusal !== null && result.auditRefusal !== undefined) {
    return refusedOutcome(
      asRefusalStatus(result.auditRefusal.status),
      result.auditRefusal.retryAfterSeconds,
    );
  }

  switch (result.status) {
    // A refusal status with no refusal object still refuses, never serves.
    case "audit_unavailable":
    case "receipt_conflict":
    case "replay_limit_exceeded":
      return refusedOutcome(result.status, result.retryAfterSeconds);

    case "ok": {
      const receiptId = result.receiptId;
      if (typeof receiptId !== "string" || receiptId.length === 0) {
        // No receipt evidence: nothing proves a durable audit write happened
        // before egress, so this is refused exactly like an audit outage. A
        // receipt id is NEVER synthesized to satisfy the allowed arm.
        return refusedOutcome("audit_unavailable", null);
      }
      return Object.freeze({
        claim: "allowed" as const,
        auditReceiptId: receiptId,
        body: result.body ?? null,
      });
    }

    case "rate_limited":
      throw new CaioAccessGatewayError(
        "rate_limited",
        retryOption(result.retryAfterSeconds),
      );

    case "no_route":
      throw new CaioAccessGatewayError("no_route");

    case "alias_not_granted":
      // Authorization, not availability: the caller's alias grant does not
      // cover the requested route. 403 scope_violation — never a retryable 503,
      // which would both invite a retry that can never succeed and describe an
      // ungranted route as merely unavailable.
      throw new CaioAccessGatewayError("scope_violation");

    case "route_not_admitted":
      // Governance, not availability: no approved policy admits this route, so
      // the request is refused with a 403 that discloses nothing further. It
      // never reached the audit gate, a credential, or an upstream.
      throw new CaioAccessGatewayError("route_not_governed");

    case "content_boundary_denied":
      // The outbound body crossed the hard content boundary. Reuses the
      // existing 422 external_release_denied code rather than minting a new
      // wire identifier for the same meaning: this release is not permitted.
      throw new CaioAccessGatewayError("external_release_denied");

    case "credential_unavailable":
      // A receipt may exist, but no upstream was reached: 503, not 200.
      throw new CaioAccessGatewayError("no_route");

    case "upstream_error":
      // An upstream rate limit keeps its 429 and its retry advice; every other
      // upstream failure is an opaque 502 (no upstream body ever leaks).
      throw result.httpStatus === 429
        ? new CaioAccessGatewayError(
            "rate_limited",
            retryOption(result.retryAfterSeconds),
          )
        : new CaioAccessGatewayError("upstream_failed");

    case "cancelled":
      // The caller abandoned the dispatch before the upstream answered. There
      // is no body to serve, so fail closed rather than answer 200 with null.
      throw new CaioAccessGatewayError("request_cancelled", {
        retryAfterSeconds: 1,
      });

    default: {
      const unexpected: never = result.status;
      void unexpected;
      return refusedOutcome("audit_unavailable", null);
    }
  }
}

function asClientType(value: unknown): CaioProxyClientType {
  const match = CAIO_PROXY_CLIENT_TYPES.find((type) => type === value);
  if (match === undefined) {
    // The principal comes from an injectable authenticator; a client type the
    // proxy does not model must not be smuggled into an audit receipt.
    throw new CaioAccessGatewayError("bad_request");
  }
  return match;
}

function asJsonObjectPayload(payload: unknown): Record<string, unknown> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new CaioAccessGatewayError("bad_request");
  }
  return payload as Record<string, unknown>;
}

function readAlias(body: Record<string, unknown>): string {
  const model = body.model;
  if (typeof model !== "string" || model.length === 0) {
    throw new CaioAccessGatewayError("bad_request");
  }
  return model;
}

/**
 * Turn a CaioModelProxy into the gateway's model-dispatch surface.
 *
 * `listModels` is deliberately NOT produced here: listing the aliases granted to
 * a token is a configuration read with no dispatch and no egress (and therefore
 * no receipt), so it is wired separately from the dispatch path.
 */
export function createCaioGatewayModelDispatchPort(deps: {
  proxy: CaioModelProxy;
}): Pick<CaioModelProxyPort, "responses" | "chatCompletions"> {
  async function dispatch(
    protocol: "responses" | "chat_completions",
    input: {
      principal: {
        workspaceId: string;
        userRef: string;
        clientType: string;
        /**
         * The per-token alias grant read from the token row at authentication.
         * Carried verbatim: `undefined` means "no grant stored, use the client
         * type's default", and `[]` means "explicitly nothing", so the two may
         * never be collapsed.
         */
        grantedAliases?: readonly string[];
      };
      requestId: string;
      /** Correlation hint only: never an audit identity. Unused on purpose. */
      clientCorrelationId: string | null;
      payload: unknown;
      signal?: AbortSignal;
    },
  ): Promise<CaioModelDispatchOutcome> {
    const body = asJsonObjectPayload(input.payload);
    if (body.stream === true) {
      // The product does not ship streaming: the gateway response shape is a
      // buffered JSON body and no layer below it has a streaming call shape
      // either. Refusing is the honest answer — serving a buffered body to a
      // client that asked for SSE would silently break it.
      throw new CaioAccessGatewayError("bad_request");
    }
    const result = await deps.proxy.execute({
      audienceContext: {
        workspaceId: input.principal.workspaceId,
        userRef: input.principal.userRef,
        clientType: asClientType(input.principal.clientType),
        // Present-vs-absent is load-bearing: an absent key means the proxy
        // resolves the client type's default grant, while an empty array is an
        // explicit grant of nothing.
        ...(input.principal.grantedAliases === undefined
          ? {}
          : { grantedAliases: input.principal.grantedAliases }),
      },
      alias: readAlias(body),
      protocol,
      body,
      // The server-generated request id is the audit identity. The client's own
      // correlation header is never used here.
      requestId: input.requestId,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return caioModelDispatchOutcomeFromProxyResult(result);
  }

  return Object.freeze({
    responses: (input) => dispatch("responses", input),
    chatCompletions: (input) => dispatch("chat_completions", input),
  });
}

/**
 * Produce the gateway's alias-discovery surface from the SAME bindings the
 * dispatch path resolves against.
 *
 * This used to be left to the deployment to supply, which is what made the
 * discovery leak possible: the port was handed only workspace/user/client type,
 * so the only answer any implementation could give was the client type's
 * default — and a token carrying an explicit empty grant (which the token
 * contract defines as "every alias is refused") was still told which aliases
 * exist. Producing it here removes the possibility rather than documenting the
 * obligation: there is no injected implementation left to get it wrong.
 *
 * Narrowing is delegated to the same two functions the dispatch path uses, so
 * discovery and dispatch cannot drift apart:
 *   - resolveCaioGrantedAliases honours the three-valued grant and drops any
 *     entry that fails the alias schema, so a malformed stored value can never
 *     widen a grant;
 *   - listModelsForGrant additionally omits any binding that is not `active`,
 *     so a suspended route is absent from discovery even when it is explicitly
 *     granted.
 *
 * Bindings are re-parsed here rather than trusted: this port is constructed
 * from deployment configuration, and a binding that would be refused at
 * dispatch time must not be advertised at discovery time.
 */
export function createCaioGatewayModelListPort(deps: {
  bindings: readonly CaioModelAliasBinding[];
}): Pick<CaioModelProxyPort, "listModels"> {
  const bindings = Object.freeze(
    deps.bindings.map((raw) => caioModelAliasBindingSchema.parse(raw)),
  );

  return Object.freeze({
    async listModels(input) {
      const granted = resolveCaioGrantedAliases({
        clientType: input.clientType,
        // Present-vs-absent is preserved all the way down: passing the key with
        // an undefined value would make the explicit-grant branch look taken.
        ...(input.grantedAliases === undefined
          ? {}
          : { grantedAliases: input.grantedAliases }),
      });
      return listModelsForGrant({
        bindings,
        grantedAliases: [...granted],
      });
    },
  });
}
