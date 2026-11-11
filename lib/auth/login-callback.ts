import { isWorkspacePagePathname } from "@/lib/auth/workspace-route-guard";

export const WORKSPACE_REQUEST_PATH_HEADER = "x-helm-workspace-path";

const LOCAL_ORIGIN = "https://login-callback.invalid";

export function normalizeLoginCallback(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/")) return;

  try {
    const url = new URL(value, LOCAL_ORIGIN);
    const rawPath = value.split(/[?#]/, 1)[0];
    const decodedPath = decodeURIComponent(rawPath);
    if (
      url.origin !== LOCAL_ORIGIN ||
      url.pathname.startsWith("//") ||
      decodedPath.startsWith("//") ||
      /[%\\]/.test(decodedPath) ||
      /[\u0000-\u001f\u007f]/u.test(decodedPath + value)
    ) return;

    // Check the decoded path too, so encoded auth and API routes cannot become destinations.
    const pathname = new URL(decodedPath, LOCAL_ORIGIN).pathname;
    if (pathname.startsWith("//") || /^\/(?:api|_next|login|assets)(?:\/|$)/i.test(pathname) || !isWorkspacePagePathname(pathname)) return;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return;
  }
}

export function withLoginCallback(path: string, callback: unknown): string {
  const target = normalizeLoginCallback(callback);
  if (!target) return path;
  const url = new URL(path, LOCAL_ORIGIN);
  url.searchParams.set("callback", target);
  return `${url.pathname}${url.search}`;
}

export function resolveLoginCallbackDestination(
  fallback: string,
  callback: unknown,
): string {
  const pathname = new URL(fallback, LOCAL_ORIGIN).pathname;
  if (pathname === "/login/workspaces" || pathname === "/getting-started") {
    return withLoginCallback(fallback, callback);
  }
  if (pathname === "/setup" || pathname === "/invite-pending") return fallback;
  return normalizeLoginCallback(callback) ?? fallback;
}

export function readBrowserLoginCallback(): string | undefined {
  const url = new URL(window.location.href);
  if (!["/login", "/login/workspaces", "/getting-started"].includes(url.pathname)) return;
  const callback = normalizeLoginCallback(url.searchParams.get("callback"));
  // A browser can carry a fragment across the initial redirect, but it never sends it to the server.
  if (!callback || !url.hash || callback.includes("#")) return callback;
  return normalizeLoginCallback(callback + url.hash);
}
