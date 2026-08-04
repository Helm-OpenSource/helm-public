// Reading governed admission out of the ONE governed policy store.
//
// The transaction runner is injected, so these tests exercise the REAL
// readers from lib/llm (parseStoredTenantModelRoutePolicy and
// requireModelRoutePolicyOwnerApproval) against real, hash-bound fixture rows
// without needing a database. Every fixture is built with the store's own hash
// helpers: a policy whose hash or approval binding is wrong is refused by the
// same code the governed model gateway relies on, not by a copy of it.

import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computeModelRoutePolicyApprovalReceiptHash,
  computeModelRoutePolicyApprovalReceiptRef,
  computeTenantModelRoutePolicyHash,
  type ModelRoutePolicyApprovalReceipt,
  type TenantModelRoute,
  type TenantModelRoutePolicy,
} from "@/lib/llm/model-route-contracts";

import { CaioGovernedAdmissionError } from "./governed-admission-contracts";
import {
  createCaioLiveGovernedAdmission,
  resolveCaioGovernedAdmissionSnapshot,
} from "./governed-route-admission.service";

const WORKSPACE_ID = "ws-governed";
const POLICY_KEY = "caio-lan-default";
const POLICY_ID = "policy:caio-lan-default-v1";
const OWNER_USER_ID = "user-owner-1";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const VALID_FROM = "2026-07-01T00:00:00.000Z";
const VALID_UNTIL = "2026-08-30T00:00:00.000Z";
const NOW = new Date("2026-07-30T00:00:00.000Z");

function route(overrides: Partial<TenantModelRoute> = {}): TenantModelRoute {
  return {
    routeId: "route-provider-a-primary",
    provider: "provider-a",
    modelId: "provider-a-large",
    modelVersion: "provider-a-large-20260701",
    adapterKey: "provider-a",
    readinessReceiptRef: "readiness:route-provider-a-primary",
    readinessReceiptHash: HASH_A,
    credentialRef: "secret:provider-a-key",
    governanceProfileRef: "governance:caio-lan",
    governanceProfileHash: HASH_B,
    projectorRegistrationRef: "projector:caio-lan",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "projector-v1",
    scannerRegistrationRef: "scanner:caio-lan",
    scannerRegistrationHash: HASH_B,
    scannerVersion: "scanner-v1",
    deploymentForm: "private_deployment",
    jurisdiction: "customer_premises",
    region: "cn-hangzhou",
    allowedTaskClasses: ["summary_briefing"],
    maximumSensitivity: "confidential",
    allowedProcessingDispositions: ["remote_projected"],
    retentionDays: 30,
    trainingUse: "prohibited",
    termsAssurance: "contractual_no_retention",
    providerTermsRef: "terms:provider-a-202607",
    providerTermsHash: HASH_B,
    deletionTermsRef: "terms:provider-a-delete-202607",
    deletionTermsHash: HASH_A,
    pricingTermsRef: "pricing:provider-a-202607",
    pricingTermsHash: HASH_B,
    pricingVersion: "provider-a-pricing-202607",
    maxInputTokens: 16_000,
    maxOutputTokens: 4_000,
    maxCostUsdMicros: 500_000,
    maxLatencyMs: 15_000,
    maxConcurrency: 8,
    fallbackRouteIds: [],
    ...overrides,
  };
}

function policy(
  routes: readonly TenantModelRoute[] = [route()],
): TenantModelRoutePolicy {
  const approvedByRef = `user:${OWNER_USER_ID}`;
  const base: TenantModelRoutePolicy = {
    schemaVersion: "helm.tenant-model-route-policy/v1",
    policyId: POLICY_ID,
    workspaceRef: `workspace:${WORKSPACE_ID}`,
    policyKey: POLICY_KEY,
    revision: 1,
    routes,
    primaryRoutes: [
      { taskClass: "summary_briefing", routeRef: routes[0]?.routeId ?? "" },
    ],
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
    approvalRef: computeModelRoutePolicyApprovalReceiptRef({
      workspaceRef: `workspace:${WORKSPACE_ID}`,
      policyId: POLICY_ID,
      policyKey: POLICY_KEY,
      revision: 1,
      approvedByRef,
    }),
    approvedByRef,
    createdAt: VALID_FROM,
    policyHash: HASH_A,
    status: "active",
    authorityEffect: "model_egress_only",
  };
  return { ...base, policyHash: computeTenantModelRoutePolicyHash(base) };
}

