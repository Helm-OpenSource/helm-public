import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthDeterminismEval,
  type IntelligenceGrowthDeterminismProducer,
} from "@/lib/evals/intelligence-growth-determinism-evals";

describe("runIntelligenceGrowthDeterminismEval", () => {
  it("passes when all checked-in IGS offline gates are stable after runAt scrubbing", () => {
    const summary = runIntelligenceGrowthDeterminismEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
    expect(summary.repeatCount).toBe(3);
    expect(summary.producerCount).toBe(19);
    expect(summary.stableProducerCount).toBe(19);
    expect(summary.unstableProducerCount).toBe(0);
    expect(summary.volatileFieldAllowlist).toEqual(["runAt"]);
  });

  it("keeps determinism gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthDeterminismEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("allows runAt as the only volatile report field", () => {
    let counter = 0;
    const producer: IntelligenceGrowthDeterminismProducer = {
      id: "allowed_run_at",
      run: () => {
        counter += 1;
        return {
          runAt: `2026-05-02T00:00:0${counter}.000Z`,
          stable: true,
        };
      },
    };

    const summary = runIntelligenceGrowthDeterminismEval({
      repeatCount: 3,
      producers: [producer],
    });

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
  });

  it("fails when a producer emits an unexpected volatile field", () => {
    let counter = 0;
    const producer: IntelligenceGrowthDeterminismProducer = {
      id: "unexpected_timestamp",
      run: () => {
        counter += 1;
        return {
          generatedAt: `2026-05-02T00:00:0${counter}.000Z`,
          stable: true,
        };
      },
    };

    const summary = runIntelligenceGrowthDeterminismEval({
      repeatCount: 3,
      producers: [producer],
    });

    expect(summary.passed).toBe(false);
    expect(summary.unstableProducerCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "unstable_output")).toBe(true);
  });

  it("fails when a producer output is randomly ordered or random-valued", () => {
    let counter = 0;
    const producer: IntelligenceGrowthDeterminismProducer = {
      id: "nondeterministic_value",
      run: () => {
        counter += 1;
        return {
          value: counter,
        };
      },
    };

    const summary = runIntelligenceGrowthDeterminismEval({
      repeatCount: 3,
      producers: [producer],
    });

    expect(summary.passed).toBe(false);
    expect(summary.failures.some((failure) => failure.producerId === "nondeterministic_value")).toBe(true);
  });

  it("fails when repeat count is less than two", () => {
    const summary = runIntelligenceGrowthDeterminismEval({
      repeatCount: 1,
      producers: [{ id: "stable", run: () => ({ stable: true }) }],
    });

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((failure) => failure.reason === "repeat_count_must_be_at_least_2"),
    ).toBe(true);
  });
});
