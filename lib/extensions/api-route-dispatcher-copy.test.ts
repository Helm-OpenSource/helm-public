import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registry: {
    listRegisteredExtensionApiRoutes: vi.fn(),
    methodsForPath: vi.fn(),
    resolveExtensionApiRoute: vi.fn(),
  },
}));

vi.mock("@/lib/extensions/api-route-registry", () => ({
  listRegisteredExtensionApiRoutes: mocks.registry.listRegisteredExtensionApiRoutes,
  methodsForPath: mocks.registry.methodsForPath,
  resolveExtensionApiRoute: mocks.registry.resolveExtensionApiRoute,
}));

import {
  DELETE as deleteExtensionRoute,
  GET as getExtensionRoute,
} from "@/app/api/extensions/[...slug]/route";

describe("extension API dispatcher copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.registry.resolveExtensionApiRoute.mockReturnValue(null);
    mocks.registry.methodsForPath.mockReturnValue([]);
    // Default: a pack IS registered, so 404s carry no diagnostic hint.
    mocks.registry.listRegisteredExtensionApiRoutes.mockReturnValue([
      { packId: "demo", method: "GET", pattern: "demo/existing", authorizationKind: "handler_owned" },
    ]);
  });

  it("localizes missing extension routes from Accept-Language", async () => {
    const response = await getExtensionRoute(
      new Request("http://localhost/api/extensions/demo/missing", {
        headers: { "accept-language": "zh-CN" },
      }),
      { params: Promise.resolve({ slug: ["demo", "missing"] }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "未找到该扩展 API",
    });
  });

  it("preserves English missing-route copy for English callers", async () => {
    const response = await getExtensionRoute(
      new Request("http://localhost/api/extensions/demo/missing", {
        headers: { "accept-language": "en-US" },
      }),
      { params: Promise.resolve({ slug: ["demo", "missing"] }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Not found",
    });
  });

  it("appends a Core-only diagnostic hint to 404 when the registry is empty (zh)", async () => {
    mocks.registry.listRegisteredExtensionApiRoutes.mockReturnValue([]);

    const response = await getExtensionRoute(
      new Request("http://localhost/api/extensions/demo/missing", {
        headers: { "accept-language": "zh-CN" },
      }),
      { params: Promise.resolve({ slug: ["demo", "missing"] }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("未找到该扩展 API");
    expect(body.hint).toContain("扩展路由注册表为空");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("EMPTY extension route registry"),
    );
  });

  it("appends the English Core-only hint when the registry is empty (en)", async () => {
    mocks.registry.listRegisteredExtensionApiRoutes.mockReturnValue([]);

    const response = await getExtensionRoute(
      new Request("http://localhost/api/extensions/demo/missing", {
        headers: { "accept-language": "en-US" },
      }),
      { params: Promise.resolve({ slug: ["demo", "missing"] }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Not found");
    expect(body.hint).toContain("extension route registry is empty");
  });

  it("warns about the empty registry only once", async () => {
    // The warn-once flag is module state; reload the dispatcher module so the
    // flag starts fresh (earlier tests already consumed the first warning).
    vi.resetModules();
    const dispatcher = await import("@/app/api/extensions/[...slug]/route");
    mocks.registry.listRegisteredExtensionApiRoutes.mockReturnValue([]);

    for (let i = 0; i < 3; i++) {
      const response = await dispatcher.GET(
        new Request("http://localhost/api/extensions/demo/missing"),
        { params: Promise.resolve({ slug: ["demo", "missing"] }) },
      );
      expect(response.status).toBe(404);
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("localizes unsupported methods while preserving the Allow header", async () => {
    mocks.registry.methodsForPath.mockReturnValue(["GET"]);

    const response = await deleteExtensionRoute(
      new Request("http://localhost/api/extensions/demo/readout", {
        method: "DELETE",
        headers: { "accept-language": "zh-CN" },
      }),
      { params: Promise.resolve({ slug: ["demo", "readout"] }) },
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    await expect(response.json()).resolves.toEqual({
      error: "该扩展 API 不支持当前方法",
    });
  });

  it("preserves English unsupported-method copy for English callers", async () => {
    mocks.registry.methodsForPath.mockReturnValue(["GET"]);

    const response = await deleteExtensionRoute(
      new Request("http://localhost/api/extensions/demo/readout", {
        method: "DELETE",
        headers: { "accept-language": "en-US" },
      }),
      { params: Promise.resolve({ slug: ["demo", "readout"] }) },
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    await expect(response.json()).resolves.toEqual({
      error: "Method Not Allowed",
    });
  });
});
