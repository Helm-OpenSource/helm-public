/**
 * Helm Business Advancement - Phase 3A / PF3A-004
 * Email-thread dedup design (planning-only artifact).
 *
 * This artifact records, deterministically, the current repository truth about
 * the existing customer_waiting read-model path (loadWaitingEmailThreads in
 * features/mobile/lib/mobile-command-read-model.ts) and the proposed TPQR-004
 * CRM-scoped customer_waiting read-only where clause (from
 * features/business-advancement/thin-projection-query-review.ts). It then
 * selects, in writing, the ownership rule that any future thin read-model
 * planning must follow before runtime adoption is even considered.
 *
 * Repo truth restated (do not contradict):
 *   - features/mobile/lib/mobile-command-read-model.ts:72 calls
 *     loadWaitingEmailThreads(input.workspaceId) inside the customer_waiting
 *     branch of the must-push aggregator.
 *   - features/mobile/lib/mobile-command-read-model.ts:310 defines
 *     loadWaitingEmailThreads(workspaceId), which queries
 *     db.emailThread.findMany where { workspaceId, status: "WAITING_US" } and
 *     applies NO opportunityId filter - it returns ALL waiting threads in the
 *     workspace regardless of CRM linkage.
 *   - features/mobile/lib/mobile-command-read-model.ts:328 returns each item
 *     with id `waiting-thread-${thread.id}`, so the rendered item id contains
 *     the underlying EmailThread.id directly.
 *   - features/business-advancement/thin-projection-query-review.ts:254
 *     defines TPQR-004 with a CRM-scoped where clause:
 *     workspaceId = $workspaceId AND opportunityId IS NOT NULL AND
 *     status = 'WAITING_US' AND opportunity.stage NOT IN ('DONE','LOST') AND
 *     opportunity.updatedAt < NOW() - INTERVAL '7 DAYS'.
 *   - prisma/schema.prisma:3019 declares EmailThread.workspaceId (non-null FK).
 *   - prisma/schema.prisma:3022 declares EmailThread.opportunityId (nullable
 *     FK - the field that drives the overlap question).
 *   - prisma/schema.prisma:3037 declares the EmailThread.opportunity relation
 *     used by the TPQR-004 join.
 *   - features/business-advancement/runtime-readiness-preflight.ts:157 (PF3-004)
 *     and features/business-advancement/runtime-guard-resolution-plan.ts:176
 *     (PF3A-004) both require deduplication-by-emailThread.id before any
 *     runtime adoption of the CRM-scoped customer_waiting path.
 *
 * Selected ownership rule (planning-only):
 *   merge_and_dedup_by_email_thread_id_after_producers
 *
 * Tie-break: prefer the TPQR-004 CRM-linked item over the generic
 * loadWaitingEmailThreads item for the same emailThread.id; fall back to the
 * generic waiting-thread item when no TPQR-004 item exists for that
 * emailThread.id.
 *
 * This artifact does NOT authorize:
 *   - Prisma schema changes
 *   - runtime extractor / event queue / background job
 *   - API route / data/queries.ts / app page modifications
 *   - features/mobile/lib/mobile-command-read-model.ts edits
 *   - dashboard / search / mobile UI behavior changes
 *   - official write / auto-send / auto-approval / auto-execute
 *   - LLM final ranking
 *   - production query adoption
 */

// ---------------------------------------------------------------------------
// Evidence row types
// ---------------------------------------------------------------------------

export type EmailThreadDedupEvidenceKind =
  | "existing_read_model_call_site"
  | "existing_read_model_query_shape"
  | "existing_read_model_id_shape"
  | "proposed_tpqr004_query_shape"
  | "schema_locator"
  | "dedup_requirement_doc"
  | "ownership_design_note";

export type EmailThreadProducerId =
  | "loadWaitingEmailThreads_generic"
  | "tpqr004_crm_linked";

/**
 * Both ownership rule candidates carried forward from PF3A-004:
 *   (a) TPQR-004 takes exclusive ownership of opportunityId IS NOT NULL threads
 *   (b) merge-and-dedup keyed on emailThread.id after both producers run
 *
 * Option (b) is selected by this artifact (see SELECTED_OWNERSHIP_RULE).
 */
export type EmailThreadOwnershipRuleId =
  | "tpqr004_exclusive_for_opportunity_linked"
  | "merge_and_dedup_by_email_thread_id_after_producers";

