import { describe, expect, it, vi } from "vitest";

import {
  isCaioAccessGatewayError,
  type CaioAccessGatewayError,
} from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  caioModelDispatchOutcomeFromProxyResult,
  createCaioGatewayModelDispatchPort,
  createCaioGatewayModelListPort,
} from "@/lib/caio-access-gateway/model-dispatch-bridge";
import { createInMemoryCaioAccessTokenPersistence } from "@/lib/caio-access-gateway/token-store.memory";
import {
  createCaioAccessTokenService,
  type CaioAccessPrincipal,
} from "@/lib/caio-access-gateway/token-store.service";
import {
  CAIO_AUDIT_CONFLICT_ERROR_CODE,
  CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
} from "@/lib/caio-audit-state/audit-state-contracts";
import type { CaioModelAliasBinding } from "@/lib/caio-model-proxy/alias-contracts";
import type { CaioGovernedAdmissionSnapshot } from "@/lib/caio-model-proxy/governed-admission-contracts";
import { createCaioFrozenGovernedAdmission } from "@/lib/caio-model-proxy/governed-route-admission.service";
import {
  createCaioModelProxy,
  type CaioModelProxy,
  type CaioProxyAuditRefusal,
  type CaioProxyExecuteResult,
} from "@/lib/caio-model-proxy/proxy-engine";

const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_bridge_1",
  workspaceId: "ws_bridge",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "model",
});

function proxyResult(
  overrides: Partial<CaioProxyExecuteResult> = {},
): CaioProxyExecuteResult {
  return {
    status: "ok",
    httpStatus: 200,
    reasonCode: null,
    receiptId: "receipt-1",
    retryAfterSeconds: null,
    body: { id: "resp_ok" },
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
    ...overrides,
  };
}

function refusal(
  status: CaioProxyAuditRefusal["status"],
  retryAfterSeconds: number | null,
): CaioProxyAuditRefusal {
  const errorCode = {
    audit_unavailable: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
    receipt_conflict: CAIO_AUDIT_CONFLICT_ERROR_CODE,
    replay_limit_exceeded: CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  }[status];
  const httpStatus = {
    audit_unavailable: 503,
    receipt_conflict: 409,
    replay_limit_exceeded: 429,
  }[status];
  return Object.freeze({ status, errorCode, httpStatus, retryAfterSeconds });
}

function refusedResult(
  status: CaioProxyAuditRefusal["status"],
  retryAfterSeconds: number | null,
): CaioProxyExecuteResult {
  const outcome = refusal(status, retryAfterSeconds);
  return proxyResult({
    status,
    httpStatus: outcome.httpStatus,
    reasonCode: outcome.errorCode,
    receiptId: null,
    retryAfterSeconds,
    body: null,
    auditRefusal: outcome,
  });
}

function caught(run: () => unknown): CaioAccessGatewayError {
  try {
    run();
  } catch (error) {
    if (isCaioAccessGatewayError(error)) return error;
    throw error;
  }
  throw new Error("expected a CaioAccessGatewayError to be thrown");
}

