// features/settings/membership-lifecycle-seat-device.mysql.test.ts
// The membership lifecycle action revokes the member's seat desktop devices
// in the same transaction when the member leaves ACTIVE (design D1 §4.6).
// Real action, real store, isolated MySQL; only the signed-in caller and
// Next's cache are stubbed.
//
//   SEAT_DEVICE_DATABASE_URL=<disposable db> DATABASE_URL=<same>
//   npm run test:seat-device:mysql   (sets SEAT_DEVICE_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const caller = vi.hoisted(() => ({
  user: { id: "", name: "管理员" },
  workspace: { id: "", defaultLocale: "zh-CN" },
  membership: { id: "", role: "OWNER", userId: "" },
  failAfterRevoke: false,
  failLifecycleAudit: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Fails the caller's transaction right after the real revoke, to prove the
// revoke ran inside it.
vi.mock("@/lib/seat-device/store-tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seat-device/store-tokens")>();
  return {
    ...actual,
    revokeSeatDevicesInTx: async (...args: Parameters<typeof actual.revokeSeatDevicesInTx>) => {
      const revoked = await actual.revokeSeatDevicesInTx(...args);
      if (caller.failAfterRevoke) throw new Error("injected failure after revoke");
      return revoked;
    },
  };
});
// Fails only the action's own audit write, which follows the commit.
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    writeAuditLog: async (...args: Parameters<typeof actual.writeAuditLog>) => {
      if (caller.failLifecycleAudit && args[0].actionType === "ORGANIZATION_MEMBER_LIFECYCLE_UPDATED") throw new Error("injected audit failure");
      return actual.writeAuditLog(...args);
    },
  };
});
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireCurrentUser: async () => caller.user,
  getCurrentWorkspace: async () => caller.workspace,
  getCurrentMembership: async () => caller.membership,
}));

import { updateOrganizationMembershipLifecycleAction } from "@/features/settings/actions";
import { db } from "@/lib/db";
import { hashSeatDeviceToken, mintSeatDeviceToken } from "@/lib/seat-device/contract";
import { registerSeatDeviceRevocationObserver, type SeatDeviceRevocationNotice } from "@/lib/seat-device/revocation-observer";

