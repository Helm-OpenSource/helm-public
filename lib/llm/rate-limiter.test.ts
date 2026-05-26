import { beforeEach, describe, expect, it } from "vitest";
import {
  RateLimitedError,
  __resetRateLimiterForTests,
  __RATE_LIMITER_TIER_LIMITS_FOR_TESTS as LIMITS,
  applyRateLimitPolicy,
} from "@/lib/llm/rate-limiter";

describe("rate-limiter · per-user briefing tier", () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it("allows calls up to capacity", () => {
    for (let i = 0; i < LIMITS.userBriefing.capacity; i += 1) {
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      });
    }
    // capacity hit on next call
    expect(() =>
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      }),
    ).toThrow(RateLimitedError);
  });

  it("resets after window expires", () => {
    for (let i = 0; i < LIMITS.userBriefing.capacity; i += 1) {
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      });
    }
    // After window, allowed again
    expect(() =>
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: "u-1",
        now: LIMITS.userBriefing.windowMs + 1,
      }),
    ).not.toThrow();
  });
});

describe("rate-limiter · per-user reasoning tier (stricter)", () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it("uses reasoning tier capacity for RECOMMENDATION_EXPLANATION", () => {
    for (let i = 0; i < LIMITS.userReasoning.capacity; i += 1) {
      applyRateLimitPolicy({
        taskType: "RECOMMENDATION_EXPLANATION",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      });
    }
    expect(() =>
      applyRateLimitPolicy({
        taskType: "RECOMMENDATION_EXPLANATION",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      }),
    ).toThrow(RateLimitedError);
  });

  it("briefing tier and reasoning tier buckets are independent", () => {
    // Briefing-tier user hits 10 calls without exhausting reasoning capacity
    for (let i = 0; i < 10; i += 1) {
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      });
    }
    // Reasoning tier should still allow first reasoning call
    expect(() =>
      applyRateLimitPolicy({
        taskType: "RECOMMENDATION_EXPLANATION",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 0,
      }),
    ).not.toThrow();
  });
});

describe("rate-limiter · per-workspace hourly", () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it("throws once workspace exceeds hourly capacity (regardless of user)", () => {
    // Hammer with many users to get past per-user limit (the per-workspace
    // limit is 1000/hour, well above per-user). Use 1001 different users
    // each making 1 call.
    for (let i = 0; i < LIMITS.workspaceHourly.capacity; i += 1) {
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: `u-${i}`,
        now: 0,
      });
    }
    expect(() =>
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: "u-final",
        now: 0,
      }),
    ).toThrow(RateLimitedError);
  });
});

describe("rate-limiter · per-IP minute", () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it("throws once IP exceeds minute capacity", () => {
    for (let i = 0; i < LIMITS.ipMinute.capacity; i += 1) {
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-1",
        userId: `u-${i}`,
        ip: "192.0.2.1",
        now: 0,
      });
    }
    expect(() =>
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: "ws-2",
        userId: "u-x",
        ip: "192.0.2.1",
        now: 0,
      }),
    ).toThrow(RateLimitedError);
  });

  it("no IP scope check when ip is missing", () => {
    // Without IP, only user + workspace scopes apply; should not hit IP limit
    for (let i = 0; i < LIMITS.ipMinute.capacity + 5; i += 1) {
      applyRateLimitPolicy({
        taskType: "CONTACT_BRIEFING",
        workspaceId: `ws-${i}`,
        userId: `u-${i}`,
        now: 0,
      });
    }
    expect(true).toBe(true);
  });
});

describe("rate-limiter · RateLimitedError fields", () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it("carries scope + retryAfterSeconds + currentCount + limit + statusCode", () => {
    for (let i = 0; i < LIMITS.userReasoning.capacity; i += 1) {
      applyRateLimitPolicy({
        taskType: "RECOMMENDATION_EXPLANATION",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 1000,
      });
    }
    try {
      applyRateLimitPolicy({
        taskType: "RECOMMENDATION_EXPLANATION",
        workspaceId: "ws-1",
        userId: "u-1",
        now: 2000,
      });
      expect.fail("Expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitedError);
      const e = err as RateLimitedError;
      expect(e.scope).toBe("user");
      expect(e.statusCode).toBe(429);
      expect(e.limit).toBe(LIMITS.userReasoning.capacity);
      expect(e.currentCount).toBe(LIMITS.userReasoning.capacity);
      expect(e.retryAfterSeconds).toBeGreaterThanOrEqual(0);
      expect(e.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });
});
