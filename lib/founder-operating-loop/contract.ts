/**
 * Helm — Founder Operating Loop (FOL) eight-object contract.
 *
 * Phase 1 OFFLINE planning artifact. No runtime, no schema, no API.
 * These TypeScript types are the projection of the eight product
 * objects that the Founder Operating Loop produces during a single
 * nightly run.
 *
 * Public boundary anchor:
 *   docs/product/HELM_FOUNDER_OPERATING_LOOP_BOUNDARY_BRIEF.md
 * The full requirements (capability spec, owner stances, open
 * questions, dogfood plan) live outside the open-core mirror; see
 * the boundary brief for the public-safe summary.
 *
 * Owner stances pinned 2026-05-21 (referenced by the offline
 * evaluator policy block):
 *   - row-level filter; no Prisma schema change in Phase 0–1
 *   - 60 / 40 investigative-to-actionable Originate mix
 *   - 5 connector minimum: Git + email (IMAP/SMTP) + DingTalk MCP
 *     + meeting capture + Feishu Bitable
 *   - 10 thread daily briefing cap, 30 minute CEO review budget
 *   - one FounderOperatingRun per workspace; helm_self and
 *     customer_vertical never share a run or a CEO briefing
 *
 * These types do not authorise Prisma migration, API surface, UI
 * implementation, runtime query, cross-workspace projection,
 * official write, auto-outbound, auto-approval, auto-execution,
 * or LLM final ranking. They only encode the shape that the offline
 * eval evaluator asserts against.
 */

// ---------------------------------------------------------------------------
// §0 Evidence Bundle
// ---------------------------------------------------------------------------

/**
 * Canonical evidence pointer type. Every Originate thread in V1 doc
 * §1 #3 / §4 #2 / B3 must carry a non-empty `readonly EvidenceRef[]`
 * (the Evidence Bundle).
 */
export type EvidenceRefType =
  | "git_commit"
  | "email_message"
  | "meeting_segment"
  | "crm_field"
  | "im_message"
  | "bitable_row"
  | "operating_signal"
  | "audit_log"
  | "trace"
  | "deploy_artifact"
  | "external_link";

export interface EvidenceRef {
  readonly type: EvidenceRefType;
  readonly sourceId: string;
  readonly snippetHash: string;
  readonly collectedAt: string;
  readonly sourceUrl?: string;
  readonly fieldPath?: string;
  readonly messageId?: string;
  readonly traceId?: string;
  readonly commitSha?: string;
}

export type EvidenceBundle = readonly EvidenceRef[];

// ---------------------------------------------------------------------------
// Run scope, posture, signal taxonomy (§5.2 + §9)
// ---------------------------------------------------------------------------

/**
 * V1 §5.2 confirmed (OQ-L): a run is bound to one workspace and one
 * scope. helm_self and customer_vertical never share a runtime run.
 */
export type FounderRunScope = "helm_self" | "customer_vertical";

export const FOUNDER_RUN_SCOPES: readonly FounderRunScope[] = [
  "helm_self",
  "customer_vertical",
];

export type FounderRunPosture =
  | "nominal"
  | "review_pending"
  | "blocked"
  | "closed";

/**
 * §9.2 — five faces of the Helm self-operating run.
 */
export type HelmSelfFace =
  | "production_stability"
  | "product_quality"
  | "delivery_value"
  | "release_governance"
  | "commercialization";

export const HELM_SELF_FACES: readonly HelmSelfFace[] = [
  "production_stability",
  "product_quality",
  "delivery_value",
  "release_governance",
  "commercialization",
];

/**
 * §9.1 — seven signal layers of the case-management vertical
 * reference run. Intentionally generic (no customer-named slugs);
 * customer naming stays in tenant-private channels per V1 §2 #5.
 */
export type CaseManagementLayer =
  | "asset_case_structure"
  | "collection_outcomes"
  | "process_actions"
  | "risk_compliance"
  | "people_org"
  | "data_quality"
  | "system_delivery";

