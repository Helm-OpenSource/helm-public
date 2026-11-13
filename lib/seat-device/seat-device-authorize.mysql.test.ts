// lib/seat-device/seat-device-authorize.mysql.test.ts
// Seat desktop device authorization (D1) request side on an isolated MySQL
// database: request (hash-only storage, pairing collisions, pending limits),
// pairing-code lookup with its lockout, approve (password step-up, binding, device cap,
// audit and notification) and reject, and the device's cancel.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   DB_RESET_ALLOWLIST=<that db name>   (or CI=true with a *_ci / *_test name)
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)

import { MembershipStatus, WorkspaceRole, WorkspaceStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/auth/formal-auth";
import { hashLoginIdentifier } from "@/lib/auth/login-rate-limit";
import { db } from "@/lib/db";
import { classifyResetTarget } from "@/lib/db-url";
import {
  SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES,
  SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES_PER_SOURCE_BUCKET,
  SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS,
  SEAT_DEVICE_PENDING_LIMIT_GLOBAL,
  hashSeatDevicePairingCode,
  hashSeatDeviceToken,
  normalizeSeatDevicePairingCode,
} from "@/lib/seat-device/contract";
import {
  SeatDeviceAuthDisabledError,
  SeatDeviceAuthError,
  type SeatDevicePasswordProof,
  cancelSeatDeviceAuthorization,
  claimSeatDeviceAuthorization,
  decideSeatDeviceAuthorization,
  lookupSeatDeviceAuthorization,
  requestSeatDeviceAuthorization,
  verifySeatDeviceApprovalPassword,
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

const PASSWORD = "correct horse battery";
const PASSWORD_HASH = hashPassword(PASSWORD);
const device = { deviceLabel: "前台电脑", clientType: "seat_desktop" as const, clientVersion: "1.0.0" };
// Code-entry lockouts persist per address bucket and the test clock repeats
// on every run, so each run draws its own /24s (two random octets): with one
// random octet a database reused for many runs kept meeting an earlier run's
// lock at the same instant.
const runOctets = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `10.${runOctets[0]}.${(runOctets[1] + sourceCounter) % 256}.10`;
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
        passwordHash: PASSWORD_HASH,
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

  // A real proof: the member's password verified at `verifiedAt`.
  const proofAt = (who: Member, verifiedAt: Date) =>
    verifySeatDeviceApprovalPassword({ userId: who.userId, password: PASSWORD, now: verifiedAt });

  // By default the password was verified 30 seconds before `now`.
  async function decide(
    who: Member,
    grant: { requestId: string; pairingCode: string },
    now: Date,
    decision: "approve" | "reject" = "approve",
    sessionId?: string,
    passwordProof?: SeatDevicePasswordProof | null,
  ) {
    return decideSeatDeviceAuthorization({
      authSessionId: sessionId ?? (await session(who, at(now, -60))),
      userId: who.userId,
      requestId: grant.requestId,
      pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode) ?? grant.pairingCode,
      decision,
      passwordProof: passwordProof === undefined ? await proofAt(who, at(now, -30)) : passwordProof,
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
      await expect(
        lookupSeatDeviceAuthorization({ authSessionId: await session(who, at(now, -60)), userId: who.userId, pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode)!, source: null, now }),
      ).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
      await expect(claimSeatDeviceAuthorization({ ...grant, source: null, now })).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
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
    expect(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES).toBe(8);
    expect(SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS).toBe(900);
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

  });

  // Owner ruling 2026-11-11: one office shares an address bucket, so the
  // bucket locks at 30 wrong codes in 15 minutes, for 15 minutes; each
  // account still locks at 8, so it takes several accounts to get there.
  it("locks a trusted address bucket after thirty failures across accounts", async () => {
    const now = at(nextClock(), 5);
    expect(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES_PER_SOURCE_BUCKET).toBe(30);
    const bucketSource = freshSource();
    const grant = await request(now, bucketSource);
    const wrongCodes = async (count: number, from: string | null = bucketSource) => {
      const who = await member();
      const sessionId = await session(who, at(now, -60));
      for (let index = 0; index < count; index += 1) {
        await expectCode(
          lookupSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, pairingCode: "ZZZZZZZZ", source: from, now }),
          "pairing_code_invalid",
        );
      }
      return { who, sessionId };
    };
    const bucketCounter = () =>
      db.failedLoginAttempt.findUniqueOrThrow({ where: { identifierHash: hashLoginIdentifier(`seat-device-code:ip:${bucketSource.replace(/10$/, "0")}/24`) } });
    // 29 failures from four accounts: the bucket is still open.
    for (const count of [8, 8, 8, 5]) await wrongCodes(count);
    expect(await bucketCounter()).toMatchObject({ attemptCount: 29, lockedUntil: null });
    // The 30th, from another address in the same /24, locks the bucket.
    await wrongCodes(1, bucketSource.replace(/10$/, "99"));
    expect(await bucketCounter()).toMatchObject({ attemptCount: 30, lockedUntil: at(now, 900) });
    const fresh = await member();
    const locked = await expectCode(
      lookupSeatDeviceAuthorization({ authSessionId: await session(fresh, at(now, -60)), userId: fresh.userId, pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode)!, source: bucketSource, now }),
      "rate_limited",
    );
    expect(locked.retryAfterSeconds).toBe(900);
    // Another bucket and an untrusted source are not affected.
    await wrongCodes(1, freshSource());
    await wrongCodes(1, null);
  });

  // The bucket window is 15 minutes from its first failure: a failure at
  // +899 seconds still counts (the 30th locks), one at +900 opens a new window.
  it("keeps a failure at +899 seconds in the bucket window and opens a new one at +900", async () => {
    const start = at(nextClock(), 5);
    const wrongCodes = async (source: string, count: number, now: Date) => {
      for (let done = 0; done < count; done += 8) {
        const who = await member();
        const sessionId = await session(who, at(now, -60));
        for (let index = done; index < Math.min(count, done + 8); index += 1) {
          await expectCode(
            lookupSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, pairingCode: "ZZZZZZZZ", source, now }),
            "pairing_code_invalid",
          );
        }
      }
    };
    const counter = (source: string) =>
      db.failedLoginAttempt.findUniqueOrThrow({ where: { identifierHash: hashLoginIdentifier(`seat-device-code:ip:${source.replace(/10$/, "0")}/24`) } });
    const [inWindow, nextWindow] = [freshSource(), freshSource()];
    for (const source of [inWindow, nextWindow]) await wrongCodes(source, 29, start);
    await wrongCodes(inWindow, 1, at(start, 899));
    expect(await counter(inWindow)).toMatchObject({ attemptCount: 30, windowStartedAt: start, lockedUntil: at(start, 899 + 900) });
    await wrongCodes(nextWindow, 1, at(start, 900));
    expect(await counter(nextWindow)).toMatchObject({ attemptCount: 1, windowStartedAt: at(start, 900), lockedUntil: null });
  });

  it("counts concurrent wrong codes against the limit, never past it", async () => {
    const now = nextClock();
    const who = await member();
    const sessionId = await session(who, at(now, -60));
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, () =>
        lookupSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, pairingCode: "ZZZZZZZZ", source: null, now }),
      ),
    );
    const codes = results.map((result) => {
      expect(result.status).toBe("rejected");
      const reason = (result as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(SeatDeviceAuthError);
      return (reason as SeatDeviceAuthError).code;
    });
    const invalid = codes.filter((code) => code === "pairing_code_invalid").length;
    expect(codes.filter((code) => code !== "pairing_code_invalid" && code !== "rate_limited")).toEqual([]);
    expect(invalid).toBeLessThanOrEqual(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES);
    const counter = await db.failedLoginAttempt.findUniqueOrThrow({
      where: { identifierHash: hashLoginIdentifier(`seat-device-code:user:${who.userId}`) },
    });
    expect(counter.attemptCount).toBe(invalid);
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

  it("requires a fresh password proof on a PASSWORD session of an active, internal member in an enabled workspace", async () => {
    const now = nextClock();
    const grant = await request(now);
    const who = await member();
    // A rotated session is a brand-new row (createdAt = now) whose holder never
    // typed the password: its age is no proof, only a password proof is.
    const rotated = await session(who, now);
    await expectCode(decide(who, grant, now, "approve", rotated, null), "reauthentication_required");
    await expectCode(decide(who, grant, now, "approve", rotated, await proofAt(who, at(now, -601))), "reauthentication_required");
    await expectCode(decide(who, grant, now, "approve", rotated, await proofAt(who, at(now, 1))), "reauthentication_required");
    // A look-alike object is no proof, nor is another member's.
    await expectCode(decide(who, grant, now, "approve", rotated, Object.freeze({}) as SeatDevicePasswordProof), "reauthentication_required");
    await expectCode(decide(who, grant, now, "approve", rotated, await proofAt(await member(), at(now, -30))), "reauthentication_required");
    // A proof of the password before it was changed is no proof either.
    const beforeChange = await proofAt(who, at(now, -30));
    await db.user.update({ where: { id: who.userId }, data: { passwordSetAt: at(now, -10) } });
    await expectCode(decide(who, grant, now, "approve", rotated, beforeChange), "reauthentication_required");
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
    // The session's age does not matter: a days-old session with a fresh proof approves.
    await expect(decide(who, grant, now, "approve", await session(who, at(now, -3 * 24 * 3600)), await proofAt(who, at(now, -600)))).resolves.toMatchObject({ status: "approved" });
  });

  it("approves once: binds member, workspace and password snapshot, audits and notifies", async () => {
    const now = nextClock();
    const grant = await request(now, freshSource());
    const who = await member();
    const sessionId = await session(who, at(now, -30));
    await expectCode(decideSeatDeviceAuthorization({ authSessionId: sessionId, userId: who.userId, requestId: grant.requestId, pairingCode: "ZZZZZZZZ", decision: "approve", passwordProof: await proofAt(who, at(now, -30)), source: null, now }), "pairing_code_invalid");
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
  async function approved(now: Date, source: string | null = null) {
    const grant = await request(now, source);
    const who = await member();
    await decide(who, grant, now);
    return { grant, who };
  }
  const claim = (grant: { requestId: string; pollToken: string }, now: Date, source: string | null = null) =>
    claimSeatDeviceAuthorization({ requestId: grant.requestId, pollToken: grant.pollToken, source, now });

  it("answers polls before approval, throttles them, and refuses a wrong poll token", async () => {
    const now = nextClock();
    const grant = await request(now);
    await expect(claim(grant, at(now, 5))).resolves.toEqual({ status: "pending" });
    const slow = await expectCode(claim(grant, at(now, 7)), "slow_down");
    expect(slow.retryAfterSeconds).toBe(3);
    await expectCode(claim({ requestId: grant.requestId, pollToken: (await request(now)).pollToken }, at(now, 20)), "poll_token_invalid");
    await cancelSeatDeviceAuthorization({ ...grant, now: at(now, 20) });
    await expect(claim(grant, at(now, 30))).resolves.toEqual({ status: "expired" }); // cancelled reads expired
    const rejected = await request(now);
    await decide(await member(), rejected, now, "reject");
    await expect(claim(rejected, at(now, 5))).resolves.toEqual({ status: "rejected" });
  });

  it("claims once: hash-only pair, identity, absolute expiry, audit", async () => {
    const now = nextClock();
    const source = freshSource();
    const { grant, who } = await approved(now, source);
    const answer = await claim(grant, at(now, 10), source);
    if (answer.status !== "approved") throw new Error("expected tokens");
    expect(answer.accessToken).toMatch(/^hsda_[A-Za-z0-9_-]{43}$/);
    expect(answer.refreshToken).toMatch(/^hsdr_[A-Za-z0-9_-]{43}$/);
    expect(answer).toMatchObject({
      expiresInSeconds: 900,
      refreshExpiresInSeconds: 30 * 24 * 3600 - 10,
      deviceId: grant.requestId,
      identity: { subjectId: `user:${who.userId}`, kind: "member", workspace: { id: workspaceId }, roles: ["OPERATOR"] },
    });
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row).toMatchObject({
      status: "active",
      accessTokenHash: hashSeatDeviceToken(answer.accessToken),
      refreshTokenHash: hashSeatDeviceToken(answer.refreshToken),
      refreshTokenUsed: false,
      rotationSource: source,
      claimedAt: at(now, 10),
      expiresAt: at(now, 30 * 24 * 3600),
    });
    expect(JSON.stringify(row)).not.toContain(answer.refreshToken);
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: grant.requestId, actionType: "SEAT_DEVICE_CLAIMED" } });
    expect(audit.payload ?? "").not.toContain(answer.accessToken);
  });

  it("refuses to hand tokens to a member who changed since approval", async () => {
    const now = nextClock();
    const { grant, who } = await approved(now);
    await db.user.update({ where: { id: who.userId }, data: { passwordSetAt: at(now, 1) } });
    await expectCode(claim(grant, at(now, 10)), "poll_token_invalid");
    const second = await approved(now);
    await db.membership.update({ where: { id: second.who.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await expectCode(claim(second.grant, at(now, 10)), "poll_token_invalid");
    // Removed and re-added: ACTIVE and internal again, but not the membership approved.
    const replaced = await approved(now);
    const old = await db.membership.findUniqueOrThrow({ where: { id: replaced.who.membershipId } });
    await db.membership.delete({ where: { id: old.id } });
    await db.membership.create({ data: { workspaceId: old.workspaceId, userId: old.userId, role: old.role, status: MembershipStatus.ACTIVE } });
    await expectCode(claim(replaced.grant, at(now, 10)), "poll_token_invalid");
    const external = await approved(now);
    await db.membership.update({ where: { id: external.who.membershipId }, data: { accessScope: "partner_portal" } });
    await expectCode(claim(external.grant, at(now, 10)), "poll_token_invalid");
    for (const refused of [grant, second.grant, replaced.grant, external.grant]) {
      expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: refused.requestId } })).toMatchObject({ status: "approved", accessTokenHash: null });
    }
  });

  // Review of #551: the workspace is re-checked at claim. Switched off or
  // suspended answers workspace_not_enabled and leaves the request claimable.
  it("refuses to hand tokens while the workspace is off or suspended, and keeps the request", async () => {
    const now = nextClock();
    const { grant } = await approved(now);
    for (const data of [{ featureFlagsJson: "{}" }, { status: WorkspaceStatus.SUSPENDED }]) {
      await db.workspace.update({ where: { id: workspaceId }, data });
      try {
        await expectCode(claim(grant, at(now, 10)), "workspace_not_enabled");
      } finally {
        await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }), status: WorkspaceStatus.ACTIVE } });
      }
      expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } })).toMatchObject({ status: "approved", accessTokenHash: null });
    }
    await expect(claim(grant, at(now, 10))).resolves.toMatchObject({ status: "approved" });
    // The member is judged first: one who left reads poll_token_invalid (the
    // client gives up), not workspace_not_enabled (it would keep polling).
    const left = await approved(now);
    await db.membership.update({ where: { id: left.who.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: "{}" } });
    try {
      await expectCode(claim(left.grant, at(now, 10)), "poll_token_invalid");
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }) } });
    }
  });

  it("re-claims once within 60 seconds from the same trusted source and retires the first pair", async () => {
    const now = nextClock();
    const source = freshSource();
    const { grant } = await approved(now, source);
    const first = await claim(grant, at(now, 10), source);
    if (first.status !== "approved") throw new Error("expected tokens");
    await expectCode(claim(grant, at(now, 20), freshSource()), "poll_token_invalid"); // other source
    await expectCode(claim(grant, at(now, 30), null), "poll_token_invalid"); // untrusted
    const again = await claim(grant, at(now, 40), source);
    if (again.status !== "approved") throw new Error("expected tokens");
    expect(again.refreshToken).not.toBe(first.refreshToken);
    const row = await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: grant.requestId } });
    expect(row).toMatchObject({ reclaimed: true, refreshTokenHash: hashSeatDeviceToken(again.refreshToken), previousRefreshTokenHash: null });
    const retired = await db.seatDeviceTokenHistory.findMany({ where: { deviceId: grant.requestId } });
    expect(retired.map((entry) => [entry.kind, entry.tokenHash]).sort()).toEqual(
      [["access", hashSeatDeviceToken(first.accessToken)], ["refresh", hashSeatDeviceToken(first.refreshToken)]].sort(),
    );
    await expectCode(claim(grant, at(now, 50), source), "poll_token_invalid"); // only once

    const late = await approved(now, source);
    await claim(late.grant, at(now, 10), source);
    await expectCode(claim(late.grant, at(now, 71), source), "poll_token_invalid"); // past 60 s
    const used = await approved(now, source);
    await claim(used.grant, at(now, 10), source);
    await db.seatDeviceAuthorization.update({ where: { id: used.grant.requestId }, data: { refreshTokenUsed: true } });
    await expectCode(claim(used.grant, at(now, 20), source), "poll_token_invalid"); // pair already used
    const rotated = await approved(now, source);
    await claim(rotated.grant, at(now, 10), source);
    await db.seatDeviceAuthorization.update({ where: { id: rotated.grant.requestId }, data: { rotatedAt: at(now, 15) } });
    await expectCode(claim(rotated.grant, at(now, 20), source), "poll_token_invalid"); // pair already refreshed
  });

  it("cancel revokes a claimed device whose pair was never used, and leaves a used one", async () => {
    const now = nextClock();
    const unused = await approved(now, freshSource());
    await claim(unused.grant, at(now, 10));
    await expect(cancelSeatDeviceAuthorization({ ...unused.grant, now: at(now, 3600) })).resolves.toEqual({ status: "cancelled" });
    expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: unused.grant.requestId } })).toMatchObject({ status: "revoked", revokeReason: "client_cancelled", sourceIp: null });
    const revokedAudit = await db.auditLog.findFirstOrThrow({ where: { targetId: unused.grant.requestId, actionType: "SEAT_DEVICE_REVOKED" } });
    expect(JSON.parse(revokedAudit.payload ?? "{}")).toMatchObject({ reason: "client_cancelled", refreshTokenPresented: false });
    await expect(cancelSeatDeviceAuthorization({ ...unused.grant, now: at(now, 3601) })).resolves.toEqual({ status: "revoked" });
    await expectCode(claim(unused.grant, at(now, 3700)), "poll_token_invalid");

    const used = await approved(now);
    await claim(used.grant, at(now, 10));
    await db.seatDeviceAuthorization.update({ where: { id: used.grant.requestId }, data: { refreshTokenUsed: true } });
    await expect(cancelSeatDeviceAuthorization({ ...used.grant, now: at(now, 20) })).resolves.toEqual({ status: "claimed" });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: used.grant.requestId } })).status).toBe("active");
    const rotated = await approved(now);
    await claim(rotated.grant, at(now, 10));
    await db.seatDeviceAuthorization.update({ where: { id: rotated.grant.requestId }, data: { rotatedAt: at(now, 15) } });
    await expect(cancelSeatDeviceAuthorization({ ...rotated.grant, now: at(now, 20) })).resolves.toEqual({ status: "claimed" });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: rotated.grant.requestId } })).status).toBe("active");
  });
});
