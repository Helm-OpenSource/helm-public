import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import type { MemoryWriteRetryAttemptLedgerItem } from "@/lib/memory/write-retry-attempt-ledger";
import { jsonStringify } from "@/lib/utils";

export const MEMORY_WRITE_RETRY_DB_LOCK_RESERVED_AUDIT_ACTION = "MEMORY_WRITE_RETRY_DB_LOCK_RESERVED";
export const MEMORY_WRITE_RETRY_DB_LOCK_UPDATED_AUDIT_ACTION = "MEMORY_WRITE_RETRY_DB_LOCK_UPDATED";

export type MemoryWriteRetryDbLockStatus =
  | "reserved"
  | "source_proof_ready"
  | "execution_in_progress"
  | "succeeded"
  | "failed_retryable"
  | "failed_non_retryable"
  | "blocked_existing_active_lock"
  | "blocked_existing_succeeded_lock"
  | "blocked_attempt_limit_reached"
  | "blocked_missing_idempotency_lock"
  | "blocked_receipt_not_confirmed"
  | "blocked_source_rebuild_required";

export type MemoryWriteRetryDbLockRecord = {
  id: string;
  workspaceId: string;
  idempotencyLockKey: string;
  retryContractItemId: string;
  queueItemId: string;
  sourceAuditId: string;
  receiptAuditId: string | null;
  attemptAuditId: string | null;
  targetType: string;
  targetId: string;
  objectType: string | null;
  objectId: string | null;
  factType: string | null;
  sourceType: string | null;
  sourceId: string | null;
  writeKeyHash: string | null;
  conflictKeyHash: string | null;
  titleHash: string | null;
  contentHash: string | null;
  normalizedValueHash: string | null;
  lockStatus: string;
  sourceProofStatus: string | null;
  executorStatus: string | null;
  attemptCount: number;
  attemptLimit: number;
  nextRetryAfter: Date | null;
  sourceUpdatedAt: Date | null;
  proofGeneratedAt: Date | null;
  memoryFactId: string | null;
  committedAt: Date | null;
  releasedAt: Date | null;
  lockPayload: string | null;
  sourceProofPayload: string | null;
  executorPayload: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryWriteRetryLockDelegate = {
  create(args: { data: Record<string, unknown> }): Promise<MemoryWriteRetryDbLockRecord>;
  findUnique(args: { where: { workspaceId_idempotencyLockKey: { workspaceId: string; idempotencyLockKey: string } } }): Promise<MemoryWriteRetryDbLockRecord | null>;
  update(args: {
    where: { workspaceId_idempotencyLockKey: { workspaceId: string; idempotencyLockKey: string } };
    data: Record<string, unknown>;
  }): Promise<MemoryWriteRetryDbLockRecord>;
};

type MemoryWriteRetryLockDbClient = {
  memoryWriteRetryLock: MemoryWriteRetryLockDelegate;
};

export type MemoryWriteRetryDbLockReservationResult = {
  status:
    | "reserved"
    | "reused_for_next_attempt"
    | "blocked_existing_active_lock"
    | "blocked_existing_succeeded_lock"
    | "blocked_attempt_limit_reached"
    | "blocked_missing_idempotency_lock"
    | "blocked_receipt_not_confirmed"
    | "blocked_source_rebuild_required";
  lock: MemoryWriteRetryDbLockRecord | null;
  existingLock: MemoryWriteRetryDbLockRecord | null;
  canExecuteAutomatically: false;
  manualConfirmationRequired: true;
  boundaryNote: string;
};

function retryLockDb(client?: MemoryWriteRetryLockDbClient) {
  return client ?? (db as unknown as MemoryWriteRetryLockDbClient);
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function nextRetryAfter(now: Date, delayMinutes: number | null) {
  if (delayMinutes === null || delayMinutes <= 0) return now;
  return new Date(now.getTime() + delayMinutes * 60_000);
}

function isReusableFailedLock(lock: MemoryWriteRetryDbLockRecord) {
  return lock.lockStatus === "failed_retryable" && lock.attemptCount < lock.attemptLimit;
}

function activeLockStatus(lock: MemoryWriteRetryDbLockRecord): MemoryWriteRetryDbLockReservationResult["status"] {
  if (lock.lockStatus === "succeeded") return "blocked_existing_succeeded_lock";
  if (lock.attemptCount >= lock.attemptLimit) return "blocked_attempt_limit_reached";
  return "blocked_existing_active_lock";
}

function blockedReservation(
  status: MemoryWriteRetryDbLockReservationResult["status"],
  existingLock: MemoryWriteRetryDbLockRecord | null = null,
): MemoryWriteRetryDbLockReservationResult {
  return {
    status,
    lock: null,
    existingLock,
    canExecuteAutomatically: false,
    manualConfirmationRequired: true,
    boundaryNote:
      "Memory write retry DB lock blocks execution unless a manually confirmed retry has an available idempotency guard; it does not execute retries automatically.",
  };
}

function buildLockPayload(args: {
  attemptItem: MemoryWriteRetryAttemptLedgerItem;
  manualConfirmationNote?: string | null;
}) {
  return {
    lockVersion: "memory_write_retry_db_lock_v1",
    retryContractItemId: args.attemptItem.retryContractItemId,
    queueItemId: args.attemptItem.queueItemId,
    sourceAuditId: args.attemptItem.auditId,
    receiptAuditId: args.attemptItem.receiptAuditId,
    idempotencyLockKey: args.attemptItem.idempotencyLockKey,
    attemptCountBeforeReservation: args.attemptItem.attemptCount,
    attemptLimit: args.attemptItem.attemptLimit,
    sourceRebuildGate: args.attemptItem.sourceRebuildGate,
    manualConfirmationNote: args.manualConfirmationNote ?? null,
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote:
      "This DB lock reserves a bounded manual retry attempt only; it is not an automatic executor or commitment authority.",
  };
}

export async function reserveMemoryWriteRetryDbLock(input: {
  workspaceId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorType?: ActorType;
  attemptItem: MemoryWriteRetryAttemptLedgerItem;
  manualConfirmationNote?: string | null;
  sourcePage?: string | null;
  now?: Date;
  dbClient?: MemoryWriteRetryLockDbClient;
}): Promise<MemoryWriteRetryDbLockReservationResult> {
  const now = input.now ?? new Date();
  const { attemptItem } = input;

  if (!attemptItem.idempotencyLockKey) return blockedReservation("blocked_missing_idempotency_lock");
  if (attemptItem.receiptStatus !== "confirmed_ready_for_executor") {
    return blockedReservation("blocked_receipt_not_confirmed");
  }
  if (
    attemptItem.idempotencyLockStatus === "blocked_source_rebuild_required" ||
    attemptItem.sourceRebuildGate.gateStatus === "manual_rebuild_required"
  ) {
    return blockedReservation("blocked_source_rebuild_required");
  }
  if (attemptItem.attemptCount >= attemptItem.attemptLimit) return blockedReservation("blocked_attempt_limit_reached");

  const data = {
    workspaceId: input.workspaceId,
    idempotencyLockKey: attemptItem.idempotencyLockKey,
    retryContractItemId: attemptItem.retryContractItemId,
    queueItemId: attemptItem.queueItemId,
    sourceAuditId: attemptItem.auditId,
    receiptAuditId: attemptItem.receiptAuditId,
    attemptAuditId: attemptItem.latestAttemptAuditId,
    targetType: attemptItem.targetType,
    targetId: attemptItem.targetId,
    objectType: attemptItem.objectType,
    objectId: attemptItem.objectId,
    factType: attemptItem.factType,
    sourceType: attemptItem.sourceType,
    sourceId: attemptItem.sourceId,
    lockStatus: "reserved",
    sourceProofStatus: attemptItem.sourceRebuildGate.gateStatus,
    executorStatus: "not_started",
    attemptCount: attemptItem.attemptCount + 1,
    attemptLimit: attemptItem.attemptLimit,
    nextRetryAfter: nextRetryAfter(now, attemptItem.nextBackoffDelayMinutes),
    lockPayload: jsonStringify(buildLockPayload({
      attemptItem,
      manualConfirmationNote: input.manualConfirmationNote,
    })),
  };

  try {
    const lock = await retryLockDb(input.dbClient).memoryWriteRetryLock.create({ data });
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? null,
      actor: input.actorName ?? (input.actorUserId ? "Memory retry operator" : "Helm Memory Retry Guard"),
      actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
      actionType: MEMORY_WRITE_RETRY_DB_LOCK_RESERVED_AUDIT_ACTION,
      targetType: attemptItem.targetType,
      targetId: attemptItem.targetId,
      summary: "Memory write retry DB idempotency lock reserved",
      payload: {
        lockId: lock.id,
        idempotencyLockKey: lock.idempotencyLockKey,
        lockStatus: lock.lockStatus,
        attemptCount: lock.attemptCount,
        attemptLimit: lock.attemptLimit,
        manualConfirmationRequired: true,
        canExecuteAutomatically: false,
      },
      sourcePage: input.sourcePage ?? null,
      relatedObjectType: attemptItem.objectType ?? null,
      relatedObjectId: attemptItem.objectId ?? null,
    });

    return {
      status: "reserved",
      lock,
      existingLock: null,
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
      boundaryNote:
        "Memory write retry DB lock has been reserved for a manually confirmed bounded retry; execution still requires source proof and does not run automatically.",
    };
  } catch (error) {
    if (errorCode(error) !== "P2002") throw error;

    const existingLock = await retryLockDb(input.dbClient).memoryWriteRetryLock.findUnique({
      where: {
        workspaceId_idempotencyLockKey: {
          workspaceId: input.workspaceId,
          idempotencyLockKey: attemptItem.idempotencyLockKey,
        },
      },
    });

    if (!existingLock) return blockedReservation("blocked_existing_active_lock", null);
    if (!isReusableFailedLock(existingLock)) return blockedReservation(activeLockStatus(existingLock), existingLock);

    const lock = await retryLockDb(input.dbClient).memoryWriteRetryLock.update({
      where: {
        workspaceId_idempotencyLockKey: {
          workspaceId: input.workspaceId,
          idempotencyLockKey: attemptItem.idempotencyLockKey,
        },
      },
      data: {
        ...data,
        attemptCount: existingLock.attemptCount + 1,
      },
    });

    return {
      status: "reused_for_next_attempt",
      lock,
      existingLock,
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
      boundaryNote:
        "Memory write retry DB lock was reused only because the previous attempt was retryable and within the bounded attempt limit.",
    };
  }
}

