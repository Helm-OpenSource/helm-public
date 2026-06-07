/**
 * Source Profiler — DB catalog types.
 *
 * Catalog-only introspection: tables, columns, indexes, foreign keys, comments,
 * and permission posture. NEVER business rows. The offline path consumes a
 * `DbCatalogSnapshot` (an information_schema / pragma dump the user produces);
 * a live `CatalogExecutor` path is available programmatically for those who wire
 * a read-only driver.
 */

import { z } from "zod";
import { dbEngineSchema } from "../contract/schema-introspection";

export const catalogSnapshotColumnSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  nullable: z.boolean().default(true),
  comment: z.string().optional(),
});

export const catalogSnapshotForeignKeySchema = z.object({
  column: z.string().min(1),
  referencesTable: z.string().min(1),
  referencesColumn: z.string().min(1),
});

export const catalogSnapshotTableSchema = z.object({
  schema: z.string().min(1),
  name: z.string().min(1),
  columns: z.array(catalogSnapshotColumnSchema).default([]),
  indexes: z.array(z.string()).default([]),
  foreignKeys: z.array(catalogSnapshotForeignKeySchema).default([]),
  comment: z.string().optional(),
});

export const dbCatalogSnapshotSchema = z
  .object({
    engine: dbEngineSchema,
    tables: z.array(catalogSnapshotTableSchema).default([]),
    permissionPosture: z
      .enum(["read_only_confirmed", "unknown", "write_capable_warned"])
      .default("unknown"),
  })
  .strict();

export type DbCatalogSnapshot = z.infer<typeof dbCatalogSnapshotSchema>;

export function parseDbCatalogSnapshot(input: unknown): DbCatalogSnapshot {
  return dbCatalogSnapshotSchema.parse(input);
}

/** Allowlist gating which schemas/tables may be introspected. */
export type CatalogAllowlist = {
  schemas: readonly string[];
  tables: readonly string[];
};

/** A read-only catalog query executor (inject a driver wrapper to use live). */
export interface CatalogExecutor {
  readonly engine: DbCatalogSnapshot["engine"];
  /** Run a catalog-only query and return rows as plain objects. */
  query(sql: string): Promise<Array<Record<string, unknown>>>;
  /**
   * Non-destructive write-capability probe. MUST NOT write. Returns true if the
   * connection appears to have write privileges (a warning, not a failure).
   */
  probeWriteCapability?(): Promise<boolean>;
}
