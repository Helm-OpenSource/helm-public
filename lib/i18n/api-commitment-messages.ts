import {
  type ApiWorkspaceMessagePair,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";

const commitmentApiMessages = {
  missingRequiredFields: {
    zh: "参数不完整",
    en: "Missing required fields",
  },
  updateFailed: {
    zh: "更新承诺失败",
    en: "Failed to update commitment",
  },
} satisfies Record<string, ApiWorkspaceMessagePair>;

type CommitmentApiMessageKey = keyof typeof commitmentApiMessages;

export function resolveCommitmentApiMessage(
  locale: string | null | undefined,
  key: CommitmentApiMessageKey,
) {
  return resolveApiWorkspaceMessage(locale, commitmentApiMessages[key]);
}
