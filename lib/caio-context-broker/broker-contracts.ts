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
// Versioned context-source DESCRIPTOR contract (producer -> broker)
// ---------------------------------------------------------------------------

/**
 * Wire contract version for the descriptor a context PRODUCER hands to the
 * broker before any release decision is made. Producers that live outside this
 * repository (Pack adapters, overlay adapters) may not import Core code — the
 * dependency direction is Overlay -> Pack SDK -> Core SDK — so they reference
 * this contract by its version STRING and mirror the shape. A conformance test
 * parses their committed fixture with the schema below, so the two sides cannot
 * drift silently.
 *
 * Bump this string (…v2) for any change that is not purely additive-optional.
 */
export const CAIO_CONTEXT_SOURCE_DESCRIPTOR_SCHEMA_VERSION =
  "helm.caio.context-source-descriptor.v1" as const;

/**
 * Closed classification vocabulary for v1. Closed on purpose: an unrecognised
 * label must be refused rather than silently treated as low sensitivity.
 */
export const CAIO_CONTEXT_SOURCE_CLASSIFICATIONS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export type CaioContextSourceClassification =
  (typeof CAIO_CONTEXT_SOURCE_CLASSIFICATIONS)[number];

/** Who produced the descriptor. Also closed for v1. */
export const CAIO_CONTEXT_SOURCE_PRODUCERS = [
  "pack-adapter",
  "overlay-adapter",
  "core-runtime",
] as const;
export type CaioContextSourceProducer =
  (typeof CAIO_CONTEXT_SOURCE_PRODUCERS)[number];

/**
 * Conservative reference charset: must start alphanumeric, no whitespace, no
 * URL scheme, no absolute or drive-letter path, no `..` traversal. A ref is
 * governance metadata, never a URL and never credential material.
 */
export const CAIO_CONTEXT_SOURCE_REF_PATTERN =
  /^(?!(?:https?|ftp|file|jdbc|data|mailto|javascript|ldaps?|smb):)(?!.*\.\.)(?![A-Za-z]:[\\/])[A-Za-z0-9][A-Za-z0-9:._/-]*$/u;

/** Pack keys are lowercase kebab identifiers. */
export const CAIO_CONTEXT_SOURCE_PACK_KEY_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;

/** `sha256:` + 64 lowercase-or-uppercase hex characters. */
export const CAIO_CONTENT_HASH_PATTERN = /^sha256:[a-fA-F0-9]{64}$/u;

/**
 * A short human version label: `v3`, `v1.2.0`, `2026-07-30`, `rev-12`. Each
 * dot/dash/underscore separated segment is at most 12 characters, so a dense
 * opaque token (an access key id, a bearer token, a base64 blob) cannot pose
 * as a version.
 */
export const CAIO_VERSION_LABEL_PATTERN =
  /^[A-Za-z0-9]{1,12}(?:[._-][A-Za-z0-9]{1,12})*$/u;

export function isCaioSourceVersionOrContentHash(value: string): boolean {
  return (
    CAIO_CONTENT_HASH_PATTERN.test(value) ||
    CAIO_VERSION_LABEL_PATTERN.test(value)
  );
}

/**
 * THE context-source descriptor contract. Strict: an unknown key is a drift
 * signal and is rejected, never ignored.
 *
 * This is deliberately NOT `caioContextSourceSchema`. That schema describes a
 * source that has ALREADY been released and cited in a receipt (it carries
 * citationLabel / redactionState / receiptId, all of which only exist after a
 * decision). The descriptor below is the PRE-decision input, and
 * `ContextSourceDescriptor` — the read view the evaluation pipeline consumes —
 * is derived from this schema with `Pick`, so there is exactly one definition
 * of the fields the broker acts on.
 */
