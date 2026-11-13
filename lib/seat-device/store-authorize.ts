import "server-only";

// lib/seat-device/store-authorize.ts
// Seat desktop device authorization (D1), request side: a device asks for
// authorization, a member looks the pairing code up on the website and
// approves or rejects it, and the device polls to claim its tokens (once
// more within 60 seconds if the answer was lost) or cancels its request.
//
// Consistency (design v0.3 §6.2, P2-7): Workspace, Membership, User and
// AuthSession are read OUTSIDE the Serializable transaction (InnoDB turns
// reads inside it into locking reads). Inside it the writes are device rows
// plus AuditLog and Notification rows; those two have foreign keys to
// Workspace and User, so inserting them takes shared locks on the parent
// rows. A transaction holding Workspace FOR UPDATE (the extension's
// Workspace -> device -> Membership -> User order) can therefore block or
// deadlock with these writes. A deadlock is a retried conflict and, once the
// retries run out, a closed error code; the cross-path concurrency test with
// refresh/revoke (1b) and the extension belongs to slice 3a-2.
// Every lifecycle write is a CAS on (id, status, version) after re-reading the
// row in the same transaction.
//
// No plaintext token or pairing code is stored, logged or put in an error or
// audit payload: only sha256 hashes reach the database.

import { ActorType, MembershipStatus, Prisma, WorkspaceStatus, type WorkspaceRole } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { externalScopeOf } from "@/lib/auth/external-member-scope";
import { verifyPassword } from "@/lib/auth/formal-auth";
import { LOGIN_RATE_LIMIT, evaluateLock, hashLoginIdentifier, nextStateOnFailure, type FailureLimit } from "@/lib/auth/login-rate-limit";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import { db } from "@/lib/db";
import { isWriteConflictError } from "@/lib/db/conflict-aware-write";
import {
  SEAT_DEVICE_ACCESS_TOKEN_TTL_SECONDS,
  SEAT_DEVICE_CODE_ENTRY_LOCK_SECONDS,
  SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES,
  SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES_PER_SOURCE_BUCKET,
  SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS,
  SEAT_DEVICE_MAX_ACTIVE_PER_MEMBER,
  SEAT_DEVICE_PAIRING_CODE_MAX_ATTEMPTS,
  SEAT_DEVICE_PENDING_BUCKET_WINDOW_SECONDS,
  SEAT_DEVICE_PENDING_LIMIT_GLOBAL,
  SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET,
  SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET_WINDOW,
  SEAT_DEVICE_POLL_INTERVAL_SECONDS,
  SEAT_DEVICE_REQUEST_TTL_SECONDS,
  SEAT_DEVICE_ROTATION_GRACE_SECONDS,
  SEAT_DEVICE_STEP_UP_MAX_SESSION_AGE_SECONDS,
  effectiveSeatDeviceStatus,
  formatSeatDevicePairingCode,
  generateSeatDevicePairingCode,
  hashSeatDevicePairingCode,
  hashSeatDeviceToken,
  isSeatDeviceAuthDeploymentEnabled,
  isSeatDeviceWorkspaceEnabled,
  mintSeatDeviceToken,
  seatDeviceCredentialExpiresAt,
  seatDeviceHashesEqual,
  seatDeviceIdentity,
  seatDeviceSourceBucket,
  seatDeviceUnclaimedPollStatus,
  type SeatDeviceCancelStatus,
  type SeatDeviceClientType,
  type SeatDeviceErrorCode,
  type SeatDeviceIdentity,
} from "@/lib/seat-device/contract";

const TX = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;
// Concurrent writers on the counted index ranges deadlock under Serializable
// and InnoDB rolls one back. Retries back off exponentially with full jitter
// so they spread out instead of colliding again in lockstep.
const RETRY_ATTEMPTS = 8;
const RETRY_BASE_DELAY_MS = 20;
const RETRY_MAX_DELAY_MS = 320;
const CONTENDED_RETRY_AFTER_SECONDS = 1;
const TARGET_TYPE = "SeatDeviceAuthorization";
const SOURCE_PAGE = "/device";

export class SeatDeviceAuthError extends Error {
  readonly code: SeatDeviceErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: SeatDeviceErrorCode, retryAfterSeconds: number | null = null) {
    super(`seat device authorization: ${code}`);
    this.name = "SeatDeviceAuthError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Deployment switch off: callers answer 404, as if the feature did not exist.
export class SeatDeviceAuthDisabledError extends Error {
  constructor() {
    super("seat device authorization is disabled");
    this.name = "SeatDeviceAuthDisabledError";
  }
}

export function assertDeploymentEnabled() {
  if (!isSeatDeviceAuthDeploymentEnabled()) throw new SeatDeviceAuthDisabledError();
}

function secondsUntil(at: Date, now: Date) {
  return Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 1000));
}

// Prisma P2024: no pooled connection in time; P2028: the interactive
// transaction could not start or ran out of time. Both mean contention.
function isContentionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2024" || error.code === "P2028");
}

