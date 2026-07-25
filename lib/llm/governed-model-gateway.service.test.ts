import { describe, expect, it, vi } from "vitest";

import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  GovernedModelGatewayError,
  createGovernedModelGateway,
  type GovernedModelAdapterResult,
  type GovernedModelGatewayDependencies,
  type GovernedModelGatewayInput,
  type GovernedModelProviderAdapter,
} from "@/lib/llm/governed-model-gateway.service";
import {
  computeGovernedModelProjectionReceiptHash,
  computeModelProviderIdempotencyKey,
} from "@/lib/llm/model-egress-contracts";
import type {
  GovernedModelProjectionReceipt,
  ModelEgressReceipt,
  ModelRouteDecision,
} from "@/lib/llm/model-egress-contracts";
import {
  computeGovernedModelAdapterRegistrationHash,
  type GovernedModelAdapterRegistration,
  type TenantModelRoute,
} from "@/lib/llm/model-route-contracts";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
const BASE_TIME = Date.parse("2026-07-23T12:00:00.000Z");

type Payload = {
  readonly question: string;
  readonly facts: readonly string[];
};
type Output = { readonly answer: string };
const PROJECTED_PAYLOAD: Payload = {
  question: "What blocks the synthetic plan?",
  facts: ["Synthetic fact only"],
};

function projectionReceipt(): GovernedModelProjectionReceipt {
  const serialized = canonicalJson(PROJECTED_PAYLOAD);
  const candidate: GovernedModelProjectionReceipt = {
    schemaVersion:
      "helm.governed-model-projection-receipt/v1",
    receiptId: "projection:synthetic-gateway",
    workspaceRef: "workspace:workspace-test",
    idempotencyKey: "projection-synthetic-gateway",
    sourceAssetRefs: ["asset:synthetic"],
    sourceAssetBindings: [
      {
        assetRef: "asset:synthetic",
        assetVersion: 3,
        inventoryStatus: "confirmed",
        classificationStatus: "classified",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        classificationReceiptRef: "classification-synthetic",
        classificationReceiptHash: HASH_A,
        authorizationStatus: "authorized",
        authorizationReceiptRef: "authorization-synthetic",
        authorizationReceiptHash: HASH_B,
        authorizationValidFrom: "2026-07-23T11:00:00.000Z",
        authorizationValidUntil: "2026-07-24T12:00:00.000Z",
      },
    ],
    candidateEvidenceRefs: ["evidence:synthetic"],
    selectedEvidenceRefs: ["evidence:synthetic"],
    droppedEvidenceRefs: [],
    projectedPayloadHash: sha256(serialized),
    projectedPayloadBytes: Buffer.byteLength(serialized, "utf8"),
    maxInputTokens: 2_000,
    maxOutputTokens: 500,
    remoteSafe: true,
    redactionStatus: "synthetic",
    promptInjectionScanStatus: "passed",
    projectorRegistrationRef: "projector:synthetic-gateway",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "v1",
    scannerRegistrationRef: "scanner:synthetic-gateway",
    scannerRegistrationHash: HASH_B,
    scannerVersion: "v1",
    validUntil: "2026-07-24T12:00:00.000Z",
    createdAt: "2026-07-23T11:59:00.000Z",
    rawContentIncluded: false,
    authorityEffect: "evidence_only",
    contentHash: HASH_C,
  };
  return {
    ...candidate,
    contentHash:
      computeGovernedModelProjectionReceiptHash(candidate),
  };
}

function route(
  routeId: string,
  fallbackRouteIds: readonly string[] = [],
): TenantModelRoute {
  return {
    routeId,
    provider: "synthetic-provider",
    modelId: "synthetic-model",
    modelVersion: "synthetic-model-20260723",
    adapterKey: `adapter-${routeId}`,
    readinessReceiptRef: `readiness:${routeId}`,
    readinessReceiptHash: HASH_A,
    credentialRef: `secret:tenant/${routeId}`,
    governanceProfileRef: "governance:synthetic",
    governanceProfileHash: HASH_A,
    projectorRegistrationRef: "projector:synthetic-gateway",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "v1",
    scannerRegistrationRef: "scanner:synthetic-gateway",
    scannerRegistrationHash: HASH_B,
    scannerVersion: "v1",
    deploymentForm: "local",
    jurisdiction: "customer_premises",
    region: "local-test",
    allowedTaskClasses: ["summary_briefing"],
    maximumSensitivity: "restricted",
    allowedProcessingDispositions: [
      "local_only",
      "remote_projected",
    ],
    retentionDays: 0,
    trainingUse: "prohibited",
    termsAssurance: "dedicated_no_retention",
    providerTermsRef: "terms:synthetic",
    providerTermsHash: HASH_B,
    deletionTermsRef: "terms:synthetic-delete",
    deletionTermsHash: HASH_C,
    pricingTermsRef: "pricing:synthetic-202607",
    pricingTermsHash: HASH_A,
    pricingVersion: "synthetic-pricing-202607",
    maxInputTokens: 2_000,
    maxOutputTokens: 500,
    maxCostUsdMicros: 100_000,
    maxLatencyMs: 10_000,
    maxConcurrency: 2,
    fallbackRouteIds,
  };
}

