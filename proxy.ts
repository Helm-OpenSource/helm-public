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

  // Fix for Aliyun CCC Workbench SDK URL concatenation bug.
  // The SDK v3.6.1 sometimes generates malformed URLs like:
  //   /api/extensions/anso_egion=cn-shanghai:1
  //   /api/extensions/anson_egion=cn-shanghai:1
  // instead of the correct /api/extensions/anson/aliyun-ccc/proxy?action=...
  // Intercept these malformed URLs and rewrite them to the correct proxy endpoint.
  if (pathname.startsWith("/api/extensions/")) {
    const isValidExtensionRoute =
      pathname.startsWith("/api/extensions/anson/") ||
      pathname === "/api/extensions/anson";

    const isMalformed =
      !isValidExtensionRoute ||
      pathname.includes("_egion=") ||
      pathname.includes("=cn-shanghai:") ||
      pathname.includes("_region=");

    if (isMalformed) {
      const url = request.nextUrl.clone();
      url.pathname = "/api/extensions/anson/aliyun-ccc/proxy";
      return NextResponse.rewrite(url);
    }

    // Valid extension API routes pass through
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
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/api/extensions/:path*",
  ],
};
