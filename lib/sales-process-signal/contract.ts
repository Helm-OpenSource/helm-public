/**
 * Sales Process Signal — alias-only runtime contract (v1).
 *
 * Runtime counterpart of the public-safe `SalesProcessSignal` object defined
 * in docs/product/HELM_PUBLIC_BUSINESS_NARRATIVE_REQUIREMENTS.md §3.2 and the
 * synthetic Trust Center / AI Shelf fixture. A signal carries a short
 * alias-only statement plus evidence REFERENCES; raw audio, transcripts,
 * verbatim long text, real person names, and customer-private payloads never
 * enter a signal. All signals are review_required — they feed the existing
 * review candidate gates and never auto-promote, auto-send, or write back.
 */

export const SALES_PROCESS_SIGNAL_CONTRACT_VERSION =
  "sales-process-signal/v1" as const;

/** Closed set from the public narrative contract §3.2. */
export const SALES_PROCESS_SIGNAL_TYPES = [
  "commitment",
  "objection",
  "need_candidate",
  "risk_signal",
  "deal_outcome_reason",
  "follow_up_window",
] as const;

export type SalesProcessSignalType =
  (typeof SALES_PROCESS_SIGNAL_TYPES)[number];

/** Statements above this length smell like verbatim transcript, not a signal. */
export const SALES_PROCESS_STATEMENT_MAX_LENGTH = 280;

export interface SalesProcessSignalAliases {
  /** Alias only — never a real person name. */
  readonly seller?: string;
  /** Alias only — never a real person or customer name. */
  readonly buyer?: string;
  /** Alias only — never a real workspace/tenant name. */
  readonly workspace: string;
}

export interface SalesProcessSignal {
  readonly contractVersion: typeof SALES_PROCESS_SIGNAL_CONTRACT_VERSION;
  readonly signalId: string;
  readonly signalType: SalesProcessSignalType;
  /** Short alias-only statement; never verbatim transcript text. */
  readonly statement: string;
  readonly sourceKind: "conversation_insight" | "meeting_memory_draft";
  /** Stable reference to the source object, e.g. "conversation_insight:<id>". */
  readonly sourceRef: string;
  /** References into evidence (segment refs, meeting refs) — refs, not text. */
  readonly evidenceRefs: readonly string[];
  readonly aliases: SalesProcessSignalAliases;
  /** 0-100. */
  readonly confidence: number;
  readonly followUpWindowDays?: number;
  readonly reviewPosture: "review_required";
  readonly dataShape: "alias_only";
  readonly rawPayloadIncluded: false;
  readonly transcriptIncluded: false;
  readonly audioIncluded: false;
}

export type SalesProcessSignalHygieneViolation =
  | "statement_too_long_smells_verbatim"
  | "statement_contains_email"
  | "statement_contains_phone_number"
  | "statement_contains_url"
  | "statement_empty"
  | "workspace_alias_missing"
  | "confidence_out_of_range";

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_PATTERN = /(?:\+?\d[\s-]?){7,}/;
const URL_PATTERN = /https?:\/\//i;

/**
 * Fail-closed hygiene audit. A signal with any violation must not be emitted;
 * callers route the underlying source back to human review instead.
 */
export function auditSalesProcessSignalHygiene(
  signal: SalesProcessSignal,
): readonly SalesProcessSignalHygieneViolation[] {
  const violations: SalesProcessSignalHygieneViolation[] = [];
  const statement = signal.statement.trim();

  if (statement.length === 0) {
    violations.push("statement_empty");
  }
  if (statement.length > SALES_PROCESS_STATEMENT_MAX_LENGTH) {
    violations.push("statement_too_long_smells_verbatim");
  }
  if (EMAIL_PATTERN.test(statement)) {
    violations.push("statement_contains_email");
  }
  if (PHONE_PATTERN.test(statement)) {
    violations.push("statement_contains_phone_number");
  }
  if (URL_PATTERN.test(statement)) {
    violations.push("statement_contains_url");
  }
  if (signal.aliases.workspace.trim().length === 0) {
    violations.push("workspace_alias_missing");
  }
  if (
    !Number.isFinite(signal.confidence) ||
    signal.confidence < 0 ||
    signal.confidence > 100
  ) {
    violations.push("confidence_out_of_range");
  }
  return violations;
}
