import { NextResponse, type NextRequest } from "next/server";
import { WORKSPACE_REQUEST_PATH_HEADER, withLoginCallback } from "@/lib/auth/login-callback";
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

  const requestUrl = request.nextUrl.clone();
  if (requestUrl.searchParams.has("_rsc")) requestUrl.searchParams.delete("_rsc");
  const callback = requestUrl.pathname + requestUrl.search;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_REQUEST_PATH_HEADER, callback);

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
      const destination = withLoginCallback("/getting-started?mode=identity-completion", callback);
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.redirect(new URL(withLoginCallback("/login", callback), request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
