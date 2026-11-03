import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetPackRegistryForTest, registerPackContributions } from "@/lib/extensions/registry-contract";
import {
  EXTERNAL_MEMBER_FALLBACK_PATH,
  externalLandingPath,
  externalScopeOf,
  isPathInExternalScope,
  mayUseExternalSurface,
} from "@/lib/auth/external-member-scope";

describe("external member scope", () => {
  beforeEach(() => {
    __resetPackRegistryForTest();
    registerPackContributions("demo-pack", {
      externalMemberSurfaces: [{ scope: "partner-portal", landingPath: "/demo/portal", pathPrefixes: ["/demo/portal", "/api/demo/portal"] }],
    });
  });
  afterEach(() => __resetPackRegistryForTest());

  it("reads a membership's scope: empty is a normal member, a registered value its scope, anything else unknown", () => {
    expect(externalScopeOf(null)).toBeNull();
    expect(externalScopeOf({})).toBeNull();
    expect(externalScopeOf({ accessScope: null })).toBeNull();
    expect(externalScopeOf({ accessScope: "" })).toBeNull();
    expect(externalScopeOf({ accessScope: "partner-portal" })).toBe("partner-portal");
    expect(externalScopeOf({ accessScope: "PARTNER-PORTAL" })).toBe("unknown");
    expect(externalScopeOf({ accessScope: "constructor" })).toBe("unknown");
  });

  it("refuses every scope when no extension registered one (the public build)", () => {
    __resetPackRegistryForTest();
    expect(externalScopeOf({ accessScope: "partner-portal" })).toBe("unknown");
    expect(externalLandingPath("partner-portal")).toBe(EXTERNAL_MEMBER_FALLBACK_PATH);
    expect(mayUseExternalSurface({ accessScope: "partner-portal" }, "partner-portal")).toBe(false);
  });

  it("lands a registered scope on its surface and an unknown one on the sign-in page", () => {
    expect(externalLandingPath("partner-portal")).toBe("/demo/portal");
    expect(externalLandingPath("unknown")).toBe(EXTERNAL_MEMBER_FALLBACK_PATH);
  });

  it("matches the surface on segment boundaries only", () => {
    expect(isPathInExternalScope("partner-portal", "/demo/portal")).toBe(true);
    expect(isPathInExternalScope("partner-portal", "/api/demo/portal/orders")).toBe(true);
    expect(isPathInExternalScope("partner-portal", "/api/demo/portal-x")).toBe(false);
    expect(isPathInExternalScope("partner-portal", "/demo/other")).toBe(false);
    expect(isPathInExternalScope("partner-portal", "demo/portal")).toBe(false);
    expect(isPathInExternalScope("unknown", "/demo/portal")).toBe(false);
  });

  it("lets a normal member use any surface and an external member only its own", () => {
    expect(mayUseExternalSurface({ accessScope: null }, undefined)).toBe(true);
    expect(mayUseExternalSurface({ accessScope: null }, "partner-portal")).toBe(true);
    expect(mayUseExternalSurface({ accessScope: "partner-portal" }, undefined)).toBe(false);
    expect(mayUseExternalSurface({ accessScope: "partner-portal" }, "partner-portal")).toBe(true);
    expect(mayUseExternalSurface({ accessScope: "x" }, "partner-portal")).toBe(false);
  });

  it("ignores a malformed surface and keeps the first registration of a scope", () => {
    __resetPackRegistryForTest();
    registerPackContributions("bad-pack", {
      externalMemberSurfaces: [
        { scope: "Bad Scope", landingPath: "/a", pathPrefixes: ["/a"] },
        { scope: "outside-landing", landingPath: "/elsewhere", pathPrefixes: ["/a"] },
        { scope: "relative-prefix", landingPath: "/a", pathPrefixes: ["a"] },
        { scope: "trailing-slash", landingPath: "/a/", pathPrefixes: ["/a/"] },
        { scope: "no-prefixes", landingPath: "/a", pathPrefixes: [] },
      ],
    });
    registerPackContributions("first", { externalMemberSurfaces: [{ scope: "partner-portal", landingPath: "/demo/one", pathPrefixes: ["/demo/one"] }] });
    registerPackContributions("second", { externalMemberSurfaces: [{ scope: "partner-portal", landingPath: "/demo/two", pathPrefixes: ["/demo/two"] }] });
    for (const scope of ["Bad Scope", "outside-landing", "relative-prefix", "trailing-slash", "no-prefixes"]) {
      expect(externalScopeOf({ accessScope: scope })).toBe("unknown");
    }
    expect(externalLandingPath("partner-portal")).toBe("/demo/one");
    expect(isPathInExternalScope("partner-portal", "/demo/two")).toBe(false);
  });

  it("refuses a surface that would claim Core's own pages or a whole API namespace", () => {
    __resetPackRegistryForTest();
    const cases: Array<[string, string, string[]]> = [
      ["single-segment", "/portal", ["/portal"]],
      ["core-dashboard", "/dashboard/x", ["/dashboard/x"]],
      ["core-login", "/login/x", ["/login/x"]],
      ["core-settings", "/settings/x", ["/settings/x"]],
      ["api-namespace", "/demo/portal", ["/demo/portal", "/api/demo"]],
      ["dot-segment", "/demo/../dashboard", ["/demo/../dashboard"]],
      ["api-landing", "/api/demo/portal", ["/api/demo/portal"]],
    ];
    for (const [scope, landingPath, pathPrefixes] of cases) registerPackContributions("pack-" + scope, { externalMemberSurfaces: [{ scope, landingPath, pathPrefixes }] });
    for (const [scope] of cases) expect(externalScopeOf({ accessScope: scope })).toBe("unknown");
  });
});
