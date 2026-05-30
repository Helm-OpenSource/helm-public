import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, executionLogMock, closureMock } = vi.hoisted(() => ({
  dbMock: {
    biReportBusinessHandoffDecision: {
      findFirst: vi.fn(),
    },
  },
  executionLogMock: {
    createBiReportHandoffExecutionLog: vi.fn(),
    listBiReportHandoffExecutionLogs: vi.fn(),
  },
  closureMock: {
    applyBiReportHandoffReceiptToActionItem: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/bi-report-skill/handoff-execution-log", () => ({
  createBiReportHandoffExecutionLog: executionLogMock.createBiReportHandoffExecutionLog,
  listBiReportHandoffExecutionLogs: executionLogMock.listBiReportHandoffExecutionLogs,
}));

vi.mock("@/lib/bi-report-skill/action-item-closure", () => ({
  applyBiReportHandoffReceiptToActionItem: closureMock.applyBiReportHandoffReceiptToActionItem,
}));

import {
  writeBiReportHandoffApprovalReceipt,
  writeBiReportHandoffExecutionReceipt,
  writeBiReportHandoffRejectionReceipt,
} from "@/lib/bi-report-skill/handoff-receipt";

describe("bi report handoff receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.biReportBusinessHandoffDecision.findFirst.mockResolvedValue(null);
    executionLogMock.listBiReportHandoffExecutionLogs.mockResolvedValue([]);
  });

  it("writes a plan-stage receipt after high-risk handoff approval", async () => {
    executionLogMock.createBiReportHandoffExecutionLog.mockResolvedValue({
      id: "log-approval-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "plan",
      authorUserId: "user-1",
      summary: "高风险经营承接已审批通过，等待执行：跟进回款异常",
      details: {
        source: "approval_task_approved",
      },
      isEffective: null,
      followUpNeeded: true,
      createdAt: "2026-04-23T01:10:00.000Z",
      updatedAt: "2026-04-23T01:10:00.000Z",
    });

    await writeBiReportHandoffApprovalReceipt({
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      actionTitle: "跟进回款异常",
      actionMetadata: JSON.stringify({
        biReportSignalId: "signal-1",
        handoffDecisionId: "decision-1",
        handoffTargetType: "approval",
      }),
      actionSourceId: "bi-report-handoff:decision-1",
      authorUserId: "user-1",
      decisionReason: "已批准待执行",
      editedContent: null,
    });

    expect(executionLogMock.createBiReportHandoffExecutionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        approvalTaskId: "approval-1",
        stage: "plan",
      }),
    );
    expect(closureMock.applyBiReportHandoffReceiptToActionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        actionItemId: "action-1",
        receiptStage: "plan",
        outcome: "approved_pending_execution",
        signalStatus: "actioned",
        executionLogId: "log-approval-1",
      }),
    );
  });

  it("writes a result-stage receipt after high-risk handoff execution", async () => {
    executionLogMock.listBiReportHandoffExecutionLogs.mockResolvedValue([
      {
        id: "log-plan-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        actionItemId: "action-1",
        approvalTaskId: "approval-1",
        stage: "plan",
        authorUserId: "user-1",
        summary: "计划已建立",
        details: null,
        isEffective: null,
        followUpNeeded: true,
        createdAt: "2026-04-23T01:10:00.000Z",
        updatedAt: "2026-04-23T01:10:00.000Z",
      },
    ]);
    executionLogMock.createBiReportHandoffExecutionLog.mockResolvedValue({
      id: "log-result-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "result",
      authorUserId: "user-1",
      summary: "高风险经营承接已执行：跟进回款异常",
      details: {
        source: "approval_task_executed",
      },
      isEffective: null,
      followUpNeeded: true,
      createdAt: "2026-04-23T01:20:00.000Z",
      updatedAt: "2026-04-23T01:20:00.000Z",
    });

    await writeBiReportHandoffExecutionReceipt({
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      actionTitle: "跟进回款异常",
      actionMetadata: JSON.stringify({
        biReportSignalId: "signal-1",
        handoffDecisionId: "decision-1",
        handoffTargetType: "approval",
      }),
      actionSourceId: "bi-report-handoff:decision-1",
      authorUserId: "user-1",
      decisionReason: "已批准后执行",
      editedContent: null,
    });

    expect(executionLogMock.createBiReportHandoffExecutionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        approvalTaskId: "approval-1",
        stage: "result",
      }),
    );
  });

  it("falls back to the handoff decision when action metadata is truncated", async () => {
    dbMock.biReportBusinessHandoffDecision.findFirst.mockResolvedValue({
      id: "decision-1",
      signalId: "signal-1",
      targetType: "approval",
    });
    executionLogMock.createBiReportHandoffExecutionLog.mockResolvedValue({
      id: "log-result-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "result",
      authorUserId: "user-1",
      summary: "高风险经营承接已执行：跟进回款异常",
      details: {
        source: "approval_task_executed",
      },
      isEffective: null,
      followUpNeeded: true,
      createdAt: "2026-04-23T01:20:00.000Z",
      updatedAt: "2026-04-23T01:20:00.000Z",
    });

    await writeBiReportHandoffExecutionReceipt({
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      actionTitle: "跟进回款异常",
      actionMetadata: '{"biReportSignalId":"signal',
      actionSourceId: "bi-report-handoff:decision-1",
      authorUserId: "user-1",
      decisionReason: "已批准后执行",
      editedContent: null,
    });

    expect(dbMock.biReportBusinessHandoffDecision.findFirst).toHaveBeenCalledWith({
      where: {
        id: "decision-1",
        workspaceId: "workspace-1",
      },
      select: {
        id: true,
        signalId: true,
        targetType: true,
      },
    });
    expect(executionLogMock.createBiReportHandoffExecutionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        approvalTaskId: "approval-1",
        stage: "result",
      }),
    );
  });

  it("writes a result-stage receipt when a high-risk handoff approval is rejected", async () => {
    executionLogMock.createBiReportHandoffExecutionLog.mockResolvedValue({
      id: "log-rejected-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "result",
      authorUserId: "user-1",
      summary: "高风险经营承接已被拒绝，等待重写或重新分派：跟进回款异常",
      details: {
        source: "approval_task_rejected",
      },
      isEffective: false,
      followUpNeeded: true,
      createdAt: "2026-04-23T01:20:00.000Z",
      updatedAt: "2026-04-23T01:20:00.000Z",
    });

    await writeBiReportHandoffRejectionReceipt({
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      actionTitle: "跟进回款异常",
      actionMetadata: JSON.stringify({
        biReportSignalId: "signal-1",
        handoffDecisionId: "decision-1",
        handoffTargetType: "approval",
      }),
      actionSourceId: "bi-report-handoff:decision-1",
      authorUserId: "user-1",
      decisionReason: "需人工重写",
    });

    expect(executionLogMock.createBiReportHandoffExecutionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        approvalTaskId: "approval-1",
        stage: "plan",
      }),
    );
    expect(executionLogMock.createBiReportHandoffExecutionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        approvalTaskId: "approval-1",
        stage: "result",
        details: expect.objectContaining({
          source: "approval_task_rejected",
          decisionReason: "需人工重写",
          outcome: "rejected_action_not_executed",
        }),
        isEffective: false,
        followUpNeeded: true,
      }),
    );
  });

  it("does not write a rejection receipt without an auditable author", async () => {
    await writeBiReportHandoffRejectionReceipt({
      workspaceId: "workspace-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      actionTitle: "跟进回款异常",
      actionMetadata: JSON.stringify({
        biReportSignalId: "signal-1",
        handoffDecisionId: "decision-1",
        handoffTargetType: "approval",
      }),
      actionSourceId: "bi-report-handoff:decision-1",
      authorUserId: null,
      decisionReason: "需人工重写",
    });

    expect(executionLogMock.listBiReportHandoffExecutionLogs).not.toHaveBeenCalled();
    expect(executionLogMock.createBiReportHandoffExecutionLog).not.toHaveBeenCalled();
  });
});