/**
 * One PF3A-004 evidence row. Each row pins a deterministic, file-level fact
 * about the customer_waiting overlap between the existing
 * loadWaitingEmailThreads path and the proposed TPQR-004 CRM-scoped path.
 */
export interface EmailThreadDedupEvidenceRow {
  /** Stable identifier for this evidence row. */
  readonly evidenceId: string;
  /** Repo-relative file path of the evidence (or "(planning)" for design notes). */
  readonly filePath: string;
  /** file:line or symbol locator pinning the evidence. */
  readonly evidenceLocator: string;
  /** Kind of evidence (call-site, query shape, id shape, proposed shape, schema, doc, design note). */
  readonly evidenceKind: EmailThreadDedupEvidenceKind;
  /** Optional - which producer this row constrains (when applicable). */
  readonly relatedProducer?: EmailThreadProducerId;
  /** Short summary of what this evidence asserts. */
  readonly evidenceSummary: string;
  /** Boundary notes preserving recommendation/explanation/draft/proof distinctions. */
  readonly boundaryNotes: readonly string[];
}

// ---------------------------------------------------------------------------
// Shared boundary notes (row level)
// ---------------------------------------------------------------------------

const SHARED_BOUNDARY_NOTES: readonly string[] = [
  "recommendation != commitment - any PF3A-004 finding stays advisory until separately approved.",
  "explanation != approval - citing repo evidence does not authorize runtime adoption.",
  "draft != send - drafted dedup designs must not be acted upon as official changes.",
  "proof != external write success - verifying internal merge logic does not authorize outbound writes or sends.",
];

const PLANNING_ONLY_BOUNDARY_NOTES: readonly string[] = [
  "Phase 3A scope: planning-only - this row does not approve runtime adoption.",
  "PF3A-004 does not modify features/mobile/lib/mobile-command-read-model.ts or any UI surface; the dedup design is the only deliverable.",
];

// ---------------------------------------------------------------------------
// PF3A-004 evidence matrix (deterministic, append-only at row level)
// ---------------------------------------------------------------------------

