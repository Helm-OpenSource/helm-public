import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorStatus, RuntimeEventStatus } from "@prisma/client";
import { storeConnectorToken } from "@/lib/connectors/token-store";

const {
  dbMock,
  fetchDingTalkMcpScopeDataMock,
  discoverDingTalkMcpSubjectsMock,
  bridgeDingTalkSignalsToWorkflowMock,
} = vi.hoisted(() => ({
  dbMock: {
    connector: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    runtimeEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
    runtimeSession: {
      upsert: vi.fn(),
    },
    sessionNotebook: {
      upsert: vi.fn(),
    },
    persistedPayload: {
      upsert: vi.fn(),
    },
    connectorIngestionRecord: {
      createMany: vi.fn(),
    },
    meeting: {
      findMany: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
    },
    memoryEntry: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    memoryFact: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  fetchDingTalkMcpScopeDataMock: vi.fn(),
  discoverDingTalkMcpSubjectsMock: vi.fn(),
  bridgeDingTalkSignalsToWorkflowMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/connectors/dingtalk-mcp-client", () => ({
  fetchDingTalkMcpScopeData: fetchDingTalkMcpScopeDataMock,
  discoverDingTalkMcpSubjects: discoverDingTalkMcpSubjectsMock,
  getDingTalkMcpActiveProfiles: () => [
    "dingtalk-calendar",
    "dingtalk-tasks",
    "dingtalk-teambition",
    "dingtalk-report",
    "dingtalk-notice",
  ],
}));

vi.mock("@/lib/connectors/dingtalk-workflow-bridge", () => ({
  bridgeDingTalkSignalsToWorkflow: bridgeDingTalkSignalsToWorkflowMock,
}));

import { syncDingTalkReadonlyConnector } from "@/lib/connectors/dingtalk-ingestion";

describe("dingtalk readonly ingestion seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DINGTALK_CLIENT_ID = "client-id";
    process.env.DINGTALK_CLIENT_SECRET = "client-secret";
    process.env.DINGTALK_ROBOT_CODE = "robot-code";
    process.env.DINGTALK_AGENT_ID = "agent-id";
    process.env.DINGTALK_CORP_ID = "corp-id";
    delete process.env.DINGTALK_EXCLUDED_DEPT_NAMES;
    delete process.env.DINGTALK_EXCLUDED_DEPT_IDS;
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "DINGTALK",
      status: "CONNECTED",
      accessToken: storeConnectorToken("access-token"),
      metadata: JSON.stringify({
        lastCallbackResult: {
          status: "SUCCESS",
          failurePosture: "CLEAR",
          recordedAt: "2026-04-07T08:00:00.000Z",
          message: "connected",
          providerEmail: "owner@helm.so",
          providerMobile: null,
          providerNick: "Owner",
          providerAvatarUrl: null,
          providerOpenId: "open-id-1",
          providerUnionId: "union-id-1",
          providerUserId: "ding-user-1",
          matchedWorkspaceUserEmail: "owner@helm.so",
          corpId: "corp-1",
        },
      }),
    });
    dbMock.runtimeEvent.create.mockResolvedValue({
      id: "runtime-event-1",
      status: RuntimeEventStatus.COMPLETED,
    });
    dbMock.runtimeEvent.update.mockResolvedValue({
      id: "runtime-event-1",
      status: RuntimeEventStatus.COMPLETED,
    });
    dbMock.runtimeSession.upsert.mockResolvedValue({
      id: "runtime-session-1",
    });
    dbMock.sessionNotebook.upsert.mockResolvedValue({
      id: "notebook-1",
    });
    dbMock.persistedPayload.upsert.mockResolvedValue({
      id: "payload-1",
    });
    dbMock.connectorIngestionRecord.createMany.mockResolvedValue({ count: 1 });
    dbMock.meeting.findMany.mockResolvedValue([]);
    dbMock.opportunity.findMany.mockResolvedValue([]);
    dbMock.opportunity.update.mockResolvedValue({
      id: "opportunity-1",
    });
    dbMock.company.findMany.mockResolvedValue([]);
    dbMock.contact.findMany.mockResolvedValue([]);
    dbMock.memoryEntry.findFirst.mockResolvedValue(null);
    dbMock.memoryEntry.findMany.mockResolvedValue([]);
    dbMock.memoryEntry.create.mockResolvedValue({
      id: "memory-entry-1",
    });
    dbMock.memoryEntry.update.mockResolvedValue({
      id: "memory-entry-1",
    });
    dbMock.memoryFact.findFirst.mockResolvedValue(null);
    dbMock.memoryFact.findMany.mockResolvedValue([]);
    dbMock.memoryFact.create.mockResolvedValue({
      id: "memory-fact-1",
    });
    dbMock.memoryFact.update.mockResolvedValue({
      id: "memory-fact-1",
    });
    dbMock.connector.upsert.mockResolvedValue({
      id: "connector-1",
      status: ConnectorStatus.CONNECTED,
    });
    bridgeDingTalkSignalsToWorkflowMock.mockResolvedValue({
      totalSignals: 0,
      matchedObjectCount: 0,
      unmatchedCount: 0,
      actionCreatedCount: 0,
      approvalEnqueuedCount: 0,
      dedupSkippedCount: 0,
      skippedCount: 0,
    });
    discoverDingTalkMcpSubjectsMock.mockResolvedValue([
      {
        userId: "ding-user-1",
        unionId: "union-id-1",
        source: "test",
      },
    ]);
    dbMock.connector.update.mockResolvedValue({
      id: "connector-1",
      status: ConnectorStatus.CONNECTED,
    });
  });

  it("persists multi-scope MCP payloads with derived meetings and management scopes", async () => {
    fetchDingTalkMcpScopeDataMock.mockResolvedValue({
      scopeResults: [
        {
          scope: "CALENDAR",
          status: "INGESTED",
          message: null,
          docUrl: "https://open.dingtalk.com/document/personalapp/query-an-event-list-1",
          records: [
            {
              scope: "CALENDAR",
              sourceType: "calendar_event",
              sourceId: "event-1",
              label: "Weekly pipeline review",
              summary: "Review current deals",
              preview: "Review current deals",
              payloadText: "calendar payload",
              sourceSummary: "calendar",
              evidenceRef: "dingtalk:calendar:event-1",
              extractedFacts: ["Owner"],
              docUrl: "https://open.dingtalk.com/document/personalapp/query-an-event-list-1",
              draftPayload: {
                provider: "DINGTALK",
                scope: "CALENDAR",
                payload: {
                  id: "event-1",
                  title: "Weekly pipeline review",
                  onlineMeetingInfo: {
                    conferenceId: "conf-1",
                    url: "https://meeting.example.com/1",
                  },
                },
              },
            },
          ],
        },
        {
          scope: "TODO",
          status: "INGESTED",
          message: null,
          docUrl: "https://open.dingtalk.com/document/orgapp-server/overview-of-to-do",
          records: [
            {
              scope: "TODO",
              sourceType: "todo_task",
              sourceId: "todo-1",
              label: "Follow up with ACME",
              summary: "Prepare proposal package",
              preview: "Prepare proposal package",
              payloadText: "todo payload",
              sourceSummary: "todo",
              evidenceRef: "dingtalk:todo:todo-1",
              extractedFacts: ["high"],
              docUrl: "https://open.dingtalk.com/document/orgapp-server/overview-of-to-do",
              draftPayload: {
                provider: "DINGTALK",
                scope: "TODO",
                payload: {
                  id: "todo-1",
                  title: "Follow up with ACME",
                },
              },
            },
          ],
        },
        {
          scope: "PROJECTS",
          status: "INGESTED",
          message: null,
          docUrl: "https://open.dingtalk.com/document/orgapp-server/teambition-overview",
          records: [],
        },
        {
          scope: "WORK",
          status: "INGESTED",
          message: null,
          docUrl: "https://open.dingtalk.com/document/orgapp/asynchronous-work-notification",
          records: [
            {
              scope: "WORK",
              sourceType: "work_notice",
              sourceId: "notice-1",
              label: "Ops update",
              summary: "Weekly operation update",
              preview: "Weekly operation update",
              payloadText: "notice payload",
              sourceSummary: "work",
              evidenceRef: "dingtalk:work:notice-1",
              extractedFacts: ["ops"],
              docUrl: "https://open.dingtalk.com/document/orgapp/asynchronous-work-notification",
              draftPayload: {
                provider: "DINGTALK",
                scope: "WORK",
                payload: {
                  id: "notice-1",
                  title: "Ops update",
                },
              },
            },
          ],
        },
        {
          scope: "MESSAGE_NOTIFICATIONS",
          status: "INGESTED",
          message: null,
          docUrl: "https://open.dingtalk.com/document/orgapp/asynchronous-work-notification",
          records: [],
        },
      ],
      activeProfiles: ["dingtalk-calendar", "dingtalk-tasks"],
      toolCount: 6,
    });

    const result = await syncDingTalkReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.ingestResult.persistedPayloadCount).toBeGreaterThanOrEqual(4);
    expect(result.ingestResult.runtimeEventId).toBe("runtime-event-1");
    expect(result.ingestResult.runtimeSessionId).toBe("runtime-session-1");
    expect(result.ingestResult.scopeResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: "CALENDAR", status: "INGESTED" }),
        expect.objectContaining({ scope: "MEETINGS", status: "INGESTED" }),
        expect.objectContaining({ scope: "TODO", status: "INGESTED" }),
        expect.objectContaining({ scope: "PROJECTS", status: "INGESTED" }),
        expect.objectContaining({ scope: "WORK", status: "INGESTED" }),
        expect.objectContaining({ scope: "MANAGEMENT", status: "INGESTED" }),
      ]),
    );
    expect(dbMock.persistedPayload.upsert).toHaveBeenCalled();
    expect(dbMock.connectorIngestionRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ sourceScope: expect.stringMatching(/^(WORKSPACE|OBJECT):/) }),
        ]),
      }),
    );
    expect(dbMock.connector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: ConnectorStatus.CONNECTED,
          lastSyncStatus: "同步完成",
        }),
      }),
    );
    const memoryEntryCreates = dbMock.memoryEntry.create.mock.calls
      .map((call) => call[0]?.data?.content)
      .filter((value): value is string => typeof value === "string");
    expect(memoryEntryCreates.every((content) => !content.includes("[taxonomy]"))).toBe(true);
    expect(memoryEntryCreates.every((content) => !content.includes("Raw payload:"))).toBe(true);
  });

  it("records unresolved posture when callback metadata cannot provide a usable subject id", async () => {
    delete process.env.DINGTALK_CLIENT_ID;
    delete process.env.DINGTALK_CLIENT_SECRET;
    delete process.env.DINGTALK_ROBOT_CODE;
    delete process.env.DINGTALK_AGENT_ID;
    delete process.env.DINGTALK_CORP_ID;

    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "DINGTALK",
      status: "CONNECTED",
      accessToken: storeConnectorToken("access-token"),
      metadata: JSON.stringify({
        lastCallbackResult: {
          status: "SUCCESS",
          failurePosture: "CLEAR",
          recordedAt: "2026-04-07T08:00:00.000Z",
          message: "connected",
          providerEmail: "owner@helm.so",
          providerMobile: null,
          providerNick: "Owner",
          providerAvatarUrl: null,
          providerOpenId: "open-id-1",
          providerUnionId: null,
          providerUserId: null,
          matchedWorkspaceUserEmail: "owner@helm.so",
          corpId: "corp-1",
        },
      }),
    });

    const result = await syncDingTalkReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.ingestResult.runtimeEventId).toBe("runtime-event-1");
    expect(result.ingestResult.persistedPayloadCount).toBe(0);
    expect(fetchDingTalkMcpScopeDataMock).not.toHaveBeenCalled();
    expect(dbMock.connector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: ConnectorStatus.ERROR,
          lastSyncStatus: "未解析",
        }),
      }),
    );
  });

  it("passes excluded department filters to subject discovery", async () => {
    process.env.DINGTALK_ENTERPRISE_READ_ALL = "1";
    process.env.DINGTALK_EXCLUDED_DEPT_NAMES = "逾控组,人工组";
    process.env.DINGTALK_EXCLUDED_DEPT_IDS = "1001,1002";

    fetchDingTalkMcpScopeDataMock.mockResolvedValue({
      scopeResults: [],
      activeProfiles: [],
      toolCount: 0,
    });

    await syncDingTalkReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: false,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(discoverDingTalkMcpSubjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deptIds: [1],
        excludedDeptNames: ["逾控组", "人工组"],
        excludedDeptIds: [1001, 1002],
      }),
    );
  });

  afterEach(() => {
    delete process.env.DINGTALK_CLIENT_ID;
    delete process.env.DINGTALK_CLIENT_SECRET;
    delete process.env.DINGTALK_ROBOT_CODE;
    delete process.env.DINGTALK_AGENT_ID;
    delete process.env.DINGTALK_CORP_ID;
    delete process.env.DINGTALK_EXCLUDED_DEPT_NAMES;
    delete process.env.DINGTALK_EXCLUDED_DEPT_IDS;
    vi.restoreAllMocks();
  });
});
