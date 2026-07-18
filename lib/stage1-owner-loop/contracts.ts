import type { ActionStatus, ApprovalStatus } from "@prisma/client";
import type {
  AutonomousActionRequest,
  AutonomyPolicyEnvelope,
  DecisionFollowThroughState,
  DecisionRecordStatus,
  EnterpriseObservationProgram,
  EvidenceAnswerPacket,
  ObservationSource,
  OwnerCommandDraft,
  SourceObservationReceipt,
} from "./types";

export type ContractValidation = {
  valid: boolean;
  errors: string[];
};

function isNonEmpty(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function isFiniteDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function validateEnterpriseObservationProgram(
  program: EnterpriseObservationProgram,
): ContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(program.programId)) errors.push("program_id_required");
  if (!isNonEmpty(program.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(program.purpose)) errors.push("purpose_required");
  if (uniqueNonEmpty(program.scopeRefs).length === 0) errors.push("scope_required");
  if (uniqueNonEmpty(program.dataCategories).length === 0) {
    errors.push("data_category_required");
  }
  if (!isNonEmpty(program.authorizationRef)) errors.push("authorization_ref_required");
  if (!Number.isInteger(program.retentionDays) || program.retentionDays <= 0) {
    errors.push("retention_days_invalid");
  }
  if (!isFiniteDate(program.startsAt) || !isFiniteDate(program.expiresAt)) {
    errors.push("authorization_window_invalid");
  } else if (Date.parse(program.startsAt) >= Date.parse(program.expiresAt)) {
    errors.push("authorization_window_empty");
  }
  if (program.status === "revoked") {
    if (!isNonEmpty(program.revokedAt)) errors.push("revoked_at_required");
    if (!isNonEmpty(program.revokedByRef)) errors.push("revoked_by_ref_required");
    if (!isNonEmpty(program.revocationReason)) errors.push("revocation_reason_required");
  } else if (program.revokedAt || program.revokedByRef || program.revocationReason) {
    errors.push("revocation_fields_without_revoked_status");
  }
  return { valid: errors.length === 0, errors };
}

export function validateObservationSource(source: ObservationSource): ContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(source.sourceId)) errors.push("source_id_required");
  if (!isNonEmpty(source.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(source.programRef)) errors.push("program_ref_required");
  if (!isNonEmpty(source.sourceKind)) errors.push("source_kind_required");
  if (!isNonEmpty(source.ownerRef)) errors.push("source_owner_required");
  if (!isNonEmpty(source.authorizationRef)) errors.push("authorization_ref_required");
  if (!isNonEmpty(source.secretRef)) errors.push("secret_ref_required");
  if (/token=|password=|secret=/i.test(source.secretRef)) {
    errors.push("secret_ref_looks_like_inline_credential");
  }
  if (!Number.isInteger(source.freshnessSlaMinutes) || source.freshnessSlaMinutes <= 0) {
    errors.push("freshness_sla_invalid");
  }
  if (!Number.isInteger(source.retentionDays) || source.retentionDays <= 0) {
    errors.push("retention_days_invalid");
  }
  return { valid: errors.length === 0, errors };
}

