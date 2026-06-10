/**
 * Source Profiler — OverlayPatchDraft & ConnectorDraft
 *
 * A user-private deployment-code draft for the `helm-overlays` repo. The
 * profiler can emit an OverlayPatchDraft only with explicit opt-in. It NEVER
 * auto-commits, pushes, enables a connector, or writes credentials. Contents
 * are scaffolds/skeletons + candidate mappings + a review packet doc — no
 * secrets, real connection strings, production URLs, raw payloads, or
 * auto-writeback.
 */

import { z } from "zod";
import { signalMappingCandidateSchema } from "./mapping";

export const overlayFileDraftSchema = z.object({
  /** Path relative to the overlay root; must be inside an allowed write path. */
  path: z.string().min(1),
  /** New full content (skeleton/scaffold/patch fragment). */
  content: z.string(),
  intent: z.enum([
    "extension_manifest_patch",
    "readonly_adapter_skeleton",
    "mapping_candidates",
    "review_packet_doc",
    "synthetic_test",
  ]),
}).strict();
export type OverlayFileDraft = z.infer<typeof overlayFileDraftSchema>;

/**
 * Reserved structure for a future connector. v1 NEVER materializes this into a
 * live connector — it is a draft shape only.
 */
export const connectorDraftSchema = z.object({
  /** Stable slug for the proposed connector; not a tenant secret. */
  extensionSlug: z.string().min(1),
  /** Declared posture — always read-only in v1. */
  posture: z.literal("read_only"),
  /** Candidate mappings the connector would (if a human builds it) realize. */
  candidates: z.array(signalMappingCandidateSchema).default([]),
  /** Always false in v1; the draft is inert. */
  activated: z.literal(false),
}).strict();
export type ConnectorDraft = z.infer<typeof connectorDraftSchema>;

/**
 * Safe slug: alphanumerics, `_`, `-` only. Forbids `/`, `\`, `.`, `..` so a
 * tenant/extension value can never traverse out of `tenants/<t>/extensions/<s>/`.
 */
export const safeSlugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "must match ^[A-Za-z0-9_-]+$ (no '/', '\\\\', '.', '..')");

export const overlayPatchDraftSchema = z.object({
  schemaVersion: z.literal("helm.source-profiler.overlay-draft.v1"),
  tenantKey: safeSlugSchema,
  extensionSlug: safeSlugSchema,
  /** The overlay root this draft targets (recorded for audit; not auto-applied). */
  overlayRoot: z.string().min(1),
  files: z.array(overlayFileDraftSchema).default([]),
  connectorDraft: connectorDraftSchema.optional(),
  /** Whether the draft was materialized to disk or only emitted as a patch. */
  materialized: z.boolean().default(false),
}).strict();
export type OverlayPatchDraft = z.infer<typeof overlayPatchDraftSchema>;
