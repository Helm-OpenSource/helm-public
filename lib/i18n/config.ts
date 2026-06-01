export const UI_LOCALE_COOKIE = "helm-ui-locale";

export const supportedUiLocales = ["zh-CN", "en-US"] as const;

export type UiLocale = (typeof supportedUiLocales)[number];

export const ENGINE_DEFAULT_UI_LOCALE: UiLocale = "zh-CN";

export type WorkspaceUiLocaleResolutionInput = {
  requestLocale?: string | null;
  userLocale?: string | null;
  workspaceDefaultLocale?: string | null;
  tenantOverlayDefaultLocale?: string | null;
  deploymentProfileDefaultLocale?: string | null;
};

export function resolveUiLocale(value?: string | null): UiLocale {
  if (value === "en-US") return "en-US";
  return ENGINE_DEFAULT_UI_LOCALE;
}

export function isSupportedUiLocale(value?: string | null): value is UiLocale {
  return supportedUiLocales.includes(value as UiLocale);
}

export function resolveWorkspaceUiLocale(
  input: WorkspaceUiLocaleResolutionInput,
): UiLocale {
  const candidates = [
    input.requestLocale,
    input.userLocale,
    input.workspaceDefaultLocale,
    input.tenantOverlayDefaultLocale,
    input.deploymentProfileDefaultLocale,
    ENGINE_DEFAULT_UI_LOCALE,
  ];

  for (const candidate of candidates) {
    if (isSupportedUiLocale(candidate)) {
      return candidate;
    }
  }

  return ENGINE_DEFAULT_UI_LOCALE;
}

export function isEnglishLocale(locale: UiLocale) {
  return locale === "en-US";
}
