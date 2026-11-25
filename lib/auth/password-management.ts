import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "./formal-auth";
import { evaluateLock, hashLoginIdentifier, nextStateOnFailure } from "./login-rate-limit";
import { revokeDeviceRowInTx } from "@/lib/seat-device/store-tokens";
import { notifySeatDevicesRevoked } from "@/lib/seat-device/revocation-observer";

export const passwordCommand = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256).regex(/[A-Za-z]/).regex(/[0-9]/),
  membershipId: z.string().min(1).max(191).optional(),
}).strict();
export type PasswordCommand = z.infer<typeof passwordCommand>;
type Context = { userId: string; sessionId: string; workspaceId: string };
export function canResetMember(actorRole: string, targetRole: string) {
  return actorRole === "OWNER" || (actorRole === "ADMIN" && !["OWNER", "ADMIN"].includes(targetRole));
}
const denied = () => new Error("password_change_refused");

/** IDs come from the server session; all authority and credential reads share the write transaction. */
export async function changeMemberPassword(context: Context, command: PasswordCommand) {
  const input = passwordCommand.parse(command);
  const result = await db.$transaction(async tx => {
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
    if (!(clock?.now instanceof Date)) throw denied();
    const now = clock.now;
    const session = await tx.authSession.findUnique({ where: { id: context.sessionId } });
    const actor = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: context.userId } }, include: { workspace: true, user: true } });
    if (!session || session.userId !== context.userId || session.activeWorkspaceId !== context.workspaceId || session.providerType !== "PASSWORD" || session.revokedAt || session.expiresAt <= now || !actor || actor.status !== "ACTIVE" || actor.accessScope || actor.workspace.status !== "ACTIVE") throw denied();
    const target = input.membershipId ? await tx.membership.findUnique({ where: { id: input.membershipId }, include: { user: true } }) : actor;
    if (!target || target.workspaceId !== context.workspaceId || target.status !== "ACTIVE" || target.accessScope || !target.user.passwordHash) throw denied();
    const resetting = target.userId !== context.userId;
    if (input.membershipId && !resetting) throw denied();
    if (resetting) {
      if (!canResetMember(actor.role, target.role)) throw denied();
      // User credentials are global: one workspace must not control another workspace's identities.
      if (await tx.membership.findFirst({ where: { userId: target.userId, workspaceId: { not: context.workspaceId }, status: { not: "INACTIVE" } }, select: { id: true } })) throw denied();
    }
    // Fail closed if the limiter table is unavailable; persist wrong-password attempts by returning, not throwing.
    const identifierHash = hashLoginIdentifier(actor.user.email);
    const counter = await tx.failedLoginAttempt.findUnique({ where: { identifierHash } });
    if (evaluateLock(counter, now).locked) return null;
    if (!verifyPassword(input.currentPassword, actor.user.passwordHash)) {
      const next = nextStateOnFailure(counter, now);
      await tx.failedLoginAttempt.upsert({ where: { identifierHash }, create: { identifierHash, ...next }, update: next });
      return null;
    }
    if (verifyPassword(input.newPassword, target.user.passwordHash)) throw denied();
    const passwordHash = hashPassword(input.newPassword);
    // Devices compare this stamp. Even two changes in one database millisecond must invalidate the old stamp.
    const passwordSetAt = new Date(Math.max(now.getTime(), (target.user.passwordSetAt?.getTime() ?? 0) + 1));
    const changed = await tx.user.updateMany({ where: { id: target.userId, passwordHash: target.user.passwordHash, passwordSetAt: target.user.passwordSetAt }, data: { passwordHash, passwordSetAt } });
    if (changed.count !== 1) throw denied();
    const revoked = await tx.authSession.updateMany({ where: { userId: target.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.memberActivationToken.updateMany({ where: { userId: target.userId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
    const devices = await tx.seatDeviceAuthorization.findMany({ where: { userId: target.userId, status: { in: ["approved", "active"] } } });
    const notices = [];
    for (const device of devices) notices.push(await revokeDeviceRowInTx(tx, device, "password_reset", now, {}, { userId: context.userId, name: "account administrator" }));
    await writeAuditLog({ workspaceId: context.workspaceId, userId: context.userId, actor: resetting ? "workspace administrator" : "account holder", actorType: "USER", actionType: resetting ? "MEMBER_PASSWORD_RESET" : "PASSWORD_CHANGED", targetType: "Membership", targetId: target.id, summary: "Changed password and revoked existing browser sessions and desktop devices", payload: { revokedSessions: revoked.count, revokedDevices: devices.length } }, { client: tx });
    return { notices, resetting };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  if (!result) throw denied();
  notifySeatDevicesRevoked(result.notices);
  return { ok: true as const, signInRequired: !result.resetting };
}
