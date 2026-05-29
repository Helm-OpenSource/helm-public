import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ArrowRight, BriefcaseBusiness, Handshake, Sparkles } from "lucide-react";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUiLocale } from "@/lib/i18n/config";
import { getProgramCatalogData, type ProgramCatalogData } from "@/features/programs/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Build / deliver / refer with Helm | Partner programs" : "和 Helm 一起共建 / 交付 / 转介 | 合作计划",
    description: english
      ? "Three ways to make money or impact with Helm: ship a worker module, deliver pilots as a partner, or refer warm leads. Read the revenue logic, settlement posture and explicit no-go list before applying."
      : "和 Helm 一起的三条变现路径：贡献能力模块、做定制交付伙伴、做销售转介。先看清收入怎么算、怎么结算、我们刻意不做什么，再决定是否申请。",
  };
}

const programIcons = {
  worker_publisher_program: Sparkles,
  custom_partner_program: Handshake,
  sales_referral_program: BriefcaseBusiness,
} as const;

export default async function ProgramsPage() {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const data = await getProgramCatalogData(locale);

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm programs" : "Helm 参与计划"}</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "Three ways to earn or impact with Helm. Rules in plain English."
              : "和 Helm 一起的三条路径：能力贡献 · 定制交付 · 销售转介。规则写白纸黑字，不绕弯。"}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/">{english ? "Back home" : "返回首页"}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/demo">{english ? "Open demo" : "查看演示"}</Link>
          </Button>
          <Button asChild variant="default">
            <a
              href="https://github.com/Helm-OpenSource/helm-public"
              target="_blank"
              rel="noopener noreferrer"
            >
              {english ? "GitHub" : "GitHub"}
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-6 pb-16 lg:px-10">
        <section className="space-y-4">
          <p className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Not a public marketplace · Submitting does not auto-grant portal access" : "不是公开市场 · 提交申请不会自动开通门户访问"}
          </p>
          <h1 className="max-w-5xl text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            {english
              ? "Build, deliver, or refer."
              : "贡献能力、做交付，或转介。"}
          </h1>
          <p className="max-w-4xl text-base leading-8 text-[color:var(--muted)]">
            {english
              ? "Pick a path. Each card below says exactly what you do, where the revenue comes from, when settlement happens, and what's out of scope. Wire-transfer settlement, human-read applications, no public ranking."
              : "挑一条路径。下面每张卡上写清楚：你做什么、收入怎么来、什么时候结算、什么不做。电汇结算、人工读每份申请，不做公开排名。"}
          </p>
        </section>

        {!data.workspace || data.programs.length === 0 ? (
          <Card className="border border-[color:var(--border)] bg-[color:var(--surface)]">
            <CardContent className="p-8 text-sm leading-7 text-[color:var(--muted)]">
              {english
                ? "Program catalog is not configured yet. Once the host workspace is available, this page will publish the current program list and terms here."
                : "当前参与目录还没有配置完成。等宿主工作区准备好后，这里会发布可参与项目和当前条款。"}
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-6 lg:grid-cols-3">
            {data.programs.map((program: ProgramCatalogData["programs"][number]) => {
              const Icon = programIcons[program.programKey as keyof typeof programIcons] ?? Handshake;

              return (
                <Card
                  key={program.id}
                  className="min-w-0 max-w-full overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]"
                >
                  <CardHeader className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="min-w-0 break-words text-2xl tracking-tight">
                          {program.title}
                        </CardTitle>
                        <Badge variant="approval">{program.activeTerms?.versionKey ?? "v1"}</Badge>
                        {program.status !== "ACTIVE" ? (
                          <Badge variant="neutral">
                            {english ? "Applications paused" : "申请暂停中"}
                          </Badge>
                        ) : !program.activeTerms ? (
                          <Badge variant="neutral">
                            {english ? "Terms updating" : "条款更新中"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm leading-7 text-[color:var(--muted)]">{program.summary}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
                      <p>
                        <span className="font-semibold text-[color:var(--foreground)]">
                          {english ? "For:" : "适合谁："}
                        </span>{" "}
                        {program.audienceSummary}
                      </p>
                      <p>
                        <span className="font-semibold text-[color:var(--foreground)]">
                          {english ? "You can do:" : "能做什么："}
                        </span>{" "}
                        {program.contributionSummary}
                      </p>
                      <p>
                        <span className="font-semibold text-[color:var(--foreground)]">
                          {english ? "Revenue comes from:" : "收入来自："}
                        </span>{" "}
                        {program.revenueSummary}
                      </p>
                      <p>
                        <span className="font-semibold text-[color:var(--foreground)]">
                          {english ? "Settlement posture:" : "结算节奏："}
                        </span>{" "}
                        {program.settlementSummary}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                      {program.boundarySummary}
                    </div>
                    {program.status !== "ACTIVE" ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--status-warning-bg)] px-4 py-4 text-sm leading-6 text-[color:var(--status-warning-text)]">
                        {english
                          ? "This program stays visible for reference, but new applications are paused until Helm re-opens intake."
                          : "当前计划仍对外展示，但在 Helm 重新开放申请入口之前不会接受新的申请。"}
                      </div>
                    ) : !program.activeTerms ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--status-warning-bg)] px-4 py-4 text-sm leading-6 text-[color:var(--status-warning-text)]">
                        {english
                          ? "Current terms are being refreshed. Read the scope first, then wait for the next active terms version before you apply."
                          : "当前条款正在更新。你可以先阅读范围，等新的生效条款版本发布后再提交申请。"}
                      </div>
                    ) : null}
                    <Button asChild className="w-full">
                      <Link href={`/programs/${program.slug}`}>
                        {program.status === "ACTIVE" && program.activeTerms
                          ? english
                            ? "Read the math · apply"
                            : "看清规则 · 申请加入"
                          : english
                            ? "Read terms"
                            : "查看规则"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
