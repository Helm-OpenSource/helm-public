import { describe, expect, it } from "vitest";
import {
  evaluateMarketSignalProviderClass,
  runMarketSignalProviderClassEval,
} from "./market-signal-provider-class";

describe("agentic governance market-signal provider class gate", () => {
  it("allows managed cloud agent signals only as offline candidates after trust proofs", () => {
    const decision = evaluateMarketSignalProviderClass({
      id: "managed-cloud-ready",
      providerClass: "managed_cloud_agent",
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
    });

    expect(decision.disposition).toBe("allow_offline_candidate");
    expect(decision.reasonCodes).toContain("trust_proofs_complete");
    expect(decision.runtimeEvaluationAllowed).toBe(false);
    expect(decision.mayCreateDirectMustPush).toBe(false);
    expect(decision.mayWriteMemory).toBe(false);
  });

  it("keeps managed cloud or workspace agent signals review-required until trust proofs are complete", () => {
    const decision = evaluateMarketSignalProviderClass({
      id: "managed-cloud-missing-proof",
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
    });

    expect(decision.disposition).toBe("review_required");
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "tenant_isolation_unproven",
        "trace_incomplete",
        "permission_summary_missing",
      ]),
    );
    expect(decision.mayBecomeProviderRuntime).toBe(false);
  });

  it("quarantines memory/context signals that request active memory or ranking authority", () => {
    const decision = evaluateMarketSignalProviderClass({
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
      requestedDirectMustPush: false,
      requestedFinalRankingInfluence: true,
    });

    expect(decision.disposition).toBe("quarantine");
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "active_memory_write_forbidden",
        "final_ranking_influence_forbidden",
      ]),
    );
  });

  it("rejects workflow framework signals that try to become a Helm workflow builder", () => {
    const decision = evaluateMarketSignalProviderClass({
      id: "workflow-builder-attempt",
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
    });

    expect(decision.disposition).toBe("reject");
    expect(decision.reasonCodes).toContain("workflow_builder_forbidden");
  });

  it("passes the offline fixture gate without granting runtime or write authority", () => {
    const summary = runMarketSignalProviderClassEval();

    expect(summary.totalSignals).toBeGreaterThanOrEqual(8);
    expect(summary.failedFixtures).toBe(0);
    expect(summary.runtimeEvaluationAllowed).toBe(0);
    expect(summary.providerRuntimeCreated).toBe(0);
    expect(summary.directMustPushAllowed).toBe(0);
    expect(summary.memoryWriteAllowed).toBe(0);
    expect(summary.finalRankingInfluenceAllowed).toBe(0);
    expect(summary.workflowBuilderAllowed).toBe(0);
    expect(summary.overallPassed).toBe(true);
  });
});
