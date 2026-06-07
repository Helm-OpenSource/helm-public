/**
 * Helm Business Advancement — Phase 1B Read-Model Feasibility Matrix
 *
 * Machine-readable feasibility classification for all 20 Phase 1A fixtures.
 * Each fixture is classified against existing read-model surfaces:
 *   dashboard / operating / mobile / ask_helm / memory / crm_import / tenant_resource / reports
 *
 * Allowed in Phase 1B: read-only projection helpers, feasibility evaluation, tests.
 * Forbidden in Phase 1B: schema, runtime extractor, event ingestion, official write,
 *   auto-write, execution authority, page behavior changes, LLM final ranking.
 */

import type { SourceType, SignalType } from "./contracts";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";

// ---------------------------------------------------------------------------
// Phase 1B types
// ---------------------------------------------------------------------------

export type FeasibilityStatus =
  | "current_read_model_supported"
  | "requires_thin_projection"
  | "future_only";

/**
 * Read-model surfaces available for projection.
 * "none" means no current surface can support the signal in Phase 1B.
 */
export type CandidateReadModel =
  | "dashboard"
  | "operating"
  | "mobile"
  | "ask_helm"
  | "memory"
  | "crm_import"
  | "tenant_resource"
  | "reports"
  | "none";

/**
 * One row in the feasibility matrix, corresponding to one Phase 1A fixture.
 * All fields are read-only — this is a planning artifact, not a runtime object.
 */
export interface FixtureFeasibilityRow {
  /** Must match a fixtureId in ADVANCEMENT_SIGNAL_FIXTURES */
  readonly fixtureId: string;
  readonly sourceType: SourceType;
  readonly signalType: SignalType;
  readonly feasibilityStatus: FeasibilityStatus;
  /** Which existing read-model surfaces can project this signal */
  readonly candidateReadModels: readonly CandidateReadModel[];
  /** Why this status was assigned — which query/surface was evaluated */
  readonly evidenceRationale: string;
  /** Why no authority expansion occurs even if thin projection is added */
  readonly boundaryRationale: string;
  /**
   * Explains why schema, runtime extractor, event ingestion, official write,
   * auto-write, execution authority, page behavior changes, and LLM final ranking
   * remain forbidden for this fixture in Phase 1B.
   */
  readonly forbiddenImplementation: string;
}

// ---------------------------------------------------------------------------
// Feasibility matrix — 20 rows, one per Phase 1A fixture
// ---------------------------------------------------------------------------

