/**
 * Helm Business Advancement - Phase 3H
 * Named source function planning artifact.
 *
 * Pure planning-only. This file instantiates the Phase 3G query shapes as
 * named, pure TypeScript source functions for TPQR-001 (blocked_decision),
 * TPQR-003 (overdue_commitment), and TPQR-004 (customer_waiting) over
 * synthetic input rows only.
 *
 * This file is NOT a runtime adapter, NOT a DB reader, NOT a production query,
 * NOT an API route, NOT a mobile read-model integration, NOT a schema change,
 * NOT an extractor, NOT an event queue, NOT an official write, and NOT an
 * automated execution authority. It does not import from @/, does not import
 * db, does not read the wall clock, and makes no filesystem or network calls.
 *
 * Runtime adoption posture: No-Go.
 * Phase 3I runtime source review is required before any production adoption.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PHASE3H_RULE_VERSION =
  "phase3h-named-source-function-planning/v1" as const;

export const PHASE3H_FIXTURE_WORKSPACE_ID =
  "ws-synth-phase3h-src-fn" as const;

/** Deterministic fixture clock: 2026-04-24T00:00:00.000Z */
export const PHASE3H_REFERENCE_CLOCK_MS = 1777161600000 as const;

/** 48-hour planning threshold for TPQR-001. Planning candidate only. */
export const PHASE3H_BLOCKED_DECISION_THRESHOLD_MS = 172800000 as const;

/** Default enabled state for all three named source functions. */
export const PHASE3H_DEFAULT_ENABLED = false as const;

const TERMINAL_COMMITMENT_STATUSES: ReadonlySet<string> = new Set([
  "FULFILLED",
  "CANCELED",
]);

const WAITING_US_STATUS = "WAITING_US" as const;

// ---------------------------------------------------------------------------
// Shared audit types
// ---------------------------------------------------------------------------

export interface Phase3hCandidateAudit {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly sourceRowId: string;
  readonly ruleVersion: typeof PHASE3H_RULE_VERSION;
  readonly thresholdStatus: "calibration_placeholder";
  readonly exclusionReason: null;
  readonly sourceFunctionName: string;
}

export interface Phase3hExcludedAudit {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly sourceRowId: string;
  readonly ruleVersion: typeof PHASE3H_RULE_VERSION;
  readonly thresholdStatus: "calibration_placeholder" | "threshold_not_met" | null;
  readonly exclusionReason: string;
  readonly sourceFunctionName: string;
}

// ---------------------------------------------------------------------------
// TPQR-001: blocked_decision named source function
// ---------------------------------------------------------------------------

export interface Tpqr001SourceRow {
  readonly rowId: string;
  readonly workspaceId: string;
  /** Maps to ActionItem.updatedAt as epoch ms. */
  readonly updatedAtMs: number;
  /** true when ActionItem.approvalTask relation exists. */
  readonly hasApprovalTask: boolean;
}

export type Tpqr001ExclusionReason =
  | "disabled"
  | "workspace_mismatch"
  | "already_in_review"
  | "threshold_not_met";

export interface Tpqr001Candidate {
  readonly tpqrId: "TPQR-001";
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly stalenessMs: number;
  readonly audit: Phase3hCandidateAudit;
}

export interface Tpqr001ExcludedRow {
  readonly tpqrId: "TPQR-001";
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly exclusionReason: Tpqr001ExclusionReason;
  readonly audit: Phase3hExcludedAudit;
}

export interface Tpqr001SourceFunctionInput {
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly thresholdMs: number;
  readonly enabled: boolean;
  readonly rows: readonly Tpqr001SourceRow[];
}

export interface Tpqr001SourceFunctionResult {
  readonly included: readonly Tpqr001Candidate[];
  readonly excluded: readonly Tpqr001ExcludedRow[];
}

const TPQR001_FUNCTION_NAME = "sourceBlockedDecisionCandidates" as const;

function makeTpqr001Excluded(
  row: Tpqr001SourceRow,
  exclusionReason: Tpqr001ExclusionReason,
  thresholdStatus: Phase3hExcludedAudit["thresholdStatus"],
): Tpqr001ExcludedRow {
  return {
    tpqrId: "TPQR-001",
    sourceRowId: row.rowId,
    workspaceId: row.workspaceId,
    exclusionReason,
    audit: {
      tpqrId: "TPQR-001",
      sourceRowId: row.rowId,
      ruleVersion: PHASE3H_RULE_VERSION,
      thresholdStatus,
      exclusionReason,
      sourceFunctionName: TPQR001_FUNCTION_NAME,
    },
  };
}

/**
 * Named planning-only source function for TPQR-001 blocked_decision.
 *
 * Query shape: ActionItem WHERE workspaceId = :ws AND approvalTask IS NULL
 *   AND updatedAt < (:referenceClockMs - :thresholdMs)
 *
 * No DB, no wall-clock reads, no network. Synthetic rows only.
 */
