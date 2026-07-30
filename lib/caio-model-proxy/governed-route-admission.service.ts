// CAIO model proxy — reading governed route admission from the ONE governed
// policy store.
//
// This is the only file in lib/caio-model-proxy that touches lib/llm, and it
// only READS. It reuses the governed store's own exported readers —
// parseStoredTenantModelRoutePolicy() and requireModelRoutePolicyOwnerApproval()
// — instead of reimplementing policy parsing or approval semantics, so "the
// policy is ACTIVE and a real human OWNER approved this exact revision" means
// here exactly what it means to the governed model gateway.
//
// It references NONE of the internal authority tokens that
// scripts/check-model-egress-governance.ts confines to the claim store, the
// governed gateway, the projection service, the readiness path and the adapter
// registry. (They are not even named here: that guard is a TEXT scan, so
// spelling them out in a comment would itself be a violation.) No guard was
// relaxed by this change and none needed to be.
//
// WHAT IT DOES NOT DO
// It does not prepare a route decision, claim a dispatch, or write any receipt
// into the governed ledger. A LAN passthrough request is not a governed
// projection, and issuing one of those receipts for it would be a false
// statement (see the design document's §2). Admission answers exactly one
// question: "does an ACTIVE, owner-approved policy contain this route, and
// does the binding match it?"

import type { Prisma } from "@prisma/client";

import {
  CaioGovernedAdmissionError,
  caioGovernedCredentialRef,
  caioGovernedRetentionPolicyKey,
  type CaioFrozenGovernedAdmissionPort,
  type CaioGovernedAdmissionSnapshot,
  type CaioGovernedRouteAdmission,
  type CaioGovernedRouteVerdict,
  type CaioLiveGovernedAdmissionPort,
} from "@/lib/caio-model-proxy/governed-admission-contracts";
import {
  parseStoredTenantModelRoutePolicy,
  requireModelRoutePolicyOwnerApproval,
} from "@/lib/llm/model-route-policy-store.service";

type Tx = Prisma.TransactionClient;

export type CaioGovernedAdmissionTransactionRunner = <T>(
  fn: (tx: Tx) => Promise<T>,
) => Promise<T>;

export type CaioGovernedAdmissionSource = Readonly<{
  workspaceId: string;
  policyKey: string;
  /**
   * Injectable so the admission logic is testable without a database. The
   * default runs inside a real transaction, imported lazily so that merely
   * importing this module does not construct a Prisma client.
   */
  runInTransaction?: CaioGovernedAdmissionTransactionRunner;
}>;

async function defaultRunInTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const { db } = await import("@/lib/db");
  return db.$transaction(fn);
}

function projectRoute(input: {
  route: {
    routeId: string;
    provider: string;
    credentialRef: string;
    region: string;
    deploymentForm: string;
    jurisdiction: string;
    retentionDays: number;
    trainingUse: string;
    pricingVersion: string;
    maxOutputTokens: number;
  };
  policyKey: string;
  policyId: string;
  policyHash: string;
  headVersion: number;
  revocationEpoch: number;
  validUntil: string;
}): CaioGovernedRouteAdmission {
  return Object.freeze({
    routeRef: input.route.routeId,
    policyKey: input.policyKey,
    policyId: input.policyId,
    policyHash: input.policyHash,
    policyHeadVersion: input.headVersion,
    policyRevocationEpoch: input.revocationEpoch,
    provider: input.route.provider,
    credentialRef: caioGovernedCredentialRef(input.route.credentialRef),
    region: input.route.region,
    deploymentForm: input.route.deploymentForm,
    jurisdiction: input.route.jurisdiction,
    retentionPolicyKey: caioGovernedRetentionPolicyKey(
      input.route.retentionDays,
    ),
    trainingUsePolicyKey: input.route.trainingUse,
    pricingVersion: input.route.pricingVersion,
    maxOutputTokens: input.route.maxOutputTokens,
    policyValidUntil: input.validUntil,
  });
}

/**
 * Read the ACTIVE, owner-approved policy for one policy key and project it
 * into an admission snapshot.
 *
 * FAIL CLOSED at every step: a missing head, a policy that is not ACTIVE, a
 * policy outside its validity window, or a missing/mismatched OWNER approval
 * receipt all THROW. There is no branch that returns an empty snapshot,
 * because an empty snapshot admits nothing and would be indistinguishable from
 * a policy that legitimately contains no routes — one is a fault, the other is
 * a configuration.
 */
