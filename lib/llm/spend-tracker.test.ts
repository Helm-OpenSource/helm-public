import { beforeEach, describe, expect, it } from "vitest";
import {
  SpendBudgetExceededError,
  __resetAccumulatorForTests,
  applySpendBudgetPolicy,
  applySpendBudgetPolicyAsync,
  getMonthToDateSpendUSD,
  monthKeyFromDate,
  recordActualSpend,
  setDBDerivedSpendProvider,
} from "@/lib/llm/spend-tracker";
import type { WorkspaceLLMConfig } from "@/lib/llm/types";

const baseWorkspaceConfig: WorkspaceLLMConfig = {
  provider: "qwen",
  defaultModel: "qwen3.6-plus",
  extractionModel: "qwen3.6-plus",
  briefingModel: "qwen3.6-plus",
  reasoningModel: "qwen3.6-plus",
  llmEnabled: true,
  llmBudgetTier: "pilot",
};

describe("spend-tracker · monthKeyFromDate", () => {
  it("formats UTC year-month with zero-pad", () => {
    expect(monthKeyFromDate(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
    expect(monthKeyFromDate(new Date(Date.UTC(2026, 11, 15)))).toBe("2026-12");
  });
});

describe("spend-tracker · accumulator", () => {
  beforeEach(() => {
    __resetAccumulatorForTests();
  });

  it("starts at zero", () => {
    expect(getMonthToDateSpendUSD("ws-1")).toBe(0);
  });

  it("accumulates via recordActualSpend", () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 0.12 });
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 0.34 });
    expect(getMonthToDateSpendUSD("ws-1", "2026-05")).toBeCloseTo(0.46, 4);
  });

  it("isolates workspaces", () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 1.0 });
    recordActualSpend({ workspaceId: "ws-2", monthKey: "2026-05", spendUSD: 2.0 });
    expect(getMonthToDateSpendUSD("ws-1", "2026-05")).toBe(1.0);
    expect(getMonthToDateSpendUSD("ws-2", "2026-05")).toBe(2.0);
  });

  it("isolates months", () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-04", spendUSD: 5.0 });
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 1.0 });
    expect(getMonthToDateSpendUSD("ws-1", "2026-04")).toBe(5.0);
    expect(getMonthToDateSpendUSD("ws-1", "2026-05")).toBe(1.0);
  });
});

describe("spend-tracker · applySpendBudgetPolicy", () => {
  beforeEach(() => {
    __resetAccumulatorForTests();
  });

  const baseInput = {
    workspaceConfig: { ...baseWorkspaceConfig, monthlySpendBudgetUSD: 10 },
    workspaceId: "ws-1",
    provider: "qwen" as const,
    model: "qwen3.6-plus",
    taskType: "CONTACT_BRIEFING" as const,
    systemPrompt: "system prompt".repeat(10),
    userPrompt: "user prompt".repeat(20),
    effectiveMaxOutputTokens: 1024,
    now: new Date(Date.UTC(2026, 4, 15)),
  };

  it("returns estimate + month + current=0 + budget when fresh", () => {
    const r = applySpendBudgetPolicy(baseInput);
    expect(r.monthKey).toBe("2026-05");
    expect(r.currentSpendUSD).toBe(0);
    expect(r.budgetUSD).toBe(10);
    expect(r.estimatedCallUSD).toBeGreaterThan(0);
    expect(r.estimatedCallUSD).toBeLessThan(1);
  });

  it("does not throw when budgetUSD null (no budget enforcement)", () => {
    const r = applySpendBudgetPolicy({
      ...baseInput,
      workspaceConfig: { ...baseInput.workspaceConfig, monthlySpendBudgetUSD: null },
    });
    expect(r.budgetUSD).toBeNull();
  });

  it("throws SpendBudgetExceededError when current + estimate > budget", () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 9.999 });
    expect(() =>
      applySpendBudgetPolicy({
        ...baseInput,
        effectiveMaxOutputTokens: 8192, // big output → big estimate
      }),
    ).toThrow(SpendBudgetExceededError);
  });

  it("SpendBudgetExceededError carries fields", () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 9.5 });
    try {
      // Use openai+gpt-4o pricing (more expensive output: $15/1M) with
      // larger output budget to push the estimate above 0.5
      applySpendBudgetPolicy({
        ...baseInput,
        provider: "openai",
        model: "gpt-4o",
        effectiveMaxOutputTokens: 100_000,
      });
      expect.fail("Expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SpendBudgetExceededError);
      const e = err as SpendBudgetExceededError;
      expect(e.workspaceId).toBe("ws-1");
      expect(e.monthKey).toBe("2026-05");
      expect(e.budgetUSD).toBe(10);
      expect(e.currentSpendUSD).toBe(9.5);
      expect(e.statusCode).toBe(402);
    }
  });

  it("does not throw when current + estimate just below budget", () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 5.0 });
    const r = applySpendBudgetPolicy(baseInput);
    expect(r.currentSpendUSD).toBe(5.0);
    // budget is 10, estimate < 1, so 5 + estimate < 10 → no throw
  });
});

describe("spend-tracker · applySpendBudgetPolicyAsync (multi-instance)", () => {
  beforeEach(() => {
    __resetAccumulatorForTests();
  });

  const baseInput = {
    workspaceConfig: { ...baseWorkspaceConfig, monthlySpendBudgetUSD: 10 },
    workspaceId: "ws-1",
    provider: "qwen" as const,
    model: "qwen3.6-plus",
    taskType: "CONTACT_BRIEFING" as const,
    systemPrompt: "system",
    userPrompt: "user",
    effectiveMaxOutputTokens: 1024,
    now: new Date(Date.UTC(2026, 4, 15)),
  };

  it("falls back to in-memory only when no DB provider registered", async () => {
    const r = await applySpendBudgetPolicyAsync(baseInput);
    expect(r.currentSpendUSD).toBe(0);
  });

  it("uses max(in-memory, db-derived) when DB provider returns higher", async () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 1.0 });
    setDBDerivedSpendProvider(async () => 5.0);
    const r = await applySpendBudgetPolicyAsync(baseInput);
    expect(r.currentSpendUSD).toBe(5.0);
  });

  it("uses in-memory when in-memory is higher (no double-count)", async () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 7.0 });
    setDBDerivedSpendProvider(async () => 2.0);
    const r = await applySpendBudgetPolicyAsync(baseInput);
    expect(r.currentSpendUSD).toBe(7.0);
  });

  it("throws SpendBudgetExceededError when DB-derived spend pushes over budget", async () => {
    setDBDerivedSpendProvider(async () => 9.99);
    await expect(
      applySpendBudgetPolicyAsync({
        ...baseInput,
        provider: "openai",
        model: "gpt-4o",
        effectiveMaxOutputTokens: 100_000,
      }),
    ).rejects.toThrow(SpendBudgetExceededError);
  });

  it("gracefully handles DB provider failure (uses in-memory only)", async () => {
    recordActualSpend({ workspaceId: "ws-1", monthKey: "2026-05", spendUSD: 3.0 });
    setDBDerivedSpendProvider(async () => {
      throw new Error("DB unavailable");
    });
    const r = await applySpendBudgetPolicyAsync(baseInput);
    // Should not throw; should fall back to in-memory accumulator (3.0)
    expect(r.currentSpendUSD).toBe(3.0);
  });
});
