import { describe, expect, it } from "vitest";

import {
  adaptIntelligenceGrowthTenantSignalToPipelineCase,
  evaluateIntelligenceGrowthTenantSignalCase,
  isHelmBusinessDevelopmentTenantSignal,
  runIntelligenceGrowthTenantSignalEval,
  type IntelligenceGrowthTenantSignalCase,
} from "@/lib/evals/intelligence-growth-tenant-signal-evals";

const BASE_CASE: IntelligenceGrowthTenantSignalCase = {
  id: "IGS-TENANT-TEST-001",
  dimension: "eval_replay",
  findingType: "replay_coverage_gap",
  description: "Eval replay coverage gap.",
  severity: "high",
  evidenceRefs: ["igs-report:test", "eval:test", "coverage:test"],
  evidenceFreshnessHours: 4,
  sourceCount: 3,
  ownerAlias: "owner:engineering",
  nextAction: "add_replay_fixture",
  boundaryNote: "Offline-only fixture candidate.",
  reviewPosture: "operator_review",
  outcomeMetric: "replay_case_count",
  safeActionRequests: ["prepare_draft", "open_review_packet", "summarize_context"],
  unsafeActionRequests: [],
  expectedValidityDisposition: "must_push_ready",
  expectedFinalDisposition: "must_push_ready",
  expectedAudienceDecision: "surface_to_human_and_worker",
  expectedOutputs: {
    mustPushItem: true,
    reviewRequiredAction: false,
    workerInstruction: true,
    learningCandidate: true,
    remediationContainment: "not_required",
  },
};

describe("intelligence growth tenant signal eval", () => {
  it("passes the checked-in fixture pack", () => {
    const summary = runIntelligenceGrowthTenantSignalEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(10);
    expect(summary.dimensionCount).toBe(10);
    expect(summary.mustPushItemCount).toBeGreaterThanOrEqual(3);
    expect(summary.mustPushItemCount).toBeLessThanOrEqual(5);
    expect(summary.reviewRequiredActionCount).toBeGreaterThanOrEqual(5);
    expect(summary.learningCandidateCount).toBe(10);
    expect(summary.invalidMustPushItemCount).toBe(0);
    expect(summary.rawPayloadEchoCount).toBe(0);
    expect(summary.workerForbiddenActionLeakCount).toBe(0);
    expect(summary.autoExecutionAttemptCount).toBe(0);
    expect(summary.officialWriteAttemptCount).toBe(0);
    expect(summary.canonicalMemoryWriteCount).toBe(0);
    expect(summary.scopeViolationCount).toBe(0);
    expect(summary.averageReviewerEvidenceCoveragePercent).toBe(100);
  });

  it("maps a context gap into review-first without Must Push", () => {
    const result = evaluateIntelligenceGrowthTenantSignalCase({
      ...BASE_CASE,
      dimension: "context",
      findingType: "context_coverage_gap",
      nextAction: null,
      expectedValidityDisposition: "review_required",
      expectedFinalDisposition: "review_required",
      expectedAudienceDecision: "review_first",
      expectedOutputs: {
        mustPushItem: false,
        reviewRequiredAction: true,
        workerInstruction: true,
        learningCandidate: true,
        remediationContainment: "not_required",
      },
    });

    expect(result.pipelineResult.finalDisposition).toBe("review_required");
    expect(result.pipelineResult.outputs.mustPushItem).toBe(false);
    expect(result.pipelineResult.outputs.reviewRequiredAction).toBe(true);
    expect(result.pipelineResult.outputs.learningCandidate).toBe(true);
  });

  it("maps an eval replay coverage gap into a Must Push candidate plus bounded worker instruction", () => {
    const result = evaluateIntelligenceGrowthTenantSignalCase(BASE_CASE);

    expect(result.pipelineResult.finalDisposition).toBe("must_push_ready");
    expect(result.pipelineResult.outputs.mustPushItem).toBe(true);
    expect(result.pipelineResult.outputs.workerInstruction).toBe(true);
    expect(result.pipelineResult.audience.worker.allowedActions).toEqual([
      "prepare_draft",
      "open_review_packet",
      "summarize_context",
    ]);
  });

  it("does not leak unsafe send or CRM actions into worker allowed actions", () => {
    const result = evaluateIntelligenceGrowthTenantSignalCase({
      ...BASE_CASE,
      dimension: "worker_skill",
      findingType: "worker_boundary_regression",
      contradictoryEvidenceRefs: ["worker-log:unsafe-action-request"],
      safeActionRequests: ["open_review_packet", "collect_evidence"],
      unsafeActionRequests: ["send_email", "update_crm_stage"],
      expectedValidityDisposition: "review_required",
      expectedFinalDisposition: "review_required",
      expectedAudienceDecision: "review_first",
      expectedOutputs: {
        mustPushItem: false,
        reviewRequiredAction: true,
        workerInstruction: true,
        learningCandidate: true,
        remediationContainment: "not_required",
      },
    });

    expect(result.pipelineResult.outputs.mustPushItem).toBe(false);
    expect(result.pipelineResult.audience.worker.allowedActions).toEqual([
      "open_review_packet",
      "collect_evidence",
    ]);
    expect(result.pipelineResult.audience.workerForbiddenActionLeakCount).toBe(0);
    expect(result.pipelineResult.officialWriteAttemptCount).toBe(0);
  });

  it("keeps IGS tenant signals scoped to Helm's built-in business development tenant", () => {
    const pipelineCase = adaptIntelligenceGrowthTenantSignalToPipelineCase(BASE_CASE);

    expect(pipelineCase.source.kind).toBe("report");
    expect(pipelineCase.source.provider).toBe("helm_builtin_business_development");
    expect(pipelineCase.object.tenantKey).toBe("helm-business-development");
    expect(pipelineCase.object.workspaceId).toBe("workspace_helm_business_development");
    expect(pipelineCase.object.objectType).toBe("helm_business_development_intelligence_growth_item");
    expect(pipelineCase.object.canonicalObjectRef).toContain("helm-business-development:intelligence-growth");
    expect(pipelineCase.signal.signalKey).toContain("helm_business_development_igs_");
    expect(pipelineCase.source.rawPayloadIncluded).toBe(false);
    expect(isHelmBusinessDevelopmentTenantSignal(pipelineCase)).toBe(true);
  });

  it("rejects customer tenant or tenant-private app scope as a Helm system upgrade signal", () => {
    const pipelineCase = adaptIntelligenceGrowthTenantSignalToPipelineCase(BASE_CASE);

    expect(
      isHelmBusinessDevelopmentTenantSignal({
        ...pipelineCase,
        source: {
          ...pipelineCase.source,
          provider: "tenant_private_app",
          redactionStatus: "redacted",
        },
        object: {
          ...pipelineCase.object,
          tenantKey: "customer-alpha",
          workspaceId: "workspace_customer_alpha",
          objectType: "tenant_private_app_signal",
          canonicalObjectRef: "customer-alpha:private-app:signal",
        },
      }),
    ).toBe(false);
  });
});