// A registered observer, recording: the action tells it after its commit.
const observed: SeatDeviceRevocationNotice[][] = [];
registerSeatDeviceRevocationObserver((notices) => {
  observed.push([...notices]);
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const integrationDatabaseUrl = process.env.SEAT_DEVICE_DATABASE_URL;
if (process.env.SEAT_DEVICE_MYSQL_REQUIRED === "1" && !integrationDatabaseUrl) {
  throw new Error("SEAT_DEVICE_MYSQL_REQUIRED=1 but SEAT_DEVICE_DATABASE_URL is missing.");
}
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;

describeMysql("membership lifecycle revokes seat desktop devices on MySQL", () => {
  const previousEnv = process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
  let workspaceId = "";
  let count = 0;

  async function member(role: WorkspaceRole = WorkspaceRole.OPERATOR) {
    count += 1;
    const user = await db.user.create({ data: { email: `seat-lifecycle-${count}-${suffix}@example.com`, name: `成员 ${count}` } });
    const membership = await db.membership.create({ data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE } });
    return { userId: user.id, membershipId: membership.id };
  }

  // An active device row as a claim leaves it; the store's own tests cover
  // how it gets there.
  async function activeDevice(who: { userId: string; membershipId: string }) {
    const now = new Date();
    const row = await db.seatDeviceAuthorization.create({
      data: {
        clientType: "seat_desktop",
        deviceLabel: "前台电脑",
        status: "active",
        pollTokenHash: hashSeatDeviceToken(mintSeatDeviceToken("poll").token),
        refreshTokenHash: hashSeatDeviceToken(mintSeatDeviceToken("refresh").token),
        requestedAt: now,
        requestExpiresAt: now,
        workspaceId,
        userId: who.userId,
        membershipId: who.membershipId,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 24 * 3600 * 1000),
      },
    });
    return row.id;
  }

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal SEAT_DEVICE_DATABASE_URL for the isolated integration test.");
    }
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    const workspace = await db.workspace.create({ data: { name: `成员状态 ${suffix}`, slug: `seat-lifecycle-${suffix}` } });
    workspaceId = workspace.id;
    const owner = await member(WorkspaceRole.OWNER);
    caller.user.id = owner.userId;
    caller.workspace.id = workspaceId;
    caller.membership = { id: owner.membershipId, role: "OWNER", userId: owner.userId };
  });

  afterAll(async () => {
    if (previousEnv === undefined) delete process.env.HELM_SEAT_DEVICE_AUTH_ENABLED;
    else process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = previousEnv;
    await db.$disconnect();
  });

  it("revokes every device of a member set INACTIVE, and only theirs", async () => {
    const leaving = await member();
    const devices = [await activeDevice(leaving), await activeDevice(leaving)];
    const bystander = await activeDevice(await member());
    observed.length = 0;
    await expect(
      updateOrganizationMembershipLifecycleAction({ membershipId: leaving.membershipId, nextStatus: MembershipStatus.INACTIVE }),
    ).resolves.toStrictEqual({ ok: true, status: MembershipStatus.INACTIVE });
    await settle();
    expect(observed).toHaveLength(1);
    expect([...observed[0]].sort((a, b) => (a.deviceId < b.deviceId ? -1 : 1))).toEqual([...devices].sort().map((deviceId) => ({
      deviceId,
      workspaceId,
      userId: leaving.userId,
      membershipId: leaving.membershipId,
      reason: "membership_inactive",
      actorUserId: caller.user.id,
      audiencePin: null,
    })));
    for (const id of devices) {
      expect(await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id } })).toMatchObject({
        status: "revoked",
        revokeReason: "membership_inactive",
        revokedByUserId: caller.user.id,
      });
    }
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: bystander } })).status).toBe("active");
    expect(await db.auditLog.count({ where: { targetId: { in: devices }, actionType: "SEAT_DEVICE_REVOKED" } })).toBe(2);

    // Re-activating does not bring a device back.
    await expect(
      updateOrganizationMembershipLifecycleAction({ membershipId: leaving.membershipId, nextStatus: MembershipStatus.ACTIVE }),
    ).resolves.toMatchObject({ ok: true });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: devices[0] } })).status).toBe("revoked");
    await settle();
    expect(observed).toHaveLength(1);
  });

  it("revokes in the deactivation's own transaction: a failure after it undoes both", async () => {
    const leaving = await member();
    const device = await activeDevice(leaving);
    observed.length = 0;
    caller.failAfterRevoke = true;
    try {
      await expect(
        updateOrganizationMembershipLifecycleAction({ membershipId: leaving.membershipId, nextStatus: MembershipStatus.INACTIVE }),
      ).rejects.toThrow("injected failure after revoke");
    } finally {
      caller.failAfterRevoke = false;
    }
    expect((await db.membership.findUniqueOrThrow({ where: { id: leaving.membershipId } })).status).toBe(MembershipStatus.ACTIVE);
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: device } })).status).toBe("active");
    expect(await db.auditLog.count({ where: { targetId: device, actionType: "SEAT_DEVICE_REVOKED" } })).toBe(0);
    // The rolled-back revoke tells nothing.
    await settle();
    expect(observed).toEqual([]);
  });

  // A failure after the closure returned (the commit) tells nothing; one in
  // the audit write that follows the commit finds the notice already sent.
  it.each([["commit", "active", false], ["audit", "revoked", true]] as const)("a failure at the %s: device %s, told %s", async (at, status, told) => {
    const leaving = await member();
    const device = await activeDevice(leaving);
    observed.length = 0;
    const real = db.$transaction.bind(db) as (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    if (at === "commit") vi.spyOn(db, "$transaction").mockImplementationOnce(((fn: (tx: unknown) => Promise<unknown>) => real(async (tx) => { await fn(tx); throw new Error("injected commit failure"); })) as never);
    caller.failLifecycleAudit = at === "audit";
    try {
      await expect(updateOrganizationMembershipLifecycleAction({ membershipId: leaving.membershipId, nextStatus: MembershipStatus.INACTIVE })).rejects.toThrow(`injected ${at} failure`);
    } finally {
      caller.failLifecycleAudit = false;
      vi.restoreAllMocks();
    }
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: device } })).status).toBe(status);
    await settle();
    expect(observed.map((notices) => notices.map((notice) => notice.deviceId))).toEqual(told ? [[device]] : []);
  });

  // Switch off (the default): the in-service action never touches the device
  // table, so a deployment whose web identity cannot read it yet still
  // deactivates members.
  it("deactivates without touching devices while the deployment switch is off", async () => {
    const leaving = await member();
    const device = await activeDevice(leaving);
    process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "false";
    try {
      await expect(
        updateOrganizationMembershipLifecycleAction({ membershipId: leaving.membershipId, nextStatus: MembershipStatus.INACTIVE }),
      ).resolves.toMatchObject({ ok: true });
    } finally {
      process.env.HELM_SEAT_DEVICE_AUTH_ENABLED = "true";
    }
    expect((await db.membership.findUniqueOrThrow({ where: { id: leaving.membershipId } })).status).toBe(MembershipStatus.INACTIVE);
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: device } })).status).toBe("active");
  });

  it("leaves the devices alone when the update does not take the member out of ACTIVE", async () => {
    const staying = await member();
    const device = await activeDevice(staying);
    await expect(
      updateOrganizationMembershipLifecycleAction({ membershipId: staying.membershipId, nextStatus: MembershipStatus.ACTIVE }),
    ).resolves.toMatchObject({ ok: true });
    // A refused transition (ACTIVE -> INVITED) writes nothing.
    await expect(
      updateOrganizationMembershipLifecycleAction({ membershipId: staying.membershipId, nextStatus: MembershipStatus.INVITED }),
    ).resolves.toMatchObject({ ok: false });
    expect((await db.seatDeviceAuthorization.findUniqueOrThrow({ where: { id: device } })).status).toBe("active");
  });
});
