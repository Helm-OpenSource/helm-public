import "server-only";

/**
 * lib/extensions/api-route-registry.ts
 *
 * Core-side **extension API route adapter** contract + in-memory store
 * (repo-split Step 5B seam).
 *
 * Why this exists
 * ---------------
 * Today a Pack's API routes live as physical files under
 * `app/api/extensions/<pack>/**`. That directory is a Core scan root (`app/`),
 * so those tenant route files block a clean 4-repo split: Core's `app/` must not
 * carry tenant code. This module is the Core seam that lets a Pack/Overlay
 * **register** its API handlers (at the composition root, exactly like the 5A
 * surface registry) so the physical files can move to the Pack/Overlay repo and
 * be dispatched by ONE Core-owned catch-all. Core names no tenant here.
 *
 * What this is NOT (owner invariants for 5B)
 * ------------------------------------------
 * - NOT a runtime marketplace: registration happens only at the composition
 *   root (`instrumentation.ts` → `extensions/pack-bootstrap`). Nothing is
 *   discovered or loaded dynamically at request time; the store is populated
 *   once at boot, same lifecycle as the 5A pack registry.
 * - NOT a new permission model: this module does ZERO auth. Each migrated route
 *   keeps its own existing gate (e.g. workspace session + a role/authorization
 *   check, a pack-specific access probe, a cron token, or a public fixture gate)
 *   verbatim inside its handler. The adapter only maps (method, path) → the same
 *   handler function.
 * - NOT a behavior change on its own: until a catch-all route is wired and a
 *   physical route file is removed, this store stays empty and is pure dead
 *   code. Empty store ⇒ `resolveExtensionApiRoute` returns null ⇒ caller 404s,
 *   identical to a Core-only (no-pack) deployment.
 *
 * This is the seam that will become part of `@helm/pack-sdk` (route contract).
 */

export type ApiRouteMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/**
 * Handler signature. Mirrors a Next.js App Router route handler closely enough
 * that a migrated handler body is unchanged: it receives the original `Request`
 * plus the params extracted from the matched pattern (the same params Next.js
 * would have injected for `[notificationId]` etc.).
 */
export type ExtensionApiRouteHandler = (
  request: Request,
  context: { params: Record<string, string> },
) => Promise<Response> | Response;

/**
 * One registered route. `pattern` is the path **relative to
 * `/api/extensions/`**, using `:name` for a dynamic segment, e.g.
 * `"<pack>/reports/notifications/:notificationId"`.
 */
export type ExtensionApiRoute = {
  method: ApiRouteMethod;
  pattern: string;
  handler: ExtensionApiRouteHandler;
};

type PatternSegment =
  | { kind: "literal"; value: string }
  | { kind: "param"; name: string };

type CompiledRoute = {
  packId: string;
  method: ApiRouteMethod;
  pattern: string;
  /** Param-name-agnostic shape key (method + segments, params → ":"). */
  shapeKey: string;
  segments: PatternSegment[];
  /** Count of param segments — used to prefer the most specific match. */
  paramCount: number;
  handler: ExtensionApiRouteHandler;
};

function compilePattern(pattern: string): {
  segments: PatternSegment[];
  paramCount: number;
} {
  const parts = pattern.split("/").filter((p) => p.length > 0);
  let paramCount = 0;
  const segments: PatternSegment[] = parts.map((p) => {
    if (p.startsWith(":")) {
      const name = p.slice(1);
      if (name.length === 0) {
        throw new Error(`Invalid empty param in route pattern: "${pattern}"`);
      }
      paramCount += 1;
      return { kind: "param", name };
    }
    return { kind: "literal", value: p };
  });
  return { segments, paramCount };
}

// ---------------------------------------------------------------------------
// Process-singleton store (globalThis-backed, survives HMR / re-evaluation),
// matching the 5A registry-contract store pattern.
// ---------------------------------------------------------------------------

type MutableApiRouteStore = {
  routes: CompiledRoute[];
  registeredPackIds: Set<string>;
};

const STORE_KEY = "__helm_extension_api_route_store__";

function store(): MutableApiRouteStore {
  const g = globalThis as unknown as Record<
    string,
    MutableApiRouteStore | undefined
  >;
  if (!g[STORE_KEY]) g[STORE_KEY] = { routes: [], registeredPackIds: new Set() };
  return g[STORE_KEY]!;
}

