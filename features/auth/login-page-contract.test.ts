import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  readPublicOauthSignupPrefillCookieMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirectMock,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/shared/theme-toggle", () => ({
  ThemeToggle: ({ locale }: { locale: "zh-CN" | "en-US" }) =>
    createElement("div", { "data-testid": "theme-toggle", "data-locale": locale }, "theme-toggle"),
}));

vi.mock("@/components/shared/public-locale-switcher", () => ({
  PublicLocaleSwitcher: ({ locale }: { locale: "zh-CN" | "en-US" }) =>
    createElement("div", { "data-testid": "public-locale-switcher", "data-locale": locale }, "locale-switcher"),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/auth/login-returning-entry-card", () => ({
  LoginReturningEntryCard: ({
    locale,
    defaultExpanded,
  }: {
    locale: "zh-CN" | "en-US";
    defaultExpanded?: boolean;
  }) =>
    createElement(
      "div",
      {
        "data-testid": "login-returning-entry-card",
        "data-locale": locale,
        "data-default-expanded": String(Boolean(defaultExpanded)),
      },
      "login-returning-entry-card",
    ),
}));

vi.mock("@/features/auth/login-panel", () => ({
  LoginPanel: ({
    initialTab,
    prefillSignup,
    prefillCompatibilityEmail,
    autoContinueCompatibility,
    publicSsoOptions,
    entryIntent,
  }: {
    initialTab?: "signup" | "password" | "phone";
    prefillSignup?: {
      name?: string;
      email?: string;
      phone?: string;
      organizationName?: string;
      title?: string;
    };
    prefillCompatibilityEmail?: string;
    autoContinueCompatibility?: boolean;
    publicSsoOptions?: Array<{
      provider: "dingtalk" | "wecom" | "feishu";
      ready: boolean;
      startUrl: string | null;
    }>;
    entryIntent?: "dingtalk-invite" | "new-trial" | "returning" | "compatibility";
  }) =>
    createElement(
      "div",
      {
        "data-testid": "login-panel",
        "data-initial-tab": initialTab ?? "undefined",
        "data-prefill-org-name": prefillSignup?.organizationName ?? "",
        "data-prefill-compatibility-email": prefillCompatibilityEmail ?? "",
        "data-entry-intent": entryIntent ?? "",
        "data-auto-compatibility": String(Boolean(autoContinueCompatibility)),
        "data-public-sso-options": JSON.stringify(publicSsoOptions ?? []),
      },
      "login-panel",
    ),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUserMock,
}));

vi.mock("@/lib/connectors/dingtalk", () => ({
  isDingTalkOauthConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/connectors/feishu", () => ({
  isFeishuOauthConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/auth/public-oauth", () => ({
  readPublicOauthSignupPrefillCookie: mocks.readPublicOauthSignupPrefillCookieMock,
  PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE: "helm-public-oauth-prefill",
}));

import LoginPage from "@/app/(auth)/login/page";

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    get: vi.fn((name: string) => {
      const value = values.get(name);
      return value ? { name, value } : undefined;
    }),
  };
}

function buildRedirectError(path: string) {
  return new Error(`REDIRECT:${path}`);
}

