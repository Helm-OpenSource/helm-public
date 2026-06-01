import { describe, expect, it } from "vitest";
import { isAuthSessionProviderSourceCompatible } from "@/lib/auth/session-governance";

describe("auth session provider/source compatibility", () => {
  it("allows the DingTalk OAuth callback source page", () => {
    expect(
      isAuthSessionProviderSourceCompatible({
        providerType: "DINGTALK_OAUTH",
        sourcePage: "/api/auth/dingtalk/callback",
      }),
    ).toBe(true);
  });

  it("allows the WeCom OAuth callback source page", () => {
    expect(
      isAuthSessionProviderSourceCompatible({
        providerType: "WECOM_OAUTH",
        sourcePage: "/api/auth/wecom/callback",
      }),
    ).toBe(true);
  });

  it("allows the Feishu OAuth callback source page", () => {
    expect(
      isAuthSessionProviderSourceCompatible({
        providerType: "FEISHU_OAUTH",
        sourcePage: "/api/auth/feishu/callback",
      }),
    ).toBe(true);
  });

  it("keeps standard auth providers on the login source page", () => {
    expect(
      isAuthSessionProviderSourceCompatible({
        providerType: "PASSWORD",
        sourcePage: "/api/auth/dingtalk/callback",
      }),
    ).toBe(false);
  });
});