function policyRow(stored: TenantModelRoutePolicy, status = "ACTIVE") {
  return {
    id: stored.policyId,
    workspaceId: WORKSPACE_ID,
    policyKey: stored.policyKey,
    revision: stored.revision,
    status,
    validFrom: new Date(stored.validFrom),
    validUntil: new Date(stored.validUntil),
    approvalRef: stored.approvalRef,
    approvedByRef: stored.approvedByRef,
    createdByUserId: OWNER_USER_ID,
    policyJson: JSON.stringify(stored),
    policyHash: stored.policyHash,
    createdAt: new Date(stored.createdAt),
  };
}

function approvalRow(stored: TenantModelRoutePolicy) {
  const approvedAt = new Date(VALID_FROM);
  const candidate: ModelRoutePolicyApprovalReceipt = {
    schemaVersion: "helm.model-route-policy-approval-receipt/v1",
    receiptId: stored.approvalRef,
    workspaceRef: stored.workspaceRef,
    policyRef: stored.policyId,
    policyHash: stored.policyHash,
    policyKey: stored.policyKey,
    policyRevision: stored.revision,
    approvedByUserRef: stored.approvedByRef,
    expectedHeadVersion: null,
    approvedAt: approvedAt.toISOString(),
    authorityEffect: "model_route_policy_activation_only",
    contentHash: "sha256:pending",
  };
  const receipt: ModelRoutePolicyApprovalReceipt = {
    ...candidate,
    contentHash: computeModelRoutePolicyApprovalReceiptHash(candidate),
  };
  return {
    id: receipt.receiptId,
    workspaceId: WORKSPACE_ID,
    policyId: stored.policyId,
    policyHash: receipt.policyHash,
    policyKey: receipt.policyKey,
    policyRevision: receipt.policyRevision,
    approvedByUserId: OWNER_USER_ID,
    expectedHeadVersion: receipt.expectedHeadVersion,
    approvedAt,
    contentHash: receipt.contentHash,
    receiptJson: JSON.stringify(receipt),
  };
}

/** A transaction client with exactly the three reads the resolver performs. */
function fakeTx(input: {
  head?: unknown;
  policy?: unknown;
  approval?: unknown;
}) {
  const tx = {
    tenantModelRoutePolicyHead: {
      findUnique: async () => input.head ?? null,
    },
    tenantModelRoutePolicy: {
      findFirst: async () => input.policy ?? null,
    },
    modelRoutePolicyApprovalReceipt: {
      findFirst: async () => input.approval ?? null,
    },
  } as unknown as Prisma.TransactionClient;
  return async <T>(fn: (client: Prisma.TransactionClient) => Promise<T>) =>
    fn(tx);
}

function head(overrides: Record<string, unknown> = {}) {
  return {
    id: "head-1",
    workspaceId: WORKSPACE_ID,
    policyKey: POLICY_KEY,
    activePolicyId: POLICY_ID,
    version: 5,
    revocationEpoch: 2,
    updatedAt: new Date(VALID_FROM),
    ...overrides,
  };
}

function source(runInTransaction: ReturnType<typeof fakeTx>) {
  return { workspaceId: WORKSPACE_ID, policyKey: POLICY_KEY, runInTransaction };
}

