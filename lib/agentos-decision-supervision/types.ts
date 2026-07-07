// ---------------------------------------------------------------------------
// AgentOS Decision and Supervision Layer — public-safe contract types
// (contract-only slice).
//
// This module turns "the AI judged something" into auditable objects: a
// DecisionObject that must cite knowledge / evidence / policy / receipts, a
// SupervisionSignal that separates fact from interpretation from suggestion,
// ControlGates that stand between judgement and real-world effect, and
// Intervention / Escalation / DecisionEvaluation objects that keep every
// outcome — including rejections and failures — flowing back as learnable
// structure.
//
// It is deliberately placed in its own directory rather than folded into
// `lib/policies/*`: the policy engine owns per-action approval enforcement
// at runtime, while this contract is the domain-neutral decision/supervision
// object model that runtimes and gates will later project onto. Pure types
// only: no IO, no persistence, no runtime authority, no vertical-specific
// field names. Nothing here authorizes outbound sends, commitments, or
// high-risk writes; the most an object in this file can express is a
// suggestion, a draft, a review gate, or a downgrade/freeze candidate.
// ---------------------------------------------------------------------------

import { RECEIPT_OUTCOMES, type ReceiptOutcome } from "../receipts/receipt-outcome";

export const DECISION_TYPES = [
  "diagnosis",
  "prioritization",
  "routing",
  "intervention",
  "escalation",
  "promotion",
  "defer",
  "reject",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export type DecisionRiskLevel = (typeof DECISION_RISK_LEVELS)[number];

// How far the decision is allowed to act, ordered from most to least
// restrained. `active_candidate` only means "may be SUBMITTED to the
// automation governor for evaluation" — it never means the single decision
// is active.
export const DECISION_ACTION_LEVELS = [
  "observe",
  "recommend",
  "draft_task",
  "shadow",
  "active_candidate",
] as const;

export type DecisionActionLevel = (typeof DECISION_ACTION_LEVELS)[number];

export const OWNER_GATE_LEVELS = [
  "none",
  "review_required",
  "approval_required",
  "dual_approval_required",
] as const;

export type OwnerGateLevel = (typeof OWNER_GATE_LEVELS)[number];

// Confidence is descriptive, never an authorization: confidence=high cannot
// bypass any gate.
export const DECISION_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export type DecisionConfidence = (typeof DECISION_CONFIDENCE_LEVELS)[number];

export type DecisionObject = {
  decisionId: string;
  tenantRef: string | null;
  decisionType: DecisionType;
  businessQuestion: string;
  // Scoping key for the automation governor: automation is promoted per
  // problem category / scene, never globally.
  problemCategoryRef: string | null;
  contextRefs: readonly string[];
  // Governed knowledge citations (usable-level semantics live in the
  // company-memory contract).
  knowledgeRefs: readonly string[];
  // Data / events / signals that triggered the judgement.
  evidenceRefs: readonly string[];
  // Rules that constrain what the agent may do.
  policyRefs: readonly string[];
  // Historical verification results.
  receiptRefs: readonly string[];
  alternatives: readonly string[];
  recommendedOption: string | null;
  confidence: DecisionConfidence;
  riskLevel: DecisionRiskLevel;
  allowedActionLevel: DecisionActionLevel;
  ownerGate: OwnerGateLevel;
  expiryOrReviewAt: string | null;
  // How to withdraw / downgrade / recover if the judgement is wrong.
  rollbackPath: string | null;
};

export const SUPERVISION_SIGNAL_TYPES = [
  "anomaly",
  "drift",
  "stuck_work",
  "stale_knowledge",
  "policy_risk",
  "receipt_gap",
  "conversion_drop",
  "compliance_risk",
  "opportunity",
] as const;

export type SupervisionSignalType = (typeof SUPERVISION_SIGNAL_TYPES)[number];

export const SUPERVISION_SEVERITIES = ["info", "watch", "warning", "critical"] as const;

export type SupervisionSeverity = (typeof SUPERVISION_SEVERITIES)[number];

// The ONLY routes a supervision signal may recommend. Every route resolves
// to a suggestion, a task draft, a review gate, or a downgrade/freeze
// candidate — never to a direct external action.
export const SUPERVISION_ROUTES = [
  "ignore",
  "watch",
  "owner_review",
  "work_packet",
  "freeze",
  "rollback",
  "pack_candidate",
] as const;

export type SupervisionRoute = (typeof SUPERVISION_ROUTES)[number];

export const SUPERVISION_SIGNAL_STATUSES = [
  "open",
  "acknowledged",
  "routed",
  "resolved",
  "dismissed",
  "expired",
] as const;

export type SupervisionSignalStatus = (typeof SUPERVISION_SIGNAL_STATUSES)[number];

export type SupervisionSignal = {
  signalId: string;
  tenantRef: string | null;
  signalType: SupervisionSignalType;
  observedObjectRef: string;
  baselineRef: string | null;
  evidenceRefs: readonly string[];
  severity: SupervisionSeverity;
  confidence: DecisionConfidence;
  recommendedRoute: SupervisionRoute;
  ownerRef: string | null;
  deadlineOrSla: string | null;
  status: SupervisionSignalStatus;
  // Supervision must separate what happened from what it might mean.
  observedFact: string;
  interpretation: string | null;
};

export const CONTROL_GATE_TYPES = [
  "citation_gate",
  "policy_gate",
  "owner_gate",
  "sod_gate",
  "receipt_gate",
  "shadow_gate",
  "rollback_gate",
] as const;

export type ControlGateType = (typeof CONTROL_GATE_TYPES)[number];

export type ControlGate = {
  gateType: ControlGateType;
  // Why this gate is required for the decision at hand.
  reason: string;
};

export type ControlGateResult = {
  gateType: ControlGateType;
  passed: boolean;
  evidenceRefs: readonly string[];
  // Distinct approver identities backing an owner_gate result. Required (>= 2
  // distinct refs) when the decision demands dual approval; a passed owner
  // gate without them cannot satisfy a dual_approval_required decision.
  approverRefs?: readonly string[];
};

export const INTERVENTION_TYPES = [
  "owner_review",
  "work_packet_draft",
  "knowledge_review",
  "workflow_escalation",
  "freeze",
  "downgrade",
  "rollback",
  "pack_candidate",
  "fde_review",
  "builder_backlog",
] as const;

export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const INTERVENTION_STATUSES = [
  "proposed",
  "gated",
  "approved",
  "rejected",
  "routed",
  "completed",
  "cancelled",
] as const;

export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export type Intervention = {
  interventionId: string;
  tenantRef: string | null;
  interventionType: InterventionType;
  sourceSignalRef: string;
  decisionRef: string | null;
  ownerRef: string | null;
  status: InterventionStatus;
  controlGateRefs: readonly ControlGateType[];
  receiptRequired: boolean;
};

export const ESCALATION_REASONS = [
  "timeout",
  "blocked",
  "policy_risk",
  "owner_missing",
  "receipt_gap",
  "rollback_required",
] as const;

export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const ESCALATION_STATUSES = [
  "proposed",
  "sent_for_review",
  "accepted",
  "rejected",
  "resolved",
  "expired",
] as const;

export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export type Escalation = {
  escalationId: string;
  tenantRef: string | null;
  sourceSignalRef: string;
  sourceWorkPacketRef: string | null;
  reason: EscalationReason;
  fromOwnerRef: string | null;
  toOwnerRef: string | null;
  deadlineOrSla: string | null;
  status: EscalationStatus;
  receiptRequired: boolean;
};

export const AUTOMATION_IMPACTS = [
  "none",
  "promote_candidate",
  "downgrade_candidate",
  "freeze_candidate",
] as const;

export type AutomationImpact = (typeof AUTOMATION_IMPACTS)[number];

export type DecisionEvaluation = {
  evaluationId: string;
  decisionRef: string;
  // Problem-category projection key so evaluations can be aggregated per
  // scene rather than globally.
  problemCategoryRef: string | null;
  aiRecommendation: string | null;
  humanDecision: string | null;
  finalActionRef: string | null;
  outcomeRef: string | null;
  receiptRefs: readonly string[];
  varianceReason: string | null;
  learnable: boolean;
  automationImpact: AutomationImpact;
};

// Receipt evidence taxonomy consumed by evaluation and promotion functions.
// Verified outcomes teach; self-reported outcomes only suggest.
// Shared with the company-memory contract (owner decision 2026-07-07: one
// receipt-outcome enum across both contracts).
export const DECISION_RECEIPT_OUTCOMES = RECEIPT_OUTCOMES;

export type DecisionReceiptOutcome = ReceiptOutcome;

export type DecisionReceiptEvidence = {
  receiptRef: string;
  outcome: DecisionReceiptOutcome;
  // Structured reason class for negative outcomes; null means unclassified,
  // which weakens the receipt.
  reasonCode: string | null;
};
