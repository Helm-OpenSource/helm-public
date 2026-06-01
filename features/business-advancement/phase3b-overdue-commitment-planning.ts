/**
 * Helm Business Advancement - Phase 3B / TPQR-003 / PF3A-003
 * Overdue-commitment planning artifact (planning-only, no runtime adoption).
 *
 * This is the second Phase 3B planning artifact authorized by
 * docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md.
 * Phase 3A closeout granted PF3-003 / TPQR-003 a Conditional Planning Go: any
 * future thin read-model overdue filter must derive overdue-ness at READ TIME
 * from `dueDate < referenceClock AND status NOT IN ('FULFILLED','CANCELED')`
 * (or via the existing `deriveOverdueFlag` helper). It must NEVER rely on the
 * persisted Commitment.overdueFlag column as the sole time-sensitive filter,
 * because PF3A-003 proved no dueDate-crossing maintenance exists in the repo
 * and the persisted column is therefore stale-by-design across time.
 *
 * Upstream gate (verbatim re-statement):
 *   - PF3A-003 conclusion = `prefer_read_time_derivation`. Recommended future
 *     filter = `dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')` or
 *     reuse the existing `deriveOverdueFlag` helper. Persisted overdueFlag is
 *     stale-by-design for time-sensitive filtering and MUST NOT be authority.
 *   - Phase 3A closeout decision: Phase 3B = conditional partial Go for
 *     PLANNING ONLY. Runtime / schema / API / UI / official write /
 *     automated execution / LLM final ranking / production query path = No-Go.
 *   - The 7d ownerUserId/updatedAt staleness threshold mentioned upstream is
 *     a separate calibration; it is NOT part of this overdue-derivation
 *     planning artifact and would require a separate review with real data.
 *
 * Hard non-goals (preserved):
 *   - No Prisma schema change. The persisted Commitment.overdueFlag column is
 *     observed only on synthetic fixture rows for the purpose of proving it
 *     is NOT used for inclusion; the artifact never writes to it, never adds
 *     a column, never proposes a backfill, and never proposes a maintenance
 *     job to refresh it on dueDate crossing.
 *   - No modification to data/queries.ts, features/meetings/queries.ts,
 *     lib/memory/commitment.service.ts, lib/memory/shared.ts,
 *     features/mobile/lib/mobile-command-read-model.ts, app/, app/api/,
 *     or any other runtime code path.
 *   - No runtime extractor, no event queue, no background job, no production
 *     query path adoption.
 *   - No LLM final ranking; ordering is deterministic.
 *   - No outbound-system mutation, no automated execution, no auto-send, no
 *     auto-approval.
 *   - No TPQR-002 / TPQR-005 work surface; both remain No-Go in Phase 3B.
 *
 * Planning candidate shape: MustPushItem from ./contracts. Candidates carry
 * planning-only metadata (planningOnly: true, thresholdRule, dueDateMs,
 * status, overdueByMs, evaluatedAtMs, sourceRowId). They are NOT runtime
 * items, NOT commitments, NOT approved actions, and NOT auto-executed.
 */

import type {
  AllowedActionVerb,
  MustPushItem,
  ReviewPosture,
  RiskLevel,
  SignalType,
  SourceType,
} from "./contracts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TPQR identifier for this planning artifact. */
export const OVERDUE_COMMITMENT_PLANNING_TPQR_ID = "TPQR-003" as const;

/** Phase 3A preflight identifier this artifact is anchored to. */
export const OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID = "PF3A-003" as const;

/** Source / signal anchor for this artifact. */
export const OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE =
  "overdue_commitment" as const satisfies SignalType;
/**
 * SourceType is `combined` because the commitment overdue signal is modeled
 * here as a planning read-model candidate (commitment + dueDate + status +
 * read-time clock), not as a single-source CRM column read. The contract
 * vocabulary in ./contracts is preserved unchanged.
 */
export const OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE = "combined" as const satisfies SourceType;

/**
 * Read-time threshold rule. PLANNING CANDIDATE only - never a production
 * threshold and never a green-light to adopt this rule in runtime queries.
 *
 * Stated as a string so downstream review can read it directly and so any
 * silent deviation from the read-time semantic shows up as a string mismatch.
 */
export const OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE =
  "due_date_lt_reference_clock_and_status_not_terminal" as const;

/**
 * Grace period beyond dueDate, in milliseconds. Set to 0 because PF3A-003
 * recommended `dueDate < NOW()` directly; any positive grace would silently
 * relax the read-time semantic and is out of scope for this planning artifact.
 */
export const OVERDUE_COMMITMENT_PLANNING_GRACE_MS: number = 0;

/**
 * Synthetic commitment status vocabulary used by the bundled fixture. These
 * values mirror the synthetic surface of Commitment.status without coupling
 * to any Prisma enum at this planning layer.
 */
export type SyntheticCommitmentStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "FULFILLED"
  | "CANCELED";

/**
 * Terminal statuses that exclude a commitment from the overdue set, mirroring
 * the PF3A-003 recommended filter `status NOT IN ('FULFILLED','CANCELED')`.
 */
export const OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES: readonly SyntheticCommitmentStatus[] =
  ["FULFILLED", "CANCELED"];

/**
 * Deterministic reference clock used by the bundled fixture set and the CLI
 * script. Callers MUST pass an explicit referenceClockMs into the helpers;
 * this constant is exposed only so the bundled fixture has a stable anchor.
 *
 * Pure: Date.UTC is a stateless arithmetic on its arguments.
 */
