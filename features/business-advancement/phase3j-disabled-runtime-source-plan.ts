/**
 * Helm Business Advancement - Phase 3J
 * Disabled-by-default internal runtime source module plan artifact.
 *
 * This file plans — but does NOT implement — an internal, disabled-by-default
 * runtime source module for TPQR-001, TPQR-003, and TPQR-004. It encodes the
 * planned structure as typed constants and a deterministic evaluator only.
 *
 * This file is NOT a runtime adapter, NOT a DB reader, NOT a production query,
 * NOT an API route, NOT a mobile read-model integration, NOT a schema change,
 * NOT an extractor, NOT an event queue, NOT an official write, and NOT an
 * automated execution authority. It does not import from @/, does not import
 * db, does not read the wall clock, and makes no filesystem or network calls.
 *
 * Runtime adoption posture: No-Go (inherited from Phase 3I).
 * Module plan posture: Conditional-Go (disabled-by-default plan only).
 * Phase 3K conditions must be met before any prototype implementation.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PHASE3J_RULE_VERSION =
  "phase3j-disabled-runtime-source-plan/v1" as const;

export const PHASE3J_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3J_MODULE_PLAN_POSTURE = "Conditional-Go" as const;

export const PHASE3J_DEFAULT_ENABLED = false as const;

export const PHASE3J_NEXT_ALLOWED_WORK =
  "Phase 3K: author a disabled-by-default internal seam prototype review OR a threshold calibration fixture pack for TPQR-001/003/004. Must not allow production adoption. Must not write to data/queries.ts, features/mobile/lib/mobile-command-read-model.ts, app/, app/api/, prisma/schema.prisma, any official write path, or any automated execution path. Each family seam prototype must remain behind its explicit feature flag with defaultEnabled=false and productionIntegrationAllowed=false. Threshold calibration fixture pack must provide validated conservative defaults before any runtime promotion." as const;

export const PHASE3J_FORBIDDEN_FILES: readonly string[] = [
  "data/queries.ts",
  "features/mobile/lib/mobile-command-read-model.ts",
  "app/",
  "app/api/",
  "prisma/schema.prisma",
  "<official write paths>",
  "<automated execution paths>",
  "<API routes>",
  "<UI routes>",
  "<DB migrations>",
] as const;

// ---------------------------------------------------------------------------
// Family plan types
// ---------------------------------------------------------------------------

export interface Phase3jFamilyPlan {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly plannedSourceFunctionName: string;
  readonly plannedReadModelName: string;
  readonly featureFlagName: string;
  readonly defaultEnabled: false;
  readonly plannedDbModel: string;
  readonly plannedWhereShape: string;
  readonly requiredWorkspaceScope: string;
  readonly requiredCapabilityScope: string;
  readonly thresholdStatus: "calibration_placeholder" | "binary_predicate_unresolved";
  readonly calibrationRequired: boolean;
  readonly testSeamRequired: boolean;
  readonly productionIntegrationAllowed: false;
  readonly forbiddenProductionTargets: readonly string[];
  readonly auditFieldsRequired: readonly string[];
  readonly blockers: readonly string[];
}

// ---------------------------------------------------------------------------
// TPQR-001: blocked_decision family plan
// ---------------------------------------------------------------------------

export const TPQR001_FAMILY_PLAN: Phase3jFamilyPlan = {
  tpqrId: "TPQR-001",
  plannedSourceFunctionName: "sourceBlockedDecisionCandidates",
  plannedReadModelName: "InternalBlockedDecisionSourceModule (internal only, not production)",
  featureFlagName: "HELM_INTERNAL_TPQR001_SOURCE_MODULE_ENABLED",
  defaultEnabled: false,
  plannedDbModel: "ActionItem",
  plannedWhereShape:
    "ActionItem WHERE workspaceId = :workspaceId AND approvalTask IS NULL AND updatedAt < (:referenceClockMs - :thresholdMs). " +
    "Read-only. No writes. No side effects. workspaceId is non-null and required. " +
    "This is a planned where-shape text description, NOT an executable query.",
  requiredWorkspaceScope:
    "workspaceId non-null; all rows must be filtered to the caller-supplied workspaceId before any evaluation",
  requiredCapabilityScope:
    "Requires explicit capability grant: helm.business-advancement.source.blocked-decision.read. " +
    "No capability = function returns empty result (disabled path). Must be reviewed before any runtime activation.",
  thresholdStatus: "calibration_placeholder",
  calibrationRequired: true,
  testSeamRequired: true,
  productionIntegrationAllowed: false,
  forbiddenProductionTargets: [
    "data/queries.ts",
    "features/mobile/lib/mobile-command-read-model.ts",
    "app/",
    "app/api/",
    "prisma/schema.prisma",
    "<official write paths>",
    "<automated execution paths>",
  ],
  auditFieldsRequired: [
    "sourceRowId",
    "ruleVersion",
    "thresholdStatus",
    "exclusionReason",
    "workspaceId",
    "family",
  ],
  blockers: [
    "TPQR-001: 48h staleness threshold (PHASE3H_BLOCKED_DECISION_THRESHOLD_MS=172800000ms) is calibration_placeholder — requires real calibration or explicit conservative default validated against business data before runtime",
    "TPQR-001: no function-to-DB seam exists — Phase 3H function accepts row arrays, not db.actionItem.findMany queries; seam must be designed and reviewed in Phase 3K",
    "TPQR-001: no test-seam layer — function never tested against real DB rows; test seam must precede runtime activation",
    "TPQR-001: no permission/capability integration review completed — capability scope must be explicitly defined and reviewed",
    "TPQR-001: productionIntegrationAllowed=false — plan only; no integration with data/queries.ts or any production read-model",
  ],
} as const;

// ---------------------------------------------------------------------------
// TPQR-003: overdue_commitment family plan
// ---------------------------------------------------------------------------

export const TPQR003_FAMILY_PLAN: Phase3jFamilyPlan = {
  tpqrId: "TPQR-003",
  plannedSourceFunctionName: "sourceOverdueCommitmentCandidates",
  plannedReadModelName: "InternalOverdueCommitmentSourceModule (internal only, not production)",
  featureFlagName: "HELM_INTERNAL_TPQR003_SOURCE_MODULE_ENABLED",
  defaultEnabled: false,
  plannedDbModel: "Commitment",
  plannedWhereShape:
    "Commitment WHERE workspaceId = :workspaceId AND dueDate IS NOT NULL AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED', 'CANCELED'). " +
    "referenceClockMs must be injected explicitly by the caller — no Date.now() allowed. " +
    "overdueFlag column is NOT used as inclusion authority. " +
    "Read-only. No writes. No side effects. workspaceId is non-null and required. " +
    "This is a planned where-shape text description, NOT an executable query.",
  requiredWorkspaceScope:
    "workspaceId non-null; all rows must be filtered to the caller-supplied workspaceId before any evaluation",
  requiredCapabilityScope:
    "Requires explicit capability grant: helm.business-advancement.source.overdue-commitment.read. " +
    "No capability = function returns empty result (disabled path). referenceClockMs must be supplied by an authorized caller, never read from wall clock.",
  thresholdStatus: "binary_predicate_unresolved",
  calibrationRequired: true,
  testSeamRequired: true,
  productionIntegrationAllowed: false,
  forbiddenProductionTargets: [
    "data/queries.ts",
    "features/mobile/lib/mobile-command-read-model.ts",
    "app/",
    "app/api/",
    "prisma/schema.prisma",
    "<official write paths>",
    "<automated execution paths>",
  ],
  auditFieldsRequired: [
    "sourceRowId",
    "ruleVersion",
    "thresholdStatus",
    "exclusionReason",
    "workspaceId",
    "family",
  ],
  blockers: [
    "TPQR-003: thresholdStatus=binary_predicate_unresolved — the binary dueDate < referenceClockMs predicate is well-defined but the audit convention (calibration_placeholder) remains unresolved before runtime",
    "TPQR-003: no function-to-DB seam — Phase 3H function accepts row arrays, not db.commitment.findMany queries; seam must be designed and reviewed in Phase 3K",
    "TPQR-003: no test-seam layer — function never tested against real DB rows; test seam must precede runtime activation",
    "TPQR-003: explicit referenceClockMs injection must be enforced at the adapter layer — no Date.now() allowed at any point",
    "TPQR-003: productionIntegrationAllowed=false — plan only; no integration with data/queries.ts or any production read-model",
  ],
} as const;

// ---------------------------------------------------------------------------
// TPQR-004: customer_waiting family plan
// ---------------------------------------------------------------------------

export const TPQR004_FAMILY_PLAN: Phase3jFamilyPlan = {
  tpqrId: "TPQR-004",
  plannedSourceFunctionName: "sourceCustomerWaitingCandidates",
  plannedReadModelName: "InternalCustomerWaitingSourceModule (internal only, not production)",
  featureFlagName: "HELM_INTERNAL_TPQR004_SOURCE_MODULE_ENABLED",
  defaultEnabled: false,
  plannedDbModel: "EmailThread",
  plannedWhereShape:
    "CRM-linked producer: EmailThread WHERE workspaceId = :workspaceId AND status = 'WAITING_US' AND opportunityId IS NOT NULL. " +
    "Generic producer: EmailThread WHERE workspaceId = :workspaceId AND status = 'WAITING_US'. " +
    "After-producer dedup: by emailThreadId — CRM-linked producer wins; generic rows sharing an emailThreadId already claimed by CRM-linked are excluded. " +
    "Read-only. No writes. No side effects. workspaceId is non-null and required. " +
    "This is a planned where-shape text description, NOT an executable query.",
  requiredWorkspaceScope:
    "workspaceId non-null; all rows must be filtered to the caller-supplied workspaceId before any evaluation",
  requiredCapabilityScope:
    "Requires explicit capability grant: helm.business-advancement.source.customer-waiting.read. " +
    "No capability = function returns empty result (disabled path). CRM-linked producer requires crm-linked scope in addition to base read.",
  thresholdStatus: "binary_predicate_unresolved",
  calibrationRequired: true,
  testSeamRequired: true,
  productionIntegrationAllowed: false,
  forbiddenProductionTargets: [
    "data/queries.ts",
    "features/mobile/lib/mobile-command-read-model.ts",
    "app/",
    "app/api/",
    "prisma/schema.prisma",
    "<official write paths>",
    "<automated execution paths>",
  ],
  auditFieldsRequired: [
    "sourceRowId",
    "ruleVersion",
    "thresholdStatus",
    "exclusionReason",
    "workspaceId",
    "family",
  ],
  blockers: [
    "TPQR-004: thresholdStatus=binary_predicate_unresolved — the binary status=WAITING_US predicate is well-defined but the audit convention remains unresolved before runtime",
    "TPQR-004: no function-to-DB seam — Phase 3H function accepts row arrays; dual-producer (CRM-linked + generic) adapter layer must be designed and reviewed in Phase 3K",
    "TPQR-004: no test-seam layer — function never tested against real DB rows; CRM-linked producer query never validated against real DB; test seam must precede runtime activation",
    "TPQR-004: after-producer dedup (CRM-linked wins) must be enforced at the adapter layer — dedup logic must be proven on real rows before runtime",
    "TPQR-004: productionIntegrationAllowed=false — plan only; no integration with data/queries.ts or any production read-model",
  ],
} as const;

export const PHASE3J_FAMILY_PLANS: readonly Phase3jFamilyPlan[] = [
  TPQR001_FAMILY_PLAN,
  TPQR003_FAMILY_PLAN,
  TPQR004_FAMILY_PLAN,
] as const;

// ---------------------------------------------------------------------------
// Evaluator types
// ---------------------------------------------------------------------------

export interface Phase3jCheckResult {
  readonly checkName: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Phase3jEvaluationSummary {
  readonly ruleVersion: typeof PHASE3J_RULE_VERSION;
  readonly checks: readonly Phase3jCheckResult[];
  readonly totalChecks: number;
  readonly passed: number;
  readonly allPassed: boolean;
  readonly runtimeAdoptionPosture: typeof PHASE3J_RUNTIME_ADOPTION_POSTURE;
  readonly modulePlanPosture: typeof PHASE3J_MODULE_PLAN_POSTURE;
  readonly nextAllowedWork: typeof PHASE3J_NEXT_ALLOWED_WORK;
  readonly forbiddenFiles: readonly string[];
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkAllFamiliesDisabledByDefault(): Phase3jCheckResult {
  const allDisabled = PHASE3J_FAMILY_PLANS.every(
    (p) => p.defaultEnabled === false,
  );
  const allFlagsPresent = PHASE3J_FAMILY_PLANS.every(
    (p) => p.featureFlagName.startsWith("HELM_INTERNAL_"),
  );
  const passed = allDisabled && allFlagsPresent;
  return {
    checkName: "all_families_disabled_by_default",
    passed,
    detail: passed
      ? `All ${PHASE3J_FAMILY_PLANS.length} family plans have defaultEnabled=false and HELM_INTERNAL_ prefixed feature flags: ${PHASE3J_FAMILY_PLANS.map((p) => p.featureFlagName).join(", ")}.`
      : `Not all families are disabled by default. defaultEnabled: ${PHASE3J_FAMILY_PLANS.map((p) => String(p.defaultEnabled)).join(", ")}`,
  };
}

function checkNoProductionTargetsAllowed(): Phase3jCheckResult {
  const allForbidden = PHASE3J_FAMILY_PLANS.every(
    (p) => p.productionIntegrationAllowed === false,
  );
  const allHaveForbiddenTargets = PHASE3J_FAMILY_PLANS.every(
    (p) =>
      p.forbiddenProductionTargets.includes("data/queries.ts") &&
      p.forbiddenProductionTargets.includes("app/") &&
      p.forbiddenProductionTargets.includes("prisma/schema.prisma"),
  );
  const passed = allForbidden && allHaveForbiddenTargets;
  return {
    checkName: "no_production_targets_allowed",
    passed,
    detail: passed
      ? "All family plans have productionIntegrationAllowed=false and enumerate required forbidden production targets (data/queries.ts, app/, prisma/schema.prisma, and others)."
      : `productionIntegrationAllowed: ${PHASE3J_FAMILY_PLANS.map((p) => String(p.productionIntegrationAllowed)).join(", ")}`,
  };
}

function checkTpqr001ActionItemSeamPlanPresent(): Phase3jCheckResult {
  const plan = TPQR001_FAMILY_PLAN;
  const hasActionItemModel = plan.plannedDbModel === "ActionItem";
  const hasApprovalTaskInWhereShape =
    plan.plannedWhereShape.includes("approvalTask IS NULL");
  const hasWorkspaceScope =
    plan.plannedWhereShape.includes("workspaceId = :workspaceId");
  const hasNotExecutable =
    plan.plannedWhereShape.includes("NOT an executable query");
  const hasCalibrationBlocker = plan.blockers.some((b) =>
    b.includes("calibration_placeholder"),
  );
  const hasSeamBlocker = plan.blockers.some((b) =>
    b.includes("function-to-DB seam"),
  );
  const passed =
    hasActionItemModel &&
    hasApprovalTaskInWhereShape &&
    hasWorkspaceScope &&
    hasNotExecutable &&
    hasCalibrationBlocker &&
    hasSeamBlocker;
  return {
    checkName: "tpqr001_action_item_seam_plan_present",
    passed,
    detail: passed
      ? "TPQR-001 plan encodes: ActionItem model, approvalTask IS NULL where-shape (text only, not executable), workspaceId scope, calibration_placeholder blocker, function-to-DB seam blocker."
      : `Missing: model=${plan.plannedDbModel} approvalTaskShape=${String(hasApprovalTaskInWhereShape)} wsScope=${String(hasWorkspaceScope)} notExecutable=${String(hasNotExecutable)} calibrationBlocker=${String(hasCalibrationBlocker)} seamBlocker=${String(hasSeamBlocker)}`,
  };
}

function checkTpqr003CommitmentExplicitClockPlanPresent(): Phase3jCheckResult {
  const plan = TPQR003_FAMILY_PLAN;
  const hasCommitmentModel = plan.plannedDbModel === "Commitment";
  const hasExplicitClock =
    plan.plannedWhereShape.includes("referenceClockMs") &&
    plan.plannedWhereShape.includes("no Date.now()");
  const hasOverdueFlagNonAuthority =
    plan.plannedWhereShape.includes("overdueFlag") &&
    plan.plannedWhereShape.includes("NOT used as inclusion authority");
  const hasWorkspaceScope =
    plan.plannedWhereShape.includes("workspaceId = :workspaceId");
  const hasNotExecutable =
    plan.plannedWhereShape.includes("NOT an executable query");
  const hasSeamBlocker = plan.blockers.some((b) =>
    b.includes("function-to-DB seam"),
  );
  const passed =
    hasCommitmentModel &&
    hasExplicitClock &&
    hasOverdueFlagNonAuthority &&
    hasWorkspaceScope &&
    hasNotExecutable &&
    hasSeamBlocker;
  return {
    checkName: "tpqr003_commitment_explicit_clock_plan_present",
    passed,
    detail: passed
      ? "TPQR-003 plan encodes: Commitment model, explicit referenceClockMs (no Date.now()), overdueFlag NOT inclusion authority, workspaceId scope, function-to-DB seam blocker."
      : `Missing: model=${plan.plannedDbModel} explicitClock=${String(hasExplicitClock)} flagNonAuth=${String(hasOverdueFlagNonAuthority)} wsScope=${String(hasWorkspaceScope)} notExecutable=${String(hasNotExecutable)} seamBlocker=${String(hasSeamBlocker)}`,
  };
}

function checkTpqr004EmailThreadDualProducerPlanPresent(): Phase3jCheckResult {
  const plan = TPQR004_FAMILY_PLAN;
  const hasEmailThreadModel = plan.plannedDbModel === "EmailThread";
  const hasCrmLinkedProducer =
    plan.plannedWhereShape.includes("CRM-linked producer") &&
    plan.plannedWhereShape.includes("opportunityId IS NOT NULL");
  const hasGenericProducer =
    plan.plannedWhereShape.includes("Generic producer");
  const hasAfterProducerDedup =
    plan.plannedWhereShape.includes("After-producer dedup") &&
    plan.plannedWhereShape.includes("CRM-linked producer wins");
  const hasWorkspaceScope =
    plan.plannedWhereShape.includes("workspaceId = :workspaceId");
  const hasNotExecutable =
    plan.plannedWhereShape.includes("NOT an executable query");
  const hasSeamBlocker = plan.blockers.some((b) =>
    b.includes("function-to-DB seam"),
  );
  const passed =
    hasEmailThreadModel &&
    hasCrmLinkedProducer &&
    hasGenericProducer &&
    hasAfterProducerDedup &&
    hasWorkspaceScope &&
    hasNotExecutable &&
    hasSeamBlocker;
  return {
    checkName: "tpqr004_email_thread_dual_producer_plan_present",
    passed,
    detail: passed
      ? "TPQR-004 plan encodes: EmailThread model, CRM-linked producer (opportunityId IS NOT NULL), generic producer (all WAITING_US), after-producer dedup (CRM-linked wins), workspaceId scope, function-to-DB seam blocker."
      : `Missing: model=${plan.plannedDbModel} crmLinked=${String(hasCrmLinkedProducer)} generic=${String(hasGenericProducer)} dedup=${String(hasAfterProducerDedup)} wsScope=${String(hasWorkspaceScope)} notExecutable=${String(hasNotExecutable)} seamBlocker=${String(hasSeamBlocker)}`,
  };
}

function checkWorkspaceScopeRequiredForAll(): Phase3jCheckResult {
  const allHaveWorkspaceScope = PHASE3J_FAMILY_PLANS.every((p) =>
    p.requiredWorkspaceScope.includes("workspaceId non-null"),
  );
  const allHaveWorkspaceInWhereShape = PHASE3J_FAMILY_PLANS.every((p) =>
    p.plannedWhereShape.includes("workspaceId = :workspaceId"),
  );
  const passed = allHaveWorkspaceScope && allHaveWorkspaceInWhereShape;
  return {
    checkName: "workspace_scope_required_for_all",
    passed,
    detail: passed
      ? "All three family plans require workspaceId non-null scope in both requiredWorkspaceScope and plannedWhereShape."
      : `workspaceScope: ${PHASE3J_FAMILY_PLANS.map((p) => String(p.requiredWorkspaceScope.includes("workspaceId non-null"))).join(", ")}`,
  };
}

function checkCapabilityScopeRequiredForAll(): Phase3jCheckResult {
  const allHaveCapability = PHASE3J_FAMILY_PLANS.every((p) =>
    p.requiredCapabilityScope.includes(
      "helm.business-advancement.source.",
    ),
  );
  const allHaveDisabledPath = PHASE3J_FAMILY_PLANS.every((p) =>
    p.requiredCapabilityScope.includes("disabled path"),
  );
  const passed = allHaveCapability && allHaveDisabledPath;
  return {
    checkName: "capability_scope_required_for_all",
    passed,
    detail: passed
      ? `All ${PHASE3J_FAMILY_PLANS.length} family plans define a helm.business-advancement.source.* capability scope with disabled path enforcement.`
      : `Missing capability scope or disabled path in some plans.`,
  };
}

function checkThresholdCalibrationRequiredForAll(): Phase3jCheckResult {
  const allRequireCalibration = PHASE3J_FAMILY_PLANS.every(
    (p) => p.calibrationRequired === true,
  );
  const tpqr001HasPlaceholder =
    TPQR001_FAMILY_PLAN.thresholdStatus === "calibration_placeholder";
  const tpqr003HasUnresolved =
    TPQR003_FAMILY_PLAN.thresholdStatus === "binary_predicate_unresolved";
  const tpqr004HasUnresolved =
    TPQR004_FAMILY_PLAN.thresholdStatus === "binary_predicate_unresolved";
  const passed =
    allRequireCalibration &&
    tpqr001HasPlaceholder &&
    tpqr003HasUnresolved &&
    tpqr004HasUnresolved;
  return {
    checkName: "threshold_calibration_required_for_all",
    passed,
    detail: passed
      ? "All family plans have calibrationRequired=true. TPQR-001 thresholdStatus=calibration_placeholder (48h unvalidated). TPQR-003 thresholdStatus=binary_predicate_unresolved. TPQR-004 thresholdStatus=binary_predicate_unresolved. Calibration must precede any runtime activation."
      : `calibrationRequired: ${PHASE3J_FAMILY_PLANS.map((p) => String(p.calibrationRequired)).join(", ")}`,
  };
}

function checkAuditBundleRequiredForAll(): Phase3jCheckResult {
  const requiredFields = [
    "sourceRowId",
    "ruleVersion",
    "thresholdStatus",
    "exclusionReason",
    "workspaceId",
    "family",
  ];
  const allHaveBundle = PHASE3J_FAMILY_PLANS.every((p) =>
    requiredFields.every((f) => p.auditFieldsRequired.includes(f)),
  );
  const passed = allHaveBundle;
  return {
    checkName: "audit_bundle_required_for_all",
    passed,
    detail: passed
      ? `All family plans require audit bundle fields: ${requiredFields.join(", ")}.`
      : `Some family plans are missing required audit fields. Required: ${requiredFields.join(", ")}.`,
  };
}

function checkTestSeamRequiredBeforeRuntime(): Phase3jCheckResult {
  const allRequireTestSeam = PHASE3J_FAMILY_PLANS.every(
    (p) => p.testSeamRequired === true,
  );
  const allHaveTestSeamBlocker = PHASE3J_FAMILY_PLANS.every((p) =>
    p.blockers.some((b) => b.includes("test-seam layer")),
  );
  const passed = allRequireTestSeam && allHaveTestSeamBlocker;
  return {
    checkName: "test_seam_required_before_runtime",
    passed,
    detail: passed
      ? "All family plans have testSeamRequired=true and enumerate a test-seam blocker: functions were only proven on synthetic rows, never on real DB rows. A test-seam layer must precede any runtime activation."
      : `testSeamRequired: ${PHASE3J_FAMILY_PLANS.map((p) => String(p.testSeamRequired)).join(", ")}`,
  };
}

function checkRuntimeAdoptionPostureIsNoGo(): Phase3jCheckResult {
  const passed =
    PHASE3J_RUNTIME_ADOPTION_POSTURE === "No-Go" &&
    PHASE3J_MODULE_PLAN_POSTURE === "Conditional-Go";
  return {
    checkName: "runtime_adoption_posture_is_no_go",
    passed,
    detail: passed
      ? "PHASE3J_RUNTIME_ADOPTION_POSTURE=No-Go (inherited from Phase 3I). PHASE3J_MODULE_PLAN_POSTURE=Conditional-Go. The plan artifact is conditionally approved; runtime adoption remains blocked pending calibration, test-seam design, and Phase 3K review."
      : `posture=${PHASE3J_RUNTIME_ADOPTION_POSTURE} modulePlanPosture=${PHASE3J_MODULE_PLAN_POSTURE}`,
  };
}

function checkNextAllowedWorkIsNotProductionAdoption(): Phase3jCheckResult {
  const notProductionAdoption =
    !PHASE3J_NEXT_ALLOWED_WORK.toLowerCase().includes(
      "production adoption",
    ) ||
    PHASE3J_NEXT_ALLOWED_WORK.includes("Must not allow production adoption");
  const mentionsPhase3k =
    PHASE3J_NEXT_ALLOWED_WORK.includes("Phase 3K");
  const mentionsSeamPrototypeOrCalibration =
    PHASE3J_NEXT_ALLOWED_WORK.includes("seam prototype") ||
    PHASE3J_NEXT_ALLOWED_WORK.includes("calibration fixture");
  const mentionsForbiddenFiles =
    PHASE3J_NEXT_ALLOWED_WORK.includes("data/queries.ts") &&
    PHASE3J_NEXT_ALLOWED_WORK.includes("app/");
  const passed =
    notProductionAdoption &&
    mentionsPhase3k &&
    mentionsSeamPrototypeOrCalibration &&
    mentionsForbiddenFiles;
  return {
    checkName: "next_allowed_work_is_not_production_adoption",
    passed,
    detail: passed
      ? "PHASE3J_NEXT_ALLOWED_WORK explicitly states 'Must not allow production adoption', names Phase 3K as next step (seam prototype OR calibration fixture pack), and enumerates forbidden files."
      : `notProductionAdoption=${String(notProductionAdoption)} mentionsPhase3k=${String(mentionsPhase3k)} mentionsSeamOrCalibration=${String(mentionsSeamPrototypeOrCalibration)} mentionsForbiddenFiles=${String(mentionsForbiddenFiles)}`,
  };
}

// ---------------------------------------------------------------------------
// Deterministic evaluator
// ---------------------------------------------------------------------------

/**
 * Deterministic evaluator proving Phase 3J plan invariants.
 * Returns runtimeAdoptionPosture = "No-Go" and modulePlanPosture = "Conditional-Go".
 */
