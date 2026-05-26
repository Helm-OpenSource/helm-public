import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthChainIntegrityEval,
  type IntelligenceGrowthChainStageSummaries,
} from "@/lib/evals/intelligence-growth-chain-integrity-evals";
import { runIntelligenceGrowthDecisionOutcomeEval } from "@/lib/evals/intelligence-growth-decision-outcome-evals";
import { runIntelligenceGrowthLearningRequeueEval } from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import { runIntelligenceGrowthReviewPacketEval } from "@/lib/evals/intelligence-growth-review-packet-evals";
import { runIntelligenceGrowthTenantSignalEval } from "@/lib/evals/intelligence-growth-tenant-signal-evals";
import { runIntelligenceGrowthWeeklyScorecardEval } from "@/lib/evals/intelligence-growth-weekly-scorecard-evals";

function baseSummaries(): IntelligenceGrowthChainStageSummaries {
  return {
    tenantSignal: runIntelligenceGrowthTenantSignalEval(),
    reviewPacket: runIntelligenceGrowthReviewPacketEval(),
    weeklyScorecard: runIntelligenceGrowthWeeklyScorecardEval(),
    decisionOutcome: runIntelligenceGrowthDecisionOutcomeEval(),
    learningRequeue: runIntelligenceGrowthLearningRequeueEval(),
  };
}

describe("runIntelligenceGrowthChainIntegrityEval", () => {
  it("passes with checked-in fixture chain", () => {
    const summary = runIntelligenceGrowthChainIntegrityEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
    expect(summary.continuityPass).toBe(true);
    expect(summary.stageCounts).toEqual({
      tenantSignals: 10,
      reviewPackets: 10,
      weeklyPackets: 10,
      decisionOutcomes: 10,
      expectedLearningCandidates: 10,
      learningRequeueCandidates: 10,
    });
  });

  it("keeps the aggregate gate offline and non-executing", () => {
    const summary = runIntelligenceGrowthChainIntegrityEval();

    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when an upstream stage fails", () => {
    const summaries = baseSummaries();
    const summary = runIntelligenceGrowthChainIntegrityEval({
      allowInjectedSummariesForTesting: true,
      summaries: {
        ...summaries,
        reviewPacket: {
          ...summaries.reviewPacket,
          passed: false,
          failures: [{ packetId: "__summary__", reason: "forced_failure" }],
        },
      },
    });

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContainEqual({ stage: "reviewPacket", reason: "stage_failed" });
  });

  it("fails when stage counts drift", () => {
    const summaries = baseSummaries();
    const summary = runIntelligenceGrowthChainIntegrityEval({
      allowInjectedSummariesForTesting: true,
      summaries: {
        ...summaries,
        weeklyScorecard: {
          ...summaries.weeklyScorecard,
          totalPackets: 9,
        },
      },
    });

    expect(summary.passed).toBe(false);
    expect(summary.continuityPass).toBe(false);
    expect(summary.failures.some((failure) => failure.reason.includes("weekly_packet_count_mismatch"))).toBe(true);
  });

  it("fails when an unauthorized production change incident appears", () => {
    const summaries = baseSummaries();
    const summary = runIntelligenceGrowthChainIntegrityEval({
      allowInjectedSummariesForTesting: true,
      summaries: {
        ...summaries,
        decisionOutcome: {
          ...summaries.decisionOutcome,
          unauthorizedProductionChangeCount: 1,
        },
      },
    });

    expect(summary.passed).toBe(false);
    expect(summary.totalUnauthorizedIncidentCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((failure) =>
        failure.reason.startsWith("unauthorized_production_change_count"),
      ),
    ).toBe(true);
  });

  it("fails when raw customer data appears downstream", () => {
    const summaries = baseSummaries();
    const summary = runIntelligenceGrowthChainIntegrityEval({
      allowInjectedSummariesForTesting: true,
      summaries: {
        ...summaries,
        learningRequeue: {
          ...summaries.learningRequeue,
          rawCustomerDataIncidentCount: 1,
        },
      },
    });

    expect(summary.passed).toBe(false);
    expect(summary.totalRawDataIncidentCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((failure) =>
        failure.reason.startsWith("raw_customer_data_incident_count"),
      ),
    ).toBe(true);
  });

  it("fails when scope drifts away from the Helm business-development tenant", () => {
    const summaries = baseSummaries();
    const summary = runIntelligenceGrowthChainIntegrityEval({
      allowInjectedSummariesForTesting: true,
      summaries: {
        ...summaries,
        learningRequeue: {
          ...summaries.learningRequeue,
          tenantKey: "customer-tenant-acme",
        },
      },
    });

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((failure) =>
        failure.reason.includes("tenant_key_scope_mismatch"),
      ),
    ).toBe(true);
  });

  it("fails when coverage drops below 100 percent", () => {
    const summaries = baseSummaries();
    const summary = runIntelligenceGrowthChainIntegrityEval({
      allowInjectedSummariesForTesting: true,
      summaries: {
        ...summaries,
        reviewPacket: {
          ...summaries.reviewPacket,
          evidenceCoveragePercent: 90,
        },
      },
    });

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "evidence_coverage:90",
      ),
    ).toBe(true);
  });

  it("rejects injected summaries unless the test-only flag is explicit", () => {
    const summary = runIntelligenceGrowthChainIntegrityEval({
      summaries: baseSummaries(),
    });

    expect(summary.passed).toBe(false);
    expect(summary.executionMode).toBe("injected_for_test");
    expect(summary.failures).toContainEqual({
      stage: "chain",
      reason: "injected_summaries_not_allowed_without_test_flag",
    });
  });
});
