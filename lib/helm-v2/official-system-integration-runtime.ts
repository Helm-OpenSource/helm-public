import {
  ActorType,
  BlockerStatus,
  HumanActionExecutionAckStatus,
  HumanActionExecutionStatus,
  HumanActionExecutionType,
  LimitedAutoAcknowledgementStatus,
  LimitedAutoApprovalStatus,
  LimitedAutoEligibilityStatus,
  LimitedAutoExecutionStatus,
  LimitedAutoFailureStatus,
  LimitedAutoRollbackStatus,
  MemoryItemKind,
  MemoryItemPromotionRule,
  MemoryItemRetention,
  MemoryItemScope,
  MemoryItemSensitivity,
  MemoryItemStatus,
  MemoryItemVerification,
  OfficialExceptionClass,
  OfficialFollowThroughResolutionStatus,
  OfficialFollowThroughStatus,
  OfficialFollowThroughType,
  OfficialReconciliationStatus,
  OfficialSystemType,
  OfficialWriteAcknowledgementStatus,
  OfficialWriteActionType,
  OfficialWriteApprovalStatus,
  OfficialWriteExecutionStatus,
  OpportunityStage,
  RiskLevel,
  RuntimeEventStatus,
} from ".prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { resolveApprovalRule } from "@/lib/helm-v2/approval-matrix";
import {
  OFFICIAL_FOLLOW_THROUGH_SECTION_MARKER,
  OFFICIAL_WRITE_SECTION_MARKER,
  mergeManagedSummarySection,
} from "@/lib/helm-v2/managed-summary-section";
import { getMeetingOpportunityJudgeRuntimeSummary, type OpportunityDeltaArtifact } from "@/lib/helm-v2/opportunity-judge-runtime";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

const OFFICIAL_WRITE_BOUNDARY_NOTE =
  "This is a guarded official system path only. Helm still has no default auto-write; without explicit approval, evidence refs and audit trail, it will not write official CRM.";
const OFFICIAL_WRITE_APPROVAL_NOTE =
  "approved write intent still does not equal actual official write success. Only a recorded attempt plus acknowledged success can represent official write success.";
const OFFICIAL_WRITE_DOES_NOT_MEAN_NOTE =
  "Approved does not mean written. It does not mean official CRM is updated, actual official write success, or external system acceptance; it also does not create an external commitment.";
const OFFICIAL_WRITE_SUCCESS_NOTE =
  "Only a guarded write attempt after explicit human approval plus system returned success can represent official write success.";
const OFFICIAL_WRITE_CHECKPOINT_WRITER = "helm-core";
const OFFICIAL_WRITE_SOURCE_BOUNDARY =
  "Shadow recommendation and execution proof can only generate guarded write intent; they do not become actual official write by themselves.";
const LIMITED_AUTO_BOUNDARY_NOTE =
  "Limited auto path stays extremely narrow: no broad auto-write, no send authority, no auto booking, and no hidden commit. It only runs on explicit approval plus strong acknowledgement.";
const LIMITED_AUTO_APPROVAL_NOTE =
  "limited auto 审批只代表允许这条白名单路径进入 constrained execution，不代表 broad auto-write，也不代表 正式write 已成功。";
const LIMITED_AUTO_DOES_NOT_MEAN_NOTE =
  "Approved limited auto does not mean broad auto-write, does not mean external outcome confirmed, and does not weaken recommendation / commitment boundaries.";
const LIMITED_AUTO_MANUAL_OVERRIDE_NOTE =
  "Force manual path remains available at all times. 如果 eligibility、ack 或边界任何一项不稳，这条路径就要回退到 guarded manual path。";
const OFFICIAL_FOLLOW_THROUGH_BOUNDARY_NOTE =
  "Follow-through tracks official outcomes and exceptions, but it does not weaken recommendation / commitment boundaries, is not broad auto-write, and does not automatically mean official write success.";
const OFFICIAL_FOLLOW_THROUGH_DOES_NOT_MEAN_NOTE =
  "resolved does not equal official success or official write success; only acknowledged_success can represent official write success. Any failure / unknown / stale / partial path must keep trace, manual fallback and reconciliation notes.";
const LIMITED_AUTO_ALLOWED_ACTIONS = new Set<OfficialWriteActionTypeValue>([
  "crm.attach_note",
  "crm.attach_handoff_summary",
  "crm.update_next_action",
  "crm.update_blockers",
]);
const LIMITED_AUTO_EXECUTABLE_ACTIONS = new Set<OfficialWriteActionTypeValue>(["crm.attach_note", "crm.update_next_action"]);

export type OfficialWriteActionTypeValue =
  | "crm.update_official_stage"
  | "crm.update_next_action"
  | "crm.update_blockers"
  | "crm.attach_note"
  | "crm.attach_handoff_summary";

export type OfficialCoverageActionTypeValue = OfficialWriteActionTypeValue | "crm.update_stage_shadow_mirror";
export type OfficialActionCoverageCategory =
  | "official_note_like"
  | "official_next_step"
  | "official_blocker_risk_metadata"
  | "official_handoff_summary"
  | "official_stage_adjacent";
export type OfficialActionDefaultPathValue = "guarded" | "limited_auto" | "manual_only" | "blocked" | "deferred";
export type OfficialReceiptStatusValue =
  | "acknowledged_success"
  | "acknowledged_failure"
  | "timeout_unknown"
  | "partial_success"
  | "stale_receipt"
  | "manual_reconciliation_required"
  | "manual_reconciliation_resolved"
  | "retry_skipped";
export type OfficialSummaryWritebackModeValue = "full" | "reconciliation_note" | "audit_only";

type OfficialActionCoverageDescriptor = {
  actionType: OfficialCoverageActionTypeValue;
  category: OfficialActionCoverageCategory;
  riskClass: "low" | "medium" | "high" | "critical";
  defaultPath: OfficialActionDefaultPathValue;
  limitedAutoStatus: LimitedAutoEligibilityStatusValue;
  acknowledgmentRequirement: string;
  rollbackExpectation: string;
  auditRequirement: string;
  boundaryReason: string;
  executableLimitedAuto: boolean;
};

const OFFICIAL_ACTION_COVERAGE: Record<OfficialCoverageActionTypeValue, OfficialActionCoverageDescriptor> = {
  "crm.attach_note": {
    actionType: "crm.attach_note",
    category: "official_note_like",
    riskClass: "low",
    defaultPath: "limited_auto",
    limitedAutoStatus: "eligible",
    acknowledgmentRequirement: "Requires acknowledged_success from the external CRM before Helm may claim official success.",
    rollbackExpectation: "Rollback is not supported in the constrained adapter; corrections must go through a new guarded write.",
    auditRequirement: "Audit trail is always required because this still writes system-of-record context.",
    boundaryReason: "Low-risk note-like official action with clear payload, clear provenance, strong acknowledgement, and always-available force-manual fallback.",
    executableLimitedAuto: true,
  },
  "crm.update_next_action": {
    actionType: "crm.update_next_action",
    category: "official_next_step",
    riskClass: "medium",
    defaultPath: "limited_auto",
    limitedAutoStatus: "eligible",
    acknowledgmentRequirement: "Requires acknowledged_success from the external CRM before Helm may claim the official next action is updated.",
    rollbackExpectation: "Rollback is not supported in the constrained adapter; if the next action must change again, it goes back through a new guarded write path.",
    auditRequirement: "Audit trail, provenance, evidence refs, and explicit approval are all required because this changes official pipeline posture.",
    boundaryReason: "Next action is richer than attach-note but still narrow enough for explicit-approval limited auto when evidence, provenance, and acknowledgement posture are strong.",
    executableLimitedAuto: true,
  },
  "crm.update_blockers": {
    actionType: "crm.update_blockers",
    category: "official_blocker_risk_metadata",
    riskClass: "high",
    defaultPath: "guarded",
    limitedAutoStatus: "eligible_but_manual_only",
    acknowledgmentRequirement: "Any official blocker write needs strong external acknowledgment and a clearer reconciliation story before Helm can ever treat it as auto-safe.",
    rollbackExpectation: "Rollback is currently manual-only because blocker/risk metadata can be multi-row and receipt semantics are still weak.",
    auditRequirement: "Audit trail is mandatory and manual review stays primary because blocker ranking can materially affect pipeline decisions.",
    boundaryReason: "Current main keeps blocker/risk metadata on guarded manual path only; coverage exists, but limited auto remains manual-only.",
    executableLimitedAuto: false,
  },
  "crm.attach_handoff_summary": {
    actionType: "crm.attach_handoff_summary",
    category: "official_handoff_summary",
    riskClass: "high",
    defaultPath: "guarded",
    limitedAutoStatus: "eligible_but_manual_only",
    acknowledgmentRequirement: "Needs strong external acknowledgment and a stronger rollback/reconciliation story before any limited auto execution can be considered.",
    rollbackExpectation: "Rollback is currently unavailable and handoff semantics are higher consequence, so this stays guarded manual-only.",
    auditRequirement: "Audit trail is mandatory because this can affect delivery / CS interpretation and downstream ownership.",
    boundaryReason: "Handoff summary attach remains visible for reviewability but stays manual-only in current main.",
    executableLimitedAuto: false,
  },
  "crm.update_official_stage": {
    actionType: "crm.update_official_stage",
    category: "official_stage_adjacent",
    riskClass: "critical",
    defaultPath: "guarded",
    limitedAutoStatus: "blocked",
    acknowledgmentRequirement: "Requires explicit approval and successful external acknowledgment, but current main still blocks it from limited auto because the risk of an unsupported stage leap is too high.",
    rollbackExpectation: "Rollback is not supported and stage corrections require a new reviewed guarded write.",
    auditRequirement: "Audit trail, owner/manager approval, and risk guard are all mandatory.",
    boundaryReason: "Official stage changes stay outside limited auto because stage is the highest-risk official pipeline posture change in current main.",
    executableLimitedAuto: false,
  },
  "crm.update_stage_shadow_mirror": {
    actionType: "crm.update_stage_shadow_mirror",
    category: "official_stage_adjacent",
    riskClass: "high",
    defaultPath: "deferred",
    limitedAutoStatus: "deferred",
    acknowledgmentRequirement: "Deferred candidate only; no current runtime path exists.",
    rollbackExpectation: "Deferred candidate only; rollback story has not been accepted into current main.",
    auditRequirement: "Deferred candidate only; would require full audit posture before any implementation.",
    boundaryReason: "This remains a Sprint 9 deferred candidate and is not implemented in current main.",
    executableLimitedAuto: false,
  },
};

export type OfficialWriteReviewMode =
  | "approve"
  | "reject"
  | "keep_pending"
  | "block_boundary"
  | "insufficient_evidence";

export type OfficialWriteAcknowledgementMode =
  | "ack_success"
  | "ack_failure"
  | "receipt_unknown"
  | "receipt_partial_success"
  | "receipt_stale"
  | "reconciliation_note"
  | "reconciliation_resolved"
  | "deferred_retry";

export type LimitedAutoEligibilityStatusValue = "eligible" | "eligible_but_manual_only" | "blocked" | "deferred";

export type LimitedAutoReviewMode =
  | "approve"
  | "reject"
  | "keep_pending"
  | "block_boundary"
  | "force_manual";

export type LimitedAutoSimulatedResult =
  | "ack_success"
  | "ack_failure"
  | "ack_unknown"
  | "partial_success"
  | "stale_receipt"
  | "reconciliation_resolved";

export type OfficialWriteSourceType = "approved_shadow_recommendation" | "approved_execution_proof";

type OfficialWriteIntentShared = {
  sourceKey: string;
  officialSystemType: "crm";
  officialObjectRef: string;
  sourceType: OfficialWriteSourceType;
  sourceTitle: string;
  sourceSummary: string;
  sourceShadowRef?: string | null;
  sourceExecutionProofRef?: string | null;
  writeActionType: OfficialWriteActionTypeValue;
  writePayloadDraft: Record<string, unknown>;
  writeBoundary: string;
  writeApprovalTier: string;
  approvalRequirements: {
    mandatoryReviewers: string[];
    requiredApprovals: string[];
    auditRequired: boolean;
    pilotEnabled: boolean;
    systemOfRecordWrite: boolean;
  };
  riskReviewSummary?: string | null;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  boundaryTrace: string[];
  confidence: number;
  openQuestions: string[];
  whatThisChanges: string;
  whatThisDoesNotMean: string;
};

export type OfficialWriteIntentContract = OfficialWriteIntentShared & {
  writeApprovalStatus: "pending_review";
  writeExecutionStatus: "requested";
  writeAcknowledgementStatus: "pending";
};

export type OfficialWriteIntentRuntimeItem = OfficialWriteIntentShared & {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  actionCategory: OfficialActionCoverageCategory;
  actionRiskClass: "low" | "medium" | "high" | "critical";
  actionDefaultPath: OfficialActionDefaultPathValue;
  acknowledgmentRequirement: string;
  rollbackExpectation: string;
  receiptStatus: OfficialReceiptStatusValue;
  receiptSummaryWritebackMode: OfficialSummaryWritebackModeValue;
  receiptSummary: string;
  manualFallbackRequired: boolean;
  escalationRequired: boolean;
  writeApprovalStatus: OfficialWriteApprovalStatus;
  writeExecutionStatus: OfficialWriteExecutionStatus;
  writeAcknowledgementStatus: OfficialWriteAcknowledgementStatus;
  reviewNotes: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectedByName: string | null;
  rejectedAt: Date | null;
  attemptedByName: string | null;
  attemptedAt: Date | null;
  acknowledgedByName: string | null;
  acknowledgedAt: Date | null;
  writeAcknowledgementPayload: Record<string, unknown> | null;
  writeFailureReason: string | null;
  manualReconciliationNote: string | null;
  deferredRetryNote: string | null;
  externalSystemReference: string | null;
  writeAuditRef: string | null;
};

export type OfficialWriteRuntimeSummary = {
  latestIntentEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  latestAttemptEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  latestAcknowledgementEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  sourceEligibility: {
    approvedShadowRecommendation: boolean;
    acknowledgedExecutionProofCount: number;
    eligibleIntentCount: number;
  };
  currentOfficial: {
    stage: OpportunityStage | null;
    nextAction: string | null;
    openBlockerCount: number;
  } | null;
  latestWriteback: {
    meetingPostMeetingSummary: string | null;
    opportunityNextStepSummary: string | null;
    latestCheckpoint: {
      id: string;
      kind: MemoryItemKind;
      summary: string;
      createdAt: Date;
    } | null;
  };
  intents: OfficialWriteIntentRuntimeItem[];
  limitedAuto: LimitedAutoRuntimeSummary | null;
  followThrough: OfficialFollowThroughRuntimeSummary | null;
};

type LimitedAutoIntentShared = {
  sourceWriteIntentId: string;
  officialSystemType: "crm";
  officialObjectRef: string;
  limitedAutoActionType: OfficialWriteActionTypeValue;
  limitedAutoEligibilityStatus: LimitedAutoEligibilityStatusValue;
  limitedAutoEligibilityReason: string;
  limitedAutoApprovalRequired: boolean;
  approvalRequirements: {
    mandatoryReviewers: string[];
    requiredApprovals: string[];
    auditRequired: boolean;
    pilotEnabled: boolean;
    systemOfRecordWrite: boolean;
  };
  proposedWritePayload: Record<string, unknown>;
  riskReviewSummary?: string | null;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  boundaryTrace: string[];
  confidence: number;
  openQuestions: string[];
  whatAutoPathWillDo: string;
  whatAutoPathWillNotDo: string;
  manualOnlyReason?: string | null;
};

export type LimitedAutoIntentContract = LimitedAutoIntentShared & {
  limitedAutoApprovalStatus: "pending_review";
  limitedAutoExecutionStatus: "requested";
  limitedAutoAckStatus: "pending";
  limitedAutoFailureStatus: "none";
  limitedAutoRollbackStatus: "not_required";
};

export type LimitedAutoIntentRuntimeItem = LimitedAutoIntentShared & {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  actionCategory: OfficialActionCoverageCategory;
  actionRiskClass: "low" | "medium" | "high" | "critical";
  actionDefaultPath: OfficialActionDefaultPathValue;
  acknowledgmentRequirement: string;
  rollbackExpectation: string;
  receiptStatus: OfficialReceiptStatusValue;
  receiptSummaryWritebackMode: OfficialSummaryWritebackModeValue;
  receiptSummary: string;
  manualFallbackRequired: boolean;
  escalationRequired: boolean;
  limitedAutoApprovalStatus: LimitedAutoApprovalStatus;
  limitedAutoExecutionStatus: LimitedAutoExecutionStatus;
  limitedAutoAckStatus: LimitedAutoAcknowledgementStatus;
  limitedAutoFailureStatus: LimitedAutoFailureStatus;
  limitedAutoRollbackStatus: LimitedAutoRollbackStatus;
  reviewNotes: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectedByName: string | null;
  rejectedAt: Date | null;
  attemptedByName: string | null;
  attemptedAt: Date | null;
  acknowledgedByName: string | null;
  acknowledgedAt: Date | null;
  limitedAutoAckPayload: Record<string, unknown> | null;
  limitedAutoFailureReason: string | null;
  manualReconciliationNote: string | null;
  deferredRetryNote: string | null;
  rollbackNote: string | null;
  externalSystemReference: string | null;
  limitedAutoAuditRef: string | null;
};

export type LimitedAutoRuntimeSummary = {
  latestEligibilityEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  latestExecutionEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  latestAcknowledgementEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  eligibilityCounts: {
    eligible: number;
    manualOnly: number;
    blocked: number;
    deferred: number;
  };
  intents: LimitedAutoIntentRuntimeItem[];
};

export type OfficialFollowThroughTypeValue =
  | "ack_success_followthrough"
  | "failure_followthrough"
  | "unknown_status_followthrough"
  | "stale_receipt_followthrough"
  | "partial_success_followthrough"
  | "manual_reconciliation_followthrough"
  | "escalation_followthrough"
  | "resolved_followthrough";

export type OfficialExceptionClassValue =
  | "ack_failure"
  | "ack_unknown"
  | "stale_receipt"
  | "partial_success"
  | "target_conflict"
  | "policy_conflict"
  | "approval_mismatch"
  | "manual_override_required";

export type OfficialReconciliationStatusValue = "not_required" | "required" | "in_progress" | "resolved";
export type OfficialFollowThroughStatusValue =
  | "open"
  | "investigating"
  | "awaiting_manual_action"
  | "awaiting_external_receipt"
  | "reconciled"
  | "resolved"
  | "closed_no_change"
  | "blocked_by_boundary";
export type OfficialFollowThroughResolutionStatusValue = "open" | "deferred" | "resolved" | "closed_no_change" | "blocked";

export type OfficialFollowThroughContract = {
  followThroughKey: string;
  sourceWriteIntentId: string | null;
  sourceLimitedAutoIntentId: string | null;
  sourceAckId: string | null;
  sourceActionType: OfficialWriteActionTypeValue | null;
  officialObjectRef: string;
  followThroughType: OfficialFollowThroughTypeValue;
  exceptionClass: OfficialExceptionClassValue | null;
  exceptionSeverity: "low" | "medium" | "high" | "critical";
  reconciliationStatus: OfficialReconciliationStatusValue;
  followThroughStatus: OfficialFollowThroughStatusValue;
  followThroughResolutionStatus: OfficialFollowThroughResolutionStatusValue;
  followThroughOwnerId: string | null;
  followThroughOwnerName: string | null;
  followThroughNextAction: string;
  followThroughDeadline: Date | null;
  followThroughBoundary: string;
  followThroughEvidenceRefs: string[];
  followThroughSummary: string;
  followThroughWritebackTargets: string[];
  managerAttentionRequired: boolean;
  manualFallbackRequired: boolean;
  roleHandoffImpact: string | null;
  summaryWritebackImpact: string | null;
  blockerSummaryImpact: string | null;
  escalationReason: string | null;
};

export type OfficialFollowThroughRuntimeItem = OfficialFollowThroughContract & {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  reconciliationNote: string | null;
  resolutionNote: string | null;
  auditRef: string | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OfficialFollowThroughRuntimeSummary = {
  latestSyncEvent: {
    id: string;
    status: RuntimeEventStatus;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
  openCount: number;
  managerAttentionCount: number;
  unresolvedCount: number;
  items: OfficialFollowThroughRuntimeItem[];
};

export type OfficialWriteShadowSource = {
  meetingId: string;
  opportunityId: string;
  companyId: string | null;
  bundleId: string;
  delta: OpportunityDeltaArtifact;
  currentStage: OpportunityStage;
  currentNextAction: string | null;
  sourceTitle: string;
};

export type OfficialWriteExecutionProofSource = {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  actionType: HumanActionExecutionType;
  sourceArtifactBundleId: string | null;
  sourceArtifactTitle: string;
  sourceArtifactSummary: string;
  audience: string;
  executionIntent: string;
  executionBoundary: string;
  executionRiskLevel: RiskLevel;
  riskReviewSummary: string | null;
  proofNote: string | null;
  externalReference: string | null;
  followThroughStatus: string | null;
  whatWasNotDone: string | null;
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
  boundaryTrace: string[];
};

function toOpportunityDeltaArtifact(
  input: Omit<OpportunityDeltaArtifact, "confidence"> & {
    confidence: number | null;
  },
): OpportunityDeltaArtifact {
  const { confidence, ...rest } = input;
  return {
    ...rest,
    confidence: confidence ?? 0,
  };
}

type Sprint6EvaluationResult = {
  writeIntentConsistencyPass: boolean;
  approvalMatrixEnforcementPass: boolean;
  shadowOfficialSeparationPass: boolean;
  evidenceSufficiencyPass: boolean;
  acknowledgementFailureCapturePass: boolean;
  noAutoWriteSafetyPass: boolean;
};

type Sprint8EvaluationResult = {
  eligibilityCorrectnessPass: boolean;
  whitelistEnforcementPass: boolean;
  noAutoWriteDefaultPass: boolean;
  acknowledgementBoundaryPass: boolean;
  manualOverridePass: boolean;
  shadowOfficialProofAckBoundaryPass: boolean;
};

type Sprint9EvaluationResult = {
  richerActionCoveragePass: boolean;
  richerEligibilityPass: boolean;
  richerExecutionPass: boolean;
  receiptInterpretationPass: boolean;
  reconciliationPathPass: boolean;
  manualFallbackPass: boolean;
  noBroadAutoWritePass: boolean;
  separationPass: boolean;
};

type Sprint10EvaluationResult = {
  followThroughClassificationPass: boolean;
  exceptionStateTransitionPass: boolean;
  reconciliationPathPass: boolean;
  manualOverrideEscalationPass: boolean;
  resolutionWritebackPass: boolean;
  officialSuccessConfusionPass: boolean;
  noBroadAutoWritePass: boolean;
};

const OFFICIAL_ACTION_TO_MATRIX_ACTION: Record<OfficialWriteActionTypeValue, Parameters<typeof resolveApprovalRule>[0]> = {
  "crm.update_official_stage": "crm.update_official_stage",
  "crm.update_next_action": "crm.update_next_action",
  "crm.update_blockers": "crm.update_blockers",
  "crm.attach_note": "crm.attach_note",
  "crm.attach_handoff_summary": "crm.attach_handoff_summary",
};

function parseJson<T>(value: string | null | undefined, fallback: T) {
  return safeParseJson<T>(value, fallback);
}

function mergeManagedSection(base: string | null | undefined, lines: string[]) {
  return mergeManagedSummarySection(base, OFFICIAL_WRITE_SECTION_MARKER, lines);
}

function mergeFollowThroughManagedSection(base: string | null | undefined, lines: string[]) {
  return mergeManagedSummarySection(base, OFFICIAL_FOLLOW_THROUGH_SECTION_MARKER, lines);
}

function buildSourceKey(kind: "shadow" | "execution", ref: string, actionType: OfficialWriteActionTypeValue) {
  return `${kind}:${ref}:${actionType}`;
}

function listUniqueStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value!) === index) as string[];
}

