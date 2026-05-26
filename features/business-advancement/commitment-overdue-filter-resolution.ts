/**
 * Helm Business Advancement - Phase 3A / PF3A-003
 * Commitment overdue-filter resolution (planning-only artifact).
 *
 * This artifact records, deterministically, the current repository truth about
 * Commitment.overdueFlag, the deriveOverdueFlag helper, the write paths, the
 * read paths (both read-time-derived and persisted-column-read), and the
 * absence of any dueDate-crossing maintenance routine. It then derives the
 * conservative planning-only conclusion for any FUTURE thin read-model filter
 * that wants to express "overdue commitment".
 *
 * Repo truth restated (do not contradict):
 *   - prisma/schema.prisma:3929 declares overdueFlag Boolean @default(false)
 *     without any @updatedAt-style auto-refresh on dueDate crossing.
 *   - lib/memory/shared.ts:254 defines deriveOverdueFlag (read-time helper).
 *   - lib/memory/commitment.service.ts:72 returns overdueFlag via
 *     deriveOverdueFlag(row) inside getCommitments (read-time derivation).
 *   - lib/memory/commitment.service.ts:112 writes overdueFlag during
 *     createCommitment.
 *   - lib/memory/commitment.service.ts:194 writes overdueFlag during
 *     updateCommitmentStatus.
 *   - data/queries.ts:351 reads commitment.overdueFlag from a direct
 *     db.commitment.findMany result (persisted-column read).
 *   - features/meetings/queries.ts:437 selects overdueFlag: true from prisma
 *     (persisted-column read).
 *   - There is no scheduled job, cron, or maintenance routine in the current
 *     repository that refreshes the persisted Commitment.overdueFlag column
 *     when dueDate crosses without an explicit updateCommitmentStatus call.
 *
 * Conservative conclusion (unless repo truth disproves it):
 *   - The persisted Commitment.overdueFlag column alone is NOT safe for any
 *     future time-sensitive overdue filter, because no dueDate-crossing
 *     maintenance is currently proven in repo.
 *   - Future thin read-model planning should prefer read-time
 *     dueDate/status derivation (or the existing deriveOverdueFlag helper)
 *     over the persisted column for time-sensitive filters.
 *
 * This artifact does NOT authorize:
 *   - Prisma schema changes
 *   - runtime extractor / event queue / background job
 *   - API route / data/queries.ts / app page modifications
 *   - dashboard / search / mobile behavior changes
 *   - official write / auto-send / auto-approval / auto-execute
 *   - LLM final ranking
 *   - production query adoption
 */

// ---------------------------------------------------------------------------
// Evidence row types
// ---------------------------------------------------------------------------

export type CommitmentOverdueEvidenceKind =
  | "schema_definition"
  | "derive_helper"
  | "write_path"
  | "read_time_derivation"
  | "persisted_column_read"
  | "maintenance_absence"
  | "filter_planning_note";

export type CommitmentOverdueDerivationKind =
  | "persisted_column"
  | "read_time_derivation"
  | "schema_only"
  | "absent"
  | "planning_only";

export type CommitmentOverdueSafetyAssessment =
  | "safe_for_time_sensitive_filter"
  | "stale_by_design_for_time_sensitive_filter"
  | "neutral_storage_definition"
  | "neutral_helper_definition"
  | "neutral_write_path"
  | "neutral_planning_note";

/**
 * One PF3A-003 evidence row. Each row pins a deterministic, file-level fact
 * about the Commitment.overdueFlag lifecycle in the current repository.
 */
