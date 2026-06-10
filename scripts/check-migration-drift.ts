#!/usr/bin/env tsx

/**
 * Migration-drift guard.
 *
 * Verifies that replaying `prisma/migrations` reproduces `prisma/schema.prisma`,
 * catching the failure mode where a model/column is added to the schema with no
 * corresponding migration (the Prisma client is generated from the schema, so
 * typecheck/build never notice).
 *
 * Requires a throwaway shadow database (Prisma replays the migrations into it).
 * Set the connection string in MIGRATION_DRIFT_SHADOW_DATABASE_URL — in CI this
 * is a MySQL service container whose user can CREATE/DROP. When unset, the check
 * skips cleanly so local runs and infra-less CI are unaffected.
 *
 * Non-gating by default: drift is reported as a WARN. Set
 * MIGRATION_DRIFT_STRICT=true to fail the process on drift.
 *
 *   MIGRATION_DRIFT_SHADOW_DATABASE_URL=mysql://root:root@127.0.0.1:3306/helm_shadow \
 *   MIGRATION_DRIFT_STRICT=true \
 *   tsx scripts/check-migration-drift.ts
 *
 * NOTE: the guard compares migrations→schema only. Tables created by
 * prisma/manual/*.sql (not by a migration) will surface as drift — fold those
 * into real migrations, or they must be reconciled before enabling strict mode.
 *
 * CI wiring (GitHub Actions) once the manual-SQL precondition is met:
 *
 *   migration-drift:
 *     runs-on: ubuntu-latest
 *     services:
 *       mysql:
 *         image: mysql:8.0
 *         env: { MYSQL_ROOT_PASSWORD: root, MYSQL_DATABASE: helm_shadow }
 *         ports: ["3306:3306"]
 *         options: >-
 *           --health-cmd="mysqladmin ping" --health-interval=10s
 *           --health-timeout=5s --health-retries=10
 *     steps:
 *       - uses: actions/checkout@v4
 *       - run: npm ci
 *       - run: npm run db:generate
 *       - run: npx tsx scripts/check-migration-drift.ts
 *         env:
 *           MIGRATION_DRIFT_SHADOW_DATABASE_URL: mysql://root:root@127.0.0.1:3306/helm_shadow
 *           MIGRATION_DRIFT_STRICT: "true"
 */

import { spawnSync } from "node:child_process";
import {
  buildMigrationDiffArgs,
  interpretDriftExitCode,
  planMigrationDriftCheck,
} from "@/lib/db/migration-drift";

function main(): number {
  const plan = planMigrationDriftCheck(process.env);
  if (plan.kind === "skip") {
    console.log(`migration-drift: SKIP — ${plan.reason}`);
    return 0;
  }

  const args = buildMigrationDiffArgs({
    migrationsDir: "prisma/migrations",
    schemaPath: "prisma/schema.prisma",
    shadowDatabaseUrl: plan.shadowDatabaseUrl,
  });

  const result = spawnSync("prisma", args, {
    cwd: process.cwd(),
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });

  if (result.error) {
    console.error(
      `migration-drift: ERROR — could not run \`prisma migrate diff\`: ${result.error.message}`,
    );
    return plan.strict ? 1 : 0;
  }

  const outcome = interpretDriftExitCode(result.status ?? 1, plan.strict);
  if (outcome.drift || outcome.processExitCode !== 0) {
    console.error(outcome.message);
  } else {
    console.log(outcome.message);
  }
  return outcome.processExitCode;
}

process.exitCode = main();
