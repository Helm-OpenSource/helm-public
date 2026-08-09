import { WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cacheMock,
  dbMock,
  sessionMock,
  actionGovernanceMock,
  insightGovernanceMock,
  receiptMock,
  reconciliationMock,
  ReconciliationErrorMock,
} = vi.hoisted(() => ({
  cacheMock: { revalidatePath: vi.fn() },
  dbMock: { approvalTask: { findFirst: vi.fn() } },
  sessionMock: { getCurrentWorkspaceSession: vi.fn() },
  actionGovernanceMock: {
    canReviewWorkspaceGovernedActions: vi.fn(),
    getGovernedActionReviewDeniedMessage: vi.fn(),
  },
  insightGovernanceMock: {
    canManageWorkspaceInsights: vi.fn(),
    getInsightGovernanceDeniedMessage: vi.fn(),
  },
  receiptMock: { verifyExecutionReceipt: vi.fn() },
  reconciliationMock: { reconcileStage1TerminalResult: vi.fn() },
  ReconciliationErrorMock: class ReconciliationError extends Error {
    readonly reasons: string[];

    constructor(reasons: string[]) {
      super(`Stage 1 terminal result reconciliation denied: ${reasons.join(", ")}`);
      this.name = "Stage1TerminalResultReconciliationError";
      this.reasons = reasons;
    }
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: cacheMock.revalidatePath }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));
vi.mock("@/lib/auth/action-governance", () => ({
  canReviewWorkspaceGovernedActions:
    actionGovernanceMock.canReviewWorkspaceGovernedActions,
  getGovernedActionReviewDeniedMessage:
    actionGovernanceMock.getGovernedActionReviewDeniedMessage,
}));
vi.mock("@/lib/auth/insight-governance", () => ({
  canManageWorkspaceInsights:
    insightGovernanceMock.canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage:
    insightGovernanceMock.getInsightGovernanceDeniedMessage,
}));
vi.mock("@/lib/auth/settings-governance", () => ({
  canManageWorkspacePolicies: vi.fn(),
  getWorkspaceGovernanceDeniedMessage: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/policies/engine", () => {
  class PolicyError extends Error {}
  return {
    ActionNoLongerBlockableError: PolicyError,
    ActionNoLongerExecutableError: PolicyError,
    HighRiskApprovalIdentityError: PolicyError,
    SelfApprovalNotAllowedError: PolicyError,
    approveApprovalTask: vi.fn(),
    blockApprovedAction: vi.fn(),
    executeActionItem: vi.fn(),
    markApprovalManual: vi.fn(),
    rejectApprovalTask: vi.fn(),
    setActionTypeAutoPolicy: vi.fn(),
  };
});
vi.mock("@/lib/receipts/execution-receipt.service", () => {
  class ReceiptError extends Error {}
  return {
    ExecutionReceiptNotFoundError: ReceiptError,
    ReceiptSelfVerificationError: ReceiptError,
    verifyExecutionReceipt: receiptMock.verifyExecutionReceipt,
  };
});
vi.mock("@/lib/stage1-owner-loop/terminal-result-reconciliation.service", () => ({
  Stage1TerminalResultReconciliationError: ReconciliationErrorMock,
  reconcileStage1TerminalResult:
    reconciliationMock.reconcileStage1TerminalResult,
}));

import { verifyExecutedTaskReceiptAction } from "./actions";

function task(stage1 = false) {
  return {
    id: "approval-1",
    workspaceId: "workspace-1",
    actionItemId: "action-1",
    actionItem: {
      id: "action-1",
      title: "Review delivery risk",
      decisionWorkPacketClaim: stage1
        ? { decisionRecordId: "decision-1" }
        : null,
    },
  };
}

describe("verifyExecutedTaskReceiptAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "reviewer-1", name: "Independent reviewer" },
      membership: { role: WorkspaceRole.OWNER },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    actionGovernanceMock.canReviewWorkspaceGovernedActions.mockReturnValue(true);
    actionGovernanceMock.getGovernedActionReviewDeniedMessage.mockReturnValue(
      "Review denied",
    );
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(true);
    insightGovernanceMock.getInsightGovernanceDeniedMessage.mockReturnValue(
      "Insight management denied",
    );
    dbMock.approvalTask.findFirst.mockResolvedValue(task(false));
    receiptMock.verifyExecutionReceipt.mockResolvedValue({ id: "receipt-1" });
    reconciliationMock.reconcileStage1TerminalResult.mockResolvedValue({
      kind: "reconciled",
    });
  });

  it("keeps generic receipt verification backward compatible", async () => {
    await expect(
      verifyExecutedTaskReceiptAction("approval-1"),
    ).resolves.toEqual({ ok: true });

    expect(receiptMock.verifyExecutionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        subjectId: "action-1",
        verifierUserId: "reviewer-1",
      }),
    );
    expect(reconciliationMock.reconcileStage1TerminalResult).not.toHaveBeenCalled();
  });

  it("fails closed before receipt verification when a Stage 1 result is missing", async () => {
    dbMock.approvalTask.findFirst.mockResolvedValue(task(true));

    await expect(
      verifyExecutedTaskReceiptAction("approval-1"),
    ).resolves.toEqual({
      ok: false,
      error: "A final business outcome and evidence reference are required for this Stage 1 decision.",
    });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
    expect(reconciliationMock.reconcileStage1TerminalResult).not.toHaveBeenCalled();
  });

  it("does not let a receipt-only reviewer write Stage 1 insight state", async () => {
    dbMock.approvalTask.findFirst.mockResolvedValue(task(true));
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "reviewer-1", name: "Independent reviewer" },
      membership: { role: WorkspaceRole.REVIEWER },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    insightGovernanceMock.canManageWorkspaceInsights.mockReturnValue(false);

    const result = await verifyExecutedTaskReceiptAction({
      taskId: "approval-1",
      stage1TerminalResult: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
        followedAiRecommendation: true,
      },
    });

    expect(result).toEqual({ ok: false, error: "Insight management denied" });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
    expect(reconciliationMock.reconcileStage1TerminalResult).not.toHaveBeenCalled();
  });

  it("verifies then reconciles an authorized Stage 1 terminal result", async () => {
    dbMock.approvalTask.findFirst.mockResolvedValue(task(true));

    const result = await verifyExecutedTaskReceiptAction({
      taskId: "approval-1",
      stage1TerminalResult: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
        followedAiRecommendation: true,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(receiptMock.verifyExecutionReceipt).toHaveBeenCalledTimes(1);
    expect(reconciliationMock.reconcileStage1TerminalResult).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      outcome: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
        followedAiRecommendation: true,
      },
      actorName: "Independent reviewer",
      actorUserId: "reviewer-1",
      actorType: "USER",
      english: true,
    });
    expect(
      receiptMock.verifyExecutionReceipt.mock.invocationCallOrder[0],
    ).toBeLessThan(
      reconciliationMock.reconcileStage1TerminalResult.mock
        .invocationCallOrder[0],
    );
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/approvals");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/caio");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(cacheMock.revalidatePath).toHaveBeenCalledWith("/memory");
  });

  it("rejects invalid input and cross-workspace task ids before any write", async () => {
    await expect(
      verifyExecutedTaskReceiptAction({
        taskId: "",
        stage1TerminalResult: {
          outcomeRef: "",
          result: "success",
          followedAiRecommendation: true,
        },
      }),
    ).resolves.toEqual({ ok: false, error: "Invalid parameters" });
    expect(dbMock.approvalTask.findFirst).not.toHaveBeenCalled();

    dbMock.approvalTask.findFirst.mockResolvedValue(null);
    await expect(
      verifyExecutedTaskReceiptAction("other-workspace-task"),
    ).resolves.toEqual({ ok: false, error: "Approval task not found" });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
    expect(reconciliationMock.reconcileStage1TerminalResult).not.toHaveBeenCalled();
  });

  it("rejects raw business-result text before receipt verification", async () => {
    dbMock.approvalTask.findFirst.mockResolvedValue(task(true));

    await expect(
      verifyExecutedTaskReceiptAction({
        taskId: "approval-1",
        stage1TerminalResult: {
          outcomeRef: "raw business result with spaces",
          result: "success",
          followedAiRecommendation: true,
        },
      }),
    ).resolves.toEqual({ ok: false, error: "Invalid parameters" });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
    expect(reconciliationMock.reconcileStage1TerminalResult).not.toHaveBeenCalled();
  });

  it("returns a governed reconciliation conflict as a diagnosable result", async () => {
    dbMock.approvalTask.findFirst.mockResolvedValue(task(true));
    reconciliationMock.reconcileStage1TerminalResult.mockRejectedValue(
      new ReconciliationErrorMock(["decision_not_dispatched"]),
    );

    await expect(
      verifyExecutedTaskReceiptAction({
        taskId: "approval-1",
        stage1TerminalResult: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "success",
          followedAiRecommendation: true,
        },
      }),
    ).resolves.toEqual({
      ok: false,
      error:
        "Stage 1 terminal result reconciliation denied: decision_not_dispatched",
    });
    expect(receiptMock.verifyExecutionReceipt).toHaveBeenCalledTimes(1);
    expect(cacheMock.revalidatePath).not.toHaveBeenCalled();
  });
});
