// CAIO context broker — synchronous evaluation pipeline.
//
// Fixed stage order (evaluation AND reporting order):
//   (1) identity / workspace / project eligibility + source ip (injected
//       predicate results, re-asserted fail-closed),
//   (2) built-in hard boundaries (non-bypassable, evaluated BEFORE any
//       enterprise rule — no enterprise rule can override a hard-boundary
//       hit),
//   (3) published enterprise negative rules (cross-project policy, then
//       workspace scope, then project scope; version pinned; only status
//       "published" participates),
//   (4) default ALLOW for cross-project sources the user can access.
//
// Only stage 1 short-circuits. Stages 2 and 3 are ALWAYS both evaluated and
// their outcomes are combined with strict most-restrictive-wins precedence
//   DENY_EXTERNAL > REDACT_AND_ALLOW > ALLOW,
// so a hard-boundary hit can only make the outcome more restrictive and can
// never be used as an escape hatch out of enterprise policy.
//
// REDACT_AND_ALLOW is only returned when redaction reliably preserves
// semantics and structure; otherwise the pipeline fails closed to
// DENY_EXTERNAL.

import {
  detectHardBoundaryHits,
  isNonRedactableHardBoundaryCategory,
  matchesNegativeRule,
  ruleHitRef,
  type CaioContextDecision,
  type CaioNegativeRule,
  type ContextSourceDescriptor,
  type HardBoundaryHit,
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

/**
 * More than this fraction of redacted characters makes redaction unreliable.
 * The denominator is caller-controlled, so this ratio is only ever an
 * ADDITIONAL denial trigger — it can never grant permission. The absolute
 * criteria below are the primary signal.
 */
export const MAX_REDACTION_FRACTION = 0.3;

/**
 * Absolute cap on how many distinct (merged) hard-boundary spans a single
 * candidate may contain and still be considered reliably redactable. Content
 * with more secret spans than this is dense with secrets whatever its total
 * length, so padding cannot buy a release.
 */
export const MAX_REDACTABLE_HARD_BOUNDARY_SPANS = 3;

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

/**
 * Characters that, sitting immediately next to a redaction span, mean the
 * span cut a longer token in half (`CUST-\d{4}` over `CUST-1234-SECRET-9999`).
 * Sentence punctuation is excluded so ordinary prose stays redactable.
 */
const TOKEN_CONTINUATION_CHARACTER = /[A-Za-z0-9_\-@/:+=&%#\\]/u;

function spanIsTokenBounded(
  content: string,
  start: number,
  end: number,
): boolean {
  const before = start > 0 ? content[start - 1] : undefined;
  const after = end < content.length ? content[end] : undefined;
  if (before !== undefined && TOKEN_CONTINUATION_CHARACTER.test(before)) {
    return false;
  }
  if (after !== undefined && TOKEN_CONTINUATION_CHARACTER.test(after)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Stage 2 — hard boundaries
// ---------------------------------------------------------------------------

type HardBoundaryAssessment = Readonly<{
  /** Version-free refs, one per distinct category, in first-hit order. */
  hitRefs: readonly string[];
  /** `redaction:*` reason codes; non-empty means stage 2 demands a deny. */
  denyReasons: readonly string[];
  spans: readonly RedactionSpan[];
}>;

function distinctSpanCount(spans: readonly RedactionSpan[]): number {
  return mergeSpans(spans).length;
}

function assessHardBoundaries(content: string): HardBoundaryAssessment {
  const hits: readonly HardBoundaryHit[] = detectHardBoundaryHits(content);
  if (hits.length === 0) {
    return Object.freeze({
      hitRefs: Object.freeze([]),
      denyReasons: Object.freeze([]),
      spans: Object.freeze([]),
    });
  }
  const hitRefs = [
    ...new Set(hits.map((hit) => `hard_boundary:${hit.category}`)),
  ];
  const reasons: string[] = [];

  // Marker categories can never be redacted: removing the label would
  // release exactly the material the marker protects.
  for (const category of new Set(
    hits
      .filter(
        (hit) =>
          hit.redactability === "non_redactable" ||
          isNonRedactableHardBoundaryCategory(hit.category),
      )
      .map((hit) => hit.category),
  )) {
    reasons.push(`non_redactable_category:${category}`);
  }
  // Keyword-introduced free text: the true end of the value is unknowable,
  // so partial redaction would release its tail.
  for (const category of new Set(
    hits
      .filter((hit) => hit.redactability === "unbounded")
      .map((hit) => hit.category),
  )) {
    reasons.push(`unbounded_secret_extent:${category}`);
  }

  const spans: RedactionSpan[] = hits.map((hit) => ({
    start: hit.start,
    end: hit.end,
    label: hit.category,
  }));
  // A detected value that continues into adjacent non-whitespace text was
  // only partially matched, so redacting it would release the remainder.
  for (const hit of hits) {
    if (!spanIsTokenBounded(content, hit.start, hit.end)) {
      reasons.push(`secret_extent_not_token_bounded:${hit.category}`);
    }
  }
  // Absolute density cap: independent of the caller-controlled total length.
  if (distinctSpanCount(spans) > MAX_REDACTABLE_HARD_BOUNDARY_SPANS) {
    reasons.push("too_many_hard_boundary_hits");
  }
  // Always attempt the redaction so structure/budget/residual reasons are
  // reported too, even when one of the absolute rules already denies.
  const attempt = attemptRedaction(content, spans);
  if (!attempt.reliable || attempt.redacted === null) {
    reasons.push(...attempt.reasons);
  }
  return Object.freeze({
    hitRefs: Object.freeze(hitRefs),
    denyReasons: Object.freeze(
      [...new Set(reasons)].map((reason) => `redaction:${reason}`),
    ),
    spans: Object.freeze(spans),
  });
}

// ---------------------------------------------------------------------------
// Stage 3 — published enterprise negative rules
// ---------------------------------------------------------------------------

type EnterpriseAssessment = Readonly<{
  /** Rule refs and reason codes, in evaluation order. */
  hits: readonly string[];
  denied: boolean;
  spans: readonly RedactionSpan[];
  /** Rules that produced spans, for the idempotency re-scan. */
  redactRules: readonly CaioNegativeRule[];
}>;

function assessEnterpriseRules(
  input: ContextCandidateInput,
): EnterpriseAssessment {
  const published = input.rules.filter(
    (rule) =>
      rule.workspaceId === input.workspaceId && rule.status === "published",
  );
  const ordered = [
    ...published.filter((rule) => rule.scopeKind === "workspace"),
    ...published.filter((rule) => rule.scopeKind === "project"),
  ];

  const hits: string[] = [];
  let denied = false;

  // Cross-project policy is resolved unconditionally: it is never skipped by
  // an earlier stage.
  const crossProject = resolveCrossProjectPolicy({
    rules: published,
    workspaceId: input.workspaceId,
    sourceProject: input.source.sourceProject,
    targetProject: input.requestingProject,
  });
  if (!crossProject.allowed) {
    denied = true;
    hits.push(...crossProject.blockedByRuleRefs);
  }

  const spans: RedactionSpan[] = [];
  const redactRules: CaioNegativeRule[] = [];
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
        denied = true;
        if (!hits.includes(ruleHitRef(rule))) hits.push(ruleHitRef(rule));
      }
      continue;
    }
    if (rule.ruleKind === "redact") {
      if (!matchesNegativeRule(rule, input.source, input.content)) continue;
      if (rule.pattern.contentRegex === undefined) {
        // Descriptor-only redact rule: nothing targeted to remove, so the
        // whole candidate would have to go. Fail closed.
        denied = true;
        hits.push(ruleHitRef(rule), "redaction:rule_without_content_regex");
        continue;
      }
      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern.contentRegex, "gu");
      } catch {
        denied = true;
        hits.push(ruleHitRef(rule), "redaction:invalid_rule_regex");
        continue;
      }
      let matchedAny = false;
      const ruleSpans: RedactionSpan[] = [];
      let unbounded = false;
      for (const match of input.content.matchAll(regex)) {
        if (match[0].length === 0 || match.index === undefined) continue;
        matchedAny = true;
        const end = match.index + match[0].length;
        // A match that is only part of a longer token cannot be redacted
        // reliably: the remainder of the token would be released.
        if (!spanIsTokenBounded(input.content, match.index, end)) {
          unbounded = true;
        }
        ruleSpans.push({
          start: match.index,
          end,
          label: rule.ruleKey,
        });
      }
      if (!matchedAny) continue;
      hits.push(ruleHitRef(rule));
      if (unbounded) {
        denied = true;
        hits.push("redaction:rule_match_not_token_bounded");
        continue;
      }
      spans.push(...ruleSpans);
      redactRules.push(rule);
    }
  }

  return Object.freeze({
    hits: Object.freeze(hits),
    denied,
    spans: Object.freeze(spans),
    redactRules: Object.freeze(redactRules),
  });
}

