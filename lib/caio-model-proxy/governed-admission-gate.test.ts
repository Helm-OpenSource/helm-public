import { describe, expect, it } from "vitest";

import {
  CaioGovernedAdmissionError,
  caioGovernedRetentionPolicyKey,
  type CaioGovernedAdmissionSnapshot,
  type CaioGovernedRouteAdmission,
} from "./governed-admission-contracts";
import {
  CAIO_GOVERNED_ADMISSION_DIMENSIONS,
  admitFromSnapshot,
  admitLiveRoute,
  assertBindingAdmitted,
  compareBindingToGovernedRoute,
  type CaioGovernedAdmissionSubject,
} from "./governed-admission-gate";

const POLICY_KEY = "caio-lan-default";
const ROUTE_REF = "route-provider-a-primary";
const NOW = new Date("2026-07-30T12:00:00.000Z");

function route(
  overrides: Partial<CaioGovernedRouteAdmission> = {},
): CaioGovernedRouteAdmission {
  return {
    routeRef: ROUTE_REF,
    policyKey: POLICY_KEY,
    policyId: "policy:caio-lan-default-v1",
    policyHash: `sha256:${"a".repeat(64)}`,
    policyHeadVersion: 2,
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
    policyValidUntil: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<CaioGovernedAdmissionSnapshot> = {},
  routes: readonly CaioGovernedRouteAdmission[] = [route()],
): CaioGovernedAdmissionSnapshot {
  return {
    policyKey: POLICY_KEY,
    policyId: "policy:caio-lan-default-v1",
    policyHash: `sha256:${"a".repeat(64)}`,
    policyHeadVersion: 2,
    policyRevocationEpoch: 0,
    resolvedAt: "2026-07-30T00:00:00.000Z",
    validUntil: "2026-08-30T00:00:00.000Z",
    routes: new Map(routes.map((entry) => [entry.routeRef, entry])),
    ...overrides,
  };
}

function binding(
  overrides: Partial<CaioGovernedAdmissionSubject> = {},
): CaioGovernedAdmissionSubject {
  return {
    alias: "caio-codex-default",
    providerKey: "provider-a",
    credentialRef: "provider-a-key",
    region: "cn-hangzhou",
    dataRetentionPolicyKey: caioGovernedRetentionPolicyKey(30),
    trainingUsePolicyKey: "prohibited",
    governedPolicyKey: POLICY_KEY,
    governedRouteRef: ROUTE_REF,
    ...overrides,
  };
}

describe("caio governed admission gate", () => {
  it("admits a binding that matches the governed route on every dimension", () => {
    const verdict = admitFromSnapshot({
      snapshot: snapshot(),
      binding: binding(),
      now: NOW,
    });
    expect(verdict.admitted).toBe(true);
    if (!verdict.admitted) return;
    expect(verdict.route.routeRef).toBe(ROUTE_REF);
    expect(compareBindingToGovernedRoute(binding(), route())).toEqual([]);
  });

  // Every compared dimension must independently deny: a partial match is not
  // a match, and the failure must not depend on comparison order.
  const mismatches: Record<
    (typeof CAIO_GOVERNED_ADMISSION_DIMENSIONS)[number],
    string
  > = {
    providerKey: "provider-b",
    credentialRef: "provider-b-key",
    region: "us-east-1",
    dataRetentionPolicyKey: caioGovernedRetentionPolicyKey(90),
    trainingUsePolicyKey: "permitted",
  };

  for (const dimension of CAIO_GOVERNED_ADMISSION_DIMENSIONS) {
    it(`refuses admission when ${dimension} disagrees with the governed route`, () => {
      const subject = binding({ [dimension]: mismatches[dimension] });
      expect(compareBindingToGovernedRoute(subject, route())).toEqual([
        dimension,
      ]);
      const verdict = admitFromSnapshot({
        snapshot: snapshot(),
        binding: subject,
        now: NOW,
      });
      expect(verdict).toEqual({ admitted: false, reason: "binding_mismatch" });
      expect(() =>
        assertBindingAdmitted({
          snapshot: snapshot(),
          binding: subject,
          now: NOW,
        }),
      ).toThrow(CaioGovernedAdmissionError);
    });
  }

  it("refuses a route the approved policy does not contain", () => {
    expect(
      admitFromSnapshot({
        snapshot: snapshot(),
        binding: binding({ governedRouteRef: "route-invented" }),
        now: NOW,
      }),
    ).toEqual({ admitted: false, reason: "route_not_in_policy" });
  });

  it("refuses a binding that names a different governed policy key", () => {
    expect(
      admitFromSnapshot({
        snapshot: snapshot(),
        binding: binding({ governedPolicyKey: "some-other-policy" }),
        now: NOW,
      }),
    ).toEqual({ admitted: false, reason: "route_not_in_policy" });
  });

  // The frozen snapshot does not observe a revocation until the process
  // reloads — but it DOES hard-expire, and expiry is evaluated before lookup.
  it("admits nothing once the snapshot is past the policy validity horizon", () => {
    const expired = snapshot({ validUntil: "2026-07-30T11:59:59.000Z" });
    expect(
      admitFromSnapshot({ snapshot: expired, binding: binding(), now: NOW }),
    ).toEqual({ admitted: false, reason: "policy_expired" });
  });

  it("treats an unreadable validity horizon as unverifiable, never as valid", () => {
    expect(
      admitFromSnapshot({
        snapshot: snapshot({ validUntil: "whenever" }),
        binding: binding(),
        now: NOW,
      }),
    ).toEqual({ admitted: false, reason: "admission_unverifiable" });
  });

  it("applies the same dimension comparison to a live verdict", () => {
    expect(
      admitLiveRoute({
        binding: binding({ credentialRef: "provider-b-key" }),
        verdict: { admitted: true, route: route() },
      }),
    ).toEqual({ admitted: false, reason: "binding_mismatch" });
    expect(
      admitLiveRoute({
        binding: binding(),
        verdict: { admitted: false, reason: "owner_approval_missing" },
      }),
    ).toEqual({ admitted: false, reason: "owner_approval_missing" });
    expect(
      admitLiveRoute({
        binding: binding(),
        verdict: { admitted: true, route: route() },
      }).admitted,
    ).toBe(true);
  });

  it("names the construction site in the assertion error", () => {
    let caught: unknown;
    try {
      assertBindingAdmitted({
        snapshot: snapshot(),
        binding: binding({ governedRouteRef: "route-invented" }),
        now: NOW,
        role: "fallback candidate of caio-codex-default",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CaioGovernedAdmissionError);
    expect((caught as CaioGovernedAdmissionError).reason).toBe(
      "route_not_in_policy",
    );
    expect(String((caught as Error).message)).toContain("fallback candidate");
  });

  it("derives the retention policy key from the governed route's day count", () => {
    expect(caioGovernedRetentionPolicyKey(0)).toBe("retention-days:0");
    expect(caioGovernedRetentionPolicyKey(30)).toBe("retention-days:30");
  });
});
