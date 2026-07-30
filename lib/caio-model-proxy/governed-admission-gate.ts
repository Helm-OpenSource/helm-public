// CAIO model proxy — the governed admission gate.
//
// One rule, applied identically in BOTH deployment postures: a binding may
// only dispatch to a route the governed policy admits, and "admits" means the
// governed dimensions of the binding match the governed route EXACTLY. The
// postures differ in where the route comes from (a frozen snapshot vs a live
// per-request read), never in how strictly it is compared.
//
// Everything here is a pure function over already-resolved data: no IO, no
// clock of its own, no default that could turn a missing value into a pass.

import {
  CaioGovernedAdmissionError,
  type CaioGovernedAdmissionSnapshot,
  type CaioGovernedRouteAdmission,
  type CaioGovernedRouteVerdict,
} from "@/lib/caio-model-proxy/governed-admission-contracts";

/**
 * The binding fields that must agree with the governed route, and the route
 * field each one is compared against. deploymentForm and jurisdiction are
 * deliberately absent: the alias binding has no counterpart for them, so they
 * are RECORDED in the admission (and reported) rather than pretended to be
 * checked.
 */
export const CAIO_GOVERNED_ADMISSION_DIMENSIONS = [
  "providerKey",
  "credentialRef",
  "region",
  "dataRetentionPolicyKey",
  "trainingUsePolicyKey",
] as const;

export type CaioGovernedAdmissionDimension =
  (typeof CAIO_GOVERNED_ADMISSION_DIMENSIONS)[number];

/** The binding shape this gate reads. Both bindings and fallback candidates satisfy it. */
export type CaioGovernedAdmissionSubject = Readonly<{
  alias: string;
  providerKey: string;
  credentialRef: string;
  region: string;
  dataRetentionPolicyKey: string;
  trainingUsePolicyKey: string;
  governedPolicyKey: string;
  governedRouteRef: string;
}>;

/**
 * Dimensions on which the binding disagrees with the governed route. An empty
 * array means every compared dimension matched; the comparison is exact string
 * equality, with no normalization that could make two different governed
 * values look identical.
 */
export function compareBindingToGovernedRoute(
  binding: CaioGovernedAdmissionSubject,
  route: CaioGovernedRouteAdmission,
): readonly CaioGovernedAdmissionDimension[] {
  const expected: Readonly<Record<CaioGovernedAdmissionDimension, string>> = {
    providerKey: route.provider,
    credentialRef: route.credentialRef,
    region: route.region,
    dataRetentionPolicyKey: route.retentionPolicyKey,
    trainingUsePolicyKey: route.trainingUsePolicyKey,
  };
  return CAIO_GOVERNED_ADMISSION_DIMENSIONS.filter(
    (dimension) => binding[dimension] !== expected[dimension],
  );
}

/**
 * Resolve one route out of a frozen snapshot, as a verdict.
 *
 * Order matters: expiry is evaluated BEFORE lookup, so an expired snapshot
 * cannot admit anything even if it still holds the route. `now` is passed in
 * (never read from a clock here) so the caller owns time.
 */
export function admitFromSnapshot(input: {
  snapshot: CaioGovernedAdmissionSnapshot;
  binding: CaioGovernedAdmissionSubject;
  now: Date;
}): CaioGovernedRouteVerdict {
  const { snapshot, binding, now } = input;
  const validUntil = Date.parse(snapshot.validUntil);
  if (!Number.isFinite(validUntil)) {
    return Object.freeze({ admitted: false as const, reason: "admission_unverifiable" as const });
  }
  if (now.getTime() >= validUntil) {
    return Object.freeze({ admitted: false as const, reason: "policy_expired" as const });
  }
  if (binding.governedPolicyKey !== snapshot.policyKey) {
    // The binding names a different governed policy than the one this process
    // resolved: nothing here can speak for it.
    return Object.freeze({ admitted: false as const, reason: "route_not_in_policy" as const });
  }
  const route = snapshot.routes.get(binding.governedRouteRef);
  if (route === undefined) {
    return Object.freeze({ admitted: false as const, reason: "route_not_in_policy" as const });
  }
  if (compareBindingToGovernedRoute(binding, route).length > 0) {
    return Object.freeze({ admitted: false as const, reason: "binding_mismatch" as const });
  }
  return Object.freeze({ admitted: true as const, route });
}

/**
 * Apply the same dimension comparison to a route obtained LIVE. Kept separate
 * from admitFromSnapshot so the governed_fde path cannot accidentally consult
 * a snapshot: it only ever holds one route, the one just read.
 */
export function admitLiveRoute(input: {
  binding: CaioGovernedAdmissionSubject;
  verdict: CaioGovernedRouteVerdict;
}): CaioGovernedRouteVerdict {
  const { binding, verdict } = input;
  if (!verdict.admitted) return verdict;
  if (binding.governedPolicyKey !== verdict.route.policyKey) {
    return Object.freeze({ admitted: false as const, reason: "route_not_in_policy" as const });
  }
  if (compareBindingToGovernedRoute(binding, verdict.route).length > 0) {
    return Object.freeze({ admitted: false as const, reason: "binding_mismatch" as const });
  }
  return verdict;
}

/**
 * CONSTRUCTION-time assertion for the self-service posture, where the snapshot
 * is known up front: a binding the approved policy does not admit fails the
 * gateway's construction instead of failing every request at runtime.
 *
 * The governed_fde posture has no snapshot at construction (by design — it
 * verifies live), so its equivalent check happens on the request path, before
 * the audit claim.
 */
export function assertBindingAdmitted(input: {
  snapshot: CaioGovernedAdmissionSnapshot;
  binding: CaioGovernedAdmissionSubject;
  now: Date;
  /** Names the construction site in the error (e.g. "fallback candidate"). */
  role?: string;
}): void {
  const verdict = admitFromSnapshot(input);
  if (verdict.admitted) return;
  const role = input.role ?? "alias binding";
  throw new CaioGovernedAdmissionError(
    verdict.reason,
    `${role} ${input.binding.alias} -> ${input.binding.governedRouteRef}`,
  );
}
