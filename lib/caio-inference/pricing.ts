import type { ModelEgressCostBand } from "@/lib/llm/model-egress-contracts";

import type { CaioInferenceModelUsage } from "./contracts";

/**
 * Prices the governed dispatch applies to a CAIO inference call.
 *
 * Cost is always computed HERE, on the server, from the token counts the worker reports and the price
 * registered for the route's `pricingVersion`. The worker never reports a cost: a device-side number would be
 * self-attested spend feeding the monthly cap.
 *
 * `zero` is the on-premises price (a local model costs nothing to call). `per_token` is a remote provider:
 * usage is then mandatory — a submission without it is refused rather than recorded as free.
 */
export type CaioInferencePrice =
  | Readonly<{ kind: "zero"; pricingVersion: string }>
  | Readonly<{
      kind: "per_token";
      pricingVersion: string;
      /** USD micros per one million input tokens (e.g. $4 / MTok = 4_000_000). */
      inputUsdMicrosPerMillionTokens: number;
      /** USD micros per one million output tokens. */
      outputUsdMicrosPerMillionTokens: number;
    }>;

/**
 * Claude Opus 5.5 (`claude-opus-5-5`), Anthropic first-party API, standard tier: $4 / $20 per million input /
 * output tokens. Verified 2026-09-27 against https://platform.claude.com/docs/en/about-claude/pricing (owner accepted).
 */
export const CAIO_PRICE_ANTHROPIC_OPUS_5_5: CaioInferencePrice = Object.freeze({
  kind: "per_token",
  pricingVersion: "anthropic-opus-5-5-202609",
  inputUsdMicrosPerMillionTokens: 4_000_000,
  outputUsdMicrosPerMillionTokens: 20_000_000,
});

/**
 * OpenAI GPT-6 Sol (`gpt-6-sol`, "Sol6"), standard tier: $2 / $10 per million input / output tokens.
 * Verified 2026-09-27 against https://developers.openai.com/api/docs/pricing (owner asked to use the public price).
 * Long-context requests are priced higher ($4 / $15); CAIO prompts are far below that threshold.
 */
export const CAIO_PRICE_OPENAI_GPT_6_SOL: CaioInferencePrice = Object.freeze({
  kind: "per_token",
  pricingVersion: "openai-gpt-6-sol-202609",
  inputUsdMicrosPerMillionTokens: 2_000_000,
  outputUsdMicrosPerMillionTokens: 10_000_000,
});

const MAX_PRICE_MICROS_PER_MILLION = 1_000_000_000; // $1,000 per million tokens: far above any real price.

export function validateCaioInferencePrice(price: CaioInferencePrice): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(price.pricingVersion)) errors.push("pricing_version_invalid");
  if (price.kind === "per_token") {
    for (const [field, value] of [
      ["input", price.inputUsdMicrosPerMillionTokens],
      ["output", price.outputUsdMicrosPerMillionTokens],
    ] as const) {
      // A per-token price of 0 would record a paid call as free; it is the placeholder state, never valid.
      if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_PRICE_MICROS_PER_MILLION) {
        errors.push(`${field}_price_invalid`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Server-side cost of one call; `ceil` so fractional micros never round a paid call down to free. */
export function computeCaioInferenceCostUsdMicros(price: CaioInferencePrice, usage: CaioInferenceModelUsage | null): number {
  if (price.kind === "zero") return 0;
  if (usage === null) throw new Error("caio_inference_usage_required");
  const micros =
    (usage.inputTokens * price.inputUsdMicrosPerMillionTokens +
      usage.outputTokens * price.outputUsdMicrosPerMillionTokens) /
    1_000_000;
  return Math.ceil(micros);
}

/** Coarse band recorded on the receipt; thresholds are per call. */
export function caioInferenceCostBand(costUsdMicros: number): ModelEgressCostBand {
  if (costUsdMicros === 0) return "zero";
  if (costUsdMicros < 10_000) return "low"; // < $0.01
  if (costUsdMicros < 100_000) return "medium"; // < $0.10
  return "high";
}
