import "server-only";

import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  buildRegisteredAdapterRuntime,
  createGovernedModelAdapterRegistry,
  type GovernedJsonValue,
  type GovernedModelAdapterPreflight,
  type GovernedModelAdapterReconciliation,
  type GovernedModelAdapterRegistry,
  type GovernedModelAdapterResult,
  type GovernedModelProviderAdapter,
} from "@/lib/llm/governed-model-adapter-registry.service";
import {
  validateGovernedModelProjectionReceipt,
} from "@/lib/llm/model-egress-contracts";
import type {
  ModelEgressCostBand,
  ModelEgressOutcome,
  ModelEgressReceipt,
  ModelRouteDecision,
} from "@/lib/llm/model-egress-contracts";
import {
  GOVERNED_GATEWAY_AUTHORITY,
  claimModelRouteDispatch,
  prepareModelRouteDecision,
  readGovernedModelProjectionReceipt,
  readModelRouteDecision,
  recordModelEgressTerminalReceipt,
} from "@/lib/llm/model-egress-store.service";
import {
  isSafeModelGovernanceIdentifier,
  isSafeModelGovernanceRef,
  MODEL_GOVERNANCE_PERSISTED_INT_MAX,
  type ModelRouteTaskClass,
  type TenantModelRoute,
} from "@/lib/llm/model-route-contracts";

export type {
  GovernedJsonValue,
  GovernedModelAdapterPreflight,
  GovernedModelAdapterResult,
  GovernedModelAdapterReconciliation,
  GovernedModelProviderAdapter,
} from "@/lib/llm/governed-model-adapter-registry.service";

export type GovernedModelGatewayAttempt = {
  decision: ModelRouteDecision;
  startedReceipt: ModelEgressReceipt | null;
  terminalReceipt: ModelEgressReceipt | null;
  status:
    | "blocked"
    | "not_dispatched"
    | "in_doubt"
    | ModelEgressOutcome;
  reasonCode: string | null;
  replayed: boolean;
};

export type GovernedModelGatewayResult<
  TOutput extends GovernedJsonValue,
> = {
  status:
    | "blocked"
    | "not_dispatched"
    | "in_doubt"
    | ModelEgressOutcome;
  output: TOutput | null;
  attempts: readonly GovernedModelGatewayAttempt[];
  selectedDecisionRef: string;
  fallbackAttempted: boolean;
  fallbackSucceeded: boolean;
  rawContentPersisted: false;
};

export type GovernedModelGatewayInput<
  TPayload extends GovernedJsonValue,
> = {
  workspaceId: string;
  gatewayRef: string;
  policyKey: string;
  requestKey: string;
  taskClass: ModelRouteTaskClass;
  taskRef: string;
  projectionReceiptRef: string;
  projectedPayload: TPayload;
  requestedMaxOutputTokens: number;
  allowFallback?: boolean;
  decisionTtlMs?: number;
};

export type GovernedModelGatewayDependencies = {
  prepareDecision: typeof prepareModelRouteDecision;
  readProjectionReceipt: typeof readGovernedModelProjectionReceipt;
  readDecision: typeof readModelRouteDecision;
  claimDispatch: typeof claimModelRouteDispatch;
  recordTerminal: typeof recordModelEgressTerminalReceipt;
  now: () => Date;
};

const DEFAULT_DEPENDENCIES: GovernedModelGatewayDependencies = {
  prepareDecision: prepareModelRouteDecision,
  readProjectionReceipt: readGovernedModelProjectionReceipt,
  readDecision: readModelRouteDecision,
  claimDispatch: claimModelRouteDispatch,
  recordTerminal: recordModelEgressTerminalReceipt,
  now: () => new Date(),
};

const COST_BANDS = new Set<ModelEgressCostBand>([
  "unknown",
  "zero",
  "low",
  "medium",
  "high",
]);

export class GovernedModelGatewayError extends Error {
  readonly code: string;
  readonly decisionRef: string | null;

  constructor(
    code: string,
    decisionRef: string | null = null,
  ) {
    super(code);
    this.name = "GovernedModelGatewayError";
    this.code = code;
    this.decisionRef = decisionRef;
  }
}

function assertGovernedJson(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
): asserts value is GovernedJsonValue {
  if (depth > 32) {
    throw new GovernedModelGatewayError(
      "projected_payload_depth_exceeded",
    );
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new GovernedModelGatewayError(
        "projected_payload_number_invalid",
      );
    }
    return;
  }
  if (typeof value !== "object") {
    throw new GovernedModelGatewayError(
      "projected_payload_not_json",
    );
  }
  if (seen.has(value)) {
    throw new GovernedModelGatewayError(
      "projected_payload_cycle_detected",
    );
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      assertGovernedJson(item, seen, depth + 1);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new GovernedModelGatewayError(
        "projected_payload_not_plain_object",
      );
    }
    for (const item of Object.values(
      value as Record<string, unknown>,
    )) {
      assertGovernedJson(item, seen, depth + 1);
    }
  }
  seen.delete(value);
}

