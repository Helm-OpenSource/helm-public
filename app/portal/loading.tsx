import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export default async function ParticipantPortalLoading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";

  return (
    <main className="surface-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Helm participant portal" : "Helm 贡献方门户"}
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "Preparing invite-only access" : "正在准备受邀访问"}
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

      <section className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-6 pb-16 pt-4 lg:px-10">
        <div className="max-w-4xl space-y-4">
          <p className="workspace-eyebrow inline-flex rounded-full px-4 py-2">
            {english ? "Portal access" : "门户访问"}
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] md:text-5xl">
            {english ? "Opening the participant portal." : "正在打开贡献方门户。"}
          </h1>
          <p className="max-w-3xl text-base leading-8 text-[color:var(--muted)]">
            {english
              ? "Helm is checking whether this account has an invite-backed, self-only portal scope."
              : "Helm 正在确认当前账号是否拥有受邀开通、仅本人可见的门户范围。"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
            <CardContent className="space-y-5 p-6 md:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-32 rounded-full bg-[color:var(--border)]/80" />
                <div className="h-3 w-full max-w-xl rounded-full bg-[color:var(--border)]/70" />
                <div className="h-3 w-10/12 rounded-full bg-[color:var(--border)]/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
            <CardContent className="space-y-4 p-6 md:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-36 rounded-full bg-[color:var(--border)]/80" />
                <div className="h-3 w-full rounded-full bg-[color:var(--border)]/70" />
                <div className="h-3 w-11/12 rounded-full bg-[color:var(--border)]/60" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
