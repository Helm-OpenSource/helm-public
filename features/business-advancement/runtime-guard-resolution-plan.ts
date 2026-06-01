/**
 * Helm Business Advancement - Phase 3A Runtime Guard Resolution Plan
 *
 * Bridge artifact between Phase 3 entry-gate preflight and any future thin
 * read-model planning. For each conditional guard surfaced by the Phase 3
 * preflight (PF3-002, PF3-003, PF3-004, PF3-005), this artifact captures:
 *
 *   - the resolution class (no_schema_plan_ready / requires_source_audit /
 *     requires_dedup_design / requires_readout_derivation_design /
 *     requires_separate_schema_review)
 *   - the evidence to collect before the guard is considered resolved
 *   - the accepted resolution criteria
 *   - the stop conditions that must immediately halt the resolution work
 *   - the next work order in deterministic, planning-only form
 *   - explicit boundary notes (recommendation != commitment etc.)
 *
 * PF3-001 is intentionally excluded because Phase 3 preflight already marked
 * it ready_for_thin_read_model_planning - it does not need a guard resolution.
 *
 * This is a planning artifact only. It does NOT authorize:
 *   - schema changes
 *   - runtime implementation
 *   - API routes / route files / page modifications
 *   - runtime extractors / event queues / background jobs
 *   - official writes / auto-sends / auto-approvals
 *   - LLM final ranking
 *   - production query adoption
 */

// ---------------------------------------------------------------------------
// Resolution plan types
// ---------------------------------------------------------------------------

export type GuardResolutionClass =
  | "no_schema_plan_ready"
  | "requires_source_audit"
  | "requires_dedup_design"
  | "requires_readout_derivation_design"
  | "requires_separate_schema_review";

export type GuardCurrentStatus = "conditional_requires_runtime_guard";

/**
 * One Phase 3A guard-resolution row. Each row converts one Phase 3 conditional
 * guard into concrete planning prerequisites without authorizing runtime work.
 */
export interface RuntimeGuardResolutionRow {
  /** Stable identifier for this guard-resolution row (e.g. PF3A-002). */
  readonly guardId: string;
  /** The Phase 3 preflight check identifier this row resolves for. */
  readonly sourcePhase3CheckId: string;
  /** Current Phase 3 status mirrored verbatim from the preflight artifact. */
  readonly currentStatus: GuardCurrentStatus;
  /** Resolution class that scopes the kind of follow-up work required. */
  readonly resolutionClass: GuardResolutionClass;
  /** Concrete evidence that must be collected before the guard can be resolved. */
  readonly evidenceToCollect: readonly string[];
  /** Conditions that, when fully satisfied, allow the guard to be marked resolved. */
  readonly acceptedResolutionCriteria: readonly string[];
  /** Conditions that must immediately halt resolution work and re-surface for review. */
  readonly stopConditions: readonly string[];
  /** Deterministic next-work-order steps; planning only, no runtime adoption. */
  readonly nextWorkOrder: readonly string[];
  /** Must remain false in this Phase 3A artifact. */
  readonly runtimeImplementationAllowed: false;
  /** Must remain false in this Phase 3A artifact. */
  readonly schemaChangeAllowed: false;
  /** Boundary notes preserving recommendation/explanation/draft/proof distinctions. */
  readonly boundaryNotes: readonly string[];
}

// ---------------------------------------------------------------------------
// Phase 3A guard resolution rows
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTES: readonly string[] = [
  "recommendation != commitment - any guard-resolution finding stays advisory until separately approved.",
  "explanation != approval - citing repo evidence does not authorize runtime adoption.",
  "draft != send - drafted resolution plans must not be acted upon as official changes.",
  "proof != external write success - verifying internal logic does not authorize outbound writes or sends.",
];

