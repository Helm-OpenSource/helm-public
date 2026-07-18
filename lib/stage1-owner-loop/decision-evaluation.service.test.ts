import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptVerificationState,
  MemoryFactType,
  MemoryStatus,
  ObjectType,
  RejectionReasonCode,
  SourceType,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, auditMock, serviceGovernanceMock } = vi.hoisted(() => {
  const client = {
    decisionRecord: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    memoryFact: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return {
    dbMock: client,
    auditMock: { writeAuditLog: vi.fn() },
    serviceGovernanceMock: {
      assertWorkspaceInsightServiceAccess: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: auditMock.writeAuditLog }));
vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceInsightServiceAccess:
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess,
}));

import {
  Stage1DecisionEvaluationError,
  evaluateStage1DecisionRecord,
} from "./decision-evaluation.service";

function receipt(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "receipt-1",
    workspaceId: "workspace-1",
    outcome: ExecutionReceiptOutcome.SUCCESS,
    rejectionReasonCode: null,
    verificationState: ExecutionReceiptVerificationState.VERIFIED,
    executedByUserId: "executor-1",
    verifiedByUserId: "reviewer-1",
    updatedAt: new Date("2026-07-18T01:00:00.000Z"),
    ...overrides,
  };
}

function decisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-1",
    workspaceId: "workspace-1",
    decisionKey: "decision-key-1",
    decisionType: "prioritization",
    businessQuestion: "Which delivery risk should be addressed first?",
    problemCategoryRef: "delivery-risk",
    contextRefs: JSON.stringify(["context:weekly-ops"], null, 2),
    knowledgeRefs: JSON.stringify(["knowledge:delivery-policy"], null, 2),
    evidenceRefs: JSON.stringify(["evidence:project-delay"], null, 2),
    policyRefs: JSON.stringify(["policy:review-first"], null, 2),
    receiptRefs: JSON.stringify([], null, 2),
    alternatives: JSON.stringify(["Escalate now", "Observe"], null, 2),
    recommendedOption: "Escalate now",
    confidence: "medium",
    riskLevel: "high",
    allowedActionLevel: "draft_task",
    ownerGate: "approval_required",
    rollbackPath: "Withdraw the work packet before execution",
    ownerConclusion: "Escalate now",
    status: "DISPATCHED",
    validUntil: new Date("2026-08-01T00:00:00.000Z"),
    evaluationJson: null,
    evaluatedAt: null,
    workPacketClaim: {
      workspaceId: "workspace-1",
      actionItem: {
        id: "action-1",
        workspaceId: "workspace-1",
        requiresApproval: true,
        status: ActionStatus.EXECUTED,
        approvalTask: { status: ApprovalStatus.EXECUTED },
        executionReceipt: receipt(),
      },
    },
    ...overrides,
  };
}