function validNonNegativeInteger(
  value: number | null,
): boolean {
  return (
    value === null ||
    (Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= MODEL_GOVERNANCE_PERSISTED_INT_MAX)
  );
}

function stableIdentifier(
  prefix: string,
  value: unknown,
): string {
  return `${prefix}-${sha256(canonicalJson(value)).slice(
    "sha256:".length,
  )}`;
}

function terminalReceipt(
  receipts: readonly ModelEgressReceipt[],
): ModelEgressReceipt | null {
  return (
    receipts.find(
      (receipt) =>
        receipt.sequence === 2 &&
        receipt.phase === "terminal",
    ) ?? null
  );
}

function attemptFromStored(input: {
  decision: ModelRouteDecision;
  receipts: readonly ModelEgressReceipt[];
  status:
    | "not_dispatched"
    | "in_doubt"
    | ModelEgressOutcome;
  reasonCode: string | null;
  replayed: boolean;
}): GovernedModelGatewayAttempt {
  return {
    decision: input.decision,
    startedReceipt:
      input.receipts.find((receipt) => receipt.sequence === 1) ??
      null,
    terminalReceipt: terminalReceipt(input.receipts),
    status: input.status,
    reasonCode: input.reasonCode,
    replayed: input.replayed,
  };
}

function resultWithoutOutput<
  TOutput extends GovernedJsonValue,
>(input: {
  attempt: GovernedModelGatewayAttempt;
  fallbackAttempted?: boolean;
}): GovernedModelGatewayResult<TOutput> {
  return {
    status: input.attempt.status,
    output: null,
    attempts: [input.attempt],
    selectedDecisionRef: input.attempt.decision.decisionId,
    fallbackAttempted: input.fallbackAttempted ?? false,
    fallbackSucceeded: false,
    rawContentPersisted: false,
  };
}

function validatePreflight(input: {
  preflight: GovernedModelAdapterPreflight;
  route: TenantModelRoute;
  requestedMaxOutputTokens: number;
}): string | null {
  if (
    !Number.isSafeInteger(input.preflight.estimatedInputTokens) ||
    input.preflight.estimatedInputTokens < 0 ||
    input.preflight.estimatedInputTokens >
      MODEL_GOVERNANCE_PERSISTED_INT_MAX
  ) {
    return "adapter_estimated_input_tokens_invalid";
  }
  if (
    !Number.isSafeInteger(
      input.preflight.estimatedMaxCostUsdMicros,
    ) ||
    input.preflight.estimatedMaxCostUsdMicros < 0 ||
    input.preflight.estimatedMaxCostUsdMicros >
      MODEL_GOVERNANCE_PERSISTED_INT_MAX
  ) {
    return "adapter_estimated_cost_invalid";
  }
  if (
    input.preflight.estimatedInputTokens >
    input.route.maxInputTokens
  ) {
    return "route_input_token_budget_exceeded";
  }
  if (
    input.requestedMaxOutputTokens >
    input.route.maxOutputTokens
  ) {
    return "route_output_token_budget_exceeded";
  }
  if (
    input.preflight.estimatedMaxCostUsdMicros >
    input.route.maxCostUsdMicros
  ) {
    return "route_cost_budget_exceeded";
  }
  return null;
}

type NormalizedKnownAdapterResult<
  TOutput extends GovernedJsonValue,
> = {
  outcome: Exclude<ModelEgressOutcome, "unknown">;
  output: TOutput | null;
  providerRequestRefHash: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  actualCostUsdMicros: number;
  costCurrency: "USD";
  pricingVersion: string;
  costBand: ModelEgressCostBand;
  errorCode: string | null;
  requestDisposition:
    | "not_accepted"
    | "accepted";
  retrySafe: boolean;
};

type NormalizedUnknownAdapterResult = {
  outcome: "unknown";
  output: null;
  providerRequestRefHash: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  actualCostUsdMicros: null;
  costCurrency: null;
  pricingVersion: null;
  costBand: ModelEgressCostBand;
  errorCode: string;
  requestDisposition: "unknown";
  retrySafe: false;
};

type NormalizedAdapterResult<
  TOutput extends GovernedJsonValue,
> =
  | NormalizedKnownAdapterResult<TOutput>
  | NormalizedUnknownAdapterResult;

function normalizeAdapterResult<
  TOutput extends GovernedJsonValue,
