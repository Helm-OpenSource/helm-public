import type { ActionStatus, ApprovalStatus } from "@prisma/client";
import {
  AUTONOMY_POLICY_STATUSES,
  EVIDENCE_FRESHNESS_STATES,
  OBSERVATION_ACCESS_MODES,
  OBSERVATION_OUTCOMES,
  OBSERVATION_PROGRAM_STATUSES,
  OBSERVATION_SENSITIVITY_LEVELS,
  OBSERVATION_SOURCE_STATUSES,
  OWNER_COMMAND_STATUSES,
  WORK_PACKET_AUTOMATION_LEVELS,
  type AutonomousActionRequest,
  type AutonomyPolicyEnvelope,
  type DecisionFollowThroughState,
  type DecisionRecordStatus,
  type EnterpriseObservationProgram,
  type EvidenceAnswerPacket,
  type ObservationSource,
  type OwnerCommandDraft,
  type SourceObservationReceipt,
} from "./types";

export type ContractValidation = {
  valid: boolean;
  errors: string[];
};

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function uniqueNonEmpty(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

type ParsedAllowedTimeWindow = {
  startMinute: number;
  endMinute: number;
  timeZone: string;
};

function parseAllowedTimeWindow(value: unknown): ParsedAllowedTimeWindow | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})(Z|@[A-Za-z0-9_.+\-]+(?:\/[A-Za-z0-9_.+\-]+)+)$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [, startHourRaw, startMinuteRaw, endHourRaw, endMinuteRaw, zoneRaw] = match;
  const startHour = Number(startHourRaw);
  const startMinute = Number(startMinuteRaw);
  const endHour = Number(endHourRaw);
  const endMinute = Number(endMinuteRaw);
  if (
    startHour > 23 ||
    endHour > 24 ||
    startMinute > 59 ||
    endMinute > 59 ||
    (endHour === 24 && endMinute !== 0)
  ) {
    return null;
  }
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return null;
  const timeZone = zoneRaw === "Z" ? "UTC" : zoneRaw.slice(1);
  if (timeZone !== "UTC") {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date(0));
    } catch {
      return null;
    }
  }
  return { startMinute: start, endMinute: end, timeZone };
}

function minuteOfDay(date: Date, timeZone: string): number | null {
  if (!Number.isFinite(date.getTime())) return null;
  if (timeZone === "UTC") return date.getUTCHours() * 60 + date.getUTCMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return (hour % 24) * 60 + minute;
  } catch {
    return null;
  }
}

