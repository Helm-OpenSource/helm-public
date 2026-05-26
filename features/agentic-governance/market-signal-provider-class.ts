/**
 * Helm Agentic Governance — Market Signal Provider Class Gate
 *
 * Offline evaluator for newly observed agentic market signals. It classifies
 * provider classes and artifact classes without creating provider runtimes,
 * storing credentials, adding schemas, or granting execution authority.
 */

export type MarketSignalProviderClass =
  | "workspace_agent"
  | "managed_cloud_agent"
  | "workflow_framework"
  | "memory_context_system"
  | "agentic_enterprise_control_tower";

export type MarketSignalArtifactClass =
  | "governance_trace_candidate"
  | "permission_summary_candidate"
  | "boundary_reason_code_candidate"
  | "memory_evidence_candidate"
  | "framework_risk_note";

export type MarketSignalProviderClassDisposition =
  | "allow_offline_candidate"
  | "review_required"
  | "watch_only"
  | "reject"
  | "quarantine";

export type MarketSignalProviderClassReasonCode =
  | "trust_proofs_complete"
  | "tenant_isolation_unproven"
  | "redaction_missing"
  | "trace_incomplete"
  | "permission_summary_missing"
  | "review_boundary_missing"
  | "provider_api_forbidden"
  | "credential_forbidden"
  | "runtime_adapter_forbidden"
  | "schema_forbidden"
  | "ui_action_forbidden"
  | "workflow_builder_forbidden"
  | "active_memory_write_forbidden"
  | "direct_must_push_forbidden"
  | "final_ranking_influence_forbidden"
  | "framework_risk_only"
  | "memory_evidence_only";

export interface MarketSignalProviderClassInput {
  readonly id: string;
  readonly providerClass: MarketSignalProviderClass;
  readonly artifactClass: MarketSignalArtifactClass;
  readonly tenantIsolationProven: boolean;
  readonly redactionProven: boolean;
  readonly traceCompletenessProven: boolean;
  readonly connectorPermissionSummaryPresent: boolean;
  readonly reviewRequiredBoundaryPresent: boolean;
  readonly requestedProviderApi: boolean;
  readonly requestedCredential: boolean;
  readonly requestedRuntimeAdapter: boolean;
  readonly requestedSchema: boolean;
  readonly requestedUiAction: boolean;
  readonly requestedWorkflowBuilder: boolean;
  readonly requestedDirectMemoryWrite: boolean;
  readonly requestedDirectMustPush: boolean;
  readonly requestedFinalRankingInfluence: boolean;
  readonly expectedDisposition?: MarketSignalProviderClassDisposition;
}

export interface MarketSignalProviderClassDecision {
  readonly id: string;
  readonly disposition: MarketSignalProviderClassDisposition;
  readonly reasonCodes: readonly MarketSignalProviderClassReasonCode[];
  readonly runtimeEvaluationAllowed: false;
  readonly mayBecomeProviderRuntime: false;
  readonly mayCreateDirectMustPush: false;
  readonly mayWriteMemory: false;
  readonly mayInfluenceFinalRanking: false;
  readonly boundaryNote: string;
}

export interface MarketSignalProviderClassEval {
  readonly totalSignals: number;
  readonly passedFixtures: number;
  readonly failedFixtures: number;
  readonly runtimeEvaluationAllowed: 0;
  readonly providerRuntimeCreated: 0;
  readonly directMustPushAllowed: 0;
  readonly memoryWriteAllowed: 0;
  readonly finalRankingInfluenceAllowed: 0;
  readonly workflowBuilderAllowed: 0;
  readonly missingTrustProofAccepted: number;
  readonly results: readonly {
    readonly id: string;
    readonly expectedDisposition: MarketSignalProviderClassDisposition;
    readonly actualDisposition: MarketSignalProviderClassDisposition;
    readonly passed: boolean;
    readonly reasonCodes: readonly MarketSignalProviderClassReasonCode[];
  }[];
  readonly overallPassed: boolean;
}

