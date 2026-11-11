import "server-only";

// lib/seat-device/store-authorize.ts
// Seat desktop device authorization (D1), request side: a device asks for
// authorization, a member looks the pairing code up on the website and
// approves or rejects it, and the device polls to claim its tokens (once
// more within 60 seconds if the answer was lost) or cancels its request.
//
// Consistency (design v0.3 §6.2, P2-7): Workspace, Membership, User and
// AuthSession are read OUTSIDE the Serializable transaction (InnoDB turns
// reads inside it into locking reads); inside it only device rows, audit and
// notification rows are touched, so these writes never lock in an order that
// could cycle with the extension's Workspace -> device -> Membership -> User.
// Every lifecycle write is a CAS on (id, status, version) after re-reading the
// row in the same transaction; a serialization failure is retried.
//
// No plaintext token or pairing code is stored, logged or put in an error or
// audit payload: only sha256 hashes reach the database.

import { ActorType, MembershipStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { externalScopeOf } from "@/lib/auth/external-member-scope";
import { evaluateLock, hashLoginIdentifier, nextStateOnFailure } from "@/lib/auth/login-rate-limit";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";
import { db } from "@/lib/db";
import { isWriteConflictError, runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  SEAT_DEVICE_ACCESS_TOKEN_TTL_SECONDS,
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
const RETRY = { maxAttempts: 8, retryDelayMs: 50 } as const;
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

function assertDeploymentEnabled() {
  if (!isSeatDeviceAuthDeploymentEnabled()) throw new SeatDeviceAuthDisabledError();
}

function secondsUntil(at: Date, now: Date) {
  return Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 1000));
}

function retried<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, isConflict = isWriteConflictError) {
  return runWithWriteConflictRetry(() => db.$transaction(fn, TX), { ...RETRY, isConflict });
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
  await db.seatDeviceAuthorization.updateMany({
    where: { status: "pending", requestExpiresAt: { lte: now }, pairingCodeHash: { not: null } },
    data: { pairingCodeHash: null, sourceIp: null },
  });

  for (let attempt = 1; attempt <= SEAT_DEVICE_PAIRING_CODE_MAX_ATTEMPTS; attempt += 1) {
    const pairingCode = generate();
    const pairingCodeHash = hashSeatDevicePairingCode(pairingCode);
    if (pairingCodeHash === null) throw new Error("seat device pairing code generator produced an invalid code");
    const poll = mintSeatDeviceToken("poll");
    try {
      const requestId = await retried(async (tx) => {
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
      });
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
  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
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
    // revokes it with its refresh token.
    if (status === "active") {
      if (row.refreshTokenUsed) return { status: "claimed" as const };
      const result = await tx.seatDeviceAuthorization.updateMany({
        where: { ...cas, refreshTokenUsed: false, expiresAt: { gt: now } },
        data: { status: "revoked", revokedAt: now, revokeReason: "client_cancelled", version: { increment: 1 } },
      });
      if (result.count !== 1) casLost();
      await auditDevice(tx, row, "SEAT_DEVICE_REVOKED", `坐席客户端取消并撤销未使用的设备：${row.deviceLabel}`, {
        reason: "client_cancelled",
        tokenUsedAfterClaim: false,
      });
      return { status: "cancelled" as const };
    }
    if (status === "expired") {
      await clearLapsedPairingCode(tx, row);
      return { status: "expired" as const };
    }
    if (status === "cancelled" || status === "rejected" || status === "revoked") return { status };
    return { status: "expired" as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), RETRY);
}

// A CAS that loses after the row was re-read in the same transaction means a
// concurrent writer slipped in; surface it as a write conflict so it is retried.
function casLost(): never {
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

async function auditDevice(
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
// membership and unchanged password. Read outside the transaction (P2-7).
async function loadClaimIdentity(row: {
  workspaceId: string | null;
  userId: string | null;
  membershipId: string | null;
  userPasswordSetAt: Date | null;
}): Promise<SeatDeviceIdentity | null> {
  if (!row.workspaceId || !row.userId) return null;
  const [workspace, membership, user] = await Promise.all([
    db.workspace.findUnique({ where: { id: row.workspaceId }, select: { id: true, name: true } }),
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
  return seatDeviceIdentity({ userId: row.userId, displayName: user.name, workspace, role: membership.role });
}

// refreshTokenUsed means "the current pair has been used" (an access token
// accepted or the refresh token presented); a claim and a re-claim always
// hand out an unused pair. rotationSource records the trusted source the
// current pair was issued to; a re-claim must come from that same source.
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

  return runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
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
        !row.claimedAt ||
        now.getTime() - row.claimedAt.getTime() > SEAT_DEVICE_ROTATION_GRACE_SECONDS * 1000 ||
        !input.source ||
        row.rotationSource !== input.source)
    ) {
      throw new SeatDeviceAuthError("poll_token_invalid");
    }
    if (!identity) throw new SeatDeviceAuthError("account_disabled");
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
          where: { ...cas, reclaimed: false, refreshTokenUsed: false },
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), RETRY);
}

