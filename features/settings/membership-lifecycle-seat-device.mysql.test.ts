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
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireCurrentUser: async () => caller.user,
  getCurrentWorkspace: async () => caller.workspace,
  getCurrentMembership: async () => caller.membership,
}));

import { updateOrganizationMembershipLifecycleAction } from "@/features/settings/actions";
import { db } from "@/lib/db";
import { hashSeatDeviceToken, mintSeatDeviceToken } from "@/lib/seat-device/contract";

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
    await expect(
      updateOrganizationMembershipLifecycleAction({ membershipId: leaving.membershipId, nextStatus: MembershipStatus.INACTIVE }),
    ).resolves.toMatchObject({ ok: true });
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
  });

  it("revokes in the deactivation's own transaction: a failure after it undoes both", async () => {
    const leaving = await member();
    const device = await activeDevice(leaving);
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
