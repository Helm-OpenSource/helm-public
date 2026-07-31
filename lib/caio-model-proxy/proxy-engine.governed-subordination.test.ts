// ADVERSARIAL: the CAIO passthrough must be provably subordinate to governance
// in BOTH deployment postures (owner ruling, 2026-07-30).
//
// Every case below builds an otherwise PERFECTLY HEALTHY proxy — active
// binding, matching protocol, alias inside the caller's grant, rate limiter
// open, audit gate that always allows with a real receipt id, credential
// loader that always succeeds, upstream clients that always answer 200 — and
// changes exactly ONE thing: governance. If the request still reaches the
// audit gate, a credential, or an upstream, the subordination is a claim in a
// document rather than a property of the execution path, and these tests fail.

import { describe, expect, it, vi } from "vitest";

import type { CaioCanonicalAuditGateOutcome } from "@/lib/caio-audit-state/gateway-audit-gate-adapter";

import type {
  CaioModelAliasBinding,
  CaioModelAliasFallbackCandidate,
} from "./alias-contracts";
import {
  caioGovernedRetentionPolicyKey,
  type CaioGovernedAdmissionSnapshot,
  type CaioGovernedRouteAdmission,
  type CaioGovernedRouteVerdict,
  type CaioLiveGovernedAdmissionPort,
} from "./governed-admission-contracts";
import { createCaioFrozenGovernedAdmission } from "./governed-route-admission.service";
import {
  CaioModelProxyConfigError,
  createCaioModelProxy,
  type CaioModelProxyDependencies,
} from "./proxy-engine";

const POLICY_KEY = "caio-lan-default";
const ROUTE_REF = "route-provider-a-primary";
const FALLBACK_ROUTE_REF = "route-provider-a-fallback";
const VALID_UNTIL = "2026-08-30T00:00:00.000Z";
const AT_LOAD = new Date("2026-07-30T00:00:00.000Z");
const AFTER_EXPIRY = new Date("2026-09-01T00:00:00.000Z");

const ALLOWED: CaioCanonicalAuditGateOutcome = Object.freeze({
  status: "allowed",
  receiptId: "receipt-1",
  persistedVia: "primary",
  dispatchAttempt: 1,
});

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
    dataRetentionPolicyKey: caioGovernedRetentionPolicyKey(30),
    trainingUsePolicyKey: "prohibited",
    dataAuthorizationKey: "auth-tier-1",
    policyVersion: "policy-v3",
    status: "active",
    governedPolicyKey: POLICY_KEY,
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
    governedRouteRef: ROUTE_REF,
    fallbackCandidates: [],
    ...overrides,
  };
}

function makeRoute(
  overrides: Partial<CaioGovernedRouteAdmission> = {},
): CaioGovernedRouteAdmission {
  return {
    routeRef: ROUTE_REF,
    policyKey: POLICY_KEY,
    policyId: "policy:caio-lan-default-v1",
    policyHash: `sha256:${"b".repeat(64)}`,
    policyHeadVersion: 4,
    policyRevocationEpoch: 0,
    provider: "provider-a",
    credentialRef: "provider-a-key",
    region: "cn-hangzhou",
    deploymentForm: "private_deployment",
    jurisdiction: "customer_premises",
    retentionPolicyKey: caioGovernedRetentionPolicyKey(30),
    trainingUsePolicyKey: "prohibited",
    pricingVersion: "provider-a-pricing-202607",
    maxOutputTokens: 4_000,
    policyValidUntil: VALID_UNTIL,
    ...overrides,
  };
}

function makeSnapshot(
  routes: readonly CaioGovernedRouteAdmission[] = [
    makeRoute(),
    makeRoute({
      routeRef: FALLBACK_ROUTE_REF,
      credentialRef: "provider-a-key-b",
    }),
  ],
): CaioGovernedAdmissionSnapshot {
  return {
    policyKey: POLICY_KEY,
    policyId: "policy:caio-lan-default-v1",
    policyHash: `sha256:${"b".repeat(64)}`,
    policyHeadVersion: 4,
    policyRevocationEpoch: 0,
    resolvedAt: AT_LOAD.toISOString(),
    validUntil: VALID_UNTIL,
    routes: new Map(routes.map((route) => [route.routeRef, route])),
  };
}

