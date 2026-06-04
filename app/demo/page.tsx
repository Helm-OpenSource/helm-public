import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  ShieldCheck,
  Target,
  Users2,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { loginAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDemoModeProfiles, type DemoMode } from "@/lib/demo/demo-modes";
import { listIndustryPacks } from "@/lib/demo/industry-fixtures";
import { resolveUiLocale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale(
    (await cookies()).get("helm-ui-locale")?.value,
  );
  const english = locale === "en-US";

  return {
    title: english
      ? "60-second demo | See the vertical your team can fork"
      : "60 秒演示 | 看看你的团队第一天可复刻的行业样板",
    description: english
      ? "Three pre-loaded role workspaces — each a generic vertical your delivery engineering team can fork, customize and ship to an enterprise customer. Real product, real cards. No email required."
      : "3 个预置角色工作区——每个都是通用行业样板，你的交付工程团队可以复刻、改造、交付给企业客户。真产品、真判断卡。不要求留邮箱。",
  };
}

type DemoEntryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveHighlightedDemoMode(rawMode: string | string[] | undefined): DemoMode | null {
  const mode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
  if (mode === "founder" || mode === "sales" || mode === "recruiter") {
    return mode;
  }
  return null;
}

const ROLE_ICON: Record<DemoMode, typeof Target> = {
  founder: Target,
  sales: BriefcaseBusiness,
  recruiter: Users2,
};

const ROLE_LENS: Record<DemoMode, { zh: string; en: string }> = {
  founder: {
    zh: "销售、交付、财务各握一段。Helm 把它们拼起来，告诉你今天只有你能拍板的事。",
    en: "Sales, delivery and finance each hold a piece. Helm stitches them and surfaces what only you can call today.",
  },
  sales: {
    zh: "一个大客户试点、一个恢复单、一个安全评审卡点——今天先推哪个 Helm已经排好。",
    en: "A warming pilot, a recovery deal and a security-review stall — Helm has already picked which moves first today.",
  },
  recruiter: {
    zh: "候选人在降温、面试反馈没发出去——Helm 把把人捞回来的话写好了，等你点。",
    en: "Candidates going cold and feedback that never went out — Helm has drafted the line that revives them.",
  },
};

