// Phase 3L: Disabled Seam Prototype Review
// Posture: seam prototype review only — no runtime seam prototype implementation, no production adoption.

export const PHASE3L_RULE_VERSION =
  "phase3l-disabled-seam-prototype-review/v1" as const;

export const PHASE3L_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3L_SEAM_PROTOTYPE_REVIEW_POSTURE = "Conditional-Go" as const;

export const PHASE3L_NEXT_ALLOWED_WORK =
  "Phase 3M disabled-by-default internal seam prototype implementation in feature-only files (features/business-advancement/) OR real-data calibration evidence pack only. Must stay disconnected from production and behind explicit feature flags with defaultEnabled=false and productionIntegrationAllowed=false. Not production adoption. Not data/queries.ts, not app/, not prisma/schema.prisma, not any official write path or automated execution path." as const;

// ---------------------------------------------------------------------------
// Seam review plan types
// ---------------------------------------------------------------------------

export interface SeamPrototypeReviewPlan {
  readonly tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
  readonly internalPrototypeModuleName: string;
  readonly sourceFunctionName: string;
  readonly plannedDbModel: string;
  readonly textOnlyWhereShape: string;
  readonly featureFlagName: string;
  readonly defaultEnabled: false;
  readonly readOnly: true;
  readonly productionIntegrationAllowed: false;
  readonly capabilityRequired: string;
  readonly workspaceScopeRequired: true;
  readonly referenceClockRequired: boolean;
  readonly testSeamRequirements: readonly string[];
  readonly blockedProductionTargets: readonly string[];
  readonly reviewBlockers: readonly string[];
}

export interface Tpqr003SeamPrototypeReviewPlan extends SeamPrototypeReviewPlan {
  readonly tpqrId: "TPQR-003";
  readonly persistedFlagAuthorityAllowed: false;
}

export interface Tpqr004SeamPrototypeReviewPlan extends SeamPrototypeReviewPlan {
  readonly tpqrId: "TPQR-004";
  readonly dualProducerRequired: true;
}

// ---------------------------------------------------------------------------
// TPQR-001: ActionItem blocked-before-review seam prototype review
// ---------------------------------------------------------------------------

export const TPQR001_SEAM_REVIEW_PLAN: SeamPrototypeReviewPlan = {
  tpqrId: "TPQR-001",
  internalPrototypeModuleName:
    "InternalBlockedDecisionSeamPrototype (feature-only, not production)",
  sourceFunctionName: "sourceBlockedDecisionCandidates",
  plannedDbModel: "ActionItem",
  textOnlyWhereShape:
    "ActionItem WHERE workspaceId = :workspaceId AND approvalTask IS NULL AND updatedAt < (:referenceClockMs - :thresholdMs). " +
    "Read-only. No writes. No side effects. workspaceId is non-null and required. " +
    "thresholdMs must be supplied by the caller using the calibrated conservative fixture default (72h / 259200000ms); no Date.now() allowed. " +
    "This is a text-only where-shape description, NOT an executable query.",
  featureFlagName: "HELM_INTERNAL_TPQR001_SEAM_PROTOTYPE_ENABLED",
  defaultEnabled: false,
  readOnly: true,
  productionIntegrationAllowed: false,
  capabilityRequired:
    "helm.business-advancement.source.blocked-decision.read — explicit capability grant required. " +
    "No capability = function returns empty result (disabled path). " +
    "Must be reviewed before any runtime activation.",
  workspaceScopeRequired: true,
  referenceClockRequired: true,
  testSeamRequirements: [
    "TPQR-001 test seam must accept an injected row array (not a live db.actionItem.findMany call) so the function can be proven against representative rows without requiring a live DB connection",
    "TPQR-001 test seam must verify approvalTask IS NULL exclusion — rows with approvalTask present must be excluded regardless of age",
    "TPQR-001 test seam must verify workspace scope — rows with non-matching workspaceId must be excluded",
    "TPQR-001 test seam must verify threshold application — only rows with actionItemAgeMs >= conservativeFixtureDefaultMs (259200000ms) may be candidates",
    "TPQR-001 test seam must verify referenceClockMs injection — no Date.now() call allowed at any layer",
    "TPQR-001 test seam must remain behind HELM_INTERNAL_TPQR001_SEAM_PROTOTYPE_ENABLED=false by default",
  ],
  blockedProductionTargets: [
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
  ],
  reviewBlockers: [
    "TPQR-001: function-to-DB seam not yet implemented — Phase 3H/3J function accepts row arrays; a real db.actionItem adapter must be designed and reviewed in Phase 3M prototype, staying disconnected from production",
    "TPQR-001: threshold calibration (72h conservative fixture default) is not real-data validated — real-data calibration evidence pack required before runtime promotion",
    "TPQR-001: test seam must be built against injected rows in feature-only files before any runtime activation",
    "TPQR-001: capability scope must be explicitly granted and reviewed before any runtime activation",
    "TPQR-001: productionIntegrationAllowed=false — seam prototype must not integrate with data/queries.ts or any production read-model",
  ],
} as const;

