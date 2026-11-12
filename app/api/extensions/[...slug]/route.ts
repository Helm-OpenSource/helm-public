/**
 * app/api/extensions/[...slug]/route.ts
 *
 * Core-owned catch-all dispatcher for Pack/Overlay API routes (repo-split 5B).
 *
 * It owns NO tenant logic: it resolves `(method, /api/extensions/<...slug>)` to a
 * handler registered by a Pack at the composition root (via
 * `registerExtensionApiRoutes`) and delegates verbatim. When nothing is
 * registered for a path (e.g. Core-only / public mirror, or a path still served
 * by a not-yet-migrated static route file), resolve returns null and this
 * returns 404 — identical to the absence of the route.
 *
 * Next.js resolves a physical static route in preference to this catch-all, so
 * during the incremental 5B migration the static `app/api/extensions/<pack>/...`
 * files and this catch-all coexist safely: only paths whose static file has been
 * deleted AND whose handler has been registered are served here.
 *
 * Each registered handler keeps its own auth gate; this dispatcher performs no
 * authentication or authorization.
 */
import {
  listRegisteredExtensionApiRoutes,
  methodsForPath,
  resolveExtensionApiRoute,
} from "@/lib/extensions/api-route-registry";

export const dynamic = "force-dynamic";

/**
 * Warn once when the registry has no packs registered. An empty registry means
 * the process booted Core-only (public mirror, or the pack bootstrap threw and
 * instrumentation degraded silently) — every `/api/extensions/*` path then 404s
 * with no other signal. Surfacing that here turns "which route is missing?"
 * into "the whole pack layer is absent" in one glance.
 */
let warnedEmptyRegistry = false;

function isRegistryEmpty(): boolean {
  return listRegisteredExtensionApiRoutes().length === 0;
}

/** Build the `Allow` header value, adding HEAD when GET is present (HEAD parity). */
function allowHeader(methods: string[]): string {
  const set = new Set(methods);
  if (set.has("GET")) set.add("HEAD");
  return [...set].join(", ");
}

function isEnglishRequest(request: Request) {
  return request.headers.get("accept-language")?.toLowerCase().startsWith("en") ?? false;
}

function getExtensionDispatcherMessage(
  request: Request,
  key: "methodNotAllowed" | "notFound",
) {
  const english = isEnglishRequest(request);
  if (key === "methodNotAllowed") {
    return english ? "Method Not Allowed" : "该扩展 API 不支持当前方法";
  }
  return english ? "Not found" : "未找到该扩展 API";
}

/**
 * Localized hint appended to 404s ONLY when the extension route registry is
 * empty (no pack registered any routes). Kept out of the response when packs
 * exist, so a genuine per-path 404 keeps its original single-field body.
 */
function getEmptyRegistryHint(request: Request): string | undefined {
  if (!isRegistryEmpty()) return undefined;
  if (!warnedEmptyRegistry) {
    warnedEmptyRegistry = true;
    console.warn(
      "[extension-api] 404 with EMPTY extension route registry — " +
        "running Core-only (no pack bootstrap registered). " +
        "All /api/extensions/* paths will 404; check server startup logs for " +
        "'no pack bootstrap present; running Core-only'.",
    );
  }
  return isEnglishRequest(request)
    ? "extension route registry is empty: no pack bootstrap was registered on this deployment (Core-only fallback); every /api/extensions/* path returns 404"
    : "扩展路由注册表为空：本次部署未注册任何 Pack（Core-only 降级），所有 /api/extensions/* 路径都会 404";
}

async function dispatch(
  request: Request,
  ctx: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const method = request.method.toUpperCase();
  // `slug` is the path relative to the /api/extensions mount point, ALREADY
  // URL-decoded by Next (one element per real `/`). We pass it straight to the
  // matcher, which captures params verbatim — the migrated handlers consume
  // their params un-re-decoded, exactly as native dynamic routes did. See the
  // slug encode/decode contract in lib/extensions/api-route-registry.ts.
  const resolved = resolveExtensionApiRoute(method, slug);

  // HEAD parity with native Next routes: a native route that exports GET gets an
  // auto-derived HEAD (run GET, strip the body). The migrated handlers register
  // only their explicit verbs (GET/POST/...), so a HEAD request finds nothing.
  // Fall back to the GET handler and strip the body to preserve that behavior.
  if (!resolved && method === "HEAD") {
    const getRoute = resolveExtensionApiRoute("GET", slug);
    if (getRoute) {
      const full = await getRoute.handler(request, { params: getRoute.params });
      // A HEAD response carries the same status + headers as GET, with no body.
      return new Response(null, { status: full.status, headers: full.headers });
    }
  }

  if (!resolved) {
    // Mirror native Next semantics: a path that exists under SOME verb but not
    // the requested one returns 405 with an `Allow` header; a path with no
    // registered route at all returns 404.
    const allowed = methodsForPath(slug);
    if (allowed.length > 0) {
      return Response.json(
        { error: getExtensionDispatcherMessage(request, "methodNotAllowed") },
        { status: 405, headers: { Allow: allowHeader(allowed) } },
      );
    }
    const body: Record<string, string> = {
      error: getExtensionDispatcherMessage(request, "notFound"),
    };
    const hint = getEmptyRegistryHint(request);
    if (hint) body.hint = hint;
    return Response.json(body, { status: 404 });
  }
  return resolved.handler(request, { params: resolved.params });
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const HEAD = dispatch;
export const OPTIONS = dispatch;