function adapterRegistration(
  selectedRoute: TenantModelRoute,
): GovernedModelAdapterRegistration {
  const candidate: GovernedModelAdapterRegistration = {
    schemaVersion:
      "helm.governed-model-adapter-registration/v1",
    registrationRef:
      `adapter-registration:${selectedRoute.adapterKey}`,
    adapterKey: selectedRoute.adapterKey,
    adapterVersion: "synthetic-adapter-v1",
    provider: selectedRoute.provider,
    implementationHash: HASH_B,
    supportedDeploymentForms: [
      selectedRoute.deploymentForm,
    ],
    authorityEffect: "adapter_registry_only",
    contentHash: HASH_A,
  };
  return {
    ...candidate,
    contentHash:
      computeGovernedModelAdapterRegistrationHash(candidate),
  };
}

function storedRuntime(selectedRoute: TenantModelRoute) {
  const registration = adapterRegistration(selectedRoute);
  return {
    provider: selectedRoute.provider,
    modelId: selectedRoute.modelId,
    modelVersion: selectedRoute.modelVersion,
    adapterKey: registration.adapterKey,
    adapterVersion: registration.adapterVersion,
    adapterRegistrationRef: registration.registrationRef,
    adapterRegistrationHash: registration.contentHash,
    deploymentForm: selectedRoute.deploymentForm,
    jurisdiction: selectedRoute.jurisdiction,
    region: selectedRoute.region,
    endpointFingerprint: HASH_C,
    credentialRef: selectedRoute.credentialRef,
    adapterRegistered: true,
    credentialConfigured: true,
    observedAt: "2026-07-23T12:00:00.000Z",
  } as const;
}

function decision(input: {
  decisionId: string;
  selectedRoute: TenantModelRoute | null;
  parentDecisionRef?: string | null;
  blockedReason?: string;
  requestedMaxOutputTokens?: number;
  allowFallback?: boolean;
}): ModelRouteDecision {
  const allowed = input.selectedRoute !== null;
  return {
    schemaVersion: "helm.model-route-decision/v1",
    decisionId: input.decisionId,
    workspaceRef: "workspace:workspace-test",
    requestKey: `request:${input.decisionId}`,
    requestHash: HASH_A,
    attemptOrdinal: input.parentDecisionRef ? 1 : 0,
    parentDecisionRef: input.parentDecisionRef ?? null,
    policyKey: "caio-default",
    policyRef: allowed ? "policy:caio-default-v1" : "",
    policyHash: HASH_A,
    policyHeadVersion: allowed ? 1 : 0,
    policyRevocationEpoch: 0,
    readinessReceiptRef: allowed
      ? input.selectedRoute!.readinessReceiptRef
      : null,
    readinessReceiptHash: allowed
      ? input.selectedRoute!.readinessReceiptHash
      : null,
    taskClass: "summary_briefing",
    taskRef: "briefing:synthetic",
    sensitivity: "confidential",
    processingDisposition: "local_only",
    classificationReasonCodes: [],
    sourceAssetRefs: ["asset:synthetic"],
    sourceAssetBindings: [
      {
        assetRef: "asset:synthetic",
        assetVersion: 3,
        inventoryStatus: "confirmed",
        classificationStatus: "classified",
        sensitivity: "confidential",
        processingDisposition: "local_only",
        classificationReceiptRef: "classification-synthetic",
        classificationReceiptHash: HASH_A,
        authorizationStatus: "authorized",
        authorizationReceiptRef: "authorization-synthetic",
        authorizationReceiptHash: HASH_B,
        authorizationValidFrom: "2026-07-23T11:00:00.000Z",
        authorizationValidUntil: "2026-07-24T12:00:00.000Z",
      },
    ],
    candidateEvidenceRefs: ["evidence:synthetic"],
    selectedEvidenceRefs: ["evidence:synthetic"],
    droppedEvidenceRefs: [],
    projectionReceiptRef: null,
    projectionReceiptHash: null,
    projectedPayloadHash: HASH_C,
    promptInjectionScanStatus: "passed",
    requestedMaxOutputTokens:
      input.requestedMaxOutputTokens ?? 200,
    allowFallback: input.allowFallback ?? false,
    routeRef: input.selectedRoute?.routeId ?? null,
    routeSnapshot: input.selectedRoute,
    adapterReadinessState: allowed ? "ready" : "unknown",
    catalogVisibilityState: "unknown",
    decision: allowed ? "allowed" : "blocked",
    reasonCodes: allowed
      ? []
      : [input.blockedReason ?? "no_active_model_route_policy"],
    requestedFallbackRouteRef:
      input.parentDecisionRef && input.selectedRoute
        ? input.selectedRoute.routeId
        : null,
    fallbackFromRouteRef: input.parentDecisionRef
      ? "primary"
      : null,
    fallbackReason: input.parentDecisionRef
      ? "provider_unavailable"
      : null,
    validUntil: "2026-07-23T13:00:00.000Z",
    createdAt: "2026-07-23T12:00:00.000Z",
    rawContentIncluded: false,
    authorityEffect: "model_egress_only",
    contentHash: HASH_B,
  };
}

