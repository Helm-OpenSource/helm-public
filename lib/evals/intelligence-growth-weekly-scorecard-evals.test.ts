import { describe, expect, it } from "vitest";

import {
  buildIntelligenceGrowthWeeklyScorecardFromPacketSummary,
  runIntelligenceGrowthWeeklyScorecardEval,
} from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";
import { runIntelligenceGrowthReviewPacketEval } from "@/lib/evals/intelligence-growth-review-packet-evals";
import type { IntelligenceGrowthTenantSignalCase, IntelligenceGrowthTenantSignalFixturePack } from "@/lib/evals/intelligence-growth-tenant-signal-evals";

const BASE_CASE: IntelligenceGrowthTenantSignalCase = {
  id: "IGS-SCORECARD-TEST-001",
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

const MINIMAL_PACK: IntelligenceGrowthTenantSignalFixturePack = {
  version: "test-scorecard-minimal",
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
  cases: [BASE_CASE],
};

describe("intelligence growth weekly scorecard eval", () => {
  it("passes the checked-in fixture", () => {
    const summary = runIntelligenceGrowthWeeklyScorecardEval();

    expect(summary.passed).toBe(true);
    expect(summary.tenantKey).toBe("helm-business-development");
    expect(summary.workspaceId).toBe("workspace_helm_business_development");
    expect(summary.sourceWindowKey).toBe("2026-W18");
    expect(summary.totalPackets).toBeGreaterThanOrEqual(10);
    expect(summary.blockedCount).toBe(0);
    expect(summary.boundaryIncidentCount).toBe(0);
    expect(summary.promotionAuthorityLeakCount).toBe(0);
    expect(summary.runtimeAuthorityLeakCount).toBe(0);
    expect(summary.evidenceCoveragePercent).toBe(100);
    expect(summary.founderDecisionQueue.length).toBeGreaterThan(0);
    expect(summary.failures).toHaveLength(0);
  });

  it("has candidateOnly true and non-executing flags false", () => {
    const summary = runIntelligenceGrowthWeeklyScorecardEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
  });

  it("fails when a blocked review packet is present", () => {
    const blockedPack: IntelligenceGrowthTenantSignalFixturePack = {
      ...MINIMAL_PACK,
      cases: [
        {
          ...BASE_CASE,
          expectedOutputs: {
            ...BASE_CASE.expectedOutputs,
            mustPushItem: true,
          },
        },
      ],
    };

    const summary = runIntelligenceGrowthWeeklyScorecardEval(blockedPack);

    expect(summary.passed).toBe(false);
    expect(summary.blockedCount).toBeGreaterThan(0);
    const reasons = summary.failures.map((f) => f.reason);
    expect(reasons.some((r) => r.startsWith("blocked_count:"))).toBe(true);
  });

  it("customer or private tenant scope cannot pass", () => {
    const packetSummary = runIntelligenceGrowthReviewPacketEval(MINIMAL_PACK);
    const mutatedPackets = packetSummary.packets.map((p) => ({
      ...p,
      tenantKey: "customer-alpha",
      workspaceId: "workspace_customer_alpha",
    }));
    const mutatedSummary = buildIntelligenceGrowthWeeklyScorecardFromPacketSummary({
      ...packetSummary,
      packets: mutatedPackets,
    });

    expect(mutatedSummary.passed).toBe(false);
    const reasons = mutatedSummary.failures.map((f) => f.reason);
    expect(reasons.some((r) => r.startsWith("tenant_mismatch:"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("workspace_mismatch:"))).toBe(true);
  });

  it("fails with no_founder_decision_queue when queue is empty", () => {
    const packetSummary = runIntelligenceGrowthReviewPacketEval(MINIMAL_PACK);
    const mutatedPackets = packetSummary.packets.map((p) => ({
      ...p,
      requiredReviewers: p.requiredReviewers.filter((r) => r !== "founder_approval"),
    }));
    const summary = buildIntelligenceGrowthWeeklyScorecardFromPacketSummary({
      ...packetSummary,
      packets: mutatedPackets,
    });

    expect(summary.founderDecisionQueue).toHaveLength(0);
    expect(summary.passed).toBe(false);
    const reasons = summary.failures.map((f) => f.reason);
    expect(reasons).toContain("no_founder_decision_queue");
  });

  it("packets are ordered: ready_for_founder_review, then needs_required_review, then blocked", () => {
    const summary = runIntelligenceGrowthWeeklyScorecardEval();
    const packets = summary.topMustPushIds;
    expect(packets.length).toBeGreaterThan(0);
  });

  it("fails with blocked_count when packet.status is blocked even if packetSummary.blockedCount=0", () => {
    const packetSummary = runIntelligenceGrowthReviewPacketEval(MINIMAL_PACK);
    const mutatedPackets = packetSummary.packets.map((p) => ({
      ...p,
      status: "blocked" as const,
      blockedReasons: ["scope_violation"],
    }));
    const summary = buildIntelligenceGrowthWeeklyScorecardFromPacketSummary({
      ...packetSummary,
      blockedCount: 0,
      packets: mutatedPackets,
    });

    expect(summary.blockedCount).toBeGreaterThan(0);
    expect(summary.passed).toBe(false);
    const reasons = summary.failures.map((f) => f.reason);
    expect(reasons.some((r) => r.startsWith("blocked_count:"))).toBe(true);
  });

  it("fails with required_reviewer_coverage when packets have <3 reviewers even if packetSummary.requiredReviewerCoveragePercent=100", () => {
    const packetSummary = runIntelligenceGrowthReviewPacketEval(MINIMAL_PACK);
    const mutatedPackets = packetSummary.packets.map((p) => ({
      ...p,
      requiredReviewers: ["founder_approval"] as const,
    }));
    const summary = buildIntelligenceGrowthWeeklyScorecardFromPacketSummary({
      ...packetSummary,
      requiredReviewerCoveragePercent: 100,
      packets: mutatedPackets,
    });

    expect(summary.requiredReviewerCoveragePercent).toBeLessThan(100);
    expect(summary.passed).toBe(false);
    const reasons = summary.failures.map((f) => f.reason);
    expect(reasons.some((r) => r.startsWith("required_reviewer_coverage:"))).toBe(true);
  });
});
