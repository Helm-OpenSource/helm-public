import { describe, expect, it } from "vitest";
import {
  isWorkspacePagePathname,
  shouldRedirectMissingWorkspaceSession,
  shouldRedirectWorkspaceToIdentitySetup,
} from "@/lib/auth/workspace-route-guard";

describe("workspace route guard", () => {
  it("treats workspace shell pages as protected page navigations", () => {
    expect(isWorkspacePagePathname("/dashboard")).toBe(true);
    expect(isWorkspacePagePathname("/reports")).toBe(true);
    expect(isWorkspacePagePathname("/approvals/cm123")).toBe(true);
    expect(isWorkspacePagePathname("/settings")).toBe(true);
  });

  it("keeps public entry, demo, program and portal paths outside the workspace guard", () => {
    expect(isWorkspacePagePathname("/")).toBe(false);
    expect(isWorkspacePagePathname("/login")).toBe(false);
    expect(isWorkspacePagePathname("/demo")).toBe(false);
    expect(isWorkspacePagePathname("/programs")).toBe(false);
    expect(isWorkspacePagePathname("/portal/access/token")).toBe(false);
  });

  it("only redirects protected page navigations when the auth session cookie is missing", () => {
    expect(
      shouldRedirectMissingWorkspaceSession({
        pathname: "/reports",
        hasAuthSessionCookie: false,
      }),
    ).toBe(true);
    expect(
      shouldRedirectMissingWorkspaceSession({
        pathname: "/reports",
        hasAuthSessionCookie: true,
      }),
    ).toBe(false);
    expect(
      shouldRedirectMissingWorkspaceSession({
        pathname: "/login",
        hasAuthSessionCookie: false,
      }),
    ).toBe(false);
  });

  it("redirects workspace pages to getting-started when identity setup is pending", () => {
    expect(
      shouldRedirectWorkspaceToIdentitySetup({
        pathname: "/dashboard",
        hasAuthSessionCookie: true,
        hasPendingIdentitySetupCookie: true,
      }),
    ).toBe(true);
    expect(
      shouldRedirectWorkspaceToIdentitySetup({
        pathname: "/getting-started",
        hasAuthSessionCookie: true,
        hasPendingIdentitySetupCookie: true,
      }),
    ).toBe(false);
    expect(
      shouldRedirectWorkspaceToIdentitySetup({
        pathname: "/login",
        hasAuthSessionCookie: true,
        hasPendingIdentitySetupCookie: true,
      }),
    ).toBe(false);
  });
});
