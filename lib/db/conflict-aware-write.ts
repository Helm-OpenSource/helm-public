/**
 * Conflict-aware write helper.
 *
 * MySQL 1020 ("Record has changed since last read") and Prisma P2034
 * ("transaction failed due to a write conflict") show up under concurrent
 * load on hot tables (dailyUsageSnapshot, recommendationLog, membership,
 * etc. — see WORKING-CONTEXT §7 #2). Each call site historically grew its
 * own retry loop with slightly different shapes, which made it hard to
 * change the policy in one place or keep retry/backoff bounded.
 *
 * `runWithWriteConflictRetry` centralises the conflict detection + bounded
 * retry. Call sites pass a thunk and an optional override; everything else
 * (delay, max attempts, conflict-detection) lives here.
 *
 * The helper deliberately throws the original error on the final attempt
 * — no silent swallow — so callers stay in control of fallback behaviour.
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 25;

export type WriteConflictRetryOptions = {
  /** Maximum total attempts including the first try. Default: 3. */
  maxAttempts?: number;
  /** Delay between attempts in ms. Default: 25. */
  retryDelayMs?: number;
  /**
   * Optional caller-supplied predicate. When provided, overrides the default
   * MySQL 1020 / Prisma P2034 / "Record has changed" detection. Use this if
   * a call site needs to widen or narrow the retry surface.
   */
  isConflict?: (error: unknown) => boolean;
};

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function isWriteConflictError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  return (
    code === "P2034" ||
    code === "1020" ||
    /\bP2034\b/.test(message) ||
    /\bcode:\s*1020\b/.test(message) ||
    /Record has changed since last read/i.test(message) ||
    /transaction conflict/i.test(message) ||
    /\bdeadlock\b/i.test(message) ||
    /write conflict/i.test(message)
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function runWithWriteConflictRetry<T>(
  thunk: () => Promise<T>,
  options?: WriteConflictRetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const isConflict = options?.isConflict ?? isWriteConflictError;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await thunk();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isConflict(error)) {
        throw error;
      }
      await sleep(retryDelayMs);
    }
  }

  // Unreachable in practice — the loop either returns or throws.
  throw lastError;
}
