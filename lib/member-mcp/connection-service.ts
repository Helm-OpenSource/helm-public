import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ActorType, MembershipStatus, Prisma, type WorkspaceRole } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  MEMBER_MCP_CLAIM_WINDOW_DAYS,
  MEMBER_MCP_MAX_OPEN_CONNECTIONS_PER_MEMBER,
  MEMBER_MCP_P0_ISSUABLE_SCOPES,
  MEMBER_MCP_RATE_LIMIT_PER_MINUTE,
  MEMBER_MCP_TOKEN_PREFIX,
  MEMBER_MCP_TOKEN_TTL_DAYS,
  canManageMemberApproverGrants,
  decideMemberConnectionApproval,
  effectiveMemberConnectionStatus,
  isOpenMemberConnectionStatus,
  normalizeDeviceLabel,
  normalizeGroupTag,
  parseStoredMemberMcpScopes,
  readMemberMcpWorkspaceFlags,
  type MemberMcpClientType,
  type MemberMcpScope,
} from "@/lib/member-mcp/contract";

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_PAGE = "/settings/ai-access";

export class MemberAgentConnectionError extends Error {
  readonly code:
    | "RUNTIME_DISABLED"
    | "CLIENT_NOT_APPROVED"
    | "INVALID_INPUT"
    | "TOO_MANY_OPEN"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "STATE_CONFLICT"
    | "UNAUTHENTICATED"
    | "EXPIRED"
    | "RATE_LIMITED";

  constructor(code: MemberAgentConnectionError["code"], message: string) {
    super(message);
    this.name = "MemberAgentConnectionError";
    this.code = code;
  }
}

export type MemberMcpActor = {
  userId: string;
  name: string;
  role: WorkspaceRole;
  membershipActive: boolean;
};

type ConnectionRow = Prisma.MemberAgentConnectionGetPayload<object>;

