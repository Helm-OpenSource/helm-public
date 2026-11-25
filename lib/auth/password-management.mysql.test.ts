import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as audit from "@/lib/audit";
import { hashPassword, verifyPassword } from "./formal-auth";
import { changeMemberPassword } from "./password-management";
import { hashLoginIdentifier } from "./login-rate-limit";
import { mintSeatDeviceToken } from "@/lib/seat-device/contract";
import { classifySeatDeviceAccessToken } from "@/lib/seat-device/store-tokens";
import { registerSeatDeviceRevocationObserver, type SeatDeviceRevocationNotice } from "@/lib/seat-device/revocation-observer";

const enabled = process.env.PASSWORD_MANAGEMENT_MYSQL_REQUIRED === "1";
if (enabled && !process.env.PASSWORD_MANAGEMENT_DATABASE_URL) throw new Error("Password management requires an isolated MySQL URL");
if (enabled) {
  const url = new URL(process.env.PASSWORD_MANAGEMENT_DATABASE_URL!);
  if (process.env.DATABASE_URL !== url.href && process.env.DATABASE_URL !== process.env.PASSWORD_MANAGEMENT_DATABASE_URL) throw new Error("Integration database mismatch");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["/password_test", "/helm_password_ci"].includes(url.pathname)) throw new Error("Disposable loopback database required");
}
const run = enabled ? describe.sequential : describe.skip;
const old = "OldPassword123", next = "NewPassword456", alternative = "AnotherPassword789";
const notices: SeatDeviceRevocationNotice[] = [];
registerSeatDeviceRevocationObserver(rows => notices.push(...rows));
run("transactional password management on MySQL", () => {
  const users: string[] = [], workspaces: string[] = [];
  let workspaceId: string, actor: Awaited<ReturnType<typeof member>>, target: Awaited<ReturnType<typeof member>>;
  async function member(role: "OWNER" | "ADMIN" | "MEMBER" = "MEMBER", ws = workspaceId) {
    const user = await db.user.create({ data: { email: `${randomUUID()}@example.test`, name: "Synthetic member", passwordHash: hashPassword(old), passwordSetAt: new Date("2026-01-01") } });
    users.push(user.id);
    const m = await db.membership.create({ data: { workspaceId: ws, userId: user.id, role } });
    const s = await db.authSession.create({ data: { userId: user.id, activeWorkspaceId: ws, providerType: "PASSWORD", sessionKeyHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) } });
    return { user, m, context: { userId: user.id, workspaceId: ws, sessionId: s.id } };
  }
  beforeEach(async () => {
    vi.restoreAllMocks(); notices.length = 0;
    const w = await db.workspace.create({ data: { name: "Synthetic password workspace", slug: `password-${randomUUID()}` } });
    workspaces.push(w.id); workspaceId = w.id;
    actor = await member("OWNER"); target = await member();
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await db.seatDeviceAuthorization.deleteMany({ where: { userId: { in: users } } });
    await db.memberActivationToken.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { workspaceId: { in: workspaces } } });
    await db.authSession.deleteMany({ where: { userId: { in: users } } });
    await db.failedLoginAttempt.deleteMany({ where: { identifierHash: { in: (await db.user.findMany({ where: { id: { in: users } }, select: { email: true } })).map(u => hashLoginIdentifier(u.email)) } } });
    await db.membership.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
    await db.$disconnect();
  });
  const command = () => ({ currentPassword: old, newPassword: next });
  async function unchanged() {
    expect(verifyPassword(old, (await db.user.findUniqueOrThrow({ where: { id: target.user.id } })).passwordHash)).toBe(true);
    expect((await db.authSession.findUniqueOrThrow({ where: { id: target.context.sessionId } })).revokedAt).toBeNull();
  }
  it("changes own password, strictly advances stamp, revokes all sessions and emits secret-free audit", async () => {
    const future = new Date(Date.now() + 5000);
    await db.user.update({ where: { id: actor.user.id }, data: { passwordSetAt: future } });
    expect(await changeMemberPassword(actor.context, command())).toEqual({ ok: true, signInRequired: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: actor.user.id } });
    expect(verifyPassword(next, u.passwordHash)).toBe(true); expect(u.passwordSetAt!.getTime()).toBe(future.getTime() + 1);
    expect((await db.authSession.findUniqueOrThrow({ where: { id: actor.context.sessionId } })).revokedAt).not.toBeNull();
    const log = await db.auditLog.findFirstOrThrow({ where: { workspaceId, actionType: "PASSWORD_CHANGED" } });
    for (const secret of [old, next, u.passwordHash!]) expect(JSON.stringify(log)).not.toContain(secret);
    await expect(changeMemberPassword(actor.context, command())).rejects.toThrow();
  });
  it.each(["OWNER", "ADMIN"] as const)("%s resets a member and revokes active/approved devices after commit", async role => {
    await db.membership.update({ where: { id: actor.m.id }, data: { role } });
    const access = mintSeatDeviceToken("access");
    for (const status of ["active", "approved"]) await db.seatDeviceAuthorization.create({ data: {
      clientType: "desktop", deviceLabel: "Synthetic device", status, ...(status === "active" ? { accessTokenHash: access.tokenHash } : {}), pollTokenHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      requestedAt: new Date(), requestExpiresAt: new Date(Date.now() + 60000), workspaceId, userId: target.user.id, membershipId: target.m.id,
    } });
    expect(await changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).toEqual({ ok: true, signInRequired: false });
    expect(await db.seatDeviceAuthorization.count({ where: { userId: target.user.id, status: "revoked", revokeReason: "password_reset" } })).toBe(2);
    await vi.waitFor(() => expect(notices).toHaveLength(2));
    expect(await classifySeatDeviceAccessToken(access.token)).toEqual({ ok: false, code: "device_revoked" });
    expect((await db.authSession.findUniqueOrThrow({ where: { id: actor.context.sessionId } })).revokedAt).toBeNull();
  });
  it.each(["OWNER", "ADMIN"] as const)("Admin cannot reset %s", async role => {
    await db.membership.update({ where: { id: actor.m.id }, data: { role: "ADMIN" } });
    await db.membership.update({ where: { id: target.m.id }, data: { role } });
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).rejects.toThrow(); await unchanged();
  });
  it("Owner can reset another Owner, but own account uses self change", async () => {
    await db.membership.update({ where: { id: target.m.id }, data: { role: "OWNER" } });
    await changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id });
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: actor.m.id })).rejects.toThrow();
  });
  it("refuses inactive targets and unchanged passwords", async () => {
    await expect(changeMemberPassword(actor.context, { ...command(), newPassword: old })).rejects.toThrow();
    await db.membership.update({ where: { id: target.m.id }, data: { status: "INACTIVE" } });
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).rejects.toThrow(); await unchanged();
  });
  it("ordinary members cannot reset others", async () => {
    await db.membership.update({ where: { id: actor.m.id }, data: { role: "MEMBER" } });
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).rejects.toThrow(); await unchanged();
  });
  it("refuses cross-workspace targets and shared identities", async () => {
    const w = await db.workspace.create({ data: { name: "Other synthetic workspace", slug: `password-${randomUUID()}` } }); workspaces.push(w.id);
    const foreign = await member("MEMBER", w.id);
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: foreign.m.id })).rejects.toThrow();
    await db.membership.create({ data: { workspaceId: w.id, userId: target.user.id, role: "MEMBER", status: "INVITED" } });
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).rejects.toThrow(); await unchanged();
  });
  it.each(["revoked", "expired", "provider", "suspended", "inactive", "scoped"])("refuses stale authority: %s", async kind => {
    if (kind === "revoked") await db.authSession.update({ where: { id: actor.context.sessionId }, data: { revokedAt: new Date() } });
    if (kind === "expired") await db.authSession.update({ where: { id: actor.context.sessionId }, data: { expiresAt: new Date(0) } });
    if (kind === "provider") await db.authSession.update({ where: { id: actor.context.sessionId }, data: { providerType: "PHONE_CODE" } });
    if (kind === "suspended") await db.workspace.update({ where: { id: workspaceId }, data: { status: "SUSPENDED" } });
    if (kind === "inactive") await db.membership.update({ where: { id: actor.m.id }, data: { status: "INACTIVE" } });
    if (kind === "scoped") await db.membership.update({ where: { id: actor.m.id }, data: { accessScope: "synthetic-external" } });
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).rejects.toThrow(); await unchanged();
  });
  it("persists eight wrong step-ups and refuses a correct password while locked", async () => {
    for (let i = 0; i < 8; i++) await expect(changeMemberPassword(actor.context, { currentPassword: "wrong", newPassword: next })).rejects.toThrow();
    const counter = await db.failedLoginAttempt.findUniqueOrThrow({ where: { identifierHash: hashLoginIdentifier(actor.user.email) } });
    expect(counter.attemptCount).toBe(8); expect(counter.lockedUntil).not.toBeNull();
    await expect(changeMemberPassword(actor.context, command())).rejects.toThrow();
  });
  it("rolls back password and session revocation if audit fails; sends no notices", async () => {
    vi.spyOn(audit, "writeAuditLog").mockRejectedValueOnce(new Error("synthetic audit failure"));
    await expect(changeMemberPassword(actor.context, { ...command(), membershipId: target.m.id })).rejects.toThrow(); await unchanged(); expect(notices).toEqual([]);
  });
  it("serializes competing changes: one old password cannot authorize two new passwords", async () => {
    const results = await Promise.allSettled([changeMemberPassword(actor.context, command()), changeMemberPassword(actor.context, { ...command(), newPassword: alternative })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.auditLog.count({ where: { workspaceId, actionType: "PASSWORD_CHANGED" } })).toBe(1);
  });
  it.each(["short", "onlyletters", "123456789", "a1".repeat(129)])("rejects invalid password without changing credentials: %s", async newPassword => {
    await expect(changeMemberPassword(actor.context, { ...command(), newPassword, membershipId: target.m.id })).rejects.toThrow(); await unchanged();
  });
});