export async function updateMemoryWriteRetryDbLock(input: {
  workspaceId: string;
  idempotencyLockKey: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorType?: ActorType;
  targetType: string;
  targetId: string;
  lockStatus?: MemoryWriteRetryDbLockStatus;
  sourceProofStatus?: string | null;
  executorStatus?: string | null;
  memoryFactId?: string | null;
  writeKeyHash?: string | null;
  conflictKeyHash?: string | null;
  titleHash?: string | null;
  contentHash?: string | null;
  normalizedValueHash?: string | null;
  sourceUpdatedAt?: Date | null;
  proofGeneratedAt?: Date | null;
  committedAt?: Date | null;
  releasedAt?: Date | null;
  sourceProofPayload?: unknown;
  executorPayload?: unknown;
  lastError?: string | null;
  sourcePage?: string | null;
  dbClient?: MemoryWriteRetryLockDbClient;
}) {
  const lock = await retryLockDb(input.dbClient).memoryWriteRetryLock.update({
    where: {
      workspaceId_idempotencyLockKey: {
        workspaceId: input.workspaceId,
        idempotencyLockKey: input.idempotencyLockKey,
      },
    },
    data: {
      ...(input.lockStatus ? { lockStatus: input.lockStatus } : {}),
      ...(input.sourceProofStatus !== undefined ? { sourceProofStatus: input.sourceProofStatus } : {}),
      ...(input.executorStatus !== undefined ? { executorStatus: input.executorStatus } : {}),
      ...(input.memoryFactId !== undefined ? { memoryFactId: input.memoryFactId } : {}),
      ...(input.writeKeyHash !== undefined ? { writeKeyHash: input.writeKeyHash } : {}),
      ...(input.conflictKeyHash !== undefined ? { conflictKeyHash: input.conflictKeyHash } : {}),
      ...(input.titleHash !== undefined ? { titleHash: input.titleHash } : {}),
      ...(input.contentHash !== undefined ? { contentHash: input.contentHash } : {}),
      ...(input.normalizedValueHash !== undefined ? { normalizedValueHash: input.normalizedValueHash } : {}),
      ...(input.sourceUpdatedAt !== undefined ? { sourceUpdatedAt: input.sourceUpdatedAt } : {}),
      ...(input.proofGeneratedAt !== undefined ? { proofGeneratedAt: input.proofGeneratedAt } : {}),
      ...(input.committedAt !== undefined ? { committedAt: input.committedAt } : {}),
      ...(input.releasedAt !== undefined ? { releasedAt: input.releasedAt } : {}),
      ...(input.sourceProofPayload !== undefined ? { sourceProofPayload: jsonStringify(input.sourceProofPayload) } : {}),
      ...(input.executorPayload !== undefined ? { executorPayload: jsonStringify(input.executorPayload) } : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    actor: input.actorName ?? (input.actorUserId ? "Memory retry operator" : "Helm Memory Retry Guard"),
    actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
    actionType: MEMORY_WRITE_RETRY_DB_LOCK_UPDATED_AUDIT_ACTION,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: `Memory write retry DB idempotency lock updated: ${lock.lockStatus}`,
    payload: {
      lockId: lock.id,
      idempotencyLockKey: lock.idempotencyLockKey,
      lockStatus: lock.lockStatus,
      sourceProofStatus: lock.sourceProofStatus,
      executorStatus: lock.executorStatus,
      writeKeyHash: lock.writeKeyHash,
      conflictKeyHash: lock.conflictKeyHash,
      memoryFactId: lock.memoryFactId,
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
    },
    sourcePage: input.sourcePage ?? null,
    relatedObjectType: lock.objectType,
    relatedObjectId: lock.objectId,
  });

  return lock;
}
