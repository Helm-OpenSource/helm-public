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

export const PRICING_TABLE_VERSION = "2026-10-31";

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

  // Qwen 3.7 series, cn-beijing list price read off the Model Studio pricing
  // page on 2026-08-18. These models are tier-priced by the INPUT token count
  // of a single request; the entries below carry the 0–256K tier because every
  // call this codebase makes is orders of magnitude below that ceiling
  // (max_completion_tokens defaults to 900 and prompts are a few KB).
  //
  // The 256K–1M tier, for whoever enables long-context calls later:
  //   qwen3.7-plus   input 0.826   output 1.101   (output is flat across tiers)
  //   qwen3.7-flash  input 0.66    output 3.961
  // Switching a workflow to long context WITHOUT revisiting this table
  // under-counts spend by ~3x on input and ~4x on flash output.
  "qwen:qwen3.7-plus": { inputPerMillion: 0.276, outputPerMillion: 1.101, source: "aliyun model studio cn-beijing list price 2026-08-18, 0-256K tier" },
  "qwen:qwen3.7-flash": { inputPerMillion: 0.165, outputPerMillion: 0.99, source: "aliyun model studio cn-beijing list price 2026-08-18, 0-256K tier" },
  "qwen:qwen3.7-max": { inputPerMillion: 1.65, outputPerMillion: 4.951, source: "aliyun model studio cn-beijing list price 2026-08-18" },

  // qwen3.8-max was deliberately absent until 2026-10-31: it sat on the model
  // list without a published price as of 2026-08-18, so it resolved to
  // UNKNOWN_MODEL_FALLBACK below and a guarding test pinned that. On
  // 2026-10-31 the Model Studio pricing page (cn-beijing) lists it — and its
  // snapshot qwen3.8-max-0902 — at 12 CNY in / 36 CNY out per 1M tokens, a
  // single 0–1M tier, identical to qwen3.7-max; the USD figure below is the
  // same conversion already used for qwen3.7-max. The guarding test now pins
  // price parity with qwen3.7-max instead of the fallback.
  "qwen:qwen3.8-max": { inputPerMillion: 1.65, outputPerMillion: 4.951, source: "aliyun model studio cn-beijing list price 2026-10-31 (12/36 CNY per 1M tokens, identical to qwen3.7-max; snapshot qwen3.8-max-0902 same price)" },
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
