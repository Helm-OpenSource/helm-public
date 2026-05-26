const WORKSPACE_PAGE_PREFIXES = [
  "/analytics",
  "/approvals",
  "/capture",
  "/commercial-strengthening",
  "/companies",
  "/contacts",
  "/conversations",
  "/customer-success",
  "/dashboard",
  "/delivery-conversations",
  "/delivery-reviews",
  "/delivery-walkthroughs",
  "/diagnostics",
  "/expansion-reviews",
  "/external-narrative-fallbacks",
  "/external-narratives",
  "/external-proposals",
  "/follow-ups",
  "/founder-conversations",
  "/founder-qa",
  "/getting-started",
  "/imports",
  "/inbox",
  "/meetings",
  "/memory",
  "/offers",
  "/operating",
  "/opportunities",
  "/package-stage-variants",
  "/package-variants",
  "/packages",
  "/proposals",
  "/reinforcement-variants",
  "/reinforcements",
  "/reports",
  "/review-requests",
  "/sales-conversations",
  "/sales-followups",
  "/sales-objections",
  "/search",
  "/sendability",
  "/settings",
  "/setup",
  "/success-checks",
] as const;

export function isWorkspacePagePathname(pathname: string) {
  return WORKSPACE_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldRedirectMissingWorkspaceSession(input: {
  pathname: string;
  hasAuthSessionCookie: boolean;
}) {
  return !input.hasAuthSessionCookie && isWorkspacePagePathname(input.pathname);
}

export function shouldRedirectWorkspaceToIdentitySetup(input: {
  pathname: string;
  hasAuthSessionCookie: boolean;
  hasPendingIdentitySetupCookie: boolean;
}) {
  if (!input.hasAuthSessionCookie || !input.hasPendingIdentitySetupCookie) {
    return false;
  }

  if (!isWorkspacePagePathname(input.pathname)) {
    return false;
  }

  return !(input.pathname === "/getting-started" || input.pathname.startsWith("/getting-started/"));
}
