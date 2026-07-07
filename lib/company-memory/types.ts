// ---------------------------------------------------------------------------
// Company Memory Layer — public-safe contract types (contract-only slice).
//
// This module defines the governed-knowledge object model that lets AI
// judgement, supervision, and task generation cite ORGANIZATIONAL knowledge
// (sources, cards, rules, workflow patterns, decision memory, receipt-derived
// knowledge) instead of loose documents. It is deliberately distinct from
// `lib/memory/*`, which is the workspace meeting-memory runtime (facts /
// commitments / blockers extraction pipeline backed by the database). This
// contract is pure: types + enums only, no IO, no persistence, no runtime
// authority. Whether any knowledge may back automation is decided by the
// fail-closed pure functions in `lib/company-memory/governance.ts`.
//
// Two independent axes govern every knowledge card:
//   - reviewStatus: what the owner-facing governance state machine says about
//     the CONTENT (discovered -> candidate -> pending_review -> approved ...).
//   - usableLevel: what AI is allowed to DO with it (L0 archive-only up to
//     L5 active-reference). Approval of content never implies automation.
// ---------------------------------------------------------------------------

import { RECEIPT_OUTCOMES, type ReceiptOutcome } from "../receipts/receipt-outcome";

export const KNOWLEDGE_SOURCE_TYPES = [
  "document",
  "meeting",
  "chat",
  "system_schema",
  "policy",
  "receipt",
  "manual_input",
  "external_product_doc",
] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const SENSITIVITY_LEVELS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;

export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

// Closed set of declared uses. Anything outside this set — including future
// values added before the contract learns about them — MUST map to L0
// (fail closed), never to the nearest plausible level.
export const ALLOWED_USES = [
  "search",
  "advice",
  "task_generation",
  "shadow",
  "active_reference",
] as const;

export type AllowedUse = (typeof ALLOWED_USES)[number];

export const KNOWLEDGE_REVIEW_STATUSES = [
  "discovered",
  "candidate",
  "pending_review",
  "approved",
  "needs_review",
  "rejected",
  "expired",
  "frozen",
  "conflict_detected",
  "retired",
] as const;

export type KnowledgeReviewStatus = (typeof KNOWLEDGE_REVIEW_STATUSES)[number];

// L0 archive-only, L1 searchable, L2 advice-support, L3 work-packet-draft,
// L4 shadow-reference, L5 active-reference. Order is authoritative: a later
// entry strictly dominates every earlier entry.
export const KNOWLEDGE_USABLE_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;

export type KnowledgeUsableLevel = (typeof KNOWLEDGE_USABLE_LEVELS)[number];

