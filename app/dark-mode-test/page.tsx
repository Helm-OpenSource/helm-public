import { cookies } from "next/headers";
import { DarkModeTestClient } from "@/app/dark-mode-test/dark-mode-test-client";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";

export default async function DarkModeTestPage() {
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);

  return <DarkModeTestClient locale={locale} />;
}
