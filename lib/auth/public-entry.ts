import type { UiLocale } from "@/lib/i18n/config";

export type LoginWorkspaceEntryKind = "demo" | "workspace" | "invited";
export type GettingStartedEntryMode = "explicit_only";

export function buildLoginSuccessMessage(input: {
  locale: UiLocale;
  workspaceName: string;
  entryKind: LoginWorkspaceEntryKind;
}) {
  const english = input.locale === "en-US";

  if (input.entryKind === "demo") {
    return english
      ? `Entered demo workspace: ${input.workspaceName}`
      : `已进入演示工作区：${input.workspaceName}`;
  }

  if (input.entryKind === "invited") {
    return english
      ? `Accepted the invitation and entered ${input.workspaceName}`
      : `已接受邀请并进入 ${input.workspaceName}`;
  }

  return english
    ? `Entered ${input.workspaceName}`
    : `已进入 ${input.workspaceName}`;
}

export function buildInviteAcceptanceGuidance(input: {
  locale: UiLocale;
  workspaceName: string;
  activeCount: number;
  invitedCount: number;
}) {
  const english = input.locale === "en-US";

  return {
    title: english ? "Invite teammates into the live workspace" : "邀请团队一起进入正式工作区",
    summary: english
      ? `${input.workspaceName} already has ${input.activeCount} active teammate(s) and ${input.invitedCount} invited teammate(s) visible in the organization.`
      : `${input.workspaceName} 当前已有 ${input.activeCount} 位 active 成员和 ${input.invitedCount} 位已邀请成员可见。`,
    description: english
      ? "Invite teammates through DingTalk now. They stay visible as invited members until they enter from the DingTalk invite link."
      : "现在通过钉钉邀请同事。他们会先保持为 invited 成员，等从钉钉邀请链接进入组织后，再自动切到 active。",
    acceptanceHint: english
      ? "Teammates do not need a demo account. Invited teammates should enter from DingTalk invite messages, while verified members can sign in with password, phone code, or DingTalk QR."
      : "同事不需要 Demo 账号。被邀请成员应从钉钉邀请消息进入；已验证成员则可以通过密码、手机号验证码或钉钉扫码登录。",
  };
}

export function buildGettingStartedEntryContract(input: { locale: UiLocale }) {
  const english = input.locale === "en-US";

  return {
    mode: "explicit_only" as GettingStartedEntryMode,
    autoEntryEligible: false,
    title: english
      ? "3 steps. Your first judgement card in 5 minutes."
      : "3 步。5 分钟内看到第一张判断卡。",
    summary: english
      ? "Tell Helm who you are, connect one signal source, and we'll land your first real recommendation in 5 minutes."
      : "告诉 Helm 你是谁、连接 1 个信号源，5 分钟内你会看到第一张真实判断卡。",
    boundaryNote: english
      ? "Verified members are sent to the dashboard. Full setup (12 minutes, 6 steps) is at /setup?onboarding=trial."
      : "已验证成员会直接进入工作台。完整初始化（12 分钟 / 6 步）在 /setup?onboarding=trial。",
    primaryHref: "/dashboard",
    primaryLabel: english ? "Continue to dashboard" : "继续进入工作台",
    secondaryHref: "/setup?onboarding=trial",
    secondaryLabel: english ? "Open full setup (12 min)" : "打开完整初始化（12 分钟）",
    skipHint: english
      ? "You can come back to this checklist any time from the help menu."
      : "随时可从帮助菜单回到这个清单。",
  };
}