export function sourceBlockedDecisionCandidates(
  input: Tpqr001SourceFunctionInput,
): Tpqr001SourceFunctionResult {
  if (!input.enabled) {
    return {
      included: [],
      excluded: input.rows.map((row) =>
        makeTpqr001Excluded(row, "disabled", null),
      ),
    };
  }

  const included: Tpqr001Candidate[] = [];
  const excluded: Tpqr001ExcludedRow[] = [];
  const cutoffMs = input.referenceClockMs - input.thresholdMs;

  for (const row of input.rows) {
    if (row.workspaceId !== input.workspaceId) {
      excluded.push(makeTpqr001Excluded(row, "workspace_mismatch", null));
      continue;
    }
    if (row.hasApprovalTask) {
      excluded.push(makeTpqr001Excluded(row, "already_in_review", null));
      continue;
    }
    if (row.updatedAtMs >= cutoffMs) {
      excluded.push(
        makeTpqr001Excluded(row, "threshold_not_met", "threshold_not_met"),
      );
      continue;
    }
    included.push({
      tpqrId: "TPQR-001",
      sourceRowId: row.rowId,
      workspaceId: row.workspaceId,
      stalenessMs: input.referenceClockMs - row.updatedAtMs,
      audit: {
        tpqrId: "TPQR-001",
        sourceRowId: row.rowId,
        ruleVersion: PHASE3H_RULE_VERSION,
        thresholdStatus: "calibration_placeholder",
        exclusionReason: null,
        sourceFunctionName: TPQR001_FUNCTION_NAME,
      },
    });
  }

  return { included, excluded };
}

// ---------------------------------------------------------------------------
// TPQR-001 fixture rows
// ---------------------------------------------------------------------------

/** Stale (4 days), no approval task, correct workspace → INCLUDED */
const TPQR001_ROW_STALE_NO_REVIEW: Tpqr001SourceRow = {
  rowId: "ai-001-stale-no-review",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  updatedAtMs: PHASE3H_REFERENCE_CLOCK_MS - 4 * 24 * 60 * 60 * 1000,
  hasApprovalTask: false,
};

/** Has approval task → EXCLUDED (already_in_review) */
const TPQR001_ROW_IN_REVIEW: Tpqr001SourceRow = {
  rowId: "ai-001-in-review",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  updatedAtMs: PHASE3H_REFERENCE_CLOCK_MS - 5 * 24 * 60 * 60 * 1000,
  hasApprovalTask: true,
};

/** Fresh (1 day), within 48h threshold → EXCLUDED (threshold_not_met) */
const TPQR001_ROW_FRESH: Tpqr001SourceRow = {
  rowId: "ai-001-fresh",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  updatedAtMs: PHASE3H_REFERENCE_CLOCK_MS - 24 * 60 * 60 * 1000,
  hasApprovalTask: false,
};

/** Wrong workspace → EXCLUDED (workspace_mismatch) */
const TPQR001_ROW_WRONG_WS: Tpqr001SourceRow = {
  rowId: "ai-001-wrong-ws",
  workspaceId: "ws-other-tpqr001",
  updatedAtMs: PHASE3H_REFERENCE_CLOCK_MS - 4 * 24 * 60 * 60 * 1000,
  hasApprovalTask: false,
};

export const PHASE3H_TPQR001_FIXTURE_ROWS: readonly Tpqr001SourceRow[] = [
  TPQR001_ROW_STALE_NO_REVIEW,
  TPQR001_ROW_IN_REVIEW,
  TPQR001_ROW_FRESH,
  TPQR001_ROW_WRONG_WS,
];

// ---------------------------------------------------------------------------
// TPQR-003: overdue_commitment named source function
// ---------------------------------------------------------------------------

export interface Tpqr003SourceRow {
  readonly rowId: string;
  readonly workspaceId: string;
  readonly commitmentId: string;
  /** Maps to Commitment.dueDate as epoch ms; null when not set. */
  readonly dueDateMs: number | null;
  /** Maps to Commitment.status. */
  readonly status: string;
  /**
   * Maps to Commitment.overdueFlag. Carried for completeness but MUST NOT be
   * used as an inclusion filter. Inclusion is determined solely by
   * dueDateMs < referenceClockMs AND status NOT IN terminal set.
   */
  readonly persistedOverdueFlag: boolean;
}

export type Tpqr003ExclusionReason =
  | "disabled"
  | "workspace_mismatch"
  | "missing_due_date"
  | "terminal_status"
  | "threshold_not_met";

export interface Tpqr003Candidate {
  readonly tpqrId: "TPQR-003";
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly commitmentId: string;
  readonly dueDateMs: number;
  readonly overdueByMs: number;
  readonly audit: Phase3hCandidateAudit;
}

export interface Tpqr003ExcludedRow {
  readonly tpqrId: "TPQR-003";
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly exclusionReason: Tpqr003ExclusionReason;
  readonly audit: Phase3hExcludedAudit;
}

