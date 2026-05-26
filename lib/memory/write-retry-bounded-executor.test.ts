import { ActorType, MemoryFactType, MemoryStatus, ObjectType, SourceType, type MemoryFact } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateFactInput } from "@/lib/memory/memory-fact.service";
import type { MemoryWriteRetryAttemptLedgerItem } from "@/lib/memory/write-retry-attempt-ledger";
import {
  MEMORY_WRITE_RETRY_EXECUTOR_COMPLETED_AUDIT_ACTION,
  executeMemoryWriteRetry,
} from "@/lib/memory/write-retry-bounded-executor";
import type { MemoryWriteRetryDbLockRecord } from "@/lib/memory/write-retry-idempotency-guard";
import type { MemoryWriteRetrySourceReconstructionProof } from "@/lib/memory/write-retry-source-reconstruction";

const writeAuditLogMock = vi.hoisted(() => vi.fn(async (input: unknown) => ({ id: "audit-1", input })));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
  safeWriteAuditLog: writeAuditLogMock,
  recordAuditWriteFailure: vi.fn(),
}));

type TestRetryLockDbClient = NonNullable<Parameters<typeof executeMemoryWriteRetry>[0]["dbClient"]>;

function reconstructedFact(overrides: Partial<CreateFactInput> = {}): CreateFactInput {
  return {
    workspaceId: "workspace-1",
    actorName: "Ada Chen",
    actorUserId: "user-1",
    actorType: ActorType.USER,
    objectType: ObjectType.MEETING,
    objectId: "meeting-1",
    factType: MemoryFactType.SUMMARY,
    title: "预算复盘 会议摘要",
    content: "客户确认续约预算将在下周三前完成内部审批。",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    normalizedValue: {
      meetingId: "meeting-1",
    },
    confidence: 70,
    importance: 65,
    freshnessScore: 80,
    status: MemoryStatus.ACTIVE,
    confirmedByUser: true,
    createdBySystem: false,
    ...overrides,
  };
}

function attemptItem(overrides: Partial<MemoryWriteRetryAttemptLedgerItem> = {}): MemoryWriteRetryAttemptLedgerItem {
  return {
    id: "retryable-audit:0:retry-contract:retry-receipt:retry-attempt",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    auditId: "retryable-audit",
    targetType: "Meeting",
    targetId: "meeting-1",
    title: "预算复盘 会议摘要",
    objectType: "MEETING",
    objectId: "meeting-1",
    factType: "SUMMARY",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    receiptAuditId: "receipt-audit-1",
    receiptStatus: "confirmed_ready_for_executor",
    receiptPayloadStatus: "valid",
    idempotencyLockKey: "memory-write-retry:meeting:meeting-1:summary:meeting-note:meeting-1:budget",
    ownerUserId: "user-1",
    ownerName: "Ada Chen",
    ownerEmail: "ada@example.com",
    ownerLabel: "Ada Chen",
    attemptCount: 0,
    attemptLimit: 3,
    remainingAttemptCount: 3,
    latestAttemptAuditId: "attempt-audit-1",
    latestAttemptCreatedAt: "2026-04-21T04:00:00.000Z",
    latestAttemptStatus: "lock_reserved",
    attemptPayloadStatus: "valid",
    backoffDelaysMinutes: [0, 5, 15],
    nextBackoffDelayMinutes: 0,
    idempotencyLockStatus: "lock_available_for_manual_attempt",
    sourceRebuildGate: {
      gateVersion: "memory_write_retry_source_rebuild_gate_v1",
      gateStatus: "ready_for_manual_rebuild_review",
      receiptStatus: "confirmed_ready_for_executor",
      sourceType: "MEETING_NOTE",
      sourceId: "meeting-1",
      missingInputs: [],
      requiredManualChecks: ["confirm_same_workspace_object_and_source", "check_existing_duplicate_or_conflict"],
      nextOperatorAction: "record_attempt_lock_after_manual_review",
      manualConfirmationRequired: true,
      canExecuteAutomatically: false,
      boundaryNote: "Source rebuild gate is review only.",
    },
    nextOperatorAction: "record_attempt_lock_after_manual_review",
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote: "Attempt ledger is review only.",
    ...overrides,
  };
}