export function evaluatePhase3jDisabledRuntimeSourcePlan(): Phase3jEvaluationSummary {
  const checks: readonly Phase3jCheckResult[] = [
    checkAllFamiliesDisabledByDefault(),
    checkNoProductionTargetsAllowed(),
    checkTpqr001ActionItemSeamPlanPresent(),
    checkTpqr003CommitmentExplicitClockPlanPresent(),
    checkTpqr004EmailThreadDualProducerPlanPresent(),
    checkWorkspaceScopeRequiredForAll(),
    checkCapabilityScopeRequiredForAll(),
    checkThresholdCalibrationRequiredForAll(),
    checkAuditBundleRequiredForAll(),
    checkTestSeamRequiredBeforeRuntime(),
    checkRuntimeAdoptionPostureIsNoGo(),
    checkNextAllowedWorkIsNotProductionAdoption(),
  ];

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    ruleVersion: PHASE3J_RULE_VERSION,
    checks,
    totalChecks: checks.length,
    passed: passedCount,
    allPassed: passedCount === checks.length,
    runtimeAdoptionPosture: PHASE3J_RUNTIME_ADOPTION_POSTURE,
    modulePlanPosture: PHASE3J_MODULE_PLAN_POSTURE,
    nextAllowedWork: PHASE3J_NEXT_ALLOWED_WORK,
    forbiddenFiles: PHASE3J_FORBIDDEN_FILES,
  };
}
