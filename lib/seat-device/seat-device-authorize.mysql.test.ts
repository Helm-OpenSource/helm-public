// lib/seat-device/seat-device-authorize.mysql.test.ts
// Seat desktop device authorization (D1) request side on an isolated MySQL
// database: request (hash-only storage, pairing collisions, pending limits)
// and the device's cancel.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   DB_RESET_ALLOWLIST=<that db name>   (or CI=true with a *_ci / *_test name)
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { classifyResetTarget } from "@/lib/db-url";
import {
  SEAT_DEVICE_PENDING_LIMIT_GLOBAL,
  hashSeatDevicePairingCode,
  hashSeatDeviceToken,
  normalizeSeatDevicePairingCode,
} from "@/lib/seat-device/contract";
import {
  SeatDeviceAuthDisabledError,
  SeatDeviceAuthError,
  cancelSeatDeviceAuthorization,
  requestSeatDeviceAuthorization,
} from "@/lib/seat-device/store-authorize";

const integrationDatabaseUrl = process.env.SEAT_DEVICE_DATABASE_URL;
if (process.env.SEAT_DEVICE_MYSQL_REQUIRED === "1" && !integrationDatabaseUrl) {
  throw new Error("SEAT_DEVICE_MYSQL_REQUIRED=1 but SEAT_DEVICE_DATABASE_URL is missing.");
}
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;

// Each test runs on its own clock so live pending rows of one test never
// count toward another's limits.
let clock = Date.parse("2031-01-01T00:00:00.000Z");
function nextClock() {
  clock += 24 * 60 * 60 * 1000;
  return new Date(clock);
}
const at = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);

async function expectCode(promise: Promise<unknown>, code: SeatDeviceAuthError["code"]) {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(SeatDeviceAuthError);
  expect((error as SeatDeviceAuthError).code).toBe(code);
  return error as SeatDeviceAuthError;
}

const device = { deviceLabel: "前台电脑", clientType: "seat_desktop" as const, clientVersion: "1.0.0" };
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `198.51.${sourceCounter}.10`;
}