function toActionTypeValue(value: OfficialWriteActionType): OfficialWriteActionTypeValue {
  switch (value) {
    case OfficialWriteActionType.CRM_UPDATE_OFFICIAL_STAGE:
      return "crm.update_official_stage";
    case OfficialWriteActionType.CRM_UPDATE_NEXT_ACTION:
      return "crm.update_next_action";
    case OfficialWriteActionType.CRM_UPDATE_BLOCKERS:
      return "crm.update_blockers";
    case OfficialWriteActionType.CRM_ATTACH_NOTE:
      return "crm.attach_note";
    case OfficialWriteActionType.CRM_ATTACH_HANDOFF_SUMMARY:
      return "crm.attach_handoff_summary";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official write action type: ${exhaustive}`);
}

function fromActionTypeValue(value: OfficialWriteActionTypeValue): OfficialWriteActionType {
  switch (value) {
    case "crm.update_official_stage":
      return OfficialWriteActionType.CRM_UPDATE_OFFICIAL_STAGE;
    case "crm.update_next_action":
      return OfficialWriteActionType.CRM_UPDATE_NEXT_ACTION;
    case "crm.update_blockers":
      return OfficialWriteActionType.CRM_UPDATE_BLOCKERS;
    case "crm.attach_note":
      return OfficialWriteActionType.CRM_ATTACH_NOTE;
    case "crm.attach_handoff_summary":
      return OfficialWriteActionType.CRM_ATTACH_HANDOFF_SUMMARY;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official write action type value: ${exhaustive}`);
}

function renderActionLabel(actionType: OfficialWriteActionTypeValue) {
  switch (actionType) {
    case "crm.update_official_stage":
      return "CRM official stage update";
    case "crm.update_next_action":
      return "CRM next action update";
    case "crm.update_blockers":
      return "CRM blockers update";
    case "crm.attach_note":
      return "CRM note attach";
    case "crm.attach_handoff_summary":
      return "CRM handoff summary attach";
  }

  const exhaustive: never = actionType;
  throw new Error(`Unsupported official write action label: ${exhaustive}`);
}

function getOfficialActionCoverage(actionType: OfficialWriteActionTypeValue): OfficialActionCoverageDescriptor {
  return OFFICIAL_ACTION_COVERAGE[actionType];
}

export function getRicherOfficialActionCoverageCatalog() {
  return Object.values(OFFICIAL_ACTION_COVERAGE);
}

function buildWhatDoesNotMean() {
  return `${OFFICIAL_WRITE_DOES_NOT_MEAN_NOTE} ${OFFICIAL_WRITE_APPROVAL_NOTE} ${OFFICIAL_WRITE_SUCCESS_NOTE}`;
}

function buildLimitedAutoWhatWillNotDo() {
  return `${LIMITED_AUTO_DOES_NOT_MEAN_NOTE} ${buildWhatDoesNotMean()} ${LIMITED_AUTO_MANUAL_OVERRIDE_NOTE}`;
}

function buildReceiptSummary(
  receiptStatus: OfficialReceiptStatusValue,
  note?: string | null,
  externalSystemReference?: string | null,
) {
  const reference = externalSystemReference?.trim() ? ` (${externalSystemReference.trim()})` : "";
  const detail = note?.trim() ? ` ${note.trim()}` : "";

  switch (receiptStatus) {
    case "acknowledged_success":
      return `acknowledged success${reference}.${detail}`.trim();
    case "acknowledged_failure":
      return `acknowledged failure${reference}.${detail}`.trim();
    case "timeout_unknown":
      return `receipt timeout / unknown${reference}. manual reconciliation required.${detail}`.trim();
    case "partial_success":
      return `partial success${reference}. manual reconciliation required before Helm can claim official success.${detail}`.trim();
    case "stale_receipt":
      return `stale receipt${reference}. this stays audit-only until a human resolves the mismatch.${detail}`.trim();
    case "manual_reconciliation_required":
      return `manual reconciliation required${reference}.${detail}`.trim();
    case "manual_reconciliation_resolved":
      return `manual reconciliation resolved${reference}.${detail}`.trim();
    case "retry_skipped":
      return `retry skipped${reference}. follow-up remains manual.${detail}`.trim();
  }

  const exhaustive: never = receiptStatus;
  throw new Error(`Unsupported receipt status summary: ${exhaustive}`);
}

function buildOfficialReceiptTrace(input: {
  receiptStatus: OfficialReceiptStatusValue;
  note?: string | null;
  externalSystemReference?: string | null;
}) {
  const summaryWritebackMode: OfficialSummaryWritebackModeValue =
    input.receiptStatus === "acknowledged_success"
      ? "full"
      : input.receiptStatus === "stale_receipt"
        ? "audit_only"
        : "reconciliation_note";
  const manualFallbackRequired =
    input.receiptStatus !== "acknowledged_success" && input.receiptStatus !== "manual_reconciliation_resolved";
  const escalationRequired =
    input.receiptStatus === "stale_receipt" ||
    input.receiptStatus === "partial_success" ||
    input.receiptStatus === "timeout_unknown";

  return {
    receiptStatus: input.receiptStatus,
    summaryWritebackMode,
    manualFallbackRequired,
    escalationRequired,
    officialOutcomeTruth: input.receiptStatus === "acknowledged_success" ? "official_success" : "not_confirmed",
    receiptSummary: buildReceiptSummary(input.receiptStatus, input.note, input.externalSystemReference),
  };
}

function toReceiptTrace(value: Record<string, unknown> | null, fallback: {
  receiptStatus: OfficialReceiptStatusValue;
  summaryWritebackMode: OfficialSummaryWritebackModeValue;
  manualFallbackRequired: boolean;
  escalationRequired: boolean;
  receiptSummary: string;
}) {
  const receiptStatus =
    typeof value?.receiptStatus === "string" ? (value.receiptStatus as OfficialReceiptStatusValue) : fallback.receiptStatus;
  const summaryWritebackMode =
    typeof value?.summaryWritebackMode === "string"
      ? (value.summaryWritebackMode as OfficialSummaryWritebackModeValue)
      : fallback.summaryWritebackMode;
  const manualFallbackRequired =
    typeof value?.manualFallbackRequired === "boolean" ? value.manualFallbackRequired : fallback.manualFallbackRequired;
  const escalationRequired =
    typeof value?.escalationRequired === "boolean" ? value.escalationRequired : fallback.escalationRequired;
  const receiptSummary =
    typeof value?.receiptSummary === "string" && value.receiptSummary.trim().length > 0
      ? value.receiptSummary
      : fallback.receiptSummary;

  return {
    receiptStatus,
    summaryWritebackMode,
    manualFallbackRequired,
    escalationRequired,
    receiptSummary,
  };
}

function toLimitedAutoEligibilityStatusValue(value: LimitedAutoEligibilityStatus): LimitedAutoEligibilityStatusValue {
  switch (value) {
    case LimitedAutoEligibilityStatus.ELIGIBLE:
      return "eligible";
    case LimitedAutoEligibilityStatus.ELIGIBLE_BUT_MANUAL_ONLY:
      return "eligible_but_manual_only";
    case LimitedAutoEligibilityStatus.BLOCKED:
      return "blocked";
    case LimitedAutoEligibilityStatus.DEFERRED:
      return "deferred";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported limited auto eligibility status: ${exhaustive}`);
}

function fromLimitedAutoEligibilityStatusValue(value: LimitedAutoEligibilityStatusValue): LimitedAutoEligibilityStatus {
  switch (value) {
    case "eligible":
      return LimitedAutoEligibilityStatus.ELIGIBLE;
    case "eligible_but_manual_only":
      return LimitedAutoEligibilityStatus.ELIGIBLE_BUT_MANUAL_ONLY;
    case "blocked":
      return LimitedAutoEligibilityStatus.BLOCKED;
    case "deferred":
      return LimitedAutoEligibilityStatus.DEFERRED;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported limited auto eligibility value: ${exhaustive}`);
}

function toOfficialFollowThroughTypeValue(value: OfficialFollowThroughType): OfficialFollowThroughTypeValue {
  switch (value) {
    case OfficialFollowThroughType.ACK_SUCCESS_FOLLOWTHROUGH:
      return "ack_success_followthrough";
    case OfficialFollowThroughType.FAILURE_FOLLOWTHROUGH:
      return "failure_followthrough";
    case OfficialFollowThroughType.UNKNOWN_STATUS_FOLLOWTHROUGH:
      return "unknown_status_followthrough";
    case OfficialFollowThroughType.STALE_RECEIPT_FOLLOWTHROUGH:
      return "stale_receipt_followthrough";
    case OfficialFollowThroughType.PARTIAL_SUCCESS_FOLLOWTHROUGH:
      return "partial_success_followthrough";
    case OfficialFollowThroughType.MANUAL_RECONCILIATION_FOLLOWTHROUGH:
      return "manual_reconciliation_followthrough";
    case OfficialFollowThroughType.ESCALATION_FOLLOWTHROUGH:
      return "escalation_followthrough";
    case OfficialFollowThroughType.RESOLVED_FOLLOWTHROUGH:
      return "resolved_followthrough";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through type: ${exhaustive}`);
}

function fromOfficialFollowThroughTypeValue(value: OfficialFollowThroughTypeValue): OfficialFollowThroughType {
  switch (value) {
    case "ack_success_followthrough":
      return OfficialFollowThroughType.ACK_SUCCESS_FOLLOWTHROUGH;
    case "failure_followthrough":
      return OfficialFollowThroughType.FAILURE_FOLLOWTHROUGH;
    case "unknown_status_followthrough":
      return OfficialFollowThroughType.UNKNOWN_STATUS_FOLLOWTHROUGH;
    case "stale_receipt_followthrough":
      return OfficialFollowThroughType.STALE_RECEIPT_FOLLOWTHROUGH;
    case "partial_success_followthrough":
      return OfficialFollowThroughType.PARTIAL_SUCCESS_FOLLOWTHROUGH;
    case "manual_reconciliation_followthrough":
      return OfficialFollowThroughType.MANUAL_RECONCILIATION_FOLLOWTHROUGH;
    case "escalation_followthrough":
      return OfficialFollowThroughType.ESCALATION_FOLLOWTHROUGH;
    case "resolved_followthrough":
      return OfficialFollowThroughType.RESOLVED_FOLLOWTHROUGH;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through type value: ${exhaustive}`);
}

function toOfficialExceptionClassValue(value: OfficialExceptionClass | null): OfficialExceptionClassValue | null {
  if (!value) return null;

  switch (value) {
    case OfficialExceptionClass.ACK_FAILURE:
      return "ack_failure";
    case OfficialExceptionClass.ACK_UNKNOWN:
      return "ack_unknown";
    case OfficialExceptionClass.STALE_RECEIPT:
      return "stale_receipt";
    case OfficialExceptionClass.PARTIAL_SUCCESS:
      return "partial_success";
    case OfficialExceptionClass.TARGET_CONFLICT:
      return "target_conflict";
    case OfficialExceptionClass.POLICY_CONFLICT:
      return "policy_conflict";
    case OfficialExceptionClass.APPROVAL_MISMATCH:
      return "approval_mismatch";
    case OfficialExceptionClass.MANUAL_OVERRIDE_REQUIRED:
      return "manual_override_required";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official exception class: ${exhaustive}`);
}

function fromOfficialExceptionClassValue(value: OfficialExceptionClassValue | null): OfficialExceptionClass | null {
  if (!value) return null;

  switch (value) {
    case "ack_failure":
      return OfficialExceptionClass.ACK_FAILURE;
    case "ack_unknown":
      return OfficialExceptionClass.ACK_UNKNOWN;
    case "stale_receipt":
      return OfficialExceptionClass.STALE_RECEIPT;
    case "partial_success":
      return OfficialExceptionClass.PARTIAL_SUCCESS;
    case "target_conflict":
      return OfficialExceptionClass.TARGET_CONFLICT;
    case "policy_conflict":
      return OfficialExceptionClass.POLICY_CONFLICT;
    case "approval_mismatch":
      return OfficialExceptionClass.APPROVAL_MISMATCH;
    case "manual_override_required":
      return OfficialExceptionClass.MANUAL_OVERRIDE_REQUIRED;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official exception class value: ${exhaustive}`);
}

function toOfficialReconciliationStatusValue(value: OfficialReconciliationStatus): OfficialReconciliationStatusValue {
  switch (value) {
    case OfficialReconciliationStatus.NOT_REQUIRED:
      return "not_required";
    case OfficialReconciliationStatus.REQUIRED:
      return "required";
    case OfficialReconciliationStatus.IN_PROGRESS:
      return "in_progress";
    case OfficialReconciliationStatus.RESOLVED:
      return "resolved";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official reconciliation status: ${exhaustive}`);
}

function fromOfficialReconciliationStatusValue(value: OfficialReconciliationStatusValue): OfficialReconciliationStatus {
  switch (value) {
    case "not_required":
      return OfficialReconciliationStatus.NOT_REQUIRED;
    case "required":
      return OfficialReconciliationStatus.REQUIRED;
    case "in_progress":
      return OfficialReconciliationStatus.IN_PROGRESS;
    case "resolved":
      return OfficialReconciliationStatus.RESOLVED;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official reconciliation status value: ${exhaustive}`);
}

function toOfficialFollowThroughStatusValue(value: OfficialFollowThroughStatus): OfficialFollowThroughStatusValue {
  switch (value) {
    case OfficialFollowThroughStatus.OPEN:
      return "open";
    case OfficialFollowThroughStatus.INVESTIGATING:
      return "investigating";
    case OfficialFollowThroughStatus.AWAITING_MANUAL_ACTION:
      return "awaiting_manual_action";
    case OfficialFollowThroughStatus.AWAITING_EXTERNAL_RECEIPT:
      return "awaiting_external_receipt";
    case OfficialFollowThroughStatus.RECONCILED:
      return "reconciled";
    case OfficialFollowThroughStatus.RESOLVED:
      return "resolved";
    case OfficialFollowThroughStatus.CLOSED_NO_CHANGE:
      return "closed_no_change";
    case OfficialFollowThroughStatus.BLOCKED_BY_BOUNDARY:
      return "blocked_by_boundary";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through status: ${exhaustive}`);
}

function fromOfficialFollowThroughStatusValue(value: OfficialFollowThroughStatusValue): OfficialFollowThroughStatus {
  switch (value) {
    case "open":
      return OfficialFollowThroughStatus.OPEN;
    case "investigating":
      return OfficialFollowThroughStatus.INVESTIGATING;
    case "awaiting_manual_action":
      return OfficialFollowThroughStatus.AWAITING_MANUAL_ACTION;
    case "awaiting_external_receipt":
      return OfficialFollowThroughStatus.AWAITING_EXTERNAL_RECEIPT;
    case "reconciled":
      return OfficialFollowThroughStatus.RECONCILED;
    case "resolved":
      return OfficialFollowThroughStatus.RESOLVED;
    case "closed_no_change":
      return OfficialFollowThroughStatus.CLOSED_NO_CHANGE;
    case "blocked_by_boundary":
      return OfficialFollowThroughStatus.BLOCKED_BY_BOUNDARY;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through status value: ${exhaustive}`);
}

function toOfficialFollowThroughResolutionStatusValue(
  value: OfficialFollowThroughResolutionStatus,
): OfficialFollowThroughResolutionStatusValue {
  switch (value) {
    case OfficialFollowThroughResolutionStatus.OPEN:
      return "open";
    case OfficialFollowThroughResolutionStatus.DEFERRED:
      return "deferred";
    case OfficialFollowThroughResolutionStatus.RESOLVED:
      return "resolved";
    case OfficialFollowThroughResolutionStatus.CLOSED_NO_CHANGE:
      return "closed_no_change";
    case OfficialFollowThroughResolutionStatus.BLOCKED:
      return "blocked";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through resolution status: ${exhaustive}`);
}

function fromOfficialFollowThroughResolutionStatusValue(
  value: OfficialFollowThroughResolutionStatusValue,
): OfficialFollowThroughResolutionStatus {
  switch (value) {
    case "open":
      return OfficialFollowThroughResolutionStatus.OPEN;
    case "deferred":
      return OfficialFollowThroughResolutionStatus.DEFERRED;
    case "resolved":
      return OfficialFollowThroughResolutionStatus.RESOLVED;
    case "closed_no_change":
      return OfficialFollowThroughResolutionStatus.CLOSED_NO_CHANGE;
    case "blocked":
      return OfficialFollowThroughResolutionStatus.BLOCKED;
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through resolution status value: ${exhaustive}`);
}

function renderFollowThroughTypeLabel(value: OfficialFollowThroughTypeValue) {
  switch (value) {
    case "ack_success_followthrough":
      return "ack success follow-through";
    case "failure_followthrough":
      return "failure follow-through";
    case "unknown_status_followthrough":
      return "unknown status follow-through";
    case "stale_receipt_followthrough":
      return "stale receipt follow-through";
    case "partial_success_followthrough":
      return "partial success follow-through";
    case "manual_reconciliation_followthrough":
      return "manual reconciliation follow-through";
    case "escalation_followthrough":
      return "escalation follow-through";
    case "resolved_followthrough":
      return "resolved follow-through";
  }

  const exhaustive: never = value;
  throw new Error(`Unsupported official follow-through label: ${exhaustive}`);
}

export type OfficialFollowThroughUpdateMode =
  | "assign_owner"
  | "mark_next_action"
  | "add_reconciliation_note"
  | "mark_investigating"
  | "mark_awaiting_external_receipt"
  | "resolve"
  | "close_no_change"
  | "defer"
  | "escalate_manager"
  | "force_manual_fallback"
  | "block_boundary";

const OFFICIAL_FOLLOW_THROUGH_TRANSITIONS: Record<
  OfficialFollowThroughStatusValue,
  OfficialFollowThroughStatusValue[]
> = {
  open: [
    "investigating",
    "awaiting_manual_action",
    "awaiting_external_receipt",
    "resolved",
    "closed_no_change",
    "blocked_by_boundary",
  ],
  investigating: ["awaiting_manual_action", "awaiting_external_receipt", "reconciled", "resolved", "blocked_by_boundary"],
  awaiting_manual_action: ["investigating", "resolved", "closed_no_change", "blocked_by_boundary"],
  awaiting_external_receipt: ["investigating", "reconciled", "resolved", "blocked_by_boundary"],
  reconciled: ["resolved", "closed_no_change"],
  resolved: ["resolved"],
  closed_no_change: ["closed_no_change"],
  blocked_by_boundary: ["blocked_by_boundary"],
};

function buildOfficialFollowThroughKey(kind: "intent" | "manual_override", ref: string, followType: OfficialFollowThroughTypeValue) {
  return `official-followthrough:${kind}:${ref}:${followType}`;
}

function buildFollowThroughDeadline(severity: "low" | "medium" | "high" | "critical") {
  const now = Date.now();
  const days =
    severity === "critical" ? 1 : severity === "high" ? 2 : severity === "medium" ? 3 : 5;
  return new Date(now + days * 24 * 60 * 60 * 1000);
}

function buildFollowThroughWritebackTargets(input: {
  actionType: OfficialWriteActionTypeValue | null;
  managerAttentionRequired: boolean;
  roleHandoffImpact: string | null;
  blockerSummaryImpact: string | null;
}) {
  return listUniqueStrings([
    "audit",
    "meeting_summary",
    "opportunity_summary",
    "checkpoint_memory",
    input.roleHandoffImpact ? "role_handoff_summary" : null,
    input.blockerSummaryImpact ? "blocker_summary" : null,
    input.managerAttentionRequired ? "manager_attention_summary" : null,
    input.actionType === "crm.attach_handoff_summary" ? "handoff_memory" : null,
  ]);
}

function buildFollowThroughSummary(contract: Omit<OfficialFollowThroughContract, "followThroughSummary">) {
  const exceptionPart = contract.exceptionClass ? ` exception=${contract.exceptionClass}.` : "";
  return `${renderFollowThroughTypeLabel(contract.followThroughType)} for ${contract.officialObjectRef}.${exceptionPart} next=${contract.followThroughNextAction}`;
}

