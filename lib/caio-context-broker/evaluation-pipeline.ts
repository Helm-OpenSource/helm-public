// CAIO context broker — synchronous evaluation pipeline.
//
// Fixed stage order (each stage short-circuits):
//   (1) identity / workspace / project eligibility + source ip (injected
//       predicate results, re-asserted fail-closed),
//   (2) built-in hard boundaries (non-bypassable, evaluated BEFORE any
//       enterprise rule — no enterprise rule can override a hard-boundary
//       hit),
//   (3) published enterprise negative rules (workspace scope then project
//       scope; version pinned; only status "published" participates),
//   (4) default ALLOW for cross-project sources the user can access.
//
// REDACT_AND_ALLOW is only returned when redaction reliably preserves
// semantics and structure; otherwise the pipeline fails closed to
// DENY_EXTERNAL.

import {
  detectHardBoundaryHits,
  matchesNegativeRule,
  ruleHitRef,
  type CaioContextDecision,
  type CaioNegativeRule,
  type ContextSourceDescriptor,
} from "@/lib/caio-context-broker/broker-contracts";
import { resolveCrossProjectPolicy } from "@/lib/caio-context-broker/cross-project";

export type ContextEligibility = Readonly<{
  identityAuthenticated: boolean;
  workspaceEligible: boolean;
  projectEligible: boolean;
  sourceIpAllowed: boolean;
  userCanAccessSource: boolean;
}>;

const ELIGIBILITY_FLAGS: readonly (keyof ContextEligibility)[] = [
  "identityAuthenticated",
  "workspaceEligible",
  "projectEligible",
  "sourceIpAllowed",
  "userCanAccessSource",
];

export type ContextCandidateInput = Readonly<{
  workspaceId: string;
  /** Project the current request is running in. */
  requestingProject: string;
  source: ContextSourceDescriptor;
  content: string;
  eligibility: ContextEligibility;
  /** Rules the caller loaded; the pipeline re-filters to status "published". */
  rules: readonly CaioNegativeRule[];
  policyVersion: string;
}>;

export type ContextEvaluationResult = Readonly<{
  decision: CaioContextDecision;
  ruleHits: readonly string[];
  redactedContent?: string;
  redactionReliable: boolean;
}>;

// ---------------------------------------------------------------------------
// Conservative redaction
// ---------------------------------------------------------------------------

export type RedactionSpan = Readonly<{
  start: number;
  end: number;
  label: string;
}>;

export type RedactionAttempt = Readonly<{
  reliable: boolean;
  redacted: string | null;
  reasons: readonly string[];
}>;

/** More than this fraction of redacted characters makes redaction unreliable. */
export const MAX_REDACTION_FRACTION = 0.3;

const STRUCTURE_CHARACTERS = /[\n{}[\]]/u;

