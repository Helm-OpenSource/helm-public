/**
 * token-cost-table — pricing table per provider × model.
 *
 * Prices are in USD per 1 million tokens. Input and output priced
 * separately (provider standard convention).
 *
 * IMPORTANT: this table reflects PUBLISHED list prices as of the
 * date marked below. Real billing may differ (volume discounts,
 * promo credits, etc.). The tracker uses these as worst-case
 * estimates for budget enforcement.
 *
 * Source: provider public pricing pages. Verify before changing —
 * spending budget enforcement depends on accuracy.
 */

import type { LLMProvider } from "@/lib/llm/types";

export const PRICING_TABLE_VERSION = "2026-05-19";

export type TokenCost = {
  /** USD per 1M input tokens */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** Free-form note (e.g. "list price", "trial pricing", date snapshot) */
  source: string;
};

const COST_TABLE: Record<string, TokenCost> = {
  // OpenAI / OpenAI-compatible
  "openai:gpt-4o": { inputPerMillion: 5.0, outputPerMillion: 15.0, source: "openai list price 2026-05" },
  "openai:gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, source: "openai list price 2026-05" },
  "openai:gpt-4-turbo": { inputPerMillion: 10.0, outputPerMillion: 30.0, source: "openai list price 2026-05" },

  // Qwen / Aliyun DashScope (CNY prices converted ~1 USD = 7.2 CNY)
  "qwen:qwen3.6-plus": { inputPerMillion: 0.55, outputPerMillion: 1.65, source: "aliyun dashscope 2026-05 (converted)" },
  "qwen:qwen-max": { inputPerMillion: 2.78, outputPerMillion: 8.33, source: "aliyun dashscope 2026-05 (converted)" },
  "qwen:qwen-turbo": { inputPerMillion: 0.04, outputPerMillion: 0.14, source: "aliyun dashscope 2026-05 (converted)" },
};

/**
 * Fallback used when an unknown (provider, model) combination appears.
 * Set deliberately high so unknowns don't accidentally treat as cheap.
 */
const UNKNOWN_MODEL_FALLBACK: TokenCost = {
  inputPerMillion: 15.0,
  outputPerMillion: 60.0,
  source: "unknown-model worst-case fallback",
};

export function resolveTokenCost(provider: LLMProvider, model: string): TokenCost {
  const key = `${provider}:${model}`;
  return COST_TABLE[key] ?? UNKNOWN_MODEL_FALLBACK;
}

/**
 * Estimate USD spend for a call given prompt + output token counts.
 * Use estimated tokens at pre-call time (input known, output bounded by
 * max-tokens policy); after call, recompute with actual usage.
 */
export function estimateSpendUSD(input: {
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const cost = resolveTokenCost(input.provider, input.model);
  return (
    (input.inputTokens / 1_000_000) * cost.inputPerMillion +
    (input.outputTokens / 1_000_000) * cost.outputPerMillion
  );
}

/**
 * Rough heuristic for input token count from text length.
 * Real tokenization is provider-specific; this is an upper-bound estimate
 * suitable for pre-call budget gating (errs on the high side).
 */
export function estimateInputTokensFromText(text: string): number {
  // English: ~4 chars per token; Chinese: ~1.5 chars per token.
  // Use the more conservative (smaller) divisor so the estimate
  // over-counts rather than under-counts.
  return Math.ceil(text.length / 1.5);
}
