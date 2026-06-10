/**
 * Runtime permission fencing for LLM Intelligence v2.
 *
 * LLM workflows may only ever *request* a capability by reference
 * (`capabilityRef`). They never receive a side-effect handle. This module
 * maps a requested capability reference onto a coarse permission profile and
 * fails closed: anything that would cause an external side effect resolves to
 * `blocked_side_effect`, and an unknown / unrecognised request is treated as a
 * blocked side effect rather than silently allowed.
 *
 * Boundary intent (v2 is boundary-first, not an agent platform):
 *   - `read_only`        — may read selected, policy-bounded context only.
 *   - `draft_only`       — may produce a candidate draft for human review.
 *   - `review_required`  — produces output that must stay in human review.
 *   - `blocked_side_effect` — any send / writeback / activation / promotion /
 *     execution request; never granted to an LLM-facing surface.
 */

import { z } from "zod";

export const RUNTIME_PERMISSION_PROFILES = [
  "read_only",
  "draft_only",
  "review_required",
  "blocked_side_effect",
] as const;

export const runtimePermissionProfileSchema = z.enum(RUNTIME_PERMISSION_PROFILES);
export type RuntimePermissionProfile = z.infer<typeof runtimePermissionProfileSchema>;

/**
 * Capability references an LLM workflow is allowed to *request*. The string is
 * a reference only — resolving it never returns an executable handle.
 */
export const capabilityRequestedSchema = z.object({
  capabilityRef: z.string().min(1),
  note: z.string().min(1).optional(),
});
export type CapabilityRequested = z.infer<typeof capabilityRequestedSchema>;

/**
 * Strict allow-list of permitted capability references — the single source of
 * truth. A capabilityRef resolves to a non-blocked profile ONLY by exact match
 * here. We deliberately do NOT pattern-match substrings: a name such as
 * `review_and_post_customer_update`, `review_delete_customer_record`, or
 * `draft_write_customer_note` must not inherit a grant from the words "review"
 * or "draft". Anything not on this list — including any side-effect or unknown
 * reference — fails closed to `blocked_side_effect`.
 *
 * To add a capability, add an explicit entry here (and a guard/test). This keeps
 * the boundary an allow-list, not a deny-list that new names can slip past.
 */
const CAPABILITY_ALLOW_LIST: Readonly<Record<string, RuntimePermissionProfile>> = {
  read_context: "read_only",
  read_evidence: "read_only",
  read_only: "read_only",
  inspect_context: "read_only",
  select_context: "read_only",
  draft_candidate: "draft_only",
  draft_proposal: "draft_only",
  propose_candidate: "draft_only",
  boundary_review: "review_required",
  counterfactual_review: "review_required",
  judgement_review: "review_required",
  evidence_gap_review: "review_required",
  counterargument_review: "review_required",
};

function normalize(capabilityRef: string): string {
  return capabilityRef.trim().toLowerCase();
}

/**
 * Resolve a requested capability reference to a runtime permission profile via
 * the strict allow-list. Any reference that is not an exact allow-list match —
 * empty, unknown, or side-effecting — fails closed to `blocked_side_effect`.
 */
export function resolveRuntimePermissionForCapability(
  capability: CapabilityRequested | string,
): RuntimePermissionProfile {
  const ref = normalize(typeof capability === "string" ? capability : capability.capabilityRef);
  if (ref.length === 0) {
    return "blocked_side_effect";
  }
  return CAPABILITY_ALLOW_LIST[ref] ?? "blocked_side_effect";
}

export function isSideEffectBlocked(profile: RuntimePermissionProfile): boolean {
  return profile === "blocked_side_effect";
}

/**
 * Minimal SkillRevisionCandidate contract. v2 does not ship a skill runtime;
 * this exists only so a proposed skill revision that *requests* a side-effect
 * capability is statically forced into `blocked_side_effect`.
 */
export const skillRevisionCandidateSchema = z.object({
  revisionId: z.string().min(1),
  skillKey: z.string().min(1),
  capabilityRequested: capabilityRequestedSchema,
  rationale: z.array(z.string().min(1)).default([]),
});
export type SkillRevisionCandidate = z.infer<typeof skillRevisionCandidateSchema>;

/**
 * Resolve the permission profile a SkillRevisionCandidate may hold. A revision
 * that requests a side-effect capability always resolves to
 * `blocked_side_effect` — a skill revision can never grant itself a side
 * effect.
 */
export function resolveSkillRevisionPermission(
  candidate: SkillRevisionCandidate,
): RuntimePermissionProfile {
  return resolveRuntimePermissionForCapability(candidate.capabilityRequested);
}