export const EMAIL_THREAD_DEDUP_EVIDENCE: readonly EmailThreadDedupEvidenceRow[] =
  [
    // -----------------------------------------------------------------------
    // PF3A004-EV-001 | existing read-model call site
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-001",
      filePath: "features/mobile/lib/mobile-command-read-model.ts",
      evidenceLocator: "features/mobile/lib/mobile-command-read-model.ts:72",
      evidenceKind: "existing_read_model_call_site",
      relatedProducer: "loadWaitingEmailThreads_generic",
      evidenceSummary:
        "The mobile must-push aggregator calls loadWaitingEmailThreads(input.workspaceId) inside the Source 5 / customer_waiting branch of the Promise.all - this is the existing producer for customer_waiting items today.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Call site is recorded as evidence only; PF3A-004 does not modify the aggregator.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-002 | existing read-model query shape
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-002",
      filePath: "features/mobile/lib/mobile-command-read-model.ts",
      evidenceLocator: "features/mobile/lib/mobile-command-read-model.ts:310",
      evidenceKind: "existing_read_model_query_shape",
      relatedProducer: "loadWaitingEmailThreads_generic",
      evidenceSummary:
        "loadWaitingEmailThreads(workspaceId) queries db.emailThread.findMany where { workspaceId, status: 'WAITING_US' } with no opportunityId filter - it returns every WAITING_US thread in the workspace regardless of CRM linkage; the include set is { company: true, contact: true } and the order is updatedAt desc with take: 3.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Query shape is recorded as evidence only; PF3A-004 does not change the existing where clause.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-003 | existing read-model id shape
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-003",
      filePath: "features/mobile/lib/mobile-command-read-model.ts",
      evidenceLocator: "features/mobile/lib/mobile-command-read-model.ts:328",
      evidenceKind: "existing_read_model_id_shape",
      relatedProducer: "loadWaitingEmailThreads_generic",
      evidenceSummary:
        "Each existing customer_waiting item is returned with id `waiting-thread-${thread.id}` - the rendered item id contains the underlying EmailThread.id, which makes emailThread.id the natural deduplication key when a second producer is introduced.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Id shape is recorded as evidence only; the dedup key is the underlying emailThread.id, not the rendered item id string.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-004 | proposed TPQR-004 query shape
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-004",
      filePath: "features/business-advancement/thin-projection-query-review.ts",
      evidenceLocator: "features/business-advancement/thin-projection-query-review.ts:254",
      evidenceKind: "proposed_tpqr004_query_shape",
      relatedProducer: "tpqr004_crm_linked",
      evidenceSummary:
        "The TPQR-004 review row defines the CRM-scoped customer_waiting where clause as workspaceId = $workspaceId AND opportunityId IS NOT NULL AND status = 'WAITING_US' AND opportunity.stage NOT IN ('DONE','LOST') AND opportunity.updatedAt < NOW() - INTERVAL '7 DAYS' over EmailThread joined to Opportunity - this is a planning shape, not a runtime call.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "TPQR-004 query shape stays in review_only_not_implemented posture; PF3A-004 does not implement it.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-005 | schema locator: EmailThread.workspaceId
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-005",
      filePath: "prisma/schema.prisma",
      evidenceLocator: "prisma/schema.prisma:3019",
      evidenceKind: "schema_locator",
      evidenceSummary:
        "EmailThread.workspaceId is declared as a non-nullable String FK to Workspace - both producers (loadWaitingEmailThreads_generic and tpqr004_crm_linked) operate within a single $workspaceId scope, so dedup-by-emailThread.id is safe inside a workspace.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Schema fact only - PF3A-004 does not propose schema changes.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-006 | schema locator: EmailThread.opportunityId (nullable)
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-006",
      filePath: "prisma/schema.prisma",
      evidenceLocator: "prisma/schema.prisma:3022",
      evidenceKind: "schema_locator",
      evidenceSummary:
        "EmailThread.opportunityId is declared as a nullable String FK - this is precisely why the two producers can overlap: loadWaitingEmailThreads_generic ignores opportunityId entirely, while TPQR-004 restricts to opportunityId IS NOT NULL, so any WAITING_US thread that is also CRM-linked appears in both producers without dedup.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Nullable opportunityId is the structural reason a dedup contract is needed; PF3A-004 records this without proposing a schema change.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-007 | schema locator: EmailThread.opportunity relation
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-007",
      filePath: "prisma/schema.prisma",
      evidenceLocator: "prisma/schema.prisma:3037",
      evidenceKind: "schema_locator",
      evidenceSummary:
        "The EmailThread.opportunity relation is declared as Opportunity? on the foreign key opportunityId - this is the relation TPQR-004 traverses to apply opportunity.stage NOT IN ('DONE','LOST') and opportunity.updatedAt < 7d filters; the same emailThread.id surfaces with or without the join.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Schema fact only - the relation is not modified by PF3A-004.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-008 | dedup requirement doc: PF3-004 preflight
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-008",
      filePath: "features/business-advancement/runtime-readiness-preflight.ts",
      evidenceLocator: "features/business-advancement/runtime-readiness-preflight.ts:157",
      evidenceKind: "dedup_requirement_doc",
      evidenceSummary:
        "PF3-004 (Phase 3 entry-gate preflight for TPQR-004 / customer_waiting) explicitly records the conditional runtime guard: before runtime adoption, implement deduplication by emailThread.id between TPQR-004 output and loadWaitingEmailThreads output, define ownership for opportunityId IS NOT NULL threads, and ensure the CRM-linked path and the general waiting-thread path do not surface the same emailThread record twice.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Doc reference only - PF3A-004 does not modify the preflight artifact.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-009 | dedup requirement doc: PF3A-004 guard-resolution row
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-009",
      filePath: "features/business-advancement/runtime-guard-resolution-plan.ts",
      evidenceLocator: "features/business-advancement/runtime-guard-resolution-plan.ts:176",
      evidenceKind: "dedup_requirement_doc",
      evidenceSummary:
        "PF3A-004 (Phase 3A guard-resolution row, resolutionClass: requires_dedup_design) requires that an ownership rule for opportunityId IS NOT NULL threads is selected, that a deterministic deduplication strategy keyed on emailThread.id is documented, and that a single emailThread.id MUST NOT appear in both TPQR-004 and loadWaitingEmailThreads output for the same render.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Doc reference only - PF3A-004 does not modify the guard-resolution plan artifact.",
      ],
    },

    // -----------------------------------------------------------------------
    // PF3A004-EV-010 | ownership design note (planning-only)
    // -----------------------------------------------------------------------
    {
      evidenceId: "PF3A004-EV-010",
      filePath: "(planning)",
      evidenceLocator: "(planning-only ownership selection for the customer_waiting overlap)",
      evidenceKind: "ownership_design_note",
      evidenceSummary:
        "Selected ownership rule: merge_and_dedup_by_email_thread_id_after_producers. Tie-break: prefer the TPQR-004 CRM-linked item over the generic loadWaitingEmailThreads item for the same emailThread.id; fall back to the generic waiting-thread item when no TPQR-004 item exists for that emailThread.id. This note does not authorize runtime adoption and does not modify loadWaitingEmailThreads or any UI surface; the dueDate/status-style heuristic for opportunity staleness remains scoped to TPQR-004 review only.",
      boundaryNotes: [
        ...SHARED_BOUNDARY_NOTES,
        ...PLANNING_ONLY_BOUNDARY_NOTES,
        "Design note - not a runtime change, not a schema change, not a query adoption.",
      ],
    },
  ] as const;

