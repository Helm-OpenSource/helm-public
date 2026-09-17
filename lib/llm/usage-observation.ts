/**
 * Token usage as an OBSERVATION with an explicit unknown, not as a number that
 * defaults to zero.
 *
 * WHY THIS TYPE EXISTS. The registry used to compute actual spend as
 * `result.usage.promptTokens ?? 0`. The adapter always constructs a `usage`
 * object — even when the provider omitted `usage` entirely — so the truthiness
 * check that was supposed to select the pre-call estimate never failed, and a
 * provider that reported no usage was billed as ZERO. That is not a rounding
 * error: it is a call whose real consumption is invisible to every consumer of
 * the ledger, including the budget decision.
 *
 * Zero and unknown are different facts and must not share a representation.
 * A missing count is recorded as `unknown` with a reason, and the caller decides
 * what to do about it — it may not silently become 0, and it may not silently
 * become an estimate either: an estimate written into the ledger is
 * indistinguishable from a measurement later.
 *
 * WHY THE OBSERVATION TRAVELS ON THE ERROR. `parseOutput` runs while the
 * adapter is constructing its return object, so when it throws, the whole
 * object — including the usage the provider already reported — never reaches the
 * caller. The consumption happened; only the parse failed. The observation is
 * therefore attached to the escaping error under a module-private symbol, which
 * keeps the error's own identity intact: the registry still distinguishes
 * parse / schema / transport failures by `instanceof`, and a wrapper error type
 * would have broken that.
 */

export type LLMUsageObservation =
  | { kind: "known"; promptTokens: number; completionTokens: number }
  | { kind: "unknown"; reason: LLMUsageUnknownReason };

/** Closed set: a consumer can branch on it, and it never names anything about the deployment. */
export type LLMUsageUnknownReason =
  /** The provider responded but reported no usage (or a partial one). */
  | "provider_omitted_usage"
  /** The call failed before any usage could be observed (transport, non-2xx, empty body). */
  | "no_usage_observed";

const USAGE_OBSERVATION = Symbol.for("helm.llm.usageObservation");

/**
 * Normalise a provider-reported usage pair.
 *
 * BOTH counts must be finite non-negative integers for the observation to be
 * `known`. A half-reported usage is unknown, not a partial measurement: adding
 * a real prompt count to a defaulted completion count produces a number that
 * looks like a measurement and is not one.
 */
export function observeUsage(usage?: {
  promptTokens?: number | null;
  completionTokens?: number | null;
}): LLMUsageObservation {
  const prompt = usage?.promptTokens;
  const completion = usage?.completionTokens;
  if (isTokenCount(prompt) && isTokenCount(completion)) {
    return { kind: "known", promptTokens: prompt, completionTokens: completion };
  }
  return { kind: "unknown", reason: "provider_omitted_usage" };
}

function isTokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Attach an observation to an escaping error without changing its identity. */
export function attachUsageObservation<E>(error: E, observation: LLMUsageObservation): E {
  if (error !== null && typeof error === "object") {
    Object.defineProperty(error, USAGE_OBSERVATION, {
      value: observation,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return error;
}

/**
 * Read an attached observation.
 *
 * Returns `no_usage_observed` — not `null` — when nothing is attached, so the
 * caller cannot accidentally treat "we never looked" as "nothing was consumed".
 */
export function readUsageObservation(error: unknown): LLMUsageObservation {
  if (error !== null && typeof error === "object") {
    const candidate = (error as Record<symbol, unknown>)[USAGE_OBSERVATION];
    if (isUsageObservation(candidate)) return candidate;
  }
  return { kind: "unknown", reason: "no_usage_observed" };
}

function isUsageObservation(value: unknown): value is LLMUsageObservation {
  if (value === null || typeof value !== "object") return false;
  const row = value as { kind?: unknown; promptTokens?: unknown; completionTokens?: unknown };
  if (row.kind === "known") return isTokenCount(row.promptTokens) && isTokenCount(row.completionTokens);
  return row.kind === "unknown";
}

/** The nullable pair the call ledger stores; `unknown` stays null, never 0. */
export function usageForLedger(observation: LLMUsageObservation): {
  tokenUsagePrompt: number | null;
  tokenUsageCompletion: number | null;
} {
  return observation.kind === "known"
    ? { tokenUsagePrompt: observation.promptTokens, tokenUsageCompletion: observation.completionTokens }
    : { tokenUsagePrompt: null, tokenUsageCompletion: null };
}
