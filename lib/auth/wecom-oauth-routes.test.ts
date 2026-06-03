import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  revalidatePathMock,
  sessionMock,
  importGovernanceMock,
  oauthCallbackGovernanceMock,
  wecomMock,
  analyticsMock,
  auditMock,
  dbMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
    getCurrentUser: vi.fn(),
    createSession: vi.fn(),
  },
  importGovernanceMock: {
    canManageWorkspaceConnectors: vi.fn(),
    getConnectorManagementDeniedMessage: vi.fn(),
  },
  oauthCallbackGovernanceMock: {
    resolveWorkspaceOauthCallbackContext: vi.fn(),
  },
  wecomMock: {
    buildWeComAuthUrl: vi.fn(),
    exchangeWeComAuthCode: vi.fn(),
    fetchWeComUserProfile: vi.fn(),
    getWeComStateCookieName: vi.fn(),
    isWeComOauthConfigured: vi.fn(),
    buildWeComCallbackResult: vi.fn(),
    persistWeComConnectorCallbackResult: vi.fn(),
    WECOM_CALLBACK_FAILURE_POSTURES: {
      CLEAR: "CLEAR",
      RETRYABLE: "RETRYABLE",
      REVIEW_REQUIRED: "REVIEW_REQUIRED",
    },
    WECOM_CALLBACK_RESULT_STATUSES: {
      SUCCESS: "SUCCESS",
      FAILURE: "FAILURE",
      UNRESOLVED: "UNRESOLVED",
      MISMATCH: "MISMATCH",
    },
    WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS: {
      SUCCESS: "WECOM_OAUTH_CALLBACK_SUCCEEDED",
      FAILURE: "WECOM_OAUTH_CALLBACK_FAILED",
      UNRESOLVED: "WECOM_OAUTH_CALLBACK_UNRESOLVED",
      MISMATCH: "WECOM_OAUTH_CALLBACK_MISMATCH",
    },
    WECOM_OAUTH_CALLBACK_SOURCE_PAGE: "/api/auth/wecom/callback",
  },
  analyticsMock: {
    logEvent: vi.fn(),
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
  dbMock: {
    workspace: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
  getCurrentUser: sessionMock.getCurrentUser,
  createSession: sessionMock.createSession,
}));

vi.mock("@/lib/auth/import-governance", () => ({
  canManageWorkspaceConnectors: importGovernanceMock.canManageWorkspaceConnectors,
  getConnectorManagementDeniedMessage: importGovernanceMock.getConnectorManagementDeniedMessage,
}));

vi.mock("@/lib/auth/oauth-callback-governance", () => ({
  resolveWorkspaceOauthCallbackContext:
    oauthCallbackGovernanceMock.resolveWorkspaceOauthCallbackContext,
}));

