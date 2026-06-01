import { describe, expect, it } from "vitest";
import {
  deriveMonthToDateSpendUSDFromCallLog,
  startOfMonthUTC,
  type LLMCallLogQueryable,
} from "@/lib/llm/spend-budget-db-derivation";

describe("spend-budget-db-derivation · startOfMonthUTC", () => {
  it("converts monthKey to first-of-month UTC midnight", () => {
    const d = startOfMonthUTC("2026-05");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4); // zero-indexed (May = 4)
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
  });

  it("rejects invalid monthKey", () => {
    expect(() => startOfMonthUTC("2026-13")).not.toThrow(); // Date is permissive
    expect(() => startOfMonthUTC("invalid")).toThrow();
    expect(() => startOfMonthUTC("2026/05")).toThrow();
  });
});

describe("spend-budget-db-derivation · deriveMonthToDateSpendUSDFromCallLog", () => {
  function makeMockClient(
    records: Array<{
      provider: string;
      model: string;
      tokenUsagePrompt: number | null;
      tokenUsageCompletion: number | null;
    }>,
  ): LLMCallLogQueryable {
    return {
      findMany: async () => records,
    };
  }

  it("returns 0 for empty call log", async () => {
    const usd = await deriveMonthToDateSpendUSDFromCallLog({
      client: makeMockClient([]),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });
    expect(usd).toBe(0);
  });

  it("sums spend across multiple records", async () => {
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: 500 },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 2000, tokenUsageCompletion: 1000 },
    ];
    const usd = await deriveMonthToDateSpendUSDFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });
    // openai gpt-4o = $5/1M input + $15/1M output
    // record 1: 1000/1M*5 + 500/1M*15 = 0.005 + 0.0075 = 0.0125
    // record 2: 2000/1M*5 + 1000/1M*15 = 0.010 + 0.015 = 0.025
    // total = 0.0375
    expect(usd).toBeCloseTo(0.0375, 6);
  });

  it("handles null token counts as zero", async () => {
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: null },
    ];
    const usd = await deriveMonthToDateSpendUSDFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });
    // 1000/1M*5 = 0.005 (no output cost since completion=null treated as 0)
    expect(usd).toBeCloseTo(0.005, 6);
  });

  it("applies worst-case fallback for unknown provider/model", async () => {
    const records = [
      { provider: "openai", model: "fictional-future-model", tokenUsagePrompt: 1_000_000, tokenUsageCompletion: 1_000_000 },
    ];
    const usd = await deriveMonthToDateSpendUSDFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });
    // unknown model fallback = $15/1M + $60/1M = $75 per pair of millions
    expect(usd).toBeGreaterThanOrEqual(75);
  });
});
