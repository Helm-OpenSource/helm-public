/**
 * Source Profiler — ReviewPacket
 *
 * The user-private output a human reviews. Carries the run, the discovered
 * structure, candidate mappings, redaction status, and the P0-REQ-07-aligned
 * required metadata. Marked CONFIDENTIAL: it may contain real table/field names
 * (it is a user-owned local artifact) and must never enter public fixtures or
 * the public repo. Use the redacted export for anything shareable.
 */

import { z } from "zod";
import { codeScanSummarySchema } from "./code-scan";
import {
  redactionStatusSchema,
  requiredArtifactMetadataSchema,
} from "./governance";
import { signalMappingCandidateSchema } from "./mapping";
import { schemaIntrospectionSummarySchema } from "./schema-introspection";
import { sourceProfileRunSchema } from "./run";

export const humanReviewStateSchema = z.enum([
  "pending_review",
  "in_review",
  "reviewed",
]);
export type HumanReviewState = z.infer<typeof humanReviewStateSchema>;

export const reviewPacketSchema = z.object({
  schemaVersion: z.literal("helm.source-profiler.review-packet.v1"),
  /** Sensitivity header — always CONFIDENTIAL for the full (non-redacted) packet. */
  sensitivity: z.enum(["CONFIDENTIAL", "REDACTED_SHAREABLE"]),
  requiredMetadata: requiredArtifactMetadataSchema,
  run: sourceProfileRunSchema,
  codeScan: codeScanSummarySchema,
  schemaIntrospection: schemaIntrospectionSummarySchema.optional(),
  candidates: z.array(signalMappingCandidateSchema).default([]),
  redactionStatus: redactionStatusSchema,
  humanReviewState: humanReviewStateSchema.default("pending_review"),
}).strict();
export type ReviewPacket = z.infer<typeof reviewPacketSchema>;
