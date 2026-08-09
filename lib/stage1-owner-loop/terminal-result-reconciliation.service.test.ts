import {
  ActorType,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  evaluationMock,
  supervisionMock,
  DecisionEvaluationErrorMock,
  DecisionGateErrorMock,
} = vi.hoisted(() => {
  class DecisionEvaluationError extends Error {
    readonly reasons: string[];

    constructor(reasons: string[]) {
      super(reasons.join(", "));
      this.reasons = reasons;
    }
  }
  class DecisionGateError extends Error {
    readonly reasons: string[];

    constructor(reasons: string[]) {
      super(reasons.join(", "));
      this.reasons = reasons;
    }
  }
  return {
    dbMock: {
      decisionWorkPacketClaim: { findFirst: vi.fn() },
    },
    evaluationMock: { evaluateStage1DecisionRecord: vi.fn() },
    supervisionMock: { recordStage1SupervisionSignal: vi.fn() },
    DecisionEvaluationErrorMock: DecisionEvaluationError,
    DecisionGateErrorMock: DecisionGateError,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("./decision-evaluation.service", () => ({
  Stage1DecisionEvaluationError: DecisionEvaluationErrorMock,
  evaluateStage1DecisionRecord: evaluationMock.evaluateStage1DecisionRecord,
}));
vi.mock("./decision-follow-through.service", () => ({
  Stage1DecisionGateError: DecisionGateErrorMock,
  recordStage1SupervisionSignal:
    supervisionMock.recordStage1SupervisionSignal,
}));
vi.mock("@/lib/auth/service-governance", () => ({
  isWorkspaceServiceGovernanceError: vi.fn(() => false),
}));

import {
  Stage1TerminalResultReconciliationError,
  reconcileStage1TerminalResult,
} from "./terminal-result-reconciliation.service";

function claim(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-1",
    workspaceId: "workspace-1",
    decisionRecordId: "decision-1",
    actionItemId: "action-1",
    decisionRecord: {
      id: "decision-1",
      workspaceId: "workspace-1",
      ownerRef: "owner-1",
    },
    actionItem: {
      id: "action-1",
      workspaceId: "workspace-1",
      approvalTask: {
        id: "approval-1",
        workspaceId: "workspace-1",
      },
      executionReceipt: {
        id: "receipt-1",
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        verificationState: ExecutionReceiptVerificationState.VERIFIED,
      },
    },
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "workspace-1",
    actionItemId: "action-1",
    outcome: {
      outcomeRef: "business-outcome:delivery-recovered",
      result: "success" as const,
      followedAiRecommendation: true,
    },
    actorName: "Independent reviewer",
    actorUserId: "reviewer-1",
    actorType: ActorType.USER,
    english: true,
    ...overrides,
  };
}

describe("Stage 1 terminal result reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(claim());
    evaluationMock.evaluateStage1DecisionRecord.mockResolvedValue({
      created: true,
      evaluation: { evaluationId: "evaluation:decision-1" },
      memoryFact: { id: "memory-1" },
    });
    supervisionMock.recordStage1SupervisionSignal.mockResolvedValue({
      id: "signal-record-1",
      signalKey: "stage1-terminal-result:decision-1",
    });
  });

  it("does nothing for a non-Stage-1 action", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(null);

    await expect(reconcileStage1TerminalResult(input())).resolves.toEqual({
      kind: "not_stage1",
    });
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("evaluates a verified success before recording its deterministic supervision signal", async () => {
    const result = await reconcileStage1TerminalResult(input());

    expect(result).toMatchObject({
      kind: "reconciled",
      decisionRecordId: "decision-1",
    });
    expect(dbMock.decisionWorkPacketClaim.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace-1", actionItemId: "action-1" },
      }),
    );
    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      decisionRecordId: "decision-1",
      followedAiRecommendation: true,
      outcome: {
        outcomeRef: "business-outcome:delivery-recovered",
        result: "success",
      },
      actorName: "Independent reviewer",
      actorUserId: "reviewer-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(supervisionMock.recordStage1SupervisionSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
        signal: expect.objectContaining({
          signalId: "stage1-terminal-result:decision-1",
          tenantRef: "workspace:workspace-1",
          signalType: "opportunity",
          severity: "info",
          recommendedRoute: "watch",
          status: "resolved",
          evidenceRefs: expect.arrayContaining([
            "execution-receipt:receipt-1",
            "business-outcome:delivery-recovered",
            "evaluation:evaluation:decision-1",
            "memory-fact:memory-1",
          ]),
        }),
      }),
    );
    expect(
      evaluationMock.evaluateStage1DecisionRecord.mock.invocationCallOrder[0],
    ).toBeLessThan(
      supervisionMock.recordStage1SupervisionSignal.mock.invocationCallOrder[0],
    );
  });

  it("records an unsuccessful business result as an open owner-review signal", async () => {
    await reconcileStage1TerminalResult(
      input({
        outcome: {
          outcomeRef: "business-outcome:target-missed",
          result: "failure",
          followedAiRecommendation: false,
        },
      }),
    );

    expect(supervisionMock.recordStage1SupervisionSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.objectContaining({
          signalId: "stage1-terminal-result:decision-1",
          signalType: "anomaly",
          severity: "warning",
          recommendedRoute: "owner_review",
          status: "open",
        }),
      }),
    );
  });

  it("replays the same deterministic evaluation and signal inputs", async () => {
    evaluationMock.evaluateStage1DecisionRecord.mockResolvedValue({
      created: false,
      evaluation: { evaluationId: "evaluation:decision-1" },
      memoryFact: { id: "memory-1" },
    });

    await Promise.all([
      reconcileStage1TerminalResult(input()),
      reconcileStage1TerminalResult(input()),
    ]);

    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalledTimes(2);
    expect(supervisionMock.recordStage1SupervisionSignal).toHaveBeenCalledTimes(
      2,
    );
    expect(
      supervisionMock.recordStage1SupervisionSignal.mock.calls[0][0],
    ).toEqual(supervisionMock.recordStage1SupervisionSignal.mock.calls[1][0]);
  });

  it("rejects a cross-workspace claim before either canonical write", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({ workspaceId: "workspace-2" }),
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toEqual(
      expect.objectContaining({
        name: "Stage1TerminalResultReconciliationError",
        reasons: ["workspace_mismatch"],
      }),
    );
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("rejects missing or unverified canonical receipts before either write", async () => {
    const withoutReceipt = claim();
    withoutReceipt.actionItem.executionReceipt = null as never;
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValueOnce(
      withoutReceipt,
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["execution_receipt_required"],
    });

    const unverified = claim();
    unverified.actionItem.executionReceipt.verificationState =
      ExecutionReceiptVerificationState.SELF_REPORTED;
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValueOnce(unverified);

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["verified_execution_receipt_required"],
    });
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("requires a governed user actor and rejects system identity bypass", async () => {
    await expect(
      reconcileStage1TerminalResult(
        input({ actorType: ActorType.SYSTEM, actorUserId: null }),
      ),
    ).rejects.toMatchObject({ reasons: ["actor_user_identity_required"] });
    expect(dbMock.decisionWorkPacketClaim.findFirst).not.toHaveBeenCalled();
  });

  it("rejects missing business-result evidence before reading or writing", async () => {
    await expect(
      reconcileStage1TerminalResult(
        input({
          outcome: {
            outcomeRef: "",
            result: "success",
            followedAiRecommendation: null,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(Stage1TerminalResultReconciliationError);
    expect(dbMock.decisionWorkPacketClaim.findFirst).not.toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("rejects raw business-result text instead of persisting it as a reference", async () => {
    await expect(
      reconcileStage1TerminalResult(
        input({
          outcome: {
            outcomeRef: "raw business result with spaces",
            result: "success",
            followedAiRecommendation: null,
          },
        }),
      ),
    ).rejects.toMatchObject({ reasons: ["business_outcome_ref_invalid"] });
    expect(dbMock.decisionWorkPacketClaim.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes governed downstream conflicts for a diagnosable retry", async () => {
    evaluationMock.evaluateStage1DecisionRecord.mockRejectedValue(
      new DecisionEvaluationErrorMock(["decision_not_dispatched"]),
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      name: "Stage1TerminalResultReconciliationError",
      reasons: ["decision_not_dispatched"],
    });
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();

    evaluationMock.evaluateStage1DecisionRecord.mockResolvedValue({
      created: false,
      evaluation: { evaluationId: "evaluation:decision-1" },
      memoryFact: { id: "memory-1" },
    });
    supervisionMock.recordStage1SupervisionSignal.mockRejectedValue(
      new DecisionGateErrorMock(["supervision_idempotency_conflict"]),
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      name: "Stage1TerminalResultReconciliationError",
      reasons: ["supervision_idempotency_conflict"],
    });
  });
});
