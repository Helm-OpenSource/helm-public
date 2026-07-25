import { describe, expect, it } from "vitest";
import {
  computeGovernedModelProjectionReceiptHash,
  computeModelEgressReceiptHash,
  computeModelRouteDecisionHash,
  computeModelRouteRequestHash,
  validateGovernedProjectionRouteBinding,
  validateModelEgressReceipt,
  validateModelEgressReceiptChain,
  validateModelRouteDecision,
  type GovernedModelProjectionReceipt,
  type ModelEgressReceipt,
  type ModelRouteDecision,
} from "@/lib/llm/model-egress-contracts";
import type {
  TenantModelRoute,
} from "@/lib/llm/model-route-contracts";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;
const HASH_D = `sha256:${"d".repeat(64)}`;

function sourceBinding(assetRef: string) {
  const suffix = assetRef.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return {
    assetRef,
    assetVersion: 3,
    inventoryStatus: "confirmed" as const,
    classificationStatus: "classified" as const,
    sensitivity: "internal" as const,
    processingDisposition: "remote_projected" as const,
    classificationReceiptRef: `classification-${suffix}`,
    classificationReceiptHash: HASH_C,
    authorizationStatus: "authorized" as const,
    authorizationReceiptRef: `authorization-${suffix}`,
    authorizationReceiptHash: HASH_D,
    authorizationValidFrom: "2026-07-23T11:00:00.000Z",
    authorizationValidUntil: "2026-07-24T12:00:00.000Z",
  };
}

function route(
  overrides: Partial<TenantModelRoute> = {},
): TenantModelRoute {
  return {
    routeId: "qwen-cn-primary",
    provider: "qwen",
    modelId: "qwen3.6-plus",
    modelVersion: "qwen3.6-plus-20260701",
    adapterKey: "qwen",
    readinessReceiptRef: "readiness:qwen-cn-primary",
    readinessReceiptHash: HASH_B,
    credentialRef: "secret:tenant/qwen-primary",
    governanceProfileRef: "governance:model-egress-cn-standard",
    governanceProfileHash: HASH_C,
    projectorRegistrationRef: "projector:synthetic",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "projector-v1",
    scannerRegistrationRef: "scanner:synthetic",
    scannerRegistrationHash: HASH_C,
    scannerVersion: "scanner-v1",
    deploymentForm: "domestic_cloud",
    jurisdiction: "domestic",
    region: "cn-hangzhou",
    allowedTaskClasses: ["summary_briefing"],
    maximumSensitivity: "confidential",
    allowedProcessingDispositions: ["remote_projected"],
    retentionDays: 0,
    trainingUse: "prohibited",
    termsAssurance: "contractual_no_retention",
    providerTermsRef: "terms:qwen-enterprise-202607",
    providerTermsHash: HASH_C,
    deletionTermsRef: "terms:qwen-delete-202607",
    deletionTermsHash: HASH_D,
    pricingTermsRef: "pricing:qwen-enterprise-202607",
    pricingTermsHash: HASH_A,
    pricingVersion: "qwen-pricing-202607",
    maxInputTokens: 16_000,
    maxOutputTokens: 4_000,
    maxCostUsdMicros: 500_000,
    maxLatencyMs: 15_000,
    maxConcurrency: 8,
    fallbackRouteIds: [],
    ...overrides,
  };
}

