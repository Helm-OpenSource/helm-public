type NavLinkActiveOptions = {
  includeDescendants?: boolean;
  activeDescendantExclusions?: string[];
};

function matchesPath(pathname: string | null, href: string, includeDescendants: boolean) {
  if (!pathname) {
    return false;
  }

  return pathname === href || (includeDescendants && pathname.startsWith(`${href}/`));
}

export function isNavLinkActive(
  pathname: string | null,
  href: string,
  options: NavLinkActiveOptions = {},
) {
  // Active-state is a **pathname** relationship: a link whose destination carries
  // a query (e.g. the control-tower escape `/dashboard?stay=1`) is active when the
  // current pathname matches its pathname. Strip the query before matching AND
  // before the `/dashboard` descendant check, so navigation can keep the query
  // while highlighting stays correct.
  const targetPath = href.split("?")[0];
  const includeDescendants = options.includeDescendants ?? targetPath !== "/dashboard";

  if (!matchesPath(pathname, targetPath, includeDescendants)) {
    return false;
  }

  return !options.activeDescendantExclusions?.some((excludedHref) =>
    matchesPath(pathname, excludedHref, true),
  );
}
