/**
 * Helm Business Advancement — Production Query Adoption Approval Gate.
 *
 * Planning-only contract for the gap between Phase 3S review-packet readiness
 * and any future production query implementation plan. This is not a runtime
 * adapter, not a DB reader, not an API, not a page adapter, and not authority
 * to modify data/queries.ts or any production read model.
 */

export const PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION =
  "production-query-adoption-approval-gate/v1" as const;

export const PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE =
  "Planning-Only" as const;

export const PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION =
  "No-Go" as const;

export type ProductionQueryAdoptionApprovalDecision =
  | "No-Go"
  | "Ready-For-Manual-Review";

export const PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES = [
  "Engineering Lead",
  "Product Owner",
  "Security Reviewer",
  "Operations Lead",
  "Data Protection Officer",
] as const;

export type ProductionQueryRequiredReviewerRole =
  (typeof PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES)[number];

export const PRODUCTION_QUERY_ADOPTION_FORBIDDEN_WORK = [
  "Do not modify data/queries.ts in this planning gate",
  "Do not create app route or API route for production adoption",
  "Do not modify prisma schema or migrations",
  "Do not integrate mobile read-model",
  "Do not create official write path",
  "Do not auto-send, auto-approve, auto-pay, auto-execute, or auto-commit",
  "Do not bypass workspace membership, object read permission, capability, redaction, audit, or required reviewer approval",
] as const;

export const PRODUCTION_QUERY_ADOPTION_MANDATORY_CHECKLIST = [
  "Redacted real-data calibration package is ready for manual review",
  "Phase 3R preflight passed with redacted live DB snapshot evidence",
  "Phase 3S manual review packet is ready",
  "Production query adoption implementation plan exists and is versioned",
  "Target query seams are enumerated without code changes in this gate",
  "Workspace, membership, capability, object-read, redaction, and audit boundaries are defined",
  "Read-only shadow-first rollout, disable switch, rollback owner, and observability plan are defined",
  "All required reviewer roles approved the same plan version",
  "Approval record contains reviewer identity, capability proof, decision, risk notes, and timestamp",
] as const;

export type ProductionQueryTargetFile =
  | "data/queries.ts"
  | "features/mobile/lib/mobile-command-read-model.ts"
  | "app/"
  | "app/api/"
  | "other";

export interface ProductionQueryAdoptionTargetSeam {
  readonly seamId: string;
  readonly signalFamily: string;
  readonly plannedTargetFile: ProductionQueryTargetFile;
  readonly currentSliceCodeChangeAllowed: false;
  readonly readOnly: boolean;
  readonly defaultEnabled: boolean;
  readonly pageBehaviorChanged: boolean;
  readonly officialWritePath: boolean;
  readonly maxTake: number;
}

export interface ProductionQueryAdoptionSourceEvidence {
  readonly redactedCalibrationPackageReady: boolean;
  readonly redactedCalibrationPackageRuleVersion: string;
  readonly phase3rPreflightPassed: boolean;
  readonly phase3sReviewPacketReady: boolean;
  readonly redactedLiveSnapshotId: string;
  readonly calibrationReportPath: string;
}

export interface ProductionQueryAdoptionBoundaryProof {
  readonly readOnly: boolean;
  readonly workspaceScoped: boolean;
  readonly membershipChecked: boolean;
  readonly capabilityChecked: boolean;
  readonly objectReadChecked: boolean;
  readonly noCrossWorkspace: boolean;
  readonly noReservedTenantExposure: boolean;
  readonly noOfficialWrite: boolean;
  readonly noAutoExecution: boolean;
  readonly deterministicRanking: boolean;
  readonly limitClampDefined: boolean;
  readonly redactionFieldAllowlistDefined: boolean;
  readonly sensitiveFieldDenylistDefined: boolean;
  readonly auditTrailDefined: boolean;
}