// ---------------------------------------------------------------------------
// Selected ownership rule (planning-only)
// ---------------------------------------------------------------------------

export const SELECTED_OWNERSHIP_RULE: EmailThreadOwnershipRuleId =
  "merge_and_dedup_by_email_thread_id_after_producers";

export interface OwnershipRuleSelection {
  readonly selectedRule: EmailThreadOwnershipRuleId;
  readonly tieBreakOrder: readonly EmailThreadProducerId[];
  readonly rationale: string;
}

export const OWNERSHIP_RULE_SELECTION: OwnershipRuleSelection = {
  selectedRule: SELECTED_OWNERSHIP_RULE,
  tieBreakOrder: [
    "tpqr004_crm_linked",
    "loadWaitingEmailThreads_generic",
  ],
  rationale:
    "Selected merge_and_dedup_by_email_thread_id_after_producers because the existing loadWaitingEmailThreads path already serves non-CRM-linked WAITING_US threads and must continue to do so without behavior change in PF3A-004; restricting it to opportunityId IS NULL would alter the existing surface, which is out of Phase 3A scope. Running both producers and merging by emailThread.id with a TPQR-004-first tie-break preserves the existing surface, surfaces the CRM-linked item with its stronger context when present, and falls back to the generic waiting-thread item when no TPQR-004 row matches.",
};

// ---------------------------------------------------------------------------
// Pure dedup function over a minimal planning fixture type
// ---------------------------------------------------------------------------

/**
 * Minimal planning fixture - NOT a runtime type. This shape exists only so the
 * deduplication contract can be exercised in tests. It deliberately omits the
 * full MustPushItem shape from features/mobile/lib/mobile-command-read-model.ts
 * because PF3A-004 must not change that file or its types.
 */
export interface PlanningEmailThreadItem {
  /** Which producer emitted this item. */
  readonly producer: EmailThreadProducerId;
  /** Underlying EmailThread.id - the dedup key. */
  readonly emailThreadId: string;
  /** Rendered item id (e.g. "waiting-thread-em_1") - included for fixture realism. */
  readonly itemId: string;
  /** Whether the underlying EmailThread.opportunityId is set in the fixture. */
  readonly opportunityIdPresent: boolean;
}

/**
 * Deterministic merge-and-dedup keyed on emailThread.id with a TPQR-004-first
 * tie-break. The output preserves the order in which each emailThread.id is
 * first seen in the input (so the existing surface ordering is not silently
 * reshuffled), and for each emailThread.id keeps the TPQR-004 item if any
 * TPQR-004 item for that id exists, otherwise the generic waiting-thread item.
 */
