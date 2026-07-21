import { describe, expect, it } from "vitest";

import {
  deriveRuntimeAuthority,
  parseInstant,
  projectEnvelopeValidity,
  projectMandateOnCeoChange,
  validateActiveMandateUniqueness,
  validateCaioMandate,
  validateConflictRecord,
  validateDualApproval,
  validateGuardianStop,
  validateHumanResponse,
  validatePolicyEnvelope,
} from "@/lib/caio-governance/contract";
import {
  CAIO_STAGE_EVIDENCE,
  type CaioApproval,
  type CaioConflictRecord,
  type CaioGuardianStop,
  type CaioHumanResponse,
  type CaioMandate,
  type CaioMandateStage,
  type CaioPolicyEnvelope,
} from "@/lib/caio-governance/types";

const NOW = "2026-08-15T00:00:00Z";

function makeMandate(overrides: Partial<CaioMandate> = {}): CaioMandate {
  return {
    mandateId: "mandate-1",
    workspaceRef: "workspace-1",
    caioRef: "caio-1",
    ceoRef: "ceo-1",
    reportsTo: "CEO",
    objectiveRefs: ["objective-1"],
    scopeRefs: ["scope-a", "scope-b"],
    grantBasisRefs: ["caio-mandate-grant:ceo-1:issuance-2026-07-22"],
    reservedMatterRefs: ["reserved-legal"],
    stage: "observe",
    stageDecisionRef: "stage-decision-1",
    policyEnvelopeRefs: [],
    dispatchTargetCategories: [],
    humanResponsePolicyRef: "human-response-policy-1",
    conflictResolution: "pause_and_escalate_ceo",
    accountabilityAnchorRefs: ["anchor-ceo"],
    guardianStopRefs: ["guardian-1"],
    emergencyStopRef: null,
    validFrom: "2026-07-01T00:00:00Z",
    validUntil: "2026-12-31T00:00:00Z",
    status: "active",
    supersedesRef: null,
    auditRefs: ["audit-1"],
    revocationPolicy: "envelopes_invalid_immediately",
    inFlightDisposition: "freeze",
    authorityEffect: "none",
    runtimeAuthorityRef: null,
    ...overrides,
  };
}

function makeEnvelope(
  overrides: Partial<CaioPolicyEnvelope> = {},
): CaioPolicyEnvelope {
  return {
    envelopeId: "envelope-1",
    mandateRef: "mandate-1",
    grantedByRef: "ceo-1",
    scopeRefs: ["scope-a"],
    validFrom: "2026-08-01T00:00:00Z",
    validUntil: "2026-09-01T00:00:00Z",
    status: "active",
    auditRefs: ["audit-envelope-1"],
    authorityEffect: "none",
    ...overrides,
  };
}

function makeStop(overrides: Partial<CaioGuardianStop> = {}): CaioGuardianStop {
  return {
    stopId: "stop-1",
    mandateRef: "mandate-1",
    guardianRef: "guardian-1",
    action: "stop",
    triggeredAt: "2026-08-02T00:00:00Z",
    reason: "anomalous dispatch pattern",
    resumedByRef: null,
    resumedAt: null,
    auditRefs: ["audit-stop-1"],
    ...overrides,
  };
}

describe("parseInstant", () => {
  it("accepts strict RFC 3339 instants and rejects everything else", () => {
    expect(parseInstant("2026-08-15T00:00:00Z")).not.toBeNull();
    expect(parseInstant("2026-08-15T08:00:00+08:00")).not.toBeNull();
    for (const bad of [
      "aaa",
      "2026-08-15",
      "2026-08-15T00:00:00",
      "",
      // impossible calendar / clock values must not be silently normalized
      "2026-02-30T00:00:00Z",
      "2026-08-15T24:00:00Z",
      "2026-13-01T00:00:00Z",
    ]) {
      expect(parseInstant(bad), bad).toBeNull();
    }
  });
});

