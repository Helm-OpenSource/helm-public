import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";
import {
  normalizeLoginCallback,
  resolveLoginCallbackDestination,
} from "@/lib/auth/login-callback";
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
  it("serves the fixed login logo without a session or completed identity setup", () => {
    for (const pending of [false, true]) {
      const request = new NextRequest("https://example.test/assets/logo.svg?v=1");
      if (pending) {
        request.cookies.set(SESSION_ID_COOKIE, "synthetic-session");
        request.cookies.set(FIRST_LOGIN_IDENTITY_SETUP_COOKIE, "1");
      }
      expect(unstable_doesMiddlewareMatch({ config, url: request.url })).toBe(true);
      expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
      expect(proxy(request).headers.has("location")).toBe(false);
    }
  });

  it.each([
    "/assets/private.svg",
    "/assets/logo.svg/private",
    "/assets/logo.svg.png",
    "/assets/Logo.svg",
    "/assets/logo.svg%2Fprivate",
    "/tenant-alpha/logo.svg",
  ])("does not exempt a neighboring or disguised resource: %s", (pathname) => {
    const request = new NextRequest(new URL(pathname, "https://example.test"));
    const login = new URL(proxy(request).headers.get("location")!);
    expect(login.pathname).toBe("/login");
    const callback = pathname.startsWith("/assets/") ? null : pathname;
    expect(login.searchParams.get("callback")).toBe(callback);
    request.cookies.set(SESSION_ID_COOKIE, "synthetic-session");
    request.cookies.set(FIRST_LOGIN_IDENTITY_SETUP_COOKIE, "1");
    const setup = new URL(proxy(request).headers.get("location")!);
    expect(setup.pathname).toBe("/getting-started");
    expect(setup.searchParams.get("mode")).toBe("identity-completion");
    expect(setup.searchParams.get("callback")).toBe(callback);
  });

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
      const login = new URL(unauthenticated.headers.get("location")!);
      expect(login.pathname).toBe("/login");
      expect(login.searchParams.get("callback")).toBe(`${path}?view=summary`);

      request.cookies.set(SESSION_ID_COOKIE, "synthetic-session");
      expect(proxy(request).headers.get("x-middleware-next")).toBe("1");

      request.cookies.set(FIRST_LOGIN_IDENTITY_SETUP_COOKIE, "1");
      const pendingSetup = proxy(request);
      expect(pendingSetup.status).toBe(307);
      expect(pendingSetup.headers.get("location")).toBe(
        `https://example.test/getting-started?mode=identity-completion&callback=${encodeURIComponent(`${path}?view=summary`)}`,
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


describe("login callback destinations", () => {
  it.each([
    "https://offsite.invalid/path",
    "//offsite.invalid/path",
    "/a/..//offsite.invalid/path",
    "/%2f%2foffsite.invalid/path",
    "/%5coffsite.invalid/path",
    "/%2561pi/auth/logout",
    "/%6cogin/workspaces",
    "/api/auth/logout",
    "/portal/access/synthetic",
    "/tenant-alpha/%0aheader",
  ])("rejects unsafe callbacks: %s", (value) => {
    expect(normalizeLoginCallback(value)).toBeUndefined();
    expect(resolveLoginCallbackDestination("/dashboard", value)).toBe("/dashboard");
  });

  it("carries the original address through required login steps", () => {
    const callback = "/tenant-alpha/workspace?q=a%20b#selected=example";
    const selector = resolveLoginCallbackDestination("/login/workspaces", callback);
    const setup = resolveLoginCallbackDestination("/getting-started?mode=identity-completion", callback);
    expect(new URL(selector, "https://example.test").searchParams.get("callback")).toBe(callback);
    expect(new URL(setup, "https://example.test").searchParams.get("callback")).toBe(callback);
    expect(resolveLoginCallbackDestination("/setup", callback)).toBe("/setup");
    expect(resolveLoginCallbackDestination("/dashboard", callback)).toBe(callback);
  });

  it("replaces any client-supplied workspace path for stale session handling", () => {
    const request = new NextRequest("https://example.test/tenant-alpha/workspace?view=summary&_rsc=test", {
      headers: { "x-helm-workspace-path": "/dashboard" },
    });
    request.cookies.set(SESSION_ID_COOKIE, "stale-synthetic-session");
    expect(proxy(request).headers.get("x-middleware-request-x-helm-workspace-path"))
      .toBe("/tenant-alpha/workspace?view=summary");
  });
});
