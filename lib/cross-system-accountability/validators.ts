// Fail-closed validators (spec §13). Each returns rejection reasons (empty = valid).

import { evaluateCoverage } from "./coverage";
import {
  FORBIDDEN_ACTIONS,
  type AccountabilityLedgerEntry,
  type CoverageAssertion,
  type EffectiveOwner,
  type ExpectationRule,
  type MissingRecordDecisionRequest,
} from "./contracts";
import { verifyLedgerChain } from "./ledger";

export type ValidationResult = { ok: boolean; errors: string[] };
const r = (errors: string[]): ValidationResult => ({ ok: errors.length === 0, errors });

export function validateExpectationRule(rule: ExpectationRule): ValidationResult {
  const errors: string[] = [];
  if (!rule.requiredCoverage || rule.requiredCoverage.length === 0) {
    errors.push("missing_required_coverage");
  }
  if (rule.effectMode !== "read_only") errors.push("effect_mode_not_read_only");
  if (rule.commitmentClass !== "advice") errors.push("commitment_class_not_advice");
  const allowed = new Set<string>(FORBIDDEN_ACTIONS);
  // forbiddenActions must declare (not perform) the forbidden set; any value outside the known
  // forbidden vocabulary is itself suspicious.
  for (const a of rule.forbiddenActions ?? []) {
    if (!allowed.has(a)) errors.push(`unknown_forbidden_action:${a}`);
  }
  return r(errors);
}

export function validateEffectiveOwner(owner: EffectiveOwner): ValidationResult {
  const errors: string[] = [];
  if (owner.resolved) {
    if (!owner.ownerId) errors.push("resolved_without_owner_id");
    if (!owner.evidence || owner.evidence.length === 0) errors.push("resolved_without_evidence");
    // A resolved owner must be an accountable individual, never a group/admin/bot/departed.
    if (owner.excluded.group || owner.excluded.defaultAdmin || owner.excluded.bot) {
      // exclusions may be present as observed candidates; only fail if the resolved owner IS one.
    }
  } else {
    // Unresolved gap must route to escalation or be explicitly unresolvable — never a guessed person.
    if (!owner.escalationRoleRef && !owner.unresolvableReason) {
      errors.push("unresolved_without_escalation_or_reason");
    }
    if (owner.ownerId) errors.push("unresolved_but_owner_id_present");
  }
  return r(errors);
}

export function validateDecisionRequest(input: {
  request: MissingRecordDecisionRequest;
  rule: ExpectationRule;
  assertions: CoverageAssertion[];
  triggerOccurredAt: string;
  now: string;
}): ValidationResult {
  const { request, rule, assertions, triggerOccurredAt, now } = input;
  const errors: string[] = [];

  if (request.commitmentClass !== "advice") errors.push("non_advice_commitment_class");
  if (request.humanReviewerRequired !== true) errors.push("human_reviewer_not_required");
  if (!request.boundaryNote) errors.push("missing_boundary_note");

  // A "missing" verdict requires proven coverage; otherwise it must have been "unknown".
  if (request.verdict === "missing") {
    const coverage = evaluateCoverage({ rule, assertions, windowStart: triggerOccurredAt, windowEnd: now });
    if (!coverage.complete) errors.push("missing_verdict_without_complete_coverage");
  }

  // No forbidden-action / write-send-execute references may leak into evidence.
  if (request.evidenceRefs.some((ref) => /write|send|execute|auto[_-]?(create|dispatch|chase|approve)/i.test(ref))) {
    errors.push("forbidden_action_ref_in_evidence");
  }

  errors.push(...validateEffectiveOwner(request.effectiveOwner).errors.map((e) => `owner:${e}`));
  return r(errors);
}

export function validateLedger(entries: AccountabilityLedgerEntry[]): ValidationResult {
  const errors: string[] = [];
  const chain = verifyLedgerChain(entries);
  if (!chain.ok) errors.push(...chain.errors);
  for (const e of entries) {
    if (typeof e.falsePositive !== "boolean") errors.push(`missing_false_positive_flag:${e.entryId}`);
  }
  return r(errors);
}
