// CAIO context broker — wire contracts for the cross-project context
// evaluation pipeline.
//
// The broker decides, per context candidate and per request, whether content
// may be released toward an external model: ALLOW, REDACT_AND_ALLOW, or
// DENY_EXTERNAL. Built-in hard boundary categories are non-negotiable: they
// are evaluated before any enterprise rule and no enterprise rule can disable
// or override them.

import { z } from "zod";

import {
  SENSITIVE_VALUE_PATTERNS,
  type SensitiveValuePatternCode,
} from "@/lib/shared/sensitive-patterns";

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export const CAIO_CONTEXT_DECISIONS = [
  "ALLOW",
  "REDACT_AND_ALLOW",
  "DENY_EXTERNAL",
] as const;

export const caioContextDecisionSchema = z.enum(CAIO_CONTEXT_DECISIONS);
export type CaioContextDecision = z.infer<typeof caioContextDecisionSchema>;

/**
 * Continuation marker attached to a request that proceeded without stored
 * context because retrieval failed or timed out. It is a marker, not a
 * decision: the user-submitted inputs still carry their own decision.
 */
export const CONTEXT_ENRICHMENT_SKIPPED_MARKER =
  "context_enrichment_skipped" as const;
export type ContextEnrichmentSkippedMarker =
  typeof CONTEXT_ENRICHMENT_SKIPPED_MARKER;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const CAIO_CONTEXT_BROKER_ERROR_CODES = [
  "caio_external_release_denied",
  "caio_receipt_conflict",
  "caio_rule_forbidden",
  "caio_rule_illegal_state",
  "caio_rule_not_found",
  "caio_invalid_input",
  "caio_internal_error",
] as const;

export type CaioContextBrokerErrorCode =
  (typeof CAIO_CONTEXT_BROKER_ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<CaioContextBrokerErrorCode, number> = {
  caio_external_release_denied: 422,
  caio_receipt_conflict: 409,
  caio_rule_forbidden: 403,
  caio_rule_illegal_state: 409,
  caio_rule_not_found: 404,
  caio_invalid_input: 400,
  caio_internal_error: 500,
};

export class CaioContextBrokerError extends Error {
  readonly code: CaioContextBrokerErrorCode;
  readonly httpStatus: number;

  constructor(code: CaioContextBrokerErrorCode, message: string) {
    super(message);
    this.name = "CaioContextBrokerError";
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
  }
}

// ---------------------------------------------------------------------------
// Context sources and citations
// ---------------------------------------------------------------------------

export const CAIO_CITATION_LABEL_PATTERN = /^\[CAIO:S[1-9]\d*\]$/u;

export const caioContextSourceSchema = z
  .object({
    sourceProject: z.string().min(1).max(200),
    sourceRef: z.string().min(1).max(500),
    sourceVersionOrContentHash: z.string().min(1).max(200),
    citationLabel: z.string().regex(CAIO_CITATION_LABEL_PATTERN),
    classification: z.string().min(1).max(100),
    redactionState: z.enum(["none", "redacted"]),
    receiptId: z.string().min(1).max(200),
  })
  .strict();

export type CaioContextSource = z.infer<typeof caioContextSourceSchema>;

export function formatCitationLabel(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1) {
    throw new CaioContextBrokerError(
      "caio_invalid_input",
      "Citation ordinals start at one.",
    );
  }
  return `[CAIO:S${ordinal}]`;
}

// ---------------------------------------------------------------------------
// Built-in hard boundary categories (non-bypassable)
// ---------------------------------------------------------------------------

export const HARD_BOUNDARY_CATEGORIES = [
  "private_key",
  "ca_private_key",
  "password",
  "connection_string",
  "api_or_session_token",
  "raw_serial_number",
  "unauthorized_identity_data",
  "local_only_marker",
  "unauthorized_material",
] as const;

export type HardBoundaryCategory = (typeof HARD_BOUNDARY_CATEGORIES)[number];

export type HardBoundaryDetector = Readonly<{
  category: HardBoundaryCategory;
  patternCode: string;
  regex: RegExp;
}>;

