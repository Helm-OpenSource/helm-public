import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { canSelfCreateOrganization } from "./organization-creation-policy";
import { authorizeMemberActivation, type MemberActivationBinding } from "./member-activation-authority";
import { hashPassword, verifyPassword } from "./formal-auth";
import { activationTokenDigest, assertActivationIssuer, assertActivationTarget, requireMemberActivationEnabled } from "./member-activation-policy";

const unavailable = () => new Error("Member activation unavailable");
const emailDigest = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
async function databaseNow(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
  if (!(rows[0]?.now instanceof Date)) throw unavailable();
  return rows[0].now;
}
async function issuer(tx: Prisma.TransactionClient, userId: string, sessionId: string, workspaceId: string, now: Date) {
  const session = await tx.authSession.findUnique({ where: { id: sessionId } });
  const membership = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, include: { workspace: true } });
  if (!session || session.userId !== userId || session.activeWorkspaceId !== workspaceId || session.revokedAt || session.expiresAt <= now) throw unavailable();
  assertActivationIssuer(membership, session.providerType, membership?.workspace.status, workspaceId);
  return membership!;
}
async function target(tx: Prisma.TransactionClient, membershipId: string, workspaceId: string) {
  const membership = await tx.membership.findUnique({ where: { id: membershipId }, include: { user: { include: { memberships: true } } } });
  if (!membership || membership.user.passwordSetAt) throw unavailable();
  assertActivationTarget(membership, membership.user.passwordHash, membership.user.memberships, workspaceId);
  return membership;
}
/** Issuer inputs are derived from the authenticated server session, never from form fields. */
export async function issueMemberActivation(input: { issuerUserId: string; issuerSessionId: string; workspaceId: string; issuerWorkspaceId?: string; expectedAuthorityBinding?: MemberActivationBinding; membershipId: string; password: string }) {
  requireMemberActivationEnabled();
  if (input.password.length > 256 || input.password.length < 8) throw unavailable();
  const admin = await db.user.findUnique({ where: { id: input.issuerUserId } });
  if (!admin?.passwordHash || !verifyPassword(input.password, admin.passwordHash)) throw unavailable();
  const issuerWorkspaceId = input.issuerWorkspaceId ?? input.workspaceId;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = activationTokenDigest(token);
  const receipt = await db.$transaction(async tx => {
    const now = await databaseNow(tx);
    await issuer(tx, input.issuerUserId, input.issuerSessionId, issuerWorkspaceId, now);
    const currentAdmin = await tx.user.findUnique({ where: { id: input.issuerUserId } });
    if (currentAdmin?.passwordHash !== admin.passwordHash) throw unavailable();
    const member = await target(tx, input.membershipId, input.workspaceId);
    const requiresAuthority = issuerWorkspaceId !== input.workspaceId || !canSelfCreateOrganization();
    const binding = !requiresAuthority ? null : await authorizeMemberActivation(tx, {
      phase: "issue", issuerWorkspaceId, issuerUserId: input.issuerUserId, issuerSessionId: input.issuerSessionId,
      targetWorkspaceId: input.workspaceId, targetMembershipId: member.id, targetUserId: member.userId,
    });
    if (input.expectedAuthorityBinding && (!binding || binding.bindingRef !== input.expectedAuthorityBinding.bindingRef || binding.bindingVersion !== input.expectedAuthorityBinding.bindingVersion)) throw unavailable();
    // Serializable target user/membership reads exclude competing identity changes.
    await tx.memberActivationToken.updateMany({ where: { userId: member.userId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
    const row = await tx.memberActivationToken.create({ data: { tokenHash, userId: member.userId, membershipId: member.id, workspaceId: input.workspaceId, issuedByUserId: input.issuerUserId, issuedBySessionId: input.issuerSessionId, issuerWorkspaceId, authorityBindingRef: binding?.bindingRef ?? null, authorityBindingVersion: binding?.bindingVersion ?? null, membershipUpdatedAt: member.updatedAt, emailHash: emailDigest(member.user.email), expiresAt: new Date(now.getTime() + 30 * 60_000) } });
    await writeAuditLog({ workspaceId: row.workspaceId, userId: input.issuerUserId, actor: "workspace administrator", actorType: "USER", actionType: "MEMBER_ACTIVATION_ISSUED", targetType: "Membership", targetId: row.membershipId, summary: "Issued a one-time first-password activation credential for controlled delivery", payload: { activationId: row.id, expiresAt: row.expiresAt.toISOString(), issuerSessionId: row.issuedBySessionId, issuerWorkspaceId, authorityBindingRef: row.authorityBindingRef, authorityBindingVersion: row.authorityBindingVersion === null ? null : Number(row.authorityBindingVersion), membershipUpdatedAt: row.membershipUpdatedAt.toISOString() } }, { client: tx });
    return { activationId: row.id, expiresAt: row.expiresAt.toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...receipt, token };
}
export async function consumeMemberActivation(input: { token: string; password: string }) {
  requireMemberActivationEnabled();
  const tokenHash = activationTokenDigest(input.token);
  if (input.password.length < 8 || input.password.length > 256 || !/[A-Za-z]/.test(input.password) || !/[0-9]/.test(input.password)) throw unavailable();
  // Avoid performing password hashing for arbitrary unauthenticated token guesses.
  const initial = await db.memberActivationToken.findUnique({ where: { tokenHash } });
  if (!initial || initial.consumedAt || initial.revokedAt) throw unavailable();
  const passwordHash = hashPassword(input.password);
  await db.$transaction(async tx => {
    const now = await databaseNow(tx);
    const row = await tx.memberActivationToken.findUnique({ where: { tokenHash } });
    if (!row || row.consumedAt || row.revokedAt || row.expiresAt <= now) throw unavailable();
    await issuer(tx, row.issuedByUserId, row.issuedBySessionId, row.issuerWorkspaceId, now);
    const member = await target(tx, row.membershipId, row.workspaceId);
    if (member.userId !== row.userId || member.updatedAt.getTime() !== row.membershipUpdatedAt.getTime() || emailDigest(member.user.email) !== row.emailHash) throw unavailable();
    if (row.issuerWorkspaceId !== row.workspaceId || row.authorityBindingRef !== null || !canSelfCreateOrganization()) {
      const binding = await authorizeMemberActivation(tx, { phase: "consume", issuerWorkspaceId: row.issuerWorkspaceId,
        issuerUserId: row.issuedByUserId, issuerSessionId: row.issuedBySessionId, targetWorkspaceId: row.workspaceId,
        targetMembershipId: row.membershipId, targetUserId: row.userId });
      if (binding.bindingRef !== row.authorityBindingRef || binding.bindingVersion !== Number(row.authorityBindingVersion)) throw unavailable();
    } else if (row.authorityBindingRef !== null || row.authorityBindingVersion !== null) throw unavailable();
    const claimed = await tx.memberActivationToken.updateMany({ where: { id: row.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (claimed.count !== 1) throw unavailable();
    const changed = await tx.user.updateMany({ where: { id: row.userId, passwordHash: null }, data: { passwordHash, passwordSetAt: now } });
    if (changed.count !== 1) throw unavailable();
    await tx.memberActivationToken.updateMany({ where: { userId: row.userId, id: { not: row.id }, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
    const revoked = await tx.authSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } });
    await writeAuditLog({ workspaceId: row.workspaceId, userId: row.userId, actor: "activation credential holder", actorType: "USER", actionType: "MEMBER_ACTIVATION_CONSUMED", targetType: "Membership", targetId: row.membershipId, summary: "Set first password by controlled activation; email ownership is not attested", payload: { activationId: row.id, revokedSessions: revoked.count, issuedByUserId: row.issuedByUserId, issuerWorkspaceId: row.issuerWorkspaceId, authorityBindingRef: row.authorityBindingRef, authorityBindingVersion: row.authorityBindingVersion === null ? null : Number(row.authorityBindingVersion) } }, { client: tx });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  // No session minted, no emailVerifiedAt, and no direct INVITED -> ACTIVE write.
  return { ok: true as const };
}
