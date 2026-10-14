import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isIgnorableExtensionSetupSqlError,
  listExtensionSetupSqlFiles,
  splitSqlStatements,
} from "../../prisma/setup-db-sql-files";

const tempRoots: string[] = [];

function makeTempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "helm-setup-db-sql-"));
  tempRoots.push(root);
  return root;
}

function writeSql(root: string, relativePath: string) {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, "SELECT 1;\n");
  return fullPath;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("listExtensionSetupSqlFiles", () => {
  it("includes only explicit extension setup SQL directories", () => {
    const root = makeTempRoot();
    const setupSql = writeSql(root, "tenant-a/ext-a/sql/create_table.sql");
    const nestedSetupSql = writeSql(root, "tenant-a/ext-a/sql/nested/seed.sql");
    const ordinaryUpgrade = writeSql(root, "tenant-a/ext-a/sql/ordinary_upgrade.sql");
    const lateBase = writeSql(root, "tenant-a/ext-a/sql/z_base_table.sql");
    writeFileSync(lateBase, "CREATE TABLE IF NOT EXISTS base_table (id INT PRIMARY KEY);\n");
    const earlyUpgrade = writeSql(root, "tenant-a/ext-a/sql/a_upgrade_table.sql");
    writeFileSync(earlyUpgrade, "ALTER TABLE base_table ADD COLUMN name VARCHAR(20);\n");
    writeSql(root, "tenant-a/ext-a/sql/mysql8.integration.test.sql");
    writeSql(root, "tenant-a/ext-a/sql/mysql8.integration.spec.sql");
    writeSql(root, "tenant-a/ext-a/sql/rollback_feature.rollback.sql");
    const delimiterRunner = writeSql(root, "tenant-a/ext-a/sql/procedure_runner.sql");
    writeFileSync(delimiterRunner, "-- DELIMITER is documented here only\nDELIMITER //\nCREATE PROCEDURE p() SELECT 1//\n");
    const preparedRunner = writeSql(root, "tenant-a/ext-a/sql/prepared_runner.sql");
    writeFileSync(preparedRunner, "-- PREPARE is documented here only\nPREPARE stmt FROM @sql;\n");
    writeSql(root, "tenant-a/ext-a/report-skills/signal_daily/query.sql");
    writeSql(root, "tenant-a/ext-a/report-skills/sql_named_skill/query.sql");
    writeSql(root, "tenant-a/ext-a/docs/example.sql");

    expect(listExtensionSetupSqlFiles(root)).toEqual([lateBase, earlyUpgrade, nestedSetupSql, ordinaryUpgrade, setupSql].sort((a, b) => {
      const baseRank = (file: string) => file === lateBase ? 0 : 1;
      return baseRank(a) - baseRank(b) || a.localeCompare(b);
    }));
  });
});

describe("isIgnorableExtensionSetupSqlError", () => {
  it("ignores duplicate column and duplicate key errors from idempotent extension upgrades", () => {
    expect(isIgnorableExtensionSetupSqlError(new Error("Raw query failed. Code: `1060`."))).toBe(
      true,
    );
    expect(isIgnorableExtensionSetupSqlError("Duplicate key name 'idx_existing'")).toBe(true);
  });

  it("does not ignore syntax or permission errors", () => {
    expect(isIgnorableExtensionSetupSqlError(new Error("Raw query failed. Code: `1064`."))).toBe(
      false,
    );
    expect(isIgnorableExtensionSetupSqlError("Access denied")).toBe(false);
  });
});

describe("splitSqlStatements", () => {
  it("removes leading line comments without dropping the following statement", () => {
    expect(splitSqlStatements("-- migration note\nALTER TABLE sample ADD COLUMN flag INT;\n-- next\nSELECT 1;\n")).toEqual([
      "ALTER TABLE sample ADD COLUMN flag INT",
      "SELECT 1",
    ]);
  });
});
