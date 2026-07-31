import { describe, expect, it, vi } from "vitest";

import {
  CAIO_AUDIT_CONFLICT_ERROR_CODE,
  CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
} from "@/lib/caio-audit-state/audit-state-contracts";
import {
  CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP,
  caioCanonicalAuditClaimSchema,
  type CaioCanonicalAuditClaim,
  type CaioCanonicalAuditGateOutcome,
} from "@/lib/caio-audit-state/gateway-audit-gate-adapter";
import {
  caioFallbackMarkerRequestId,
  caioRouteFingerprint,
} from "@/lib/caio-audit-state/receipt-linkage";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import type {
  CaioModelAliasBinding,
  CaioModelAliasFallbackCandidate,
} from "./alias-contracts";
import type {
  CaioGovernedAdmissionSnapshot,
  CaioGovernedRouteAdmission,
} from "./governed-admission-contracts";
import { createCaioFrozenGovernedAdmission } from "./governed-route-admission.service";
import { createCaioModelProxy } from "./proxy-engine";
import type {
  CaioProxyUpstreamClientPort,
  CaioProxyUpstreamInvocation,
  CaioUpstreamInvokeResult,
} from "./upstream/upstream-contracts";

const SECRET_PROMPT = "TOP-SECRET-PROMPT-CONTENT";

const UPSTREAM_500: CaioUpstreamInvokeResult = {
  status: "upstream_error",
  code: "upstream_failed",
  gatewayStatus: 502,
  upstreamStatus: 500,
  retryAfterSeconds: null,
};

/**
 * The canonical allowed outcome, in the vocabulary published by
 * caio-audit-state. The engine consumes this union verbatim — it no longer
 * declares a third `{allowed, state}` audit decision of its own.
 */
const ALLOWED_OUTCOME: CaioCanonicalAuditGateOutcome = Object.freeze({
  status: "allowed",
  receiptId: "receipt-1",
  persistedVia: "primary",
  dispatchAttempt: 1,
});

/** A canonical refusal, exactly as createCaioCanonicalAuditGatePort emits it. */
function refusal(
  status: "audit_unavailable" | "receipt_conflict" | "replay_limit_exceeded",
  overrides: Partial<{
    errorCode: string;
    httpStatus: number;
    retryAfterSeconds: number | null;
  }> = {},
): CaioCanonicalAuditGateOutcome {
  const defaults = {
    audit_unavailable: {
      errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
      httpStatus: 503,
      retryAfterSeconds: 30 as number | null,
    },
    receipt_conflict: {
      errorCode: CAIO_AUDIT_CONFLICT_ERROR_CODE,
      httpStatus: 409,
      retryAfterSeconds: null as number | null,
    },
    replay_limit_exceeded: {
      errorCode: CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
      httpStatus: 429,
      retryAfterSeconds: null as number | null,
    },
  }[status];
  return Object.freeze({ status, ...defaults, ...overrides });
}

// Every binding names a GOVERNED route (owner ruling, 2026-07-30): the two
// fields are required by the alias contract, and the frozen admission snapshot
// below is what admits them.
const GOVERNED_POLICY_KEY = "caio-lan-default";
const PRIMARY_ROUTE_REF = "route-provider-a-primary";
const FALLBACK_ROUTE_REF = "route-provider-a-fallback";
// Governed admission and fallback EQUIVALENCE are independent layers: these
// two routes are legitimately admitted by the policy, and the fallback rule
// still refuses to fall back onto them (different provider / different region).
const PROVIDER_B_ROUTE_REF = "route-provider-b";
const REGION_US_ROUTE_REF = "route-provider-a-us";
const POLICY_VALID_UNTIL = "2099-01-01T00:00:00.000Z";

