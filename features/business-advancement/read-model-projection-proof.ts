/**
 * Helm Business Advancement — Phase 2B Read-Model Projection Proof
 *
 * Machine-readable proof matrix covering meeting, tenant_resource, and crm
 * active candidate sources. Planning-only.
 *
 * Allowed: type definitions, proof rows, pure evaluator checks.
 * Forbidden: schema, API route, runtime extractor, event ingestion,
 *   official write, auto execution, auto send, LLM ranking,
 *   page behavior changes.
 */

import type { SourceType, SignalType } from "./contracts";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";
import { FIXTURE_FEASIBILITY_MATRIX } from "./read-model-feasibility";
import { buildMustPushAdapterResults } from "./must-push-adapter";

// ---------------------------------------------------------------------------
// Proof types
// ---------------------------------------------------------------------------

export type ProjectionReadinessStatus =
  | "projection_ready"
  | "needs_thin_projection_review"
  | "not_ready";

/**
 * One row in the read-model projection proof matrix.
 * Covers one source type and all its active Phase 2 candidate fixtures.
 * Planning artifact only — not a runtime object, schema, or API.
 */
export interface ReadModelProjectionProofRow {
  readonly sourceType: SourceType;
  readonly coveredFixtureIds: readonly string[];
  /**
   * File path(s) and function name(s) that already own or can thin-project
   * this source's signals, as cited in the Phase 1B feasibility matrix.
   */
  readonly existingReadModelPath: string;
  readonly projectedSignalTypes: readonly SignalType[];
  /**
   * Why workspace/membership/capability boundaries are sufficient and no
   * cross-tenant or elevated access is needed for any covered fixture.
   */
  readonly membershipCapabilityBoundaryNote: string;
  /**
   * Explicit proof that no new schema, runtime extractor, event ingestion,
   * official write, auto execution, LLM ranking, or page behavior change is
   * needed for this source's thin projection.
   */
  readonly whyNoSchemaOrExtractor: string;
  readonly readinessStatus: ProjectionReadinessStatus;
}

// ---------------------------------------------------------------------------
// Proof matrix — 3 active candidate source types
// ---------------------------------------------------------------------------