// Runs `transaction` (a Serializable `db.$transaction`, written at the call
// site so the CAS guard can see its isolation) and retries write conflicts. A
// conflict that outlasts the retries, or contention for a connection, never
// leaves as a raw database error: it becomes `exhausted`, a closed code with a
// Retry-After, so callers answer it like any other refusal.
export async function retried<T>(
  transaction: () => Promise<T>,
  exhausted: SeatDeviceErrorCode,
  isConflict: (error: unknown) => boolean = isWriteConflictError,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await transaction();
    } catch (error) {
      const conflict = isConflict(error);
      if (conflict && attempt < RETRY_ATTEMPTS) {
        const ceiling = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling));
        continue;
      }
      if (conflict || isContentionError(error)) throw new SeatDeviceAuthError(exhausted, CONTENDED_RETRY_AFTER_SECONDS);
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown, field?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  return field === undefined || String(error.meta?.target ?? "").includes(field);
}

// ---------------------------------------------------------------------------
// Device: request authorization
// ---------------------------------------------------------------------------

export type SeatDeviceAuthorizationGrant = {
  requestId: string;
  pollToken: string;
  pairingCode: string;
  expiresInSeconds: number;
  intervalSeconds: number;
};

// `source` is the trusted client address (resolveSeatDeviceTrustedSource) or
// null when the deployment cannot vouch for one; only then is it stored.
export async function requestSeatDeviceAuthorization(input: {
  deviceLabel: string;
  clientType: SeatDeviceClientType;
  clientVersion: string;
  source: string | null;
  now?: Date;
  generatePairingCode?: () => string;
}): Promise<SeatDeviceAuthorizationGrant> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const bucket = input.source ? seatDeviceSourceBucket(input.source) : null;
  const generate = input.generatePairingCode ?? generateSeatDevicePairingCode;

  // "expired" is derived from the clock and has no write of its own: clear
  // the code hash (and source) of lapsed pending rows here, so a pairing hash
  // does not outlive its request and the unique space is freed. Idempotent.
  await retried(async () => {
    await db.seatDeviceAuthorization.updateMany({
      where: { status: "pending", requestExpiresAt: { lte: now }, pairingCodeHash: { not: null } },
      data: { pairingCodeHash: null, sourceIp: null },
    });
  }, "rate_limited");

  for (let attempt = 1; attempt <= SEAT_DEVICE_PAIRING_CODE_MAX_ATTEMPTS; attempt += 1) {
    const pairingCode = generate();
    const pairingCodeHash = hashSeatDevicePairingCode(pairingCode);
    if (pairingCodeHash === null) throw new Error("seat device pairing code generator produced an invalid code");
    const poll = mintSeatDeviceToken("poll");
    try {
      const requestId = await retried(() => db.$transaction(async (tx) => {
        await assertPendingCapacity(tx, bucket, now);
        const row = await tx.seatDeviceAuthorization.create({
          data: {
            clientType: input.clientType,
            deviceLabel: input.deviceLabel,
            clientVersion: input.clientVersion,
            status: "pending",
            pollTokenHash: poll.tokenHash,
            pairingCodeHash,
            sourceIp: bucket ? input.source : null,
            sourceBucket: bucket,
            requestedAt: now,
            requestExpiresAt: new Date(now.getTime() + SEAT_DEVICE_REQUEST_TTL_SECONDS * 1000),
            pollIntervalSec: SEAT_DEVICE_POLL_INTERVAL_SECONDS,
          },
          select: { id: true },
        });
        return row.id;
      }, TX), "rate_limited");
      return {
        requestId,
        pollToken: poll.token,
        pairingCode: formatSeatDevicePairingCode(pairingCode),
        expiresInSeconds: SEAT_DEVICE_REQUEST_TTL_SECONDS,
        intervalSeconds: SEAT_DEVICE_POLL_INTERVAL_SECONDS,
      };
    } catch (error) {
      if (!isUniqueViolation(error, "pairingCodeHash")) throw error;
    }
  }
  throw new SeatDeviceAuthError("temporarily_unavailable");
}

// Counted inside the Serializable transaction so concurrent requests cannot
// each see room. Only live pending rows count toward the caps (a lapsed row
// must not hold capacity forever); the per-bucket window counts every request
// made in it, so cancel-and-retry does not reset it. The global cap always
// applies; the bucket limits need a trusted source.
async function assertPendingCapacity(tx: Prisma.TransactionClient, bucket: string | null, now: Date) {
  const live = { status: "pending", requestExpiresAt: { gt: now } };
  if ((await tx.seatDeviceAuthorization.count({ where: live })) >= SEAT_DEVICE_PENDING_LIMIT_GLOBAL) {
    throw new SeatDeviceAuthError("rate_limited", await secondsUntilFirstPendingLapses(tx, live, now));
  }
  if (!bucket) return;
  const windowStart = new Date(now.getTime() - SEAT_DEVICE_PENDING_BUCKET_WINDOW_SECONDS * 1000);
  const inWindow = { sourceBucket: bucket, requestedAt: { gt: windowStart } };
  if ((await tx.seatDeviceAuthorization.count({ where: inWindow })) >= SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET_WINDOW) {
    const oldest = await tx.seatDeviceAuthorization.findFirst({
      where: inWindow,
      orderBy: { requestedAt: "asc" },
      select: { requestedAt: true },
    });
    const reopensAt = new Date((oldest?.requestedAt ?? now).getTime() + SEAT_DEVICE_PENDING_BUCKET_WINDOW_SECONDS * 1000);
    throw new SeatDeviceAuthError("rate_limited", secondsUntil(reopensAt, now));
  }
  const liveInBucket = { ...live, sourceBucket: bucket };
  if ((await tx.seatDeviceAuthorization.count({ where: liveInBucket })) >= SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET) {
    throw new SeatDeviceAuthError("rate_limited", await secondsUntilFirstPendingLapses(tx, liveInBucket, now));
  }
}