export const CASE_MANAGEMENT_LAYERS: readonly CaseManagementLayer[] = [
  "asset_case_structure",
  "collection_outcomes",
  "process_actions",
  "risk_compliance",
  "people_org",
  "data_quality",
  "system_delivery",
];

/**
 * The signal-family taxonomy a Founder Loop snapshot may classify
 * against. Locked to the eight families that map to §5.2 8 steps.
 */
export type FounderSignalFamily =
  | "production_runtime"
  | "data_quality"
  | "helm_self_operating"
  | "customer_operating"
  | "responsibility_routing"
  | "product_improvement"
  | "audit_consistency"
  | "operating_readout";

export const FOUNDER_SIGNAL_FAMILIES: readonly FounderSignalFamily[] = [
  "production_runtime",
  "data_quality",
  "helm_self_operating",
  "customer_operating",
  "responsibility_routing",
  "product_improvement",
  "audit_consistency",
  "operating_readout",
];

export type SignalSeverity = "critical" | "high" | "medium" | "low" | "watch";

// ---------------------------------------------------------------------------
// §6.2 Judgement four questions
// ---------------------------------------------------------------------------

export type JudgmentQuestion = "Q1" | "Q2" | "Q3" | "Q4";

export const JUDGMENT_QUESTIONS: readonly JudgmentQuestion[] = [
  "Q1",
  "Q2",
  "Q3",
  "Q4",
];

/**
 * Phase 1 default cardinality (V1 §6.2): one signal -> four
 * FounderJudgment records, one per question.
 */
export const JUDGMENTS_PER_SIGNAL = 4;

export type JudgmentAnswerKind =
  | "accepted"
  | "downgraded"
  | "duplicate"
  | "stale"
  | "rejected"
  | "needs_review"
  | "gap_present";

// ---------------------------------------------------------------------------
// §6.3 Responsibility routing (R1–R5)
// ---------------------------------------------------------------------------

export type RoutingReason =
  | "business_owner_found"
  | "system_owner_found"
  | "no_owner_escalate"
  | "evidence_insufficient"
  | "external_side_effect";

export const ROUTING_REASONS: readonly RoutingReason[] = [
  "business_owner_found",
  "system_owner_found",
  "no_owner_escalate",
  "evidence_insufficient",
  "external_side_effect",
];

export type RiskLevel = "low" | "medium" | "high" | "critical";

// ---------------------------------------------------------------------------
// §6.1 Hard boundaries (B1–B7)
// ---------------------------------------------------------------------------

export type FounderBoundaryGate =
  | "B1_single_viewer"
  | "B2_ceo_author"
  | "B3_evidence_required"
  | "B4_no_auto_advance"
  | "B5_no_cross_workspace"
  | "B6_no_sensitive_identity_ranking"
  | "B7_thirty_day_reoriginate_cooldown"
  | "B8_qa_no_side_effects";

export const FOUNDER_BOUNDARY_GATES: readonly FounderBoundaryGate[] = [
  "B1_single_viewer",
  "B2_ceo_author",
  "B3_evidence_required",
  "B4_no_auto_advance",
  "B5_no_cross_workspace",
  "B6_no_sensitive_identity_ranking",
  "B7_thirty_day_reoriginate_cooldown",
  "B8_qa_no_side_effects",
];

// ---------------------------------------------------------------------------
// OQ-H Phase 1.5 read-only Q&A surface
// ---------------------------------------------------------------------------

/**
 * OQ-H confirmed 2026-05-21: CEO may issue a read-only Q&A against
 * the run-bound briefing / signal / readout. The Q&A path must never
 * trigger any of the side effects below. Any non-empty intersection
 * between an attempted Q&A flow and `QA_FORBIDDEN_SIDE_EFFECTS` is a
 * B8 breach.
 */
