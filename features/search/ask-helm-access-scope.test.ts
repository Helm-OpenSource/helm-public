import { describe, expect, it } from "vitest";
import { resolveAskHelmAccessScope } from "@/features/search/ask-helm-access-scope";

describe("Ask Helm access scope", () => {
  it("allows members to ask within current workspace read scope", () => {
    const scope = resolveAskHelmAccessScope({
      hasWorkspaceMembership: true,
      membershipRole: "member",
      enabledTenantExtensions: ["bi-report"],
      requestedHelpTopics: ["memory", "approvals"],
    });

    expect(scope.canAsk).toBe(true);
    expect(scope.objectReadScope).toBe("current_workspace");
    expect(scope.allowedHelpPages).toContain("/memory");
    expect(scope.allowedHelpPages).toContain("/approvals");
    expect(scope.retrievalSourcePolicy.objectSearch).toBe("current_workspace_only");
    expect(scope.retrievalSourcePolicy.officialWritePath).toBe("denied");
    expect(scope.featureAvailability.enabledFeatures).toContain(
      "tenant_extension:bi-report",
    );
  });

  it("denies all retrieval sources without workspace membership", () => {
    const scope = resolveAskHelmAccessScope({
      hasWorkspaceMembership: false,
      requestedHelpTopics: ["memory"],
    });

    expect(scope.canAsk).toBe(false);
    expect(scope.objectReadScope).toBe("none");
    expect(scope.allowedHelpPages).toEqual([]);
    expect(scope.retrievalSourcePolicy).toEqual({
      objectSearch: "denied",
      memorySummary: "denied",
      workspaceContext: "denied",
      knowledgePack: "denied",
      officialWritePath: "denied",
    });
  });

  it("keeps reserved and high-risk help topics denied even when requested", () => {
    const scope = resolveAskHelmAccessScope({
      hasWorkspaceMembership: true,
      enabledFeatures: ["reserved_internal_truth", "payment_execution"],
      requestedHelpTopics: [
        "reserved_internal_truth",
        "settlement",
        "payment_execution",
        "official_write",
      ],
    });

    expect(scope.featureAvailability.enabledFeatures).not.toContain(
      "reserved_internal_truth",
    );
    expect(scope.featureAvailability.enabledFeatures).not.toContain(
      "payment_execution",
    );
    expect(scope.deniedHelpTopics).toEqual(
      expect.arrayContaining([
        "official_write",
        "payment_execution",
        "reserved_internal_truth",
        "settlement",
      ]),
    );
    expect(scope.featureAvailability.disabledFeatures).toContain(
      "reserved_internal_truth",
    );
  });
});
