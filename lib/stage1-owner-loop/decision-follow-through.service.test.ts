import { ActionStatus, ActorType, ApprovalStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecisionObject } from "@/lib/agentos-decision-supervision/types";
import type { OwnerCommandDraft } from "./types";

const { dbMock, auditMock, serviceGovernanceMock, policyEngineMock } =
  vi.hoisted(() => {
    const client = {
      artifactBundle: { create: vi.fn() },
      decisionRecord: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
      },
      supervisionSignalRecord: { create: vi.fn() },
      decisionWorkPacketClaim: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      actionItem: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      approvalTask: { updateMany: vi.fn() },
      $transaction: vi.fn(),
    };
    return {
      dbMock: client,
      auditMock: { writeAuditLog: vi.fn() },
      serviceGovernanceMock: {
        assertWorkspaceInsightServiceAccess: vi.fn(),
        assertWorkspaceGovernedActionManagementServiceAccess: vi.fn(),
      },
      policyEngineMock: { createGovernedAction: vi.fn() },
    };
  });

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: auditMock.writeAuditLog }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceInsightServiceAccess:
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess,
  assertWorkspaceGovernedActionManagementServiceAccess:
    serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess,
}));
vi.mock("@/lib/policies/engine", () => ({
  createGovernedAction: policyEngineMock.createGovernedAction,
}));

import {
  confirmStage1DecisionRecord,
  createStage1DecisionRecord,
  dispatchStage1DecisionWorkPacket,
  recordStage1SupervisionSignal,
} from "./decision-follow-through.service";

function decision(overrides: Partial<DecisionObject> = {}): DecisionObject {
  return {
    decisionId: "decision-key-1",
    tenantRef: "workspace:workspace-1",
    decisionType: "prioritization",
    businessQuestion: "Which delivery risk should the owner address first?",
    problemCategoryRef: "delivery-risk",
    contextRefs: ["context:weekly-ops"],
    knowledgeRefs: ["knowledge:delivery-policy"],
    evidenceRefs: ["evidence:project-delay"],
    policyRefs: ["policy:review-first"],
    receiptRefs: [],
    alternatives: ["Escalate now", "Observe one more day"],
    recommendedOption: "Escalate now",
    confidence: "medium",
    riskLevel: "high",
    allowedActionLevel: "draft_task",
    ownerGate: "approval_required",
    expiryOrReviewAt: "2026-08-01T00:00:00.000Z",
    rollbackPath: "Withdraw the work packet before execution",
    ...overrides,
  };
}

function decisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-1",
    workspaceId: "workspace-1",
    decisionKey: "decision-key-1",
    businessQuestion: "Which delivery risk should the owner address first?",
    ownerRef: "owner-1",
    ownerConclusion: "Escalate now",
    ownerConfirmedAt: new Date("2026-07-18T00:00:00.000Z"),
    status: "OWNER_CONFIRMED",
    validUntil: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function command(
  overrides: Partial<OwnerCommandDraft> = {},
): OwnerCommandDraft {
  return {
    commandId: "command-1",
    workspaceRef: "workspace:workspace-1",
    decisionRef: "decision-1",
    ownerRef: "owner-1",
    executionTargetRef: "team:delivery",
    goal: "Resolve the highest-priority delivery risk",
    action: "Prepare and execute a recovery plan after approval",
    dueAt: "2026-07-20T00:00:00.000Z",
    acceptanceCriteria: ["Recovery plan is independently verified"],
    evidenceRequirements: ["receipt:delivery-verification"],
    invalidationConditions: ["Customer priority changes"],
    escalationOwnerRef: "owner:operations",
    automationLevel: "assist",
    allowedToolRefs: ["tool:task-draft"],
    externalSideEffects: [],
    policyEnvelopeRef: null,
    status: "owner_confirmed",
    ...overrides,
  };
}

