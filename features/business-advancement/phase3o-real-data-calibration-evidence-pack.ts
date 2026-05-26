/**
 * Helm Business Advancement - Phase 3O
 * Real-data calibration evidence pack contract.
 *
 * This file is a pure, feature-only evaluator for redacted snapshot rows. It is
 * NOT a runtime adapter, NOT a DB reader, NOT a production query, NOT an API
 * route, NOT a mobile read-model integration, NOT a schema change, NOT an
 * official write path, and NOT an automated execution authority.
 *
 * Runtime adoption posture remains No-Go. Even a passing redacted live snapshot
 * only unlocks a production runtime adoption review, not production adoption.
 */

import {
  sourceBlockedDecisionCandidates,
  sourceCustomerWaitingCandidates,
  sourceOverdueCommitmentCandidates,
  type Tpqr001SourceFunctionResult,
  type Tpqr001SourceRow,
  type Tpqr003SourceFunctionResult,
  type Tpqr003SourceRow,
  type Tpqr004SourceFunctionResult,
  type Tpqr004SourceRow,
} from "./phase3h-source-function-planning";
import { tpqr001FamilyResult } from "./phase3k-threshold-calibration-fixtures";

export const PHASE3O_RULE_VERSION =
  "phase3o-real-data-calibration-evidence-pack/v1" as const;

export const PHASE3O_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3O_REAL_DATA_CALIBRATION_POSTURE =
  "Evidence-Contract-Ready" as const;

export const PHASE3O_MIN_ROWS_PER_FAMILY = 4 as const;

export const PHASE3O_TPQR001_THRESHOLD_MS =
  tpqr001FamilyResult.conservativeFixtureDefaultMs;

export const PHASE3O_NEXT_ALLOWED_WORK =
  "Provide a redacted live DB snapshot that satisfies this evidence contract, then run production runtime adoption review. Not production adoption." as const;

export type Phase3oSampleKind =
  | "synthetic_fixture"
  | "local_development_snapshot"
  | "redacted_live_db_snapshot";

export type Phase3oTpqrId = "TPQR-001" | "TPQR-003" | "TPQR-004";

export type Phase3oTpqr001RedactedRow = Tpqr001SourceRow;
export type Phase3oTpqr003RedactedRow = Tpqr003SourceRow;
export type Phase3oTpqr004RedactedRow = Tpqr004SourceRow;

export interface Phase3oEvidencePackInput {
  readonly sampleKind: Phase3oSampleKind;
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly rows: {
    readonly tpqr001: readonly Phase3oTpqr001RedactedRow[];
    readonly tpqr003: readonly Phase3oTpqr003RedactedRow[];
    readonly tpqr004: readonly Phase3oTpqr004RedactedRow[];
  };
}

export interface Phase3oCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface Phase3oFamilySummary {
  readonly tpqrId: Phase3oTpqrId;
  readonly rowCount: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly checks: readonly Phase3oCheck[];
  readonly checksPass: boolean;
  readonly calibrated: boolean;
  readonly blockers: readonly string[];
}

export interface Phase3oEvaluationResult {
  readonly ruleVersion: typeof PHASE3O_RULE_VERSION;
  readonly runtimeAdoptionPosture: typeof PHASE3O_RUNTIME_ADOPTION_POSTURE;
  readonly realDataCalibrationPosture: typeof PHASE3O_REAL_DATA_CALIBRATION_POSTURE;
  readonly sampleKind: Phase3oSampleKind;
  readonly realDataValidated: boolean;
  readonly productionCalibrationComplete: boolean;
  readonly nextAllowedWork: typeof PHASE3O_NEXT_ALLOWED_WORK;
  readonly redactionContract: readonly string[];
  readonly tpqr001: Phase3oFamilySummary;
  readonly tpqr003: Phase3oFamilySummary;
  readonly tpqr004: Phase3oFamilySummary;
  readonly blockers: readonly string[];
}

