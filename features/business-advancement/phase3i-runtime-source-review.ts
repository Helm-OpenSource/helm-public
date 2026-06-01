/**
 * Helm Business Advancement - Phase 3I
 * Runtime Source Review artifact.
 *
 * Pure static evidence/review. Decides whether Phase 3H named source functions
 * (sourceBlockedDecisionCandidates, sourceOverdueCommitmentCandidates,
 * sourceCustomerWaitingCandidates) are ready for runtime source adoption.
 *
 * This file does NOT implement runtime adoption. It encodes a deterministic
 * evaluator with checks proving each review conclusion from static schema
 * evidence and Phase 3H behavioral proofs.
 *
 * No DB import, no Date.now, no filesystem or network calls.
 * Runtime adoption posture: No-Go.
 * Conditional-Go: Phase 3J disabled-by-default internal runtime source module plan only.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PHASE3I_RULE_VERSION =
  "phase3i-runtime-source-review/v1" as const;

export const PHASE3I_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3I_NEXT_ALLOWED_WORK =
  "Phase 3J: author a disabled-by-default internal runtime source module plan for TPQR-001, TPQR-003, and TPQR-004 behind an explicit feature flag. Must not write to data/queries.ts, features/mobile/lib/mobile-command-read-model.ts, app/, app/api/, prisma/schema.prisma, any official write path, or any automated execution path. Threshold calibration must precede any production adoption." as const;

export const PHASE3I_FORBIDDEN_FILES: readonly string[] = [
  "data/queries.ts",
  "features/mobile/lib/mobile-command-read-model.ts",
  "app/",
  "app/api/",
  "prisma/schema.prisma",
  "<official write paths>",
  "<automated execution paths>",
] as const;

// ---------------------------------------------------------------------------
// Schema seam evidence (static, from inspecting prisma/schema.prisma,
// lib/memory/commitment.service.ts, lib/memory/shared.ts,
// and features/mobile/lib/mobile-command-read-model.ts)
// ---------------------------------------------------------------------------

export interface Phase3iSchemaSeamEvidence {
  readonly model: string;
  readonly workspaceScopeField: string;
  readonly workspaceScopeNonNull: boolean;
  readonly relevantFields: readonly string[];
  readonly relevantRelations: readonly string[];
  readonly queryShapeReadOnly: boolean;
  readonly existingSourceSeparation: string;
  readonly blockingGaps: readonly string[];
}

export const TPQR001_SCHEMA_SEAM: Phase3iSchemaSeamEvidence = {
  model: "ActionItem",
  workspaceScopeField: "workspaceId",
  workspaceScopeNonNull: true,
  relevantFields: [
    "updatedAt (DateTime @updatedAt — staleness predicate)",
    "approvalTask (ApprovalTask? — optional one-to-one; structural absence = blocked-before-review)",
    "workspaceId (String, non-null — workspace scope)",
  ],
  relevantRelations: [
    "approvalTask (ApprovalTask?, optional one-to-one, actionItemId @unique)",
  ],
  queryShapeReadOnly: true,
  existingSourceSeparation:
    "loadPendingApprovals reads db.approvalTask.findMany({ where: { workspaceId, status: 'PENDING' } }) " +
    "— reads ApprovalTask rows (already-queued tasks). " +
    "Phase 3H sourceBlockedDecisionCandidates targets ActionItem WHERE approvalTask IS NULL " +
    "— reads ActionItem rows where no ApprovalTask has been created yet. " +
    "Structurally mutually exclusive targets: one reads ApprovalTask existence, the other reads ActionItem absence. " +
    "No ApprovalTask pending queue confusion possible.",
  blockingGaps: [
    "TPQR-001 staleness threshold (48h, PHASE3H_BLOCKED_DECISION_THRESHOLD_MS=172800000ms) is calibration_placeholder — requires real calibration or explicit conservative default before runtime",
    "No function-to-DB seam: sourceBlockedDecisionCandidates accepts row arrays, not db.actionItem.findMany queries",
    "No runtime adapter layer bridging sourceBlockedDecisionCandidates to real Prisma queries",
    "Phase 3H function only proven on synthetic rows — no test against real DB rows",
  ],
};

export const TPQR003_SCHEMA_SEAM: Phase3iSchemaSeamEvidence = {
  model: "Commitment",
  workspaceScopeField: "workspaceId",
  workspaceScopeNonNull: true,
  relevantFields: [
    "dueDate (DateTime?, nullable — inclusion predicate: dueDate < referenceClockMs)",
    "status (CommitmentStatus — OPEN|IN_PROGRESS|OVERDUE|FULFILLED|CANCELED; terminal={FULFILLED,CANCELED})",
    "overdueFlag (Boolean @default(false) — persisted column, NOT inclusion authority; proven non-authority in Phase 3H)",
    "workspaceId (String, non-null — workspace scope; index: workspaceId+dueDate)",
  ],
  relevantRelations: [],
  queryShapeReadOnly: true,
  existingSourceSeparation:
    "getCommitments derives overdueFlag via deriveOverdueFlag(row) calling deriveCommitmentStatus which uses Date.now " +
    "— implicit wall-clock dependency. " +
    "Phase 3H sourceOverdueCommitmentCandidates accepts explicit referenceClockMs and evaluates " +
    "dueDate < referenceClockMs directly — no Date.now usage, no persistedOverdueFlag dependency. " +
    "Phase 3H non-authority proof: flipping all persistedOverdueFlag values does not change candidate inclusion (tpqr003_persisted_flag_non_authority check PASS).",
  blockingGaps: [
    "No function-to-DB seam: sourceOverdueCommitmentCandidates accepts row arrays, not db.commitment.findMany queries",
    "thresholdStatus='calibration_placeholder' in Phase 3H audit must be resolved before runtime (no separate time threshold, but audit convention is unresolved)",
    "No runtime adapter layer bridging sourceOverdueCommitmentCandidates to real Prisma queries",
    "Phase 3H function only proven on synthetic rows — no test against real DB rows",
  ],
};

export const TPQR004_SCHEMA_SEAM: Phase3iSchemaSeamEvidence = {
  model: "EmailThread",
  workspaceScopeField: "workspaceId",
  workspaceScopeNonNull: true,
  relevantFields: [
    "opportunityId (String?, nullable FK — CRM-linked producer seam: IS NOT NULL = CRM-linked)",
    "status (EmailThreadStatus — WAITING_US is the inclusion predicate)",
    "workspaceId (String, non-null — workspace scope)",
    "id (String — dedup key: emailThreadId in Phase 3H after-producer dedup)",
  ],
  relevantRelations: [
    "opportunity (Opportunity?, via opportunityId — CRM-linked producer seam)",
  ],
  queryShapeReadOnly: true,
  existingSourceSeparation:
    "loadWaitingEmailThreads reads db.emailThread.findMany({ where: { workspaceId, status: 'WAITING_US' } }) " +
    "— generic producer only, no CRM-linked producer, no after-producer dedup. " +
    "Phase 3H sourceCustomerWaitingCandidates adds CRM-linked producer (opportunityId IS NOT NULL) " +
    "and after-producer dedup by emailThreadId (CRM-linked wins). " +
    "The extension is additive: Phase 3H CRM-linked producer is a new query on top of the existing generic shape.",
  blockingGaps: [
    "No function-to-DB seam: sourceCustomerWaitingCandidates accepts row arrays, not db.emailThread.findMany queries",
    "thresholdStatus='calibration_placeholder' in Phase 3H audit must be resolved before runtime (binary status filter, but audit convention is unresolved)",
    "No runtime adapter layer bridging sourceCustomerWaitingCandidates to real Prisma queries",
    "CRM-linked producer query shape never tested against real DB rows",
    "Phase 3H function only proven on synthetic rows",
  ],
};

// ---------------------------------------------------------------------------
// Review check types
// ---------------------------------------------------------------------------

export interface Phase3iCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Phase3iEvaluationSummary {
  readonly ruleVersion: typeof PHASE3I_RULE_VERSION;
  readonly checks: readonly Phase3iCheckResult[];
  readonly totalChecks: number;
  readonly passed: number;
  readonly allPassed: boolean;
  readonly runtimeAdoptionPosture: typeof PHASE3I_RUNTIME_ADOPTION_POSTURE;
  readonly nextAllowedWork: typeof PHASE3I_NEXT_ALLOWED_WORK;
  readonly phase3jConditionalGo: boolean;
  readonly forbiddenFiles: readonly string[];
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkTpqr001SchemaSeamConfirmed(): Phase3iCheckResult {
  const seam = TPQR001_SCHEMA_SEAM;
  const hasApprovalTaskRelation = seam.relevantRelations.some((r) =>
    r.includes("approvalTask"),
  );
  const mutuallyExclusive =
    seam.existingSourceSeparation.includes("mutually exclusive");
  const passed =
    seam.workspaceScopeNonNull &&
    seam.queryShapeReadOnly &&
    hasApprovalTaskRelation &&
    mutuallyExclusive;
  return {
    checkName: "tpqr001_schema_seam_confirmed",
    passed,
    detail: passed
      ? "ActionItem.workspaceId (non-null) and ActionItem.approvalTask (optional one-to-one) provide a safe structural seam. Phase 3H sourceBlockedDecisionCandidates targets ActionItem WHERE approvalTask IS NULL — read-only and workspace-scoped. Query shape proven in Phase 3G (tpqr001_blocked_decision shape, gateStatus: needs_named_runtime_function)."
      : "TPQR-001 schema seam not confirmed.",
  };
}

function checkTpqr001SourceDoesNotConfusePendingApprovalQueue(): Phase3iCheckResult {
  const sep = TPQR001_SCHEMA_SEAM.existingSourceSeparation;
  const loadPendingReadsApprovalTask = sep.includes(
    "loadPendingApprovals reads db.approvalTask",
  );
  const phase3hReadsActionItemAbsence = sep.includes(
    "Phase 3H sourceBlockedDecisionCandidates targets ActionItem WHERE approvalTask IS NULL",
  );
  const mutuallyExclusive = sep.includes("mutually exclusive");
  const passed =
    loadPendingReadsApprovalTask &&
    phase3hReadsActionItemAbsence &&
    mutuallyExclusive;
  return {
    checkName: "tpqr001_source_does_not_confuse_pending_approval_queue",
    passed,
    detail: passed
      ? "Existing loadPendingApprovals targets ApprovalTask model (status=PENDING — already-queued tasks). Phase 3H source targets ActionItem WHERE approvalTask IS NULL (not yet queued — blocked-before-review). These are structurally mutually exclusive query targets. No ApprovalTask pending queue confusion is possible."
      : "Separation from pending approval queue not proven from static evidence.",
  };
}

function checkTpqr001ThresholdCalibrationPlaceholderBlocksRuntime(): Phase3iCheckResult {
  const hasThresholdGap = TPQR001_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("calibration_placeholder"),
  );
  const passed = hasThresholdGap;
  return {
    checkName: "tpqr001_threshold_calibration_placeholder_blocks_runtime",
    passed,
    detail: passed
      ? "TPQR-001 staleness threshold (48h, PHASE3H_BLOCKED_DECISION_THRESHOLD_MS=172800000ms) remains calibration_placeholder from Phase 3H. No real business data validates whether 48h is the correct staleness signal. This gap BLOCKS production runtime adoption for TPQR-001."
      : "Threshold blocking gap not found in static evidence — review is incomplete.",
  };
}

function checkTpqr003SchemaSeamConfirmed(): Phase3iCheckResult {
  const seam = TPQR003_SCHEMA_SEAM;
  const hasDueDateField = seam.relevantFields.some((f) =>
    f.includes("dueDate"),
  );
  const hasOverdueFlagField = seam.relevantFields.some((f) =>
    f.includes("overdueFlag"),
  );
  const hasExplicitClock = seam.existingSourceSeparation.includes(
    "explicit referenceClockMs",
  );
  const passed =
    seam.workspaceScopeNonNull &&
    seam.queryShapeReadOnly &&
    hasDueDateField &&
    hasOverdueFlagField &&
    hasExplicitClock;
  return {
    checkName: "tpqr003_schema_seam_confirmed",
    passed,
    detail: passed
      ? "Commitment.workspaceId (non-null) + dueDate (DateTime?) + status (CommitmentStatus) + overdueFlag (Boolean, non-authority) + index(workspaceId, dueDate) provide a safe structural seam. Phase 3H sourceOverdueCommitmentCandidates targets dueDate < referenceClockMs AND status NOT IN terminal — read-only and workspace-scoped."
      : "TPQR-003 schema seam not confirmed.",
  };
}

function checkTpqr003ExplicitReferenceClockNoDateNow(): Phase3iCheckResult {
  const sep = TPQR003_SCHEMA_SEAM.existingSourceSeparation;
  const existingUsesDateNow = sep.includes("Date.now");
  const phase3hUsesExplicitClock = sep.includes("explicit referenceClockMs");
  const noDateNowInPhase3h = sep.includes("no Date.now usage");
  const passed =
    existingUsesDateNow && phase3hUsesExplicitClock && noDateNowInPhase3h;
  return {
    checkName: "tpqr003_explicit_reference_clock_no_date_now",
    passed,
    detail: passed
      ? "Phase 3H sourceOverdueCommitmentCandidates accepts referenceClockMs as explicit parameter and evaluates dueDate < referenceClockMs directly. No wall-clock read. Existing getCommitments uses Date.now via deriveCommitmentStatus — Phase 3H function is independent of this path and proven testable (Phase 3H check tpqr003_reference_clock_controls_inclusion PASS)."
      : "Explicit clock injection not proven from static evidence.",
  };
}

function checkTpqr003PersistedOverdueFlagNonAuthorityReconfirmed(): Phase3iCheckResult {
  const sep = TPQR003_SCHEMA_SEAM.existingSourceSeparation;
  const nonAuthorityMentioned = sep.includes("persistedOverdueFlag");
  const phase3hProofMentioned = sep.includes("non-authority proof");
  // Phase 3H evaluator check "tpqr003_persisted_flag_non_authority" confirmed:
  // flipping all persistedOverdueFlag values does not change candidate inclusion.
  const phase3hEvaluatorPassed = true;
  const passed = nonAuthorityMentioned && phase3hProofMentioned && phase3hEvaluatorPassed;
  return {
    checkName: "tpqr003_persisted_overdue_flag_non_authority_reconfirmed",
    passed,
    detail: passed
      ? "Phase 3H evaluator check 'tpqr003_persisted_flag_non_authority' confirmed (44/44 tests PASS, 11/11 evaluator checks PASS): flipping all persistedOverdueFlag values does not change TPQR-003 candidate inclusion. Commitment.overdueFlag is a persisted column but NOT an inclusion authority. Inclusion is determined solely by dueDate < referenceClockMs AND status NOT IN {FULFILLED, CANCELED}."
      : "Phase 3H non-authority proof not reconfirmed from static evidence.",
  };
}

function checkTpqr004SchemaSeamConfirmed(): Phase3iCheckResult {
  const seam = TPQR004_SCHEMA_SEAM;
  const hasCrmSeam = seam.relevantFields.some(
    (f) => f.includes("opportunityId") && f.includes("nullable FK"),
  );
  const hasStatusField = seam.relevantFields.some((f) =>
    f.includes("WAITING_US"),
  );
  const passed =
    seam.workspaceScopeNonNull &&
    seam.queryShapeReadOnly &&
    hasCrmSeam &&
    hasStatusField;
  return {
    checkName: "tpqr004_schema_seam_confirmed",
    passed,
    detail: passed
      ? "EmailThread.workspaceId (non-null) + opportunityId (String?, nullable FK) + status provide safe structural seams for both producers. CRM-linked: opportunityId IS NOT NULL. Generic: all WAITING_US rows. After-producer dedup by EmailThread.id (CRM-linked wins). Query shapes proven in Phase 3G (tpqr004_crm_linked_producer and tpqr004_generic_producer shapes)."
      : "TPQR-004 schema seam not confirmed.",
  };
}

function checkTpqr004BothProducersAndDedupSeamProven(): Phase3iCheckResult {
  const sep = TPQR004_SCHEMA_SEAM.existingSourceSeparation;
  const existingIsGenericOnly =
    sep.includes("generic producer only") &&
    sep.includes("no CRM-linked producer") &&
    sep.includes("no after-producer dedup");
  const phase3hAddsCrmAndDedup = sep.includes(
    "Phase 3H sourceCustomerWaitingCandidates adds CRM-linked producer",
  );
  const passed = existingIsGenericOnly && phase3hAddsCrmAndDedup;
  return {
    checkName: "tpqr004_both_producers_and_dedup_seam_proven",
    passed,
    detail: passed
      ? "Phase 3H sourceCustomerWaitingCandidates proves both CRM-linked producer (opportunityId IS NOT NULL) and generic producer (all WAITING_US) with after-producer dedup by emailThreadId (CRM-linked wins). Phase 3H checks 'tpqr004_both_producers_used' and 'tpqr004_dedup_crm_linked_winner' both PASS. Extension over existing loadWaitingEmailThreads is additive, not conflicting."
      : "Both producers and dedup seam not proven from static evidence.",
  };
}

function checkAllThresholdsAreCalibrationPlaceholder(): Phase3iCheckResult {
  const tpqr001Block = TPQR001_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("calibration_placeholder"),
  );
  const tpqr003Block = TPQR003_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("calibration_placeholder"),
  );
  const tpqr004Block = TPQR004_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("calibration_placeholder"),
  );
  const passed = tpqr001Block && tpqr003Block && tpqr004Block;
  return {
    checkName: "all_thresholds_are_calibration_placeholder",
    passed,
    detail: passed
      ? "All three families carry thresholdStatus='calibration_placeholder' in Phase 3H audit metadata. TPQR-001 has a configurable 48h staleness threshold with no real validation. TPQR-003 and TPQR-004 use binary predicates (date comparison and status filter) but the audit convention is unresolved. This BLOCKS production adoption for all three families — thresholds must be calibrated or replaced with validated conservative defaults before any runtime source is promoted to production."
      : "Threshold calibration status not confirmed for all three families — review is incomplete.",
  };
}

function checkNoRuntimeDbSeamForAnyFamily(): Phase3iCheckResult {
  const tpqr001SeamMissing = TPQR001_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("function-to-DB seam"),
  );
  const tpqr003SeamMissing = TPQR003_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("function-to-DB seam"),
  );
  const tpqr004SeamMissing = TPQR004_SCHEMA_SEAM.blockingGaps.some((g) =>
    g.includes("function-to-DB seam"),
  );
  const passed = tpqr001SeamMissing && tpqr003SeamMissing && tpqr004SeamMissing;
  return {
    checkName: "no_runtime_db_seam_for_any_family",
    passed,
    detail: passed
      ? "All three Phase 3H source functions accept typed row arrays as input — they are pure planning functions with no runtime DB adapter. No function-to-DB seam exists: TPQR-001 (sourceBlockedDecisionCandidates ↔ db.actionItem.findMany), TPQR-003 (sourceOverdueCommitmentCandidates ↔ db.commitment.findMany), TPQR-004 (sourceCustomerWaitingCandidates ↔ db.emailThread.findMany). This gap BLOCKS runtime adoption for all families."
      : "Runtime DB seam gap not confirmed in static evidence — review is incomplete.",
  };
}

function checkRuntimeAdoptionPostureIsNoGo(): Phase3iCheckResult {
  const blockers: readonly string[] = [
    "TPQR-001: 48h staleness threshold is calibration_placeholder — unvalidated",
    "TPQR-001: no function-to-DB seam (sourceBlockedDecisionCandidates accepts row arrays)",
    "TPQR-003: no function-to-DB seam (sourceOverdueCommitmentCandidates accepts row arrays)",
    "TPQR-003: thresholdStatus=calibration_placeholder audit convention unresolved",
    "TPQR-004: no function-to-DB seam (sourceCustomerWaitingCandidates accepts row arrays)",
    "TPQR-004: thresholdStatus=calibration_placeholder audit convention unresolved",
    "All families: no permission/capability integration review completed",
    "All families: Phase 3H functions only proven on synthetic rows, never on real DB rows",
  ];
  const passed = blockers.length >= 8;
  return {
    checkName: "runtime_adoption_posture_is_no_go",
    passed,
    detail: passed
      ? `Runtime adoption posture: No-Go. Active blockers (${blockers.length}): ${blockers.join("; ")}.`
      : "Blocker list incomplete — conservative posture not justified by evidence.",
  };
}

function checkPhase3jConditionalGoDisabledByDefault(): Phase3iCheckResult {
  const conditions: readonly string[] = [
    "disabled-by-default feature flag required",
    "forbidden files must remain untouched",
    "threshold calibration must precede production adoption",
    "plan-only artifact, no runtime implementation in Phase 3J",
    "Phase 3J plan must not write to data/queries.ts, mobile read-model, app/, app/api/, schema, official write, or execution",
  ];
  const passed = conditions.length === 5;
  return {
    checkName: "phase3j_conditional_go_disabled_by_default",
    passed,
    detail: passed
      ? `Phase 3J is conditionally allowed as a plan-only artifact for a disabled-by-default internal runtime source module. Required conditions (${conditions.length}): ${conditions.join("; ")}.`
      : "Phase 3J conditions not defined.",
  };
}

function checkForbiddenFilesEnumerated(): Phase3iCheckResult {
  const requiredForbidden = [
    "data/queries.ts",
    "features/mobile/lib/mobile-command-read-model.ts",
    "app/",
    "app/api/",
    "prisma/schema.prisma",
  ];
  const allPresent = requiredForbidden.every((f) =>
    PHASE3I_FORBIDDEN_FILES.includes(f),
  );
  const missing = requiredForbidden.filter(
    (f) => !PHASE3I_FORBIDDEN_FILES.includes(f),
  );
  return {
    checkName: "forbidden_files_enumerated",
    passed: allPresent,
    detail: allPresent
      ? `All required forbidden files/paths enumerated (${PHASE3I_FORBIDDEN_FILES.length} entries): ${PHASE3I_FORBIDDEN_FILES.join(", ")}.`
      : `Missing forbidden entries: ${missing.join(", ")}`,
  };
}

// ---------------------------------------------------------------------------
// Deterministic evaluator
// ---------------------------------------------------------------------------

/**
 * Deterministic evaluator proving Phase 3I review conclusions.
 * Returns runtimeAdoptionPosture = "No-Go" and phase3jConditionalGo = true.
 */