export const FIXTURE_FEASIBILITY_MATRIX: readonly FixtureFeasibilityRow[] = [
  // -------------------------------------------------------------------------
  // AS-FX-001 | meeting | customer_waiting
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-001",
    sourceType: "meeting",
    signalType: "customer_waiting",
    feasibilityStatus: "current_read_model_supported",
    candidateReadModels: ["mobile"],
    evidenceRationale:
      "mobile `loadPostMeetingItems` queries `db.actionItem` where meetingId IS NOT NULL " +
      "and status IN ['PENDING_APPROVAL', 'MANUAL']. Post-meeting action items pending owner " +
      "update surface directly as `meeting_follow_up` Must Push items. The 24-hour no-response " +
      "signal maps to items without recent owner update, detectable via `updatedAt`.",
    boundaryRationale:
      "Projection is read-only: only reads existing actionItem rows. No new write path, " +
      "no schema change, no permission expansion. Output is a MustPushItem suggestion, " +
      "not a commitment or send action.",
    forbiddenImplementation:
      "No schema may be added to track customer_waiting status on meetings. " +
      "No runtime extractor may scan meeting transcripts for waiting signals. " +
      "No event queue may be created to detect 24-hour silence. " +
      "No official write or auto-send is permitted. " +
      "The projection only reads existing actionItem.updatedAt and meetingId fields.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-002 | meeting | blocked_decision
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-002",
    sourceType: "meeting",
    signalType: "blocked_decision",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["mobile"],
    evidenceRationale:
      "mobile `loadPendingApprovals` queries `db.approvalTask` where status = 'PENDING'. " +
      "AS-FX-002 represents a blocked decision that has NOT yet formed an approvalTask — " +
      "the meeting ended with an open contract dispute but no approval task was created. " +
      "A thin read-only projection is needed: query actionItems linked to meetings where " +
      "`approvalTask IS NULL` and `status IN ['PENDING_APPROVAL', 'MANUAL']` and " +
      "`dueDate < now - 48h`. This does not add a new table, only a new query filter.",
    boundaryRationale:
      "Thin projection is read-only over existing actionItem and meeting tables. " +
      "No approval authority is granted — output is a review-required MustPushItem " +
      "prompting a human to assign a decision owner, not to approve anything.",
    forbiddenImplementation:
      "No new schema for 'decision owner' tracking may be added in Phase 1B. " +
      "No runtime extractor may parse meeting transcripts for dispute detection. " +
      "No event queue for meeting-end triggers. No auto-assignment of decision owner. " +
      "No official write to mark contract terms as approved or confirmed.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-003 | meeting | overdue_commitment
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-003",
    sourceType: "meeting",
    signalType: "overdue_commitment",
    feasibilityStatus: "current_read_model_supported",
    candidateReadModels: ["mobile"],
    evidenceRationale:
      "mobile `loadPostMeetingItems` already maps `item.dueDate && item.dueDate < now` " +
      "to severity='high' for meeting-linked action items. Overdue meeting commitments " +
      "(no owner, past dueDate) surface as high-severity `meeting_follow_up` items. " +
      "The existing query covers this signal without any new extractor.",
    boundaryRationale:
      "Projection reads existing actionItem.dueDate and meetingId only. " +
      "Output is a suggestion to assign an owner, not a completion marker. " +
      "No official write occurs; the boundary note 'recommendation != commitment' is preserved.",
    forbiddenImplementation:
      "No schema change to actionItem may be added to track 'commitment delivery status'. " +
      "No runtime extractor to detect commitment language in meeting notes. " +
      "No auto-completion of action items. No auto-send of delivery materials to customers. " +
      "Overdue detection uses existing dueDate field only.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-004 | crm | stalled_opportunity
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-004",
    sourceType: "crm",
    signalType: "stalled_opportunity",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["mobile", "dashboard"],
    evidenceRationale:
      "mobile `loadHighRiskOpportunities` only fetches opportunities with " +
      "riskLevel IN ['HIGH', 'CRITICAL']. AS-FX-004 is an opportunity at proposal stage " +
      "stalled for 14 days that may not yet be HIGH/CRITICAL risk. " +
      "A thin projection is needed: query opportunities where " +
      "`updatedAt < now - 14d AND stage NOT IN ['DONE', 'LOST']` regardless of risk level. " +
      "dashboard `loadPipelineDashboardBatch` has `overdueOpportunities` but uses dueDate, " +
      "not activity staleness. A time-based staleness filter is the only addition needed.",
    boundaryRationale:
      "Staleness detection reads existing opportunity.updatedAt — no new field required. " +
      "Output is a review-required suggestion to check next steps, not a stage change. " +
      "CRM stage, forecast, and success probability remain unchanged.",
    forbiddenImplementation:
      "No schema may be added to track 'last_activity_at' separately from updatedAt. " +
      "No runtime extractor to parse CRM activity feeds. " +
      "No auto-update of opportunity stage or forecast. " +
      "No official write to mark opportunities as stalled. " +
      "LLM may not determine final staleness ranking.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-005 | crm | overdue_commitment
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-005",
    sourceType: "crm",
    signalType: "overdue_commitment",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["crm_import"],
    evidenceRationale:
      "The mobile model's `loadOverdueOpportunities` detects overdue at the opportunity " +
      "level (opportunity.dueDate < now). AS-FX-005 is about an overdue CRM commitment " +
      "record (db.commitment with dueDate < now and no owner update). " +
      "`data/queries.ts getOpportunityCommercialDetailData` already loads commitment records " +
      "with `db.commitment.findMany`. A thin projection querying commitments with " +
      "`dueDate < now AND ownerUser has no recent update` would surface this signal " +
      "without any new schema or extractor.",
    boundaryRationale:
      "Commitment records already exist in the schema from prior work. " +
      "Projection is read-only: only reads commitment.dueDate and commitment.updatedAt. " +
      "Output is a review-required suggestion to follow up — no 'fulfilled' flag is auto-written. " +
      "No auto-send of promised deliverables. A human owner must confirm fulfillment.",
    forbiddenImplementation:
      "No new commitment tracking schema may be created in Phase 1B. " +
      "No runtime extractor to identify commitments from CRM text. " +
      "No auto-write of commitment fulfillment status. " +
      "No auto-send of reports or proposals to customers. " +
      "Projection reads existing db.commitment rows only.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-006 | crm | customer_waiting
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-006",
    sourceType: "crm",
    signalType: "customer_waiting",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["dashboard", "mobile"],
    evidenceRationale:
      "mobile `loadWaitingEmailThreads` detects customer_waiting via email thread " +
      "status = 'WAITING_US'. AS-FX-006 is a CRM-side signal: customer is waiting " +
      "for a proposal, indicated by opportunity attributes (not email status). " +
      "A thin projection can join opportunity.updatedAt staleness with the presence " +
      "of an email thread (from opportunity.emailThreads) to surface this without " +
      "parsing email content. dashboard already includes opportunities with contacts.",
    boundaryRationale:
      "Projection joins existing opportunity and emailThread data, both in current schema. " +
      "No new field for 'customer_waiting_flag' is needed. " +
      "Output is a review-required suggestion to prepare proposal draft, not to send it.",
    forbiddenImplementation:
      "No schema column 'customer_waiting' may be added to opportunity in Phase 1B. " +
      "No runtime extractor to parse email content for waiting intent. " +
      "No auto-send of proposals. No auto-update of forecast or stage. " +
      "Thin projection uses only existing opportunity.updatedAt and emailThread foreign key.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-007 | tenant_resource | stalled_case
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-007",
    sourceType: "tenant_resource",
    signalType: "stalled_case",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["tenant_resource"],
    evidenceRationale:
      "mobile `loadTenantResourceIssues` filters for severity IN ['critical', 'high'] " +
      "or proofRequired=true or followThroughStatus='blocked'. AS-FX-007 is a " +
      "stalled_case with read_only posture — likely medium or low severity — so it " +
      "wouldn't pass the current high-severity filter. " +
      "`getWorkspaceTenantResourceOperatingImpactReadout` already returns all impact items; " +
      "a thin read-only projection can surface stalled items by checking staleDays > 14 " +
      "regardless of severity, without adding any new extractor.",
    boundaryRationale:
      "Projection reads existing operating impact readout data. No new table or field. " +
      "read_only posture means output is a notification to review, not an action request. " +
      "No old-system state change, no auto-archive, no auto-escalation.",
    forbiddenImplementation:
      "No new tenant_resource schema to track staleness separately. " +
      "No runtime extractor to poll old system for state changes. " +
      "No auto-escalation of case priority. " +
      "No official write to old system marking case status. " +
      "Thin projection reads existing impact readout with an additional staleDays filter.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-008 | tenant_resource | overdue_commitment
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-008",
    sourceType: "tenant_resource",
    signalType: "overdue_commitment",
    feasibilityStatus: "current_read_model_supported",
    candidateReadModels: ["mobile", "tenant_resource"],
    evidenceRationale:
      "mobile `loadTenantResourceIssues` includes items where " +
      "`followThroughStatus === 'blocked'`. An overdue SLA on a tenant resource " +
      "would produce a blocked followThrough in `getWorkspaceTenantResourceOperatingImpactReadout`, " +
      "surfacing it as `proof_or_review_required`. The filter covers overdue SLA without " +
      "any additional extractor or schema.",
    boundaryRationale:
      "Output is a review-required Must Push item. No official write to the old system. " +
      "No auto-trigger of collections or service actions. " +
      "SLA completion status must be confirmed by a human owner.",
    forbiddenImplementation:
      "No schema to store SLA overdue flags in Phase 1B. " +
      "No runtime extractor to poll SLA systems for status. " +
      "No auto-write to old system. No auto-trigger of collections. " +
      "The existing operating impact readout is the sole data source.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-009 | tenant_resource | resource_evidence_gap
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-009",
    sourceType: "tenant_resource",
    signalType: "resource_evidence_gap",
    feasibilityStatus: "current_read_model_supported",
    candidateReadModels: ["mobile", "tenant_resource"],
    evidenceRationale:
      "mobile `loadTenantResourceIssues` includes items where `proofRequired === true`. " +
      "`getWorkspaceTenantResourceOperatingImpactReadout` already returns a `proofRequired` " +
      "field on impact items. Missing critical evidence surfaces directly as " +
      "`proof_or_review_required` Must Push without any new extractor.",
    boundaryRationale:
      "Projection reads existing proofRequired flag from impact readout. " +
      "No authority expansion: output prompts human to review and submit proof. " +
      "Boundary: proof != external write success — old system actions remain blocked " +
      "until proof is confirmed by a human, not by the system.",
    forbiddenImplementation:
      "No schema to track proof submission in Phase 1B. " +
      "No runtime extractor to validate proof documents. " +
      "No auto-generation of fake proof materials. " +
      "No official write to old system before proof is confirmed. " +
      "The proofRequired field is read from existing operating impact data only.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-010 | report | kpi_anomaly
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-010",
    sourceType: "report",
    signalType: "kpi_anomaly",
    feasibilityStatus: "future_only",
    candidateReadModels: ["none"],
    evidenceRationale:
      "No existing read-model surface in dashboard, operating, mobile, or memory " +
      "queries a `report` table with KPI trend data. `db.report` or equivalent is not " +
      "present in current Prisma queries. KPI anomaly detection requires parsing " +
      "structured report data across time periods, which is not in any current query.",
    boundaryRationale:
      "Even in future phases, KPI anomaly output must remain read_only: " +
      "the system may flag anomalies but must not auto-attribute blame, " +
      "auto-penalize owners, or generate final decisions. " +
      "A human reviewer must confirm the anomaly and its cause.",
    forbiddenImplementation:
      "No runtime extractor for report parsing may be added in Phase 1B. " +
      "This is future_only because adding a report analysis path would require " +
      "a new schema (report table, KPI metrics), a new query surface, and potentially " +
      "a new event ingestion path for report updates — all of which are explicitly " +
      "forbidden in Phase 1B. No auto-attribution, auto-punishment, or final decision " +
      "generation may be added in any phase.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-011 | report | blocked_decision
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-011",
    sourceType: "report",
    signalType: "blocked_decision",
    feasibilityStatus: "future_only",
    candidateReadModels: ["none"],
    evidenceRationale:
      "Same report surface gap as AS-FX-010: no existing query surfaces report-level " +
      "blocked decisions. Detecting 'multiple projects waiting on the same decision maker " +
      "with no response' requires cross-object aggregation over report data that does " +
      "not exist in the current read model. Operating workspace queries cover " +
      "opportunity-level approval tasks but not report-level decision blocking.",
    boundaryRationale:
      "Future implementation must remain human_owner_required: " +
      "the system can flag blocked decision patterns but must not auto-generate " +
      "final decisions, auto-close blocking items, or replace the decision maker.",
    forbiddenImplementation:
      "No runtime extractor to parse reports for blocked-decision patterns in Phase 1B. " +
      "This is future_only because report-level aggregation requires a new data model " +
      "(report schema, cross-object linking), new query surfaces, and possibly event " +
      "ingestion — all forbidden in Phase 1B. No auto-decision generation, no " +
      "auto-closing of blocked items, no LLM final ranking of decisions.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-012 | email | customer_waiting
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-012",
    sourceType: "email",
    signalType: "customer_waiting",
    feasibilityStatus: "current_read_model_supported",
    candidateReadModels: ["mobile"],
    evidenceRationale:
      "mobile `loadWaitingEmailThreads` queries `db.emailThread` where " +
      "`status = 'WAITING_US'` — exactly the case where a customer email is unanswered. " +
      "The 48-hour SLA overdue condition maps to threads where updatedAt < now - 48h " +
      "(the existing query already orders by updatedAt desc, so oldest-unanswered " +
      "threads surface first). No extractor needed.",
    boundaryRationale:
      "Projection reads existing emailThread.status field. " +
      "Output is a review-required suggestion to prepare a reply draft. " +
      "No auto-send of email replies. Boundary: draft != send.",
    forbiddenImplementation:
      "No new schema for email SLA tracking in Phase 1B. " +
      "No runtime extractor to parse email content for intent. " +
      "No auto-reply or auto-send. No auto-marking of threads as replied. " +
      "WAITING_US status is set by existing email connector, not by Phase 1B code.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-013 | email | stalled_opportunity
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-013",
    sourceType: "email",
    signalType: "stalled_opportunity",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["mobile"],
    evidenceRationale:
      "AS-FX-013 combines email thread signals with CRM staleness: a customer email " +
      "expressing renewal concerns while the CRM opportunity has no update in 10 days. " +
      "Email content intent extraction is not needed — a thin projection can join " +
      "`emailThread` (any thread linked to a company/contact in the last 30 days) with " +
      "`opportunity` (updatedAt > 10 days, stage not DONE/LOST) for the same company. " +
      "The stalled_opportunity signal is inferred from CRM staleness, not email parsing.",
    boundaryRationale:
      "Thin projection reads existing opportunity.updatedAt and emailThread foreign keys. " +
      "No email content is parsed. Output is a review-required suggestion to prepare " +
      "a renewal risk follow-up — not to change forecast, stage, or send a reply.",
    forbiddenImplementation:
      "No runtime extractor to classify email content for renewal intent in Phase 1B. " +
      "No auto-update of opportunity forecast or renewal status. " +
      "No auto-send of renewal emails. No schema for email intent classification. " +
      "Thin projection infers risk purely from temporal staleness of CRM + presence " +
      "of an email thread, without reading email body content.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-014 | ask_helm | repeated_intent
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-014",
    sourceType: "ask_helm",
    signalType: "repeated_intent",
    feasibilityStatus: "future_only",
    candidateReadModels: ["none"],
    evidenceRationale:
      "Detecting 'user asked the same question 3 times in 3 days without entering " +
      "any primary action' requires persisting Ask Helm session query history. " +
      "Final Requirements V1 §二.15 explicitly prohibits '问 Helm 多轮聊天历史持久化'. " +
      "Without session persistence there is no read model surface to project this signal. " +
      "No current memory, dashboard, or operating surface tracks Ask Helm interaction patterns.",
    boundaryRationale:
      "Even if implemented in future phases, output must remain read_only: " +
      "repeated intent is a suggestion to review Must Push, not a task completion. " +
      "The system must not auto-push items or auto-mark queries as resolved.",
    forbiddenImplementation:
      "No Ask Helm session persistence schema may be added in Phase 1B — " +
      "this is explicitly forbidden in Final Requirements V1 §二.15. " +
      "No runtime extractor to capture and store query patterns. " +
      "No event queue for Ask Helm interaction events. " +
      "future_only status reflects this hard requirement prohibition, not a " +
      "technical gap that can be worked around in Phase 1B.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-015 | ask_helm | boundary_hit
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-015",
    sourceType: "ask_helm",
    signalType: "boundary_hit",
    feasibilityStatus: "current_read_model_supported",
    candidateReadModels: ["ask_helm"],
    evidenceRationale:
      "features/search/ask-helm-access-scope.ts implements `loadAskHelmAccessScope` " +
      "which enforces workspace-scoped retrieval: objectSearch = 'current_workspace_only' " +
      "or 'denied', with officialWritePath = 'denied' always. Out-of-workspace queries " +
      "are rejected before any data access. The boundary is enforced at the access scope " +
      "layer, which is a read-only guard — not a new extractor.",
    boundaryRationale:
      "The access scope check is a read-only pre-query guard with no write side effects. " +
      "blocked posture means no data is returned, no permission escalation occurs, " +
      "no workspace-isolated data is exposed to other tenants. The guard is already in production.",
    forbiddenImplementation:
      "No new schema for boundary-hit logging in Phase 1B. " +
      "No runtime extractor or event queue for boundary events. " +
      "The existing access scope guard is the read-model surface — " +
      "Phase 1B only confirms this guard satisfies the blocked posture requirement. " +
      "No permission escalation, no reserved tenant data exposure.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-016 | ask_helm | abandoned_high_confidence_answer
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-016",
    sourceType: "ask_helm",
    signalType: "abandoned_high_confidence_answer",
    feasibilityStatus: "future_only",
    candidateReadModels: ["none"],
    evidenceRationale:
      "Detecting 'Ask Helm gave a high-confidence answer but user did not enter any action, " +
      "and the same question recurred within 7 days' requires two capabilities absent from " +
      "the current read model: (1) confidence scoring stored per answer, and (2) user action " +
      "follow-through tracked per session. Both require session persistence, which is " +
      "forbidden (Final Requirements V1 §二.15).",
    boundaryRationale:
      "Future implementation must remain read_only: surfacing abandoned answers is a " +
      "review prompt, not a forced re-delivery of answers or persistence of chat history. " +
      "The system must not auto-push answers or auto-mark them as official facts.",
    forbiddenImplementation:
      "No session persistence schema for Ask Helm answers in Phase 1B — " +
      "explicitly forbidden by Final Requirements V1 §二.15. " +
      "No runtime extractor to capture confidence scores at answer time. " +
      "No event queue for user-action follow-through events. " +
      "future_only status is a requirement boundary, not just a technical gap. " +
      "No auto-writeback of answers as official memory.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-017 | user_behavior | repeated_intent
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-017",
    sourceType: "user_behavior",
    signalType: "repeated_intent",
    feasibilityStatus: "future_only",
    candidateReadModels: ["none"],
    evidenceRationale:
      "Detecting 'user opened the same object 5 times in 3 days without taking action' " +
      "requires a user behavior event log (page views / object opens with timestamps). " +
      "No such log exists in the current Prisma schema or any existing read-model surface. " +
      "Adding behavior tracking would require a new table, a new event ingestion path, " +
      "and a runtime extractor — all forbidden in Phase 1B.",
    boundaryRationale:
      "Future implementation must remain review_required: repeated-view detection is a " +
      "suggestion to review the object, not an automatic priority change or owner assignment. " +
      "No official fact may be auto-written based on behavior patterns.",
    forbiddenImplementation:
      "No user behavior tracking schema may be added in Phase 1B. " +
      "No runtime extractor to capture page view events. " +
      "No event queue for user interaction events. " +
      "No auto-change of object priority. No auto-assignment of owners. " +
      "No official write of priority facts based on behavior. " +
      "future_only status is a hard Phase 1B boundary — behavior tracking is a Phase 3+ concern.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-018 | user_behavior | resource_evidence_gap
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-018",
    sourceType: "user_behavior",
    signalType: "resource_evidence_gap",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["mobile", "tenant_resource"],
    evidenceRationale:
      "The resource_evidence_gap component (missing evidence for a resource) is already " +
      "supported via mobile `loadTenantResourceIssues` with `proofRequired === true`. " +
      "The user_behavior trigger (user manually marked object as important) is not directly " +
      "in the current read model, but the underlying evidence gap IS detectable. " +
      "A thin projection can surface resource evidence gaps regardless of the manual " +
      "importance trigger, using only the existing proofRequired signal. " +
      "The behavior trigger aspect is a future enhancement — the evidence gap itself is " +
      "projectable today.",
    boundaryRationale:
      "Projection reads proofRequired from existing operating impact readout. " +
      "No user behavior tracking is added. Output is a review-required suggestion " +
      "to supplement evidence — not an automatic priority escalation.",
    forbiddenImplementation:
      "No schema for manual importance flags in Phase 1B. " +
      "No runtime extractor to detect user importance-marking events. " +
      "The user_behavior trigger dimension is deferred to future phases. " +
      "Thin projection surfaces evidence gaps using the existing proofRequired path only. " +
      "No auto-escalation to official priority. No write to importance records.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-019 | combined | stalled_opportunity
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-019",
    sourceType: "combined",
    signalType: "stalled_opportunity",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["mobile", "dashboard"],
    evidenceRationale:
      "AS-FX-019 is a multi-source signal: meeting post-action (meeting_follow_up), " +
      "CRM staleness (stalled_opportunity), and email non-response (customer_waiting). " +
      "Each individual component has existing read-model support: " +
      "(1) mobile meeting_follow_up covers meeting action items; " +
      "(2) mobile stalled_opportunity covers high-risk CRM opportunities; " +
      "(3) mobile customer_waiting covers WAITING_US email threads. " +
      "A thin projection can aggregate these three signals for the same company/opportunity " +
      "into a single combined Must Push item, using only existing query paths without " +
      "any new schema or extractor.",
    boundaryRationale:
      "Multi-source aggregation is read-only: it joins three existing queries by " +
      "company/opportunity foreign key. No new write paths. Output is a single " +
      "review-required Must Push — not a write-back to CRM, email, or meeting systems. " +
      "Multi-source combination increases confidence but does not broaden permissions.",
    forbiddenImplementation:
      "No new schema for combined signal tracking in Phase 1B. " +
      "No runtime extractor for cross-system correlation. " +
      "No auto-write to CRM, email, or meeting systems. " +
      "No auto-send of proposals to customers. " +
      "Thin projection reads and joins existing opportunity, emailThread, and actionItem " +
      "tables by company/contact foreign key — read-only.",
  },

  // -------------------------------------------------------------------------
  // AS-FX-020 | combined | resource_evidence_gap
  // -------------------------------------------------------------------------
  {
    fixtureId: "AS-FX-020",
    sourceType: "combined",
    signalType: "resource_evidence_gap",
    feasibilityStatus: "requires_thin_projection",
    candidateReadModels: ["mobile", "tenant_resource"],
    evidenceRationale:
      "AS-FX-020 is a multi-source signal: tenant resource missing evidence + " +
      "proposal premise unmet + trial plan not confirmed. " +
      "The tenant resource evidence gap is already captured by mobile " +
      "`loadTenantResourceIssues` with proofRequired=true. " +
      "The proposal premise component is currently not in any read-model surface — " +
      "it would require a thin projection that checks whether a linked opportunity's " +
      "proposal/trial status has a 'premise_missing' flag, or alternatively surfaces " +
      "any resource with proofRequired adjacent to an active opportunity at trial stage. " +
      "A thin join of proofRequired resources with trial-stage opportunities covers " +
      "the combined signal without new schema.",
    boundaryRationale:
      "Multi-source projection joins existing tenant resource and opportunity data. " +
      "No new write path. human_owner_required posture: output prompts a human owner " +
      "to review and supplement proof. No trial may be started before proof is confirmed. " +
      "Boundary: proof != external write success.",
    forbiddenImplementation:
      "No new schema for proposal premise tracking in Phase 1B. " +
      "No runtime extractor to validate trial prerequisites. " +
      "No auto-approval of trial applications. " +
      "No official write to proposal or trial status before human confirmation. " +
      "Thin projection reads proofRequired and opportunity.stage from existing tables only.",
  },
] as const;

