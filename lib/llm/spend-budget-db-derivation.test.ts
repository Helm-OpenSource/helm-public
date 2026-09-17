import { describe, expect, it } from "vitest";
import {
  deriveMonthToDateConsumptionFromCallLog,
  deriveMonthToDateSpendUSDFromCallLog,
  startOfMonthUTC,
  startOfNextMonthUTC,
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

  it("derives the exclusive upper bound, rolling the year at December", () => {
    expect(startOfNextMonthUTC("2026-05").toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(startOfNextMonthUTC("2026-12").toISOString()).toBe("2027-01-01T00:00:00.000Z");
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
      fallbackReason?: string | null;
    }>,
    capture?: { where?: unknown },
  ): LLMCallLogQueryable {
    return {
      findMany: async (args) => {
        if (capture) capture.where = args.where;
        return records.map((row) => ({ fallbackReason: null, ...row }));
      },
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

  it("does NOT treat a null token count as zero — it is an unknown, not a measurement", async () => {
    // This test previously asserted the opposite ("handles null token counts as
    // zero") and so encoded the defect: `?? 0` made a call whose usage the
    // provider never reported indistinguishable from a call that consumed
    // nothing. A half-reported row is not a partial measurement either — adding
    // a real prompt count to a defaulted completion count yields a number that
    // looks measured and is not.
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: null },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: 500 },
    ];
    const consumption = await deriveMonthToDateConsumptionFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });

    // Only the complete row is measured: 1000/1M*5 + 500/1M*15 = 0.0125
    expect(consumption.measuredUSD).toBeCloseTo(0.0125, 6);
    expect(consumption.measuredCalls).toBe(1);
    expect(consumption.unknownCalls).toBe(2);
    expect(consumption.notConsumedCalls).toBe(0);
  });

  it("counts a call the provider answered but we rejected — success is not the criterion", async () => {
    // A PII rejection, a parse failure and a mid-stream transport error all ran
    // on the provider's side and were charged. The query used to filter
    // `success: true`, so they contributed nothing to the derived total.
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: 500, fallbackReason: "policy_pii_in_output" },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: 500, fallbackReason: "output_parse_failed" },
    ];
    const consumption = await deriveMonthToDateConsumptionFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });

    expect(consumption.measuredCalls).toBe(2);
    expect(consumption.measuredUSD).toBeCloseTo(0.025, 6);
  });

  it("excludes calls refused before the provider was contacted", async () => {
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null, fallbackReason: "policy_rate_limited" },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null, fallbackReason: "policy_max_tokens_exceeded" },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null, fallbackReason: "policy_spend_budget_exceeded" },
    ];
    const consumption = await deriveMonthToDateConsumptionFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });

    expect(consumption.notConsumedCalls).toBe(3);
    expect(consumption.unknownCalls).toBe(0);
    expect(consumption.measuredUSD).toBe(0);
  });

  it("treats an unregistered fallback reason as unknown, not as not-consumed", async () => {
    // Safe direction: a new pre-call guard that forgets to register its reason
    // is over-counted as unknown — visible and correctable — rather than
    // silently dropped from the total.
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null, fallbackReason: "some_future_guard" },
    ];
    const consumption = await deriveMonthToDateConsumptionFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });

    expect(consumption.unknownCalls).toBe(1);
    expect(consumption.notConsumedCalls).toBe(0);
  });

  it("bounds the query to the month — a past month must not include later rows", async () => {
    // The filter used to carry only `gte`, so asking for a past month returned
    // every row since. For the current month the two are indistinguishable,
    // which is why it went unnoticed.
    const capture: { where?: unknown } = {};
    await deriveMonthToDateConsumptionFromCallLog({
      client: makeMockClient([], capture),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });

    const where = capture.where as { createdAt: { gte: Date; lt: Date }; success?: unknown };
    expect(where.createdAt.gte.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(where.createdAt.lt.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    // And the success filter is gone, not merely widened.
    expect("success" in where).toBe(false);
  });

  it("keeps the measured-only contract for the registered spend provider", async () => {
    const records = [
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: 1000, tokenUsageCompletion: 500 },
      { provider: "openai", model: "gpt-4o", tokenUsagePrompt: null, tokenUsageCompletion: null },
    ];
    const usd = await deriveMonthToDateSpendUSDFromCallLog({
      client: makeMockClient(records),
      workspaceId: "ws-1",
      monthKey: "2026-05",
    });
    // The unknown row must not inflate the number the budget decision reads.
    expect(usd).toBeCloseTo(0.0125, 6);
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