export interface ProductionQueryAdoptionRolloutPlan {
  readonly stage: "planning" | "shadow" | "pilot_allowlist" | "surface_read_only" | "broader_pilot";
  readonly disabledByDefault: boolean;
  readonly shadowModeRequired: boolean;
  readonly workspaceAllowlistRequired: boolean;
  readonly rollbackPlanPresent: boolean;
  readonly rollbackOwnerUserId: string;
  readonly observabilityPlanPresent: boolean;
}

export interface ProductionQueryAdoptionPlan {
  readonly planId: string;
  readonly planVersion: string;
  readonly status: "draft" | "review_ready" | "approved";
  readonly sourceEvidence: ProductionQueryAdoptionSourceEvidence;
  readonly targetSeams: readonly ProductionQueryAdoptionTargetSeam[];
  readonly boundaryProof: ProductionQueryAdoptionBoundaryProof;
  readonly rolloutPlan: ProductionQueryAdoptionRolloutPlan;
}

export interface ProductionQueryReviewerCapabilityProof {
  readonly workspaceMembershipConfirmed: boolean;
  readonly reviewerCapabilityConfirmed: boolean;
  readonly noConflictDeclared: boolean;
}

export interface ProductionQueryReviewerApproval {
  readonly role: ProductionQueryRequiredReviewerRole;
  readonly reviewerUserId: string;
  readonly approvedPlanVersion: string;
  readonly decision: "approved" | "conditional" | "rejected";
  readonly capabilityProof: ProductionQueryReviewerCapabilityProof;
  readonly riskNotes: string;
  readonly signedAtIso: string;
}

export interface ProductionQueryReviewerApprovalRecord {
  readonly approvalRecordId: string;
  readonly planId: string;
  readonly planVersion: string;
  readonly reviewMeetingHeld: boolean;
  readonly governanceSignoffObtained: boolean;
  readonly approvals: readonly ProductionQueryReviewerApproval[];
}

export interface ProductionQueryAdoptionApprovalGateInput {
  readonly plan: ProductionQueryAdoptionPlan;
  readonly approvalRecord: ProductionQueryReviewerApprovalRecord;
}

export interface ProductionQueryAdoptionApprovalGateCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface ProductionQueryAdoptionRequestSummary {
  readonly requested: boolean;
  readonly approvedByRequiredReviewers: boolean;
  readonly implementationPlanPresent: boolean;
  readonly approvalGateRuleVersion: typeof PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION;
  readonly approvalGateDecision: ProductionQueryAdoptionApprovalDecision;
}

export interface ProductionQueryAdoptionApprovalGateResult {
  readonly ruleVersion: typeof PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION;
  readonly posture: typeof PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE;
  readonly runtimeAdoption: typeof PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION;
  readonly decision: ProductionQueryAdoptionApprovalDecision;
  readonly checks: readonly ProductionQueryAdoptionApprovalGateCheck[];
  readonly blockers: readonly string[];
  readonly requiredReviewerRoles: readonly ProductionQueryRequiredReviewerRole[];
  readonly approvedReviewerRoles: readonly ProductionQueryRequiredReviewerRole[];
  readonly missingReviewerRoles: readonly ProductionQueryRequiredReviewerRole[];
  readonly mandatoryChecklist: readonly string[];
  readonly forbiddenWork: readonly string[];
  readonly allowedNextStep: string;
  readonly productionAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly summary: ProductionQueryAdoptionRequestSummary;
}

const READY_NEXT_STEP =
  "Attach this approval summary to the runtime adoption review packet. It is still not production adoption and does not allow runtime integration.";

const NOT_READY_NEXT_STEP =
  "Resolve blockers, obtain all required reviewer approvals on the same plan version, then re-run this planning-only gate.";

const POSITIVE_PLAN_ID = "ba-production-query-adoption-plan-v1";
const POSITIVE_PLAN_VERSION = "v1.0.0";