export const FEASIBILITY_MATRIX_ROW_COUNT = FIXTURE_FEASIBILITY_MATRIX.length;

// ---------------------------------------------------------------------------
// Feasibility evaluator result types
// ---------------------------------------------------------------------------

export interface FeasibilityCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface FeasibilityEvalSummary {
  readonly totalChecks: number;
  readonly passed: number;
  readonly failed: number;
  readonly checks: readonly FeasibilityCheckResult[];
  readonly overallPassed: boolean;
}

// ---------------------------------------------------------------------------
// Evaluator checks (pure functions)
// ---------------------------------------------------------------------------

function checkAll20FixturesMapped(): FeasibilityCheckResult {
  const matrixIds = new Set(FIXTURE_FEASIBILITY_MATRIX.map((r) => r.fixtureId));
  const fixtureIds = ADVANCEMENT_SIGNAL_FIXTURES.map((f) => f.fixtureId);
  const missing = fixtureIds.filter((id) => !matrixIds.has(id));

  const passed = missing.length === 0 && FEASIBILITY_MATRIX_ROW_COUNT === 20;
  return {
    checkName: "all_20_fixtures_mapped",
    passed,
    detail: passed
      ? `All 20 Phase 1A fixture IDs are present in the feasibility matrix.`
      : `Missing fixture IDs in matrix: ${missing.join(", ")}; matrix has ${FEASIBILITY_MATRIX_ROW_COUNT} rows (expected 20).`,
  };
}