// ---------------------------------------------------------------------------
// TPQR-003: Overdue commitment explicit reference clock seam prototype review
// ---------------------------------------------------------------------------

export const TPQR003_SEAM_REVIEW_PLAN: Tpqr003SeamPrototypeReviewPlan = {
  tpqrId: "TPQR-003",
  internalPrototypeModuleName:
    "InternalOverdueCommitmentSeamPrototype (feature-only, not production)",
  sourceFunctionName: "sourceOverdueCommitmentCandidates",
  plannedDbModel: "Commitment",
  textOnlyWhereShape:
    "Commitment WHERE workspaceId = :workspaceId AND dueDate IS NOT NULL AND dueDate < :referenceClockMs AND status NOT IN ('FULFILLED', 'CANCELED'). " +
    "referenceClockMs must be injected explicitly by the caller — no Date.now() allowed. " +
    "Commitment.overdueFlag persisted column is NOT used as inclusion authority. " +
    "Read-only. No writes. No side effects. workspaceId is non-null and required. " +
    "This is a text-only where-shape description, NOT an executable query.",
  featureFlagName: "HELM_INTERNAL_TPQR003_SEAM_PROTOTYPE_ENABLED",
  defaultEnabled: false,
  readOnly: true,
  productionIntegrationAllowed: false,
  capabilityRequired:
    "helm.business-advancement.source.overdue-commitment.read — explicit capability grant required. " +
    "No capability = function returns empty result (disabled path). " +
    "referenceClockMs must be supplied by an authorized caller, never read from wall clock.",
  workspaceScopeRequired: true,
  referenceClockRequired: true,
  persistedFlagAuthorityAllowed: false,
  testSeamRequirements: [
    "TPQR-003 test seam must accept an injected row array and a referenceClockMs parameter — no live DB connection and no Date.now() call allowed",
    "TPQR-003 test seam must verify that dueDate IS NULL rows are excluded regardless of clock",
    "TPQR-003 test seam must verify that terminal-status rows (FULFILLED, CANCELED) are excluded",
    "TPQR-003 test seam must verify that rows with dueDate >= referenceClockMs are excluded (not yet overdue)",
    "TPQR-003 test seam must verify that Commitment.overdueFlag column value does NOT affect inclusion — a row with overdueFlag=true but dueDate >= referenceClockMs must be excluded, a row with overdueFlag=false but dueDate < referenceClockMs must be included",
    "TPQR-003 test seam must verify workspace scope — rows with non-matching workspaceId must be excluded",
    "TPQR-003 test seam must remain behind HELM_INTERNAL_TPQR003_SEAM_PROTOTYPE_ENABLED=false by default",
  ],
  blockedProductionTargets: [
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
  ],
  reviewBlockers: [
    "TPQR-003: function-to-DB seam not yet implemented — Phase 3H/3J function accepts row arrays; a real db.commitment adapter must be designed and reviewed in Phase 3M prototype, staying disconnected from production",
    "TPQR-003: persistedFlagAuthorityAllowed=false must be enforced at every seam layer — the Commitment.overdueFlag column must never be the inclusion authority",
    "TPQR-003: referenceClockMs injection must be enforced at the seam adapter layer — no Date.now() call allowed at any point in the prototype chain",
    "TPQR-003: real-data calibration evidence pack required before runtime promotion",
    "TPQR-003: productionIntegrationAllowed=false — seam prototype must not integrate with data/queries.ts or any production read-model",
  ],
} as const;

// ---------------------------------------------------------------------------
// TPQR-004: Customer waiting dual-producer email thread dedup seam prototype review
// ---------------------------------------------------------------------------

