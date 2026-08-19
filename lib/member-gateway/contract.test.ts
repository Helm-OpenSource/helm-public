import { describe, expect, it } from "vitest";

import {
  decideMemberProjection,
  decideMemberReadSurface,
  validateMemberPrincipal,
  validateMemberToolEnvelope,
} from "@/lib/member-gateway/contract";
import type { MemberProjectionInput } from "@/lib/member-gateway/contract";
import type {
  MemberPrincipal,
  MemberReadSurfaceInput,
  MemberToolEnvelope,
} from "@/lib/member-gateway/types";

function makePrincipal(
  overrides: Partial<MemberPrincipal> = {},
): MemberPrincipal {
  return {
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    sessionRef: "session-1",
    deviceRegistrationRef: "device-1",
    clientId: "workbuddy-desktop",
    ...overrides,
  };
}

function makeSurfaceInput(
  overrides: Partial<MemberReadSurfaceInput> = {},
): MemberReadSurfaceInput {
  return {
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    objectRef: "case-42",
    tool: "query_evidence",
    purpose: "call_preparation",
    liveMembershipRef: "membership-1",
    toolScopeRef: "tool-scope-1",
    objectRelationshipAuthorizationRef: "object-auth-1",
    fieldPurposePolicyRef: "field-policy-1",
    sourceAuthorizationRef: "source-auth-1",
    tenantProviderEgressPolicyRef: "egress-policy-1",
    classification: {
      sensitivity: "internal",
      processingDisposition: "remote_projected",
      classifiedAt: "2026-08-19T00:00:00Z",
    },
    ...overrides,
  };
}

