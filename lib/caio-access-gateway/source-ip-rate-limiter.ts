/**
 * Pre-authentication per-source-ip cost control.
 *
 * The per-token limiter in token-store.service can only run once a token has
 * resolved, so it cannot charge anything for requests that never present a
 * valid credential (no bearer header, unknown token, wrong audience, revoked,
 * expired, wrong source ip). This limiter closes that gap: the gateway HTTP
 * core claims a slot keyed on the TRANSPORT-observed client ip before any
 * token lookup, so invalid credentials cost budget.
 *
 * Fail-closed properties:
 * - An unusable source ip (empty/blank) is refused rather than sharing one
 *   bucket with every other caller.
 * - The tracking table is bounded. When it is full of live windows a new
 *   source is refused instead of growing memory without limit; elapsed
 *   windows are evicted first so capacity is reclaimed naturally.
 * - The refusal shape carries no information about tokens: the limiter never
 *   sees a token, a token hash, or a principal.
 */

import type { CaioRateSlotResult } from "@/lib/caio-access-gateway/token-store.service";

export const CAIO_SOURCE_IP_RATE_WINDOW_MS = 60_000;
export const CAIO_DEFAULT_SOURCE_IP_LIMIT_PER_MINUTE = 120;
export const CAIO_DEFAULT_MAX_TRACKED_SOURCE_IPS = 10_000;

export type CaioPreAuthRateLimiterPort = Readonly<{
  /**
   * Count one request against the source-ip window BEFORE any token lookup.
   * Implementations must fail closed: refuse (or throw) when the limiter
   * cannot account for the request.
   */
  claimSourceIpSlot(input: {
    sourceIp: string;
    now: Date;
  }): Promise<CaioRateSlotResult>;
}>;

function refused(retryAfterSeconds: number): CaioRateSlotResult {
  return Object.freeze({
    allowed: false as const,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
  });
}

const ALLOWED: CaioRateSlotResult = Object.freeze({ allowed: true as const });

/**
 * Process-local fixed-window limiter. Suitable for a single gateway process
 * on a LAN appliance; a multi-process deployment needs a shared-store
 * implementation of the same port.
 */
export function createInMemoryCaioSourceIpRateLimiter(
  options: Readonly<{
    limitPerMinute?: number;
    windowMs?: number;
    maxTrackedSources?: number;
  }> = {},
): CaioPreAuthRateLimiterPort {
  const limit = Math.max(
    1,
    Math.floor(
      options.limitPerMinute ?? CAIO_DEFAULT_SOURCE_IP_LIMIT_PER_MINUTE,
    ),
  );
  const windowMs = Math.max(
    1_000,
    Math.floor(options.windowMs ?? CAIO_SOURCE_IP_RATE_WINDOW_MS),
  );
  const maxTracked = Math.max(
    1,
    Math.floor(
      options.maxTrackedSources ?? CAIO_DEFAULT_MAX_TRACKED_SOURCE_IPS,
    ),
  );

  const windows = new Map<string, { startedAt: number; count: number }>();

  function evictElapsed(nowMs: number): void {
    for (const [key, window] of windows) {
      if (nowMs - window.startedAt >= windowMs) windows.delete(key);
    }
  }

  return Object.freeze({
    async claimSourceIpSlot(input): Promise<CaioRateSlotResult> {
      const key = input.sourceIp.trim();
      if (key.length === 0 || key.length > 128) {
        return refused(windowMs / 1000);
      }
      const nowMs = input.now.getTime();
      if (!Number.isFinite(nowMs)) return refused(windowMs / 1000);

      const existing = windows.get(key);
      if (existing !== undefined) {
        if (nowMs - existing.startedAt >= windowMs) {
          existing.startedAt = nowMs;
          existing.count = 1;
          return ALLOWED;
        }
        if (existing.count < limit) {
          existing.count += 1;
          return ALLOWED;
        }
        return refused((existing.startedAt + windowMs - nowMs) / 1000);
      }

      if (windows.size >= maxTracked) {
        evictElapsed(nowMs);
        if (windows.size >= maxTracked) {
          // Fail closed: no room to account for this source.
          return refused(windowMs / 1000);
        }
      }
      windows.set(key, { startedAt: nowMs, count: 1 });
      return ALLOWED;
    },
  });
}
