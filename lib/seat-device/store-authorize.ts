import "server-only";

// lib/seat-device/store-authorize.ts
// Seat desktop device authorization (D1), request side: a device asks for
// authorization and may cancel its own request. (Website lookup and decision
// and the device's claim follow in the next slices.)
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

import { ActorType, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { isWriteConflictError } from "@/lib/db/conflict-aware-write";
import {
  SEAT_DEVICE_PAIRING_CODE_MAX_ATTEMPTS,
  SEAT_DEVICE_PENDING_BUCKET_WINDOW_SECONDS,
  SEAT_DEVICE_PENDING_LIMIT_GLOBAL,
  SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET,
  SEAT_DEVICE_PENDING_LIMIT_PER_BUCKET_WINDOW,
  SEAT_DEVICE_POLL_INTERVAL_SECONDS,
  SEAT_DEVICE_REQUEST_TTL_SECONDS,
  effectiveSeatDeviceStatus,
  formatSeatDevicePairingCode,
  generateSeatDevicePairingCode,
  hashSeatDevicePairingCode,
  hashSeatDeviceToken,
  isSeatDeviceAuthDeploymentEnabled,
  mintSeatDeviceToken,
  seatDeviceHashesEqual,
  seatDeviceSourceBucket,
  type SeatDeviceCancelStatus,
  type SeatDeviceClientType,
  type SeatDeviceErrorCode,
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

function assertDeploymentEnabled() {
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
async function retried<T>(
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

// Design v0.3.1 §15.1: a pending or approved-but-unclaimed request becomes
// cancelled; a claimed device reads "claimed" and is left alone. A wrong poll
// token reads "expired" so the call never says whether a request exists.
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
    // A claimed device is left alone here; the client revokes it with its
    // refresh token (device-tokens/revoke, reason client_cancelled).
    if (status === "active") return { status: "claimed" as const };
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
) {
  if (!row.workspaceId) return;
  await writeAuditLog(
    {
      workspaceId: row.workspaceId,
      userId: row.userId,
      actor: "seat_desktop",
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