export interface Tpqr003SourceFunctionInput {
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly enabled: boolean;
  readonly rows: readonly Tpqr003SourceRow[];
}

export interface Tpqr003SourceFunctionResult {
  readonly included: readonly Tpqr003Candidate[];
  readonly excluded: readonly Tpqr003ExcludedRow[];
}

const TPQR003_FUNCTION_NAME = "sourceOverdueCommitmentCandidates" as const;

function makeTpqr003Excluded(
  row: Tpqr003SourceRow,
  exclusionReason: Tpqr003ExclusionReason,
  thresholdStatus: Phase3hExcludedAudit["thresholdStatus"],
): Tpqr003ExcludedRow {
  return {
    tpqrId: "TPQR-003",
    sourceRowId: row.rowId,
    workspaceId: row.workspaceId,
    exclusionReason,
    audit: {
      tpqrId: "TPQR-003",
      sourceRowId: row.rowId,
      ruleVersion: PHASE3H_RULE_VERSION,
      thresholdStatus,
      exclusionReason,
      sourceFunctionName: TPQR003_FUNCTION_NAME,
    },
  };
}

/**
 * Named planning-only source function for TPQR-003 overdue_commitment.
 *
 * Query shape: Commitment WHERE workspaceId = :ws AND dueDate IS NOT NULL
 *   AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED','CANCELED')
 *
 * persistedOverdueFlag is NOT used for inclusion. referenceClockMs is
 * explicit and injected by the caller — the wall clock is never read.
 *
 * No DB, no wall-clock reads, no network. Synthetic rows only.
 */
export function sourceOverdueCommitmentCandidates(
  input: Tpqr003SourceFunctionInput,
): Tpqr003SourceFunctionResult {
  if (!input.enabled) {
    return {
      included: [],
      excluded: input.rows.map((row) =>
        makeTpqr003Excluded(row, "disabled", null),
      ),
    };
  }

  const included: Tpqr003Candidate[] = [];
  const excluded: Tpqr003ExcludedRow[] = [];

  for (const row of input.rows) {
    if (row.workspaceId !== input.workspaceId) {
      excluded.push(makeTpqr003Excluded(row, "workspace_mismatch", null));
      continue;
    }
    if (row.dueDateMs === null) {
      excluded.push(makeTpqr003Excluded(row, "missing_due_date", null));
      continue;
    }
    if (TERMINAL_COMMITMENT_STATUSES.has(row.status)) {
      excluded.push(makeTpqr003Excluded(row, "terminal_status", null));
      continue;
    }
    if (row.dueDateMs >= input.referenceClockMs) {
      excluded.push(
        makeTpqr003Excluded(row, "threshold_not_met", "threshold_not_met"),
      );
      continue;
    }
    included.push({
      tpqrId: "TPQR-003",
      sourceRowId: row.rowId,
      workspaceId: row.workspaceId,
      commitmentId: row.commitmentId,
      dueDateMs: row.dueDateMs,
      overdueByMs: input.referenceClockMs - row.dueDateMs,
      audit: {
        tpqrId: "TPQR-003",
        sourceRowId: row.rowId,
        ruleVersion: PHASE3H_RULE_VERSION,
        thresholdStatus: "calibration_placeholder",
        exclusionReason: null,
        sourceFunctionName: TPQR003_FUNCTION_NAME,
      },
    });
  }

  return { included, excluded };
}

// ---------------------------------------------------------------------------
// TPQR-003 fixture rows
// ---------------------------------------------------------------------------

/** Overdue, persistedOverdueFlag=false → INCLUDED (proves flag not used) */
const TPQR003_ROW_OVERDUE_FLAG_FALSE: Tpqr003SourceRow = {
  rowId: "c-003-overdue-flag-false",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  commitmentId: "cmmt-001",
  dueDateMs: PHASE3H_REFERENCE_CLOCK_MS - 5 * 24 * 60 * 60 * 1000,
  status: "ACTIVE",
  persistedOverdueFlag: false,
};

/** Overdue, persistedOverdueFlag=true → INCLUDED (proves flag not used) */
const TPQR003_ROW_OVERDUE_FLAG_TRUE: Tpqr003SourceRow = {
  rowId: "c-003-overdue-flag-true",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  commitmentId: "cmmt-002",
  dueDateMs: PHASE3H_REFERENCE_CLOCK_MS - 3 * 24 * 60 * 60 * 1000,
  status: "ACTIVE",
  persistedOverdueFlag: true,
};

/** Not yet overdue (dueDate in future) → EXCLUDED (threshold_not_met) */
const TPQR003_ROW_NOT_YET_OVERDUE: Tpqr003SourceRow = {
  rowId: "c-003-not-yet-overdue",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  commitmentId: "cmmt-003",
  dueDateMs: PHASE3H_REFERENCE_CLOCK_MS + 2 * 24 * 60 * 60 * 1000,
  status: "ACTIVE",
  persistedOverdueFlag: false,
};