// ---------------------------------------------------------------------------
// Website: pairing-code entry (lookup, approve, reject)
// ---------------------------------------------------------------------------

type MemberContext = {
  authSessionId: string;
  providerType: string | null;
  sessionCreatedAt: Date;
  userId: string;
  userName: string;
  passwordSetAt: Date | null;
  workspace: { id: string; name: string; enabled: boolean };
  membershipId: string;
};

// Re-reads the session row itself instead of trusting the caller's view of
// it: usable, owned by the user, seated on a workspace where the user is an
// ACTIVE, non-external member. The workspace bound later is this one.
async function loadMemberContext(authSessionId: string, userId: string, now: Date): Promise<MemberContext> {
  const session = await db.authSession.findUnique({
    where: { id: authSessionId },
    select: { userId: true, activeWorkspaceId: true, providerType: true, createdAt: true, revokedAt: true, expiresAt: true },
  });
  if (!session || session.userId !== userId || session.revokedAt || session.expiresAt <= now || !session.activeWorkspaceId) {
    throw new SeatDeviceAuthError("reauthentication_required");
  }
  const workspaceId = session.activeWorkspaceId;
  const [workspace, membership, user] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, featureFlagsJson: true } }),
    db.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true, status: true, accessScope: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, passwordSetAt: true } }),
  ]);
  if (!workspace || !membership || !user || membership.status !== MembershipStatus.ACTIVE || externalScopeOf(membership) !== null) {
    throw new SeatDeviceAuthError("forbidden");
  }
  return {
    authSessionId,
    providerType: session.providerType,
    sessionCreatedAt: session.createdAt,
    userId,
    userName: user.name,
    passwordSetAt: user.passwordSetAt,
    workspace: { id: workspace.id, name: workspace.name, enabled: isSeatDeviceWorkspaceEnabled(workspace.featureFlagsJson) },
    membershipId: membership.id,
  };
}

// Code entry is limited per account and, with a trusted source, per address
// bucket, in FailedLoginAttempt (15 minutes, 8 failures, then locked). The
// lock is checked before the code is looked at, so a right guess during a
// lock is not confirmed. A success never clears the count: anyone can mint a
// valid code of their own, so clearing would let them reset it.
function codeEntryKeys(userId: string, source: string | null) {
  const bucket = source ? seatDeviceSourceBucket(source) : null;
  const keys = [`seat-device-code:user:${userId}`];
  if (bucket) keys.push(`seat-device-code:ip:${bucket}`);
  return keys.map(hashLoginIdentifier);
}

async function assertCodeEntryOpen(identifierHashes: string[], now: Date) {
  const records = await db.failedLoginAttempt.findMany({
    where: { identifierHash: { in: identifierHashes } },
    select: { lockedUntil: true },
  });
  const retryAfterMs = Math.max(0, ...records.map((record) => evaluateLock(record, now).retryAfterMs));
  if (retryAfterMs > 0) throw new SeatDeviceAuthError("rate_limited", Math.ceil(retryAfterMs / 1000));
}

