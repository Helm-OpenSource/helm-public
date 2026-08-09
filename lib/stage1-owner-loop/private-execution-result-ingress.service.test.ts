import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, receiptMock } = vi.hoisted(() => ({
  dbMock: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    decisionWorkPacketClaim: { findFirst: vi.fn() },
    opportunity: { findFirst: vi.fn() },
    observationSourceRun: { findFirst: vi.fn() },
    actionItem: { updateMany: vi.fn() },
  },
  receiptMock: {
    recordExecutionReceipt: vi.fn(),
    auditExecutionReceiptRecorded: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/receipts/execution-receipt.service", () => receiptMock);

import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import {
  CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
  createCaioProPrivateExecutionResultProjection,
} from "./caio-pro-fde-cross-repo-contract";
import {
  CaioPrivateExecutionResultIngressError,
  ingestCaioPrivateExecutionResultProjection,
} from "./private-execution-result-ingress.service";

const NOW = new Date("2026-08-10T00:00:00.000Z");
const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "token-1",
  workspaceId: "workspace-1",
  userRef: "service:workbuddy-1",
  clientType: "workbuddy",
  deviceRef: "device:workbuddy-1",
  audience: "mcp",
});

function projection() {
  return createCaioProPrivateExecutionResultProjection({
    interfaceVersion: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_VERSION,
    contractRef: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_REF,
    contractHash: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_CONTRACT_HASH,
    evaluatorRevision:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorRevision,
    evaluatorContractRef:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractRef,
    evaluatorContractHash:
      CAIO_PRO_COMPLETION_EVALUATOR_INTERFACE.evaluatorContractHash,
    projectionRef: "private-result:execution-1",
    workspaceRef: "workspace:workspace-1",
    portfolioRef: "opportunity:opportunity-1",
    evidenceSnapshotRef: "observation-run:run-1",
    decisionRecordRef: "decision-record:decision-1",
    actionItemRef: "action-item:action-1",
    approvalTaskRef: "approval-task:approval-1",
    executionProofRefs: ["proof:executor-result-1"],
    receiptOutcome: "SUCCESS",
    actionTaken: "Recorded the governed private executor result.",
    outcome: {
      outcomeRef: "observation-run:run-1",
      result: "success",
      followedAiRecommendation: true,
    },
    recordedAt: "2026-08-09T23:55:00.000Z",
  });
}

function claim(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-1",
    workspaceId: "workspace-1",
    decisionRecordId: "decision-1",
    actionItemId: "action-1",
    decisionRecord: {
      id: "decision-1",
      workspaceId: "workspace-1",
      status: "DISPATCHED",
    },
    actionItem: {
      id: "action-1",
      workspaceId: "workspace-1",
      opportunityId: "opportunity-1",
      status: ActionStatus.APPROVED,
      updatedAt: new Date("2026-08-09T23:50:00.000Z"),
      approvalTask: {
        id: "approval-1",
        workspaceId: "workspace-1",
        status: ApprovalStatus.EXECUTED,
      },
      executionReceipt: null,
    },
    ...overrides,
  };
}

function observationRun() {
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    programId: "program-1",
    sourceId: "source-1",
    authorizationVersion: 2,
    windowStart: new Date("2026-08-09T22:00:00.000Z"),
    windowEnd: new Date("2026-08-10T00:30:00.000Z"),
    status: "SUCCEEDED",
    observedAt: new Date("2026-08-09T23:54:00.000Z"),
    outcome: "SUCCESS",
    evidenceRefs: JSON.stringify([
      "opportunity:opportunity-1",
      "decision-record:decision-1",
      "action-item:action-1",
      "approval-task:approval-1",
      "proof:executor-result-1",
    ]),
    program: {
      id: "program-1",
      workspaceId: "workspace-1",
      status: "ACTIVE",
      revokedAt: null,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      authorizationVersion: 2,
      scopeRefs: JSON.stringify(["opportunity:opportunity-1"]),
    },
    source: {
      id: "source-1",
      workspaceId: "workspace-1",
      programId: "program-1",
      status: "ACTIVE",
    },
  };
}

function canonicalReceipt(input = projection()) {
  return {
    id: "receipt-1",
    workspaceId: "workspace-1",
    subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
    subjectId: "action-1",
    actionItemId: "action-1",
    outcome: ExecutionReceiptOutcome.SUCCESS,
    actionTaken: input.actionTaken,
    evidenceRefs: JSON.stringify([
      input.actionItemRef,
      input.approvalTaskRef,
      input.contentHash,
      input.decisionRecordRef,
      input.evidenceSnapshotRef,
      ...input.executionProofRefs,
      input.portfolioRef,
      input.projectionRef,
    ].sort()),
    rejectionReasonCode: null,
    nextStep: null,
    note: null,
    executedByUserId: null,
    executedByActorType: ActorType.SYSTEM,
    verifiedByUserId: null,
    verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    qualityScore: 100,
    qualityFlags: null,
  };
}

