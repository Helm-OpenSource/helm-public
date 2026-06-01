/**
 * Helm Business Advancement — Phase 3 Entry Gate: Runtime Readiness Preflight
 *
 * Machine-readable preflight artifact answering whether each of the five
 * Phase 2C query-reviewed thin projections is ready for later read-model
 * integration planning. Planning artifact only.
 *
 * Allowed: type definitions, preflight rows, pure evaluator checks.
 * Forbidden: schema, API route, runtime extractor, event ingestion,
 *   official write, auto execution, auto send, LLM ranking,
 *   page behavior changes.
 */

import type { SourceType, SignalType } from "./contracts";

// ---------------------------------------------------------------------------
// Preflight types
// ---------------------------------------------------------------------------

export type RuntimeReadinessStatus =
  | "ready_for_thin_read_model_planning"
  | "conditional_requires_runtime_guard"
  | "not_ready_requires_followup";

export type RuntimeReadinessPosture = "review_only_not_implemented";

/**
 * One row in the Phase 3 runtime readiness preflight artifact.
 * Each row answers a specific runtime-readiness question for one
 * Phase 2C query-reviewed thin projection.
 * Planning artifact only — not a runtime object, schema, or API.
 */
export interface RuntimeReadinessPreflightRow {
  /** Unique preflight identifier for this Phase 3 row. */
  readonly preflightId: string;
  /** The Phase 2C review ID this preflight answers for. */
  readonly linkedTpqrId: string;
  readonly fixtureId: string;
  readonly sourceType: SourceType;
  readonly signalType: SignalType;
  readonly runtimeReadinessStatus: RuntimeReadinessStatus;
  /**
   * Concrete repo evidence cited to determine readiness status.
   * Must reference specific files, function names, or grep results.
   */
  readonly repoEvidence: string;
  /** Whether workspace isolation and membership gate are confirmed for this row. */
  readonly workspaceMembershipBoundaryConfirmed: boolean;
  /**
   * Required when runtimeReadinessStatus === "conditional_requires_runtime_guard".
   * Describes the specific guard that must be resolved before runtime adoption.
   */
  readonly conditionalRuntimeGuard?: string;
  /**
   * Required when runtimeReadinessStatus === "not_ready_requires_followup".
   * Describes what follow-up work is required.
   */
  readonly followUpRequired?: string;
  /**
   * Must always be "review_only_not_implemented".
   * This artifact is a preflight review; no runtime adoption in Phase 3 entry gate.
   */
  readonly runtimeAdoptionPosture: RuntimeReadinessPosture;
}

// ---------------------------------------------------------------------------
// Preflight rows — 5 thin projections from Phase 2C
// ---------------------------------------------------------------------------