export interface CommitmentOverdueEvidenceRow {
  /** Stable identifier for this evidence row. */
  readonly evidenceId: string;
  /** Repo-relative file path of the evidence (or "(absent)" for negative findings). */
  readonly filePath: string;
  /** file:line or symbol locator pinning the evidence. */
  readonly evidenceLocator: string;
  /** Kind of evidence (schema, helper, write, read-time, persisted-read, absence, planning). */
  readonly evidenceKind: CommitmentOverdueEvidenceKind;
  /** How the row relates to overdue derivation (persisted column, read-time, schema-only, absent, planning). */
  readonly derivationKind: CommitmentOverdueDerivationKind;
  /** Whether the evidence makes a future time-sensitive filter safe / stale-by-design / neutral. */
  readonly safetyAssessment: CommitmentOverdueSafetyAssessment;
  /** Short summary of what this evidence asserts. */
  readonly evidenceSummary: string;
  /** Whether this row counts as positive evidence of dueDate-crossing maintenance for the persisted column. */
  readonly maintenanceProofForPersistedColumn: boolean;
  /** Boundary notes preserving recommendation/explanation/draft/proof distinctions. */
  readonly boundaryNotes: readonly string[];
}

// ---------------------------------------------------------------------------
// Shared boundary notes (row level)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTES: readonly string[] = [
  "recommendation != commitment - any PF3A-003 finding stays advisory until separately approved.",
  "explanation != approval - citing a write or read path does not authorize runtime adoption.",
  "draft != send - drafted filter directions must not be acted upon as official changes.",
  "proof != external write success - verifying internal lifecycle does not authorize outbound writes or sends.",
];

const PLANNING_ONLY_BOUNDARY_NOTES: readonly string[] = [
  "Phase 3A scope: planning-only - this row does not approve runtime adoption.",
  "Any maintenance path that would refresh persisted overdueFlag is a separate schema / maintenance review and is out of Phase 3A scope.",
];

// ---------------------------------------------------------------------------
// PF3A-003 evidence matrix (deterministic, append-only at row level)
// ---------------------------------------------------------------------------

