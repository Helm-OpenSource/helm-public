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
  MemberToolEnvelope,
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
// Classification evidence is complete only when classifiedAt is a strict
// instant AND the producer supplied a non-negative finite freshness;
// anything less blocks as classification_unknown. Preconditions:
// projectionPolicyRef/Version identify the caller's active policy and are
// copied verbatim — judging them is the envelope validator's job.
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
    parseInstant(input.classification.classifiedAt) === null ||
    input.freshnessMinutes === null ||
    !Number.isFinite(input.freshnessMinutes) ||
    input.freshnessMinutes < 0
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

// Envelope validation (spec §6 / §8.2). The envelope is the only shape a
// client ever sees. MemberToolEnvelope is deliberately a loose wire shape
// (not a discriminated union): this validator owns the ok/data/error and
// projection/blockReason consistency rules, fail-closed. A projecting
// decision must carry its full evidence (classifiedAt, freshnessMinutes,
// providerRef); blocked decisions are exempt — their evidence fields hold
// whatever was observed, including the "" provider sentinel.
// Literal membership of projection/blockReason values and serverTime
// format are trusted to the TypeScript layer; this validator judges
// cross-field consistency and evidence completeness only.
export function validateMemberToolEnvelope(
  envelope: MemberToolEnvelope<unknown>,
): ContractValidation {
  const errors: string[] = [];
  if (envelope.boundary.authorityEffect !== "none") {
    errors.push("authority_effect_must_be_none");
  }
  if (envelope.boundary.externalExecutionAllowed !== false) {
    errors.push("external_execution_must_be_false");
  }
  if (!hasRef(envelope.requestId)) {
    errors.push("request_id_missing");
  }
  if (envelope.ok && envelope.error !== null) {
    errors.push("ok_with_error");
  }
  if (!envelope.ok && envelope.data !== null) {
    errors.push("error_with_data");
  }
  if (!envelope.ok && envelope.error === null) {
    errors.push("error_missing");
  }
  const decision = envelope.boundary.decision;
  if (!hasRef(decision.projectionPolicyRef)) {
    errors.push("projection_policy_ref_missing");
  }
  if (
    !Number.isInteger(decision.projectionPolicyVersion) ||
    decision.projectionPolicyVersion < 1
  ) {
    errors.push("projection_policy_version_invalid");
  }
  if (decision.projection === null && decision.blockReason === null) {
    errors.push("blocked_without_reason");
  }
  if (decision.projection !== null && decision.blockReason !== null) {
    errors.push("projected_with_block_reason");
  }
  if (decision.projection !== null) {
    if (decision.classifiedAt === null) {
      errors.push("classified_at_missing_for_projection");
    }
    if (decision.freshnessMinutes === null) {
      errors.push("freshness_missing_for_projection");
    } else if (
      !Number.isFinite(decision.freshnessMinutes) ||
      decision.freshnessMinutes < 0
    ) {
      errors.push("freshness_invalid_for_projection");
    }
    if (!hasRef(decision.providerRef)) {
      errors.push("provider_ref_missing_for_projection");
    }
    if (!hasRef(decision.purpose)) {
      errors.push("purpose_missing_for_projection");
    }
  }
  if (envelope.data !== null && decision.projection === null) {
    errors.push("data_released_without_projection");
  }
  return { valid: errors.length === 0, errors };
}
