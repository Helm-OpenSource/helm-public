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
    ).toBe(4753);
  });

  it("prices qwen3.8-max at parity with qwen3.7-max instead of the unknown bucket", () => {
    // Until 2026-10-31 this pinned null (unpublished price → "unknown" bucket).
    // The cn-beijing list now prices qwen3.8-max identically to qwen3.7-max, so
    // the two must estimate the same: 1188 + 3565 = 4753 minor units for
    // 1M prompt + 1M completion.
    const estimate = (model: string) =>
      estimateLLMCallCostMinorUnit({
        provider: "qwen",
        model,
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      });
    expect(estimate("qwen3.8-max")).toBe(4753);
    expect(estimate("qwen3.8-max")).toBe(estimate("qwen3.7-max"));
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
