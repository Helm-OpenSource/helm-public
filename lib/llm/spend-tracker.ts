/**
 * spend-tracker — per-workspace month-to-date LLM spend accumulator.
 *
 * Implementation of T019 spec §二 Gap 3 (monthly spending budget not
 * enforced). This module provides:
 *   - month-to-date accumulator keyed by workspace + YYYY-MM
 *   - applySpendBudgetPolicy(input) pre-call check
 *   - recordActualSpend(input) post-call accounting
 *
 * CURRENT IMPLEMENTATION: in-memory only. Single-process, single-instance.
 * NOT suitable for multi-instance Helm Cloud — that requires persistent
 * backend (Redis / DB). The persistence upgrade is tracked as T019.code
 * P0 #2b.
 *
 * Budget configuration: WorkspaceLLMConfig.monthlySpendBudgetUSD
 * (null = no budget tracking, undefined = no budget tracking).
 *
 * See internal LLM spend / abuse guard spec (T019), Gap 3.
 */

import type { LLMProvider, LLMTaskType, WorkspaceLLMConfig } from "@/lib/llm/types";
import {
  estimateInputTokensFromText,
  estimateSpendUSD,
} from "@/lib/llm/token-cost-table";

export class SpendBudgetExceededError extends Error {
  public readonly statusCode = 402;
  public readonly workspaceId: string;
  public readonly monthKey: string;
  public readonly budgetUSD: number;
  public readonly currentSpendUSD: number;
  public readonly estimatedCallUSD: number;

  constructor(input: {
    workspaceId: string;
    monthKey: string;
    budgetUSD: number;
    currentSpendUSD: number;
    estimatedCallUSD: number;
  }) {
    super(
      `SpendBudgetExceeded: workspace=${input.workspaceId} month=${input.monthKey} ` +
        `budget=${input.budgetUSD.toFixed(4)} current=${input.currentSpendUSD.toFixed(4)} ` +
        `estimatedCall=${input.estimatedCallUSD.toFixed(4)}; cannot proceed.`,
    );
    this.name = "SpendBudgetExceededError";
    this.workspaceId = input.workspaceId;
    this.monthKey = input.monthKey;
    this.budgetUSD = input.budgetUSD;
    this.currentSpendUSD = input.currentSpendUSD;
    this.estimatedCallUSD = input.estimatedCallUSD;
  }
}

type AccumulatorKey = string; // `${workspaceId}:${YYYY-MM}`

const accumulator = new Map<AccumulatorKey, number>();

/**
 * Optional DB-derived spend provider. When registered (typically at app
 * startup via setDBDerivedSpendProvider), the spend-tracker queries this
 * function to get the persisted spend, then uses max(inMemory, dbDerived)
 * as the source of truth. This is what makes multi-instance Helm Cloud
 * spend visibility work without introducing Redis.
 *
 * If null, the spend-tracker operates in single-instance in-memory mode
 * (suitable for tests and dev).
 *
 * Lazy + cached: implementation should cache results per (workspaceId, monthKey)
 * with short TTL to keep per-call latency bounded.
 */
type DBDerivedSpendProvider = (input: {
  workspaceId: string;
  monthKey: string;
}) => Promise<number>;

let dbDerivedSpendProvider: DBDerivedSpendProvider | null = null;

export function setDBDerivedSpendProvider(provider: DBDerivedSpendProvider | null): void {
  dbDerivedSpendProvider = provider;
}

const dbCache = new Map<AccumulatorKey, { valueUSD: number; expiresAtMs: number }>();
const DB_CACHE_TTL_MS = 60_000; // 1 minute

async function getDBDerivedSpendCached(
  workspaceId: string,
  monthKey: string,
  nowMs: number,
): Promise<number> {
  if (!dbDerivedSpendProvider) return 0;
  const key = keyFor(workspaceId, monthKey);
  const cached = dbCache.get(key);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.valueUSD;
  }
  try {
    const valueUSD = await dbDerivedSpendProvider({ workspaceId, monthKey });
    dbCache.set(key, { valueUSD, expiresAtMs: nowMs + DB_CACHE_TTL_MS });
    return valueUSD;
  } catch {
    // DB unavailable — defensive fallback to last cached value or 0
    return cached?.valueUSD ?? 0;
  }
}