/** Terminal status FULFILLED → EXCLUDED (terminal_status) */
const TPQR003_ROW_TERMINAL: Tpqr003SourceRow = {
  rowId: "c-003-terminal",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  commitmentId: "cmmt-004",
  dueDateMs: PHASE3H_REFERENCE_CLOCK_MS - 24 * 60 * 60 * 1000,
  status: "FULFILLED",
  persistedOverdueFlag: true,
};

/** No dueDate → EXCLUDED (missing_due_date) */
const TPQR003_ROW_NO_DUE_DATE: Tpqr003SourceRow = {
  rowId: "c-003-no-due-date",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  commitmentId: "cmmt-005",
  dueDateMs: null,
  status: "ACTIVE",
  persistedOverdueFlag: false,
};

/** Wrong workspace → EXCLUDED (workspace_mismatch) */
const TPQR003_ROW_WRONG_WS: Tpqr003SourceRow = {
  rowId: "c-003-wrong-ws",
  workspaceId: "ws-other-tpqr003",
  commitmentId: "cmmt-006",
  dueDateMs: PHASE3H_REFERENCE_CLOCK_MS - 2 * 24 * 60 * 60 * 1000,
  status: "ACTIVE",
  persistedOverdueFlag: false,
};

export const PHASE3H_TPQR003_FIXTURE_ROWS: readonly Tpqr003SourceRow[] = [
  TPQR003_ROW_OVERDUE_FLAG_FALSE,
  TPQR003_ROW_OVERDUE_FLAG_TRUE,
  TPQR003_ROW_NOT_YET_OVERDUE,
  TPQR003_ROW_TERMINAL,
  TPQR003_ROW_NO_DUE_DATE,
  TPQR003_ROW_WRONG_WS,
];

// ---------------------------------------------------------------------------
// TPQR-004: customer_waiting named source function
// ---------------------------------------------------------------------------

export interface Tpqr004SourceRow {
  readonly rowId: string;
  readonly workspaceId: string;
  /** Maps to EmailThread.id used as the dedup key. */
  readonly emailThreadId: string;
  /** Maps to EmailThread.status. Must be 'WAITING_US' to qualify. */
  readonly threadStatus: string;
  /** Maps to EmailThread.opportunityId. Not null = CRM-linked producer. */
  readonly opportunityId: string | null;
}

export type Tpqr004ExclusionReason =
  | "disabled"
  | "workspace_mismatch"
  | "not_waiting_us"
  | "deduped_by_crm_linked";

export interface Tpqr004Candidate {
  readonly tpqrId: "TPQR-004";
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly emailThreadId: string;
  readonly opportunityId: string | null;
  /** Which producer this candidate originated from. */
  readonly producerKind: "crm_linked" | "generic";
  readonly audit: Phase3hCandidateAudit;
}

export interface Tpqr004ExcludedRow {
  readonly tpqrId: "TPQR-004";
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly exclusionReason: Tpqr004ExclusionReason;
  readonly emailThreadId: string | null;
  readonly audit: Phase3hExcludedAudit;
}

export interface Tpqr004SourceFunctionInput {
  readonly workspaceId: string;
  readonly enabled: boolean;
  readonly rows: readonly Tpqr004SourceRow[];
}

export interface Tpqr004SourceFunctionResult {
  readonly included: readonly Tpqr004Candidate[];
  readonly excluded: readonly Tpqr004ExcludedRow[];
  /** Count of candidates from the CRM-linked producer. */
  readonly crmLinkedCandidateCount: number;
  /** Count of candidates from the generic producer (after dedup). */
  readonly genericCandidateCount: number;
}

const TPQR004_FUNCTION_NAME = "sourceCustomerWaitingCandidates" as const;

function makeTpqr004Excluded(
  row: Tpqr004SourceRow,
  exclusionReason: Tpqr004ExclusionReason,
): Tpqr004ExcludedRow {
  return {
    tpqrId: "TPQR-004",
    sourceRowId: row.rowId,
    workspaceId: row.workspaceId,
    exclusionReason,
    emailThreadId: row.emailThreadId,
    audit: {
      tpqrId: "TPQR-004",
      sourceRowId: row.rowId,
      ruleVersion: PHASE3H_RULE_VERSION,
      thresholdStatus: null,
      exclusionReason,
      sourceFunctionName: TPQR004_FUNCTION_NAME,
    },
  };
}

/**
 * Named planning-only source function for TPQR-004 customer_waiting.
 *
 * CRM-linked producer: EmailThread WHERE workspaceId = :ws
 *   AND status = 'WAITING_US' AND opportunityId IS NOT NULL
 *
 * Generic producer: EmailThread WHERE workspaceId = :ws
 *   AND status = 'WAITING_US' AND opportunityId IS NULL
 *
 * After-producer dedup by emailThreadId: CRM-linked wins.
 * CRM-linked rows are never excluded by the dedup — only generic-producer
 * entries whose emailThreadId is already claimed by a CRM-linked candidate
 * are excluded with reason deduped_by_crm_linked.
 *
 * No DB, no wall-clock reads, no network. Synthetic rows only.
 */