export const caioContextSourceDescriptorSchema = z
  .object({
    schemaVersion: z.literal(CAIO_CONTEXT_SOURCE_DESCRIPTOR_SCHEMA_VERSION),
    sourceProject: z
      .string()
      .min(1)
      .max(200)
      .regex(CAIO_CONTEXT_SOURCE_REF_PATTERN),
    sourceRef: z.string().min(3).max(500).regex(CAIO_CONTEXT_SOURCE_REF_PATTERN),
    sourceVersionOrContentHash: z
      .string()
      .min(1)
      .max(200)
      .refine(isCaioSourceVersionOrContentHash, {
        message:
          "sourceVersionOrContentHash must be a sha256 content hash or a short version label.",
      }),
    classification: z.enum(CAIO_CONTEXT_SOURCE_CLASSIFICATIONS),
    /**
     * Structural local-only marking. `true` means the source may never
     * contribute to an external release, whatever its content scan says. The
     * flag is REQUIRED: an unmarked source has no basis for release.
     */
    localOnly: z.boolean(),
    packKey: z
      .string()
      .min(1)
      .max(64)
      .regex(CAIO_CONTEXT_SOURCE_PACK_KEY_PATTERN),
    producedBy: z.enum(CAIO_CONTEXT_SOURCE_PRODUCERS),
  })
  .strict();

export type CaioContextSourceDescriptor = z.infer<
  typeof caioContextSourceDescriptorSchema
>;

/**
 * Validating parser for a producer-supplied descriptor. Throws
 * `caio_invalid_input` (HTTP 400) on any deviation. The error message reports
 * field paths and issue codes only — it never echoes a rejected value, which
 * may itself be the sensitive material.
 */
export function parseCaioContextSourceDescriptor(
  value: unknown,
): CaioContextSourceDescriptor {
  const parsed = caioContextSourceDescriptorSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      const keys =
        issue.code === "unrecognized_keys" && "keys" in issue
          ? `(${(issue.keys as readonly string[]).join(",")})`
          : "";
      return `${path}:${issue.code}${keys}`;
    })
    .sort()
    .join(" ");
  throw new CaioContextBrokerError(
    "caio_invalid_input",
    `Context source descriptor does not satisfy ${CAIO_CONTEXT_SOURCE_DESCRIPTOR_SCHEMA_VERSION}: ${issues}`,
  );
}

// ---------------------------------------------------------------------------
// Structural (descriptor-level) boundaries
// ---------------------------------------------------------------------------

/**
 * A structural boundary is asserted by the DESCRIPTOR, not by scanning
 * content. It is distinct from the `local_only_marker` hard-boundary category,
 * which matches a LOCAL-ONLY label inside the content text: a descriptor whose
 * `localOnly` flag is true carries no marker in its body at all, so no content
 * detector can ever see it.
 *
 * Structural reasons behave exactly like the non-redactable marker categories:
 * they can only make the outcome more restrictive and nothing — no enterprise
 * rule, no redaction, no eligibility grant — can bypass them.
 */
export const LOCAL_ONLY_SOURCE_DENY_REASON =
  "structural_boundary:local_only_source" as const;

/**
 * The flag was absent or not a boolean. The marking is unresolved, so there is
 * no basis for external release: fail closed, exactly like an eligibility
 * predicate that did not return `true`.
 */
export const LOCAL_ONLY_FLAG_UNRESOLVED_DENY_REASON =
  "structural_boundary:local_only_flag_unresolved" as const;

export const CAIO_STRUCTURAL_BOUNDARY_REASONS = [
  LOCAL_ONLY_SOURCE_DENY_REASON,
  LOCAL_ONLY_FLAG_UNRESOLVED_DENY_REASON,
] as const;
export type CaioStructuralBoundaryReason =
  (typeof CAIO_STRUCTURAL_BOUNDARY_REASONS)[number];

/**
 * Stage 2a of the pipeline: descriptor-level exclusions. Returns the reasons a
 * source may not contribute to an external release regardless of its content.
 * Only `localOnly === false` clears the check.
 */
export function assessSourceStructuralBoundaries(
  source: Pick<ContextSourceDescriptor, "localOnly"> | null | undefined,
): readonly CaioStructuralBoundaryReason[] {
  const flag: unknown = source?.localOnly;
  if (flag === false) return Object.freeze([]);
  if (flag === true) return Object.freeze([LOCAL_ONLY_SOURCE_DENY_REASON]);
  return Object.freeze([LOCAL_ONLY_FLAG_UNRESOLVED_DENY_REASON]);
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
  // Opaque identifiers (UUID/GUID). Kept separate from raw_serial_number:
  // a UUID is an identifier, not a device serial, and reporting one as the
  // other mis-describes what was found.
  "raw_identifier",
  "unauthorized_identity_data",
  "local_only_marker",
  "unauthorized_material",
] as const;

