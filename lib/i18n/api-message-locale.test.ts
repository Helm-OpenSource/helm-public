import { describe, expect, it } from "vitest";
import {
  isEnglishWorkspaceDefaultLocale,
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
});
