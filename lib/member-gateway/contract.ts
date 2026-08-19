// Deterministic judgment for the Member Gateway read layer. Pure functions,
// no IO. Fail-closed: missing evidence is always a denial.

import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
  MemberReadSurfaceDimension,
  MemberReadSurfaceInput,
} from "@/lib/member-gateway/types";

export type ContractValidation = { valid: boolean; errors: string[] };

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateMemberPrincipal(
  principal: MemberPrincipal,
): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(principal.workspaceRef)) {
    errors.push("workspace_ref_missing");
  }
  if (!hasRef(principal.memberRef)) {
    errors.push("member_ref_missing");
  }
  if (!hasRef(principal.sessionRef)) {
    errors.push("session_ref_missing");
  }
  if (!hasRef(principal.deviceRegistrationRef)) {
    errors.push("device_registration_missing");
  }
  if (!hasRef(principal.clientId)) {
    errors.push("client_id_missing");
  }
  return { valid: errors.length === 0, errors };
}

// Seven-way intersection (spec §8.1). Every dimension must present explicit
// evidence per object per call; the decision names every denied dimension so
// callers can log a machine-readable block reason.
export function decideMemberReadSurface(
  input: MemberReadSurfaceInput,
): MemberReadSurfaceDecision {
  const denied: MemberReadSurfaceDimension[] = [];
  if (!hasRef(input.liveMembershipRef)) {
    denied.push("live_membership");
  }
  if (!hasRef(input.toolScopeRef)) {
    denied.push("tool_scope");
  }
  if (!hasRef(input.objectRelationshipAuthorizationRef)) {
    denied.push("object_relationship_authorization");
  }
  if (!hasRef(input.fieldPurposePolicyRef)) {
    denied.push("field_purpose_policy");
  }
  if (!hasRef(input.sourceAuthorizationRef)) {
    denied.push("source_authorization");
  }
  if (!hasRef(input.tenantProviderEgressPolicyRef)) {
    denied.push("tenant_provider_egress_policy");
  }
  if (input.classification === null) {
    denied.push("current_classification");
  }
  const [first, ...rest] = denied;
  if (first !== undefined) {
    return { allowed: false, deniedDimensions: [first, ...rest] };
  }
  return { allowed: true, deniedDimensions: [] };
}