export const OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS: number = Date.UTC(
  2026,
  3,
  26,
  0,
  0,
  0,
  0,
);

// ---------------------------------------------------------------------------
// Source-row types (planning-only fixture, NOT runtime data)
// ---------------------------------------------------------------------------

/**
 * One synthetic overdue-commitment planning source row. These rows are NOT
 * runtime data. They model the SHAPE of a Commitment row (with dueDate,
 * status, and a persisted overdueFlag observed only as evidence) that a
 * future thin read-model filter MIGHT consider, without any schema or
 * runtime change today.
 */
export interface OverdueCommitmentPlanningSourceRow {
  /** Stable identifier for this fixture row. */
  readonly rowId: string;
  /** Workspace scope (synthetic). */
  readonly workspaceId: string;
  /** Whether workspace membership has been confirmed for this row. */
  readonly workspaceMembershipConfirmed: boolean;
  /** Synthetic Commitment identifier. */
  readonly commitmentId: string;
  /** Synthetic Opportunity identifier (planning anchor only). */
  readonly opportunityId: string;
  /** Short human-readable title for the commitment. */
  readonly title: string;
  /**
   * Synthetic Commitment.dueDate expressed in epoch milliseconds.
   * `null` indicates the commitment has no dueDate set, in which case the
   * read-time overdue derivation cannot evaluate and the row must be
   * excluded with reason `missing_due_date`.
   */
  readonly dueDateMs: number | null;
  /** Synthetic Commitment.status value. */
  readonly status: SyntheticCommitmentStatus;
  /**
   * Persisted Commitment.overdueFlag value as observed on the synthetic row.
   *
   * IMPORTANT: this field is recorded ONLY to prove that the planning artifact
   * does NOT use the persisted column as authority for time-sensitive
   * filtering. Inclusion is determined exclusively by read-time derivation
   * (dueDate < referenceClock AND status NOT IN terminal statuses).
   * Flipping this value across the entire fixture MUST NOT change which rows
   * are included, and the evaluator enforces that invariant.
   */
  readonly persistedOverdueFlag: boolean;
  /** Planning-only evidence references (NOT runtime evidence). */
  readonly evidenceRefs: readonly string[];
  /** Source scenario summary used to seed candidate.sourceSummary. */
  readonly sourceScenario: string;
}

// ---------------------------------------------------------------------------
// Exclusion reasons
// ---------------------------------------------------------------------------

/**
 * Deterministic exclusion reasons. Each excluded row carries exactly one
 * reason; reasons are evaluated in the priority order:
 *   workspace_boundary_not_confirmed >
 *   missing_due_date >
 *   terminal_status >
 *   threshold_not_met.
 */
export type OverdueCommitmentExclusionReason =
  | "threshold_not_met"
  | "terminal_status"
  | "missing_due_date"
  | "workspace_boundary_not_confirmed";

// ---------------------------------------------------------------------------
// Planning candidate shape (MustPushItem-shaped, PLANNING-ONLY)
// ---------------------------------------------------------------------------

/**
 * OverdueCommitmentPlanningCandidate - MustPushItem-shaped planning candidate.
 *
 * The base shape (itemId / title / reason / evidenceRefs / primaryAction /
 * boundaryNote / reviewPosture / sourceSummary / riskLevel / sortKey) conforms
 * to MustPushItem from ./contracts so a downstream thin read-model planning
 * step can align without re-defining the contract.
 *
 * Extra metadata (planningOnly / tpqrId / preflightId / signalType / sourceType /
 * thresholdRule / graceMs / dueDateMs / status / overdueByMs / evaluatedAtMs /
 * sourceRowId) is PLANNING-ONLY and explicitly marks the candidate as not a
 * runtime item, not an approved action, and not an auto-executed item.
 *
 * Note: persistedOverdueFlag is intentionally NOT echoed into the candidate
 * shape. The persisted column is non-authoritative for time-sensitive
 * filtering, so the candidate must not present it as a property of the
 * planning decision.
 */
export interface OverdueCommitmentPlanningCandidate extends MustPushItem {
  readonly planningOnly: true;
  readonly tpqrId: typeof OVERDUE_COMMITMENT_PLANNING_TPQR_ID;
  readonly preflightId: typeof OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID;
  readonly signalType: typeof OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE;
  readonly sourceType: typeof OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE;
  readonly thresholdRule: typeof OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE;
  readonly graceMs: number;
  readonly dueDateMs: number;
  readonly status: SyntheticCommitmentStatus;
  readonly overdueByMs: number;
  readonly evaluatedAtMs: number;
  readonly sourceRowId: string;
}

// ---------------------------------------------------------------------------
// Excluded row record
// ---------------------------------------------------------------------------