function projectionReceipt(
  overrides: Partial<GovernedModelProjectionReceipt> = {},
): GovernedModelProjectionReceipt {
  const candidate: GovernedModelProjectionReceipt = {
    schemaVersion:
      "helm.governed-model-projection-receipt/v1",
    receiptId: "projection:synthetic-1",
    workspaceRef: "workspace:synthetic-caio",
    idempotencyKey: "projection-synthetic-1",
    sourceAssetRefs: ["asset:synthetic-crm"],
    sourceAssetBindings: [
      sourceBinding("asset:synthetic-crm"),
    ],
    candidateEvidenceRefs: [
      "evidence:synthetic-crm-summary",
    ],
    selectedEvidenceRefs: [
      "evidence:synthetic-crm-summary",
    ],
    droppedEvidenceRefs: [],
    projectedPayloadHash: HASH_D,
    projectedPayloadBytes: 128,
    maxInputTokens: 1_000,
    maxOutputTokens: 200,
    remoteSafe: true,
    redactionStatus: "redacted",
    promptInjectionScanStatus: "passed",
    projectorRegistrationRef: "projector:synthetic",
    projectorRegistrationHash: HASH_A,
    projectorVersion: "projector-v1",
    scannerRegistrationRef: "scanner:synthetic",
    scannerRegistrationHash: HASH_C,
    scannerVersion: "scanner-v1",
    validUntil: "2026-07-24T12:00:00.000Z",
    createdAt: "2026-07-23T12:00:00.000Z",
    rawContentIncluded: false,
    authorityEffect: "evidence_only",
    contentHash: HASH_A,
    ...overrides,
  };
  return {
    ...candidate,
    contentHash:
      computeGovernedModelProjectionReceiptHash(candidate),
  };
}

function decision(
  overrides: Partial<ModelRouteDecision> = {},
): ModelRouteDecision {
  const selectedRoute = route();
  const request = {
    workspaceRef:
      overrides.workspaceRef ?? "workspace:synthetic-caio",
    requestKey:
      overrides.requestKey ?? "request:synthetic-1",
    policyKey: overrides.policyKey ?? "caio-pro-default",
    taskClass:
      overrides.taskClass ?? ("summary_briefing" as const),
    taskRef:
      overrides.taskRef ?? "briefing:synthetic-daily",
    sourceAssetRefs:
      overrides.sourceAssetRefs ?? ["asset:synthetic-crm"],
    candidateEvidenceRefs:
      overrides.candidateEvidenceRefs ?? [
        "evidence:synthetic-crm-summary",
      ],
    selectedEvidenceRefs:
      overrides.selectedEvidenceRefs ?? [
        "evidence:synthetic-crm-summary",
      ],
    droppedEvidenceRefs:
      overrides.droppedEvidenceRefs ?? [],
    projectionReceiptRef:
      overrides.projectionReceiptRef ?? "projection:synthetic-1",
    projectionReceiptHash:
      overrides.projectionReceiptHash ?? HASH_C,
    projectedPayloadHash:
      overrides.projectedPayloadHash ?? HASH_D,
    promptInjectionScanStatus:
      overrides.promptInjectionScanStatus ??
      ("passed" as const),
    requestedMaxOutputTokens:
      overrides.requestedMaxOutputTokens ?? 200,
    allowFallback: overrides.allowFallback ?? false,
    parentDecisionRef: overrides.parentDecisionRef ?? null,
    requestedFallbackRouteRef:
      overrides.requestedFallbackRouteRef ?? null,
    fallbackReason: overrides.fallbackReason ?? null,
  };
  const candidate: ModelRouteDecision = {
    schemaVersion: "helm.model-route-decision/v1",
    decisionId: "route-decision:synthetic-1",
    workspaceRef: request.workspaceRef,
    requestKey: request.requestKey,
    requestHash: computeModelRouteRequestHash(request),
    attemptOrdinal: 0,
    policyKey: request.policyKey,
    parentDecisionRef: request.parentDecisionRef,
    policyRef: "policy:caio-pro-default-v1",
    policyHash: HASH_A,
    policyHeadVersion: 1,
    policyRevocationEpoch: 0,
    readinessReceiptRef: selectedRoute.readinessReceiptRef,
    readinessReceiptHash: selectedRoute.readinessReceiptHash,
    taskClass: request.taskClass,
    taskRef: request.taskRef,
    sensitivity: "internal",
    processingDisposition: "remote_projected",
    classificationReasonCodes: [],
    sourceAssetRefs: request.sourceAssetRefs,
    sourceAssetBindings: request.sourceAssetRefs.map(sourceBinding),
    candidateEvidenceRefs: request.candidateEvidenceRefs,
    selectedEvidenceRefs: request.selectedEvidenceRefs,
    droppedEvidenceRefs: request.droppedEvidenceRefs,
    projectionReceiptRef: request.projectionReceiptRef,
    projectionReceiptHash: request.projectionReceiptHash,
    projectedPayloadHash: request.projectedPayloadHash,
    promptInjectionScanStatus: request.promptInjectionScanStatus,
    requestedMaxOutputTokens: request.requestedMaxOutputTokens,
    allowFallback: request.allowFallback,
    routeRef: selectedRoute.routeId,
    routeSnapshot: selectedRoute,
    adapterReadinessState: "ready",
    catalogVisibilityState: "hidden",
    decision: "allowed",
    reasonCodes: [],
    requestedFallbackRouteRef: request.requestedFallbackRouteRef,
    fallbackFromRouteRef: null,
    fallbackReason: null,
    validUntil: "2026-07-23T12:05:00.000Z",
    createdAt: "2026-07-23T12:00:00.000Z",
    rawContentIncluded: false,
    authorityEffect: "model_egress_only",
    contentHash: HASH_A,
    ...overrides,
  };
  return {
    ...candidate,
    contentHash: computeModelRouteDecisionHash(candidate),
  };
}

