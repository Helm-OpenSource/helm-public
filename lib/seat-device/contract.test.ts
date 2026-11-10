import { createHash } from "node:crypto";
import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  SEAT_DEVICE_ACCESS_TOKEN_PATTERN,
  SEAT_DEVICE_DECISION_REQUEST_SCHEMA,
  SEAT_DEVICE_ERROR_STATUS,
  SEAT_DEVICE_LOOKUP_REQUEST_SCHEMA,
  SEAT_DEVICE_PAIRING_CODE_ALPHABET,
  SEAT_DEVICE_POLL_REQUEST_SCHEMA,
  SEAT_DEVICE_POLL_TOKEN_PATTERN,
  SEAT_DEVICE_REFRESH_TOKEN_PATTERN,
  SEAT_DEVICE_REVOKE_REASONS,
  SEAT_DEVICE_STORED_STATUSES,
  effectiveSeatDeviceStatus,
  formatSeatDevicePairingCode,
  generateSeatDevicePairingCode,
  hashSeatDevicePairingCode,
  hashSeatDeviceToken,
  isSeatDeviceWorkspaceEnabled,
  mintSeatDeviceToken,
  normalizeSeatDevicePairingCode,
  parseSeatDeviceAuthorizationRequest,
  parseSeatDeviceRequest,
  parseSeatDeviceRevokeRequest,
  readSeatDeviceTrustedProxyHops,
  resolveSeatDeviceTrustedSource,
  seatDeviceCredentialExpiresAt,
  seatDeviceIdentity,
  seatDevicePreviousAccessExpiresAt,
  seatDeviceSourceBucket,
  seatDeviceUnclaimedPollStatus,
} from "@/lib/seat-device/contract";

const now = new Date("2026-11-11T08:00:00.000Z");
const later = new Date("2026-11-11T08:05:00.000Z");
const earlier = new Date("2026-11-11T07:55:00.000Z");
const on = { HELM_SEAT_DEVICE_AUTH_ENABLED: "true" };

describe("seat device tokens", () => {
  it("mints prefixed 43-character tokens and stores only their sha256", () => {
    const poll = mintSeatDeviceToken("poll");
    const access = mintSeatDeviceToken("access");
    const refresh = mintSeatDeviceToken("refresh");
    expect(poll.token).toMatch(SEAT_DEVICE_POLL_TOKEN_PATTERN);
    expect(access.token).toMatch(SEAT_DEVICE_ACCESS_TOKEN_PATTERN);
    expect(refresh.token).toMatch(SEAT_DEVICE_REFRESH_TOKEN_PATTERN);
    expect(access.token).not.toMatch(SEAT_DEVICE_REFRESH_TOKEN_PATTERN);
    expect(access.tokenHash).toBe(createHash("sha256").update(access.token, "utf8").digest("hex"));
    expect(access.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSeatDeviceToken(access.token)).toBe(access.tokenHash);
    expect(mintSeatDeviceToken("access").token).not.toBe(access.token);
  });
});

describe("seat device pairing code", () => {
  it("draws every letter of the consonant alphabet and nothing else", () => {
    const seen = new Map<string, number>();
    for (let index = 0; index < 2000; index += 1) {
      const code = generateSeatDevicePairingCode();
      expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{8}$/);
      for (const letter of code) seen.set(letter, (seen.get(letter) ?? 0) + 1);
    }
    // 16000 draws: each letter expects 800. A biased or truncated draw (for
    // example randomInt(19) or a modulo of a byte) leaves a letter far off.
    expect([...seen.keys()].sort().join("")).toBe(SEAT_DEVICE_PAIRING_CODE_ALPHABET);
    for (const count of seen.values()) expect(count).toBeGreaterThan(650);
    expect(SEAT_DEVICE_PAIRING_CODE_ALPHABET).toHaveLength(20);
    expect(SEAT_DEVICE_PAIRING_CODE_ALPHABET).not.toMatch(/[AEIOUY01]/);
  });

  it("normalizes what a member types and hashes the normalized form", () => {
    expect(formatSeatDevicePairingCode("BCDFGHJK")).toBe("BCDF-GHJK");
    expect(normalizeSeatDevicePairingCode(" bcdf-ghjk ")).toBe("BCDFGHJK");
    expect(normalizeSeatDevicePairingCode("BCDF GHJK")).toBe("BCDFGHJK");
    expect(hashSeatDevicePairingCode("bcdf-ghjk")).toBe(hashSeatDevicePairingCode("BCDFGHJK"));
    expect(hashSeatDevicePairingCode("BCDFGHJK")).toBe(createHash("sha256").update("BCDFGHJK", "utf8").digest("hex"));
    expect(hashSeatDevicePairingCode("BCDFGHJL")).not.toBe(hashSeatDevicePairingCode("BCDFGHJK"));
  });

  it("rejects codes outside the alphabet or of the wrong length", () => {
    for (const input of ["BCDFGHJ", "BCDFGHJKL", "BCDFGHJA", "BCDF_GHJK", "12345678", ""]) {
      expect(normalizeSeatDevicePairingCode(input)).toBeNull();
      expect(hashSeatDevicePairingCode(input)).toBeNull();
    }
  });
});

