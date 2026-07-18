import { ActionType, ApprovalStatus, ActorType, RejectionReasonCode, RiskLevel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceGovernanceMock,
  dbMock,
  auditMock,
  analyticsMock,
  recommendationFeedbackMock,
  policiesMock,
  handoffReceiptMock,
  nextCacheMock,
} = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceGovernedActionManagementServiceAccess: vi.fn(),
    assertWorkspaceGovernedActionReviewServiceAccess: vi.fn(),
    assertWorkspacePolicyServiceAccess: vi.fn(),
  },
  dbMock: {
    $transaction: vi.fn(),
    policyRule: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    actionItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    approvalTask: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    memoryEntry: {
      create: vi.fn(),
    },
    executionReceipt: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    contact: {
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
  analyticsMock: {
    logEvent: vi.fn(),
  },
  recommendationFeedbackMock: {
    submitRecommendationFeedback: vi.fn(),
  },
  policiesMock: {
    resolvePolicyDecision: vi.fn(),
  },
  handoffReceiptMock: {
    writeBiReportHandoffApprovalReceipt: vi.fn(),
    writeBiReportHandoffExecutionReceipt: vi.fn(),
    writeBiReportHandoffRejectionReceipt: vi.fn(),
  },
  nextCacheMock: {
    revalidatePath: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceGovernedActionManagementServiceAccess:
    serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess,
  assertWorkspaceGovernedActionReviewServiceAccess:
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess,
  assertWorkspacePolicyServiceAccess: serviceGovernanceMock.assertWorkspacePolicyServiceAccess,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: analyticsMock.logEvent,
}));

vi.mock("@/lib/recommendations/recommendation-feedback.service", () => ({
  submitRecommendationFeedback: recommendationFeedbackMock.submitRecommendationFeedback,
}));

vi.mock("@/lib/policies", () => ({
  resolvePolicyDecision: policiesMock.resolvePolicyDecision,
}));

vi.mock("@/lib/bi-report-skill/handoff-receipt", () => ({
  writeBiReportHandoffApprovalReceipt: handoffReceiptMock.writeBiReportHandoffApprovalReceipt,
  writeBiReportHandoffExecutionReceipt: handoffReceiptMock.writeBiReportHandoffExecutionReceipt,
  writeBiReportHandoffRejectionReceipt: handoffReceiptMock.writeBiReportHandoffRejectionReceipt,
}));

vi.mock("next/cache", () => ({
  revalidatePath: nextCacheMock.revalidatePath,
}));

import { rejectApprovalTask } from "@/lib/policies/engine";

function buildPendingApprovalTask(overrides?: { recommendationLogId?: string | null }) {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    actionItemId: "action-1",
    status: ApprovalStatus.PENDING,
    isHighRisk: false,
    actionItem: {
      id: "action-1",
      workspaceId: "workspace-1",
      title: "Follow up",
      actionType: ActionType.CREATE_TASK,
      riskLevel: RiskLevel.MEDIUM,
      draftContent: "draft",
      description: "desc",
      recommendationLogId: overrides?.recommendationLogId ?? null,
      contactId: null,
      opportunityId: null,
      meetingId: null,
      metadata: null,
      sourceId: "source-1",
      createdByUserId: null,
      contentAuthorship: null,
    },
  };
}

describe("policy engine rejection taxonomy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (fn) => fn(dbMock));
    dbMock.approvalTask.updateMany.mockResolvedValue({ count: 1 });
    dbMock.actionItem.update.mockResolvedValue({});
    dbMock.memoryEntry.create.mockResolvedValue({});
    dbMock.executionReceipt.findUnique.mockResolvedValue(null);
    dbMock.executionReceipt.create.mockResolvedValue({
      id: "receipt-1",
      subjectType: "ACTION_ITEM",
      subjectId: "action-1",
      outcome: "REJECTED",
      actionTaken: "CREATE_TASK",
      rejectionReasonCode: null,
      evidenceRefs: null,
      qualityScore: 55,
      qualityFlags: null,
    });
  });

  it("persists the classified rejection reason and derives the text from its label", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(buildPendingApprovalTask());

    await rejectApprovalTask("task-1", "Reviewer", "user-2", undefined, {
      actorType: ActorType.USER,
      rejectionReasonCode: RejectionReasonCode.EVIDENCE_MISSING,
    });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rejectionReasonCode: RejectionReasonCode.EVIDENCE_MISSING,
          decisionReason: expect.stringContaining("证据不足"),
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "APPROVAL_REJECTED",
        payload: expect.objectContaining({
          rejectionReasonCode: RejectionReasonCode.EVIDENCE_MISSING,
        }),
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "approval_rejected",
        metadata: expect.objectContaining({
          rejectionReasonCode: RejectionReasonCode.EVIDENCE_MISSING,
        }),
      }),
    );
  });

  it("keeps reviewer-provided free text as the reason while still recording the code", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(buildPendingApprovalTask());

    await rejectApprovalTask("task-1", "Reviewer", "user-2", "客户已明确改期，本周不跟进", {
      actorType: ActorType.USER,
      rejectionReasonCode: RejectionReasonCode.OWNER_DISAGREEMENT,
    });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decisionReason: "客户已明确改期，本周不跟进",
          rejectionReasonCode: RejectionReasonCode.OWNER_DISAGREEMENT,
        }),
      }),
    );
  });

  it("feeds the rejection code into the recommendation learning loop", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({ recommendationLogId: "rec-1" }),
    );

    await rejectApprovalTask("task-1", "Reviewer", "user-2", undefined, {
      actorType: ActorType.USER,
      rejectionReasonCode: RejectionReasonCode.DIAGNOSIS_ERROR,
    });

    expect(recommendationFeedbackMock.submitRecommendationFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendationId: "rec-1",
        rejectionReasonCode: RejectionReasonCode.DIAGNOSIS_ERROR,
      }),
    );
  });

  it("stays backward compatible when no code is supplied", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(buildPendingApprovalTask());

    await rejectApprovalTask("task-1", "Reviewer", "user-2", "需人工重写", {
      actorType: ActorType.USER,
    });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decisionReason: "需人工重写",
          rejectionReasonCode: undefined,
        }),
      }),
    );
  });
});
