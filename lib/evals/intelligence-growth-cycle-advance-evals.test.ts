import requeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthCycleAdvanceEval,
} from "@/lib/evals/intelligence-growth-cycle-advance-evals";
import type {
  IntelligenceGrowthLearningRequeueCandidate,
  IntelligenceGrowthLearningRequeueFixture,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";

type MutableRequeueFixture = Omit<IntelligenceGrowthLearningRequeueFixture, "candidates"> & {
  candidates: IntelligenceGrowthLearningRequeueCandidate[];
};

function cloneFixture(): MutableRequeueFixture {
  return structuredClone(requeueFixtureData as IntelligenceGrowthLearningRequeueFixture) as MutableRequeueFixture;
}

describe("runIntelligenceGrowthCycleAdvanceEval", () => {
  it("passes with checked-in fixture chain", () => {
    const summary = runIntelligenceGrowthCycleAdvanceEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
    expect(summary.totalIntakeCandidates).toBe(10);
    expect(summary.expectedIntakeCandidateCount).toBe(10);
    expect(summary.intakeCoveragePercent).toBe(100);
  });

  it("keeps next-cycle intake candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthCycleAdvanceEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when the next cycle window is wrong", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      nextWindowKey: "2026-W20",
    };

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.windowMismatchCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "window_mismatch")).toBe(true);
  });

  it("fails when a candidate is missing from the next-cycle intake", () => {
    const fixture = cloneFixture();
    fixture.candidates = fixture.candidates.slice(1);

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.missingIntakeCandidateCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "missing_intake_candidate")).toBe(true);
  });

  it("fails when an intake source packet drifts", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      sourceDecisionPacketId: "igs-review-packet:wrong:IGS-TENANT-CONTEXT-001",
    };

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.sourcePacketMismatchCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "source_packet_mismatch")).toBe(true);
  });

  it("fails when decision status mapping drifts", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      status: "ready_for_founder_review",
    };

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.statusMismatchCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "status_mismatch")).toBe(true);
  });

  it("fails when a candidate leaves Helm business-development scope", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      tenantKey: "customer-tenant-acme",
    };

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.scopeMismatchCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "scope_mismatch")).toBe(true);
  });

  it("fails when a source candidate requests production authority", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      officialWriteRequested: true,
    };

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "source_unauthorized_flag")).toBe(true);
  });

  it("fails when source raw customer data enters the cycle", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      rawCustomerDataIncluded: true,
    };

    const summary = runIntelligenceGrowthCycleAdvanceEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.rawCustomerDataIncidentCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((failure) =>
        failure.reason.startsWith("raw_customer_data_incident_count"),
      ),
    ).toBe(true);
  });
});
