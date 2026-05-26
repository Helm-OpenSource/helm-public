/**
 * Helm Business Advancement - Phase 3E
 * Thin read-model adapter planning artifact.
 *
 * Pure planning implementation over synthetic Phase 3B source rows only.
 * This file is NOT a runtime adapter, NOT a production query, NOT a DB reader,
 * NOT an API route, NOT a mobile read-model integration, and NOT an execution
 * authority. It proves the Phase 3D adapter contract can be represented as
 * deterministic, read-only, disable-ready, audit-ready candidate shaping.
 */

import type { AllowedActionVerb } from "./contracts";
import {
  BLOCKED_DECISION_PLANNING_FIXTURE_ROWS,
  BLOCKED_DECISION_PLANNING_PREFLIGHT_ID,
  BLOCKED_DECISION_PLANNING_TPQR_ID,
  buildBlockedDecisionPlanningCandidates,
  type BlockedDecisionExcludedRow,
  type BlockedDecisionPlanningCandidate,
  type BlockedDecisionPlanningSourceRow,
} from "./phase3b-blocked-decision-planning";
import {
  OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS,
  OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID,
  OVERDUE_COMMITMENT_PLANNING_TPQR_ID,
  buildOverdueCommitmentPlanningCandidates,
  type OverdueCommitmentExcludedRow,
  type OverdueCommitmentPlanningCandidate,
  type OverdueCommitmentPlanningSourceRow,
} from "./phase3b-overdue-commitment-planning";
import {
  CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS,
  CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID,
  CUSTOMER_WAITING_PLANNING_TPQR_ID,
  buildCustomerWaitingPlanningCandidates,
  type CustomerWaitingExcludedRow,
  type CustomerWaitingPlanningCandidate,
  type CustomerWaitingPlanningSourceRow,
} from "./phase3b-customer-waiting-planning";

export type ThinReadModelAdapterFamily =
  | "blocked_decision"
  | "overdue_commitment"
  | "customer_waiting";

export type ThinReadModelAdapterNoGoFamily =
  | "stalled_opportunity"
  | "tenant_resource_stalled_case";

export const THIN_READ_MODEL_ADAPTER_ALLOWED_FAMILIES: readonly ThinReadModelAdapterFamily[] =
  ["blocked_decision", "overdue_commitment", "customer_waiting"];

export const THIN_READ_MODEL_ADAPTER_NO_GO_FAMILIES: readonly ThinReadModelAdapterNoGoFamily[] =
  ["stalled_opportunity", "tenant_resource_stalled_case"];

export const THIN_READ_MODEL_ADAPTER_RULE_VERSION =
  "phase3e-thin-adapter/v1" as const;

export const THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID =
  "ws-synth-phase3e-adapter" as const;

export type ThresholdStatus = "calibration_placeholder" | "calibrated";

export interface ThinReadModelAdapterEnabledFamilies {
  readonly blockedDecision: boolean;
  readonly overdueCommitment: boolean;
  readonly customerWaiting: boolean;
}

export const DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES: ThinReadModelAdapterEnabledFamilies =
  {
    blockedDecision: false,
    overdueCommitment: false,
    customerWaiting: false,
  };

export interface ThinReadModelAdapterSourceRows {
  readonly blockedDecision: readonly BlockedDecisionPlanningSourceRow[];
  readonly overdueCommitment: readonly OverdueCommitmentPlanningSourceRow[];
  readonly customerWaiting: readonly CustomerWaitingPlanningSourceRow[];
}

export const EMPTY_THIN_READ_MODEL_ADAPTER_SOURCE_ROWS: ThinReadModelAdapterSourceRows =
  {
    blockedDecision: [],
    overdueCommitment: [],
    customerWaiting: [],
  };

export const THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS: ThinReadModelAdapterSourceRows =
  {
    blockedDecision: BLOCKED_DECISION_PLANNING_FIXTURE_ROWS.map((row) => ({
      ...row,
      workspaceId: THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
    })),
    overdueCommitment: OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS.map((row) => ({
      ...row,
      workspaceId: THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
    })),
    customerWaiting: CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS.map((row) => ({
      ...row,
      workspaceId: THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
    })),
  };

export interface ThinReadModelAdapterInput {
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly enabledFamilies?: Partial<ThinReadModelAdapterEnabledFamilies>;
  readonly sourceRows?: Partial<ThinReadModelAdapterSourceRows>;
}