export const PHASE3O_REDACTION_CONTRACT = [
  "Rows must be redacted before entering this evaluator.",
  "No customer names, email bodies, titles, raw email addresses, free text, secrets, or tokens are allowed.",
  "Identifiers must be hashed or opaque redacted IDs.",
  "The evaluator accepts only deterministic row fields needed by TPQR-001/003/004 source functions.",
] as const;

function buildFamilySummary(input: {
  tpqrId: Phase3oTpqrId;
  sampleKind: Phase3oSampleKind;
  rowCount: number;
  includedCount: number;
  excludedCount: number;
  checks: readonly Phase3oCheck[];
}): Phase3oFamilySummary {
  const checksPass = input.checks.every((check) => check.pass);
  const calibrated =
    input.sampleKind === "redacted_live_db_snapshot" && checksPass;
  const blockers = calibrated
    ? []
    : input.checks
        .filter((check) => !check.pass)
        .map((check) => `${input.tpqrId}: ${check.name}`);

  return {
    tpqrId: input.tpqrId,
    rowCount: input.rowCount,
    includedCount: input.includedCount,
    excludedCount: input.excludedCount,
    checks: input.checks,
    checksPass,
    calibrated,
    blockers,
  };
}

function hasCheckableVolume(
  rowCount: number,
  includedCount: number,
  excludedCount: number,
): boolean {
  return (
    rowCount >= PHASE3O_MIN_ROWS_PER_FAMILY &&
    includedCount >= 1 &&
    excludedCount >= 1
  );
}

function hasTpqr001Excluded(
  result: Tpqr001SourceFunctionResult,
  reason: string,
): boolean {
  return result.excluded.some((row) => row.exclusionReason === reason);
}

function hasTpqr003Excluded(
  result: Tpqr003SourceFunctionResult,
  reason: string,
): boolean {
  return result.excluded.some((row) => row.exclusionReason === reason);
}

function hasTpqr004Excluded(
  result: Tpqr004SourceFunctionResult,
  reason: string,
): boolean {
  return result.excluded.some((row) => row.exclusionReason === reason);
}

function evaluateTpqr001(
  input: Phase3oEvidencePackInput,
): Phase3oFamilySummary {
  const rows = input.rows.tpqr001;
  const result = sourceBlockedDecisionCandidates({
    workspaceId: input.workspaceId,
    referenceClockMs: input.referenceClockMs,
    thresholdMs: PHASE3O_TPQR001_THRESHOLD_MS,
    enabled: true,
    rows,
  });

  const checks: Phase3oCheck[] = [
    {
      name: "minimum_redacted_row_volume",
      pass: hasCheckableVolume(
        rows.length,
        result.included.length,
        result.excluded.length,
      ),
      detail: `rows=${rows.length}, included=${result.included.length}, excluded=${result.excluded.length}, requiredRows=${PHASE3O_MIN_ROWS_PER_FAMILY}`,
    },
    {
      name: "uses_conservative_72h_threshold",
      pass: PHASE3O_TPQR001_THRESHOLD_MS === 259200000,
      detail: `thresholdMs=${PHASE3O_TPQR001_THRESHOLD_MS}`,
    },
    {
      name: "stale_no_review_row_included",
      pass: result.included.some(
        (row) => row.stalenessMs >= PHASE3O_TPQR001_THRESHOLD_MS,
      ),
      detail: `included=${result.included.length}`,
    },
    {
      name: "fresh_row_excluded",
      pass: hasTpqr001Excluded(result, "threshold_not_met"),
      detail: `threshold_not_met=${result.excluded.filter((row) => row.exclusionReason === "threshold_not_met").length}`,
    },
    {
      name: "already_in_review_excluded",
      pass: hasTpqr001Excluded(result, "already_in_review"),
      detail: `already_in_review=${result.excluded.filter((row) => row.exclusionReason === "already_in_review").length}`,
    },
    {
      name: "workspace_mismatch_excluded",
      pass: hasTpqr001Excluded(result, "workspace_mismatch"),
      detail: `workspace_mismatch=${result.excluded.filter((row) => row.exclusionReason === "workspace_mismatch").length}`,
    },
  ];

  return buildFamilySummary({
    tpqrId: "TPQR-001",
    sampleKind: input.sampleKind,
    rowCount: rows.length,
    includedCount: result.included.length,
    excludedCount: result.excluded.length,
    checks,
  });
}

