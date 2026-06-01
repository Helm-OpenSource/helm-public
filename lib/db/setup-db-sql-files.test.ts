import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isIgnorableExtensionSetupSqlError,
  listExtensionSetupSqlFiles,
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
    writeSql(root, "tenant-a/ext-a/report-skills/signal_daily/query.sql");
    writeSql(root, "tenant-a/ext-a/report-skills/sql_named_skill/query.sql");
    writeSql(root, "tenant-a/ext-a/docs/example.sql");

    expect(listExtensionSetupSqlFiles(root)).toEqual([nestedSetupSql, setupSql].sort());
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
