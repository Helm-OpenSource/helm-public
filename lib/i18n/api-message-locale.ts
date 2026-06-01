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
