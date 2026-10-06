import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { lstatSync, statSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createGovernedOrdinaryHttpAdapter } from "./governed-ordinary-http-adapter.service";
import { USAGE_SOURCE } from "./trusted-usage-evidence";
import { authorityHash, canonicalAuthorityJson } from "./trusted-spend-authority";
import { createRegisteredGovernedSpendAuthority, issuerGrantHash } from "./trusted-spend-authority-prisma";
import {
  MembershipStatus,
  ActorType,
  type Prisma,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getWorkspaceModelEgressOwnerReadout } from "@/features/dashboard/model-egress-query";
import { db } from "@/lib/db";
import { createGovernedModelGateway, createGovernedModelGatewayForChargeClient } from "@/lib/llm/governed-model-gateway.service";
import { bindOrdinaryPaidProjection, prepareOrdinaryPaidOperation } from "@/lib/llm/ordinary-paid-operation.service";
import { createOrdinaryPaidAdapterBridge, type OrdinaryPaidOutput, type OrdinaryPaidPayload } from "@/lib/llm/ordinary-paid-adapter-bridge.service";
import { installOrdinaryPaidServerBootstrap } from "@/lib/llm/ordinary-paid-server-bootstrap.service";
import { enhanceRecommendationExplanationWithLLM } from "@/lib/llm-workflows/enhance-recommendation-explanation.workflow";
import { reviewJudgementBoundaryWithLLM } from "@/lib/llm-workflows/review-judgement-boundary.workflow";
import { reviewCounterfactualWithLLM } from "@/lib/llm-workflows/review-counterfactual.workflow";
import { executeMultiPassReview } from "@/lib/llm-workflows/multi-pass-review.workflow";
import { prepareBiReportDryRun } from "@/lib/bi-report-skill/run-service";
import type { BiReportSkillPack, BiReportSubscriptionConfig } from "@/lib/bi-report-skill/types";
import { generateContactBriefingSnapshot } from "@/lib/memory/briefing.service";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { getProviderAdapter } from "@/lib/llm/provider-registry";
import { createGovernedModelAdapterRegistry } from "@/lib/llm/governed-model-adapter-registry.service";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  GOVERNED_GATEWAY_AUTHORITY,
  GOVERNED_MODEL_PROJECTION_AUTHORITY,
  claimModelRouteDispatch as actualClaimModelRouteDispatch,
  markModelEgressSpendUnknown,
  prepareModelRouteDecision,
  readModelRouteDecision,
  recordGovernedModelProjectionReceipt,
  recordModelEgressTerminalReceipt as actualRecordModelEgressTerminalReceipt,
  type GovernedSpendAuthority,
} from "@/lib/llm/model-egress-store.service";
import {
  computeModelRoutePolicyApprovalReceiptRef,
  computeGovernedModelAdapterRegistrationHash,
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
function assertTrustedUsageTestTargets(): void {
  if (!confirmedIntegrationDatabaseName?.startsWith("helm_caio_p1d_") || process.env.DATABASE_URL !== integrationDatabaseUrl) throw new Error("trusted_usage_mysql_target_refused");
  for (const name of ["DATABASE_URL", "ORDINARY_PAID_WRITER_DATABASE_URL", "MODEL_EGRESS_RUNTIME_DATABASE_URL", "LLM_USAGE_COLLECTOR_DATABASE_URL"]) {
    const value = process.env[name]; if (!value) throw new Error("trusted_usage_split_roles_required");
    let url: URL; try { url = new URL(value); } catch { throw new Error("trusted_usage_mysql_target_refused"); }
    const socket = url.searchParams.get("socket");
    if (url.protocol !== "mysql:" || decodeURIComponent(url.pathname.slice(1)) !== confirmedIntegrationDatabaseName ||
        !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("trusted_usage_mysql_target_refused");
    if (socket) {
      if (!isAbsolute(socket) || !lstatSync(socket).isSocket() || lstatSync(socket).uid !== process.getuid?.() ||
          statSync(dirname(socket)).uid !== process.getuid?.() || (statSync(dirname(socket)).mode & 0o077) !== 0) throw new Error("trusted_usage_socket_refused");
    } else if (process.env.GITHUB_ACTIONS !== "true" || process.env.HELM_CI_MYSQL_DATABASE !== "helm_caio_p1d_ci" ||
        confirmedIntegrationDatabaseName !== "helm_caio_p1d_ci" || url.hostname !== "127.0.0.1" || url.port !== "3306" ||
        !/^[a-f0-9]{12,64}$/u.test(process.env.HELM_CI_MYSQL_CONTAINER ?? "")) throw new Error("trusted_usage_ci_container_required");
  }
}
if (process.env.TRUSTED_USAGE_MYSQL_REQUIRED === "1") {
  if (!integrationDatabaseUrl) throw new Error("trusted_usage_isolated_mysql_required");
  assertTrustedUsageTestTargets(); // Before fixtures construct a client or run SQL.
}
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_p1d_";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
const SYNTHETIC_REGISTRATION = (() => {
  const candidate = {
    schemaVersion: "helm.governed-model-adapter-registration/v1" as const,
    registrationRef: "adapter-registration:synthetic-adapter",
    adapterKey: "synthetic-adapter", adapterVersion: "synthetic-adapter-v1",
    provider: "synthetic-provider", implementationHash: HASH_A,
    supportedDeploymentForms: ["domestic_cloud"] as const,
    authorityEffect: "adapter_registry_only" as const,
    contentHash: HASH_A,
  };
  return { ...candidate, contentHash: computeGovernedModelAdapterRegistrationHash(candidate) };
})();
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
const SPEND_PERIOD_VERSION = "synthetic-period-policy-v1";
const syntheticSpendAuthority: GovernedSpendAuthority = {
  async resolveDispatch({ decision }) {
    if (!decision.routeSnapshot) throw new Error("synthetic_route_missing");
    return {
      periodKey: "synthetic-period-2026-10", periodPolicyVersion: SPEND_PERIOD_VERSION,
      quote: {
        contractVersion: 2, operationRef: decision.decisionId,
        quoteRef: `quote:${decision.decisionId}`, quoteHash: HASH_A,
        maximumChargeMicros: BigInt(decision.routeSnapshot.maxCostUsdMicros),
        budgetCurrency: "USD", providerCurrency: "USD",
        priceBookRef: "synthetic-price-book", priceBookVersion: decision.routeSnapshot.pricingVersion,
        priceBookHash: HASH_B, fxSnapshotRef: null, fxSnapshotHash: null,
        policyApprovalRef: "synthetic-spend-approval",
      },
    };
  },
  async verifyTerminal({ actualCostUsdMicros }) { return BigInt(actualCostUsdMicros); },
};
const claimModelRouteDispatch = (input: Parameters<typeof actualClaimModelRouteDispatch>[0]) =>
  actualClaimModelRouteDispatch({ ...input, spendAuthority: syntheticSpendAuthority });
const recordModelEgressTerminalReceipt = (input: Parameters<typeof actualRecordModelEgressTerminalReceipt>[0]) =>
  actualRecordModelEgressTerminalReceipt({ ...input, spendAuthority: syntheticSpendAuthority });

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
    allowedTaskClasses: ["summary_briefing", "reasoning_counterfactual",
      "extraction_classification", "multi_pass_review"],
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
  endpointFingerprint?: string;
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
    adapterRegistrationHash: SYNTHETIC_REGISTRATION.contentHash,
    deploymentForm: input.target.deploymentForm,
    jurisdiction: input.target.jurisdiction,
    region: input.target.region,
    endpointFingerprint: input.endpointFingerprint ?? HASH_C,
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
  const ordinaryTestCharge = integrationDatabaseUrl
    ? new PrismaClient({ datasources: { db: { url: integrationDatabaseUrl } } }) : null;
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

  async function initializeFixture(fixtureSuffix = suffix, options: {
    primaryMaxOutputTokens?: number;
    primaryMaxConcurrency?: number;
    endpointFingerprint?: string;
  } = {}) {
    assertIsolatedDatabaseTarget();
    const now = new Date();
    const workspace = await db.workspace.create({
      data: {
        name: `Model egress integration ${fixtureSuffix}`,
        slug: `model-egress-integration-${fixtureSuffix}`,
        llmBudgetMode: "unlimited", llmMonthlyBudgetMicros: null,
        llmBudgetEnforcementMode: "enforce", llmBudgetPeriodPolicyVersion: SPEND_PERIOD_VERSION,
        llmBudgetConfigVersion: 1, llmBudgetApprovalRef: "synthetic-spend-approval",
        llmBudgetUpdatedBy: "synthetic-test", llmBudgetUpdatedAt: new Date(),
      },
    });
    workspaceId = workspace.id;
    const owner = await db.user.create({
      data: {
        name: "Model egress owner",
        email: `model-egress-owner-${fixtureSuffix}@example.test`,
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
        email: `model-egress-invited-${fixtureSuffix}@example.test`,
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
      assetKey: `synthetic-crm-${fixtureSuffix}`,
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
      receiptId: `classification-${fixtureSuffix}`,
      idempotencyKey: `classification:${fixtureSuffix}`,
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
      receiptId: `authorization-${fixtureSuffix}`,
      idempotencyKey: `authorization:${fixtureSuffix}`,
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

    const primaryRouteId = `synthetic-primary-${fixtureSuffix}`;
    const fallbackRouteId = `synthetic-fallback-${fixtureSuffix}`;
    const primaryReadinessBase = route(primaryRouteId, HASH_A, {
      fallbackRouteIds: [fallbackRouteId],
      ...(options.primaryMaxOutputTokens
        ? { maxOutputTokens: options.primaryMaxOutputTokens } : {}),
      ...(options.primaryMaxConcurrency ? { maxConcurrency: options.primaryMaxConcurrency } : {}),
    });
    const primaryReadiness = readiness({
      workspaceId,
      target: primaryReadinessBase,
      checkedAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 86_400_000),
      endpointFingerprint: options.endpointFingerprint,
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
      endpointFingerprint: options.endpointFingerprint,
    });
    fallbackRoute = {
      ...fallbackReadinessBase,
      readinessReceiptHash: fallbackReadiness.contentHash,
    };
    await recordProviderAdapterReadinessReceipt({
      authority: GOVERNED_MODEL_READINESS_AUTHORITY,
      workspaceId,
      actorUserId: ownerUserId,
      idempotencyKey: `readiness:${fixtureSuffix}:primary`,
      receipt: primaryReadiness,
    });
    await recordProviderAdapterReadinessReceipt({
      authority: GOVERNED_MODEL_READINESS_AUTHORITY,
      workspaceId,
      actorUserId: ownerUserId,
      idempotencyKey: `readiness:${fixtureSuffix}:fallback`,
      receipt: fallbackReadiness,
    });
    const candidate: TenantModelRoutePolicy = {
      schemaVersion: "helm.tenant-model-route-policy/v1",
      policyId: `policy:model-egress-${fixtureSuffix}`,
      workspaceRef: `workspace:${workspaceId}`,
      policyKey: "caio-pro-default",
      revision: 1,
      routes: [primaryRoute, fallbackRoute],
      primaryRoutes: [
        {
          taskClass: "summary_briefing",
          routeRef: primaryRoute.routeId,
        },
        { taskClass: "reasoning_counterfactual", routeRef: primaryRoute.routeId },
        { taskClass: "extraction_classification", routeRef: primaryRoute.routeId },
        { taskClass: "multi_pass_review", routeRef: primaryRoute.routeId },
      ],
      validFrom: new Date(now.getTime() - 60_000).toISOString(),
      validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
      approvalRef:
        computeModelRoutePolicyApprovalReceiptRef({
          workspaceRef: `workspace:${workspaceId}`,
          policyId: `policy:model-egress-${fixtureSuffix}`,
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
  }

  beforeAll(() => initializeFixture());

  afterAll(async () => {
    // This suite targets a disposable, prefix-guarded database. Immutable
    // egress evidence is intentionally not deleted during teardown.
    await db.$disconnect();
    await ordinaryTestCharge?.$disconnect();
  });

  async function prepareAllowed(
    requestSuffix: string,
    options: { allowFallback?: boolean; decisionTtlMs?: number } = {},
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
      decisionTtlMs: options.decisionTtlMs,
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
      adapterRegistrationHash: SYNTHETIC_REGISTRATION.contentHash,
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
      // Slot release is the behavior under test; runtime evidence is fresh DB-time evidence.
      runtime: runtimeDescriptor(new Date()),
      now: new Date(),
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

  it("uses the real gateway, one atomic claim/reservation and terminal/settlement for one provider invoke", async () => {
    const projectedPayload = { synthetic: `gateway-spend-${suffix}` };
    const serialized = canonicalJson(projectedPayload);
    const evidenceRef = `evidence:gateway-spend-${suffix}`;
    const projectionReceiptRef = await projection(evidenceRef,
      `projection:gateway-spend-${suffix}`, undefined, assetId, new Date(),
      sha256(serialized), Buffer.byteLength(serialized, "utf8"));
    const invoke = vi.fn(async () => ({
      outcome: "success" as const, output: { synthetic: "complete" },
      requestDisposition: "accepted" as const,
      providerRequestRef: "synthetic-provider-request", promptTokens: 10,
      completionTokens: 10, actualCostUsdMicros: 12_500,
      costCurrency: "USD" as const, pricingVersion: PRICING_VERSION,
      costBand: "low" as const, errorCode: null,
    }));
    const registry = createGovernedModelAdapterRegistry<typeof projectedPayload, { synthetic: string }>([{
        registration: SYNTHETIC_REGISTRATION,
        probeReadiness: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
          modelProbeStatus: "ready", capabilityRefs: [], evidenceRefs: [],
          checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        preflight: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
          observedAt: new Date().toISOString(), estimatedInputTokens: 10,
          estimatedMaxCostUsdMicros: 12_500 }),
        invoke,
      }]);
    const execute = createGovernedModelGateway({ registry,
      dependencies: { spendAuthority: syntheticSpendAuthority } });
    const request = {
      workspaceId, gatewayRef: "gateway:synthetic-spend", policyKey: "caio-pro-default",
      requestKey: `request:gateway-spend-${suffix}`, taskClass: "summary_briefing" as const,
      taskRef: `briefing:gateway-spend-${suffix}`, projectionReceiptRef, projectedPayload,
      requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS,
    };
    const competing = await Promise.allSettled([execute(request), execute(request)]);
    const winner = competing.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof execute>>> =>
      result.status === "fulfilled" && result.value.status === "success");
    expect(winner).toBeDefined();
    const first = winner!.value;
    expect(first.status).toBe("success");
    expect(first.output).toEqual({ synthetic: "complete" });
    const second = await execute(request);
    expect(second.output).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    const decisionRef = first.selectedDecisionRef;
    const decisionRow = await db.modelRouteDecision.findUniqueOrThrow({ where: { id: decisionRef } });
    const ledger = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
      workspaceId_attemptRef: { workspaceId, attemptRef: decisionRow.dispatchProviderIdempotencyKey! },
    } });
    expect(ledger.state).toBe("settled");
    expect(ledger.settledMicros).toBe(BigInt(12_500));
    expect(ledger.quoteHash).toBe(HASH_A);
    expect(ledger.budgetConfigVersion).toBe(1);
    const counter = await db.lLMSpendPeriodCounter.findUniqueOrThrow({ where: {
      workspaceId_periodKey: { workspaceId, periodKey: ledger.periodKey },
    } });
    expect(counter.reservedMicros).toBe(BigInt(0));
    expect(counter.settledMicros).toBeGreaterThanOrEqual(BigInt(12_500));
    expect(await db.modelEgressReceipt.count({ where: { decisionId: decisionRef, sequence: 2 } })).toBe(1);
  });

  it("rolls the reservation back when the dispatch claim write fails", async () => {
    const prepared = await prepareAllowed(`claim-spend-rollback-${suffix}`);
    const before = await db.lLMSpendLedgerEntry.count({ where: { workspaceId } });
    const faultAuthority: GovernedSpendAuthority = {
      ...syntheticSpendAuthority,
      resolveDispatch: async (input) => {
        const quote = await syntheticSpendAuthority.resolveDispatch(input);
        // This synthetic in-transaction write defeats the later claim CAS.
        // The reservation must be rolled back with it.
        await input.tx.modelRouteDecision.update({
          where: { id: input.decision.decisionId },
          data: { validUntil: input.now },
        });
        return quote;
      },
    };
    // This fixture exercises a lost CAS and rollback, not future runtime admission.
    const claimAt = new Date();
    await expect(actualClaimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY, spendAuthority: faultAuthority,
      workspaceId, decisionId: prepared.decision.decisionId,
      gatewayRef: "gateway:synthetic-rollback", runtime: runtimeDescriptor(claimAt), now: claimAt,
    })).rejects.toThrow("model_route_dispatch_claim_lost");
    expect(await db.lLMSpendLedgerEntry.count({ where: { workspaceId } })).toBe(before);
    const row = await db.modelRouteDecision.findUniqueOrThrow({
      where: { id: prepared.decision.decisionId },
    });
    expect(row.dispatchClaimedAt).toBeNull();
    expect(row.validUntil.getTime()).toBeGreaterThan(claimAt.getTime());
  });

  it("rolls the terminal receipt back when spend settlement fails", async () => {
    const prepared = await prepareAllowed(`terminal-spend-rollback-${suffix}`);
    const claimedAt = new Date();
    const periodKey = "c3-fault";
    const faultAuthority: GovernedSpendAuthority = {
      ...syntheticSpendAuthority,
      resolveDispatch: async (input) => ({
        ...await syntheticSpendAuthority.resolveDispatch(input), periodKey,
      }),
    };
    const claim = await actualClaimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY, spendAuthority: faultAuthority, workspaceId,
      decisionId: prepared.decision.decisionId, gatewayRef: "gateway:synthetic-terminal-rollback",
      runtime: runtimeDescriptor(claimedAt), now: claimedAt,
    });
    const finishedAt = new Date(claimedAt.getTime() + 1_000);
    const counterKey = { workspaceId_periodKey: { workspaceId, periodKey } };
    const counter = await db.lLMSpendPeriodCounter.findUniqueOrThrow({ where: counterKey });
    const terminalInput = {
      authority: GOVERNED_GATEWAY_AUTHORITY, spendAuthority: faultAuthority, workspaceId,
      decisionId: prepared.decision.decisionId, gatewayRef: "gateway:synthetic-terminal-rollback",
      dispatchClaimHash: claim.claimHash, idempotencyKey: `terminal:spend-rollback-${suffix}`,
      outcome: "success" as const, resolutionSource: "invoke" as const,
      requestDisposition: "accepted" as const,
      providerRequestRefHash: HASH_A, finishedAt, latencyMs: 1_000,
      promptTokens: 10, completionTokens: 10, ...LOW_COST_EVIDENCE,
      costBand: "low" as const, errorCode: null, recordedAt: finishedAt,
    };
    await db.lLMSpendPeriodCounter.update({ where: counterKey, data: { reservedMicros: BigInt(0) } });
    try {
      await expect(actualRecordModelEgressTerminalReceipt(terminalInput)).rejects.toThrow();
    } finally {
      await db.lLMSpendPeriodCounter.update({ where: counterKey,
        data: { reservedMicros: counter.reservedMicros } });
    }
    expect(await db.modelEgressReceipt.count({ where: {
      decisionId: prepared.decision.decisionId, sequence: 2,
    } })).toBe(0);
    const ledger = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
      workspaceId_attemptRef: { workspaceId, attemptRef: claim.providerIdempotencyKey },
    } });
    expect(ledger.state).toBe("reserved");
    expect((await actualRecordModelEgressTerminalReceipt(terminalInput)).spendOutcome).toBe("settled");
  });

  it("re-reads the workspace spend policy under the claim lock and refuses a disabled policy", async () => {
    const prepared = await prepareAllowed(`spend-policy-drift-${suffix}`);
    const before = await db.lLMSpendLedgerEntry.count({ where: { workspaceId } });
    await db.workspace.update({ where: { id: workspaceId }, data: {
      llmBudgetMode: "unconfigured", llmBudgetEnforcementMode: null,
    } });
    try {
      await expect(claimModelRouteDispatch({
        authority: GOVERNED_GATEWAY_AUTHORITY, workspaceId,
        decisionId: prepared.decision.decisionId, gatewayRef: "gateway:policy-drift",
        runtime: runtimeDescriptor(new Date()),
      })).rejects.toThrow("spend_budget_policy_not_enforceable");
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: {
        llmBudgetMode: "unlimited", llmBudgetEnforcementMode: "enforce",
      } });
    }
    expect(await db.lLMSpendLedgerEntry.count({ where: { workspaceId } })).toBe(before);
  });

  it("refuses a quote version outside the selected route before reserving", async () => {
    const prepared = await prepareAllowed(`spend-quote-drift-${suffix}`);
    const before = await db.lLMSpendLedgerEntry.count({ where: { workspaceId } });
    const drifted: GovernedSpendAuthority = {
      ...syntheticSpendAuthority,
      resolveDispatch: async (input) => {
        const resolved = await syntheticSpendAuthority.resolveDispatch(input);
        return { ...resolved, quote: { ...resolved.quote, priceBookVersion: "synthetic-other" } };
      },
    };
    await expect(actualClaimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY, spendAuthority: drifted, workspaceId,
      decisionId: prepared.decision.decisionId, gatewayRef: "gateway:quote-drift",
      runtime: runtimeDescriptor(new Date()),
    })).rejects.toThrow("spend_quote_route_or_policy_mismatch");
    expect(await db.lLMSpendLedgerEntry.count({ where: { workspaceId } })).toBe(before);
  });

  it("persists an unknown provider outcome as a bound without inventing terminal cost", async () => {
    const prepared = await prepareAllowed(`spend-unknown-${suffix}`);
    const now = new Date();
    const claim = await claimModelRouteDispatch({
      authority: GOVERNED_GATEWAY_AUTHORITY, workspaceId,
      decisionId: prepared.decision.decisionId, gatewayRef: "gateway:spend-unknown",
      runtime: runtimeDescriptor(now), now,
    });
    const unknownLedgerBefore = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
      workspaceId_attemptRef: { workspaceId, attemptRef: claim.providerIdempotencyKey },
    } });
    const unknownCounterKey = { workspaceId_periodKey: {
      workspaceId, periodKey: unknownLedgerBefore.periodKey,
    } };
    const unknownBoundBefore = (await db.lLMSpendPeriodCounter.findUniqueOrThrow({
      where: unknownCounterKey,
    })).unknownBoundMicros;
    expect(await markModelEgressSpendUnknown({
      authority: GOVERNED_GATEWAY_AUTHORITY, workspaceId,
      decisionId: prepared.decision.decisionId, gatewayRef: "gateway:spend-unknown",
      dispatchClaimHash: claim.claimHash,
    })).toBe("unknown");
    expect(await markModelEgressSpendUnknown({
      authority: GOVERNED_GATEWAY_AUTHORITY, workspaceId,
      decisionId: prepared.decision.decisionId, gatewayRef: "gateway:spend-unknown",
      dispatchClaimHash: claim.claimHash,
    })).toBe("unknown");
    const ledger = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
      workspaceId_attemptRef: { workspaceId, attemptRef: claim.providerIdempotencyKey },
    } });
    expect(ledger.state).toBe("unknown");
    expect((await db.lLMSpendPeriodCounter.findUniqueOrThrow({
      where: unknownCounterKey,
    })).unknownBoundMicros - unknownBoundBefore).toBe(ledger.maximumChargeMicros);
    expect(await db.modelEgressReceipt.count({ where: {
      decisionId: prepared.decision.decisionId, sequence: 2,
    } })).toBe(0);
  });

  function syntheticAuditText(sql:string) {
    const target=new URL(integrationDatabaseUrl!);const socket=target.searchParams.get("socket");
    const database=decodeURIComponent(target.pathname.slice(1));
    if(socket) {
      if(!isAbsolute(socket)||!lstatSync(socket).isSocket()||(statSync(dirname(socket)).mode&0o077)!==0||target.username!=="root"||target.password!=="") throw new Error("synthetic_audit_target_invalid");
      execFileSync("mysql",["--no-defaults","--protocol=SOCKET","--socket="+socket,"-u","root",database],{input:sql,stdio:["pipe","pipe","pipe"]});
    } else {
      const container=process.env.HELM_CI_MYSQL_CONTAINER??"";
      if(process.env.GITHUB_ACTIONS!=="true"||target.hostname!=="127.0.0.1"||target.port!=="3306"||database!=="helm_caio_p1d_ci"||process.env.HELM_CI_MYSQL_DATABASE!==database||target.username!==process.env.HELM_CI_MYSQL_USER||!/^[a-f0-9]{64}$/u.test(container)) throw new Error("synthetic_audit_ci_target_invalid");
      execFileSync("docker",["exec","-e","MYSQL_PWD","-i",container,"mysql","--no-defaults","--host=127.0.0.1","--protocol=TCP","--user="+target.username,database],{input:sql,env:{...process.env,MYSQL_PWD:decodeURIComponent(target.password)},stdio:["pipe","pipe","pipe"]});
    }
  }

  function runtimeDatabaseUrl() {
    const source=new URL(integrationDatabaseUrl!);
    const target=new URL(process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL ?? integrationDatabaseUrl!);
    if (!process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL) {target.username="c4_runtime";target.password="";}
    if (target.protocol!==source.protocol || target.hostname!==source.hostname || target.port!==source.port ||
        target.pathname!==source.pathname || target.search!==source.search || target.username===source.username) {
      throw new Error("synthetic_runtime_identity_target_invalid");
    }
    return target;
  }

  async function provisionC4(label: string, finiteLimit: bigint | null = null) {
    const now=new Date(), before=new Date(now.getTime()-60_000), until=new Date(now.getTime()+3_600_000);
    const scopedLabel = `${label}:${suffix}`;
    const keys=generateKeyPairSync("ed25519"), grantId=`issuer:${scopedLabel}`;
    const grant={id:grantId,workspaceId,issuerUserId:ownerUserId,publicKeyPem:keys.publicKey.export({type:"spki",format:"pem"}).toString(),allowedKindsJson:canonicalAuthorityJson(["budget","period","price"]),sourceReceiptHash:HASH_A,validFrom:before,validUntil:until,revokedAt:null,contentHash:""};
    grant.contentHash=issuerGrantHash(grant);
    await db.$executeRaw`INSERT INTO LLMSpendIssuerGrant(id,workspaceId,issuerUserId,publicKeyPem,allowedKindsJson,sourceReceiptHash,contentHash,validFrom,validUntil)
      VALUES (${grant.id},${workspaceId},${ownerUserId},${grant.publicKeyPem},${grant.allowedKindsJson},${grant.sourceReceiptHash},${grant.contentHash},${before},${until})`;
    const issue=async(kind:string,ref:string,version:string,payload:unknown)=>{
      const envelope={schema:"helm.spend-authority/v1",workspaceId,ref,kind,version,issuerGrantId:grantId,approverId:ownerUserId,status:"approved",sourceReceiptHash:HASH_B,issuedAt:before.toISOString(),validFrom:before.toISOString(),validUntil:until.toISOString(),payload};
      const json=canonicalAuthorityJson(envelope), hash=authorityHash(envelope), signature=sign(null,Buffer.from(json),keys.privateKey).toString("base64");
      await db.$executeRaw`INSERT INTO LLMSpendAuthorityRecord(id,workspaceId,ref,kind,version,issuerGrantId,envelopeJson,signatureBase64,contentHash)
        VALUES (${ref},${workspaceId},${ref},${kind},${version},${grantId},${json},${signature},${hash})`;
      return {ref,hash};
    };
    const period=await issue("period",`period:${scopedLabel}`,SPEND_PERIOD_VERSION,{algorithm:"calendar-month-v1",timezone:"Asia/Shanghai"});
    const price=await issue("price",`price:${scopedLabel}`,PRICING_VERSION,{billing:"input-output-only-v1",provider:primaryRoute.provider,model:primaryRoute.modelId,sku:"text-only",currency:"USD",input:{numerator:"0",denominator:"1",ceiling:String(primaryRoute.maxInputTokens)},output:{numerator:"1",denominator:"1",ceiling:String(primaryRoute.maxOutputTokens)}});
    await issue("budget",`approval:${scopedLabel}`,"v1",{configVersion:1,mode:finiteLimit === null ? "unlimited" : "limited",limitMicros:finiteLimit === null ? null : String(finiteLimit),currency:"USD",updatedBy:ownerUserId,updatedAt:now.toISOString(),periodRef:period.ref,periodHash:period.hash,priceRef:price.ref,priceHash:price.hash,fxRef:null,fxHash:null});
    await db.workspace.update({where:{id:workspaceId},data:{llmBudgetMode:finiteLimit === null ? "unlimited" : "limited",llmMonthlyBudgetMicros:finiteLimit,llmBudgetApprovalRef:`approval:${scopedLabel}`,llmBudgetCurrency:"USD",llmBudgetUpdatedBy:ownerUserId,llmBudgetUpdatedAt:now,llmBudgetPriceBookRef:price.ref,llmBudgetFxPolicyRef:null}});
    const registered=createRegisteredGovernedSpendAuthority({expectedPeriodPolicyVersion:SPEND_PERIOD_VERSION,trustedIssuerGrants:{[grantId]:grant.contentHash}});
    const authority: GovernedSpendAuthority={...registered,resolveDispatch:async(input)=>{
      // Assert the actual C3 transaction identity, not an unrelated negative
      // connection. Then consume the unchanged registered C4 implementation.
      const [identity]=await input.tx.$queryRaw<Array<{user:string}>>`SELECT CURRENT_USER() AS user`;
      expect(identity?.user.split("@")[0]===runtimeDatabaseUrl().username).toBe(true);
      return registered.resolveDispatch(input);
    }};
    return { authority, grantId, registryConfig: { expectedPeriodPolicyVersion: SPEND_PERIOD_VERSION, trustedIssuerGrants: { [grantId]: grant.contentHash } } };
  }

  it("registered C4 authority joins real C3 claim and retains unknown on unverified terminal", async () => {
    await initializeFixture(`c4-chain-${suffix}`);
    const { authority } = await provisionC4("c4-chain");
    const prepared=await prepareAllowed(`c4-chain-${suffix}`);
    const runtimeUrl=runtimeDatabaseUrl();
    const restricted=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}});
    // Redirect only transport to the real restricted Prisma transaction. The
    // actual claim/authority/C2/terminal business implementations remain intact.
    const transaction=vi.spyOn(db,"$transaction").mockImplementation(restricted.$transaction.bind(restricted));
    try {
      const claimed=await actualClaimModelRouteDispatch({authority:GOVERNED_GATEWAY_AUTHORITY,spendAuthority:authority,workspaceId,decisionId:prepared.decision.decisionId,gatewayRef:"gateway:c4-chain",runtime:runtimeDescriptor(new Date())});
      const ledger=await restricted.lLMSpendLedgerEntry.findFirstOrThrow({where:{workspaceId,operationRef:prepared.decision.decisionId}});
      expect(ledger.state).toBe("reserved");expect(ledger.maximumChargeMicros).toBe(BigInt(REQUESTED_MAX_OUTPUT_TOKENS));
      const finished=new Date();
      await expect(actualRecordModelEgressTerminalReceipt({authority:GOVERNED_GATEWAY_AUTHORITY,spendAuthority:authority,workspaceId,decisionId:prepared.decision.decisionId,gatewayRef:"gateway:c4-chain",dispatchClaimHash:claimed.claimHash,idempotencyKey:"terminal:c4-chain",outcome:"failure",resolutionSource:"invoke",requestDisposition:"not_accepted",providerRequestRefHash:null,finishedAt:finished,latencyMs:1,promptTokens:null,completionTokens:null,...ZERO_COST_EVIDENCE,costBand:"zero",errorCode:"synthetic-no-usage",recordedAt:finished})).rejects.toThrow("trusted_usage_evidence_unavailable");
      expect(await restricted.modelEgressReceipt.count({where:{decisionId:prepared.decision.decisionId,sequence:2}})).toBe(0);
      expect(await markModelEgressSpendUnknown({authority:GOVERNED_GATEWAY_AUTHORITY,workspaceId,decisionId:prepared.decision.decisionId,gatewayRef:"gateway:c4-chain",dispatchClaimHash:claimed.claimHash})).toBe("unknown");
      const original=await restricted.lLMSpendLedgerEntry.findUniqueOrThrow({where:{id:ledger.id}});
      expect(original.periodKey).toBe(ledger.periodKey);expect(original.state).toBe("unknown");
      const counter=await restricted.lLMSpendPeriodCounter.findUniqueOrThrow({where:{workspaceId_periodKey:{workspaceId,periodKey:ledger.periodKey}}});
      expect(counter.unknownBoundMicros).toBe(BigInt(REQUESTED_MAX_OUTPUT_TOKENS));
    } finally { transaction.mockRestore();await restricted.$disconnect(); }
  });

  it("withholds the actual ordinary bridge after registered C4 cannot attest terminal usage", async () => {
    const writerUrl = process.env.ORDINARY_PAID_WRITER_DATABASE_URL;
    const chargeUrl = process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL;
    if (!writerUrl || !chargeUrl) throw new Error("ordinary_paid_split_database_required");
    await initializeFixture(`c4-ordinary-unknown-${suffix}`);
    const { authority } = await provisionC4(`c4-ordinary-unknown-${suffix}`);
    const source = await db.recommendationLog.create({ data: {
      workspaceId, userId: ownerUserId, objectType: "COMPANY",
      objectId: `synthetic-object-${suffix}`, actionType: "CREATE_TASK",
      title: "Synthetic action", description: "Synthetic source",
      policyResult: "SUGGEST_ONLY", explanation: "Synthetic baseline",
    } });
    const writer = new PrismaClient({ datasources: { db: { url: writerUrl } } });
    const charge = new PrismaClient({ datasources: { db: { url: chargeUrl } } });
    const invoke = vi.fn(async () => ({
      outcome: "success" as const,
      output: { rawOutput: '{"synthetic":"charged"}',
        modelVersion: "synthetic-model-20260723", promptTokens: 10, completionTokens: 10 },
      requestDisposition: "accepted" as const,
      providerRequestRef: `synthetic-registered-${suffix}`, promptTokens: 10,
      completionTokens: 10, actualCostUsdMicros: 10,
      costCurrency: "USD" as const, pricingVersion: PRICING_VERSION,
      costBand: "low" as const, errorCode: null,
    }));
    try {
      const operation = await prepareOrdinaryPaidOperation({ client: writer,
        workspaceId, actorUserId: ownerUserId, kind: "recommendation_explanation",
        sourceType: "recommendation_log", sourceId: source.id, slot: "explanation" });
      const gateway = createGovernedModelGatewayForChargeClient<OrdinaryPaidPayload, OrdinaryPaidOutput>({
        client: charge, spendAuthority: authority, adapters: [{
          registration: SYNTHETIC_REGISTRATION,
          probeReadiness: async () => ({ endpointFingerprint: HASH_C,
            credentialConfigured: true, modelProbeStatus: "ready" as const,
            capabilityRefs: [], evidenceRefs: [], checkedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString() }),
          preflight: async () => ({ endpointFingerprint: HASH_C,
            credentialConfigured: true, observedAt: new Date().toISOString(),
            estimatedInputTokens: 10, estimatedMaxCostUsdMicros: 10 }), invoke,
        }],
      });
      const bridge = createOrdinaryPaidAdapterBridge({ policyKey: "caio-pro-default",
        operationWriterClient: writer, chargeClient: charge, gateway,
        issueProjection: ({ operationId, projectedPayload, projectedPayloadHash }) =>
          projection(`evidence:registered-${operationId}`,
            `projection:registered-${operationId}`, undefined, assetId, new Date(),
            projectedPayloadHash, Buffer.byteLength(canonicalJson(projectedPayload), "utf8")),
      });
      await expect(bridge({ taskType: "RECOMMENDATION_EXPLANATION",
        workspaceId, userId: ownerUserId, promptKey: "synthetic.recommendation",
        promptVersion: "v1", systemPrompt: "Synthetic", userPrompt: "Synthetic",
        outputMode: "json", parseOutput: (raw) => JSON.parse(raw) as { synthetic: string },
        fallbackOutput: { synthetic: "fallback" }, ordinaryOperationId: operation.id,
        effectiveMaxOutputTokens: 200 })).rejects.toThrow("paid_egress_in_doubt");
      expect(invoke).toHaveBeenCalledTimes(1);
      const decision = await charge.modelRouteDecision.findFirstOrThrow({ where: {
        workspaceId, requestKey: operation.requestKey,
      } });
      expect((await charge.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
        workspaceId_attemptRef: { workspaceId,
          attemptRef: decision.dispatchProviderIdempotencyKey! },
      } })).state).toBe("unknown");
      expect(await charge.modelEgressReceipt.count({ where: {
        decisionId: decision.id, sequence: 2,
      } })).toBe(0);
    } finally { await Promise.all([writer.$disconnect(), charge.$disconnect()]); }
  });

  it("registered C4 rejects decision expiry during an actual issuer lock wait", async () => {
    await initializeFixture(`c4-expiry-${suffix}`);
    const { authority, grantId } = await provisionC4("c4-expiry");
    const prepared = await prepareAllowed(`c4-expiry-${suffix}`, { decisionTtlMs: 400 });
    const lockClient = new PrismaClient({ datasources: { db: { url: integrationDatabaseUrl! } } });
    let release!: () => void;
    let acquired!: () => void;
    const acquiredSignal = new Promise<void>((resolve) => { acquired = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const blocker = lockClient.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM LLMSpendIssuerGrant WHERE id=${grantId} FOR UPDATE`;
      acquired(); await gate;
    }, { timeout: 10_000 });
    await acquiredSignal;
    const runtimeUrl = runtimeDatabaseUrl();
    const restricted = new PrismaClient({ datasources: { db: { url: runtimeUrl.toString() } } });
    const transaction = vi.spyOn(db, "$transaction").mockImplementation(restricted.$transaction.bind(restricted));
    let settled = false;
    const attempt = actualClaimModelRouteDispatch({ authority:GOVERNED_GATEWAY_AUTHORITY, spendAuthority:authority, workspaceId,
      decisionId:prepared.decision.decisionId, gatewayRef:"gateway:c4-expiry", runtime:runtimeDescriptor(new Date())
    }).then((result) => { settled=true;return result; }, (error: unknown) => { settled=true;throw error; });
    // Attach a handler before waiting, so an unexpected early rejection remains
    // the actual test result rather than an unhandled promise.
    const observed = attempt.then((result)=>({result,error:null}), (error: unknown)=>({result:null,error}));
    try {
      let lockObserved = false;
      for (let i=0;i<100;i++) {
        const rows = await lockClient.$queryRaw<{waits:bigint}[]>`SELECT COUNT(*) AS waits FROM performance_schema.data_lock_waits`;
        if (Number(rows[0]?.waits)>0) { lockObserved=true;break; }
        await new Promise((resolve)=>setTimeout(resolve,5));
      }
      expect(lockObserved).toBe(true); expect(settled).toBe(false);
      await new Promise((resolve)=>setTimeout(resolve,500));
      release(); await blocker;
      const outcome = await observed;
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toBe("model_route_decision_expired");
      expect(await restricted.lLMSpendLedgerEntry.count({where:{workspaceId}})).toBe(0);
      expect((await restricted.modelRouteDecision.findUniqueOrThrow({where:{id:prepared.decision.decisionId}})).dispatchClaimHash).toBeNull();
    } finally { release(); await blocker; await observed; transaction.mockRestore(); await restricted.$disconnect(); await lockClient.$disconnect(); }
  });

  it("registered C4 rolls claim reservation and audit back when expiry occurs during audit lock", async () => {
    await initializeFixture(`c4-audit-${suffix}`);
    const { authority }=await provisionC4("c4-audit");
    const prepared=await prepareAllowed(`c4-audit-${suffix}`,{decisionTtlMs:400});
    await db.$executeRawUnsafe("CREATE TABLE C4SyntheticAuditGate(id INT PRIMARY KEY, value INT NOT NULL)");
    await db.$executeRawUnsafe("INSERT INTO C4SyntheticAuditGate VALUES (1,1)");
    // Actual private DB trigger delays the real audit writer AFTER claim CAS;
    // no product function, quote, clock or audit implementation is mocked.
    syntheticAuditText("DELIMITER $$\nCREATE TRIGGER C4SyntheticAuditWait BEFORE INSERT ON AuditLog FOR EACH ROW BEGIN DECLARE gate_value INT; SELECT value INTO gate_value FROM C4SyntheticAuditGate WHERE id=1 FOR UPDATE; END$$\nDELIMITER ;\n");
    const blockerClient=new PrismaClient({datasources:{db:{url:integrationDatabaseUrl!}}});
    let release!:()=>void, acquired!:()=>void;
    const ready=new Promise<void>((r)=>{acquired=r;});const gate=new Promise<void>((r)=>{release=r;});
    const blocker=blockerClient.$transaction(async(tx)=>{await tx.$queryRaw`SELECT id FROM C4SyntheticAuditGate WHERE id=1 FOR UPDATE`;acquired();await gate;},{timeout:10_000});
    await ready;
    const runtimeUrl=runtimeDatabaseUrl();
    const restricted=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}});
    const transaction=vi.spyOn(db,"$transaction").mockImplementation(restricted.$transaction.bind(restricted));
    const observed=actualClaimModelRouteDispatch({authority:GOVERNED_GATEWAY_AUTHORITY,spendAuthority:authority,workspaceId,
      decisionId:prepared.decision.decisionId,gatewayRef:"gateway:c4-audit",runtime:runtimeDescriptor(new Date())
    }).then((result)=>({result,error:null}),(error:unknown)=>({result:null,error}));
    try {
      let lockObserved=false;
      for(let i=0;i<100;i++) { const rows=await blockerClient.$queryRaw<{waits:bigint}[]>`SELECT COUNT(*) AS waits FROM performance_schema.data_lock_waits`;
        if(Number(rows[0]?.waits)>0) {lockObserved=true;break;}await new Promise((r)=>setTimeout(r,5)); }
      expect(lockObserved).toBe(true);await new Promise((r)=>setTimeout(r,500));release();await blocker;
      const outcome=await observed;expect((outcome.error as Error)?.message).toBe("model_route_decision_expired");
      expect(await restricted.lLMSpendLedgerEntry.count({where:{workspaceId}})).toBe(0);
      expect(await restricted.lLMSpendPeriodCounter.count({where:{workspaceId}})).toBe(0);
      expect((await restricted.modelRouteDecision.findUniqueOrThrow({where:{id:prepared.decision.decisionId}})).dispatchClaimHash).toBeNull();
      expect(await restricted.auditLog.count({where:{workspaceId,actionType:"MODEL_EGRESS_DISPATCH_CLAIMED"}})).toBe(0);
    } finally {release();await blocker;await observed;transaction.mockRestore();await restricted.$disconnect();await blockerClient.$disconnect();
      syntheticAuditText("DROP TRIGGER C4SyntheticAuditWait; DROP TABLE C4SyntheticAuditGate;");}
  });

  it("registered C4 cannot use caller future now as runtime authorization", async () => {
    await initializeFixture(`c4-future-${suffix}`);
    const { authority } = await provisionC4("c4-future");
    const prepared=await prepareAllowed(`c4-future-${suffix}`);
    const future=new Date(Date.now()+10_000);
    await expect(actualClaimModelRouteDispatch({ authority:GOVERNED_GATEWAY_AUTHORITY, spendAuthority:authority,
      workspaceId, decisionId:prepared.decision.decisionId, gatewayRef:"gateway:c4-future",
      runtime:runtimeDescriptor(future), now:future })).rejects.toThrow("provider_runtime_not_ready");
    expect(await db.lLMSpendLedgerEntry.count({where:{workspaceId}})).toBe(0);
    expect((await db.modelRouteDecision.findUniqueOrThrow({where:{id:prepared.decision.decisionId}})).dispatchClaimHash).toBeNull();
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
  it("joins a persisted ordinary BI operation to the same claim and settlement transaction", async () => {
    // A deliberately UNKNOWN charge occupies this fixture's concurrency slot.
    // Keep it in a separate workspace from all existing route tests.
    await initializeFixture(`ordinary-${suffix}`);
    const subId = `sub-ordinary-${suffix}`;
    const runId = `run-ordinary-${suffix}`;
    await db.biReportSubscription.create({ data: {
      id: subId, workspaceId, createdByUserId: ownerUserId,
      name: "Synthetic ordinary BI", skillKey: "synthetic", skillVersion: "v1",
      scheduleCron: "0 0 * * *", deliveryTargetsJson: "[]",
    } });
    await db.biReportRun.create({ data: {
      id: runId, workspaceId, subscriptionId: subId,
      scheduledFor: new Date("2026-10-03T00:00:00.000Z"), dedupeKey: runId,
    } });
    const operation = await prepareOrdinaryPaidOperation({ client: db,
      workspaceId, actorUserId: ownerUserId, kind: "bi_analysis", sourceType: "bi_run",
      sourceId: runId, slot: "analysis",
    });
    const projectedPayload: OrdinaryPaidPayload = {
      taskType: "BI_REPORT_ANALYSIS", promptKey: "synthetic.bi", promptVersion: "v1",
      systemPrompt: `synthetic system ${suffix}`, userPrompt: "synthetic user",
      outputMode: "json", jsonSchema: null,
    };
    const serialized = canonicalJson(projectedPayload);
    const projectionReceiptRef = await projection(`evidence:ordinary-${suffix}`,
      `projection:ordinary-${suffix}`, undefined, assetId, new Date(),
      sha256(serialized), Buffer.byteLength(serialized, "utf8"));
    const invoke = vi.fn(async () => ({
      outcome: "success" as const, output: { rawOutput: '{"synthetic":"complete"}',
        modelVersion: "synthetic-model-20260723", promptTokens: 10, completionTokens: 10 },
      requestDisposition: "accepted" as const,
      providerRequestRef: "synthetic-ordinary-request", promptTokens: 10,
      completionTokens: 10, actualCostUsdMicros: 12_500,
      costCurrency: "USD" as const, pricingVersion: PRICING_VERSION,
      costBand: "low" as const, errorCode: null,
    }));
    const registry = createGovernedModelAdapterRegistry<OrdinaryPaidPayload, OrdinaryPaidOutput>([{
      registration: SYNTHETIC_REGISTRATION,
      probeReadiness: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
        modelProbeStatus: "ready", capabilityRefs: [], evidenceRefs: [],
        checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }),
      preflight: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
        observedAt: new Date().toISOString(), estimatedInputTokens: 10,
        estimatedMaxCostUsdMicros: 12_500 }),
      invoke,
    }]);
    const execute = createGovernedModelGateway({ registry,
      dependencies: { spendAuthority: syntheticSpendAuthority } });
    const request = { workspaceId, gatewayRef: "gateway:ordinary-synthetic", policyKey: "caio-pro-default",
      requestKey: operation.requestKey, taskClass: "summary_briefing" as const,
      taskRef: `ordinary:${operation.id}`, ordinaryOperationId: operation.id,
      projectionReceiptRef, projectedPayload, requestedMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS };
    await expect(execute({ ...request, ordinaryOperationId: undefined }))
      .rejects.toThrow("ordinary_operation_required");
    expect(invoke).not.toHaveBeenCalled();
    let committedGatewayResult: Awaited<ReturnType<typeof execute>> | null = null;
    const issueProjection = vi.fn(async ({ operationId, projectedPayloadHash }: {
      operationId: string; projectedPayloadHash: string;
    }) => {
      expect(operationId).toBe(operation.id);
      expect(projectedPayloadHash).toBe(sha256(serialized));
      return projectionReceiptRef;
    });
    const bridge = createOrdinaryPaidAdapterBridge({ policyKey: "caio-pro-default",
      operationWriterClient: db, chargeClient: ordinaryTestCharge,
      issueProjection,
      gateway: async (request) => {
        const result = await execute(request);
        if (result.status === "success") committedGatewayResult = result;
        return result;
      },
    });
    const ordinaryInput = { taskType: "BI_REPORT_ANALYSIS" as const, workspaceId,
      userId: ownerUserId, promptKey: projectedPayload.promptKey,
      promptVersion: projectedPayload.promptVersion, systemPrompt: projectedPayload.systemPrompt,
      userPrompt: projectedPayload.userPrompt, outputMode: "json" as const,
      parseOutput: (raw: string) => JSON.parse(raw) as { synthetic: string },
      fallbackOutput: { synthetic: "fallback" }, ordinaryOperationId: operation.id,
      effectiveMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS };
    const concurrent = await Promise.allSettled([bridge(ordinaryInput), bridge(ordinaryInput)]);
    expect(concurrent.some((result) => result.status === "fulfilled" && result.value.output.synthetic === "complete"))
      .toBe(true);
    expect(issueProjection).toHaveBeenCalled();
    expect((await db.lLMWorkflowOperation.findUniqueOrThrow({ where: { id: operation.id } })).projectionReceiptRef)
      .toBe(projectionReceiptRef);
    expect(invoke).toHaveBeenCalledTimes(1);
    const decision = await db.modelRouteDecision.findFirstOrThrow({ where: {
      workspaceId, requestKey: operation.requestKey,
    } });
    const ledger = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
      workspaceId_attemptRef: { workspaceId, attemptRef: decision.dispatchProviderIdempotencyKey! },
    } });
    expect(ledger.state).toBe("settled");
    expect(ledger.settledMicros).toBe(BigInt(12_500));
    expect(await db.modelEgressReceipt.count({ where: { decisionId: decision.id, sequence: 2 } })).toBe(1);
    const committedReceipt = await db.modelEgressReceipt.findUniqueOrThrow({ where: {
      decisionId_sequence: { decisionId: decision.id, sequence: 2 },
    } });
    expect(committedReceipt.receiptJson).not.toContain("complete");
    expect(committedReceipt.receiptJson).toContain("outputContentHash");
    expect(committedGatewayResult?.status).toBe("success");
    const settled = committedGatewayResult!;
    for (const changedOutput of [
      { ...settled.output!, promptTokens: 11 },
      { ...settled.output!, completionTokens: 11 },
      { ...settled.output!, modelVersion: "synthetic-other-version" },
      { ...settled.output!, rawOutput: '{"synthetic":"altered"}' },
    ]) {
      const tampered = createOrdinaryPaidAdapterBridge({ policyKey: "caio-pro-default",
        operationWriterClient: db, chargeClient: ordinaryTestCharge,
        gateway: async () => ({ ...settled, output: changedOutput }),
      });
      await expect(tampered(ordinaryInput)).rejects.toThrow("paid_egress_committed_readback_invalid");
    }

    // A distinct persisted business run represents another operation. A
    // mutable revision of the first run cannot mint a second paid attempt.
    const unknownRunId = `run-ordinary-unknown-${suffix}`;
    await db.biReportRun.create({ data: {
      id: unknownRunId, workspaceId, subscriptionId: subId,
      scheduledFor: new Date("2026-10-04T00:00:00.000Z"), dedupeKey: unknownRunId,
    } });
    const unknownOperation = await prepareOrdinaryPaidOperation({ client: db,
      workspaceId, actorUserId: ownerUserId, kind: "bi_analysis", sourceType: "bi_run",
      sourceId: unknownRunId, slot: "analysis",
    });
    const unknownPayload: OrdinaryPaidPayload = { ...projectedPayload,
      userPrompt: "synthetic user revision" };
    const unknownSerialized = canonicalJson(unknownPayload);
    const unknownProjectionRef = await projection(`evidence:ordinary-unknown-${suffix}`,
      `projection:ordinary-unknown-${suffix}`, undefined, assetId, new Date(),
      sha256(unknownSerialized), Buffer.byteLength(unknownSerialized, "utf8"));
    await bindOrdinaryPaidProjection({ client: db, workspaceId,
      operationId: unknownOperation.id, projectionReceiptRef: unknownProjectionRef,
      projectedPayloadHash: sha256(unknownSerialized) });
    invoke.mockImplementationOnce(async () => { throw new Error("synthetic outcome unknown"); });
    const unknownInput = { ...ordinaryInput, userPrompt: unknownPayload.userPrompt,
      ordinaryOperationId: unknownOperation.id };
    await expect(bridge(unknownInput)).rejects.toThrow("paid_egress_in_doubt");
    const invokeCountAfterUnknown = invoke.mock.calls.length;
    await expect(bridge(unknownInput)).rejects.toThrow();
    expect(invoke).toHaveBeenCalledTimes(invokeCountAfterUnknown);
    const unknownDecision = await db.modelRouteDecision.findFirstOrThrow({ where: {
      workspaceId, requestKey: unknownOperation.requestKey,
    } });
    const unknownLedger = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
      workspaceId_attemptRef: { workspaceId,
        attemptRef: unknownDecision.dispatchProviderIdempotencyKey! },
    } });
    expect(unknownLedger.state).toBe("unknown");
    expect(unknownLedger.reservedMicros).toBe(unknownLedger.maximumChargeMicros);
    expect(unknownLedger.reservedMicros).toBeGreaterThan(BigInt(0));
    expect(await db.modelEgressReceipt.count({ where: {
      decisionId: unknownDecision.id, sequence: 2,
    } })).toBe(0);
  });

  it("charges each ordinary task kind and each distinct multi-pass role through C3", async () => {
    const writerUrl = process.env.ORDINARY_PAID_WRITER_DATABASE_URL;
    if (!writerUrl) throw new Error("ordinary_paid_writer_database_required");
    const writerTarget = new URL(writerUrl);
    const chargeTarget = runtimeDatabaseUrl();
    const rootTarget = new URL(integrationDatabaseUrl!);
    if (writerTarget.pathname !== rootTarget.pathname ||
        chargeTarget.pathname !== rootTarget.pathname ||
        writerTarget.search !== rootTarget.search ||
        chargeTarget.search !== rootTarget.search ||
        writerTarget.username === chargeTarget.username ||
        writerTarget.username === rootTarget.username) {
      throw new Error("ordinary_paid_split_realm_invalid");
    }
    const writer = new PrismaClient({ datasources: { db: { url: writerUrl } } });
    const charge = new PrismaClient({ datasources: { db: { url: process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL! } } });
    try {
    const [writerPrincipal] = await writer.$queryRaw<Array<{ principal: string }>>`SELECT CURRENT_USER() AS principal`;
    const [chargePrincipal] = await charge.$queryRaw<Array<{ principal: string }>>`SELECT CURRENT_USER() AS principal`;
    expect(writerPrincipal?.principal).toContain("c5_writer");
    expect(chargePrincipal?.principal).toContain("c4_runtime");
    await initializeFixture(`ordinary-review-${suffix}`);
    const subscriptionId = `sub-review-${suffix}`;
    const runId = `run-review-${suffix}`;
    await db.biReportSubscription.create({ data: {
      id: subscriptionId, workspaceId, createdByUserId: ownerUserId,
      name: "Synthetic review source", skillKey: "synthetic", skillVersion: "v1",
      scheduleCron: "0 0 * * *", deliveryTargetsJson: "[]",
    } });
    await db.biReportRun.create({ data: {
      id: runId, workspaceId, subscriptionId,
      scheduledFor: new Date("2026-10-03T00:00:00.000Z"), dedupeKey: runId,
    } });
    const recommendationId = `recommendation-review-${suffix}`;
    await db.recommendationLog.create({ data: {
      id: recommendationId, workspaceId, userId: ownerUserId,
      objectType: "COMPANY", objectId: `synthetic-company-${suffix}`,
      actionType: "CREATE_TASK", title: "Synthetic recommendation",
      description: "Synthetic deterministic source", policyResult: "SUGGEST_ONLY",
      explanation: "Deterministic explanation",
    } });
    const companyId = `company-review-${suffix}`;
    const meetingId = `meeting-review-${suffix}`;
    const meetingNoteId = `meeting-note-review-${suffix}`;
    await db.company.create({ data: { id: companyId, workspaceId,
      name: "Synthetic company" } });
    await db.meeting.create({ data: { id: meetingId, workspaceId,
      title: "Synthetic meeting", startsAt: new Date("2026-10-03T00:00:00.000Z"),
      endsAt: new Date("2026-10-03T01:00:00.000Z") } });
    await db.meetingNote.create({ data: { id: meetingNoteId, workspaceId,
      meetingId, summary: "Synthetic meeting note" } });
    const invoke = vi.fn(async () => ({
      outcome: "success" as const,
      output: { rawOutput: '{"synthetic":"reviewed"}',
        modelVersion: "synthetic-model-20260723", promptTokens: 10, completionTokens: 10 },
      requestDisposition: "accepted" as const,
      providerRequestRef: `synthetic-reviewed-${invoke.mock.calls.length}`,
      promptTokens: 10, completionTokens: 10,
      actualCostUsdMicros: 12_500, costCurrency: "USD" as const,
      pricingVersion: PRICING_VERSION, costBand: "low" as const, errorCode: null,
    }));
    const registry = createGovernedModelAdapterRegistry<OrdinaryPaidPayload, OrdinaryPaidOutput>([{
      registration: SYNTHETIC_REGISTRATION,
      probeReadiness: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
        modelProbeStatus: "ready", capabilityRefs: [], evidenceRefs: [],
        checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }),
      preflight: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
        observedAt: new Date().toISOString(), estimatedInputTokens: 10,
        estimatedMaxCostUsdMicros: 12_500 }),
      invoke,
    }]);
    const gateway = createGovernedModelGatewayForChargeClient({
      client: charge, registry, spendAuthority: syntheticSpendAuthority });
    const tasks = [
      { kind: "bi_analysis" as const, slot: "analysis" as const,
        taskType: "BI_REPORT_ANALYSIS" as const, taskClass: "summary_briefing" as const,
        sourceType: "bi_run" as const, sourceId: runId },
      { kind: "bi_review" as const, slot: "review" as const,
        taskType: "BI_REPORT_REVIEW" as const, taskClass: "reasoning_counterfactual" as const,
        sourceType: "bi_run" as const, sourceId: runId },
      { kind: "meeting_extraction" as const, slot: "extraction" as const,
        taskType: "MEETING_MEMORY_EXTRACTION" as const, taskClass: "extraction_classification" as const,
        sourceType: "meeting_note" as const, sourceId: meetingNoteId },
      { kind: "recommendation_explanation" as const, slot: "explanation" as const,
        taskType: "RECOMMENDATION_EXPLANATION" as const, taskClass: "summary_briefing" as const,
        sourceType: "recommendation_log" as const, sourceId: recommendationId },
      { kind: "briefing" as const, slot: "object_brief" as const,
        taskType: "COMPANY_BRIEFING" as const, taskClass: "summary_briefing" as const,
        sourceType: "company" as const, sourceId: companyId },
      { kind: "counterfactual_review" as const, slot: "counterfactual" as const,
        taskType: "COUNTERFACTUAL_REVIEW" as const, taskClass: "reasoning_counterfactual" as const,
        sourceType: "bi_run" as const, sourceId: runId },
      { kind: "judgement_review" as const, slot: "critique" as const,
        taskType: "JUDGEMENT_BOUNDARY_REVIEW" as const, taskClass: "reasoning_counterfactual" as const,
        sourceType: "recommendation_log" as const, sourceId: recommendationId },
      ...(["generator", "critic", "adversary"] as const).map((slot) => ({
        kind: "multi_pass_review" as const, slot,
        taskType: "MULTI_PASS_REVIEW" as const, taskClass: "multi_pass_review" as const,
        sourceType: "bi_run" as const, sourceId: runId,
      })),
    ];
    for (const task of tasks) {
      const operation = await prepareOrdinaryPaidOperation({ client: writer,
        workspaceId, actorUserId: ownerUserId, kind: task.kind,
        sourceType: task.sourceType, sourceId: task.sourceId, slot: task.slot });
      if (task.kind === "bi_analysis") {
        await expect(writer.$executeRaw`UPDATE LLMWorkflowOperation SET generation=2 WHERE id=${operation.id}`)
          .rejects.toThrow();
        await expect(writer.$executeRaw`UPDATE LLMWorkflowOperation SET requestKey='forged' WHERE id=${operation.id}`)
          .rejects.toThrow();
        await expect(writer.$executeRaw`DELETE FROM LLMWorkflowOperation WHERE id=${operation.id}`)
          .rejects.toThrow();
        await expect(charge.lLMWorkflowOperation.create({ data: {
          workspaceId, operationKey: `sha256:${"a".repeat(64)}`,
          requestKey: "ordinary:forged", kind: "bi_analysis",
          sourceType: "bi_run", sourceId: runId, sourceVersion: "forged",
          sourceDigest: `sha256:${"b".repeat(64)}`,
          actorUserId: ownerUserId, generation: 2, slot: "analysis",
        } })).rejects.toThrow();
      }
      // The judgement and critic roles exercise the same gateway with restricted C4
      // runtime connection. Its projection is issued/bound beforehand by the
      // privileged fixture so runtime only needs SELECT on the operation.
      if (task.slot === "critic" || task.slot === "critique") {
        const projectedPayload: OrdinaryPaidPayload = {
          taskType: task.taskType, promptKey: `synthetic.review.${task.slot}`,
          promptVersion: "v1", systemPrompt: "synthetic system",
          userPrompt: `synthetic ${task.slot}`, outputMode: "json", jsonSchema: null,
        };
        const serialized = canonicalJson(projectedPayload);
        const receiptRef = await projection(
          `evidence:ordinary-review-${task.slot}-${suffix}`,
          `projection:ordinary-review-${task.slot}-${suffix}`, undefined,
          assetId, new Date(), sha256(serialized), Buffer.byteLength(serialized, "utf8"));
        await bindOrdinaryPaidProjection({ client: writer, workspaceId,
          operationId: operation.id, projectionReceiptRef: receiptRef,
          projectedPayloadHash: sha256(serialized) });
      }
      const bridge = createOrdinaryPaidAdapterBridge({ policyKey: "caio-pro-default",
        operationWriterClient: writer, chargeClient: charge,
        gateway,
        issueProjection: task.slot === "critic" || task.slot === "critique" ? undefined : async ({ projectedPayload, projectedPayloadHash }) =>
          projection(`evidence:ordinary-review-${task.slot}-${suffix}`,
            `projection:ordinary-review-${task.slot}-${suffix}`, undefined, assetId,
            new Date(), projectedPayloadHash,
            Buffer.byteLength(canonicalJson(projectedPayload), "utf8")),
      });
      const runBridge = () => bridge({ workspaceId, userId: ownerUserId,
        taskType: task.taskType, promptKey: `synthetic.review.${task.slot}`,
        promptVersion: "v1", systemPrompt: "synthetic system",
        userPrompt: `synthetic ${task.slot}`, outputMode: "json",
        parseOutput: (raw: string) => JSON.parse(raw) as { synthetic: string },
        fallbackOutput: { synthetic: "fallback" },
        ordinaryOperationId: operation.id, effectiveMaxOutputTokens: REQUESTED_MAX_OUTPUT_TOKENS });
      let result;
      try { result = await runBridge(); } catch (error) {
        throw new Error(`synthetic_task_kind=${task.kind}: ${String(error)}`);
      }
      expect(result.output.synthetic).toBe("reviewed");
      const decision = await db.modelRouteDecision.findFirstOrThrow({ where: {
        workspaceId, requestKey: operation.requestKey,
      } });
      expect(decision.taskClass).toBe(task.taskClass.toUpperCase());
      const ledger = await db.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
        workspaceId_attemptRef: { workspaceId,
          attemptRef: decision.dispatchProviderIdempotencyKey! },
      } });
      expect(ledger.state).toBe("settled");
    }
    expect(invoke).toHaveBeenCalledTimes(tasks.length);
    } finally { await Promise.all([writer.$disconnect(), charge.$disconnect()]); }
  });

  it("runs real recommendation and review hosts from fresh source through writer and C4 charge", async () => {
    const writerUrl = process.env.ORDINARY_PAID_WRITER_DATABASE_URL;
    const chargeUrl = process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL;
    if (!writerUrl || !chargeUrl) throw new Error("ordinary_paid_split_database_required");
    await initializeFixture(`ordinary-host-${suffix}`, { primaryMaxOutputTokens: 8_192 });
    const logId = `rec-host-${suffix}`;
    await db.recommendationLog.create({ data: {
      id: logId, workspaceId, userId: ownerUserId,
      objectType: "COMPANY", objectId: `synthetic-object-${suffix}`,
      actionType: "CREATE_TASK", title: "Synthetic action",
      description: "Synthetic explanation input", policyResult: "SUGGEST_ONLY",
      explanation: "Synthetic deterministic baseline",
    } });
    expect(await db.lLMWorkflowOperation.count({ where: { workspaceId } })).toBe(0);
    const writer = new PrismaClient({ datasources: { db: { url: writerUrl } } });
    const charge = new PrismaClient({ datasources: { db: { url: chargeUrl } } });
    const fallback = { explanation: "synthetic fallback", whyNow: "now",
      expectedImpact: "impact", ifNoAction: "no action", currentBlocker: null,
      currentCommitment: null, personalizationHint: null,
      supportingHighlights: ["synthetic"], evidenceSummary: "synthetic evidence" };
    const invoke = vi.fn(async ({ taskRef, projectedPayload }: {
      taskRef: string; projectedPayload: { taskType: string };
    }) => {
      const sourceOperation = await charge.lLMWorkflowOperation.findUnique({
        where: { id: taskRef.replace(/^ordinary:/u, "") },
      });
      const syntheticOutput = projectedPayload.taskType === "MULTI_PASS_REVIEW"
        ? { role: sourceOperation?.slot, reviewState: "candidate",
            evidenceRefs: ["synthetic-evidence"], notes: ["Synthetic note"] }
        : projectedPayload.taskType === "MEETING_MEMORY_EXTRACTION"
          ? { summary: "Synthetic meeting", facts: [], commitments: [], blockers: [],
              candidateActions: [] }
          : projectedPayload.taskType.endsWith("_BRIEFING")
            ? { summary: "Synthetic briefing", recommendedQuestions: [],
                recommendedNextSteps: [], importantFactHighlights: [] }
            : projectedPayload.taskType === "BI_REPORT_ANALYSIS"
              ? { headline: "Synthetic", summary: "Synthetic analysis", findings: [],
                  possibleCauses: [], recommendedActions: [], confidence: 0.5,
                  continuityStatus: "first_seen", historicalContext: null,
                  feedbackContext: null, boundaryNote: "Synthetic only" }
              : { ...fallback, explanation: "charged output" };
      const rawOutput = JSON.stringify(syntheticOutput);
      return ({
      outcome: "success" as const,
      output: { rawOutput,
        modelVersion: "synthetic-model-20260723", promptTokens: 10, completionTokens: 10 },
      requestDisposition: "accepted" as const,
      providerRequestRef: `synthetic-host-request:${taskRef}`, promptTokens: 10,
      completionTokens: 10, actualCostUsdMicros: 12_500,
      costCurrency: "USD" as const, pricingVersion: PRICING_VERSION,
      costBand: "low" as const, errorCode: null,
    }); });
    const adapter = {
      registration: SYNTHETIC_REGISTRATION,
      probeReadiness: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
        modelProbeStatus: "ready" as const, capabilityRefs: [], evidenceRefs: [],
        checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }),
      preflight: async () => ({ endpointFingerprint: HASH_C, credentialConfigured: true,
        observedAt: new Date().toISOString(), estimatedInputTokens: 10,
        estimatedMaxCostUsdMicros: 12_500 }),
      invoke,
    };
    const oldLLM = process.env.LLM_ENABLED;
    process.env.LLM_ENABLED = "true";
    const ordinaryAdapter = getProviderAdapter("qwen")!;
    const configured = vi.spyOn(ordinaryAdapter, "isConfigured").mockReturnValue(true);
    const directRun = vi.spyOn(ordinaryAdapter, "run").mockRejectedValue(new Error("direct_adapter_forbidden"));
    try {
      await installOrdinaryPaidServerBootstrap({
        operationWriterClient: writer, chargeClient: charge,
        policyKey: "caio-pro-default", spendAuthority: syntheticSpendAuthority,
        adapters: [adapter],
        issueProjection: ({ operationId, projectedPayload, projectedPayloadHash }) =>
          projection(`evidence:host-${operationId}`, `projection:host-${operationId}`,
            { maxInputTokens: 8_000, maxOutputTokens: 8_192 },
            assetId, new Date(), projectedPayloadHash,
            Buffer.byteLength(canonicalJson(projectedPayload), "utf8")),
      });
      const result = await enhanceRecommendationExplanationWithLLM({
        workspaceId, userId: ownerUserId, objectLabel: "Synthetic object",
        recommendationTitle: "Synthetic action",
        recommendationDescription: "Synthetic description",
        deterministicExplanation: "Synthetic baseline",
        policyResultLabel: "Suggest only", fallback, recommendationLogId: logId,
      });
      expect(result.output.explanation).toBe("charged output");
      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(directRun).not.toHaveBeenCalled();
      const operation = await charge.lLMWorkflowOperation.findFirstOrThrow({ where: { workspaceId } });
      const decision = await charge.modelRouteDecision.findFirstOrThrow({ where: {
        workspaceId, requestKey: operation.requestKey,
      } });
      const ledger = await charge.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
        workspaceId_attemptRef: { workspaceId,
          attemptRef: decision.dispatchProviderIdempotencyKey! },
      } });
      expect(ledger.state).toBe("settled");
      const packet = { packetId: `packet-${suffix}`, workspaceId,
        objectRef: { objectType: "recommendation", objectId: logId },
        timeline: [], evidenceRefs: [], signals: [], commitments: [], blockers: [],
        policySnapshot: {}, permissions: { allowedUses: ["human_review"],
          forbiddenUses: ["external_send", "writeback"], requiredHumanReview: true },
        privacyClass: "public_safe_synthetic", tokenBudget: { maxInputTokens: 1_000,
          maxOutputTokens: 200 }, missingEvidence: [], boundaryNotes: ["Synthetic."] } as const;
      const candidate = { candidateId: `candidate-${suffix}`, packetId: packet.packetId,
        workspaceId, targetObjectRef: { objectType: "recommendation", objectId: logId },
        judgementType: "recommendation_critic", reviewState: "candidate", confidence: 72,
        summary: "Synthetic review", rationale: ["Synthetic evidence"], evidenceRefIds: [],
        missingEvidenceIds: [], boundaryNotes: ["Synthetic note"] } as const;
      const judgementResult = await reviewJudgementBoundaryWithLLM({ workspaceId, userId: ownerUserId,
        recommendationLogId: logId, contextPacket: packet, candidate });
      const judgementOperations = await charge.lLMWorkflowOperation.count({ where: {
        workspaceId, kind: "judgement_review",
      } });
      expect(judgementOperations, JSON.stringify({ judgementResult })).toBe(1);
      const reviewOperation = await charge.lLMWorkflowOperation.findFirstOrThrow({ where: {
        workspaceId, kind: "judgement_review",
      } });
      expect(reviewOperation.sourceId).toBe(logId);
      const reviewCall = await db.lLMCallLog.findFirst({ where: { workspaceId },
        orderBy: { createdAt: "desc" } });
      expect(reviewCall?.fallbackReason, JSON.stringify({ judgementResult,
        errorMessage: reviewCall?.errorMessage })).toBeNull();
      const reviewDecision = await charge.modelRouteDecision.findFirstOrThrow({ where: {
        workspaceId, requestKey: reviewOperation.requestKey,
      } });
      expect(invoke, JSON.stringify({ judgementResult, reviewDecision })).toHaveBeenCalledTimes(2);
      expect((await charge.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
        workspaceId_attemptRef: { workspaceId,
          attemptRef: reviewDecision.dispatchProviderIdempotencyKey! },
      } })).state).toBe("settled");
      const counterfactualResult = await reviewCounterfactualWithLLM({ workspaceId, userId: ownerUserId,
        contextStub: { objectRef: { objectType: "recommendation", objectId: logId },
          selectedEvidenceRefs: ["evidence:synthetic"], missingEvidence: [],
          policySnapshotHash: "sha256:synthetic", privacyClass: "public_safe_synthetic",
          tokenBudget: { maxInputTokens: 1_000, maxOutputTokens: 200 } },
        judgementSummary: "Synthetic", capabilityRequested: { capabilityRef: "boundary_review" } });
      const counterfactualCall = await db.lLMCallLog.findFirst({ where: { workspaceId },
        orderBy: { createdAt: "desc" } });
      expect(invoke, JSON.stringify({ counterfactualResult,
        errorMessage: counterfactualCall?.errorMessage })).toHaveBeenCalledTimes(3);
      expect((await charge.lLMWorkflowOperation.findFirstOrThrow({ where: {
        workspaceId, kind: "counterfactual_review",
      } })).sourceId).toBe(logId);
      const multiPassProfile = { profileKey: "synthetic-remote-review",
        contextMode: "remote_projected_review_required", providerMode: "remote",
        reasoningDepth: "deep", toolCoordination: "programmatic",
        multiPassAllowed: true, remoteEgressPolicy: "projection_requires_consent",
        budgetClass: "premium", allowedWorkflowClasses: ["multi_pass_review"] } as const;
      const multiPassResult = await executeMultiPassReview({ workspaceId,
        userId: ownerUserId, profileKey: multiPassProfile.profileKey,
        profileRegistry: { [multiPassProfile.profileKey]: multiPassProfile },
        contextStub: { objectRef: { objectType: "recommendation", objectId: logId },
          selectedEvidenceRefs: ["synthetic-evidence"], missingEvidence: [],
          policySnapshotHash: "sha256:synthetic", privacyClass: "public_safe_synthetic",
          tokenBudget: { maxInputTokens: 1_000, maxOutputTokens: 200 } },
        proposalSummary: "Synthetic proposal", businessValue: "high",
        uncertainty: "high", riskClass: "read", evidenceCompleteness: "partial",
        egressPolicy: { consentGranted: true, promptPreviewAccepted: true,
          auditRef: "synthetic-reviewed-egress" },
      });
      expect(invoke, JSON.stringify({ multiPassResult })).toHaveBeenCalledTimes(6);
      expect(await charge.lLMWorkflowOperation.count({ where: { workspaceId,
        kind: "multi_pass_review" } })).toBe(3);
      const subscriptionConfig: BiReportSubscriptionConfig = {
        name: "Synthetic count", skillKey: "synthetic_count", skillVersion: "v1",
        enabled: true, scheduleCron: "0 9 * * *", timezone: "UTC", sqlParams: {},
        deliveryTargets: [],
      };
      const skill: BiReportSkillPack = { baseDir: "/synthetic",
        manifest: { skillKey: "synthetic_count", name: "Synthetic count", version: "v1",
          sourceType: "synthetic", analysisMode: "metric_rule_only",
          defaultSchedule: "0 9 * * *", timezone: "UTC", supportedDeliveryChannels: [],
          parameters: [], boundaries: [] }, querySql: "SELECT 1",
        schema: { version: "v1", type: "table", columns: [
          { name: "synthetic_count", type: "integer", required: true },
        ] }, metrics: { version: "v1", aggregations: [
          { key: "synthetic_count", label: "Count", type: "sum", field: "synthetic_count" },
        ] }, resultCriteria: { version: "v1", summaryMetricKeys: ["synthetic_count"],
          rules: [] }, promptTemplate: "Synthetic {{metrics.synthetic_count}}",
        messageTemplate: "{{skill.name}} {{metrics.synthetic_count}}" };
      const subscription = await db.biReportSubscription.create({ data: {
        workspaceId, createdByUserId: ownerUserId, name: "Synthetic count",
        skillKey: skill.manifest.skillKey, skillVersion: skill.manifest.version,
        scheduleCron: subscriptionConfig.scheduleCron, timezone: "UTC",
        deliveryTargetsJson: "[]", sqlParamsJson: "{}",
      } });
      const run = await db.biReportRun.create({ data: { workspaceId,
        subscriptionId: subscription.id, scheduledFor: new Date(),
        dedupeKey: `synthetic:${suffix}`, querySummaryJson: "{}" } });
      await prepareBiReportDryRun({ workspaceId, userId: ownerUserId, skill,
        subscription: subscriptionConfig, rows: [{ synthetic_count: 1 }],
        useLLM: true, persistedRunId: run.id });
      expect(invoke).toHaveBeenCalledTimes(8);
      expect(await charge.lLMWorkflowOperation.count({ where: { workspaceId,
        sourceType: "bi_run", sourceId: run.id } })).toBe(2);
      const contact = await db.contact.create({ data: { workspaceId,
        ownerId: ownerUserId, name: "Synthetic contact" } });
      const briefing = await generateContactBriefingSnapshot({ workspaceId,
        actorName: "Synthetic owner", actorUserId: ownerUserId,
        actorType: ActorType.USER, contactId: contact.id });
      expect(briefing.payload.summary).toBe("Synthetic briefing");
      expect(invoke).toHaveBeenCalledTimes(9);
      expect(await charge.lLMWorkflowOperation.count({ where: { workspaceId,
        kind: "briefing", sourceType: "contact", sourceId: contact.id } })).toBe(1);
      const meeting = await db.meeting.create({ data: { workspaceId,
        ownerId: ownerUserId, title: "Synthetic meeting",
        startsAt: new Date("2026-10-03T08:00:00.000Z"),
        endsAt: new Date("2026-10-03T09:00:00.000Z") } });
      const note = await db.meetingNote.create({ data: { workspaceId,
        meetingId: meeting.id, summary: "Synthetic discussion" } });
      await processMeetingMemory({ workspaceId, actorName: "Synthetic owner",
        actorUserId: ownerUserId, actorType: ActorType.USER, meetingId: meeting.id });
      expect(invoke).toHaveBeenCalledTimes(11);
      expect(await charge.lLMWorkflowOperation.count({ where: { workspaceId,
        kind: "meeting_extraction", sourceType: "meeting_note", sourceId: note.id } })).toBe(1);
      const operations = await charge.lLMWorkflowOperation.findMany({ where: { workspaceId } });
      expect(operations).toHaveLength(11);
      for (const charged of operations) {
        const chargedDecision = await charge.modelRouteDecision.findFirstOrThrow({ where: {
          workspaceId, requestKey: charged.requestKey,
        } });
        expect((await charge.lLMSpendLedgerEntry.findUniqueOrThrow({ where: {
          workspaceId_attemptRef: { workspaceId,
            attemptRef: chargedDecision.dispatchProviderIdempotencyKey! },
        } })).state).toBe("settled");
      }
    } finally {
      configured.mockRestore(); directRun.mockRestore();
      if (oldLLM === undefined) delete process.env.LLM_ENABLED;
      else process.env.LLM_ENABLED = oldLLM;
      await Promise.all([writer.$disconnect(), charge.$disconnect()]);
    }
  });

  it.each(["valid", "missing-usage", "duplicate-key", "too-large", "http-error", "timeout", "revoked-during-call", "wrong-output", "wrong-cost", "lost-terminal-ack", "collector-insert-failure", "collector-ack-loss", "attestor-expired-lockwait", "untrusted-root", "wrong-key", "wrong-endpoint", "same-principal", "finite-concurrent", "finite-unknown"])(
    "runs trusted HTTP usage through actual bootstrap and committed readback: %s", async (mode) => {
    assertTrustedUsageTestTargets();
    vi.resetModules();
    const writer = new PrismaClient({ datasources: { db: { url: process.env.ORDINARY_PAID_WRITER_DATABASE_URL! } } });
    const charge = new PrismaClient({ datasources: { db: { url: process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL! } } });
    const collector = new PrismaClient({ datasources: { db: { url: process.env.LLM_USAGE_COLLECTOR_DATABASE_URL! } } });
    const oldEnabled = process.env.LLM_ENABLED, oldKey = process.env.DASHSCOPE_API_KEY;
    const fallback = { explanation: "synthetic fallback", whyNow: "now", expectedImpact: "impact",
      ifNoAction: "no action", currentBlocker: null, currentCommitment: null, personalizationHint: null,
      supportingHighlights: ["synthetic"], evidenceSummary: "synthetic evidence" };
    let output: OrdinaryPaidOutput;
    let calls = 0, collectorAckLost = false;
    let releaseHttp!: () => void;
    const httpBarrier = new Promise<void>((resolve) => { releaseHttp = resolve; });
    const additionalClients: PrismaClient[] = [];
    let authorityLock: Promise<unknown> | null = null;
    const server = createServer((request, response) => {
      calls++; let body = ""; request.setEncoding("utf8"); request.on("data", (chunk) => { body += chunk; });
      request.on("end", async () => {
        const parsed = JSON.parse(body); response.setHeader("Content-Type", "application/json");
        const value: Record<string, unknown> = { schema: "helm.controlled-model-response/v1", requestId: parsed.requestId,
          requestRef: `synthetic:usage-${suffix}`, output, usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 } };
        if (mode === "missing-usage" || mode === "finite-unknown") delete value.usage;
        if (mode === "revoked-during-call") await db.$executeRaw`UPDATE LLMUsageAttestorGrant SET revokedAt=UTC_TIMESTAMP(3) WHERE id=${`usage-grant:${mode}:${suffix}`}`;
        if (mode === "http-error") response.statusCode = 500;
        const bytes = mode === "too-large" ? " ".repeat(65_537) : mode === "duplicate-key" ? '{"schema":"ignored",' + canonicalAuthorityJson(value).slice(1) : canonicalAuthorityJson(value);
        if (mode === "finite-concurrent") await httpBarrier;
        if (mode === "timeout") setTimeout(() => response.end(bytes), 120); else response.end(bytes);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("synthetic_loopback_unbound");
    try {
    const endpointFingerprint = authorityHash({ schema: "helm.controlled-http-endpoint/v1", origin: `http://127.0.0.1:${address.port}`, path: "/synthetic" });
    await initializeFixture(`trusted-http-${mode}-${suffix}`, { primaryMaxOutputTokens: 8_192, primaryMaxConcurrency: mode.startsWith("finite-") ? 2 : undefined, endpointFingerprint });
    const { registryConfig } = await provisionC4(`trusted-http-${mode}-${suffix}`, mode.startsWith("finite-") ? BigInt(1_536) : null);
    output = { rawOutput: JSON.stringify({ ...fallback, explanation: "charged synthetic" }),
      modelVersion: primaryRoute.modelVersion, promptTokens: 10, completionTokens: 10 };
    const usageKeys = generateKeyPairSync("ed25519");
    const grant = { schema: "helm.usage-attestor-grant/v1" as const, id: `usage-grant:${mode}:${suffix}`, workspaceId,
      source: USAGE_SOURCE, sourceHash: HASH_A, adapterKey: SYNTHETIC_REGISTRATION.adapterKey,
      registrationHash: SYNTHETIC_REGISTRATION.contentHash, provider: primaryRoute.provider, model: primaryRoute.modelId,
      modelVersion: primaryRoute.modelVersion, sku: "text-only", endpointFingerprint,
      publicKeyPem: usageKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + (mode === "attestor-expired-lockwait" ? 2_000 : 3_600_000)).toISOString() };
    const usage = { trustedAttestorGrants: { [grant.id]: authorityHash(grant) } };
    await db.$executeRaw`INSERT INTO LLMUsageAttestorGrant(id,workspaceId,envelopeJson,contentHash) VALUES (${grant.id},${workspaceId},${canonicalAuthorityJson(grant)},${authorityHash(grant)})`;
    const authority = createRegisteredGovernedSpendAuthority({ ...registryConfig, usage });
    const installedCollector = mode.startsWith("collector-") ? new Proxy(collector, { get(target, property) {
      if (property === "$transaction") return async (...args: unknown[]) => {
        const [callback, ...options] = args as [(tx: Prisma.TransactionClient) => Promise<unknown>, ...unknown[]];
        // Inject an actual DB permission failure at the collector INSERT. This
        // uses the real charge principal (SELECT-only for evidence), not a mock
        // authority or a CI admin GRANT OPTION that the fixture does not have.
        const realCallback = mode === "collector-insert-failure" ? (tx: Prisma.TransactionClient) => callback(new Proxy(tx, { get(actual, key) {
          if (key === "$executeRaw") return charge.$executeRaw.bind(charge);
          const value = Reflect.get(actual, key); return typeof value === "function" ? value.bind(actual) : value;
        } })) : callback;
        const result = await (target.$transaction as (...args: unknown[]) => Promise<unknown>)(realCallback, ...options);
        if (mode === "collector-ack-loss" && !collectorAckLost && (result as { schema?: string })?.schema === "helm.trusted-usage/v1") {
          collectorAckLost = true; throw new Error("synthetic_committed_collector_ack_lost");
        }
        return result;
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } }) : collector;
    const factoryInput = { collectorClient: installedCollector, chargeClient: charge,
      operationWriterClient: writer, registration: SYNTHETIC_REGISTRATION, grantId: grant.id, usage, spend: registryConfig,
      privateKey: usageKeys.privateKey, endpoint: `http://127.0.0.1:${address.port}/synthetic`, endpointFingerprint,
      timeoutMs: mode === "timeout" ? 40 : 5_000, maximumResponseBytes: 65_536 };
    if (["untrusted-root", "wrong-key", "wrong-endpoint", "same-principal"].includes(mode)) {
      const rejected = mode === "untrusted-root" ? { ...factoryInput, usage: { trustedAttestorGrants: {} } } :
        mode === "wrong-key" ? { ...factoryInput, privateKey: generateKeyPairSync("ed25519").privateKey } :
        mode === "wrong-endpoint" ? { ...factoryInput, endpoint: `http://127.0.0.1:${address.port}/different` } :
        { ...factoryInput, collectorClient: writer };
      await expect(createGovernedOrdinaryHttpAdapter(rejected)).rejects.toThrow(); expect(calls).toBe(0);
      return;
    }
    const adapter = await createGovernedOrdinaryHttpAdapter(factoryInput);
    const actualInvoke = adapter.invoke;
    if (mode === "attestor-expired-lockwait") adapter.invoke = async (call) => {
      const result = await actualInvoke(call);
      let locked!: () => void; const acquired = new Promise<void>((resolve) => { locked = resolve; });
      authorityLock = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM LLMSpendAuthorityRecord WHERE workspaceId=${workspaceId} AND kind='price' FOR UPDATE`;
        locked(); await new Promise((resolve) => setTimeout(resolve, 2_200));
      });
      await acquired; return result;
    };
    if (mode === "wrong-output" || mode === "wrong-cost") adapter.invoke = async (call) => {
      const result = await actualInvoke(call);
      return mode === "wrong-cost" ? { ...result, actualCostUsdMicros: result.actualCostUsdMicros! + 1 } :
        { ...result, output: { ...result.output!, rawOutput: "synthetic altered" } };
    };
    let lostAck = false;
    const installedCharge = mode === "lost-terminal-ack" ? new Proxy(charge, { get(target, property) {
      if (property === "$transaction") return async (...args: unknown[]) => {
        const result = await (target.$transaction as (...args: unknown[]) => Promise<unknown>)(...args);
        if (!lostAck && (result as { receipt?: { sequence?: number } })?.receipt?.sequence === 2) {
          lostAck = true; throw new Error("synthetic_committed_ack_lost");
        }
        return result;
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } }) : charge;
    const source = await db.recommendationLog.create({ data: { workspaceId, userId: ownerUserId,
      objectType: "COMPANY", objectId: "synthetic:usage-object", actionType: "CREATE_TASK",
      title: "Synthetic", description: "Synthetic", policyResult: "SUGGEST_ONLY", explanation: "Synthetic" } });
    process.env.LLM_ENABLED = "true"; process.env.DASHSCOPE_API_KEY = "HELM_SYNTHETIC_PROVIDER_CREDENTIAL";
    const { installOrdinaryPaidServerBootstrap: install } = await import("./ordinary-paid-server-bootstrap.service");
    const { enhanceRecommendationExplanationWithLLM: host } = await import("../llm-workflows/enhance-recommendation-explanation.workflow");
      const issueProjection = ({ operationId, projectedPayload, projectedPayloadHash }: {
        operationId: string; projectedPayload: OrdinaryPaidPayload; projectedPayloadHash: string;
      }) => projection(`evidence:usage-${operationId}`, `projection:usage-${operationId}`,
        { maxInputTokens: 8_000, maxOutputTokens: 8_192 }, assetId, new Date(),
        projectedPayloadHash, Buffer.byteLength(canonicalJson(projectedPayload), "utf8"));
      await install({ operationWriterClient: writer, chargeClient: installedCharge, policyKey: "caio-pro-default",
        spendAuthority: authority, adapters: [adapter], issueProjection });
      if (mode.startsWith("finite-")) {
        const secondWriter = new PrismaClient({ datasources: { db: { url: process.env.ORDINARY_PAID_WRITER_DATABASE_URL! } } });
        const secondCharge = new PrismaClient({ datasources: { db: { url: process.env.MODEL_EGRESS_RUNTIME_DATABASE_URL! } } });
        const secondCollector = new PrismaClient({ datasources: { db: { url: process.env.LLM_USAGE_COLLECTOR_DATABASE_URL! } } });
        additionalClients.push(secondWriter, secondCharge, secondCollector);
        // Independent process-equivalent module state and DB clients. Both
        // execute the real public host/bootstrap/gateway, not a fake reserve.
        const secondAdapter = await createGovernedOrdinaryHttpAdapter({ ...factoryInput,
          collectorClient: secondCollector, chargeClient: secondCharge, operationWriterClient: secondWriter });
        vi.resetModules();
        const { installOrdinaryPaidServerBootstrap: secondInstall } = await import("./ordinary-paid-server-bootstrap.service");
        const { enhanceRecommendationExplanationWithLLM: secondHost } = await import("../llm-workflows/enhance-recommendation-explanation.workflow");
        await secondInstall({ operationWriterClient: secondWriter, chargeClient: secondCharge,
          policyKey: "caio-pro-default", spendAuthority: authority, adapters: [secondAdapter], issueProjection });
        const secondSource = await db.recommendationLog.create({ data: { workspaceId, userId: ownerUserId,
          objectType: "COMPANY", objectId: "synthetic:second-usage-object", actionType: "CREATE_TASK",
          title: "Synthetic", description: "Synthetic", policyResult: "SUGGEST_ONLY", explanation: "Synthetic" } });
        const firstInput = { workspaceId, userId: ownerUserId, objectLabel: "Synthetic", recommendationTitle: "Synthetic",
          recommendationDescription: "Synthetic", deterministicExplanation: "Synthetic", policyResultLabel: "Suggest only",
          fallback, recommendationLogId: source.id };
        const secondInput = { ...firstInput, recommendationLogId: secondSource.id };
        let results: Array<Awaited<ReturnType<typeof host>> | null>;
        if (mode === "finite-concurrent") {
          const pending = [host(firstInput).catch(() => null), secondHost(secondInput).catch(() => null)];
          let timer!: ReturnType<typeof setTimeout>;
          try {
            // Keep the winning HTTP response held until the losing full host
            // has returned, so actual settlement cannot free its reservation.
            const loser = await Promise.race([...pending, new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("synthetic_finite_race_unresolved")), 4_000);
            })]);
            expect(loser?.success ?? false).toBe(false); expect(calls).toBe(1);
            const held = await charge.lLMSpendPeriodCounter.findFirstOrThrow({ where: { workspaceId } });
            expect(held.reservedMicros).toBe(BigInt(1_536)); expect(held.settledMicros).toBe(BigInt(0));
            expect(held.unknownBoundMicros).toBe(BigInt(0));
          } finally { clearTimeout(timer); releaseHttp(); await Promise.all(pending); }
          results = await Promise.all(pending);
          expect(results.filter((result) => result?.success)).toHaveLength(1);
        } else {
          results = [await host(firstInput).catch(() => null), await secondHost(secondInput).catch(() => null)];
          expect(results.every((result) => !result?.success)).toBe(true);
        }
        const decisions = await charge.modelRouteDecision.findMany({ where: { workspaceId } });
        expect(decisions).toHaveLength(2); expect(new Set(decisions.map((decision) => decision.id)).size).toBe(2);
        const ledgers = await charge.lLMSpendLedgerEntry.findMany({ where: { workspaceId } });
        expect(ledgers).toHaveLength(1); expect(ledgers[0].maximumChargeMicros).toBe(BigInt(1_536));
        expect(ledgers[0].budgetMode).toBe("limited"); expect(ledgers[0].budgetLimitMicros).toBe(BigInt(1_536));
        const blocked = decisions.find((decision) => !decision.dispatchProviderIdempotencyKey);
        expect(blocked).toBeDefined();
        expect(decisions.filter((decision) => decision.dispatchProviderIdempotencyKey)).toHaveLength(1);
        expect(decisions.every((decision) => decision.requestedMaxOutputTokens === 1_536)).toBe(true);
        const counter = await charge.lLMSpendPeriodCounter.findFirstOrThrow({ where: { workspaceId } });
        expect(counter.budgetMode).toBe("limited"); expect(counter.budgetLimitMicros).toBe(BigInt(1_536));
        expect(counter.reservedMicros).toBe(BigInt(0));
        expect(counter.settledMicros).toBe(BigInt(mode === "finite-concurrent" ? 10 : 0));
        expect(counter.unknownBoundMicros).toBe(BigInt(mode === "finite-unknown" ? 1_536 : 0));
        expect(counter.unknownCalls).toBe(mode === "finite-unknown" ? 1 : 0);
        expect(ledgers[0].state).toBe(mode === "finite-concurrent" ? "settled" : "unknown");
        expect(ledgers[0].observedActualMicros).toBe(mode === "finite-concurrent" ? BigInt(10) : null);
        expect(calls).toBe(1);
        expect(await db.lLMTrustedUsageEvidence.count({ where: { workspaceId } })).toBe(mode === "finite-concurrent" ? 1 : 0);
        expect(await charge.modelEgressReceipt.count({ where: { workspaceId, sequence: 2 } })).toBe(mode === "finite-concurrent" ? 1 : 0);
        console.info("synthetic finite usage", { mode, calls, independentClients: 2, decisions: decisions.length,
          budgetLimitMicros: String(counter.budgetLimitMicros), reservedMicros: String(counter.reservedMicros),
          settledMicros: String(counter.settledMicros), unknownBoundMicros: String(counter.unknownBoundMicros),
          evidence: mode === "finite-concurrent" ? 1 : 0, terminalSequence2: mode === "finite-concurrent" ? 1 : 0 });
        return;
      }
      let result: Awaited<ReturnType<typeof host>> | null = null;
      let failure = "none";
      try { result = await host({ workspaceId, userId: ownerUserId, objectLabel: "Synthetic", recommendationTitle: "Synthetic",
        recommendationDescription: "Synthetic", deterministicExplanation: "Synthetic", policyResultLabel: "Suggest only",
        fallback, recommendationLogId: source.id }); } catch (error) { failure = error instanceof Error ? error.message : "unknown"; }
      const decision = await charge.modelRouteDecision.findFirstOrThrow({ where: { workspaceId } });
      expect(decision.dispatchProviderIdempotencyKey, `synthetic_dispatch:${failure}:${decision.reasonCodes}`).not.toBeNull();
      const ledger = await charge.lLMSpendLedgerEntry.findUniqueOrThrow({ where: { workspaceId_attemptRef: {
        workspaceId, attemptRef: decision.dispatchProviderIdempotencyKey! } } });
      console.info("synthetic usage baseline", { calls, failure, ledgerState: ledger.state,
        terminals: await charge.modelEgressReceipt.count({ where: { workspaceId, sequence: 2 } }) });
      expect(calls).toBe(1);
      const evidenceCount = await db.lLMTrustedUsageEvidence.count({ where: { workspaceId } });
      const terminalCount = await charge.modelEgressReceipt.count({ where: { workspaceId, sequence: 2 } });
      if (mode === "valid" || mode === "lost-terminal-ack") {
        expect(ledger.state).toBe("settled"); expect(ledger.observedActualMicros).toBe(BigInt(10));
        expect(evidenceCount).toBe(1); expect(terminalCount).toBe(1);
        if (mode === "valid") { expect(result?.success).toBe(true); expect(result?.output.explanation).toBe("charged synthetic"); }
        else {
          expect(lostAck).toBe(true);
          // Replaying the same ordinary source never sends a second transport.
          await host({ workspaceId, userId: ownerUserId, objectLabel: "Synthetic", recommendationTitle: "Synthetic",
            recommendationDescription: "Synthetic", deterministicExplanation: "Synthetic", policyResultLabel: "Suggest only", fallback, recommendationLogId: source.id }).catch(() => null);
          expect(calls).toBe(1); expect(await charge.modelEgressReceipt.count({ where: { workspaceId, sequence: 2 } })).toBe(1);
        }
      } else {
        expect(ledger.state).toBe("unknown"); expect(terminalCount).toBe(0); expect(result?.success ?? false).toBe(false);
        expect(ledger.observedActualMicros).toBeNull(); expect(evidenceCount).toBe(mode.startsWith("wrong-") || mode === "collector-ack-loss" || mode === "attestor-expired-lockwait" ? 1 : 0);
        if (mode.startsWith("collector-")) {
          expect(collectorAckLost).toBe(mode === "collector-ack-loss");
          await host({ workspaceId, userId: ownerUserId, objectLabel: "Synthetic", recommendationTitle: "Synthetic", recommendationDescription: "Synthetic", deterministicExplanation: "Synthetic", policyResultLabel: "Suggest only", fallback, recommendationLogId: source.id }).catch(() => null);
          expect(calls).toBe(1); expect(await charge.modelEgressReceipt.count({ where: { workspaceId, sequence: 2 } })).toBe(0);
        }
        const counter = await charge.lLMSpendPeriodCounter.findFirstOrThrow({ where: { workspaceId } });
        expect(counter.unknownBoundMicros).toBe(ledger.reservedMicros);
      }
      if (mode === "valid") {
        await expect(writer.$queryRaw`SELECT id FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow();
        await expect(charge.$executeRaw`DELETE FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow();
        await expect(collector.$executeRaw`UPDATE LLMSpendLedgerEntry SET observedActualMicros=0 WHERE workspaceId=${workspaceId}`).rejects.toThrow();
        await expect(collector.$executeRaw`UPDATE LLMUsageAttestorGrant SET revokedAt=UTC_TIMESTAMP(3) WHERE id=${grant.id}`).rejects.toThrow();
        await expect(db.$executeRaw`UPDATE LLMTrustedUsageEvidence SET promptTokens=0 WHERE workspaceId=${workspaceId}`).rejects.toThrow("usage_evidence_immutable");
        await expect(db.$executeRaw`DELETE FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow("usage_evidence_no_delete");
        await expect(charge.$executeRaw`INSERT INTO LLMTrustedUsageEvidence(id,workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens)
          SELECT 'synthetic:denied',workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow();
        await expect(collector.$executeRaw`INSERT INTO LLMUsageAttestorGrant(id,workspaceId,envelopeJson,contentHash) VALUES ('synthetic:denied',${workspaceId},${canonicalAuthorityJson(grant)},${authorityHash(grant)})`).rejects.toThrow();
        const foreignDecision = await db.modelRouteDecision.findFirstOrThrow({ where: { workspaceId: { not: workspaceId } }, select: { id: true } });
        await expect(db.$executeRaw`INSERT INTO LLMTrustedUsageEvidence(id,workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens)
          SELECT 'synthetic:cross-scope',workspaceId,${foreignDecision.id},'synthetic:cross-scope',grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow("LLMTrustedUsageEvidence_decision_fk");
        await db.$transaction(async (tx) => {
          const [prior] = await tx.$queryRaw<Array<{ mode: string }>>`SELECT @@sql_mode AS mode`;
          try {
            await tx.$executeRawUnsafe("SET SESSION sql_mode=''");
            for (const invalid of [BigInt(-1), BigInt(2_147_483_648), BigInt("9223372036854775808")]) {
              await expect(tx.$executeRaw`INSERT INTO LLMTrustedUsageEvidence(id,workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens)
                SELECT 'synthetic:bounds',workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,CAST(${String(invalid)} AS DECIMAL(65,0)),completionTokens FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow("LLMTrustedUsageEvidence_units");
            }
          await expect(tx.$executeRaw`INSERT INTO LLMTrustedUsageEvidence(id,workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens)
              SELECT 'synthetic:null-units',workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,NULL,completionTokens FROM LLMTrustedUsageEvidence WHERE workspaceId=${workspaceId}`).rejects.toThrow("LLMTrustedUsageEvidence_units_json");
          } finally { await tx.$executeRaw`SET SESSION sql_mode=${prior.mode}`; }
        });
      }
    } finally {
      if (oldEnabled === undefined) delete process.env.LLM_ENABLED; else process.env.LLM_ENABLED = oldEnabled;
      if (oldKey === undefined) delete process.env.DASHSCOPE_API_KEY; else process.env.DASHSCOPE_API_KEY = oldKey;
      releaseHttp();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (authorityLock) await authorityLock;
      await Promise.all([writer.$disconnect(), charge.$disconnect(), collector.$disconnect(), ...additionalClients.map((client) => client.$disconnect())]);
    }
  });


});