describe("Stage 1 decision evaluation runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      (callback: (tx: typeof dbMock) => unknown) => callback(dbMock),
    );
    serviceGovernanceMock.assertWorkspaceInsightServiceAccess.mockResolvedValue(
      undefined,
    );
    dbMock.decisionRecord.updateMany.mockResolvedValue({ count: 1 });
    dbMock.memoryFact.create.mockResolvedValue({ id: "memory-1" });
    auditMock.writeAuditLog.mockResolvedValue({ id: "audit-1" });
  });

  it("persists verified success as a promotion candidate and observed memory", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(decisionRow());

    const result = await evaluateStage1DecisionRecord({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      followedAiRecommendation: true,
      outcome: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
      },
      actorName: "Helm Evaluation Runtime",
      actorType: ActorType.AI,
    });

    expect(result.created).toBe(true);
    expect(result.evaluation).toMatchObject({
      varianceReason: null,
      learnable: true,
      automationImpact: "promote_candidate",
    });
    expect(dbMock.decisionRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "decision-1",
          workspaceId: "workspace-1",
          status: "DISPATCHED",
          evaluationJson: null,
        }),
        data: expect.objectContaining({ status: "EVALUATED" }),
      }),
    );
    expect(dbMock.memoryFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        objectType: ObjectType.ACTION_ITEM,
        objectId: "action-1",
        factType: MemoryFactType.ACTION_PATTERN,
        sourceType: SourceType.SYSTEM_INFERENCE,
        sourceId: "evaluation:decision-key-1",
        status: MemoryStatus.OBSERVED,
        confirmedByUser: false,
        createdBySystem: true,
      }),
    });
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "STAGE1_DECISION_EVALUATED" }),
      { client: dbMock },
    );
  });

  it("flows a structured rejection back as a downgrade candidate", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        workPacketClaim: {
          workspaceId: "workspace-1",
          actionItem: {
            id: "action-1",
            workspaceId: "workspace-1",
            requiresApproval: true,
            status: ActionStatus.BLOCKED,
            approvalTask: { status: ApprovalStatus.REJECTED },
            executionReceipt: receipt({
              outcome: ExecutionReceiptOutcome.REJECTED,
              rejectionReasonCode: RejectionReasonCode.OWNER_DISAGREEMENT,
              verificationState:
                ExecutionReceiptVerificationState.SELF_REPORTED,
            }),
          },
        },
      }),
    );

    const result = await evaluateStage1DecisionRecord({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      followedAiRecommendation: false,
      outcome: {
        outcomeRef: "business-outcome:owner-rejected",
        result: "failure",
      },
      actorName: "Helm Evaluation Runtime",
      actorType: ActorType.AI,
    });

    expect(result.evaluation).toMatchObject({
      varianceReason: "owner_disagreement",
      learnable: true,
      automationImpact: "downgrade_candidate",
    });
    expect(dbMock.memoryFact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: MemoryStatus.OBSERVED,
        confirmedByUser: false,
      }),
    });
  });

  it("refuses to finalize a successful execution before independent verification", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        workPacketClaim: {
          workspaceId: "workspace-1",
          actionItem: {
            id: "action-1",
            workspaceId: "workspace-1",
            requiresApproval: true,
            status: ActionStatus.EXECUTED,
            approvalTask: { status: ApprovalStatus.EXECUTED },
            executionReceipt: receipt({
              verificationState:
                ExecutionReceiptVerificationState.SELF_REPORTED,
            }),
          },
        },
      }),
    );

    await expect(
      evaluateStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      }),
    ).rejects.toMatchObject({ reasons: ["receipt_verification_required"] });

    expect(dbMock.decisionRecord.updateMany).not.toHaveBeenCalled();
    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
  });

  it("refuses an execution receipt that contradicts the action terminal state", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        workPacketClaim: {
          workspaceId: "workspace-1",
          actionItem: {
            id: "action-1",
            workspaceId: "workspace-1",
            requiresApproval: true,
            status: ActionStatus.PENDING_APPROVAL,
            approvalTask: { status: ApprovalStatus.PENDING },
            executionReceipt: receipt(),
          },
        },
      }),
    );

    await expect(
      evaluateStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      }),
    ).rejects.toBeInstanceOf(Stage1DecisionEvaluationError);

    expect(dbMock.decisionRecord.updateMany).not.toHaveBeenCalled();
  });

  it("refuses cross-workspace action and receipt evidence", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        workPacketClaim: {
          workspaceId: "workspace-1",
          actionItem: {
            id: "action-1",
            workspaceId: "workspace-other",
            requiresApproval: true,
            status: ActionStatus.EXECUTED,
            approvalTask: { status: ApprovalStatus.EXECUTED },
            executionReceipt: receipt(),
          },
        },
      }),
    );

    await expect(
      evaluateStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      }),
    ).rejects.toMatchObject({ reasons: ["work_packet_workspace_mismatch"] });

    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
  });

  it("refuses a VERIFIED flag without an independent verifier identity", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        workPacketClaim: {
          workspaceId: "workspace-1",
          actionItem: {
            id: "action-1",
            workspaceId: "workspace-1",
            requiresApproval: true,
            status: ActionStatus.EXECUTED,
            approvalTask: { status: ApprovalStatus.EXECUTED },
            executionReceipt: receipt({
              executedByUserId: "executor-1",
              verifiedByUserId: null,
            }),
          },
        },
      }),
    );

    await expect(
      evaluateStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      }),
    ).rejects.toMatchObject({
      reasons: ["receipt_independent_verifier_required"],
    });

    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
  });

  it("refuses an unsupported business outcome at the runtime boundary", async () => {
    await expect(
      evaluateStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "inconclusive" as never,
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      }),
    ).rejects.toMatchObject({ reasons: ["business_outcome_invalid"] });

    expect(dbMock.decisionRecord.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a forged high-risk execution whose approval never completed", async () => {
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        workPacketClaim: {
          workspaceId: "workspace-1",
          actionItem: {
            id: "action-1",
            workspaceId: "workspace-1",
            requiresApproval: true,
            status: ActionStatus.EXECUTED,
            approvalTask: { status: ApprovalStatus.PENDING },
            executionReceipt: receipt(),
          },
        },
      }),
    );

    await expect(
      evaluateStage1DecisionRecord({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        followedAiRecommendation: true,
        outcome: {
          outcomeRef: "business-outcome:delivery-recovered",
          result: "success",
        },
        actorName: "Helm Evaluation Runtime",
        actorType: ActorType.AI,
      }),
    ).rejects.toMatchObject({ reasons: ["approval_state_mismatch"] });

    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
  });

  it("returns an identical committed evaluation without creating duplicate memory", async () => {
    const evaluation = {
      evaluationId: "evaluation:decision-key-1",
      decisionRef: "decision-key-1",
      problemCategoryRef: "delivery-risk",
      aiRecommendation: "Escalate now",
      humanDecision: "Escalate now",
      finalActionRef: "action-item:action-1",
      outcomeRef: "business-outcome:delivery-recovered",
      receiptRefs: ["execution-receipt:receipt-1"],
      varianceReason: null,
      learnable: true,
      automationImpact: "promote_candidate",
    } as const;
    dbMock.decisionRecord.findFirst.mockResolvedValue(
      decisionRow({
        status: "EVALUATED",
        evaluationJson: JSON.stringify(evaluation, null, 2),
        evaluatedAt: new Date("2026-07-18T02:00:00.000Z"),
      }),
    );
    dbMock.memoryFact.findFirst.mockResolvedValue({ id: "memory-1" });

    const result = await evaluateStage1DecisionRecord({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      followedAiRecommendation: true,
      outcome: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
      },
      actorName: "Helm Evaluation Runtime",
      actorType: ActorType.AI,
    });

    expect(result).toMatchObject({
      created: false,
      evaluation,
      memoryFact: { id: "memory-1" },
    });
    expect(dbMock.decisionRecord.updateMany).not.toHaveBeenCalled();
    expect(dbMock.memoryFact.create).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
  });
});