function isInsideAllowedTimeWindow(date: Date, window: ParsedAllowedTimeWindow): boolean {
  const current = minuteOfDay(date, window.timeZone);
  if (current === null) return false;
  if (window.endMinute > window.startMinute) {
    return current >= window.startMinute && current < window.endMinute;
  }
  return current >= window.startMinute || current < window.endMinute;
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
  if (!isOneOf(program.status, OBSERVATION_PROGRAM_STATUSES)) {
    errors.push("program_status_invalid");
  }
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
  if (!isOneOf(source.accessMode, OBSERVATION_ACCESS_MODES)) {
    errors.push("access_mode_invalid");
  }
  if (!isOneOf(source.sensitivity, OBSERVATION_SENSITIVITY_LEVELS)) {
    errors.push("sensitivity_invalid");
  }
  if (!isOneOf(source.status, OBSERVATION_SOURCE_STATUSES)) {
    errors.push("source_status_invalid");
  }
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
  if (input.source.retentionDays > input.program.retentionDays) {
    reasons.push("retention_exceeds_authorization");
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
  if (!isNonEmpty(receipt.receiptId)) errors.push("receipt_id_required");
  if (!isNonEmpty(receipt.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(receipt.sourceRef)) errors.push("source_ref_required");
  if (!isNonEmpty(receipt.programRef)) errors.push("program_ref_required");
  if (!isOneOf(receipt.freshness, EVIDENCE_FRESHNESS_STATES)) {
    errors.push("freshness_invalid");
  }
  if (!isOneOf(receipt.outcome, OBSERVATION_OUTCOMES)) {
    errors.push("outcome_invalid");
  }
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
  if (!isOneOf(packet.freshness, EVIDENCE_FRESHNESS_STATES)) {
    errors.push("freshness_invalid");
  }
  if (!isOneOf(packet.confidence, ["low", "medium", "high"] as const)) {
    errors.push("confidence_invalid");
  }
  for (const statement of statements) {
    if (!isNonEmpty(statement.statement)) errors.push("statement_text_required");
    if (uniqueNonEmpty(statement.evidenceRefs).length === 0) {
      errors.push("statement_evidence_required");
    }
  }
  if (packet.answer && uniqueNonEmpty(packet.evidenceRefs).length === 0) {
    errors.push("answer_evidence_required");
  }
  if (!packet.answer && !isNonEmpty(packet.refusalReason)) {
    errors.push("refusal_reason_required");
  }
  if (packet.conflicts.some((conflict) => uniqueNonEmpty(conflict.evidenceRefs).length < 2)) {
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
  if (!isNonEmpty(command.commandId)) errors.push("command_id_required");
  if (!isNonEmpty(command.workspaceRef)) errors.push("workspace_ref_required");
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
  if (!isOneOf(command.automationLevel, WORK_PACKET_AUTOMATION_LEVELS)) {
    errors.push("automation_level_invalid");
  }
  if (!isOneOf(command.status, OWNER_COMMAND_STATUSES)) {
    errors.push("command_status_invalid");
  }
  if (
    command.policyEnvelopeRef !== null &&
    !isNonEmpty(command.policyEnvelopeRef)
  ) {
    errors.push("policy_envelope_ref_invalid");
  }
  if (
    uniqueNonEmpty(command.externalSideEffects).length > 0 &&
    !isNonEmpty(command.policyEnvelopeRef)
  ) {
    errors.push("external_side_effect_requires_policy_envelope");
  }
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

export function validateAutonomyPolicyEnvelope(
  envelope: AutonomyPolicyEnvelope,
): ContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(envelope.envelopeId)) errors.push("envelope_id_required");
  if (!isNonEmpty(envelope.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(envelope.actionCategory)) errors.push("action_category_required");
  if (uniqueNonEmpty(envelope.targetScopeRefs).length === 0) {
    errors.push("target_scope_required");
  }
  if (uniqueNonEmpty(envelope.allowedModelRefs).length === 0) {
    errors.push("allowed_model_required");
  }
  if (uniqueNonEmpty(envelope.allowedToolRefs).length === 0) {
    errors.push("allowed_tool_required");
  }
  if (uniqueNonEmpty(envelope.policyRefs).length === 0) {
    errors.push("policy_ref_required");
  }
  if (!isFiniteDate(envelope.validFrom) || !isFiniteDate(envelope.validUntil)) {
    errors.push("policy_window_invalid");
  } else if (Date.parse(envelope.validFrom) >= Date.parse(envelope.validUntil)) {
    errors.push("policy_window_empty");
  }
  const parsedWindows = uniqueNonEmpty(envelope.allowedTimeWindows).map(
    parseAllowedTimeWindow,
  );
  if (parsedWindows.length === 0) errors.push("allowed_time_window_required");
  if (parsedWindows.some((window) => window === null)) {
    errors.push("allowed_time_window_invalid");
  }
  if (
    !Number.isFinite(envelope.minimumConfidence) ||
    envelope.minimumConfidence < 0 ||
    envelope.minimumConfidence > 100
  ) {
    errors.push("minimum_confidence_invalid");
  }
  if (
    envelope.maximumAmount !== null &&
    (!Number.isFinite(envelope.maximumAmount) || envelope.maximumAmount < 0)
  ) {
    errors.push("maximum_amount_invalid");
  }
  if (envelope.maximumAmount !== null && !isNonEmpty(envelope.currency)) {
    errors.push("policy_currency_required");
  }
  if (envelope.maximumAmount === null && envelope.currency !== null) {
    errors.push("currency_without_amount_limit");
  }
  if (!isNonEmpty(envelope.emergencyStopRef)) errors.push("emergency_stop_ref_required");
  if (uniqueNonEmpty(envelope.ownerApprovalRefs).length === 0) {
    errors.push("owner_approval_required");
  }
  if (
    envelope.runtimeActivationRef !== null &&
    !isNonEmpty(envelope.runtimeActivationRef)
  ) {
    errors.push("runtime_activation_ref_invalid");
  }
  if (!isOneOf(envelope.status, AUTONOMY_POLICY_STATUSES)) {
    errors.push("policy_status_invalid");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateAutonomousActionRequest(
  request: AutonomousActionRequest,
): ContractValidation {
  const errors: string[] = [];
  if (!isNonEmpty(request.workspaceRef)) errors.push("workspace_ref_required");
  if (!isNonEmpty(request.actionCategory)) errors.push("action_category_required");
  if (!isNonEmpty(request.targetScopeRef)) errors.push("target_scope_required");
  if (!isNonEmpty(request.modelRef)) errors.push("model_ref_required");
  if (!isNonEmpty(request.toolRef)) errors.push("tool_ref_required");
  if (!isFiniteDate(request.requestedAt)) errors.push("requested_at_invalid");
  if (
    !Number.isFinite(request.confidence) ||
    request.confidence < 0 ||
    request.confidence > 100
  ) {
    errors.push("confidence_invalid");
  }
  if (
    request.amount !== null &&
    (!Number.isFinite(request.amount) || request.amount < 0)
  ) {
    errors.push("amount_invalid");
  }
  if (request.amount !== null && !isNonEmpty(request.currency)) {
    errors.push("currency_declaration_required");
  }
  if (request.channel !== null && !isNonEmpty(request.channel)) {
    errors.push("channel_invalid");
  }
  if (uniqueNonEmpty(request.observedStopConditions).length !== request.observedStopConditions.length) {
    errors.push("stop_condition_invalid");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function authorizeAutonomousAction(input: {
  envelope: AutonomyPolicyEnvelope;
  request: AutonomousActionRequest;
}): AutonomyAuthorizationResult {
  const { envelope, request } = input;
  const envelopeValidation = validateAutonomyPolicyEnvelope(envelope);
  const requestValidation = validateAutonomousActionRequest(request);
  const reasons: string[] = [
    ...envelopeValidation.errors,
    ...requestValidation.errors,
  ];
  const requestedAt = Date.parse(request.requestedAt);
  if (!isNonEmpty(envelope.runtimeActivationRef)) {
    reasons.push("private_runtime_activation_required");
  }
  if (envelope.status !== "active") reasons.push("policy_not_active");
  if (
    isFiniteDate(envelope.validFrom) &&
    isFiniteDate(envelope.validUntil) &&
    Number.isFinite(requestedAt) &&
    (requestedAt < Date.parse(envelope.validFrom) || requestedAt >= Date.parse(envelope.validUntil))
  ) {
    reasons.push("outside_policy_window");
  }
  const parsedWindows = uniqueNonEmpty(envelope.allowedTimeWindows)
    .map(parseAllowedTimeWindow)
    .filter((window): window is ParsedAllowedTimeWindow => window !== null);
  if (
    Number.isFinite(requestedAt) &&
    parsedWindows.length === uniqueNonEmpty(envelope.allowedTimeWindows).length &&
    !parsedWindows.some((window) => isInsideAllowedTimeWindow(new Date(requestedAt), window))
  ) {
    reasons.push("outside_allowed_time_window");
  }
  if (request.workspaceRef !== envelope.workspaceRef) reasons.push("workspace_mismatch");
  if (request.actionCategory !== envelope.actionCategory) reasons.push("action_category_mismatch");
  if (!envelope.targetScopeRefs.includes(request.targetScopeRef)) {
    reasons.push("target_out_of_scope");
  }
  if (!envelope.allowedModelRefs.includes(request.modelRef)) reasons.push("model_not_allowed");
  if (!envelope.allowedToolRefs.includes(request.toolRef)) reasons.push("tool_not_allowed");
  if (
    (request.externalSideEffect || envelope.allowedChannels.length > 0) &&
    !isNonEmpty(request.channel)
  ) {
    reasons.push("channel_declaration_required");
  }
  if (isNonEmpty(request.channel) && !envelope.allowedChannels.includes(request.channel)) {
    reasons.push("channel_not_allowed");
  }
  if (
    Number.isFinite(request.confidence) &&
    Number.isFinite(envelope.minimumConfidence) &&
    request.confidence < envelope.minimumConfidence
  ) {
    reasons.push("confidence_below_policy");
  }
  if (envelope.maximumAmount !== null && request.amount === null) {
    reasons.push("amount_declaration_required");
  }
  if (request.amount !== null && Number.isFinite(request.amount)) {
    if (
      envelope.maximumAmount === null ||
      (Number.isFinite(envelope.maximumAmount) && request.amount > envelope.maximumAmount)
    ) {
      reasons.push("amount_exceeds_policy");
    }
    if (request.currency !== envelope.currency) reasons.push("currency_mismatch");
  }
  for (const condition of uniqueNonEmpty(request.observedStopConditions)) {
    reasons.push(
      envelope.stopConditions.includes(condition)
        ? `stop:${condition}`
        : `stop:unrecognized:${condition}`,
    );
  }
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
  if (input.decisionStatus === "evaluated") return "EVALUATED";
  if (input.receiptVerified && !input.receiptPresent) return "INCONSISTENT";
  if (input.actionStatus === "BLOCKED") return "BLOCKED";
  if (input.actionStatus === "REJECTED" || input.approvalStatus === "REJECTED") {
    return "REJECTED";
  }
  if (input.receiptVerified) return "VERIFIED";
  if (input.receiptPresent) return "RECEIPT_SUBMITTED";
  if (input.actionStatus === "EXECUTED" || input.actionExecutionStatus === "executed") {
    return "INCONSISTENT";
  }
  if (input.actionExecutionStatus === "executing" || input.actionExecutionStatus === "in_progress") {
    return "IN_PROGRESS";
  }
  if (input.actionStatus) return "DISPATCHED";
  if (input.ownerConfirmedAt) return "OWNER_CONFIRMED";
  if (input.decisionStatus === "evidence_ready") return "EVIDENCE_READY";
  return "DRAFT";
}
