import { cookies } from "next/headers";
import { ContrastTestClient } from "@/app/contrast-test/contrast-test-client";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";

export default async function ContrastTestPage() {
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);

  return <ContrastTestClient locale={locale} />;
}
