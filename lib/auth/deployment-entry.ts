export const DEPLOYMENT_ENTRY_PROFILES = [
  "public",
  "cloud",
  "tenant",
  "first-party",
] as const;

export type DeploymentEntryProfile = (typeof DEPLOYMENT_ENTRY_PROFILES)[number];

type DeploymentEntryEnvironment = Partial<
  Record<
    | "HELM_DEPLOYMENT_ENTRY_PROFILE"
    | "HELM_DEPLOYMENT_ENTRY_DISPLAY_NAME"
    | "HELM_DEPLOYMENT_ENTRY_COMPANY_NAME"
    | "HELM_DEPLOYMENT_ENTRY_HOME_PATH"
    | "HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS"
    | "HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SYSTEM_KEYS"
    | "HELM_DEPLOYMENT_SELF_SERVE_SIGNUP",
    string | undefined
  >
>;

export type DeploymentWorkspaceIdentity = {
  slug: string;
  systemKey?: string | null;
};

export type DeploymentMembership = {
  workspace: DeploymentWorkspaceIdentity;
};

export type DeploymentEntryConfig = {
  profile: DeploymentEntryProfile;
  profileConfigured: boolean;
  configurationValid: boolean;
  displayName: string;
  companyName: string | null;
  homePath: string | null;
  allowedWorkspaceSlugs: ReadonlySet<string>;
  allowedWorkspaceSystemKeys: ReadonlySet<string>;
  selfServeSignupEnabled: boolean;
  requiresWorkspaceAllowlist: boolean;
};

function normalizeProfile(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return {
      profile: "public" as const,
      profileConfigured: false,
      valid: true,
    };
  }

  if ((DEPLOYMENT_ENTRY_PROFILES as readonly string[]).includes(normalized)) {
    return {
      profile: normalized as DeploymentEntryProfile,
      profileConfigured: true,
      valid: true,
    };
  }

  return {
    profile: "tenant" as const,
    profileConfigured: true,
    valid: false,
  };
}

function parseCsvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 100),
  );
}

function normalizeDisplayName(value: string | undefined, profile: DeploymentEntryProfile) {
  const normalized = value?.trim().slice(0, 80);
  if (normalized) {
    return normalized;
  }

  return profile === "cloud" ? "Helm Cloud" : "Helm";
}

function normalizeCompanyName(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return {
      companyName: null,
      valid: true,
    };
  }

  if (normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return {
      companyName: null,
      valid: false,
    };
  }

  return {
    companyName: normalized,
    valid: true,
  };
}

export function normalizeDeploymentHomePath(value: string | undefined) {
  const normalized = value?.trim();
  if (
    !normalized ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.includes("://")
  ) {
    return null;
  }

  try {
    const parsed = new URL(normalized, "https://deployment.invalid");
    if (parsed.origin !== "https://deployment.invalid") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolveDeploymentEntryConfig(
  environment: DeploymentEntryEnvironment = process.env as DeploymentEntryEnvironment,
): DeploymentEntryConfig {
  const profileResult = normalizeProfile(environment.HELM_DEPLOYMENT_ENTRY_PROFILE);
  const allowedWorkspaceSlugs = parseCsvSet(
    environment.HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS,
  );
  const allowedWorkspaceSystemKeys = parseCsvSet(
    environment.HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SYSTEM_KEYS,
  );
  const requiresWorkspaceAllowlist =
    profileResult.profile === "tenant" || profileResult.profile === "first-party";
  const companyResult = normalizeCompanyName(
    environment.HELM_DEPLOYMENT_ENTRY_COMPANY_NAME,
  );
  const hasWorkspaceAllowlist =
    allowedWorkspaceSlugs.size > 0 || allowedWorkspaceSystemKeys.size > 0;
  const homePath = normalizeDeploymentHomePath(
    environment.HELM_DEPLOYMENT_ENTRY_HOME_PATH,
  );
  const requiresHomePath = profileResult.profile !== "public";
  const requestedSelfServeSignup =
    environment.HELM_DEPLOYMENT_SELF_SERVE_SIGNUP?.trim().toLowerCase();
  const profileAllowsSelfServeSignup =
    profileResult.profile === "public" || profileResult.profile === "cloud";
  const selfServeSignupEnabled =
    profileAllowsSelfServeSignup &&
    (requestedSelfServeSignup === undefined ||
      requestedSelfServeSignup === "" ||
      requestedSelfServeSignup === "true");

  return {
    profile: profileResult.profile,
    profileConfigured: profileResult.profileConfigured,
    configurationValid:
      profileResult.valid &&
      companyResult.valid &&
      (!requiresWorkspaceAllowlist || hasWorkspaceAllowlist) &&
      (!requiresHomePath || homePath !== null),
    displayName: normalizeDisplayName(
      environment.HELM_DEPLOYMENT_ENTRY_DISPLAY_NAME,
      profileResult.profile,
    ),
    companyName: companyResult.companyName,
    homePath,
    allowedWorkspaceSlugs,
    allowedWorkspaceSystemKeys,
    selfServeSignupEnabled,
    requiresWorkspaceAllowlist,
  };
}

export function isWorkspaceAllowedForDeployment(
  workspace: DeploymentWorkspaceIdentity,
  config = resolveDeploymentEntryConfig(),
) {
  if (!config.configurationValid) {
    return false;
  }

  const hasAllowlist =
    config.allowedWorkspaceSlugs.size > 0 ||
    config.allowedWorkspaceSystemKeys.size > 0;
  if (!hasAllowlist) {
    return !config.requiresWorkspaceAllowlist;
  }

  const slug = workspace.slug.trim().toLowerCase();
  const systemKey = workspace.systemKey?.trim().toLowerCase() ?? "";
  return (
    config.allowedWorkspaceSlugs.has(slug) ||
    (systemKey.length > 0 && config.allowedWorkspaceSystemKeys.has(systemKey))
  );
}

export function filterDeploymentMemberships<T extends DeploymentMembership>(
  memberships: T[],
  config = resolveDeploymentEntryConfig(),
) {
  return memberships.filter((membership) =>
    isWorkspaceAllowedForDeployment(membership.workspace, config),
  );
}

export function resolveDeploymentPostLoginPath(
  fallbackPath: string,
  config = resolveDeploymentEntryConfig(),
) {
  if (
    config.configurationValid &&
    config.profile !== "public" &&
    config.homePath
  ) {
    return config.homePath;
  }

  return fallbackPath;
}
