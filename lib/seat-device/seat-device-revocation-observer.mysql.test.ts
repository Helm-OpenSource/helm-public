// lib/seat-device/seat-device-revocation-observer.mysql.test.ts
// The revocation observer on an isolated MySQL database: every revoking path
// of the device store tells a registered observer once, after its commit;
// a rolled-back or retried attempt tells nothing; an observer that throws,
// rejects or never settles changes no answer; no registration changes nothing.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)
//
// Devices are made through the real request -> approve -> claim path. Its
// clock starts years after the other seat device files', so rows left by
// any of them never count toward another's limits.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/auth/formal-auth";
import { db } from "@/lib/db";
import { hashSeatDeviceToken, normalizeSeatDevicePairingCode } from "@/lib/seat-device/contract";
import { registerSeatDeviceRevocationObserver, type SeatDeviceRevocationNotice } from "@/lib/seat-device/revocation-observer";
import {
  SeatDeviceAuthError,
  cancelSeatDeviceAuthorization,
  claimSeatDeviceAuthorization,
  decideSeatDeviceAuthorization,
  requestSeatDeviceAuthorization,
  verifySeatDeviceApprovalPassword,
} from "@/lib/seat-device/store-authorize";
import {
  pinSeatDeviceAudienceInTx,
  refreshSeatDeviceToken,
  revokeSeatDeviceByMember,
  revokeSeatDeviceWithRefreshToken,
  revokeSeatDevicesInTx,
} from "@/lib/seat-device/store-tokens";

const integrationDatabaseUrl = process.env.SEAT_DEVICE_DATABASE_URL;
if (process.env.SEAT_DEVICE_MYSQL_REQUIRED === "1" && !integrationDatabaseUrl) {
  throw new Error("SEAT_DEVICE_MYSQL_REQUIRED=1 but SEAT_DEVICE_DATABASE_URL is missing.");
}
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;
const PASSWORD = "correct horse battery";
const PASSWORD_HASH = hashPassword(PASSWORD);
const OBSERVER_KEY = Symbol.for("helm.seat-device-revocation-observer");

let clock = Date.parse("2061-01-01T00:00:00.000Z");
function nextClock() {
  clock += 24 * 60 * 60 * 1000;
  return new Date(clock);
}
const at = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);

const runOctets = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `13.${runOctets[0]}.${(runOctets[1] + sourceCounter) % 256}.10`;
}

// One registration for the file; each test sets what it does. It records the
// notices and the status each device has in a separate read at that moment,
// so a notice sent before the commit would see the device unrevoked.
type Behaviour = "record" | "throw" | "reject" | "hang";
const observed: { notices: SeatDeviceRevocationNotice[]; calls: number; statuses: string[]; behaviour: Behaviour; inFlight: number } = {
  notices: [],
  calls: 0,
  statuses: [],
  behaviour: "record",
  inFlight: 0,
};
async function observer(notices: readonly SeatDeviceRevocationNotice[]) {
  observed.calls += 1;
  observed.inFlight += 1;
  observed.notices.push(...notices);
  try {
    for (const notice of notices) {
      observed.statuses.push((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: notice.deviceId } })).status);
    }
  } finally {
    observed.inFlight -= 1;
  }
  if (observed.behaviour === "throw") throw new Error("observer failed");
  if (observed.behaviour === "reject") return Promise.reject(new Error("observer rejected"));
  if (observed.behaviour === "hang") return new Promise(() => undefined);
}
// The observer starts in a microtask queued before the revoking call returns;
// wait until every started call has read its rows, then a few more turns for
// a call that should not have started at all.
const settle = async () => {
  await vi.waitFor(() => expect(observed.inFlight).toBe(0), { timeout: 10_000 });
  await new Promise((resolve) => setTimeout(resolve, 50));
};