/** Spies for the three things a refused request must never reach. */
function makeSpies() {
  const claimDispatch = vi.fn(async () => ALLOWED);
  const credentialLoad = vi.fn(async () => "loaded-secret");
  const invoke = vi.fn(async () => ({
    status: "ok" as const,
    upstreamStatus: 200,
    body: { id: "resp_ok" },
  }));
  return { claimDispatch, credentialLoad, invoke };
}

type Spies = ReturnType<typeof makeSpies>;

function expectUntouched(spies: Spies): void {
  expect(spies.claimDispatch).toHaveBeenCalledTimes(0);
  expect(spies.credentialLoad).toHaveBeenCalledTimes(0);
  expect(spies.invoke).toHaveBeenCalledTimes(0);
}

function commonDeps(spies: Spies, bindings: CaioModelAliasBinding[]) {
  const client = {
    invoke: spies.invoke,
  } as unknown as CaioModelProxyDependencies["clients"]["responses"];
  return {
    bindings,
    credentialLoader: { load: spies.credentialLoad },
    clients: { responses: client, chatCompletions: client },
  };
}

function selfServiceProxy(input: {
  spies: Spies;
  bindings?: CaioModelAliasBinding[];
  snapshot?: CaioGovernedAdmissionSnapshot;
  now?: () => Date;
}) {
  return createCaioModelProxy({
    posture: "self_service",
    ...commonDeps(input.spies, input.bindings ?? [makeBinding()]),
    auditGate: { posture: "self_service", claimDispatch: input.spies.claimDispatch },
    governedAdmission: createCaioFrozenGovernedAdmission(
      input.snapshot ?? makeSnapshot(),
    ),
    now: input.now ?? (() => AT_LOAD),
  });
}

function liveAdmission(
  verify: (input: {
    routeRef: string;
    now: Date;
  }) => Promise<CaioGovernedRouteVerdict>,
): CaioLiveGovernedAdmissionPort {
  return Object.freeze({
    posture: "governed_fde" as const,
    policyKey: POLICY_KEY,
    verify,
  });
}

function governedProxy(input: {
  spies: Spies;
  bindings?: CaioModelAliasBinding[];
  admission?: CaioLiveGovernedAdmissionPort;
}) {
  return createCaioModelProxy({
    posture: "governed_fde",
    ...commonDeps(input.spies, input.bindings ?? [makeBinding()]),
    auditGate: { posture: "governed_fde", claimDispatch: input.spies.claimDispatch },
    governedAdmission:
      input.admission ??
      liveAdmission(async ({ routeRef }) =>
        routeRef === ROUTE_REF
          ? { admitted: true, route: makeRoute() }
          : {
              admitted: true,
              route: makeRoute({
                routeRef: FALLBACK_ROUTE_REF,
                credentialRef: "provider-a-key-b",
              }),
            },
      ),
    now: () => AT_LOAD,
  });
}

function executeInput(overrides: Record<string, unknown> = {}) {
  return {
    audienceContext: {
      workspaceId: "ws-1",
      userRef: "user-1",
      clientType: "codex" as const,
      grantedAliases: ["caio-codex-default", "caio-codex-fallback"],
    },
    alias: "caio-codex-default",
    protocol: "responses" as const,
    body: { model: "caio-codex-default", input: "hello" },
    requestId: "req-subordination-1",
    ...overrides,
  };
}

