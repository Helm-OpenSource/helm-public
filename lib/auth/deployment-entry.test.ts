import { describe, expect, it } from "vitest";
import {
  filterDeploymentMemberships,
  isWorkspaceAllowedForDeployment,
  normalizeDeploymentHomePath,
  resolveDeploymentEntryConfig,
  resolveDeploymentPostLoginPath,
} from "@/lib/auth/deployment-entry";

const memberships = [
  {
    workspaceId: "workspace-anson",
    workspace: {
      slug: "anson",
      systemKey: "tenant-anson",
    },
  },
  {
    workspaceId: "workspace-self",
    workspace: {
      slug: "helm-self",
      systemKey: "tenant-self",
    },
  },
];

describe("deployment entry configuration", () => {
  it("preserves unrestricted public behavior when no profile is configured", () => {
    const config = resolveDeploymentEntryConfig({});

    expect(config).toMatchObject({
      profile: "public",
      profileConfigured: false,
      configurationValid: true,
      displayName: "Helm",
      companyName: null,
      homePath: null,
      selfServeSignupEnabled: true,
      requiresWorkspaceAllowlist: false,
    });
    expect(filterDeploymentMemberships(memberships, config)).toHaveLength(2);
  });

  it("allows a cloud deployment to serve multiple workspaces and disable signup", () => {
    const config = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "cloud",
      HELM_DEPLOYMENT_ENTRY_DISPLAY_NAME: "Helm Cloud",
      HELM_DEPLOYMENT_ENTRY_COMPANY_NAME: "杭州追鹿智能科技有限公司",
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "/dashboard?source=cloud",
      HELM_DEPLOYMENT_SELF_SERVE_SIGNUP: "false",
    });

    expect(config).toMatchObject({
      profile: "cloud",
      configurationValid: true,
      companyName: "杭州追鹿智能科技有限公司",
      homePath: "/dashboard?source=cloud",
      selfServeSignupEnabled: false,
    });
    expect(filterDeploymentMemberships(memberships, config)).toHaveLength(2);
  });

  it("fails closed when an explicitly configured company name is unsafe", () => {
    const config = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "cloud",
      HELM_DEPLOYMENT_ENTRY_COMPANY_NAME: "Example\nCompany",
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "/dashboard",
    });

    expect(config.companyName).toBeNull();
    expect(config.configurationValid).toBe(false);
    expect(filterDeploymentMemberships(memberships, config)).toEqual([]);
  });

  it("fails closed when a non-public deployment has no valid home path", () => {
    const missingHome = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "cloud",
    });
    const externalHome = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "tenant",
      HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS: "anson",
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "https://example.com/home",
    });

    expect(missingHome.configurationValid).toBe(false);
    expect(externalHome.configurationValid).toBe(false);
    expect(filterDeploymentMemberships(memberships, externalHome)).toEqual([]);
  });

  it("fails closed for a private deployment without a workspace allowlist", () => {
    const config = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "tenant",
      HELM_DEPLOYMENT_ENTRY_DISPLAY_NAME: "Tenant workspace",
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "/tenant/home",
      HELM_DEPLOYMENT_SELF_SERVE_SIGNUP: "true",
    });

    expect(config.configurationValid).toBe(false);
    expect(config.selfServeSignupEnabled).toBe(false);
    expect(filterDeploymentMemberships(memberships, config)).toEqual([]);
  });

  it("matches private memberships by normalized slug or system key", () => {
    const config = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "first-party",
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "/helm-self/home",
      HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS: " HELM-SELF ",
      HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SYSTEM_KEYS: "TENANT-ANSON",
    });

    expect(config.configurationValid).toBe(true);
    expect(
      isWorkspaceAllowedForDeployment(memberships[0].workspace, config),
    ).toBe(true);
    expect(
      isWorkspaceAllowedForDeployment(memberships[1].workspace, config),
    ).toBe(true);
  });

  it("fails closed when an explicit profile value is invalid", () => {
    const config = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "private-ish",
      HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS: "anson",
    });

    expect(config.profile).toBe("tenant");
    expect(config.profileConfigured).toBe(true);
    expect(config.configurationValid).toBe(false);
    expect(filterDeploymentMemberships(memberships, config)).toEqual([]);
  });

  it("accepts only same-origin relative home paths", () => {
    expect(normalizeDeploymentHomePath("/workspace/home?tab=today")).toBe(
      "/workspace/home?tab=today",
    );
    expect(normalizeDeploymentHomePath("//example.com/path")).toBeNull();
    expect(normalizeDeploymentHomePath("https://example.com/path")).toBeNull();
    expect(normalizeDeploymentHomePath("/workspace\\evil")).toBeNull();
  });

  it("uses configured post-login paths only for valid non-public profiles", () => {
    const config = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_PROFILE: "tenant",
      HELM_DEPLOYMENT_ALLOWED_WORKSPACE_SLUGS: "anson",
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "/tenant/home",
    });
    const publicConfig = resolveDeploymentEntryConfig({
      HELM_DEPLOYMENT_ENTRY_HOME_PATH: "/should-not-override",
    });

    expect(resolveDeploymentPostLoginPath("/dashboard", config)).toBe(
      "/tenant/home",
    );
    expect(resolveDeploymentPostLoginPath("/dashboard", publicConfig)).toBe(
      "/dashboard",
    );
  });
});
