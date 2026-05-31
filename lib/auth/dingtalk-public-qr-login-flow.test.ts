import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  dingtalkMock,
  publicOauthMock,
  sessionMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  dingtalkMock: {
    isDingTalkOauthConfigured: vi.fn(),
    getDingTalkConfig: vi.fn(),
    exchangeDingTalkAuthCode: vi.fn(),
    fetchDingTalkUserProfile: vi.fn(),
    getDingTalkStateCookieName: vi.fn(),
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
    buildPublicAuthStartUrl: vi.fn(),
    buildPublicOauthFallbackUrl: vi.fn(),
    buildPublicOauthSignupUrl: vi.fn(),
    resolvePublicOauthRequestBaseUrl: vi.fn(),
    readPublicOauthState: vi.fn(),
    resolvePublicOauthUserMatch: vi.fn(),
    finalizePublicOauthLogin: vi.fn(),
    writePublicOauthSignupPrefillCookie: vi.fn(),
    findActivePublicOauthUserById: vi.fn(),
  },
  sessionMock: {
    getCurrentUser: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/connectors/dingtalk", () => ({
  isDingTalkOauthConfigured: dingtalkMock.isDingTalkOauthConfigured,
  getDingTalkConfig: dingtalkMock.getDingTalkConfig,
  exchangeDingTalkAuthCode: dingtalkMock.exchangeDingTalkAuthCode,
  fetchDingTalkUserProfile: dingtalkMock.fetchDingTalkUserProfile,
  getDingTalkStateCookieName: dingtalkMock.getDingTalkStateCookieName,
  buildDingTalkCallbackResult: dingtalkMock.buildDingTalkCallbackResult,
  persistDingTalkConnectorCallbackResult: dingtalkMock.persistDingTalkConnectorCallbackResult,
  DINGTALK_CALLBACK_FAILURE_POSTURES: dingtalkMock.DINGTALK_CALLBACK_FAILURE_POSTURES,
  DINGTALK_CALLBACK_RESULT_STATUSES: dingtalkMock.DINGTALK_CALLBACK_RESULT_STATUSES,
  DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS: dingtalkMock.DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS,
  DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE: dingtalkMock.DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE,
}));

vi.mock("@/lib/auth/public-oauth", () => ({
  DINGTALK_PUBLIC_AUTH_STATE_COOKIE: publicOauthMock.DINGTALK_PUBLIC_AUTH_STATE_COOKIE,
  buildPublicAuthStartUrl: publicOauthMock.buildPublicAuthStartUrl,
  buildPublicOauthFallbackUrl: publicOauthMock.buildPublicOauthFallbackUrl,
  buildPublicOauthSignupUrl: publicOauthMock.buildPublicOauthSignupUrl,
  resolvePublicOauthRequestBaseUrl: publicOauthMock.resolvePublicOauthRequestBaseUrl,
  readPublicOauthState: publicOauthMock.readPublicOauthState,
  resolvePublicOauthUserMatch: publicOauthMock.resolvePublicOauthUserMatch,
  finalizePublicOauthLogin: publicOauthMock.finalizePublicOauthLogin,
  writePublicOauthSignupPrefillCookie: publicOauthMock.writePublicOauthSignupPrefillCookie,
  findActivePublicOauthUserById: publicOauthMock.findActivePublicOauthUserById,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: sessionMock.getCurrentUser,
  createSession: sessionMock.createSession,
}));