/**
 * The route SHAPE key used for collision detection. Two patterns collide when
 * they would match the same set of request paths, regardless of param NAMES:
 * `shared/:id` and `shared/:name` have different strings but the identical shape
 * (literal `shared` + one param at position 1), so at request time both match
 * `shared/X` and resolution is ambiguous. We therefore key on the shape — every
 * param segment normalized to a single placeholder — so such a clash is caught
 * fail-closed at registration instead of silently shadowing at request time.
 *
 * Uses the compiled segments so the normalization matches the matcher exactly.
 */
function routeShapeKey(method: ApiRouteMethod, segments: PatternSegment[]): string {
  const shape = segments
    .map((seg) => (seg.kind === "param" ? ":" : seg.value))
    .join("/");
  return `${method} ${shape}`;
}

/**
 * Register a Pack/Overlay's API routes. Idempotent per `packId` (re-registering
 * the same id is a no-op, so HMR / double instrumentation does not duplicate
 * routes).
 *
 * Fail-closed and atomic: this validates the WHOLE batch before mutating the
 * store, and throws on a duplicate `(method, pattern)` that collides either
 *   - within this same call (copy-paste mistake), OR
 *   - with a route ALREADY registered by any earlier pack (cross-pack collision
 *     — two packs claiming the same extension path).
 * If validation throws, the store is left exactly as it was: `packId` is NOT
 * marked registered and NONE of the batch's routes are appended (no partial
 * side effect). This prevents a second pack from silently shadowing — or being
 * shadowed by — an existing route depending on push order.
 */
export function registerExtensionApiRoutes(
  packId: string,
  routes: ReadonlyArray<ExtensionApiRoute>,
): void {
  const s = store();
  if (s.registeredPackIds.has(packId)) return;

  // Phase 1 — validate the entire batch with NO mutation of the store.
  // Collision is keyed on the param-name-agnostic SHAPE, so `shared/:id` and
  // `shared/:name` (same matched paths, different param names) are caught.
  const existingShapes = new Map(s.routes.map((r) => [r.shapeKey, r]));
  const batchShapes = new Set<string>();
  const compiled: CompiledRoute[] = routes.map((r) => {
    const { segments, paramCount } = compilePattern(r.pattern);
    const shapeKey = routeShapeKey(r.method, segments);
    if (batchShapes.has(shapeKey)) {
      throw new Error(
        `Duplicate route shape in pack "${packId}": ${r.method} ${r.pattern} ` +
          `(collides with another route of the same shape in this batch)`,
      );
    }
    const existing = existingShapes.get(shapeKey);
    if (existing) {
      throw new Error(
        `Route collision: pack "${packId}" tries to register ${r.method} ${r.pattern}, ` +
          `same shape already registered as "${existing.pattern}" by pack "${existing.packId}"`,
      );
    }
    batchShapes.add(shapeKey);
    return {
      packId,
      method: r.method,
      pattern: r.pattern,
      shapeKey,
      segments,
      paramCount,
      handler: r.handler,
    };
  });

  // Phase 2 — only after the whole batch validated, commit atomically.
  s.registeredPackIds.add(packId);
  s.routes.push(...compiled);
}

/** Test/diagnostic helper: clear the store (not used in production paths). */
export function __resetExtensionApiRoutesForTest(): void {
  const g = globalThis as unknown as Record<
    string,
    MutableApiRouteStore | undefined
  >;
  g[STORE_KEY] = { routes: [], registeredPackIds: new Set() };
}

export type ResolvedExtensionApiRoute = {
  handler: ExtensionApiRouteHandler;
  params: Record<string, string>;
  packId: string;
  pattern: string;
};