export default async function DemoEntryPage({ searchParams }: DemoEntryPageProps) {
  const locale = resolveUiLocale(
    (await cookies()).get("helm-ui-locale")?.value,
  );
  const english = locale === "en-US";
  const demoModes = getDemoModeProfiles(locale);
  const industryPacks = listIndustryPacks();
  const params = (await searchParams) ?? {};
  const highlightedDemoMode = resolveHighlightedDemoMode(params.mode);

  async function enterDemoWorkspace(formData: FormData) {
    "use server";

    const accountEmail = formData.get("accountEmail");
    const targetPath = formData.get("targetPath");

    if (
      typeof accountEmail !== "string" ||
      typeof targetPath !== "string" ||
      !targetPath.startsWith("/")
    ) {
      redirect("/demo");
    }

    const result = await loginAction({ email: accountEmail, locale });
    if (!result.ok) {
      redirect("/demo");
    }
    redirect(targetPath);
  }

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1080px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[28rem] text-xs text-[color:var(--muted-foreground)]">
            {english ? "60-second demo · no email required" : "60 秒演示 · 不要求留邮箱"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/" data-testid="demo-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to home" : "返回首页"}
            </Link>
          </Button>
          <Button asChild variant="default">
            <a
              href="https://github.com/Helm-OpenSource/helm-public"
              data-testid="demo-cta-github"
              target="_blank"
              rel="noopener noreferrer"
            >
              {english ? "GitHub" : "GitHub"}
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-10 px-6 pb-20 lg:px-10">
        <section className="space-y-3">
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {english
              ? "Pick a role. See what Helm puts in front of an end user."
              : "挑一个角色。看 Helm 给端用户屏幕上推什么。"}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
            {english
              ? "Real workspace, seeded blockers — meetings, CRM imports, drafts waiting for review, overdue commitments. Click through anything; nothing leaves the building."
              : "真工作区，铺好了真实卡点——会议、客户关系管理导入、等复核的草稿、过期承诺。随便点，不会发出任何东西。"}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3" data-testid="demo-role-cards">
          {demoModes.map((mode) => {
            const Icon = ROLE_ICON[mode.mode];
            const lens = ROLE_LENS[mode.mode];
            const targetPath = mode.quickPath[0]?.href ?? "/dashboard";
            const highlighted = highlightedDemoMode === mode.mode;

            return (
              <Card
                key={mode.mode}
                id={`demo-workspace-${mode.mode}`}
                className={`flex flex-col border bg-[color:var(--surface)] shadow-[var(--shadow-card)] ${
                  highlighted
                    ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent)]"
                    : "border-[color:var(--border)]"
                }`}
                data-testid={`demo-card-${mode.mode}`}
              >
                <CardContent className="flex h-full flex-col gap-4 py-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                      {mode.title}
                    </h2>
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {english ? lens.en : lens.zh}
                    </p>
                    <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                      {english ? `Best fit: ${mode.idealCustomer}` : `适合：${mode.idealCustomer}`}
                    </p>
                  </div>
                  <form action={enterDemoWorkspace} className="mt-auto">
                    <input type="hidden" name="accountEmail" value={mode.accountEmail} />
                    <input type="hidden" name="targetPath" value={targetPath} />
                    <Button
                      type="submit"
                      variant="default"
                      className="w-full justify-between"
                      data-testid={`demo-entry-${mode.mode}`}
                    >
                      <span>{english ? "Open this · 60 sec" : "进入演示 · 60 秒"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-4" data-testid="demo-industry-cards">
          <div className="space-y-2">
            <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              {english ? "Or pick by industry" : "或者按行业看"}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Same loop, six industries. Skim a sample card, then pick a role above."
                : "同一套闭环、6 个行业。看一眼样例，再回到上面选角色进入。"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {industryPacks.map((pack) => {
              const sample = pack.judgementCards[0];
              const deeperCtaLabel = pack.deeperReadoutCtaLabel
                ? english
                  ? pack.deeperReadoutCtaLabel.en
                  : pack.deeperReadoutCtaLabel.zh
                : english
                  ? "Open full readout"
                  : "打开完整读数";
              return (
                <Card
                  key={pack.industryKey}
                  className="border bg-[color:var(--surface)] shadow-[var(--shadow-card)]"
                  data-testid={`demo-industry-card-${pack.industryKey}`}
                >
                  <CardContent className="space-y-3 py-5">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                        {english ? pack.displayNameEn : pack.displayNameZh}
                      </h3>
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {english ? pack.persona.en : pack.persona.zh}
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {english ? pack.pitch.en : pack.pitch.zh}
                    </p>
                    {sample ? (
                      <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 text-sm font-semibold leading-6 text-[color:var(--foreground)] line-clamp-2">
                        {sample.title}
                      </p>
                    ) : null}
                    {pack.deeperReadoutHref ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full justify-between"
                        data-testid={`demo-industry-deeper-${pack.industryKey}`}
                      >
                        <Link href={pack.deeperReadoutHref}>
                          {deeperCtaLabel}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-6 py-5"
          data-testid="demo-boundary-note"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Advice ≠ commitment. Nothing leaves the building: seeded data, no emails to real customers, no CRM writes. Every click still lands an audit row, same as production."
                : "建议 ≠ 承诺。不会对外发送任何内容：数据是预置的，不会发邮件、不会写入客户关系系统。每一步动作仍会落一条审计——和真实环境一样。"}
            </p>
          </div>
        </section>

        <section
          className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
          data-testid="demo-secondary-cta"
        >
          <div className="space-y-1">
            <p className="text-base font-semibold">
              {english ? "Two ways in." : "两种进入方式。"}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Clone it and run the Golden Path checks, or apply for Helm Cloud — managed, invite-only."
                : "自己克隆仓库并跑黄金路径检查链，或申请 Helm Cloud（托管版，仅邀请制）。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default">
              <a
                href="https://github.com/Helm-OpenSource/helm-public"
                target="_blank"
                rel="noopener noreferrer"
              >
                {english ? "View on GitHub" : "去 GitHub 看源码"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/trial">{english ? "Helm Cloud trial" : "Helm Cloud 试用"}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/login">{english ? "Sign in" : "登录"}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
