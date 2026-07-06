import {
  ActionStatus,
  ActionType,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  RejectionReasonCode,
  RiskLevel,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceGovernanceMock,
  dbMock,
  auditMock,
  analyticsMock,
  recommendationFeedbackMock,
  policiesMock,
  handoffReceiptMock,
  executionReceiptMock,
  nextCacheMock,
} = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceGovernedActionManagementServiceAccess: vi.fn(),
    assertWorkspaceGovernedActionReviewServiceAccess: vi.fn(),
    assertWorkspacePolicyServiceAccess: vi.fn(),
  },
  dbMock: {
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
  executionReceiptMock: {
    recordExecutionReceipt: vi.fn(),
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

vi.mock("@/lib/receipts/execution-receipt.service", () => ({
  recordExecutionReceipt: executionReceiptMock.recordExecutionReceipt,
}));

vi.mock("next/cache", () => ({
  revalidatePath: nextCacheMock.revalidatePath,
}));

import { blockApprovedAction, executeActionItem, rejectApprovalTask } from "@/lib/policies/engine";

describe("policy engine execution receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.approvalTask.updateMany.mockResolvedValue({ count: 1 });
    dbMock.actionItem.update.mockResolvedValue({});
    dbMock.approvalTask.update.mockResolvedValue({});
    dbMock.memoryEntry.create.mockResolvedValue({});
  });

  it("records a SUCCESS receipt when an action executes", async () => {
    dbMock.actionItem.findUnique.mockResolvedValue({
      id: "action-1",
      workspaceId: "workspace-1",
      title: "Internal note",
      actionType: ActionType.DRAFT_INTERNAL_NOTE,
      status: ActionStatus.APPROVED,
      riskLevel: RiskLevel.MEDIUM,
      draftContent: "draft",
      description: "desc",
      metadata: null,
      policySnapshot: null,
      recommendationLogId: null,
      contactId: null,
      opportunityId: "opp-1",
      meetingId: null,
      ownerId: null,
      sourceId: "source-1",
      workspace: { id: "workspace-1" },
      opportunity: { id: "opp-1", companyId: null, nextAction: null, dueDate: null },
      contact: null,
      meeting: null,
      approvalTask: {
        id: "task-1",
        status: ApprovalStatus.EXECUTED,
      },
      recommendationLog: null,
    });

    await executeActionItem("action-1", {
      actorName: "Reviewer",
      actorType: ActorType.USER,
      actorUserId: "user-2",
    });

    expect(executionReceiptMock.recordExecutionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        outcome: ExecutionReceiptOutcome.SUCCESS,
        actionTaken: ActionType.DRAFT_INTERNAL_NOTE,
        evidenceRefs: expect.arrayContaining(["approval-task:task-1", "opportunity:opp-1"]),
        executedByUserId: "user-2",
      }),
    );
  });

  it("records a REJECTED receipt with the classified reason on rejection", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue({
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
        recommendationLogId: null,
        contactId: null,
        opportunityId: null,
        meetingId: null,
        metadata: null,
        sourceId: "source-1",
        createdByUserId: null,
        contentAuthorship: null,
      },
    });

    await rejectApprovalTask("task-1", "Reviewer", "user-2", undefined, {
      actorType: ActorType.USER,
      rejectionReasonCode: RejectionReasonCode.BOUNDARY_ERROR,
    });

    expect(executionReceiptMock.recordExecutionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: "action-1",
        outcome: ExecutionReceiptOutcome.REJECTED,
        rejectionReasonCode: RejectionReasonCode.BOUNDARY_ERROR,
        evidenceRefs: expect.arrayContaining(["approval-task:task-1"]),
      }),
    );
  });

  it("records a NOT_EXECUTED receipt when an approved action is blocked", async () => {
    dbMock.actionItem.findUnique.mockResolvedValue({
      id: "action-1",
      workspaceId: "workspace-1",
      title: "Follow up",
      actionType: ActionType.CREATE_TASK,
      riskLevel: RiskLevel.MEDIUM,
      contactId: null,
      opportunityId: null,
      meetingId: null,
      metadata: null,
      sourceId: "source-1",
      approvalTask: { id: "task-1", status: ApprovalStatus.EXECUTED },
      meeting: null,
      opportunity: null,
      contact: null,
    });

    await blockApprovedAction("action-1", "Reviewer", "user-2", "客户暂停项目", {
      actorType: ActorType.USER,
    });

    expect(executionReceiptMock.recordExecutionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: "action-1",
        outcome: ExecutionReceiptOutcome.NOT_EXECUTED,
        note: "客户暂停项目",
      }),
    );
  });
});
