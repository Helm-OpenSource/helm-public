import "server-only";

// lib/seat-device/store-tokens.ts
// Seat desktop device authorization (D1), credential side: read-only
// classification of an access token for the extension's device channel,
// the one-time audience pin, and every way a device credential is revoked
// (by the device with any refresh token of its family, by the member or a
// workspace OWNER/ADMIN, and in a caller's transaction when the membership
// or the seat goes inactive).
//
// Revocation flips the stored status and keeps every hash: a revoked device
// is judged by its status, so its current and previous access tokens die at
// once and a later revoke with an old token still finds the device.
//
// Consistency (design v0.3 §6.2, P2-7): outside a caller's transaction,
// Workspace, Membership and User are read before the Serializable
// transaction, which then re-reads the device row and writes it by CAS on
// (id, status, version). The two *InTx functions run inside the caller's
// transaction at the caller's isolation, so their writes are single
// statements whose own WHERE carries the expected state.
//
// No plaintext token is stored, logged or put in an error or audit payload.

import { Prisma, WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import {
  SEAT_DEVICE_ACCESS_TOKEN_PATTERN,
  hashSeatDeviceToken,
  isSeatDeviceWorkspaceEnabled,
  type SeatDeviceClientRevokeReason,
  type SeatDeviceRevokeReason,
} from "@/lib/seat-device/contract";
import {
  SeatDeviceAuthError,
  assertDeploymentEnabled,
  auditDevice,
  casLost,
  loadMemberContext,
  retried,
} from "@/lib/seat-device/store-authorize";

// An approved request becomes a device on claim, so revoking it stops the
// claim; an active row past its absolute expiry is revoked too (records the
// intent, changes nothing else).
const REVOCABLE_STATUSES = ["approved", "active"];
const REVOKERS_OF_OTHERS: readonly WorkspaceRole[] = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];
const AUDIENCE_PIN_MAX_LENGTH = 191;

type DeviceRow = {
  id: string;
  status: string;
  version: number;
  workspaceId: string | null;
  userId: string | null;
  clientType: string;
  deviceLabel: string;
};

// Which slot of the device's family a presented refresh token sits in.
// Hashes are random and never move between devices, so the device found
// here stays the token's device; only its slot can change afterwards.
export type SeatDeviceRefreshMatch = "current" | "previous" | "retired";

export async function findSeatDeviceByRefreshHash(
  client: Prisma.TransactionClient,
  tokenHash: string,
): Promise<{ deviceId: string; match: SeatDeviceRefreshMatch } | null> {
  const row = await client.seatDeviceAuthorization.findFirst({
    where: { OR: [{ refreshTokenHash: tokenHash }, { previousRefreshTokenHash: tokenHash }] },
    select: { id: true, refreshTokenHash: true },
  });
  if (row) return { deviceId: row.id, match: row.refreshTokenHash === tokenHash ? "current" : "previous" };
  const retired = await client.seatDeviceTokenHistory.findUnique({
    where: { tokenHash },
    select: { deviceId: true, kind: true },
  });
  return retired?.kind === "refresh" ? { deviceId: retired.deviceId, match: "retired" } : null;
}

// The status flip: one UPDATE whose own WHERE carries the expected state, so
// it cannot pass on a stale read at any isolation level. False when the row
// is no longer in that state; then nothing is written.
async function revokeWhere(
  tx: Prisma.TransactionClient,
  id: string,
  expected: Prisma.Sql,
  reason: SeatDeviceRevokeReason,
  now: Date,
  actor: { userId: string; name: string } | null,
): Promise<boolean> {
  const changed = await tx.$executeRaw`
    UPDATE \`SeatDeviceAuthorization\`
    SET \`status\` = 'revoked', \`revokedAt\` = ${now}, \`revokedByUserId\` = ${actor?.userId ?? null},
        \`revokeReason\` = ${reason}, \`sourceIp\` = NULL, \`version\` = \`version\` + 1, \`updatedAt\` = ${now}
    WHERE \`id\` = ${id} AND ${expected}`;
  return changed === 1;
}

function auditRevoke(
  tx: Prisma.TransactionClient,
  row: Omit<DeviceRow, "status" | "version">,
  reason: SeatDeviceRevokeReason,
  payload: Record<string, unknown>,
  actor: { userId: string; name: string } | null,
) {
  return auditDevice(tx, row, "SEAT_DEVICE_REVOKED", `撤销坐席客户端设备：${row.deviceLabel}`, { reason, ...payload }, actor);
}

