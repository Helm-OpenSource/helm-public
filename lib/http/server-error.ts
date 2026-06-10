/**
 * Server-error response helper.
 *
 * Many API routes returned `error instanceof Error ? error.message : "<fallback>"`
 * to clients on 500s. That leaks internal details (Prisma table names, DB hosts,
 * file paths, stack fragments) to unauthenticated callers, and — because most
 * routes did not also log server-side — the leaked message was often the only
 * record of the failure.
 *
 * `serverErrorMessage` logs the real error server-side (where operators can see
 * it) and returns ONLY the caller-supplied generic fallback for the client.
 */
export function serverErrorMessage(
  error: unknown,
  fallbackMessage: string,
  context?: string,
): string {
  const label = context ? `[${context}]` : "[api]";
  if (error instanceof Error) {
    console.error(`${label} ${error.name}: ${error.message}`, error.stack);
  } else {
    console.error(`${label} non-error thrown:`, error);
  }
  return fallbackMessage;
}
