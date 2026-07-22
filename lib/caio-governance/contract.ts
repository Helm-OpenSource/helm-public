import {
  CAIO_ENVELOPE_STATUSES,
  CAIO_HUMAN_RESPONSE_STATUSES,
  CAIO_HUMAN_RESPONSE_TYPES,
  CAIO_IN_FLIGHT_DISPOSITIONS,
  CAIO_MANDATE_GRANT_REF_PREFIX,
  CAIO_MANDATE_STAGES,
  CAIO_MANDATE_STATUSES,
  CAIO_MATURITY_STAGES,
  type CaioApproval,
  type CaioConflictRecord,
  type CaioGuardianStop,
  type CaioHumanResponse,
  type CaioMandate,
  type CaioPolicyEnvelope,
  type CaioRuntimeAuthorityProjection,
} from "@/lib/caio-governance/types";

// ---------------------------------------------------------------------------
// CAIO governance contract — pure, deterministic, fail-closed rules.
//
// These functions are invariant checkers over already-typed governance
// records (they are not unknown-input parsers): given objects of the
// declared types — including maliciously cast field values — they fail
// closed on every governance invariant. A mandate at a roadmap-disabled
// stage is invalid, a non-empty dispatch list is invalid, a grant basis
// that is not a structured explicit issuance by THIS mandate's CEO is
// invalid, timestamps must be strict RFC 3339 instants compared on the
// epoch (not string order), a CEO change suspends the old mandate, any
// mandate-validation error or non-active mandate or unresumed guardian
// stop kills its envelopes, a "resumed" stop only counts when the resume
// record is complete AND the resumer is the CEO, guardians can stop but
// never resume, refuse / pause / appeal are always legitimate, an
// instruction conflict can only pause and escalate to the CEO, and
// in-flight work can only freeze or hand over — never silently continue.
//
// projectEnvelopeValidity judges only what it is given: callers MUST pass
// the complete guardian-stop ledger for the mandate; a caller that omits
// stops defeats any pure function and is a storage-layer responsibility.
//
// AUTHORITY FIREWALL: deriveRuntimeAuthority is constant. No function in
// this module returns anything a permission system could consume as a
// grant; validation "valid" means the governance RECORD is well-formed,
// never that any action is authorized.
// ---------------------------------------------------------------------------

export type ContractValidation = {
  valid: boolean;
  errors: string[];
};

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// Strict RFC 3339 instant: date, time, and an explicit zone (Z or offset).
// Impossible calendar dates and out-of-range clock fields are rejected —
// Date.parse's silent normalization is not accepted.
const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseInstant(value: string): number | null {
  const match = INSTANT_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 60
  ) {
    return null;
  }
  const epoch = Date.parse(value);
  return Number.isNaN(epoch) ? null : epoch;
}

function allRefs(values: readonly string[]): boolean {
  return values.length > 0 && values.every((value) => hasRef(value));
}

// Arrays that may be empty, but whose entries must be real refs.
function refsWellFormed(values: readonly string[]): boolean {
  return values.every((value) => hasRef(value));
}

function validateWindow(
  from: string,
  until: string,
  errors: string[],
  label: string,
): void {
  const fromEpoch = parseInstant(from);
  const untilEpoch = parseInstant(until);
  if (fromEpoch === null || untilEpoch === null) {
    errors.push(`${label}_timestamp_invalid`);
    return;
  }
  if (fromEpoch >= untilEpoch) {
    errors.push(`${label}_window_invalid`);
  }
}

// The one and only answer to "what runtime authority does this mandate
// grant": none, for every input, including a forged active /
// authorized_execute mandate. Permission systems must not consume mandates;
// this projection exists so tests can pin that invariant.
export function deriveRuntimeAuthority(
  _mandate: CaioMandate,
): CaioRuntimeAuthorityProjection {
  return {
    grantsPermission: false,
    reason:
      "a CaioMandate is a governance record; runtime authority only ever comes from the existing permission / policy chain",
  };
}

