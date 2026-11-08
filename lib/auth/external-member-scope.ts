import "server-only";

// External member scopes: a membership whose `accessScope` is set belongs to a person from outside the
// workspace's own team (for example a partner firm working some of the workspace's cases inside an extension).
// Such a member may use only the surface its scope names and the sign-in pages; every Core workspace page, API
// route and server action refuses them, because the session resolvers in lib/auth/session.ts refuse them before
// any workspace data is read.
//
// Core names no surface itself: a Pack or Overlay registers each one (scope key, landing path, path prefixes)
// through registerPackContributions({ externalMemberSurfaces }). A scope value nobody registered is treated as an
// external member with no surface at all ("unknown"): an authorization decision fails closed on the unfamiliar,
// it never falls back to a normal member. With no extension registered (the public build), every set value is
// "unknown".

import { getRegisteredExternalMemberSurface } from "@/lib/extensions/registry-contract";

export type ExternalMemberScope = string;

/** Where an external member whose scope no extension registered is sent: the sign-in page. */
export const EXTERNAL_MEMBER_FALLBACK_PATH = "/login";

/**
 * The scope of one membership: null for a normal member (the column is empty), the scope when an extension
 * registered it, "unknown" for any other non-empty value.
 */
export function externalScopeOf(
  membership: { accessScope?: string | null } | null | undefined,
): ExternalMemberScope | "unknown" | null {
  const raw = membership?.accessScope;
  if (raw === null || raw === undefined || raw === "") return null;
  return getRegisteredExternalMemberSurface(raw) ? raw : "unknown";
}

export function externalLandingPath(scope: ExternalMemberScope | "unknown"): string {
  return (scope !== "unknown" && getRegisteredExternalMemberSurface(scope)?.landingPath) || EXTERNAL_MEMBER_FALLBACK_PATH;
}

/** A deployment home or Core onboarding path never overrides an external member's registered surface. */
export function externalMemberPostLoginPath(
  membership: { accessScope?: string | null },
  fallbackPath: string,
): string {
  const scope = externalScopeOf(membership);
  return scope === null ? fallbackPath : externalLandingPath(scope);
}

/** Segment-boundary prefix match: "/api/x/portal" admits "/api/x/portal/orders", never "/api/x/portal-y". */
export function isPathInExternalScope(scope: ExternalMemberScope | "unknown", pathname: string): boolean {
  if (scope === "unknown" || typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  const surface = getRegisteredExternalMemberSurface(scope);
  return !!surface && surface.pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

/**
 * Whether a caller that names a surface may use a session seated on this membership: a normal member always, an
 * external member only on the registered surface its scope names.
 */
export function mayUseExternalSurface(
  membership: { accessScope?: string | null } | null | undefined,
  surface: ExternalMemberScope | undefined,
): boolean {
  const scope = externalScopeOf(membership);
  if (scope === null) return true;
  return scope !== "unknown" && surface === scope;
}