export function mergeAndDedupByEmailThreadId(
  items: readonly PlanningEmailThreadItem[],
): readonly PlanningEmailThreadItem[] {
  const winnerByThreadId = new Map<string, PlanningEmailThreadItem>();
  for (const item of items) {
    const existing = winnerByThreadId.get(item.emailThreadId);
    if (!existing) {
      winnerByThreadId.set(item.emailThreadId, item);
      continue;
    }
    if (
      item.producer === "tpqr004_crm_linked" &&
      existing.producer === "loadWaitingEmailThreads_generic"
    ) {
      winnerByThreadId.set(item.emailThreadId, item);
    }
  }

  const seen = new Set<string>();
  const orderedThreadIds: string[] = [];
  for (const item of items) {
    if (seen.has(item.emailThreadId)) {
      continue;
    }
    seen.add(item.emailThreadId);
    orderedThreadIds.push(item.emailThreadId);
  }

  const result: PlanningEmailThreadItem[] = [];
  for (const threadId of orderedThreadIds) {
    const winner = winnerByThreadId.get(threadId);
    if (winner) {
      result.push(winner);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Evaluator (pure, no side effects)
// ---------------------------------------------------------------------------

export interface EmailThreadDedupCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface EmailThreadDedupEvalSummary {
  readonly totalRows: number;
  readonly producersCovered: readonly EmailThreadProducerId[];
  readonly selectedRule: EmailThreadOwnershipRuleId;
  readonly tieBreakOrder: readonly EmailThreadProducerId[];
  readonly checks: readonly EmailThreadDedupCheckResult[];
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
  "features/mobile/lib/mobile-command-read-model.ts:72",
  "features/mobile/lib/mobile-command-read-model.ts:310",
  "features/mobile/lib/mobile-command-read-model.ts:328",
  "features/business-advancement/thin-projection-query-review.ts:254",
  "prisma/schema.prisma:3019",
  "prisma/schema.prisma:3022",
  "prisma/schema.prisma:3037",
  "features/business-advancement/runtime-readiness-preflight.ts:157",
  "features/business-advancement/runtime-guard-resolution-plan.ts:176",
] as const;

const ALLOWED_EVIDENCE_KINDS = new Set<EmailThreadDedupEvidenceKind>([
  "existing_read_model_call_site",
  "existing_read_model_query_shape",
  "existing_read_model_id_shape",
  "proposed_tpqr004_query_shape",
  "schema_locator",
  "dedup_requirement_doc",
  "ownership_design_note",
]);

const ALLOWED_PRODUCERS = new Set<EmailThreadProducerId>([
  "loadWaitingEmailThreads_generic",
  "tpqr004_crm_linked",
]);

const ALLOWED_OWNERSHIP_RULES = new Set<EmailThreadOwnershipRuleId>([
  "tpqr004_exclusive_for_opportunity_linked",
  "merge_and_dedup_by_email_thread_id_after_producers",
]);

function checkAtLeastOneEvidenceRow(): EmailThreadDedupCheckResult {
  const passed = EMAIL_THREAD_DEDUP_EVIDENCE.length > 0;
  return {
    checkName: "at_least_one_evidence_row",
    passed,
    detail: passed
      ? `Evidence matrix contains ${EMAIL_THREAD_DEDUP_EVIDENCE.length} row(s).`
      : "Evidence matrix must contain at least one row.",
  };
}

function checkEveryRowHasNonEmptyEvidenceAndBoundary(): EmailThreadDedupCheckResult {
  const violations: string[] = [];
  for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
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

function checkEvidenceIdsAreUnique(): EmailThreadDedupCheckResult {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
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

function checkRepoTruthLocatorsCited(): EmailThreadDedupCheckResult {
  const allLocators = EMAIL_THREAD_DEDUP_EVIDENCE.map(
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

function checkBoundaryNotesPreserveDistinctions(): EmailThreadDedupCheckResult {
  const violations: string[] = [];
  for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
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

function checkNoForbiddenAuthorization(): EmailThreadDedupCheckResult {
  const violations: string[] = [];
  for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
    const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
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
  const rationaleLower = OWNERSHIP_RULE_SELECTION.rationale.toLowerCase();
  for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
    if (rationaleLower.includes(pattern)) {
      violations.push(
        `OWNERSHIP_RULE_SELECTION.rationale: contains forbidden authorization "${pattern}"`,
      );
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

function checkEvidenceKindsAndProducersValid(): EmailThreadDedupCheckResult {
  const violations: string[] = [];
  for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
    if (!ALLOWED_EVIDENCE_KINDS.has(row.evidenceKind)) {
      violations.push(
        `${row.evidenceId}: invalid evidenceKind "${row.evidenceKind}"`,
      );
    }
    if (
      row.relatedProducer !== undefined &&
      !ALLOWED_PRODUCERS.has(row.relatedProducer)
    ) {
      violations.push(
        `${row.evidenceId}: invalid relatedProducer "${row.relatedProducer}"`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "evidence_kinds_and_producers_valid",
    passed,
    detail: passed
      ? "All rows use allowed evidenceKind and relatedProducer values."
      : `Invalid values: ${violations.join("; ")}`,
  };
}

function checkOwnershipRuleSelected(): EmailThreadDedupCheckResult {
  const passed =
    ALLOWED_OWNERSHIP_RULES.has(SELECTED_OWNERSHIP_RULE) &&
    OWNERSHIP_RULE_SELECTION.selectedRule === SELECTED_OWNERSHIP_RULE &&
    OWNERSHIP_RULE_SELECTION.rationale.trim() !== "";
  return {
    checkName: "ownership_rule_selected",
    passed,
    detail: passed
      ? `Ownership rule selected: ${SELECTED_OWNERSHIP_RULE}.`
      : "An ownership rule must be selected and recorded with a non-empty rationale.",
  };
}

function checkSelectedRuleIsMergeAndDedupAfterProducers(): EmailThreadDedupCheckResult {
  const passed =
    SELECTED_OWNERSHIP_RULE === "merge_and_dedup_by_email_thread_id_after_producers";
  return {
    checkName: "selected_rule_is_merge_and_dedup_after_producers",
    passed,
    detail: passed
      ? "Selected rule is merge_and_dedup_by_email_thread_id_after_producers (planning-only)."
      : `Expected merge_and_dedup_by_email_thread_id_after_producers, got "${SELECTED_OWNERSHIP_RULE}".`,
  };
}

function checkTieBreakIsTpqr004First(): EmailThreadDedupCheckResult {
  const order = OWNERSHIP_RULE_SELECTION.tieBreakOrder;
  const passed =
    order.length === 2 &&
    order[0] === "tpqr004_crm_linked" &&
    order[1] === "loadWaitingEmailThreads_generic";
  return {
    checkName: "tie_break_is_tpqr004_first_then_generic_fallback",
    passed,
    detail: passed
      ? "Tie-break order is [tpqr004_crm_linked, loadWaitingEmailThreads_generic]."
      : `Expected tie-break order [tpqr004_crm_linked, loadWaitingEmailThreads_generic], got [${order.join(", ")}].`,
  };
}

function checkNoDuplicateEmailThreadIdInMergedOutput(): EmailThreadDedupCheckResult {
  const overlapping: readonly PlanningEmailThreadItem[] = [
    {
      producer: "loadWaitingEmailThreads_generic",
      emailThreadId: "em_thread_a",
      itemId: "waiting-thread-em_thread_a",
      opportunityIdPresent: true,
    },
    {
      producer: "tpqr004_crm_linked",
      emailThreadId: "em_thread_a",
      itemId: "tpqr004-em_thread_a",
      opportunityIdPresent: true,
    },
    {
      producer: "loadWaitingEmailThreads_generic",
      emailThreadId: "em_thread_b",
      itemId: "waiting-thread-em_thread_b",
      opportunityIdPresent: false,
    },
    {
      producer: "tpqr004_crm_linked",
      emailThreadId: "em_thread_c",
      itemId: "tpqr004-em_thread_c",
      opportunityIdPresent: true,
    },
  ];
  const merged = mergeAndDedupByEmailThreadId(overlapping);
  const ids = merged.map((m) => m.emailThreadId);
  const unique = new Set(ids);
  const noDuplicates = ids.length === unique.size;
  const overlappingThreadKeptAsTpqr004 =
    merged.find((m) => m.emailThreadId === "em_thread_a")?.producer ===
    "tpqr004_crm_linked";
  const genericKeptWhenNoTpqr004 =
    merged.find((m) => m.emailThreadId === "em_thread_b")?.producer ===
    "loadWaitingEmailThreads_generic";
  const tpqr004OnlyKept =
    merged.find((m) => m.emailThreadId === "em_thread_c")?.producer ===
    "tpqr004_crm_linked";
  const passed =
    noDuplicates &&
    overlappingThreadKeptAsTpqr004 &&
    genericKeptWhenNoTpqr004 &&
    tpqr004OnlyKept;
  return {
    checkName: "no_duplicate_email_thread_id_in_final_merged_output",
    passed,
    detail: passed
      ? "Merge-and-dedup over an overlapping fixture yields unique emailThread.id rows with TPQR-004 winning the overlap and generic kept on TPQR-004 absence."
      : `Dedup invariant violated: noDuplicates=${noDuplicates}, overlappingThreadKeptAsTpqr004=${overlappingThreadKeptAsTpqr004}, genericKeptWhenNoTpqr004=${genericKeptWhenNoTpqr004}, tpqr004OnlyKept=${tpqr004OnlyKept}.`,
  };
}

function checkOwnershipDesignNoteRefusesRuntimeAdoption(): EmailThreadDedupCheckResult {
  const designNotes = EMAIL_THREAD_DEDUP_EVIDENCE.filter(
    (row) => row.evidenceKind === "ownership_design_note",
  );
  if (designNotes.length === 0) {
    return {
      checkName: "ownership_design_note_refuses_runtime_adoption",
      passed: false,
      detail: "At least one ownership_design_note row is required to encode the planning-only ownership selection.",
    };
  }
  const violations: string[] = [];
  for (const row of designNotes) {
    const combined = `${row.evidenceSummary} ${row.boundaryNotes.join(" ")}`.toLowerCase();
    if (!combined.includes("not authorize")) {
      violations.push(
        `${row.evidenceId}: design note must explicitly state it does not authorize runtime adoption.`,
      );
    }
    if (!combined.includes("merge_and_dedup_by_email_thread_id_after_producers")) {
      violations.push(
        `${row.evidenceId}: design note must name the selected ownership rule.`,
      );
    }
    if (
      !combined.includes("tpqr-004") &&
      !combined.includes("tpqr004")
    ) {
      violations.push(
        `${row.evidenceId}: design note must reference TPQR-004.`,
      );
    }
  }
  const passed = violations.length === 0;
  return {
    checkName: "ownership_design_note_refuses_runtime_adoption",
    passed,
    detail: passed
      ? "Ownership design note explicitly refuses runtime adoption and names the selected rule plus TPQR-004."
      : `Violations: ${violations.join("; ")}`,
  };
}

function checkBothProducersCovered(): EmailThreadDedupCheckResult {
  const producers = new Set<EmailThreadProducerId>();
  for (const row of EMAIL_THREAD_DEDUP_EVIDENCE) {
    if (row.relatedProducer) {
      producers.add(row.relatedProducer);
    }
  }
  const missing: EmailThreadProducerId[] = [];
  if (!producers.has("loadWaitingEmailThreads_generic")) {
    missing.push("loadWaitingEmailThreads_generic");
  }
  if (!producers.has("tpqr004_crm_linked")) {
    missing.push("tpqr004_crm_linked");
  }
  const passed = missing.length === 0;
  return {
    checkName: "both_producers_covered_by_evidence",
    passed,
    detail: passed
      ? "Both producers (loadWaitingEmailThreads_generic and tpqr004_crm_linked) are covered by at least one evidence row."
      : `Missing producer coverage: ${missing.join(", ")}.`,
  };
}

export function evaluateEmailThreadDedupDesign(): EmailThreadDedupEvalSummary {
  const checks: EmailThreadDedupCheckResult[] = [
    checkAtLeastOneEvidenceRow(),
    checkEveryRowHasNonEmptyEvidenceAndBoundary(),
    checkEvidenceIdsAreUnique(),
    checkRepoTruthLocatorsCited(),
    checkBoundaryNotesPreserveDistinctions(),
    checkNoForbiddenAuthorization(),
    checkEvidenceKindsAndProducersValid(),
    checkOwnershipRuleSelected(),
    checkSelectedRuleIsMergeAndDedupAfterProducers(),
    checkTieBreakIsTpqr004First(),
    checkNoDuplicateEmailThreadIdInMergedOutput(),
    checkOwnershipDesignNoteRefusesRuntimeAdoption(),
    checkBothProducersCovered(),
  ];
  const producersCovered: EmailThreadProducerId[] = [];
  for (const producer of [
    "loadWaitingEmailThreads_generic",
    "tpqr004_crm_linked",
  ] as const) {
    if (
      EMAIL_THREAD_DEDUP_EVIDENCE.some((r) => r.relatedProducer === producer)
    ) {
      producersCovered.push(producer);
    }
  }
  return {
    totalRows: EMAIL_THREAD_DEDUP_EVIDENCE.length,
    producersCovered,
    selectedRule: SELECTED_OWNERSHIP_RULE,
    tieBreakOrder: OWNERSHIP_RULE_SELECTION.tieBreakOrder,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
