import { ActorType, RevenueLedgerStatus, SettlementBatchStatus, SettlementLineStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { serviceGovernanceMock, revenueAttributionMock, dbMock } = vi.hoisted(() => ({
  serviceGovernanceMock: {
    assertWorkspaceReservedManualSettlementServiceAccess: vi.fn(),
  },
  revenueAttributionMock: {
    ensureWorkspaceRevenueAttributionFoundation: vi.fn(),
    reverseRevenueAttributionEntry: vi.fn(),
  },
  dbMock: {
    settlementBatch: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    settlementBatchLine: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    payoutLedger: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth/service-governance", () => ({
  assertWorkspaceReservedManualSettlementServiceAccess:
    serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess,
}));

vi.mock("@/lib/billing/revenue-attribution", () => ({
  ensureWorkspaceRevenueAttributionFoundation:
    revenueAttributionMock.ensureWorkspaceRevenueAttributionFoundation,
  reverseRevenueAttributionEntry: revenueAttributionMock.reverseRevenueAttributionEntry,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  approveSettlementBatch,
  closeSettlementBatch,
  markSettlementBatchExported,
  markSettlementBatchLinePaid,
  reverseSettlementBatchLine,
} from "@/lib/billing/manual-settlement";

describe("manual settlement lifecycle guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceGovernanceMock.assertWorkspaceReservedManualSettlementServiceAccess.mockResolvedValue(undefined);
    revenueAttributionMock.ensureWorkspaceRevenueAttributionFoundation.mockResolvedValue(undefined);
    revenueAttributionMock.reverseRevenueAttributionEntry.mockResolvedValue(undefined);
    dbMock.$transaction.mockImplementation((fn: (tx: typeof dbMock) => unknown) => fn(dbMock));
  });

  it("blocks approving an already exported settlement batch", async () => {
    dbMock.settlementBatch.findFirst.mockResolvedValueOnce({
      id: "batch-1",
      status: SettlementBatchStatus.EXPORTED,
      lines: [],
    });

    await expect(
      approveSettlementBatch({
        workspaceId: "workspace-1",
        batchId: "batch-1",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only draft settlement batches can be approved");

    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks exporting a batch that is already exported", async () => {
    dbMock.settlementBatch.findFirst.mockResolvedValueOnce({
      id: "batch-1",
      batchKey: "settlement_2026_04",
      status: SettlementBatchStatus.EXPORTED,
      lines: [],
    });

    await expect(
      markSettlementBatchExported({
        workspaceId: "workspace-1",
        batchId: "batch-1",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Settlement batch is already exported");

    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks closing a batch before it has entered exported posture", async () => {
    dbMock.settlementBatch.findFirst.mockResolvedValueOnce({
      id: "batch-1",
      status: SettlementBatchStatus.APPROVED,
      lines: [
        {
          id: "line-1",
          status: SettlementLineStatus.PAID,
        },
      ],
    });

    await expect(
      closeSettlementBatch({
        workspaceId: "workspace-1",
        batchId: "batch-1",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only exported settlement batches can be closed");

    expect(dbMock.settlementBatch.update).not.toHaveBeenCalled();
  });

  it("continues blocking mark-paid on reversed settlement lines", async () => {
    dbMock.settlementBatchLine.findFirst.mockResolvedValueOnce({
      id: "line-1",
      status: SettlementLineStatus.REVERSED,
      payoutLedgerId: "ledger-1",
      payoutLedger: {
        id: "ledger-1",
        status: RevenueLedgerStatus.REVERSED,
      },
    });

    await expect(
      markSettlementBatchLinePaid({
        workspaceId: "workspace-1",
        lineId: "line-1",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Reversed settlement lines cannot be marked paid");

    expect(dbMock.settlementBatchLine.update).not.toHaveBeenCalled();
    expect(dbMock.payoutLedger.update).not.toHaveBeenCalled();
  });

  it("blocks mark-paid before the settlement line has been exported", async () => {
    dbMock.settlementBatchLine.findFirst.mockResolvedValueOnce({
      id: "line-1",
      status: SettlementLineStatus.APPROVED,
      payoutLedgerId: "ledger-1",
      payoutLedger: {
        id: "ledger-1",
        status: RevenueLedgerStatus.APPROVED,
      },
    });

    await expect(
      markSettlementBatchLinePaid({
        workspaceId: "workspace-1",
        lineId: "line-1",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only exported settlement lines can be marked paid");

    expect(dbMock.settlementBatchLine.update).not.toHaveBeenCalled();
    expect(dbMock.payoutLedger.update).not.toHaveBeenCalled();
  });

  it("blocks reversal before the settlement line has been exported", async () => {
    dbMock.settlementBatchLine.findFirst.mockResolvedValueOnce({
      id: "line-1",
      status: SettlementLineStatus.APPROVED,
      payoutLedgerId: "ledger-1",
      payoutLedger: {
        id: "ledger-1",
        status: RevenueLedgerStatus.APPROVED,
        revenueAttributionLedgerId: "attr-1",
      },
    });

    await expect(
      reverseSettlementBatchLine({
        workspaceId: "workspace-1",
        lineId: "line-1",
        reason: "Approval should not reverse before export",
        actorUserId: "user-1",
        actorType: ActorType.USER,
        english: true,
      }),
    ).rejects.toThrow("Only exported or paid settlement lines can be reversed");

    expect(revenueAttributionMock.reverseRevenueAttributionEntry).not.toHaveBeenCalled();
    expect(dbMock.settlementBatchLine.update).not.toHaveBeenCalled();
  });
});