function startedReceipt(
  selectedDecision: ModelRouteDecision,
): ModelEgressReceipt {
  const selectedRoute = selectedDecision.routeSnapshot!;
  return {
    schemaVersion: "helm.model-egress-receipt/v1",
    receiptId: `receipt:started-${selectedDecision.decisionId}`,
    workspaceRef: selectedDecision.workspaceRef,
    decisionRef: selectedDecision.decisionId,
    previousReceiptRef: null,
    previousReceiptHash: null,
    sequence: 1,
    idempotencyKey: `started-${selectedDecision.decisionId}`,
    phase: "dispatch_started",
    outcome: "unknown",
    resolutionSource: "none",
    requestDisposition: "unknown",
    provider: selectedRoute.provider,
    modelId: selectedRoute.modelId,
    modelVersion: selectedRoute.modelVersion,
    deploymentForm: selectedRoute.deploymentForm,
    jurisdiction: selectedRoute.jurisdiction,
    region: selectedRoute.region,
    policyHash: selectedDecision.policyHash,
    readinessReceiptHash:
      selectedDecision.readinessReceiptHash!,
    projectedPayloadHash:
      selectedDecision.projectedPayloadHash,
    selectedEvidenceRefs:
      selectedDecision.selectedEvidenceRefs,
    droppedEvidenceRefs: selectedDecision.droppedEvidenceRefs,
    projectionReceiptRef:
      selectedDecision.projectionReceiptRef,
    projectionReceiptHash:
      selectedDecision.projectionReceiptHash,
    rawContentIncluded: false,
    dispatchGatewayRef: null,
    dispatchRuntimeHash: null,
    dispatchClaimHash: null,
    providerRequestRefHash: null,
    startedAt: "2026-07-23T12:00:00.000Z",
    finishedAt: null,
    latencyMs: null,
    promptTokens: null,
    completionTokens: null,
    actualCostUsdMicros: null,
    costCurrency: null,
    pricingVersion: null,
    costBand: "unknown",
    errorCode: null,
    fallbackTargetRouteRef: null,
    fallbackReason: null,
    auditRef: `audit:started-${selectedDecision.decisionId}`,
    recordedAt: "2026-07-23T12:00:00.000Z",
    authorityEffect: "evidence_only",
    contentHash: HASH_A,
  };
}

function buildTerminal(
  selectedDecision: ModelRouteDecision,
  started: ModelEgressReceipt,
  input: Parameters<
    GovernedModelGatewayDependencies["recordTerminal"]
  >[0],
): ModelEgressReceipt {
  return {
    ...started,
    receiptId: `receipt:terminal-${selectedDecision.decisionId}`,
    previousReceiptRef: started.receiptId,
    previousReceiptHash: started.contentHash,
    sequence: 2,
    idempotencyKey: input.idempotencyKey,
    phase: "terminal",
    outcome: input.outcome,
    resolutionSource: input.resolutionSource,
    requestDisposition: input.requestDisposition,
    dispatchGatewayRef: input.gatewayRef,
    dispatchRuntimeHash: HASH_B,
    dispatchClaimHash: input.dispatchClaimHash,
    providerRequestRefHash: input.providerRequestRefHash,
    finishedAt: input.finishedAt.toISOString(),
    latencyMs: input.latencyMs,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    actualCostUsdMicros: input.actualCostUsdMicros,
    costCurrency: input.costCurrency,
    pricingVersion: input.pricingVersion,
    costBand: input.costBand,
    errorCode: input.errorCode,
    fallbackTargetRouteRef:
      input.fallbackTargetRouteRef ?? null,
    fallbackReason: input.fallbackReason ?? null,
    auditRef: `audit:terminal-${selectedDecision.decisionId}`,
    recordedAt: (
      input.recordedAt ?? input.finishedAt
    ).toISOString(),
    contentHash: HASH_C,
  };
}