function makeCandidate(
  overrides: Partial<CaioModelAliasFallbackCandidate> = {},
): CaioModelAliasFallbackCandidate {
  return {
    alias: "caio-codex-fallback",
    protocol: "responses",
    providerKey: "provider-a",
    upstreamModel: "provider-a-large-2",
    credentialRef: "provider-a-key-b",
    endpointBaseUrl: "https://upstream.example.internal/v1",
    region: "cn-hangzhou",
    dataRetentionPolicyKey: "retention-days:30",
    trainingUsePolicyKey: "prohibited",
    dataAuthorizationKey: "auth-tier-1",
    policyVersion: "policy-v3",
    status: "active",
    governedPolicyKey: GOVERNED_POLICY_KEY,
    governedRouteRef: FALLBACK_ROUTE_REF,
    ...overrides,
  };
}

function makeBinding(
  overrides: Partial<CaioModelAliasBinding> = {},
): CaioModelAliasBinding {
  return {
    ...makeCandidate(),
    alias: "caio-codex-default",
    upstreamModel: "provider-a-large-1",
    credentialRef: "provider-a-key",
    governedRouteRef: PRIMARY_ROUTE_REF,
    fallbackCandidates: [],
    ...overrides,
  };
}

function makeRoute(
  overrides: Partial<CaioGovernedRouteAdmission> = {},
): CaioGovernedRouteAdmission {
  return {
    routeRef: PRIMARY_ROUTE_REF,
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
    ...overrides,
  };
}

/** The frozen snapshot a self-service install resolves once, at load. */
function makeSnapshot(
  routes: readonly CaioGovernedRouteAdmission[] = [
    makeRoute(),
    makeRoute({
      routeRef: FALLBACK_ROUTE_REF,
      credentialRef: "provider-a-key-b",
    }),
    makeRoute({
      routeRef: PROVIDER_B_ROUTE_REF,
      provider: "provider-b",
      credentialRef: "provider-a-key-b",
    }),
    makeRoute({
      routeRef: REGION_US_ROUTE_REF,
      region: "us-east-1",
      credentialRef: "provider-a-key-b",
    }),
  ],
  overrides: Partial<CaioGovernedAdmissionSnapshot> = {},
): CaioGovernedAdmissionSnapshot {
  return {
    policyKey: GOVERNED_POLICY_KEY,
    policyId: "policy:caio-lan-default-v1",
    policyHash: `sha256:${"e".repeat(64)}`,
    policyHeadVersion: 3,
    policyRevocationEpoch: 0,
    resolvedAt: "2026-07-30T00:00:00.000Z",
    validUntil: POLICY_VALID_UNTIL,
    routes: new Map(routes.map((route) => [route.routeRef, route])),
    ...overrides,
  };
}

function makeHarness(input: {
  bindings?: CaioModelAliasBinding[];
  responsesInvokeResults?: CaioUpstreamInvokeResult[];
  snapshot?: CaioGovernedAdmissionSnapshot;
  now?: () => Date;
} = {}) {
  const events: string[] = [];
  const okResult: CaioUpstreamInvokeResult = {
    status: "ok",
    upstreamStatus: 200,
    body: { id: "resp_ok" },
  };
  const queue = [...(input.responsesInvokeResults ?? [okResult])];
  const nextResult = () => queue.shift() ?? okResult;

  const responsesInvoke = vi.fn(
    async (_input: CaioProxyUpstreamInvocation) => {
      events.push("upstream");
      return nextResult() as CaioUpstreamInvokeResult;
    },
  );
  const chatInvoke = vi.fn(
    async (_input: CaioProxyUpstreamInvocation) => {
      events.push("upstream-chat");
      return okResult;
    },
  );

  const clients: {
    responses: CaioProxyUpstreamClientPort;
    chatCompletions: CaioProxyUpstreamClientPort;
  } = {
    responses: { invoke: responsesInvoke },
    chatCompletions: { invoke: chatInvoke },
  };

  const claimDispatch = vi.fn(
    async (
      _claim: CaioCanonicalAuditClaim,
    ): Promise<CaioCanonicalAuditGateOutcome> => {
      events.push("audit");
      return ALLOWED_OUTCOME;
    },
  );
  const credentialLoad = vi.fn(
    async ({ credentialRef }: { credentialRef: string }) => {
      // Ordering probe: the audit claim must precede every credential load,
      // on the primary path and on the fallback path.
      events.push("credential");
      return `loaded-secret-for-${credentialRef}`;
    },
  );

  const proxy = createCaioModelProxy({
    posture: "self_service",
    bindings: input.bindings ?? [makeBinding()],
    credentialLoader: { load: credentialLoad },
    clients,
    auditGate: { posture: "self_service", claimDispatch },
    governedAdmission: createCaioFrozenGovernedAdmission(
      input.snapshot ?? makeSnapshot(),
    ),
    ...(input.now ? { now: input.now } : {}),
  });

  return {
    proxy,
    events,
    responsesInvoke,
    chatInvoke,
    claimDispatch,
    credentialLoad,
  };
}