export const COMMITMENT_OVERDUE_FILTER_EVIDENCE: readonly CommitmentOverdueEvidenceRow[] =
  [
    // -----------------------------------------------------------------------
    // PF3A003-EV-001 | schema definition
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-001",
      filePath: "prisma/schema.prisma",
      evidenceLocator: "prisma/schema.prisma:3929",
      evidenceKind: "schema_definition",
      derivationKind: "schema_only",
      safetyAssessment: "neutral_storage_definition",
      evidenceSummary:
        "Commitment.overdueFlag is declared as Boolean @default(false) on model Commitment with no @updatedAt-style auto-refresh on dueDate crossing - storage exists but storage alone does not maintain time-sensitive correctness.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Schema definition is not the same as a maintained value - the column does not auto-update when dueDate crosses NOW().",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-002 | deriveOverdueFlag helper definition
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-002",
      filePath: "lib/memory/shared.ts",
      evidenceLocator: "lib/memory/shared.ts:254",
      evidenceKind: "derive_helper",
      derivationKind: "read_time_derivation",
      safetyAssessment: "neutral_helper_definition",
      evidenceSummary:
        "deriveOverdueFlag(input) is defined as deriveCommitmentStatus(input) === CommitmentStatus.OVERDUE, where deriveCommitmentStatus returns OVERDUE when dueDate < Date.now() and status is not FULFILLED / CANCELED - this is the existing read-time derivation used by getCommitments.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "deriveOverdueFlag is the canonical read-time derivation; it is the safe planning direction for future time-sensitive filters when combined with the dueDate/status heuristic.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-003 | createCommitment write path
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-003",
      filePath: "lib/memory/commitment.service.ts",
      evidenceLocator: "lib/memory/commitment.service.ts:112",
      evidenceKind: "write_path",
      derivationKind: "persisted_column",
      safetyAssessment: "neutral_write_path",
      evidenceSummary:
        "createCommitment writes overdueFlag: deriveOverdueFlag({ dueDate: input.dueDate, status: nextStatus }) into db.commitment.create - the persisted value is correct only at creation time and is not refreshed when dueDate crosses NOW() afterward.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Write at creation time does not constitute dueDate-crossing maintenance - it only seeds the column.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-004 | updateCommitmentStatus write path
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-004",
      filePath: "lib/memory/commitment.service.ts",
      evidenceLocator: "lib/memory/commitment.service.ts:194",
      evidenceKind: "write_path",
      derivationKind: "persisted_column",
      safetyAssessment: "neutral_write_path",
      evidenceSummary:
        "updateCommitmentStatus sets overdueFlag: input.status === CommitmentStatus.OVERDUE during db.commitment.update - the persisted value is refreshed only when an explicit human or system status update fires; passive dueDate crossing does not trigger this path.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Status-update write is not dueDate-crossing maintenance - it requires an explicit status transition.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-005 | getCommitments read-time derivation
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-005",
      filePath: "lib/memory/commitment.service.ts",
      evidenceLocator: "lib/memory/commitment.service.ts:72",
      evidenceKind: "read_time_derivation",
      derivationKind: "read_time_derivation",
      safetyAssessment: "safe_for_time_sensitive_filter",
      evidenceSummary:
        "getCommitments maps each row through { ...row, status: deriveCommitmentStatus(row), overdueFlag: deriveOverdueFlag(row) } - this read site is read-time derived and is correct relative to NOW() at the moment of the read.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Read-time derivation is the safe planning direction - any future thin filter that consumes getCommitments output sees a freshly derived overdueFlag.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-006 | persisted-column read in data/queries.ts (opportunity detail)
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-006",
      filePath: "data/queries.ts",
      evidenceLocator: "data/queries.ts:351",
      evidenceKind: "persisted_column_read",
      derivationKind: "persisted_column",
      safetyAssessment: "stale_by_design_for_time_sensitive_filter",
      evidenceSummary:
        "An opportunity-ranking pressure check reads commitment.overdueFlag from a db.commitment.findMany result (data/queries.ts:88, 246) without going through getCommitments / deriveOverdueFlag - this read is bound to the persisted column and is therefore stale-by-design relative to a passive dueDate crossing.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "PF3A-003 does not modify data/queries.ts - this row is recorded as evidence only.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-007 | persisted-column read in features/meetings/queries.ts
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-007",
      filePath: "features/meetings/queries.ts",
      evidenceLocator: "features/meetings/queries.ts:437",
      evidenceKind: "persisted_column_read",
      derivationKind: "persisted_column",
      safetyAssessment: "stale_by_design_for_time_sensitive_filter",
      evidenceSummary:
        "A meetings-list aggregation selects commitments { id: true, overdueFlag: true } directly from prisma without going through getCommitments / deriveOverdueFlag - this read is bound to the persisted column and is therefore stale-by-design relative to a passive dueDate crossing.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "PF3A-003 does not modify features/meetings/queries.ts - this row is recorded as evidence only.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-008 | absence of dueDate-crossing maintenance routine
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-008",
      filePath: "(absent)",
      evidenceLocator: "(absent: no scheduled job / cron / maintenance routine touches Commitment.overdueFlag based on dueDate crossing)",
      evidenceKind: "maintenance_absence",
      derivationKind: "absent",
      safetyAssessment: "stale_by_design_for_time_sensitive_filter",
      evidenceSummary:
        "Repo-wide search for db.commitment.update / updateMany / upsert and for cron / scheduled / maintenance jobs returns no path that refreshes Commitment.overdueFlag based on a dueDate crossing - the only writers are createCommitment (creation time) and updateCommitmentStatus (explicit status transition). app/api/runtime/dingtalk/hourly-sync/route.ts does not touch commitments. This negative finding is what makes the persisted column stale-by-design relative to time.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "If a dueDate-crossing maintenance routine is later proposed, it is a separate schema / maintenance review and must not be smuggled into Phase 3A scope.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A003-EV-009 | filter planning note for future thin read model
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A003-EV-009",
      filePath: "(planning)",
      evidenceLocator: "(planning-only direction for any future thin read-model overdue filter)",
      evidenceKind: "filter_planning_note",
      derivationKind: "planning_only",
      safetyAssessment: "neutral_planning_note",
      evidenceSummary:
        "Future thin read-model overdue filters MUST NOT use the persisted Commitment.overdueFlag column as the only time-sensitive filter. The accepted planning-only direction is the dueDate/status heuristic (dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')) or the existing deriveOverdueFlag read-time derivation. This note does not authorize any runtime adoption.",
      maintenanceProofForPersistedColumn: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Planning note - not a runtime change, not a schema change, not a query adoption.",
      ],
    },
  ] as const;

