const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 20;

const buckets = new Map<string, { windowStartedAt: number; count: number }>();

export function consumeTenantHealthViewBudget(
  key: string,
  now = Date.now(),
  limit = DEFAULT_LIMIT,
) {
  const current = buckets.get(key);
  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
}

export function resetTenantHealthRateLimitForTesting() {
  buckets.clear();
}