// Fails the first `count` transactions after their work as a write conflict,
// so the store's retry loop rolls that attempt back and runs it again.
function conflictFirst(count: number) {
  const real = db.$transaction.bind(db) as (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => Promise<unknown>;
  let left = count;
  return vi.spyOn(db, "$transaction").mockImplementation(((fn: (tx: unknown) => Promise<unknown>, options?: unknown) =>
    real(async (tx) => {
      const result = await fn(tx);
      if (left > 0) {
        left -= 1;
        throw new Error("seat device write conflict");
      }
      return result;
    }, options)) as never);
}

describeMysql("seat device revocation observer on MySQL", () => {
  const previousEnv = process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
  let workspaceId = "";
  let memberCount = 0;

  type Member = { userId: string; membershipId: string; workspaceId: string };
  async function member(role: WorkspaceRole = WorkspaceRole.OPERATOR): Promise<Member> {
    memberCount += 1;
    const user = await db.user.create({
      data: { email: `seat-observer-${memberCount}-${suffix}@example.com`, name: `坐席 ${memberCount}`, passwordHash: PASSWORD_HASH, passwordSetAt: new Date("2060-06-01T00:00:00.000Z") },
    });
    const membership = await db.membership.create({ data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE } });
    return { userId: user.id, membershipId: membership.id, workspaceId };
  }

  async function session(who: Member, now: Date) {
    const row = await db.authSession.create({
      data: {
        userId: who.userId,
        activeWorkspaceId: who.workspaceId,
        sessionKeyHash: hashSeatDeviceToken(`session-${who.userId}-${now.getTime()}-${Math.random()}`),
        providerType: "PASSWORD",
        createdAt: at(now, -60),
        expiresAt: at(now, 14 * 24 * 3600),
      },
    });
    return row.id;
  }

  async function device(now: Date, who?: Member) {
    const owner = who ?? (await member());
    const source = freshSource();
    const grant = await requestSeatDeviceAuthorization({ deviceLabel: "前台电脑", clientType: "seat_desktop", clientVersion: "1.0.0", source, now });
    await decideSeatDeviceAuthorization({
      authSessionId: await session(owner, now),
      userId: owner.userId,
      requestId: grant.requestId,
      pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode)!,
      decision: "approve",
      passwordProof: await verifySeatDeviceApprovalPassword({ userId: owner.userId, password: PASSWORD, now: at(now, -30) }),
      expectedWorkspaceId: owner.workspaceId,
      source: null,
      now,
    });
    const claimed = await claimSeatDeviceAuthorization({ requestId: grant.requestId, pollToken: grant.pollToken, source, now: at(now, 5) });
    if (claimed.status !== "approved") throw new Error("expected tokens");
    return { grant, owner, source, deviceId: grant.requestId, refreshToken: claimed.refreshToken };
  }

  const notice = (live: { deviceId: string; owner: Member }, reason: SeatDeviceRevocationNotice["reason"], actorUserId: string | null, audiencePin: string | null = null) => ({
    deviceId: live.deviceId,
    workspaceId,
    userId: live.owner.userId,
    membershipId: live.owner.membershipId,
    reason,
    actorUserId,
    audiencePin,
  });

  async function expectCode(promise: Promise<unknown>, code: SeatDeviceAuthError["code"]) {
    const error = await promise.then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(SeatDeviceAuthError);
    expect((error as SeatDeviceAuthError).code).toBe(code);
  }

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal SEAT_DEVICE_DATABASE_URL for the isolated integration test.");
    }
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    const workspace = await db.workspace.create({
      data: { name: `撤销观察 ${suffix}`, slug: `seat-observer-${suffix}`, featureFlagsJson: JSON.stringify({ seatDesktop: true }) },
    });
    workspaceId = workspace.id;
    registerSeatDeviceRevocationObserver(observer);
  });

  afterEach(async () => {
    await settle();
    vi.restoreAllMocks();
    Object.assign(observed, { notices: [], calls: 0, statuses: [], behaviour: "record", inFlight: 0 });
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, OBSERVER_KEY);
    if (previousEnv === undefined) delete process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
    else process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = previousEnv;
    await db.$disconnect();
  });

  it("device logout: one notice after the commit; a second logout none", async () => {
    const now = nextClock();
    const live = await device(now);
    await expect(revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now: at(now, 10) })).resolves.toBeUndefined();
    await settle();
    expect(observed).toMatchObject({ calls: 1, notices: [notice(live, "device_logout", null)], statuses: ["revoked"] });
    await revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now: at(now, 20) });
    await settle();
    expect(observed.calls).toBe(1);
  });

  it("member and admin revoke: the answer is exactly { revoked }, the notice names the actor", async () => {
    const now = nextClock();
    const own = await device(now);
    const admin = await member(WorkspaceRole.ADMIN);
    const theirs = await device(now);
    const ownAnswer = await revokeSeatDeviceByMember({ authSessionId: await session(own.owner, now), userId: own.owner.userId, deviceId: own.deviceId, now: at(now, 10) });
    expect(ownAnswer).toStrictEqual({ revoked: true });
    const adminAnswer = await revokeSeatDeviceByMember({ authSessionId: await session(admin, now), userId: admin.userId, deviceId: theirs.deviceId, now: at(now, 10) });
    expect(adminAnswer).toStrictEqual({ revoked: true });
    await expect(revokeSeatDeviceByMember({ authSessionId: await session(admin, now), userId: admin.userId, deviceId: theirs.deviceId, now: at(now, 20) })).resolves.toStrictEqual({ revoked: false });
    await settle();
    expect(observed.calls).toBe(2);
    expect(observed.notices).toEqual([notice(own, "self", own.owner.userId), notice(theirs, "admin", admin.userId)]);
    expect(observed.statuses).toEqual(["revoked", "revoked"]);
  });

  it("refresh reuse and a member who left: notified after the commit, then the same refusal", async () => {
    const now = nextClock();
    const live = await device(now);
    const rotated = await refreshSeatDeviceToken({ refreshToken: live.refreshToken, source: live.source, now: at(now, 10) });
    expect(rotated.refreshToken).toBeTruthy();
    await expectCode(refreshSeatDeviceToken({ refreshToken: live.refreshToken, source: null, now: at(now, 300) }), "token_revoked");
    await settle();
    expect(observed).toMatchObject({ calls: 1, notices: [notice(live, "refresh_reuse", null)], statuses: ["revoked"] });

    const leaver = await device(now);
    await db.membership.update({ where: { id: leaver.owner.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await expectCode(refreshSeatDeviceToken({ refreshToken: leaver.refreshToken, source: leaver.source, now: at(now, 10) }), "account_disabled");
    await settle();
    expect(observed.calls).toBe(2);
    expect(observed.notices[1]).toEqual(notice(leaver, "membership_inactive", null));
    // A refusal that revokes nothing tells nothing.
    await expectCode(refreshSeatDeviceToken({ refreshToken: leaver.refreshToken, source: leaver.source, now: at(now, 20) }), "device_revoked");
    await settle();
    expect(observed.calls).toBe(2);
  });

  it("cancelling a claimed, never used device is a revocation and is told; the answer is exactly { status }", async () => {
    const now = nextClock();
    const live = await device(now);
    const answer = await cancelSeatDeviceAuthorization({ requestId: live.grant.requestId, pollToken: live.grant.pollToken, now: at(now, 10) });
    expect(answer).toStrictEqual({ status: "cancelled" });
    await expect(cancelSeatDeviceAuthorization({ requestId: live.grant.requestId, pollToken: live.grant.pollToken, now: at(now, 20) })).resolves.toStrictEqual({ status: "revoked" });
    // A pending request that is cancelled was never a device: nothing told.
    const pending = await requestSeatDeviceAuthorization({ deviceLabel: "前台电脑", clientType: "seat_desktop", clientVersion: "1.0.0", source: freshSource(), now });
    await expect(cancelSeatDeviceAuthorization({ requestId: pending.requestId, pollToken: pending.pollToken, now: at(now, 10) })).resolves.toStrictEqual({ status: "cancelled" });
    await settle();
    expect(observed).toMatchObject({ calls: 1, notices: [notice(live, "client_cancelled", null)], statuses: ["revoked"] });
  });

  it("in a caller's transaction: collected through onRevoked, the count unchanged, the pin read as it is now", async () => {
    const now = nextClock();
    const who = await member();
    const first = await device(now, who);
    const second = await device(now, who);
    const other = await device(now, who);
    await db.$transaction((tx) => pinSeatDeviceAudienceInTx(tx, { deviceId: first.deviceId, audiencePin: "audience-a", now }));
    await db.$transaction((tx) => pinSeatDeviceAudienceInTx(tx, { deviceId: other.deviceId, audiencePin: "audience-b", now }));

    const byAudience = await db.$transaction(async (tx) => {
      const collected: SeatDeviceRevocationNotice[] = [];
      const count = await revokeSeatDevicesInTx(tx, { workspaceId, membershipId: who.membershipId, reason: "seat_inactive", audiencePin: "audience-a", now: at(now, 10), onRevoked: (item) => collected.push(item) });
      return { count, collected };
    });
    expect(byAudience).toEqual({ count: 1, collected: [notice(first, "seat_inactive", null, "audience-a")] });
    await settle();
    // The store never notifies for a caller's transaction itself.
    expect(observed.calls).toBe(0);

    // A pin written after the caller read the device is the one reported.
    const actor = { userId: who.userId, name: "管理员" };
    const all = await db.$transaction(async (tx) => {
      const collected: SeatDeviceRevocationNotice[] = [];
      await tx.seatDeviceAuthorization.findMany({ where: { membershipId: who.membershipId } });
      await db.$transaction((outside) => pinSeatDeviceAudienceInTx(outside, { deviceId: second.deviceId, audiencePin: "audience-c", now }));
      const count = await revokeSeatDevicesInTx(tx, { workspaceId, membershipId: who.membershipId, reason: "membership_inactive", actor, now: at(now, 20), onRevoked: (item) => collected.push(item) });
      return { count, collected };
    });
    expect(all.count).toBe(2);
    expect(all.collected).toEqual(expect.arrayContaining([
      notice(second, "membership_inactive", who.userId, "audience-c"),
      notice(other, "membership_inactive", who.userId, "audience-b"),
    ]));

    // Without onRevoked the call is as before.
    const third = await device(now, who);
    await expect(db.$transaction((tx) => revokeSeatDevicesInTx(tx, { workspaceId, membershipId: who.membershipId, reason: "seat_inactive", now: at(now, 30) }))).resolves.toBe(1);
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: third.deviceId } })).status).toBe("revoked");
  });

  it("a retried transaction tells only the attempt that committed", async () => {
    const now = nextClock();
    const own = await device(now);
    const reused = await device(now);
    const cancelled = await device(now);
    const logout = await device(now);
    await refreshSeatDeviceToken({ refreshToken: reused.refreshToken, source: reused.source, now: at(now, 10) });
    const authSessionId = await session(own.owner, now);

    const spy = conflictFirst(1);
    await expect(revokeSeatDeviceByMember({ authSessionId, userId: own.owner.userId, deviceId: own.deviceId, now: at(now, 10) })).resolves.toStrictEqual({ revoked: true });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
    conflictFirst(1);
    await expectCode(refreshSeatDeviceToken({ refreshToken: reused.refreshToken, source: null, now: at(now, 300) }), "token_revoked");
    vi.restoreAllMocks();
    conflictFirst(1);
    await expect(cancelSeatDeviceAuthorization({ requestId: cancelled.grant.requestId, pollToken: cancelled.grant.pollToken, now: at(now, 10) })).resolves.toStrictEqual({ status: "cancelled" });
    vi.restoreAllMocks();
    conflictFirst(1);
    await revokeSeatDeviceWithRefreshToken({ refreshToken: logout.refreshToken, reason: "device_logout", now: at(now, 10) });
    vi.restoreAllMocks();
    await settle();
    expect(observed.calls).toBe(4);
    expect(observed.notices.map((item) => [item.deviceId, item.reason])).toEqual([
      [own.deviceId, "self"],
      [reused.deviceId, "refresh_reuse"],
      [cancelled.deviceId, "client_cancelled"],
      [logout.deviceId, "device_logout"],
    ]);
  });

  it.each(["throw", "reject", "hang"] as const)("an observer that does %s changes no answer", async (behaviour) => {
    observed.behaviour = behaviour;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const now = nextClock();
    const own = await device(now);
    const logout = await device(now);
    const cancelled = await device(now);
    const started = Date.now();
    await expect(revokeSeatDeviceByMember({ authSessionId: await session(own.owner, now), userId: own.owner.userId, deviceId: own.deviceId, now: at(now, 10) })).resolves.toStrictEqual({ revoked: true });
    await expect(revokeSeatDeviceWithRefreshToken({ refreshToken: logout.refreshToken, reason: "device_logout", now: at(now, 10) })).resolves.toBeUndefined();
    await expect(cancelSeatDeviceAuthorization({ requestId: cancelled.grant.requestId, pollToken: cancelled.grant.pollToken, now: at(now, 10) })).resolves.toStrictEqual({ status: "cancelled" });
    expect(Date.now() - started).toBeLessThan(10_000);
    await settle();
    expect(observed.calls).toBe(3);
    const failures = log.mock.calls.filter((call) => String(call[1]).includes("revocation_observer_failed"));
    expect(failures).toHaveLength(behaviour === "hang" ? 0 : 3);
  });

  it("without a registration every revoke answers as before and nothing is told", async () => {
    Reflect.deleteProperty(globalThis, OBSERVER_KEY);
    try {
      const now = nextClock();
      const own = await device(now);
      const cancelled = await device(now);
      await expect(revokeSeatDeviceByMember({ authSessionId: await session(own.owner, now), userId: own.owner.userId, deviceId: own.deviceId, now: at(now, 10) })).resolves.toStrictEqual({ revoked: true });
      await expect(cancelSeatDeviceAuthorization({ requestId: cancelled.grant.requestId, pollToken: cancelled.grant.pollToken, now: at(now, 10) })).resolves.toStrictEqual({ status: "cancelled" });
      await settle();
      expect(observed.calls).toBe(0);
    } finally {
      registerSeatDeviceRevocationObserver(observer);
    }
  });
});
