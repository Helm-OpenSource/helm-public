/**
 * Max-tokens policy — per-task output cap with sanity ceiling enforcement.
 *
 * Implementation of T019 spec §二 Gap 1 (max-tokens cap not enforced).
 *
 * Policy:
 *   1. Each LLMTaskType has a default cap (resolveDefaultMaxOutputTokens)
 *   2. Caller may set input.maxOutputTokens to override the default
 *   3. Override must be <= sanity ceiling (2x default) — exceeds throws
 *      MaxTokensExceededError before any provider call
 *   4. If neither input.maxOutputTokens nor default produces a value, refuse
 *      to proceed
 *
 * This module is provider-agnostic. It runs BEFORE the adapter call inside
 * executeLLMTask, so OpenAI / Qwen / future providers all share the same
 * enforcement.
 *
 * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal).
 */

import type { LLMTaskType } from "@/lib/llm/types";

/**
 * Per-task default output token cap. Reflects typical task verbosity:
 *  - briefing: short structured summary
 *  - extraction: longer structured JSON
 *  - reasoning: explanation + recommendation
 *  - bi-report: longest (full report readout)
 */
const DEFAULT_MAX_OUTPUT_TOKENS_BY_TASK: Record<LLMTaskType, number> = {
  MEETING_MEMORY_EXTRACTION: 2048,
  CONTACT_BRIEFING: 1024,
  COMPANY_BRIEFING: 1024,
  OPPORTUNITY_BRIEFING: 1024,
  MEETING_BRIEFING: 1024,
  RECOMMENDATION_EXPLANATION: 1536,
  EXTERNAL_CASE_ASSIGNMENT: 8192,
  EXTERNAL_CASE_ASSIGNMENT_ACTION_BRIEFING: 1536,
  EXTERNAL_EMPLOYEE_SIGNAL_ACTION_BRIEFING: 1536,
  EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING: 1024,
  BI_REPORT_ANALYSIS: 4096,
  BI_REPORT_REVIEW: 8192,
  JUDGEMENT_BOUNDARY_REVIEW: 2048,
};

/**
 * Sanity ceiling multiplier. Override may be at most this multiple of the
 * per-task default. Above this, request is rejected before provider call.
 * Set to 2 — high enough to allow legitimate edge cases (a particularly
 * long meeting brief), low enough to bound prompt-injection blast radius.
 */
export const SANITY_CEILING_MULTIPLIER = 2;

export class MaxTokensExceededError extends Error {
  public readonly statusCode = 422;
  public readonly taskType: LLMTaskType;
  public readonly requested: number;
  public readonly ceiling: number;

  constructor(taskType: LLMTaskType, requested: number, ceiling: number) {
    super(
      `MaxTokensExceeded: task=${taskType} requested=${requested} ceiling=${ceiling}; ` +
        `the requested maxOutputTokens exceeds the policy ceiling (${SANITY_CEILING_MULTIPLIER}x per-task default).`,
    );
    this.name = "MaxTokensExceededError";
    this.taskType = taskType;
    this.requested = requested;
    this.ceiling = ceiling;
  }
}

export function resolveDefaultMaxOutputTokens(taskType: LLMTaskType): number {
  const value = DEFAULT_MAX_OUTPUT_TOKENS_BY_TASK[taskType];
  if (typeof value !== "number" || value <= 0) {
    // Should never happen if LLMTaskType type and DEFAULT_MAX_OUTPUT_TOKENS_BY_TASK
    // stay synchronized. Defensive fallback.
    return 1024;
  }
  return value;
}

export function resolveSanityCeiling(taskType: LLMTaskType): number {
  return resolveDefaultMaxOutputTokens(taskType) * SANITY_CEILING_MULTIPLIER;
}

/**
 * Resolve the effective maxOutputTokens for a task, applying default +
 * sanity ceiling. Throws MaxTokensExceededError if a caller-supplied
 * override exceeds the ceiling.
 *
 * Always returns a positive integer.
 */
export function applyMaxOutputTokensPolicy(input: {
  taskType: LLMTaskType;
  requestedMaxOutputTokens?: number;
}): number {
  const ceiling = resolveSanityCeiling(input.taskType);
  if (typeof input.requestedMaxOutputTokens === "number" && input.requestedMaxOutputTokens > 0) {
    if (input.requestedMaxOutputTokens > ceiling) {
      throw new MaxTokensExceededError(
        input.taskType,
        input.requestedMaxOutputTokens,
        ceiling,
      );
    }
    return Math.floor(input.requestedMaxOutputTokens);
  }
  return resolveDefaultMaxOutputTokens(input.taskType);
}
