import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registry: {
    methodsForPath: vi.fn(),
    resolveExtensionApiRoute: vi.fn(),
  },
}));

vi.mock("@/lib/extensions/api-route-registry", () => ({
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
    mocks.registry.resolveExtensionApiRoute.mockReturnValue(null);
    mocks.registry.methodsForPath.mockReturnValue([]);
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