function baseExecuteInput(overrides: Record<string, unknown> = {}) {
  return {
    audienceContext: {
      workspaceId: "ws-1",
      userRef: "user-1",
      clientType: "codex" as const,
      // The token's alias grant. Both the primary alias and the fallback
      // candidate's alias are granted here so the fallback fixtures below
      // exercise the fallback rules rather than the grant gate; the grant gate
      // itself is exercised in "alias grant enforcement".
      grantedAliases: ["caio-codex-default", "caio-codex-fallback"],
    },
    alias: "caio-codex-default",
    protocol: "responses" as const,
    body: {
      model: "caio-codex-default",
      input: SECRET_PROMPT,
      tools: [{ type: "function", name: "lookup" }],
    },
    requestId: "req-1",
    ...overrides,
  };
}

describe("createCaioModelProxy configuration", () => {
  it("rejects duplicate alias bindings at construction", () => {
    expect(() =>
      makeHarness({ bindings: [makeBinding(), makeBinding()] }),
    ).toThrow(/duplicate alias/);
  });

  it("rejects malformed bindings at construction", () => {
    expect(() =>
      makeHarness({
        bindings: [
          makeBinding({ credentialRef: "../escape" }),
        ],
      }),
    ).toThrow();
  });
});

describe("alias resolution", () => {
  it("returns no_route (503) for an unknown alias without touching audit or upstream", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({ alias: "caio-nonexistent" }),
    );
    expect(result).toMatchObject({
      status: "no_route",
      httpStatus: 503,
      reasonCode: "alias_unknown",
      receiptId: null,
    });
    expect(h.claimDispatch).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("returns no_route for a disabled alias", async () => {
    const h = makeHarness({
      bindings: [makeBinding({ status: "disabled" })],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "no_route",
      reasonCode: "alias_disabled",
    });
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("returns no_route when the request protocol does not match the alias", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({ protocol: "chat_completions" }),
    );
    expect(result).toMatchObject({
      status: "no_route",
      reasonCode: "protocol_mismatch",
    });
    expect(h.chatInvoke).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

// P1-1 regression: execute() validated alias / status / protocol but never
// resolved the CALLER's alias grant, so any holder of a valid model token could
// drive any protocol-matching active binding (a WorkBuddy token could run the
// Codex-only alias). The grant is now enforced before the audit claim, before
// any credential load, and before any upstream contact — on the primary route
// AND on the fallback candidate.
describe("alias grant enforcement", () => {
  it("refuses a workbuddy token driving the codex default alias before audit, credential, or upstream", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "workbuddy" as const,
        },
      }),
    );
    expect(result).toMatchObject({
      status: "alias_not_granted",
      httpStatus: 403,
      reasonCode: "alias_not_granted",
      receiptId: null,
      auditRefusal: null,
    });
    expect(h.claimDispatch).not.toHaveBeenCalled();
    expect(h.credentialLoad).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
    expect(h.chatInvoke).not.toHaveBeenCalled();
    expect(h.events).toEqual([]);
  });

  it("allows the client-type default grant with no explicit grant configured", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "codex" as const,
        },
      }),
    );
    expect(result.status).toBe("ok");
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });

  it("honours an explicit grant that names the alias", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "workbuddy" as const,
          grantedAliases: ["caio-codex-default"],
        },
      }),
    );
    expect(result.status).toBe("ok");
  });

  it("refuses when the explicit grant is empty even for the client-type default alias", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "codex" as const,
          grantedAliases: [],
        },
      }),
    );
    expect(result.status).toBe("alias_not_granted");
    expect(result.httpStatus).toBe(403);
    expect(h.claimDispatch).not.toHaveBeenCalled();
  });

  it("refuses the ungranted alias without disclosing whether it is disabled", async () => {
    const h = makeHarness({
      bindings: [makeBinding({ status: "disabled" })],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "workbuddy" as const,
        },
      }),
    );
    expect(result.status).toBe("alias_not_granted");
    expect(result.reasonCode).toBe("alias_not_granted");
  });

  it("does NOT fall back to a candidate whose alias is outside the grant", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [UPSTREAM_500],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "codex" as const,
          // The primary alias only: the equivalence-passing candidate
          // "caio-codex-fallback" is NOT granted.
          grantedAliases: ["caio-codex-default"],
        },
      }),
    );
    expect(result).toMatchObject({
      status: "upstream_error",
      httpStatus: 502,
      fallbackAttempted: false,
      fallbackSucceeded: false,
      fallbackReceiptId: null,
    });
    // No second claim, no second credential load, no second egress.
    expect(h.claimDispatch).toHaveBeenCalledTimes(1);
    expect(h.credentialLoad).toHaveBeenCalledTimes(1);
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });

  it("falls back to a candidate that IS inside the grant", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [
        UPSTREAM_500,
        { status: "ok", upstreamStatus: 200, body: { id: "resp_fb" } },
      ],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "codex" as const,
          grantedAliases: ["caio-codex-default", "caio-codex-fallback"],
        },
      }),
    );
    expect(result).toMatchObject({
      status: "ok",
      fallbackAttempted: true,
      fallbackSucceeded: true,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(2);
  });

  it("ignores malformed explicit grant entries instead of trusting them", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "codex" as const,
          grantedAliases: [
            "../escape",
            "*",
            42 as unknown as string,
          ],
        },
      }),
    );
    expect(result.status).toBe("alias_not_granted");
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("audit gate ordering", () => {
  it("claims the audit dispatch BEFORE the credential load and BEFORE any upstream call", async () => {
    const h = makeHarness();
    await h.proxy.execute(baseExecuteInput());
    expect(h.events).toEqual(["audit", "credential", "upstream"]);
  });

  it("claims the audit dispatch BEFORE the credential loader is invoked (spy order)", async () => {
    const h = makeHarness();
    await h.proxy.execute(baseExecuteInput());
    const claimOrder = h.claimDispatch.mock.invocationCallOrder[0];
    const credentialOrder = h.credentialLoad.mock.invocationCallOrder[0];
    const upstreamOrder = h.responsesInvoke.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(credentialOrder);
    expect(credentialOrder).toBeLessThan(upstreamOrder);
  });

  it("returns 503 audit_unavailable and never touches upstream when the claim is denied", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce(refusal("audit_unavailable"));
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "audit_unavailable",
      httpStatus: 503,
      retryAfterSeconds: 30,
      receiptId: null,
    });
    expect(h.responsesInvoke).not.toHaveBeenCalled();
    expect(h.credentialLoad).not.toHaveBeenCalled();
  });

  it("sends a minimal claim: exact fields, hash only, no body, no credential", async () => {
    const h = makeHarness();
    const input = baseExecuteInput();
    await h.proxy.execute(input);
    expect(h.claimDispatch).toHaveBeenCalledTimes(1);
    const claim = h.claimDispatch.mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >;
    expect(Object.keys(claim).sort()).toEqual([
      "clientType",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "requestId",
      "workspaceId",
    ]);
    expect(claim).toMatchObject({
      requestId: "req-1",
      workspaceId: "ws-1",
      clientType: "codex",
      modelAlias: "caio-codex-default",
      policyVersion: "policy-v3",
      inputHash: sha256(canonicalJson(input.body)),
    });
    const serialized = JSON.stringify(claim);
    expect(serialized).not.toContain(SECRET_PROMPT);
    expect(serialized).not.toContain("loaded-secret-for");
    expect(serialized).not.toContain("provider-a-key");
  });
});

