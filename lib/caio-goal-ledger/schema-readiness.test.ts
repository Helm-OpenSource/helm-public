import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CAIO_GOAL_LEDGER_SCHEMA_MANIFEST,
  CAIO_GOAL_LEDGER_TABLES,
  probeCaioGoalLedgerSchemaReadiness,
  type CaioGoalLedgerSchemaQueryPort,
} from "./schema-readiness";

const MIGRATION = "20261118100000_caio_goal_ledger";

function fakeClient(columns: Array<[string, string]>, fail = false) {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const client: CaioGoalLedgerSchemaQueryPort = {
    async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
      calls.push({ query, values });
      if (fail) throw new Error("connection lost");
      return columns.map(([tableName, columnName]) => ({ tableName, columnName })) as T;
    },
  };
  return { client, calls };
}

const allColumns = CAIO_GOAL_LEDGER_TABLES.flatMap((table) =>
  CAIO_GOAL_LEDGER_SCHEMA_MANIFEST[table].map((column) => [table, column] as [string, string]));

describe("probeCaioGoalLedgerSchemaReadiness", () => {
  it("is ready when every column is visible, case-insensitively, and binds the table names as values", async () => {
    const { client, calls } = fakeClient(allColumns.map(([table, column]) => [table.toLowerCase(), column.toUpperCase()]));
    await expect(probeCaioGoalLedgerSchemaReadiness(client)).resolves.toEqual({ ready: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain("information_schema.COLUMNS");
    expect(calls[0].query).not.toContain("CaioGoalLedger");
    expect(calls[0].values).toEqual(["CaioGoalLedgerEntry", "CaioGoalLedgerHead"]);
  });

  it("names each missing column, including every column of a table the caller cannot see", async () => {
    const withoutWorkspace = allColumns.filter(([, column]) => column !== "workspaceId");
    await expect(probeCaioGoalLedgerSchemaReadiness(fakeClient(withoutWorkspace).client)).resolves.toEqual({
      ready: false, reason: "schema_incomplete", missing: ["CaioGoalLedgerEntry.workspaceId", "CaioGoalLedgerHead.workspaceId"],
    });
    const entryOnly = allColumns.filter(([table]) => table === "CaioGoalLedgerEntry");
    await expect(probeCaioGoalLedgerSchemaReadiness(fakeClient(entryOnly).client)).resolves.toEqual({
      ready: false, reason: "schema_incomplete", missing: CAIO_GOAL_LEDGER_SCHEMA_MANIFEST.CaioGoalLedgerHead.map((column) => `CaioGoalLedgerHead.${column}`),
    });
    await expect(probeCaioGoalLedgerSchemaReadiness(fakeClient([]).client)).resolves.toMatchObject({ ready: false, reason: "schema_incomplete" });
  });

  it("fails closed when the probe query throws", async () => {
    await expect(probeCaioGoalLedgerSchemaReadiness(fakeClient(allColumns, true).client)).resolves.toEqual({
      ready: false, reason: "probe_failed", missing: [],
    });
  });
});

/** Column names of one `CREATE TABLE` block: its lines that start with a backticked name and a type. */
function migrationColumns(sql: string, table: string): string[] {
  const block = sql.split(`CREATE TABLE IF NOT EXISTS \`${table}\` (`)[1]?.split(") DEFAULT CHARACTER SET")[0] ?? "";
  return [...block.matchAll(/^ {4}`(\w+)` [A-Z]/gmu)].map((match) => match[1]);
}

/** Field names of one Prisma model, without block attributes and comments. */
function prismaFields(schema: string, model: string): string[] {
  const block = schema.split(`model ${model} {`)[1]?.split("\n}")[0] ?? "";
  return [...block.matchAll(/^ {2}(\w+) /gmu)].map((match) => match[1]);
}

describe("CAIO goal ledger migration files", () => {
  const migration = readFileSync(`prisma/migrations/${MIGRATION}/migration.sql`, "utf8");
  const rollback = readFileSync("prisma/rollback/20261118_rollback_caio_goal_ledger.sql", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("keeps the manifest equal to the migration's columns and the Prisma models", () => {
    expect([...migration.matchAll(/CREATE TABLE IF NOT EXISTS `(\w+)`/gu)].map((match) => match[1])).toEqual(CAIO_GOAL_LEDGER_TABLES);
    for (const table of CAIO_GOAL_LEDGER_TABLES) {
      expect(migrationColumns(migration, table), table).toEqual(CAIO_GOAL_LEDGER_SCHEMA_MANIFEST[table]);
      expect(prismaFields(schema, table), table).toEqual(CAIO_GOAL_LEDGER_SCHEMA_MANIFEST[table]);
    }
  });

  it("rolls back exactly what the migration creates, and only while both tables are empty", () => {
    expect([...rollback.matchAll(/DROP TABLE `(\w+)`/gu)].map((match) => match[1]).sort()).toEqual([...CAIO_GOAL_LEDGER_TABLES].sort());
    for (const table of CAIO_GOAL_LEDGER_TABLES) expect(rollback).toContain(`(SELECT COUNT(*) FROM \`${table}\`)`);
    expect(rollback.indexOf("SIGNAL SQLSTATE '45000'")).toBeLessThan(rollback.indexOf("DROP TABLE"));
    expect(rollback).toContain(`DELETE FROM \`_prisma_migrations\` WHERE \`migration_name\` = '${MIGRATION}';`);
  });
});
