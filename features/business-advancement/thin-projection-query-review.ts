/**
 * Helm Business Advancement — Phase 2C Thin Projection Query Review
 *
 * Machine-readable query-level review for the five thin projections identified
 * in Phase 2B. Planning artifact only.
 *
 * Allowed: type definitions, review rows, pure evaluator checks.
 * Forbidden: schema, API route, runtime extractor, event ingestion,
 *   official write, auto execution, auto send, LLM ranking,
 *   page behavior changes.
 */

import type { SourceType, SignalType } from "./contracts";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";
import { FIXTURE_FEASIBILITY_MATRIX } from "./read-model-feasibility";
import { buildMustPushAdapterResults } from "./must-push-adapter";

// ---------------------------------------------------------------------------
// Query review types
// ---------------------------------------------------------------------------

export type ThinProjectionRuntimePosture = "review_only_not_implemented";

export type ThinProjectionReadinessStatus =
  | "query_review_passed_for_later_thin_projection"
  | "needs_additional_scope_evidence"
  | "blocked";

/**
 * A structured pseudo-query description — not executable code.
 * Describes the proposed read-only Prisma where clause for a thin projection.
 */
export interface ProposedReadOnlyWhereClause {
  /** Primary table or function being queried. */
  readonly table: string;
  /** Human-readable where-clause conditions as an ordered list. */
  readonly whereClauses: readonly string[];
  /** Optional note about joins or nested filters. */
  readonly joinNote?: string;
  /** Optional ordering description. */
  readonly orderBy?: string;
  /** Optional item count limit. */
  readonly take?: number;
}

/**
 * One row in the thin projection query review artifact.
 * Planning artifact only — not a runtime object, schema, or API.
 */
export interface ThinProjectionQueryReviewRow {
  /** Unique review identifier for this Phase 2C row. */
  readonly reviewId: string;
  readonly sourceType: SourceType;
  /** The Phase 1A fixture this row reviews. */
  readonly fixtureId: string;
  readonly signalType: SignalType;
  /** Existing read-model path used as the base for this thin projection. */
  readonly existingReadModelPath: string;
  /**
   * Proposed read-only where clause — structured pseudo-query only.
   * Not executable, not a schema change, not a runtime call.
   */
  readonly proposedReadOnlyWhereClause: ProposedReadOnlyWhereClause;
  /** Confirmation that workspace isolation is enforced and how. */
  readonly workspaceScopeCheck: string;
  /** Confirmation that membership/capability boundaries are enforced. */
  readonly membershipCapabilityGateCheck: string;
  /** Excluded states and noise guards to prevent false positives. */
  readonly excludedStatesOrNoiseGuards: readonly string[];
  /** Boundary note carried from the fixture. */
  readonly boundaryNote: string;
  /**
   * Must always be "review_only_not_implemented".
   * This artifact is query-review only; no runtime adoption in Phase 2C.
   */
  readonly runtimeAdoptionPosture: ThinProjectionRuntimePosture;
  readonly readinessStatus: ThinProjectionReadinessStatus;
  /** Remaining uncertainty or risk after this review. */
  readonly residualRisk: string;
}

// ---------------------------------------------------------------------------
// Query review rows — 5 thin projections from Phase 2B
// ---------------------------------------------------------------------------

