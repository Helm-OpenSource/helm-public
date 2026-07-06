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
      upsert: vi.fn(),
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
  ReceiptSelfVerificationError,
  recordExecutionReceipt,
  verifyExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";

describe("execution receipt service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.executionReceipt.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "receipt-1",
      ...args.create,
    }));
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

    expect(dbMock.executionReceipt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subjectType_subjectId: {
            subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
            subjectId: "action-1",
          },
        },
        create: expect.objectContaining({
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
    });
    dbMock.executionReceipt.update.mockResolvedValue({ id: "receipt-1" });

    await verifyExecutionReceipt({
      workspaceId: "workspace-1",
      subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
      subjectId: "action-1",
      verifierUserId: "user-2",
      verifierName: "Reviewer",
    });

    expect(dbMock.executionReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "receipt-1" },
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
