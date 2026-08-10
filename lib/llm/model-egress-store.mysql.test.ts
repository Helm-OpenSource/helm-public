import {
  MembershipStatus,
  type Prisma,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getWorkspaceModelEgressOwnerReadout } from "@/features/dashboard/model-egress-query";
import { db } from "@/lib/db";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  GOVERNED_GATEWAY_AUTHORITY,
  GOVERNED_MODEL_PROJECTION_AUTHORITY,
  claimModelRouteDispatch,
  prepareModelRouteDecision,
  readModelRouteDecision,
  recordGovernedModelProjectionReceipt,
  recordModelEgressTerminalReceipt,
} from "@/lib/llm/model-egress-store.service";
import {
  computeModelRoutePolicyApprovalReceiptRef,
  computeProviderAdapterReadinessHash,
  computeTenantModelRoutePolicyHash,
  type ProviderAdapterReadinessReceipt,
  type TenantModelRoute,
  type TenantModelRoutePolicy,
} from "@/lib/llm/model-route-contracts";
import { computeModelProviderIdempotencyKey } from "@/lib/llm/model-egress-contracts";
import {
  GOVERNED_MODEL_READINESS_AUTHORITY,
  activateTenantModelRoutePolicy,
  createTenantModelRoutePolicyDraft,
  recordProviderAdapterReadinessReceipt,
  revokeTenantModelRoutePolicy,
} from "@/lib/llm/model-route-policy-store.service";
import {
  createDataAssetCatalogEntry,
  recordDataAssetAuthorizationReceipt,
  recordDataAssetClassificationReceipt,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";

const integrationDatabaseUrl =
  process.env.MODEL_EGRESS_STORE_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.MODEL_EGRESS_STORE_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_p1d_";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
const REQUESTED_MAX_OUTPUT_TOKENS = 200;
const PRICING_VERSION = "synthetic-pricing-202607";
const ZERO_COST_EVIDENCE = {
  actualCostUsdMicros: 0,
  costCurrency: "USD" as const,
  pricingVersion: PRICING_VERSION,
};
const LOW_COST_EVIDENCE = {
  actualCostUsdMicros: 12_500,
  costCurrency: "USD" as const,
  pricingVersion: PRICING_VERSION,
};

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal MODEL_EGRESS_STORE_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(
      parsed.pathname.replace(/^\/+/u, ""),
    );
  } catch {
    throw new Error(
      "MODEL_EGRESS_STORE_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing model-egress integration test: confirm the isolated database name and use the helm_caio_p1d_ prefix.",
    );
  }
}

