/**
 * Source Profiler — SignalMappingCandidate
 *
 * A proposed mapping from a discovered external structure onto a Helm internal
 * entity + signal family. Always a *candidate* until a human accepts/rejects.
 * The AI overlay may only ever produce candidates (origin: "ai").
 */

import { z } from "zod";
import {
  candidateOriginSchema,
  candidateStateSchema,
  signalFamilySchema,
  targetEntitySchema,
} from "./governance";

export const fieldMappingSchema = z.object({
  /** Field on the discovered object (CodeScanSummary) or catalog column. */
  sourceField: z.string().min(1),
  /** Dotted path into Helm's External* import vocabulary, e.g. "amount", "companyExternalIds". */
  targetField: z.string().min(1),
  transform: z
    .enum(["direct", "normalize_name", "normalize_domain", "parse_date", "enum_map"])
    .default("direct"),
  enumMap: z.record(z.string(), z.string()).optional(),
  /** 0-100 confidence in this field-level mapping. */
  confidence: z.number().int().min(0).max(100),
}).strict();
export type FieldMapping = z.infer<typeof fieldMappingSchema>;

export const signalMappingCandidateSchema = z.object({
  id: z.string().min(1),
  /** DiscoveredObject.id or catalog table key this maps from. */
  sourceObjectId: z.string().min(1),
  targetEntity: targetEntitySchema,
  signalFamily: signalFamilySchema,
  fieldMappings: z.array(fieldMappingSchema).default([]),
  /** 0-100, same scale as Helm's IdentityMatch.matchScore. */
  confidence: z.number().int().min(0).max(100),
  /** Why this was proposed — shown to the human reviewer. */
  rationale: z.string().min(1),
  origin: candidateOriginSchema,
  /** Tooling always emits "candidate"; only a human moves it. */
  state: candidateStateSchema.default("candidate"),
  /** Pointers back to evidence (object/field ids); never raw rows. */
  evidenceRefs: z.array(z.string()).default([]),
}).strict();
export type SignalMappingCandidate = z.infer<typeof signalMappingCandidateSchema>;