describe("private execution result production ingress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock),
    );
    dbMock.$queryRaw.mockResolvedValue([{ id: "claim-1" }]);
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(claim());
    dbMock.opportunity.findFirst.mockResolvedValue({
      id: "opportunity-1",
      workspaceId: "workspace-1",
    });
    dbMock.observationSourceRun.findFirst.mockResolvedValue(observationRun());
    dbMock.actionItem.updateMany.mockResolvedValue({ count: 1 });
    receiptMock.recordExecutionReceipt.mockResolvedValue(canonicalReceipt());
    receiptMock.auditExecutionReceiptRecorded.mockResolvedValue(undefined);
  });

  it("closes the approved ActionItem and writes through the sole canonical writer", async () => {
    const input = projection();

    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: input,
        now: NOW,
      }),
    ).resolves.toEqual({
      kind: "recorded",
      receiptId: "receipt-1",
      projectionRef: input.projectionRef,
      contentHash: input.contentHash,
    });

    expect(dbMock.actionItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: "action-1",
        workspaceId: "workspace-1",
        status: ActionStatus.APPROVED,
        updatedAt: new Date("2026-08-09T23:50:00.000Z"),
      },
      data: expect.objectContaining({
        status: ActionStatus.EXECUTED,
        executionStatus: "executed",
        executedAt: new Date(input.recordedAt),
      }),
    });
    expect(receiptMock.recordExecutionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
        subjectId: "action-1",
        actionItemId: "action-1",
        outcome: ExecutionReceiptOutcome.SUCCESS,
        actionTaken: input.actionTaken,
        executedByActorType: ActorType.SYSTEM,
        evidenceRefs: expect.arrayContaining([
          input.projectionRef,
          input.contentHash,
          input.evidenceSnapshotRef,
          "proof:executor-result-1",
        ]),
      }),
      { client: dbMock },
    );
    expect(receiptMock.auditExecutionReceiptRecorded).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-1" }),
      canonicalReceipt(),
      { client: dbMock },
    );
  });

  it("returns an exact immutable replay without writing again", async () => {
    const input = projection();
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        decisionRecord: {
          id: "decision-1",
          workspaceId: "workspace-1",
          status: "EVALUATED",
        },
        actionItem: {
          ...claim().actionItem,
          status: ActionStatus.EXECUTED,
          executionReceipt: canonicalReceipt(input),
        },
      }),
    );

    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: input,
        now: NOW,
      }),
    ).resolves.toMatchObject({ kind: "replayed", receiptId: "receipt-1" });
    expect(dbMock.actionItem.updateMany).not.toHaveBeenCalled();
    expect(receiptMock.recordExecutionReceipt).not.toHaveBeenCalled();
  });

  it("rejects a conflicting replay instead of overwriting canonical truth", async () => {
    dbMock.decisionWorkPacketClaim.findFirst.mockResolvedValue(
      claim({
        actionItem: {
          ...claim().actionItem,
          status: ActionStatus.EXECUTED,
          executionReceipt: {
            ...canonicalReceipt(),
            evidenceRefs: JSON.stringify(["private-result:different"]),
          },
        },
      }),
    );

    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: projection(),
        now: NOW,
      }),
    ).rejects.toMatchObject({ reasons: ["projection_replay_conflict"] });
    expect(receiptMock.recordExecutionReceipt).not.toHaveBeenCalled();
  });

  it("fails before a transaction for a non-WorkBuddy principal or workspace drift", async () => {
    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: { ...PRINCIPAL, clientType: "codex" },
        projection: projection(),
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(CaioPrivateExecutionResultIngressError);
    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: {
          ...projection(),
          workspaceRef: "workspace:workspace-2",
        },
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(CaioPrivateExecutionResultIngressError);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("fails closed before a transaction for no-execution and approval-rejection outcomes", async () => {
    for (const receiptOutcome of ["NOT_EXECUTED", "REJECTED"] as const) {
      await expect(
        ingestCaioPrivateExecutionResultProjection({
          principal: PRINCIPAL,
          projection: {
            ...projection(),
            receiptOutcome,
          },
          now: NOW,
        }),
      ).rejects.toMatchObject({
        reasons: ["private_execution_result_projection_invalid"],
      });
    }
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("does not let the caller flip the business result independently of the receipt outcome", async () => {
    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: {
          ...projection(),
          outcome: {
            ...projection().outcome,
            result: "failure",
          },
        },
        now: NOW,
      }),
    ).rejects.toMatchObject({
      reasons: ["private_execution_result_projection_invalid"],
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects evidence that is not bound to the current work packet", async () => {
    dbMock.observationSourceRun.findFirst.mockResolvedValue({
      ...observationRun(),
      evidenceRefs: JSON.stringify([
        "opportunity:opportunity-1",
        "decision-record:decision-1",
        "action-item:action-1",
        "approval-task:approval-1",
      ]),
    });

    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: projection(),
        now: NOW,
      }),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining(["observation_evidence_binding_mismatch"]),
    });
    expect(dbMock.actionItem.updateMany).not.toHaveBeenCalled();
    expect(receiptMock.recordExecutionReceipt).not.toHaveBeenCalled();
  });

  it("rolls the transaction back when the canonical writer fails", async () => {
    const failure = new Error("canonical writer unavailable");
    receiptMock.recordExecutionReceipt.mockRejectedValue(failure);

    await expect(
      ingestCaioPrivateExecutionResultProjection({
        principal: PRINCIPAL,
        projection: projection(),
        now: NOW,
      }),
    ).rejects.toBe(failure);
    expect(receiptMock.auditExecutionReceiptRecorded).not.toHaveBeenCalled();
  });
});
