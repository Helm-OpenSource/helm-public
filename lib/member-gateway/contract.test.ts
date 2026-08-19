import { describe, expect, it } from "vitest";

import {
  decideMemberProjection,
  decideMemberReadSurface,
  validateMemberPrincipal,
} from "@/lib/member-gateway/contract";
import type { MemberProjectionInput } from "@/lib/member-gateway/contract";
import type {
  MemberPrincipal,
  MemberReadSurfaceInput,
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
});
