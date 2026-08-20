import { afterEach, describe, expect, it } from "vitest";

import {
  composeMemberEvidenceProjectionEnvelope,
  registerMemberEvidenceAuthorizationResolver,
  resetMemberEvidenceAuthorizationResolverForTests,
} from "@/lib/member-gateway/reviewer-evidence-projection.service";
import { validateMemberToolEnvelope } from "@/lib/member-gateway/contract";
import type { MemberEvidenceAuthorizationResolution } from "@/lib/member-gateway/reviewer-evidence-projection.service";

const BASE_INPUT = {
  workspaceId: "workspace-1",
  reviewerMemberRef: "reviewer:user-1",
  evidenceRef: "link-evidence:signal-1:1",
};

function fullyAuthorizedResolution(
  overrides: Partial<MemberEvidenceAuthorizationResolution> = {},
): MemberEvidenceAuthorizationResolution {
  return {
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
    freshnessMinutes: 12,
    providerRef: "provider-profile-1",
    projectionPolicyRef: "projection-policy-1",
    projectionPolicyVersion: 1,
    projectedFields: {
      objectKind: "evidence",
      evidenceRef: BASE_INPUT.evidenceRef,
    },
    ...overrides,
  };
}

describe("composeMemberEvidenceProjectionEnvelope", () => {
  afterEach(() => {
    resetMemberEvidenceAuthorizationResolverForTests();
  });

  it("the default fail-closed resolver denies all seven dimensions with a valid envelope", async () => {
    const { envelope, deniedDimensions } =
      await composeMemberEvidenceProjectionEnvelope(BASE_INPUT);

    expect(envelope.ok).toBe(true);
    expect(envelope.error).toBeNull();
    expect(envelope.data).toBeNull();
    expect(envelope.boundary.authorityEffect).toBe("none");
    expect(envelope.boundary.externalExecutionAllowed).toBe(false);
    expect(envelope.boundary.decision.projection).toBeNull();
    expect(envelope.boundary.decision.blockReason).toBe("read_surface_denied");
    expect(envelope.boundary.decision.projectionPolicyRef).toBe("unresolved");
    expect(envelope.boundary.decision.projectionPolicyVersion).toBe(1);
    expect(deniedDimensions).toEqual([
      "live_membership",
      "tool_scope",
      "object_relationship_authorization",
      "field_purpose_policy",
      "source_authorization",
      "tenant_provider_egress_policy",
      "current_classification",
    ]);
    expect(deniedDimensions).toHaveLength(7);
    expect(validateMemberToolEnvelope(envelope)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("a registered synthetic resolver with full authorization evidence remote_projects and whitelist-filters data", async () => {
    registerMemberEvidenceAuthorizationResolver({
      async resolve() {
        return fullyAuthorizedResolution({
          projectedFields: {
            objectKind: "evidence",
            evidenceRef: BASE_INPUT.evidenceRef,
            // customerName is deliberately NOT in
            // METADATA_ONLY_FIELD_WHITELIST — it must never reach the
            // envelope, even though the resolver offered it and the
            // decision is the wider remote_projected tier.
            customerName: "Acme Corp",
          },
        });
      },
    });

    const { envelope } = await composeMemberEvidenceProjectionEnvelope(BASE_INPUT);

    expect(envelope.boundary.decision.projection).toBe("remote_projected");
    expect(envelope.boundary.decision.blockReason).toBeNull();
    expect(envelope.data).toEqual({
      objectKind: "evidence",
      evidenceRef: BASE_INPUT.evidenceRef,
    });
    expect(envelope.data).not.toHaveProperty("customerName");
    expect(validateMemberToolEnvelope(envelope)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("a local_only disposition downgrades to metadata_only and still whitelist-filters", async () => {
    registerMemberEvidenceAuthorizationResolver({
      async resolve() {
        return fullyAuthorizedResolution({
          classification: {
            sensitivity: "confidential",
            processingDisposition: "local_only",
            classifiedAt: "2026-08-19T00:00:00Z",
          },
          projectedFields: {
            objectKind: "evidence",
            evidenceRef: BASE_INPUT.evidenceRef,
            customerName: "Acme Corp",
          },
        });
      },
    });

    const { envelope } = await composeMemberEvidenceProjectionEnvelope(BASE_INPUT);

    expect(envelope.boundary.decision.projection).toBe("metadata_only");
    expect(envelope.boundary.decision.blockReason).toBeNull();
    expect(envelope.data).toEqual({
      objectKind: "evidence",
      evidenceRef: BASE_INPUT.evidenceRef,
    });
    expect(envelope.data).not.toHaveProperty("customerName");
    expect(validateMemberToolEnvelope(envelope)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("a prohibited disposition blocks as LOCAL_VIEW_REQUIRED with no data", async () => {
    registerMemberEvidenceAuthorizationResolver({
      async resolve() {
        return fullyAuthorizedResolution({
          classification: {
            sensitivity: "restricted",
            processingDisposition: "prohibited",
            classifiedAt: "2026-08-19T00:00:00Z",
          },
        });
      },
    });

    const { envelope, deniedDimensions } =
      await composeMemberEvidenceProjectionEnvelope(BASE_INPUT);

    expect(envelope.boundary.decision.projection).toBeNull();
    expect(envelope.boundary.decision.blockReason).toBe("LOCAL_VIEW_REQUIRED");
    expect(deniedDimensions).toEqual([]);
    expect(envelope.data).toBeNull();
    expect(validateMemberToolEnvelope(envelope)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("resets to the fail-closed default after a synthetic resolver was registered", async () => {
    registerMemberEvidenceAuthorizationResolver({
      async resolve() {
        return fullyAuthorizedResolution();
      },
    });
    resetMemberEvidenceAuthorizationResolverForTests();

    const { envelope } = await composeMemberEvidenceProjectionEnvelope(BASE_INPUT);

    expect(envelope.boundary.decision.blockReason).toBe("read_surface_denied");
  });
});
