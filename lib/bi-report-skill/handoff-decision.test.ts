import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    biReportBusinessHandoffDecision: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  createBiReportBusinessHandoffDecision,
  dismissOpenBiReportBusinessHandoffDecisionsForSignal,
  listBiReportBusinessHandoffDecisions,
  mapBiReportBusinessHandoffDecisionRow,
  updateBiReportBusinessHandoffDecision,
} from "@/lib/bi-report-skill/handoff-decision";

describe("bi report handoff decision storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an open handoff decision", async () => {
    dbMock.biReportBusinessHandoffDecision.create.mockResolvedValue({
      id: "decision-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetType: "action_item",
      status: "open",
      reviewedByUserId: null,
      reviewComment: null,
      reviewedAt: null,
      createdAt: new Date("2026-04-23T01:00:00Z"),
      updatedAt: new Date("2026-04-23T01:00:00Z"),
    });

    const decision = await createBiReportBusinessHandoffDecision({
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetType: "action_item",
    });

    expect(dbMock.biReportBusinessHandoffDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "open",
          signalId: "signal-1",
        }),
      }),
    );
    expect(decision?.status).toBe("open");
  });

  it("lists decisions by signal and status", async () => {
    dbMock.biReportBusinessHandoffDecision.findMany.mockResolvedValue([
      {
        id: "decision-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        targetType: "action_item",
        status: "accepted",
        reviewedByUserId: "user-1",
        reviewComment: "同意进入动作层",
        reviewedAt: new Date("2026-04-23T01:05:00Z"),
        createdAt: new Date("2026-04-23T01:00:00Z"),
        updatedAt: new Date("2026-04-23T01:05:00Z"),
      },
    ]);

    const decisions = await listBiReportBusinessHandoffDecisions({
      workspaceId: "workspace-1",
      signalId: "signal-1",
      status: "accepted",
      take: 5,
    });

    expect(dbMock.biReportBusinessHandoffDecision.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        signalId: "signal-1",
        status: "accepted",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    });
    expect(decisions[0]?.status).toBe("accepted");
  });

  it("updates decision to dismissed or accepted", async () => {
    dbMock.biReportBusinessHandoffDecision.update.mockResolvedValue({
      id: "decision-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetType: "approval",
      status: "dismissed",
      reviewedByUserId: "user-1",
      reviewComment: "暂不需要进入审批",
      reviewedAt: new Date("2026-04-23T01:10:00Z"),
      createdAt: new Date("2026-04-23T01:00:00Z"),
      updatedAt: new Date("2026-04-23T01:10:00Z"),
    });

    const decision = await updateBiReportBusinessHandoffDecision({
      id: "decision-1",
      status: "dismissed",
      reviewedByUserId: "user-1",
      reviewComment: "暂不需要进入审批",
    });

    expect(dbMock.biReportBusinessHandoffDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "decision-1" },
        data: expect.objectContaining({
          status: "dismissed",
          reviewedByUserId: "user-1",
          reviewComment: "暂不需要进入审批",
          reviewedAt: expect.any(Date),
        }),
      }),
    );
    expect(decision?.status).toBe("dismissed");
  });

  it("dismisses open decisions for a closed signal", async () => {
    dbMock.biReportBusinessHandoffDecision.updateMany.mockResolvedValue({ count: 2 });

    const dismissedCount = await dismissOpenBiReportBusinessHandoffDecisionsForSignal({
      workspaceId: "workspace-1",
      signalId: "signal-1",
      reviewComment: "信号已关闭",
    });

    expect(dbMock.biReportBusinessHandoffDecision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-1",
          signalId: "signal-1",
          status: "open",
        },
        data: expect.objectContaining({
          status: "dismissed",
          reviewedByUserId: null,
          reviewComment: "信号已关闭",
          reviewedAt: expect.any(Date),
        }),
      }),
    );
    expect(dismissedCount).toBe(2);
  });

  it("maps unknown status safely", () => {
    const decision = mapBiReportBusinessHandoffDecisionRow({
      id: "decision-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      targetType: "recommendation",
      status: "unknown",
      reviewedByUserId: null,
      reviewComment: null,
      reviewedAt: null,
      createdAt: new Date("2026-04-23T01:00:00Z"),
      updatedAt: new Date("2026-04-23T01:00:00Z"),
    });

    expect(decision.status).toBe("open");
  });
});
