import { describe, expect, it } from "vitest";
import {
  DingTalkLiveSendConfirmationRequiredError,
  buildPlaceholderEmail,
  isValidDingTalkLiveSendConfirmation,
  normalizeNameToPinyinBase,
  resolveDingTalkDirectoryInviteDryRun,
  syncAndInviteDingTalkDirectory,
} from "@/lib/connectors/dingtalk-directory-invite";

describe("dingtalk directory invite helpers", () => {
  it("normalizes Chinese names to pinyin base", () => {
    expect(normalizeNameToPinyinBase("张三")).toBe("zhangsan");
  });

  it("normalizes mixed names to lowercase alphanumeric base", () => {
    expect(normalizeNameToPinyinBase("Alice 张三")).toBe("alicezhangsan");
  });

  it("falls back to member for empty names", () => {
    expect(normalizeNameToPinyinBase("   ")).toBe("member");
  });

  it("builds default placeholder email", () => {
    expect(buildPlaceholderEmail("zhangsan", 1)).toBe("zhangsan-zj@example.com");
  });

  it("builds collision placeholder email with numeric suffix", () => {
    expect(buildPlaceholderEmail("zhangsan", 3)).toBe("zhangsan-zj-3@example.com");
  });

  it("defaults directory invite sync to dry-run when no live-send flag is supplied", () => {
    expect(resolveDingTalkDirectoryInviteDryRun()).toBe(true);
    expect(resolveDingTalkDirectoryInviteDryRun(true)).toBe(true);
    expect(resolveDingTalkDirectoryInviteDryRun(false)).toBe(false);
  });

  it("requires a concrete user, timestamp, and source page before DingTalk live send", () => {
    expect(
      isValidDingTalkLiveSendConfirmation({
        confirmedByUserId: "user_1",
        confirmedAt: new Date("2026-04-30T08:00:00.000Z"),
        sourcePage: "/settings",
      }),
    ).toBe(true);
    expect(
      isValidDingTalkLiveSendConfirmation({
        confirmedByUserId: "user_1",
        confirmedAt: new Date("invalid"),
        sourcePage: "/settings",
      }),
    ).toBe(false);
    expect(isValidDingTalkLiveSendConfirmation(null)).toBe(false);
  });

  it("refuses live send (dryRun=false) without confirmation before any DB or network call", async () => {
    await expect(
      syncAndInviteDingTalkDirectory({
        workspaceId: "ws-never-touched",
        operator: "operator",
        dryRun: false,
      }),
    ).rejects.toBeInstanceOf(DingTalkLiveSendConfirmationRequiredError);

    await expect(
      syncAndInviteDingTalkDirectory({
        workspaceId: "ws-never-touched",
        operator: "operator",
        dryRun: false,
        confirmation: {
          confirmedByUserId: "user_1",
          confirmedAt: new Date("invalid"),
          sourcePage: "/settings",
        },
      }),
    ).rejects.toBeInstanceOf(DingTalkLiveSendConfirmationRequiredError);
  });
});
