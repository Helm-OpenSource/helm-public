// lib/seat-device/device-routes.test.ts
// The five D1 device endpoints without a database: the error-code map
// (status, body, no-store, Retry-After), the switched-off 404 before the body
// is read, and the other methods. Store behaviour behind the routes is in
// seat-device-routes.mysql.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";

import * as authorizeRoute from "@/app/api/public-auth/seat-device/device-authorizations/route";
import * as cancelRoute from "@/app/api/public-auth/seat-device/device-authorizations/cancel/route";
import * as claimRoute from "@/app/api/public-auth/seat-device/device-authorizations/claim/route";
import * as refreshRoute from "@/app/api/public-auth/seat-device/device-tokens/refresh/route";
import * as revokeRoute from "@/app/api/public-auth/seat-device/device-tokens/revoke/route";
import { SEAT_DEVICE_ERROR_STATUS, type SeatDeviceErrorCode } from "@/lib/seat-device/contract";
import { seatDeviceErrorResponse } from "@/lib/seat-device/device-routes";

const ROUTES = {
  "device-authorizations": authorizeRoute,
  "device-authorizations/cancel": cancelRoute,
  "device-authorizations/claim": claimRoute,
  "device-tokens/refresh": refreshRoute,
  "device-tokens/revoke": revokeRoute,
} as const;

// The codes a client treats as "this device is gone" (design §15.2).
const REVOKING_CODES = ["token_revoked", "device_revoked", "account_disabled"] as const;
const CODES = Object.keys(SEAT_DEVICE_ERROR_STATUS) as SeatDeviceErrorCode[];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("seat device endpoint error map", () => {
  it.each(CODES)("answers %s as {error:{code}} with its status and no-store", async (code) => {
    const response = seatDeviceErrorResponse(code, 7);
    const status = SEAT_DEVICE_ERROR_STATUS[code];
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code } });
    expect(response.headers.get("retry-after")).toBe(status === 429 || status === 503 ? "7" : null);
  });

  it("keeps every revoking code at 401 and never lets a 403 carry one", () => {
    for (const code of REVOKING_CODES) expect(SEAT_DEVICE_ERROR_STATUS[code]).toBe(401);
    const forbidden = CODES.filter((code) => SEAT_DEVICE_ERROR_STATUS[code] === 403);
    expect(forbidden).toEqual(["poll_token_invalid", "workspace_not_enabled", "forbidden", "reauthentication_required"]);
    expect(SEAT_DEVICE_ERROR_STATUS.workspace_not_enabled).toBe(403);
  });

  it("gives every 429 and 503 a whole-second Retry-After of at least 1", () => {
    for (const code of CODES.filter((entry) => [429, 503].includes(SEAT_DEVICE_ERROR_STATUS[entry]))) {
      expect(seatDeviceErrorResponse(code).headers.get("retry-after")).toBe("1");
      expect(seatDeviceErrorResponse(code, 0).headers.get("retry-after")).toBe("1");
      expect(seatDeviceErrorResponse(code, 2.2).headers.get("retry-after")).toBe("3");
    }
  });
});

describe("seat device endpoints with the deployment switch off", () => {
  it.each(Object.entries(ROUTES))("%s answers 404, no body, no-store, before reading the body", async (path, route) => {
    for (const value of [undefined, "false", "TRUE", "1"]) {
      if (value === undefined) vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", undefined);
      else vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", value);
      const request = new Request(`https://seat.example.test/api/public-auth/seat-device/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });
      const response = await route.POST(request);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("");
      expect(request.bodyUsed).toBe(false);
    }
  });

  it.each(Object.entries(ROUTES))("%s answers every other method 404 with no-store, switch on or off", async (_path, route) => {
    for (const value of ["true", "false"]) {
      vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", value);
      for (const method of [route.GET, route.PUT, route.PATCH, route.DELETE, route.OPTIONS]) {
        const response = method();
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe("");
      }
    }
  });
});

describe("seat device endpoints with the switch on, before the store", () => {
  const url = (path: string) => `https://seat.example.test/api/public-auth/seat-device/${path}`;
  const json = { "content-type": "application/json" };
  const refreshBody = JSON.stringify({ refreshToken: `hsdr_${"a".repeat(43)}` });

  it.each(Object.entries(ROUTES))("%s refuses malformed, non-object, non-JSON-typed and oversized bodies as invalid_input", async (path, route) => {
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    vi.stubEnv("APP_URL", "https://seat.example.test");
    const requests = [
      ...["{not json", "", "[]", "null", `"text"`].map((body) => new Request(url(path), { method: "POST", headers: json, body })),
      // A well-formed body as text/plain (what a cross-site form can send) or without a type.
      new Request(url(path), { method: "POST", headers: { "content-type": "text/plain" }, body: refreshBody }),
      new Request(url(path), { method: "POST", body: refreshBody }),
      // A declared length past the cap is refused before the body is read.
      new Request(url(path), { method: "POST", headers: { ...json, "content-length": "999999999" }, body: refreshBody }),
    ];
    for (const request of requests) {
      const response = await route.POST(request);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: { code: "invalid_input" } });
    }
    expect(requests.slice(5).map((request) => request.bodyUsed)).toEqual([false, false, false]);
  });

  it("stops reading a streamed body once it passes 4096 bytes", async () => {
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 64) controller.close();
        else controller.enqueue(new Uint8Array(1024).fill(0x20));
      },
    });
    const response = await refreshRoute.POST(new Request(url("device-tokens/refresh"), { method: "POST", headers: json, body, duplex: "half" } as RequestInit));
    expect(response.status).toBe(400);
    expect(pulled).toBeLessThanOrEqual(6);
  });

  it("reads a body of exactly 4096 bytes and refuses 4097", async () => {
    vi.stubEnv("HELM_SEAT_DEVICE_AUTH_ENABLED", "true");
    vi.stubEnv("APP_URL", "https://seat.example.test");
    // An unsupported client type is refused after the body was read and parsed.
    const object = JSON.stringify({ deviceName: "前台电脑", clientType: "other", clientVersion: "1.0.0" });
    const padded = (bytes: number) => " ".repeat(bytes - Buffer.byteLength(object)) + object;
    const answer = async (body: string) => (await authorizeRoute.POST(new Request(url("device-authorizations"), { method: "POST", headers: json, body }))).json();
    expect(await answer(padded(4096))).toEqual({ error: { code: "client_not_supported" } });
    expect(await answer(padded(4097))).toEqual({ error: { code: "invalid_input" } });
  });
});