// ---------------------------------------------------------------------------
// Deterministic conclusion
// ---------------------------------------------------------------------------

export type CommitmentOverdueFilterConclusion =
  | "prefer_read_time_derivation"
  | "persisted_column_safe_with_maintenance_proof"
  | "blocked_no_safe_derivation_evidence"
  | "blocked_no_maintenance_evidence"
  | "incomplete_evidence";

export interface CommitmentOverdueFilterDecision {
  readonly conclusion: CommitmentOverdueFilterConclusion;
  readonly reason: string;
  readonly recommendedFutureFilter: string;
  readonly residualBlockers: readonly string[];
}

/**
 * Deterministic conclusion logic.
 *
 *  - If no rows are present, the evidence is incomplete.
 *  - If at least one row constitutes positive maintenanceProofForPersistedColumn,
 *    the persisted column COULD be safe (still planning-only). This branch is
 *    not reachable in the current repo and is included only so the artifact
 *    can express the boundary cleanly.
 *  - If a maintenance_absence row exists and a safe read-time direction is
 *    evidenced, the conclusion is prefer_read_time_derivation.
 *  - If a maintenance_absence row exists without a safe read-time direction,
 *    the conclusion is blocked_no_safe_derivation_evidence.
 *  - Otherwise, the conclusion is blocked_no_maintenance_evidence.
 */
