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
  const includeDescendants = options.includeDescendants ?? href !== "/dashboard";

  if (!matchesPath(pathname, href, includeDescendants)) {
    return false;
  }

  return !options.activeDescendantExclusions?.some((excludedHref) =>
    matchesPath(pathname, excludedHref, true),
  );
}
