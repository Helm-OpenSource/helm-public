// Cross-System Accountability Gap MVP v0.1 — public-safe contracts.
// Spec: docs/product/HELM_CROSS_SYSTEM_ACCOUNTABILITY_GAP_MVP.md
//
// Boundary: read-only, advice-only detection. Nothing here may auto-create a record,
// dispatch, chase, write back to a source system, send externally, or approve. All data
// is synthetic / public-safe. Detection is deterministic, not AI-synthesised.

export const FORBIDDEN_ACTIONS = [
  "auto_create_record",
  "auto_dispatch",
  "auto_chase",
  "auto_write_source",
  "external_send",
  "approval",
] as const;
export type ForbiddenAction = (typeof FORBIDDEN_ACTIONS)[number];

// Reused from the expert-capability feedback loop: corrections refine rules/coverage.
export const CORRECTION_REASON_CODES = [
  "evidence_missing",
  "evidence_wrong",
  "disposition_wrong",
  "boundary_violation",
  "scope_wrong",
  "owner_reviewer_wrong",
  "stale_signal",
  "duplicate_or_conflict",
  "coverage_incomplete",
  "other_requires_schema_review",
] as const;
export type CorrectionReasonCode = (typeof CORRECTION_REASON_CODES)[number];

export type Verdict = "missing" | "unknown";
export type Completeness = "complete" | "partial" | "unknown";

// Coverage must be proven per (system, scope) — proving a CRM *contacts* export complete
// does not prove the CRM *deals* closed world. Systems alone are insufficient.
export type CoverageRequirement = { system: string; scope: string };

export type ExpectationRule = {
  ruleId: string;
  version: string;
  description: string;
  trigger: { system: string; entity: string; condition: string };
  expectation: { system: string; entity: string; withinDays: number; matchKey: string };
  requiredCoverage: CoverageRequirement[]; // (system, scope) pairs that must be complete, else unknown
  ownerPolicyRef: string;
  commitmentClass: "advice";
  effectMode: "read_only";
  forbiddenActions: ForbiddenAction[];
};

export type CoverageAssertion = {
  assertionId: string;
  system: string;
  scope: string;
  windowStart: string;
  windowEnd: string;
  method: "full_export" | "webhook_plus_backfill" | "paginated_complete";
  completeness: Completeness;
  evidence: string[];
  asOf: string;
};

// A public-safe record projected from a source system (no raw PII; aliased identifiers).
export type SourceFact = {
  system: string;
  entity: string;
  factId: string;
  matchValue: string; // value of the rule.expectation.matchKey (e.g. aliased deal id)
  occurredAt: string;
  ownerCandidates?: OwnerCandidate[];
};

export type OwnerCandidateKind = "user" | "group" | "default_admin" | "bot";
export type OwnerCandidate = {
  id: string; // public-safe alias
  kind: OwnerCandidateKind;
  active: boolean; // false => departed / disabled
  roleEvidence?: string[]; // deterministic role-assignment evidence
};

export type EffectiveOwnerPolicy = {
  policyRef: string;
  escalationRoleRef: string; // deterministic fallback target when no accountable user resolves
};

export type EffectiveOwner = {
  resolved: boolean;
  ownerId?: string;
  evidence?: string[];
  excluded: { group: boolean; defaultAdmin: boolean; bot: boolean; departed: boolean };
  fallback?: "escalation_role";
  escalationRoleRef?: string;
  unresolvableReason?: string;
};

export type ReviewState = "proposed" | "accepted" | "rejected" | "deferred";

export type MissingRecordDecisionRequest = {
  requestId: string;
  ruleId: string;
  ruleVersion: string;
  triggerRef: string;
  verdict: Verdict;
  coverageAssertionRefs: string[];
  effectiveOwner: EffectiveOwner;
  evidenceRefs: string[];
  crossSystemDependency: number;
  commitmentClass: "advice";
  reviewState: ReviewState;
  humanReviewerRequired: true;
  boundaryNote: string;
};

export type LedgerDecision = "accepted" | "rejected" | "deferred";

export type AccountabilityLedgerEntry = {
  entryId: string;
  prevEntryHash: string;
  contentHash: string;
  requestId: string;
  decision: LedgerDecision;
  reviewerId: string;
  reasonCode: CorrectionReasonCode;
  falsePositive: boolean;
  at: string;
};

export const LEDGER_GENESIS_HASH = "sha256:genesis";
