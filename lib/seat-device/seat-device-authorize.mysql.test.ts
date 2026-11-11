// lib/seat-device/seat-device-authorize.mysql.test.ts
// Seat desktop device authorization (D1) request side on an isolated MySQL
// database: request (hash-only storage, pairing collisions, pending limits),
// pairing-code lookup with its lockout, approve (step-up, binding, device cap,
// audit and notification) and reject, and the device's cancel.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   DB_RESET_ALLOWLIST=<that db name>   (or CI=true with a *_ci / *_test name)
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LOGIN_RATE_LIMIT, hashLoginIdentifier } from "@/lib/auth/login-rate-limit";
import { db } from "@/lib/db";
import { classifyResetTarget } from "@/lib/db-url";
import {
  SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES,
  SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS,
  SEAT_DEVICE_PENDING_LIMIT_GLOBAL,
  hashSeatDevicePairingCode,
  hashSeatDeviceToken,
  normalizeSeatDevicePairingCode,
} from "@/lib/seat-device/contract";
import {
  SeatDeviceAuthDisabledError,
  SeatDeviceAuthError,
  cancelSeatDeviceAuthorization,
  decideSeatDeviceAuthorization,
  lookupSeatDeviceAuthorization,
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
// Code-entry lockouts persist per address bucket, so each run takes its own
// /16 and a re-run on the same database starts unlocked.
const runOctet = Math.floor(Math.random() * 256);
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `10.${runOctet}.${sourceCounter}.10`;
}