function createHarness(input: {
  blocked?: boolean;
  preclaimed?: boolean;
  preclaimedLeaseExpired?: boolean;
  terminalWriteFails?: boolean;
}) {
  const primary = route("primary", ["fallback"]);
  const fallback = route("fallback");
  const storedProjection = projectionReceipt();
  const decisions = new Map<string, ModelRouteDecision>();
  const receipts = new Map<string, ModelEgressReceipt[]>();
  const claims = new Map<
    string,
    {
      claimedAt: string;
      gatewayRef: string;
      runtime: ReturnType<typeof storedRuntime>;
      runtimeHash: string;
      claimHash: string;
      providerIdempotencyKey: string;
      leaseExpiresAt: string;
    }
  >();
  let tick = 0;
  const now = () => new Date(BASE_TIME + tick++ * 10);

  const prepareDecision = vi.fn<
    GovernedModelGatewayDependencies["prepareDecision"]
  >(async (request) => {
    const isFallback = Boolean(request.parentDecisionRef);
    const selectedRoute = input.blocked
      ? null
      : isFallback
        ? fallback
        : primary;
    const decisionId = isFallback
      ? "decision-fallback"
      : "decision-primary";
    const selectedDecision = decision({
      decisionId,
      selectedRoute,
      parentDecisionRef: request.parentDecisionRef,
      requestedMaxOutputTokens:
        request.requestedMaxOutputTokens,
      allowFallback: request.allowFallback,
    });
    selectedDecision.projectedPayloadHash =
      request.projectedPayloadHash;
    selectedDecision.projectionReceiptRef =
      request.projectionReceiptRef;
    selectedDecision.projectionReceiptHash =
      storedProjection.contentHash;
    decisions.set(decisionId, selectedDecision);
    const started = selectedRoute
      ? startedReceipt(selectedDecision)
      : null;
    receipts.set(decisionId, started ? [started] : []);
    if (input.preclaimed && !isFallback) {
      const runtime = storedRuntime(primary);
      const claimHash = HASH_C;
      claims.set(decisionId, {
        claimedAt: now().toISOString(),
        gatewayRef: "gateway:caio",
        runtime,
        runtimeHash: sha256(canonicalJson(runtime)),
        claimHash,
        providerIdempotencyKey:
          computeModelProviderIdempotencyKey({
            decisionRef: decisionId,
            dispatchClaimHash: claimHash,
          }),
        leaseExpiresAt: new Date(
          BASE_TIME +
            (input.preclaimedLeaseExpired
              ? -1_000
              : 60_000),
        ).toISOString(),
      });
    }
    return {
      decision: selectedDecision,
      startedReceipt: started,
      replayed: false,
    };
  });
  const readProjectionReceipt = vi.fn<
    GovernedModelGatewayDependencies["readProjectionReceipt"]
  >(async ({ workspaceId, receiptId }) =>
    workspaceId === "workspace-test" &&
    receiptId === storedProjection.receiptId
      ? storedProjection
      : null,
  );
  const readDecision = vi.fn<
    GovernedModelGatewayDependencies["readDecision"]
  >(async ({ decisionId }) => {
    const selectedDecision = decisions.get(decisionId);
    if (!selectedDecision) return null;
    return {
      decision: selectedDecision,
      dispatch: claims.get(decisionId) ?? null,
      receipts: receipts.get(decisionId) ?? [],
    };
  });
  const claimDispatch = vi.fn<
    GovernedModelGatewayDependencies["claimDispatch"]
  >(async (request) => {
    const selectedDecision = decisions.get(request.decisionId)!;
    const started = receipts.get(request.decisionId)![0];
    const existing = claims.get(request.decisionId);
    if (existing) {
      return {
        decision: selectedDecision,
        startedReceipt: started,
        runtimeHash: existing.runtimeHash,
        claimHash: existing.claimHash,
        providerIdempotencyKey:
          existing.providerIdempotencyKey,
        claimedAt: existing.claimedAt,
        leaseExpiresAt: existing.leaseExpiresAt,
        replayed: true,
      };
    }
    const claim = {
      claimedAt: (request.now ?? now()).toISOString(),
      gatewayRef: request.gatewayRef,
      runtime: request.runtime,
      runtimeHash: sha256(canonicalJson(request.runtime)),
      claimHash: HASH_C,
      providerIdempotencyKey:
        computeModelProviderIdempotencyKey({
          decisionRef: request.decisionId,
          dispatchClaimHash: HASH_C,
        }),
      leaseExpiresAt: new Date(
        (request.now ?? new Date(BASE_TIME)).getTime() +
          60_000,
      ).toISOString(),
    };
    claims.set(request.decisionId, claim);
    return {
      decision: selectedDecision,
      startedReceipt: started,
      runtimeHash: claim.runtimeHash,
      claimHash: claim.claimHash,
      providerIdempotencyKey:
        claim.providerIdempotencyKey,
      claimedAt: claim.claimedAt,
      leaseExpiresAt: claim.leaseExpiresAt,
      replayed: false,
    };
  });
  const recordTerminal = vi.fn<
    GovernedModelGatewayDependencies["recordTerminal"]
  >(async (request) => {
    if (input.terminalWriteFails) {
      throw new Error("synthetic write failure");
    }
    const selectedDecision = decisions.get(request.decisionId)!;
    const started = receipts.get(request.decisionId)![0];
    const terminal = buildTerminal(
      selectedDecision,
      started,
      request,
    );
    receipts.set(request.decisionId, [started, terminal]);
    return { receipt: terminal, replayed: false };
  });

  return {
    primary,
    fallback,
    decisions,
    receipts,
    claims,
    storedProjection,
    dependencies: {
      prepareDecision,
      readProjectionReceipt,
      readDecision,
      claimDispatch,
      recordTerminal,
      now,
    } satisfies GovernedModelGatewayDependencies,
  };
}