function sourceProof(
  overrides: Partial<MemoryWriteRetrySourceReconstructionProof> = {},
): MemoryWriteRetrySourceReconstructionProof {
  return {
    proofVersion: "memory_write_retry_source_reconstruction_proof_v1",
    proofStatus: "ready_for_executor",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    sourceAuditId: "retryable-audit",
    receiptAuditId: "receipt-audit-1",
    idempotencyLockKey: "memory-write-retry:meeting:meeting-1:summary:meeting-note:meeting-1:budget",
    targetType: "Meeting",
    targetId: "meeting-1",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    sourceUpdatedAt: "2026-04-21T02:30:00.000Z",
    failureAuditCreatedAt: "2026-04-21T04:00:00.000Z",
    proofGeneratedAt: "2026-04-21T04:15:00.000Z",
    contentBasis: ["summary"],
    candidateCount: 1,
    reconstructedFact: reconstructedFact(),
    writeKeyHash: "a".repeat(64),
    conflictKeyHash: "b".repeat(64),
    titleHash: "c".repeat(64),
    contentHash: "d".repeat(64),
    normalizedValueHash: "e".repeat(64),
    writePlanSummary: {
      inputDraftCount: 1,
      createDraftCount: 1,
      duplicateSuppressedCount: 0,
      conflictCandidateCount: 0,
      guardMode: "source_object_normalized_fact_key",
      boundaryNote: "Write plan is review only.",
    },
    duplicateSuppressions: [],
    conflictCandidates: [],
    missingInputs: [],
    requiredManualChecks: [],
    manualConfirmationRequired: true,
    canExecuteAutomatically: false,
    boundaryNote: "Source proof is review only.",
    ...overrides,
  };
}

function lockRecord(overrides: Partial<MemoryWriteRetryDbLockRecord> = {}): MemoryWriteRetryDbLockRecord {
  return {
    id: "lock-1",
    workspaceId: "workspace-1",
    idempotencyLockKey: "memory-write-retry:meeting:meeting-1:summary:meeting-note:meeting-1:budget",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    sourceAuditId: "retryable-audit",
    receiptAuditId: "receipt-audit-1",
    attemptAuditId: "attempt-audit-1",
    targetType: "Meeting",
    targetId: "meeting-1",
    objectType: "MEETING",
    objectId: "meeting-1",
    factType: "SUMMARY",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    writeKeyHash: null,
    conflictKeyHash: null,
    titleHash: null,
    contentHash: null,
    normalizedValueHash: null,
    lockStatus: "reserved",
    sourceProofStatus: "ready_for_manual_rebuild_review",
    executorStatus: "not_started",
    attemptCount: 1,
    attemptLimit: 3,
    nextRetryAfter: new Date("2026-04-21T04:00:00.000Z"),
    sourceUpdatedAt: null,
    proofGeneratedAt: null,
    memoryFactId: null,
    committedAt: null,
    releasedAt: null,
    lockPayload: null,
    sourceProofPayload: null,
    executorPayload: null,
    lastError: null,
    createdAt: new Date("2026-04-21T04:00:00.000Z"),
    updatedAt: new Date("2026-04-21T04:00:00.000Z"),
    ...overrides,
  };
}

function memoryFact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: "fact-1",
    workspaceId: "workspace-1",
    objectType: ObjectType.MEETING,
    objectId: "meeting-1",
    factType: MemoryFactType.SUMMARY,
    title: "预算复盘 会议摘要",
    content: "客户确认续约预算将在下周三前完成内部审批。",
    normalizedValue: JSON.stringify({ meetingId: "meeting-1" }),
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    confidence: 70,
    importance: 65,
    freshnessScore: 80,
    status: MemoryStatus.ACTIVE,
    confirmedByUser: true,
    createdBySystem: false,
    createdAt: new Date("2026-04-21T04:16:00.000Z"),
    updatedAt: new Date("2026-04-21T04:16:00.000Z"),
    ...overrides,
  };
}

function dbClient(overrides: {
  create?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
} = {}): TestRetryLockDbClient {
  let current = lockRecord();
  const update = overrides.update ?? vi.fn(async (args: { data: Partial<MemoryWriteRetryDbLockRecord> }) => {
    current = {
      ...current,
      ...args.data,
      updatedAt: new Date("2026-04-21T04:16:00.000Z"),
    };
    return current;
  });

  return {
    memoryWriteRetryLock: {
      create: overrides.create ?? vi.fn(async () => current),
      findUnique: overrides.findUnique ?? vi.fn(async () => null),
      update,
    },
  } as unknown as TestRetryLockDbClient;
}