describe("governed subordination — posture declaration", () => {
  it("refuses to construct a proxy with no declared posture", () => {
    const spies = makeSpies();
    expect(() =>
      createCaioModelProxy({
        ...commonDeps(spies, [makeBinding()]),
        auditGate: { posture: "self_service", claimDispatch: spies.claimDispatch },
        governedAdmission: createCaioFrozenGovernedAdmission(makeSnapshot()),
      } as unknown as CaioModelProxyDependencies),
    ).toThrow(/caio_deployment_posture_invalid/u);
  });

  it("refuses to construct a proxy with a posture outside the vocabulary", () => {
    const spies = makeSpies();
    expect(() =>
      createCaioModelProxy({
        posture: "best_effort",
        ...commonDeps(spies, [makeBinding()]),
        auditGate: { posture: "self_service", claimDispatch: spies.claimDispatch },
        governedAdmission: createCaioFrozenGovernedAdmission(makeSnapshot()),
      } as unknown as CaioModelProxyDependencies),
    ).toThrow(/caio_deployment_posture_invalid/u);
  });

  // No impersonation: a governed-FDE proxy writing self-service receipts (or
  // the reverse) cannot be built at all.
  it("refuses a proxy whose audit gate runs the other posture", () => {
    const spies = makeSpies();
    expect(() =>
      createCaioModelProxy({
        posture: "governed_fde",
        ...commonDeps(spies, [makeBinding()]),
        auditGate: { posture: "self_service", claimDispatch: spies.claimDispatch },
        governedAdmission: liveAdmission(async () => ({
          admitted: true,
          route: makeRoute(),
        })),
      } as unknown as CaioModelProxyDependencies),
    ).toThrow(CaioModelProxyConfigError);
  });

  it("refuses a proxy whose admission port runs the other posture", () => {
    const spies = makeSpies();
    expect(() =>
      createCaioModelProxy({
        posture: "governed_fde",
        ...commonDeps(spies, [makeBinding()]),
        auditGate: { posture: "governed_fde", claimDispatch: spies.claimDispatch },
        governedAdmission: createCaioFrozenGovernedAdmission(makeSnapshot()),
      } as unknown as CaioModelProxyDependencies),
    ).toThrow(CaioModelProxyConfigError);
  });
});

describe("governed subordination — construction-time admission", () => {
  it("self_service refuses to start when the approved policy holds no such route", () => {
    const spies = makeSpies();
    expect(() =>
      selfServiceProxy({ spies, snapshot: makeSnapshot([]) }),
    ).toThrow(/caio_route_not_admitted/u);
  });

  it("self_service refuses to start when a governed dimension disagrees", () => {
    const spies = makeSpies();
    expect(() =>
      selfServiceProxy({
        spies,
        bindings: [makeBinding({ credentialRef: "provider-b-key" })],
      }),
    ).toThrow(/binding_mismatch/u);
  });

  it("self_service refuses to start when a FALLBACK candidate is not admitted", () => {
    const spies = makeSpies();
    expect(() =>
      selfServiceProxy({
        spies,
        bindings: [
          makeBinding({
            fallbackCandidates: [
              makeCandidate({ governedRouteRef: "route-invented" }),
            ],
          }),
        ],
      }),
    ).toThrow(/route_not_in_policy/u);
  });

  it("governed_fde refuses to start when a binding names another governed policy", () => {
    const spies = makeSpies();
    expect(() =>
      governedProxy({
        spies,
        bindings: [makeBinding({ governedPolicyKey: "some-other-policy" })],
      }),
    ).toThrow(/route_not_in_policy/u);
  });
});