function startedReceipt(
  routeDecision: ModelRouteDecision,
  overrides: Partial<ModelEgressReceipt> = {},
): ModelEgressReceipt {
  const selectedRoute = routeDecision.routeSnapshot ?? route();
  const candidate: ModelEgressReceipt = {
    schemaVersion: "helm.model-egress-receipt/v1",
    receiptId: "egress-receipt:synthetic-started",
    workspaceRef: routeDecision.workspaceRef,
    decisionRef: routeDecision.decisionId,
    previousReceiptRef: null,
    previousReceiptHash: null,
    sequence: 1,
    idempotencyKey: "egress:synthetic-1:started",
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
    policyHash: routeDecision.policyHash,
    readinessReceiptHash:
      routeDecision.readinessReceiptHash ?? HASH_B,
    projectedPayloadHash: routeDecision.projectedPayloadHash,
    selectedEvidenceRefs: routeDecision.selectedEvidenceRefs,
    droppedEvidenceRefs: routeDecision.droppedEvidenceRefs,
    projectionReceiptRef: routeDecision.projectionReceiptRef,
    projectionReceiptHash: routeDecision.projectionReceiptHash,
    rawContentIncluded: false,
    dispatchGatewayRef: null,
    dispatchRuntimeHash: null,
    dispatchClaimHash: null,
    providerRequestRefHash: null,
    startedAt: "2026-07-23T12:01:00.000Z",
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
    auditRef: "audit:synthetic-egress-started",
    recordedAt: "2026-07-23T12:01:00.000Z",
    authorityEffect: "evidence_only",
    contentHash: HASH_A,
    ...overrides,
  };
  return {
    ...candidate,
    contentHash: computeModelEgressReceiptHash(candidate),
  };
}

function terminalReceipt(
  routeDecision: ModelRouteDecision,
  started: ModelEgressReceipt,
  overrides: Partial<ModelEgressReceipt> = {},
): ModelEgressReceipt {
  const candidate: ModelEgressReceipt = {
    ...started,
    receiptId: "egress-receipt:synthetic-terminal",
    previousReceiptRef: started.receiptId,
    previousReceiptHash: started.contentHash,
    sequence: 2,
    idempotencyKey: "egress:synthetic-1:terminal",
    phase: "terminal",
    outcome: "success",
    resolutionSource: "invoke",
    requestDisposition: "accepted",
    dispatchGatewayRef: "gateway:synthetic-caio",
    dispatchRuntimeHash: HASH_D,
    dispatchClaimHash: HASH_A,
    providerRequestRefHash: HASH_C,
    finishedAt: "2026-07-23T12:01:02.000Z",
    latencyMs: 2_000,
    promptTokens: 400,
    completionTokens: 80,
    actualCostUsdMicros: 12_500,
    costCurrency: "USD",
    pricingVersion:
      routeDecision.routeSnapshot!.pricingVersion,
    costBand: "low",
    errorCode: null,
    auditRef: "audit:synthetic-egress-terminal",
    recordedAt: "2026-07-23T12:01:02.000Z",
    contentHash: HASH_A,
    ...overrides,
  };
  return {
    ...candidate,
    decisionRef: routeDecision.decisionId,
    contentHash: computeModelEgressReceiptHash(candidate),
  };
}

