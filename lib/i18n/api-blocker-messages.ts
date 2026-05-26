import {
  type ApiWorkspaceMessagePair,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";

const blockerApiMessages = {
  missingRequiredFields: {
    zh: "参数不完整",
    en: "Missing required fields",
  },
  createFailed: {
    zh: "创建阻塞失败",
    en: "Failed to create blocker",
  },
} satisfies Record<string, ApiWorkspaceMessagePair>;

type BlockerApiMessageKey = keyof typeof blockerApiMessages;

export function resolveBlockerApiMessage(
  locale: string | null | undefined,
  key: BlockerApiMessageKey,
) {
  return resolveApiWorkspaceMessage(locale, blockerApiMessages[key]);
}
