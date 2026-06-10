import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  revalidatePathMock,
  sessionMock,
  importGovernanceMock,
  oauthCallbackGovernanceMock,
  feishuMock,
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
  feishuMock: {
    buildFeishuAuthUrl: vi.fn(),
    exchangeFeishuAuthCode: vi.fn(),
    fetchFeishuUserProfile: vi.fn(),
    getFeishuStateCookieName: vi.fn(),
    isFeishuOauthConfigured: vi.fn(),
    buildFeishuCallbackResult: vi.fn(),
    persistFeishuConnectorCallbackResult: vi.fn(),
    FEISHU_CALLBACK_FAILURE_POSTURES: {
      CLEAR: "CLEAR",
      RETRYABLE: "RETRYABLE",
      REVIEW_REQUIRED: "REVIEW_REQUIRED",
    },
    FEISHU_CALLBACK_RESULT_STATUSES: {
      SUCCESS: "SUCCESS",
      FAILURE: "FAILURE",
      UNRESOLVED: "UNRESOLVED",
      MISMATCH: "MISMATCH",
    },
    FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS: {
      SUCCESS: "FEISHU_OAUTH_CALLBACK_SUCCEEDED",
      FAILURE: "FEISHU_OAUTH_CALLBACK_FAILED",
      UNRESOLVED: "FEISHU_OAUTH_CALLBACK_UNRESOLVED",
      MISMATCH: "FEISHU_OAUTH_CALLBACK_MISMATCH",
    },
    FEISHU_OAUTH_CALLBACK_SOURCE_PAGE: "/api/auth/feishu/callback",
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

vi.mock("@/lib/connectors/feishu", () => ({
  buildFeishuAuthUrl: feishuMock.buildFeishuAuthUrl,
  exchangeFeishuAuthCode: feishuMock.exchangeFeishuAuthCode,
  fetchFeishuUserProfile: feishuMock.fetchFeishuUserProfile,
  getFeishuStateCookieName: feishuMock.getFeishuStateCookieName,
  isFeishuOauthConfigured: feishuMock.isFeishuOauthConfigured,
  buildFeishuCallbackResult: feishuMock.buildFeishuCallbackResult,
  persistFeishuConnectorCallbackResult: feishuMock.persistFeishuConnectorCallbackResult,
  FEISHU_CALLBACK_FAILURE_POSTURES: feishuMock.FEISHU_CALLBACK_FAILURE_POSTURES,
  FEISHU_CALLBACK_RESULT_STATUSES: feishuMock.FEISHU_CALLBACK_RESULT_STATUSES,
  FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS: feishuMock.FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS,
  FEISHU_OAUTH_CALLBACK_SOURCE_PAGE: feishuMock.FEISHU_OAUTH_CALLBACK_SOURCE_PAGE,
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

import { GET as startFeishuOauthRoute } from "@/app/api/auth/feishu/start/route";
import { GET as feishuCallbackRoute } from "@/app/api/auth/feishu/callback/route";

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

describe("feishu oauth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feishuMock.getFeishuStateCookieName.mockReturnValue("helm-feishu-oauth-state");
    feishuMock.buildFeishuAuthUrl.mockReturnValue(
      "https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=state-1",
    );
    feishuMock.isFeishuOauthConfigured.mockReturnValue(true);
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
    feishuMock.exchangeFeishuAuthCode.mockResolvedValue({
      accessToken: "user-token-1",
      refreshToken: "refresh-token-1",
      expireInSeconds: 7199,
      refreshExpireInSeconds: 2591999,
      openId: "ou_feishu_1",
      unionId: "on_union_1",
      tenantKey: null,
    });
    feishuMock.fetchFeishuUserProfile.mockResolvedValue({
      email: "owner@helm.so",
      mobile: "13800138000",
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: "ou_feishu_1",
      unionId: "on_union_1",
      userId: "feishu-user-1",
    });
    feishuMock.buildFeishuCallbackResult.mockImplementation((input: Record<string, unknown>) => ({
      status: input.status,
      failurePosture: input.failurePosture,
      message: input.message ?? null,
      recordedAt: "2026-05-20T12:00:00.000Z",
      providerEmail: "owner@helm.so",
      providerMobile: "13800138000",
      providerNick: "Owner",
      providerAvatarUrl: "https://example.com/avatar.png",
      providerOpenId: "ou_feishu_1",
      providerUnionId: "on_union_1",
      providerUserId: "feishu-user-1",
      matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail ?? "owner@helm.so",
      tenantKey: input.tenantKey ?? null,
    }));
    feishuMock.persistFeishuConnectorCallbackResult.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "FEISHU",
    });
  });

  it("starts Feishu OAuth from a connector-managed workspace session", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await startFeishuOauthRoute(
      new Request("http://localhost/api/auth/feishu/start"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=state-1",
    );
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set.mock.calls[0]?.[0]).toBe("helm-feishu-oauth-state");
    expect(cookieStore.set.mock.calls[0]?.[1]).toContain("\"provider\":\"feishu\"");
  });

  it("completes Feishu callback, writes providerType session truth, and redirects to settings", async () => {
    const cookieStore = createCookieStore({
      "helm-feishu-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "feishu",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await feishuCallbackRoute(
      new Request("http://localhost/api/auth/feishu/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=feishu&status=connected",
    );
    expect(sessionMock.createSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "owner@helm.so",
      workspaceId: "workspace-1",
      sourcePage: "/api/auth/feishu/callback",
      providerType: "FEISHU_OAUTH",
    });
    expect(feishuMock.persistFeishuConnectorCallbackResult).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        connectorStatus: "CONNECTED",
      }),
    );
    expect(auditMock.writeAuditLog.mock.calls.some((call) => call[0]?.actionType === "FEISHU_OAUTH_CALLBACK_SUCCEEDED")).toBe(true);
  });

  it("localizes unresolved workspace callback context from request locale before exchange", async () => {
    const cookieStore = createCookieStore({
      "helm-feishu-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "feishu",
      }),
      "helm-ui-locale": "zh-CN",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.workspace.findUnique.mockResolvedValue(null);

    const response = await feishuCallbackRoute(
      new Request("http://localhost/api/auth/feishu/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(decodeURIComponent(response.headers.get("location") ?? "")).toContain(
      "无法解析工作区回调上下文。",
    );
    expect(oauthCallbackGovernanceMock.resolveWorkspaceOauthCallbackContext).toHaveBeenCalledWith(
      expect.objectContaining({ english: false }),
    );
    expect(feishuMock.exchangeFeishuAuthCode).not.toHaveBeenCalled();
  });

  it("localizes missing callback state from request locale before exchange", async () => {
    const cookieStore = createCookieStore({
      "helm-ui-locale": "zh-CN",
    });
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await feishuCallbackRoute(
      new Request("http://localhost/api/auth/feishu/callback?code=code-1"),
    );

    expect(response.status).toBe(307);
    const location = decodeURIComponent(response.headers.get("location") ?? "");
    expect(location).toContain("status=missing-state");
    expect(location).toContain("飞书回调状态缺失或已过期。");
    expect(oauthCallbackGovernanceMock.resolveWorkspaceOauthCallbackContext).not.toHaveBeenCalled();
    expect(feishuMock.exchangeFeishuAuthCode).not.toHaveBeenCalled();
  });

  it("marks mismatch when Feishu identity differs from current workspace user", async () => {
    const cookieStore = createCookieStore({
      "helm-feishu-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "feishu",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    feishuMock.fetchFeishuUserProfile.mockResolvedValue({
      email: "different@helm.so",
      mobile: "13900139000",
      nick: "Other",
      avatarUrl: "https://example.com/avatar.png",
      openId: "ou_feishu_1",
      unionId: "on_union_1",
      userId: "feishu-user-1",
    });

    const response = await feishuCallbackRoute(
      new Request("http://localhost/api/auth/feishu/callback?code=code-1&state=state-1"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=feishu&status=mismatch",
    );
    expect(feishuMock.persistFeishuConnectorCallbackResult).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorStatus: "ERROR",
      }),
    );
    expect(auditMock.writeAuditLog.mock.calls.some((call) => call[0]?.actionType === "FEISHU_OAUTH_CALLBACK_MISMATCH")).toBe(true);
  });
});