// Revokes a row read in the same Serializable transaction; a lost CAS is a
// conflict the caller's retry loop re-runs.
export async function revokeDeviceRowInTx(
  tx: Prisma.TransactionClient,
  row: DeviceRow,
  reason: SeatDeviceRevokeReason,
  now: Date,
  payload: Record<string, unknown>,
  actor: { userId: string; name: string } | null = null,
) {
  const unchanged = Prisma.sql`\`status\` = ${row.status} AND \`version\` = ${row.version}`;
  if (!(await revokeWhere(tx, row.id, unchanged, reason, now, actor))) casLost();
  await auditRevoke(tx, row, reason, payload, actor);
}

// ---------------------------------------------------------------------------
// Device: revoke with a refresh token
// ---------------------------------------------------------------------------

// Design §4.2 #5: the current, the previous and every retired refresh token
// of the device revoke it (after a lost answer the client may hold only an
// old one). Every token outcome is the same empty answer, so the call never
// says whether a token exists; only contention leaves as a closed code.
export async function revokeSeatDeviceWithRefreshToken(input: {
  refreshToken: string;
  reason: SeatDeviceClientRevokeReason;
  now?: Date;
}): Promise<void> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const found = await findSeatDeviceByRefreshHash(db, hashSeatDeviceToken(input.refreshToken));
  if (!found) return;
  await retried(() => db.$transaction(async (tx) => {
    const row = await tx.seatDeviceAuthorization.findUnique({ where: { id: found.deviceId } });
    if (!row || !REVOCABLE_STATUSES.includes(row.status)) return;
    await revokeDeviceRowInTx(tx, row, input.reason, now, { refreshTokenMatched: found.match });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), "temporarily_unavailable");
}

// ---------------------------------------------------------------------------
// Website: the member, or a workspace OWNER/ADMIN, revokes a device
// ---------------------------------------------------------------------------

// The actor acts in the session's workspace and only on devices bound there.
// A device of someone else, outside that workspace, or unknown reads the same
// `forbidden`. The target member may have left already: removing access
// never needs the target to be active, nor the workspace flag to be on.
export async function revokeSeatDeviceByMember(input: {
  authSessionId: string;
  userId: string;
  deviceId: string;
  now?: Date;
}): Promise<{ revoked: boolean }> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const member = await loadMemberContext(input.authSessionId, input.userId, now);
  const peek = await db.seatDeviceAuthorization.findUnique({
    where: { id: input.deviceId },
    select: { workspaceId: true, userId: true },
  });
  if (!peek || !peek.userId || peek.workspaceId !== member.workspace.id) throw new SeatDeviceAuthError("forbidden");
  const own = peek.userId === member.userId;
  if (!own && !REVOKERS_OF_OTHERS.includes(member.role)) throw new SeatDeviceAuthError("forbidden");

  return retried(() => db.$transaction(async (tx) => {
    const row = await tx.seatDeviceAuthorization.findUnique({ where: { id: input.deviceId } });
    if (!row || row.userId !== peek.userId || row.workspaceId !== peek.workspaceId) throw new SeatDeviceAuthError("forbidden");
    if (!REVOCABLE_STATUSES.includes(row.status)) return { revoked: false };
    await revokeDeviceRowInTx(tx, row, own ? "self" : "admin", now, { revokedBySelf: own }, {
      userId: member.userId,
      name: member.userName,
    });
    return { revoked: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), "temporarily_unavailable");
}

// ---------------------------------------------------------------------------
// Caller's transaction: membership or seat went inactive
// ---------------------------------------------------------------------------

// Revokes every device bound to the membership, inside the caller's
// transaction, so the deactivation and the revocation commit together. The
// extension passes the acting membership's own workspace and id (a
// contractor's member belongs to another workspace than the case binding).
// Returns the number of devices this call revoked.
export async function revokeSeatDevicesInTx(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    membershipId: string;
    reason: Extract<SeatDeviceRevokeReason, "membership_inactive" | "seat_inactive">;
    actor?: { userId: string; name: string } | null;
    now?: Date;
  },
): Promise<number> {
  const now = input.now ?? new Date();
  const actor = input.actor ?? null;
  const rows = await tx.seatDeviceAuthorization.findMany({
    where: { workspaceId: input.workspaceId, membershipId: input.membershipId, status: { in: REVOCABLE_STATUSES } },
    select: { id: true, workspaceId: true, userId: true, clientType: true, deviceLabel: true },
  });
  let revoked = 0;
  for (const row of rows) {
    // Matched on the revocable states, not the version read: an UPDATE reads
    // the latest committed row, so a device rotated after the caller's
    // snapshot is still revoked, and one revoked meanwhile is skipped.
    if (!(await revokeWhere(tx, row.id, Prisma.sql`\`status\` IN ('approved', 'active')`, input.reason, now, actor))) continue;
    revoked += 1;
    await auditRevoke(tx, row, input.reason, {}, actor);
  }
  return revoked;
}

