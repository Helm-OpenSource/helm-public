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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
