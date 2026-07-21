// ---------------------------------------------------------------------------
// Helm CAIO governance — public-safe contract types (contract-only slice).
//
// This module gives the CAIO role definition frozen in
// docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md a machine shape: a
// CaioMandate that a CEO explicitly issues, the policy envelopes scoped
// inside it, guardian emergency stops, structured human responses
// (refuse / pause / appeal), instruction-conflict records, and independent
// dual approvals.
//
// AUTHORITY FIREWALL (deliberate, load-bearing):
//   - Nothing in this file grants, transfers, or implies any system
//     permission, write access, or external side effect.
//   - `CaioMandate.authorityEffect` is the literal "none" and
//     `runtimeAuthorityRef` is the literal null. A mandate is a governance
//     record, never an authorization token; permission systems must not
//     consume it (see deriveRuntimeAuthority in contract.ts, which is
//     constant for every input).
//   - There are intentionally NO fields shaped like `canExecute`,
//     `allowedTools`, or `allowedActions`.
//   - The maturity stage axis below is a product-honesty axis, not a
//     permission enum, an automation level, or a runtime state machine. No
//     ordinal helpers are exported, and mapping stages onto
//     DecisionActionLevel / automation levels is forbidden by the ADR.
//
// Pure types only: no IO, no persistence, no runtime authority, no DB, no
// API, no server action.
// ---------------------------------------------------------------------------

// Capability maturity stages (display/honesty axis). Order in this array is
// documentation order, NOT an authorization ordering; do not index-compare.
export const CAIO_MATURITY_STAGES = [
  "observe",
  "advise",
  "supervise",
  "orchestrate",
  "authorized_execute",
] as const;

export type CaioCapabilityMaturityStage = (typeof CAIO_MATURITY_STAGES)[number];

// Evidence status a stage may carry in status statements.
export const CAIO_STAGE_EVIDENCE_STATUSES = [
  "formed",
  "next_layer",
  "roadmap_disabled",
] as const;

export type CaioStageEvidenceStatus =
  (typeof CAIO_STAGE_EVIDENCE_STATUSES)[number];

// The current frozen honesty statement per stage. orchestrate and
// authorized_execute are deliberately not built and disabled by default; a
// mandate instance may not carry them (fail-closed in contract.ts).
export const CAIO_STAGE_EVIDENCE: Readonly<
  Record<CaioCapabilityMaturityStage, CaioStageEvidenceStatus>
> = {
  observe: "formed",
  advise: "next_layer",
  supervise: "next_layer",
  orchestrate: "roadmap_disabled",
  authorized_execute: "roadmap_disabled",
};

// The only stages a mandate INSTANCE may carry. orchestrate and
// authorized_execute are roadmap_disabled and deliberately excluded at the
// type level: a well-typed mandate cannot express them. The runtime
// validator still fail-closes on forged values.
export const CAIO_MANDATE_STAGES = ["observe", "advise", "supervise"] as const;

export type CaioMandateStage = (typeof CAIO_MANDATE_STAGES)[number];

export const CAIO_MANDATE_STATUSES = [
  "draft",
  "active",
  "suspended",
  "revoked",
  "expired",
  "superseded",
] as const;

export type CaioMandateStatus = (typeof CAIO_MANDATE_STATUSES)[number];

// What happens to in-flight Work Packets when a mandate stops being active
// (revoked / suspended / emergency-stopped / expired). Continuing by default
// is deliberately not expressible.
export const CAIO_IN_FLIGHT_DISPOSITIONS = ["freeze", "handover"] as const;

export type CaioInFlightDisposition =
  (typeof CAIO_IN_FLIGHT_DISPOSITIONS)[number];

// Categories a mature-stage mandate could later dispatch to. In the current
// contract version the list on a mandate must be EMPTY (dispatch is not a
// formed capability); the enum exists so the shape is stable.
export const CAIO_DISPATCH_TARGET_CATEGORIES = ["person", "agent"] as const;

