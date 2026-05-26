import { ActorType, type MemoryFact } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import {
  createMemoryFactsWithWriteResult,
  type CreateFactInput,
  type MemoryFactBatchWriteResult,
} from "@/lib/memory/memory-fact.service";
import {
  reserveMemoryWriteRetryDbLock,
  updateMemoryWriteRetryDbLock,
  type MemoryWriteRetryDbLockRecord,
} from "@/lib/memory/write-retry-idempotency-guard";
import type { MemoryWriteRetrySourceReconstructionProof } from "@/lib/memory/write-retry-source-reconstruction";
import type { MemoryWriteRetryAttemptLedgerItem } from "@/lib/memory/write-retry-attempt-ledger";

export const MEMORY_WRITE_RETRY_EXECUTOR_COMPLETED_AUDIT_ACTION = "MEMORY_WRITE_RETRY_EXECUTOR_COMPLETED";
export const MEMORY_WRITE_RETRY_EXECUTOR_BLOCKED_AUDIT_ACTION = "MEMORY_WRITE_RETRY_EXECUTOR_BLOCKED";

export type MemoryWriteRetryBoundedExecutorStatus =
  | "dry_run_ready"
  | "succeeded"
  | "blocked_manual_confirmation_required"
  | "blocked_source_proof_not_ready"
  | "blocked_backoff_not_elapsed"
  | "blocked_attempt_limit_reached"
  | "blocked_idempotency_guard"
  | "failed_retryable"
  | "failed_non_retryable"
  | "failed_operator_review_required";

type MemoryWriteRetryExecutorWriteFact = (fact: CreateFactInput) => Promise<MemoryFact>;

type MemoryWriteRetryLockDbClient = Parameters<typeof reserveMemoryWriteRetryDbLock>[0]["dbClient"];

export type MemoryWriteRetryBoundedExecutorResult = {
  executorVersion: "memory_write_retry_bounded_executor_v1";
  status: MemoryWriteRetryBoundedExecutorStatus;
  lock: MemoryWriteRetryDbLockRecord | null;
  createdFact: MemoryFact | null;
  writeResult: MemoryFactBatchWriteResult | null;
  blockedReason: string | null;
  manualConfirmationRequired: true;
  canExecuteAutomatically: false;
  boundaryNote: string;
};

function blockedResult(status: MemoryWriteRetryBoundedExecutorStatus, blockedReason: string): MemoryWriteRetryBoundedExecutorResult {
  return {
    executorVersion: "memory_write_retry_bounded_executor_v1",
    status,
    lock: null,
    createdFact: null,
    writeResult: null,
    blockedReason,
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote:
      "Memory write retry executor is review-first and bounded; blocked results do not write facts, create commitments, change recommendations, or send external messages.",
  };
}

function backoffElapsed(args: {
  item: MemoryWriteRetryAttemptLedgerItem;
  now: Date;
}) {
  if (!args.item.latestAttemptCreatedAt || !args.item.nextBackoffDelayMinutes || args.item.nextBackoffDelayMinutes <= 0) {
    return true;
  }

  const latestAttemptAt = new Date(args.item.latestAttemptCreatedAt);
  if (Number.isNaN(latestAttemptAt.getTime())) return true;

  const nextAllowedAt = new Date(latestAttemptAt.getTime() + args.item.nextBackoffDelayMinutes * 60_000);
  return args.now.getTime() >= nextAllowedAt.getTime();
}