function mergeSpans(spans: readonly RedactionSpan[]): RedactionSpan[] {
  const sorted = [...spans].sort((left, right) => left.start - right.start);
  const merged: { start: number; end: number; label: string }[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/**
 * Conservative redaction attempt. Unreliable (→ caller must DENY_EXTERNAL)
 * when:
 *  - a matched span crosses structural characters (newline, braces,
 *    brackets), because removing it cannot preserve structure;
 *  - more than MAX_REDACTION_FRACTION of the content would be redacted;
 *  - the redacted output still trips a built-in hard-boundary detector on
 *    the idempotency re-scan.
 */
export function attemptRedaction(
  content: string,
  spans: readonly RedactionSpan[],
): RedactionAttempt {
  if (content.length === 0 || spans.length === 0) {
    return Object.freeze({
      reliable: false,
      redacted: null,
      reasons: Object.freeze(["nothing_to_redact"]),
    });
  }
  const reasons: string[] = [];
  const merged = mergeSpans(spans);
  const invalidBounds = merged.some(
    (span) =>
      span.start < 0 || span.end > content.length || span.start >= span.end,
  );
  if (invalidBounds) {
    return Object.freeze({
      reliable: false,
      redacted: null,
      reasons: Object.freeze(["invalid_redaction_span"]),
    });
  }
  const redactedCharacters = merged.reduce(
    (total, span) => total + (span.end - span.start),
    0,
  );
  if (redactedCharacters / content.length > MAX_REDACTION_FRACTION) {
    reasons.push("redaction_budget_exceeded");
  }
  if (
    merged.some((span) =>
      STRUCTURE_CHARACTERS.test(content.slice(span.start, span.end)),
    )
  ) {
    reasons.push("secret_spans_structure");
  }
  let redacted = "";
  let cursor = 0;
  for (const span of merged) {
    redacted += content.slice(cursor, span.start);
    redacted += `[REDACTED:${span.label}]`;
    cursor = span.end;
  }
  redacted += content.slice(cursor);
  if (detectHardBoundaryHits(redacted).length > 0) {
    reasons.push("residual_hit_after_redaction");
  }
  if (reasons.length > 0) {
    return Object.freeze({
      reliable: false,
      redacted: null,
      reasons: Object.freeze(reasons),
    });
  }
  return Object.freeze({
    reliable: true,
    redacted,
    reasons: Object.freeze([]),
  });
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function deny(ruleHits: readonly string[]): ContextEvaluationResult {
  return Object.freeze({
    decision: "DENY_EXTERNAL",
    ruleHits: Object.freeze([...ruleHits]),
    redactionReliable: false,
  });
}

export function evaluateContextCandidate(
  input: ContextCandidateInput,
): ContextEvaluationResult {
  // Stage 1 — eligibility, fail closed. The broker receives already
  // authenticated context but re-asserts every flag: anything that is not
  // literally `true` (false, undefined, missing predicate result) denies.
  for (const flag of ELIGIBILITY_FLAGS) {
    if (input.eligibility?.[flag] !== true) {
      return deny([`eligibility:${flag}`]);
    }
  }

  // Stage 2 — built-in hard boundaries. Runs BEFORE enterprise rules and is
  // decisive: enterprise rules are never consulted about a hard-boundary
  // hit, so no rule (however "allow"-looking) can override it.
  const hardHits = detectHardBoundaryHits(input.content);
  if (hardHits.length > 0) {
    const hitRefs = [
      ...new Set(hardHits.map((hit) => `hard_boundary:${hit.category}`)),
    ];
    const redaction = attemptRedaction(
      input.content,
      hardHits.map((hit) => ({
        start: hit.start,
        end: hit.end,
        label: hit.category,
      })),
    );
    if (!redaction.reliable || redaction.redacted === null) {
      return deny([
        ...hitRefs,
        ...redaction.reasons.map((reason) => `redaction:${reason}`),
      ]);
    }
    return Object.freeze({
      decision: "REDACT_AND_ALLOW",
      ruleHits: Object.freeze(hitRefs),
      redactedContent: redaction.redacted,
      redactionReliable: true,
    });
  }

  // Stage 3 — published enterprise negative rules, workspace scope first,
  // then project scope. Only status "published" participates; unknown rule
  // kinds are ignored (they cannot widen access, and stages 1-2 already
  // ran).
  const published = input.rules.filter(
    (rule) =>
      rule.workspaceId === input.workspaceId && rule.status === "published",
  );
  const ordered = [
    ...published.filter((rule) => rule.scopeKind === "workspace"),
    ...published.filter((rule) => rule.scopeKind === "project"),
  ];

  const crossProject = resolveCrossProjectPolicy({
    rules: published,
    workspaceId: input.workspaceId,
    sourceProject: input.source.sourceProject,
    targetProject: input.requestingProject,
  });
  if (!crossProject.allowed) {
    return deny(crossProject.blockedByRuleRefs);
  }

  const redactSpans: RedactionSpan[] = [];
  const redactHits: string[] = [];
  for (const rule of ordered) {
    if (
      rule.scopeKind === "project" &&
      rule.scopeRef !== input.source.sourceProject &&
      rule.scopeRef !== input.requestingProject
    ) {
      continue;
    }
    if (rule.ruleKind === "no_cross_project_context") continue; // handled above
    if (rule.ruleKind === "deny") {
      if (matchesNegativeRule(rule, input.source, input.content)) {
        return deny([ruleHitRef(rule)]);
      }
      continue;
    }
    if (rule.ruleKind === "redact") {
      if (!matchesNegativeRule(rule, input.source, input.content)) continue;
      if (rule.pattern.contentRegex === undefined) {
        // Descriptor-only redact rule: nothing targeted to remove, so the
        // whole candidate would have to go. Fail closed.
        return deny([ruleHitRef(rule), "redaction:rule_without_content_regex"]);
      }
      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern.contentRegex, "gu");
      } catch {
        return deny([ruleHitRef(rule), "redaction:invalid_rule_regex"]);
      }
      let matchedAny = false;
      for (const match of input.content.matchAll(regex)) {
        if (match[0].length === 0 || match.index === undefined) continue;
        matchedAny = true;
        redactSpans.push({
          start: match.index,
          end: match.index + match[0].length,
          label: rule.ruleKey,
        });
      }
      if (matchedAny) redactHits.push(ruleHitRef(rule));
    }
  }

  if (redactSpans.length > 0) {
    const redaction = attemptRedaction(input.content, redactSpans);
    if (!redaction.reliable || redaction.redacted === null) {
      return deny([
        ...redactHits,
        ...redaction.reasons.map((reason) => `redaction:${reason}`),
      ]);
    }
    // Idempotency re-scan for enterprise redact rules: the redacted output
    // must not still match any redact rule that produced spans.
    const residualRuleHit = ordered.some((rule) => {
      if (rule.ruleKind !== "redact") return false;
      if (rule.pattern.contentRegex === undefined) return false;
      if (!redactHits.includes(ruleHitRef(rule))) return false;
      try {
        return new RegExp(rule.pattern.contentRegex, "gu").test(
          redaction.redacted ?? "",
        );
      } catch {
        return true;
      }
    });
    if (residualRuleHit) {
      return deny([...redactHits, "redaction:residual_hit_after_redaction"]);
    }
    return Object.freeze({
      decision: "REDACT_AND_ALLOW",
      ruleHits: Object.freeze(redactHits),
      redactedContent: redaction.redacted,
      redactionReliable: true,
    });
  }

  // Stage 4 — default ALLOW for cross-project sources the user can access.
  return Object.freeze({
    decision: "ALLOW",
    ruleHits: Object.freeze([]),
    redactionReliable: true,
  });
}