function evaluateTpqr003(
  input: Phase3oEvidencePackInput,
): Phase3oFamilySummary {
  const rows = input.rows.tpqr003;
  const result = sourceOverdueCommitmentCandidates({
    workspaceId: input.workspaceId,
    referenceClockMs: input.referenceClockMs,
    enabled: true,
    rows,
  });

  const misleadingFalseIncluded = result.included.some((candidate) => {
    const row = rows.find((item) => item.rowId === candidate.sourceRowId);
    return row?.persistedOverdueFlag === false;
  });
  const misleadingTrueExcluded = result.excluded.some((excluded) => {
    const row = rows.find((item) => item.rowId === excluded.sourceRowId);
    return row?.persistedOverdueFlag === true;
  });

  const checks: Phase3oCheck[] = [
    {
      name: "minimum_redacted_row_volume",
      pass: hasCheckableVolume(
        rows.length,
        result.included.length,
        result.excluded.length,
      ),
      detail: `rows=${rows.length}, included=${result.included.length}, excluded=${result.excluded.length}, requiredRows=${PHASE3O_MIN_ROWS_PER_FAMILY}`,
    },
    {
      name: "persisted_false_can_still_be_included",
      pass: misleadingFalseIncluded,
      detail: `includedWithPersistedFalse=${String(misleadingFalseIncluded)}`,
    },
    {
      name: "persisted_true_can_still_be_excluded",
      pass: misleadingTrueExcluded,
      detail: `excludedWithPersistedTrue=${String(misleadingTrueExcluded)}`,
    },
    {
      name: "future_due_date_excluded_by_reference_clock",
      pass: hasTpqr003Excluded(result, "threshold_not_met"),
      detail: `threshold_not_met=${result.excluded.filter((row) => row.exclusionReason === "threshold_not_met").length}`,
    },
    {
      name: "terminal_status_excluded",
      pass: hasTpqr003Excluded(result, "terminal_status"),
      detail: `terminal_status=${result.excluded.filter((row) => row.exclusionReason === "terminal_status").length}`,
    },
    {
      name: "workspace_mismatch_excluded",
      pass: hasTpqr003Excluded(result, "workspace_mismatch"),
      detail: `workspace_mismatch=${result.excluded.filter((row) => row.exclusionReason === "workspace_mismatch").length}`,
    },
  ];

  return buildFamilySummary({
    tpqrId: "TPQR-003",
    sampleKind: input.sampleKind,
    rowCount: rows.length,
    includedCount: result.included.length,
    excludedCount: result.excluded.length,
    checks,
  });
}