describe("validateMemberPrincipal", () => {
  it("accepts a complete principal", () => {
    expect(validateMemberPrincipal(makePrincipal())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects each missing binding with a named error", () => {
    expect(
      validateMemberPrincipal(makePrincipal({ sessionRef: "" })).errors,
    ).toContain("session_ref_missing");
    expect(
      validateMemberPrincipal(makePrincipal({ deviceRegistrationRef: " " }))
        .errors,
    ).toContain("device_registration_missing");
    expect(
      validateMemberPrincipal(makePrincipal({ clientId: "" })).errors,
    ).toContain("client_id_missing");
  });

  it("rejects missing workspace and member refs", () => {
    expect(
      validateMemberPrincipal(makePrincipal({ workspaceRef: "" })).errors,
    ).toContain("workspace_ref_missing");
    expect(
      validateMemberPrincipal(makePrincipal({ memberRef: "" })).errors,
    ).toContain("member_ref_missing");
  });

  it("an empty principal accumulates all five errors", () => {
    const result = validateMemberPrincipal({
      workspaceRef: "",
      memberRef: "",
      sessionRef: "",
      deviceRegistrationRef: "",
      clientId: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "workspace_ref_missing",
      "member_ref_missing",
      "session_ref_missing",
      "device_registration_missing",
      "client_id_missing",
    ]);
  });
});

describe("decideMemberReadSurface", () => {
  it("allows only when all seven dimensions carry explicit evidence", () => {
    expect(decideMemberReadSurface(makeSurfaceInput())).toEqual({
      allowed: true,
      deniedDimensions: [],
    });
  });

  it("denies per missing dimension and names every gap", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({
        toolScopeRef: null,
        tenantProviderEgressPolicyRef: null,
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual([
      "tool_scope",
      "tenant_provider_egress_policy",
    ]);
  });

  it("treats unclassified objects as a denial, never a default-allow", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({ classification: null }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual(["current_classification"]);
  });

  it("whitespace-only refs count as missing", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({ liveMembershipRef: "  " }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual(["live_membership"]);
  });

  it("denies all seven dimensions in frozen order when nothing is authorized", () => {
    const decision = decideMemberReadSurface(
      makeSurfaceInput({
        liveMembershipRef: null,
        toolScopeRef: null,
        objectRelationshipAuthorizationRef: null,
        fieldPurposePolicyRef: null,
        sourceAuthorizationRef: null,
        tenantProviderEgressPolicyRef: null,
        classification: null,
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.deniedDimensions).toEqual([
      "live_membership",
      "tool_scope",
      "object_relationship_authorization",
      "field_purpose_policy",
      "source_authorization",
      "tenant_provider_egress_policy",
      "current_classification",
    ]);
  });
});

function makeProjectionInput(
  overrides: Partial<MemberProjectionInput> = {},
): MemberProjectionInput {
  return {
    surface: { allowed: true, deniedDimensions: [] },
    classification: {
      sensitivity: "internal",
      processingDisposition: "remote_projected",
      classifiedAt: "2026-08-19T00:00:00Z",
    },
    freshnessMinutes: 15,
    providerRef: "provider-profile-1",
    purpose: "call_preparation",
    projectionPolicyRef: "projection-policy-1",
    projectionPolicyVersion: 3,
    requestedFields: ["objectKind", "evidenceRef", "summary"],
    ...overrides,
  };
}

describe("decideMemberProjection", () => {
  it("projects remote_projected with full decision evidence", () => {
    const decision = decideMemberProjection(makeProjectionInput());
    expect(decision.projection).toBe("remote_projected");
    expect(decision.blockReason).toBeNull();
    expect(decision.projectionPolicyRef).toBe("projection-policy-1");
    expect(decision.projectionPolicyVersion).toBe(3);
    expect(decision.providerRef).toBe("provider-profile-1");
    expect(decision.purpose).toBe("call_preparation");
    expect(decision.classifiedAt).toBe("2026-08-19T00:00:00Z");
    expect(decision.freshnessMinutes).toBe(15);
  });

  it("denied surface blocks with read_surface_denied", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        surface: { allowed: false, deniedDimensions: ["tool_scope"] },
      }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("read_surface_denied");
  });

  it("unknown classification blocks and carries no freshness", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ classification: null }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("classification_unknown");
    expect(decision.classifiedAt).toBeNull();
    expect(decision.freshnessMinutes).toBeNull();
  });

  it("unparseable classifiedAt blocks as classification_unknown", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        classification: {
          sensitivity: "internal",
          processingDisposition: "remote_projected",
          classifiedAt: "not-a-timestamp",
        },
      }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("classification_unknown");
  });

  it("unapproved provider blocks as provider_not_approved", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ providerRef: null }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("provider_not_approved");
  });

  it("missing purpose blocks as purpose_missing", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ purpose: " " }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("purpose_missing");
  });

  it("prohibited disposition returns LOCAL_VIEW_REQUIRED", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        classification: {
          sensitivity: "restricted",
          processingDisposition: "prohibited",
          classifiedAt: "2026-08-19T00:00:00Z",
        },
      }),
    );
    expect(decision.projection).toBeNull();
    expect(decision.blockReason).toBe("LOCAL_VIEW_REQUIRED");
  });

  it("local_only downgrades to metadata_only and names denied fields", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        classification: {
          sensitivity: "confidential",
          processingDisposition: "local_only",
          classifiedAt: "2026-08-19T00:00:00Z",
        },
        requestedFields: ["objectKind", "summary", "customerName"],
      }),
    );
    expect(decision.projection).toBe("metadata_only");
    expect(decision.deniedFields).toEqual(["summary", "customerName"]);
  });

  it("rejects Date.parse-lax timestamps as classification_unknown", () => {
    for (const lax of ["2026", "2026-02-30T00:00:00Z"]) {
      const decision = decideMemberProjection(
        makeProjectionInput({
          classification: {
            sensitivity: "internal",
            processingDisposition: "remote_projected",
            classifiedAt: lax,
          },
        }),
      );
      expect(decision.projection).toBeNull();
      expect(decision.blockReason).toBe("classification_unknown");
    }
  });

  it("read_surface_denied wins when multiple failures coincide", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({
        surface: { allowed: false, deniedDimensions: ["tool_scope"] },
        purpose: "",
        providerRef: null,
        classification: null,
      }),
    );
    expect(decision.blockReason).toBe("read_surface_denied");
  });

  it("empty-string providerRef sentinel appears on blocked decisions", () => {
    const decision = decideMemberProjection(
      makeProjectionInput({ providerRef: null }),
    );
    expect(decision.providerRef).toBe("");
  });
});