>(input: {
  result: GovernedModelAdapterResult<TOutput>;
  requestedMaxOutputTokens: number;
  route: TenantModelRoute;
}): NormalizedAdapterResult<TOutput> {
  const { result } = input;
  const hasOutput = Object.prototype.hasOwnProperty.call(
    result,
    "output",
  );
  const providerRequestRef =
    result.providerRequestRef?.trim() ?? "";
  const providerRequestRefHash =
    providerRequestRef.length > 0 &&
    providerRequestRef.length <= 4_096
      ? sha256(providerRequestRef)
      : null;
  const errorCode =
    result.errorCode &&
    isSafeModelGovernanceIdentifier(result.errorCode) &&
    result.errorCode.length <= 64
      ? result.errorCode
      : null;
  const validUsage =
    validNonNegativeInteger(result.promptTokens) &&
    validNonNegativeInteger(result.completionTokens);
  const knownRequestDisposition =
    result.requestDisposition === "accepted" ||
    result.requestDisposition === "not_accepted";
  const requestReferenceMatchesDisposition =
    (result.requestDisposition === "accepted" &&
      providerRequestRef.length > 0 &&
      providerRequestRef.length <= 4_096) ||
    (result.requestDisposition === "not_accepted" &&
      providerRequestRef.length === 0);
  const validPricingEvidence =
    result.actualCostUsdMicros !== null &&
    Number.isSafeInteger(result.actualCostUsdMicros) &&
    result.actualCostUsdMicros >= 0 &&
    result.actualCostUsdMicros <=
      MODEL_GOVERNANCE_PERSISTED_INT_MAX &&
    result.costCurrency === "USD" &&
    result.pricingVersion === input.route.pricingVersion;
  const costExceeded =
    validPricingEvidence &&
    result.actualCostUsdMicros! > input.route.maxCostUsdMicros;
  const invalidNotAcceptedCost =
    result.requestDisposition === "not_accepted" &&
    result.actualCostUsdMicros !== 0;
  const completionExceeded =
    result.completionTokens !== null &&
    (result.completionTokens >
      input.requestedMaxOutputTokens ||
      result.completionTokens > input.route.maxOutputTokens);
  const promptExceeded =
    result.promptTokens !== null &&
    result.promptTokens > input.route.maxInputTokens;
  let outputIsGovernedJson = false;
  if (hasOutput) {
    try {
      assertGovernedJson(result.output);
      outputIsGovernedJson = true;
    } catch {
      outputIsGovernedJson = false;
    }
  }
  const successShape =
    (result.outcome === "success" ||
      result.outcome === "partial") &&
    result.requestDisposition === "accepted" &&
    providerRequestRef.length > 0 &&
    providerRequestRef.length <= 4_096 &&
    hasOutput &&
    outputIsGovernedJson &&
    validUsage &&
    validPricingEvidence &&
    !costExceeded &&
    !promptExceeded &&
    !completionExceeded &&
    COST_BANDS.has(result.costBand) &&
    (result.outcome !== "success" || errorCode === null);
  if (successShape) {
    return {
      outcome: result.outcome as "success" | "partial",
      output: result.output as TOutput,
      providerRequestRefHash,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      actualCostUsdMicros: result.actualCostUsdMicros!,
      costCurrency: result.costCurrency!,
      pricingVersion: result.pricingVersion!,
      costBand: result.costBand,
      errorCode,
      requestDisposition: "accepted",
      retrySafe: false,
    };
  }

  const explicitFailure =
    result.outcome === "failure" &&
    !hasOutput &&
    validUsage &&
    knownRequestDisposition &&
    requestReferenceMatchesDisposition &&
    validPricingEvidence &&
    !costExceeded &&
    !invalidNotAcceptedCost &&
    COST_BANDS.has(result.costBand) &&
    errorCode !== null;
  if (explicitFailure) {
    return {
      outcome: "failure",
      output: null,
      providerRequestRefHash,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      actualCostUsdMicros: result.actualCostUsdMicros!,
      costCurrency: result.costCurrency!,
      pricingVersion: result.pricingVersion!,
      costBand: result.costBand,
      errorCode,
      requestDisposition: result.requestDisposition as
        | "accepted"
        | "not_accepted",
      retrySafe:
        result.requestDisposition === "not_accepted",
    };
  }

  return {
    outcome: "unknown",
    output: null,
    providerRequestRefHash,
    promptTokens: validUsage ? result.promptTokens : null,
    completionTokens: validUsage
      ? result.completionTokens
      : null,
    actualCostUsdMicros: null,
    costCurrency: null,
    pricingVersion: null,
    costBand: COST_BANDS.has(result.costBand)
      ? result.costBand
      : "unknown",
    errorCode: promptExceeded
      ? "provider_input_budget_exceeded"
      : completionExceeded
        ? "provider_output_budget_exceeded"
        : costExceeded
          ? "provider_cost_budget_exceeded"
          : !knownRequestDisposition
            ? "adapter_request_disposition_unknown"
            : !requestReferenceMatchesDisposition
              ? "adapter_provider_request_ref_invalid"
              : !validPricingEvidence || invalidNotAcceptedCost
                ? "provider_pricing_evidence_invalid"
                : hasOutput && !outputIsGovernedJson
                  ? "adapter_output_not_governed_json"
                  : "adapter_result_contract_invalid",
    requestDisposition: "unknown",
    retrySafe: false,
  };
}