describe("effectiveSeatDeviceStatus", () => {
  const row = (status: string, expiresAt: Date | null = null, requestExpiresAt = later) => ({ status, requestExpiresAt, expiresAt });

  it("derives expiry from the clock and leaves terminal states alone", () => {
    expect(effectiveSeatDeviceStatus(row("pending"), now)).toBe("pending");
    expect(effectiveSeatDeviceStatus(row("pending", null, earlier), now)).toBe("expired");
    expect(effectiveSeatDeviceStatus(row("pending", null, now), now)).toBe("expired");
    expect(effectiveSeatDeviceStatus(row("approved"), now)).toBe("approved");
    expect(effectiveSeatDeviceStatus(row("approved", null, earlier), now)).toBe("expired");
    expect(effectiveSeatDeviceStatus(row("active", later, earlier), now)).toBe("active");
    expect(effectiveSeatDeviceStatus(row("active", earlier), now)).toBe("expired");
    expect(effectiveSeatDeviceStatus(row("active", null), now)).toBe("expired");
    for (const status of ["cancelled", "rejected", "revoked"]) {
      expect(effectiveSeatDeviceStatus(row(status, null, earlier), now)).toBe(status);
    }
    expect(effectiveSeatDeviceStatus(row("expired"), now)).toBeNull();
    expect(effectiveSeatDeviceStatus(row("ACTIVE", later), now)).toBeNull();
    expect(SEAT_DEVICE_STORED_STATUSES).not.toContain("expired");
  });

  it("reports a cancelled request to the polling client as expired", () => {
    expect(seatDeviceUnclaimedPollStatus("pending")).toBe("pending");
    expect(seatDeviceUnclaimedPollStatus("rejected")).toBe("rejected");
    expect(seatDeviceUnclaimedPollStatus("expired")).toBe("expired");
    expect(seatDeviceUnclaimedPollStatus("cancelled")).toBe("expired");
    for (const status of ["approved", "active", "revoked", null] as const) {
      expect(seatDeviceUnclaimedPollStatus(status)).toBeNull();
    }
  });
});

describe("seat device lifetimes", () => {
  it("fixes the credential at approval plus 30 days", () => {
    expect(seatDeviceCredentialExpiresAt(now).toISOString()).toBe("2026-12-11T08:00:00.000Z");
  });

  it("caps the previous access token at 60 seconds after rotation", () => {
    const rotatedAt = new Date("2026-11-11T08:00:00.000Z");
    const capped = (previous: string) => seatDevicePreviousAccessExpiresAt(new Date(previous), rotatedAt).toISOString();
    expect(capped("2026-11-11T08:10:00.000Z")).toBe("2026-11-11T08:01:00.000Z");
    expect(capped("2026-11-11T08:00:30.000Z")).toBe("2026-11-11T08:00:30.000Z");
  });
});

