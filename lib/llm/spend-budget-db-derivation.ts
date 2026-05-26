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
 * See internal LLM spend / abuse guard spec (T019), Gap 3.
 */

import type { LLMProvider } from "@/lib/llm/types";
import { estimateSpendUSD } from "@/lib/llm/token-cost-table";

export type LLMCallLogQueryable = {
  findMany: (args: {
    where: {
      workspaceId: string;
      success: boolean;
      createdAt: { gte: Date };
    };
    select: {
      provider: true;
      model: true;
      tokenUsagePrompt: true;
      tokenUsageCompletion: true;
    };
  }) => Promise<
    Array<{
      provider: string;
      model: string;
      tokenUsagePrompt: number | null;
      tokenUsageCompletion: number | null;
    }>
  >;
};

export function startOfMonthUTC(monthKey: string): Date {
  // monthKey format: YYYY-MM
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) {
    throw new Error(`Invalid monthKey: ${monthKey}; expected YYYY-MM.`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 0, 0, 0, 0));
}

export async function deriveMonthToDateSpendUSDFromCallLog(input: {
  client: LLMCallLogQueryable;
  workspaceId: string;
  monthKey: string;
}): Promise<number> {
  const startedAt = startOfMonthUTC(input.monthKey);
  const records = await input.client.findMany({
    where: {
      workspaceId: input.workspaceId,
      success: true,
      createdAt: { gte: startedAt },
    },
    select: {
      provider: true,
      model: true,
      tokenUsagePrompt: true,
      tokenUsageCompletion: true,
    },
  });

  let totalUSD = 0;
  for (const r of records) {
    totalUSD += estimateSpendUSD({
      provider: r.provider as LLMProvider,
      model: r.model,
      inputTokens: r.tokenUsagePrompt ?? 0,
      outputTokens: r.tokenUsageCompletion ?? 0,
    });
  }
  return totalUSD;
}
