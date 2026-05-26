import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    biReportBusinessSignal: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    biReportBusinessHandoffDecision: {
      updateMany: vi.fn(),
    },
  },
}));

const { operatingClosureKernelMock } = vi.hoisted(() => ({
  operatingClosureKernelMock: {
    syncBiReportSignalToOperatingClosure: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/bi-report-skill/operating-closure-kernel", () => ({
  syncBiReportSignalToOperatingClosure:
    operatingClosureKernelMock.syncBiReportSignalToOperatingClosure,
}));

import {
  advanceBiReportBusinessSignalStatus,
  buildBiReportBusinessSignalInput,
  createBiReportBusinessSignal,
  listRecentBiReportBusinessSignals,
  mapBiReportBusinessSignalRow,
} from "@/lib/bi-report-skill/business-signal";
import type { PreparedBiReportDryRun } from "@/lib/bi-report-skill/types";

describe("bi report business signal storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValue(null);
    dbMock.biReportBusinessHandoffDecision.updateMany.mockResolvedValue({ count: 0 });
    operatingClosureKernelMock.syncBiReportSignalToOperatingClosure.mockResolvedValue({
      signalEventUpserted: true,
      actionItemUpserted: true,
      approvalTaskUpserted: true,
      recommendationUpserted: true,
      guardBlocked: false,
      guardReasons: [],
    });
  });

  it("creates a business signal and maps structured fields", async () => {
    dbMock.biReportBusinessSignal.create.mockResolvedValue({
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "回款金额较前一日明显下降。",
      severity: "WARN",
      continuityStatus: "worsening",
      dimensionsJson: JSON.stringify({ bucket: "M1" }),
      metricsJson: JSON.stringify({ repayAmount: 100 }),
      evidenceJson: JSON.stringify({ matchedRuleIds: ["rule-1"] }),
      recommendedActionsJson: JSON.stringify(["复核回款口径"]),
      status: "open",
      ownerUserId: "user-1",
      ownerUserName: "负责人",
      ownerUserEmail: "owner@example.com",
      createdAt: new Date("2026-04-22T10:00:00Z"),
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    const signal = await createBiReportBusinessSignal({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "回款金额较前一日明显下降。",
      severity: "WARN",
      continuityStatus: "worsening",
      dimensions: { bucket: "M1" },
      metrics: { repayAmount: 100 },
      evidence: { matchedRuleIds: ["rule-1"] },
      recommendedActions: ["复核回款口径"],
      ownerUserId: "user-1",
      ownerUserName: "负责人",
      ownerUserEmail: "owner@example.com",
    });

    expect(dbMock.biReportBusinessSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          sourceRunId: "run-1",
          signalType: "repay_drop_signal",
          metricsJson: JSON.stringify({ repayAmount: 100 }),
        }),
      }),
    );
    expect(operatingClosureKernelMock.syncBiReportSignalToOperatingClosure).toHaveBeenCalledTimes(1);
    expect(signal).toEqual(
      expect.objectContaining({
        id: "signal-1",
        continuityStatus: "worsening",
        recommendedActions: ["复核回款口径"],
        dimensions: { bucket: "M1" },
        ownerUserName: "负责人",
        ownerUserEmail: "owner@example.com",
      }),
    );
  });

  it("lists recent business signals by createdAt desc", async () => {
    dbMock.biReportBusinessSignal.findMany.mockResolvedValue([
      {
        id: "signal-1",
        workspaceId: "workspace-1",
        sourceRunId: "run-1",
        skillKey: "bi_repay_daily",
        signalType: "repay_drop_signal",
        signalKey: "repay_drop_signal:2026-04-21",
        title: "回款异常",
        summary: "summary",
        severity: "WARN",
        continuityStatus: null,
        dimensionsJson: null,
        metricsJson: null,
        evidenceJson: null,
        recommendedActionsJson: JSON.stringify([]),
        status: "open",
        ownerUserId: null,
        ownerUserName: null,
        ownerUserEmail: null,
        createdAt: new Date("2026-04-22T10:00:00Z"),
        updatedAt: new Date("2026-04-22T10:00:00Z"),
      },
    ]);

    const signals = await listRecentBiReportBusinessSignals({
      workspaceId: "workspace-1",
      skillKey: "bi_repay_daily",
      status: "open",
      take: 5,
    });

    expect(dbMock.biReportBusinessSignal.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        skillKey: "bi_repay_daily",
        status: "open",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.id).toBe("signal-1");
  });

  it("R1 fix: severity=CLEAR produces no signal row (returns null)", async () => {
    const signal = await createBiReportBusinessSignal({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "无异常",
      summary: "回款持平",
      severity: "CLEAR",
    });
    expect(signal).toBeNull();
    expect(dbMock.biReportBusinessSignal.create).not.toHaveBeenCalled();
    expect(dbMock.biReportBusinessSignal.findFirst).not.toHaveBeenCalled();
  });

  it("dedupe — same (workspace, signalKey) refreshes existing live row instead of inserting", async () => {
    const existing = {
      id: "signal-existing",
      workspaceId: "workspace-1",
      sourceRunId: "run-prev",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "old title",
      summary: "old summary",
      severity: "WARN",
      continuityStatus: null,
      dimensionsJson: null,
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: JSON.stringify([]),
      status: "open",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T09:00:00Z"),
      updatedAt: new Date("2026-04-22T09:00:00Z"),
    };
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValueOnce(existing);
    dbMock.biReportBusinessSignal.update.mockResolvedValueOnce({
      ...existing,
      sourceRunId: "run-2",
      title: "new title",
      summary: "new summary",
      severity: "CRITICAL",
      updatedAt: new Date("2026-04-22T11:00:00Z"),
    });

    const signal = await createBiReportBusinessSignal({
      workspaceId: "workspace-1",
      sourceRunId: "run-2",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "new title",
      summary: "new summary",
      severity: "CRITICAL",
    });

    expect(signal?.id).toBe("signal-existing");
    expect(signal?.title).toBe("new title");
    expect(signal?.severity).toBe("CRITICAL");
    expect(dbMock.biReportBusinessSignal.create).not.toHaveBeenCalled();
    expect(dbMock.biReportBusinessSignal.update).toHaveBeenCalledTimes(1);
    expect(operatingClosureKernelMock.syncBiReportSignalToOperatingClosure).toHaveBeenCalledTimes(1);
  });

  it("keeps actioned live signals deduped so reruns do not recreate approvals", async () => {
    const existing = {
      id: "signal-actioned",
      workspaceId: "workspace-1",
      sourceRunId: "run-prev",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "old title",
      summary: "old summary",
      severity: "WARN",
      continuityStatus: null,
      dimensionsJson: null,
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: JSON.stringify([]),
      status: "actioned",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T09:00:00Z"),
      updatedAt: new Date("2026-04-22T09:00:00Z"),
    };
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValueOnce(existing);
    dbMock.biReportBusinessSignal.update.mockResolvedValueOnce({
      ...existing,
      sourceRunId: "run-2",
      title: "new title",
      summary: "new summary",
      updatedAt: new Date("2026-04-22T11:00:00Z"),
    });

    const signal = await createBiReportBusinessSignal({
      workspaceId: "workspace-1",
      sourceRunId: "run-2",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "new title",
      summary: "new summary",
      severity: "WARN",
    });

    expect(dbMock.biReportBusinessSignal.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        signalKey: "repay_drop_signal:2026-04-21",
        status: { in: ["open", "triaged", "actioned"] },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(signal?.id).toBe("signal-actioned");
    expect(dbMock.biReportBusinessSignal.create).not.toHaveBeenCalled();
    expect(dbMock.biReportBusinessSignal.update).toHaveBeenCalledTimes(1);
  });

  it("advances a live business signal status without requiring a schema change", async () => {
    const existing = {
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "summary",
      severity: "WARN",
      continuityStatus: null,
      dimensionsJson: null,
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: JSON.stringify([]),
      status: "open",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T09:00:00Z"),
      updatedAt: new Date("2026-04-22T09:00:00Z"),
    };
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValueOnce(existing);
    dbMock.biReportBusinessSignal.update.mockResolvedValueOnce({
      ...existing,
      status: "triaged",
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    const signal = await advanceBiReportBusinessSignalStatus({
      workspaceId: "workspace-1",
      id: "signal-1",
      status: "triaged",
    });

    expect(dbMock.biReportBusinessSignal.findFirst).toHaveBeenCalledWith({
      where: {
        id: "signal-1",
        workspaceId: "workspace-1",
      },
    });
    expect(dbMock.biReportBusinessSignal.update).toHaveBeenCalledWith({
      where: {
        id: "signal-1",
      },
      data: {
        status: "triaged",
      },
    });
    expect(signal?.status).toBe("triaged");
  });

  it("dismisses stale open handoffs when a signal reaches a terminal status", async () => {
    const existing = {
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "summary",
      severity: "WARN",
      continuityStatus: null,
      dimensionsJson: null,
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: JSON.stringify([]),
      status: "open",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T09:00:00Z"),
      updatedAt: new Date("2026-04-22T09:00:00Z"),
    };
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValueOnce(existing);
    dbMock.biReportBusinessSignal.update.mockResolvedValueOnce({
      ...existing,
      status: "dismissed",
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    const signal = await advanceBiReportBusinessSignalStatus({
      workspaceId: "workspace-1",
      id: "signal-1",
      status: "dismissed",
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
        }),
      }),
    );
    expect(signal?.status).toBe("dismissed");
  });

  it("does not regress terminal business signal status when late handoff events arrive", async () => {
    const existing = {
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "summary",
      severity: "WARN",
      continuityStatus: null,
      dimensionsJson: null,
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: JSON.stringify([]),
      status: "resolved",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T09:00:00Z"),
      updatedAt: new Date("2026-04-22T09:00:00Z"),
    };
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValueOnce(existing);

    const signal = await advanceBiReportBusinessSignalStatus({
      workspaceId: "workspace-1",
      id: "signal-1",
      status: "actioned",
    });

    expect(dbMock.biReportBusinessSignal.update).not.toHaveBeenCalled();
    expect(signal?.status).toBe("resolved");
  });

  it("allows a dismissed signal to return to triaged when a manager accepts the handoff later", async () => {
    const existing = {
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "summary",
      severity: "WARN",
      continuityStatus: null,
      dimensionsJson: null,
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: JSON.stringify([]),
      status: "dismissed",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T09:00:00Z"),
      updatedAt: new Date("2026-04-22T09:00:00Z"),
    };
    dbMock.biReportBusinessSignal.findFirst.mockResolvedValueOnce(existing);
    dbMock.biReportBusinessSignal.update.mockResolvedValueOnce({
      ...existing,
      status: "triaged",
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    const signal = await advanceBiReportBusinessSignalStatus({
      workspaceId: "workspace-1",
      id: "signal-1",
      status: "triaged",
    });

    expect(dbMock.biReportBusinessSignal.update).toHaveBeenCalledWith({
      where: {
        id: "signal-1",
      },
      data: {
        status: "triaged",
      },
    });
    expect(signal?.status).toBe("triaged");
  });

  it("maps unknown status and broken json safely", () => {
    const signal = mapBiReportBusinessSignalRow({
      id: "signal-1",
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      skillKey: "bi_repay_daily",
      signalType: "repay_drop_signal",
      signalKey: "repay_drop_signal:2026-04-21",
      title: "回款异常",
      summary: "summary",
      severity: "WARN",
      continuityStatus: "invalid",
      dimensionsJson: "{",
      metricsJson: null,
      evidenceJson: null,
      recommendedActionsJson: "{",
      status: "invalid",
      ownerUserId: null,
      ownerUserName: null,
      ownerUserEmail: null,
      createdAt: new Date("2026-04-22T10:00:00Z"),
      updatedAt: new Date("2026-04-22T10:00:00Z"),
    });

    expect(signal.continuityStatus).toBeNull();
    expect(signal.status).toBe("open");
    expect(signal.dimensions).toBeNull();
    expect(signal.recommendedActions).toEqual([]);
  });

  it("builds a business signal payload from a prepared dry-run", () => {
    const prepared = {
      skill: {
        baseDir: "/tmp/skill",
        manifest: {
          skillKey: "bi_repay_daily",
          name: "回款日报",
          version: "1.0.0",
          sourceType: "ODPS_SQL",
          analysisMode: "RULES_PLUS_LLM",
          defaultSchedule: "0 9 * * *",
          timezone: "Asia/Shanghai",
          supportedDeliveryChannels: ["DINGTALK_GROUP_WEBHOOK"],
          parameters: [],
          boundaries: [],
        },
        querySql: "select 1",
        schema: { version: "1", type: "table", columns: [] },
        metrics: { version: "1", aggregations: [] },
        resultCriteria: { version: "1", summaryMetricKeys: [], rules: [] },
        promptTemplate: "prompt",
        messageTemplate: "message",
      },
      subscription: {
        name: "回款日报",
        skillKey: "bi_repay_daily",
        skillVersion: "1.0.0",
        enabled: true,
        scheduleCron: "0 9 * * *",
        timezone: "Asia/Shanghai",
        sqlParams: {},
        deliveryTargets: [],
      },
      rows: [{ biz_date: "2026-04-21" }],
      computed: {
        metricsByKey: { repay_amount: 100 },
        summaryMetrics: [{ key: "repay_amount", label: "回款金额", value: 100, format: "currency" }],
        rankings: {},
      },
      evaluation: {
        severity: "WARN",
        matchedRules: [{ id: "rule-1", severity: "WARN", metricKey: "repay_amount", operator: "<=", threshold: 80, title: "回款下降", reason: "回款下降明显" }],
        topFindings: ["回款金额下降"],
        shouldSend: true,
        silenceThreshold: "WATCH",
      },
      recentRunContext: {
        recentRuns: [],
        continuityStatus: "worsening",
        historicalContext: null,
      },
      recentFeedbackContext: {
        recentFeedbacks: [],
        feedbackContext: null,
        confirmedCauseHints: [],
        confirmedActionHints: [],
        falsePositiveSignal: false,
        ruleAdjustmentSignal: false,
      },
      similarCaseContext: {
        relatedRuns: [],
        relatedFeedbacks: [],
        caseContext: null,
      },
      analysis: {
        headline: "回款日报预警",
        summary: "回款金额较前一日明显下降。",
        findings: ["回款金额下降"],
        possibleCauses: ["渠道波动"],
        recommendedActions: ["复核口径"],
        confidence: 0.8,
        continuityStatus: "worsening",
        historicalContext: null,
        feedbackContext: null,
        boundaryNote: "note",
      },
      message: "message",
      windowLabel: "2026-04-21 vs 2026-04-20",
    } satisfies PreparedBiReportDryRun;

    const signalInput = buildBiReportBusinessSignalInput({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      prepared,
      queryWarnings: ["missing thedate filter"],
      ownerUserName: "负责人",
      ownerUserEmail: "owner@example.com",
    });

    expect(signalInput.signalType).toBe("bi_repay_daily.anomaly");
    expect(signalInput.signalKey).toBe("bi_repay_daily:2026-04-21 vs 2026-04-20");
    expect(signalInput.metrics).toEqual({
      summaryMetrics: {
        repay_amount: 100,
      },
      rowCount: 1,
    });
    expect(signalInput.evidence).toEqual({
      findings: ["回款金额下降"],
      topFindings: ["回款金额下降"],
      matchedRuleIds: ["rule-1"],
      queryWarnings: ["missing thedate filter"],
    });
    expect(signalInput.ownerUserName).toBe("负责人");
    expect(signalInput.ownerUserEmail).toBe("owner@example.com");
  });
});