export const TPQR004_SEAM_REVIEW_PLAN: Tpqr004SeamPrototypeReviewPlan = {
  tpqrId: "TPQR-004",
  internalPrototypeModuleName:
    "InternalCustomerWaitingSeamPrototype (feature-only, not production)",
  sourceFunctionName: "sourceCustomerWaitingCandidates",
  plannedDbModel: "EmailThread",
  textOnlyWhereShape:
    "CRM-linked producer: EmailThread WHERE workspaceId = :workspaceId AND status = 'WAITING_US' AND opportunityId IS NOT NULL. " +
    "Generic producer: EmailThread WHERE workspaceId = :workspaceId AND status = 'WAITING_US'. " +
    "After-producer dedup: by emailThreadId — CRM-linked producer wins; generic rows sharing an emailThreadId already claimed by CRM-linked are excluded. " +
    "Read-only. No writes. No side effects. workspaceId is non-null and required. " +
    "This is a text-only where-shape description, NOT an executable query.",
  featureFlagName: "HELM_INTERNAL_TPQR004_SEAM_PROTOTYPE_ENABLED",
  defaultEnabled: false,
  readOnly: true,
  productionIntegrationAllowed: false,
  capabilityRequired:
    "helm.business-advancement.source.customer-waiting.read — explicit capability grant required. " +
    "No capability = function returns empty result (disabled path). " +
    "CRM-linked producer additionally requires crm-linked scope in addition to base read.",
  workspaceScopeRequired: true,
  referenceClockRequired: false,
  dualProducerRequired: true,
  testSeamRequirements: [
    "TPQR-004 test seam must accept two injected row arrays (CRM-linked rows and generic rows) plus workspaceId — no live DB connection",
    "TPQR-004 test seam must verify that after-producer dedup by emailThreadId correctly excludes generic rows whose emailThreadId is already claimed by a CRM-linked row",
    "TPQR-004 test seam must verify CRM-linked producer wins tie-break — when both producers have the same emailThreadId, CRM-linked version is kept",
    "TPQR-004 test seam must verify that no duplicate emailThreadId appears in the final output",
    "TPQR-004 test seam must verify workspace scope — rows with non-matching workspaceId must be excluded from both producers",
    "TPQR-004 test seam must verify generic-only path — when there is no CRM-linked producer, generic rows proceed without dedup loss",
    "TPQR-004 test seam must remain behind HELM_INTERNAL_TPQR004_SEAM_PROTOTYPE_ENABLED=false by default",
  ],
  blockedProductionTargets: [
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
  ],
  reviewBlockers: [
    "TPQR-004: function-to-DB seam not yet implemented — the dual-producer (CRM-linked + generic) adapter layer must be designed and reviewed in Phase 3M prototype, staying disconnected from production",
    "TPQR-004: after-producer dedup (CRM-linked wins) must be enforced at the adapter layer — dedup logic must be proven on injected rows in the seam prototype before any runtime activation",
    "TPQR-004: CRM-linked producer query (opportunityId IS NOT NULL) was never validated against real DB rows — must be part of Phase 3M prototype validation",
    "TPQR-004: real-data calibration evidence pack required before runtime promotion",
    "TPQR-004: productionIntegrationAllowed=false — seam prototype must not integrate with data/queries.ts or any production read-model",
  ],
} as const;

export const PHASE3L_SEAM_REVIEW_PLANS: readonly SeamPrototypeReviewPlan[] = [
  TPQR001_SEAM_REVIEW_PLAN,
  TPQR003_SEAM_REVIEW_PLAN,
  TPQR004_SEAM_REVIEW_PLAN,
] as const;

// ---------------------------------------------------------------------------
// Evaluator types
// ---------------------------------------------------------------------------

