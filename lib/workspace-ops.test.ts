import { describe, expect, it } from "vitest";
import {
  normalizeWorkspaceUiConfig,
  parseWorkspaceFeatureFlags,
} from "@/lib/workspace-ops";

describe("workspace ops", () => {
  it("resolves workspace UI locale through request, workspace and deployment defaults", () => {
    expect(
      normalizeWorkspaceUiConfig({
        requestLocale: "en-US",
        defaultLocale: "zh-CN",
        deploymentProfileDefaultLocale: "zh-CN",
      }).locale,
    ).toBe("en-US");

    expect(
      normalizeWorkspaceUiConfig({
        requestLocale: "fr-FR",
        defaultLocale: "en-US",
        deploymentProfileDefaultLocale: "zh-CN",
      }).locale,
    ).toBe("en-US");

    expect(
      normalizeWorkspaceUiConfig({
        requestLocale: "fr-FR",
        defaultLocale: "unknown",
        deploymentProfileDefaultLocale: "en-US",
      }).locale,
    ).toBe("en-US");
  });

  it("keeps existing workspace UI defaults stable", () => {
    expect(normalizeWorkspaceUiConfig({})).toMatchObject({
      locale: "zh-CN",
      pilotMode: true,
      captureConsentRequired: true,
      dataRetentionDays: 90,
      demoMode: null,
    });
  });

  it("parses feature flag overrides without disabling unspecified defaults", () => {
    expect(
      parseWorkspaceFeatureFlags(
        JSON.stringify({
          multilingualUi: false,
          swarmReadOnlyWorkers: true,
        }),
      ),
    ).toMatchObject({
      multilingualUi: false,
      diagnosticsCenter: true,
      swarmReadOnlyWorkers: true,
    });
  });
});