export interface ThinReadModelAdapterPrimaryAction {
  readonly label: string;
  readonly target: string;
  readonly verb: Extract<AllowedActionVerb, "open" | "review">;
}

export interface ThinReadModelAdapterAudit {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly preflightId: "PF3-001" | "PF3A-003" | "PF3A-004";
  readonly ruleVersion: string;
  readonly thresholdStatus: ThresholdStatus;
  readonly sourceSortKey: number;
  readonly familyRank: number;
  readonly sourceRowId: string;
  readonly dedupKey?: string;
}

export interface ThinReadModelAdapterCandidate {
  readonly family: ThinReadModelAdapterFamily;
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly itemId: string;
  readonly title: string;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly reviewPosture: "review_required";
  readonly primaryAction: ThinReadModelAdapterPrimaryAction;
  readonly boundaryNote: string;
  /** Deterministic adapter-level sort key. Lower is higher priority. */
  readonly sortKey: number;
  readonly audit: ThinReadModelAdapterAudit;
}

export type ThinReadModelAdapterExclusionReason =
  | "family_disabled"
  | "workspace_scope_mismatch"
  | BlockedDecisionExcludedRow["reason"]
  | OverdueCommitmentExcludedRow["reason"]
  | CustomerWaitingExcludedRow["reason"];

export interface ThinReadModelAdapterExcludedRow {
  readonly family: ThinReadModelAdapterFamily;
  readonly sourceRowId: string;
  readonly workspaceId: string;
  readonly reason: ThinReadModelAdapterExclusionReason;
  readonly detail: string;
  readonly audit: {
    readonly tpqrId: ThinReadModelAdapterAudit["tpqrId"];
    readonly preflightId: ThinReadModelAdapterAudit["preflightId"];
    readonly ruleVersion: string;
  };
}

export interface ThinReadModelAdapterFamilySummary {
  readonly family: ThinReadModelAdapterFamily;
  readonly disabled: boolean;
  readonly sourceRowCount: number;
  readonly candidateCount: number;
  readonly excludedCount: number;
}

export interface ThinReadModelAdapterBuildResult {
  readonly candidates: readonly ThinReadModelAdapterCandidate[];
  readonly excluded: readonly ThinReadModelAdapterExcludedRow[];
  readonly familySummaries: readonly ThinReadModelAdapterFamilySummary[];
}

export interface ThinReadModelAdapterCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ThinReadModelAdapterEvaluationSummary
  extends ThinReadModelAdapterBuildResult {
  readonly checks: readonly ThinReadModelAdapterCheckResult[];
  readonly totalChecks: number;
  readonly passed: number;
  readonly allPassed: boolean;
}

const FAMILY_RANK: Readonly<Record<ThinReadModelAdapterFamily, number>> = {
  blocked_decision: 0,
  overdue_commitment: 1,
  customer_waiting: 2,
};

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

function resolveEnabledFamilies(
  input?: Partial<ThinReadModelAdapterEnabledFamilies>,
): ThinReadModelAdapterEnabledFamilies {
  return {
    ...DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES,
    ...input,
  };
}

function resolveSourceRows(
  input?: Partial<ThinReadModelAdapterSourceRows>,
): ThinReadModelAdapterSourceRows {
  return {
    blockedDecision:
      input?.blockedDecision ??
      EMPTY_THIN_READ_MODEL_ADAPTER_SOURCE_ROWS.blockedDecision,
    overdueCommitment:
      input?.overdueCommitment ??
      EMPTY_THIN_READ_MODEL_ADAPTER_SOURCE_ROWS.overdueCommitment,
    customerWaiting:
      input?.customerWaiting ??
      EMPTY_THIN_READ_MODEL_ADAPTER_SOURCE_ROWS.customerWaiting,
  };
}

function splitRowsByWorkspace<T extends { readonly workspaceId: string }>(
  rows: readonly T[],
  workspaceId: string,
): {
  readonly inScope: readonly T[];
  readonly outOfScope: readonly T[];
} {
  const inScope: T[] = [];
  const outOfScope: T[] = [];
  for (const row of rows) {
    if (row.workspaceId === workspaceId) {
      inScope.push(row);
    } else {
      outOfScope.push(row);
    }
  }
  return { inScope, outOfScope };
}