async function secondsUntilFirstPendingLapses(
  tx: Prisma.TransactionClient,
  where: Prisma.SeatDeviceAuthorizationWhereInput,
  now: Date,
) {
  const first = await tx.seatDeviceAuthorization.findFirst({
    where,
    orderBy: { requestExpiresAt: "asc" },
    select: { requestExpiresAt: true },
  });
  return secondsUntil(first?.requestExpiresAt ?? now, now);
}

// ---------------------------------------------------------------------------
// Device: cancel
// ---------------------------------------------------------------------------

// Design v0.3.1 §15.1 / v0.3.2 §15.6: a pending or approved-but-unclaimed
// request becomes cancelled; a claimed device whose pair was never used is
// revoked (client_cancelled) and also reads "cancelled"; a used one reads
// "claimed". A wrong poll token reads "expired" so the call never says whether
// a request exists.
export async function cancelSeatDeviceAuthorization(input: {
  requestId: string;
  pollToken: string;
  now?: Date;
}): Promise<{ status: SeatDeviceCancelStatus }> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const pollTokenHash = hashSeatDeviceToken(input.pollToken);
  return retried(() => db.$transaction(async (tx): Promise<{ status: SeatDeviceCancelStatus }> => {
    const row = await tx.seatDeviceAuthorization.findUnique({ where: { id: input.requestId } });
    if (!row || !seatDeviceHashesEqual(row.pollTokenHash, pollTokenHash)) return { status: "expired" as const };
    const status = effectiveSeatDeviceStatus(row, now);
    const cas = { id: row.id, status: row.status, version: row.version };
    if (status === "pending" || status === "approved") {
      const result = await tx.seatDeviceAuthorization.updateMany({
        where: { ...cas, requestExpiresAt: { gt: now } },
        data: { status: "cancelled", pairingCodeHash: null, sourceIp: null, version: { increment: 1 } },
      });
      if (result.count !== 1) casLost();
      // A pending request has no workspace yet, so there is no audit stream to
      // write to; an approved one is audited in its workspace.
      if (row.workspaceId) {
        await auditDevice(tx, row, "SEAT_DEVICE_AUTHORIZATION_CANCELLED", `坐席客户端取消设备授权：${row.deviceLabel}`, {
          reason: "client_cancelled",
          previousStatus: status,
        });
      }
      return { status: "cancelled" as const };
    }
    // A claimed device whose pair was never used is revoked here (design
    // v0.3.2 §15.6, no time limit); a used one is left alone and the client
    // revokes it with its refresh token. See claimSeatDeviceAuthorization for
    // what "never used" can and cannot mean here.
    if (status === "active") {
      if (row.refreshTokenUsed || row.rotatedAt) return { status: "claimed" as const };
      const result = await tx.seatDeviceAuthorization.updateMany({
        where: { ...cas, refreshTokenUsed: false, rotatedAt: null, expiresAt: { gt: now } },
        data: { status: "revoked", revokedAt: now, revokeReason: "client_cancelled", sourceIp: null, version: { increment: 1 } },
      });
      if (result.count !== 1) casLost();
      await auditDevice(tx, row, "SEAT_DEVICE_REVOKED", `坐席客户端取消并撤销未使用的设备：${row.deviceLabel}`, {
        reason: "client_cancelled",
        refreshTokenPresented: false,
      });
      return { status: "cancelled" as const };
    }
    if (status === "expired") {
      await clearLapsedPairingCode(tx, row);
      return { status: "expired" as const };
    }
    if (status === "cancelled" || status === "rejected" || status === "revoked") return { status };
    return { status: "expired" as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), "temporarily_unavailable");
}

// A CAS that loses after the row was re-read in the same transaction means a
// concurrent writer slipped in; the message matches isWriteConflictError, so
// it is retried like any other conflict.
export function casLost(): never {
  throw new Error("seat device write conflict");
}

async function clearLapsedPairingCode(
  tx: Prisma.TransactionClient,
  row: { id: string; status: string; pairingCodeHash: string | null },
) {
  if (row.pairingCodeHash === null) return;
  await tx.seatDeviceAuthorization.updateMany({
    where: { id: row.id, status: row.status, pairingCodeHash: row.pairingCodeHash },
    data: { pairingCodeHash: null, sourceIp: null },
  });
}

export async function auditDevice(
  tx: Prisma.TransactionClient,
  row: { id: string; workspaceId: string | null; userId: string | null; clientType: string },
  actionType: string,
  summary: string,
  payload: Record<string, unknown>,
  actor: { userId: string; name: string } | null = null,
) {
  if (!row.workspaceId) return;
  await writeAuditLog(
    {
      workspaceId: row.workspaceId,
      userId: actor?.userId ?? row.userId,
      actor: actor?.name ?? "seat_desktop",
      actorType: ActorType.USER,
      actionType,
      targetType: TARGET_TYPE,
      targetId: row.id,
      summary,
      payload: { deviceId: row.id, clientType: row.clientType, ...payload },
      sourcePage: SOURCE_PAGE,
    },
    { client: tx },
  );
}

// ---------------------------------------------------------------------------
// Device: claim (poll), one re-claim
// ---------------------------------------------------------------------------

export type SeatDeviceClaimAnswer =
  | { status: "pending" | "rejected" | "expired" }
  | {
      status: "approved";
      accessToken: string;
      refreshToken: string;
      expiresInSeconds: number;
      refreshExpiresInSeconds: number;
      deviceId: string;
      identity: SeatDeviceIdentity;
    };

// The bound member must still be the one approved: same ACTIVE, internal
// membership and unchanged password; then the workspace must still be ACTIVE
// with its flag on (review of #551: a flag switched off after approval no
// longer hands out a pair). Read outside the transaction (P2-7).
async function loadClaimIdentity(row: {
  workspaceId: string | null;
  userId: string | null;
  membershipId: string | null;
  userPasswordSetAt: Date | null;
}): Promise<SeatDeviceIdentity | "workspace_not_enabled" | null> {
  if (!row.workspaceId || !row.userId) return null;
  const [workspace, membership, user] = await Promise.all([
    db.workspace.findUnique({ where: { id: row.workspaceId }, select: { id: true, name: true, status: true, featureFlagsJson: true } }),
    db.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: row.workspaceId, userId: row.userId } },
      select: { id: true, role: true, status: true, accessScope: true },
    }),
    db.user.findUnique({ where: { id: row.userId }, select: { name: true, passwordSetAt: true } }),
  ]);
  if (
    !workspace ||
    !membership ||
    !user ||
    membership.id !== row.membershipId ||
    membership.status !== MembershipStatus.ACTIVE ||
    externalScopeOf(membership) !== null ||
    (user.passwordSetAt?.getTime() ?? null) !== (row.userPasswordSetAt?.getTime() ?? null)
  ) {
    return null;
  }
  if (workspace.status !== WorkspaceStatus.ACTIVE || !isSeatDeviceWorkspaceEnabled(workspace.featureFlagsJson)) {
    return "workspace_not_enabled";
  }
  return seatDeviceIdentity({ userId: row.userId, displayName: user.name, workspace: { id: workspace.id, name: workspace.name }, role: membership.role });
}

