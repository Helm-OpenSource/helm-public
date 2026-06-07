/**
 * Source Profiler — per-engine catalog queries.
 *
 * Catalog-ONLY queries used to build a snapshot from a live read-only
 * connection. They read only metadata catalogs (information_schema /
 * sqlite_master / pragma) — never business tables — and the schema/table
 * allowlist is pushed INTO the query so out-of-scope metadata is never read in
 * the first place (defense-in-depth: the offline path filters again).
 */

import type { DbCatalogSnapshot } from "./types";
import type { CatalogAllowlist } from "./types";

type Engine = DbCatalogSnapshot["engine"];

/** Quote a SQL string literal, escaping embedded single quotes. */
function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Build the allowlist WHERE fragment over (schemaCol, tableCol). Returns null
 * when the allowlist is empty — callers must then NOT query at all.
 */
function allowlistWhere(
  allowlist: CatalogAllowlist,
  schemaCol: string,
  tableCol: string,
): string | null {
  const clauses: string[] = [];
  if (allowlist.schemas.length > 0) {
    clauses.push(`${schemaCol} IN (${allowlist.schemas.map(lit).join(", ")})`);
  }
  const bare = allowlist.tables.filter((t) => !t.includes("."));
  const qualified = allowlist.tables.filter((t) => t.includes("."));
  if (bare.length > 0) {
    clauses.push(`${tableCol} IN (${bare.map(lit).join(", ")})`);
  }
  for (const q of qualified) {
    const [s, t] = q.split(".");
    clauses.push(`(${schemaCol} = ${lit(s)} AND ${tableCol} = ${lit(t)})`);
  }
  if (clauses.length === 0) return null;
  return clauses.join(" OR ");
}

export function buildColumnQuery(engine: Engine, allowlist: CatalogAllowlist): string | null {
  if (engine === "sqlite") {
    const where = allowlistWhere(allowlist, "'main'", "name");
    if (!where) return null;
    return `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND (${where});`;
  }
  const isPg = engine === "postgres";
  const schemaCol = isPg ? "table_schema" : "TABLE_SCHEMA";
  const tableCol = isPg ? "table_name" : "TABLE_NAME";
  const where = allowlistWhere(allowlist, schemaCol, tableCol);
  if (!where) return null;
  if (isPg) {
    return `SELECT table_schema AS schema, table_name AS name, column_name AS column,
  data_type AS data_type, is_nullable AS is_nullable
FROM information_schema.columns
WHERE (${where})
ORDER BY table_schema, table_name, ordinal_position;`;
  }
  return `SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS name, COLUMN_NAME AS \`column\`,
  DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
FROM information_schema.columns
WHERE (${where})
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`;
}

export function buildFkQuery(engine: Engine, allowlist: CatalogAllowlist): string | null {
  if (engine === "sqlite") return null; // sqlite FKs come from PRAGMA per table
  const isPg = engine === "postgres";
  const schemaCol = isPg ? "tc.table_schema" : "TABLE_SCHEMA";
  const tableCol = isPg ? "tc.table_name" : "TABLE_NAME";
  const where = allowlistWhere(allowlist, schemaCol, tableCol);
  if (!where) return null;
  if (isPg) {
    return `SELECT tc.table_schema AS schema, tc.table_name AS name,
  kcu.column_name AS column, ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND (${where});`;
  }
  return `SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS name, COLUMN_NAME AS \`column\`,
  REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column
FROM information_schema.key_column_usage
WHERE REFERENCED_TABLE_NAME IS NOT NULL AND (${where});`;
}

/**
 * Build a snapshot from a live executor, constrained by the allowlist. If the
 * allowlist is empty, returns an empty snapshot WITHOUT issuing any query —
 * out-of-scope catalog metadata is never read.
 */
export async function snapshotFromExecutor(
  executor: { engine: Engine; query: (sql: string) => Promise<Array<Record<string, unknown>>> },
  allowlist: CatalogAllowlist,
): Promise<DbCatalogSnapshot> {
  const columnSql = buildColumnQuery(executor.engine, allowlist);
  if (!columnSql) {
    return { engine: executor.engine, tables: [], permissionPosture: "unknown" };
  }
  const columns = await executor.query(columnSql);
  const fkSql = buildFkQuery(executor.engine, allowlist);
  const fks = fkSql ? await executor.query(fkSql).catch(() => []) : [];
  const tables = new Map<string, DbCatalogSnapshot["tables"][number]>();

  for (const row of columns) {
    const schema = String(row.schema ?? "public");
    const name = String(row.name ?? "");
    if (!name) continue;
    const key = `${schema}.${name}`;
    if (!tables.has(key)) {
      tables.set(key, { schema, name, columns: [], indexes: [], foreignKeys: [] });
    }
    tables.get(key)?.columns.push({
      name: String(row.column ?? ""),
      dataType: String(row.data_type ?? "unknown"),
      nullable: String(row.is_nullable ?? "YES").toUpperCase() !== "NO",
    });
  }

  for (const row of fks) {
    const key = `${String(row.schema ?? "public")}.${String(row.name ?? "")}`;
    tables.get(key)?.foreignKeys.push({
      column: String(row.column ?? ""),
      referencesTable: String(row.ref_table ?? ""),
      referencesColumn: String(row.ref_column ?? ""),
    });
  }

  return { engine: executor.engine, tables: [...tables.values()], permissionPosture: "unknown" };
}
