import { describe, expect, it } from "vitest";
import {
  resolveWorkspaceDefaultLandingPath,
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

  it("controlTowerHome only accepts literal true (rollback invariant)", () => {
    expect(parseWorkspaceFeatureFlags(null).controlTowerHome).toBe(false);
    expect(
      parseWorkspaceFeatureFlags(JSON.stringify({ controlTowerHome: true }))
        .controlTowerHome,
    ).toBe(true);
    for (const bad of ["true", 1, "yes", {}, [], "false", 0, null]) {
      expect(
        parseWorkspaceFeatureFlags(JSON.stringify({ controlTowerHome: bad }))
          .controlTowerHome,
      ).toBe(false);
    }
    expect(parseWorkspaceFeatureFlags("not-json").controlTowerHome).toBe(false);
  });
});

describe("resolveWorkspaceDefaultLandingPath", () => {
  it("returns a valid internal path", () => {
    expect(resolveWorkspaceDefaultLandingPath(JSON.stringify({ defaultLandingPath: "/tenant-os/home" }))).toBe("/tenant-os/home");
  });
  it("rejects external / malformed / self-loop targets", () => {
    expect(resolveWorkspaceDefaultLandingPath(JSON.stringify({ defaultLandingPath: "https://evil.example" }))).toBeNull();
    expect(resolveWorkspaceDefaultLandingPath(JSON.stringify({ defaultLandingPath: "//evil.example" }))).toBeNull();
    expect(resolveWorkspaceDefaultLandingPath(JSON.stringify({ defaultLandingPath: "javascript:alert(1)" }))).toBeNull();
    expect(resolveWorkspaceDefaultLandingPath(JSON.stringify({ defaultLandingPath: "/dashboard" }))).toBeNull();
    expect(resolveWorkspaceDefaultLandingPath(JSON.stringify({ defaultLandingPath: 42 }))).toBeNull();
    expect(resolveWorkspaceDefaultLandingPath(null)).toBeNull();
    expect(resolveWorkspaceDefaultLandingPath("not-json")).toBeNull();
  });
});
