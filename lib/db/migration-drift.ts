/**
 * Pure logic for the migration-drift guard (see scripts/check-migration-drift.ts).
 *
 * The guard answers: "does replaying prisma/migrations reproduce schema.prisma?"
 * Earlier in this repo a column/table set existed in schema.prisma with no
 * corresponding migration, and nothing caught it — typecheck/build pass because
 * the Prisma client is generated straight from schema.prisma, and the runtime
 * setup layers prisma/manual/*.sql on top, masking the gap on prepared DBs.
 *
 * Detecting it requires a throwaway shadow database (Prisma replays the
 * migrations there). That infra only exists in CI (a MySQL service container),
 * so this module keeps the decision logic pure and testable while the script
 * shells out to `prisma migrate diff`.
 */

export const SHADOW_DB_ENV = "MIGRATION_DRIFT_SHADOW_DATABASE_URL";
export const STRICT_ENV = "MIGRATION_DRIFT_STRICT";

export type DriftCheckPlan =
  | { kind: "skip"; reason: string }
  | { kind: "run"; shadowDatabaseUrl: string; strict: boolean };

export function planMigrationDriftCheck(env: NodeJS.ProcessEnv): DriftCheckPlan {
  const shadowDatabaseUrl = env[SHADOW_DB_ENV]?.trim();
  if (!shadowDatabaseUrl) {
    return {
      kind: "skip",
      reason: `${SHADOW_DB_ENV} is not set — skipping migration-drift check (requires a throwaway shadow database, e.g. a CI MySQL service).`,
    };
  }
  return {
    kind: "run",
    shadowDatabaseUrl,
    strict: env[STRICT_ENV]?.trim().toLowerCase() === "true",
  };
}

export function buildMigrationDiffArgs(input: {
  migrationsDir: string;
  schemaPath: string;
  shadowDatabaseUrl: string;
}): string[] {
  return [
    "migrate",
    "diff",
    "--from-migrations",
    input.migrationsDir,
    "--to-schema-datamodel",
    input.schemaPath,
    "--shadow-database-url",
    input.shadowDatabaseUrl,
    "--exit-code",
  ];
}

export type DriftOutcome = {
  drift: boolean;
  /** Process exit code the script should use. */
  processExitCode: 0 | 1;
  message: string;
};

/**
 * Interprets the exit code of `prisma migrate diff --exit-code`:
 *   0  → no diff (no drift)
 *   2  → a diff exists (drift)
 *   1  → the diff command itself errored
 */
export function interpretDriftExitCode(
  diffExitCode: number,
  strict: boolean,
): DriftOutcome {
  if (diffExitCode === 0) {
    return {
      drift: false,
      processExitCode: 0,
      message: "migration-drift: PASS — migrations reproduce schema.prisma.",
    };
  }
  if (diffExitCode === 2) {
    return {
      drift: true,
      // Non-gating unless explicitly opted in, so the guard can be rolled out
      // before a maintainer has validated it against real CI infra.
      processExitCode: strict ? 1 : 0,
      message: strict
        ? "migration-drift: FAIL — migrations do NOT reproduce schema.prisma. Add a migration for the schema changes."
        : "migration-drift: WARN — drift detected (non-strict mode; set MIGRATION_DRIFT_STRICT=true to fail). Add a migration for the schema changes.",
    };
  }
  return {
    drift: false,
    processExitCode: strict ? 1 : 0,
    message: `migration-drift: ERROR — \`prisma migrate diff\` exited ${diffExitCode}. Check the shadow database configuration.`,
  };
}
