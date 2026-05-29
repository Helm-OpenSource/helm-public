import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import {
  isEnglishLocale,
  resolveUiLocale,
  UI_LOCALE_COOKIE,
} from "@/lib/i18n/config";
import { resolveExtensionIndustryDemoReadoutPage } from "@/lib/extensions/registry";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    industryKey: string;
  }>;
};

async function resolvePage(input: PageProps) {
  const [{ industryKey }, cookieStore] = await Promise.all([
    input.params,
    cookies(),
  ]);
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const english = isEnglishLocale(locale);
  const page = resolveExtensionIndustryDemoReadoutPage({
    industryKey,
    english,
  });

  return { locale, english, page };
}

export async function generateMetadata(input: PageProps): Promise<Metadata> {
  const { page } = await resolvePage(input);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
  };
}

export default async function DemoIndustryReadoutPage(input: PageProps) {
  const { locale, english, page } = await resolvePage(input);
  if (!page) notFound();

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{page.eyebrow}</p>
          <p className="max-w-[28rem] text-xs text-[color:var(--muted-foreground)]">
            {english ? "Industry scenario · fixture preview" : "行业场景 · fixture 预览"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/demo" data-testid="demo-industry-readout-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to industries" : "返回行业列表"}
            </Link>
          </Button>
          <Button asChild variant="default">
            <a
              href="https://github.com/Helm-OpenSource/helm-public"
              target="_blank"
              rel="noopener noreferrer"
            >
              {english ? "GitHub" : "GitHub"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-6 pb-20 lg:px-10">
        <div
          className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-4"
          data-testid="demo-industry-readout-banner"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">{page.bannerTitle}</p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {page.bannerDescription}
            </p>
          </div>
        </div>

        {page.surface}

        <section
          className="mt-10 flex flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
          data-testid="demo-industry-readout-cta"
        >
          <div className="space-y-1">
            <p className="text-base font-semibold">{page.ctaTitle}</p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {page.ctaDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default">
              <Link href={page.ctaHref}>
                {page.ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/demo">{page.secondaryCtaLabel}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