export function evaluateContextCandidate(
  input: ContextCandidateInput,
): ContextEvaluationResult {
  // Stage 1 — eligibility, fail closed. The broker receives already
  // authenticated context but re-asserts every flag: anything that is not
  // literally `true` (false, undefined, missing predicate result) denies.
  // This is the ONLY stage that short-circuits: without eligibility there is
  // no authority to scan or release anything.
  for (const flag of ELIGIBILITY_FLAGS) {
    if (input.eligibility?.[flag] !== true) {
      return deny([`eligibility:${flag}`]);
    }
  }

  // Stage 2 — built-in hard boundaries, evaluated BEFORE enterprise rules.
  const hard = assessHardBoundaries(input.content);
  // Stage 3 — published enterprise negative rules, always evaluated.
  const enterprise = assessEnterpriseRules(input);

  // Most restrictive wins: DENY_EXTERNAL > REDACT_AND_ALLOW > ALLOW. Reported
  // hits keep the documented stage order (hard boundaries, then enterprise).
  if (hard.denyReasons.length > 0 || enterprise.denied) {
    return deny([...hard.hitRefs, ...hard.denyReasons, ...enterprise.hits]);
  }

  const spans = [...hard.spans, ...enterprise.spans];
  if (spans.length > 0) {
    const redaction = attemptRedaction(input.content, spans);
    if (!redaction.reliable || redaction.redacted === null) {
      return deny([
        ...hard.hitRefs,
        ...enterprise.hits,
        ...redaction.reasons.map((reason) => `redaction:${reason}`),
      ]);
    }
    // Idempotency re-scan for enterprise redact rules: the redacted output
    // must not still match any redact rule that produced spans.
    const residualRuleHit = enterprise.redactRules.some((rule) => {
      if (rule.pattern.contentRegex === undefined) return false;
      try {
        return new RegExp(rule.pattern.contentRegex, "gu").test(
          redaction.redacted ?? "",
        );
      } catch {
        return true;
      }
    });
    if (residualRuleHit) {
      return deny([
        ...hard.hitRefs,
        ...enterprise.hits,
        "redaction:residual_hit_after_redaction",
      ]);
    }
    return Object.freeze({
      decision: "REDACT_AND_ALLOW",
      ruleHits: Object.freeze([...hard.hitRefs, ...enterprise.hits]),
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