export async function resolveCaioGovernedAdmissionSnapshot(
  source: CaioGovernedAdmissionSource,
  options: Readonly<{ now?: Date }> = {},
): Promise<CaioGovernedAdmissionSnapshot> {
  const now = options.now ?? new Date();
  const run = source.runInTransaction ?? defaultRunInTransaction;
  return await run(async (tx) => {
    // NO workspace write lock here, deliberately. lockModelEgressWorkspace()
    // exists to serialize WRITERS of the governed ledger; taking it on a
    // read-only admission check would serialize every LAN request in the
    // workspace behind one row lock — and in governed_fde this runs per
    // request. The three reads below happen inside one transaction, and every
    // inconsistency they could observe (missing head, non-ACTIVE policy,
    // mismatched approval, hash drift) ends in a REFUSAL, so the worst case of
    // reading without the lock is a spurious refusal, never a spurious
    // admission.
    const head = await tx.tenantModelRoutePolicyHead.findUnique({
      where: {
        workspaceId_policyKey: {
          workspaceId: source.workspaceId,
          policyKey: source.policyKey,
        },
      },
    });
    if (!head) {
      throw new CaioGovernedAdmissionError(
        "policy_not_active",
        `no active policy head for ${source.policyKey}`,
      );
    }
    const row = await tx.tenantModelRoutePolicy.findFirst({
      where: { id: head.activePolicyId, workspaceId: source.workspaceId },
    });
    if (!row) {
      throw new CaioGovernedAdmissionError(
        "policy_not_active",
        `head names a policy that does not exist: ${head.activePolicyId}`,
      );
    }
    if (row.status !== "ACTIVE") {
      throw new CaioGovernedAdmissionError(
        "policy_not_active",
        `policy ${row.id} is ${row.status}`,
      );
    }
    // Reuse the store's own parser: policy JSON is validated AND bound to its
    // row (id, workspace, key, revision, validity window, approval refs, hash).
    const policy = parseStoredTenantModelRoutePolicy(row);
    const validFrom = Date.parse(policy.validFrom);
    const validUntil = Date.parse(policy.validUntil);
    if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil)) {
      throw new CaioGovernedAdmissionError(
        "admission_unverifiable",
        `policy ${policy.policyId} has an unreadable validity window`,
      );
    }
    if (now.getTime() < validFrom || now.getTime() >= validUntil) {
      throw new CaioGovernedAdmissionError(
        "policy_expired",
        `policy ${policy.policyId} is outside its validity window`,
      );
    }
    // A REAL HUMAN OWNER approval receipt, matched on policyHash / policyKey /
    // revision / approvedByUserRef by the store itself. A policy row alone is
    // never authority.
    await requireModelRoutePolicyOwnerApproval(tx, {
      workspaceId: source.workspaceId,
      policy,
    });

    const routes = new Map<string, CaioGovernedRouteAdmission>();
    for (const route of policy.routes) {
      routes.set(
        route.routeId,
        projectRoute({
          route,
          policyKey: policy.policyKey,
          policyId: policy.policyId,
          policyHash: policy.policyHash,
          headVersion: head.version,
          revocationEpoch: head.revocationEpoch,
          validUntil: policy.validUntil,
        }),
      );
    }
    return Object.freeze({
      policyKey: policy.policyKey,
      policyId: policy.policyId,
      policyHash: policy.policyHash,
      policyHeadVersion: head.version,
      policyRevocationEpoch: head.revocationEpoch,
      resolvedAt: now.toISOString(),
      validUntil: policy.validUntil,
      routes,
    });
  });
}

/**
 * self_service: wrap an already-resolved snapshot as a frozen port.
 *
 * The snapshot is resolved ONCE, by the composition root, before the gateway
 * starts serving. A revocation after that point is observed only on reload —
 * documented at the contract and repeated here so no caller can plead
 * ignorance. The trade is deliberate: no per-request database dependency is
 * exactly what keeps the encrypted emergency queue meaningful.
 */
export function createCaioFrozenGovernedAdmission(
  snapshot: CaioGovernedAdmissionSnapshot,
): CaioFrozenGovernedAdmissionPort {
  return Object.freeze({
    posture: "self_service" as const,
    snapshot() {
      return snapshot;
    },
  });
}

/**
 * governed_fde: verify one route per request against the LIVE policy head.
 *
 * Every request re-reads the head (version + revocationEpoch), the policy row,
 * its status and validity window, and the OWNER approval receipt. A read that
 * throws for any reason is reported as `admission_unverifiable` — the request
 * is refused, never allowed on the strength of an earlier answer.
 */
export function createCaioLiveGovernedAdmission(
  source: CaioGovernedAdmissionSource,
): CaioLiveGovernedAdmissionPort {
  return Object.freeze({
    posture: "governed_fde" as const,
    policyKey: source.policyKey,
    async verify(input): Promise<CaioGovernedRouteVerdict> {
      let snapshot: CaioGovernedAdmissionSnapshot;
      try {
        snapshot = await resolveCaioGovernedAdmissionSnapshot(source, {
          now: input.now,
        });
      } catch (error) {
        if (error instanceof CaioGovernedAdmissionError) {
          return Object.freeze({
            admitted: false as const,
            reason: error.reason,
          });
        }
        return Object.freeze({
          admitted: false as const,
          reason: "admission_unverifiable" as const,
        });
      }
      const route = snapshot.routes.get(input.routeRef);
      if (route === undefined) {
        return Object.freeze({
          admitted: false as const,
          reason: "route_not_in_policy" as const,
        });
      }
      return Object.freeze({ admitted: true as const, route });
    },
  });
}