export const RUNTIME_READINESS_PREFLIGHT: readonly RuntimeReadinessPreflightRow[] =
  [
    // -----------------------------------------------------------------------
    // PF3-001 | TPQR-001 | meeting | AS-FX-002 | blocked_decision
    // -----------------------------------------------------------------------
    {
      preflightId: "PF3-001",
      linkedTpqrId: "TPQR-001",
      fixtureId: "AS-FX-002",
      sourceType: "meeting",
      signalType: "blocked_decision",
      runtimeReadinessStatus: "ready_for_thin_read_model_planning",
      repoEvidence:
        "ActionItem schema confirmed in prisma/schema.prisma: workspaceId non-nullable FK to Workspace " +
        "with CASCADE delete; approvalTask is a nullable one-to-one relation (ApprovalTask?); " +
        "meetingId is a nullable FK to Meeting. " +
        "Existing loadPendingApprovals in features/mobile/lib/mobile-command-read-model.ts already " +
        "queries db.approvalTask where { workspaceId, status: 'PENDING' } — TPQR-001 extends this path " +
        "with a thin read-only filter (approvalTask IS NULL, updatedAt < 48h) that requires no schema change. " +
        "No blocking residual risk from Phase 2C: 48h threshold is a tuning concern, not a structural blocker.",
      workspaceMembershipBoundaryConfirmed: true,
      runtimeAdoptionPosture: "review_only_not_implemented",
    },

    // -----------------------------------------------------------------------
    // PF3-002 | TPQR-002 | crm | AS-FX-004 | stalled_opportunity
    // -----------------------------------------------------------------------
    {
      preflightId: "PF3-002",
      linkedTpqrId: "TPQR-002",
      fixtureId: "AS-FX-004",
      sourceType: "crm",
      signalType: "stalled_opportunity",
      runtimeReadinessStatus: "conditional_requires_runtime_guard",
      repoEvidence:
        "loadHighRiskOpportunities in features/mobile/lib/mobile-command-read-model.ts uses " +
        "Opportunity.updatedAt for staleness detection (stage NOT IN ['DONE','LOST'], riskLevel IN ['HIGH','CRITICAL']). " +
        "TPQR-002 proposes extending staleness detection to updatedAt < NOW()-14d. " +
        "No TypeScript code found that confirms automated CRM sync jobs do NOT reset Opportunity.updatedAt. " +
        "Phase 2C residual risk: 'system automation may reset updatedAt and incorrectly exclude stalled opportunities' " +
        "remains unresolved — no counter-evidence found in the codebase.",
      workspaceMembershipBoundaryConfirmed: true,
      conditionalRuntimeGuard:
        "Before runtime adoption: verify that no scheduled CRM sync job auto-updates Opportunity.updatedAt " +
        "on every sync cycle. If such a job exists, staleness detection via updatedAt < 14d will yield false " +
        "negatives for auto-synced records. If confirmed, add a lastHumanActivityAt field or a sync-write-exempt " +
        "flag before adopting this thin projection at runtime.",
      runtimeAdoptionPosture: "review_only_not_implemented",
    },

    // -----------------------------------------------------------------------
    // PF3-003 | TPQR-003 | crm | AS-FX-005 | overdue_commitment
    // -----------------------------------------------------------------------
    {
      preflightId: "PF3-003",
      linkedTpqrId: "TPQR-003",
      fixtureId: "AS-FX-005",
      sourceType: "crm",
      signalType: "overdue_commitment",
      runtimeReadinessStatus: "conditional_requires_runtime_guard",
      repoEvidence:
        "Commitment.overdueFlag is actively referenced by TypeScript code. " +
        "lib/memory/shared.ts:254 defines deriveOverdueFlag(input) from deriveCommitmentStatus(input). " +
        "lib/memory/commitment.service.ts:72 returns overdueFlag: deriveOverdueFlag(row) from getCommitments. " +
        "lib/memory/commitment.service.ts:112 writes overdueFlag during createCommitment, and " +
        "lib/memory/commitment.service.ts:194 writes overdueFlag during updateCommitmentStatus. " +
        "data/queries.ts:351 and features/meetings/queries.ts:437 read overdueFlag in existing surfaces. " +
        "Commitment.workspaceId confirmed as non-nullable FK with CASCADE delete (schema.prisma:3916). " +
        "CommitmentStatus enum includes OPEN, IN_PROGRESS, FULFILLED, CANCELED, OVERDUE (schema.prisma:915). " +
        "The unresolved runtime question is not whether overdueFlag exists, but whether the persisted DB " +
        "column alone is sufficient when dueDate passes without an explicit status update. The safer " +
        "runtime planning path is to use the dueDate/status heuristic or the existing deriveOverdueFlag " +
        "read-time derivation instead of relying on the DB flag alone.",
      workspaceMembershipBoundaryConfirmed: true,
      conditionalRuntimeGuard:
        "Before runtime adoption: do not use the persisted Commitment.overdueFlag column as the sole " +
        "runtime filter unless a maintenance path is confirmed for dueDate crossing over time. " +
        "Prefer the dueDate/status heuristic (dueDate < NOW() AND status NOT IN ('FULFILLED', 'CANCELED')) " +
        "or reuse the existing deriveOverdueFlag read-time derivation. Calibrate the 7-day " +
        "ownerUserId/updatedAt threshold against real commitment data to reduce false positives.",
      runtimeAdoptionPosture: "review_only_not_implemented",
    },

    // -----------------------------------------------------------------------
    // PF3-004 | TPQR-004 | crm | AS-FX-006 | customer_waiting
    // -----------------------------------------------------------------------
    {
      preflightId: "PF3-004",
      linkedTpqrId: "TPQR-004",
      fixtureId: "AS-FX-006",
      sourceType: "crm",
      signalType: "customer_waiting",
      runtimeReadinessStatus: "conditional_requires_runtime_guard",
      repoEvidence:
        "loadWaitingEmailThreads in features/mobile/lib/mobile-command-read-model.ts queries " +
        "db.emailThread where { workspaceId, status: 'WAITING_US' } with no opportunityId filter — " +
        "it returns ALL WAITING_US threads in the workspace regardless of CRM linkage. " +
        "TPQR-004 proposes a CRM-scoped path restricted to opportunityId IS NOT NULL and " +
        "opportunity.updatedAt < 7d. The WAITING_US status filter is shared between both paths. " +
        "Without deduplication, a WAITING_US thread linked to a stalled opportunity will appear " +
        "in both loadWaitingEmailThreads and TPQR-004 output simultaneously. " +
        "EmailThread.opportunityId FK confirmed in prisma/schema.prisma:3022.",
      workspaceMembershipBoundaryConfirmed: true,
      conditionalRuntimeGuard:
        "Before runtime adoption: implement deduplication by emailThread.id between TPQR-004 output " +
        "and loadWaitingEmailThreads output when both paths are active in the same surface. " +
        "The CRM-linked path (TPQR-004) and the general waiting-thread path (loadWaitingEmailThreads) " +
        "must not surface the same emailThread record twice. Define ownership: either TPQR-004 takes " +
        "exclusive ownership of opportunityId IS NOT NULL threads, or a merge step deduplicates by id " +
        "before rendering.",
      runtimeAdoptionPosture: "review_only_not_implemented",
    },

    // -----------------------------------------------------------------------
    // PF3-005 | TPQR-005 | tenant_resource | AS-FX-007 | stalled_case
    // -----------------------------------------------------------------------
    {
      preflightId: "PF3-005",
      linkedTpqrId: "TPQR-005",
      fixtureId: "AS-FX-007",
      sourceType: "tenant_resource",
      signalType: "stalled_case",
      runtimeReadinessStatus: "conditional_requires_runtime_guard",
      repoEvidence:
        "TenantResourceOperatingImpactItem type in lib/tenant-resources/operating-impact.ts has no " +
        "staleDays or lastSyncedAt field — the type exposes severity, followThroughStatus, proofRequired, " +
        "nextActionTitle, and related identifiers only. " +
        "getWorkspaceTenantResourceOperatingImpactReadout in lib/tenant-resources/workspace-operating-impact-query.ts " +
        "queries connector, importSource, importJob, workspaceSolutionExtension, and captureSession by workspaceId — " +
        "these contain lastSyncedAt (connector), updatedAt (importSource), and finishedAt (importJob) fields, " +
        "but none of these are currently surfaced on the impact item type. " +
        "TPQR-005 proposes derivedStaleDays as an in-memory computed field; the derivation source is not " +
        "yet determined and no existing code implements this computation.",
      workspaceMembershipBoundaryConfirmed: true,
      conditionalRuntimeGuard:
        "Before runtime adoption: define the derivedStaleDays computation formula — specify whether to " +
        "derive from connector.lastSyncedAt, importSource.updatedAt, or importJob.finishedAt, and confirm " +
        "that the chosen field reflects human-meaningful staleness rather than automated sync timing. " +
        "Add the derivation to the readout pipeline and expose it on the impact item before the in-memory " +
        "filter (derivedStaleDays > 14) can be applied. Calibrate the take: 2 noise guard against real " +
        "workspace data before runtime adoption.",
      runtimeAdoptionPosture: "review_only_not_implemented",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Preflight evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface PreflightCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface PreflightEvalSummary {
  readonly totalRows: number;
  readonly checks: readonly PreflightCheckResult[];
  readonly allPassed: boolean;
}

const REQUIRED_TPQR_IDS = [
  "TPQR-001",
  "TPQR-002",
  "TPQR-003",
  "TPQR-004",
  "TPQR-005",
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

function checkExactlyFiveRows(): PreflightCheckResult {
  const passed = RUNTIME_READINESS_PREFLIGHT.length === 5;
  return {
    checkName: "exactly_five_preflight_rows",
    passed,
    detail: passed
      ? "Exactly 5 runtime readiness preflight rows present."
      : `Expected 5 rows, found ${RUNTIME_READINESS_PREFLIGHT.length}.`,
  };
}

function checkAllTpqrIdsCovered(): PreflightCheckResult {
  const covered = new Set(RUNTIME_READINESS_PREFLIGHT.map((r) => r.linkedTpqrId));
  const missing = REQUIRED_TPQR_IDS.filter((id) => !covered.has(id));
  const passed = missing.length === 0;
  return {
    checkName: "all_tpqr_ids_covered",
    passed,
    detail: passed
      ? `All required TPQR IDs covered: ${REQUIRED_TPQR_IDS.join(", ")}.`
      : `Missing TPQR IDs: ${missing.join(", ")}.`,
  };
}

function checkAllPosturesAreReviewOnly(): PreflightCheckResult {
  const violations = RUNTIME_READINESS_PREFLIGHT.filter(
    (r) => r.runtimeAdoptionPosture !== "review_only_not_implemented"
  );
  const passed = violations.length === 0;
  return {
    checkName: "all_postures_review_only_not_implemented",
    passed,
    detail: passed
      ? "All rows have runtimeAdoptionPosture === 'review_only_not_implemented'."
      : `Wrong posture: ${violations.map((r) => r.preflightId).join(", ")}`,
  };
}

function checkNoReadyForRuntimeAdoptionWording(): PreflightCheckResult {
  const violations: string[] = [];
  for (const row of RUNTIME_READINESS_PREFLIGHT) {
    const fields = [
      row.repoEvidence,
      row.conditionalRuntimeGuard ?? "",
      row.followUpRequired ?? "",
    ];
    for (const field of fields) {
      if (field.toLowerCase().includes("ready_for_runtime_adoption")) {
        violations.push(`${row.preflightId}: field contains forbidden wording 'ready_for_runtime_adoption'`);
      }
    }
    if ((row.runtimeReadinessStatus as string) === "ready_for_runtime_adoption") {
      violations.push(`${row.preflightId}: runtimeReadinessStatus is 'ready_for_runtime_adoption' (forbidden value)`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_ready_for_runtime_adoption_wording",
    passed,
    detail: passed
      ? "No row contains 'ready_for_runtime_adoption' wording or status."
      : `Forbidden wording found: ${violations.join("; ")}`,
  };
}

function checkTpqr003OverdueFlagEvidenceCorrect(): PreflightCheckResult {
  const row = RUNTIME_READINESS_PREFLIGHT.find(
    (r) => r.linkedTpqrId === "TPQR-003"
  );
  if (!row) {
    return {
      checkName: "tpqr003_overdue_flag_evidence_correct",
      passed: false,
      detail: "TPQR-003 preflight row not found.",
    };
  }
  const evidence = row.repoEvidence.toLowerCase();
  const guard = (row.conditionalRuntimeGuard ?? "").toLowerCase();
  const falseNoReferenceClaims =
    evidence.includes("zero matches") ||
    evidence.includes("no matches") ||
    evidence.includes("no typescript references") ||
    evidence.includes("never written") ||
    evidence.includes("schema-only") ||
    guard.includes("zero matches") ||
    guard.includes("no typescript references") ||
    guard.includes("never written") ||
    guard.includes("schema-only");
  const citesActualCode =
    evidence.includes("deriveoverdueflag") &&
    evidence.includes("commitment.service.ts:72") &&
    evidence.includes("commitment.service.ts:112") &&
    evidence.includes("commitment.service.ts:194");
  const keepsSoleDbFlagGuard =
    guard.includes("persisted commitment.overdueflag column") &&
    guard.includes("sole") &&
    (guard.includes("duedate/status") || guard.includes("deriveoverdueflag"));
  const passed = !falseNoReferenceClaims && citesActualCode && keepsSoleDbFlagGuard;
  return {
    checkName: "tpqr003_overdue_flag_evidence_correct",
    passed,
    detail: passed
      ? "TPQR-003 cites actual overdueFlag derivation/write/read code and guards against DB-flag-only filtering."
      : falseNoReferenceClaims
      ? "TPQR-003 contains outdated no-reference/schema-only wording for overdueFlag."
      : !citesActualCode
      ? "TPQR-003 must cite deriveOverdueFlag and commitment.service.ts read/write evidence."
      : "TPQR-003 must guard against using persisted Commitment.overdueFlag as the sole runtime filter.",
  };
}

function checkAllConditionalRowsHaveGuardText(): PreflightCheckResult {
  const violations: string[] = [];
  for (const row of RUNTIME_READINESS_PREFLIGHT) {
    if (row.runtimeReadinessStatus === "conditional_requires_runtime_guard") {
      if (!row.conditionalRuntimeGuard || row.conditionalRuntimeGuard.trim() === "") {
        violations.push(`${row.preflightId}: conditional row missing conditionalRuntimeGuard`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "all_conditional_rows_have_guard_text",
    passed,
    detail: passed
      ? "All conditional rows have non-empty conditionalRuntimeGuard."
      : `Missing guard text: ${violations.join("; ")}`,
  };
}

function checkNoForbiddenAuthorization(): PreflightCheckResult {
  const violations: string[] = [];
  for (const row of RUNTIME_READINESS_PREFLIGHT) {
    const fields = [
      row.repoEvidence,
      row.conditionalRuntimeGuard ?? "",
      row.followUpRequired ?? "",
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.preflightId}: field contains forbidden authorization "${pattern}"`
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

function checkTpqr001IsReadyForPlanning(): PreflightCheckResult {
  const row = RUNTIME_READINESS_PREFLIGHT.find(
    (r) => r.linkedTpqrId === "TPQR-001"
  );
  if (!row) {
    return {
      checkName: "tpqr001_is_ready_for_thin_read_model_planning",
      passed: false,
      detail: "TPQR-001 preflight row not found.",
    };
  }
  const passed = row.runtimeReadinessStatus === "ready_for_thin_read_model_planning";
  return {
    checkName: "tpqr001_is_ready_for_thin_read_model_planning",
    passed,
    detail: passed
      ? "TPQR-001 correctly has runtimeReadinessStatus === 'ready_for_thin_read_model_planning'."
      : `TPQR-001 expected 'ready_for_thin_read_model_planning', found '${row.runtimeReadinessStatus}'.`,
  };
}

function checkWorkspaceMembershipBoundaryAllConfirmed(): PreflightCheckResult {
  const violations = RUNTIME_READINESS_PREFLIGHT.filter(
    (r) => !r.workspaceMembershipBoundaryConfirmed
  );
  const passed = violations.length === 0;
  return {
    checkName: "workspace_membership_boundary_confirmed_all",
    passed,
    detail: passed
      ? "All rows have workspaceMembershipBoundaryConfirmed === true."
      : `Unconfirmed boundary: ${violations.map((r) => r.preflightId).join(", ")}`,
  };
}

export function evaluateRuntimeReadinessPreflight(): PreflightEvalSummary {
  const checks: PreflightCheckResult[] = [
    checkExactlyFiveRows(),
    checkAllTpqrIdsCovered(),
    checkAllPosturesAreReviewOnly(),
    checkNoReadyForRuntimeAdoptionWording(),
    checkTpqr003OverdueFlagEvidenceCorrect(),
    checkAllConditionalRowsHaveGuardText(),
    checkNoForbiddenAuthorization(),
    checkTpqr001IsReadyForPlanning(),
    checkWorkspaceMembershipBoundaryAllConfirmed(),
  ];

  return {
    totalRows: RUNTIME_READINESS_PREFLIGHT.length,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