describeMysql("seat device authorization (request, cancel) on MySQL", () => {
  const previousEnv = process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
  const request = (now: Date, source: string | null = freshSource(), generatePairingCode?: () => string) =>
    requestSeatDeviceAuthorization({ ...device, source, now, generatePairingCode });

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal SEAT_DEVICE_DATABASE_URL for the isolated integration test.");
    }
    // The limits count rows across the whole table, so a re-run on the same
    // disposable database starts from an empty one. Clearing it is allowed only
    // on a database setup-db would also reset. This run's rows are kept: CI
    // then checks that the rollback refuses to drop them.
    const target = classifyResetTarget({
      databaseUrl: integrationDatabaseUrl,
      ci: process.env.CI === "true",
      allowlistedDatabases: (process.env.DB_RESET_ALLOWLIST ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
    });
    if (!target.canReset) {
      throw new Error(`Refusing to clear seat device rows in "${target.databaseName ?? "(unknown)"}": not a CI temporary or DB_RESET_ALLOWLIST database.`);
    }
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    await db.seatDeviceAuthorization.deleteMany({});
  });

  afterAll(async () => {
    if (previousEnv === undefined) delete process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
    else process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = previousEnv;
    await db.$disconnect();
  });

  it("stores only hashes of the poll token and the pairing code", async () => {
    const now = nextClock();
    const source = freshSource();
    const grant = await request(now, source);
    expect(grant.pollToken).toMatch(/^hsdp_[A-Za-z0-9_-]{43}$/);
    expect(grant.pairingCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    expect(grant).toMatchObject({ expiresInSeconds: 600, intervalSeconds: 5 });
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row).toMatchObject({
      status: "pending",
      pollTokenHash: hashSeatDeviceToken(grant.pollToken),
      pairingCodeHash: hashSeatDevicePairingCode(grant.pairingCode),
      sourceIp: source,
      sourceBucket: source.replace(/\.10$/, ".0/24"),
      workspaceId: null,
      userId: null,
    });
    const stored = JSON.stringify(row);
    expect(stored).not.toContain(grant.pollToken);
    expect(stored).not.toContain(normalizeSeatDevicePairingCode(grant.pairingCode));

    // Without a trusted source nothing about the address is kept.
    const untrusted = await request(now, null);
    expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: untrusted.requestId } })).toMatchObject({ sourceIp: null, sourceBucket: null });
  });

  it("is unreachable while the deployment switch is off", async () => {
    const now = nextClock();
    const grant = await request(now);
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "false";
    try {
      await expect(request(now)).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
      await expect(cancelSeatDeviceAuthorization({ ...grant, now })).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
    } finally {
      process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    }
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } })).status).toBe("pending");
  });

  it("redraws a colliding pairing code, gives up after five, and frees lapsed codes", async () => {
    const now = nextClock();
    const fixed = "BCDFGHJK";
    await request(at(now, -700), null, () => fixed); // lapses before `now`
    const reused = await request(now, null, () => fixed);
    expect(reused.pairingCode).toBe("BCDF-GHJK");
    await expectCode(request(now, null, () => fixed), "temporarily_unavailable");
    const draws = [fixed, fixed, "LMNPQRST"];
    const retried = await request(now, null, () => draws.shift()!);
    expect(retried.pairingCode).toBe("LMNP-QRST");
  });

  it("limits pending requests per trusted address bucket and globally", async () => {
    const now = nextClock();
    const source = freshSource();
    for (let index = 0; index < 10; index += 1) await request(at(now, index), source);
    const limited = await expectCode(request(at(now, 30), source), "rate_limited");
    expect(limited.retryAfterSeconds).toBe(570);
    await request(at(now, 30), freshSource()); // another bucket
    await request(at(now, 30), null); // untrusted source: global cap only
    await request(at(now, 601), source); // window moved on

    const later = nextClock();
    const filler = Array.from({ length: SEAT_DEVICE_PENDING_LIMIT_GLOBAL }, (_, index) => ({
      clientType: "seat_desktop",
      deviceLabel: "filler",
      status: "pending",
      pollTokenHash: hashSeatDeviceToken(`filler-${suffix}-${index}`),
      requestedAt: later,
      requestExpiresAt: at(later, 600),
    }));
    await db.seatDeviceAuthorization.createMany({ data: filler });
    await expectCode(request(at(later, 1), null), "rate_limited");
    await request(at(later, 600), null); // the filler has lapsed
  });

  // Concurrent requests contend on the counted index ranges. Each answer must
  // be a grant or the closed rate_limited code with a Retry-After, never a
  // raw database error, and the rows written must match the grants.
  async function concurrentRequests(now: Date, sources: (string | null)[]) {
    const results = await Promise.allSettled(sources.map((source) => request(now, source)));
    for (const result of results) {
      if (result.status === "fulfilled") continue;
      expect(result.reason).toBeInstanceOf(SeatDeviceAuthError);
      expect((result.reason as SeatDeviceAuthError).code).toBe("rate_limited");
      expect((result.reason as SeatDeviceAuthError).retryAfterSeconds).toBeGreaterThan(0);
    }
    return results.filter((result) => result.status === "fulfilled").length;
  }

  it("answers 30 concurrent requests with grants or a closed rate limit", async () => {
    const now = nextClock();
    const granted = await concurrentRequests(now, Array.from({ length: 30 }, (_, index) => (index % 2 ? null : freshSource())));
    expect(granted).toBeGreaterThan(0);
    expect(await db.seatDeviceAuthorization.count({ where: { requestedAt: now } })).toBe(granted);
  });

  it("never lets concurrent requests overrun the per-bucket window", async () => {
    const now = nextClock();
    const source = freshSource();
    for (let index = 0; index < 9; index += 1) await request(now, source);
    const granted = await concurrentRequests(now, Array.from({ length: 30 }, () => source));
    expect(granted).toBeLessThanOrEqual(1);
    expect(await db.seatDeviceAuthorization.count({ where: { requestedAt: now } })).toBe(9 + granted);
  });

  it("cancels a pending request and never says whether a request exists", async () => {
    const now = nextClock();
    const pending = await request(now, freshSource());
    const otherToken = (await request(now)).pollToken;
    await expect(cancelSeatDeviceAuthorization({ requestId: pending.requestId, pollToken: otherToken, now })).resolves.toEqual({ status: "expired" });
    await expect(cancelSeatDeviceAuthorization({ requestId: "missing-request", pollToken: otherToken, now })).resolves.toEqual({ status: "expired" });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: pending.requestId } })).status).toBe("pending");

    await expect(cancelSeatDeviceAuthorization({ ...pending, now })).resolves.toEqual({ status: "cancelled" });
    const cancelled = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: pending.requestId } });
    expect(cancelled).toMatchObject({ status: "cancelled", pairingCodeHash: null, sourceIp: null });
    await expect(cancelSeatDeviceAuthorization({ ...pending, now: at(now, 1) })).resolves.toEqual({ status: "cancelled" });

    const lapsed = await request(now);
    await expect(cancelSeatDeviceAuthorization({ ...lapsed, now: at(now, 600) })).resolves.toEqual({ status: "expired" });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: lapsed.requestId } })).pairingCodeHash).toBeNull();
  });
});