export const MARKET_SIGNAL_PROVIDER_CLASS_FIXTURES: readonly MarketSignalProviderClassInput[] = [
  {
    id: "workspace-agent-complete-proof",
    providerClass: "workspace_agent",
    artifactClass: "governance_trace_candidate",
    tenantIsolationProven: true,
    redactionProven: true,
    traceCompletenessProven: true,
    connectorPermissionSummaryPresent: true,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "allow_offline_candidate",
  },
  {
    id: "managed-cloud-agent-complete-proof",
    providerClass: "managed_cloud_agent",
    artifactClass: "permission_summary_candidate",
    tenantIsolationProven: true,
    redactionProven: true,
    traceCompletenessProven: true,
    connectorPermissionSummaryPresent: true,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "allow_offline_candidate",
  },
  {
    id: "managed-cloud-agent-missing-trust-proof",
    providerClass: "managed_cloud_agent",
    artifactClass: "permission_summary_candidate",
    tenantIsolationProven: false,
    redactionProven: true,
    traceCompletenessProven: false,
    connectorPermissionSummaryPresent: false,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "review_required",
  },
  {
    id: "workspace-agent-runtime-request",
    providerClass: "workspace_agent",
    artifactClass: "governance_trace_candidate",
    tenantIsolationProven: true,
    redactionProven: true,
    traceCompletenessProven: true,
    connectorPermissionSummaryPresent: true,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: true,
    requestedCredential: true,
    requestedRuntimeAdapter: true,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "reject",
  },
  {
    id: "workflow-framework-risk-note",
    providerClass: "workflow_framework",
    artifactClass: "framework_risk_note",
    tenantIsolationProven: false,
    redactionProven: true,
    traceCompletenessProven: false,
    connectorPermissionSummaryPresent: false,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "watch_only",
  },
  {
    id: "workflow-framework-builder-request",
    providerClass: "workflow_framework",
    artifactClass: "framework_risk_note",
    tenantIsolationProven: false,
    redactionProven: true,
    traceCompletenessProven: false,
    connectorPermissionSummaryPresent: false,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: true,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "reject",
  },
  {
    id: "memory-context-evidence-candidate",
    providerClass: "memory_context_system",
    artifactClass: "memory_evidence_candidate",
    tenantIsolationProven: true,
    redactionProven: true,
    traceCompletenessProven: true,
    connectorPermissionSummaryPresent: true,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "allow_offline_candidate",
  },
  {
    id: "memory-context-authority-leak",
    providerClass: "memory_context_system",
    artifactClass: "memory_evidence_candidate",
    tenantIsolationProven: true,
    redactionProven: true,
    traceCompletenessProven: true,
    connectorPermissionSummaryPresent: true,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: false,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: true,
    requestedDirectMustPush: true,
    requestedFinalRankingInfluence: true,
    expectedDisposition: "quarantine",
  },
  {
    id: "control-tower-ui-action-request",
    providerClass: "agentic_enterprise_control_tower",
    artifactClass: "boundary_reason_code_candidate",
    tenantIsolationProven: true,
    redactionProven: true,
    traceCompletenessProven: true,
    connectorPermissionSummaryPresent: true,
    reviewRequiredBoundaryPresent: true,
    requestedProviderApi: false,
    requestedCredential: false,
    requestedRuntimeAdapter: false,
    requestedSchema: false,
    requestedUiAction: true,
    requestedWorkflowBuilder: false,
    requestedDirectMemoryWrite: false,
    requestedDirectMustPush: false,
    requestedFinalRankingInfluence: false,
    expectedDisposition: "reject",
  },
];

export function evaluateMarketSignalProviderClass(
  signal: MarketSignalProviderClassInput,
): MarketSignalProviderClassDecision {
  const reasonCodes = new Set<MarketSignalProviderClassReasonCode>();

  addTrustProofReasons(signal, reasonCodes);
  addForbiddenRequestReasons(signal, reasonCodes);

  if (hasQuarantineAuthorityLeak(reasonCodes)) {
    return buildMarketSignalDecision(signal.id, "quarantine", reasonCodes);
  }

  if (hasForbiddenRuntimeOrSurfaceRequest(reasonCodes)) {
    return buildMarketSignalDecision(signal.id, "reject", reasonCodes);
  }

  if (signal.providerClass === "workflow_framework") {
    reasonCodes.add("framework_risk_only");
    return buildMarketSignalDecision(signal.id, "watch_only", reasonCodes);
  }

  if (signal.providerClass === "memory_context_system") {
    reasonCodes.add("memory_evidence_only");
  }

  if (hasMissingTrustProof(reasonCodes)) {
    return buildMarketSignalDecision(signal.id, "review_required", reasonCodes);
  }

  reasonCodes.add("trust_proofs_complete");
  return buildMarketSignalDecision(signal.id, "allow_offline_candidate", reasonCodes);
}