// "The pair was never used" is read from two columns this slice never sets:
// rotatedAt (any refresh rotation) and refreshTokenUsed (the current pair was
// used). Until their writers land, the server only knows that the refresh
// token was never presented; it does not know whether an access token was
// accepted. Writer obligations: 1b sets rotatedAt on every rotation and
// refreshTokenUsed when a refresh token is presented; 3a sets
// refreshTokenUsed when the device channel first accepts an access token.
// A claim and a re-claim always hand out an unused pair. rotationSource
// records the trusted source the current pair was issued to; a re-claim must
// come from that same source.
export async function claimSeatDeviceAuthorization(input: {
  requestId: string;
  pollToken: string;
  source: string | null;
  now?: Date;
}): Promise<SeatDeviceClaimAnswer> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const pollTokenHash = hashSeatDeviceToken(input.pollToken);
  const peek = await db.seatDeviceAuthorization.findUnique({ where: { id: input.requestId } });
  if (!peek || !seatDeviceHashesEqual(peek.pollTokenHash, pollTokenHash)) throw new SeatDeviceAuthError("poll_token_invalid");
  const bindsTokens = peek.status === "approved" || peek.status === "active";
  const identity = bindsTokens ? await loadClaimIdentity(peek) : null;
  const access = mintSeatDeviceToken("access");
  const refresh = mintSeatDeviceToken("refresh");

  return retried(() => db.$transaction(async (tx): Promise<SeatDeviceClaimAnswer> => {
    const row = await tx.seatDeviceAuthorization.findUnique({ where: { id: input.requestId } });
    if (!row || !seatDeviceHashesEqual(row.pollTokenHash, pollTokenHash)) throw new SeatDeviceAuthError("poll_token_invalid");
    if (row.lastPolledAt) {
      const nextAt = new Date(row.lastPolledAt.getTime() + row.pollIntervalSec * 1000);
      if (nextAt > now) throw new SeatDeviceAuthError("slow_down", secondsUntil(nextAt, now));
    }
    const status = effectiveSeatDeviceStatus(row, now);
    const cas = { id: row.id, status: row.status, version: row.version };
    const unclaimed = seatDeviceUnclaimedPollStatus(status);
    // Bound to a row read before the transaction: if it changed status in
    // between, answer "pending" and let the next poll pick it up.
    const stale = row.status !== peek.status || row.userId !== peek.userId;
    if (unclaimed || stale) {
      await tx.seatDeviceAuthorization.update({
        where: { id: row.id },
        data: status === "expired" && row.pairingCodeHash
          ? { lastPolledAt: now, pairingCodeHash: null, sourceIp: null }
          : { lastPolledAt: now },
      });
      return { status: unclaimed ?? "pending" };
    }
    if (status !== "approved" && status !== "active") throw new SeatDeviceAuthError("poll_token_invalid");
    const reclaim = status === "active";
    if (
      reclaim &&
      (row.reclaimed ||
        row.refreshTokenUsed ||
        row.rotatedAt ||
        !row.claimedAt ||
        now.getTime() - row.claimedAt.getTime() > SEAT_DEVICE_ROTATION_GRACE_SECONDS * 1000 ||
        !input.source ||
        row.rotationSource !== input.source)
    ) {
      throw new SeatDeviceAuthError("poll_token_invalid");
    }
    // Design §4.2: every other claim refusal is poll_token_invalid, including
    // a member who changed since approval.
    if (!identity) throw new SeatDeviceAuthError("poll_token_invalid");
    // Switched off is not revoked (design §15.2): the request stays claimable.
    if (identity === "workspace_not_enabled") throw new SeatDeviceAuthError("workspace_not_enabled");
    const pair = {
      accessTokenHash: access.tokenHash,
      accessExpiresAt: new Date(now.getTime() + SEAT_DEVICE_ACCESS_TOKEN_TTL_SECONDS * 1000),
      refreshTokenHash: refresh.tokenHash,
      refreshTokenUsed: false,
      rotationSource: input.source,
      lastPolledAt: now,
      version: { increment: 1 },
    };
    const result = reclaim
      ? await tx.seatDeviceAuthorization.updateMany({
          where: { ...cas, reclaimed: false, refreshTokenUsed: false, rotatedAt: null },
          data: { ...pair, reclaimed: true },
        })
      : await tx.seatDeviceAuthorization.updateMany({
          where: { ...cas, requestExpiresAt: { gt: now } },
          data: { ...pair, status: "active", issuedAt: now, claimedAt: now, lastIp: input.source },
        });
    if (result.count !== 1) casLost();
    if (reclaim && row.accessTokenHash && row.refreshTokenHash) {
      // The first pair is retired for good: presenting it later is reuse.
      await tx.seatDeviceTokenHistory.createMany({
        data: [
          { deviceId: row.id, kind: "refresh", tokenHash: row.refreshTokenHash, retiredAt: now },
          { deviceId: row.id, kind: "access", tokenHash: row.accessTokenHash, retiredAt: now },
        ],
      });
    }
    await auditDevice(
      tx,
      row,
      reclaim ? "SEAT_DEVICE_RECLAIMED" : "SEAT_DEVICE_CLAIMED",
      `${reclaim ? "坐席客户端重领设备凭据" : "坐席客户端领取设备凭据"}：${row.deviceLabel}`,
      { tokenStoredAsHashOnly: true, sourceTrusted: input.source !== null },
    );
    return {
      status: "approved" as const,
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresInSeconds: SEAT_DEVICE_ACCESS_TOKEN_TTL_SECONDS,
      refreshExpiresInSeconds: Math.max(0, Math.floor(((row.expiresAt ?? now).getTime() - now.getTime()) / 1000)),
      deviceId: row.id,
      identity,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), "slow_down");
}

// ---------------------------------------------------------------------------
// Website: pairing-code entry (lookup, approve, reject)
// ---------------------------------------------------------------------------

export type MemberContext = {
  authSessionId: string;
  providerType: string | null;
  userId: string;
  userName: string;
  passwordSetAt: Date | null;
  workspace: { id: string; name: string; enabled: boolean };
  membershipId: string;
  role: WorkspaceRole;
};

// Re-reads the session row itself instead of trusting the caller's view of
// it: usable, owned by the user, seated on a workspace where the user is an
// ACTIVE, non-external member. The workspace bound later is this one.
export async function loadMemberContext(authSessionId: string, userId: string, now: Date): Promise<MemberContext> {
  const session = await db.authSession.findUnique({
    where: { id: authSessionId },
    select: { userId: true, activeWorkspaceId: true, providerType: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.userId !== userId || session.revokedAt || session.expiresAt <= now || !session.activeWorkspaceId) {
    throw new SeatDeviceAuthError("reauthentication_required");
  }
  const workspaceId = session.activeWorkspaceId;
  const [workspace, membership, user] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, featureFlagsJson: true } }),
    db.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true, role: true, status: true, accessScope: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, passwordSetAt: true } }),
  ]);
  if (!workspace || !membership || !user || membership.status !== MembershipStatus.ACTIVE || externalScopeOf(membership) !== null) {
    throw new SeatDeviceAuthError("forbidden");
  }
  return {
    authSessionId,
    providerType: session.providerType,
    userId,
    userName: user.name,
    passwordSetAt: user.passwordSetAt,
    workspace: { id: workspace.id, name: workspace.name, enabled: isSeatDeviceWorkspaceEnabled(workspace.featureFlagsJson) },
    membershipId: membership.id,
    role: membership.role,
  };
}

