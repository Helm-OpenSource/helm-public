import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_MYSQL_DATABASE_URL, getDatabaseNameFromUrl, isMysqlDatabaseUrl } from "@/lib/db-url";
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
  sourceDatabaseName: string;
  tableCount: number;
  tables: TableManifest[];
};

type ImportSummary = {
  importedAt: string;
  targetDatabaseUrl: string;
  targetDatabaseName: string;
  importedTables: Array<{ name: string; importedRows: number }>;
};

type CountEntry = {
  table: string;
  sourceCount: number;
  targetCount: number;
  ok: boolean;
};

type ChainCheck = {
  chain: string;
  table: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
  orphanCount: number;
  ok: boolean;
};

type UniqueViolation = {
  table: string;
  indexName: string;
  columns: string[];
  duplicateGroupCount: number;
};

type Marker =
  | { __phase2_type: "bigint"; value: string }
  | { __phase2_type: "date"; value: string }
  | { __phase2_type: "buffer"; value: string };

const command = process.argv[2];
const projectRoot = process.cwd();
const outputRoot =
  process.env.PHASE2_MIGRATION_DIR ??
  path.resolve(projectRoot, ".tmp/mysql-phase2-mandatory/latest");
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

function toCount(value: unknown) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

function resolveMysqlUrl(varName: "DATABASE_URL" | "PHASE2_SOURCE_DATABASE_URL", fallback?: string) {
  const value =
    process.env[varName] ??
    readEnvVarFromRootFiles(varName, {
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    fallback;

  if (!value || !isMysqlDatabaseUrl(value)) {
    throw new Error(`${varName} must be mysql://..., received: ${value ?? "(empty)"}`);
  }

  return value;
}

function resolveSourceDatabaseUrl() {
  return (
    process.env.PHASE2_SOURCE_DATABASE_URL ??
    readEnvVarFromRootFiles("PHASE2_SOURCE_DATABASE_URL", {
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    resolveMysqlUrl("DATABASE_URL", DEFAULT_MYSQL_DATABASE_URL)
  );
}

function resolveTargetDatabaseUrl() {
  return resolveMysqlUrl("DATABASE_URL", DEFAULT_MYSQL_DATABASE_URL);
}

function createMysqlClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

async function listTables(client: PrismaClient, databaseName: string) {
  const rows = (await client.$queryRawUnsafe(
    `
      SELECT table_name AS tableName
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name ASC
    `,
    databaseName,
  )) as Array<{ tableName: string }>;

  return rows.map((row) => row.tableName);
}

async function listColumns(client: PrismaClient, databaseName: string, tableName: string) {
  const rows = (await client.$queryRawUnsafe(
    `
      SELECT column_name AS columnName
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position ASC
    `,
    databaseName,
    tableName,
  )) as Array<{ columnName: string }>;

  return rows.map((row) => row.columnName);
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "bigint") {
    return {
      __phase2_type: "bigint",
      value: value.toString(),
    } satisfies Marker;
  }
  if (value instanceof Date) {
    return {
      __phase2_type: "date",
      value: value.toISOString(),
    } satisfies Marker;
  }
  if (Buffer.isBuffer(value)) {
    return {
      __phase2_type: "buffer",
      value: value.toString("base64"),
    } satisfies Marker;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }
  if (typeof value === "object") {
    return value;
  }
  return value;
}

function deserializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const marker = value as Partial<Marker>;
    if (marker.__phase2_type === "bigint" && typeof marker.value === "string") {
      return marker.value;
    }
    if (marker.__phase2_type === "date" && typeof marker.value === "string") {
      return marker.value;
    }
    if (marker.__phase2_type === "buffer" && typeof marker.value === "string") {
      return Buffer.from(marker.value, "base64");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function chunkRows<T>(rows: T[], chunkSize: number) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    result.push(rows.slice(index, index + chunkSize));
  }
  return result;
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ExportManifest;
}

async function exportCommand() {
  const sourceDatabaseUrl = resolveSourceDatabaseUrl();
  const sourceDatabaseName = getDatabaseNameFromUrl(sourceDatabaseUrl);
  if (!sourceDatabaseName) {
    throw new Error(`Failed to parse source database name: ${sourceDatabaseUrl}`);
  }

  mkdirSync(exportDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  const sourceClient = createMysqlClient(sourceDatabaseUrl);

  try {
    const tables = await listTables(sourceClient, sourceDatabaseName);
    if (tables.length === 0) {
      throw new Error(`No tables found in source database: ${sourceDatabaseName}`);
    }

    const manifest: ExportManifest = {
      generatedAt: new Date().toISOString(),
      sourceDatabaseUrl,
      sourceDatabaseName,
      tableCount: tables.length,
      tables: [],
    };

    for (const table of tables) {
      const columns = await listColumns(sourceClient, sourceDatabaseName, table);
      const rows = (await sourceClient.$queryRawUnsafe(
        `SELECT * FROM ${quoteIdentifier(table)}`,
      )) as Array<Record<string, unknown>>;

      const serializedRows = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, serializeValue(value)]),
        ),
      );
      const fileName = `${table}.jsonl`;
      const filePath = path.join(exportDir, fileName);
      const fileContent =
        serializedRows.length > 0
          ? `${serializedRows.map((row) => JSON.stringify(row)).join("\n")}\n`
          : "";

      writeFileSync(filePath, fileContent, "utf8");
      manifest.tables.push({
        name: table,
        columns,
        sourceRowCount: rows.length,
        fileName,
      });

      console.log(`exported ${table}: ${rows.length} row(s)`);
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`phase2 export complete: ${manifestPath}`);
  } finally {
    await sourceClient.$disconnect();
  }
}