describe("seat device gates", () => {
  it("needs both the deployment switch and the workspace flag", () => {
    expect(isSeatDeviceWorkspaceEnabled('{"seatDesktop":true}', on)).toBe(true);
    expect(isSeatDeviceWorkspaceEnabled('{"seatDesktop":true}', {})).toBe(false);
    expect(isSeatDeviceWorkspaceEnabled('{"seatDesktop":true}', { HELM_SEAT_DEVICE_AUTH_ENABLED: "TRUE" })).toBe(false);
    expect(isSeatDeviceWorkspaceEnabled('{"seatDesktop":"true"}', on)).toBe(false);
    expect(isSeatDeviceWorkspaceEnabled("{}", on)).toBe(false);
    expect(isSeatDeviceWorkspaceEnabled(null, on)).toBe(false);
    expect(isSeatDeviceWorkspaceEnabled("not json", on)).toBe(false);
    expect(isSeatDeviceWorkspaceEnabled("null", on)).toBe(false);
  });
});

describe("seat device trusted source", () => {
  it("reads the hop count fail-closed", () => {
    expect(readSeatDeviceTrustedProxyHops({})).toBe(0);
    expect(readSeatDeviceTrustedProxyHops({ HELM_SEAT_DEVICE_TRUSTED_PROXY_HOPS: "2" })).toBe(2);
    for (const value of ["-1", "1.5", "two", "10", ""]) {
      expect(readSeatDeviceTrustedProxyHops({ HELM_SEAT_DEVICE_TRUSTED_PROXY_HOPS: value })).toBe(0);
    }
  });

  it("takes the Nth entry from the right, never a client-supplied one", () => {
    const header = "198.51.100.7, 203.0.113.9, 192.0.2.1";
    expect(resolveSeatDeviceTrustedSource(header, 1)).toBe("192.0.2.1");
    expect(resolveSeatDeviceTrustedSource(header, 2)).toBe("203.0.113.9");
    expect(resolveSeatDeviceTrustedSource(header, 3)).toBe("198.51.100.7");
    expect(resolveSeatDeviceTrustedSource(header, 4)).toBeNull();
    expect(resolveSeatDeviceTrustedSource(header, 0)).toBeNull();
    expect(resolveSeatDeviceTrustedSource(null, 1)).toBeNull();
    expect(resolveSeatDeviceTrustedSource("unknown, 192.0.2.1", 2)).toBeNull();
    expect(resolveSeatDeviceTrustedSource("192.0.2.1:443", 1)).toBeNull();
  });

  it("buckets IPv4 by /24 and IPv6 by /48", () => {
    expect(seatDeviceSourceBucket("203.0.113.9")).toBe("203.0.113.0/24");
    expect(seatDeviceSourceBucket("2001:db8:12:34::1")).toBe("2001:db8:12::/48");
    expect(seatDeviceSourceBucket("2001:0DB8:0012:ffff:0:0:0:1")).toBe("2001:db8:12::/48");
    expect(seatDeviceSourceBucket("2001:db8::")).toBe("2001:db8:0::/48");
    expect(seatDeviceSourceBucket("::ffff:203.0.113.9")).toBe("203.0.113.0/24");
    expect(seatDeviceSourceBucket("64:ff9b::203.0.113.9")).toBe("64:ff9b:0::/48");
    expect(seatDeviceSourceBucket("not-an-ip")).toBeNull();
  });
});

describe("seat device identity", () => {
  it("projects a member identity with the membership role", () => {
    expect(seatDeviceIdentity({ userId: "u1", displayName: "坐席一", workspace: { id: "w1", name: "工作区" }, role: WorkspaceRole.OPERATOR })).toEqual({ subjectId: "user:u1", kind: "member", displayName: "坐席一", workspace: { id: "w1", name: "工作区" }, roles: ["OPERATOR"] });
  });
});

