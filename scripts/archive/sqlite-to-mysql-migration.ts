import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_MYSQL_DATABASE_URL, isMysqlDatabaseUrl } from "@/lib/db-url";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

type TableManifest = {
  name: string;
  columns: string[];
  sourceRowCount: number;
  fileName: string;
};

type ExportManifest = {
  generatedAt: string;
  sourceDatabaseUrl: string;
  tableCount: number;
  tables: TableManifest[];
};

type ImportSummary = {
  importedAt: string;
  targetDatabaseUrl: string;
  importedTables: Array<{ name: string; importedRows: number }>;
};

const command = process.argv[2];
const projectRoot = process.cwd();
const outputRoot =
  process.env.SQLITE_MYSQL_MIGRATION_DIR ??
  path.resolve(projectRoot, ".tmp/sqlite-mysql-migration/latest");
const exportDir = path.join(outputRoot, "export");
const reportDir = path.join(outputRoot, "reports");
const manifestPath = path.join(exportDir, "manifest.json");
const importSummaryPath = path.join(reportDir, "import-summary.json");
const reconcileJsonPath = path.join(reportDir, "reconcile-report.json");
const reconcileMarkdownPath = path.join(reportDir, "reconcile-report.md");

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `\`${identifier}\``;
}

function resolveSqliteSourceUrl() {
  return (
    process.env.SQLITE_SOURCE_DATABASE_URL ??
    readEnvVarFromRootFiles("SQLITE_SOURCE_DATABASE_URL", {
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    "file:./dev.db"
  );
}

function resolveTargetMysqlUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    readEnvVarFromRootFiles("DATABASE_URL", {
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    DEFAULT_MYSQL_DATABASE_URL;

  if (!isMysqlDatabaseUrl(databaseUrl)) {
    throw new Error(`Target DATABASE_URL must be mysql://..., received: ${databaseUrl}`);
  }

  return databaseUrl;
}

async function createSqliteClient(databaseUrl: string) {
  const sqliteClientModulePath = pathToFileURL(
    path.resolve(projectRoot, "generated/sqlite-client/index.js"),
  ).href;
  let sqliteModule: { PrismaClient: new (args?: Record<string, unknown>) => PrismaClient };
  try {
    sqliteModule = (await import(sqliteClientModulePath)) as {
      PrismaClient: new (args?: Record<string, unknown>) => PrismaClient;
    };
  } catch {
    throw new Error(
      "SQLite Prisma Client is missing at generated/sqlite-client. Run `npm run db:generate` first.",
    );
  }
  const SqlitePrismaClient = sqliteModule.PrismaClient;

  return new SqlitePrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

async function listSourceTables(sqliteClient: PrismaClient) {
  const rows = (await sqliteClient.$queryRawUnsafe(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_prisma_migrations'
    ORDER BY name ASC
  `)) as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

async function exportCommand() {
  const sourceDatabaseUrl = resolveSqliteSourceUrl();
  const sqliteClient = await createSqliteClient(sourceDatabaseUrl);
  mkdirSync(exportDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  try {
    const tables = await listSourceTables(sqliteClient);
    if (tables.length === 0) {
      throw new Error(
        `No tables found in SQLite source (${sourceDatabaseUrl}). Verify SQLITE_SOURCE_DATABASE_URL points to the intended database.`,
      );
    }
    const manifest: ExportManifest = {
      generatedAt: new Date().toISOString(),
      sourceDatabaseUrl,
      tableCount: tables.length,
      tables: [],
    };

    for (const table of tables) {
      const columns = (await sqliteClient.$queryRawUnsafe(
        `PRAGMA table_info("${table}")`,
      )) as Array<{ name: string }>;
      const columnNames = columns.map((column) => column.name);
      const rows = (await sqliteClient.$queryRawUnsafe(
        `SELECT * FROM "${table}"`,
      )) as Array<Record<string, unknown>>;
      const fileName = `${table}.jsonl`;
      const filePath = path.join(exportDir, fileName);
      const fileContent =
        rows.length > 0 ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";

      writeFileSync(filePath, fileContent, "utf8");
      manifest.tables.push({
        name: table,
        columns: columnNames,
        sourceRowCount: rows.length,
        fileName,
      });
      console.log(`exported ${table}: ${rows.length} row(s)`);
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`sqlite export complete: ${manifestPath}`);
  } finally {
    await sqliteClient.$disconnect();
  }
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ExportManifest;
}

function chunkRows<T>(rows: T[], chunkSize: number) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    result.push(rows.slice(index, index + chunkSize));
  }
  return result;
}

async function importCommand() {
  const targetDatabaseUrl = resolveTargetMysqlUrl();
  const manifest = readManifest();
  const targetClient = new PrismaClient({
    datasources: {
      db: {
        url: targetDatabaseUrl,
      },
    },
  });
  const summary: ImportSummary = {
    importedAt: new Date().toISOString(),
    targetDatabaseUrl,
    importedTables: [],
  };

  mkdirSync(reportDir, { recursive: true });

  try {
    await targetClient.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of manifest.tables) {
      const tableFilePath = path.join(exportDir, table.fileName);
      const rows = readFileSync(tableFilePath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);

      await targetClient.$executeRawUnsafe(`DELETE FROM ${quoteIdentifier(table.name)}`);

      let importedRows = 0;
      for (const rowChunk of chunkRows(rows, 200)) {
        if (rowChunk.length === 0 || table.columns.length === 0) {
          continue;
        }

        const columnsSql = table.columns.map((column) => quoteIdentifier(column)).join(", ");
        const placeholdersSql = rowChunk
          .map(() => `(${table.columns.map(() => "?").join(", ")})`)
          .join(", ");
        const values = rowChunk.flatMap((row) =>
          table.columns.map((column) => row[column] ?? null),
        );
        const insertSql = `INSERT INTO ${quoteIdentifier(table.name)} (${columnsSql}) VALUES ${placeholdersSql}`;
        await targetClient.$executeRawUnsafe(insertSql, ...values);
        importedRows += rowChunk.length;
      }

      summary.importedTables.push({ name: table.name, importedRows });
      console.log(`imported ${table.name}: ${importedRows} row(s)`);
    }
  } finally {
    try {
      await targetClient.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      await targetClient.$disconnect();
    }
  }

  writeFileSync(importSummaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`mysql import complete: ${importSummaryPath}`);
}

async function reconcileCommand() {
  const sourceDatabaseUrl = resolveSqliteSourceUrl();
  const targetDatabaseUrl = resolveTargetMysqlUrl();
  const manifest = readManifest();
  const sqliteClient = await createSqliteClient(sourceDatabaseUrl);
  const targetClient = new PrismaClient({
    datasources: {
      db: {
        url: targetDatabaseUrl,
      },
    },
  });

  mkdirSync(reportDir, { recursive: true });

  try {
    await targetClient.$queryRawUnsafe("SELECT 1");

    const entries = [];
    let mismatchCount = 0;

    for (const table of manifest.tables) {
      const sourceCountRows = (await sqliteClient.$queryRawUnsafe(
        `SELECT COUNT(*) AS c FROM "${table.name}"`,
      )) as Array<{ c: number }>;
      const sourceCount = Number(sourceCountRows[0]?.c ?? 0);

      let targetCount = 0;
      try {
        const targetCountRows = (await targetClient.$queryRawUnsafe(
          `SELECT COUNT(*) AS c FROM ${quoteIdentifier(table.name)}`,
        )) as Array<{ c: number | bigint }>;
        targetCount = Number(targetCountRows[0]?.c ?? 0);
      } catch {
        targetCount = -1;
      }

      const ok = sourceCount === targetCount;
      if (!ok) {
        mismatchCount += 1;
      }

      entries.push({
        table: table.name,
        sourceCount,
        targetCount,
        ok,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      sourceDatabaseUrl,
      targetDatabaseUrl,
      tableCount: entries.length,
      mismatchCount,
      entries,
    };

    writeFileSync(reconcileJsonPath, JSON.stringify(report, null, 2), "utf8");

    const markdown = [
      "# SQLite -> MySQL Reconcile Report",
      "",
      `- generatedAt: ${report.generatedAt}`,
      `- tableCount: ${report.tableCount}`,
      `- mismatchCount: ${report.mismatchCount}`,
      "",
      "| table | sourceCount | targetCount | status |",
      "| --- | ---: | ---: | --- |",
      ...entries.map((entry) => {
        const status = entry.ok ? "OK" : "MISMATCH";
        return `| ${entry.table} | ${entry.sourceCount} | ${entry.targetCount} | ${status} |`;
      }),
      "",
      "## Conclusion",
      report.mismatchCount === 0
        ? "All table counts match."
        : "Mismatch detected. Review JSON report and rerun import/reconcile before cutover.",
    ].join("\n");
    writeFileSync(reconcileMarkdownPath, markdown, "utf8");
    console.log(`reconcile report generated: ${reconcileMarkdownPath}`);
  } finally {
    await sqliteClient.$disconnect();
    await targetClient.$disconnect();
  }
}

async function main() {
  switch (command) {
    case "export":
      await exportCommand();
      break;
    case "import":
      await importCommand();
      break;
    case "reconcile":
      await reconcileCommand();
      break;
    default:
      throw new Error(
        "Usage: tsx scripts/sqlite-to-mysql-migration.ts <export|import|reconcile>",
      );
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