async function waitForBlockedWorkspaceLock(): Promise<void> {
  const pattern = "%FROM Workspace WHERE id = %FOR UPDATE%";
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const rows = await db.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
      WHERE COMMAND IN ('Query', 'Execute')
        AND INFO LIKE ${pattern}
        AND TIME >= 1
        AND ID <> CONNECTION_ID()`;
    if (Number(rows[0]?.n ?? 0) >= 1) return;
    await new Promise((resolveSleep) =>
      setTimeout(resolveSleep, 25),
    );
  }
  throw new Error("timed out waiting for a blocked Workspace row lock");
}

function holdWorkspaceLock(workspaceId: string) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let acquiredResolve: () => void = () => {};
  const acquired = new Promise<void>((resolveAcquired) => {
    acquiredResolve = resolveAcquired;
  });
  const done = db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`
        SELECT id FROM Workspace
        WHERE id = ${workspaceId}
        FOR UPDATE`;
      acquiredResolve();
      await gate;
    },
    { timeout: 30_000 },
  );
  return { acquired, release, done };
}

function route(
  routeId: string,
  readinessReceiptHash: string,
  overrides: Partial<TenantModelRoute> = {},
): TenantModelRoute {
  return {
    routeId,
    provider: "synthetic-provider",
    modelId: "synthetic-model",
    modelVersion: "synthetic-model-20260723",
    adapterKey: "synthetic-adapter",
    readinessReceiptRef: `readiness:${routeId}`,
    readinessReceiptHash,
    credentialRef: `secret:tenant/${routeId}`,
    governanceProfileRef: "governance:caio-p1d-synthetic",
    governanceProfileHash: HASH_A,
    projectorRegistrationRef:
      "projector:synthetic-model-egress",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "v1",
    scannerRegistrationRef:
      "scanner:synthetic-model-egress",
    scannerRegistrationHash: HASH_B,
    scannerVersion: "v1",
    deploymentForm: "domestic_cloud",
    jurisdiction: "domestic",
    region: "cn-test-1",
    allowedTaskClasses: ["summary_briefing"],
    maximumSensitivity: "confidential",
    allowedProcessingDispositions: ["remote_projected"],
    retentionDays: 0,
    trainingUse: "prohibited",
    termsAssurance: "contractual_no_retention",
    providerTermsRef: "terms:synthetic-enterprise",
    providerTermsHash: HASH_B,
    deletionTermsRef: "terms:synthetic-delete",
    deletionTermsHash: HASH_C,
    pricingTermsRef: "pricing:synthetic-202607",
    pricingTermsHash: HASH_A,
    pricingVersion: "synthetic-pricing-202607",
    maxInputTokens: 8_000,
    maxOutputTokens: 2_000,
    maxCostUsdMicros: 100_000,
    maxLatencyMs: 15_000,
    maxConcurrency: 1,
    fallbackRouteIds: [],
    ...overrides,
  };
}

function readiness(input: {
  workspaceId: string;
  target: TenantModelRoute;
  checkedAt: Date;
  expiresAt: Date;
}): ProviderAdapterReadinessReceipt {
  const candidate: ProviderAdapterReadinessReceipt = {
    schemaVersion: "helm.provider-adapter-readiness-receipt/v1",
    receiptId: input.target.readinessReceiptRef,
    workspaceRef: `workspace:${input.workspaceId}`,
    provider: input.target.provider,
    modelId: input.target.modelId,
    modelVersion: input.target.modelVersion,
    adapterKey: input.target.adapterKey,
    adapterVersion: "synthetic-adapter-v1",
    adapterRegistrationRef:
      "adapter-registration:synthetic-adapter",
    adapterRegistrationHash: HASH_B,
    deploymentForm: input.target.deploymentForm,
    jurisdiction: input.target.jurisdiction,
    region: input.target.region,
    endpointFingerprint: HASH_C,
    credentialRef: input.target.credentialRef,
    adapterRegistered: true,
    credentialConfigured: true,
    modelProbeStatus: "ready",
    capabilityRefs: ["capability:structured-output"],
    checkedAt: input.checkedAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    evidenceRefs: [`evidence:${input.target.routeId}:probe`],
    rawCredentialIncluded: false,
    contentHash: HASH_A,
  };
  return {
    ...candidate,
    contentHash: computeProviderAdapterReadinessHash(candidate),
  };
}

describeMysql("model egress store with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerUserId = "";
  let invitedUserId = "";
  let assetId = "";
  let policyId = "";
  let activeHeadVersion = 0;
  let primaryRoute: TenantModelRoute;
  let fallbackRoute: TenantModelRoute;

  async function projection(
    selectedEvidenceRef: string,
    idempotencyKey: string,
    tokenBudget: {
      maxInputTokens: number;
      maxOutputTokens: number;
    } = {
      maxInputTokens: 1_000,
      maxOutputTokens: 200,
    },
    sourceAssetRef = assetId,
    now = new Date(),
    projectedPayloadHash = HASH_C,
    projectedPayloadBytes = 128,
    trustRootOverrides: {
      projectorRegistrationHash?: string;
      scannerVersion?: string;
    } = {},
  ): Promise<string> {
    const recorded =
      await recordGovernedModelProjectionReceipt({
        authority: GOVERNED_MODEL_PROJECTION_AUTHORITY,
        workspaceId,
        idempotencyKey,
        sourceAssetRefs: [sourceAssetRef],
        candidateEvidenceRefs: [selectedEvidenceRef],
        selectedEvidenceRefs: [selectedEvidenceRef],
        droppedEvidenceRefs: [],
        projectedPayloadHash,
        projectedPayloadBytes,
        maxInputTokens: tokenBudget.maxInputTokens,
        maxOutputTokens: tokenBudget.maxOutputTokens,
        remoteSafe: true,
        redactionStatus: "redacted",
        promptInjectionScanStatus: "passed",
        projectorRegistrationRef:
          "projector:synthetic-model-egress",
        projectorRegistrationHash:
          trustRootOverrides.projectorRegistrationHash ??
          HASH_A,
        projectorVersion: "v1",
        scannerRegistrationRef:
          "scanner:synthetic-model-egress",
        scannerRegistrationHash: HASH_B,
        scannerVersion:
          trustRootOverrides.scannerVersion ?? "v1",
        now,
      });
    return recorded.receipt.receiptId;
  }

  beforeAll(async () => {
    assertIsolatedDatabaseTarget();
    const now = new Date();
    const workspace = await db.workspace.create({
      data: {
        name: `Model egress integration ${suffix}`,
        slug: `model-egress-integration-${suffix}`,
      },
    });
    workspaceId = workspace.id;
    const owner = await db.user.create({
      data: {
        name: "Model egress owner",
        email: `model-egress-owner-${suffix}@example.test`,
      },
    });
    ownerUserId = owner.id;
    await db.membership.create({
      data: {
        workspaceId,
        userId: ownerUserId,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const invited = await db.user.create({
      data: {
        name: "Invited model egress owner",
        email: `model-egress-invited-${suffix}@example.test`,
      },
    });
    invitedUserId = invited.id;
    await db.membership.create({
      data: {
        workspaceId,
        userId: invitedUserId,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.INVITED,
      },
    });

    const catalogEntry = await createDataAssetCatalogEntry({
      workspaceId,
      assetKey: `synthetic-crm-${suffix}`,
      sourceSystemRef: "system:synthetic-crm",
      displayName: "Synthetic CRM",
      sourceKind: "crm",
      businessDomain: "sales",
      businessOwnerRef: ownerUserId,
      purpose: "Exercise model egress governance with synthetic data",
      scopeRefs: ["scope:synthetic-crm"],
      recommendedAccessMode: "read_only_api",
      retentionDays: 30,
      freshnessSlaMinutes: 60,
      residencyRequirements: ["region:cn-test-1"],
      blindSpots: [],
      blockerCodes: [],
      riskOwnerRef: ownerUserId,
      nextReviewAt: new Date(now.getTime() + 86_400_000),
      evidenceRefs: ["evidence:synthetic-crm-inventory"],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now,
    });
    assetId = catalogEntry.id;
    await db.dataAssetCatalogEntry.update({
      where: { id: assetId },
      data: { inventoryStatus: "CONFIRMED" },
    });
    await recordDataAssetClassificationReceipt({
      workspaceId,
      assetId,
      receiptId: `classification-${suffix}`,
      idempotencyKey: `classification:${suffix}`,
      expectedVersion: 1,
      dataShape: "structured",
      sensitivity: "confidential",
      processingDisposition: "remote_projected",
      technicalFeasibility: "feasible",
      evidenceRefs: ["evidence:synthetic-crm-classification"],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now,
    });
    await recordDataAssetAuthorizationReceipt({
      workspaceId,
      assetId,
      receiptId: `authorization-${suffix}`,
      idempotencyKey: `authorization:${suffix}`,
      expectedVersion: 2,
      authorizationStatus: "authorized",
      authorizationRef: "authorization:synthetic-crm",
      scopeRefs: ["scope:synthetic-crm"],
      consentRefs: [],
      validFrom: new Date(now.getTime() - 60_000),
      validUntil: new Date(now.getTime() + 86_400_000),
      reasonCodes: [],
      evidenceRefs: ["evidence:synthetic-crm-authorization"],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now,
    });

    const primaryRouteId = `synthetic-primary-${suffix}`;
    const fallbackRouteId = `synthetic-fallback-${suffix}`;
    const primaryReadinessBase = route(primaryRouteId, HASH_A, {
      fallbackRouteIds: [fallbackRouteId],
    });
    const primaryReadiness = readiness({
      workspaceId,
      target: primaryReadinessBase,
      checkedAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    primaryRoute = {
      ...primaryReadinessBase,
      readinessReceiptHash: primaryReadiness.contentHash,
    };
    const fallbackReadinessBase = route(
      fallbackRouteId,
      HASH_B,
      {
        maxInputTokens: 4_000,
        maxOutputTokens: 1_000,
        maxCostUsdMicros: 50_000,
        maxLatencyMs: 10_000,
        maxConcurrency: 1,
      },
    );
    const fallbackReadiness = readiness({
      workspaceId,
      target: fallbackReadinessBase,
      checkedAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    fallbackRoute = {
      ...fallbackReadinessBase,
      readinessReceiptHash: fallbackReadiness.contentHash,
    };
    await recordProviderAdapterReadinessReceipt({
      authority: GOVERNED_MODEL_READINESS_AUTHORITY,
      workspaceId,
      actorUserId: ownerUserId,
      idempotencyKey: `readiness:${suffix}:primary`,
      receipt: primaryReadiness,
    });
    await recordProviderAdapterReadinessReceipt({
      authority: GOVERNED_MODEL_READINESS_AUTHORITY,
      workspaceId,
      actorUserId: ownerUserId,
      idempotencyKey: `readiness:${suffix}:fallback`,
      receipt: fallbackReadiness,
    });
    const candidate: TenantModelRoutePolicy = {
      schemaVersion: "helm.tenant-model-route-policy/v1",
      policyId: `policy:model-egress-${suffix}`,
      workspaceRef: `workspace:${workspaceId}`,
      policyKey: "caio-pro-default",
      revision: 1,
      routes: [primaryRoute, fallbackRoute],
      primaryRoutes: [
        {
          taskClass: "summary_briefing",
          routeRef: primaryRoute.routeId,
        },
      ],
      validFrom: new Date(now.getTime() - 60_000).toISOString(),
      validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
      approvalRef:
        computeModelRoutePolicyApprovalReceiptRef({
          workspaceRef: `workspace:${workspaceId}`,
          policyId: `policy:model-egress-${suffix}`,
          policyKey: "caio-pro-default",
          revision: 1,
          approvedByRef: `user:${ownerUserId}`,
        }),
      approvedByRef: `user:${ownerUserId}`,
      createdAt: now.toISOString(),
      policyHash: HASH_A,
      status: "draft",
      authorityEffect: "model_egress_only",
    };
    const policy = {
      ...candidate,
      policyHash: computeTenantModelRoutePolicyHash(candidate),
    };
    policyId = policy.policyId;
    await createTenantModelRoutePolicyDraft({
      workspaceId,
      actorUserId: ownerUserId,
      policy,
    });
    const activated = await activateTenantModelRoutePolicy({
      workspaceId,
      actorUserId: ownerUserId,
      policyId,
      expectedHeadVersion: null,
      now,
    });
    activeHeadVersion = activated.head.version;
  });

  afterAll(async () => {
    // This suite targets a disposable, prefix-guarded database. Immutable
    // egress evidence is intentionally not deleted during teardown.
    await db.$disconnect();
  });

  async function prepareAllowed(
    requestSuffix: string,
    options: { allowFallback?: boolean } = {},
  ) {
    const evidenceRef = `evidence:model-egress-${requestSuffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:model-egress-${requestSuffix}`,
    );
    return prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:model-egress-${requestSuffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:model-egress-${requestSuffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: options.allowFallback ?? false,
    });
  }

  function runtimeDescriptor(now: Date) {
    return {
      provider: primaryRoute.provider,
      modelId: primaryRoute.modelId,
      modelVersion: primaryRoute.modelVersion,
      adapterKey: primaryRoute.adapterKey,
      adapterVersion: "synthetic-adapter-v1",
      adapterRegistrationRef:
        "adapter-registration:synthetic-adapter",
      adapterRegistrationHash: HASH_B,
      deploymentForm: primaryRoute.deploymentForm,
      jurisdiction: primaryRoute.jurisdiction,
      region: primaryRoute.region,
      endpointFingerprint: HASH_C,
      credentialRef: primaryRoute.credentialRef,
      adapterRegistered: true,
      credentialConfigured: true,
      observedAt: now.toISOString(),
    };
  }

  async function createAuthorizedSourceAsset(input: {
    label: string;
    now: Date;
    validUntil: Date;
  }) {
    const entry = await createDataAssetCatalogEntry({
      workspaceId,
      assetKey: `synthetic-${input.label}-${suffix}`,
      sourceSystemRef: `system:synthetic-${input.label}`,
      displayName: `Synthetic ${input.label}`,
      sourceKind: "crm",
      businessDomain: "sales",
      businessOwnerRef: ownerUserId,
      purpose: "Exercise source authority binding",
      scopeRefs: [`scope:synthetic-${input.label}`],
      recommendedAccessMode: "read_only_api",
      retentionDays: 30,
      freshnessSlaMinutes: 60,
      residencyRequirements: ["region:cn-test-1"],
      blindSpots: [],
      blockerCodes: [],
      riskOwnerRef: ownerUserId,
      nextReviewAt: new Date(input.now.getTime() + 86_400_000),
      evidenceRefs: [`evidence:${input.label}:inventory`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: input.now,
    });
    await db.dataAssetCatalogEntry.update({
      where: { id: entry.id },
      data: { inventoryStatus: "CONFIRMED" },
    });
    await recordDataAssetClassificationReceipt({
      workspaceId,
      assetId: entry.id,
      receiptId: `classification-${input.label}-${suffix}`,
      idempotencyKey: `classification:${input.label}:${suffix}`,
      expectedVersion: 1,
      dataShape: "structured",
      sensitivity: "confidential",
      processingDisposition: "remote_projected",
      technicalFeasibility: "feasible",
      evidenceRefs: [`evidence:${input.label}:classification`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: input.now,
    });
    await recordDataAssetAuthorizationReceipt({
      workspaceId,
      assetId: entry.id,
      receiptId: `authorization-${input.label}-${suffix}`,
      idempotencyKey: `authorization:${input.label}:${suffix}`,
      expectedVersion: 2,
      authorizationStatus: "authorized",
      authorizationRef: `authorization:synthetic-${input.label}`,
      scopeRefs: [`scope:synthetic-${input.label}`],
      consentRefs: [],
      validFrom: new Date(input.now.getTime() - 60_000),
      validUntil: input.validUntil,
      reasonCodes: [],
      evidenceRefs: [`evidence:${input.label}:authorization`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: input.now,
    });
    return entry.id;
  }

  it("creates one decision and one UNKNOWN receipt under concurrent replay", async () => {
    const [first, second] = await Promise.all([
      prepareAllowed(`concurrent-${suffix}`),
      prepareAllowed(`concurrent-${suffix}`),
    ]);
    expect(first.decision.contentHash).toBe(second.decision.contentHash);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(first.decision.decision).toBe("allowed");
    expect(first.startedReceipt?.outcome).toBe("unknown");
    expect(
      await db.modelRouteDecision.count({
        where: {
          workspaceId,
          requestKey: `request:model-egress-concurrent-${suffix}`,
        },
      }),
    ).toBe(1);
    expect(
      await db.modelEgressReceipt.count({
        where: { decisionId: first.decision.decisionId },
      }),
    ).toBe(1);
  });

  it("blocks a request that is not bound to a registered source asset", async () => {
    const evidenceRef = `evidence:model-egress-no-source-${suffix}`;
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:model-egress-no-source-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:model-egress-no-source-${suffix}`,
      sourceAssetRefs: [],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef: null,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
    });

    expect(prepared.decision.decision).toBe("blocked");
    expect(prepared.decision.reasonCodes).toContain(
      "source_asset_ref_required",
    );
    expect(prepared.startedReceipt).toBeNull();
  });

  it("blocks a request whose payload hash differs from the persisted projection receipt", async () => {
    const evidenceRef = `evidence:model-egress-payload-mismatch-${suffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:model-egress-payload-mismatch-${suffix}`,
    );
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:model-egress-payload-mismatch-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:model-egress-payload-mismatch-${suffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_A,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
    });

    expect(prepared.decision.decision).toBe("blocked");
    expect(prepared.decision.reasonCodes).toContain(
      "projection_payload_hash_mismatch",
    );
    expect(prepared.startedReceipt).toBeNull();
  });

  it("persists the projection hash and governance metadata without raw projected content", async () => {
    const rawMarker = `raw-projection-must-not-persist-${suffix}`;
    const serialized = canonicalJson({
      ownerBriefing: rawMarker,
    });
    const projectedPayloadHash = sha256(serialized);
    const receiptId = await projection(
      `evidence:model-egress-no-raw-${suffix}`,
      `projection:model-egress-no-raw-${suffix}`,
      undefined,
      assetId,
      new Date(),
      projectedPayloadHash,
      Buffer.byteLength(serialized, "utf8"),
    );
    const stored =
      await db.governedModelProjectionReceipt.findUniqueOrThrow({
        where: { id: receiptId },
        select: {
          projectedPayloadHash: true,
          receiptJson: true,
          sourceAssetBindingsJson: true,
        },
      });

    expect(stored.projectedPayloadHash).toBe(
      projectedPayloadHash,
    );
    expect(JSON.stringify(stored)).not.toContain(rawMarker);
    expect(stored.receiptJson).not.toContain(
      "ownerBriefing",
    );
  });

  it("bounds decision validity by the earliest source authorization expiry", async () => {
    const now = new Date();
    const authorizationExpiry = new Date(now.getTime() + 120_000);
    const sourceAssetId = await createAuthorizedSourceAsset({
      label: "short-authorization",
      now,
      validUntil: authorizationExpiry,
    });
    const evidenceRef = `evidence:short-authorization-${suffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:short-authorization-${suffix}`,
      undefined,
      sourceAssetId,
      now,
    );
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:short-authorization-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:short-authorization-${suffix}`,
      sourceAssetRefs: [sourceAssetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
      decisionTtlMs: 300_000,
      now,
    });

    expect(prepared.decision.decision).toBe("allowed");
    expect(prepared.decision.validUntil).toBe(
      authorizationExpiry.toISOString(),
    );
  });

  it("fails closed when source authorization is revoked after decision preparation", async () => {
    const now = new Date();
    const sourceAssetId = await createAuthorizedSourceAsset({
      label: "revoked-after-prepare",
      now,
      validUntil: new Date(now.getTime() + 86_400_000),
    });
    const evidenceRef = `evidence:revoked-after-prepare-${suffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:revoked-after-prepare-${suffix}`,
      undefined,
      sourceAssetId,
      now,
    );
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:revoked-after-prepare-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:revoked-after-prepare-${suffix}`,
      sourceAssetRefs: [sourceAssetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
      now,
    });
    await recordDataAssetAuthorizationReceipt({
      workspaceId,
      assetId: sourceAssetId,
      receiptId: `authorization-revoked-${suffix}`,
      idempotencyKey: `authorization:revoked:${suffix}`,
      expectedVersion: 3,
      authorizationStatus: "revoked",
      authorizationRef: null,
      scopeRefs: [],
      consentRefs: [],
      validFrom: null,
      validUntil: null,
      reasonCodes: ["owner_revoked"],
      evidenceRefs: [`evidence:revoked-after-prepare:${suffix}`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: new Date(now.getTime() + 1_000),
    });

    await expect(
      claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-revoked-source",
        runtime: runtimeDescriptor(new Date(now.getTime() + 2_000)),
        now: new Date(now.getTime() + 2_000),
      }),
    ).rejects.toThrow("source_asset_authority_changed");
  });

  it("fails closed when source classification changes after decision preparation", async () => {
    const now = new Date();
    const sourceAssetId = await createAuthorizedSourceAsset({
      label: "reclassified-after-prepare",
      now,
      validUntil: new Date(now.getTime() + 86_400_000),
    });
    const evidenceRef = `evidence:reclassified-after-prepare-${suffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:reclassified-after-prepare-${suffix}`,
      undefined,
      sourceAssetId,
      now,
    );
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:reclassified-after-prepare-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:reclassified-after-prepare-${suffix}`,
      sourceAssetRefs: [sourceAssetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
      now,
    });
    await recordDataAssetAuthorizationReceipt({
      workspaceId,
      assetId: sourceAssetId,
      receiptId: `authorization-reclass-revoked-${suffix}`,
      idempotencyKey: `authorization:reclass-revoked:${suffix}`,
      expectedVersion: 3,
      authorizationStatus: "revoked",
      authorizationRef: null,
      scopeRefs: [],
      consentRefs: [],
      validFrom: null,
      validUntil: null,
      reasonCodes: ["classification_change"],
      evidenceRefs: [`evidence:reclass-revoked:${suffix}`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: new Date(now.getTime() + 1_000),
    });
    await recordDataAssetClassificationReceipt({
      workspaceId,
      assetId: sourceAssetId,
      receiptId: `classification-updated-${suffix}`,
      idempotencyKey: `classification:updated:${suffix}`,
      expectedVersion: 4,
      dataShape: "structured",
      sensitivity: "internal",
      processingDisposition: "remote_projected",
      technicalFeasibility: "feasible",
      evidenceRefs: [`evidence:classification-updated:${suffix}`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: new Date(now.getTime() + 2_000),
    });
    await recordDataAssetAuthorizationReceipt({
      workspaceId,
      assetId: sourceAssetId,
      receiptId: `authorization-reclass-approved-${suffix}`,
      idempotencyKey: `authorization:reclass-approved:${suffix}`,
      expectedVersion: 5,
      authorizationStatus: "authorized",
      authorizationRef: "authorization:synthetic-reclassified",
      scopeRefs: ["scope:synthetic-reclassified"],
      consentRefs: [],
      validFrom: new Date(now.getTime() - 60_000),
      validUntil: new Date(now.getTime() + 86_400_000),
      reasonCodes: [],
      evidenceRefs: [`evidence:reclass-approved:${suffix}`],
      actorName: "Model egress owner",
      actorUserId: ownerUserId,
      now: new Date(now.getTime() + 3_000),
    });

    await expect(
      claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-reclassified-source",
        runtime: runtimeDescriptor(new Date(now.getTime() + 4_000)),
        now: new Date(now.getTime() + 4_000),
      }),
    ).rejects.toThrow("source_asset_authority_changed");
  });

  it("allows one dispatch claim and replays only the identical gateway/runtime", async () => {
    const prepared = await prepareAllowed(`claim-${suffix}`);
    const now = new Date();
    const claims = await Promise.allSettled([
      claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-primary",
        runtime: runtimeDescriptor(now),
        now,
      }),
      claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-secondary",
        runtime: runtimeDescriptor(now),
        now,
      }),
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(claims.filter((claim) => claim.status === "rejected")).toHaveLength(
      1,
    );
    const winner = claims.find(
      (claim): claim is PromiseFulfilledResult<
        Awaited<ReturnType<typeof claimModelRouteDispatch>>
      > => claim.status === "fulfilled",
    );
    expect(winner).toBeDefined();
    const stored = await readModelRouteDecision({
      workspaceId,
      decisionId: prepared.decision.decisionId,
    });
    expect(stored?.dispatch?.gatewayRef).toBeTruthy();
    expect(stored?.dispatch?.runtime).toEqual(runtimeDescriptor(now));
    expect(stored?.dispatch?.runtimeHash).toBe(winner!.value.runtimeHash);
    expect(stored?.dispatch?.providerIdempotencyKey).toBe(
      computeModelProviderIdempotencyKey({
        decisionRef: prepared.decision.decisionId,
        dispatchClaimHash: winner!.value.claimHash,
      }),
    );
    expect(
      Date.parse(stored!.dispatch!.leaseExpiresAt),
    ).toBeGreaterThan(Date.parse(stored!.dispatch!.claimedAt));
    const replay = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: stored!.dispatch!.gatewayRef!,
      runtime: runtimeDescriptor(now),
      now,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.claimHash).toBe(winner!.value.claimHash);
    const claimFinishedAt = new Date(now.getTime() + 1_000);
    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: stored!.dispatch!.gatewayRef!,
      dispatchClaimHash: winner!.value.claimHash,
      idempotencyKey: `terminal:claim-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt: claimFinishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "synthetic_failure",
      recordedAt: claimFinishedAt,
    });
  });

  it("enforces route concurrency until the prior dispatch has a terminal receipt", async () => {
    const first = await prepareAllowed(`concurrency-slot-a-${suffix}`);
    const second = await prepareAllowed(`concurrency-slot-b-${suffix}`);
    const now = new Date();
    const firstClaim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: first.decision.decisionId,
      gatewayRef: "gateway:caio-concurrency-a",
      runtime: runtimeDescriptor(now),
      now,
    });

    await expect(
      claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: second.decision.decisionId,
        gatewayRef: "gateway:caio-concurrency-b",
        runtime: runtimeDescriptor(now),
        now,
      }),
    ).rejects.toThrow("model_route_concurrency_limit_reached");

    const firstFinishedAt = new Date(now.getTime() + 1_000);
    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: first.decision.decisionId,
      gatewayRef: "gateway:caio-concurrency-a",
      dispatchClaimHash: firstClaim.claimHash,
      idempotencyKey: `terminal:concurrency-slot-a-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt: firstFinishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "synthetic_failure",
      recordedAt: firstFinishedAt,
    });

    const secondClaim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: second.decision.decisionId,
      gatewayRef: "gateway:caio-concurrency-b",
      runtime: runtimeDescriptor(new Date(now.getTime() + 2_000)),
      now: new Date(now.getTime() + 2_000),
    });
    expect(secondClaim.replayed).toBe(false);
    const secondFinishedAt = new Date(now.getTime() + 3_000);
    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: second.decision.decisionId,
      gatewayRef: "gateway:caio-concurrency-b",
      dispatchClaimHash: secondClaim.claimHash,
      idempotencyKey: `terminal:concurrency-slot-b-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt: secondFinishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "synthetic_failure",
      recordedAt: secondFinishedAt,
    });
  });

  it("admits only one of two different decisions that concurrently claim a single route slot", async () => {
    const prepared = [
      await prepareAllowed(`concurrent-route-a-${suffix}`),
      await prepareAllowed(`concurrent-route-b-${suffix}`),
    ] as const;
    const now = new Date();
    const contenders = prepared.map((entry, index) => ({
      decisionId: entry.decision.decisionId,
      gatewayRef: `gateway:caio-concurrent-route-${index}`,
    }));

    const claims = await Promise.allSettled(
      contenders.map((contender) =>
        claimModelRouteDispatch({
          authority: GOVERNED_GATEWAY_AUTHORITY,
          workspaceId,
          decisionId: contender.decisionId,
          gatewayRef: contender.gatewayRef,
          runtime: runtimeDescriptor(now),
          now,
        }),
      ),
    );

    expect(
      claims.filter((claim) => claim.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      claims.filter((claim) => claim.status === "rejected"),
    ).toHaveLength(1);
    const rejected = claims.find(
      (claim): claim is PromiseRejectedResult =>
        claim.status === "rejected",
    );
    expect(String(rejected?.reason)).toContain(
      "model_route_concurrency_limit_reached",
    );
    const winnerIndex = claims.findIndex(
      (claim) => claim.status === "fulfilled",
    );
    const winner = claims[
      winnerIndex
    ] as PromiseFulfilledResult<
      Awaited<ReturnType<typeof claimModelRouteDispatch>>
    >;
    const finishedAt = new Date(now.getTime() + 1_000);
    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: contenders[winnerIndex]!.decisionId,
      gatewayRef: contenders[winnerIndex]!.gatewayRef,
      dispatchClaimHash: winner.value.claimHash,
      idempotencyKey: `terminal:concurrent-route-winner-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "synthetic_failure",
      recordedAt: finishedAt,
    });
  });

  it("rejects terminal usage above route input or requested output budgets without closing the claim", async () => {
    const prepared = await prepareAllowed(`request-budget-${suffix}`);
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-request-budget",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);

    await expect(
      recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-request-budget",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:route-input-budget-overrun-${suffix}`,
        outcome: "success",
        resolutionSource: "invoke",
        requestDisposition: "accepted",
        providerRequestRefHash: HASH_B,
        finishedAt,
        latencyMs: 1_000,
        promptTokens:
          prepared.decision.routeSnapshot!.maxInputTokens + 1,
        completionTokens: 1,
        ...LOW_COST_EVIDENCE,
        costBand: "low",
        errorCode: null,
        recordedAt: finishedAt,
      }),
    ).rejects.toThrow("route_input_token_budget_exceeded");

    await expect(
      recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-request-budget",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:request-budget-overrun-${suffix}`,
        outcome: "success",
        resolutionSource: "invoke",
        requestDisposition: "accepted",
        providerRequestRefHash: HASH_B,
        finishedAt,
        latencyMs: 1_000,
        promptTokens: 100,
        completionTokens: REQUESTED_MAX_OUTPUT_TOKENS + 1,
        ...LOW_COST_EVIDENCE,
        costBand: "low",
        errorCode: null,
        recordedAt: finishedAt,
      }),
    ).rejects.toThrow("requested_output_token_budget_exceeded");

    await expect(
      recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-request-budget",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:route-cost-budget-overrun-${suffix}`,
        outcome: "success",
        resolutionSource: "invoke",
        requestDisposition: "accepted",
        providerRequestRefHash: HASH_B,
        finishedAt,
        latencyMs: 1_000,
        promptTokens: 100,
        completionTokens: 1,
        actualCostUsdMicros:
          prepared.decision.routeSnapshot!.maxCostUsdMicros + 1,
        costCurrency: "USD",
        pricingVersion: PRICING_VERSION,
        costBand: "high",
        errorCode: null,
        recordedAt: finishedAt,
      }),
    ).rejects.toThrow("route_cost_budget_exceeded");

    await expect(
      recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-request-budget",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:pricing-version-mismatch-${suffix}`,
        outcome: "success",
        resolutionSource: "invoke",
        requestDisposition: "accepted",
        providerRequestRefHash: HASH_B,
        finishedAt,
        latencyMs: 1_000,
        promptTokens: 100,
        completionTokens: 1,
        actualCostUsdMicros: 12_500,
        costCurrency: "USD",
        pricingVersion: "synthetic-pricing-202608",
        costBand: "low",
        errorCode: null,
        recordedAt: finishedAt,
      }),
    ).rejects.toThrow("pricing_version_not_owner_approved");

    await expect(
      recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-request-budget",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:not-accepted-cost-${suffix}`,
        outcome: "failure",
        resolutionSource: "invoke",
        requestDisposition: "not_accepted",
        providerRequestRefHash: null,
        finishedAt,
        latencyMs: 1_000,
        promptTokens: null,
        completionTokens: null,
        actualCostUsdMicros: 1,
        costCurrency: "USD",
        pricingVersion: PRICING_VERSION,
        costBand: "low",
        errorCode: "provider_unavailable",
        recordedAt: finishedAt,
      }),
    ).rejects.toThrow("not_accepted_receipt_cost_must_be_zero");

    const afterRejection = await readModelRouteDecision({
      workspaceId,
      decisionId: prepared.decision.decisionId,
    });
    expect(afterRejection?.receipts).toHaveLength(1);

    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-request-budget",
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: `terminal:request-budget-cleanup-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "accepted",
      providerRequestRefHash: HASH_B,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: 100,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "output_budget_exceeded",
      recordedAt: finishedAt,
    });
  });

  it("rejects ambiguous acceptance, missing request identity, and out-of-range terminal evidence", async () => {
    const prepared = await prepareAllowed(
      `terminal-shape-guards-${suffix}`,
    );
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-terminal-shape-guards",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);
    const base = {
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-terminal-shape-guards",
      dispatchClaimHash: claim.claimHash,
      outcome: "failure" as const,
      resolutionSource: "invoke" as const,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      costCurrency: "USD" as const,
      pricingVersion: PRICING_VERSION,
      costBand: "zero" as const,
      errorCode: "provider_failure",
      recordedAt: finishedAt,
    };

    await expect(
      recordModelEgressTerminalReceipt({
        ...base,
        idempotencyKey: `terminal:ambiguous-disposition-${suffix}`,
        requestDisposition:
          "unknown" as unknown as "accepted",
        providerRequestRefHash: null,
        actualCostUsdMicros: 0,
      }),
    ).rejects.toThrow(
      "terminal_receipt_request_disposition_must_be_known",
    );
    await expect(
      recordModelEgressTerminalReceipt({
        ...base,
        idempotencyKey: `terminal:accepted-without-ref-${suffix}`,
        requestDisposition: "accepted",
        providerRequestRefHash: null,
        actualCostUsdMicros: 0,
      }),
    ).rejects.toThrow(
      "accepted_receipt_provider_request_ref_required",
    );
    await expect(
      recordModelEgressTerminalReceipt({
        ...base,
        idempotencyKey: `terminal:integer-overflow-${suffix}`,
        requestDisposition: "accepted",
        providerRequestRefHash: HASH_B,
        actualCostUsdMicros: 2_147_483_648,
      }),
    ).rejects.toThrow("actual_cost_usd_micros_invalid");

    expect(
      (
        await readModelRouteDecision({
          workspaceId,
          decisionId: prepared.decision.decisionId,
        })
      )?.receipts,
    ).toHaveLength(1);

    await recordModelEgressTerminalReceipt({
      ...base,
      idempotencyKey: `terminal:shape-guard-cleanup-${suffix}`,
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      actualCostUsdMicros: 0,
    });
  });

  it("permits reconciliation only after the dispatch lease expires and keeps the original claim binding", async () => {
    const prepared = await prepareAllowed(`reconcile-lease-${suffix}`);
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-reconcile-lease",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const beforeLeaseExpiry = new Date(claimedAt.getTime() + 1_000);

    await expect(
      recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-reconcile-lease",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:reconcile-too-early-${suffix}`,
        outcome: "failure",
        resolutionSource: "reconcile",
        requestDisposition: "not_accepted",
        providerRequestRefHash: null,
        finishedAt: beforeLeaseExpiry,
        latencyMs: 1_000,
        promptTokens: null,
        completionTokens: null,
        ...ZERO_COST_EVIDENCE,
        costBand: "zero",
        errorCode: "provider_reconciliation_pending",
        recordedAt: beforeLeaseExpiry,
      }),
    ).rejects.toThrow("dispatch_reconciliation_before_lease_expiry");

    const reconciledAt = new Date(
      Date.parse(claim.leaseExpiresAt) + 1,
    );
    const terminal = await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-reconcile-lease",
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: `terminal:reconcile-after-lease-${suffix}`,
      outcome: "failure",
      resolutionSource: "reconcile",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt: reconciledAt,
      latencyMs: null,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "provider_request_not_found",
      recordedAt: reconciledAt,
    });
    expect(terminal.receipt.dispatchClaimHash).toBe(claim.claimHash);
    expect(terminal.receipt.resolutionSource).toBe("reconcile");

    const stored = await readModelRouteDecision({
      workspaceId,
      decisionId: prepared.decision.decisionId,
    });
    expect(stored?.dispatch?.providerIdempotencyKey).toBe(
      claim.providerIdempotencyKey,
    );
    expect(stored?.receipts[1]?.resolutionSource).toBe("reconcile");
  });

  it("binds a failure receipt to the claim before allowing declared fallback", async () => {
    const prepared = await prepareAllowed(
      `fallback-parent-${suffix}`,
      { allowFallback: true },
    );
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);
    const terminal = await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: `terminal:fallback-parent-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "provider_unavailable",
      fallbackTargetRouteRef: fallbackRoute.routeId,
      fallbackReason: "provider_unavailable",
      recordedAt: finishedAt,
    });
    expect(terminal.receipt.dispatchClaimHash).toBe(claim.claimHash);

    const evidenceRef = `evidence:fallback-${suffix}`;
    const fallbackProjectionRef = await projection(
      evidenceRef,
      `projection:fallback-${suffix}`,
    );
    const fallback = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:fallback-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:fallback-${suffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef: fallbackProjectionRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
      parentDecisionRef: prepared.decision.decisionId,
      requestedFallbackRouteRef: fallbackRoute.routeId,
      fallbackReason: "provider_unavailable",
    });
    expect(fallback.decision.decision).toBe("allowed");
    expect(fallback.decision.routeRef).toBe(fallbackRoute.routeId);
    expect(fallback.decision.attemptOrdinal).toBe(1);

    const secondHopProjectionRef = await projection(
      evidenceRef,
      `projection:fallback-second-hop-${suffix}`,
    );
    const secondHop = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:fallback-second-hop-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:fallback-second-hop-${suffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef: secondHopProjectionRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
      parentDecisionRef: fallback.decision.decisionId,
      requestedFallbackRouteRef: primaryRoute.routeId,
      fallbackReason: "provider_unavailable",
    });
    expect(secondHop.decision.decision).toBe("blocked");
    expect(secondHop.decision.reasonCodes).toContain(
      "fallback_attempt_limit_exceeded",
    );
  });

  it("binds fallback requests to the target and reason recorded by the parent receipt", async () => {
    const prepared = await prepareAllowed(
      `fallback-mismatch-parent-${suffix}`,
      { allowFallback: true },
    );
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);
    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: `terminal:fallback-mismatch-parent-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "provider_unavailable",
      fallbackTargetRouteRef: fallbackRoute.routeId,
      fallbackReason: "provider_unavailable",
      recordedAt: finishedAt,
    });

    const evidenceRef = `evidence:fallback-mismatch-${suffix}`;
    const mismatchProjectionRef = await projection(
      evidenceRef,
      `projection:fallback-reason-mismatch-${suffix}`,
    );
    const mismatchedReason = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:fallback-reason-mismatch-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:fallback-reason-mismatch-${suffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef: mismatchProjectionRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
      parentDecisionRef: prepared.decision.decisionId,
      requestedFallbackRouteRef: fallbackRoute.routeId,
      fallbackReason: "provider_busy",
    });
    expect(mismatchedReason.decision.decision).toBe("blocked");
    expect(mismatchedReason.decision.reasonCodes).toContain(
      "fallback_parent_terminal_reason_mismatch",
    );
  });

  it("replays concurrent identical terminal writers as one append-only result", async () => {
    const prepared = await prepareAllowed(`terminal-replay-${suffix}`);
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const finishedAt = new Date();
    const input = {
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: `terminal:replay-${suffix}`,
      outcome: "success" as const,
      resolutionSource: "invoke" as const,
      requestDisposition: "accepted" as const,
      providerRequestRefHash: HASH_B,
      finishedAt,
      latencyMs: 500,
      promptTokens: 100,
      completionTokens: 20,
      ...LOW_COST_EVIDENCE,
      costBand: "low" as const,
      errorCode: null,
    };
    const writes = await Promise.allSettled([
      recordModelEgressTerminalReceipt(input),
      recordModelEgressTerminalReceipt(input),
    ]);
    expect(
      writes.filter((write) => write.status === "fulfilled"),
    ).toHaveLength(2);
    const results = writes.map(
      (write) =>
        (
          write as PromiseFulfilledResult<
            Awaited<
              ReturnType<typeof recordModelEgressTerminalReceipt>
            >
          >
        ).value,
    );
    expect(results.map((result) => result.replayed).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0]!.receipt.contentHash).toBe(
      results[1]!.receipt.contentHash,
    );
    expect(
      (
        await readModelRouteDecision({
          workspaceId,
          decisionId: prepared.decision.decisionId,
        })
      )?.receipts,
    ).toHaveLength(2);
  });

  it("allows only one of two conflicting concurrent terminal writers", async () => {
    const prepared = await prepareAllowed(
      `terminal-conflict-${suffix}`,
    );
    const claimedAt = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-terminal-conflict",
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);
    const base = {
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-terminal-conflict",
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: `terminal:conflict-${suffix}`,
      outcome: "failure" as const,
      resolutionSource: "invoke" as const,
      requestDisposition: "accepted" as const,
      providerRequestRefHash: HASH_B,
      finishedAt,
      latencyMs: 500,
      promptTokens: 100,
      completionTokens: 0,
      ...LOW_COST_EVIDENCE,
      costBand: "low" as const,
      recordedAt: finishedAt,
    };

    const writes = await Promise.allSettled([
      recordModelEgressTerminalReceipt({
        ...base,
        errorCode: "provider_failure_a",
      }),
      recordModelEgressTerminalReceipt({
        ...base,
        errorCode: "provider_failure_b",
      }),
    ]);

    expect(
      writes.filter((write) => write.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      writes.filter((write) => write.status === "rejected"),
    ).toHaveLength(1);
    const rejected = writes.find(
      (write): write is PromiseRejectedResult =>
        write.status === "rejected",
    );
    expect(String(rejected?.reason)).toContain(
      "terminal_receipt_idempotency_conflict",
    );
    const stored = await readModelRouteDecision({
      workspaceId,
      decisionId: prepared.decision.decisionId,
    });
    expect(stored?.receipts).toHaveLength(2);
    expect(
      ["provider_failure_a", "provider_failure_b"],
    ).toContain(stored?.receipts[1]?.errorCode);
  });

  it("rejects valid-shape updates and deletes at the append-only database boundary", async () => {
    const prepared = await prepareAllowed(
      `append-only-${suffix}`,
    );
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:caio-primary",
      runtime: runtimeDescriptor(new Date()),
    });
    const terminal =
      await recordModelEgressTerminalReceipt({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-primary",
        dispatchClaimHash: claim.claimHash,
        idempotencyKey: `terminal:append-only-${suffix}`,
        outcome: "failure",
        resolutionSource: "invoke",
        requestDisposition: "accepted",
        providerRequestRefHash: HASH_B,
        finishedAt: new Date(),
        latencyMs: 500,
        promptTokens: 100,
        completionTokens: 0,
        ...LOW_COST_EVIDENCE,
        costBand: "low",
        errorCode: "provider_failure",
      });

    await expect(
      db.$executeRaw`
        UPDATE ModelEgressReceipt
        SET errorCode = 'provider_failure_changed'
        WHERE id = ${terminal.receipt.receiptId}
      `,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`
        DELETE FROM ModelEgressReceipt
        WHERE id = ${terminal.receipt.receiptId}
      `,
    ).rejects.toThrow();

    const persisted =
      await db.modelEgressReceipt.findUniqueOrThrow({
        where: { id: terminal.receipt.receiptId },
        select: { errorCode: true },
      });
    expect(persisted.errorCode).toBe("provider_failure");
  });

  it("rejects malformed direct writes at the database constraint boundary", async () => {
    const prepared = await prepareAllowed(`constraint-${suffix}`);
    const startedReceiptId = prepared.startedReceipt?.receiptId;
    expect(startedReceiptId).toBeTruthy();

    await expect(
      db.$executeRaw`
        UPDATE ModelEgressReceipt
        SET rawContentIncluded = true
        WHERE id = ${startedReceiptId!}
      `,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`
        UPDATE ModelRouteDecision
        SET dispatchGatewayRef = 'gateway:partial-claim'
        WHERE id = ${prepared.decision.decisionId}
      `,
    ).rejects.toThrow();

    const [receiptRow, decisionRow] = await Promise.all([
      db.modelEgressReceipt.findUniqueOrThrow({
        where: { id: startedReceiptId! },
        select: { rawContentIncluded: true },
      }),
      db.modelRouteDecision.findUniqueOrThrow({
        where: { id: prepared.decision.decisionId },
        select: {
          dispatchClaimedAt: true,
          dispatchGatewayRef: true,
          dispatchRuntimeJson: true,
          dispatchRuntimeHash: true,
          dispatchClaimHash: true,
          dispatchProviderIdempotencyKey: true,
          dispatchLeaseExpiresAt: true,
        },
      }),
    ]);
    expect(receiptRow.rawContentIncluded).toBe(false);
    expect(decisionRow).toEqual({
      dispatchClaimedAt: null,
      dispatchGatewayRef: null,
      dispatchRuntimeJson: null,
      dispatchRuntimeHash: null,
      dispatchClaimHash: null,
      dispatchProviderIdempotencyKey: null,
      dispatchLeaseExpiresAt: null,
    });
  });

  it("rejects ambiguous terminal acceptance and accepted receipts without provider identity at the database boundary", async () => {
    const prepared = await prepareAllowed(
      `terminal-db-constraints-${suffix}`,
    );
    const claimedAt = new Date();
    const gatewayRef = "gateway:caio-terminal-db-constraints";
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef,
      runtime: runtimeDescriptor(claimedAt),
      now: claimedAt,
    });
    const startedRow =
      await db.modelEgressReceipt.findUniqueOrThrow({
        where: {
          decisionId_sequence: {
            decisionId: prepared.decision.decisionId,
            sequence: 1,
          },
        },
      });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);
    const terminalCandidate = {
      ...startedRow,
      previousReceiptId: startedRow.id,
      previousReceiptHash: startedRow.contentHash,
      sequence: 2,
      phase: "TERMINAL",
      outcome: "FAILURE",
      resolutionSource: "INVOKE",
      dispatchGatewayRef: gatewayRef,
      dispatchRuntimeHash: claim.runtimeHash,
      dispatchClaimHash: claim.claimHash,
      providerRequestRefHash: null,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      actualCostUsdMicros: 0,
      costCurrency: "USD",
      pricingVersion: PRICING_VERSION,
      costBand: "ZERO",
      errorCode: "provider_acceptance_unknown",
      fallbackTargetRouteRef: null,
      fallbackReason: null,
      receiptJson: "{}",
      recordedAt: finishedAt,
      createdAt: finishedAt,
    };

    await expect(
      db.modelEgressReceipt.create({
        data: {
          ...terminalCandidate,
          id: `db-terminal-unknown-${suffix}`,
          idempotencyKey: `db-terminal-unknown-${suffix}`,
          requestDisposition: "UNKNOWN",
          auditRef: `audit:db-terminal-unknown-${suffix}`,
          contentHash: sha256(`db-terminal-unknown-${suffix}`),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.modelEgressReceipt.create({
        data: {
          ...terminalCandidate,
          id: `db-terminal-accepted-no-ref-${suffix}`,
          idempotencyKey:
            `db-terminal-accepted-no-ref-${suffix}`,
          requestDisposition: "ACCEPTED",
          auditRef:
            `audit:db-terminal-accepted-no-ref-${suffix}`,
          contentHash: sha256(
            `db-terminal-accepted-no-ref-${suffix}`,
          ),
        },
      }),
    ).rejects.toThrow();

    expect(
      await db.modelEgressReceipt.count({
        where: {
          decisionId: prepared.decision.decisionId,
        },
      }),
    ).toBe(1);

    await recordModelEgressTerminalReceipt({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      decisionId: prepared.decision.decisionId,
      gatewayRef,
      dispatchClaimHash: claim.claimHash,
      idempotencyKey:
        `terminal:db-constraint-cleanup-${suffix}`,
      outcome: "failure",
      resolutionSource: "invoke",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      finishedAt,
      latencyMs: 1_000,
      promptTokens: null,
      completionTokens: null,
      ...ZERO_COST_EVIDENCE,
      costBand: "zero",
      errorCode: "provider_not_accepted",
      recordedAt: finishedAt,
    });
  });

  it("blocks a projection whose declared token budget exceeds the selected route", async () => {
    const evidenceRef = `evidence:model-egress-budget-${suffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:model-egress-budget-${suffix}`,
      {
        maxInputTokens: primaryRoute.maxInputTokens + 1,
        maxOutputTokens: primaryRoute.maxOutputTokens,
      },
    );
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:model-egress-budget-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:model-egress-budget-${suffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
    });

    expect(prepared.decision.decision).toBe("blocked");
    expect(prepared.decision.reasonCodes).toContain(
      "projection_input_token_budget_exceeds_route",
    );
    expect(prepared.startedReceipt).toBeNull();
  });

  it("blocks a projection whose implementation identity was not owner-approved", async () => {
    const evidenceRef =
      `evidence:model-egress-projector-${suffix}`;
    const projectionReceiptRef = await projection(
      evidenceRef,
      `projection:model-egress-projector-${suffix}`,
      undefined,
      assetId,
      new Date(),
      HASH_C,
      128,
      {
        projectorRegistrationHash: HASH_C,
        scannerVersion: "v2",
      },
    );
    const prepared = await prepareModelRouteDecision({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId,
      policyKey: "caio-pro-default",
      requestKey: `request:model-egress-projector-${suffix}`,
      taskClass: "summary_briefing",
      taskRef: `briefing:model-egress-projector-${suffix}`,
      sourceAssetRefs: [assetId],
      candidateEvidenceRefs: [evidenceRef],
      selectedEvidenceRefs: [evidenceRef],
      droppedEvidenceRefs: [],
      projectionReceiptRef,
      projectedPayloadHash: HASH_C,
      promptInjectionScanStatus: "passed",
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
      allowFallback: false,
    });

    expect(prepared.decision.decision).toBe("blocked");
    expect(prepared.decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "projection_projector_registration_hash_mismatch",
        "projection_scanner_version_mismatch",
      ]),
    );
    expect(prepared.startedReceipt).toBeNull();
  });

  it("rejects policy writes from a member whose invitation is not active", async () => {
    const now = new Date();
    const invitedReadiness = readiness({
      workspaceId,
      target: primaryRoute,
      checkedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    await expect(
      recordProviderAdapterReadinessReceipt({
        authority: GOVERNED_MODEL_READINESS_AUTHORITY,
        workspaceId,
        actorUserId: invitedUserId,
        idempotencyKey: `readiness:${suffix}:invited`,
        receipt: invitedReadiness,
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_SERVICE_GOVERNANCE_REQUIRED",
    });
  });

  it("rejects a policy write when active membership is lost before the transaction recheck", async () => {
    const actor = await db.user.create({
      data: {
        name: "Model egress transaction recheck owner",
        email: `model-egress-recheck-${suffix}@example.test`,
      },
    });
    await db.membership.create({
      data: {
        workspaceId,
        userId: actor.id,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const now = new Date();
    const target = route(
      `synthetic-transaction-recheck-${suffix}`,
      HASH_A,
    );
    const receipt = readiness({
      workspaceId,
      target,
      checkedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const idempotencyKey =
      `readiness:${suffix}:transaction-recheck`;
    const holder = holdWorkspaceLock(workspaceId);
    await holder.acquired;
    const write = recordProviderAdapterReadinessReceipt({
      authority: GOVERNED_MODEL_READINESS_AUTHORITY,
      workspaceId,
      actorUserId: actor.id,
      idempotencyKey,
      receipt,
    });

    try {
      await waitForBlockedWorkspaceLock();
      await db.membership.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: actor.id,
          },
        },
        data: { status: MembershipStatus.INVITED },
      });
      holder.release();

      await expect(write).rejects.toThrow(
        "workspace_policy_access_lost",
      );
      await holder.done;
    } finally {
      holder.release();
      await Promise.allSettled([holder.done, write]);
    }

    const [readinessRows, auditRows] = await Promise.all([
      db.providerAdapterReadinessReceipt.count({
        where: {
          workspaceId,
          id: receipt.receiptId,
        },
      }),
      db.auditLog.count({
        where: {
          workspaceId,
          actionType: "MODEL_ADAPTER_READINESS_RECORDED",
          targetId: receipt.receiptId,
        },
      }),
    ]);
    expect(readinessRows).toBe(0);
    expect(auditRows).toBe(0);
  });

  it("projects persisted uppercase storage through the owner-only read model", async () => {
    const readout = await getWorkspaceModelEgressOwnerReadout({
      workspaceId,
      actorUserId: ownerUserId,
      now: new Date(),
    });

    expect(readout).not.toBeNull();
    expect(readout?.policies.active).toBe(1);
    expect(readout?.readiness.ready).toBe(2);
    expect(readout?.routing.allowed).toBeGreaterThan(0);
    expect(
      readout?.recentDecisions.some(
        (item) =>
          item.decision === "allowed" &&
          item.state !== "blocked",
      ),
    ).toBe(true);
  });

  it("does not expose the owner read model to an invited owner", async () => {
    const readout = await getWorkspaceModelEgressOwnerReadout({
      workspaceId,
      actorUserId: invitedUserId,
      now: new Date(),
    });

    expect(readout).toBeNull();
  });

  it("revocation wins before a not-yet-claimed dispatch", async () => {
    const prepared = await prepareAllowed(`revoke-${suffix}`);
    await revokeTenantModelRoutePolicy({
      workspaceId,
      actorUserId: ownerUserId,
      policyId,
      expectedHeadVersion: activeHeadVersion,
      reason: "Synthetic revocation before dispatch",
    });
    await expect(
      claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId,
        decisionId: prepared.decision.decisionId,
        gatewayRef: "gateway:caio-primary",
        runtime: runtimeDescriptor(new Date()),
      }),
    ).rejects.toThrow(/model_route_policy_head_changed/u);
  });
});