export interface OverdueCommitmentExcludedRow {
  readonly sourceRowId: string;
  readonly reason: OverdueCommitmentExclusionReason;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// Per-row evaluation result (pure)
// ---------------------------------------------------------------------------

export type OverdueCommitmentRowEvaluation =
  | {
      readonly included: true;
      readonly candidate: OverdueCommitmentPlanningCandidate;
    }
  | {
      readonly included: false;
      readonly excluded: OverdueCommitmentExcludedRow;
    };

// ---------------------------------------------------------------------------
// Eval check / summary types
// ---------------------------------------------------------------------------

export interface OverdueCommitmentPlanningCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface OverdueCommitmentPlanningSummary {
  readonly tpqrId: typeof OVERDUE_COMMITMENT_PLANNING_TPQR_ID;
  readonly preflightId: typeof OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID;
  readonly thresholdRule: typeof OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE;
  readonly graceMs: number;
  readonly referenceClockMs: number;
  readonly totalSourceRows: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly candidates: readonly OverdueCommitmentPlanningCandidate[];
  readonly excluded: readonly OverdueCommitmentExcludedRow[];
  readonly checks: readonly OverdueCommitmentPlanningCheckResult[];
  readonly allPassed: boolean;
}

// ---------------------------------------------------------------------------
// Boundary notes (carry recommendation / explanation / draft / proof distinctions)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTE_PARTS: readonly string[] = [
  "recommendation != commitment - planning candidate only, never an external commitment.",
  "explanation != approval - citing commitment evidence does not approve the dueDate slip or assign an owner.",
  "draft != send - any drafted follow-up note must be reviewed before send.",
  "proof != external write success - verifying the planning shape does not authorize outbound-system mutation or automated execution.",
  "PF3A-003 / TPQR-003 Phase 3B planning-only - read-time dueDate/status derivation only, persisted Commitment.overdueFlag column is non-authoritative for time-sensitive filtering, no runtime extractor, no schema change, no API route, no page behavior change, no production query path, deterministic ordering only.",
];

const SHARED_BOUNDARY_NOTE = SHARED_BOUNDARY_NOTE_PARTS.join(" ");

