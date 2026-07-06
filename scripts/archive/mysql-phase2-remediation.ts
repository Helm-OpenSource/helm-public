import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_MYSQL_DATABASE_URL, getDatabaseNameFromUrl, isMysqlDatabaseUrl } from "@/lib/db-url";
import { readEnvVarFromRootFiles } from "@/lib/root-env";
import { describeColumnComment, describeTableComment } from "./mysql-chinese-comment-utils";

type Mode = "build-schema" | "migrate-data" | "apply-comments" | "cutover";

type SourceColumn = {
  tableName: string;
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  columnType: string;
  isNullable: string;
  columnDefault: unknown;
  extra: string;
  columnComment: string | null;
};

type SourceIndexColumn = {
  indexName: string;
  nonUnique: number;
  seqInIndex: number;
  columnName: string;
  subPart: number | null;
};

type TableManifest = {
  sourceTable: string;
  normalizedTable: string;
  stagingTable: string;
  tableComment: string;
  oldColumns: string[];
  oldToNewColumn: Record<string, string>;
  newColumns: Array<{
    name: string;
    sqlType: string;
    nullable: boolean;
    defaultSql: string | null;
    extraSql: string | null;
    comment: string;
    sourceColumn?: string;
  }>;
  indexSql: string[];
  viewSql: string;
  insertSql: string;
  applyCommentSql: string[];
};

type Manifest = {
  generatedAt: string;
  databaseName: string;
  tables: TableManifest[];
};

const NAME_MAX_LENGTH = 32;
const INDEX_MAX_LENGTH = 64;
const COMPATIBILITY_LEGACY_ID_LENGTH = 191;
const ALLOWED_DATABASES = new Set(["helm2026_ci_verify", "helm2026"]);

const RESERVED_WORDS = new Set(
  [
    "add",
    "all",
    "alter",
    "and",
    "as",
    "before",
    "between",
    "bigint",
    "binary",
    "blob",
    "by",
    "call",
    "change",
    "char",
    "check",
    "column",
    "constraint",
    "create",
    "cross",
    "database",
    "databases",
    "dec",
    "decimal",
    "default",
    "delete",
    "desc",
    "describe",
    "distinct",
    "double",
    "drop",
    "else",
    "exists",
    "false",
    "float",
    "for",
    "foreign",
    "from",
    "group",
    "having",
    "if",
    "in",
    "index",
    "inner",
    "insert",
    "int",
    "integer",
    "interval",
    "into",
    "is",
    "join",
    "key",
    "keys",
    "left",
    "like",
    "limit",
    "match",
    "not",
    "null",
    "on",
    "or",
    "order",
    "outer",
    "primary",
    "range",
    "references",
    "right",
    "select",
    "set",
    "table",
    "then",
    "true",
    "union",
    "unique",
    "update",
    "use",
    "values",
    "where",
  ].map((word) => word.toLowerCase()),
);

const mode = process.argv[2] as Mode | undefined;
const projectRoot = process.cwd();
const outputRoot =
  process.env.PHASE2_MIGRATION_DIR ??
  path.resolve(projectRoot, ".tmp/mysql-phase2-remediation/latest");
const sqlRoot = path.resolve(projectRoot, "sql/phase2");
const ddlDir = path.join(sqlRoot, "ddl");
const dmlDir = path.join(sqlRoot, "dml");
const manifestPath = path.join(outputRoot, "manifest.json");
const ddlBuildPath = path.join(ddlDir, "01_build_schema.sql");
const dmlMigratePath = path.join(dmlDir, "01_migrate_data.sql");
const ddlCommentPath = path.join(ddlDir, "02_apply_comments.sql");
const ddlCutoverPath = path.join(ddlDir, "03_cutover.sql");

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function quoteString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function snakeCase(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();

  if (!normalized) {
    return "x";
  }
  return normalized;
}

function truncateIdentifier(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return value.slice(0, max);
}

function normalizeNumericBridge(value: string) {
  return value.replace(/_(\d+)_/g, "_n$1_").replace(/_(\d+)$/g, "_n$1");
}