vi.mock("@/lib/auth/oauth-callback-governance", () => ({
  resolveWorkspaceOauthCallbackContext: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { GET as qrFlowRoute } from "@/app/api/public-auth/dingtalk/qr-flow/route";
import { GET as dingtalkCallbackRoute } from "@/app/api/auth/dingtalk/callback/route";
import { GET as qrCompleteRoute } from "@/app/api/public-auth/dingtalk/qr-complete/route";

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
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

describe("dingtalk public qr login flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicOauthMock.resolvePublicOauthRequestBaseUrl.mockImplementation(
      (request: Request) => new URL(request.url).origin,
    );
    dingtalkMock.isDingTalkOauthConfigured.mockReturnValue(true);
    dingtalkMock.getDingTalkConfig.mockReturnValue({
      clientId: "ding-client",
      clientSecret: "ding-secret",
      redirectUri: "http://helm.example.com:3000/api/auth/dingtalk/callback",
    });
    dingtalkMock.exchangeDingTalkAuthCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expireInSeconds: 3600,
      corpId: "corp-1",
    });
    dingtalkMock.fetchDingTalkUserProfile.mockResolvedValue({
      email: "owner@helm.so",
      mobile: "13800138000",
      nick: "Owner",
      avatarUrl: "https://example.com/avatar.png",
      openId: "open-id-1",
      unionId: "union-id-1",
      userId: "ding-user-1",
    });
    publicOauthMock.buildPublicAuthStartUrl.mockImplementation((origin: string, provider: string) => {
      return `${origin}/api/public-auth/${provider}/start`;
    });
    publicOauthMock.buildPublicOauthFallbackUrl.mockImplementation((request: Request, provider?: string, status?: string) => {
      const url = new URL("/login", request.url);
      url.searchParams.set("tab", "phone");
      if (provider) {
        url.searchParams.set("provider", provider);
      }
      if (status) {
        url.searchParams.set("status", status);
      }
      return url;
    });
    publicOauthMock.buildPublicOauthSignupUrl.mockImplementation((request: Request, input: { provider: string }) => {
      const url = new URL("/login", request.url);
      url.searchParams.set("tab", "signup");
      url.searchParams.set("provider", input.provider);
      url.searchParams.set("prefill", "1");
      return url;
    });
    publicOauthMock.readPublicOauthState.mockImplementation((rawState: string | null) => {
      if (!rawState) {
        return null;
      }
      const parsed = JSON.parse(rawState) as {
        state: string;
        locale?: string;
        flowId?: string;
        workspaceId?: string;
      };
      return {
        state: parsed.state,
        locale: parsed.locale ?? "zh-CN",
        flowId: parsed.flowId ?? null,
        workspaceId: parsed.workspaceId ?? null,
      };
    });
    publicOauthMock.resolvePublicOauthUserMatch.mockResolvedValue({
      status: "matched",
      user: {
        id: "user-1",
        email: "owner@helm.so",
        name: "Owner",
        phone: "13800138000",
        memberships: [
          {
            workspaceId: "workspace-1",
            role: "OWNER",
            status: "ACTIVE",
            workspace: {
              id: "workspace-1",
              defaultLocale: "zh-CN",
              demoMode: false,
              profileType: null,
            },
          },
        ],
      },
    });
    publicOauthMock.finalizePublicOauthLogin.mockResolvedValue({
      ok: true,
      redirectTo: "/dashboard",
    });
    publicOauthMock.findActivePublicOauthUserById.mockResolvedValue({
      id: "user-1",
      email: "owner@helm.so",
      name: "Owner",
      phone: "13800138000",
      memberships: [
        {
          workspaceId: "workspace-1",
          role: "OWNER",
          status: "ACTIVE",
          workspace: {
            id: "workspace-1",
            defaultLocale: "zh-CN",
            demoMode: false,
            profileType: null,
          },
        },
      ],
    });
    sessionMock.getCurrentUser.mockResolvedValue(null);
  });

  it("completes qr flow from callback to desktop completion redirect", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);

    const createResponse = await qrFlowRoute(
      new Request("http://localhost:3000/api/public-auth/dingtalk/qr-flow"),
    );
    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as {
      ok: boolean;
      status: "created";
      flowId: string;
      qrUrl: string;
    };
    expect(created.ok).toBe(true);
    expect(created.status).toBe("created");

    const flowId = created.flowId;
    const state = "public-state-1";
    cookieStore.set(
      publicOauthMock.DINGTALK_PUBLIC_AUTH_STATE_COOKIE,
      JSON.stringify({
        state,
        locale: "zh-CN",
        flowId,
        workspaceId: "workspace-1",
      }),
    );

    const callbackResponse = await dingtalkCallbackRoute(
      new Request(
        `http://localhost:3000/api/auth/dingtalk/callback?authCode=code-1&state=${state}`,
      ),
    );
    expect(callbackResponse.status).toBe(200);
    const callbackHtml = await callbackResponse.text();
    expect(callbackHtml).toContain("登录确认成功");
    expect(callbackHtml).toContain("进入 Helm 移动端");
    expect(callbackHtml).toContain('href="/mobile"');
    expect(publicOauthMock.finalizePublicOauthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredWorkspaceId: "workspace-1",
      }),
    );

    const statusResponse = await qrFlowRoute(
      new Request(`http://localhost:3000/api/public-auth/dingtalk/qr-flow?flowId=${flowId}`),
    );
    expect(statusResponse.status).toBe(200);
    const statusPayload = (await statusResponse.json()) as {
      ok: boolean;
      status: string;
      completeUrl?: string;
    };
    expect(statusPayload.ok).toBe(true);
    expect(statusPayload.status).toBe("matched");
    expect(statusPayload.completeUrl).toBeTruthy();

    const completeResponse = await qrCompleteRoute(
      new Request(new URL(statusPayload.completeUrl!, "http://localhost:3000").toString()),
    );
    expect(completeResponse.status).toBe(307);
    expect(completeResponse.headers.get("location")).toBe("/dashboard");
    expect(publicOauthMock.finalizePublicOauthLogin).toHaveBeenCalledTimes(2);
    expect(publicOauthMock.finalizePublicOauthLogin).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preferredWorkspaceId: "workspace-1",
      }),
    );
  });

  it("preserves workspace context when creating a DingTalk QR flow", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);

    const createResponse = await qrFlowRoute(
      new Request(
        "http://localhost:3000/api/public-auth/dingtalk/qr-flow?ws=workspace-tenant-1&org=%E5%AE%A2%E6%88%B7%E5%85%AC%E5%8F%B8&title=%E7%BB%8F%E7%90%86",
      ),
    );

    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as {
      ok: boolean;
      status: "created";
      qrUrl: string;
    };

    expect(created.qrUrl).toContain("ws=workspace-tenant-1");
    expect(created.qrUrl).toContain("org=%E5%AE%A2%E6%88%B7%E5%85%AC%E5%8F%B8");
    expect(created.qrUrl).toContain("title=%E7%BB%8F%E7%90%86");
  });
});