function writeFailureStatus(result: MemoryFactBatchWriteResult): MemoryWriteRetryBoundedExecutorStatus {
  const firstFailure = result.failures[0];
  if (!firstFailure) return "failed_operator_review_required";
  if (firstFailure.failureClass === "retryable") return "failed_retryable";
  if (firstFailure.failureClass === "non_retryable") return "failed_non_retryable";
  return "failed_operator_review_required";
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export async function executeMemoryWriteRetry(input: {
  workspaceId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorType?: ActorType;
  sourcePage?: string | null;
  attemptItem: MemoryWriteRetryAttemptLedgerItem;
  sourceProof: MemoryWriteRetrySourceReconstructionProof;
  manualConfirmation: {
    confirmed: boolean;
    note?: string | null;
  };
  dryRun?: boolean;
  now?: Date;
  dbClient?: MemoryWriteRetryLockDbClient;
  writeFact?: MemoryWriteRetryExecutorWriteFact;
}): Promise<MemoryWriteRetryBoundedExecutorResult> {
  const now = input.now ?? new Date();

  if (!input.manualConfirmation.confirmed) {
    return blockedResult("blocked_manual_confirmation_required", "manual_confirmation_required");
  }
  if (input.attemptItem.attemptCount >= input.attemptItem.attemptLimit) {
    return blockedResult("blocked_attempt_limit_reached", "attempt_limit_reached");
  }
  if (!backoffElapsed({ item: input.attemptItem, now })) {
    return blockedResult("blocked_backoff_not_elapsed", "backoff_not_elapsed");
  }
  if (input.sourceProof.proofStatus !== "ready_for_executor" || !input.sourceProof.reconstructedFact) {
    return blockedResult("blocked_source_proof_not_ready", input.sourceProof.proofStatus);
  }

  const lockReservation = await reserveMemoryWriteRetryDbLock({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorType: input.actorType,
    attemptItem: input.attemptItem,
    manualConfirmationNote: input.manualConfirmation.note,
    sourcePage: input.sourcePage,
    now,
    dbClient: input.dbClient,
  });
  if (lockReservation.status !== "reserved" && lockReservation.status !== "reused_for_next_attempt") {
    return {
      ...blockedResult("blocked_idempotency_guard", lockReservation.status),
      lock: lockReservation.existingLock,
    };
  }

  try {
    await updateMemoryWriteRetryDbLock({
      workspaceId: input.workspaceId,
      idempotencyLockKey: input.sourceProof.idempotencyLockKey ?? input.attemptItem.idempotencyLockKey ?? "",
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      actorType: input.actorType,
      targetType: input.attemptItem.targetType,
      targetId: input.attemptItem.targetId,
      lockStatus: "source_proof_ready",
      sourceProofStatus: input.sourceProof.proofStatus,
      executorStatus: input.dryRun ? "dry_run_ready" : "ready_to_execute",
      writeKeyHash: input.sourceProof.writeKeyHash,
      conflictKeyHash: input.sourceProof.conflictKeyHash,
      titleHash: input.sourceProof.titleHash,
      contentHash: input.sourceProof.contentHash,
      normalizedValueHash: input.sourceProof.normalizedValueHash,
      sourceUpdatedAt: input.sourceProof.sourceUpdatedAt ? new Date(input.sourceProof.sourceUpdatedAt) : null,
      proofGeneratedAt: new Date(input.sourceProof.proofGeneratedAt),
      sourceProofPayload: input.sourceProof,
      sourcePage: input.sourcePage,
      dbClient: input.dbClient,
    });
  } catch (error) {
    if (errorCode(error) !== "P2002") throw error;

    const lock = await updateMemoryWriteRetryDbLock({
      workspaceId: input.workspaceId,
      idempotencyLockKey: input.sourceProof.idempotencyLockKey ?? input.attemptItem.idempotencyLockKey ?? "",
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      actorType: input.actorType,
      targetType: input.attemptItem.targetType,
      targetId: input.attemptItem.targetId,
      lockStatus: "failed_non_retryable",
      sourceProofStatus: input.sourceProof.proofStatus,
      executorStatus: "blocked_idempotency_guard",
      lastError: "Memory write retry source proof collided with an existing DB write hash guard.",
      executorPayload: {
        idempotencyGuardStatus: "blocked_write_hash_conflict",
        writeKeyHash: input.sourceProof.writeKeyHash,
        conflictKeyHash: input.sourceProof.conflictKeyHash,
        manualConfirmationRequired: true,
        canExecuteAutomatically: false,
      },
      sourcePage: input.sourcePage,
      dbClient: input.dbClient,
    });

    return {
      ...blockedResult("blocked_idempotency_guard", "blocked_write_hash_conflict"),
      lock,
    };
  }

  if (input.dryRun) {
    return {
      executorVersion: "memory_write_retry_bounded_executor_v1",
      status: "dry_run_ready",
      lock: lockReservation.lock,
      createdFact: null,
      writeResult: null,
      blockedReason: null,
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
      boundaryNote:
        "Dry run confirmed DB lock and source proof only; it does not execute MemoryFact writes or expand authority.",
    };
  }

  await updateMemoryWriteRetryDbLock({
    workspaceId: input.workspaceId,
    idempotencyLockKey: input.sourceProof.idempotencyLockKey ?? input.attemptItem.idempotencyLockKey ?? "",
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorType: input.actorType,
    targetType: input.attemptItem.targetType,
    targetId: input.attemptItem.targetId,
    lockStatus: "execution_in_progress",
    executorStatus: "execution_in_progress",
    sourcePage: input.sourcePage,
    dbClient: input.dbClient,
  });

  const writeResult = await createMemoryFactsWithWriteResult({
    facts: [input.sourceProof.reconstructedFact],
    continueOnFailure: false,
    writeFact: input.writeFact,
  });
  const createdFact = writeResult.created[0] ?? null;

  if (createdFact) {
    const lock = await updateMemoryWriteRetryDbLock({
      workspaceId: input.workspaceId,
      idempotencyLockKey: input.sourceProof.idempotencyLockKey ?? input.attemptItem.idempotencyLockKey ?? "",
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      actorType: input.actorType,
      targetType: input.attemptItem.targetType,
      targetId: input.attemptItem.targetId,
      lockStatus: "succeeded",
      executorStatus: "succeeded",
      memoryFactId: createdFact.id,
      committedAt: now,
      executorPayload: {
        writeSummary: writeResult.summary,
        createdFactId: createdFact.id,
        manualConfirmationRequired: true,
        canExecuteAutomatically: false,
      },
      sourcePage: input.sourcePage,
      dbClient: input.dbClient,
    });

    await safeWriteAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? null,
      actor: input.actorName ?? (input.actorUserId ? "Memory retry operator" : "Helm Memory Retry Executor"),
      actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
      actionType: MEMORY_WRITE_RETRY_EXECUTOR_COMPLETED_AUDIT_ACTION,
      targetType: "MemoryFact",
      targetId: createdFact.id,
      summary: `Memory write retry executor created fact: ${createdFact.title}`,
      payload: {
        retryContractItemId: input.attemptItem.retryContractItemId,
        idempotencyLockKey: input.attemptItem.idempotencyLockKey,
        sourceProofStatus: input.sourceProof.proofStatus,
        writeSummary: writeResult.summary,
        manualConfirmationRequired: true,
        canExecuteAutomatically: false,
      },
      sourcePage: input.sourcePage ?? null,
      relatedObjectType: input.attemptItem.objectType,
      relatedObjectId: input.attemptItem.objectId,
    });

    return {
      executorVersion: "memory_write_retry_bounded_executor_v1",
      status: "succeeded",
      lock,
      createdFact,
      writeResult,
      blockedReason: null,
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
      boundaryNote:
        "Memory write retry executor created exactly one reconstructed MemoryFact from a manually confirmed source proof; it did not rerun meeting memory pipeline or expand recommendation / commitment authority.",
    };
  }

  const status = writeFailureStatus(writeResult);
  const firstFailure = writeResult.failures[0];
  const lock = await updateMemoryWriteRetryDbLock({
    workspaceId: input.workspaceId,
    idempotencyLockKey: input.sourceProof.idempotencyLockKey ?? input.attemptItem.idempotencyLockKey ?? "",
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorType: input.actorType,
    targetType: input.attemptItem.targetType,
    targetId: input.attemptItem.targetId,
    lockStatus: status === "failed_retryable" ? "failed_retryable" : "failed_non_retryable",
    executorStatus: status,
    lastError: firstFailure?.message ?? "Memory write retry executor failed without creating a fact.",
    executorPayload: {
      writeSummary: writeResult.summary,
      failures: writeResult.failures,
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
    },
    sourcePage: input.sourcePage,
    dbClient: input.dbClient,
  });

  await safeWriteAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? null,
    actor: input.actorName ?? (input.actorUserId ? "Memory retry operator" : "Helm Memory Retry Executor"),
    actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
    actionType: MEMORY_WRITE_RETRY_EXECUTOR_BLOCKED_AUDIT_ACTION,
    targetType: input.attemptItem.targetType,
    targetId: input.attemptItem.targetId,
    summary: `Memory write retry executor failed: ${status}`,
    payload: {
      retryContractItemId: input.attemptItem.retryContractItemId,
      idempotencyLockKey: input.attemptItem.idempotencyLockKey,
      sourceProofStatus: input.sourceProof.proofStatus,
      writeSummary: writeResult.summary,
      failures: writeResult.failures,
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
    },
    sourcePage: input.sourcePage ?? null,
    relatedObjectType: input.attemptItem.objectType,
    relatedObjectId: input.attemptItem.objectId,
  });

  return {
    executorVersion: "memory_write_retry_bounded_executor_v1",
    status,
    lock,
    createdFact: null,
    writeResult,
    blockedReason: firstFailure?.reason ?? status,
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote:
      "Memory write retry executor recorded a bounded failure without rerunning broader meeting memory side effects or expanding authority.",
  };
}
