import { Prisma } from "@prisma/client";

/**
 * Detects "table has not been migrated yet" errors in a dialect-independent
 * way. Several BI-report persistence modules degrade to empty/no-op when their
 * tables are missing (the documented "tables not migrated yet" fallback).
 *
 * Earlier helpers string-matched Postgres (`relation "X" does not exist`) and
 * SQLite (`no such table: X`) message shapes only, so on MySQL — the actual
 * production engine — the fallback never matched and the modules threw. Prisma
 * raises P2021 ("The table does not exist in the current database") regardless
 * of engine, so prefer the error code and keep the message matches as a
 * belt-and-suspenders for non-Prisma errors and older engines.
 */
export function isMissingTableError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("does not exist") ||
    message.includes("no such table") ||
    message.includes("doesn't exist")
  );
}
