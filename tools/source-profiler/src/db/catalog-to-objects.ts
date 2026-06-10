/**
 * Source Profiler — catalog → DiscoveredObject adapter.
 *
 * Converts a SchemaIntrospectionSummary into DiscoveredObject[] so the existing
 * mapping proposer can suggest candidates from DB catalog structure too.
 */

import type { SchemaIntrospectionSummary } from "../contract/schema-introspection";
import type { Association, DiscoveredObject } from "../contract/code-scan";
import { shortHash } from "../util/hash";

export function catalogToDiscoveredObjects(
  summary: SchemaIntrospectionSummary,
): DiscoveredObject[] {
  return summary.tables.map((table) => {
    const fkColumns = new Set(table.foreignKeys.map((fk) => fk.column));
    const associations: Association[] = table.foreignKeys.map((fk) => ({
      fromField: fk.column,
      toObject: fk.referencesTable,
      kind: "belongs_to",
    }));
    return {
      id: shortHash(`db:${summary.engine}:${table.schema}.${table.name}`),
      kind: "sql_table",
      name: table.name,
      sourceRef: `db:${table.schema}.${table.name}`,
      fields: table.columns.map((col) => ({
        name: col.name,
        dataType: col.dataType,
        nullable: col.nullable,
        semanticTags: fkColumns.has(col.name)
          ? unique([...col.semanticTags, "fk"])
          : col.semanticTags,
      })),
      associations,
      parseConfidence: 95,
    };
  });
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