export type QaScope = "briefing" | "signal" | "readout";

export const QA_SCOPES: readonly QaScope[] = ["briefing", "signal", "readout"];

export type QaForbiddenSideEffect =
  | "originate"
  | "action_item"
  | "ranking_change"
  | "cross_workspace_query";

export const QA_FORBIDDEN_SIDE_EFFECTS: readonly QaForbiddenSideEffect[] = [
  "originate",
  "action_item",
  "ranking_change",
  "cross_workspace_query",
];

/**
 * Per V1 §6.1 B6: sensitive identity attributes are forbidden as
 * ranking inputs. The list verbatim aligns with PIPL §28 sensitive
 * personal information plus labour-context high-risk identity
 * attributes called out in §6.1.
 */
export type SensitiveIdentityAttribute =
  | "biometric"
  | "religious_belief"
  | "specific_identity"
  | "medical_health"
  | "financial_account"
  | "location_tracking"
  | "minor_under_14"
  | "age"
  | "gender"
  | "ethnicity"
  | "marital_or_reproductive_status"
  | "political_orientation"
  | "household_registration"
  | "union_membership";

export const SENSITIVE_IDENTITY_ATTRIBUTES: readonly SensitiveIdentityAttribute[] = [
  "biometric",
  "religious_belief",
  "specific_identity",
  "medical_health",
  "financial_account",
  "location_tracking",
  "minor_under_14",
  "age",
  "gender",
  "ethnicity",
  "marital_or_reproductive_status",
  "political_orientation",
  "household_registration",
  "union_membership",
];

// ---------------------------------------------------------------------------
// §7 Object contract — eight product objects
// ---------------------------------------------------------------------------

/**
 * §7 object 1: FounderOperatingRun.
 *
 * One run is bound to one workspace and one scope (V1 §5.2 / OQ-L
 * confirmed 2026-05-21). helm_self and customer_vertical never
 * share a run.
 */
export interface FounderOperatingRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly scope: FounderRunScope;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly posture: FounderRunPosture;
}

/**
 * §7 object 2: OperatingSignalSnapshot.
 *
 * One snapshot rolls up the signal count + owner / evidence
 * coverage for one (run, family) tuple.
 */
export interface OperatingSignalSnapshot {
  readonly runId: string;
  readonly signalFamily: FounderSignalFamily;
  readonly severity: SignalSeverity;
  readonly count: number;
  readonly ownerCoverage: number;
  readonly evidenceCoverage: number;
}

/**
 * §7 object 3: FounderJudgment.
 *
 * One FounderJudgment row encodes one of the four §6.2 questions
 * applied to one signal. A signal produces four rows by default.
 */
export interface FounderJudgment {
  readonly signalId: string;
  readonly question: JudgmentQuestion;
  readonly answer: JudgmentAnswerKind;
  readonly confidence: number;
  readonly evidenceRefs: EvidenceBundle;
  readonly boundaryNote?: string;
}

/**
 * §7 object 4: ResponsibilityRoute.
 *
 * §6.3 R1–R5 result. Always staged into the CEO review queue;
 * never directly dispatched to a non-CEO viewer.
 */
export interface ResponsibilityRoute {
  readonly signalId: string;
  readonly owner: string | null;
  readonly reviewer: "ceo";
  readonly riskLevel: RiskLevel;
  readonly dueDate: string | null;
  readonly routingReason: RoutingReason;
}

export type OperatingActionType =
  | "action_item_draft"
  | "helm_product_action_draft"
  | "data_quality_action_draft"
  | "review_packet_only"
  | "watch_only";

export type OperatingActionExecutionMode =
  | "awaiting_ceo_review"
  | "ceo_advanced_outbound_drafted"
  | "ceo_advanced_actionitem_drafted"
  | "ceo_closed_correct"
  | "ceo_closed_wrong"
  | "ceo_snoozed"
  | "ceo_delegated";

