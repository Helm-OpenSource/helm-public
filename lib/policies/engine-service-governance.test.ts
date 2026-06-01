import { ActionStatus, ActionType, ActorType, RiskLevel } from "@prisma/client";
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
});