function evaluateTpqr004(
  input: Phase3oEvidencePackInput,
): Phase3oFamilySummary {
  const rows = input.rows.tpqr004;
  const result = sourceCustomerWaitingCandidates({
    workspaceId: input.workspaceId,
    enabled: true,
    rows,
  });

  const includedEmailThreadIds = result.included.map(
    (row) => row.emailThreadId,
  );
  const noDuplicateIncludedEmailThreadIds =
    new Set(includedEmailThreadIds).size === includedEmailThreadIds.length;

  const checks: Phase3oCheck[] = [
    {
      name: "minimum_redacted_row_volume",
      pass: hasCheckableVolume(
        rows.length,
        result.included.length,
        result.excluded.length,
      ),
      detail: `rows=${rows.length}, included=${result.included.length}, excluded=${result.excluded.length}, requiredRows=${PHASE3O_MIN_ROWS_PER_FAMILY}`,
    },
    {
      name: "crm_linked_row_included",
      pass: result.included.some((row) => row.producerKind === "crm_linked"),
      detail: `crmLinkedCandidateCount=${result.crmLinkedCandidateCount}`,
    },
    {
      name: "generic_duplicate_excluded_by_crm_linked",
      pass: hasTpqr004Excluded(result, "deduped_by_crm_linked"),
      detail: `deduped_by_crm_linked=${result.excluded.filter((row) => row.exclusionReason === "deduped_by_crm_linked").length}`,
    },
    {
      name: "generic_only_row_included",
      pass: result.included.some((row) => row.producerKind === "generic"),
      detail: `genericCandidateCount=${result.genericCandidateCount}`,
    },
    {
      name: "workspace_mismatch_excluded",
      pass: hasTpqr004Excluded(result, "workspace_mismatch"),
      detail: `workspace_mismatch=${result.excluded.filter((row) => row.exclusionReason === "workspace_mismatch").length}`,
    },
    {
      name: "no_duplicate_included_email_thread_ids",
      pass: noDuplicateIncludedEmailThreadIds,
      detail: `includedEmailThreadIds=${includedEmailThreadIds.length}, unique=${new Set(includedEmailThreadIds).size}`,
    },
  ];

  return buildFamilySummary({
    tpqrId: "TPQR-004",
    sampleKind: input.sampleKind,
    rowCount: rows.length,
    includedCount: result.included.length,
    excludedCount: result.excluded.length,
    checks,
  });
}

export function evaluatePhase3oRealDataCalibrationEvidencePack(
  input: Phase3oEvidencePackInput,
): Phase3oEvaluationResult {
  const tpqr001 = evaluateTpqr001(input);
  const tpqr003 = evaluateTpqr003(input);
  const tpqr004 = evaluateTpqr004(input);
  const familySummaries = [tpqr001, tpqr003, tpqr004];

  const realDataValidated =
    input.sampleKind === "redacted_live_db_snapshot" &&
    familySummaries.every((summary) => summary.calibrated);
  const productionCalibrationComplete = realDataValidated;

  const blockers: string[] = [];
  if (input.sampleKind !== "redacted_live_db_snapshot") {
    blockers.push(
      input.sampleKind === "local_development_snapshot"
        ? "sampleKind is local_development_snapshot — local DB development validation does not satisfy real live DB calibration"
        : "sampleKind is synthetic_fixture — real DB row calibration has not been provided",
    );
  }
  for (const summary of familySummaries) {
    blockers.push(...summary.blockers);
  }
  if (!productionCalibrationComplete) {
    blockers.push(
      "productionCalibrationComplete=false — runtime adoption review remains blocked",
    );
  }

  return {
    ruleVersion: PHASE3O_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3O_RUNTIME_ADOPTION_POSTURE,
    realDataCalibrationPosture: PHASE3O_REAL_DATA_CALIBRATION_POSTURE,
    sampleKind: input.sampleKind,
    realDataValidated,
    productionCalibrationComplete,
    nextAllowedWork: PHASE3O_NEXT_ALLOWED_WORK,
    redactionContract: PHASE3O_REDACTION_CONTRACT,
    tpqr001,
    tpqr003,
    tpqr004,
    blockers,
  };
}

const DEFAULT_WORKSPACE_ID = "ws-phase3o-synthetic";
const DEFAULT_REFERENCE_CLOCK_MS = 1777161600000;
const DAY_MS = 86400000;