// Every shared sensitive-value pattern maps into one hard boundary category so
// nothing detected by lib/shared/sensitive-patterns.ts can slip through the
// broker unclassified.
const HARD_BOUNDARY_CATEGORY_BY_SHARED_CODE: Record<
  SensitiveValuePatternCode,
  HardBoundaryCategory
> = {
  raw_email_pattern: "unauthorized_identity_data",
  raw_phone_pattern: "unauthorized_identity_data",
  raw_ip_pattern: "unauthorized_identity_data",
  raw_uuid_pattern: "raw_serial_number",
  raw_bearer_token_pattern: "api_or_session_token",
  raw_api_key_pattern: "api_or_session_token",
};

const TARGETED_HARD_BOUNDARY_DETECTORS: readonly HardBoundaryDetector[] = [
  {
    category: "ca_private_key",
    patternCode: "ca_private_key_block",
    regex:
      /-----BEGIN CA PRIVATE KEY-----[\s\S]*?(?:-----END CA PRIVATE KEY-----|$)|\bcertificate[\s_-]authority\b[^\n]{0,60}\bprivate[\s_-]?key\b/giu,
  },
  {
    category: "private_key",
    patternCode: "pem_private_key_block",
    regex:
      /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END[A-Z ]*PRIVATE KEY-----|$)/gu,
  },
  {
    category: "password",
    patternCode: "password_assignment",
    regex: /\b(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{4,}/giu,
  },
  {
    category: "connection_string",
    patternCode: "database_connection_string",
    regex:
      /\b(?:mysql|mariadb|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqps?|mssql|jdbc:[a-z]+):\/\/[^\s"']+/giu,
  },
  {
    category: "api_or_session_token",
    patternCode: "session_token_assignment",
    regex:
      /\b(?:sess(?:ion)?[-_]?(?:id|token)|access[-_]?token|refresh[-_]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/giu,
  },
  {
    category: "raw_serial_number",
    patternCode: "serial_number_assignment",
    regex:
      /\bserial(?:[-_\s]?(?:number|no\.?))?\s*[:#=]\s*["']?[A-Z0-9][A-Z0-9-]{5,}/giu,
  },
  {
    category: "local_only_marker",
    patternCode: "local_only_marker",
    regex: /\[\[LOCAL[-_]?ONLY\]\]|\bLOCAL[-_]ONLY\b/giu,
  },
  {
    category: "unauthorized_material",
    patternCode: "unauthorized_material_marker",
    regex:
      /\bDO NOT (?:DISTRIBUTE|SHARE)\b|\bUNAUTHORIZED[\s_-]MATERIAL\b|\bINTERNAL USE ONLY\b/giu,
  },
];

function withGlobalFlag(regex: RegExp): RegExp {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  return new RegExp(regex.source, flags);
}

/**
 * Full built-in detector set: targeted additions first, then the shared
 * sensitive-value patterns (reused verbatim from lib/shared/sensitive-patterns).
 * The list is frozen; enterprise rules have no handle to remove entries.
 */
export const HARD_BOUNDARY_DETECTORS: readonly HardBoundaryDetector[] =
  Object.freeze([
    ...TARGETED_HARD_BOUNDARY_DETECTORS,
    ...SENSITIVE_VALUE_PATTERNS.map((pattern) =>
      Object.freeze({
        category: HARD_BOUNDARY_CATEGORY_BY_SHARED_CODE[pattern.code],
        patternCode: pattern.code,
        regex: pattern.regex,
      }),
    ),
  ]);

export type HardBoundaryHit = Readonly<{
  category: HardBoundaryCategory;
  patternCode: string;
  start: number;
  end: number;
}>;

export function detectHardBoundaryHits(
  content: string,
): readonly HardBoundaryHit[] {
  if (!content) return [];
  const hits: HardBoundaryHit[] = [];
  for (const detector of HARD_BOUNDARY_DETECTORS) {
    const regex = withGlobalFlag(detector.regex);
    for (const match of content.matchAll(regex)) {
      if (match[0].length === 0 || match.index === undefined) continue;
      hits.push(
        Object.freeze({
          category: detector.category,
          patternCode: detector.patternCode,
          start: match.index,
          end: match.index + match[0].length,
        }),
      );
    }
  }
  return hits.sort((left, right) => left.start - right.start);
}

// ---------------------------------------------------------------------------
// Enterprise negative rules
// ---------------------------------------------------------------------------

export const CAIO_NEGATIVE_RULE_KINDS = [
  "deny",
  "redact",
  "no_cross_project_context",
] as const;
export type CaioNegativeRuleKind = (typeof CAIO_NEGATIVE_RULE_KINDS)[number];

export const CAIO_NEGATIVE_RULE_STATUSES = [
  "draft",
  "published",
  "revoked",
] as const;
export type CaioNegativeRuleStatus =
  (typeof CAIO_NEGATIVE_RULE_STATUSES)[number];

export const CAIO_RULE_SCOPE_KINDS = ["workspace", "project"] as const;
export type CaioRuleScopeKind = (typeof CAIO_RULE_SCOPE_KINDS)[number];

/**
 * Pattern matching contract over source descriptors + content. All present
 * fields must match (logical AND); at least one field is required so a rule
 * can never be an accidental match-everything.
 */
export const caioNegativeRulePatternSchema = z
  .object({
    sourceProject: z.string().min(1).max(200).optional(),
    sourceRefPrefix: z.string().min(1).max(500).optional(),
    classification: z.string().min(1).max(100).optional(),
    contentRegex: z.string().min(1).max(500).optional(),
  })
  .strict()
  .refine(
    (pattern) => Object.values(pattern).some((value) => value !== undefined),
    { message: "A negative rule pattern needs at least one criterion." },
  );

export type CaioNegativeRulePattern = z.infer<
  typeof caioNegativeRulePatternSchema
>;

export const caioNegativeRuleSchema = z
  .object({
    id: z.string().min(1).max(200),
    workspaceId: z.string().min(1).max(200),
    ruleKey: z.string().min(1).max(200),
    scopeKind: z.enum(CAIO_RULE_SCOPE_KINDS),
    scopeRef: z.string().min(1).max(200).nullable(),
    ruleKind: z.enum(CAIO_NEGATIVE_RULE_KINDS),
    pattern: caioNegativeRulePatternSchema,
    version: z.number().int().min(1),
    status: z.enum(CAIO_NEGATIVE_RULE_STATUSES),
    createdByRef: z.string().min(1).max(200),
    publishedByRef: z.string().min(1).max(200).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    revokedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .refine(
    (rule) => (rule.scopeKind === "project" ? rule.scopeRef !== null : true),
    { message: "Project-scoped rules require a scopeRef." },
  );

export type CaioNegativeRule = z.infer<typeof caioNegativeRuleSchema>;

export type ContextSourceDescriptor = Readonly<{
  sourceProject: string;
  sourceRef: string;
  classification: string;
}>;

function safeRuleRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "gu");
  } catch {
    return null;
  }
}

/**
 * Descriptor + content matching for deny/redact rules. An invalid stored
 * contentRegex fails closed: the rule counts as matching (deny semantics are
 * enforced by the caller).
 */
export function matchesNegativeRule(
  rule: Pick<CaioNegativeRule, "pattern">,
  source: ContextSourceDescriptor,
  content: string,
): boolean {
  const { pattern } = rule;
  if (
    pattern.sourceProject !== undefined &&
    pattern.sourceProject !== source.sourceProject
  ) {
    return false;
  }
  if (
    pattern.sourceRefPrefix !== undefined &&
    !source.sourceRef.startsWith(pattern.sourceRefPrefix)
  ) {
    return false;
  }
  if (
    pattern.classification !== undefined &&
    pattern.classification !== source.classification
  ) {
    return false;
  }
  if (pattern.contentRegex !== undefined) {
    const regex = safeRuleRegex(pattern.contentRegex);
    if (regex === null) return true; // fail closed on a broken stored regex
    return regex.test(content);
  }
  return true;
}

export function ruleHitRef(
  rule: Pick<CaioNegativeRule, "ruleKey" | "version">,
): string {
  return `${rule.ruleKey}@v${rule.version}`;
}
