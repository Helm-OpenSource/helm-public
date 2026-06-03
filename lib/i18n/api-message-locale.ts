export function isEnglishWorkspaceDefaultLocale(locale?: string | null) {
  return locale === "en-US";
}

export type ApiWorkspaceMessagePair<TMessage extends string = string> =
  Readonly<{
    zh: TMessage;
    en: TMessage;
  }>;

export function resolveApiWorkspaceMessage<TMessage extends string>(
  locale: string | null | undefined,
  message: ApiWorkspaceMessagePair<TMessage>,
) {
  return isEnglishWorkspaceDefaultLocale(locale) ? message.en : message.zh;
}

const apiValidationMessages = {
  incompleteParameters: {
    zh: "参数不完整",
    en: "Incomplete parameters",
  },
  invalidAudience: {
    zh: "受众不合法",
    en: "Invalid audience",
  },
  missingSessionOrMeeting: {
    zh: "需要 sessionId 或 meetingId",
    en: "Provide sessionId or meetingId",
  },
} as const satisfies Record<string, ApiWorkspaceMessagePair>;

export type ApiValidationMessageKey = keyof typeof apiValidationMessages;

const zhValidationMessageToKey = new Map<string, ApiValidationMessageKey>(
  Object.entries(apiValidationMessages).map(([key, message]) => [
    message.zh,
    key as ApiValidationMessageKey,
  ]),
);

export function getApiValidationMessage(
  locale: string | null | undefined,
  key: ApiValidationMessageKey = "incompleteParameters",
) {
  return resolveApiWorkspaceMessage(locale, apiValidationMessages[key]);
}

export function resolveApiValidationIssueMessage(
  locale: string | null | undefined,
  issueMessage?: string,
  fallbackKey: ApiValidationMessageKey = "incompleteParameters",
) {
  if (
    issueMessage &&
    isEnglishWorkspaceDefaultLocale(locale) &&
    zhValidationMessageToKey.has(issueMessage)
  ) {
    return getApiValidationMessage(locale, zhValidationMessageToKey.get(issueMessage));
  }

  return issueMessage ?? getApiValidationMessage(locale, fallbackKey);
}