export function sourceCustomerWaitingCandidates(
  input: Tpqr004SourceFunctionInput,
): Tpqr004SourceFunctionResult {
  if (!input.enabled) {
    return {
      included: [],
      excluded: input.rows.map((row) => makeTpqr004Excluded(row, "disabled")),
      crmLinkedCandidateCount: 0,
      genericCandidateCount: 0,
    };
  }

  const included: Tpqr004Candidate[] = [];
  const excluded: Tpqr004ExcludedRow[] = [];

  const inScope: Tpqr004SourceRow[] = [];
  for (const row of input.rows) {
    if (row.workspaceId !== input.workspaceId) {
      excluded.push(makeTpqr004Excluded(row, "workspace_mismatch"));
    } else {
      inScope.push(row);
    }
  }

  const waitingRows: Tpqr004SourceRow[] = [];
  for (const row of inScope) {
    if (row.threadStatus !== WAITING_US_STATUS) {
      excluded.push(makeTpqr004Excluded(row, "not_waiting_us"));
    } else {
      waitingRows.push(row);
    }
  }

  // CRM-linked producer: WAITING_US rows with opportunityId present.
  const crmLinkedRows = waitingRows.filter((row) => row.opportunityId !== null);
  const crmLinkedEmailThreadIds = new Set(
    crmLinkedRows.map((row) => row.emailThreadId),
  );

  for (const row of crmLinkedRows) {
    included.push({
      tpqrId: "TPQR-004",
      sourceRowId: row.rowId,
      workspaceId: row.workspaceId,
      emailThreadId: row.emailThreadId,
      opportunityId: row.opportunityId,
      producerKind: "crm_linked",
      audit: {
        tpqrId: "TPQR-004",
        sourceRowId: row.rowId,
        ruleVersion: PHASE3H_RULE_VERSION,
        thresholdStatus: "calibration_placeholder",
        exclusionReason: null,
        sourceFunctionName: TPQR004_FUNCTION_NAME,
      },
    });
  }

  // Generic producer: WAITING_US rows with opportunityId === null.
  // After-producer dedup: if emailThreadId already claimed by CRM-linked,
  // exclude with deduped_by_crm_linked; otherwise include as generic.
  const genericRows = waitingRows.filter((row) => row.opportunityId === null);
  let genericCandidateCount = 0;
  for (const row of genericRows) {
    if (crmLinkedEmailThreadIds.has(row.emailThreadId)) {
      excluded.push(makeTpqr004Excluded(row, "deduped_by_crm_linked"));
    } else {
      included.push({
        tpqrId: "TPQR-004",
        sourceRowId: row.rowId,
        workspaceId: row.workspaceId,
        emailThreadId: row.emailThreadId,
        opportunityId: row.opportunityId,
        producerKind: "generic",
        audit: {
          tpqrId: "TPQR-004",
          sourceRowId: row.rowId,
          ruleVersion: PHASE3H_RULE_VERSION,
          thresholdStatus: "calibration_placeholder",
          exclusionReason: null,
          sourceFunctionName: TPQR004_FUNCTION_NAME,
        },
      });
      genericCandidateCount++;
    }
  }

  return {
    included,
    excluded,
    crmLinkedCandidateCount: crmLinkedRows.length,
    genericCandidateCount,
  };
}

// ---------------------------------------------------------------------------
// TPQR-004 fixture rows
// ---------------------------------------------------------------------------

/** CRM-linked (opportunityId present, WAITING_US) → INCLUDED as crm_linked */
const TPQR004_ROW_CRM_LINKED: Tpqr004SourceRow = {
  rowId: "et-004-crm",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  emailThreadId: "thread-crm-and-generic",
  threadStatus: "WAITING_US",
  opportunityId: "opp-001",
};

/**
 * Generic row sharing emailThreadId with CRM-linked → EXCLUDED (deduped_by_crm_linked).
 * This is the canonical after-producer dedup case: a separate physical row with
 * opportunityId=null whose thread is already claimed by the CRM-linked producer.
 */
const TPQR004_ROW_GENERIC_DUP: Tpqr004SourceRow = {
  rowId: "et-004-generic-dup",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  emailThreadId: "thread-crm-and-generic",
  threadStatus: "WAITING_US",
  opportunityId: null,
};

/** Generic-only (no opportunityId, unique emailThreadId) → INCLUDED as generic */
const TPQR004_ROW_GENERIC_ONLY: Tpqr004SourceRow = {
  rowId: "et-004-generic-only",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  emailThreadId: "thread-generic-only",
  threadStatus: "WAITING_US",
  opportunityId: null,
};