export const DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT: ProductionQueryAdoptionApprovalGateInput =
  {
    plan: {
      planId: POSITIVE_PLAN_ID,
      planVersion: POSITIVE_PLAN_VERSION,
      status: "draft",
      sourceEvidence: {
        redactedCalibrationPackageReady: false,
        redactedCalibrationPackageRuleVersion:
          "redacted-real-data-calibration-package/v1",
        phase3rPreflightPassed: false,
        phase3sReviewPacketReady: false,
        redactedLiveSnapshotId: "",
        calibrationReportPath: "",
      },
      targetSeams: [],
      boundaryProof: {
        readOnly: true,
        workspaceScoped: true,
        membershipChecked: false,
        capabilityChecked: false,
        objectReadChecked: false,
        noCrossWorkspace: true,
        noReservedTenantExposure: true,
        noOfficialWrite: true,
        noAutoExecution: true,
        deterministicRanking: true,
        limitClampDefined: false,
        redactionFieldAllowlistDefined: false,
        sensitiveFieldDenylistDefined: false,
        auditTrailDefined: false,
      },
      rolloutPlan: {
        stage: "planning",
        disabledByDefault: true,
        shadowModeRequired: true,
        workspaceAllowlistRequired: true,
        rollbackPlanPresent: false,
        rollbackOwnerUserId: "",
        observabilityPlanPresent: false,
      },
    },
    approvalRecord: {
      approvalRecordId: "ba-production-query-approval-record-v1",
      planId: POSITIVE_PLAN_ID,
      planVersion: POSITIVE_PLAN_VERSION,
      reviewMeetingHeld: false,
      governanceSignoffObtained: false,
      approvals: [],
    },
  };

export const POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT: ProductionQueryAdoptionApprovalGateInput =
  {
    plan: {
      planId: POSITIVE_PLAN_ID,
      planVersion: POSITIVE_PLAN_VERSION,
      status: "approved",
      sourceEvidence: {
        redactedCalibrationPackageReady: true,
        redactedCalibrationPackageRuleVersion:
          "redacted-real-data-calibration-package/v1",
        phase3rPreflightPassed: true,
        phase3sReviewPacketReady: true,
        redactedLiveSnapshotId: "redacted-live-db-snapshot-ba-phase3p-001",
        calibrationReportPath:
          "docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md",
      },
      targetSeams: [
        {
          seamId: "tpqr-001-blocked-decision-read",
          signalFamily: "blocked_decision",
          plannedTargetFile: "data/queries.ts",
          currentSliceCodeChangeAllowed: false,
          readOnly: true,
          defaultEnabled: false,
          pageBehaviorChanged: false,
          officialWritePath: false,
          maxTake: 50,
        },
        {
          seamId: "tpqr-003-overdue-commitment-read",
          signalFamily: "overdue_commitment",
          plannedTargetFile: "data/queries.ts",
          currentSliceCodeChangeAllowed: false,
          readOnly: true,
          defaultEnabled: false,
          pageBehaviorChanged: false,
          officialWritePath: false,
          maxTake: 50,
        },
        {
          seamId: "tpqr-004-customer-waiting-read",
          signalFamily: "customer_waiting",
          plannedTargetFile: "features/mobile/lib/mobile-command-read-model.ts",
          currentSliceCodeChangeAllowed: false,
          readOnly: true,
          defaultEnabled: false,
          pageBehaviorChanged: false,
          officialWritePath: false,
          maxTake: 50,
        },
      ],
      boundaryProof: {
        readOnly: true,
        workspaceScoped: true,
        membershipChecked: true,
        capabilityChecked: true,
        objectReadChecked: true,
        noCrossWorkspace: true,
        noReservedTenantExposure: true,
        noOfficialWrite: true,
        noAutoExecution: true,
        deterministicRanking: true,
        limitClampDefined: true,
        redactionFieldAllowlistDefined: true,
        sensitiveFieldDenylistDefined: true,
        auditTrailDefined: true,
      },
      rolloutPlan: {
        stage: "planning",
        disabledByDefault: true,
        shadowModeRequired: true,
        workspaceAllowlistRequired: true,
        rollbackPlanPresent: true,
        rollbackOwnerUserId: "user-engineering-lead",
        observabilityPlanPresent: true,
      },
    },
    approvalRecord: {
      approvalRecordId: "ba-production-query-approval-record-v1",
      planId: POSITIVE_PLAN_ID,
      planVersion: POSITIVE_PLAN_VERSION,
      reviewMeetingHeld: true,
      governanceSignoffObtained: true,
      approvals: PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES.map((role, index) => ({
        role,
        reviewerUserId: `required-reviewer-${index + 1}`,
        approvedPlanVersion: POSITIVE_PLAN_VERSION,
        decision: "approved",
        capabilityProof: {
          workspaceMembershipConfirmed: true,
          reviewerCapabilityConfirmed: true,
          noConflictDeclared: true,
        },
        riskNotes:
          "Approved for planning-gate readiness only; production adoption remains blocked until separate implementation review.",
        signedAtIso: "2026-04-27T00:00:00.000Z",
      })),
    },
  };

