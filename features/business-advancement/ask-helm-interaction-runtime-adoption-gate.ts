/**
 * Helm Business Advancement — Product Phase 3 / Slice 5
 * Ask Helm Interaction Asset Runtime Adoption Gate.
 *
 * Planning-only artifact. This file builds a manual review packet from the
 * Slice 4 offline eval summary plus explicit adoption precondition evidence.
 *
 * It is NOT a runtime extractor, not an API, not a DB reader, not a queue, not
 * a page adapter, not an official write path, and not an execution authority.
 */

import {
  ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION,
  evaluateAskHelmInteractionOfflineEval,
  type AskHelmInteractionOfflineEvalSummary,
} from "./ask-helm-interaction-offline-eval";
import {
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION,
  ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION,
  DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
  POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
  type AskHelmInteractionRedactedCalibrationEvaluationResult,
} from "./ask-helm-interaction-redacted-calibration";
import {
  DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION,
  PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES,
  evaluateProductionQueryAdoptionApprovalGate,
  type ProductionQueryAdoptionApprovalDecision,
} from "./production-query-adoption-approval-gate";

export const ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION =
  "ask-helm-interaction-runtime-adoption-gate/v1";
export const ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE =
  "Planning-Only";
export const ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION =
  "No-Go";

export type AskHelmInteractionRuntimeAdoptionDecision =
  | "No-Go"
  | "Ready-For-Manual-Review";

export interface AskHelmRollbackDisableAuditPosture {
  readonly rollbackPlanPresent: boolean;
  readonly disableSwitchPresent: boolean;
  readonly auditTrailPlanPresent: boolean;
}

export interface AskHelmMembershipCapabilityProof {
  readonly workspaceScoped: boolean;
  readonly membershipChecked: boolean;
  readonly reviewerCapabilityChecked: boolean;
  readonly noWorkspaceWideVisibilityByDefault: boolean;
}

export interface AskHelmTopListActionabilityProof {
  readonly topListLimitEnforced: boolean;
  readonly actionLabelsReviewOnly: boolean;
  readonly foldedHighRiskSummaryPresent: boolean;
  readonly noExecutionLanguage: boolean;
}

export interface AskHelmHighRiskReviewCoverage {
  readonly allHighRiskCandidatesReviewRequired: boolean;
  readonly ownerOrAssignedReviewerRequired: boolean;
}

export interface AskHelmPrivacyExportProof {
  readonly redactedExportFormatVerified: boolean;
  readonly rawContentExcluded: boolean;
  readonly exportScopeBoundedByVisibility: boolean;
}

export interface AskHelmDeletionDismissProof {
  readonly ttlDeletionCovered: boolean;
  readonly actorDismissCovered: boolean;
  readonly reviewerDismissCovered: boolean;
  readonly membershipRevocationCovered: boolean;
}

export interface AskHelmFalsePositiveReviewHandling {
  readonly reviewDismissalPathPresent: boolean;
  readonly falsePositiveTrackingPresent: boolean;
  readonly thresholdTuningPlanPresent: boolean;
}

export interface AskHelmOperatorWorkloadEstimate {
  readonly estimatedCandidatesPerWeek: number;
  readonly reviewerCapacityPerWeek: number;
  readonly escalationPlanPresent: boolean;
}

export interface AskHelmProductionQueryAdoptionRequest {
  readonly requested: boolean;
  readonly approvedByRequiredReviewers: boolean;
  readonly implementationPlanPresent: boolean;
  readonly approvalGateDecision?: ProductionQueryAdoptionApprovalDecision;
  readonly approvalGateRuleVersion?: string;
}

