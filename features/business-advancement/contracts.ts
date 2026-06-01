/**
 * Helm Business Advancement — Phase 1A Planning Contracts
 *
 * These are conceptual planning contracts only. They are NOT Prisma schemas,
 * API contracts, queue implementations, or execution authorities.
 *
 * Allowed: type definitions, pure helpers, offline eval.
 * Forbidden: schema, API route, runtime extractor, event queue, official write,
 *            auto execution, auto send, auto approve, auto settlement,
 *            cross-tenant aggregation, LLM final ranking.
 */

// ---------------------------------------------------------------------------
// Primitive enumerations
// ---------------------------------------------------------------------------

export type ReviewPosture =
  | "read_only"
  | "review_required"
  | "human_owner_required"
  | "blocked";

export type SignalType =
  | "overdue_commitment"
  | "blocked_decision"
  | "stalled_opportunity"
  | "stalled_case"
  | "resource_evidence_gap"
  | "repeated_intent"
  | "customer_waiting"
  | "kpi_anomaly"
  | "boundary_hit"
  | "abandoned_high_confidence_answer";

export type SourceType =
  | "meeting"
  | "crm"
  | "tenant_resource"
  | "report"
  | "email"
  | "ask_helm"
  | "user_behavior"
  | "combined";

export type RiskLevel = "low" | "medium" | "high";

export type EvidenceConfidence = "low" | "medium" | "high";

/**
 * Ranking strategy must always be deterministic.
 * LLM may generate explanation text but must NOT determine final ranking order.
 */
export type RankingStrategy = "deterministic";

/**
 * Only safe, human-gated action verbs are allowed in primaryAction.
 * Auto-execution, official write, auto-send, auto-approve are forbidden.
 */
export type AllowedActionVerb =
  | "view"
  | "prepare"
  | "review"
  | "assign"
  | "confirm"
  | "explain"
  | "open";

// ---------------------------------------------------------------------------
// Object reference
// ---------------------------------------------------------------------------

