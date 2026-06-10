import { describe, expect, it } from "vitest";

import {
  SHADOW_DB_ENV,
  STRICT_ENV,
  buildMigrationDiffArgs,
  interpretDriftExitCode,
  planMigrationDriftCheck,
} from "@/lib/db/migration-drift";

describe("planMigrationDriftCheck", () => {
  it("skips when no shadow database URL is configured", () => {
    const plan = planMigrationDriftCheck({});
    expect(plan.kind).toBe("skip");
  });

  it("runs (non-strict) when a shadow URL is set", () => {
    const plan = planMigrationDriftCheck({ [SHADOW_DB_ENV]: "mysql://x" });
    expect(plan).toEqual({ kind: "run", shadowDatabaseUrl: "mysql://x", strict: false });
  });

  it("honors strict mode", () => {
    const plan = planMigrationDriftCheck({
      [SHADOW_DB_ENV]: "mysql://x",
      [STRICT_ENV]: "true",
    });
    expect(plan).toMatchObject({ kind: "run", strict: true });
  });

  it("treats whitespace-only shadow URL as unset", () => {
    expect(planMigrationDriftCheck({ [SHADOW_DB_ENV]: "   " }).kind).toBe("skip");
  });
});

describe("buildMigrationDiffArgs", () => {
  it("builds a migrations→schema diff with exit-code", () => {
    expect(
      buildMigrationDiffArgs({
        migrationsDir: "prisma/migrations",
        schemaPath: "prisma/schema.prisma",
        shadowDatabaseUrl: "mysql://shadow",
      }),
    ).toEqual([
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--shadow-database-url",
      "mysql://shadow",
      "--exit-code",
    ]);
  });
});

describe("interpretDriftExitCode", () => {
  it("0 → pass", () => {
    expect(interpretDriftExitCode(0, false)).toMatchObject({ drift: false, processExitCode: 0 });
    expect(interpretDriftExitCode(0, true)).toMatchObject({ drift: false, processExitCode: 0 });
  });

  it("2 → drift; non-gating unless strict", () => {
    expect(interpretDriftExitCode(2, false)).toMatchObject({ drift: true, processExitCode: 0 });
    expect(interpretDriftExitCode(2, true)).toMatchObject({ drift: true, processExitCode: 1 });
  });

  it("other codes → error; gated only in strict", () => {
    expect(interpretDriftExitCode(1, false)).toMatchObject({ drift: false, processExitCode: 0 });
    expect(interpretDriftExitCode(1, true)).toMatchObject({ drift: false, processExitCode: 1 });
  });
});