export function monthKeyFromDate(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function keyFor(workspaceId: string, monthKey: string): AccumulatorKey {
  return `${workspaceId}:${monthKey}`;
}

export function getMonthToDateSpendUSD(workspaceId: string, monthKey: string = monthKeyFromDate()): number {
  return accumulator.get(keyFor(workspaceId, monthKey)) ?? 0;
}

export function applySpendBudgetPolicy(input: {
  workspaceConfig: WorkspaceLLMConfig & { monthlySpendBudgetUSD?: number | null };
  workspaceId: string;
  provider: LLMProvider;
  model: string;
  taskType: LLMTaskType;
  systemPrompt: string;
  userPrompt: string;
  effectiveMaxOutputTokens: number;
  now?: Date;
}): { estimatedCallUSD: number; monthKey: string; currentSpendUSD: number; budgetUSD: number | null } {
  const monthKey = monthKeyFromDate(input.now);
  const budgetUSD = input.workspaceConfig.monthlySpendBudgetUSD ?? null;
  const currentSpendUSD = getMonthToDateSpendUSD(input.workspaceId, monthKey);

  const inputTokens = estimateInputTokensFromText(input.systemPrompt) +
    estimateInputTokensFromText(input.userPrompt);
  const estimatedCallUSD = estimateSpendUSD({
    provider: input.provider,
    model: input.model,
    inputTokens,
    outputTokens: input.effectiveMaxOutputTokens,
  });

  if (budgetUSD !== null && currentSpendUSD + estimatedCallUSD > budgetUSD) {
    throw new SpendBudgetExceededError({
      workspaceId: input.workspaceId,
      monthKey,
      budgetUSD,
      currentSpendUSD,
      estimatedCallUSD,
    });
  }

  return { estimatedCallUSD, monthKey, currentSpendUSD, budgetUSD };
}

export function recordActualSpend(input: {
  workspaceId: string;
  monthKey: string;
  spendUSD: number;
}): void {
  const k = keyFor(input.workspaceId, input.monthKey);
  const prev = accumulator.get(k) ?? 0;
  accumulator.set(k, prev + input.spendUSD);
}

/**
 * Async variant of applySpendBudgetPolicy that additionally consults the
 * registered DB-derived spend provider (if any) and uses
 * max(inMemoryAccumulator, dbDerivedSpend) as the source of truth.
 *
 * Use this in production (executeLLMTask) when running on Helm Cloud
 * multi-instance. Falls back to applySpendBudgetPolicy semantics if no
 * DB provider is registered.
 */
export async function applySpendBudgetPolicyAsync(input: {
  workspaceConfig: WorkspaceLLMConfig & { monthlySpendBudgetUSD?: number | null };
  workspaceId: string;
  provider: LLMProvider;
  model: string;
  taskType: LLMTaskType;
  systemPrompt: string;
  userPrompt: string;
  effectiveMaxOutputTokens: number;
  now?: Date;
}): Promise<{ estimatedCallUSD: number; monthKey: string; currentSpendUSD: number; budgetUSD: number | null }> {
  const monthKey = monthKeyFromDate(input.now);
  const budgetUSD = input.workspaceConfig.monthlySpendBudgetUSD ?? null;
  const inMemorySpendUSD = getMonthToDateSpendUSD(input.workspaceId, monthKey);
  const dbDerivedSpendUSD = await getDBDerivedSpendCached(
    input.workspaceId,
    monthKey,
    (input.now ?? new Date()).getTime(),
  );
  const currentSpendUSD = Math.max(inMemorySpendUSD, dbDerivedSpendUSD);

  const inputTokens =
    estimateInputTokensFromText(input.systemPrompt) +
    estimateInputTokensFromText(input.userPrompt);
  const estimatedCallUSD = estimateSpendUSD({
    provider: input.provider,
    model: input.model,
    inputTokens,
    outputTokens: input.effectiveMaxOutputTokens,
  });

  if (budgetUSD !== null && currentSpendUSD + estimatedCallUSD > budgetUSD) {
    throw new SpendBudgetExceededError({
      workspaceId: input.workspaceId,
      monthKey,
      budgetUSD,
      currentSpendUSD,
      estimatedCallUSD,
    });
  }

  return { estimatedCallUSD, monthKey, currentSpendUSD, budgetUSD };
}

/**
 * Test-only helper. Clears the accumulator (used by tests to isolate runs).
 * Not exposed via the module's main API surface.
 */
export function __resetAccumulatorForTests(): void {
  accumulator.clear();
  dbCache.clear();
  dbDerivedSpendProvider = null;
}
