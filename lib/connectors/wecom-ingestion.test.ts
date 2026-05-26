import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorStatus, RuntimeEventStatus } from "@prisma/client";
import { storeConnectorToken } from "@/lib/connectors/token-store";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    connector: {
      findUnique: vi.fn(),
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
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { syncWeComReadonlyConnector } from "@/lib/connectors/wecom-ingestion";

function buildConnector(input?: {
  accessToken?: string | null;
  providerUserId?: string | null;
  boundCalendars?: Array<{
    calendarId: string;
    calendarName?: string | null;
    ownerUserId?: string | null;
  }>;
}) {
  return {
    id: "connector-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    provider: "WECOM",
    status: "CONNECTED",
    accessToken:
      typeof input?.accessToken === "string"
        ? storeConnectorToken(input.accessToken)
        : null,
    metadata: JSON.stringify({
      lastCallbackResult: {
        status: "SUCCESS",
        failurePosture: "CLEAR",
        recordedAt: "2026-04-07T08:00:00.000Z",
        message: "connected",
        providerEmail: "owner@helm.so",
        providerMobile: "13800138000",
        providerNick: "Owner",
        providerAvatarUrl: null,
        providerOpenId: null,
        providerUnionId: null,
        providerUserId:
          input?.providerUserId !== undefined
            ? input.providerUserId
            : "wecom-user-1",
        matchedWorkspaceUserEmail: "owner@helm.so",
        corpId: "corp-id",
      },
      calendarRegistry: {
        boundCalendars: (input?.boundCalendars ?? []).map((calendar) => ({
          calendarId: calendar.calendarId,
          calendarName: calendar.calendarName ?? null,
          ownerUserId: calendar.ownerUserId ?? null,
          recordedAt: "2026-04-07T08:00:00.000Z",
          sourcePage: "/settings",
          docUrl: "https://developer.work.weixin.qq.com/document/path/97717",
        })),
        lastValidationResult: null,
      },
    }),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("wecom readonly ingestion seam", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    dbMock.connector.findUnique.mockResolvedValue(
      buildConnector({
        accessToken: "corp-token",
      }),
    );
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
    dbMock.connector.update.mockResolvedValue({
      id: "connector-1",
      status: ConnectorStatus.CONNECTED,
    });
  });

  it("persists verified meetings while leaving calendar and message notifications unresolved", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.startsWith("https://qyapi.weixin.qq.com/cgi-bin/meeting/get_user_meetingid")) {
        return jsonResponse({
          errcode: 0,
          errmsg: "ok",
          meetingid_list: ["meeting-1"],
        });
      }

      if (url.startsWith("https://qyapi.weixin.qq.com/cgi-bin/meeting/get_info")) {
        return jsonResponse({
          errcode: 0,
          errmsg: "ok",
          admin_userid: "wecom-user-1",
          title: "Weekly pipeline review",
          meeting_start: 1775632800,
          meeting_duration: 3600,
          description: "Review pipeline changes",
          location: "Room A",
          status: 1,
          meeting_type: 1,
          attendees: [
            { userid: "alice", response_status: 0 },
            { userid: "bob", response_status: 1 },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await syncWeComReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.ingestResult.persistedPayloadCount).toBe(1);
    expect(result.ingestResult.scopeResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "MEETINGS",
          status: "INGESTED",
          persistedPayloadCount: 1,
        }),
        expect.objectContaining({
          scope: "CALENDAR",
          status: "UNRESOLVED",
        }),
        expect.objectContaining({
          scope: "MESSAGE_NOTIFICATIONS",
          status: "UNRESOLVED",
        }),
      ]),
    );
    expect(dbMock.persistedPayload.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.connectorIngestionRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            sourceType: "meeting",
            sourceScope: "WORKSPACE:MEETINGS",
          }),
        ]),
      }),
    );
    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ConnectorStatus.CONNECTED,
          lastSyncStatus: "部分完成",
        }),
      }),
    );
  });

  it("records an unresolved posture when no WeCom access token is available", async () => {
    dbMock.connector.findUnique.mockResolvedValue(
      buildConnector({
        accessToken: null,
      }),
    );

    const result = await syncWeComReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.ingestResult.persistedPayloadCount).toBe(0);
    expect(result.ingestResult.scopeResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "MEETINGS",
          status: "UNRESOLVED",
        }),
        expect.objectContaining({
          scope: "CALENDAR",
          status: "UNRESOLVED",
        }),
        expect.objectContaining({
          scope: "MESSAGE_NOTIFICATIONS",
          status: "UNRESOLVED",
        }),
      ]),
    );
    expect(dbMock.persistedPayload.upsert).not.toHaveBeenCalled();
    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ConnectorStatus.ERROR,
          lastSyncStatus: "未解析",
        }),
      }),
    );
  });

  it("keeps calendar runtime pending when a workspace calendar registry already exists", async () => {
    dbMock.connector.findUnique.mockResolvedValue(
      buildConnector({
        accessToken: "corp-token",
        boundCalendars: [
          {
            calendarId: "cal_1",
            calendarName: "Sales calendar",
            ownerUserId: "owner-user",
          },
        ],
      }),
    );
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.startsWith("https://qyapi.weixin.qq.com/cgi-bin/meeting/get_user_meetingid")) {
        return jsonResponse({
          errcode: 0,
          errmsg: "ok",
          meetingid_list: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await syncWeComReadonlyConnector({
      workspaceId: "workspace-1",
      userId: "user-1",
      english: true,
      sourcePage: "/settings",
      triggeredBy: "Owner",
    });

    expect(
      result.ingestResult.scopeResults.find((scope) => scope.scope === "CALENDAR"),
    ).toEqual(
      expect.objectContaining({
        status: "UNRESOLVED",
        message: expect.stringContaining("registry is established"),
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });
});
