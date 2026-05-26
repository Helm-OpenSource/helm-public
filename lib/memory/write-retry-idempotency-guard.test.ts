import { ActorType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryWriteRetryAttemptLedgerItem } from "@/lib/memory/write-retry-attempt-ledger";
import {
  MEMORY_WRITE_RETRY_DB_LOCK_RESERVED_AUDIT_ACTION,
  reserveMemoryWriteRetryDbLock,
  updateMemoryWriteRetryDbLock,
  type MemoryWriteRetryDbLockRecord,
} from "@/lib/memory/write-retry-idempotency-guard";

const writeAuditLogMock = vi.hoisted(() => vi.fn(async (input: unknown) => ({ id: "audit-1", input })));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

type TestRetryLockDbClient = NonNullable<Parameters<typeof reserveMemoryWriteRetryDbLock>[0]["dbClient"]>;

function attemptItem(overrides: Partial<MemoryWriteRetryAttemptLedgerItem> = {}): MemoryWriteRetryAttemptLedgerItem {
  return {
    id: "retryable-audit:0:retry-contract:retry-receipt:retry-attempt",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    auditId: "retryable-audit",
    targetType: "Meeting",
    targetId: "meeting-1",
    title: "Confirm renewal budget",
    objectType: "OPPORTUNITY",
    objectId: "opp-1",
    factType: "DECISION",
    sourceType: "MEETING_NOTE",
    sourceId: "meeting-1",
    receiptAuditId: "receipt-audit-1",
    receiptStatus: "confirmed_ready_for_executor",
    receiptPayloadStatus: "valid",
    idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
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

function lockRecord(overrides: Partial<MemoryWriteRetryDbLockRecord> = {}): MemoryWriteRetryDbLockRecord {
  return {
    id: "lock-1",
    workspaceId: "workspace-1",
    idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
    retryContractItemId: "retryable-audit:0:retry-contract",
    queueItemId: "retryable-audit:0",
    sourceAuditId: "retryable-audit",
    receiptAuditId: "receipt-audit-1",
    attemptAuditId: "attempt-audit-1",
    targetType: "Meeting",
    targetId: "meeting-1",
    objectType: "OPPORTUNITY",
    objectId: "opp-1",
    factType: "DECISION",
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

function dbClient(overrides: {
  create?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
} = {}): TestRetryLockDbClient {
  return {
    memoryWriteRetryLock: {
      create: overrides.create ?? vi.fn(async () => lockRecord()),
      findUnique: overrides.findUnique ?? vi.fn(async () => null),
      update: overrides.update ?? vi.fn(async () => lockRecord({ attemptCount: 2 })),
    },
  } as unknown as TestRetryLockDbClient;
}

describe("memory write retry idempotency guard", () => {
  beforeEach(() => {
    writeAuditLogMock.mockClear();
  });

  it("reserves a DB-level idempotency lock for a manually confirmed retry gate", async () => {
    const client = dbClient();
    const result = await reserveMemoryWriteRetryDbLock({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "Ada Chen",
      actorType: ActorType.USER,
      attemptItem: attemptItem(),
      manualConfirmationNote: "Operator confirmed source reconstruction proof.",
      sourcePage: "diagnostics",
      now: new Date("2026-04-21T04:00:00.000Z"),
      dbClient: client,
    });

    expect(result).toMatchObject({
      status: "reserved",
      canExecuteAutomatically: false,
      manualConfirmationRequired: true,
    });
    expect(client.memoryWriteRetryLock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
          lockStatus: "reserved",
          executorStatus: "not_started",
          attemptCount: 1,
          attemptLimit: 3,
        }),
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: MEMORY_WRITE_RETRY_DB_LOCK_RESERVED_AUDIT_ACTION,
        targetType: "Meeting",
        targetId: "meeting-1",
        payload: expect.objectContaining({
          canExecuteAutomatically: false,
          manualConfirmationRequired: true,
        }),
      }),
    );
  });

  it("blocks duplicate active locks instead of treating AuditLog attempt state as an executor permission", async () => {
    const existingLock = lockRecord({ lockStatus: "reserved" });
    const client = dbClient({
      create: vi.fn(async () => {
        const error = new Error("Unique constraint failed") as Error & { code: string };
        error.code = "P2002";
        throw error;
      }),
      findUnique: vi.fn(async () => existingLock),
    });

    const result = await reserveMemoryWriteRetryDbLock({
      workspaceId: "workspace-1",
      attemptItem: attemptItem(),
      dbClient: client,
    });

    expect(result).toMatchObject({
      status: "blocked_existing_active_lock",
      lock: null,
      existingLock,
      canExecuteAutomatically: false,
    });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("reuses a retryable failed lock only within the bounded attempt limit", async () => {
    const existingLock = lockRecord({ lockStatus: "failed_retryable", attemptCount: 1, attemptLimit: 3 });
    const update = vi.fn(async () => lockRecord({ lockStatus: "reserved", attemptCount: 2 }));
    const client = dbClient({
      create: vi.fn(async () => {
        const error = new Error("Unique constraint failed") as Error & { code: string };
        error.code = "P2002";
        throw error;
      }),
      findUnique: vi.fn(async () => existingLock),
      update,
    });

    const result = await reserveMemoryWriteRetryDbLock({
      workspaceId: "workspace-1",
      attemptItem: attemptItem({ attemptCount: 1, remainingAttemptCount: 2 }),
      dbClient: client,
    });

    expect(result).toMatchObject({
      status: "reused_for_next_attempt",
      canExecuteAutomatically: false,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockStatus: "reserved",
          attemptCount: 2,
        }),
      }),
    );
  });

  it("blocks reservation when source reconstruction is still required", async () => {
    const client = dbClient();
    const result = await reserveMemoryWriteRetryDbLock({
      workspaceId: "workspace-1",
      attemptItem: attemptItem({
        idempotencyLockStatus: "blocked_source_rebuild_required",
        sourceRebuildGate: {
          ...attemptItem().sourceRebuildGate,
          gateStatus: "manual_rebuild_required",
          missingInputs: ["content", "actor_context", "normalized_value"],
        },
      }),
      dbClient: client,
    });

    expect(result).toMatchObject({
      status: "blocked_source_rebuild_required",
      lock: null,
      canExecuteAutomatically: false,
    });
    expect(client.memoryWriteRetryLock.create).not.toHaveBeenCalled();
  });

  it("updates lock status without creating memory facts", async () => {
    const update = vi.fn(async () =>
      lockRecord({
        lockStatus: "succeeded",
        sourceProofStatus: "ready_for_executor",
        executorStatus: "succeeded",
        memoryFactId: "fact-1",
      }),
    );
    const client = dbClient({ update });

    const lock = await updateMemoryWriteRetryDbLock({
      workspaceId: "workspace-1",
      idempotencyLockKey: "memory-write-retry:opportunity:opp-1:decision:meeting-note:meeting-1:budget",
      targetType: "Meeting",
      targetId: "meeting-1",
      lockStatus: "succeeded",
      sourceProofStatus: "ready_for_executor",
      executorStatus: "succeeded",
      memoryFactId: "fact-1",
      executorPayload: {
        canExecuteAutomatically: false,
      },
      dbClient: client,
    });

    expect(lock).toMatchObject({
      lockStatus: "succeeded",
      memoryFactId: "fact-1",
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "MEMORY_WRITE_RETRY_DB_LOCK_UPDATED",
        payload: expect.objectContaining({
          canExecuteAutomatically: false,
        }),
      }),
    );
  });
});