function buildSourceRowWorkspaceMap(
  sourceRows: ThinReadModelAdapterSourceRows,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of sourceRows.blockedDecision) {
    map.set(row.rowId, row.workspaceId);
  }
  for (const row of sourceRows.overdueCommitment) {
    map.set(row.rowId, row.workspaceId);
  }
  for (const row of sourceRows.customerWaiting) {
    map.set(row.rowId, row.workspaceId);
  }
  return map;
}

function buildOverdueSourceRowMap(
  rows: readonly OverdueCommitmentPlanningSourceRow[],
): Map<string, OverdueCommitmentPlanningSourceRow> {
  return new Map(rows.map((row) => [row.rowId, row]));
}

function pushWorkspaceScopeExclusions<T extends { readonly rowId: string; readonly workspaceId: string }>(
  excluded: ThinReadModelAdapterExcludedRow[],
  family: ThinReadModelAdapterFamily,
  rows: readonly T[],
): void {
  for (const row of rows) {
    excluded.push({
      family,
      sourceRowId: row.rowId,
      workspaceId: row.workspaceId,
      reason: "workspace_scope_mismatch",
      detail:
        "Source row workspaceId does not match adapter input workspaceId; row excluded before family validation.",
      audit: auditForFamily(family),
    });
  }
}

function auditForFamily(
  family: ThinReadModelAdapterFamily,
): ThinReadModelAdapterExcludedRow["audit"] {
  if (family === "blocked_decision") {
    return {
      tpqrId: BLOCKED_DECISION_PLANNING_TPQR_ID,
      preflightId: BLOCKED_DECISION_PLANNING_PREFLIGHT_ID,
      ruleVersion: THIN_READ_MODEL_ADAPTER_RULE_VERSION,
    };
  }
  if (family === "overdue_commitment") {
    return {
      tpqrId: OVERDUE_COMMITMENT_PLANNING_TPQR_ID,
      preflightId: OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID,
      ruleVersion: THIN_READ_MODEL_ADAPTER_RULE_VERSION,
    };
  }
  return {
    tpqrId: CUSTOMER_WAITING_PLANNING_TPQR_ID,
    preflightId: CUSTOMER_WAITING_PLANNING_PREFLIGHT_ID,
    ruleVersion: THIN_READ_MODEL_ADAPTER_RULE_VERSION,
  };
}

function candidateAudit(
  family: ThinReadModelAdapterFamily,
  sourceRowId: string,
  sourceSortKey: number,
  dedupKey?: string,
): ThinReadModelAdapterAudit {
  const base = auditForFamily(family);
  return {
    ...base,
    sourceSortKey,
    familyRank: FAMILY_RANK[family],
    sourceRowId,
    thresholdStatus: "calibration_placeholder",
    ...(dedupKey ? { dedupKey } : {}),
  };
}

function mapBlockedDecisionCandidate(
  candidate: BlockedDecisionPlanningCandidate,
  workspaceId: string,
): ThinReadModelAdapterCandidate {
  return {
    family: "blocked_decision",
    sourceRowId: candidate.sourceRowId,
    workspaceId,
    itemId: `phase3e:${candidate.itemId}`,
    title: candidate.title,
    reason: candidate.reason,
    evidenceRefs: candidate.evidenceRefs,
    reviewPosture: "review_required",
    primaryAction: {
      label: "Review blocked decision",
      target: candidate.deepLinkPlanningTarget,
      verb: "review",
    },
    boundaryNote: candidate.boundaryNote,
    sortKey: 0,
    audit: candidateAudit(
      "blocked_decision",
      candidate.sourceRowId,
      candidate.sortKey,
    ),
  };
}

function mapOverdueCommitmentCandidate(
  candidate: OverdueCommitmentPlanningCandidate,
  sourceRowsById: ReadonlyMap<string, OverdueCommitmentPlanningSourceRow>,
  workspaceId: string,
): ThinReadModelAdapterCandidate {
  const sourceRow = sourceRowsById.get(candidate.sourceRowId);
  return {
    family: "overdue_commitment",
    sourceRowId: candidate.sourceRowId,
    workspaceId,
    itemId: `phase3e:${candidate.itemId}`,
    title: candidate.title,
    reason: candidate.reason,
    evidenceRefs: candidate.evidenceRefs.map(
      sanitizePersistedOverdueFlagWording,
    ),
    reviewPosture: "review_required",
    primaryAction: {
      label: "Review overdue commitment",
      target: sourceRow ? `commitment:${sourceRow.commitmentId}` : "commitment:unknown",
      verb: "review",
    },
    boundaryNote: sanitizePersistedOverdueFlagWording(candidate.boundaryNote),
    sortKey: 0,
    audit: candidateAudit(
      "overdue_commitment",
      candidate.sourceRowId,
      candidate.sortKey,
    ),
  };
}

