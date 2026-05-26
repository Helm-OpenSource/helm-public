import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorStatus } from "@prisma/client";

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
  buildFeishuAuthUrl,
  buildFeishuCallbackResult,
  exchangeFeishuAuthCode,
  fetchFeishuAppAccessToken,
  fetchFeishuTenantAccessToken,
  fetchFeishuUserProfile,
  getFeishuBitableConfig,
  getFeishuConfig,
  getFeishuDirectorySyncMode,
  getFeishuReadOnlyCoverage,
  isFeishuBitableConfigured,
  isFeishuDirectorySyncConfigured,
  isFeishuOauthConfigured,
  parseFeishuConnectorMetadata,
  persistFeishuConnectorCallbackResult,
  persistFeishuConnectorIngestResult,
} from "@/lib/connectors/feishu";

describe("feishu connector runtime foundation", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;
  const originalRedirectUri = process.env.FEISHU_REDIRECT_URI;
  const originalBitableAppToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const originalBitableTableId = process.env.FEISHU_BITABLE_TABLE_ID;
  const originalBitableViewId = process.env.FEISHU_BITABLE_VIEW_ID;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    dbMock.connector.upsert.mockResolvedValue({
      id: "connector-1",
      provider: "FEISHU",
    });
  });

  afterEach(() => {
    process.env.APP_URL = originalAppUrl;
    process.env.FEISHU_APP_ID = originalAppId;
    process.env.FEISHU_APP_SECRET = originalAppSecret;
    process.env.FEISHU_REDIRECT_URI = originalRedirectUri;
    process.env.FEISHU_BITABLE_APP_TOKEN = originalBitableAppToken;
    process.env.FEISHU_BITABLE_TABLE_ID = originalBitableTableId;
    process.env.FEISHU_BITABLE_VIEW_ID = originalBitableViewId;
    global.fetch = originalFetch;
  });

  it("derives the default redirect uri from APP_URL", () => {
    process.env.APP_URL = "https://helm.example.com/";
    delete process.env.FEISHU_REDIRECT_URI;

    expect(getFeishuConfig().redirectUri).toBe("https://helm.example.com/api/auth/feishu/callback");
  });

  it("requires redirect uri for oauth readiness", () => {
    delete process.env.APP_URL;
    process.env.FEISHU_APP_ID = "cli_app_123";
    process.env.FEISHU_APP_SECRET = "secret-1";
    delete process.env.FEISHU_REDIRECT_URI;

    expect(isFeishuOauthConfigured()).toBe(false);
    expect(isFeishuDirectorySyncConfigured()).toBe(true);
  });

  it("reports oauth readiness and bitable-first read-only coverage when config exists", () => {
    process.env.APP_URL = "https://helm.example.com";
    process.env.FEISHU_APP_ID = "cli_app_123";
    process.env.FEISHU_APP_SECRET = "secret-1";

    expect(isFeishuOauthConfigured()).toBe(true);
    expect(isFeishuDirectorySyncConfigured()).toBe(true);
    expect(getFeishuDirectorySyncMode()).toBe("HELM_DIRECTORY_SYNC_ADAPTER");
    expect(getFeishuReadOnlyCoverage()).toEqual(["BITABLE"]);
  });

  it("reports bitable binding readiness from env-backed config", () => {
    process.env.FEISHU_BITABLE_APP_TOKEN = "appb123";
    process.env.FEISHU_BITABLE_TABLE_ID = "tbl123";
    process.env.FEISHU_BITABLE_VIEW_ID = "vew123";

    expect(isFeishuBitableConfigured()).toBe(true);
    expect(getFeishuBitableConfig()).toEqual({
      appToken: "appb123",
      tableId: "tbl123",
      viewId: "vew123",
      pageSize: 100,
      maxPages: 3,
    });
  });

  it("parses provider metadata with stable defaults", () => {
    const metadata = parseFeishuConnectorMetadata(null);

    expect(metadata.authMode).toBe("oauth_callback_foundation");
    expect(metadata.readOnlyCoverage).toEqual(["BITABLE"]);
    expect(metadata.scopes).toContain("contact:contact.base:readonly");
  });

  it("builds the oauth authorize url", () => {
    process.env.FEISHU_APP_ID = "cli_app_123";
    process.env.FEISHU_REDIRECT_URI = "https://helm.example.com/api/auth/feishu/callback";

    const url = buildFeishuAuthUrl("state-1");

    expect(url).toContain("https://accounts.feishu.cn/open-apis/authen/v1/authorize?");
    expect(url).toContain("client_id=cli_app_123");
    expect(url).toContain("state=state-1");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fhelm.example.com%2Fapi%2Fauth%2Ffeishu%2Fcallback");
  });

  it("fetches app access token then exchanges code into a user access token", async () => {
    process.env.FEISHU_APP_ID = "cli_app_123";
    process.env.FEISHU_APP_SECRET = "secret-1";
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            msg: "ok",
            app_access_token: "app-token-1",
            expire: 7200,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            msg: "ok",
            app_access_token: "app-token-1",
            expire: 7200,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            msg: "success",
            data: {
              access_token: "user-token-1",
              refresh_token: "refresh-token-1",
              expires_in: 7199,
              refresh_expires_in: 2591999,
              open_id: "ou_feishu_1",
              union_id: "on_union_1",
              name: "Owner",
              en_name: "Owner",
            },
          }),
        ),
      );

    const appToken = await fetchFeishuAppAccessToken();
    const result = await exchangeFeishuAuthCode("code-1");

    expect(appToken).toEqual({
      appAccessToken: "app-token-1",
      expireInSeconds: 7200,
    });
    expect(result).toEqual({
      accessToken: "user-token-1",
      refreshToken: "refresh-token-1",
      expireInSeconds: 7199,
      refreshExpireInSeconds: 2591999,
      openId: "ou_feishu_1",
      unionId: "on_union_1",
      tenantKey: null,
    });
  });

  it("fetches a tenant access token for read-only bitable ingest", async () => {
    process.env.FEISHU_APP_ID = "cli_app_123";
    process.env.FEISHU_APP_SECRET = "secret-1";
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          msg: "ok",
          tenant_access_token: "tenant-token-1",
          expire: 7200,
        }),
      ),
    );

    await expect(fetchFeishuTenantAccessToken()).resolves.toEqual({
      tenantAccessToken: "tenant-token-1",
      expireInSeconds: 7200,
    });
  });

  it("fetches a Feishu user profile from authen user info", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          msg: "success",
          data: {
            name: "Owner",
            en_name: "Owner",
            avatar_url: "https://example.com/avatar.png",
            email: "owner@helm.so",
            mobile: "13800138000",
            open_id: "ou_feishu_1",
            union_id: "on_union_1",
            user_id: "feishu-user-1",
          },
        }),
      ),
    );

    const result = await fetchFeishuUserProfile("user-token-1");

    expect(result).toEqual({
      email: "owner@helm.so",
      mobile: "13800138000",
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: "ou_feishu_1",
      unionId: "on_union_1",
      userId: "feishu-user-1",
    });
  });

  it("persists callback metadata onto the workspace-scoped Feishu connector", async () => {
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      metadata: JSON.stringify({
        authMode: "oauth_callback_foundation",
        lastResolvedOpenId: "ou_old",
      }),
    });

    const callbackResult = buildFeishuCallbackResult({
      status: "SUCCESS",
      failurePosture: "CLEAR",
      message: "connected",
      matchedWorkspaceUserEmail: "owner@helm.so",
      profile: {
        email: "owner@helm.so",
        mobile: "13800138000",
        nick: "Owner",
        avatarUrl: null,
        openId: "ou_feishu_1",
        unionId: "on_union_1",
        userId: "feishu-user-1",
      },
    });

    await persistFeishuConnectorCallbackResult({
      workspaceId: "workspace-1",
      userId: "user-1",
      connectorStatus: ConnectorStatus.CONNECTED,
      externalAccountEmail: "owner@helm.so",
      accessToken: "user-token-1",
      refreshToken: "refresh-token-1",
      expireInSeconds: 7199,
      lastSyncStatus: "OAuth callback connected",
      lastSyncMessage: "connected",
      callbackResult,
    });

    expect(dbMock.connector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: "FEISHU",
          status: "CONNECTED",
        }),
        update: expect.objectContaining({
          status: "CONNECTED",
          metadata: expect.stringContaining("\"lastResolvedUnionId\":\"on_union_1\""),
        }),
      }),
    );

    const metadata = parseFeishuConnectorMetadata(
      dbMock.connector.upsert.mock.calls[0]?.[0]?.update?.metadata,
    );
    expect(metadata.lastCallbackResult?.status).toBe("SUCCESS");
    expect(metadata.lastResolvedOpenId).toBe("ou_feishu_1");
    expect(metadata.lastResolvedUnionId).toBe("on_union_1");
  });

  it("persists read-only ingest metadata onto the workspace-scoped Feishu connector", async () => {
    dbMock.connector.findUnique.mockResolvedValue({
      id: "connector-1",
      metadata: JSON.stringify({
        authMode: "oauth_callback_foundation",
        lastCallbackResult: {
          status: "SUCCESS",
          failurePosture: "CLEAR",
          recordedAt: "2026-05-20T08:00:00.000Z",
          message: "connected",
          providerEmail: "owner@helm.so",
          providerMobile: null,
          providerNick: "Owner",
          providerAvatarUrl: null,
          providerOpenId: "ou_feishu_1",
          providerUnionId: "on_union_1",
          providerUserId: "feishu-user-1",
          matchedWorkspaceUserEmail: "owner@helm.so",
          tenantKey: "tenant-key-1",
        },
      }),
    });
    dbMock.connector.update.mockResolvedValue({
      id: "connector-1",
      provider: "FEISHU",
      status: "CONNECTED",
    });

    await persistFeishuConnectorIngestResult({
      workspaceId: "workspace-1",
      userId: "user-1",
      connectorStatus: ConnectorStatus.CONNECTED,
      lastSyncStatus: "同步完成",
      lastSyncMessage: "飞书多维表格只读采集已完成，生成 2 条已保存采集资料。",
      ingestResult: {
        status: "SUCCESS",
        failurePosture: "CLEAR",
        recordedAt: "2026-05-21T08:00:00.000Z",
        sourcePage: "/settings",
        message: "ok",
        runtimeEventId: "runtime-event-1",
        runtimeSessionId: "runtime-session-1",
        notebookId: "notebook-1",
        windowStart: "2026-05-21T08:00:00.000Z",
        windowEnd: "2026-05-21T08:00:00.000Z",
        persistedPayloadCount: 2,
        ingestionRecordCount: 2,
        handleCount: 2,
        scopeResults: [
          {
            scope: "BITABLE",
            status: "INGESTED",
            message: "ok",
            docUrl:
              "https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/list",
            persistedPayloadCount: 2,
            ingestionRecordCount: 2,
            handleCount: 2,
            latestSourceId: "rec1",
          },
        ],
      },
    });

    expect(dbMock.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CONNECTED",
          metadata: expect.stringContaining("\"lastIngestResult\""),
        }),
      }),
    );

    const metadata = parseFeishuConnectorMetadata(
      dbMock.connector.update.mock.calls[0]?.[0]?.data?.metadata,
    );
    expect(metadata.lastIngestResult?.status).toBe("SUCCESS");
    expect(metadata.lastIngestResult?.scopeResults[0]?.scope).toBe("BITABLE");
  });
});
