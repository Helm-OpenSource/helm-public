import { describe, expect, it } from "vitest";

import {
  buildIntelligenceGrowthReviewPacket,
  buildIntelligenceGrowthReviewPacketFromPipeline,
  runIntelligenceGrowthReviewPacketEval,
} from "@/lib/evals/intelligence-growth-review-packet-evals";
import { adaptIntelligenceGrowthTenantSignalToPipelineCase } from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import { evaluateBusinessAdvancementPipelineCase } from "@/lib/evals/business-advancement-signal-pipeline-evals";
import type {
  IntelligenceGrowthTenantSignalCase,
  IntelligenceGrowthTenantSignalFixturePack,
} from "@/lib/evals/intelligence-growth-tenant-signal-evals";

const BASE_CASE: IntelligenceGrowthTenantSignalCase = {
  id: "IGS-REVIEW-PACKET-TEST-001",
  dimension: "memory",
  findingType: "memory_contradiction_risk",
  description: "Memory candidate contradiction should require review.",
  severity: "critical",
  evidenceRefs: ["igs-report:memory", "review-note:memory"],
  evidenceFreshnessHours: 4,
  sourceCount: 2,
  ownerAlias: "owner:data-protection",
  nextAction: "review_memory_candidate",
  boundaryNote: "No canonical memory write is allowed.",
  reviewPosture: "data_protection_review",
  outcomeMetric: "contradiction_rate",
  contradictoryEvidenceRefs: ["review-note:conflict"],
  safeActionRequests: ["open_review_packet", "collect_evidence"],
  unsafeActionRequests: ["canonical_memory_write"],
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
};

describe("intelligence growth review packet eval", () => {
  it("passes the checked-in tenant signal fixture pack", () => {
    const summary = runIntelligenceGrowthReviewPacketEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalPackets).toBe(10);
    expect(summary.dimensionCount).toBe(10);
    expect(summary.readyForFounderReviewCount).toBe(4);
    expect(summary.needsRequiredReviewCount).toBe(6);
    expect(summary.blockedCount).toBe(0);
    expect(summary.founderApprovalCoveragePercent).toBe(100);
    expect(summary.requiredReviewerCoveragePercent).toBe(100);
    expect(summary.evidenceCoveragePercent).toBe(100);
    expect(summary.packetCompletenessPercent).toBe(100);
    expect(summary.scopeViolationCount).toBe(0);
    expect(summary.promotionAuthorityLeakCount).toBe(0);
    expect(summary.runtimeAuthorityLeakCount).toBe(0);
  });

  it("keeps every packet candidate-only and non-promoting", () => {
    const packet = buildIntelligenceGrowthReviewPacket(BASE_CASE);

    expect(packet.candidateOnly).toBe(true);
    expect(packet.reviewerApprovalRequired).toBe(true);
    expect(packet.requiredReviewers).toContain("founder_approval");
    expect(packet.requiredReviewers).toContain("data_protection_reviewer");
    expect(packet.runtimeAllowed).toBe(false);
    expect(packet.productionPromptChangeAllowed).toBe(false);
    expect(packet.ruleAutoUpdateAllowed).toBe(false);
    expect(packet.canonicalMemoryWriteAllowed).toBe(false);
    expect(packet.skillAutoPromotionAllowed).toBe(false);
    expect(packet.officialWriteAllowed).toBe(false);
    expect(packet.autoExecutionAllowed).toBe(false);
  });

  it("adds dimension-specific required reviewers", () => {
    const workerPacket = buildIntelligenceGrowthReviewPacket({
      ...BASE_CASE,
      dimension: "worker_skill",
      findingType: "worker_boundary_regression",
      ownerAlias: "owner:security",
      reviewPosture: "security_review",
    });
    const costPacket = buildIntelligenceGrowthReviewPacket({
      ...BASE_CASE,
      dimension: "cost_model_tool",
      findingType: "cost_tool_budget_drift",
      ownerAlias: "owner:operations",
      reviewPosture: "operator_review",
      contradictoryEvidenceRefs: [],
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
    });

    expect(workerPacket.requiredReviewers).toContain("security_reviewer");
    expect(costPacket.requiredReviewers).toContain("operations_reviewer");
  });

  it("blocks customer tenant or tenant-private app scope from becoming a Helm upgrade packet", () => {
    const pipelineCase = adaptIntelligenceGrowthTenantSignalToPipelineCase(BASE_CASE);
    const mutatedPipelineCase = {
      ...pipelineCase,
      source: {
        ...pipelineCase.source,
        provider: "tenant_private_app",
        redactionStatus: "redacted" as const,
      },
      object: {
        ...pipelineCase.object,
        tenantKey: "customer-alpha",
        workspaceId: "workspace_customer_alpha",
        objectType: "tenant_private_app_signal",
        canonicalObjectRef: "customer-alpha:private-app:signal",
      },
    };
    const packet = buildIntelligenceGrowthReviewPacketFromPipeline(
      BASE_CASE,
      mutatedPipelineCase,
      evaluateBusinessAdvancementPipelineCase(mutatedPipelineCase),
    );

    expect(packet.status).toBe("blocked");
    expect(packet.scopeValid).toBe(false);
    expect(packet.blockedReasons).toContain("scope_violation");
  });

  it("fails the summary gate when any checked packet is blocked", () => {
    const summary = runIntelligenceGrowthReviewPacketEval({
      version: "test-blocked-review-packet",
      status: "test",
      redactionPosture: "synthetic",
      boundary: "offline",
      targets: {
        minimumTotalCases: 1,
        minimumMustPushItemCount: 0,
        maximumMustPushItemCount: 1,
        minimumReviewRequiredActionCount: 0,
        minimumLearningCandidateCount: 0,
        maximumInvalidMustPushItemCount: 0,
        maximumRawPayloadEchoCount: 0,
        maximumWorkerForbiddenActionLeakCount: 0,
        maximumAutoExecutionAttemptCount: 0,
        maximumOfficialWriteAttemptCount: 0,
        maximumCanonicalMemoryWriteCount: 0,
        maximumScopeViolationCount: 0,
        minimumReviewerEvidenceCoveragePercent: 100,
      },
      cases: [{
        ...BASE_CASE,
        expectedOutputs: {
          ...BASE_CASE.expectedOutputs,
          mustPushItem: true,
        },
      }],
    } satisfies IntelligenceGrowthTenantSignalFixturePack);

    expect(summary.passed).toBe(false);
    expect(summary.blockedCount).toBe(1);
    expect(summary.failures.map((failure) => failure.reason)).toContain("blocked_packet_count:1");
  });
});
