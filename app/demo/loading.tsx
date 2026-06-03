import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export default async function DemoLoading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1080px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[28rem] text-xs text-[color:var(--muted-foreground)]">
            {english ? "Demo entry · choose a role" : "演示入口 · 选择角色"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/" data-testid="demo-loading-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to home" : "返回首页"}
            </Link>
          </Button>
        </div>
      </header>

      <main
        className="mx-auto flex w-full max-w-[1080px] flex-col gap-10 px-6 pb-20 lg:px-10"
        data-testid="demo-loading-shell"
      >
        <section className="space-y-3">
          <p className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--accent)]">
            {english ? "Demo workspaces" : "演示工作区"}
          </p>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {english
              ? "Preparing the demo entry..."
              : "正在准备演示入口..."}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
            {english
              ? "Each demo workspace is seeded with the role's typical blockers and follow-through. The role cards will appear in a moment."
              : "每个演示工作区都已经铺好该角色典型的阻塞与跟进。角色选择卡片即将就位。"}
          </p>
        </section>

        <section
          className="grid gap-4 md:grid-cols-3"
          aria-hidden
          data-testid="demo-loading-skeleton"
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex h-72 flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)]"
            >
              <div className="h-10 w-10 animate-pulse rounded-xl bg-[color:var(--surface-subtle)]" />
              <div className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-[color:var(--surface-subtle)]" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
              </div>
              <div className="mt-auto h-10 animate-pulse rounded-xl bg-[color:var(--surface-subtle)]" />
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-6 py-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Demo entry does not auto-send anything to a customer or write back to a real CRM."
                : "演示入口不会对外发送任何内容，也不会写回真实客户关系系统。"}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
