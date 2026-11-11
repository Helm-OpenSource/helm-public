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

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
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
}

const runOctet = Math.floor(Math.random() * 256);
let sourceCounter = 0;
function freshSource() {
  sourceCounter += 1;
  return `172.${16 + (runOctet % 16)}.${sourceCounter}.10`;
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
});
