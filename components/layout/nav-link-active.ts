type NavLinkActiveOptions = {
  includeDescendants?: boolean;
  activeDescendantExclusions?: string[];
  /**
   * The query string of the current location (e.g. from `useSearchParams()`),
   * with or without a leading `?`. Used to disambiguate sibling links that share
   * a pathname but differ by query (e.g. several `/reports?tab=X` extension tabs).
   */
  currentQuery?: string | null;
};

function matchesPath(pathname: string | null, href: string, includeDescendants: boolean) {
  if (!pathname) {
    return false;
  }

  return pathname === href || (includeDescendants && pathname.startsWith(`${href}/`));
}

function parseTab(query: string | null | undefined): string | null {
  if (!query) {
    return null;
  }

  const normalized = query.startsWith("?") ? query.slice(1) : query;
  return new URLSearchParams(normalized).get("tab");
}

export function isNavLinkActive(
  pathname: string | null,
  href: string,
  options: NavLinkActiveOptions = {},
) {
  // Active-state is primarily a **pathname** relationship: a link whose destination
  // carries a query (e.g. the control-tower escape `/dashboard?stay=1`) is active
  // when the current pathname matches its pathname. Strip the query before matching
  // AND before the `/dashboard` descendant check.
  const [targetPath, targetQuery] = href.split("?");
  const includeDescendants = options.includeDescendants ?? targetPath !== "/dashboard";

  if (!matchesPath(pathname, targetPath, includeDescendants)) {
    return false;
  }

  if (
    options.activeDescendantExclusions?.some((excludedHref) =>
      matchesPath(pathname, excludedHref, true),
    )
  ) {
    return false;
  }

  // Query-param disambiguation: when the link carries a `?tab=` and the current
  // location also carries a `tab` (i.e. sibling extension tabs share a pathname),
  // only the link whose tab matches the current tab is active. This prevents a
  // wall of simultaneously-highlighted pills when several tabs share `/reports`.
  const targetTab = parseTab(targetQuery);
  if (targetTab !== null) {
    const currentTab = parseTab(options.currentQuery);
    if (currentTab !== null) {
      return targetTab === currentTab;
    }
  }

  return true;
}
