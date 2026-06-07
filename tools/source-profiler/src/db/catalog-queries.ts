/**
 * Source Profiler — per-engine catalog queries.
 *
 * These are the catalog-ONLY queries used to build a snapshot from a live
 * read-only connection. They read only metadata catalogs (information_schema /
 * sqlite_master / pragma) — never business tables. They are also documented so
 * a user can run them by hand and hand the JSON to the offline path.
 */

import type { DbCatalogSnapshot } from "./types";

type Engine = DbCatalogSnapshot["engine"];

export const CATALOG_COLUMN_QUERIES: Record<Engine, string> = {
  postgres: `SELECT table_schema AS schema, table_name AS name, column_name AS column,
  data_type AS data_type, is_nullable AS is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, ordinal_position;`,
  mysql: `SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS name, COLUMN_NAME AS \`column\`,
  DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
FROM information_schema.columns
WHERE TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`,
  sqlite: `-- per-table: PRAGMA table_info(<table>); table list:
SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`,
};

export const CATALOG_FK_QUERIES: Record<Engine, string> = {
  postgres: `SELECT tc.table_schema AS schema, tc.table_name AS name,
  kcu.column_name AS column, ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';`,
  mysql: `SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS name, COLUMN_NAME AS \`column\`,
  REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column
FROM information_schema.key_column_usage
WHERE REFERENCED_TABLE_NAME IS NOT NULL;`,
  sqlite: `-- per-table: PRAGMA foreign_key_list(<table>);`,
};

/**
 * Build a snapshot from a live executor. Engine-specific; for sqlite the
 * executor must understand the PRAGMA-style flow. This path is optional — the
 * offline snapshot path needs none of this.
 */
export async function snapshotFromExecutor(
  executor: { engine: Engine; query: (sql: string) => Promise<Array<Record<string, unknown>>> },
): Promise<DbCatalogSnapshot> {
  const columns = await executor.query(CATALOG_COLUMN_QUERIES[executor.engine]);
  const fks = await executor.query(CATALOG_FK_QUERIES[executor.engine]).catch(() => []);
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