async function importCommand() {
  const targetDatabaseUrl = resolveTargetDatabaseUrl();
  const targetDatabaseName = getDatabaseNameFromUrl(targetDatabaseUrl);
  if (!targetDatabaseName) {
    throw new Error(`Failed to parse target database name: ${targetDatabaseUrl}`);
  }

  const manifest = readManifest();
  const targetClient = createMysqlClient(targetDatabaseUrl);
  const summary: ImportSummary = {
    importedAt: new Date().toISOString(),
    targetDatabaseUrl,
    targetDatabaseName,
    importedTables: [],
  };
  mkdirSync(reportDir, { recursive: true });

  try {
    const targetTables = new Set(await listTables(targetClient, targetDatabaseName));
    await targetClient.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of manifest.tables) {
      if (!targetTables.has(table.name)) {
        throw new Error(
          `Table "${table.name}" from export manifest does not exist in target database "${targetDatabaseName}".`,
        );
      }

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
          table.columns.map((column) => deserializeValue(row[column] ?? null)),
        );
        const insertSql = `INSERT INTO ${quoteIdentifier(table.name)} (${columnsSql}) VALUES ${placeholdersSql}`;
        await targetClient.$executeRawUnsafe(insertSql, ...values);
        importedRows += rowChunk.length;
      }

      summary.importedTables.push({
        name: table.name,
        importedRows,
      });
      console.log(`imported ${table.name}: ${importedRows} row(s)`);
    }

    writeFileSync(importSummaryPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`phase2 import complete: ${importSummaryPath}`);
  } finally {
    try {
      await targetClient.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      await targetClient.$disconnect();
    }
  }
}

async function loadTableColumnsMap(client: PrismaClient, databaseName: string) {
  const rows = (await client.$queryRawUnsafe(
    `
      SELECT table_name AS tableName, column_name AS columnName
      FROM information_schema.columns
      WHERE table_schema = ?
      ORDER BY table_name, ordinal_position
    `,
    databaseName,
  )) as Array<{ tableName: string; columnName: string }>;
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.tableName.toLowerCase();
    const columns = map.get(key);
    if (columns) {
      columns.push(row.columnName);
    } else {
      map.set(key, [row.columnName]);
    }
  }
  return map;
}

function pickTable(tableColumnsMap: Map<string, string[]>, candidates: string[]) {
  for (const candidate of candidates) {
    const columns = tableColumnsMap.get(candidate.toLowerCase());
    if (columns) {
      return { table: candidate.toLowerCase(), columns };
    }
  }
  return undefined;
}

function pickColumn(columns: string[], candidates: string[]) {
  const lowerToActual = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const candidate of candidates) {
    const found = lowerToActual.get(candidate.toLowerCase());
    if (found) {
      return found;
    }
  }
  return undefined;
}