export function runMarketSignalProviderClassEval(): MarketSignalProviderClassEval {
  const results = MARKET_SIGNAL_PROVIDER_CLASS_FIXTURES.map((fixture) => {
    const decision = evaluateMarketSignalProviderClass(fixture);
    const expectedDisposition = fixture.expectedDisposition ?? "review_required";
    return {
      id: fixture.id,
      expectedDisposition,
      actualDisposition: decision.disposition,
      passed:
        decision.disposition === expectedDisposition &&
        decision.runtimeEvaluationAllowed === false &&
        decision.mayBecomeProviderRuntime === false &&
        decision.mayCreateDirectMustPush === false &&
        decision.mayWriteMemory === false &&
        decision.mayInfluenceFinalRanking === false,
      reasonCodes: decision.reasonCodes,
    };
  });

  const decisions = MARKET_SIGNAL_PROVIDER_CLASS_FIXTURES.map(evaluateMarketSignalProviderClass);
  const missingTrustProofAccepted = decisions.filter((decision) =>
    decision.reasonCodes.some((reasonCode) =>
      [
        "tenant_isolation_unproven",
        "redaction_missing",
        "trace_incomplete",
        "permission_summary_missing",
        "review_boundary_missing",
      ].includes(reasonCode),
    ) && decision.disposition === "allow_offline_candidate",
  ).length;
  const passedFixtures = results.filter((result) => result.passed).length;

  return {
    totalSignals: results.length,
    passedFixtures,
    failedFixtures: results.length - passedFixtures,
    runtimeEvaluationAllowed: 0,
    providerRuntimeCreated: 0,
    directMustPushAllowed: 0,
    memoryWriteAllowed: 0,
    finalRankingInfluenceAllowed: 0,
    workflowBuilderAllowed: 0,
    missingTrustProofAccepted,
    results,
    overallPassed:
      results.every((result) => result.passed) && missingTrustProofAccepted === 0,
  };
}

function addTrustProofReasons(
  signal: MarketSignalProviderClassInput,
  reasonCodes: Set<MarketSignalProviderClassReasonCode>,
) {
  if (!signal.tenantIsolationProven) reasonCodes.add("tenant_isolation_unproven");
  if (!signal.redactionProven) reasonCodes.add("redaction_missing");
  if (!signal.traceCompletenessProven) reasonCodes.add("trace_incomplete");
  if (!signal.connectorPermissionSummaryPresent) reasonCodes.add("permission_summary_missing");
  if (!signal.reviewRequiredBoundaryPresent) reasonCodes.add("review_boundary_missing");
}

function addForbiddenRequestReasons(
  signal: MarketSignalProviderClassInput,
  reasonCodes: Set<MarketSignalProviderClassReasonCode>,
) {
  if (signal.requestedProviderApi) reasonCodes.add("provider_api_forbidden");
  if (signal.requestedCredential) reasonCodes.add("credential_forbidden");
  if (signal.requestedRuntimeAdapter) reasonCodes.add("runtime_adapter_forbidden");
  if (signal.requestedSchema) reasonCodes.add("schema_forbidden");
  if (signal.requestedUiAction) reasonCodes.add("ui_action_forbidden");
  if (signal.requestedWorkflowBuilder) reasonCodes.add("workflow_builder_forbidden");
  if (signal.requestedDirectMemoryWrite) reasonCodes.add("active_memory_write_forbidden");
  if (signal.requestedDirectMustPush) reasonCodes.add("direct_must_push_forbidden");
  if (signal.requestedFinalRankingInfluence) {
    reasonCodes.add("final_ranking_influence_forbidden");
  }
}

function hasMissingTrustProof(reasonCodes: Set<MarketSignalProviderClassReasonCode>) {
  return (
    reasonCodes.has("tenant_isolation_unproven") ||
    reasonCodes.has("redaction_missing") ||
    reasonCodes.has("trace_incomplete") ||
    reasonCodes.has("permission_summary_missing") ||
    reasonCodes.has("review_boundary_missing")
  );
}

function hasQuarantineAuthorityLeak(reasonCodes: Set<MarketSignalProviderClassReasonCode>) {
  return (
    reasonCodes.has("active_memory_write_forbidden") ||
    reasonCodes.has("direct_must_push_forbidden") ||
    reasonCodes.has("final_ranking_influence_forbidden")
  );
}

function hasForbiddenRuntimeOrSurfaceRequest(
  reasonCodes: Set<MarketSignalProviderClassReasonCode>,
) {
  return (
    reasonCodes.has("provider_api_forbidden") ||
    reasonCodes.has("credential_forbidden") ||
    reasonCodes.has("runtime_adapter_forbidden") ||
    reasonCodes.has("schema_forbidden") ||
    reasonCodes.has("ui_action_forbidden") ||
    reasonCodes.has("workflow_builder_forbidden")
  );
}

function buildMarketSignalDecision(
  id: string,
  disposition: MarketSignalProviderClassDisposition,
  reasonCodes: Set<MarketSignalProviderClassReasonCode>,
): MarketSignalProviderClassDecision {
  return {
    id,
    disposition,
    reasonCodes: [...reasonCodes],
    runtimeEvaluationAllowed: false,
    mayBecomeProviderRuntime: false,
    mayCreateDirectMustPush: false,
    mayWriteMemory: false,
    mayInfluenceFinalRanking: false,
    boundaryNote:
      "Market signal provider classes remain offline evidence for governance review; they do not grant provider runtime, credentials, schema, UI actions, direct Must Push, memory write, or final ranking authority.",
  };
}
