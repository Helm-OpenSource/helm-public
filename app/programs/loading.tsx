import Link from "next/link";
import { BriefcaseBusiness, Handshake, Sparkles } from "lucide-react";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

const icons = [Sparkles, Handshake, BriefcaseBusiness] as const;

export default async function ProgramsLoading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";

  return (
    <main className="surface-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Helm programs" : "Helm 参与计划"}
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "Preparing current participation rules" : "正在准备当前参与规则"}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/?view=public#entry">{english ? "Back home" : "返回公开首页"}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-6 pb-16 pt-4 lg:px-10">
        <div className="max-w-5xl space-y-4">
          <p className="workspace-eyebrow inline-flex rounded-full px-4 py-2">
            {english ? "Program catalog" : "参与目录"}
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] md:text-5xl">
            {english ? "Preparing the controlled participation programs." : "正在准备受控参与计划。"}
          </h1>
          <p className="max-w-4xl text-base leading-8 text-[color:var(--muted)]">
            {english
              ? "Helm is loading the current scope, rules, and settlement boundary before any application step."
              : "Helm 正在读取当前范围、规则和结算边界；在提交申请前先把这些信息展示清楚。"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {icons.map((Icon, index) => (
            <Card key={index} className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
              <CardContent className="space-y-5 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-3">
                  <div className="h-5 w-44 rounded-full bg-[color:var(--border)]/80" />
                  <div className="h-3 w-full rounded-full bg-[color:var(--border)]/70" />
                  <div className="h-3 w-10/12 rounded-full bg-[color:var(--border)]/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
