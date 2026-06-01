import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoginReturningEntryCard } from "@/components/auth/login-returning-entry-card";

vi.mock("@/components/auth/simplified-login-panel", () => ({
  SimplifiedLoginPanel: ({ locale }: { locale: "zh-CN" | "en-US" }) =>
    createElement("div", { "data-testid": "mock-simplified-login-panel" }, locale),
}));

describe("login returning entry card", () => {
  it("keeps returning-member entry narrow and explicit in chinese", () => {
    const html = renderToStaticMarkup(
      createElement(LoginReturningEntryCard, { locale: "zh-CN", defaultExpanded: true }),
    );

    expect(html).toContain("已有成员快速回流");
    expect(html).toContain("这个窄入口只服务已有组织成员的密码或手机号验证码回流");
    expect(html).toContain("正式验证注册、邀请续接和公开 SSO 回退仍在上面的主面板里");
    expect(html).toContain("mock-simplified-login-panel");
  });

  it("keeps returning-member entry narrow and explicit in english", () => {
    const html = renderToStaticMarkup(
      createElement(LoginReturningEntryCard, { locale: "en-US", defaultExpanded: true }),
    );

    expect(html).toContain("Returning member quick entry");
    expect(html).toContain("Use this only for password or phone-code re-entry into an existing organization.");
    expect(html).toContain("Verified signup, invite continuation, and public SSO fallback stay in the main panel above.");
  });
});
