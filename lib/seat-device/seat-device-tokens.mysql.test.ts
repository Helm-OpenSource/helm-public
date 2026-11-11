// lib/seat-device/seat-device-tokens.mysql.test.ts
// Seat desktop device credentials (D1) on an isolated MySQL database:
// read-only access-token classification, the one-time audience pin, and
// revocation by the device (any token of its family), by the member or a
// workspace OWNER/ADMIN, and inside a caller's transaction.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)
//
// Devices are made through the real request -> approve -> claim path. This
// file never clears a table: its clock starts years after the authorize
// file's, so rows left by either never count toward the other's limits.

import { MembershipStatus, WorkspaceRole, WorkspaceStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { hashSeatDeviceToken, mintSeatDeviceToken, normalizeSeatDevicePairingCode } from "@/lib/seat-device/contract";
import {
  SeatDeviceAuthDisabledError,
  SeatDeviceAuthError,
  claimSeatDeviceAuthorization,
  decideSeatDeviceAuthorization,
  requestSeatDeviceAuthorization,
} from "@/lib/seat-device/store-authorize";
import {
  classifySeatDeviceAccessToken,
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

let clock = Date.parse("2041-01-01T00:00:00.000Z");
function nextClock() {
  clock += 24 * 60 * 60 * 1000;
  return new Date(clock);
}
const at = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);

async function expectCode(promise: Promise<unknown>, code: SeatDeviceAuthError["code"]) {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(SeatDeviceAuthError);
  expect((error as SeatDeviceAuthError).code).toBe(code);
  return (error as SeatDeviceAuthError).retryAfterSeconds;
}

// Request limits count per address bucket and the clock repeats on every
// run, so each run draws its own /24s: a re-run on the same database never
// lands in a bucket an earlier run already used at the same instant.
const runOctets = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `11.${runOctets[0]}.${(runOctets[1] + sourceCounter) % 256}.10`;
}