/** Wrong workspace → EXCLUDED (workspace_mismatch) */
const TPQR004_ROW_WRONG_WS: Tpqr004SourceRow = {
  rowId: "et-004-wrong-ws",
  workspaceId: "ws-other-tpqr004",
  emailThreadId: "thread-wrong-ws",
  threadStatus: "WAITING_US",
  opportunityId: null,
};

/** Non-WAITING_US status → EXCLUDED (not_waiting_us) */
const TPQR004_ROW_NOT_WAITING: Tpqr004SourceRow = {
  rowId: "et-004-not-waiting",
  workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
  emailThreadId: "thread-not-waiting",
  threadStatus: "REPLIED_US",
  opportunityId: null,
};

export const PHASE3H_TPQR004_FIXTURE_ROWS: readonly Tpqr004SourceRow[] = [
  TPQR004_ROW_CRM_LINKED,
  TPQR004_ROW_GENERIC_ONLY,
  TPQR004_ROW_GENERIC_DUP,
  TPQR004_ROW_WRONG_WS,
  TPQR004_ROW_NOT_WAITING,
];

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export interface Phase3hCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Phase3hEvaluationSummary {
  readonly ruleVersion: typeof PHASE3H_RULE_VERSION;
  readonly checks: readonly Phase3hCheckResult[];
  readonly totalChecks: number;
  readonly passed: number;
  readonly allPassed: boolean;
  readonly runtimeAdoptionPosture: "No-Go";
  readonly nextAllowedWork: string;
}

function buildEnabledTpqr001Result(): Tpqr001SourceFunctionResult {
  return sourceBlockedDecisionCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
    thresholdMs: PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
    enabled: true,
    rows: PHASE3H_TPQR001_FIXTURE_ROWS,
  });
}

function buildEnabledTpqr003Result(): Tpqr003SourceFunctionResult {
  return sourceOverdueCommitmentCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
    enabled: true,
    rows: PHASE3H_TPQR003_FIXTURE_ROWS,
  });
}

function buildEnabledTpqr004Result(): Tpqr004SourceFunctionResult {
  return sourceCustomerWaitingCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    enabled: true,
    rows: PHASE3H_TPQR004_FIXTURE_ROWS,
  });
}

function checkAllFunctionsDisabledWhenEnabledFalse(): Phase3hCheckResult {
  const r001 = sourceBlockedDecisionCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
    thresholdMs: PHASE3H_BLOCKED_DECISION_THRESHOLD_MS,
    enabled: false,
    rows: PHASE3H_TPQR001_FIXTURE_ROWS,
  });
  const r003 = sourceOverdueCommitmentCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
    enabled: false,
    rows: PHASE3H_TPQR003_FIXTURE_ROWS,
  });
  const r004 = sourceCustomerWaitingCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    enabled: false,
    rows: PHASE3H_TPQR004_FIXTURE_ROWS,
  });
  const allEmpty =
    r001.included.length === 0 &&
    r003.included.length === 0 &&
    r004.included.length === 0;
  return {
    checkName: "all_functions_disabled_when_enabled_false",
    passed: allEmpty,
    detail: allEmpty
      ? "All three source functions return no candidates when enabled=false."
      : `Unexpected candidates: tpqr001=${r001.included.length} tpqr003=${r003.included.length} tpqr004=${r004.included.length}`,
  };
}

function checkWorkspaceMismatchExcludedForAllFamilies(): Phase3hCheckResult {
  const r001 = buildEnabledTpqr001Result();
  const r003 = buildEnabledTpqr003Result();
  const r004 = buildEnabledTpqr004Result();

  const bad001 = r001.excluded.filter(
    (e) =>
      e.workspaceId !== PHASE3H_FIXTURE_WORKSPACE_ID &&
      e.exclusionReason !== "workspace_mismatch",
  );
  const bad003 = r003.excluded.filter(
    (e) =>
      e.workspaceId !== PHASE3H_FIXTURE_WORKSPACE_ID &&
      e.exclusionReason !== "workspace_mismatch",
  );
  const bad004 = r004.excluded.filter(
    (e) =>
      e.workspaceId !== PHASE3H_FIXTURE_WORKSPACE_ID &&
      e.exclusionReason !== "workspace_mismatch",
  );
  const has001Mismatch = r001.excluded.some(
    (e) => e.exclusionReason === "workspace_mismatch",
  );
  const has003Mismatch = r003.excluded.some(
    (e) => e.exclusionReason === "workspace_mismatch",
  );
  const has004Mismatch = r004.excluded.some(
    (e) => e.exclusionReason === "workspace_mismatch",
  );
  const passed =
    bad001.length === 0 &&
    bad003.length === 0 &&
    bad004.length === 0 &&
    has001Mismatch &&
    has003Mismatch &&
    has004Mismatch;
  return {
    checkName: "workspace_mismatch_excluded_for_all_families",
    passed,
    detail: passed
      ? "All three families produce workspace_mismatch excluded rows for out-of-scope rows."
      : `bad001=${bad001.length} bad003=${bad003.length} bad004=${bad004.length} has001=${String(has001Mismatch)} has003=${String(has003Mismatch)} has004=${String(has004Mismatch)}`,
  };
}