// ---------------------------------------------------------------------------
// Planning fixture rows (TPQR-003 only; deterministic; non-runtime)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export const OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS: readonly OverdueCommitmentPlanningSourceRow[] =
  [
    // -----------------------------------------------------------------------
    // OC-PLAN-001 - dueDate 5 days past, status IN_PROGRESS, persistedOverdueFlag = false
    // Persisted column says NOT overdue; read-time derivation says overdue.
    // Expected: included (proves persisted column is not authority).
    // -----------------------------------------------------------------------
    {
      rowId: "OC-PLAN-001",
      workspaceId: "ws-synth-tpqr003-a",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-001",
      opportunityId: "synth-opportunity-001",
      title: "Send signed MSA 已确认 (planning candidate)",
      dueDateMs:
        OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS - 5 * DAY_MS,
      status: "IN_PROGRESS",
      persistedOverdueFlag: false,
      evidenceRefs: [
        "synthetic commitment record: dueDate 5 days before reference clock, status IN_PROGRESS, persistedOverdueFlag observed false",
        "PF3A-003 finding: persisted column has no dueDate-crossing maintenance and is stale-by-design across time",
      ],
      sourceScenario:
        "Commitment dueDate has passed by 5 days and status is non-terminal; read-time derivation correctly flags it as overdue even though the persisted overdueFlag column is still false.",
    },

    // -----------------------------------------------------------------------
    // OC-PLAN-002 - dueDate 9 days past, status PENDING, persistedOverdueFlag = true
    // Read-time derivation says overdue; persisted column happens to agree.
    // Expected: included (most overdue, comes first in ordering).
    // -----------------------------------------------------------------------
    {
      rowId: "OC-PLAN-002",
      workspaceId: "ws-synth-tpqr003-a",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-002",
      opportunityId: "synth-opportunity-002",
      title: "Confirm pricing exception with finance (planning candidate)",
      dueDateMs:
        OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS - 9 * DAY_MS,
      status: "PENDING",
      persistedOverdueFlag: true,
      evidenceRefs: [
        "synthetic commitment record: dueDate 9 days before reference clock, status PENDING",
      ],
      sourceScenario:
        "Pricing exception commitment is 9 days past dueDate with status PENDING; read-time derivation flags it as overdue.",
    },

    // -----------------------------------------------------------------------
    // OC-PLAN-003 - dueDate 3 days FUTURE, status PENDING, persistedOverdueFlag = true
    // Read-time derivation says NOT overdue; persisted flag is misleadingly true.
    // Expected: excluded with reason threshold_not_met.
    // (Demonstrates persisted column is not authority in the other direction.)
    // -----------------------------------------------------------------------
    {
      rowId: "OC-PLAN-003",
      workspaceId: "ws-synth-tpqr003-a",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-003",
      opportunityId: "synth-opportunity-003",
      title: "Schedule legal review (planning candidate)",
      dueDateMs:
        OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS + 3 * DAY_MS,
      status: "PENDING",
      persistedOverdueFlag: true,
      evidenceRefs: [
        "synthetic commitment record: dueDate 3 days after reference clock, status PENDING",
        "synthetic note: persisted overdueFlag is true but read-time derivation correctly excludes the row",
      ],
      sourceScenario:
        "Legal review commitment is still 3 days away from dueDate; read-time derivation correctly excludes it even though persisted overdueFlag column happens to be true.",
    },

    // -----------------------------------------------------------------------
    // OC-PLAN-004 - dueDate 4 days past, status FULFILLED, persistedOverdueFlag = true
    // Read-time derivation says NOT overdue (terminal status); persisted flag stale.
    // Expected: excluded with reason terminal_status.
    // -----------------------------------------------------------------------
    {
      rowId: "OC-PLAN-004",
      workspaceId: "ws-synth-tpqr003-a",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-004",
      opportunityId: "synth-opportunity-004",
      title: "Already-fulfilled deliverable handoff (planning candidate)",
      dueDateMs:
        OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS - 4 * DAY_MS,
      status: "FULFILLED",
      persistedOverdueFlag: true,
      evidenceRefs: [
        "synthetic commitment record: dueDate 4 days before reference clock, status FULFILLED",
        "synthetic note: persisted overdueFlag is stale-true after fulfillment without dueDate-crossing maintenance",
      ],
      sourceScenario:
        "Commitment was fulfilled after dueDate passed; status is terminal so it must not be surfaced even though dueDate is in the past.",
    },

    // -----------------------------------------------------------------------
    // OC-PLAN-005 - dueDate null, status PENDING, persistedOverdueFlag = false
    // Read-time derivation cannot evaluate without dueDate.
    // Expected: excluded with reason missing_due_date.
    // -----------------------------------------------------------------------
    {
      rowId: "OC-PLAN-005",
      workspaceId: "ws-synth-tpqr003-a",
      workspaceMembershipConfirmed: true,
      commitmentId: "synth-commitment-005",
      opportunityId: "synth-opportunity-005",
      title: "Open-ended commitment with no dueDate (planning candidate)",
      dueDateMs: null,
      status: "PENDING",
      persistedOverdueFlag: false,
      evidenceRefs: [
        "synthetic commitment record: no dueDate set, status PENDING",
      ],
      sourceScenario:
        "Commitment has no dueDate set; read-time derivation cannot evaluate overdue-ness and the row is excluded.",
    },

    // -----------------------------------------------------------------------
    // OC-PLAN-006 - dueDate 6 days past, status PENDING, workspace not confirmed
    // Workspace boundary blocks regardless of read-time derivation.
    // Expected: excluded with reason workspace_boundary_not_confirmed.
    // -----------------------------------------------------------------------
    {
      rowId: "OC-PLAN-006",
      workspaceId: "ws-synth-tpqr003-b",
      workspaceMembershipConfirmed: false,
      commitmentId: "synth-commitment-006",
      opportunityId: "synth-opportunity-006",
      title: "Commitment in unconfirmed workspace (planning candidate)",
      dueDateMs:
        OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS - 6 * DAY_MS,
      status: "PENDING",
      persistedOverdueFlag: false,
      evidenceRefs: [
        "synthetic commitment record: workspace membership not confirmed for the requesting principal",
      ],
      sourceScenario:
        "Workspace membership is not confirmed for this row; the workspace-first isolation contract blocks inclusion regardless of dueDate or status.",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const REVIEW_POSTURE_FOR_OVERDUE_COMMITMENT: ReviewPosture =
  "human_owner_required";
const RISK_LEVEL_FOR_OVERDUE_COMMITMENT: RiskLevel = "high";
const PRIMARY_ACTION_VERB: AllowedActionVerb = "review";

/**
 * Returns true when a synthetic status is terminal per PF3A-003 (FULFILLED or
 * CANCELED). Pure: stateless lookup against the exported terminal list.
 */
export function isTerminalCommitmentStatus(
  status: SyntheticCommitmentStatus,
): boolean {
  return OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES.includes(status);
}

/**
 * Compute overdue-by milliseconds for a row at a given reference clock.
 *
 * Returns 0 (not 0+) only when dueDate is missing, dueDate is in the future,
 * or dueDate equals the reference clock. Any positive return value means the
 * row is past dueDate at the read-time derivation. Pure.
 */
export function computeOverdueByMs(
  row: OverdueCommitmentPlanningSourceRow,
  referenceClockMs: number,
): number {
  if (row.dueDateMs === null) {
    return 0;
  }
  const raw = referenceClockMs - row.dueDateMs;
  return raw > OVERDUE_COMMITMENT_PLANNING_GRACE_MS ? raw : 0;
}

/**
 * Evaluate one source row deterministically.
 *
 * Priority order (highest first):
 *   1. workspace_boundary_not_confirmed (any row with unconfirmed membership)
 *   2. missing_due_date (dueDateMs is null)
 *   3. terminal_status (status is FULFILLED or CANCELED)
 *   4. threshold_not_met (dueDateMs >= referenceClockMs)
 *   5. otherwise included as a planning candidate.
 *
 * Inclusion is determined EXCLUSIVELY by read-time derivation:
 *   dueDateMs < referenceClockMs AND status NOT IN terminal statuses.
 * The persisted Commitment.overdueFlag observed on the source row is NEVER
 * read by this function.
 *
 * Pure: no DB / network / Date.now side effect.
 */
export function evaluateOverdueCommitmentRow(
  row: OverdueCommitmentPlanningSourceRow,
  referenceClockMs: number,
): OverdueCommitmentRowEvaluation {
  if (!row.workspaceMembershipConfirmed) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "workspace_boundary_not_confirmed",
        detail:
          "workspaceMembershipConfirmed is false; the workspace-first isolation boundary blocks this row from becoming a planning candidate.",
      },
    };
  }
  if (row.dueDateMs === null) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "missing_due_date",
        detail:
          "dueDateMs is null; read-time derivation cannot evaluate overdue-ness without an explicit dueDate.",
      },
    };
  }
  if (isTerminalCommitmentStatus(row.status)) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "terminal_status",
        detail: `status="${row.status}" is in the terminal set ${JSON.stringify(
          OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES,
        )}; PF3A-003 read-time filter excludes terminal rows regardless of dueDate.`,
      },
    };
  }
  const overdueByMs = computeOverdueByMs(row, referenceClockMs);
  if (overdueByMs <= 0) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "threshold_not_met",
        detail: `dueDateMs (${row.dueDateMs}) is not strictly less than referenceClockMs (${referenceClockMs}); read-time derivation does not flag this commitment as overdue.`,
      },
    };
  }

  const primaryAction = `${PRIMARY_ACTION_VERB}: commitment ${row.commitmentId} (review required; planning candidate)`;
  const candidate: OverdueCommitmentPlanningCandidate = {
    itemId: `${row.rowId}-candidate`,
    title: row.title,
    reason: `Read-time derivation flags this commitment as overdue (overdueByMs=${overdueByMs}, status=${row.status}); planning candidate only.`,
    evidenceRefs: row.evidenceRefs,
    primaryAction,
    boundaryNote: SHARED_BOUNDARY_NOTE,
    reviewPosture: REVIEW_POSTURE_FOR_OVERDUE_COMMITMENT,
    sourceSummary: row.sourceScenario,
    riskLevel: RISK_LEVEL_FOR_OVERDUE_COMMITMENT,
    // Placeholder; replaced by deterministic ranker below.
    sortKey: 0,
    planningOnly: true,
    tpqrId: OVERDUE_COMMITMENT_PLANNING_TPQR_ID,
    preflightId: OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID,
    signalType: OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE,
    sourceType: OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE,
    thresholdRule: OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE,
    graceMs: OVERDUE_COMMITMENT_PLANNING_GRACE_MS,
    dueDateMs: row.dueDateMs,
    status: row.status,
    overdueByMs,
    evaluatedAtMs: referenceClockMs,
    sourceRowId: row.rowId,
  };
  return { included: true, candidate };
}