export function evaluateProductionQueryAdoptionApprovalGate(
  input: ProductionQueryAdoptionApprovalGateInput =
    DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
): ProductionQueryAdoptionApprovalGateResult {
  const checks = buildChecks(input);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: ProductionQueryAdoptionApprovalDecision =
    blockers.length === 0 ? "Ready-For-Manual-Review" : "No-Go";
  const approvedReviewerRoles = getApprovedReviewerRoles(input);
  const missingReviewerRoles = PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES.filter(
    (role) => !approvedReviewerRoles.includes(role),
  );

  return {
    ruleVersion: PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION,
    posture: PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE,
    runtimeAdoption: PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION,
    decision,
    checks,
    blockers,
    requiredReviewerRoles: [...PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES],
    approvedReviewerRoles,
    missingReviewerRoles,
    mandatoryChecklist: [...PRODUCTION_QUERY_ADOPTION_MANDATORY_CHECKLIST],
    forbiddenWork: [...PRODUCTION_QUERY_ADOPTION_FORBIDDEN_WORK],
    allowedNextStep:
      decision === "Ready-For-Manual-Review"
        ? READY_NEXT_STEP
        : NOT_READY_NEXT_STEP,
    productionAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    summary: {
      requested: isNonEmpty(input.plan.planId),
      approvedByRequiredReviewers: decision === "Ready-For-Manual-Review",
      implementationPlanPresent: isImplementationPlanPresent(input.plan),
      approvalGateRuleVersion: PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION,
      approvalGateDecision: decision,
    },
  };
}

function buildChecks(
  input: ProductionQueryAdoptionApprovalGateInput,
): readonly ProductionQueryAdoptionApprovalGateCheck[] {
  return [
    checkConstants(),
    checkPlanIdentity(input.plan),
    checkSourceEvidence(input.plan.sourceEvidence),
    checkTargetSeams(input.plan.targetSeams),
    checkBoundaryProof(input.plan.boundaryProof),
    checkRolloutPlan(input.plan.rolloutPlan),
    checkApprovalRecordIdentity(input),
    checkRequiredReviewerApprovals(input),
  ];
}

function checkConstants(): ProductionQueryAdoptionApprovalGateCheck {
  const pass =
    PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE === "Planning-Only" &&
    PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION === "No-Go";
  return {
    name: "gate_constants_are_planning_only_no_go",
    pass,
    detail: `${PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION}; posture=${PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_POSTURE}; runtime=${PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION}`,
    blocker:
      "Production query adoption approval gate must stay planning-only and runtime adoption No-Go.",
  };
}

function checkPlanIdentity(
  plan: ProductionQueryAdoptionPlan,
): ProductionQueryAdoptionApprovalGateCheck {
  const pass =
    isNonEmpty(plan.planId) &&
    isNonEmpty(plan.planVersion) &&
    plan.status === "approved";
  return {
    name: "implementation_plan_versioned_and_approved",
    pass,
    detail: `planId=${plan.planId}; version=${plan.planVersion}; status=${plan.status}`,
    blocker:
      "Production query adoption implementation plan must be versioned and approved before it can satisfy runtime gate input.",
  };
}