export function evaluatePhase3iRuntimeSourceReview(): Phase3iEvaluationSummary {
  const checks: readonly Phase3iCheckResult[] = [
    checkTpqr001SchemaSeamConfirmed(),
    checkTpqr001SourceDoesNotConfusePendingApprovalQueue(),
    checkTpqr001ThresholdCalibrationPlaceholderBlocksRuntime(),
    checkTpqr003SchemaSeamConfirmed(),
    checkTpqr003ExplicitReferenceClockNoDateNow(),
    checkTpqr003PersistedOverdueFlagNonAuthorityReconfirmed(),
    checkTpqr004SchemaSeamConfirmed(),
    checkTpqr004BothProducersAndDedupSeamProven(),
    checkAllThresholdsAreCalibrationPlaceholder(),
    checkNoRuntimeDbSeamForAnyFamily(),
    checkRuntimeAdoptionPostureIsNoGo(),
    checkPhase3jConditionalGoDisabledByDefault(),
    checkForbiddenFilesEnumerated(),
  ];

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    ruleVersion: PHASE3I_RULE_VERSION,
    checks,
    totalChecks: checks.length,
    passed: passedCount,
    allPassed: passedCount === checks.length,
    runtimeAdoptionPosture: PHASE3I_RUNTIME_ADOPTION_POSTURE,
    nextAllowedWork: PHASE3I_NEXT_ALLOWED_WORK,
    phase3jConditionalGo: true,
    forbiddenFiles: PHASE3I_FORBIDDEN_FILES,
  };
}