/**
 * Compare two candidates deterministically.
 *
 * Order:
 *   1. larger overdueByMs first (most overdue first).
 *   2. smaller sourceRowId (lexicographic) first as tie-breaker.
 *
 * Pure / total / antisymmetric on the bundled fixture set.
 */
export function compareOverdueCommitmentCandidates(
  a: OverdueCommitmentPlanningCandidate,
  b: OverdueCommitmentPlanningCandidate,
): number {
  if (a.overdueByMs !== b.overdueByMs) {
    return b.overdueByMs - a.overdueByMs;
  }
  if (a.sourceRowId < b.sourceRowId) {
    return -1;
  }
  if (a.sourceRowId > b.sourceRowId) {
    return 1;
  }
  return 0;
}

/**
 * Build the deterministic candidate set for a given row collection and clock.
 * Returns a fresh array (input rows are not mutated). Pure.
 */
export function buildOverdueCommitmentPlanningCandidates(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  referenceClockMs: number,
): {
  readonly candidates: readonly OverdueCommitmentPlanningCandidate[];
  readonly excluded: readonly OverdueCommitmentExcludedRow[];
} {
  const candidatesUnordered: OverdueCommitmentPlanningCandidate[] = [];
  const excluded: OverdueCommitmentExcludedRow[] = [];
  for (const row of rows) {
    const result = evaluateOverdueCommitmentRow(row, referenceClockMs);
    if (result.included) {
      candidatesUnordered.push(result.candidate);
    } else {
      excluded.push(result.excluded);
    }
  }
  const ordered = [...candidatesUnordered].sort(
    compareOverdueCommitmentCandidates,
  );
  const candidates: OverdueCommitmentPlanningCandidate[] = ordered.map(
    (candidate, index) => ({ ...candidate, sortKey: index }),
  );
  excluded.sort((a, b) => {
    if (a.sourceRowId < b.sourceRowId) {
      return -1;
    }
    if (a.sourceRowId > b.sourceRowId) {
      return 1;
    }
    return 0;
  });
  return { candidates, excluded };
}

// ---------------------------------------------------------------------------
// Forbidden authorization wording (must not appear in any planning text)
// ---------------------------------------------------------------------------

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "auto_execute",
  "auto execute",
  "auto-execute",
  "auto-execution",
  "official_write",
  "official write",
  "auto_send",
  "auto send",
  "auto-send",
  "auto_approve",
  "auto approve",
  "auto-approve",
  "auto-approval",
  "auto_settlement",
  "auto settlement",
  "cross_tenant",
  "cross-tenant",
  "llm_rank",
  "llm rank",
  "llm final ranking",
  "llm may determine",
  "llm may rank",
  "production query adoption",
  "approves runtime adoption",
  "approves production query adoption",
  "may add a schema",
  "may add schema",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may change page behavior",
  "may add api route",
  "may add a api route",
  "may add an api route",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

// ---------------------------------------------------------------------------
// Evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