function buildFollowThroughContractFromIntent(input: {
  intent: OfficialWriteIntentRuntimeItem;
  linkedLimitedAutoIntent?: LimitedAutoIntentRuntimeItem | null;
}) {
  const actionType = input.intent.writeActionType;
  const roleHandoffImpact =
    actionType === "crm.attach_handoff_summary"
      ? "Delivery / CS handoff surfaces should consume the latest official handoff outcome."
      : null;
  const blockerSummaryImpact =
    actionType === "crm.update_blockers" ||
    input.intent.receiptStatus === "partial_success" ||
    input.intent.receiptStatus === "stale_receipt" ||
    input.intent.receiptStatus === "timeout_unknown"
      ? "Current blocker / campaign summary should reflect the unresolved official outcome."
      : null;

  let followThroughType: OfficialFollowThroughTypeValue = "ack_success_followthrough";
  let exceptionClass: OfficialExceptionClassValue | null = null;
  let reconciliationStatus: OfficialReconciliationStatusValue = "not_required";
  let followThroughStatus: OfficialFollowThroughStatusValue = "open";
  let followThroughResolutionStatus: OfficialFollowThroughResolutionStatusValue = "open";
  let nextAction = `Confirm downstream summary and handoff surfaces reflect ${renderActionLabel(actionType)}.`;
  let managerAttentionRequired = input.intent.actionRiskClass === "high" || input.intent.actionRiskClass === "critical";
  let manualFallbackRequired = false;
  let escalationReason: string | null = null;

  if (input.intent.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.FAILURE) {
    followThroughType = "failure_followthrough";
    exceptionClass = "ack_failure";
    reconciliationStatus = "required";
    followThroughStatus = "awaiting_manual_action";
    nextAction = "Operator must investigate the failed official write and choose retry, correction, or manual fallback.";
    managerAttentionRequired = true;
    manualFallbackRequired = true;
    escalationReason = "ack failure requires human follow-through before Helm may claim any official progress.";
  } else if (input.intent.receiptStatus === "timeout_unknown") {
    followThroughType = "unknown_status_followthrough";
    exceptionClass = "ack_unknown";
    reconciliationStatus = "required";
    followThroughStatus = "awaiting_external_receipt";
    nextAction = "Wait for external receipt or trigger manual reconciliation; unknown is never treated as official success.";
    managerAttentionRequired = true;
    manualFallbackRequired = true;
    escalationReason = "timeout / unknown receipt requires manual reconciliation.";
  } else if (input.intent.receiptStatus === "stale_receipt") {
    followThroughType = "stale_receipt_followthrough";
    exceptionClass = "stale_receipt";
    reconciliationStatus = "required";
    followThroughStatus = "investigating";
    nextAction = "Investigate the stale receipt, record reconciliation notes, and keep the path audit-only until resolved.";
    managerAttentionRequired = true;
    manualFallbackRequired = true;
    escalationReason = "stale receipt means Helm cannot trust the external outcome yet.";
  } else if (input.intent.receiptStatus === "partial_success") {
    followThroughType = "partial_success_followthrough";
    exceptionClass = "partial_success";
    reconciliationStatus = "required";
    followThroughStatus = "awaiting_manual_action";
    nextAction = "Resolve the partial success manually before any official success claim is made.";
    managerAttentionRequired = true;
    manualFallbackRequired = true;
    escalationReason = "partial success must stay in reconciliation until a human resolves the mismatch.";
  } else if (input.intent.receiptStatus === "manual_reconciliation_required") {
    followThroughType = "manual_reconciliation_followthrough";
    exceptionClass = "ack_unknown";
    reconciliationStatus = "in_progress";
    followThroughStatus = "investigating";
    nextAction = "Record reconciliation steps and keep the official outcome in manual handling until the external state is clear.";
    managerAttentionRequired = true;
    manualFallbackRequired = true;
  } else if (input.intent.receiptStatus === "manual_reconciliation_resolved") {
    followThroughType = "resolved_followthrough";
    reconciliationStatus = "resolved";
    followThroughStatus = "reconciled";
    followThroughResolutionStatus = "open";
    nextAction = "Close the reconciled path with a final resolution note and update downstream summaries.";
    manualFallbackRequired = false;
  }

  const contractBase: Omit<OfficialFollowThroughContract, "followThroughSummary"> = {
    followThroughKey: buildOfficialFollowThroughKey("intent", input.intent.id, followThroughType),
    sourceWriteIntentId: input.intent.id,
    sourceLimitedAutoIntentId: input.linkedLimitedAutoIntent?.id ?? null,
    sourceAckId: input.intent.id,
    sourceActionType: actionType,
    officialObjectRef: input.intent.officialObjectRef,
    followThroughType,
    exceptionClass,
    exceptionSeverity: input.intent.actionRiskClass,
    reconciliationStatus,
    followThroughStatus,
    followThroughResolutionStatus,
    followThroughOwnerId: null,
    followThroughOwnerName: input.intent.approvedByName ?? input.intent.acknowledgedByName ?? null,
    followThroughNextAction: nextAction,
    followThroughDeadline: buildFollowThroughDeadline(input.intent.actionRiskClass),
    followThroughBoundary: `${OFFICIAL_FOLLOW_THROUGH_BOUNDARY_NOTE} ${OFFICIAL_FOLLOW_THROUGH_DOES_NOT_MEAN_NOTE}`,
    followThroughEvidenceRefs: input.intent.evidenceRefs,
    followThroughWritebackTargets: [],
    managerAttentionRequired,
    manualFallbackRequired,
    roleHandoffImpact,
    summaryWritebackImpact:
      "Meeting / opportunity summary should show official outcome follow-through, not just the raw ack event.",
    blockerSummaryImpact,
    escalationReason,
  };

  const withTargets = {
    ...contractBase,
    followThroughWritebackTargets: buildFollowThroughWritebackTargets({
      actionType,
      managerAttentionRequired,
      roleHandoffImpact,
      blockerSummaryImpact,
    }),
  };

  return {
    ...withTargets,
    followThroughSummary: buildFollowThroughSummary(withTargets),
  } satisfies OfficialFollowThroughContract;
}

function buildManualOverrideFollowThroughContract(input: { limitedAutoIntent: LimitedAutoIntentRuntimeItem }) {
  const contractBase: Omit<OfficialFollowThroughContract, "followThroughSummary"> = {
    followThroughKey: buildOfficialFollowThroughKey("manual_override", input.limitedAutoIntent.id, "escalation_followthrough"),
    sourceWriteIntentId: input.limitedAutoIntent.sourceWriteIntentId,
    sourceLimitedAutoIntentId: input.limitedAutoIntent.id,
    sourceAckId: null,
    sourceActionType: input.limitedAutoIntent.limitedAutoActionType,
    officialObjectRef: input.limitedAutoIntent.officialObjectRef,
    followThroughType: "escalation_followthrough",
    exceptionClass: "manual_override_required",
    exceptionSeverity: input.limitedAutoIntent.actionRiskClass,
    reconciliationStatus: "not_required",
    followThroughStatus: "awaiting_manual_action",
    followThroughResolutionStatus: "open",
    followThroughOwnerId: null,
    followThroughOwnerName: input.limitedAutoIntent.approvedByName ?? null,
    followThroughNextAction: "Manual override requires operator handling before any official path continues.",
    followThroughDeadline: buildFollowThroughDeadline(input.limitedAutoIntent.actionRiskClass),
    followThroughBoundary: `${LIMITED_AUTO_MANUAL_OVERRIDE_NOTE} ${OFFICIAL_FOLLOW_THROUGH_DOES_NOT_MEAN_NOTE}`,
    followThroughEvidenceRefs: input.limitedAutoIntent.evidenceRefs,
    followThroughWritebackTargets: [],
    managerAttentionRequired: input.limitedAutoIntent.actionRiskClass === "high" || input.limitedAutoIntent.actionRiskClass === "critical",
    manualFallbackRequired: true,
    roleHandoffImpact: null,
    summaryWritebackImpact: "Manual override should remain visible in official integration summaries so the team knows the path is back on human handling.",
    blockerSummaryImpact:
      input.limitedAutoIntent.actionRiskClass === "high" || input.limitedAutoIntent.actionRiskClass === "critical"
        ? "Current blocker summary should reflect that the official auto path was overridden."
        : null,
    escalationReason: input.limitedAutoIntent.manualOnlyReason ?? "Force manual path was selected on the limited auto surface.",
  };

  const withTargets = {
    ...contractBase,
    followThroughWritebackTargets: buildFollowThroughWritebackTargets({
      actionType: input.limitedAutoIntent.limitedAutoActionType,
      managerAttentionRequired: contractBase.managerAttentionRequired,
      roleHandoffImpact: null,
      blockerSummaryImpact: contractBase.blockerSummaryImpact,
    }),
  };

  return {
    ...withTargets,
    followThroughSummary: buildFollowThroughSummary(withTargets),
  } satisfies OfficialFollowThroughContract;
}

export function buildOfficialFollowThroughContracts(input: {
  officialWriteIntents: OfficialWriteIntentRuntimeItem[];
  limitedAutoIntents?: LimitedAutoIntentRuntimeItem[];
}) {
  const limitedAutoByWriteIntentId = new Map(
    (input.limitedAutoIntents ?? []).map((item) => [item.sourceWriteIntentId, item]),
  );

  return [
    ...input.officialWriteIntents
      .filter((item) => item.writeAcknowledgementStatus !== OfficialWriteAcknowledgementStatus.PENDING)
      .map((item) =>
        buildFollowThroughContractFromIntent({
          intent: item,
          linkedLimitedAutoIntent: limitedAutoByWriteIntentId.get(item.id) ?? null,
        }),
      ),
    ...(input.limitedAutoIntents ?? [])
      .filter((item) => item.limitedAutoApprovalStatus === LimitedAutoApprovalStatus.MANUAL_OVERRIDE)
      .map((item) => buildManualOverrideFollowThroughContract({ limitedAutoIntent: item })),
  ];
}

function buildLimitedAutoSourceKey(sourceWriteIntentId: string) {
  return `limited-auto:${sourceWriteIntentId}`;
}

type LimitedAutoSourceIntent = Pick<
  OfficialWriteIntentShared,
  | "officialSystemType"
  | "officialObjectRef"
  | "writeActionType"
  | "approvalRequirements"
  | "riskReviewSummary"
  | "evidenceRefs"
  | "sourceProvenance"
  | "boundaryTrace"
  | "confidence"
  | "openQuestions"
  | "writePayloadDraft"
  | "writeBoundary"
  | "whatThisDoesNotMean"
  | "whatThisChanges"
> & {
  id?: string;
  writeApprovalStatus?: OfficialWriteApprovalStatus | OfficialWriteIntentContract["writeApprovalStatus"];
};

function evaluateLimitedAutoEligibility(input: { intent: LimitedAutoSourceIntent }) {
  const sourceId = input.intent.id ?? buildLimitedAutoSourceKey(input.intent.whatThisChanges);
  const rule = resolveApprovalRule(OFFICIAL_ACTION_TO_MATRIX_ACTION[input.intent.writeActionType]);
  const coverage = getOfficialActionCoverage(input.intent.writeActionType);

  if (!LIMITED_AUTO_ALLOWED_ACTIONS.has(input.intent.writeActionType)) {
    return {
      status: "blocked" as const,
      reason: `${renderActionLabel(input.intent.writeActionType)} stays outside the Sprint 9 limited-auto whitelist. ${coverage.boundaryReason}`,
      manualOnlyReason: null,
      sourceId,
    };
  }

  if (input.intent.writeApprovalStatus && input.intent.writeApprovalStatus !== OfficialWriteApprovalStatus.APPROVED && input.intent.writeApprovalStatus !== "pending_review") {
    return {
      status: "deferred" as const,
      reason: "The guarded write source is no longer in an approval posture that can enter limited auto review.",
      manualOnlyReason: null,
      sourceId,
    };
  }

  if (input.intent.evidenceRefs.length === 0 || input.intent.sourceProvenance.length === 0) {
    return {
      status: "blocked" as const,
      reason: "Evidence refs and source provenance are both required before any limited auto path can be considered.",
      manualOnlyReason: null,
      sourceId,
    };
  }

  if (!input.intent.writeBoundary.includes("auto-write") || !input.intent.whatThisDoesNotMean.includes("official CRM")) {
    return {
      status: "blocked" as const,
      reason: "Boundary posture is not explicit enough; the source still needs clearer no-auto-write and official CRM separation markers.",
      manualOnlyReason: null,
      sourceId,
    };
  }

  if (!rule.auditRequired || !input.intent.approvalRequirements.systemOfRecordWrite) {
    return {
      status: "blocked" as const,
      reason: "The official write path must stay audit-required and system-of-record aware before limited auto can even be reviewed.",
      manualOnlyReason: null,
      sourceId,
    };
  }

  if (coverage.limitedAutoStatus === "deferred") {
    return {
      status: "deferred" as const,
      reason: coverage.boundaryReason,
      manualOnlyReason: "This action remains deferred in current main.",
      sourceId,
    };
  }

  if (coverage.limitedAutoStatus === "eligible_but_manual_only" || !LIMITED_AUTO_EXECUTABLE_ACTIONS.has(input.intent.writeActionType)) {
    return {
      status: "eligible_but_manual_only" as const,
      reason: `${coverage.boundaryReason} It stays reviewable in Sprint 9, but still does not enter executable limited auto.`,
      manualOnlyReason:
        input.intent.writeActionType === "crm.attach_handoff_summary"
          ? "crm.attach_handoff_summary remains manual-only because it is higher consequence, pilot-disabled in the approval matrix, and still needs a stronger rollback story."
          : input.intent.writeActionType === "crm.update_blockers"
            ? "crm.update_blockers remains manual-only because blocker/risk metadata can fan out across multiple official rows and still needs richer reconciliation / rollback semantics."
            : "Current main still keeps this action on the guarded manual path.",
      sourceId,
    };
  }

  if (!rule.pilotEnabled) {
    return {
      status: "eligible_but_manual_only" as const,
      reason: "Current approval matrix keeps this action pilot-disabled, so it cannot move into limited auto yet.",
      manualOnlyReason: "pilotEnabled is false for this official action type.",
      sourceId,
    };
  }

  return {
    status: "eligible" as const,
    reason: `${coverage.boundaryReason} Explicit approval, evidence refs, provenance, strong acknowledgement, and force-manual override are all still required.`,
    manualOnlyReason: null,
    sourceId,
  };
}

function buildLimitedAutoWhatWillDo(actionType: OfficialWriteActionTypeValue, eligibility: LimitedAutoEligibilityStatusValue) {
  const coverage = getOfficialActionCoverage(actionType);
  if (eligibility !== "eligible") {
    return `This source can be reviewed for limited auto posture, but current main still keeps ${renderActionLabel(actionType)} on a non-executing or manual-only path until the eligibility blockers are cleared. Current coverage posture: ${coverage.defaultPath}.`;
  }

  if (actionType === "crm.attach_note") {
    return "After explicit limited-auto approval, Helm may attempt the whitelisted CRM note attach through a constrained adapter stub and will only treat it as official success after acknowledged_success.";
  }

  if (actionType === "crm.update_next_action") {
    return "After explicit limited-auto approval, Helm may attempt the whitelisted CRM next-action update through a constrained adapter stub and will only treat it as official success after acknowledged_success.";
  }

  return `After explicit limited-auto approval, Helm may attempt ${renderActionLabel(actionType)} through the constrained official path.`;
}

export function buildLimitedAutoIntentContracts(input: {
  officialWriteIntents: LimitedAutoSourceIntent[];
}) {
  return input.officialWriteIntents
    .filter((intent) => LIMITED_AUTO_ALLOWED_ACTIONS.has(intent.writeActionType))
    .map((intent) => {
    const eligibility = evaluateLimitedAutoEligibility({ intent });
    return {
      sourceWriteIntentId: intent.id ?? eligibility.sourceId,
      officialSystemType: intent.officialSystemType,
      officialObjectRef: intent.officialObjectRef,
      limitedAutoActionType: intent.writeActionType,
      limitedAutoEligibilityStatus: eligibility.status,
      limitedAutoEligibilityReason: eligibility.reason,
      limitedAutoApprovalRequired: true,
      limitedAutoApprovalStatus: "pending_review",
      limitedAutoExecutionStatus: "requested",
      limitedAutoAckStatus: "pending",
      limitedAutoFailureStatus: "none",
      limitedAutoRollbackStatus: "not_required",
      approvalRequirements: intent.approvalRequirements,
      proposedWritePayload: intent.writePayloadDraft,
      riskReviewSummary: intent.riskReviewSummary ?? null,
      evidenceRefs: intent.evidenceRefs,
      sourceProvenance: intent.sourceProvenance,
      boundaryTrace: listUniqueStrings([
        LIMITED_AUTO_BOUNDARY_NOTE,
        LIMITED_AUTO_APPROVAL_NOTE,
        LIMITED_AUTO_MANUAL_OVERRIDE_NOTE,
        ...(intent.boundaryTrace ?? []),
      ]),
      confidence: intent.confidence,
      openQuestions: intent.openQuestions,
      whatAutoPathWillDo: buildLimitedAutoWhatWillDo(intent.writeActionType, eligibility.status),
      whatAutoPathWillNotDo: buildLimitedAutoWhatWillNotDo(),
      manualOnlyReason: eligibility.manualOnlyReason,
    } satisfies LimitedAutoIntentContract;
    });
}

function buildShadowSourceContracts(input: OfficialWriteShadowSource): OfficialWriteIntentContract[] {
  const contracts: OfficialWriteIntentContract[] = [];
  const delta = input.delta;
  const boundaryTrace = listUniqueStrings([
    OFFICIAL_WRITE_BOUNDARY_NOTE,
    OFFICIAL_WRITE_SOURCE_BOUNDARY,
    ...(delta.boundaryNotes ?? []),
    "approved 阴影 recommendation 只代表可以进入 guarded 正式write 复核，不代表 actual 正式write success。",
  ]);

  if (delta.stageShadowTo !== input.currentStage) {
    const rule = resolveApprovalRule(OFFICIAL_ACTION_TO_MATRIX_ACTION["crm.update_official_stage"]);
    contracts.push({
      sourceKey: buildSourceKey("shadow", input.bundleId, "crm.update_official_stage"),
      officialSystemType: "crm",
      officialObjectRef: `crm:opportunity:${input.opportunityId}`,
      sourceType: "approved_shadow_recommendation",
      sourceTitle: `${input.sourceTitle} · official stage`,
      sourceSummary: trimText(delta.stageRationale, 180),
      sourceShadowRef: input.bundleId,
      sourceExecutionProofRef: null,
      writeActionType: "crm.update_official_stage",
      writePayloadDraft: {
        stageFrom: input.currentStage,
        stageTo: delta.stageShadowTo,
        stageRationale: delta.stageRationale,
        evidenceRefs: delta.evidenceRefs,
      },
      writeBoundary: OFFICIAL_WRITE_BOUNDARY_NOTE,
      writeApprovalTier: rule.tier,
      writeApprovalStatus: "pending_review",
      writeExecutionStatus: "requested",
      writeAcknowledgementStatus: "pending",
      approvalRequirements: {
        mandatoryReviewers: rule.mandatoryReviewers,
        requiredApprovals: rule.requiredApprovals,
        auditRequired: rule.auditRequired,
        pilotEnabled: rule.pilotEnabled,
        systemOfRecordWrite: rule.systemOfRecordWrite,
      },
      riskReviewSummary: listUniqueStrings(delta.riskFlags.map((item) => `${item.label}: ${item.reason}`)).join(" | ") || null,
      evidenceRefs: delta.evidenceRefs,
      sourceProvenance: delta.sourceProvenance,
      boundaryTrace,
      confidence: delta.confidence,
      openQuestions: delta.openQuestions,
      whatThisChanges: `Would update the official CRM stage from ${input.currentStage} to ${delta.stageShadowTo} after explicit approval and acknowledged success.`,
      whatThisDoesNotMean: buildWhatDoesNotMean(),
    });
  }

  if (trimText(delta.nextBestAction, 10) && trimText(delta.nextBestAction, 240) !== trimText(input.currentNextAction ?? "", 240)) {
    const rule = resolveApprovalRule(OFFICIAL_ACTION_TO_MATRIX_ACTION["crm.update_next_action"]);
    contracts.push({
      sourceKey: buildSourceKey("shadow", input.bundleId, "crm.update_next_action"),
      officialSystemType: "crm",
      officialObjectRef: `crm:opportunity:${input.opportunityId}`,
      sourceType: "approved_shadow_recommendation",
      sourceTitle: `${input.sourceTitle} · official next action`,
      sourceSummary: trimText(delta.nextBestAction, 180),
      sourceShadowRef: input.bundleId,
      sourceExecutionProofRef: null,
      writeActionType: "crm.update_next_action",
      writePayloadDraft: {
        nextAction: delta.nextBestAction,
        recommendedNextAction: delta.recommendedNextAction,
        evidenceRefs: delta.evidenceRefs,
      },
      writeBoundary: OFFICIAL_WRITE_BOUNDARY_NOTE,
      writeApprovalTier: rule.tier,
      writeApprovalStatus: "pending_review",
      writeExecutionStatus: "requested",
      writeAcknowledgementStatus: "pending",
      approvalRequirements: {
        mandatoryReviewers: rule.mandatoryReviewers,
        requiredApprovals: rule.requiredApprovals,
        auditRequired: rule.auditRequired,
        pilotEnabled: rule.pilotEnabled,
        systemOfRecordWrite: rule.systemOfRecordWrite,
      },
      riskReviewSummary: `Recommended next action after approved shadow judgement: ${delta.nextBestAction}`,
      evidenceRefs: delta.evidenceRefs,
      sourceProvenance: delta.sourceProvenance,
      boundaryTrace,
      confidence: delta.confidence,
      openQuestions: delta.openQuestions,
      whatThisChanges: "Would update the official CRM next action so the official system reflects the reviewed shadow recommendation.",
      whatThisDoesNotMean: buildWhatDoesNotMean(),
    });
  }

  if (delta.blockers.length > 0) {
    const rule = resolveApprovalRule(OFFICIAL_ACTION_TO_MATRIX_ACTION["crm.update_blockers"]);
    contracts.push({
      sourceKey: buildSourceKey("shadow", input.bundleId, "crm.update_blockers"),
      officialSystemType: "crm",
      officialObjectRef: `crm:opportunity:${input.opportunityId}`,
      sourceType: "approved_shadow_recommendation",
      sourceTitle: `${input.sourceTitle} · official blockers`,
      sourceSummary: trimText(delta.blockers.map((item) => item.label).join("；"), 180),
      sourceShadowRef: input.bundleId,
      sourceExecutionProofRef: null,
      writeActionType: "crm.update_blockers",
      writePayloadDraft: {
        blockers: delta.blockers,
        managerAttentionRequired: delta.managerAttentionRequired,
        evidenceRefs: delta.evidenceRefs,
      },
      writeBoundary: OFFICIAL_WRITE_BOUNDARY_NOTE,
      writeApprovalTier: rule.tier,
      writeApprovalStatus: "pending_review",
      writeExecutionStatus: "requested",
      writeAcknowledgementStatus: "pending",
      approvalRequirements: {
        mandatoryReviewers: rule.mandatoryReviewers,
        requiredApprovals: rule.requiredApprovals,
        auditRequired: rule.auditRequired,
        pilotEnabled: rule.pilotEnabled,
        systemOfRecordWrite: rule.systemOfRecordWrite,
      },
      riskReviewSummary: `Would mirror ${delta.blockers.length} reviewed blocker(s) into the official CRM record.`,
      evidenceRefs: delta.evidenceRefs,
      sourceProvenance: delta.sourceProvenance,
      boundaryTrace,
      confidence: delta.confidence,
      openQuestions: delta.openQuestions,
      whatThisChanges: "Would attach the reviewed blocker posture to the official CRM record so the official system reflects current obstacles and ranking.",
      whatThisDoesNotMean: buildWhatDoesNotMean(),
    });
  }

  return contracts;
}

function proofActionToWriteAction(actionType: HumanActionExecutionType): OfficialWriteActionTypeValue {
  if (
    actionType === HumanActionExecutionType.MANUAL_HANDOFF_DELIVERY ||
    actionType === HumanActionExecutionType.MANUAL_HANDOFF_CUSTOMER_SUCCESS
  ) {
    return "crm.attach_handoff_summary";
  }
  return "crm.attach_note";
}

