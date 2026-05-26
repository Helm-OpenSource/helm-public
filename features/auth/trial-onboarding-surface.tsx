import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowRight, CheckCircle2, Clock3, CreditCard, ShieldCheck } from "lucide-react";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrialOnboardingSurfaceData } from "@/lib/auth/trial-onboarding";
import type { UiLocale } from "@/lib/i18n/config";

type TrialOnboardingSurfaceProps = {
  locale: UiLocale;
  data: TrialOnboardingSurfaceData;
};

function formatDateLabel(value: Date | null, locale: UiLocale) {
  if (!value) {
    return locale === "en-US" ? "Not set yet" : "尚未设置";
  }

  if (locale === "en-US") {
    return format(value, "MMM d, yyyy");
  }

  return format(value, "yyyy年M月d日", { locale: zhCN });
}

const accessStateLabels = {
  TRIALING: { zh: "试用中", en: "Trialing" },
  ACTIVE: { zh: "正式有效", en: "Active" },
  GRACE: { zh: "宽限期", en: "Grace" },
  READ_ONLY: { zh: "只读", en: "Read-only" },
  CANCELED: { zh: "已取消", en: "Canceled" },
} as const;

export function TrialOnboardingSurface({
  locale,
  data,
}: TrialOnboardingSurfaceProps) {
  const english = locale === "en-US";
  const onboardingRecommendations = data.nextSteps.slice(0, 3).map((step) => ({
    title: step.title,
    body: step.description,
    href: step.href,
  }));
  const onboardingReminders = [
    {
      title: english ? "Already set up for you" : "已经先给你铺好",
      body: english
        ? "Identity, workspace and the first workers are in place."
        : "身份、工作区和第一批执行已经到位。",
    },
    {
      title: english ? "Narrow first, widen later" : "先收窄，再扩",
      body: english
        ? "Governance, seats and trial boundary come first. Automation can wait."
        : "先把治理、席位、试用边界对好，自动化再说。",
    },
  ];

  return (
    <div className="workspace-surface-stack">
      <WorkspaceGuidancePanel
        defaultExpanded
        eyebrow={english ? "Onboarding guidance" : "开通引导"}
        title={english ? "Start with the smallest loop that works" : "先把最小闭环跑通"}
        summary={english ? "Lifecycle, seats, and the first moves — readable up front, review-first." : "生命周期、席位、第一批动作——先看清，再复核。"}
        recommendations={onboardingRecommendations}
        reminders={onboardingReminders}
        boundary={data.boundaryNote}
      />

      <div className="workspace-surface-stack">
        <WorkspaceSurfacePreferences />
        <Card className="workspace-form-assist workspace-panel-muted">
          <CardContent className="space-y-3 py-5">
            <p className="workspace-eyebrow">
              {english ? "Onboarding assist" : "开通辅助"}
            </p>
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {english
                ? "Finish three user jobs before touching detailed controls."
                : "先完成三件用户任务，再碰详细控制项。"}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {english
                ? "Confirm who runs the workspace, choose the first signal source, and invite reviewers. Billing and advanced controls can wait until the first loop is readable."
                : "先确认谁操盘、先接哪类信号、谁来复核。计费和高级控制可以等第一条回路清楚后再看。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="#setup-wizard">
                  {english ? "Continue setup" : "继续初始化"}
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">
                  {english ? "Open dashboard" : "进入工作台"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="workspace-shell-panel overflow-hidden rounded-[28px] border shadow-sm">
        <CardContent className="grid gap-6 p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="workspace-eyebrow">
                {english ? "Self-serve trial onboarding" : "自助试用已就绪"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_14%,transparent)]">
                  {accessStateLabels[data.accessState][english ? "en" : "zh"]}
                </span>
                <span className="rounded-full bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-1 text-xs font-medium text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  {data.roleLabel}
                </span>
                <span className="rounded-full bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-1 text-xs font-medium text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  {data.organizationName}
                </span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {data.currentJudgement}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
                {data.whyItMatters}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="workspace-panel-muted rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Trial window" : "试用窗口"}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      {english ? "Trial ends" : "试用结束"}：{formatDateLabel(data.trialEndsAt, locale)}
                    </p>
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {data.graceRule}
                    </p>
                  </div>
                </div>
              </div>
              <div className="workspace-panel-muted rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Billing and restore path" : "购买与恢复路径"}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">{data.purchasePath}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="#setup-wizard">
                  {english ? "Continue setup" : "继续初始化"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">
                  {english ? "Open dashboard after setup" : "初始化后进入工作台"}
                </Link>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="workspace-panel-muted rounded-2xl p-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Already in place" : "当前已先到位"}
              </p>
              <div className="mt-3 space-y-3">
                {data.helmDid.map((item) => (
                  <div key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
                    <p className="text-sm leading-6 text-[color:var(--muted)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="workspace-panel-muted rounded-2xl p-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Boundary note" : "边界说明"}
              </p>
              <div className="mt-3 flex gap-3">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
                <p className="text-sm leading-6 text-[color:var(--muted)]">
                  {data.boundaryNote}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="workspace-panel">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Team access and trial state" : "团队访问与试用状态"}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted)]">{data.seatSummary}</p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{data.lifecycleSummary}</p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {english ? "Grace ends" : "宽限期结束"}：{formatDateLabel(data.graceEndsAt, locale)}
            </p>
          </CardContent>
        </Card>

        <Card className="workspace-panel">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Included core workers" : "已包含的核心能力"}
            </p>
            <div className="space-y-3">
              {data.includedWorkers.map((worker) => (
                <div key={worker.key} className="workspace-panel-muted rounded-2xl p-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{worker.label}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{worker.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="workspace-panel">
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Start with these three moves" : "先从这 3 件事开始"}
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {data.nextSteps.map((step) => (
              <div key={step.title} className="workspace-panel-muted rounded-2xl p-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{step.description}</p>
                {step.href ? (
                  <div className="mt-4">
                    <Button asChild variant="ghost" className="px-0">
                      <Link href={step.href}>
                        {english ? "Open now" : "现在打开"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