// Code entry is limited per account (8 failures in 15 minutes) and, with a
// trusted source, per address bucket (30 in 15 minutes: an office shares one
// bucket), in FailedLoginAttempt; either lock lasts 15 minutes. The
// lock check, the look at the code and the failure count run in ONE
// Serializable transaction: the counter rows read by the check stay locked
// until the count is written, so concurrent wrong codes cannot all pass the
// check before any of them is counted, and a right guess during a lock is
// not confirmed. A success never clears the count: anyone can mint a valid
// code of their own, so clearing would let them reset it.
const codeEntryLimit = (maxAttempts: number) => ({
  windowMs: SEAT_DEVICE_CODE_ENTRY_WINDOW_SECONDS * 1000,
  maxAttempts,
  lockMs: SEAT_DEVICE_CODE_ENTRY_LOCK_SECONDS * 1000,
});
const ACCOUNT_CODE_ENTRY_LIMIT = codeEntryLimit(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES);
const BUCKET_CODE_ENTRY_LIMIT = codeEntryLimit(SEAT_DEVICE_CODE_ENTRY_MAX_FAILURES_PER_SOURCE_BUCKET);

type CodeEntryKey = { identifierHash: string; limit: FailureLimit };

function codeEntryKeys(userId: string, source: string | null): CodeEntryKey[] {
  const bucket = source ? seatDeviceSourceBucket(source) : null;
  const keys = [{ identifierHash: hashLoginIdentifier(`seat-device-code:user:${userId}`), limit: ACCOUNT_CODE_ENTRY_LIMIT }];
  if (bucket) keys.push({ identifierHash: hashLoginIdentifier(`seat-device-code:ip:${bucket}`), limit: BUCKET_CODE_ENTRY_LIMIT });
  return keys;
}

