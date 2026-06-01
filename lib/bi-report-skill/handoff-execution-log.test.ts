import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createBiReportHandoffExecutionLog,
  listBiReportHandoffExecutionLogs,
  mapBiReportHandoffExecutionLogRow,
} from "@/lib/bi-report-skill/handoff-execution-log";

vi.mock("@/lib/db", () => ({
  db: {
    biReportHandoffExecutionLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("handoff-execution-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an execution log", async () => {
    vi.mocked(db.biReportHandoffExecutionLog.create).mockResolvedValue({
      id: "log-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "plan",
      authorUserId: "user-1",
      summary: "先拆分费用所属方",
      detailsJson: JSON.stringify({
        plannedActions: ["拆分费用所属方"],
        expectedOutcome: "确认异常来源",
      }),
      isEffective: null,
      followUpNeeded: true,
      createdAt: new Date("2026-04-23T00:00:00.000Z"),
      updatedAt: new Date("2026-04-23T00:10:00.000Z"),
    });

    const log = await createBiReportHandoffExecutionLog({
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "plan",
      authorUserId: "user-1",
      summary: "先拆分费用所属方",
      details: {
        plannedActions: ["拆分费用所属方"],
        expectedOutcome: "确认异常来源",
      },
      followUpNeeded: true,
    });

    expect(log).toEqual({
      id: "log-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: "action-1",
      approvalTaskId: "approval-1",
      stage: "plan",
      authorUserId: "user-1",
      summary: "先拆分费用所属方",
      details: {
        plannedActions: ["拆分费用所属方"],
        expectedOutcome: "确认异常来源",
      },
      isEffective: null,
      followUpNeeded: true,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:10:00.000Z",
    });
  });

  it("lists execution logs", async () => {
    vi.mocked(db.biReportHandoffExecutionLog.findMany).mockResolvedValue([
      {
        id: "log-1",
        workspaceId: "workspace-1",
        signalId: "signal-1",
        decisionId: "decision-1",
        actionItemId: null,
        approvalTaskId: null,
        stage: "result",
        authorUserId: "user-1",
        summary: "已定位主要原因",
        detailsJson: JSON.stringify({
          actionsTaken: ["已拆分分组"],
          outcome: "已定位原因",
        }),
        isEffective: true,
        followUpNeeded: false,
        createdAt: new Date("2026-04-23T01:00:00.000Z"),
        updatedAt: new Date("2026-04-23T01:10:00.000Z"),
      },
    ]);

    const logs = await listBiReportHandoffExecutionLogs({
      workspaceId: "workspace-1",
      signalId: "signal-1",
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.stage).toBe("result");
    expect(logs[0]?.details).toEqual({
      actionsTaken: ["已拆分分组"],
      outcome: "已定位原因",
    });
  });

  it("maps invalid stage to plan", () => {
    const log = mapBiReportHandoffExecutionLogRow({
      id: "log-1",
      workspaceId: "workspace-1",
      signalId: "signal-1",
      decisionId: "decision-1",
      actionItemId: null,
      approvalTaskId: null,
      stage: "unknown",
      authorUserId: "user-1",
      summary: "待补充",
      detailsJson: "{",
      isEffective: null,
      followUpNeeded: null,
      createdAt: new Date("2026-04-23T02:00:00.000Z"),
      updatedAt: new Date("2026-04-23T02:05:00.000Z"),
    });

    expect(log.stage).toBe("plan");
    expect(log.details).toBeNull();
  });

  it("returns empty logs when the prisma delegate is unavailable", async () => {
    const original = (db as unknown as { biReportHandoffExecutionLog?: unknown }).biReportHandoffExecutionLog;
    delete (db as unknown as { biReportHandoffExecutionLog?: unknown }).biReportHandoffExecutionLog;

    try {
      await expect(
        listBiReportHandoffExecutionLogs({
          workspaceId: "workspace-1",
          signalId: "signal-1",
        }),
      ).resolves.toEqual([]);
    } finally {
      (db as unknown as { biReportHandoffExecutionLog?: unknown }).biReportHandoffExecutionLog = original;
    }
  });
});