describe("caio governed route admission — snapshot resolution", () => {
  it("projects every route field verbatim from the approved policy", async () => {
    const stored = policy();
    const snapshot = await resolveCaioGovernedAdmissionSnapshot(
      source(
        fakeTx({
          head: head(),
          policy: policyRow(stored),
          approval: approvalRow(stored),
        }),
      ),
      { now: NOW },
    );
    expect(snapshot.policyKey).toBe(POLICY_KEY);
    expect(snapshot.policyId).toBe(POLICY_ID);
    expect(snapshot.policyHash).toBe(stored.policyHash);
    // The live head identity travels with the snapshot, so an operator can see
    // which head version and revocation epoch this process admitted under.
    expect(snapshot.policyHeadVersion).toBe(5);
    expect(snapshot.policyRevocationEpoch).toBe(2);
    expect(snapshot.validUntil).toBe(VALID_UNTIL);

    const admitted = snapshot.routes.get("route-provider-a-primary");
    expect(admitted).toBeDefined();
    expect(admitted).toMatchObject({
      provider: "provider-a",
      // Projected from the governed `secret:provider-a-key` into the alias
      // binding's flat credential-ref vocabulary.
      credentialRef: "provider-a-key",
      region: "cn-hangzhou",
      deploymentForm: "private_deployment",
      jurisdiction: "customer_premises",
      // Derived from the route's retentionDays — never defaulted.
      retentionPolicyKey: "retention-days:30",
      trainingUsePolicyKey: "prohibited",
      pricingVersion: "provider-a-pricing-202607",
      maxOutputTokens: 4_000,
    });
  });

  // Every failure THROWS. None of them returns an empty snapshot, because an
  // empty snapshot is indistinguishable from a policy that admits nothing.
  it("throws when no active policy head exists", async () => {
    await expect(
      resolveCaioGovernedAdmissionSnapshot(source(fakeTx({ head: null })), {
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(CaioGovernedAdmissionError);
  });

  it("throws when the head names a policy row that does not exist", async () => {
    await expect(
      resolveCaioGovernedAdmissionSnapshot(
        source(fakeTx({ head: head(), policy: null })),
        { now: NOW },
      ),
    ).rejects.toThrow(/policy_not_active/u);
  });

  it("throws when the policy row is not ACTIVE", async () => {
    const stored = policy();
    await expect(
      resolveCaioGovernedAdmissionSnapshot(
        source(
          fakeTx({
            head: head(),
            policy: policyRow(stored, "REVOKED"),
            approval: approvalRow(stored),
          }),
        ),
        { now: NOW },
      ),
    ).rejects.toThrow(/policy_not_active/u);
  });

  it("throws when the policy is outside its validity window", async () => {
    const stored = policy();
    await expect(
      resolveCaioGovernedAdmissionSnapshot(
        source(
          fakeTx({
            head: head(),
            policy: policyRow(stored),
            approval: approvalRow(stored),
          }),
        ),
        { now: new Date("2026-09-01T00:00:00.000Z") },
      ),
    ).rejects.toThrow(/policy_expired/u);
  });

  // A policy row is never authority on its own: a real human OWNER approval
  // receipt must exist and match. This is the store's own check, reused.
  it("throws when the OWNER approval receipt is missing", async () => {
    const stored = policy();
    await expect(
      resolveCaioGovernedAdmissionSnapshot(
        source(
          fakeTx({
            head: head(),
            policy: policyRow(stored),
            approval: null,
          }),
        ),
        { now: NOW },
      ),
    ).rejects.toThrow(/owner_approval_missing/u);
  });

  it("throws when the approval receipt does not bind this policy revision", async () => {
    const stored = policy();
    const divergent = {
      ...approvalRow(stored),
      policyRevision: 2,
    };
    await expect(
      resolveCaioGovernedAdmissionSnapshot(
        source(
          fakeTx({
            head: head(),
            policy: policyRow(stored),
            approval: divergent,
          }),
        ),
        { now: NOW },
      ),
    ).rejects.toThrow();
  });

  it("throws when the stored policy JSON does not match its row", async () => {
    const stored = policy();
    const tampered = {
      ...policyRow(stored),
      policyJson: JSON.stringify({ ...stored, policyKey: "other-key" }),
    };
    await expect(
      resolveCaioGovernedAdmissionSnapshot(
        source(
          fakeTx({
            head: head(),
            policy: tampered,
            approval: approvalRow(stored),
          }),
        ),
        { now: NOW },
      ),
    ).rejects.toThrow();
  });
});

describe("caio governed route admission — live verification", () => {
  it("admits a route the live policy still contains", async () => {
    const stored = policy();
    const port = createCaioLiveGovernedAdmission(
      source(
        fakeTx({
          head: head(),
          policy: policyRow(stored),
          approval: approvalRow(stored),
        }),
      ),
    );
    expect(port.posture).toBe("governed_fde");
    expect(port.policyKey).toBe(POLICY_KEY);
    const verdict = await port.verify({
      routeRef: "route-provider-a-primary",
      now: NOW,
    });
    expect(verdict.admitted).toBe(true);
  });

  it("refuses a route the live policy does not contain", async () => {
    const stored = policy();
    const port = createCaioLiveGovernedAdmission(
      source(
        fakeTx({
          head: head(),
          policy: policyRow(stored),
          approval: approvalRow(stored),
        }),
      ),
    );
    expect(
      await port.verify({ routeRef: "route-invented", now: NOW }),
    ).toEqual({ admitted: false, reason: "route_not_in_policy" });
  });

  // Revocation is observed on the NEXT request in this posture: once the head
  // is gone (or the policy is no longer ACTIVE), verification refuses.
  it("refuses as soon as the live head is revoked", async () => {
    const port = createCaioLiveGovernedAdmission(
      source(fakeTx({ head: null })),
    );
    expect(
      await port.verify({ routeRef: "route-provider-a-primary", now: NOW }),
    ).toEqual({ admitted: false, reason: "policy_not_active" });
  });

  it("reports an unreadable policy store as unverifiable, never as admitted", async () => {
    const port = createCaioLiveGovernedAdmission({
      workspaceId: WORKSPACE_ID,
      policyKey: POLICY_KEY,
      runInTransaction: async () => {
        throw new Error("policy store unreachable");
      },
    });
    expect(
      await port.verify({ routeRef: "route-provider-a-primary", now: NOW }),
    ).toEqual({ admitted: false, reason: "admission_unverifiable" });
  });
});
