import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";
import {
  FIRST_LOGIN_IDENTITY_SETUP_COOKIE,
  SESSION_ID_COOKIE,
} from "@/lib/auth/session-cookies";

const extensionPaths = ["tenant-alpha", "tenant-beta"].flatMap((tenant) => [
  `/api/extensions/${tenant}/records`,
  `/api/extensions/${tenant}/webhook?region=region-test`,
  `/api/extensions/${tenant}_egion=region-test:1`,
  `/api/extensions/${tenant}/records_region=region-test:1`,
  `/api/extensions/${tenant}/records=cn-shanghai:1`,
]);

describe("Core proxy boundary", () => {
  it("keeps the original non-API authentication matcher", () => {
    expect(config.matcher).toEqual([
      "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ]);
  });

  it("contains no URL rewrite operation", () => {
    const source = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
    expect(/\brewrite\s*\(/.test(source)).toBe(false);
  });

  it.each([
    ...extensionPaths,
    "/api",
    "/api/health",
    "/api/auth/login",
    "/api/webhooks/sample",
    "/_next/static/chunks/sample.js",
    "/_next/image?url=%2Fsample.png&w=64&q=75",
    "/favicon.ico",
  ])("does not run the proxy for %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });

  it.each(extensionPaths)("does not rewrite extension URL %s", (path) => {
    const request = new NextRequest(new URL(path, "https://example.test"));
    request.cookies.set(SESSION_ID_COOKIE, "synthetic-session");
    const originalUrl = request.nextUrl.href;

    const response = proxy(request);

    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("location")).toBe(false);
    expect(request.nextUrl.href).toBe(originalUrl);
  });

  it.each(["/dashboard", "/tenant-alpha/workspace", "/tenant-beta/workspace"])(
    "preserves session and identity-setup redirects for %s",
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
      const request = new NextRequest(
        new URL(`${path}?view=summary`, "https://example.test"),
      );

      const unauthenticated = proxy(request);
      expect(unauthenticated.status).toBe(307);
      expect(unauthenticated.headers.get("location")).toBe("https://example.test/login");

      request.cookies.set(SESSION_ID_COOKIE, "synthetic-session");
      expect(proxy(request).headers.get("x-middleware-next")).toBe("1");

      request.cookies.set(FIRST_LOGIN_IDENTITY_SETUP_COOKIE, "1");
      const pendingSetup = proxy(request);
      expect(pendingSetup.status).toBe(307);
      expect(pendingSetup.headers.get("location")).toBe(
        "https://example.test/getting-started?mode=identity-completion",
      );
    },
  );

  it.each(["/", "/login", "/portal/access/synthetic", "/getting-started"])(
    "keeps public pages and the identity-setup destination reachable: %s",
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
      const request = new NextRequest(new URL(path, "https://example.test"));
      request.cookies.set(SESSION_ID_COOKIE, "synthetic-session");
      request.cookies.set(FIRST_LOGIN_IDENTITY_SETUP_COOKIE, "1");

      const response = proxy(request);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.has("location")).toBe(false);
    },
  );
});