// Structured grant basis: `caio-mandate-grant:<issuerRef>:<evidenceRef>`.
// By construction issuerRef is colon-free, so a mandate whose ceoRef
// contains ":" can never carry a valid grant basis — CEO principal refs
// must be plain colon-free identifiers.
// The issuer must be THIS mandate's CEO and the evidence must be non-empty;
// anything else — including legacy owner approvals wrapped behind the
// prefix — is not an explicit CEO issuance.
function validateGrantBasisRef(ref: string, ceoRef: string): string | null {
  if (!ref.startsWith(CAIO_MANDATE_GRANT_REF_PREFIX)) {
    return `grant_basis_not_explicit_ceo_issuance:${ref}`;
  }
  const body = ref.slice(CAIO_MANDATE_GRANT_REF_PREFIX.length);
  const separator = body.indexOf(":");
  if (separator === -1) {
    return `grant_basis_malformed:${ref}`;
  }
  const issuerRef = body.slice(0, separator);
  const evidenceRef = body.slice(separator + 1);
  if (!hasRef(issuerRef) || !hasRef(evidenceRef)) {
    return `grant_basis_malformed:${ref}`;
  }
  if (evidenceRef.includes(":")) {
    // Opaque evidence only: a scheme-prefixed ref here would let a legacy
    // owner approval (or any foreign chain) be wrapped into the evidence
    // slot.
    return `grant_basis_evidence_not_opaque:${ref}`;
  }
  if (issuerRef !== ceoRef) {
    return `grant_basis_issuer_is_not_this_ceo:${ref}`;
  }
  return null;
}

export function validateCaioMandate(mandate: CaioMandate): ContractValidation {
  const errors: string[] = [];

  for (const [field, value] of [
    ["mandateId", mandate.mandateId],
    ["workspaceRef", mandate.workspaceRef],
    ["caioRef", mandate.caioRef],
    ["ceoRef", mandate.ceoRef],
    ["stageDecisionRef", mandate.stageDecisionRef],
    ["humanResponsePolicyRef", mandate.humanResponsePolicyRef],
  ] as const) {
    if (!hasRef(value)) {
      errors.push(`${field}_missing`);
    }
  }

  if (mandate.reportsTo !== "CEO") {
    errors.push("reports_to_must_be_ceo");
  }
  if (mandate.conflictResolution !== "pause_and_escalate_ceo") {
    errors.push("conflict_resolution_must_pause_and_escalate_ceo");
  }
  if (mandate.authorityEffect !== "none") {
    errors.push("authority_effect_must_be_none");
  }
  if (mandate.runtimeAuthorityRef !== null) {
    errors.push("runtime_authority_ref_must_be_null");
  }
  if (mandate.revocationPolicy !== "envelopes_invalid_immediately") {
    errors.push("revocation_policy_must_invalidate_envelopes");
  }

  if (!CAIO_MANDATE_STATUSES.includes(mandate.status)) {
    errors.push("status_unknown");
  }
  const stage: string = mandate.stage;
  if (!(CAIO_MANDATE_STAGES as readonly string[]).includes(stage)) {
    // orchestrate / authorized_execute are roadmap items, deliberately not
    // built and disabled by default: unexpressible in the type, and forged
    // values fail closed here regardless of status.
    if ((CAIO_MATURITY_STAGES as readonly string[]).includes(stage)) {
      errors.push("stage_roadmap_disabled");
    } else {
      errors.push("stage_unknown");
    }
  }

  if (mandate.grantBasisRefs.length === 0) {
    errors.push("grant_basis_missing");
  }
  for (const ref of mandate.grantBasisRefs) {
    const error = validateGrantBasisRef(ref, mandate.ceoRef);
    if (error !== null) {
      errors.push(error);
    }
  }

  if (!allRefs(mandate.accountabilityAnchorRefs)) {
    errors.push("accountability_anchor_missing");
  }
  if (!allRefs(mandate.auditRefs)) {
    errors.push("audit_ref_missing");
  }
  for (const [field, values] of [
    ["objectiveRefs", mandate.objectiveRefs],
    ["scopeRefs", mandate.scopeRefs],
    ["reservedMatterRefs", mandate.reservedMatterRefs],
    ["guardianStopRefs", mandate.guardianStopRefs],
    ["policyEnvelopeRefs", mandate.policyEnvelopeRefs],
  ] as const) {
    if (!refsWellFormed(values)) {
      errors.push(`${field}_entries_invalid`);
    }
  }

  if (mandate.dispatchTargetCategories.length > 0) {
    // Dispatch is not a formed capability in this contract version.
    errors.push("dispatch_not_authorized_in_current_stage");
  }

  validateWindow(mandate.validFrom, mandate.validUntil, errors, "validity");

  if (!CAIO_IN_FLIGHT_DISPOSITIONS.includes(mandate.inFlightDisposition)) {
    errors.push("in_flight_disposition_unknown");
  }

  if (mandate.status === "active" && mandate.emergencyStopRef !== null) {
    // A triggered emergency stop and an active status cannot coexist.
    errors.push("active_mandate_with_emergency_stop");
  }

  return { valid: errors.length === 0, errors };
}

