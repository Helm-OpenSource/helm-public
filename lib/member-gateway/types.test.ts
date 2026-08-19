import { describe, expect, it } from "vitest";

import {
  MEMBER_GATEWAY_L1_TOOLS,
  MEMBER_GATEWAY_PROJECTIONS,
  MEMBER_PROJECTION_BLOCK_REASONS,
  MEMBER_READ_SURFACE_DIMENSIONS,
  METADATA_ONLY_FIELD_WHITELIST,
} from "@/lib/member-gateway/types";
import type { MemberProjectionDecision } from "@/lib/member-gateway/types";

describe("member-gateway frozen literals", () => {
  it("freezes the projection ladder to exactly two levels", () => {
    expect(MEMBER_GATEWAY_PROJECTIONS).toEqual([
      "remote_projected",
      "metadata_only",
    ]);
  });

  it("freezes the seven read-surface dimensions in spec order", () => {
    expect(MEMBER_READ_SURFACE_DIMENSIONS).toEqual([
      "live_membership",
      "tool_scope",
      "object_relationship_authorization",
      "field_purpose_policy",
      "source_authorization",
      "tenant_provider_egress_policy",
      "current_classification",
    ]);
  });

  it("freezes the six L1 tools", () => {
    expect(MEMBER_GATEWAY_L1_TOOLS).toEqual([
      "get_my_brief",
      "ask_caio",
      "get_caio_answer",
      "continue_caio_question",
      "query_evidence",
      "get_context_pack",
    ]);
  });

  it("metadata_only is a whitelist and never includes content fields", () => {
    expect(METADATA_ONLY_FIELD_WHITELIST).toEqual([
      "objectKind",
      "evidenceRef",
      "classifiedAt",
      "freshness",
      "requiresLocalView",
    ]);
    for (const banned of ["title", "body", "customerName", "personName"]) {
      expect(METADATA_ONLY_FIELD_WHITELIST).not.toContain(banned);
    }
  });

  it("freezes the block reasons including LOCAL_VIEW_REQUIRED", () => {
    expect(MEMBER_PROJECTION_BLOCK_REASONS).toContain("LOCAL_VIEW_REQUIRED");
    expect(MEMBER_PROJECTION_BLOCK_REASONS).toContain("read_surface_denied");
    expect(MEMBER_PROJECTION_BLOCK_REASONS).toContain("classification_unknown");
  });

  it("projection decision evidence carries classification freshness", () => {
    const decision: MemberProjectionDecision = {
      projection: "remote_projected",
      projectionPolicyRef: "projection-policy-1",
      projectionPolicyVersion: 1,
      providerRef: "provider-profile-1",
      purpose: "call_preparation",
      classifiedAt: "2026-08-19T00:00:00Z",
      freshnessMinutes: 15,
      deniedFields: [],
      blockReason: null,
    };
    expect(decision.freshnessMinutes).toBe(15);
  });
});
