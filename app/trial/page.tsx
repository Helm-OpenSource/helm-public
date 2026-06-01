import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { Button } from "@/components/ui/button";
import { TrialApplicationForm } from "@/features/trial/trial-application-form.client";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveUiLocale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Apply for Helm Cloud (invite-only managed Helm)" : "申请 Helm Cloud 试用 | 托管版仅邀请制",
    description: english
      ? "Helm Cloud is the invite-only managed version of Helm. Answer 4 short questions about your operating loop. We reply in 1 business day with yes / not yet / not a fit. For self-hosting, fork the open-source repo instead."
      : "Helm Cloud 是 Helm 的托管版（仅邀请制）。回答 4 个关于经营回路的简短问题，1 个工作日内答复「通过 / 暂时不合适 / 不匹配」。想自部署？直接 fork 开源仓库。",
  };
}

export default async function TrialApplicationPage() {
  let alreadySignedIn = false;
  try {
    const user = await getCurrentUser();
    alreadySignedIn = Boolean(user);
  } catch {
    // Database may be unreachable in offline mode; fall through to the form.
  }

  if (alreadySignedIn) {
    redirect("/dashboard");
  }

  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[28rem] text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "Open-source AI operating toolkit · for enterprise AI delivery engineers"
              : "面向企业 AI 交付工程师的开源经营推进工具集"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/" data-testid="trial-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to home" : "返回首页"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-10 px-6 pb-20 lg:px-10">
        <section className="space-y-4 pt-6">
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            {english ? "Apply for Helm Cloud." : "申请 Helm Cloud。"}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
            {english
              ? "Managed Helm, invite-only. A human reads every application; we reply within one business day. If you'd rather self-host, fork the open-source repo."
              : "托管版 Helm，仅邀请制。每份申请人工读，1 个工作日内答复。想自部署？直接 fork 开源仓库。"}
          </p>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--muted)]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[color:var(--accent)]" />
            <span>
              {english
                ? "Prefer self-hosted?"
                : "想自部署？"}
            </span>
            <a
              href="https://github.com/Helm-OpenSource/helm-public"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
            >
              {english ? "Fork on GitHub" : "去 GitHub fork"}
            </a>
            <span>·</span>
            <Link
              href="/programs"
              className="font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
            >
              {english ? "Or work with a Certified Delivery Partner" : "或找 Certified Delivery Partner"}
            </Link>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <TrialApplicationForm locale={locale} />

          <aside className="space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-6">
            <h2 className="text-lg font-semibold">
              {english ? "Three possible answers, all within one day." : "三种可能的答复，都在 1 天内。"}
            </h2>
            <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                <span>
                  {english
                    ? <><strong>Yes</strong> — we open your Helm Cloud workspace, walk you through what Helm auto-runs and where it stops, and book your first 1:1 inside 7 days.</>
                    : <><strong>通过</strong>——立刻开通你的 Helm Cloud 工作区，带你过一遍 Helm 自动跑什么 / 在哪条线停下来，并在 7 天内排上第一次 1:1。</>}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                <span>
                  {english
                    ? <><strong>Not yet</strong> — we tell you exactly what&apos;s missing (team size, deal complexity, data quality) and what would flip the answer. No vague maybes.</>
                    : <><strong>暂时不合适</strong>——我们直接告诉你卡点（团队规模、交易复杂度、数据完整度），以及怎么做能改变答案。不留模糊话。</>}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                <span>
                  {english
                    ? <><strong>Not a fit</strong> — we say so on day one, point you to a tool that probably fits better, and don&apos;t email you again.</>
                    : <><strong>不匹配</strong>——第一天就明确告诉你，并推荐更合适的工具。从此不会再发推销邮件。</>}
                </span>
              </li>
            </ul>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-xs leading-5 text-[color:var(--muted-foreground)]">
              {english
                ? "Not sure yet? "
                : "还想先看看？"}
              <Link
                href="/#scenarios"
                className="font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
              >
                {english ? "Try a 60-second role demo first." : "先看 60 秒角色演示。"}
              </Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