function buildExecutionProofContracts(input: OfficialWriteExecutionProofSource): OfficialWriteIntentContract[] {
  const actionType = proofActionToWriteAction(input.actionType);
  const rule = resolveApprovalRule(OFFICIAL_ACTION_TO_MATRIX_ACTION[actionType]);
  const objectRef = input.opportunityId ? `crm:opportunity:${input.opportunityId}` : `crm:meeting:${input.meetingId}`;
  const boundaryTrace = listUniqueStrings([
    OFFICIAL_WRITE_BOUNDARY_NOTE,
    OFFICIAL_WRITE_SOURCE_BOUNDARY,
    input.executionBoundary,
    ...(input.boundaryTrace ?? []),
    "execution proof 仍然不等于 external 结果 truth，也不会自己跳成 actual 正式write。",
  ]);
  const isHandoff = actionType === "crm.attach_handoff_summary";

  return [
    {
      sourceKey: buildSourceKey("execution", input.id, actionType),
      officialSystemType: "crm",
      officialObjectRef: objectRef,
      sourceType: "approved_execution_proof",
      sourceTitle: `${input.sourceArtifactTitle} · ${renderActionLabel(actionType)}`,
      sourceSummary: trimText(input.sourceArtifactSummary, 180),
      sourceShadowRef: null,
      sourceExecutionProofRef: input.id,
      writeActionType: actionType,
      writePayloadDraft: {
        noteTitle: input.sourceArtifactTitle,
        noteSummary: input.sourceArtifactSummary,
        proofNote: input.proofNote,
        externalReference: input.externalReference,
        followThroughStatus: input.followThroughStatus,
        whatWasNotDone: input.whatWasNotDone,
        audience: input.audience,
        actionType: input.actionType,
      },
      writeBoundary: OFFICIAL_WRITE_BOUNDARY_NOTE,
      writeApprovalTier: rule.tier,
      writeApprovalStatus: "pending_review",
      writeExecutionStatus: "requested",
      writeAcknowledgementStatus: "pending",
      approvalRequirements: {
        mandatoryReviewers: rule.mandatoryReviewers,
        requiredApprovals: rule.requiredApprovals,
        auditRequired: rule.auditRequired,
        pilotEnabled: rule.pilotEnabled,
        systemOfRecordWrite: rule.systemOfRecordWrite,
      },
      riskReviewSummary:
        input.riskReviewSummary ??
        (isHandoff
          ? "Would attach the reviewed handoff proof into the official CRM record after explicit approval."
          : "Would attach the reviewed manual execution proof into the official CRM record after explicit approval."),
      evidenceRefs: input.evidenceRefs,
      sourceProvenance: input.sourceProvenance,
      boundaryTrace,
      confidence: 100,
      openQuestions: [],
      whatThisChanges: isHandoff
        ? "Would attach the reviewed handoff summary/proof into the official CRM record after explicit approval and acknowledged success."
        : "Would attach the reviewed manual execution note/proof into the official CRM record after explicit approval and acknowledged success.",
      whatThisDoesNotMean: buildWhatDoesNotMean(),
    },
  ];
}

async function loadOfficialWriteMeeting(workspaceId: string, meetingId: string) {
  return db.meeting.findFirst({
    where: {
      workspaceId,
      id: meetingId,
    },
    include: {
      workspace: true,
      company: true,
      opportunity: true,
      owner: true,
      note: true,
    },
  });
}

async function loadApprovedShadowSource(workspaceId: string, meetingId: string) {
  const meeting = await loadOfficialWriteMeeting(workspaceId, meetingId);
  if (!meeting?.opportunity) return null;

  const summary = await getMeetingOpportunityJudgeRuntimeSummary(workspaceId, meetingId).catch(() => null);
  if (!summary?.bundle || !summary.opportunityDelta || !summary.artifactReview) return null;
  if (summary.artifactReview.status !== "CONFIRMED") return null;
  if (summary.bundle.reviewStatus !== "approved_for_shadow_consume") return null;

  return {
    meetingId,
    opportunityId: meeting.opportunity.id,
    companyId: meeting.companyId,
    bundleId: summary.bundle.id,
    delta: toOpportunityDeltaArtifact(summary.opportunityDelta),
    currentStage: meeting.opportunity.stage,
    currentNextAction: meeting.opportunity.nextAction,
    sourceTitle: meeting.opportunity.title,
  } satisfies OfficialWriteShadowSource;
}

async function loadApprovedExecutionProofSources(workspaceId: string, meetingId: string) {
  const rows = await db.humanActionExecution.findMany({
    where: {
      workspaceId,
      meetingId,
      status: HumanActionExecutionStatus.EXECUTED,
      acknowledgementStatus: HumanActionExecutionAckStatus.ACKNOWLEDGED,
    },
    orderBy: [{ executedAt: "desc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    meetingId: row.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    actionType: row.actionType,
    sourceArtifactBundleId: row.sourceArtifactBundleId,
    sourceArtifactTitle: row.sourceArtifactTitle,
    sourceArtifactSummary: row.sourceArtifactSummary,
    audience: row.audience,
    executionIntent: row.executionIntent,
    executionBoundary: row.executionBoundary,
    executionRiskLevel: row.executionRiskLevel,
    riskReviewSummary: row.riskReviewSummary,
    proofNote: row.proofNote,
    externalReference: row.externalReference,
    followThroughStatus: row.followThroughStatus,
    whatWasNotDone: row.whatWasNotDone,
    evidenceRefs: parseJson<string[]>(row.evidenceRefs, []),
    sourceProvenance: parseJson<Array<Record<string, unknown>>>(row.sourceProvenance, []),
    boundaryTrace: parseJson<string[]>(row.boundaryTrace, []),
  })) satisfies OfficialWriteExecutionProofSource[];
}

export function buildOfficialWriteIntentContracts(input: {
  shadowSource?: OfficialWriteShadowSource | null;
  executionProofSources?: OfficialWriteExecutionProofSource[];
}) {
  return [
    ...(input.shadowSource ? buildShadowSourceContracts(input.shadowSource) : []),
    ...((input.executionProofSources ?? []).flatMap((source) => buildExecutionProofContracts(source))),
  ];
}

function toRuntimeItem(row: {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  sourceKey: string;
  officialObjectRef: string;
  sourceType: string;
  sourceTitle: string;
  sourceSummary: string;
  sourceShadowRef: string | null;
  sourceExecutionProofRef: string | null;
  writeActionType: OfficialWriteActionType;
  writePayloadDraft: string;
  writeBoundary: string;
  writeApprovalTier: string;
  writeApprovalStatus: OfficialWriteApprovalStatus;
  writeExecutionStatus: OfficialWriteExecutionStatus;
  writeAcknowledgementStatus: OfficialWriteAcknowledgementStatus;
  approvalRequirements: string | null;
  riskReviewSummary: string | null;
  evidenceRefs: string | null;
  sourceProvenance: string | null;
  boundaryTrace: string | null;
  confidence: number | null;
  openQuestions: string | null;
  whatThisChanges: string | null;
  whatThisDoesNotMean: string | null;
  reviewNotes: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectedByName: string | null;
  rejectedAt: Date | null;
  attemptedByName: string | null;
  attemptedAt: Date | null;
  acknowledgedByName: string | null;
  acknowledgedAt: Date | null;
  writeAcknowledgementPayload: string | null;
  writeFailureReason: string | null;
  manualReconciliationNote: string | null;
  deferredRetryNote: string | null;
  externalSystemReference: string | null;
  writeAuditRef: string | null;
}): OfficialWriteIntentRuntimeItem {
  const actionType = toActionTypeValue(row.writeActionType);
  const coverage = getOfficialActionCoverage(actionType);
  const ackPayload = parseJson<Record<string, unknown> | null>(row.writeAcknowledgementPayload, null);
  const receiptTrace = toReceiptTrace(
    ackPayload,
    buildOfficialReceiptTrace({
      receiptStatus:
        row.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.SUCCESS
          ? "acknowledged_success"
          : row.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.FAILURE
            ? "acknowledged_failure"
            : row.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.DEFERRED
              ? "retry_skipped"
              : "manual_reconciliation_required",
      note: row.writeFailureReason ?? row.manualReconciliationNote ?? row.deferredRetryNote ?? null,
      externalSystemReference: row.externalSystemReference,
    }),
  );

  return {
    id: row.id,
    meetingId: row.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    sourceKey: row.sourceKey,
    officialSystemType: "crm",
    officialObjectRef: row.officialObjectRef,
    sourceType: row.sourceType as OfficialWriteSourceType,
    sourceTitle: row.sourceTitle,
    sourceSummary: row.sourceSummary,
    sourceShadowRef: row.sourceShadowRef,
    sourceExecutionProofRef: row.sourceExecutionProofRef,
    writeActionType: actionType,
    actionCategory: coverage.category,
    actionRiskClass: coverage.riskClass,
    actionDefaultPath: coverage.defaultPath,
    acknowledgmentRequirement: coverage.acknowledgmentRequirement,
    rollbackExpectation: coverage.rollbackExpectation,
    receiptStatus: receiptTrace.receiptStatus,
    receiptSummaryWritebackMode: receiptTrace.summaryWritebackMode,
    receiptSummary: receiptTrace.receiptSummary,
    manualFallbackRequired: receiptTrace.manualFallbackRequired,
    escalationRequired: receiptTrace.escalationRequired,
    writePayloadDraft: parseJson<Record<string, unknown>>(row.writePayloadDraft, {}),
    writeBoundary: row.writeBoundary,
    writeApprovalTier: row.writeApprovalTier,
    writeApprovalStatus: row.writeApprovalStatus,
    writeExecutionStatus: row.writeExecutionStatus,
    writeAcknowledgementStatus: row.writeAcknowledgementStatus,
    approvalRequirements: parseJson(row.approvalRequirements, {
      mandatoryReviewers: [],
      requiredApprovals: [],
      auditRequired: true,
      pilotEnabled: false,
      systemOfRecordWrite: true,
    }),
    riskReviewSummary: row.riskReviewSummary,
    evidenceRefs: parseJson<string[]>(row.evidenceRefs, []),
    sourceProvenance: parseJson<Array<Record<string, unknown>>>(row.sourceProvenance, []),
    boundaryTrace: parseJson<string[]>(row.boundaryTrace, []),
    confidence: row.confidence ?? 0,
    openQuestions: parseJson<string[]>(row.openQuestions, []),
    whatThisChanges: row.whatThisChanges ?? "",
    whatThisDoesNotMean: row.whatThisDoesNotMean ?? buildWhatDoesNotMean(),
    reviewNotes: row.reviewNotes,
    approvedByName: row.approvedByName,
    approvedAt: row.approvedAt,
    rejectedByName: row.rejectedByName,
    rejectedAt: row.rejectedAt,
    attemptedByName: row.attemptedByName,
    attemptedAt: row.attemptedAt,
    acknowledgedByName: row.acknowledgedByName,
    acknowledgedAt: row.acknowledgedAt,
    writeAcknowledgementPayload: ackPayload,
    writeFailureReason: row.writeFailureReason,
    manualReconciliationNote: row.manualReconciliationNote,
    deferredRetryNote: row.deferredRetryNote,
    externalSystemReference: row.externalSystemReference,
    writeAuditRef: row.writeAuditRef,
  };
}

function toLimitedAutoRuntimeItem(row: {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  sourceWriteIntentId: string;
  officialObjectRef: string;
  limitedAutoActionType: OfficialWriteActionType;
  limitedAutoEligibilityStatus: LimitedAutoEligibilityStatus;
  limitedAutoEligibilityReason: string;
  limitedAutoApprovalRequired: boolean;
  limitedAutoApprovalStatus: LimitedAutoApprovalStatus;
  limitedAutoExecutionStatus: LimitedAutoExecutionStatus;
  limitedAutoAckStatus: LimitedAutoAcknowledgementStatus;
  limitedAutoFailureStatus: LimitedAutoFailureStatus;
  limitedAutoRollbackStatus: LimitedAutoRollbackStatus;
  approvalRequirements: string | null;
  proposedWritePayload: string;
  riskReviewSummary: string | null;
  evidenceRefs: string | null;
  sourceProvenance: string | null;
  boundaryTrace: string | null;
  confidence: number | null;
  openQuestions: string | null;
  whatAutoPathWillDo: string | null;
  whatAutoPathWillNotDo: string | null;
  manualOnlyReason: string | null;
  reviewNotes: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectedByName: string | null;
  rejectedAt: Date | null;
  attemptedByName: string | null;
  attemptedAt: Date | null;
  acknowledgedByName: string | null;
  acknowledgedAt: Date | null;
  limitedAutoAckPayload: string | null;
  limitedAutoFailureReason: string | null;
  manualReconciliationNote: string | null;
  deferredRetryNote: string | null;
  rollbackNote: string | null;
  externalSystemReference: string | null;
  limitedAutoAuditRef: string | null;
}): LimitedAutoIntentRuntimeItem {
  const actionType = toActionTypeValue(row.limitedAutoActionType);
  const coverage = getOfficialActionCoverage(actionType);
  const ackPayload = parseJson<Record<string, unknown> | null>(row.limitedAutoAckPayload, null);
  const receiptTrace = toReceiptTrace(
    ackPayload,
    buildOfficialReceiptTrace({
      receiptStatus:
        row.limitedAutoAckStatus === LimitedAutoAcknowledgementStatus.SUCCESS
          ? "acknowledged_success"
          : row.limitedAutoAckStatus === LimitedAutoAcknowledgementStatus.FAILURE
            ? "acknowledged_failure"
            : row.limitedAutoFailureStatus === LimitedAutoFailureStatus.PARTIAL_SUCCESS
              ? "partial_success"
              : row.limitedAutoFailureStatus === LimitedAutoFailureStatus.TIMEOUT_OR_UNKNOWN
                ? "timeout_unknown"
                : row.limitedAutoAckStatus === LimitedAutoAcknowledgementStatus.MANUAL_RECONCILIATION_REQUIRED
                  ? "manual_reconciliation_required"
                  : row.limitedAutoFailureStatus === LimitedAutoFailureStatus.RETRY_NOT_ATTEMPTED
                    ? "retry_skipped"
                    : "manual_reconciliation_required",
      note: row.limitedAutoFailureReason ?? row.manualReconciliationNote ?? row.deferredRetryNote ?? row.rollbackNote ?? null,
      externalSystemReference: row.externalSystemReference,
    }),
  );

  return {
    id: row.id,
    meetingId: row.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    sourceWriteIntentId: row.sourceWriteIntentId,
    officialSystemType: "crm",
    officialObjectRef: row.officialObjectRef,
    limitedAutoActionType: actionType,
    actionCategory: coverage.category,
    actionRiskClass: coverage.riskClass,
    actionDefaultPath: coverage.defaultPath,
    acknowledgmentRequirement: coverage.acknowledgmentRequirement,
    rollbackExpectation: coverage.rollbackExpectation,
    receiptStatus: receiptTrace.receiptStatus,
    receiptSummaryWritebackMode: receiptTrace.summaryWritebackMode,
    receiptSummary: receiptTrace.receiptSummary,
    manualFallbackRequired: receiptTrace.manualFallbackRequired,
    escalationRequired: receiptTrace.escalationRequired,
    limitedAutoEligibilityStatus: toLimitedAutoEligibilityStatusValue(row.limitedAutoEligibilityStatus),
    limitedAutoEligibilityReason: row.limitedAutoEligibilityReason,
    limitedAutoApprovalRequired: row.limitedAutoApprovalRequired,
    limitedAutoApprovalStatus: row.limitedAutoApprovalStatus,
    limitedAutoExecutionStatus: row.limitedAutoExecutionStatus,
    limitedAutoAckStatus: row.limitedAutoAckStatus,
    limitedAutoFailureStatus: row.limitedAutoFailureStatus,
    limitedAutoRollbackStatus: row.limitedAutoRollbackStatus,
    approvalRequirements: parseJson(row.approvalRequirements, {
      mandatoryReviewers: [],
      requiredApprovals: [],
      auditRequired: true,
      pilotEnabled: false,
      systemOfRecordWrite: true,
    }),
    proposedWritePayload: parseJson<Record<string, unknown>>(row.proposedWritePayload, {}),
    riskReviewSummary: row.riskReviewSummary,
    evidenceRefs: parseJson<string[]>(row.evidenceRefs, []),
    sourceProvenance: parseJson<Array<Record<string, unknown>>>(row.sourceProvenance, []),
    boundaryTrace: parseJson<string[]>(row.boundaryTrace, []),
    confidence: row.confidence ?? 0,
    openQuestions: parseJson<string[]>(row.openQuestions, []),
    whatAutoPathWillDo: row.whatAutoPathWillDo ?? "",
    whatAutoPathWillNotDo: row.whatAutoPathWillNotDo ?? buildLimitedAutoWhatWillNotDo(),
    manualOnlyReason: row.manualOnlyReason,
    reviewNotes: row.reviewNotes,
    approvedByName: row.approvedByName,
    approvedAt: row.approvedAt,
    rejectedByName: row.rejectedByName,
    rejectedAt: row.rejectedAt,
    attemptedByName: row.attemptedByName,
    attemptedAt: row.attemptedAt,
    acknowledgedByName: row.acknowledgedByName,
    acknowledgedAt: row.acknowledgedAt,
    limitedAutoAckPayload: ackPayload,
    limitedAutoFailureReason: row.limitedAutoFailureReason,
    manualReconciliationNote: row.manualReconciliationNote,
    deferredRetryNote: row.deferredRetryNote,
    rollbackNote: row.rollbackNote,
    externalSystemReference: row.externalSystemReference,
    limitedAutoAuditRef: row.limitedAutoAuditRef,
  };
}

function toOfficialFollowThroughRuntimeItem(row: {
  id: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  sourceWriteIntentId: string | null;
  sourceLimitedAutoIntentId: string | null;
  sourceAckId: string | null;
  sourceActionType: OfficialWriteActionType | null;
  officialObjectRef: string;
  followThroughKey: string;
  followThroughType: OfficialFollowThroughType;
  exceptionClass: OfficialExceptionClass | null;
  exceptionSeverity: RiskLevel;
  reconciliationStatus: OfficialReconciliationStatus;
  followThroughStatus: OfficialFollowThroughStatus;
  followThroughResolutionStatus: OfficialFollowThroughResolutionStatus;
  followThroughOwnerId: string | null;
  followThroughOwnerName: string | null;
  followThroughNextAction: string | null;
  followThroughDeadline: Date | null;
  followThroughBoundary: string;
  followThroughEvidenceRefs: string | null;
  followThroughWritebackTargets: string;
  followThroughSummary: string | null;
  resolutionNote: string | null;
  reconciliationNote: string | null;
  managerAttentionRequired: boolean;
  manualFallbackRequired: boolean;
  roleHandoffImpact: string | null;
  summaryWritebackImpact: string | null;
  blockerSummaryImpact: string | null;
  escalationReason: string | null;
  auditRef: string | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OfficialFollowThroughRuntimeItem {
  return {
    id: row.id,
    meetingId: row.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    followThroughKey: row.followThroughKey,
    sourceWriteIntentId: row.sourceWriteIntentId,
    sourceLimitedAutoIntentId: row.sourceLimitedAutoIntentId,
    sourceAckId: row.sourceAckId,
    sourceActionType: row.sourceActionType ? toActionTypeValue(row.sourceActionType) : null,
    officialObjectRef: row.officialObjectRef,
    followThroughType: toOfficialFollowThroughTypeValue(row.followThroughType),
    exceptionClass: toOfficialExceptionClassValue(row.exceptionClass),
    exceptionSeverity:
      row.exceptionSeverity === RiskLevel.CRITICAL
        ? "critical"
        : row.exceptionSeverity === RiskLevel.HIGH
          ? "high"
          : row.exceptionSeverity === RiskLevel.MEDIUM
            ? "medium"
            : "low",
    reconciliationStatus: toOfficialReconciliationStatusValue(row.reconciliationStatus),
    followThroughStatus: toOfficialFollowThroughStatusValue(row.followThroughStatus),
    followThroughResolutionStatus: toOfficialFollowThroughResolutionStatusValue(row.followThroughResolutionStatus),
    followThroughOwnerId: row.followThroughOwnerId,
    followThroughOwnerName: row.followThroughOwnerName,
    followThroughNextAction: row.followThroughNextAction ?? "",
    followThroughDeadline: row.followThroughDeadline,
    followThroughBoundary: row.followThroughBoundary,
    followThroughEvidenceRefs: parseJson<string[]>(row.followThroughEvidenceRefs, []),
    followThroughWritebackTargets: parseJson<string[]>(row.followThroughWritebackTargets, []),
    followThroughSummary: row.followThroughSummary ?? "",
    resolutionNote: row.resolutionNote,
    reconciliationNote: row.reconciliationNote,
    managerAttentionRequired: row.managerAttentionRequired,
    manualFallbackRequired: row.manualFallbackRequired,
    roleHandoffImpact: row.roleHandoffImpact,
    summaryWritebackImpact: row.summaryWritebackImpact,
    blockerSummaryImpact: row.blockerSummaryImpact,
    escalationReason: row.escalationReason,
    auditRef: row.auditRef,
    resolvedByName: row.resolvedByName,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function upsertOfficialFollowThrough(input: {
  workspaceId: string;
  runtimeEventId: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  contract: OfficialFollowThroughContract;
}) {
  const existing = await db.officialFollowThrough.findUnique({
    where: { followThroughKey: input.contract.followThroughKey },
  });

  const data = {
    runtimeEventId: input.runtimeEventId,
    meetingId: input.meetingId,
    opportunityId: input.opportunityId,
    companyId: input.companyId,
    sourceWriteIntentId: input.contract.sourceWriteIntentId,
    sourceLimitedAutoIntentId: input.contract.sourceLimitedAutoIntentId,
    sourceAckId: input.contract.sourceAckId,
    sourceActionType: input.contract.sourceActionType ? fromActionTypeValue(input.contract.sourceActionType) : null,
    officialObjectRef: input.contract.officialObjectRef,
    followThroughType: fromOfficialFollowThroughTypeValue(input.contract.followThroughType),
    exceptionClass: fromOfficialExceptionClassValue(input.contract.exceptionClass),
    exceptionSeverity:
      input.contract.exceptionSeverity === "critical"
        ? RiskLevel.CRITICAL
        : input.contract.exceptionSeverity === "high"
          ? RiskLevel.HIGH
          : input.contract.exceptionSeverity === "medium"
            ? RiskLevel.MEDIUM
            : RiskLevel.LOW,
    reconciliationStatus: fromOfficialReconciliationStatusValue(input.contract.reconciliationStatus),
    followThroughStatus: fromOfficialFollowThroughStatusValue(input.contract.followThroughStatus),
    followThroughResolutionStatus: fromOfficialFollowThroughResolutionStatusValue(input.contract.followThroughResolutionStatus),
    followThroughOwnerId: input.contract.followThroughOwnerId,
    followThroughOwnerName: input.contract.followThroughOwnerName,
    followThroughNextAction: input.contract.followThroughNextAction,
    followThroughDeadline: input.contract.followThroughDeadline,
    followThroughBoundary: input.contract.followThroughBoundary,
    followThroughEvidenceRefs: jsonStringify(input.contract.followThroughEvidenceRefs),
    followThroughWritebackTargets: jsonStringify(input.contract.followThroughWritebackTargets),
    followThroughSummary: input.contract.followThroughSummary,
    managerAttentionRequired: input.contract.managerAttentionRequired,
    manualFallbackRequired: input.contract.manualFallbackRequired,
    roleHandoffImpact: input.contract.roleHandoffImpact,
    summaryWritebackImpact: input.contract.summaryWritebackImpact,
    blockerSummaryImpact: input.contract.blockerSummaryImpact,
    escalationReason: input.contract.escalationReason,
  };

  if (existing) {
    await db.officialFollowThrough.update({
      where: { id: existing.id },
      data,
    });

    return { id: existing.id, created: false };
  }

  const created = await db.officialFollowThrough.create({
    data: {
      workspaceId: input.workspaceId,
      followThroughKey: input.contract.followThroughKey,
      ...data,
    },
  });

  return { id: created.id, created: true };
}

async function upsertOfficialWriteIntent(input: {
  workspaceId: string;
  runtimeEventId: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  sourceArtifactBundleId?: string | null;
  sourceHumanActionExecutionId?: string | null;
  contract: OfficialWriteIntentContract;
}) {
  const existing = await db.officialWriteIntent.findUnique({
    where: {
      workspaceId_sourceKey: {
        workspaceId: input.workspaceId,
        sourceKey: input.contract.sourceKey,
      },
    },
  });

  const data = {
    runtimeEventId: input.runtimeEventId,
    meetingId: input.meetingId,
    opportunityId: input.opportunityId,
    companyId: input.companyId,
    sourceArtifactBundleId: input.sourceArtifactBundleId ?? null,
    sourceHumanActionExecutionId: input.sourceHumanActionExecutionId ?? null,
    officialSystemType: OfficialSystemType.CRM,
    officialObjectRef: input.contract.officialObjectRef,
    sourceType: input.contract.sourceType,
    sourceTitle: input.contract.sourceTitle,
    sourceSummary: input.contract.sourceSummary,
    sourceShadowRef: input.contract.sourceShadowRef ?? null,
    sourceExecutionProofRef: input.contract.sourceExecutionProofRef ?? null,
    writeActionType: fromActionTypeValue(input.contract.writeActionType),
    writePayloadDraft: jsonStringify(input.contract.writePayloadDraft),
    writeBoundary: input.contract.writeBoundary,
    writeApprovalTier: input.contract.writeApprovalTier,
    approvalRequirements: jsonStringify(input.contract.approvalRequirements),
    riskReviewSummary: input.contract.riskReviewSummary ?? null,
    evidenceRefs: jsonStringify(input.contract.evidenceRefs),
    sourceProvenance: jsonStringify(input.contract.sourceProvenance),
    boundaryTrace: jsonStringify(input.contract.boundaryTrace),
    confidence: Math.round(input.contract.confidence),
    openQuestions: jsonStringify(input.contract.openQuestions),
    whatThisChanges: input.contract.whatThisChanges,
    whatThisDoesNotMean: input.contract.whatThisDoesNotMean,
  };

  if (existing) {
    await db.officialWriteIntent.update({
      where: { id: existing.id },
      data,
    });

    return {
      id: existing.id,
      created: false,
    };
  }

  const created = await db.officialWriteIntent.create({
    data: {
      workspaceId: input.workspaceId,
      sourceKey: input.contract.sourceKey,
      writeApprovalStatus: OfficialWriteApprovalStatus.PENDING_REVIEW,
      writeExecutionStatus: OfficialWriteExecutionStatus.REQUESTED,
      writeAcknowledgementStatus: OfficialWriteAcknowledgementStatus.PENDING,
      ...data,
    },
  });

  return {
    id: created.id,
    created: true,
  };
}

async function upsertLimitedAutoIntent(input: {
  workspaceId: string;
  runtimeEventId: string;
  meetingId: string;
  opportunityId: string | null;
  companyId: string | null;
  contract: LimitedAutoIntentContract;
}) {
  const existing = await db.limitedAutoIntent.findUnique({
    where: { sourceWriteIntentId: input.contract.sourceWriteIntentId },
  });

  const data = {
    runtimeEventId: input.runtimeEventId,
    meetingId: input.meetingId,
    opportunityId: input.opportunityId,
    companyId: input.companyId,
    officialSystemType: OfficialSystemType.CRM,
    officialObjectRef: input.contract.officialObjectRef,
    limitedAutoActionType: fromActionTypeValue(input.contract.limitedAutoActionType),
    limitedAutoEligibilityStatus: fromLimitedAutoEligibilityStatusValue(input.contract.limitedAutoEligibilityStatus),
    limitedAutoEligibilityReason: input.contract.limitedAutoEligibilityReason,
    limitedAutoApprovalRequired: input.contract.limitedAutoApprovalRequired,
    approvalRequirements: jsonStringify(input.contract.approvalRequirements),
    proposedWritePayload: jsonStringify(input.contract.proposedWritePayload),
    riskReviewSummary: input.contract.riskReviewSummary ?? null,
    evidenceRefs: jsonStringify(input.contract.evidenceRefs),
    sourceProvenance: jsonStringify(input.contract.sourceProvenance),
    boundaryTrace: jsonStringify(input.contract.boundaryTrace),
    confidence: Math.round(input.contract.confidence),
    openQuestions: jsonStringify(input.contract.openQuestions),
    whatAutoPathWillDo: input.contract.whatAutoPathWillDo,
    whatAutoPathWillNotDo: input.contract.whatAutoPathWillNotDo,
    manualOnlyReason: input.contract.manualOnlyReason ?? null,
  };

  if (existing) {
    await db.limitedAutoIntent.update({
      where: { id: existing.id },
      data,
    });

    return {
      id: existing.id,
      created: false,
    };
  }

  const created = await db.limitedAutoIntent.create({
    data: {
      workspaceId: input.workspaceId,
      sourceWriteIntentId: input.contract.sourceWriteIntentId,
      limitedAutoApprovalStatus: LimitedAutoApprovalStatus.PENDING_REVIEW,
      limitedAutoExecutionStatus: LimitedAutoExecutionStatus.REQUESTED,
      limitedAutoAckStatus: LimitedAutoAcknowledgementStatus.PENDING,
      limitedAutoFailureStatus: LimitedAutoFailureStatus.NONE,
      limitedAutoRollbackStatus: LimitedAutoRollbackStatus.NOT_REQUIRED,
      ...data,
    },
  });

  return {
    id: created.id,
    created: true,
  };
}

async function createRuntimeEvent(input: {
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  eventType:
    | "official.write_intent_created"
    | "official.write_attempted"
    | "official.write_acknowledged"
    | "official.write_limited_auto_synced"
    | "official.write_limited_auto_attempted"
    | "official.write_limited_auto_acknowledged"
    | "official.write_followthrough_synced"
    | "official.write_followthrough_updated";
  actorName: string;
  payload?: Record<string, unknown>;
}) {
  return db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: input.opportunityId ?? null,
      companyId: input.companyId ?? null,
      eventType: input.eventType,
      status: RuntimeEventStatus.COMPLETED,
      payload: input.payload ? jsonStringify(input.payload) : null,
      triggeredBy: input.actorName,
      queuedAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

async function syncOfficialWriteManagedSummary(input: {
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
}) {
  const intents = await db.officialWriteIntent.findMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
    orderBy: [{ acknowledgedAt: "desc" }, { updatedAt: "desc" }],
  });

  const lines = intents.slice(0, 8).map((item) => {
    const runtime = toRuntimeItem(item);
    const when = runtime.acknowledgedAt?.toISOString() ?? runtime.attemptedAt?.toISOString() ?? runtime.approvedAt?.toISOString() ?? "pending";
    const result = runtime.receiptSummary;
    const writebackMode =
      runtime.receiptSummaryWritebackMode === "audit_only"
        ? "audit-only"
        : runtime.receiptSummaryWritebackMode === "reconciliation_note"
          ? "reconciliation-note"
          : "full";
    return `- [${when}] ${renderActionLabel(runtime.writeActionType)} · ${result} · writeback:${writebackMode} · ${runtime.whatThisDoesNotMean}`;
  });

  const currentMeeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
    select: { postMeetingSummary: true },
  });

  const meetingSummary = mergeManagedSection(currentMeeting?.postMeetingSummary, lines);

  await db.meeting.update({
    where: { id: input.meetingId },
    data: {
      postMeetingSummary: meetingSummary,
    },
  });

  let opportunitySummary: string | null = null;

  if (input.opportunityId) {
    const currentOpportunity = await db.opportunity.findUnique({
      where: { id: input.opportunityId },
      select: { nextStepSummary: true },
    });

    opportunitySummary = mergeManagedSection(currentOpportunity?.nextStepSummary, lines);

    await db.opportunity.update({
      where: { id: input.opportunityId },
      data: {
        nextStepSummary: opportunitySummary,
      },
    });
  }

  return {
    meetingSummary,
    opportunitySummary,
  };
}

function buildOfficialFollowThroughManagedLine(item: OfficialFollowThroughRuntimeItem) {
  const when = item.resolvedAt?.toISOString() ?? item.updatedAt.toISOString();
  return `- [${when}] ${renderFollowThroughTypeLabel(item.followThroughType)} · status:${item.followThroughStatus} · recon:${item.reconciliationStatus} · ${item.followThroughNextAction}`;
}

async function syncOfficialFollowThroughManagedSummary(input: {
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
}) {
  const rows = await db.officialFollowThrough.findMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const items = rows.map((row) => toOfficialFollowThroughRuntimeItem(row));
  const lines = items.slice(0, 8).map((item) => buildOfficialFollowThroughManagedLine(item));
  const currentMeeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
    select: { postMeetingSummary: true },
  });

  const meetingSummary = mergeFollowThroughManagedSection(currentMeeting?.postMeetingSummary, lines);

  await db.meeting.update({
    where: { id: input.meetingId },
    data: {
      postMeetingSummary: meetingSummary,
    },
  });

  let opportunitySummary: string | null = null;
  let blockerSummary: string | null = null;

  if (input.opportunityId) {
    const currentOpportunity = await db.opportunity.findUnique({
      where: { id: input.opportunityId },
      select: {
        nextStepSummary: true,
        shadowBlockersSummary: true,
      },
    });

    opportunitySummary = mergeFollowThroughManagedSection(currentOpportunity?.nextStepSummary, lines);
    const blockerLines = items
      .filter((item) => item.blockerSummaryImpact)
      .map((item) => `- ${item.blockerSummaryImpact}`);
    blockerSummary = blockerLines.length > 0
      ? mergeFollowThroughManagedSection(currentOpportunity?.shadowBlockersSummary, blockerLines)
      : currentOpportunity?.shadowBlockersSummary ?? null;

    await db.opportunity.update({
      where: { id: input.opportunityId },
      data: {
        nextStepSummary: opportunitySummary,
        shadowBlockersSummary: blockerSummary,
        shadowManagerAttentionFlag: items.some(
          (item) =>
            item.managerAttentionRequired &&
            item.followThroughStatus !== "resolved" &&
            item.followThroughStatus !== "closed_no_change",
        ),
      },
    });
  }

  return {
    meetingSummary,
    opportunitySummary,
    blockerSummary,
  };
}

