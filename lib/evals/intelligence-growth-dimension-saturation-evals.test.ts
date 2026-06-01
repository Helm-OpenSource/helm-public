import requeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthDimensionSaturationEval,
} from "@/lib/evals/intelligence-growth-dimension-saturation-evals";
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

describe("runIntelligenceGrowthDimensionSaturationEval", () => {
  it("passes when next-cycle intake covers all intelligence dimensions once", () => {
    const summary = runIntelligenceGrowthDimensionSaturationEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalIntakeCandidates).toBe(10);
    expect(summary.expectedDimensionCount).toBe(10);
    expect(summary.coveredDimensionCount).toBe(10);
    expect(summary.dimensionCoveragePercent).toBe(100);
    expect(summary.missingDimensions).toHaveLength(0);
    expect(summary.duplicateDimensionCount).toBe(0);
  });

  it("keeps saturation candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthDimensionSaturationEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when a dimension is missing from next-cycle intake", () => {
    const fixture = cloneFixture();
    fixture.candidates = fixture.candidates.slice(1);

    const summary = runIntelligenceGrowthDimensionSaturationEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.missingDimensions).toContain("context");
    expect(summary.failures.some((failure) => failure.reason === "missing_dimension")).toBe(true);
  });

  it("fails when a dimension is duplicated in the fixture intake", () => {
    const fixture = cloneFixture();
    fixture.candidates[1] = {
      ...fixture.candidates[1],
      candidateId: "IGS-TENANT-CONTEXT-002-v2",
      sourceDecisionPacketId: "igs-review-packet:context:IGS-TENANT-CONTEXT-001",
    };

    const summary = runIntelligenceGrowthDimensionSaturationEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.duplicateDimensionCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "duplicate_dimension")).toBe(true);
  });

  it("fails when a dimension reference is invalid", () => {
    const fixture = cloneFixture();
    fixture.candidates[0] = {
      ...fixture.candidates[0],
      sourceDecisionPacketId: "igs-review-packet:unknown:IGS-TENANT-CONTEXT-001",
    };

    const summary = runIntelligenceGrowthDimensionSaturationEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.failures.some((failure) => failure.reason.startsWith("invalid_dimension_ref"))).toBe(true);
  });
});
