import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHUNK_RELOAD_BACKOFF_MS,
  claimStaleChunkReload,
  classifyClientRuntimeError,
  isRecoverableChunkLoadError,
  normalizeClientRuntimeErrorTelemetry,
  toClientRuntimeRouteFamily,
} from "@/lib/client-runtime-error-recovery";

describe("client runtime error recovery", () => {
  it("recognizes stale Next.js chunk failures without matching ordinary runtime errors", () => {
    expect(
      isRecoverableChunkLoadError({
        name: "ChunkLoadError",
        message: "Failed to load chunk /_next/static/chunks/stale.js",
      }),
    ).toBe(true);
    expect(
      isRecoverableChunkLoadError({
        name: "Error",
        message: "Loading chunk 42 failed after a deployment",
      }),
    ).toBe(true);
    expect(
      isRecoverableChunkLoadError({
        name: "TypeError",
        message: "Cannot read properties of undefined",
      }),
    ).toBe(false);
  });

  it("allows one automatic reload per backoff window", () => {
    const storage = createStorage();
    const startedAt = 1_000_000;

    expect(claimStaleChunkReload(storage, startedAt)).toBe(true);
    expect(claimStaleChunkReload(storage, startedAt + CHUNK_RELOAD_BACKOFF_MS - 1)).toBe(false);
    expect(claimStaleChunkReload(storage, startedAt + CHUNK_RELOAD_BACKOFF_MS)).toBe(true);
  });

  it("reduces telemetry to a stable code and top-level route family", () => {
    expect(
      classifyClientRuntimeError({
        name: "ChunkLoadError",
        message: "Failed to load chunk /_next/static/chunks/stale.js",
      }),
    ).toBe("chunk_load_error");
    expect(
      classifyClientRuntimeError({
        name: "TypeError",
        message: "sensitive runtime detail",
      }),
    ).toBe("client_runtime_error");
    expect(toClientRuntimeRouteFamily("/workspace/anson/cases/customer-reference")).toBe("workspace");
    expect(toClientRuntimeRouteFamily("/unknown/customer-reference")).toBe("other");
  });

  it("drops raw client context and rejects untrusted classifications", () => {
    expect(
      normalizeClientRuntimeErrorTelemetry({
        code: "chunk_load_error",
        routeFamily: "workspace",
        digest: "safe-digest",
        message: "customer secret",
        stack: "sensitive stack",
        url: "https://helm.example/workspace/anson/case/customer-reference?phone=secret",
        userAgent: "sensitive user agent",
      }),
    ).toEqual({
      code: "chunk_load_error",
      digest: "safe-digest",
      routeFamily: "workspace",
    });
    expect(
      normalizeClientRuntimeErrorTelemetry({
        code: "database_dump",
        routeFamily: "customer-reference",
        digest: "customer secret",
      }),
    ).toEqual({
      code: "client_runtime_error",
      digest: null,
      routeFamily: "other",
    });
  });

  it("keeps the telemetry route free of raw network and client context", () => {
    const routeSource = readFileSync(
      new URL("../app/api/runtime/client-errors/route.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("normalizeClientRuntimeErrorTelemetry");
    expect(routeSource).not.toMatch(
      /request\.headers|x-forwarded-for|x-real-ip|referer|userAgent|\bmessage\b|\bstack\b|\burl\b/,
    );
  });

  it("fails closed when session storage is unavailable", () => {
    const storage = {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      },
    };

    expect(claimStaleChunkReload(storage, 1_000_000)).toBe(false);
  });
});

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
