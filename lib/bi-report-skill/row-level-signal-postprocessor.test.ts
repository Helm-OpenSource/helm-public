import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistSignalsMock, dbMock } = vi.hoisted(() => ({
  persistSignalsMock: vi.fn(),
  dbMock: {
    connector: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    biReportSignalNotification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/extensions/registry", () => ({
  getBiReportP0ProcessSkillKey: () => "bi_collection_operating_signal_daily",
  persistBiReportP0ProcessSignals: persistSignalsMock,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

const { resolveInviteSnapshotUserIdMock } = vi.hoisted(() => ({
  resolveInviteSnapshotUserIdMock: vi.fn(),
}));

vi.mock("@/lib/connectors/dingtalk-directory-invite-snapshot", () => ({
  resolveDingTalkDirectoryInviteUserId: resolveInviteSnapshotUserIdMock,
}));

import { persistBiReportRowLevelSignals } from "@/lib/bi-report-skill/row-level-signal-postprocessor";

describe("bi report row-level signal postprocessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.connector.findUnique.mockResolvedValue(null);
    dbMock.user.findUnique.mockResolvedValue(null);
    resolveInviteSnapshotUserIdMock.mockResolvedValue(null);
    dbMock.biReportSignalNotification.findFirst.mockResolvedValue(null);
  });

  it("does nothing for non-p0 skills", async () => {
    const result = await persistBiReportRowLevelSignals({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      prepared: {
        skill: { manifest: { skillKey: "bi_repay_daily" } },
        rows: [],
        windowLabel: "2026-04-27",
      } as never,
    });

    expect(result).toEqual([]);
    expect(persistSignalsMock).not.toHaveBeenCalled();
  });

  it("delegates p0 row data to the new signal persistence flow", async () => {
    persistSignalsMock.mockResolvedValue({
      sourceRunId: "run-1",
      generatedCount: 1,
      persistedCount: 1,
      signals: [],
      externalSignals: [],
      persistedSignals: [{ id: "persisted-1", ownerUserId: "user-1" }],
    });
    dbMock.connector.findUnique.mockResolvedValue({
      metadata: JSON.stringify({ lastResolvedUnionId: "union-1" }),
      status: "ACTIVE",
    });
    dbMock.biReportSignalNotification.create.mockResolvedValue({
      id: "notification-1",
      workspaceId: "workspace-1",
      signalId: "persisted-1",
      targetUserId: "user-1",
      channel: "DINGTALK_APP_MESSAGE",
      targetKey: "unionId:union-1",
      status: "pending",
      providerMessageId: null,
      errorMessage: null,
      sentAt: null,
      createdAt: new Date("2026-05-12T00:00:00.000Z"),
      updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    });

    const result = await persistBiReportRowLevelSignals({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      prepared: {
        skill: { manifest: { skillKey: "bi_collection_operating_signal_daily" } },
        subscription: {
          signalRouting: {
            strategy: "seat_supervisor_mapping",
            supervisorMappings: [{ orgName: "人工", userEmail: "manager@example.com" }],
          },
        },
        windowLabel: "2026-04-27",
        rows: [
          {
            biz_date: "2026-04-27",
            org_name: "人工",
            emp_name: "张三",
            processed_user_count: 10,
            connected_user_count: 8,
            call_out_times: 30,
            connected_times: 9,
            valid_call_minutes: 12,
            self_connect_rate_pct: 15,
            complaint_count: 2,
            complaint_resolution_rate_pct: 100,
          },
        ],
      } as never,
    });

    expect(persistSignalsMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      windowDate: "2026-04-27",
      signalRouting: {
        strategy: "seat_supervisor_mapping",
        supervisorMappings: [{ orgName: "人工", userEmail: "manager@example.com" }],
      },
      productionRows: [
        {
          orgName: "人工",
          empName: "张三",
          inPanelCaseCount: null,
          processedUserCount: 10,
          connectedUserCount: 8,
          callOutTimes: 30,
          connectedTimes: 9,
          validCallMinutes: 12,
        },
      ],
      sopRows: [
        {
          orgName: "人工",
          empName: "张三",
          selfConnectRatePct: 15,
          followupCompletionRatePct: null,
          callTargetPersonRatePct: null,
          totalCallMinutes: null,
          complaintCount: 2,
          complaintResolutionRatePct: 100,
        },
      ],
    });
    expect(dbMock.biReportSignalNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalId: "persisted-1",
          channel: "DINGTALK_APP_MESSAGE",
          targetKey: "unionId:union-1",
          status: "pending",
        }),
      }),
    );
    expect(result).toEqual([{ id: "persisted-1", ownerUserId: "user-1" }]);
  });

  it("falls back to DingTalk directory invite snapshot when the owner has no connector unionId", async () => {
    persistSignalsMock.mockResolvedValue({
      sourceRunId: "run-1",
      generatedCount: 1,
      persistedCount: 1,
      signals: [],
      externalSignals: [],
      persistedSignals: [{ id: "persisted-1", ownerUserId: "user-1" }],
    });
    dbMock.connector.findUnique.mockResolvedValue(null);
    dbMock.user.findUnique.mockResolvedValue({
      name: "张三",
      email: "zhangsan@example.com",
      phone: "13800138000",
    });
    resolveInviteSnapshotUserIdMock.mockResolvedValue("dt-user-1");
    dbMock.biReportSignalNotification.create.mockResolvedValue({
      id: "notification-1",
      workspaceId: "workspace-1",
      signalId: "persisted-1",
      targetUserId: "user-1",
      channel: "DINGTALK_APP_MESSAGE",
      targetKey: "userId:dt-user-1",
      status: "pending",
      providerMessageId: null,
      errorMessage: null,
      sentAt: null,
      createdAt: new Date("2026-05-12T00:00:00.000Z"),
      updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    });

    await persistBiReportRowLevelSignals({
      workspaceId: "workspace-1",
      sourceRunId: "run-1",
      prepared: {
        skill: { manifest: { skillKey: "bi_collection_operating_signal_daily" } },
        subscription: {
          signalRouting: {
            strategy: "seat_supervisor_mapping",
            supervisorMappings: [{ orgName: "人工", userEmail: "manager@example.com" }],
          },
        },
        windowLabel: "2026-04-27",
        rows: [
          {
            biz_date: "2026-04-27",
            org_name: "人工",
            emp_name: "张三",
            processed_user_count: 10,
          },
        ],
      } as never,
    });

    expect(resolveInviteSnapshotUserIdMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      name: "张三",
      email: "zhangsan@example.com",
      phone: "13800138000",
    });
    expect(dbMock.biReportSignalNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalId: "persisted-1",
          channel: "DINGTALK_APP_MESSAGE",
          targetKey: "userId:dt-user-1",
          status: "pending",
        }),
      }),
    );
  });
});