export interface AskHelmInteractionRuntimeAdoptionGateInput {
  readonly offlineEvalSummary: AskHelmInteractionOfflineEvalSummary;
  readonly redactedRealDataCalibration: AskHelmInteractionRedactedCalibrationEvaluationResult;
  readonly rollbackDisableAuditPosture: AskHelmRollbackDisableAuditPosture;
  readonly membershipCapabilityProof: AskHelmMembershipCapabilityProof;
  readonly topListActionabilityProof: AskHelmTopListActionabilityProof;
  readonly highRiskReviewCoverage: AskHelmHighRiskReviewCoverage;
  readonly privacyExportProof: AskHelmPrivacyExportProof;
  readonly deletionDismissProof: AskHelmDeletionDismissProof;
  readonly falsePositiveReviewHandling: AskHelmFalsePositiveReviewHandling;
  readonly operatorWorkloadEstimate: AskHelmOperatorWorkloadEstimate;
  readonly productionQueryAdoptionRequest: AskHelmProductionQueryAdoptionRequest;
}

export interface AskHelmRuntimeAdoptionGateCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface AskHelmInteractionRuntimeAdoptionReviewPacket {
  readonly ruleVersion: typeof ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION;
  readonly posture: typeof ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE;
  readonly runtimeAdoption: typeof ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION;
  readonly decision: AskHelmInteractionRuntimeAdoptionDecision;
  readonly checks: readonly AskHelmRuntimeAdoptionGateCheck[];
  readonly blockers: readonly string[];
  readonly allowedNextStep: string;
  readonly forbiddenWork: readonly string[];
  readonly requiredReviewerRoles: readonly string[];
  readonly mandatoryChecklist: readonly string[];
  readonly runtimeIntegrationAllowed: false;
  readonly productionAdoptionAllowed: false;
}

export const ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_FORBIDDEN_WORK = [
  "Do not add or modify Prisma schema or migrations",
  "Do not add app route, API route, or route handler",
  "Do not change page behavior or UI surfaces",
  "Do not integrate runtime extractor, runtime adapter, queue, worker, or scheduler",
  "Do not modify data/queries.ts, search runtime, or mobile read-model",
  "Do not create DB-backed candidate persistence",
  "Do not create official write path",
  "Do not auto-send, auto-approve, auto-pay, auto-execute, or auto-commit",
  "Do not bypass membership, capability, privacy, deletion, or audit review",
] as const;

export const ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_REVIEWER_ROLES = [
  ...PRODUCTION_QUERY_REQUIRED_REVIEWER_ROLES,
] as const;

export const ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_MANDATORY_CHECKLIST = [
  "Slice 4 offline eval summary passes and remains runtime adoption No-Go",
  "Redacted real-data calibration evidence is present",
  "Rollback, disable, and audit posture has been reviewed",
  "Membership and reviewer capability proof has been reviewed",
  "Top-list actionability and high-risk review coverage have been reviewed",
  "Privacy export and deletion/dismiss proof have been reviewed",
  "False-positive handling and operator workload estimate have been reviewed",
  "Production query adoption request has required-reviewer approval",
  "Separate implementation plan exists before any runtime work starts",
] as const;

const ALLOWED_NEXT_STEP_NOT_READY =
  "Resolve blockers and re-run this planning-only gate. Do not start runtime, schema, API, page, query, official write, or auto-execution work.";

const ALLOWED_NEXT_STEP_READY =
  "Schedule manual runtime adoption review with all required reviewer roles and draft a separate implementation plan. This packet is not Go and does not allow runtime integration or production adoption.";

export const DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT: AskHelmInteractionRuntimeAdoptionGateInput =
  {
    offlineEvalSummary: evaluateAskHelmInteractionOfflineEval().summary,
    redactedRealDataCalibration:
      DEFAULT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
    rollbackDisableAuditPosture: {
      rollbackPlanPresent: true,
      disableSwitchPresent: true,
      auditTrailPlanPresent: true,
    },
    membershipCapabilityProof: {
      workspaceScoped: true,
      membershipChecked: true,
      reviewerCapabilityChecked: true,
      noWorkspaceWideVisibilityByDefault: true,
    },
    topListActionabilityProof: {
      topListLimitEnforced: true,
      actionLabelsReviewOnly: true,
      foldedHighRiskSummaryPresent: true,
      noExecutionLanguage: true,
    },
    highRiskReviewCoverage: {
      allHighRiskCandidatesReviewRequired: true,
      ownerOrAssignedReviewerRequired: true,
    },
    privacyExportProof: {
      redactedExportFormatVerified: true,
      rawContentExcluded: true,
      exportScopeBoundedByVisibility: true,
    },
    deletionDismissProof: {
      ttlDeletionCovered: true,
      actorDismissCovered: true,
      reviewerDismissCovered: true,
      membershipRevocationCovered: true,
    },
    falsePositiveReviewHandling: {
      reviewDismissalPathPresent: true,
      falsePositiveTrackingPresent: true,
      thresholdTuningPlanPresent: true,
    },
    operatorWorkloadEstimate: {
      estimatedCandidatesPerWeek: 8,
      reviewerCapacityPerWeek: 12,
      escalationPlanPresent: true,
    },
    productionQueryAdoptionRequest:
      evaluateProductionQueryAdoptionApprovalGate(
        DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
      ).summary,
  };

