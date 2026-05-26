import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_MYSQL_DATABASE_URL, getDatabaseNameFromUrl, isMysqlDatabaseUrl } from "@/lib/db-url";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

type RuleResult = {
  rule: string;
  pass: boolean;
  summary: string;
  failureCount: number;
  failures: Array<Record<string, unknown>>;
};

type SqlScriptCheckFailure = {
  file: string;
  issue: string;
};

const projectRoot = process.cwd();
const outputRoot =
  process.env.PHASE2_MIGRATION_DIR ??
  path.resolve(projectRoot, ".tmp/mysql-phase2-mandatory/latest");
const reportDir = path.join(outputRoot, "reports");
const jsonPath = path.join(reportDir, "spec-mandatory-check.json");
const markdownPath = path.join(reportDir, "spec-mandatory-check.md");
const sqlPhase2Root = path.join(projectRoot, "sql", "phase2");
const sqlDdlRoot = path.join(sqlPhase2Root, "ddl");
const sqlDmlRoot = path.join(sqlPhase2Root, "dml");
const ALLOWED_SCRIPT_DATABASES = new Set(["helm2026_ci_verify", "helm2026"]);

const RESERVED_WORDS = new Set(
  [
    "add",
    "all",
    "alter",
    "analyze",
    "and",
    "as",
    "asc",
    "before",
    "between",
    "bigint",
    "binary",
    "blob",
    "by",
    "call",
    "cascade",
    "change",
    "char",
    "check",
    "column",
    "constraint",
    "create",
    "cross",
    "current_date",
    "current_time",
    "current_timestamp",
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

function createClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

function shortList(failures: Array<Record<string, unknown>>, limit = 100) {
  return failures.slice(0, limit);
}

function scanSqlFiles(root: string) {
  const files: string[] = [];
  function walk(currentPath: string) {
    const stat = statSync(currentPath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(currentPath)) {
        walk(path.join(currentPath, entry));
      }
      return;
    }
    if (currentPath.endsWith(".sql")) {
      files.push(currentPath);
    }
  }
  walk(root);
  return files.sort();
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

function checkSqlScriptRules() {
  const failures: SqlScriptCheckFailure[] = [];
  if (!existsSync(sqlPhase2Root)) {
    failures.push({
      file: path.relative(projectRoot, sqlPhase2Root),
      issue: "缺少 sql/phase2 目录（强制项脚本目录未落地）",
    });
    return failures;
  }

  const files = scanSqlFiles(sqlPhase2Root);
  if (files.length === 0) {
    failures.push({
      file: path.relative(projectRoot, sqlPhase2Root),
      issue: "sql/phase2 目录下未发现任何 .sql 脚本",
    });
    return failures;
  }

  for (const filePath of files) {
    const relativePath = path.relative(projectRoot, filePath);
    const content = readFileSync(filePath, "utf8");
    const firstLine = firstMeaningfulSqlLine(content);
    const useMatch = firstLine.match(/^use\s+[`"]?([A-Za-z0-9_]+)[`"]?;?$/i);
    if (!useMatch) {
      failures.push({
        file: relativePath,
        issue: "脚本首条有效 SQL 不是 USE <db>",
      });
    } else if (!ALLOWED_SCRIPT_DATABASES.has(useMatch[1])) {
      failures.push({
        file: relativePath,
        issue: `USE 数据库不在白名单：${useMatch[1]}`,
      });
    }

    if (/\b(after|before)\b/i.test(content)) {
      failures.push({
        file: relativePath,
        issue: "检测到 after/before 字段位置调整写法",
      });
    }

    const hasDdl = containsDdlStatements(content);
    const hasDml = containsDmlStatements(content);
    const underDdl = filePath.startsWith(sqlDdlRoot);
    const underDml = filePath.startsWith(sqlDmlRoot);

    if (!underDdl && !underDml && hasDdl && hasDml) {
      failures.push({
        file: relativePath,
        issue: "DDL 与 DML 混用（要求分离）",
      });
    }
    if (underDdl && hasDml) {
      failures.push({
        file: relativePath,
        issue: "DDL 目录脚本包含 DML 语句",
      });
    }
    if (underDml && hasDdl) {
      failures.push({
        file: relativePath,
        issue: "DML 目录脚本包含 DDL 语句",
      });
    }
  }

  return failures;
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const databaseName = getDatabaseNameFromUrl(databaseUrl);
  if (!databaseName) {
    throw new Error(`DATABASE_URL is missing database name: ${databaseUrl}`);
  }

  mkdirSync(reportDir, { recursive: true });

  const client = createClient(databaseUrl);
  try {
    const tableRows = (await client.$queryRawUnsafe(
      `
        SELECT
          table_name AS tableName,
          table_collation AS tableCollation,
          table_comment AS tableComment
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'
        ORDER BY table_name
      `,
      databaseName,
    )) as Array<{ tableName: string; tableCollation: string | null; tableComment: string | null }>;

    const columnRows = (await client.$queryRawUnsafe(
      `
        SELECT
          c.table_name AS tableName,
          c.column_name AS columnName,
          c.data_type AS dataType,
          c.column_type AS columnType,
          c.is_nullable AS isNullable,
          c.column_default AS columnDefault,
          c.extra AS extra,
          c.character_set_name AS charsetName,
          c.collation_name AS collationName,
          c.column_comment AS columnComment,
          c.character_maximum_length AS characterMaximumLength
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON c.table_schema = t.table_schema
         AND c.table_name = t.table_name
        WHERE c.table_schema = ?
          AND t.table_type = 'BASE TABLE'
          AND t.table_name <> '_prisma_migrations'
        ORDER BY c.table_name, c.ordinal_position
      `,
      databaseName,
    )) as Array<{
      tableName: string;
      columnName: string;
      dataType: string;
      columnType: string;
      isNullable: string;
      columnDefault: unknown;
      extra: string;
      charsetName: string | null;
      collationName: string | null;
      columnComment: string | null;
      characterMaximumLength: number | null;
    }>;

    const primaryKeys = (await client.$queryRawUnsafe(
      `
        SELECT
          k.table_name AS tableName,
          GROUP_CONCAT(k.column_name ORDER BY k.ordinal_position SEPARATOR ',') AS pkColumns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage k
          ON tc.constraint_name = k.constraint_name
         AND tc.table_schema = k.table_schema
         AND tc.table_name = k.table_name
        WHERE tc.table_schema = ?
          AND tc.constraint_type = 'PRIMARY KEY'
        GROUP BY k.table_name
      `,
      databaseName,
    )) as Array<{ tableName: string; pkColumns: string }>;
    const primaryKeyMap = new Map(primaryKeys.map((row) => [row.tableName, row.pkColumns]));

    const indexRows = (await client.$queryRawUnsafe(
      `
        SELECT
          s.table_name AS tableName,
          s.index_name AS indexName,
          s.non_unique AS nonUnique,
          s.column_name AS columnName,
          s.sub_part AS subPart
        FROM information_schema.statistics s
        JOIN information_schema.tables t
          ON s.table_schema = t.table_schema
         AND s.table_name = t.table_name
        WHERE s.table_schema = ?
          AND t.table_type = 'BASE TABLE'
          AND t.table_name <> '_prisma_migrations'
          AND s.index_name <> 'PRIMARY'
        ORDER BY s.table_name, s.index_name, s.seq_in_index
      `,
      databaseName,
    )) as Array<{
      tableName: string;
      indexName: string;
      nonUnique: number;
      columnName: string;
      subPart: number | null;
    }>;

    const fkRows = (await client.$queryRawUnsafe(
      `
        SELECT
          constraint_name AS constraintName,
          table_name AS tableName
        FROM information_schema.referential_constraints
        WHERE constraint_schema = ?
      `,
      databaseName,
    )) as Array<{ constraintName: string; tableName: string }>;

    const tableToColumns = new Map<string, typeof columnRows>();
    for (const row of columnRows) {
      const existing = tableToColumns.get(row.tableName);
      if (existing) {
        existing.push(row);
      } else {
        tableToColumns.set(row.tableName, [row]);
      }
    }

    const ruleResults: RuleResult[] = [];

    const namingFailures: Array<Record<string, unknown>> = [];
    const namePattern = /^[a-z][a-z0-9_]{0,31}$/;
    const numericBridgePattern = /_\d+_/;

    for (const table of tableRows) {
      if (!namePattern.test(table.tableName) || numericBridgePattern.test(table.tableName)) {
        namingFailures.push({
          level: "table",
          table: table.tableName,
          reason: "表名不符合小写下划线+长度<=32+禁止 _数字_ 规则",
        });
      }
      if (RESERVED_WORDS.has(table.tableName.toLowerCase())) {
        namingFailures.push({
          level: "table",
          table: table.tableName,
          reason: "表名命中 MySQL 保留字",
        });
      }
    }
    for (const column of columnRows) {
      if (!namePattern.test(column.columnName) || numericBridgePattern.test(column.columnName)) {
        namingFailures.push({
          level: "column",
          table: column.tableName,
          column: column.columnName,
          reason: "字段名不符合小写下划线+长度<=32+禁止 _数字_ 规则",
        });
      }
      if (RESERVED_WORDS.has(column.columnName.toLowerCase())) {
        namingFailures.push({
          level: "column",
          table: column.tableName,
          column: column.columnName,
          reason: "字段名命中 MySQL 保留字",
        });
      }
    }
    ruleResults.push({
      rule: "naming_and_reserved_words",
      pass: namingFailures.length === 0,
      summary: "库表字段命名规则与保留字检查",
      failureCount: namingFailures.length,
      failures: shortList(namingFailures),
    });

    const requiredColumnFailures: Array<Record<string, unknown>> = [];
    for (const table of tableRows) {
      const columns = new Set(
        (tableToColumns.get(table.tableName) ?? []).map((row) => row.columnName.toLowerCase()),
      );
      for (const requiredColumn of ["id", "create_time", "modify_time"]) {
        if (!columns.has(requiredColumn)) {
          requiredColumnFailures.push({
            table: table.tableName,
            missingColumn: requiredColumn,
          });
        }
      }
    }
    ruleResults.push({
      rule: "required_columns",
      pass: requiredColumnFailures.length === 0,
      summary: "每张表必须包含 id/create_time/modify_time",
      failureCount: requiredColumnFailures.length,
      failures: shortList(requiredColumnFailures),
    });

    const idFailures: Array<Record<string, unknown>> = [];
    for (const table of tableRows) {
      const idColumn = (tableToColumns.get(table.tableName) ?? []).find(
        (column) => column.columnName.toLowerCase() === "id",
      );
      if (!idColumn) {
        continue;
      }
      const pkColumns = primaryKeyMap.get(table.tableName) ?? "";
      const isBigint = idColumn.dataType.toLowerCase() === "bigint";
      const isUnsigned = idColumn.columnType.toLowerCase().includes("unsigned");
      const isAutoIncrement = idColumn.extra.toLowerCase().includes("auto_increment");
      const isPrimaryKey = pkColumns === "id";
      if (!isBigint || !isUnsigned || !isAutoIncrement || !isPrimaryKey) {
        idFailures.push({
          table: table.tableName,
          dataType: idColumn.dataType,
          columnType: idColumn.columnType,
          extra: idColumn.extra,
          primaryKey: pkColumns,
        });
      }
    }
    ruleResults.push({
      rule: "id_bigint_unsigned_auto_increment_primary",
      pass: idFailures.length === 0,
      summary: "id 必须是 bigint unsigned auto_increment 主键",
      failureCount: idFailures.length,
      failures: shortList(idFailures),
    });

    const timeFailures: Array<Record<string, unknown>> = [];
    for (const table of tableRows) {
      const columns = tableToColumns.get(table.tableName) ?? [];
      const createTime = columns.find((column) => column.columnName.toLowerCase() === "create_time");
      const modifyTime = columns.find((column) => column.columnName.toLowerCase() === "modify_time");
      if (createTime) {
        if (createTime.dataType.toLowerCase() !== "datetime") {
          timeFailures.push({
            table: table.tableName,
            column: createTime.columnName,
            reason: "create_time 不是 datetime",
            dataType: createTime.dataType,
          });
        }
      }
      if (modifyTime) {
        if (modifyTime.dataType.toLowerCase() !== "datetime") {
          timeFailures.push({
            table: table.tableName,
            column: modifyTime.columnName,
            reason: "modify_time 不是 datetime",
            dataType: modifyTime.dataType,
          });
        }
        if (!modifyTime.extra.toLowerCase().includes("on update")) {
          timeFailures.push({
            table: table.tableName,
            column: modifyTime.columnName,
            reason: "modify_time 缺少 on update CURRENT_TIMESTAMP",
            extra: modifyTime.extra,
          });
        }
      }
    }
    ruleResults.push({
      rule: "time_columns_datetime",
      pass: timeFailures.length === 0,
      summary: "create_time / modify_time 类型和更新语义检查",
      failureCount: timeFailures.length,
      failures: shortList(timeFailures),
    });

    const charsetFailures: Array<Record<string, unknown>> = [];
    for (const table of tableRows) {
      const collation = (table.tableCollation ?? "").toLowerCase();
      if (!collation.startsWith("utf8mb4_")) {
        charsetFailures.push({
          level: "table",
          table: table.tableName,
          tableCollation: table.tableCollation,
        });
      }
    }
    for (const column of columnRows) {
      if (column.charsetName && column.charsetName.toLowerCase() !== "utf8mb4") {
        charsetFailures.push({
          level: "column_charset",
          table: column.tableName,
          column: column.columnName,
          charsetName: column.charsetName,
        });
      }
      if (column.collationName && !column.collationName.toLowerCase().startsWith("utf8mb4_")) {
        charsetFailures.push({
          level: "column_collation",
          table: column.tableName,
          column: column.columnName,
          collationName: column.collationName,
        });
      }
    }
    ruleResults.push({
      rule: "utf8mb4_charset_and_collation",
      pass: charsetFailures.length === 0,
      summary: "库表字段字符集/排序规则统一 utf8mb4",
      failureCount: charsetFailures.length,
      failures: shortList(charsetFailures),
    });

    const floatDoubleFailures = columnRows
      .filter((column) => ["float", "double"].includes(column.dataType.toLowerCase()))
      .map((column) => ({
        table: column.tableName,
        column: column.columnName,
        dataType: column.dataType,
        columnType: column.columnType,
      }));
    ruleResults.push({
      rule: "no_float_double",
      pass: floatDoubleFailures.length === 0,
      summary: "禁止 float/double",
      failureCount: floatDoubleFailures.length,
      failures: shortList(floatDoubleFailures),
    });

    const commentFailures: Array<Record<string, unknown>> = [];
    for (const table of tableRows) {
      if (!(table.tableComment ?? "").trim()) {
        commentFailures.push({
          level: "table",
          table: table.tableName,
          reason: "表注释为空",
        });
      }
    }
    for (const column of columnRows) {
      if (!(column.columnComment ?? "").trim()) {
        commentFailures.push({
          level: "column",
          table: column.tableName,
          column: column.columnName,
          reason: "字段注释为空",
        });
      }
    }
    ruleResults.push({
      rule: "table_and_column_comments_required",
      pass: commentFailures.length === 0,
      summary: "表与字段注释必填",
      failureCount: commentFailures.length,
      failures: shortList(commentFailures),
    });

    const fkFailures = fkRows.map((row) => ({
      table: row.tableName,
      constraint: row.constraintName,
    }));
    ruleResults.push({
      rule: "no_foreign_keys",
      pass: fkFailures.length === 0,
      summary: "数据库层禁止外键约束",
      failureCount: fkFailures.length,
      failures: shortList(fkFailures),
    });

    const indexNameFailures: Array<Record<string, unknown>> = [];
    for (const row of indexRows) {
      const indexName = row.indexName.toLowerCase();
      const nonUnique = Number(row.nonUnique);
      if (nonUnique === 0 && !indexName.startsWith("uk_")) {
        indexNameFailures.push({
          table: row.tableName,
          index: row.indexName,
          reason: "唯一索引命名必须以 uk_ 开头",
        });
      }
      if (nonUnique !== 0 && !indexName.startsWith("idx_")) {
        indexNameFailures.push({
          table: row.tableName,
          index: row.indexName,
          reason: "普通索引命名必须以 idx_ 开头",
        });
      }
    }
    ruleResults.push({
      rule: "index_naming",
      pass: indexNameFailures.length === 0,
      summary: "索引命名检查（uk_/idx_）",
      failureCount: indexNameFailures.length,
      failures: shortList(indexNameFailures),
    });

    const varcharIndexFailures: Array<Record<string, unknown>> = [];
    const columnMap = new Map(
      columnRows.map((column) => [
        `${column.tableName}.${column.columnName}`,
        {
          dataType: column.dataType.toLowerCase(),
          characterMaximumLength: column.characterMaximumLength,
        },
      ]),
    );
    for (const row of indexRows) {
      const columnMeta = columnMap.get(`${row.tableName}.${row.columnName}`);
      if (!columnMeta || columnMeta.dataType !== "varchar") {
        continue;
      }
      const subPart = row.subPart === null ? null : Number(row.subPart);
      const maxLength = columnMeta.characterMaximumLength;

      if (subPart === null && (maxLength === null || maxLength > 191)) {
        varcharIndexFailures.push({
          table: row.tableName,
          index: row.indexName,
          column: row.columnName,
          reason: "varchar 索引必须指定前缀长度",
        });
        continue;
      }
      if (subPart !== null && maxLength !== null && subPart > maxLength) {
        varcharIndexFailures.push({
          table: row.tableName,
          index: row.indexName,
          column: row.columnName,
          reason: `varchar 索引前缀长度超出字段长度: ${subPart} > ${maxLength}`,
        });
      }
    }
    ruleResults.push({
      rule: "varchar_index_prefix_length",
      pass: varcharIndexFailures.length === 0,
      summary: "varchar 索引前缀长度检查",
      failureCount: varcharIndexFailures.length,
      failures: shortList(varcharIndexFailures),
    });

    const sqlScriptFailures = checkSqlScriptRules();
    ruleResults.push({
      rule: "migration_script_rules",
      pass: sqlScriptFailures.length === 0,
      summary: "变更脚本规范（USE 首行、DDL/DML 分离、禁止 after/before）",
      failureCount: sqlScriptFailures.length,
      failures: shortList(sqlScriptFailures as unknown as Array<Record<string, unknown>>),
    });

    const overallPass = ruleResults.every((result) => result.pass);
    const report = {
      generatedAt: new Date().toISOString(),
      databaseName,
      databaseUrl: databaseUrl.replace(/\/\/[^@]+@/, "//***:***@"),
      overallPass,
      ruleResults,
    };
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

    const markdown = [
      "# MySQL Mandatory Spec Check Report",
      "",
      `- generatedAt: ${report.generatedAt}`,
      `- databaseName: ${databaseName}`,
      `- overallPass: ${overallPass ? "PASS" : "FAIL"}`,
      "",
      "## Rule Summary",
      "",
      "| rule | status | failures | summary |",
      "| --- | --- | ---: | --- |",
      ...ruleResults.map(
        (result) =>
          `| ${result.rule} | ${result.pass ? "PASS" : "FAIL"} | ${result.failureCount} | ${result.summary} |`,
      ),
      "",
      "## Failures (Top 100 per rule)",
      "",
      ...ruleResults.map((result) => {
        const header = `### ${result.rule} (${result.pass ? "PASS" : "FAIL"})`;
        if (result.failures.length === 0) {
          return `${header}\n\n- 无`;
        }
        return `${header}\n\n\`\`\`json\n${JSON.stringify(result.failures, null, 2)}\n\`\`\``;
      }),
      "",
    ].join("\n");
    writeFileSync(markdownPath, markdown, "utf8");

    console.log(`mandatory spec check report generated: ${markdownPath}`);
    if (!overallPass) {
      process.exitCode = 1;
    }
  } finally {
    await client.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
