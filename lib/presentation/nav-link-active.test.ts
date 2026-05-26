import { describe, expect, it } from "vitest";
import { isNavLinkActive } from "@/components/layout/nav-link-active";

describe("isNavLinkActive", () => {
  it("keeps dashboard exact so it does not claim fallback or child routes", () => {
    expect(isNavLinkActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavLinkActive("/dashboard/preview", "/dashboard")).toBe(false);
  });

  it("keeps object nav links active for their detail routes", () => {
    expect(isNavLinkActive("/opportunities/case-1", "/opportunities")).toBe(true);
    expect(isNavLinkActive("/operating/roles/founder", "/operating")).toBe(true);
  });

  it("does not treat sibling prefixes as descendants", () => {
    expect(isNavLinkActive("/operating-archive", "/operating")).toBe(false);
  });

  it("lets concrete operating children own their active state", () => {
    const exclusions = ["/operating/tenant-health", "/operating/gtm-leads"];

    expect(
      isNavLinkActive("/operating/tenant-health", "/operating", {
        activeDescendantExclusions: exclusions,
      }),
    ).toBe(false);
    expect(isNavLinkActive("/operating/tenant-health", "/operating/tenant-health")).toBe(true);
    expect(
      isNavLinkActive("/operating/gtm-leads", "/operating", {
        activeDescendantExclusions: exclusions,
      }),
    ).toBe(false);
    expect(isNavLinkActive("/operating/gtm-leads", "/operating/gtm-leads")).toBe(true);
  });
});
