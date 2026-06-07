/**
 * Helm Agentic Implementation Engineering Layer — closed-set vocabulary.
 *
 * Implements the closed sets from
 * `docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md` §6 / §12.
 *
 * Reuse, don't fork: `AgentImplementationRisk` is the merged diagnostics
 * `DiagnosticCommandRisk` (lib/diagnostics/command-registry.ts, PR #177) plus a
 * single `external_read` extension — asserted to be a strict superset by a test.
 * Pure types + zod; no I/O, no authority.
 */

import { z } from "zod";

export const agentImplementationModeSchema = z.enum([
  "explore",
  "specify",
  "implement",
  "validate",
  "review",
  "handoff",
]);
export type AgentImplementationMode = z.infer<typeof agentImplementationModeSchema>;

/**
 * Equals the merged diagnostics `DiagnosticCommandRisk` (#177) — same closed
 * set, no fork. Per the requirements doc §6.2, external service reads are not a
 * separate public Core risk token: synthetic/public fixture reads stay `read`,
 * and real external-system access is modeled by an owning private process, not a
 * live public command. Equality is enforced by `contracts.test.ts`.
 */
export const agentImplementationRiskSchema = z.enum([
  "read",
  "local_draft",
  "repo_write",
  "external_write",
  "activation",
  "commitment",
]);
export type AgentImplementationRisk = z.infer<typeof agentImplementationRiskSchema>;

/** Risks Public Core automation may run by default. */
export const AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS: ReadonlySet<AgentImplementationRisk> = new Set([
  "read",
  "local_draft",
]);

/** Risks that must fail closed in Public Core automation. */
export const AGENT_FORBIDDEN_RISKS: ReadonlySet<AgentImplementationRisk> = new Set([
  "external_write",
  "activation",
  "commitment",
]);

/**
 * Capsule redaction status (§7). `raw_blocked` / `unknown_blocked` mean redaction
 * is not proven → the capsule must be quarantined and may persist no content.
 * Maps onto the doctor-packet (`raw_private_rejected`/`unknown`) and
 * external-agent-intake (`contains_pii`/`unknown`) vocabularies: anything not in
 * AGENT_REDACTION_SAFE is treated as quarantine.
 */
export const agentRedactionStatusSchema = z.enum([
  "synthetic",
  "redacted",
  "alias_only",
  "raw_blocked",
  "unknown_blocked",
]);
export type AgentRedactionStatus = z.infer<typeof agentRedactionStatusSchema>;

export const AGENT_REDACTION_SAFE: ReadonlySet<AgentRedactionStatus> = new Set([
  "synthetic",
  "redacted",
  "alias_only",
]);

export function isRedactionSafe(status: AgentRedactionStatus): boolean {
  return AGENT_REDACTION_SAFE.has(status);
}

/** Worktree / sandbox profile (§12). */
export const worktreeProfileSchema = z.enum([
  "read_only_local",
  "local_draft",
  "repo_write_reviewed",
  "private_sandbox",
  "external_write_forbidden",
]);
export type WorktreeProfile = z.infer<typeof worktreeProfileSchema>;

/**
 * Deterministic boundary decision. Mirrors the external-agent-intake decision
 * vocabulary so the agentic layer routes through the same terms.
 */
export const agentBoundaryDecisionSchema = z.enum([
  "allow_candidate",
  "review_required",
  "watch_only",
  "reject",
  "quarantine",
]);
export type AgentBoundaryDecision = z.infer<typeof agentBoundaryDecisionSchema>;

/** Trajectory-eval failure classes (§10) — closed set. */
export const trajectoryFailureClassSchema = z.enum([
  "edited_before_reading_scope",
  "unowned_worktree_write",
  "validation_skipped",
  "green_check_overclaim",
  "boundary_authority_leak",
  "external_side_effect_attempt",
  "redaction_leak",
  "source_truth_fabrication",
  "candidate_autopromotion",
]);
export type TrajectoryFailureClass = z.infer<typeof trajectoryFailureClassSchema>;