vi.mock("@/lib/connectors/wecom", () => ({
  buildWeComAuthUrl: wecomMock.buildWeComAuthUrl,
  exchangeWeComAuthCode: wecomMock.exchangeWeComAuthCode,
  fetchWeComUserProfile: wecomMock.fetchWeComUserProfile,
  getWeComStateCookieName: wecomMock.getWeComStateCookieName,
  isWeComOauthConfigured: wecomMock.isWeComOauthConfigured,
  buildWeComCallbackResult: wecomMock.buildWeComCallbackResult,
  persistWeComConnectorCallbackResult: wecomMock.persistWeComConnectorCallbackResult,
  WECOM_CALLBACK_FAILURE_POSTURES: wecomMock.WECOM_CALLBACK_FAILURE_POSTURES,
  WECOM_CALLBACK_RESULT_STATUSES: wecomMock.WECOM_CALLBACK_RESULT_STATUSES,
  WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS: wecomMock.WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS,
  WECOM_OAUTH_CALLBACK_SOURCE_PAGE: wecomMock.WECOM_OAUTH_CALLBACK_SOURCE_PAGE,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: analyticsMock.logEvent,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

import { GET as startWeComOauthRoute } from "@/app/api/auth/wecom/start/route";
import { GET as wecomCallbackRoute } from "@/app/api/auth/wecom/callback/route";

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    get: vi.fn((name: string) => {
      const value = values.get(name);
      return value ? { name, value } : undefined;
    }),
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
  };
}

describe("wecom oauth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wecomMock.getWeComStateCookieName.mockReturnValue("helm-wecom-oauth-state");
    wecomMock.buildWeComAuthUrl.mockReturnValue(
      "https://open.weixin.qq.com/connect/oauth2/authorize?state=state-1#wechat_redirect",
    );
    wecomMock.isWeComOauthConfigured.mockReturnValue(true);
    importGovernanceMock.canManageWorkspaceConnectors.mockReturnValue(true);
    importGovernanceMock.getConnectorManagementDeniedMessage.mockReturnValue("connector denied");
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Owner", email: "owner@helm.so" },
      membership: { role: "OWNER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    sessionMock.getCurrentUser.mockResolvedValue({ id: "user-1", name: "Owner" });
    sessionMock.createSession.mockResolvedValue({ id: "auth-session-1" });
    oauthCallbackGovernanceMock.resolveWorkspaceOauthCallbackContext.mockResolvedValue({
      ok: true,
      workspaceId: "workspace-1",
      userId: "user-1",
      role: "OWNER",
      user: { id: "user-1", name: "Owner" },
    });
    dbMock.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      defaultLocale: "en-US",
    });
    dbMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@helm.so",
      name: "Owner",
      phone: "+8613800138000",
    });
    wecomMock.exchangeWeComAuthCode.mockResolvedValue({
      accessToken: "corp-token",
      expireInSeconds: 7200,
      corpId: "corp-1",
      userId: "wecom-user-1",
      openId: null,
      externalUserId: null,
      deviceId: null,
    });
    wecomMock.fetchWeComUserProfile.mockResolvedValue({
      email: "owner@helm.so",
      mobile: "13800138000",
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: null,
      unionId: null,
      userId: "wecom-user-1",
    });
    wecomMock.buildWeComCallbackResult.mockImplementation((input: Record<string, unknown>) => ({
      status: input.status,
      failurePosture: input.failurePosture,
      message: input.message ?? null,
      recordedAt: "2026-04-07T12:00:00.000Z",
      providerEmail: "owner@helm.so",
      providerMobile: "13800138000",
      providerNick: "Owner",
      providerAvatarUrl: "https://example.com/avatar.png",
      providerOpenId: null,
      providerUnionId: null,
      providerUserId: "wecom-user-1",
      matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail ?? "owner@helm.so",
      corpId: input.corpId ?? "corp-1",
    }));
    wecomMock.persistWeComConnectorCallbackResult.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "WECOM",
    });
  });

  it("starts WeCom OAuth from a connector-managed workspace session", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await startWeComOauthRoute(
      new Request("http://localhost/api/auth/wecom/start"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://open.weixin.qq.com/connect/oauth2/authorize?state=state-1#wechat_redirect",
    );
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set.mock.calls[0]?.[0]).toBe("helm-wecom-oauth-state");
    expect(cookieStore.set.mock.calls[0]?.[1]).toContain("\"provider\":\"wecom\"");
  });

  it("completes WeCom callback, writes providerType session truth, and redirects to settings", async () => {
    const cookieStore = createCookieStore({
      "helm-wecom-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "wecom",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await wecomCallbackRoute(
      new Request("http://localhost/api/auth/wecom/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=wecom&status=connected",
    );
    expect(sessionMock.createSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "owner@helm.so",
      workspaceId: "workspace-1",
      sourcePage: "/api/auth/wecom/callback",
      providerType: "WECOM_OAUTH",
    });
    expect(wecomMock.persistWeComConnectorCallbackResult).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        connectorStatus: "CONNECTED",
        externalAccountEmail: "owner@helm.so",
      }),
    );
    expect(
      auditMock.writeAuditLog.mock.calls.some(
        (call) => call[0]?.actionType === "WECOM_OAUTH_CALLBACK_SUCCEEDED",
      ),
    ).toBe(true);
    expect(
      auditMock.writeAuditLog.mock.calls.some(
        (call) => call[0]?.actionType === "CONNECTOR_CONNECTED",
      ),
    ).toBe(true);
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        eventName: "connector_connected",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
  });

  it("localizes unresolved workspace callback context from request locale before exchange", async () => {
    const cookieStore = createCookieStore({
      "helm-wecom-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "wecom",
      }),
      "helm-ui-locale": "zh-CN",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.workspace.findUnique.mockResolvedValue(null);

    const response = await wecomCallbackRoute(
      new Request("http://localhost/api/auth/wecom/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(decodeURIComponent(response.headers.get("location") ?? "")).toContain(
      "无法解析工作区回调上下文。",
    );
    expect(oauthCallbackGovernanceMock.resolveWorkspaceOauthCallbackContext).toHaveBeenCalledWith(
      expect.objectContaining({ english: false }),
    );
    expect(wecomMock.exchangeWeComAuthCode).not.toHaveBeenCalled();
  });

  it("records a mismatch posture when WeCom identity does not match the active workspace user", async () => {
    const cookieStore = createCookieStore({
      "helm-wecom-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "wecom",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    wecomMock.fetchWeComUserProfile.mockResolvedValue({
      email: "other@helm.so",
      mobile: "13900000000",
      nick: "Other",
      avatarUrl: null,
      openId: null,
      unionId: null,
      userId: "wecom-user-2",
    });
    wecomMock.buildWeComCallbackResult.mockImplementation((input: Record<string, unknown>) => ({
      status: input.status,
      failurePosture: input.failurePosture,
      message: input.message ?? null,
      recordedAt: "2026-04-07T12:00:00.000Z",
      providerEmail: "other@helm.so",
      providerMobile: "13900000000",
      providerNick: "Other",
      providerAvatarUrl: null,
      providerOpenId: null,
      providerUnionId: null,
      providerUserId: "wecom-user-2",
      matchedWorkspaceUserEmail: "owner@helm.so",
      corpId: "corp-1",
    }));

    const response = await wecomCallbackRoute(
      new Request("http://localhost/api/auth/wecom/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=wecom&status=mismatch",
    );
    expect(sessionMock.createSession).not.toHaveBeenCalled();
    expect(
      auditMock.writeAuditLog.mock.calls.some(
        (call) => call[0]?.actionType === "WECOM_OAUTH_CALLBACK_MISMATCH",
      ),
    ).toBe(true);
  });

  it("records an unresolved posture when WeCom does not return bindable identity fields", async () => {
    const cookieStore = createCookieStore({
      "helm-wecom-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "wecom",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    wecomMock.exchangeWeComAuthCode.mockResolvedValue({
      accessToken: "corp-token",
      expireInSeconds: 7200,
      corpId: "corp-1",
      userId: null,
      openId: "open-id-1",
      externalUserId: null,
      deviceId: null,
    });
    wecomMock.fetchWeComUserProfile.mockResolvedValue({
      email: null,
      mobile: null,
      nick: null,
      avatarUrl: null,
      openId: "open-id-1",
      unionId: null,
      userId: null,
    });
    wecomMock.buildWeComCallbackResult.mockImplementation((input: Record<string, unknown>) => ({
      status: input.status,
      failurePosture: input.failurePosture,
      message: input.message ?? null,
      recordedAt: "2026-04-07T12:00:00.000Z",
      providerEmail: null,
      providerMobile: null,
      providerNick: null,
      providerAvatarUrl: null,
      providerOpenId: "open-id-1",
      providerUnionId: null,
      providerUserId: null,
      matchedWorkspaceUserEmail: null,
      corpId: "corp-1",
    }));

    const response = await wecomCallbackRoute(
      new Request("http://localhost/api/auth/wecom/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=wecom&status=unresolved",
    );
    expect(sessionMock.createSession).not.toHaveBeenCalled();
    expect(
      auditMock.writeAuditLog.mock.calls.some(
        (call) => call[0]?.actionType === "WECOM_OAUTH_CALLBACK_UNRESOLVED",
      ),
    ).toBe(true);
  });
});
