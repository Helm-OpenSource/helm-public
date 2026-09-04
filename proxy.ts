import { NextResponse, type NextRequest } from "next/server";
import {
  FIRST_LOGIN_IDENTITY_SETUP_COOKIE,
  SESSION_ID_COOKIE,
} from "@/lib/auth/session-cookies";
import {
  shouldRedirectMissingWorkspaceSession,
  shouldRedirectWorkspaceToIdentitySetup,
} from "@/lib/auth/workspace-route-guard";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fix for Aliyun CCC Workbench SDK v3.6.1 URL concatenation bug.
  // The SDK incorrectly appends regionId into the path for certain API calls
  // (SignInGroup, ReadyForService, MakeCall), generating malformed URLs like:
  //   /api/extensions/anso_egion=cn-shanghai:1
  //   /api/extensions/anson_egion=cn-shanghai:1
  // Only intercept URLs that clearly match this bug pattern.
  // Do NOT touch other extension APIs, health checks, webhooks, or login APIs.
  if (
    pathname.startsWith("/api/extensions/") &&
    (pathname.includes("_egion=") ||
      pathname.includes("=cn-shanghai:") ||
      pathname.includes("_region="))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/extensions/anson/aliyun-ccc/proxy";
    return NextResponse.rewrite(url);
  }

  // All other /api/ routes (health checks, webhooks, login APIs, other
  // tenants' extension APIs) pass through without auth redirects.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const hasAuthSessionCookie = Boolean(request.cookies.get(SESSION_ID_COOKIE)?.value);
  const hasPendingIdentitySetupCookie = Boolean(
    request.cookies.get(FIRST_LOGIN_IDENTITY_SETUP_COOKIE)?.value,
  );

  if (
    !shouldRedirectMissingWorkspaceSession({
      pathname: request.nextUrl.pathname,
      hasAuthSessionCookie,
    })
  ) {
    if (
      shouldRedirectWorkspaceToIdentitySetup({
        pathname: request.nextUrl.pathname,
        hasAuthSessionCookie,
        hasPendingIdentitySetupCookie,
      })
    ) {
      const gettingStartedUrl = request.nextUrl.clone();
      gettingStartedUrl.pathname = "/getting-started";
      gettingStartedUrl.search = "mode=identity-completion";
      return NextResponse.redirect(gettingStartedUrl);
    }
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Original: all non-API routes go through auth redirect logic
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    // Additional: only /api/extensions/ paths reach proxy for SDK bug fix
    "/api/extensions/:path*",
  ],
};
