import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "prisma/migrations/20260713010000_bireport_signalkey_unique/migration.sql";

describe("BI report business signal unique-key migration", () => {
  it("creates the replacement unique key before dropping the recoverability index", () => {
    const migration = readFileSync(MIGRATION_PATH, "utf8");
    const createUnique = migration.indexOf(
      "'CREATE UNIQUE INDEX `bireportbusinesssignal_workspace_signalkey_key`",
    );
    const dropPrevious = migration.indexOf(
      "'DROP INDEX `bireportbusinesssignal_workspace_signalkey_status_idx`",
    );

    expect(createUnique).toBeGreaterThan(-1);
    expect(dropPrevious).toBeGreaterThan(createUnique);
  });

  it("keeps public persistence contracts free of environment-specific rollout details", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model BiReportBusinessSignal {");
    const modelEnd = schema.indexOf("model BiReportSignalNotification {", modelStart);
    const contracts = [
      {
        path: "lib/bi-report-skill/business-signal.ts",
        source: readFileSync("lib/bi-report-skill/business-signal.ts", "utf8"),
      },
      {
        path: "prisma/schema.prisma#BiReportBusinessSignal",
        source: schema.slice(modelStart, modelEnd),
      },
      {
        path: "prisma/manual/20260423_bi_report_business_signal_tables.sql",
        source: readFileSync(
          "prisma/manual/20260423_bi_report_business_signal_tables.sql",
          "utf8",
        ),
      },
      { path: MIGRATION_PATH, source: readFileSync(MIGRATION_PATH, "utf8") },
    ];

    for (const { path, source } of contracts) {
      expect(source, path).not.toMatch(/prod-measured|public[- ]?rds|公网\s*rds|#\d+/i);
    }
  });
});