describe("validateCaioMandate", () => {
  it("accepts a well-formed observe-stage mandate", () => {
    expect(validateCaioMandate(makeMandate())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects forged roadmap stages regardless of status", () => {
    for (const stage of ["orchestrate", "authorized_execute"]) {
      for (const status of ["draft", "active"] as const) {
        const result = validateCaioMandate(
          makeMandate({ stage: stage as CaioMandateStage, status }),
        );
        expect(result.valid, `${stage}/${status}`).toBe(false);
        expect(result.errors).toContain("stage_roadmap_disabled");
      }
    }
    expect(CAIO_STAGE_EVIDENCE.orchestrate).toBe("roadmap_disabled");
    expect(CAIO_STAGE_EVIDENCE.authorized_execute).toBe("roadmap_disabled");
    expect(
      validateCaioMandate(
        makeMandate({ stage: "world_domination" as CaioMandateStage }),
      ).errors,
    ).toContain("stage_unknown");
  });

  it("rejects any forged dispatch target", () => {
    const result = validateCaioMandate(
      makeMandate({
        dispatchTargetCategories: ["person"] as unknown as readonly [],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("dispatch_not_authorized_in_current_stage");
  });

  it("rejects grant bases that are not explicit issuances by THIS CEO", () => {
    const cases: ReadonlyArray<[string, string]> = [
      [
        "legacy-owner-approval:metadata-registration-2026",
        "grant_basis_not_explicit_ceo_issuance:legacy-owner-approval:metadata-registration-2026",
      ],
      // wrapped legacy approval: prefix present but issuer is not the CEO
      [
        "caio-mandate-grant:legacy-owner-approval:metadata-registration-2026",
        "grant_basis_issuer_is_not_this_ceo:caio-mandate-grant:legacy-owner-approval:metadata-registration-2026",
      ],
      // wrapped legacy approval in the EVIDENCE slot (issuer is the CEO)
      [
        "caio-mandate-grant:ceo-1:legacy-owner-approval:metadata-registration-2026",
        "grant_basis_evidence_not_opaque:caio-mandate-grant:ceo-1:legacy-owner-approval:metadata-registration-2026",
      ],
      // issued by someone else
      [
        "caio-mandate-grant:cfo-1:issuance-1",
        "grant_basis_issuer_is_not_this_ceo:caio-mandate-grant:cfo-1:issuance-1",
      ],
      // empty suffix / missing evidence
      ["caio-mandate-grant:", "grant_basis_malformed:caio-mandate-grant:"],
      [
        "caio-mandate-grant:ceo-1",
        "grant_basis_malformed:caio-mandate-grant:ceo-1",
      ],
      [
        "caio-mandate-grant:ceo-1:",
        "grant_basis_malformed:caio-mandate-grant:ceo-1:",
      ],
    ];
    for (const [ref, expected] of cases) {
      const result = validateCaioMandate(
        makeMandate({ grantBasisRefs: [ref] }),
      );
      expect(result.valid, ref).toBe(false);
      expect(result.errors, ref).toContain(expected);
    }
    expect(
      validateCaioMandate(makeMandate({ grantBasisRefs: [] })).errors,
    ).toContain("grant_basis_missing");
  });

  it("pins the authority firewall literals", () => {
    const forged = makeMandate({
      reportsTo: "BOARD" as unknown as "CEO",
      conflictResolution: "continue" as unknown as "pause_and_escalate_ceo",
      authorityEffect: "grant_all" as unknown as "none",
      runtimeAuthorityRef: "permission-policy-1" as unknown as null,
      revocationPolicy:
        "envelopes_survive" as unknown as "envelopes_invalid_immediately",
    });
    const result = validateCaioMandate(forged);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "reports_to_must_be_ceo",
        "conflict_resolution_must_pause_and_escalate_ceo",
        "authority_effect_must_be_none",
        "runtime_authority_ref_must_be_null",
        "revocation_policy_must_invalidate_envelopes",
      ]),
    );
  });

  it("rejects missing anchors, missing audits, and garbage timestamps", () => {
    expect(
      validateCaioMandate(makeMandate({ accountabilityAnchorRefs: [] })).errors,
    ).toContain("accountability_anchor_missing");
    expect(
      validateCaioMandate(makeMandate({ auditRefs: [] })).errors,
    ).toContain("audit_ref_missing");
    expect(
      validateCaioMandate(
        makeMandate({ validFrom: "aaa", validUntil: "zzz" }),
      ).errors,
    ).toContain("validity_timestamp_invalid");
    expect(
      validateCaioMandate(
        makeMandate({
          validFrom: "2026-12-31T00:00:00Z",
          validUntil: "2026-07-01T00:00:00Z",
        }),
      ).errors,
    ).toContain("validity_window_invalid");
  });

  it("rejects blank entries in every ref array", () => {
    for (const field of [
      "objectiveRefs",
      "scopeRefs",
      "reservedMatterRefs",
      "guardianStopRefs",
      "policyEnvelopeRefs",
    ] as const) {
      expect(
        validateCaioMandate(makeMandate({ [field]: [""] })).errors,
        field,
      ).toContain(`${field}_entries_invalid`);
    }
    expect(
      validateCaioMandate(makeMandate({ auditRefs: [""] })).errors,
    ).toContain("audit_ref_missing");
  });

  it("rejects an active mandate carrying a triggered emergency stop", () => {
    const result = validateCaioMandate(
      makeMandate({ emergencyStopRef: "stop-1" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("active_mandate_with_emergency_stop");
  });
});

describe("deriveRuntimeAuthority", () => {
  it("grants nothing for a valid mandate", () => {
    expect(deriveRuntimeAuthority(makeMandate()).grantsPermission).toBe(false);
  });

  it("grants nothing even for a forged authorized_execute mandate", () => {
    const forged = makeMandate({
      stage: "authorized_execute" as CaioMandateStage,
      authorityEffect: "grant_all" as unknown as "none",
      runtimeAuthorityRef: "permission-policy-1" as unknown as null,
    });
    const projection = deriveRuntimeAuthority(forged);
    expect(projection.grantsPermission).toBe(false);
    expect(projection.reason).toContain("existing permission / policy chain");
  });
});

describe("validateActiveMandateUniqueness", () => {
  it("allows one active mandate per workspace", () => {
    const result = validateActiveMandateUniqueness([
      makeMandate(),
      makeMandate({ mandateId: "mandate-2", workspaceRef: "workspace-2" }),
      makeMandate({ mandateId: "mandate-3", status: "revoked" }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects two active mandates in one workspace", () => {
    const result = validateActiveMandateUniqueness([
      makeMandate(),
      makeMandate({ mandateId: "mandate-2" }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("multiple_active_mandates:workspace-1");
  });
});

describe("projectMandateOnCeoChange", () => {
  it("suspends the active mandate of a departed CEO", () => {
    expect(projectMandateOnCeoChange(makeMandate(), "ceo-2").status).toBe(
      "suspended",
    );
  });

  it("keeps the mandate under the same CEO and non-active states as-is", () => {
    expect(projectMandateOnCeoChange(makeMandate(), "ceo-1").status).toBe(
      "active",
    );
    expect(
      projectMandateOnCeoChange(makeMandate({ status: "revoked" }), "ceo-2")
        .status,
    ).toBe("revoked");
  });
});

describe("validatePolicyEnvelope", () => {
  it("accepts an envelope granted by the CEO inside the mandate", () => {
    expect(validatePolicyEnvelope(makeEnvelope(), makeMandate())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects non-CEO grantors, bad scope/window/status/audit", () => {
    const mandate = makeMandate();
    expect(
      validatePolicyEnvelope(makeEnvelope({ grantedByRef: "cfo-1" }), mandate)
        .errors,
    ).toContain("envelope_grantor_must_be_ceo");
    expect(
      validatePolicyEnvelope(makeEnvelope({ scopeRefs: ["scope-z"] }), mandate)
        .errors,
    ).toContain("envelope_scope_outside_mandate:scope-z");
    expect(
      validatePolicyEnvelope(
        makeEnvelope({ validUntil: "2027-06-01T00:00:00Z" }),
        mandate,
      ).errors,
    ).toContain("envelope_window_outside_mandate");
    expect(
      validatePolicyEnvelope(
        makeEnvelope({ validFrom: "bbb", validUntil: "ccc" }),
        mandate,
      ).errors,
    ).toContain("validity_timestamp_invalid");
    expect(
      validatePolicyEnvelope(
        makeEnvelope({ status: "granted" as unknown as "active" }),
        mandate,
      ).errors,
    ).toContain("envelope_status_unknown");
    expect(
      validatePolicyEnvelope(makeEnvelope({ auditRefs: [] }), mandate).errors,
    ).toContain("audit_ref_missing");
    expect(
      validatePolicyEnvelope(makeEnvelope({ scopeRefs: [] }), mandate).errors,
    ).toContain("envelope_scope_missing");
    expect(
      validatePolicyEnvelope(
        makeEnvelope({ authorityEffect: "grant_all" as unknown as "none" }),
        mandate,
      ).errors,
    ).toContain("authority_effect_must_be_none");
  });

  it("rejects string-ordered but non-instant windows (no lexicographic pass)", () => {
    const mandate = makeMandate({ validFrom: "aaa", validUntil: "zzz" });
    const result = validatePolicyEnvelope(
      makeEnvelope({ validFrom: "bbb", validUntil: "ccc" }),
      mandate,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("validity_timestamp_invalid");
  });
});

describe("projectEnvelopeValidity", () => {
  it("kills envelopes when the mandate is not active or a stop is in force", () => {
    for (const status of [
      "suspended",
      "revoked",
      "expired",
      "superseded",
      "draft",
    ] as const) {
      const projection = projectEnvelopeValidity(
        makeEnvelope(),
        makeMandate({ status }),
        [],
        NOW,
      );
      expect(projection.effective, status).toBe(false);
      expect(projection.reasons).toContain(`mandate_status_${status}`);
    }
    const stopped = projectEnvelopeValidity(
      makeEnvelope(),
      makeMandate(),
      [makeStop()],
      NOW,
    );
    expect(stopped.effective).toBe(false);
    expect(stopped.reasons).toContain("in_force_guardian_stop:stop-1");
  });

  it("treats a guardian-forged resume as still stopped", () => {
    const projection = projectEnvelopeValidity(
      makeEnvelope(),
      makeMandate(),
      [
        makeStop({
          resumedByRef: "guardian-1",
          resumedAt: "2026-08-03T00:00:00Z",
        }),
      ],
      NOW,
    );
    expect(projection.effective).toBe(false);
    expect(projection.reasons).toContain("in_force_guardian_stop:stop-1");

    const incomplete = projectEnvelopeValidity(
      makeEnvelope(),
      makeMandate(),
      [makeStop({ resumedByRef: "ceo-1" })],
      NOW,
    );
    expect(incomplete.effective).toBe(false);
    expect(incomplete.reasons).toContain("in_force_guardian_stop:stop-1");
  });

  it("treats time-forged resumes as still stopped", () => {
    // resumed BEFORE the stop was triggered
    const backdated = projectEnvelopeValidity(
      makeEnvelope(),
      makeMandate(),
      [
        makeStop({
          triggeredAt: "2026-08-10T00:00:00Z",
          resumedByRef: "ceo-1",
          resumedAt: "2026-08-09T00:00:00Z",
        }),
      ],
      NOW,
    );
    expect(backdated.effective).toBe(false);
    expect(backdated.reasons).toContain("in_force_guardian_stop:stop-1");
    // resume dated in the future relative to the evaluation instant
    const future = projectEnvelopeValidity(
      makeEnvelope(),
      makeMandate(),
      [
        makeStop({
          resumedByRef: "ceo-1",
          resumedAt: "2026-08-20T00:00:00Z",
        }),
      ],
      NOW,
    );
    expect(future.effective).toBe(false);
    expect(future.reasons).toContain("in_force_guardian_stop:stop-1");
  });

  it("refuses to make an envelope effective on an INVALID mandate", () => {
    const forged = makeMandate({
      stage: "authorized_execute" as CaioMandateStage,
      authorityEffect: "grant_all" as unknown as "none",
      runtimeAuthorityRef: "permission-1" as unknown as null,
    });
    const projection = projectEnvelopeValidity(
      makeEnvelope(),
      forged,
      [],
      NOW,
    );
    expect(projection.effective).toBe(false);
    expect(projection.reasons).toEqual(
      expect.arrayContaining([
        "mandate_stage_roadmap_disabled",
        "mandate_authority_effect_must_be_none",
        "mandate_runtime_authority_ref_must_be_null",
      ]),
    );
  });

  it("is bounded by the envelope window at the evaluation instant", () => {
    expect(
      projectEnvelopeValidity(
        makeEnvelope(),
        makeMandate(),
        [],
        "2026-07-15T00:00:00Z",
      ).reasons,
    ).toContain("envelope_not_yet_valid");
    expect(
      projectEnvelopeValidity(
        makeEnvelope(),
        makeMandate(),
        [],
        "2026-10-01T00:00:00Z",
      ).reasons,
    ).toContain("envelope_expired");
    expect(
      projectEnvelopeValidity(makeEnvelope(), makeMandate(), [], "whenever")
        .reasons,
    ).toContain("evaluation_instant_invalid");
  });

  it("is effective only for a valid active pair with resumed stops", () => {
    const projection = projectEnvelopeValidity(
      makeEnvelope(),
      makeMandate(),
      [
        makeStop({
          resumedByRef: "ceo-1",
          resumedAt: "2026-08-03T00:00:00Z",
        }),
      ],
      NOW,
    );
    expect(projection).toEqual({ effective: true, reasons: [] });
  });
});

describe("validateGuardianStop", () => {
  it("accepts a stop by a designated guardian", () => {
    expect(validateGuardianStop(makeStop(), makeMandate())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects stops by undesignated refs and non-stop actions", () => {
    expect(
      validateGuardianStop(makeStop({ guardianRef: "random-1" }), makeMandate())
        .errors,
    ).toContain("guardian_not_designated");
    expect(
      validateGuardianStop(
        makeStop({ action: "resume" as unknown as "stop" }),
        makeMandate(),
      ).errors,
    ).toContain("guardian_action_unknown");
  });

  it("only the CEO can resume — never a guardian", () => {
    expect(
      validateGuardianStop(
        makeStop({
          resumedByRef: "guardian-1",
          resumedAt: "2026-08-03T00:00:00Z",
        }),
        makeMandate(),
      ).errors,
    ).toContain("resume_authority_is_ceo_only");
    expect(
      validateGuardianStop(
        makeStop({ resumedByRef: "ceo-1", resumedAt: "2026-08-03T00:00:00Z" }),
        makeMandate(),
      ),
    ).toEqual({ valid: true, errors: [] });
    expect(
      validateGuardianStop(makeStop({ resumedByRef: "ceo-1" }), makeMandate())
        .errors,
    ).toContain("resume_record_incomplete");
    expect(
      validateGuardianStop(makeStop({ auditRefs: [] }), makeMandate()).errors,
    ).toContain("audit_ref_missing");
    expect(
      validateGuardianStop(makeStop({ stopId: "" }), makeMandate()).errors,
    ).toContain("stop_id_missing");
    expect(
      validateGuardianStop(
        makeStop({
          triggeredAt: "2026-08-10T00:00:00Z",
          resumedByRef: "ceo-1",
          resumedAt: "2026-08-09T00:00:00Z",
        }),
        makeMandate(),
      ).errors,
    ).toContain("resume_before_trigger");
  });
});

describe("validateHumanResponse", () => {
  function makeResponse(
    overrides: Partial<CaioHumanResponse> = {},
  ): CaioHumanResponse {
    return {
      responseId: "response-1",
      mandateRef: "mandate-1",
      responderRef: "person-1",
      responseType: "refuse",
      subjectWorkRef: "work-packet-1",
      reason: "conflicts with my direct manager's instruction",
      status: "raised",
      auditRefs: ["audit-response-1"],
      retaliationProhibited: true,
      ...overrides,
    };
  }

  it("treats refuse, pause, and appeal as always legitimate", () => {
    for (const responseType of ["refuse", "pause", "appeal"] as const) {
      expect(validateHumanResponse(makeResponse({ responseType }))).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("requires linkage, auditability, known status, and non-retaliation", () => {
    expect(
      validateHumanResponse(makeResponse({ auditRefs: [] })).errors,
    ).toContain("audit_ref_missing");
    expect(
      validateHumanResponse(makeResponse({ mandateRef: "" })).errors,
    ).toContain("mandate_ref_missing");
    expect(
      validateHumanResponse(makeResponse({ responseId: " " })).errors,
    ).toContain("response_id_missing");
    expect(
      validateHumanResponse(makeResponse({ reason: " " })).errors,
    ).toContain("reason_missing");
    expect(
      validateHumanResponse(
        makeResponse({ status: "retaliated" as unknown as "raised" }),
      ).errors,
    ).toContain("response_status_unknown");
    expect(
      validateHumanResponse(
        makeResponse({ retaliationProhibited: false as unknown as true }),
      ).errors,
    ).toContain("retaliation_prohibition_missing");
  });
});

describe("validateConflictRecord", () => {
  function makeConflict(
    overrides: Partial<CaioConflictRecord> = {},
  ): CaioConflictRecord {
    return {
      conflictId: "conflict-1",
      mandateRef: "mandate-1",
      caioInstructionRef: "caio-instruction-1",
      humanInstructionRef: "human-instruction-1",
      taskRef: "task-1",
      taskState: "paused",
      resolution: "pause_and_escalate_ceo",
      escalatedToRef: "ceo-1",
      auditRefs: ["audit-conflict-1"],
      ...overrides,
    };
  }

  it("accepts a paused conflict escalated to the CEO", () => {
    expect(validateConflictRecord(makeConflict(), makeMandate())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects any other escalation target, task state, or missing audit", () => {
    expect(
      validateConflictRecord(
        makeConflict({ escalatedToRef: "coo-1" }),
        makeMandate(),
      ).errors,
    ).toContain("escalation_target_is_ceo_only");
    expect(
      validateConflictRecord(
        makeConflict({ taskState: "running" as unknown as "paused" }),
        makeMandate(),
      ).errors,
    ).toContain("conflicted_task_must_pause");
    expect(
      validateConflictRecord(makeConflict({ auditRefs: [] }), makeMandate())
        .errors,
    ).toContain("audit_ref_missing");
    expect(
      validateConflictRecord(makeConflict({ auditRefs: [""] }), makeMandate())
        .errors,
    ).toContain("audit_ref_missing");
    expect(
      validateConflictRecord(makeConflict({ taskRef: "" }), makeMandate())
        .errors,
    ).toContain("task_ref_missing");
    expect(
      validateConflictRecord(makeConflict({ conflictId: " " }), makeMandate())
        .errors,
    ).toContain("conflict_id_missing");
  });
});

describe("validateDualApproval", () => {
  function makeApproval(overrides: Partial<CaioApproval> = {}): CaioApproval {
    return {
      approvalId: "approval-1",
      subjectRef: "decision-1",
      principalRef: "person-1",
      canonicalPrincipalRef: "canonical-person-1",
      roleRef: "role-ceo",
      canonicalRoleRef: "canonical-role-ceo",
      approvedAt: "2026-08-01T00:00:00Z",
      evidenceRef: "evidence-1",
      ...overrides,
    };
  }

  it("accepts two canonically independent approvers", () => {
    expect(
      validateDualApproval([
        makeApproval(),
        makeApproval({
          approvalId: "approval-2",
          principalRef: "person-2",
          canonicalPrincipalRef: "canonical-person-2",
          roleRef: "role-counsel",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects display aliases hiding one canonical person or role", () => {
    // two different display refs, same canonical person
    expect(
      validateDualApproval([
        makeApproval(),
        makeApproval({
          approvalId: "approval-2",
          principalRef: "person-1-email-alias",
          roleRef: "role-counsel",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]).errors,
    ).toContain("approvers_must_be_distinct_principals");
    // two different role seats, same canonical role
    expect(
      validateDualApproval([
        makeApproval(),
        makeApproval({
          approvalId: "approval-2",
          principalRef: "person-2",
          canonicalPrincipalRef: "canonical-person-2",
          roleRef: "role-ceo-seat-2",
        }),
      ]).errors,
    ).toContain("approvers_must_hold_independent_roles");
    expect(validateDualApproval([makeApproval()]).errors).toContain(
      "dual_approval_requires_two_approvals",
    );
    expect(
      validateDualApproval([
        makeApproval({ canonicalPrincipalRef: "" }),
        makeApproval({
          approvalId: "approval-2",
          canonicalPrincipalRef: "canonical-person-2",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]).errors,
    ).toContain("canonical_identity_missing:approval-1");
  });

  it("rejects stitched, replayed, or unbound approvals", () => {
    // approvals for two different decisions cannot combine
    expect(
      validateDualApproval([
        makeApproval(),
        makeApproval({
          approvalId: "approval-2",
          subjectRef: "decision-OTHER",
          canonicalPrincipalRef: "canonical-person-2",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]).errors,
    ).toContain("approvals_must_share_one_subject");
    // duplicate approval ids are a replay
    expect(
      validateDualApproval([
        makeApproval(),
        makeApproval({
          canonicalPrincipalRef: "canonical-person-2",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]).errors,
    ).toContain("approval_id_missing_or_duplicate:approval-1");
    // display identities must be present too
    expect(
      validateDualApproval([
        makeApproval({ principalRef: "" }),
        makeApproval({
          approvalId: "approval-2",
          canonicalPrincipalRef: "canonical-person-2",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]).errors,
    ).toContain("display_identity_missing:approval-1");
    // an approval without a subject is unbound
    expect(
      validateDualApproval([
        makeApproval({ subjectRef: "" }),
        makeApproval({
          approvalId: "approval-2",
          canonicalPrincipalRef: "canonical-person-2",
          canonicalRoleRef: "canonical-role-counsel",
        }),
      ]).errors,
    ).toContain("approval_subject_missing:approval-1");
  });
});