export type OperatingActionStatus =
  | "draft"
  | "awaiting_ceo_review"
  | "ceo_approved"
  | "blocked"
  | "closed";

/**
 * §7 object 5: OperatingAction.
 *
 * The action draft that flows from a §6.3 route. V1 §6.1 B4 forbids
 * auto-advance: an OperatingAction may not transition out of
 * `awaiting_ceo_review` without an explicit CEO advance event.
 */
export interface OperatingAction {
  readonly actionId: string;
  readonly signalId: string;
  readonly title: string;
  readonly sourceId: string;
  readonly actionType: OperatingActionType;
  readonly executionMode: OperatingActionExecutionMode;
  readonly status: OperatingActionStatus;
  readonly evidenceRefs: EvidenceBundle;
}

/**
 * §7 object 6: DecisionEscalation.
 *
 * Created when §6.3 R3 (no owner) fires, or when the CEO must
 * personally decide between options.
 */
export interface DecisionEscalation {
  readonly escalationId: string;
  readonly signalId: string;
  readonly decisionQuestion: string;
  readonly options: readonly string[];
  readonly recommendedPosture: "advance" | "investigate" | "snooze" | "close";
  readonly deadline: string | null;
  readonly evidenceRefs: EvidenceBundle;
}

export type ProductImprovementGapType =
  | "product_gap"
  | "data_gap"
  | "process_gap"
  | "org_gap"
  | "permission_gap"
  | "deploy_gap"
  | "signal_model_gap";

/**
 * §7 object 7: ProductImprovementCandidate.
 *
 * Created by §6.2 Q4 when a signal exposes a system gap that should
 * flow back into Helm itself.
 */
export interface ProductImprovementCandidate {
  readonly candidateId: string;
  readonly signalId: string;
  readonly gapType: ProductImprovementGapType;
  readonly evidence: EvidenceBundle;
  readonly impact: string;
  readonly proposedFix: string;
  readonly validationPlan: string;
}

export type ProductionStatus = "healthy" | "degraded" | "failing" | "unknown";

export interface NextSafeAction {
  readonly title: string;
  readonly riskLevel: RiskLevel;
  readonly evidenceRefs: EvidenceBundle;
  readonly waitingOn: "ceo_review" | "ceo_send" | "ceo_close" | "owner_response";
}

/**
 * §7 object 8: OperatingReadout.
 *
 * The CEO briefing payload that closes a run. V1 §5.2 step 8 +
 * §7 confirmed plural `nextSafeActions`.
 */
export interface OperatingReadout {
  readonly runId: string;
  readonly productionStatus: ProductionStatus;
  readonly actionsCreated: number;
  readonly blockers: readonly string[];
  readonly nextSafeActions: readonly NextSafeAction[];
}

/**
 * Confirmed defaults (OQ-B / OQ-G owner-fill 2026-05-21).
 * Eval gates may reference these as the source of truth.
 */
export const FOUNDER_RANKING_MIX_DEFAULT = {
  investigative: 0.6,
  actionable: 0.4,
} as const;

/** OQ-G confirmed: 10 thread daily cap. */
export const FOUNDER_BRIEFING_DAILY_CAP = 10;

/** OQ-G confirmed: 30 minute CEO single-sit review budget. */
export const FOUNDER_CEO_REVIEW_BUDGET_MINUTES = 30;

/** OQ-D confirmed: five-connector Phase 1.5 minimum. */
export type FounderConnectorMinimumSet =
  | "git"
  | "email_imap_smtp"
  | "dingtalk_mcp"
  | "meeting_capture"
  | "feishu_bitable";

export const FOUNDER_CONNECTOR_MINIMUM_SET: readonly FounderConnectorMinimumSet[] = [
  "git",
  "email_imap_smtp",
  "dingtalk_mcp",
  "meeting_capture",
  "feishu_bitable",
];
