import { describe, expect, it } from "vitest";
import { resolveSettingsApiMessage } from "@/lib/i18n/api-settings-messages";

describe("settings API messages", () => {
  it("resolves org-admin support-pack audit summaries from workspace default locale", () => {
    expect(
      resolveSettingsApiMessage("en-US", "orgAdminSupportPackExportedAuditSummary"),
    ).toBe("Exported org-admin support pack");
    expect(
      resolveSettingsApiMessage("zh-CN", "orgAdminSupportPackExportedAuditSummary"),
    ).toBe("导出了组织治理支持包");
    expect(
      resolveSettingsApiMessage("en-us", "orgAdminSupportPackExportedAuditSummary"),
    ).toBe("导出了组织治理支持包");
    expect(
      resolveSettingsApiMessage(null, "orgAdminSupportPackExportedAuditSummary"),
    ).toBe("导出了组织治理支持包");
  });
});