export type HardBoundaryCategory = (typeof HARD_BOUNDARY_CATEGORIES)[number];

/**
 * How reliably a hit's extent can be bounded, which decides whether
 * REDACT_AND_ALLOW is even a candidate outcome:
 *
 *  - "precise": the match covers the whole sensitive value (delimited by
 *    quotes, whitespace, or a fixed shape) → redaction may be attempted.
 *  - "unbounded": the match is keyword-introduced free text whose true end
 *    cannot be determined (a passphrase with spaces, a key block, a cookie
 *    header). Partial redaction would release the tail, so the pipeline
 *    denies instead of guessing.
 *  - "non_redactable": the hit is a MARKER referring to the surrounding
 *    document (LOCAL-ONLY, DO NOT DISTRIBUTE). Removing the label would
 *    release exactly the material the marker protects → always deny.
 */
export const HARD_BOUNDARY_REDACTABILITIES = [
  "precise",
  "unbounded",
  "non_redactable",
] as const;
export type HardBoundaryRedactability =
  (typeof HARD_BOUNDARY_REDACTABILITIES)[number];

/**
 * Marker categories: the sensitive thing is the document the marker refers
 * to, not the marker text. A hit here can never be redacted away — callers
 * must fail closed to DENY_EXTERNAL.
 */
export const NON_REDACTABLE_HARD_BOUNDARY_CATEGORIES: readonly HardBoundaryCategory[] =
  Object.freeze(["local_only_marker", "unauthorized_material"] as const);

export function isNonRedactableHardBoundaryCategory(
  category: HardBoundaryCategory,
): boolean {
  return NON_REDACTABLE_HARD_BOUNDARY_CATEGORIES.includes(category);
}

export type HardBoundaryDetector = Readonly<{
  category: HardBoundaryCategory;
  patternCode: string;
  redactability: HardBoundaryRedactability;
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
  // A UUID is an opaque identifier, not a device serial number.
  raw_uuid_pattern: "raw_identifier",
  raw_bearer_token_pattern: "api_or_session_token",
  raw_api_key_pattern: "api_or_session_token",
};

// Every shared pattern is a fixed-shape value, so its extent is precise.
const SHARED_PATTERN_REDACTABILITY: HardBoundaryRedactability = "precise";

