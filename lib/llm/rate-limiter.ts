/**
 * rate-limiter — three-tier LLM call rate limiter (per-user / per-workspace / per-IP).
 *
 * Implementation of T019 spec §二 Gap 2 (no rate limit). Token bucket
 * per scope with per-task tier defaults.
 *
 * CURRENT IMPLEMENTATION: in-memory only. Single-process, single-instance.
 * Helm Cloud public trial deployment requires Redis backend (T019.code
 * P1 #b — multi-instance rate limit persistence).
 *
 * Tier defaults (per HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 §二 Gap 2):
 *   - per-user: 60 / minute (briefing tier) | 10 / minute (reasoning tier)
 *   - per-workspace: 1000 / hour
 *   - per-IP (trial): 30 / minute
 *
 * The reasoning tier applies to RECOMMENDATION_EXPLANATION and the heavier
 * BI_REPORT_REVIEW / BI_REPORT_ANALYSIS / MULTI_PASS_REVIEW tasks. Everything
 * else is briefing tier.
 *
 * See HELM_LLM_SPEND_AND_ABUSE_GUARDS_SPEC_V1 (internal) §二 Gap 2.
 */

import type { LLMTaskType } from "@/lib/llm/types";

export class RateLimitedError extends Error {
  public readonly statusCode = 429;
  public readonly scope: "user" | "workspace" | "ip";
  public readonly retryAfterSeconds: number;
  public readonly currentCount: number;
  public readonly limit: number;

  constructor(input: {
    scope: "user" | "workspace" | "ip";
    retryAfterSeconds: number;
    currentCount: number;
    limit: number;
  }) {
    super(
      `RateLimited: scope=${input.scope} count=${input.currentCount} limit=${input.limit}; ` +
        `retry after ${input.retryAfterSeconds}s.`,
    );
    this.name = "RateLimitedError";
    this.scope = input.scope;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.currentCount = input.currentCount;
    this.limit = input.limit;
  }
}

type Bucket = {
  count: number;
  windowStartMs: number;
};

type LimiterConfig = {
  capacity: number;
  windowMs: number;
};

const REASONING_TASKS = new Set<LLMTaskType>([
  "RECOMMENDATION_EXPLANATION",
  "BI_REPORT_ANALYSIS",
  "BI_REPORT_REVIEW",
  "MULTI_PASS_REVIEW",
]);

const TIER_LIMITS = {
  userBriefing: { capacity: 60, windowMs: 60_000 } as LimiterConfig,
  userReasoning: { capacity: 10, windowMs: 60_000 } as LimiterConfig,
  workspaceHourly: { capacity: 1000, windowMs: 3_600_000 } as LimiterConfig,
  ipMinute: { capacity: 30, windowMs: 60_000 } as LimiterConfig,
} as const;

const userBuckets = new Map<string, Bucket>();
const workspaceBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

function bucketKeyForUser(userId: string, tier: "briefing" | "reasoning"): string {
  return `${userId}:${tier}`;
}

function checkAndIncrement(
  bucket: Map<string, Bucket>,
  key: string,
  config: LimiterConfig,
  now: number,
): { allowed: boolean; currentCount: number; limit: number; retryAfterSeconds: number } {
  const existing = bucket.get(key);
  if (!existing || now - existing.windowStartMs >= config.windowMs) {
    bucket.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, currentCount: 1, limit: config.capacity, retryAfterSeconds: 0 };
  }
  if (existing.count + 1 > config.capacity) {
    const elapsed = now - existing.windowStartMs;
    const remainingMs = Math.max(0, config.windowMs - elapsed);
    return {
      allowed: false,
      currentCount: existing.count,
      limit: config.capacity,
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    };
  }
  existing.count += 1;
  return { allowed: true, currentCount: existing.count, limit: config.capacity, retryAfterSeconds: 0 };
}

function resolveUserTier(taskType: LLMTaskType): "briefing" | "reasoning" {
  return REASONING_TASKS.has(taskType) ? "reasoning" : "briefing";
}

export function applyRateLimitPolicy(input: {
  taskType: LLMTaskType;
  workspaceId: string;
  userId?: string | null;
  ip?: string | null;
  now?: number;
}): void {
  const now = input.now ?? Date.now();

  // Tier 1: per-user (only if userId present)
  if (input.userId) {
    const tier = resolveUserTier(input.taskType);
    const config = tier === "reasoning" ? TIER_LIMITS.userReasoning : TIER_LIMITS.userBriefing;
    const check = checkAndIncrement(userBuckets, bucketKeyForUser(input.userId, tier), config, now);
    if (!check.allowed) {
      throw new RateLimitedError({
        scope: "user",
        retryAfterSeconds: check.retryAfterSeconds,
        currentCount: check.currentCount,
        limit: check.limit,
      });
    }
  }

  // Tier 2: per-workspace
  {
    const check = checkAndIncrement(
      workspaceBuckets,
      input.workspaceId,
      TIER_LIMITS.workspaceHourly,
      now,
    );
    if (!check.allowed) {
      throw new RateLimitedError({
        scope: "workspace",
        retryAfterSeconds: check.retryAfterSeconds,
        currentCount: check.currentCount,
        limit: check.limit,
      });
    }
  }

  // Tier 3: per-IP (trial / unauthenticated paths)
  if (input.ip) {
    const check = checkAndIncrement(ipBuckets, input.ip, TIER_LIMITS.ipMinute, now);
    if (!check.allowed) {
      throw new RateLimitedError({
        scope: "ip",
        retryAfterSeconds: check.retryAfterSeconds,
        currentCount: check.currentCount,
        limit: check.limit,
      });
    }
  }
}

/**
 * Test-only helper. Clears all buckets (used by tests to isolate runs).
 */
export function __resetRateLimiterForTests(): void {
  userBuckets.clear();
  workspaceBuckets.clear();
  ipBuckets.clear();
}

export const __RATE_LIMITER_TIER_LIMITS_FOR_TESTS = TIER_LIMITS;
