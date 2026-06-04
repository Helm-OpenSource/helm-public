// Fail-closed validators (spec §13). Each returns rejection reasons (empty = valid).
// These validate untrusted shapes at runtime, not only via TS types.

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

function nonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function validateExpectationRule(rule: ExpectationRule): ValidationResult {
  const errors: string[] = [];
  if (!rule || typeof rule !== "object") return r(["rule_not_object"]);

  // Field shape (untrusted JSON).
  if (!nonEmptyString(rule.ruleId)) errors.push("missing_rule_id");
  if (!nonEmptyString(rule.version)) errors.push("missing_version");
  for (const f of ["system", "entity"] as const) {
    if (!rule.trigger || !nonEmptyString(rule.trigger[f])) errors.push(`bad_trigger_${f}`);
  }
  if (!rule.triggerSlice || !nonEmptyString(rule.triggerSlice.scopeRef)) {
    errors.push("bad_trigger_slice_scope_ref");
  }
  for (const f of ["system", "entity", "matchKey"] as const) {
    if (!rule.expectation || !nonEmptyString(rule.expectation[f])) errors.push(`bad_expectation_${f}`);
  }
  if (!rule.expectationSlice || !nonEmptyString(rule.expectationSlice.scopeRef)) {
    errors.push("bad_expectation_slice_scope_ref");
  }
  if (!rule.expectation || typeof rule.expectation.withinDays !== "number" || !Number.isFinite(rule.expectation.withinDays) || rule.expectation.withinDays <= 0) {
    errors.push("within_days_not_positive");
  }

  // Boundary.
  if (rule.effectMode !== "read_only") errors.push("effect_mode_not_read_only");
  if (rule.commitmentClass !== "advice") errors.push("commitment_class_not_advice");

  // forbiddenActions must DECLARE the full forbidden set (an empty list is not fail-closed).
  const declared = new Set(rule.forbiddenActions ?? []);
  for (const a of FORBIDDEN_ACTIONS) {
    if (!declared.has(a)) errors.push(`forbidden_action_not_declared:${a}`);
  }
  for (const a of rule.forbiddenActions ?? []) {
    if (!(FORBIDDEN_ACTIONS as readonly string[]).includes(a)) errors.push(`unknown_forbidden_action:${a}`);
  }

  // Coverage must be required for exactly the trigger and expectation closed worlds.
  const reqKeys = new Set((rule.requiredCoverage ?? []).map((c) => `${c.system}:${c.scope}`));
  if (!rule.requiredCoverage || rule.requiredCoverage.length === 0) {
    errors.push("missing_required_coverage");
  } else {
    if (rule.trigger && rule.triggerSlice && !reqKeys.has(`${rule.trigger.system}:${rule.triggerSlice.scopeRef}`)) {
      errors.push("required_coverage_missing_trigger_slice");
    }
    if (
      rule.expectation &&
      rule.expectationSlice &&
      !reqKeys.has(`${rule.expectation.system}:${rule.expectationSlice.scopeRef}`)
    ) {
      errors.push("required_coverage_missing_expectation_scope");
    }
    for (const c of rule.requiredCoverage) {
      if (!nonEmptyString(c.system) || !nonEmptyString(c.scope)) errors.push("bad_required_coverage_entry");
    }
  }

  return r(errors);
}

export function validateCoverageAssertion(a: CoverageAssertion): ValidationResult {
  const errors: string[] = [];
  if (!nonEmptyString(a.system)) errors.push("missing_system");
  if (!nonEmptyString(a.scope)) errors.push("missing_scope");
  if (!["complete", "partial", "unknown"].includes(a.completeness)) errors.push("bad_completeness");
  const start = Date.parse(a.windowStart);
  const end = Date.parse(a.windowEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) errors.push("bad_window_dates");
  else if (start > end) errors.push("window_start_after_end");
  if (Number.isNaN(Date.parse(a.asOf))) errors.push("bad_as_of");
  if (a.completeness === "complete" && (!Array.isArray(a.evidence) || a.evidence.length === 0)) {
    errors.push("complete_without_evidence");
  }
  return r(errors);
}

export function validateEffectiveOwner(owner: EffectiveOwner): ValidationResult {
  const errors: string[] = [];
  if (owner.resolved) {
    if (!owner.ownerId) errors.push("resolved_without_owner_id");
    if (!owner.evidence || owner.evidence.length === 0) errors.push("resolved_without_evidence");
  } else {
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
  if (!nonEmptyString(request.boundaryNote)) errors.push("missing_boundary_note");
  if (!["missing", "unknown"].includes(request.verdict)) errors.push("bad_verdict");

  if (request.verdict === "missing") {
    const coverage = evaluateCoverage({ rule, assertions, windowStart: triggerOccurredAt, windowEnd: now });
    if (!coverage.complete) errors.push("missing_verdict_without_complete_coverage");
  }

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
