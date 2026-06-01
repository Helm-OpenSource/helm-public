import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUiLocale } from "@/lib/i18n/config";
import { getProgramCatalogDetail } from "@/features/programs/queries";
import { ProgramApplicationForm } from "@/features/programs/program-application-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const { slug } = await params;
  const program = await getProgramCatalogDetail({ slug, locale });

  return {
    title: program
      ? `Helm | ${program.title}`
      : english
        ? "Helm | Program"
        : "Helm | 参与计划",
    description: program?.summary ?? (english ? "Read the current program terms." : "查看当前参与计划条款。"),
  };
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const { slug } = await params;
  const program = await getProgramCatalogDetail({ slug, locale });

  if (!program) {
    notFound();
  }

  return (
    <div className="surface-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{program.title}</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "Program rules and controlled application intake" : "参与规则与受控申请入口"}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/programs">
              <ArrowLeft className="h-4 w-4" />
              {english ? "Back to programs" : "返回参与计划"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-6 pb-16 lg:px-10">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="approval">{program.activeTerms?.versionKey ?? "v1"}</Badge>
            {program.status !== "ACTIVE" ? (
              <Badge variant="neutral">{english ? "Applications paused" : "申请暂停中"}</Badge>
            ) : !program.activeTerms ? (
              <Badge variant="neutral">{english ? "Terms updating" : "条款更新中"}</Badge>
            ) : null}
          </div>
          <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] md:text-5xl">
            {program.title}
          </h1>
          <p className="max-w-4xl text-base leading-8 text-[color:var(--muted)]">{program.summary}</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center gap-3 break-words text-2xl tracking-tight text-[color:var(--foreground)]">
                <FileText className="h-5 w-5 text-[var(--accent)]" />
                {english ? "Current terms and rule surface" : "当前条款与规则面"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm leading-7 text-[color:var(--muted)]">
              <div className="rounded-3xl border border-[color:var(--border)] px-4 py-4">
                <p className="font-semibold text-[color:var(--foreground)]">{program.activeTerms?.title ?? (english ? "Current terms" : "当前条款")}</p>
                <p className="mt-2">{program.activeTerms?.summary ?? program.boundarySummary}</p>
              </div>
              <div className="space-y-3">
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Who this is for:" : "适合谁："} </span>{program.audienceSummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "What you can do:" : "能做什么："} </span>{program.contributionSummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Revenue comes from:" : "收入来自："} </span>{program.activeTerms?.revenueDefinition ?? program.revenueSummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Split logic:" : "分成逻辑："} </span>{program.activeTerms?.splitLogicSummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Reversal / refund:" : "冲回 / 退款："} </span>{program.activeTerms?.reversalRuleSummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Review boundary:" : "审核 / 批准边界："} </span>{program.activeTerms?.reviewBoundarySummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Settlement posture:" : "结算姿态："} </span>{program.activeTerms?.payoutBoundarySummary ?? program.settlementSummary}</p>
                <p><span className="font-semibold text-[color:var(--foreground)]">{english ? "Platform rights:" : "平台保留权："} </span>{program.activeTerms?.platformRightsSummary}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-3 break-words text-2xl tracking-tight text-[color:var(--foreground)]">
                  <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
                  {english ? "Apply · we read every one by hand" : "申请加入 · 每份都人工读"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                  {program.status !== "ACTIVE"
                    ? english
                      ? "Intake is paused. The terms stay readable so the boundary is still public — but no new applications are accepted right now."
                      : "申请入口暂停中。规则继续公开可读，让当前边界透明——但暂不接收新申请。"
                    : !program.activeTerms
                      ? english
                        ? "Terms are being refreshed. You can still read the scope. Applications reopen once the next active terms version ships."
                        : "条款正在更新。你可以先读范围，等下一版生效条款发布后申请重新开放。"
                    : english
                      ? "Submitting does not auto-grant portal access. A human reviews every submission and replies with yes / not yet / waitlisted / invited."
                      : "提交申请不会自动获得门户访问权限。每份申请由人工复核，回复「通过 / 暂时不合适 / 候补 / 邀请」。"}
                </div>
                <ProgramApplicationForm locale={locale} program={program} />
              </CardContent>
            </Card>

            <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
              <CardContent className="space-y-3 p-6 text-sm leading-7 text-[color:var(--muted)]">
                <p className="font-semibold text-[color:var(--foreground)]">
                  {english ? "What we won't do" : "我们不做的"}
                </p>
                <ul className="space-y-2">
                  <li>{english ? "No public ranking or marketplace." : "不做公开排名，不做拼价格的市场。"}</li>
                  <li>{english ? "No auto payout — settlement is wire-only, by hand." : "不做自动打款——结算只走电汇、人工处理。"}</li>
                  <li>{english ? "No self-serve partner finance console." : "不做合作方自助财务控制台。"}</li>
                  <li>{english ? "Approval doesn't grant any control over Helm's flows." : "通过申请不代表拿到 Helm 的流程控制权。"}</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