describe("governed subordination — request-time admission", () => {
  // THE adversarial case: everything else is healthy and the snapshot has
  // simply aged past the approved policy's validity horizon.
  it("self_service refuses every dispatch once admission has lapsed, before audit/credential/upstream", async () => {
    const spies = makeSpies();
    // Admitted at load, then the approved policy's validity horizon passes.
    let clock = AT_LOAD;
    const proxy = selfServiceProxy({ spies, now: () => clock });
    clock = AFTER_EXPIRY;
    const result = await proxy.execute(executeInput());
    expect(result.status).toBe("route_not_admitted");
    expect(result.httpStatus).toBe(403);
    expect(result.receiptId).toBeNull();
    expect(result.body).toBeNull();
    expectUntouched(spies);
  });

  it("governed_fde refuses a dispatch the live policy no longer admits", async () => {
    const spies = makeSpies();
    const proxy = governedProxy({
      spies,
      admission: liveAdmission(async () => ({
        admitted: false,
        reason: "policy_not_active",
      })),
    });
    const result = await proxy.execute(executeInput());
    expect(result.status).toBe("route_not_admitted");
    expect(result.receiptId).toBeNull();
    expectUntouched(spies);
  });

  // Fail closed: a governance check that cannot be completed is a refusal.
  it("governed_fde refuses when the live admission check itself throws", async () => {
    const spies = makeSpies();
    const proxy = governedProxy({
      spies,
      admission: liveAdmission(async () => {
        throw new Error("policy store unreachable");
      }),
    });
    const result = await proxy.execute(executeInput());
    expect(result.status).toBe("route_not_admitted");
    expectUntouched(spies);
  });

  // governed_fde re-verifies per request: an admission granted a moment ago is
  // not evidence for the next request.
  it("governed_fde re-verifies on every request instead of caching a verdict", async () => {
    const spies = makeSpies();
    const verify = vi.fn(async () => ({
      admitted: true as const,
      route: makeRoute(),
    }));
    const proxy = governedProxy({ spies, admission: liveAdmission(verify) });
    await proxy.execute(executeInput());
    await proxy.execute(executeInput({ requestId: "req-subordination-2" }));
    expect(verify).toHaveBeenCalledTimes(2);
    expect(spies.claimDispatch).toHaveBeenCalledTimes(2);
  });

  it("does not fall back onto a candidate whose admission has lapsed", async () => {
    const spies = makeSpies();
    spies.invoke.mockImplementation(async () => ({
      status: "upstream_error",
      code: "upstream_failed",
      gatewayStatus: 502,
      upstreamStatus: 500,
      retryAfterSeconds: null,
    }) as never);
    const proxy = governedProxy({
      spies,
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      admission: liveAdmission(async ({ routeRef }) =>
        routeRef === ROUTE_REF
          ? { admitted: true, route: makeRoute() }
          : { admitted: false, reason: "policy_not_active" },
      ),
    });
    const result = await proxy.execute(executeInput());
    expect(result.status).toBe("upstream_error");
    expect(result.fallbackAttempted).toBe(false);
    expect(result.fallbackReceiptId).toBeNull();
    // Exactly one claim (the primary route) and one upstream call: no second
    // receipt was claimed for a route that is no longer admitted.
    expect(spies.claimDispatch).toHaveBeenCalledTimes(1);
    expect(spies.invoke).toHaveBeenCalledTimes(1);
  });
});

describe("governed subordination — outbound content boundary", () => {
  const secretBody = {
    model: "caio-codex-default",
    input:
      "deploy with this key\n-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----",
  };

  it("self_service refuses a hard-boundary body before audit/credential/upstream", async () => {
    const spies = makeSpies();
    const proxy = selfServiceProxy({ spies });
    const result = await proxy.execute(executeInput({ body: secretBody }));
    expect(result.status).toBe("content_boundary_denied");
    expect(result.httpStatus).toBe(422);
    expect(result.receiptId).toBeNull();
    expectUntouched(spies);
  });

  it("governed_fde refuses a hard-boundary body before audit/credential/upstream", async () => {
    const spies = makeSpies();
    const proxy = governedProxy({ spies });
    const result = await proxy.execute(executeInput({ body: secretBody }));
    expect(result.status).toBe("content_boundary_denied");
    expect(result.httpStatus).toBe(422);
    expectUntouched(spies);
  });

  it("a marker-carrying body is refused in both postures", async () => {
    const markerBody = {
      model: "caio-codex-default",
      input: "[[LOCAL-ONLY]] summarise this internal note",
    };
    const selfSpies = makeSpies();
    expect(
      (
        await selfServiceProxy({ spies: selfSpies }).execute(
          executeInput({ body: markerBody }),
        )
      ).status,
    ).toBe("content_boundary_denied");
    expectUntouched(selfSpies);

    const governedSpies = makeSpies();
    expect(
      (
        await governedProxy({ spies: governedSpies }).execute(
          executeInput({ body: markerBody }),
        )
      ).status,
    ).toBe("content_boundary_denied");
    expectUntouched(governedSpies);
  });
});

describe("governed subordination — the healthy path still works", () => {
  it("serves a normal request in both postures", async () => {
    const selfSpies = makeSpies();
    const selfResult = await selfServiceProxy({ spies: selfSpies }).execute(
      executeInput(),
    );
    expect(selfResult.status).toBe("ok");
    expect(selfResult.receiptId).toBe("receipt-1");
    expect(selfSpies.invoke).toHaveBeenCalledTimes(1);

    const governedSpies = makeSpies();
    const governedResult = await governedProxy({
      spies: governedSpies,
    }).execute(executeInput());
    expect(governedResult.status).toBe("ok");
    expect(governedSpies.invoke).toHaveBeenCalledTimes(1);
  });
});