async function runChainOrphanCheck(options: {
  client: PrismaClient;
  tableColumnsMap: Map<string, string[]>;
  chain: string;
  childTableCandidates: string[];
  childColumnCandidates: string[];
  parentTableCandidates: string[];
  parentColumnCandidates: string[];
}) {
  const child = pickTable(options.tableColumnsMap, options.childTableCandidates);
  const parent = pickTable(options.tableColumnsMap, options.parentTableCandidates);
  if (!child || !parent) {
    return undefined;
  }

  const childColumn = pickColumn(child.columns, options.childColumnCandidates);
  const parentColumn = pickColumn(parent.columns, options.parentColumnCandidates);
  if (!childColumn || !parentColumn) {
    return undefined;
  }

  const orphanRows = (await options.client.$queryRawUnsafe(
    `
      SELECT COUNT(*) AS c
      FROM ${quoteIdentifier(child.table)} AS c
      LEFT JOIN ${quoteIdentifier(parent.table)} AS p
        ON c.${quoteIdentifier(childColumn)} = p.${quoteIdentifier(parentColumn)}
      WHERE c.${quoteIdentifier(childColumn)} IS NOT NULL
        AND p.${quoteIdentifier(parentColumn)} IS NULL
    `,
  )) as Array<{ c: number | bigint | string }>;

  return {
    chain: options.chain,
    table: child.table,
    childColumn,
    parentTable: parent.table,
    parentColumn,
    orphanCount: toCount(orphanRows[0]?.c ?? 0),
    ok: toCount(orphanRows[0]?.c ?? 0) === 0,
  } satisfies ChainCheck;
}

async function collectUniqueViolations(client: PrismaClient, databaseName: string) {
  const uniqueIndexes = (await client.$queryRawUnsafe(
    `
      SELECT
        table_name AS tableName,
        index_name AS indexName,
        GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS indexColumns
      FROM information_schema.statistics
      WHERE table_schema = ?
        AND non_unique = 0
        AND index_name <> 'PRIMARY'
      GROUP BY table_name, index_name
      ORDER BY table_name, index_name
    `,
    databaseName,
  )) as Array<{ tableName: string; indexName: string; indexColumns: string }>;

  const violations: UniqueViolation[] = [];
  for (const index of uniqueIndexes) {
    const columns = (index.indexColumns ?? "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    if (columns.length === 0) {
      continue;
    }

    const whereNotNull = columns
      .map((column) => `t.${quoteIdentifier(column)} IS NOT NULL`)
      .join(" AND ");
    const groupBy = columns.map((column) => `t.${quoteIdentifier(column)}`).join(", ");
    const duplicateRows = (await client.$queryRawUnsafe(
      `
        SELECT COUNT(*) AS c
        FROM (
          SELECT ${groupBy}
          FROM ${quoteIdentifier(index.tableName)} AS t
          WHERE ${whereNotNull}
          GROUP BY ${groupBy}
          HAVING COUNT(*) > 1
        ) AS duplicate_groups
      `,
    )) as Array<{ c: number | bigint | string }>;
    const duplicateGroupCount = toCount(duplicateRows[0]?.c ?? 0);
    if (duplicateGroupCount > 0) {
      violations.push({
        table: index.tableName,
        indexName: index.indexName,
        columns,
        duplicateGroupCount,
      });
    }
  }

  return violations;
}