function adapter(input: {
  selectedRoute: TenantModelRoute;
  result:
    | GovernedModelAdapterResult<Output>
    | (() => Promise<GovernedModelAdapterResult<Output>>);
  estimatedInputTokens?: number;
  reconciliation?: GovernedModelProviderAdapter<
    Payload,
    Output
  >["reconcile"];
}): GovernedModelProviderAdapter<Payload, Output> {
  const registration = adapterRegistration(input.selectedRoute);
  return {
    registration,
    probeReadiness: vi.fn(async () => ({
      endpointFingerprint: HASH_C,
      credentialConfigured: true,
      modelProbeStatus: "ready",
      capabilityRefs: ["capability:synthetic"],
      evidenceRefs: ["evidence:synthetic-readiness"],
      checkedAt: "2026-07-23T12:00:00.000Z",
      expiresAt: "2026-07-23T13:00:00.000Z",
    })),
    preflight: vi.fn(async () => ({
      endpointFingerprint: HASH_C,
      credentialConfigured: true,
      observedAt: "2026-07-23T12:00:00.000Z",
      estimatedInputTokens:
        input.estimatedInputTokens ?? 100,
      estimatedMaxCostUsdMicros: 1_000,
    })),
    invoke: vi.fn(async () =>
      typeof input.result === "function"
        ? input.result()
        : input.result,
    ),
    reconcile: input.reconciliation,
  };
}

function request(): GovernedModelGatewayInput<Payload> {
  return {
    workspaceId: "workspace-test",
    gatewayRef: "gateway:caio",
    policyKey: "caio-default",
    requestKey: "request:owner-briefing-1",
    taskClass: "summary_briefing",
    taskRef: "briefing:owner-1",
    projectionReceiptRef: "projection:synthetic-gateway",
    projectedPayload: PROJECTED_PAYLOAD,
    requestedMaxOutputTokens: 200,
  };
}

const successResult: GovernedModelAdapterResult<Output> = {
  outcome: "success",
  output: { answer: "Synthetic answer" },
  requestDisposition: "accepted",
  providerRequestRef: "provider-request-sensitive-123",
  promptTokens: 100,
  completionTokens: 20,
  actualCostUsdMicros: 12_500,
  costCurrency: "USD",
  pricingVersion: "synthetic-pricing-202607",
  costBand: "low",
  errorCode: null,
};