export const POSITIVE_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT: AskHelmInteractionRuntimeAdoptionGateInput =
  {
    ...DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
    redactedRealDataCalibration:
      POSITIVE_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_EVALUATION,
    productionQueryAdoptionRequest:
      evaluateProductionQueryAdoptionApprovalGate(
        POSITIVE_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
      ).summary,
  };

export function evaluateAskHelmInteractionRuntimeAdoptionGate(
  input: AskHelmInteractionRuntimeAdoptionGateInput =
    DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
): AskHelmInteractionRuntimeAdoptionReviewPacket {
  const checks = buildChecks(input);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: AskHelmInteractionRuntimeAdoptionDecision =
    blockers.length === 0 ? "Ready-For-Manual-Review" : "No-Go";

  return {
    ruleVersion: ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION,
    posture: ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE,
    runtimeAdoption: ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION,
    decision,
    checks,
    blockers,
    allowedNextStep:
      decision === "Ready-For-Manual-Review"
        ? ALLOWED_NEXT_STEP_READY
        : ALLOWED_NEXT_STEP_NOT_READY,
    forbiddenWork: [...ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_FORBIDDEN_WORK],
    requiredReviewerRoles: [
      ...ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_REVIEWER_ROLES,
    ],
    mandatoryChecklist: [
      ...ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_MANDATORY_CHECKLIST,
    ],
    runtimeIntegrationAllowed: false,
    productionAdoptionAllowed: false,
  };
}

function buildChecks(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): readonly AskHelmRuntimeAdoptionGateCheck[] {
  return [
    checkConstants(),
    checkOfflineEvalSummary(input.offlineEvalSummary),
    checkRedactedCalibration(input),
    checkRollbackDisableAudit(input),
    checkMembershipCapability(input),
    checkTopListActionability(input),
    checkHighRiskReviewCoverage(input),
    checkPrivacyExport(input),
    checkDeletionDismiss(input),
    checkFalsePositiveReviewHandling(input),
    checkOperatorWorkload(input),
    checkProductionQueryAdoptionRequest(input),
  ];
}

function checkConstants(): AskHelmRuntimeAdoptionGateCheck {
  const pass =
    ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION ===
      "ask-helm-interaction-runtime-adoption-gate/v1" &&
    ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE === "Planning-Only" &&
    ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION === "No-Go";
  return {
    name: "gate_constants_are_planning_only_no_go",
    pass,
    detail: `${ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RULE_VERSION}; ${ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_POSTURE}; runtime=${ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION}`,
    blocker: "Gate constants must remain Planning-Only and runtime adoption No-Go.",
  };
}

function checkOfflineEvalSummary(
  summary: AskHelmInteractionOfflineEvalSummary,
): AskHelmRuntimeAdoptionGateCheck {
  const pass =
    summary.allPass &&
    summary.eligibleCandidateCount > 0 &&
    summary.privacyViolationCount === 0 &&
    summary.boundaryViolationCount === 0 &&
    summary.runtimeAdoption === ASK_HELM_INTERACTION_OFFLINE_EVAL_RUNTIME_ADOPTION;
  return {
    name: "slice4_offline_eval_summary_passes",
    pass,
    detail: `allPass=${String(summary.allPass)}; eligible=${summary.eligibleCandidateCount}; privacyViolations=${summary.privacyViolationCount}; boundaryViolations=${summary.boundaryViolationCount}; runtime=${summary.runtimeAdoption}`,
    blocker:
      "Slice 4 offline eval must pass with zero privacy/boundary violations before manual review.",
  };
}