function checkSourceEvidence(
  evidence: ProductionQueryAdoptionSourceEvidence,
): ProductionQueryAdoptionApprovalGateCheck {
  const pass =
    evidence.redactedCalibrationPackageReady &&
    evidence.redactedCalibrationPackageRuleVersion ===
      "redacted-real-data-calibration-package/v1" &&
    evidence.phase3rPreflightPassed &&
    evidence.phase3sReviewPacketReady &&
    isNonEmpty(evidence.redactedLiveSnapshotId) &&
    isNonEmpty(evidence.calibrationReportPath);
  return {
    name: "phase3r_phase3s_redacted_live_evidence_present",
    pass,
    detail: `packageReady=${String(evidence.redactedCalibrationPackageReady)}; packageRule=${evidence.redactedCalibrationPackageRuleVersion || "missing"}; phase3r=${String(evidence.phase3rPreflightPassed)}; phase3s=${String(evidence.phase3sReviewPacketReady)}; snapshot=${evidence.redactedLiveSnapshotId || "missing"}; report=${evidence.calibrationReportPath || "missing"}`,
    blocker:
      "Production query adoption requires the redacted calibration package, Phase 3R pass, Phase 3S packet readiness, and redacted live DB snapshot evidence.",
  };
}

function checkTargetSeams(
  seams: readonly ProductionQueryAdoptionTargetSeam[],
): ProductionQueryAdoptionApprovalGateCheck {
  const invalidSeams = seams.filter(
    (seam) =>
      !isNonEmpty(seam.seamId) ||
      !isNonEmpty(seam.signalFamily) ||
      seam.currentSliceCodeChangeAllowed !== false ||
      !seam.readOnly ||
      seam.defaultEnabled ||
      seam.pageBehaviorChanged ||
      seam.officialWritePath ||
      !Number.isInteger(seam.maxTake) ||
      seam.maxTake < 1 ||
      seam.maxTake > 100,
  );
  const pass = seams.length > 0 && invalidSeams.length === 0;
  return {
    name: "target_query_seams_enumerated_without_runtime_change",
    pass,
    detail: `seams=${seams.length}; invalid=${invalidSeams.length}; targets=${seams.map((seam) => `${seam.seamId}:${seam.plannedTargetFile}`).join(",")}`,
    blocker:
      "Each target query seam must be named, read-only, disabled by default, clamped to maxTake <= 100, and must not allow code/page/write changes in this gate.",
  };
}

function checkBoundaryProof(
  proof: ProductionQueryAdoptionBoundaryProof,
): ProductionQueryAdoptionApprovalGateCheck {
  const values = Object.values(proof);
  const pass = values.every((value) => value === true);
  return {
    name: "query_boundary_proof_complete",
    pass,
    detail: `true=${values.filter(Boolean).length}; total=${values.length}`,
    blocker:
      "Production query adoption plan must prove read-only, workspace, membership, capability, object-read, redaction, deterministic ranking, clamp, and audit boundaries.",
  };
}

function checkRolloutPlan(
  plan: ProductionQueryAdoptionRolloutPlan,
): ProductionQueryAdoptionApprovalGateCheck {
  const pass =
    plan.stage === "planning" &&
    plan.disabledByDefault &&
    plan.shadowModeRequired &&
    plan.workspaceAllowlistRequired &&
    plan.rollbackPlanPresent &&
    isNonEmpty(plan.rollbackOwnerUserId) &&
    plan.observabilityPlanPresent;
  return {
    name: "rollout_plan_is_disabled_shadow_first",
    pass,
    detail: `stage=${plan.stage}; disabled=${String(plan.disabledByDefault)}; shadow=${String(plan.shadowModeRequired)}; allowlist=${String(plan.workspaceAllowlistRequired)}; rollback=${String(plan.rollbackPlanPresent)}; owner=${plan.rollbackOwnerUserId || "missing"}; observability=${String(plan.observabilityPlanPresent)}`,
    blocker:
      "Production query adoption rollout must start in planning, stay disabled by default, require shadow mode and workspace allowlist, and include rollback owner plus observability.",
  };
}

