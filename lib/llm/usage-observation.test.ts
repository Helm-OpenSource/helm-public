import { describe, expect, it } from "vitest";

import {
  attachUsageObservation,
  observeUsage,
  readUsageObservation,
  usageForLedger,
} from "@/lib/llm/usage-observation";

describe("observeUsage", () => {
  it("treats a complete pair as known", () => {
    expect(observeUsage({ promptTokens: 12, completionTokens: 34 })).toEqual({
      kind: "known",
      promptTokens: 12,
      completionTokens: 34,
    });
  });

  it("treats zero as a real measurement, not as missing", () => {
    expect(observeUsage({ promptTokens: 0, completionTokens: 0 })).toEqual({
      kind: "known",
      promptTokens: 0,
      completionTokens: 0,
    });
  });

  it.each([
    ["no usage object", undefined],
    ["empty usage", {}],
    ["prompt only", { promptTokens: 12 }],
    ["completion only", { completionTokens: 34 }],
    ["null prompt", { promptTokens: null, completionTokens: 34 }],
  ])("treats %s as unknown — a half-reported usage is not a partial measurement", (_label, usage) => {
    expect(observeUsage(usage as never)).toEqual({
      kind: "unknown",
      reason: "provider_omitted_usage",
    });
  });

  it.each([
    ["negative", { promptTokens: -1, completionTokens: 2 }],
    ["fractional", { promptTokens: 1.5, completionTokens: 2 }],
    ["NaN", { promptTokens: Number.NaN, completionTokens: 2 }],
    ["Infinity", { promptTokens: Number.POSITIVE_INFINITY, completionTokens: 2 }],
  ])("refuses %s counts rather than passing them into spend arithmetic", (_label, usage) => {
    expect(observeUsage(usage)).toEqual({ kind: "unknown", reason: "provider_omitted_usage" });
  });
});

describe("usage observation on an escaping error", () => {
  it("survives the throw without changing the error's identity", () => {
    class ParseLike extends Error {}
    const error = attachUsageObservation(new ParseLike("boom"), {
      kind: "known",
      promptTokens: 7,
      completionTokens: 9,
    });

    // The registry branches on instanceof; a wrapper error type would break that.
    expect(error).toBeInstanceOf(ParseLike);
    expect(error.message).toBe("boom");
    expect(readUsageObservation(error)).toEqual({ kind: "known", promptTokens: 7, completionTokens: 9 });
  });

  it("is not enumerable, so logging the error does not leak it into serialised output", () => {
    const error = attachUsageObservation(new Error("x"), { kind: "unknown", reason: "provider_omitted_usage" });
    expect(Object.keys(error)).toEqual([]);
    expect(JSON.stringify(error)).toBe("{}");
  });

  it("reads back no_usage_observed when nothing was attached — not null", () => {
    // "We never looked" must not be representable as "nothing was consumed".
    expect(readUsageObservation(new Error("x"))).toEqual({ kind: "unknown", reason: "no_usage_observed" });
    expect(readUsageObservation(undefined)).toEqual({ kind: "unknown", reason: "no_usage_observed" });
    expect(readUsageObservation("a string")).toEqual({ kind: "unknown", reason: "no_usage_observed" });
  });

  it("rejects a malformed attached value instead of trusting it", () => {
    const error = new Error("x");
    Object.defineProperty(error, Symbol.for("helm.llm.usageObservation"), {
      value: { kind: "known", promptTokens: "12", completionTokens: 34 },
      configurable: true,
    });
    expect(readUsageObservation(error)).toEqual({ kind: "unknown", reason: "no_usage_observed" });
  });

  it("attaching to a non-object does not throw", () => {
    expect(() => attachUsageObservation("string error", { kind: "unknown", reason: "no_usage_observed" })).not.toThrow();
  });
});

describe("usageForLedger", () => {
  it("writes the counts when known", () => {
    expect(usageForLedger({ kind: "known", promptTokens: 3, completionTokens: 4 })).toEqual({
      tokenUsagePrompt: 3,
      tokenUsageCompletion: 4,
    });
  });

  it("writes null — never 0 — when unknown", () => {
    // 0 would be a claim that nothing was consumed. The column is nullable for exactly this.
    expect(usageForLedger({ kind: "unknown", reason: "provider_omitted_usage" })).toEqual({
      tokenUsagePrompt: null,
      tokenUsageCompletion: null,
    });
  });
});