function checkRedactedCalibration(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const calibration = input.redactedRealDataCalibration;
  const pass =
    calibration.ruleVersion ===
      ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RULE_VERSION &&
    calibration.posture === ASK_HELM_INTERACTION_REDACTED_CALIBRATION_POSTURE &&
    calibration.sampleKind === "redacted_real_interaction_snapshot" &&
    calibration.realDataValidated &&
    calibration.productionCalibrationComplete &&
    calibration.blockers.length === 0 &&
    calibration.checks.length > 0 &&
    calibration.checks.every((check) => check.pass) &&
    calibration.runtimeAdoption ===
      ASK_HELM_INTERACTION_REDACTED_CALIBRATION_RUNTIME_ADOPTION;
  return {
    name: "redacted_real_data_calibration_passes",
    pass,
    detail: `ruleVersion=${calibration.ruleVersion}; posture=${calibration.posture}; sampleKind=${calibration.sampleKind}; realDataValidated=${String(calibration.realDataValidated)}; productionCalibrationComplete=${String(calibration.productionCalibrationComplete)}; checks=${calibration.checks.length}; failedChecks=${calibration.checks.filter((check) => !check.pass).length}; blockers=${calibration.blockers.length}; runtime=${calibration.runtimeAdoption}`,
    blocker:
      "Redacted real-data calibration evidence is missing or failed; synthetic/local fixtures cannot unlock runtime adoption review.",
  };
}

function checkRollbackDisableAudit(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.rollbackDisableAuditPosture;
  const pass =
    proof.rollbackPlanPresent &&
    proof.disableSwitchPresent &&
    proof.auditTrailPlanPresent;
  return {
    name: "rollback_disable_audit_posture_present",
    pass,
    detail: `rollback=${String(proof.rollbackPlanPresent)}; disable=${String(proof.disableSwitchPresent)}; audit=${String(proof.auditTrailPlanPresent)}`,
    blocker:
      "Rollback plan, disable switch, and audit posture must all be present.",
  };
}

function checkMembershipCapability(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.membershipCapabilityProof;
  const pass =
    proof.workspaceScoped &&
    proof.membershipChecked &&
    proof.reviewerCapabilityChecked &&
    proof.noWorkspaceWideVisibilityByDefault;
  return {
    name: "membership_capability_proof_present",
    pass,
    detail: `workspaceScoped=${String(proof.workspaceScoped)}; membership=${String(proof.membershipChecked)}; reviewerCapability=${String(proof.reviewerCapabilityChecked)}; noWorkspaceWideDefault=${String(proof.noWorkspaceWideVisibilityByDefault)}`,
    blocker:
      "Membership, workspace scope, reviewer capability, and non-workspace-wide visibility proof must all be present.",
  };
}

function checkTopListActionability(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.topListActionabilityProof;
  const pass =
    proof.topListLimitEnforced &&
    proof.actionLabelsReviewOnly &&
    proof.foldedHighRiskSummaryPresent &&
    proof.noExecutionLanguage;
  return {
    name: "top_list_actionability_proof_present",
    pass,
    detail: `limit=${String(proof.topListLimitEnforced)}; reviewOnlyLabels=${String(proof.actionLabelsReviewOnly)}; foldedHighRisk=${String(proof.foldedHighRiskSummaryPresent)}; noExecutionLanguage=${String(proof.noExecutionLanguage)}`,
    blocker:
      "Top-list proof must show actionability without execution language and with folded high-risk handling.",
  };
}

function checkHighRiskReviewCoverage(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.highRiskReviewCoverage;
  const pass =
    proof.allHighRiskCandidatesReviewRequired &&
    proof.ownerOrAssignedReviewerRequired;
  return {
    name: "high_risk_review_coverage_present",
    pass,
    detail: `allHighRiskReviewRequired=${String(proof.allHighRiskCandidatesReviewRequired)}; ownerOrAssignedReviewer=${String(proof.ownerOrAssignedReviewerRequired)}`,
    blocker:
      "High-risk candidates must require human review by owner/admin or assigned reviewer.",
  };
}