export const THIN_PROJECTION_QUERY_REVIEW: readonly ThinProjectionQueryReviewRow[] =
  [
    // -----------------------------------------------------------------------
    // TPQR-001 | meeting | AS-FX-002 | blocked_decision
    // -----------------------------------------------------------------------
    {
      reviewId: "TPQR-001",
      sourceType: "meeting",
      fixtureId: "AS-FX-002",
      signalType: "blocked_decision",
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: loadPendingApprovals — " +
        "queries db.approvalTask where { workspaceId, status: 'PENDING' }",
      proposedReadOnlyWhereClause: {
        table: "ActionItem",
        whereClauses: [
          "workspaceId = $workspaceId",
          "meetingId IS NOT NULL",
          "status IN ('PENDING_APPROVAL', 'MANUAL')",
          "approvalTask IS NULL",
          "updatedAt < NOW() - INTERVAL '48 HOURS'",
        ],
        joinNote:
          "approvalTask is a nullable one-to-one relation on ActionItem; " +
          "Prisma filter: { approvalTask: { is: null } }. " +
          "Include meeting relation for display name only.",
        orderBy: "dueDate ASC NULLS LAST",
        take: 3,
      },
      workspaceScopeCheck:
        "ActionItem.workspaceId is a non-nullable FK to Workspace with CASCADE delete. " +
        "Index (workspaceId, status) is present. The where clause MUST include " +
        "workspaceId = $workspaceId as the leading filter to use the index and enforce isolation.",
      membershipCapabilityGateCheck:
        "The workspaceId is supplied by the authenticated route/action that has already " +
        "verified workspace membership. No cross-workspace or cross-tenant access is possible " +
        "through this query. No approval authority is granted — output is a human_owner_required " +
        "MustPushItem prompting a human to assign a decision owner.",
      excludedStatesOrNoiseGuards: [
        "status IN ('PENDING_APPROVAL', 'MANUAL') only — excludes DONE, CANCELLED, EXECUTED",
        "approvalTask IS NULL — items with an existing pending approval task are already handled by loadPendingApprovals",
        "48h updatedAt threshold — prevents surfacing brand-new action items not yet assigned an owner",
        "meetingId IS NOT NULL — restricts to meeting-sourced items only; non-meeting action items excluded",
      ],
      boundaryNote:
        "explanation != approval. Output is a read-only suggestion to assign a decision owner. " +
        "No approvalTask is auto-created, no owner is auto-assigned, no contract terms are auto-approved.",
      runtimeAdoptionPosture: "review_only_not_implemented",
      readinessStatus: "query_review_passed_for_later_thin_projection",
      residualRisk:
        "The 48h threshold is a calibration choice. If set too tight, legitimate recently-created " +
        "items with no owner yet will be missed. Threshold must be tuned against real data " +
        "before runtime adoption. No schema change is required; risk is implementation-tuning only.",
    },

    // -----------------------------------------------------------------------
    // TPQR-002 | crm | AS-FX-004 | stalled_opportunity
    // -----------------------------------------------------------------------
    {
      reviewId: "TPQR-002",
      sourceType: "crm",
      fixtureId: "AS-FX-004",
      signalType: "stalled_opportunity",
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: loadHighRiskOpportunities — " +
        "queries db.opportunity where { workspaceId, stage NOT IN ['DONE','LOST'], riskLevel IN ['HIGH','CRITICAL'] }",
      proposedReadOnlyWhereClause: {
        table: "Opportunity",
        whereClauses: [
          "workspaceId = $workspaceId",
          "stage NOT IN ('DONE', 'LOST')",
          "updatedAt < NOW() - INTERVAL '14 DAYS'",
          "(dueDate IS NULL OR dueDate >= NOW())",
        ],
        joinNote:
          "Include company relation for display name. " +
          "The '(dueDate IS NULL OR dueDate >= NOW())' guard mirrors the existing " +
          "loadHighRiskOpportunities exclusion of already-overdue items to prevent " +
          "duplication with loadOverdueOpportunities.",
        orderBy: "updatedAt ASC",
        take: 3,
      },
      workspaceScopeCheck:
        "Opportunity.workspaceId is a non-nullable FK to Workspace with CASCADE delete. " +
        "The existing loadHighRiskOpportunities already applies workspaceId as the first " +
        "where clause. The thin projection extends only the filter conditions, not the scope.",
      membershipCapabilityGateCheck:
        "workspaceId is supplied by the authenticated route/action that verifies membership. " +
        "No elevated permission is needed. Output is a review_required MustPushItem suggesting " +
        "a human owner reviews next steps — no stage change, no forecast update, no auto-send.",
      excludedStatesOrNoiseGuards: [
        "stage NOT IN ('DONE', 'LOST') — terminal stages excluded",
        "dueDate IS NULL OR dueDate >= NOW() — already-overdue opportunities excluded (handled by loadOverdueOpportunities)",
        "14-day staleness threshold on updatedAt — prevents surfacing recently-updated opportunities",
        "take: 3 — caps output to prevent noise from long tail of mildly-stalled opportunities",
      ],
      boundaryNote:
        "recommendation != commitment. Output suggests a human owner checks next steps. " +
        "No CRM stage change, no forecast update, no proposal auto-send.",
      runtimeAdoptionPosture: "review_only_not_implemented",
      readinessStatus: "query_review_passed_for_later_thin_projection",
      residualRisk:
        "Opportunities updated by system automation (e.g., scheduled sync) may reset updatedAt " +
        "and be incorrectly excluded from staleness detection. A 'last human activity' field would " +
        "give more accurate staleness but is not in the current schema. The 14d/updatedAt approach " +
        "is a pragmatic approximation; false negatives are possible for auto-synced records.",
    },

    // -----------------------------------------------------------------------
    // TPQR-003 | crm | AS-FX-005 | overdue_commitment
    // -----------------------------------------------------------------------
    {
      reviewId: "TPQR-003",
      sourceType: "crm",
      fixtureId: "AS-FX-005",
      signalType: "overdue_commitment",
      existingReadModelPath:
        "data/queries.ts :: getOpportunityCommercialDetailData — " +
        "queries db.commitment.findMany for opportunity-linked commitment records",
      proposedReadOnlyWhereClause: {
        table: "Commitment",
        whereClauses: [
          "workspaceId = $workspaceId",
          "dueDate < NOW()",
          "status NOT IN ('FULFILLED', 'CANCELED')",
          "(ownerUserId IS NULL OR updatedAt < NOW() - INTERVAL '7 DAYS')",
        ],
        joinNote:
          "Optional: include relatedOpportunity and relatedCompany for display context. " +
          "The ownerUserId IS NULL OR updatedAt < 7d guard targets commitments with no " +
          "assigned owner or no recent owner activity.",
        orderBy: "dueDate ASC",
        take: 5,
      },
      workspaceScopeCheck:
        "Commitment.workspaceId is confirmed in prisma/schema.prisma (line 3916) as a " +
        "non-nullable FK to Workspace with CASCADE delete. Multiple composite indexes on " +
        "(workspaceId, ...) are present. " +
        "Phase 2B residual risk — 'commitment workspace scope unverified' — is RESOLVED: " +
        "the schema evidence confirms workspaceId is always set and enforced.",
      membershipCapabilityGateCheck:
        "workspaceId is supplied by the authenticated route/action that verifies membership. " +
        "The Commitment table does not expose cross-workspace data via any relation. " +
        "Output is a review_required MustPushItem — no commitment auto-marked as fulfilled, " +
        "no auto-send of delivery materials, no owner auto-assignment.",
      excludedStatesOrNoiseGuards: [
        "status NOT IN ('FULFILLED', 'CANCELED') — only OPEN, IN_PROGRESS, OVERDUE reach this projection",
        "dueDate < NOW() — only past-due commitments; future commitments excluded",
        "ownerUserId IS NULL OR updatedAt < 7d — targets commitments with no response; excludes active commitments being worked",
        "take: 5 — caps output to top 5 by dueDate ASC to surface oldest overdue first",
      ],
      boundaryNote:
        "recommendation != commitment. System suggests follow-up; no fulfillment status auto-written, " +
        "no delivery auto-sent, no commitment record auto-closed.",
      runtimeAdoptionPosture: "review_only_not_implemented",
      readinessStatus: "query_review_passed_for_later_thin_projection",
      residualRisk:
        "The ownerUserId IS NULL OR updatedAt < 7d heuristic may incorrectly include commitments " +
        "that were recently reassigned. The 7d threshold must be calibrated. " +
        "Commitment.overdueFlag (Boolean) is already in the schema and may be a more reliable " +
        "overdue indicator than dueDate < NOW() if the flag is kept up-to-date by the existing " +
        "commitment management flow — this should be verified in runtime implementation.",
    },

    // -----------------------------------------------------------------------
    // TPQR-004 | crm | AS-FX-006 | customer_waiting
    // -----------------------------------------------------------------------
    {
      reviewId: "TPQR-004",
      sourceType: "crm",
      fixtureId: "AS-FX-006",
      signalType: "customer_waiting",
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: loadWaitingEmailThreads — " +
        "queries db.emailThread where { workspaceId, status: 'WAITING_US' }",
      proposedReadOnlyWhereClause: {
        table: "EmailThread",
        whereClauses: [
          "workspaceId = $workspaceId",
          "opportunityId IS NOT NULL",
          "status = 'WAITING_US'",
          "opportunity.stage NOT IN ('DONE', 'LOST')",
          "opportunity.updatedAt < NOW() - INTERVAL '7 DAYS'",
        ],
        joinNote:
          "Join Opportunity via EmailThread.opportunityId FK (prisma/schema.prisma line 3022). " +
          "Both EmailThread.workspaceId and Opportunity.workspaceId are enforced — the join is " +
          "safe because EmailThread.opportunityId references an Opportunity that already belongs " +
          "to the same workspace via its own workspaceId column. " +
          "Include company relation on the opportunity for display name.",
        orderBy: "updatedAt ASC",
        take: 3,
      },
      workspaceScopeCheck:
        "EmailThread.workspaceId is confirmed in prisma/schema.prisma (line 3019) as a " +
        "non-nullable FK with CASCADE delete. EmailThread.opportunityId (line 3022) is a " +
        "nullable FK to Opportunity; Opportunity independently enforces its own workspaceId. " +
        "Phase 2B residual risk — 'emailThread FK/workspace path unverified' — is RESOLVED: " +
        "both tables have direct workspaceId columns; cross-workspace leakage is not possible " +
        "through this join as long as both where clauses include workspaceId = $workspaceId.",
      membershipCapabilityGateCheck:
        "workspaceId is supplied by the authenticated route/action that verifies membership. " +
        "The opportunityId IS NOT NULL filter further restricts to CRM-linked threads. " +
        "Output is a review_required MustPushItem — no proposal auto-sent, no email auto-replied, " +
        "no CRM stage auto-changed.",
      excludedStatesOrNoiseGuards: [
        "opportunityId IS NOT NULL — threads not linked to a CRM opportunity are excluded from this projection (they are handled by the existing loadWaitingEmailThreads)",
        "status = 'WAITING_US' — only threads where we owe a reply; OPEN, CLOSED excluded",
        "opportunity.stage NOT IN ('DONE', 'LOST') — threads on closed opportunities excluded",
        "opportunity.updatedAt < 7 days — only stalled opportunities; recently-active excluded",
        "Deduplication: this projection targets CRM-context customer_waiting; email-only waiting already handled by loadWaitingEmailThreads; runtime implementation must avoid surfacing the same thread twice",
      ],
      boundaryNote:
        "draft != send. Output suggests preparing a proposal draft for review — not auto-sending. " +
        "No forecast update, no stage change, no external proposal auto-sent.",
      runtimeAdoptionPosture: "review_only_not_implemented",
      readinessStatus: "query_review_passed_for_later_thin_projection",
      residualRisk:
        "The nullable opportunityId means WAITING_US email threads not linked to a CRM opportunity " +
        "are outside this projection's scope. This is intentional for the CRM signal (AS-FX-006) " +
        "but means non-CRM-linked waiting threads must continue to rely on the existing " +
        "loadWaitingEmailThreads path. Runtime implementation must ensure no double-counting " +
        "between the two paths when both are active.",
    },

    // -----------------------------------------------------------------------
    // TPQR-005 | tenant_resource | AS-FX-007 | stalled_case
    // -----------------------------------------------------------------------
    {
      reviewId: "TPQR-005",
      sourceType: "tenant_resource",
      fixtureId: "AS-FX-007",
      signalType: "stalled_case",
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: loadTenantResourceIssues — " +
        "calls getWorkspaceTenantResourceOperatingImpactReadout and filters " +
        "severity IN ['critical','high'] OR proofRequired=true OR followThroughStatus='blocked'",
      proposedReadOnlyWhereClause: {
        table: "TenantResourceOperatingImpactReadout.impactItems (in-memory filter)",
        whereClauses: [
          "workspaceId = $workspaceId (enforced by getWorkspaceTenantResourceOperatingImpactReadout)",
          "severity IN ('medium', 'low')",
          "followThroughStatus NOT IN ('blocked')",
          "proofRequired = false",
          "derivedStaleDays > 14",
        ],
        joinNote:
          "No new DB query — this is an in-memory filter over the existing readout output. " +
          "derivedStaleDays must be computed from the underlying resource connector/importSource " +
          "updatedAt or lastSyncedAt field available inside the readout pipeline. " +
          "The existing high/critical/proof/blocked filter already handles the higher-severity " +
          "items; this projection adds a staleness-only path for medium/low severity items only.",
        orderBy: "derivedStaleDays DESC",
        take: 2,
      },
      workspaceScopeCheck:
        "getWorkspaceTenantResourceOperatingImpactReadout enforces workspaceId via all its " +
        "internal DB queries (connector, importSource, importJob, workspaceSolutionExtension, " +
        "captureSession — all filtered by workspaceId). The in-memory filter over impactItems " +
        "inherits this scope and adds no new data access.",
      membershipCapabilityGateCheck:
        "getWorkspaceTenantResourceOperatingImpactReadout accepts actorUserId, membershipRole, " +
        "and workspaceClass. These are forwarded from the authenticated caller and gate which " +
        "resource items are visible. The in-memory staleness filter does not expand this gate. " +
        "Output is a read_only posture MustPushItem — no legacy system write, no auto-escalation, " +
        "no auto-archival.",
      excludedStatesOrNoiseGuards: [
        "severity IN ('medium', 'low') only — high/critical items are already handled by the existing filter and must not be duplicated",
        "followThroughStatus NOT IN ('blocked') — blocked items are already surfaced by the existing filter",
        "proofRequired = false — items already requiring proof are handled by the existing proofRequired=true filter",
        "take: 2 — hard cap of 2 stale-but-low-severity items prevents low-priority noise from pushing high-severity items below the fold",
        "derivedStaleDays > 14 threshold — prevents surfacing recently-stalled resources; threshold avoids false positives from transient sync delays",
      ],
      boundaryNote:
        "recommendation != commitment. Output is a read_only notification to review a stalled " +
        "resource. No write to the legacy system, no status auto-change, no auto-archival, " +
        "no priority auto-escalation.",
      runtimeAdoptionPosture: "review_only_not_implemented",
      readinessStatus: "query_review_passed_for_later_thin_projection",
      residualRisk:
        "derivedStaleDays is not an existing field on TenantResourceOperatingImpactItem; it must " +
        "be computed inside the readout pipeline from connector.lastSyncedAt or importSource.updatedAt. " +
        "The exact derivation logic must be confirmed during runtime implementation to ensure it " +
        "reflects human-meaningful staleness rather than system-sync timing. The take: 2 noise guard " +
        "is a conservative starting value; the limit may need calibration against real workspaces.",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Query review evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface QueryReviewCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface QueryReviewEvalSummary {
  readonly totalRows: number;
  readonly checks: readonly QueryReviewCheckResult[];
  readonly allPassed: boolean;
}

const REQUIRED_FIXTURE_IDS = [
  "AS-FX-002",
  "AS-FX-004",
  "AS-FX-005",
  "AS-FX-006",
  "AS-FX-007",
] as const;

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "may add runtime extractor",
  "may add a runtime extractor",
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
  "llm may determine",
  "llm may rank",
  "may change page behavior",
  "may add api route",
] as const;

function checkExactlyFiveRows(): QueryReviewCheckResult {
  const passed = THIN_PROJECTION_QUERY_REVIEW.length === 5;
  return {
    checkName: "exactly_five_review_rows",
    passed,
    detail: passed
      ? "Exactly 5 thin projection review rows present."
      : `Expected 5 rows, found ${THIN_PROJECTION_QUERY_REVIEW.length}.`,
  };
}

function checkRequiredFixturesCovered(): QueryReviewCheckResult {
  const covered = new Set(THIN_PROJECTION_QUERY_REVIEW.map((r) => r.fixtureId));
  const missing = REQUIRED_FIXTURE_IDS.filter((id) => !covered.has(id));
  const passed = missing.length === 0;
  return {
    checkName: "required_fixture_ids_covered",
    passed,
    detail: passed
      ? `All required fixture IDs covered: ${REQUIRED_FIXTURE_IDS.join(", ")}.`
      : `Missing fixture IDs: ${missing.join(", ")}.`,
  };
}

function checkAllFixturesAreActiveCandidates(): QueryReviewCheckResult {
  const adapterResults = buildMustPushAdapterResults(
    ADVANCEMENT_SIGNAL_FIXTURES,
    FIXTURE_FEASIBILITY_MATRIX
  );
  const activeIds = new Set(
    adapterResults
      .filter((r) => r.status === "active")
      .map((r) => r.fixtureId)
  );
  const violations: string[] = [];
  for (const row of THIN_PROJECTION_QUERY_REVIEW) {
    if (!activeIds.has(row.fixtureId)) {
      violations.push(`${row.reviewId}/${row.fixtureId}: not an active Phase 2 adapter candidate`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "all_fixtures_are_active_candidates",
    passed,
    detail: passed
      ? "All reviewed fixtures are active Phase 2 adapter candidates."
      : `Non-active fixtures: ${violations.join("; ")}`,
  };
}

function checkAllPosturesAreReviewOnly(): QueryReviewCheckResult {
  const violations = THIN_PROJECTION_QUERY_REVIEW.filter(
    (r) => r.runtimeAdoptionPosture !== "review_only_not_implemented"
  );
  const passed = violations.length === 0;
  return {
    checkName: "all_postures_review_only_not_implemented",
    passed,
    detail: passed
      ? "All rows have runtimeAdoptionPosture === 'review_only_not_implemented'."
      : `Wrong posture: ${violations.map((r) => r.reviewId).join(", ")}`,
  };
}

function checkNoForbiddenAuthorization(): QueryReviewCheckResult {
  const violations: string[] = [];
  for (const row of THIN_PROJECTION_QUERY_REVIEW) {
    const fields = [
      row.workspaceScopeCheck,
      row.membershipCapabilityGateCheck,
      row.boundaryNote,
      row.residualRisk,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.reviewId}: field contains forbidden authorization "${pattern}"`
          );
        }
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_forbidden_authorization_patterns",
    passed,
    detail: passed
      ? "No row authorizes schema, extractor, write, or execution patterns."
      : `Forbidden patterns: ${violations.join("; ")}`,
  };
}

function checkNonEmptyScopeAndGateChecks(): QueryReviewCheckResult {
  const violations: string[] = [];
  for (const row of THIN_PROJECTION_QUERY_REVIEW) {
    if (row.workspaceScopeCheck.trim() === "") {
      violations.push(`${row.reviewId}: workspaceScopeCheck is empty`);
    }
    if (row.membershipCapabilityGateCheck.trim() === "") {
      violations.push(`${row.reviewId}: membershipCapabilityGateCheck is empty`);
    }
    if (row.excludedStatesOrNoiseGuards.length === 0) {
      violations.push(`${row.reviewId}: excludedStatesOrNoiseGuards is empty`);
    }
    if (row.residualRisk.trim() === "") {
      violations.push(`${row.reviewId}: residualRisk is empty`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "non_empty_scope_gate_and_risk_fields",
    passed,
    detail: passed
      ? "All rows have non-empty scope check, gate check, noise guards, and residual risk."
      : `Empty required fields: ${violations.join("; ")}`,
  };
}

function checkCommitmentWorkspaceScopeResolved(): QueryReviewCheckResult {
  const row = THIN_PROJECTION_QUERY_REVIEW.find(
    (r) => r.fixtureId === "AS-FX-005"
  );
  if (!row) {
    return {
      checkName: "commitment_workspace_scope_addressed",
      passed: false,
      detail: "AS-FX-005 review row not found.",
    };
  }
  const lower = row.workspaceScopeCheck.toLowerCase();
  const hasEvidence =
    lower.includes("workspaceid") &&
    (lower.includes("confirmed") || lower.includes("resolved") || lower.includes("schema.prisma"));
  return {
    checkName: "commitment_workspace_scope_addressed",
    passed: hasEvidence,
    detail: hasEvidence
      ? "AS-FX-005 workspaceScopeCheck explicitly addresses commitment workspace scope with schema evidence."
      : "AS-FX-005 workspaceScopeCheck must explicitly address commitment workspace scope with schema evidence.",
  };
}

function checkEmailThreadFKAddressed(): QueryReviewCheckResult {
  const row = THIN_PROJECTION_QUERY_REVIEW.find(
    (r) => r.fixtureId === "AS-FX-006"
  );
  if (!row) {
    return {
      checkName: "email_thread_fk_workspace_addressed",
      passed: false,
      detail: "AS-FX-006 review row not found.",
    };
  }
  const lower =
    row.workspaceScopeCheck.toLowerCase() +
    row.proposedReadOnlyWhereClause.joinNote?.toLowerCase();
  const hasEvidence =
    lower.includes("opportunityid") &&
    (lower.includes("confirmed") || lower.includes("resolved") || lower.includes("schema.prisma"));
  return {
    checkName: "email_thread_fk_workspace_addressed",
    passed: hasEvidence,
    detail: hasEvidence
      ? "AS-FX-006 explicitly addresses emailThread FK and workspace scope with schema evidence."
      : "AS-FX-006 must explicitly address emailThread FK/workspace path with schema evidence.",
  };
}

function checkTenantResourceNoiseGuardPresent(): QueryReviewCheckResult {
  const row = THIN_PROJECTION_QUERY_REVIEW.find(
    (r) => r.fixtureId === "AS-FX-007"
  );
  if (!row) {
    return {
      checkName: "tenant_resource_noise_guard_present",
      passed: false,
      detail: "AS-FX-007 review row not found.",
    };
  }
  const guards = row.excludedStatesOrNoiseGuards.join(" ").toLowerCase();
  const hasNoiseGuard =
    guards.includes("take") ||
    guards.includes("cap") ||
    guards.includes("limit") ||
    guards.includes("noise");
  return {
    checkName: "tenant_resource_noise_guard_present",
    passed: hasNoiseGuard,
    detail: hasNoiseGuard
      ? "AS-FX-007 includes a noise guard for severity-independent staleDays filtering."
      : "AS-FX-007 must include a noise guard (take/cap/limit) for severity-independent staleDays filtering.",
  };
}

export function evaluateThinProjectionQueryReview(): QueryReviewEvalSummary {
  const checks: QueryReviewCheckResult[] = [
    checkExactlyFiveRows(),
    checkRequiredFixturesCovered(),
    checkAllFixturesAreActiveCandidates(),
    checkAllPosturesAreReviewOnly(),
    checkNoForbiddenAuthorization(),
    checkNonEmptyScopeAndGateChecks(),
    checkCommitmentWorkspaceScopeResolved(),
    checkEmailThreadFKAddressed(),
    checkTenantResourceNoiseGuardPresent(),
  ];

  return {
    totalRows: THIN_PROJECTION_QUERY_REVIEW.length,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