export function deriveCommitmentOverdueFilterDecision(
  rows: readonly CommitmentOverdueEvidenceRow[],
): CommitmentOverdueFilterDecision {
  if (rows.length === 0) {
    return {
      conclusion: "incomplete_evidence",
      reason: "No PF3A-003 evidence rows present; cannot evaluate the overdue-filter question.",
      recommendedFutureFilter:
        "(none - resolve evidence collection first; do not plan a runtime filter without evidence)",
      residualBlockers: ["No evidence rows recorded yet."],
    };
  }

  const persistedReads = rows.filter(
    (row) =>
      row.evidenceKind === "persisted_column_read" &&
      row.derivationKind === "persisted_column",
  );
  const readTimeDerivations = rows.filter(
    (row) =>
      row.evidenceKind === "read_time_derivation" &&
      row.derivationKind === "read_time_derivation",
  );
  const maintenanceAbsenceRows = rows.filter(
    (row) =>
      row.evidenceKind === "maintenance_absence" &&
      row.derivationKind === "absent",
  );
  const maintenanceProofRows = rows.filter(
    (row) => row.maintenanceProofForPersistedColumn === true,
  );
  const safeDirectionRows = rows.filter((row) => {
    if (
      row.evidenceKind === "read_time_derivation" &&
      row.derivationKind === "read_time_derivation"
    ) {
      return true;
    }
    if (row.evidenceKind !== "filter_planning_note") {
      return false;
    }
    const summary = row.evidenceSummary.toLowerCase();
    return summary.includes("duedate/status") || summary.includes("deriveoverdueflag");
  });

  const blockers: string[] = [];

  if (persistedReads.length > 0) {
    blockers.push(
      `Persisted-column reads exist (${persistedReads.map((r) => r.evidenceId).join(", ")}); they are stale-by-design relative to passive dueDate crossing without a maintenance proof.`,
    );
  }
  if (maintenanceAbsenceRows.length > 0) {
    blockers.push(
      `Maintenance absence recorded (${maintenanceAbsenceRows.map((r) => r.evidenceId).join(", ")}); persisted overdueFlag is not refreshed on dueDate crossing.`,
    );
  }
  if (readTimeDerivations.length === 0) {
    blockers.push(
      "No read-time derivation evidence recorded; the safe planning direction cannot be anchored.",
    );
  }

  if (maintenanceProofRows.length > 0) {
    return {
      conclusion: "persisted_column_safe_with_maintenance_proof",
      reason:
        "At least one row constitutes positive proof of dueDate-crossing maintenance for the persisted Commitment.overdueFlag column. This branch is planning-only and still requires a separate schema / maintenance review before any runtime adoption.",
      recommendedFutureFilter:
        "Persisted Commitment.overdueFlag MAY be considered for time-sensitive filters only after a separate schema / maintenance review approves the maintenance proof; until then the safe direction remains read-time derivation.",
      residualBlockers: blockers,
    };
  }

  if (maintenanceAbsenceRows.length > 0 && safeDirectionRows.length > 0) {
    return {
      conclusion: "prefer_read_time_derivation",
      reason:
        "No dueDate-crossing maintenance is proven in the current repo. The persisted Commitment.overdueFlag column is therefore stale-by-design relative to a passive dueDate crossing. Future thin read-model overdue filters should prefer read-time dueDate/status derivation (or the existing deriveOverdueFlag helper) over the persisted column.",
      recommendedFutureFilter:
        "dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED') (or reuse the existing deriveOverdueFlag helper at read time). Do not rely on the persisted Commitment.overdueFlag column as the only time-sensitive filter.",
      residualBlockers: blockers,
    };
  }

  if (maintenanceAbsenceRows.length > 0) {
    return {
      conclusion: "blocked_no_safe_derivation_evidence",
      reason:
        "Maintenance absence is recorded, but no safe read-time derivation or dueDate/status planning direction is evidenced. Do not advance a future overdue filter until the safe direction is explicitly anchored.",
      recommendedFutureFilter:
        "(none - record a read-time derivation or an explicit dueDate/status planning note before planning a runtime filter)",
      residualBlockers: blockers,
    };
  }

  return {
    conclusion: "blocked_no_maintenance_evidence",
    reason:
      "Neither a maintenance proof nor a maintenance-absence finding is recorded. PF3A-003 cannot conclude until at least one of these is captured.",
    recommendedFutureFilter:
      "(none - record either a maintenance proof or a maintenance-absence finding before planning a runtime filter)",
    residualBlockers: blockers,
  };
}

// ---------------------------------------------------------------------------
// Evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface CommitmentOverdueFilterCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface CommitmentOverdueFilterEvalSummary {
  readonly totalRows: number;
  readonly persistedColumnReadCount: number;
  readonly readTimeDerivationCount: number;
  readonly maintenanceAbsenceCount: number;
  readonly maintenanceProofCount: number;
  readonly decision: CommitmentOverdueFilterDecision;
  readonly checks: readonly CommitmentOverdueFilterCheckResult[];
  readonly allPassed: boolean;
}

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "authorizes schema design",
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
  "approves runtime adoption",
  "approves production query adoption",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

const REQUIRED_REPO_TRUTH_LOCATORS = [
  "prisma/schema.prisma:3929",
  "lib/memory/shared.ts:254",
  "lib/memory/commitment.service.ts:72",
  "lib/memory/commitment.service.ts:112",
  "lib/memory/commitment.service.ts:194",
  "data/queries.ts:351",
  "features/meetings/queries.ts:437",
] as const;

function checkAtLeastOneEvidenceRow(): CommitmentOverdueFilterCheckResult {
  const passed = COMMITMENT_OVERDUE_FILTER_EVIDENCE.length > 0;
  return {
    checkName: "at_least_one_evidence_row",
    passed,
    detail: passed
      ? `Evidence matrix contains ${COMMITMENT_OVERDUE_FILTER_EVIDENCE.length} row(s).`
      : "Evidence matrix must contain at least one row.",
  };
}

