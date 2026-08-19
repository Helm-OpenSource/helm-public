// Member Gateway contract types — the client-neutral tool surface between
// employee agent clients (Tencent WorkBuddy is the first reference client)
// and Helm CAIO.
// Design truth: docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md
//
// Frozen boundary: this module defines contracts and deterministic judgment
// inputs only. It grants no permission, performs no IO, and — like
// dispatchTargetCategories in lib/caio-governance — keeps Work Packet
// dispatch schema-inexpressible: no object kind, payload field, or submit
// action for dispatch exists here.

import type { DataAssetProcessingDisposition } from "@/lib/stage1-owner-loop/data-asset-catalog.types";
import type { ObservationSensitivity } from "@/lib/stage1-owner-loop/types";

export const MEMBER_GATEWAY_PROJECTIONS = [
  "remote_projected",
  "metadata_only",
] as const;

export type MemberGatewayProjection =
  (typeof MEMBER_GATEWAY_PROJECTIONS)[number];

export const MEMBER_GATEWAY_L1_TOOLS = [
  "get_my_brief",
  "ask_caio",
  "get_caio_answer",
  "continue_caio_question",
  "query_evidence",
  "get_context_pack",
] as const;

export type MemberGatewayL1Tool = (typeof MEMBER_GATEWAY_L1_TOOLS)[number];

// The member principal. A workspace member session plus a registered device
// and clientId. WorkspaceRole.OWNER can never prove CEO identity; the CEO
// principal binding is a private-overlay concern and is not expressible in
// this contract.
export type MemberPrincipal = {
  workspaceRef: string;
  memberRef: string;
  sessionRef: string;
  deviceRegistrationRef: string;
  clientId: string;
};

// Seven-way effective read surface (spec §8.1, frozen intersection). Every
// dimension must present explicit evidence per object per call; a missing
// dimension is a denial, never a default-allow. "Related to me" is a display
// concept, not an authorization basis.
export const MEMBER_READ_SURFACE_DIMENSIONS = [
  "live_membership",
  "tool_scope",
  "object_relationship_authorization",
  "field_purpose_policy",
  "source_authorization",
  "tenant_provider_egress_policy",
  "current_classification",
] as const;

export type MemberReadSurfaceDimension =
  (typeof MEMBER_READ_SURFACE_DIMENSIONS)[number];

export type MemberObjectClassification = {
  sensitivity: ObservationSensitivity;
  processingDisposition: DataAssetProcessingDisposition;
  classifiedAt: string;
};

export type MemberReadSurfaceInput = {
  workspaceRef: string;
  memberRef: string;
  objectRef: string;
  tool: MemberGatewayL1Tool;
  purpose: string;
  // Evidence per dimension: an authorization ref, or null when absent.
  liveMembershipRef: string | null;
  toolScopeRef: string | null;
  objectRelationshipAuthorizationRef: string | null;
  fieldPurposePolicyRef: string | null;
  sourceAuthorizationRef: string | null;
  tenantProviderEgressPolicyRef: string | null;
  // null means unclassified; judgment treats it as restricted + local_only
  // and blocks (spec §8.1).
  classification: MemberObjectClassification | null;
};

export type MemberReadSurfaceDecision =
  | { allowed: true; deniedDimensions: readonly [] }
  | {
      allowed: false;
      deniedDimensions: readonly [
        MemberReadSurfaceDimension,
        ...MemberReadSurfaceDimension[],
      ];
    };

// metadata_only is a field WHITELIST, not "everything except the body":
// object existence, customer/project names, and person relationships leak.
export const METADATA_ONLY_FIELD_WHITELIST = [
  "objectKind",
  "evidenceRef",
  "classifiedAt",
  // Projected-object field, distinct from the decision-evidence
  // freshnessMinutes on MemberProjectionDecision.
  "freshness",
  "requiresLocalView",
] as const;

export type MetadataOnlyField = (typeof METADATA_ONLY_FIELD_WHITELIST)[number];

export const MEMBER_PROJECTION_BLOCK_REASONS = [
  // SCREAMING_CASE is intentional: the design spec names this literal
  // (§8.2), and the CEO-loop gateway already returns it verbatim.
  "LOCAL_VIEW_REQUIRED",
  "read_surface_denied",
  "classification_unknown",
  "provider_not_approved",
  "purpose_missing",
] as const;

export type MemberProjectionBlockReason =
  (typeof MEMBER_PROJECTION_BLOCK_REASONS)[number];

// Projection decision evidence carried on every envelope (spec §8.2).
export type MemberProjectionDecision = {
  projection: MemberGatewayProjection | null;
  projectionPolicyRef: string;
  projectionPolicyVersion: number;
  providerRef: string;
  purpose: string;
  classifiedAt: string | null;
  // Age of the classification at decision time, computed by the producer;
  // null when classification is absent.
  freshnessMinutes: number | null;
  deniedFields: readonly string[];
  blockReason: MemberProjectionBlockReason | null;
};

export type MemberToolBoundary = {
  authorityEffect: "none";
  externalExecutionAllowed: false;
  decision: MemberProjectionDecision;
};

export type MemberToolEnvelope<T> = {
  ok: boolean;
  requestId: string;
  serverTime: string;
  data: T | null;
  error: null | { code: string; message: string; retryable: boolean };
  boundary: MemberToolBoundary;
};
