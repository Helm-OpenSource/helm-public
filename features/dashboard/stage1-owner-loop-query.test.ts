import { Prisma, WorkspaceRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, loadCurrentAcceptedG0ForReadMock } = vi.hoisted(() => ({
  dbMock: {
    $transaction: vi.fn(),
    enterpriseObservationProgram: { findMany: vi.fn() },
    observationSource: { findMany: vi.fn() },
    decisionRecord: { findMany: vi.fn(), groupBy: vi.fn() },
    supervisionSignalRecord: { findMany: vi.fn(), groupBy: vi.fn() },
    decisionWorkPacketClaim: { findMany: vi.fn() },
    caioOperatingQuestionPortfolioHead: { findUnique: vi.fn() },
    caioQuestionSelectionHead: { findUnique: vi.fn() },
    externalAgentConnection: { findMany: vi.fn(async () => []) },
    externalMemoryRecord: { findMany: vi.fn(async () => []) },
    auditLog: { findMany: vi.fn(async () => []) },
  },
  loadCurrentAcceptedG0ForReadMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock(
  "@/lib/stage1-owner-loop/caio-initialization-gate-store.service",
  () => ({
    loadCurrentAcceptedCaioInitializationContextForRead:
      loadCurrentAcceptedG0ForReadMock,
  }),
);

import { getWorkspaceStage1OwnerLoopReadout } from "@/features/dashboard/stage1-owner-loop-query";

describe("getWorkspaceStage1OwnerLoopReadout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(
      (
        callback: (
          tx: typeof dbMock,
        ) => Promise<unknown>,
      ) => callback(dbMock),
    );
    dbMock.enterpriseObservationProgram.findMany.mockResolvedValue([]);
    dbMock.observationSource.findMany.mockResolvedValue([]);
    dbMock.decisionRecord.findMany.mockResolvedValue([]);
    dbMock.decisionRecord.groupBy.mockResolvedValue([]);
    dbMock.supervisionSignalRecord.findMany.mockResolvedValue([]);
    dbMock.supervisionSignalRecord.groupBy.mockResolvedValue([]);
    dbMock.decisionWorkPacketClaim.findMany.mockResolvedValue([]);
    loadCurrentAcceptedG0ForReadMock.mockResolvedValue(null);
    dbMock.caioOperatingQuestionPortfolioHead.findUnique.mockResolvedValue(
      null,
    );
    dbMock.caioQuestionSelectionHead.findUnique.mockResolvedValue(null);
  });

  it("returns null for non-owners without reading owner-loop tables", async () => {
    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.MEMBER,
      }),
    ).resolves.toBeNull();

    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.enterpriseObservationProgram.findMany).not.toHaveBeenCalled();
    expect(
      dbMock.caioOperatingQuestionPortfolioHead.findUnique,
    ).not.toHaveBeenCalled();
    expect(
      dbMock.caioQuestionSelectionHead.findUnique,
    ).not.toHaveBeenCalled();
  });

  it("loads the canonical current G0 inside one repeatable-read snapshot", async () => {
    const now = new Date("2026-07-23T10:30:00.000Z");

    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.OWNER,
        now,
      }),
    ).resolves.not.toBeNull();

    expect(dbMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel:
          Prisma.TransactionIsolationLevel.RepeatableRead,
      }),
    );
    expect(loadCurrentAcceptedG0ForReadMock).toHaveBeenCalledWith(
      dbMock,
      {
        workspaceId: "workspace-1",
        at: now,
      },
    );
    expect(
      dbMock.caioQuestionSelectionHead.findUnique,
    ).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
      include: {
        currentReceipt: {
          include: {
            decisionBindings: {
              include: {
                implementationPlan: true,
              },
              orderBy: { questionId: "asc" },
            },
          },
        },
      },
    });
    expect(dbMock.supervisionSignalRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "workspace-1" }),
      }),
    );
  });

  it("keeps older unresolved critical signals ahead of newer resolved signals", async () => {
    const critical = {
      id: "critical-open",
      signalKey: "signal:critical-open",
      observedFact: "An older critical signal still needs owner attention.",
      severity: "critical",
      status: "open",
      recommendedRoute: "owner_review",
      deadlineOrSla: null,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    };
    const warning = {
      ...critical,
      id: "warning-routed",
      signalKey: "signal:warning-routed",
      severity: "warning",
      status: "routed",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
    };
    const resolved = {
      ...critical,
      id: "resolved-newest",
      signalKey: "signal:resolved-newest",
      severity: "info",
      status: "resolved",
      recommendedRoute: "watch",
      createdAt: new Date("2026-07-23T00:00:00.000Z"),
    };
    dbMock.supervisionSignalRecord.findMany.mockImplementation(
      async (args: { where: { status?: unknown; severity?: unknown } }) => {
        if (args.where.severity === "critical") return [critical];
        if (
          typeof args.where.status === "object" &&
          args.where.status !== null &&
          "in" in args.where.status
        ) {
          return [warning];
        }
        return [resolved];
      },
    );

    const readout = await getWorkspaceStage1OwnerLoopReadout({
      workspaceId: "workspace-1",
      membershipRole: WorkspaceRole.OWNER,
    });

    expect(readout?.supervision.items.map((item) => item.id)).toEqual([
      "critical-open",
      "warning-routed",
      "resolved-newest",
    ]);
    expect(dbMock.supervisionSignalRecord.findMany).toHaveBeenCalledTimes(3);
  });

  it("stops querying lower-priority groups after five unresolved critical signals", async () => {
    const criticalSignals = Array.from({ length: 5 }, (_, index) => ({
      id: `critical-${index}`,
      signalKey: `signal:critical-${index}`,
      observedFact: "Owner attention is still required.",
      severity: "critical",
      status: "open",
      recommendedRoute: "owner_review",
      deadlineOrSla: null,
      createdAt: new Date(`2026-07-${20 + index}T00:00:00.000Z`),
    }));
    dbMock.supervisionSignalRecord.findMany.mockResolvedValue(criticalSignals);

    const readout = await getWorkspaceStage1OwnerLoopReadout({
      workspaceId: "workspace-1",
      membershipRole: WorkspaceRole.OWNER,
    });

    expect(readout?.supervision.items).toHaveLength(5);
    expect(dbMock.supervisionSignalRecord.findMany).toHaveBeenCalledTimes(1);
  });

  it("degrades to null when the additive owner-loop schema is not deployed", async () => {
    dbMock.enterpriseObservationProgram.findMany.mockRejectedValue({
      code: "P2021",
      message: "missing table details must not escape",
    });

    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.OWNER,
      }),
    ).resolves.toBeNull();
  });

  it("does not hide unrelated database failures", async () => {
    const failure = new Error("connection unavailable");
    dbMock.enterpriseObservationProgram.findMany.mockRejectedValue(failure);

    await expect(
      getWorkspaceStage1OwnerLoopReadout({
        workspaceId: "workspace-1",
        membershipRole: WorkspaceRole.OWNER,
      }),
    ).rejects.toBe(failure);
  });
});