function checkNoUnknownFixtureIds(): FeasibilityCheckResult {
  const validIds = new Set(
    ADVANCEMENT_SIGNAL_FIXTURES.map((f) => f.fixtureId)
  );
  const unknown = FIXTURE_FEASIBILITY_MATRIX.map((r) => r.fixtureId).filter(
    (id) => !validIds.has(id)
  );

  const passed = unknown.length === 0;
  return {
    checkName: "no_unknown_fixture_ids",
    passed,
    detail: passed
      ? "All matrix fixture IDs correspond to known Phase 1A fixtures."
      : `Unknown fixture IDs in matrix: ${unknown.join(", ")}`,
  };
}

/**
 * At least 3 source class types (SourceType values) must have at least one fixture
 * classified as current_read_model_supported or requires_thin_projection.
 */
function checkAtLeast3SourceClassesFeasible(): FeasibilityCheckResult {
  const feasibleSources = new Set<string>();

  for (const row of FIXTURE_FEASIBILITY_MATRIX) {
    if (
      row.feasibilityStatus === "current_read_model_supported" ||
      row.feasibilityStatus === "requires_thin_projection"
    ) {
      feasibleSources.add(row.sourceType);
    }
  }

  const passed = feasibleSources.size >= 3;
  return {
    checkName: "at_least_3_source_classes_feasible",
    passed,
    detail: passed
      ? `${feasibleSources.size} source class(es) have current or thin-projection feasibility: ${[...feasibleSources].sort().join(", ")}.`
      : `Only ${feasibleSources.size} source class(es) are feasible (need >= 3): ${[...feasibleSources].sort().join(", ")}.`,
  };
}

