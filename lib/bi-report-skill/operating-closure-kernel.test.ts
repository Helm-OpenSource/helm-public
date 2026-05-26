import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, writeAuditLogMock } = vi.hoisted(() => ({
  dbMock: {
    runtimeSession: { upsert: vi.fn() },
    signalEvent: { upsert: vi.fn() },
    membership: { findMany: vi.fn() },
    biReportBusinessSignal: { update: vi.fn() },
    biReportBusinessHandoffDecision: { findFirst: vi.fn(), create: vi.fn() },
    actionItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    recommendationLog: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    approvalTask: { upsert: vi.fn() },
  },
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

import { syncBiReportSignalToOperatingClosure } from "@/lib/bi-report-skill/operating-closure-kernel";

const testBiReportExtensionKey = ["guan", "gpu-bi-report"].join("");

function makeSignal(overrides: Partial<Parameters<typeof syncBiReportSignalToOperatingClosure>[0]["signal"]> = {}) {
  return {
    id: "signal-1",
    workspaceId: "workspace-1",
    sourceRunId: "run-1",
    skillKey: "bi_collection_operating_signal_daily",
    signalType: "manager_daily_intervention_required",
    signalKey: "bi_collection_operating_signal_daily:2026-05-12",
    title: "需要主管介入",
    summary: "昨日经营信号异常",
    severity: "CRITICAL" as const,
    continuityStatus: null,
    dimensions: null,
    metrics: null,
    evidence: null,
    recommendedActions: ["主管当日接手并记录处理方案"],
    status: "open" as const,
    ownerUserId: null,
    ownerUserName: null,
    ownerUserEmail: null,
    createdAt: new Date("2026-05-13T08:00:00Z").toISOString(),
    updatedAt: new Date("2026-05-13T08:00:00Z").toISOString(),
    ...overrides,
  };
}

describe("syncBiReportSignalToOperatingClosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.runtimeSession.upsert.mockResolvedValue({ id: "runtime-session-1" });
    dbMock.signalEvent.upsert.mockResolvedValue({ id: "signal-event-1" });
    dbMock.biReportBusinessHandoffDecision.findFirst.mockResolvedValue(null);
    dbMock.biReportBusinessHandoffDecision.create.mockResolvedValue({ id: "decision-1" });
    dbMock.actionItem.findFirst.mockResolvedValue(null);
    dbMock.actionItem.create.mockResolvedValue({
      id: "action-1",
      recommendationLogId: null,
      requiresApproval: true,
      ownerId: "owner-1",
    });
    dbMock.recommendationLog.findFirst.mockResolvedValue(null);
    dbMock.recommendationLog.create.mockResolvedValue({ id: "rec-1" });
    dbMock.approvalTask.upsert.mockResolvedValue({ id: "approval-1" });
  });

  it("blocks critical signal when owner/approver/notification mapping is missing", async () => {
    dbMock.membership.findMany.mockResolvedValue([]);

    const summary = await syncBiReportSignalToOperatingClosure({
      signal: makeSignal(),
      extensionKey: testBiReportExtensionKey,
      signalRouting: {
        requireOwnerForCritical: true,
        requireApproverForCritical: true,
        requireNotificationTargetForCritical: true,
      },
    });

    expect(summary.guardBlocked).toBe(true);
    expect(summary.guardReasons).toEqual(
      expect.arrayContaining([
        "missing_owner_mapping",
        "missing_approver_mapping",
        "missing_notification_target",
      ]),
    );
    expect(dbMock.actionItem.create).not.toHaveBeenCalled();
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it("creates action/recommendation/approval on non-blocked path", async () => {
    dbMock.membership.findMany.mockResolvedValue([
      {
        userId: "owner-1",
        role: "OPERATOR",
        rolePresetKey: "OPERATIONS_FINANCE",
        user: { id: "owner-1", name: "运营负责人", email: "owner@example.com" },
      },
      {
        userId: "approver-1",
        role: "ADMIN",
        rolePresetKey: "FOUNDER_CEO",
        user: { id: "approver-1", name: "审批人", email: "approver@example.com" },
      },
    ]);

    const summary = await syncBiReportSignalToOperatingClosure({
      signal: makeSignal({ ownerUserEmail: "owner@example.com" }),
      extensionKey: testBiReportExtensionKey,
      signalRouting: {
        approverMappings: [{ userEmail: "approver@example.com" }],
      },
    });

    expect(summary.guardBlocked).toBe(false);
    expect(summary.signalEventUpserted).toBe(true);
    expect(summary.actionItemUpserted).toBe(true);
    expect(summary.recommendationUpserted).toBe(true);
    expect(summary.approvalTaskUpserted).toBe(true);
    expect(dbMock.actionItem.create).toHaveBeenCalledTimes(1);
    expect(dbMock.recommendationLog.create).toHaveBeenCalledTimes(1);
    expect(dbMock.approvalTask.upsert).toHaveBeenCalledTimes(1);
  });
});
