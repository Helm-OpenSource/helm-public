import { describe, expect, it } from "vitest";
import {
  bucketEstimatedCostMinorUnit,
  estimateLLMCallCostMinorUnit,
  resolveBudgetState,
} from "@/lib/self-tenant-health/cost";

describe("self-tenant LLM cost estimates", () => {
  it("estimates known model costs in minor units", () => {
    expect(
      estimateLLMCallCostMinorUnit({
        provider: "qwen",
        model: "qwen3.6-plus",
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      }),
    ).toBe(3200);
  });

  it("estimates the qwen3.7 models rather than bucketing them as unknown", () => {
    // 1M prompt + 1M completion == promptMinorUnit + completionMinorUnit.
    expect(
      estimateLLMCallCostMinorUnit({
        provider: "qwen",
        model: "qwen3.7-plus",
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      }),
    ).toBe(992);
    expect(
      estimateLLMCallCostMinorUnit({
        provider: "qwen",
        model: "qwen3.7-max",
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      }),
    ).toBe(4800);
  });

  it("prices qwen3.8-max at the CNY list price, identical to qwen3.7-max", () => {
    const estimate = (model: string) =>
      estimateLLMCallCostMinorUnit({
        provider: "qwen",
        model,
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      });
    expect(estimate("qwen3.8-max")).toBe(4800);
    expect(estimate("qwen3.8-max")).toBe(estimate("qwen3.7-max"));
  });

  it("does not understate list price at bucket and budget thresholds", () => {
    const perCall = estimateLLMCallCostMinorUnit({
      provider: "qwen",
      model: "qwen3.8-max",
      promptTokens: 100_000,
      completionTokens: 0,
    });
    expect(perCall).toBe(120);
    const total = (calls: number) => calls * (perCall ?? 0);
    expect(bucketEstimatedCostMinorUnit(total(83))).toBe("cny_0_100");
    expect(bucketEstimatedCostMinorUnit(total(84))).toBe("cny_100_1000");
    expect(resolveBudgetState({ estimatedCostMinorUnit: total(84), monthlyLimitMinorUnit: 10_000 })).toBe("blocked");
    expect(bucketEstimatedCostMinorUnit(total(833))).toBe("cny_100_1000");
    expect(bucketEstimatedCostMinorUnit(total(834))).toBe("cny_1000_10000");
    expect(bucketEstimatedCostMinorUnit(total(8_333))).toBe("cny_1000_10000");
    expect(bucketEstimatedCostMinorUnit(total(8_334))).toBe("cny_10000_plus");
  });

  it("fails closed for unknown models instead of treating them as free", () => {
    expect(
      estimateLLMCallCostMinorUnit({
        provider: "unknown-provider",
        model: "unknown-model",
        promptTokens: 10_000,
        completionTokens: 10_000,
      }),
    ).toBeNull();
  });

  it("buckets estimated costs instead of exposing exact spend", () => {
    expect(bucketEstimatedCostMinorUnit(null)).toBe("unknown");
    expect(bucketEstimatedCostMinorUnit(9_999)).toBe("cny_0_100");
    expect(bucketEstimatedCostMinorUnit(10_000)).toBe("cny_100_1000");
    expect(bucketEstimatedCostMinorUnit(100_000)).toBe("cny_1000_10000");
    expect(bucketEstimatedCostMinorUnit(1_000_000)).toBe("cny_10000_plus");
  });

  it("resolves budget posture without enforcing runtime hard caps", () => {
    expect(
      resolveBudgetState({
        estimatedCostMinorUnit: 79,
        monthlyLimitMinorUnit: 100,
        warningThresholdPercent: 80,
      }),
    ).toBe("ok");
    expect(
      resolveBudgetState({
        estimatedCostMinorUnit: 80,
        monthlyLimitMinorUnit: 100,
        warningThresholdPercent: 80,
      }),
    ).toBe("watch");
    expect(
      resolveBudgetState({
        estimatedCostMinorUnit: 100,
        monthlyLimitMinorUnit: 100,
        warningThresholdPercent: 80,
      }),
    ).toBe("blocked");
  });
});
