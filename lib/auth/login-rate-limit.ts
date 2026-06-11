import { createHash } from "node:crypto";

/**
 * Pure decision logic for durable password-login rate limiting.
 *
 * Password login (features/auth/actions.ts) had no attempt limiting — unlimited
 * guesses against any identifier. This module keeps a per-identifier failed-
 * attempt counter with a sliding window and a lockout, persisted in the
 * `FailedLoginAttempt` table (see lib/auth/login-rate-limit.service.ts). The
 * identifier is HASHED, never stored raw, and attempts are counted for any
 * identifier (existent or not) so the lockout reveals nothing about account
 * existence — preserving the enumeration resistance added alongside it.
 */

export const LOGIN_RATE_LIMIT = {
  /** Sliding window over which failures accumulate. */
  windowMs: 15 * 60 * 1000,
  /** Failures within the window before the identifier is locked. */
  maxAttempts: 8,
  /** How long the lockout lasts once tripped. */
  lockMs: 15 * 60 * 1000,
} as const;

export type FailedLoginAttemptState = {
  attemptCount: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

export function hashLoginIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

export type LockStatus = {
  locked: boolean;
  /** Milliseconds until the lock expires (0 when not locked). */
  retryAfterMs: number;
};

export function evaluateLock(
  record: Pick<FailedLoginAttemptState, "lockedUntil"> | null,
  now: Date,
): LockStatus {
  const lockedUntil = record?.lockedUntil;
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    return { locked: true, retryAfterMs: lockedUntil.getTime() - now.getTime() };
  }
  return { locked: false, retryAfterMs: 0 };
}

/**
 * Computes the new counter state after a FAILED attempt.
 * Resets the window when the previous one has elapsed; trips the lock once the
 * attempt count reaches the threshold within the window.
 */
export function nextStateOnFailure(
  record: FailedLoginAttemptState | null,
  now: Date,
): FailedLoginAttemptState {
  const windowExpired =
    !record || now.getTime() - record.windowStartedAt.getTime() >= LOGIN_RATE_LIMIT.windowMs;

  // A still-active lock is left in place; a fresh window starts otherwise.
  if (windowExpired) {
    return { attemptCount: 1, windowStartedAt: now, lockedUntil: record?.lockedUntil ?? null };
  }

  const attemptCount = record.attemptCount + 1;
  const lockedUntil =
    attemptCount >= LOGIN_RATE_LIMIT.maxAttempts
      ? new Date(now.getTime() + LOGIN_RATE_LIMIT.lockMs)
      : record.lockedUntil ?? null;

  return { attemptCount, windowStartedAt: record.windowStartedAt, lockedUntil };
}
