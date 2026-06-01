import { PrismaClient } from "@prisma/client";
import { DEFAULT_MYSQL_DATABASE_URL, getDatabaseNameFromUrl, isMysqlDatabaseUrl } from "@/lib/db-url";
import { readEnvVarFromRootFiles } from "@/lib/root-env";
import { describeColumnComment, describeTableComment } from "./mysql-chinese-comment-utils";

type ColumnRow = {
  tableName: string;
  columnName: string;
  columnType: string;
  dataType: string;
  isNullable: string;
  columnDefault: unknown;
  extra: string;
};

const projectRoot = process.cwd();
const ALLOWED_DATABASES = new Set(["helm2026_ci_verify", "helm2026"]);

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function quoteString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
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

function createClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
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

function formatDefaultSql(column: ColumnRow) {
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

async function run() {
  const databaseUrl = resolveDatabaseUrl();
  const databaseName = getDatabaseNameFromUrl(databaseUrl);
  if (!databaseName) {
    throw new Error(`DATABASE_URL is missing database name: ${databaseUrl}`);
  }
  if (!ALLOWED_DATABASES.has(databaseName)) {
    throw new Error(
      `zh comment sync only allows ${Array.from(ALLOWED_DATABASES).join(", ")}, received: ${databaseName}`,
    );
  }

  const client = createClient(databaseUrl);
  try {
    const tables = (await client.$queryRawUnsafe(
      `
        SELECT table_name AS tableName
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'
        ORDER BY table_name
      `,
      databaseName,
    )) as Array<{ tableName: string }>;

    const columns = (await client.$queryRawUnsafe(
      `
        SELECT
          c.table_name AS tableName,
          c.column_name AS columnName,
          c.column_type AS columnType,
          c.data_type AS dataType,
          c.is_nullable AS isNullable,
          c.column_default AS columnDefault,
          c.extra AS extra
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON c.table_schema = t.table_schema
         AND c.table_name = t.table_name
        WHERE c.table_schema = ?
          AND t.table_type = 'BASE TABLE'
          AND c.table_name <> '_prisma_migrations'
        ORDER BY c.table_name, c.ordinal_position
      `,
      databaseName,
    )) as ColumnRow[];

    let tableCount = 0;
    for (const table of tables) {
      const comment = describeTableComment(table.tableName);
      await client.$executeRawUnsafe(
        `ALTER TABLE ${quoteIdentifier(table.tableName)} COMMENT = ${quoteString(comment)}`,
      );
      tableCount += 1;
    }

    let columnCount = 0;
    for (const column of columns) {
      const comment = describeColumnComment(column.tableName, column.columnName);
      const nullableSql = column.isNullable === "YES" ? "NULL" : "NOT NULL";
      const defaultSql = formatDefaultSql(column);
      const extraSql = normalizeExtraSql(column.extra);

      await client.$executeRawUnsafe(
        `ALTER TABLE ${quoteIdentifier(column.tableName)} MODIFY COLUMN ${quoteIdentifier(column.columnName)} ${column.columnType.toUpperCase()} ${nullableSql}${
          defaultSql === null ? "" : ` DEFAULT ${defaultSql}`
        }${extraSql ? ` ${extraSql}` : ""} COMMENT ${quoteString(comment)}`,
      );
      columnCount += 1;
    }

    console.log(`zh comment sync completed for ${databaseName}: ${tableCount} table(s), ${columnCount} column(s).`);
  } finally {
    await client.$disconnect();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
