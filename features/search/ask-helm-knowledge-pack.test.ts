import { describe, expect, it } from "vitest";
import {
  ASK_HELM_REQUIRED_KNOWLEDGE_PAGES,
  loadAskHelmKnowledgePack,
  validateAskHelmKnowledgePack,
} from "@/features/search/ask-helm-knowledge-pack";

describe("Ask Helm knowledge pack", () => {
  it("covers the required first-pass pages with explicit responsibilities", () => {
    const pack = loadAskHelmKnowledgePack();

    for (const pagePath of ASK_HELM_REQUIRED_KNOWLEDGE_PAGES) {
      const responsibility = pack.pageResponsibilities[pagePath];
      expect(responsibility).toBeDefined();
      expect(responsibility.primaryPurpose).not.toEqual("");
      expect(responsibility.whatItHandles.length).toBeGreaterThan(0);
      expect(responsibility.whatItDoesntHandle.length).toBeGreaterThan(0);
      expect(responsibility.canonicalFor.length).toBeGreaterThan(0);
    }
  });

  it("merges workspace feature availability without enabling unsafe capabilities", () => {
    const pack = loadAskHelmKnowledgePack({
      enabledTenantExtensions: ["bi-report", "customer-success"],
      enabledFeatures: ["custom_help:renewal", "auto_send"],
      disabledFeatures: ["settlement_help"],
      membershipRole: "owner",
      workspaceProfileType: "controlled_trial",
      focusAreas: ["renewal", "delivery"],
    });

    expect(pack.featureAvailability.enabledTenantExtensions).toEqual([
      "bi-report",
      "customer-success",
    ]);
    expect(pack.featureAvailability.enabledFeatures).toContain("custom_help:renewal");
    expect(pack.featureAvailability.enabledFeatures).toContain(
      "tenant_extension:bi-report",
    );
    expect(pack.featureAvailability.enabledFeatures).not.toContain("auto_send");
    expect(pack.featureAvailability.disabledFeatures).toContain("auto_send");
    expect(pack.featureAvailability.disabledFeatures).toContain("reserved_internal_truth");
    expect(pack.featureAvailability.disabledFeatures).toContain("settlement_help");
    expect(pack.featureAvailability.membershipRole).toBe("owner");
    expect(pack.featureAvailability.workspaceProfileType).toBe("controlled_trial");
    expect(pack.featureAvailability.focusAreas).toEqual(["delivery", "renewal"]);
  });

  it("validates the structured pack without relying on raw docs", () => {
    const validation = validateAskHelmKnowledgePack(loadAskHelmKnowledgePack());

    expect(validation.ok).toBe(true);
    expect(validation.failures).toEqual([]);
    expect(validation.requiredPages).toEqual([...ASK_HELM_REQUIRED_KNOWLEDGE_PAGES]);
    expect(validation.coveredPages.length).toBeGreaterThanOrEqual(5);
    expect(validation.enabledFeatureCount).toBeGreaterThan(0);
    expect(validation.disabledFeatureCount).toBeGreaterThan(0);
  });
});
