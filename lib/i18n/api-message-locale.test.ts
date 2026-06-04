import { describe, expect, it } from "vitest";
import {
  getBilingualApiValidationMessage,
  getApiValidationMessage,
  isEnglishWorkspaceDefaultLocale,
  resolveBilingualApiValidationIssueMessage,
  resolveApiValidationIssueMessage,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";

describe("api message locale", () => {
  it("keeps API workspace-default message locale as a narrow exact-match helper", () => {
    expect(isEnglishWorkspaceDefaultLocale("en-US")).toBe(true);
    expect(isEnglishWorkspaceDefaultLocale("zh-CN")).toBe(false);
    expect(isEnglishWorkspaceDefaultLocale("en-us")).toBe(false);
    expect(isEnglishWorkspaceDefaultLocale("fr-FR")).toBe(false);
    expect(isEnglishWorkspaceDefaultLocale(null)).toBe(false);
    expect(isEnglishWorkspaceDefaultLocale(undefined)).toBe(false);
  });

  it("resolves API messages with the same workspace-default exact-match rule", () => {
    const message = {
      zh: "中文错误文案",
      en: "English error message",
    };

    expect(resolveApiWorkspaceMessage("en-US", message)).toBe(
      "English error message",
    );
    expect(resolveApiWorkspaceMessage("zh-CN", message)).toBe("中文错误文案");
    expect(resolveApiWorkspaceMessage("en-us", message)).toBe("中文错误文案");
    expect(resolveApiWorkspaceMessage("fr-FR", message)).toBe("中文错误文案");
    expect(resolveApiWorkspaceMessage(null, message)).toBe("中文错误文案");
    expect(resolveApiWorkspaceMessage(undefined, message)).toBe("中文错误文案");
  });

  it("resolves common API validation fallbacks from workspace default locale", () => {
    expect(getApiValidationMessage("zh-CN")).toBe("参数不完整");
    expect(getApiValidationMessage("en-US")).toBe("Incomplete parameters");
    expect(getApiValidationMessage("en-US", "invalidAudience")).toBe(
      "Invalid audience",
    );
    expect(getApiValidationMessage("en-US", "missingSessionOrMeeting")).toBe(
      "Provide sessionId or meetingId",
    );
  });

  it("maps known Chinese validation issues to English without rewriting unknown Zod details", () => {
    expect(
      resolveApiValidationIssueMessage("en-US", "missingSessionOrMeeting"),
    ).toBe("Provide sessionId or meetingId");
    expect(
      resolveApiValidationIssueMessage("zh-CN", "missingSessionOrMeeting"),
    ).toBe("需要 sessionId 或 meetingId");
    expect(
      resolveApiValidationIssueMessage("en-US", "需要 sessionId 或 meetingId"),
    ).toBe("Provide sessionId or meetingId");
    expect(resolveApiValidationIssueMessage("en-US", "受众不合法")).toBe(
      "Invalid audience",
    );
    expect(resolveApiValidationIssueMessage("zh-CN", "受众不合法")).toBe(
      "受众不合法",
    );
    expect(
      resolveApiValidationIssueMessage("en-US", "Invalid input: expected string"),
    ).toBe("Invalid input: expected string");
  });

  it("keeps pre-session validation fallbacks explicitly bilingual", () => {
    expect(getBilingualApiValidationMessage()).toBe(
      "参数不完整 / Incomplete parameters",
    );
    expect(
      resolveBilingualApiValidationIssueMessage("需要 sessionId 或 meetingId"),
    ).toBe("需要 sessionId 或 meetingId / Provide sessionId or meetingId");
    expect(resolveBilingualApiValidationIssueMessage(undefined)).toBe(
      "参数不完整 / Incomplete parameters",
    );
    expect(
      resolveBilingualApiValidationIssueMessage("Invalid input: expected string"),
    ).toBe("Invalid input: expected string");
  });
});
