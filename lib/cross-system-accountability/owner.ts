// EffectiveOwner (spec §6): resolve an accountable owner deterministically. An unassigned
// gap (no accountable user) is the common case — never guess a person; route to a configured
// escalation role or mark unresolvable. Groups / default-admins / bots / departed users are
// excluded as accountable owners.

import type { EffectiveOwner, EffectiveOwnerPolicy, OwnerCandidate } from "./contracts";

export function resolveEffectiveOwner(input: {
  candidates: OwnerCandidate[];
  policy: EffectiveOwnerPolicy;
}): EffectiveOwner {
  const { candidates, policy } = input;

  const excluded = {
    group: candidates.some((c) => c.kind === "group"),
    defaultAdmin: candidates.some((c) => c.kind === "default_admin"),
    bot: candidates.some((c) => c.kind === "bot"),
    departed: candidates.some((c) => c.kind === "user" && !c.active),
  };

  // Deterministic accountable owner: an active human with explicit role-assignment evidence.
  const accountable = candidates.find(
    (c) => c.kind === "user" && c.active && Array.isArray(c.roleEvidence) && c.roleEvidence.length > 0,
  );

  if (accountable) {
    return {
      resolved: true,
      ownerId: accountable.id,
      evidence: accountable.roleEvidence,
      excluded,
    };
  }

  return {
    resolved: false,
    excluded,
    fallback: "escalation_role",
    escalationRoleRef: policy.escalationRoleRef,
    unresolvableReason:
      candidates.length === 0
        ? "no_owner_candidate"
        : "no_active_user_with_role_evidence",
  };
}
