/**
 * Source Profiler — DB catalog introspection.
 *
 * Turns a catalog snapshot (offline) or a live read-only executor into a
 * SchemaIntrospectionSummary, enforcing the schema/table allowlist and adding
 * semantic tags to columns. Hard invariant: `rowDataRead: false`.
 */

import type { SchemaIntrospectionSummary, CatalogTable } from "../contract/schema-introspection";
import type { CatalogAllowlist, CatalogExecutor, DbCatalogSnapshot } from "./types";
import { snapshotFromExecutor } from "./catalog-queries";
import { normalizeDataType, tagField } from "../profiler/semantic-tagger";

export type IntrospectResult = {
  summary: SchemaIntrospectionSummary;
  /** Tables present in the snapshot but excluded by the allowlist. */
  excludedTables: string[];
  warnings: string[];
};

export function introspectFromSnapshot(
  snapshot: DbCatalogSnapshot,
  allowlist: CatalogAllowlist,
): IntrospectResult {
  const warnings: string[] = [];
  const excludedTables: string[] = [];
  const allowSchemas = new Set(allowlist.schemas);
  const allowTables = new Set(allowlist.tables);

  if (allowSchemas.size === 0 && allowTables.size === 0) {
    warnings.push("db catalog allowlist is empty — no tables introspected");
  }

  const tables: CatalogTable[] = [];
  for (const table of snapshot.tables) {
    const qualified = `${table.schema}.${table.name}`;
    const allowed =
      allowSchemas.has(table.schema) || allowTables.has(table.name) || allowTables.has(qualified);
    if (!allowed) {
      excludedTables.push(qualified);
      continue;
    }
    tables.push({
      schema: table.schema,
      name: table.name,
      comment: table.comment,
      indexes: [...table.indexes],
      foreignKeys: table.foreignKeys.map((fk) => ({
        column: fk.column,
        referencesTable: fk.referencesTable,
        referencesColumn: fk.referencesColumn,
      })),
      columns: table.columns.map((col) => {
        const dataType = normalizeDataType(col.dataType);
        return {
          name: col.name,
          dataType,
          nullable: col.nullable,
          comment: col.comment,
          semanticTags: tagField(col.name, dataType),
        };
      }),
    });
  }

  const summary: SchemaIntrospectionSummary = {
    engine: snapshot.engine,
    tables,
    permissionPosture: snapshot.permissionPosture,
    rowDataRead: false,
  };
  return { summary, excludedTables: excludedTables.sort(), warnings };
}

/**
 * Live path: build a snapshot from a read-only executor (running the write
 * canary as a non-destructive warning), then introspect it.
 */
export async function introspectViaExecutor(
  executor: CatalogExecutor,
  allowlist: CatalogAllowlist,
): Promise<IntrospectResult> {
  // Pass the allowlist into the catalog query so out-of-scope metadata is never
  // read; introspectFromSnapshot filters again as defense-in-depth.
  const snapshot = await snapshotFromExecutor(executor, allowlist);
  if (executor.probeWriteCapability) {
    const writable = await executor.probeWriteCapability().catch(() => false);
    snapshot.permissionPosture = writable ? "write_capable_warned" : "read_only_confirmed";
  }
  const result = introspectFromSnapshot(snapshot, allowlist);
  if (snapshot.permissionPosture === "write_capable_warned") {
    result.warnings.push(
      "db connection appears write-capable — use a read-only role/replica (catalog still read-only)",
    );
  }
  return result;
}