export const KNOWLEDGE_TYPES = [
  "fact",
  "rule",
  "sop",
  "metric",
  "role",
  "workflow",
  "case",
  "decision",
  "exception",
  "data_dictionary",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

// Confidence is a SORTING / SAMPLING / review-priority hint only. It can
// never substitute for owner review and never raises a usable level; the
// governance functions ignore it when deriving levels, by design.
export const KNOWLEDGE_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export type KnowledgeConfidence = (typeof KNOWLEDGE_CONFIDENCE_LEVELS)[number];

export type KnowledgeFreshnessPolicy = {
  // How often the owner must re-confirm the knowledge, in days. null = no
  // periodic review commitment (the card can still expire via expiresAt).
  reviewEveryDays: number | null;
  // ISO timestamp after which the source content is no longer trustworthy.
  expiresAt: string | null;
};

export type KnowledgeSource = {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  // Opaque tenant reference. null / empty means the source is not tenant
  // scoped, which fails closed everywhere.
  tenantRef: string | null;
  // Business or maintenance owner. null / empty fails closed.
  ownerRef: string | null;
  // Reference to the raw origin. The contract stores references, never
  // sensitive source bodies.
  originRef: string;
  // Authorization / notice / compliance basis reference, if any.
  legalBasisRef: string | null;
  sensitivityLevel: SensitivityLevel;
  // Declared uses. Typed as plain strings on purpose: real-world data will
  // contain values outside ALLOWED_USES, and the validator must treat those
  // as L0 rather than trusting the type system to have excluded them.
  allowedUse: readonly string[];
  freshnessPolicy: KnowledgeFreshnessPolicy | null;
  // Retention / deletion rule reference.
  retentionPolicyRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeCard = {
  cardId: string;
  tenantRef: string | null;
  sourceRefs: readonly string[];
  knowledgeType: KnowledgeType;
  title: string;
  summary: string;
  // Type-specific structured fields. Kept opaque at the contract layer.
  structuredPayload: Record<string, unknown> | null;
  // Scope tags (industry / store / department / system / role / time range
  // references). Empty scope blocks task-generation and above.
  applicableScope: readonly string[];
  ownerRef: string | null;
  reviewStatus: KnowledgeReviewStatus;
  usableLevel: KnowledgeUsableLevel;
  confidence: KnowledgeConfidence;
  evidenceRefs: readonly string[];
  // Known conflicting knowledge. Non-empty means the card cannot back
  // high-risk decisions until the owner resolves the conflict.
  contradictionRefs: readonly string[];
  expiryAt: string | null;
  version: number;
};

export const POLICY_RULE_TYPES = [
  "approval_boundary",
  "forbidden_action",
  "compliance_rule",
  "escalation_rule",
  "data_boundary",
] as const;

export type PolicyRuleType = (typeof POLICY_RULE_TYPES)[number];

export const POLICY_REQUIRED_GATES = [
  "none",
  "human_owner_approval",
  "dual_owner_approval",
] as const;

export type PolicyRequiredGate = (typeof POLICY_REQUIRED_GATES)[number];

export type PolicyRule = {
  ruleId: string;
  tenantRef: string | null;
  ownerRef: string | null;
  ruleType: PolicyRuleType;
  // Structured condition placeholder (v1 does not define an expression
  // language; implementations must converge on a controlled schema).
  condition: Record<string, unknown>;
  requiredGate: PolicyRequiredGate;
  // What the agent may do when the rule matches, e.g. "recommend_only".
  allowedAgentAction: string;
  // What the agent must never do, e.g. "commit_to_customer".
  forbiddenAgentAction: string | null;
  reviewStatus: KnowledgeReviewStatus;
};

export type WorkflowPattern = {
  patternId: string;
  tenantRef: string | null;
  ownerRef: string | null;
  triggerConditions: readonly string[];
  inputRequirements: readonly string[];
  steps: readonly string[];
  requiredRoles: readonly string[];
  acceptanceCriteria: readonly string[];
  // Who / what to escalate to when the pattern stalls or expires.
  expiryOrEscalation: string | null;
  riskBoundaries: readonly string[];
  workPacketTemplateRef: string | null;
  receiptTemplateRef: string | null;
  reviewStatus: KnowledgeReviewStatus;
};

export type DecisionMemory = {
  decisionMemoryId: string;
  tenantRef: string | null;
  question: string;
  options: readonly string[];
  adoptedOption: string;
  rationale: string;
  ownerRef: string | null;
  effectiveScope: readonly string[];
  reviewAt: string | null;
  // Whether AI may cite this decision at all.
  aiReferenceAllowed: boolean;
  // Whether this decision may feed cross-tenant abstraction candidates.
  abstractionCandidateAllowed: boolean;
};

export const RECEIPT_DERIVED_KNOWLEDGE_KINDS = [
  "verified_fact",
  "rejected_reason",
  "failed_execution",
  "pattern_candidate",
] as const;

export type ReceiptDerivedKnowledgeKind =
  (typeof RECEIPT_DERIVED_KNOWLEDGE_KINDS)[number];

export type ReceiptDerivedKnowledge = {
  id: string;
  tenantRef: string | null;
  kind: ReceiptDerivedKnowledgeKind;
  receiptRefs: readonly string[];
  // Knowledge card this evidence supports or challenges, if known.
  relatedCardRef: string | null;
  summary: string;
  // Only independently verified receipts count toward level upgrades;
  // self-reported outcomes stay candidates forever.
  verified: boolean;
};

// Receipt evidence shape consumed by the governance functions. The outcome
// taxonomy is shared with the decision/supervision contract (owner decision
// 2026-07-07: one receipt-outcome enum across both contracts).
export const KNOWLEDGE_RECEIPT_OUTCOMES = RECEIPT_OUTCOMES;

export type KnowledgeReceiptOutcome = ReceiptOutcome;

export type KnowledgeReceiptEvidence = {
  receiptRef: string;
  outcome: KnowledgeReceiptOutcome;
};
