/**
 * Helm Business Advancement - Phase 3B / TPQR-001 / PF3-001
 * Blocked-decision planning artifact (planning-only, no runtime adoption).
 *
 * This is the first Phase 3B planning artifact authorized by
 * docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md.
 * Phase 3A closeout granted PF3-001 / TPQR-001 a Planning Go: produce a
 * deterministic, planning-only artifact that calibrates the 48h threshold
 * candidate for meeting / blocked_decision and aligns the input shape to the
 * MustPushItem planning contract WITHOUT introducing any runtime extractor,
 * schema change, API route, page / dashboard / mobile UI behavior change,
 * production query adoption, official write, auto-execution, auto-send,
 * auto-approval, or LLM final ranking.
 *
 * Upstream gate (verbatim re-statement):
 *   - Phase 3 entry-gate preflight marked PF3-001 ready_for_thin_read_model_planning
 *     because ActionItem.workspaceId is a non-nullable FK to Workspace and the
 *     approvalTask relation is nullable. A future thin filter could identify
 *     action items needing approval / review without any schema change.
 *   - Phase 3A closeout decision: Phase 3B = conditional partial Go for
 *     PLANNING ONLY. Runtime / schema / API / UI / official write /
 *     auto-execution / LLM final ranking / production query adoption = No-Go.
 *   - The 48h threshold here is a PLANNING CANDIDATE only. It is NOT a
 *     production threshold. Real-data calibration must happen in a separate
 *     review before any runtime adoption.
 *
 * Hard non-goals (preserved):
 *   - No Prisma schema change, no @updatedAt-style auto-refresh assumption.
 *   - No modification to data/queries.ts, features/mobile/lib/mobile-command-read-model.ts,
 *     app/, app/api/, lib/* runtime code.
 *   - No runtime extractor, no event queue, no background job, no production
 *     query adoption.
 *   - No LLM final ranking; ordering is deterministic.
 *   - No official write, no auto-send, no auto-approval, no auto-execution.
 *   - No TPQR-002 / TPQR-005 work surface; both remain No-Go in Phase 3B.
 *
 * Planning candidate shape: MustPushItem from ./contracts. Candidates carry
 * planning-only metadata (planningOnly: true, threshold, staleness, deep-link
 * planning target). They are NOT runtime items, NOT commitments, NOT approved
 * actions, and NOT auto-executed.
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

/** 48 hours in milliseconds. PLANNING CANDIDATE only - not a production threshold. */
export const BLOCKED_DECISION_PLANNING_THRESHOLD_MS: number =
  48 * 60 * 60 * 1000;

/**
 * Deterministic reference clock used by the bundled fixture set and the CLI
 * script. Callers MUST pass an explicit referenceClockMs into the helpers;
 * this constant is exposed only so the bundled fixture has a stable anchor.
 *
 * Pure: Date.UTC is a stateless arithmetic on its arguments.
 */
export const BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS: number = Date.UTC(
  2026,
  3,
  26,
  0,
  0,
  0,
  0,
);

/** TPQR identifier for this planning artifact. */
export const BLOCKED_DECISION_PLANNING_TPQR_ID = "TPQR-001" as const;

/** Phase 3 preflight identifier this artifact is anchored to. */
export const BLOCKED_DECISION_PLANNING_PREFLIGHT_ID = "PF3-001" as const;

/** Source / signal anchor for this artifact. */
export const BLOCKED_DECISION_PLANNING_SOURCE_TYPE = "meeting" as const satisfies SourceType;
export const BLOCKED_DECISION_PLANNING_SIGNAL_TYPE =
  "blocked_decision" as const satisfies SignalType;

// ---------------------------------------------------------------------------
// Source-row types (planning-only fixture, NOT runtime data)
// ---------------------------------------------------------------------------

/**
 * One synthetic blocked-decision planning source row. These rows are NOT
 * runtime data. They model the SHAPE of an ActionItem (with optional
 * approvalTask relation) that a future thin read-model filter MIGHT consider,
 * without any schema or runtime change today.
 */