function normalizeReconciliation<
  TOutput extends GovernedJsonValue,
>(input: {
  reconciliation: GovernedModelAdapterReconciliation<TOutput>;
  requestedMaxOutputTokens: number;
  route: TenantModelRoute;
}): ReturnType<typeof normalizeAdapterResult<TOutput>> | null {
  if (input.reconciliation.status === "unknown") {
    return null;
  }
  if (input.reconciliation.status === "not_found") {
    return null;
  }
  const normalized = normalizeAdapterResult({
    result: input.reconciliation.result,
    requestedMaxOutputTokens:
      input.requestedMaxOutputTokens,
    route: input.route,
  });
  return normalized.outcome === "unknown" ? null : normalized;
}

type StoredModelRouteState = NonNullable<
  Awaited<ReturnType<typeof readModelRouteDecision>>
>;
type StoredModelDispatch = NonNullable<
  StoredModelRouteState["dispatch"]
>;

function adapterMatchesStoredDispatch<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
>(input: {
  adapter: NonNullable<
    ReturnType<
      GovernedModelAdapterRegistry<
        TPayload,
        TOutput
      >["resolve"]
    >
  >;
  route: TenantModelRoute;
  dispatch: StoredModelDispatch;
}): boolean {
  const { registration } = input.adapter;
  const { runtime } = input.dispatch;
  return (
    registration.registrationRef ===
      runtime.adapterRegistrationRef &&
    registration.contentHash ===
      runtime.adapterRegistrationHash &&
    registration.adapterKey === runtime.adapterKey &&
    registration.adapterVersion === runtime.adapterVersion &&
    registration.provider === runtime.provider &&
    runtime.provider === input.route.provider &&
    runtime.modelId === input.route.modelId &&
    runtime.modelVersion === input.route.modelVersion &&
    runtime.deploymentForm === input.route.deploymentForm &&
    runtime.jurisdiction === input.route.jurisdiction &&
    runtime.region === input.route.region
  );
}

async function invokeWithTimeout<TOutput>(
  invoke: (signal: AbortSignal) => Promise<TOutput>,
  timeoutMs: number,
): Promise<TOutput> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new GovernedModelGatewayError(
          "adapter_outcome_unknown_after_timeout",
        ),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      invoke(controller.signal),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function reconcileClaimedAttempt<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