export type CaioDispatchTargetCategory =
  (typeof CAIO_DISPATCH_TARGET_CATEGORIES)[number];

// Explicit CEO issuance is the only grant basis a mandate may cite, in the
// strict structured form `caio-mandate-grant:<issuerRef>:<evidenceRef>`
// where issuerRef MUST equal the mandate's ceoRef and evidenceRef must be
// a non-empty OPAQUE token without ":" — so no scheme-prefixed ref (a
// legacy approval, another grant, any foreign evidence chain) can be
// smuggled into the evidence slot. Refs with any other scheme — in particular refs to
// pre-existing owner approvals such as historical capability-metadata
// registration approvals, even when wrapped behind the prefix — are
// rejected: authorization is never inherited, copied, or derived.
export const CAIO_MANDATE_GRANT_REF_PREFIX = "caio-mandate-grant:";

export type CaioMandate = {
  mandateId: string;
  workspaceRef: string;
  // Product role reference for the CAIO instance this mandate governs.
  caioRef: string;
  // The issuing CEO principal. Recorded explicitly; NEVER derived from a
  // workspace permission role (WorkspaceRole.OWNER is not a legal CEO
  // identity — CEO identity binding is a private-overlay concern).
  ceoRef: string;
  // Frozen reporting line. A reporting line is not an authority grant.
  reportsTo: "CEO";
  objectiveRefs: readonly string[];
  scopeRefs: readonly string[];
  // Every entry must carry CAIO_MANDATE_GRANT_REF_PREFIX (explicit CEO
  // issuance); legacy owner-approval refs are invalid here.
  grantBasisRefs: readonly string[];
  // Matters the CEO reserves entirely to humans.
  reservedMatterRefs: readonly string[];
  stage: CaioMandateStage;
  // Evidence for who decided the stage statement and when.
  stageDecisionRef: string;
  policyEnvelopeRefs: readonly string[];
  // Dispatch is not a formed capability: the type only admits the empty
  // tuple, so a well-typed mandate cannot express dispatch targets. The
  // runtime validator still fail-closes on forged values.
  dispatchTargetCategories: readonly [];
  // Governs structured refuse / pause / appeal handling for people.
  humanResponsePolicyRef: string;
  // Frozen conflict rule: CAIO vs human management instruction conflicts
  // pause the task and escalate only to the CEO.
  conflictResolution: "pause_and_escalate_ceo";
  // Where legal accountability stays anchored (CEO / COO / CIO / business
  // owners). At least one required: the CAIO transfers no legal duty.
  accountabilityAnchorRefs: readonly string[];
  // Guardian roles designated by the CEO. They can emergency-stop the CAIO
  // but can never resume it.
  guardianStopRefs: readonly string[];
  // Reference of a currently-triggered emergency stop, if any.
  emergencyStopRef: string | null;
  validFrom: string;
  validUntil: string;
  status: CaioMandateStatus;
  supersedesRef: string | null;
  auditRefs: readonly string[];
  // Frozen: any revocation / suspension / emergency stop invalidates the
  // mandate's envelopes immediately.
  revocationPolicy: "envelopes_invalid_immediately";
  inFlightDisposition: CaioInFlightDisposition;
  // Authority firewall literals (see file header).
  authorityEffect: "none";
  runtimeAuthorityRef: null;
};

export const CAIO_ENVELOPE_STATUSES = [
  "draft",
  "active",
  "revoked",
  "expired",
] as const;

export type CaioPolicyEnvelopeStatus = (typeof CAIO_ENVELOPE_STATUSES)[number];