async function writeOfficialFollowThroughCheckpoint(input: {
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  followThrough: OfficialFollowThroughRuntimeItem;
  actorName: string;
  recordedAt: Date;
}) {
  const isResolved = input.followThrough.followThroughResolutionStatus === "resolved";
  const summary = isResolved
    ? `Official follow-through resolved: ${renderFollowThroughTypeLabel(input.followThrough.followThroughType)} for ${input.followThrough.officialObjectRef}. ${input.followThrough.followThroughNextAction}`
    : `Official follow-through updated: ${renderFollowThroughTypeLabel(input.followThrough.followThroughType)} is ${input.followThrough.followThroughStatus} for ${input.followThrough.officialObjectRef}. ${input.followThrough.followThroughNextAction}`;

  return db.memoryItem.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: input.opportunityId ?? null,
      companyId: input.companyId ?? null,
      objectType: input.opportunityId ? "OPPORTUNITY" : "MEETING",
      objectId: input.opportunityId ?? input.meetingId,
      kind: input.followThrough.roleHandoffImpact ? MemoryItemKind.HANDOFF : MemoryItemKind.CHECKPOINT,
      scope: MemoryItemScope.OBJECT,
      namespace: input.followThrough.roleHandoffImpact ? "handoff" : "opportunity",
      status: isResolved ? MemoryItemStatus.PROMOTED : MemoryItemStatus.CONFIRMED,
      verification: isResolved ? MemoryItemVerification.HUMAN_CONFIRMED : MemoryItemVerification.DRAFT,
      sensitivity: MemoryItemSensitivity.INTERNAL,
      retention: MemoryItemRetention.PERMANENT,
      promotionRule: isResolved ? MemoryItemPromotionRule.HUMAN_CONFIRMED : MemoryItemPromotionRule.NONE,
      writer: OFFICIAL_WRITE_CHECKPOINT_WRITER,
      summary,
      payload: jsonStringify({
        followThroughId: input.followThrough.id,
        followThroughType: input.followThrough.followThroughType,
        followThroughStatus: input.followThrough.followThroughStatus,
        reconciliationStatus: input.followThrough.reconciliationStatus,
        resolutionStatus: input.followThrough.followThroughResolutionStatus,
        actorName: input.actorName,
        writebackTargets: input.followThrough.followThroughWritebackTargets,
      }),
      sourceProvenance: jsonStringify([
        {
          type: "official_followthrough",
          id: input.followThrough.id,
        },
      ]),
      evidenceRefs: jsonStringify(input.followThrough.followThroughEvidenceRefs),
      confidence: isResolved ? 95 : 80,
      confirmedAt: input.recordedAt,
      promotedAt: isResolved ? input.recordedAt : null,
      lastValidatedAt: input.recordedAt,
    },
  });
}

async function writeOfficialWriteCheckpoint(input: {
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  intent: OfficialWriteIntentRuntimeItem;
  reviewerName: string;
  acknowledgedAt: Date;
}) {
  const success = input.intent.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.SUCCESS;
  const summary = success
    ? `Guarded official write acknowledged: ${renderActionLabel(input.intent.writeActionType)} succeeded for ${input.intent.officialObjectRef}. ${input.intent.receiptSummary}`
    : input.intent.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.FAILURE
      ? `Guarded official write acknowledged failure: ${renderActionLabel(input.intent.writeActionType)} failed for ${input.intent.officialObjectRef}. ${input.intent.receiptSummary}`
      : input.intent.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.RECONCILIATION_NOTED
        ? `Guarded official write reconciliation noted for ${renderActionLabel(input.intent.writeActionType)} on ${input.intent.officialObjectRef}. ${input.intent.receiptSummary}`
        : `Guarded official write deferred for ${renderActionLabel(input.intent.writeActionType)} on ${input.intent.officialObjectRef}. ${input.intent.receiptSummary}`;

  return db.memoryItem.create({
    data: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: input.opportunityId ?? null,
      companyId: input.companyId ?? null,
      objectType: input.opportunityId ? "OPPORTUNITY" : "MEETING",
      objectId: input.opportunityId ?? input.meetingId,
      kind:
        input.intent.writeActionType === "crm.attach_handoff_summary" && success
          ? MemoryItemKind.HANDOFF
          : MemoryItemKind.CHECKPOINT,
      scope: MemoryItemScope.OBJECT,
      namespace:
        input.intent.writeActionType === "crm.attach_handoff_summary" && success ? "handoff" : "opportunity",
      status: success ? MemoryItemStatus.PROMOTED : MemoryItemStatus.CONFIRMED,
      verification: success ? MemoryItemVerification.SYSTEM_OF_RECORD : MemoryItemVerification.HUMAN_CONFIRMED,
      sensitivity: MemoryItemSensitivity.INTERNAL,
      retention: MemoryItemRetention.PERMANENT,
      promotionRule: success ? MemoryItemPromotionRule.SYSTEM_OF_RECORD : MemoryItemPromotionRule.HUMAN_CONFIRMED,
      writer: OFFICIAL_WRITE_CHECKPOINT_WRITER,
      summary,
      payload: jsonStringify({
        intentId: input.intent.id,
        actionType: input.intent.writeActionType,
        acknowledgementStatus: input.intent.writeAcknowledgementStatus,
        receiptStatus: input.intent.receiptStatus,
        receiptSummaryWritebackMode: input.intent.receiptSummaryWritebackMode,
        reviewerName: input.reviewerName,
        externalSystemReference: input.intent.externalSystemReference,
      }),
      sourceProvenance: jsonStringify(input.intent.sourceProvenance),
      evidenceRefs: jsonStringify(input.intent.evidenceRefs),
      confidence: success ? 100 : 85,
      confirmedAt: input.acknowledgedAt,
      promotedAt: success ? input.acknowledgedAt : null,
      lastValidatedAt: input.acknowledgedAt,
    },
  });
}

async function applyAcknowledgedOfficialWriteSuccess(input: {
  workspaceId: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  intent: OfficialWriteIntentRuntimeItem;
}) {
  const payload = input.intent.writePayloadDraft;
  if (!input.opportunityId) return;

  if (input.intent.writeActionType === "crm.update_official_stage") {
    const stageTo = payload.stageTo as OpportunityStage | undefined;
    if (stageTo) {
      await db.opportunity.update({
        where: { id: input.opportunityId },
        data: {
          stage: stageTo,
          lastProgressAt: new Date(),
        },
      });
    }
    return;
  }

  if (input.intent.writeActionType === "crm.update_next_action") {
    const nextAction = typeof payload.nextAction === "string" ? payload.nextAction : null;
    if (nextAction) {
      await db.opportunity.update({
        where: { id: input.opportunityId },
        data: {
          nextAction,
          lastProgressAt: new Date(),
        },
      });
    }
    return;
  }

  if (input.intent.writeActionType === "crm.update_blockers") {
    const blockers: Array<{ label?: string; severity?: string }> = Array.isArray(payload.blockers) ? payload.blockers : [];
    const existing = await db.blocker.findMany({
      where: {
        workspaceId: input.workspaceId,
        sourceType: "SYSTEM_INFERENCE",
        sourceId: input.intent.id,
      },
      select: { id: true },
    });

    if (existing.length === 0) {
      await Promise.all(
        blockers.map((item) =>
          db.blocker.create({
            data: {
              workspaceId: input.workspaceId,
              title: trimText(String((item as { label?: string }).label ?? "CRM blocker"), 120),
              blockerType: "OFFICIAL_WRITE_SYNC",
              blockerText: trimText(String((item as { label?: string }).label ?? "CRM blocker"), 200),
              severity:
                (item as { severity?: string }).severity === "high"
                  ? 90
                  : (item as { severity?: string }).severity === "medium"
                    ? 65
                    : 40,
              sourceType: "SYSTEM_INFERENCE",
              sourceId: input.intent.id,
              relatedOpportunityId: input.opportunityId,
              relatedMeetingId: input.meetingId,
              relatedCompanyId: input.companyId ?? null,
              status: BlockerStatus.OPEN,
            },
          }),
        ),
      );
    }
  }
}

export async function syncMeetingOfficialWriteIntents(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string;
  sourcePage?: string;
  force?: boolean;
}) {
  const meeting = await loadOfficialWriteMeeting(input.workspaceId, input.meetingId);
  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const [shadowSource, executionProofSources] = await Promise.all([
    loadApprovedShadowSource(input.workspaceId, input.meetingId),
    loadApprovedExecutionProofSources(input.workspaceId, input.meetingId),
  ]);

  const contracts = buildOfficialWriteIntentContracts({
    shadowSource,
    executionProofSources,
  });

  if (contracts.length === 0) {
    return {
      ok: true,
      reused: true,
      intentCount: 0,
    };
  }

  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: meeting.opportunityId,
    companyId: meeting.companyId,
    eventType: "official.write_intent_created",
    actorName: input.actorName,
    payload: {
      contractCount: contracts.length,
    },
  });

  let createdCount = 0;

  for (const contract of contracts) {
    const persisted = await upsertOfficialWriteIntent({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      meetingId: input.meetingId,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      sourceArtifactBundleId: contract.sourceShadowRef ?? executionProofSources.find((item) => item.id === contract.sourceExecutionProofRef)?.sourceArtifactBundleId ?? null,
      sourceHumanActionExecutionId: contract.sourceExecutionProofRef ?? null,
      contract,
    });

    if (persisted.created) {
      createdCount += 1;
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId ?? null,
        actor: input.actorName,
        actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
        actionType: "HELM_V2_OFFICIAL_WRITE_INTENT_CREATED",
        targetType: "OfficialWriteIntent",
        targetId: persisted.id,
        summary: `${renderActionLabel(contract.writeActionType)} intent created for ${contract.officialObjectRef}`,
        payload: {
          sourceType: contract.sourceType,
          whatThisChanges: contract.whatThisChanges,
          whatThisDoesNotMean: contract.whatThisDoesNotMean,
        },
        sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
        relatedObjectType: "MEETING",
        relatedObjectId: input.meetingId,
      });
    }
  }

  return {
    ok: true,
    reused: createdCount === 0,
    intentCount: contracts.length,
    createdCount,
    runtimeEventId: runtimeEvent.id,
  };
}

type ConstrainedLimitedAutoOutcome = {
  simulatedResult: LimitedAutoSimulatedResult;
  executionStatus: LimitedAutoExecutionStatus;
  ackStatus: LimitedAutoAcknowledgementStatus;
  failureStatus: LimitedAutoFailureStatus;
  rollbackStatus: LimitedAutoRollbackStatus;
  receiptStatus: OfficialReceiptStatusValue;
  summaryWritebackMode: OfficialSummaryWritebackModeValue;
  manualFallbackRequired: boolean;
  escalationRequired: boolean;
  failureReason: string | null;
  manualReconciliationNote: string | null;
  deferredRetryNote: string | null;
  rollbackNote: string | null;
  externalSystemReference: string | null;
  ackPayload: Record<string, unknown>;
  sourceAckMode: OfficialWriteAcknowledgementMode;
  sourceAckNote: string;
};

