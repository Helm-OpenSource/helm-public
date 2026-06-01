import { describe, expect, it } from "vitest";
import { validateDeploymentProfileEnv } from "@/lib/deployment-profile/contract";

describe("deployment profile contract", () => {
  it("defaults to community/global/global/zh-CN without granting boundary authority", () => {
    expect(validateDeploymentProfileEnv({})).toEqual({
      ok: true,
      issues: [],
      profile: {
        releaseProfile: "community",
        deploymentRegion: "global",
        dataResidency: "global",
        defaultLocale: "zh-CN",
        boundaryPosture: {
          licenseBoundary: false,
          securityBoundary: false,
          sourceBoundary: false,
          entitlementBoundary: false,
        },
      },
    });
  });

  it("accepts an explicit China enterprise profile", () => {
    const result = validateDeploymentProfileEnv({
      HELM_RELEASE_PROFILE: "enterprise",
      HELM_DEPLOYMENT_REGION: "cn",
      HELM_DATA_RESIDENCY: "cn",
      HELM_DEFAULT_LOCALE: "zh-CN",
    });

    expect(result.ok).toBe(true);
    expect(result.profile).toMatchObject({
      releaseProfile: "enterprise",
      deploymentRegion: "cn",
      dataResidency: "cn",
      defaultLocale: "zh-CN",
    });
  });

  it("accepts an explicit global cloud profile", () => {
    const result = validateDeploymentProfileEnv({
      HELM_RELEASE_PROFILE: "cloud",
      HELM_DEPLOYMENT_REGION: "global",
      HELM_DATA_RESIDENCY: "global",
      HELM_DEFAULT_LOCALE: "en-US",
    });

    expect(result.ok).toBe(true);
    expect(result.profile).toMatchObject({
      releaseProfile: "cloud",
      deploymentRegion: "global",
      dataResidency: "global",
      defaultLocale: "en-US",
    });
  });

  it("fails closed for unknown profile, region, residency and locale values", () => {
    const result = validateDeploymentProfileEnv({
      HELM_RELEASE_PROFILE: "licensed",
      HELM_DEPLOYMENT_REGION: "mars",
      HELM_DATA_RESIDENCY: "local",
      HELM_DEFAULT_LOCALE: "fr-FR",
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_release_profile" }),
        expect.objectContaining({ code: "invalid_deployment_region" }),
        expect.objectContaining({ code: "invalid_data_residency" }),
        expect.objectContaining({ code: "invalid_default_locale" }),
      ]),
    );
  });

  it("rejects China data residency on a global deployment region", () => {
    const result = validateDeploymentProfileEnv({
      HELM_DEPLOYMENT_REGION: "global",
      HELM_DATA_RESIDENCY: "cn",
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "region_residency_conflict",
        envKey: "HELM_DATA_RESIDENCY",
      }),
    );
  });

  it("rejects global data residency on a China deployment region", () => {
    const result = validateDeploymentProfileEnv({
      HELM_DEPLOYMENT_REGION: "cn",
      HELM_DATA_RESIDENCY: "global",
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "region_residency_conflict",
        envKey: "HELM_DATA_RESIDENCY",
      }),
    );
  });
});
