/**
 * Isolated MySQL suites for the operating-context runtime only run against a disposable database.
 * Rows are retained after the run, so a shared development or production database must never be used.
 */
export function assertDisposableCaioOperatingContextDatabase(integrationDatabaseUrl: string | undefined): void {
  if (!integrationDatabaseUrl || process.env.DATABASE_URL !== integrationDatabaseUrl) {
    throw new Error("DATABASE_URL must equal CAIO_OPERATING_CONTEXT_DATABASE_URL for the isolated integration test.");
  }
  const databaseName = new URL(integrationDatabaseUrl).pathname.replace(/^\//u, "");
  if (!databaseName.startsWith("helm_caio_operating_context_")) {
    throw new Error("CAIO_OPERATING_CONTEXT_DATABASE_URL must name a disposable helm_caio_operating_context_* database.");
  }
}
