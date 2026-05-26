import { supportedUiLocales, type UiLocale } from "@/lib/i18n/config";

export const helmReleaseProfiles = ["community", "enterprise", "cloud", "opc"] as const;
export type HelmReleaseProfile = (typeof helmReleaseProfiles)[number];

export const helmDeploymentRegions = ["cn", "global"] as const;
export type HelmDeploymentRegion = (typeof helmDeploymentRegions)[number];

export const helmDataResidencyModes = ["cn", "global"] as const;
export type HelmDataResidencyMode = (typeof helmDataResidencyModes)[number];

export type DeploymentProfileEnvInput = {
  HELM_RELEASE_PROFILE?: string | null;
  HELM_DEPLOYMENT_REGION?: string | null;
  HELM_DATA_RESIDENCY?: string | null;
  HELM_DEFAULT_LOCALE?: string | null;
};

export type DeploymentProfile = {
  releaseProfile: HelmReleaseProfile;
  deploymentRegion: HelmDeploymentRegion;
  // Declarative deployment hint only. Region/residency validation prevents
  // typoed profiles; actual data isolation belongs to the Cloud control plane.
  dataResidency: HelmDataResidencyMode;
  defaultLocale: UiLocale;
  boundaryPosture: {
    licenseBoundary: false;
    securityBoundary: false;
    sourceBoundary: false;
    entitlementBoundary: false;
  };
};

export type DeploymentProfileValidationIssue = {
  code:
    | "invalid_data_residency"
    | "invalid_default_locale"
    | "invalid_deployment_region"
    | "invalid_release_profile"
    | "region_residency_conflict";
  envKey: keyof DeploymentProfileEnvInput;
  message: string;
};

export type DeploymentProfileValidationResult = {
  ok: boolean;
  profile: DeploymentProfile;
  issues: DeploymentProfileValidationIssue[];
};

const defaultDeploymentProfile: DeploymentProfile = {
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
};

function normalizeOptionalEnv(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function exactUiLocale(value?: string | null): UiLocale | null {
  return typeof value === "string" && supportedUiLocales.includes(value as UiLocale)
    ? (value as UiLocale)
    : null;
}

function normalizeReleaseProfile(value?: string | null): HelmReleaseProfile | null {
  const normalized = normalizeOptionalEnv(value);
  if (!normalized) return defaultDeploymentProfile.releaseProfile;
  return helmReleaseProfiles.includes(normalized as HelmReleaseProfile)
    ? (normalized as HelmReleaseProfile)
    : null;
}

function normalizeDeploymentRegion(value?: string | null): HelmDeploymentRegion | null {
  const normalized = normalizeOptionalEnv(value);
  if (!normalized) return defaultDeploymentProfile.deploymentRegion;
  return helmDeploymentRegions.includes(normalized as HelmDeploymentRegion)
    ? (normalized as HelmDeploymentRegion)
    : null;
}

function normalizeDataResidency(value?: string | null): HelmDataResidencyMode | null {
  const normalized = normalizeOptionalEnv(value);
  if (!normalized) return defaultDeploymentProfile.dataResidency;
  return helmDataResidencyModes.includes(normalized as HelmDataResidencyMode)
    ? (normalized as HelmDataResidencyMode)
    : null;
}

function normalizeDefaultLocale(value?: string | null): UiLocale | null {
  const trimmed = value?.trim();
  if (!trimmed) return defaultDeploymentProfile.defaultLocale;
  return exactUiLocale(trimmed);
}

export function validateDeploymentProfileEnv(
  env: DeploymentProfileEnvInput,
): DeploymentProfileValidationResult {
  const issues: DeploymentProfileValidationIssue[] = [];
  const releaseProfile = normalizeReleaseProfile(env.HELM_RELEASE_PROFILE);
  const deploymentRegion = normalizeDeploymentRegion(env.HELM_DEPLOYMENT_REGION);
  const dataResidency = normalizeDataResidency(env.HELM_DATA_RESIDENCY);
  const defaultLocale = normalizeDefaultLocale(env.HELM_DEFAULT_LOCALE);

  if (!releaseProfile) {
    issues.push({
      code: "invalid_release_profile",
      envKey: "HELM_RELEASE_PROFILE",
      message:
        "HELM_RELEASE_PROFILE must be community, enterprise, cloud or opc.",
    });
  }

  if (!deploymentRegion) {
    issues.push({
      code: "invalid_deployment_region",
      envKey: "HELM_DEPLOYMENT_REGION",
      message: "HELM_DEPLOYMENT_REGION must be cn or global.",
    });
  }

  if (!dataResidency) {
    issues.push({
      code: "invalid_data_residency",
      envKey: "HELM_DATA_RESIDENCY",
      message: "HELM_DATA_RESIDENCY must be cn or global.",
    });
  }

  if (!defaultLocale) {
    issues.push({
      code: "invalid_default_locale",
      envKey: "HELM_DEFAULT_LOCALE",
      message: "HELM_DEFAULT_LOCALE must be zh-CN or en-US.",
    });
  }

  if (deploymentRegion === "global" && dataResidency === "cn") {
    issues.push({
      code: "region_residency_conflict",
      envKey: "HELM_DATA_RESIDENCY",
      message:
        "HELM_DATA_RESIDENCY=cn requires HELM_DEPLOYMENT_REGION=cn.",
    });
  }

  if (deploymentRegion === "cn" && dataResidency === "global") {
    issues.push({
      code: "region_residency_conflict",
      envKey: "HELM_DATA_RESIDENCY",
      message:
        "HELM_DEPLOYMENT_REGION=cn requires HELM_DATA_RESIDENCY=cn.",
    });
  }

  return {
    ok: issues.length === 0,
    profile: {
      releaseProfile: releaseProfile ?? defaultDeploymentProfile.releaseProfile,
      deploymentRegion: deploymentRegion ?? defaultDeploymentProfile.deploymentRegion,
      dataResidency: dataResidency ?? defaultDeploymentProfile.dataResidency,
      defaultLocale: defaultLocale ?? defaultDeploymentProfile.defaultLocale,
      boundaryPosture: defaultDeploymentProfile.boundaryPosture,
    },
    issues,
  };
}
