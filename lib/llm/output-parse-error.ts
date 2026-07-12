/**
 * Strict LLM JSON-output parsing.
 *
 * Several workflows previously parsed LLM output with `safeParseJson(rawText,
 * fallback)`, which swallows a JSON-parse failure and returns the deterministic
 * fallback. Because that happens INSIDE the adapter's `parseOutput` callback,
 * `executeLLMTask` then records the call as `success: true, fallbackUsed: false`
 * — so observability (and the suggestion-vs-commitment provenance that depends
 * on it) claimed an LLM-generated artifact when the fallback was actually used.
 *
 * `parseLlmJsonOrThrow` instead throws `LlmOutputParseError`, which propagates
 * to the executor's catch path and is recorded as `fallbackUsed: true,
 * fallbackReason: "output_parse_failed"`. Parsing semantics are otherwise
 * identical to `safeParseJson` (a plain `JSON.parse`).
 */
export class LlmOutputParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmOutputParseError";
  }
}

export class LlmOutputSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmOutputSchemaError";
  }
}

export function isLlmOutputParseError(error: unknown): error is LlmOutputParseError {
  return error instanceof LlmOutputParseError;
}

export function isLlmOutputSchemaError(error: unknown): error is LlmOutputSchemaError {
  return error instanceof LlmOutputSchemaError;
}

export function parseLlmJsonOrThrow<T>(rawText: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch (error) {
    throw new LlmOutputParseError(
      `LLM output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