export const RUNTIME_GUARD_RESOLUTION_PLAN: readonly RuntimeGuardResolutionRow[] =
  [
    // -----------------------------------------------------------------------
    // PF3A-002 | resolves PF3-002 (TPQR-002 / stalled_opportunity)
    // Source audit: confirm no scheduled CRM sync job auto-resets
    // Opportunity.updatedAt before any 14d staleness filter is planned.
    // -----------------------------------------------------------------------
    {
      guardId: "PF3A-002",
      sourcePhase3CheckId: "PF3-002",
      currentStatus: "conditional_requires_runtime_guard",
      resolutionClass: "requires_source_audit",
      evidenceToCollect: [
        "Inventory of every code path that writes Opportunity.updatedAt (Prisma calls, raw SQL, CRM connector adapters).",
        "Identification of every scheduled CRM sync job, cron, queue worker, or import pipeline that touches Opportunity rows.",
        "Determination of whether each touch leaves updatedAt unchanged, sets it explicitly, or relies on Prisma @updatedAt auto-bump.",
        "Sample of recent production-shape data (offline review only, no live query) showing updatedAt distribution by source kind.",
      ],
      acceptedResolutionCriteria: [
        "All Opportunity.updatedAt write sites are catalogued with their trigger source labelled human / system / mixed.",
        "It is documented in writing whether any system-only path (e.g. nightly CRM sync) bumps updatedAt without human action.",
        "If system-only writes exist, a separate schema or sync-exempt design review is opened - this Phase 3A row does not authorize that schema change.",
        "If only human-triggered writes exist, the staleness heuristic (updatedAt < NOW()-14d) is recorded as safe for later thin read-model planning.",
      ],
      stopConditions: [
        "Audit reveals an undocumented automated writer of Opportunity.updatedAt - stop and escalate before any runtime planning continues.",
        "Audit cannot enumerate all writers within the agreed window - keep PF3A-002 open as conditional_requires_runtime_guard.",
        "Any proposal to backfill, mutate, or normalize Opportunity rows arises during the audit - stop and route to a separate change review.",
      ],
      nextWorkOrder: [
        "Step 1 - grep the repo for Opportunity write sites and CRM sync code paths; record file:line evidence.",
        "Step 2 - produce a written writer-source matrix labelling each path human / system / mixed.",
        "Step 3 - document the decision: heuristic safe vs. requires_separate_schema_review for lastHumanActivityAt or sync-exempt flag.",
        "Step 4 - file the audit summary as a Phase 3A guard-resolution memo; do not modify Prisma schema or queries.",
      ],
      runtimeImplementationAllowed: false,
      schemaChangeAllowed: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "If a lastHumanActivityAt field or sync-write-exempt flag is judged necessary, it is a separate schema review - Phase 3A does not approve it.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A-003 | resolves PF3-003 (TPQR-003 / overdue_commitment)
    // Repo truth: overdueFlag is actively defined/derived/written/read in TS.
    // Guard is that future runtime planning must not rely on persisted column
    // alone unless dueDate-crossing maintenance is proven; default direction
    // is dueDate/status heuristic or existing deriveOverdueFlag-style logic.
    // -----------------------------------------------------------------------
    {
      guardId: "PF3A-003",
      sourcePhase3CheckId: "PF3-003",
      currentStatus: "conditional_requires_runtime_guard",
      resolutionClass: "requires_separate_schema_review",
      evidenceToCollect: [
        "Confirmation of the existing overdueFlag lifecycle in repo: lib/memory/shared.ts:254 deriveOverdueFlag, lib/memory/commitment.service.ts:72 read path returning overdueFlag: deriveOverdueFlag(row), lib/memory/commitment.service.ts:112 createCommitment write path, lib/memory/commitment.service.ts:194 updateCommitmentStatus write path, data/queries.ts:351 read site, and features/meetings/queries.ts:437 read site.",
        "Determination of whether any background process refreshes the persisted Commitment.overdueFlag when dueDate crosses without an explicit status update - without such a refresher the persisted column is stale-by-design relative to time.",
        "A worked example using the existing dueDate/status heuristic (dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')) and the existing deriveOverdueFlag read-time derivation showing equivalent or superior coverage to the persisted column.",
        "Calibration sketch for the 7-day ownerUserId/updatedAt threshold against representative commitment shapes (offline review only).",
      ],
      acceptedResolutionCriteria: [
        "It is recorded in writing that future runtime query planning must not use the persisted Commitment.overdueFlag column as the only time-sensitive filter.",
        "The accepted safe planning direction is the dueDate/status heuristic or the existing deriveOverdueFlag-style read-time derivation.",
        "If a maintenance path that refreshes overdueFlag on dueDate crossing is later proposed, it is routed through a separate schema/maintenance review - Phase 3A does not approve such a path.",
        "The guard text uses the corrected repo truth that overdueFlag is actively defined, derived, written, and read in TypeScript (i.e. the open question is dueDate-crossing maintenance, not existence).",
      ],
      stopConditions: [
        "Anyone proposes adopting the persisted overdueFlag column as the sole time-sensitive filter - stop and re-surface this guard.",
        "A proposal to add a dueDate-crossing maintenance job arises - stop and open a separate schema/maintenance review instead of treating it as a Phase 3A in-scope change.",
        "Evidence is found that overdueFlag is being used in a runtime path without dueDate/status fallback - stop and escalate.",
      ],
      nextWorkOrder: [
        "Step 1 - restate the repo truth: overdueFlag is actively defined, derived, written, and read in TypeScript; the open question is dueDate-crossing maintenance, not existence.",
        "Step 2 - document the safe planning direction: dueDate/status heuristic or existing deriveOverdueFlag read-time derivation.",
        "Step 3 - capture calibration notes for the 7-day threshold without running production queries.",
        "Step 4 - file the resolution memo as planning-only; do not modify lib/memory or commitment.service code paths.",
      ],
      runtimeImplementationAllowed: false,
      schemaChangeAllowed: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Repo truth (do not contradict): overdueFlag is actively defined, derived, written, and read in TypeScript across lib/memory and read sites - this guard is about dueDate-crossing maintenance, not existence.",
        "Any maintenance path that would refresh persisted overdueFlag is a separate schema/maintenance review and is out of Phase 3A scope.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A-004 | resolves PF3-004 (TPQR-004 / customer_waiting)
    // Dedup design: TPQR-004 vs. loadWaitingEmailThreads must not surface
    // the same emailThread.id twice; ownership rule must be defined.
    // -----------------------------------------------------------------------
    {
      guardId: "PF3A-004",
      sourcePhase3CheckId: "PF3-004",
      currentStatus: "conditional_requires_runtime_guard",
      resolutionClass: "requires_dedup_design",
      evidenceToCollect: [
        "Mapping of every surface that today consumes loadWaitingEmailThreads in features/mobile/lib/mobile-command-read-model.ts (callers and downstream renderers).",
        "Mapping of where TPQR-004 output would be consumed once thin read-model planning begins (planning-only - no runtime wiring).",
        "Worked examples showing whether overlapping emailThread.id rows would appear in both outputs in representative fixture shapes.",
        "Two candidate ownership rules captured in writing: (a) TPQR-004 takes exclusive ownership of opportunityId IS NOT NULL threads; (b) a merge-and-dedup-by-id step runs after both producers.",
      ],
      acceptedResolutionCriteria: [
        "An ownership rule for opportunityId IS NOT NULL threads is selected and written down.",
        "A deterministic deduplication strategy keyed on emailThread.id is documented for any path where both producers could be active simultaneously.",
        "It is recorded in writing that a single emailThread.id MUST NOT appear in both TPQR-004 and loadWaitingEmailThreads output for the same render.",
        "No runtime wiring change is performed in Phase 3A - only the design memo is produced.",
      ],
      stopConditions: [
        "An ownership rule cannot be selected without changing loadWaitingEmailThreads behavior in a way that affects existing surfaces - stop and escalate.",
        "Dedup design appears to require a new persisted field or a status migration - stop and route to a separate schema review.",
        "Any proposal to modify route files, app pages, or data/queries.ts surfaces - stop; Phase 3A does not authorize those edits.",
      ],
      nextWorkOrder: [
        "Step 1 - produce the consumer map for loadWaitingEmailThreads and the planned consumer surface for TPQR-004.",
        "Step 2 - choose between exclusive ownership and merge-dedup; record the rationale.",
        "Step 3 - document the deduplication contract keyed on emailThread.id, including tie-break order.",
        "Step 4 - file the design memo as planning-only; do not modify the existing read-model file or any UI surface.",
      ],
      runtimeImplementationAllowed: false,
      schemaChangeAllowed: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Phase 3A does not modify features/mobile/lib/mobile-command-read-model.ts or any UI surface - the design memo is the only deliverable.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A-005 | resolves PF3-005 (TPQR-005 / stalled_case)
    // Readout-derivation design: derivedStaleDays formula and its source
    // must be defined inside the readout pipeline before any thin filter
    // is planned.
    // -----------------------------------------------------------------------
    {
      guardId: "PF3A-005",
      sourcePhase3CheckId: "PF3-005",
      currentStatus: "conditional_requires_runtime_guard",
      resolutionClass: "requires_readout_derivation_design",
      evidenceToCollect: [
        "Catalog of the three candidate timestamp sources in lib/tenant-resources/workspace-operating-impact-query.ts: connector.lastSyncedAt, importSource.updatedAt, importJob.finishedAt.",
        "Assessment of which source reflects human-meaningful staleness (e.g. operator activity) vs. automated sync timing for each tenant resource shape.",
        "A written derivation formula for derivedStaleDays expressed in terms of one or more of those timestamps and a reference clock.",
        "Calibration sketch for the take: 2 noise guard against representative fixture shapes (offline review only).",
      ],
      acceptedResolutionCriteria: [
        "A single derivedStaleDays formula is selected and the chosen source field is named explicitly.",
        "It is recorded in writing that the chosen source must reflect human-meaningful staleness rather than automated sync timing.",
        "The plan to expose derivedStaleDays on the impact item type is captured as a separate type-surface review item - Phase 3A does not modify TenantResourceOperatingImpactItem.",
        "The take: 2 noise guard calibration is documented as a planning note, not as a runtime change.",
      ],
      stopConditions: [
        "No candidate timestamp source can be confidently labelled human-meaningful - stop and escalate.",
        "Calibration suggests take: 2 is structurally inadequate (e.g. always saturates) - stop and re-surface this guard.",
        "Any proposal to mutate readout queries, modify the impact item type, or wire a runtime filter arises - stop; those are out of Phase 3A scope.",
      ],
      nextWorkOrder: [
        "Step 1 - document the three candidate sources with their semantics and update cadence.",
        "Step 2 - choose the human-meaningful source and write the derivedStaleDays formula explicitly.",
        "Step 3 - capture calibration notes for the take: 2 noise guard against fixture shapes.",
        "Step 4 - file the derivation memo as planning-only; do not modify lib/tenant-resources or impact item types.",
      ],
      runtimeImplementationAllowed: false,
      schemaChangeAllowed: false,
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        "Surfacing derivedStaleDays on TenantResourceOperatingImpactItem is a separate type-surface review and is out of Phase 3A scope.",
      ],
    },
  ] as const;

// ---------------------------------------------------------------------------
// Resolution plan evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface GuardResolutionCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface GuardResolutionEvalSummary {
  readonly totalRows: number;
  readonly checks: readonly GuardResolutionCheckResult[];
  readonly allPassed: boolean;
}

const REQUIRED_SOURCE_PHASE3_CHECK_IDS = [
  "PF3-002",
  "PF3-003",
  "PF3-004",
  "PF3-005",
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

const TPQR003_FORBIDDEN_OUTDATED_PATTERNS = [
  "zero matches",
  "no matches",
  "no typescript references",
  "not maintained",
  "never written",
  "schema-only",
] as const;

function checkExactlyFourGuardRows(): GuardResolutionCheckResult {
  const passed = RUNTIME_GUARD_RESOLUTION_PLAN.length === 4;
  return {
    checkName: "exactly_four_guard_rows",
    passed,
    detail: passed
      ? "Exactly 4 Phase 3A guard-resolution rows present (PF3-002/003/004/005)."
      : `Expected 4 rows, found ${RUNTIME_GUARD_RESOLUTION_PLAN.length}.`,
  };
}

function checkAllConditionalGuardsCovered(): GuardResolutionCheckResult {
  const covered = new Set(
    RUNTIME_GUARD_RESOLUTION_PLAN.map((r) => r.sourcePhase3CheckId),
  );
  const missing = REQUIRED_SOURCE_PHASE3_CHECK_IDS.filter(
    (id) => !covered.has(id),
  );
  const duplicates = REQUIRED_SOURCE_PHASE3_CHECK_IDS.filter(
    (id) =>
      RUNTIME_GUARD_RESOLUTION_PLAN.filter((r) => r.sourcePhase3CheckId === id)
        .length > 1,
  );
  const passed = missing.length === 0 && duplicates.length === 0;
  return {
    checkName: "all_conditional_guards_covered_exactly_once",
    passed,
    detail: passed
      ? `All conditional Phase 3 guards covered exactly once: ${REQUIRED_SOURCE_PHASE3_CHECK_IDS.join(", ")}.`
      : `Missing: ${missing.join(", ") || "none"}; duplicates: ${duplicates.join(", ") || "none"}.`,
  };
}

function checkPf3001ExcludedIntentionally(): GuardResolutionCheckResult {
  const violation = RUNTIME_GUARD_RESOLUTION_PLAN.find(
    (r) => r.sourcePhase3CheckId === "PF3-001",
  );
  const passed = !violation;
  return {
    checkName: "pf3_001_intentionally_excluded",
    passed,
    detail: passed
      ? "PF3-001 is intentionally excluded - already ready_for_thin_read_model_planning."
      : "PF3-001 must NOT appear in Phase 3A guard resolution rows.",
  };
}

function checkAllRowsHaveNonEmptyContent(): GuardResolutionCheckResult {
  const violations: string[] = [];
  for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
    if (row.evidenceToCollect.length === 0) {
      violations.push(`${row.guardId}: evidenceToCollect is empty`);
    }
    if (row.acceptedResolutionCriteria.length === 0) {
      violations.push(`${row.guardId}: acceptedResolutionCriteria is empty`);
    }
    if (row.stopConditions.length === 0) {
      violations.push(`${row.guardId}: stopConditions is empty`);
    }
    if (row.nextWorkOrder.length === 0) {
      violations.push(`${row.guardId}: nextWorkOrder is empty`);
    }
    if (row.boundaryNotes.length === 0) {
      violations.push(`${row.guardId}: boundaryNotes is empty`);
    }
    for (const list of [
      row.evidenceToCollect,
      row.acceptedResolutionCriteria,
      row.stopConditions,
      row.nextWorkOrder,
      row.boundaryNotes,
    ]) {
      for (const item of list) {
        if (item.trim() === "") {
          violations.push(`${row.guardId}: list contains empty string`);
        }
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "all_rows_have_non_empty_content",
    passed,
    detail: passed
      ? "All rows have non-empty evidence, criteria, stop conditions, next work order, and boundary notes."
      : `Empty fields: ${violations.join("; ")}`,
  };
}

function checkRuntimeAndSchemaFlagsAreFalse(): GuardResolutionCheckResult {
  const violations: string[] = [];
  for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
    if ((row.runtimeImplementationAllowed as boolean) !== false) {
      violations.push(`${row.guardId}: runtimeImplementationAllowed is not false`);
    }
    if ((row.schemaChangeAllowed as boolean) !== false) {
      violations.push(`${row.guardId}: schemaChangeAllowed is not false`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "runtime_and_schema_flags_false_for_all",
    passed,
    detail: passed
      ? "Every row has runtimeImplementationAllowed === false and schemaChangeAllowed === false."
      : `Flag violations: ${violations.join("; ")}`,
  };
}

function checkPf3a003UsesRepoTruth(): GuardResolutionCheckResult {
  const row = RUNTIME_GUARD_RESOLUTION_PLAN.find(
    (r) => r.sourcePhase3CheckId === "PF3-003",
  );
  if (!row) {
    return {
      checkName: "pf3a_003_uses_corrected_repo_truth",
      passed: false,
      detail: "PF3-003 guard-resolution row not found.",
    };
  }
  const combined = [
    ...row.evidenceToCollect,
    ...row.acceptedResolutionCriteria,
    ...row.stopConditions,
    ...row.nextWorkOrder,
    ...row.boundaryNotes,
  ]
    .join(" \n ")
    .toLowerCase();

  const hasOutdatedWording = TPQR003_FORBIDDEN_OUTDATED_PATTERNS.some((p) =>
    combined.includes(p),
  );
  const citesRepoTruth =
    combined.includes("deriveoverdueflag") &&
    combined.includes("commitment.service.ts:72") &&
    combined.includes("commitment.service.ts:112") &&
    combined.includes("commitment.service.ts:194") &&
    combined.includes("data/queries.ts:351") &&
    combined.includes("features/meetings/queries.ts:437");
  const namesSafePlanningDirection =
    combined.includes("duedate/status heuristic") ||
    combined.includes("duedate/status") ||
    combined.includes("deriveoverdueflag-style") ||
    combined.includes("deriveoverdueflag read-time derivation");
  const restatesActivelyDefined =
    combined.includes("actively defined") ||
    combined.includes("actively defined, derived, written, and read");
  const guardsAgainstSoleColumnFilter =
    combined.includes("sole time-sensitive filter") ||
    combined.includes("only time-sensitive filter") ||
    combined.includes("sole runtime filter") ||
    combined.includes("only runtime filter") ||
    combined.includes("only as the only time-sensitive filter") ||
    combined.includes("must not use the persisted commitment.overdueflag column as the only time-sensitive filter") ||
    combined.includes("must not use the persisted commitment.overdueflag column");

  const passed =
    !hasOutdatedWording &&
    citesRepoTruth &&
    namesSafePlanningDirection &&
    restatesActivelyDefined &&
    guardsAgainstSoleColumnFilter;
  return {
    checkName: "pf3a_003_uses_corrected_repo_truth",
    passed,
    detail: passed
      ? "PF3A-003 cites actual repo truth, names the safe planning direction, and avoids outdated no-reference wording."
      : hasOutdatedWording
        ? "PF3A-003 must not contain outdated wording (zero matches / no TS references / never written / not maintained / schema-only)."
        : !citesRepoTruth
          ? "PF3A-003 must cite the actual deriveOverdueFlag, commitment.service.ts:72/112/194, data/queries.ts:351, and features/meetings/queries.ts:437 evidence."
          : !namesSafePlanningDirection
            ? "PF3A-003 must name the dueDate/status heuristic or deriveOverdueFlag-style derivation as the safe planning direction."
            : !restatesActivelyDefined
              ? "PF3A-003 must restate that overdueFlag is actively defined/derived/written/read."
              : "PF3A-003 must guard against using the persisted column as the only time-sensitive filter.",
  };
}

function checkNoForbiddenAuthorization(): GuardResolutionCheckResult {
  const violations: string[] = [];
  for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
    const fields: string[] = [
      ...row.evidenceToCollect,
      ...row.acceptedResolutionCriteria,
      ...row.stopConditions,
      ...row.nextWorkOrder,
      ...row.boundaryNotes,
    ];
    for (const field of fields) {
      const lower = field.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        if (lower.includes(pattern)) {
          violations.push(
            `${row.guardId}: contains forbidden authorization "${pattern}"`,
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
      ? "No row authorizes auto-write, auto-send, execution authority, LLM ranking, or schema design."
      : `Forbidden patterns: ${violations.join("; ")}`,
  };
}

function checkBoundaryNotesPreserveDistinctions(): GuardResolutionCheckResult {
  const required = [
    "recommendation != commitment",
    "explanation != approval",
    "draft != send",
    "proof != external write success",
  ] as const;
  const violations: string[] = [];
  for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
    const combined = row.boundaryNotes.join(" \n ").toLowerCase();
    for (const phrase of required) {
      if (!combined.includes(phrase)) {
        violations.push(`${row.guardId}: boundaryNotes missing "${phrase}"`);
      }
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "boundary_notes_preserve_distinctions",
    passed,
    detail: passed
      ? "All rows preserve recommendation/explanation/draft/proof distinctions in boundaryNotes."
      : `Missing distinctions: ${violations.join("; ")}`,
  };
}

function checkResolutionClassesValid(): GuardResolutionCheckResult {
  const allowed = new Set<GuardResolutionClass>([
    "no_schema_plan_ready",
    "requires_source_audit",
    "requires_dedup_design",
    "requires_readout_derivation_design",
    "requires_separate_schema_review",
  ]);
  const violations: string[] = [];
  for (const row of RUNTIME_GUARD_RESOLUTION_PLAN) {
    if (!allowed.has(row.resolutionClass)) {
      violations.push(`${row.guardId}: invalid resolutionClass "${row.resolutionClass}"`);
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "resolution_classes_valid",
    passed,
    detail: passed
      ? "All resolutionClass values are within the allowed planning vocabulary."
      : `Invalid classes: ${violations.join("; ")}`,
  };
}

export function evaluateRuntimeGuardResolutionPlan(): GuardResolutionEvalSummary {
  const checks: GuardResolutionCheckResult[] = [
    checkExactlyFourGuardRows(),
    checkAllConditionalGuardsCovered(),
    checkPf3001ExcludedIntentionally(),
    checkAllRowsHaveNonEmptyContent(),
    checkRuntimeAndSchemaFlagsAreFalse(),
    checkPf3a003UsesRepoTruth(),
    checkNoForbiddenAuthorization(),
    checkBoundaryNotesPreserveDistinctions(),
    checkResolutionClassesValid(),
  ];
  return {
    totalRows: RUNTIME_GUARD_RESOLUTION_PLAN.length,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