describeMysql("seat device credentials (classify, pin, revoke) on MySQL", () => {
  const previousEnv = process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
  let workspaceId = "";
  let otherWorkspaceId = "";
  let memberCount = 0;

  type Member = { userId: string; membershipId: string; workspaceId: string };
  async function member(options: { role?: WorkspaceRole; workspace?: string } = {}): Promise<Member> {
    memberCount += 1;
    const user = await db.user.create({
      data: { email: `seat-tokens-${memberCount}-${suffix}@example.com`, name: `坐席 ${memberCount}`, passwordSetAt: new Date("2040-06-01T00:00:00.000Z") },
    });
    const membership = await db.membership.create({
      data: { workspaceId: options.workspace ?? workspaceId, userId: user.id, role: options.role ?? WorkspaceRole.OPERATOR, status: MembershipStatus.ACTIVE },
    });
    return { userId: user.id, membershipId: membership.id, workspaceId: membership.workspaceId };
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

  // A claimed device of `who` (a fresh member by default), from a trusted source.
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
      passwordVerifiedAt: at(now, -30),
      source: null,
      now,
    });
    const claimed = await claimSeatDeviceAuthorization({ requestId: grant.requestId, pollToken: grant.pollToken, source, now: at(now, 5) });
    if (claimed.status !== "approved") throw new Error("expected tokens");
    return { grant, owner, source, deviceId: grant.requestId, accessToken: claimed.accessToken, refreshToken: claimed.refreshToken };
  }

  const row = (id: string) => db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal SEAT_DEVICE_DATABASE_URL for the isolated integration test.");
    }
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    const workspace = await db.workspace.create({
      data: { name: `坐席令牌 ${suffix}`, slug: `seat-tokens-${suffix}`, featureFlagsJson: JSON.stringify({ seatDesktop: true }) },
    });
    workspaceId = workspace.id;
    const other = await db.workspace.create({
      data: { name: `另一机构 ${suffix}`, slug: `seat-tokens-other-${suffix}`, featureFlagsJson: JSON.stringify({ seatDesktop: true }) },
    });
    otherWorkspaceId = other.id;
  });

  afterAll(async () => {
    if (previousEnv === undefined) delete process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
    else process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = previousEnv;
    await db.$disconnect();
  });

  it("classifies access tokens without writing", async () => {
    const now = nextClock();
    const live = await device(now);
    const before = await row(live.deviceId);
    await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 10))).resolves.toEqual({
      ok: true,
      deviceId: live.deviceId,
      workspaceId,
      userId: live.owner.userId,
      deviceTokenHash: hashSeatDeviceToken(live.accessToken),
    });
    await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 905))).resolves.toEqual({ ok: false, code: "access_token_expired" });
    await expect(classifySeatDeviceAccessToken(`hsda_${"A".repeat(43)}`, at(now, 10))).resolves.toEqual({ ok: false, code: "token_invalid" });
    await expect(classifySeatDeviceAccessToken(live.refreshToken, at(now, 10))).resolves.toEqual({ ok: false, code: "token_invalid" });
    // The previous slot is usable until its own (overlap) expiry.
    const previous = mintSeatDeviceToken("access").token;
    await db.seatDeviceAuthorization.update({
      where: { id: live.deviceId },
      data: { previousAccessTokenHash: hashSeatDeviceToken(previous), previousAccessExpiresAt: at(now, 60) },
    });
    await expect(classifySeatDeviceAccessToken(previous, at(now, 59))).resolves.toMatchObject({ ok: true, deviceTokenHash: hashSeatDeviceToken(previous) });
    await expect(classifySeatDeviceAccessToken(previous, at(now, 60))).resolves.toEqual({ ok: false, code: "access_token_expired" });
    // Past the absolute credential expiry even a fresh access token reads expired.
    await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 30 * 24 * 3600))).resolves.toEqual({ ok: false, code: "access_token_expired" });
    // Workspace flag or deployment switch off.
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: "{}" } });
    try {
      await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 10))).resolves.toEqual({ ok: false, code: "workspace_not_enabled" });
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }) } });
    }
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "false";
    try {
      await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 10))).resolves.toEqual({ ok: false, code: "workspace_not_enabled" });
    } finally {
      process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    }
    const after = await row(live.deviceId);
    expect({ version: after.version, lastUsedAt: after.lastUsedAt, refreshTokenUsed: after.refreshTokenUsed }).toEqual({
      version: before.version,
      lastUsedAt: before.lastUsedAt,
      refreshTokenUsed: before.refreshTokenUsed,
    });
  });

  it("fails both access tokens of a revoked device by its status", async () => {
    const now = nextClock();
    const live = await device(now);
    const previous = mintSeatDeviceToken("access").token;
    await db.seatDeviceAuthorization.update({
      where: { id: live.deviceId },
      data: { previousAccessTokenHash: hashSeatDeviceToken(previous), previousAccessExpiresAt: at(now, 60) },
    });
    await revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now: at(now, 10) });
    for (const token of [live.accessToken, previous]) {
      await expect(classifySeatDeviceAccessToken(token, at(now, 11))).resolves.toEqual({ ok: false, code: "device_revoked" });
    }
    // The hashes stay: status, not a cleared hash, is what fails them.
    expect(await row(live.deviceId)).toMatchObject({ status: "revoked", accessTokenHash: hashSeatDeviceToken(live.accessToken) });
  });

  it("revokes with the current refresh token, records the reason, and answers alike for unknown tokens", async () => {
    const now = nextClock();
    const live = await device(now);
    await expect(revokeSeatDeviceWithRefreshToken({ refreshToken: `hsdr_${"Z".repeat(43)}`, reason: "device_logout", now })).resolves.toBeUndefined();
    await revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "client_cancelled", now: at(now, 10) });
    expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: "client_cancelled", revokedAt: at(now, 10), revokedByUserId: null, sourceIp: null });
    // Idempotent: a second revoke changes nothing and writes no second audit.
    await revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now: at(now, 20) });
    expect(await row(live.deviceId)).toMatchObject({ revokeReason: "client_cancelled", revokedAt: at(now, 10) });
    const audits = await db.auditLog.findMany({ where: { targetId: live.deviceId, actionType: "SEAT_DEVICE_REVOKED" } });
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].payload ?? "{}")).toMatchObject({ reason: "client_cancelled", refreshTokenMatched: "current" });
    for (const text of [audits[0].payload ?? "", audits[0].summary]) {
      expect(text).not.toContain(live.refreshToken);
      expect(text).not.toContain(hashSeatDeviceToken(live.refreshToken));
    }
    // The device can no longer re-claim.
    await expectCode(claimSeatDeviceAuthorization({ requestId: live.grant.requestId, pollToken: live.grant.pollToken, source: live.source, now: at(now, 30) }), "poll_token_invalid");
  });

  it("revokes with a retired or previous refresh token of the family", async () => {
    const now = nextClock();
    // A re-claim retires the first pair into the history table.
    const live = await device(now);
    const again = await claimSeatDeviceAuthorization({ requestId: live.grant.requestId, pollToken: live.grant.pollToken, source: live.source, now: at(now, 20) });
    if (again.status !== "approved") throw new Error("expected tokens");
    expect(await db.seatDeviceTokenHistory.count({ where: { deviceId: live.deviceId, tokenHash: hashSeatDeviceToken(live.refreshToken) } })).toBe(1);
    await revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now: at(now, 30) });
    expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: "device_logout" });
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: live.deviceId, actionType: "SEAT_DEVICE_REVOKED" } });
    expect(JSON.parse(audit.payload ?? "{}")).toMatchObject({ refreshTokenMatched: "retired" });

    const second = await device(now);
    const previous = mintSeatDeviceToken("refresh").token;
    await db.seatDeviceAuthorization.update({ where: { id: second.deviceId }, data: { previousRefreshTokenHash: hashSeatDeviceToken(previous) } });
    await revokeSeatDeviceWithRefreshToken({ refreshToken: previous, reason: "device_logout", now: at(now, 30) });
    expect(await row(second.deviceId)).toMatchObject({ status: "revoked" });
  });

  it("is unreachable while the deployment switch is off", async () => {
    const now = nextClock();
    const live = await device(now);
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "false";
    try {
      await expect(revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now })).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
      await expect(
        revokeSeatDeviceByMember({ authSessionId: await session(live.owner, now), userId: live.owner.userId, deviceId: live.deviceId, now }),
      ).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
    } finally {
      process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    }
    expect((await row(live.deviceId)).status).toBe("active");
  });

  it("lets the member revoke their own device and an OWNER or ADMIN any device in the workspace", async () => {
    const now = nextClock();
    const own = await device(now);
    await expect(revokeSeatDeviceByMember({ authSessionId: await session(own.owner, now), userId: own.owner.userId, deviceId: own.deviceId, now })).resolves.toEqual({ revoked: true });
    expect(await row(own.deviceId)).toMatchObject({ status: "revoked", revokeReason: "self", revokedByUserId: own.owner.userId });
    await expect(revokeSeatDeviceByMember({ authSessionId: await session(own.owner, now), userId: own.owner.userId, deviceId: own.deviceId, now })).resolves.toEqual({ revoked: false });

    for (const role of [WorkspaceRole.ADMIN, WorkspaceRole.OWNER]) {
      const target = await device(now);
      const admin = await member({ role });
      await expect(revokeSeatDeviceByMember({ authSessionId: await session(admin, now), userId: admin.userId, deviceId: target.deviceId, now })).resolves.toEqual({ revoked: true });
      expect(await row(target.deviceId)).toMatchObject({ status: "revoked", revokeReason: "admin", revokedByUserId: admin.userId });
      const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: target.deviceId, actionType: "SEAT_DEVICE_REVOKED" } });
      expect(audit).toMatchObject({ userId: admin.userId, workspaceId });
    }

    // The target already left: an admin can still remove the device, also
    // while the workspace flag is off.
    const departed = await device(now);
    await db.membership.update({ where: { id: departed.owner.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: "{}" } });
    try {
      const admin = await member({ role: WorkspaceRole.ADMIN });
      await expect(revokeSeatDeviceByMember({ authSessionId: await session(admin, now), userId: admin.userId, deviceId: departed.deviceId, now })).resolves.toEqual({ revoked: true });
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }) } });
    }
  });

  it("refuses everyone else alike and leaves the device untouched", async () => {
    const now = nextClock();
    const target = await device(now);
    const before = await row(target.deviceId);
    for (const role of [WorkspaceRole.OPERATOR, WorkspaceRole.MEMBER, WorkspaceRole.BILLING_ADMIN]) {
      const peer = await member({ role });
      await expectCode(revokeSeatDeviceByMember({ authSessionId: await session(peer, now), userId: peer.userId, deviceId: target.deviceId, now }), "forbidden");
    }
    const elsewhere = await member({ role: WorkspaceRole.OWNER, workspace: otherWorkspaceId });
    await expectCode(revokeSeatDeviceByMember({ authSessionId: await session(elsewhere, now), userId: elsewhere.userId, deviceId: target.deviceId, now }), "forbidden");
    const admin = await member({ role: WorkspaceRole.ADMIN });
    await expectCode(revokeSeatDeviceByMember({ authSessionId: await session(admin, now), userId: admin.userId, deviceId: "missing-device", now }), "forbidden");
    // A session of someone else is not the actor's session.
    await expectCode(revokeSeatDeviceByMember({ authSessionId: await session(target.owner, now), userId: admin.userId, deviceId: target.deviceId, now }), "reauthentication_required");
    expect(await row(target.deviceId)).toMatchObject({ status: "active", version: before.version, revokedAt: null });
    expect(await db.auditLog.count({ where: { targetId: target.deviceId, actionType: "SEAT_DEVICE_REVOKED" } })).toBe(0);
  });

  it("revokes an approved, unclaimed request so it can never be claimed", async () => {
    const now = nextClock();
    const who = await member();
    const grant = await requestSeatDeviceAuthorization({ deviceLabel: "前台电脑", clientType: "seat_desktop", clientVersion: "1.0.0", source: null, now });
    await decideSeatDeviceAuthorization({
      authSessionId: await session(who, now),
      userId: who.userId,
      requestId: grant.requestId,
      pairingCode: normalizeSeatDevicePairingCode(grant.pairingCode)!,
      decision: "approve",
      passwordVerifiedAt: at(now, -30),
      source: null,
      now,
    });
    await expect(revokeSeatDeviceByMember({ authSessionId: await session(who, now), userId: who.userId, deviceId: grant.requestId, now })).resolves.toEqual({ revoked: true });
    await expectCode(claimSeatDeviceAuthorization({ ...grant, source: null, now: at(now, 5) }), "poll_token_invalid");
  });

  it("revokes every device of a membership inside the caller's transaction", async () => {
    const now = nextClock();
    const who = await member();
    const first = await device(now, who);
    const second = await device(now, who);
    const bystander = await device(now);
    const actor = { userId: bystander.owner.userId, name: "管理员" };
    // Default (REPEATABLE READ) isolation, as a caller's transaction may be.
    const revoked = await db.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: who.membershipId }, data: { status: MembershipStatus.INACTIVE } });
      return revokeSeatDevicesInTx(tx, { workspaceId, membershipId: who.membershipId, reason: "membership_inactive", actor, now: at(now, 10) });
    });
    expect(revoked).toBe(2);
    for (const id of [first.deviceId, second.deviceId]) {
      expect(await row(id)).toMatchObject({ status: "revoked", revokeReason: "membership_inactive", revokedByUserId: actor.userId, revokedAt: at(now, 10), sourceIp: null });
      expect(await db.auditLog.count({ where: { targetId: id, actionType: "SEAT_DEVICE_REVOKED" } })).toBe(1);
    }
    expect((await row(bystander.deviceId)).status).toBe("active");
    await expect(db.$transaction((tx) => revokeSeatDevicesInTx(tx, { workspaceId, membershipId: who.membershipId, reason: "seat_inactive", now }))).resolves.toBe(0);

    // Written by another connection after the caller's snapshot was taken
    // (as a rotation would): still revoked, because the UPDATE reads the
    // latest committed row, not the snapshot.
    const moved = await device(now);
    const afterSnapshot = await db.$transaction(async (tx) => {
      await tx.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: moved.deviceId } });
      await db.seatDeviceAuthorization.update({ where: { id: moved.deviceId }, data: { version: { increment: 1 } } });
      return revokeSeatDevicesInTx(tx, { workspaceId, membershipId: moved.owner.membershipId, reason: "seat_inactive", now });
    });
    expect(afterSnapshot).toBe(1);
    expect(await row(moved.deviceId)).toMatchObject({ status: "revoked", revokeReason: "seat_inactive" });

    // Rolled back with the caller: nothing is revoked.
    const kept = await device(now);
    await expect(
      db.$transaction(async (tx) => {
        await revokeSeatDevicesInTx(tx, { workspaceId, membershipId: kept.owner.membershipId, reason: "seat_inactive", now });
        throw new Error("caller aborts");
      }),
    ).rejects.toThrow("caller aborts");
    expect((await row(kept.deviceId)).status).toBe("active");
  });

  it("pins the audience once and never changes it", async () => {
    const now = nextClock();
    const live = await device(now);
    const pin = (audiencePin: string, deviceId = live.deviceId) =>
      db.$transaction((tx) => pinSeatDeviceAudienceInTx(tx, { deviceId, audiencePin, now }));
    await expect(pin("astra-registration:r1")).resolves.toBe("pinned");
    await expect(pin("astra-registration:r1")).resolves.toBe("unchanged");
    await expect(pin("astra-registration:r2")).resolves.toBe("mismatch");
    expect((await row(live.deviceId)).audiencePin).toBe("astra-registration:r1");
    await expect(pin("")).rejects.toThrow("audience pin");
    await expect(pin("astra-registration:r1", "missing-device")).resolves.toBe("not_active");
    const fresh = await device(now);
    await revokeSeatDeviceWithRefreshToken({ refreshToken: fresh.refreshToken, reason: "device_logout", now });
    await expect(pin("astra-registration:r1", fresh.deviceId)).resolves.toBe("not_active");
    expect((await row(fresh.deviceId)).audiencePin).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  const refreshAt = (refreshToken: string, now: Date, source: string | null) => refreshSeatDeviceToken({ refreshToken, source, now });

  it("rotates the pair, keeps the old access token for at most 60 s and retires the pair before it", async () => {
    const now = nextClock();
    const live = await device(now);
    const first = await refreshAt(live.refreshToken, at(now, 100), live.source);
    expect(first).toMatchObject({ expiresInSeconds: 900, refreshExpiresInSeconds: 30 * 24 * 3600 - 100 });
    expect(first.refreshToken).toMatch(/^hsdr_[A-Za-z0-9_-]{43}$/);
    expect(await row(live.deviceId)).toMatchObject({
      refreshTokenHash: hashSeatDeviceToken(first.refreshToken),
      previousRefreshTokenHash: hashSeatDeviceToken(live.refreshToken),
      accessTokenHash: hashSeatDeviceToken(first.accessToken),
      accessExpiresAt: at(now, 1000),
      previousAccessTokenHash: hashSeatDeviceToken(live.accessToken),
      previousAccessExpiresAt: at(now, 160),
      rotatedAt: at(now, 100),
      rotationSource: live.source,
      refreshTokenUsed: false,
      graceUsed: false,
      refreshWindowCount: 1,
      lastUsedAt: at(now, 100),
      expiresAt: at(now, 30 * 24 * 3600),
    });
    // The overlap: the old access token works until rotation + 60 s.
    await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 159))).resolves.toMatchObject({ ok: true });
    await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 160))).resolves.toEqual({ ok: false, code: "access_token_expired" });
    await expect(classifySeatDeviceAccessToken(first.accessToken, at(now, 160))).resolves.toMatchObject({ ok: true });

    // Rotating near the old token's own expiry: the overlap never outlives it.
    const second = await refreshAt(first.refreshToken, at(now, 990), live.source);
    expect(await row(live.deviceId)).toMatchObject({
      previousRefreshTokenHash: hashSeatDeviceToken(first.refreshToken),
      previousAccessExpiresAt: at(now, 1000),
      refreshWindowCount: 1,
    });
    const history = await db.seatDeviceTokenHistory.findMany({ where: { deviceId: live.deviceId } });
    expect(history.map((entry) => [entry.kind, entry.tokenHash]).sort()).toEqual(
      [["access", hashSeatDeviceToken(live.accessToken)], ["refresh", hashSeatDeviceToken(live.refreshToken)]].sort(),
    );
    const audits = await db.auditLog.findMany({ where: { targetId: live.deviceId, actionType: "SEAT_DEVICE_REFRESHED" } });
    expect(audits).toHaveLength(2);
    for (const text of audits.flatMap((audit) => [audit.payload ?? "", audit.summary])) {
      for (const token of [live.refreshToken, first.refreshToken, second.refreshToken, second.accessToken]) {
        expect(text).not.toContain(token);
        expect(text).not.toContain(hashSeatDeviceToken(token));
      }
    }
    expect(JSON.stringify(await row(live.deviceId))).not.toContain(second.refreshToken);
  });

  it("revokes the whole device when a retired token of the family comes back", async () => {
    const now = nextClock();
    const live = await device(now);
    const first = await refreshAt(live.refreshToken, at(now, 100), live.source);
    const second = await refreshAt(first.refreshToken, at(now, 200), live.source);
    await expectCode(refreshAt(live.refreshToken, at(now, 300), live.source), "token_revoked");
    expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: "refresh_reuse", revokedAt: at(now, 300) });
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: live.deviceId, actionType: "SEAT_DEVICE_REVOKED" } });
    expect(JSON.parse(audit.payload ?? "{}")).toMatchObject({ reason: "refresh_reuse", refreshTokenMatched: "retired" });
    // The legitimate client is out with the attacker.
    await expectCode(refreshAt(second.refreshToken, at(now, 301), live.source), "device_revoked");
    await expect(classifySeatDeviceAccessToken(second.accessToken, at(now, 301))).resolves.toEqual({ ok: false, code: "device_revoked" });
    await expectCode(refreshAt(`hsdr_${"Q".repeat(43)}`, at(now, 301), live.source), "token_revoked");
  });

  it("re-mints once for a lost answer: previous token, within 60 s, current pair unused, same trusted source", async () => {
    const now = nextClock();
    const live = await device(now);
    const lost = await refreshAt(live.refreshToken, at(now, 100), live.source); // answer never arrives
    const again = await refreshAt(live.refreshToken, at(now, 130), live.source);
    expect(again.refreshToken).not.toBe(lost.refreshToken);
    expect(await row(live.deviceId)).toMatchObject({
      status: "active",
      refreshTokenHash: hashSeatDeviceToken(again.refreshToken),
      previousRefreshTokenHash: hashSeatDeviceToken(live.refreshToken),
      accessTokenHash: hashSeatDeviceToken(again.accessToken),
      // The undelivered access token takes the "previous" slot.
      previousAccessTokenHash: hashSeatDeviceToken(lost.accessToken),
      previousAccessExpiresAt: at(now, 190),
      graceUsed: true,
      rotatedAt: at(now, 100),
    });
    const retired = await db.seatDeviceTokenHistory.findMany({ where: { deviceId: live.deviceId } });
    expect(retired.map((entry) => entry.tokenHash)).toEqual(
      expect.arrayContaining([hashSeatDeviceToken(lost.refreshToken), hashSeatDeviceToken(live.accessToken)]),
    );
    expect(await db.auditLog.count({ where: { targetId: live.deviceId, actionType: "SEAT_DEVICE_REFRESH_GRACE_REMINTED" } })).toBe(1);
    // Only once per rotation, even still inside the 60 s.
    await expectCode(refreshAt(live.refreshToken, at(now, 131), live.source), "token_revoked");
    expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: "refresh_reuse" });

    // The undelivered refresh token is retired: presenting it is reuse.
    const other = await device(now);
    const undelivered = await refreshAt(other.refreshToken, at(now, 100), other.source);
    await refreshAt(other.refreshToken, at(now, 110), other.source);
    await expectCode(refreshAt(undelivered.refreshToken, at(now, 120), other.source), "token_revoked");
    expect((await row(other.deviceId)).revokeReason).toBe("refresh_reuse");

    // The grace resets with the next real rotation.
    const third = await device(now);
    await refreshAt(third.refreshToken, at(now, 100), third.source);
    const regraced = await refreshAt(third.refreshToken, at(now, 110), third.source);
    const next = await refreshAt(regraced.refreshToken, at(now, 200), third.source);
    expect((await row(third.deviceId)).graceUsed).toBe(false);
    await expect(refreshAt(regraced.refreshToken, at(now, 210), third.source)).resolves.toMatchObject({ expiresInSeconds: 900 });
    expect(next.refreshToken).toBeTruthy();
  });

  it("treats the previous token as reuse when any grace condition fails", async () => {
    const now = nextClock();
    const cases: [string, (live: Awaited<ReturnType<typeof device>>) => Promise<unknown>][] = [
      ["past 60 s", (live) => refreshAt(live.refreshToken, at(now, 161), live.source)],
      ["another trusted source", (live) => refreshAt(live.refreshToken, at(now, 130), freshSource())],
      ["no trusted source", (live) => refreshAt(live.refreshToken, at(now, 130), null)],
    ];
    for (const [label, present] of cases) {
      const live = await device(now);
      await refreshAt(live.refreshToken, at(now, 100), live.source);
      await expectCode(present(live) as Promise<unknown>, "token_revoked");
      expect({ label, ...(await row(live.deviceId)) }).toMatchObject({ label, status: "revoked", revokeReason: "refresh_reuse" });
    }
    // The current pair was used: its refresh token was presented (refused
    // while the workspace was off), so a grace can no longer trust it.
    const live = await device(now);
    const current = await refreshAt(live.refreshToken, at(now, 100), live.source);
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: "{}" } });
    try {
      await expectCode(refreshAt(current.refreshToken, at(now, 110), live.source), "workspace_not_enabled");
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }) } });
    }
    expect(await row(live.deviceId)).toMatchObject({ status: "active", refreshTokenUsed: true });
    await expectCode(refreshAt(live.refreshToken, at(now, 120), live.source), "token_revoked");
    expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: "refresh_reuse" });
  });

  it("re-checks the member like the device channel and revokes a member who changed", async () => {
    const now = nextClock();
    const inactive = await device(now);
    await db.membership.update({ where: { id: inactive.owner.membershipId }, data: { status: MembershipStatus.INACTIVE } });
    const reset = await device(now);
    await db.user.update({ where: { id: reset.owner.userId }, data: { passwordSetAt: at(now, 1) } });
    const external = await device(now);
    await db.membership.update({ where: { id: external.owner.membershipId }, data: { accessScope: "partner_portal" } });
    const replaced = await device(now);
    const old = await db.membership.findUniqueOrThrow({ where: { id: replaced.owner.membershipId } });
    await db.membership.delete({ where: { id: old.id } });
    await db.membership.create({ data: { workspaceId: old.workspaceId, userId: old.userId, role: old.role, status: MembershipStatus.ACTIVE } });
    for (const [live, reason] of [
      [inactive, "membership_inactive"],
      [reset, "password_reset"],
      [external, "membership_inactive"],
      [replaced, "membership_inactive"],
    ] as const) {
      await expectCode(refreshAt(live.refreshToken, at(now, 100), live.source), "account_disabled");
      expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: reason, accessTokenHash: hashSeatDeviceToken(live.accessToken) });
      await expect(classifySeatDeviceAccessToken(live.accessToken, at(now, 101))).resolves.toEqual({ ok: false, code: "device_revoked" });
    }
  });

  it("refuses a suspended workspace without revoking, like the device channel", async () => {
    const now = nextClock();
    const live = await device(now);
    await db.workspace.update({ where: { id: workspaceId }, data: { status: WorkspaceStatus.SUSPENDED } });
    try {
      await expectCode(refreshAt(live.refreshToken, at(now, 100), live.source), "account_disabled");
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { status: WorkspaceStatus.ACTIVE } });
    }
    expect(await row(live.deviceId)).toMatchObject({ status: "active", refreshTokenUsed: true, revokedAt: null });
    await expect(refreshAt(live.refreshToken, at(now, 110), live.source)).resolves.toMatchObject({ expiresInSeconds: 900 });
  });

  it("keeps the device while the workspace is not enabled", async () => {
    const now = nextClock();
    const live = await device(now);
    await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: "{}" } });
    try {
      await expectCode(refreshAt(live.refreshToken, at(now, 100), live.source), "workspace_not_enabled");
    } finally {
      await db.workspace.update({ where: { id: workspaceId }, data: { featureFlagsJson: JSON.stringify({ seatDesktop: true }) } });
    }
    expect(await row(live.deviceId)).toMatchObject({ status: "active", refreshTokenHash: hashSeatDeviceToken(live.refreshToken) });
    await expect(refreshAt(live.refreshToken, at(now, 110), live.source)).resolves.toMatchObject({ expiresInSeconds: 900 });
  });

  it("limits a device to six refreshes a minute, after reuse detection", async () => {
    const now = nextClock();
    const live = await device(now);
    let token = live.refreshToken;
    for (let index = 0; index < 6; index += 1) token = (await refreshAt(token, at(now, 100 + index), live.source)).refreshToken;
    const limited = await expectCode(refreshAt(token, at(now, 110), live.source), "rate_limited");
    expect(limited).toBe(50);
    expect(await row(live.deviceId)).toMatchObject({ status: "active", refreshTokenHash: hashSeatDeviceToken(token), refreshTokenUsed: true });
    token = (await refreshAt(token, at(now, 160), live.source)).refreshToken;
    expect((await row(live.deviceId)).refreshWindowCount).toBe(1);
    // A replay is still caught while the window is full.
    for (let index = 0; index < 5; index += 1) token = (await refreshAt(token, at(now, 161 + index), live.source)).refreshToken;
    await expectCode(refreshAt(live.refreshToken, at(now, 170), live.source), "token_revoked");
    expect((await row(live.deviceId)).revokeReason).toBe("refresh_reuse");
  });

  it("refuses an expired credential and is unreachable while the switch is off", async () => {
    const now = nextClock();
    const live = await device(now);
    await expectCode(refreshAt(live.refreshToken, at(now, 30 * 24 * 3600), live.source), "device_expired");
    expect((await row(live.deviceId)).status).toBe("active");
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "false";
    try {
      await expect(refreshAt(live.refreshToken, at(now, 100), live.source)).rejects.toBeInstanceOf(SeatDeviceAuthDisabledError);
    } finally {
      process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    }
    expect((await row(live.deviceId)).refreshTokenHash).toBe(hashSeatDeviceToken(live.refreshToken));
  });

  it("notifies the member when a trusted source moves to another address bucket", async () => {
    const now = nextClock();
    const live = await device(now);
    const notes = () => db.notification.count({ where: { userId: live.owner.userId, title: "坐席客户端设备从新的网络位置登录" } });
    let token = (await refreshAt(live.refreshToken, at(now, 100), live.source.replace(/10$/, "77"))).refreshToken; // same /24
    expect(await notes()).toBe(0);
    token = (await refreshAt(token, at(now, 200), null)).refreshToken; // untrusted: nothing learned
    expect(await notes()).toBe(0);
    expect((await row(live.deviceId)).lastIp).toBe(live.source.replace(/10$/, "77"));
    const moved = freshSource();
    await refreshAt(token, at(now, 300), moved);
    expect(await notes()).toBe(1);
    expect(await row(live.deviceId)).toMatchObject({ status: "active", lastIp: moved });
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: live.deviceId, actionType: "SEAT_DEVICE_REFRESHED" }, orderBy: { createdAt: "desc" } });
    expect(JSON.parse(audit.payload ?? "{}")).toMatchObject({ sourceBucketChanged: true });
  });

  // One client must refresh single-flight (design §4.7). Racing the same
  // token: without a trusted source the loser is reuse and the device is
  // revoked; with one, the loser lands in the grace re-mint and both get a
  // pair, and only the later pair stays usable.
  it("pins what two racing refreshes of one token do", async () => {
    const now = nextClock();
    for (let round = 0; round < 3; round += 1) {
      const untrusted = await device(now);
      const results = await Promise.allSettled([0, 1].map(() => refreshAt(untrusted.refreshToken, at(now, 100), null)));
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const lost = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
      expect((lost.reason as SeatDeviceAuthError).code).toBe("token_revoked");
      expect(await row(untrusted.deviceId)).toMatchObject({ status: "revoked", revokeReason: "refresh_reuse" });

      const trusted = await device(now);
      const pairs = await Promise.all([0, 1].map(() => refreshAt(trusted.refreshToken, at(now, 100), trusted.source)));
      const stored = await row(trusted.deviceId);
      expect(stored).toMatchObject({ status: "active", graceUsed: true });
      expect(pairs.map((pair) => hashSeatDeviceToken(pair.refreshToken))).toContain(stored.refreshTokenHash);
    }
  });

  it("lets a racing revoke win over a refresh", async () => {
    const now = nextClock();
    for (let round = 0; round < 3; round += 1) {
      const live = await device(now);
      const [refreshed] = await Promise.allSettled([
        refreshAt(live.refreshToken, at(now, 100), live.source),
        revokeSeatDeviceWithRefreshToken({ refreshToken: live.refreshToken, reason: "device_logout", now: at(now, 100) }),
      ]);
      expect(await row(live.deviceId)).toMatchObject({ status: "revoked", revokeReason: "device_logout" });
      if (refreshed.status === "rejected") expect((refreshed.reason as SeatDeviceAuthError).code).toBe("device_revoked");
      else await expect(classifySeatDeviceAccessToken(refreshed.value.accessToken, at(now, 101))).resolves.toEqual({ ok: false, code: "device_revoked" });
    }
  });
});
