import { describe, expect, it } from "vitest";
import {
  authorizeAutonomousAction,
  authorizeObservation,
  projectDecisionFollowThroughState,
  validateAutonomyPolicyEnvelope,
  validateEvidenceAnswerPacket,
  validateEnterpriseObservationProgram,
  validateObservationSource,
  validateOwnerCommandDraft,
  validateSourceObservationReceipt,
} from "./contracts";
import type {
  AutonomousActionRequest,
  AutonomyPolicyEnvelope,
  EnterpriseObservationProgram,
  EvidenceAnswerPacket,
  ObservationSource,
  OwnerCommandDraft,
  SourceObservationReceipt,
} from "./types";

const program: EnterpriseObservationProgram = {
  programId: "program:synthetic",
  workspaceRef: "workspace:synthetic-enterprise",
  purpose: "Read-only operating diagnosis",
  scopeRefs: ["scope:operations"],
  dataCategories: ["crm", "documents"],
  startsAt: "2026-07-01T00:00:00.000Z",
  expiresAt: "2026-08-01T00:00:00.000Z",
  retentionDays: 30,
  authorizationRef: "authorization:owner-synthetic",
  status: "active",
  revokedAt: null,
  revokedByRef: null,
  revocationReason: null,
  auditRefs: ["audit:authorization-created"],
};

const source: ObservationSource = {
  sourceId: "source:crm",
  workspaceRef: program.workspaceRef,
  programRef: program.programId,
  sourceKind: "crm",
  accessMode: "read_only_api",
  ownerRef: "role:sales-operations",
  freshnessSlaMinutes: 60,
  sensitivity: "confidential",
  authorizationRef: program.authorizationRef,
  secretRef: "secret-ref:vault/synthetic/crm-reader",
  retentionDays: 30,
  status: "active",
};

describe("Stage 1 observation authorization", () => {
  it("allows a scoped read-only source inside an active owner authorization", () => {
    expect(validateEnterpriseObservationProgram(program)).toEqual({ valid: true, errors: [] });
    expect(validateObservationSource(source)).toEqual({ valid: true, errors: [] });
    expect(
      authorizeObservation({ program, source, now: "2026-07-18T00:00:00.000Z" }),
    ).toEqual({ allowed: true, reasons: [] });
  });

  it("stops new observation immediately after authorization revocation", () => {
    const revoked = {
      ...program,
      status: "revoked" as const,
      revokedAt: "2026-07-17T08:00:00.000Z",
      revokedByRef: "user:owner",
      revocationReason: "Owner withdrew access",
    };
    expect(
      authorizeObservation({ program: revoked, source, now: "2026-07-18T00:00:00.000Z" }),
    ).toEqual(expect.objectContaining({ allowed: false }));
  });

  it("rejects inline-looking credentials and mismatched authorization", () => {
    const unsafe = {
      ...source,
      authorizationRef: "authorization:other",
      secretRef: "token=raw-secret",
    };
    expect(validateObservationSource(unsafe).errors).toContain(
      "secret_ref_looks_like_inline_credential",
    );
    expect(
      authorizeObservation({ program, source: unsafe, now: "2026-07-18T00:00:00.000Z" })
        .reasons,
    ).toContain("authorization_mismatch");
  });

  it("fails closed on invalid enums and source retention beyond owner authorization", () => {
    expect(
      validateEnterpriseObservationProgram({
        ...program,
        status: "unexpected" as EnterpriseObservationProgram["status"],
      }).errors,
    ).toContain("program_status_invalid");
    expect(
      validateObservationSource({
        ...source,
        accessMode: "write_api" as ObservationSource["accessMode"],
      }).errors,
    ).toContain("access_mode_invalid");
    expect(
      authorizeObservation({
        program,
        source: { ...source, retentionDays: 31 },
        now: "2026-07-18T00:00:00.000Z",
      }),
    ).toEqual(
      expect.objectContaining({
        allowed: false,
        reasons: expect.arrayContaining(["retention_exceeds_authorization"]),
      }),
    );
  });
});