export interface Phase3lCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface Phase3lEvaluationResult {
  readonly ruleVersion: typeof PHASE3L_RULE_VERSION;
  readonly runtimeAdoptionPosture: typeof PHASE3L_RUNTIME_ADOPTION_POSTURE;
  readonly seamPrototypeReviewPosture: typeof PHASE3L_SEAM_PROTOTYPE_REVIEW_POSTURE;
  readonly nextAllowedWork: typeof PHASE3L_NEXT_ALLOWED_WORK;
  readonly checks: readonly Phase3lCheck[];
  readonly totalChecks: number;
  readonly passedCount: number;
  readonly allPass: boolean;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluatePhase3lDisabledSeamPrototypeReview(): Phase3lEvaluationResult {
  const checks: Phase3lCheck[] = [];

  // 1. all_plans_disabled_by_default
  {
    const allDisabled = PHASE3L_SEAM_REVIEW_PLANS.every(
      (p) => p.defaultEnabled === false,
    );
    const allFlagsInternal = PHASE3L_SEAM_REVIEW_PLANS.every((p) =>
      p.featureFlagName.startsWith("HELM_INTERNAL_"),
    );
    const pass = allDisabled && allFlagsInternal;
    checks.push({
      name: "all_plans_disabled_by_default",
      pass,
      detail: pass
        ? `All ${PHASE3L_SEAM_REVIEW_PLANS.length} plans have defaultEnabled=false and HELM_INTERNAL_ prefixed feature flags: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => p.featureFlagName).join(", ")}.`
        : `Not all plans are disabled by default. defaultEnabled: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => String(p.defaultEnabled)).join(", ")}`,
    });
  }

  // 2. all_plans_production_integration_false
  {
    const allFalse = PHASE3L_SEAM_REVIEW_PLANS.every(
      (p) => p.productionIntegrationAllowed === false,
    );
    checks.push({
      name: "all_plans_production_integration_false",
      pass: allFalse,
      detail: allFalse
        ? "All plans have productionIntegrationAllowed=false."
        : `productionIntegrationAllowed: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => String(p.productionIntegrationAllowed)).join(", ")}`,
    });
  }

  // 3. all_plans_read_only
  {
    const allReadOnly = PHASE3L_SEAM_REVIEW_PLANS.every((p) => p.readOnly === true);
    checks.push({
      name: "all_plans_read_only",
      pass: allReadOnly,
      detail: allReadOnly
        ? "All plans have readOnly=true."
        : `readOnly: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => String(p.readOnly)).join(", ")}`,
    });
  }

  // 4. all_plans_require_workspace_scope
  {
    const allWs = PHASE3L_SEAM_REVIEW_PLANS.every(
      (p) => p.workspaceScopeRequired === true,
    );
    const allWsInShape = PHASE3L_SEAM_REVIEW_PLANS.every((p) =>
      p.textOnlyWhereShape.includes("workspaceId = :workspaceId"),
    );
    const pass = allWs && allWsInShape;
    checks.push({
      name: "all_plans_require_workspace_scope",
      pass,
      detail: pass
        ? "All plans have workspaceScopeRequired=true and encode workspaceId = :workspaceId in textOnlyWhereShape."
        : `workspaceScopeRequired: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => String(p.workspaceScopeRequired)).join(", ")} wsInShape: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => String(p.textOnlyWhereShape.includes("workspaceId = :workspaceId"))).join(", ")}`,
    });
  }

  // 5. all_plans_require_capability
  {
    const allCap = PHASE3L_SEAM_REVIEW_PLANS.every(
      (p) =>
        p.capabilityRequired.length > 0 &&
        p.capabilityRequired.includes("helm.business-advancement.source."),
    );
    checks.push({
      name: "all_plans_require_capability",
      pass: allCap,
      detail: allCap
        ? `All ${PHASE3L_SEAM_REVIEW_PLANS.length} plans define a non-empty helm.business-advancement.source.* capability requirement.`
        : "Some plans are missing required capability scope.",
    });
  }

  // 6. tpqr001_action_item_approval_task_absence_seam_reviewed
  {
    const plan = TPQR001_SEAM_REVIEW_PLAN;
    const hasModel = plan.plannedDbModel === "ActionItem";
    const hasApprovalTaskAbsence =
      plan.textOnlyWhereShape.includes("approvalTask IS NULL");
    const hasWorkspaceInShape =
      plan.textOnlyWhereShape.includes("workspaceId = :workspaceId");
    const hasNotExecutable =
      plan.textOnlyWhereShape.includes("NOT an executable query");
    const hasTestSeamForApprovalTask = plan.testSeamRequirements.some((r) =>
      r.includes("approvalTask"),
    );
    const hasSeamBlocker = plan.reviewBlockers.some((b) =>
      b.includes("function-to-DB seam"),
    );
    const pass =
      hasModel &&
      hasApprovalTaskAbsence &&
      hasWorkspaceInShape &&
      hasNotExecutable &&
      hasTestSeamForApprovalTask &&
      hasSeamBlocker;
    checks.push({
      name: "tpqr001_action_item_approval_task_absence_seam_reviewed",
      pass,
      detail: pass
        ? "TPQR-001 seam review encodes: ActionItem model, approvalTask IS NULL where-shape (text only, not executable), workspaceId scope, test seam requirement for approvalTask exclusion, function-to-DB seam blocker."
        : `Missing: model=${plan.plannedDbModel} approvalTaskAbsence=${String(hasApprovalTaskAbsence)} wsScope=${String(hasWorkspaceInShape)} notExecutable=${String(hasNotExecutable)} testSeamApproval=${String(hasTestSeamForApprovalTask)} seamBlocker=${String(hasSeamBlocker)}`,
    });
  }

  // 7. tpqr003_explicit_reference_clock_and_no_persisted_flag_authority_reviewed
  {
    const plan = TPQR003_SEAM_REVIEW_PLAN;
    const hasModel = plan.plannedDbModel === "Commitment";
    const hasExplicitClock =
      plan.textOnlyWhereShape.includes("referenceClockMs") &&
      plan.textOnlyWhereShape.includes("no Date.now()");
    const hasFlagNonAuthority =
      plan.textOnlyWhereShape.includes("overdueFlag") &&
      plan.textOnlyWhereShape.includes("NOT used as inclusion authority");
    const hasPersitedFlagFalse = plan.persistedFlagAuthorityAllowed === false;
    const hasClockRequired = plan.referenceClockRequired === true;
    const hasTestSeamForFlag = plan.testSeamRequirements.some((r) =>
      r.includes("overdueFlag"),
    );
    const hasSeamBlocker = plan.reviewBlockers.some((b) =>
      b.includes("function-to-DB seam"),
    );
    const pass =
      hasModel &&
      hasExplicitClock &&
      hasFlagNonAuthority &&
      hasPersitedFlagFalse &&
      hasClockRequired &&
      hasTestSeamForFlag &&
      hasSeamBlocker;
    checks.push({
      name: "tpqr003_explicit_reference_clock_and_no_persisted_flag_authority_reviewed",
      pass,
      detail: pass
        ? "TPQR-003 seam review encodes: Commitment model, explicit referenceClockMs (no Date.now()), overdueFlag NOT inclusion authority, persistedFlagAuthorityAllowed=false, referenceClockRequired=true, test seam for flag non-authority, function-to-DB seam blocker."
        : `Missing: model=${plan.plannedDbModel} clock=${String(hasExplicitClock)} flagNonAuth=${String(hasFlagNonAuthority)} persistedFalse=${String(hasPersitedFlagFalse)} clockRequired=${String(hasClockRequired)} testFlag=${String(hasTestSeamForFlag)} seamBlocker=${String(hasSeamBlocker)}`,
    });
  }

  // 8. tpqr004_dual_producer_email_thread_dedup_reviewed
  {
    const plan = TPQR004_SEAM_REVIEW_PLAN;
    const hasModel = plan.plannedDbModel === "EmailThread";
    const hasCrmLinked =
      plan.textOnlyWhereShape.includes("CRM-linked producer") &&
      plan.textOnlyWhereShape.includes("opportunityId IS NOT NULL");
    const hasGeneric =
      plan.textOnlyWhereShape.includes("Generic producer");
    const hasDedup =
      plan.textOnlyWhereShape.includes("After-producer dedup") &&
      plan.textOnlyWhereShape.includes("CRM-linked producer wins");
    const hasDualProducerRequired = plan.dualProducerRequired === true;
    const hasTestSeamForDedup = plan.testSeamRequirements.some((r) =>
      r.includes("dedup"),
    );
    const hasSeamBlocker = plan.reviewBlockers.some((b) =>
      b.includes("function-to-DB seam"),
    );
    const pass =
      hasModel &&
      hasCrmLinked &&
      hasGeneric &&
      hasDedup &&
      hasDualProducerRequired &&
      hasTestSeamForDedup &&
      hasSeamBlocker;
    checks.push({
      name: "tpqr004_dual_producer_email_thread_dedup_reviewed",
      pass,
      detail: pass
        ? "TPQR-004 seam review encodes: EmailThread model, CRM-linked producer (opportunityId IS NOT NULL), generic producer, after-producer dedup (CRM-linked wins), dualProducerRequired=true, test seam for dedup, function-to-DB seam blocker."
        : `Missing: model=${plan.plannedDbModel} crmLinked=${String(hasCrmLinked)} generic=${String(hasGeneric)} dedup=${String(hasDedup)} dualReq=${String(hasDualProducerRequired)} testDedup=${String(hasTestSeamForDedup)} seamBlocker=${String(hasSeamBlocker)}`,
    });
  }

  // 9. test_seam_requirements_defined_for_all
  {
    const allHaveSeams = PHASE3L_SEAM_REVIEW_PLANS.every(
      (p) => p.testSeamRequirements.length >= 5,
    );
    const allHaveSeamBlocker = PHASE3L_SEAM_REVIEW_PLANS.every((p) =>
      p.reviewBlockers.some((b) => b.includes("seam")),
    );
    const pass = allHaveSeams && allHaveSeamBlocker;
    checks.push({
      name: "test_seam_requirements_defined_for_all",
      pass,
      detail: pass
        ? `All ${PHASE3L_SEAM_REVIEW_PLANS.length} plans enumerate >= 5 test seam requirements and have a seam-related review blocker. Counts: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => p.testSeamRequirements.length).join(", ")}.`
        : `testSeamRequirements counts: ${PHASE3L_SEAM_REVIEW_PLANS.map((p) => p.testSeamRequirements.length).join(", ")} allHaveSeamBlocker=${String(allHaveSeamBlocker)}`,
    });
  }

  // 10. forbidden_production_targets_enumerated
  {
    const requiredTargets = [
      "data/queries.ts",
      "app/",
      "prisma/schema.prisma",
      "features/mobile/lib/mobile-command-read-model.ts",
    ];
    const allEnumerate = PHASE3L_SEAM_REVIEW_PLANS.every((p) =>
      requiredTargets.every((t) => p.blockedProductionTargets.includes(t)),
    );
    checks.push({
      name: "forbidden_production_targets_enumerated",
      pass: allEnumerate,
      detail: allEnumerate
        ? "All plans enumerate the required forbidden production targets: data/queries.ts, app/, prisma/schema.prisma, features/mobile/lib/mobile-command-read-model.ts."
        : "Some plans are missing required forbidden production targets.",
    });
  }

  // 11. runtime_adoption_posture_is_no_go
  {
    const pass = PHASE3L_RUNTIME_ADOPTION_POSTURE === "No-Go";
    checks.push({
      name: "runtime_adoption_posture_is_no_go",
      pass,
      detail: pass
        ? `PHASE3L_RUNTIME_ADOPTION_POSTURE="${PHASE3L_RUNTIME_ADOPTION_POSTURE}". PHASE3L_SEAM_PROTOTYPE_REVIEW_POSTURE="${PHASE3L_SEAM_PROTOTYPE_REVIEW_POSTURE}". Seam prototype review is conditionally approved; runtime adoption remains No-Go.`
        : `PHASE3L_RUNTIME_ADOPTION_POSTURE="${PHASE3L_RUNTIME_ADOPTION_POSTURE}" (expected "No-Go")`,
    });
  }

  // 12. next_allowed_work_is_disabled_feature_only_not_production
  {
    const lower = PHASE3L_NEXT_ALLOWED_WORK.toLowerCase();
    const mentionsPhase3m = lower.includes("phase 3m");
    const mentionsFeatureOnly = lower.includes("feature-only");
    const mentionsDisabledDefault = lower.includes("defaultenabled=false");
    const mentionsNotProduction = lower.includes("not production adoption");
    const mentionsForbiddenFiles =
      lower.includes("data/queries.ts") && lower.includes("app/");
    const pass =
      mentionsPhase3m &&
      mentionsFeatureOnly &&
      mentionsDisabledDefault &&
      mentionsNotProduction &&
      mentionsForbiddenFiles;
    checks.push({
      name: "next_allowed_work_is_disabled_feature_only_not_production",
      pass,
      detail: pass
        ? "PHASE3L_NEXT_ALLOWED_WORK names Phase 3M, feature-only files, defaultEnabled=false, not production adoption, and enumerates forbidden files."
        : `Missing: phase3m=${String(mentionsPhase3m)} featureOnly=${String(mentionsFeatureOnly)} disabledDefault=${String(mentionsDisabledDefault)} notProduction=${String(mentionsNotProduction)} forbiddenFiles=${String(mentionsForbiddenFiles)}`,
    });
  }

  const passedCount = checks.filter((c) => c.pass).length;

  return {
    ruleVersion: PHASE3L_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3L_RUNTIME_ADOPTION_POSTURE,
    seamPrototypeReviewPosture: PHASE3L_SEAM_PROTOTYPE_REVIEW_POSTURE,
    nextAllowedWork: PHASE3L_NEXT_ALLOWED_WORK,
    checks,
    totalChecks: checks.length,
    passedCount,
    allPass: passedCount === checks.length,
  };
}