export const DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK: Phase3oEvidencePackInput =
  {
    sampleKind: "synthetic_fixture",
    workspaceId: DEFAULT_WORKSPACE_ID,
    referenceClockMs: DEFAULT_REFERENCE_CLOCK_MS,
    rows: {
      tpqr001: [
        {
          rowId: "redacted-ai-stale-no-review",
          workspaceId: DEFAULT_WORKSPACE_ID,
          updatedAtMs: DEFAULT_REFERENCE_CLOCK_MS - 4 * DAY_MS,
          hasApprovalTask: false,
        },
        {
          rowId: "redacted-ai-fresh-no-review",
          workspaceId: DEFAULT_WORKSPACE_ID,
          updatedAtMs: DEFAULT_REFERENCE_CLOCK_MS - 1 * DAY_MS,
          hasApprovalTask: false,
        },
        {
          rowId: "redacted-ai-already-in-review",
          workspaceId: DEFAULT_WORKSPACE_ID,
          updatedAtMs: DEFAULT_REFERENCE_CLOCK_MS - 5 * DAY_MS,
          hasApprovalTask: true,
        },
        {
          rowId: "redacted-ai-wrong-workspace",
          workspaceId: "ws-redacted-other",
          updatedAtMs: DEFAULT_REFERENCE_CLOCK_MS - 4 * DAY_MS,
          hasApprovalTask: false,
        },
      ],
      tpqr003: [
        {
          rowId: "redacted-c-overdue-flag-false",
          workspaceId: DEFAULT_WORKSPACE_ID,
          commitmentId: "redacted-commitment-1",
          dueDateMs: DEFAULT_REFERENCE_CLOCK_MS - 2 * DAY_MS,
          status: "ACTIVE",
          persistedOverdueFlag: false,
        },
        {
          rowId: "redacted-c-future-flag-true",
          workspaceId: DEFAULT_WORKSPACE_ID,
          commitmentId: "redacted-commitment-2",
          dueDateMs: DEFAULT_REFERENCE_CLOCK_MS + 1 * DAY_MS,
          status: "ACTIVE",
          persistedOverdueFlag: true,
        },
        {
          rowId: "redacted-c-terminal-flag-true",
          workspaceId: DEFAULT_WORKSPACE_ID,
          commitmentId: "redacted-commitment-3",
          dueDateMs: DEFAULT_REFERENCE_CLOCK_MS - 3 * DAY_MS,
          status: "FULFILLED",
          persistedOverdueFlag: true,
        },
        {
          rowId: "redacted-c-wrong-workspace",
          workspaceId: "ws-redacted-other",
          commitmentId: "redacted-commitment-4",
          dueDateMs: DEFAULT_REFERENCE_CLOCK_MS - 2 * DAY_MS,
          status: "ACTIVE",
          persistedOverdueFlag: false,
        },
      ],
      tpqr004: [
        {
          rowId: "redacted-et-crm-linked",
          workspaceId: DEFAULT_WORKSPACE_ID,
          emailThreadId: "redacted-thread-shared",
          threadStatus: "WAITING_US",
          opportunityId: "redacted-opportunity-1",
        },
        {
          rowId: "redacted-et-generic-duplicate",
          workspaceId: DEFAULT_WORKSPACE_ID,
          emailThreadId: "redacted-thread-shared",
          threadStatus: "WAITING_US",
          opportunityId: null,
        },
        {
          rowId: "redacted-et-generic-only",
          workspaceId: DEFAULT_WORKSPACE_ID,
          emailThreadId: "redacted-thread-generic-only",
          threadStatus: "WAITING_US",
          opportunityId: null,
        },
        {
          rowId: "redacted-et-wrong-workspace",
          workspaceId: "ws-redacted-other",
          emailThreadId: "redacted-thread-wrong-workspace",
          threadStatus: "WAITING_US",
          opportunityId: null,
        },
      ],
    },
  } as const;

export const DEFAULT_PHASE3O_EVALUATION =
  evaluatePhase3oRealDataCalibrationEvidencePack(
    DEFAULT_PHASE3O_SYNTHETIC_EVIDENCE_PACK,
  );
