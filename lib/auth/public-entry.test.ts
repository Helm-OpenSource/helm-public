import { describe, expect, it } from "vitest";
import {
  buildGettingStartedEntryContract,
  buildInviteAcceptanceGuidance,
  buildLoginSuccessMessage,
} from "@/lib/auth/public-entry";

describe("public entry helpers", () => {
  it("keeps demo, invited, and formal workspace login success copy distinct", () => {
    expect(
      buildLoginSuccessMessage({
        locale: "zh-CN",
        workspaceName: "Acme Helm",
        entryKind: "workspace",
      }),
    ).toBe("已进入 Acme Helm");

    expect(
      buildLoginSuccessMessage({
        locale: "zh-CN",
        workspaceName: "Acme Helm",
        entryKind: "invited",
      }),
    ).toBe("已接受邀请并进入 Acme Helm");

    expect(
      buildLoginSuccessMessage({
        locale: "en-US",
        workspaceName: "Founder Demo",
        entryKind: "demo",
      }),
    ).toBe("Entered demo workspace: Founder Demo");
  });

  it("explains that invited teammates join through the public entry instead of demo", () => {
    const zh = buildInviteAcceptanceGuidance({
      locale: "zh-CN",
      workspaceName: "Helm 中国团队",
      activeCount: 1,
      invitedCount: 2,
    });

    expect(zh.summary).toContain("1 位 active 成员");
    expect(zh.summary).toContain("2 位已邀请成员");
    expect(zh.acceptanceHint).toContain("不需要 Demo 账号");
    expect(zh.acceptanceHint).toContain("手机号验证码或钉钉扫码登录");

    const en = buildInviteAcceptanceGuidance({
      locale: "en-US",
      workspaceName: "Helm CN",
      activeCount: 2,
      invitedCount: 1,
    });

    expect(en.description).toContain("DingTalk");
    expect(en.acceptanceHint).toContain("do not need a demo account");
    expect(en.acceptanceHint).toContain("password, phone code, or DingTalk QR");
  });

  it("keeps getting-started as an explicit orientation contract instead of an automatic post-login target", () => {
    const zh = buildGettingStartedEntryContract({ locale: "zh-CN" });

    expect(zh.mode).toBe("explicit_only");
    expect(zh.autoEntryEligible).toBe(false);
    // Title must remain user-facing (action + concrete promise) rather than
    // leaking internal taxonomy like "显式引导页" / "Explicit orientation page".
    expect(zh.title).toContain("3 步");
    expect(zh.title).toContain("第一张判断卡");
    expect(zh.boundaryNote).toContain("/setup?onboarding=trial");
    expect(zh.boundaryNote).toContain("工作台");
    expect(JSON.stringify(zh)).not.toMatch(/orientation|first-value|first-entry truth|review-first/i);

    const en = buildGettingStartedEntryContract({ locale: "en-US" });

    expect(en.mode).toBe("explicit_only");
    expect(en.autoEntryEligible).toBe(false);
    expect(en.title).toContain("3 steps");
    expect(en.title).toContain("first judgement card");
    expect(en.boundaryNote).toContain("dashboard");
    expect(en.boundaryNote).toContain("/setup?onboarding=trial");
  });
});