const TARGETED_HARD_BOUNDARY_DETECTORS: readonly HardBoundaryDetector[] = [
  // --- key material -------------------------------------------------------
  {
    category: "ca_private_key",
    patternCode: "ca_private_key_block",
    redactability: "unbounded",
    regex:
      /-----BEGIN[ \t]+CA[ \t]+PRIVATE[ \t]+KEY-----[\s\S]*?(?:-----END[ \t]+CA[ \t]+PRIVATE[ \t]+KEY-----|$)|\bcertificate[\s_-]?authority\b[^\n]{0,60}\bprivate[\s_-]?key\b/giu,
  },
  {
    // Case-insensitive, tab tolerant, CRLF tolerant.
    category: "private_key",
    patternCode: "pem_private_key_block",
    redactability: "unbounded",
    regex:
      /-----BEGIN[A-Za-z0-9 \t]*PRIVATE[ \t]+KEY(?:[ \t]+BLOCK)?-----[\s\S]*?(?:-----END[A-Za-z0-9 \t]*PRIVATE[ \t]+KEY(?:[ \t]+BLOCK)?-----|$)/giu,
  },
  {
    category: "private_key",
    patternCode: "putty_private_key_file",
    redactability: "unbounded",
    regex: /\bPuTTY-User-Key-File(?:-\d+)?\b[^\n]*/giu,
  },
  // --- keyword-introduced secrets (extent = rest of the logical value) ----
  {
    // The value runs to the end of the line (or to the closing quote): a
    // passphrase may contain spaces, so stopping at the first whitespace
    // would release its tail. `\s*` after the separator still spans a
    // newline so YAML-style `password:\n  value` keeps being detected.
    category: "password",
    patternCode: "password_assignment",
    redactability: "unbounded",
    regex:
      /\b(?:password|passwd|passphrase|pwd)\b\s*[:=]\s*(?:["'][^"'\n]*["']|[^\n]+)/giu,
  },
  {
    category: "api_or_session_token",
    patternCode: "credential_assignment",
    redactability: "unbounded",
    regex:
      /\b(?:sess(?:ion)?[-_]?(?:id|token)|(?:access|refresh|id|auth|bearer)[-_]?token|token|api[-_]?keys?|apikey|client[-_]?secret|secret[-_]?(?:access[-_]?)?key|secret|credentials?|passcode)\b\s*[:=]\s*(?:["'][^"'\n]*["']|[^\n]+)/giu,
  },
  {
    category: "api_or_session_token",
    patternCode: "authorization_header",
    redactability: "precise",
    regex:
      /\bAuthorization\s*:\s*(?:Basic|Bearer|Digest|Token|ApiKey|AWS4-HMAC-SHA256)[ \t]+[^\s"',;]+/giu,
  },
  {
    category: "api_or_session_token",
    patternCode: "cookie_header",
    redactability: "unbounded",
    regex: /\b(?:Set-)?Cookie\s*:\s*[^\n]+/giu,
  },
  {
    category: "api_or_session_token",
    patternCode: "session_cookie_value",
    redactability: "precise",
    regex:
      /\b(?:JSESSIONID|PHPSESSID|ASP\.NET_SessionId|connect\.sid|sessionid|session_id)\s*=\s*[^\s;"']{6,}/giu,
  },
  // --- fixed-shape tokens -------------------------------------------------
  {
    category: "api_or_session_token",
    patternCode: "jwt_compact_token",
    redactability: "precise",
    regex: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}/gu,
  },
  {
    category: "api_or_session_token",
    patternCode: "vendor_api_key",
    redactability: "precise",
    regex:
      /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{8,}|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\b(?:AKIA|ASIA|AROA|AIDA|AIPA|ANPA|ANVA|ABIA|ACCA|AGPA)[0-9A-Z]{16}\b|\bxox[baprse]-[A-Za-z0-9-]{10,}|\bglpat-[A-Za-z0-9_-]{16,}/gu,
  },
  // --- connection strings -------------------------------------------------
  {
    category: "connection_string",
    patternCode: "database_connection_string",
    redactability: "precise",
    regex:
      /\b(?:mysql|mariadb|postgres(?:ql)?|mongodb|redis|rediss|amqps?|mssql|sqlserver|clickhouse|cassandra|couchbase|elasticsearch|snowflake|trino|presto|databricks|oracle|db2|cockroachdb|neo4j|influxdb)(?:\+[a-z0-9_.]+)?:\/\/[^\s"']+/giu,
  },
  {
    // Any `<scheme>://user:password@host` shape, whatever the vendor.
    category: "connection_string",
    patternCode: "credentialed_url",
    redactability: "precise",
    regex: /\b[a-z][a-z0-9+.\-]*:\/\/[^\s:@/"']+:[^\s@/"']+@[^\s"']+/giu,
  },
  {
    // Vendor-specific JDBC shapes, including `jdbc:oracle:thin:user/pw@host`
    // which carries no `//`.
    category: "connection_string",
    patternCode: "jdbc_connection_string",
    redactability: "precise",
    regex: /\bjdbc:[a-z0-9]+:[^\s"']+/giu,
  },
  {
    category: "connection_string",
    patternCode: "file_backed_connection_string",
    redactability: "precise",
    regex:
      /\bsqlite3?:(?:\/\/)?\/[^\s"']+|\bfile:\/{2,}[^\s"']*\.(?:db|sqlite3?)\b/giu,
  },
  // --- identity / serial / identifier ------------------------------------
  {
    category: "raw_serial_number",
    patternCode: "serial_number_assignment",
    redactability: "precise",
    regex:
      /\bserial(?:[-_\s]?(?:number|no\.?|nr\.?))?\s*[:#=]\s*["']?[A-Z0-9][A-Z0-9-]{5,}/giu,
  },
  {
    // Abbreviated serial context without the literal word "serial". Kept
    // case-sensitive so prose "sn" does not match.
    category: "raw_serial_number",
    patternCode: "serial_number_abbreviated",
    redactability: "precise",
    regex: /\b(?:S\/N|SN)[ \t]*[:#=]?[ \t]*[A-Z0-9]{6,}(?:-[A-Z0-9]+)*\b/gu,
  },
  {
    // Any UUID/GUID version (the shared pattern only accepts versions 1-5,
    // so UUIDv6/v7/v8 slipped through).
    category: "raw_identifier",
    patternCode: "raw_uuid_any_version",
    redactability: "precise",
    regex:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu,
  },
  {
    // IPv6, both the expanded and the `::`-compressed form. At least four
    // groups are required so clock strings like 10:30:45 do not match.
    category: "unauthorized_identity_data",
    patternCode: "raw_ipv6_pattern",
    redactability: "precise",
    regex:
      /\b(?:[0-9A-Fa-f]{1,4}:){3,7}[0-9A-Fa-f]{1,4}\b|\b[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*::(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?/gu,
  },
  // --- markers (never redactable) ----------------------------------------
  {
    category: "local_only_marker",
    patternCode: "local_only_marker",
    redactability: "non_redactable",
    regex: /\[\[LOCAL[-_]?ONLY\]\]|\bLOCAL[-_]ONLY\b/giu,
  },
  {
    category: "unauthorized_material",
    patternCode: "unauthorized_material_marker",
    redactability: "non_redactable",
    regex:
      /\bDO NOT (?:DISTRIBUTE|SHARE|FORWARD|COPY)\b|\bUNAUTHORI[SZ]ED[\s_-]MATERIAL\b|\bINTERNAL USE ONLY\b|\bNOT FOR (?:DISTRIBUTION|RELEASE|EXTERNAL USE)\b/giu,
  },
];

// Known residual detection gaps (deliberately NOT claimed as covered):
//  - a headerless PEM body (base64 only, no BEGIN line) is indistinguishable
//    from other base64 payloads and is not detected;
//  - a bare 40-character AWS secret access key with no surrounding keyword;
//  - generic high-entropy tokens with no keyword, vendor prefix, or JWT shape
//    (for example a raw 32-byte hex API key on its own);
//  - passwords introduced in a natural-language sentence without a `:`/`=`
//    separator ("the password is hunter2");
//  - non-Latin / non-English marker wording (only the English marker phrases
//    listed above are matched);
//  - identity data beyond email / phone / IPv4 / IPv6 (postal addresses,
//    national ID numbers, bank accounts);
//  - a secret split across candidates is handled by the combined re-scan in
//    failure-modes.ts, not by these per-value detectors.

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
        redactability: SHARED_PATTERN_REDACTABILITY,
        regex: pattern.regex,
      }),
    ),
  ]);

export type HardBoundaryHit = Readonly<{
  category: HardBoundaryCategory;
  patternCode: string;
  redactability: HardBoundaryRedactability;
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
          redactability: detector.redactability,
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

/**
 * The read view the evaluation pipeline consumes. Derived from
 * `caioContextSourceDescriptorSchema` with `Pick` so it can never drift from
 * the wire contract: adding, renaming, or retyping a field there changes this
 * type too. `localOnly` is part of the view because the pipeline ENFORCES it
 * (see `assessSourceStructuralBoundaries`).
 */
export type ContextSourceDescriptor = Readonly<
  Pick<
    CaioContextSourceDescriptor,
    "sourceProject" | "sourceRef" | "classification" | "localOnly"
  >
>;

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
  // Rule patterns only ever match on these three fields; `localOnly` is not a
  // rule input because no enterprise rule may relax it.
  source: Pick<
    ContextSourceDescriptor,
    "sourceProject" | "sourceRef" | "classification"
  >,
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