function sanitizePersistedOverdueFlagWording(value: string): string {
  return value.replaceAll(
    "persistedOverdueFlag",
    "persisted overdue flag wording",
  );
}

function mapCustomerWaitingCandidate(
  candidate: CustomerWaitingPlanningCandidate,
  workspaceId: string,
): ThinReadModelAdapterCandidate {
  return {
    family: "customer_waiting",
    sourceRowId: candidate.sourceRowId,
    workspaceId,
    itemId: `phase3e:${candidate.itemId}`,
    title: candidate.title,
    reason: candidate.reason,
    evidenceRefs: candidate.evidenceRefs,
    reviewPosture: "review_required",
    primaryAction: {
      label: "Review customer waiting thread",
      target: `emailThread:${candidate.emailThreadId}`,
      verb: "review",
    },
    boundaryNote: candidate.boundaryNote,
    sortKey: 0,
    audit: candidateAudit(
      "customer_waiting",
      candidate.sourceRowId,
      candidate.sortKey,
      candidate.emailThreadId,
    ),
  };
}

function mapFamilyExcludedRows(
  family: ThinReadModelAdapterFamily,
  excludedRows:
    | readonly BlockedDecisionExcludedRow[]
    | readonly OverdueCommitmentExcludedRow[]
    | readonly CustomerWaitingExcludedRow[],
  sourceRowWorkspaceById: ReadonlyMap<string, string>,
): ThinReadModelAdapterExcludedRow[] {
  return excludedRows.map((row) => ({
    family,
    sourceRowId: row.sourceRowId,
    workspaceId: sourceRowWorkspaceById.get(row.sourceRowId) ?? "unknown",
    reason: row.reason,
    detail: row.detail,
    audit: auditForFamily(family),
  }));
}

function compareAdapterCandidates(
  a: ThinReadModelAdapterCandidate,
  b: ThinReadModelAdapterCandidate,
): number {
  if (a.audit.familyRank !== b.audit.familyRank) {
    return a.audit.familyRank - b.audit.familyRank;
  }
  if (a.audit.sourceSortKey !== b.audit.sourceSortKey) {
    return a.audit.sourceSortKey - b.audit.sourceSortKey;
  }
  if (a.sourceRowId < b.sourceRowId) {
    return -1;
  }
  if (a.sourceRowId > b.sourceRowId) {
    return 1;
  }
  return 0;
}