/**
 * All future_only rows must have a non-empty forbiddenImplementation that
 * explicitly explains why no runtime extractor may be added in Phase 1B.
 */
function checkFutureOnlyRowsHaveRationale(): FeasibilityCheckResult {
  const violations: string[] = [];
  const REQUIRED_TERMS = ["phase 1b", "future_only", "forbidden", "extractor", "schema"];

  for (const row of FIXTURE_FEASIBILITY_MATRIX) {
    if (row.feasibilityStatus !== "future_only") continue;

    const text = row.forbiddenImplementation.toLowerCase();
    const hasSufficientExplanation = REQUIRED_TERMS.some((term) =>
      text.includes(term)
    );

    if (!hasSufficientExplanation || row.forbiddenImplementation.trim().length < 50) {
      violations.push(
        `${row.fixtureId}: future_only row has insufficient forbiddenImplementation rationale`
      );
    }
  }

  const futureOnlyCount = FIXTURE_FEASIBILITY_MATRIX.filter(
    (r) => r.feasibilityStatus === "future_only"
  ).length;

  const passed = violations.length === 0;
  return {
    checkName: "future_only_rows_have_rationale",
    passed,
    detail: passed
      ? `All ${futureOnlyCount} future_only rows have explicit Phase 1B prohibition rationale.`
      : `Insufficient rationale in future_only rows: ${violations.join("; ")}`,
  };
}

