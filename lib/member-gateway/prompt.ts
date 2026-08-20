// lib/member-gateway/prompt.ts
// Member prompt queue contract (spec §5 four write classes, §6.3 supervised
// delivery, §7 trust tiers). Pure judgment only: no IO, no store, no
// clock — callers supply instants and delivery context. Work Packet
// dispatch stays inexpressible in this module, same as the rest of the
// Member Gateway slice.

import { parseInstant, validateHumanResponse } from "@/lib/caio-governance/contract";
import type { CaioHumanResponse } from "@/lib/caio-governance/types";
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
  // Defensive fail-closed: the quiet-hours/DND bypass belongs only to a
  // critical severity backed by a deterministic rule (validateMemberPrompt
  // rejects rule-less critical, but this judgment does not assume callers
  // validated first). A rule-less critical is treated as normal.
  if (
    prompt.severity === "critical" &&
    prompt.severityRuleRef !== null &&
    prompt.severityRuleRef.trim().length > 0
  ) {
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

export type MemberPromptTransitionCause =
  | "deliver"
  | "snooze"
  | "unsnooze"
  | "respond"
  | "withdraw"
  | "expire"
  | "suppress";

// spec §6.3 lifecycle table. Terminal states (responded/withdrawn/expired/
// suppressed) never appear as a `from` here, so any transition attempted
// from one is structurally absent from the table and rejected below.
const MEMBER_PROMPT_TRANSITIONS: ReadonlyArray<{
  from: MemberPromptState;
  cause: MemberPromptTransitionCause;
  to: MemberPromptState;
}> = [
  { from: "pending", cause: "deliver", to: "delivered" },
  { from: "pending", cause: "withdraw", to: "withdrawn" },
  { from: "pending", cause: "expire", to: "expired" },
  { from: "pending", cause: "suppress", to: "suppressed" },
  { from: "delivered", cause: "snooze", to: "snoozed" },
  { from: "delivered", cause: "respond", to: "responded" },
  { from: "delivered", cause: "withdraw", to: "withdrawn" },
  { from: "delivered", cause: "expire", to: "expired" },
  { from: "snoozed", cause: "unsnooze", to: "delivered" },
  { from: "snoozed", cause: "expire", to: "expired" },
  { from: "snoozed", cause: "withdraw", to: "withdrawn" },
];

// Transition judgment (spec §6.3). The transition itself is the receipt
// semantics here; append-only persistence of that receipt is the M3b
// store's job, not this pure judgment's.
export function judgeMemberPromptTransition(input: {
  from: MemberPromptState;
  to: MemberPromptState;
  cause: MemberPromptTransitionCause;
}): ContractValidation {
  const errors: string[] = [];
  const pairMatch = MEMBER_PROMPT_TRANSITIONS.find(
    (edge) => edge.from === input.from && edge.to === input.to,
  );
  if (pairMatch === undefined) {
    errors.push("prompt_transition_invalid");
  } else if (pairMatch.cause !== input.cause) {
    errors.push("prompt_transition_cause_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

// spec §5 response write kinds, frozen, with their class mapping recorded
// alongside each literal so the two never drift apart in review.
export const MEMBER_PROMPT_RESPONSE_KINDS = [
  "acknowledge", // interaction_receipt
  "progress_report", // candidate_write
  "free_text_answer", // candidate_write
  "refuse", // protected_human_response
  "pause", // protected_human_response
  "appeal", // protected_human_response
  "commitment_confirm", // authority_bearing_action
] as const;

export type MemberPromptResponseKind =
  (typeof MEMBER_PROMPT_RESPONSE_KINDS)[number];

function assertExhaustive(value: never): never {
  throw new Error(`unreachable member prompt response kind: ${String(value)}`);
}

// Exhaustive by construction: adding a new MEMBER_PROMPT_RESPONSE_KINDS
// literal without adding a case here fails typecheck at the `default`
// branch (assertExhaustive requires `never`), not just at runtime.
export function classifyMemberPromptResponse(
  kind: MemberPromptResponseKind,
): MemberResponseClass {
  switch (kind) {
    case "acknowledge":
      return "interaction_receipt";
    case "progress_report":
    case "free_text_answer":
      return "candidate_write";
    case "refuse":
    case "pause":
    case "appeal":
      return "protected_human_response";
    case "commitment_confirm":
      return "authority_bearing_action";
    default:
      return assertExhaustive(kind);
  }
}

export function requiredTrustTier(cls: MemberResponseClass): MemberTrustTier {
  switch (cls) {
    case "candidate_write":
    case "interaction_receipt":
      return "challenge_write";
    case "protected_human_response":
      return "protected_response";
    case "authority_bearing_action":
      return "authority_action";
    default:
      return assertExhaustive(cls);
  }
}

// Protected-path guarantee (spec §7 frozen). A failure here is a
// platform-fault signal, NEVER a rejection of the response itself: when
// user-presence delivery is unavailable, the local fallback MUST be
// available, because the member's right to raise a protected response
// (refuse/pause/appeal) may not be effectively denied by an infrastructure
// gap. Both paths absent means the platform has failed its guarantee, not
// that the member did anything wrong.
export function judgeProtectedResponseRoute(input: {
  userPresenceAvailable: boolean;
  localFallbackAvailable: boolean;
}): ContractValidation {
  const errors: string[] = [];
  if (!input.userPresenceAvailable && !input.localFallbackAvailable) {
    errors.push("protected_response_path_unavailable");
  }
  return { valid: errors.length === 0, errors };
}

// Bridge only (spec §5/§7): assembles a CaioHumanResponse for refuse/pause/
// appeal and defers to caio-governance's validateHumanResponse as the sole
// source of truth for its invariants — this module does not duplicate or
// relax them. mandateRef is supplied by the governance layer; the Gateway
// never creates a mandate. This function never throws: raising a protected
// response is always legitimate, and any structural defect (missing
// mandateRef, empty auditRefs, etc.) is carried in the returned
// `validation` result rather than blocking the call. No persistence, no
// promotion, and no authority is granted by calling this function.
export function bridgeProtectedHumanResponse(input: {
  responseId: string;
  mandateRef: string;
  responderRef: string;
  responseType: "refuse" | "pause" | "appeal";
  subjectPromptRef: string;
  reason: string;
  auditRefs: readonly string[];
}): { response: CaioHumanResponse; validation: ContractValidation } {
  const response: CaioHumanResponse = {
    responseId: input.responseId,
    mandateRef: input.mandateRef,
    responderRef: input.responderRef,
    responseType: input.responseType,
    subjectWorkRef: input.subjectPromptRef,
    reason: input.reason,
    status: "raised",
    auditRefs: input.auditRefs,
    retaliationProhibited: true,
  };
  return { response, validation: validateHumanResponse(response) };
}

// authority_bearing_action judgment (spec §7 frozen). Member identity,
// device signature, a challenge, and the Gateway itself can never CREATE
// this authority — externalAuthorizationRef must already exist, sourced
// from the external authorization system. A missing ref blocks outright;
// no escalation or upgrade path is offered by this module.
//
// Triple binding (spec §5; M3a as-built #8): the external authorization
// must explicitly NAME this member, this object, and this action — nothing
// else can substitute for it. A blank/missing element in the authorized
// triple is authority_binding_missing; a complete triple that names a
// different member/object/action than the one actually being submitted is
// authority_binding_mismatch. The two never fire together: a missing
// element is reported as missing, not compared.
export function judgeAuthorityBearingAction(input: {
  externalAuthorizationRef: string | null;
  challengeRef: string | null;
  userPresenceVerified: boolean;
  authorizedMemberRef: string | null;
  authorizedObjectRef: string | null;
  authorizedActionRef: string | null;
  submittingMemberRef: string;
  subjectObjectRef: string;
  actionRef: string;
}): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(input.externalAuthorizationRef)) {
    errors.push("authority_missing");
  }
  if (!hasRef(input.challengeRef)) {
    errors.push("authority_challenge_missing");
  }
  if (!input.userPresenceVerified) {
    errors.push("authority_user_presence_missing");
  }
  const tripleComplete =
    hasRef(input.authorizedMemberRef) &&
    hasRef(input.authorizedObjectRef) &&
    hasRef(input.authorizedActionRef);
  if (!tripleComplete) {
    errors.push("authority_binding_missing");
  } else if (
    input.authorizedMemberRef !== input.submittingMemberRef ||
    input.authorizedObjectRef !== input.subjectObjectRef ||
    input.authorizedActionRef !== input.actionRef
  ) {
    errors.push("authority_binding_mismatch");
  }
  return { valid: errors.length === 0, errors };
}