function checkEveryRowHasNonEmptyEvidenceAndBoundary(): CommitmentOverdueFilterCheckResult {
  const violations: string[] = [];
  for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
    if (row.evidenceId.trim() === "") {
      violations.push(`${row.evidenceId}: evidenceId is empty`);
    }
    if (row.filePath.trim() === "") {
      violations.push(`${row.evidenceId}: filePath is empty`);
    }
    if (row.evidenceLocator.trim() === "") {
      violations.push(`${row.evidenceId}: evidenceLocator is empty`);
    }
    if (row.evidenceSummary.trim() === "") {
      violations.push(`${row.evidenceId}: evidenceSummary is empty`);
    }
    if (row.boundaryNotes.length === 0) {
      violations.push(`${row.evidenceId}: boundaryNotes is empty`);
    }
    for (const note of row.boundaryNotes) {
      if (note.trim() === "") {
        violations.push(`${row.evidenceId}: boundaryNotes contains empty string`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "every_row_has_non_empty_evidence_and_boundary",
    passed,
    detail: passed
      ? "All rows carry non-empty evidenceId, filePath, evidenceLocator, evidenceSummary, and boundaryNotes."
      : `Empty fields: ${violations.join("; ")}`,
  };
}

function checkEvidenceIdsAreUnique(): CommitmentOverdueFilterCheckResult {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
    if (seen.has(row.evidenceId)) {
      duplicates.push(row.evidenceId);
    } else {
      seen.add(row.evidenceId);
    }
  }
  const passed = duplicates.length === 0;
  return {
    checkName: "evidence_ids_are_unique",
    passed,
    detail: passed
      ? "All evidenceId values are unique."
      : `Duplicate evidenceIds: ${duplicates.join(", ")}`,
  };
}

function checkRepoTruthLocatorsCited(): CommitmentOverdueFilterCheckResult {
  const allLocators = COMMITMENT_OVERDUE_FILTER_EVIDENCE.map(
    (row) => row.evidenceLocator,
  ).join(" | ");
  const missing = REQUIRED_REPO_TRUTH_LOCATORS.filter(
    (locator) => !allLocators.includes(locator),
  );
  const passed = missing.length === 0;
  return {
    checkName: "repo_truth_locators_cited",
    passed,
    detail: passed
      ? `All required repo-truth locators cited: ${REQUIRED_REPO_TRUTH_LOCATORS.join(", ")}.`
      : `Missing repo-truth locators: ${missing.join(", ")}`,
  };
}

function checkBoundaryNotesPreserveDistinctions(): CommitmentOverdueFilterCheckResult {
  const violations: string[] = [];
  for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
    const combined = row.boundaryNotes.join(" \n ").toLowerCase();
    for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
      if (!combined.includes(phrase)) {
        violations.push(`${row.evidenceId}: boundaryNotes missing "${phrase}"`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "boundary_notes_preserve_recommendation_explanation_draft_proof",
    passed,
    detail: passed
      ? "All rows preserve recommendation/explanation/draft/proof distinctions in boundaryNotes."
      : `Missing distinctions: ${violations.join("; ")}`,
  };
}

function checkNoRowGrantsRuntimeOrSchemaOrExecutionAuthority(): CommitmentOverdueFilterCheckResult {
  const violations: string[] = [];
  for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
    const fields: string[] = [
      row.evidenceSummary,
      ...row.boundaryNotes,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.evidenceId}: contains forbidden authorization "${pattern}"`,
          );
        }
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "no_row_grants_runtime_schema_or_execution_authority",
    passed,
    detail: passed
      ? "No row authorizes auto-write, auto-send, execution authority, LLM ranking, schema design, runtime adoption, or production query adoption."
      : `Forbidden patterns: ${violations.join("; ")}`,
  };
}

function checkPersistedColumnReadsAreNotMarkedSafe(): CommitmentOverdueFilterCheckResult {
  const violations: string[] = [];
  for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
    if (
      row.evidenceKind === "persisted_column_read" &&
      row.derivationKind === "persisted_column" &&
      row.safetyAssessment === "safe_for_time_sensitive_filter"
    ) {
      violations.push(
        `${row.evidenceId}: persisted-column read is incorrectly marked as safe_for_time_sensitive_filter without a maintenance proof.`,
      );
    }
    if (
      row.evidenceKind === "persisted_column_read" &&
      row.maintenanceProofForPersistedColumn === true
    ) {
      violations.push(
        `${row.evidenceId}: persisted-column read row claims maintenanceProofForPersistedColumn=true; that proof must come from a separate maintenance evidence row.`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "persisted_column_reads_are_not_marked_safe_without_maintenance_proof",
    passed,
    detail: passed
      ? "No persisted-column read row is incorrectly marked as time-safe."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkMaintenanceAbsenceForcesPreferReadTime(): CommitmentOverdueFilterCheckResult {
  const decision = deriveCommitmentOverdueFilterDecision(
    COMMITMENT_OVERDUE_FILTER_EVIDENCE,
  );
  const hasAbsence = COMMITMENT_OVERDUE_FILTER_EVIDENCE.some(
    (row) => row.evidenceKind === "maintenance_absence",
  );
  const hasProof = COMMITMENT_OVERDUE_FILTER_EVIDENCE.some(
    (row) => row.maintenanceProofForPersistedColumn === true,
  );

  if (hasProof) {
    const passed = decision.conclusion === "persisted_column_safe_with_maintenance_proof";
    return {
      checkName: "maintenance_absence_plus_safe_direction_controls_conclusion",
      passed,
      detail: passed
        ? "Maintenance proof rows are present; conclusion is persisted_column_safe_with_maintenance_proof (planning-only)."
        : `Expected persisted_column_safe_with_maintenance_proof, got "${decision.conclusion}".`,
    };
  }

  if (hasAbsence) {
    const hasSafeDirection = COMMITMENT_OVERDUE_FILTER_EVIDENCE.some((row) => {
      if (
        row.evidenceKind === "read_time_derivation" &&
        row.derivationKind === "read_time_derivation"
      ) {
        return true;
      }
      if (row.evidenceKind !== "filter_planning_note") {
        return false;
      }
      const summary = row.evidenceSummary.toLowerCase();
      return summary.includes("duedate/status") || summary.includes("deriveoverdueflag");
    });
    const passed = decision.conclusion === "prefer_read_time_derivation";
    return {
      checkName: "maintenance_absence_plus_safe_direction_controls_conclusion",
      passed,
      detail: passed
        ? "Maintenance absence plus an explicit safe direction leads to prefer_read_time_derivation."
        : hasSafeDirection
          ? `Expected prefer_read_time_derivation, got "${decision.conclusion}".`
          : "Maintenance absence is present but no safe read-time direction is evidenced.",
    };
  }

  const passed = decision.conclusion === "blocked_no_maintenance_evidence";
  return {
    checkName: "maintenance_absence_plus_safe_direction_controls_conclusion",
    passed,
    detail: passed
      ? "No maintenance proof and no maintenance absence; conclusion is blocked_no_maintenance_evidence."
      : `Expected blocked_no_maintenance_evidence, got "${decision.conclusion}".`,
  };
}

function checkPlanningNoteRefusesRuntimeAdoption(): CommitmentOverdueFilterCheckResult {
  const planningRows = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
    (row) => row.evidenceKind === "filter_planning_note",
  );
  if (planningRows.length === 0) {
    return {
      checkName: "planning_note_refuses_runtime_adoption",
      passed: false,
      detail: "At least one filter_planning_note row is required to encode the planning-only filter direction.",
    };
  }
  const violations: string[] = [];
  for (const row of planningRows) {
    const combined = `${row.evidenceSummary} ${row.boundaryNotes.join(" ")}`.toLowerCase();
    if (!combined.includes("not authorize")) {
      violations.push(
        `${row.evidenceId}: planning note must explicitly state it does not authorize runtime adoption.`,
      );
    }
    if (
      !combined.includes("must not use the persisted") &&
      !combined.includes("must not be used as the only") &&
      !combined.includes("must not use the persisted commitment.overdueflag")
    ) {
      violations.push(
        `${row.evidenceId}: planning note must guard against using the persisted column as the only time-sensitive filter.`,
      );
    }
    if (
      !combined.includes("duedate/status") &&
      !combined.includes("deriveoverdueflag")
    ) {
      violations.push(
        `${row.evidenceId}: planning note must name the dueDate/status heuristic or the deriveOverdueFlag read-time derivation as the safe direction.`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "planning_note_refuses_runtime_adoption",
    passed,
    detail: passed
      ? "Filter planning note explicitly refuses runtime adoption and names the safe direction."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkEvidenceKindsAndDerivationKindsValid(): CommitmentOverdueFilterCheckResult {
  const allowedKinds = new Set<CommitmentOverdueEvidenceKind>([
    "schema_definition",
    "derive_helper",
    "write_path",
    "read_time_derivation",
    "persisted_column_read",
    "maintenance_absence",
    "filter_planning_note",
  ]);
  const allowedDerivations = new Set<CommitmentOverdueDerivationKind>([
    "persisted_column",
    "read_time_derivation",
    "schema_only",
    "absent",
    "planning_only",
  ]);
  const allowedSafety = new Set<CommitmentOverdueSafetyAssessment>([
    "safe_for_time_sensitive_filter",
    "stale_by_design_for_time_sensitive_filter",
    "neutral_storage_definition",
    "neutral_helper_definition",
    "neutral_write_path",
    "neutral_planning_note",
  ]);
  const violations: string[] = [];
  for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
    if (!allowedKinds.has(row.evidenceKind)) {
      violations.push(
        `${row.evidenceId}: invalid evidenceKind "${row.evidenceKind}"`,
      );
    }
    if (!allowedDerivations.has(row.derivationKind)) {
      violations.push(
        `${row.evidenceId}: invalid derivationKind "${row.derivationKind}"`,
      );
    }
    if (!allowedSafety.has(row.safetyAssessment)) {
      violations.push(
        `${row.evidenceId}: invalid safetyAssessment "${row.safetyAssessment}"`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "evidence_kinds_and_derivation_kinds_valid",
    passed,
    detail: passed
      ? "All rows use allowed evidenceKind, derivationKind, and safetyAssessment values."
      : `Invalid values: ${violations.join("; ")}`,
  };
}

export function evaluateCommitmentOverdueFilterResolution(): CommitmentOverdueFilterEvalSummary {
  const checks: CommitmentOverdueFilterCheckResult[] = [
    checkAtLeastOneEvidenceRow(),
    checkEveryRowHasNonEmptyEvidenceAndBoundary(),
    checkEvidenceIdsAreUnique(),
    checkRepoTruthLocatorsCited(),
    checkBoundaryNotesPreserveDistinctions(),
    checkNoRowGrantsRuntimeOrSchemaOrExecutionAuthority(),
    checkPersistedColumnReadsAreNotMarkedSafe(),
    checkMaintenanceAbsenceForcesPreferReadTime(),
    checkPlanningNoteRefusesRuntimeAdoption(),
    checkEvidenceKindsAndDerivationKindsValid(),
  ];
  const persistedColumnReadCount = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
    (row) => row.evidenceKind === "persisted_column_read",
  ).length;
  const readTimeDerivationCount = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
    (row) => row.evidenceKind === "read_time_derivation",
  ).length;
  const maintenanceAbsenceCount = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
    (row) => row.evidenceKind === "maintenance_absence",
  ).length;
  const maintenanceProofCount = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
    (row) => row.maintenanceProofForPersistedColumn === true,
  ).length;
  return {
    totalRows: COMMITMENT_OVERDUE_FILTER_EVIDENCE.length,
    persistedColumnReadCount,
    readTimeDerivationCount,
    maintenanceAbsenceCount,
    maintenanceProofCount,
    decision: deriveCommitmentOverdueFilterDecision(
      COMMITMENT_OVERDUE_FILTER_EVIDENCE,
    ),
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