function runConstrainedLimitedAutoAdapter(input: {
  limitedAutoIntent: LimitedAutoIntentRuntimeItem;
  simulateResult?: LimitedAutoSimulatedResult;
}): ConstrainedLimitedAutoOutcome {
  const simulatedResult = input.simulateResult ?? "ack_success";
  const actionReferencePrefix =
    input.limitedAutoIntent.limitedAutoActionType === "crm.update_next_action" ? "crm-auto-next-action" : "crm-auto-note";
  const basePayload = {
    limitedAutoIntentId: input.limitedAutoIntent.id,
    sourceWriteIntentId: input.limitedAutoIntent.sourceWriteIntentId,
    actionType: input.limitedAutoIntent.limitedAutoActionType,
    officialObjectRef: input.limitedAutoIntent.officialObjectRef,
    simulatedResult,
    timestamp: new Date().toISOString(),
  };

  if (simulatedResult === "ack_failure") {
    return {
      simulatedResult,
      executionStatus: LimitedAutoExecutionStatus.ACKNOWLEDGED_FAILURE,
      ackStatus: LimitedAutoAcknowledgementStatus.FAILURE,
      failureStatus: LimitedAutoFailureStatus.FAILURE_RECORDED,
      rollbackStatus: LimitedAutoRollbackStatus.NOT_REQUIRED,
      receiptStatus: "acknowledged_failure",
      summaryWritebackMode: "full",
      manualFallbackRequired: true,
      escalationRequired: false,
      failureReason: "The constrained CRM adapter rejected the limited auto write payload.",
      manualReconciliationNote: null,
      deferredRetryNote: "Retry not attempted automatically; the path should fall back to manual follow-up.",
      rollbackNote: null,
      externalSystemReference: null,
      ackPayload: {
        ...basePayload,
        acknowledgedSuccess: false,
        receiptStatus: "acknowledged_failure",
        summaryWritebackMode: "full",
        manualFallbackRequired: true,
        escalationRequired: false,
        receiptSummary: buildReceiptSummary("acknowledged_failure", "The constrained CRM adapter rejected the limited auto write payload.", null),
        failureReason: "adapter_rejected_payload",
      },
      sourceAckMode: "ack_failure",
      sourceAckNote: "Limited auto adapter rejected the payload; keep this official write on manual follow-up.",
    };
  }

  if (simulatedResult === "ack_unknown") {
    return {
      simulatedResult,
      executionStatus: LimitedAutoExecutionStatus.UNKNOWN,
      ackStatus: LimitedAutoAcknowledgementStatus.UNKNOWN,
      failureStatus: LimitedAutoFailureStatus.TIMEOUT_OR_UNKNOWN,
      rollbackStatus: LimitedAutoRollbackStatus.MANUAL_NOTE_RECORDED,
      receiptStatus: "timeout_unknown",
      summaryWritebackMode: "reconciliation_note",
      manualFallbackRequired: true,
      escalationRequired: true,
      failureReason: "The constrained CRM adapter returned timeout / unknown status.",
      manualReconciliationNote: "Auto path ended in timeout / unknown; manual reconciliation is required before Helm can claim any official success.",
      deferredRetryNote: "Retry not attempted automatically; manual operator follow-up is now required.",
      rollbackNote: "Rollback not available through the current constrained adapter stub.",
      externalSystemReference: null,
      ackPayload: {
        ...basePayload,
        acknowledgedSuccess: false,
        receiptStatus: "timeout_unknown",
        summaryWritebackMode: "reconciliation_note",
        manualFallbackRequired: true,
        escalationRequired: true,
        receiptSummary: buildReceiptSummary(
          "timeout_unknown",
          "Auto path ended in timeout / unknown; manual reconciliation is required before Helm can claim any official success.",
          null,
        ),
      },
      sourceAckMode: "receipt_unknown",
      sourceAckNote: "Limited auto returned timeout / unknown. This must stay in manual reconciliation and cannot be treated as official success.",
    };
  }

  if (simulatedResult === "partial_success") {
    return {
      simulatedResult,
      executionStatus: LimitedAutoExecutionStatus.MANUAL_FOLLOW_UP_REQUIRED,
      ackStatus: LimitedAutoAcknowledgementStatus.MANUAL_RECONCILIATION_REQUIRED,
      failureStatus: LimitedAutoFailureStatus.PARTIAL_SUCCESS,
      rollbackStatus: LimitedAutoRollbackStatus.MANUAL_NOTE_RECORDED,
      receiptStatus: "partial_success",
      summaryWritebackMode: "reconciliation_note",
      manualFallbackRequired: true,
      escalationRequired: true,
      failureReason: "The constrained adapter reported partial success and still needs manual reconciliation.",
      manualReconciliationNote: "Partial success requires manual reconciliation before Helm can treat the official path as complete.",
      deferredRetryNote: null,
      rollbackNote: "Rollback not available through the current constrained adapter stub.",
      externalSystemReference: `crm-partial-${input.limitedAutoIntent.id}`,
      ackPayload: {
        ...basePayload,
        acknowledgedSuccess: false,
        receiptStatus: "partial_success",
        summaryWritebackMode: "reconciliation_note",
        manualFallbackRequired: true,
        escalationRequired: true,
        receiptSummary: buildReceiptSummary(
          "partial_success",
          "Partial success requires manual reconciliation before Helm can treat the official path as complete.",
          `crm-partial-${input.limitedAutoIntent.id}`,
        ),
      },
      sourceAckMode: "receipt_partial_success",
      sourceAckNote: "Limited auto only reached a partial success posture. Keep the official write in reconciliation until a human confirms the external result.",
    };
  }

  if (simulatedResult === "stale_receipt") {
    return {
      simulatedResult,
      executionStatus: LimitedAutoExecutionStatus.MANUAL_FOLLOW_UP_REQUIRED,
      ackStatus: LimitedAutoAcknowledgementStatus.MANUAL_RECONCILIATION_REQUIRED,
      failureStatus: LimitedAutoFailureStatus.TIMEOUT_OR_UNKNOWN,
      rollbackStatus: LimitedAutoRollbackStatus.MANUAL_NOTE_RECORDED,
      receiptStatus: "stale_receipt",
      summaryWritebackMode: "audit_only",
      manualFallbackRequired: true,
      escalationRequired: true,
      failureReason: "The adapter returned a stale receipt that does not prove the write belongs to the current payload.",
      manualReconciliationNote: "The receipt looks stale / out-of-date; keep this path audit-only until a human resolves the mismatch.",
      deferredRetryNote: "Retry skipped automatically because the external receipt could not be trusted.",
      rollbackNote: "Rollback not available through the current constrained adapter stub.",
      externalSystemReference: `crm-stale-${input.limitedAutoIntent.id}`,
      ackPayload: {
        ...basePayload,
        acknowledgedSuccess: false,
        receiptStatus: "stale_receipt",
        summaryWritebackMode: "audit_only",
        manualFallbackRequired: true,
        escalationRequired: true,
        receiptSummary: buildReceiptSummary(
          "stale_receipt",
          "The receipt looks stale / out-of-date; keep this path audit-only until a human resolves the mismatch.",
          `crm-stale-${input.limitedAutoIntent.id}`,
        ),
      },
      sourceAckMode: "receipt_stale",
      sourceAckNote: "Limited auto returned a stale receipt. This cannot be treated as official success and must stay in manual reconciliation.",
    };
  }

  if (simulatedResult === "reconciliation_resolved") {
    return {
      simulatedResult,
      executionStatus: LimitedAutoExecutionStatus.MANUAL_FOLLOW_UP_REQUIRED,
      ackStatus: LimitedAutoAcknowledgementStatus.MANUAL_RECONCILIATION_REQUIRED,
      failureStatus: LimitedAutoFailureStatus.RETRY_NOT_ATTEMPTED,
      rollbackStatus: LimitedAutoRollbackStatus.MANUAL_NOTE_RECORDED,
      receiptStatus: "manual_reconciliation_resolved",
      summaryWritebackMode: "reconciliation_note",
      manualFallbackRequired: false,
      escalationRequired: false,
      failureReason: null,
      manualReconciliationNote: "Manual reconciliation resolved the external ambiguity, but this still requires a human note and does not claim broad auto-write.",
      deferredRetryNote: null,
      rollbackNote: "Rollback not available through the current constrained adapter stub.",
      externalSystemReference: `crm-recon-${input.limitedAutoIntent.id}`,
      ackPayload: {
        ...basePayload,
        acknowledgedSuccess: false,
        receiptStatus: "manual_reconciliation_resolved",
        summaryWritebackMode: "reconciliation_note",
        manualFallbackRequired: false,
        escalationRequired: false,
        receiptSummary: buildReceiptSummary(
          "manual_reconciliation_resolved",
          "Manual reconciliation resolved the external ambiguity, but this still requires a human note and does not claim broad auto-write.",
          `crm-recon-${input.limitedAutoIntent.id}`,
        ),
      },
      sourceAckMode: "reconciliation_resolved",
      sourceAckNote: "Manual reconciliation resolved the external ambiguity, but this does not retroactively weaken the guarded write boundary.",
    };
  }

  return {
    simulatedResult,
    executionStatus: LimitedAutoExecutionStatus.ACKNOWLEDGED_SUCCESS,
    ackStatus: LimitedAutoAcknowledgementStatus.SUCCESS,
    failureStatus: LimitedAutoFailureStatus.NONE,
    rollbackStatus: LimitedAutoRollbackStatus.NOT_SUPPORTED,
    receiptStatus: "acknowledged_success",
    summaryWritebackMode: "full",
    manualFallbackRequired: false,
    escalationRequired: false,
    failureReason: null,
    manualReconciliationNote: null,
    deferredRetryNote: null,
    rollbackNote: "Rollback is not available through the constrained adapter stub; any correction must go back through a new guarded write path.",
    externalSystemReference: `${actionReferencePrefix}-${input.limitedAutoIntent.id}`,
    ackPayload: {
      ...basePayload,
      acknowledgedSuccess: true,
      receiptStatus: "acknowledged_success",
      summaryWritebackMode: "full",
      manualFallbackRequired: false,
      escalationRequired: false,
      receiptSummary: buildReceiptSummary("acknowledged_success", null, `${actionReferencePrefix}-${input.limitedAutoIntent.id}`),
    },
    sourceAckMode: "ack_success",
    sourceAckNote: "Limited auto received a strong acknowledged_success response from the constrained CRM adapter.",
  };
}

export function simulateLimitedAutoOutcome(input: {
  actionType: OfficialWriteActionTypeValue;
  simulatedResult: LimitedAutoSimulatedResult;
}) {
  const coverage = getOfficialActionCoverage(input.actionType);
  return runConstrainedLimitedAutoAdapter({
    limitedAutoIntent: {
      id: `limited_auto_eval_${input.actionType}`,
      meetingId: "mtg_eval",
      opportunityId: "opp_eval",
      companyId: "company_eval",
      sourceWriteIntentId: `intent_eval_${input.actionType}`,
      officialSystemType: "crm",
      officialObjectRef: "crm:opportunity:opp_eval",
      limitedAutoActionType: input.actionType,
      actionCategory: coverage.category,
      actionRiskClass: coverage.riskClass,
      actionDefaultPath: coverage.defaultPath,
      acknowledgmentRequirement: coverage.acknowledgmentRequirement,
      rollbackExpectation: coverage.rollbackExpectation,
      receiptStatus: "manual_reconciliation_required",
      receiptSummaryWritebackMode: "reconciliation_note",
      receiptSummary: "pending simulated receipt",
      manualFallbackRequired: false,
      escalationRequired: false,
      limitedAutoEligibilityStatus: coverage.limitedAutoStatus === "eligible" ? "eligible" : "eligible_but_manual_only",
      limitedAutoEligibilityReason: coverage.boundaryReason,
      limitedAutoApprovalRequired: true,
      limitedAutoApprovalStatus: LimitedAutoApprovalStatus.APPROVED,
      limitedAutoExecutionStatus: LimitedAutoExecutionStatus.ATTEMPTED,
      limitedAutoAckStatus: LimitedAutoAcknowledgementStatus.PENDING,
      limitedAutoFailureStatus: LimitedAutoFailureStatus.NONE,
      limitedAutoRollbackStatus: LimitedAutoRollbackStatus.NOT_REQUIRED,
      approvalRequirements: {
        mandatoryReviewers: ["risk-promise-guard"],
        requiredApprovals: ["owner"],
        auditRequired: true,
        pilotEnabled: true,
        systemOfRecordWrite: true,
      },
      proposedWritePayload: {
        eval: true,
        actionType: input.actionType,
      },
      riskReviewSummary: "Eval-only limited auto simulation.",
      evidenceRefs: ["meeting:mtg_eval"],
      sourceProvenance: [{ type: "eval", id: `prov_${input.actionType}`, trust: "HUMAN_CONFIRMED" }],
      boundaryTrace: [LIMITED_AUTO_BOUNDARY_NOTE, LIMITED_AUTO_MANUAL_OVERRIDE_NOTE],
      confidence: 100,
      openQuestions: [],
      whatAutoPathWillDo: buildLimitedAutoWhatWillDo(input.actionType, "eligible"),
      whatAutoPathWillNotDo: buildLimitedAutoWhatWillNotDo(),
      manualOnlyReason: null,
      reviewNotes: null,
      approvedByName: "eval",
      approvedAt: null,
      rejectedByName: null,
      rejectedAt: null,
      attemptedByName: null,
      attemptedAt: null,
      acknowledgedByName: null,
      acknowledgedAt: null,
      limitedAutoAckPayload: null,
      limitedAutoFailureReason: null,
      manualReconciliationNote: null,
      deferredRetryNote: null,
      rollbackNote: null,
      externalSystemReference: null,
      limitedAutoAuditRef: null,
    },
    simulateResult: input.simulatedResult,
  });
}

export async function syncMeetingLimitedAutoIntents(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string;
  sourcePage?: string;
  force?: boolean;
}) {
  const meeting = await loadOfficialWriteMeeting(input.workspaceId, input.meetingId);
  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const approvedRows = await db.officialWriteIntent.findMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      writeApprovalStatus: OfficialWriteApprovalStatus.APPROVED,
      writeExecutionStatus: OfficialWriteExecutionStatus.REQUESTED,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (approvedRows.length === 0) {
    return {
      ok: true,
      reused: true,
      intentCount: 0,
      createdCount: 0,
    };
  }

  const contracts = buildLimitedAutoIntentContracts({
    officialWriteIntents: approvedRows.map((row) => toRuntimeItem(row)),
  });

  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: meeting.opportunityId,
    companyId: meeting.companyId,
    eventType: "official.write_limited_auto_synced",
    actorName: input.actorName,
    payload: {
      contractCount: contracts.length,
    },
  });

  let createdCount = 0;

  for (const contract of contracts) {
    const persisted = await upsertLimitedAutoIntent({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      meetingId: input.meetingId,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      contract,
    });

    if (persisted.created) {
      createdCount += 1;
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId ?? null,
        actor: input.actorName,
        actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
        actionType: "HELM_V2_LIMITED_AUTO_INTENT_SYNCED",
        targetType: "LimitedAutoIntent",
        targetId: persisted.id,
        summary: `${renderActionLabel(contract.limitedAutoActionType)} limited auto posture -> ${contract.limitedAutoEligibilityStatus}`,
        payload: {
          sourceWriteIntentId: contract.sourceWriteIntentId,
          eligibilityStatus: contract.limitedAutoEligibilityStatus,
          eligibilityReason: contract.limitedAutoEligibilityReason,
        },
        sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
        relatedObjectType: "MEETING",
        relatedObjectId: input.meetingId,
      });
    }
  }

  return {
    ok: true,
    reused: createdCount === 0,
    intentCount: contracts.length,
    createdCount,
    runtimeEventId: runtimeEvent.id,
  };
}

function applyFollowThroughTransition(input: {
  item: OfficialFollowThroughRuntimeItem;
  mode: OfficialFollowThroughUpdateMode;
  note?: string | null;
}) {
  let nextStatus = input.item.followThroughStatus;
  let nextResolutionStatus = input.item.followThroughResolutionStatus;
  let nextReconciliationStatus = input.item.reconciliationStatus;
  let managerAttentionRequired = input.item.managerAttentionRequired;
  let manualFallbackRequired = input.item.manualFallbackRequired;
  let escalationReason = input.item.escalationReason;

  switch (input.mode) {
    case "mark_investigating":
      nextStatus = "investigating";
      nextReconciliationStatus = input.item.reconciliationStatus === "not_required" ? "in_progress" : input.item.reconciliationStatus;
      break;
    case "mark_awaiting_external_receipt":
      nextStatus = "awaiting_external_receipt";
      nextReconciliationStatus = "required";
      break;
    case "resolve":
      nextStatus = "resolved";
      nextResolutionStatus = "resolved";
      nextReconciliationStatus = input.item.reconciliationStatus === "not_required" ? "not_required" : "resolved";
      managerAttentionRequired = false;
      break;
    case "close_no_change":
      nextStatus = "closed_no_change";
      nextResolutionStatus = "closed_no_change";
      break;
    case "defer":
      nextStatus = "awaiting_manual_action";
      nextResolutionStatus = "deferred";
      manualFallbackRequired = true;
      break;
    case "escalate_manager":
      nextStatus = "awaiting_manual_action";
      managerAttentionRequired = true;
      escalationReason = input.note?.trim() || input.item.escalationReason || "Escalated to manager for official follow-through handling.";
      break;
    case "force_manual_fallback":
      nextStatus = "awaiting_manual_action";
      manualFallbackRequired = true;
      escalationReason = input.note?.trim() || "Manual fallback forced because the official path still needs human handling.";
      break;
    case "block_boundary":
      nextStatus = "blocked_by_boundary";
      nextResolutionStatus = "blocked";
      manualFallbackRequired = true;
      break;
    case "add_reconciliation_note":
      nextStatus = input.item.followThroughStatus === "open" ? "investigating" : input.item.followThroughStatus;
      nextReconciliationStatus = input.item.reconciliationStatus === "not_required" ? "in_progress" : input.item.reconciliationStatus;
      break;
    case "assign_owner":
    case "mark_next_action":
      break;
  }

  if (!OFFICIAL_FOLLOW_THROUGH_TRANSITIONS[input.item.followThroughStatus].includes(nextStatus) && nextStatus !== input.item.followThroughStatus) {
    throw new Error("This official follow-through transition is not allowed from the current state.");
  }

  return {
    nextStatus,
    nextResolutionStatus,
    nextReconciliationStatus,
    managerAttentionRequired,
    manualFallbackRequired,
    escalationReason,
  };
}

export async function syncMeetingOfficialFollowThroughRuntime(input: {
  workspaceId: string;
  meetingId: string;
  actorName: string;
  actorUserId?: string;
  sourcePage?: string;
  force?: boolean;
}) {
  const meeting = await loadOfficialWriteMeeting(input.workspaceId, input.meetingId);
  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const [officialWriteRows, limitedAutoRows] = await Promise.all([
    db.officialWriteIntent.findMany({
      where: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        NOT: {
          writeAcknowledgementStatus: OfficialWriteAcknowledgementStatus.PENDING,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    db.limitedAutoIntent.findMany({
      where: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        limitedAutoApprovalStatus: LimitedAutoApprovalStatus.MANUAL_OVERRIDE,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const contracts = buildOfficialFollowThroughContracts({
    officialWriteIntents: officialWriteRows.map((row) => toRuntimeItem(row)),
    limitedAutoIntents: limitedAutoRows.map((row) => toLimitedAutoRuntimeItem(row)),
  });

  if (contracts.length === 0) {
    return {
      ok: true,
      reused: true,
      followThroughCount: 0,
      createdCount: 0,
    };
  }

  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: meeting.opportunityId,
    companyId: meeting.companyId,
    eventType: "official.write_followthrough_synced",
    actorName: input.actorName,
    payload: {
      contractCount: contracts.length,
    },
  });

  let createdCount = 0;

  for (const contract of contracts) {
    const persisted = await upsertOfficialFollowThrough({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      meetingId: input.meetingId,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      contract,
    });

    if (persisted.created) {
      createdCount += 1;
      await writeAuditLog({
        workspaceId: input.workspaceId,
        userId: input.actorUserId ?? null,
        actor: input.actorName,
        actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
        actionType: "HELM_V2_OFFICIAL_FOLLOWTHROUGH_SYNCED",
        targetType: "OfficialFollowThrough",
        targetId: persisted.id,
        summary: `${renderFollowThroughTypeLabel(contract.followThroughType)} synced for ${contract.officialObjectRef}`,
        payload: {
          sourceWriteIntentId: contract.sourceWriteIntentId,
          sourceLimitedAutoIntentId: contract.sourceLimitedAutoIntentId,
          followThroughStatus: contract.followThroughStatus,
          reconciliationStatus: contract.reconciliationStatus,
        },
        sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
        relatedObjectType: "MEETING",
        relatedObjectId: input.meetingId,
      });
    }
  }

  await syncOfficialFollowThroughManagedSummary({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: meeting.opportunityId,
  });

  return {
    ok: true,
    reused: createdCount === 0,
    followThroughCount: contracts.length,
    createdCount,
    runtimeEventId: runtimeEvent.id,
  };
}

export async function updateOfficialFollowThrough(input: {
  workspaceId: string;
  meetingId: string;
  followThroughId: string;
  actorId: string;
  actorName: string;
  mode: OfficialFollowThroughUpdateMode;
  ownerName?: string | null;
  nextAction?: string | null;
  note?: string | null;
  sourcePage?: string;
}) {
  const row = await db.officialFollowThrough.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.followThroughId,
    },
  });

  if (!row) {
    throw new Error("Official follow-through not found.");
  }

  const item = toOfficialFollowThroughRuntimeItem(row);
  const transition = applyFollowThroughTransition({
    item,
    mode: input.mode,
    note: input.note,
  });
  const now = new Date();
  const nextOwnerName = input.ownerName?.trim() || item.followThroughOwnerName;
  const nextOwnerId =
    input.mode === "assign_owner"
      ? nextOwnerName === input.actorName
        ? input.actorId
        : null
      : item.followThroughOwnerId;
  const nextAction = input.nextAction?.trim() || item.followThroughNextAction;
  const nextWritebackTargets = buildFollowThroughWritebackTargets({
    actionType: item.sourceActionType,
    managerAttentionRequired: transition.managerAttentionRequired,
    roleHandoffImpact: item.roleHandoffImpact,
    blockerSummaryImpact: item.blockerSummaryImpact,
  });
  const nextContractBase: Omit<OfficialFollowThroughContract, "followThroughSummary"> = {
    ...item,
    followThroughOwnerName: nextOwnerName,
    followThroughNextAction: nextAction,
    followThroughStatus: transition.nextStatus,
    followThroughResolutionStatus: transition.nextResolutionStatus,
    reconciliationStatus: transition.nextReconciliationStatus,
    followThroughWritebackTargets: nextWritebackTargets,
    managerAttentionRequired: transition.managerAttentionRequired,
    manualFallbackRequired: transition.manualFallbackRequired,
    escalationReason: transition.escalationReason,
  };
  const nextSummary = buildFollowThroughSummary(nextContractBase);

  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    eventType: "official.write_followthrough_updated",
    actorName: input.actorName,
    payload: {
      followThroughId: row.id,
      mode: input.mode,
      nextStatus: transition.nextStatus,
    },
  });

  await db.officialFollowThrough.update({
    where: { id: row.id },
    data: {
      runtimeEventId: runtimeEvent.id,
      followThroughOwnerId: nextOwnerId,
      followThroughOwnerName: nextOwnerName,
      followThroughNextAction: nextAction,
      followThroughStatus: fromOfficialFollowThroughStatusValue(transition.nextStatus),
      followThroughResolutionStatus: fromOfficialFollowThroughResolutionStatusValue(transition.nextResolutionStatus),
      reconciliationStatus: fromOfficialReconciliationStatusValue(transition.nextReconciliationStatus),
      followThroughSummary: nextSummary,
      resolutionNote:
        input.mode === "resolve" || input.mode === "close_no_change" || input.mode === "block_boundary"
          ? input.note?.trim() || row.resolutionNote
          : row.resolutionNote,
      reconciliationNote:
        input.mode === "add_reconciliation_note" ||
        input.mode === "mark_awaiting_external_receipt" ||
        input.mode === "mark_investigating"
          ? input.note?.trim() || row.reconciliationNote
          : row.reconciliationNote,
      managerAttentionRequired: transition.managerAttentionRequired,
      manualFallbackRequired: transition.manualFallbackRequired,
      escalationReason: transition.escalationReason,
      followThroughWritebackTargets: jsonStringify(nextWritebackTargets),
      resolvedByUserId:
        input.mode === "resolve" || input.mode === "close_no_change" ? input.actorId : row.resolvedByUserId,
      resolvedByName:
        input.mode === "resolve" || input.mode === "close_no_change" ? input.actorName : row.resolvedByName,
      resolvedAt: input.mode === "resolve" || input.mode === "close_no_change" ? now : row.resolvedAt,
    },
  });

  const audit = await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_OFFICIAL_FOLLOWTHROUGH_UPDATED",
    targetType: "OfficialFollowThrough",
    targetId: row.id,
    summary: `${renderFollowThroughTypeLabel(item.followThroughType)} -> ${transition.nextStatus}`,
    payload: {
      mode: input.mode,
      ownerName: nextOwnerName,
      nextAction,
      note: input.note ?? null,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "MEETING",
    relatedObjectId: input.meetingId,
  });

  await db.officialFollowThrough.update({
    where: { id: row.id },
    data: {
      auditRef: audit.id,
    },
  });

  const updated = toOfficialFollowThroughRuntimeItem({
    ...row,
    sourceActionType: row.sourceActionType,
    officialObjectRef: row.officialObjectRef,
    followThroughOwnerId: nextOwnerId,
    followThroughOwnerName: nextOwnerName,
    followThroughNextAction: nextAction,
    followThroughStatus: fromOfficialFollowThroughStatusValue(transition.nextStatus),
    followThroughResolutionStatus: fromOfficialFollowThroughResolutionStatusValue(transition.nextResolutionStatus),
    reconciliationStatus: fromOfficialReconciliationStatusValue(transition.nextReconciliationStatus),
    followThroughSummary: nextSummary,
    resolutionNote:
      input.mode === "resolve" || input.mode === "close_no_change" || input.mode === "block_boundary"
        ? input.note?.trim() || row.resolutionNote
        : row.resolutionNote,
    reconciliationNote:
      input.mode === "add_reconciliation_note" ||
      input.mode === "mark_awaiting_external_receipt" ||
      input.mode === "mark_investigating"
        ? input.note?.trim() || row.reconciliationNote
        : row.reconciliationNote,
    managerAttentionRequired: transition.managerAttentionRequired,
    manualFallbackRequired: transition.manualFallbackRequired,
    escalationReason: transition.escalationReason,
    followThroughWritebackTargets: jsonStringify(nextWritebackTargets),
    auditRef: audit.id,
    resolvedByName: input.mode === "resolve" || input.mode === "close_no_change" ? input.actorName : row.resolvedByName,
    resolvedAt: input.mode === "resolve" || input.mode === "close_no_change" ? now : row.resolvedAt,
  });

  const writeback = await syncOfficialFollowThroughManagedSummary({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: row.opportunityId,
  });

  const checkpointModes = new Set<OfficialFollowThroughUpdateMode>([
    "resolve",
    "close_no_change",
    "defer",
    "escalate_manager",
    "force_manual_fallback",
    "block_boundary",
  ]);

  const checkpoint = checkpointModes.has(input.mode)
    ? await writeOfficialFollowThroughCheckpoint({
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        opportunityId: row.opportunityId,
        companyId: row.companyId,
        followThrough: updated,
        actorName: input.actorName,
        recordedAt: now,
      })
    : null;

  return {
    ok: true,
    followThroughStatus: transition.nextStatus,
    resolutionStatus: transition.nextResolutionStatus,
    reconciliationStatus: transition.nextReconciliationStatus,
    meetingSummary: writeback.meetingSummary,
    opportunitySummary: writeback.opportunitySummary,
    blockerSummary: writeback.blockerSummary,
    checkpointId: checkpoint?.id ?? null,
  };
}

