import { describe, expect, it } from "vitest";

import type { CaioAttentionRouteConfig, CaioAttentionRouteRule } from "./contracts";
import { diffCaioAttentionPrefill, resolveCaioAttentionPrefill, validateCaioAttentionOwnerCommand } from "./routing";

const rule: CaioAttentionRouteRule = {
  detectorId: "detector-a", category: "business", primaryRoleKey: "primary_role", primaryFallbackRoleKeys: ["outcome_role"],
  ccRoleKeys: ["cc_role"], escalationRoleKey: "outcome_role", reviewerRoleKey: "outcome_role",
  reviewerFallbackRoleKey: "owner_role", compatibleRuleVersions: ["v1"], committedDue: "suggest",
};
const config: CaioAttentionRouteConfig = {
  roleBindings: {
    primary_role: ["u_primary"], cc_role: ["u_cc"], outcome_role: ["u_outcome"], owner_role: ["u_owner"],
  },
  enterpriseOverrides: {
    "ent-a": { primary_role: ["u_ent_primary"] },
    "ent-none": { primary_role: [] },
  },
};
const activeExcept = (...inactive: string[]) => (id: string) => !inactive.includes(id);
const resolve = (overrides: Partial<Parameters<typeof resolveCaioAttentionPrefill>[0]> = {}) => resolveCaioAttentionPrefill({
  rule, config, enterpriseSlug: null, enterpriseScope: "not_applicable", isActive: activeExcept(), ...overrides,
});

describe("resolveCaioAttentionPrefill", () => {
  it("prefills primary, cc, escalation and one reviewer", () => {
    expect(resolve()).toEqual({
      primaryUserId: "u_primary", ccUserIds: ["u_cc"], escalationUserId: "u_outcome", reviewerUserIds: ["u_outcome"], blocks: [], notes: [],
    });
  });

  it("T-F1: an unavailable primary falls back along the primary chain only; cc is never promoted", () => {
    const prefill = resolve({ isActive: activeExcept("u_primary") });
    expect(prefill.primaryUserId).toBe("u_outcome");
    expect(prefill.ccUserIds).toEqual(["u_cc"]);
    expect(prefill.notes).toEqual([{ kind: "primary_fallback", roleKey: "outcome_role" }]);
    // The fallback holder is now primary, so the reviewer moves to the reviewer fallback role.
    expect(prefill.reviewerUserIds).toEqual(["u_owner"]);

    const exhausted = resolve({ isActive: activeExcept("u_primary", "u_outcome") });
    expect(exhausted.primaryUserId).toBeNull();
    expect(exhausted.blocks).toContain("primary_unavailable");
  });

  it("T-F2: a fallback primary who is also the confirmer blocks routing", () => {
    expect(resolve({ isActive: activeExcept("u_primary"), confirmerUserId: "u_outcome" }).blocks).toEqual(["primary_is_confirmer"]);
  });

  it("T-F3: an unverified enterprise gets no people and cannot be released by manual selection", () => {
    expect(resolve({ enterpriseSlug: "ent-x", enterpriseScope: "unverified" })).toMatchObject({
      primaryUserId: null, reviewerUserIds: [], blocks: ["enterprise_unverified"],
    });
    expect(validateCaioAttentionOwnerCommand({
      command: { primaryUserId: "u_primary", ccUserIds: [], escalationUserId: "u_outcome", reviewerUserIds: ["u_owner"], committedDueAt: new Date() },
      confirmerUserId: "u_owner", enterpriseScope: "unverified", isActive: activeExcept(), canReview: () => true,
    })).toEqual(["enterprise_unverified"]);
  });

  it("applies the four enterprise override states", () => {
    const verified = { enterpriseScope: "verified" as const };
    expect(resolve({ ...verified, enterpriseSlug: "ent-a" }).primaryUserId).toBe("u_ent_primary");
    expect(resolve({ ...verified, enterpriseSlug: "ent-a", isActive: activeExcept("u_ent_primary") }).primaryUserId).toBe("u_primary");
    expect(resolve({ ...verified, enterpriseSlug: "ent-none" }).primaryUserId).toBe("u_outcome");
    expect(resolve({ ...verified, enterpriseSlug: "ent-other" }).primaryUserId).toBe("u_primary");
  });

  it("omits an absent cc with a note and reports missing routes", () => {
    expect(resolve({ isActive: activeExcept("u_cc") })).toMatchObject({ ccUserIds: [], notes: [{ kind: "cc_absent", roleKey: "cc_role" }] });
    expect(resolve({ rule: null }).blocks).toEqual(["route_missing"]);
    expect(resolve({ isActive: activeExcept("u_outcome", "u_owner") }).blocks).toEqual(["escalation_unavailable", "reviewer_unavailable"]);
  });
});

describe("validateCaioAttentionOwnerCommand", () => {
  const command = { primaryUserId: "u_primary", ccUserIds: ["u_cc"], escalationUserId: "u_outcome", reviewerUserIds: ["u_outcome"], committedDueAt: new Date(0) };
  const validate = (overrides: Partial<typeof command> = {}, isActive = activeExcept(), canReview = (id: string) => id !== "u_cc") =>
    validateCaioAttentionOwnerCommand({ command: { ...command, ...overrides }, confirmerUserId: "u_owner", enterpriseScope: "not_applicable", isActive, canReview });

  it("accepts a complete command and rejects each broken field", () => {
    expect(validate()).toEqual([]);
    expect(validate({ primaryUserId: "u_owner" })).toEqual(["primary_is_confirmer"]);
    expect(validate({}, activeExcept("u_primary", "u_cc"))).toEqual(["cc_inactive", "primary_inactive"]);
    expect(validate({ reviewerUserIds: ["u_cc"] })).toEqual(["reviewer_conflict", "reviewer_not_capable"]);
    expect(validate({ reviewerUserIds: [], escalationUserId: null, committedDueAt: null as unknown as Date }))
      .toEqual(["committed_due_missing", "escalation_missing", "reviewer_missing"]);
  });

  it("T-F4: lists the fields the OWNER changed relative to the prefill", () => {
    expect(diffCaioAttentionPrefill(command, { ...command, primaryUserId: "u_other", committedDueAt: new Date(1) }))
      .toEqual(["primaryUserId", "committedDueAt"]);
    expect(diffCaioAttentionPrefill(command, { ...command })).toEqual([]);
  });
});