type CodeEntryCounter = { identifierHash: string; attemptCount: number; windowStartedAt: Date; lockedUntil: Date | null };

async function openCodeEntryInTx(tx: Prisma.TransactionClient, keys: CodeEntryKey[], now: Date) {
  const counters: CodeEntryCounter[] = await tx.failedLoginAttempt.findMany({
    where: { identifierHash: { in: keys.map((key) => key.identifierHash) } },
    select: { identifierHash: true, attemptCount: true, windowStartedAt: true, lockedUntil: true },
  });
  const retryAfterMs = Math.max(0, ...counters.map((counter) => evaluateLock(counter, now).retryAfterMs));
  if (retryAfterMs > 0) throw new SeatDeviceAuthError("rate_limited", Math.ceil(retryAfterMs / 1000));
  return counters;
}

// Committed with the transaction that found the code wrong; the caller
// answers pairing_code_invalid only after that commit.
async function countCodeEntryFailureInTx(tx: Prisma.TransactionClient, keys: CodeEntryKey[], counters: CodeEntryCounter[], now: Date) {
  for (const { identifierHash, limit } of keys) {
    const next = nextStateOnFailure(counters.find((counter) => counter.identifierHash === identifierHash) ?? null, now, limit);
    await tx.failedLoginAttempt.upsert({
      where: { identifierHash },
      create: { identifierHash, ...next },
      update: next,
      select: { id: true },
    });
  }
}

// Two first failures racing to create the same counter row: retried.
const isCodeEntryConflict = (error: unknown) => isWriteConflictError(error) || isUniqueViolation(error, "identifierHash");

export type SeatDeviceLookup = {
  requestId: string;
  deviceName: string;
  clientVersion: string | null;
  clientReported: ["deviceName", "clientVersion"];
  requestedAt: string;
  source: string | null;
  expiresInSeconds: number;
  workspace: { id: string; name: string };
};