// Its own transaction, committed before the caller answers: the failure must
// count even though the request it belongs to fails. Unlike the login helper
// this fails closed (errors propagate) and is atomic under concurrency.
async function recordCodeEntryFailure(identifierHashes: string[], now: Date) {
  await retried(
    async (tx) => {
      for (const identifierHash of identifierHashes) {
        const existing = await tx.failedLoginAttempt.findUnique({
          where: { identifierHash },
          select: { attemptCount: true, windowStartedAt: true, lockedUntil: true },
        });
        const next = nextStateOnFailure(existing, now);
        await tx.failedLoginAttempt.upsert({
          where: { identifierHash },
          create: { identifierHash, ...next },
          update: next,
          select: { id: true },
        });
      }
    },
    (error) => isWriteConflictError(error) || isUniqueViolation(error),
  );
}

export type SeatDeviceLookup = {
  requestId: string;
  deviceName: string;
  clientVersion: string | null;
  clientReported: ["deviceName", "clientVersion"];
  requestedAt: string;
  source: string | null;
  expiresInSeconds: number;
  workspace: { name: string };
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
  await assertCodeEntryOpen(keys, now);
  const pairingCodeHash = hashSeatDevicePairingCode(input.pairingCode);
  const row = pairingCodeHash
    ? await db.seatDeviceAuthorization.findUnique({ where: { pairingCodeHash } })
    : null;
  if (!row || effectiveSeatDeviceStatus(row, now) !== "pending") {
    if (row) await retried((tx) => clearLapsedPairingCode(tx, row));
    await recordCodeEntryFailure(keys, now);
    throw new SeatDeviceAuthError("pairing_code_invalid");
  }
  return {
    requestId: row.id,
    deviceName: row.deviceLabel,
    clientVersion: row.clientVersion,
    clientReported: ["deviceName", "clientVersion"],
    requestedAt: row.requestedAt.toISOString(),
    source: row.sourceIp,
    expiresInSeconds: Math.max(0, Math.floor((row.requestExpiresAt.getTime() - now.getTime()) / 1000)),
    workspace: { name: member.workspace.name },
  };
}

type Decision = "approve" | "reject";

// Approve binds the request to the member, the session's workspace and the
// password snapshot; it needs both switches, a PASSWORD session created in the
// last 10 minutes and room under the device cap. Reject needs a usable member
// session only, so a phishing request can always be turned down.
export async function decideSeatDeviceAuthorization(input: {
  authSessionId: string;
  userId: string;
  requestId: string;
  pairingCode: string;
  decision: Decision;
  source: string | null;
  now?: Date;
}): Promise<{ requestId: string; status: "approved" | "rejected" }> {
  assertDeploymentEnabled();
  const now = input.now ?? new Date();
  const member = await loadMemberContext(input.authSessionId, input.userId, now);
  if (input.decision === "approve") {
    if (!member.workspace.enabled) throw new SeatDeviceAuthError("workspace_not_enabled");
    // NOTE: a session rotation creates a fresh AuthSession row, so createdAt
    // alone is not proof of a recent password entry; the website slice must
    // close that before the switch is turned on (design §4.3, §13 item 3).
    const sessionAgeMs = now.getTime() - member.sessionCreatedAt.getTime();
    if (
      member.providerType !== AUTH_SESSION_PROVIDER_TYPES.PASSWORD ||
      sessionAgeMs < 0 ||
      sessionAgeMs > SEAT_DEVICE_STEP_UP_MAX_SESSION_AGE_SECONDS * 1000
    ) {
      throw new SeatDeviceAuthError("reauthentication_required");
    }
  }
  const keys = codeEntryKeys(input.userId, input.source);
  await assertCodeEntryOpen(keys, now);
  const pairingCodeHash = hashSeatDevicePairingCode(input.pairingCode);

  const outcome = await runWithWriteConflictRetry(() => db.$transaction(async (tx) => {
    const row = await tx.seatDeviceAuthorization.findUnique({ where: { id: input.requestId } });
    if (
      !row ||
      !pairingCodeHash ||
      !seatDeviceHashesEqual(row.pairingCodeHash, pairingCodeHash) ||
      effectiveSeatDeviceStatus(row, now) !== "pending"
    ) {
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), RETRY);
  if (outcome === "code_invalid") {
    await recordCodeEntryFailure(keys, now);
    throw new SeatDeviceAuthError("pairing_code_invalid");
  }
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
