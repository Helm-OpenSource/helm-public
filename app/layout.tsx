import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppToaster } from "@/components/shared/toaster";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helm | 面向企业AI交付工程师的开源经营推进工具集",
  description:
    "Open-source AI operating toolkit for enterprise AI delivery engineers — Apache-2.0, forkable, with verticals, connectors, eval gates and BI artifacts already wired in. | 面向企业AI交付工程师的开源经营推进工具集，Apache-2.0、可复刻，含行业样板、连接器、评估门禁和商业智能制品，并保留边界纪律。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const uiLocale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value ?? null);

  return (
    <html
      lang={uiLocale}
      suppressHydrationWarning
      data-theme="light"
      data-workspace-density="comfortable"
      data-workspace-guidance="guided"
      data-workspace-form-assist="enabled"
      data-workspace-motion="standard"
    >
      <body className="min-h-screen antialiased">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