describe("governed model gateway", () => {
  it("does not preflight or invoke a registered adapter for a blocked decision", async () => {
    const harness = createHarness({ blocked: true });
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("blocked");
    expect(result.output).toBeNull();
    expect(selectedAdapter.preflight).not.toHaveBeenCalled();
    expect(selectedAdapter.invoke).not.toHaveBeenCalled();
    expect(
      harness.dependencies.claimDispatch,
    ).not.toHaveBeenCalled();
  });

  it("persists the terminal receipt before exposing output and hashes the provider reference", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
    });
    const order: string[] = [];
    vi.mocked(selectedAdapter.invoke).mockImplementation(
      async () => {
        order.push("invoke");
        return successResult;
      },
    );
    vi.mocked(
      harness.dependencies.recordTerminal,
    ).mockImplementation(async (terminalInput) => {
      order.push("terminal");
      const selectedDecision =
        harness.decisions.get(terminalInput.decisionId)!;
      const started =
        harness.receipts.get(terminalInput.decisionId)![0];
      const terminal = buildTerminal(
        selectedDecision,
        started,
        terminalInput,
      );
      harness.receipts.set(terminalInput.decisionId, [
        started,
        terminal,
      ]);
      return { receipt: terminal, replayed: false };
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    order.push("returned");
    expect(order).toEqual(["invoke", "terminal", "returned"]);
    expect(result.status).toBe("success");
    expect(result.output).toEqual(successResult.output);
    expect(result.rawContentPersisted).toBe(false);
    const terminalInput = vi.mocked(
      harness.dependencies.recordTerminal,
    ).mock.calls[0]![0];
    expect(terminalInput.providerRequestRefHash).toBe(
      sha256("provider-request-sensitive-123"),
    );
    expect(terminalInput.resolutionSource).toBe("invoke");
    expect(terminalInput.actualCostUsdMicros).toBe(12_500);
    expect(terminalInput.costCurrency).toBe("USD");
    expect(terminalInput.pricingVersion).toBe(
      harness.primary.pricingVersion,
    );
    expect(JSON.stringify(terminalInput)).not.toContain(
      "provider-request-sensitive-123",
    );
    expect(JSON.stringify(terminalInput)).not.toContain(
      "Synthetic fact only",
    );
    expect(JSON.stringify(terminalInput)).not.toContain(
      "Synthetic answer",
    );
  });

  it("withholds a successful output when the terminal receipt cannot be persisted", async () => {
    const harness = createHarness({
      terminalWriteFails: true,
    });
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    await expect(
      gateway(request()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GovernedModelGatewayError>>({
        code: "terminal_receipt_persistence_failed_output_withheld",
        decisionRef: "decision-primary",
      }),
    );
  });

  it("does not hash or expose an oversized provider request reference", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        providerRequestRef: "x".repeat(4_097),
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.attempts[0]?.reasonCode).toBe(
      "adapter_provider_request_ref_invalid",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("withholds adapter output that is not governed JSON", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        output: new Date(
          "2026-07-23T12:00:00.000Z",
        ) as unknown as Output,
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.attempts[0]?.reasonCode).toBe(
      "adapter_output_not_governed_json",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("withholds output when actual prompt usage exceeds the selected route", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        promptTokens: harness.primary.maxInputTokens + 1,
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.attempts[0]?.reasonCode).toBe(
      "provider_input_budget_exceeded",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("withholds output when actual cost exceeds the owner-approved route budget", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        actualCostUsdMicros:
          harness.primary.maxCostUsdMicros + 1,
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.attempts[0]?.reasonCode).toBe(
      "provider_cost_budget_exceeded",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("withholds output when provider pricing evidence is missing or mismatched", async () => {
    const harness = createHarness({});
    const missingPricing = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        actualCostUsdMicros: null,
        costCurrency: null,
        pricingVersion: null,
      },
    });
    const wrongVersion = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        pricingVersion: "synthetic-pricing-202608",
      },
    });

    const missingResult = await createGovernedModelGateway({
      adapters: [missingPricing],
      dependencies: harness.dependencies,
    })(request());
    expect(missingResult.status).toBe("in_doubt");
    expect(missingResult.attempts[0]?.reasonCode).toBe(
      "provider_pricing_evidence_invalid",
    );

    const secondHarness = createHarness({});
    const mismatchedResult = await createGovernedModelGateway({
      adapters: [wrongVersion],
      dependencies: secondHarness.dependencies,
    })(request());
    expect(mismatchedResult.status).toBe("in_doubt");
    expect(mismatchedResult.attempts[0]?.reasonCode).toBe(
      "provider_pricing_evidence_invalid",
    );
    expect(
      secondHarness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("normalizes an invalid provider request disposition without attempting fallback", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        outcome: "failure",
        requestDisposition:
          "retryable" as unknown as "not_accepted",
        providerRequestRef: null,
        promptTokens: 100,
        completionTokens: 0,
        actualCostUsdMicros: 0,
        costCurrency: "USD",
        pricingVersion: "synthetic-pricing-202607",
        costBand: "zero",
        errorCode: "provider_unavailable",
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });
    const gatewayRequest = request();
    gatewayRequest.allowFallback = true;

    const result = await gateway(gatewayRequest);

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.fallbackAttempted).toBe(false);
    expect(result.attempts[0]?.reasonCode).toBe(
      "adapter_request_disposition_unknown",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("keeps an explicit unknown provider acceptance state in doubt", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        outcome: "failure",
        requestDisposition: "unknown",
        providerRequestRef: null,
        promptTokens: 100,
        completionTokens: 0,
        actualCostUsdMicros: 0,
        costCurrency: "USD",
        pricingVersion: "synthetic-pricing-202607",
        costBand: "zero",
        errorCode: "provider_acceptance_unknown",
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });
    const gatewayRequest = request();
    gatewayRequest.allowFallback = true;

    const result = await gateway(gatewayRequest);

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.fallbackAttempted).toBe(false);
    expect(result.attempts[0]?.reasonCode).toBe(
      "adapter_request_disposition_unknown",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("keeps an accepted provider failure without a request reference in doubt", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        outcome: "failure",
        requestDisposition: "accepted",
        providerRequestRef: null,
        promptTokens: 100,
        completionTokens: 0,
        actualCostUsdMicros: 12_500,
        costCurrency: "USD",
        pricingVersion: "synthetic-pricing-202607",
        costBand: "low",
        errorCode: "provider_failed_after_acceptance",
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.attempts[0]?.reasonCode).toBe(
      "adapter_provider_request_ref_invalid",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("keeps persisted numeric evidence above signed MySQL INT in doubt", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        ...successResult,
        actualCostUsdMicros: 2_147_483_648,
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.attempts[0]?.reasonCode).toBe(
      "provider_pricing_evidence_invalid",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("never dispatches again when a prior claim has no terminal receipt", async () => {
    const harness = createHarness({ preclaimed: true });
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(selectedAdapter.preflight).not.toHaveBeenCalled();
    expect(selectedAdapter.invoke).not.toHaveBeenCalled();
    expect(
      harness.dependencies.claimDispatch,
    ).not.toHaveBeenCalled();
  });

  it("reconciles an expired claim by provider idempotency key without invoking again", async () => {
    const harness = createHarness({
      preclaimed: true,
      preclaimedLeaseExpired: true,
    });
    const reconcile = vi.fn(async () => ({
      status: "terminal" as const,
      result: successResult,
    }));
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
      reconciliation: reconcile,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("success");
    expect(result.output).toBeNull();
    expect(result.attempts[0]?.reasonCode).toBe(
      "terminal_reconciled_without_output",
    );
    expect(selectedAdapter.invoke).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
    const dispatch = harness.claims.get("decision-primary")!;
    expect(reconcile.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        providerIdempotencyKey:
          dispatch.providerIdempotencyKey,
        dispatchClaimHash: dispatch.claimHash,
        dispatchRuntimeHash: dispatch.runtimeHash,
      }),
    );
    const terminalInput = vi.mocked(
      harness.dependencies.recordTerminal,
    ).mock.calls[0]![0];
    expect(terminalInput.resolutionSource).toBe("reconcile");
  });

  it("keeps an expired claim in doubt when reconciliation is inconclusive", async () => {
    const harness = createHarness({
      preclaimed: true,
      preclaimedLeaseExpired: true,
    });
    const reconcile = vi.fn(async () => ({
      status: "unknown" as const,
      errorCode: "provider_lookup_inconclusive",
    }));
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
      reconciliation: reconcile,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.attempts[0]?.reasonCode).toBe(
      "dispatch_reconciliation_inconclusive",
    );
    expect(selectedAdapter.invoke).not.toHaveBeenCalled();
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("keeps an expired claim in doubt when provider lookup returns not found", async () => {
    const harness = createHarness({
      preclaimed: true,
      preclaimedLeaseExpired: true,
    });
    const reconcile = vi.fn(async () => ({
      status: "not_found" as const,
      errorCode: "provider_lookup_not_found",
    }));
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
      reconciliation: reconcile,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("in_doubt");
    expect(result.attempts[0]?.reasonCode).toBe(
      "dispatch_reconciliation_inconclusive",
    );
    expect(selectedAdapter.invoke).not.toHaveBeenCalled();
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
  });

  it("uses one declared fallback only after a retry-safe explicit failure", async () => {
    const harness = createHarness({});
    const primaryAdapter = adapter({
      selectedRoute: harness.primary,
      result: {
        outcome: "failure",
        requestDisposition: "not_accepted",
        providerRequestRef: null,
        promptTokens: 100,
        completionTokens: 0,
        actualCostUsdMicros: 0,
        costCurrency: "USD",
        pricingVersion: "synthetic-pricing-202607",
        costBand: "zero",
        errorCode: "provider_unavailable",
      },
    });
    const fallbackAdapter = adapter({
      selectedRoute: harness.fallback,
      result: successResult,
    });
    const gateway = createGovernedModelGateway({
      adapters: [primaryAdapter, fallbackAdapter],
      dependencies: harness.dependencies,
    });
    const gatewayRequest = request();
    gatewayRequest.allowFallback = true;

    const result = await gateway(gatewayRequest);

    expect(result.status).toBe("success");
    expect(result.output).toEqual(successResult.output);
    expect(result.attempts).toHaveLength(2);
    expect(result.fallbackAttempted).toBe(true);
    expect(result.fallbackSucceeded).toBe(true);
    expect(primaryAdapter.invoke).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter.invoke).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(harness.dependencies.recordTerminal).mock
        .calls[0]![0].fallbackTargetRouteRef,
    ).toBe("fallback");
  });

  it("keeps an adapter exception in doubt and does not use fallback", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: async () => {
        throw new Error("private provider detail");
      },
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });
    const gatewayRequest = request();
    gatewayRequest.allowFallback = true;

    const result = await gateway(gatewayRequest);

    expect(result.status).toBe("in_doubt");
    expect(result.output).toBeNull();
    expect(result.fallbackAttempted).toBe(false);
    expect(result.attempts[0]?.reasonCode).toBe(
      "adapter_outcome_unknown",
    );
    expect(
      harness.dependencies.recordTerminal,
    ).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(
      "private provider detail",
    );
  });

  it("times out a non-returning adapter without writing a terminal receipt", async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({});
      const selectedAdapter = adapter({
        selectedRoute: harness.primary,
        result: () =>
          new Promise<GovernedModelAdapterResult<Output>>(
            () => undefined,
          ),
      });
      const gateway = createGovernedModelGateway({
        adapters: [selectedAdapter],
        dependencies: harness.dependencies,
      });

      const resultPromise = gateway(request());
      await vi.advanceTimersByTimeAsync(
        harness.primary.maxLatencyMs + 1,
      );
      const result = await resultPromise;

      expect(result.status).toBe("in_doubt");
      expect(result.output).toBeNull();
      expect(result.attempts[0]?.reasonCode).toBe(
        "adapter_outcome_unknown_after_timeout",
      );
      expect(
        harness.dependencies.recordTerminal,
      ).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops before claim when adapter estimates exceed the route budget", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
      estimatedInputTokens:
        harness.primary.maxInputTokens + 1,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    const result = await gateway(request());

    expect(result.status).toBe("not_dispatched");
    expect(result.attempts[0]?.reasonCode).toBe(
      "route_input_token_budget_exceeded",
    );
    expect(
      harness.dependencies.claimDispatch,
    ).not.toHaveBeenCalled();
    expect(selectedAdapter.invoke).not.toHaveBeenCalled();
  });

  it("rejects non-JSON projected payload before creating a decision", async () => {
    const harness = createHarness({});
    const gateway = createGovernedModelGateway<
      Payload,
      Output
    >({
      dependencies: harness.dependencies,
    });
    const invalid = request() as GovernedModelGatewayInput<Payload>;
    invalid.projectedPayload = {
      question: "cycle",
      facts: [],
    };
    (
      invalid.projectedPayload as unknown as {
        self?: unknown;
      }
    ).self = invalid.projectedPayload;

    await expect(gateway(invalid)).rejects.toThrow(
      /projected_payload_cycle_detected/u,
    );
    expect(
      harness.dependencies.prepareDecision,
    ).not.toHaveBeenCalled();
  });

  it("derives the exact projected payload hash passed to the decision store", async () => {
    const harness = createHarness({ blocked: true });
    const gateway = createGovernedModelGateway<
      Payload,
      Output
    >({
      dependencies: harness.dependencies,
    });
    const gatewayRequest = request();

    await gateway(gatewayRequest);

    expect(
      vi.mocked(harness.dependencies.prepareDecision).mock
        .calls[0]![0].projectedPayloadHash,
    ).toBe(
      sha256(canonicalJson(gatewayRequest.projectedPayload)),
    );
  });

  it("fails closed before adapter resolution when the projection receipt is missing", async () => {
    const harness = createHarness({});
    vi.mocked(
      harness.dependencies.readProjectionReceipt,
    ).mockResolvedValueOnce(null);
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });

    await expect(
      gateway(request()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GovernedModelGatewayError>>({
        code: "projection_receipt_not_found",
      }),
    );
    expect(selectedAdapter.preflight).not.toHaveBeenCalled();
    expect(
      harness.dependencies.prepareDecision,
    ).not.toHaveBeenCalled();
  });

  it("fails closed before adapter resolution when the projected payload differs from the persisted receipt", async () => {
    const harness = createHarness({});
    const selectedAdapter = adapter({
      selectedRoute: harness.primary,
      result: successResult,
    });
    const gateway = createGovernedModelGateway({
      adapters: [selectedAdapter],
      dependencies: harness.dependencies,
    });
    const gatewayRequest = request();
    gatewayRequest.projectedPayload = {
      ...PROJECTED_PAYLOAD,
      facts: ["Tampered fact"],
    };

    await expect(gateway(gatewayRequest)).rejects.toEqual(
      expect.objectContaining<Partial<GovernedModelGatewayError>>({
        code: "projection_payload_binding_mismatch",
      }),
    );
    expect(selectedAdapter.preflight).not.toHaveBeenCalled();
    expect(
      harness.dependencies.prepareDecision,
    ).not.toHaveBeenCalled();
  });
});
