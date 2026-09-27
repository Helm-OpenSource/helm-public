import { describe, expect, it } from "vitest";

import {
  caioInferenceCostBand,
  CAIO_PRICE_ANTHROPIC_OPUS_5_5,
  CAIO_PRICE_OPENAI_SOL6_PLACEHOLDER,
  computeCaioInferenceCostUsdMicros,
  validateCaioInferencePrice,
} from "./pricing";

describe("CAIO inference pricing", () => {
  it("prices Opus 5.5 at $4 / $20 per million tokens and rounds partial micros up", () => {
    expect(validateCaioInferencePrice(CAIO_PRICE_ANTHROPIC_OPUS_5_5).valid).toBe(true);
    expect(computeCaioInferenceCostUsdMicros(CAIO_PRICE_ANTHROPIC_OPUS_5_5, { inputTokens: 1_000_000, outputTokens: 0 })).toBe(4_000_000);
    expect(computeCaioInferenceCostUsdMicros(CAIO_PRICE_ANTHROPIC_OPUS_5_5, { inputTokens: 0, outputTokens: 1_000_000 })).toBe(20_000_000);
    // 1 input token = 4 micros; 1 output token = 20 micros; a fractional result must never round down to free.
    expect(computeCaioInferenceCostUsdMicros({ ...CAIO_PRICE_ANTHROPIC_OPUS_5_5, inputUsdMicrosPerMillionTokens: 1 }, { inputTokens: 1, outputTokens: 0 })).toBe(1);
  });

  it("keeps the Sol6 placeholder invalid until owner-confirmed prices are set", () => {
    expect(validateCaioInferencePrice(CAIO_PRICE_OPENAI_SOL6_PLACEHOLDER)).toEqual({
      valid: false,
      errors: ["input_price_invalid", "output_price_invalid"],
    });
  });

  it("requires usage for a per-token price and charges nothing for zero price", () => {
    expect(() => computeCaioInferenceCostUsdMicros(CAIO_PRICE_ANTHROPIC_OPUS_5_5, null)).toThrow("caio_inference_usage_required");
    expect(computeCaioInferenceCostUsdMicros({ kind: "zero", pricingVersion: "local" }, null)).toBe(0);
  });

  it("bands cost per call", () => {
    expect(caioInferenceCostBand(0)).toBe("zero");
    expect(caioInferenceCostBand(9_999)).toBe("low");
    expect(caioInferenceCostBand(10_000)).toBe("medium");
    expect(caioInferenceCostBand(100_000)).toBe("high");
  });
});
