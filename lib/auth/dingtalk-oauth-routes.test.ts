import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  revalidatePathMock,
  sessionMock,
  importGovernanceMock,
  oauthCallbackGovernanceMock,
  dingtalkMock,
  publicOauthMock,
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
  dingtalkMock: {
    buildDingTalkAuthUrl: vi.fn(),
    exchangeDingTalkAuthCode: vi.fn(),
    fetchDingTalkUserProfile: vi.fn(),
    getDingTalkStateCookieName: vi.fn(),
    isDingTalkOauthConfigured: vi.fn(),
    buildDingTalkCallbackResult: vi.fn(),
    persistDingTalkConnectorCallbackResult: vi.fn(),
    DINGTALK_CALLBACK_FAILURE_POSTURES: {
      CLEAR: "CLEAR",
      RETRYABLE: "RETRYABLE",
      REVIEW_REQUIRED: "REVIEW_REQUIRED",
    },
    DINGTALK_CALLBACK_RESULT_STATUSES: {
      SUCCESS: "SUCCESS",
      FAILURE: "FAILURE",
      UNRESOLVED: "UNRESOLVED",
      MISMATCH: "MISMATCH",
    },
    DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS: {
      SUCCESS: "DINGTALK_OAUTH_CALLBACK_SUCCEEDED",
      FAILURE: "DINGTALK_OAUTH_CALLBACK_FAILED",
      UNRESOLVED: "DINGTALK_OAUTH_CALLBACK_UNRESOLVED",
      MISMATCH: "DINGTALK_OAUTH_CALLBACK_MISMATCH",
    },
    DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE: "/api/auth/dingtalk/callback",
  },
  publicOauthMock: {
    DINGTALK_PUBLIC_AUTH_STATE_COOKIE: "helm-dingtalk-public-auth-state",
    readPublicOauthState: vi.fn(),
    consumePublicOauthStateByLookup: vi.fn(),
    resolvePublicOauthUserMatch: vi.fn(),
    finalizePublicOauthLogin: vi.fn(),
    buildPublicOauthFallbackUrl: vi.fn(),
    buildPublicOauthSignupUrl: vi.fn(),
    resolvePublicOauthRequestBaseUrl: vi.fn(),
    writePublicOauthSignupPrefillCookie: vi.fn(),
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

vi.mock("@/lib/connectors/dingtalk", () => ({
  buildDingTalkAuthUrl: dingtalkMock.buildDingTalkAuthUrl,
  exchangeDingTalkAuthCode: dingtalkMock.exchangeDingTalkAuthCode,
  fetchDingTalkUserProfile: dingtalkMock.fetchDingTalkUserProfile,
  getDingTalkStateCookieName: dingtalkMock.getDingTalkStateCookieName,
  isDingTalkOauthConfigured: dingtalkMock.isDingTalkOauthConfigured,
  buildDingTalkCallbackResult: dingtalkMock.buildDingTalkCallbackResult,
  persistDingTalkConnectorCallbackResult:
    dingtalkMock.persistDingTalkConnectorCallbackResult,
  DINGTALK_CALLBACK_FAILURE_POSTURES:
    dingtalkMock.DINGTALK_CALLBACK_FAILURE_POSTURES,
  DINGTALK_CALLBACK_RESULT_STATUSES:
    dingtalkMock.DINGTALK_CALLBACK_RESULT_STATUSES,
  DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS:
    dingtalkMock.DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS,
  DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE:
    dingtalkMock.DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
}));

vi.mock("@/lib/auth/public-oauth", () => ({
  DINGTALK_PUBLIC_AUTH_STATE_COOKIE:
    publicOauthMock.DINGTALK_PUBLIC_AUTH_STATE_COOKIE,
  readPublicOauthState: publicOauthMock.readPublicOauthState,
  consumePublicOauthStateByLookup: publicOauthMock.consumePublicOauthStateByLookup,
  resolvePublicOauthUserMatch: publicOauthMock.resolvePublicOauthUserMatch,
  finalizePublicOauthLogin: publicOauthMock.finalizePublicOauthLogin,
  buildPublicOauthFallbackUrl: publicOauthMock.buildPublicOauthFallbackUrl,
  buildPublicOauthSignupUrl: publicOauthMock.buildPublicOauthSignupUrl,
  resolvePublicOauthRequestBaseUrl: publicOauthMock.resolvePublicOauthRequestBaseUrl,
  writePublicOauthSignupPrefillCookie:
    publicOauthMock.writePublicOauthSignupPrefillCookie,
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

import { GET as startDingTalkOauthRoute } from "@/app/api/auth/dingtalk/start/route";
import { GET as dingtalkCallbackRoute } from "@/app/api/auth/dingtalk/callback/route";

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

describe("dingtalk oauth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dingtalkMock.getDingTalkStateCookieName.mockReturnValue("helm-dingtalk-oauth-state");
    publicOauthMock.resolvePublicOauthRequestBaseUrl.mockImplementation(
      (request: Request) => new URL(request.url).origin,
    );
    dingtalkMock.buildDingTalkAuthUrl.mockReturnValue(
      "https://login.dingtalk.com/oauth2/auth?state=state-1",
    );
    dingtalkMock.isDingTalkOauthConfigured.mockReturnValue(true);
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
    });
    dingtalkMock.exchangeDingTalkAuthCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expireInSeconds: 3600,
      corpId: "corp-1",
    });
    dingtalkMock.fetchDingTalkUserProfile.mockResolvedValue({
      email: "owner@helm.so",
      mobile: null,
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: "open-id-1",
      unionId: "union-id-1",
      userId: "ding-user-1",
    });
    dingtalkMock.buildDingTalkCallbackResult.mockImplementation((input: Record<string, unknown>) => ({
      status: input.status,
      failurePosture: input.failurePosture,
      message: input.message ?? null,
      recordedAt: "2026-04-07T12:00:00.000Z",
      providerEmail: "owner@helm.so",
      providerMobile: null,
      providerNick: "Owner",
      providerAvatarUrl: "https://example.com/avatar.png",
      providerOpenId: "open-id-1",
      providerUnionId: "union-id-1",
      providerUserId: "ding-user-1",
      matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail ?? "owner@helm.so",
      corpId: input.corpId ?? "corp-1",
    }));
    dingtalkMock.persistDingTalkConnectorCallbackResult.mockResolvedValue({
      id: "connector-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      provider: "DINGTALK",
    });
    publicOauthMock.readPublicOauthState.mockImplementation((rawState: string | null) => {
      if (!rawState) {
        return null;
      }

      try {
        const parsed = JSON.parse(rawState) as {
          state?: string;
          locale?: string;
          flowId?: string;
          workspaceId?: string;
        };

        return {
          state: parsed.state ?? null,
          locale: parsed.locale ?? "zh-CN",
          flowId: parsed.flowId ?? null,
          workspaceId: parsed.workspaceId ?? null,
        };
      } catch {
        return null;
      }
    });
    publicOauthMock.consumePublicOauthStateByLookup.mockResolvedValue(null);
    publicOauthMock.resolvePublicOauthUserMatch.mockResolvedValue({
      status: "matched",
      user: {
        id: "public-user-1",
        email: "owner@helm.so",
        phone: "+8613800138000",
        name: "Owner",
        memberships: [
          {
            workspaceId: "workspace-1",
            role: "OWNER",
            status: "ACTIVE",
            workspace: {
              id: "workspace-1",
              defaultLocale: "en-US",
              demoMode: false,
              profileType: null,
            },
          },
        ],
      },
      normalizedEmail: "owner@helm.so",
      normalizedPhone: "+8613800138000",
    });
    publicOauthMock.finalizePublicOauthLogin.mockResolvedValue({
      ok: true,
      redirectTo: "/dashboard",
    });
    publicOauthMock.buildPublicOauthFallbackUrl.mockImplementation(
      (request: Request, _provider?: string, status?: string) => {
        const url = new URL("/login", request.url);
        url.searchParams.set("tab", "phone");
        url.searchParams.set("provider", "dingtalk");
        if (status) {
          url.searchParams.set("status", status);
        }
        return url;
      },
    );
    publicOauthMock.buildPublicOauthSignupUrl.mockImplementation((request: Request) => {
      const url = new URL("/login", request.url);
      url.searchParams.set("tab", "signup");
      url.searchParams.set("provider", "dingtalk");
      url.searchParams.set("prefill", "1");
      return url;
    });
    publicOauthMock.writePublicOauthSignupPrefillCookie.mockImplementation(() => undefined);
  });

  it("starts DingTalk OAuth from a connector-managed workspace session", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await startDingTalkOauthRoute(
      new Request("http://localhost/api/auth/dingtalk/start"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://login.dingtalk.com/oauth2/auth?state=state-1",
    );
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set.mock.calls[0]?.[0]).toBe("helm-dingtalk-oauth-state");
    expect(cookieStore.set.mock.calls[0]?.[1]).toContain("\"provider\":\"dingtalk\"");
  });

  it("completes DingTalk callback, writes providerType session truth, and redirects to settings", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "dingtalk",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=dingtalk&status=connected",
    );
    expect(sessionMock.createSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "owner@helm.so",
      workspaceId: "workspace-1",
      sourcePage: "/api/auth/dingtalk/callback",
      providerType: "DINGTALK_OAUTH",
    });
    expect(dingtalkMock.persistDingTalkConnectorCallbackResult).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        connectorStatus: "CONNECTED",
        externalAccountEmail: "owner@helm.so",
      }),
    );
    expect(auditMock.writeAuditLog.mock.calls.some((call) => call[0]?.actionType === "DINGTALK_OAUTH_CALLBACK_SUCCEEDED")).toBe(true);
    expect(auditMock.writeAuditLog.mock.calls.some((call) => call[0]?.actionType === "CONNECTOR_CONNECTED")).toBe(true);
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        eventName: "connector_connected",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
  });

  it("records a mismatch posture when DingTalk identity does not match the active workspace user", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-oauth-state": JSON.stringify({
        state: "state-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        provider: "dingtalk",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dingtalkMock.fetchDingTalkUserProfile.mockResolvedValue({
      email: "other@helm.so",
      mobile: null,
      nick: "Other",
      avatarUrl: null,
      openId: "open-id-2",
      unionId: "union-id-2",
      userId: "ding-user-2",
    });
    dingtalkMock.buildDingTalkCallbackResult.mockImplementation((input: Record<string, unknown>) => ({
      status: input.status,
      failurePosture: input.failurePosture,
      message: input.message ?? null,
      recordedAt: "2026-04-07T12:00:00.000Z",
      providerEmail: "other@helm.so",
      providerMobile: null,
      providerNick: "Other",
      providerAvatarUrl: null,
      providerOpenId: "open-id-2",
      providerUnionId: "union-id-2",
      providerUserId: "ding-user-2",
      matchedWorkspaceUserEmail: "owner@helm.so",
      corpId: "corp-1",
    }));

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings?tab=connectors&connector=dingtalk&status=mismatch",
    );
    expect(sessionMock.createSession).not.toHaveBeenCalled();
    expect(dingtalkMock.persistDingTalkConnectorCallbackResult).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorStatus: "ERROR",
        externalAccountEmail: "other@helm.so",
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "DINGTALK_OAUTH_CALLBACK_MISMATCH",
      }),
    );
  });

  it("completes public DingTalk callback for matched users and redirects to workspace", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-public-auth-state": JSON.stringify({
        state: "public-state-1",
        locale: "zh-CN",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=public-state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    expect(publicOauthMock.resolvePublicOauthUserMatch).toHaveBeenCalledWith({
      email: "owner@helm.so",
      phone: null,
      preferPhoneMatch: true,
    });
    expect(publicOauthMock.finalizePublicOauthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePage: "/api/auth/dingtalk/callback",
      }),
    );
    expect(sessionMock.createSession).not.toHaveBeenCalled();
  });

  it("acknowledges matched public DingTalk callback in qr flow and also signs in the mobile browser", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-public-auth-state": JSON.stringify({
        state: "public-state-qr",
        locale: "zh-CN",
        flowId: "qr-flow-1",
        workspaceId: "workspace-1",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=public-state-qr",
      ),
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("登录确认成功");
    expect(html).toContain("进入 Helm 移动端");
    expect(html).toContain('href="/mobile"');
    expect(publicOauthMock.finalizePublicOauthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredWorkspaceId: "workspace-1",
      }),
    );
  });

  it("redirects unmatched public DingTalk users to signup and writes prefill cookie", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-public-auth-state": JSON.stringify({
        state: "public-state-1",
        locale: "zh-CN",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    publicOauthMock.resolvePublicOauthUserMatch.mockResolvedValue({
      status: "unmatched",
      normalizedEmail: "owner@helm.so",
      normalizedPhone: "+8613800138000",
    });
    dingtalkMock.fetchDingTalkUserProfile.mockResolvedValue({
      email: "owner@helm.so",
      mobile: "+8613800138000",
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: "open-id-1",
      unionId: "union-id-1",
      userId: "ding-user-1",
    });

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=public-state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?tab=signup&provider=dingtalk&prefill=1",
    );
    expect(publicOauthMock.writePublicOauthSignupPrefillCookie).toHaveBeenCalledWith(
      cookieStore,
      expect.objectContaining({
        provider: "dingtalk",
        email: "owner@helm.so",
        phone: "+8613800138000",
        name: "Owner",
      }),
    );
    expect(publicOauthMock.finalizePublicOauthLogin).not.toHaveBeenCalled();
  });

  it("blocks public DingTalk login when identity is conflicted", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-public-auth-state": JSON.stringify({
        state: "public-state-1",
        locale: "zh-CN",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    publicOauthMock.resolvePublicOauthUserMatch.mockResolvedValue({
      status: "identity-conflict",
      normalizedEmail: "owner@helm.so",
      normalizedPhone: "+8613800138000",
    });

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=public-state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?tab=phone&provider=dingtalk&status=identity-conflict",
    );
    expect(publicOauthMock.finalizePublicOauthLogin).not.toHaveBeenCalled();
  });

  it("blocks public DingTalk login when provider identity is missing", async () => {
    const cookieStore = createCookieStore({
      "helm-dingtalk-public-auth-state": JSON.stringify({
        state: "public-state-1",
        locale: "zh-CN",
      }),
    });
    cookiesMock.mockResolvedValue(cookieStore);
    publicOauthMock.resolvePublicOauthUserMatch.mockResolvedValue({
      status: "missing-identity",
      normalizedEmail: null,
      normalizedPhone: null,
    });
    dingtalkMock.fetchDingTalkUserProfile.mockResolvedValue({
      email: null,
      mobile: null,
      nick: "Owner",
      avatarUrl: null,
      openId: "open-id-1",
      unionId: "union-id-1",
      userId: "ding-user-1",
    });

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=public-state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?tab=phone&provider=dingtalk&status=missing-identity",
    );
    expect(publicOauthMock.finalizePublicOauthLogin).not.toHaveBeenCalled();
  });

  it("falls back to public login when callback has no state and no active user session", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);
    sessionMock.getCurrentUser.mockResolvedValue(null);

    const response = await dingtalkCallbackRoute(
      new Request("http://localhost/api/auth/dingtalk/callback"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?tab=phone&provider=dingtalk&status=failure",
    );
    expect(oauthCallbackGovernanceMock.resolveWorkspaceOauthCallbackContext).not.toHaveBeenCalled();
  });

  it("recovers public callback when state cookie is missing but snapshot exists", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);
    publicOauthMock.consumePublicOauthStateByLookup.mockResolvedValue({
      state: "public-state-1",
      locale: "zh-CN",
      flowId: null,
      organizationName: "Helm 组织",
      workspaceId: "workspace-1",
      title: "高级 JAVA 开发工程师",
    });
    publicOauthMock.resolvePublicOauthUserMatch.mockResolvedValue({
      status: "unmatched",
      normalizedEmail: "invitee@helm.so",
      normalizedPhone: "+8613800002222",
    });
    dingtalkMock.fetchDingTalkUserProfile.mockResolvedValue({
      email: "invitee@helm.so",
      mobile: "13800002222",
      nick: "测试主管甲",
      avatarUrl: null,
      openId: "open-id-1",
      unionId: "union-id-1",
      userId: "ding-user-1",
    });

    const response = await dingtalkCallbackRoute(
      new Request(
        "http://localhost/api/auth/dingtalk/callback?authCode=code-1&state=public-state-1",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?tab=signup&provider=dingtalk&prefill=1",
    );
    expect(publicOauthMock.consumePublicOauthStateByLookup).toHaveBeenCalledWith({
      provider: "dingtalk",
      state: "public-state-1",
    });
    expect(publicOauthMock.writePublicOauthSignupPrefillCookie).toHaveBeenCalled();
  });
});
