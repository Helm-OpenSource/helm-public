import { describe, expect, it } from "vitest";

import {
  MEMORY_BENCH_FIXTURES,
  classifySessionEvidence,
  runMemoryBench,
} from "@/lib/evals/memory-bench-evals";

describe("memory bench (memory vs session separation)", () => {
  it("uses at least 10 synthetic session evidence candidates", () => {
    expect(MEMORY_BENCH_FIXTURES.length).toBeGreaterThanOrEqual(10);
  });

  it("never auto-promotes session evidence to durable memory", () => {
    for (const candidate of MEMORY_BENCH_FIXTURES) {
      const decision = classifySessionEvidence(candidate);
      expect(decision.autoPromoted).toBe(false);
      expect(decision.promotionState).not.toBe("promoted");
      if (decision.promotionState === "memory_promotion_candidate") {
        expect(decision.requiredHumanReview).toBe(true);
      }
    }
  });

  it("passes the bench: false promotion = 0, boundary = 0, pass^5 stable", () => {
    const metrics = runMemoryBench(MEMORY_BENCH_FIXTURES, 5);
    expect(metrics.totalCandidates).toBeGreaterThanOrEqual(10);
    expect(metrics.falsePromotionRate).toBe(0);
    expect(metrics.boundaryViolationCount).toBe(0);
    expect(metrics.passN).toBe(5);
    expect(metrics.structurallyStable).toBe(true);
    expect(metrics.passed).toBe(true);
  });
});