export interface BlockedDecisionPlanningSourceRow {
  /** Stable identifier for this fixture row. */
  readonly rowId: string;
  /** Workspace scope (synthetic). */
  readonly workspaceId: string;
  /** Whether workspace membership has been confirmed for this row. */
  readonly workspaceMembershipConfirmed: boolean;
  /** Synthetic ActionItem identifier. */
  readonly actionItemId: string;
  /** Synthetic Meeting identifier (deep-link anchor for planning candidates). */
  readonly meetingId: string;
  /** Short human-readable title for the blocked decision. */
  readonly title: string;
  /** Whether the row already has a non-null approvalTask relation. */
  readonly hasApprovalTask: boolean;
  /** Synthetic ActionItem.updatedAt expressed in epoch milliseconds. */
  readonly updatedAtMs: number;
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
 *   workspace_boundary_not_confirmed > already_in_review > threshold_not_met.
 */
export type BlockedDecisionExclusionReason =
  | "threshold_not_met"
  | "already_in_review"
  | "workspace_boundary_not_confirmed";

// ---------------------------------------------------------------------------
// Planning candidate shape (MustPushItem-shaped, PLANNING-ONLY)
// ---------------------------------------------------------------------------

/**
 * BlockedDecisionPlanningCandidate - MustPushItem-shaped planning candidate.
 *
 * The base shape (itemId / title / reason / evidenceRefs / primaryAction /
 * boundaryNote / reviewPosture / sourceSummary / riskLevel / sortKey) conforms
 * to MustPushItem from ./contracts so a downstream thin read-model planning
 * step can align without re-defining the contract.
 *
 * Extra metadata (planningOnly / tpqrId / preflightId / signalType / sourceType /
 * thresholdMs / stalenessMs / evaluatedAtMs / deepLinkPlanningTarget /
 * sourceRowId) is PLANNING-ONLY and explicitly marks the candidate as not a
 * runtime item, not an approved action, and not an auto-executed item.
 */
export interface BlockedDecisionPlanningCandidate extends MustPushItem {
  readonly planningOnly: true;
  readonly tpqrId: typeof BLOCKED_DECISION_PLANNING_TPQR_ID;
  readonly preflightId: typeof BLOCKED_DECISION_PLANNING_PREFLIGHT_ID;
  readonly signalType: typeof BLOCKED_DECISION_PLANNING_SIGNAL_TYPE;
  readonly sourceType: typeof BLOCKED_DECISION_PLANNING_SOURCE_TYPE;
  readonly thresholdMs: number;
  readonly stalenessMs: number;
  readonly evaluatedAtMs: number;
  readonly deepLinkPlanningTarget: string;
  readonly sourceRowId: string;
}

// ---------------------------------------------------------------------------
// Excluded row record
// ---------------------------------------------------------------------------

/**
 * Excluded planning-source row paired with its deterministic reason.
 */
export interface BlockedDecisionExcludedRow {
  readonly sourceRowId: string;
  readonly reason: BlockedDecisionExclusionReason;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// Per-row evaluation result (pure)
// ---------------------------------------------------------------------------

export type BlockedDecisionRowEvaluation =
  | {
      readonly included: true;
      readonly candidate: BlockedDecisionPlanningCandidate;
    }
  | {
      readonly included: false;
      readonly excluded: BlockedDecisionExcludedRow;
    };

// ---------------------------------------------------------------------------
// Eval check / summary types
// ---------------------------------------------------------------------------

export interface BlockedDecisionPlanningCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface BlockedDecisionPlanningSummary {
  readonly tpqrId: typeof BLOCKED_DECISION_PLANNING_TPQR_ID;
  readonly preflightId: typeof BLOCKED_DECISION_PLANNING_PREFLIGHT_ID;
  readonly thresholdMs: number;
  readonly referenceClockMs: number;
  readonly totalSourceRows: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly candidates: readonly BlockedDecisionPlanningCandidate[];
  readonly excluded: readonly BlockedDecisionExcludedRow[];
  readonly checks: readonly BlockedDecisionPlanningCheckResult[];
  readonly allPassed: boolean;
}

// ---------------------------------------------------------------------------
// Boundary notes (carry recommendation / explanation / draft / proof distinctions)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTE_PARTS: readonly string[] = [
  "recommendation != commitment - planning candidate only, never an external commitment.",
  "explanation != approval - citing meeting evidence does not approve the contract terms or assign an owner.",
  "draft != send - any drafted reply or assignment must be reviewed before send.",
  "proof != external write success - verifying the planning shape does not authorize outbound writes or auto-approval.",
  "PF3-001 / TPQR-001 Phase 3B planning-only - review-only shape, no runtime extractor, no schema change, no API route, no page behavior change, no production query path, no outbound-system mutation, no automated execution, deterministic ordering only.",
];

/** Joined boundary note string used on every candidate. */
const SHARED_BOUNDARY_NOTE = SHARED_BOUNDARY_NOTE_PARTS.join(" ");

// ---------------------------------------------------------------------------
// Planning fixture rows (TPQR-001 only; deterministic; non-runtime)
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

export const BLOCKED_DECISION_PLANNING_FIXTURE_ROWS: readonly BlockedDecisionPlanningSourceRow[] =
  [
    // -----------------------------------------------------------------------
    // BD-PLAN-001 - stale (60h > 48h), no approvalTask, workspace confirmed
    // Expected: included as planning candidate.
    // -----------------------------------------------------------------------
    {
      rowId: "BD-PLAN-001",
      workspaceId: "ws-synth-tpqr001-a",
      workspaceMembershipConfirmed: true,
      actionItemId: "synth-action-item-001",
      meetingId: "synth-meeting-001",
      title: "Confirm contract clause owner (planning candidate)",
      hasApprovalTask: false,
      updatedAtMs: BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS - 60 * HOUR_MS,
      evidenceRefs: [
        "synthetic meeting note: contract clause flagged as needing decision owner",
        "synthetic action-item record: no approvalTask, no owner reassignment within 48h window",
      ],
      sourceScenario:
        "Meeting raised a contract clause that needs an owner decision; 48h elapsed with no approvalTask and no owner reassignment.",
    },

    // -----------------------------------------------------------------------
    // BD-PLAN-002 - fresh (12h < 48h), no approvalTask, workspace confirmed
    // Expected: excluded with reason threshold_not_met.
    // -----------------------------------------------------------------------
    {
      rowId: "BD-PLAN-002",
      workspaceId: "ws-synth-tpqr001-a",
      workspaceMembershipConfirmed: true,
      actionItemId: "synth-action-item-002",
      meetingId: "synth-meeting-002",
      title: "Newly raised pricing exception (planning candidate)",
      hasApprovalTask: false,
      updatedAtMs: BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS - 12 * HOUR_MS,
      evidenceRefs: [
        "synthetic meeting note: pricing exception raised under 12 hours ago",
      ],
      sourceScenario:
        "Pricing exception was raised in the last 12 hours; the 48h planning threshold has not been crossed yet.",
    },

    // -----------------------------------------------------------------------
    // BD-PLAN-003 - stale (96h), already has approvalTask, workspace confirmed
    // Expected: excluded with reason already_in_review.
    // -----------------------------------------------------------------------
    {
      rowId: "BD-PLAN-003",
      workspaceId: "ws-synth-tpqr001-b",
      workspaceMembershipConfirmed: true,
      actionItemId: "synth-action-item-003",
      meetingId: "synth-meeting-003",
      title: "Discount approval already in review (planning candidate)",
      hasApprovalTask: true,
      updatedAtMs: BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS - 96 * HOUR_MS,
      evidenceRefs: [
        "synthetic action-item record: approvalTask already exists with status PENDING",
      ],
      sourceScenario:
        "An approvalTask already exists for this blocked decision; the existing review path owns it and a new planning candidate would duplicate human attention.",
    },

    // -----------------------------------------------------------------------
    // BD-PLAN-004 - stale (72h), no approvalTask, workspace membership NOT confirmed
    // Expected: excluded with reason workspace_boundary_not_confirmed.
    // -----------------------------------------------------------------------
    {
      rowId: "BD-PLAN-004",
      workspaceId: "ws-synth-tpqr001-c",
      workspaceMembershipConfirmed: false,
      actionItemId: "synth-action-item-004",
      meetingId: "synth-meeting-004",
      title: "Cross-workspace blocked decision (planning candidate)",
      hasApprovalTask: false,
      updatedAtMs: BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS - 72 * HOUR_MS,
      evidenceRefs: [
        "synthetic action-item record: workspace membership not confirmed for the requesting principal",
      ],
      sourceScenario:
        "Workspace membership boundary is not confirmed for this row; cross-workspace exposure would violate the workspace-first isolation contract.",
    },
  ] as const;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const REVIEW_POSTURE_FOR_BLOCKED_DECISION: ReviewPosture =
  "human_owner_required";
const RISK_LEVEL_FOR_BLOCKED_DECISION: RiskLevel = "high";
const PRIMARY_ACTION_VERB: AllowedActionVerb = "open";

/**
 * Build a deep-link style planning target for a meeting / action-item pair.
 * Pure: returns a stable string locator only; does not navigate, fetch, or
 * route. The returned string is a planning anchor, never an executable URL.
 */
export function buildBlockedDecisionDeepLinkPlanningTarget(
  meetingId: string,
  actionItemId: string,
): string {
  return `planning://meeting/${meetingId}#action-item=${actionItemId}`;
}

/**
 * Compute staleness in milliseconds for a row.
 * Pure: relies only on its arguments. Negative/zero results are clamped to 0
 * so a future-dated updatedAt cannot synthesize positive staleness.
 */
export function computeBlockedDecisionStalenessMs(
  row: BlockedDecisionPlanningSourceRow,
  referenceClockMs: number,
): number {
  const raw = referenceClockMs - row.updatedAtMs;
  return raw > 0 ? raw : 0;
}

/**
 * Evaluate one source row deterministically.
 *
 * Priority order (highest first):
 *   1. workspace_boundary_not_confirmed (any row with unconfirmed membership)
 *   2. already_in_review (row already has approvalTask)
 *   3. threshold_not_met (stalenessMs <= thresholdMs)
 *   4. otherwise included as a planning candidate.
 *
 * Pure: no DB / network / Date.now side effect.
 */
export function evaluateBlockedDecisionRow(
  row: BlockedDecisionPlanningSourceRow,
  referenceClockMs: number,
): BlockedDecisionRowEvaluation {
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
  if (row.hasApprovalTask) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "already_in_review",
        detail:
          "An approvalTask is already attached to this action-item; the existing review path owns it.",
      },
    };
  }
  const stalenessMs = computeBlockedDecisionStalenessMs(row, referenceClockMs);
  if (stalenessMs <= BLOCKED_DECISION_PLANNING_THRESHOLD_MS) {
    return {
      included: false,
      excluded: {
        sourceRowId: row.rowId,
        reason: "threshold_not_met",
        detail: `stalenessMs (${stalenessMs}) does not exceed the 48h planning candidate threshold (${BLOCKED_DECISION_PLANNING_THRESHOLD_MS}).`,
      },
    };
  }

  const deepLinkPlanningTarget = buildBlockedDecisionDeepLinkPlanningTarget(
    row.meetingId,
    row.actionItemId,
  );
  const primaryAction = `${PRIMARY_ACTION_VERB}: ${deepLinkPlanningTarget} (review required; planning candidate)`;
  const candidate: BlockedDecisionPlanningCandidate = {
    itemId: `${row.rowId}-candidate`,
    title: row.title,
    reason: `Blocked decision unresolved beyond the 48h planning threshold (stalenessMs=${stalenessMs}); planning candidate only.`,
    evidenceRefs: row.evidenceRefs,
    primaryAction,
    boundaryNote: SHARED_BOUNDARY_NOTE,
    reviewPosture: REVIEW_POSTURE_FOR_BLOCKED_DECISION,
    sourceSummary: row.sourceScenario,
    riskLevel: RISK_LEVEL_FOR_BLOCKED_DECISION,
    // Placeholder; replaced by deterministic ranker below.
    sortKey: 0,
    planningOnly: true,
    tpqrId: BLOCKED_DECISION_PLANNING_TPQR_ID,
    preflightId: BLOCKED_DECISION_PLANNING_PREFLIGHT_ID,
    signalType: BLOCKED_DECISION_PLANNING_SIGNAL_TYPE,
    sourceType: BLOCKED_DECISION_PLANNING_SOURCE_TYPE,
    thresholdMs: BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
    stalenessMs,
    evaluatedAtMs: referenceClockMs,
    deepLinkPlanningTarget,
    sourceRowId: row.rowId,
  };
  return { included: true, candidate };
}