describe("Stage 1 evidence discipline", () => {
  const receipt: SourceObservationReceipt = {
    receiptId: "receipt:crm:1",
    workspaceRef: program.workspaceRef,
    sourceRef: source.sourceId,
    programRef: program.programId,
    windowStart: "2026-07-17T00:00:00.000Z",
    windowEnd: "2026-07-18T00:00:00.000Z",
    observedAt: "2026-07-18T00:05:00.000Z",
    summaryHash: "sha256:synthetic",
    completenessPercent: 100,
    freshness: "fresh",
    outcome: "success",
    evidenceRefs: ["evidence:crm:snapshot:1"],
    errorCodes: [],
  };

  it("requires a successful observation to carry evidence and completeness", () => {
    expect(validateSourceObservationReceipt(receipt)).toEqual({ valid: true, errors: [] });
    expect(
      validateSourceObservationReceipt({
        ...receipt,
        summaryHash: null,
        completenessPercent: null,
        evidenceRefs: [],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "summary_hash_required",
        "evidence_ref_required",
        "completeness_required",
      ]),
    );
  });

  it("requires traceable receipt references and non-blank statement evidence", () => {
    expect(
      validateSourceObservationReceipt({
        ...receipt,
        receiptId: "",
        workspaceRef: "",
        sourceRef: "",
        programRef: "",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "receipt_id_required",
        "workspace_ref_required",
        "source_ref_required",
        "program_ref_required",
      ]),
    );

    const blankEvidence: EvidenceAnswerPacket = {
      answerId: "answer:blank",
      workspaceRef: program.workspaceRef,
      questionRef: "question:blank",
      answer: "Unsupported",
      facts: [{ statement: "Claimed fact", evidenceRefs: ["  "], freshness: "fresh" }],
      inferences: [],
      unknowns: [],
      conflicts: [],
      evidenceRefs: [""],
      freshness: "fresh",
      confidence: "high",
      generatedAt: "2026-07-18T00:00:00.000Z",
      reviewRequired: false,
      refusalReason: null,
    };
    expect(validateEvidenceAnswerPacket(blankEvidence).errors).toEqual(
      expect.arrayContaining(["statement_evidence_required", "answer_evidence_required"]),
    );
  });

  it("refuses unsupported answers and downgrades stale or conflicting answers", () => {
    const unsupported: EvidenceAnswerPacket = {
      answerId: "answer:1",
      workspaceRef: program.workspaceRef,
      questionRef: "question:1",
      answer: "Revenue is increasing",
      facts: [],
      inferences: [],
      unknowns: [],
      conflicts: [],
      evidenceRefs: [],
      freshness: "unknown",
      confidence: "high",
      generatedAt: "2026-07-18T00:00:00.000Z",
      reviewRequired: false,
      refusalReason: null,
    };
    expect(validateEvidenceAnswerPacket(unsupported).errors).toEqual(
      expect.arrayContaining([
        "answer_evidence_required",
        "high_confidence_requires_fresh_evidence",
      ]),
    );

    const conflicted: EvidenceAnswerPacket = {
      ...unsupported,
      answer: "Two sources disagree",
      evidenceRefs: ["evidence:a", "evidence:b"],
      confidence: "low",
      reviewRequired: true,
      conflicts: [
        { description: "CRM and ledger disagree", evidenceRefs: ["evidence:a", "evidence:b"] },
      ],
    };
    expect(validateEvidenceAnswerPacket(conflicted)).toEqual({ valid: true, errors: [] });
  });
});

