import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveUiLocale } from "@/lib/i18n/config";
import { getParticipantPortalData } from "@/features/participant-portal/queries";
import { ParticipantPortalClient } from "@/features/participant-portal/participant-portal-client";
import { defaultWorkspaceFeatureFlags } from "@/lib/workspace-ops";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Your attributed earnings | Helm contributor portal" : "你自己的归因收益 | Helm 贡献方门户",
    description: english
      ? "See exactly what you've earned, what's settled, what's pending. Self-only view, no admin scope. Settlement is wire-only — no surprises."
      : "看清你自己赚了多少、已结算多少、待结算多少。仅本人可见，不开放任何管理权限。结算只走电汇，不留模糊。",
  };
}

function ParticipantPortalPublicEntry({ locale }: { locale: "zh-CN" | "en-US" }) {
  const english = locale === "en-US";
  const notes = [
    english
      ? "The invite link is one-time and expires. Lost it? Ask the org owner or billing admin to resend — we won't recover it."
      : "邀请链接是一次性的，会过期。丢了？联系 Helm 组织负责人或计费管理员重发——我们不做找回。",
    english
      ? "Inside, you only see your own attributed earnings. No admin tools, no other contributors, no team-level numbers."
      : "进去之后只能看你自己的归因收益。看不到管理工具，看不到其他贡献者，看不到团队层数据。",
    english
      ? "Settlement is wire transfer, manually processed. Numbers shown here are not auto-paid until a human releases them."
      : "结算走电汇、人工处理。这里的数字在人工放款前都不会自动到账。",
  ];

  return (
    <main className="surface-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Helm participant portal" : "Helm 贡献方门户"}
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "Invite-only · self-only view · wire settlement" : "仅限邀请 · 只看本人 · 电汇结算"}
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
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] md:text-5xl">
            {english ? "Open the invite link from your email." : "请用邮箱里的邀请链接进入。"}
          </h1>
          <p className="max-w-3xl text-base leading-8 text-[color:var(--muted)]">
            {english
              ? "Inside you'll see your own attributed earnings, settlement status, and profile — nothing else."
              : "进入后你只能看到自己的归因收益、结算状态和资料——其它什么都看不到。"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
            <CardContent className="space-y-5 p-6 md:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                  {english ? "Got the invite email already?" : "已经收到邀请邮件？"}
                </h2>
                <p className="text-sm leading-7 text-[color:var(--muted)]">
                  {english
                    ? "Open the link from that email — it looks like /portal/access/… The link guides you through a 2-minute onboarding, then drops you into your earnings view."
                    : "打开邮件里的那条链接（形如 /portal/access/…）。链接会带你走 2 分钟开通流程，直接进入你的收益视图。"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/programs">
                    {english ? "See partner programs" : "查看合作计划"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/login">{english ? "Sign in" : "登录"}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 max-w-full overflow-hidden rounded-[28px] border">
            <CardContent className="space-y-4 p-6 md:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {english ? "What we promise — and what we don't" : "我们承诺的 · 和不承诺的"}
              </h2>
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note} className="workspace-panel-muted rounded-3xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                    {note}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

export default async function ParticipantPortalPage({
  searchParams,
}: {
  searchParams: Promise<{
    access?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  if (!user) {
    return <ParticipantPortalPublicEntry locale={locale} />;
  }

  const params = await searchParams;
  const data = await getParticipantPortalData({
    userId: user.id,
    selectedAccessId: params.access,
  });

  return (
    <WorkspaceUiProvider
      locale={locale}
      pilotMode
      captureConsentRequired
      dataRetentionDays={90}
      featureFlags={defaultWorkspaceFeatureFlags}
      demoMode={null}
    >
      <ParticipantPortalClient locale={locale} data={data} />
    </WorkspaceUiProvider>
  );
}