function makeEnvelope(
  overrides: Partial<MemberToolEnvelope<unknown>> = {},
): MemberToolEnvelope<unknown> {
  return {
    ok: true,
    requestId: "req-1",
    serverTime: "2026-08-19T00:00:00Z",
    data: { objectKind: "case" },
    error: null,
    boundary: {
      authorityEffect: "none",
      externalExecutionAllowed: false,
      decision: {
        projection: "remote_projected",
        projectionPolicyRef: "projection-policy-1",
        projectionPolicyVersion: 3,
        providerRef: "provider-profile-1",
        purpose: "call_preparation",
        classifiedAt: "2026-08-19T00:00:00Z",
        freshnessMinutes: 15,
        deniedFields: [],
        blockReason: null,
      },
    },
    ...overrides,
  };
}

describe("validateMemberToolEnvelope", () => {
  it("accepts a complete projected envelope", () => {
    expect(validateMemberToolEnvelope(makeEnvelope())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects data released without a projection decision", () => {
    const envelope = makeEnvelope();
    envelope.boundary.decision.projection = null;
    envelope.boundary.decision.blockReason = "read_surface_denied";
    expect(validateMemberToolEnvelope(envelope).errors).toContain(
      "data_released_without_projection",
    );
  });

  it("rejects a blocked decision without a reason", () => {
    const envelope = makeEnvelope({ data: null });
    envelope.boundary.decision.projection = null;
    envelope.boundary.decision.blockReason = null;
    expect(validateMemberToolEnvelope(envelope).errors).toContain(
      "blocked_without_reason",
    );
  });

  it("rejects projection decision evidence gaps", () => {
    const envelope = makeEnvelope();
    envelope.boundary.decision.projectionPolicyRef = "";
    envelope.boundary.decision.projectionPolicyVersion = 0;
    envelope.boundary.decision.purpose = "";
    const errors = validateMemberToolEnvelope(envelope).errors;
    expect(errors).toContain("projection_policy_ref_missing");
    expect(errors).toContain("projection_policy_version_invalid");
    expect(errors).toContain("purpose_missing");
  });

  it("rejects ok-with-error and error-with-data shapes", () => {
    expect(
      validateMemberToolEnvelope(
        makeEnvelope({
          error: { code: "X", message: "boom", retryable: false },
        }),
      ).errors,
    ).toContain("ok_with_error");
    const failed = makeEnvelope({
      ok: false,
      error: { code: "X", message: "boom", retryable: false },
    });
    expect(validateMemberToolEnvelope(failed).errors).toContain(
      "error_with_data",
    );
  });

  it("a projecting decision must carry classifiedAt, freshness, and provider", () => {
    const envelope = makeEnvelope();
    envelope.boundary.decision.classifiedAt = null;
    envelope.boundary.decision.freshnessMinutes = null;
    envelope.boundary.decision.providerRef = "";
    const errors = validateMemberToolEnvelope(envelope).errors;
    expect(errors).toContain("classified_at_missing_for_projection");
    expect(errors).toContain("freshness_missing_for_projection");
    expect(errors).toContain("provider_ref_missing_for_projection");
  });

  it("blocked decisions are exempt from projection-evidence requirements", () => {
    const envelope = makeEnvelope({ data: null });
    envelope.boundary.decision.projection = null;
    envelope.boundary.decision.blockReason = "provider_not_approved";
    envelope.boundary.decision.providerRef = "";
    envelope.boundary.decision.classifiedAt = null;
    envelope.boundary.decision.freshnessMinutes = null;
    expect(validateMemberToolEnvelope(envelope)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