// At most one active mandate per workspace.
export function validateActiveMandateUniqueness(
  mandates: readonly CaioMandate[],
): ContractValidation {
  const errors: string[] = [];
  const activeByWorkspace = new Map<string, number>();
  for (const mandate of mandates) {
    if (mandate.status === "active") {
      activeByWorkspace.set(
        mandate.workspaceRef,
        (activeByWorkspace.get(mandate.workspaceRef) ?? 0) + 1,
      );
    }
  }
  for (const [workspaceRef, count] of activeByWorkspace) {
    if (count > 1) {
      errors.push(`multiple_active_mandates:${workspaceRef}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// A CEO change suspends the old CEO's active mandate; it never silently
// carries over to the successor (who must issue a fresh mandate).
export function projectMandateOnCeoChange(
  mandate: CaioMandate,
  currentCeoRef: string,
): CaioMandate {
  if (mandate.status === "active" && mandate.ceoRef !== currentCeoRef) {
    return { ...mandate, status: "suspended" };
  }
  return mandate;
}

export function validatePolicyEnvelope(
  envelope: CaioPolicyEnvelope,
  mandate: CaioMandate,
): ContractValidation {
  const errors: string[] = [];

  if (!hasRef(envelope.envelopeId)) {
    errors.push("envelope_id_missing");
  }
  if (!allRefs(envelope.scopeRefs)) {
    errors.push("envelope_scope_missing");
  }
  if (envelope.mandateRef !== mandate.mandateId) {
    errors.push("envelope_mandate_mismatch");
  }
  if (envelope.grantedByRef !== mandate.ceoRef) {
    errors.push("envelope_grantor_must_be_ceo");
  }
  if (envelope.authorityEffect !== "none") {
    errors.push("authority_effect_must_be_none");
  }
  if (!CAIO_ENVELOPE_STATUSES.includes(envelope.status)) {
    errors.push("envelope_status_unknown");
  }
  if (!allRefs(envelope.auditRefs)) {
    errors.push("audit_ref_missing");
  }
  const scopeSet = new Set(mandate.scopeRefs);
  for (const scope of envelope.scopeRefs) {
    if (!scopeSet.has(scope)) {
      errors.push(`envelope_scope_outside_mandate:${scope}`);
    }
  }
  validateWindow(envelope.validFrom, envelope.validUntil, errors, "validity");
  const envelopeFrom = parseInstant(envelope.validFrom);
  const envelopeUntil = parseInstant(envelope.validUntil);
  const mandateFrom = parseInstant(mandate.validFrom);
  const mandateUntil = parseInstant(mandate.validUntil);
  if (
    envelopeFrom !== null &&
    envelopeUntil !== null &&
    (mandateFrom === null ||
      mandateUntil === null ||
      envelopeFrom < mandateFrom ||
      envelopeUntil > mandateUntil)
  ) {
    errors.push("envelope_window_outside_mandate");
  }

  return { valid: errors.length === 0, errors };
}

// A stop only counts as resumed when the resume record is COMPLETE, the
// resumer is the mandate's CEO, and the stop record itself validates.
// Anything else — a guardian "resume", a partial record — leaves the stop
// in force.
function isEffectivelyResumed(
  stop: CaioGuardianStop,
  mandate: CaioMandate,
  atEpoch: number,
): boolean {
  if (stop.resumedAt === null || stop.resumedByRef !== mandate.ceoRef) {
    return false;
  }
  const resumedEpoch = parseInstant(stop.resumedAt);
  const triggeredEpoch = parseInstant(stop.triggeredAt);
  return (
    resumedEpoch !== null &&
    triggeredEpoch !== null &&
    resumedEpoch > triggeredEpoch &&
    resumedEpoch <= atEpoch &&
    validateGuardianStop(stop, mandate).valid
  );
}

// Is the envelope effective at the explicit instant `at`? Fails closed:
// only an active, in-window envelope on a VALID active mandate with no
// in-force guardian stop is effective. The caller supplies the clock so
// the projection stays deterministic.
export function projectEnvelopeValidity(
  envelope: CaioPolicyEnvelope,
  mandate: CaioMandate,
  stops: readonly CaioGuardianStop[],
  at: string,
): { effective: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const atEpoch = parseInstant(at);
  if (atEpoch === null) {
    reasons.push("evaluation_instant_invalid");
  }

  const mandateValidation = validateCaioMandate(mandate);
  if (!mandateValidation.valid) {
    // An invalid mandate can never carry an effective envelope.
    reasons.push(...mandateValidation.errors.map((error) => `mandate_${error}`));
  }

  if (envelope.status !== "active") {
    reasons.push(`envelope_status_${envelope.status}`);
  }
  if (mandate.status !== "active") {
    // revoked / suspended / expired / superseded / draft all invalidate the
    // envelope immediately (revocationPolicy).
    reasons.push(`mandate_status_${mandate.status}`);
  }
  if (mandate.emergencyStopRef !== null) {
    reasons.push("mandate_emergency_stopped");
  }
  for (const stop of stops) {
    if (
      stop.mandateRef === mandate.mandateId &&
      (atEpoch === null || !isEffectivelyResumed(stop, mandate, atEpoch))
    ) {
      reasons.push(`in_force_guardian_stop:${stop.stopId}`);
    }
  }

  const envelopeValidation = validatePolicyEnvelope(envelope, mandate);
  if (!envelopeValidation.valid) {
    reasons.push(...envelopeValidation.errors);
  }

  if (atEpoch !== null) {
    const from = parseInstant(envelope.validFrom);
    const until = parseInstant(envelope.validUntil);
    if (from !== null && atEpoch < from) {
      reasons.push("envelope_not_yet_valid");
    }
    if (until !== null && atEpoch >= until) {
      reasons.push("envelope_expired");
    }
  }

  return { effective: reasons.length === 0, reasons };
}

// Guardians stop; only the CEO resumes.
export function validateGuardianStop(
  stop: CaioGuardianStop,
  mandate: CaioMandate,
): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(stop.stopId)) {
    errors.push("stop_id_missing");
  }
  if (stop.mandateRef !== mandate.mandateId) {
    errors.push("stop_mandate_mismatch");
  }
  if (stop.action !== "stop") {
    errors.push("guardian_action_unknown");
  }
  if (!mandate.guardianStopRefs.includes(stop.guardianRef)) {
    errors.push("guardian_not_designated");
  }
  if (!hasRef(stop.reason)) {
    errors.push("stop_reason_missing");
  }
  const triggeredEpoch = parseInstant(stop.triggeredAt);
  if (triggeredEpoch === null) {
    errors.push("triggered_at_invalid");
  }
  if (!allRefs(stop.auditRefs)) {
    errors.push("audit_ref_missing");
  }
  if (stop.resumedByRef !== null || stop.resumedAt !== null) {
    if (stop.resumedByRef === null || stop.resumedAt === null) {
      errors.push("resume_record_incomplete");
    } else {
      if (stop.resumedByRef !== mandate.ceoRef) {
        // A guardian (or anyone but the CEO) can never resume.
        errors.push("resume_authority_is_ceo_only");
      }
      const resumedEpoch = parseInstant(stop.resumedAt);
      if (resumedEpoch === null) {
        errors.push("resumed_at_invalid");
      } else if (triggeredEpoch !== null && resumedEpoch <= triggeredEpoch) {
        errors.push("resume_before_trigger");
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

// Refuse / pause / appeal are always legitimate. Validation only checks
// auditability, linkage, and the non-retaliation literal; it can never rule
// the response itself out of order.
export function validateHumanResponse(
  response: CaioHumanResponse,
): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(response.responseId)) {
    errors.push("response_id_missing");
  }
  if (!hasRef(response.responderRef)) {
    errors.push("responder_missing");
  }
  if (!hasRef(response.mandateRef)) {
    errors.push("mandate_ref_missing");
  }
  if (!CAIO_HUMAN_RESPONSE_TYPES.includes(response.responseType)) {
    errors.push("response_type_unknown");
  }
  if (!CAIO_HUMAN_RESPONSE_STATUSES.includes(response.status)) {
    errors.push("response_status_unknown");
  }
  if (!hasRef(response.subjectWorkRef)) {
    errors.push("subject_work_missing");
  }
  if (!hasRef(response.reason)) {
    errors.push("reason_missing");
  }
  if (response.auditRefs.length === 0 || !response.auditRefs.every(hasRef)) {
    errors.push("audit_ref_missing");
  }
  if (response.retaliationProhibited !== true) {
    errors.push("retaliation_prohibition_missing");
  }
  return { valid: errors.length === 0, errors };
}

// A CAIO/human instruction conflict pauses the task and escalates only to
// the CEO — no other resolution or escalation target is expressible.
export function validateConflictRecord(
  conflict: CaioConflictRecord,
  mandate: CaioMandate,
): ContractValidation {
  const errors: string[] = [];
  if (conflict.mandateRef !== mandate.mandateId) {
    errors.push("conflict_mandate_mismatch");
  }
  if (conflict.taskState !== "paused") {
    errors.push("conflicted_task_must_pause");
  }
  if (conflict.resolution !== "pause_and_escalate_ceo") {
    errors.push("conflict_resolution_must_pause_and_escalate_ceo");
  }
  if (conflict.escalatedToRef !== mandate.ceoRef) {
    errors.push("escalation_target_is_ceo_only");
  }
  if (
    !hasRef(conflict.caioInstructionRef) ||
    !hasRef(conflict.humanInstructionRef)
  ) {
    errors.push("conflicting_instruction_refs_missing");
  }
  if (!hasRef(conflict.conflictId)) {
    errors.push("conflict_id_missing");
  }
  if (!hasRef(conflict.taskRef)) {
    // a "paused" record must point at the task it paused
    errors.push("task_ref_missing");
  }
  if (!allRefs(conflict.auditRefs)) {
    errors.push("audit_ref_missing");
  }
  return { valid: errors.length === 0, errors };
}

// Dual approval requires two approvals from mutually independent CANONICAL
// principals AND canonical roles: display aliases of one person, or seat
// aliases of one role, never satisfy it.
export function validateDualApproval(
  approvals: readonly CaioApproval[],
): ContractValidation {
  const errors: string[] = [];
  if (approvals.length < 2) {
    errors.push("dual_approval_requires_two_approvals");
    return { valid: false, errors };
  }
  const approvalIds = new Set<string>();
  const subjects = new Set<string>();
  for (const approval of approvals) {
    if (!hasRef(approval.approvalId) || approvalIds.has(approval.approvalId)) {
      errors.push(`approval_id_missing_or_duplicate:${approval.approvalId}`);
    }
    approvalIds.add(approval.approvalId);
    if (!hasRef(approval.subjectRef)) {
      errors.push(`approval_subject_missing:${approval.approvalId}`);
    } else {
      subjects.add(approval.subjectRef);
    }
    if (!hasRef(approval.principalRef) || !hasRef(approval.roleRef)) {
      errors.push(`display_identity_missing:${approval.approvalId}`);
    }
    if (
      !hasRef(approval.canonicalPrincipalRef) ||
      !hasRef(approval.canonicalRoleRef)
    ) {
      errors.push(`canonical_identity_missing:${approval.approvalId}`);
    }
    if (!hasRef(approval.evidenceRef)) {
      errors.push(`approval_evidence_missing:${approval.approvalId}`);
    }
    if (parseInstant(approval.approvedAt) === null) {
      errors.push(`approved_at_invalid:${approval.approvalId}`);
    }
  }
  if (subjects.size > 1) {
    // approvals for different decisions cannot be stitched together
    errors.push("approvals_must_share_one_subject");
  }
  const canonicalPrincipals = new Set(
    approvals.map((approval) => approval.canonicalPrincipalRef),
  );
  const canonicalRoles = new Set(
    approvals.map((approval) => approval.canonicalRoleRef),
  );
  if (canonicalPrincipals.size < 2) {
    errors.push("approvers_must_be_distinct_principals");
  }
  if (canonicalRoles.size < 2) {
    errors.push("approvers_must_hold_independent_roles");
  }
  return { valid: errors.length === 0, errors };
}