/**
 * No row may authorize schema, runtime extractor, event ingestion, official write,
 * auto-write, execution authority, page behavior changes, or LLM final ranking.
 *
 * This checks that evidenceRationale and boundaryRationale do not contain
 * authorization language for forbidden operations.
 */
function checkNoForbiddenImplementationAuth(): FeasibilityCheckResult {
  const AUTHORIZATION_PATTERNS = [
    "may add a schema",
    "may add schema",
    "may create schema",
    "may add a runtime extractor",
    "may add runtime extractor",
    "may create extractor",
    "may add event queue",
    "may create event queue",
    "authorizes official write",
    "may auto-write",
    "may auto write",
    "grants execution authority",
    "may auto-send",
    "may auto send",
    "may auto-approve",
    "may auto approve",
    "llm may determine final",
    "llm may rank",
    "may change page behavior",
  ];

  const violations: string[] = [];

  for (const row of FIXTURE_FEASIBILITY_MATRIX) {
    const checkFields = [row.evidenceRationale, row.boundaryRationale];
    for (const field of checkFields) {
      const lower = field.toLowerCase();
      for (const pattern of AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.fixtureId}: field contains authorization pattern "${pattern}"`
          );
        }
      }
    }
  }

  const passed = violations.length === 0;
  return {
    checkName: "no_forbidden_implementation_auth",
    passed,
    detail: passed
      ? "No row authorizes schema, runtime extractor, event ingestion, official write, auto-write, execution authority, page behavior changes, or LLM final ranking."
      : `Forbidden authorization found: ${violations.join("; ")}`,
  };
}

// ---------------------------------------------------------------------------
// Main evaluator entry point
// ---------------------------------------------------------------------------

export function evaluateReadModelFeasibility(): FeasibilityEvalSummary {
  const checks: FeasibilityCheckResult[] = [
    checkAll20FixturesMapped(),
    checkNoUnknownFixtureIds(),
    checkAtLeast3SourceClassesFeasible(),
    checkFutureOnlyRowsHaveRationale(),
    checkNoForbiddenImplementationAuth(),
  ];

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  return {
    totalChecks: checks.length,
    passed,
    failed,
    checks,
    overallPassed: failed === 0,
  };
}

// ---------------------------------------------------------------------------
// Summary statistics helpers (for reporting)
// ---------------------------------------------------------------------------

export function getFeasibilityStats(): {
  total: number;
  byStatus: Record<FeasibilityStatus, number>;
  bySource: Record<string, { current: number; thin: number; future: number }>;
  feasibleSourceClassCount: number;
  futureOnlyCount: number;
} {
  const byStatus: Record<FeasibilityStatus, number> = {
    current_read_model_supported: 0,
    requires_thin_projection: 0,
    future_only: 0,
  };

  const bySource: Record<string, { current: number; thin: number; future: number }> =
    {};

  for (const row of FIXTURE_FEASIBILITY_MATRIX) {
    byStatus[row.feasibilityStatus]++;

    if (!bySource[row.sourceType]) {
      bySource[row.sourceType] = { current: 0, thin: 0, future: 0 };
    }

    if (row.feasibilityStatus === "current_read_model_supported") {
      bySource[row.sourceType].current++;
    } else if (row.feasibilityStatus === "requires_thin_projection") {
      bySource[row.sourceType].thin++;
    } else {
      bySource[row.sourceType].future++;
    }
  }

  const feasibleSourceClassCount = Object.values(bySource).filter(
    (counts) => counts.current + counts.thin > 0
  ).length;

  return {
    total: FEASIBILITY_MATRIX_ROW_COUNT,
    byStatus,
    bySource,
    feasibleSourceClassCount,
    futureOnlyCount: byStatus.future_only,
  };
}
