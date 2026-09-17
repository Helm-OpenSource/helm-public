/**
 * spend-budget-db-derivation — derive month-to-date spend USD by querying
 * the LLMCallLog table.
 *
 * Implementation of T019.code P0 #2b: multi-instance spend tracking.
 *
 * The in-memory spend-tracker is single-process. Helm Cloud (multi-pod)
 * needs a source of truth that survives restarts and aggregates across
 * instances. Rather than introducing a new persistence backend (Redis,
 * dedicated SpendLedger table), this module derives spend from the
 * existing LLMCallLog table where every successful call already records
 * (workspaceId, provider, model, tokenUsagePrompt, tokenUsageCompletion,
 * createdAt).
 *
 * Use this AS A SUPPLEMENT to the in-memory tracker (defense in depth):
 *   actualCurrentSpend = max(inMemoryAccumulator, dbDerivedSpend)
 *
 * Caller is expected to pass a Prisma-shaped query interface. This module
 * does NOT import @/lib/db directly — it accepts the client via parameter
 * so tests can inject a mock.
 *
 * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 3.
 */

import type { LLMProvider } from "@/lib/llm/types";
import { estimateSpendUSD } from "@/lib/llm/token-cost-table";

export type LLMCallLogQueryable = {
  findMany: (args: {
    where: {
      workspaceId: string;
      // `success` is deliberately NOT part of the filter. A call that the
      // provider answered and charged for can still be recorded as
      // `success: false` — a PII rejection, a parse failure, a mid-stream
      // transport error. Filtering them out under-reported by exactly the
      // amount nobody was watching.
      createdAt: { gte: Date; lt: Date };
    };
    select: {
      provider: true;
      model: true;
      tokenUsagePrompt: true;
      tokenUsageCompletion: true;
      fallbackReason: true;
    };
  }) => Promise<
    Array<{
      provider: string;
      model: string;
      tokenUsagePrompt: number | null;
      tokenUsageCompletion: number | null;
      fallbackReason: string | null;
    }>
  >;
};

/**
 * Fallback reasons that mean the call was refused BEFORE the provider was
 * contacted, so nothing was consumed.
 *
 * Closed set on purpose: anything not listed here is treated as "the provider
 * may have run", which is the safe direction. A new pre-call guard that forgets
 * to register its reason here is over-counted as unknown — visible and
 * correctable — rather than silently dropped.
 */
const PRE_CALL_REFUSAL_REASONS: ReadonlySet<string> = new Set([
  "policy_max_tokens_exceeded",
  "policy_rate_limited",
  "policy_spend_budget_exceeded",
]);

export type MonthToDateConsumption = {
  /** Spend derived from rows that carry BOTH token counts. */
  measuredUSD: number;
  /** Rows where the provider may have charged but no usable counts exist. */
  unknownCalls: number;
  /** Rows refused before the provider was contacted; nothing was consumed. */
  notConsumedCalls: number;
  /** Rows that contributed to `measuredUSD`. */
  measuredCalls: number;
};

export function startOfMonthUTC(monthKey: string): Date {
  // monthKey format: YYYY-MM
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) {
    throw new Error(`Invalid monthKey: ${monthKey}; expected YYYY-MM.`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 0, 0, 0, 0));
}

/**
 * Exclusive upper bound of the month.
 *
 * The query used to have only a lower bound, so asking for a PAST month
 * returned every row since — the answer silently included later months.
 * For the current month the two are indistinguishable, which is why it went
 * unnoticed.
 */
export function startOfNextMonthUTC(monthKey: string): Date {
  const start = startOfMonthUTC(monthKey);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Classify and total one month of call-log rows.
 *
 * Three buckets, because the log holds three different facts and the old code
 * collapsed them into one number:
 *
 *   measured      — both token counts present; a real measurement
 *   unknown       — the provider may have charged, but no usable counts exist
 *   not consumed  — refused before the provider was contacted
 *
 * `?? 0` on a null count is what made unknown indistinguishable from a measured
 * zero, so a null now routes the row to `unknown` instead of adding nothing to
 * the total and pretending that was the answer.
 */
export async function deriveMonthToDateConsumptionFromCallLog(input: {
  client: LLMCallLogQueryable;
  workspaceId: string;
  monthKey: string;
}): Promise<MonthToDateConsumption> {
  const records = await input.client.findMany({
    where: {
      workspaceId: input.workspaceId,
      createdAt: {
        gte: startOfMonthUTC(input.monthKey),
        lt: startOfNextMonthUTC(input.monthKey),
      },
    },
    select: {
      provider: true,
      model: true,
      tokenUsagePrompt: true,
      tokenUsageCompletion: true,
      fallbackReason: true,
    },
  });

  const consumption: MonthToDateConsumption = {
    measuredUSD: 0,
    unknownCalls: 0,
    notConsumedCalls: 0,
    measuredCalls: 0,
  };
  for (const row of records) {
    if (isTokenCount(row.tokenUsagePrompt) && isTokenCount(row.tokenUsageCompletion)) {
      consumption.measuredUSD += estimateSpendUSD({
        provider: row.provider as LLMProvider,
        model: row.model,
        inputTokens: row.tokenUsagePrompt,
        outputTokens: row.tokenUsageCompletion,
      });
      consumption.measuredCalls += 1;
      continue;
    }
    if (row.fallbackReason !== null && PRE_CALL_REFUSAL_REASONS.has(row.fallbackReason)) {
      consumption.notConsumedCalls += 1;
      continue;
    }
    consumption.unknownCalls += 1;
  }
  return consumption;
}

function isTokenCount(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Measured month-to-date spend.
 *
 * Signature unchanged so the registered `DBDerivedSpendProvider` keeps working:
 * this returns the MEASURED total only. Callers that need the unknown count —
 * the reconciliation report, the diagnostics readout — call
 * {@link deriveMonthToDateConsumptionFromCallLog} directly rather than getting
 * an estimate folded into this number.
 */
export async function deriveMonthToDateSpendUSDFromCallLog(input: {
  client: LLMCallLogQueryable;
  workspaceId: string;
  monthKey: string;
}): Promise<number> {
  return (await deriveMonthToDateConsumptionFromCallLog(input)).measuredUSD;
}
