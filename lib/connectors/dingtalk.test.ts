import { afterEach, describe, expect, it } from "vitest";
import {
  buildDingTalkAuthUrl,
  buildDingTalkCallbackResult,
  getDingTalkConfig,
  getDingTalkDirectorySyncMode,
  getDingTalkOauthScopes,
  getDingTalkReadOnlyCoverage,
  isDingTalkDirectorySyncConfigured,
  isDingTalkOauthConfigured,
  parseDingTalkConnectorMetadata,
} from "@/lib/connectors/dingtalk";

describe("dingtalk connector foundation", () => {
  const originalAppUrl = process.env.APP_URL;
  const originalClientId = process.env.DINGTALK_CLIENT_ID;
  const originalClientSecret = process.env.DINGTALK_CLIENT_SECRET;
  const originalRedirectUri = process.env.DINGTALK_REDIRECT_URI;
  const originalRobotCode = process.env.DINGTALK_ROBOT_CODE;
  const originalAgentId = process.env.DINGTALK_AGENT_ID;
  const originalCorpId = process.env.DINGTALK_CORP_ID;
  const originalCorpIdAlias = process.env.DINGTALK_CORPID;
  const originalNoticeToggle = process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS;

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (originalClientId === undefined) {
      delete process.env.DINGTALK_CLIENT_ID;
    } else {
      process.env.DINGTALK_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.DINGTALK_CLIENT_SECRET;
    } else {
      process.env.DINGTALK_CLIENT_SECRET = originalClientSecret;
    }

    if (originalRedirectUri === undefined) {
      delete process.env.DINGTALK_REDIRECT_URI;
    } else {
      process.env.DINGTALK_REDIRECT_URI = originalRedirectUri;
    }

    if (originalRobotCode === undefined) {
      delete process.env.DINGTALK_ROBOT_CODE;
    } else {
      process.env.DINGTALK_ROBOT_CODE = originalRobotCode;
    }

    if (originalAgentId === undefined) {
      delete process.env.DINGTALK_AGENT_ID;
    } else {
      process.env.DINGTALK_AGENT_ID = originalAgentId;
    }

    if (originalCorpId === undefined) {
      delete process.env.DINGTALK_CORP_ID;
    } else {
      process.env.DINGTALK_CORP_ID = originalCorpId;
    }

    if (originalCorpIdAlias === undefined) {
      delete process.env.DINGTALK_CORPID;
    } else {
      process.env.DINGTALK_CORPID = originalCorpIdAlias;
    }

    if (originalNoticeToggle === undefined) {
      delete process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS;
    } else {
      process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS = originalNoticeToggle;
    }
  });

  it("derives the default redirect uri from APP_URL", () => {
    process.env.APP_URL = "https://helm.example.com/";
    delete process.env.DINGTALK_REDIRECT_URI;

    expect(getDingTalkConfig().redirectUri).toBe(
      "https://helm.example.com/api/auth/dingtalk/callback",
    );
  });

  it("requires redirect uri for oauth readiness", () => {
    delete process.env.APP_URL;
    process.env.DINGTALK_CLIENT_ID = "client-id";
    process.env.DINGTALK_CLIENT_SECRET = "client-secret";
    delete process.env.DINGTALK_REDIRECT_URI;

    expect(isDingTalkOauthConfigured()).toBe(false);
    expect(isDingTalkDirectorySyncConfigured()).toBe(true);
  });

  it("reports oauth readiness when client credentials and redirect uri exist", () => {
    process.env.APP_URL = "https://helm.example.com";
    process.env.DINGTALK_CLIENT_ID = "client-id";
    process.env.DINGTALK_CLIENT_SECRET = "client-secret";

    expect(isDingTalkOauthConfigured()).toBe(true);
    expect(isDingTalkDirectorySyncConfigured()).toBe(true);
    expect(getDingTalkDirectorySyncMode()).toBe("HELM_DIRECTORY_SYNC_ADAPTER");
    expect(getDingTalkReadOnlyCoverage()).toEqual([
      "MEETINGS",
      "CALENDAR",
      "TODO",
      "PROJECTS",
      "MANAGEMENT",
      "WORK",
    ]);
  });

  it("builds an OAuth authorize URL with DingTalk callback scopes", () => {
    process.env.APP_URL = "https://helm.example.com";
    process.env.DINGTALK_CLIENT_ID = "client-id";
    process.env.DINGTALK_CLIENT_SECRET = "client-secret";

    const authUrl = new URL(buildDingTalkAuthUrl("state-1"));

    expect(authUrl.origin + authUrl.pathname).toBe("https://login.dingtalk.com/oauth2/auth");
    expect(authUrl.searchParams.get("client_id")).toBe("client-id");
    expect(authUrl.searchParams.get("redirect_uri")).toBe(
      "https://helm.example.com/api/auth/dingtalk/callback",
    );
    expect(authUrl.searchParams.get("state")).toBe("state-1");
    expect(authUrl.searchParams.get("response_type")).toBe("code");
    expect(authUrl.searchParams.get("prompt")).toBe("consent");
    expect(authUrl.searchParams.get("scope")).toBe(getDingTalkOauthScopes().join(" "));
  });

  it("normalizes callback result and metadata parsing for settings readout", () => {
    delete process.env.DINGTALK_ROBOT_CODE;
    delete process.env.DINGTALK_AGENT_ID;
    delete process.env.DINGTALK_CORP_ID;
    delete process.env.DINGTALK_CORPID;

    const callbackResult = buildDingTalkCallbackResult({
      status: "SUCCESS",
      failurePosture: "CLEAR",
      message: "connected",
      matchedWorkspaceUserEmail: "owner@helm.so",
      corpId: "ding-corp-1",
      profile: {
        email: "owner@helm.so",
        mobile: null,
        nick: "Owner",
        avatarUrl: "https://example.com/avatar.png",
        openId: "open-id-1",
        unionId: "union-id-1",
        userId: "ding-user-1",
      },
      recordedAt: new Date("2026-04-07T08:00:00.000Z"),
    });

    expect(
      parseDingTalkConnectorMetadata(
        JSON.stringify({
          lastCallbackResult: callbackResult,
          lastResolvedCorpId: "ding-corp-1",
          lastResolvedOpenId: "open-id-1",
          lastResolvedUnionId: "union-id-1",
        }),
      ),
    ).toMatchObject({
      authMode: "oauth_callback_foundation",
      directorySyncMode: "HELM_DIRECTORY_SYNC_ADAPTER",
      readOnlyCoverage: [
        "MEETINGS",
        "CALENDAR",
        "TODO",
        "PROJECTS",
        "MANAGEMENT",
        "WORK",
      ],
      lastResolvedCorpId: "ding-corp-1",
      lastResolvedOpenId: "open-id-1",
      lastResolvedUnionId: "union-id-1",
      lastCallbackResult: {
        status: "SUCCESS",
        providerEmail: "owner@helm.so",
        matchedWorkspaceUserEmail: "owner@helm.so",
        corpId: "ding-corp-1",
      },
      lastIngestResult: null,
    });
  });

  it("can include message notifications when explicitly enabled", () => {
    process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS = "1";
    expect(getDingTalkReadOnlyCoverage()).toEqual([
      "MEETINGS",
      "CALENDAR",
      "TODO",
      "PROJECTS",
      "MANAGEMENT",
      "WORK",
      "MESSAGE_NOTIFICATIONS",
    ]);
  });

  it("parses last ingest result metadata for operator readout", () => {
    expect(
      parseDingTalkConnectorMetadata(
        JSON.stringify({
          lastIngestResult: {
            status: "PARTIAL",
            failurePosture: "REVIEW_REQUIRED",
            recordedAt: "2026-04-07T12:00:00.000Z",
            sourcePage: "/settings",
            message: "calendar established, remaining scopes unresolved",
            runtimeEventId: "runtime-event-1",
            runtimeSessionId: "runtime-session-1",
            notebookId: "notebook-1",
            windowStart: "2026-04-01T00:00:00.000Z",
            windowEnd: "2026-05-01T00:00:00.000Z",
            persistedPayloadCount: 3,
            ingestionRecordCount: 3,
            handleCount: 3,
            scopeResults: [
              {
                scope: "CALENDAR",
                status: "INGESTED",
                message: "calendar established",
                docUrl:
                  "https://open.dingtalk.com/document/personalapp/query-an-event-list-1",
                persistedPayloadCount: 3,
                ingestionRecordCount: 3,
                handleCount: 3,
                latestSourceId: "evt-1",
              },
              {
                scope: "MEETINGS",
                status: "UNRESOLVED",
                message: "method/path still pending",
                docUrl:
                  "https://open.dingtalk.com/document/isvapp/api-queryorgconferencelist",
                persistedPayloadCount: 0,
                ingestionRecordCount: 0,
                handleCount: 0,
                latestSourceId: null,
              },
            ],
          },
        }),
      ),
    ).toMatchObject({
      lastIngestResult: {
        status: "PARTIAL",
        failurePosture: "REVIEW_REQUIRED",
        runtimeEventId: "runtime-event-1",
        persistedPayloadCount: 3,
        scopeResults: [
          {
            scope: "CALENDAR",
            status: "INGESTED",
          },
          {
            scope: "MEETINGS",
            status: "UNRESOLVED",
          },
        ],
      },
    });
  });
});
