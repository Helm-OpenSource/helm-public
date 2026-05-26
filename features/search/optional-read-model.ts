export const SEARCH_OPTIONAL_READ_MODEL_TIMEOUT_MS = 1_500;

export type OptionalSearchReadModelResult<T> =
  | {
      data: T;
      degraded: false;
      reason: "ready";
    }
  | {
      data: T;
      degraded: true;
      reason: "error" | "timeout";
    };

export async function resolveOptionalSearchReadModel<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = SEARCH_OPTIONAL_READ_MODEL_TIMEOUT_MS,
): Promise<OptionalSearchReadModelResult<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<OptionalSearchReadModelResult<T>>((resolve) => {
    timer = setTimeout(
      () => resolve({ data: fallback, degraded: true, reason: "timeout" }),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([
      promise
        .then<OptionalSearchReadModelResult<T>>((data) => ({
          data,
          degraded: false as const,
          reason: "ready" as const,
        }))
        .catch<OptionalSearchReadModelResult<T>>(() => ({
          data: fallback,
          degraded: true as const,
          reason: "error" as const,
        })),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
