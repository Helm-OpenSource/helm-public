/**
 * Source Profiler — Governance vocabulary
 *
 * Deliberately aligned to the existing governance prior-art in
 * `features/external-agent-intake/artifact-contract.ts` and
 * `features/external-agent-intake/p0-req-07-boundary.ts`. The Source Profiler
 * is a standalone, public, offline CLI, so it does not import server modules;
 * it mirrors the same vocabulary here so candidate dispositions, redaction
 * states, and required metadata stay consistent across the product.
 *
 * NOT a runtime gate, NOT an API, NOT a credential store. Pure types + zod.
 */

import { z } from "zod";

/** Mirrors `RedactionStatus` in external-agent-intake/artifact-contract.ts. */
export const redactionStatusSchema = z.enum([
  "redacted",
  "alias_only",
  "contains_pii",
  "unknown",
]);
export type RedactionStatus = z.infer<typeof redactionStatusSchema>;

/**
 * Candidate disposition. The deterministic layer may emit `allow_candidate`
 * (a structural finding) or escalate; the AI overlay may ONLY ever emit
 * `review_required` candidates — it can never assert acceptance. Mirrors
 * `ExternalAgentBoundaryDecision`.
 */
export const boundaryDecisionSchema = z.enum([
  "allow_candidate",
  "review_required",
  "watch_only",
  "reject",
  "quarantine",
]);
export type BoundaryDecision = z.infer<typeof boundaryDecisionSchema>;

/**
 * Lifecycle state of a mapping candidate. Only a human can move a candidate to
 * an accepted/rejected state; tooling (deterministic OR ai) always produces
 * `candidate`.
 */
export const candidateStateSchema = z.enum([
  "candidate",
  "accepted_by_human",
  "rejected_by_human",
]);
export type CandidateState = z.infer<typeof candidateStateSchema>;

/** Who produced an artifact. AI output is never ground truth. */
export const candidateOriginSchema = z.enum(["deterministic", "ai"]);
export type CandidateOrigin = z.infer<typeof candidateOriginSchema>;

/**
 * Required artifact metadata per P0-REQ-07. Missing any field (or a cross-tenant
 * / unredacted / no-trace / stale artifact) must be quarantined before it is
 * surfaced for review. Mirrors `P0Req07RequiredMetadataField`.
 */
export const requiredArtifactMetadataSchema = z.object({
  provider: z.string().min(1),
  source: z.string().min(1),
  timestamp: z.string().min(1),
  actor: z.string().min(1),
  workspace: z.string().min(1),
  rawOutputHash: z.string().min(1),
  redactionStatus: redactionStatusSchema,
  traceId: z.string().min(1),
});
export type RequiredArtifactMetadata = z.infer<
  typeof requiredArtifactMetadataSchema
>;

/**
 * Operating signal family — mirrored from
 * `lib/operating-signal-flow/contract.ts` `OperatingSignalFamily` so mapping
 * candidates stay aligned with Helm's advancement-chain taxonomy.
 */
export const signalFamilySchema = z.enum([
  "commitment",
  "advancement",
  "risk",
  "pacing",
  "receipt",
  "evidence_gap",
  "boundary_attempt",
]);
export type SignalFamily = z.infer<typeof signalFamilySchema>;

/** Internal Helm object an external structure may map onto. */
export const targetEntitySchema = z.enum([
  "Company",
  "Contact",
  "Opportunity",
  "Meeting",
  "Note",
  "Task",
]);
export type TargetEntity = z.infer<typeof targetEntitySchema>;
