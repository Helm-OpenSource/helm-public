import { cookies } from "next/headers";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  LogIn,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Users2,
  Wifi,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loginAction } from "@/features/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getDemoModeProfiles } from "@/lib/demo/demo-modes";
import { resolveUiLocale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english
      ? "Helm | Open-source AI operating toolkit for enterprise AI delivery engineers"
      : "Helm | 面向企业AI交付工程师的开源经营推进工具集",
    description: english
      ? "AI agent platforms give you Lego bricks. Helm turns judgement, evidence, review, boundaries, and delivery packages into a forkable Apache-2.0 Core for enterprise AI delivery engineers."
      : "AI平台给你乐高积木。Helm把判断、证据、复核、边界、交付包做成可复用的Apache-2.0核心工程，给企业AI交付工程师复用。",
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user = null;
  let hasDbConnection = true;

  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Can't reach database server")) {
      hasDbConnection = false;
    } else {
      throw error;
    }
  }

  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const params = (await searchParams) ?? {};
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  const demoProfiles = Object.fromEntries(
    getDemoModeProfiles(locale).map((profile) => [profile.mode, profile] as const),
  );

  if (user && view !== "public" && hasDbConnection) {
    redirect("/dashboard");
  }

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

  const heroPaths = [
    {
      key: "fork",
      icon: Sparkles,
      eyebrow: english ? "Apache-2.0 · GitHub" : "Apache-2.0 · GitHub",
      title: english ? "Fork the toolkit" : "复用这套工具集",
      body: english
        ? "Read the source, fork the repo, and use the Golden Path checks to keep judgement, evidence, review, and boundaries visible. Apache-2.0, no royalty, no platform tax."
        : "看源码、复刻仓库，用黄金路径检查链把判断、证据、复核、边界看清楚。Apache-2.0，不抽成，不锁渠道。",
      href: "https://github.com/Helm-OpenSource/helm-public",
      cta: english ? "View on GitHub" : "去 GitHub 看源码",
      testId: "home-path-fork",
    },
    {
      key: "demo",
      icon: PlayCircle,
      eyebrow: english ? "60 seconds" : "60 秒看完",
      title: english ? "See what gets shipped" : "看交付物长什么样",
      body: english
        ? "Three pre-loaded role workspaces. Pick one, see the first call Helm puts in front of an end user."
        : "3 个预置角色工作区。挑一个，看 Helm 给端用户屏幕上推的第一件事。",
      href: "#scenarios",
      cta: english ? "Pick a role · 60 sec" : "挑一个角色 · 60 秒",
      testId: "home-path-demo",
    },
    {
      key: "trial",
      icon: LogIn,
      eyebrow: english ? "Helm Cloud · invite-only" : "Helm Cloud · 仅邀请制",
      title: english ? "Try the hosted version" : "试用托管版",
      body: english
        ? "Helm Cloud is invite-only managed Helm. 4 short questions; reply in 1 business day. Or sign in if you already have a workspace."
        : "Helm Cloud 是托管版（仅邀请制）。回答 4 个简短问题，1 个工作日内答复。已有工作区可直接登录。",
      href: "/trial",
      cta: english ? "Apply or sign in" : "申请或登录",
      testId: "home-path-trial",
    },
  ] as const;

  const judgementCard = {
    eyebrow: english ? "Today · Huadong Intelligent Mfg pilot" : "今天 · 华东智造试点",
    headline: english
      ? "If the ROI pack doesn't go out today, the May window is gone."
      : "投资回报材料今天不发，5 月窗口就要掉。",
    body: english
      ? "Procurement left ROI questions on the table. The CFO asked for a structured pack. CRM is still parked at \"business review\". The draft is sitting in someone's review queue. Helm has caught all four — and stopped there. No email left the building."
      : "采购会留下了投资回报问题，财务要结构化材料，客户关系管理阶段还停在「商务评审」，外发草稿还在别人的复核框里。这四条Helm都接住了，但邮件没发出去，客户关系管理系统也没动。",
    actionLabel: english ? "Send ROI pack · today" : "发送投资回报材料 · 今天",
    metaTrace: english
      ? "trace · ops-judgement-pilot-2026-04-30"
      : "追踪 · ops-judgement-pilot-2026-04-30",
  };

  const boundaryRows = [
    {
      auto: english ? "Turn a 60-min call into facts in 90 sec" : "60 分钟会议 90 秒提取事实",
      review: english ? "Draft a follow-up email — you click send" : "起草跟进邮件 · 你点发送",
      manual: english ? "Sign the SOW" : "签合同",
    },
    {
      auto: english ? "Flag 3 stalled deals before stand-up" : "晨会前标出 3 个停滞机会",
      review: english ? "Open an approval to move CRM stage" : "起一个审批，把客户关系管理阶段往前推",
      manual: english ? "Pay an invoice" : "财务结算",
    },
    {
      auto: english ? "Write back to operating memory" : "沉淀经营记忆",
      review: english ? "Suggest a new owner for a dead handoff" : "为停滞交接推荐新负责人",
      manual: english ? "Hire, fire, or commit a number" : "录用、解雇、对外承诺数字",
    },
    {
      auto: english ? "Stamp critical write paths with trace IDs" : "关键写路径打追踪编号",
      review: english ? "Land an audit row before any customer-visible draft goes out" : "客户可见草稿外发前先落一条审计",
      manual: english ? "Decide what \"send\" actually means" : "决定真正的「发送」意味着什么",
    },
  ] as const;

  const scenarioCards = [
    {
      key: "sales",
      mode: "sales" as const,
      icon: BriefcaseBusiness,
      title: english ? "Sales / BD" : "销售 / 商务拓展",
      summary: english
        ? "A key enterprise pilot, a recovery deal and a security-review stall — Helm has already picked which one moves first today. The demo landed well; ROI, legal and delivery are split across three threads, and you'll see exactly where to push."
        : "一个大客户试点、一个恢复单、一个安全评审卡点——今天先推哪个，Helm已经替你排好。演示反馈不错，但投资回报、法务、交付分在三条线上，进去就看到该推哪一头。",
      accountEmail: demoProfiles.sales.accountEmail,
      targetPath: "/dashboard",
    },
    {
      key: "founder",
      mode: "founder" as const,
      icon: Target,
      title: english ? "Founder / COO" : "创始人 / COO",
      summary: english
        ? "Sales, delivery and finance each hold a piece. Helm stitches them together and surfaces the 3 calls only you can make today — not a dashboard, not a digest."
        : "销售、交付、财务各握一段。Helm 把它们拼起来，把今天只有你能拍板的 3 件事直接送到屏幕上——不是仪表盘，也不是摘要。",
      accountEmail: demoProfiles.founder.accountEmail,
      targetPath: "/dashboard",
    },
    {
      key: "recruiter",
      mode: "recruiter" as const,
      icon: Users2,
      title: english ? "Recruiting / Search" : "招聘 / 猎头",
      summary: english
        ? "2 finalists going cold this week — panel ended 8 days ago, feedback never sent, they're already in another loop. Helm has drafted the line that revives them. You click or you don't."
        : "本周 2 位终面在降温——面试 8 天前结束、反馈一直没发、人已经进了别家流程。Helm 把把人捞回来的话写好了，你点或不点而已。",
      accountEmail: demoProfiles.recruiter.accountEmail,
      targetPath: "/dashboard",
    },
  ] as const;

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      {!hasDbConnection && (
        <div className="border-b border-[color:var(--border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]">
          <div className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-6 py-3 lg:px-10">
            <Wifi className="h-4 w-4 shrink-0" />
            <p className="text-sm leading-6">
              {english
                ? "Can't reach the database from this network. You can still browse — data-bound features come back when you reconnect."
                : "当前网络连不到数据库。页面可以照常浏览，连上 VPN 或公司网络后数据功能即恢复。"}
            </p>
            <Link
              href="/"
              className="ml-auto text-xs font-semibold underline-offset-4 hover:underline"
              data-testid="home-db-banner-reload"
            >
              {english ? "Reload" : "刷新"}
            </Link>
          </div>
        </div>
      )}

      <header className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[24rem] text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "Open-source AI operating toolkit · for enterprise AI delivery engineers"
              : "面向企业AI交付工程师的开源经营推进工具集"}
          </p>
        </div>
        <nav
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
          data-testid="public-landing-controls"
        >
          <PublicLocaleSwitcher
            locale={locale}
            variant="compact"
            testId="public-landing-locale-switcher"
          />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <a href="#thesis">{english ? "Why Helm" : "为什么是 Helm"}</a>
          </Button>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <a href="#boundary">{english ? "What we won't do" : "我们刻意不做"}</a>
          </Button>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/programs">{english ? "Partner programs" : "合作计划"}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">{english ? "Sign in" : "登录"}</Link>
          </Button>
          <Button asChild variant="default">
            <a
              href="https://github.com/Helm-OpenSource/helm-public"
              data-testid="home-cta-github-header"
              target="_blank"
              rel="noopener noreferrer"
            >
              {english ? "GitHub" : "GitHub"}
            </a>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-20 px-6 pb-20 lg:px-10">
        <section
          id="entry"
          className="space-y-10 pt-6"
          data-testid="home-hero"
        >
          <div className="max-w-3xl space-y-4">
            <p className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--accent)]">
              {english
                ? "For AI delivery engineers · Apache-2.0"
                : "面向AI交付工程师 · Apache-2.0"}
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              {english
                ? "Stop rebuilding the boring scaffolding for every enterprise AI delivery."
                : "别为每个企业AI交付项目重写同一套无聊的脚手架。"}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)] md:text-lg md:leading-8">
              {english
                ? "Helm is the assembled operating loop for turning customer implementation work into judgement, evidence, review, boundary, and delivery-package artifacts your team can fork and verify."
                : "Helm是已经搭好的经营推进闭环，把客户业务落地里的判断、证据、复核、边界、交付包做成可复用、可验证的工程结构。"}
            </p>
            <div
              className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-1.5 text-xs leading-5 text-[color:var(--muted)]"
              data-testid="home-pilot-banner"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[color:var(--accent)]" />
              <span>
                {english
                  ? "Apache-2.0 · Forkable Core · Review-first Golden Path"
                  : "Apache-2.0 · 可复刻核心工程 · 先复核黄金路径"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3" data-testid="home-paths">
            {heroPaths.map((path) => {
              const isExternal = path.href.startsWith("#");
              const cardInner = (
                <Card className="h-full border border-[color:var(--border)] bg-[color:var(--surface)] transition hover:border-[color:var(--accent)] hover:shadow-[var(--shadow-card-hover)]">
                  <CardContent className="flex h-full flex-col gap-4 py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        <path.icon className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {path.eyebrow}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                        {path.title}
                      </h2>
                      <p className="text-sm leading-6 text-[color:var(--muted)]">{path.body}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-[color:var(--accent)]">
                      <span>{path.cta}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );

              return isExternal ? (
                <a
                  key={path.key}
                  href={path.href}
                  data-testid={path.testId}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2"
                >
                  {cardInner}
                </a>
              ) : (
                <Link
                  key={path.key}
                  href={path.href}
                  data-testid={path.testId}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2"
                >
                  {cardInner}
                </Link>
              );
            })}
          </div>
        </section>

        <section
          id="thesis"
          className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start"
          data-testid="home-thesis"
        >
          <div className="space-y-4">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {english
                ? "Your meetings, mail, CRM and HR systems already know which deal is dying. They just never tell you in time."
                : "你的会议、邮件、客户关系管理和人力系统其实早就知道哪一单要黄了。它们只是从来没把这件事在第一时间告诉过你。"}
            </h2>
            <p className="max-w-xl text-base leading-7 text-[color:var(--muted)]">
              {english
                ? "Helm picks them up and puts the next call in front of you. Like this:"
                : "Helm 把它们接住，把下一个该打的电话送到你面前。比如这张："}
            </p>
          </div>

          <Card className="border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]">
            <CardContent className="space-y-4 py-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {judgementCard.eyebrow}
                </p>
                <span className="font-mono text-[11px] text-[color:var(--muted-foreground)]">
                  {judgementCard.metaTrace}
                </span>
              </div>

              <p className="text-lg font-semibold leading-7 text-[color:var(--foreground)]">
                {judgementCard.headline}
              </p>

              <p className="text-sm leading-6 text-[color:var(--muted)]">{judgementCard.body}</p>

              <div
                className="inline-flex items-center gap-2 rounded-md border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-1.5 text-sm font-semibold text-[color:var(--foreground)]"
                role="img"
                aria-label={english ? "Preview only" : "仅示意"}
              >
                <span>{judgementCard.actionLabel}</span>
                <ArrowRight className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                <span className="ml-1 rounded-full bg-[color:var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                  {english ? "Preview" : "示意"}
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="boundary" className="space-y-6" data-testid="home-boundary">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {english
                ? "We never auto-send to your customer."
                : "我们不替你给客户发任何东西。"}
            </h2>
            <p className="text-base leading-7 text-[color:var(--muted)]">
              {english
                ? "Anything customer-visible waits for you to click. Here's exactly what Helm does on its own, what it drafts first, and what only you can do."
                : "凡是客户能看到的，都等你点。下面是 Helm 自己做的、先起草等你确认的、和只能你来做的。"}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
            <table
              className="w-full border-collapse text-sm"
              data-testid="home-boundary-table"
            >
              <thead className="bg-[color:var(--surface-subtle)] text-xs font-medium text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Helm acts" : "Helm 自动可做"}
                  </th>
                  <th className="border-l border-[color:var(--border)] px-4 py-3 text-left font-semibold">
                    {english ? "Review first" : "复核后才做"}
                  </th>
                  <th className="border-l border-[color:var(--border)] px-4 py-3 text-left font-semibold">
                    {english ? "Always human" : "永远人工"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[color:var(--surface)] text-[color:var(--foreground)]">
                {boundaryRows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-t border-[color:var(--border)]"
                  >
                    <td className="px-4 py-3 leading-6">{row.auto}</td>
                    <td className="border-l border-[color:var(--border)] px-4 py-3 leading-6">
                      {row.review}
                    </td>
                    <td className="border-l border-[color:var(--border)] px-4 py-3 leading-6">
                      {row.manual}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="scenarios" className="space-y-6" data-testid="home-scenarios">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {english
                ? "Pick a role. 60 seconds, no email."
                : "挑一个角色。60 秒，不留邮箱。"}
            </h2>
            <p className="text-base leading-7 text-[color:var(--muted)]">
              {english
                ? "Each one is a real workspace with seeded enterprise blockers — the same shape your delivery team would fork and ship."
                : "每个都是真工作区，里面铺好了真实的卡点——你的交付团队就是这样复刻一份交付出去的。"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {scenarioCards.map((card) => (
              <Card
                key={card.key}
                className="flex flex-col border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]"
                data-testid={`home-scenario-${card.mode}`}
              >
                <CardContent className="flex h-full flex-col gap-4 py-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                      {card.title}
                    </h3>
                    <p className="text-sm leading-6 text-[color:var(--muted)]">{card.summary}</p>
                  </div>
                  <form action={enterDemoWorkspace} className="mt-auto">
                    <input type="hidden" name="accountEmail" value={card.accountEmail} />
                    <input type="hidden" name="targetPath" value={card.targetPath} />
                    <Button
                      type="submit"
                      variant="secondary"
                      className="w-full justify-between"
                      data-testid={`home-scenario-enter-${card.mode}`}
                    >
                      <span>{english ? "Open this workspace · 60 sec" : "进入这个角色 · 60 秒"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-6 py-8 sm:px-10 sm:py-10"
          data-testid="home-secondary-cta"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {english
                  ? "Two ways in."
                  : "两种进入方式。"}
              </h2>
              <p className="text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Clone it and run the Golden Path checks, or apply for Helm Cloud — managed, invite-only."
                  : "自己克隆仓库并跑黄金路径检查链，或申请 Helm Cloud（托管版，仅邀请制）。"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="default">
                <a
                  href="https://github.com/Helm-OpenSource/helm-public"
                  data-testid="home-cta-github"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {english ? "View on GitHub" : "去 GitHub 看源码"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/trial" data-testid="home-cta-trial">
                  {english ? "Apply for Helm Cloud" : "申请 Helm Cloud"}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/programs" data-testid="home-cta-programs">
                  {english ? "Partner programs" : "合作计划"}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="border-t border-[color:var(--border)] bg-[color:var(--surface)]"
        data-testid="home-footer"
      >
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-8 text-xs text-[color:var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--accent)]" />
            <p className="leading-5">
              {english
                ? "Helm is Apache-2.0 open source. Helm Cloud (managed) is invite-only — self-serve signup is off on purpose."
                : "Helm是Apache-2.0开源工具集。Helm Cloud（托管版）仅邀请制——不开放公开自助注册是有意为之。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/Helm-OpenSource/helm-public"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[color:var(--foreground)]"
            >
              {english ? "GitHub" : "GitHub"}
            </a>
            <Link href="/programs" className="hover:text-[color:var(--foreground)]">
              {english ? "Partner programs" : "合作计划"}
            </Link>
            <Link href="/login" className="hover:text-[color:var(--foreground)]">
              {english ? "Sign in" : "登录"}
            </Link>
            <Link href="/trial" className="hover:text-[color:var(--foreground)]">
              {english ? "Helm Cloud trial" : "Helm Cloud 试用"}
            </Link>
            <a
              href="https://github.com/Helm-OpenSource/helm-public/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[color:var(--foreground)]"
            >
              {english ? "Feedback" : "问题反馈"}
            </a>
            <span className="text-[color:var(--muted-foreground)]">
              {english
                ? "Contact WeChat: ffjw0821 (community invite QR via WeChat)"
                : "联系微信：ffjw0821（入群二维码请先加微信获取当期有效码）"}
            </span>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1280px] px-6 pb-8 lg:px-10">
          <div className="inline-flex flex-col gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {english ? "Helm open-source community WeChat invite QR" : "Helm 开源社区微信邀请二维码"}
            </p>
            <Image
              src="/wechat-community-qr.png"
              alt={english ? "Helm community WeChat invite QR" : "Helm 开源社区微信邀请二维码"}
              width={176}
              height={260}
              className="h-auto w-44 rounded-md border border-[color:var(--border)] bg-black/5"
              loading="lazy"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