export function authorizeObservation(input: {
  program: EnterpriseObservationProgram;
  source: ObservationSource;
  now: string;
}): { allowed: boolean; reasons: string[] } {
  const reasons = [
    ...validateEnterpriseObservationProgram(input.program).errors,
    ...validateObservationSource(input.source).errors,
  ];
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) reasons.push("observation_time_invalid");
  if (input.program.status !== "active") reasons.push("program_not_active");
  if (input.source.status !== "active") reasons.push("source_not_active");
  if (input.source.workspaceRef !== input.program.workspaceRef) {
    reasons.push("workspace_mismatch");
  }
  if (input.source.programRef !== input.program.programId) reasons.push("program_mismatch");
  if (input.source.authorizationRef !== input.program.authorizationRef) {
    reasons.push("authorization_mismatch");
  }
  if (
    Number.isFinite(now) &&
    (now < Date.parse(input.program.startsAt) || now >= Date.parse(input.program.expiresAt))
  ) {
    reasons.push("outside_authorization_window");
  }
  return { allowed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function validateSourceObservationReceipt(
  receipt: SourceObservationReceipt,
): ContractValidation {
  const errors: string[] = [];
  if (!isFiniteDate(receipt.windowStart) || !isFiniteDate(receipt.windowEnd)) {
    errors.push("observation_window_invalid");
  } else if (Date.parse(receipt.windowStart) > Date.parse(receipt.windowEnd)) {
    errors.push("observation_window_reversed");
  }
  if (!isFiniteDate(receipt.observedAt)) errors.push("observed_at_invalid");
  if (
    receipt.completenessPercent !== null &&
    (receipt.completenessPercent < 0 || receipt.completenessPercent > 100)
  ) {
    errors.push("completeness_out_of_range");
  }
  if (receipt.outcome === "success" || receipt.outcome === "partial_success") {
    if (!isNonEmpty(receipt.summaryHash)) errors.push("summary_hash_required");
    if (uniqueNonEmpty(receipt.evidenceRefs).length === 0) {
      errors.push("evidence_ref_required");
    }
    if (receipt.completenessPercent === null) errors.push("completeness_required");
  }
  if (receipt.outcome === "failure" && receipt.errorCodes.length === 0) {
    errors.push("failure_error_code_required");
  }
  return { valid: errors.length === 0, errors };
}

export function validateEvidenceAnswerPacket(
  packet: EvidenceAnswerPacket,
): ContractValidation {
  const errors: string[] = [];
  const statements = [...packet.facts, ...packet.inferences];
  for (const statement of statements) {
    if (!isNonEmpty(statement.statement)) errors.push("statement_text_required");
    if (statement.evidenceRefs.length === 0) errors.push("statement_evidence_required");
  }
  if (packet.answer && packet.evidenceRefs.length === 0) {
    errors.push("answer_evidence_required");
  }
  if (!packet.answer && !isNonEmpty(packet.refusalReason)) {
    errors.push("refusal_reason_required");
  }
  if (packet.conflicts.some((conflict) => conflict.evidenceRefs.length < 2)) {
    errors.push("conflict_requires_multiple_evidence_refs");
  }
  if (
    (packet.freshness === "stale" || packet.freshness === "unknown") &&
    packet.confidence === "high"
  ) {
    errors.push("high_confidence_requires_fresh_evidence");
  }
  if ((packet.unknowns.length > 0 || packet.conflicts.length > 0) && !packet.reviewRequired) {
    errors.push("uncertainty_requires_review");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateOwnerCommandDraft(command: OwnerCommandDraft): ContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(command.decisionRef)) errors.push("decision_ref_required");
  if (!isNonEmpty(command.ownerRef)) errors.push("owner_ref_required");
  if (!isNonEmpty(command.executionTargetRef)) errors.push("execution_target_required");
  if (!isNonEmpty(command.goal)) errors.push("goal_required");
  if (!isNonEmpty(command.action)) errors.push("action_required");
  if (!isFiniteDate(command.dueAt)) errors.push("due_at_invalid");
  if (uniqueNonEmpty(command.acceptanceCriteria).length === 0) {
    errors.push("acceptance_criteria_required");
  }
  if (uniqueNonEmpty(command.evidenceRequirements).length === 0) {
    errors.push("evidence_requirement_required");
  }
  if (uniqueNonEmpty(command.invalidationConditions).length === 0) {
    errors.push("invalidation_condition_required");
  }
  if (!isNonEmpty(command.escalationOwnerRef)) errors.push("escalation_owner_required");
  if (command.status === "owner_confirmed" && command.ownerRef === command.executionTargetRef) {
    errors.push("confirmed_command_requires_explicit_execution_target");
  }
  return { valid: errors.length === 0, errors };
}

export type AutonomyAuthorizationResult = {
  authorized: boolean;
  reasons: string[];
  externalReceiptRequired: boolean;
};

export function authorizeAutonomousAction(input: {
  envelope: AutonomyPolicyEnvelope;
  request: AutonomousActionRequest;
}): AutonomyAuthorizationResult {
  const { envelope, request } = input;
  const reasons: string[] = [];
  const requestedAt = Date.parse(request.requestedAt);
  if (!envelope.runtimeActivationRef) reasons.push("private_runtime_activation_required");
  if (envelope.status !== "active") reasons.push("policy_not_active");
  if (!Number.isFinite(requestedAt)) reasons.push("requested_at_invalid");
  if (
    Number.isFinite(requestedAt) &&
    (requestedAt < Date.parse(envelope.validFrom) || requestedAt >= Date.parse(envelope.validUntil))
  ) {
    reasons.push("outside_policy_window");
  }
  if (request.workspaceRef !== envelope.workspaceRef) reasons.push("workspace_mismatch");
  if (request.actionCategory !== envelope.actionCategory) reasons.push("action_category_mismatch");
  if (!envelope.targetScopeRefs.includes(request.targetScopeRef)) {
    reasons.push("target_out_of_scope");
  }
  if (!envelope.allowedModelRefs.includes(request.modelRef)) reasons.push("model_not_allowed");
  if (!envelope.allowedToolRefs.includes(request.toolRef)) reasons.push("tool_not_allowed");
  if (request.channel && !envelope.allowedChannels.includes(request.channel)) {
    reasons.push("channel_not_allowed");
  }
  if (request.confidence < envelope.minimumConfidence) reasons.push("confidence_below_policy");
  if (request.amount !== null) {
    if (envelope.maximumAmount === null || request.amount > envelope.maximumAmount) {
      reasons.push("amount_exceeds_policy");
    }
    if (request.currency !== envelope.currency) reasons.push("currency_mismatch");
  }
  const activeStops = request.observedStopConditions.filter((condition) =>
    envelope.stopConditions.includes(condition),
  );
  if (activeStops.length > 0) reasons.push(...activeStops.map((value) => `stop:${value}`));
  if (!isNonEmpty(envelope.emergencyStopRef)) reasons.push("emergency_stop_ref_required");
  if (envelope.ownerApprovalRefs.length === 0) reasons.push("owner_approval_required");
  if (request.externalSideEffect && !envelope.requireExternalReceipt) {
    reasons.push("external_receipt_policy_required");
  }
  return {
    authorized: reasons.length === 0,
    reasons: [...new Set(reasons)],
    externalReceiptRequired: request.externalSideEffect,
  };
}

type DecisionProjectionInput = {
  decisionStatus: DecisionRecordStatus;
  ownerConfirmedAt: string | null;
  actionStatus: ActionStatus | null;
  actionExecutionStatus: string | null;
  approvalStatus: ApprovalStatus | null;
  receiptPresent: boolean;
  receiptVerified: boolean;
};

export function projectDecisionFollowThroughState(
  input: DecisionProjectionInput,
): DecisionFollowThroughState {
  if (input.decisionStatus === "superseded") return "SUPERSEDED";
  if (input.decisionStatus === "expired") return "EXPIRED";
  if (input.decisionStatus === "rejected") return "REJECTED";
  if (input.actionStatus === "BLOCKED") return "BLOCKED";
  if (input.actionStatus === "REJECTED" || input.approvalStatus === "REJECTED") {
    return "REJECTED";
  }
  if (input.receiptVerified) return "VERIFIED";
  if (input.receiptPresent) return "RECEIPT_SUBMITTED";
  if (input.actionExecutionStatus === "executing" || input.actionExecutionStatus === "in_progress") {
    return "IN_PROGRESS";
  }
  if (input.actionStatus) return "DISPATCHED";
  if (input.ownerConfirmedAt) return "OWNER_CONFIRMED";
  if (input.decisionStatus === "evidence_ready") return "EVIDENCE_READY";
  return "DRAFT";
}