describe("seat device request validation", () => {
  const request = { deviceName: "  前台  电脑 ", clientType: "seat_desktop", clientVersion: "1.2.0-beta.1" };

  it("accepts the seat desktop client and normalizes the device label", () => {
    expect(parseSeatDeviceAuthorizationRequest(request)).toEqual({
      ok: true,
      value: { deviceLabel: "前台 电脑", clientType: "seat_desktop", clientVersion: "1.2.0-beta.1" },
    });
  });

  it("separates an unsupported client from malformed input", () => {
    expect(parseSeatDeviceAuthorizationRequest({ ...request, clientType: "codex" })).toEqual({ ok: false, code: "client_not_supported" });
    for (const body of [
      { ...request, extra: 1 },
      { ...request, deviceName: "x" },
      { ...request, deviceName: "a\u0007b" },
      { ...request, clientVersion: "" },
      { ...request, clientVersion: "1.0 beta" },
      { deviceName: "前台电脑", clientType: "seat_desktop" },
      null,
      "text",
    ]) {
      expect(parseSeatDeviceAuthorizationRequest(body)).toEqual({ ok: false, code: "invalid_input" });
    }
    expect(SEAT_DEVICE_ERROR_STATUS.client_not_supported).toBe(400);
  });

  it("checks token shapes and rejects unknown fields on every body", () => {
    const pollToken = mintSeatDeviceToken("poll").token;
    const refreshToken = mintSeatDeviceToken("refresh").token;
    expect(parseSeatDeviceRequest(SEAT_DEVICE_POLL_REQUEST_SCHEMA, { requestId: "c1", pollToken })).toEqual({ ok: true, value: { requestId: "c1", pollToken } });
    expect(parseSeatDeviceRequest(SEAT_DEVICE_POLL_REQUEST_SCHEMA, { requestId: "c1", pollToken: refreshToken }).ok).toBe(false);
    expect(parseSeatDeviceRequest(SEAT_DEVICE_POLL_REQUEST_SCHEMA, { requestId: "c 1", pollToken }).ok).toBe(false);
    expect(parseSeatDeviceRequest(SEAT_DEVICE_POLL_REQUEST_SCHEMA, { requestId: "c1", pollToken, x: 1 }).ok).toBe(false);
    expect(SEAT_DEVICE_REVOKE_REASONS).toEqual(expect.arrayContaining(["client_cancelled", "device_logout", "refresh_reuse"]));
  });

  it("closes the client revoke reason to device_logout (default) and client_cancelled", () => {
    const refreshToken = mintSeatDeviceToken("refresh").token;
    expect(parseSeatDeviceRevokeRequest({ refreshToken })).toEqual({ ok: true, value: { refreshToken, reason: "device_logout" } });
    expect(parseSeatDeviceRevokeRequest({ refreshToken, reason: "device_logout" })).toEqual({ ok: true, value: { refreshToken, reason: "device_logout" } });
    expect(parseSeatDeviceRevokeRequest({ refreshToken, reason: "client_cancelled" })).toMatchObject({ value: { reason: "client_cancelled" } });
    for (const reason of ["admin", "refresh_reuse", "self", "DEVICE_LOGOUT", "", null, 1]) {
      expect(parseSeatDeviceRevokeRequest({ refreshToken, reason })).toEqual({ ok: false, code: "request_invalid" });
    }
    expect(SEAT_DEVICE_ERROR_STATUS.request_invalid).toBe(400);
    expect(parseSeatDeviceRevokeRequest({ refreshToken: "hsdr_short" })).toEqual({ ok: false, code: "invalid_input" });
    expect(parseSeatDeviceRevokeRequest({ refreshToken, reason: "device_logout", extra: 1 })).toEqual({ ok: false, code: "invalid_input" });
  });

  it("normalizes pairing codes in lookup and decision bodies", () => {
    expect(parseSeatDeviceRequest(SEAT_DEVICE_LOOKUP_REQUEST_SCHEMA, { pairingCode: "bcdf-ghjk" })).toEqual({ ok: true, value: { pairingCode: "BCDFGHJK" } });
    expect(parseSeatDeviceRequest(SEAT_DEVICE_LOOKUP_REQUEST_SCHEMA, { pairingCode: "BCDF-GHJA" }).ok).toBe(false);
    expect(parseSeatDeviceRequest(SEAT_DEVICE_DECISION_REQUEST_SCHEMA, { requestId: "c1", pairingCode: "BCDFGHJK" }).ok).toBe(true);
    expect(parseSeatDeviceRequest(SEAT_DEVICE_DECISION_REQUEST_SCHEMA, { pairingCode: "BCDFGHJK" }).ok).toBe(false);
  });
});