async function executeLimitedAutoIntent(input: {
  workspaceId: string;
  meetingId: string;
  limitedAutoIntentId: string;
  actorId: string;
  actorName: string;
  sourcePage?: string;
  simulateResult?: LimitedAutoSimulatedResult;
}) {
  const row = await db.limitedAutoIntent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.limitedAutoIntentId,
    },
  });

  if (!row) {
    throw new Error("Limited auto intent not found.");
  }

  const intent = toLimitedAutoRuntimeItem(row);

  if (intent.limitedAutoEligibilityStatus !== "eligible") {
    throw new Error("Limited auto can only execute after an eligible posture is established.");
  }

  if (intent.limitedAutoApprovalStatus !== LimitedAutoApprovalStatus.APPROVED) {
    throw new Error("Limited auto requires explicit approval before constrained execution.");
  }

  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    eventType: "official.write_limited_auto_attempted",
    actorName: input.actorName,
    payload: {
      limitedAutoIntentId: row.id,
      sourceWriteIntentId: row.sourceWriteIntentId,
      actionType: row.limitedAutoActionType,
    },
  });

  await attemptOfficialWriteIntent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    intentId: row.sourceWriteIntentId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourcePage: input.sourcePage,
  });

  const attemptedAt = new Date();
  await db.limitedAutoIntent.update({
    where: { id: row.id },
    data: {
      runtimeEventId: runtimeEvent.id,
      limitedAutoExecutionStatus: LimitedAutoExecutionStatus.ATTEMPTED,
      attemptedByUserId: input.actorId,
      attemptedByName: input.actorName,
      attemptedAt,
    },
  });

  const outcome = runConstrainedLimitedAutoAdapter({
    limitedAutoIntent: {
      ...intent,
      attemptedAt,
      limitedAutoExecutionStatus: LimitedAutoExecutionStatus.ATTEMPTED,
    },
    simulateResult: input.simulateResult,
  });

  const acknowledgedAt = new Date();
  await acknowledgeOfficialWriteIntent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    intentId: row.sourceWriteIntentId,
    reviewerId: input.actorId,
    reviewerName: input.actorName,
    mode: outcome.sourceAckMode,
    note: outcome.sourceAckNote,
    externalSystemReference: outcome.externalSystemReference,
    sourcePage: input.sourcePage,
  });

  const ackEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    eventType: "official.write_limited_auto_acknowledged",
    actorName: input.actorName,
    payload: {
      limitedAutoIntentId: row.id,
      acknowledgementStatus: outcome.ackStatus,
      failureStatus: outcome.failureStatus,
    },
  });

  const audit = await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_LIMITED_AUTO_EXECUTED",
    targetType: "LimitedAutoIntent",
    targetId: row.id,
    summary: `${renderActionLabel(intent.limitedAutoActionType)} limited auto -> ${outcome.ackStatus}`,
    payload: {
      runtimeEventId: runtimeEvent.id,
      acknowledgementEventId: ackEvent.id,
      simulatedResult: outcome.simulatedResult,
      receiptStatus: outcome.receiptStatus,
      summaryWritebackMode: outcome.summaryWritebackMode,
      externalSystemReference: outcome.externalSystemReference,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "MEETING",
    relatedObjectId: input.meetingId,
  });

  await db.limitedAutoIntent.update({
    where: { id: row.id },
    data: {
      limitedAutoExecutionStatus: outcome.executionStatus,
      limitedAutoAckStatus: outcome.ackStatus,
      limitedAutoFailureStatus: outcome.failureStatus,
      limitedAutoRollbackStatus: outcome.rollbackStatus,
      acknowledgedByUserId: input.actorId,
      acknowledgedByName: input.actorName,
      acknowledgedAt,
      limitedAutoAckPayload: jsonStringify(outcome.ackPayload),
      limitedAutoFailureReason: outcome.failureReason,
      manualReconciliationNote: outcome.manualReconciliationNote,
      deferredRetryNote: outcome.deferredRetryNote,
      rollbackNote: outcome.rollbackNote,
      externalSystemReference: outcome.externalSystemReference,
      limitedAutoAuditRef: audit.id,
    },
  });

  return {
    ok: true,
    executionStatus: outcome.executionStatus,
    ackStatus: outcome.ackStatus,
    failureStatus: outcome.failureStatus,
    rollbackStatus: outcome.rollbackStatus,
    externalSystemReference: outcome.externalSystemReference,
  };
}

export async function reviewLimitedAutoIntent(input: {
  workspaceId: string;
  meetingId: string;
  limitedAutoIntentId: string;
  reviewerId: string;
  reviewerName: string;
  mode: LimitedAutoReviewMode;
  reviewNotes?: string | null;
  sourcePage?: string;
  simulateResult?: LimitedAutoSimulatedResult;
}) {
  const row = await db.limitedAutoIntent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.limitedAutoIntentId,
    },
  });

  if (!row) {
    throw new Error("Limited auto intent not found.");
  }

  if (input.mode === "approve" && row.limitedAutoEligibilityStatus !== LimitedAutoEligibilityStatus.ELIGIBLE) {
    throw new Error("Only ELIGIBLE limited auto intents can be explicitly approved for constrained execution.");
  }

  const reviewedAt = new Date();
  const approvalStatus =
    input.mode === "approve"
      ? LimitedAutoApprovalStatus.APPROVED
      : input.mode === "reject"
        ? LimitedAutoApprovalStatus.REJECTED
        : input.mode === "block_boundary"
          ? LimitedAutoApprovalStatus.BLOCKED
          : input.mode === "force_manual"
            ? LimitedAutoApprovalStatus.MANUAL_OVERRIDE
            : LimitedAutoApprovalStatus.PENDING_REVIEW;

  await db.limitedAutoIntent.update({
    where: { id: row.id },
    data: {
      limitedAutoApprovalStatus: approvalStatus,
      reviewNotes: input.reviewNotes?.trim() || null,
      approvedByUserId: input.mode === "approve" ? input.reviewerId : null,
      approvedByName: input.mode === "approve" ? input.reviewerName : null,
      approvedAt: input.mode === "approve" ? reviewedAt : null,
      rejectedByUserId: input.mode !== "approve" && input.mode !== "keep_pending" ? input.reviewerId : null,
      rejectedByName: input.mode !== "approve" && input.mode !== "keep_pending" ? input.reviewerName : null,
      rejectedAt: input.mode !== "approve" && input.mode !== "keep_pending" ? reviewedAt : null,
      limitedAutoExecutionStatus:
        input.mode === "force_manual" ? LimitedAutoExecutionStatus.MANUAL_FOLLOW_UP_REQUIRED : row.limitedAutoExecutionStatus,
      limitedAutoFailureStatus:
        input.mode === "force_manual" ? LimitedAutoFailureStatus.RETRY_NOT_ATTEMPTED : row.limitedAutoFailureStatus,
      manualOnlyReason:
        input.mode === "force_manual"
          ? input.reviewNotes?.trim() || "Forced back to the guarded manual path by operator override."
          : row.manualOnlyReason,
    },
  });

  const audit = await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_LIMITED_AUTO_REVIEWED",
    targetType: "LimitedAutoIntent",
    targetId: row.id,
    summary: `${toActionTypeValue(row.limitedAutoActionType)} limited auto -> ${approvalStatus}`,
    payload: {
      mode: input.mode,
      reviewNotes: input.reviewNotes ?? null,
      sourceWriteIntentId: row.sourceWriteIntentId,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "MEETING",
    relatedObjectId: input.meetingId,
  });

  await db.limitedAutoIntent.update({
    where: { id: row.id },
    data: {
      limitedAutoAuditRef: audit.id,
    },
  });

  if (input.mode !== "approve") {
    if (input.mode === "force_manual") {
      await syncMeetingOfficialFollowThroughRuntime({
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
        actorName: input.reviewerName,
        actorUserId: input.reviewerId,
        sourcePage: input.sourcePage,
        force: true,
      });
    }

    return {
      ok: true,
      approvalStatus,
      executionStatus: input.mode === "force_manual" ? LimitedAutoExecutionStatus.MANUAL_FOLLOW_UP_REQUIRED : row.limitedAutoExecutionStatus,
      ackStatus: row.limitedAutoAckStatus,
    };
  }

  const execution = await executeLimitedAutoIntent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    limitedAutoIntentId: row.id,
    actorId: input.reviewerId,
    actorName: input.reviewerName,
    sourcePage: input.sourcePage,
    simulateResult: input.simulateResult,
  });

  await syncMeetingOfficialFollowThroughRuntime({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    actorName: input.reviewerName,
    actorUserId: input.reviewerId,
    sourcePage: input.sourcePage,
    force: true,
  });

  return {
    ok: true,
    approvalStatus,
    executionStatus: execution.executionStatus,
    ackStatus: execution.ackStatus,
    failureStatus: execution.failureStatus,
    rollbackStatus: execution.rollbackStatus,
  };
}

export async function reviewOfficialWriteIntent(input: {
  workspaceId: string;
  meetingId: string;
  intentId: string;
  reviewerId: string;
  reviewerName: string;
  mode: OfficialWriteReviewMode;
  reviewNotes?: string | null;
  sourcePage?: string;
}) {
  const intent = await db.officialWriteIntent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.intentId,
    },
  });

  if (!intent) {
    throw new Error("Official write intent not found.");
  }

  const reviewedAt = new Date();
  const approvalStatus =
    input.mode === "approve"
      ? OfficialWriteApprovalStatus.APPROVED
      : input.mode === "reject"
        ? OfficialWriteApprovalStatus.REJECTED
        : input.mode === "block_boundary"
          ? OfficialWriteApprovalStatus.BLOCKED
          : input.mode === "insufficient_evidence"
            ? OfficialWriteApprovalStatus.INSUFFICIENT_EVIDENCE
            : OfficialWriteApprovalStatus.PENDING_REVIEW;

  await db.officialWriteIntent.update({
    where: { id: intent.id },
    data: {
      writeApprovalStatus: approvalStatus,
      reviewNotes: input.reviewNotes?.trim() || null,
      approvedByUserId: input.mode === "approve" ? input.reviewerId : null,
      approvedByName: input.mode === "approve" ? input.reviewerName : null,
      approvedAt: input.mode === "approve" ? reviewedAt : null,
      rejectedByUserId: input.mode !== "approve" && input.mode !== "keep_pending" ? input.reviewerId : null,
      rejectedByName: input.mode !== "approve" && input.mode !== "keep_pending" ? input.reviewerName : null,
      rejectedAt: input.mode !== "approve" && input.mode !== "keep_pending" ? reviewedAt : null,
    },
  });

  const audit = await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_OFFICIAL_WRITE_INTENT_REVIEWED",
    targetType: "OfficialWriteIntent",
    targetId: intent.id,
    summary: `${toActionTypeValue(intent.writeActionType)} -> ${approvalStatus}`,
    payload: {
      mode: input.mode,
      reviewNotes: input.reviewNotes ?? null,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "MEETING",
    relatedObjectId: input.meetingId,
  });

  await db.officialWriteIntent.update({
    where: { id: intent.id },
    data: {
      writeAuditRef: audit.id,
    },
  });

  return {
    ok: true,
    approvalStatus,
    blockedByBoundary: approvalStatus === OfficialWriteApprovalStatus.BLOCKED,
    insufficientEvidence: approvalStatus === OfficialWriteApprovalStatus.INSUFFICIENT_EVIDENCE,
  };
}

export async function attemptOfficialWriteIntent(input: {
  workspaceId: string;
  meetingId: string;
  intentId: string;
  actorId: string;
  actorName: string;
  sourcePage?: string;
}) {
  const intent = await db.officialWriteIntent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.intentId,
    },
  });

  if (!intent) {
    throw new Error("Official write intent not found.");
  }

  if (intent.writeApprovalStatus !== OfficialWriteApprovalStatus.APPROVED) {
    throw new Error("Official write intent must be explicitly approved before any guarded write attempt.");
  }

  const attemptedAt = new Date();
  const event = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: intent.opportunityId,
    companyId: intent.companyId,
    eventType: "official.write_attempted",
    actorName: input.actorName,
    payload: {
      intentId: intent.id,
      actionType: intent.writeActionType,
    },
  });

  const audit = await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorId,
    actor: input.actorName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_OFFICIAL_WRITE_ATTEMPTED",
    targetType: "OfficialWriteIntent",
    targetId: intent.id,
    summary: `${toActionTypeValue(intent.writeActionType)} attempted as guarded official write`,
    payload: {
      runtimeEventId: event.id,
      writeBoundary: intent.writeBoundary,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "MEETING",
    relatedObjectId: input.meetingId,
  });

  await db.officialWriteIntent.update({
    where: { id: intent.id },
    data: {
      writeExecutionStatus: OfficialWriteExecutionStatus.ATTEMPTED,
      attemptedByUserId: input.actorId,
      attemptedByName: input.actorName,
      attemptedAt,
      writeAuditRef: audit.id,
    },
  });

  return {
    ok: true,
    executionStatus: OfficialWriteExecutionStatus.ATTEMPTED,
  };
}

export async function acknowledgeOfficialWriteIntent(input: {
  workspaceId: string;
  meetingId: string;
  intentId: string;
  reviewerId: string;
  reviewerName: string;
  mode: OfficialWriteAcknowledgementMode;
  note?: string | null;
  externalSystemReference?: string | null;
  sourcePage?: string;
}) {
  const row = await db.officialWriteIntent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      id: input.intentId,
    },
  });

  if (!row) {
    throw new Error("Official write intent not found.");
  }

  if (
    row.writeExecutionStatus !== OfficialWriteExecutionStatus.ATTEMPTED &&
    row.writeExecutionStatus !== OfficialWriteExecutionStatus.ACKNOWLEDGED_FAILURE
  ) {
    throw new Error("Official write intent must be attempted before acknowledgment is recorded.");
  }

  const acknowledgedAt = new Date();
  const nextExecutionStatus =
    input.mode === "ack_success"
      ? OfficialWriteExecutionStatus.ACKNOWLEDGED_SUCCESS
      : input.mode === "ack_failure"
        ? OfficialWriteExecutionStatus.ACKNOWLEDGED_FAILURE
        : input.mode === "deferred_retry"
          ? OfficialWriteExecutionStatus.DEFERRED_RETRY
          : OfficialWriteExecutionStatus.ATTEMPTED;
  const nextAckStatus =
    input.mode === "ack_success"
      ? OfficialWriteAcknowledgementStatus.SUCCESS
      : input.mode === "ack_failure"
        ? OfficialWriteAcknowledgementStatus.FAILURE
        : input.mode === "deferred_retry"
          ? OfficialWriteAcknowledgementStatus.DEFERRED
          : OfficialWriteAcknowledgementStatus.RECONCILIATION_NOTED;

  const receiptTrace =
    input.mode === "ack_success"
      ? buildOfficialReceiptTrace({
          receiptStatus: "acknowledged_success",
          note: input.note,
          externalSystemReference: input.externalSystemReference,
        })
      : input.mode === "ack_failure"
        ? buildOfficialReceiptTrace({
            receiptStatus: "acknowledged_failure",
            note: input.note,
            externalSystemReference: input.externalSystemReference,
          })
        : input.mode === "receipt_unknown"
          ? buildOfficialReceiptTrace({
              receiptStatus: "timeout_unknown",
              note: input.note,
              externalSystemReference: input.externalSystemReference,
            })
          : input.mode === "receipt_partial_success"
            ? buildOfficialReceiptTrace({
                receiptStatus: "partial_success",
                note: input.note,
                externalSystemReference: input.externalSystemReference,
              })
            : input.mode === "receipt_stale"
              ? buildOfficialReceiptTrace({
                  receiptStatus: "stale_receipt",
                  note: input.note,
                  externalSystemReference: input.externalSystemReference,
                })
              : input.mode === "reconciliation_resolved"
                ? buildOfficialReceiptTrace({
                    receiptStatus: "manual_reconciliation_resolved",
                    note: input.note,
                    externalSystemReference: input.externalSystemReference,
                  })
                : input.mode === "deferred_retry"
                  ? buildOfficialReceiptTrace({
                      receiptStatus: "retry_skipped",
                      note: input.note,
                      externalSystemReference: input.externalSystemReference,
                    })
                  : buildOfficialReceiptTrace({
                      receiptStatus: "manual_reconciliation_required",
                      note: input.note,
                      externalSystemReference: input.externalSystemReference,
                    });

  const ackPayload = {
    mode: input.mode,
    note: input.note?.trim() || null,
    externalSystemReference: input.externalSystemReference?.trim() || null,
    acknowledgedAt: acknowledgedAt.toISOString(),
    systemReturnedSuccess: input.mode === "ack_success",
    receiptStatus: receiptTrace.receiptStatus,
    summaryWritebackMode: receiptTrace.summaryWritebackMode,
    manualFallbackRequired: receiptTrace.manualFallbackRequired,
    escalationRequired: receiptTrace.escalationRequired,
    receiptSummary: receiptTrace.receiptSummary,
  };

  const event = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: row.opportunityId,
    companyId: row.companyId,
    eventType: "official.write_acknowledged",
    actorName: input.reviewerName,
    payload: {
      intentId: row.id,
      result: nextAckStatus,
    },
  });

  await db.officialWriteIntent.update({
    where: { id: row.id },
    data: {
      writeExecutionStatus: nextExecutionStatus,
      writeAcknowledgementStatus: nextAckStatus,
      acknowledgedByUserId: input.reviewerId,
      acknowledgedByName: input.reviewerName,
      acknowledgedAt,
      writeAcknowledgementPayload: jsonStringify(ackPayload),
      writeFailureReason: input.mode === "ack_failure" ? input.note?.trim() || "Official write failed" : null,
      manualReconciliationNote:
        input.mode === "reconciliation_note" ||
        input.mode === "receipt_unknown" ||
        input.mode === "receipt_partial_success" ||
        input.mode === "receipt_stale" ||
        input.mode === "reconciliation_resolved"
          ? input.note?.trim() || receiptTrace.receiptSummary
          : null,
      deferredRetryNote: input.mode === "deferred_retry" ? input.note?.trim() || receiptTrace.receiptSummary : null,
      externalSystemReference: input.externalSystemReference?.trim() || null,
    },
  });

  const intent = toRuntimeItem({
    ...row,
    writeExecutionStatus: nextExecutionStatus,
    writeAcknowledgementStatus: nextAckStatus,
    acknowledgedByName: input.reviewerName,
    acknowledgedAt,
    writeAcknowledgementPayload: jsonStringify(ackPayload),
    writeFailureReason: input.mode === "ack_failure" ? input.note?.trim() || "Official write failed" : null,
    manualReconciliationNote:
      input.mode === "reconciliation_note" ||
      input.mode === "receipt_unknown" ||
      input.mode === "receipt_partial_success" ||
      input.mode === "receipt_stale" ||
      input.mode === "reconciliation_resolved"
        ? input.note?.trim() || receiptTrace.receiptSummary
        : null,
    deferredRetryNote: input.mode === "deferred_retry" ? input.note?.trim() || receiptTrace.receiptSummary : null,
    externalSystemReference: input.externalSystemReference?.trim() || null,
  });

  if (input.mode === "ack_success") {
    await applyAcknowledgedOfficialWriteSuccess({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: row.opportunityId,
      companyId: row.companyId,
      intent,
    });
  }

  const audit = await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.reviewerId,
    actor: input.reviewerName,
    actorType: ActorType.USER,
    actionType: "HELM_V2_OFFICIAL_WRITE_ACKNOWLEDGED",
    targetType: "OfficialWriteIntent",
    targetId: row.id,
    summary: `${toActionTypeValue(row.writeActionType)} -> ${nextAckStatus}`,
    payload: {
      runtimeEventId: event.id,
      acknowledgementStatus: nextAckStatus,
      note: input.note ?? null,
      externalSystemReference: input.externalSystemReference ?? null,
    },
    sourcePage: input.sourcePage ?? `/meetings/${input.meetingId}`,
    relatedObjectType: "MEETING",
    relatedObjectId: input.meetingId,
  });

  const [writeback, checkpoint] = await Promise.all([
    receiptTrace.summaryWritebackMode === "audit_only"
      ? Promise.resolve({
          meetingSummary: null,
          opportunitySummary: null,
        })
      : syncOfficialWriteManagedSummary({
          workspaceId: input.workspaceId,
          meetingId: input.meetingId,
          opportunityId: row.opportunityId,
        }),
    writeOfficialWriteCheckpoint({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      opportunityId: row.opportunityId,
      companyId: row.companyId,
      intent: {
        ...intent,
        writeAuditRef: audit.id,
      },
      reviewerName: input.reviewerName,
      acknowledgedAt,
    }),
  ]);

  await db.officialWriteIntent.update({
    where: { id: row.id },
    data: {
      writeAuditRef: audit.id,
    },
  });

  await syncMeetingOfficialFollowThroughRuntime({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    actorName: input.reviewerName,
    actorUserId: input.reviewerId,
    sourcePage: input.sourcePage,
    force: true,
  });

  return {
    ok: true,
    executionStatus: nextExecutionStatus,
    acknowledgementStatus: nextAckStatus,
    meetingSummary: writeback.meetingSummary,
    opportunitySummary: writeback.opportunitySummary,
    checkpointId: checkpoint.id,
  };
}