// Design §6.4: the extension's first /me pins the device to its audience
// (for example its registration). Written once, never changed: "pinned" on
// the first write, "unchanged" when the same pin is already there,
// "mismatch" when another one is, "not_active" for a device that is not
// active. One UPDATE whose WHERE carries the expected state.
export async function pinSeatDeviceAudienceInTx(
  tx: Prisma.TransactionClient,
  input: { deviceId: string; audiencePin: string; now?: Date },
): Promise<"pinned" | "unchanged" | "mismatch" | "not_active"> {
  if (!input.audiencePin || input.audiencePin.length > AUDIENCE_PIN_MAX_LENGTH) {
    throw new Error("seat device audience pin must be 1-191 characters");
  }
  const now = input.now ?? new Date();
  const changed = await tx.$executeRaw`
    UPDATE \`SeatDeviceAuthorization\`
    SET \`audiencePin\` = ${input.audiencePin}, \`version\` = \`version\` + 1, \`updatedAt\` = ${now}
    WHERE \`id\` = ${input.deviceId} AND \`status\` = 'active' AND \`audiencePin\` IS NULL`;
  if (changed === 1) return "pinned";
  const row = await tx.seatDeviceAuthorization.findUnique({
    where: { id: input.deviceId },
    select: { status: true, audiencePin: true },
  });
  if (!row || row.status !== "active") return "not_active";
  return row.audiencePin === input.audiencePin ? "unchanged" : "mismatch";
}

// ---------------------------------------------------------------------------
// Device channel: read-only access-token classification
// ---------------------------------------------------------------------------

// Codes of the extension's device channel (design §4.7) plus
// workspace_not_enabled, which §4.7 does not list: the extension maps it.
export type SeatDeviceAccessClassification =
  | { ok: true; deviceId: string; workspaceId: string; userId: string; deviceTokenHash: string }
  | { ok: false; code: "token_invalid" | "access_token_expired" | "device_revoked" | "workspace_not_enabled" };

// Design §6.1: run outside the request's transaction and never writes. It
// only says which token this is; the extension re-checks the device row,
// the membership and the password snapshot inside its own transaction
// (§6.2). Status is judged before the token slot: a revoked device fails
// with both its access tokens. A credential past its absolute expiry reads
// access_token_expired (the client refreshes and learns device_expired).
export async function classifySeatDeviceAccessToken(
  accessToken: string,
  now: Date = new Date(),
): Promise<SeatDeviceAccessClassification> {
  if (!SEAT_DEVICE_ACCESS_TOKEN_PATTERN.test(accessToken)) return { ok: false, code: "token_invalid" };
  const tokenHash = hashSeatDeviceToken(accessToken);
  const row = await db.seatDeviceAuthorization.findFirst({
    where: { OR: [{ accessTokenHash: tokenHash }, { previousAccessTokenHash: tokenHash }] },
    select: {
      id: true,
      status: true,
      workspaceId: true,
      userId: true,
      expiresAt: true,
      accessTokenHash: true,
      accessExpiresAt: true,
      previousAccessExpiresAt: true,
    },
  });
  if (!row) return { ok: false, code: "token_invalid" };
  if (row.status === "revoked") return { ok: false, code: "device_revoked" };
  if (row.status !== "active" || !row.workspaceId || !row.userId) return { ok: false, code: "token_invalid" };
  const at = now.getTime();
  const tokenExpiresAt = row.accessTokenHash === tokenHash ? row.accessExpiresAt : row.previousAccessExpiresAt;
  if (!row.expiresAt || row.expiresAt.getTime() <= at || !tokenExpiresAt || tokenExpiresAt.getTime() <= at) {
    return { ok: false, code: "access_token_expired" };
  }
  const workspace = await db.workspace.findUnique({ where: { id: row.workspaceId }, select: { featureFlagsJson: true } });
  if (!workspace || !isSeatDeviceWorkspaceEnabled(workspace.featureFlagsJson)) return { ok: false, code: "workspace_not_enabled" };
  return { ok: true, deviceId: row.id, workspaceId: row.workspaceId, userId: row.userId, deviceTokenHash: tokenHash };
}