/**
 * Slug encode/decode contract (catch-all dispatch):
 *
 * INPUT CONTRACT: `requestSegments` are the segments exactly as the Next.js App
 * Router catch-all delivers them in `ctx.params.slug` — i.e. **already URL-
 * decoded, one element per real `/`**. This matters because the migrated
 * handlers use their params directly (no `decodeURIComponent`), exactly as they
 * did as native dynamic routes; so this matcher must NOT decode again (a double-
 * decode would corrupt any value containing a literal `%` or an encoded
 * sequence). The matcher therefore does NO encoding/decoding of its own:
 *
 * - An ENCODED slash (`%2F`) inside a single URL segment: Next.js does not split
 *   it into two route segments, so it surfaces as a literal `/` WITHIN one
 *   decoded `slug` element. A `:param` capturing that element therefore receives
 *   a value containing `/`. (The `decodeRequestPath` helper mirrors this:
 *   split-on-real-`/` then decode keeps `a%2Fb` as the single segment `a/b`.)
 * - A MALFORMED percent escape (`%ZZ`) is Next's responsibility on the way in;
 *   by the time segments reach here they are already decoded plain strings.
 * - LITERAL and PARAM segments both compare/capture the decoded segment as-is.
 *
 * `decodeRequestPath` below is a small helper for callers/tests that start from
 * a raw encoded path string and need to reproduce Next's decode+split, with a
 * fail-closed result on malformed input (so a non-Next caller can't smuggle a
 * URIError into a 500).
 */
function matchSegments(
  segments: PatternSegment[],
  requestSegments: string[],
): Record<string, string> | null {
  if (segments.length !== requestSegments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const actual = requestSegments[i];
    if (seg.kind === "literal") {
      if (seg.value !== actual) return null;
    } else {
      params[seg.name] = actual;
    }
  }
  return params;
}

/**
 * Reproduce the Next.js catch-all decode+split for a raw `/api/extensions/...`
 * path TAIL (the part after `/api/extensions/`). Splits on real `/`, then
 * `decodeURIComponent`s each segment. Returns null (fail closed) if any segment
 * is malformed, so a non-Next caller that hand-builds segments cannot turn a
 * `%ZZ` into a 500. Production dispatch does NOT use this — Next already decoded
 * — it exists for callers/tests starting from an encoded string.
 */
export function decodeRequestPath(rawTail: string): string[] | null {
  const rawSegments = rawTail.split("/").filter((s) => s.length > 0);
  const decoded: string[] = [];
  for (const seg of rawSegments) {
    try {
      decoded.push(decodeURIComponent(seg));
    } catch {
      return null;
    }
  }
  return decoded;
}

/**
 * Resolve a request to a registered handler. Returns null when nothing matches
 * (caller should 404 — same as Core-only behavior). When multiple patterns
 * match, the most specific (fewest dynamic params) wins; a literal segment thus
 * always beats a param at the same position.
 */
export function resolveExtensionApiRoute(
  method: string,
  requestSegments: string[],
): ResolvedExtensionApiRoute | null {
  const s = store();
  let best: { route: CompiledRoute; params: Record<string, string> } | null =
    null;
  for (const route of s.routes) {
    if (route.method !== method) continue;
    const params = matchSegments(route.segments, requestSegments);
    if (!params) continue;
    if (best === null || route.paramCount < best.route.paramCount) {
      best = { route, params };
    }
  }
  if (!best) return null;
  return {
    handler: best.route.handler,
    params: best.params,
    packId: best.route.packId,
    pattern: best.route.pattern,
  };
}

/**
 * The HTTP methods registered for a path, regardless of request method — used by
 * the catch-all to mirror native Next's 405-with-`Allow` for a path that exists
 * under some verb but not the requested one (preserving pre-5B semantics). Empty
 * array ⇒ no route at this path at all (caller 404s). Methods are de-duplicated
 * and returned in a stable order.
 */
export function methodsForPath(requestSegments: string[]): ApiRouteMethod[] {
  const s = store();
  const found = new Set<ApiRouteMethod>();
  for (const route of s.routes) {
    if (matchSegments(route.segments, requestSegments)) {
      found.add(route.method);
    }
  }
  const ORDER: ApiRouteMethod[] = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ];
  return ORDER.filter((m) => found.has(m));
}

/** Diagnostic: list registered (packId, method, pattern) — no handlers. */
export function listRegisteredExtensionApiRoutes(): ReadonlyArray<{
  packId: string;
  method: ApiRouteMethod;
  pattern: string;
}> {
  return store().routes.map((r) => ({
    packId: r.packId,
    method: r.method,
    pattern: r.pattern,
  }));
}
