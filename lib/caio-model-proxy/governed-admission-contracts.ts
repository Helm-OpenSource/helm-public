// CAIO model proxy — governed route admission contracts.
//
// WHAT THIS IS FOR
// The owner ruling of 2026-07-30 subordinates BOTH deployment postures to the
// governed model-route policy: "自助 ≠ 无治理，自助 = 治理准入 + 可用性优先的降级
// 策略". Concretely, every alias binding must NAME a route that lives in an
// ACTIVE TenantModelRoutePolicy carrying a real human OWNER approval, and a
// dispatch whose route is not admitted is refused BEFORE the audit claim,
// before the credential load and before any upstream contact.
//
// The two postures differ ONLY in when that admission is resolved, and the
// difference is expressed as two different PORT TYPES rather than a flag:
//
//   self_service  → CaioFrozenGovernedAdmissionPort
//       One snapshot, resolved at construction and frozen. No per-request
//       database dependency, which is exactly what lets the encrypted
//       emergency queue keep serving while the primary store is down.
//       CONSEQUENCE, stated here because product material must not claim
//       otherwise: an owner REVOKING the policy after this point is observed
//       only when the process reloads. Revocation is NOT instantaneous in this
//       posture. The snapshot still hard-expires at `validUntil`.
//
//   governed_fde  → CaioLiveGovernedAdmissionPort
//       Re-verified per request against the live policy head, including its
//       version and revocationEpoch. A revocation takes effect on the next
//       request; an unanswerable check is a refusal, never an allow.
//
// Nothing here imports lib/llm: this file is the vocabulary, and
// governed-route-admission.service.ts is the one place that reads the governed
// policy store.

import type { CaioDeploymentPosture } from "@/lib/caio-audit-state/deployment-posture";

/**
 * Canonical retention policy key derived from a governed route's
 * `retentionDays`. The alias binding carries policy KEYS (strings) while the
 * governed route carries a NUMBER, so the projection is fixed here instead of
 * being guessed at each comparison site. An operator writes this exact string
 * into `dataRetentionPolicyKey`; anything else is a mismatch and refuses.
 */
export function caioGovernedRetentionPolicyKey(retentionDays: number): string {
  return `retention-days:${retentionDays}`;
}

/** Prefix every governed route credential reference must carry. */
export const CAIO_GOVERNED_CREDENTIAL_REF_PREFIX = "secret:";

/**
 * Project a governed route's credential reference into the alias binding's
 * vocabulary.
 *
 * The governed contract requires `secret:<name>`
 * (lib/llm/model-route-contracts.ts: credential_ref_must_be_secret_ref) while
 * a CAIO binding's credentialRef is a flat local key (`^[a-z0-9][a-z0-9-]{1,64}$`,
 * because it names a file the gateway reads). Comparing the two literally
 * could never match, so the ONE projection is defined here: strip the prefix.
 *
 * CONSEQUENCE, deliberate and fail-closed: a governed route whose secret name
 * is not itself a valid CAIO credential ref (for example `secret:tenant/x`)
 * can never be matched by a binding, and every dispatch through it refuses.
 * An operator resolves that by naming the secret in the shared vocabulary, not
 * by loosening the comparison.
 */
export function caioGovernedCredentialRef(
  routeCredentialRef: string,
): string {
  return routeCredentialRef.startsWith(CAIO_GOVERNED_CREDENTIAL_REF_PREFIX)
    ? routeCredentialRef.slice(CAIO_GOVERNED_CREDENTIAL_REF_PREFIX.length)
    : routeCredentialRef;
}

/**
 * One admitted route, projected from the governed policy. Every value is read
 * VERBATIM from the stored policy — nothing here is defaulted, and a field the
 * policy does not carry is not invented.
 */