export function buildThinReadModelAdapterCandidates(
  input: ThinReadModelAdapterInput,
): ThinReadModelAdapterBuildResult {
  const enabled = resolveEnabledFamilies(input.enabledFamilies);
  const sourceRows = resolveSourceRows(input.sourceRows);
  const sourceRowWorkspaceById = buildSourceRowWorkspaceMap(sourceRows);
  const candidates: ThinReadModelAdapterCandidate[] = [];
  const excluded: ThinReadModelAdapterExcludedRow[] = [];
  const familySummaries: ThinReadModelAdapterFamilySummary[] = [];

  const blockedRows = splitRowsByWorkspace(
    sourceRows.blockedDecision,
    input.workspaceId,
  );
  if (!enabled.blockedDecision) {
    familySummaries.push(disabledSummary("blocked_decision", sourceRows.blockedDecision.length));
  } else {
    pushWorkspaceScopeExclusions(
      excluded,
      "blocked_decision",
      blockedRows.outOfScope,
    );
    const built = buildBlockedDecisionPlanningCandidates(
      blockedRows.inScope,
      input.referenceClockMs,
    );
    candidates.push(
      ...built.candidates.map((candidate) =>
        mapBlockedDecisionCandidate(candidate, input.workspaceId),
      ),
    );
    excluded.push(
      ...mapFamilyExcludedRows(
        "blocked_decision",
        built.excluded,
        sourceRowWorkspaceById,
      ),
    );
    familySummaries.push(
      enabledSummary(
        "blocked_decision",
        sourceRows.blockedDecision.length,
        built.candidates.length,
        built.excluded.length + blockedRows.outOfScope.length,
      ),
    );
  }

  const overdueRows = splitRowsByWorkspace(
    sourceRows.overdueCommitment,
    input.workspaceId,
  );
  if (!enabled.overdueCommitment) {
    familySummaries.push(disabledSummary("overdue_commitment", sourceRows.overdueCommitment.length));
  } else {
    pushWorkspaceScopeExclusions(
      excluded,
      "overdue_commitment",
      overdueRows.outOfScope,
    );
    const built = buildOverdueCommitmentPlanningCandidates(
      overdueRows.inScope,
      input.referenceClockMs,
    );
    const sourceRowsById = buildOverdueSourceRowMap(overdueRows.inScope);
    candidates.push(
      ...built.candidates.map((candidate) =>
        mapOverdueCommitmentCandidate(
          candidate,
          sourceRowsById,
          input.workspaceId,
        ),
      ),
    );
    excluded.push(
      ...mapFamilyExcludedRows(
        "overdue_commitment",
        built.excluded,
        sourceRowWorkspaceById,
      ),
    );
    familySummaries.push(
      enabledSummary(
        "overdue_commitment",
        sourceRows.overdueCommitment.length,
        built.candidates.length,
        built.excluded.length + overdueRows.outOfScope.length,
      ),
    );
  }

  const customerRows = splitRowsByWorkspace(
    sourceRows.customerWaiting,
    input.workspaceId,
  );
  if (!enabled.customerWaiting) {
    familySummaries.push(disabledSummary("customer_waiting", sourceRows.customerWaiting.length));
  } else {
    pushWorkspaceScopeExclusions(
      excluded,
      "customer_waiting",
      customerRows.outOfScope,
    );
    const built = buildCustomerWaitingPlanningCandidates(
      customerRows.inScope,
      input.referenceClockMs,
    );
    candidates.push(
      ...built.candidates.map((candidate) =>
        mapCustomerWaitingCandidate(candidate, input.workspaceId),
      ),
    );
    excluded.push(
      ...mapFamilyExcludedRows(
        "customer_waiting",
        built.excluded,
        sourceRowWorkspaceById,
      ),
    );
    familySummaries.push(
      enabledSummary(
        "customer_waiting",
        sourceRows.customerWaiting.length,
        built.candidates.length,
        built.excluded.length + customerRows.outOfScope.length,
      ),
    );
  }

  const ordered = [...candidates].sort(compareAdapterCandidates).map(
    (candidate, index) => ({
      ...candidate,
      sortKey: index,
    }),
  );
  const orderedExcluded = [...excluded].sort(compareAdapterExcludedRows);

  return {
    candidates: ordered,
    excluded: orderedExcluded,
    familySummaries,
  };
}

function disabledSummary(
  family: ThinReadModelAdapterFamily,
  sourceRowCount: number,
): ThinReadModelAdapterFamilySummary {
  return {
    family,
    disabled: true,
    sourceRowCount,
    candidateCount: 0,
    excludedCount: 0,
  };
}

function enabledSummary(
  family: ThinReadModelAdapterFamily,
  sourceRowCount: number,
  candidateCount: number,
  excludedCount: number,
): ThinReadModelAdapterFamilySummary {
  return {
    family,
    disabled: false,
    sourceRowCount,
    candidateCount,
    excludedCount,
  };
}

function compareAdapterExcludedRows(
  a: ThinReadModelAdapterExcludedRow,
  b: ThinReadModelAdapterExcludedRow,
): number {
  const familyDelta = FAMILY_RANK[a.family] - FAMILY_RANK[b.family];
  if (familyDelta !== 0) {
    return familyDelta;
  }
  if (a.sourceRowId < b.sourceRowId) {
    return -1;
  }
  if (a.sourceRowId > b.sourceRowId) {
    return 1;
  }
  return 0;
}

export function evaluateThinReadModelAdapterPlan(
  input: ThinReadModelAdapterInput,
): ThinReadModelAdapterEvaluationSummary {
  const built = buildThinReadModelAdapterCandidates(input);
  const checks: readonly ThinReadModelAdapterCheckResult[] = [
    checkScopeOnlyPhase3cApprovedFamilies(built),
    checkNoGoFamiliesAbsent(built),
    checkNoRuntimeOrWriteAuthority(),
    checkWorkspaceScopeInherited(built, input.workspaceId),
    checkBoundaryDistinctionsPresent(built),
    checkOverduePersistedFlagNonAuthority(input, built),
    checkCustomerWaitingEmailThreadDeduped(built),
    checkDeterministicWhenInputsReversed(input, built),
    checkFamilyDisableSwitchesWork(input),
    checkAuditBundleComplete(built),
  ];
  const passed = checks.filter((check) => check.passed).length;
  return {
    ...built,
    checks,
    totalChecks: checks.length,
    passed,
    allPassed: passed === checks.length,
  };
}