describe("login page salvage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookiesMock.mockResolvedValue(createCookieStore());
    mocks.getCurrentUserMock.mockResolvedValue(null);
    mocks.readPublicOauthSignupPrefillCookieMock.mockReturnValue(null);
  });

  it("routes signup and returning users into separate entry intents", async () => {
    const signupElement = await LoginPage({
      searchParams: Promise.resolve({ tab: "signup" }),
    });
    const signupHtml = renderToStaticMarkup(signupElement);

    expect(signupHtml).toContain('data-testid="login-panel"');
    expect(signupHtml).toContain('data-initial-tab="signup"');
    expect(signupHtml).toContain('data-entry-intent="new-trial"');
    expect(signupHtml).not.toContain('data-testid="login-returning-entry-card"');
    expect(signupHtml).toContain(
      'data-public-sso-options="[{&quot;provider&quot;:&quot;dingtalk&quot;,&quot;ready&quot;:true,&quot;startUrl&quot;:&quot;/api/public-auth/dingtalk/start&quot;},{&quot;provider&quot;:&quot;feishu&quot;,&quot;ready&quot;:true,&quot;startUrl&quot;:&quot;/api/public-auth/feishu/start&quot;}]"',
    );
    expect(signupHtml).toContain("开通你的Helm试点工作区。");

    const passwordElement = await LoginPage({
      searchParams: Promise.resolve({ tab: "password" }),
    });
    const passwordHtml = renderToStaticMarkup(passwordElement);

    expect(passwordHtml).toContain('data-initial-tab="password"');
    expect(passwordHtml).toContain('data-entry-intent="returning"');
    expect(passwordHtml).not.toContain('data-testid="login-returning-entry-card"');
  });

  it("keeps phone-code sign-in as a focused returning-member path", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({ tab: "phone" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain('data-testid="login-panel"');
    expect(html).toContain('data-testid="login-returning-entry-card"');
    expect(html).toContain('data-default-expanded="true"');
    expect(html).toContain("用手机号回到工作区。");
  });

  it("redirects signed-in users straight to dashboard instead of rendering the public login owner", async () => {
    mocks.getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    mocks.redirectMock.mockImplementation((path: string) => {
      throw buildRedirectError(path);
    });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("prefills organization name from public oauth cookie when user is unmatched", async () => {
    mocks.readPublicOauthSignupPrefillCookieMock.mockReturnValue({
      provider: "dingtalk",
      name: "Alice",
      email: "alice@example.com",
      phone: "+8613800138000",
      organizationName: "Helm 中国团队",
    });

    const element = await LoginPage({
      searchParams: Promise.resolve({
        tab: "signup",
        provider: "dingtalk",
        prefill: "1",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-prefill-org-name="Helm 中国团队"');
  });

  it("turns DingTalk invite prefill into a single-purpose invitation entry", async () => {
    mocks.readPublicOauthSignupPrefillCookieMock.mockReturnValue({
      provider: "dingtalk",
      name: "测试成员甲",
      email: null,
      phone: "+8613800000000",
      organizationName: "杭州示例科技有限公司",
      title: "董事",
      invitedWorkspaceId: "workspace-invite-demo",
    });

    const element = await LoginPage({
      searchParams: Promise.resolve({
        tab: "signup",
        provider: "dingtalk",
        prefill: "1",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("确认加入「杭州示例科技有限公司」。");
    expect(html).toContain("Helm已经知道你是谁、要加入哪个组织。");
    expect(html).toContain('data-testid="login-invitation-orientation"');
    expect(html).toContain("已识别身份");
    expect(html).toContain("身份：董事");
    expect(html).toContain("进入后先做这 3 件事");
    expect(html).toContain("查看今日必须推进事项");
    expect(html).toContain("上报客户、会议、交付、承诺或阻塞信号");
    expect(html).toContain("不需要再做额外选择或配置。");
    expect(html).toContain('data-entry-intent="dingtalk-invite"');
    expect(html).not.toContain('data-testid="login-returning-entry-card"');
    expect(html).not.toContain("3 分钟申请试点。");
  });

  it("passes public auth tenant context into DingTalk start url", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        ws: "workspace-tenant-1",
        org: "客户公司",
        title: "经营负责人",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain(
      "&quot;startUrl&quot;:&quot;/api/public-auth/dingtalk/start?org=%E5%AE%A2%E6%88%B7%E5%85%AC%E5%8F%B8&amp;ws=workspace-tenant-1&amp;title=%E7%BB%8F%E8%90%A5%E8%B4%9F%E8%B4%A3%E4%BA%BA&quot;",
    );
    expect(html).toContain(
      "&quot;startUrl&quot;:&quot;/api/public-auth/feishu/start?org=%E5%AE%A2%E6%88%B7%E5%85%AC%E5%8F%B8&amp;ws=workspace-tenant-1&amp;title=%E7%BB%8F%E8%90%A5%E8%B4%9F%E8%B4%A3%E4%BA%BA&quot;",
    );
  });
});
