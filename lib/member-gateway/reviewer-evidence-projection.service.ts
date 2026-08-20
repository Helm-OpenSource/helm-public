import "server-only";

import { randomUUID } from "node:crypto";

import { ActorType } from "@prisma/client";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import { assertWorkspaceGovernedActionReviewServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  decideMemberProjection,
  decideMemberReadSurface,
  validateMemberToolEnvelope,
} from "@/lib/member-gateway/contract";
import type { MemberProjectionInput } from "@/lib/member-gateway/contract";
import {
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type { MemberWorkSignalCandidateArtifact } from "@/lib/member-gateway/signal-candidate";
import {
  METADATA_ONLY_FIELD_WHITELIST,
} from "@/lib/member-gateway/types";
import type {
  MemberGatewayProjection,
  MemberObjectClassification,
  MemberReadSurfaceDimension,
  MemberReadSurfaceInput,
  MemberToolEnvelope,
} from "@/lib/member-gateway/types";
import { jsonStringify } from "@/lib/utils";

// Reviewer per-evidence-ref authorization projection (spec §5.1 ruling 5,
// plan Architecture 1-7: docs/superpowers/plans/
// 2026-08-20-member-gateway-reviewer-evidence-projection.md). When a
// reviewer drills into one opaque relatedEvidenceRef on a member signal
// candidate, this module runs the SAME M1 seven-way read-surface + two-
// level projection judgment used by the WorkBuddy gateway — subject
// swapped to the reviewer — rather than inventing a second authorization
// model. It grants no permission and performs no IO beyond one candidate
// read and one audit write; the resolver port below is the only new
// concept, and it answers no real question in the public core.

const CANDIDATE_EVIDENCE_REVIEW_PURPOSE = "candidate_evidence_review" as const;
const UNRESOLVED_PROJECTION_POLICY_REF = "unresolved" as const;
const EVIDENCE_PROJECTION_REQUESTED_AUDIT_ACTION =
  "MEMBER_SIGNAL_EVIDENCE_PROJECTION_REQUESTED" as const;

export type MemberEvidenceProjectionErrorCode =
  | "candidate_not_found"
  | "candidate_artifact_corrupt"
  | "evidence_ref_not_in_candidate"
  | "evidence_projection_unavailable";

export class MemberEvidenceProjectionError extends Error {
  readonly code: MemberEvidenceProjectionErrorCode;
  readonly reasons: readonly string[];

  constructor(
    code: MemberEvidenceProjectionErrorCode,
    reasons: readonly string[] = [],
  ) {
    super(
      reasons.length > 0
        ? `member_evidence_projection:${code}: ${reasons.join("; ")}`
        : `member_evidence_projection:${code}`,
    );
    this.name = "MemberEvidenceProjectionError";
    this.code = code;
    this.reasons = reasons;
  }
}

function nonEmpty(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MemberEvidenceProjectionError("candidate_not_found");
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Resolver port (plan Architecture 2). The ONLY new concept this module
// contributes: everything else reuses M1's contract.ts judgment verbatim.
// ---------------------------------------------------------------------------

// Evidence per read-surface dimension plus the projection-side evidence
// (classification/freshness/provider/policy identity) and the whitelist-
// eligible field values a real resolver is willing to hand back. Shaped as
// one round trip because a private resolver typically resolves all of this
// from the same tenant authorization store in a single query.
export type MemberEvidenceAuthorizationResolution = {
  liveMembershipRef: string | null;
  toolScopeRef: string | null;
  objectRelationshipAuthorizationRef: string | null;
  fieldPurposePolicyRef: string | null;
  sourceAuthorizationRef: string | null;
  tenantProviderEgressPolicyRef: string | null;
  classification: MemberObjectClassification | null;
  freshnessMinutes: number | null;
  providerRef: string | null;
  projectionPolicyRef: string;
  projectionPolicyVersion: number;
  // Whitelist-eligible field values, consumed only when the projection
  // decision is metadata_only or remote_projected. Not pre-filtered by the
  // resolver — this module is the one place that enforces
  // METADATA_ONLY_FIELD_WHITELIST, so a resolver MAY hand back wider data
  // (e.g. customerName) and trust this module to drop it.
  projectedFields: Readonly<Record<string, unknown>> | null;
};

export type MemberEvidenceAuthorizationResolver = {
  resolve(input: {
    workspaceId: string;
    reviewerMemberRef: string;
    evidenceRef: string;
  }): Promise<MemberEvidenceAuthorizationResolution>;
};

// Default resolver: every dimension null, freshness/provider/classification
// null, projectionPolicyRef pinned to the "unresolved" sentinel, version 1,
// no projected fields. Fed into decideMemberReadSurface this denies all
// seven dimensions — never a partial or default-allow.
//
// This is the design, not a gap. The public core ships no code that can
// answer "does this reviewer's workspace authorize this evidence ref" —
// that answer needs live tenant membership, tool-scope grants, object-
// relationship authorization, field-purpose policy, source authorization,
// provider egress policy, and current classification, none of which belong
// in the public core. A real resolver is a controlled-private-layer
// concern, registered at deployment start-up through
// registerMemberEvidenceAuthorizationResolver below — the same posture
// lib/llm/governed-model-adapter-registry.service.ts takes toward model
// provider adapters. Until one is registered, every reviewer sees a fail-
// closed, deployment-attributed denial, never a silent grant.
const DEFAULT_MEMBER_EVIDENCE_AUTHORIZATION_RESOLVER: MemberEvidenceAuthorizationResolver =
  {
    async resolve() {
      return {
        liveMembershipRef: null,
        toolScopeRef: null,
        objectRelationshipAuthorizationRef: null,
        fieldPurposePolicyRef: null,
        sourceAuthorizationRef: null,
        tenantProviderEgressPolicyRef: null,
        classification: null,
        freshnessMinutes: null,
        providerRef: null,
        projectionPolicyRef: UNRESOLVED_PROJECTION_POLICY_REF,
        projectionPolicyVersion: 1,
        projectedFields: null,
      };
    },
  };

let activeResolver: MemberEvidenceAuthorizationResolver =
  DEFAULT_MEMBER_EVIDENCE_AUTHORIZATION_RESOLVER;

// Deployment-layer registration hook (module-level singleton, same
// registration posture as lib/llm/governed-model-adapter-registry.service.ts).
// Only the controlled private layer should ever call this in production
// start-up code; nothing in the public core does.
export function registerMemberEvidenceAuthorizationResolver(
  resolver: MemberEvidenceAuthorizationResolver,
): void {
  activeResolver = resolver;
}

// Test-only reset back to the fail-closed default. Every test that
// registers a synthetic resolver MUST call this afterward so resolver
// state never leaks across test files.
export function resetMemberEvidenceAuthorizationResolverForTests(): void {
  activeResolver = DEFAULT_MEMBER_EVIDENCE_AUTHORIZATION_RESOLVER;
}

// ---------------------------------------------------------------------------
// Pure(ish) composition: resolver -> decideMemberReadSurface ->
// decideMemberProjection -> whitelist-filtered envelope -> envelope
// validation. No IO beyond the registered resolver's own resolve() call —
// exported separately from the db-bound orchestrator below so unit tests
// can exercise the full judgment/whitelist/envelope-validation path
// against a synthetic resolver without touching the database (the db-bound
// candidate load + capability gate + audit write are covered by the
// lib/member-gateway/*.mysql.test.ts suite instead).
// ---------------------------------------------------------------------------

function whitelistedProjectionData(
  projection: MemberGatewayProjection | null,
  projectedFields: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> | null {
  if (projection === null || projectedFields === null) {
    return null;
  }
  // The public core pins the field surface to METADATA_ONLY_FIELD_WHITELIST
  // for BOTH projection tiers (metadata_only AND remote_projected) — a
  // wider field surface for remote_projected is a private-layer concern
  // and is not expressed here.
  const whitelist = new Set<string>(METADATA_ONLY_FIELD_WHITELIST);
  const filtered: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(projectedFields)) {
    if (whitelist.has(field)) {
      filtered[field] = value;
    }
  }
  return filtered;
}

// The envelope is the frozen M1 wire shape for the WorkBuddy client
// (contract.ts: "the only shape a client ever sees") and MemberProjection
// Decision deliberately carries no per-dimension detail. The reviewer
// panel is a different, internal-only consumer that needs to name which of
// the seven dimensions were denied (spec §5.1 ruling 5 / plan Architecture
// 6) — deniedDimensions is returned as a sibling of the envelope rather
// than folded into it, so the envelope itself never drifts from the M1
// contract shape other tool responses share.
export type MemberEvidenceProjectionResult = {
  envelope: MemberToolEnvelope<Readonly<Record<string, unknown>>>;
  deniedDimensions: readonly MemberReadSurfaceDimension[];
};

export async function composeMemberEvidenceProjectionEnvelope(input: {
  workspaceId: string;
  reviewerMemberRef: string;
  evidenceRef: string;
}): Promise<MemberEvidenceProjectionResult> {
  const resolution = await activeResolver.resolve(input);

  const surfaceInput: MemberReadSurfaceInput = {
    workspaceRef: input.workspaceId,
    memberRef: input.reviewerMemberRef,
    objectRef: input.evidenceRef,
    tool: "query_evidence",
    purpose: CANDIDATE_EVIDENCE_REVIEW_PURPOSE,
    liveMembershipRef: resolution.liveMembershipRef,
    toolScopeRef: resolution.toolScopeRef,
    objectRelationshipAuthorizationRef:
      resolution.objectRelationshipAuthorizationRef,
    fieldPurposePolicyRef: resolution.fieldPurposePolicyRef,
    sourceAuthorizationRef: resolution.sourceAuthorizationRef,
    tenantProviderEgressPolicyRef: resolution.tenantProviderEgressPolicyRef,
    classification: resolution.classification,
  };
  const surface = decideMemberReadSurface(surfaceInput);

  const requestedFields = Object.keys(resolution.projectedFields ?? {});
  const projectionInput: MemberProjectionInput = {
    surface,
    classification: resolution.classification,
    freshnessMinutes: resolution.freshnessMinutes,
    providerRef: resolution.providerRef,
    purpose: CANDIDATE_EVIDENCE_REVIEW_PURPOSE,
    projectionPolicyRef: resolution.projectionPolicyRef,
    projectionPolicyVersion: resolution.projectionPolicyVersion,
    requestedFields,
  };
  const decision = decideMemberProjection(projectionInput);

  const envelope: MemberToolEnvelope<Readonly<Record<string, unknown>>> = {
    ok: true,
    requestId: randomUUID(),
    serverTime: new Date().toISOString(),
    data: whitelistedProjectionData(decision.projection, resolution.projectedFields),
    error: null,
    boundary: {
      authorityEffect: "none",
      externalExecutionAllowed: false,
      decision,
    },
  };

  const validation = validateMemberToolEnvelope(envelope);
  if (!validation.valid) {
    // A decided (even blocked) projection is never a platform fault — only
    // an envelope that fails its own contract validator is. This should be
    // unreachable in practice; treat it as a bug in this module, not a
    // reviewer-facing denial.
    throw new MemberEvidenceProjectionError(
      "evidence_projection_unavailable",
      validation.errors,
    );
  }
  return { envelope, deniedDimensions: surface.deniedDimensions };
}

// ---------------------------------------------------------------------------
// db-bound orchestrator
// ---------------------------------------------------------------------------

// Re-parses and re-validates on every read (module convention shared with
// signal-candidate-review.service.ts: a corrupt or tampered row must never
// be trusted just because it was accepted once at materialization time).
// Deliberately a private, byte-identical copy of the sibling file's
// parseCandidateArtifact rather than an import — that function is not
// exported, and this module's db surface (evidence projection, not review/
// promote CAS transitions) is independent of it.
function parseCandidateArtifact(
  artifactsJson: string,
): MemberWorkSignalCandidateArtifact {
  try {
    const parsed = JSON.parse(
      artifactsJson,
    ) as MemberWorkSignalCandidateArtifact;
    const validation = validateMemberWorkSignalCandidateArtifact(parsed);
    if (!validation.valid) {
      throw new MemberEvidenceProjectionError("candidate_artifact_corrupt");
    }
    return parsed;
  } catch (error) {
    if (error instanceof MemberEvidenceProjectionError) throw error;
    throw new MemberEvidenceProjectionError("candidate_artifact_corrupt");
  }
}

export type ProjectCandidateEvidenceForReviewerInput = {
  workspaceId: string;
  reviewerUserId: string;
  artifactBundleId: string;
  evidenceRef: string;
};

export async function projectCandidateEvidenceForReviewer(
  input: ProjectCandidateEvidenceForReviewerInput,
): Promise<MemberEvidenceProjectionResult> {
  const workspaceId = nonEmpty(input.workspaceId);
  const reviewerUserId = nonEmpty(input.reviewerUserId);
  const artifactBundleId = nonEmpty(input.artifactBundleId);
  const evidenceRef = nonEmpty(input.evidenceRef);

  await assertWorkspaceGovernedActionReviewServiceAccess({
    workspaceId,
    userId: reviewerUserId,
    actorType: ActorType.USER,
    english: false,
  });

  // Type-pinned finder: discrimination is artifactType + reviewPosture +
  // systemOfRecordWrite:false (same convention as
  // findMemberSignalCandidateBundle in signal-candidate-review.service.ts;
  // duplicated rather than imported because that finder also loads the
  // artifactReview relation this module never needs).
  const bundle = await db.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
  });
  if (!bundle) {
    throw new MemberEvidenceProjectionError("candidate_not_found");
  }
  const artifact = parseCandidateArtifact(bundle.artifactsJson);

  // The reviewer surface must never become a probe for an arbitrary
  // evidenceRef: the ref under review has to actually belong to this
  // candidate, either as a related-evidence citation or a de-linked
  // [link-evidence:N] token.
  const belongsToCandidate =
    artifact.relatedEvidenceRefs.includes(evidenceRef) ||
    artifact.linkEvidence.some((entry) => entry.evidenceRef === evidenceRef);
  if (!belongsToCandidate) {
    throw new MemberEvidenceProjectionError("evidence_ref_not_in_candidate");
  }

  // The reviewer is an internal Helm workspace user reviewing an untrusted
  // member-upstream candidate — not a WorkBuddy member session, so there is
  // no existing session-bound MemberPrincipal.memberRef to reuse for them.
  // We deterministically derive a stable principal-side ref from their
  // workspace user id, namespaced so it can never collide with a real
  // WorkBuddy memberRef (which this module never sees or needs to).
  const reviewerMemberRef = `reviewer:${reviewerUserId}`;

  const result = await composeMemberEvidenceProjectionEnvelope({
    workspaceId,
    reviewerMemberRef,
    evidenceRef,
  });

  const trace = getCurrentAuditTraceContext();
  await db.auditLog.create({
    data: {
      workspaceId,
      userId: reviewerUserId,
      actor: reviewerUserId,
      actorType: ActorType.USER,
      actionType: EVIDENCE_PROJECTION_REQUESTED_AUDIT_ACTION,
      targetType: "ArtifactBundle",
      targetId: artifactBundleId,
      summary:
        "A reviewer requested an authorization projection for one candidate evidence ref.",
      // Field VALUES are never audited — only the evidenceRef identifier
      // and the projection/blockReason judgment outcome.
      payload: jsonStringify({
        evidenceRef,
        projection: result.envelope.boundary.decision.projection,
        blockReason: result.envelope.boundary.decision.blockReason,
        deniedDimensions: result.deniedDimensions,
      }),
      traceId: trace?.traceId,
      requestId: trace?.requestId,
      parentEventId: trace?.parentEventId ?? undefined,
    },
  });

  return result;
}