>(input: {
  request: GovernedModelGatewayInput<TPayload>;
  decision: ModelRouteDecision;
  stored: StoredModelRouteState;
  dispatch: StoredModelDispatch;
  adapter: NonNullable<
    ReturnType<
      GovernedModelAdapterRegistry<
        TPayload,
        TOutput
      >["resolve"]
    >
  > | null;
  dependencies: GovernedModelGatewayDependencies;
}): Promise<GovernedModelGatewayResult<TOutput>> {
  const startedReceipt =
    input.stored.receipts.find(
      (receipt) => receipt.sequence === 1,
    ) ?? null;
  const inDoubt = (reasonCode: string) =>
    resultWithoutOutput<TOutput>({
      attempt: {
        decision: input.decision,
        startedReceipt,
        terminalReceipt: null,
        status: "in_doubt",
        reasonCode,
        replayed: true,
      },
      fallbackAttempted:
        input.decision.parentDecisionRef !== null,
    });
  const leaseExpiresAt = Date.parse(
    input.dispatch.leaseExpiresAt,
  );
  const now = input.dependencies.now();
  if (
    !Number.isFinite(leaseExpiresAt) ||
    now.getTime() < leaseExpiresAt
  ) {
    return inDoubt("dispatch_lease_active_terminal_missing");
  }
  if (
    !input.adapter ||
    !input.decision.routeSnapshot ||
    !adapterMatchesStoredDispatch({
      adapter: input.adapter,
      route: input.decision.routeSnapshot,
      dispatch: input.dispatch,
    })
  ) {
    return inDoubt(
      "dispatch_reconciliation_adapter_identity_mismatch",
    );
  }
  const reconcile = input.adapter.reconcile;
  if (!reconcile) {
    return inDoubt(
      "dispatch_reconciliation_not_supported",
    );
  }

  let reconciliation: GovernedModelAdapterReconciliation<TOutput>;
  try {
    reconciliation = await invokeWithTimeout(
      (signal) =>
        reconcile({
          workspaceId: input.request.workspaceId,
          route: input.decision.routeSnapshot!,
          taskClass: input.decision.taskClass,
          taskRef: input.decision.taskRef,
          projectedPayloadHash:
            input.decision.projectedPayloadHash,
          requestedMaxOutputTokens:
            input.decision.requestedMaxOutputTokens,
          providerIdempotencyKey:
            input.dispatch.providerIdempotencyKey,
          dispatchClaimHash: input.dispatch.claimHash,
          dispatchRuntimeHash: input.dispatch.runtimeHash,
          signal,
        }),
      input.decision.routeSnapshot.maxLatencyMs,
    );
  } catch {
    return inDoubt("dispatch_reconciliation_failed");
  }
  const normalized = normalizeReconciliation({
    reconciliation,
    requestedMaxOutputTokens:
      input.decision.requestedMaxOutputTokens,
    route: input.decision.routeSnapshot,
  });
  if (!normalized || normalized.outcome === "unknown") {
    return inDoubt("dispatch_reconciliation_inconclusive");
  }

  const finishedAt = input.dependencies.now();
  try {
    const terminal =
      await input.dependencies.recordTerminal({
        authority: GOVERNED_GATEWAY_AUTHORITY,
        workspaceId: input.request.workspaceId,
        decisionId: input.decision.decisionId,
        gatewayRef: input.dispatch.gatewayRef,
        dispatchClaimHash: input.dispatch.claimHash,
        idempotencyKey: stableIdentifier("model-terminal", {
          decisionRef: input.decision.decisionId,
        }),
        outcome: normalized.outcome,
        resolutionSource: "reconcile",
        requestDisposition:
          normalized.requestDisposition,
        providerRequestRefHash:
          normalized.providerRequestRefHash,
        finishedAt,
        latencyMs: null,
        promptTokens: normalized.promptTokens,
        completionTokens: normalized.completionTokens,
        actualCostUsdMicros:
          normalized.actualCostUsdMicros,
        costCurrency: normalized.costCurrency,
        pricingVersion: normalized.pricingVersion,
        costBand: normalized.costBand,
        errorCode: normalized.errorCode,
        fallbackTargetRouteRef: null,
        fallbackReason: null,
        recordedAt: finishedAt,
      });
    return resultWithoutOutput({
      attempt: {
        decision: input.decision,
        startedReceipt,
        terminalReceipt: terminal.receipt,
        status: terminal.receipt.outcome,
        reasonCode: "terminal_reconciled_without_output",
        replayed: terminal.replayed,
      },
      fallbackAttempted:
        input.decision.parentDecisionRef !== null,
    });
  } catch {
    const current = await input.dependencies.readDecision({
      workspaceId: input.request.workspaceId,
      decisionId: input.decision.decisionId,
    });
    const concurrentTerminal = current
      ? terminalReceipt(current.receipts)
      : null;
    if (concurrentTerminal) {
      return resultWithoutOutput({
        attempt: {
          decision: input.decision,
          startedReceipt,
          terminalReceipt: concurrentTerminal,
          status: concurrentTerminal.outcome,
          reasonCode:
            "terminal_receipt_replayed_after_reconciliation",
          replayed: true,
        },
        fallbackAttempted:
          input.decision.parentDecisionRef !== null,
      });
    }
    return inDoubt(
      "dispatch_reconciliation_receipt_persistence_failed",
    );
  }
}

