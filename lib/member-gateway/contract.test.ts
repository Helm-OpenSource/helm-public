import { describe, expect, it } from "vitest";

import {
  decideMemberReadSurface,
  validateMemberPrincipal,
} from "@/lib/member-gateway/contract";
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
});