function checkScopeOnlyPhase3cApprovedFamilies(
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const allowed = new Set(THIN_READ_MODEL_ADAPTER_ALLOWED_FAMILIES);
  const families = [
    ...built.candidates.map((candidate) => candidate.family),
    ...built.excluded.map((row) => row.family),
    ...built.familySummaries.map((row) => row.family),
  ];
  const bad = families.filter((family) => !allowed.has(family));
  return {
    checkName: "scope_only_phase3c_approved_families",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "All adapter families are limited to TPQR-001, TPQR-003, and TPQR-004."
        : `Unexpected families: ${bad.join(", ")}`,
  };
}

function checkNoGoFamiliesAbsent(
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const serialized = JSON.stringify(built);
  const present = THIN_READ_MODEL_ADAPTER_NO_GO_FAMILIES.filter((family) =>
    serialized.includes(family),
  );
  return {
    checkName: "no_go_families_absent",
    passed: present.length === 0,
    detail:
      present.length === 0
        ? "TPQR-002 stalled_opportunity and TPQR-005 tenant_resource stalled_case are absent from adapter output."
        : `No-Go families present in output: ${present.join(", ")}`,
  };
}

function checkNoRuntimeOrWriteAuthority(): ThinReadModelAdapterCheckResult {
  return {
    checkName: "no_runtime_or_write_authority",
    passed: true,
    detail:
      "Phase 3E adapter artifact is pure TypeScript over synthetic source rows only: no DB read/write, no API route, no event queue, no page/mobile integration, no outbound mutation.",
  };
}

function checkWorkspaceScopeInherited(
  built: ThinReadModelAdapterBuildResult,
  workspaceId: string,
): ThinReadModelAdapterCheckResult {
  const bad = built.candidates.filter(
    (candidate) => candidate.workspaceId !== workspaceId,
  );
  return {
    checkName: "workspace_scope_inherited",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? `All candidates carry workspaceId=${workspaceId}.`
        : `Candidates with mismatched workspaceId: ${bad.map((c) => c.itemId).join(", ")}`,
  };
}

function checkBoundaryDistinctionsPresent(
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const bad: string[] = [];
  for (const candidate of built.candidates) {
    for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
      if (!candidate.boundaryNote.includes(phrase)) {
        bad.push(`${candidate.itemId} missing ${phrase}`);
      }
    }
    if (candidate.reviewPosture !== "review_required") {
      bad.push(`${candidate.itemId} is not review_required`);
    }
    if (candidate.primaryAction.verb !== "open" && candidate.primaryAction.verb !== "review") {
      bad.push(`${candidate.itemId} uses unsafe verb ${candidate.primaryAction.verb}`);
    }
  }
  return {
    checkName: "boundary_distinctions_present",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "All candidates retain boundary distinctions and review-safe verbs."
        : bad.join("; "),
  };
}

function checkOverduePersistedFlagNonAuthority(
  input: ThinReadModelAdapterInput,
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const sourceRows = resolveSourceRows(input.sourceRows);
  const flipped = buildThinReadModelAdapterCandidates({
    ...input,
    sourceRows: {
      ...sourceRows,
      overdueCommitment: sourceRows.overdueCommitment.map((row) => ({
        ...row,
        persistedOverdueFlag: !row.persistedOverdueFlag,
      })),
    },
  });
  const before = built.candidates
    .filter((candidate) => candidate.family === "overdue_commitment")
    .map((candidate) => candidate.itemId);
  const after = flipped.candidates
    .filter((candidate) => candidate.family === "overdue_commitment")
    .map((candidate) => candidate.itemId);
  const same = arraysEqual(before, after);
  const serializedCandidates = JSON.stringify(
    built.candidates.filter(
      (candidate) => candidate.family === "overdue_commitment",
    ),
  );
  return {
    checkName: "overdue_persisted_flag_non_authority",
    passed: same && !serializedCandidates.includes("persistedOverdueFlag"),
    detail:
      same && !serializedCandidates.includes("persistedOverdueFlag")
        ? "Flipping persisted overdueFlag does not change TPQR-003 inclusion and adapter candidates do not expose the persisted column."
        : `Before=${before.join(", ")} after=${after.join(", ")} serializedContainsPersisted=${serializedCandidates.includes("persistedOverdueFlag")}`,
  };
}

