import { describe, expect, it } from "vitest";

import {
  LOGIN_RATE_LIMIT,
  evaluateLock,
  hashLoginIdentifier,
  nextStateOnFailure,
} from "@/lib/auth/login-rate-limit";

describe("hashLoginIdentifier", () => {
  it("normalizes case/whitespace and never returns the raw identifier", () => {
    const a = hashLoginIdentifier("  User@Example.com ");
    const b = hashLoginIdentifier("user@example.com");
    expect(a).toBe(b);
    expect(a).not.toContain("user@example.com");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("evaluateLock", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("reports unlocked for null / past / absent lock", () => {
    expect(evaluateLock(null, now).locked).toBe(false);
    expect(evaluateLock({ lockedUntil: null }, now).locked).toBe(false);
    expect(evaluateLock({ lockedUntil: new Date(now.getTime() - 1000) }, now).locked).toBe(false);
  });

  it("reports locked with remaining time for a future lock", () => {
    const status = evaluateLock({ lockedUntil: new Date(now.getTime() + 5000) }, now);
    expect(status.locked).toBe(true);
    expect(status.retryAfterMs).toBe(5000);
  });
});

describe("nextStateOnFailure", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("starts a fresh window on the first failure", () => {
    const next = nextStateOnFailure(null, now);
    expect(next.attemptCount).toBe(1);
    expect(next.windowStartedAt).toBe(now);
    expect(next.lockedUntil).toBeNull();
  });

  it("increments within the window without locking below the threshold", () => {
    const next = nextStateOnFailure(
      { attemptCount: 3, windowStartedAt: now, lockedUntil: null },
      new Date(now.getTime() + 1000),
    );
    expect(next.attemptCount).toBe(4);
    expect(next.lockedUntil).toBeNull();
  });

  it("trips the lock once attempts reach the threshold", () => {
    const next = nextStateOnFailure(
      { attemptCount: LOGIN_RATE_LIMIT.maxAttempts - 1, windowStartedAt: now, lockedUntil: null },
      now,
    );
    expect(next.attemptCount).toBe(LOGIN_RATE_LIMIT.maxAttempts);
    expect(next.lockedUntil?.getTime()).toBe(now.getTime() + LOGIN_RATE_LIMIT.lockMs);
  });

  it("resets the window once it has elapsed", () => {
    const next = nextStateOnFailure(
      { attemptCount: 7, windowStartedAt: now, lockedUntil: null },
      new Date(now.getTime() + LOGIN_RATE_LIMIT.windowMs + 1),
    );
    expect(next.attemptCount).toBe(1);
  });
});