// A CEO-issued pre-authorization envelope scoped inside a mandate. Also not
// an authorization token: consuming systems get their authority from the
// existing permission / policy chain, never from this object.
export type CaioPolicyEnvelope = {
  envelopeId: string;
  mandateRef: string;
  // Must equal the mandate's ceoRef (only the CEO grants envelopes).
  grantedByRef: string;
  // Must be a subset of the mandate's scopeRefs.
  scopeRefs: readonly string[];
  // Must lie within the mandate's validity window.
  validFrom: string;
  validUntil: string;
  status: CaioPolicyEnvelopeStatus;
  auditRefs: readonly string[];
  authorityEffect: "none";
};

export const CAIO_GUARDIAN_ACTIONS = ["stop"] as const;

// Guardians can only stop. Resumption is not a guardian action at all;
// resume authority belongs to the CEO alone (modeled on the stop record).
export type CaioGuardianAction = (typeof CAIO_GUARDIAN_ACTIONS)[number];

export type CaioGuardianStop = {
  stopId: string;
  mandateRef: string;
  // Must be one of the mandate's guardianStopRefs.
  guardianRef: string;
  action: CaioGuardianAction;
  triggeredAt: string;
  reason: string;
  // Set only when the CEO resumes; a guardian ref here is invalid.
  resumedByRef: string | null;
  resumedAt: string | null;
  auditRefs: readonly string[];
};

export const CAIO_HUMAN_RESPONSE_TYPES = ["refuse", "pause", "appeal"] as const;

export type CaioHumanResponseType = (typeof CAIO_HUMAN_RESPONSE_TYPES)[number];

export const CAIO_HUMAN_RESPONSE_STATUSES = [
  "raised",
  "acknowledged",
  "resolved",
  "escalated_to_ceo",
] as const;

export type CaioHumanResponseStatus =
  (typeof CAIO_HUMAN_RESPONSE_STATUSES)[number];

// A person's structured response to CAIO-dispatched work. Raising one is
// always legitimate; it must be auditable and must never feed retaliation.
export type CaioHumanResponse = {
  responseId: string;
  mandateRef: string;
  responderRef: string;
  responseType: CaioHumanResponseType;
  subjectWorkRef: string;
  reason: string;
  status: CaioHumanResponseStatus;
  auditRefs: readonly string[];
  // Frozen non-retaliation literal: the record itself declares that it may
  // not be used as negative-evaluation input.
  retaliationProhibited: true;
};

export const CAIO_CONFLICT_TASK_STATES = ["paused"] as const;

// A conflict between a CAIO instruction and a human management instruction.
// The only expressible task state is paused; the only escalation target is
// the CEO.
export type CaioConflictRecord = {
  conflictId: string;
  mandateRef: string;
  caioInstructionRef: string;
  humanInstructionRef: string;
  taskRef: string;
  taskState: (typeof CAIO_CONFLICT_TASK_STATES)[number];
  resolution: "pause_and_escalate_ceo";
  // Must equal the mandate's ceoRef.
  escalatedToRef: string;
  auditRefs: readonly string[];
};

// One approver in a dual approval. Independence is judged on CANONICAL
// identity, not display refs: two display aliases of one person, or two
// seat aliases of one role, never satisfy dual approval. The canonical
// refs must come from the identity system of record.
export type CaioApproval = {
  approvalId: string;
  // The decision this approval is bound to. All approvals of one dual
  // approval must share the same non-empty subjectRef — unrelated or
  // replayed approvals cannot be stitched together.
  subjectRef: string;
  principalRef: string;
  // Canonical identity behind principalRef in the identity system of
  // record; alias refs of one person share one canonicalPrincipalRef.
  canonicalPrincipalRef: string;
  roleRef: string;
  // Canonical role behind roleRef; seat aliases of one role share one
  // canonicalRoleRef.
  canonicalRoleRef: string;
  approvedAt: string;
  evidenceRef: string;
};

// Constant result shape of deriveRuntimeAuthority (contract.ts): the only
// thing a mandate can ever "grant" is nothing.
export type CaioRuntimeAuthorityProjection = {
  grantsPermission: false;
  reason: string;
};
