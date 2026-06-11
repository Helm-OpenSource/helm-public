import { describe, expect, it } from "vitest";

import {
  LlmOutputParseError,
  isLlmOutputParseError,
  parseLlmJsonOrThrow,
} from "@/lib/llm/output-parse-error";

describe("parseLlmJsonOrThrow", () => {
  it("parses valid JSON identically to JSON.parse", () => {
    expect(parseLlmJsonOrThrow<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(parseLlmJsonOrThrow<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("throws LlmOutputParseError on malformed JSON (instead of swallowing)", () => {
    expect(() => parseLlmJsonOrThrow("not json")).toThrow(LlmOutputParseError);
    expect(() => parseLlmJsonOrThrow("{ unterminated")).toThrow(LlmOutputParseError);
  });

  it("isLlmOutputParseError narrows the thrown error", () => {
    try {
      parseLlmJsonOrThrow("oops");
      throw new Error("should have thrown");
    } catch (error) {
      expect(isLlmOutputParseError(error)).toBe(true);
    }
    expect(isLlmOutputParseError(new Error("other"))).toBe(false);
  });
});
