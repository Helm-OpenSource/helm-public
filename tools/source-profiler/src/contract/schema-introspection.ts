/**
 * Source Profiler — SchemaIntrospectionSummary
 *
 * Optional DB catalog introspection result (PR4). Catalog-only: tables,
 * columns, indexes, foreign keys, comments, and permission posture. NEVER
 * contains business row data — `rowDataRead` is a hard `false`.
 */

import { z } from "zod";

export const dbEngineSchema = z.enum(["postgres", "mysql", "sqlite"]);
export type DbEngine = z.infer<typeof dbEngineSchema>;

export const catalogColumnSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  nullable: z.boolean(),
  /** Column comment if the catalog exposes one and the policy allows it. */
  comment: z.string().optional(),
  semanticTags: z.array(z.string()).default([]),
}).strict();
export type CatalogColumn = z.infer<typeof catalogColumnSchema>;

export const catalogForeignKeySchema = z.object({
  column: z.string().min(1),
  referencesTable: z.string().min(1),
  referencesColumn: z.string().min(1),
}).strict();
export type CatalogForeignKey = z.infer<typeof catalogForeignKeySchema>;

export const catalogTableSchema = z.object({
  schema: z.string().min(1),
  name: z.string().min(1),
  columns: z.array(catalogColumnSchema).default([]),
  indexes: z.array(z.string()).default([]),
  foreignKeys: z.array(catalogForeignKeySchema).default([]),
  comment: z.string().optional(),
}).strict();
export type CatalogTable = z.infer<typeof catalogTableSchema>;

export const schemaIntrospectionSummarySchema = z.object({
  engine: dbEngineSchema,
  tables: z.array(catalogTableSchema).default([]),
  /** Posture observed during preflight; informational. */
  permissionPosture: z.enum(["read_only_confirmed", "unknown", "write_capable_warned"]),
  /** Hard invariant: the catalog path never reads business rows. */
  rowDataRead: z.literal(false),
}).strict();
export type SchemaIntrospectionSummary = z.infer<
  typeof schemaIntrospectionSummarySchema
>;
