import {
  ActorType,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  MembershipStatus,
  WorkspaceRole,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  evaluationMock,
  evidenceMock,
  governanceMock,
  receiptMock,
  ReceiptChangedErrorMock,
  ReceiptNotFoundErrorMock,
  ReceiptSelfVerificationErrorMock,
  supervisionMock,
  DecisionEvaluationErrorMock,
  DecisionGateErrorMock,
  ScopeResolutionErrorMock,
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
  class ScopeResolutionError extends Error {
    readonly reasons: string[];

    constructor(reasons: string[]) {
      super(reasons.join(", "));
      this.reasons = reasons;
    }
  }
  class ReceiptNotFoundError extends Error {}
  class ReceiptSelfVerificationError extends Error {}
  class ReceiptChangedError extends Error {}
  return {
    dbMock: (() => {
      const client = {
        $queryRaw: vi.fn(),
        decisionWorkPacketClaim: { findFirst: vi.fn() },
        membership: { findUnique: vi.fn() },
      };
      return {
        ...client,
        $transaction: vi.fn(
          async (operation: (tx: typeof client) => Promise<unknown>) =>
            operation(client),
        ),
      };
    })(),
    evaluationMock: { evaluateStage1DecisionRecord: vi.fn() },
    evidenceMock: { resolveCaioFdeObservationEvidence: vi.fn() },
    governanceMock: { assertWorkspaceInsightServiceAccess: vi.fn() },
    receiptMock: { verifyExecutionReceipt: vi.fn() },
    ReceiptChangedErrorMock: ReceiptChangedError,
    ReceiptNotFoundErrorMock: ReceiptNotFoundError,
    ReceiptSelfVerificationErrorMock: ReceiptSelfVerificationError,
    supervisionMock: { recordStage1SupervisionSignal: vi.fn() },
    DecisionEvaluationErrorMock: DecisionEvaluationError,
    DecisionGateErrorMock: DecisionGateError,
    ScopeResolutionErrorMock: ScopeResolutionError,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/receipts/execution-receipt.service", () => ({
  ExecutionReceiptNotFoundError: ReceiptNotFoundErrorMock,
  ReceiptChangedDuringVerificationError: ReceiptChangedErrorMock,
  ReceiptSelfVerificationError: ReceiptSelfVerificationErrorMock,
  verifyExecutionReceipt: receiptMock.verifyExecutionReceipt,
}));
vi.mock("./caio-fde-scope-resolver.service", () => ({
  CaioFdeScopeResolutionError: ScopeResolutionErrorMock,
  resolveCaioFdeObservationEvidence:
    evidenceMock.resolveCaioFdeObservationEvidence,
}));
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
  assertWorkspaceInsightServiceAccess:
    governanceMock.assertWorkspaceInsightServiceAccess,
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
      opportunityId: "opportunity-1",
      approvalTask: {
        id: "approval-1",
        workspaceId: "workspace-1",
      },
      executionReceipt: {
        id: "receipt-1",
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
        outcome: ExecutionReceiptOutcome.SUCCESS,
        evidenceRefs: JSON.stringify(["observation-run:run-1"]),
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
      outcomeRef: "observation-run:run-1",
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

function closedWithoutExecutionInput(
  overrides: Record<string, unknown> = {},
) {
  return {
    workspaceId: "workspace-1",
    actionItemId: "action-1",
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
    dbMock.$queryRaw.mockResolvedValue([{ id: "locked" }]);
    dbMock.membership.findUnique.mockResolvedValue({
      status: MembershipStatus.ACTIVE,
      role: WorkspaceRole.OWNER,
    });
    evidenceMock.resolveCaioFdeObservationEvidence.mockResolvedValue({
      runId: "run-1",
      outcome: "SUCCESS",
    });
    governanceMock.assertWorkspaceInsightServiceAccess.mockResolvedValue(
      undefined,
    );
    receiptMock.verifyExecutionReceipt.mockResolvedValue({
      ...claim().actionItem.executionReceipt,
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
      verifiedByUserId: "reviewer-1",
    });
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
    dbMock.$queryRaw.mockResolvedValue([]);
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(null);

    await expect(reconcileStage1TerminalResult(input())).resolves.toEqual({
      kind: "not_stage1",
    });
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("verifies, evaluates and records supervision in one caller-owned transaction", async () => {
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
    expect(dbMock.membership.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "reviewer-1",
        },
      },
      select: { role: true, status: true },
    });
    expect(governanceMock.assertWorkspaceInsightServiceAccess).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "reviewer-1",
      actorType: ActorType.USER,
      english: true,
    });
    expect(receiptMock.verifyExecutionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        subjectId: "action-1",
        verifierUserId: "reviewer-1",
      }),
      expect.objectContaining({ client: expect.any(Object) }),
    );
    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        decisionRecordId: "decision-1",
      }),
      expect.objectContaining({
        client: expect.any(Object),
        governanceAlreadyAsserted: true,
      }),
    );
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
            "observation-run:run-1",
            "evaluation:evaluation:decision-1",
            "memory-fact:memory-1",
            expect.stringMatching(/^stage1-reconciliation:sha256:[a-f0-9]{64}$/),
          ]),
        }),
      }),
      expect.objectContaining({
        client: expect.any(Object),
        governanceAlreadyAsserted: true,
      }),
    );
    expect(
      evaluationMock.evaluateStage1DecisionRecord.mock.invocationCallOrder[0],
    ).toBeLessThan(
      supervisionMock.recordStage1SupervisionSignal.mock.invocationCallOrder[0],
    );
  });

  it("rechecks ACTIVE insight permission inside the locked transaction", async () => {
    dbMock.membership.findUnique.mockResolvedValueOnce({
      status: MembershipStatus.INACTIVE,
      role: WorkspaceRole.OWNER,
    });

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["workspace_insight_permission_required"],
    });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();

    dbMock.membership.findUnique.mockResolvedValueOnce({
      status: MembershipStatus.ACTIVE,
      role: WorkspaceRole.REVIEWER,
    });
    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["workspace_insight_permission_required"],
    });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
  });

  it("rejects a hand-filled result that conflicts with the canonical receipt outcome", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.FAILURE,
          },
        },
      }),
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["business_outcome_receipt_mismatch"],
    });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("fails before every write when the workspace-scoped outcome evidence cannot be resolved", async () => {
    evidenceMock.resolveCaioFdeObservationEvidence.mockRejectedValue(
      new Error("observation_evidence_workspace_mismatch"),
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["observation_evidence_workspace_mismatch"],
    });
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).not.toHaveBeenCalled();
    expect(supervisionMock.recordStage1SupervisionSignal).not.toHaveBeenCalled();
  });

  it("records an unsuccessful business result as an open owner-review signal", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.FAILURE,
          },
        },
      }),
    );
    evidenceMock.resolveCaioFdeObservationEvidence.mockResolvedValue({
      runId: "run-1",
      outcome: "FAILURE",
    });

    await reconcileStage1TerminalResult(
      input({
        outcome: {
          outcomeRef: "observation-run:run-1",
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
      expect.objectContaining({ client: expect.any(Object) }),
    );
  });

  it("keeps PARTIAL_SUCCESS on the existing business-failure reconciliation path", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.PARTIAL_SUCCESS,
          },
        },
      }),
    );
    evidenceMock.resolveCaioFdeObservationEvidence.mockResolvedValue({
      runId: "run-1",
      outcome: "FAILURE",
    });

    await expect(
      reconcileStage1TerminalResult(
        input({
          outcome: {
            outcomeRef: "observation-run:run-1",
            result: "failure",
            followedAiRecommendation: true,
          },
        }),
      ),
    ).resolves.toMatchObject({
      kind: "reconciled",
      terminalKind: "business_outcome",
      receiptOutcome: ExecutionReceiptOutcome.PARTIAL_SUCCESS,
    });

    expect(evidenceMock.resolveCaioFdeObservationEvidence).toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: {
          outcomeRef: "observation-run:run-1",
          result: "failure",
        },
      }),
      expect.any(Object),
    );
  });

  it("closes NOT_EXECUTED without resolving or fabricating a business ObservationRun", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.NOT_EXECUTED,
            evidenceRefs: JSON.stringify(["approval-task:approval-1"]),
          },
        },
      }),
    );

    await expect(
      reconcileStage1TerminalResult(closedWithoutExecutionInput()),
    ).resolves.toMatchObject({
      kind: "reconciled",
      terminalKind: "closed_without_execution",
      receiptOutcome: ExecutionReceiptOutcome.NOT_EXECUTED,
    });

    expect(evidenceMock.resolveCaioFdeObservationEvidence).not.toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        followedAiRecommendation: null,
        outcome: { outcomeRef: null, result: "unknown" },
      }),
      expect.objectContaining({ client: expect.any(Object) }),
    );
    expect(supervisionMock.recordStage1SupervisionSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.objectContaining({
          signalType: "anomaly",
          severity: "warning",
          recommendedRoute: "owner_review",
          status: "open",
          evidenceRefs: expect.not.arrayContaining([
            expect.stringMatching(/^observation-run:/),
          ]),
        }),
        actualState: "closed_without_execution_blocked",
      }),
      expect.objectContaining({ client: expect.any(Object) }),
    );
  });

  it("preserves REJECTED as rejected truth without writing a failure outcome", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.REJECTED,
            evidenceRefs: JSON.stringify(["approval-task:approval-1"]),
          },
        },
      }),
    );

    await reconcileStage1TerminalResult(closedWithoutExecutionInput());

    expect(evidenceMock.resolveCaioFdeObservationEvidence).not.toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: { outcomeRef: null, result: "unknown" },
      }),
      expect.any(Object),
    );
    expect(supervisionMock.recordStage1SupervisionSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        actualState: "closed_without_execution_rejected",
        signal: expect.objectContaining({ status: "open" }),
      }),
      expect.any(Object),
    );
  });

  it("rejects a fabricated business failure for a close-without-execution receipt", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.NOT_EXECUTED,
          },
        },
      }),
    );

    await expect(
      reconcileStage1TerminalResult(
        input({
          outcome: {
            outcomeRef: "observation-run:run-1",
            result: "failure",
            followedAiRecommendation: null,
          },
        }),
      ),
    ).rejects.toMatchObject({
      reasons: ["closed_without_execution_business_outcome_forbidden"],
    });
    expect(evidenceMock.resolveCaioFdeObservationEvidence).not.toHaveBeenCalled();
    expect(receiptMock.verifyExecutionReceipt).not.toHaveBeenCalled();
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

  it("rejects a missing canonical receipt before the atomic write", async () => {
    const withoutReceipt = claim();
    withoutReceipt.actionItem.executionReceipt = null as never;
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValueOnce(
      withoutReceipt,
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["execution_receipt_required"],
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

  it("lets a supervision failure abort the enclosing transaction", async () => {
    supervisionMock.recordStage1SupervisionSignal.mockRejectedValue(
      new DecisionGateErrorMock(["supervision_idempotency_conflict"]),
    );

    await expect(reconcileStage1TerminalResult(input())).rejects.toMatchObject({
      reasons: ["supervision_idempotency_conflict"],
    });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("aborts the no-execution transaction when open supervision cannot commit", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          executionReceipt: {
            ...claim().actionItem.executionReceipt,
            outcome: ExecutionReceiptOutcome.NOT_EXECUTED,
            evidenceRefs: JSON.stringify(["approval-task:approval-1"]),
          },
        },
      }),
    );
    supervisionMock.recordStage1SupervisionSignal.mockRejectedValue(
      new DecisionGateErrorMock(["supervision_idempotency_conflict"]),
    );

    await expect(
      reconcileStage1TerminalResult(closedWithoutExecutionInput()),
    ).rejects.toMatchObject({
      reasons: ["supervision_idempotency_conflict"],
    });
    expect(evidenceMock.resolveCaioFdeObservationEvidence).not.toHaveBeenCalled();
    expect(receiptMock.verifyExecutionReceipt).toHaveBeenCalled();
    expect(evaluationMock.evaluateStage1DecisionRecord).toHaveBeenCalled();
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
