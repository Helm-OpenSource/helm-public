/**
 * Source Profiler — CodeScanSummary
 *
 * Deterministic structural profile of source code, ORM models, and API schema
 * docs. Carries structure (object/field names, types, associations) and parse
 * confidence — never raw row data or full file bodies.
 */

import { z } from "zod";

export const discoveredObjectKindSchema = z.enum([
  "orm_model",
  "sql_table",
  "api_resource",
  "source_struct",
]);
export type DiscoveredObjectKind = z.infer<typeof discoveredObjectKindSchema>;

export const discoveredFieldSchema = z.object({
  name: z.string().min(1),
  /** Normalized type: string|int|float|decimal|bool|timestamp|date|json|enum|fk|unknown. */
  dataType: z.string().min(1),
  nullable: z.boolean().default(true),
  /** Deterministic semantic tags, e.g. ["email"], ["amount"], ["stage"], ["fk:companies"]. */
  semanticTags: z.array(z.string()).default([]),
}).strict();
export type DiscoveredField = z.infer<typeof discoveredFieldSchema>;

export const associationSchema = z.object({
  /** Field on this object that holds the reference. */
  fromField: z.string().min(1),
  /** Referenced object name (best-effort, structural). */
  toObject: z.string().min(1),
  kind: z.enum(["belongs_to", "has_many", "many_to_many", "unknown"]).default("unknown"),
}).strict();
export type Association = z.infer<typeof associationSchema>;

export const discoveredObjectSchema = z.object({
  id: z.string().min(1),
  kind: discoveredObjectKindSchema,
  name: z.string().min(1),
  /** Where it was found, e.g. "models/deal.rb:12" or "openapi.json#/components/schemas/Deal". */
  sourceRef: z.string().min(1),
  fields: z.array(discoveredFieldSchema).default([]),
  associations: z.array(associationSchema).default([]),
  /** 0-100 confidence in the structural parse. */
  parseConfidence: z.number().int().min(0).max(100),
}).strict();
export type DiscoveredObject = z.infer<typeof discoveredObjectSchema>;

export const skippedFileSchema = z.object({
  path: z.string().min(1),
  reason: z.enum([
    "excluded",
    "gitignored",
    "too_large",
    "binary",
    "secret_preflight",
    "unreadable",
  ]),
}).strict();
export type SkippedFile = z.infer<typeof skippedFileSchema>;

export const codeScanSummarySchema = z.object({
  fileCount: z.number().int().min(0),
  scannedFileCount: z.number().int().min(0),
  skippedFiles: z.array(skippedFileSchema).default([]),
  objects: z.array(discoveredObjectSchema).default([]),
}).strict();
export type CodeScanSummary = z.infer<typeof codeScanSummarySchema>;