describe("memory write retry bounded executor", () => {
  beforeEach(() => {
    writeAuditLogMock.mockClear();
  });

  it("blocks execution without explicit manual confirmation", async () => {
    const writeFact = vi.fn(async () => memoryFact());

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      attemptItem: attemptItem(),
      sourceProof: sourceProof(),
      manualConfirmation: {
        confirmed: false,
      },
      writeFact,
    });

    expect(result).toMatchObject({
      status: "blocked_manual_confirmation_required",
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
    });
    expect(writeFact).not.toHaveBeenCalled();
  });

  it("blocks execution when source reconstruction proof is not ready", async () => {
    const writeFact = vi.fn(async () => memoryFact());

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      attemptItem: attemptItem(),
      sourceProof: sourceProof({
        proofStatus: "blocked_source_changed_since_failure",
        reconstructedFact: null,
      }),
      manualConfirmation: {
        confirmed: true,
      },
      writeFact,
    });

    expect(result.status).toBe("blocked_source_proof_not_ready");
    expect(writeFact).not.toHaveBeenCalled();
  });

  it("honors bounded backoff before reserving the DB lock", async () => {
    const client = dbClient();
    const writeFact = vi.fn(async () => memoryFact());

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      attemptItem: attemptItem({
        latestAttemptCreatedAt: "2026-04-21T04:00:00.000Z",
        nextBackoffDelayMinutes: 15,
      }),
      sourceProof: sourceProof(),
      manualConfirmation: {
        confirmed: true,
      },
      now: new Date("2026-04-21T04:05:00.000Z"),
      dbClient: client,
      writeFact,
    });

    expect(result.status).toBe("blocked_backoff_not_elapsed");
    expect(client.memoryWriteRetryLock.create).not.toHaveBeenCalled();
    expect(writeFact).not.toHaveBeenCalled();
  });

  it("does not write when the DB idempotency guard reports an active lock", async () => {
    const existingLock = lockRecord({ lockStatus: "reserved" });
    const client = dbClient({
      create: vi.fn(async () => {
        const error = new Error("Unique constraint failed") as Error & { code: string };
        error.code = "P2002";
        throw error;
      }),
      findUnique: vi.fn(async () => existingLock),
    });
    const writeFact = vi.fn(async () => memoryFact());

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      attemptItem: attemptItem(),
      sourceProof: sourceProof(),
      manualConfirmation: {
        confirmed: true,
      },
      dbClient: client,
      writeFact,
    });

    expect(result).toMatchObject({
      status: "blocked_idempotency_guard",
      lock: existingLock,
      canExecuteAutomatically: false,
    });
    expect(writeFact).not.toHaveBeenCalled();
  });

  it("blocks when the reconstructed write hash collides with an existing DB guard", async () => {
    const update = vi.fn(async (args: { data: Partial<MemoryWriteRetryDbLockRecord> }) => {
      if (args.data.writeKeyHash) {
        const error = new Error("Unique constraint failed") as Error & { code: string };
        error.code = "P2002";
        throw error;
      }

      return lockRecord({
        lockStatus: args.data.lockStatus ?? "failed_non_retryable",
        sourceProofStatus: args.data.sourceProofStatus ?? null,
        executorStatus: args.data.executorStatus ?? null,
        lastError: args.data.lastError ?? null,
      });
    });
    const client = dbClient({ update });
    const writeFact = vi.fn(async () => memoryFact());

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      attemptItem: attemptItem(),
      sourceProof: sourceProof(),
      manualConfirmation: {
        confirmed: true,
      },
      dbClient: client,
      writeFact,
    });

    expect(result).toMatchObject({
      status: "blocked_idempotency_guard",
      blockedReason: "blocked_write_hash_conflict",
      lock: {
        lockStatus: "failed_non_retryable",
        executorStatus: "blocked_idempotency_guard",
      },
    });
    expect(writeFact).not.toHaveBeenCalled();
  });

  it("creates exactly one MemoryFact from the reconstructed proof after the DB lock is reserved", async () => {
    const client = dbClient();
    const writeFact = vi.fn(async () => memoryFact());

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "Ada Chen",
      actorType: ActorType.USER,
      attemptItem: attemptItem(),
      sourceProof: sourceProof(),
      manualConfirmation: {
        confirmed: true,
        note: "Reviewed source proof and duplicate guard.",
      },
      now: new Date("2026-04-21T04:16:00.000Z"),
      dbClient: client,
      writeFact,
    });

    expect(result).toMatchObject({
      status: "succeeded",
      createdFact: {
        id: "fact-1",
      },
      canExecuteAutomatically: false,
    });
    expect(writeFact).toHaveBeenCalledTimes(1);
    expect(writeFact).toHaveBeenCalledWith(expect.objectContaining({
      title: "预算复盘 会议摘要",
      sourceType: SourceType.MEETING_NOTE,
      sourceId: "meeting-1",
    }));
    expect(client.memoryWriteRetryLock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockStatus: "succeeded",
          executorStatus: "succeeded",
          memoryFactId: "fact-1",
        }),
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: MEMORY_WRITE_RETRY_EXECUTOR_COMPLETED_AUDIT_ACTION,
        targetType: "MemoryFact",
        targetId: "fact-1",
      }),
    );
  });

  it("records retryable write failures without rerunning the broader meeting memory pipeline", async () => {
    const client = dbClient();
    const writeFact = vi.fn(async () => {
      const error = new Error("Can't reach database server") as Error & { code: string };
      error.code = "P1001";
      throw error;
    });

    const result = await executeMemoryWriteRetry({
      workspaceId: "workspace-1",
      attemptItem: attemptItem(),
      sourceProof: sourceProof(),
      manualConfirmation: {
        confirmed: true,
      },
      dbClient: client,
      writeFact,
    });

    expect(result).toMatchObject({
      status: "failed_retryable",
      createdFact: null,
      canExecuteAutomatically: false,
      writeResult: {
        summary: {
          attemptedFactCount: 1,
          createdFactCount: 0,
          retryableFailureCount: 1,
        },
      },
    });
    expect(writeFact).toHaveBeenCalledTimes(1);
    expect(client.memoryWriteRetryLock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockStatus: "failed_retryable",
          executorStatus: "failed_retryable",
        }),
      }),
    );
  });
});