describeMysql("seat device authorization (request, decide, cancel) on MySQL", () => {
  const previousEnv = process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
  let workspaceId = "";
  let otherWorkspaceId = "";
  let memberCount = 0;

  type Member = { userId: string; membershipId: string };
  async function member(options: { status?: MembershipStatus; accessScope?: string | null; workspace?: string } = {}): Promise<Member> {
    memberCount += 1;
    const user = await db.user.create({
      data: {
        email: `seat-device-${memberCount}-${suffix}@example.com`,
        name: `坐席 ${memberCount}`,
        passwordSetAt: new Date("2030-06-01T00:00:00.000Z"),
      },
    });
    const membership = await db.membership.create({
      data: {
        workspaceId: options.workspace ?? workspaceId,
        userId: user.id,
        role: WorkspaceRole.OPERATOR,
        status: options.status ?? MembershipStatus.ACTIVE,
        accessScope: options.accessScope ?? null,
      },
    });
    return { userId: user.id, membershipId: membership.id };
  }

  async function session(who: Member, createdAt: Date, options: { providerType?: string; workspace?: string } = {}) {
    const row = await db.authSession.create({
      data: {
        userId: who.userId,
        activeWorkspaceId: options.workspace ?? workspaceId,
        sessionKeyHash: hashSeatDeviceToken(`session-${who.userId}-${createdAt.getTime()}-${Math.random()}`),
        providerType: options.providerType ?? "PASSWORD",
        createdAt,
        expiresAt: at(createdAt, 14 * 24 * 3600),
      },
    });
    return row.id;
  }

  const request = (now: Date, source: string | null = freshSource(), generatePairingCode?: () => string) =>
    requestSeatDeviceAuthorization({ ...device, source, now, generatePairingCode });

  async function decide(who: Member, grant: { requestId: string; pairingCode: string }, now: Date, decision: "approve" | "reject" = "approve", sessionId?: string) {
    return decideSeatDeviceAuthorization({
      authSessionId: sessionId ?? (await session(who, at(now, -60))),
      userId: who.userId,
      requestId: grant.requestId,
      pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode) ?? grant.pairingCode,
      decision,
      source: null,
      now,
    });
  }

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
    const workspace = await db.workspace.create({
      data: { name: `坐席设备 ${suffix}`, slug: `seat-device-${suffix}`, featureFlagsJson: JSON.stringify({ seatDesktop: true }) },
    });
    workspaceId = workspace.id;
    const other = await db.workspace.create({ data: { name: `未开通 ${suffix}`, slug: `seat-device-off-${suffix}` } });
    otherWorkspaceId = other.id;
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
      const who = await member();
      await expect(decide(who, grant, now)).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
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

  it("locks pairing-code entry after eight failures, before looking at the code", async () => {
    const now = nextClock();
    expect(LOGIN_RATE_LIMIT.maxAttempts).toBe(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES);
    expect(LOGIN_RATE_LIMIT.windowMs).toBe(SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS * 1000);
    const source = freshSource();
    const grant = await request(now, source);
    const who = await member();
    const sessionId = await session(who, at(now, -60));
    const lookup = (pairingCode: string, from: string | null = null) =>
      lookupSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, pairingCode, source: from, now: at(now, 5) });

    const found = await lookup(normalizeSeatDevicePairingCode(grant.pairingCode)!);
    expect(found).toMatchObject({
      requestId: grant.requestId,
      deviceName: "前台电脑",
      clientVersion: "1.0.0",
      clientReported: ["deviceName", "clientVersion"],
      source,
      expiresInSeconds: 595,
      workspace: { name: `坐席设备 ${suffix}` },
    });
    for (let index = 0; index < SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES; index += 1) {
      await expectCode(lookup("ZZZZZZZZ"), "pairing_code_invalid");
    }
    const locked = await expectCode(lookup(normalizeSeatDevicePairingCode(grant.pairingCode)!), "rate_limited");
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    // A wrong code on approve counts too, and the lock holds for approve.
    await expectCode(decide(who, grant, at(now, 5), "approve", sessionId), "rate_limited");
    const counter = await db.failedLoginAttempt.findUniqueOrThrow({
      where: { identifierHash: hashLoginIdentifier(`seat-device-code:user:${who.userId}`) },
    });
    expect(counter.attemptCount).toBe(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES);

    // With a trusted source the address bucket locks as well, across accounts.
    const bucketSource = freshSource();
    const first = await member();
    const firstSession = await session(first, at(now, -60));
    for (let index = 0; index < SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES; index += 1) {
      await expectCode(
        lookupSeatDeviceAuthorization({ authSessionId: firstSession, userId: first.userId, pairingCode: "ZZZZZZZZ", source: bucketSource, now: at(now, 5) }),
        "pairing_code_invalid",
      );
    }
    const second = await member();
    await expectCode(
      lookupSeatDeviceAuthorization({ authSessionId: await session(second, at(now, -60)), userId: second.userId, pairingCode: "ZZZZZZZZ", source: bucketSource.replace(/10$/, "99"), now: at(now, 5) }),
      "rate_limited",
    );
  });

  it("hides the source when it is not trusted and refuses lapsed codes", async () => {
    const now = nextClock();
    const grant = await request(now, null);
    const who = await member();
    const sessionId = await session(who, at(now, -60));
    const code = normalizeSeatDevicePairingCode(grant.pairingCode)!;
    const found = await lookupSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, pairingCode: code, source: null, now });
    expect(found.source).toBeNull();
    await expectCode(
      lookupSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, pairingCode: code, source: null, now: at(now, 600) }),
      "pairing_code_invalid",
    );
    // Touching the lapsed row cleared its pairing hash.
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } })).pairingCodeHash).toBeNull();
  });

  it("requires a recent PASSWORD session of an active, internal member in an enabled workspace", async () => {
    const now = nextClock();
    const grant = await request(now);
    const who = await member();
    await expectCode(decide(who, grant, now, "approve", await session(who, at(now, -601))), "reauthentication_required");
    await expectCode(decide(who, grant, now, "approve", await session(who, at(now, -60), { providerType: "PHONE_CODE" })), "reauthentication_required");
    const stranger = await member();
    await expectCode(decide(who, grant, now, "approve", await session(stranger, at(now, -60))), "reauthentication_required");
    const revoked = await session(who, at(now, -60));
    await db.authSession.update({ where: { id: revoked }, data: { revokedAt: at(now, -1) } });
    await expectCode(decide(who, grant, now, "approve", revoked), "reauthentication_required");
    await expectCode(decide(await member({ status: MembershipStatus.INACTIVE }), grant, now), "forbidden");
    await expectCode(decide(await member({ accessScope: "partner_portal" }), grant, now), "forbidden");
    const elsewhere = await member({ workspace: otherWorkspaceId });
    await expectCode(
      decide(elsewhere, grant, now, "approve", await session(elsewhere, at(now, -60), { workspace: otherWorkspaceId })),
      "workspace_not_enabled",
    );
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row).toMatchObject({ status: "pending", version: 0, workspaceId: null });
    expect(await db.failedLoginAttempt.count({ where: { identifierHash: hashLoginIdentifier(`seat-device-code:user:${who.userId}`) } })).toBe(0);
  });

  it("approves once: binds member, workspace and password snapshot, audits and notifies", async () => {
    const now = nextClock();
    const grant = await request(now, freshSource());
    const who = await member();
    const sessionId = await session(who, at(now, -30));
    await expectCode(decideSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, requestId: grant.requestId, pairingCode: "ZZZZZZZZ", decision: "approve", source: null, now }), "pairing_code_invalid");
    const failures = await db.failedLoginAttempt.findUniqueOrThrow({ where: { identifierHash: hashLoginIdentifier(`seat-device-code:user:${who.userId}`) } });
    expect(failures.attemptCount).toBe(1);
    await expect(decide(who, grant, now, "approve", sessionId)).resolves.toEqual({ requestId: grant.requestId, status: "approved" });
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row).toMatchObject({
      status: "approved",
      version: 1,
      workspaceId,
      userId: who.userId,
      membershipId: who.membershipId,
      userPasswordSetAt: new Date("2030-06-01T00:00:00.000Z"),
      approvedAuthSessionId: sessionId,
      decidedByUserId: who.userId,
      decidedAt: now,
      expiresAt: at(now, 30 * 24 * 3600),
      pairingCodeHash: null,
      accessTokenHash: null,
      refreshTokenHash: null,
    });
    await expectCode(decide(who, grant, at(now, 1), "approve", sessionId), "pairing_code_invalid");

    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: grant.requestId, actionType: "SEAT_DEVICE_AUTHORIZATION_APPROVED" } });
    expect(audit).toMatchObject({ workspaceId, userId: who.userId });
    const notification = await db.notification.findFirstOrThrow({ where: { workspaceId, userId: who.userId } });
    expect(notification.body).toContain("前台电脑");
    for (const text of [audit.payload ?? "", audit.summary, notification.title, notification.body]) {
      expect(text).not.toContain(grant.pollToken);
      expect(text).not.toContain(normalizeSeatDevicePairingCode(grant.pairingCode));
      expect(text).not.toContain(grant.pairingCode);
    }
  });

  it("caps a member at three live devices, also under concurrent approvals", async () => {
    const now = nextClock();
    const who = await member();
    const sessionId = await session(who, at(now, -30));
    const grants = await Promise.all([0, 1, 2, 3].map(() => request(now)));
    const results = await Promise.allSettled(grants.map((grant) => decide(who, grant, now, "approve", sessionId)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect((failed.reason as SeatDeviceAuthError).code).toBe("too_many_devices");
    expect(await db.seatDeviceAuthorization.count({ where: { userId: who.userId, status: "approved" } })).toBe(3);
    // Unclaimed approvals lapse with the request; then there is room again.
    const later = at(now, 601);
    const grant = await request(later);
    await expect(decide(who, grant, later, "approve", await session(who, at(later, -30)))).resolves.toMatchObject({ status: "approved" });
  });

  it("rejects with any usable member session and clears the code and source", async () => {
    const now = nextClock();
    const grant = await request(now, freshSource());
    const who = await member();
    const phoneSession = await session(who, at(now, -3600), { providerType: "PHONE_CODE" });
    await expect(decide(who, grant, now, "reject", phoneSession)).resolves.toEqual({ requestId: grant.requestId, status: "rejected" });
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row).toMatchObject({ status: "rejected", pairingCodeHash: null, sourceIp: null, userId: null, workspaceId, decidedByUserId: who.userId });
    expect(await db.auditLog.count({ where: { targetId: grant.requestId, actionType: "SEAT_DEVICE_AUTHORIZATION_REJECTED" } })).toBe(1);
    await expect(cancelSeatDeviceAuthorization({ ...grant, now })).resolves.toEqual({ status: "rejected" });
  });

  it("cancels pending and approved requests and never says whether a request exists", async () => {
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

    const approved = await request(now);
    await decide(await member(), approved, now);
    await expect(cancelSeatDeviceAuthorization({ ...approved, now })).resolves.toEqual({ status: "cancelled" });
    expect(await db.auditLog.count({ where: { targetId: approved.requestId, actionType: "SEAT_DEVICE_AUTHORIZATION_CANCELLED" } })).toBe(1);

    const lapsed = await request(now);
    await expect(cancelSeatDeviceAuthorization({ ...lapsed, now: at(now, 600) })).resolves.toEqual({ status: "expired" });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: lapsed.requestId } })).pairingCodeHash).toBeNull();
  });

  it("lets exactly one of a racing approve and cancel win", async () => {
    const now = nextClock();
    const who = await member();
    const sessionId = await session(who, at(now, -30));
    for (let round = 0; round < 3; round += 1) {
      const grant = await request(now);
      const [approve, cancel] = await Promise.allSettled([
        decide(who, grant, now, "approve", sessionId),
        cancelSeatDeviceAuthorization({ ...grant, now }),
      ]);
      const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
      expect(cancel.status).toBe("fulfilled");
      if (approve.status === "fulfilled") {
        expect((cancel as PromiseFulfilledResult<{ status: string }>).value.status).toBe("cancelled");
        expect(row.status).toBe("cancelled");
        expect(row.version).toBe(2);
      } else {
        expect((approve.reason as SeatDeviceAuthError).code).toBe("pairing_code_invalid");
        expect(row).toMatchObject({ status: "cancelled", version: 1, userId: null });
      }
    }
  });
});
