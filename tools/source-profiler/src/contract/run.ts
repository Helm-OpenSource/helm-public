/**
 * Source Profiler — SourceProfileRun
 *
 * Records a single profiler invocation: identity, version, scope hash, phase,
 * artifact references, and an audit trail. Persisted alongside the artifacts in
 * the run output directory.
 */

import { z } from "zod";

export const profilerPhaseSchema = z.enum([
  "init",
  "scope_resolved",
  "secret_preflight",
  "source_scan",
  "db_catalog",
  "ai_overlay",
  "review_packet",
  "overlay_draft",
  "completed",
  "aborted",
]);
export type ProfilerPhase = z.infer<typeof profilerPhaseSchema>;

export const auditEntrySchema = z.object({
  at: z.string().min(1),
  phase: profilerPhaseSchema,
  message: z.string().min(1),
  level: z.enum(["info", "warn", "error"]).default("info"),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const sourceProfileRunSchema = z.object({
  runId: z.string().min(1),
  toolVersion: z.string().min(1),
  contractVersion: z.string().min(1),
  createdAt: z.string().min(1),
  /** Stable hash of the resolved ScopeManifest. */
  scopeHash: z.string().min(1),
  phase: profilerPhaseSchema,
  modalities: z
    .array(z.enum(["static_source", "db_catalog", "api_schema"]))
    .default([]),
  /** Relative paths (within the run dir) of produced artifacts. */
  artifactRefs: z.array(z.string()).default([]),
  audit: z.array(auditEntrySchema).default([]),
});
export type SourceProfileRun = z.infer<typeof sourceProfileRunSchema>;
