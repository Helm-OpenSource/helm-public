import { ActionStatus, ActionType, ActorType, ApprovalStatus, RiskLevel } from "@prisma/client";
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

import {
  approveApprovalTask,
  createGovernedAction,
  HighRiskApprovalIdentityError,
  SelfApprovalNotAllowedError,
} from "@/lib/policies/engine";

function buildPendingApprovalTask(overrides?: {
  isHighRisk?: boolean;
  createdByUserId?: string | null;
  contentAuthorship?: ActorType | null;
}) {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    actionItemId: "action-1",
    status: ApprovalStatus.PENDING,
    isHighRisk: overrides?.isHighRisk ?? false,
    actionItem: {
      id: "action-1",
      workspaceId: "workspace-1",
      title: "Follow up",
      actionType: ActionType.CREATE_TASK,
      riskLevel: overrides?.isHighRisk ? RiskLevel.HIGH : RiskLevel.MEDIUM,
      draftContent: "draft",
      description: "desc",
      recommendationLogId: null,
      contactId: null,
      opportunityId: null,
      meetingId: null,
      metadata: null,
      sourceId: "source-1",
      createdByUserId: overrides?.createdByUserId ?? null,
      contentAuthorship: overrides?.contentAuthorship ?? null,
    },
  };
}

describe("policy engine separation of duties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.approvalTask.updateMany.mockResolvedValue({ count: 1 });
    dbMock.actionItem.update.mockResolvedValue({});
  });

  it("persists creator attribution and defaults content authorship to AI", async () => {
    policiesMock.resolvePolicyDecision.mockReturnValue({
      mode: "REQUIRES_APPROVAL",
      requiresApproval: true,
      blocked: false,
      reason: "requires approval",
      appliedPolicyName: null,
      appliedPolicyMode: null,
      appliedRiskThreshold: null,
      resolvedBy: "default",
    });
    dbMock.policyRule.findFirst.mockResolvedValue(null);
    dbMock.actionItem.create.mockResolvedValue({ id: "action-1", status: ActionStatus.PENDING_APPROVAL });
    dbMock.approvalTask.create.mockResolvedValue({ id: "task-1", channel: "内部动作" });
    dbMock.notification.create.mockResolvedValue({});

    await createGovernedAction({
      workspaceId: "workspace-1",
      actorName: "Owner",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      actionType: ActionType.CREATE_TASK,
      title: "Create follow-up",
      riskLevel: RiskLevel.MEDIUM,
    });

    expect(dbMock.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: "user-1",
          // The actor clicked the button, but the content is AI-composed:
          // authorship must not be inferred from actorType.
          contentAuthorship: ActorType.AI,
        }),
      }),
    );
  });

  it("stores an explicit human content-authorship declaration", async () => {
    policiesMock.resolvePolicyDecision.mockReturnValue({
      mode: "SUGGEST_ONLY",
      requiresApproval: false,
      blocked: false,
      reason: "suggest only",
      appliedPolicyName: null,
      appliedPolicyMode: null,
      appliedRiskThreshold: null,
      resolvedBy: "default",
    });
    dbMock.policyRule.findFirst.mockResolvedValue(null);
    dbMock.actionItem.create.mockResolvedValue({ id: "action-1", status: ActionStatus.SUGGESTED });

    await createGovernedAction({
      workspaceId: "workspace-1",
      actorName: "Owner",
      actorUserId: "user-1",
      actorType: ActorType.USER,
      actionType: ActionType.CREATE_TASK,
      title: "Hand-written follow-up",
      riskLevel: RiskLevel.LOW,
      contentAuthorship: ActorType.USER,
    });

    expect(dbMock.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: "user-1",
          contentAuthorship: ActorType.USER,
        }),
      }),
    );
  });

  it("blocks the author from approving their own human-authored high-risk action", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({
        isHighRisk: true,
        createdByUserId: "user-1",
        contentAuthorship: ActorType.USER,
      }),
    );

    await expect(
      approveApprovalTask("task-1", "Owner", "user-1", undefined, { actorType: ActorType.USER }),
    ).rejects.toBeInstanceOf(SelfApprovalNotAllowedError);

    expect(dbMock.approvalTask.updateMany).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("lets the triggering human approve AI-authored high-risk content, recording selfApproval", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({
        isHighRisk: true,
        createdByUserId: "user-1",
        contentAuthorship: ActorType.AI,
      }),
    );

    await approveApprovalTask("task-1", "Owner", "user-1", undefined, { actorType: ActorType.USER });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalled();
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "APPROVAL_APPROVED",
        payload: expect.objectContaining({ selfApproval: true, contentAuthorship: ActorType.AI }),
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "approval_approved",
        metadata: expect.objectContaining({ selfApproval: true }),
      }),
    );
  });

  it("lets a different reviewer approve a human-authored high-risk action", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({
        isHighRisk: true,
        createdByUserId: "user-1",
        contentAuthorship: ActorType.USER,
      }),
    );

    await approveApprovalTask("task-1", "Reviewer", "user-2", undefined, { actorType: ActorType.USER });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", status: ApprovalStatus.PENDING },
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ selfApproval: false }),
      }),
    );
  });

  it("requires a real user identity for high-risk approvals", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({ isHighRisk: true, createdByUserId: null, contentAuthorship: ActorType.AI }),
    );

    await expect(
      approveApprovalTask("task-1", "System", "user-9", undefined, { actorType: ActorType.SYSTEM }),
    ).rejects.toBeInstanceOf(HighRiskApprovalIdentityError);

    await expect(
      approveApprovalTask("task-1", "Reviewer", null, undefined, { actorType: ActorType.USER }),
    ).rejects.toBeInstanceOf(HighRiskApprovalIdentityError);

    expect(dbMock.approvalTask.updateMany).not.toHaveBeenCalled();
  });

  it("allows but records self-approval of human-authored non-high-risk actions", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({
        isHighRisk: false,
        createdByUserId: "user-1",
        contentAuthorship: ActorType.USER,
      }),
    );

    await approveApprovalTask("task-1", "Owner", "user-1", undefined, { actorType: ActorType.USER });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalled();
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "APPROVAL_APPROVED",
        payload: expect.objectContaining({ selfApproval: true, createdByUserId: "user-1" }),
      }),
    );
  });

  it("keeps legacy rows without creator attribution approvable", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue(
      buildPendingApprovalTask({ isHighRisk: true, createdByUserId: null, contentAuthorship: null }),
    );

    await approveApprovalTask("task-1", "Reviewer", "user-2", undefined, { actorType: ActorType.USER });

    expect(dbMock.approvalTask.updateMany).toHaveBeenCalled();
  });
});
