import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, policyMock } = vi.hoisted(() => ({
  dbMock: {
    actionItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  policyMock: {
    createGovernedAction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/policies/engine", () => ({
  createGovernedAction: policyMock.createGovernedAction,
}));

import {
  listBiReportHandoffMaterializations,
  materializeAcceptedBiReportHandoff,
  resolveBiReportHandoffDraft,
} from "@/lib/bi-report-skill/handoff-action";
import type { BiReportBusinessHandoffDecisionRecord, BiReportBusinessSignalRecord } from "@/lib/bi-report-skill/types";

function buildSignal(overrides?: Partial<BiReportBusinessSignalRecord>): BiReportBusinessSignalRecord {
  return {
    id: "signal-1",
    workspaceId: "workspace-1",
    sourceRunId: "run-1",
    skillKey: "bi_repay_daily",
    signalType: "bi_repay_daily.anomaly",
    signalKey: "bi_repay_daily:window-1",
    title: "回款日报预警",
    summary: "回款金额较前一日明显下降。",
    severity: "ALERT",
    continuityStatus: "recurring",
    dimensions: null,
    metrics: null,
    evidence: null,
    recommendedActions: ["复核口径"],
    status: "open",
    ownerUserId: "owner-1",
    ownerUserName: "负责人",
    ownerUserEmail: "owner@example.com",
    createdAt: "2026-04-23T01:00:00.000Z",
    updatedAt: "2026-04-23T01:00:00.000Z",
    ...overrides,
  };
}

function buildDecision(overrides?: Partial<BiReportBusinessHandoffDecisionRecord>): BiReportBusinessHandoffDecisionRecord {
  return {
    id: "decision-1",
    workspaceId: "workspace-1",
    signalId: "signal-1",
    targetType: "action_item",
    status: "accepted",
    reviewedByUserId: "user-1",
    reviewComment: "进入动作层",
    reviewedAt: "2026-04-23T01:05:00.000Z",
    createdAt: "2026-04-23T01:05:00.000Z",
    updatedAt: "2026-04-23T01:05:00.000Z",
    ...overrides,
  };
}

describe("bi report handoff action materialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a matching handoff draft from the signal", () => {
    const draft = resolveBiReportHandoffDraft({
      signal: buildSignal(),
      targetType: "action_item",
    });

    expect(draft?.targetType).toBe("action_item");
    expect(draft?.title).toContain("经营动作");
  });

  it("reuses an existing action item by sourceId", async () => {
    dbMock.actionItem.findFirst.mockResolvedValue({
      id: "action-1",
      approvalTask: {
        id: "approval-1",
      },
    });

    const result = await materializeAcceptedBiReportHandoff({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "操作人",
      signal: buildSignal(),
      decision: buildDecision(),
    });

    expect(policyMock.createGovernedAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      created: false,
      href: "/approvals?approvalId=approval-1",
    });
  });

  it("creates a governed action for an accepted draft", async () => {
    dbMock.actionItem.findFirst.mockResolvedValue(null);
    policyMock.createGovernedAction.mockResolvedValue({
      actionItemId: "action-2",
      approvalTaskId: "approval-2",
      status: "PENDING_APPROVAL",
      requiresApproval: true,
      reason: "高风险动作必须审批。",
    });

    const result = await materializeAcceptedBiReportHandoff({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "操作人",
      signal: buildSignal({ severity: "CRITICAL" }),
      decision: buildDecision({ targetType: "approval" }),
    });

    expect(policyMock.createGovernedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        actionType: "CREATE_TASK",
        approverId: "owner-1",
        sourceId: "bi-report-handoff:decision-1",
        dueDate: expect.any(Date),
        metadata: expect.objectContaining({
          biReportSignalId: "signal-1",
          handoffDecisionId: "decision-1",
          slaPolicy: "bi_report_risk_sla_24h",
          operating_closure: expect.objectContaining({
            source: expect.objectContaining({
              sourceKind: "bi_handoff",
              sourceId: "bi-report-handoff:decision-1",
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual({
      actionItemId: "action-2",
      approvalTaskId: "approval-2",
      created: true,
      href: "/approvals?approvalId=approval-2",
    });
  });

  it("lists accepted handoff materializations and drops unrelated rows", async () => {
    dbMock.actionItem.findMany.mockResolvedValue([
      {
        id: "action-1",
        sourceId: "bi-report-handoff:decision-1",
        title: "跟进回款异常",
        status: "OPEN",
        approvalTask: {
          id: "approval-1",
          status: "PENDING",
        },
        owner: {
          name: "负责人",
        },
        createdAt: new Date("2026-04-23T01:10:00.000Z"),
      },
      {
        id: "action-2",
        sourceId: "bi-report-handoff:unknown",
        title: "无关动作",
        status: "OPEN",
        approvalTask: null,
        owner: null,
        createdAt: new Date("2026-04-23T01:12:00.000Z"),
      },
    ]);

    const result = await listBiReportHandoffMaterializations({
      workspaceId: "workspace-1",
      decisions: [buildDecision()],
    });

    expect(result).toEqual([
      {
        decisionId: "decision-1",
        signalId: "signal-1",
        actionItemId: "action-1",
        actionItemTitle: "跟进回款异常",
        actionStatus: "OPEN",
        approvalTaskId: "approval-1",
        approvalStatus: "PENDING",
        href: "/approvals?approvalId=approval-1",
        createdAt: "2026-04-23T01:10:00.000Z",
        ownerUserName: "负责人",
      },
    ]);
  });

  it("returns null for non-accepted decisions", async () => {
    const result = await materializeAcceptedBiReportHandoff({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      actorName: "操作人",
      signal: buildSignal(),
      decision: buildDecision({ status: "dismissed" }),
    });

    expect(result).toBeNull();
  });
});