function checkPrivacyExport(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.privacyExportProof;
  const pass =
    proof.redactedExportFormatVerified &&
    proof.rawContentExcluded &&
    proof.exportScopeBoundedByVisibility;
  return {
    name: "privacy_export_proof_present",
    pass,
    detail: `redactedFormat=${String(proof.redactedExportFormatVerified)}; rawExcluded=${String(proof.rawContentExcluded)}; scopedByVisibility=${String(proof.exportScopeBoundedByVisibility)}`,
    blocker:
      "Privacy export proof must verify redacted format, raw-content exclusion, and visibility-bounded export scope.",
  };
}

function checkDeletionDismiss(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.deletionDismissProof;
  const pass =
    proof.ttlDeletionCovered &&
    proof.actorDismissCovered &&
    proof.reviewerDismissCovered &&
    proof.membershipRevocationCovered;
  return {
    name: "deletion_dismiss_proof_present",
    pass,
    detail: `ttl=${String(proof.ttlDeletionCovered)}; actorDismiss=${String(proof.actorDismissCovered)}; reviewerDismiss=${String(proof.reviewerDismissCovered)}; membershipRevocation=${String(proof.membershipRevocationCovered)}`,
    blocker:
      "Deletion and dismiss proof must cover TTL, actor dismiss, reviewer dismiss, and membership revocation.",
  };
}

function checkFalsePositiveReviewHandling(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const proof = input.falsePositiveReviewHandling;
  const pass =
    proof.reviewDismissalPathPresent &&
    proof.falsePositiveTrackingPresent &&
    proof.thresholdTuningPlanPresent;
  return {
    name: "false_positive_review_handling_present",
    pass,
    detail: `dismissal=${String(proof.reviewDismissalPathPresent)}; tracking=${String(proof.falsePositiveTrackingPresent)}; tuningPlan=${String(proof.thresholdTuningPlanPresent)}`,
    blocker:
      "False-positive handling must include dismissal, tracking, and threshold tuning plan.",
  };
}

function checkOperatorWorkload(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const estimate = input.operatorWorkloadEstimate;
  const pass =
    estimate.estimatedCandidatesPerWeek >= 0 &&
    estimate.reviewerCapacityPerWeek > 0 &&
    estimate.estimatedCandidatesPerWeek <= estimate.reviewerCapacityPerWeek &&
    estimate.escalationPlanPresent;
  return {
    name: "operator_workload_estimate_reviewable",
    pass,
    detail: `estimatedPerWeek=${estimate.estimatedCandidatesPerWeek}; capacityPerWeek=${estimate.reviewerCapacityPerWeek}; escalation=${String(estimate.escalationPlanPresent)}`,
    blocker:
      "Operator workload estimate must fit reviewer capacity and include escalation plan.",
  };
}

function checkProductionQueryAdoptionRequest(
  input: AskHelmInteractionRuntimeAdoptionGateInput,
): AskHelmRuntimeAdoptionGateCheck {
  const request = input.productionQueryAdoptionRequest;
  const pass =
    request.requested &&
    request.approvedByRequiredReviewers &&
    request.implementationPlanPresent &&
    request.approvalGateDecision === "Ready-For-Manual-Review" &&
    request.approvalGateRuleVersion ===
      PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RULE_VERSION;
  return {
    name: "production_query_adoption_request_reviewed",
    pass,
    detail: `requested=${String(request.requested)}; approved=${String(request.approvedByRequiredReviewers)}; implementationPlan=${String(request.implementationPlanPresent)}; approvalGate=${request.approvalGateDecision ?? "missing"}; approvalRule=${request.approvalGateRuleVersion ?? "missing"}`,
    blocker:
      request.requested
        ? "Production query adoption request is not approved by required reviewers with a separate implementation plan and passing approval gate."
        : "Production query adoption request is absent; manual review packet cannot be ready.",
  };
}
