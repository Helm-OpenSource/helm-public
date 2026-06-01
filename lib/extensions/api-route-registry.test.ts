/**
 * api-route-registry — Core extension API route adapter seam (5B-0).
 *
 * Proves the contract is correct and, critically, that an EMPTY store behaves
 * exactly like a Core-only (no-pack) deployment: every resolve returns null so
 * the caller 404s. No auth lives here; handlers are opaque to the adapter.
 *
 * Fixtures use a neutral fake pack id ("samplepack") and neutral path segments
 * on purpose: this Core module ships in the public mirror and must name no
 * tenant. The matcher mechanics under test are tenant-agnostic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetExtensionApiRoutesForTest,
  decodeRequestPath,
  listRegisteredExtensionApiRoutes,
  registerExtensionApiRoutes,
  resolveExtensionApiRoute,
  type ExtensionApiRoute,
} from "./api-route-registry";

const PACK = "samplepack";
const ok = (body: string): ExtensionApiRoute["handler"] => () =>
  new Response(body, { status: 200 });

beforeEach(() => __resetExtensionApiRoutesForTest());
afterEach(() => __resetExtensionApiRoutesForTest());

describe("empty store (Core-only / public mirror behavior)", () => {
  it("resolves nothing → caller 404s", () => {
    expect(resolveExtensionApiRoute("GET", [PACK, "reports", "readout"])).toBeNull();
    expect(listRegisteredExtensionApiRoutes()).toHaveLength(0);
  });
});

describe("registration", () => {
  it("registers and resolves a literal route", () => {
    registerExtensionApiRoutes(PACK, [
      { method: "GET", pattern: `${PACK}/reports/readout`, handler: ok("readout") },
    ]);
    const r = resolveExtensionApiRoute("GET", [PACK, "reports", "readout"]);
    expect(r).not.toBeNull();
    expect(r!.params).toEqual({});
    expect(r!.packId).toBe(PACK);
  });

  it("is idempotent per packId (no duplicate routes on re-register)", () => {
    const routes: ExtensionApiRoute[] = [
      { method: "GET", pattern: `${PACK}/x`, handler: ok("x") },
    ];
    registerExtensionApiRoutes(PACK, routes);
    registerExtensionApiRoutes(PACK, routes);
    expect(listRegisteredExtensionApiRoutes()).toHaveLength(1);
  });

  it("throws on duplicate (method,pattern) within one registration", () => {
    expect(() =>
      registerExtensionApiRoutes(PACK, [
        { method: "GET", pattern: `${PACK}/x`, handler: ok("a") },
        { method: "GET", pattern: `${PACK}/x`, handler: ok("b") },
      ]),
    ).toThrow(/Duplicate route shape/);
  });

  it("throws on same-SHAPE duplicate within one batch (different param names)", () => {
    // shared/:id and shared/:name match the same paths → ambiguous → must clash.
    expect(() =>
      registerExtensionApiRoutes(PACK, [
        { method: "GET", pattern: `${PACK}/shared/:id`, handler: ok("a") },
        { method: "GET", pattern: `${PACK}/shared/:name`, handler: ok("b") },
      ]),
    ).toThrow(/Duplicate route shape/);
  });

  it("a literal and a param at the same position are DIFFERENT shapes (no false clash)", () => {
    // shared/health (literal) vs shared/:id (param) do NOT match the same set —
    // specificity resolves health to the literal — so they must coexist.
    expect(() =>
      registerExtensionApiRoutes(PACK, [
        { method: "GET", pattern: `${PACK}/shared/health`, handler: ok("lit") },
        { method: "GET", pattern: `${PACK}/shared/:id`, handler: ok("param") },
      ]),
    ).not.toThrow();
    expect(resolveExtensionApiRoute("GET", [PACK, "shared", "health"])!.pattern).toBe(
      `${PACK}/shared/health`,
    );
    expect(resolveExtensionApiRoute("GET", [PACK, "shared", "xyz"])!.pattern).toBe(
      `${PACK}/shared/:id`,
    );
  });

  it("rejects an empty dynamic param", () => {
    expect(() =>
      registerExtensionApiRoutes(PACK, [
        { method: "GET", pattern: `${PACK}/:`, handler: ok("bad") },
      ]),
    ).toThrow(/empty param/);
  });

  it("throws on a GLOBAL cross-pack (method,pattern) collision", () => {
    registerExtensionApiRoutes("pack-a", [
      { method: "GET", pattern: "shared/route", handler: ok("a") },
    ]);
    expect(() =>
      registerExtensionApiRoutes("pack-b", [
        { method: "GET", pattern: "shared/route", handler: ok("b") },
      ]),
    ).toThrow(/Route collision/);
    // pack-a's route still resolves to pack-a (collision did not overwrite it).
    expect(resolveExtensionApiRoute("GET", ["shared", "route"])!.packId).toBe("pack-a");
  });

  it("throws on a cross-pack same-SHAPE collision (different param names)", () => {
    registerExtensionApiRoutes("pack-a", [
      { method: "GET", pattern: "thing/:id", handler: ok("a") },
    ]);
    expect(() =>
      registerExtensionApiRoutes("pack-b", [
        { method: "GET", pattern: "thing/:slug", handler: ok("b") },
      ]),
    ).toThrow(/Route collision/);
    // pack-a's route is intact; the error names the existing pattern + owner.
    expect(resolveExtensionApiRoute("GET", ["thing", "x"])!.packId).toBe("pack-a");
  });

  it("does not collide across different methods on the same pattern", () => {
    registerExtensionApiRoutes("pack-a", [
      { method: "GET", pattern: "shared/route", handler: ok("a") },
    ]);
    expect(() =>
      registerExtensionApiRoutes("pack-b", [
        { method: "POST", pattern: "shared/route", handler: ok("b") },
      ]),
    ).not.toThrow();
  });

  it("leaves NO partial side effect when a batch fails validation (atomic)", () => {
    // First route is fine; second collides with an existing one → whole batch
    // must be rejected: neither the good route nor the packId may be committed.
    registerExtensionApiRoutes("pack-a", [
      { method: "GET", pattern: "existing/route", handler: ok("a") },
    ]);
    expect(() =>
      registerExtensionApiRoutes("pack-b", [
        { method: "GET", pattern: "pack-b/fresh", handler: ok("fresh") },
        { method: "GET", pattern: "existing/route", handler: ok("dup") },
      ]),
    ).toThrow(/Route collision/);
    // The "fresh" route from the failed batch must NOT be present.
    expect(resolveExtensionApiRoute("GET", ["pack-b", "fresh"])).toBeNull();
    // pack-b was not marked registered, so a corrected retry can succeed.
    registerExtensionApiRoutes("pack-b", [
      { method: "GET", pattern: "pack-b/fresh", handler: ok("fresh") },
    ]);
    expect(resolveExtensionApiRoute("GET", ["pack-b", "fresh"])).not.toBeNull();
  });

  it("is also atomic when the throw comes from pattern COMPILATION (not collision)", () => {
    // A valid first route followed by a malformed-pattern route: compilePattern
    // throws in phase 1, before any mutation, so nothing from the batch commits.
    expect(() =>
      registerExtensionApiRoutes("pack-c", [
        { method: "GET", pattern: "pack-c/ok", handler: ok("ok") },
        { method: "GET", pattern: "pack-c/:", handler: ok("bad") }, // empty param
      ]),
    ).toThrow(/empty param/);
    expect(resolveExtensionApiRoute("GET", ["pack-c", "ok"])).toBeNull();
    expect(listRegisteredExtensionApiRoutes().some((r) => r.packId === "pack-c")).toBe(false);
    // Corrected retry succeeds (packId was not poisoned).
    registerExtensionApiRoutes("pack-c", [
      { method: "GET", pattern: "pack-c/ok", handler: ok("ok") },
    ]);
    expect(resolveExtensionApiRoute("GET", ["pack-c", "ok"])).not.toBeNull();
  });
});

describe("matcher input contract: segments arrive ALREADY DECODED (no double-decode)", () => {
  // Matches the Next.js App Router catch-all, which hands ctx.params.slug already
  // URL-decoded. The matcher must pass these through verbatim — the migrated
  // handlers consume their params directly, exactly as native dynamic routes did.
  beforeEach(() => {
    registerExtensionApiRoutes(PACK, [
      { method: "GET", pattern: `${PACK}/items/:id`, handler: ok("item") },
      { method: "GET", pattern: `${PACK}/day-board`, handler: ok("literal") },
    ]);
  });

  it("captures a decoded param verbatim — does NOT decode again", () => {
    // Next already decoded "a%20b" → "a b". The matcher must NOT touch it.
    expect(resolveExtensionApiRoute("GET", [PACK, "items", "a b"])!.params).toEqual({
      id: "a b",
    });
    // A value that legitimately contains a literal '%' must survive unchanged
    // (a re-decode would corrupt or reject it).
    expect(resolveExtensionApiRoute("GET", [PACK, "items", "100%done"])!.params).toEqual({
      id: "100%done",
    });
    expect(resolveExtensionApiRoute("GET", [PACK, "items", "中"])!.params).toEqual({
      id: "中",
    });
  });

  it("matches a literal against the decoded segment as-is", () => {
    expect(resolveExtensionApiRoute("GET", [PACK, "day-board"])!.pattern).toBe(
      `${PACK}/day-board`,
    );
    // A different decoded value does not match the literal.
    expect(resolveExtensionApiRoute("GET", [PACK, "day board"])).toBeNull();
  });
});

describe("decodeRequestPath: raw-tail → decoded segments, fail-closed", () => {
  it("splits on real '/' and decodes each segment", () => {
    expect(decodeRequestPath("samplepack/items/a%20b")).toEqual(["samplepack", "items", "a b"]);
    expect(decodeRequestPath("/p/%E4%B8%AD/")).toEqual(["p", "中"]);
  });

  it("returns null (fail closed) on a malformed percent sequence", () => {
    expect(decodeRequestPath("p/%ZZ")).toBeNull();
    expect(decodeRequestPath("p/%E0%A4")).toBeNull();
    expect(decodeRequestPath("p/abc%")).toBeNull();
  });

  it("keeps an encoded slash (%2F) inside ONE segment (split happens before decode)", () => {
    // decodeRequestPath splits on real '/' first, then decodes — so %2F (still
    // encoded at split time) stays within a single segment and decodes to 'a/b'.
    // Documents the contract precisely so callers don't assume %2F adds a segment.
    expect(decodeRequestPath("p/a%2Fb")).toEqual(["p", "a/b"]);
  });
});

describe("method + path matching", () => {
  beforeEach(() => {
    registerExtensionApiRoutes(PACK, [
      { method: "GET", pattern: `${PACK}/signals/day-board`, handler: ok("day-get") },
      { method: "POST", pattern: `${PACK}/signals/day-board`, handler: ok("day-post") },
      {
        method: "POST",
        pattern: `${PACK}/reports/notifications/:notificationId`,
        handler: ok("notif"),
      },
    ]);
  });

  it("distinguishes methods on the same path", () => {
    expect(resolveExtensionApiRoute("GET", [PACK, "signals", "day-board"])!.pattern).toBe(
      `${PACK}/signals/day-board`,
    );
    expect(resolveExtensionApiRoute("DELETE", [PACK, "signals", "day-board"])).toBeNull();
  });

  it("captures a dynamic param verbatim (segments arrive already decoded)", () => {
    // Next delivers ctx.params.slug already decoded; the matcher passes it
    // through without re-decoding. So a decoded "abc 123" is captured as-is.
    const r = resolveExtensionApiRoute("POST", [
      PACK,
      "reports",
      "notifications",
      "abc 123",
    ]);
    expect(r).not.toBeNull();
    expect(r!.params).toEqual({ notificationId: "abc 123" });
  });

  it("does not match on segment-count mismatch", () => {
    expect(resolveExtensionApiRoute("GET", [PACK, "signals"])).toBeNull();
    expect(
      resolveExtensionApiRoute("GET", [PACK, "signals", "day-board", "extra"]),
    ).toBeNull();
  });
});

describe("specificity: literal beats param at the same position", () => {
  it("prefers the fewest-param match", () => {
    registerExtensionApiRoutes(PACK, [
      { method: "GET", pattern: `${PACK}/readout/:id`, handler: ok("param") },
      { method: "GET", pattern: `${PACK}/readout/health`, handler: ok("literal") },
    ]);
    const r = resolveExtensionApiRoute("GET", [PACK, "readout", "health"]);
    expect(r!.pattern).toBe(`${PACK}/readout/health`);
  });
});

describe("handler invocation passes through Request + params unchanged", () => {
  it("invokes the registered handler with the original request and matched params", async () => {
    const spy = vi.fn(
      (_req: Request, ctx: { params: Record<string, string> }) =>
        new Response(JSON.stringify(ctx.params), { status: 201 }),
    );
    registerExtensionApiRoutes(PACK, [
      { method: "PATCH", pattern: `${PACK}/userMappings/:userId`, handler: spy },
    ]);
    const resolved = resolveExtensionApiRoute("PATCH", [
      PACK,
      "userMappings",
      "u-42",
    ]);
    const req = new Request(
      `https://example.test/api/extensions/${PACK}/userMappings/u-42`,
      { method: "PATCH" },
    );
    const res = await resolved!.handler(req, { params: resolved!.params });
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledOnce();
    expect(await res.text()).toBe(JSON.stringify({ userId: "u-42" }));
  });
});