describe("governed projection route binding", () => {
  it("accepts the exact owner-approved projector and scanner identities", () => {
    expect(
      validateGovernedProjectionRouteBinding({
        receipt: projectionReceipt(),
        route: route(),
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a projection whose implementation identity is not approved", () => {
    expect(
      validateGovernedProjectionRouteBinding({
        receipt: projectionReceipt({
          projectorRegistrationHash: HASH_B,
          scannerVersion: "scanner-v2",
        }),
        route: route(),
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "projection_projector_registration_hash_mismatch",
        "projection_scanner_version_mismatch",
      ]),
    );
  });
});

describe("model route decision contract", () => {
  it("accepts a remote projected decision bound to policy and readiness", () => {
    expect(validateModelRouteDecision(decision())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("normalizes evidence sets before hashing", () => {
    const first = decision({
      sourceAssetRefs: ["asset:b", "asset:a"],
      sourceAssetBindings: [
        sourceBinding("asset:b"),
        sourceBinding("asset:a"),
      ],
      candidateEvidenceRefs: ["evidence:b", "evidence:a"],
      selectedEvidenceRefs: ["evidence:a"],
      droppedEvidenceRefs: ["evidence:b"],
      requestHash: computeModelRouteRequestHash({
        workspaceRef: "workspace:synthetic-caio",
        requestKey: "request:synthetic-1",
        policyKey: "caio-pro-default",
        taskClass: "summary_briefing",
        taskRef: "briefing:synthetic-daily",
        sourceAssetRefs: ["asset:b", "asset:a"],
        candidateEvidenceRefs: ["evidence:b", "evidence:a"],
        selectedEvidenceRefs: ["evidence:a"],
        droppedEvidenceRefs: ["evidence:b"],
        projectionReceiptRef: "projection:synthetic-1",
        projectionReceiptHash: HASH_C,
        projectedPayloadHash: HASH_D,
        promptInjectionScanStatus: "passed",
        requestedMaxOutputTokens: 200,
        allowFallback: false,
        parentDecisionRef: null,
        requestedFallbackRouteRef: null,
        fallbackReason: null,
      }),
    });
    const second = decision({
      sourceAssetRefs: ["asset:a", "asset:b"],
      sourceAssetBindings: [
        sourceBinding("asset:a"),
        sourceBinding("asset:b"),
      ],
      candidateEvidenceRefs: ["evidence:a", "evidence:b"],
      selectedEvidenceRefs: ["evidence:a"],
      droppedEvidenceRefs: ["evidence:b"],
      requestHash: computeModelRouteRequestHash({
        workspaceRef: "workspace:synthetic-caio",
        requestKey: "request:synthetic-1",
        policyKey: "caio-pro-default",
        taskClass: "summary_briefing",
        taskRef: "briefing:synthetic-daily",
        sourceAssetRefs: ["asset:a", "asset:b"],
        candidateEvidenceRefs: ["evidence:a", "evidence:b"],
        selectedEvidenceRefs: ["evidence:a"],
        droppedEvidenceRefs: ["evidence:b"],
        projectionReceiptRef: "projection:synthetic-1",
        projectionReceiptHash: HASH_C,
        projectedPayloadHash: HASH_D,
        promptInjectionScanStatus: "passed",
        requestedMaxOutputTokens: 200,
        allowFallback: false,
        parentDecisionRef: null,
        requestedFallbackRouteRef: null,
        fallbackReason: null,
      }),
    });
    expect(first.contentHash).toBe(second.contentHash);
  });

  it("binds output budget and fallback intent into the request hash", () => {
    const original = decision();
    const changedBudget = decision({
      requestedMaxOutputTokens:
        original.requestedMaxOutputTokens + 1,
    });
    const changedFallbackIntent = decision({
      allowFallback: !original.allowFallback,
    });

    expect(changedBudget.requestHash).not.toBe(original.requestHash);
    expect(changedFallbackIntent.requestHash).not.toBe(
      original.requestHash,
    );
  });

  it("blocks a remote decision without a projection receipt", () => {
    const candidate = decision({
      projectionReceiptRef: null,
      projectionReceiptHash: null,
    });
    expect(validateModelRouteDecision(candidate).errors).toContain(
      "remote_route_requires_projection_receipt",
    );
  });

  it("blocks an allowed route when injection scanning did not pass", () => {
    const candidate = decision({
      promptInjectionScanStatus: "failed",
    });
    expect(validateModelRouteDecision(candidate).errors).toContain(
      "allowed_decision_requires_passed_injection_scan",
    );
  });

  it("rejects an invalid evidence partition", () => {
    const candidate = decision({
      sourceAssetRefs: ["asset:a", "asset:b"],
      sourceAssetBindings: [
        sourceBinding("asset:a"),
        sourceBinding("asset:b"),
      ],
      candidateEvidenceRefs: ["evidence:a", "evidence:b"],
      selectedEvidenceRefs: ["evidence:a"],
      droppedEvidenceRefs: [],
    });
    expect(validateModelRouteDecision(candidate).errors).toContain(
      "evidence_partition_invalid",
    );
  });

  it("detects semantic tampering after the decision was hashed", () => {
    const original = decision();
    const tampered = {
      ...original,
      policyRevocationEpoch: original.policyRevocationEpoch + 1,
    };
    expect(validateModelRouteDecision(tampered).errors).toContain(
      "route_decision_hash_mismatch",
    );
  });

  it("rejects unknown decision enums and an invalid route snapshot", () => {
    const invalid = decision({
      taskClass:
        "teleport" as ModelRouteDecision["taskClass"],
      sensitivity:
        "top_secret" as ModelRouteDecision["sensitivity"],
      processingDisposition:
        "share_all" as ModelRouteDecision["processingDisposition"],
      promptInjectionScanStatus:
        "skipped" as ModelRouteDecision["promptInjectionScanStatus"],
      adapterReadinessState:
        "maybe" as ModelRouteDecision["adapterReadinessState"],
      catalogVisibilityState:
        "sometimes" as ModelRouteDecision["catalogVisibilityState"],
      decision:
        "perhaps" as ModelRouteDecision["decision"],
      routeSnapshot: route({
        deploymentForm:
          "teleport" as TenantModelRoute["deploymentForm"],
      }),
    });
    expect(validateModelRouteDecision(invalid).errors).toEqual(
      expect.arrayContaining([
        "task_class_invalid",
        "sensitivity_invalid",
        "processing_disposition_invalid",
        "prompt_injection_scan_status_invalid",
        "adapter_readiness_state_invalid",
        "catalog_visibility_state_invalid",
        "decision_invalid",
        "route:qwen-cn-primary:deployment_form_invalid",
      ]),
    );
  });

  it("rejects a fallback decision whose selected route is not the requested target", () => {
    const candidate = decision({
      attemptOrdinal: 1,
      parentDecisionRef: "route-decision:synthetic-parent",
      requestedFallbackRouteRef: "qwen-cn-fallback",
      fallbackFromRouteRef: "qwen-cn-primary",
      fallbackReason: "provider_unavailable",
    });
    expect(validateModelRouteDecision(candidate).errors).toContain(
      "fallback_target_route_mismatch",
    );
  });

  it("rejects unbounded reference text in the governance envelope", () => {
    const candidate = decision({
      selectedEvidenceRefs: ["customer@example.com"],
      candidateEvidenceRefs: ["customer@example.com"],
    });
    expect(validateModelRouteDecision(candidate).errors).toEqual(
      expect.arrayContaining([
        "candidate_evidence_ref_invalid",
        "selected_evidence_ref_invalid",
      ]),
    );
  });
});

describe("model egress receipt contract", () => {
  it("accepts a two-receipt append-only chain", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started);
    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal,
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("forbids a started receipt from claiming a terminal result", () => {
    const routeDecision = decision();
    const candidate = startedReceipt(routeDecision, {
      outcome: "success",
      finishedAt: "2026-07-23T12:01:02.000Z",
      latencyMs: 2_000,
    });
    expect(validateModelEgressReceipt(candidate).errors).toEqual(
      expect.arrayContaining([
        "started_receipt_must_be_unknown",
        "started_receipt_must_not_claim_terminal_result",
      ]),
    );
  });

  it("requires a terminal receipt to link its predecessor", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      previousReceiptRef: null,
      previousReceiptHash: null,
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "terminal_receipt_predecessor_required",
    );
  });

  it("requires a terminal receipt to bind the exact dispatch claim", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      dispatchGatewayRef: null,
      dispatchRuntimeHash: null,
      dispatchClaimHash: null,
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "terminal_receipt_dispatch_claim_required",
    );
  });

  it("rejects an unknown outcome as a capacity-releasing terminal receipt", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      outcome: "unknown",
      requestDisposition: "unknown",
      providerRequestRefHash: null,
      promptTokens: null,
      completionTokens: null,
      actualCostUsdMicros: 0,
      costBand: "unknown",
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "terminal_receipt_outcome_must_be_known",
    );
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "terminal_receipt_request_disposition_must_be_known",
    );
  });

  it("requires terminal request acceptance to be explicit and auditable", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const acceptedWithoutRef = terminalReceipt(
      routeDecision,
      started,
      {
        outcome: "failure",
        requestDisposition: "accepted",
        providerRequestRefHash: null,
        errorCode: "provider_failed_after_acceptance",
      },
    );
    const notAcceptedWithRef = terminalReceipt(
      routeDecision,
      started,
      {
        outcome: "failure",
        requestDisposition: "not_accepted",
        providerRequestRefHash: HASH_A,
        actualCostUsdMicros: 0,
        errorCode: "provider_unavailable",
      },
    );

    expect(
      validateModelEgressReceipt(acceptedWithoutRef).errors,
    ).toContain(
      "accepted_receipt_provider_request_ref_required",
    );
    expect(
      validateModelEgressReceipt(notAcceptedWithRef).errors,
    ).toContain(
      "not_accepted_receipt_must_not_have_provider_request_ref",
    );
  });

  it("rejects persisted numeric evidence outside the signed MySQL integer range", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      actualCostUsdMicros: 2_147_483_648,
      latencyMs: 2_147_483_648,
    });

    expect(validateModelEgressReceipt(terminal).errors).toEqual(
      expect.arrayContaining([
        "latency_ms_invalid",
        "actual_cost_usd_micros_invalid",
      ]),
    );
  });

  it("requires a provider request reference for successful outcomes", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      providerRequestRefHash: null,
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "successful_receipt_provider_request_ref_required",
    );
  });

  it("requires exact pricing evidence on every terminal receipt", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      actualCostUsdMicros: null,
      costCurrency: null,
      pricingVersion: null,
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "terminal_receipt_pricing_evidence_required",
    );
  });

  it("rejects cost or pricing evidence outside the owner-approved route", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const overBudget = terminalReceipt(routeDecision, started, {
      actualCostUsdMicros:
        routeDecision.routeSnapshot!.maxCostUsdMicros + 1,
    });
    const wrongVersion = terminalReceipt(routeDecision, started, {
      pricingVersion: "qwen-pricing-202608",
    });

    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal: overBudget,
      }).errors,
    ).toContain("receipt_chain_route_cost_budget_exceeded");
    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal: wrongVersion,
      }).errors,
    ).toContain("receipt_chain_pricing_version_mismatch");
  });

  it("requires a not-accepted request to prove zero actual cost", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      outcome: "failure",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      errorCode: "provider_unavailable",
      actualCostUsdMicros: 1,
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "not_accepted_receipt_cost_must_be_zero",
    );
  });

  it("does not allow a successful outcome to advertise a fallback", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      fallbackTargetRouteRef: "qwen-cn-fallback",
      fallbackReason: "provider_unavailable",
    });
    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "fallback_requires_failed_not_accepted_outcome",
    );
  });

  it("allows fallback only after an explicit not-accepted failure", () => {
    const routeDecision = decision({
      allowFallback: true,
      routeSnapshot: route({
        fallbackRouteIds: ["qwen-cn-fallback"],
      }),
    });
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      outcome: "failure",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      promptTokens: null,
      completionTokens: null,
      actualCostUsdMicros: 0,
      costBand: "unknown",
      errorCode: "provider_unavailable",
      fallbackTargetRouteRef: "qwen-cn-fallback",
      fallbackReason: "provider_unavailable",
    });

    expect(validateModelEgressReceipt(terminal)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a fallback reason that is detached from the failure", () => {
    const routeDecision = decision({
      allowFallback: true,
      routeSnapshot: route({
        fallbackRouteIds: ["qwen-cn-fallback"],
      }),
    });
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      outcome: "failure",
      requestDisposition: "not_accepted",
      providerRequestRefHash: null,
      promptTokens: null,
      completionTokens: null,
      actualCostUsdMicros: 0,
      costBand: "unknown",
      errorCode: "provider_unavailable",
      fallbackTargetRouteRef: "qwen-cn-fallback",
      fallbackReason: "provider_timeout",
    });

    expect(validateModelEgressReceipt(terminal).errors).toContain(
      "fallback_reason_must_match_error_code",
    );
  });

  it("rejects actual output usage above the requested budget", () => {
    const routeDecision = decision({
      requestedMaxOutputTokens: 50,
    });
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      completionTokens: 51,
    });

    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal,
      }).errors,
    ).toContain("receipt_chain_requested_output_budget_exceeded");
  });

  it("rejects actual input usage above the selected route budget", () => {
    const selectedRoute = route({ maxInputTokens: 100 });
    const routeDecision = decision({
      routeSnapshot: selectedRoute,
    });
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      promptTokens: 101,
    });

    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal,
      }).errors,
    ).toContain("receipt_chain_route_input_budget_exceeded");
  });

  it("rejects unsafe error messages and raw-content flags", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const candidate = terminalReceipt(routeDecision, started, {
      outcome: "failure",
      errorCode: "Provider said: customer@example.com",
      rawContentIncluded: true,
    } as Partial<ModelEgressReceipt>);
    expect(validateModelEgressReceipt(candidate).errors).toEqual(
      expect.arrayContaining([
        "safe_error_code_required",
        "raw_content_must_be_excluded",
      ]),
    );
  });

  it("detects a terminal receipt rebound to another decision", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const otherDecision = decision({
      decisionId: "route-decision:synthetic-2",
      requestKey: "request:synthetic-2",
    });
    const terminal = terminalReceipt(otherDecision, started);
    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "receipt_chain_decision_mismatch",
      ]),
    );
  });

  it("detects predecessor hash tampering", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision);
    const terminal = terminalReceipt(routeDecision, started, {
      previousReceiptHash: HASH_D,
    });
    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal,
      }).errors,
    ).toContain("receipt_chain_predecessor_mismatch");
  });

  it("detects a receipt rebound to another provider and projection", () => {
    const routeDecision = decision();
    const started = startedReceipt(routeDecision, {
      provider: "other-provider",
      modelId: "other-model",
      projectionReceiptRef: "projection:other",
      projectionReceiptHash: HASH_D,
    });
    const terminal = terminalReceipt(routeDecision, started);
    expect(
      validateModelEgressReceiptChain({
        decision: routeDecision,
        started,
        terminal,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "receipt_chain_decision_provider_mismatch",
        "receipt_chain_decision_model_id_mismatch",
        "receipt_chain_decision_projection_mismatch",
      ]),
    );
  });
});