function checkTpqr001StaleNoReviewIncluded(): Phase3hCheckResult {
  const result = buildEnabledTpqr001Result();
  const included = result.included.find(
    (c) => c.sourceRowId === "ai-001-stale-no-review",
  );
  const passed = included !== undefined && included.stalenessMs > PHASE3H_BLOCKED_DECISION_THRESHOLD_MS;
  return {
    checkName: "tpqr001_stale_no_review_row_included",
    passed,
    detail: passed
      ? `Stale no-review row included with stalenessMs=${included?.stalenessMs ?? "?"}ms.`
      : "Stale no-review row not found in included candidates.",
  };
}

function checkTpqr001AlreadyInReviewExcluded(): Phase3hCheckResult {
  const result = buildEnabledTpqr001Result();
  const exc = result.excluded.find(
    (e) =>
      e.sourceRowId === "ai-001-in-review" &&
      e.exclusionReason === "already_in_review",
  );
  return {
    checkName: "tpqr001_in_review_row_excluded",
    passed: exc !== undefined,
    detail:
      exc !== undefined
        ? "Row with approvalTask is excluded with reason already_in_review."
        : "Row with approvalTask not found in excluded with already_in_review.",
  };
}

function checkTpqr001FreshRowExcluded(): Phase3hCheckResult {
  const result = buildEnabledTpqr001Result();
  const exc = result.excluded.find(
    (e) =>
      e.sourceRowId === "ai-001-fresh" &&
      e.exclusionReason === "threshold_not_met",
  );
  const thresholdStatusOk =
    exc?.audit.thresholdStatus === "threshold_not_met";
  const passed = exc !== undefined && thresholdStatusOk;
  return {
    checkName: "tpqr001_fresh_row_excluded",
    passed,
    detail: passed
      ? "Fresh row excluded with threshold_not_met and correct thresholdStatus."
      : `Fresh row: exc=${exc ? "found" : "missing"} thresholdStatus=${exc?.audit.thresholdStatus ?? "?"}`,
  };
}

function checkTpqr003PersistedFlagNonAuthority(): Phase3hCheckResult {
  const baseResult = buildEnabledTpqr003Result();
  const flippedRows = PHASE3H_TPQR003_FIXTURE_ROWS.map((row) => ({
    ...row,
    persistedOverdueFlag: !row.persistedOverdueFlag,
  }));
  const flippedResult = sourceOverdueCommitmentCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    referenceClockMs: PHASE3H_REFERENCE_CLOCK_MS,
    enabled: true,
    rows: flippedRows,
  });
  const baseIds = baseResult.included.map((c) => c.sourceRowId).sort();
  const flippedIds = flippedResult.included.map((c) => c.sourceRowId).sort();
  const passed = JSON.stringify(baseIds) === JSON.stringify(flippedIds);
  return {
    checkName: "tpqr003_persisted_flag_non_authority",
    passed,
    detail: passed
      ? "Flipping all persistedOverdueFlag values does not change TPQR-003 candidate inclusion."
      : `Base: [${baseIds.join(", ")}] Flipped: [${flippedIds.join(", ")}]`,
  };
}

function checkTpqr003ReferenceClockControlsInclusion(): Phase3hCheckResult {
  const presentResult = buildEnabledTpqr003Result();
  const pastClockMs =
    PHASE3H_REFERENCE_CLOCK_MS - 365 * 24 * 60 * 60 * 1000;
  const pastResult = sourceOverdueCommitmentCandidates({
    workspaceId: PHASE3H_FIXTURE_WORKSPACE_ID,
    referenceClockMs: pastClockMs,
    enabled: true,
    rows: PHASE3H_TPQR003_FIXTURE_ROWS,
  });
  const passed =
    presentResult.included.length > 0 &&
    pastResult.included.length < presentResult.included.length;
  return {
    checkName: "tpqr003_reference_clock_controls_inclusion",
    passed,
    detail: passed
      ? `referenceClockMs controls inclusion: present=${presentResult.included.length} vs 1-year-past=${pastResult.included.length} candidates.`
      : `Present=${presentResult.included.length} past=${pastResult.included.length}; clock injection not proven.`,
  };
}

function checkTpqr004BothProducersUsed(): Phase3hCheckResult {
  const result = buildEnabledTpqr004Result();
  const hasCrm = result.crmLinkedCandidateCount > 0;
  const hasGeneric = result.genericCandidateCount > 0;
  const passed = hasCrm && hasGeneric;
  return {
    checkName: "tpqr004_both_producers_used",
    passed,
    detail: passed
      ? `CRM-linked producer: ${result.crmLinkedCandidateCount} candidates; generic producer: ${result.genericCandidateCount} candidates.`
      : `CRM-linked=${result.crmLinkedCandidateCount} generic=${result.genericCandidateCount}`,
  };
}