export const READ_MODEL_PROJECTION_PROOF: readonly ReadModelProjectionProofRow[] =
  [
    // -----------------------------------------------------------------------
    // Source: meeting | Fixtures: AS-FX-001, AS-FX-002, AS-FX-003
    // -----------------------------------------------------------------------
    {
      sourceType: "meeting",
      coveredFixtureIds: ["AS-FX-001", "AS-FX-002", "AS-FX-003"],
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: " +
        "loadPostMeetingItems (AS-FX-001, AS-FX-003 current), " +
        "loadPendingApprovals (AS-FX-002 thin review)",
      projectedSignalTypes: [
        "customer_waiting",
        "blocked_decision",
        "overdue_commitment",
      ],
      membershipCapabilityBoundaryNote:
        "All queries scope by workspaceId. No cross-workspace or cross-tenant meeting data " +
        "is accessible. actorUserId and membershipRole gate which items are visible. " +
        "Output is planning-only MustPushItem requiring human review. " +
        "No meeting write, no action-item auto-completion, no draft auto-send.",
      whyNoSchemaOrExtractor:
        "AS-FX-001 (customer_waiting) and AS-FX-003 (overdue_commitment) are fully covered by " +
        "the existing loadPostMeetingItems query: db.actionItem where meetingId IS NOT NULL, " +
        "status IN PENDING_APPROVAL/MANUAL, dueDate < now for overdue. " +
        "AS-FX-002 (blocked_decision) needs only a thin read-only filter " +
        "(actionItems without approvalTask, past 48 h) added to loadPendingApprovals — " +
        "no new schema column, no transcript parser, no event queue, no write authority, no LLM ranking. " +
        "All three fixtures project from existing db.actionItem and db.approvalTask fields only.",
      readinessStatus: "needs_thin_projection_review",
    },

    // -----------------------------------------------------------------------
    // Source: crm | Fixtures: AS-FX-004, AS-FX-005, AS-FX-006
    // -----------------------------------------------------------------------
    {
      sourceType: "crm",
      coveredFixtureIds: ["AS-FX-004", "AS-FX-005", "AS-FX-006"],
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: " +
        "loadHighRiskOpportunities (AS-FX-004 thin), loadOverdueOpportunities (AS-FX-005 thin); " +
        "data/queries.ts :: getOpportunityCommercialDetailData (AS-FX-005 thin, AS-FX-006 thin)",
      projectedSignalTypes: [
        "stalled_opportunity",
        "overdue_commitment",
        "customer_waiting",
      ],
      membershipCapabilityBoundaryNote:
        "Opportunity queries scope by workspaceId via Prisma where clause. " +
        "No CRM data crosses workspace or tenant boundaries. " +
        "No write to opportunity stage, forecast, commitment status, or external proposal. " +
        "All three fixtures carry review_required posture — output is planning-only.",
      whyNoSchemaOrExtractor:
        "AS-FX-004 (stalled_opportunity) needs only a staleness filter " +
        "(opportunity.updatedAt < now-14d) on the existing loadHighRiskOpportunities path — " +
        "no last_activity_at column required. " +
        "AS-FX-005 (overdue_commitment) needs a thin read-only query over existing db.commitment rows " +
        "(dueDate < now, no recent owner update) — commitment table already exists from prior work. " +
        "AS-FX-006 (customer_waiting) joins existing opportunity.updatedAt with emailThread foreign key — " +
        "no customer_waiting_flag column needed. " +
        "None of the three require a CRM activity-feed extractor, event queue, " +
        "auto stage change, auto send, or LLM ranking.",
      readinessStatus: "needs_thin_projection_review",
    },

    // -----------------------------------------------------------------------
    // Source: tenant_resource | Fixtures: AS-FX-007, AS-FX-008, AS-FX-009
    // -----------------------------------------------------------------------
    {
      sourceType: "tenant_resource",
      coveredFixtureIds: ["AS-FX-007", "AS-FX-008", "AS-FX-009"],
      existingReadModelPath:
        "features/mobile/lib/mobile-command-read-model.ts :: loadTenantResourceIssues; " +
        "lib/tenant-resources/workspace-operating-impact-query.ts :: " +
        "getWorkspaceTenantResourceOperatingImpactReadout",
      projectedSignalTypes: [
        "stalled_case",
        "overdue_commitment",
        "resource_evidence_gap",
      ],
      membershipCapabilityBoundaryNote:
        "Tenant resource queries scope by workspaceId and are additionally gated by actorUserId " +
        "and membershipRole inside getWorkspaceTenantResourceOperatingImpactReadout. " +
        "No cross-tenant resource data is accessible. " +
        "No write to the legacy system, no SLA auto-completion, no auto-archival, no proof auto-generation.",
      whyNoSchemaOrExtractor:
        "AS-FX-008 (overdue_commitment) and AS-FX-009 (resource_evidence_gap) are fully covered: " +
        "loadTenantResourceIssues already filters followThroughStatus='blocked' (overdue SLA) " +
        "and proofRequired=true (evidence gap) from getWorkspaceTenantResourceOperatingImpactReadout. " +
        "AS-FX-007 (stalled_case) needs only a thin additional staleness filter " +
        "(staleDays > 14 regardless of severity) — no new schema column for staleness, " +
        "no legacy-system poller, no event queue, no write authority, no LLM ranking. " +
        "All three project from existing operating impact readout fields only.",
      readinessStatus: "needs_thin_projection_review",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Proof evaluator types and checks (pure, no side effects)
// ---------------------------------------------------------------------------

export interface ProofCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ProofEvalSummary {
  readonly totalRows: number;
  readonly coveredSourceTypes: readonly string[];
  readonly checks: readonly ProofCheckResult[];
  readonly allPassed: boolean;
}

const REQUIRED_SOURCE_TYPES: readonly SourceType[] = [
  "meeting",
  "tenant_resource",
  "crm",
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

function checkRequiredSourceTypesCovered(): ProofCheckResult {
  const covered = new Set(READ_MODEL_PROJECTION_PROOF.map((r) => r.sourceType));
  const missing = REQUIRED_SOURCE_TYPES.filter((s) => !covered.has(s));
  const passed = missing.length === 0;
  return {
    checkName: "required_source_types_covered",
    passed,
    detail: passed
      ? `All required source types covered: ${REQUIRED_SOURCE_TYPES.join(", ")}.`
      : `Missing source types: ${missing.join(", ")}.`,
  };
}

function checkAllProofRowsReadOnly(): ProofCheckResult {
  const violations: string[] = [];
  for (const row of READ_MODEL_PROJECTION_PROOF) {
    const fields = [
      row.membershipCapabilityBoundaryNote,
      row.whyNoSchemaOrExtractor,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.sourceType}: contains authorization pattern "${pattern}"`
          );
        }
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "all_proof_rows_read_only",
    passed,
    detail: passed
      ? "No proof row authorizes schema, extractor, write, or execution patterns."
      : `Forbidden patterns found: ${violations.join("; ")}`,
  };
}

function checkCoveredFixtureIdsAreActive(): ProofCheckResult {
  const adapterResults = buildMustPushAdapterResults(
    ADVANCEMENT_SIGNAL_FIXTURES,
    FIXTURE_FEASIBILITY_MATRIX
  );
  const activeIds = new Set(
    adapterResults
      .filter((r) => r.status === "active")
      .map((r) => r.fixtureId)
  );
  const knownIds = new Set(
    ADVANCEMENT_SIGNAL_FIXTURES.map((f) => f.fixtureId)
  );

  const violations: string[] = [];
  for (const row of READ_MODEL_PROJECTION_PROOF) {
    for (const fixtureId of row.coveredFixtureIds) {
      if (!knownIds.has(fixtureId)) {
        violations.push(
          `${row.sourceType}/${fixtureId}: fixture ID does not exist`
        );
      } else if (!activeIds.has(fixtureId)) {
        violations.push(
          `${row.sourceType}/${fixtureId}: not an active Phase 2 candidate`
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "covered_fixture_ids_are_active_candidates",
    passed,
    detail: passed
      ? "All covered fixture IDs exist and are active Phase 2 adapter candidates."
      : `Non-active or unknown fixtures: ${violations.join("; ")}`,
  };
}

function checkNoFutureOnlyOrBlockedCovered(): ProofCheckResult {
  const adapterResults = buildMustPushAdapterResults(
    ADVANCEMENT_SIGNAL_FIXTURES,
    FIXTURE_FEASIBILITY_MATRIX
  );
  const deferredIds = new Set(
    adapterResults
      .filter((r) => r.status === "deferred")
      .map((r) => r.fixtureId)
  );

  const violations: string[] = [];
  for (const row of READ_MODEL_PROJECTION_PROOF) {
    for (const fixtureId of row.coveredFixtureIds) {
      if (deferredIds.has(fixtureId)) {
        violations.push(
          `${row.sourceType}/${fixtureId}: deferred fixture covered as active`
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_future_only_or_blocked_covered_as_active",
    passed,
    detail: passed
      ? "No future_only or blocked fixture is covered as an active projection candidate."
      : `Deferred fixtures incorrectly covered: ${violations.join("; ")}`,
  };
}

function checkAllRowsHaveNonEmptyFields(): ProofCheckResult {
  const violations: string[] = [];
  for (const row of READ_MODEL_PROJECTION_PROOF) {
    if (row.coveredFixtureIds.length === 0)
      violations.push(`${row.sourceType}: coveredFixtureIds is empty`);
    if (row.projectedSignalTypes.length === 0)
      violations.push(`${row.sourceType}: projectedSignalTypes is empty`);
    if (row.existingReadModelPath.trim() === "")
      violations.push(`${row.sourceType}: existingReadModelPath is empty`);
    if (row.membershipCapabilityBoundaryNote.trim() === "")
      violations.push(
        `${row.sourceType}: membershipCapabilityBoundaryNote is empty`
      );
    if (row.whyNoSchemaOrExtractor.trim() === "")
      violations.push(`${row.sourceType}: whyNoSchemaOrExtractor is empty`);
  }
  const passed = violations.length === 0;
  return {
    checkName: "all_rows_have_non_empty_fields",
    passed,
    detail: passed
      ? "All proof rows have non-empty required fields."
      : `Empty fields: ${violations.join("; ")}`,
  };
}

export function evaluateReadModelProjectionProof(): ProofEvalSummary {
  const checks: ProofCheckResult[] = [
    checkRequiredSourceTypesCovered(),
    checkAllProofRowsReadOnly(),
    checkCoveredFixtureIdsAreActive(),
    checkNoFutureOnlyOrBlockedCovered(),
    checkAllRowsHaveNonEmptyFields(),
  ];

  return {
    totalRows: READ_MODEL_PROJECTION_PROOF.length,
    coveredSourceTypes: READ_MODEL_PROJECTION_PROOF.map((r) => r.sourceType),
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
