import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to fix Aliyun CCC Workbench SDK URL concatenation bug.
 *
 * The SDK sometimes generates malformed URLs like:
 *   /api/extensions/anson_egion=cn-shanghai:1
 *   /api/extensions/anso_egion=cn-shanghai:1
 *   /api/extensions/anson_region=cn-shanghai:1
 * instead of the correct:
 *   /api/extensions/anson/aliyun-ccc/proxy?action=...
 *
 * Root cause: SDK v3.6.1 concatenates regionId into the path instead of
 * using ajaxPath for certain API calls (SignInGroup, ReadyForService, MakeCall).
 *
 * This middleware intercepts ALL /api/extensions/ requests that don't match
 * a known valid route pattern and rewrites them to the CCC proxy endpoint.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process /api/extensions/ paths
  if (!pathname.startsWith("/api/extensions/")) {
    return NextResponse.next();
  }

  // Known valid extension API routes start with /api/extensions/anson/
  // (with a slash after "anson", indicating a proper route structure)
  const isValidExtensionRoute =
    pathname.startsWith("/api/extensions/anson/") ||
    pathname === "/api/extensions/anson";

  // If the URL looks malformed (no slash after the extension name,
  // or contains SDK concatenation artifacts like "_egion=", "=cn-shanghai:"),
  // rewrite it to the CCC proxy endpoint.
  const isMalformed =
    !isValidExtensionRoute ||
    pathname.includes("_egion=") ||
    pathname.includes("=cn-shanghai:") ||
    pathname.includes("_region=");

  if (isMalformed) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/extensions/anson/aliyun-ccc/proxy";
    // Preserve query parameters (SDK may pass action=MakeCall etc.)
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths under /api/extensions/ including malformed ones
  matcher: ["/api/extensions/:path*", "/api/extensions/anson_:path*", "/api/extensions/anso_:path*"],
};
