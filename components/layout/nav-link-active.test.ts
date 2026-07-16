import { describe, expect, it } from "vitest";

import { isNavLinkActive } from "./nav-link-active";

describe("isNavLinkActive — query is a pathname relationship (CodeX P1)", () => {
  it("a link carrying a query (e.g. /dashboard?stay=1 escape) is active on its pathname", () => {
    expect(isNavLinkActive("/dashboard", "/dashboard?stay=1")).toBe(true);
    expect(isNavLinkActive("/dashboard", "/dashboard")).toBe(true);
  });

  it("/dashboard does NOT match descendants even when the link carries a query", () => {
    // includeDescendants defaults false for /dashboard; query must not flip that.
    expect(isNavLinkActive("/dashboard/anything", "/dashboard?stay=1")).toBe(false);
    expect(isNavLinkActive("/dashboard/anything", "/dashboard")).toBe(false);
  });

  it("non-dashboard links still match descendants (query-stripped)", () => {
    expect(isNavLinkActive("/opportunities/123", "/opportunities?tab=x")).toBe(true);
    expect(isNavLinkActive("/opportunities", "/opportunities?tab=x")).toBe(true);
  });

  it("unrelated pathname is not active", () => {
    expect(isNavLinkActive("/approvals", "/dashboard?stay=1")).toBe(false);
    expect(isNavLinkActive(null, "/dashboard?stay=1")).toBe(false);
  });

  it("descendant exclusions still apply with a query-carrying href", () => {
    // /operating active, but excluded when under /operating/gtm-leads
    expect(
      isNavLinkActive("/operating/gtm-leads", "/operating?x=1", {
        activeDescendantExclusions: ["/operating/gtm-leads"],
      }),
    ).toBe(false);
  });
});

describe("isNavLinkActive — sibling ?tab= links are single-active", () => {
  it("only the link whose tab matches the current tab is active", () => {
    // Two sibling extension tabs share /reports; on /reports?tab=a only 'a' is active.
    expect(
      isNavLinkActive("/reports", "/reports?tab=a", { currentQuery: "tab=a" }),
    ).toBe(true);
    expect(
      isNavLinkActive("/reports", "/reports?tab=b", { currentQuery: "tab=a" }),
    ).toBe(false);
  });

  it("accepts a leading '?' on currentQuery", () => {
    expect(
      isNavLinkActive("/reports", "/reports?tab=a", { currentQuery: "?tab=a" }),
    ).toBe(true);
    expect(
      isNavLinkActive("/reports", "/reports?tab=b", { currentQuery: "?tab=a" }),
    ).toBe(false);
  });

  it("ignores unrelated query params when comparing tabs", () => {
    expect(
      isNavLinkActive("/reports", "/reports?tab=a", {
        currentQuery: "tab=a&range=30d",
      }),
    ).toBe(true);
  });

  it("falls back to pathname match when the current location has no tab", () => {
    // e.g. landed on /reports with no tab — the query-tab links still highlight on
    // pathname (matching prior behavior); no disambiguation is possible.
    expect(
      isNavLinkActive("/reports", "/reports?tab=a", { currentQuery: "" }),
    ).toBe(true);
    expect(isNavLinkActive("/reports", "/reports?tab=a")).toBe(true);
  });

  it("does not gate links without a tab in their href", () => {
    // A plain /reports link stays active on /reports?tab=a (pathname relationship).
    expect(
      isNavLinkActive("/reports", "/reports", { currentQuery: "tab=a" }),
    ).toBe(true);
  });
});