describe("caioModelDispatchOutcomeFromProxyResult", () => {
  it("carries the proxy's audit receipt id through as auditReceiptId", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ receiptId: "receipt-42", body: { id: "resp_42" } }),
    );
    expect(outcome).toEqual({
      claim: "allowed",
      auditReceiptId: "receipt-42",
      body: { id: "resp_42" },
    });
  });

  it("serves a null upstream body as null rather than dropping the allowed arm", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ body: null }),
    );
    expect(outcome).toEqual({
      claim: "allowed",
      auditReceiptId: "receipt-1",
      body: null,
    });
  });

  it("maps a refused audit_unavailable claim to the refused arm with retry advice", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      refusedResult("audit_unavailable", 30),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "audit_unavailable",
      retryAfterSeconds: 30,
    });
  });

  it("maps a refused receipt_conflict claim with a defined null retryAfterSeconds", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      refusedResult("receipt_conflict", null),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "receipt_conflict",
      retryAfterSeconds: null,
    });
    expect(
      outcome.claim === "refused" ? outcome.retryAfterSeconds : "missing",
    ).not.toBeUndefined();
  });

  it("maps a refused replay_limit_exceeded claim distinctly", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      refusedResult("replay_limit_exceeded", null),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "replay_limit_exceeded",
      retryAfterSeconds: null,
    });
  });

  it("keeps the three refusals distinguishable after mapping", () => {
    const mapped = (
      ["audit_unavailable", "receipt_conflict", "replay_limit_exceeded"] as const
    ).map((status) => {
      const outcome = caioModelDispatchOutcomeFromProxyResult(
        refusedResult(status, null),
      );
      return outcome.claim === "refused" ? outcome.refusal : "allowed";
    });
    expect(mapped).toEqual([
      "audit_unavailable",
      "receipt_conflict",
      "replay_limit_exceeded",
    ]);
  });

  it("NEVER fabricates a receipt id when an ok result carries none", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ receiptId: null }),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "audit_unavailable",
      retryAfterSeconds: null,
    });
    expect(JSON.stringify(outcome)).not.toContain("auditReceiptId");
  });

  it("NEVER fabricates a receipt id when an ok result carries an empty one", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ receiptId: "" }),
    );
    expect(outcome).toMatchObject({
      claim: "refused",
      refusal: "audit_unavailable",
    });
  });

  it("refuses fail-closed when a refusal status carries no refusal object", () => {
    // A JS caller can hand over a status with no auditRefusal payload.
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({
        status: "receipt_conflict",
        receiptId: null,
        retryAfterSeconds: null,
        auditRefusal: null,
      }),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "receipt_conflict",
      retryAfterSeconds: null,
    });
  });

  it("collapses an unmodelled refusal status onto audit_unavailable, never onto allowed", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({
        receiptId: "receipt-1",
        auditRefusal: {
          status: "something_new",
          errorCode: "x",
          httpStatus: 200,
          retryAfterSeconds: null,
        } as unknown as CaioProxyAuditRefusal,
      }),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "audit_unavailable",
      retryAfterSeconds: null,
    });
  });

  it("raises a typed 429 for a gateway rate limit instead of serving a body", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "rate_limited",
          httpStatus: 429,
          reasonCode: "gateway_rate_limited",
          receiptId: null,
          retryAfterSeconds: 5,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("rate_limited");
    expect(error.wireStatus).toBe(429);
    expect(error.retryAfterSeconds).toBe(5);
  });

  it("raises a typed 503 no_route for an unroutable alias", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "no_route",
          httpStatus: 503,
          reasonCode: "alias_unknown",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("no_route");
    expect(error.wireStatus).toBe(503);
  });

  // P1-1: an alias the caller is not granted is an AUTHORIZATION refusal. It
  // must not be reported as a retryable 503 availability answer.
  it("raises a typed 403 scope_violation when the alias is outside the caller's grant", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "alias_not_granted",
          httpStatus: 403,
          reasonCode: "alias_not_granted",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("scope_violation");
    expect(error.wireStatus).toBe(403);
    expect(error.retryAfterSeconds).toBeNull();
  });

  // Owner ruling 2026-07-30: an unadmitted governed route is a governance
  // refusal (403), never a retryable availability answer and never a 200.
  it("raises a typed 403 route_not_governed when no policy admits the route", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "route_not_admitted",
          httpStatus: 403,
          reasonCode: "route_not_admitted",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("route_not_governed");
    expect(error.wireStatus).toBe(403);
    expect(error.retryAfterSeconds).toBeNull();
  });

  // A body that crossed the hard content boundary reuses the existing 422
  // release-denied identifier rather than minting a second one for the same
  // meaning.
  it("raises a typed 422 external_release_denied when the content boundary refuses", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "content_boundary_denied",
          httpStatus: 422,
          reasonCode: "content_boundary_denied",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("external_release_denied");
    expect(error.wireStatus).toBe(422);
  });

  it("raises a typed failure for a credential outage even though a receipt exists", () => {
    // The claim succeeded, so a naive mapping would return the allowed arm and
    // the gateway would answer 200 with a null body for a dispatch that failed.
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "credential_unavailable",
          httpStatus: 503,
          reasonCode: "credential_unavailable",
          receiptId: "receipt-1",
          body: null,
        }),
      ),
    );
    expect(error.wireStatus).toBe(503);
  });

  it("raises a typed 502 for an upstream failure", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "upstream_error",
          httpStatus: 502,
          reasonCode: "upstream_failed",
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("upstream_failed");
    expect(error.wireStatus).toBe(502);
  });

  it("preserves an upstream 429 as a rate limit with its retry advice", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "upstream_error",
          httpStatus: 429,
          reasonCode: "upstream_rate_limited",
          retryAfterSeconds: 12,
          body: null,
        }),
      ),
    );
    expect(error.wireStatus).toBe(429);
    expect(error.retryAfterSeconds).toBe(12);
  });

  it("raises a typed failure for a cancelled dispatch", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({ status: "cancelled", body: null }),
      ),
    );
    expect(error.code).toBe("request_cancelled");
    expect(error.wireStatus).toBe(503);
  });
});