// `pairingCode` is the normalized code (SEAT_DEVICE_LOOKUP_REQUEST_SCHEMA).
export async function lookupSeatDeviceAuthorization(input: {
  authSessionId: string;
  userId: string;
  pairingCode: string;
  source: string | null;
  now?: Date;
}): Promise<SeatDeviceLookup> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const member = await loadMemberContext(input.authSessionId, input.userId, now);
  if (!member.workspace.enabled) throw new SeatDeviceAuthError("workspace_not_enabled");
  const keys = codeEntryKeys(input.userId, input.source);
  const pairingCodeHash = hashSeatDevicePairingCode(input.pairingCode);
  const row = await retried(() => db.$transaction(async (tx) => {
    const counters = await openCodeEntryInTx(tx, keys, now);
    const found = pairingCodeHash ? await tx.seatDeviceAuthorization.findUnique({ where: { pairingCodeHash } }) : null;
    if (found && effectiveSeatDeviceStatus(found, now) === "pending") return found;
    if (found) await clearLapsedPairingCode(tx, found);
    await countCodeEntryFailureInTx(tx, keys, counters, now);
    return null;
  }, TX), "rate_limited", isCodeEntryConflict);
  if (!row) throw new SeatDeviceAuthError("pairing_code_invalid");
  return {
    requestId: row.id,
    deviceName: row.deviceLabel,
    clientVersion: row.clientVersion,
    clientReported: ["deviceName", "clientVersion"],
    requestedAt: row.requestedAt.toISOString(),
    source: row.sourceIp,
    expiresInSeconds: Math.max(0, Math.floor((row.requestExpiresAt.getTime() - now.getTime()) / 1000)),
    workspace: { id: member.workspace.id, name: member.workspace.name },
  };
}

// Step-up (design §4.3, server design §2C.3): rotating a session creates a
// fresh AuthSession row without asking for the password, so neither a session
// nor its age proves the member just typed it. Approval needs this proof
// instead. Only verifySeatDeviceApprovalPassword issues one, after the
// password matched; its facts live in a module-private WeakMap, so an object
// cast to the type, or a bare time, is no proof.
declare const passwordProofBrand: unique symbol;
export type SeatDevicePasswordProof = { readonly [passwordProofBrand]: true };
type PasswordProofFacts = { userId: string; passwordSetAt: number | null; verifiedAt: number };
const issuedPasswordProofs = new WeakMap<object, PasswordProofFacts>();

// A wrong password counts as a failed password login of the account: the
// login counter keyed by the account email, with the login limit (8 in 15
// minutes, locked 15 minutes). While that counter is locked a right password
// is refused too, and no scrypt is spent on it: the lock is read first. The
// authoritative lock check and the count run in one Serializable transaction,
// like code entry. Callers check the session first
// (assertSeatDeviceApprovalPreconditions), so a request that cannot approve
// anyway never becomes a password oracle or spends login attempts.
export async function verifySeatDeviceApprovalPassword(input: {
  userId: string;
  password: string;
  now?: Date;
}): Promise<SeatDevicePasswordProof> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, passwordHash: true, passwordSetAt: true } });
  if (!user) throw new SeatDeviceAuthError("reauthentication_required");
  const keys = [{ identifierHash: hashLoginIdentifier(user.email), limit: LOGIN_RATE_LIMIT }];
  const counter = await db.failedLoginAttempt.findUnique({ where: { identifierHash: keys[0].identifierHash }, select: { lockedUntil: true } });
  const lock = evaluateLock(counter, now);
  if (lock.locked) throw new SeatDeviceAuthError("rate_limited", Math.ceil(lock.retryAfterMs / 1000));
  const matched = verifyPassword(input.password, user.passwordHash);
  const accepted = await retried(() => db.$transaction(async (tx) => {
    const counters = await openCodeEntryInTx(tx, keys, now);
    if (matched) return true;
    await countCodeEntryFailureInTx(tx, keys, counters, now);
    return false;
  }, TX), "rate_limited", isCodeEntryConflict);
  if (!accepted) throw new SeatDeviceAuthError("password_invalid");
  const proof = Object.freeze({}) as SeatDevicePasswordProof;
  issuedPasswordProofs.set(proof, { userId: input.userId, passwordSetAt: user.passwordSetAt?.getTime() ?? null, verifiedAt: now.getTime() });
  return proof;
}

type Decision = "approve" | "reject";

// Approval needs both switches, a PASSWORD session and the session still on
// the workspace the page showed (lookup answers its id, approve sends it
// back): a workspace switch in between must not bind the device elsewhere.
function approvalRefusal(member: MemberContext, expectedWorkspaceId: string | null): SeatDeviceErrorCode | null {
  if (!member.workspace.enabled) return "workspace_not_enabled";
  if (member.providerType !== AUTH_SESSION_PROVIDER_TYPES.PASSWORD) return "reauthentication_required";
  return member.workspace.id === expectedWorkspaceId ? null : "workspace_mismatch";
}

export async function assertSeatDeviceApprovalPreconditions(input: {
  authSessionId: string;
  userId: string;
  expectedWorkspaceId: string;
  now?: Date;
}): Promise<void> {
  assertDeploymentEnabled();
  const member = await loadMemberContext(input.authSessionId, input.userId, input.now ?? new Date());
  const refusal = approvalRefusal(member, input.expectedWorkspaceId);
  if (refusal) throw new SeatDeviceAuthError(refusal);
}