function checkOnlyTpqr003Rows(
  candidates: readonly OverdueCommitmentPlanningCandidate[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    if (candidate.tpqrId !== OVERDUE_COMMITMENT_PLANNING_TPQR_ID) {
      violations.push(`${candidate.itemId}: tpqrId="${candidate.tpqrId}"`);
    }
    if (candidate.preflightId !== OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID) {
      violations.push(
        `${candidate.itemId}: preflightId="${candidate.preflightId}"`,
      );
    }
    if (candidate.signalType !== OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE) {
      violations.push(
        `${candidate.itemId}: signalType="${candidate.signalType}"`,
      );
    }
    if (candidate.sourceType !== OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE) {
      violations.push(
        `${candidate.itemId}: sourceType="${candidate.sourceType}"`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "only_tpqr003_overdue_commitment_rows",
    passed,
    detail: passed
      ? "All candidates carry tpqrId=TPQR-003 / preflightId=PF3A-003 / signalType=overdue_commitment / sourceType=combined."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkReadTimeDueDateStatusDerivation(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly OverdueCommitmentPlanningCandidate[],
  excluded: readonly OverdueCommitmentExcludedRow[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    if (candidate.thresholdRule !== OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE) {
      violations.push(
        `${candidate.itemId}: thresholdRule="${candidate.thresholdRule}"`,
      );
    }
    if (candidate.evaluatedAtMs !== referenceClockMs) {
      violations.push(
        `${candidate.itemId}: evaluatedAtMs (${candidate.evaluatedAtMs}) does not match referenceClockMs (${referenceClockMs})`,
      );
    }
    if (!(candidate.dueDateMs < referenceClockMs)) {
      violations.push(
        `${candidate.itemId}: dueDateMs (${candidate.dueDateMs}) is not strictly less than referenceClockMs (${referenceClockMs})`,
      );
    }
    if (isTerminalCommitmentStatus(candidate.status)) {
      violations.push(
        `${candidate.itemId}: candidate carries terminal status "${candidate.status}"`,
      );
    }
    if (candidate.overdueByMs <= 0) {
      violations.push(
        `${candidate.itemId}: overdueByMs (${candidate.overdueByMs}) must be strictly positive`,
      );
    }
    if (candidate.overdueByMs !== referenceClockMs - candidate.dueDateMs) {
      violations.push(
        `${candidate.itemId}: overdueByMs (${candidate.overdueByMs}) is not consistent with referenceClockMs - dueDateMs`,
      );
    }
  }
  for (const row of excluded) {
    const sourceRow = rows.find((r) => r.rowId === row.sourceRowId);
    if (!sourceRow) {
      violations.push(
        `${row.sourceRowId}: excluded row has no matching source row`,
      );
      continue;
    }
    if (row.reason === "terminal_status") {
      if (!isTerminalCommitmentStatus(sourceRow.status)) {
        violations.push(
          `${row.sourceRowId}: marked terminal_status but source row status is "${sourceRow.status}"`,
        );
      }
    }
    if (row.reason === "missing_due_date") {
      if (sourceRow.dueDateMs !== null) {
        violations.push(
          `${row.sourceRowId}: marked missing_due_date but source row has dueDateMs=${sourceRow.dueDateMs}`,
        );
      }
    }
    if (row.reason === "threshold_not_met") {
      if (sourceRow.dueDateMs === null) {
        violations.push(
          `${row.sourceRowId}: marked threshold_not_met but source row has no dueDateMs`,
        );
      } else if (sourceRow.dueDateMs < referenceClockMs) {
        violations.push(
          `${row.sourceRowId}: marked threshold_not_met but dueDateMs (${sourceRow.dueDateMs}) is strictly less than referenceClockMs (${referenceClockMs})`,
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "read_time_due_date_status_derivation_is_authority",
    passed,
    detail: passed
      ? "Inclusion is determined by dueDateMs < referenceClockMs AND status NOT IN terminal statuses; exclusion reasons reflect the source row state."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkNoPersistedOverdueFlagAuthority(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly OverdueCommitmentPlanningCandidate[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  // Flipping the persisted column on every row must not change the candidate
  // set. This is the deterministic proof that the persisted column is not
  // authority for time-sensitive filtering.
  const flippedRows: readonly OverdueCommitmentPlanningSourceRow[] = rows.map(
    (row) => ({ ...row, persistedOverdueFlag: !row.persistedOverdueFlag }),
  );
  const flippedBuilt = buildOverdueCommitmentPlanningCandidates(
    flippedRows,
    referenceClockMs,
  );
  if (flippedBuilt.candidates.length !== candidates.length) {
    violations.push(
      `flipping persistedOverdueFlag changed candidate count from ${candidates.length} to ${flippedBuilt.candidates.length}`,
    );
  } else {
    for (let i = 0; i < candidates.length; i += 1) {
      if (flippedBuilt.candidates[i].sourceRowId !== candidates[i].sourceRowId) {
        violations.push(
          `flipping persistedOverdueFlag changed candidate at sortKey=${i} from ${candidates[i].sourceRowId} to ${flippedBuilt.candidates[i].sourceRowId}`,
        );
      }
    }
  }
  // The candidate type itself must not surface a persistedOverdueFlag field.
  for (const candidate of candidates) {
    if (
      Object.prototype.hasOwnProperty.call(candidate, "persistedOverdueFlag")
    ) {
      violations.push(
        `${candidate.itemId}: candidate must not expose persistedOverdueFlag`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_persisted_overdue_flag_authority",
    passed,
    detail: passed
      ? "Flipping persistedOverdueFlag across all source rows yields an identical candidate set; the persisted column has no influence on inclusion or ordering."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkNoRuntimeOrSchemaOrWriteAuthority(
  candidates: readonly OverdueCommitmentPlanningCandidate[],
  excluded: readonly OverdueCommitmentExcludedRow[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    const fields: string[] = [
      candidate.title,
      candidate.reason,
      candidate.primaryAction,
      candidate.boundaryNote,
      candidate.sourceSummary,
      ...candidate.evidenceRefs,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${candidate.itemId}: forbidden authorization wording "${pattern}"`,
          );
        }
      }
    }
    if (candidate.planningOnly !== true) {
      violations.push(`${candidate.itemId}: planningOnly is not true`);
    }
  }
  for (const row of excluded) {
    const lower = row.detail.toLowerCase();
    for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
      if (lower.includes(pattern)) {
        violations.push(
          `${row.sourceRowId}: forbidden authorization wording in excluded reason "${pattern}"`,
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_runtime_schema_or_write_authority",
    passed,
    detail: passed
      ? "No candidate or excluded reason carries runtime / schema / write / automated-execution / LLM-ranking authority."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkMembershipBoundaryPresent(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  candidates: readonly OverdueCommitmentPlanningCandidate[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  for (const row of rows) {
    if (typeof row.workspaceMembershipConfirmed !== "boolean") {
      violations.push(`${row.rowId}: workspaceMembershipConfirmed missing`);
    }
    if (row.workspaceId.trim() === "") {
      violations.push(`${row.rowId}: workspaceId is empty`);
    }
  }
  for (const candidate of candidates) {
    const sourceRow = rows.find((r) => r.rowId === candidate.sourceRowId);
    if (!sourceRow) {
      violations.push(
        `${candidate.itemId}: candidate has no matching source row`,
      );
      continue;
    }
    if (sourceRow.workspaceMembershipConfirmed !== true) {
      violations.push(
        `${candidate.itemId}: included candidate sourced from row with workspaceMembershipConfirmed=false`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "workspace_membership_boundary_present",
    passed,
    detail: passed
      ? "Every source row carries workspaceId / workspaceMembershipConfirmed; only confirmed-membership rows can be included."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkExcludedRowsHaveReasons(
  excluded: readonly OverdueCommitmentExcludedRow[],
): OverdueCommitmentPlanningCheckResult {
  const allowed = new Set<OverdueCommitmentExclusionReason>([
    "threshold_not_met",
    "terminal_status",
    "missing_due_date",
    "workspace_boundary_not_confirmed",
  ]);
  const violations: string[] = [];
  for (const row of excluded) {
    if (!allowed.has(row.reason)) {
      violations.push(`${row.sourceRowId}: invalid reason="${row.reason}"`);
    }
    if (row.detail.trim() === "") {
      violations.push(`${row.sourceRowId}: empty exclusion detail`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "excluded_rows_have_reasons",
    passed,
    detail: passed
      ? `All ${excluded.length} excluded row(s) carry a deterministic reason from the allowed vocabulary.`
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkDeterministicOrdering(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly OverdueCommitmentPlanningCandidate[],
): OverdueCommitmentPlanningCheckResult {
  const reversed = [...rows].reverse();
  const rebuilt = buildOverdueCommitmentPlanningCandidates(
    reversed,
    referenceClockMs,
  ).candidates;
  if (rebuilt.length !== candidates.length) {
    return {
      checkName: "deterministic_ordering",
      passed: false,
      detail: `Re-ordered input produced ${rebuilt.length} candidates vs ${candidates.length}.`,
    };
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (rebuilt[i].itemId !== candidates[i].itemId) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `Candidate at position ${i} differs after input reorder: original=${candidates[i].itemId} rebuilt=${rebuilt[i].itemId}.`,
      };
    }
    if (rebuilt[i].sortKey !== candidates[i].sortKey) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `sortKey at position ${i} differs after input reorder: original=${candidates[i].sortKey} rebuilt=${rebuilt[i].sortKey}.`,
      };
    }
  }
  for (let i = 0; i < candidates.length; i += 1) {
    if (candidates[i].sortKey !== i) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `sortKey is not zero-based contiguous at position ${i}: got ${candidates[i].sortKey}.`,
      };
    }
  }
  for (let i = 0; i + 1 < candidates.length; i += 1) {
    const cmp = compareOverdueCommitmentCandidates(
      candidates[i],
      candidates[i + 1],
    );
    if (cmp > 0) {
      return {
        checkName: "deterministic_ordering",
        passed: false,
        detail: `Candidate ${candidates[i].itemId} should not come before ${candidates[i + 1].itemId}.`,
      };
    }
  }
  return {
    checkName: "deterministic_ordering",
    passed: true,
    detail:
      "Re-ordering inputs yields the same candidate sequence; sortKey is zero-based contiguous.",
  };
}

function checkBoundaryDistinctions(
  candidates: readonly OverdueCommitmentPlanningCandidate[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    const lower = candidate.boundaryNote.toLowerCase();
    for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
      if (!lower.includes(phrase)) {
        violations.push(
          `${candidate.itemId}: boundaryNote missing "${phrase}"`,
        );
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName:
      "boundary_notes_preserve_recommendation_explanation_draft_proof",
    passed,
    detail: passed
      ? "All candidates preserve recommendation/explanation/draft/proof distinctions in boundaryNote."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkCandidateShape(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  candidates: readonly OverdueCommitmentPlanningCandidate[],
): OverdueCommitmentPlanningCheckResult {
  const violations: string[] = [];
  const allowedReviewPostures = new Set<ReviewPosture>([
    "review_required",
    "human_owner_required",
  ]);
  for (const candidate of candidates) {
    if (candidate.evidenceRefs.length === 0) {
      violations.push(`${candidate.itemId}: evidenceRefs is empty`);
    }
    if (!allowedReviewPostures.has(candidate.reviewPosture)) {
      violations.push(
        `${candidate.itemId}: reviewPosture must be review_required or human_owner_required, got "${candidate.reviewPosture}"`,
      );
    }
    if (candidate.riskLevel !== "high") {
      violations.push(
        `${candidate.itemId}: riskLevel must be "high", got "${candidate.riskLevel}"`,
      );
    }
    const primaryLower = candidate.primaryAction.toLowerCase();
    if (
      !primaryLower.startsWith("review") &&
      !primaryLower.startsWith("open")
    ) {
      violations.push(
        `${candidate.itemId}: primaryAction must use a review-required planning verb (review/open), got "${candidate.primaryAction}"`,
      );
    }
    const sourceRow = rows.find((r) => r.rowId === candidate.sourceRowId);
    if (!sourceRow) {
      violations.push(
        `${candidate.itemId}: candidate has no matching source row for shape check`,
      );
      continue;
    }
    if (!candidate.primaryAction.includes(sourceRow.commitmentId)) {
      violations.push(
        `${candidate.itemId}: primaryAction must reference the synthetic commitmentId "${sourceRow.commitmentId}"`,
      );
    }
    if (candidate.dueDateMs !== sourceRow.dueDateMs) {
      violations.push(
        `${candidate.itemId}: dueDateMs (${candidate.dueDateMs}) does not match source row (${sourceRow.dueDateMs})`,
      );
    }
    if (candidate.status !== sourceRow.status) {
      violations.push(
        `${candidate.itemId}: status (${candidate.status}) does not match source row (${sourceRow.status})`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "candidate_shape_is_planning_only_review_required",
    passed,
    detail: passed
      ? "All candidates carry evidenceRefs, review-required posture, riskLevel=high, a review/open primaryAction referencing the synthetic commitmentId, and dueDateMs/status mirroring the source row."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkFixtureCoversAllReasons(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly OverdueCommitmentPlanningCandidate[],
  excluded: readonly OverdueCommitmentExcludedRow[],
): OverdueCommitmentPlanningCheckResult {
  const reasons = new Set(excluded.map((row) => row.reason));
  const requiredReasons: OverdueCommitmentExclusionReason[] = [
    "threshold_not_met",
    "terminal_status",
    "missing_due_date",
    "workspace_boundary_not_confirmed",
  ];
  const missing = requiredReasons.filter((reason) => !reasons.has(reason));
  const violations: string[] = [];
  if (missing.length > 0) {
    violations.push(`missing exclusion reasons: ${missing.join(", ")}`);
  }
  if (candidates.length === 0) {
    violations.push(
      "fixture must include at least one candidate (dueDate past, status non-terminal, workspace confirmed)",
    );
  }
  // Persisted-flag-mismatch coverage: at least one fixture row must have its
  // persistedOverdueFlag DIFFERENT from the read-time derivation outcome,
  // which is the deterministic proof that the persisted column is not
  // authoritative for time-sensitive filtering.
  const mismatchSeen = rows.some((row) => {
    const hasDueDate = row.dueDateMs !== null;
    const readTimeOverdue =
      hasDueDate &&
      !isTerminalCommitmentStatus(row.status) &&
      row.dueDateMs !== null &&
      row.dueDateMs < referenceClockMs;
    return readTimeOverdue !== row.persistedOverdueFlag;
  });
  if (!mismatchSeen) {
    violations.push(
      "fixture must include at least one row where persistedOverdueFlag mismatches the read-time derivation result",
    );
  }
  const passed = violations.length === 0;
  return {
    checkName:
      "fixture_covers_inclusion_all_exclusion_reasons_and_persisted_flag_mismatch",
    passed,
    detail: passed
      ? "Fixture covers at least one inclusion, all four exclusion reasons, and at least one persisted-flag mismatch demonstration."
      : `Violations: ${violations.join("; ")}`,
  };
}

/**
 * Evaluate the planning artifact against a row set and a reference clock.
 * Pure: caller supplies referenceClockMs explicitly; no Date.now is called.
 */
export function evaluateOverdueCommitmentPlanning(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
  referenceClockMs: number,
): OverdueCommitmentPlanningSummary {
  const built = buildOverdueCommitmentPlanningCandidates(
    rows,
    referenceClockMs,
  );
  const checks: OverdueCommitmentPlanningCheckResult[] = [
    checkOnlyTpqr003Rows(built.candidates),
    checkReadTimeDueDateStatusDerivation(
      rows,
      referenceClockMs,
      built.candidates,
      built.excluded,
    ),
    checkNoPersistedOverdueFlagAuthority(
      rows,
      referenceClockMs,
      built.candidates,
    ),
    checkNoRuntimeOrSchemaOrWriteAuthority(built.candidates, built.excluded),
    checkMembershipBoundaryPresent(rows, built.candidates),
    checkExcludedRowsHaveReasons(built.excluded),
    checkDeterministicOrdering(rows, referenceClockMs, built.candidates),
    checkBoundaryDistinctions(built.candidates),
    checkCandidateShape(rows, built.candidates),
    checkFixtureCoversAllReasons(
      rows,
      referenceClockMs,
      built.candidates,
      built.excluded,
    ),
  ];
  return {
    tpqrId: OVERDUE_COMMITMENT_PLANNING_TPQR_ID,
    preflightId: OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID,
    thresholdRule: OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE,
    graceMs: OVERDUE_COMMITMENT_PLANNING_GRACE_MS,
    referenceClockMs,
    totalSourceRows: rows.length,
    includedCount: built.candidates.length,
    excludedCount: built.excluded.length,
    candidates: built.candidates,
    excluded: built.excluded,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