export interface ObjectRef {
  objectType: string;
  objectId: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Core planning objects
// ---------------------------------------------------------------------------

/**
 * AdvancementSignal — represents an operational signal that may require
 * business advancement. This is a planning concept, not a task or commitment.
 *
 * NOT: a task, a commitment, an approval, an execution authority.
 */
export interface AdvancementSignal {
  readonly signalId: string;
  readonly sourceType: SourceType;
  readonly signalType: SignalType;
  readonly objectRef: ObjectRef;
  readonly evidenceRefs: readonly string[];
  readonly sourceScenario: string;
  /** ISO 8601 timestamp — planning only, not persisted */
  readonly detectedAt: string;
}

/**
 * AdvancementJudgement — human-reviewable assessment of a signal.
 *
 * NOT: a fact ruling, a decision, an approval, an execution authority.
 * The rankingStrategy must always be "deterministic" — LLM may not determine
 * final ranking.
 */
export interface AdvancementJudgement {
  readonly signalId: string;
  readonly reviewPosture: ReviewPosture;
  readonly boundaryNote: string;
  readonly evidenceSummary: string;
  readonly confidence: EvidenceConfidence;
  /** Must always be "deterministic" — LLM generates explanation only */
  readonly rankingStrategy: RankingStrategy;
  readonly riskLevel: RiskLevel;
}

/**
 * OwnerSuggestion — non-binding hint about who should pick up a Must Push item.
 *
 * NOT: an authoritative assignment, an approved owner change, an auto-write
 * to CRM ownership fields. Always paired with review_required or
 * human_owner_required posture; reviewer remains the source of truth.
 */
export interface OwnerSuggestion {
  /** Suggested owner role — e.g. "客户负责人", "审批负责人", "试点负责人". */
  readonly role: string;
  /** Why this role was suggested, derived deterministically from the signal. */
  readonly rationale: string;
}

/**
 * MustPushItem — planning shape for a prioritised advancement item.
 *
 * NOT: an external commitment, an approved action, an auto-executed item.
 * Max 3–5 items should be surfaced at any time.
 * Sorting is deterministic: riskLevel > dueAt > customerWaiting >
 * blockedDecision > revenueImpact > evidenceConfidence > reviewRequired > updatedAt.
 *
 * Per P0-REQ-02 each item must carry: evidenceRefs, reason, primaryAction
 * (next step), ownerSuggestion (owner suggestion), boundaryNote, reviewPosture,
 * and riskLevel (risk class). ownerSuggestion is optional in the planning shape
 * so existing planning candidates remain compatible; the planning adapter
 * pipeline guarantees it for any item surfaced as Must Push (3-5 list).
 */
export interface MustPushItem {
  readonly itemId: string;
  readonly title: string;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly primaryAction: string;
  readonly boundaryNote: string;
  readonly reviewPosture: ReviewPosture;
  readonly sourceSummary: string;
  readonly riskLevel: RiskLevel;
  /** Deterministic sort key — lower is higher priority */
  readonly sortKey: number;
  /** Optional owner-role suggestion. Required for planning-adapter output. */
  readonly ownerSuggestion?: OwnerSuggestion;
}

/**
 * BlockedActionType — categorical class of action that the human reviewer must
 * gate. Used by ReviewRequiredAction to make the gated action machine-readable
 * and customer-explainable, distinct from the safe verb in `actionType`.
 *
 * NOT: a list of authorities Helm can execute. Each value names what the
 * reviewer must explicitly approve before any external effect occurs.
 */
export type BlockedActionType =
  | "official_write"
  | "outbound_send"
  | "approval_commit"
  | "settlement_commit"
  | "ownership_change"
  | "policy_exception";

/**
 * ReviewRequiredAction — planning shape for actions requiring human review.
 *
 * NOT: an already-approved action, an auto-executed item.
 * actionType must be one of the safe AllowedActionVerb values.
 *
 * Per P0-REQ-04 each ReviewRequiredAction must include:
 *   - required reviewer role (`requiredReviewerRole`)
 *   - reason (`reason`)
 *   - evidence (`evidenceRefs`)
 *   - blocked action type (`blockedActionType`)
 *   - escalation path (`escalationPath`)
 *
 * Newer fields are optional only so existing planning code that does not yet
 * construct ReviewRequiredAction literals keeps compiling; planning-adapter
 * pipelines that do construct them must populate every field, asserted in
 * `must-push-adapter.test.ts`.
 */
export interface ReviewRequiredAction {
  readonly actionId: string;
  readonly linkedSignalId: string;
  readonly actionType: AllowedActionVerb;
  readonly description: string;
  readonly ownerRequired: boolean;
  readonly boundaryNote: string;
  /** review_required, human_owner_required, or blocked — never read_only */
  readonly reviewPosture: Exclude<ReviewPosture, "read_only">;
  /** Reviewer role required to act on this packet (P0-REQ-04). */
  readonly requiredReviewerRole?: string;
  /** Why the action is gated, separate from the description of what to do. */
  readonly reason?: string;
  /** Evidence refs that support the gated action. */
  readonly evidenceRefs?: readonly string[];
  /** The class of action being blocked from auto-execution. */
  readonly blockedActionType?: BlockedActionType;
  /** Ordered escalation chain of reviewer roles, from primary to fallback. */
  readonly escalationPath?: readonly string[];
}

// ---------------------------------------------------------------------------
// Fixture contract (for offline eval only)
// ---------------------------------------------------------------------------

/**
 * AdvancementSignalFixture — machine-readable sample for Phase 1A offline eval.
 *
 * These are synthetic, non-sensitive planning samples. They must NOT contain
 * real customer data or production object IDs.
 */
export interface AdvancementSignalFixture {
  readonly fixtureId: string;
  readonly sourceType: SourceType;
  readonly sourceScenario: string;
  readonly signalType: SignalType;
  readonly objectRef: ObjectRef;
  readonly evidenceRefs: readonly string[];
  readonly expectedReviewPosture: ReviewPosture;
  readonly expectedBoundaryNote: string;
  readonly expectedMustPushTitle: string;
  readonly expectedPrimaryAction: string;
  readonly expectedRejectedBehaviors: readonly string[];
}

// ---------------------------------------------------------------------------
// Boundary enforcement helpers (pure, no side effects)
// ---------------------------------------------------------------------------

/** Forbidden terms that must NOT appear in any expectedPrimaryAction. */
export const FORBIDDEN_ACTION_TERMS = [
  "auto_execute",
  "auto execute",
  "official_write",
  "official write",
  "auto_send",
  "auto send",
  "auto_approve",
  "auto approve",
  "auto_settlement",
  "auto settlement",
  "cross_tenant",
  "cross-tenant",
  "llm_rank",
  "llm rank",
  "auto_mark",
  "auto mark",
  "auto_update",
  "auto update",
  "auto_merge",
  "auto merge",
] as const;

/** Boundary categories that must be covered across the full fixture set. */
export const REQUIRED_BOUNDARY_CATEGORIES = [
  "recommendation",
  "commitment",
  "draft",
  "send",
  "explanation",
  "approval",
  "proof",
] as const;

/** Source types that must be covered by the fixture set. */
export const REQUIRED_SOURCE_COVERAGE: readonly SourceType[] = [
  "meeting",
  "crm",
  "tenant_resource",
  "ask_helm",
] as const;

/**
 * Returns true if the given reviewPosture is a governance-gated posture
 * (i.e. not read_only, meaning human oversight is explicitly required).
 */
export function isGovernanceGated(posture: ReviewPosture): boolean {
  return posture !== "read_only";
}

/**
 * Returns true if the given primaryAction string contains any forbidden term.
 * Used by offline eval to assert no fixture grants forbidden authority.
 */
export function containsForbiddenActionTerm(action: string): boolean {
  const lower = action.toLowerCase();
  return FORBIDDEN_ACTION_TERMS.some((term) => lower.includes(term));
}
