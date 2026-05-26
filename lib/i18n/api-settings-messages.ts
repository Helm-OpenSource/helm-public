import {
  type ApiWorkspaceMessagePair,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";

const settingsApiMessages = {
  orgAdminSupportPackExportedAuditSummary: {
    zh: "导出了组织治理支持包",
    en: "Exported org-admin support pack",
  },
} satisfies Record<string, ApiWorkspaceMessagePair>;

type SettingsApiMessageKey = keyof typeof settingsApiMessages;

export function resolveSettingsApiMessage(
  locale: string | null | undefined,
  key: SettingsApiMessageKey,
) {
  return resolveApiWorkspaceMessage(locale, settingsApiMessages[key]);
}
