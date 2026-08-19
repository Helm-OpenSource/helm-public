// Deterministic judgment for the Member Gateway read layer. Pure functions,
// no IO. Fail-closed: missing evidence is always a denial.

import { parseInstant } from "@/lib/caio-governance/contract";
import { METADATA_ONLY_FIELD_WHITELIST } from "@/lib/member-gateway/types";
import type {
  MemberObjectClassification,
  MemberPrincipal,
  MemberProjectionDecision,
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
// This function judges only the evidence it is given: verifying that each
// ref actually binds to this (workspace, member, object) triple is the
// caller/storage layer's responsibility.
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
  // The destructure narrows to the non-empty tuple the decision type
  // requires, without an assertion.
  const [first, ...rest] = denied;
  if (first !== undefined) {
    return { allowed: false, deniedDimensions: [first, ...rest] };
  }
  return { allowed: true, deniedDimensions: [] };
}

export type MemberProjectionInput = {
  surface: MemberReadSurfaceDecision;
  classification: MemberObjectClassification | null;
  // Age of the classification at decision time, computed by the producer;
  // carried onto the decision evidence (spec §8.2).
  freshnessMinutes: number | null;
  // The tenant-approved provider profile for this client; null when the
  // client's provider is not on the tenant egress allowlist.
  providerRef: string | null;
  purpose: string;
  projectionPolicyRef: string;
  projectionPolicyVersion: number;
  requestedFields: readonly string[];
};

// Projection judgment (spec §8.2). Order matters and is fail-closed:
// surface → purpose → provider → classification → disposition ladder.
// A classification whose classifiedAt is not a strict, calendar-valid
// instant (per caio-governance parseInstant; Date.parse laxity is not
// accepted) is treated as unknown (spec §8.1: unknown defaults to
// restricted + local_only and never projects remotely). An unparseable
// classifiedAt is still carried onto the decision evidence verbatim as
// observed input; only the null-classification path carries null.
export function decideMemberProjection(
  input: MemberProjectionInput,
): MemberProjectionDecision {
  const base = {
    projectionPolicyRef: input.projectionPolicyRef,
    projectionPolicyVersion: input.projectionPolicyVersion,
    // "" is the no-approved-provider sentinel; the decision type's
    // providerRef is intentionally non-nullable. Envelope validation must
    // not require a non-empty providerRef on blocked decisions.
    providerRef: input.providerRef ?? "",
    purpose: input.purpose,
    classifiedAt: input.classification?.classifiedAt ?? null,
    freshnessMinutes:
      input.classification === null ? null : input.freshnessMinutes,
    deniedFields: [] as readonly string[],
  };
  if (!input.surface.allowed) {
    return { ...base, projection: null, blockReason: "read_surface_denied" };
  }
  if (!hasRef(input.purpose)) {
    return { ...base, projection: null, blockReason: "purpose_missing" };
  }
  if (!hasRef(input.providerRef)) {
    return { ...base, projection: null, blockReason: "provider_not_approved" };
  }
  if (
    input.classification === null ||
    parseInstant(input.classification.classifiedAt) === null
  ) {
    return {
      ...base,
      projection: null,
      blockReason: "classification_unknown",
    };
  }
  if (input.classification.processingDisposition === "prohibited") {
    return { ...base, projection: null, blockReason: "LOCAL_VIEW_REQUIRED" };
  }
  if (input.classification.processingDisposition === "local_only") {
    const whitelist = new Set<string>(METADATA_ONLY_FIELD_WHITELIST);
    const deniedFields = input.requestedFields.filter(
      (field) => !whitelist.has(field),
    );
    return {
      ...base,
      projection: "metadata_only",
      deniedFields,
      blockReason: null,
    };
  }
  return { ...base, projection: "remote_projected", blockReason: null };
}