describe("createCaioGatewayModelDispatchPort", () => {
  function harness(result: CaioProxyExecuteResult = proxyResult()) {
    const execute = vi.fn(async () => result);
    const proxy: CaioModelProxy = { execute };
    const port = createCaioGatewayModelDispatchPort({ proxy });
    return { execute, port };
  }

  const REQUEST = Object.freeze({
    principal: PRINCIPAL,
    requestId: "ws_bridge:req-1",
    clientCorrelationId: "client-hint-1",
    payload: { model: "caio-codex-default", input: "hello" },
  });

  it("dispatches /v1/responses on the responses protocol", async () => {
    const h = harness();
    const outcome = await h.port.responses(REQUEST);
    expect(outcome).toMatchObject({
      claim: "allowed",
      auditReceiptId: "receipt-1",
    });
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute.mock.calls[0][0]).toMatchObject({
      protocol: "responses",
      alias: "caio-codex-default",
      requestId: "ws_bridge:req-1",
      audienceContext: {
        workspaceId: "ws_bridge",
        userRef: "user:ceo",
        clientType: "codex",
      },
      body: { model: "caio-codex-default", input: "hello" },
    });
  });

  it("carries the host cancellation signal into the proxy", async () => {
    const h = harness();
    const controller = new AbortController();
    await h.port.responses({
      ...REQUEST,
      signal: controller.signal,
    } as Parameters<typeof h.port.responses>[0] & { signal: AbortSignal });

    expect(h.execute.mock.calls[0][0].signal).toBe(controller.signal);
  });

  it("dispatches /v1/chat/completions on the chat_completions protocol", async () => {
    const h = harness();
    await h.port.chatCompletions(REQUEST);
    expect(h.execute.mock.calls[0][0]).toMatchObject({
      protocol: "chat_completions",
    });
  });

  it("uses the server-generated request id, never the client correlation hint", async () => {
    const h = harness();
    await h.port.responses(REQUEST);
    const call = h.execute.mock.calls[0][0];
    expect(call.requestId).toBe("ws_bridge:req-1");
    expect(JSON.stringify(call)).not.toContain("client-hint-1");
  });

  // Per-token alias grant: the principal is the ONLY place the grant can come
  // from (a client cannot supply it), so the bridge has to carry it verbatim —
  // including an empty grant, which denies every alias and must not be
  // confused with "no grant configured".
  it("carries the principal's explicit alias grant into the proxy", async () => {
    const h = harness();
    await h.port.responses({
      ...REQUEST,
      principal: { ...PRINCIPAL, grantedAliases: ["caio-codex-default"] },
    });
    expect(h.execute.mock.calls[0][0].audienceContext.grantedAliases).toEqual([
      "caio-codex-default",
    ]);
  });

  it("carries an EMPTY grant as an empty grant, never as an absent one", async () => {
    const h = harness();
    await h.port.responses({
      ...REQUEST,
      principal: { ...PRINCIPAL, grantedAliases: [] },
    });
    expect(h.execute.mock.calls[0][0].audienceContext.grantedAliases).toEqual(
      [],
    );
  });

  it("omits grantedAliases when the token carries none, so the client-type default applies", async () => {
    const h = harness();
    await h.port.responses(REQUEST);
    expect(
      "grantedAliases" in h.execute.mock.calls[0][0].audienceContext,
    ).toBe(false);
  });

  it("asks the proxy for a plain dispatch: no streaming field exists to set", async () => {
    const h = harness();
    await h.port.responses(REQUEST);
    // The proxy input has no streaming/chunk surface at all — the product does
    // not ship streaming, so there is nothing here to turn on by accident.
    expect(
      Object.keys(h.execute.mock.calls[0][0] as Record<string, unknown>).sort(),
    ).toEqual([
      "alias",
      "audienceContext",
      "body",
      "protocol",
      "requestId",
    ]);
  });

  it("refuses a payload that is not a JSON object", async () => {
    const h = harness();
    for (const payload of [null, "text", 7, [1, 2]]) {
      const error = await h.port
        .responses({ ...REQUEST, payload })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(isCaioAccessGatewayError(error)).toBe(true);
      expect((error as CaioAccessGatewayError).wireStatus).toBe(400);
    }
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses a payload with no usable model alias", async () => {
    const h = harness();
    for (const payload of [{}, { model: "" }, { model: 7 }]) {
      const error = await h.port
        .responses({ ...REQUEST, payload })
        .then(() => null)
        .catch((e: unknown) => e);
      expect((error as CaioAccessGatewayError).wireStatus).toBe(400);
    }
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses a streaming request instead of answering it as buffered JSON", async () => {
    const h = harness();
    const error = await h.port
      .responses({ ...REQUEST, payload: { ...REQUEST.payload, stream: true } })
      .then(() => null)
      .catch((e: unknown) => e);
    expect((error as CaioAccessGatewayError).wireStatus).toBe(400);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses a principal whose client type the proxy does not model", async () => {
    const h = harness();
    const error = await h.port
      .responses({
        ...REQUEST,
        principal: {
          ...PRINCIPAL,
          clientType: "unknown_client",
        } as unknown as CaioAccessPrincipal,
      })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(isCaioAccessGatewayError(error)).toBe(true);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("maps a refused claim from the proxy straight onto the refused arm", async () => {
    const h = harness(refusedResult("receipt_conflict", null));
    const outcome = await h.port.responses(REQUEST);
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "receipt_conflict",
      retryAfterSeconds: null,
    });
  });
});