export type CaioGovernedRouteAdmission = Readonly<{
  routeRef: string;
  policyKey: string;
  policyId: string;
  policyHash: string;
  policyHeadVersion: number;
  policyRevocationEpoch: number;
  provider: string;
  /** caioGovernedCredentialRef(route.credentialRef) — the `secret:` prefix stripped. */
  credentialRef: string;
  region: string;
  deploymentForm: string;
  jurisdiction: string;
  /** caioGovernedRetentionPolicyKey(route.retentionDays). */
  retentionPolicyKey: string;
  /** route.trainingUse, verbatim. */
  trainingUsePolicyKey: string;
  pricingVersion: string;
  maxOutputTokens: number;
  /** Policy validity horizon, ISO-8601. A snapshot past it admits nothing. */
  policyValidUntil: string;
}>;

/**
 * The frozen admission set for one policy key. `routes` is keyed by routeRef.
 * The snapshot names the policy IDENTITY it came from so a receipt, a readout,
 * or an operator can tie a dispatch back to the approved policy revision.
 */
export type CaioGovernedAdmissionSnapshot = Readonly<{
  policyKey: string;
  policyId: string;
  policyHash: string;
  policyHeadVersion: number;
  policyRevocationEpoch: number;
  /** When this snapshot was resolved, ISO-8601. */
  resolvedAt: string;
  /** Policy validity horizon, ISO-8601; the snapshot hard-expires here. */
  validUntil: string;
  routes: ReadonlyMap<string, CaioGovernedRouteAdmission>;
}>;

/**
 * Why a route is not admitted. Closed set: a new reason must be added here and
 * handled at every consumer rather than falling into a default "allow".
 */
export const CAIO_ROUTE_ADMISSION_DENIALS = [
  /** The alias binding names a routeRef the policy does not contain. */
  "route_not_in_policy",
  /** No ACTIVE policy head for the declared policy key. */
  "policy_not_active",
  /** The policy (or the frozen snapshot taken from it) is past validUntil. */
  "policy_expired",
  /** The human OWNER approval receipt is missing or does not match. */
  "owner_approval_missing",
  /** A governed dimension of the binding disagrees with the governed route. */
  "binding_mismatch",
  /** The check itself could not be completed; fail closed, never allow. */
  "admission_unverifiable",
] as const;

export type CaioRouteAdmissionDenial =
  (typeof CAIO_ROUTE_ADMISSION_DENIALS)[number];

export type CaioGovernedRouteVerdict =
  | Readonly<{ admitted: true; route: CaioGovernedRouteAdmission }>
  | Readonly<{ admitted: false; reason: CaioRouteAdmissionDenial }>;

/**
 * self_service: a snapshot resolved once and frozen. Synchronous by design —
 * a per-request await here would reintroduce the live dependency the posture
 * exists to avoid.
 */
export type CaioFrozenGovernedAdmissionPort = Readonly<{
  posture: Extract<CaioDeploymentPosture, "self_service">;
  snapshot(): CaioGovernedAdmissionSnapshot;
}>;

/**
 * governed_fde: live verification per request. There is no snapshot() to read
 * from, so no code path in this posture can answer an admission question from
 * a cached policy.
 */
export type CaioLiveGovernedAdmissionPort = Readonly<{
  posture: Extract<CaioDeploymentPosture, "governed_fde">;
  /**
   * The governed policy key this port verifies against. Published so the proxy
   * can refuse, at construction, a binding that names a different policy —
   * the one check this posture can make before it has seen a request.
   */
  policyKey: string;
  verify(input: {
    routeRef: string;
    now: Date;
  }): Promise<CaioGovernedRouteVerdict>;
}>;

export type CaioGovernedAdmissionPort =
  | CaioFrozenGovernedAdmissionPort
  | CaioLiveGovernedAdmissionPort;

/**
 * Raised when governed admission cannot be established at CONSTRUCTION time:
 * an alias binding naming a route no approved policy contains, a binding whose
 * governed dimensions disagree with the policy, or a snapshot that cannot be
 * resolved. Construction fails; the gateway does not start with a binding it
 * cannot justify.
 */
export class CaioGovernedAdmissionError extends Error {
  readonly code = "caio_route_not_admitted";
  readonly reason: CaioRouteAdmissionDenial;

  constructor(reason: CaioRouteAdmissionDenial, detail: string) {
    super(`caio_route_not_admitted: ${reason}: ${detail}`);
    this.name = "CaioGovernedAdmissionError";
    this.reason = reason;
  }
}
