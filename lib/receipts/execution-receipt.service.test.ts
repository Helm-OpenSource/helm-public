import {
  ActorType,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  RejectionReasonCode,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock } = vi.hoisted(() => ({
  dbMock: {
    executionReceipt: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

import {
  type ExecutionReceiptDbClient,
  ReceiptChangedDuringVerificationError,
  ReceiptSelfVerificationError,
  recordExecutionReceipt,
  verifyExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";

describe("execution receipt service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.executionReceipt.findUnique.mockResolvedValue(null);
    dbMock.executionReceipt.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: "receipt-1",
        ...args.data,
      }),
    );
    dbMock.executionReceipt.updateMany.mockResolvedValue({ count: 1 });
  });

  it("upserts one canonical receipt per subject with a computed quality score", async () => {
    await recordExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.REJECTED,
      actionTaken: "CREATE_TASK",
      evidenceRefs: ["approval-task:task-1", "  "],
      rejectionReasonCode: RejectionReasonCode.DIAGNOSIS_ERROR,
      note: "判断不成立",
      executedByUserId: "user-2",
      executedByActorType: ActorType.USER,
      actorName: "Reviewer",
    });

    expect(dbMock.executionReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: ExecutionReceiptOutcome.REJECTED,
          rejectionReasonCode: RejectionReasonCode.DIAGNOSIS_ERROR,
          evidenceRefs: JSON.stringify(["approval-task:task-1"], null, 2),
          verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
          qualityScore: expect.any(Number),
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EXECUTION_RECEIPT_RECORDED",
        payload: expect.objectContaining({
          outcome: ExecutionReceiptOutcome.REJECTED,
          evidenceRefCount: 1,
        }),
      }),
    );
  });

  it("never overwrites or downgrades an already VERIFIED receipt", async () => {
    const verified = {
      id: "receipt-verified",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: JSON.stringify(["evidence:accepted"]),
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
      verifiedByUserId: "user-2",
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
      qualityScore: 100,
      qualityFlags: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbMock.executionReceipt.findUnique.mockResolvedValue(verified);

    const result = await recordExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.FAILURE,
      actionTaken: "CREATE_TASK",
      executedByUserId: "user-3",
      executedByActorType: ActorType.USER,
    });

    expect(result).toBe(verified);
    expect(dbMock.executionReceipt.updateMany).not.toHaveBeenCalled();
    expect(dbMock.executionReceipt.create).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("does not claim an audit write when verification wins the update race", async () => {
    const selfReported = {
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      qualityScore: 40,
      qualityFlags: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const verified = {
      ...selfReported,
      verifiedByUserId: "user-2",
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
      qualityScore: 80,
    };
    dbMock.executionReceipt.findUnique.mockResolvedValue(selfReported);
    dbMock.executionReceipt.updateMany.mockResolvedValue({ count: 0 });
    dbMock.executionReceipt.findUniqueOrThrow.mockResolvedValue(verified);

    const result = await recordExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.FAILURE,
      actionTaken: "CREATE_TASK",
      executedByUserId: "user-3",
      executedByActorType: ActorType.USER,
    });

    expect(result).toBe(verified);
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("re-reads the canonical receipt when a standalone record write conflicts with verification", async () => {
    const updatedAt = new Date("2026-07-18T00:00:00.000Z");
    const selfReported = {
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      qualityScore: 40,
      qualityFlags: null,
      createdAt: updatedAt,
      updatedAt,
    };
    const verified = {
      ...selfReported,
      verifiedByUserId: "user-2",
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
      qualityScore: 80,
      updatedAt: new Date("2026-07-18T00:00:01.000Z"),
    };
    dbMock.executionReceipt.findUnique.mockResolvedValue(selfReported);
    dbMock.executionReceipt.updateMany
      .mockRejectedValueOnce(
        new Error(
          "Record has changed since last read in table 'executionreceipt'",
        ),
      )
      .mockResolvedValueOnce({ count: 0 });
    dbMock.executionReceipt.findUniqueOrThrow.mockResolvedValue(verified);

    const result = await recordExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.FAILURE,
      actionTaken: "CREATE_TASK",
      executedByUserId: "user-3",
      executedByActorType: ActorType.USER,
    });

    expect(result).toBe(verified);
    expect(dbMock.executionReceipt.findUnique).toHaveBeenCalledTimes(1);
    expect(dbMock.executionReceipt.updateMany).toHaveBeenCalledTimes(2);
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("retries a standalone create conflict and writes one audit entry", async () => {
    const created = {
      id: "receipt-created",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-create",
      actionItemId: "action-create",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      qualityScore: 40,
      qualityFlags: null,
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      updatedAt: new Date("2026-07-18T00:00:00.000Z"),
    };
    dbMock.executionReceipt.create
      .mockRejectedValueOnce(
        new Error(
          "Record has changed since last read in table 'executionreceipt'",
        ),
      )
      .mockResolvedValueOnce(created);

    const result = await recordExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-create",
      actionItemId: "action-create",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
    });

    expect(result).toBe(created);
    expect(dbMock.executionReceipt.create).toHaveBeenCalledTimes(2);
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("retries the raced update after a concurrent canonical create", async () => {
    const updatedAt = new Date("2026-07-18T00:00:00.000Z");
    const raced = {
      id: "receipt-raced",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-raced",
      actionItemId: "action-raced",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      qualityScore: 40,
      qualityFlags: null,
      createdAt: updatedAt,
      updatedAt,
    };
    const updated = {
      ...raced,
      outcome: ExecutionReceiptOutcome.FAILURE,
      executedByUserId: "user-2",
      updatedAt: new Date("2026-07-18T00:00:01.000Z"),
    };
    const uniqueError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    dbMock.executionReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(raced);
    dbMock.executionReceipt.create.mockRejectedValueOnce(uniqueError);
    dbMock.executionReceipt.updateMany
      .mockRejectedValueOnce(
        new Error(
          "Record has changed since last read in table 'executionreceipt'",
        ),
      )
      .mockResolvedValueOnce({ count: 1 });
    dbMock.executionReceipt.findUniqueOrThrow.mockResolvedValue(updated);

    const result = await recordExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-raced",
      actionItemId: "action-raced",
      outcome: ExecutionReceiptOutcome.FAILURE,
      actionTaken: "CREATE_TASK",
      executedByUserId: "user-2",
      executedByActorType: ActorType.USER,
    });

    expect(result).toBe(updated);
    expect(dbMock.executionReceipt.create).toHaveBeenCalledTimes(1);
    expect(dbMock.executionReceipt.updateMany).toHaveBeenCalledTimes(2);
    expect(auditMock.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("does not locally retry a caller-owned transaction mutation", async () => {
    const updatedAt = new Date("2026-07-18T00:00:00.000Z");
    dbMock.executionReceipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      actionItemId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      executedByActorType: ActorType.USER,
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      qualityScore: 40,
      qualityFlags: null,
      createdAt: updatedAt,
      updatedAt,
    });
    dbMock.executionReceipt.updateMany.mockRejectedValue(
      new Error("Record has changed since last read in table 'executionreceipt'"),
    );
    const transactionClient = dbMock as unknown as ExecutionReceiptDbClient;

    await expect(
      recordExecutionReceipt(
        {
          workspaceId: "workspace-1",
          subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
          subjectId: "action-1",
          actionItemId: "action-1",
          outcome: ExecutionReceiptOutcome.FAILURE,
          actionTaken: "CREATE_TASK",
          executedByUserId: "user-3",
          executedByActorType: ActorType.USER,
        },
        { client: transactionClient },
      ),
    ).rejects.toThrow("Record has changed since last read");

    expect(dbMock.executionReceipt.findUnique).toHaveBeenCalledTimes(1);
    expect(dbMock.executionReceipt.updateMany).toHaveBeenCalledTimes(1);
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("refuses executor self-verification", async () => {
    dbMock.executionReceipt.findFirst.mockResolvedValue({
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    });

    await expect(
      verifyExecutionReceipt({
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        verifierUserId: "user-1",
        verifierName: "Executor",
      }),
    ).rejects.toBeInstanceOf(ReceiptSelfVerificationError);

    expect(dbMock.executionReceipt.update).not.toHaveBeenCalled();
  });

  it("upgrades a receipt to VERIFIED when a different reviewer confirms it", async () => {
    const updatedAt = new Date("2026-07-18T00:00:00.000Z");
    dbMock.executionReceipt.findFirst.mockResolvedValue({
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: JSON.stringify(["meeting:m-1"]),
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      updatedAt,
    });
    dbMock.executionReceipt.updateMany.mockResolvedValue({ count: 1 });
    dbMock.executionReceipt.findUniqueOrThrow.mockResolvedValue({
      id: "receipt-1",
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
    });

    await verifyExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      verifierUserId: "user-2",
      verifierName: "Reviewer",
    });

    expect(dbMock.executionReceipt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "receipt-1",
          workspaceId: "workspace-1",
          verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
          updatedAt,
        },
        data: expect.objectContaining({
          verifiedByUserId: "user-2",
          verificationState: ExecutionReceiptVerificationState.VERIFIED,
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "EXECUTION_RECEIPT_VERIFIED" }),
    );
  });

  it("requires a fresh review when the receipt changes during verification", async () => {
    const updatedAt = new Date("2026-07-18T00:00:00.000Z");
    const changedAt = new Date("2026-07-18T00:00:01.000Z");
    dbMock.executionReceipt.findFirst.mockResolvedValue({
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: JSON.stringify(["meeting:m-1"]),
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      updatedAt,
    });
    dbMock.executionReceipt.updateMany.mockResolvedValue({ count: 0 });
    dbMock.executionReceipt.findUniqueOrThrow.mockResolvedValue({
      id: "receipt-1",
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      updatedAt: changedAt,
    });

    await expect(
      verifyExecutionReceipt({
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        verifierUserId: "user-2",
        verifierName: "Reviewer",
      }),
    ).rejects.toBeInstanceOf(ReceiptChangedDuringVerificationError);

    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("converges a database write conflict to the latest receipt state", async () => {
    const updatedAt = new Date("2026-07-18T00:00:00.000Z");
    dbMock.executionReceipt.findFirst.mockResolvedValue({
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: JSON.stringify(["meeting:m-1"]),
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      verifiedByUserId: null,
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      updatedAt,
    });
    dbMock.executionReceipt.updateMany
      .mockRejectedValueOnce(
        new Error("Record has changed since last read in table 'executionreceipt'"),
      )
      .mockResolvedValueOnce({ count: 0 });
    dbMock.executionReceipt.findUniqueOrThrow.mockResolvedValue({
      id: "receipt-1",
      verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
      updatedAt: new Date("2026-07-18T00:00:01.000Z"),
    });

    await expect(
      verifyExecutionReceipt({
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        verifierUserId: "user-2",
        verifierName: "Reviewer",
      }),
    ).rejects.toBeInstanceOf(ReceiptChangedDuringVerificationError);

    expect(dbMock.executionReceipt.updateMany).toHaveBeenCalledTimes(2);
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("is idempotent for the same verifier", async () => {
    dbMock.executionReceipt.findFirst.mockResolvedValue({
      id: "receipt-1",
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      outcome: ExecutionReceiptOutcome.SUCCESS,
      actionTaken: "CREATE_TASK",
      evidenceRefs: null,
      rejectionReasonCode: null,
      nextStep: null,
      note: null,
      executedByUserId: "user-1",
      verifiedByUserId: "user-2",
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
    });

    await verifyExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      verifierUserId: "user-2",
      verifierName: "Reviewer",
    });

    expect(dbMock.executionReceipt.update).not.toHaveBeenCalled();
  });
});