// THE DATA PATH, END TO END: issue a token with a grant → authenticate it →
// dispatch through the bridge → the real proxy enforces exactly that grant.
// Before this path existed the explicit branch of resolveCaioGrantedAliases
// was unreachable in production and every token fell back to the client-type
// default, so these three cases are the ones that prove it is real.
describe("per-token alias grant: token store to proxy", () => {
  const GOVERNED_POLICY_KEY = "caio-lan-default";
  const ROUTE_REF = "route-provider-a-primary";
  const POLICY_VALID_UNTIL = "2099-01-01T00:00:00.000Z";
  const NOW = new Date("2026-07-31T08:00:00.000Z");
  const SOURCE_IP = [192, 168, 1, 10].join(".");

  function binding(alias: string): CaioModelAliasBinding {
    return {
      alias,
      protocol: "responses",
      providerKey: "provider-a",
      upstreamModel: `upstream-for-${alias}`,
      credentialRef: "provider-a-key",
      endpointBaseUrl: "https://upstream.example.internal/v1",
      region: "cn-hangzhou",
      dataRetentionPolicyKey: "retention-days:30",
      trainingUsePolicyKey: "prohibited",
      dataAuthorizationKey: "auth-tier-1",
      policyVersion: "policy-v3",
      status: "active",
      governedPolicyKey: GOVERNED_POLICY_KEY,
      governedRouteRef: ROUTE_REF,
      fallbackCandidates: [],
    };
  }

  function snapshot(): CaioGovernedAdmissionSnapshot {
    return {
      policyKey: GOVERNED_POLICY_KEY,
      policyId: "policy:caio-lan-default-v1",
      policyHash: `sha256:${"e".repeat(64)}`,
      policyHeadVersion: 3,
      policyRevocationEpoch: 0,
      resolvedAt: "2026-07-30T00:00:00.000Z",
      validUntil: POLICY_VALID_UNTIL,
      routes: new Map([
        [
          ROUTE_REF,
          {
            routeRef: ROUTE_REF,
            policyKey: GOVERNED_POLICY_KEY,
            policyId: "policy:caio-lan-default-v1",
            policyHash: `sha256:${"e".repeat(64)}`,
            policyHeadVersion: 3,
            policyRevocationEpoch: 0,
            provider: "provider-a",
            credentialRef: "provider-a-key",
            region: "cn-hangzhou",
            deploymentForm: "private_deployment",
            jurisdiction: "customer_premises",
            retentionPolicyKey: "retention-days:30",
            trainingUsePolicyKey: "prohibited",
            pricingVersion: "provider-a-pricing-202607",
            maxOutputTokens: 4_000,
            policyValidUntil: POLICY_VALID_UNTIL,
          },
        ],
      ]),
    };
  }

  const ALT_ALIAS = "caio-codex-alt";

  async function chain(grantedAliases?: readonly string[]) {
    const persistence = createInMemoryCaioAccessTokenPersistence();
    const tokens = createCaioAccessTokenService({ persistence });
    const pair = await tokens.issueCaioTokenPair({
      workspaceId: "ws_bridge",
      userRef: "user:ceo",
      clientType: "codex",
      deviceRef: "device:mac-studio",
      approvedSourceIp: SOURCE_IP,
      ...(grantedAliases === undefined ? {} : { grantedAliases }),
      now: NOW,
    });
    const principal = await tokens.authenticateCaioToken({
      rawToken: pair.model.rawToken,
      expectedAudience: "model",
      sourceIp: SOURCE_IP,
      now: NOW,
    });
    const upstream = vi.fn(async () => ({
      status: "ok" as const,
      upstreamStatus: 200,
      body: { id: "resp_ok" },
    }));
    const client = { invoke: upstream };
    const proxy = createCaioModelProxy({
      posture: "self_service",
      bindings: [binding("caio-codex-default"), binding(ALT_ALIAS)],
      governedAdmission: createCaioFrozenGovernedAdmission(snapshot()),
      credentialLoader: { load: async () => "loaded-secret" },
      clients: { responses: client, chatCompletions: client },
      auditGate: {
        posture: "self_service",
        claimDispatch: async () => ({
          status: "allowed" as const,
          receiptId: "receipt-1",
          persistedVia: "primary" as const,
          dispatchAttempt: 1,
        }),
      },
    });
    const port = createCaioGatewayModelDispatchPort({ proxy });

    async function drive(alias: string) {
      return port
        .responses({
          principal,
          requestId: "ws_bridge:req-1",
          clientCorrelationId: null,
          payload: { model: alias, input: "hello" },
        })
        .then((outcome) => outcome as unknown)
        .catch((error: unknown) => error);
    }

    return { drive, upstream };
  }

  it("an explicit grant drives ONLY the granted alias", async () => {
    const { drive, upstream } = await chain([ALT_ALIAS]);

    const granted = await drive(ALT_ALIAS);
    expect(granted).toMatchObject({ claim: "allowed" });

    // The client-type DEFAULT alias is now refused: the explicit grant is
    // authoritative, not additive.
    const refused = await drive("caio-codex-default");
    expect(isCaioAccessGatewayError(refused)).toBe(true);
    expect((refused as CaioAccessGatewayError).code).toBe("scope_violation");
    expect((refused as CaioAccessGatewayError).wireStatus).toBe(403);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("an EMPTY explicit grant drives nothing at all", async () => {
    const { drive, upstream } = await chain([]);
    for (const alias of ["caio-codex-default", ALT_ALIAS]) {
      const refused = await drive(alias);
      expect(isCaioAccessGatewayError(refused)).toBe(true);
      expect((refused as CaioAccessGatewayError).code).toBe("scope_violation");
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("no stored grant falls back to the client-type default", async () => {
    const { drive, upstream } = await chain();

    const allowed = await drive("caio-codex-default");
    expect(allowed).toMatchObject({ claim: "allowed" });

    const refused = await drive(ALT_ALIAS);
    expect(isCaioAccessGatewayError(refused)).toBe(true);
    expect((refused as CaioAccessGatewayError).code).toBe("scope_violation");
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

// The discovery surface must be produced from the SAME bindings the dispatch
// path resolves against, and must narrow by the SAME three-valued grant. When
// it was left to the deployment to supply, nothing in the tree could stop an
// implementation that answered from the client-type default and so listed
// aliases to a token that had been granted none.
describe("createCaioGatewayModelListPort", () => {
  const GOVERNED_POLICY_KEY = "caio-lan-default";
  const ROUTE_REF = "route:caio-lan-default:v3";

  function binding(
    alias: string,
    status: "active" | "disabled" = "active",
  ): CaioModelAliasBinding {
    return {
      alias,
      protocol: "responses",
      providerKey: "provider-a",
      upstreamModel: `upstream-for-${alias}`,
      credentialRef: "provider-a-key",
      endpointBaseUrl: "https://upstream.example.internal/v1",
      region: "cn-hangzhou",
      dataRetentionPolicyKey: "retention-days:30",
      trainingUsePolicyKey: "prohibited",
      dataAuthorizationKey: "auth-tier-1",
      policyVersion: "policy-v3",
      status,
      governedPolicyKey: GOVERNED_POLICY_KEY,
      governedRouteRef: ROUTE_REF,
      fallbackCandidates: [],
    };
  }

  const BINDINGS = [
    binding("caio-codex-default"),
    binding("caio-workbuddy-default"),
    binding("caio-codex-retired", "disabled"),
  ];

  function ids(result: unknown): string[] {
    const data = (result as { data: { id: string }[] }).data;
    return data.map((entry) => entry.id);
  }

  it("returns nothing for an explicit empty grant", async () => {
    const port = createCaioGatewayModelListPort({ bindings: BINDINGS });
    const result = await port.listModels({
      workspaceId: "ws_1",
      userRef: "user:ceo",
      clientType: "codex",
      grantedAliases: [],
    });
    expect(ids(result)).toEqual([]);
  });

  it("returns exactly the explicitly granted aliases", async () => {
    const port = createCaioGatewayModelListPort({ bindings: BINDINGS });
    const result = await port.listModels({
      workspaceId: "ws_1",
      userRef: "user:ceo",
      clientType: "codex",
      grantedAliases: ["caio-workbuddy-default"],
    });
    expect(ids(result)).toEqual(["caio-workbuddy-default"]);
  });

  it("falls back to the client-type default when no grant is stored", async () => {
    const port = createCaioGatewayModelListPort({ bindings: BINDINGS });
    const result = await port.listModels({
      workspaceId: "ws_1",
      userRef: "user:ceo",
      clientType: "codex",
    });
    expect(ids(result)).toEqual(["caio-codex-default"]);
  });

  it("never lists a disabled binding even when it is explicitly granted", async () => {
    const port = createCaioGatewayModelListPort({ bindings: BINDINGS });
    const result = await port.listModels({
      workspaceId: "ws_1",
      userRef: "user:ceo",
      clientType: "codex",
      grantedAliases: ["caio-codex-retired"],
    });
    expect(ids(result)).toEqual([]);
  });

  it("grants nothing to a client type the stable alias surface does not model", async () => {
    const port = createCaioGatewayModelListPort({ bindings: BINDINGS });
    const result = await port.listModels({
      workspaceId: "ws_1",
      userRef: "user:ceo",
      clientType: "not-a-modelled-client",
    });
    expect(ids(result)).toEqual([]);
  });
});
