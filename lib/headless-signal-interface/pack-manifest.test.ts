import { describe, expect, it } from "vitest";
import caseManagementSampleManifest from "@/extensions/case-management-sample/hsi-pack.manifest.json";
import {
  HSI_FORBIDDEN_FACADES,
  HSI_ALLOWED_FACADES,
  HSI_SIGNAL_FAMILIES,
  NON_SALESFORCE_SOURCE_KINDS,
  validateHsiPackManifest,
  type HsiPackManifest,
} from "./pack-manifest";

function baseManifest(overrides: Partial<HsiPackManifest> = {}): HsiPackManifest {
  return {
    packId: "test-pack",
    displayName: "Test Pack",
    verticalKind: "test_vertical",
    sourceKinds: ["case_system"],
    signalFamilies: ["commitment_missing"],
    reviewSurfaces: ["review_packet"],
    ownerRole: "delivery_engineering",
    dataPosture: "synthetic",
    redactionOwner: "delivery_engineer_side",
    nonProductionOnly: true,
    ...overrides,
  };
}

describe("HSI pack manifest — well-formed cases", () => {
  it("accepts a minimal valid manifest", () => {
    expect(validateHsiPackManifest(baseManifest())).toEqual([]);
  });

  it("accepts helm-side redaction when DP review ref is present", () => {
    const violations = validateHsiPackManifest(
      baseManifest({
        redactionOwner: "helm_side_with_dp_review",
        dataProtectionReviewRef: "docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md",
      }),
    );
    expect(violations).toEqual([]);
  });

  it("accepts nonProductionOnly=false when a DP review ref is attached", () => {
    const violations = validateHsiPackManifest(
      baseManifest({
        nonProductionOnly: false,
        dataProtectionReviewRef: "docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md",
      }),
    );
    expect(violations).toEqual([]);
  });
});

describe("HSI pack manifest — violation codes", () => {
  it("flags missing source kinds", () => {
    expect(validateHsiPackManifest(baseManifest({ sourceKinds: [] }))).toContain(
      "manifest_missing_source_kinds",
    );
  });

  it("flags missing signal families", () => {
    expect(validateHsiPackManifest(baseManifest({ signalFamilies: [] }))).toContain(
      "manifest_missing_signal_families",
    );
  });

  it("flags missing review surfaces", () => {
    expect(validateHsiPackManifest(baseManifest({ reviewSurfaces: [] }))).toContain(
      "manifest_missing_review_surfaces",
    );
  });

  it("flags unknown signal family", () => {
    const violations = validateHsiPackManifest(
      // The cast is intentional — this test simulates a manifest
      // that was hand-edited to inject an off-list family.
      baseManifest({
        signalFamilies: ["bogus_family" as never],
      }),
    );
    expect(violations).toContain("manifest_unknown_signal_family:bogus_family");
  });

  it("flags unknown source kind", () => {
    const violations = validateHsiPackManifest(
      baseManifest({
        sourceKinds: ["bogus_source" as never],
      }),
    );
    expect(violations).toContain("manifest_unknown_source_kind:bogus_source");
  });

  it("flags helm-side redaction without DP review ref", () => {
    const violations = validateHsiPackManifest(
      baseManifest({ redactionOwner: "helm_side_with_dp_review" }),
    );
    expect(violations).toContain(
      "manifest_helm_side_redaction_missing_dp_review_ref",
    );
  });

  it("flags nonProductionOnly flipped to false without DP review ref", () => {
    const violations = validateHsiPackManifest(
      baseManifest({ nonProductionOnly: false }),
    );
    expect(violations).toContain(
      "manifest_production_flagged_without_dp_review_ref",
    );
  });
});

describe("HSI pack manifest — case-management-sample conformance", () => {
  it("the checked-in extensions/case-management-sample manifest validates clean", () => {
    const manifest = caseManagementSampleManifest as unknown as HsiPackManifest;
    expect(validateHsiPackManifest(manifest)).toEqual([]);
    expect(manifest.packId).toBe("case-management-sample");
    expect(manifest.nonProductionOnly).toBe(true);
  });

  it("declares only non-Salesforce source kinds (Phase 1 minimum)", () => {
    const manifest = caseManagementSampleManifest as unknown as HsiPackManifest;
    for (const kind of manifest.sourceKinds) {
      expect(NON_SALESFORCE_SOURCE_KINDS.has(kind)).toBe(true);
    }
  });

  it("covers all six required signal families", () => {
    const manifest = caseManagementSampleManifest as unknown as HsiPackManifest;
    for (const family of HSI_SIGNAL_FAMILIES) {
      expect(manifest.signalFamilies).toContain(family);
    }
  });
});

describe("HSI policy constants — internal consistency", () => {
  it("allowed and forbidden facade sets are disjoint", () => {
    for (const allowed of HSI_ALLOWED_FACADES) {
      expect(HSI_FORBIDDEN_FACADES).not.toContain(allowed);
    }
  });

  it("non-Salesforce set never includes salesforce", () => {
    expect(NON_SALESFORCE_SOURCE_KINDS.has("salesforce" as never)).toBe(false);
  });
});