async function executeAttempt<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
>(input: {
  request: GovernedModelGatewayInput<TPayload>;
  projectedPayloadHash: string;
  projectedPayloadBytes: number;
  dependencies: GovernedModelGatewayDependencies;
  registry: GovernedModelAdapterRegistry<TPayload, TOutput>;
  parentDecisionRef: string | null;
  requestedFallbackRouteRef: string | null;
  fallbackReason: string | null;
  allowFallback: boolean;
}): Promise<GovernedModelGatewayResult<TOutput>> {
  const now = input.dependencies.now();
  const projectionReceipt =
    await input.dependencies.readProjectionReceipt({
      workspaceId: input.request.workspaceId,
      receiptId: input.request.projectionReceiptRef,
    });
  if (!projectionReceipt) {
    throw new GovernedModelGatewayError(
      "projection_receipt_not_found",
    );
  }
  const projectionValidation =
    validateGovernedModelProjectionReceipt(
      projectionReceipt,
    );
  if (!projectionValidation.valid) {
    throw new GovernedModelGatewayError(
      "projection_receipt_invalid",
    );
  }
  if (
    projectionReceipt.projectedPayloadHash !==
      input.projectedPayloadHash ||
    projectionReceipt.projectedPayloadBytes !==
      input.projectedPayloadBytes
  ) {
    throw new GovernedModelGatewayError(
      "projection_payload_binding_mismatch",
    );
  }
  if (
    input.request.requestedMaxOutputTokens >
    projectionReceipt.maxOutputTokens
  ) {
    throw new GovernedModelGatewayError(
      "projection_output_token_budget_exceeded",
    );
  }
  const requestKey = input.parentDecisionRef
    ? stableIdentifier("model-fallback", {
        parentDecisionRef: input.parentDecisionRef,
        routeRef: input.requestedFallbackRouteRef,
        projectedPayloadHash: input.projectedPayloadHash,
      })
    : input.request.requestKey;
  const prepared = await input.dependencies.prepareDecision({
    authority: GOVERNED_GATEWAY_AUTHORITY,
    workspaceId: input.request.workspaceId,
    policyKey: input.request.policyKey,
    requestKey,
    taskClass: input.request.taskClass,
    taskRef: input.request.taskRef,
    requestedMaxOutputTokens:
      input.request.requestedMaxOutputTokens,
    allowFallback: input.allowFallback,
    sourceAssetRefs: projectionReceipt.sourceAssetRefs,
    candidateEvidenceRefs:
      projectionReceipt.candidateEvidenceRefs,
    selectedEvidenceRefs:
      projectionReceipt.selectedEvidenceRefs,
    droppedEvidenceRefs:
      projectionReceipt.droppedEvidenceRefs,
    projectionReceiptRef: projectionReceipt.receiptId,
    projectedPayloadHash: input.projectedPayloadHash,
    promptInjectionScanStatus:
      projectionReceipt.promptInjectionScanStatus,
    parentDecisionRef: input.parentDecisionRef,
    requestedFallbackRouteRef:
      input.requestedFallbackRouteRef,
    fallbackReason: input.fallbackReason,
    decisionTtlMs: input.request.decisionTtlMs,
    now,
  });
  const decision = prepared.decision;
  if (
    decision.decision !== "allowed" ||
    !decision.routeSnapshot
  ) {
    return resultWithoutOutput({
      attempt: {
        decision,
        startedReceipt: prepared.startedReceipt,
        terminalReceipt: null,
        status: "blocked",
        reasonCode: decision.reasonCodes[0] ?? null,
        replayed: prepared.replayed,
      },
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }

  const storedBeforeClaim =
    await input.dependencies.readDecision({
      workspaceId: input.request.workspaceId,
      decisionId: decision.decisionId,
    });
  if (!storedBeforeClaim) {
    throw new GovernedModelGatewayError(
      "prepared_model_route_decision_missing",
      decision.decisionId,
    );
  }
  const existingTerminal = terminalReceipt(
    storedBeforeClaim.receipts,
  );
  if (existingTerminal) {
    return resultWithoutOutput({
      attempt: attemptFromStored({
        decision,
        receipts: storedBeforeClaim.receipts,
        status: existingTerminal.outcome,
        reasonCode:
          "terminal_receipt_replayed_without_output",
        replayed: true,
      }),
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }
  const adapter = input.registry.resolve(
    decision.routeSnapshot,
  );
  if (storedBeforeClaim.dispatch) {
    return reconcileClaimedAttempt({
      request: input.request,
      decision,
      stored: storedBeforeClaim,
      dispatch: storedBeforeClaim.dispatch,
      adapter,
      dependencies: input.dependencies,
    });
  }
  if (!adapter) {
    return resultWithoutOutput({
      attempt: {
        decision,
        startedReceipt: prepared.startedReceipt,
        terminalReceipt: null,
        status: "not_dispatched",
        reasonCode: "adapter_not_registered",
        replayed: false,
      },
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }

  let preflight: GovernedModelAdapterPreflight;
  try {
    const observation = await adapter.preflight({
      workspaceId: input.request.workspaceId,
      route: decision.routeSnapshot,
      taskClass: input.request.taskClass,
      projectedPayloadHash: input.projectedPayloadHash,
      projectedPayloadBytes: input.projectedPayloadBytes,
      requestedMaxOutputTokens:
        input.request.requestedMaxOutputTokens,
    });
    preflight = {
      runtime: buildRegisteredAdapterRuntime({
        adapter,
        route: decision.routeSnapshot,
        observation,
      }),
      estimatedInputTokens:
        observation.estimatedInputTokens,
      estimatedMaxCostUsdMicros:
        observation.estimatedMaxCostUsdMicros,
    };
  } catch {
    return resultWithoutOutput({
      attempt: {
        decision,
        startedReceipt: prepared.startedReceipt,
        terminalReceipt: null,
        status: "not_dispatched",
        reasonCode: "adapter_preflight_failed",
        replayed: false,
      },
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }
  const preflightError = validatePreflight({
    preflight,
    route: decision.routeSnapshot,
    requestedMaxOutputTokens:
      input.request.requestedMaxOutputTokens,
  });
  if (preflightError) {
    return resultWithoutOutput({
      attempt: {
        decision,
        startedReceipt: prepared.startedReceipt,
        terminalReceipt: null,
        status: "not_dispatched",
        reasonCode: preflightError,
        replayed: false,
      },
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }

  const claim = await input.dependencies.claimDispatch({
    authority: GOVERNED_GATEWAY_AUTHORITY,
    workspaceId: input.request.workspaceId,
    decisionId: decision.decisionId,
    gatewayRef: input.request.gatewayRef,
    runtime: preflight.runtime,
    now: input.dependencies.now(),
  });
  if (claim.replayed) {
    const storedAfterClaim =
      await input.dependencies.readDecision({
        workspaceId: input.request.workspaceId,
        decisionId: decision.decisionId,
      });
    const replayedTerminal = storedAfterClaim
      ? terminalReceipt(storedAfterClaim.receipts)
      : null;
    if (
      storedAfterClaim?.dispatch &&
      !replayedTerminal
    ) {
      return reconcileClaimedAttempt({
        request: input.request,
        decision,
        stored: storedAfterClaim,
        dispatch: storedAfterClaim.dispatch,
        adapter,
        dependencies: input.dependencies,
      });
    }
    return resultWithoutOutput({
      attempt: {
        decision,
        startedReceipt: claim.startedReceipt,
        terminalReceipt: replayedTerminal,
        status: replayedTerminal?.outcome ?? "in_doubt",
        reasonCode: replayedTerminal
          ? "terminal_receipt_replayed_without_output"
          : "dispatch_claim_replayed_terminal_missing",
        replayed: true,
      },
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }

  const providerIdempotencyKey =
    claim.providerIdempotencyKey;
  const invocationStartedAt = input.dependencies.now();
  let normalized: ReturnType<
    typeof normalizeAdapterResult<TOutput>
  >;
  try {
    const adapterResult = await invokeWithTimeout(
      (signal) =>
        adapter!.invoke({
          workspaceId: input.request.workspaceId,
          route: decision.routeSnapshot!,
          taskClass: input.request.taskClass,
          taskRef: input.request.taskRef,
          projectedPayload: input.request.projectedPayload,
          projectedPayloadHash: input.projectedPayloadHash,
          requestedMaxOutputTokens:
            input.request.requestedMaxOutputTokens,
          providerIdempotencyKey,
          dispatchClaimHash: claim.claimHash,
          dispatchRuntimeHash: claim.runtimeHash,
          signal,
        }),
      decision.routeSnapshot.maxLatencyMs,
    );
    normalized = normalizeAdapterResult({
      result: adapterResult,
      requestedMaxOutputTokens:
        input.request.requestedMaxOutputTokens,
      route: decision.routeSnapshot,
    });
  } catch (error) {
    normalized = {
      outcome: "unknown",
      output: null,
      providerRequestRefHash: null,
      promptTokens: null,
      completionTokens: null,
      actualCostUsdMicros: null,
      costCurrency: null,
      pricingVersion: null,
      costBand: "unknown",
      errorCode:
        error instanceof GovernedModelGatewayError
          ? error.code
          : "adapter_outcome_unknown",
      requestDisposition: "unknown",
      retrySafe: false,
    };
  }
  if (normalized.outcome === "unknown") {
    return resultWithoutOutput({
      attempt: {
        decision,
        startedReceipt: claim.startedReceipt,
        terminalReceipt: null,
        status: "in_doubt",
        reasonCode:
          normalized.errorCode ?? "adapter_outcome_unknown",
        replayed: false,
      },
      fallbackAttempted: input.parentDecisionRef !== null,
    });
  }
  const finishedAt = input.dependencies.now();
  const startedAtMs = invocationStartedAt.getTime();
  const finishedAtMs = Math.max(
    finishedAt.getTime(),
    startedAtMs,
  );
  const normalizedFinishedAt = new Date(finishedAtMs);
  const latencyMs = Math.max(0, finishedAtMs - startedAtMs);
  const fallbackTargetRouteRef =
    decision.allowFallback &&
    normalized.outcome === "failure" &&
    normalized.retrySafe
      ? decision.routeSnapshot.fallbackRouteIds[0] ?? null
      : null;
  const fallbackReason = fallbackTargetRouteRef
    ? normalized.errorCode
    : null;

  let terminal: Awaited<
    ReturnType<
      GovernedModelGatewayDependencies["recordTerminal"]
    >
  >;
  try {
    terminal = await input.dependencies.recordTerminal({
      authority: GOVERNED_GATEWAY_AUTHORITY,
      workspaceId: input.request.workspaceId,
      decisionId: decision.decisionId,
      gatewayRef: input.request.gatewayRef,
      dispatchClaimHash: claim.claimHash,
      idempotencyKey: stableIdentifier("model-terminal", {
        decisionRef: decision.decisionId,
      }),
      outcome: normalized.outcome,
      resolutionSource: "invoke",
      requestDisposition:
        normalized.requestDisposition,
      providerRequestRefHash:
        normalized.providerRequestRefHash,
      finishedAt: normalizedFinishedAt,
      latencyMs,
      promptTokens: normalized.promptTokens,
      completionTokens: normalized.completionTokens,
      actualCostUsdMicros: normalized.actualCostUsdMicros,
      costCurrency: normalized.costCurrency,
      pricingVersion: normalized.pricingVersion,
      costBand: normalized.costBand,
      errorCode: normalized.errorCode,
      fallbackTargetRouteRef,
      fallbackReason,
      recordedAt: normalizedFinishedAt,
    });
  } catch {
    throw new GovernedModelGatewayError(
      "terminal_receipt_persistence_failed_output_withheld",
      decision.decisionId,
    );
  }
  const currentAttempt: GovernedModelGatewayAttempt = {
    decision,
    startedReceipt: claim.startedReceipt,
    terminalReceipt: terminal.receipt,
    status: normalized.outcome,
    reasonCode: normalized.errorCode,
    replayed: terminal.replayed,
  };

  if (fallbackTargetRouteRef && fallbackReason) {
    const fallback = await executeAttempt({
      ...input,
      parentDecisionRef: decision.decisionId,
      requestedFallbackRouteRef: fallbackTargetRouteRef,
      fallbackReason,
      allowFallback: false,
    });
    return {
      ...fallback,
      attempts: [currentAttempt, ...fallback.attempts],
      fallbackAttempted: true,
      fallbackSucceeded:
        fallback.status === "success" ||
        fallback.status === "partial",
    };
  }

  return {
    status: normalized.outcome,
    output:
      normalized.outcome === "success" ||
      normalized.outcome === "partial"
        ? normalized.output
        : null,
    attempts: [currentAttempt],
    selectedDecisionRef: decision.decisionId,
    fallbackAttempted: input.parentDecisionRef !== null,
    fallbackSucceeded:
      input.parentDecisionRef !== null &&
      (normalized.outcome === "success" ||
        normalized.outcome === "partial"),
    rawContentPersisted: false,
  };
}

export function createGovernedModelGateway<
  TPayload extends GovernedJsonValue = GovernedJsonValue,
  TOutput extends GovernedJsonValue = GovernedJsonValue,
>(
  options: {
    adapters?: readonly GovernedModelProviderAdapter<
      TPayload,
      TOutput
    >[];
    registry?: GovernedModelAdapterRegistry<
      TPayload,
      TOutput
    >;
    dependencies?: Partial<GovernedModelGatewayDependencies>;
  } = {},
) {
  if (options.adapters && options.registry) {
    throw new GovernedModelGatewayError(
      "adapter_registry_configuration_ambiguous",
    );
  }
  const resolvedDependencies: GovernedModelGatewayDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...options.dependencies,
  };
  const registry =
    options.registry ??
    createGovernedModelAdapterRegistry(
      options.adapters ?? [],
    );
  return async function executeGovernedModelRequest(
    request: GovernedModelGatewayInput<TPayload>,
  ): Promise<GovernedModelGatewayResult<TOutput>> {
    if (
      !isSafeModelGovernanceRef(request.gatewayRef) ||
      !Number.isSafeInteger(request.requestedMaxOutputTokens) ||
      request.requestedMaxOutputTokens <= 0 ||
      request.requestedMaxOutputTokens >
        MODEL_GOVERNANCE_PERSISTED_INT_MAX
    ) {
      throw new GovernedModelGatewayError(
        "governed_model_request_invalid",
      );
    }
    assertGovernedJson(request.projectedPayload);
    const canonicalPayload = canonicalJson(
      request.projectedPayload,
    );
    const projectedPayloadHash = sha256(canonicalPayload);
    const projectedPayloadBytes = Buffer.byteLength(
      canonicalPayload,
      "utf8",
    );
    return executeAttempt({
      request,
      projectedPayloadHash,
      projectedPayloadBytes,
      dependencies: resolvedDependencies,
      registry,
      parentDecisionRef: null,
      requestedFallbackRouteRef: null,
      fallbackReason: null,
      allowFallback: request.allowFallback ?? false,
    });
  };
}

export const executeGovernedModelRequest =
  createGovernedModelGateway();
