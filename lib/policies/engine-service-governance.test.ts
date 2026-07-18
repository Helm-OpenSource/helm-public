import { ActionStatus, ActionType, ActorType, ApprovalStatus, RiskLevel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceGovernanceMock,
  dbMock,
  auditMock,
  analyticsMock,
  recommendationFeedbackMock,
  policiesMock,
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

vi.mock("next/cache", () => ({
  revalidatePath: nextCacheMock.revalidatePath,
}));

import {
  approveApprovalTask,
  createGovernedAction,
  executeActionItem,
  markApprovalManual,
  rejectApprovalTask,
  setActionTypeAutoPolicy,
} from "@/lib/policies/engine";

describe("policy engine service governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks governed-action management before creating an action", async () => {
    serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, or operator can create governed actions."),
    );

    await expect(
      createGovernedAction({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
        actionType: ActionType.CREATE_TASK,
        title: "Create follow-up",
        riskLevel: RiskLevel.MEDIUM,
      }),
    ).rejects.toThrow("Only owner, admin, or operator can create governed actions.");

    expect(serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.policyRule.findFirst).not.toHaveBeenCalled();
    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("tolerates missing static generation store during non-request action creation", async () => {
    serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess.mockResolvedValue(undefined);
    dbMock.policyRule.findFirst.mockResolvedValue(null);
    policiesMock.resolvePolicyDecision.mockReturnValue({
      appliedPolicyName: "default",
      appliedPolicyMode: "REVIEW_REQUIRED",
      appliedRiskThreshold: "HIGH",
      mode: "REVIEW_REQUIRED",
      resolvedBy: "risk_level",
      reason: "高风险动作必须审批。",
      requiresApproval: true,
      blocked: false,
    });
    dbMock.actionItem.create.mockResolvedValue({
      id: "action-1",
      status: ActionStatus.PENDING_APPROVAL,
    });
    dbMock.approvalTask.create.mockResolvedValue({
      id: "approval-1",
      status: "PENDING",
      channel: "内部动作",
    });
    dbMock.notification.create.mockResolvedValue({ id: "notification-1" });
    auditMock.writeAuditLog.mockResolvedValue(undefined);
    analyticsMock.logEvent.mockResolvedValue(undefined);
    nextCacheMock.revalidatePath.mockImplementation(() => {
      throw new Error("Invariant: static generation store missing in revalidatePath /dashboard");
    });

    await expect(
      createGovernedAction({
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        actionType: ActionType.CREATE_TASK,
        title: "Create follow-up",
        riskLevel: RiskLevel.CRITICAL,
      }),
    ).resolves.toMatchObject({
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      requiresApproval: true,
    });
  });

  it("uses the supplied transaction client for an atomic review-first action", async () => {
    const transactionClient = {
      policyRule: { findFirst: vi.fn().mockResolvedValue(null) },
      actionItem: {
        create: vi.fn().mockResolvedValue({
          id: "action-tx-1",
          status: ActionStatus.PENDING_APPROVAL,
        }),
      },
      approvalTask: {
        create: vi.fn().mockResolvedValue({
          id: "approval-tx-1",
          status: ApprovalStatus.PENDING,
          channel: "内部动作",
        }),
      },
      notification: { create: vi.fn().mockResolvedValue({ id: "notice-1" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess.mockResolvedValue(
      undefined,
    );
    policiesMock.resolvePolicyDecision.mockReturnValue({
      appliedPolicyName: "default",
      appliedPolicyMode: "REVIEW_REQUIRED",
      appliedRiskThreshold: "HIGH",
      mode: "REVIEW_REQUIRED",
      resolvedBy: "risk_level",
      reason: "High-risk actions require review.",
      requiresApproval: true,
      blocked: false,
    });

    const result = await createGovernedAction(
      {
        workspaceId: "workspace-1",
        actorName: "Owner",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        actionType: ActionType.CREATE_TASK,
        title: "Create governed task",
        riskLevel: RiskLevel.HIGH,
      },
      { client: transactionClient as never },
    );

    expect(result).toMatchObject({
      actionItemId: "action-tx-1",
      approvalTaskId: "approval-tx-1",
    });
    expect(transactionClient.actionItem.create).toHaveBeenCalledOnce();
    expect(transactionClient.approvalTask.create).toHaveBeenCalledOnce();
    expect(transactionClient.notification.create).toHaveBeenCalledOnce();
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(expect.any(Object), {
      client: transactionClient,
    });
    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
    expect(analyticsMock.logEvent).not.toHaveBeenCalled();
    expect(nextCacheMock.revalidatePath).not.toHaveBeenCalled();
  });

  it("re-checks governed-action review before executing an action", async () => {
    dbMock.actionItem.findUnique.mockResolvedValue({
      id: "action-1",
      workspaceId: "workspace-1",
      status: ActionStatus.SUGGESTED,
    });
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, operator, or reviewer can review governed actions."),
    );

    await expect(
      executeActionItem("action-1", {
        actorName: "Reviewer",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, operator, or reviewer can review governed actions.");

    expect(serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.actionItem.update).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("re-checks governed-action review before rejecting approval", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      actionItem: {
        id: "action-1",
        title: "Follow up",
      },
    });
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, operator, or reviewer can review governed actions."),
    );

    await expect(
      rejectApprovalTask("task-1", "Reviewer", "user-1", "No", {
        actorType: ActorType.USER,
        english: false,
      }),
    ).rejects.toThrow("Only owner, admin, operator, or reviewer can review governed actions.");

    expect(dbMock.approvalTask.update).not.toHaveBeenCalled();
    expect(dbMock.actionItem.update).not.toHaveBeenCalled();
  });

  it("re-checks governed-action review before converting approval to manual", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      actionItem: {
        id: "action-1",
        title: "Follow up",
      },
    });
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockRejectedValueOnce(
      new Error("Only owner, admin, operator, or reviewer can review governed actions."),
    );

    await expect(
      markApprovalManual("task-1", "Reviewer", "user-1", {
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only owner, admin, operator, or reviewer can review governed actions.");

    expect(dbMock.approvalTask.update).not.toHaveBeenCalled();
    expect(dbMock.actionItem.update).not.toHaveBeenCalled();
  });

  it("re-checks workspace policy capability before changing auto policy", async () => {
    dbMock.approvalTask.findUnique.mockResolvedValue({
      id: "task-1",
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      actionItem: {
        id: "action-1",
        actionType: "CREATE_TASK",
      },
    });
    serviceGovernanceMock.assertWorkspacePolicyServiceAccess.mockRejectedValueOnce(
      new Error("Only owner or admin can change workspace governance controls"),
    );

    await expect(
      setActionTypeAutoPolicy("task-1", "Owner", "user-1", {
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only owner or admin can change workspace governance controls");

    expect(serviceGovernanceMock.assertWorkspacePolicyServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(dbMock.policyRule.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to approve a task that is no longer pending (no rejected -> approved)", async () => {
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockResolvedValue(undefined);
    dbMock.approvalTask.findUnique.mockResolvedValueOnce({
      id: "task-1",
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      status: ApprovalStatus.REJECTED,
      actionItem: { id: "action-1", title: "Send email" },
    });

    await expect(
      approveApprovalTask("task-1", "Reviewer", "user-1", undefined, { actorType: ActorType.USER }),
    ).rejects.toThrow(/no longer pending/i);
    expect(dbMock.approvalTask.update).not.toHaveBeenCalled();
  });

  it("refuses to execute an action whose approval was rejected", async () => {
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockResolvedValue(undefined);
    dbMock.actionItem.findUnique.mockResolvedValueOnce({
      id: "action-1",
      workspaceId: "workspace-1",
      status: ActionStatus.BLOCKED,
      actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
      metadata: null,
      policySnapshot: null,
      workspace: { id: "workspace-1", defaultLocale: "zh-CN" },
      opportunity: null,
      contact: null,
      meeting: null,
      approvalTask: { id: "task-1", status: ApprovalStatus.REJECTED },
      recommendationLog: null,
    });

    await expect(
      executeActionItem("action-1", { actorName: "Reviewer", actorType: ActorType.USER, actorUserId: "user-1" }),
    ).rejects.toThrow(/关闭状态/);
    expect(dbMock.actionItem.update).not.toHaveBeenCalled();
  });

  it("claims the approval transition atomically and proceeds when it wins", async () => {
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockResolvedValue(undefined);
    dbMock.approvalTask.findUnique.mockResolvedValueOnce({
      id: "task-1",
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      status: ApprovalStatus.PENDING,
      actionItem: { id: "action-1", title: "Send email", draftContent: "hi" },
    });
    dbMock.approvalTask.updateMany.mockResolvedValueOnce({ count: 1 });

    await approveApprovalTask("task-1", "Reviewer", "user-1", undefined, { actorType: ActorType.USER });

    // The transition is a conditional PENDING -> approved write.
    expect(dbMock.approvalTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-1", status: ApprovalStatus.PENDING } }),
    );
    expect(dbMock.actionItem.update).toHaveBeenCalled();
  });

  it("stops without side effects when it loses the concurrent-approve race", async () => {
    serviceGovernanceMock.assertWorkspaceGovernedActionReviewServiceAccess.mockResolvedValue(undefined);
    dbMock.approvalTask.findUnique.mockResolvedValueOnce({
      id: "task-1",
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      status: ApprovalStatus.PENDING,
      actionItem: { id: "action-1", title: "Send email", draftContent: "hi" },
    });
    // Another concurrent approve already flipped it: conditional write matches 0 rows.
    dbMock.approvalTask.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      approveApprovalTask("task-1", "Reviewer", "user-1", undefined, { actorType: ActorType.USER }),
    ).rejects.toThrow(/no longer pending/i);
    expect(dbMock.actionItem.update).not.toHaveBeenCalled();
  });
});