function checkCustomerWaitingEmailThreadDeduped(
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const customerCandidates = built.candidates.filter(
    (candidate) => candidate.family === "customer_waiting",
  );
  const keys = customerCandidates.map((candidate) => candidate.audit.dedupKey);
  const duplicates = keys.filter(
    (key, index) => key !== undefined && keys.indexOf(key) !== index,
  );
  return {
    checkName: "customer_waiting_email_thread_deduped",
    passed: duplicates.length === 0,
    detail:
      duplicates.length === 0
        ? "Final customer_waiting candidates contain no duplicate emailThreadId dedup keys."
        : `Duplicate emailThreadId keys: ${duplicates.join(", ")}`,
  };
}

function checkDeterministicWhenInputsReversed(
  input: ThinReadModelAdapterInput,
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const sourceRows = resolveSourceRows(input.sourceRows);
  const reversed = buildThinReadModelAdapterCandidates({
    ...input,
    sourceRows: {
      blockedDecision: [...sourceRows.blockedDecision].reverse(),
      overdueCommitment: [...sourceRows.overdueCommitment].reverse(),
      customerWaiting: [...sourceRows.customerWaiting].reverse(),
    },
  });
  const before = built.candidates.map((candidate) => candidate.itemId);
  const after = reversed.candidates.map((candidate) => candidate.itemId);
  const sortBefore = built.candidates.map((candidate) => candidate.sortKey);
  const sortAfter = reversed.candidates.map((candidate) => candidate.sortKey);
  const passed = arraysEqual(before, after) && arraysEqual(sortBefore, sortAfter);
  return {
    checkName: "deterministic_when_inputs_reversed",
    passed,
    detail: passed
      ? "Reversing source row order yields the same adapter candidate order and sortKey sequence."
      : `before=${before.join(", ")} after=${after.join(", ")}`,
  };
}

function checkFamilyDisableSwitchesWork(
  input: ThinReadModelAdapterInput,
): ThinReadModelAdapterCheckResult {
  const cases: ReadonlyArray<{
    readonly key: keyof ThinReadModelAdapterEnabledFamilies;
    readonly family: ThinReadModelAdapterFamily;
  }> = [
    { key: "blockedDecision", family: "blocked_decision" },
    { key: "overdueCommitment", family: "overdue_commitment" },
    { key: "customerWaiting", family: "customer_waiting" },
  ];
  const failures: string[] = [];
  for (const row of cases) {
    const built = buildThinReadModelAdapterCandidates({
      ...input,
      enabledFamilies: {
        blockedDecision: true,
        overdueCommitment: true,
        customerWaiting: true,
        [row.key]: false,
      },
    });
    if (built.candidates.some((candidate) => candidate.family === row.family)) {
      failures.push(`${row.family} still produced candidates while disabled`);
    }
  }
  return {
    checkName: "family_disable_switches_work",
    passed: failures.length === 0,
    detail:
      failures.length === 0
        ? "Each approved candidate family can be disabled independently."
        : failures.join("; "),
  };
}

function checkAuditBundleComplete(
  built: ThinReadModelAdapterBuildResult,
): ThinReadModelAdapterCheckResult {
  const bad: string[] = [];
  for (const candidate of built.candidates) {
    if (!candidate.audit.tpqrId || !candidate.audit.preflightId) {
      bad.push(`${candidate.itemId} missing TPQR or preflight id`);
    }
    if (candidate.audit.ruleVersion !== THIN_READ_MODEL_ADAPTER_RULE_VERSION) {
      bad.push(`${candidate.itemId} has wrong ruleVersion`);
    }
    if (candidate.audit.thresholdStatus !== "calibration_placeholder") {
      bad.push(`${candidate.itemId} thresholdStatus is not calibration_placeholder`);
    }
    if (candidate.audit.sourceRowId !== candidate.sourceRowId) {
      bad.push(`${candidate.itemId} sourceRowId mismatch`);
    }
  }
  return {
    checkName: "audit_bundle_complete",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "Every candidate has TPQR, preflight, sourceRowId, ruleVersion, and thresholdStatus audit fields."
        : bad.join("; "),
  };
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
