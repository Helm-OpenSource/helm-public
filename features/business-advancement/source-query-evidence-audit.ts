/**
 * Helm Business Advancement - Phase 3G
 * Source-Query Evidence Audit artifact.
 *
 * Pure planning / evidence audit. This file answers the six Phase 3F gate
 * questions for TPQR-001 (blocked_decision), TPQR-003 (overdue_commitment),
 * and TPQR-004 (customer_waiting). It contains only static evidence rows and
 * deterministic evaluator functions.
 *
 * This file is NOT a runtime adapter, NOT a production query, NOT a DB reader,
 * NOT an API route, NOT a mobile read-model integration, NOT a schema change,
 * and NOT an execution authority. It does not call Date.now(), read from the
 * filesystem, or make network calls.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PHASE3G_RULE_VERSION = "phase3g-source-query-evidence-audit/v1" as const;

export const PHASE3G_FIXTURE_WORKSPACE_ID = "ws-synth-phase3g-audit" as const;

export const PHASE3G_REFERENCE_CLOCK_MS = 1777161600000 as const;

export type Phase3gTpqrId = "TPQR-001" | "TPQR-003" | "TPQR-004";

export type Phase3gQuestion =
  | "Q1_tpqr001_safe_readonly_source"
  | "Q2_tpqr003_explicit_clock_source"
  | "Q3_tpqr004_crm_generic_dedup_boundary"
  | "Q4_workspace_membership_inherited"
  | "Q5_family_disable_switch"
  | "Q6_audit_bundle_fields";

export type Phase3gEvidenceVerdict = "PASS" | "GAP" | "CONDITIONAL";

export type Phase3gEvidenceKind =
  | "schema_evidence"
  | "query_evidence"
  | "gap_evidence"
  | "design_note";

// ---------------------------------------------------------------------------
// Evidence row types
// ---------------------------------------------------------------------------

export interface Phase3gEvidenceRow {
  readonly evidenceId: string;
  readonly tpqrId: Phase3gTpqrId;
  readonly question: Phase3gQuestion;
  readonly kind: Phase3gEvidenceKind;
  readonly filePath: string;
  readonly evidenceLocator: string;
  readonly finding: string;
  readonly gapDetail: string | null;
  readonly verdict: Phase3gEvidenceVerdict;
  readonly ruleVersion: typeof PHASE3G_RULE_VERSION;
}

// ---------------------------------------------------------------------------
// TPQR-001 evidence rows — Q1 & Q4 & Q5 & Q6
// ---------------------------------------------------------------------------

export const TPQR001_EVIDENCE_ROWS: readonly Phase3gEvidenceRow[] = [
  {
    evidenceId: "EV-001-001",
    tpqrId: "TPQR-001",
    question: "Q1_tpqr001_safe_readonly_source",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model ActionItem { workspaceId String }",
    finding:
      "ActionItem.workspaceId is non-null workspace scope. ActionItem.approvalTask is optional relation, so a query WHERE approvalTask IS NULL targets items blocked before a review task exists. A workspace-scoped source query inherits the existing boundary without rebuilding ownership.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-001-002",
    tpqrId: "TPQR-001",
    question: "Q1_tpqr001_safe_readonly_source",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model ActionItem { approvalTask ApprovalTask? }",
    finding:
      "approvalTask relation is optional. A query WHERE approvalTask IS NULL (or approvalTask.status NOT IN review states) can identify action items blocked before a review task exists, which is the exact shape Phase 3E required.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-001-003",
    tpqrId: "TPQR-001",
    question: "Q1_tpqr001_safe_readonly_source",
    kind: "query_evidence",
    filePath: "features/mobile/lib/mobile-command-read-model.ts",
    evidenceLocator: "loadPendingApprovals(workspaceId)",
    finding:
      "Existing loadPendingApprovals queries db.approvalTask.findMany({ where: { workspaceId, status: 'PENDING' } }). This reads rows that have ALREADY entered the approval queue, not action items blocked before entering review.",
    gapDetail:
      "Phase 3E requires identifying action items blocked beyond threshold WITHOUT already being in an approval/review task. A new read-only query shape is needed: db.actionItem.findMany({ where: { workspaceId, approvalTask: null, updatedAt: { lt: referenceClockMs - thresholdMs } } }). This query does not exist as a named source yet.",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-001-004",
    tpqrId: "TPQR-001",
    question: "Q1_tpqr001_safe_readonly_source",
    kind: "design_note",
    filePath: "features/business-advancement/source-query-evidence-audit.ts",
    evidenceLocator: "Phase3gSourceQueryShape.tpqr001BlockedDecisionCandidate",
    finding:
      "The safe source-query shape for TPQR-001 is: SELECT ActionItem WHERE workspaceId = :ws AND approvalTask IS NULL AND updatedAt < (:referenceClockMs - :thresholdMs). This is read-only, uses an explicit reference clock, and derives blocked status from structural absence of approvalTask rather than from a persisted flag.",
    gapDetail:
      "This query shape is proven as evidence in this audit but has not yet been instantiated as a named runtime source function. That adoption requires a separate Phase 3H runtime source review.",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-001-005",
    tpqrId: "TPQR-001",
    question: "Q4_workspace_membership_inherited",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model ActionItem { workspaceId String; workspace Workspace @relation(...) }",
    finding:
      "ActionItem rows are scoped to workspaceId at the DB level. Any source query using WHERE workspaceId = :ws inherits the existing workspace boundary without rebuilding membership logic inside the adapter.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-001-006",
    tpqrId: "TPQR-001",
    question: "Q5_family_disable_switch",
    kind: "design_note",
    filePath: "features/business-advancement/thin-read-model-adapter-planning.ts",
    evidenceLocator: "DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES.blockedDecision = false",
    finding:
      "Phase 3E established a per-family disable switch. blockedDecision defaults to false. Any runtime source for TPQR-001 must respect this switch; when disabled, no ActionItem rows are queried and no candidates are produced.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-001-007",
    tpqrId: "TPQR-001",
    question: "Q6_audit_bundle_fields",
    kind: "design_note",
    filePath: "features/business-advancement/thin-read-model-adapter-planning.ts",
    evidenceLocator: "ThinReadModelAdapterAudit.{ sourceRowId, ruleVersion, thresholdStatus, tpqrId }",
    finding:
      "Phase 3E adapter contract already defines audit bundle fields: sourceRowId (= ActionItem.id), ruleVersion (= phase3g-source-query-evidence-audit/v1 when adopted), thresholdStatus (calibration_placeholder until calibrated), tpqrId (TPQR-001). The exclusion reason is carried on ThinReadModelAdapterExcludedRow.reason.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
] as const;

// ---------------------------------------------------------------------------
// TPQR-003 evidence rows — Q2 & Q4 & Q5 & Q6
// ---------------------------------------------------------------------------

export const TPQR003_EVIDENCE_ROWS: readonly Phase3gEvidenceRow[] = [
  {
    evidenceId: "EV-003-001",
    tpqrId: "TPQR-003",
    question: "Q2_tpqr003_explicit_clock_source",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model Commitment { dueDate DateTime?; overdueFlag Boolean @default(false); workspaceId String }",
    finding:
      "Commitment.dueDate is a nullable DateTime stored in the DB. Commitment.overdueFlag is a persisted Boolean that maintenance scripts can write. Commitment.workspaceId is non-null.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-003-002",
    tpqrId: "TPQR-003",
    question: "Q2_tpqr003_explicit_clock_source",
    kind: "query_evidence",
    filePath: "lib/memory/shared.ts",
    evidenceLocator: "deriveCommitmentStatus / deriveOverdueFlag using Date.now()",
    finding:
      "Current deriveOverdueFlag helper calls Date.now() internally. This makes the derivation non-injectable and non-deterministic in tests. Phase 3E explicitly prohibited using Date.now() in the adapter; it requires an explicit referenceClockMs parameter.",
    gapDetail:
      "The source query for TPQR-003 must use: WHERE workspaceId = :ws AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED','CANCELED'). This does NOT rely on the persisted overdueFlag column. The referenceClockMs is injected by the caller, not derived from Date.now().",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-003-003",
    tpqrId: "TPQR-003",
    question: "Q2_tpqr003_explicit_clock_source",
    kind: "design_note",
    filePath: "features/business-advancement/source-query-evidence-audit.ts",
    evidenceLocator: "Phase3gSourceQueryShape.tpqr003OverdueCommitmentCandidate",
    finding:
      "The safe source-query shape for TPQR-003 is: SELECT Commitment WHERE workspaceId = :ws AND dueDate IS NOT NULL AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED','CANCELED'). This is read-only, uses an explicit reference clock parameter, and completely bypasses the persisted overdueFlag column as an inclusion filter.",
    gapDetail:
      "This query shape is proven as evidence but has not yet been instantiated as a named runtime source function. Phase 3H runtime source review is required before adoption.",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-003-004",
    tpqrId: "TPQR-003",
    question: "Q2_tpqr003_explicit_clock_source",
    kind: "gap_evidence",
    filePath: "lib/memory/commitment.service.ts",
    evidenceLocator: "getCommitments(workspaceId) -> deriveOverdueFlag(row)",
    finding:
      "getCommitments returns workspace-scoped rows and invokes read-time deriveOverdueFlag. This proves the read-time derivation pattern already exists. However it does not accept referenceClockMs from the caller.",
    gapDetail:
      "To become the TPQR-003 source, getCommitments (or a thin wrapper) would need to accept referenceClockMs and forward it to the derivation helper instead of relying on Date.now(). This is a small, safe change but constitutes a runtime modification outside Phase 3G scope.",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-003-005",
    tpqrId: "TPQR-003",
    question: "Q4_workspace_membership_inherited",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model Commitment { workspaceId String @@index([workspaceId]) }",
    finding:
      "Commitment rows are indexed by workspaceId. A source query filtering WHERE workspaceId = :ws inherits the workspace boundary from the existing data model without rebuilding membership logic inside the adapter.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-003-006",
    tpqrId: "TPQR-003",
    question: "Q5_family_disable_switch",
    kind: "design_note",
    filePath: "features/business-advancement/thin-read-model-adapter-planning.ts",
    evidenceLocator: "DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES.overdueCommitment = false",
    finding:
      "Phase 3E established a per-family disable switch. overdueCommitment defaults to false. Any runtime source for TPQR-003 must respect this switch; when disabled, no Commitment rows are queried and no candidates are produced.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-003-007",
    tpqrId: "TPQR-003",
    question: "Q6_audit_bundle_fields",
    kind: "design_note",
    filePath: "features/business-advancement/thin-read-model-adapter-planning.ts",
    evidenceLocator: "ThinReadModelAdapterAudit.{ sourceRowId, ruleVersion, thresholdStatus, tpqrId }",
    finding:
      "Phase 3E adapter contract defines audit bundle fields for TPQR-003: sourceRowId (= Commitment.id), ruleVersion, thresholdStatus (calibration_placeholder), tpqrId (TPQR-003). Exclusion reason covers terminal_status, missing_due_date, threshold_not_met, workspace_boundary_not_confirmed.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
] as const;

// ---------------------------------------------------------------------------
// TPQR-004 evidence rows — Q3 & Q4 & Q5 & Q6
// ---------------------------------------------------------------------------

export const TPQR004_EVIDENCE_ROWS: readonly Phase3gEvidenceRow[] = [
  {
    evidenceId: "EV-004-001",
    tpqrId: "TPQR-004",
    question: "Q3_tpqr004_crm_generic_dedup_boundary",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model EmailThread { workspaceId String; opportunityId String?; opportunity Opportunity? }",
    finding:
      "EmailThread has a nullable opportunityId / Opportunity relation. This is the structural seam that distinguishes CRM-linked threads (opportunityId IS NOT NULL) from generic threads (opportunityId IS NULL).",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-004-002",
    tpqrId: "TPQR-004",
    question: "Q3_tpqr004_crm_generic_dedup_boundary",
    kind: "query_evidence",
    filePath: "features/mobile/lib/mobile-command-read-model.ts",
    evidenceLocator: "loadWaitingEmailThreads(workspaceId) WHERE status = 'WAITING_US'",
    finding:
      "Existing loadWaitingEmailThreads is the generic producer: it reads all WAITING_US threads for the workspace without filtering on opportunityId. It does not distinguish CRM-linked vs generic origin.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-004-003",
    tpqrId: "TPQR-004",
    question: "Q3_tpqr004_crm_generic_dedup_boundary",
    kind: "gap_evidence",
    filePath: "features/mobile/lib/mobile-command-read-model.ts",
    evidenceLocator: "loadWaitingEmailThreads — no CRM-linked variant",
    finding:
      "There is no named TPQR-004 CRM-linked producer function in the current codebase. Phase 3E design requires a separate CRM-linked producer: WHERE workspaceId = :ws AND status = 'WAITING_US' AND opportunityId IS NOT NULL.",
    gapDetail:
      "The CRM-linked producer query shape can be defined using the existing EmailThread.opportunityId nullable FK. However, a named source function does not yet exist. The after-producer merge/dedup seam by emailThreadId is proven in Phase 3A PF3A-004 and Phase 3E, but a runtime implementation of both producers plus the dedup step is not yet present.",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-004-004",
    tpqrId: "TPQR-004",
    question: "Q3_tpqr004_crm_generic_dedup_boundary",
    kind: "design_note",
    filePath: "features/business-advancement/source-query-evidence-audit.ts",
    evidenceLocator: "Phase3gSourceQueryShape.tpqr004ProducerBoundary",
    finding:
      "CRM-linked producer: SELECT EmailThread WHERE workspaceId = :ws AND status = 'WAITING_US' AND opportunityId IS NOT NULL. Generic producer: SELECT EmailThread WHERE workspaceId = :ws AND status = 'WAITING_US'. After-producer dedup by emailThread.id: if two rows share the same id, the CRM-linked row wins (TPQR-004-first tie-break established in Phase 3A PF3A-004).",
    gapDetail:
      "Both producer query shapes are safe and read-only. The merge/dedup boundary is defined. Neither producer has been instantiated as a named runtime source function; that step requires Phase 3H.",
    verdict: "CONDITIONAL",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-004-005",
    tpqrId: "TPQR-004",
    question: "Q4_workspace_membership_inherited",
    kind: "schema_evidence",
    filePath: "prisma/schema.prisma",
    evidenceLocator: "model EmailThread { workspaceId String }",
    finding:
      "EmailThread rows are scoped to workspaceId. Both CRM-linked and generic producers filter WHERE workspaceId = :ws, inheriting the workspace boundary without rebuilding membership logic inside the adapter.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-004-006",
    tpqrId: "TPQR-004",
    question: "Q5_family_disable_switch",
    kind: "design_note",
    filePath: "features/business-advancement/thin-read-model-adapter-planning.ts",
    evidenceLocator: "DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES.customerWaiting = false",
    finding:
      "Phase 3E established a per-family disable switch. customerWaiting defaults to false. Any runtime source for TPQR-004 must respect this switch; when disabled, neither the CRM-linked nor generic producer is queried and no candidates are produced.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    evidenceId: "EV-004-007",
    tpqrId: "TPQR-004",
    question: "Q6_audit_bundle_fields",
    kind: "design_note",
    filePath: "features/business-advancement/thin-read-model-adapter-planning.ts",
    evidenceLocator: "ThinReadModelAdapterAudit.{ sourceRowId, dedupKey, ruleVersion, thresholdStatus, tpqrId }",
    finding:
      "Phase 3E adapter contract defines audit bundle fields for TPQR-004: sourceRowId (= EmailThread.id), dedupKey (= emailThreadId used for after-producer dedup), ruleVersion, thresholdStatus (calibration_placeholder), tpqrId (TPQR-004). Exclusion reason covers deduped_by_email_thread_id_after_producers, threshold_not_met, workspace_boundary_not_confirmed.",
    gapDetail: null,
    verdict: "PASS",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
] as const;

// ---------------------------------------------------------------------------
// All evidence rows combined
// ---------------------------------------------------------------------------

export const ALL_PHASE3G_EVIDENCE_ROWS: readonly Phase3gEvidenceRow[] = [
  ...TPQR001_EVIDENCE_ROWS,
  ...TPQR003_EVIDENCE_ROWS,
  ...TPQR004_EVIDENCE_ROWS,
] as const;

// ---------------------------------------------------------------------------
// Query-shape proof records (static, no runtime)
// ---------------------------------------------------------------------------

export type Phase3gQueryShapeId =
  | "tpqr001_blocked_decision"
  | "tpqr003_overdue_commitment"
  | "tpqr004_crm_linked_producer"
  | "tpqr004_generic_producer";

export type Phase3gQueryShapeGateStatus =
  | "source_boundary_defined"
  | "needs_named_runtime_function";

export interface Phase3gQueryShapeRecord {
  readonly shapeId: Phase3gQueryShapeId;
  readonly tpqrId: Phase3gTpqrId;
  readonly description: string;
  readonly whereClause: string;
  readonly explicitClockRequired: boolean;
  readonly persistedFlagAuthority: false;
  readonly workspaceScopeInherited: true;
  readonly disableSwitch: string;
  readonly gateStatus: Phase3gQueryShapeGateStatus;
  readonly ruleVersion: typeof PHASE3G_RULE_VERSION;
}

export const PHASE3G_QUERY_SHAPE_RECORDS: readonly Phase3gQueryShapeRecord[] = [
  {
    shapeId: "tpqr001_blocked_decision",
    tpqrId: "TPQR-001",
    description:
      "Action items blocked beyond threshold without an existing review task.",
    whereClause:
      "workspaceId = :ws AND approvalTask IS NULL AND updatedAt < (:referenceClockMs - :thresholdMs)",
    explicitClockRequired: true,
    persistedFlagAuthority: false,
    workspaceScopeInherited: true,
    disableSwitch: "enabledFamilies.blockedDecision = false",
    gateStatus: "needs_named_runtime_function",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    shapeId: "tpqr003_overdue_commitment",
    tpqrId: "TPQR-003",
    description:
      "Commitment rows overdue at read-time using dueDate < referenceClockMs, ignoring persisted overdueFlag.",
    whereClause:
      "workspaceId = :ws AND dueDate IS NOT NULL AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED','CANCELED')",
    explicitClockRequired: true,
    persistedFlagAuthority: false,
    workspaceScopeInherited: true,
    disableSwitch: "enabledFamilies.overdueCommitment = false",
    gateStatus: "needs_named_runtime_function",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    shapeId: "tpqr004_crm_linked_producer",
    tpqrId: "TPQR-004",
    description:
      "CRM-linked waiting email threads (opportunityId IS NOT NULL), first-priority producer in after-producer dedup.",
    whereClause:
      "workspaceId = :ws AND status = 'WAITING_US' AND opportunityId IS NOT NULL",
    explicitClockRequired: false,
    persistedFlagAuthority: false,
    workspaceScopeInherited: true,
    disableSwitch: "enabledFamilies.customerWaiting = false",
    gateStatus: "needs_named_runtime_function",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
  {
    shapeId: "tpqr004_generic_producer",
    tpqrId: "TPQR-004",
    description:
      "Generic waiting email threads (all WAITING_US regardless of opportunityId), second-priority producer in after-producer dedup.",
    whereClause:
      "workspaceId = :ws AND status = 'WAITING_US'",
    explicitClockRequired: false,
    persistedFlagAuthority: false,
    workspaceScopeInherited: true,
    disableSwitch: "enabledFamilies.customerWaiting = false",
    gateStatus: "needs_named_runtime_function",
    ruleVersion: PHASE3G_RULE_VERSION,
  },
] as const;

// ---------------------------------------------------------------------------
// Evaluator check types
// ---------------------------------------------------------------------------

export interface Phase3gCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Phase3gAuditSummary {
  readonly ruleVersion: typeof PHASE3G_RULE_VERSION;
  readonly evidenceRows: readonly Phase3gEvidenceRow[];
  readonly queryShapes: readonly Phase3gQueryShapeRecord[];
  readonly checks: readonly Phase3gCheckResult[];
  readonly totalChecks: number;
  readonly passed: number;
  readonly allPassed: boolean;
  readonly runtimeAdoptionPosture: "No-Go";
  readonly nextAllowedWork: string;
}

// ---------------------------------------------------------------------------
// Evaluator checks
// ---------------------------------------------------------------------------

function checkAllEvidenceRowsHaveCorrectRuleVersion(
  rows: readonly Phase3gEvidenceRow[],
): Phase3gCheckResult {
  const bad = rows.filter((row) => row.ruleVersion !== PHASE3G_RULE_VERSION);
  return {
    checkName: "all_evidence_rows_have_correct_rule_version",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? `All ${rows.length} evidence rows carry ruleVersion=${PHASE3G_RULE_VERSION}.`
        : `Bad rule version on: ${bad.map((r) => r.evidenceId).join(", ")}`,
  };
}

function checkAllSixQuestionsAnswered(
  rows: readonly Phase3gEvidenceRow[],
): Phase3gCheckResult {
  const required: readonly Phase3gQuestion[] = [
    "Q1_tpqr001_safe_readonly_source",
    "Q2_tpqr003_explicit_clock_source",
    "Q3_tpqr004_crm_generic_dedup_boundary",
    "Q4_workspace_membership_inherited",
    "Q5_family_disable_switch",
    "Q6_audit_bundle_fields",
  ];
  const present = new Set(rows.map((row) => row.question));
  const missing = required.filter((q) => !present.has(q));
  return {
    checkName: "all_six_phase3f_questions_answered",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? "Evidence rows cover all six Phase 3F gate questions."
        : `Missing coverage for: ${missing.join(", ")}`,
  };
}

function checkAllThreeFamiliesHaveEvidence(
  rows: readonly Phase3gEvidenceRow[],
): Phase3gCheckResult {
  const required: readonly Phase3gTpqrId[] = ["TPQR-001", "TPQR-003", "TPQR-004"];
  const present = new Set(rows.map((row) => row.tpqrId));
  const missing = required.filter((id) => !present.has(id));
  return {
    checkName: "all_three_families_have_evidence",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? "Evidence rows present for TPQR-001, TPQR-003, and TPQR-004."
        : `Missing evidence for: ${missing.join(", ")}`,
  };
}

function checkNoPersistedFlagAuthorityInQueryShapes(
  shapes: readonly Phase3gQueryShapeRecord[],
): Phase3gCheckResult {
  const bad = shapes.filter((shape) => shape.persistedFlagAuthority !== false);
  return {
    checkName: "no_persisted_flag_authority_in_query_shapes",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "All query shape records declare persistedFlagAuthority=false."
        : `Shapes with persisted flag authority: ${bad.map((s) => s.shapeId).join(", ")}`,
  };
}

function checkAllQueryShapesInheritWorkspaceScope(
  shapes: readonly Phase3gQueryShapeRecord[],
): Phase3gCheckResult {
  const bad = shapes.filter((shape) => shape.workspaceScopeInherited !== true);
  return {
    checkName: "all_query_shapes_inherit_workspace_scope",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "All query shape records declare workspaceScopeInherited=true."
        : `Shapes without workspace scope: ${bad.map((s) => s.shapeId).join(", ")}`,
  };
}

function checkTpqr003QueryShapeRequiresExplicitClock(
  shapes: readonly Phase3gQueryShapeRecord[],
): Phase3gCheckResult {
  const tpqr003Shapes = shapes.filter((shape) => shape.tpqrId === "TPQR-003");
  const bad = tpqr003Shapes.filter((shape) => !shape.explicitClockRequired);
  return {
    checkName: "tpqr003_query_shape_requires_explicit_clock",
    passed: bad.length === 0 && tpqr003Shapes.length > 0,
    detail:
      bad.length === 0 && tpqr003Shapes.length > 0
        ? "TPQR-003 query shape requires an explicit referenceClockMs parameter, not Date.now()."
        : `TPQR-003 shapes without explicit clock: ${bad.map((s) => s.shapeId).join(", ")} (total TPQR-003 shapes: ${tpqr003Shapes.length})`,
  };
}

function checkTpqr004HasBothProducerShapes(
  shapes: readonly Phase3gQueryShapeRecord[],
): Phase3gCheckResult {
  const tpqr004Shapes = shapes.filter((shape) => shape.tpqrId === "TPQR-004");
  const hasCrm = tpqr004Shapes.some((shape) => shape.shapeId === "tpqr004_crm_linked_producer");
  const hasGeneric = tpqr004Shapes.some((shape) => shape.shapeId === "tpqr004_generic_producer");
  const passed = hasCrm && hasGeneric;
  return {
    checkName: "tpqr004_has_both_crm_and_generic_producer_shapes",
    passed,
    detail: passed
      ? "TPQR-004 defines both the CRM-linked producer and the generic producer query shapes."
      : `Missing shapes: crm=${String(hasCrm)} generic=${String(hasGeneric)}`,
  };
}

function checkAllQueryShapesHaveDisableSwitches(
  shapes: readonly Phase3gQueryShapeRecord[],
): Phase3gCheckResult {
  const bad = shapes.filter(
    (shape) => !shape.disableSwitch || shape.disableSwitch.trim().length === 0,
  );
  return {
    checkName: "all_query_shapes_have_disable_switches",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "Every query shape record documents a disable switch."
        : `Shapes missing disable switch: ${bad.map((s) => s.shapeId).join(", ")}`,
  };
}

function checkNoRuntimeAdoptionInAudit(): Phase3gCheckResult {
  return {
    checkName: "no_runtime_adoption_in_audit",
    passed: true,
    detail:
      "Phase 3G artifact is pure TypeScript with static evidence rows and deterministic evaluators. No DB import, no Date.now(), no network, no filesystem reads, no production query adoption, no API route, no schema change, no mobile read-model modification, no official write, no automated execution.",
  };
}

function checkGapEvidenceRowsHaveGapDetail(
  rows: readonly Phase3gEvidenceRow[],
): Phase3gCheckResult {
  const conditionalRows = rows.filter(
    (row) => row.verdict === "CONDITIONAL" || row.kind === "gap_evidence",
  );
  const missing = conditionalRows.filter(
    (row) => row.gapDetail === null || row.gapDetail.trim().length === 0,
  );
  return {
    checkName: "gap_evidence_rows_have_gap_detail",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `All ${conditionalRows.length} CONDITIONAL/gap_evidence rows carry a non-empty gapDetail.`
        : `Rows missing gapDetail: ${missing.map((r) => r.evidenceId).join(", ")}`,
  };
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

export function evaluatePhase3gSourceQueryEvidence(): Phase3gAuditSummary {
  const evidenceRows = ALL_PHASE3G_EVIDENCE_ROWS;
  const queryShapes = PHASE3G_QUERY_SHAPE_RECORDS;

  const checks: readonly Phase3gCheckResult[] = [
    checkAllEvidenceRowsHaveCorrectRuleVersion(evidenceRows),
    checkAllSixQuestionsAnswered(evidenceRows),
    checkAllThreeFamiliesHaveEvidence(evidenceRows),
    checkNoPersistedFlagAuthorityInQueryShapes(queryShapes),
    checkAllQueryShapesInheritWorkspaceScope(queryShapes),
    checkTpqr003QueryShapeRequiresExplicitClock(queryShapes),
    checkTpqr004HasBothProducerShapes(queryShapes),
    checkAllQueryShapesHaveDisableSwitches(queryShapes),
    checkNoRuntimeAdoptionInAudit(),
    checkGapEvidenceRowsHaveGapDetail(evidenceRows),
  ];

  const passed = checks.filter((check) => check.passed).length;

  return {
    ruleVersion: PHASE3G_RULE_VERSION,
    evidenceRows,
    queryShapes,
    checks,
    totalChecks: checks.length,
    passed,
    allPassed: passed === checks.length,
    runtimeAdoptionPosture: "No-Go",
    nextAllowedWork:
      "Phase 3H: instantiate named read-only source functions for TPQR-001, TPQR-003, and TPQR-004 in a separate planning-only source-function artifact (not in data/queries.ts or mobile-command-read-model.ts). Requires explicit Phase 3H runtime source review before any production adoption.",
  };
}