export function hashMemberMcpToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function mintToken() {
  const token = `${MEMBER_MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashMemberMcpToken(token), tokenPrefix: token.slice(0, 12) };
}

export function serializeMemberAgentConnection(row: ConnectionRow, now: Date) {
  return {
    id: row.id,
    userId: row.userId,
    clientType: row.clientType,
    deviceLabel: row.deviceLabel,
    scopes: parseStoredMemberMcpScopes(row.scopesJson),
    status: effectiveMemberConnectionStatus(row, now),
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByUserId: row.decidedByUserId,
    decisionReason: row.decisionReason,
    claimDeadlineAt: row.claimDeadlineAt?.toISOString() ?? null,
    tokenPrefix: row.tokenPrefix,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    lastClientName: row.lastClientName,
    lastClientVersion: row.lastClientVersion,
    lastFailureCode: row.lastFailureCode,
  };
}

export type SerializedMemberAgentConnection = ReturnType<typeof serializeMemberAgentConnection>;

async function loadWorkspaceFlags(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { featureFlagsJson: true },
  });
  return readMemberMcpWorkspaceFlags(workspace?.featureFlagsJson);
}

async function activeGrantTags(workspaceId: string, userId: string) {
  const grants = await db.memberAgentApproverGrant.findMany({
    where: { workspaceId, approverUserId: userId, revokedAt: null },
    select: { groupTag: true },
  });
  return grants.map((grant) => grant.groupTag);
}

async function loadTargetMembership(workspaceId: string, userId: string) {
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { status: true, groupTag: true },
  });
  return {
    userId,
    groupTag: membership?.groupTag ?? null,
    membershipActive: membership?.status === MembershipStatus.ACTIVE,
  };
}

async function judgeApproval(workspaceId: string, actor: MemberMcpActor, targetUserId: string) {
  const [grantedGroupTags, target] = await Promise.all([
    activeGrantTags(workspaceId, actor.userId),
    loadTargetMembership(workspaceId, targetUserId),
  ]);
  return decideMemberConnectionApproval(
    {
      userId: actor.userId,
      role: actor.role,
      membershipActive: actor.membershipActive,
      grantedGroupTags,
    },
    target,
  );
}

// Lifecycle writes are version-checked updates inside a Serializable
// transaction opened in the same function (conditional-update CAS guard); a
// serialization failure is retried, a lost race surfaces as STATE_CONFLICT.
const WRITE_RETRY_OPTIONS = { maxAttempts: 8, retryDelayMs: 50 } as const;

function conflict(): never {
  throw new MemberAgentConnectionError("STATE_CONFLICT", "Connection changed concurrently");
}

async function audit(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    actor: MemberMcpActor;
    actionType: string;
    connection: ConnectionRow;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  await writeAuditLog(
    {
      workspaceId: input.workspaceId,
      userId: input.actor.userId,
      actor: input.actor.name,
      actorType: ActorType.USER,
      actionType: input.actionType,
      targetType: "MemberAgentConnection",
      targetId: input.connection.id,
      summary: input.summary,
      payload: {
        memberUserId: input.connection.userId,
        clientType: input.connection.clientType,
        scopes: parseStoredMemberMcpScopes(input.connection.scopesJson),
        ...input.payload,
      },
      sourcePage: SOURCE_PAGE,
    },
    { client: tx },
  );
}

export async function requestMemberAgentConnection(input: {
  workspaceId: string;
  membershipId: string;
  actor: MemberMcpActor;
  clientType: MemberMcpClientType;
  deviceLabel: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const flags = await loadWorkspaceFlags(input.workspaceId);
  if (!flags.enabled) throw new MemberAgentConnectionError("RUNTIME_DISABLED", "Member MCP is disabled");
  if (!flags.approvedClients.includes(input.clientType)) {
    throw new MemberAgentConnectionError("CLIENT_NOT_APPROVED", "Client type is not approved for this workspace");
  }
  if (!input.actor.membershipActive) throw new MemberAgentConnectionError("FORBIDDEN", "Membership is not active");
  const deviceLabel = normalizeDeviceLabel(input.deviceLabel);
  if (!deviceLabel) throw new MemberAgentConnectionError("INVALID_INPUT", "Device label must be 2-80 printable characters");

  const existing = await db.memberAgentConnection.findMany({
    where: { workspaceId: input.workspaceId, userId: input.actor.userId, status: { in: ["requested", "approved", "active"] } },
    select: { status: true, claimDeadlineAt: true, expiresAt: true },
  });
  const open = existing.filter((row) => isOpenMemberConnectionStatus(effectiveMemberConnectionStatus(row, now)));
  if (open.length >= MEMBER_MCP_MAX_OPEN_CONNECTIONS_PER_MEMBER) {
    throw new MemberAgentConnectionError("TOO_MANY_OPEN", "Too many open connections for this member");
  }

  const scopes: MemberMcpScope[] = [...MEMBER_MCP_P0_ISSUABLE_SCOPES];
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const row = await tx.memberAgentConnection.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.actor.userId,
        membershipId: input.membershipId,
        clientType: input.clientType,
        deviceLabel,
        deviceRef: `device:${randomUUID()}`,
        scopesJson: JSON.stringify(scopes),
        status: "requested",
        requestedAt: now,
      },
    });
    await audit(tx, {
      workspaceId: input.workspaceId,
      actor: input.actor,
      actionType: "MEMBER_AGENT_CONNECTION_REQUESTED",
      connection: row,
      summary: `申请 AI 工具接入：${deviceLabel}`,
    });
    return serializeMemberAgentConnection(row, now);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
}

export async function decideMemberAgentConnection(input: {
  workspaceId: string;
  connectionId: string;
  actor: MemberMcpActor;
  decision: "approve" | "reject";
  reason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const row = await db.memberAgentConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId },
  });
  if (!row) throw new MemberAgentConnectionError("NOT_FOUND", "Connection not found");
  const approval = await judgeApproval(input.workspaceId, input.actor, row.userId);
  if (!approval.allowed) throw new MemberAgentConnectionError("FORBIDDEN", approval.reason);
  if (row.status !== "requested") throw new MemberAgentConnectionError("STATE_CONFLICT", "Connection is not awaiting a decision");
  if (input.decision === "approve") {
    const flags = await loadWorkspaceFlags(input.workspaceId);
    if (!flags.approvedClients.includes(row.clientType as MemberMcpClientType)) {
      throw new MemberAgentConnectionError("CLIENT_NOT_APPROVED", "Client type is no longer approved");
    }
  }
  const reason = input.reason?.trim().slice(0, 200) || null;
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const result = await tx.memberAgentConnection.updateMany({
      where: { id: row.id, status: "requested", version: row.version },
      data: {
        status: input.decision === "approve" ? "approved" : "rejected",
        decidedAt: now,
        decidedByUserId: input.actor.userId,
        decisionReason: reason,
        claimDeadlineAt: input.decision === "approve" ? new Date(now.getTime() + MEMBER_MCP_CLAIM_WINDOW_DAYS * DAY_MS) : null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) conflict();
    const updated = await tx.memberAgentConnection.findUniqueOrThrow({ where: { id: row.id } });
    await audit(tx, {
      workspaceId: input.workspaceId,
      actor: input.actor,
      actionType: input.decision === "approve" ? "MEMBER_AGENT_CONNECTION_APPROVED" : "MEMBER_AGENT_CONNECTION_REJECTED",
      connection: updated,
      summary: input.decision === "approve" ? `批准 AI 工具接入：${row.deviceLabel}` : `驳回 AI 工具接入：${row.deviceLabel}`,
      payload: { basis: approval.basis, reasonPresent: Boolean(reason) },
    });
    return serializeMemberAgentConnection(updated, now);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
}

// Only the member themself can claim; the plaintext token is returned once
// and never stored.
export async function claimMemberAgentConnection(input: {
  workspaceId: string;
  connectionId: string;
  actor: MemberMcpActor;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const row = await db.memberAgentConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId, userId: input.actor.userId },
  });
  if (!row) throw new MemberAgentConnectionError("NOT_FOUND", "Connection not found");
  if (!input.actor.membershipActive) throw new MemberAgentConnectionError("FORBIDDEN", "Membership is not active");
  if (effectiveMemberConnectionStatus(row, now) !== "approved") {
    throw new MemberAgentConnectionError("STATE_CONFLICT", "Connection is not claimable");
  }
  const flags = await loadWorkspaceFlags(input.workspaceId);
  if (!flags.enabled) throw new MemberAgentConnectionError("RUNTIME_DISABLED", "Member MCP is disabled");
  const secret = mintToken();
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    // The claim deadline is part of the predicate: a lapsed approval cannot be
    // claimed even if the check above raced the clock.
    const result = await tx.memberAgentConnection.updateMany({
      where: { id: row.id, status: "approved", version: row.version, claimDeadlineAt: { gt: now } },
      data: {
        status: "active",
        tokenHash: secret.tokenHash,
        tokenPrefix: secret.tokenPrefix,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + MEMBER_MCP_TOKEN_TTL_DAYS * DAY_MS),
        rateWindowStartedAt: now,
        rateWindowRequestCount: 0,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) conflict();
    const updated = await tx.memberAgentConnection.findUniqueOrThrow({ where: { id: row.id } });
    await audit(tx, {
      workspaceId: input.workspaceId,
      actor: input.actor,
      actionType: "MEMBER_AGENT_CONNECTION_CLAIMED",
      connection: updated,
      summary: `领取 AI 工具接入令牌：${row.deviceLabel}`,
      payload: { tokenStoredAsHashOnly: true, expiresAt: updated.expiresAt?.toISOString() ?? null },
    });
    return { connection: serializeMemberAgentConnection(updated, now), token: secret.token };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
}

// The member can revoke their own connection; approvers can revoke what they
// could approve. Revocation applies to requested/approved/active rows.
export async function revokeMemberAgentConnection(input: {
  workspaceId: string;
  connectionId: string;
  actor: MemberMcpActor;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const row = await db.memberAgentConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId },
  });
  if (!row) throw new MemberAgentConnectionError("NOT_FOUND", "Connection not found");
  const own = row.userId === input.actor.userId;
  if (!own) {
    const approval = await judgeApproval(input.workspaceId, input.actor, row.userId);
    if (!approval.allowed) throw new MemberAgentConnectionError("FORBIDDEN", approval.reason);
  }
  if (!["requested", "approved", "active"].includes(row.status)) {
    throw new MemberAgentConnectionError("STATE_CONFLICT", "Connection is already closed");
  }
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const result = await tx.memberAgentConnection.updateMany({
      where: { id: row.id, status: row.status, version: row.version },
      data: { status: "revoked", revokedAt: now, revokedByUserId: input.actor.userId, version: { increment: 1 } },
    });
    if (result.count !== 1) conflict();
    const updated = await tx.memberAgentConnection.findUniqueOrThrow({ where: { id: row.id } });
    await audit(tx, {
      workspaceId: input.workspaceId,
      actor: input.actor,
      actionType: "MEMBER_AGENT_CONNECTION_REVOKED",
      connection: updated,
      summary: `吊销 AI 工具接入：${row.deviceLabel}`,
      payload: { revokedBySelf: own, previousStatus: row.status },
    });
    return serializeMemberAgentConnection(updated, now);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
}

export async function listMyMemberAgentConnections(workspaceId: string, userId: string, now = new Date()) {
  const rows = await db.memberAgentConnection.findMany({
    where: { workspaceId, userId },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  return rows.map((row) => serializeMemberAgentConnection(row, now));
}

// What an approver may see: everything for workspace-capability holders,
// otherwise only members whose groupTag the approver holds a grant for.
export async function listApprovableMemberAgentConnections(
  workspaceId: string,
  actor: MemberMcpActor,
  now = new Date(),
) {
  if (!actor.membershipActive) return { scope: "none" as const, connections: [] };
  let userFilter: string[] | null = null;
  if (!canManageMemberApproverGrants(actor.role)) {
    const tags = await activeGrantTags(workspaceId, actor.userId);
    if (tags.length === 0) return { scope: "none" as const, connections: [] };
    const members = await db.membership.findMany({
      where: { workspaceId, groupTag: { in: tags } },
      select: { userId: true },
    });
    userFilter = members.map((member) => member.userId).filter((id) => id !== actor.userId);
  }
  const rows = await db.memberAgentConnection.findMany({
    where: { workspaceId, ...(userFilter ? { userId: { in: userFilter } } : {}) },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return {
    scope: userFilter ? ("group" as const) : ("workspace" as const),
    connections: rows.map((row) => ({
      ...serializeMemberAgentConnection(row, now),
      memberName: byId.get(row.userId)?.name ?? null,
      memberEmail: byId.get(row.userId)?.email ?? null,
    })),
  };
}

export async function listMemberApproverGrants(workspaceId: string) {
  const grants = await db.memberAgentApproverGrant.findMany({
    where: { workspaceId, revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(grants.map((grant) => grant.approverUserId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return grants.map((grant) => ({
    id: grant.id,
    approverUserId: grant.approverUserId,
    approverName: byId.get(grant.approverUserId)?.name ?? null,
    approverEmail: byId.get(grant.approverUserId)?.email ?? null,
    groupTag: grant.groupTag,
    grantedAt: grant.grantedAt.toISOString(),
    grantedByUserId: grant.grantedByUserId,
  }));
}

export async function grantMemberApprover(input: {
  workspaceId: string;
  actor: MemberMcpActor;
  approverUserId: string;
  groupTag: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.actor.membershipActive || !canManageMemberApproverGrants(input.actor.role)) {
    throw new MemberAgentConnectionError("FORBIDDEN", "Only owners and admins designate approvers");
  }
  const groupTag = normalizeGroupTag(input.groupTag);
  if (!groupTag) throw new MemberAgentConnectionError("INVALID_INPUT", "Group tag must be 1-60 characters");
  const approver = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.approverUserId } },
    select: { status: true },
  });
  if (approver?.status !== MembershipStatus.ACTIVE) {
    throw new MemberAgentConnectionError("INVALID_INPUT", "Approver must be an active member");
  }
  const tagged = await db.membership.count({ where: { workspaceId: input.workspaceId, groupTag } });
  if (tagged === 0) throw new MemberAgentConnectionError("INVALID_INPUT", "No member carries this group tag");
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const duplicate = await tx.memberAgentApproverGrant.findFirst({
      where: { workspaceId: input.workspaceId, approverUserId: input.approverUserId, groupTag, revokedAt: null },
    });
    if (duplicate) throw new MemberAgentConnectionError("STATE_CONFLICT", "Grant already exists");
    const grant = await tx.memberAgentApproverGrant.create({
      data: {
        workspaceId: input.workspaceId,
        approverUserId: input.approverUserId,
        groupTag,
        grantedByUserId: input.actor.userId,
        grantedAt: now,
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actor.userId,
        actor: input.actor.name,
        actorType: ActorType.USER,
        actionType: "MEMBER_AGENT_APPROVER_GRANTED",
        targetType: "MemberAgentApproverGrant",
        targetId: grant.id,
        summary: `指定 AI 工具接入审批人（分组 ${groupTag}）`,
        payload: { approverUserId: input.approverUserId, groupTag },
        sourcePage: SOURCE_PAGE,
      },
      { client: tx },
    );
    return { id: grant.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
}

export async function revokeMemberApproverGrant(input: {
  workspaceId: string;
  actor: MemberMcpActor;
  grantId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.actor.membershipActive || !canManageMemberApproverGrants(input.actor.role)) {
    throw new MemberAgentConnectionError("FORBIDDEN", "Only owners and admins designate approvers");
  }
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const result = await tx.memberAgentApproverGrant.updateMany({
      where: { id: input.grantId, workspaceId: input.workspaceId, revokedAt: null },
      data: { revokedAt: now, revokedByUserId: input.actor.userId },
    });
    if (result.count !== 1) throw new MemberAgentConnectionError("NOT_FOUND", "Grant not found");
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: input.actor.userId,
        actor: input.actor.name,
        actorType: ActorType.USER,
        actionType: "MEMBER_AGENT_APPROVER_REVOKED",
        targetType: "MemberAgentApproverGrant",
        targetId: input.grantId,
        summary: "撤销 AI 工具接入审批人",
        sourcePage: SOURCE_PAGE,
      },
      { client: tx },
    );
    return { id: input.grantId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
}

export type MemberMcpAuthContext = {
  connectionId: string;
  workspaceId: string;
  userId: string;
  deviceRef: string;
  clientType: string;
  deviceLabel: string;
  scopes: readonly MemberMcpScope[];
  expiresAt: Date;
  approvedClients: readonly MemberMcpClientType[];
};

// Every call re-checks: runtime switches, token state and expiry, and that the
// member is still an ACTIVE member of the workspace (live membership).
export async function authenticateMemberMcpToken(token: string, now = new Date()): Promise<MemberMcpAuthContext> {
  const row = await db.memberAgentConnection.findUnique({ where: { tokenHash: hashMemberMcpToken(token) } });
  if (!row || row.status !== "active") {
    throw new MemberAgentConnectionError("UNAUTHENTICATED", "Unknown or inactive credential");
  }
  const [workspace, membership] = await Promise.all([
    db.workspace.findUnique({ where: { id: row.workspaceId }, select: { featureFlagsJson: true } }),
    db.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: row.workspaceId, userId: row.userId } },
      select: { status: true },
    }),
  ]);
  const flags = readMemberMcpWorkspaceFlags(workspace?.featureFlagsJson);
  if (!flags.enabled) throw new MemberAgentConnectionError("RUNTIME_DISABLED", "Member MCP is disabled");
  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime()) {
    await recordFailure(row.id, "EXPIRED");
    throw new MemberAgentConnectionError("EXPIRED", "Credential expired");
  }
  if (membership?.status !== MembershipStatus.ACTIVE) {
    await recordFailure(row.id, "MEMBERSHIP_INACTIVE");
    throw new MemberAgentConnectionError("UNAUTHENTICATED", "Membership is not active");
  }
  await claimRateLimit(row.id, now);
  await db.memberAgentConnection.update({
    where: { id: row.id },
    data: { lastUsedAt: now, lastFailureCode: null },
  });
  return {
    connectionId: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    deviceRef: row.deviceRef,
    clientType: row.clientType,
    deviceLabel: row.deviceLabel,
    scopes: parseStoredMemberMcpScopes(row.scopesJson),
    expiresAt: row.expiresAt,
    approvedClients: flags.approvedClients,
  };
}

export async function recordMemberMcpClientInfo(input: {
  connectionId: string;
  clientName: string;
  clientVersion: string;
}) {
  const clientName = normalizeClientInfo(input.clientName);
  const clientVersion = normalizeClientInfo(input.clientVersion);
  if (!clientName || !clientVersion) return;
  await db.memberAgentConnection.update({
    where: { id: input.connectionId },
    data: { lastClientName: clientName, lastClientVersion: clientVersion },
  });
}

function normalizeClientInfo(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 80 && /^[A-Za-z0-9 ._+()/-]+$/.test(normalized)
    ? normalized
    : null;
}

async function claimRateLimit(connectionId: string, now: Date) {
  const cutoff = new Date(now.getTime() - 60_000);
  const allowed = await runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const reset = await tx.memberAgentConnection.updateMany({
      where: {
        id: connectionId,
        OR: [{ rateWindowStartedAt: null }, { rateWindowStartedAt: { lte: cutoff } }],
      },
      data: { rateWindowStartedAt: now, rateWindowRequestCount: 1 },
    });
    if (reset.count === 1) return true;
    const incremented = await tx.memberAgentConnection.updateMany({
      where: {
        id: connectionId,
        rateWindowStartedAt: { gt: cutoff },
        rateWindowRequestCount: { lt: MEMBER_MCP_RATE_LIMIT_PER_MINUTE },
      },
      data: { rateWindowRequestCount: { increment: 1 } },
    });
    return incremented.count === 1;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), WRITE_RETRY_OPTIONS);
  if (!allowed) {
    await recordFailure(connectionId, "RATE_LIMITED");
    throw new MemberAgentConnectionError("RATE_LIMITED", "Rate limit exceeded");
  }
}

async function recordFailure(connectionId: string, code: string) {
  await db.memberAgentConnection.update({ where: { id: connectionId }, data: { lastFailureCode: code } });
}
