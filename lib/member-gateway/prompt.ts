// lib/member-gateway/prompt.ts
// Member prompt queue contract (spec §5 four write classes, §6.3 supervised
// delivery, §7 trust tiers). Pure judgment only: no IO, no store, no
// clock — callers supply instants and delivery context. Work Packet
// dispatch stays inexpressible in this module, same as the rest of the
// Member Gateway slice.

import { parseInstant } from "@/lib/caio-governance/contract";
import type { ContractValidation } from "@/lib/member-gateway/contract";

export const MEMBER_PROMPT_SEVERITIES = ["critical", "normal"] as const;

export type MemberPromptSeverity = (typeof MEMBER_PROMPT_SEVERITIES)[number];

export const MEMBER_PROMPT_STATES = [
  "pending",
  "delivered",
  "snoozed",
  "responded",
  "withdrawn",
  "expired",
  "suppressed",
] as const;

export type MemberPromptState = (typeof MEMBER_PROMPT_STATES)[number];

// spec §5 four write classes, frozen.
export const MEMBER_RESPONSE_CLASSES = [
  "candidate_write",
  "interaction_receipt",
  "protected_human_response",
  "authority_bearing_action",
] as const;

export type MemberResponseClass = (typeof MEMBER_RESPONSE_CLASSES)[number];

// spec §7 trust tiers, frozen. protected_response is NOT "higher" than
// challenge_write on a severity axis — it is a distinct semantic tier with
// a guaranteed-path obligation (see judgeProtectedResponseRoute).
export const MEMBER_TRUST_TIERS = [
  "read",
  "challenge_write",
  "protected_response",
  "authority_action",
] as const;

export type MemberTrustTier = (typeof MEMBER_TRUST_TIERS)[number];

export type MemberPrompt = {
  promptRef: string;
  workspaceRef: string;
  memberRef: string;
  severity: MemberPromptSeverity;
  // Frozen invariant (spec §6.3): critical severity may only come from a
  // deterministic rule, never from free-form model judgment.
  severityRuleRef: string | null;
  subjectObjectRef: string;
  projectedSummary: string;
  evidenceRefs: readonly string[];
  issuedAt: string;
  expiresAt: string;
};

export type MemberPromptDeliveryContext = {
  now: string;
  inQuietHours: boolean;
  doNotDisturb: boolean;
};

export type MemberPromptDeliveryDecision =
  | { deliver: true; heldReason: null }
  | {
      deliver: false;
      heldReason: "held_quiet_hours" | "held_do_not_disturb" | "prompt_expired";
    };

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateMemberPrompt(prompt: MemberPrompt): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(prompt.promptRef)) {
    errors.push("prompt_ref_missing");
  }
  if (!hasRef(prompt.workspaceRef) || !hasRef(prompt.memberRef)) {
    errors.push("prompt_principal_binding_missing");
  }
  if (!hasRef(prompt.subjectObjectRef)) {
    errors.push("prompt_subject_missing");
  }
  if (!hasRef(prompt.projectedSummary)) {
    errors.push("prompt_summary_missing");
  }
  const issuedAtMs = parseInstant(prompt.issuedAt);
  const expiresAtMs = parseInstant(prompt.expiresAt);
  if (issuedAtMs === null || expiresAtMs === null) {
    errors.push("prompt_instant_invalid");
  } else if (expiresAtMs <= issuedAtMs) {
    errors.push("prompt_window_invalid");
  }
  if (prompt.severity === "critical" && !hasRef(prompt.severityRuleRef)) {
    errors.push("critical_severity_without_rule");
  }
  if (!prompt.evidenceRefs.every((ref) => hasRef(ref))) {
    errors.push("prompt_evidence_ref_invalid");
  }
  return { valid: errors.length === 0, errors };
}

// Delivery judgment (spec §6.3). Expiry is checked first and is exclusive
// (now >= expiresAt holds) — an unparseable `now` is treated the same way,
// fail-closed. A critical prompt bypasses BOTH quiet hours and
// do-not-disturb: critical severity is only reachable through a
// deterministic rule (see validateMemberPrompt), so the one-minute-window
// urgency it encodes is rule-backed, not a model's free-form judgment call,
// and is deliberately allowed to interrupt.
export function decideMemberPromptDelivery(
  prompt: MemberPrompt,
  ctx: MemberPromptDeliveryContext,
): MemberPromptDeliveryDecision {
  const nowMs = parseInstant(ctx.now);
  const expiresAtMs = parseInstant(prompt.expiresAt);
  if (nowMs === null || expiresAtMs === null || nowMs >= expiresAtMs) {
    return { deliver: false, heldReason: "prompt_expired" };
  }
  if (prompt.severity === "critical") {
    return { deliver: true, heldReason: null };
  }
  if (ctx.inQuietHours) {
    return { deliver: false, heldReason: "held_quiet_hours" };
  }
  if (ctx.doNotDisturb) {
    return { deliver: false, heldReason: "held_do_not_disturb" };
  }
  return { deliver: true, heldReason: null };
}