function normalizeIdentifier(raw: string, typePrefix: "t" | "c" | "i", maxLength: number) {
  let normalized = normalizeNumericBridge(snakeCase(raw));

  if (!/^[a-z]/.test(normalized)) {
    normalized = `${typePrefix}_${normalized}`;
  }
  normalized = normalized.replace(/_+/g, "_").replace(/^_+/, "").replace(/_+$/, "");
  if (!normalized) {
    normalized = `${typePrefix}_x`;
  }

  normalized = truncateIdentifier(normalized, maxLength).replace(/_+$/, "");
  if (!normalized) {
    normalized = `${typePrefix}_x`;
  }
  if (!/^[a-z]/.test(normalized)) {
    normalized = `${typePrefix}_${normalized}`;
    normalized = truncateIdentifier(normalized, maxLength).replace(/_+$/, "");
  }
  if (RESERVED_WORDS.has(normalized)) {
    normalized = `${typePrefix}_${normalized}`;
    normalized = truncateIdentifier(normalized, maxLength).replace(/_+$/, "");
  }
  if (!normalized) {
    normalized = `${typePrefix}_x`;
  }

  return normalized;
}

function makeUniqueIdentifier(
  base: string,
  used: Set<string>,
  maxLength: number,
  typePrefix: "t" | "c" | "i",
) {
  let counter = 0;
  while (true) {
    const suffix = counter === 0 ? "" : `_x${counter}`;
    const stemMax = Math.max(1, maxLength - suffix.length);
    const stem = truncateIdentifier(base, stemMax).replace(/_+$/, "") || `${typePrefix}`;
    const candidate = `${stem}${suffix}`;
    if (!used.has(candidate) && !RESERVED_WORDS.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}

function getVarcharLength(sqlType: string) {
  const match = sqlType.toLowerCase().match(/^(?:var)?char\((\d+)\)/);
  if (!match) {
    return null;
  }
  const length = Number(match[1]);
  return Number.isFinite(length) ? length : null;
}

function resolveStringIndexPrefix(sqlType: string, sourceSubPart: number | null) {
  const lower = sqlType.trim().toLowerCase();
  const isText = /^(tinytext|text|mediumtext|longtext)\b/.test(lower);
  const varcharLength = getVarcharLength(sqlType);

  if (!isText && varcharLength === null) {
    return null;
  }
  if (sourceSubPart && sourceSubPart > 0) {
    if (varcharLength) {
      return Math.min(sourceSubPart, varcharLength);
    }
    return sourceSubPart;
  }
  if (varcharLength) {
    return Math.min(varcharLength, COMPATIBILITY_LEGACY_ID_LENGTH);
  }
  return COMPATIBILITY_LEGACY_ID_LENGTH;
}

function readPrismaModelTableHints() {
  const schemaPath = path.join(projectRoot, "prisma/schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");
  const lines = schema.split(/\r?\n/);
  const map = new Map<string, string>();
  for (const line of lines) {
    const match = line.match(/^model\s+([A-Za-z0-9_]+)\s+\{/);
    if (!match) {
      continue;
    }
    const modelName = match[1];
    map.set(modelName.toLowerCase(), normalizeIdentifier(modelName, "t", NAME_MAX_LENGTH));
  }
  return map;
}

function resolveDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    readEnvVarFromRootFiles("DATABASE_URL", {
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    DEFAULT_MYSQL_DATABASE_URL;
  if (!isMysqlDatabaseUrl(databaseUrl)) {
    throw new Error(`DATABASE_URL must be mysql://..., received: ${databaseUrl}`);
  }
  return databaseUrl;
}

function normalizeCommentCandidate(candidate: string | null | undefined) {
  const trimmed = (candidate ?? "").trim();
  if (!trimmed) {
    return null;
  }
  if (/^[A-Za-z0-9_]+:[A-Za-z0-9_]+$/.test(trimmed)) {
    return null;
  }
  if (/^table:/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeSqlType(column: SourceColumn) {
  const lowerDataType = column.dataType.toLowerCase();
  if (lowerDataType === "float" || lowerDataType === "double") {
    return "DECIMAL(20,6)";
  }
  return column.columnType.toUpperCase();
}

function normalizeExtraSql(extra: string) {
  const lower = extra.toLowerCase();
  const chunks: string[] = [];
  if (lower.includes("auto_increment")) {
    chunks.push("AUTO_INCREMENT");
  }
  if (lower.includes("on update current_timestamp")) {
    chunks.push("ON UPDATE CURRENT_TIMESTAMP");
  }
  return chunks.length > 0 ? chunks.join(" ") : null;
}

function formatDefaultSql(column: SourceColumn) {
  if (column.columnDefault === null || column.columnDefault === undefined) {
    return null;
  }
  const raw = String(column.columnDefault);
  const dataType = column.dataType.toLowerCase();
  if (raw.toUpperCase().includes("CURRENT_TIMESTAMP")) {
    return raw.toUpperCase();
  }
  if (
    [
      "tinyint",
      "smallint",
      "mediumint",
      "int",
      "integer",
      "bigint",
      "decimal",
      "float",
      "double",
      "bit",
    ].includes(dataType)
  ) {
    return raw;
  }
  return quoteString(raw);
}

function splitStatements(sql: string) {
  return sql
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => (statement.endsWith(";") ? statement : `${statement};`));
}

function firstMeaningfulSqlLine(content: string) {
  const lines = content.split(/\r?\n/);
  let inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (inBlockComment) {
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }
    if (trimmed.startsWith("--")) {
      continue;
    }
    return trimmed;
  }
  return "";
}

function containsDdlStatements(content: string) {
  return /\b(create|alter|drop|rename|truncate)\b/i.test(content);
}

function containsDmlStatements(content: string) {
  return /\b(insert\s+into|update\s+[`"A-Za-z0-9_]+\s+set|delete\s+from|replace\s+into)\b/i.test(
    content,
  );
}

function assertSqlGuardrails(content: string, expected: "ddl" | "dml", databaseName: string) {
  const firstLine = firstMeaningfulSqlLine(content);
  const useMatch = firstLine.match(/^use\s+[`"]?([A-Za-z0-9_]+)[`"]?;?$/i);
  if (!useMatch) {
    throw new Error("SQL script guard failed: first effective statement must be USE <db>");
  }
  if (useMatch[1] !== databaseName) {
    throw new Error(
      `SQL script guard failed: USE target mismatch, expected ${databaseName}, received ${useMatch[1]}`,
    );
  }
  if (/\b(after|before)\b/i.test(content)) {
    throw new Error("SQL script guard failed: AFTER/BEFORE column position directives are forbidden");
  }

  const hasDdl = containsDdlStatements(content);
  const hasDml = containsDmlStatements(content);
  if (expected === "ddl" && hasDml) {
    throw new Error("SQL script guard failed: DDL file contains DML statements");
  }
  if (expected === "dml" && hasDdl) {
    throw new Error("SQL script guard failed: DML file contains DDL statements");
  }
}

function createClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

async function buildManifest(databaseName: string, client: PrismaClient) {
  const tableHintMap = readPrismaModelTableHints();

  const tables = (await client.$queryRawUnsafe(
    `
      SELECT table_name AS tableName, table_comment AS tableComment
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
        AND table_name NOT LIKE '%\\_\\_new' ESCAPE '\\\\'
      ORDER BY table_name
    `,
    databaseName,
  )) as Array<{ tableName: string; tableComment: string | null }>;

  const columns = (await client.$queryRawUnsafe(
    `
      SELECT
        table_name AS tableName,
        column_name AS columnName,
        ordinal_position AS ordinalPosition,
        data_type AS dataType,
        column_type AS columnType,
        is_nullable AS isNullable,
        column_default AS columnDefault,
        extra AS extra,
        column_comment AS columnComment
      FROM information_schema.columns
      WHERE table_schema = ?
      ORDER BY table_name, ordinal_position
    `,
    databaseName,
  )) as SourceColumn[];

  const indexes = (await client.$queryRawUnsafe(
    `
      SELECT
        table_name AS tableName,
        index_name AS indexName,
        non_unique AS nonUnique,
        seq_in_index AS seqInIndex,
        column_name AS columnName,
        sub_part AS subPart
      FROM information_schema.statistics
      WHERE table_schema = ?
      ORDER BY table_name, index_name, seq_in_index
    `,
    databaseName,
  )) as Array<SourceIndexColumn & { tableName: string }>;

  const tableToColumns = new Map<string, SourceColumn[]>();
  const tableToIndexes = new Map<string, Array<SourceIndexColumn>>();
  for (const column of columns) {
    const existing = tableToColumns.get(column.tableName);
    if (existing) {
      existing.push(column);
    } else {
      tableToColumns.set(column.tableName, [column]);
    }
  }
  for (const index of indexes) {
    const existing = tableToIndexes.get(index.tableName);
    const payload: SourceIndexColumn = {
      indexName: index.indexName,
      nonUnique: Number(index.nonUnique),
      seqInIndex: Number(index.seqInIndex),
      columnName: index.columnName,
      subPart: index.subPart === null ? null : Number(index.subPart),
    };
    if (existing) {
      existing.push(payload);
    } else {
      tableToIndexes.set(index.tableName, [payload]);
    }
  }

  const usedNormalizedTableNames = new Set<string>();
  const tablesManifest: TableManifest[] = [];

  for (const table of tables) {
    const sourceTable = table.tableName;
    const sourceColumns = tableToColumns.get(sourceTable) ?? [];
    const oldColumns = sourceColumns.map((column) => column.columnName);
    const hinted = tableHintMap.get(sourceTable.toLowerCase());

    const normalizedBase = normalizeIdentifier(hinted ?? sourceTable, "t", NAME_MAX_LENGTH);
    let normalizedTable = makeUniqueIdentifier(
      normalizedBase,
      usedNormalizedTableNames,
      NAME_MAX_LENGTH,
      "t",
    );
    if (normalizedTable === sourceTable) {
      normalizedTable = makeUniqueIdentifier(
        normalizeIdentifier(`n_${sourceTable}`, "t", NAME_MAX_LENGTH),
        usedNormalizedTableNames,
        NAME_MAX_LENGTH,
        "t",
      );
    }

    const stagingTable = truncateIdentifier(`${normalizedTable}__new`, INDEX_MAX_LENGTH);
    const oldToNewColumn: Record<string, string> = {};
    const newColumns: TableManifest["newColumns"] = [];
    const usedColumnNames = new Set<string>();

    newColumns.push({
      name: "id",
      sqlType: "BIGINT UNSIGNED",
      nullable: false,
      defaultSql: null,
      extraSql: "AUTO_INCREMENT",
      comment: "主键ID",
    });
    newColumns.push({
      name: "legacy_id",
      sqlType: `VARCHAR(${COMPATIBILITY_LEGACY_ID_LENGTH})`,
      nullable: false,
      defaultSql: "(UUID())",
      extraSql: null,
      comment: "兼容字符串ID",
      sourceColumn: oldColumns.includes("id") ? "id" : oldColumns.includes("legacy_id") ? "legacy_id" : undefined,
    });
    usedColumnNames.add("id");
    usedColumnNames.add("legacy_id");

    let createTimeSource: string | undefined;
    let modifyTimeSource: string | undefined;

    for (const column of sourceColumns) {
      const sourceColumn = column.columnName;
      if (sourceColumn === "id") {
        oldToNewColumn[sourceColumn] = "legacy_id";
        continue;
      }
      if (sourceColumn === "legacy_id") {
        oldToNewColumn[sourceColumn] = "legacy_id";
        continue;
      }
      if (sourceColumn === "createdAt" || sourceColumn === "create_time") {
        oldToNewColumn[sourceColumn] = "create_time";
        if (!createTimeSource || sourceColumn === "create_time") {
          createTimeSource = sourceColumn;
        }
        continue;
      }
      if (sourceColumn === "updatedAt" || sourceColumn === "modify_time") {
        oldToNewColumn[sourceColumn] = "modify_time";
        if (!modifyTimeSource || sourceColumn === "modify_time") {
          modifyTimeSource = sourceColumn;
        }
        continue;
      }

      let normalizedColumnBase = normalizeIdentifier(sourceColumn, "c", NAME_MAX_LENGTH);
      if (["id", "legacy_id", "create_time", "modify_time"].includes(normalizedColumnBase)) {
        normalizedColumnBase = normalizeIdentifier(`${normalizedColumnBase}_field`, "c", NAME_MAX_LENGTH);
      }

      const normalizedColumn = makeUniqueIdentifier(
        normalizedColumnBase,
        usedColumnNames,
        NAME_MAX_LENGTH,
        "c",
      );
      oldToNewColumn[sourceColumn] = normalizedColumn;

      newColumns.push({
        name: normalizedColumn,
        sqlType: normalizeSqlType(column),
        nullable: column.isNullable === "YES",
        defaultSql: formatDefaultSql(column),
        extraSql: normalizeExtraSql(column.extra),
        comment:
          normalizeCommentCandidate(column.columnComment) ??
          describeColumnComment(normalizedTable, normalizedColumn),
        sourceColumn,
      });
    }

    newColumns.push({
      name: "create_time",
      sqlType: "DATETIME",
      nullable: false,
      defaultSql: "CURRENT_TIMESTAMP",
      extraSql: null,
      comment: "创建时间",
      sourceColumn: createTimeSource,
    });
    usedColumnNames.add("create_time");

    newColumns.push({
      name: "modify_time",
      sqlType: "DATETIME",
      nullable: false,
      defaultSql: "CURRENT_TIMESTAMP",
      extraSql: "ON UPDATE CURRENT_TIMESTAMP",
      comment: "修改时间",
      sourceColumn: modifyTimeSource,
    });
    usedColumnNames.add("modify_time");

    const newColumnTypeByName = new Map(
      newColumns.map((column) => [column.name, column.sqlType.toLowerCase()]),
    );

    const groupedIndexes = new Map<
      string,
      { nonUnique: number; columns: Array<{ sourceColumn: string; subPart: number | null }> }
    >();

    for (const sourceIndex of tableToIndexes.get(sourceTable) ?? []) {
      if (sourceIndex.indexName === "PRIMARY") {
        continue;
      }
      const existing = groupedIndexes.get(sourceIndex.indexName);
      if (existing) {
        existing.columns.push({
          sourceColumn: sourceIndex.columnName,
          subPart: sourceIndex.subPart,
        });
      } else {
        groupedIndexes.set(sourceIndex.indexName, {
          nonUnique: sourceIndex.nonUnique,
          columns: [
            {
              sourceColumn: sourceIndex.columnName,
              subPart: sourceIndex.subPart,
            },
          ],
        });
      }
    }

    const usedIndexNames = new Set<string>();
    const indexSql: string[] = [];
    const makeIndexName = (prefix: "uk" | "idx", columnsForName: string[]) => {
      const normalizedBaseName = normalizeIdentifier(
        `${prefix}_${columnsForName.join("_")}`,
        "i",
        INDEX_MAX_LENGTH,
      );
      const candidate = makeUniqueIdentifier(normalizedBaseName, usedIndexNames, INDEX_MAX_LENGTH, "i");
      return candidate.startsWith(`${prefix}_`) ? candidate : `${prefix}_${candidate}`;
    };

    usedIndexNames.add("uk_legacy_id");
    indexSql.push(
      `UNIQUE INDEX ${quoteIdentifier("uk_legacy_id")}(${quoteIdentifier("legacy_id")}(${COMPATIBILITY_LEGACY_ID_LENGTH}))`,
    );

    for (const [, sourceIndex] of groupedIndexes) {
      const mapped = sourceIndex.columns
        .map((item) => ({
          columnName: oldToNewColumn[item.sourceColumn],
          subPart: item.subPart,
        }))
        .filter((item) => Boolean(item.columnName)) as Array<{
        columnName: string;
        subPart: number | null;
      }>;
      if (mapped.length === 0) {
        continue;
      }
      if (mapped.length === 1 && mapped[0].columnName === "legacy_id" && sourceIndex.nonUnique === 0) {
        continue;
      }

      const prefix = sourceIndex.nonUnique === 0 ? "uk" : "idx";
      const indexName = makeIndexName(
        prefix,
        mapped.map((item) => item.columnName),
      );

      const columnsSql = mapped
        .map((item) => {
          const type = newColumnTypeByName.get(item.columnName) ?? "";
          const prefixLength = resolveStringIndexPrefix(type, item.subPart);
          return `${quoteIdentifier(item.columnName)}${prefixLength ? `(${prefixLength})` : ""}`;
        })
        .join(", ");

      indexSql.push(
        `${sourceIndex.nonUnique === 0 ? "UNIQUE " : ""}INDEX ${quoteIdentifier(indexName)}(${columnsSql})`,
      );
    }

    const tableComment =
      normalizeCommentCandidate(table.tableComment) ?? describeTableComment(normalizedTable);

    const sourceColumnSet = new Set(oldColumns);
    const selectExpressions = newColumns
      .filter((column) => column.name !== "id")
      .map((column) => {
        if (column.name === "legacy_id") {
          if (sourceColumnSet.has("legacy_id")) {
            return `CAST(${quoteIdentifier("legacy_id")} AS CHAR(${COMPATIBILITY_LEGACY_ID_LENGTH}))`;
          }
          if (sourceColumnSet.has("id")) {
            return `CAST(${quoteIdentifier("id")} AS CHAR(${COMPATIBILITY_LEGACY_ID_LENGTH}))`;
          }
          return "UUID()";
        }
        if (column.name === "create_time") {
          if (createTimeSource) {
            return quoteIdentifier(createTimeSource);
          }
          return "CURRENT_TIMESTAMP";
        }
        if (column.name === "modify_time") {
          if (modifyTimeSource) {
            return quoteIdentifier(modifyTimeSource);
          }
          return "CURRENT_TIMESTAMP";
        }
        if (column.sourceColumn) {
          if (column.sqlType.toLowerCase().startsWith("decimal(")) {
            return `CAST(${quoteIdentifier(column.sourceColumn)} AS ${column.sqlType})`;
          }
          return quoteIdentifier(column.sourceColumn);
        }
        return "NULL";
      });

    const insertSql = `INSERT INTO ${quoteIdentifier(stagingTable)} (${newColumns
      .filter((column) => column.name !== "id")
      .map((column) => quoteIdentifier(column.name))
      .join(", ")}) SELECT ${selectExpressions.join(", ")} FROM ${quoteIdentifier(sourceTable)};`;

    const viewSql = `CREATE OR REPLACE VIEW ${quoteIdentifier(sourceTable)} AS SELECT ${oldColumns
      .map((oldColumn) => {
        const mapped = oldToNewColumn[oldColumn];
        if (!mapped) {
          return `NULL AS ${quoteIdentifier(oldColumn)}`;
        }
        return `${quoteIdentifier(mapped)} AS ${quoteIdentifier(oldColumn)}`;
      })
      .join(", ")} FROM ${quoteIdentifier(normalizedTable)};`;

    const applyCommentSql = [
      `ALTER TABLE ${quoteIdentifier(stagingTable)} COMMENT = ${quoteString(tableComment)};`,
      ...newColumns.map(
        (column) =>
          `ALTER TABLE ${quoteIdentifier(stagingTable)} MODIFY COLUMN ${quoteIdentifier(column.name)} ${column.sqlType} ${
            column.nullable ? "NULL" : "NOT NULL"
          }${column.defaultSql === null ? "" : ` DEFAULT ${column.defaultSql}`}${
            column.extraSql ? ` ${column.extraSql}` : ""
          } COMMENT ${quoteString(column.comment)};`,
      ),
    ];

    tablesManifest.push({
      sourceTable,
      normalizedTable,
      stagingTable,
      tableComment,
      oldColumns,
      oldToNewColumn,
      newColumns,
      indexSql,
      viewSql,
      insertSql,
      applyCommentSql,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    databaseName,
    tables: tablesManifest,
  } satisfies Manifest;
}

function generateSqlFiles(manifest: Manifest) {
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(dmlDir, { recursive: true });

  const ddlBuildStatements: string[] = [
    `USE ${quoteIdentifier(manifest.databaseName)};`,
    "SET FOREIGN_KEY_CHECKS = 0;",
  ];
  for (const table of manifest.tables) {
    ddlBuildStatements.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table.stagingTable)};`);
    ddlBuildStatements.push(
      `CREATE TABLE ${quoteIdentifier(table.stagingTable)} (\n${table.newColumns
        .map((column) => {
          const nullableSql = column.nullable ? "NULL" : "NOT NULL";
          const defaultSql =
            column.defaultSql === null ? "" : ` DEFAULT ${column.defaultSql}`;
          const extraSql = column.extraSql ? ` ${column.extraSql}` : "";
          return `  ${quoteIdentifier(column.name)} ${column.sqlType} ${nullableSql}${defaultSql}${extraSql} COMMENT ${quoteString(column.comment)}`;
        })
        .join(",\n")},\n  PRIMARY KEY (${quoteIdentifier("id")}),\n  ${table.indexSql.join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=${quoteString(table.tableComment)};`,
    );
  }
  ddlBuildStatements.push("SET FOREIGN_KEY_CHECKS = 1;");

  const dmlStatements: string[] = [
    `USE ${quoteIdentifier(manifest.databaseName)};`,
    "SET FOREIGN_KEY_CHECKS = 0;",
  ];
  for (const table of manifest.tables) {
    dmlStatements.push(table.insertSql);
  }
  dmlStatements.push("SET FOREIGN_KEY_CHECKS = 1;");

  const commentStatements: string[] = [
    `USE ${quoteIdentifier(manifest.databaseName)};`,
    "SET FOREIGN_KEY_CHECKS = 0;",
  ];
  for (const table of manifest.tables) {
    commentStatements.push(...table.applyCommentSql);
  }
  commentStatements.push("SET FOREIGN_KEY_CHECKS = 1;");

  const cutoverStatements: string[] = [
    `USE ${quoteIdentifier(manifest.databaseName)};`,
    "SET FOREIGN_KEY_CHECKS = 0;",
  ];
  for (const table of manifest.tables) {
    cutoverStatements.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table.normalizedTable)};`);
    cutoverStatements.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table.sourceTable)};`);
    cutoverStatements.push(
      `RENAME TABLE ${quoteIdentifier(table.stagingTable)} TO ${quoteIdentifier(table.normalizedTable)};`,
    );
    cutoverStatements.push(table.viewSql);
  }
  cutoverStatements.push("SET FOREIGN_KEY_CHECKS = 1;");

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(ddlBuildPath, `${ddlBuildStatements.join("\n")}\n`, "utf8");
  writeFileSync(dmlMigratePath, `${dmlStatements.join("\n")}\n`, "utf8");
  writeFileSync(ddlCommentPath, `${commentStatements.join("\n")}\n`, "utf8");
  writeFileSync(ddlCutoverPath, `${cutoverStatements.join("\n")}\n`, "utf8");
}

async function executeSqlFile(
  client: PrismaClient,
  filePath: string,
  expected: "ddl" | "dml",
  databaseName: string,
) {
  const content = readFileSync(filePath, "utf8");
  assertSqlGuardrails(content, expected, databaseName);
  const statements = splitStatements(content);
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    if (/^use\s+/i.test(statement.trim())) {
      continue;
    }
    try {
      await client.$executeRawUnsafe(statement);
    } catch (error) {
      console.error(`SQL execute failed in ${filePath} at statement #${index + 1}`);
      console.error(statement.slice(0, 600));
      throw error;
    }
  }
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

async function run() {
  if (!mode || !["build-schema", "migrate-data", "apply-comments", "cutover"].includes(mode)) {
    throw new Error(
      "Usage: tsx scripts/mysql-phase2-remediation.ts <build-schema|migrate-data|apply-comments|cutover>",
    );
  }
  const databaseUrl = resolveDatabaseUrl();
  const databaseName = getDatabaseNameFromUrl(databaseUrl);
  if (!databaseName) {
    throw new Error(`DATABASE_URL is missing database name: ${databaseUrl}`);
  }
  if (!ALLOWED_DATABASES.has(databaseName)) {
    throw new Error(
      `phase2 remediation only allows ${Array.from(ALLOWED_DATABASES).join(", ")}, received: ${databaseName}`,
    );
  }

  if (mode === "build-schema") {
    const client = createClient(databaseUrl);
    try {
      const manifest = await buildManifest(databaseName, client);
      generateSqlFiles(manifest);
      console.log(`phase2 manifest generated: ${manifestPath}`);
      console.log(`DDL: ${ddlBuildPath}`);
      console.log(`DML: ${dmlMigratePath}`);
      console.log(`COMMENTS: ${ddlCommentPath}`);
      console.log(`CUTOVER: ${ddlCutoverPath}`);
      return;
    } finally {
      await client.$disconnect();
    }
  }

  const manifest = readManifest();
  if (manifest.databaseName !== databaseName) {
    throw new Error(
      `manifest database mismatch: manifest=${manifest.databaseName}, current=${databaseName}`,
    );
  }

  const client = createClient(databaseUrl);
  try {
    if (mode === "migrate-data") {
      await executeSqlFile(client, ddlBuildPath, "ddl", databaseName);
      await executeSqlFile(client, dmlMigratePath, "dml", databaseName);
      console.log("phase2 migrate-data completed");
      return;
    }
    if (mode === "apply-comments") {
      await executeSqlFile(client, ddlCommentPath, "ddl", databaseName);
      console.log("phase2 apply-comments completed");
      return;
    }
    if (mode === "cutover") {
      await executeSqlFile(client, ddlCutoverPath, "ddl", databaseName);
      console.log("phase2 cutover completed");
    }
  } finally {
    await client.$disconnect();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