describe("Stage 1 owner command and state projection", () => {
  const command: OwnerCommandDraft = {
    commandId: "command:1",
    workspaceRef: program.workspaceRef,
    decisionRef: "decision:1",
    ownerRef: "user:owner",
    executionTargetRef: "role:operations",
    goal: "Resolve the synthetic delivery risk",
    action: "Review the blocked work and submit evidence",
    dueAt: "2026-07-20T00:00:00.000Z",
    acceptanceCriteria: ["Blocker is resolved"],
    evidenceRequirements: ["Evidence from the source system"],
    invalidationConditions: ["Underlying order is cancelled"],
    escalationOwnerRef: "user:owner",
    automationLevel: "assist",
    allowedToolRefs: ["tool:read-only-console"],
    externalSideEffects: [],
    policyEnvelopeRef: null,
    status: "owner_confirmed",
  };

  it("requires acceptance, evidence, invalidation and escalation fields", () => {
    expect(validateOwnerCommandDraft(command)).toEqual({ valid: true, errors: [] });
    expect(
      validateOwnerCommandDraft({
        ...command,
        acceptanceCriteria: [],
        evidenceRequirements: [],
        invalidationConditions: [],
        escalationOwnerRef: "",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "acceptance_criteria_required",
        "evidence_requirement_required",
        "invalidation_condition_required",
        "escalation_owner_required",
      ]),
    );
  });

  it("requires command identity and policy binding for declared external side effects", () => {
    expect(
      validateOwnerCommandDraft({
        ...command,
        commandId: "",
        workspaceRef: "",
        externalSideEffects: ["send_message"],
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "command_id_required",
        "workspace_ref_required",
        "external_side_effect_requires_policy_envelope",
      ]),
    );
    expect(
      validateOwnerCommandDraft({
        ...command,
        policyEnvelopeRef: "  ",
      }).errors,
    ).toContain("policy_envelope_ref_invalid");
    expect(
      validateOwnerCommandDraft({
        ...command,
        automationLevel: "active_candidate",
        externalSideEffects: ["send_message"],
        policyEnvelopeRef: "policy-envelope:1",
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("projects existing records without creating a second state machine", () => {
    expect(
      projectDecisionFollowThroughState({
        decisionStatus: "evidence_ready",
        ownerConfirmedAt: null,
        actionStatus: null,
        actionExecutionStatus: null,
        approvalStatus: null,
        receiptPresent: false,
        receiptVerified: false,
      }),
    ).toBe("EVIDENCE_READY");
    expect(
      projectDecisionFollowThroughState({
        decisionStatus: "owner_confirmed",
        ownerConfirmedAt: "2026-07-18T00:00:00.000Z",
        actionStatus: "EXECUTED",
        actionExecutionStatus: "executed",
        approvalStatus: "EXECUTED",
        receiptPresent: true,
        receiptVerified: true,
      }),
    ).toBe("VERIFIED");
    expect(
      projectDecisionFollowThroughState({
        decisionStatus: "owner_confirmed",
        ownerConfirmedAt: "2026-07-18T00:00:00.000Z",
        actionStatus: "BLOCKED",
        actionExecutionStatus: "blocked",
        approvalStatus: "EXECUTED",
        receiptPresent: true,
        receiptVerified: false,
      }),
    ).toBe("BLOCKED");
    expect(
      projectDecisionFollowThroughState({
        decisionStatus: "evaluated",
        ownerConfirmedAt: null,
        actionStatus: null,
        actionExecutionStatus: null,
        approvalStatus: null,
        receiptPresent: false,
        receiptVerified: false,
      }),
    ).toBe("EVALUATED");
    expect(
      projectDecisionFollowThroughState({
        decisionStatus: "owner_confirmed",
        ownerConfirmedAt: "2026-07-18T00:00:00.000Z",
        actionStatus: "EXECUTED",
        actionExecutionStatus: "executed",
        approvalStatus: "EXECUTED",
        receiptPresent: false,
        receiptVerified: false,
      }),
    ).toBe("INCONSISTENT");
  });
});

describe("Public autonomy boundary", () => {
  const envelope: AutonomyPolicyEnvelope = {
    envelopeId: "policy:1",
    workspaceRef: program.workspaceRef,
    actionCategory: "synthetic.low_risk_internal_update",
    targetScopeRefs: ["scope:synthetic-records"],
    maximumAmount: null,
    currency: null,
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
    allowedTimeWindows: ["00:00-23:59Z"],
    allowedChannels: ["internal"],
    allowedModelRefs: ["model:synthetic-reviewed"],
    allowedToolRefs: ["tool:synthetic-internal"],
    policyRefs: ["policy:synthetic-boundary"],
    minimumConfidence: 90,
    requireExternalReceipt: true,
    stopConditions: ["complaint", "identity_conflict", "model_drift"],
    emergencyStopRef: "kill-switch:synthetic",
    ownerApprovalRefs: ["approval:owner:1"],
    runtimeActivationRef: null,
    status: "active",
  };
  const request: AutonomousActionRequest = {
    workspaceRef: program.workspaceRef,
    actionCategory: envelope.actionCategory,
    targetScopeRef: "scope:synthetic-records",
    amount: null,
    currency: null,
    channel: "internal",
    modelRef: "model:synthetic-reviewed",
    toolRef: "tool:synthetic-internal",
    confidence: 95,
    requestedAt: "2026-07-18T00:00:00.000Z",
    observedStopConditions: [],
    externalSideEffect: true,
  };

  it("rejects malformed policy windows and enforces the declared local time window", () => {
    expect(
      validateAutonomyPolicyEnvelope({ ...envelope, validUntil: "not-a-date" }).errors,
    ).toContain("policy_window_invalid");
    expect(
      authorizeAutonomousAction({
        envelope: {
          ...envelope,
          runtimeActivationRef: "activation:private-control-plane",
          validUntil: "not-a-date",
        },
        request,
      }),
    ).toEqual(
      expect.objectContaining({
        authorized: false,
        reasons: expect.arrayContaining(["policy_window_invalid"]),
      }),
    );
    expect(
      authorizeAutonomousAction({
        envelope: {
          ...envelope,
          runtimeActivationRef: "activation:private-control-plane",
          allowedTimeWindows: ["09:00-10:00Z"],
        },
        request: { ...request, requestedAt: "2026-07-18T23:00:00.000Z" },
      }),
    ).toEqual(
      expect.objectContaining({
        authorized: false,
        reasons: expect.arrayContaining(["outside_allowed_time_window"]),
      }),
    );
  });

  it("supports explicit IANA-zone and overnight policy windows", () => {
    expect(
      authorizeAutonomousAction({
        envelope: {
          ...envelope,
          runtimeActivationRef: "activation:private-control-plane",
          allowedTimeWindows: ["22:00-06:00@Asia/Shanghai"],
        },
        request: { ...request, requestedAt: "2026-07-18T15:00:00.000Z" },
      }),
    ).toEqual({ authorized: true, reasons: [], externalReceiptRequired: true });
  });

  it("requires finite confidence plus amount and channel declarations", () => {
    const activated = {
      ...envelope,
      runtimeActivationRef: "activation:private-control-plane",
      maximumAmount: 100,
      currency: "CNY",
    };
    expect(
      authorizeAutonomousAction({ envelope: activated, request }).reasons,
    ).toEqual(expect.arrayContaining(["amount_declaration_required"]));
    expect(
      authorizeAutonomousAction({
        envelope: { ...envelope, runtimeActivationRef: "activation:private-control-plane" },
        request: { ...request, channel: null },
      }).reasons,
    ).toEqual(expect.arrayContaining(["channel_declaration_required"]));
    expect(
      authorizeAutonomousAction({
        envelope: { ...envelope, runtimeActivationRef: "activation:private-control-plane" },
        request: { ...request, confidence: Number.NaN },
      }).reasons,
    ).toEqual(expect.arrayContaining(["confidence_invalid"]));
  });

  it("treats every observed stop condition as fail-closed, including unknown ones", () => {
    expect(
      authorizeAutonomousAction({
        envelope: { ...envelope, runtimeActivationRef: "activation:private-control-plane" },
        request: { ...request, observedStopConditions: ["regulator_inquiry"] },
      }),
    ).toEqual(
      expect.objectContaining({
        authorized: false,
        reasons: ["stop:unrecognized:regulator_inquiry"],
      }),
    );
  });

  it("denies autonomy in Public without a private runtime activation reference", () => {
    expect(authorizeAutonomousAction({ envelope, request })).toEqual({
      authorized: false,
      reasons: ["private_runtime_activation_required"],
      externalReceiptRequired: true,
    });
  });

  it("fails closed on stop conditions even after private activation", () => {
    const activated = { ...envelope, runtimeActivationRef: "activation:private-control-plane" };
    expect(
      authorizeAutonomousAction({
        envelope: activated,
        request: { ...request, observedStopConditions: ["complaint"] },
      }),
    ).toEqual(
      expect.objectContaining({
        authorized: false,
        reasons: ["stop:complaint"],
      }),
    );
  });

  it("authorizes only a fully scoped request after private activation", () => {
    expect(
      authorizeAutonomousAction({
        envelope: { ...envelope, runtimeActivationRef: "activation:private-control-plane" },
        request,
      }),
    ).toEqual({ authorized: true, reasons: [], externalReceiptRequired: true });
  });
});
