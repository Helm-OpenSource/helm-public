export const APPROVALS_OPTIONAL_READ_MODEL_TIMEOUT_MS = 2_500;

export async function resolveOptionalApprovalsReadModel<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = APPROVALS_OPTIONAL_READ_MODEL_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([promise.catch(() => fallback), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