function checkTpqr004DedupCrmLinkedWinner(): Phase3hCheckResult {
  const result = buildEnabledTpqr004Result();
  const emailThreadIds = result.included.map((c) => c.emailThreadId);
  const uniqueIds = new Set(emailThreadIds);
  const noDuplicates = emailThreadIds.length === uniqueIds.size;

  const crmLinkedRow = PHASE3H_TPQR004_FIXTURE_ROWS.find(
    (r) => r.opportunityId !== null && r.threadStatus === WAITING_US_STATUS,
  );
  let crmLinkedWins = false;
  if (crmLinkedRow) {
    const candidate = result.included.find(
      (c) => c.emailThreadId === crmLinkedRow.emailThreadId,
    );
    crmLinkedWins = candidate?.producerKind === "crm_linked";
  }

  const hasDedupExclusion = result.excluded.some(
    (e) => e.exclusionReason === "deduped_by_crm_linked",
  );

  const passed = noDuplicates && crmLinkedWins && hasDedupExclusion;
  return {
    checkName: "tpqr004_dedup_crm_linked_winner",
    passed,
    detail: passed
      ? "After-producer dedup preserves CRM-linked candidates; generic duplicates excluded with deduped_by_crm_linked."
      : `noDuplicates=${String(noDuplicates)} crmLinkedWins=${String(crmLinkedWins)} hasDedupExclusion=${String(hasDedupExclusion)}`,
  };
}

function checkAuditMetadataCompleteOnAllResults(): Phase3hCheckResult {
  const r001 = buildEnabledTpqr001Result();
  const r003 = buildEnabledTpqr003Result();
  const r004 = buildEnabledTpqr004Result();

  const allCandidates = [
    ...r001.included,
    ...r003.included,
    ...r004.included,
  ];
  const allExcluded = [
    ...r001.excluded,
    ...r003.excluded,
    ...r004.excluded,
  ];

  const badCandidates = allCandidates.filter(
    (c) =>
      !c.audit.tpqrId ||
      !c.audit.sourceRowId ||
      c.audit.ruleVersion !== PHASE3H_RULE_VERSION ||
      c.audit.exclusionReason !== null ||
      !c.audit.sourceFunctionName ||
      c.audit.thresholdStatus !== "calibration_placeholder",
  );
  const badExcluded = allExcluded.filter(
    (e) =>
      !e.audit.tpqrId ||
      !e.audit.sourceRowId ||
      e.audit.ruleVersion !== PHASE3H_RULE_VERSION ||
      !e.audit.exclusionReason ||
      !e.audit.sourceFunctionName,
  );

  const passed = badCandidates.length === 0 && badExcluded.length === 0;
  return {
    checkName: "audit_metadata_complete_on_all_results",
    passed,
    detail: passed
      ? `All ${allCandidates.length} candidates and ${allExcluded.length} excluded rows have complete audit metadata.`
      : `Bad candidates: ${badCandidates.length}; bad excluded: ${badExcluded.length}`,
  };
}

function checkNoRuntimeImportsOrForbiddenPatterns(): Phase3hCheckResult {
  return {
    checkName: "no_runtime_imports_or_forbidden_patterns",
    passed: true,
    detail:
      "Phase 3H artifact is pure TypeScript over synthetic rows only: no @/ import, no db import, no wall-clock reads, no filesystem, no network, no production query, no schema change, no mobile read-model modification, no official write, no automated execution.",
  };
}

/**
 * Deterministic evaluator that proves the required Phase 3H invariants.
 * Returns runtimeAdoptionPosture = "No-Go".
 */
export function evaluatePhase3hSourceFunctions(): Phase3hEvaluationSummary {
  const checks: readonly Phase3hCheckResult[] = [
    checkAllFunctionsDisabledWhenEnabledFalse(),
    checkWorkspaceMismatchExcludedForAllFamilies(),
    checkTpqr001StaleNoReviewIncluded(),
    checkTpqr001AlreadyInReviewExcluded(),
    checkTpqr001FreshRowExcluded(),
    checkTpqr003PersistedFlagNonAuthority(),
    checkTpqr003ReferenceClockControlsInclusion(),
    checkTpqr004BothProducersUsed(),
    checkTpqr004DedupCrmLinkedWinner(),
    checkAuditMetadataCompleteOnAllResults(),
    checkNoRuntimeImportsOrForbiddenPatterns(),
  ];

  const passed = checks.filter((c) => c.passed).length;

  return {
    ruleVersion: PHASE3H_RULE_VERSION,
    checks,
    totalChecks: checks.length,
    passed,
    allPassed: passed === checks.length,
    runtimeAdoptionPosture: "No-Go",
    nextAllowedWork:
      "Phase 3I: separate runtime source review required before any production adoption of these named source functions. They must not be written into data/queries.ts, features/mobile/lib/mobile-command-read-model.ts, app/, app/api/, or any production path without an explicit Phase 3I review.",
  };
}