// Approve binds the request to the member, the session's workspace and the
// password snapshot; it needs both switches, a PASSWORD session, a password
// proof of this member (same password) at most 10 minutes old and room under
// the device cap. Reject needs a usable member session only (no step-up), so a phishing
// request can be turned down from any session. Both go through the code-entry
// lock: while the account or its address bucket is locked, reject waits out
// the lock like approve (the request lapses in 10 minutes regardless).
// The session's age plays no part: only the password proof does.
export async function decideSeatDeviceAuthorization(input: {
  authSessionId: string;
  userId: string;
  requestId: string;
  pairingCode: string;
  decision: Decision;
  passwordProof: SeatDevicePasswordProof | null;
  // Approve only: the workspace id the page showed (lookup answer).
  expectedWorkspaceId: string | null;
  source: string | null;
  now?: Date;
}): Promise<{ requestId: string; status: "approved" | "rejected" }> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const member = await loadMemberContext(input.authSessionId, input.userId, now);
  if (input.decision === "approve") {
    const refusal = approvalRefusal(member, input.expectedWorkspaceId);
    if (refusal) throw new SeatDeviceAuthError(refusal);
    const proof = input.passwordProof ? issuedPasswordProofs.get(input.passwordProof) : undefined;
    const proofAgeMs = proof ? now.getTime() - proof.verifiedAt : Number.NaN;
    if (
      proof?.userId !== member.userId ||
      proof.passwordSetAt !== (member.passwordSetAt?.getTime() ?? null) ||
      !(proofAgeMs >= 0 && proofAgeMs <= SEAT_DEVICE_STEP_UP_MAX_SESSION_AGE_SECONDS * 1000)
    ) {
      throw new SeatDeviceAuthError("reauthentication_required");
    }
  }
  const keys = codeEntryKeys(input.userId, input.source);
  const pairingCodeHash = hashSeatDevicePairingCode(input.pairingCode);

  const outcome = await retried(() => db.$transaction(async (tx) => {
    const counters = await openCodeEntryInTx(tx, keys, now);
    const row = await tx.seatDeviceAuthorization.findUnique({ where: { id: input.requestId } });
    if (
      !row ||
      !pairingCodeHash ||
      !seatDeviceHashesEqual(row.pairingCodeHash, pairingCodeHash) ||
      effectiveSeatDeviceStatus(row, now) !== "pending"
    ) {
      await countCodeEntryFailureInTx(tx, keys, counters, now);
      return "code_invalid" as const;
    }
    if (input.decision === "approve") await assertDeviceCap(tx, member, now);
    const cas = { id: row.id, status: "pending", version: row.version, pairingCodeHash, requestExpiresAt: { gt: now } };
    const decided = { decidedByUserId: member.userId, decidedAt: now, pairingCodeHash: null, version: { increment: 1 } };
    const result = await tx.seatDeviceAuthorization.updateMany({
      where: cas,
      data:
        input.decision === "approve"
          ? {
              ...decided,
              status: "approved",
              workspaceId: member.workspace.id,
              userId: member.userId,
              membershipId: member.membershipId,
              userPasswordSetAt: member.passwordSetAt,
              approvalSource: input.source,
              approvedAuthSessionId: member.authSessionId,
              expiresAt: seatDeviceCredentialExpiresAt(now),
            }
          : { ...decided, status: "rejected", workspaceId: member.workspace.id, sourceIp: null },
    });
    if (result.count !== 1) casLost();
    const bound = { ...row, workspaceId: member.workspace.id, userId: input.decision === "approve" ? member.userId : null };
    const actor = { userId: member.userId, name: member.userName };
    if (input.decision === "reject") {
      await auditDevice(tx, bound, "SEAT_DEVICE_AUTHORIZATION_REJECTED", `拒绝设备授权：${row.deviceLabel}`, {}, actor);
      return "rejected" as const;
    }
    await auditDevice(tx, bound, "SEAT_DEVICE_AUTHORIZATION_APPROVED", `授权设备登录：${row.deviceLabel}`, {
      clientVersion: row.clientVersion,
      approvalSourceTrusted: input.source !== null,
    }, actor);
    await tx.notification.create({
      data: {
        workspaceId: member.workspace.id,
        userId: member.userId,
        type: "SYSTEM",
        title: "新设备已获授权登录坐席客户端",
        body: `设备「${row.deviceLabel}」（客户端自报）于 ${now.toISOString()} 获得授权，来源：${input.source ?? "未知"}。如果不是你本人操作，请立即在设备列表中撤销。`,
      },
    });
    return "approved" as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), "rate_limited", isCodeEntryConflict);
  if (outcome === "code_invalid") throw new SeatDeviceAuthError("pairing_code_invalid");
  return { requestId: input.requestId, status: outcome };
}

// Approved-but-unclaimed requests count: each becomes a device on claim.
async function assertDeviceCap(tx: Prisma.TransactionClient, member: MemberContext, now: Date) {
  const rows = await tx.seatDeviceAuthorization.findMany({
    where: { workspaceId: member.workspace.id, userId: member.userId, status: { in: ["approved", "active"] } },
    select: { status: true, requestExpiresAt: true, expiresAt: true },
  });
  const live = rows.filter((row) => {
    const status = effectiveSeatDeviceStatus(row, now);
    return status === "approved" || status === "active";
  });
  if (live.length >= SEAT_DEVICE_MAX_ACTIVE_PER_MEMBER) throw new SeatDeviceAuthError("too_many_devices");
}