export async function getMeetingOfficialWriteRuntimeSummary(
  workspaceId: string,
  meetingId: string,
): Promise<OfficialWriteRuntimeSummary | null> {
  const meeting = await loadOfficialWriteMeeting(workspaceId, meetingId);
  if (!meeting) return null;

  const [
    latestIntentEvent,
    latestAttemptEvent,
    latestAcknowledgementEvent,
    latestLimitedAutoEligibilityEvent,
    latestLimitedAutoExecutionEvent,
    latestLimitedAutoAcknowledgementEvent,
    latestFollowThroughEvent,
    intents,
    limitedAutoIntents,
    followThroughRows,
    shadowSource,
    executionProofSources,
    latestCheckpoint,
    blockerCount,
  ] =
    await Promise.all([
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "official.write_intent_created",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "official.write_attempted",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "official.write_acknowledged",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "official.write_limited_auto_synced",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "official.write_limited_auto_attempted",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: "official.write_limited_auto_acknowledged",
        },
        orderBy: { createdAt: "desc" },
      }),
      db.runtimeEvent.findFirst({
        where: {
          workspaceId,
          meetingId,
          eventType: {
            in: ["official.write_followthrough_synced", "official.write_followthrough_updated"],
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.officialWriteIntent.findMany({
        where: {
          workspaceId,
          meetingId,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      db.limitedAutoIntent.findMany({
        where: {
          workspaceId,
          meetingId,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      db.officialFollowThrough.findMany({
        where: {
          workspaceId,
          meetingId,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      loadApprovedShadowSource(workspaceId, meetingId),
      loadApprovedExecutionProofSources(workspaceId, meetingId),
      db.memoryItem.findFirst({
        where: {
          workspaceId,
          meetingId,
          writer: OFFICIAL_WRITE_CHECKPOINT_WRITER,
          summary: {
            contains: "Guarded official write",
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          summary: true,
          createdAt: true,
        },
      }),
      meeting.opportunityId
        ? db.blocker.count({
            where: {
              workspaceId,
              relatedOpportunityId: meeting.opportunityId,
              status: BlockerStatus.OPEN,
            },
          })
        : Promise.resolve(0),
    ]);

  if (intents.length === 0 && followThroughRows.length === 0 && !shadowSource && executionProofSources.length === 0) {
    return null;
  }

  const followThroughItems = followThroughRows.map((row) => toOfficialFollowThroughRuntimeItem(row));

  return {
    latestIntentEvent: latestIntentEvent
      ? {
          id: latestIntentEvent.id,
          status: latestIntentEvent.status,
          createdAt: latestIntentEvent.createdAt,
          completedAt: latestIntentEvent.completedAt,
        }
      : null,
    latestAttemptEvent: latestAttemptEvent
      ? {
          id: latestAttemptEvent.id,
          status: latestAttemptEvent.status,
          createdAt: latestAttemptEvent.createdAt,
          completedAt: latestAttemptEvent.completedAt,
        }
      : null,
    latestAcknowledgementEvent: latestAcknowledgementEvent
      ? {
          id: latestAcknowledgementEvent.id,
          status: latestAcknowledgementEvent.status,
          createdAt: latestAcknowledgementEvent.createdAt,
          completedAt: latestAcknowledgementEvent.completedAt,
        }
      : null,
    sourceEligibility: {
      approvedShadowRecommendation: Boolean(shadowSource),
      acknowledgedExecutionProofCount: executionProofSources.length,
      eligibleIntentCount: intents.length,
    },
    currentOfficial: meeting.opportunity
      ? {
          stage: meeting.opportunity.stage,
          nextAction: meeting.opportunity.nextAction,
          openBlockerCount: blockerCount,
        }
      : null,
    latestWriteback: {
      meetingPostMeetingSummary: meeting.postMeetingSummary,
      opportunityNextStepSummary: meeting.opportunity?.nextStepSummary ?? null,
      latestCheckpoint,
    },
    intents: intents.map((item) => toRuntimeItem(item)),
    limitedAuto:
      limitedAutoIntents.length > 0
        ? {
            latestEligibilityEvent: latestLimitedAutoEligibilityEvent
              ? {
                  id: latestLimitedAutoEligibilityEvent.id,
                  status: latestLimitedAutoEligibilityEvent.status,
                  createdAt: latestLimitedAutoEligibilityEvent.createdAt,
                  completedAt: latestLimitedAutoEligibilityEvent.completedAt,
                }
              : null,
            latestExecutionEvent: latestLimitedAutoExecutionEvent
              ? {
                  id: latestLimitedAutoExecutionEvent.id,
                  status: latestLimitedAutoExecutionEvent.status,
                  createdAt: latestLimitedAutoExecutionEvent.createdAt,
                  completedAt: latestLimitedAutoExecutionEvent.completedAt,
                }
              : null,
            latestAcknowledgementEvent: latestLimitedAutoAcknowledgementEvent
              ? {
                  id: latestLimitedAutoAcknowledgementEvent.id,
                  status: latestLimitedAutoAcknowledgementEvent.status,
                  createdAt: latestLimitedAutoAcknowledgementEvent.createdAt,
                  completedAt: latestLimitedAutoAcknowledgementEvent.completedAt,
                }
              : null,
            eligibilityCounts: {
              eligible: limitedAutoIntents.filter((item) => item.limitedAutoEligibilityStatus === LimitedAutoEligibilityStatus.ELIGIBLE).length,
              manualOnly: limitedAutoIntents.filter((item) => item.limitedAutoEligibilityStatus === LimitedAutoEligibilityStatus.ELIGIBLE_BUT_MANUAL_ONLY).length,
              blocked: limitedAutoIntents.filter((item) => item.limitedAutoEligibilityStatus === LimitedAutoEligibilityStatus.BLOCKED).length,
              deferred: limitedAutoIntents.filter((item) => item.limitedAutoEligibilityStatus === LimitedAutoEligibilityStatus.DEFERRED).length,
            },
            intents: limitedAutoIntents.map((item) => toLimitedAutoRuntimeItem(item)),
          }
        : null,
    followThrough:
      followThroughItems.length > 0
        ? {
            latestSyncEvent: latestFollowThroughEvent
              ? {
                  id: latestFollowThroughEvent.id,
                  status: latestFollowThroughEvent.status,
                  createdAt: latestFollowThroughEvent.createdAt,
                  completedAt: latestFollowThroughEvent.completedAt,
                }
              : null,
            openCount: followThroughItems.filter(
              (item) =>
                item.followThroughStatus === "open" ||
                item.followThroughStatus === "investigating" ||
                item.followThroughStatus === "awaiting_manual_action" ||
                item.followThroughStatus === "awaiting_external_receipt",
            ).length,
            managerAttentionCount: followThroughItems.filter((item) => item.managerAttentionRequired).length,
            unresolvedCount: followThroughItems.filter(
              (item) =>
                item.followThroughResolutionStatus !== "resolved" &&
                item.followThroughResolutionStatus !== "closed_no_change" &&
                item.followThroughResolutionStatus !== "blocked",
            ).length,
            items: followThroughItems,
          }
        : null,
  };
}

export function evaluateSprint6OfficialWriteGuard(input: {
  intents: OfficialWriteIntentContract[];
  requiredActionTypes: OfficialWriteActionTypeValue[];
}) {
  const presentActionTypes = new Set(input.intents.map((item) => item.writeActionType));
  const writeIntentConsistencyPass =
    input.requiredActionTypes.every((item) => presentActionTypes.has(item)) &&
    input.intents.every((item) => item.sourceKey.length > 0 && item.whatThisChanges.length > 0 && item.whatThisDoesNotMean.length > 0);
  const approvalMatrixEnforcementPass = input.intents.every((item) => {
    const rule = resolveApprovalRule(OFFICIAL_ACTION_TO_MATRIX_ACTION[item.writeActionType]);
    return (
      item.writeApprovalTier === rule.tier &&
      item.approvalRequirements.requiredApprovals.join("|") === rule.requiredApprovals.join("|") &&
      item.approvalRequirements.mandatoryReviewers.join("|") === rule.mandatoryReviewers.join("|")
    );
  });
  const shadowOfficialSeparationPass = input.intents.every(
    (item) =>
      item.writeBoundary.includes("auto-write") &&
      item.boundaryTrace.some((trace) => trace.includes("official") || trace.includes("shadow")) &&
      item.whatThisDoesNotMean.includes("official CRM"),
  );
  const evidenceSufficiencyPass = input.intents.every(
    (item) => item.evidenceRefs.length > 0 && item.sourceProvenance.length > 0 && item.confidence >= 0,
  );
  const acknowledgementFailureCapturePass = input.intents.every(
    (item) =>
      item.writeAcknowledgementStatus === "pending" &&
      item.whatThisDoesNotMean.includes("actual official write success") &&
      item.whatThisDoesNotMean.includes("external system"),
  );
  const noAutoWriteSafetyPass = input.intents.every(
    (item) =>
      item.writeApprovalStatus === "pending_review" &&
      item.writeExecutionStatus === "requested" &&
      item.writeBoundary.includes("default auto-write"),
  );

  return {
    writeIntentConsistencyPass,
    approvalMatrixEnforcementPass,
    shadowOfficialSeparationPass,
    evidenceSufficiencyPass,
    acknowledgementFailureCapturePass,
    noAutoWriteSafetyPass,
  } satisfies Sprint6EvaluationResult;
}

export function evaluateSprint8LimitedAutoPath(input: {
  intents: LimitedAutoIntentContract[];
  requiredEligibleActionTypes: OfficialWriteActionTypeValue[];
  requiredManualOnlyActionTypes: OfficialWriteActionTypeValue[];
}) {
  const byActionType = new Map(input.intents.map((item) => [item.limitedAutoActionType, item] as const));
  const eligibilityCorrectnessPass =
    input.requiredEligibleActionTypes.every(
      (item) => byActionType.get(item)?.limitedAutoEligibilityStatus === "eligible",
    ) &&
    input.requiredManualOnlyActionTypes.every(
      (item) => byActionType.get(item)?.limitedAutoEligibilityStatus === "eligible_but_manual_only",
    );
  const whitelistEnforcementPass = input.intents.every((item) => LIMITED_AUTO_ALLOWED_ACTIONS.has(item.limitedAutoActionType));
  const noAutoWriteDefaultPass = input.intents.every(
    (item) =>
      item.limitedAutoApprovalRequired &&
      item.limitedAutoApprovalStatus === "pending_review" &&
      item.limitedAutoExecutionStatus === "requested" &&
      item.whatAutoPathWillNotDo.includes("broad auto-write"),
  );
  const acknowledgementBoundaryPass = input.intents.every(
    (item) =>
      (item.limitedAutoEligibilityStatus === "eligible"
        ? item.whatAutoPathWillDo.includes("acknowledged_success")
        : item.whatAutoPathWillDo.includes("manual-only path") || item.whatAutoPathWillDo.includes("non-executing")) &&
      (item.whatAutoPathWillNotDo.includes("official write success") || item.whatAutoPathWillNotDo.includes("正式write 成功")) &&
      item.boundaryTrace.some((trace) => trace.includes("override") || trace.includes("manual")),
  );
  const manualOverridePass = input.intents.every(
    (item) =>
      item.whatAutoPathWillNotDo.includes("Force manual path remains available") &&
      item.boundaryTrace.some((trace) => trace.includes("Force manual path") || trace.includes("manual path")),
  );
  const shadowOfficialProofAckBoundaryPass = input.intents.every(
    (item) =>
      item.boundaryTrace.some((trace) => trace.includes("no hidden commit") || trace.includes("no broad auto-write")) &&
      item.whatAutoPathWillNotDo.includes("external outcome confirmed"),
  );

  return {
    eligibilityCorrectnessPass,
    whitelistEnforcementPass,
    noAutoWriteDefaultPass,
    acknowledgementBoundaryPass,
    manualOverridePass,
    shadowOfficialProofAckBoundaryPass,
  } satisfies Sprint8EvaluationResult;
}

export function evaluateSprint9RicherOfficialCoverage(input: {
  officialIntents: OfficialWriteIntentContract[];
  limitedAutoIntents: LimitedAutoIntentContract[];
  requiredEligibleActionTypes: OfficialWriteActionTypeValue[];
  requiredManualOnlyActionTypes: OfficialWriteActionTypeValue[];
  requiredBlockedActionTypes: OfficialCoverageActionTypeValue[];
}) {
  const limitedAutoByType = new Map(input.limitedAutoIntents.map((item) => [item.limitedAutoActionType, item] as const));
  const catalog = getRicherOfficialActionCoverageCatalog();

  const richerActionCoveragePass =
    catalog.some((item) => item.actionType === "crm.update_next_action" && item.defaultPath === "limited_auto") &&
    catalog.some((item) => item.actionType === "crm.update_blockers" && item.limitedAutoStatus === "eligible_but_manual_only") &&
    input.requiredBlockedActionTypes.every((actionType) => {
      const row = catalog.find((item) => item.actionType === actionType);
      return Boolean(row && (row.limitedAutoStatus === "blocked" || row.limitedAutoStatus === "deferred"));
    });

  const richerEligibilityPass =
    input.requiredEligibleActionTypes.every(
      (item) => limitedAutoByType.get(item)?.limitedAutoEligibilityStatus === "eligible",
    ) &&
    input.requiredManualOnlyActionTypes.every(
      (item) => limitedAutoByType.get(item)?.limitedAutoEligibilityStatus === "eligible_but_manual_only",
    );

  const richerExecutionPass =
    input.requiredEligibleActionTypes.every((item) => getOfficialActionCoverage(item).executableLimitedAuto) &&
    input.requiredManualOnlyActionTypes.every((item) => !getOfficialActionCoverage(item).executableLimitedAuto);

  const nextActionSuccess = simulateLimitedAutoOutcome({
    actionType: "crm.update_next_action",
    simulatedResult: "ack_success",
  });
  const partialOutcome = simulateLimitedAutoOutcome({
    actionType: "crm.update_next_action",
    simulatedResult: "partial_success",
  });
  const staleOutcome = simulateLimitedAutoOutcome({
    actionType: "crm.attach_note",
    simulatedResult: "stale_receipt",
  });

  const receiptInterpretationPass =
    nextActionSuccess.receiptStatus === "acknowledged_success" &&
    nextActionSuccess.summaryWritebackMode === "full" &&
    partialOutcome.receiptStatus === "partial_success" &&
    partialOutcome.manualFallbackRequired &&
    staleOutcome.receiptStatus === "stale_receipt" &&
    staleOutcome.summaryWritebackMode === "audit_only";

  const reconciliationPathPass =
    partialOutcome.manualReconciliationNote !== null &&
    partialOutcome.escalationRequired &&
    staleOutcome.manualReconciliationNote !== null &&
    staleOutcome.deferredRetryNote !== null &&
    staleOutcome.rollbackNote !== null;

  const manualFallbackPass = input.limitedAutoIntents.every(
    (item) =>
      item.whatAutoPathWillNotDo.includes("Force manual path remains available") &&
      item.boundaryTrace.some((trace) => trace.includes("Force manual path") || trace.includes("manual path")),
  );

  const noBroadAutoWritePass = input.limitedAutoIntents.every(
    (item) =>
      item.whatAutoPathWillNotDo.includes("broad auto-write") &&
      item.whatAutoPathWillNotDo.includes("official write success") &&
      item.limitedAutoApprovalStatus === "pending_review",
  );

  const separationPass = [...input.officialIntents, ...input.limitedAutoIntents].every(
    (item) =>
      item.boundaryTrace.some((trace) => trace.includes("official") || trace.includes("manual")) &&
      ("whatThisDoesNotMean" in item
        ? item.whatThisDoesNotMean.includes("official CRM")
        : item.whatAutoPathWillNotDo.includes("official write success")),
  );

  return {
    richerActionCoveragePass,
    richerEligibilityPass,
    richerExecutionPass,
    receiptInterpretationPass,
    reconciliationPathPass,
    manualFallbackPass,
    noBroadAutoWritePass,
    separationPass,
  } satisfies Sprint9EvaluationResult;
}

function toFollowThroughEvalItem(contract: OfficialFollowThroughContract): OfficialFollowThroughRuntimeItem {
  const now = new Date("2026-04-02T00:00:00.000Z");
  return {
    ...contract,
    id: `followthrough_eval_${contract.followThroughKey}`,
    meetingId: "mtg_eval_followthrough",
    opportunityId: contract.officialObjectRef.includes("opportunity:") ? "opp_eval_followthrough" : null,
    companyId: null,
    reconciliationNote: null,
    resolutionNote: null,
    auditRef: "audit_eval_followthrough",
    resolvedByName: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function evaluateSprint10OfficialFollowThrough(input: {
  followThroughContracts: OfficialFollowThroughContract[];
  sourceOfficialIntents?: OfficialWriteIntentRuntimeItem[];
  sourceLimitedAutoIntents?: LimitedAutoIntentRuntimeItem[];
  requiredFollowThroughTypes: OfficialFollowThroughTypeValue[];
  transitionChecks: Array<{
    followThroughType: OfficialFollowThroughTypeValue;
    updateMode: OfficialFollowThroughUpdateMode;
    expectedStatus: OfficialFollowThroughStatusValue;
    expectedResolutionStatus: OfficialFollowThroughResolutionStatusValue;
    expectedReconciliationStatus: OfficialReconciliationStatusValue;
  }>;
}) {
  const sourceOfficialIntents = input.sourceOfficialIntents ?? [];
  const sourceLimitedAutoIntents = input.sourceLimitedAutoIntents ?? [];
  const followThroughItems = input.followThroughContracts.map((item) => toFollowThroughEvalItem(item));
  const byType = new Map(followThroughItems.map((item) => [item.followThroughType, item] as const));

  const followThroughClassificationPass = input.requiredFollowThroughTypes.every((type) => byType.has(type));

  const transitionResults = input.transitionChecks.map((check) => {
    const item = byType.get(check.followThroughType);
    if (!item) {
      return {
        pass: false,
        reconciliationPass: false,
      };
    }

    const transition = applyFollowThroughTransition({
      item,
      mode: check.updateMode,
      note: "eval note",
    });

    return {
      pass:
        transition.nextStatus === check.expectedStatus &&
        transition.nextResolutionStatus === check.expectedResolutionStatus,
      reconciliationPass: transition.nextReconciliationStatus === check.expectedReconciliationStatus,
    };
  });

  const exceptionStateTransitionPass = transitionResults.every((item) => item.pass);
  const reconciliationPathPass =
    transitionResults.every((item) => item.reconciliationPass) &&
    followThroughItems
      .filter((item) => item.reconciliationStatus !== "not_required")
      .every((item) => item.followThroughWritebackTargets.includes("audit"));

  const manualOverrideEscalationPass = followThroughItems
    .filter((item) => item.followThroughType === "escalation_followthrough" || item.exceptionClass === "manual_override_required")
    .every(
      (item) =>
        item.manualFallbackRequired &&
        item.followThroughBoundary.includes("Force manual path") &&
        item.followThroughWritebackTargets.includes("audit"),
    );

  const resolutionWritebackPass = followThroughItems.every(
    (item) =>
      item.followThroughWritebackTargets.includes("audit") &&
      (!item.roleHandoffImpact || item.followThroughWritebackTargets.includes("role_handoff_summary")) &&
      (!item.blockerSummaryImpact || item.followThroughWritebackTargets.includes("blocker_summary")) &&
      item.summaryWritebackImpact !== null,
  );

  const officialSuccessConfusionPass =
    sourceOfficialIntents.every(
      (item) =>
        (item.writeAcknowledgementStatus === OfficialWriteAcknowledgementStatus.SUCCESS ||
          item.whatThisDoesNotMean.includes("actual official write success")) &&
        item.whatThisDoesNotMean.includes("external system"),
    ) &&
    sourceLimitedAutoIntents.every(
      (item) =>
        item.whatAutoPathWillNotDo.includes("official write success") &&
        item.whatAutoPathWillNotDo.includes("external outcome confirmed"),
    ) &&
    followThroughItems.every(
      (item) =>
        item.followThroughBoundary.includes("official success") ||
        item.followThroughBoundary.includes("official write success") ||
        item.followThroughBoundary.includes("does not automatically mean"),
    );

  const noBroadAutoWritePass =
    sourceOfficialIntents.every((item) => item.writeBoundary.includes("default auto-write")) &&
    sourceLimitedAutoIntents.every((item) => item.whatAutoPathWillNotDo.includes("broad auto-write")) &&
    followThroughItems.every(
      (item) =>
        item.manualFallbackRequired ||
        item.followThroughBoundary.includes("does not automatically mean official write success") ||
        item.followThroughBoundary.includes("not broad auto-write"),
    );

  return {
    followThroughClassificationPass,
    exceptionStateTransitionPass,
    reconciliationPathPass,
    manualOverrideEscalationPass,
    resolutionWritebackPass,
    officialSuccessConfusionPass,
    noBroadAutoWritePass,
  } satisfies Sprint10EvaluationResult;
}