function checkApprovalRecordIdentity(
  input: ProductionQueryAdoptionApprovalGateInput,
): ProductionQueryAdoptionApprovalGateCheck {
  const record = input.approvalRecord;
  const pass =
    isNonEmpty(record.approvalRecordId) &&
    record.planId === input.plan.planId &&
    record.planVersion === input.plan.planVersion &&
    record.reviewMeetingHeld &&
    record.governanceSignoffObtained;
  return {
    name: "approval_record_matches_plan",
    pass,
    detail: `record=${record.approvalRecordId || "missing"}; planMatch=${String(record.planId === input.plan.planId)}; versionMatch=${String(record.planVersion === input.plan.planVersion)}; meeting=${String(record.reviewMeetingHeld)}; governance=${String(record.governanceSignoffObtained)}`,
    blocker:
      "Reviewer approval record must match plan id/version and include held review meeting plus governance signoff.",
  };
}

function checkRequiredReviewerApprovals(
  input: ProductionQueryAdoptionApprovalGateInput,
): ProductionQueryAdoptionApprovalGateCheck {
  const approvedRoles = getApprovedReviewerRoles(input);
  const missingRoles = PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES.filter(
    (role) => !approvedRoles.includes(role),
  );
  const duplicateRoles = getDuplicateRoles(input.approvalRecord.approvals);
  const invalidApprovals = input.approvalRecord.approvals.filter(
    (approval) => !isValidApprovedReviewerApproval(approval, input.plan),
  );
  const pass =
    missingRoles.length === 0 &&
    duplicateRoles.length === 0 &&
    invalidApprovals.length === 0 &&
    input.approvalRecord.approvals.length ===
      PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES.length;

  return {
    name: "all_required_reviewer_approvals_valid",
    pass,
    detail: `approvedRoles=${approvedRoles.join(",") || "none"}; missing=${missingRoles.join(",") || "none"}; duplicates=${duplicateRoles.join(",") || "none"}; invalid=${invalidApprovals.length}`,
    blocker:
      "All required reviewer roles must approve the same plan version with reviewer identity, capability proof, no-conflict declaration, risk notes, and timestamp.",
  };
}

function getApprovedReviewerRoles(
  input: ProductionQueryAdoptionApprovalGateInput,
): readonly ProductionQueryRequiredReviewerRole[] {
  return PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES.filter((role) =>
    input.approvalRecord.approvals.some(
      (approval) =>
        approval.role === role &&
        isValidApprovedReviewerApproval(approval, input.plan),
    ),
  );
}

function getDuplicateRoles(
  approvals: readonly ProductionQueryReviewerApproval[],
): readonly ProductionQueryRequiredReviewerRole[] {
  const seen = new Set<ProductionQueryRequiredReviewerRole>();
  const duplicates = new Set<ProductionQueryRequiredReviewerRole>();
  for (const approval of approvals) {
    if (seen.has(approval.role)) {
      duplicates.add(approval.role);
    }
    seen.add(approval.role);
  }
  return [...duplicates];
}

function isImplementationPlanPresent(
  plan: ProductionQueryAdoptionPlan,
): boolean {
  return (
    isNonEmpty(plan.planId) &&
    isNonEmpty(plan.planVersion) &&
    plan.targetSeams.length > 0
  );
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isValidApprovedReviewerApproval(
  approval: ProductionQueryReviewerApproval,
  plan: ProductionQueryAdoptionPlan,
): boolean {
  return (
    approval.decision === "approved" &&
    approval.approvedPlanVersion === plan.planVersion &&
    isNonEmpty(approval.reviewerUserId) &&
    approval.capabilityProof.workspaceMembershipConfirmed &&
    approval.capabilityProof.reviewerCapabilityConfirmed &&
    approval.capabilityProof.noConflictDeclared &&
    isNonEmpty(approval.riskNotes) &&
    isValidStrictUtcIsoTimestamp(approval.signedAtIso)
  );
}

function isValidStrictUtcIsoTimestamp(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}