async function reconcileCommand() {
  const sourceDatabaseUrl = resolveSourceDatabaseUrl();
  const targetDatabaseUrl = resolveTargetDatabaseUrl();
  const targetDatabaseName = getDatabaseNameFromUrl(targetDatabaseUrl);
  if (!targetDatabaseName) {
    throw new Error(`Failed to parse target database name: ${targetDatabaseUrl}`);
  }

  const manifest = readManifest();
  const targetClient = createMysqlClient(targetDatabaseUrl);
  mkdirSync(reportDir, { recursive: true });

  try {
    const entries: CountEntry[] = [];
    let mismatchCount = 0;

    for (const table of manifest.tables) {
      let targetCount = -1;
      try {
        const targetCountRows = (await targetClient.$queryRawUnsafe(
          `SELECT COUNT(*) AS c FROM ${quoteIdentifier(table.name)}`,
        )) as Array<{ c: number | bigint | string }>;
        targetCount = toCount(targetCountRows[0]?.c ?? 0);
      } catch {
        targetCount = -1;
      }

      const ok = table.sourceRowCount === targetCount;
      if (!ok) {
        mismatchCount += 1;
      }
      entries.push({
        table: table.name,
        sourceCount: table.sourceRowCount,
        targetCount,
        ok,
      });
    }

    const tableColumnsMap = await loadTableColumnsMap(targetClient, targetDatabaseName);
    const chainChecksRaw = await Promise.all([
      runChainOrphanCheck({
        client: targetClient,
        tableColumnsMap,
        chain: "workspace/membership/billing",
        childTableCandidates: ["membership"],
        childColumnCandidates: ["workspace_id", "workspaceId"],
        parentTableCandidates: ["workspace"],
        parentColumnCandidates: ["legacy_id", "id"],
      }),
      runChainOrphanCheck({
        client: targetClient,
        tableColumnsMap,
        chain: "workspace/membership/billing",
        childTableCandidates: ["billingaccount", "billing_account"],
        childColumnCandidates: ["workspace_id", "workspaceId"],
        parentTableCandidates: ["workspace"],
        parentColumnCandidates: ["legacy_id", "id"],
      }),
      runChainOrphanCheck({
        client: targetClient,
        tableColumnsMap,
        chain: "meeting/action/approval",
        childTableCandidates: ["actionitem", "action_item"],
        childColumnCandidates: ["meeting_id", "meetingId"],
        parentTableCandidates: ["meeting"],
        parentColumnCandidates: ["legacy_id", "id"],
      }),
      runChainOrphanCheck({
        client: targetClient,
        tableColumnsMap,
        chain: "meeting/action/approval",
        childTableCandidates: ["approvaltask", "approval_task"],
        childColumnCandidates: ["action_item_id", "actionItemId"],
        parentTableCandidates: ["actionitem", "action_item"],
        parentColumnCandidates: ["legacy_id", "id"],
      }),
      runChainOrphanCheck({
        client: targetClient,
        tableColumnsMap,
        chain: "memory/recommendation",
        childTableCandidates: ["recommendationfeedback", "recommendation_feedback"],
        childColumnCandidates: ["recommendation_log_id", "recommendationLogId"],
        parentTableCandidates: ["recommendationlog", "recommendation_log"],
        parentColumnCandidates: ["legacy_id", "id"],
      }),
    ]);
    const chainChecks = chainChecksRaw.filter(Boolean) as ChainCheck[];
    const orphanMismatchCount = chainChecks.filter((entry) => !entry.ok).length;

    const uniqueViolations = await collectUniqueViolations(targetClient, targetDatabaseName);

    const report = {
      generatedAt: new Date().toISOString(),
      sourceDatabaseUrl,
      targetDatabaseUrl,
      targetDatabaseName,
      tableCount: entries.length,
      mismatchCount,
      orphanMismatchCount,
      uniqueViolationCount: uniqueViolations.length,
      entries,
      chainChecks,
      uniqueViolations,
      ok: mismatchCount === 0 && orphanMismatchCount === 0 && uniqueViolations.length === 0,
    };
    writeFileSync(reconcileJsonPath, JSON.stringify(report, null, 2), "utf8");

    const markdown = [
      "# MySQL Phase2 Mandatory Reconcile Report",
      "",
      `- generatedAt: ${report.generatedAt}`,
      `- sourceDatabaseUrl: ${sourceDatabaseUrl}`,
      `- targetDatabaseUrl: ${targetDatabaseUrl}`,
      `- tableCount: ${report.tableCount}`,
      `- mismatchCount: ${report.mismatchCount}`,
      `- orphanMismatchCount: ${report.orphanMismatchCount}`,
      `- uniqueViolationCount: ${report.uniqueViolationCount}`,
      "",
      "## 表级行数对账",
      "",
      "| table | sourceCount | targetCount | status |",
      "| --- | ---: | ---: | --- |",
      ...entries.map((entry) =>
        `| ${entry.table} | ${entry.sourceCount} | ${entry.targetCount} | ${entry.ok ? "OK" : "MISMATCH"} |`,
      ),
      "",
      "## 关键链路孤儿关系检查",
      "",
      chainChecks.length === 0
        ? "- 无可执行链路检查（缺少对应表或列）"
        : "| chain | table | childColumn | parentTable | parentColumn | orphanCount | status |\n| --- | --- | --- | --- | --- | ---: | --- |\n" +
          chainChecks
            .map(
              (entry) =>
                `| ${entry.chain} | ${entry.table} | ${entry.childColumn} | ${entry.parentTable} | ${entry.parentColumn} | ${entry.orphanCount} | ${entry.ok ? "OK" : "MISMATCH"} |`,
            )
            .join("\n"),
      "",
      "## 唯一性冲突扫描",
      "",
      uniqueViolations.length === 0
        ? "- 未发现唯一索引冲突"
        : "| table | indexName | columns | duplicateGroupCount |\n| --- | --- | --- | ---: |\n" +
          uniqueViolations
            .map(
              (entry) =>
                `| ${entry.table} | ${entry.indexName} | ${entry.columns.join(", ")} | ${entry.duplicateGroupCount} |`,
            )
            .join("\n"),
      "",
      "## 结论",
      report.ok
        ? "对账通过：表级行数、关键链路孤儿关系、唯一性冲突检查均通过。"
        : "对账未通过：请根据 mismatch / orphan / unique violation 明细修复后重试。",
    ].join("\n");

    writeFileSync(reconcileMarkdownPath, markdown, "utf8");
    console.log(`phase2 reconcile report generated: ${reconcileMarkdownPath}`);
  } finally {
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
        "Usage: tsx scripts/mysql-phase2-mandatory.ts <export|import|reconcile>",
      );
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