// The engine consumes the ONE canonical audit-gate port published by
// caio-audit-state. Before this it declared a third port with an
// output-incompatible `{allowed, state}` decision, so the delegation chain
// gateway -> proxy -> audit gate was not type-connected at all.
describe("canonical audit gate port consumption", () => {
  it("issues a claim that satisfies the canonical claim schema and field map", async () => {
    const h = makeHarness();
    await h.proxy.execute(baseExecuteInput());
    const claim = h.claimDispatch.mock.calls[0][0];
    // Strict canonical schema: an extra key (prompt, body, route, credential)
    // would be refused here, not silently dropped at the storage boundary.
    expect(() => caioCanonicalAuditClaimSchema.parse(claim)).not.toThrow();
    // Exactly the six canonical fields, keyed by the published field map.
    expect(Object.keys(claim).sort()).toEqual(
      Object.keys(CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP).sort(),
    );
  });

  it("refuses fail-closed when the gate reports allowed with no receipt id", async () => {
    const h = makeHarness();
    // The port is an injectable extension point: a JS implementation can
    // answer "allowed" while proving no durable write happened.
    h.claimDispatch.mockResolvedValueOnce({
      status: "allowed",
      receiptId: "",
      persistedVia: "primary",
      dispatchAttempt: 1,
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "audit_unavailable",
      httpStatus: 503,
      receiptId: null,
    });
    expect(h.credentialLoad).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("refuses fail-closed when the gate answers outside the canonical union", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce(
      undefined as unknown as CaioCanonicalAuditGateOutcome,
    );
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("audit_unavailable");
    expect(result.httpStatus).toBe(503);
    expect(h.credentialLoad).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("propagates a thrown gate error without loading a credential or contacting upstream", async () => {
    const h = makeHarness();
    h.claimDispatch.mockRejectedValueOnce(
      new Error("caio_audit_reserved_request_id"),
    );
    await expect(h.proxy.execute(baseExecuteInput())).rejects.toThrow(
      /caio_audit_reserved_request_id/,
    );
    expect(h.credentialLoad).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

// The three refusal statuses must leave execute() DISTINCTLY so a transport can
// map 503 / 409 / 429. Collapsing receipt_conflict or replay_limit_exceeded into
// audit_unavailable told a client to retry a request that can never succeed.
describe("audit refusal propagation", () => {
  it("propagates audit_unavailable as 503 carrying the gate's retry advice", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce(
      refusal("audit_unavailable", { retryAfterSeconds: 12 }),
    );
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("audit_unavailable");
    expect(result.httpStatus).toBe(503);
    expect(result.reasonCode).toBe(CAIO_AUDIT_UNAVAILABLE_ERROR_CODE);
    expect(result.retryAfterSeconds).toBe(12);
    expect(result.auditRefusal?.status).toBe("audit_unavailable");
  });

  it("propagates receipt_conflict as a distinct 409 that is never retryable", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce(refusal("receipt_conflict"));
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("receipt_conflict");
    expect(result.httpStatus).toBe(409);
    expect(result.reasonCode).toBe(CAIO_AUDIT_CONFLICT_ERROR_CODE);
    expect(result.retryAfterSeconds).toBeNull();
    expect(result.retryAfterSeconds).not.toBeUndefined();
    expect(result.auditRefusal?.status).toBe("receipt_conflict");
    expect(h.responsesInvoke).not.toHaveBeenCalled();
    expect(h.credentialLoad).not.toHaveBeenCalled();
  });

  it("propagates replay_limit_exceeded as a distinct 429", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce(refusal("replay_limit_exceeded"));
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("replay_limit_exceeded");
    expect(result.httpStatus).toBe(429);
    expect(result.reasonCode).toBe(CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE);
    expect(result.retryAfterSeconds).toBeNull();
    expect(result.auditRefusal?.status).toBe("replay_limit_exceeded");
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("keeps the three refusals distinguishable from one another", async () => {
    const h = makeHarness();
    const statuses: string[] = [];
    for (const status of [
      "audit_unavailable",
      "receipt_conflict",
      "replay_limit_exceeded",
    ] as const) {
      h.claimDispatch.mockResolvedValueOnce(refusal(status));
      statuses.push((await h.proxy.execute(baseExecuteInput())).status);
    }
    expect(statuses).toEqual([
      "audit_unavailable",
      "receipt_conflict",
      "replay_limit_exceeded",
    ]);
    expect(new Set(statuses).size).toBe(3);
  });

  it("derives the HTTP status from the refusal discriminant, never from the port's number", async () => {
    const h = makeHarness();
    // A JS gate implementation reporting httpStatus 200 on a refusal must not
    // be able to turn a refusal into a success-shaped result.
    h.claimDispatch.mockResolvedValueOnce(
      refusal("receipt_conflict", { httpStatus: 200 }),
    );
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("receipt_conflict");
    expect(result.httpStatus).toBe(409);
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("never emits an undefined retryAfterSeconds when the gate omits it", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce({
      status: "audit_unavailable",
      errorCode: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
      httpStatus: 503,
    } as unknown as CaioCanonicalAuditGateOutcome);
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("audit_unavailable");
    expect(result.retryAfterSeconds).toBeNull();
  });

  it("carries no audit refusal on a successful dispatch", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("ok");
    expect(result.auditRefusal).toBeNull();
  });
});

describe("credential handling", () => {
  it("returns 503 credential_unavailable without touching upstream when the loader fails", async () => {
    const h = makeHarness();
    h.credentialLoad.mockRejectedValueOnce(
      new Error("credential_not_found:missing"),
    );
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "credential_unavailable",
      httpStatus: 503,
      receiptId: "receipt-1",
    });
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("successful dispatch", () => {
  it("replaces the model with the upstream model and passes tools through untouched", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "ok",
      httpStatus: 200,
      receiptId: "receipt-1",
      body: { id: "resp_ok" },
      upstream: {
        providerKey: "provider-a",
        upstreamModel: "provider-a-large-1",
        policyVersion: "policy-v3",
      },
      fallbackAttempted: false,
      fallbackSucceeded: false,
    });
    const call = h.responsesInvoke.mock.calls[0][0] as unknown as {
      body: Record<string, unknown>;
      apiKey: string;
      endpointBaseUrl: string;
    };
    expect(call.body.model).toBe("provider-a-large-1");
    expect(call.body.input).toBe(SECRET_PROMPT);
    expect(call.body.tools).toEqual([{ type: "function", name: "lookup" }]);
    expect(call.apiKey).toBe("loaded-secret-for-provider-a-key");
    expect(call.endpointBaseUrl).toBe("https://upstream.example.internal/v1");
  });

  it("routes chat_completions aliases to the chat client, not the responses client", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          alias: "caio-workbuddy-default",
          protocol: "chat_completions",
        }),
      ],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({
        alias: "caio-workbuddy-default",
        protocol: "chat_completions",
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "workbuddy" as const,
        },
      }),
    );
    expect(result.status).toBe("ok");
    expect(h.chatInvoke).toHaveBeenCalledTimes(1);
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("rate limiter", () => {
  it("returns 429 before claiming audit when the gateway rate limit denies", async () => {
    const check = vi.fn(() => ({ allowed: false, retryAfterSeconds: 5 }));
    const h = makeHarness();
    const proxy = createCaioModelProxy({
      posture: "self_service",
      bindings: [makeBinding()],
      governedAdmission: createCaioFrozenGovernedAdmission(makeSnapshot()),
      credentialLoader: { load: h.credentialLoad },
      clients: {
        responses: { invoke: h.responsesInvoke },
        chatCompletions: { invoke: h.chatInvoke },
      },
      auditGate: { posture: "self_service", claimDispatch: h.claimDispatch },
      rateLimiter: { check },
    });
    const result = await proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "rate_limited",
      httpStatus: 429,
      retryAfterSeconds: 5,
    });
    expect(check).toHaveBeenCalledTimes(1);
    expect(h.claimDispatch).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("fallback", () => {
  it("attempts at most ONE equivalence-passing fallback on upstream failure", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            // Cross-provider: admitted by the policy on its own route, and
            // still skipped by the fail-closed fallback equivalence rule.
            makeCandidate({
              providerKey: "provider-b",
              governedRouteRef: PROVIDER_B_ROUTE_REF,
            }),
            makeCandidate(),
            // A second equivalent candidate that must never be tried.
            makeCandidate({ upstreamModel: "provider-a-large-3" }),
          ],
        }),
      ],
      responsesInvokeResults: [
        UPSTREAM_500,
        { status: "ok", upstreamStatus: 200, body: { id: "resp_fb" } },
      ],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "ok",
      fallbackAttempted: true,
      fallbackSucceeded: true,
      upstream: {
        providerKey: "provider-a",
        upstreamModel: "provider-a-large-2",
        policyVersion: "policy-v3",
      },
      body: { id: "resp_fb" },
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(2);
    const fallbackCall = h.responsesInvoke.mock.calls[1][0] as unknown as {
      body: Record<string, unknown>;
      apiKey: string;
    };
    expect(fallbackCall.body.model).toBe("provider-a-large-2");
    expect(fallbackCall.apiKey).toBe(
      "loaded-secret-for-provider-a-key-b",
    );
  });

  it("stops after one fallback attempt even when it also fails", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            makeCandidate(),
            makeCandidate({ upstreamModel: "provider-a-large-3" }),
          ],
        }),
      ],
      responsesInvokeResults: [UPSTREAM_500, UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      httpStatus: 502,
      fallbackAttempted: true,
      fallbackSucceeded: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when no candidate passes the equivalence rule", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            makeCandidate({
              providerKey: "provider-b",
              governedRouteRef: PROVIDER_B_ROUTE_REF,
            }),
            makeCandidate({
              region: "us-east-1",
              governedRouteRef: REGION_US_ROUTE_REF,
            }),
            makeCandidate({ status: "disabled" }),
          ],
        }),
      ],
      responsesInvokeResults: [UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      fallbackAttempted: false,
      fallbackSucceeded: false,
      upstream: { upstreamModel: "provider-a-large-1" },
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });

  it("reports the original upstream error when the fallback credential fails to load", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [UPSTREAM_500],
    });
    h.credentialLoad
      .mockResolvedValueOnce("loaded-secret-for-provider-a-key")
      .mockRejectedValueOnce(new Error("credential_not_found:missing"));
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      reasonCode: "upstream_failed",
      fallbackAttempted: true,
      fallbackSucceeded: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });

  // F5 regression: exactly one claim was made, recording the PRIMARY binding,
  // while the fallback could execute on a different host under a different
  // policy version. policyVersion is now a governed equivalence dimension, and
  // the executed fallback route gets its own linked receipt.
  it("F5: does not fall back to a candidate under a different policyVersion", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            makeCandidate({
              policyVersion: "policy-v9-looser",
              endpointBaseUrl: "https://other-tenant.example.net/v1",
            }),
          ],
        }),
      ],
      responsesInvokeResults: [UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      fallbackAttempted: false,
      upstream: {
        upstreamModel: "provider-a-large-1",
        policyVersion: "policy-v3",
      },
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
    expect(h.claimDispatch).toHaveBeenCalledTimes(1);
  });

  it("F5: claims a second linked receipt naming the executed route BEFORE dispatching the fallback", async () => {
    const candidate = makeCandidate({
      endpointBaseUrl: "https://fallback.example.internal/v1",
      upstreamModel: "provider-a-large-2",
      credentialRef: "provider-a-key-b",
    });
    const h = makeHarness({
      bindings: [makeBinding({ fallbackCandidates: [candidate] })],
      responsesInvokeResults: [
        UPSTREAM_500,
        { status: "ok", upstreamStatus: 200, body: { id: "resp_fb" } },
      ],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result.status).toBe("ok");
    expect(result.fallbackSucceeded).toBe(true);

    expect(h.claimDispatch).toHaveBeenCalledTimes(2);
    const fallbackClaim = h.claimDispatch.mock.calls[1][0];
    // Linked to the original request and naming the route actually used.
    expect(fallbackClaim.requestId).toBe(
      caioFallbackMarkerRequestId({
        requestId: "req-1",
        route: {
          providerKey: candidate.providerKey,
          endpointBaseUrl: candidate.endpointBaseUrl,
          upstreamModel: candidate.upstreamModel,
        },
      }),
    );
    expect(fallbackClaim.requestId).toContain(
      caioRouteFingerprint({
        providerKey: candidate.providerKey,
        endpointBaseUrl: candidate.endpointBaseUrl,
        upstreamModel: candidate.upstreamModel,
      }),
    );
    expect(fallbackClaim.policyVersion).toBe(candidate.policyVersion);
    // Still a minimal claim: no body, no credential, no extra keys.
    expect(Object.keys(fallbackClaim).sort()).toEqual([
      "clientType",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "requestId",
      "workspaceId",
    ]);
    const serialized = JSON.stringify(fallbackClaim);
    expect(serialized).not.toContain(SECRET_PROMPT);
    expect(serialized).not.toContain("loaded-secret-for");

    // Ordering: the fallback receipt precedes the fallback credential load and
    // the fallback dispatch.
    expect(h.events).toEqual([
      "audit",
      "credential",
      "upstream",
      "audit",
      "credential",
      "upstream",
    ]);
    // Spy order: the SECOND claim strictly precedes the SECOND credential load.
    expect(h.claimDispatch.mock.invocationCallOrder[1]).toBeLessThan(
      h.credentialLoad.mock.invocationCallOrder[1],
    );
    expect(result.fallbackReceiptId).toBe("receipt-1");
  });

  it("F5: never dispatches the fallback when its audit claim is refused", async () => {
    const h = makeHarness({
      bindings: [makeBinding({ fallbackCandidates: [makeCandidate()] })],
      responsesInvokeResults: [UPSTREAM_500],
    });
    h.claimDispatch
      .mockResolvedValueOnce(ALLOWED_OUTCOME)
      .mockResolvedValueOnce(refusal("audit_unavailable"));
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      receiptId: "receipt-1",
      fallbackAttempted: false,
      fallbackSucceeded: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
    // The fallback credential must never be loaded without a fallback receipt.
    expect(h.credentialLoad).toHaveBeenCalledTimes(1);
  });

  it("does not fall back on cancellation", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [{ status: "cancelled" }],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "cancelled",
      httpStatus: 499,
      fallbackAttempted: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });
});

describe("normalized result hygiene", () => {
  it("never carries credential material in any result", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [UPSTREAM_500, UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(JSON.stringify(result)).not.toContain("loaded-secret-for");
  });

  it("passes upstream Retry-After through on rate-limited upstream errors", async () => {
    const h = makeHarness({
      responsesInvokeResults: [
        {
          status: "upstream_error",
          code: "upstream_rate_limited",
          gatewayStatus: 429,
          upstreamStatus: 429,
          retryAfterSeconds: 12,
        },
      ],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      httpStatus: 429,
      reasonCode: "upstream_rate_limited",
      retryAfterSeconds: 12,
    });
  });
});