describe("Stage 1 decision follow-through runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      (callback: (tx: typeof dbMock) => unknown) => callback(dbMock),
    );
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess.mockResolvedValue(
      undefined,
    );
    serviceGovernanceMock.assertWorkspaceGovernedActionManagementServiceAccess.mockResolvedValue(
      undefined,
    );
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
    dbMock.actionItem.updateMany.mockResolvedValue({ count: 1 });
    dbMock.approvalTask.updateMany.mockResolvedValue({ count: 1 });
  });

  it("clamps an uncited decision to observation and keeps it in draft", async () => {
    const stored = decisionRow({
      ownerRef: null,
      ownerConclusion: null,
      ownerConfirmedAt: null,
      status: "DRAFT",
      allowedActionLevel: "observe",
    });
    dbMock.decisionRecord.create.mockResolvedValue(stored);

    const result = await createStage1DecisionRecord({
      workspaceId: "workspace-1",
      decision: decision({ knowledgeRefs: [], evidenceRefs: [] }),
      facts: [],
      inferences: [],
      unknowns: ["Source evidence is unavailable"],
      risks: ["Do not dispatch without evidence"],
      actorName: "Helm Decision Runtime",
      actorType: ActorType.AI,
    });

    expect(result).toBe(stored);
    expect(dbMock.decisionRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowedActionLevel: "observe",
          status: "DRAFT",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "STAGE1_DECISION_RECORDED" }),
      { client: dbMock },
    );
  });

  it("persists an expired terminal state before refusing owner confirmation", async () => {
    const expiredAt = new Date("2020-01-01T00:00:00.000Z");
    dbMock.decisionRecord.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        status: "EVIDENCE_READY",
        ownerRef: null,
        ownerConclusion: null,
        ownerConfirmedAt: null,
        validUntil: expiredAt,
      }),
    );
    dbMock.decisionRecord.findUniqueOrThrow.mockResolvedValue(
      decisionRow({ status: "EXPIRED", validUntil: expiredAt }),
    );

    await expect(
      confirmStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        conclusion: "Escalate now",
        actorName: "Owner",
        actorUserId: "owner-1",
      }),
    ).rejects.toMatchObject({ reasons: ["decision_expired"] });

    expect(dbMock.decisionRecord.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { status: "EXPIRED" } }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "STAGE1_DECISION_EXPIRED" }),
      { client: dbMock },
    );
  });

  it("treats a repeated identical owner confirmation as idempotent", async () => {
    const confirmed = decisionRow();
    dbMock.decisionRecord.updateMany.mockResolvedValue({ count: 0 });
    dbMock.decisionRecord.findFirst.mockResolvedValue(confirmed);

    const result = await confirmStage1DecisionRecord({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      conclusion: "Escalate now",
      actorName: "Owner",
      actorUserId: "owner-1",
    });

    expect(result).toBe(confirmed);
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });

  it("returns the existing governed packet after the decision is dispatched", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({ status: "DISPATCHED" }),
    );
    dbMock.decisionWorkPacketClaim.findUnique.mockResolvedValue({
      decisionRecordId: "decision-1",
      actionItemId: "action-1",
    });
    dbMock.actionItem.findFirst.mockResolvedValue({
      id: "action-1",
      approvalTask: { id: "approval-1" },
    });

    const result = await dispatchStage1DecisionWorkPacket({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      command: command(),
      actorName: "Owner",
      actorUserId: "owner-1",
    });

    expect(result).toEqual({
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      created: false,
    });
    expect(policyEngineMock.createGovernedAction).not.toHaveBeenCalled();
  });

  it("dispatches through the existing high-risk review-first action chain", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(decisionRow());
    dbMock.decisionWorkPacketClaim.findUnique.mockResolvedValue(null);
    dbMock.decisionWorkPacketClaim.create.mockResolvedValue({ id: "claim-1" });
    dbMock.decisionRecord.updateMany.mockResolvedValue({ count: 1 });
    policyEngineMock.createGovernedAction.mockResolvedValue({
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
    });

    const result = await dispatchStage1DecisionWorkPacket({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      command: command(),
      actorName: "Owner",
      actorUserId: "owner-1",
    });

    expect(result).toEqual({
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      created: true,
    });
    expect(policyEngineMock.createGovernedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        riskLevel: "HIGH",
        actorType: ActorType.USER,
        contentAuthorship: ActorType.AI,
      }),
    );
    expect(dbMock.decisionRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DISPATCHED" } }),
    );
  });

  it("withdraws a concurrent losing packet and returns the winner", async () => {
    const uniqueError = Object.assign(new Error("duplicate"), {
      code: "P2002",
    });
    dbMock.decisionRecord.findFirst.mockResolvedValue(decisionRow());
    dbMock.decisionWorkPacketClaim.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        decisionRecordId: "decision-1",
        actionItemId: "action-winner",
      });
    dbMock.actionItem.findFirst.mockResolvedValue({
      id: "action-winner",
      approvalTask: { id: "approval-winner" },
    });
    policyEngineMock.createGovernedAction.mockResolvedValue({
      actionItemId: "action-loser",
      approvalTaskId: "approval-loser",
    });
    dbMock.$transaction
      .mockRejectedValueOnce(uniqueError)
      .mockImplementationOnce((callback: (tx: typeof dbMock) => unknown) =>
        callback(dbMock),
      );

    const result = await dispatchStage1DecisionWorkPacket({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      command: command(),
      actorName: "Owner",
      actorUserId: "owner-1",
    });

    expect(result).toEqual({
      actionItemId: "action-winner",
      approvalTaskId: "approval-winner",
      created: false,
    });
    expect(dbMock.actionItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "action-loser" }),
        data: expect.objectContaining({ status: ActionStatus.WITHDRAWN }),
      }),
    );
    expect(dbMock.approvalTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "approval-loser", status: ApprovalStatus.PENDING },
        data: expect.objectContaining({ status: ApprovalStatus.WITHDRAWN }),
      }),
    );
  });

  it("records supervision as advice-only evidence with an audit", async () => {
    const stored = {
      id: "signal-record-1",
      signalKey: "signal-1",
      severity: "warning",
      recommendedRoute: "owner_review",
    };
    dbMock.supervisionSignalRecord.create.mockResolvedValue(stored);

    const result = await recordStage1SupervisionSignal({
      workspaceId: "workspace-1",
      signal: {
        signalId: "signal-1",
        tenantRef: "workspace:workspace-1",
        signalType: "stuck_work",
        observedObjectRef: "action:1",
        baselineRef: "baseline:sla",
        evidenceRefs: ["evidence:overdue"],
        severity: "warning",
        confidence: "medium",
        recommendedRoute: "owner_review",
        ownerRef: "owner-1",
        deadlineOrSla: "2026-07-20T00:00:00.000Z",
        status: "open",
        observedFact: "The action is overdue by two days",
        interpretation: "Delivery may be blocked",
      },
      expectedState: "Completed by SLA",
      actualState: "Still in progress",
      responsibilityScopeRef: "team:delivery",
      escalationCondition: "Escalate if still open tomorrow",
    });

    expect(result).toBe(stored);
    expect(policyEngineMock.createGovernedAction).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "STAGE1_SUPERVISION_SIGNAL_RECORDED",
      }),
      { client: dbMock },
    );
  });
});