/**
 * Compare two candidates deterministically.
 *
 * Order:
 *   1. larger stalenessMs first (higher staleness -> higher priority).
 *   2. smaller sourceRowId (lexicographic) first as tie-breaker.
 *
 * Pure / total / antisymmetric on the bundled fixture set.
 */
export function compareBlockedDecisionCandidates(
  a: BlockedDecisionPlanningCandidate,
  b: BlockedDecisionPlanningCandidate,
): number {
  if (a.stalenessMs !== b.stalenessMs) {
    return b.stalenessMs - a.stalenessMs;
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
export function buildBlockedDecisionPlanningCandidates(
  rows: readonly BlockedDecisionPlanningSourceRow[],
  referenceClockMs: number,
): {
  readonly candidates: readonly BlockedDecisionPlanningCandidate[];
  readonly excluded: readonly BlockedDecisionExcludedRow[];
} {
  const candidatesUnordered: BlockedDecisionPlanningCandidate[] = [];
  const excluded: BlockedDecisionExcludedRow[] = [];
  for (const row of rows) {
    const result = evaluateBlockedDecisionRow(row, referenceClockMs);
    if (result.included) {
      candidatesUnordered.push(result.candidate);
    } else {
      excluded.push(result.excluded);
    }
  }
  const ordered = [...candidatesUnordered].sort(
    compareBlockedDecisionCandidates,
  );
  const candidates: BlockedDecisionPlanningCandidate[] = ordered.map(
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
  "official_write",
  "official write",
  "auto_send",
  "auto send",
  "auto-send",
  "auto_approve",
  "auto approve",
  "auto-approve",
  "auto_settlement",
  "auto settlement",
  "cross_tenant",
  "cross-tenant",
  "llm_rank",
  "llm rank",
  "llm may determine",
  "llm may rank",
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

function checkOnlyTpqr001Rows(
  candidates: readonly BlockedDecisionPlanningCandidate[],
): BlockedDecisionPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    if (candidate.tpqrId !== BLOCKED_DECISION_PLANNING_TPQR_ID) {
      violations.push(`${candidate.itemId}: tpqrId="${candidate.tpqrId}"`);
    }
    if (candidate.preflightId !== BLOCKED_DECISION_PLANNING_PREFLIGHT_ID) {
      violations.push(
        `${candidate.itemId}: preflightId="${candidate.preflightId}"`,
      );
    }
    if (candidate.signalType !== BLOCKED_DECISION_PLANNING_SIGNAL_TYPE) {
      violations.push(
        `${candidate.itemId}: signalType="${candidate.signalType}"`,
      );
    }
    if (candidate.sourceType !== BLOCKED_DECISION_PLANNING_SOURCE_TYPE) {
      violations.push(
        `${candidate.itemId}: sourceType="${candidate.sourceType}"`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "only_tpqr001_blocked_decision_meeting_rows",
    passed,
    detail: passed
      ? "All candidates carry tpqrId=TPQR-001 / preflightId=PF3-001 / signalType=blocked_decision / sourceType=meeting."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkThresholdIs48hPlanningCandidate(
  candidates: readonly BlockedDecisionPlanningCandidate[],
): BlockedDecisionPlanningCheckResult {
  const expected = BLOCKED_DECISION_PLANNING_THRESHOLD_MS;
  const violations = candidates.filter(
    (c) => c.thresholdMs !== expected,
  );
  const passed =
    violations.length === 0 && expected === 48 * 60 * 60 * 1000;
  return {
    checkName: "threshold_is_48h_planning_candidate",
    passed,
    detail: passed
      ? `All candidates carry thresholdMs=${expected} (48h planning candidate; not a production threshold).`
      : `Threshold violations: ${violations
          .map((c) => `${c.itemId}=${c.thresholdMs}`)
          .join(", ")}`,
  };
}

function checkNoRuntimeOrSchemaOrWriteAuthority(
  candidates: readonly BlockedDecisionPlanningCandidate[],
  excluded: readonly BlockedDecisionExcludedRow[],
): BlockedDecisionPlanningCheckResult {
  const violations: string[] = [];
  for (const candidate of candidates) {
    const fields: string[] = [
      candidate.title,
      candidate.reason,
      candidate.primaryAction,
      candidate.boundaryNote,
      candidate.sourceSummary,
      candidate.deepLinkPlanningTarget,
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
      ? "No candidate or excluded reason carries runtime / schema / write / auto-execute / LLM-ranking authority."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkMembershipBoundaryPresent(
  rows: readonly BlockedDecisionPlanningSourceRow[],
  candidates: readonly BlockedDecisionPlanningCandidate[],
): BlockedDecisionPlanningCheckResult {
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
  excluded: readonly BlockedDecisionExcludedRow[],
): BlockedDecisionPlanningCheckResult {
  const allowed = new Set<BlockedDecisionExclusionReason>([
    "threshold_not_met",
    "already_in_review",
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
  rows: readonly BlockedDecisionPlanningSourceRow[],
  referenceClockMs: number,
  candidates: readonly BlockedDecisionPlanningCandidate[],
): BlockedDecisionPlanningCheckResult {
  const reversed = [...rows].reverse();
  const rebuilt = buildBlockedDecisionPlanningCandidates(
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
    const cmp = compareBlockedDecisionCandidates(
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
    detail: "Re-ordering inputs yields the same candidate sequence; sortKey is zero-based contiguous.",
  };
}

function checkBoundaryDistinctions(
  candidates: readonly BlockedDecisionPlanningCandidate[],
): BlockedDecisionPlanningCheckResult {
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
    checkName: "boundary_notes_preserve_recommendation_explanation_draft_proof",
    passed,
    detail: passed
      ? "All candidates preserve recommendation/explanation/draft/proof distinctions in boundaryNote."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkCandidateShape(
  candidates: readonly BlockedDecisionPlanningCandidate[],
): BlockedDecisionPlanningCheckResult {
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
    if (candidate.deepLinkPlanningTarget.trim() === "") {
      violations.push(`${candidate.itemId}: deepLinkPlanningTarget is empty`);
    }
    const primaryLower = candidate.primaryAction.toLowerCase();
    if (
      !primaryLower.startsWith("open") &&
      !primaryLower.startsWith("review")
    ) {
      violations.push(
        `${candidate.itemId}: primaryAction must use a review-required / deep-link planning verb (open/review), got "${candidate.primaryAction}"`,
      );
    }
    if (!candidate.primaryAction.includes(candidate.deepLinkPlanningTarget)) {
      violations.push(
        `${candidate.itemId}: primaryAction must reference the deep-link planning target`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "candidate_shape_is_planning_only_review_required",
    passed,
    detail: passed
      ? "All candidates carry evidenceRefs, review-required posture, riskLevel=high, and a deep-link planning primaryAction."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkFixtureCoversAllReasons(
  candidates: readonly BlockedDecisionPlanningCandidate[],
  excluded: readonly BlockedDecisionExcludedRow[],
): BlockedDecisionPlanningCheckResult {
  const reasons = new Set(excluded.map((row) => row.reason));
  const requiredReasons: BlockedDecisionExclusionReason[] = [
    "threshold_not_met",
    "already_in_review",
    "workspace_boundary_not_confirmed",
  ];
  const missing = requiredReasons.filter((reason) => !reasons.has(reason));
  const violations: string[] = [];
  if (missing.length > 0) {
    violations.push(`missing exclusion reasons: ${missing.join(", ")}`);
  }
  if (candidates.length === 0) {
    violations.push(
      "fixture must include at least one candidate (stale, no approvalTask, workspace confirmed)",
    );
  }
  const passed = violations.length === 0;
  return {
    checkName: "fixture_covers_inclusion_and_all_exclusion_reasons",
    passed,
    detail: passed
      ? "Fixture covers one inclusion case and all three exclusion reasons."
      : `Violations: ${violations.join("; ")}`,
  };
}

/**
 * Evaluate the planning artifact against a row set and a reference clock.
 * Pure: caller supplies referenceClockMs explicitly; no Date.now is called.
 */
export function evaluateBlockedDecisionPlanning(
  rows: readonly BlockedDecisionPlanningSourceRow[],
  referenceClockMs: number,
): BlockedDecisionPlanningSummary {
  const built = buildBlockedDecisionPlanningCandidates(rows, referenceClockMs);
  const checks: BlockedDecisionPlanningCheckResult[] = [
    checkOnlyTpqr001Rows(built.candidates),
    checkThresholdIs48hPlanningCandidate(built.candidates),
    checkNoRuntimeOrSchemaOrWriteAuthority(built.candidates, built.excluded),
    checkMembershipBoundaryPresent(rows, built.candidates),
    checkExcludedRowsHaveReasons(built.excluded),
    checkDeterministicOrdering(rows, referenceClockMs, built.candidates),
    checkBoundaryDistinctions(built.candidates),
    checkCandidateShape(built.candidates),
    checkFixtureCoversAllReasons(built.candidates, built.excluded),
  ];
  return {
    tpqrId: BLOCKED_DECISION_PLANNING_TPQR_ID,
    preflightId: BLOCKED_DECISION_PLANNING_PREFLIGHT_ID,
    thresholdMs: BLOCKED_DECISION_PLANNING_THRESHOLD_MS,
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
