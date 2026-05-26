import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorStatus } from "@prisma/client";
import { storeConnectorToken } from "@/lib/connectors/token-store";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    connector: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import {
  buildWeComAuthUrl,
  buildWeComCallbackResult,
  exchangeWeComAuthCode,
  fetchWeComUserProfile,
  getWeComConfig,
  getWeComDirectorySyncMode,
  getWeComReadOnlyCoverage,
  isWeComDirectorySyncConfigured,
  isWeComOauthConfigured,
  parseWeComConnectorMetadata,
  persistWeComConnectorCallbackResult,
  persistWeComConnectorIngestResult,
  validateAndPersistWeComCalendarRegistry,
} from "@/lib/connectors/wecom";

describe("wecom connector runtime foundation", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalClientId = process.env.WECOM_CLIENT_ID;
  const originalClientSecret = process.env.WECOM_CLIENT_SECRET;
  const originalRedirectUri = process.env.WECOM_REDIRECT_URI;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    dbMock.connector.update.mockResolvedValue({
      id: "connector-1",
      provider: "WECOM",
    });
  });

  afterEach(() => {
    process.env.APP_URL = originalAppUrl;
    process.env.WECOM_CLIENT_ID = originalClientId;
    process.env.WECOM_CLIENT_SECRET = originalClientSecret;
    process.env.WECOM_REDIRECT_URI = originalRedirectUri;
    global.fetch = originalFetch;
  });

  it("derives the default redirect uri from APP_URL", () => {
    process.env.APP_URL = "https://helm.example.com/";
    delete process.env.WECOM_REDIRECT_URI;

    expect(getWeComConfig().redirectUri).toBe("https://helm.example.com/api/auth/wecom/callback");
  });

  it("requires redirect uri for oauth readiness", () => {
    delete process.env.APP_URL;
    process.env.WECOM_CLIENT_ID = "corp-id";
    process.env.WECOM_CLIENT_SECRET = "corp-secret";
    delete process.env.WECOM_REDIRECT_URI;

    expect(isWeComOauthConfigured()).toBe(false);
    expect(isWeComDirectorySyncConfigured()).toBe(true);
  });

  it("reports oauth readiness and read-only coverage when config exists", () => {
    process.env.APP_URL = "https://helm.example.com";
    process.env.WECOM_CLIENT_ID = "corp-id";
    process.env.WECOM_CLIENT_SECRET = "corp-secret";

    expect(isWeComOauthConfigured()).toBe(true);
    expect(isWeComDirectorySyncConfigured()).toBe(true);
    expect(getWeComDirectorySyncMode()).toBe("HELM_DIRECTORY_SYNC_ADAPTER");
    expect(getWeComReadOnlyCoverage()).toEqual([
      "MEETINGS",
      "CALENDAR",
      "MESSAGE_NOTIFICATIONS",
    ]);
  });

  it("parses an empty calendar registry when metadata is missing", () => {
    const metadata = parseWeComConnectorMetadata(null);

    expect(metadata.calendarRegistry).toEqual({
      boundCalendars: [],
      lastValidationResult: null,
    });
  });

  it("builds the oauth authorize url", () => {
    process.env.WECOM_CLIENT_ID = "corp-id";
    process.env.WECOM_REDIRECT_URI = "https://helm.example.com/api/auth/wecom/callback";

    const url = buildWeComAuthUrl("state-1");

    expect(url).toContain("https://open.weixin.qq.com/connect/oauth2/authorize?");
    expect(url).toContain("appid=corp-id");
    expect(url).toContain("scope=snsapi_base");
    expect(url).toContain("state=state-1");
    expect(url).toContain("#wechat_redirect");
  });

  it("exchanges a code into corp token and authorized user identity", async () => {
    process.env.WECOM_CLIENT_ID = "corp-id";
    process.env.WECOM_CLIENT_SECRET = "corp-secret";
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, access_token: "corp-token", expires_in: 7200 })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errcode: 0, UserId: "wecom-user-1", DeviceId: "device-1" })),
      );

    const result = await exchangeWeComAuthCode("code-1");

    expect(result).toEqual({
      accessToken: "corp-token",
      expireInSeconds: 7200,
      corpId: "corp-id",
      userId: "wecom-user-1",
      openId: null,
      externalUserId: null,
      deviceId: "device-1",
    });
  });

  it("fetches a WeCom user profile from user/get", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          errcode: 0,
          userid: "wecom-user-1",
          email: "owner@helm.so",
          mobile: "13800138000",
          name: "Owner",
          avatar: "https://example.com/avatar.png",
        }),
      ),
    );

    const result = await fetchWeComUserProfile({
      accessToken: "corp-token",
      userId: "wecom-user-1",
    });

    expect(result).toEqual({
      email: "owner@helm.so",
      mobile: "13800138000",
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: null,
      unionId: null,
      userId: "wecom-user-1",
    });
  });

  it("persists callback metadata onto the workspace-scoped WeCom connector", async () => {
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      metadata: JSON.stringify({
        authMode: "oauth_callback_foundation",
        lastResolvedCorpId: "corp-old",
      }),
    });
    dbMock.connector.upsert.mockResolvedValue({
      id: "connector-1",
      provider: "WECOM",
    });

    const callbackResult = buildWeComCallbackResult({
      status: "SUCCESS",
      failurePosture: "CLEAR",
      message: "connected",
      corpId: "corp-id",
      matchedWorkspaceUserEmail: "owner@helm.so",
      profile: {
        email: "owner@helm.so",
        mobile: "13800138000",
        nick: "Owner",
        avatarUrl: null,
        openId: null,
        unionId: null,
        userId: "wecom-user-1",
      },
    });

    await persistWeComConnectorCallbackResult({
      workspaceId: "workspace-1",
      userId: "user-1",
      connectorStatus: ConnectorStatus.CONNECTED,
      externalAccountEmail: "owner@helm.so",
      accessToken: "corp-token",
      expireInSeconds: 7200,
      lastSyncStatus: "OAuth callback connected",
      lastSyncMessage: "connected",
      callbackResult,
    });

    expect(dbMock.connector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: "WECOM",
          status: "CONNECTED",
        }),
        update: expect.objectContaining({
          status: "CONNECTED",
          metadata: expect.stringContaining("\"lastResolvedUserId\":\"wecom-user-1\""),
        }),
      }),
    );

    const metadata = parseWeComConnectorMetadata(
      dbMock.connector.upsert.mock.calls[0]?.[0]?.update?.metadata,
    );
    expect(metadata.lastCallbackResult?.status).toBe("SUCCESS");
    expect(metadata.lastResolvedCorpId).toBe("corp-id");
    expect(metadata.lastResolvedUserId).toBe("wecom-user-1");
  });

  it("persists read-only ingest metadata onto the workspace-scoped WeCom connector", async () => {
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      metadata: JSON.stringify({
        authMode: "oauth_callback_foundation",
        lastCallbackResult: {
          status: "SUCCESS",
          failurePosture: "CLEAR",
        },
      }),
    });
    dbMock.connector.upsert.mockResolvedValue({
      id: "connector-1",
      provider: "WECOM",
    });

    await persistWeComConnectorIngestResult({
      workspaceId: "workspace-1",
      userId: "user-1",
      connectorStatus: ConnectorStatus.CONNECTED,
      lastSyncStatus: "部分完成",
      lastSyncMessage: "WeCom read-only ingest persisted 1 payload.",
      ingestResult: {
        status: "PARTIAL",
        failurePosture: "REVIEW_REQUIRED",
        recordedAt: "2026-04-07T08:00:00.000Z",
        sourcePage: "/settings",
        message: "WeCom read-only ingest persisted 1 payload.",
        runtimeEventId: "runtime-event-1",
        runtimeSessionId: "runtime-session-1",
        notebookId: "notebook-1",
        windowStart: "2026-04-01T00:00:00.000Z",
        windowEnd: "2026-05-01T00:00:00.000Z",
        persistedPayloadCount: 1,
        ingestionRecordCount: 1,
        handleCount: 1,
        scopeResults: [
          {
            scope: "MEETINGS",
            status: "INGESTED",
            message: "Meetings runtime established.",
            docUrl: "https://developer.work.weixin.qq.com/document/path/99050",
            persistedPayloadCount: 1,
            ingestionRecordCount: 1,
            handleCount: 1,
            latestSourceId: "meeting-1",
          },
          {
            scope: "CALENDAR",
            status: "UNRESOLVED",
            message: "Calendar registry missing.",
            docUrl: "https://developer.work.weixin.qq.com/document/path/97723",
            persistedPayloadCount: 0,
            ingestionRecordCount: 0,
            handleCount: 0,
            latestSourceId: null,
          },
        ],
      },
    });

    expect(dbMock.connector.findUnique).toHaveBeenCalled();
    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CONNECTED",
          metadata: expect.stringContaining("\"lastIngestResult\""),
        }),
      }),
    );
  });

  it("validates and persists a workspace-scoped calendar registry", async () => {
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "WECOM",
      accessToken: storeConnectorToken("corp-token"),
      metadata: JSON.stringify({
        authMode: "oauth_callback_foundation",
        calendarRegistry: {
          boundCalendars: [],
          lastValidationResult: null,
        },
      }),
    });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          errcode: 0,
          calendar: {
            cal_id: "cal_1",
            summary: "Sales calendar",
            creator: "owner-user",
          },
        }),
      ),
    );

    const result = await validateAndPersistWeComCalendarRegistry({
      workspaceId: "workspace-1",
      userId: "user-1",
      calendarIdsText: "cal_1",
      english: true,
      sourcePage: "/settings",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.boundCalendars).toEqual([
      expect.objectContaining({
        calendarId: "cal_1",
        calendarName: "Sales calendar",
        ownerUserId: "owner-user",
      }),
    ]);
    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "connector-1" },
        data: expect.objectContaining({
          lastSyncStatus: "Registry ready",
          metadata: expect.stringContaining("\"calendarRegistry\""),
        }),
      }),
    );

    const metadata = parseWeComConnectorMetadata(
      dbMock.connector.update.mock.calls.at(-1)?.[0]?.data?.metadata,
    );
    expect(metadata.calendarRegistry.boundCalendars).toEqual([
      expect.objectContaining({
        calendarId: "cal_1",
      }),
    ]);
    expect(metadata.calendarRegistry.lastValidationResult?.status).toBe("SUCCESS");
  });

  it("records unresolved registry validation when no access token is available", async () => {
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "WECOM",
      accessToken: null,
      metadata: JSON.stringify({
        authMode: "oauth_callback_foundation",
        calendarRegistry: {
          boundCalendars: [
            {
              calendarId: "cal_existing",
              calendarName: "Existing calendar",
              ownerUserId: "owner-user",
              recordedAt: "2026-04-07T08:00:00.000Z",
              sourcePage: "/settings",
              docUrl: "https://developer.work.weixin.qq.com/document/path/97717",
            },
          ],
          lastValidationResult: null,
        },
      }),
    });

    const result = await validateAndPersistWeComCalendarRegistry({
      workspaceId: "workspace-1",
      userId: "user-1",
      calendarIdsText: "cal_new",
      english: true,
      sourcePage: "/settings",
    });

    expect(result.status).toBe("UNRESOLVED");
    expect(result.boundCalendars).toEqual([
      expect.objectContaining({
        calendarId: "cal_existing",
      }),
    ]);
    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastSyncStatus: "Registry unresolved",
        }),
      }),
    );
  });
});
