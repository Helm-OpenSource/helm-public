import { describe, expect, it } from "vitest";
import {
  PRICING_TABLE_VERSION,
  estimateInputTokensFromText,
  estimateSpendUSD,
  resolveTokenCost,
} from "@/lib/llm/token-cost-table";

describe("token-cost-table · pricing table version", () => {
  it("exposes a version string", () => {
    expect(PRICING_TABLE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("token-cost-table · resolveTokenCost", () => {
  it("returns known pricing for openai:gpt-4o", () => {
    const cost = resolveTokenCost("openai", "gpt-4o");
    expect(cost.inputPerMillion).toBe(5.0);
    expect(cost.outputPerMillion).toBe(15.0);
  });

  it("returns known pricing for qwen:qwen3.6-plus", () => {
    const cost = resolveTokenCost("qwen", "qwen3.6-plus");
    expect(cost.inputPerMillion).toBeGreaterThan(0);
    expect(cost.outputPerMillion).toBeGreaterThan(0);
  });

  it("prices the qwen3.7 models this deployment standardises on", () => {
    // Regression guard: before 2026-08-18 none of these were in the table, so
    // every call on them was costed at the $15/$60 unknown fallback — roughly
    // 50x the real price of plus. A silently over-counted spend figure is the
    // failure mode this test exists to prevent.
    const plus = resolveTokenCost("qwen", "qwen3.7-plus");
    expect(plus.inputPerMillion).toBe(0.276);
    expect(plus.outputPerMillion).toBe(1.101);

    const flash = resolveTokenCost("qwen", "qwen3.7-flash");
    expect(flash.inputPerMillion).toBe(0.165);

    const max = resolveTokenCost("qwen", "qwen3.7-max");
    expect(max.inputPerMillion).toBe(1.65);

    // Every entry must say where its number came from; a price with no
    // provenance cannot be re-verified when the vendor changes it.
    for (const cost of [plus, flash, max]) {
      expect(cost.source).toContain("2026-08-18");
      expect(cost.source).not.toContain("unknown");
    }
  });

  it("leaves the unpriced qwen3.8-max on the worst-case fallback", () => {
    // Intentional, not an omission: the vendor had not published a price as of
    // 2026-08-18. Pinned so that nobody closes the gap with a guessed number —
    // if this test starts failing because a real entry was added, update it
    // together with the source citation in the table.
    const cost = resolveTokenCost("qwen", "qwen3.8-max");
    expect(cost.source).toContain("unknown");
    expect(cost.inputPerMillion).toBeGreaterThan(resolveTokenCost("qwen", "qwen3.7-max").inputPerMillion);
  });

  it("returns expensive worst-case fallback for unknown model", () => {
    const cost = resolveTokenCost("openai", "gpt-99-unknown");
    expect(cost.inputPerMillion).toBeGreaterThanOrEqual(15);
    expect(cost.outputPerMillion).toBeGreaterThanOrEqual(60);
    expect(cost.source).toContain("unknown");
  });
});

describe("token-cost-table · estimateSpendUSD", () => {
  it("computes input+output spend correctly", () => {
    const spend = estimateSpendUSD({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(spend).toBe(20.0); // 5 + 15
  });

  it("scales linearly with tokens", () => {
    const half = estimateSpendUSD({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 500_000,
      outputTokens: 500_000,
    });
    expect(half).toBeCloseTo(10.0, 4);
  });

  it("uses worst-case for unknown model", () => {
    const spend = estimateSpendUSD({
      provider: "openai",
      model: "definitely-not-a-real-model",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(spend).toBeGreaterThanOrEqual(75); // 15 + 60
  });
});

describe("token-cost-table · estimateInputTokensFromText", () => {
  it("estimates ceiling tokens from char length", () => {
    expect(estimateInputTokensFromText("")).toBe(0);
    expect(estimateInputTokensFromText("a")).toBe(1);
    expect(estimateInputTokensFromText("abc")).toBe(2);
    expect(estimateInputTokensFromText("a".repeat(1500))).toBe(1000);
  });
});
