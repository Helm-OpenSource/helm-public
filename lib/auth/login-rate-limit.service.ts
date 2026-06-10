import { db } from "@/lib/db";
import {
  type LockStatus,
  evaluateLock,
  hashLoginIdentifier,
  nextStateOnFailure,
} from "@/lib/auth/login-rate-limit";

/**
 * Persistence for password-login rate limiting. All operations fail OPEN: if
 * the table has not been migrated yet (or any DB error occurs), login is not
 * blocked — availability is preferred over a hard dependency on this guard.
 */

function isMissingFailedLoginTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("does not exist") ||
    message.includes("no such table") ||
    message.includes("doesn't exist")
  );
}

export async function getLoginLockStatus(
  identifier: string,
  now = new Date(),
): Promise<LockStatus> {
  try {
    const record = await db.failedLoginAttempt.findUnique({
      where: { identifierHash: hashLoginIdentifier(identifier) },
      select: { lockedUntil: true },
    });
    return evaluateLock(record, now);
  } catch (error) {
    if (isMissingFailedLoginTableError(error)) {
      return { locked: false, retryAfterMs: 0 };
    }
    // Unknown DB error: fail open (do not block login on infra trouble).
    return { locked: false, retryAfterMs: 0 };
  }
}

export async function recordFailedLogin(
  identifier: string,
  now = new Date(),
): Promise<void> {
  const identifierHash = hashLoginIdentifier(identifier);
  try {
    const existing = await db.failedLoginAttempt.findUnique({
      where: { identifierHash },
      select: { attemptCount: true, windowStartedAt: true, lockedUntil: true },
    });
    const next = nextStateOnFailure(existing, now);
    await db.failedLoginAttempt.upsert({
      where: { identifierHash },
      create: {
        identifierHash,
        attemptCount: next.attemptCount,
        windowStartedAt: next.windowStartedAt,
        lockedUntil: next.lockedUntil,
      },
      update: {
        attemptCount: next.attemptCount,
        windowStartedAt: next.windowStartedAt,
        lockedUntil: next.lockedUntil,
      },
    });
  } catch (error) {
    if (!isMissingFailedLoginTableError(error)) {
      // Swallow: rate-limit bookkeeping must never break the login path.
    }
  }
}

export async function clearFailedLogins(identifier: string): Promise<void> {
  try {
    await db.failedLoginAttempt.deleteMany({
      where: { identifierHash: hashLoginIdentifier(identifier) },
    });
  } catch {
    // Best-effort cleanup on success; ignore failures.
  }
}
